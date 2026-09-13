import crypto from 'crypto';
import { TwilioProvider } from '../../src/sms/providers/twilio/TwilioProvider.js';
import { createSMSProvider } from '../../src/sms/factories/SMSFactory.js';
import { SMSProvider } from '../../src/sms/interfaces/SMSProvider.js';
import { ValidationError } from '../../src/core/errors/ValidationError.js';
import { IntegrationError } from '../../src/core/errors/IntegrationError.js';

describe('TwilioProvider & Twilio SMS/WhatsApp/Verify Integration', () => {
  const validConfig = {
    accountSid: 'AC_test_account_sid_12345',
    authToken: 'secret_auth_token_99999',
    from: '+15005550006',
    verifyServiceSid: 'VA_test_verify_sid_12345',
    whatsappFrom: '+14155238886'
  };

  describe('Constructor & Credentials Validation', () => {
    it('should throw ValidationError if config is missing or invalid', () => {
      expect(() => new TwilioProvider(null)).toThrow(ValidationError);
      expect(() => new TwilioProvider(undefined)).toThrow(ValidationError);
      expect(() => new TwilioProvider('string')).toThrow(ValidationError);
    });

    it('should throw ValidationError if accountSid or authToken is missing or empty', () => {
      expect(() => new TwilioProvider({})).toThrow(ValidationError);
      expect(() => new TwilioProvider({ accountSid: '', authToken: 'sec' })).toThrow(ValidationError);
      expect(() => new TwilioProvider({ accountSid: 'AC_1', authToken: '   ' })).toThrow(ValidationError);
    });

    it('should instantiate successfully with valid credentials and inherit SMSProvider', () => {
      const provider = new TwilioProvider(validConfig);
      expect(provider).toBeInstanceOf(SMSProvider);
      expect(provider).toBeInstanceOf(TwilioProvider);
      expect(provider.name).toBe('twilio');
      expect(provider.capabilities).toEqual(['sendSMS', 'sendOTP', 'verifyOTP', 'sendWhatsApp', 'verifyWebhook']);
      expect(Object.isFrozen(provider.capabilities)).toBe(true);
    });

    it('should never expose authToken in Object.keys or JSON.stringify', () => {
      const provider = new TwilioProvider(validConfig);
      expect(Object.keys(provider)).not.toContain('authToken');
      expect(JSON.stringify(provider)).not.toContain('secret_auth_token_99999');
    });
  });

  describe('sendSMS()', () => {
    it('should validate required recipient number and message', async () => {
      const provider = new TwilioProvider(validConfig);
      await expect(provider.sendSMS({ to: '', message: 'hi' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: 'invalid_num', message: 'hi' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: '+15005550001', message: '' })).rejects.toThrow(ValidationError);
    });

    it('should require either from or messagingServiceSid', async () => {
      const provider = new TwilioProvider({ accountSid: 'AC_1', authToken: 'token_1' });
      await expect(provider.sendSMS({ to: '+15005550001', message: 'Hello' })).rejects.toThrow(ValidationError);
    });

    it('should send SMS with from number and return normalized response', async () => {
      let capturedUrl;
      let capturedHeaders;
      let capturedBody;

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;
        capturedBody = options.body;

        return {
          ok: true,
          status: 201,
          text: async () =>
            JSON.stringify({
              sid: 'SM_test_123',
              to: '+15005550001',
              from: '+15005550006',
              body: 'Hello World',
              status: 'queued',
              date_created: '2026-09-13T10:00:00Z'
            })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.sendSMS({
        to: '+15005550001',
        message: 'Hello World'
      });

      expect(capturedUrl).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_test_account_sid_12345/Messages.json');
      expect(capturedHeaders.Authorization).toBe(
        `Basic ${Buffer.from('AC_test_account_sid_12345:secret_auth_token_99999').toString('base64')}`
      );
      expect(capturedBody).toContain('To=%2B15005550001');
      expect(capturedBody).toContain('From=%2B15005550006');
      expect(capturedBody).toContain('Body=Hello+World');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');
      expect(result.data.sid).toBe('SM_test_123');
      expect(result.data.status).toBe('queued');
    });

    it('should support messagingServiceSid override', async () => {
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ sid: 'SM_service_1', status: 'sent' })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, from: null, messagingServiceSid: 'MG_default_123', fetch: mockFetch });
      await provider.sendSMS({ to: '+15005550001', message: 'Test message' });
      expect(capturedBody).toContain('MessagingServiceSid=MG_default_123');
    });
  });

  describe('sendOTP() & verifyOTP() (Twilio Verify v2)', () => {
    it('should throw ValidationError if serviceSid is not configured or provided', async () => {
      const provider = new TwilioProvider({ accountSid: 'AC_1', authToken: 'tok' });
      await expect(provider.sendOTP({ to: '+15005550001' })).rejects.toThrow(ValidationError);
      await expect(provider.verifyOTP({ to: '+15005550001', otp: '123456' })).rejects.toThrow(ValidationError);
    });

    it('should dispatch OTP via Twilio Verify API', async () => {
      let capturedUrl;
      const mockFetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              sid: 'VE_123',
              service_sid: 'VA_test_verify_sid_12345',
              to: '+15005550001',
              channel: 'sms',
              status: 'pending',
              valid: false
            })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.sendOTP({ to: '+15005550001', channel: 'sms' });

      expect(capturedUrl).toBe('https://verify.twilio.com/v2/Services/VA_test_verify_sid_12345/Verifications');
      expect(result.success).toBe(true);
      expect(result.data.sid).toBe('VE_123');
      expect(result.data.status).toBe('pending');
    });

    it('should verify OTP and map approved status to verified: true', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            sid: 'VE_chk_123',
            service_sid: 'VA_test_verify_sid_12345',
            to: '+15005550001',
            status: 'approved'
          })
      });

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyOTP({ to: '+15005550001', otp: '123456' });

      expect(result.success).toBe(true);
      expect(result.data.verified).toBe(true);
      expect(result.data.valid).toBe(true);
    });

    it('should return verified: false if Twilio Verify status is pending/rejected', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            sid: 'VE_chk_fail',
            service_sid: 'VA_test_verify_sid_12345',
            to: '+15005550001',
            status: 'pending'
          })
      });

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.verifyOTP({ to: '+15005550001', otp: '000000' });

      expect(result.data.verified).toBe(false);
    });
  });

  describe('sendWhatsApp()', () => {
    it('should format whatsapp: prefixes and send message', async () => {
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ sid: 'WA_123', status: 'queued' })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      const result = await provider.sendWhatsApp({
        to: '+15005550001',
        message: 'Order confirmed!'
      });

      expect(capturedBody).toContain('To=whatsapp%3A%2B15005550001');
      expect(capturedBody).toContain('From=whatsapp%3A%2B14155238886');
      expect(capturedBody).toContain('Body=Order+confirmed%21');
      expect(result.success).toBe(true);
      expect(result.data.sid).toBe('WA_123');
    });

    it('should support Content Template Sid and Variables', async () => {
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ sid: 'WA_content_123', status: 'queued' })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await provider.sendWhatsApp({
        to: '+15005550001',
        contentSid: 'HX_sample_content_sid',
        contentVariables: { 1: 'Alex', 2: '12345' }
      });

      expect(capturedBody).toContain('ContentSid=HX_sample_content_sid');
      expect(capturedBody).toContain('ContentVariables=');
    });
  });

  describe('verifyWebhook()', () => {
    it('should validate signature using Twilio HMAC-SHA1 algorithm', async () => {
      const provider = new TwilioProvider(validConfig);
      const url = 'https://example.com/webhooks/twilio';
      const params = {
        To: '+15005550006',
        From: '+15005550001',
        Body: 'STOP'
      };

      // Calculate expected signature manually:
      // sorted keys: Body, From, To
      const dataString = url + 'BodySTOP' + 'From+15005550001' + 'To+15005550006';
      const validSignature = crypto
        .createHmac('sha1', validConfig.authToken)
        .update(Buffer.from(dataString, 'utf-8'))
        .digest('base64');

      const validResult = await provider.verifyWebhook({
        url,
        params,
        signature: validSignature
      });
      expect(validResult.data.verified).toBe(true);

      const invalidResult = await provider.verifyWebhook({
        url,
        params,
        signature: 'invalid_sig'
      });
      expect(invalidResult.data.verified).toBe(false);
    });
  });

  describe('Error Handling & HTTP status code mapping', () => {
    it('should map 401 error to AUTHENTICATION_ERROR', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ code: 20003, message: 'Authentication Error - No credentials provided' })
      });

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.sendSMS({ to: '+15005550001', message: 'Hi' })).rejects.toMatchObject({
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401
      });
    });

    it('should map 429 error to RATE_LIMIT_EXCEEDED', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ code: 20429, message: 'Too Many Requests' })
      });

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.sendSMS({ to: '+15005550001', message: 'Hi' })).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429
      });
    });

    it('should map network errors to NETWORK_ERROR with 502 status', async () => {
      const mockFetch = async () => {
        throw new Error('Connection reset by peer');
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.sendSMS({ to: '+15005550001', message: 'Hi' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 502
      });
    });

    it('should handle non-JSON error responses from Twilio', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await expect(provider.sendSMS({ to: '+15005550001', message: 'Hi' })).rejects.toMatchObject({
        code: 'PROVIDER_ERROR',
        statusCode: 500,
        message: expect.stringContaining('Internal Server Error')
      });
    });

    it('should support extraOptions in sendSMS, sendOTP, and sendWhatsApp', async () => {
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ sid: 'SM_extra_1', status: 'queued', to: '+15005550001' })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await provider.sendSMS({
        to: '+15005550001',
        message: 'Hello',
        statusCallback: 'https://webhook.site/cb'
      });
      expect(capturedBody).toContain('statusCallback=https%3A%2F%2Fwebhook.site%2Fcb');

      // sendWhatsApp extra options
      await provider.sendWhatsApp({
        to: '+15005550001',
        message: 'Hello WA',
        statusCallback: 'https://webhook.site/wacb'
      });
      expect(capturedBody).toContain('statusCallback=https%3A%2F%2Fwebhook.site%2Fwacb');
    });

    it('should support custom verifyServiceSid and channel in OTP methods', async () => {
      let capturedUrl;
      let capturedBody;
      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = options.body;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ sid: 'VE_1', status: 'pending' })
        };
      };

      const provider = new TwilioProvider({ ...validConfig, fetch: mockFetch });
      await provider.sendOTP({
        to: '+15005550001',
        channel: 'whatsapp',
        serviceSid: 'VA_custom_service'
      });
      expect(capturedUrl).toContain('/Services/VA_custom_service/Verifications');
      expect(capturedBody).toContain('Channel=whatsapp');
    });
  });

  describe('SMSFactory for Twilio', () => {
    it('should create TwilioProvider when provider is "twilio"', () => {
      const instance = createSMSProvider({
        provider: 'twilio',
        accountSid: 'AC_123',
        authToken: 'token_123'
      });
      expect(instance).toBeInstanceOf(TwilioProvider);
      expect(instance.name).toBe('twilio');
    });

    it('should match "TWILIO" case-insensitively with whitespace trimming', () => {
      const instance = createSMSProvider({
        provider: '  TWILIO  ',
        accountSid: 'AC_123',
        authToken: 'token_123'
      });
      expect(instance).toBeInstanceOf(TwilioProvider);
    });
  });
});
