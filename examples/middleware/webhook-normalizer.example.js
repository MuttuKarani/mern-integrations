/**
 * Example: Unified Webhook Event Normalizer Middleware
 *
 * Demonstrates how to normalize incoming webhooks from multiple providers
 * (Stripe, Razorpay, PhonePe, Twilio) into a single, predictable event schema.
 *
 * Run with: npm run example:webhook-normalizer
 * Or: node examples/middleware/webhook-normalizer.example.js
 */

import {
  normalizeWebhookEvent,
  createWebhookNormalizer
} from '../../src/index.js';

async function runWebhookNormalizerExample() {
  console.log('=== mern-integrations: Unified Webhook Event Normalizer Example ===\n');

  // 1. Direct Pure Function Transformation Examples
  console.log('--- 1. Pure Function Transformation (normalizeWebhookEvent) ---');

  // A. Stripe Webhook
  const stripeRaw = {
    id: 'evt_stripe_101',
    type: 'payment_intent.succeeded',
    created: 1726000000,
    livemode: true,
    data: {
      object: {
        id: 'pi_3MtwxGA9Iipxub',
        amount: 2500, // $25.00
        currency: 'usd',
        status: 'succeeded',
        receipt_email: 'customer@stripe.dev',
        metadata: { orderId: 'ord_st_101' }
      }
    }
  };

  const normalizedStripe = normalizeWebhookEvent('stripe', stripeRaw);
  console.log('Normalized Stripe Event:');
  console.log({
    id: normalizedStripe.id,
    provider: normalizedStripe.provider,
    eventType: normalizedStripe.eventType,
    amount: normalizedStripe.resource.amount,
    currency: normalizedStripe.resource.currency,
    customerEmail: normalizedStripe.resource.customer.email
  });
  console.log();

  // B. Razorpay Webhook
  const razorpayRaw = {
    entity: 'event',
    account_id: 'acc_rzp_202',
    event: 'payment.captured',
    created_at: 1726000000,
    payload: {
      payment: {
        entity: {
          id: 'pay_rzp_999',
          amount: 49900, // ₹499.00
          currency: 'INR',
          status: 'captured',
          order_id: 'order_rzp_303',
          email: 'customer@razorpay.dev',
          contact: '+919876543210'
        }
      }
    }
  };

  const normalizedRazorpay = normalizeWebhookEvent('razorpay', razorpayRaw);
  console.log('Normalized Razorpay Event:');
  console.log({
    id: normalizedRazorpay.id,
    provider: normalizedRazorpay.provider,
    eventType: normalizedRazorpay.eventType,
    amount: normalizedRazorpay.resource.amount,
    currency: normalizedRazorpay.resource.currency,
    customerEmail: normalizedRazorpay.resource.customer.email,
    orderId: normalizedRazorpay.resource.orderId
  });
  console.log();

  // C. PhonePe Webhook
  const phonepeRaw = {
    code: 'PAYMENT_SUCCESS',
    data: {
      merchantTransactionId: 'MT_PH_404',
      transactionId: 'T_PH_505',
      amount: 129900, // ₹1299.00
      currency: 'INR',
      state: 'COMPLETED'
    }
  };

  const normalizedPhonePe = normalizeWebhookEvent('phonepe', phonepeRaw);
  console.log('Normalized PhonePe Event:');
  console.log({
    id: normalizedPhonePe.id,
    provider: normalizedPhonePe.provider,
    eventType: normalizedPhonePe.eventType,
    amount: normalizedPhonePe.resource.amount,
    currency: normalizedPhonePe.resource.currency,
    orderId: normalizedPhonePe.resource.orderId
  });
  console.log();

  // D. Twilio SMS Delivery Status Callback
  const twilioRaw = {
    MessageSid: 'SM_twilio_606',
    MessageStatus: 'delivered',
    To: '+15551234567',
    From: '+15559876543'
  };

  const normalizedTwilio = normalizeWebhookEvent('twilio', twilioRaw);
  console.log('Normalized Twilio Event:');
  console.log({
    id: normalizedTwilio.id,
    provider: normalizedTwilio.provider,
    eventType: normalizedTwilio.eventType,
    status: normalizedTwilio.resource.status,
    recipient: normalizedTwilio.resource.customer.phone
  });
  console.log();

  // 2. Express Middleware Integration Example
  console.log('--- 2. Express Route Handler Simulation ---');
  const normalizer = createWebhookNormalizer({
    verifySignature: false // In example, bypassing live cryptographic verification
  });

  const mockReq = {
    params: { provider: 'stripe' },
    body: stripeRaw,
    headers: {}
  };
  const mockRes = { json: (v) => console.log('Response returned to gateway:', v) };

  await normalizer(mockReq, mockRes, () => {
    const event = mockReq.webhookEvent;
    console.log(`[Unified Controller] Processing verified ${event.eventType} event from ${event.provider}...`);

    switch (event.eventType) {
      case 'payment.success':
        console.log(`[Unified Controller] Fulfilling order for ${event.resource.currency} ${(event.resource.amount / 100).toFixed(2)}`);
        break;
      case 'payment.failed':
        console.log(`[Unified Controller] Sending payment recovery notice to customer`);
        break;
      default:
        console.log(`[Unified Controller] Unhandled event type: ${event.eventType}`);
    }

    mockRes.json({ received: true });
  });

  console.log('\n=== Example Completed Successfully ===');
}

runWebhookNormalizerExample().catch(console.error);
