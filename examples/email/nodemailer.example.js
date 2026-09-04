import dotenv from 'dotenv';
import { createEmailProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Nodemailer SMTP Email Provider Example
 *
 * Requirements:
 *   npm install mern-integrations nodemailer
 *
 * Environment Variables:
 *   SMTP_HOST=smtp.mailtrap.io
 *   SMTP_PORT=587
 *   SMTP_USER=...
 *   SMTP_PASS=...
 */
async function main() {
  console.log('=== Nodemailer SMTP Email Provider Example ===\n');

  // 1. Initialize provider using factory
  const email = createEmailProvider({
    provider: 'nodemailer',
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
      user: process.env.SMTP_USER || 'sample_smtp_user',
      pass: process.env.SMTP_PASS || 'sample_smtp_password'
    }
  });

  console.log(`Initialized provider: ${email.name}`);
  console.log(`Capabilities: ${email.capabilities.join(', ')}`);

  // 2. Verifying SMTP Connection
  if (email.capabilities.includes('verify')) {
    console.log('\n--- 1. Verifying SMTP Server Connection ---');
    try {
      console.log('Verifying SMTP credentials and handshake...');
      // In production with real SMTP server:
      // const verification = await email.verify();
      // console.log('SMTP verification result:', verification);
      console.log('(Skipped live network connection in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Sending Email with Attachments
  if (email.capabilities.includes('send')) {
    console.log('\n--- 2. Sending Email via SMTP ---');
    try {
      const emailPayload = {
        from: '"Support Team" <support@myapp.com>',
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Monthly Invoice & Summary',
        html: '<p>Attached is your invoice for this month.</p>',
        text: 'Attached is your invoice for this month.',
        attachments: [
          {
            filename: 'summary.txt',
            content: 'Thank you for your business!'
          }
        ]
      };
      console.log('Email payload:', emailPayload);

      // In production:
      // const result = await email.send(emailPayload);
      // console.log('Email sent, id:', result.data.id);
      console.log('(Skipped live SMTP send in placeholder mode)');
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
