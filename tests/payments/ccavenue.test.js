import crypto from 'node:crypto';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createPaymentProvider,
  CCAvenueProvider,
  IntegrationError,
  ValidationError,
  ccavenueCrypto
} from '../../src/index.js';

describe('CCAvenueProvider & AES-128-CBC Cryptography', () => {
  const mockMerchantId = '2123456';
  const mockAccessCode = 'AVTESTACCESS1234';
  const mockWorkingKey = '2E64FE1D9A75E4D89C4C66C3E4C86731';

  let provider;

  beforeEach(() => {
    provider = new CCAvenueProvider({
      merchantId: mockMerchantId,
      accessCode: mockAccessCode,
      workingKey: mockWorkingKey,
      testMode: true
    });
  });

  describe('Cryptographic Operations & Reference Test Vectors', () => {
    const testWorkingKey = '2E64FE1D9A75E4D89C4C66C3E4C86731';
    const testPlainText =
      'merchant_id=2123456&order_id=ORD_12345&amount=10.00&currency=INR&redirect_url=https%3A%2F%2Fexample.com%2Fcallback&cancel_url=https%3A%2F%2Fexample.com%2Fcancel';

    // Standard AES-128-CBC IV for CCAvenue: 0x00 to 0x0f (16 bytes)
    const officialIV = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
    ]);
    const derivedKey = crypto.createHash('md5').update(testWorkingKey).digest();

    // Independently computed cipher reference
    const cipherRef = crypto.createCipheriv('aes-128-cbc', derivedKey, officialIV);
    const expectedCipherHex = cipherRef.update(testPlainText, 'utf8', 'hex') + cipherRef.final('hex');

    test('should encrypt plaintext query string matching official AES-128-CBC specification', () => {
      const encrypted = ccavenueCrypto.encrypt(testPlainText, testWorkingKey);
      expect(encrypted).toBe(expectedCipherHex);
    });

    test('should decrypt pre-computed reference ciphertext back to exact original plaintext', () => {
      const decrypted = ccavenueCrypto.decrypt(expectedCipherHex, testWorkingKey);
      expect(decrypted).toBe(testPlainText);
    });

    test('parseEncryptedResponse should decrypt and correctly parse key-value query parameters', () => {
      const sampleResponseQuery =
        'order_id=ORD_998877&tracking_id=31000888999&bank_ref_no=BNK_445566&order_status=Success&failure_message=&payment_mode=Net+Banking&card_name=HDFC&status_code=null&status_message=Transaction+Successful&currency=INR&amount=10.00';

      const cipher = crypto.createCipheriv('aes-128-cbc', derivedKey, officialIV);
      const encResp = cipher.update(sampleResponseQuery, 'utf8', 'hex') + cipher.final('hex');

      const parsed = ccavenueCrypto.parseEncryptedResponse(encResp, testWorkingKey);

      expect(parsed.order_id).toBe('ORD_998877');
      expect(parsed.tracking_id).toBe('31000888999');
      expect(parsed.bank_ref_no).toBe('BNK_445566');
      expect(parsed.order_status).toBe('Success');
      expect(parsed.payment_mode).toBe('Net Banking');
      expect(parsed.amount).toBe('10.00');
      expect(parsed.currency).toBe('INR');
    });

    test('should reject invalid hex strings with ValidationError', () => {
      // Non-hex characters
      expect(() => ccavenueCrypto.decrypt('not_a_valid_hex_string_xyz', testWorkingKey)).toThrow(
        ValidationError
      );

      // Odd length hex
      expect(() => ccavenueCrypto.decrypt('12345', testWorkingKey)).toThrow(ValidationError);

      // Empty or non-string
      expect(() => ccavenueCrypto.decrypt('', testWorkingKey)).toThrow(ValidationError);
      expect(() => ccavenueCrypto.decrypt(null, testWorkingKey)).toThrow(ValidationError);
    });

    test('should throw IntegrationError when decrypting corrupted ciphertext or with wrong working key', () => {
      const wrongKey = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

      expect(() => ccavenueCrypto.decrypt(expectedCipherHex, wrongKey)).toThrow(IntegrationError);

      try {
        ccavenueCrypto.decrypt(expectedCipherHex, wrongKey);
      } catch (err) {
        expect(err.code).toBe('DECRYPTION_ERROR');
        expect(err.statusCode).toBe(400);
        expect(err.provider).toBe('ccavenue');
      }
    });
  });

  describe('Constructor & Credential Validation', () => {
    test('should throw ValidationError if config is not a valid object', () => {
      expect(() => new CCAvenueProvider(null)).toThrow(ValidationError);
      expect(() => new CCAvenueProvider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if merchantId is missing or empty', () => {
      expect(
        () =>
          new CCAvenueProvider({
            merchantId: '',
            accessCode: mockAccessCode,
            workingKey: mockWorkingKey
          })
      ).toThrow(ValidationError);
    });

    test('should throw ValidationError if accessCode is missing or empty', () => {
      expect(
        () =>
          new CCAvenueProvider({
            merchantId: mockMerchantId,
            accessCode: '',
            workingKey: mockWorkingKey
          })
      ).toThrow(ValidationError);
    });

    test('should throw ValidationError if workingKey is missing or empty', () => {
      expect(
        () =>
          new CCAvenueProvider({
            merchantId: mockMerchantId,
            accessCode: mockAccessCode,
            workingKey: ''
          })
      ).toThrow(ValidationError);
    });

    test('should default to production URL if testMode is false', () => {
      const prodProvider = new CCAvenueProvider({
        merchantId: mockMerchantId,
        accessCode: mockAccessCode,
        workingKey: mockWorkingKey,
        testMode: false
      });

      expect(prodProvider).toBeInstanceOf(CCAvenueProvider);
    });

    test('should not expose workingKey or sensitive properties in Object.keys() or JSON.stringify()', () => {
      const testProvider = new CCAvenueProvider({
        merchantId: mockMerchantId,
        accessCode: mockAccessCode,
        workingKey: mockWorkingKey
      });

      const keys = Object.keys(testProvider);
      expect(keys).not.toContain('workingKey');
      expect(keys).not.toContain('#workingKey');

      const serialized = JSON.stringify(testProvider);
      expect(serialized).not.toContain(mockWorkingKey);
    });
  });

  describe('Payment Initiation (initiatePayment & createOrder)', () => {
    test('should validate that amount is a positive integer in smallest currency unit (paise)', async () => {
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          currency: 'INR',
          redirectUrl: 'https://example.com/callback',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);

      // Decimals (e.g. ₹10.50 instead of 1050 paise)
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 10.5,
          currency: 'INR',
          redirectUrl: 'https://example.com/callback',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);

      // Zero or negative
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 0,
          currency: 'INR',
          redirectUrl: 'https://example.com/callback',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate currency and enforce INR in Phase 2', async () => {
      // Missing currency
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 1000,
          currency: '',
          redirectUrl: 'https://example.com/callback',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);

      // Unsupported currency in Phase 2
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 1000,
          currency: 'USD',
          redirectUrl: 'https://example.com/callback',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate required redirect and cancel URLs', async () => {
      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 1000,
          currency: 'INR',
          cancelUrl: 'https://example.com/cancel'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.initiatePayment({
          orderId: 'ORD_1',
          amount: 1000,
          currency: 'INR',
          redirectUrl: 'https://example.com/callback'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully generate encrypted redirect descriptor with formatted decimal amount', async () => {
      const response = await provider.initiatePayment({
        orderId: 'ORD_TEST_1001',
        amount: 15000, // 15000 paise = ₹150.00
        currency: 'INR',
        redirectUrl: 'https://mysite.com/payment/callback',
        cancelUrl: 'https://mysite.com/payment/cancel',
        billing: {
          name: 'John Doe',
          email: 'john@example.com',
          tel: '9876543210'
        }
      });

      expect(response.success).toBe(true);
      expect(response.provider).toBe('ccavenue');
      expect(response.data.orderId).toBe('ORD_TEST_1001');
      expect(response.data.action).toBe('redirect');
      expect(response.data.method).toBe('POST');
      expect(response.data.redirectUrl).toBe(
        'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
      );
      expect(response.data.fields.access_code).toBe(mockAccessCode);
      expect(typeof response.data.fields.encRequest).toBe('string');

      // Verify that the encrypted payload contains the converted decimal amount ("150.00")
      const decrypted = ccavenueCrypto.decrypt(response.data.fields.encRequest, mockWorkingKey);
      const params = new URLSearchParams(decrypted);

      expect(params.get('merchant_id')).toBe(mockMerchantId);
      expect(params.get('order_id')).toBe('ORD_TEST_1001');
      expect(params.get('amount')).toBe('150.00');
      expect(params.get('currency')).toBe('INR');
      expect(params.get('redirect_url')).toBe('https://mysite.com/payment/callback');
      expect(params.get('cancel_url')).toBe('https://mysite.com/payment/cancel');
      expect(params.get('billing_name')).toBe('John Doe');
      expect(params.get('billing_email')).toBe('john@example.com');
    });

    test('createOrder alias should delegate to initiatePayment', async () => {
      const spy = jest.spyOn(provider, 'initiatePayment');

      const params = {
        orderId: 'ORD_ALIAS_1',
        amount: 1000,
        currency: 'INR',
        redirectUrl: 'https://mysite.com/callback',
        cancelUrl: 'https://mysite.com/cancel'
      };

      await provider.createOrder(params);
      expect(spy).toHaveBeenCalledWith(params);
    });
  });

  describe('Callback & Payment Verification (verifyCallback & verifyPayment)', () => {
    test('should throw ValidationError if encResp is missing or empty', async () => {
      await expect(provider.verifyCallback({})).rejects.toThrow(ValidationError);
      await expect(provider.verifyCallback({ encResp: '' })).rejects.toThrow(ValidationError);
    });

    test('should successfully decrypt and verify successful callback response', async () => {
      const successQuery =
        'order_id=ORD_1001&tracking_id=31000123456&bank_ref_no=HDFC123456&order_status=Success&failure_message=&payment_mode=Credit+Card&card_name=Visa&currency=INR&amount=50.00';

      const encResp = ccavenueCrypto.encrypt(successQuery, mockWorkingKey);

      const result = await provider.verifyCallback({ encResp });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ccavenue');
      expect(result.data.verified).toBe(true);
      expect(result.data.orderId).toBe('ORD_1001');
      expect(result.data.trackingId).toBe('31000123456');
      expect(result.data.bankRefNo).toBe('HDFC123456');
      expect(result.data.orderStatus).toBe('Success');
      expect(result.data.amount).toBe(5000); // Converted back to 5000 paise
      expect(result.data.currency).toBe('INR');
      expect(result.data.paymentMode).toBe('Credit Card');
      expect(result.data.cardName).toBe('Visa');
    });

    test('should return verified: false for failed or aborted transaction statuses', async () => {
      const failureQuery =
        'order_id=ORD_1002&tracking_id=31000999999&order_status=Failure&failure_message=Insufficient+Funds&amount=25.00&currency=INR';

      const encResp = ccavenueCrypto.encrypt(failureQuery, mockWorkingKey);

      const result = await provider.verifyCallback({ encResp });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(false);
      expect(result.data.orderStatus).toBe('Failure');
      expect(result.data.failureMessage).toBe('Insufficient Funds');
      expect(result.data.amount).toBe(2500);
    });

    test('verifyPayment alias should delegate to verifyCallback', async () => {
      const spy = jest.spyOn(provider, 'verifyCallback');

      const query = 'order_id=ORD_1003&order_status=Success&amount=10.00&currency=INR';
      const encResp = ccavenueCrypto.encrypt(query, mockWorkingKey);

      await provider.verifyPayment({ encResp });
      expect(spy).toHaveBeenCalledWith({ encResp });
    });
  });

  describe('Unsupported Operations (refund & verifyWebhook)', () => {
    test('refund should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      await expect(provider.refund({ paymentId: '123' })).rejects.toThrow(IntegrationError);

      try {
        await provider.refund({ paymentId: '123' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
        expect(err.provider).toBe('ccavenue');
        expect(err.message).toContain('Programmatic refunds are not currently supported');
      }
    });

    test('verifyWebhook should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      await expect(provider.verifyWebhook({ payload: 'test' })).rejects.toThrow(IntegrationError);

      try {
        await provider.verifyWebhook({ payload: 'test' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
        expect(err.provider).toBe('ccavenue');
        expect(err.message).toContain('verifyWebhook() is not supported for CCAvenue');
      }
    });
  });

  describe('PaymentFactory for CCAvenue', () => {
    test('createPaymentProvider should instantiate CCAvenueProvider', () => {
      const p = createPaymentProvider({
        provider: 'ccavenue',
        merchantId: mockMerchantId,
        accessCode: mockAccessCode,
        workingKey: mockWorkingKey
      });

      expect(p).toBeInstanceOf(CCAvenueProvider);
      expect(p.name).toBe('ccavenue');
    });
  });
});
