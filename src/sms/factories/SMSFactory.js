import { MSG91Provider } from '../providers/msg91/MSG91Provider.js';
import { MessageBirdProvider } from '../providers/messagebird/MessageBirdProvider.js';
import { MockSMSProvider } from '../../testing/MockSMSProvider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate SMS provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider identifier name ('msg91' | 'messagebird' | 'mock').
 * @param {string} [config.authKey] - Authentication key for MSG91.
 * @param {string} [config.apiKey] - API Access Key for MessageBird.
 * @param {string} [config.channelId] - WhatsApp Channel ID for MessageBird.
 * @param {string} [config.namespace] - WhatsApp Template namespace for MessageBird.
 * @param {string} [config.baseUrl] - Base API URL.
 * @param {typeof fetch} [config.fetch] - Custom fetch implementation (optional, for testing).
 * @returns {MSG91Provider|MessageBirdProvider|MockSMSProvider}
 * @throws {ValidationError} If config or provider name is invalid.
 * @throws {IntegrationError} If the specified provider is not supported.
 */
export function createSMSProvider(config) {
  validateRequiredObject(config, 'config', 'core');
  validateRequiredString(config.provider, 'provider', 'core');

  const normalizedProvider = config.provider.trim().toLowerCase();

  switch (normalizedProvider) {
    case 'msg91':
      return new MSG91Provider(config);

    case 'messagebird':
      return new MessageBirdProvider(config);

    case 'mock':
      return new MockSMSProvider(config);

    default:
      throw new IntegrationError(
        `Unsupported SMS provider '${config.provider}'. Supported providers: msg91, messagebird, mock`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
