# mern-integrations

A modular, reusable backend integration library for MERN stack applications. This library provides a clean provider abstraction layer for payment gateways, email notifications, and other third-party services.

> **Note:** This repository is private and intended solely for internal use in MERN backend services. It must not be published to npm.

---

## Table of Contents

- [1. Project Purpose](#1-project-purpose)
- [2. Folder Structure](#2-folder-structure)
- [3. Installation & Setup](#3-installation--setup)
- [4. Environment Configuration](#4-environment-configuration)
- [5. Provider Factories](#5-provider-factories)
  - [Payment Factory](#payment-factory)
  - [Email Factory](#email-factory)
- [6. Payment Providers](#6-payment-providers)
  - [Amount Convention](#amount-convention)
  - [Razorpay Integration](#razorpay-integration)
  - [CCAvenue Integration](#ccavenue-integration)
- [7. Email Providers](#7-email-providers)
  - [Resend Integration](#resend-integration)
  - [Configuration](#resend-configuration)
  - [Basic Usage](#resend-basic-usage)
  - [Recipient Formats & Validation](#resend-recipient-formats--validation)
  - [Normalized Success Response](#resend-normalized-success-response)
  - [Sender Domain Verification Requirements](#resend-sender-domain-verification-requirements)
- [8. Error Handling & Response Normalization](#8-error-handling--response-normalization)
- [9. Example Scripts](#9-example-scripts)
- [10. Testing Instructions](#10-testing-instructions)

---

## 1. Project Purpose

In standard MERN applications, integrating third-party services directly into controller logic often leads to tight coupling, vendor lock-in, fragmented error handling, and security oversights.

`mern-integrations` solves this by introducing:
- **Provider Abstractions**: Unified `PaymentProvider` and `EmailProvider` interfaces decoupling business logic from third-party gateway SDKs.
- **Strict Input Validation**: Guaranteed validation of amounts, currencies, emails, and payload types before API calls.
- **Secure Cryptography**: Native `crypto.timingSafeEqual()` for Razorpay HMAC signatures, and verified `AES-128-CBC` (MD5 key derivation) for CCAvenue.
- **Normalized Response Format**: Consistent success and error response shapes across all providers.
- **Private & Extensible Foundation**: Built with ES Modules, supporting future providers (SendGrid, AWS SES, Mailgun, Postmark).

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
│   │       └── validators.js             # Reusable input & email validators
│   │
│   ├── payments/
│   │   ├── interfaces/
│   │   │   └── PaymentProvider.js        # Abstract base payment class
│   │   ├── providers/
│   │   │   ├── razorpay/
│   │   │   │   └── RazorpayProvider.js   # Razorpay SDK implementation
│   │   │   └── ccavenue/
│   │   │       ├── CCAvenueProvider.js   # CCAvenue redirect & callback implementation
│   │   │       └── ccavenue.crypto.js    # Official AES-128-CBC crypto helpers
│   │   ├── factories/
│   │   │   └── PaymentFactory.js         # Payment provider factory
│   │   └── index.js                      # Payments module exports
│   │
│   ├── email/
│   │   ├── interfaces/
│   │   │   └── EmailProvider.js          # Abstract base email class
│   │   ├── providers/
│   │   │   └── resend/
│   │   │       └── ResendProvider.js     # Resend SDK implementation
│   │   ├── factories/
│   │   │   └── EmailFactory.js           # Email provider factory
│   │   └── index.js                      # Email module exports
│   │
│   └── index.js                          # Root package entry point
│
├── examples/
│   ├── razorpay-example.js               # Razorpay usage example
│   ├── ccavenue-example.js               # CCAvenue usage example
│   └── resend-example.js                 # Resend usage example
│
├── tests/
│   ├── payments/
│   │   ├── razorpay.test.js              # Razorpay unit tests with SDK mocks
│   │   └── ccavenue.test.js              # CCAvenue unit tests with crypto vectors
│   └── email/
│       └── resend.test.js                # Resend unit tests with SDK mocks
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

# Resend Credentials
RESEND_API_KEY=re_YourResendApiKeyHere
```

> **Security Note:** Never commit API keys or secrets to source control. `.env` is ignored by `.gitignore`.

---

## 5. Provider Factories

### Payment Factory

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
  testMode: true // false for production
});
```

### Email Factory

```javascript
import { createEmailProvider } from 'mern-integrations';

// Initialize Resend
const email = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});
```

---

## 6. Payment Providers

### Amount Convention
- **All payment amounts must strictly be passed as positive integers representing the smallest currency sub-unit.**
- **For INR**, amounts must be in **paise** (1 Rupee = 100 paise).
  - ₹10.00 &rarr; `1000`
  - ₹150.00 &rarr; `15000`
  - ₹499.00 &rarr; `49900`
- Floating point amounts (e.g. `10.50`) throw a `ValidationError`.

### Razorpay Integration
- `createOrder({ amount, currency, receipt, notes })`: Creates an order via Razorpay REST API.
- `verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature })`: Cryptographically verifies checkout signature using HMAC SHA-256 with `crypto.timingSafeEqual()`.
- `refund({ paymentId, amount, notes })`: Issues full or partial refunds.
- `verifyWebhook({ payload, signature })`: Cryptographically verifies webhook signatures on raw request bodies.

### CCAvenue Integration
- `initiatePayment({ orderId, amount, currency, redirectUrl, cancelUrl, billing, shipping })`: Generates the encrypted AES-128-CBC redirect descriptor (`encRequest` + `access_code`) for hosted form checkout.
- `verifyCallback({ encResp })`: Decrypts and parses the encrypted callback response received at `redirect_url` or `cancel_url`.
- `refund()`: Programmatic refunds require enterprise `DoWebTrans` servlet + IP whitelisting; throws `UNSUPPORTED_OPERATION` (501).

---

## 7. Email Providers

### Resend Integration

`ResendProvider` wraps the official Resend SDK (`resend`) with input validation, parameter normalization, and structured error handling.

### Resend Configuration

```javascript
import { createEmailProvider } from 'mern-integrations';

const email = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});
```

### Resend Basic Usage

```javascript
const response = await email.send({
  from: 'My App <noreply@yourdomain.com>',
  to: 'customer@example.com',
  subject: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
  text: 'Welcome! Thank you for signing up.', // Optional if html is provided
  replyTo: 'support@yourdomain.com',
  cc: 'team@yourdomain.com',
  bcc: ['archive@yourdomain.com'],
  tags: [{ name: 'category', value: 'onboarding' }]
});
```

### Resend Recipient Formats & Validation
- **`from`**: Required non-empty string.
- **`to`**: Single string (`"user@example.com"`) or array (`["user1@example.com", "user2@example.com"]`). Empty arrays are rejected.
- **`subject`**: Required non-empty string.
- **`html` and `text`**: At least one must be provided as a non-empty string.
- **`replyTo`, `cc`, `bcc`**: Optional. Accepts single email string or array of emails.
- **`tags`**: Optional array of `{ name: string, value: string }` objects.

### Resend Normalized Success Response

```json
{
  "success": true,
  "provider": "resend",
  "data": {
    "id": "email_msg_01H1ABCD1234567890"
  }
}
```

### Resend Sender Domain Verification Requirements
> **IMPORTANT:** In production, sending emails requires that your sender domain (e.g., `yourdomain.com`) is added and verified (DKIM / SPF) in your [Resend Dashboard](https://resend.com/domains). Sending from unverified domains will result in a provider validation error (`statusCode: 422`).

---

## 8. Error Handling & Response Normalization

All public methods throw structured errors inheriting from `IntegrationError` or `ValidationError`. Errors can be formatted into standard JSON via `.toJSON()`:

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  await email.send({
    from: 'sender@app.com',
    to: 'invalid-email',
    subject: 'Hello'
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.toJSON());
    // {
    //   success: false,
    //   provider: 'resend',
    //   error: {
    //     code: 'VALIDATION_ERROR',
    //     message: "Field 'to' must be a valid email address",
    //     details: { field: 'to', received: 'invalid-email' }
    //   }
    // }
  } else if (error instanceof IntegrationError) {
    console.error('Provider error:', error.toJSON());
  }
}
```

---

## 9. Example Scripts

Run the standalone example scripts:

```bash
# Run Razorpay payment example
npm run example:razorpay

# Run CCAvenue payment example
npm run example:ccavenue

# Run Resend email example
npm run example:resend
```

---

## 10. Testing Instructions

The test suite uses **Jest** with ES Module support. All gateway API calls and cryptographic flows are tested using mocks and verified reference vectors.

```bash
# Run all tests (Razorpay + CCAvenue + Resend)
npm test

# Run tests in watch mode
npm run test:watch
```
