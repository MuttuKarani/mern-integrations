import { rawBodyMiddleware, withRetry } from '../../src/index.js';
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

describe('Core Utilities - Express & Retry', () => {
  describe('rawBodyMiddleware', () => {
    it('should parse JSON body and populate req.rawBody', (done) => {
      const middleware = rawBodyMiddleware();
      const req = new EventEmitter();
      req.headers = { 'content-type': 'application/json' };
      const res = {};

      middleware(req, res, () => {
        expect(req.rawBody).toBeInstanceOf(Buffer);
        expect(JSON.parse(req.rawBody.toString())).toEqual({ test: true });
        expect(req.body).toEqual({ test: true });
        done();
      });

      req.emit('data', Buffer.from(JSON.stringify({ test: true })));
      req.emit('end');
    });

    it('should pass existing rawBody if already attached', (done) => {
      const middleware = rawBodyMiddleware();
      const existingBuffer = Buffer.from('already-attached');
      const req = { rawBody: existingBuffer };
      const res = {};

      middleware(req, res, () => {
        expect(req.rawBody).toBe(existingBuffer);
        done();
      });
    });
  });

  describe('withRetry', () => {
    it('should succeed on first try if function passes', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { retries: 2, minTimeout: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network drop'))
        .mockResolvedValueOnce('recovered');

      const result = await withRetry(fn, { retries: 2, minTimeout: 10 });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after exceeding max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(withRetry(fn, { retries: 2, minTimeout: 10 })).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
