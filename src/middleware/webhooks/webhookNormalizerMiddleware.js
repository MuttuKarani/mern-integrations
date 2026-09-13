import { ValidationError } from '../../core/errors/ValidationError.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { normalizeWebhookEvent } from './normalizeWebhookEvent.js';

/**
 * Default signature header names for supported providers.
 */
const DEFAULT_SIGNATURE_HEADERS = {
  stripe: 'stripe-signature',
  razorpay: 'x-razorpay-signature',
  phonepe: 'x-verify',
  twilio: 'x-twilio-signature'
};

/**
 * Creates an Express middleware to verify and normalize incoming webhook requests.
 *
 * @param {Object} [options]
 * @param {string|((req: import('express').Request) => string)} [options.provider] - Provider name or dynamic resolver.
 * @param {Object|((req: import('express').Request, providerName: string) => Promise<any>|any)} [options.getProvider] - Provider instance or factory.
 * @param {boolean} [options.verifySignature=true] - Whether to verify cryptographic signature if provider instance is available.
 * @param {string} [options.signatureHeader] - Explicit signature header to read (overrides provider default).
 * @param {(err: Error, req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void} [options.onVerificationError] - Custom error handler.
 * @returns {import('express').RequestHandler}
 */
export function createWebhookNormalizer(options = {}) {
  const {
    provider,
    getProvider,
    verifySignature = true,
    signatureHeader,
    onVerificationError
  } = options;

  return async function webhookNormalizerMiddleware(req, res, next) {
    let providerName = '';

    if (typeof provider === 'function') {
      providerName = provider(req);
    } else if (typeof provider === 'string') {
      providerName = provider;
    } else {
      providerName = req.params?.provider || req.headers?.['x-provider'] || '';
    }

    if (!providerName || typeof providerName !== 'string') {
      return next(
        new ValidationError('Webhook provider could not be determined. Specify provider in options, route param, or x-provider header.', {
          details: { provider: providerName }
        })
      );
    }

    const normProvider = providerName.trim().toLowerCase();
    let verifiedPayload = req.body;

    // Signature verification if requested
    if (verifySignature && getProvider) {
      let providerInstance = null;
      try {
        providerInstance = typeof getProvider === 'function'
          ? await getProvider(req, normProvider)
          : getProvider?.[normProvider] || getProvider;
      } catch (provErr) {
        return next(provErr);
      }

      if (providerInstance && typeof providerInstance.verifyWebhook === 'function') {
        const headerKey =
          signatureHeader ||
          DEFAULT_SIGNATURE_HEADERS[normProvider] ||
          'x-signature';

        const signature =
          req.headers?.[headerKey.toLowerCase()] ||
          req.headers?.[headerKey] ||
          '';

        const payload = req.rawBody || req.body;

        try {
          const verificationResult = await providerInstance.verifyWebhook({
            payload,
            signature,
            url: `https://${req.headers.host || 'localhost'}${req.originalUrl || req.url}`,
            params: req.body
          });

          if (!verificationResult || verificationResult.data?.verified === false) {
            const verifyError = new IntegrationError(
              `Invalid webhook signature for provider '${normProvider}'`,
              {
                code: 'INVALID_WEBHOOK_SIGNATURE',
                statusCode: 400,
                provider: normProvider
              }
            );

            if (typeof onVerificationError === 'function') {
              return onVerificationError(verifyError, req, res, next);
            }

            res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_WEBHOOK_SIGNATURE',
                message: verifyError.message
              }
            });
            return;
          }

          // Use the verified/decoded event payload if provided by the provider
          if (verificationResult.data?.event) {
            verifiedPayload = verificationResult.data.event;
          }
        } catch (verr) {
          if (typeof onVerificationError === 'function') {
            return onVerificationError(verr, req, res, next);
          }
          res.status(400).json({
            success: false,
            error: {
              code: verr.code || 'WEBHOOK_VERIFICATION_FAILED',
              message: verr.message
            }
          });
          return;
        }
      }
    }

    try {
      const unifiedEvent = normalizeWebhookEvent(normProvider, verifiedPayload || req.body);
      req.webhookEvent = unifiedEvent;
      next();
    } catch (normErr) {
      next(normErr);
    }
  };
}

/**
 * Convenience alias for createWebhookNormalizer.
 */
export const webhookNormalizerMiddleware = createWebhookNormalizer;
