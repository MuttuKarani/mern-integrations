import dotenv from 'dotenv';
import { createPaymentProvider, ccavenueCrypto, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the CCAvenue provider inside an Express / MERN backend.
 */
async function runExample() {
  console.log('=== CCAvenue Provider Example ===\n');

  // 1. Initialize CCAvenue provider using factory
  const merchantId = process.env.CCAVENUE_MERCHANT_ID || '2123456';
  const accessCode = process.env.CCAVENUE_ACCESS_CODE || 'AVTESTACCESS1234';
  const workingKey = process.env.CCAVENUE_WORKING_KEY || '2E64FE1D9A75E4D89C4C66C3E4C86731';

  const payment = createPaymentProvider({
    provider: 'ccavenue',
    merchantId,
    accessCode,
    workingKey,
    testMode: true
  });

  console.log(`Initialized provider: ${payment.name}`);

  // 2. Initiating a payment (e.g. in Express POST /api/payments/ccavenue/initiate)
  console.log('\n--- 1. Initiating Payment (Generating Redirect Descriptor) ---');
  try {
    // IMPORTANT: Amount must strictly be passed in integer paise for INR (₹150.00 = 15000 paise)
    const initiationResult = await payment.initiatePayment({
      orderId: `ORDER_${Date.now()}`,
      amount: 15000, // 15000 paise = ₹150.00
      currency: 'INR',
      redirectUrl: 'https://myshop.com/api/payments/ccavenue/callback',
      cancelUrl: 'https://myshop.com/api/payments/ccavenue/cancel',
      billing: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        tel: '9876543210',
        address: '123 Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        zip: '560001',
        country: 'India'
      }
    });

    console.log('Payment Initiation Result:', JSON.stringify(initiationResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation failed:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('Provider error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // 3. Handling Browser POST Callback (e.g. in Express POST /api/payments/ccavenue/callback)
  console.log('\n--- 2. Verifying Encrypted Callback (Redirect Response) ---');
  try {
    // Simulated CCAvenue encrypted response payload
    const mockCallbackQuery =
      'order_id=ORDER_1788521000&tracking_id=31000998877&bank_ref_no=HDFC987654&order_status=Success&failure_message=&payment_mode=Credit+Card&card_name=Visa&currency=INR&amount=150.00';

    const encResp = ccavenueCrypto.encrypt(mockCallbackQuery, workingKey);

    const verificationResult = await payment.verifyCallback({ encResp });

    console.log('Callback Verification Result:', JSON.stringify(verificationResult, null, 2));
  } catch (error) {
    console.error('Callback verification failed:', error);
  }

  console.log('\n=== CCAvenue Example Run Complete ===');
}

runExample().catch(console.error);
