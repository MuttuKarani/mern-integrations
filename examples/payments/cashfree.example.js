import dotenv from 'dotenv';
import { createPaymentProvider, IntegrationError, ValidationError } from '../../src/index.js';

dotenv.config();

/**
 * Cashfree Payment Gateway Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js native crypto and fetch)
 *
 * Environment Variables (in .env):
 *   CASHFREE_APP_ID=TEST11286295edb615b6136d4c10c5e359268211
 *   CASHFREE_SECRET_KEY=cfsk_ma_test_074dbe3acec5c41338c85e44e5b66ae5_d6a3ef8f
 *   CASHFREE_ENV=SANDBOX
 *   CASHFREE_API_VERSION=2023-08-01
 */
async function main() {
  console.log('=== Cashfree Payment Gateway Example ===\n');

  const appId = process.env.CASHFREE_APP_ID || 'TEST_DUMMY_APP_ID';
  const secretKey = process.env.CASHFREE_SECRET_KEY || 'cfsk_ma_test_dummy_secret';
  const isSandbox = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase() === 'SANDBOX';

  // 1. Initialize provider using factory (automatically detects sandbox from test keys/env)
  const cashfree = createPaymentProvider({
    provider: 'cashfree',
    appId,
    secretKey,
    testMode: isSandbox
  });

  console.log(`Initialized provider: ${cashfree.name}`);
  console.log(`Capabilities: ${cashfree.capabilities.join(', ')}`);
  console.log(`Base URL: ${cashfree.baseUrl}`);
  console.log(`Test Mode: ${cashfree.testMode}`);

  // 2. Creating an Order (Generates payment_session_id for Web Checkout SDK v3)
  console.log('\n--- 1. Creating Cashfree Order ---');
  try {
    const orderPayload = {
      amount: 50000, // ₹500.00 in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      customer: {
        id: 'cust_example_101',
        name: 'Alex Johnson',
        email: 'alex@example.com',
        phone: '9876543210'
      },
      notes: {
        plan: 'pro_monthly',
        userId: 'user_101'
      }
    };

    console.log('Creating order with payload:', orderPayload);

    // If live credentials are provided in .env, perform actual API call:
    if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
      const orderResult = await cashfree.createOrder(orderPayload);
      console.log('Order created successfully!');
      console.log('Order ID:', orderResult.data.orderId);
      console.log('Payment Session ID:', orderResult.data.paymentSessionId);
      console.log('Order Amount (₹):', orderResult.data.orderAmount);
    } else {
      console.log('(Skipped live API call: Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to .env to test)');
    }
  } catch (err) {
    console.error('Error creating order:', err.message);
  }

  // 3. Verifying Live Order Status
  console.log('\n--- 2. Checking Order Payment Status ---');
  try {
    const sampleOrderId = 'cf_ord_sample_123';
    console.log(`Checking status for order: ${sampleOrderId}`);

    // If live credentials exist:
    // const statusResult = await cashfree.verifyPayment({ orderId: sampleOrderId });
    // console.log('Payment verified:', statusResult.data.verified, 'Status:', statusResult.data.status);
    console.log('(Skipped live status API call in example placeholder mode)');
  } catch (err) {
    console.error('Error checking status:', err.message);
  }

  // 4. Webhook Signature Verification
  console.log('\n--- 3. Webhook Signature Verification ---');
  try {
    const samplePayload = JSON.stringify({
      data: {
        order: { order_id: 'order_123', order_amount: 500.0 },
        payment: { payment_status: 'SUCCESS', cf_payment_id: 'pay_987654' }
      },
      event_time: '2026-10-08T18:00:00Z',
      type: 'PAYMENT_SUCCESS_WEBHOOK'
    });

    // In an Express webhook handler:
    // const signature = req.headers['x-webhook-signature'];
    // const timestamp = req.headers['x-webhook-timestamp'];
    // const result = await cashfree.verifyWebhook({
    //   payload: req.body, // raw string or Buffer
    //   signature,
    //   timestamp
    // });
    console.log('Cashfree verifies webhooks using x-webhook-signature and x-webhook-timestamp headers.');
  } catch (err) {
    console.error('Error verifying webhook:', err.message);
  }
}

main().catch(console.error);
