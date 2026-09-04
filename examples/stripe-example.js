import dotenv from 'dotenv';
import { createPaymentProvider, StripeProvider, IntegrationError, ValidationError } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Example demonstrating how to use the Stripe provider inside an Express / MERN backend.
 */
async function runExample() {
  console.log('=== Stripe Provider Example ===\n');

  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholderSecretKey123';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholderWebhookSecret456';
  const isPlaceholder = secretKey.includes('placeholder') || secretKey.startsWith('sk_test_placeholder');

  // 1. Initialize Stripe provider using factory
  const payment = createPaymentProvider({
    provider: 'stripe',
    secretKey,
    webhookSecret
  });

  console.log(`Initialized provider via factory: ${payment.name}`);

  // Alternatively, direct instantiation:
  // const directProvider = new StripeProvider({ secretKey, webhookSecret });

  // 2. Creating a PaymentIntent (e.g. in Express POST /api/payments/create-intent)
  console.log('\n--- 1. Creating a PaymentIntent (createOrder) ---');
  const orderPayload = {
    amount: 2000, // 2000 cents = $20.00 USD
    currency: 'usd',
    description: 'Course enrollment fee',
    receiptEmail: 'student@example.com',
    metadata: {
      userId: 'user_mern_101',
      courseId: 'mern_advanced_stripe'
    }
  };

  console.log('PaymentIntent payload:', orderPayload);

  if (!isPlaceholder) {
    try {
      const orderResponse = await payment.createOrder(orderPayload);
      console.log('PaymentIntent created response:', orderResponse);
      console.log('Client Secret (send to frontend for Stripe.js):', orderResponse.data.clientSecret);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error('Validation failed:', error.toJSON());
      } else if (error instanceof IntegrationError) {
        console.error('Provider error:', error.toJSON());
      } else {
        console.error('Unexpected error:', error);
      }
    }
  } else {
    console.log('[Dry-Run] Skipped live Stripe API createOrder call (placeholder credentials detected).');
  }

  // 3. Verifying / Retrieving PaymentIntent Status (e.g. in Express GET /api/payments/verify/:id)
  console.log('\n--- 2. Verifying Payment Status (verifyPayment) ---');
  const mockPaymentIntentId = 'pi_3MtwxGA9Iipxub';
  console.log(`Retrieving payment intent status for: ${mockPaymentIntentId}`);

  if (!isPlaceholder) {
    try {
      const verificationResult = await payment.verifyPayment({
        paymentIntentId: mockPaymentIntentId
      });
      console.log('Payment verification result:', verificationResult);
    } catch (error) {
      console.error('Verification error:', error instanceof IntegrationError ? error.toJSON() : error);
    }
  } else {
    console.log('[Dry-Run] Skipped live Stripe API retrieve call (placeholder credentials detected).');
  }

  // 4. Processing a Refund (e.g. in Express POST /api/payments/refund)
  console.log('\n--- 3. Processing a Refund (refund) ---');
  const refundPayload = {
    paymentIntentId: mockPaymentIntentId,
    amount: 1000, // Partial refund: $10.00
    reason: 'requested_by_customer',
    metadata: { refundNote: 'Customer satisfied with cancellation policy' }
  };
  console.log('Refund payload:', refundPayload);

  if (!isPlaceholder) {
    try {
      const refundResult = await payment.refund(refundPayload);
      console.log('Refund result:', refundResult);
    } catch (error) {
      console.error('Refund error:', error instanceof IntegrationError ? error.toJSON() : error);
    }
  } else {
    console.log('[Dry-Run] Skipped live Stripe API refund call (placeholder credentials detected).');
  }

  // 5. Verifying Webhook Signature (e.g. in Express POST /api/webhooks/stripe)
  console.log('\n--- 4. Verifying Webhook Signature (verifyWebhook) ---');
  try {
    // In an Express app, make sure to use express.raw({ type: 'application/json' }) for webhook endpoints
    const rawWebhookBody = JSON.stringify({
      id: 'evt_1MtwxGA9Iipxub',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: mockPaymentIntentId,
          amount: 2000,
          currency: 'usd',
          status: 'succeeded'
        }
      }
    });

    console.log('Verifying webhook with payload and signature...');
    // In production with real webhook secret & stripe-signature header:
    // const webhookResult = await payment.verifyWebhook({
    //   payload: req.body, // exact raw Buffer/string
    //   signature: req.headers['stripe-signature']
    // });

    console.log('(Webhook signature verification requires exact live Stripe-Signature header from webhook event)');
  } catch (error) {
    console.error('Webhook verification error:', error);
  }

  console.log('\n=== Stripe Example Run Complete ===');
}

runExample().catch((error) => {
  console.error('Example failed:', error);
  process.exit(1);
});
