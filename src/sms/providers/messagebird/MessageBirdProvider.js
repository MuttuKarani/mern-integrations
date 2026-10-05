import { SMSProvider } from "../../interfaces/SMSProvider.js";
import { IntegrationError } from "../../../core/errors/IntegrationError.js";
import { ValidationError } from "../../../core/errors/ValidationError.js";
import {
  validateRequiredString,
  validateMobileRecipients,
} from "../../../core/utils/validators.js";

/**
 * MessageBird SMS and WhatsApp Provider implementation.
 */
export class MessageBirdProvider extends SMSProvider {
  /** @type {string} */
  #apiKey;

  /** @type {string|null} */
  #channelId;

  /** @type {string|null} */
  #namespace;

  /** @type {string} */
  #baseUrl;

  /** @type {typeof fetch} */
  #fetch;

  /**
   * @param {Object} [config={}]
   * @param {string} config.apiKey - MessageBird API access key.
   * @param {string} [config.channelId] - Default WhatsApp Channel ID.
   * @param {string} [config.namespace] - Default WhatsApp Template namespace ID.
   * @param {string} [config.baseUrl='https://conversations.messagebird.com'] - Base URL for Conversations API.
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation for testing.
   * @throws {ValidationError} If apiKey is missing or not a non-empty string.
   */
  constructor(config = {}) {
    super("messagebird");

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new ValidationError(
        "Config must be a valid object for 'messagebird' provider",
        {
          provider: "messagebird",
          details: { field: "config" },
        },
      );
    }

    const {
      apiKey,
      channelId = null,
      namespace = null,
      baseUrl = "https://conversations.messagebird.com",
      fetch: customFetch = null,
    } = config;

    validateRequiredString(apiKey, "apiKey", "messagebird");

    this.#apiKey = apiKey.trim();
    this.#channelId = channelId ? String(channelId).trim() : null;
    this.#namespace = namespace ? String(namespace).trim() : null;
    this.#baseUrl = baseUrl
      ? baseUrl.replace(/\/+$/, "")
      : "https://conversations.messagebird.com";
    this.#fetch = customFetch || globalThis.fetch;
  }

  /**
   * Returns a list of supported operations for MessageBird.
   *
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(["sendSMS", "sendWhatsApp"]);
  }

  /**
   * Sends WhatsApp template (HSM) messages via MessageBird Conversations API.
   *
   * @param {Object} params
   * @param {string|string[]} params.to - Recipient international mobile number(s).
   * @param {string} [params.templateName] - Name of the approved WhatsApp template.
   * @param {string} [params.templateId] - Alias for templateName.
   * @param {string} [params.namespace] - WhatsApp Template namespace (defaults to constructor namespace).
   * @param {string|Object} [params.language='en'] - Template language code (e.g. 'en') or language object.
   * @param {Array|Object} [params.variables] - Template body variable parameters.
   * @param {Array} [params.components] - Explicit MessageBird HSM components structure.
   * @param {string} [params.channelId] - WhatsApp Channel ID (defaults to constructor channelId).
   * @param {Object} [params.extraOptions] - Additional MessageBird payload fields.
   * @returns {Promise<{success: true, provider: 'messagebird', data: Object}>}
   * @throws {ValidationError} If required fields are missing or invalid.
   * @throws {IntegrationError} If MessageBird API rejects or fails the request.
   */
  async sendWhatsApp({
    to,
    templateName,
    templateId,
    namespace = null,
    language = "en",
    variables = null,
    components = null,
    channelId = null,
    ...extraOptions
  } = {}) {
    const normalizedRecipients = validateMobileRecipients(
      to,
      "to",
      "messagebird",
    );

    const activeTemplateName = templateName || templateId;
    validateRequiredString(activeTemplateName, "templateName", "messagebird");

    const activeChannelId = channelId || this.#channelId;
    if (!activeChannelId) {
      throw new ValidationError(
        "Field 'channelId' is required for MessageBird WhatsApp messaging",
        {
          provider: "messagebird",
          details: { field: "channelId" },
        },
      );
    }

    const activeNamespace = namespace || this.#namespace;

    if (variables !== null && variables !== undefined) {
      if (typeof variables !== "object") {
        throw new ValidationError(
          "Field 'variables' must be an array or an object",
          {
            provider: "messagebird",
            details: { field: "variables" },
          },
        );
      }
    }

    if (
      components !== null &&
      components !== undefined &&
      !Array.isArray(components)
    ) {
      throw new ValidationError("Field 'components' must be an array", {
        provider: "messagebird",
        details: { field: "components" },
      });
    }

    // Format components from variables if not explicitly provided
    let formattedComponents = components;
    if (!formattedComponents && variables) {
      const paramsList = Array.isArray(variables)
        ? variables.map((val) => ({ type: "text", text: String(val ?? "") }))
        : Object.values(variables).map((val) => ({
            type: "text",
            text: String(val ?? ""),
          }));

      if (paramsList.length > 0) {
        formattedComponents = [
          {
            type: "body",
            parameters: paramsList,
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: paramsList,
          },
        ];
      }
    }

    const languageObj =
      typeof language === "string" ? { code: language.trim() } : language;

    const recipientsArray = Array.isArray(normalizedRecipients)
      ? normalizedRecipients
      : [normalizedRecipients];

    const url = `${this.#baseUrl}/v1/send`;

    // If multiple recipients are passed, execute calls and return aggregated results
    const sendSingle = async (recipientMobile) => {
      const hsmPayload = {
        templateName: activeTemplateName,
        language: languageObj,
        ...(activeNamespace ? { namespace: activeNamespace } : {}),
        ...(formattedComponents ? { components: formattedComponents } : {}),
      };

      const payload = {
        to: recipientMobile.startsWith("+")
          ? recipientMobile
          : `+${recipientMobile}`,
        from: activeChannelId,
        type: "hsm",
        content: {
          hsm: hsmPayload,
        },
        ...extraOptions,
      };

      const response = await this.#fetch(url, {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await this.#parseJsonResponse(response);

      if (!response.ok || json?.errors?.length > 0) {
        const firstError = json?.errors?.[0];
        const errorMsg =
          firstError?.description ||
          firstError?.message ||
          `MessageBird WhatsApp request failed (HTTP ${response.status})`;
        throw new IntegrationError(errorMsg, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status || 502,
          provider: "messagebird",
          details: firstError || null,
        });
      }

      return json;
    };

    try {
      if (recipientsArray.length === 1) {
        const json = await sendSingle(recipientsArray[0]);
        return this.normalizeSuccess({
          id: json?.id || null,
          status: json?.status || "sent",
          recipients: normalizedRecipients,
          raw: json,
        });
      }

      const results = await Promise.all(
        recipientsArray.map((num) => sendSingle(num)),
      );
      return this.normalizeSuccess({
        id: results.map((r) => r?.id).filter(Boolean),
        status: "sent",
        recipients: normalizedRecipients,
        raw: results,
      });
    } catch (error) {
      throw this.#handleProviderError(error, "Failed to send WhatsApp message");
    }
  }

  /**
   * Sends transactional SMS messages via MessageBird REST API.
   *
   * @param {Object} params
   * @param {string|string[]} params.to - Single mobile number or array of mobile numbers.
   * @param {string} params.message - SMS message body text.
   * @param {string} [params.originator='SMS'] - Alphanumeric Sender ID or sender phone number.
   * @param {Object} [params.extraOptions] - Additional MessageBird SMS options.
   * @returns {Promise<{success: true, provider: 'messagebird', data: Object}>}
   * @throws {ValidationError} If recipient or message validation fails.
   * @throws {IntegrationError} If MessageBird API fails.
   */
  async sendSMS({ to, message, originator = "SMS", ...extraOptions } = {}) {
    const normalizedRecipients = validateMobileRecipients(
      to,
      "to",
      "messagebird",
    );
    validateRequiredString(message, "message", "messagebird");

    const recipientsArray = Array.isArray(normalizedRecipients)
      ? normalizedRecipients
      : [normalizedRecipients];

    const payload = {
      recipients: recipientsArray,
      body: message,
      originator: originator || "SMS",
      ...extraOptions,
    };

    const restBaseUrl = "https://rest.messagebird.com";
    const url = `${restBaseUrl}/messages`;

    try {
      const response = await this.#fetch(url, {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await this.#parseJsonResponse(response);

      if (!response.ok || json?.errors?.length > 0) {
        const firstError = json?.errors?.[0];
        const errorMsg =
          firstError?.description ||
          firstError?.message ||
          `MessageBird SMS request failed (HTTP ${response.status})`;
        throw new IntegrationError(errorMsg, {
          code: this.#mapStatusCodeToErrorCode(response.status),
          statusCode: response.status || 502,
          provider: "messagebird",
          details: firstError || null,
        });
      }

      return this.normalizeSuccess({
        id: json?.id || null,
        status: json?.recipients?.items?.[0]?.status || "sent",
        recipients: normalizedRecipients,
        raw: json,
      });
    } catch (error) {
      throw this.#handleProviderError(error, "Failed to send SMS");
    }
  }

  /**
   * OTP operations are unsupported in this phase for MessageBird.
   */
  async sendOTP() {
    throw new IntegrationError(
      "OTP operations are not currently supported by the MessageBird provider.",
      {
        code: "UNSUPPORTED_OPERATION",
        statusCode: 501,
        provider: "messagebird",
      },
    );
  }

  /**
   * OTP verification is unsupported in this phase for MessageBird.
   */
  async verifyOTP() {
    throw new IntegrationError(
      "OTP operations are not currently supported by the MessageBird provider.",
      {
        code: "UNSUPPORTED_OPERATION",
        statusCode: 501,
        provider: "messagebird",
      },
    );
  }

  /**
   * OTP resend is unsupported in this phase for MessageBird.
   */
  async resendOTP() {
    throw new IntegrationError(
      "OTP operations are not currently supported by the MessageBird provider.",
      {
        code: "UNSUPPORTED_OPERATION",
        statusCode: 501,
        provider: "messagebird",
      },
    );
  }

  /**
   * Safely parses JSON responses from fetch, handling non-JSON/HTML error pages.
   *
   * @param {Response} response
   * @returns {Promise<Object|null>}
   * @private
   */
  async #parseJsonResponse(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Maps HTTP status codes to standardized error codes.
   *
   * @param {number} status
   * @returns {string}
   * @private
   */
  #mapStatusCodeToErrorCode(status) {
    if (status === 401 || status === 403) return "AUTHENTICATION_ERROR";
    if (status === 429) return "RATE_LIMIT_EXCEEDED";
    return "PROVIDER_ERROR";
  }

  /**
   * Safely normalizes errors without leaking API keys or sensitive authorization headers.
   *
   * @param {*} error
   * @param {string} fallbackMessage
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError || error instanceof ValidationError) {
      return error;
    }

    let message = error?.message || fallbackMessage;
    if (this.#apiKey) {
      message = message.replaceAll(this.#apiKey, "[REDACTED]");
    }

    return new IntegrationError(message, {
      code: "PROVIDER_ERROR",
      statusCode: 502,
      provider: "messagebird",
      details: error?.name ? { name: error.name } : null,
    });
  }
}
