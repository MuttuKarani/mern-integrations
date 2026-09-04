import dotenv from 'dotenv';
import { createPaymentProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Stripe Payment Provider Example
 *
 * Requirements:
 *   npm install mern-integrations stripe
 *
 * Environment Variables:
 *   STRIPE_SECRET_KEY=sk_test_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 */
async function main() {
  console.log('=== Stripe Payment Provider Example ===\n');

  // 1. Initialize provider using factory
  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_sampleSecretKey123';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_sampleWebhookSecret456';

  const payment = createPaymentProvider({
    provider: 'stripe',
    secretKey,
    webhookSecret
  });

  console.log(`Initialized provider: ${payment.name}`);
  console.log(`Capabilities: ${payment.capabilities.join(', ')}`);

  // 2. Creating a PaymentIntent
  if (payment.capabilities.includes('createOrder')) {
    console.log('\n--- 1. Creating PaymentIntent (Amount in smallest currency unit: cents) ---');
    try {
      const intentPayload = {
        amount: 2500, // $25.00 = 2500 cents
        currency: 'USD',
        description: 'MERN Integrations Pro License',
        receiptEmail: 'customer@example.com',
        metadata: {
          orderId: `order_${Date.now()}`
        }
      };
      console.log('PaymentIntent payload:', intentPayload);

      // In production with live credentials:
      // const intent = await payment.createOrder(intentPayload);
      // console.log('PaymentIntent created:', intent);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Verifying Payment Status
  if (payment.capabilities.includes('verifyPayment')) {
    console.log('\n--- 2. Verifying PaymentIntent Status ---');
    try {
      console.log('Verifying status for paymentIntentId: pi_sample_123');
      // In production:
      // const verification = await payment.verifyPayment({ paymentIntentId: 'pi_sample_123' });
      // console.log('Verification result:', verification);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 4. Processing a Refund
  if (payment.capabilities.includes('refund')) {
    console.log('\n--- 3. Processing a Refund ---');
    try {
      const refundPayload = {
        paymentIntentId: 'pi_sample_123',
        amount: 1000, // Partial refund: $10.00
        reason: 'requested_by_customer',
        metadata: { reason: 'Customer requested refund' }
      };
      console.log('Refund payload:', refundPayload);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  console.log('\n=== Example completed successfully ===');
}

function handleError(error) {
  if (error instanceof ValidationError) {
    console.error('[ValidationError]', error.message, error.details);
  } else if (error instanceof IntegrationError) {
    console.error(`[IntegrationError - ${error.code} (${error.statusCode})]`, error.message);
  } else {
    console.error('[UnexpectedError]', error);
  }
}

main().catch(console.error);
