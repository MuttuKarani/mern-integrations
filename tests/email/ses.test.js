import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createEmailProvider,
  EmailProvider,
  SESProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';
import { SendEmailCommand } from '@aws-sdk/client-ses';

describe('SESProvider & Amazon SES Email Integration', () => {
  const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const mockSecretAccessKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const mockRegion = 'us-east-1';

  let mockClient;
  let provider;

  beforeEach(() => {
    mockClient = {
      send: jest.fn()
    };

    provider = new SESProvider({
      accessKeyId: mockAccessKeyId,
      secretAccessKey: mockSecretAccessKey,
      region: mockRegion,
      client: mockClient
    });
  });

  describe('EmailFactory for SES', () => {
    test('should create SESProvider when provider is "ses", "amazon-ses", or "amazonses"', () => {
      const p1 = createEmailProvider({ provider: 'ses', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });
      const p2 = createEmailProvider({ provider: 'amazon-ses', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });
      const p3 = createEmailProvider({ provider: 'amazonses', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });

      expect(p1).toBeInstanceOf(SESProvider);
      expect(p1).toBeInstanceOf(EmailProvider);
      expect(p1.name).toBe('ses');

      expect(p2).toBeInstanceOf(SESProvider);
      expect(p3).toBeInstanceOf(SESProvider);
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createEmailProvider({ provider: 'SES', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });
      const p2 = createEmailProvider({ provider: '  ses  ', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });
      const p3 = createEmailProvider({ provider: '  Amazon-SES  ', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion });

      expect(p1).toBeInstanceOf(SESProvider);
      expect(p2).toBeInstanceOf(SESProvider);
      expect(p3).toBeInstanceOf(SESProvider);
    });

    test('should throw ValidationError if config is missing or invalid', () => {
      expect(() => createEmailProvider(null)).toThrow(ValidationError);
      expect(() => createEmailProvider({})).toThrow(ValidationError);
      expect(() => createEmailProvider({ provider: '' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError for unsupported email providers', () => {
      expect(() =>
        createEmailProvider({ provider: 'sendgrid', apiKey: 'SG.123' })
      ).toThrow(IntegrationError);
    });
  });

  describe('Constructor & Credentials Validation', () => {
    test('should throw ValidationError if config is not an object', () => {
      expect(() => new SESProvider(null)).toThrow(ValidationError);
      expect(() => new SESProvider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if accessKeyId is missing or empty', () => {
      expect(() => new SESProvider({ secretAccessKey: mockSecretAccessKey, region: mockRegion })).toThrow(ValidationError);
      expect(() => new SESProvider({ accessKeyId: '', secretAccessKey: mockSecretAccessKey, region: mockRegion })).toThrow(ValidationError);
      expect(() => new SESProvider({ accessKeyId: '   ', secretAccessKey: mockSecretAccessKey, region: mockRegion })).toThrow(ValidationError);
    });

    test('should throw ValidationError if secretAccessKey is missing or empty', () => {
      expect(() => new SESProvider({ accessKeyId: mockAccessKeyId, region: mockRegion })).toThrow(ValidationError);
      expect(() => new SESProvider({ accessKeyId: mockAccessKeyId, secretAccessKey: '', region: mockRegion })).toThrow(ValidationError);
    });

    test('should throw ValidationError if region is missing or empty', () => {
      expect(() => new SESProvider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey })).toThrow(ValidationError);
      expect(() => new SESProvider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: '' })).toThrow(ValidationError);
    });

    test('should support custom SESClient injection', () => {
      const customClient = { send: jest.fn() };
      const p = new SESProvider({ client: customClient });
      expect(p).toBeInstanceOf(SESProvider);
      expect(p.client).toBe(customClient);
    });

    test('should instantiate successfully with valid credentials and configurationSetName', () => {
      const p = new SESProvider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        configurationSetName: 'my-config-set'
      });
      expect(p).toBeInstanceOf(SESProvider);
      expect(p.name).toBe('ses');
    });

    test('should never expose credentials on instance properties or JSON.stringify', () => {
      const p = new SESProvider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion
      });

      expect(p.accessKeyId).toBeUndefined();
      expect(p.secretAccessKey).toBeUndefined();
      expect(p['#accessKeyId']).toBeUndefined();
      expect(p['#secretAccessKey']).toBeUndefined();
      expect(JSON.stringify(p)).not.toContain(mockSecretAccessKey);
    });
  });

  describe('send() Validation', () => {
    test('should validate required "from" field', async () => {
      await expect(
        provider.send({
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: '',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate required "to" recipient field and formats', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: [],
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'invalid-email',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: ['valid@example.com', 'bad-email'],
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate required "subject" field', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: '   ',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate that at least one of "html" or "text" is provided as non-empty string', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          html: '   '
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: ''
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate optional replyTo, cc, and bcc if provided', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          replyTo: 'invalid-reply'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          cc: ['good@example.com', 'bad-cc']
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          bcc: []
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate tags structure if provided', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          tags: 'not-an-array'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          tags: [{ name: 'category' }]
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('send() Execution', () => {
    test('should successfully send an HTML and text email with normalized response', async () => {
      mockClient.send.mockResolvedValueOnce({
        MessageId: '0100017e-9821-4a3b-b892-123456789abc-000000'
      });

      const result = await provider.send({
        from: 'My App <sender@example.com>',
        to: 'customer@example.com',
        subject: 'Welcome to our platform!',
        html: '<h1>Welcome!</h1>',
        text: 'Welcome!',
        replyTo: 'support@example.com',
        cc: 'manager@example.com',
        bcc: ['archive@example.com'],
        configurationSetName: 'custom-config-set',
        tags: [
          { name: 'Environment', value: 'Production' }
        ]
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendEmailCommand);
      expect(command.input).toEqual({
        Source: 'My App <sender@example.com>',
        Destination: {
          ToAddresses: ['customer@example.com'],
          CcAddresses: ['manager@example.com'],
          BccAddresses: ['archive@example.com']
        },
        Message: {
          Subject: {
            Data: 'Welcome to our platform!',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: '<h1>Welcome!</h1>',
              Charset: 'UTF-8'
            },
            Text: {
              Data: 'Welcome!',
              Charset: 'UTF-8'
            }
          }
        },
        ReplyToAddresses: ['support@example.com'],
        ConfigurationSetName: 'custom-config-set',
        Tags: [{ Name: 'Environment', Value: 'Production' }]
      });

      expect(result).toEqual({
        success: true,
        provider: 'ses',
        data: {
          id: '0100017e-9821-4a3b-b892-123456789abc-000000',
          raw: {
            MessageId: '0100017e-9821-4a3b-b892-123456789abc-000000'
          }
        }
      });
    });

    test('should support multiple recipients in "to" and constructor configurationSetName fallback', async () => {
      const configuredProvider = new SESProvider({
        client: mockClient,
        configurationSetName: 'default-config-set'
      });

      mockClient.send.mockResolvedValueOnce({
        MessageId: '0100017e-multi-recipients-msg-id'
      });

      const result = await configuredProvider.send({
        from: 'alerts@example.com',
        to: ['u1@example.com', 'u2@example.com'],
        subject: 'System Maintenance',
        text: 'Maintenance tonight at 10 PM'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command.input.Destination.ToAddresses).toEqual(['u1@example.com', 'u2@example.com']);
      expect(command.input.ConfigurationSetName).toBe('default-config-set');
      expect(result.data.id).toBe('0100017e-multi-recipients-msg-id');
    });

    test('should throw IntegrationError if SES does not return MessageId', async () => {
      mockClient.send.mockResolvedValueOnce({});

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('Error Handling & Security', () => {
    test('should map AccessDenied error to AUTHENTICATION_ERROR (403)', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'AccessDenied',
        message: 'User is not authorized to perform: ses:SendEmail',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
        expect(err.provider).toBe('ses');
      }
    });

    test('should map InvalidAccessKeyId error to AUTHENTICATION_ERROR (403)', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'InvalidAccessKeyId',
        message: 'The AWS Access Key Id you provided does not exist in our records.',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
      }
    });

    test('should map SignatureDoesNotMatch error to AUTHENTICATION_ERROR (403)', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'SignatureDoesNotMatch',
        message: 'The request signature we calculated does not match the signature you provided.',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
      }
    });

    test('should map MessageRejected error to PROVIDER_ERROR with 400 status', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'MessageRejected',
        message: 'Email address is not verified. The following identities failed the check: customer@example.com',
        $metadata: { httpStatusCode: 400 }
      });

      try {
        await provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
        expect(err.provider).toBe('ses');
      }
    });

    test('should map MailFromDomainNotVerifiedException to PROVIDER_ERROR with 400 status', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'MailFromDomainNotVerifiedException',
        message: 'The custom MAIL FROM domain is not verified',
        $metadata: { httpStatusCode: 400 }
      });

      try {
        await provider.send({
          from: 'sender@unverified-domain.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
      }
    });

    test('should map ConfigurationSetDoesNotExistException to PROVIDER_ERROR with 400 status', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'ConfigurationSetDoesNotExistException',
        message: 'Configuration set does not exist',
        $metadata: { httpStatusCode: 400 }
      });

      try {
        await provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          configurationSetName: 'non-existent-config-set'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
      }
    });

    test('should never expose secretAccessKey in error messages or error serialization', async () => {
      const providerWithSecrets = new SESProvider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        client: mockClient
      });

      mockClient.send.mockRejectedValueOnce({
        name: 'InternalError',
        message: `AWS SES server error occurred with key ${mockSecretAccessKey}`
      });

      try {
        await providerWithSecrets.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        const serialized = JSON.stringify(err.toJSON());
        expect(serialized).not.toContain(mockSecretAccessKey);
        expect(err.message).toContain('[REDACTED]');
      }
    });
  });
});
