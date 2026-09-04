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
  createPaymentProvider,
  ccavenueCrypto,
  EmailProvider,
  ResendProvider,
  NodemailerProvider,
  SESProvider,
  createEmailProvider,
  SMSProvider,
  MSG91Provider,
  MessageBirdProvider,
  createSMSProvider,
  StorageProvider,
  CloudinaryProvider,
  S3Provider,
  createStorageProvider
} from '../src/index.js';

import * as paymentsModule from '../src/payments/index.js';
import * as emailModule from '../src/email/index.js';
import * as smsModule from '../src/sms/index.js';
import * as storageModule from '../src/storage/index.js';

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
      expect(paymentsModule.createPaymentProvider).toBe(createPaymentProvider);
    });
  });

  describe('Email Module Exports', () => {
    it('should export email classes and factories', () => {
      expect(EmailProvider).toBeDefined();
      expect(ResendProvider).toBeDefined();
      expect(NodemailerProvider).toBeDefined();
      expect(SESProvider).toBeDefined();
      expect(typeof createEmailProvider).toBe('function');
    });

    it('should match submodule exports for email', () => {
      expect(emailModule.EmailProvider).toBe(EmailProvider);
      expect(emailModule.ResendProvider).toBe(ResendProvider);
      expect(emailModule.NodemailerProvider).toBe(NodemailerProvider);
      expect(emailModule.SESProvider).toBe(SESProvider);
      expect(emailModule.createEmailProvider).toBe(createEmailProvider);
    });
  });

  describe('SMS Module Exports', () => {
    it('should export SMS classes and factories', () => {
      expect(SMSProvider).toBeDefined();
      expect(MSG91Provider).toBeDefined();
      expect(MessageBirdProvider).toBeDefined();
      expect(typeof createSMSProvider).toBe('function');
    });

    it('should match submodule exports for sms', () => {
      expect(smsModule.SMSProvider).toBe(SMSProvider);
      expect(smsModule.MSG91Provider).toBe(MSG91Provider);
      expect(smsModule.MessageBirdProvider).toBe(MessageBirdProvider);
      expect(smsModule.createSMSProvider).toBe(createSMSProvider);
    });
  });

  describe('Storage Module Exports', () => {
    it('should export storage classes and factories', () => {
      expect(StorageProvider).toBeDefined();
      expect(CloudinaryProvider).toBeDefined();
      expect(S3Provider).toBeDefined();
      expect(typeof createStorageProvider).toBe('function');
    });

    it('should match submodule exports for storage', () => {
      expect(storageModule.StorageProvider).toBe(StorageProvider);
      expect(storageModule.CloudinaryProvider).toBe(CloudinaryProvider);
      expect(storageModule.S3Provider).toBe(S3Provider);
      expect(storageModule.createStorageProvider).toBe(createStorageProvider);
    });
  });
});
