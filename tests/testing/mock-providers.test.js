import { Readable } from 'stream';
import {
  MockPaymentProvider,
  MockEmailProvider,
  MockSMSProvider,
  MockStorageProvider
} from '../../src/testing/index.js';
import {
  createPaymentProvider,
  createEmailProvider,
  createSMSProvider,
  createStorageProvider,
  ValidationError,
  PaymentProvider,
  EmailProvider,
  SMSProvider,
  StorageProvider
} from '../../src/index.js';

describe('In-Memory Mock Providers & Testing Module', () => {
  describe('MockPaymentProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new MockPaymentProvider();
    });

    it('should inherit from PaymentProvider and have provider name "mock"', () => {
      expect(provider).toBeInstanceOf(PaymentProvider);
      expect(provider.name).toBe('mock');
      expect(provider.capabilities).toEqual([
        'createOrder',
        'initiatePayment',
        'verifyPayment',
        'verifyCallback',
        'refund',
        'verifyWebhook'
      ]);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should create orders and record them in memory', async () => {
      const result = await provider.createOrder({
        amount: 50000,
        currency: 'INR',
        receipt: 'rcpt_001',
        notes: { userId: '123' }
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock');
      expect(result.data.amount).toBe(50000);
      expect(result.data.currency).toBe('INR');
      expect(result.data.receipt).toBe('rcpt_001');
      expect(result.data.status).toBe('created');
      expect(result.data.id).toContain('order_mock_rcpt_001');

      const orders = provider.getRecordedOrders();
      expect(orders).toHaveLength(1);
      expect(provider.getOrder(result.data.id)).toEqual(result.data);
    });

    it('initiatePayment should alias createOrder', async () => {
      const result = await provider.initiatePayment({
        amount: 2500,
        currency: 'USD'
      });

      expect(result.success).toBe(true);
      expect(result.data.amount).toBe(2500);
      expect(result.data.currency).toBe('USD');
    });

    it('should validate inputs for createOrder', async () => {
      await expect(provider.createOrder({})).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: -100, currency: 'INR' })).rejects.toThrow(ValidationError);
      await expect(provider.createOrder({ amount: 100, currency: '' })).rejects.toThrow(ValidationError);
    });

    it('should verify payment successfully and record in memory', async () => {
      const order = await provider.createOrder({ amount: 1000, currency: 'INR' });
      const verifyRes = await provider.verifyPayment({
        orderId: order.data.id,
        paymentId: 'pay_123',
        signature: 'valid_mock_sig'
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data.verified).toBe(true);
      expect(verifyRes.data.status).toBe('succeeded');

      const payments = provider.getRecordedPayments();
      expect(payments).toHaveLength(1);
      expect(payments[0].paymentId).toBe('pay_123');
    });

    it('should fail verification if signature is mock_fail_signature', async () => {
      const verifyRes = await provider.verifyPayment({
        orderId: 'order_123',
        paymentId: 'pay_456',
        signature: 'mock_fail_signature'
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data.verified).toBe(false);
      expect(verifyRes.data.status).toBe('failed');
    });

    it('verifyCallback should alias verifyPayment', async () => {
      const verifyRes = await provider.verifyCallback({
        orderId: 'order_cb_123',
        paymentId: 'pay_cb_456'
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data.verified).toBe(true);
    });

    it('should record refunds in memory', async () => {
      const refundRes = await provider.refund({
        paymentId: 'pay_123',
        amount: 500,
        notes: { reason: 'defective' }
      });

      expect(refundRes.success).toBe(true);
      expect(refundRes.data.paymentId).toBe('pay_123');
      expect(refundRes.data.amount).toBe(500);
      expect(refundRes.data.status).toBe('processed');

      const refunds = provider.getRecordedRefunds();
      expect(refunds).toHaveLength(1);
    });

    it('should verify webhooks and detect invalid signatures', async () => {
      const valid = await provider.verifyWebhook({
        payload: '{"event":"payment.captured"}',
        signature: 'valid_sig'
      });
      expect(valid.data.verified).toBe(true);

      const invalid = await provider.verifyWebhook({
        payload: '{"event":"payment.captured"}',
        signature: 'mock_fail_signature'
      });
      expect(invalid.data.verified).toBe(false);
    });

    it('clearHistory and reset should wipe all in-memory collections', async () => {
      await provider.createOrder({ amount: 1000, currency: 'INR' });
      await provider.verifyPayment({ orderId: 'ord_1', paymentId: 'pay_1' });
      await provider.refund({ paymentId: 'pay_1' });

      expect(provider.getRecordedOrders()).toHaveLength(1);
      expect(provider.getRecordedPayments()).toHaveLength(1);
      expect(provider.getRecordedRefunds()).toHaveLength(1);

      provider.reset();

      expect(provider.getRecordedOrders()).toHaveLength(0);
      expect(provider.getRecordedPayments()).toHaveLength(0);
      expect(provider.getRecordedRefunds()).toHaveLength(0);
    });

    it('PaymentFactory should instantiate MockPaymentProvider with provider: "mock"', () => {
      const instance = createPaymentProvider({ provider: 'mock' });
      expect(instance).toBeInstanceOf(MockPaymentProvider);
      expect(instance.name).toBe('mock');
    });
  });

  describe('MockEmailProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new MockEmailProvider();
    });

    it('should inherit from EmailProvider and have provider name "mock"', () => {
      expect(provider).toBeInstanceOf(EmailProvider);
      expect(provider.name).toBe('mock');
      expect(provider.capabilities).toEqual(['send', 'verify']);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should capture sent emails in memory', async () => {
      const email = await provider.send({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Welcome!',
        html: '<p>Hello world</p>'
      });

      expect(email.success).toBe(true);
      expect(email.data.from).toBe('sender@example.com');
      expect(email.data.to).toBe('receiver@example.com');
      expect(email.data.status).toBe('queued');

      expect(provider.getSentEmails()).toHaveLength(1);
      expect(provider.getLastSentEmail().subject).toBe('Welcome!');
    });

    it('should validate email input parameters strictly', async () => {
      await expect(provider.send({ to: 'receiver@example.com', subject: 'Hi' })).rejects.toThrow(ValidationError);
      await expect(provider.send({ from: 'sender@example.com', to: 'invalid-email', subject: 'Hi' })).rejects.toThrow(ValidationError);
      await expect(provider.send({ from: 'sender@example.com', to: 'valid@example.com', subject: '' })).rejects.toThrow(ValidationError);
      await expect(provider.send({ from: 'sender@example.com', to: 'valid@example.com', subject: 'Hi' })).rejects.toThrow(ValidationError);
    });

    it('should support verify() successfully', async () => {
      const verifyRes = await provider.verify();
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data.connected).toBe(true);
    });

    it('clearSentEmails and reset should clear email logs', async () => {
      await provider.send({ from: 'a@b.com', to: 'c@d.com', subject: 'Test', text: 'Hello' });
      expect(provider.getSentEmails()).toHaveLength(1);

      provider.reset();
      expect(provider.getSentEmails()).toHaveLength(0);
      expect(provider.getLastSentEmail()).toBeNull();
    });

    it('EmailFactory should instantiate MockEmailProvider with provider: "mock"', () => {
      const instance = createEmailProvider({ provider: 'mock' });
      expect(instance).toBeInstanceOf(MockEmailProvider);
      expect(instance.name).toBe('mock');
    });
  });

  describe('MockSMSProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new MockSMSProvider();
    });

    it('should inherit from SMSProvider and have provider name "mock"', () => {
      expect(provider).toBeInstanceOf(SMSProvider);
      expect(provider.name).toBe('mock');
      expect(provider.capabilities).toEqual(['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp']);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should send SMS and record in memory', async () => {
      const sms = await provider.sendSMS({
        to: '+14155552671',
        message: 'Your code is 123456'
      });

      expect(sms.success).toBe(true);
      expect(sms.data.status).toBe('delivered');
      expect(sms.data.to).toBe('+14155552671');

      expect(provider.getSentMessages()).toHaveLength(1);
      expect(provider.getLastSentMessage().message).toBe('Your code is 123456');
    });

    it('should dispatch, verify, and expire OTPs', async () => {
      const otpRes = await provider.sendOTP({
        to: '+919876543210',
        otp: '998877',
        expirySeconds: 60
      });

      expect(otpRes.success).toBe(true);
      expect(otpRes.data.otp).toBe('998877');

      // Failed candidate
      const failed = await provider.verifyOTP({
        to: '+919876543210',
        otp: '000000'
      });
      expect(failed.data.verified).toBe(false);

      // Verified candidate
      const passed = await provider.verifyOTP({
        to: '+919876543210',
        otp: '998877'
      });
      expect(passed.data.verified).toBe(true);

      // Wildcard test OTP should always pass
      const wildcard = await provider.verifyOTP({
        to: '+919876543210',
        otp: '123456'
      });
      expect(wildcard.data.verified).toBe(true);
    });

    it('should support resendOTP and sendWhatsApp', async () => {
      const resend = await provider.resendOTP({ to: '+919876543210' });
      expect(resend.success).toBe(true);

      const wa = await provider.sendWhatsApp({
        to: '+919876543210',
        templateName: 'order_update',
        components: [{ type: 'body', parameters: [{ text: '123' }] }]
      });
      expect(wa.success).toBe(true);
      expect(wa.data.type).toBe('whatsapp');
    });

    it('clearHistory and reset should wipe messages and OTPs', async () => {
      await provider.sendSMS({ to: '+919876543210', message: 'Hello' });
      await provider.sendOTP({ to: '+919876543210' });

      expect(provider.getSentMessages().length).toBeGreaterThan(0);
      expect(provider.getGeneratedOTPs().size).toBe(1);

      provider.reset();

      expect(provider.getSentMessages()).toHaveLength(0);
      expect(provider.getGeneratedOTPs().size).toBe(0);
    });

    it('SMSFactory should instantiate MockSMSProvider with provider: "mock"', () => {
      const instance = createSMSProvider({ provider: 'mock' });
      expect(instance).toBeInstanceOf(MockSMSProvider);
      expect(instance.name).toBe('mock');
    });
  });

  describe('MockStorageProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new MockStorageProvider();
    });

    it('should inherit from StorageProvider and have provider name "mock"', () => {
      expect(provider).toBeInstanceOf(StorageProvider);
      expect(provider.name).toBe('mock');
      expect(provider.capabilities).toEqual(['upload', 'uploadBuffer', 'uploadStream', 'delete', 'getUrl']);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should upload files and store metadata', async () => {
      const upload = await provider.upload({
        file: '/path/to/invoice.pdf',
        folder: 'invoices'
      });

      expect(upload.success).toBe(true);
      expect(upload.data.key).toContain('invoices/');
      expect(upload.data.url).toContain('https://mock-storage.local/invoices/');

      expect(provider.getFiles()).toHaveLength(1);
      expect(provider.getFile(upload.data.key)).toBeDefined();
    });

    it('should upload Buffer correctly', async () => {
      const buf = Buffer.from('hello storage');
      const upload = await provider.uploadBuffer({
        buffer: buf,
        fileName: 'test.txt'
      });

      expect(upload.success).toBe(true);
      expect(upload.data.bytes).toBe(buf.length);

      await expect(provider.uploadBuffer({ buffer: 'not-a-buffer' })).rejects.toThrow(ValidationError);
    });

    it('should upload Stream correctly', async () => {
      const stream = Readable.from(['chunk1', 'chunk2']);
      const upload = await provider.uploadStream({
        stream,
        key: 'streamed.txt'
      });

      expect(upload.success).toBe(true);
      expect(upload.data.key).toBe('streamed.txt');

      await expect(provider.uploadStream({ stream: null })).rejects.toThrow(ValidationError);
    });

    it('should delete files and generate public / signed URLs', async () => {
      await provider.upload({ file: 'avatar.png', fileName: 'avatar.png' });

      const url = provider.getUrl({ publicId: 'avatar.png' });
      expect(url).toBe('https://mock-storage.local/avatar.png');

      const signedUrl = provider.getUrl({ publicId: 'avatar.png', signed: true, expiresIn: 1800 });
      expect(signedUrl).toContain('signed=true&expires=1800');

      const del = await provider.delete({ publicId: 'avatar.png' });
      expect(del.success).toBe(true);
      expect(del.data.existed).toBe(true);
      expect(provider.getFile('avatar.png')).toBeNull();
    });

    it('clearFiles and reset should empty file map', async () => {
      await provider.upload({ file: 'dummy.txt' });
      expect(provider.getFiles()).toHaveLength(1);

      provider.reset();
      expect(provider.getFiles()).toHaveLength(0);
    });

    it('StorageFactory should instantiate MockStorageProvider with provider: "mock"', () => {
      const instance = createStorageProvider({ provider: 'mock' });
      expect(instance).toBeInstanceOf(MockStorageProvider);
      expect(instance.name).toBe('mock');
    });
  });
});
