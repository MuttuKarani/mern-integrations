import crypto from 'node:crypto';
import { CashfreeProvider } from '../../src/payments/providers/cashfree/CashfreeProvider.js';
import { createPaymentProvider } from '../../src/payments/factories/PaymentFactory.js';
import { PaymentProvider } from '../../src/payments/interfaces/PaymentProvider.js';
import { ValidationError } from '../../src/core/errors/ValidationError.js';
import { IntegrationError } from '../../src/core/errors/IntegrationError.js';

describe('CashfreeProvider & PG API Integration', () => {
  const validConfig = {
    appId: 'CFTEST_APP_12345',
    secretKey: 'cfsk_test_secret_67890abcdef',
    apiVersion: '2023-08-01',
    testMode: true
  };

  describe('Constructor & Credentials Validation', () => {
    it('should throw ValidationError if config is missing or invalid', () => {
      expect(() => new CashfreeProvider(null)).toThrow(ValidationError);
      expect(() => new CashfreeProvider(undefined)).toThrow(ValidationError);
      expect(() => new CashfreeProvider('invalid')).toThrow(ValidationError);
    });

    it('should throw ValidationError if appId or secretKey is missing or empty', () => {
      expect(() => new CashfreeProvider({})).toThrow(ValidationError);
      expect(() => new CashfreeProvider({ appId: '   ', secretKey: 'secret' })).toThrow(ValidationError);
      expect(() => new CashfreeProvider({ appId: 'appId', secretKey: '' })).toThrow(ValidationError);
    });

    it('should instantiate successfully with valid credentials and inherit PaymentProvider', () => {
      const provider = new CashfreeProvider(validConfig);
      expect(provider).toBeInstanceOf(PaymentProvider);
      expect(provider).toBeInstanceOf(CashfreeProvider);
      expect(provider.name).toBe('cashfree');
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

    it('should support clientId and clientSecret aliases', () => {
      const provider = new CashfreeProvider({
        clientId: 'CF_ALIAS_ID',
        clientSecret: 'CF_ALIAS_SECRET'
      });
      expect(provider).toBeInstanceOf(CashfreeProvider);
    });

    it('should never expose secretKey in Object.keys or JSON.stringify', () => {
      const provider = new CashfreeProvider(validConfig);
      expect(Object.keys(provider)).not.toContain('secretKey');
      expect(JSON.stringify(provider)).not.toContain('cfsk_test_secret_67890abcdef');
    });

    it('should use sandbox URL when testMode is true and production URL when false', () => {
      const sandboxProvider = new CashfreeProvider({ ...validConfig, testMode: true });
      const prodProvider = new CashfreeProvider({ ...validConfig, testMode: false });
      expect(sandboxProvider.testMode).toBe(true);
      expect(sandboxProvider.baseUrl).toBe('https://sandbox.cashfree.com/pg');
      expect(prodProvider.testMode).toBe(false);
      expect(prodProvider.baseUrl).toBe('https://api.cashfree.com/pg');
    });

    it('should automatically detect sandbox mode when test keys or env: "SANDBOX" are provided', () => {
      const autoProvider = new CashfreeProvider({
        appId: 'TEST12345678',
        secretKey: 'cfsk_ma_test_secret123'
      });
      expect(autoProvider.testMode).toBe(true);
      expect(autoProvider.baseUrl).toBe('https://sandbox.cashfree.com/pg');

      const envProvider = new CashfreeProvider({
        appId: 'PROD_APP_ID',
        secretKey: 'prod_secret_key',
        env: 'SANDBOX'
      });
      expect(envProvider.testMode).toBe(true);
      expect(envProvider.baseUrl).toBe('https://sandbox.cashfree.com/pg');
    });
  });

  describe('createOrder() & initiatePayment()', () => {
    it('should validate required amount and currency', async () => {
      const provider = new CashfreeProvider(validConfig);
      await expect(provider.createOrder({})).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: -500 })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 50000, currency: '' })).rejects.toThrow(ValidationError);
    });

    it('should send correct headers, convert amount to rupees, and return payment_session_id', async () => {
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
              cf_order_id: '10987654',
              order_id: capturedBody.order_id,
              entity: 'order',
              order_currency: 'INR',
              order_amount: 500.0,
              order_status: 'ACTIVE',
              payment_session_id: 'session_cf_test_mock_12345',
              order_expiry_time: '2026-10-09T00:00:00Z'
            })
        };
      };

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.createOrder({
        orderId: 'my_test_order_101',
        amount: 50000, // 500 INR in paise
        currency: 'INR',
        customer: {
          id: 'cust_001',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '9876543210'
        },
        returnUrl: 'https://example.com/checkout/return'
      });

      expect(capturedUrl).toBe('https://sandbox.cashfree.com/pg/orders');
      expect(capturedHeaders['x-client-id']).toBe('CFTEST_APP_12345');
      expect(capturedHeaders['x-client-secret']).toBe('cfsk_test_secret_67890abcdef');
      expect(capturedHeaders['x-api-version']).toBe('2023-08-01');
      expect(capturedBody.order_amount).toBe(500);
      expect(capturedBody.customer_details.customer_email).toBe('jane@example.com');
      expect(capturedBody.order_meta.return_url).toBe('https://example.com/checkout/return');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('cashfree');
      expect(result.data.orderId).toBe('my_test_order_101');
      expect(result.data.paymentSessionId).toBe('session_cf_test_mock_12345');
      expect(result.data.status).toBe('ACTIVE');
      expect(result.data.amount).toBe(50000);
    });

    it('should generate fallback orderId and customer details if not supplied', async () => {
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              cf_order_id: '999',
              order_id: capturedBody.order_id,
              order_amount: 10.0,
              order_currency: 'INR',
              order_status: 'ACTIVE',
              payment_session_id: 'session_generated'
            })
        };
      };

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.initiatePayment({ amount: 1000 }); // ₹10

      expect(capturedBody.order_id).toBeDefined();
      expect(capturedBody.customer_details.customer_id).toBeDefined();
      expect(result.data.orderAmount).toBe(10);
      expect(result.data.paymentSessionId).toBe('session_generated');
    });
  });

  describe('verifyPayment() & verifyCallback()', () => {
    it('should validate required orderId', async () => {
      const provider = new CashfreeProvider(validConfig);
      await expect(provider.verifyPayment({})).rejects.toThrow(ValidationError);
      await expect(provider.verifyPayment({ orderId: '   ' })).rejects.toThrow(ValidationError);
    });

    it('should verify PAID order and retrieve payment information', async () => {
      const mockFetch = async (url) => {
        if (url.endsWith('/payments')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify([
                {
                  cf_payment_id: 'cf_pay_98765',
                  order_id: 'order_verified_1',
                  payment_status: 'SUCCESS',
                  payment_amount: 500.0,
                  payment_currency: 'INR'
                }
              ])
          };
        }

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              cf_order_id: 'cf_ord_888',
              order_id: 'order_verified_1',
              order_amount: 500.0,
              order_currency: 'INR',
              order_status: 'PAID'
            })
        };
      };

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyPayment({ orderId: 'order_verified_1' });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.orderId).toBe('order_verified_1');
      expect(result.data.paymentId).toBe('cf_pay_98765');
      expect(result.data.status).toBe('succeeded');
      expect(result.data.amount).toBe(50000);
    });

    it('should return verified: false for unpaid or active orders', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            cf_order_id: 'cf_ord_777',
            order_id: 'order_active_1',
            order_amount: 500.0,
            order_currency: 'INR',
            order_status: 'ACTIVE'
          })
      });

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyCallback({ orderId: 'order_active_1' });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(false);
      expect(result.data.status).toBe('active');
    });
  });

  describe('verifyWebhook()', () => {
    const rawPayload = JSON.stringify({
      data: {
        order: {
          order_id: 'order_hook_123',
          order_amount: 500.0,
          order_currency: 'INR'
        },
        payment: {
          cf_payment_id: 'cf_pay_hook_456',
          payment_status: 'SUCCESS',
          payment_amount: 500.0
        }
      },
      event_time: '2026-10-08T20:00:00Z',
      type: 'PAYMENT_SUCCESS_WEBHOOK'
    });

    const timestamp = '1728417600';

    const generateSignature = (data, secret) => {
      return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64');
    };

    it('should validate required payload, signature, and timestamp', async () => {
      const provider = new CashfreeProvider(validConfig);
      await expect(provider.verifyWebhook({})).rejects.toThrow(ValidationError);
      await expect(
        provider.verifyWebhook({ payload: rawPayload, signature: 'sig' })
      ).rejects.toThrow(ValidationError);
    });

    it('should successfully verify a valid Cashfree webhook signature', async () => {
      const validSig = generateSignature(`${timestamp}${rawPayload}`, validConfig.secretKey);
      const provider = new CashfreeProvider(validConfig);

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: validSig,
        timestamp
      });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
    });

    it('should return verified: false when signature or timestamp is modified', async () => {
      const validSig = generateSignature(`${timestamp}${rawPayload}`, validConfig.secretKey);
      const provider = new CashfreeProvider(validConfig);

      const resultWithWrongTimestamp = await provider.verifyWebhook({
        payload: rawPayload,
        signature: validSig,
        timestamp: '1728417601' // tampered
      });

      expect(resultWithWrongTimestamp.data.verified).toBe(false);

      const resultWithWrongPayload = await provider.verifyWebhook({
        payload: '{"tampered": true}',
        signature: validSig,
        timestamp
      });

      expect(resultWithWrongPayload.data.verified).toBe(false);
    });
  });

  describe('refund()', () => {
    it('should validate required orderId and amount', async () => {
      const provider = new CashfreeProvider(validConfig);
      await expect(provider.refund({})).rejects.toThrow(ValidationError);
      await expect(provider.refund({ orderId: 'ord_1', amount: 0 })).rejects.toThrow(ValidationError);
    });

    it('should format refund payload and return normalized refund data', async () => {
      let capturedBody;
      let capturedUrl;

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              cf_refund_id: 'cf_rfnd_999',
              refund_id: capturedBody.refund_id,
              order_id: 'ord_ref_1',
              refund_amount: 250.0,
              refund_currency: 'INR',
              refund_status: 'SUCCESS',
              refund_speed: 'STANDARD'
            })
        };
      };

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.refund({
        orderId: 'ord_ref_1',
        amount: 25000, // ₹250
        refundId: 'rfnd_custom_1',
        note: 'Customer requested refund'
      });

      expect(capturedUrl).toContain('/orders/ord_ref_1/refunds');
      expect(capturedBody.refund_amount).toBe(250);
      expect(capturedBody.refund_id).toBe('rfnd_custom_1');
      expect(result.success).toBe(true);
      expect(result.data.refundAmount).toBe(250);
      expect(result.data.status).toBe('SUCCESS');
    });
  });

  describe('Factory integration via createPaymentProvider()', () => {
    it('should instantiate CashfreeProvider when provider is "cashfree"', () => {
      const provider = createPaymentProvider({
        provider: 'cashfree',
        ...validConfig
      });
      expect(provider).toBeInstanceOf(CashfreeProvider);
      expect(provider.name).toBe('cashfree');
    });

    it('should be case-insensitive for provider name', () => {
      const provider = createPaymentProvider({
        provider: '  CASHFREE  ',
        ...validConfig
      });
      expect(provider).toBeInstanceOf(CashfreeProvider);
    });
  });

  describe('Error Handling & Security', () => {
    it('should convert API errors into IntegrationError and redact secrets', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            message: `Invalid request with secret ${validConfig.secretKey}`,
            code: 'BAD_REQUEST',
            type: 'invalid_request_error'
          })
      });

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.createOrder({ amount: 1000 })).rejects.toThrow(IntegrationError);

      try {
        await provider.createOrder({ amount: 1000 });
      } catch (err) {
        expect(err.message).not.toContain(validConfig.secretKey);
        expect(err.message).toContain('[REDACTED]');
      }
    });

    it('should convert network exceptions into IntegrationError', async () => {
      const mockFetch = async () => {
        throw new Error('Connection reset by peer');
      };

      const provider = new CashfreeProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.createOrder({ amount: 1000 })).rejects.toThrow(IntegrationError);
    });
  });
});
