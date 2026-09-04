import dotenv from 'dotenv';
import { createSMSProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * MSG91 SMS & OTP Provider Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js native fetch)
 *
 * Environment Variables:
 *   MSG91_AUTH_KEY=...
 *   MSG91_SENDER_ID=...
 *   MSG91_TEMPLATE_ID=...
 *   MSG91_OTP_TEMPLATE_ID=...
 */
async function main() {
  console.log('=== MSG91 SMS & OTP Provider Example ===\n');

  // 1. Initialize provider using factory
  const authKey = process.env.MSG91_AUTH_KEY || 'sample_msg91_auth_key_123';
  const senderId = process.env.MSG91_SENDER_ID || 'MYAPPN';
  const defaultTemplateId = process.env.MSG91_TEMPLATE_ID || 'template_101';
  const otpTemplateId = process.env.MSG91_OTP_TEMPLATE_ID || 'otp_template_202';

  const sms = createSMSProvider({
    provider: 'msg91',
    authKey,
    senderId,
    defaultTemplateId,
    otpTemplateId
  });

  console.log(`Initialized provider: ${sms.name}`);
  console.log(`Capabilities: ${sms.capabilities.join(', ')}`);

  // 2. Sending SMS via Flow API
  if (sms.capabilities.includes('sendSMS')) {
    console.log('\n--- 1. Sending Flow SMS ---');
    try {
      const smsPayload = {
        to: '+919876543210',
        templateId: defaultTemplateId,
        variables: {
          userName: 'Alex',
          orderStatus: 'Shipped'
        }
      };
      console.log('SMS payload:', smsPayload);

      // In production:
      // const result = await sms.sendSMS(smsPayload);
      // console.log('SMS sent:', result);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Sending OTP
  if (sms.capabilities.includes('sendOTP')) {
    console.log('\n--- 2. Sending OTP ---');
    try {
      const otpPayload = {
        to: '+919876543210',
        otpLength: 6,
        otpExpiry: 10 // minutes
      };
      console.log('OTP payload:', otpPayload);

      // In production:
      // const otpResponse = await sms.sendOTP(otpPayload);
      // console.log('OTP sent, request id / data:', otpResponse);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 4. Verifying OTP
  if (sms.capabilities.includes('verifyOTP')) {
    console.log('\n--- 3. Verifying OTP ---');
    try {
      console.log('Verifying OTP code "123456" for mobile "+919876543210"...');
      // In production:
      // const verifyResponse = await sms.verifyOTP({ to: '+919876543210', otp: '123456' });
      // console.log('Verification response:', verifyResponse);
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
