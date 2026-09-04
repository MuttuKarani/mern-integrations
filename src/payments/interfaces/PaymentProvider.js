import { IntegrationError } from '../../core/errors/IntegrationError.js';

/**
 * Base abstract class defining the contract for all payment providers.
 */
export class PaymentProvider {
  /**
   * @param {string} name - Unique identifier name of the provider.
   */
  constructor(name) {
    if (new.target === PaymentProvider) {
      throw new IntegrationError('PaymentProvider is an abstract class and cannot be instantiated directly', {
        provider: name || 'core'
      });
    }
    this.name = name;
  }

  /**
   * Creates a payment order on the provider gateway.
   *
   * @param {Object} params
   * @param {number} params.amount - Amount in smallest currency unit (e.g., paise for INR).
   * @param {string} params.currency - 3-letter ISO currency code (e.g., 'INR', 'USD').
   * @param {string} [params.receipt] - Unique internal order/receipt identifier.
   * @param {Object} [params.notes] - Key-value metadata.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async createOrder(params) {
    throw new IntegrationError(`createOrder() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Cryptographically verifies the payment signature received after checkout.
   *
   * @param {Object} params - Verification parameters specific to the provider.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async verifyPayment(params) {
    throw new IntegrationError(`verifyPayment() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Processes a full or partial refund for a payment.
   *
   * @param {Object} params
   * @param {string} params.paymentId - Provider transaction/payment ID.
   * @param {number} [params.amount] - Amount in smallest currency unit to refund.
   * @param {Object} [params.notes] - Key-value metadata.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async refund(params) {
    throw new IntegrationError(`refund() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Cryptographically verifies incoming webhook signatures using the raw HTTP request payload.
   *
   * @param {Object} params
   * @param {string|Buffer} params.payload - Raw unmodified request payload body.
   * @param {string} params.signature - Webhook signature header value.
   * @param {string} [params.secret] - Optional override webhook secret.
   * @returns {Promise<{success: boolean, provider: string, data: Object}>}
   * @abstract
   */
  async verifyWebhook(params) {
    throw new IntegrationError(`verifyWebhook() must be implemented by provider '${this.name}'`, {
      provider: this.name
    });
  }

  /**
   * Formats a normalized success response.
   *
   * @param {Object} data - Result payload.
   * @returns {{success: true, provider: string, data: Object}}
   */
  normalizeSuccess(data) {
    return {
      success: true,
      provider: this.name,
      data
    };
  }

  /**
   * Formats a normalized error response.
   *
   * @param {string} code - Error code.
   * @param {string} message - Error message.
   * @param {*} [details=null] - Optional additional error details.
   * @returns {{success: false, provider: string, error: {code: string, message: string, details?: *}}}
   */
  normalizeError(code, message, details = null) {
    const errorObj = { code, message };
    if (details !== null && details !== undefined) {
      errorObj.details = details;
    }
    return {
      success: false,
      provider: this.name,
      error: errorObj
    };
  }
}
