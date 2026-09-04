import { Resend } from 'resend';
import { EmailProvider } from '../../interfaces/EmailProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateEmailRecipients
} from '../../../core/utils/validators.js';

/**
 * Resend Email Provider implementation.
 */
export class ResendProvider extends EmailProvider {
  /** @type {string|null} */
  #apiKey;

  /** @type {Resend} */
  #client;

  /**
   * @param {Object} [config={}]
   * @param {string} [config.apiKey] - Resend API Key.
   * @param {Object} [config.client] - Pre-instantiated Resend SDK instance (optional, for testing).
   * @throws {ValidationError} If apiKey is missing or not a non-empty string.
   */
  constructor(config = {}) {
    super('resend');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'resend' provider", {
        provider: 'resend',
        details: { field: 'config' }
      });
    }

    const { apiKey, client = null } = config;

    if (!client) {
      validateRequiredString(apiKey, 'apiKey', 'resend');
    }

    this.#apiKey = apiKey ? apiKey.trim() : null;

    if (client) {
      this.#client = client;
    } else {
      this.#client = new Resend(this.#apiKey);
    }
  }

  /**
   * Get the underlying Resend SDK client.
   * @returns {Resend}
   */
  get client() {
    return this.#client;
  }

  /**
   * Sends an email via the Resend API.
   *
   * @param {Object} params
   * @param {string} params.from - Sender email address (e.g. "Acme <onboarding@resend.dev>").
   * @param {string|string[]} params.to - Recipient email address or array of recipient email addresses.
   * @param {string} params.subject - Email subject line.
   * @param {string} [params.html] - HTML formatted email body.
   * @param {string} [params.text] - Plain text email body.
   * @param {string|string[]} [params.replyTo] - Reply-to email address(es).
   * @param {string|string[]} [params.cc] - Carbon copy recipient(s).
   * @param {string|string[]} [params.bcc] - Blind carbon copy recipient(s).
   * @param {Array<{name: string, value: string}>} [params.tags] - Custom email tags.
   * @returns {Promise<{success: true, provider: 'resend', data: {id: string}}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If Resend API rejects or fails the email transmission.
   */
  async send({ from, to, subject, html, text, replyTo, cc, bcc, tags } = {}) {
    validateRequiredString(from, 'from', 'resend');
    const validatedTo = validateEmailRecipients(to, 'to', 'resend');
    validateRequiredString(subject, 'subject', 'resend');

    const hasValidHtml = typeof html === 'string' && html.trim().length > 0;
    const hasValidText = typeof text === 'string' && text.trim().length > 0;

    if (!hasValidHtml && !hasValidText) {
      throw new ValidationError(
        "At least one of 'html' or 'text' must be provided as a non-empty string",
        {
          provider: 'resend',
          details: { fields: ['html', 'text'] }
        }
      );
    }

    if (html !== undefined && html !== null && !hasValidHtml) {
      throw new ValidationError("Field 'html' must be a non-empty string if provided", {
        provider: 'resend',
        details: { field: 'html' }
      });
    }

    if (text !== undefined && text !== null && !hasValidText) {
      throw new ValidationError("Field 'text' must be a non-empty string if provided", {
        provider: 'resend',
        details: { field: 'text' }
      });
    }

    let validatedReplyTo;
    if (replyTo !== undefined && replyTo !== null) {
      validatedReplyTo = validateEmailRecipients(replyTo, 'replyTo', 'resend');
    }

    let validatedCc;
    if (cc !== undefined && cc !== null) {
      validatedCc = validateEmailRecipients(cc, 'cc', 'resend');
    }

    let validatedBcc;
    if (bcc !== undefined && bcc !== null) {
      validatedBcc = validateEmailRecipients(bcc, 'bcc', 'resend');
    }

    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        throw new ValidationError("Field 'tags' must be an array of { name, value } objects", {
          provider: 'resend',
          details: { field: 'tags' }
        });
      }

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (!tag || typeof tag !== 'object' || Array.isArray(tag)) {
          throw new ValidationError(`Field 'tags[${i}]' must be an object with name and value`, {
            provider: 'resend',
            details: { field: `tags[${i}]` }
          });
        }
        validateRequiredString(tag.name, `tags[${i}].name`, 'resend');
        validateRequiredString(tag.value, `tags[${i}].value`, 'resend');
      }
    }

    const payload = {
      from: from.trim(),
      to: validatedTo,
      subject: subject.trim(),
      ...(hasValidHtml ? { html: html.trim() } : {}),
      ...(hasValidText ? { text: text.trim() } : {}),
      ...(validatedReplyTo ? { reply_to: validatedReplyTo } : {}),
      ...(validatedCc ? { cc: validatedCc } : {}),
      ...(validatedBcc ? { bcc: validatedBcc } : {}),
      ...(tags ? { tags } : {})
    };

    try {
      const result = await this.#client.emails.send(payload);

      if (result?.error) {
        let errorMsg = result.error.message || 'Failed to send email via Resend';
        if (this.#apiKey) errorMsg = errorMsg.replaceAll(this.#apiKey, '[REDACTED]');

        throw new IntegrationError(errorMsg, {
          code: result.error.name ? result.error.name.toUpperCase() : 'PROVIDER_ERROR',
          statusCode: result.error.statusCode || 502,
          provider: 'resend',
          details: { name: result.error.name }
        });
      }

      if (!result?.data?.id) {
        throw new IntegrationError('Resend did not return a valid email ID', {
          code: 'PROVIDER_ERROR',
          statusCode: 502,
          provider: 'resend'
        });
      }

      return this.normalizeSuccess({
        id: result.data.id
      });
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error;
      }

      let errorMsg = error?.message || 'Failed to send email via Resend';
      if (this.#apiKey) errorMsg = errorMsg.replaceAll(this.#apiKey, '[REDACTED]');

      throw new IntegrationError(errorMsg, {
        code: 'PROVIDER_ERROR',
        statusCode: 502,
        provider: 'resend',
        details: error?.name ? { name: error.name } : null
      });
    }
  }
}
