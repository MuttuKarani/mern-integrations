import crypto from 'node:crypto';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { InMemoryIdempotencyStore } from './InMemoryIdempotencyStore.js';

/**
 * Recursively serializes an object with sorted keys for consistent SHA-256 fingerprint hashing.
 *
 * @param {any} value
 * @returns {string}
 */
function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }

  const sortedKeys = Object.keys(value).sort();
  const pairs = sortedKeys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes a deterministic SHA-256 request fingerprint based on method, path, and payload.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function defaultFingerprint(req) {
  const method = (req.method || 'POST').toUpperCase();
  const urlPath = (req.baseUrl || '') + (req.path || req.url || '');
  const bodyPayload = req.body !== undefined ? canonicalStringify(req.body) : '';

  return crypto
    .createHash('sha256')
    .update(`${method}:${urlPath}:${bodyPayload}`)
    .digest('hex');
}

/**
 * Creates an Express middleware to enforce request idempotency.
 *
 * @param {Object} [options]
 * @param {string} [options.headerName='idempotency-key'] - HTTP header name to read key from.
 * @param {boolean} [options.required=false] - If true, missing idempotency key will throw ValidationError.
 * @param {number} [options.ttlMs=86400000] - Retention window for completed responses (default 24h).
 * @param {number} [options.lockTimeoutMs=30000] - Timeout for in-flight requests before reclaiming lock (default 30s).
 * @param {string[]} [options.enforceMethods=['POST', 'PUT', 'PATCH', 'DELETE']] - HTTP methods to enforce.
 * @param {InMemoryIdempotencyStore|Object} [options.store] - Storage adapter implementing get, set, and delete.
 * @param {(req: import('express').Request) => string} [options.hashFn] - Custom request fingerprint generator.
 * @returns {import('express').RequestHandler}
 */
export function createIdempotencyMiddleware(options = {}) {
  const {
    headerName = 'idempotency-key',
    required = false,
    ttlMs = 86400000,
    lockTimeoutMs = 30000,
    enforceMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    store = new InMemoryIdempotencyStore(),
    hashFn = defaultFingerprint
  } = options;

  const normalizedHeader = headerName.toLowerCase();
  const upperMethods = new Set(enforceMethods.map((m) => m.toUpperCase()));

  return async function idempotencyMiddleware(req, res, next) {
    const method = (req.method || '').toUpperCase();

    // Only apply idempotency to configured mutating HTTP methods
    if (!upperMethods.has(method)) {
      return next();
    }

    const key = req.headers?.[normalizedHeader] || req.headers?.[headerName];

    // Handle missing header
    if (!key) {
      if (required) {
        return next(
          new ValidationError(`Idempotency header '${headerName}' is required for ${method} requests`, {
            statusCode: 400,
            details: { header: headerName, method }
          })
        );
      }
      return next();
    }

    // Validate key format
    if (typeof key !== 'string' || key.trim().length === 0 || key.length > 256) {
      return next(
        new ValidationError(`Idempotency key must be a non-empty string with maximum 256 characters`, {
          statusCode: 400,
          details: { key, length: typeof key === 'string' ? key.length : 0 }
        })
      );
    }

    const trimmedKey = key.trim();
    let fingerprint;
    try {
      fingerprint = hashFn(req);
    } catch (hashErr) {
      return next(
        new ValidationError(`Failed to compute request fingerprint: ${hashErr.message}`, {
          details: { error: hashErr.message }
        })
      );
    }

    try {
      const record = await store.get(trimmedKey);

      if (record) {
        // 1. Check for key reuse with mismatched request payload
        if (record.fingerprint && record.fingerprint !== fingerprint) {
          return next(
            new ValidationError(`Idempotency key '${trimmedKey}' was reused with differing request payload or path`, {
              code: 'IDEMPOTENCY_KEY_REUSE_MISMATCH',
              statusCode: 422,
              details: {
                key: trimmedKey,
                expectedFingerprint: record.fingerprint,
                receivedFingerprint: fingerprint
              }
            })
          );
        }

        // 2. Check for concurrent in-flight request
        if (record.status === 'IN_FLIGHT') {
          const elapsed = Date.now() - (record.createdAt || 0);
          if (elapsed < lockTimeoutMs) {
            res.status(409).json({
              success: false,
              error: {
                code: 'IDEMPOTENCY_CONFLICT',
                message: 'A request with this idempotency key is currently being processed',
                retryAfterMs: Math.max(1000, lockTimeoutMs - elapsed)
              }
            });
            return;
          }
          // If in-flight lock timed out, fall through to reclaim lock
        }

        // 3. Replay completed response
        if (record.status === 'COMPLETED' && record.response) {
          res.setHeader('Idempotent-Replayed', 'true');

          const cachedHeaders = record.response.headers || {};
          for (const [hKey, hVal] of Object.entries(cachedHeaders)) {
            if (hVal !== undefined && !res.hasHeader(hKey)) {
              res.setHeader(hKey, hVal);
            }
          }

          const statusCode = record.response.statusCode || 200;
          res.status(statusCode);

          const body = record.response.body;
          if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
            res.json(body);
          } else {
            res.send(body !== undefined ? body : '');
          }
          return;
        }
      }

      // 4. Acquire in-flight lock
      await store.set(
        trimmedKey,
        {
          status: 'IN_FLIGHT',
          fingerprint,
          createdAt: Date.now()
        },
        lockTimeoutMs
      );

      // 5. Intercept outgoing response
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);
      let capturedBody = null;

      res.json = function interceptedJson(body) {
        capturedBody = body;
        return originalJson(body);
      };

      res.send = function interceptedSend(body) {
        if (capturedBody === null) {
          capturedBody = body;
        }
        return originalSend(body);
      };

      // When the HTTP request finishes
      res.on('finish', async () => {
        try {
          const statusCode = res.statusCode || 200;

          // On 5xx server errors, release the key so client can safely retry
          if (statusCode >= 500) {
            if (typeof store.delete === 'function') {
              await store.delete(trimmedKey);
            }
            return;
          }

          // Gather serializable response headers
          const headersToCache = {};
          if (typeof res.getHeaders === 'function') {
            const currentHeaders = res.getHeaders();
            for (const [k, v] of Object.entries(currentHeaders)) {
              const lower = k.toLowerCase();
              if (lower !== 'idempotent-replayed' && lower !== 'set-cookie') {
                headersToCache[k] = v;
              }
            }
          }

          // Save completed record
          await store.set(
            trimmedKey,
            {
              status: 'COMPLETED',
              fingerprint,
              response: {
                statusCode,
                headers: headersToCache,
                body: capturedBody
              },
              createdAt: Date.now()
            },
            ttlMs
          );
        } catch {
          // Prevent unhandled rejection in finish hook
        }
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Convenience alias for createIdempotencyMiddleware.
 */
export const idempotencyMiddleware = createIdempotencyMiddleware;
