import { SMSProvider } from '../../interfaces/SMSProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateMobileNumber,
  validateMobileRecipients
} from '../../../core/utils/validators.js';

/**
 * Supported OTP retry types in MSG91.
 */
const SUPPORTED_RETRY_TYPES = ['voice', 'text', 'whatsapp'];

/**
 * MSG91 SMS and OTP Provider implementation.
 */
export class MSG91Provider extends SMSProvider {
  /** @type {string} */
  #authKey;

  /** @type {string} */
  #baseUrl;

  /** @type {typeof fetch} */
  #fetch;

  /**
   * @param {Object} config
   * @param {string} config.authKey - MSG91 authentication key.
   * @param {string} [config.baseUrl='https://control.msg91.com'] - Base URL for MSG91 APIs.
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation (useful for testing/mocking).
   * @throws {ValidationError} If authKey is missing or not a non-empty string.
   */
  constructor({ authKey, baseUrl = 'https://control.msg91.com', fetch: customFetch = null } = {}) {
    super('msg91');

    validateRequiredString(authKey, 'authKey', 'msg91');

    this.#authKey = authKey.trim();
    this.#baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://control.msg91.com';
    this.#fetch = customFetch || globalThis.fetch;
  }

  /**
   * Generates and delivers an OTP to an international mobile number.
   *
   * @param {Object} params
   * @param {string} params.mobile - Recipient mobile number with country code.
   * @param {string} [params.templateId] - MSG91 approved OTP template ID.
   * @param {string|number} [params.otp] - Custom OTP code to send (if configured).
   * @param {number} [params.otpLength] - Length of generated OTP (e.g. 4 to 9 digits).
   * @param {number} [params.expiry] - OTP expiry time in minutes.
   * @param {number|boolean} [params.unicode] - Set for non-English OTP message.
   * @param {number|boolean} [params.invisible] - Silent OTP parameter.
   * @param {Object} [params.extraOptions] - Additional MSG91 OTP parameters.
   * @returns {Promise<{success: true, provider: 'msg91', data: Object}>}
   * @throws {ValidationError} If mobile is invalid or parameters fail validation.
   * @throws {IntegrationError} If MSG91 rejects or fails the request.
   */
  async sendOTP({
    mobile,
    templateId,
    otp,
    otpLength,
    expiry,
    unicode,
    invisible,
    ...extraOptions
  } = {}) {
    const normalizedMobile = validateMobileNumber(mobile, 'mobile', 'msg91');

    if (templateId !== undefined && templateId !== null) {
      validateRequiredString(templateId, 'templateId', 'msg91');
    }

    if (otpLength !== undefined && otpLength !== null) {
      if (typeof otpLength !== 'number' || !Number.isInteger(otpLength) || otpLength < 4 || otpLength > 9) {
        throw new ValidationError("Field 'otpLength' must be an integer between 4 and 9", {
          provider: 'msg91',
          details: { field: 'otpLength', received: otpLength }
        });
      }
    }

    if (expiry !== undefined && expiry !== null) {
      if (typeof expiry !== 'number' || !Number.isInteger(expiry) || expiry <= 0) {
        throw new ValidationError("Field 'expiry' must be a positive integer representing minutes", {
          provider: 'msg91',
          details: { field: 'expiry', received: expiry }
        });
      }
    }

    const payload = {
      mobile: normalizedMobile,
      ...(templateId ? { template_id: templateId } : {}),
      ...(otp !== undefined && otp !== null ? { otp: String(otp) } : {}),
      ...(otpLength ? { otp_length: otpLength } : {}),
      ...(expiry ? { otp_expiry: expiry } : {}),
      ...(unicode !== undefined ? { unicode } : {}),
      ...(invisible !== undefined ? { invisible } : {}),
      ...extraOptions
    };

    const url = `${this.#baseUrl}/api/v5/otp`;

    try {
      const response = await this.#fetch(url, {
        method: 'POST',
        headers: {
          authkey: this.#authKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await this.#parseJsonResponse(response);

      if (!response.ok || json?.type === 'error') {
        const errorMsg = json?.message || `Failed to send OTP (HTTP ${response.status})`;
        throw new IntegrationError(errorMsg, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status || 502,
          provider: 'msg91',
          details: json?.type ? { type: json.type } : null
        });
      }

      return this.normalizeSuccess({
        requestId: json?.request_id || json?.message_id || null,
        type: json?.type || 'success',
        message: json?.message || 'OTP sent successfully',
        mobile: normalizedMobile,
        raw: json
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to send OTP');
    }
  }

  /**
   * Verifies an OTP code for a mobile number.
   *
   * @param {Object} params
   * @param {string} params.mobile - Recipient mobile number with country code.
   * @param {string|number} params.otp - OTP code to verify.
   * @returns {Promise<{success: true, provider: 'msg91', data: {verified: boolean, mobile: string, message: string, raw: Object}}>}
   * @throws {ValidationError} If mobile or otp are missing or invalid.
   * @throws {IntegrationError} If provider authentication or network fails.
   */
  async verifyOTP({ mobile, otp } = {}) {
    const normalizedMobile = validateMobileNumber(mobile, 'mobile', 'msg91');
    validateRequiredString(String(otp ?? ''), 'otp', 'msg91');

    const queryParams = new URLSearchParams({
      otp: String(otp).trim(),
      mobile: normalizedMobile
    });

    const url = `${this.#baseUrl}/api/v5/otp/verify?${queryParams.toString()}`;

    try {
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: {
          authkey: this.#authKey
        }
      });

      const json = await this.#parseJsonResponse(response);

      // Check for authentication / authorization failures (status 401, 403 or invalid auth key message)
      if (
        response.status === 401 ||
        response.status === 403 ||
        json?.message?.toLowerCase().includes('auth key not valid') ||
        json?.message?.toLowerCase().includes('ip not whitelisted')
      ) {
        throw new IntegrationError(json?.message || 'MSG91 authentication failed', {
          code: 'AUTHENTICATION_ERROR',
          statusCode: response.status || 401,
          provider: 'msg91'
        });
      }

      // Check for rate limiting or server error status
      if (response.status === 429 || (!response.ok && response.status >= 500)) {
        throw new IntegrationError(json?.message || `MSG91 request failed (HTTP ${response.status})`, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status,
          provider: 'msg91'
        });
      }

      // Check if verification succeeded
      const isSuccess =
        response.ok &&
        (json?.type === 'success' || json?.message?.toLowerCase().includes('verified'));

      return this.normalizeSuccess({
        verified: isSuccess,
        mobile: normalizedMobile,
        message: json?.message || (isSuccess ? 'OTP verified successfully' : 'OTP verification failed'),
        raw: json
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'OTP verification request failed');
    }
  }

  /**
   * Retries/resends an OTP via voice, text, or alternative supported channel.
   *
   * @param {Object} params
   * @param {string} params.mobile - Recipient mobile number with country code.
   * @param {string} [params.retryType='voice'] - Retry channel: 'voice', 'text', or 'whatsapp'.
   * @returns {Promise<{success: true, provider: 'msg91', data: Object}>}
   * @throws {ValidationError} If mobile or retryType are invalid.
   * @throws {IntegrationError} If MSG91 fails the retry request.
   */
  async resendOTP({ mobile, retryType = 'voice' } = {}) {
    const normalizedMobile = validateMobileNumber(mobile, 'mobile', 'msg91');

    const normalizedRetryType = String(retryType || '').trim().toLowerCase();
    if (!SUPPORTED_RETRY_TYPES.includes(normalizedRetryType)) {
      throw new ValidationError(
        `Field 'retryType' must be one of: ${SUPPORTED_RETRY_TYPES.join(', ')}`,
        {
          provider: 'msg91',
          details: { field: 'retryType', received: retryType }
        }
      );
    }

    const queryParams = new URLSearchParams({
      retrytype: normalizedRetryType,
      mobile: normalizedMobile
    });

    const url = `${this.#baseUrl}/api/v5/otp/retry?${queryParams.toString()}`;

    try {
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: {
          authkey: this.#authKey
        }
      });

      const json = await this.#parseJsonResponse(response);

      if (!response.ok || json?.type === 'error') {
        const errorMsg = json?.message || `Failed to retry OTP (HTTP ${response.status})`;
        throw new IntegrationError(errorMsg, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status || 502,
          provider: 'msg91',
          details: json?.type ? { type: json.type } : null
        });
      }

      return this.normalizeSuccess({
        requestId: json?.request_id || null,
        type: json?.type || 'success',
        message: json?.message || 'OTP retry request processed successfully',
        mobile: normalizedMobile,
        retryType: normalizedRetryType,
        raw: json
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to retry OTP');
    }
  }

  /**
   * Sends transactional or template-based SMS messages.
   *
   * @param {Object} params
   * @param {string|string[]} params.to - Single mobile number or array of mobile numbers.
   * @param {string} [params.message] - SMS message text (required if template does not define it).
   * @param {string} [params.senderId] - Approved Sender ID / Header.
   * @param {string} [params.templateId] - MSG91 Flow ID / Template ID.
   * @param {Object} [params.variables] - Custom dynamic variables for template substitution.
   * @param {Object} [params.extraOptions] - Additional MSG91 flow options.
   * @returns {Promise<{success: true, provider: 'msg91', data: Object}>}
   * @throws {ValidationError} If recipients or message are invalid.
   * @throws {IntegrationError} If MSG91 API rejects the request.
   */
  async sendSMS({
    to,
    message,
    senderId,
    templateId,
    variables = {},
    ...extraOptions
  } = {}) {
    const normalizedRecipients = validateMobileRecipients(to, 'to', 'msg91');

    if (!templateId) {
      validateRequiredString(message, 'message', 'msg91');
    }

    const recipientsArray = Array.isArray(normalizedRecipients)
      ? normalizedRecipients
      : [normalizedRecipients];

    const recipientsPayload = recipientsArray.map((mobileNum) => ({
      mobiles: mobileNum,
      ...(message ? { message } : {}),
      ...variables
    }));

    const payload = {
      ...(templateId ? { template_id: templateId } : {}),
      ...(senderId ? { sender: senderId } : {}),
      recipients: recipientsPayload,
      ...extraOptions
    };

    const url = `${this.#baseUrl}/api/v5/flow`;

    try {
      const response = await this.#fetch(url, {
        method: 'POST',
        headers: {
          authkey: this.#authKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await this.#parseJsonResponse(response);

      if (!response.ok || json?.type === 'error') {
        const errorMsg = json?.message || `Failed to send SMS (HTTP ${response.status})`;
        throw new IntegrationError(errorMsg, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status || 502,
          provider: 'msg91',
          details: json?.type ? { type: json.type } : null
        });
      }

      return this.normalizeSuccess({
        requestId: json?.request_id || json?.message_id || null,
        type: json?.type || 'success',
        message: json?.message || 'SMS processed successfully',
        recipients: normalizedRecipients,
        raw: json
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to send SMS');
    }
  }

  /**
   * Safely parses JSON responses from fetch, handling non-JSON/HTML error pages.
   *
   * @param {Response} response
   * @returns {Promise<Object|null>}
   * @private
   */
  async #parseJsonResponse(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Maps HTTP status codes to standardized error codes.
   *
   * @param {number} status
   * @returns {string}
   * @private
   */
  #mapStatusCodeToErrorCode(status) {
    if (status === 401 || status === 403) return 'AUTHENTICATION_ERROR';
    if (status === 429) return 'RATE_LIMIT_EXCEEDED';
    return 'PROVIDER_ERROR';
  }

  /**
   * Safely normalizes errors without leaking auth keys or sensitive headers.
   *
   * @param {*} error
   * @param {string} fallbackMessage
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError) {
      return error;
    }

    return new IntegrationError(error?.message || fallbackMessage, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      provider: 'msg91',
      details: error?.name ? { name: error.name } : null
    });
  }
}
