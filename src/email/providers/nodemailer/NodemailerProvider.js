import { EmailProvider } from '../../interfaces/EmailProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateEmailRecipients,
  validateRequiredObject
} from '../../../core/utils/validators.js';
import { loadOptionalDependency } from '../../../core/utils/dependencies.js';

/**
 * Nodemailer SMTP Email Provider implementation.
 */
export class NodemailerProvider extends EmailProvider {
  /** @type {any} */
  #transporter;

  /** @type {string|null} */
  #host;

  /** @type {number|null} */
  #port;

  /** @type {boolean|null} */
  #secure;

  /** @type {string|null} */
  #service;

  /** @type {Object|null} */
  #auth;

  /** @type {Object} */
  #transportOptions;

  /** @type {Function|null} */
  #loader;

  /**
   * @param {Object} config
   * @param {string} [config.host] - SMTP server hostname (e.g. 'smtp.mailtrap.io').
   * @param {number} [config.port] - SMTP server port (e.g. 587, 465, 2525).
   * @param {boolean} [config.secure] - Whether to use TLS/SSL (true for 465, false for other ports).
   * @param {string} [config.service] - Well-known service name (e.g. 'gmail', 'outlook', etc.).
   * @param {Object} [config.auth] - Authentication object { user, pass }.
   * @param {string} [config.user] - Username / email convenience option.
   * @param {string} [config.pass] - Password / app password convenience option.
   * @param {Object} [config.tls] - Additional TLS options.
   * @param {boolean} [config.pool] - Set to true to use pooled connections.
   * @param {number} [config.maxConnections] - Max concurrent connections for pooling.
   * @param {any} [config.transporter] - Pre-instantiated Nodemailer Transporter (optional, for testing/custom transport).
   * @param {Function} [config.loader] - Optional custom import function for testing.
   * @throws {ValidationError} If required connection or authentication options are invalid.
   */
  constructor(config = {}) {
    super('nodemailer');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'nodemailer' provider", {
        provider: 'nodemailer',
        details: { field: 'config' }
      });
    }

    const {
      host,
      port,
      secure,
      service,
      auth,
      user,
      pass,
      tls,
      pool,
      maxConnections,
      transporter = null,
      loader = null,
      ...otherOptions
    } = config;

    if (host !== undefined && host !== null) {
      validateRequiredString(host, 'host', 'nodemailer');
      this.#host = host.trim();
    } else {
      this.#host = null;
    }

    if (service !== undefined && service !== null) {
      validateRequiredString(service, 'service', 'nodemailer');
      this.#service = service.trim();
    } else {
      this.#service = null;
    }

    if (!transporter && !this.#host && !this.#service) {
      throw new ValidationError("Either 'host' or 'service' is required for Nodemailer SMTP configuration", {
        provider: 'nodemailer',
        details: { fields: ['host', 'service'] }
      });
    }

    if (port !== undefined && port !== null) {
      if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new ValidationError("Field 'port' must be a valid integer between 1 and 65535", {
          provider: 'nodemailer',
          details: { field: 'port', received: port }
        });
      }
      this.#port = port;
    } else {
      this.#port = null;
    }

    if (secure !== undefined && secure !== null) {
      this.#secure = Boolean(secure);
    } else {
      this.#secure = null;
    }

    let resolvedAuth = null;
    if (auth !== undefined && auth !== null) {
      validateRequiredObject(auth, 'auth', 'nodemailer');
      if (auth.user !== undefined && auth.user !== null) {
        validateRequiredString(auth.user, 'auth.user', 'nodemailer');
      }
      if (auth.pass !== undefined && auth.pass !== null) {
        validateRequiredString(auth.pass, 'auth.pass', 'nodemailer');
      }
      resolvedAuth = { ...auth };
      if (typeof resolvedAuth.user === 'string') resolvedAuth.user = resolvedAuth.user.trim();
      if (typeof resolvedAuth.pass === 'string') resolvedAuth.pass = resolvedAuth.pass.trim();
    }

    if (user !== undefined && user !== null) {
      validateRequiredString(user, 'user', 'nodemailer');
      resolvedAuth = resolvedAuth || {};
      resolvedAuth.user = user.trim();
    }

    if (pass !== undefined && pass !== null) {
      validateRequiredString(pass, 'pass', 'nodemailer');
      resolvedAuth = resolvedAuth || {};
      resolvedAuth.pass = pass.trim();
    }

    this.#auth = resolvedAuth;
    this.#transporter = transporter || null;
    this.#loader = loader || null;

    this.#transportOptions = {
      ...(this.#service ? { service: this.#service } : {}),
      ...(this.#host ? { host: this.#host } : {}),
      ...(this.#port !== null ? { port: this.#port } : {}),
      ...(this.#secure !== null ? { secure: this.#secure } : {}),
      ...(this.#auth ? { auth: this.#auth } : {}),
      ...(tls ? { tls } : {}),
      ...(pool !== undefined ? { pool: Boolean(pool) } : {}),
      ...(maxConnections !== undefined ? { maxConnections } : {}),
      ...otherOptions
    };
  }

  /**
   * Lazily loads the Nodemailer SDK and creates the transporter if not already provided.
   *
   * @returns {Promise<any>}
   * @private
   */
  async #getTransporter() {
    if (!this.#transporter) {
      const nodemailerModule = await loadOptionalDependency('nodemailer', 'nodemailer', this.#loader);
      const nodemailer = nodemailerModule.default || nodemailerModule;
      this.#transporter = nodemailer.createTransport(this.#transportOptions);
    }
    return this.#transporter;
  }

  /**
   * Returns a list of supported operations for Nodemailer.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['send', 'verify']);
  }

  /**
   * Get the underlying Nodemailer Transporter instance.
   * @returns {any}
   */
  get transporter() {
    return this.#transporter;
  }

  /**
   * Sends an email via Nodemailer SMTP transporter.
   *
   * @param {Object} params
   * @param {string} params.from - Sender email address (e.g. '"Sender Name" <sender@example.com>').
   * @param {string|string[]} params.to - Recipient email address or array of recipient email addresses.
   * @param {string} params.subject - Email subject line.
   * @param {string} [params.html] - HTML formatted email body.
   * @param {string} [params.text] - Plain text email body.
   * @param {string|string[]} [params.replyTo] - Reply-to email address(es).
   * @param {string|string[]} [params.cc] - Carbon copy recipient(s).
   * @param {string|string[]} [params.bcc] - Blind carbon copy recipient(s).
   * @param {Array<{filename: string, content?: string|Buffer, path?: string}>} [params.attachments] - Email attachments.
   * @param {Object} [params.headers] - Custom email headers dictionary.
   * @param {Object} [params.extraOptions] - Additional Nodemailer options.
   * @returns {Promise<{success: true, provider: 'nodemailer', data: Object}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If Nodemailer fails to transmit the email.
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
    attachments,
    headers,
    ...extraOptions
  } = {}) {
    validateRequiredString(from, 'from', 'nodemailer');
    const validatedTo = validateEmailRecipients(to, 'to', 'nodemailer');
    validateRequiredString(subject, 'subject', 'nodemailer');

    const hasValidHtml = typeof html === 'string' && html.trim().length > 0;
    const hasValidText = typeof text === 'string' && text.trim().length > 0;

    if (!hasValidHtml && !hasValidText) {
      throw new ValidationError(
        "At least one of 'html' or 'text' must be provided as a non-empty string",
        {
          provider: 'nodemailer',
          details: { fields: ['html', 'text'] }
        }
      );
    }

    if (html !== undefined && html !== null && !hasValidHtml) {
      throw new ValidationError("Field 'html' must be a non-empty string if provided", {
        provider: 'nodemailer',
        details: { field: 'html' }
      });
    }

    if (text !== undefined && text !== null && !hasValidText) {
      throw new ValidationError("Field 'text' must be a non-empty string if provided", {
        provider: 'nodemailer',
        details: { field: 'text' }
      });
    }

    let validatedReplyTo = null;
    if (replyTo !== undefined && replyTo !== null) {
      validatedReplyTo = validateEmailRecipients(replyTo, 'replyTo', 'nodemailer');
    }

    let validatedCc = null;
    if (cc !== undefined && cc !== null) {
      validatedCc = validateEmailRecipients(cc, 'cc', 'nodemailer');
    }

    let validatedBcc = null;
    if (bcc !== undefined && bcc !== null) {
      validatedBcc = validateEmailRecipients(bcc, 'bcc', 'nodemailer');
    }

    if (attachments !== undefined && attachments !== null) {
      if (!Array.isArray(attachments)) {
        throw new ValidationError("Field 'attachments' must be an array", {
          provider: 'nodemailer',
          details: { field: 'attachments' }
        });
      }
    }

    if (headers !== undefined && headers !== null) {
      validateRequiredObject(headers, 'headers', 'nodemailer');
    }

    const mailOptions = {
      from: from.trim(),
      to: validatedTo,
      subject: subject.trim(),
      ...(hasValidHtml ? { html: html.trim() } : {}),
      ...(hasValidText ? { text: text.trim() } : {}),
      ...(validatedReplyTo ? { replyTo: validatedReplyTo } : {}),
      ...(validatedCc ? { cc: validatedCc } : {}),
      ...(validatedBcc ? { bcc: validatedBcc } : {}),
      ...(attachments ? { attachments } : {}),
      ...(headers ? { headers } : {}),
      ...extraOptions
    };

    try {
      const transporter = await this.#getTransporter();
      const info = await transporter.sendMail(mailOptions);

      return this.normalizeSuccess({
        id: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        response: info?.response || null,
        raw: info
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to send email via Nodemailer SMTP');
    }
  }

  /**
   * Verifies SMTP server connection and authentication.
   *
   * @returns {Promise<{success: true, provider: 'nodemailer', data: {verified: true}}>}
   * @throws {IntegrationError} If connection or authentication fails.
   */
  async verify() {
    try {
      const transporter = await this.#getTransporter();
      await transporter.verify();

      return this.normalizeSuccess({
        verified: true
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'SMTP connection verification failed');
    }
  }

  /**
   * Normalizes Nodemailer SMTP errors into standard IntegrationError.
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

    const errorCode = error?.code || '';
    const responseCode = error?.responseCode;
    const response = error?.response || '';
    const rawMessage = error?.message || fallbackMessage;

    let code = 'PROVIDER_ERROR';
    let statusCode = 502;

    const isAuthError =
      errorCode === 'EAUTH' ||
      responseCode === 535 ||
      /535\b|authentication failed|invalid login|credentials/i.test(rawMessage) ||
      /535\b|authentication failed|invalid login/i.test(response);

    if (isAuthError) {
      code = 'AUTHENTICATION_ERROR';
      statusCode = 401;
    } else if (errorCode === 'ETIMEDOUT') {
      statusCode = 504;
    } else if (
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ECONNECTION' ||
      errorCode === 'ESOCKET' ||
      errorCode === 'ENOTFOUND'
    ) {
      statusCode = 502;
    }

    // Clean any accidentally embedded auth secrets in message string
    let sanitizedMessage = rawMessage;
    if (this.#auth?.pass) {
      sanitizedMessage = sanitizedMessage.replace(new RegExp(this.#auth.pass, 'g'), '[REDACTED]');
    }

    const details = {};
    if (errorCode) details.code = errorCode;
    if (responseCode) details.responseCode = responseCode;
    if (error?.command) details.command = error.command;

    return new IntegrationError(sanitizedMessage, {
      code,
      statusCode,
      provider: 'nodemailer',
      details: Object.keys(details).length > 0 ? details : null
    });
  }
}
