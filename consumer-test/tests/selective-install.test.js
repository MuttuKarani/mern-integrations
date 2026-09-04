import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createPaymentProvider,
  createEmailProvider,
  IntegrationError
} from 'mern-integrations';

describe('E. Selective SDK Installation Verification', () => {
  it('should support dynamic inspection and safe failure when uninstalled SDKs are invoked', async () => {
    // When a consumer only intends to use a zero-SDK provider (e.g. CCAvenue) or specific installed provider,
    // other SDK providers remain safely dormant and only throw when explicitly invoked.
    const stripe = createPaymentProvider({
      provider: 'stripe',
      secretKey: 'sk_test_mock_123'
    });

    assert.equal(stripe.name, 'stripe');
    assert.deepEqual(stripe.capabilities, [
      'createOrder',
      'initiatePayment',
      'verifyPayment',
      'verifyCallback',
      'refund',
      'verifyWebhook'
    ]);

    // Invoking uninstalled provider fails with clear actionable error
    await assert.rejects(
      async () => {
        await stripe.createOrder({ amount: 5000, currency: 'USD' });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.message.includes('npm install stripe'), true);
        return true;
      }
    );
  });
});
