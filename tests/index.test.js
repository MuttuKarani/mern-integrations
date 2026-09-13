import {
  IntegrationError,
  ValidationError,
  validateRequiredString,
  validateAmountInSmallestUnit,
  validateRequiredObject,
  validateRawPayload,
  validateEmail,
  validateEmailRecipients,
  validateMobileNumber,
  validateMobileRecipients,
  PaymentProvider,
  RazorpayProvider,
  CCAvenueProvider,
  StripeProvider,
  PhonePeProvider,
  MockPaymentProvider,
  createPaymentProvider,
  ccavenueCrypto,
  EmailProvider,
  ResendProvider,
  NodemailerProvider,
  SESProvider,
  MockEmailProvider,
  createEmailProvider,
  SMSProvider,
  MSG91Provider,
  MessageBirdProvider,
  TwilioProvider,
  MockSMSProvider,
  createSMSProvider,
  StorageProvider,
  CloudinaryProvider,
  S3Provider,
  MockStorageProvider,
  createStorageProvider
} from '../src/index.js';

import * as paymentsModule from '../src/payments/index.js';
import * as emailModule from '../src/email/index.js';
import * as smsModule from '../src/sms/index.js';
import * as storageModule from '../src/storage/index.js';
import * as testingModule from '../src/testing/index.js';

describe('Root Package Exports & Submodules', () => {
  describe('Core Errors and Validators', () => {
    it('should export core error classes', () => {
      expect(IntegrationError).toBeDefined();
      expect(ValidationError).toBeDefined();
      expect(new IntegrationError('test error')).toBeInstanceOf(Error);
      expect(new ValidationError('validation error')).toBeInstanceOf(IntegrationError);
    });

    it('should export validation utilities', () => {
      expect(typeof validateRequiredString).toBe('function');
      expect(typeof validateAmountInSmallestUnit).toBe('function');
      expect(typeof validateRequiredObject).toBe('function');
      expect(typeof validateRawPayload).toBe('function');
      expect(typeof validateEmail).toBe('function');
      expect(typeof validateEmailRecipients).toBe('function');
      expect(typeof validateMobileNumber).toBe('function');
      expect(typeof validateMobileRecipients).toBe('function');
    });
  });

  describe('Payments Module Exports', () => {
    it('should export payment classes, factories, and crypto utilities', () => {
      expect(PaymentProvider).toBeDefined();
      expect(RazorpayProvider).toBeDefined();
      expect(CCAvenueProvider).toBeDefined();
      expect(StripeProvider).toBeDefined();
      expect(PhonePeProvider).toBeDefined();
      expect(MockPaymentProvider).toBeDefined();
      expect(typeof createPaymentProvider).toBe('function');
      expect(ccavenueCrypto).toBeDefined();
      expect(typeof ccavenueCrypto.encrypt).toBe('function');
      expect(typeof ccavenueCrypto.decrypt).toBe('function');
    });

    it('should match submodule exports for payments', () => {
      expect(paymentsModule.PaymentProvider).toBe(PaymentProvider);
      expect(paymentsModule.RazorpayProvider).toBe(RazorpayProvider);
      expect(paymentsModule.CCAvenueProvider).toBe(CCAvenueProvider);
      expect(paymentsModule.StripeProvider).toBe(StripeProvider);
      expect(paymentsModule.PhonePeProvider).toBe(PhonePeProvider);
      expect(paymentsModule.MockPaymentProvider).toBe(MockPaymentProvider);
      expect(paymentsModule.createPaymentProvider).toBe(createPaymentProvider);
    });
  });

  describe('Email Module Exports', () => {
    it('should export email classes and factories', () => {
      expect(EmailProvider).toBeDefined();
      expect(ResendProvider).toBeDefined();
      expect(NodemailerProvider).toBeDefined();
      expect(SESProvider).toBeDefined();
      expect(MockEmailProvider).toBeDefined();
      expect(typeof createEmailProvider).toBe('function');
    });

    it('should match submodule exports for email', () => {
      expect(emailModule.EmailProvider).toBe(EmailProvider);
      expect(emailModule.ResendProvider).toBe(ResendProvider);
      expect(emailModule.NodemailerProvider).toBe(NodemailerProvider);
      expect(emailModule.SESProvider).toBe(SESProvider);
      expect(emailModule.MockEmailProvider).toBe(MockEmailProvider);
      expect(emailModule.createEmailProvider).toBe(createEmailProvider);
    });
  });

  describe('SMS Module Exports', () => {
    it('should export SMS classes and factories', () => {
      expect(SMSProvider).toBeDefined();
      expect(MSG91Provider).toBeDefined();
      expect(MessageBirdProvider).toBeDefined();
      expect(TwilioProvider).toBeDefined();
      expect(MockSMSProvider).toBeDefined();
      expect(typeof createSMSProvider).toBe('function');
    });

    it('should match submodule exports for sms', () => {
      expect(smsModule.SMSProvider).toBe(SMSProvider);
      expect(smsModule.MSG91Provider).toBe(MSG91Provider);
      expect(smsModule.MessageBirdProvider).toBe(MessageBirdProvider);
      expect(smsModule.TwilioProvider).toBe(TwilioProvider);
      expect(smsModule.MockSMSProvider).toBe(MockSMSProvider);
      expect(smsModule.createSMSProvider).toBe(createSMSProvider);
    });
  });

  describe('Storage Module Exports', () => {
    it('should export storage classes and factories', () => {
      expect(StorageProvider).toBeDefined();
      expect(CloudinaryProvider).toBeDefined();
      expect(S3Provider).toBeDefined();
      expect(MockStorageProvider).toBeDefined();
      expect(typeof createStorageProvider).toBe('function');
    });

    it('should match submodule exports for storage', () => {
      expect(storageModule.StorageProvider).toBe(StorageProvider);
      expect(storageModule.CloudinaryProvider).toBe(CloudinaryProvider);
      expect(storageModule.S3Provider).toBe(S3Provider);
      expect(storageModule.MockStorageProvider).toBe(MockStorageProvider);
      expect(storageModule.createStorageProvider).toBe(createStorageProvider);
    });
  });

  describe('Testing Module Exports', () => {
    it('should export all mock providers from testing module', () => {
      expect(testingModule.MockPaymentProvider).toBe(MockPaymentProvider);
      expect(testingModule.MockEmailProvider).toBe(MockEmailProvider);
      expect(testingModule.MockSMSProvider).toBe(MockSMSProvider);
      expect(testingModule.MockStorageProvider).toBe(MockStorageProvider);
    });
  });

  describe('Provider Capabilities Contract', () => {
    it('should expose frozen capabilities array on payment providers', () => {
      const razorpay = new RazorpayProvider({ keyId: 'rzp_test_1', keySecret: 'secret_1' });
      expect(razorpay.capabilities).toEqual(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);
      expect(Object.isFrozen(razorpay.capabilities)).toBe(true);

      const ccavenue = new CCAvenueProvider({ merchantId: 'm_1', accessCode: 'a_1', workingKey: 'w_1' });
      expect(ccavenue.capabilities).toEqual(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'parseEncryptedResponse']);

      const stripe = new StripeProvider({ secretKey: 'sk_test_1' });
      expect(stripe.capabilities).toEqual(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);

      const phonepe = new PhonePeProvider({ merchantId: 'm_1', saltKey: 'k_1' });
      expect(phonepe.capabilities).toEqual(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);

      const mock = new MockPaymentProvider();
      expect(mock.capabilities).toEqual(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);
    });

    it('should expose frozen capabilities array on email providers', () => {
      const resend = new ResendProvider({ apiKey: 're_1' });
      expect(resend.capabilities).toEqual(['send']);

      const nodemailer = new NodemailerProvider({ service: 'gmail', auth: { user: 'u', pass: 'p' } });
      expect(nodemailer.capabilities).toEqual(['send', 'verify']);

      const ses = new SESProvider({ accessKeyId: 'k', secretAccessKey: 's', region: 'us-east-1' });
      expect(ses.capabilities).toEqual(['send']);

      const mock = new MockEmailProvider();
      expect(mock.capabilities).toEqual(['send', 'verify']);
    });

    it('should expose frozen capabilities array on SMS providers', () => {
      const msg91 = new MSG91Provider({ authKey: 'auth_key_123' });
      expect(msg91.capabilities).toEqual(['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp']);

      const messagebird = new MessageBirdProvider({ apiKey: 'mb_key_123' });
      expect(messagebird.capabilities).toEqual(['sendSMS', 'sendWhatsApp']);

      const twilio = new TwilioProvider({ accountSid: 'AC_1', authToken: 'tok_1' });
      expect(twilio.capabilities).toEqual(['sendSMS', 'sendOTP', 'verifyOTP', 'sendWhatsApp', 'verifyWebhook']);

      const mock = new MockSMSProvider();
      expect(mock.capabilities).toEqual(['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp']);
    });

    it('should expose frozen capabilities array on storage providers', () => {
      const cloudinary = new CloudinaryProvider({ cloudName: 'c', apiKey: 'k', apiSecret: 's' });
      expect(cloudinary.capabilities).toEqual(['upload', 'uploadBuffer', 'delete', 'getUrl']);

      const s3 = new S3Provider({ accessKeyId: 'k', secretAccessKey: 's', region: 'us-east-1', bucket: 'my-bucket' });
      expect(s3.capabilities).toEqual(['upload', 'uploadBuffer', 'uploadStream', 'delete', 'getUrl']);

      const mock = new MockStorageProvider();
      expect(mock.capabilities).toEqual(['upload', 'uploadBuffer', 'uploadStream', 'delete', 'getUrl']);
    });
  });

  describe('Factory Input Consistency Across All Domains', () => {
    const factories = [
      { name: 'createPaymentProvider', fn: createPaymentProvider, validProvider: 'razorpay', validConfig: { provider: 'razorpay', keyId: 'k', keySecret: 's' } },
      { name: 'createEmailProvider', fn: createEmailProvider, validProvider: 'resend', validConfig: { provider: 'resend', apiKey: 'k' } },
      { name: 'createSMSProvider', fn: createSMSProvider, validProvider: 'msg91', validConfig: { provider: 'msg91', authKey: 'k' } },
      { name: 'createStorageProvider', fn: createStorageProvider, validProvider: 'cloudinary', validConfig: { provider: 'cloudinary', cloudName: 'c', apiKey: 'k', apiSecret: 's' } }
    ];

    test.each(factories)('$name should reject null, undefined, arrays, and primitive config types with ValidationError', ({ fn }) => {
      expect(() => fn(null)).toThrow(ValidationError);
      expect(() => fn(undefined)).toThrow(ValidationError);
      expect(() => fn([])).toThrow(ValidationError);
      expect(() => fn('string')).toThrow(ValidationError);
      expect(() => fn(123)).toThrow(ValidationError);
      expect(() => fn(true)).toThrow(ValidationError);
    });

    test.each(factories)('$name should reject missing or whitespace-only provider names', ({ fn }) => {
      expect(() => fn({})).toThrow(ValidationError);
      expect(() => fn({ provider: '' })).toThrow(ValidationError);
      expect(() => fn({ provider: '   ' })).toThrow(ValidationError);
      expect(() => fn({ provider: 123 })).toThrow(ValidationError);
    });

    test.each(factories)('$name should throw IntegrationError with UNSUPPORTED_PROVIDER (400) for unknown providers', ({ fn }) => {
      try {
        fn({ provider: 'nonexistent_gateway' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }
    });

    test.each(factories)('$name should match valid provider names case-insensitively with whitespace trimming', ({ fn, validProvider, validConfig }) => {
      const instance = fn({ ...validConfig, provider: `  ${validProvider.toUpperCase()}  ` });
      expect(instance).toBeDefined();
    });
  });
});
