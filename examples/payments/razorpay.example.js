import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { createPaymentProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Razorpay Payment Provider Example
 *
 * Requirements:
 *   npm install mern-integrations razorpay
 *
 * Environment Variables:
 *   RAZORPAY_KEY_ID=rzp_test_...
 *   RAZORPAY_KEY_SECRET=...
 *   RAZORPAY_WEBHOOK_SECRET=...
 */
async function main() {
  console.log('=== Razorpay Payment Provider Example ===\n');

  // 1. Initialize provider using factory
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_sampleKeyId123';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'sampleKeySecret456';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'sampleWebhookSecret789';

  const payment = createPaymentProvider({
    provider: 'razorpay',
    keyId,
    keySecret,
    webhookSecret
  });

  console.log(`Initialized provider: ${payment.name}`);
  console.log(`Capabilities: ${payment.capabilities.join(', ')}`);

  // 2. Introspect capabilities before invocation
  if (payment.capabilities.includes('createOrder')) {
    console.log('\n--- 1. Creating an Order (Amount in smallest currency unit: paise) ---');
    try {
      const orderPayload = {
        amount: 50000, // ₹500.00 = 50000 paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          customerId: 'cust_101',
          plan: 'pro_annual'
        }
      };
      console.log('Order payload:', orderPayload);

      // In production with live credentials:
      // const order = await payment.createOrder(orderPayload);
      // console.log('Order created:', order);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Cryptographic Payment Verification (HMAC SHA-256)
  if (payment.capabilities.includes('verifyPayment')) {
    console.log('\n--- 2. Verifying Payment Signature ---');
    try {
      const mockOrderId = 'order_EKwxwAgIt4KOQN';
      const mockPaymentId = 'pay_EKwxwAgIt4KOQN';

      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${mockOrderId}|${mockPaymentId}`)
        .digest('hex');

      const verificationResult = await payment.verifyPayment({
        razorpayOrderId: mockOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: validSignature
      });

      console.log('Signature verification result:', verificationResult);
    } catch (error) {
      handleError(error);
    }
  }

  // 4. Webhook Verification (Requires raw unmodified request body)
  if (payment.capabilities.includes('verifyWebhook')) {
    console.log('\n--- 3. Verifying Webhook Signature ---');
    try {
      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_123', amount: 50000 } } }
      });

      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const webhookResult = await payment.verifyWebhook({
        payload: rawBody, // Raw string or Buffer
        signature
      });

      console.log('Webhook verification result:', webhookResult);
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
