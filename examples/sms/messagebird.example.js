import dotenv from 'dotenv';
import { createSMSProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * MessageBird SMS & WhatsApp Provider Example
 *
 * Requirements:
 *   npm install mern-integrations
 *   (Zero external dependencies! Uses Node.js native fetch)
 *
 * Environment Variables:
 *   MESSAGEBIRD_API_KEY=...
 *   MESSAGEBIRD_ORIGINATOR=...
 *   MESSAGEBIRD_CHANNEL_ID=...
 */
async function main() {
  console.log('=== MessageBird SMS & WhatsApp Provider Example ===\n');

  // 1. Initialize provider using factory
  const apiKey = process.env.MESSAGEBIRD_API_KEY || 'sample_messagebird_api_key_123';
  const originator = process.env.MESSAGEBIRD_ORIGINATOR || 'MyApp';
  const channelId = process.env.MESSAGEBIRD_CHANNEL_ID || 'sample_channel_id_456';

  const sms = createSMSProvider({
    provider: 'messagebird',
    apiKey,
    originator,
    channelId
  });

  console.log(`Initialized provider: ${sms.name}`);
  console.log(`Capabilities: ${sms.capabilities.join(', ')}`);

  // 2. Sending standard SMS
  if (sms.capabilities.includes('sendSMS')) {
    console.log('\n--- 1. Sending Standard SMS ---');
    try {
      const smsPayload = {
        to: '+14155552671',
        message: 'Your verification code is 849201. Do not share this code.'
      };
      console.log('SMS payload:', smsPayload);

      // In production:
      // const result = await sms.sendSMS(smsPayload);
      // console.log('SMS result:', result);
      console.log('(Skipped live API call in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Sending WhatsApp Template Notification
  if (sms.capabilities.includes('sendWhatsApp')) {
    console.log('\n--- 2. Sending WhatsApp Template Notification ---');
    try {
      const whatsappPayload = {
        to: '+14155552671',
        templateName: 'order_update_notification',
        language: 'en_US',
        variables: ['Alex', 'ORDER-9921', 'Out for Delivery']
      };
      console.log('WhatsApp payload:', whatsappPayload);

      // In production:
      // const waResult = await sms.sendWhatsApp(whatsappPayload);
      // console.log('WhatsApp send result:', waResult);
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
