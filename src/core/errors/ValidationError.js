import { IntegrationError } from './IntegrationError.js';

/**
 * Error class representing invalid input parameters or missing configuration.
 */
export class ValidationError extends IntegrationError {
  /**
   * @param {string} message - Validation failure message.
   * @param {Object} [options={}] - Additional options.
   * @param {string} [options.code='VALIDATION_ERROR'] - Error code.
   * @param {number} [options.statusCode=400] - HTTP status code (default 400).
   * @param {string} [options.provider='unknown'] - Provider name where validation failed.
   * @param {*} [options.details=null] - Additional validation details (e.g. invalid fields).
   */
  constructor(message, { code = 'VALIDATION_ERROR', statusCode = 400, provider = 'unknown', details = null } = {}) {
    super(message, { code, statusCode, provider, details });
  }
}
