import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createPaymentProvider,
  PaymentProvider,
  StripeProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('StripeProvider & Stripe Payment Integration', () => {
  const mockSecretKey = 'sk_test_51MockSecretKey1234567890';
  const mockWebhookSecret = 'whsec_MockWebhookSecret1234567890';

  let mockClient;
  let provider;

  beforeEach(() => {
    mockClient = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn()
      },
      refunds: {
        create: jest.fn()
      },
      webhooks: {
        constructEvent: jest.fn()
      }
    };

    provider = new StripeProvider({
      secretKey: mockSecretKey,
      webhookSecret: mockWebhookSecret,
      client: mockClient
    });
  });

  describe('Abstract Architecture & Provider Contract', () => {
    test('should extend PaymentProvider base class', () => {
      expect(provider).toBeInstanceOf(PaymentProvider);
      expect(provider).toBeInstanceOf(StripeProvider);
      expect(provider.name).toBe('stripe');
    });

    test('should expose client getter returning injected client', () => {
      expect(provider.client).toBe(mockClient);
    });
  });

  describe('Constructor & Credentials Validation', () => {
    test('should throw ValidationError if config is not an object', () => {
      expect(() => new StripeProvider(null)).toThrow(ValidationError);
      expect(() => new StripeProvider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if secretKey is missing when client is not injected', () => {
      expect(() => new StripeProvider({})).toThrow(ValidationError);
      expect(() => new StripeProvider({ secretKey: '' })).toThrow(ValidationError);
      expect(() => new StripeProvider({ secretKey: '   ' })).toThrow(ValidationError);
    });

    test('should throw ValidationError if webhookSecret is provided but empty or whitespace', () => {
      expect(
        () =>
          new StripeProvider({
            secretKey: mockSecretKey,
            webhookSecret: '   '
          })
      ).toThrow(ValidationError);
    });

    test('should instantiate successfully with secretKey only', () => {
      const p = new StripeProvider({ secretKey: mockSecretKey, client: mockClient });
      expect(p).toBeInstanceOf(StripeProvider);
    });

    test('should support custom client injection without requiring secretKey', () => {
      const customClient = { custom: true };
      const p = new StripeProvider({ client: customClient });
      expect(p).toBeInstanceOf(StripeProvider);
      expect(p.client).toBe(customClient);
    });
  });

  describe('PaymentFactory', () => {
    test('should create StripeProvider when provider is "stripe"', () => {
      const p = createPaymentProvider({
        provider: 'stripe',
        secretKey: mockSecretKey,
        webhookSecret: mockWebhookSecret,
        client: mockClient
      });

      expect(p).toBeInstanceOf(StripeProvider);
      expect(p).toBeInstanceOf(PaymentProvider);
      expect(p.name).toBe('stripe');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createPaymentProvider({
        provider: 'STRIPE',
        secretKey: mockSecretKey,
        client: mockClient
      });
      const p2 = createPaymentProvider({
        provider: '  stripe  ',
        secretKey: mockSecretKey,
        client: mockClient
      });

      expect(p1).toBeInstanceOf(StripeProvider);
      expect(p2).toBeInstanceOf(StripeProvider);
    });

    test('should throw ValidationError if config or provider is missing', () => {
      expect(() => createPaymentProvider(null)).toThrow(ValidationError);
      expect(() => createPaymentProvider({})).toThrow(ValidationError);
      expect(() => createPaymentProvider({ provider: '' })).toThrow(ValidationError);
      expect(() => createPaymentProvider({ provider: '   ' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError with UNSUPPORTED_PROVIDER for unknown provider', () => {
      try {
        createPaymentProvider({ provider: 'braintree', secretKey: 'test' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }
    });
  });

  describe('createOrder (PaymentIntents)', () => {
    test('should validate that amount is a positive integer in smallest currency units', async () => {
      await expect(provider.createOrder({ currency: 'usd' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 0, currency: 'usd' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: -500, currency: 'usd' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 10.5, currency: 'usd' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: '1000', currency: 'usd' })).rejects.toThrow(ValidationError);
    });

    test('should validate currency is a non-empty string', async () => {
      await expect(provider.createOrder({ amount: 1000, currency: '' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 1000, currency: '   ' })).rejects.toThrow(ValidationError);
    });

    test('should validate optional fields when provided', async () => {
      await expect(
        provider.createOrder({ amount: 1000, currency: 'usd', receiptEmail: 'invalid-email' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.createOrder({ amount: 1000, currency: 'usd', description: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.createOrder({ amount: 1000, currency: 'usd', customerId: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.createOrder({ amount: 1000, currency: 'usd', metadata: 'not-an-object' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.createOrder({ amount: 1000, currency: 'usd', captureMethod: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully create PaymentIntent with default currency and return normalized response', async () => {
      const mockPaymentIntent = {
        id: 'pi_3MtwxGA9Iipxub',
        client_secret: 'pi_3MtwxGA9Iipxub_secret_xyz123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method'
      };

      mockClient.paymentIntents.create.mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.createOrder({
        amount: 2000
      });

      expect(mockClient.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd'
      });

      expect(result).toEqual({
        success: true,
        provider: 'stripe',
        data: {
          id: 'pi_3MtwxGA9Iipxub',
          clientSecret: 'pi_3MtwxGA9Iipxub_secret_xyz123',
          amount: 2000,
          currency: 'usd',
          status: 'requires_payment_method',
          raw: mockPaymentIntent
        }
      });
    });

    test('should pass all optional parameters correctly to Stripe SDK', async () => {
      const mockPaymentIntent = {
        id: 'pi_3MtwxGA9Iipxub',
        client_secret: 'pi_3MtwxGA9Iipxub_secret_xyz123',
        amount: 5000,
        currency: 'eur',
        status: 'requires_capture'
      };

      mockClient.paymentIntents.create.mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.createOrder({
        amount: 5000,
        currency: 'EUR',
        description: 'Premium subscription',
        receiptEmail: 'customer@example.com',
        metadata: { planId: 'pro_annual', userId: 'user_456' },
        customerId: 'cus_123456',
        paymentMethodTypes: ['card'],
        captureMethod: 'manual',
        statement_descriptor: 'PRO PLAN'
      });

      expect(mockClient.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'eur',
        description: 'Premium subscription',
        receipt_email: 'customer@example.com',
        metadata: { planId: 'pro_annual', userId: 'user_456' },
        customer: 'cus_123456',
        payment_method_types: ['card'],
        capture_method: 'manual',
        statement_descriptor: 'PRO PLAN'
      });

      expect(result.data.id).toBe('pi_3MtwxGA9Iipxub');
      expect(result.data.clientSecret).toBe('pi_3MtwxGA9Iipxub_secret_xyz123');
    });

    test('should map Stripe API errors into IntegrationError', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        type: 'StripeInvalidRequestError',
        statusCode: 400,
        message: 'Invalid currency code'
      });

      try {
        await provider.createOrder({ amount: 1000, currency: 'usd' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
        expect(err.provider).toBe('stripe');
      }
    });
  });

  describe('verifyPayment', () => {
    test('should throw ValidationError if paymentIntentId is missing or empty', async () => {
      await expect(provider.verifyPayment({})).rejects.toThrow(ValidationError);
      await expect(provider.verifyPayment({ paymentIntentId: '' })).rejects.toThrow(ValidationError);
      await expect(provider.verifyPayment({ paymentIntentId: '   ' })).rejects.toThrow(ValidationError);
    });

    test('should retrieve payment intent and return verified: true when status is "succeeded"', async () => {
      const mockPaymentIntent = {
        id: 'pi_3MtwxGA9Iipxub',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded'
      };

      mockClient.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.verifyPayment({
        paymentIntentId: 'pi_3MtwxGA9Iipxub'
      });

      expect(mockClient.paymentIntents.retrieve).toHaveBeenCalledWith('pi_3MtwxGA9Iipxub');
      expect(result).toEqual({
        success: true,
        provider: 'stripe',
        data: {
          id: 'pi_3MtwxGA9Iipxub',
          status: 'succeeded',
          amount: 2000,
          currency: 'usd',
          verified: true,
          raw: mockPaymentIntent
        }
      });
    });

    test('should return verified: false when status is not "succeeded"', async () => {
      const mockPaymentIntent = {
        id: 'pi_3MtwxGA9Iipxub',
        amount: 2000,
        currency: 'usd',
        status: 'requires_action'
      };

      mockClient.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.verifyPayment({
        paymentIntentId: 'pi_3MtwxGA9Iipxub'
      });

      expect(result.data.verified).toBe(false);
      expect(result.data.status).toBe('requires_action');
    });

    test('should return verified: false when payment intent is canceled', async () => {
      const mockPaymentIntent = {
        id: 'pi_3MtwxGA9Iipxub',
        amount: 2000,
        currency: 'usd',
        status: 'canceled'
      };

      mockClient.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.verifyPayment({
        paymentIntentId: 'pi_3MtwxGA9Iipxub'
      });

      expect(result.data.verified).toBe(false);
      expect(result.data.status).toBe('canceled');
    });

    test('should map Stripe retrieve error to IntegrationError', async () => {
      mockClient.paymentIntents.retrieve.mockRejectedValueOnce({
        type: 'StripeInvalidRequestError',
        statusCode: 404,
        message: 'No such payment_intent: pi_invalid'
      });

      await expect(
        provider.verifyPayment({ paymentIntentId: 'pi_invalid' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('refund', () => {
    test('should throw ValidationError if neither paymentIntentId nor chargeId is provided', async () => {
      await expect(provider.refund({})).rejects.toThrow(ValidationError);
      await expect(provider.refund({ paymentIntentId: '', chargeId: '' })).rejects.toThrow(ValidationError);
    });

    test('should validate amount if provided', async () => {
      await expect(
        provider.refund({ paymentIntentId: 'pi_123', amount: 0 })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.refund({ paymentIntentId: 'pi_123', amount: -100 })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.refund({ paymentIntentId: 'pi_123', amount: 15.5 })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate reason and metadata if provided', async () => {
      await expect(
        provider.refund({ paymentIntentId: 'pi_123', reason: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.refund({ paymentIntentId: 'pi_123', metadata: 'invalid' })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully create a full refund using paymentIntentId', async () => {
      const mockRefund = {
        id: 're_3MtwxGA9Iipxub',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd'
      };

      mockClient.refunds.create.mockResolvedValueOnce(mockRefund);

      const result = await provider.refund({
        paymentIntentId: 'pi_3MtwxGA9Iipxub'
      });

      expect(mockClient.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_3MtwxGA9Iipxub'
      });

      expect(result).toEqual({
        success: true,
        provider: 'stripe',
        data: {
          id: 're_3MtwxGA9Iipxub',
          status: 'succeeded',
          amount: 2000,
          currency: 'usd',
          raw: mockRefund
        }
      });
    });

    test('should successfully create a partial refund with chargeId and metadata', async () => {
      const mockRefund = {
        id: 're_3MtwxGA9Iipxub',
        status: 'succeeded',
        amount: 1000,
        currency: 'usd'
      };

      mockClient.refunds.create.mockResolvedValueOnce(mockRefund);

      const result = await provider.refund({
        chargeId: 'ch_123456',
        amount: 1000,
        reason: 'requested_by_customer',
        metadata: { returnId: 'ret_789' }
      });

      expect(mockClient.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_123456',
        amount: 1000,
        reason: 'requested_by_customer',
        metadata: { returnId: 'ret_789' }
      });

      expect(result.data.amount).toBe(1000);
    });

    test('should map Stripe refund errors to IntegrationError', async () => {
      mockClient.refunds.create.mockRejectedValueOnce({
        type: 'StripeInvalidRequestError',
        statusCode: 400,
        message: 'Charge has already been refunded.'
      });

      await expect(
        provider.refund({ paymentIntentId: 'pi_already_refunded' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('verifyWebhook', () => {
    const rawPayload = JSON.stringify({
      id: 'evt_1MtwxGA9Iipxub',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } }
    });
    const mockSignature = 't=1600000000,v1=mock_signature_hash';

    test('should throw ValidationError if payload or signature is missing', async () => {
      await expect(provider.verifyWebhook({ signature: mockSignature })).rejects.toThrow(ValidationError);
      await expect(provider.verifyWebhook({ payload: rawPayload })).rejects.toThrow(ValidationError);
      await expect(provider.verifyWebhook({ payload: rawPayload, signature: '' })).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError if webhookSecret is not configured and not provided', async () => {
      const providerWithoutWebhookSecret = new StripeProvider({
        secretKey: mockSecretKey,
        client: mockClient
      });

      await expect(
        providerWithoutWebhookSecret.verifyWebhook({
          payload: rawPayload,
          signature: mockSignature
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully construct and verify webhook event using constructor webhookSecret', async () => {
      const mockEvent = {
        id: 'evt_1MtwxGA9Iipxub',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } }
      };

      mockClient.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: mockSignature
      });

      expect(mockClient.webhooks.constructEvent).toHaveBeenCalledWith(
        rawPayload,
        mockSignature,
        mockWebhookSecret
      );

      expect(result).toEqual({
        success: true,
        provider: 'stripe',
        data: {
          verified: true,
          event: mockEvent,
          raw: mockEvent
        }
      });
    });

    test('should allow overriding webhookSecret at method level', async () => {
      const customSecret = 'whsec_CustomMethodOverride123';
      const mockEvent = { id: 'evt_custom' };

      mockClient.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: mockSignature,
        webhookSecret: customSecret
      });

      expect(mockClient.webhooks.constructEvent).toHaveBeenCalledWith(
        rawPayload,
        mockSignature,
        customSecret
      );
      expect(result.data.verified).toBe(true);
    });

    test('should allow overriding with secret alias', async () => {
      const customSecret = 'whsec_AliasOverride123';
      const mockEvent = { id: 'evt_alias' };

      mockClient.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: mockSignature,
        secret: customSecret
      });

      expect(mockClient.webhooks.constructEvent).toHaveBeenCalledWith(
        rawPayload,
        mockSignature,
        customSecret
      );
      expect(result.data.verified).toBe(true);
    });

    test('should support Buffer payloads for webhook verification', async () => {
      const bufferPayload = Buffer.from(rawPayload, 'utf8');
      const mockEvent = { id: 'evt_buffer' };

      mockClient.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = await provider.verifyWebhook({
        payload: bufferPayload,
        signature: mockSignature
      });

      expect(mockClient.webhooks.constructEvent).toHaveBeenCalledWith(
        bufferPayload,
        mockSignature,
        mockWebhookSecret
      );
      expect(result.data.verified).toBe(true);
    });

    test('should return verified: false when Stripe signature verification fails', async () => {
      mockClient.webhooks.constructEvent.mockImplementationOnce(() => {
        const error = new Error('No signatures found matching the expected signature for payload');
        error.name = 'StripeSignatureVerificationError';
        error.type = 'StripeSignatureVerificationError';
        throw error;
      });

      const result = await provider.verifyWebhook({
        payload: rawPayload,
        signature: 'invalid_sig'
      });

      expect(result).toEqual({
        success: true,
        provider: 'stripe',
        data: {
          verified: false,
          event: null,
          raw: null
        }
      });
    });
  });

  describe('Error Normalization & Security', () => {
    test('should map StripeAuthenticationError to AUTHENTICATION_ERROR with status 401', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        type: 'StripeAuthenticationError',
        statusCode: 401,
        message: 'Invalid API Key provided'
      });

      try {
        await provider.createOrder({ amount: 1000 });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(401);
        expect(err.provider).toBe('stripe');
      }
    });

    test('should map StripeRateLimitError to RATE_LIMIT_EXCEEDED with status 429', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        type: 'StripeRateLimitError',
        statusCode: 429,
        message: 'Too many requests'
      });

      try {
        await provider.createOrder({ amount: 1000 });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(err.statusCode).toBe(429);
      }
    });

    test('should map StripeCardError to CARD_ERROR with status 402', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        type: 'StripeCardError',
        code: 'card_declined',
        statusCode: 402,
        decline_code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      });

      try {
        await provider.createOrder({ amount: 1000 });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('card_declined');
        expect(err.statusCode).toBe(402);
        expect(err.details).toEqual({
          param: undefined,
          code: 'card_declined',
          declineCode: 'insufficient_funds'
        });
      }
    });

    test('should map StripeConnectionError to PROVIDER_ERROR with status 503', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        type: 'StripeConnectionError',
        statusCode: 503,
        message: 'Could not connect to Stripe API'
      });

      try {
        await provider.createOrder({ amount: 1000 });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(503);
      }
    });

    test('should never expose sensitive secretKey or webhookSecret in Object.keys() or JSON.stringify()', () => {
      const p = new StripeProvider({
        secretKey: mockSecretKey,
        webhookSecret: mockWebhookSecret,
        client: mockClient
      });

      const keys = Object.keys(p);
      expect(keys).not.toContain('secretKey');
      expect(keys).not.toContain('webhookSecret');
      expect(keys).not.toContain('#secretKey');
      expect(keys).not.toContain('#webhookSecret');
      expect(keys).not.toContain('#client');

      const serialized = JSON.stringify(p);
      expect(serialized).not.toContain(mockSecretKey);
      expect(serialized).not.toContain(mockWebhookSecret);
    });

    test('should redact secretKey and webhookSecret if present in error message', async () => {
      mockClient.paymentIntents.create.mockRejectedValueOnce({
        message: `Stripe failure with key ${mockSecretKey} and webhook ${mockWebhookSecret}`
      });

      try {
        await provider.createOrder({ amount: 1000 });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.message).not.toContain(mockSecretKey);
        expect(err.message).not.toContain(mockWebhookSecret);
        expect(err.message).toContain('[REDACTED]');

        const serialized = JSON.stringify(err.toJSON());
        expect(serialized).not.toContain(mockSecretKey);
        expect(serialized).not.toContain(mockWebhookSecret);
      }
    });
  });
});
