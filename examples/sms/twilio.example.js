import dotenv from 'dotenv';
import { createSMSProvider, IntegrationError, ValidationError } from '../../src/index.js';

dotenv.config();

/**
 * Twilio SMS, WhatsApp, and Twilio Verify v2 OTP Provider Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js native fetch)
 *
 * Environment Variables:
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM=+1234567890
 *   TWILIO_VERIFY_SERVICE_SID=VA...
 */
async function main() {
  console.log('=== Twilio SMS, WhatsApp & Verify OTP Example ===\n');

  const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC_sample_account_sid_1234567890';
  const authToken = process.env.TWILIO_AUTH_TOKEN || 'sample_auth_token_1234567890';
  const from = process.env.TWILIO_FROM || '+15005550006';
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA_sample_verify_sid_123';

  // 1. Initialize provider using factory
  const twilio = createSMSProvider({
    provider: 'twilio',
    accountSid,
    authToken,
    from,
    verifyServiceSid
  });

  console.log(`Initialized provider: ${twilio.name}`);
  console.log(`Capabilities: ${twilio.capabilities.join(', ')}`);

  // 2. Sending SMS
  console.log('\n--- 1. Sending SMS ---');
  try {
    const smsPayload = {
      to: '+15005550001',
      message: 'Hello from mern-integrations Twilio provider!'
    };
    console.log('Sending SMS payload:', smsPayload);

    // In production:
    // const result = await twilio.sendSMS(smsPayload);
    // console.log('SMS sent:', result);
    console.log('(Skipped live API call in example placeholder mode)');
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3. Dispatching OTP via Twilio Verify
  console.log('\n--- 2. Sending OTP (Twilio Verify) ---');
  try {
    const otpPayload = {
      to: '+15005550001',
      channel: 'sms'
    };
    console.log('Sending OTP payload:', otpPayload);

    // In production:
    // const otpResult = await twilio.sendOTP(otpPayload);
    // console.log('OTP dispatched:', otpResult);
    console.log('(Skipped live API call in example placeholder mode)');
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 4. Verifying Webhook Signature
  console.log('\n--- 3. Verifying Webhook Signature ---');
  try {
    const isValid = await twilio.verifyWebhook({
      url: 'https://example.com/api/webhooks/twilio',
      params: { From: '+15005550001', Body: 'STOP' },
      signature: 'dummy_signature'
    });
    console.log('Webhook verification result:', isValid);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);
