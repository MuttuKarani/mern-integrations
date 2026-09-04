import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { PaymentProvider } from '../../interfaces/PaymentProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateAmountInSmallestUnit,
  validateRequiredString,
  validateRawPayload
} from '../../../core/utils/validators.js';

/**
 * Razorpay Payment Provider implementation.
 */
export class RazorpayProvider extends PaymentProvider {
  /** @type {string} */
  #keyId;

  /** @type {string} */
  #keySecret;

  /** @type {string|null} */
  #webhookSecret;

  /** @type {Razorpay} */
  #client;

  /**
   * @param {Object} [config={}]
   * @param {string} [config.keyId] - Razorpay Key ID (API Key).
   * @param {string} [config.keySecret] - Razorpay Key Secret.
   * @param {string} [config.webhookSecret] - Optional Razorpay Webhook Secret.
   * @param {Object} [config.client] - Optional pre-configured Razorpay SDK instance (useful for mocking/testing).
   * @throws {ValidationError} If required credentials are missing.
   */
  constructor(config = {}) {
    super('razorpay');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'razorpay' provider", {
        provider: 'razorpay',
        details: { field: 'config' }
      });
    }

    const { keyId, keySecret, webhookSecret = null, client = null } = config;

    if (!client) {
      validateRequiredString(keyId, 'keyId', 'razorpay');
      validateRequiredString(keySecret, 'keySecret', 'razorpay');
    }

    if (webhookSecret !== null && webhookSecret !== undefined) {
      validateRequiredString(webhookSecret, 'webhookSecret', 'razorpay');
    }

    this.#keyId = keyId || null;
    this.#keySecret = keySecret || null;
    this.#webhookSecret = webhookSecret || null;

    if (client) {
      this.#client = client;
    } else {
      this.#client = new Razorpay({
        key_id: this.#keyId,
        key_secret: this.#keySecret
      });
    }
  }

  /**
   * Get the underlying Razorpay SDK client.
   * @returns {Razorpay}
   */
  get client() {
    return this.#client;
  }

  /**
   * Creates an order on Razorpay.
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest currency unit (e.g. paise for INR: ₹10 = 1000).
   * @param {string} params.currency - 3-letter ISO currency code (e.g. 'INR').
   * @param {string} [params.receipt] - Unique internal receipt/order identifier.
   * @param {Object} [params.notes] - Custom key-value metadata.
   * @param {Object} [params.extraOptions] - Any additional Razorpay-supported order options.
   * @returns {Promise<{success: true, provider: 'razorpay', data: Object}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If Razorpay API rejects the order creation.
   */
  async createOrder({ amount, currency, receipt, notes, ...extraOptions } = {}) {
    validateAmountInSmallestUnit(amount, 'amount', 'razorpay');
    validateRequiredString(currency, 'currency', 'razorpay');

    if (receipt !== undefined && receipt !== null) {
      validateRequiredString(receipt, 'receipt', 'razorpay');
    }

    const payload = {
      amount,
      currency,
      ...(receipt ? { receipt } : {}),
      ...(notes ? { notes } : {}),
      ...extraOptions
    };

    try {
      const order = await this.#client.orders.create(payload);

      return this.normalizeSuccess({
        id: order.id,
        entity: order.entity,
        amount: order.amount,
        amountPaid: order.amount_paid,
        amountDue: order.amount_due,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        attempts: order.attempts,
        notes: order.notes,
        createdAt: order.created_at,
        raw: order
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Order creation failed');
    }
  }

  /**
   * Cryptographically verifies the checkout payment signature using HMAC SHA256 with timing-safe comparison.
   *
   * @param {Object} params
   * @param {string} params.razorpayOrderId - Order ID returned from createOrder.
   * @param {string} params.razorpayPaymentId - Payment ID returned after successful payment.
   * @param {string} params.razorpaySignature - Signature returned by Razorpay checkout.
   * @returns {Promise<{success: true, provider: 'razorpay', data: {verified: boolean, orderId: string, paymentId: string}}>}
   * @throws {ValidationError} If any required verification fields are missing.
   */
  async verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature } = {}) {
    validateRequiredString(razorpayOrderId, 'razorpayOrderId', 'razorpay');
    validateRequiredString(razorpayPaymentId, 'razorpayPaymentId', 'razorpay');
    validateRequiredString(razorpaySignature, 'razorpaySignature', 'razorpay');

    const expectedSignature = crypto
      .createHmac('sha256', this.#keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(razorpaySignature, 'utf8');

    const verified =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    return this.normalizeSuccess({
      verified,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId
    });
  }

  /**
   * Processes a full or partial refund for a payment.
   *
   * @param {Object} params
   * @param {string} params.paymentId - Razorpay Payment ID to refund.
   * @param {number} [params.amount] - Amount in smallest currency unit (e.g. paise for INR). If omitted, full refund is issued.
   * @param {Object} [params.notes] - Custom key-value metadata.
   * @param {Object} [params.extraOptions] - Additional Razorpay refund options (e.g. speed, receipt).
   * @returns {Promise<{success: true, provider: 'razorpay', data: Object}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If Razorpay API rejects the refund.
   */
  async refund({ paymentId, amount, notes, ...extraOptions } = {}) {
    validateRequiredString(paymentId, 'paymentId', 'razorpay');

    const payload = {
      ...(notes ? { notes } : {}),
      ...extraOptions
    };

    if (amount !== undefined && amount !== null) {
      validateAmountInSmallestUnit(amount, 'amount', 'razorpay');
      payload.amount = amount;
    }

    try {
      const refundResult = await this.#client.payments.refund(paymentId, payload);

      return this.normalizeSuccess({
        id: refundResult.id,
        entity: refundResult.entity,
        amount: refundResult.amount,
        currency: refundResult.currency,
        paymentId: refundResult.payment_id,
        status: refundResult.status,
        receipt: refundResult.receipt,
        notes: refundResult.notes,
        createdAt: refundResult.created_at,
        raw: refundResult
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Refund processing failed');
    }
  }

  /**
   * Cryptographically verifies an incoming Razorpay webhook signature using the exact raw payload body.
   *
   * @param {Object} params
   * @param {string|Buffer} params.payload - Raw unmodified request payload body (never JSON-parsed and re-stringified).
   * @param {string} params.signature - Webhook signature received in the 'x-razorpay-signature' header.
   * @param {string} [params.secret] - Optional override webhook secret. If omitted, provider's webhookSecret is used.
   * @returns {Promise<{success: true, provider: 'razorpay', data: {verified: boolean}}>}
   * @throws {ValidationError} If payload, signature, or webhook secret are missing.
   */
  async verifyWebhook({ payload, signature, secret } = {}) {
    validateRawPayload(payload, 'payload', 'razorpay');
    validateRequiredString(signature, 'signature', 'razorpay');

    const activeSecret = secret || this.#webhookSecret;
    if (!activeSecret) {
      throw new ValidationError(
        'Webhook secret is required for webhook signature verification. Provide it in constructor or as a method parameter.',
        {
          provider: 'razorpay',
          details: { field: 'webhookSecret' }
        }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', activeSecret)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    const verified =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    return this.normalizeSuccess({
      verified
    });
  }

  /**
   * Normalizes Razorpay SDK errors into standard IntegrationError instances without leaking sensitive credentials.
   *
   * @param {*} error - Caught error from Razorpay SDK.
   * @param {string} fallbackMessage - Context message if error message is unavailable.
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError) {
      return error;
    }

    let message = error?.error?.description || error?.message || fallbackMessage;

    if (this.#keySecret) {
      message = message.replaceAll(this.#keySecret, '[REDACTED]');
    }
    if (this.#webhookSecret) {
      message = message.replaceAll(this.#webhookSecret, '[REDACTED]');
    }

    const code = error?.error?.code || error?.code || 'RAZORPAY_API_ERROR';
    const statusCode = error?.statusCode || error?.status || 500;
    const details = error?.error?.field ? { field: error.error.field } : (error?.error || null);

    return new IntegrationError(message, {
      code,
      statusCode,
      provider: 'razorpay',
      details
    });
  }
}
