import dotenv from 'dotenv';
import { createEmailProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Amazon Simple Email Service (SES) Provider Example
 *
 * Requirements:
 *   npm install mern-integrations @aws-sdk/client-ses
 *
 * Environment Variables:
 *   AWS_ACCESS_KEY_ID=AKIA...
 *   AWS_SECRET_ACCESS_KEY=...
 *   AWS_REGION=us-east-1
 *   AWS_SES_CONFIG_SET=my-config-set
 */
async function main() {
  console.log('=== Amazon SES Email Provider Example ===\n');

  // 1. Initialize provider using factory
  const email = createEmailProvider({
    provider: 'ses',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAEXAMPLE12345',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'sampleSecretAccessKey67890',
    region: process.env.AWS_REGION || 'us-east-1',
    configurationSetName: process.env.AWS_SES_CONFIG_SET || undefined
  });

  console.log(`Initialized provider: ${email.name}`);
  console.log(`Capabilities: ${email.capabilities.join(', ')}`);

  // 2. Sending Email via Amazon SES v3
  if (email.capabilities.includes('send')) {
    console.log('\n--- 1. Sending Email via Amazon SES ---');
    try {
      const emailPayload = {
        from: 'Verified Sender <sender@verifieddomain.com>',
        to: 'customer@example.com',
        subject: 'Security Alert: New Sign-in Detected',
        html: '<h2>Security Alert</h2><p>A new sign-in was detected on your account.</p>',
        text: 'Security Alert: A new sign-in was detected on your account.',
        tags: [
          { name: 'notification_type', value: 'security_alert' }
        ]
      };
      console.log('Email payload:', emailPayload);

      // In production:
      // const response = await email.send(emailPayload);
      // console.log('Email sent, MessageId:', response.data.id);
      console.log('(Skipped live AWS API call in placeholder mode)');
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
