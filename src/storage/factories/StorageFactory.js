import { CloudinaryProvider } from '../providers/cloudinary/CloudinaryProvider.js';
import { S3Provider } from '../providers/s3/S3Provider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate storage provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider identifier name ('cloudinary' | 's3').
 * @param {string} [config.cloudName] - Cloudinary cloud name.
 * @param {string} [config.apiKey] - Cloudinary API key.
 * @param {string} [config.apiSecret] - Cloudinary API secret.
 * @param {string} [config.accessKeyId] - AWS Access Key ID.
 * @param {string} [config.secretAccessKey] - AWS Secret Access Key.
 * @param {string} [config.region] - AWS Region.
 * @param {string} [config.bucket] - S3 Bucket name.
 * @param {string} [config.endpoint] - Optional custom S3 endpoint.
 * @param {boolean} [config.forcePathStyle] - S3 force path style.
 * @param {Object} [config.client] - Custom SDK client for testing/mocking.
 * @returns {CloudinaryProvider|S3Provider}
 * @throws {ValidationError} If config or provider name is invalid.
 * @throws {IntegrationError} If the specified provider is not supported.
 */
export function createStorageProvider(config) {
  validateRequiredObject(config, 'config', 'core');
  validateRequiredString(config.provider, 'provider', 'core');

  const normalizedProvider = config.provider.trim().toLowerCase();

  switch (normalizedProvider) {
    case 'cloudinary':
      return new CloudinaryProvider(config);

    case 's3':
      return new S3Provider(config);

    default:
      throw new IntegrationError(
        `Unsupported storage provider '${config.provider}'. Supported providers: cloudinary, s3`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
