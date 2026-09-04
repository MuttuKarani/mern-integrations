import { IntegrationError } from '../../core/errors/IntegrationError.js';

/**
 * Base abstract class defining the contract for all email providers.
 */
export class EmailProvider {
  /**
   * @param {string} name - Unique identifier name of the email provider.
   */
  constructor(name) {
    if (new.target === EmailProvider) {
      throw new IntegrationError('EmailProvider is an abstract class and cannot be instantiated directly', {
        provider: name || 'core'
      });
    }
    this.name = name;
  }

  /**
   * Returns a list of supported operations for this provider.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['send']);
  }

  /**
   * Sends an email through the provider.
   *
   * @param {Object} params - Email transmission parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async send(params) {
    throw new IntegrationError(`send() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Verifies transport connection / authentication if supported by the provider.
   *
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   */
  async verify() {
    throw new IntegrationError(`verify() is not supported by provider '${this.name}'`, {
      code: 'UNSUPPORTED_OPERATION',
      statusCode: 501,
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
