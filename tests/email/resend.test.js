import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createEmailProvider,
  EmailProvider,
  ResendProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('EmailProvider & Resend Integration', () => {
  const mockApiKey = 're_mock_apiKey_123456789';

  let mockClient;
  let provider;

  beforeEach(() => {
    mockClient = {
      emails: {
        send: jest.fn()
      }
    };

    provider = new ResendProvider({
      apiKey: mockApiKey,
      client: mockClient
    });
  });

  describe('Abstract EmailProvider Base Class', () => {
    test('should prevent direct instantiation of EmailProvider', () => {
      expect(() => new EmailProvider('test')).toThrow(IntegrationError);
      expect(() => new EmailProvider('test')).toThrow('abstract class');
    });

    test('unimplemented subclass send() should throw IntegrationError', async () => {
      class UnimplementedEmailProvider extends EmailProvider {
        constructor() {
          super('custom-email');
        }
      }

      const dummy = new UnimplementedEmailProvider();
      await expect(dummy.send({})).rejects.toThrow(IntegrationError);
    });
  });

  describe('EmailFactory', () => {
    test('should create ResendProvider when provider is "resend"', () => {
      const p = createEmailProvider({
        provider: 'resend',
        apiKey: mockApiKey
      });

      expect(p).toBeInstanceOf(ResendProvider);
      expect(p.name).toBe('resend');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createEmailProvider({ provider: 'RESEND', apiKey: mockApiKey });
      const p2 = createEmailProvider({ provider: '  resend  ', apiKey: mockApiKey });
      const p3 = createEmailProvider({ provider: 'Resend', apiKey: mockApiKey });

      expect(p1).toBeInstanceOf(ResendProvider);
      expect(p2).toBeInstanceOf(ResendProvider);
      expect(p3).toBeInstanceOf(ResendProvider);
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

      try {
        createEmailProvider({ provider: 'mailgun', apiKey: 'key-123' });
      } catch (error) {
        expect(error.code).toBe('UNSUPPORTED_PROVIDER');
        expect(error.statusCode).toBe(400);
        expect(error.provider).toBe('mailgun');
      }
    });
  });

  describe('ResendProvider Constructor', () => {
    test('should throw ValidationError if config is not a valid object', () => {
      expect(() => new ResendProvider(null)).toThrow(ValidationError);
      expect(() => new ResendProvider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if apiKey is missing, empty, or whitespace', () => {
      expect(() => new ResendProvider({})).toThrow(ValidationError);
      expect(() => new ResendProvider({ apiKey: '' })).toThrow(ValidationError);
      expect(() => new ResendProvider({ apiKey: '   ' })).toThrow(ValidationError);
    });

    test('should successfully instantiate with valid apiKey', () => {
      const p = new ResendProvider({ apiKey: mockApiKey, client: mockClient });
      expect(p).toBeInstanceOf(ResendProvider);
      expect(p.name).toBe('resend');
      expect(p.client).toBe(mockClient);
    });

    test('should not expose apiKey in Object.keys() or JSON.stringify()', () => {
      const keys = Object.keys(provider);
      expect(keys).not.toContain('apiKey');
      expect(keys).not.toContain('#apiKey');

      const serialized = JSON.stringify(provider);
      expect(serialized).not.toContain(mockApiKey);
    });
  });

  describe('send() Validation', () => {
    test('should validate required "from" field', async () => {
      await expect(
        provider.send({
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: '',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate required "to" recipient field and formats', async () => {
      // Missing to
      await expect(
        provider.send({
          from: 'sender@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      // Empty recipient array
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: [],
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      // Invalid single email format
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'not-an-email',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      // Invalid email in array
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: ['valid@example.com', 'invalid-email'],
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate required "subject" field', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: '   ',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate that at least one of "html" or "text" is provided as a non-empty string', async () => {
      // Missing both html and text
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test'
        })
      ).rejects.toThrow(ValidationError);

      // Empty html and missing text
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          html: '   '
        })
      ).rejects.toThrow(ValidationError);

      // Empty text and missing html
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: ''
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate optional replyTo, cc, and bcc if provided', async () => {
      // Invalid replyTo
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          replyTo: 'invalid-reply-to'
        })
      ).rejects.toThrow(ValidationError);

      // Invalid cc
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          cc: 'invalid-cc'
        })
      ).rejects.toThrow(ValidationError);

      // Empty cc array
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          cc: []
        })
      ).rejects.toThrow(ValidationError);

      // Invalid bcc
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          bcc: ['good@example.com', 'bad-bcc']
        })
      ).rejects.toThrow(ValidationError);

      // Empty bcc array
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          bcc: []
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate tags structure if provided', async () => {
      // Tags not array
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          tags: 'not-an-array'
        })
      ).rejects.toThrow(ValidationError);

      // Tag missing value
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
          tags: [{ name: 'category' }]
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Successful Email Sending', () => {
    test('should successfully send an HTML email and map parameters correctly', async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: { id: 'email_msg_123456789' },
        error: null
      });

      const response = await provider.send({
        from: 'App <noreply@app.com>',
        to: 'customer@example.com',
        subject: 'Welcome to App',
        html: '<h1>Welcome</h1>',
        replyTo: 'support@app.com',
        cc: 'manager@app.com',
        bcc: ['archive@app.com'],
        tags: [{ name: 'category', value: 'welcome' }]
      });

      expect(mockClient.emails.send).toHaveBeenCalledTimes(1);
      expect(mockClient.emails.send).toHaveBeenCalledWith({
        from: 'App <noreply@app.com>',
        to: 'customer@example.com',
        subject: 'Welcome to App',
        html: '<h1>Welcome</h1>',
        reply_to: 'support@app.com',
        cc: 'manager@app.com',
        bcc: ['archive@app.com'],
        tags: [{ name: 'category', value: 'welcome' }]
      });

      expect(response).toEqual({
        success: true,
        provider: 'resend',
        data: {
          id: 'email_msg_123456789'
        }
      });
    });

    test('should successfully send a plain text email with multiple recipients', async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: { id: 'email_msg_987654321' },
        error: null
      });

      const response = await provider.send({
        from: 'alerts@app.com',
        to: ['admin1@app.com', 'admin2@app.com'],
        subject: 'System Alert',
        text: 'Server disk space at 90%'
      });

      expect(mockClient.emails.send).toHaveBeenCalledWith({
        from: 'alerts@app.com',
        to: ['admin1@app.com', 'admin2@app.com'],
        subject: 'System Alert',
        text: 'Server disk space at 90%'
      });

      expect(response).toEqual({
        success: true,
        provider: 'resend',
        data: {
          id: 'email_msg_987654321'
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should convert Resend error response into IntegrationError', async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: {
          statusCode: 422,
          name: 'validation_error',
          message: 'The domain is not verified.'
        }
      });

      try {
        await provider.send({
          from: 'unverified@custom.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false); // Should not be reached
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationError);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(422);
        expect(error.provider).toBe('resend');
        expect(error.message).toBe('The domain is not verified.');
        expect(error.toJSON()).toEqual({
          success: false,
          provider: 'resend',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The domain is not verified.',
            details: { name: 'validation_error' }
          }
        });
      }
    });

    test('should convert thrown SDK exception into IntegrationError', async () => {
      mockClient.emails.send.mockRejectedValueOnce(new Error('Network connection reset'));

      try {
        await provider.send({
          from: 'sender@app.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationError);
        expect(error.code).toBe('PROVIDER_ERROR');
        expect(error.statusCode).toBe(502);
        expect(error.provider).toBe('resend');
        expect(error.message).toBe('Network connection reset');
      }
    });

    test('should throw IntegrationError if SDK returns missing data id', async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: {},
        error: null
      });

      await expect(
        provider.send({
          from: 'sender@app.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(IntegrationError);
    });

    test('should not leak API secrets in error serialization', () => {
      const err = new IntegrationError('Sending failed', {
        code: 'PROVIDER_ERROR',
        statusCode: 502,
        provider: 'resend',
        details: { step: 'network' }
      });

      const serialized = JSON.stringify(err.toJSON());
      expect(serialized).not.toContain(mockApiKey);
      expect(err.toJSON()).toEqual({
        success: false,
        provider: 'resend',
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Sending failed',
          details: { step: 'network' }
        }
      });
    });
  });
});
