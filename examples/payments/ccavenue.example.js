import dotenv from 'dotenv';
import { createPaymentProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * CCAvenue Payment Provider Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js built-in node:crypto)
 *
 * Environment Variables:
 *   CCAVENUE_MERCHANT_ID=...
 *   CCAVENUE_ACCESS_CODE=...
 *   CCAVENUE_WORKING_KEY=...
 */
async function main() {
  console.log('=== CCAvenue Payment Provider Example ===\n');

  // 1. Initialize provider using factory
  const merchantId = process.env.CCAVENUE_MERCHANT_ID || '123456';
  const accessCode = process.env.CCAVENUE_ACCESS_CODE || 'AVAB01CD23EF45GH';
  const workingKey = process.env.CCAVENUE_WORKING_KEY || '0123456789ABCDEF0123456789ABCDEF';

  const payment = createPaymentProvider({
    provider: 'ccavenue',
    merchantId,
    accessCode,
    workingKey,
    testMode: true
  });

  console.log(`Initialized provider: ${payment.name}`);
  console.log(`Capabilities: ${payment.capabilities.join(', ')}`);

  // 2. Initiating a Payment (Generating Encrypted Redirect Descriptor)
  if (payment.capabilities.includes('initiatePayment')) {
    console.log('\n--- 1. Initiating Payment (Generating Encrypted Form Descriptor) ---');
    try {
      const paymentPayload = {
        amount: 150000, // ₹1,500.00 = 150000 paise
        currency: 'INR',
        orderId: `ORD_${Date.now()}`,
        redirectUrl: 'https://myapp.com/api/payments/ccavenue/callback',
        cancelUrl: 'https://myapp.com/checkout/cancel',
        billingName: 'Jane Doe',
        billingEmail: 'jane@example.com',
        billingTel: '9876543210'
      };

      const descriptor = await payment.initiatePayment(paymentPayload);
      console.log('Payment Gateway Redirect Descriptor:');
      console.log('  Redirect URL:', descriptor.data.redirectUrl);
      console.log('  Access Code:', descriptor.data.fields.access_code);
      console.log('  Encrypted Request (AES-128-CBC):', descriptor.data.fields.encRequest.substring(0, 40) + '...');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Verifying Callback (Decrypting encResp on Return URL)
  if (payment.capabilities.includes('verifyCallback')) {
    console.log('\n--- 2. Verifying and Decrypting Gateway Callback ---');
    try {
      console.log('Express handler example:');
      console.log('  app.post("/api/payments/ccavenue/callback", async (req, res) => {');
      console.log('    const result = await payment.verifyCallback({ encResp: req.body.encResp });');
      console.log('    if (result.data.verified) { /* mark order paid */ }');
      console.log('  });');
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
