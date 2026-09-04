import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createSMSProvider,
  SMSProvider,
  MessageBirdProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('MessageBirdProvider & WhatsApp / SMS Integration', () => {
  const mockApiKey = 'live_mock_access_key_12345';
  const mockChannelId = 'c6901844-4861-4194-9118-090f7797825b';
  const mockNamespace = 'ns_messagebird_whatsapp_template_01';
  let mockFetch;
  let provider;

  beforeEach(() => {
    mockFetch = jest.fn();
    provider = new MessageBirdProvider({
      apiKey: mockApiKey,
      channelId: mockChannelId,
      namespace: mockNamespace,
      baseUrl: 'https://conversations.messagebird.com',
      fetch: mockFetch
    });
  });

  describe('Constructor & Credentials Validation', () => {
    test('should throw ValidationError if config is not a valid object', () => {
      expect(() => new MessageBirdProvider(null)).toThrow(ValidationError);
      expect(() => new MessageBirdProvider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if apiKey is missing, empty, or whitespace', () => {
      expect(() => new MessageBirdProvider({})).toThrow(ValidationError);
      expect(() => new MessageBirdProvider({ apiKey: '' })).toThrow(ValidationError);
      expect(() => new MessageBirdProvider({ apiKey: '   ' })).toThrow(ValidationError);
    });

    test('should successfully instantiate with valid apiKey and optional parameters', () => {
      const p = new MessageBirdProvider({ apiKey: mockApiKey });
      expect(p).toBeInstanceOf(MessageBirdProvider);
      expect(p).toBeInstanceOf(SMSProvider);
      expect(p.name).toBe('messagebird');
    });

    test('private credentials should not be exposed on instance properties', () => {
      expect(provider.apiKey).toBeUndefined();
      expect(provider['#apiKey']).toBeUndefined();
      expect(Object.keys(provider)).not.toContain('apiKey');
      expect(JSON.stringify(provider)).not.toContain(mockApiKey);
    });

    test('should redact apiKey in thrown error messages', async () => {
      mockFetch.mockRejectedValueOnce(new Error(`Failed to connect with key ${mockApiKey}`));

      try {
        await provider.sendSMS({ to: '31612345678', message: 'Hello' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.message).not.toContain(mockApiKey);
        expect(err.message).toContain('[REDACTED]');
      }
    });
  });

  describe('SMSFactory for MessageBird', () => {
    test('should create MessageBirdProvider when provider is "messagebird"', () => {
      const p = createSMSProvider({
        provider: 'messagebird',
        apiKey: mockApiKey,
        channelId: mockChannelId,
        namespace: mockNamespace
      });

      expect(p).toBeInstanceOf(MessageBirdProvider);
      expect(p.name).toBe('messagebird');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createSMSProvider({ provider: 'MESSAGEBIRD', apiKey: mockApiKey });
      const p2 = createSMSProvider({ provider: '  messagebird  ', apiKey: mockApiKey });
      const p3 = createSMSProvider({ provider: 'MessageBird', apiKey: mockApiKey });

      expect(p1).toBeInstanceOf(MessageBirdProvider);
      expect(p2).toBeInstanceOf(MessageBirdProvider);
      expect(p3).toBeInstanceOf(MessageBirdProvider);
    });

    test('should throw ValidationError if config is missing or invalid', () => {
      expect(() => createSMSProvider(null)).toThrow(ValidationError);
      expect(() => createSMSProvider({})).toThrow(ValidationError);
      expect(() => createSMSProvider({ provider: '' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError for unsupported SMS providers', () => {
      expect(() =>
        createSMSProvider({ provider: 'unsupported_sms', apiKey: 'key-123' })
      ).toThrow(IntegrationError);

      try {
        createSMSProvider({ provider: 'twilio', apiKey: 'key-123' });
      } catch (error) {
        expect(error.code).toBe('UNSUPPORTED_PROVIDER');
        expect(error.statusCode).toBe(400);
        expect(error.provider).toBe('twilio');
      }
    });
  });

  describe('sendWhatsApp()', () => {
    test('should validate required recipients and template identifier', async () => {
      // Missing to
      await expect(
        provider.sendWhatsApp({ templateName: 'welcome_template' })
      ).rejects.toThrow(ValidationError);

      // Empty to array
      await expect(
        provider.sendWhatsApp({ to: [], templateName: 'welcome_template' })
      ).rejects.toThrow(ValidationError);

      // Invalid mobile recipient
      await expect(
        provider.sendWhatsApp({ to: 'invalid_number', templateName: 'welcome_template' })
      ).rejects.toThrow(ValidationError);

      // Missing templateName
      await expect(
        provider.sendWhatsApp({ to: '31612345678' })
      ).rejects.toThrow(ValidationError);
      await expect(
        provider.sendWhatsApp({ to: '31612345678', templateName: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should require channelId if not set in constructor', async () => {
      const pNoChannel = new MessageBirdProvider({
        apiKey: mockApiKey,
        fetch: mockFetch
      });

      await expect(
        pNoChannel.sendWhatsApp({
          to: '31612345678',
          templateName: 'order_update'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate variables and components data types', async () => {
      await expect(
        provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'order_update',
          variables: 'invalid_string'
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'order_update',
          components: 'invalid_components_string'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully send WhatsApp HSM message with simple array variables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'mb_conv_msg_101',
          status: 'pending',
          to: '+31612345678',
          from: mockChannelId,
          type: 'hsm'
        })
      });

      const result = await provider.sendWhatsApp({
        to: '+31 6 12345678',
        templateName: 'order_notification',
        variables: ['John', 'ORD-999']
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://conversations.messagebird.com/v1/send', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${mockApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: '+31612345678',
          from: mockChannelId,
          type: 'hsm',
          content: {
            hsm: {
              templateName: 'order_notification',
              language: { code: 'en' },
              namespace: mockNamespace,
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: 'John' },
                    { type: 'text', text: 'ORD-999' }
                  ]
                }
              ]
            }
          }
        })
      });

      expect(result).toEqual({
        success: true,
        provider: 'messagebird',
        data: {
          id: 'mb_conv_msg_101',
          status: 'pending',
          recipients: '31612345678',
          raw: {
            id: 'mb_conv_msg_101',
            status: 'pending',
            to: '+31612345678',
            from: mockChannelId,
            type: 'hsm'
          }
        }
      });
    });

    test('should support templateId alias, object variables, and custom language', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'mb_conv_msg_102',
          status: 'sent'
        })
      });

      const result = await provider.sendWhatsApp({
        to: '31612345678',
        templateId: 'otp_verification',
        language: 'nl',
        variables: {
          code: '654321'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith('https://conversations.messagebird.com/v1/send', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${mockApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: '+31612345678',
          from: mockChannelId,
          type: 'hsm',
          content: {
            hsm: {
              templateName: 'otp_verification',
              language: { code: 'nl' },
              namespace: mockNamespace,
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: '654321' }]
                }
              ]
            }
          }
        })
      });

      expect(result.data.id).toBe('mb_conv_msg_102');
    });

    test('should preserve advanced custom components and override channelId per call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'mb_conv_msg_custom',
          status: 'sent'
        })
      });

      const customChannel = 'custom-channel-id-8899';
      const customComponents = [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { url: 'https://example.com/logo.png' } }]
        },
        {
          type: 'body',
          parameters: [{ type: 'text', text: 'Custom Header Message' }]
        }
      ];

      await provider.sendWhatsApp({
        to: '31612345678',
        templateName: 'media_alert',
        channelId: customChannel,
        components: customComponents
      });

      expect(mockFetch).toHaveBeenCalledWith('https://conversations.messagebird.com/v1/send', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${mockApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: '+31612345678',
          from: customChannel,
          type: 'hsm',
          content: {
            hsm: {
              templateName: 'media_alert',
              language: { code: 'en' },
              namespace: mockNamespace,
              components: customComponents
            }
          }
        })
      });
    });

    test('should handle array of recipients by sending to each recipient', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'mb_msg_1', status: 'sent' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'mb_msg_2', status: 'sent' })
        });

      const result = await provider.sendWhatsApp({
        to: ['+31 6 11111111', '+31 6 22222222'],
        templateName: 'batch_template'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data.id).toEqual(['mb_msg_1', 'mb_msg_2']);
      expect(result.data.recipients).toEqual(['31611111111', '31622222222']);
    });
  });

  describe('sendSMS()', () => {
    test('should validate recipients and required message', async () => {
      await expect(provider.sendSMS({ message: 'Hello' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: [], message: 'Hello' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: '31612345678' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: '31612345678', message: '' })).rejects.toThrow(
        ValidationError
      );
    });

    test('should successfully send SMS to single recipient via REST API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'mb_sms_1001',
          recipients: {
            totalCount: 1,
            items: [{ recipient: 31612345678, status: 'sent' }]
          }
        })
      });

      const result = await provider.sendSMS({
        to: '+31 6 12345678',
        message: 'Your order is confirmed',
        originator: 'MYAPP'
      });

      expect(mockFetch).toHaveBeenCalledWith('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${mockApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: ['31612345678'],
          body: 'Your order is confirmed',
          originator: 'MYAPP'
        })
      });

      expect(result).toEqual({
        success: true,
        provider: 'messagebird',
        data: {
          id: 'mb_sms_1001',
          status: 'sent',
          recipients: '31612345678',
          raw: {
            id: 'mb_sms_1001',
            recipients: {
              totalCount: 1,
              items: [{ recipient: 31612345678, status: 'sent' }]
            }
          }
        }
      });
    });

    test('should successfully send SMS to multiple recipients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'mb_sms_multi_2002',
          recipients: {
            totalCount: 2,
            items: [
              { recipient: 31612345678, status: 'sent' },
              { recipient: 31687654321, status: 'sent' }
            ]
          }
        })
      });

      const result = await provider.sendSMS({
        to: ['31612345678', '31687654321'],
        message: 'Broadcast message'
      });

      expect(mockFetch).toHaveBeenCalledWith('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${mockApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: ['31612345678', '31687654321'],
          body: 'Broadcast message',
          originator: 'SMS'
        })
      });

      expect(result.data.id).toBe('mb_sms_multi_2002');
      expect(result.data.recipients).toEqual(['31612345678', '31687654321']);
    });
  });

  describe('Error Handling & HTTP Status Codes', () => {
    test('should throw IntegrationError on HTTP 400 with MessageBird error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [
            {
              code: 9,
              description: 'no (correct) recipients found'
            }
          ]
        })
      });

      try {
        await provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'bad_template'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('no (correct) recipients found');
      }
    });

    test('should throw IntegrationError on HTTP 401 with AUTHENTICATION_ERROR code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          errors: [
            {
              code: 1001,
              description: 'You are requesting with an invalid credential.'
            }
          ]
        })
      });

      try {
        await provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'test_template'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(401);
      }
    });

    test('should throw IntegrationError on HTTP 403 with AUTHENTICATION_ERROR code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          errors: [
            {
              code: 1002,
              description: 'Access denied'
            }
          ]
        })
      });

      try {
        await provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'test_template'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
      }
    });

    test('should throw IntegrationError on HTTP 429 with RATE_LIMIT_EXCEEDED code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          errors: [
            {
              code: 1003,
              description: 'Rate limit exceeded'
            }
          ]
        })
      });

      try {
        await provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'test_template'
        });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(err.statusCode).toBe(429);
      }
    });

    test('should throw IntegrationError on HTTP 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          errors: [{ code: 1000, description: 'Internal server error' }]
        })
      });

      await expect(
        provider.sendSMS({ to: '31612345678', message: 'Hello' })
      ).rejects.toThrow(IntegrationError);
    });

    test('should handle non-JSON HTML 502 Bad Gateway response safely without crash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      });

      await expect(
        provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'test_template'
        })
      ).rejects.toThrow(IntegrationError);
    });

    test('should throw IntegrationError on network socket error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection reset by peer'));

      await expect(
        provider.sendWhatsApp({
          to: '31612345678',
          templateName: 'test_template'
        })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('Unsupported OTP Operations', () => {
    test('sendOTP should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      try {
        await provider.sendOTP({ mobile: '31612345678' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
        expect(err.provider).toBe('messagebird');
      }
    });

    test('verifyOTP should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      try {
        await provider.verifyOTP({ mobile: '31612345678', otp: '1234' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
        expect(err.provider).toBe('messagebird');
      }
    });

    test('resendOTP should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      try {
        await provider.resendOTP({ mobile: '31612345678' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
        expect(err.provider).toBe('messagebird');
      }
    });
  });
});
