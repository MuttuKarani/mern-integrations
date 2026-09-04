import { PaymentProvider } from '../../interfaces/PaymentProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import {
  validateAmountInSmallestUnit,
  validateRequiredString
} from '../../../core/utils/validators.js';
import { encrypt, parseEncryptedResponse } from './ccavenue.crypto.js';

/**
 * CCAvenue Payment Provider implementation.
 *
 * Implements redirect-based payment initiation and encrypted response verification
 * adhering strictly to the official CCAvenue Web Integration Kit specification.
 */
export class CCAvenueProvider extends PaymentProvider {
  /** @type {string} */
  #merchantId;

  /** @type {string} */
  #accessCode;

  /** @type {string} */
  #workingKey;

  /** @type {string} */
  #baseUrl;

  /**
   * @param {Object} [config={}]
   * @param {string} config.merchantId - CCAvenue Merchant ID.
   * @param {string} config.accessCode - CCAvenue Access Code.
   * @param {string} config.workingKey - CCAvenue Working Key (Encryption Key).
   * @param {string} [config.baseUrl] - Custom base gateway URL.
   * @param {boolean} [config.testMode=false] - If true, points to CCAvenue test environment (https://test.ccavenue.com).
   * @throws {ValidationError} If required credentials are missing.
   */
  constructor(config = {}) {
    super('ccavenue');

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ValidationError("Config must be a valid object for 'ccavenue' provider", {
        provider: 'ccavenue',
        details: { field: 'config' }
      });
    }

    const { merchantId, accessCode, workingKey, baseUrl = null, testMode = false } = config;

    validateRequiredString(merchantId, 'merchantId', 'ccavenue');
    validateRequiredString(accessCode, 'accessCode', 'ccavenue');
    validateRequiredString(workingKey, 'workingKey', 'ccavenue');

    this.#merchantId = merchantId.trim();
    this.#accessCode = accessCode.trim();
    this.#workingKey = workingKey.trim();

    if (baseUrl) {
      this.#baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      this.#baseUrl = testMode
        ? 'https://test.ccavenue.com'
        : 'https://secure.ccavenue.com';
    }
  }

  /**
   * Returns a list of supported operations for CCAvenue.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['createOrder', 'initiatePayment', 'verifyPayment', 'verifyCallback', 'parseEncryptedResponse']);
  }

  /**
   * Generates a normalized redirect payment initiation descriptor for CCAvenue.
   *
   * @param {Object} params
   * @param {string} params.orderId - Unique internal merchant order reference ID.
   * @param {number} params.amount - Amount in smallest currency unit (paise for INR: ₹10 = 1000).
   * @param {string} [params.currency='INR'] - 3-letter currency code (only 'INR' supported in Phase 2).
   * @param {string} params.redirectUrl - Merchant URL where customer is redirected upon successful payment.
   * @param {string} params.cancelUrl - Merchant URL where customer is redirected upon failure or cancellation.
   * @param {Object} [params.billing] - Customer billing information.
   * @param {Object} [params.shipping] - Customer shipping / delivery information.
   * @param {Object} [params.extraParams] - Additional custom CCAvenue parameters.
   * @returns {Promise<{success: true, provider: 'ccavenue', data: Object}>}
   * @throws {ValidationError} If parameters fail validation or unsupported currency is requested.
   */
  async initiatePayment({
    orderId,
    amount,
    currency = 'INR',
    redirectUrl,
    cancelUrl,
    billing = {},
    shipping = {},
    ...extraParams
  } = {}) {
    validateRequiredString(orderId, 'orderId', 'ccavenue');
    validateAmountInSmallestUnit(amount, 'amount', 'ccavenue');
    validateRequiredString(currency, 'currency', 'ccavenue');

    const normalizedCurrency = currency.toUpperCase().trim();
    if (normalizedCurrency !== 'INR') {
      throw new ValidationError(
        `Only currency 'INR' is supported for CCAvenue in Phase 2 (received '${currency}'). Additional currencies will be added in future versions.`,
        {
          provider: 'ccavenue',
          details: { field: 'currency', received: currency }
        }
      );
    }

    validateRequiredString(redirectUrl, 'redirectUrl', 'ccavenue');
    validateRequiredString(cancelUrl, 'cancelUrl', 'ccavenue');

    // Convert integer paise to CCAvenue required 2-decimal format: ₹10.00 -> 1000 paise -> "10.00"
    const formattedAmount = (amount / 100).toFixed(2);

    const params = {
      merchant_id: this.#merchantId,
      order_id: orderId,
      amount: formattedAmount,
      currency: 'INR',
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
      language: 'EN',
      ...(billing.name ? { billing_name: billing.name } : {}),
      ...(billing.address ? { billing_address: billing.address } : {}),
      ...(billing.city ? { billing_city: billing.city } : {}),
      ...(billing.state ? { billing_state: billing.state } : {}),
      ...(billing.zip ? { billing_zip: billing.zip } : {}),
      ...(billing.country ? { billing_country: billing.country } : {}),
      ...(billing.tel ? { billing_tel: billing.tel } : {}),
      ...(billing.email ? { billing_email: billing.email } : {}),
      ...(shipping.name ? { delivery_name: shipping.name } : {}),
      ...(shipping.address ? { delivery_address: shipping.address } : {}),
      ...(shipping.city ? { delivery_city: shipping.city } : {}),
      ...(shipping.state ? { delivery_state: shipping.state } : {}),
      ...(shipping.zip ? { delivery_zip: shipping.zip } : {}),
      ...(shipping.country ? { delivery_country: shipping.country } : {}),
      ...(shipping.tel ? { delivery_tel: shipping.tel } : {}),
      ...extraParams
    };

    const queryString = new URLSearchParams(params).toString();
    const encRequest = encrypt(queryString, this.#workingKey);

    return this.normalizeSuccess({
      orderId,
      action: 'redirect',
      redirectUrl: `${this.#baseUrl}/transaction/transaction.do?command=initiateTransaction`,
      method: 'POST',
      fields: {
        encRequest,
        access_code: this.#accessCode
      }
    });
  }

  /**
   * Implements PaymentProvider.createOrder by delegating to initiatePayment.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'ccavenue', data: Object}>}
   */
  async createOrder(params) {
    return this.initiatePayment(params);
  }

  /**
   * Decrypts and verifies a CCAvenue encrypted POST redirect callback response.
   *
   * @param {Object} params
   * @param {string} params.encResp - Encrypted response hex string sent in the body of redirect_url/cancel_url POST.
   * @returns {Promise<{success: true, provider: 'ccavenue', data: Object}>}
   * @throws {ValidationError} If encResp is missing or not a hex string.
   * @throws {IntegrationError} If decryption fails.
   */
  async verifyCallback({ encResp } = {}) {
    validateRequiredString(encResp, 'encResp', 'ccavenue');

    const parsed = parseEncryptedResponse(encResp, this.#workingKey);

    const orderStatus = parsed.order_status || 'Unknown';
    const isSuccess = orderStatus.toLowerCase() === 'success';

    // Parse decimal amount string ("10.00") back to integer paise (1000) for cross-provider uniformity
    let normalizedAmount = null;
    if (parsed.amount) {
      const parsedFloat = parseFloat(parsed.amount);
      if (!Number.isNaN(parsedFloat)) {
        normalizedAmount = Math.round(parsedFloat * 100);
      }
    }

    return this.normalizeSuccess({
      verified: isSuccess,
      orderId: parsed.order_id || null,
      trackingId: parsed.tracking_id || null,
      bankRefNo: parsed.bank_ref_no || null,
      orderStatus,
      failureMessage: parsed.failure_message || null,
      paymentMode: parsed.payment_mode || null,
      cardName: parsed.card_name || null,
      currency: parsed.currency || 'INR',
      amount: normalizedAmount,
      statusCode: parsed.status_code || null,
      statusMessage: parsed.status_message || null,
      raw: parsed
    });
  }

  /**
   * Implements PaymentProvider.verifyPayment by delegating to verifyCallback.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'ccavenue', data: Object}>}
   */
  async verifyPayment(params) {
    return this.verifyCallback(params);
  }

  /**
   * Programmatic refunds are not supported in this CCAvenue integration.
   *
   * @throws {IntegrationError}
   */
  async refund() {
    throw new IntegrationError(
      'Programmatic refunds are not currently supported for this CCAvenue integration. Please process refunds via the CCAvenue Merchant Dashboard.',
      {
        code: 'UNSUPPORTED_OPERATION',
        statusCode: 501,
        provider: 'ccavenue'
      }
    );
  }

  /**
   * Server-to-server webhook verification is not supported for CCAvenue in Phase 2.
   *
   * @throws {IntegrationError}
   */
  async verifyWebhook() {
    throw new IntegrationError(
      'verifyWebhook() is not supported for CCAvenue. CCAvenue uses browser POST redirect callbacks. Use verifyCallback() instead.',
      {
        code: 'UNSUPPORTED_OPERATION',
        statusCode: 501,
        provider: 'ccavenue'
      }
    );
  }
}
