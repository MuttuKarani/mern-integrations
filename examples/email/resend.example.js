import dotenv from 'dotenv';
import { createEmailProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Resend Email Provider Example
 *
 * Requirements:
 *   npm install mern-integrations resend
 *
 * Environment Variables:
 *   RESEND_API_KEY=re_...
 */
async function main() {
  console.log('=== Resend Email Provider Example ===\n');

  // 1. Initialize provider using factory
  const apiKey = process.env.RESEND_API_KEY || 're_sampleApiKey1234567890';

  const email = createEmailProvider({
    provider: 'resend',
    apiKey
  });

  console.log(`Initialized provider: ${email.name}`);
  console.log(`Capabilities: ${email.capabilities.join(', ')}`);

  // 2. Sending transactional email
  if (email.capabilities.includes('send')) {
    console.log('\n--- 1. Sending Transactional Email ---');
    try {
      const emailPayload = {
        from: 'Acme App <onboarding@resend.dev>',
        to: 'user@example.com',
        subject: 'Welcome to MERN Integrations!',
        html: '<h1>Welcome aboard!</h1><p>Your account is ready.</p>',
        text: 'Welcome aboard! Your account is ready.',
        tags: [
          { name: 'category', value: 'welcome' }
        ]
      };
      console.log('Email payload:', emailPayload);

      // In production with live credentials:
      // const response = await email.send(emailPayload);
      // console.log('Email sent successfully, messageId:', response.data.id);
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
