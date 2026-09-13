import { jest } from '@jest/globals';
import {
  normalizeWebhookEvent,
  createWebhookNormalizer,
  webhookNormalizerMiddleware
} from '../../src/middleware/index.js';
import { ValidationError } from '../../src/core/errors/ValidationError.js';
import { IntegrationError } from '../../src/core/errors/IntegrationError.js';

describe('Enterprise Middleware: Unified Webhook Event Normalizer', () => {
  describe('normalizeWebhookEvent() Pure Function Transformer', () => {
    describe('Stripe normalization', () => {
      it('should normalize payment_intent.succeeded into payment.success', () => {
        const stripePayload = {
          id: 'evt_123',
          type: 'payment_intent.succeeded',
          created: 1726000000,
          livemode: true,
          data: {
            object: {
              id: 'pi_abc123',
              amount: 5000,
              currency: 'usd',
              status: 'succeeded',
              receipt_email: 'buyer@example.com',
              customer: 'cus_123',
              metadata: { orderId: 'ord_999' }
            }
          }
        };

        const event = normalizeWebhookEvent('stripe', stripePayload);

        expect(event.provider).toBe('stripe');
        expect(event.eventType).toBe('payment.success');
        expect(event.originalEvent).toBe('payment_intent.succeeded');
        expect(event.id).toBe('evt_123');
        expect(event.livemode).toBe(true);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.resource.id).toBe('pi_abc123');
        expect(event.resource.amount).toBe(5000);
        expect(event.resource.currency).toBe('USD');
        expect(event.resource.orderId).toBe('ord_999');
        expect(event.resource.customer.email).toBe('buyer@example.com');
        expect(event.raw).toBe(stripePayload);
      });

      it('should normalize payment_intent.payment_failed and charge.refunded', () => {
        const failedEvent = normalizeWebhookEvent('stripe', {
          id: 'evt_fail',
          type: 'payment_intent.payment_failed',
          data: { object: { id: 'pi_fail' } }
        });
        expect(failedEvent.eventType).toBe('payment.failed');

        const refundEvent = normalizeWebhookEvent('stripe', {
          id: 'evt_refund',
          type: 'charge.refunded',
          data: { object: { id: 'ch_ref' } }
        });
        expect(refundEvent.eventType).toBe('refund.success');
      });
    });

    describe('Razorpay normalization', () => {
      it('should normalize payment.captured into payment.success', () => {
        const rzpPayload = {
          entity: 'event',
          account_id: 'acc_123',
          event: 'payment.captured',
          created_at: 1726000000,
          payload: {
            payment: {
              entity: {
                id: 'pay_def456',
                amount: 49900,
                currency: 'INR',
                status: 'captured',
                order_id: 'order_789',
                email: 'customer@razorpay.dev',
                contact: '+919999999999',
                notes: { plan: 'premium' }
              }
            }
          }
        };

        const event = normalizeWebhookEvent('razorpay', rzpPayload);

        expect(event.provider).toBe('razorpay');
        expect(event.eventType).toBe('payment.success');
        expect(event.originalEvent).toBe('payment.captured');
        expect(event.id).toBe('pay_def456');
        expect(event.resource.id).toBe('pay_def456');
        expect(event.resource.orderId).toBe('order_789');
        expect(event.resource.amount).toBe(49900);
        expect(event.resource.currency).toBe('INR');
        expect(event.resource.customer.email).toBe('customer@razorpay.dev');
        expect(event.resource.customer.phone).toBe('+919999999999');
        expect(event.resource.metadata).toEqual({ plan: 'premium' });
      });

      it('should normalize payment.failed and refund.processed', () => {
        const failed = normalizeWebhookEvent('razorpay', {
          event: 'payment.failed',
          payload: { payment: { entity: { id: 'pay_fail' } } }
        });
        expect(failed.eventType).toBe('payment.failed');

        const refund = normalizeWebhookEvent('razorpay', {
          event: 'refund.processed',
          payload: { refund: { entity: { id: 'rfnd_1' } } }
        });
        expect(refund.eventType).toBe('refund.success');
      });
    });

    describe('PhonePe normalization', () => {
      it('should normalize PAYMENT_SUCCESS and COMPLETED into payment.success', () => {
        const phonepePayload = {
          code: 'PAYMENT_SUCCESS',
          data: {
            merchantTransactionId: 'MT_100',
            transactionId: 'T_200',
            amount: 79900,
            currency: 'INR',
            state: 'COMPLETED',
            merchantUserId: 'usr_1',
            paymentInstrument: { type: 'UPI' }
          }
        };

        const event = normalizeWebhookEvent('phonepe', phonepePayload);

        expect(event.provider).toBe('phonepe');
        expect(event.eventType).toBe('payment.success');
        expect(event.resource.id).toBe('T_200');
        expect(event.resource.orderId).toBe('MT_100');
        expect(event.resource.amount).toBe(79900);
        expect(event.resource.currency).toBe('INR');
        expect(event.resource.status).toBe('COMPLETED');
      });

      it('should normalize PAYMENT_ERROR into payment.failed and PAYMENT_PENDING into payment.pending', () => {
        const errEvent = normalizeWebhookEvent('phonepe', {
          code: 'PAYMENT_ERROR',
          data: { state: 'FAILED' }
        });
        expect(errEvent.eventType).toBe('payment.failed');

        const pendingEvent = normalizeWebhookEvent('phonepe', {
          code: 'PAYMENT_PENDING',
          data: { state: 'PENDING' }
        });
        expect(pendingEvent.eventType).toBe('payment.pending');
      });
    });

    describe('Twilio normalization', () => {
      it('should normalize delivered, failed, sent, and queued message status callbacks', () => {
        const delivered = normalizeWebhookEvent('twilio', {
          MessageSid: 'SM_123',
          MessageStatus: 'delivered',
          To: '+15005550001',
          From: '+15005550002'
        });
        expect(delivered.provider).toBe('twilio');
        expect(delivered.eventType).toBe('message.delivered');
        expect(delivered.resource.id).toBe('SM_123');
        expect(delivered.resource.customer.phone).toBe('+15005550001');

        const failed = normalizeWebhookEvent('twilio', {
          MessageSid: 'SM_fail',
          MessageStatus: 'failed',
          ErrorCode: '30008'
        });
        expect(failed.eventType).toBe('message.failed');
        expect(failed.resource.metadata.errorCode).toBe('30008');

        const sent = normalizeWebhookEvent('twilio', {
          MessageSid: 'SM_sent',
          MessageStatus: 'sent'
        });
        expect(sent.eventType).toBe('message.sent');
      });
    });

    describe('MSG91 normalization', () => {
      it('should normalize delivery and failure reports', () => {
        const delivered = normalizeWebhookEvent('msg91', {
          requestId: 'req_123',
          status: 'delivered',
          mobile: '919999999999'
        });
        expect(delivered.provider).toBe('msg91');
        expect(delivered.eventType).toBe('message.delivered');
        expect(delivered.resource.customer.phone).toBe('919999999999');

        const failed = normalizeWebhookEvent('msg91', {
          requestId: 'req_456',
          status: 'rejected'
        });
        expect(failed.eventType).toBe('message.failed');
      });
    });

    describe('Resend normalization', () => {
      it('should normalize email.delivered and email.bounced events', () => {
        const delivered = normalizeWebhookEvent('resend', {
          id: 'resend_evt_1',
          type: 'email.delivered',
          created_at: '2026-09-13T10:00:00.000Z',
          data: {
            email_id: 'em_123',
            from: 'sender@acme.com',
            to: ['user@example.com'],
            subject: 'Welcome'
          }
        });
        expect(delivered.provider).toBe('resend');
        expect(delivered.eventType).toBe('email.delivered');
        expect(delivered.resource.id).toBe('em_123');
        expect(delivered.resource.customer.email).toBe('user@example.com');

        const bounced = normalizeWebhookEvent('resend', {
          type: 'email.bounced',
          data: { email_id: 'em_456' }
        });
        expect(bounced.eventType).toBe('email.bounced');
      });
    });

    describe('Fallback for unknown provider or custom payload', () => {
      it('should normalize unknown events gracefully without throwing', () => {
        const unknown = normalizeWebhookEvent('custom_gateway', {
          id: 'cg_1',
          eventType: 'custom.event',
          status: 'active'
        });

        expect(unknown.provider).toBe('custom_gateway');
        expect(unknown.eventType).toBe('custom.event');
        expect(unknown.id).toBe('cg_1');
        expect(unknown.resource.id).toBe('cg_1');
      });
    });
  });

  describe('webhookNormalizerMiddleware() HTTP Processing', () => {
    function createMockHttp({
      params = {},
      headers = {},
      body = {},
      rawBody = null
    } = {}) {
      const req = {
        params,
        headers: { ...headers },
        body,
        rawBody,
        url: '/api/webhooks',
        originalUrl: '/api/webhooks'
      };

      const res = {
        statusCode: 200,
        _body: null,
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (obj) {
          this._body = obj;
          return this;
        }
      };

      return { req, res };
    }

    it('should throw ValidationError if provider is missing', async () => {
      const middleware = webhookNormalizerMiddleware();
      const { req, res } = createMockHttp({ params: {} });
      let err = null;

      await middleware(req, res, (e) => {
        err = e;
      });

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain('Webhook provider could not be determined');
    });

    it('should normalize webhook and attach req.webhookEvent when no signature verification is required', async () => {
      const middleware = webhookNormalizerMiddleware({
        provider: 'stripe',
        verifySignature: false
      });

      const stripeBody = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', amount: 3000, currency: 'usd' } }
      };

      const { req, res } = createMockHttp({ body: stripeBody });
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.webhookEvent).toBeDefined();
      expect(req.webhookEvent.provider).toBe('stripe');
      expect(req.webhookEvent.eventType).toBe('payment.success');
      expect(req.webhookEvent.resource.amount).toBe(3000);
    });

    it('should resolve provider dynamically and verify signature', async () => {
      const mockProvider = {
        verifyWebhook: jest.fn().mockResolvedValue({
          data: {
            verified: true,
            event: {
              event: 'payment.captured',
              payload: { payment: { entity: { id: 'pay_verified', amount: 1000 } } }
            }
          }
        })
      };

      const middleware = createWebhookNormalizer({
        provider: (req) => req.params.provider,
        getProvider: (req, providerName) => {
          expect(providerName).toBe('razorpay');
          return mockProvider;
        },
        verifySignature: true
      });

      const { req, res } = createMockHttp({
        params: { provider: 'razorpay' },
        headers: { 'x-razorpay-signature': 'sig_123' },
        body: { raw_event: true }
      });

      let nextCalled = false;
      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(mockProvider.verifyWebhook).toHaveBeenCalledTimes(1);
      expect(req.webhookEvent).toBeDefined();
      expect(req.webhookEvent.provider).toBe('razorpay');
      expect(req.webhookEvent.eventType).toBe('payment.success');
      expect(req.webhookEvent.resource.id).toBe('pay_verified');
    });

    it('should return 400 when signature verification fails', async () => {
      const mockProvider = {
        verifyWebhook: jest.fn().mockResolvedValue({
          data: { verified: false }
        })
      };

      const middleware = createWebhookNormalizer({
        provider: 'stripe',
        getProvider: mockProvider,
        verifySignature: true
      });

      const { req, res } = createMockHttp({
        headers: { 'stripe-signature': 'bad_signature' },
        body: { type: 'payment_intent.succeeded' }
      });

      let nextCalled = false;
      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res._body).toEqual({
        success: false,
        error: {
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: expect.stringContaining('Invalid webhook signature')
        }
      });
    });

    it('should invoke custom onVerificationError when verification fails', async () => {
      const mockProvider = {
        verifyWebhook: jest.fn().mockResolvedValue({
          data: { verified: false }
        })
      };

      let customHandlerCalled = false;

      const middleware = createWebhookNormalizer({
        provider: 'phonepe',
        getProvider: mockProvider,
        verifySignature: true,
        onVerificationError: (err, req, res, next) => {
          customHandlerCalled = true;
          expect(err.code).toBe('INVALID_WEBHOOK_SIGNATURE');
          res.status(403).json({ custom: 'forbidden' });
        }
      });

      const { req, res } = createMockHttp({
        headers: { 'x-verify': 'bad_checksum' },
        body: { response: 'base64' }
      });

      await middleware(req, res, () => {});

      expect(customHandlerCalled).toBe(true);
      expect(res.statusCode).toBe(403);
      expect(res._body).toEqual({ custom: 'forbidden' });
    });
  });
});
