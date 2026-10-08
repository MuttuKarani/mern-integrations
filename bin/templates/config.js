/**
 * config.js Template Generator for mern-integrations CLI
 */

export function generateConfigTemplate(options = {}) {
  const imports = [];
  const instances = [];

  const payments = Array.isArray(options.payments) ? options.payments : [];
  const middlewares = Array.isArray(options.middlewares) ? options.middlewares : [];

  if (payments.length > 0) imports.push('createPaymentProvider');
  if (options.email) imports.push('createEmailProvider');
  if (options.sms) imports.push('createSMSProvider');
  if (options.storage) imports.push('createStorageProvider');
  if (middlewares.includes('idempotency')) imports.push('InMemoryIdempotencyStore');

  // Fallback import if nothing chosen
  if (imports.length === 0) {
    return `// No providers selected. Run 'npx mern-integrations init' to configure providers.\nexport {};\n`;
  }

  // 1. Payment providers
  for (const p of payments) {
    if (p === 'cashfree') {
      instances.push(`
// Cashfree Payment Provider
export const cashfree = createPaymentProvider({
  provider: 'cashfree',
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  testMode: (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase() === 'SANDBOX',
  apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01'
});`);
    } else if (p === 'phonepe') {
      instances.push(`
// PhonePe Payment Provider
export const phonepe = createPaymentProvider({
  provider: 'phonepe',
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX,
  callbackUrl: process.env.PHONEPE_CALLBACK_URL
});`);
    } else if (p === 'razorpay') {
      instances.push(`
// Razorpay Payment Provider
export const razorpay = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});`);
    } else if (p === 'stripe') {
      instances.push(`
// Stripe Payment Provider
export const stripe = createPaymentProvider({
  provider: 'stripe',
  apiKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});`);
    } else if (p === 'ccavenue') {
      instances.push(`
// CCAvenue Payment Provider
export const ccavenue = createPaymentProvider({
  provider: 'ccavenue',
  merchantId: process.env.CCAVENUE_MERCHANT_ID,
  accessCode: process.env.CCAVENUE_ACCESS_CODE,
  workingKey: process.env.CCAVENUE_WORKING_KEY,
  redirectUrl: process.env.CCAVENUE_REDIRECT_URL,
  cancelUrl: process.env.CCAVENUE_CANCEL_URL
});`);
    }
  }

  // 2. Email provider
  if (options.email === 'resend') {
    instances.push(`
// Resend Email Provider
export const email = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});`);
  } else if (options.email === 'nodemailer') {
    instances.push(`
// Nodemailer SMTP Provider
export const email = createEmailProvider({
  provider: 'nodemailer',
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});`);
  } else if (options.email === 'ses') {
    instances.push(`
// Amazon SES Provider
export const email = createEmailProvider({
  provider: 'ses',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});`);
  }

  // 3. SMS provider
  if (options.sms === 'twilio') {
    instances.push(`
// Twilio SMS & OTP Provider
export const sms = createSMSProvider({
  provider: 'twilio',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
  verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID
});`);
  } else if (options.sms === 'msg91') {
    instances.push(`
// MSG91 SMS Provider
export const sms = createSMSProvider({
  provider: 'msg91',
  authKey: process.env.MSG91_AUTH_KEY,
  senderId: process.env.MSG91_SENDER_ID,
  templateId: process.env.MSG91_TEMPLATE_ID
});`);
  } else if (options.sms === 'messagebird') {
    instances.push(`
// MessageBird SMS & WhatsApp Provider
export const sms = createSMSProvider({
  provider: 'messagebird',
  apiKey: process.env.MESSAGEBIRD_API_KEY,
  originator: process.env.MESSAGEBIRD_ORIGINATOR
});`);
  }

  // 4. Storage provider
  if (options.storage === 'cloudinary') {
    instances.push(`
// Cloudinary Storage Provider
export const storage = createStorageProvider({
  provider: 'cloudinary',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET
});`);
  } else if (options.storage === 's3') {
    instances.push(`
// AWS S3 Storage Provider
export const storage = createStorageProvider({
  provider: 's3',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET
});`);
  }

  // 5. Idempotency store
  if (middlewares.includes('idempotency')) {
    instances.push(`
// Zero-dependency LRU + TTL Idempotency Store (Pluggable with Redis)
export const idempotencyStore = new InMemoryIdempotencyStore({
  maxEntries: 10000,
  defaultTtlMs: 24 * 60 * 60 * 1000 // 24 hours
});`);
  }

  const code = `/**
 * Integration Services Configuration
 * Auto-generated by: npx mern-integrations init
 */

import {
  ${imports.join(',\n  ')}
} from 'mern-integrations';
${instances.join('\n')}
`;

  return code;
}
