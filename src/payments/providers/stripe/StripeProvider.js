import { PaymentProvider } from '../../interfaces/PaymentProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateAmountInSmallestUnit,
  validateRequiredString,
  validateRequiredObject,
  validateRawPayload,
  validateEmail
} from '../../../core/utils/validators.js';
import { loadOptionalDependency } from '../../../core/utils/dependencies.js';

/**
 * Stripe Payment Provider implementation using the official Stripe Node.js SDK.
 */
export class StripeProvider extends PaymentProvider {
  /** @type {string|null} */
  #secretKey;

  /** @type {string|null} */
  #webhookSecret;

  /** @type {any} */
  #client;

  /** @type {Function|null} */
  #loader;

  /**
   * @param {Object} [config={}]
   * @param {string} [config.secretKey] - Stripe secret API key (e.g., 'sk_test_...').
   * @param {string} [config.webhookSecret] - Optional Stripe webhook signing secret (e.g., 'whsec_...').
   * @param {Object} [config.client] - Optional pre-configured Stripe SDK instance (useful for mocking/testing).
   * @param {Function} [config.loader] - Optional custom import function for testing.
   * @throws {ValidationError} If required credentials are missing when client is not injected.
   */
  constructor(config = {}) {
    super('stripe');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Field 'config' is required and must be an object", {
        provider: 'stripe',
        details: { field: 'config' }
      });
    }

    const { secretKey, webhookSecret = null, client = null, loader = null } = config;

    if (!client) {
      validateRequiredString(secretKey, 'secretKey', 'stripe');
    }

    if (webhookSecret !== null && webhookSecret !== undefined) {
      validateRequiredString(webhookSecret, 'webhookSecret', 'stripe');
    }

    this.#secretKey = secretKey || null;
    this.#webhookSecret = webhookSecret || null;
    this.#client = client || null;
    this.#loader = loader || null;
  }

  /**
   * Lazily loads the Stripe SDK and instantiates the client if not already provided.
   *
   * @returns {Promise<any>}
   * @private
   */
  async #getClient() {
    if (!this.#client) {
      const StripeModule = await loadOptionalDependency('stripe', 'stripe', this.#loader);
      const Stripe = StripeModule.default || StripeModule;
      this.#client = new Stripe(this.#secretKey);
    }
    return this.#client;
  }

  /**
   * Returns a list of supported operations for Stripe.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'refund', 'verifyWebhook']);
  }

  /**
   * Get the underlying Stripe SDK client instance.
   * @returns {any}
   */
  get client() {
    return this.#client;
  }

  /**
   * Creates a PaymentIntent on Stripe (equivalent to createOrder in the payment provider architecture).
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest currency unit (e.g. cents for USD: $10 = 1000).
   * @param {string} [params.currency='usd'] - 3-letter ISO currency code (e.g. 'usd', 'eur', 'inr').
   * @param {string} [params.description] - Description of the payment intent.
   * @param {string} [params.receiptEmail] - Email address to send a receipt to.
   * @param {Object} [params.metadata] - Key-value metadata dictionary.
   * @param {string} [params.customerId] - Stripe customer ID (e.g. 'cus_...').
   * @param {string|string[]} [params.paymentMethodTypes] - Array or string of payment method types.
   * @param {string} [params.captureMethod] - 'automatic' or 'manual'.
   * @param {Object} [params.extraOptions] - Any additional options accepted by Stripe PaymentIntents create.
   * @returns {Promise<{success: true, provider: 'stripe', data: {id: string, clientSecret: string, amount: number, currency: string, status: string, raw: Object}}>}
   * @throws {ValidationError} If input parameters fail validation.
   * @throws {IntegrationError} If Stripe API fails to create the PaymentIntent.
   */
  async createOrder({
    amount,
    currency = 'usd',
    description,
    receiptEmail,
    metadata,
    customerId,
    paymentMethodTypes,
    captureMethod,
    ...extraOptions
  } = {}) {
    validateAmountInSmallestUnit(amount, 'amount', 'stripe');
    validateRequiredString(currency, 'currency', 'stripe');

    if (description !== undefined && description !== null) {
      validateRequiredString(description, 'description', 'stripe');
    }

    if (receiptEmail !== undefined && receiptEmail !== null) {
      validateEmail(receiptEmail, 'receiptEmail', 'stripe');
    }

    if (customerId !== undefined && customerId !== null) {
      validateRequiredString(customerId, 'customerId', 'stripe');
    }

    if (metadata !== undefined && metadata !== null) {
      validateRequiredObject(metadata, 'metadata', 'stripe');
    }

    if (captureMethod !== undefined && captureMethod !== null) {
      validateRequiredString(captureMethod, 'captureMethod', 'stripe');
    }

    const payload = {
      amount,
      currency: currency.toLowerCase().trim(),
      ...(description ? { description } : {}),
      ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
      ...(metadata ? { metadata } : {}),
      ...(customerId ? { customer: customerId } : {}),
      ...(paymentMethodTypes
        ? {
            payment_method_types: Array.isArray(paymentMethodTypes)
              ? paymentMethodTypes
              : [paymentMethodTypes]
          }
        : {}),
      ...(captureMethod ? { capture_method: captureMethod } : {}),
      ...extraOptions
    };

    try {
      const client = await this.#getClient();
      const paymentIntent = await client.paymentIntents.create(payload);

      return this.normalizeSuccess({
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        raw: paymentIntent
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'PaymentIntent creation failed');
    }
  }

  /**
   * Retrieves and verifies a PaymentIntent status from Stripe.
   *
   * @param {Object} params
   * @param {string} params.paymentIntentId - The Stripe PaymentIntent ID (e.g. 'pi_...').
   * @returns {Promise<{success: true, provider: 'stripe', data: {id: string, status: string, amount: number, currency: string, verified: boolean, raw: Object}}>}
   * @throws {ValidationError} If paymentIntentId is missing or invalid.
   * @throws {IntegrationError} If Stripe API fails to retrieve the PaymentIntent.
   */
  async verifyPayment({ paymentIntentId } = {}) {
    validateRequiredString(paymentIntentId, 'paymentIntentId', 'stripe');

    try {
      const client = await this.#getClient();
      const paymentIntent = await client.paymentIntents.retrieve(paymentIntentId);

      const verified = paymentIntent.status === 'succeeded';

      return this.normalizeSuccess({
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        verified,
        raw: paymentIntent
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Payment verification failed');
    }
  }

  /**
   * Issues a full or partial refund for a PaymentIntent or Charge on Stripe.
   *
   * @param {Object} params
   * @param {string} [params.paymentIntentId] - Stripe PaymentIntent ID to refund.
   * @param {string} [params.chargeId] - Stripe Charge ID to refund.
   * @param {number} [params.amount] - Amount in smallest currency unit to refund. If omitted, full refund is issued.
   * @param {string} [params.reason] - Refund reason ('duplicate', 'fraudulent', 'requested_by_customer').
   * @param {Object} [params.metadata] - Key-value metadata dictionary.
   * @param {Object} [params.extraOptions] - Additional Stripe refund parameters.
   * @returns {Promise<{success: true, provider: 'stripe', data: {id: string, status: string, amount: number, currency: string, raw: Object}}>}
   * @throws {ValidationError} If neither paymentIntentId nor chargeId is provided, or parameters are invalid.
   * @throws {IntegrationError} If Stripe API rejects the refund.
   */
  async refund({
    paymentIntentId,
    chargeId,
    amount,
    reason,
    metadata,
    ...extraOptions
  } = {}) {
    if (!paymentIntentId && !chargeId) {
      throw new ValidationError(
        "Either 'paymentIntentId' or 'chargeId' is required to issue a refund",
        {
          provider: 'stripe',
          details: { fields: ['paymentIntentId', 'chargeId'] }
        }
      );
    }

    if (paymentIntentId !== undefined && paymentIntentId !== null) {
      validateRequiredString(paymentIntentId, 'paymentIntentId', 'stripe');
    }

    if (chargeId !== undefined && chargeId !== null) {
      validateRequiredString(chargeId, 'chargeId', 'stripe');
    }

    if (amount !== undefined && amount !== null) {
      validateAmountInSmallestUnit(amount, 'amount', 'stripe');
    }

    if (reason !== undefined && reason !== null) {
      validateRequiredString(reason, 'reason', 'stripe');
    }

    if (metadata !== undefined && metadata !== null) {
      validateRequiredObject(metadata, 'metadata', 'stripe');
    }

    const payload = {
      ...(paymentIntentId ? { payment_intent: paymentIntentId } : {}),
      ...(chargeId ? { charge: chargeId } : {}),
      ...(amount !== undefined && amount !== null ? { amount } : {}),
      ...(reason ? { reason } : {}),
      ...(metadata ? { metadata } : {}),
      ...extraOptions
    };

    try {
      const client = await this.#getClient();
      const refundResult = await client.refunds.create(payload);

      return this.normalizeSuccess({
        id: refundResult.id,
        status: refundResult.status,
        amount: refundResult.amount,
        currency: refundResult.currency,
        raw: refundResult
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Refund processing failed');
    }
  }

  /**
   * Cryptographically verifies an incoming Stripe webhook event signature using the raw HTTP request payload body.
   *
   * @param {Object} params
   * @param {string|Buffer} params.payload - Raw unmodified request payload body (never pre-parsed JSON).
   * @param {string} params.signature - Value of the 'stripe-signature' header.
   * @param {string} [params.webhookSecret] - Optional override webhook signing secret.
   * @param {string} [params.secret] - Alias for webhookSecret.
   * @returns {Promise<{success: true, provider: 'stripe', data: {verified: boolean, event: Object|null, raw: Object|null}}>}
   * @throws {ValidationError} If payload, signature, or webhook secret are missing.
   */
  async verifyWebhook({ payload, signature, webhookSecret, secret } = {}) {
    validateRawPayload(payload, 'payload', 'stripe');
    validateRequiredString(signature, 'signature', 'stripe');

    const activeSecret = webhookSecret || secret || this.#webhookSecret;
    if (!activeSecret) {
      throw new ValidationError(
        'Webhook secret is required for webhook signature verification. Provide it in constructor or as a method parameter.',
        {
          provider: 'stripe',
          details: { field: 'webhookSecret' }
        }
      );
    }

    try {
      const client = await this.#getClient();
      const event = client.webhooks.constructEvent(payload, signature, activeSecret);

      return this.normalizeSuccess({
        verified: true,
        event,
        raw: event
      });
    } catch (error) {
      if (
        error?.name === 'StripeSignatureVerificationError' ||
        error?.type === 'StripeSignatureVerificationError' ||
        error?.message?.toLowerCase().includes('signature')
      ) {
        return this.normalizeSuccess({
          verified: false,
          event: null,
          raw: null
        });
      }

      throw this.#handleProviderError(error, 'Webhook signature verification failed');
    }
  }

  /**
   * Normalizes Stripe SDK errors into standard IntegrationError instances without leaking sensitive credentials.
   *
   * @param {*} error - Caught error from Stripe SDK.
   * @param {string} fallbackMessage - Context message if error message is unavailable.
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError || error instanceof ValidationError) {
      return error;
    }

    let message = error?.message || fallbackMessage;

    if (this.#secretKey) {
      message = message.replaceAll(this.#secretKey, '[REDACTED]');
    }
    if (this.#webhookSecret) {
      message = message.replaceAll(this.#webhookSecret, '[REDACTED]');
    }

    const type = error?.type || error?.name || '';
    let code = error?.code || 'PROVIDER_ERROR';
    let statusCode = error?.statusCode || error?.status || 500;

    if (type === 'StripeAuthenticationError' || code === 'AUTHENTICATION_ERROR' || statusCode === 401) {
      code = 'AUTHENTICATION_ERROR';
      statusCode = 401;
    } else if (type === 'StripeRateLimitError' || code === 'RATE_LIMIT_EXCEEDED' || statusCode === 429) {
      code = 'RATE_LIMIT_EXCEEDED';
      statusCode = 429;
    } else if (type === 'StripeCardError') {
      code = error?.code || 'CARD_ERROR';
      statusCode = error?.statusCode || 402;
    } else if (type === 'StripeInvalidRequestError' || statusCode === 400) {
      code = error?.code || 'PROVIDER_ERROR';
      statusCode = error?.statusCode || 400;
    } else if (type === 'StripeConnectionError' || statusCode === 503) {
      code = 'PROVIDER_ERROR';
      statusCode = 503;
    }

    const details =
      error?.param || error?.decline_code
        ? { param: error.param, code: error?.code, declineCode: error?.decline_code }
        : (error?.details || null);

    return new IntegrationError(message, {
      code,
      statusCode,
      provider: 'stripe',
      details
    });
  }
}
