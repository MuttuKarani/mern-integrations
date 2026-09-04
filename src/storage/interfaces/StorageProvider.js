import { IntegrationError } from '../../core/errors/IntegrationError.js';

/**
 * Base abstract class defining the contract for all storage and media providers.
 */
export class StorageProvider {
  /**
   * @param {string} name - Unique identifier name of the storage provider.
   */
  constructor(name) {
    if (new.target === StorageProvider) {
      throw new IntegrationError('StorageProvider is an abstract class and cannot be instantiated directly', {
        provider: name || 'core'
      });
    }
    this.name = name;
  }

  /**
   * Uploads a file, URL, or data URI to storage.
   *
   * @param {Object} params - Upload parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async upload(params) {
    throw new IntegrationError(`upload() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Uploads a Buffer directly to storage.
   *
   * @param {Object} params - Buffer upload parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   */
  async uploadBuffer(params) {
    throw new IntegrationError(`uploadBuffer() is not supported by provider '${this.name}'`, {
      code: 'UNSUPPORTED_OPERATION',
      statusCode: 501,
      provider: this.name
    });
  }

  /**
   * Uploads a stream directly to storage.
   *
   * @param {Object} params - Stream upload parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   */
  async uploadStream(params) {
    throw new IntegrationError(`uploadStream() is not supported by provider '${this.name}'`, {
      code: 'UNSUPPORTED_OPERATION',
      statusCode: 501,
      provider: this.name
    });
  }

  /**
   * Deletes a resource from storage by public identifier.
   *
   * @param {Object} params - Deletion parameters.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async delete(params) {
    throw new IntegrationError(`delete() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Generates or computes the public delivery URL for a stored asset.
   *
   * @param {Object} params - URL generation parameters.
   * @returns {{success: boolean, provider: string, data: {publicId: string, url: string}}}
   * @abstract
   */
  getUrl(params) {
    throw new IntegrationError(`getUrl() must be implemented by provider '${this.name}'`, {
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
