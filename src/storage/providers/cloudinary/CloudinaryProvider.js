import cloudinary from 'cloudinary';
import { StorageProvider } from '../../interfaces/StorageProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import { validateRequiredString } from '../../../core/utils/validators.js';

/**
 * Cloudinary Storage Provider implementation.
 */
export class CloudinaryProvider extends StorageProvider {
  /** @type {string} */
  #cloudName;

  /** @type {string} */
  #apiKey;

  /** @type {string} */
  #apiSecret;

  /** @type {typeof cloudinary.v2} */
  #client;

  /**
   * @param {Object} [config={}]
   * @param {string} config.cloudName - Cloudinary cloud name.
   * @param {string} config.apiKey - Cloudinary API key.
   * @param {string} config.apiSecret - Cloudinary API secret.
   * @param {Object} [config.client] - Custom Cloudinary SDK instance for testing.
   * @throws {ValidationError} If any required credential is missing or invalid.
   */
  constructor(config = {}) {
    super('cloudinary');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'cloudinary' provider", {
        provider: 'cloudinary',
        details: { field: 'config' }
      });
    }

    const { cloudName, apiKey, apiSecret, client = null } = config;

    validateRequiredString(cloudName, 'cloudName', 'cloudinary');
    validateRequiredString(apiKey, 'apiKey', 'cloudinary');
    validateRequiredString(apiSecret, 'apiSecret', 'cloudinary');

    this.#cloudName = cloudName.trim();
    this.#apiKey = apiKey.trim();
    this.#apiSecret = apiSecret.trim();

    if (client) {
      this.#client = client;
    } else {
      const cloudinaryV2 = cloudinary.v2;
      cloudinaryV2.config({
        cloud_name: this.#cloudName,
        api_key: this.#apiKey,
        api_secret: this.#apiSecret,
        secure: true
      });
      this.#client = cloudinaryV2;
    }
  }

  /**
   * Uploads a file (local path, remote URL, or base64/data URI) to Cloudinary.
   *
   * @param {Object} params
   * @param {string} params.file - Local file path, remote URL, or data URI.
   * @param {string} [params.folder] - Destination folder.
   * @param {string} [params.publicId] - Custom public identifier.
   * @param {string} [params.resourceType='auto'] - Resource type ('image', 'video', 'raw', 'auto').
   * @param {boolean} [params.overwrite] - Whether to overwrite existing asset with same publicId.
   * @param {string|string[]} [params.tags] - Asset tags.
   * @param {Object|Array} [params.transformation] - Cloudinary transformation options.
   * @param {Object|string} [params.context] - Metadata context key-value pairs.
   * @param {Object} [params.extraOptions] - Additional Cloudinary upload parameters.
   * @returns {Promise<{success: true, provider: 'cloudinary', data: Object}>}
   * @throws {ValidationError} If file parameter is missing or invalid.
   * @throws {IntegrationError} If Cloudinary upload fails.
   */
  async upload({
    file,
    folder,
    publicId,
    resourceType = 'auto',
    overwrite,
    tags,
    transformation,
    context,
    ...extraOptions
  } = {}) {
    validateRequiredString(file, 'file', 'cloudinary');

    const options = {
      resource_type: resourceType || 'auto',
      ...(folder ? { folder } : {}),
      ...(publicId ? { public_id: publicId } : {}),
      ...(overwrite !== undefined ? { overwrite } : {}),
      ...(tags ? { tags } : {}),
      ...(transformation ? { transformation } : {}),
      ...(context ? { context } : {}),
      ...extraOptions
    };

    try {
      const result = await this.#client.uploader.upload(file, options);
      return this.#normalizeUploadResponse(result);
    } catch (error) {
      throw this.#handleProviderError(error, 'Cloudinary upload failed');
    }
  }

  /**
   * Uploads an in-memory Buffer to Cloudinary via upload stream.
   *
   * @param {Object} params
   * @param {Buffer} params.buffer - In-memory file Buffer.
   * @param {string} [params.folder] - Destination folder.
   * @param {string} [params.publicId] - Custom public identifier.
   * @param {string} [params.resourceType='auto'] - Resource type ('image', 'video', 'raw', 'auto').
   * @param {Object} [params.extraOptions] - Additional Cloudinary upload stream parameters.
   * @returns {Promise<{success: true, provider: 'cloudinary', data: Object}>}
   * @throws {ValidationError} If buffer is missing or not a Buffer instance.
   * @throws {IntegrationError} If stream upload fails.
   */
  async uploadBuffer({
    buffer,
    folder,
    publicId,
    resourceType = 'auto',
    ...extraOptions
  } = {}) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ValidationError("Field 'buffer' is required and must be a Buffer", {
        provider: 'cloudinary',
        details: { field: 'buffer' }
      });
    }

    const options = {
      resource_type: resourceType || 'auto',
      ...(folder ? { folder } : {}),
      ...(publicId ? { public_id: publicId } : {}),
      ...extraOptions
    };

    return new Promise((resolve, reject) => {
      const stream = this.#client.uploader.upload_stream(options, (error, result) => {
        if (error) {
          return reject(this.#handleProviderError(error, 'Cloudinary buffer upload failed'));
        }
        resolve(this.#normalizeUploadResponse(result));
      });

      stream.on('error', (error) => {
        reject(this.#handleProviderError(error, 'Cloudinary stream upload error'));
      });

      stream.end(buffer);
    });
  }

  /**
   * Deletes a resource from Cloudinary by public identifier.
   *
   * @param {Object} params
   * @param {string} params.publicId - Asset public identifier.
   * @param {string} [params.resourceType='image'] - Resource type ('image', 'video', 'raw').
   * @param {boolean} [params.invalidate] - Invalidate CDN cache.
   * @param {Object} [params.extraOptions] - Additional destroy options.
   * @returns {Promise<{success: true, provider: 'cloudinary', data: Object}>}
   * @throws {ValidationError} If publicId is missing.
   * @throws {IntegrationError} If Cloudinary deletion fails.
   */
  async delete({
    publicId,
    resourceType = 'image',
    invalidate,
    ...extraOptions
  } = {}) {
    validateRequiredString(publicId, 'publicId', 'cloudinary');

    const options = {
      resource_type: resourceType || 'image',
      ...(invalidate !== undefined ? { invalidate } : {}),
      ...extraOptions
    };

    try {
      const result = await this.#client.uploader.destroy(publicId, options);
      return this.normalizeSuccess({
        publicId,
        result: result?.result || 'ok',
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Cloudinary deletion failed');
    }
  }

  /**
   * Computes the delivery URL for a public asset.
   *
   * @param {Object} params
   * @param {string} params.publicId - Asset public identifier.
   * @param {string} [params.resourceType='image'] - Resource type ('image', 'video', 'raw').
   * @param {Object|Array} [params.transformation] - Cloudinary transformation options.
   * @param {boolean} [params.secure=true] - Whether to generate HTTPS URL.
   * @param {Object} [params.extraOptions] - Additional url generation parameters.
   * @returns {{success: true, provider: 'cloudinary', data: {publicId: string, url: string}}}
   * @throws {ValidationError} If publicId is missing.
   */
  getUrl({
    publicId,
    resourceType = 'image',
    transformation,
    secure = true,
    ...extraOptions
  } = {}) {
    validateRequiredString(publicId, 'publicId', 'cloudinary');

    const options = {
      resource_type: resourceType || 'image',
      secure: secure !== false,
      ...(transformation ? { transformation } : {}),
      ...extraOptions
    };

    const url = this.#client.url(publicId, options);

    return this.normalizeSuccess({
      publicId,
      url
    });
  }

  /**
   * Normalizes Cloudinary upload results.
   *
   * @param {Object} result
   * @returns {{success: true, provider: 'cloudinary', data: Object}}
   * @private
   */
  #normalizeUploadResponse(result) {
    return this.normalizeSuccess({
      publicId: result?.public_id || null,
      secureUrl: result?.secure_url || null,
      url: result?.url || null,
      resourceType: result?.resource_type || null,
      format: result?.format || null,
      bytes: result?.bytes || null,
      width: result?.width || null,
      height: result?.height || null,
      createdAt: result?.created_at || null,
      raw: result
    });
  }

  /**
   * Safely normalizes Cloudinary SDK errors without leaking apiSecret.
   *
   * @param {*} error
   * @param {string} fallbackMessage
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError || error instanceof ValidationError) {
      return error;
    }

    const statusCode = error?.http_code || error?.status || 500;
    let message = error?.message || error?.error?.message || fallbackMessage;

    if (this.#apiSecret) {
      message = message.replaceAll(this.#apiSecret, '[REDACTED]');
    }
    if (this.#apiKey) {
      message = message.replaceAll(this.#apiKey, '[REDACTED]');
    }

    return new IntegrationError(message, {
      code: statusCode === 401 ? 'AUTHENTICATION_ERROR' : 'PROVIDER_ERROR',
      statusCode,
      provider: 'cloudinary',
      details: error?.name ? { name: error.name } : null
    });
  }
}
