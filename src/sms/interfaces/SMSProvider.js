import { IntegrationError } from '../../core/errors/IntegrationError.js';

/**
 * Base abstract class defining the contract for all SMS and OTP providers.
 */
export class SMSProvider {
  /**
   * @param {string} name - Unique identifier name of the SMS provider.
   */
  constructor(name) {
    if (new.target === SMSProvider) {
      throw new IntegrationError('SMSProvider is an abstract class and cannot be instantiated directly', {
        provider: name || 'core'
      });
    }
    this.name = name;
  }

  /**
   * Sends transactional or promotional SMS messages.
   *
   * @param {Object} params - SMS parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async sendSMS(params) {
    throw new IntegrationError(`sendSMS() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Generates and delivers an OTP to a mobile number.
   *
   * @param {Object} params - OTP generation parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async sendOTP(params) {
    throw new IntegrationError(`sendOTP() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Verifies an OTP entered by the user.
   *
   * @param {Object} params - Verification parameters (mobile, otp).
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async verifyOTP(params) {
    throw new IntegrationError(`verifyOTP() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Retries or resends an OTP via voice, text, or alternative channels.
   *
   * @param {Object} params - Retry parameters (mobile, retryType).
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async resendOTP(params) {
    throw new IntegrationError(`resendOTP() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Sends WhatsApp messages or templates.
   *
   * @param {Object} params - WhatsApp parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async sendWhatsApp(params) {
    throw new IntegrationError(`sendWhatsApp() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Formats a normalized success response.
   *
   * @param {Object} data - Result payload.
   * @returns {{success: true, provider: string, data: Object}}
   */
  normalizeSuccess(data) {
    return {
      success: true,
      provider: this.name,
      data
    };
  }

  /**
   * Formats a normalized error response.
   *
   * @param {string} code - Error code.
   * @param {string} message - Error message.
   * @param {*} [details=null] - Optional additional error details.
   * @returns {{success: false, provider: string, error: {code: string, message: string, details?: *}}}
   */
  normalizeError(code, message, details = null) {
    const errorObj = { code, message };
    if (details !== null && details !== undefined) {
      errorObj.details = details;
    }
    return {
      success: false,
      provider: this.name,
      error: errorObj
    };
  }
}
