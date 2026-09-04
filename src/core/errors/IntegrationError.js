/**
 * Base error class for all integration-related errors.
 */
export class IntegrationError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {Object} [options={}] - Additional error details.
   * @param {string} [options.code='INTEGRATION_ERROR'] - Error code identifier.
   * @param {number} [options.statusCode=500] - HTTP status code representation.
   * @param {string} [options.provider='unknown'] - Provider name where error originated.
   * @param {*} [options.details=null] - Additional non-sensitive error context/payload.
   */
  constructor(message, { code = 'INTEGRATION_ERROR', statusCode = 500, provider = 'unknown', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts the error to a standardized JSON representation.
   * @returns {{success: false, provider: string, error: {code: string, message: string, details?: *}}}
   */
  toJSON() {
    const errorObj = {
      code: this.code,
      message: this.message
    };

    if (this.details !== null && this.details !== undefined) {
      errorObj.details = this.details;
    }

    return {
      success: false,
      provider: this.provider,
      error: errorObj
    };
  }
}
