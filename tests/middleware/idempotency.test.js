import {
  InMemoryIdempotencyStore,
  createIdempotencyMiddleware,
  idempotencyMiddleware
} from '../../src/middleware/index.js';
import { ValidationError } from '../../src/core/errors/ValidationError.js';
import { EventEmitter } from 'node:events';

describe('Enterprise Middleware: Idempotency Key Middleware', () => {
  describe('InMemoryIdempotencyStore', () => {
    let store;

    beforeEach(() => {
      store = new InMemoryIdempotencyStore({ maxEntries: 3, cleanupIntervalMs: 0 });
    });

    afterEach(() => {
      store.destroy();
    });

    it('should store, retrieve, and delete records', async () => {
      expect(await store.get('k1')).toBeNull();

      await store.set('k1', { status: 'COMPLETED', fingerprint: 'fp1', response: { body: 'ok' } }, 5000);
      const record = await store.get('k1');
      expect(record).toBeDefined();
      expect(record.status).toBe('COMPLETED');
      expect(record.fingerprint).toBe('fp1');
      expect(store.size).toBe(1);

      const deleted = await store.delete('k1');
      expect(deleted).toBe(true);
      expect(await store.get('k1')).toBeNull();
      expect(store.size).toBe(0);
    });

    it('should evict oldest entry when maxEntries is exceeded (LRU behavior)', async () => {
      await store.set('k1', { data: 1 }, 10000);
      await store.set('k2', { data: 2 }, 10000);
      await store.set('k3', { data: 3 }, 10000);
      expect(store.size).toBe(3);

      // Access k1 so k2 becomes the oldest entry
      await store.get('k1');

      // Add k4 -> should evict k2
      await store.set('k4', { data: 4 }, 10000);
      expect(store.size).toBe(3);
      expect(await store.get('k2')).toBeNull();
      expect(await store.get('k1')).not.toBeNull();
      expect(await store.get('k3')).not.toBeNull();
      expect(await store.get('k4')).not.toBeNull();
    });

    it('should expire keys based on TTL and cleanup expired keys', async () => {
      await store.set('short', { data: 'temp' }, 10);
      await store.set('long', { data: 'persist' }, 50000);

      // Wait for short TTL to expire
      await new Promise((r) => setTimeout(r, 25));

      expect(await store.get('short')).toBeNull();
      expect(await store.get('long')).not.toBeNull();

      const cleaned = store.cleanup();
      expect(cleaned).toBe(0); // already removed on get
    });

    it('should clear all entries', async () => {
      await store.set('a', { data: 1 }, 10000);
      await store.set('b', { data: 2 }, 10000);
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
      expect(await store.get('a')).toBeNull();
    });

    it('should handle invalid keys gracefully', async () => {
      expect(await store.get(null)).toBeNull();
      expect(await store.get('')).toBeNull();
      await store.set(null, {});
      expect(store.size).toBe(0);
    });
  });

  describe('idempotencyMiddleware() HTTP Processing', () => {
    /**
     * Helper to simulate Express req, res, next.
     */
    function createMockHttp({ method = 'POST', path = '/api/orders', headers = {}, body = { amount: 100 } } = {}) {
      const req = {
        method,
        path,
        url: path,
        baseUrl: '',
        headers: { ...headers },
        body
      };

      const res = new EventEmitter();
      res.statusCode = 200;
      res._headers = {};
      res._body = null;
      res._jsonSent = false;
      res.headersSent = false;

      res.setHeader = function (name, value) {
        res._headers[name.toLowerCase()] = value;
      };
      res.getHeader = function (name) {
        return res._headers[name.toLowerCase()];
      };
      res.hasHeader = function (name) {
        return name.toLowerCase() in res._headers;
      };
      res.getHeaders = function () {
        return { ...res._headers };
      };
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };
      res.send = function (content) {
        res._body = content;
        res.headersSent = true;
        res.emit('finish');
        return res;
      };
      res.json = function (jsonObj) {
        res._jsonSent = true;
        res._body = jsonObj;
        res.headersSent = true;
        res.emit('finish');
        return res;
      };

      return { req, res };
    }

    it('should skip non-enforced HTTP methods like GET', async () => {
      const middleware = idempotencyMiddleware();
      const { req, res } = createMockHttp({ method: 'GET' });
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should pass through when header is missing and required is false', async () => {
      const middleware = idempotencyMiddleware({ required: false });
      const { req, res } = createMockHttp({ headers: {} });
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should throw ValidationError when header is missing and required is true', async () => {
      const middleware = idempotencyMiddleware({ required: true });
      const { req, res } = createMockHttp({ headers: {} });
      let error = null;

      await middleware(req, res, (err) => {
        error = err;
      });

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('required');
    });

    it('should throw ValidationError if key format is invalid', async () => {
      const middleware = idempotencyMiddleware();
      const { req, res } = createMockHttp({ headers: { 'idempotency-key': '   ' } });
      let error = null;

      await middleware(req, res, (err) => {
        error = err;
      });

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
    });

    it('should execute downstream handler on first request and cache response', async () => {
      const store = new InMemoryIdempotencyStore();
      const middleware = idempotencyMiddleware({ store });
      const { req, res } = createMockHttp({
        headers: { 'idempotency-key': 'order-req-123' },
        body: { item: 'Laptop', price: 999 }
      });

      let routeHandlerExecuted = false;

      await middleware(req, res, () => {
        routeHandlerExecuted = true;
        res.status(201).json({ id: 'ord_1', success: true });
      });

      expect(routeHandlerExecuted).toBe(true);
      expect(res.statusCode).toBe(201);
      expect(res._body).toEqual({ id: 'ord_1', success: true });

      // Check store record
      const record = await store.get('order-req-123');
      expect(record).toBeDefined();
      expect(record.status).toBe('COMPLETED');
      expect(record.response.statusCode).toBe(201);
      expect(record.response.body).toEqual({ id: 'ord_1', success: true });
    });

    it('should replay cached response with Idempotent-Replayed header on duplicate request', async () => {
      const store = new InMemoryIdempotencyStore();
      const middleware = idempotencyMiddleware({ store });
      const key = 'idem_replay_test_1';
      const body = { orderId: 'ord_99', amount: 500 };

      // 1. Initial request
      const first = createMockHttp({ headers: { 'idempotency-key': key }, body });
      await middleware(first.req, first.res, () => {
        first.res.setHeader('content-type', 'application/json');
        first.res.status(200).json({ status: 'PROCESSED', txnId: 'tx_123' });
      });

      expect(first.res._body).toEqual({ status: 'PROCESSED', txnId: 'tx_123' });
      expect(first.res.getHeader('Idempotent-Replayed')).toBeUndefined();

      // 2. Duplicate request with identical key and body
      const second = createMockHttp({ headers: { 'idempotency-key': key }, body });
      let secondRouteExecuted = false;

      await middleware(second.req, second.res, () => {
        secondRouteExecuted = true;
        second.res.status(200).json({ status: 'PROCESSED_AGAIN' });
      });

      // Route handler MUST NOT have been invoked again!
      expect(secondRouteExecuted).toBe(false);
      expect(second.res.statusCode).toBe(200);
      expect(second.res._body).toEqual({ status: 'PROCESSED', txnId: 'tx_123' });
      expect(second.res.getHeader('Idempotent-Replayed')).toBe('true');
    });

    it('should throw ValidationError 422 if key is reused with different request payload', async () => {
      const store = new InMemoryIdempotencyStore();
      const middleware = idempotencyMiddleware({ store });
      const key = 'idem_mismatch_test';

      // 1. First request
      const first = createMockHttp({
        headers: { 'idempotency-key': key },
        body: { amount: 100 }
      });
      await middleware(first.req, first.res, () => {
        first.res.status(200).json({ success: true });
      });

      // 2. Second request with SAME key but DIFFERENT payload
      const second = createMockHttp({
        headers: { 'idempotency-key': key },
        body: { amount: 500 } // modified amount!
      });
      let secondError = null;

      await middleware(second.req, second.res, (err) => {
        secondError = err;
      });

      expect(secondError).toBeInstanceOf(ValidationError);
      expect(secondError.code).toBe('IDEMPOTENCY_KEY_REUSE_MISMATCH');
      expect(secondError.statusCode).toBe(422);
    });

    it('should return 409 Conflict if duplicate request arrives while first is IN_FLIGHT', async () => {
      const store = new InMemoryIdempotencyStore();
      const middleware = idempotencyMiddleware({ store, lockTimeoutMs: 10000 });
      const key = 'idem_inflight_test';
      const body = { charge: 40 };

      // 1. First request starts but does NOT emit finish (in-flight)
      const first = createMockHttp({ headers: { 'idempotency-key': key }, body });
      await middleware(first.req, first.res, () => {
        // Do not complete yet
      });

      // 2. Second concurrent request arrives with same key
      const second = createMockHttp({ headers: { 'idempotency-key': key }, body });
      let secondRouteExecuted = false;

      await middleware(second.req, second.res, () => {
        secondRouteExecuted = true;
      });

      expect(secondRouteExecuted).toBe(false);
      expect(second.res.statusCode).toBe(409);
      expect(second.res._body).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'IDEMPOTENCY_CONFLICT'
          })
        })
      );
    });

    it('should delete key on 5xx server error so client can retry with same key', async () => {
      const store = new InMemoryIdempotencyStore();
      const middleware = idempotencyMiddleware({ store });
      const key = 'idem_500_retry_test';
      const body = { action: 'risky_operation' };

      // First request fails with 500
      const first = createMockHttp({ headers: { 'idempotency-key': key }, body });
      await middleware(first.req, first.res, () => {
        first.res.status(500).send('Internal Database Failure');
      });

      // Key must NOT be cached as completed
      const record = await store.get(key);
      expect(record).toBeNull();

      // Second request with same key can proceed normally
      const second = createMockHttp({ headers: { 'idempotency-key': key }, body });
      let secondExecuted = false;

      await middleware(second.req, second.res, () => {
        secondExecuted = true;
        second.res.status(200).json({ success: true, recovered: true });
      });

      expect(secondExecuted).toBe(true);
      expect(second.res.statusCode).toBe(200);
    });

    it('should support custom storage adapter and custom header name', async () => {
      const customStoreMap = new Map();
      const customStore = {
        get: async (k) => customStoreMap.get(k) || null,
        set: async (k, rec) => customStoreMap.set(k, rec),
        delete: async (k) => customStoreMap.delete(k)
      };

      const middleware = createIdempotencyMiddleware({
        headerName: 'X-Custom-Idempotency',
        store: customStore
      });

      const { req, res } = createMockHttp({
        headers: { 'x-custom-idempotency': 'cust_123' },
        body: { test: true }
      });

      await middleware(req, res, () => {
        res.status(200).send('Custom Store Output');
      });

      expect(customStoreMap.has('cust_123')).toBe(true);
      expect(customStoreMap.get('cust_123').status).toBe('COMPLETED');
    });
  });
});
