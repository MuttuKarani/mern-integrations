import crypto from 'crypto';
import { SMSProvider } from '../../interfaces/SMSProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateMobileNumber
} from '../../../core/utils/validators.js';

/**
 * Twilio SMS, WhatsApp, and Twilio Verify v2 OTP Provider.
 *
 * Implements direct HTTP interactions against Twilio REST APIs with zero external SDK dependencies.
 */
export class TwilioProvider extends SMSProvider {
  /** @type {string} */
  #accountSid;

  /** @type {string} */
  #authToken;

  /** @type {string|null} */
  #from;

  /** @type {string|null} */
  #messagingServiceSid;

  /** @type {string|null} */
  #verifyServiceSid;

  /** @type {string|null} */
  #whatsappFrom;

  /** @type {string} */
  #baseUrl;

  /** @type {string} */
  #verifyBaseUrl;

  /** @type {typeof fetch} */
  #fetch;

  /**
   * @param {Object} config
   * @param {string} config.accountSid - Twilio Account SID (e.g. 'AC...').
   * @param {string} config.authToken - Twilio Auth Token.
   * @param {string} [config.from] - Default sender phone number (E.164).
   * @param {string} [config.messagingServiceSid] - Twilio Messaging Service SID ('MG...').
   * @param {string} [config.verifyServiceSid] - Twilio Verify Service SID ('VA...').
   * @param {string} [config.whatsappFrom] - Default WhatsApp sender (e.g. 'whatsapp:+14155238886').
   * @param {string} [config.baseUrl='https://api.twilio.com'] - Twilio API base URL.
   * @param {string} [config.verifyBaseUrl='https://verify.twilio.com'] - Twilio Verify API base URL.
   * @param {typeof fetch} [config.fetch] - Custom fetch for mocking.
   */
  constructor(config = {}) {
    super('twilio');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'twilio' provider", {
        provider: 'twilio',
        details: { field: 'config' }
      });
    }

    const {
      accountSid,
      authToken,
      from = null,
      messagingServiceSid = null,
      verifyServiceSid = null,
      whatsappFrom = null,
      baseUrl = 'https://api.twilio.com',
      verifyBaseUrl = 'https://verify.twilio.com',
      fetch: customFetch = null
    } = config;

    validateRequiredString(accountSid, 'accountSid', 'twilio');
    validateRequiredString(authToken, 'authToken', 'twilio');

    this.#accountSid = accountSid.trim();
    this.#authToken = authToken.trim();
    this.#from = from ? String(from).trim() : null;
    this.#messagingServiceSid = messagingServiceSid ? String(messagingServiceSid).trim() : null;
    this.#verifyServiceSid = verifyServiceSid ? String(verifyServiceSid).trim() : null;
    this.#whatsappFrom = whatsappFrom ? String(whatsappFrom).trim() : null;
    this.#baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://api.twilio.com';
    this.#verifyBaseUrl = verifyBaseUrl ? verifyBaseUrl.replace(/\/+$/, '') : 'https://verify.twilio.com';
    this.#fetch = customFetch || globalThis.fetch;
  }

  /**
   * Returns list of supported capabilities for Twilio.
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['sendSMS', 'sendOTP', 'verifyOTP', 'sendWhatsApp', 'verifyWebhook']);
  }

  /**
   * Returns Basic Authorization header value.
   * @returns {string}
   */
  #getAuthHeader() {
    return `Basic ${Buffer.from(`${this.#accountSid}:${this.#authToken}`).toString('base64')}`;
  }

  /**
   * Sends an SMS message using Twilio Messages API.
   *
   * @param {Object} params
   * @param {string} params.to - Recipient phone number (E.164).
   * @param {string} params.message - SMS message body.
   * @param {string} [params.from] - Sender phone number.
   * @param {string} [params.messagingServiceSid] - Messaging Service SID.
   * @returns {Promise<{success: true, provider: 'twilio', data: Object}>}
   */
  async sendSMS({ to, message, from, messagingServiceSid, ...extraOptions } = {}) {
    validateMobileNumber(to, 'to', 'twilio');
    validateRequiredString(message, 'message', 'twilio');

    const activeFrom = from || this.#from;
    const activeServiceSid = messagingServiceSid || this.#messagingServiceSid;

    if (!activeFrom && !activeServiceSid) {
      throw new ValidationError(
        "Either 'from' or 'messagingServiceSid' must be provided to send Twilio SMS",
        {
          provider: 'twilio',
          details: { field: 'from/messagingServiceSid' }
        }
      );
    }

    const formParams = new URLSearchParams();
    formParams.append('To', to);
    formParams.append('Body', message);

    if (activeFrom) {
      formParams.append('From', activeFrom);
    } else if (activeServiceSid) {
      formParams.append('MessagingServiceSid', activeServiceSid);
    }

    for (const [key, value] of Object.entries(extraOptions)) {
      if (value !== undefined && value !== null) {
        formParams.append(key, String(value));
      }
    }

    const endpoint = `${this.#baseUrl}/2010-04-01/Accounts/${this.#accountSid}/Messages.json`;

    const data = await this.#request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.#getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formParams.toString()
    });

    return this.normalizeSuccess({
      id: data.sid,
      sid: data.sid,
      to: data.to,
      from: data.from,
      body: data.body,
      status: data.status,
      dateCreated: data.date_created,
      dateSent: data.date_sent,
      raw: data
    });
  }

  /**
   * Generates and delivers an OTP using Twilio Verify v2 API.
   *
   * @param {Object} params
   * @param {string} params.to - Recipient phone number (E.164).
   * @param {'sms'|'call'|'whatsapp'|'email'} [params.channel='sms'] - Delivery channel.
   * @param {string} [params.serviceSid] - Twilio Verify Service SID override.
   * @returns {Promise<{success: true, provider: 'twilio', data: Object}>}
   */
  async sendOTP({ to, channel = 'sms', serviceSid, ...extraOptions } = {}) {
    validateMobileNumber(to, 'to', 'twilio');

    const activeServiceSid = serviceSid || this.#verifyServiceSid;
    if (!activeServiceSid) {
      throw new ValidationError(
        "Twilio Verify requires 'serviceSid' (configured in constructor or passed to sendOTP)",
        {
          provider: 'twilio',
          details: { field: 'serviceSid' }
        }
      );
    }

    const formParams = new URLSearchParams();
    formParams.append('To', to);
    formParams.append('Channel', channel);

    for (const [key, value] of Object.entries(extraOptions)) {
      if (value !== undefined && value !== null) {
        formParams.append(key, String(value));
      }
    }

    const endpoint = `${this.#verifyBaseUrl}/v2/Services/${activeServiceSid}/Verifications`;

    const data = await this.#request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.#getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formParams.toString()
    });

    return this.normalizeSuccess({
      sid: data.sid,
      serviceSid: data.service_sid,
      to: data.to,
      channel: data.channel,
      status: data.status,
      valid: data.valid,
      raw: data
    });
  }

  /**
   * Verifies an OTP code using Twilio Verify v2 API.
   *
   * @param {Object} params
   * @param {string} params.to - Recipient phone number (E.164).
   * @param {string} params.otp - The OTP code candidate.
   * @param {string} [params.serviceSid] - Twilio Verify Service SID override.
   * @returns {Promise<{success: true, provider: 'twilio', data: Object}>}
   */
  async verifyOTP({ to, otp, serviceSid, ...extraOptions } = {}) {
    validateMobileNumber(to, 'to', 'twilio');
    validateRequiredString(otp, 'otp', 'twilio');

    const activeServiceSid = serviceSid || this.#verifyServiceSid;
    if (!activeServiceSid) {
      throw new ValidationError(
        "Twilio Verify requires 'serviceSid' (configured in constructor or passed to verifyOTP)",
        {
          provider: 'twilio',
          details: { field: 'serviceSid' }
        }
      );
    }

    const formParams = new URLSearchParams();
    formParams.append('To', to);
    formParams.append('Code', otp.trim());

    for (const [key, value] of Object.entries(extraOptions)) {
      if (value !== undefined && value !== null) {
        formParams.append(key, String(value));
      }
    }

    const endpoint = `${this.#verifyBaseUrl}/v2/Services/${activeServiceSid}/VerificationCheck`;

    const data = await this.#request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.#getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formParams.toString()
    });

    const isApproved = data.status === 'approved';

    return this.normalizeSuccess({
      sid: data.sid,
      serviceSid: data.service_sid,
      to: data.to,
      status: data.status,
      valid: isApproved,
      verified: isApproved,
      raw: data
    });
  }

  /**
   * Sends a WhatsApp message via Twilio.
   *
   * @param {Object} params
   * @param {string} params.to - Recipient number (E.164 or prefixed with whatsapp:).
   * @param {string} [params.message] - Message body text.
   * @param {string} [params.from] - Sender number (prefixed with whatsapp:).
   * @param {string} [params.contentSid] - Twilio Content SID for approved WhatsApp templates.
   * @param {Record<string, any>} [params.contentVariables] - Variables for Content Template.
   * @returns {Promise<{success: true, provider: 'twilio', data: Object}>}
   */
  async sendWhatsApp({ to, message, from, contentSid, contentVariables, ...extraOptions } = {}) {
    validateRequiredString(to, 'to', 'twilio');

    const rawNumber = to.replace(/^whatsapp:/, '');
    validateMobileNumber(rawNumber, 'to', 'twilio');
    const formattedTo = `whatsapp:${rawNumber}`;

    const activeFrom = from || this.#whatsappFrom || (this.#from ? `whatsapp:${this.#from.replace(/^whatsapp:/, '')}` : null);
    if (!activeFrom) {
      throw new ValidationError(
        "WhatsApp sender 'from' must be provided or configured in constructor as whatsappFrom",
        {
          provider: 'twilio',
          details: { field: 'from/whatsappFrom' }
        }
      );
    }
    const formattedFrom = activeFrom.startsWith('whatsapp:') ? activeFrom : `whatsapp:${activeFrom}`;

    if (!message && !contentSid) {
      throw new ValidationError(
        "Either 'message' or 'contentSid' must be provided to send a WhatsApp message",
        {
          provider: 'twilio',
          details: { field: 'message/contentSid' }
        }
      );
    }

    const formParams = new URLSearchParams();
    formParams.append('To', formattedTo);
    formParams.append('From', formattedFrom);

    if (contentSid) {
      formParams.append('ContentSid', contentSid);
      if (contentVariables) {
        formParams.append('ContentVariables', JSON.stringify(contentVariables));
      }
    } else {
      formParams.append('Body', message);
    }

    for (const [key, value] of Object.entries(extraOptions)) {
      if (value !== undefined && value !== null) {
        formParams.append(key, String(value));
      }
    }

    const endpoint = `${this.#baseUrl}/2010-04-01/Accounts/${this.#accountSid}/Messages.json`;

    const data = await this.#request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.#getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formParams.toString()
    });

    return this.normalizeSuccess({
      id: data.sid,
      sid: data.sid,
      to: data.to,
      from: data.from,
      body: data.body,
      status: data.status,
      dateCreated: data.date_created,
      raw: data
    });
  }

  /**
   * Cryptographically verifies an incoming webhook signature sent by Twilio.
   *
   * @param {Object} params
   * @param {string} params.url - Full webhook URL requested by Twilio (e.g. 'https://myapi.com/webhooks/twilio').
   * @param {Record<string, any>} [params.params={}] - POST parameters received in request body.
   * @param {string} params.signature - Signature header ('x-twilio-signature').
   * @param {string} [params.authToken] - Optional override auth token.
   * @returns {Promise<{success: true, provider: 'twilio', data: {verified: boolean}}>}
   */
  async verifyWebhook({ url, params = {}, signature, authToken } = {}) {
    validateRequiredString(url, 'url', 'twilio');
    validateRequiredString(signature, 'signature', 'twilio');

    const activeToken = authToken || this.#authToken;

    let dataToSign = url;
    if (params && typeof params === 'object') {
      const sortedKeys = Object.keys(params).sort();
      for (const key of sortedKeys) {
        dataToSign += key + (params[key] ?? '');
      }
    }

    const expectedSignature = crypto
      .createHmac('sha1', activeToken)
      .update(Buffer.from(dataToSign, 'utf-8'))
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    const verified =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    return this.normalizeSuccess({ verified });
  }

  /**
   * Private HTTP request helper with error normalization.
   *
   * @param {string} url
   * @param {RequestInit} options
   * @returns {Promise<any>}
   */
  async #request(url, options) {
    let response;
    try {
      response = await this.#fetch(url, options);
    } catch (networkError) {
      throw new IntegrationError(`Network error communicating with Twilio: ${networkError.message}`, {
        code: 'NETWORK_ERROR',
        statusCode: 502,
        provider: 'twilio',
        details: { originalMessage: networkError.message }
      });
    }

    let parsedBody;
    const text = await response.text();
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = { rawText: text };
    }

    if (!response.ok) {
      const status = response.status;
      const message = parsedBody.message || parsedBody.rawText || `Twilio API error HTTP ${status}`;
      const code = status === 401 || status === 403
        ? 'AUTHENTICATION_ERROR'
        : status === 429
        ? 'RATE_LIMIT_EXCEEDED'
        : 'PROVIDER_ERROR';

      throw new IntegrationError(`Twilio API request failed: ${message}`, {
        code,
        statusCode: status,
        provider: 'twilio',
        details: {
          twilioCode: parsedBody.code,
          moreInfo: parsedBody.more_info,
          status
        }
      });
    }

    return parsedBody;
  }
}
