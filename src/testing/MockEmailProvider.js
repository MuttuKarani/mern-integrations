import { EmailProvider } from '../email/interfaces/EmailProvider.js';
import { ValidationError } from '../core/errors/ValidationError.js';
import {
  validateEmail,
  validateEmailRecipients,
  validateRequiredString
} from '../core/utils/validators.js';

/**
 * In-memory mock email provider for local development, integration testing, and CI pipelines.
 */
export class MockEmailProvider extends EmailProvider {
  #sentEmails;
  #counter;

  /**
   * @param {Object} [config={}] - Optional configuration.
   */
  constructor(config = {}) {
    super('mock');
    this.#sentEmails = [];
    this.#counter = 0;
  }

  /**
   * List of supported capabilities for MockEmailProvider.
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['send', 'verify']);
  }

  /**
   * Simulates sending an email by capturing it in memory.
   *
   * @param {Object} params
   * @param {string} params.from - Sender email address.
   * @param {string|string[]} params.to - Recipient email(s).
   * @param {string} params.subject - Email subject.
   * @param {string} [params.html] - HTML body.
   * @param {string} [params.text] - Plain text body.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async send({ from = 'mock@example.com', to, subject, html, text, ...extra } = {}) {
    validateEmail(from, 'from', 'mock');
    validateEmailRecipients(to, 'to', 'mock');
    validateRequiredString(subject, 'subject', 'mock');

    const hasHtml = typeof html === 'string' && html.trim().length > 0;
    const hasText = typeof text === 'string' && text.trim().length > 0;

    if (!hasHtml && !hasText) {
      throw new ValidationError(
        'At least one of "html" or "text" must be provided as a non-empty string',
        {
          provider: 'mock',
          details: { field: 'html/text' }
        }
      );
    }

    this.#counter++;
    const messageId = `mock_email_${Date.now()}_${this.#counter}`;

    const record = {
      id: messageId,
      messageId,
      from,
      to,
      subject,
      ...(hasHtml ? { html } : {}),
      ...(hasText ? { text } : {}),
      status: 'queued',
      sentAt: new Date().toISOString(),
      ...extra
    };

    this.#sentEmails.push(record);

    return this.normalizeSuccess(record);
  }

  /**
   * Simulates transport connection verification.
   * @returns {Promise<{success: true, provider: 'mock', data: {connected: boolean}}>}
   */
  async verify() {
    return this.normalizeSuccess({ connected: true });
  }

  // --- Testing and Inspection Helpers ---

  /**
   * Returns a list of all emails captured in memory.
   * @returns {Array<Object>}
   */
  getSentEmails() {
    return [...this.#sentEmails];
  }

  /**
   * Returns the most recently sent email.
   * @returns {Object|null}
   */
  getLastSentEmail() {
    return this.#sentEmails[this.#sentEmails.length - 1] || null;
  }

  /**
   * Clears captured emails from memory.
   */
  clearSentEmails() {
    this.#sentEmails = [];
    this.#counter = 0;
  }

  /**
   * Reset helper alias for clearSentEmails.
   */
  reset() {
    this.clearSentEmails();
  }
}
