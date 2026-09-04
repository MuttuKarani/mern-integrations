# mern-integrations

A modular, reusable backend integration library for MERN stack applications. This library provides a clean provider abstraction layer for payment gateways, email notifications, SMS & OTP services, and other third-party integrations.

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
  - [SMS Factory](#sms-factory)
- [6. Payment Providers](#6-payment-providers)
  - [Amount Convention](#amount-convention)
  - [Razorpay Integration](#razorpay-integration)
  - [CCAvenue Integration](#ccavenue-integration)
- [7. Email Providers](#7-email-providers)
  - [Resend Integration](#resend-integration)
- [8. SMS & OTP Providers](#8-sms--otp-providers)
  - [MSG91 Integration](#msg91-integration)
  - [Sending OTP (sendOTP)](#sending-otp-sendotp)
  - [Verifying OTP (verifyOTP)](#verifying-otp-verifyotp)
  - [Resending OTP (resendOTP)](#resending-otp-resendotp)
  - [Sending SMS (sendSMS)](#sending-sms-sendsms)
  - [Important Indian DLT & Template Considerations](#important-indian-dlt--template-considerations)
- [9. Error Handling & Response Normalization](#9-error-handling--response-normalization)
- [10. Example Scripts](#10-example-scripts)
- [11. Testing Instructions](#11-testing-instructions)

---

## 1. Project Purpose

In standard MERN applications, integrating third-party services directly into controller logic often leads to tight coupling, vendor lock-in, fragmented error handling, and security oversights.

`mern-integrations` solves this by introducing:
- **Provider Abstractions**: Unified `PaymentProvider`, `EmailProvider`, and `SMSProvider` interfaces decoupling business logic from third-party gateway SDKs.
- **Strict Input Validation**: Guaranteed validation of amounts, currencies, emails, mobile numbers, and payload types before API calls.
- **Secure Cryptography & Transport**: Native `crypto.timingSafeEqual()` for Razorpay HMAC signatures, verified `AES-128-CBC` (MD5 key derivation) for CCAvenue, and official Node `fetch` transport for MSG91.
- **Normalized Response Format**: Consistent success and error response shapes across all providers.
- **Private & Extensible Foundation**: Built with ES Modules, supporting future providers (SendGrid, AWS SES, MessageBird, Postmark).

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
│   │       └── validators.js             # Reusable input, email & mobile validators
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
│   ├── sms/
│   │   ├── interfaces/
│   │   │   └── SMSProvider.js            # Abstract base SMS & OTP class
│   │   ├── providers/
│   │   │   └── msg91/
│   │   │       └── MSG91Provider.js      # MSG91 SMS & OTP implementation
│   │   ├── factories/
│   │   │   └── SMSFactory.js             # SMS provider factory
│   │   └── index.js                      # SMS module exports
│   │
│   └── index.js                          # Root package entry point
│
├── examples/
│   ├── razorpay-example.js               # Razorpay usage example
│   ├── ccavenue-example.js               # CCAvenue usage example
│   ├── resend-example.js                 # Resend usage example
│   └── msg91-example.js                  # MSG91 SMS & OTP usage example
│
├── tests/
│   ├── payments/
│   │   ├── razorpay.test.js              # Razorpay unit tests with SDK mocks
│   │   └── ccavenue.test.js              # CCAvenue unit tests with crypto vectors
│   ├── email/
│   │   └── resend.test.js                # Resend unit tests with SDK mocks
│   └── sms/
│       └── msg91.test.js                 # MSG91 unit tests with mock transport
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

# Resend Email Credentials
RESEND_API_KEY=re_YourResendApiKeyHere

# MSG91 SMS & OTP Credentials
MSG91_AUTH_KEY=YourMSG91AuthKeyHere
MSG91_BASE_URL=https://control.msg91.com
```

> **Security Note:** Never commit API keys or secrets to source control. `.env` is ignored by `.gitignore`.

---

## 5. Provider Factories

### Payment Factory

```javascript
import { createPaymentProvider } from 'mern-integrations';

const razorpay = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});
```

### Email Factory

```javascript
import { createEmailProvider } from 'mern-integrations';

const email = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});
```

### SMS Factory

```javascript
import { createSMSProvider } from 'mern-integrations';

const sms = createSMSProvider({
  provider: 'msg91',
  authKey: process.env.MSG91_AUTH_KEY,
  baseUrl: process.env.MSG91_BASE_URL // Optional
});
```

---

## 6. Payment Providers

### Amount Convention
- **All payment amounts must strictly be passed as positive integers representing the smallest currency sub-unit.**
- **For INR**, amounts must be in **paise** (1 Rupee = 100 paise). ₹10.00 &rarr; `1000`.

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

```javascript
import { createEmailProvider } from 'mern-integrations';

const email = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});

const response = await email.send({
  from: 'My App <noreply@yourdomain.com>',
  to: 'customer@example.com',
  subject: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
  text: 'Welcome! Thank you for signing up.'
});
```

---

## 8. SMS & OTP Providers

### MSG91 Integration

`MSG91Provider` implements OTP delivery, OTP verification, retry/resend capabilities, and transactional SMS using MSG91's official v5 Control APIs.

### Sending OTP (`sendOTP`)

Delivers an OTP to a mobile number with country code using MSG91's official `POST /api/v5/otp` endpoint.

```javascript
const otpResponse = await sms.sendOTP({
  mobile: '+91 99999 99999', // International mobile format
  templateId: '64188b77d6fc053070634123', // MSG91 OTP Template ID
  otpLength: 6, // Optional: 4 to 9 digits
  expiry: 10 // Optional: Expiry time in minutes
});
```

#### Normalized Response:
```json
{
  "success": true,
  "provider": "msg91",
  "data": {
    "requestId": "336577736637383637313039",
    "type": "success",
    "message": "OTP sent successfully",
    "mobile": "919999999999",
    "raw": { /* Original MSG91 JSON response */ }
  }
}
```

---

### Verifying OTP (`verifyOTP`)

Validates the OTP code entered by the customer using `GET /api/v5/otp/verify`.

```javascript
const verifyResponse = await sms.verifyOTP({
  mobile: '919999999999',
  otp: '123456'
});

if (verifyResponse.data.verified) {
  console.log('Mobile number verified successfully!');
} else {
  console.log('Invalid or expired OTP:', verifyResponse.data.message);
}
```

#### Normalized Verification Responses:
- **Valid OTP**:
  ```json
  {
    "success": true,
    "provider": "msg91",
    "data": {
      "verified": true,
      "mobile": "919999999999",
      "message": "OTP verified success"
    }
  }
  ```
- **Invalid / Expired OTP**:
  ```json
  {
    "success": true,
    "provider": "msg91",
    "data": {
      "verified": false,
      "mobile": "919999999999",
      "message": "OTP not match"
    }
  }
  ```

---

### Resending OTP (`resendOTP`)

Triggers OTP retry via alternative channels (`voice`, `text`, or `whatsapp`) using `GET /api/v5/otp/retry`.

```javascript
const retryResponse = await sms.resendOTP({
  mobile: '919999999999',
  retryType: 'voice' // 'voice', 'text', or 'whatsapp'
});
```

---

### Sending SMS (`sendSMS`)

Dispatches transactional or template-based SMS messages via MSG91's Flow API (`POST /api/v5/flow`). Supports single or multiple recipients.

```javascript
// Single recipient
const smsResponse = await sms.sendSMS({
  to: '919999999999',
  message: 'Your order #1234 is confirmed and will be delivered shortly.',
  senderId: 'MYMERN'
});

// Multi-recipient with template Flow variables
const flowResponse = await sms.sendSMS({
  to: ['919999999999', '918888888888'],
  templateId: '64188b77d6fc053070634123',
  variables: {
    customer_name: 'Valued Customer',
    discount: '20%'
  }
});
```

---

### Important Indian DLT & Template Considerations

> **REGULATORY NOTICE:** In India, commercial and transactional SMS delivery is governed by Telecom Commercial Communications Customer Preference Regulations (TCCCPR / TRAI).
> - All sender IDs (Headers) and SMS/OTP templates must be registered and approved on a DLT platform (e.g. Jio, Airtel, Vodafone, Smartping) and linked in your MSG91 Control Panel.
> - The `mern-integrations` library handles API packaging and validation, but cannot bypass DLT compliance, regulatory whitelisting, or telecommunication restrictions. Ensure appropriate template IDs and Sender IDs are configured in your MSG91 account.

---

## 9. Error Handling & Response Normalization

All public methods throw structured errors inheriting from `IntegrationError` or `ValidationError`:

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  await sms.sendOTP({ mobile: 'invalid_phone' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.toJSON());
  } else if (error instanceof IntegrationError) {
    console.error('Provider error:', error.toJSON());
  }
}
```

---

## 10. Example Scripts

Run the standalone example scripts:

```bash
# Run Razorpay payment example
npm run example:razorpay

# Run CCAvenue payment example
npm run example:ccavenue

# Run Resend email example
npm run example:resend

# Run MSG91 SMS & OTP example
npm run example:msg91
```

---

## 11. Testing Instructions

The test suite uses **Jest** with ES Module support. All gateway API calls and cryptographic flows are tested using mocks and verified reference vectors.

```bash
# Run all tests (Razorpay + CCAvenue + Resend + MSG91)
npm test

# Run tests in watch mode
npm run test:watch
```
