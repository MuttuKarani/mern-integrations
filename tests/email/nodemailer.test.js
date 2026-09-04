import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createEmailProvider,
  EmailProvider,
  NodemailerProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('NodemailerProvider & SMTP Email Integration', () => {
  const mockSmtpHost = 'smtp.example.com';
  const mockSmtpPort = 587;
  const mockUser = 'testuser@example.com';
  const mockPass = 'secret_smtp_password_123';

  let mockTransporter;
  let provider;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn()
    };

    provider = new NodemailerProvider({
      host: mockSmtpHost,
      port: mockSmtpPort,
      auth: {
        user: mockUser,
        pass: mockPass
      },
      transporter: mockTransporter
    });
  });

  describe('EmailFactory for Nodemailer', () => {
    test('should create NodemailerProvider when provider is "nodemailer"', () => {
      const p = createEmailProvider({
        provider: 'nodemailer',
        host: mockSmtpHost,
        port: mockSmtpPort,
        auth: { user: mockUser, pass: mockPass }
      });

      expect(p).toBeInstanceOf(NodemailerProvider);
      expect(p).toBeInstanceOf(EmailProvider);
      expect(p.name).toBe('nodemailer');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createEmailProvider({ provider: 'NODEMAILER', host: mockSmtpHost });
      const p2 = createEmailProvider({ provider: '  nodemailer  ', host: mockSmtpHost });
      const p3 = createEmailProvider({ provider: 'Nodemailer', host: mockSmtpHost });

      expect(p1).toBeInstanceOf(NodemailerProvider);
      expect(p2).toBeInstanceOf(NodemailerProvider);
      expect(p3).toBeInstanceOf(NodemailerProvider);
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

  describe('Constructor & Credentials Validation', () => {
    test('should throw ValidationError if config is not an object', () => {
      expect(() => new NodemailerProvider(null)).toThrow(ValidationError);
      expect(() => new NodemailerProvider('smtp://localhost')).toThrow(ValidationError);
    });

    test('should throw ValidationError if both host and service are missing without transporter', () => {
      expect(() => new NodemailerProvider({})).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ port: 587 })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: '' })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ service: '' })).toThrow(ValidationError);
    });

    test('should instantiate successfully with service name', () => {
      const p = new NodemailerProvider({
        service: 'gmail',
        auth: { user: mockUser, pass: mockPass }
      });
      expect(p).toBeInstanceOf(NodemailerProvider);
      expect(p.name).toBe('nodemailer');
    });

    test('should instantiate successfully with custom host and port', () => {
      const p = new NodemailerProvider({
        host: 'smtp.mailtrap.io',
        port: 2525,
        secure: false,
        auth: { user: mockUser, pass: mockPass }
      });
      expect(p).toBeInstanceOf(NodemailerProvider);
    });

    test('should validate port range if provided', () => {
      expect(() => new NodemailerProvider({ host: mockSmtpHost, port: 0 })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, port: -25 })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, port: 70000 })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, port: '587' })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, port: 587.5 })).toThrow(ValidationError);
    });

    test('should validate auth object structure and credentials', () => {
      expect(() => new NodemailerProvider({ host: mockSmtpHost, auth: 'invalid-auth' })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, auth: { user: '' } })).toThrow(ValidationError);
      expect(() => new NodemailerProvider({ host: mockSmtpHost, auth: { pass: '' } })).toThrow(ValidationError);
    });

    test('should accept top-level user and pass convenience options', () => {
      const p = new NodemailerProvider({
        host: mockSmtpHost,
        user: mockUser,
        pass: mockPass
      });
      expect(p).toBeInstanceOf(NodemailerProvider);
    });

    test('should allow custom transporter dependency injection', () => {
      const customMock = { sendMail: jest.fn(), verify: jest.fn() };
      const p = new NodemailerProvider({ transporter: customMock });
      expect(p).toBeInstanceOf(NodemailerProvider);
      expect(p.transporter).toBe(customMock);
    });

    test('should never expose credentials on instance properties or JSON.stringify', () => {
      const p = new NodemailerProvider({
        host: mockSmtpHost,
        port: mockSmtpPort,
        auth: { user: mockUser, pass: mockPass }
      });

      expect(p.pass).toBeUndefined();
      expect(p.auth).toBeUndefined();
      expect(p['#pass']).toBeUndefined();
      expect(p['#auth']).toBeUndefined();
      expect(JSON.stringify(p)).not.toContain(mockPass);
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
          to: 'not-an-email',
          subject: 'Test',
          text: 'Hello'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: ['valid@example.com', 'bad-recipient'],
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
          replyTo: 'invalid-email'
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

    test('should validate attachments and headers data types if provided', async () => {
      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          attachments: 'not-an-array'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.send({
          from: 'sender@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
          headers: 'not-an-object'
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('send() Execution', () => {
    test('should successfully send an HTML and text email with normalized response', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: '<msg-12345@example.com>',
        accepted: ['customer@example.com'],
        rejected: [],
        response: '250 2.0.0 OK: message queued'
      });

      const result = await provider.send({
        from: '"My MERN App" <noreply@example.com>',
        to: 'customer@example.com',
        subject: 'Welcome!',
        html: '<h1>Welcome!</h1>',
        text: 'Welcome!',
        replyTo: 'support@example.com',
        cc: 'manager@example.com',
        bcc: ['audit@example.com'],
        attachments: [
          { filename: 'guide.pdf', content: 'dummy-pdf-content' }
        ],
        headers: {
          'X-Priority': '1'
        }
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"My MERN App" <noreply@example.com>',
        to: 'customer@example.com',
        subject: 'Welcome!',
        html: '<h1>Welcome!</h1>',
        text: 'Welcome!',
        replyTo: 'support@example.com',
        cc: 'manager@example.com',
        bcc: ['audit@example.com'],
        attachments: [
          { filename: 'guide.pdf', content: 'dummy-pdf-content' }
        ],
        headers: {
          'X-Priority': '1'
        }
      });

      expect(result).toEqual({
        success: true,
        provider: 'nodemailer',
        data: {
          id: '<msg-12345@example.com>',
          accepted: ['customer@example.com'],
          rejected: [],
          response: '250 2.0.0 OK: message queued',
          raw: {
            messageId: '<msg-12345@example.com>',
            accepted: ['customer@example.com'],
            rejected: [],
            response: '250 2.0.0 OK: message queued'
          }
        }
      });
    });

    test('should support multiple recipients in "to"', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: '<multi-123@example.com>',
        accepted: ['u1@example.com', 'u2@example.com'],
        rejected: []
      });

      const result = await provider.send({
        from: 'alerts@example.com',
        to: ['u1@example.com', 'u2@example.com'],
        subject: 'Broadcast',
        text: 'System upgrade scheduled'
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['u1@example.com', 'u2@example.com']
        })
      );
      expect(result.data.id).toBe('<multi-123@example.com>');
      expect(result.data.accepted).toEqual(['u1@example.com', 'u2@example.com']);
    });
  });

  describe('verify()', () => {
    test('should successfully verify SMTP connection', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true);

      const result = await provider.verify();

      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        provider: 'nodemailer',
        data: {
          verified: true
        }
      });
    });

    test('should handle verify() failure and normalize into IntegrationError', async () => {
      mockTransporter.verify.mockRejectedValueOnce({
        code: 'EAUTH',
        responseCode: 535,
        message: 'Invalid login: 535 5.7.8 Username and Password not accepted'
      });

      try {
        await provider.verify();
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(401);
        expect(err.provider).toBe('nodemailer');
      }
    });
  });

  describe('Error Handling & Security', () => {
    test('should map EAUTH error to AUTHENTICATION_ERROR (401)', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce({
        code: 'EAUTH',
        responseCode: 535,
        message: 'Invalid login 535 5.7.8 Authentication credentials invalid'
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
        expect(err.statusCode).toBe(401);
        expect(err.provider).toBe('nodemailer');
      }
    });

    test('should map SMTP 535 error response to AUTHENTICATION_ERROR (401)', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce({
        responseCode: 535,
        response: '535 5.7.8 Error: authentication failed: authentication failure',
        message: '535 5.7.8 Error: authentication failed'
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
        expect(err.statusCode).toBe(401);
      }
    });

    test('should map ETIMEDOUT error to PROVIDER_ERROR with 504 status', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce({
        code: 'ETIMEDOUT',
        message: 'Connection timeout while connecting to SMTP host'
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
        expect(err.statusCode).toBe(504);
      }
    });

    test('should map ECONNREFUSED and ESOCKET errors to PROVIDER_ERROR with 502 status', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:587'
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
        expect(err.statusCode).toBe(502);
      }
    });

    test('should never expose password in error messages or error serialization', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce({
        code: 'EENVELOPE',
        message: `SMTP rejected payload with password ${mockPass}`
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
        const serialized = JSON.stringify(err.toJSON());
        expect(serialized).not.toContain(mockPass);
        expect(err.message).toContain('[REDACTED]');
      }
    });
  });
});
