import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentProvider,
  createEmailProvider,
  createSMSProvider,
  IntegrationError,
  ValidationError
} from 'mern-integrations';

describe('F. Error Contract Verification', () => {
  describe('1. Unsupported Provider (Category A)', () => {
    it('should throw IntegrationError with UNSUPPORTED_PROVIDER when provider is unknown', () => {
      assert.throws(
        () => {
          createPaymentProvider({
            provider: 'unknown-payment-gateway'
          });
        },
        (err) => {
          assert.equal(err instanceof IntegrationError, true);
          assert.equal(err.name, 'IntegrationError');
          assert.equal(err.code, 'UNSUPPORTED_PROVIDER');
          assert.equal(err.statusCode, 400);
          assert.equal(err.message.includes('unknown-payment-gateway'), true);
          return true;
        }
      );
    });

    it('should throw IntegrationError with UNSUPPORTED_PROVIDER for unknown email provider', () => {
      assert.throws(
        () => {
          createEmailProvider({
            provider: 'sendgrid'
          });
        },
        (err) => {
          assert.equal(err instanceof IntegrationError, true);
          assert.equal(err.code, 'UNSUPPORTED_PROVIDER');
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });
  });

  describe('2. Validation Error Contract', () => {
    it('should throw ValidationError when required config parameters are missing', () => {
      assert.throws(
        () => {
          createPaymentProvider({
            provider: 'razorpay' // missing keyId and keySecret
          });
        },
        (err) => {
          assert.equal(err instanceof ValidationError, true);
          assert.equal(err.name, 'ValidationError');
          return true;
        }
      );
    });

    it('should throw ValidationError when options object is null or undefined', () => {
      assert.throws(
        () => {
          createSMSProvider(null);
        },
        (err) => {
          assert.equal(err instanceof ValidationError, true);
          return true;
        }
      );
    });
  });

  describe('3. Error Class Instance Inspection', () => {
    it('IntegrationError should support custom code and statusCode', () => {
      const error = new IntegrationError('Failed operation', {
        code: 'PAYMENT_FAILED',
        statusCode: 402,
        details: { orderId: '123' }
      });
      assert.equal(error instanceof Error, true);
      assert.equal(error instanceof IntegrationError, true);
      assert.equal(error.name, 'IntegrationError');
      assert.equal(error.code, 'PAYMENT_FAILED');
      assert.equal(error.statusCode, 402);
      assert.deepEqual(error.details, { orderId: '123' });
    });

    it('ValidationError should support fields and details', () => {
      const error = new ValidationError('Invalid input parameters', {
        details: { fields: ['email', 'amount'] }
      });
      assert.equal(error instanceof Error, true);
      assert.equal(error instanceof ValidationError, true);
      assert.equal(error.name, 'ValidationError');
      assert.deepEqual(error.details.fields, ['email', 'amount']);
    });
  });
});
