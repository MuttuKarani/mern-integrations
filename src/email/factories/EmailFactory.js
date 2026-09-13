import { ResendProvider } from '../providers/resend/ResendProvider.js';
import { NodemailerProvider } from '../providers/nodemailer/NodemailerProvider.js';
import { SESProvider } from '../providers/ses/SESProvider.js';
import { MockEmailProvider } from '../../testing/MockEmailProvider.js';
import { IntegrationError } from '../../core/errors/IntegrationError.js';
import { ValidationError } from '../../core/errors/ValidationError.js';
import { validateRequiredObject, validateRequiredString } from '../../core/utils/validators.js';

/**
 * Factory function to instantiate email provider instances based on configuration.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.provider - Provider identifier name ('resend', 'nodemailer', 'ses', 'amazon-ses', 'amazonses', 'mock').
 * @param {string} [config.apiKey] - API key for Resend provider.
 * @param {string} [config.host] - SMTP host for Nodemailer provider.
 * @param {string} [config.service] - SMTP service for Nodemailer provider.
 * @param {number} [config.port] - SMTP port.
 * @param {boolean} [config.secure] - Secure flag for SMTP.
 * @param {Object} [config.auth] - SMTP credentials { user, pass }.
 * @param {string} [config.accessKeyId] - AWS Access Key ID for SES provider.
 * @param {string} [config.secretAccessKey] - AWS Secret Access Key for SES provider.
 * @param {string} [config.region] - AWS Region for SES provider.
 * @param {string} [config.configurationSetName] - SES Configuration Set Name.
 * @param {Object} [config.client] - Pre-instantiated SDK client (optional, for testing).
 * @param {Object} [config.transporter] - Pre-instantiated Transporter (optional, for testing).
 * @returns {ResendProvider|NodemailerProvider|SESProvider|MockEmailProvider}
 * @throws {ValidationError} If config or provider name is invalid.
 * @throws {IntegrationError} If the specified provider is not supported.
 */
export function createEmailProvider(config) {
  validateRequiredObject(config, 'config', 'core');
  validateRequiredString(config.provider, 'provider', 'core');

  const normalizedProvider = config.provider.trim().toLowerCase();

  switch (normalizedProvider) {
    case 'resend':
      return new ResendProvider(config);

    case 'nodemailer':
      return new NodemailerProvider(config);

    case 'ses':
    case 'amazon-ses':
    case 'amazonses':
      return new SESProvider(config);

    case 'mock':
      return new MockEmailProvider(config);

    default:
      throw new IntegrationError(
        `Unsupported email provider '${config.provider}'. Supported providers: resend, nodemailer, ses, mock`,
        {
          code: 'UNSUPPORTED_PROVIDER',
          statusCode: 400,
          provider: config.provider
        }
      );
  }
}
