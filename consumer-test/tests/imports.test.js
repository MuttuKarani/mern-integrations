import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Root package imports
import {
  createPaymentProvider,
  createEmailProvider,
  createSMSProvider,
  createStorageProvider,
  IntegrationError,
  ValidationError,
  PaymentProvider,
  RazorpayProvider,
  CCAvenueProvider,
  StripeProvider,
  EmailProvider,
  ResendProvider,
  NodemailerProvider,
  SESProvider,
  SMSProvider,
  MSG91Provider,
  MessageBirdProvider,
  StorageProvider,
  CloudinaryProvider,
  S3Provider,
  validateRequiredString,
  validateRequiredObject
} from 'mern-integrations';

// Subpath imports
import * as PaymentsModule from 'mern-integrations/payments';
import * as EmailModule from 'mern-integrations/email';
import * as SMSModule from 'mern-integrations/sms';
import * as StorageModule from 'mern-integrations/storage';

describe('A & B. Consumer Export and Subpath Contract Tests', () => {
  it('should export all expected functions, classes, and validators from root import', () => {
    assert.equal(typeof createPaymentProvider, 'function');
    assert.equal(typeof createEmailProvider, 'function');
    assert.equal(typeof createSMSProvider, 'function');
    assert.equal(typeof createStorageProvider, 'function');

    assert.equal(typeof IntegrationError, 'function');
    assert.equal(typeof ValidationError, 'function');

    assert.equal(typeof PaymentProvider, 'function');
    assert.equal(typeof RazorpayProvider, 'function');
    assert.equal(typeof CCAvenueProvider, 'function');
    assert.equal(typeof StripeProvider, 'function');

    assert.equal(typeof EmailProvider, 'function');
    assert.equal(typeof ResendProvider, 'function');
    assert.equal(typeof NodemailerProvider, 'function');
    assert.equal(typeof SESProvider, 'function');

    assert.equal(typeof SMSProvider, 'function');
    assert.equal(typeof MSG91Provider, 'function');
    assert.equal(typeof MessageBirdProvider, 'function');

    assert.equal(typeof StorageProvider, 'function');
    assert.equal(typeof CloudinaryProvider, 'function');
    assert.equal(typeof S3Provider, 'function');

    assert.equal(typeof validateRequiredString, 'function');
    assert.equal(typeof validateRequiredObject, 'function');
  });

  it('should support subpath import: mern-integrations/payments', () => {
    assert.equal(typeof PaymentsModule.createPaymentProvider, 'function');
    assert.equal(typeof PaymentsModule.PaymentProvider, 'function');
    assert.equal(typeof PaymentsModule.RazorpayProvider, 'function');
    assert.equal(typeof PaymentsModule.CCAvenueProvider, 'function');
    assert.equal(typeof PaymentsModule.StripeProvider, 'function');
    assert.equal(typeof PaymentsModule.ccavenueCrypto, 'object');
  });

  it('should support subpath import: mern-integrations/email', () => {
    assert.equal(typeof EmailModule.createEmailProvider, 'function');
    assert.equal(typeof EmailModule.EmailProvider, 'function');
    assert.equal(typeof EmailModule.ResendProvider, 'function');
    assert.equal(typeof EmailModule.NodemailerProvider, 'function');
    assert.equal(typeof EmailModule.SESProvider, 'function');
  });

  it('should support subpath import: mern-integrations/sms', () => {
    assert.equal(typeof SMSModule.createSMSProvider, 'function');
    assert.equal(typeof SMSModule.SMSProvider, 'function');
    assert.equal(typeof SMSModule.MSG91Provider, 'function');
    assert.equal(typeof SMSModule.MessageBirdProvider, 'function');
  });

  it('should support subpath import: mern-integrations/storage', () => {
    assert.equal(typeof StorageModule.createStorageProvider, 'function');
    assert.equal(typeof StorageModule.StorageProvider, 'function');
    assert.equal(typeof StorageModule.CloudinaryProvider, 'function');
    assert.equal(typeof StorageModule.S3Provider, 'function');
  });
});
