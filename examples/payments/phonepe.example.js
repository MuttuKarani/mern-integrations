import dotenv from 'dotenv';
import { createPaymentProvider, IntegrationError, ValidationError } from '../../src/index.js';

dotenv.config();

/**
 * PhonePe Payment Gateway Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js native crypto and fetch)
 *
 * Environment Variables:
 *   PHONEPE_MERCHANT_ID=PGTESTPAYUAT
 *   PHONEPE_SALT_KEY=099eb0cd-02cf-4e2a-8aca-3e6c6aff0399
 *   PHONEPE_SALT_INDEX=1
 */
async function main() {
  console.log('=== PhonePe Payment Gateway Example ===\n');

  const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
  const saltKey = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
  const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

  // 1. Initialize provider using factory (pointing to sandbox)
  const phonepe = createPaymentProvider({
    provider: 'phonepe',
    merchantId,
    saltKey,
    saltIndex,
    testMode: true
  });

  console.log(`Initialized provider: ${phonepe.name}`);
  console.log(`Capabilities: ${phonepe.capabilities.join(', ')}`);

  // 2. Creating an Order / Payment Page Initiation
  console.log('\n--- 1. Creating Order (Pay Page Initiation) ---');
  try {
    const orderPayload = {
      amount: 50000, // ₹500.00 in paise
      currency: 'INR',
      redirectUrl: 'https://myapp.com/payment/return',
      callbackUrl: 'https://myapp.com/api/webhooks/phonepe',
      mobileNumber: '9999999999'
    };
    console.log('Order payload:', orderPayload);

    // In production:
    // const orderResult = await phonepe.createOrder(orderPayload);
    // console.log('Redirect customer to:', orderResult.data.redirectUrl);
    console.log('(Skipped live API call in example placeholder mode)');
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3. Verifying Live Transaction Status
  console.log('\n--- 2. Checking Transaction Status ---');
  try {
    const transactionId = 'MT_SAMPLE_123456';
    console.log(`Checking status for: ${transactionId}`);

    // In production:
    // const statusResult = await phonepe.verifyPayment({ merchantTransactionId: transactionId });
    // console.log('Payment status:', statusResult.data.status, 'Verified:', statusResult.data.verified);
    console.log('(Skipped live API call in example placeholder mode)');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);
