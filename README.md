# mern-integrations

A modular, reusable backend integration library for MERN stack applications. This library provides a clean provider abstraction layer for payment gateways, notifications, and other third-party services.

> **Note:** This repository is private and intended solely for internal use in MERN backend services.

---

## Table of Contents

- [1. Project Purpose](#1-project-purpose)
- [2. Folder Structure](#2-folder-structure)
- [3. Installation & Setup](#3-installation--setup)
- [4. Environment Configuration](#4-environment-configuration)
- [5. Architecture & Provider Factory](#5-architecture--provider-factory)
- [6. Razorpay Integration](#6-razorpay-integration)
  - [Amount Convention](#important-amount-convention)
  - [createOrder](#createorder)
  - [verifyPayment](#verifypayment)
  - [refund](#refund)
  - [verifyWebhook](#verifywebhook)
- [7. Error Handling & Response Normalization](#7-error-handling--response-normalization)
- [8. Example Usage in Express](#8-example-usage-in-express)
- [9. Testing Instructions](#9-testing-instructions)

---

## 1. Project Purpose

In standard MERN applications, integrating third-party services directly into controller logic often leads to tight coupling, vendor lock-in, fragmented error handling, and security oversights (such as timing attacks or improper webhook verification).

`mern-integrations` solves this by introducing:
- **Provider Abstraction**: A unified `PaymentProvider` interface decoupling your business logic from gateway SDKs.
- **Strict Input Validation**: Guaranteed validation of amounts, currencies, IDs, and payload types before SDK calls.
- **Timing-Safe Cryptographic Verifications**: Native `crypto.timingSafeEqual()` implementation for payment and webhook signatures.
- **Normalized Response Format**: Consistent success and error response shapes across all providers.
- **Private & Extensible Foundation**: Built with ES Modules and prepared for future providers (CCAvenue, MSG91, Resend).

---

## 2. Folder Structure

```
mern-integrations/
│
├── src/
│   │
│   ├── core/
│   │   ├── errors/
│   │   │   ├── IntegrationError.js  # Base error with code, statusCode, details
│   │   │   ├── ValidationError.js   # Input & parameter validation error
│   │   │   └── index.js             # Core error exports
│   │   │
│   │   └── utils/
│   │       └── validators.js        # Input validation helpers
│   │
│   ├── payments/
│   │   │
│   │   ├── interfaces/
│   │   │   └── PaymentProvider.js   # Abstract base class
│   │   │
│   │   ├── providers/
│   │   │   └── razorpay/
│   │   │       └── RazorpayProvider.js # Razorpay SDK implementation
│   │   │
│   │   ├── factories/
│   │   │   └── PaymentFactory.js    # Provider factory
│   │   │
│   │   └── index.js                 # Payments module exports
│   │
│   └── index.js                     # Root package entry point
│
├── examples/
│   └── razorpay-example.js          # Focused usage example
│
├── tests/
│   └── payments/
│       └── razorpay.test.js         # Jest unit tests with SDK mocks
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── jest.config.js
```

---

## 3. Installation & Setup

Install dependencies in the project root:

```bash
npm install
```

---

## 4. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set your Razorpay API credentials in `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere
```

> **Security Note:** Secrets and credentials should never be committed to source control. `.env` is ignored by `.gitignore`.

---

## 5. Architecture & Provider Factory

Initialize the provider via `createPaymentProvider`:

```javascript
import { createPaymentProvider } from 'mern-integrations';

const payment = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});
```

---

## 6. Razorpay Integration

### ⚠️ IMPORTANT: Amount Convention

- **All amounts must strictly be provided in the smallest currency sub-unit as a positive integer.**
- **For INR**, pass amounts in **paise** (1 Rupee = 100 paise).
  - ₹10.00 &rarr; `1000`
  - ₹499.00 &rarr; `49900`
  - ₹1,500.00 &rarr; `150000`
- The library does not perform implicit or lossy currency conversions. Passing floating point amounts (e.g. `10.50`) will throw a `ValidationError`.

---

### `createOrder`

Creates an order with Razorpay.

#### Parameters:
| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | `number` | **Yes** | Amount in smallest currency unit (e.g., paise for INR). Positive integer. |
| `currency` | `string` | **Yes** | 3-letter ISO currency code (e.g. `'INR'`). |
| `receipt` | `string` | No | Unique receipt or internal order ID. |
| `notes` | `object` | No | Custom key-value pairs for metadata. |

#### Usage:
```javascript
const order = await payment.createOrder({
  amount: 1000, // 1000 paise = ₹10
  currency: 'INR',
  receipt: 'receipt_order_123',
  notes: {
    userId: 'user_101',
    plan: 'premium'
  }
});
```

#### Normalized Response:
```javascript
{
  success: true,
  provider: "razorpay",
  data: {
    id: "order_EKwxwAgItmmXdp",
    entity: "order",
    amount: 1000,
    amountPaid: 0,
    amountDue: 1000,
    currency: "INR",
    receipt: "receipt_order_123",
    status: "created",
    attempts: 0,
    notes: { userId: "user_101", plan: "premium" },
    createdAt: 1672531199,
    raw: { /* Original Razorpay order object */ }
  }
}
```

---

### `verifyPayment`

Cryptographically validates the checkout signature returned after a client payment. Uses HMAC SHA256 with `crypto.timingSafeEqual()` to mitigate timing side-channel attacks.

#### Parameters:
| Field | Type | Required | Description |
|---|---|---|---|
| `razorpayOrderId` | `string` | **Yes** | The order ID returned from `createOrder`. |
| `razorpayPaymentId` | `string` | **Yes** | The payment ID returned by the checkout handler. |
| `razorpaySignature` | `string` | **Yes** | The signature hash returned by Razorpay checkout. |

#### Usage:
```javascript
const verification = await payment.verifyPayment({
  razorpayOrderId: 'order_EKwxwAgItmmXdp',
  razorpayPaymentId: 'pay_DAvJ6qW4m8kX9Y',
  razorpaySignature: '38a7c6e75...'
});

if (verification.data.verified) {
  // Signature is authentic - proceed with order fulfillment
} else {
  // Signature verification failed - potential tampering
}
```

#### Normalized Response:
```javascript
{
  success: true,
  provider: "razorpay",
  data: {
    verified: true,
    orderId: "order_EKwxwAgItmmXdp",
    paymentId: "pay_DAvJ6qW4m8kX9Y"
  }
}
```

---

### `refund`

Issues a full or partial refund for a captured payment.

#### Parameters:
| Field | Type | Required | Description |
|---|---|---|---|
| `paymentId` | `string` | **Yes** | The Razorpay payment ID to refund. |
| `amount` | `number` | No | Amount in smallest currency unit to refund. Omit for full refund. |
| `notes` | `object` | No | Custom key-value pairs for metadata. |

#### Usage:
```javascript
const refundResult = await payment.refund({
  paymentId: 'pay_DAvJ6qW4m8kX9Y',
  amount: 500, // Partial refund: 500 paise (₹5)
  notes: {
    reason: 'Customer requested cancellation'
  }
});
```

#### Normalized Response:
```javascript
{
  success: true,
  provider: "razorpay",
  data: {
    id: "rfnd_D8bY93yXmZq12",
    entity: "refund",
    amount: 500,
    currency: "INR",
    paymentId: "pay_DAvJ6qW4m8kX9Y",
    status: "processed",
    receipt: "rfnd_rcpt_1",
    notes: { reason: "Customer requested cancellation" },
    createdAt: 1672532000,
    raw: { /* Original Razorpay refund object */ }
  }
}
```

---

### `verifyWebhook`

Cryptographically validates incoming webhook event signatures.

> **CRITICAL SECURITY REQUIREMENT:** The verification must operate on the **exact raw request body** (as a `string` or `Buffer`). Do NOT JSON-parse and re-stringify the payload before verification, as key order differences will invalidate the HMAC hash.

#### Parameters:
| Field | Type | Required | Description |
|---|---|---|---|
| `payload` | `string` \| `Buffer` | **Yes** | Exact unmodified raw request body. |
| `signature` | `string` | **Yes** | Value of `x-razorpay-signature` request header. |
| `secret` | `string` | No | Optional override secret (defaults to `webhookSecret` passed to constructor). |

#### Usage in Express:
```javascript
// Express webhook route using express.raw()
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  const verification = await payment.verifyWebhook({
    payload: req.body, // Pass the raw Buffer/string
    signature
  });

  if (!verification.data.verified) {
    return res.status(400).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());
  // Process webhook event securely...

  res.json({ status: 'ok' });
});
```

---

## 7. Error Handling & Response Normalization

All errors thrown by the library are structured instances of `IntegrationError` or `ValidationError`.

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  await payment.createOrder({ amount: -50, currency: 'INR' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.toJSON());
    // Response shape:
    // {
    //   success: false,
    //   provider: 'razorpay',
    //   error: {
    //     code: 'VALIDATION_ERROR',
    //     message: "Field 'amount' must be a positive integer...",
    //     details: { field: 'amount', received: -50 }
    //   }
    // }
  } else if (error instanceof IntegrationError) {
    console.error('Integration error:', error.toJSON());
  }
}
```

---

## 8. Example Usage in Express

Run the standalone example script:

```bash
npm run example:razorpay
```

Or execute directly with Node:

```bash
node examples/razorpay-example.js
```

---

## 9. Testing Instructions

The test suite uses **Jest** with ES Module support and mocks all Razorpay SDK calls so that no real network requests are made.

### Run Tests:
```bash
npm test
```

### Run Tests in Watch Mode:
```bash
npm run test:watch
```
