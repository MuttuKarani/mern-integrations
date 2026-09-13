import crypto from 'crypto';
import { PaymentProvider } from '../../interfaces/PaymentProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateRequiredString,
  validateAmountInSmallestUnit
} from '../../../core/utils/validators.js';

/**
 * PhonePe Payment Provider implementation.
 *
 * Implements Standard Checkout redirect, status verification, refunds,
 * and SHA-256 base64 X-VERIFY checksum cryptography for PhonePe PG APIs.
 */
export class PhonePeProvider extends PaymentProvider {
  /** @type {string} */
  #merchantId;

  /** @type {string} */
  #saltKey;

  /** @type {string} */
  #saltIndex;

  /** @type {string} */
  #baseUrl;

  /** @type {string} */
  #redirectMode;

  /** @type {string|null} */
  #callbackUrl;

  /** @type {typeof fetch} */
  #fetch;

  /**
   * @param {Object} config
   * @param {string} config.merchantId - PhonePe Merchant ID.
   * @param {string} config.saltKey - PhonePe API Salt Key.
   * @param {string|number} [config.saltIndex='1'] - PhonePe Salt Index.
   * @param {string} [config.baseUrl] - Custom API base URL.
   * @param {boolean} [config.testMode=false] - When true, points to sandbox environment.
   * @param {string} [config.redirectMode='REDIRECT'] - Redirect mode ('REDIRECT' or 'POST').
   * @param {string} [config.callbackUrl] - Default callback URL for server-to-server notifications.
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation for mocking.
   */
  constructor(config = {}) {
    super('phonepe');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'phonepe' provider", {
        provider: 'phonepe',
        details: { field: 'config' }
      });
    }

    const {
      merchantId,
      saltKey,
      saltIndex = '1',
      baseUrl = null,
      testMode = false,
      redirectMode = 'REDIRECT',
      callbackUrl = null,
      fetch: customFetch = null
    } = config;

    validateRequiredString(merchantId, 'merchantId', 'phonepe');
    validateRequiredString(saltKey, 'saltKey', 'phonepe');

    this.#merchantId = merchantId.trim();
    this.#saltKey = saltKey.trim();
    this.#saltIndex = String(saltIndex).trim();
    this.#redirectMode = redirectMode.trim().toUpperCase();
    this.#callbackUrl = callbackUrl ? String(callbackUrl).trim() : null;

    if (baseUrl) {
      this.#baseUrl = baseUrl.replace(/\/+$/, '');
    } else if (testMode) {
      this.#baseUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    } else {
      this.#baseUrl = 'https://api.phonepe.com/apis/hermes';
    }

    this.#fetch = customFetch || globalThis.fetch;
  }

  /**
   * Returns list of supported capabilities for PhonePe.
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);
  }

  /**
   * Computes PhonePe X-VERIFY checksum header.
   *
   * @param {string} dataToHash - Either (base64Payload + endpoint) or (endpoint).
   * @returns {string}
   */
  #computeXVerify(dataToHash) {
    const hash = crypto
      .createHash('sha256')
      .update(`${dataToHash}${this.#saltKey}`)
      .digest('hex');
    return `${hash}###${this.#saltIndex}`;
  }

  /**
   * Initiates payment order on PhonePe by generating the payment page redirect URL.
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest unit (paise for INR).
   * @param {string} [params.currency='INR'] - Currency code.
   * @param {string} [params.merchantTransactionId] - Unique merchant transaction ID.
   * @param {string} [params.merchantUserId] - Customer identifier.
   * @param {string} params.redirectUrl - Return URL after checkout completion.
   * @param {string} [params.callbackUrl] - Server-to-server webhook callback URL.
   * @param {string} [params.mobileNumber] - Customer mobile number.
   * @param {Object} [params.paymentInstrument] - Payment instrument payload (defaults to PAY_PAGE).
   * @returns {Promise<{success: true, provider: 'phonepe', data: Object}>}
   */
  async createOrder({
    amount,
    currency = 'INR',
    merchantTransactionId,
    merchantUserId,
    redirectUrl,
    callbackUrl,
    mobileNumber,
    paymentInstrument = { type: 'PAY_PAGE' },
    ...extraOptions
  } = {}) {
    validateAmountInSmallestUnit(amount, 'amount', 'phonepe');
    validateRequiredString(currency, 'currency', 'phonepe');
    validateRequiredString(redirectUrl, 'redirectUrl', 'phonepe');

    const txId = merchantTransactionId
      ? String(merchantTransactionId).trim()
      : `MT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const userId = merchantUserId
      ? String(merchantUserId).trim()
      : `MUID_${Date.now()}`;

    const activeCallbackUrl = callbackUrl || this.#callbackUrl || redirectUrl;

    const payload = {
      merchantId: this.#merchantId,
      merchantTransactionId: txId,
      merchantUserId: userId,
      amount,
      redirectUrl,
      redirectMode: this.#redirectMode,
      callbackUrl: activeCallbackUrl,
      ...(mobileNumber ? { mobileNumber: String(mobileNumber).trim() } : {}),
      paymentInstrument,
      ...extraOptions
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const endpointPath = '/pg/v1/pay';
    const xVerify = this.#computeXVerify(`${base64Payload}${endpointPath}`);

    const result = await this.#request(`${this.#baseUrl}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const redirectInfo = result.data?.instrumentResponse?.redirectInfo;

    return this.normalizeSuccess({
      id: txId,
      merchantTransactionId: txId,
      merchantUserId: userId,
      amount,
      currency: currency.toUpperCase(),
      redirectUrl: redirectInfo?.url || null,
      redirectMethod: redirectInfo?.method || 'GET',
      status: result.code || 'PAYMENT_INITIATED',
      raw: result
    });
  }

  /**
   * Alias for createOrder.
   */
  async initiatePayment(params) {
    return this.createOrder(params);
  }

  /**
   * Verifies live transaction status directly via PhonePe Status Check API.
   *
   * @param {Object} params
   * @param {string} params.merchantTransactionId - Merchant transaction identifier to verify.
   * @returns {Promise<{success: true, provider: 'phonepe', data: Object}>}
   */
  async verifyPayment({ merchantTransactionId } = {}) {
    validateRequiredString(merchantTransactionId, 'merchantTransactionId', 'phonepe');

    const endpointPath = `/pg/v1/status/${this.#merchantId}/${merchantTransactionId.trim()}`;
    const xVerify = this.#computeXVerify(endpointPath);

    const result = await this.#request(`${this.#baseUrl}${endpointPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': this.#merchantId
      }
    });

    const isSuccess = result.code === 'PAYMENT_SUCCESS' || result.data?.state === 'COMPLETED';

    return this.normalizeSuccess({
      id: result.data?.transactionId || merchantTransactionId,
      merchantTransactionId,
      transactionId: result.data?.transactionId || null,
      amount: result.data?.amount || null,
      state: result.data?.state || result.code,
      responseCode: result.data?.responseCode || null,
      paymentInstrument: result.data?.paymentInstrument || null,
      verified: isSuccess,
      status: isSuccess ? 'succeeded' : (result.data?.state?.toLowerCase() || 'failed'),
      raw: result
    });
  }

  /**
   * Verifies callback payload received from client or browser redirect.
   *
   * @param {Object} params
   * @param {string} params.response - Base64 encoded response string received from PhonePe.
   * @param {string} [params.signature] - Optional X-VERIFY signature to validate.
   * @returns {Promise<{success: true, provider: 'phonepe', data: Object}>}
   */
  async verifyCallback({ response, signature } = {}) {
    validateRequiredString(response, 'response', 'phonepe');

    if (signature) {
      const expectedSignature = this.#computeXVerify(response);
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const receivedBuf = Buffer.from(signature, 'utf8');

      const matches =
        expectedBuf.length === receivedBuf.length &&
        crypto.timingSafeEqual(expectedBuf, receivedBuf);

      if (!matches) {
        throw new ValidationError('PhonePe callback signature verification failed', {
          provider: 'phonepe',
          details: { field: 'signature' }
        });
      }
    }

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(response, 'base64').toString('utf8'));
    } catch (e) {
      throw new ValidationError(`Malformed base64 response from PhonePe: ${e.message}`, {
        provider: 'phonepe',
        details: { originalMessage: e.message }
      });
    }

    const isSuccess = decoded.code === 'PAYMENT_SUCCESS' || decoded.data?.state === 'COMPLETED';

    return this.normalizeSuccess({
      verified: isSuccess,
      merchantTransactionId: decoded.data?.merchantTransactionId || null,
      transactionId: decoded.data?.transactionId || null,
      amount: decoded.data?.amount || null,
      state: decoded.data?.state || decoded.code,
      responseCode: decoded.data?.responseCode || null,
      status: isSuccess ? 'succeeded' : 'failed',
      raw: decoded
    });
  }

  /**
   * Initiates a refund for a previously completed PhonePe payment.
   *
   * @param {Object} params
   * @param {string} params.merchantTransactionId - Unique refund transaction identifier.
   * @param {string} params.originalTransactionId - The original payment's transaction ID.
   * @param {number} params.amount - Refund amount in paise.
   * @param {string} [params.callbackUrl] - Webhook callback URL for refund status update.
   * @returns {Promise<{success: true, provider: 'phonepe', data: Object}>}
   */
  async refund({
    merchantTransactionId,
    originalTransactionId,
    amount,
    callbackUrl,
    ...extraOptions
  } = {}) {
    validateRequiredString(merchantTransactionId, 'merchantTransactionId', 'phonepe');
    validateRequiredString(originalTransactionId, 'originalTransactionId', 'phonepe');
    validateAmountInSmallestUnit(amount, 'amount', 'phonepe');

    const payload = {
      merchantId: this.#merchantId,
      merchantTransactionId: merchantTransactionId.trim(),
      originalTransactionId: originalTransactionId.trim(),
      amount,
      callbackUrl: callbackUrl || this.#callbackUrl || 'https://callback.local',
      ...extraOptions
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const endpointPath = '/pg/v1/refund';
    const xVerify = this.#computeXVerify(`${base64Payload}${endpointPath}`);

    const result = await this.#request(`${this.#baseUrl}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const isAccepted = result.success === true || result.code === 'PAYMENT_SUCCESS';

    return this.normalizeSuccess({
      id: merchantTransactionId,
      merchantTransactionId,
      originalTransactionId,
      amount,
      status: result.data?.state || result.code || (isAccepted ? 'processed' : 'failed'),
      raw: result
    });
  }

  /**
   * Cryptographically verifies server-to-server webhook callback signatures.
   *
   * @param {Object} params
   * @param {string|Buffer|Object} params.payload - The raw request body or payload object with 'response' field.
   * @param {string} params.signature - The 'x-verify' signature header.
   * @param {string} [params.saltKey] - Optional override salt key.
   * @param {string|number} [params.saltIndex] - Optional override salt index.
   * @returns {Promise<{success: true, provider: 'phonepe', data: {verified: boolean, data?: Object}}>}
   */
  async verifyWebhook({ payload, signature, saltKey, saltIndex } = {}) {
    validateRequiredString(signature, 'signature', 'phonepe');

    let base64String;
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        base64String = parsed.response || payload;
      } catch {
        base64String = payload;
      }
    } else if (Buffer.isBuffer(payload)) {
      const str = payload.toString('utf8');
      try {
        const parsed = JSON.parse(str);
        base64String = parsed.response || str;
      } catch {
        base64String = str;
      }
    } else if (payload && typeof payload === 'object') {
      base64String = payload.response || JSON.stringify(payload);
    } else {
      throw new ValidationError("Payload must be a non-empty string, Buffer, or object with 'response' property", {
        provider: 'phonepe',
        details: { field: 'payload' }
      });
    }

    const activeSaltKey = saltKey || this.#saltKey;
    const activeSaltIndex = saltIndex !== undefined ? String(saltIndex) : this.#saltIndex;

    const expectedHash = crypto
      .createHash('sha256')
      .update(`${base64String}${activeSaltKey}`)
      .digest('hex');

    const expectedSignature = `${expectedHash}###${activeSaltIndex}`;

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    const verified =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    let decoded = null;
    if (verified) {
      try {
        decoded = JSON.parse(Buffer.from(base64String, 'base64').toString('utf8'));
      } catch {
        decoded = null;
      }
    }

    return this.normalizeSuccess({
      verified,
      ...(decoded ? { event: decoded } : {})
    });
  }

  /**
   * Internal request helper for PhonePe HTTP calls.
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
      throw new IntegrationError(`Network error communicating with PhonePe: ${networkError.message}`, {
        code: 'NETWORK_ERROR',
        statusCode: 502,
        provider: 'phonepe',
        details: { originalMessage: networkError.message }
      });
    }

    let parsed;
    const text = await response.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }

    if (!response.ok || parsed.success === false) {
      const status = response.status;
      const message = parsed.message || `PhonePe error: ${parsed.code || status}`;
      const code = status === 401 || status === 403
        ? 'AUTHENTICATION_ERROR'
        : parsed.code === 'BAD_REQUEST'
        ? 'VALIDATION_ERROR'
        : 'PROVIDER_ERROR';

      throw new IntegrationError(`PhonePe request failed: ${message}`, {
        code,
        statusCode: status >= 400 ? status : 400,
        provider: 'phonepe',
        details: {
          phonepeCode: parsed.code,
          message: parsed.message
        }
      });
    }

    return parsed;
  }
}
