import crypto from 'node:crypto';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createPaymentProvider,
  PaymentProvider,
  RazorpayProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('RazorpayProvider & Payment Architecture', () => {
  const mockKeyId = 'rzp_test_mockKeyId123';
  const mockKeySecret = 'mockSecretKey456';
  const mockWebhookSecret = 'mockWebhookSecret789';

  let mockClient;
  let provider;

  beforeEach(() => {
    mockClient = {
      orders: {
        create: jest.fn()
      },
      payments: {
        refund: jest.fn()
      }
    };

    provider = new RazorpayProvider({
      keyId: mockKeyId,
      keySecret: mockKeySecret,
      webhookSecret: mockWebhookSecret,
      client: mockClient
    });
  });

  describe('Abstract PaymentProvider Base Class', () => {
    test('should prevent direct instantiation of PaymentProvider', () => {
      expect(() => new PaymentProvider('test')).toThrow(IntegrationError);
      expect(() => new PaymentProvider('test')).toThrow('abstract class');
    });

    test('unimplemented subclass methods should throw IntegrationError', async () => {
      class UnimplementedProvider extends PaymentProvider {
        constructor() {
          super('dummy');
        }
      }

      const dummy = new UnimplementedProvider();
      await expect(dummy.createOrder({})).rejects.toThrow(IntegrationError);
      await expect(dummy.verifyPayment({})).rejects.toThrow(IntegrationError);
      await expect(dummy.refund({})).rejects.toThrow(IntegrationError);
      await expect(dummy.verifyWebhook({})).rejects.toThrow(IntegrationError);
    });
  });

  describe('PaymentFactory', () => {
    test('should create RazorpayProvider when provider is "razorpay"', () => {
      const p = createPaymentProvider({
        provider: 'razorpay',
        keyId: mockKeyId,
        keySecret: mockKeySecret
      });

      expect(p).toBeInstanceOf(RazorpayProvider);
      expect(p.name).toBe('razorpay');
    });

    test('should reject unsupported providers with IntegrationError', () => {
      expect(() =>
        createPaymentProvider({
          provider: 'unsupported_gateway',
          keyId: 'abc',
          keySecret: 'def'
        })
      ).toThrow(IntegrationError);

      try {
        createPaymentProvider({ provider: 'stripe' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }
    });

    test('should throw ValidationError if config or provider is missing', () => {
      expect(() => createPaymentProvider(null)).toThrow(ValidationError);
      expect(() => createPaymentProvider({})).toThrow(ValidationError);
      expect(() => createPaymentProvider({ provider: '' })).toThrow(ValidationError);
    });
  });

  describe('RazorpayProvider Constructor & Credentials Validation', () => {
    test('should throw ValidationError if keyId is missing or empty', () => {
      expect(() => new RazorpayProvider({ keyId: '', keySecret: mockKeySecret })).toThrow(
        ValidationError
      );
      expect(() => new RazorpayProvider({ keySecret: mockKeySecret })).toThrow(ValidationError);
    });

    test('should throw ValidationError if keySecret is missing or empty', () => {
      expect(() => new RazorpayProvider({ keyId: mockKeyId, keySecret: '' })).toThrow(
        ValidationError
      );
      expect(() => new RazorpayProvider({ keyId: mockKeyId })).toThrow(ValidationError);
    });

    test('should throw ValidationError if webhookSecret is provided but empty string', () => {
      expect(
        () =>
          new RazorpayProvider({
            keyId: mockKeyId,
            keySecret: mockKeySecret,
            webhookSecret: '   '
          })
      ).toThrow(ValidationError);
    });
  });

  describe('createOrder', () => {
    test('should validate that amount is a positive integer in smallest currency units', async () => {
      // Missing amount
      await expect(provider.createOrder({ currency: 'INR' })).rejects.toThrow(ValidationError);

      // Negative or zero amount
      await expect(provider.createOrder({ amount: 0, currency: 'INR' })).rejects.toThrow(
        ValidationError
      );
      await expect(provider.createOrder({ amount: -100, currency: 'INR' })).rejects.toThrow(
        ValidationError
      );

      // Floating / decimal numbers (e.g. ₹10.50 instead of 1050 paise)
      await expect(provider.createOrder({ amount: 10.5, currency: 'INR' })).rejects.toThrow(
        ValidationError
      );

      // Non-number amount
      await expect(provider.createOrder({ amount: '1000', currency: 'INR' })).rejects.toThrow(
        ValidationError
      );
    });

    test('should validate that currency is a non-empty string', async () => {
      await expect(provider.createOrder({ amount: 1000 })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 1000, currency: '' })).rejects.toThrow(
        ValidationError
      );
    });

    test('should validate receipt if provided', async () => {
      await expect(
        provider.createOrder({ amount: 1000, currency: 'INR', receipt: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully create an order and return normalized response with mock SDK', async () => {
      const mockOrderResponse = {
        id: 'order_EKwxwAgItmmXdp',
        entity: 'order',
        amount: 1000,
        amount_paid: 0,
        amount_due: 1000,
        currency: 'INR',
        receipt: 'receipt_test_1',
        status: 'created',
        attempts: 0,
        notes: { plan: 'pro' },
        created_at: 1672531199
      };

      mockClient.orders.create.mockResolvedValueOnce(mockOrderResponse);

      const result = await provider.createOrder({
        amount: 1000,
        currency: 'INR',
        receipt: 'receipt_test_1',
        notes: { plan: 'pro' }
      });

      expect(mockClient.orders.create).toHaveBeenCalledTimes(1);
      expect(mockClient.orders.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'INR',
        receipt: 'receipt_test_1',
        notes: { plan: 'pro' }
      });

      expect(result).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          id: 'order_EKwxwAgItmmXdp',
          entity: 'order',
          amount: 1000,
          amountPaid: 0,
          amountDue: 1000,
          currency: 'INR',
          receipt: 'receipt_test_1',
          status: 'created',
          attempts: 0,
          notes: { plan: 'pro' },
          createdAt: 1672531199,
          raw: mockOrderResponse
        }
      });
    });

    test('should convert Razorpay SDK error into IntegrationError', async () => {
      mockClient.orders.create.mockRejectedValue({
        statusCode: 400,
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Currency is not supported',
          field: 'currency'
        }
      });

      try {
        await provider.createOrder({ amount: 1000, currency: 'INVALID' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationError);
        expect(error.code).toBe('BAD_REQUEST_ERROR');
        expect(error.message).toBe('Currency is not supported');
        expect(error.statusCode).toBe(400);
        expect(error.provider).toBe('razorpay');
        expect(error.details).toEqual({ field: 'currency' });
      }
    });
  });

  describe('verifyPayment', () => {
    test('should throw ValidationError if verification parameters are missing', async () => {
      await expect(
        provider.verifyPayment({ razorpayOrderId: 'order_123', razorpayPaymentId: 'pay_123' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.verifyPayment({ razorpayOrderId: 'order_123', razorpaySignature: 'sig_123' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.verifyPayment({ razorpayPaymentId: 'pay_123', razorpaySignature: 'sig_123' })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully verify valid payment signature', async () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29AeHIbxDuFam1';
      const validSignature = crypto
        .createHmac('sha256', mockKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const response = await provider.verifyPayment({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature
      });

      expect(response).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          verified: true,
          orderId,
          paymentId
        }
      });
    });

    test('should return verified: false for invalid or tampered payment signature', async () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29AeHIbxDuFam1';
      const invalidSignature = 'tampered_or_invalid_signature_hex';

      const response = await provider.verifyPayment({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: invalidSignature
      });

      expect(response).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          verified: false,
          orderId,
          paymentId
        }
      });
    });
  });

  describe('refund', () => {
    test('should throw ValidationError if paymentId is missing', async () => {
      await expect(provider.refund({})).rejects.toThrow(ValidationError);
      await expect(provider.refund({ paymentId: '' })).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError if refund amount is invalid', async () => {
      await expect(
        provider.refund({ paymentId: 'pay_123', amount: -50 })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.refund({ paymentId: 'pay_123', amount: 5.5 })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully process a refund with mock SDK', async () => {
      const mockRefundResponse = {
        id: 'rfnd_D8bY93yXmZq12',
        entity: 'refund',
        amount: 500,
        currency: 'INR',
        payment_id: 'pay_29AeHIbxDuFam1',
        status: 'processed',
        receipt: 'rfnd_rcpt_1',
        notes: { reason: 'customer_request' },
        created_at: 1672532000
      };

      mockClient.payments.refund.mockResolvedValueOnce(mockRefundResponse);

      const result = await provider.refund({
        paymentId: 'pay_29AeHIbxDuFam1',
        amount: 500,
        notes: { reason: 'customer_request' }
      });

      expect(mockClient.payments.refund).toHaveBeenCalledWith('pay_29AeHIbxDuFam1', {
        amount: 500,
        notes: { reason: 'customer_request' }
      });

      expect(result).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          id: 'rfnd_D8bY93yXmZq12',
          entity: 'refund',
          amount: 500,
          currency: 'INR',
          paymentId: 'pay_29AeHIbxDuFam1',
          status: 'processed',
          receipt: 'rfnd_rcpt_1',
          notes: { reason: 'customer_request' },
          createdAt: 1672532000,
          raw: mockRefundResponse
        }
      });
    });

    test('should convert Razorpay refund SDK error into IntegrationError', async () => {
      mockClient.payments.refund.mockRejectedValueOnce({
        statusCode: 400,
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment is already fully refunded'
        }
      });

      await expect(
        provider.refund({ paymentId: 'pay_already_refunded' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('verifyWebhook', () => {
    const rawPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.authorized',
      contains: ['payment'],
      payload: { payment: { entity: { id: 'pay_123', amount: 1000 } } }
    });

    test('should throw ValidationError if raw payload or signature are missing', async () => {
      await expect(provider.verifyWebhook({ signature: 'sig_123' })).rejects.toThrow(
        ValidationError
      );
      await expect(
        provider.verifyWebhook({ payload: rawPayload, signature: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError if webhook secret is not configured and not provided', async () => {
      const providerWithoutWebhook = new RazorpayProvider({
        keyId: mockKeyId,
        keySecret: mockKeySecret,
        client: mockClient
      });

      await expect(
        providerWithoutWebhook.verifyWebhook({
          payload: rawPayload,
          signature: 'sig_123'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should verify valid webhook signature for raw string payload', async () => {
      const validWebhookSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawPayload)
        .digest('hex');

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: validWebhookSignature
      });

      expect(result).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          verified: true
        }
      });
    });

    test('should verify valid webhook signature for raw Buffer payload', async () => {
      const bufferPayload = Buffer.from(rawPayload, 'utf8');
      const validWebhookSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(bufferPayload)
        .digest('hex');

      const result = await provider.verifyWebhook({
        payload: bufferPayload,
        signature: validWebhookSignature
      });

      expect(result).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          verified: true
        }
      });
    });

    test('should return verified: false for invalid webhook signature', async () => {
      const invalidWebhookSignature = 'invalid_webhook_signature_hex';

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: invalidWebhookSignature
      });

      expect(result).toEqual({
        success: true,
        provider: 'razorpay',
        data: {
          verified: false
        }
      });
    });
  });
});
