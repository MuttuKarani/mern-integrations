import dotenv from 'dotenv';
import { createEmailProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the Resend email provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== Resend Email Provider Example ===\n');

  // 1. Initialize Resend provider using factory
  const apiKey = process.env.RESEND_API_KEY || 're_placeholder_sampleKey123';

  const emailProvider = createEmailProvider({
    provider: 'resend',
    apiKey
  });

  console.log(`Initialized provider: ${emailProvider.name}`);

  // 2. Build email payload
  // NOTE: For production, sender domains must be configured and verified in your Resend Dashboard.
  const emailPayload = {
    from: 'My MERN App <noreply@yourdomain.com>',
    to: 'customer@example.com',
    subject: 'Welcome to our platform!',
    html: '<h1>Welcome!</h1><p>Thank you for signing up for our platform.</p>',
    text: 'Welcome! Thank you for signing up for our platform.',
    replyTo: 'support@yourdomain.com',
    tags: [
      { name: 'category', value: 'onboarding' }
    ]
  };

  console.log('\nPrepared Email Payload:', JSON.stringify(emailPayload, null, 2));

  // 3. Check for placeholder keys to avoid accidental network errors during local dry-run
  const isPlaceholder =
    !process.env.RESEND_API_KEY ||
    apiKey.includes('placeholder') ||
    apiKey.includes('sampleKey');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live Resend API call because RESEND_API_KEY is not configured or is a placeholder.'
    );
    console.log('[INFO] In production with verified domains and valid API key, calling:');
    console.log('       const result = await emailProvider.send(emailPayload);');
    console.log('       Expected Result: { success: true, provider: "resend", data: { id: "email_id_123" } }');
    console.log('\n=== Resend Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const result = await emailProvider.send(emailPayload);
    console.log('\nEmail Transmission Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('\nValidation failed:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('\nEmail delivery error:', error.toJSON());
    } else {
      console.error('\nUnexpected error:', error);
    }
  }

  console.log('\n=== Resend Example Run Complete ===');
}

runExample().catch(console.error);
