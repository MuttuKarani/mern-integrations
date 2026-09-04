import { CloudinaryProvider } from '../providers/cloudinary/CloudinaryProvider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate storage provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider identifier name ('cloudinary').
 * @param {string} [config.cloudName] - Cloudinary cloud name.
 * @param {string} [config.apiKey] - Cloudinary API key.
 * @param {string} [config.apiSecret] - Cloudinary API secret.
 * @param {Object} [config.client] - Custom SDK client for testing/mocking.
 * @returns {CloudinaryProvider}
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

    default:
      throw new IntegrationError(
        `Unsupported storage provider '${config.provider}'. Supported providers: cloudinary`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
