import { RazorpayProvider } from '../providers/razorpay/RazorpayProvider.js';
import { CCAvenueProvider } from '../providers/ccavenue/CCAvenueProvider.js';
import { StripeProvider } from '../providers/stripe/StripeProvider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate payment provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider name identifier ('razorpay', 'ccavenue', 'stripe').
 * @param {string} [config.keyId] - API Key / ID for Razorpay.
 * @param {string} [config.keySecret] - API Key Secret for Razorpay.
 * @param {string} [config.secretKey] - Secret Key for Stripe.
 * @param {string} [config.webhookSecret] - Webhook signing secret.
 * @param {string} [config.merchantId] - Merchant ID for CCAvenue.
 * @param {string} [config.accessCode] - Access Code for CCAvenue.
 * @param {string} [config.workingKey] - Working Key for CCAvenue.
 * @param {string} [config.baseUrl] - Custom base gateway URL.
 * @param {boolean} [config.testMode] - Test mode flag.
 * @param {Object} [config.client] - Pre-instantiated SDK client (optional, for testing).
 * @returns {RazorpayProvider|CCAvenueProvider|StripeProvider}
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

    case 'ccavenue':
      return new CCAvenueProvider(config);

    case 'stripe':
      return new StripeProvider(config);

    default:
      throw new IntegrationError(
        `Unsupported payment provider '${config.provider}'. Supported providers: razorpay, ccavenue, stripe`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
