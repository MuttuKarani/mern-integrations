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
- [6. Amount Convention](#6-amount-convention)
- [7. Razorpay Integration](#7-razorpay-integration)
  - [createOrder](#createorder)
  - [verifyPayment](#verifypayment)
  - [refund](#refund-razorpay)
  - [verifyWebhook](#verifywebhook-razorpay)
- [8. CCAvenue Integration](#8-ccavenue-integration)
  - [Lifecycle Differences](#ccavenue-lifecycle-overview)
  - [initiatePayment](#initiatepayment)
  - [verifyCallback](#verifycallback)
  - [Refund Limitation](#refunds-in-ccavenue)
- [9. Error Handling & Response Normalization](#9-error-handling--response-normalization)
- [10. Example Usage in Express](#10-example-usage-in-express)
- [11. Testing Instructions](#11-testing-instructions)

---

## 1. Project Purpose

In standard MERN applications, integrating third-party services directly into controller logic often leads to tight coupling, vendor lock-in, fragmented error handling, and security oversights.

`mern-integrations` solves this by introducing:
- **Provider Abstraction**: A unified `PaymentProvider` interface decoupling your business logic from gateway SDKs.
- **Strict Input Validation**: Guaranteed validation of amounts, currencies, IDs, and payload types before gateway calls.
- **Secure Cryptography**: Native `crypto.timingSafeEqual()` for Razorpay HMAC signatures, and verified `AES-128-CBC` (MD5 key derivation) for CCAvenue.
- **Normalized Response Format**: Consistent success and error response shapes across all providers.
- **Private & Extensible Foundation**: Built with ES Modules, supporting both API-based (Razorpay) and redirect-based (CCAvenue) payment lifecycles.

---

## 2. Folder Structure

```
mern-integrations/
│
├── src/
│   │
│   ├── core/
│   │   ├── errors/
│   │   │   ├── IntegrationError.js       # Base error with code, statusCode, details
│   │   │   ├── ValidationError.js        # Input & parameter validation error
│   │   │   └── index.js                  # Core error exports
│   │   │
│   │   └── utils/
│   │       └── validators.js             # Input validation helpers
│   │
│   ├── payments/
│   │   │
│   │   ├── interfaces/
│   │   │   └── PaymentProvider.js        # Abstract base class
│   │   │
│   │   ├── providers/
│   │   │   ├── razorpay/
│   │   │   │   └── RazorpayProvider.js   # Razorpay SDK implementation
│   │   │   └── ccavenue/
│   │   │       ├── CCAvenueProvider.js   # CCAvenue redirect & callback implementation
│   │   │       └── ccavenue.crypto.js    # Official AES-128-CBC crypto helpers
│   │   │
│   │   ├── factories/
│   │   │   └── PaymentFactory.js         # Provider factory
│   │   │
│   │   └── index.js                      # Payments module exports
│   │
│   └── index.js                          # Root package entry point
│
├── examples/
│   ├── razorpay-example.js               # Razorpay usage example
│   └── ccavenue-example.js               # CCAvenue usage example
│
├── tests/
│   └── payments/
│       ├── razorpay.test.js              # Razorpay unit tests with SDK mocks
│       └── ccavenue.test.js              # CCAvenue unit tests with crypto vectors
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

```env
# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# CCAvenue Credentials
CCAVENUE_MERCHANT_ID=YourMerchantIdHere
CCAVENUE_ACCESS_CODE=YourAccessCodeHere
CCAVENUE_WORKING_KEY=YourWorkingKeyHere
CCAVENUE_BASE_URL=https://test.ccavenue.com
```

---

## 5. Architecture & Provider Factory

Initialize payment providers dynamically using `createPaymentProvider`:

```javascript
import { createPaymentProvider } from 'mern-integrations';

// Initialize Razorpay
const razorpay = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});

// Initialize CCAvenue
const ccavenue = createPaymentProvider({
  provider: 'ccavenue',
  merchantId: process.env.CCAVENUE_MERCHANT_ID,
  accessCode: process.env.CCAVENUE_ACCESS_CODE,
  workingKey: process.env.CCAVENUE_WORKING_KEY,
  testMode: true // Set to false in production
});
```

---

## 6. Amount Convention

Across the entire `mern-integrations` library:
- **All amounts must strictly be passed as positive integers representing the smallest currency sub-unit.**
- **For INR**, amounts must be in **paise** (1 Rupee = 100 paise).
  - ₹10.00 &rarr; `1000`
  - ₹150.00 &rarr; `15000`
  - ₹499.00 &rarr; `49900`
- Floating point amounts (e.g. `10.50`) will throw a `ValidationError`.

---

## 7. Razorpay Integration

### `createOrder`
Creates an order via Razorpay REST API for client-side modal checkout.

```javascript
const order = await razorpay.createOrder({
  amount: 1000, // 1000 paise = ₹10
  currency: 'INR',
  receipt: 'order_rcpt_123',
  notes: { userId: 'user_101' }
});
```

### `verifyPayment`
Cryptographically verifies checkout payment signature using HMAC SHA-256 with `crypto.timingSafeEqual()`.

```javascript
const verification = await razorpay.verifyPayment({
  razorpayOrderId: 'order_EKwxwAgItmmXdp',
  razorpayPaymentId: 'pay_DAvJ6qW4m8kX9Y',
  razorpaySignature: '38a7c6e75...'
});
```

### `refund` (Razorpay)
Issues full or partial refunds via Razorpay API.

```javascript
const refundResult = await razorpay.refund({
  paymentId: 'pay_DAvJ6qW4m8kX9Y',
  amount: 500 // 500 paise = ₹5.00 partial refund (omit for full refund)
});
```

### `verifyWebhook` (Razorpay)
Cryptographically verifies incoming server-to-server webhook signatures on the **exact raw request body**.

```javascript
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await razorpay.verifyWebhook({
    payload: req.body, // Pass raw Buffer or string
    signature: req.headers['x-razorpay-signature']
  });
  if (!result.data.verified) return res.status(400).send('Invalid signature');
  res.json({ status: 'ok' });
});
```

---

## 8. CCAvenue Integration

### CCAvenue Lifecycle Overview
Unlike Razorpay (which creates orders via REST API for client-side popups), CCAvenue uses a **hosted checkout flow**:
1. The backend builds a parameter query string and encrypts it with AES-128-CBC using the merchant Working Key.
2. The backend returns a redirect descriptor (`action: 'redirect'`, `method: 'POST'`, `fields: { encRequest, access_code }`).
3. The frontend renders a form POSTing `encRequest` and `access_code` to CCAvenue's gateway.
4. After payment, CCAvenue POSTs an encrypted response (`encResp`) to the merchant's `redirect_url` (success) or `cancel_url` (failure).
5. The backend decrypts `encResp` using `verifyCallback({ encResp })`.

### `initiatePayment`
Generates the encrypted POST descriptor for CCAvenue hosted checkout.

```javascript
const initiation = await ccavenue.initiatePayment({
  orderId: 'ORD_1001',
  amount: 15000, // 15000 paise = ₹150.00
  currency: 'INR',
  redirectUrl: 'https://myshop.com/api/payments/ccavenue/callback',
  cancelUrl: 'https://myshop.com/api/payments/ccavenue/cancel',
  billing: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    tel: '9876543210',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    zip: '560001'
  }
});
```

#### Normalized Response:
```json
{
  "success": true,
  "provider": "ccavenue",
  "data": {
    "orderId": "ORD_1001",
    "action": "redirect",
    "redirectUrl": "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    "method": "POST",
    "fields": {
      "encRequest": "56c1b0b0678f...",
      "access_code": "AVTESTACCESS1234"
    }
  }
}
```

### `verifyCallback`
Decrypts and parses the encrypted callback response (`encResp`) received at `redirect_url` or `cancel_url`.

```javascript
app.post('/api/payments/ccavenue/callback', express.urlencoded({ extended: true }), async (req, res) => {
  const result = await ccavenue.verifyCallback({
    encResp: req.body.encResp
  });

  if (result.data.verified) {
    // Payment Successful
    console.log('Order fulfilled:', result.data.orderId, 'Tracking ID:', result.data.trackingId);
    return res.redirect(`/payment-success?orderId=${result.data.orderId}`);
  } else {
    // Payment Failed or Aborted
    console.error('Payment failed:', result.data.failureMessage);
    return res.redirect(`/payment-failed?reason=${result.data.orderStatus}`);
  }
});
```

#### Normalized Callback Response:
```json
{
  "success": true,
  "provider": "ccavenue",
  "data": {
    "verified": true,
    "orderId": "ORD_1001",
    "trackingId": "31000998877",
    "bankRefNo": "HDFC987654",
    "orderStatus": "Success",
    "failureMessage": null,
    "paymentMode": "Credit Card",
    "cardName": "Visa",
    "currency": "INR",
    "amount": 15000,
    "statusCode": null,
    "statusMessage": null,
    "raw": { /* Decrypted CCAvenue query parameters */ }
  }
}
```

### Refunds in CCAvenue
> **Integration Limitation:** Programmatic refunds in CCAvenue require the separate `DoWebTrans` enterprise API servlet with static server IP whitelisting. Calling `ccavenue.refund()` will throw an `IntegrationError` (`UNSUPPORTED_OPERATION`, status 501). Refunds must be processed through the CCAvenue Merchant Dashboard.

---

## 9. Error Handling & Response Normalization

All library errors are instances of `IntegrationError` or `ValidationError`:

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  await payment.initiatePayment({ orderId: 'ORD_1', amount: -50, currency: 'INR' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.toJSON());
  } else if (error instanceof IntegrationError) {
    console.error('Integration error:', error.toJSON());
  }
}
```

---

## 10. Example Usage in Express

Run the standalone example scripts:

```bash
# Run Razorpay example
npm run example:razorpay

# Run CCAvenue example
npm run example:ccavenue
```

---

## 11. Testing Instructions

The test suite uses **Jest** with ES Module support. All gateway API calls and cryptographic flows are tested using mocks and verified reference vectors.

```bash
# Run all tests (Razorpay + CCAvenue)
npm test

# Run tests in watch mode
npm run test:watch
```
