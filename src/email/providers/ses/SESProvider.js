import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailProvider } from '../../interfaces/EmailProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateEmailRecipients
} from '../../../core/utils/validators.js';

/**
 * Amazon Simple Email Service (SES) Provider implementation using AWS SDK v3.
 */
export class SESProvider extends EmailProvider {
  /** @type {SESClient} */
  #client;

  /** @type {string|null} */
  #accessKeyId;

  /** @type {string|null} */
  #secretAccessKey;

  /** @type {string|null} */
  #region;

  /** @type {string|null} */
  #configurationSetName;

  /**
   * @param {Object} config
   * @param {string} [config.accessKeyId] - AWS Access Key ID.
   * @param {string} [config.secretAccessKey] - AWS Secret Access Key.
   * @param {string} [config.region] - AWS Region (e.g. 'us-east-1', 'eu-west-1').
   * @param {string} [config.configurationSetName] - Default Amazon SES Configuration Set name.
   * @param {SESClient} [config.client] - Pre-instantiated SESClient instance (optional, for testing).
   * @throws {ValidationError} If required credentials or region are missing when client is not supplied.
   */
  constructor(config = {}) {
    super('ses');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'ses' provider", {
        provider: 'ses',
        details: { field: 'config' }
      });
    }

    const {
      accessKeyId,
      secretAccessKey,
      region,
      configurationSetName,
      client
    } = config;

    if (configurationSetName !== undefined && configurationSetName !== null) {
      validateRequiredString(configurationSetName, 'configurationSetName', 'ses');
      this.#configurationSetName = configurationSetName.trim();
    } else {
      this.#configurationSetName = null;
    }

    if (client) {
      this.#client = client;
      this.#accessKeyId = accessKeyId ? accessKeyId.trim() : null;
      this.#secretAccessKey = secretAccessKey ? secretAccessKey.trim() : null;
      this.#region = region ? region.trim() : null;
      return;
    }

    validateRequiredString(accessKeyId, 'accessKeyId', 'ses');
    validateRequiredString(secretAccessKey, 'secretAccessKey', 'ses');
    validateRequiredString(region, 'region', 'ses');

    this.#accessKeyId = accessKeyId.trim();
    this.#secretAccessKey = secretAccessKey.trim();
    this.#region = region.trim();

    this.#client = new SESClient({
      region: this.#region,
      credentials: {
        accessKeyId: this.#accessKeyId,
        secretAccessKey: this.#secretAccessKey
      }
    });
  }

  /**
   * Returns a list of supported operations for Amazon SES.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['send']);
  }

  /**
   * Get the underlying SESClient instance.
   * @returns {SESClient}
   */
  get client() {
    return this.#client;
  }

  /**
   * Sends an email via Amazon SES.
   *
   * @param {Object} params
   * @param {string} params.from - Sender email address (e.g. "Sender Name <sender@example.com>").
   * @param {string|string[]} params.to - Recipient email address or array of recipient email addresses.
   * @param {string} params.subject - Email subject line.
   * @param {string} [params.html] - HTML formatted email body.
   * @param {string} [params.text] - Plain text email body.
   * @param {string|string[]} [params.replyTo] - Reply-to email address(es).
   * @param {string|string[]} [params.cc] - Carbon copy recipient(s).
   * @param {string|string[]} [params.bcc] - Blind carbon copy recipient(s).
   * @param {string} [params.configurationSetName] - Optional override Configuration Set name.
   * @param {Array<{name: string, value: string}>} [params.tags] - Email tags for message tracking.
   * @param {Object} [params.extraOptions] - Additional parameters for SendEmailCommand.
   * @returns {Promise<{success: true, provider: 'ses', data: {id: string, raw: Object}}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If SES rejects or fails the email transmission.
   */
  async send({
    from,
    to,
    subject,
    html,
    text,
    replyTo,
    cc,
    bcc,
    configurationSetName,
    tags,
    ...extraOptions
  } = {}) {
    validateRequiredString(from, 'from', 'ses');
    const validatedTo = validateEmailRecipients(to, 'to', 'ses');
    validateRequiredString(subject, 'subject', 'ses');

    const hasValidHtml = typeof html === 'string' && html.trim().length > 0;
    const hasValidText = typeof text === 'string' && text.trim().length > 0;

    if (!hasValidHtml && !hasValidText) {
      throw new ValidationError(
        "At least one of 'html' or 'text' must be provided as a non-empty string",
        {
          provider: 'ses',
          details: { fields: ['html', 'text'] }
        }
      );
    }

    if (html !== undefined && html !== null && !hasValidHtml) {
      throw new ValidationError("Field 'html' must be a non-empty string if provided", {
        provider: 'ses',
        details: { field: 'html' }
      });
    }

    if (text !== undefined && text !== null && !hasValidText) {
      throw new ValidationError("Field 'text' must be a non-empty string if provided", {
        provider: 'ses',
        details: { field: 'text' }
      });
    }

    let validatedReplyTo;
    if (replyTo !== undefined && replyTo !== null) {
      validatedReplyTo = validateEmailRecipients(replyTo, 'replyTo', 'ses');
    }

    let validatedCc;
    if (cc !== undefined && cc !== null) {
      validatedCc = validateEmailRecipients(cc, 'cc', 'ses');
    }

    let validatedBcc;
    if (bcc !== undefined && bcc !== null) {
      validatedBcc = validateEmailRecipients(bcc, 'bcc', 'ses');
    }

    let resolvedConfigurationSetName = this.#configurationSetName;
    if (configurationSetName !== undefined && configurationSetName !== null) {
      validateRequiredString(configurationSetName, 'configurationSetName', 'ses');
      resolvedConfigurationSetName = configurationSetName.trim();
    }

    let formattedTags;
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        throw new ValidationError("Field 'tags' must be an array of { name, value } objects", {
          provider: 'ses',
          details: { field: 'tags' }
        });
      }

      formattedTags = tags.map((tag, index) => {
        if (!tag || typeof tag !== 'object' || Array.isArray(tag)) {
          throw new ValidationError(`Field 'tags[${index}]' must be an object with name and value`, {
            provider: 'ses',
            details: { field: `tags[${index}]` }
          });
        }
        validateRequiredString(tag.name, `tags[${index}].name`, 'ses');
        validateRequiredString(tag.value, `tags[${index}].value`, 'ses');
        return {
          Name: tag.name.trim(),
          Value: tag.value.trim()
        };
      });
    }

    const commandInput = {
      Source: from.trim(),
      Destination: {
        ToAddresses: Array.isArray(validatedTo) ? validatedTo : [validatedTo],
        ...(validatedCc ? { CcAddresses: Array.isArray(validatedCc) ? validatedCc : [validatedCc] } : {}),
        ...(validatedBcc ? { BccAddresses: Array.isArray(validatedBcc) ? validatedBcc : [validatedBcc] } : {})
      },
      Message: {
        Subject: {
          Data: subject.trim(),
          Charset: 'UTF-8'
        },
        Body: {
          ...(hasValidHtml ? { Html: { Data: html.trim(), Charset: 'UTF-8' } } : {}),
          ...(hasValidText ? { Text: { Data: text.trim(), Charset: 'UTF-8' } } : {})
        }
      },
      ...(validatedReplyTo ? { ReplyToAddresses: Array.isArray(validatedReplyTo) ? validatedReplyTo : [validatedReplyTo] } : {}),
      ...(resolvedConfigurationSetName ? { ConfigurationSetName: resolvedConfigurationSetName } : {}),
      ...(formattedTags ? { Tags: formattedTags } : {}),
      ...extraOptions
    };

    try {
      const command = new SendEmailCommand(commandInput);
      const result = await this.#client.send(command);

      if (!result?.MessageId) {
        throw new IntegrationError('Amazon SES did not return a valid MessageId', {
          code: 'PROVIDER_ERROR',
          statusCode: 502,
          provider: 'ses'
        });
      }

      return this.normalizeSuccess({
        id: result.MessageId,
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Amazon SES email delivery failed');
    }
  }

  /**
   * Normalizes Amazon SES SDK errors into standard IntegrationError.
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

    const errorName = error?.name || error?.Code || '';
    const httpStatusCode = error?.$metadata?.httpStatusCode || error?.statusCode || 502;
    const rawMessage = error?.message || fallbackMessage;

    let code = 'PROVIDER_ERROR';
    let statusCode = httpStatusCode;

    const isAuthError =
      errorName === 'AccessDenied' ||
      errorName === 'AccessDeniedException' ||
      errorName === 'InvalidAccessKeyId' ||
      errorName === 'SignatureDoesNotMatch' ||
      errorName === 'InvalidSecurity' ||
      httpStatusCode === 401 ||
      httpStatusCode === 403;

    if (isAuthError) {
      code = 'AUTHENTICATION_ERROR';
      statusCode = 403;
    } else if (errorName === 'MessageRejected') {
      code = 'PROVIDER_ERROR';
      statusCode = 400;
    } else if (errorName === 'MailFromDomainNotVerifiedException') {
      code = 'PROVIDER_ERROR';
      statusCode = 400;
    } else if (errorName === 'ConfigurationSetDoesNotExistException') {
      code = 'PROVIDER_ERROR';
      statusCode = 400;
    } else if (errorName === 'LimitExceededException') {
      code = 'RATE_LIMIT_EXCEEDED';
      statusCode = 429;
    }

    let sanitizedMessage = rawMessage;
    if (this.#secretAccessKey) {
      sanitizedMessage = sanitizedMessage.replace(new RegExp(this.#secretAccessKey, 'g'), '[REDACTED]');
    }

    const details = {};
    if (errorName) details.name = errorName;

    return new IntegrationError(sanitizedMessage, {
      code,
      statusCode,
      provider: 'ses',
      details: Object.keys(details).length > 0 ? details : null
    });
  }
}
