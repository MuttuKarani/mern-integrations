import dotenv from 'dotenv';
import { createSMSProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the MSG91 SMS & OTP provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== MSG91 SMS & OTP Provider Example ===\n');

  // 1. Initialize MSG91 provider using factory
  const authKey = process.env.MSG91_AUTH_KEY || 'sample_msg91_authkey123';
  const baseUrl = process.env.MSG91_BASE_URL || 'https://control.msg91.com';

  const smsProvider = createSMSProvider({
    provider: 'msg91',
    authKey,
    baseUrl
  });

  console.log(`Initialized provider: ${smsProvider.name}`);

  // 2. Prepare sample parameters
  const sampleMobile = '919999999999'; // International mobile format
  const sampleTemplateId = '64188b77d6fc053070634123'; // DLT/Flow Template ID

  console.log('\n--- 1. Send OTP Request Payload ---');
  const otpPayload = {
    mobile: sampleMobile,
    templateId: sampleTemplateId,
    otpLength: 6,
    expiry: 10 // 10 minutes
  };
  console.log(JSON.stringify(otpPayload, null, 2));

  console.log('\n--- 2. Send SMS Request Payload ---');
  const smsPayload = {
    to: sampleMobile,
    message: 'Your verification code is 123456. Valid for 10 minutes.',
    templateId: sampleTemplateId,
    senderId: 'MYMERN'
  };
  console.log(JSON.stringify(smsPayload, null, 2));

  // 3. Dry-run safety check
  const isPlaceholder =
    !process.env.MSG91_AUTH_KEY ||
    authKey.includes('sample') ||
    authKey.includes('placeholder');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live MSG91 API calls because MSG91_AUTH_KEY is not configured or is a placeholder.'
    );
    console.log('[INFO] In production with valid credentials and DLT-approved templates, call:');
    console.log('       1. const otpResult = await smsProvider.sendOTP(otpPayload);');
    console.log('          Result: { success: true, provider: "msg91", data: { requestId: "...", type: "success", mobile: "919999999999" } }');
    console.log('       2. const verifyResult = await smsProvider.verifyOTP({ mobile: "919999999999", otp: "123456" });');
    console.log('          Result: { success: true, provider: "msg91", data: { verified: true, mobile: "919999999999" } }');
    console.log('       3. const smsResult = await smsProvider.sendSMS(smsPayload);');
    console.log('          Result: { success: true, provider: "msg91", data: { requestId: "...", message: "...", recipients: "919999999999" } }');
    console.log('\n=== MSG91 Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const otpResult = await smsProvider.sendOTP(otpPayload);
    console.log('\nSend OTP Result:', JSON.stringify(otpResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('Provider error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
  }

  console.log('\n=== MSG91 Example Run Complete ===');
}

runExample().catch(console.error);
