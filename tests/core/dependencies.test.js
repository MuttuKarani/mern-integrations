import { describe, test, expect } from '@jest/globals';
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
import { loadOptionalDependency } from '../../src/core/utils/dependencies.js';

describe('Optional Dependencies & Safe Lazy Loading Architecture', () => {
  const createMissingModuleError = (moduleName) => {
    const error = new Error(`Cannot find package '${moduleName}' imported from /app/index.js`);
    error.code = 'ERR_MODULE_NOT_FOUND';
    return error;
  };

  const createMissingLoader = (moduleName) => {
    return () => {
      throw createMissingModuleError(moduleName);
    };
  };

  describe('loadOptionalDependency() Utility', () => {
    test('should resolve real installed module successfully', async () => {
      const crypto = await loadOptionalDependency('node:crypto', 'core');
      expect(crypto).toBeDefined();
      expect(typeof crypto.randomBytes).toBe('function');
    });

    test('should use custom loader when provided', async () => {
      const mockModule = { test: true };
      const loaded = await loadOptionalDependency('custom-pkg', 'custom', async () => mockModule);
      expect(loaded).toBe(mockModule);
    });

    test('should throw MISSING_PROVIDER_DEPENDENCY IntegrationError on ERR_MODULE_NOT_FOUND', async () => {
      const loader = createMissingLoader('non-existent-sdk');

      await expect(
        loadOptionalDependency('non-existent-sdk', 'sample-provider', loader)
      ).rejects.toThrow(IntegrationError);

      try {
        await loadOptionalDependency('non-existent-sdk', 'sample-provider', loader);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
        expect(err.statusCode).toBe(500);
        expect(err.provider).toBe('sample-provider');
        expect(err.message).toContain('non-existent-sdk');
        expect(err.message).toContain('sample-provider');
        expect(err.message).toContain('npm install non-existent-sdk');
        expect(err.details).toEqual({
          dependency: 'non-existent-sdk'
        });
        expect(err.stack).not.toContain('ERR_MODULE_NOT_FOUND');
      }
    });

    test('should handle unexpected loader evaluation errors with DEPENDENCY_LOAD_ERROR', async () => {
      const runtimeError = new TypeError('Runtime evaluation failure');
      const loader = () => {
        throw runtimeError;
      };

      await expect(
        loadOptionalDependency('broken-sdk', 'sample-provider', loader)
      ).rejects.toThrow(IntegrationError);

      try {
        await loadOptionalDependency('broken-sdk', 'sample-provider', loader);
      } catch (err) {
        expect(err.code).toBe('DEPENDENCY_LOAD_ERROR');
        expect(err.details.dependency).toBe('broken-sdk');
      }
    });
  });

  describe('Payment Providers Lazy Loading', () => {
    describe('RazorpayProvider with missing SDK', () => {
      test('instantiation succeeds but operation throws MISSING_PROVIDER_DEPENDENCY', async () => {
        const provider = new RazorpayProvider({
          keyId: 'rzp_test_key123',
          keySecret: 'rzp_test_secret456',
          loader: createMissingLoader('razorpay')
        });

        await expect(
          provider.createOrder({ amount: 1000, currency: 'INR' })
        ).rejects.toThrow(IntegrationError);

        try {
          await provider.createOrder({ amount: 1000, currency: 'INR' });
        } catch (err) {
          expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
          expect(err.provider).toBe('razorpay');
          expect(err.statusCode).toBe(500);
          expect(err.message).toContain('razorpay');
        }
      });
    });

    describe('StripeProvider with missing SDK', () => {
      test('instantiation succeeds but createOrder throws MISSING_PROVIDER_DEPENDENCY', async () => {
        const provider = new StripeProvider({
          secretKey: 'sk_test_1234567890',
          loader: createMissingLoader('stripe')
        });

        await expect(
          provider.createOrder({ amount: 2000, currency: 'USD' })
        ).rejects.toThrow(IntegrationError);

        try {
          await provider.createOrder({ amount: 2000, currency: 'USD' });
        } catch (err) {
          expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
          expect(err.provider).toBe('stripe');
          expect(err.statusCode).toBe(500);
          expect(err.message).toContain('stripe');
        }
      });

      test('verifyPayment throws MISSING_PROVIDER_DEPENDENCY when stripe is missing', async () => {
        const provider = new StripeProvider({
          secretKey: 'sk_test_1234567890',
          loader: createMissingLoader('stripe')
        });

        await expect(
          provider.verifyPayment({ paymentIntentId: 'pi_test123' })
        ).rejects.toThrow(IntegrationError);
      });
    });

    describe('CCAvenueProvider zero external dependencies', () => {
      test('CCAvenue operates without external SDK requirements', () => {
        const provider = new CCAvenueProvider({
          merchantId: 'M_12345',
          accessCode: 'AV_ACCESS_123',
          workingKey: '0123456789ABCDEF0123456789ABCDEF'
        });
        expect(provider.name).toBe('ccavenue');
      });
    });
  });

  describe('Email Providers Lazy Loading', () => {
    describe('ResendProvider with missing SDK', () => {
      test('send throws MISSING_PROVIDER_DEPENDENCY when resend is missing', async () => {
        const provider = new ResendProvider({
          apiKey: 're_test_123456789',
          loader: createMissingLoader('resend')
        });

        await expect(
          provider.send({
            from: 'sender@example.com',
            to: 'recipient@example.com',
            subject: 'Hello',
            html: '<p>Test</p>'
          })
        ).rejects.toThrow(IntegrationError);

        try {
          await provider.send({
            from: 'sender@example.com',
            to: 'recipient@example.com',
            subject: 'Hello',
            html: '<p>Test</p>'
          });
        } catch (err) {
          expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
          expect(err.provider).toBe('resend');
          expect(err.statusCode).toBe(500);
          expect(err.message).toContain('resend');
        }
      });
    });

    describe('NodemailerProvider with missing SDK', () => {
      test('send and verify throw MISSING_PROVIDER_DEPENDENCY when nodemailer is missing', async () => {
        const provider = new NodemailerProvider({
          host: 'smtp.example.com',
          port: 587,
          auth: { user: 'user@example.com', pass: 'secretpass' },
          loader: createMissingLoader('nodemailer')
        });

        await expect(
          provider.send({
            from: 'sender@example.com',
            to: 'recipient@example.com',
            subject: 'Test',
            text: 'Hello'
          })
        ).rejects.toThrow(IntegrationError);

        await expect(provider.verify()).rejects.toThrow(IntegrationError);
      });
    });

    describe('SESProvider with missing SDK', () => {
      test('send throws MISSING_PROVIDER_DEPENDENCY when @aws-sdk/client-ses is missing', async () => {
        const provider = new SESProvider({
          accessKeyId: 'AKIAEXAMPLE12345',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'us-east-1',
          loader: createMissingLoader('@aws-sdk/client-ses')
        });

        await expect(
          provider.send({
            from: 'sender@example.com',
            to: 'recipient@example.com',
            subject: 'SES Test',
            text: 'Hello from SES'
          })
        ).rejects.toThrow(IntegrationError);

        try {
          await provider.send({
            from: 'sender@example.com',
            to: 'recipient@example.com',
            subject: 'SES Test',
            text: 'Hello from SES'
          });
        } catch (err) {
          expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
          expect(err.provider).toBe('ses');
          expect(err.message).toContain('@aws-sdk/client-ses');
        }
      });
    });
  });

  describe('SMS Providers zero external dependencies', () => {
    test('MSG91 and MessageBird operate without third-party SDK dependencies', () => {
      const msg91 = new MSG91Provider({ authKey: 'msg91_auth_key_1234567890' });
      const mb = new MessageBirdProvider({ apiKey: 'mb_api_key_1234567890' });
      expect(msg91.name).toBe('msg91');
      expect(mb.name).toBe('messagebird');
    });
  });

  describe('Storage Providers Lazy Loading', () => {
    describe('CloudinaryProvider with missing SDK', () => {
      test('upload and delete throw MISSING_PROVIDER_DEPENDENCY when cloudinary is missing', async () => {
        const provider = new CloudinaryProvider({
          cloudName: 'my-cloud',
          apiKey: '123456789012345',
          apiSecret: 'abcdefghijklmnopqrstuvwxyz12345',
          loader: createMissingLoader('cloudinary')
        });

        await expect(
          provider.upload({ file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
        ).rejects.toThrow(IntegrationError);

        await expect(
          provider.delete({ publicId: 'sample-asset' })
        ).rejects.toThrow(IntegrationError);
      });

      test('getUrl generates fallback URL without failing when SDK is not loaded', () => {
        const provider = new CloudinaryProvider({
          cloudName: 'my-cloud',
          apiKey: '123456789012345',
          apiSecret: 'abcdefghijklmnopqrstuvwxyz12345',
          loader: createMissingLoader('cloudinary')
        });

        const res = provider.getUrl({ publicId: 'sample-image' });
        expect(res.success).toBe(true);
        expect(res.data.url).toContain('https://res.cloudinary.com/my-cloud/image/upload/sample-image');
      });
    });

    describe('S3Provider with missing SDKs', () => {
      test('upload throws MISSING_PROVIDER_DEPENDENCY when @aws-sdk/client-s3 is missing', async () => {
        const provider = new S3Provider({
          accessKeyId: 'AKIAEXAMPLE12345',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'ap-south-1',
          bucket: 'my-bucket',
          loader: createMissingLoader('@aws-sdk/client-s3')
        });

        await expect(
          provider.uploadBuffer({ buffer: Buffer.from('test'), key: 'test.txt' })
        ).rejects.toThrow(IntegrationError);

        try {
          await provider.uploadBuffer({ buffer: Buffer.from('test'), key: 'test.txt' });
        } catch (err) {
          expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
          expect(err.provider).toBe('s3');
          expect(err.message).toContain('@aws-sdk/client-s3');
        }
      });

      test('uploadStream throws MISSING_PROVIDER_DEPENDENCY when @aws-sdk/lib-storage is missing', async () => {
        const mockS3Client = { send: async () => ({}) };
        const provider = new S3Provider({
          accessKeyId: 'AKIAEXAMPLE12345',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'ap-south-1',
          bucket: 'my-bucket',
          client: mockS3Client,
          loader: createMissingLoader('@aws-sdk/lib-storage')
        });

        const { Readable } = await import('stream');
        const stream = Readable.from(['hello', 'world']);

        await expect(
          provider.uploadStream({ stream, key: 'stream.txt' })
        ).rejects.toThrow(IntegrationError);
      });

      test('getUrl({ signed: true }) throws MISSING_PROVIDER_DEPENDENCY when @aws-sdk/s3-request-presigner is missing', async () => {
        const mockS3Client = { send: async () => ({}) };
        const provider = new S3Provider({
          accessKeyId: 'AKIAEXAMPLE12345',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'ap-south-1',
          bucket: 'my-bucket',
          client: mockS3Client,
          loader: createMissingLoader('@aws-sdk/s3-request-presigner')
        });

        await expect(
          provider.getUrl({ key: 'doc.pdf', signed: true })
        ).rejects.toThrow(IntegrationError);
      });

      test('getUrl({ signed: false }) generates public URL without SDK dependency', async () => {
        const provider = new S3Provider({
          accessKeyId: 'AKIAEXAMPLE12345',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'ap-south-1',
          bucket: 'my-bucket',
          loader: createMissingLoader('@aws-sdk/client-s3')
        });

        const res = await provider.getUrl({ key: 'public.png', signed: false });
        expect(res.success).toBe(true);
        expect(res.data.url).toBe('https://my-bucket.s3.ap-south-1.amazonaws.com/public.png');
      });
    });
  });

  describe('Factory Distinction: UNSUPPORTED_PROVIDER vs MISSING_PROVIDER_DEPENDENCY', () => {
    test('Unsupported provider throws UNSUPPORTED_PROVIDER (400)', () => {
      expect(() =>
        createPaymentProvider({ provider: 'paypal', apiKey: 'test' })
      ).toThrow(IntegrationError);

      try {
        createPaymentProvider({ provider: 'paypal', apiKey: 'test' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }

      expect(() =>
        createEmailProvider({ provider: 'sendgrid', apiKey: 'test' })
      ).toThrow(IntegrationError);

      try {
        createEmailProvider({ provider: 'sendgrid', apiKey: 'test' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }

      expect(() =>
        createSMSProvider({ provider: 'sinch', accountSid: 'test' })
      ).toThrow(IntegrationError);

      try {
        createSMSProvider({ provider: 'sinch', accountSid: 'test' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }

      expect(() =>
        createStorageProvider({ provider: 'azure-blob', connectionString: 'test' })
      ).toThrow(IntegrationError);

      try {
        createStorageProvider({ provider: 'azure-blob', connectionString: 'test' });
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_PROVIDER');
        expect(err.statusCode).toBe(400);
      }
    });

    test('Supported provider with missing SDK returns instance and throws MISSING_PROVIDER_DEPENDENCY on operation', async () => {
      const payment = createPaymentProvider({
        provider: 'stripe',
        secretKey: 'sk_test_123',
        loader: createMissingLoader('stripe')
      });

      expect(payment).toBeInstanceOf(StripeProvider);
      await expect(payment.createOrder({ amount: 100, currency: 'USD' })).rejects.toThrow(IntegrationError);

      try {
        await payment.createOrder({ amount: 100, currency: 'USD' });
      } catch (err) {
        expect(err.code).toBe('MISSING_PROVIDER_DEPENDENCY');
        expect(err.statusCode).toBe(500);
        expect(err.provider).toBe('stripe');
      }
    });
  });

  describe('Import and Submodule Isolation', () => {
    test('all providers and submodules can be imported concurrently without runtime errors', () => {
      expect(RazorpayProvider).toBeDefined();
      expect(StripeProvider).toBeDefined();
      expect(CCAvenueProvider).toBeDefined();
      expect(ResendProvider).toBeDefined();
      expect(NodemailerProvider).toBeDefined();
      expect(SESProvider).toBeDefined();
      expect(MSG91Provider).toBeDefined();
      expect(MessageBirdProvider).toBeDefined();
      expect(CloudinaryProvider).toBeDefined();
      expect(S3Provider).toBeDefined();
    });
  });
});
