import * as rootModule from '../../src/index.js';
import * as paymentsModule from '../../src/payments/index.js';
import * as emailModule from '../../src/email/index.js';
import * as smsModule from '../../src/sms/index.js';
import * as storageModule from '../../src/storage/index.js';

import {
  IntegrationError,
  ValidationError,
  createPaymentProvider,
  createEmailProvider,
  createSMSProvider,
  createStorageProvider,
  RazorpayProvider,
  StripeProvider,
  CCAvenueProvider,
  ResendProvider,
  NodemailerProvider,
  SESProvider,
  MSG91Provider,
  MessageBirdProvider,
  CloudinaryProvider,
  S3Provider
} from '../../src/index.js';

describe('Phase 19: API Contract & Regression Hardening', () => {
  describe('1. Exact Export Inventory & Regression Detection', () => {
    it('Root package must match exact expected public exports list', () => {
      const actualRootExports = Object.keys(rootModule).sort();
      const expectedRootExports = [
        'CCAvenueProvider',
        'CloudinaryProvider',
        'EmailProvider',
        'IntegrationError',
        'MSG91Provider',
        'MessageBirdProvider',
        'NodemailerProvider',
        'PaymentProvider',
        'RazorpayProvider',
        'ResendProvider',
        'S3Provider',
        'SESProvider',
        'SMSProvider',
        'StorageProvider',
        'StripeProvider',
        'ValidationError',
        'ccavenueCrypto',
        'createEmailProvider',
        'createPaymentProvider',
        'createSMSProvider',
        'createStorageProvider',
        'validateAmountInSmallestUnit',
        'validateEmail',
        'validateEmailRecipients',
        'validateMobileNumber',
        'validateMobileRecipients',
        'validateRawPayload',
        'validateRequiredObject',
        'validateRequiredString'
      ].sort();

      expect(actualRootExports).toEqual(expectedRootExports);
    });

    it('mern-integrations/payments subpath must match exact expected exports list', () => {
      const actualPaymentsExports = Object.keys(paymentsModule).sort();
      const expectedPaymentsExports = [
        'CCAvenueProvider',
        'PaymentProvider',
        'RazorpayProvider',
        'StripeProvider',
        'ccavenueCrypto',
        'createPaymentProvider'
      ].sort();

      expect(actualPaymentsExports).toEqual(expectedPaymentsExports);
    });

    it('mern-integrations/email subpath must match exact expected exports list', () => {
      const actualEmailExports = Object.keys(emailModule).sort();
      const expectedEmailExports = [
        'EmailProvider',
        'NodemailerProvider',
        'ResendProvider',
        'SESProvider',
        'createEmailProvider'
      ].sort();

      expect(actualEmailExports).toEqual(expectedEmailExports);
    });

    it('mern-integrations/sms subpath must match exact expected exports list', () => {
      const actualSMSExports = Object.keys(smsModule).sort();
      const expectedSMSExports = [
        'MSG91Provider',
        'MessageBirdProvider',
        'SMSProvider',
        'createSMSProvider'
      ].sort();

      expect(actualSMSExports).toEqual(expectedSMSExports);
    });

    it('mern-integrations/storage subpath must match exact expected exports list', () => {
      const actualStorageExports = Object.keys(storageModule).sort();
      const expectedStorageExports = [
        'CloudinaryProvider',
        'S3Provider',
        'StorageProvider',
        'createStorageProvider'
      ].sort();

      expect(actualStorageExports).toEqual(expectedStorageExports);
    });
  });

  describe('2. Provider Capabilities & Method Parity Audit', () => {
    const providerCapabilityMap = [
      {
        name: 'Razorpay',
        instance: new RazorpayProvider({ keyId: 'rzp_test_123', keySecret: 'secret_123' }),
        expectedCapabilities: ['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook'],
        methodChecks: {
          createOrder: 'function',
          initiatePayment: 'function',
          verifyPayment: 'function',
          verifyCallback: 'function',
          refund: 'function',
          verifyWebhook: 'function'
        }
      },
      {
        name: 'Stripe',
        instance: new StripeProvider({ secretKey: 'sk_test_123' }),
        expectedCapabilities: ['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook'],
        methodChecks: {
          createOrder: 'function',
          initiatePayment: 'function',
          verifyPayment: 'function',
          verifyCallback: 'function',
          refund: 'function',
          verifyWebhook: 'function'
        }
      },
      {
        name: 'CCAvenue',
        instance: new CCAvenueProvider({ merchantId: 'm_1', accessCode: 'a_1', workingKey: '0123456789ABCDEF0123456789ABCDEF' }),
        expectedCapabilities: ['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'parseEncryptedResponse'],
        methodChecks: {
          createOrder: 'function',
          initiatePayment: 'function',
          verifyPayment: 'function',
          verifyCallback: 'function',
          parseEncryptedResponse: 'function'
        }
      },
      {
        name: 'Resend',
        instance: new ResendProvider({ apiKey: 're_123' }),
        expectedCapabilities: ['send'],
        methodChecks: {
          send: 'function'
        }
      },
      {
        name: 'Nodemailer',
        instance: new NodemailerProvider({ host: 'smtp.test.com', port: 587, auth: { user: 'u', pass: 'p' } }),
        expectedCapabilities: ['send', 'verify'],
        methodChecks: {
          send: 'function',
          verify: 'function'
        }
      },
      {
        name: 'Amazon SES',
        instance: new SESProvider({ accessKeyId: 'k', secretAccessKey: 's', region: 'us-east-1' }),
        expectedCapabilities: ['send'],
        methodChecks: {
          send: 'function'
        }
      },
      {
        name: 'MSG91',
        instance: new MSG91Provider({ authKey: 'k_123' }),
        expectedCapabilities: ['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp'],
        methodChecks: {
          sendSMS: 'function',
          sendOTP: 'function',
          verifyOTP: 'function',
          resendOTP: 'function',
          sendWhatsApp: 'function'
        }
      },
      {
        name: 'MessageBird',
        instance: new MessageBirdProvider({ apiKey: 'k_123' }),
        expectedCapabilities: ['sendSMS', 'sendWhatsApp'],
        methodChecks: {
          sendSMS: 'function',
          sendWhatsApp: 'function'
        }
      },
      {
        name: 'Cloudinary',
        instance: new CloudinaryProvider({ cloudName: 'cn', apiKey: 'ak', apiSecret: 'as' }),
        expectedCapabilities: ['upload', 'uploadBuffer', 'delete', 'getUrl'],
        methodChecks: {
          upload: 'function',
          uploadBuffer: 'function',
          delete: 'function',
          getUrl: 'function'
        }
      },
      {
        name: 'AWS S3',
        instance: new S3Provider({ accessKeyId: 'k', secretAccessKey: 's', region: 'us-east-1', bucket: 'b' }),
        expectedCapabilities: ['upload', 'uploadBuffer', 'uploadStream', 'delete', 'getUrl'],
        methodChecks: {
          upload: 'function',
          uploadBuffer: 'function',
          uploadStream: 'function',
          delete: 'function',
          getUrl: 'function'
        }
      }
    ];

    test.each(providerCapabilityMap)('$name capabilities match expected array and methods', ({ instance, expectedCapabilities, methodChecks }) => {
      expect(instance.capabilities).toEqual(expectedCapabilities);
      expect(Object.isFrozen(instance.capabilities)).toBe(true);

      for (const [methodName, expectedType] of Object.entries(methodChecks)) {
        expect(typeof instance[methodName]).toBe(expectedType);
      }
    });
  });

  describe('3. Configuration Immutability & Secret Redaction', () => {
    it('Factories should accept frozen configuration objects without error or mutation', () => {
      const razorpayConfig = Object.freeze({
        provider: 'razorpay',
        keyId: 'rzp_test_123',
        keySecret: 'secret_123'
      });
      const razorpay = createPaymentProvider(razorpayConfig);
      expect(razorpay).toBeInstanceOf(RazorpayProvider);

      const emailConfig = Object.freeze({
        provider: 'resend',
        apiKey: 're_123'
      });
      const email = createEmailProvider(emailConfig);
      expect(email).toBeInstanceOf(ResendProvider);

      const smsConfig = Object.freeze({
        provider: 'msg91',
        authKey: 'auth_123'
      });
      const sms = createSMSProvider(smsConfig);
      expect(sms).toBeInstanceOf(MSG91Provider);

      const storageConfig = Object.freeze({
        provider: 'cloudinary',
        cloudName: 'demo',
        apiKey: '123',
        apiSecret: 'sec'
      });
      const storage = createStorageProvider(storageConfig);
      expect(storage).toBeInstanceOf(CloudinaryProvider);
    });

    it('Providers should never expose private credentials in Object.keys or JSON.stringify', () => {
      const razorpay = new RazorpayProvider({ keyId: 'rzp_test_123', keySecret: 'secret_123', webhookSecret: 'whsec_123' });
      const stripe = new StripeProvider({ secretKey: 'sk_test_123', webhookSecret: 'whsec_456' });
      const ccavenue = new CCAvenueProvider({ merchantId: 'm1', accessCode: 'ac1', workingKey: 'wk1' });
      const resend = new ResendProvider({ apiKey: 're_secret_key' });
      const ses = new SESProvider({ accessKeyId: 'AKIA_KEY', secretAccessKey: 'SECRET_ACCESS_KEY', region: 'us-east-1' });
      const cloudinary = new CloudinaryProvider({ cloudName: 'cn', apiKey: 'ak', apiSecret: 'SECRET_API_SECRET' });
      const s3 = new S3Provider({ accessKeyId: 'AKIA_KEY', secretAccessKey: 'SECRET_KEY', region: 'us-east-1', bucket: 'b' });

      const providers = [razorpay, stripe, ccavenue, resend, ses, cloudinary, s3];

      for (const p of providers) {
        const keys = Object.keys(p);
        expect(keys).not.toContain('keySecret');
        expect(keys).not.toContain('secretKey');
        expect(keys).not.toContain('workingKey');
        expect(keys).not.toContain('apiKey');
        expect(keys).not.toContain('secretAccessKey');
        expect(keys).not.toContain('apiSecret');
        expect(keys).not.toContain('webhookSecret');

        const json = JSON.stringify(p);
        expect(json).not.toContain('secret_123');
        expect(json).not.toContain('sk_test_123');
        expect(json).not.toContain('whsec_123');
        expect(json).not.toContain('SECRET_ACCESS_KEY');
        expect(json).not.toContain('SECRET_API_SECRET');
      }
    });

    it('provider.capabilities should be frozen against external modification', () => {
      const razorpay = new RazorpayProvider({ keyId: 'rzp_test_123', keySecret: 'secret_123' });
      expect(() => {
        razorpay.capabilities.push('fakeCapability');
      }).toThrow();
    });
  });

  describe('4. Error Contract Stability & Properties', () => {
    it('IntegrationError should set standard properties and defaults', () => {
      const err = new IntegrationError('Payment processing failed', {
        code: 'PAYMENT_FAILED',
        statusCode: 402,
        provider: 'stripe',
        details: { declineCode: 'insufficient_funds' }
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(IntegrationError);
      expect(err.name).toBe('IntegrationError');
      expect(err.message).toBe('Payment processing failed');
      expect(err.code).toBe('PAYMENT_FAILED');
      expect(err.statusCode).toBe(402);
      expect(err.provider).toBe('stripe');
      expect(err.details).toEqual({ declineCode: 'insufficient_funds' });
    });

    it('ValidationError should inherit IntegrationError with 400 statusCode and VALIDATION_ERROR code', () => {
      const err = new ValidationError('Field email is invalid', {
        provider: 'resend',
        details: { field: 'email', received: 'invalid' }
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(IntegrationError);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.name).toBe('ValidationError');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.statusCode).toBe(400);
      expect(err.provider).toBe('resend');
      expect(err.details).toEqual({ field: 'email', received: 'invalid' });
    });
  });

  describe('5. Consumer Backward Compatibility Flows', () => {
    it('Payments: handles invalid inputs with ValidationError before SDK invocation', async () => {
      const razorpay = createPaymentProvider({
        provider: 'razorpay',
        keyId: 'rzp_test_123',
        keySecret: 'secret_123'
      });

      await expect(razorpay.createOrder({})).rejects.toThrow(ValidationError);
      await expect(razorpay.verifyPayment({})).rejects.toThrow(ValidationError);
      await expect(razorpay.verifyWebhook({})).rejects.toThrow(ValidationError);
    });

    it('Email: handles invalid recipients with ValidationError before SDK invocation', async () => {
      const resend = createEmailProvider({
        provider: 'resend',
        apiKey: 're_123'
      });

      await expect(resend.send({ from: '', to: 'a@b.com', subject: 'hi' })).rejects.toThrow(ValidationError);
      await expect(resend.send({ from: 'a@b.com', to: '', subject: 'hi' })).rejects.toThrow(ValidationError);
      await expect(resend.send({ from: 'a@b.com', to: 'invalid-email', subject: 'hi' })).rejects.toThrow(ValidationError);
    });

    it('SMS: handles invalid recipients with ValidationError before fetch invocation', async () => {
      const msg91 = createSMSProvider({
        provider: 'msg91',
        authKey: 'auth_123'
      });

      await expect(msg91.sendSMS({ to: '123', message: 'Hello' })).rejects.toThrow(ValidationError);
      await expect(msg91.sendOTP({ to: 'invalid' })).rejects.toThrow(ValidationError);
    });

    it('Storage: handles invalid file/buffer inputs with ValidationError before SDK invocation', async () => {
      const cloudinary = createStorageProvider({
        provider: 'cloudinary',
        cloudName: 'cn',
        apiKey: 'ak',
        apiSecret: 'as'
      });

      await expect(cloudinary.upload({ file: '' })).rejects.toThrow(ValidationError);
      await expect(cloudinary.uploadBuffer({ buffer: 'not-a-buffer' })).rejects.toThrow(ValidationError);
      await expect(cloudinary.delete({ publicId: '' })).rejects.toThrow(ValidationError);
      expect(() => cloudinary.getUrl({ publicId: '' })).toThrow(ValidationError);
    });
  });
});
