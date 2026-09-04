import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentProvider,
  createEmailProvider,
  createStorageProvider,
  IntegrationError
} from 'mern-integrations';

describe('D. Missing Optional Dependency Behavior', () => {
  it('Razorpay: should throw MISSING_PROVIDER_DEPENDENCY when razorpay is not installed', async () => {
    const provider = createPaymentProvider({
      provider: 'razorpay',
      keyId: 'rzp_test_123',
      keySecret: 'secret_123'
    });

    await assert.rejects(
      async () => {
        await provider.createOrder({
          amount: 50000,
          currency: 'INR',
          receipt: 'rcpt_1'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('razorpay'), true);
        assert.equal(err.message.includes('npm install razorpay'), true);
        assert.equal(err.details.dependency, 'razorpay');
        return true;
      }
    );
  });

  it('Stripe: should throw MISSING_PROVIDER_DEPENDENCY when stripe is not installed', async () => {
    const provider = createPaymentProvider({
      provider: 'stripe',
      secretKey: 'sk_test_123'
    });

    await assert.rejects(
      async () => {
        await provider.createOrder({
          amount: 5000,
          currency: 'USD'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('stripe'), true);
        assert.equal(err.message.includes('npm install stripe'), true);
        assert.equal(err.details.dependency, 'stripe');
        return true;
      }
    );
  });

  it('Resend: should throw MISSING_PROVIDER_DEPENDENCY when resend is not installed', async () => {
    const provider = createEmailProvider({
      provider: 'resend',
      apiKey: 're_123456'
    });

    await assert.rejects(
      async () => {
        await provider.send({
          from: 'test@example.com',
          to: 'recipient@example.com',
          subject: 'Hello',
          html: '<p>Test</p>'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('resend'), true);
        assert.equal(err.message.includes('npm install resend'), true);
        assert.equal(err.details.dependency, 'resend');
        return true;
      }
    );
  });

  it('Nodemailer: should throw MISSING_PROVIDER_DEPENDENCY when nodemailer is not installed', async () => {
    const provider = createEmailProvider({
      provider: 'nodemailer',
      host: 'smtp.mailtrap.io',
      port: 2525,
      auth: {
        user: 'user',
        pass: 'pass'
      }
    });

    await assert.rejects(
      async () => {
        await provider.send({
          from: 'test@example.com',
          to: 'recipient@example.com',
          subject: 'Hello',
          text: 'Test message'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('nodemailer'), true);
        assert.equal(err.message.includes('npm install nodemailer'), true);
        assert.equal(err.details.dependency, 'nodemailer');
        return true;
      }
    );
  });

  it('Amazon SES: should throw MISSING_PROVIDER_DEPENDENCY when @aws-sdk/client-ses is not installed', async () => {
    const provider = createEmailProvider({
      provider: 'ses',
      accessKeyId: 'AKIA_SAMPLE_KEY',
      secretAccessKey: 'SAMPLE_SECRET_KEY',
      region: 'us-east-1'
    });

    await assert.rejects(
      async () => {
        await provider.send({
          from: 'test@example.com',
          to: 'recipient@example.com',
          subject: 'Hello',
          html: '<p>Test</p>'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('@aws-sdk/client-ses'), true);
        assert.equal(err.message.includes('npm install @aws-sdk/client-ses'), true);
        assert.equal(err.details.dependency, '@aws-sdk/client-ses');
        return true;
      }
    );
  });

  it('Cloudinary: should throw MISSING_PROVIDER_DEPENDENCY when cloudinary is not installed', async () => {
    const provider = createStorageProvider({
      provider: 'cloudinary',
      cloudName: 'demo',
      apiKey: '123456',
      apiSecret: 'abcdef'
    });

    await assert.rejects(
      async () => {
        await provider.uploadBuffer({
          buffer: Buffer.from('sample-image-data'),
          folder: 'avatars'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('cloudinary'), true);
        assert.equal(err.message.includes('npm install cloudinary'), true);
        assert.equal(err.details.dependency, 'cloudinary');
        return true;
      }
    );
  });

  it('AWS S3: should throw MISSING_PROVIDER_DEPENDENCY when @aws-sdk/client-s3 is not installed', async () => {
    const provider = createStorageProvider({
      provider: 's3',
      accessKeyId: 'AKIA_SAMPLE_KEY',
      secretAccessKey: 'SAMPLE_SECRET_KEY',
      region: 'us-east-1',
      bucket: 'my-app-bucket'
    });

    await assert.rejects(
      async () => {
        await provider.uploadBuffer({
          buffer: Buffer.from('sample-file-data'),
          key: 'documents/invoice.pdf'
        });
      },
      (err) => {
        assert.equal(err instanceof IntegrationError, true);
        assert.equal(err.code, 'MISSING_PROVIDER_DEPENDENCY');
        assert.equal(err.statusCode, 500);
        assert.equal(err.message.includes('@aws-sdk/client-s3'), true);
        assert.equal(err.message.includes('npm install @aws-sdk/client-s3'), true);
        assert.equal(err.details.dependency, '@aws-sdk/client-s3');
        return true;
      }
    );
  });
});
