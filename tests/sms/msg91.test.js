import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createSMSProvider,
  SMSProvider,
  MSG91Provider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('SMSProvider & MSG91 Integration', () => {
  const mockAuthKey = 'mock_authkey_1234567890abcdef';
  let mockFetch;
  let provider;

  beforeEach(() => {
    mockFetch = jest.fn();
    provider = new MSG91Provider({
      authKey: mockAuthKey,
      baseUrl: 'https://control.msg91.com',
      fetch: mockFetch
    });
  });

  describe('Abstract SMSProvider Base Class', () => {
    test('should prevent direct instantiation of SMSProvider', () => {
      expect(() => new SMSProvider('test')).toThrow(IntegrationError);
      expect(() => new SMSProvider('test')).toThrow('abstract class');
    });

    test('unimplemented subclass methods should throw IntegrationError', async () => {
      class UnimplementedSMSProvider extends SMSProvider {
        constructor() {
          super('custom-sms');
        }
      }

      const dummy = new UnimplementedSMSProvider();
      await expect(dummy.sendSMS({})).rejects.toThrow(IntegrationError);
      await expect(dummy.sendOTP({})).rejects.toThrow(IntegrationError);
      await expect(dummy.verifyOTP({})).rejects.toThrow(IntegrationError);
      await expect(dummy.resendOTP({})).rejects.toThrow(IntegrationError);
    });
  });

  describe('SMSFactory', () => {
    test('should create MSG91Provider when provider is "msg91"', () => {
      const p = createSMSProvider({
        provider: 'msg91',
        authKey: mockAuthKey
      });

      expect(p).toBeInstanceOf(MSG91Provider);
      expect(p.name).toBe('msg91');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createSMSProvider({ provider: 'MSG91', authKey: mockAuthKey });
      const p2 = createSMSProvider({ provider: '  msg91  ', authKey: mockAuthKey });
      const p3 = createSMSProvider({ provider: 'Msg91', authKey: mockAuthKey });

      expect(p1).toBeInstanceOf(MSG91Provider);
      expect(p2).toBeInstanceOf(MSG91Provider);
      expect(p3).toBeInstanceOf(MSG91Provider);
    });

    test('should throw ValidationError if config is missing or invalid', () => {
      expect(() => createSMSProvider(null)).toThrow(ValidationError);
      expect(() => createSMSProvider({})).toThrow(ValidationError);
      expect(() => createSMSProvider({ provider: '' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError for unsupported SMS providers', () => {
      expect(() =>
        createSMSProvider({ provider: 'messagebird', authKey: 'key-123' })
      ).toThrow(IntegrationError);

      try {
        createSMSProvider({ provider: 'twilio', authKey: 'key-123' });
      } catch (error) {
        expect(error.code).toBe('UNSUPPORTED_PROVIDER');
        expect(error.statusCode).toBe(400);
        expect(error.provider).toBe('twilio');
      }
    });
  });

  describe('MSG91Provider Constructor', () => {
    test('should throw ValidationError if authKey is missing, empty, or whitespace', () => {
      expect(() => new MSG91Provider({})).toThrow(ValidationError);
      expect(() => new MSG91Provider({ authKey: '' })).toThrow(ValidationError);
      expect(() => new MSG91Provider({ authKey: '   ' })).toThrow(ValidationError);
    });

    test('should successfully instantiate with valid authKey and default or custom baseUrl', () => {
      const p1 = new MSG91Provider({ authKey: mockAuthKey });
      expect(p1).toBeInstanceOf(MSG91Provider);
      expect(p1.name).toBe('msg91');

      const p2 = new MSG91Provider({
        authKey: mockAuthKey,
        baseUrl: 'https://custom.msg91.com/',
        fetch: mockFetch
      });
      expect(p2).toBeInstanceOf(MSG91Provider);
    });
  });

  describe('sendOTP()', () => {
    test('should validate required international mobile number', async () => {
      await expect(provider.sendOTP({})).rejects.toThrow(ValidationError);
      await expect(provider.sendOTP({ mobile: '' })).rejects.toThrow(ValidationError);
      await expect(provider.sendOTP({ mobile: 'invalid_number' })).rejects.toThrow(
        ValidationError
      );
      await expect(provider.sendOTP({ mobile: '123' })).rejects.toThrow(ValidationError);
    });

    test('should validate otpLength if provided', async () => {
      await expect(
        provider.sendOTP({ mobile: '919999999999', otpLength: 2 })
      ).rejects.toThrow(ValidationError);
      await expect(
        provider.sendOTP({ mobile: '919999999999', otpLength: 12 })
      ).rejects.toThrow(ValidationError);
      await expect(
        provider.sendOTP({ mobile: '919999999999', otpLength: 4.5 })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate expiry if provided', async () => {
      await expect(
        provider.sendOTP({ mobile: '919999999999', expiry: 0 })
      ).rejects.toThrow(ValidationError);
      await expect(
        provider.sendOTP({ mobile: '919999999999', expiry: -5 })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully send OTP with valid parameters and mock fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'OTP sent successfully',
          request_id: '336577736637383637313039'
        })
      });

      const result = await provider.sendOTP({
        mobile: '+91 99999 99999',
        templateId: 'template_123',
        otpLength: 6,
        expiry: 10
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: mockAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobile: '919999999999',
          template_id: 'template_123',
          otp_length: 6,
          otp_expiry: 10
        })
      });

      expect(result).toEqual({
        success: true,
        provider: 'msg91',
        data: {
          requestId: '336577736637383637313039',
          type: 'success',
          message: 'OTP sent successfully',
          mobile: '919999999999',
          raw: {
            type: 'success',
            message: 'OTP sent successfully',
            request_id: '336577736637383637313039'
          }
        }
      });
    });

    test('should throw IntegrationError when MSG91 returns error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          type: 'error',
          message: 'Invalid template ID provided'
        })
      });

      await expect(
        provider.sendOTP({ mobile: '919999999999', templateId: 'bad_template' })
      ).rejects.toThrow(IntegrationError);
    });

    test('should throw IntegrationError when network fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timed out'));

      await expect(
        provider.sendOTP({ mobile: '919999999999' })
      ).rejects.toThrow(IntegrationError);
    });

    test('should handle non-JSON HTML gateway error from upstream proxy/Cloudflare', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      });

      await expect(
        provider.sendOTP({ mobile: '919999999999' })
      ).rejects.toThrow(IntegrationError);
    });

    test('should support custom OTP, unicode, and invisible parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'OTP sent successfully',
          request_id: 'custom_otp_req_123'
        })
      });

      const result = await provider.sendOTP({
        mobile: '+1 (415) 555-2671',
        otp: '987654',
        unicode: 1,
        invisible: 1
      });

      expect(mockFetch).toHaveBeenCalledWith('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: mockAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobile: '14155552671',
          otp: '987654',
          unicode: 1,
          invisible: 1
        })
      });

      expect(result.data.requestId).toBe('custom_otp_req_123');
      expect(result.data.mobile).toBe('14155552671');
    });
  });

  describe('verifyOTP()', () => {
    test('should validate required mobile and otp', async () => {
      await expect(provider.verifyOTP({})).rejects.toThrow(ValidationError);
      await expect(provider.verifyOTP({ mobile: '919999999999' })).rejects.toThrow(
        ValidationError
      );
      await expect(provider.verifyOTP({ otp: '1234' })).rejects.toThrow(ValidationError);
    });

    test('should return verified: true when OTP matches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'OTP verified success',
          type: 'success'
        })
      });

      const result = await provider.verifyOTP({
        mobile: '919999999999',
        otp: '123456'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://control.msg91.com/api/v5/otp/verify?otp=123456&mobile=919999999999',
        {
          method: 'GET',
          headers: {
            authkey: mockAuthKey
          }
        }
      );

      expect(result).toEqual({
        success: true,
        provider: 'msg91',
        data: {
          verified: true,
          mobile: '919999999999',
          message: 'OTP verified success',
          raw: {
            message: 'OTP verified success',
            type: 'success'
          }
        }
      });
    });

    test('should return verified: false when OTP does not match or is expired', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'OTP not match',
          type: 'error'
        })
      });

      const result = await provider.verifyOTP({
        mobile: '919999999999',
        otp: '000000'
      });

      expect(result).toEqual({
        success: true,
        provider: 'msg91',
        data: {
          verified: false,
          mobile: '919999999999',
          message: 'OTP not match',
          raw: {
            message: 'OTP not match',
            type: 'error'
          }
        }
      });
    });

    test('should throw IntegrationError on provider authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Auth key not valid',
          type: 'error'
        })
      });

      try {
        await provider.verifyOTP({ mobile: '919999999999', otp: '1234' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(401);
        expect(err.provider).toBe('msg91');
      }
    });

    test('should throw IntegrationError on IP whitelist failure or HTTP 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: 'IP not whitelisted',
          type: 'error'
        })
      });

      try {
        await provider.verifyOTP({ mobile: '919999999999', otp: '1234' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
      }
    });

    test('should throw IntegrationError with RATE_LIMIT_EXCEEDED on HTTP 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          message: 'Too many requests'
        })
      });

      try {
        await provider.verifyOTP({ mobile: '919999999999', otp: '1234' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(err.statusCode).toBe(429);
      }
    });

    test('should throw IntegrationError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network socket disconnected'));

      await expect(
        provider.verifyOTP({ mobile: '919999999999', otp: '1234' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('resendOTP()', () => {
    test('should validate mobile number and supported retry types', async () => {
      await expect(provider.resendOTP({})).rejects.toThrow(ValidationError);
      await expect(
        provider.resendOTP({ mobile: '919999999999', retryType: 'carrier_pigeon' })
      ).rejects.toThrow(ValidationError);
    });

    test('should successfully call retry endpoint with valid retryType', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'OTP resent successfully',
          request_id: 'retry_req_998877'
        })
      });

      const result = await provider.resendOTP({
        mobile: '+91-99999-99999',
        retryType: 'voice'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://control.msg91.com/api/v5/otp/retry?retrytype=voice&mobile=919999999999',
        {
          method: 'GET',
          headers: {
            authkey: mockAuthKey
          }
        }
      );

      expect(result).toEqual({
        success: true,
        provider: 'msg91',
        data: {
          requestId: 'retry_req_998877',
          type: 'success',
          message: 'OTP resent successfully',
          mobile: '919999999999',
          retryType: 'voice',
          raw: {
            type: 'success',
            message: 'OTP resent successfully',
            request_id: 'retry_req_998877'
          }
        }
      });
    });

    test('should support whatsapp retry type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'OTP resent via whatsapp',
          request_id: 'retry_wa_123'
        })
      });

      const result = await provider.resendOTP({
        mobile: '919999999999',
        retryType: 'whatsapp'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://control.msg91.com/api/v5/otp/retry?retrytype=whatsapp&mobile=919999999999',
        {
          method: 'GET',
          headers: {
            authkey: mockAuthKey
          }
        }
      );
      expect(result.data.retryType).toBe('whatsapp');
    });

    test('should handle retry error from MSG91', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          type: 'error',
          message: 'Retry limit reached'
        })
      });

      await expect(
        provider.resendOTP({ mobile: '919999999999', retryType: 'text' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('sendSMS()', () => {
    test('should validate recipients and required message when no templateId is provided', async () => {
      // Missing to
      await expect(provider.sendSMS({ message: 'Hello' })).rejects.toThrow(ValidationError);

      // Empty recipient array
      await expect(provider.sendSMS({ to: [], message: 'Hello' })).rejects.toThrow(
        ValidationError
      );

      // Invalid recipient in array
      await expect(
        provider.sendSMS({ to: ['919999999999', 'invalid_phone'], message: 'Hello' })
      ).rejects.toThrow(ValidationError);

      // Missing message when no template
      await expect(provider.sendSMS({ to: '919999999999' })).rejects.toThrow(ValidationError);
      await expect(provider.sendSMS({ to: '919999999999', message: '   ' })).rejects.toThrow(
        ValidationError
      );
    });

    test('should successfully send SMS to a single recipient', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'SMS sent successfully',
          request_id: 'flow_req_112233'
        })
      });

      const result = await provider.sendSMS({
        to: '+91 99999 99999',
        message: 'Order #123 is confirmed',
        senderId: 'MYMERN'
      });

      expect(mockFetch).toHaveBeenCalledWith('https://control.msg91.com/api/v5/flow', {
        method: 'POST',
        headers: {
          authkey: mockAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: 'MYMERN',
          recipients: [{ mobiles: '919999999999', message: 'Order #123 is confirmed' }]
        })
      });

      expect(result).toEqual({
        success: true,
        provider: 'msg91',
        data: {
          requestId: 'flow_req_112233',
          type: 'success',
          message: 'SMS sent successfully',
          recipients: '919999999999',
          raw: {
            type: 'success',
            message: 'SMS sent successfully',
            request_id: 'flow_req_112233'
          }
        }
      });
    });

    test('should successfully send SMS to multiple recipients with template variables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          type: 'success',
          message: 'Flow triggered',
          request_id: 'flow_req_multi_99'
        })
      });

      const result = await provider.sendSMS({
        to: ['919999999999', '918888888888'],
        templateId: 'template_flow_55',
        variables: { name: 'Customer', discount: '20%' }
      });

      expect(mockFetch).toHaveBeenCalledWith('https://control.msg91.com/api/v5/flow', {
        method: 'POST',
        headers: {
          authkey: mockAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: 'template_flow_55',
          recipients: [
            { mobiles: '919999999999', name: 'Customer', discount: '20%' },
            { mobiles: '918888888888', name: 'Customer', discount: '20%' }
          ]
        })
      });

      expect(result.data.requestId).toBe('flow_req_multi_99');
      expect(result.data.recipients).toEqual(['919999999999', '918888888888']);
    });

    test('should throw IntegrationError when provider returns failure response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          type: 'error',
          message: 'Sender ID not approved on DLT'
        })
      });

      await expect(
        provider.sendSMS({
          to: '919999999999',
          message: 'Test message',
          senderId: 'UNAPPROVED'
        })
      ).rejects.toThrow(IntegrationError);
    });

    test('should throw IntegrationError when fetch encounters a network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        provider.sendSMS({
          to: '919999999999',
          message: 'Test message'
        })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('SMSProvider normalize helpers', () => {
    test('normalizeSuccess and normalizeError format responses according to standard schema', () => {
      const successRes = provider.normalizeSuccess({ id: 'test_123' });
      expect(successRes).toEqual({
        success: true,
        provider: 'msg91',
        data: { id: 'test_123' }
      });

      const errorRes1 = provider.normalizeError('TEST_ERROR', 'Something went wrong', { field: 'to' });
      expect(errorRes1).toEqual({
        success: false,
        provider: 'msg91',
        error: {
          code: 'TEST_ERROR',
          message: 'Something went wrong',
          details: { field: 'to' }
        }
      });

      const errorRes2 = provider.normalizeError('SIMPLE_ERROR', 'Simple failure');
      expect(errorRes2).toEqual({
        success: false,
        provider: 'msg91',
        error: {
          code: 'SIMPLE_ERROR',
          message: 'Simple failure'
        }
      });
    });
  });
});

