import crypto from 'node:crypto';
import { PaymentProvider } from '../../interfaces/PaymentProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateAmountInSmallestUnit,
  validateRequiredString,
  validateRawPayload
} from '../../../core/utils/validators.js';

/**
 * Cashfree Payment Provider implementation.
 *
 * Implements Cashfree Payment Gateway APIs (v2023-08-01+):
 * - Order creation (returns payment_session_id for Cashfree Web Checkout SDK)
 * - Order status & payment verification
 * - Webhook signature verification (x-webhook-signature & x-webhook-timestamp)
 * - Refund processing
 */
export class CashfreeProvider extends PaymentProvider {
  /** @type {string} */
  #appId;

  /** @type {string} */
  #secretKey;

  /** @type {string} */
  #apiVersion;

  /** @type {string} */
  #baseUrl;

  /** @type {boolean} */
  #testMode;

  /** @type {typeof fetch} */
  #fetch;

  /**
   * @param {Object} [config={}]
   * @param {string} [config.appId] - Cashfree App ID / Client ID (or process.env.CASHFREE_APP_ID).
   * @param {string} [config.clientId] - Alias for appId.
   * @param {string} [config.secretKey] - Cashfree Secret Key (or process.env.CASHFREE_SECRET_KEY).
   * @param {string} [config.clientSecret] - Alias for secretKey.
   * @param {string} [config.apiVersion='2023-08-01'] - Cashfree API Version.
   * @param {string} [config.baseUrl] - Custom base URL for Cashfree PG API.
   * @param {boolean} [config.testMode=false] - Whether to use the Sandbox environment.
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation for mocking/testing.
   * @throws {ValidationError} If required credentials are missing.
   */
  constructor(config = {}) {
    super('cashfree');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'cashfree' provider", {
        provider: 'cashfree',
        details: { field: 'config' }
      });
    }

    const resolvedAppId =
      config.appId ||
      config.clientId ||
      process.env.CASHFREE_APP_ID ||
      process.env.CASHFREE_CLIENT_ID;

    const resolvedSecretKey =
      config.secretKey ||
      config.clientSecret ||
      process.env.CASHFREE_SECRET_KEY ||
      process.env.CASHFREE_CLIENT_SECRET;

    const resolvedApiVersion =
      config.apiVersion ||
      process.env.CASHFREE_API_VERSION ||
      '2023-08-01';

    const isTestKey =
      Boolean((resolvedAppId && resolvedAppId.toUpperCase().startsWith('TEST')) ||
      (resolvedSecretKey && resolvedSecretKey.toLowerCase().includes('test')));

    const testMode =
      config.testMode !== undefined
        ? Boolean(config.testMode)
        : (config.env && config.env.toUpperCase() === 'SANDBOX') ||
          (process.env.CASHFREE_ENV && process.env.CASHFREE_ENV.toUpperCase() === 'SANDBOX') ||
          process.env.CASHFREE_TEST_MODE === 'true' ||
          isTestKey;

    validateRequiredString(resolvedAppId, 'appId', 'cashfree');
    validateRequiredString(resolvedSecretKey, 'secretKey', 'cashfree');

    this.#appId = resolvedAppId.trim();
    this.#secretKey = resolvedSecretKey.trim();
    this.#apiVersion = resolvedApiVersion.trim();
    this.#testMode = testMode;

    if (config.baseUrl) {
      this.#baseUrl = config.baseUrl.replace(/\/+$/, '');
    } else if (testMode) {
      this.#baseUrl = 'https://sandbox.cashfree.com/pg';
    } else {
      this.#baseUrl = 'https://api.cashfree.com/pg';
    }

    this.#fetch = config.fetch || globalThis.fetch;
  }

  /**
   * Returns list of supported capabilities for Cashfree.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze([
      'createOrder',
      'initiatePayment',
      'verifyPayment',
      'verifyCallback',
      'refund',
      'verifyWebhook'
    ]);
  }

  /**
   * Whether the provider instance is configured in test/sandbox mode.
   *
   * @returns {boolean}
   */
  get testMode() {
    return this.#testMode;
  }

  /**
   * Cashfree PG base URL.
   *
   * @returns {string}
   */
  get baseUrl() {
    return this.#baseUrl;
  }

  /**
   * Creates a payment order on Cashfree PG and retrieves a payment_session_id.
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest currency unit (paise for INR, e.g. 50000 = ₹500.00).
   * @param {string} [params.currency='INR'] - 3-letter currency code (defaults to 'INR').
   * @param {string} [params.orderId] - Unique internal order identifier.
   * @param {string} [params.receipt] - Internal receipt alias for orderId if not provided.
   * @param {Object} [params.customer] - Customer details object { id, phone, email, name }.
   * @param {string} [params.customerId] - Direct customer ID.
   * @param {string} [params.customerPhone] - Direct customer phone number.
   * @param {string} [params.customerEmail] - Direct customer email address.
   * @param {string} [params.customerName] - Direct customer name.
   * @param {string} [params.returnUrl] - Redirect return URL after checkout.
   * @param {string} [params.notifyUrl] - Webhook notification URL.
   * @param {Object} [params.notes] - Custom metadata tags.
   * @param {string} [params.orderNote] - Order description note.
   * @param {Object} [params.extraOptions] - Additional Cashfree order payload options.
   * @returns {Promise<{success: true, provider: 'cashfree', data: Object}>}
   */
  async createOrder({
    amount,
    currency = 'INR',
    orderId,
    receipt,
    customer = {},
    customerId,
    customerPhone,
    customerEmail,
    customerName,
    returnUrl,
    notifyUrl,
    notes,
    orderNote,
    ...extraOptions
  } = {}) {
    validateAmountInSmallestUnit(amount, 'amount', 'cashfree');
    validateRequiredString(currency, 'currency', 'cashfree');

    const generatedOrderId =
      orderId ||
      receipt ||
      `cf_ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const resolvedCustomerId =
      customer.id ||
      customer.customerId ||
      customerId ||
      `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const resolvedCustomerPhone =
      customer.phone ||
      customerPhone ||
      '9999999999';

    const resolvedCustomerEmail =
      customer.email ||
      customerEmail ||
      'customer@example.com';

    const resolvedCustomerName =
      customer.name ||
      customerName ||
      'Customer';

    // Cashfree expects decimal currency amount in Rupees, e.g. 50000 paise -> 500.00
    const orderAmount = Number((amount / 100).toFixed(2));

    const orderMeta = {};
    if (returnUrl) orderMeta.return_url = returnUrl;
    if (notifyUrl) orderMeta.notify_url = notifyUrl;

    const payload = {
      order_id: String(generatedOrderId).trim(),
      order_amount: orderAmount,
      order_currency: currency.toUpperCase().trim(),
      customer_details: {
        customer_id: String(resolvedCustomerId).trim(),
        customer_phone: String(resolvedCustomerPhone).trim(),
        customer_email: String(resolvedCustomerEmail).trim(),
        customer_name: String(resolvedCustomerName).trim()
      },
      ...(Object.keys(orderMeta).length > 0 ? { order_meta: orderMeta } : {}),
      ...(orderNote ? { order_note: String(orderNote) } : {}),
      ...(notes ? { order_tags: notes } : {}),
      ...extraOptions
    };

    const response = await this.#request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return this.normalizeSuccess({
      id: response.order_id,
      orderId: response.order_id,
      cfOrderId: response.cf_order_id,
      paymentSessionId: response.payment_session_id,
      amount,
      orderAmount: response.order_amount,
      currency: response.order_currency,
      status: response.order_status,
      receipt: receipt || response.order_id,
      entity: response.entity || 'order',
      orderExpiryTime: response.order_expiry_time || null,
      raw: response
    });
  }

  /**
   * Initiates payment order on Cashfree (alias for createOrder).
   *
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async initiatePayment(params) {
    return this.createOrder(params);
  }

  /**
   * Verifies payment status directly by fetching order status and associated payments from Cashfree PG API.
   *
   * @param {Object} params
   * @param {string} params.orderId - Cashfree order ID to verify.
   * @returns {Promise<{success: true, provider: 'cashfree', data: Object}>}
   */
  async verifyPayment({ orderId } = {}) {
    validateRequiredString(orderId, 'orderId', 'cashfree');

    const cleanOrderId = encodeURIComponent(String(orderId).trim());
    const orderData = await this.#request(`/orders/${cleanOrderId}`, {
      method: 'GET'
    });

    let payments = [];
    try {
      payments = await this.#request(`/orders/${cleanOrderId}/payments`, {
        method: 'GET'
      });
      if (!Array.isArray(payments)) {
        payments = [];
      }
    } catch {
      // If payments sub-endpoint fails, proceed with base order status
      payments = [];
    }

    const isPaid = orderData.order_status === 'PAID';
    const successfulPayment = payments.find(
      (p) => p.payment_status === 'SUCCESS'
    ) || payments[0] || null;

    const amountInPaise = Math.round((Number(orderData.order_amount) || 0) * 100);

    return this.normalizeSuccess({
      verified: isPaid,
      orderId: orderData.order_id,
      cfOrderId: orderData.cf_order_id,
      paymentId: successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : null,
      status: isPaid ? 'succeeded' : (orderData.order_status || 'failed').toLowerCase(),
      orderStatus: orderData.order_status,
      amount: amountInPaise,
      currency: orderData.order_currency,
      payments,
      raw: orderData
    });
  }

  /**
   * Verifies callback redirect from Cashfree checkout.
   *
   * @param {Object} params
   * @param {string} params.orderId - Cashfree order ID.
   * @returns {Promise<Object>}
   */
  async verifyCallback({ orderId } = {}) {
    return this.verifyPayment({ orderId });
  }

  /**
   * Cryptographically verifies an incoming Cashfree webhook signature using timing-safe comparison.
   *
   * Cashfree signature algorithm:
   * Computed = HMAC-SHA256(timestamp + rawPayload, secretKey).digest('base64')
   *
   * @param {Object} params
   * @param {string|Buffer} params.payload - Raw HTTP request body.
   * @param {string} params.signature - Value from 'x-webhook-signature' header.
   * @param {string|number} params.timestamp - Value from 'x-webhook-timestamp' header.
   * @param {string} [params.secret] - Optional secret override.
   * @returns {Promise<{success: true, provider: 'cashfree', data: {verified: boolean}}>}
   */
  async verifyWebhook({ payload, signature, timestamp, secret } = {}) {
    validateRawPayload(payload, 'payload', 'cashfree');
    validateRequiredString(signature, 'signature', 'cashfree');

    if (!timestamp || String(timestamp).trim().length === 0) {
      throw new ValidationError(
        "Field 'timestamp' is required for Cashfree webhook signature verification (from 'x-webhook-timestamp' header)",
        {
          provider: 'cashfree',
          details: { field: 'timestamp' }
        }
      );
    }

    const activeSecret = secret || this.#secretKey;
    const rawPayloadString = Buffer.isBuffer(payload)
      ? payload.toString('utf8')
      : typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    const dataToSign = `${String(timestamp).trim()}${rawPayloadString}`;

    const expectedSignature = crypto
      .createHmac('sha256', activeSecret)
      .update(dataToSign)
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(signature.trim(), 'utf8');

    const verified =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    return this.normalizeSuccess({
      verified
    });
  }

  /**
   * Issues a full or partial refund for a Cashfree order.
   *
   * @param {Object} params
   * @param {string} params.orderId - Cashfree order ID to refund.
   * @param {number} params.amount - Refund amount in smallest unit (paise for INR).
   * @param {string} [params.refundId] - Unique refund identifier.
   * @param {string} [params.note] - Optional refund reason note.
   * @param {string} [params.speed='STANDARD'] - Refund speed ('STANDARD' or 'INSTANT').
   * @returns {Promise<{success: true, provider: 'cashfree', data: Object}>}
   */
  async refund({ orderId, amount, refundId, note, speed = 'STANDARD', ...extraOptions } = {}) {
    validateRequiredString(orderId, 'orderId', 'cashfree');
    validateAmountInSmallestUnit(amount, 'amount', 'cashfree');

    const cleanOrderId = encodeURIComponent(String(orderId).trim());
    const refundAmount = Number((amount / 100).toFixed(2));
    const generatedRefundId =
      refundId || `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const payload = {
      refund_amount: refundAmount,
      refund_id: String(generatedRefundId).trim(),
      refund_speed: speed,
      ...(note ? { refund_note: String(note) } : {}),
      ...extraOptions
    };

    const response = await this.#request(`/orders/${cleanOrderId}/refunds`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return this.normalizeSuccess({
      id: response.refund_id,
      refundId: response.refund_id,
      cfRefundId: response.cf_refund_id,
      orderId: response.order_id,
      amount,
      refundAmount: response.refund_amount,
      currency: response.refund_currency || 'INR',
      status: response.refund_status,
      speed: response.refund_speed,
      raw: response
    });
  }

  /**
   * Internal HTTP request handler for Cashfree PG API.
   *
   * @param {string} endpoint - API path starting with '/'
   * @param {RequestInit} [options={}] - HTTP options
   * @returns {Promise<any>}
   * @private
   */
  async #request(endpoint, options = {}) {
    const url = `${this.#baseUrl}${endpoint}`;
    const headers = {
      'x-client-id': this.#appId,
      'x-client-secret': this.#secretKey,
      'x-api-version': this.#apiVersion,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers
    };

    let response;
    try {
      response = await this.#fetch(url, {
        ...options,
        headers
      });
    } catch (networkError) {
      throw new IntegrationError(
        `Network error communicating with Cashfree: ${networkError.message}`,
        {
          code: 'NETWORK_ERROR',
          statusCode: 502,
          provider: 'cashfree',
          details: { originalMessage: networkError.message }
        }
      );
    }

    let parsed;
    const text = await response.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }

    if (!response.ok) {
      const status = response.status;
      let rawMessage = parsed.message || parsed.error || `Cashfree API returned HTTP ${status}`;

      // Redact secretKey from error message if leaked
      if (this.#secretKey) {
        rawMessage = rawMessage.replaceAll(this.#secretKey, '[REDACTED]');
      }

      const code =
        status === 401 || status === 403
          ? 'AUTHENTICATION_ERROR'
          : status === 400 || status === 422
          ? 'VALIDATION_ERROR'
          : parsed.code || 'CASHFREE_API_ERROR';

      throw new IntegrationError(`Cashfree request failed: ${rawMessage}`, {
        code,
        statusCode: status,
        provider: 'cashfree',
        details: {
          cashfreeCode: parsed.code || null,
          type: parsed.type || null,
          message: rawMessage
        }
      });
    }

    return parsed;
  }
}
