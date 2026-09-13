import crypto from 'crypto';
import { PhonePeProvider } from '../../src/payments/providers/phonepe/PhonePeProvider.js';
import { createPaymentProvider } from '../../src/payments/factories/PaymentFactory.js';
import { PaymentProvider } from '../../src/payments/interfaces/PaymentProvider.js';
import { ValidationError } from '../../src/core/errors/ValidationError.js';
import { IntegrationError } from '../../src/core/errors/IntegrationError.js';

describe('PhonePeProvider & UPI Payment Integration', () => {
  const validConfig = {
    merchantId: 'PGTESTPAYUAT',
    saltKey: '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399',
    saltIndex: '1',
    testMode: true,
    callbackUrl: 'https://example.com/api/webhooks/phonepe'
  };

  describe('Constructor & Credentials Validation', () => {
    it('should throw ValidationError if config is missing or invalid', () => {
      expect(() => new PhonePeProvider(null)).toThrow(ValidationError);
      expect(() => new PhonePeProvider(undefined)).toThrow(ValidationError);
      expect(() => new PhonePeProvider('string')).toThrow(ValidationError);
    });

    it('should throw ValidationError if merchantId or saltKey is missing or empty', () => {
      expect(() => new PhonePeProvider({})).toThrow(ValidationError);
      expect(() => new PhonePeProvider({ merchantId: '', saltKey: 'key' })).toThrow(ValidationError);
      expect(() => new PhonePeProvider({ merchantId: 'M_1', saltKey: '   ' })).toThrow(ValidationError);
    });

    it('should instantiate successfully with valid credentials and inherit PaymentProvider', () => {
      const provider = new PhonePeProvider(validConfig);
      expect(provider).toBeInstanceOf(PaymentProvider);
      expect(provider).toBeInstanceOf(PhonePeProvider);
      expect(provider.name).toBe('phonepe');
      expect(provider.capabilities).toEqual([
        'createOrder',
        'initiatePayment',
        'verifyPayment',
        'verifyCallback',
        'refund',
        'verifyWebhook'
      ]);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should never expose saltKey in Object.keys or JSON.stringify', () => {
      const provider = new PhonePeProvider(validConfig);
      expect(Object.keys(provider)).not.toContain('saltKey');
      expect(JSON.stringify(provider)).not.toContain('099eb0cd-02cf-4e2a-8aca-3e6c6aff0399');
    });
  });

  describe('createOrder() & initiatePayment()', () => {
    it('should validate required amount, currency, and redirectUrl', async () => {
      const provider = new PhonePeProvider(validConfig);
      await expect(provider.createOrder({})).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: -50, redirectUrl: 'http://a.com' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 100, redirectUrl: '' })).rejects.toThrow(ValidationError);
    });

    it('should correctly encode payload, compute X-VERIFY, and return redirect URL', async () => {
      let capturedUrl;
      let capturedHeaders;
      let capturedBody;

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;
        capturedBody = JSON.parse(options.body);

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              code: 'PAYMENT_INITIATED',
              message: 'Payment Initiated',
              data: {
                merchantId: 'PGTESTPAYUAT',
                merchantTransactionId: 'MT_123',
                instrumentResponse: {
                  type: 'PAY_PAGE',
                  redirectInfo: {
                    url: 'https://mercury-uat.phonepe.com/transact/pay?token=sample_token',
                    method: 'GET'
                  }
                }
              }
            })
        };
      };

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.createOrder({
        amount: 50000,
        currency: 'INR',
        merchantTransactionId: 'MT_123',
        redirectUrl: 'https://example.com/checkout/return'
      });

      expect(capturedUrl).toBe('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay');
      expect(capturedHeaders['Content-Type']).toBe('application/json');
      expect(capturedHeaders['X-VERIFY']).toBeDefined();

      // Verify the X-VERIFY hash manually
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${capturedBody.request}/pg/v1/pay${validConfig.saltKey}`)
        .digest('hex');
      expect(capturedHeaders['X-VERIFY']).toBe(`${expectedHash}###1`);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('phonepe');
      expect(result.data.id).toBe('MT_123');
      expect(result.data.amount).toBe(50000);
      expect(result.data.redirectUrl).toBe('https://mercury-uat.phonepe.com/transact/pay?token=sample_token');
    });

    it('initiatePayment should alias createOrder', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            code: 'PAYMENT_INITIATED',
            data: { instrumentResponse: { redirectInfo: { url: 'https://phonepe.com/pay' } } }
          })
      });

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.initiatePayment({
        amount: 20000,
        redirectUrl: 'https://example.com/return'
      });
      expect(result.success).toBe(true);
      expect(result.data.redirectUrl).toBe('https://phonepe.com/pay');
    });
  });

  describe('verifyPayment()', () => {
    it('should validate merchantTransactionId parameter', async () => {
      const provider = new PhonePeProvider(validConfig);
      await expect(provider.verifyPayment({})).rejects.toThrow(ValidationError);
      await expect(provider.verifyPayment({ merchantTransactionId: '' })).rejects.toThrow(ValidationError);
    });

    it('should query PhonePe status check endpoint and verify completed transaction', async () => {
      let capturedUrl;
      let capturedHeaders;

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              code: 'PAYMENT_SUCCESS',
              message: 'Payment Successful',
              data: {
                merchantId: 'PGTESTPAYUAT',
                merchantTransactionId: 'MT_123',
                transactionId: 'T260913000001',
                amount: 50000,
                state: 'COMPLETED',
                responseCode: 'SUCCESS',
                paymentInstrument: { type: 'UPI' }
              }
            })
        };
      };

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyPayment({ merchantTransactionId: 'MT_123' });

      expect(capturedUrl).toBe('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/PGTESTPAYUAT/MT_123');
      expect(capturedHeaders['X-MERCHANT-ID']).toBe('PGTESTPAYUAT');

      const expectedHash = crypto
        .createHash('sha256')
        .update(`/pg/v1/status/PGTESTPAYUAT/MT_123${validConfig.saltKey}`)
        .digest('hex');
      expect(capturedHeaders['X-VERIFY']).toBe(`${expectedHash}###1`);

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.status).toBe('succeeded');
      expect(result.data.transactionId).toBe('T260913000001');
    });

    it('should mark verified: false when transaction state is FAILED', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            code: 'PAYMENT_ERROR',
            data: {
              merchantTransactionId: 'MT_failed_1',
              state: 'FAILED',
              responseCode: 'PAYMENT_ERROR'
            }
          })
      });

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyPayment({ merchantTransactionId: 'MT_failed_1' });

      expect(result.data.verified).toBe(false);
      expect(result.data.status).toBe('failed');
    });
  });

  describe('verifyCallback()', () => {
    it('should decode base64 response and verify signature if provided', async () => {
      const provider = new PhonePeProvider(validConfig);
      const callbackObj = {
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'MT_cb_123',
          transactionId: 'TXN_cb_123',
          amount: 25000,
          state: 'COMPLETED'
        }
      };

      const base64Response = Buffer.from(JSON.stringify(callbackObj)).toString('base64');
      const hash = crypto
        .createHash('sha256')
        .update(`${base64Response}${validConfig.saltKey}`)
        .digest('hex');
      const validSignature = `${hash}###1`;

      const result = await provider.verifyCallback({
        response: base64Response,
        signature: validSignature
      });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.transactionId).toBe('TXN_cb_123');

      // Invalid signature rejection
      await expect(
        provider.verifyCallback({
          response: base64Response,
          signature: 'invalid_signature_hash###1'
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('refund()', () => {
    it('should validate refund parameters', async () => {
      const provider = new PhonePeProvider(validConfig);
      await expect(provider.refund({})).rejects.toThrow(ValidationError);
      await expect(provider.refund({ merchantTransactionId: 'R1', originalTransactionId: '' })).rejects.toThrow(ValidationError);
      await expect(provider.refund({ merchantTransactionId: 'R1', originalTransactionId: 'T1', amount: -1 })).rejects.toThrow(ValidationError);
    });

    it('should call PhonePe refund endpoint with X-VERIFY and return status', async () => {
      let capturedUrl;
      let capturedHeaders;

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              code: 'PAYMENT_SUCCESS',
              data: {
                merchantId: 'PGTESTPAYUAT',
                merchantTransactionId: 'RFND_123',
                transactionId: 'T_refund_1',
                amount: 10000,
                state: 'COMPLETED'
              }
            })
        };
      };

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.refund({
        merchantTransactionId: 'RFND_123',
        originalTransactionId: 'MT_orig_123',
        amount: 10000
      });

      expect(capturedUrl).toBe('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/refund');
      expect(capturedHeaders['X-VERIFY']).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('COMPLETED');
    });
  });

  describe('verifyWebhook()', () => {
    it('should verify webhook payload signature using SHA-256 and timingSafeEqual', async () => {
      const provider = new PhonePeProvider(validConfig);
      const rawBody = JSON.stringify({
        response: Buffer.from(JSON.stringify({ event: 'payment.success', data: { id: '123' } })).toString('base64')
      });

      const parsed = JSON.parse(rawBody);
      const hash = crypto
        .createHash('sha256')
        .update(`${parsed.response}${validConfig.saltKey}`)
        .digest('hex');
      const validSignature = `${hash}###1`;

      const result = await provider.verifyWebhook({
        payload: rawBody,
        signature: validSignature
      });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.event).toBeDefined();

      const invalidResult = await provider.verifyWebhook({
        payload: rawBody,
        signature: 'invalid_sha256###1'
      });
      expect(invalidResult.data.verified).toBe(false);
    });
  });

  describe('Error Handling & HTTP status code mapping', () => {
    it('should map 401 error to AUTHENTICATION_ERROR', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key' })
      });

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.verifyPayment({ merchantTransactionId: 'MT_1' })).rejects.toMatchObject({
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401
      });
    });

    it('should map network error to NETWORK_ERROR with 502 status', async () => {
      const mockFetch = async () => {
        throw new Error('Socket hang up');
      };

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.verifyPayment({ merchantTransactionId: 'MT_1' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 502
      });
    });

    it('should handle non-JSON error responses from PhonePe', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Gateway Error'
      });

      const provider = new PhonePeProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.verifyPayment({ merchantTransactionId: 'MT_1' })).rejects.toMatchObject({
        code: 'PROVIDER_ERROR',
        statusCode: 500,
        message: expect.stringContaining('Internal Gateway Error')
      });
    });

    it('should support custom baseUrl in constructor', async () => {
      let capturedUrl;
      const mockFetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, code: 'PAYMENT_SUCCESS', data: { state: 'COMPLETED' } })
        };
      };

      const provider = new PhonePeProvider({ ...validConfig, baseUrl: 'https://custom.phonepe.proxy/', fetch: mockFetch });
      await provider.verifyPayment({ merchantTransactionId: 'MT_custom' });
      expect(capturedUrl).toContain('https://custom.phonepe.proxy/pg/v1/status');
    });

    it('should throw ValidationError if verifyCallback receives invalid non-JSON base64', async () => {
      const provider = new PhonePeProvider(validConfig);
      const invalidBase64 = Buffer.from('not-json-content').toString('base64');
      await expect(provider.verifyCallback({ response: invalidBase64 })).rejects.toThrow(ValidationError);
    });

    it('should support Buffer and object payloads in verifyWebhook and reject invalid types', async () => {
      const provider = new PhonePeProvider(validConfig);
      const rawData = JSON.stringify({ event: 'PAYMENT_SUCCESS', transactionId: 'TX_1' });
      const base64Data = Buffer.from(rawData).toString('base64');
      const crypto = await import('crypto');
      const signature = crypto.createHash('sha256').update(`${base64Data}${validConfig.saltKey}`).digest('hex') + '###1';

      // Buffer payload
      const bufferPayload = Buffer.from(JSON.stringify({ response: base64Data }));
      const bufResult = await provider.verifyWebhook({ payload: bufferPayload, signature });
      expect(bufResult.data.verified).toBe(true);

      // Object payload
      const objResult = await provider.verifyWebhook({ payload: { response: base64Data }, signature });
      expect(objResult.data.verified).toBe(true);

      // Invalid payload type
      await expect(provider.verifyWebhook({ payload: 12345, signature })).rejects.toThrow(ValidationError);
    });
  });

  describe('PaymentFactory for PhonePe', () => {
    it('should create PhonePeProvider when provider is "phonepe"', () => {
      const instance = createPaymentProvider({
        provider: 'phonepe',
        merchantId: 'PG_123',
        saltKey: 'salt_123'
      });
      expect(instance).toBeInstanceOf(PhonePeProvider);
      expect(instance.name).toBe('phonepe');
    });

    it('should match "PHONEPE" case-insensitively with whitespace trimming', () => {
      const instance = createPaymentProvider({
        provider: '  PHONEPE  ',
        merchantId: 'PG_123',
        saltKey: 'salt_123'
      });
      expect(instance).toBeInstanceOf(PhonePeProvider);
    });
  });
});
