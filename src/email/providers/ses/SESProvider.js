import { EmailProvider } from '../../interfaces/EmailProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateEmailRecipients
} from '../../../core/utils/validators.js';
import { loadOptionalDependency } from '../../../core/utils/dependencies.js';

/**
 * Amazon Simple Email Service (SES) Provider implementation using AWS SDK v3.
 */
export class SESProvider extends EmailProvider {
  /** @type {any} */
  #client;

  /** @type {any} */
  #SendEmailCommand;

  /** @type {string|null} */
  #accessKeyId;

  /** @type {string|null} */
  #secretAccessKey;

  /** @type {string|null} */
  #region;

  /** @type {string|null} */
  #configurationSetName;

  /** @type {Function|null} */
  #loader;

  /**
   * @param {Object} config
   * @param {string} [config.accessKeyId] - AWS Access Key ID.
   * @param {string} [config.secretAccessKey] - AWS Secret Access Key.
   * @param {string} [config.region] - AWS Region (e.g. 'us-east-1', 'eu-west-1').
   * @param {string} [config.configurationSetName] - Default Amazon SES Configuration Set name.
   * @param {any} [config.client] - Pre-instantiated SESClient instance (optional, for testing).
   * @param {any} [config.SendEmailCommand] - Custom SendEmailCommand constructor (optional, for testing).
   * @param {Function} [config.loader] - Optional custom import function for testing.
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
      client = null,
      SendEmailCommand = null,
      loader = null
    } = config;

    if (configurationSetName !== undefined && configurationSetName !== null) {
      validateRequiredString(configurationSetName, 'configurationSetName', 'ses');
      this.#configurationSetName = configurationSetName.trim();
    } else {
      this.#configurationSetName = null;
    }

    if (!client) {
      validateRequiredString(accessKeyId, 'accessKeyId', 'ses');
      validateRequiredString(secretAccessKey, 'secretAccessKey', 'ses');
      validateRequiredString(region, 'region', 'ses');
    }

    this.#accessKeyId = accessKeyId ? accessKeyId.trim() : null;
    this.#secretAccessKey = secretAccessKey ? secretAccessKey.trim() : null;
    this.#region = region ? region.trim() : null;
    this.#client = client || null;
    this.#SendEmailCommand = SendEmailCommand || null;
    this.#loader = loader || null;
  }

  /**
   * Lazily loads the AWS SES SDK client and command classes if not already initialized.
   *
   * @returns {Promise<{client: any, SendEmailCommand: any}>}
   * @private
   */
  async #getSdk() {
    if (!this.#client || !this.#SendEmailCommand) {
      const sesModule = await loadOptionalDependency('@aws-sdk/client-ses', 'ses', this.#loader);
      if (!this.#client) {
        const SESClient = sesModule.SESClient || sesModule.default?.SESClient;
        this.#client = new SESClient({
          region: this.#region,
          credentials: {
            accessKeyId: this.#accessKeyId,
            secretAccessKey: this.#secretAccessKey
          }
        });
      }
      if (!this.#SendEmailCommand) {
        this.#SendEmailCommand = sesModule.SendEmailCommand || sesModule.default?.SendEmailCommand;
      }
    }
    return {
      client: this.#client,
      SendEmailCommand: this.#SendEmailCommand
    };
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
   * @returns {any}
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

    let validatedReplyTo = null;
    if (replyTo !== undefined && replyTo !== null) {
      const res = validateEmailRecipients(replyTo, 'replyTo', 'ses');
      validatedReplyTo = Array.isArray(res) ? res : [res];
    }

    let validatedCc = null;
    if (cc !== undefined && cc !== null) {
      const res = validateEmailRecipients(cc, 'cc', 'ses');
      validatedCc = Array.isArray(res) ? res : [res];
    }

    let validatedBcc = null;
    if (bcc !== undefined && bcc !== null) {
      const res = validateEmailRecipients(bcc, 'bcc', 'ses');
      validatedBcc = Array.isArray(res) ? res : [res];
    }

    const toAddresses = Array.isArray(validatedTo) ? validatedTo : [validatedTo];

    let formattedTags = null;
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        throw new ValidationError("Field 'tags' must be an array of { name, value } objects", {
          provider: 'ses',
          details: { field: 'tags' }
        });
      }

      formattedTags = tags.map((t, idx) => {
        if (!t || typeof t !== 'object' || Array.isArray(t)) {
          throw new ValidationError(`Field 'tags[${idx}]' must be an object with name and value`, {
            provider: 'ses',
            details: { field: `tags[${idx}]` }
          });
        }
        validateRequiredString(t.name, `tags[${idx}].name`, 'ses');
        validateRequiredString(t.value, `tags[${idx}].value`, 'ses');
        return {
          Name: t.name.trim(),
          Value: t.value.trim()
        };
      });
    }

    const activeConfigSet = configurationSetName
      ? String(configurationSetName).trim()
      : this.#configurationSetName;

    const bodyObj = {};
    if (hasValidHtml) {
      bodyObj.Html = {
        Charset: 'UTF-8',
        Data: html.trim()
      };
    }
    if (hasValidText) {
      bodyObj.Text = {
        Charset: 'UTF-8',
        Data: text.trim()
      };
    }

    const destinationObj = {
      ToAddresses: toAddresses
    };
    if (validatedCc) destinationObj.CcAddresses = validatedCc;
    if (validatedBcc) destinationObj.BccAddresses = validatedBcc;

    const input = {
      Source: from.trim(),
      Destination: destinationObj,
      Message: {
        Subject: {
          Charset: 'UTF-8',
          Data: subject.trim()
        },
        Body: bodyObj
      },
      ...(validatedReplyTo ? { ReplyToAddresses: validatedReplyTo } : {}),
      ...(activeConfigSet ? { ConfigurationSetName: activeConfigSet } : {}),
      ...(formattedTags && formattedTags.length > 0 ? { Tags: formattedTags } : {}),
      ...extraOptions
    };

    try {
      const { client, SendEmailCommand } = await this.#getSdk();
      const command = new SendEmailCommand(input);
      const response = await client.send(command);

      if (!response?.MessageId) {
        throw new IntegrationError('Amazon SES did not return a valid MessageId', {
          code: 'PROVIDER_ERROR',
          statusCode: 502,
          provider: 'ses'
        });
      }

      return this.normalizeSuccess({
        id: response.MessageId,
        raw: response
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to send email via Amazon SES');
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
