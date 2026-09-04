import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentProvider,
  createSMSProvider,
  CCAvenueProvider,
  MSG91Provider,
  MessageBirdProvider
} from 'mern-integrations';

describe('C. Zero-SDK Providers Verification', () => {
  describe('CCAvenue Provider (Zero SDK - Native Crypto)', () => {
    const config = {
      provider: 'ccavenue',
      merchantId: 'M_12345',
      accessCode: 'AV_ACCESS_CODE',
      workingKey: '0123456789ABCDEF0123456789ABCDEF'
    };

    it('should initialize successfully via createPaymentProvider factory', () => {
      const provider = createPaymentProvider(config);

      assert.equal(provider instanceof CCAvenueProvider, true);
      assert.equal(provider.name, 'ccavenue');
      assert.deepEqual(provider.capabilities, ['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'parseEncryptedResponse']);
    });

    it('should generate AES-128-CBC encrypted payment request payload without any external SDK', async () => {
      const provider = createPaymentProvider(config);

      const result = await provider.initiatePayment({
        orderId: 'ORD_TEST_1001',
        amount: 149900, // ₹1499.00 in paise
        currency: 'INR',
        redirectUrl: 'https://myshop.com/payment/callback',
        cancelUrl: 'https://myshop.com/payment/cancel',
        billing: {
          name: 'Jane Doe',
          email: 'jane@example.com'
        }
      });

      assert.equal(typeof result, 'object');
      assert.equal(result.success, true);
      assert.equal(result.provider, 'ccavenue');
      assert.equal(result.data.action, 'redirect');
      assert.equal(result.data.method, 'POST');
      assert.equal(result.data.fields.access_code, 'AV_ACCESS_CODE');
      assert.equal(typeof result.data.fields.encRequest, 'string');
      assert.equal(result.data.fields.encRequest.length > 32, true);
    });
  });

  describe('MSG91 Provider (Zero SDK - Native Fetch)', () => {
    const config = {
      provider: 'msg91',
      authKey: 'sample_msg91_auth_key_123',
      senderId: 'ACME12',
      templateId: 'tpl_otp_101'
    };

    it('should initialize successfully via createSMSProvider factory', () => {
      const provider = createSMSProvider(config);

      assert.equal(provider instanceof MSG91Provider, true);
      assert.equal(provider.name, 'msg91');
      assert.deepEqual(provider.capabilities, ['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp']);
    });
  });

  describe('MessageBird Provider (Zero SDK - Native Fetch)', () => {
    const config = {
      provider: 'messagebird',
      apiKey: 'sample_mb_access_key_123',
      channelId: 'channel_123'
    };

    it('should initialize successfully via createSMSProvider factory', () => {
      const provider = createSMSProvider(config);

      assert.equal(provider instanceof MessageBirdProvider, true);
      assert.equal(provider.name, 'messagebird');
      assert.deepEqual(provider.capabilities, ['sendSMS', 'sendWhatsApp']);
    });
  });
});
