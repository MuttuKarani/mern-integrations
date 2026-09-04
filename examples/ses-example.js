import dotenv from 'dotenv';
import { createEmailProvider, SESProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the Amazon SES email provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== Amazon SES Email Provider Example ===\n');

  // 1. Initialize Amazon SES provider via factory or direct instantiation
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE';
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const region = process.env.AWS_SES_REGION || 'us-east-1';
  const configurationSetName = process.env.AWS_SES_CONFIGURATION_SET || null;

  // Factory initialization
  const emailProvider = createEmailProvider({
    provider: 'ses',
    accessKeyId,
    secretAccessKey,
    region,
    configurationSetName
  });

  console.log(`Initialized provider: ${emailProvider.name}`);

  // 2. Build email payload
  const emailPayload = {
    from: 'My MERN App <verified-sender@example.com>',
    to: 'customer@example.com',
    cc: 'team@example.com',
    bcc: 'audit@example.com',
    replyTo: 'support@example.com',
    subject: 'Welcome to our platform!',
    html: '<h1>Welcome!</h1><p>Thank you for signing up for our platform with Amazon SES.</p>',
    text: 'Welcome! Thank you for signing up for our platform with Amazon SES.',
    tags: [
      { name: 'Environment', value: 'Production' },
      { name: 'Category', value: 'Onboarding' }
    ]
  };

  console.log('\nPrepared Email Payload:', JSON.stringify(emailPayload, null, 2));

  // 3. Check for placeholder keys to avoid unexpected AWS API calls during dry-run
  const isPlaceholder =
    !process.env.AWS_SES_ACCESS_KEY_ID ||
    accessKeyId.includes('EXAMPLE') ||
    secretAccessKey.includes('EXAMPLEKEY') ||
    accessKeyId.includes('placeholder');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live AWS SES API call because AWS SES credentials are not configured or are placeholders.'
    );
    console.log('[INFO] In production with verified identities in Amazon SES, calling:');
    console.log('       const result = await emailProvider.send(emailPayload);');
    console.log('       Expected Result: { success: true, provider: "ses", data: { id: "0100017e-9821-4a3b-b892-123456789abc-000000" } }');
    console.log('\n=== Amazon SES Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const result = await emailProvider.send(emailPayload);
    console.log('\nEmail Transmission Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('\nValidation failed:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('\nSES email delivery error:', error.toJSON());
    } else {
      console.error('\nUnexpected error:', error);
    }
  }

  console.log('\n=== Amazon SES Example Run Complete ===');
}

runExample().catch(console.error);
