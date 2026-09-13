import { SMSProvider } from '../sms/interfaces/SMSProvider.js';
import {
  validateMobileNumber,
  validateRequiredString
} from '../core/utils/validators.js';

/**
 * In-memory mock SMS & OTP provider for local development, integration testing, and CI pipelines.
 */
export class MockSMSProvider extends SMSProvider {
  #sentMessages;
  #otps;
  #counter;

  /**
   * @param {Object} [config={}] - Optional configuration.
   */
  constructor(config = {}) {
    super('mock');
    this.#sentMessages = [];
    this.#otps = new Map();
    this.#counter = 0;
  }

  /**
   * List of supported capabilities for MockSMSProvider.
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['sendSMS', 'sendOTP', 'verifyOTP', 'resendOTP', 'sendWhatsApp']);
  }

  /**
   * Simulates sending an SMS message.
   *
   * @param {Object} params
   * @param {string} params.to - E.164 formatted mobile number.
   * @param {string} params.message - SMS body text.
   * @param {string} [params.senderId] - Optional sender ID.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async sendSMS({ to, message, senderId, ...extra } = {}) {
    validateMobileNumber(to, 'to', 'mock');
    validateRequiredString(message, 'message', 'mock');

    this.#counter++;
    const messageId = `mock_sms_${Date.now()}_${this.#counter}`;

    const record = {
      id: messageId,
      messageId,
      to,
      message,
      senderId: senderId || 'MOCK',
      type: 'sms',
      status: 'delivered',
      sentAt: new Date().toISOString(),
      ...extra
    };

    this.#sentMessages.push(record);

    return this.normalizeSuccess(record);
  }

  /**
   * Simulates dispatching an OTP.
   *
   * @param {Object} params
   * @param {string} params.to - Mobile number.
   * @param {string} [params.otp] - Explicit mock OTP override (defaults to '123456').
   * @param {number} [params.expirySeconds=300] - Expiry in seconds.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async sendOTP({ to, otp = '123456', expirySeconds = 300, ...extra } = {}) {
    validateMobileNumber(to, 'to', 'mock');

    this.#counter++;
    const messageId = `mock_otp_${Date.now()}_${this.#counter}`;
    const otpCode = String(otp);

    this.#otps.set(to, {
      otp: otpCode,
      expiresAt: Date.now() + expirySeconds * 1000
    });

    const record = {
      id: messageId,
      messageId,
      to,
      otp: otpCode,
      status: 'sent',
      sentAt: new Date().toISOString(),
      ...extra
    };

    this.#sentMessages.push({ ...record, type: 'otp' });

    return this.normalizeSuccess(record);
  }

  /**
   * Simulates OTP verification.
   *
   * @param {Object} params
   * @param {string} params.to - Mobile number.
   * @param {string} params.otp - OTP candidate to verify.
   * @returns {Promise<{success: true, provider: 'mock', data: {verified: boolean, to: string}}>}
   */
  async verifyOTP({ to, otp } = {}) {
    validateMobileNumber(to, 'to', 'mock');
    validateRequiredString(otp, 'otp', 'mock');

    const stored = this.#otps.get(to);
    const isExpired = stored ? Date.now() > stored.expiresAt : false;
    const verified = !isExpired && ((stored && stored.otp === String(otp)) || String(otp) === '123456');

    if (verified && stored) {
      this.#otps.delete(to);
    }

    return this.normalizeSuccess({
      verified,
      to,
      expired: isExpired
    });
  }

  /**
   * Simulates resending an OTP.
   *
   * @param {Object} params
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async resendOTP(params = {}) {
    validateMobileNumber(params.to, 'to', 'mock');
    return this.sendOTP(params);
  }

  /**
   * Simulates sending a WhatsApp message.
   *
   * @param {Object} params
   * @param {string} params.to - Mobile number.
   * @param {string} params.templateName - WhatsApp template identifier.
   * @param {Array} [params.components=[]] - Template components.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async sendWhatsApp({ to, templateName, components = [], ...extra } = {}) {
    validateMobileNumber(to, 'to', 'mock');
    validateRequiredString(templateName, 'templateName', 'mock');

    this.#counter++;
    const messageId = `mock_wa_${Date.now()}_${this.#counter}`;

    const record = {
      id: messageId,
      messageId,
      to,
      templateName,
      components,
      type: 'whatsapp',
      status: 'delivered',
      sentAt: new Date().toISOString(),
      ...extra
    };

    this.#sentMessages.push(record);

    return this.normalizeSuccess(record);
  }

  // --- Testing and Inspection Helpers ---

  /**
   * Retrieves all sent SMS, OTP, and WhatsApp messages in memory.
   * @returns {Array<Object>}
   */
  getSentMessages() {
    return [...this.#sentMessages];
  }

  /**
   * Retrieves the latest sent message.
   * @returns {Object|null}
   */
  getLastSentMessage() {
    return this.#sentMessages[this.#sentMessages.length - 1] || null;
  }

  /**
   * Retrieves current OTP states.
   * @returns {Map<string, Object>}
   */
  getGeneratedOTPs() {
    return new Map(this.#otps);
  }

  /**
   * Clears all in-memory message and OTP records.
   */
  clearHistory() {
    this.#sentMessages = [];
    this.#otps.clear();
    this.#counter = 0;
  }

  /**
   * Reset helper alias for clearHistory.
   */
  reset() {
    this.clearHistory();
  }
}
