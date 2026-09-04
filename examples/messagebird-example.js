import dotenv from 'dotenv';
import { createSMSProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the MessageBird WhatsApp and SMS provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== MessageBird WhatsApp & SMS Provider Example ===\n');

  // 1. Initialize MessageBird provider using factory
  const apiKey = process.env.MESSAGEBIRD_API_KEY || 'sample_messagebird_api_key_123';
  const channelId = process.env.MESSAGEBIRD_CHANNEL_ID || 'sample_channel_id_456';
  const namespace = process.env.MESSAGEBIRD_NAMESPACE || 'sample_namespace_789';

  const messagebird = createSMSProvider({
    provider: 'messagebird',
    apiKey,
    channelId,
    namespace
  });

  console.log(`Initialized provider: ${messagebird.name}`);

  // 2. Prepare sample WhatsApp Template (HSM) Payload
  const sampleMobile = '31612345678'; // International format
  const sampleTemplate = 'order_status_update';

  console.log('\n--- 1. Send WhatsApp HSM Template Payload ---');
  const whatsAppPayload = {
    to: sampleMobile,
    templateName: sampleTemplate,
    variables: ['Alex Customer', 'ORD-100234']
  };
  console.log(JSON.stringify(whatsAppPayload, null, 2));

  // 3. Prepare sample SMS Payload
  console.log('\n--- 2. Send SMS Payload ---');
  const smsPayload = {
    to: sampleMobile,
    message: 'Your verification code is 456789.',
    originator: 'MYMERN'
  };
  console.log(JSON.stringify(smsPayload, null, 2));

  // 4. Dry-run safety check
  const isPlaceholder =
    !process.env.MESSAGEBIRD_API_KEY ||
    apiKey.includes('sample') ||
    apiKey.includes('placeholder') ||
    apiKey.includes('mock');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live MessageBird API calls because MESSAGEBIRD_API_KEY is not configured or is a placeholder.'
    );
    console.log('[INFO] In production with valid credentials and approved WhatsApp templates, call:');
    console.log('       1. const waResult = await messagebird.sendWhatsApp(whatsAppPayload);');
    console.log('          Result: { success: true, provider: "messagebird", data: { id: "...", status: "pending", recipients: "31612345678" } }');
    console.log('       2. const smsResult = await messagebird.sendSMS(smsPayload);');
    console.log('          Result: { success: true, provider: "messagebird", data: { id: "...", status: "sent", recipients: "31612345678" } }');
    console.log('\n=== MessageBird Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const waResult = await messagebird.sendWhatsApp(whatsAppPayload);
    console.log('\nSend WhatsApp Result:', JSON.stringify(waResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('Provider error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
  }

  console.log('\n=== MessageBird Example Run Complete ===');
}

runExample().catch(console.error);
