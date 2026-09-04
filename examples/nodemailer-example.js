import dotenv from 'dotenv';
import { createEmailProvider, NodemailerProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the Nodemailer SMTP provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== Nodemailer Email Provider Example ===\n');

  // 1. Initialize Nodemailer provider via factory or direct instantiation
  const host = process.env.SMTP_HOST || 'smtp.example.com';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || 'smtp_user_placeholder';
  const pass = process.env.SMTP_PASS || 'smtp_pass_placeholder';
  const service = process.env.SMTP_SERVICE || null;

  const emailProvider = createEmailProvider({
    provider: 'nodemailer',
    ...(service ? { service } : { host, port, secure }),
    auth: {
      user,
      pass
    }
  });

  console.log(`Initialized provider: ${emailProvider.name}`);

  // 2. Build email payload
  const emailPayload = {
    from: '"My MERN App" <noreply@example.com>',
    to: 'customer@example.com',
    cc: 'team@example.com',
    bcc: 'archive@example.com',
    replyTo: 'support@example.com',
    subject: 'Welcome to our platform!',
    html: '<h1>Welcome!</h1><p>Thank you for signing up for our platform.</p>',
    text: 'Welcome! Thank you for signing up for our platform.',
    attachments: [
      {
        filename: 'welcome.txt',
        content: 'Thank you for joining our service!'
      }
    ],
    headers: {
      'X-App-Environment': 'production'
    }
  };

  console.log('\nPrepared Email Payload:', JSON.stringify(emailPayload, null, 2));

  // 3. Check for placeholder configuration to avoid network connection attempts during dry-run
  const isPlaceholder =
    !process.env.SMTP_HOST && !process.env.SMTP_SERVICE ||
    user.includes('placeholder') ||
    pass.includes('placeholder') ||
    host.includes('example.com');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live SMTP connection because SMTP credentials are not configured or are placeholders.'
    );
    console.log('[INFO] In production with valid SMTP credentials, call:');
    console.log('       1. const verifyResult = await emailProvider.verify();');
    console.log('          Expected Result: { success: true, provider: "nodemailer", data: { verified: true } }');
    console.log('       2. const sendResult = await emailProvider.send(emailPayload);');
    console.log('          Expected Result: { success: true, provider: "nodemailer", data: { id: "<msg-id@domain>", accepted: [...], ... } }');
    console.log('\n=== Nodemailer Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    console.log('\n--- 1. Verifying SMTP Connection ---');
    const verifyResult = await emailProvider.verify();
    console.log('SMTP Verification Result:', JSON.stringify(verifyResult, null, 2));

    console.log('\n--- 2. Sending Email ---');
    const sendResult = await emailProvider.send(emailPayload);
    console.log('Email Transmission Result:', JSON.stringify(sendResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('\nValidation failed:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('\nEmail delivery error:', error.toJSON());
    } else {
      console.error('\nUnexpected error:', error);
    }
  }

  console.log('\n=== Nodemailer Example Run Complete ===');
}

runExample().catch(console.error);
