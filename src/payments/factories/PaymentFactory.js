import { RazorpayProvider } from '../providers/razorpay/RazorpayProvider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate payment provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider name identifier ('razorpay').
 * @param {string} [config.keyId] - API Key / ID for provider.
 * @param {string} [config.keySecret] - API Key Secret for provider.
 * @param {string} [config.webhookSecret] - Webhook signing secret.
 * @param {Object} [config.client] - Pre-instantiated SDK client (optional, for testing).
 * @returns {RazorpayProvider}
 * @throws {ValidationError} If config or provider name is invalid.
 * @throws {IntegrationError} If the specified provider is not supported.
 */
export function createPaymentProvider(config) {
  validateRequiredObject(config, 'config', 'core');
  validateRequiredString(config.provider, 'provider', 'core');

  const normalizedProvider = config.provider.toLowerCase().trim();

  switch (normalizedProvider) {
    case 'razorpay':
      return new RazorpayProvider(config);

    default:
      throw new IntegrationError(
        `Unsupported payment provider '${config.provider}'. Supported providers: razorpay`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
