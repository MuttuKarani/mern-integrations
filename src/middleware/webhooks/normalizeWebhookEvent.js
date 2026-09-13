/**
 * @typedef {'payment.success'|'payment.failed'|'payment.pending'|'refund.success'|'refund.failed'|'dispute.created'|'message.sent'|'message.delivered'|'message.failed'|'message.queued'|'email.sent'|'email.delivered'|'email.bounced'|'email.opened'|'email.clicked'|'unknown'} UnifiedEventType
 */

/**
 * @typedef {Object} UnifiedWebhookEvent
 * @property {string} id - Unique event or entity identifier.
 * @property {string} provider - Normalized provider name ('stripe', 'razorpay', etc.).
 * @property {UnifiedEventType|string} eventType - Canonical category for the event.
 * @property {string} originalEvent - Raw upstream event name.
 * @property {Date} timestamp - Normalized JavaScript Date when event occurred.
 * @property {boolean} livemode - Whether the event was generated in production mode.
 * @property {Object} resource - Extracted entity data (amount, currency, customer, status, etc.).
 * @property {string} resource.id - Entity ID.
 * @property {string} [resource.orderId] - Associated order or transaction ID.
 * @property {number} [resource.amount] - Payment amount in smallest currency units (paise, cents).
 * @property {string} [resource.currency] - ISO 3-letter currency code.
 * @property {string} [resource.status] - Provider status.
 * @property {{ id?: string, email?: string, phone?: string, name?: string }} [resource.customer] - Customer details.
 * @property {Record<string, any>} [resource.metadata] - Custom metadata key-values.
 * @property {any} raw - Unmodified upstream webhook payload.
 */

/**
 * Normalizes incoming webhook payloads from different third-party providers
 * into a single unified event schema.
 *
 * @param {string} provider - Gateway or provider identifier (e.g. 'stripe', 'razorpay', 'phonepe', 'twilio', 'msg91', 'resend').
 * @param {any} rawPayload - Raw or parsed JSON webhook payload.
 * @returns {UnifiedWebhookEvent}
 */
export function normalizeWebhookEvent(provider, rawPayload) {
  const normProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : 'unknown';
  const payload = rawPayload || {};

  switch (normProvider) {
    case 'stripe':
      return normalizeStripeEvent(payload);

    case 'razorpay':
      return normalizeRazorpayEvent(payload);

    case 'phonepe':
      return normalizePhonePeEvent(payload);

    case 'twilio':
      return normalizeTwilioEvent(payload);

    case 'msg91':
      return normalizeMSG91Event(payload);

    case 'resend':
      return normalizeResendEvent(payload);

    default:
      return normalizeFallbackEvent(normProvider, payload);
  }
}

/**
 * Normalizes Stripe webhook events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeStripeEvent(raw) {
  const originalEvent = String(raw.type || 'unknown');
  let eventType = 'unknown';

  switch (originalEvent) {
    case 'payment_intent.succeeded':
    case 'checkout.session.completed':
    case 'charge.succeeded':
      eventType = 'payment.success';
      break;
    case 'payment_intent.payment_failed':
    case 'charge.failed':
      eventType = 'payment.failed';
      break;
    case 'payment_intent.processing':
      eventType = 'payment.pending';
      break;
    case 'charge.refunded':
      eventType = 'refund.success';
      break;
    case 'charge.dispute.created':
      eventType = 'dispute.created';
      break;
    default:
      eventType = originalEvent;
  }

  const obj = raw.data?.object || {};
  const customerEmail = obj.receipt_email || obj.billing_details?.email || obj.customer_details?.email || null;
  const customerPhone = obj.billing_details?.phone || null;
  const customerName = obj.billing_details?.name || obj.customer_details?.name || null;

  return {
    id: String(raw.id || obj.id || `stripe_${Date.now()}`),
    provider: 'stripe',
    eventType,
    originalEvent,
    timestamp: raw.created ? new Date(raw.created * 1000) : new Date(),
    livemode: Boolean(raw.livemode),
    resource: {
      id: String(obj.id || raw.id || ''),
      orderId: obj.metadata?.orderId || obj.invoice || null,
      amount: typeof obj.amount === 'number' ? obj.amount : null,
      currency: obj.currency ? String(obj.currency).toUpperCase() : null,
      status: obj.status || null,
      customer: {
        id: obj.customer ? String(obj.customer) : null,
        email: customerEmail,
        phone: customerPhone,
        name: customerName
      },
      metadata: obj.metadata || {}
    },
    raw
  };
}

/**
 * Normalizes Razorpay webhook events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeRazorpayEvent(raw) {
  const originalEvent = String(raw.event || 'unknown');
  let eventType = 'unknown';

  switch (originalEvent) {
    case 'payment.captured':
    case 'order.paid':
      eventType = 'payment.success';
      break;
    case 'payment.failed':
      eventType = 'payment.failed';
      break;
    case 'refund.processed':
      eventType = 'refund.success';
      break;
    case 'refund.failed':
      eventType = 'refund.failed';
      break;
    default:
      eventType = originalEvent;
  }

  const entity =
    raw.payload?.payment?.entity ||
    raw.payload?.order?.entity ||
    raw.payload?.refund?.entity ||
    {};

  return {
    id: String(entity.id || raw.account_id || `rzp_${Date.now()}`),
    provider: 'razorpay',
    eventType,
    originalEvent,
    timestamp: raw.created_at ? new Date(raw.created_at * 1000) : new Date(),
    livemode: typeof entity.id === 'string' ? !entity.id.includes('test') : true,
    resource: {
      id: String(entity.id || ''),
      orderId: entity.order_id || null,
      amount: typeof entity.amount === 'number' ? entity.amount : null,
      currency: entity.currency ? String(entity.currency).toUpperCase() : null,
      status: entity.status || null,
      customer: {
        id: entity.customer_id || null,
        email: entity.email || null,
        phone: entity.contact || null
      },
      metadata: entity.notes || {}
    },
    raw
  };
}

/**
 * Normalizes PhonePe webhook events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizePhonePeEvent(raw) {
  const code = raw.code || raw.event || '';
  const data = raw.data || {};
  const state = data.state || '';

  let eventType = 'unknown';
  if (code === 'PAYMENT_SUCCESS' || state === 'COMPLETED') {
    eventType = 'payment.success';
  } else if (code === 'PAYMENT_ERROR' || state === 'FAILED') {
    eventType = 'payment.failed';
  } else if (code === 'PAYMENT_PENDING' || state === 'PENDING') {
    eventType = 'payment.pending';
  } else {
    eventType = code || state || 'unknown';
  }

  return {
    id: String(data.transactionId || data.merchantTransactionId || `phonepe_${Date.now()}`),
    provider: 'phonepe',
    eventType,
    originalEvent: code || state || 'PAYMENT_NOTIFICATION',
    timestamp: new Date(),
    livemode: true,
    resource: {
      id: String(data.transactionId || ''),
      orderId: data.merchantTransactionId || null,
      amount: typeof data.amount === 'number' ? data.amount : null,
      currency: data.currency ? String(data.currency).toUpperCase() : 'INR',
      status: state || code || null,
      customer: {
        id: data.merchantUserId || null,
        phone: data.mobileNumber || null
      },
      metadata: {
        paymentInstrument: data.paymentInstrument || null,
        responseCode: data.responseCode || raw.code || null
      }
    },
    raw
  };
}

/**
 * Normalizes Twilio webhook / status callback events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeTwilioEvent(raw) {
  const originalStatus = String(raw.MessageStatus || raw.SmsStatus || raw.Status || 'unknown').toLowerCase();
  let eventType = 'unknown';

  switch (originalStatus) {
    case 'delivered':
      eventType = 'message.delivered';
      break;
    case 'failed':
    case 'undelivered':
      eventType = 'message.failed';
      break;
    case 'sent':
      eventType = 'message.sent';
      break;
    case 'queued':
      eventType = 'message.queued';
      break;
    default:
      eventType = originalStatus;
  }

  const sid = raw.MessageSid || raw.SmsSid || raw.CallSid || '';

  return {
    id: String(sid || `twilio_${Date.now()}`),
    provider: 'twilio',
    eventType,
    originalEvent: originalStatus,
    timestamp: new Date(),
    livemode: !String(sid).startsWith('SM_test'),
    resource: {
      id: String(sid),
      orderId: null,
      status: originalStatus,
      customer: {
        phone: raw.To || null
      },
      metadata: {
        from: raw.From || null,
        to: raw.To || null,
        errorCode: raw.ErrorCode || null,
        errorMessage: raw.ErrorMessage || null
      }
    },
    raw
  };
}

/**
 * Normalizes MSG91 webhook events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeMSG91Event(raw) {
  const status = String(raw.status || raw.desc || 'unknown').toLowerCase();
  let eventType = 'unknown';

  if (status.includes('deliver') || status === 'success') {
    eventType = 'message.delivered';
  } else if (status.includes('fail') || status.includes('reject')) {
    eventType = 'message.failed';
  } else if (status.includes('sent')) {
    eventType = 'message.sent';
  } else {
    eventType = status;
  }

  const id = raw.requestId || raw.id || '';

  return {
    id: String(id || `msg91_${Date.now()}`),
    provider: 'msg91',
    eventType,
    originalEvent: status,
    timestamp: new Date(),
    livemode: true,
    resource: {
      id: String(id),
      status,
      customer: {
        phone: raw.mobile || raw.number || null
      },
      metadata: {
        senderId: raw.sender || null,
        desc: raw.desc || null
      }
    },
    raw
  };
}

/**
 * Normalizes Resend webhook events.
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeResendEvent(raw) {
  const originalEvent = String(raw.type || 'unknown');
  let eventType = 'unknown';

  switch (originalEvent) {
    case 'email.sent':
      eventType = 'email.sent';
      break;
    case 'email.delivered':
      eventType = 'email.delivered';
      break;
    case 'email.bounced':
      eventType = 'email.bounced';
      break;
    case 'email.opened':
      eventType = 'email.opened';
      break;
    case 'email.clicked':
      eventType = 'email.clicked';
      break;
    default:
      eventType = originalEvent;
  }

  const data = raw.data || {};
  const recipient = Array.isArray(data.to) ? data.to.join(', ') : data.to || null;

  return {
    id: String(data.email_id || raw.id || `resend_${Date.now()}`),
    provider: 'resend',
    eventType,
    originalEvent,
    timestamp: raw.created_at ? new Date(raw.created_at) : new Date(),
    livemode: true,
    resource: {
      id: String(data.email_id || ''),
      status: originalEvent,
      customer: {
        email: recipient
      },
      metadata: {
        from: data.from || null,
        subject: data.subject || null,
        broadcastId: data.broadcast_id || null
      }
    },
    raw
  };
}

/**
 * Fallback normalizer for unknown or custom provider events.
 * @param {string} provider
 * @param {Object} raw
 * @returns {UnifiedWebhookEvent}
 */
function normalizeFallbackEvent(provider, raw) {
  const eventType = raw.eventType || raw.event || raw.type || raw.status || 'unknown';
  const id = raw.id || raw.transactionId || raw.sid || `event_${Date.now()}`;

  return {
    id: String(id),
    provider,
    eventType: String(eventType),
    originalEvent: String(eventType),
    timestamp: raw.created_at || raw.timestamp ? new Date(raw.created_at || raw.timestamp) : new Date(),
    livemode: true,
    resource: {
      id: String(id),
      status: String(raw.status || eventType),
      metadata: typeof raw === 'object' && raw !== null ? { ...raw } : {}
    },
    raw
  };
}
