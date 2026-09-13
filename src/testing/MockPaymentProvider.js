import { PaymentProvider } from '../payments/interfaces/PaymentProvider.js';
import {
  validateRequiredString,
  validateAmountInSmallestUnit,
  validateRawPayload
} from '../core/utils/validators.js';

/**
 * In-memory mock payment provider for local development, integration testing, and CI pipelines.
 */
export class MockPaymentProvider extends PaymentProvider {
  #orders;
  #payments;
  #refunds;
  #orderCounter;
  #refundCounter;

  /**
   * @param {Object} [config={}] - Optional configuration.
   */
  constructor(config = {}) {
    super('mock');
    this.#orders = new Map();
    this.#payments = new Map();
    this.#refunds = new Map();
    this.#orderCounter = 0;
    this.#refundCounter = 0;
  }

  /**
   * List of supported capabilities for MockPaymentProvider.
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
   * Simulates order creation in memory.
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest currency unit.
   * @param {string} [params.currency='INR'] - Currency code.
   * @param {string} [params.receipt] - Receipt ID.
   * @param {Object} [params.notes={}] - Metadata notes.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {}, ...extra } = {}) {
    validateAmountInSmallestUnit(amount, 'amount', 'mock');
    validateRequiredString(currency, 'currency', 'mock');

    if (receipt !== undefined && receipt !== null) {
      validateRequiredString(receipt, 'receipt', 'mock');
    }

    this.#orderCounter++;
    const orderId = receipt
      ? `order_mock_${receipt}_${this.#orderCounter}`
      : `order_mock_${Date.now()}_${this.#orderCounter}`;

    const orderData = {
      id: orderId,
      orderId,
      amount,
      currency: currency.toUpperCase().trim(),
      receipt: receipt || null,
      notes,
      status: 'created',
      createdAt: new Date().toISOString(),
      ...extra
    };

    this.#orders.set(orderId, orderData);

    return this.normalizeSuccess(orderData);
  }

  /**
   * Alias for createOrder.
   */
  async initiatePayment(params) {
    return this.createOrder(params);
  }

  /**
   * Simulates signature and payment verification.
   * Fails if signature equals 'mock_fail_signature'.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async verifyPayment(params = {}) {
    const orderId = params.orderId || params.razorpayOrderId || params.paymentIntentId;
    const paymentId = params.paymentId || params.razorpayPaymentId || `pay_mock_${Date.now()}`;
    const signature = params.signature || params.razorpaySignature || 'mock_valid_signature';

    validateRequiredString(orderId, 'orderId', 'mock');
    validateRequiredString(paymentId, 'paymentId', 'mock');

    const verified = signature !== 'mock_fail_signature';

    const paymentRecord = {
      id: paymentId,
      orderId,
      paymentId,
      verified,
      status: verified ? 'succeeded' : 'failed',
      verifiedAt: new Date().toISOString()
    };

    this.#payments.set(paymentId, paymentRecord);

    return this.normalizeSuccess(paymentRecord);
  }

  /**
   * Alias for verifyPayment.
   */
  async verifyCallback(params) {
    return this.verifyPayment(params);
  }

  /**
   * Simulates processing a refund in memory.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async refund({ paymentId, amount, notes = {}, ...extra } = {}) {
    validateRequiredString(paymentId, 'paymentId', 'mock');

    if (amount !== undefined && amount !== null) {
      validateAmountInSmallestUnit(amount, 'amount', 'mock');
    }

    this.#refundCounter++;
    const refundId = `rfnd_mock_${Date.now()}_${this.#refundCounter}`;

    const refundData = {
      id: refundId,
      refundId,
      paymentId,
      amount: amount || null,
      notes,
      status: 'processed',
      createdAt: new Date().toISOString(),
      ...extra
    };

    this.#refunds.set(refundId, refundData);

    return this.normalizeSuccess(refundData);
  }

  /**
   * Simulates webhook signature verification.
   * Fails if signature equals 'mock_fail_signature' or 'mock_invalid_signature'.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'mock', data: {verified: boolean}}>}
   */
  async verifyWebhook({ payload, signature, secret } = {}) {
    validateRawPayload(payload, 'payload', 'mock');
    validateRequiredString(signature, 'signature', 'mock');

    const verified =
      signature !== 'mock_fail_signature' &&
      signature !== 'mock_invalid_signature';

    return this.normalizeSuccess({ verified });
  }

  // --- Testing and Inspection Helpers ---

  /**
   * Retrieves all orders recorded in memory.
   * @returns {Array<Object>}
   */
  getRecordedOrders() {
    return Array.from(this.#orders.values());
  }

  /**
   * Retrieves a recorded order by ID.
   * @param {string} orderId
   * @returns {Object|null}
   */
  getOrder(orderId) {
    return this.#orders.get(orderId) || null;
  }

  /**
   * Retrieves all verified payments recorded in memory.
   * @returns {Array<Object>}
   */
  getRecordedPayments() {
    return Array.from(this.#payments.values());
  }

  /**
   * Retrieves all refunds recorded in memory.
   * @returns {Array<Object>}
   */
  getRecordedRefunds() {
    return Array.from(this.#refunds.values());
  }

  /**
   * Clears all in-memory records.
   */
  clearHistory() {
    this.#orders.clear();
    this.#payments.clear();
    this.#refunds.clear();
    this.#orderCounter = 0;
    this.#refundCounter = 0;
  }

  /**
   * Reset helper alias for clearHistory.
   */
  reset() {
    this.clearHistory();
  }
}
