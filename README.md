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
  - [Storage Factory](#storage-factory)
- [6. Payment Providers](#6-payment-providers)
  - [Amount Convention](#amount-convention)
  - [Cashfree Integration](#cashfree-integration)
  - [Razorpay Integration](#razorpay-integration)
  - [CCAvenue Integration](#ccavenue-integration)
  - [Stripe Integration](#stripe-integration)
  - [PhonePe Integration](#phonepe-integration)
- [7. Email Providers](#7-email-providers)
  - [Resend Integration](#resend-integration)
  - [Nodemailer SMTP Integration](#nodemailer-smtp-integration)
  - [Amazon SES Integration](#amazon-ses-integration)
- [8. SMS & OTP Providers](#8-sms--otp-providers)
  - [MSG91 Integration](#msg91-integration)
  - [MessageBird Integration](#messagebird-integration)
  - [Twilio Integration](#twilio-integration)
- [9. Storage Providers](#9-storage-providers)
  - [Cloudinary Integration](#cloudinary-integration)
  - [AWS S3 Integration](#aws-s3-integration)
- [10. Enterprise Middlewares](#10-enterprise-middlewares)
  - [Idempotency Key Middleware](#idempotency-key-middleware)
  - [Unified Webhook Event Normalizer](#unified-webhook-event-normalizer)
- [11. Error Handling & Capability Introspection](#11-error-handling--capability-introspection)
  - [Structured Error Classes](#structured-error-classes)
  - [Standard Error Codes & Failure Categories](#standard-error-codes--failure-categories)
  - [Provider Capabilities Contract](#provider-capabilities-contract)
  - [Webhook Raw Body Security Notice](#webhook-raw-body-security-notice)
- [12. Example Scripts](#12-example-scripts)
- [13. Testing & Test Coverage](#13-testing--test-coverage)
- [14. CI/CD & Quality Gates](#14-cicd--quality-gates)
- [15. Development & Packaging Workflow](#15-development--packaging-workflow)
- [16. Developer Onboarding Guide](#16-developer-onboarding-guide)
  - [Getting Started](#getting-started)
  - [Adding a New Provider](#adding-a-new-provider)

---

## 1. Project Purpose

In standard MERN applications, integrating third-party services directly into controller logic often leads to tight coupling, vendor lock-in, fragmented error handling, and security oversights.

`mern-integrations` solves this by introducing:
- **Provider Abstractions**: Unified `PaymentProvider`, `EmailProvider`, `SMSProvider`, and `StorageProvider` interfaces decoupling business logic from third-party gateway SDKs.
- **Strict Input Validation**: Guaranteed validation of amounts, currencies, emails, mobile numbers, and payload types before API calls.
- **Secure Cryptography & Transport**: Native `crypto.timingSafeEqual()` for Razorpay HMAC signatures, verified `AES-128-CBC` (MD5 key derivation) for CCAvenue, official Stripe SDK with webhook verification, and official AWS SDK v3.
- **Normalized Response Format**: Consistent success and error response shapes across all providers.
- **Private & Extensible Foundation**: Built with ES Modules, supporting multi-provider architectures.

---

## 2. Folder Structure

```
mern-integrations/
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI matrix workflow
│
├── bin/
│   ├── cli.js                        # Executable CLI entrypoint (npx mern-integrations init)
│   ├── args.js                       # CLI argument & flag parser
│   ├── wizard.js                     # Interactive terminal prompts & questionnaire
│   ├── generator.js                  # Scaffolding template engine
│   ├── dependencies.js               # Smart peer-dependency calculator & installer
│   └── templates/                    # Express & Next.js boilerplate templates
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
│   │   │   ├── cashfree/
│   │   │   │   └── CashfreeProvider.js   # Cashfree PG SDK-less implementation
│   │   │   ├── razorpay/
│   │   │   │   └── RazorpayProvider.js   # Razorpay SDK implementation
│   │   │   ├── ccavenue/
│   │   │   │   ├── CCAvenueProvider.js   # CCAvenue redirect & callback implementation
│   │   │   │   └── ccavenue.crypto.js    # Official AES-128-CBC crypto helpers
│   │   │   ├── stripe/
│   │   │   │   └── StripeProvider.js     # Stripe SDK PaymentIntents implementation
│   │   │   └── phonepe/
│   │   │       └── PhonePeProvider.js    # PhonePe Standard Checkout & UPI implementation
│   │   ├── factories/
│   │   │   └── PaymentFactory.js         # Payment provider factory
│   │   └── index.js                      # Payments module exports
│   │
│   ├── email/
│   │   ├── interfaces/
│   │   │   └── EmailProvider.js          # Abstract base email class
│   │   ├── providers/
│   │   │   ├── resend/
│   │   │   │   └── ResendProvider.js     # Resend SDK implementation
│   │   │   ├── nodemailer/
│   │   │   │   └── NodemailerProvider.js # Nodemailer SMTP implementation
│   │   │   └── ses/
│   │   │       └── SESProvider.js        # Amazon SES v3 implementation
│   │   ├── factories/
│   │   │   └── EmailFactory.js           # Email provider factory
│   │   └── index.js                      # Email module exports
│   │
│   ├── sms/
│   │   ├── interfaces/
│   │   │   └── SMSProvider.js            # Abstract base SMS class
│   │   ├── providers/
│   │   │   ├── msg91/
│   │   │   │   └── MSG91Provider.js      # MSG91 SMS & OTP implementation
│   │   │   ├── messagebird/
│   │   │   │   └── MessageBirdProvider.js# MessageBird WhatsApp & SMS implementation
│   │   │   └── twilio/
│   │   │       └── TwilioProvider.js     # Twilio SMS, WhatsApp & Verify v2 implementation
│   │   ├── factories/
│   │   │   └── SMSFactory.js             # SMS provider factory
│   │   └── index.js                      # SMS module exports
│   │
│   ├── storage/
│   │   ├── interfaces/
│   │   │   └── StorageProvider.js        # Abstract base storage class
│   │   ├── providers/
│   │   │   ├── cloudinary/
│   │   │   │   └── CloudinaryProvider.js # Cloudinary SDK implementation
│   │   │   └── s3/
│   │   │       └── S3Provider.js         # AWS S3 v3 implementation
│   │   ├── factories/
│   │   │   └── StorageFactory.js         # Storage provider factory
│   │   └── index.js                      # Storage module exports
│   │
│   ├── testing/
│   │   ├── MockPaymentProvider.js        # In-memory mock payment provider
│   │   ├── MockEmailProvider.js          # In-memory mock email provider
│   │   ├── MockSMSProvider.js            # In-memory mock SMS provider
│   │   ├── MockStorageProvider.js        # In-memory mock storage provider
│   │   └── index.js                      # Testing submodule exports
│   │
│   ├── middleware/
│   │   ├── idempotency/
│   │   │   ├── InMemoryIdempotencyStore.js # Zero-dependency LRU+TTL in-memory cache
│   │   │   └── idempotencyMiddleware.js     # Enterprise idempotency with concurrency locks
│   │   ├── webhooks/
│   │   │   ├── normalizeWebhookEvent.js    # Multi-provider webhook canonical normalizer
│   │   │   └── webhookNormalizerMiddleware.js # Express middleware with signature verification
│   │   └── index.js                        # Middleware submodule exports
│   │
│   └── index.js                          # Root package entry point
│
├── examples/
│   ├── README.md                         # Examples guide & environment variable matrix
│   ├── payments/
│   │   ├── razorpay.example.js           # Razorpay payment & webhook example
│   │   ├── stripe.example.js             # Stripe PaymentIntents & refund example
│   │   ├── ccavenue.example.js           # CCAvenue redirect descriptor & callback example
│   │   └── phonepe.example.js            # PhonePe checkout & webhook verification example
│   ├── email/
│   │   ├── resend.example.js             # Resend transactional email example
│   │   ├── nodemailer.example.js         # Nodemailer SMTP & verify example
│   │   └── ses.example.js                # Amazon SES email example
│   ├── sms/
│   │   ├── msg91.example.js              # MSG91 flow SMS & OTP example
│   │   ├── messagebird.example.js        # MessageBird SMS & WhatsApp template example
│   │   └── twilio.example.js             # Twilio SMS, WhatsApp & Verify OTP example
│   ├── storage/
│   │   ├── cloudinary.example.js         # Cloudinary buffer upload & URL generation
│   │   └── s3.example.js                 # AWS S3 buffer upload & pre-signed URL example
│   └── middleware/
│       ├── idempotency.example.js        # Enterprise idempotency & replay cache example
│       └── webhook-normalizer.example.js # Multi-provider webhook canonical normalization example
│
├── tests/
│   ├── index.test.js                     # Root exports and submodule tests
│   ├── core/
│   │   ├── api-contract.test.js          # Package export contract and integrity tests
│   │   └── dependencies.test.js          # Optional dependencies & lazy-loading tests
│   ├── payments/
│   │   ├── cashfree.test.js              # Cashfree unit tests with HTTP mocks
│   │   ├── razorpay.test.js              # Razorpay unit tests with SDK mocks
│   │   ├── ccavenue.test.js              # CCAvenue unit tests with crypto vectors
│   │   ├── stripe.test.js                # Stripe unit tests with SDK mocks
│   │   └── phonepe.test.js               # PhonePe unit tests with HTTP mocks
│   ├── email/
│   │   ├── resend.test.js                # Resend unit tests with SDK mocks
│   │   ├── nodemailer.test.js            # Nodemailer unit tests with mocks
│   │   └── ses.test.js                   # Amazon SES unit tests with SDK mocks
│   ├── sms/
│   │   ├── msg91.test.js                 # MSG91 unit tests with mock transport
│   │   ├── messagebird.test.js           # MessageBird unit tests with mocks
│   │   └── twilio.test.js                # Twilio unit tests with HTTP mocks
│   ├── storage/
│   │   ├── cloudinary.test.js            # Cloudinary unit tests with mocks
│   │   └── s3.test.js                    # AWS S3 unit tests with mocks
│   └── middleware/
│       ├── idempotency.test.js           # Idempotency middleware & cache tests
│       └── webhook-normalizer.test.js    # Webhook normalizer & signature tests
│
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── jest.config.js
```

## 3. Installation & Setup

### Requirements
- **Node.js**: `>= 18.0.0` (Native ES Modules required)
- **NPM**: `>= 9.0.0`

### ⚡ Instant Setup with CLI Wizard (`npx mern-integrations init`)

The fastest way to scaffold integrations in an existing or new MERN or Next.js project is using the interactive CLI:

```bash
npx mern-integrations init
```

The interactive wizard prompts for your framework (**Express.js** or **Next.js App Router**), desired providers, and enterprise middlewares, automatically calculates and installs only the required optional peer dependencies, generates `.env.example` keys with documentation links, and scaffolds ready-to-run route controllers and configuration files.

#### Non-Interactive Automation (CI/CD / Scripting):
```bash
# Example: Express with PhonePe, Resend, Twilio, Cloudinary, and Idempotency Middleware
npx mern-integrations init --payments phonepe --email resend --sms twilio --storage cloudinary --middlewares idempotency,webhook-normalizer --yes
```

---

### Quick Start (e.g. Razorpay + Resend Stack)

If your application only needs **Razorpay** for payments and **Resend** for transactional emails, install only those two SDKs:

```bash
npm install mern-integrations razorpay resend
```

Then initialize and use your providers without needing uninstalled SDKs:

```javascript
import { createPaymentProvider, createEmailProvider } from 'mern-integrations';

// 1. Initialize Razorpay (Auto-hydrates keyId & keySecret from process.env.RAZORPAY_*)
const payment = createPaymentProvider({ provider: 'razorpay' });

// 2. Initialize Resend (Auto-hydrates apiKey from process.env.RESEND_API_KEY)
const email = createEmailProvider({ provider: 'resend' });

// 3. Create an Order & Send Confirmation
async function processOrder(customer) {
  // Amount in paise: ₹499.00 = 49900 paise
  const order = await payment.createOrder({
    amount: 49900,
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`
  });

  await email.send({
    from: 'Acme Store <orders@acmestore.dev>',
    to: customer.email,
    subject: 'Order Initiated',
    html: `<h2>Order Created</h2><p>Your order ID is: ${order.data.id}</p>`
  });

  return order;
}
```

### Install Only What You Need

`mern-integrations` is engineered with an **optional peer dependencies and safe ESM lazy-loading** architecture. You only install the external provider SDKs you actually use in your application. Unrelated provider SDKs are never required or loaded at import time.

#### Provider to SDK Dependency Mapping

| Provider Domain | Provider Identifier | Required External SDK Package(s) | Notes |
|---|---|---|---|
| **Payments** | `cashfree` | *None* | Uses Node.js native `fetch` & `node:crypto` |
| | `razorpay` | `razorpay` | Optional peer dependency |
| | `stripe` | `stripe` | Optional peer dependency |
| | `ccavenue` | *None* | Uses Node.js built-in `node:crypto` |
| | `phonepe` | *None* | Uses Node.js native `fetch` & `node:crypto` |
| **Email** | `resend` | `resend` | Optional peer dependency |
| | `nodemailer` | `nodemailer` | Optional peer dependency |
| | `ses` / `amazon-ses` | `@aws-sdk/client-ses` | Optional peer dependency |
| **SMS** | `msg91` | *None* | Uses Node.js native `fetch` |
| | `messagebird` | *None* | Uses Node.js native `fetch` |
| | `twilio` | *None* | Uses Node.js native `fetch` & `node:crypto` |
| **Storage** | `cloudinary` | `cloudinary` | Optional peer dependency |
| | `s3` / `aws-s3` | `@aws-sdk/client-s3`<br>`@aws-sdk/lib-storage`<br>`@aws-sdk/s3-request-presigner` | Optional peer dependencies |
| **Testing** | `mock` (all domains) | *None* | Built-in in-memory providers under `mern-integrations/testing` |

#### Installation Examples

##### 1. Razorpay Only
```bash
npm install mern-integrations razorpay
```

##### 2. Resend Only
```bash
npm install mern-integrations resend
```

##### 3. Razorpay + Resend
```bash
npm install mern-integrations razorpay resend
```

##### 4. Stripe + Nodemailer
```bash
npm install mern-integrations stripe nodemailer
```

##### 5. Amazon SES Email
```bash
npm install mern-integrations @aws-sdk/client-ses
```

##### 6. AWS S3 Storage
```bash
npm install mern-integrations @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

##### 7. Cloudinary Media Storage
```bash
npm install mern-integrations cloudinary
```

##### 8. Zero-External-Dependency Stack (CCAvenue + MSG91)
```bash
npm install mern-integrations
```

#### Safe Lazy Loading & Missing Dependency Error Contract

- **Root & Submodule Import Isolation**: Importing `mern-integrations` or subpaths (`mern-integrations/payments`, `mern-integrations/email`, etc.) never attempts to evaluate external SDKs until a provider method is invoked.
- **Unsupported Provider vs Missing SDK**:
  - **Unsupported Provider** (e.g. `provider: 'paypal'`): Throws `IntegrationError` with `code: 'UNSUPPORTED_PROVIDER'`, HTTP status `400`.
  - **Supported Provider with Missing SDK** (e.g. `provider: 'stripe'` without `npm install stripe`): Throws a clean `IntegrationError` with:
    - `code: 'MISSING_PROVIDER_DEPENDENCY'`
    - `statusCode: 500`
    - `provider: 'stripe'`
    - Human-readable message: `"The optional dependency 'stripe' is required to use the 'stripe' provider. Please install it with: npm install stripe"`
    - No raw Node.js `MODULE_NOT_FOUND` stack trace leakage.

---

### Module Import Conventions

You can import all providers, factories, errors, and validators from the root package or through dedicated subpaths:

```javascript
// 1. Root package import
import {
  createPaymentProvider,
  createEmailProvider,
  createSMSProvider,
  createStorageProvider,
  RazorpayProvider,
  StripeProvider,
  CCAvenueProvider,
  PhonePeProvider,
  ResendProvider,
  NodemailerProvider,
  SESProvider,
  MSG91Provider,
  MessageBirdProvider,
  TwilioProvider,
  IntegrationError,
  ValidationError
} from 'mern-integrations';

// 2. Domain submodule imports
import { createPaymentProvider, PhonePeProvider, StripeProvider } from 'mern-integrations/payments';
import { createEmailProvider, NodemailerProvider } from 'mern-integrations/email';
import { createSMSProvider, TwilioProvider, MSG91Provider } from 'mern-integrations/sms';
import { createStorageProvider, S3Provider } from 'mern-integrations/storage';
import { MockPaymentProvider, MockEmailProvider, MockSMSProvider, MockStorageProvider } from 'mern-integrations/testing';
```

### Supported Provider Capability Matrix

All concrete providers expose a read-only, immutable `capabilities` getter returning supported operation names:

| Domain | Provider | Supported Methods / Capabilities |
|---|---|---|
| **Payments** | `RazorpayProvider` | `createOrder`, `initiatePayment`, `verifyPayment`, `verifyCallback`, `refund`, `verifyWebhook` |
| | `CCAvenueProvider` | `createOrder`, `initiatePayment`, `verifyPayment`, `verifyCallback`, `parseEncryptedResponse` |
| | `StripeProvider` | `createOrder`, `initiatePayment`, `verifyPayment`, `verifyCallback`, `refund`, `verifyWebhook` |
| | `PhonePeProvider` | `createOrder`, `initiatePayment`, `verifyPayment`, `verifyCallback`, `refund`, `verifyWebhook` |
| | `MockPaymentProvider` | `createOrder`, `initiatePayment`, `verifyPayment`, `verifyCallback`, `refund`, `verifyWebhook` |
| **Email** | `ResendProvider` | `send` |
| | `NodemailerProvider` | `send`, `verify` |
| | `SESProvider` | `send` |
| | `MockEmailProvider` | `send`, `verify` |
| **SMS & OTP** | `MSG91Provider` | `sendSMS`, `sendOTP`, `verifyOTP`, `resendOTP`, `sendWhatsApp` |
| | `MessageBirdProvider` | `sendSMS`, `sendWhatsApp` |
| | `TwilioProvider` | `sendSMS`, `sendOTP`, `verifyOTP`, `sendWhatsApp`, `verifyWebhook` |
| | `MockSMSProvider` | `sendSMS`, `sendOTP`, `verifyOTP`, `resendOTP`, `sendWhatsApp`, `verifyWebhook` |
| **Storage** | `CloudinaryProvider` | `upload`, `uploadBuffer`, `delete`, `getUrl` |
| | `S3Provider` | `upload`, `uploadBuffer`, `uploadStream`, `delete`, `getUrl` |
| | `MockStorageProvider` | `upload`, `uploadBuffer`, `uploadStream`, `delete`, `getUrl` |

---

## 4. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

```env
# Cashfree PG Credentials
CASHFREE_APP_ID=TEST11286295edb615b6136d4c10c5e359268211
CASHFREE_SECRET_KEY=cfsk_ma_test_074dbe3acec5c41338c85e44e5b66ae5_d6a3ef8f
CASHFREE_ENV=SANDBOX
CASHFREE_API_VERSION=2023-08-01

# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# CCAvenue Credentials
CCAVENUE_MERCHANT_ID=YourMerchantIdHere
CCAVENUE_ACCESS_CODE=YourAccessCodeHere
CCAVENUE_WORKING_KEY=YourWorkingKeyHere
CCAVENUE_BASE_URL=https://test.ccavenue.com

# Stripe Credentials
STRIPE_SECRET_KEY=sk_test_YourStripeSecretKeyHere
STRIPE_WEBHOOK_SECRET=whsec_YourWebhookSecretHere

# PhonePe UPI & PG Credentials
PHONEPE_MERCHANT_ID=PGTESTPAYUAT
PHONEPE_SALT_KEY=099eb0cd-02cf-4e2a-8aca-3e6c6aff0399
PHONEPE_SALT_INDEX=1
PHONEPE_CALLBACK_URL=https://yourdomain.com/api/payments/phonepe/callback
PHONEPE_TEST_MODE=true

# Resend Email Credentials
RESEND_API_KEY=re_YourResendApiKeyHere

# Nodemailer SMTP Email Credentials
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_SERVICE=

# Amazon SES Email Credentials
AWS_SES_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SES_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SES_REGION=us-east-1
AWS_SES_CONFIGURATION_SET=

# MSG91 SMS & OTP Credentials
MSG91_AUTH_KEY=YourMSG91AuthKeyHere
MSG91_BASE_URL=https://control.msg91.com

# Twilio SMS, WhatsApp & Verify Credentials
TWILIO_ACCOUNT_SID=AC_YourTwilioAccountSidHere
TWILIO_AUTH_TOKEN=YourTwilioAuthTokenHere
TWILIO_FROM=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MG_YourMessagingServiceSidHere
TWILIO_VERIFY_SERVICE_SID=VA_YourVerifyServiceSidHere
```

> **Security Note:** Never commit API keys or secrets to source control. `.env` is ignored by `.gitignore`.

---

## 5. Provider Factories

### Payment Factory

```javascript
import { createPaymentProvider } from 'mern-integrations';

// 1. Razorpay Provider
const razorpay = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});

// 2. CCAvenue Provider
const ccavenue = createPaymentProvider({
  provider: 'ccavenue',
  merchantId: process.env.CCAVENUE_MERCHANT_ID,
  accessCode: process.env.CCAVENUE_ACCESS_CODE,
  workingKey: process.env.CCAVENUE_WORKING_KEY,
  baseUrl: process.env.CCAVENUE_BASE_URL
});

// 3. Stripe Provider
const stripe = createPaymentProvider({
  provider: 'stripe',
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});

// 4. PhonePe Provider (UPI & Standard Checkout)
const phonepe = createPaymentProvider({
  provider: 'phonepe',
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || 1,
  callbackUrl: process.env.PHONEPE_CALLBACK_URL,
  testMode: process.env.PHONEPE_TEST_MODE === 'true'
});
```

### Email Factory

```javascript
import { createEmailProvider } from 'mern-integrations';

// 1. Resend Provider
const resendEmail = createEmailProvider({
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY
});

// 2. Nodemailer SMTP Provider (Custom SMTP / Mailtrap / SES / Gmail)
const smtpEmail = createEmailProvider({
  provider: 'nodemailer',
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// 3. Amazon SES Provider (AWS SDK v3)
const sesEmail = createEmailProvider({
  provider: 'ses',
  accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
  configurationSetName: process.env.AWS_SES_CONFIGURATION_SET // Optional
});
```

### SMS Factory

```javascript
import { createSMSProvider } from 'mern-integrations';

// MSG91 Provider
const msg91 = createSMSProvider({
  provider: 'msg91',
  authKey: process.env.MSG91_AUTH_KEY,
  baseUrl: process.env.MSG91_BASE_URL // Optional
});

// MessageBird Provider
const messagebird = createSMSProvider({
  provider: 'messagebird',
  apiKey: process.env.MESSAGEBIRD_API_KEY,
  channelId: process.env.MESSAGEBIRD_CHANNEL_ID,
  namespace: process.env.MESSAGEBIRD_NAMESPACE
});

// Twilio Provider (SMS, WhatsApp, Verify v2)
const twilio = createSMSProvider({
  provider: 'twilio',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID
});
```

### Storage Factory

```javascript
import { createStorageProvider } from 'mern-integrations';

// Cloudinary Provider
const cloudinaryStorage = createStorageProvider({
  provider: 'cloudinary',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET
});

// AWS S3 Provider
const s3Storage = createStorageProvider({
  provider: 's3',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET,
  endpoint: process.env.AWS_S3_ENDPOINT // Optional for MinIO / R2
});
```

---

## 6. Payment Providers

### Amount Convention
- **All payment amounts must strictly be passed as positive integers representing the smallest currency sub-unit.**
- **For INR**, amounts must be in **paise** (1 Rupee = 100 paise). ₹10.00 &rarr; `1000`.

### Cashfree Integration
- `createOrder({ amount, currency, receipt, customer, notes })`: Creates an order via Cashfree PG REST API and returns `payment_session_id` for Cashfree Web Checkout SDK v3 modal.
- `verifyPayment({ orderId })`: Queries live order status from Cashfree PG and maps order status (`PAID` &rarr; `verified: true`).
- `refund({ orderId, amount, refundId, note })`: Dispatches full or partial refunds via Cashfree Refunds API.
- `verifyWebhook({ payload, signature, timestamp, secret })`: Cryptographically verifies webhook HMAC-SHA256 signature using `x-webhook-signature` and `x-webhook-timestamp`.

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

### Stripe Integration

`StripeProvider` integrates Stripe payments using the official `stripe` Node.js SDK. It manages the full lifecycle of payment flows using Stripe **PaymentIntents**, payment verification, refunds, and cryptographic webhook event validation.

#### Provider Initialization

```javascript
import { createPaymentProvider, StripeProvider } from 'mern-integrations';

// Via Factory
const stripe = createPaymentProvider({
  provider: 'stripe',
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});

// Or Direct Instantiation
const directStripe = new StripeProvider({
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});
```

#### 1. Creating a PaymentIntent (`createOrder`)

Creates a Stripe PaymentIntent with automatic or manual capture, customer attachment, and custom metadata.

> [!IMPORTANT]
> **Client-Side Confirmation Required:** The backend `createOrder` method creates the PaymentIntent and returns `clientSecret`. The backend alone does NOT complete card payment collection. The client frontend must use **Stripe.js** (e.g. `@stripe/react-stripe-js` or `@stripe/stripe-js`) along with `stripe.confirmCardPayment(clientSecret)` or Stripe Payment Element to securely collect card details and authenticate the customer (including 3D Secure).

```javascript
const intent = await stripe.createOrder({
  amount: 2000, // Amount in smallest unit: 2000 cents = $20.00 USD
  currency: 'usd', // Default is 'usd'
  description: 'Premium Monthly Subscription',
  receiptEmail: 'customer@example.com',
  customerId: 'cus_123456789', // Optional
  metadata: {
    userId: 'user_101',
    plan: 'pro_monthly'
  }
});

// Pass `intent.data.clientSecret` to your frontend Stripe.js checkout form
console.log('Client Secret:', intent.data.clientSecret);
```

#### Normalized PaymentIntent Response:
```json
{
  "success": true,
  "provider": "stripe",
  "data": {
    "id": "pi_3MtwxGA9Iipxub",
    "clientSecret": "pi_3MtwxGA9Iipxub_secret_example",
    "amount": 2000,
    "currency": "usd",
    "status": "requires_payment_method",
    "raw": { /* Upstream Stripe PaymentIntent object */ }
  }
}
```

#### 2. Verifying Payment Status (`verifyPayment`)

Retrieves the PaymentIntent from Stripe and evaluates whether the payment has successfully completed.

```javascript
const verification = await stripe.verifyPayment({
  paymentIntentId: 'pi_3MtwxGA9Iipxub'
});

if (verification.data.verified) {
  console.log('Payment was successfully captured!');
} else {
  console.log('Payment status:', verification.data.status); // e.g. 'requires_action', 'processing', 'canceled'
}
```

#### Normalized Verification Response:
```json
{
  "success": true,
  "provider": "stripe",
  "data": {
    "id": "pi_3MtwxGA9Iipxub",
    "status": "succeeded",
    "amount": 2000,
    "currency": "usd",
    "verified": true,
    "raw": { /* Upstream Stripe PaymentIntent object */ }
  }
}
```

#### 3. Processing Refunds (`refund`)

Issues full or partial refunds against a `paymentIntentId` or `chargeId`.

```javascript
// Full refund
const fullRefund = await stripe.refund({
  paymentIntentId: 'pi_3MtwxGA9Iipxub'
});

// Partial refund with reason and metadata
const partialRefund = await stripe.refund({
  paymentIntentId: 'pi_3MtwxGA9Iipxub',
  amount: 1000, // Refund $10.00 of $20.00
  reason: 'requested_by_customer',
  metadata: { orderId: 'ord_123' }
});
```

#### Normalized Refund Response:
```json
{
  "success": true,
  "provider": "stripe",
  "data": {
    "id": "re_3MtwxGA9Iipxub",
    "status": "succeeded",
    "amount": 1000,
    "currency": "usd",
    "raw": { /* Upstream Stripe Refund object */ }
  }
}
```

#### 4. Webhook Signature Verification (`verifyWebhook`)

Cryptographically verifies incoming webhook events from Stripe using `stripe.webhooks.constructEvent` with the raw request body.

```javascript
// In Express, use express.raw({ type: 'application/json' }) for webhook routes
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    const result = await stripe.verifyWebhook({
      payload: req.body, // Exact raw Buffer or string
      signature
    });

    if (!result.data.verified) {
      return res.status(400).send('Invalid signature');
    }

    const event = result.data.event;
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`Payment for ${paymentIntent.amount} succeeded!`);
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.last_payment_error?.message);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

#### Security Notes
- `secretKey`, `webhookSecret`, and SDK client instances are encapsulated inside ECMAScript private class fields (`#secretKey`, `#webhookSecret`, `#client`).
- Credentials are never exposed via `Object.keys()`, `JSON.stringify()`, or normalized response objects.
- All thrown `IntegrationError` instances sanitize and redact API secrets automatically before serialization.

---

### PhonePe Integration

`PhonePeProvider` implements PhonePe's Standard Checkout PG and UPI payment workflows without any external SDK dependencies. It uses Node.js native `fetch` and `node:crypto` with SHA-256 base64 checksum generation (`X-VERIFY`).

#### Environment Variables

```env
PHONEPE_MERCHANT_ID=PGTESTPAYUAT
PHONEPE_SALT_KEY=099eb0cd-02cf-4e2a-8aca-3e6c6aff0399
PHONEPE_SALT_INDEX=1
PHONEPE_CALLBACK_URL=https://yourdomain.com/api/payments/phonepe/callback
PHONEPE_TEST_MODE=true
```

#### Provider Initialization

```javascript
import { createPaymentProvider, PhonePeProvider } from 'mern-integrations';

const phonepe = createPaymentProvider({
  provider: 'phonepe',
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || 1,
  callbackUrl: process.env.PHONEPE_CALLBACK_URL,
  testMode: process.env.PHONEPE_TEST_MODE === 'true' // Pre-prod sandbox vs Production
});

// Or Direct Instantiation
const directPhonePe = new PhonePeProvider({
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: 1,
  testMode: true
});
```

#### 1. Initiating Payment / Standard Checkout (`createOrder` / `initiatePayment`)

Encodes the payment request into base64 JSON, signs with SHA-256 (`base64 + '/pg/v1/pay' + saltKey + '###' + saltIndex`), dispatches to PhonePe's `/pg/v1/pay` endpoint, and returns the redirect URL for customer checkout.

```javascript
const order = await phonepe.createOrder({
  amount: 49900, // Amount in paise: ₹499.00 = 49900 paise
  currency: 'INR',
  merchantTransactionId: `MT_${Date.now()}`,
  merchantUserId: 'user_123',
  redirectUrl: 'https://yourdomain.com/checkout/success',
  callbackUrl: 'https://yourdomain.com/api/payments/phonepe/callback',
  mobileNumber: '9999999999',
  message: 'Order #1001 payment'
});

// Redirect the customer's browser to the PhonePe payment page
console.log('Redirect URL:', order.data.redirectUrl);
```

#### Normalized createOrder Response:
```json
{
  "success": true,
  "provider": "phonepe",
  "data": {
    "merchantTransactionId": "MT_1726000000",
    "merchantId": "PGTESTPAYUAT",
    "amount": 49900,
    "currency": "INR",
    "redirectUrl": "https://mercury-uat.phonepe.com/transact/pay?token=...",
    "state": "PENDING",
    "raw": { /* Upstream PhonePe API response */ }
  }
}
```

#### 2. Server-to-Server Status Verification (`verifyPayment`)

Queries PhonePe's `/pg/v1/status/{merchantId}/{merchantTransactionId}` endpoint with `X-VERIFY` header to reliably verify payment completion independently of browser redirects.

```javascript
const verification = await phonepe.verifyPayment({
  merchantTransactionId: 'MT_1726000000'
});

if (verification.data.verified) {
  console.log('Payment succeeded! Transaction ID:', verification.data.transactionId);
} else {
  console.log('Payment not completed:', verification.data.state); // 'FAILED', 'PENDING'
}
```

#### Normalized Verification Response:
```json
{
  "success": true,
  "provider": "phonepe",
  "data": {
    "verified": true,
    "merchantTransactionId": "MT_1726000000",
    "transactionId": "T2409131200001",
    "amount": 49900,
    "state": "COMPLETED",
    "responseCode": "SUCCESS",
    "paymentInstrument": { "type": "UPI" },
    "raw": { /* Upstream PhonePe status response */ }
  }
}
```

#### 3. Handling Browser Redirect / Callback (`verifyCallback`)

Decodes the base64-encoded response POSTed or GETed back by PhonePe to your callback URL and optionally validates checksum.

```javascript
app.post('/api/payments/phonepe/callback', async (req, res) => {
  const { response } = req.body;
  const signature = req.headers['x-verify'];

  const result = await phonepe.verifyCallback({
    response,
    signature
  });

  if (result.data.verified) {
    res.redirect('/order/success');
  } else {
    res.redirect('/order/failed');
  }
});
```

#### 4. Processing Refunds (`refund`)

Issues a full or partial refund for a settled transaction via PhonePe's `/pg/v1/refund` API.

```javascript
const refund = await phonepe.refund({
  merchantTransactionId: `REF_${Date.now()}`,
  originalTransactionId: 'MT_1726000000',
  amount: 49900,
  callbackUrl: 'https://yourdomain.com/api/payments/phonepe/refund-callback'
});

console.log('Refund state:', refund.data.state);
```

#### 5. Webhook Signature Verification (`verifyWebhook`)

Cryptographically validates server-to-server webhook callbacks using SHA-256 and constant-time comparison (`crypto.timingSafeEqual`).

```javascript
app.post('/api/webhooks/phonepe', async (req, res) => {
  const signature = req.headers['x-verify'];

  try {
    const verification = await phonepe.verifyWebhook({
      payload: req.body, // Object with { response } or raw Buffer/string
      signature
    });

    if (!verification.data.verified) {
      return res.status(400).send('Invalid webhook signature');
    }

    const event = verification.data.event;
    console.log('Verified webhook event:', event);

    res.json({ success: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

#### Security Notes
- `saltKey` is encapsulated inside `#saltKey` private class field and never leaks into `Object.keys()` or `JSON.stringify()`.
- Checksum validation uses `crypto.timingSafeEqual()` to guard against timing attacks.

---

### Cashfree Integration

`CashfreeProvider` integrates the Cashfree Payment Gateway using direct REST APIs (v2023-08-01+) with zero third-party runtime dependencies (native Node.js `fetch` and `node:crypto`). It manages order creation (returning `payment_session_id` for Cashfree Web Checkout SDK v3 modal or redirect flows), payment verification, refunds, and cryptographic webhook signature verification.

#### Provider Initialization

```javascript
import { createPaymentProvider, CashfreeProvider } from 'mern-integrations';

// Via Factory (auto-hydrates from process.env.CASHFREE_*)
const cashfree = createPaymentProvider({
  provider: 'cashfree',
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  testMode: process.env.CASHFREE_ENV === 'SANDBOX'
});

// Or Direct Instantiation
const directCashfree = new CashfreeProvider({
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  env: 'SANDBOX' // 'SANDBOX' or 'PRODUCTION'
});
```

#### 1. Creating an Order (`createOrder`)

Creates a payment order on Cashfree and generates a `payment_session_id` required by the Cashfree Web Checkout frontend SDK:

```javascript
const order = await cashfree.createOrder({
  amount: 50000, // ₹500.00 in paise
  currency: 'INR',
  receipt: `rcpt_${Date.now()}`,
  customer: {
    id: 'cust_user_123',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '9876543210'
  },
  notes: {
    userId: 'user_123',
    plan: 'premium'
  }
});

// Send `order.data.paymentSessionId` to your client application
console.log('Payment Session ID:', order.data.paymentSessionId);
```

#### Normalized Order Response:
```json
{
  "success": true,
  "provider": "cashfree",
  "data": {
    "id": "cf_ord_1728400000_abc123",
    "orderId": "cf_ord_1728400000_abc123",
    "cfOrderId": "1461783766901822464",
    "paymentSessionId": "session_udmgIbzbpI38yf1hLLa17...",
    "amount": 50000,
    "orderAmount": 500,
    "currency": "INR",
    "status": "ACTIVE",
    "receipt": "rcpt_1728400000",
    "entity": "order",
    "raw": { /* Upstream Cashfree order object */ }
  }
}
```

#### 2. Frontend Client Integration (Cashfree JS SDK v3)

In your frontend application (React, Next.js, or HTML/JS), load the Cashfree SDK and launch the checkout modal using `paymentSessionId`:

```javascript
// 1. Ensure script is loaded: https://sdk.cashfree.com/js/v3/cashfree.js
const cashfree = window.Cashfree({ mode: 'sandbox' }); // or 'production'

// 2. Open checkout modal
await cashfree.checkout({
  paymentSessionId: order.paymentSessionId,
  redirectTarget: '_modal' // '_modal' for modal popup, or '_self' for page redirect
});
```

#### 3. Verifying Payment / Order Status (`verifyPayment`)

Queries live order status directly from Cashfree:

```javascript
const verification = await cashfree.verifyPayment({
  orderId: 'cf_ord_1728400000_abc123'
});

if (verification.data.verified) {
  console.log('Payment successful! Status:', verification.data.status); // 'PAID'
} else {
  console.log('Payment pending or not completed:', verification.data.status); // 'ACTIVE', 'EXPIRED'
}
```

#### 4. Processing Refunds (`refund`)

Dispatches full or partial refunds for settled orders:

```javascript
const refund = await cashfree.refund({
  orderId: 'cf_ord_1728400000_abc123',
  amount: 25000, // Partial refund: ₹250.00 in paise
  refundId: `ref_${Date.now()}`,
  note: 'Customer return request'
});

console.log('Refund ID:', refund.data.id, 'Status:', refund.data.status);
```

#### 5. Webhook Signature Verification (`verifyWebhook`)

Cashfree dispatches `x-webhook-signature` and `x-webhook-timestamp` headers with each webhook payload. The signature is computed using HMAC-SHA256 over `timestamp + rawPayload`:

```javascript
app.post('/api/webhooks/cashfree', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  try {
    const verification = await cashfree.verifyWebhook({
      payload: req.body, // Buffer or raw string
      signature,
      timestamp
    });

    if (!verification.data.verified) {
      return res.status(400).send('Invalid webhook signature');
    }

    const { event, data } = verification.data;
    console.log(`Verified webhook event: ${event}`);

    // Process event: PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, etc.
    res.json({ success: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

#### Security & Environment Notes
- **Automatic Sandbox Detection**: Test keys (e.g. `TEST...` or secret keys containing `test`) and `env: 'SANDBOX'` automatically route requests to `https://sandbox.cashfree.com/pg` to prevent accidental production rejections.
- **Credential Protection**: `#secretKey` is a private class field; omitted from `Object.keys()`, `JSON.stringify()`, and automatically redacted from error messages with `[REDACTED]`.
- **Timing-Safe Cryptography**: Webhook signature verification uses `crypto.timingSafeEqual()` to guard against timing analysis attacks.

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

### Nodemailer SMTP Integration

`NodemailerProvider` provides production-grade SMTP email delivery supporting custom SMTP servers and popular email services.

#### Environment Variables

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_SERVICE= # Optional: e.g. 'gmail', 'outlook'
```

#### Provider Initialization

```javascript
import { createEmailProvider, NodemailerProvider } from 'mern-integrations';

// Via Factory
const email = createEmailProvider({
  provider: 'nodemailer',
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Or Direct Instantiation
const directEmail = new NodemailerProvider({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```

#### Service Configurations & Notes

- **Gmail SMTP (`service: 'gmail'`)**:
  > **Note on Gmail Authentication:** Google requires 2-Step Verification and a generated **App Password** (16 characters) or OAuth2 credentials for third-party SMTP access. Plain Google account passwords are not supported by Google SMTP.
  ```javascript
  const gmailProvider = createEmailProvider({
    provider: 'nodemailer',
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-16-char-app-password'
    }
  });
  ```

- **Outlook / Microsoft 365 (`service: 'outlook'`)**:
  ```javascript
  const outlookProvider = createEmailProvider({
    provider: 'nodemailer',
    service: 'outlook',
    auth: {
      user: 'user@outlook.com',
      pass: 'your_outlook_password'
    }
  });
  ```

- **Mailtrap (Testing / Staging)**:
  ```javascript
  const mailtrapProvider = createEmailProvider({
    provider: 'nodemailer',
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS
    }
  });
  ```

- **Amazon SES SMTP**:
  ```javascript
  const sesProvider = createEmailProvider({
    provider: 'nodemailer',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.AWS_SES_SMTP_USER,
      pass: process.env.AWS_SES_SMTP_PASSWORD
    }
  });
  ```

#### Verifying SMTP Connection (`verify`)

Validates the SMTP connection and authentication credentials before sending emails.

```javascript
const verifyResult = await email.verify();
console.log('SMTP connection verified:', verifyResult.data.verified);
```

#### Sending Emails (`send`)

Supports plain text, rich HTML, multiple recipients, CC/BCC, custom headers, and attachments.

```javascript
const sendResult = await email.send({
  from: '"My MERN App" <noreply@example.com>',
  to: ['customer@example.com', 'user2@example.com'],
  cc: 'team@example.com',
  bcc: 'audit@example.com',
  replyTo: 'support@example.com',
  subject: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
  text: 'Welcome! Thank you for signing up.',
  attachments: [
    {
      filename: 'invoice.pdf',
      content: invoiceBuffer,
      contentType: 'application/pdf'
    },
    {
      filename: 'guide.txt',
      path: './docs/guide.txt'
    }
  ],
  headers: {
    'X-App-Version': '1.0.0'
  }
});
```

#### Normalized Response:

```json
{
  "success": true,
  "provider": "nodemailer",
  "data": {
    "id": "<b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>",
    "accepted": ["customer@example.com", "user2@example.com"],
    "rejected": [],
    "response": "250 2.0.0 OK: message queued",
    "raw": { /* Upstream Nodemailer info object */ }
  }
}
```

---

### Amazon SES Integration

`SESProvider` provides production-ready email transmission using the official AWS SDK v3 (`@aws-sdk/client-ses`).

#### Environment Variables

```env
AWS_SES_ACCESS_KEY_ID=your_aws_access_key
AWS_SES_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SES_REGION=us-east-1
AWS_SES_CONFIGURATION_SET= # Optional default configuration set
```

#### Provider Initialization

```javascript
import { createEmailProvider, SESProvider } from 'mern-integrations';

// Via Factory
const sesEmail = createEmailProvider({
  provider: 'ses', // or 'amazon-ses', 'amazonses'
  accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
  configurationSetName: process.env.AWS_SES_CONFIGURATION_SET // Optional
});

// Or Direct Instantiation
const directSES = new SESProvider({
  accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});
```

#### Sending Emails (`send`)

Supports UTF-8 encoded plain text, rich HTML, multiple recipients, CC/BCC, custom Reply-To addresses, Configuration Sets, and message tagging.

```javascript
const sendResult = await sesEmail.send({
  from: 'My MERN App <verified-sender@example.com>',
  to: ['customer@example.com', 'client2@example.com'],
  cc: 'manager@example.com',
  bcc: 'audit@example.com',
  replyTo: 'support@example.com',
  subject: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for joining our platform.</p>',
  text: 'Welcome! Thank you for joining our platform.',
  configurationSetName: 'production-engagement-tracking', // Optional override
  tags: [
    { name: 'Environment', value: 'Production' },
    { name: 'Campaign', value: 'WelcomeOnboarding' }
  ]
});

console.log('SES Message ID:', sendResult.data.id);
```

#### Normalized Response:

```json
{
  "success": true,
  "provider": "ses",
  "data": {
    "id": "0100017e-9821-4a3b-b892-123456789abc-000000",
    "raw": {
      "MessageId": "0100017e-9821-4a3b-b892-123456789abc-000000"
    }
  }
}
```

#### Important Amazon SES Notes & Limitations

> **1. SES Sandbox Mode:**
> - New AWS accounts start in the **Amazon SES Sandbox**.
> - In sandbox mode, you can only send emails to **verified email addresses or verified domains** in your AWS SES console, with a max sending limit of 200 emails/24 hours.
> - To send to unverified recipient addresses, submit an AWS SES Sending Limits increase request in the AWS Console to move your account to Production.
>
> **2. Verified Identities & DKIM:**
> - The `from` email address or its root domain must be a verified identity in your Amazon SES region.
> - For maximum deliverability, configure Easy DKIM and SPF records in your DNS.
>
> **3. Configuration Sets:**
> - Configuration Sets allow you to publish email sending events (deliveries, opens, clicks, bounces, complaints) to Amazon CloudWatch, Kinesis Firehose, or SNS.

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

### Sending WhatsApp (`sendWhatsApp`)

Sends template-based WhatsApp messages via MSG91's WhatsApp Outbound Message API (`POST /api/v5/whatsapp/whatsapp-outbound-message/bulk/`).

```javascript
// Single recipient with template variables
const waResponse = await sms.sendWhatsApp({
  to: '+91 99999 99999',
  templateId: 'order_status_update',
  integratedNumber: '919876543210', // Optional if configured on provider
  variables: {
    body_1: 'John Doe',
    body_2: 'ORDER-1002'
  }
});

// Multiple recipients with custom language and namespace
const waBulkResponse = await sms.sendWhatsApp({
  to: ['919999999999', '918888888888'],
  templateId: 'security_alert_v1',
  language: 'en',
  namespace: 'custom_template_namespace',
  components: {
    header_1: { type: 'text', value: 'Security Alert' },
    body_1: { type: 'text', value: '456789' }
  }
});
```

#### Normalized Response:
```json
{
  "success": true,
  "provider": "msg91",
  "data": {
    "requestId": "wa_req_998811",
    "type": "success",
    "message": "WhatsApp template message sent successfully",
    "recipients": "919999999999",
    "raw": { /* Original MSG91 JSON response */ }
  }
}
```

---

### Important Regulatory, DLT & WhatsApp Template Requirements

> **TRAI DLT Notice (SMS/OTP in India):**
> - Commercial SMS and OTPs in India require DLT registration (TRAI / TCCCPR) with Principal Entity ID, approved Headers (Sender IDs), and DLT Content Template IDs.
>
> **Meta WhatsApp Template Requirements:**
> - Outbound business-initiated WhatsApp messages **must use pre-approved Meta WhatsApp templates** synced to your MSG91 Control Panel.
> - Free-form or arbitrary text cannot initiate new 24-hour customer conversation windows without an approved template.
> - Ensure your WhatsApp Business Number is verified and integrated in your MSG91 account (`integrated_number`).


---

### MessageBird Integration

`MessageBirdProvider` implements WhatsApp Business messaging (HSM templates) via MessageBird's Conversations API (`https://conversations.messagebird.com/v1/send`) and SMS delivery via REST API (`https://rest.messagebird.com/messages`).

#### Sending WhatsApp Template Messages (`sendWhatsApp`)

Sends pre-approved WhatsApp templates using MessageBird's official Conversations API.

```javascript
// Simple positional variables
const waResponse = await messagebird.sendWhatsApp({
  to: '+31 6 12345678',
  templateName: 'order_notification',
  variables: ['John Doe', 'ORD-1002']
});

// Custom components and overridden channel
const customWaResponse = await messagebird.sendWhatsApp({
  to: '31612345678',
  templateName: 'media_alert',
  channelId: 'custom-channel-id',
  components: [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { url: 'https://example.com/logo.png' } }]
    },
    {
      type: 'body',
      parameters: [{ type: 'text', text: 'Important Update' }]
    }
  ]
});
```

#### Sending SMS (`sendSMS`)

Dispatches SMS messages via MessageBird's REST API.

```javascript
const smsResponse = await messagebird.sendSMS({
  to: '+31 6 12345678',
  message: 'Your verification code is 456789.',
  originator: 'MYAPP'
});
```

#### Unsupported OTP Operations

MessageBird does not support built-in OTP methods (`sendOTP`, `verifyOTP`, `resendOTP`) in this phase. Invoking these methods throws `IntegrationError` with `code: 'UNSUPPORTED_OPERATION'` and `statusCode: 501`.

---

### Twilio Integration

`TwilioProvider` implements global SMS delivery, WhatsApp messaging, and two-factor authentication / OTP verification via Twilio Verify v2 REST APIs without requiring the heavyweight `twilio` SDK package. It uses Node.js native `fetch` and `node:crypto` with HMAC-SHA1 signature verification.

#### Environment Variables

```env
TWILIO_ACCOUNT_SID=AC_YourTwilioAccountSidHere
TWILIO_AUTH_TOKEN=YourTwilioAuthTokenHere
TWILIO_FROM=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MG_YourMessagingServiceSidHere
TWILIO_VERIFY_SERVICE_SID=VA_YourVerifyServiceSidHere
```

#### Provider Initialization

```javascript
import { createSMSProvider, TwilioProvider } from 'mern-integrations';

const twilio = createSMSProvider({
  provider: 'twilio',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID
});

// Or Direct Instantiation
const directTwilio = new TwilioProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: '+1234567890'
});
```

#### 1. Sending SMS (`sendSMS`)

Dispatches SMS messages via Twilio's Programmable Messaging API (`POST /2010-04-01/Accounts/{accountSid}/Messages.json`).

```javascript
// Using configured 'from' or passing explicit 'from'
const smsResult = await twilio.sendSMS({
  to: '+15551234567',
  message: 'Your order #1001 has been confirmed!'
});

// Using a Twilio Messaging Service SID
const pooledSms = await twilio.sendSMS({
  to: '+15551234567',
  message: 'Your parcel is out for delivery.',
  messagingServiceSid: 'MG_1234567890abcdef'
});
```

#### Normalized sendSMS Response:
```json
{
  "success": true,
  "provider": "twilio",
  "data": {
    "messageId": "SM_1234567890abcdef",
    "sid": "SM_1234567890abcdef",
    "to": "+15551234567",
    "from": "+1234567890",
    "status": "queued",
    "body": "Your order #1001 has been confirmed!",
    "raw": { /* Upstream Twilio Message object */ }
  }
}
```

#### 2. Delivering & Verifying OTPs via Twilio Verify v2 (`sendOTP` & `verifyOTP`)

Uses Twilio Verify v2 to automatically generate secure OTPs and manage token lifecycle without storing OTP secrets in your database.

```javascript
// 1. Dispatch OTP (Default channel: 'sms', also supports 'whatsapp', 'call', 'email')
const otpResult = await twilio.sendOTP({
  to: '+15551234567',
  channel: 'sms'
});

console.log('OTP verification SID:', otpResult.data.sid); // e.g. 'VE_...'

// 2. Verify User-Entered Code
const checkResult = await twilio.verifyOTP({
  to: '+15551234567',
  code: '456789'
});

if (checkResult.data.verified) {
  console.log('Phone number verified successfully!');
} else {
  console.log('Incorrect or expired code. Status:', checkResult.data.status); // 'pending'
}
```

#### Normalized verifyOTP Response:
```json
{
  "success": true,
  "provider": "twilio",
  "data": {
    "verified": true,
    "sid": "VE_1234567890abcdef",
    "to": "+15551234567",
    "status": "approved",
    "valid": true,
    "raw": { /* Upstream Twilio VerificationCheck object */ }
  }
}
```

#### 3. Sending WhatsApp Messages (`sendWhatsApp`)

Sends conversational or template messages over WhatsApp. Automatically prepends the required `whatsapp:` prefix if not already present.

```javascript
// Free-form message within active 24-hr session
const waResult = await twilio.sendWhatsApp({
  to: '+15551234567',
  message: 'Hello! How can we assist you with your order?'
});

// Pre-approved Twilio Content Template
const templateResult = await twilio.sendWhatsApp({
  to: '+15551234567',
  contentSid: 'HX_1234567890abcdef',
  contentVariables: { '1': 'John', '2': '1001' }
});
```

#### 4. Webhook Signature Verification (`verifyWebhook`)

Validates incoming status callbacks and inbound webhook requests using Twilio's official HMAC-SHA1 signature algorithm (`X-Twilio-Signature` header computed over the full URL and sorted POST parameters).

```javascript
app.post('/api/webhooks/twilio', express.urlencoded({ extended: false }), async (req, res) => {
  const signature = req.headers['x-twilio-signature'];
  const fullUrl = `https://${req.headers.host}${req.originalUrl}`;

  const result = await twilio.verifyWebhook({
    url: fullUrl,
    params: req.body, // Parsed POST form parameters
    signature
  });

  if (!result.data.verified) {
    return res.status(403).send('Invalid Twilio signature');
  }

  console.log('Message SID:', req.body.MessageSid, 'Status:', req.body.MessageStatus);
  res.status(200).send('<Response></Response>');
});
```

#### Security Notes
- `authToken` is encapsulated inside `#authToken` private class field and never leaks into `Object.keys()` or `JSON.stringify()`.
- Webhook signature validation uses `crypto.timingSafeEqual()` against constant-time comparison attacks.

---

## 9. Storage Providers

### Cloudinary Integration

`CloudinaryProvider` implements media and file asset storage operations using the official Cloudinary Node.js SDK.

#### Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Provider Initialization

```javascript
import { createStorageProvider } from 'mern-integrations';

const storage = createStorageProvider({
  provider: 'cloudinary',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET
});
```

#### Uploading Assets (`upload`)

Supports local file paths, remote URLs, and base64/data URIs with transformations and folder tagging.

```javascript
const uploadResult = await storage.upload({
  file: 'https://images.unsplash.com/photo-1575936123452-b67c3203c357',
  folder: 'products',
  publicId: 'product_101',
  tags: ['ecommerce', 'apparel'],
  transformation: [
    { width: 800, height: 600, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' }
  ]
});
```

#### Normalized Upload Response:
```json
{
  "success": true,
  "provider": "cloudinary",
  "data": {
    "publicId": "products/product_101",
    "secureUrl": "https://res.cloudinary.com/demo/image/upload/v1/products/product_101.jpg",
    "url": "http://res.cloudinary.com/demo/image/upload/v1/products/product_101.jpg",
    "resourceType": "image",
    "format": "jpg",
    "bytes": 45120,
    "width": 800,
    "height": 600,
    "createdAt": "2026-09-04T12:00:00Z",
    "raw": { /* Upstream Cloudinary API response */ }
  }
}
```

#### In-Memory Buffer Upload (`uploadBuffer`)

Uploads memory buffers (e.g. from Multer / Express file uploads) via upload streams without writing temporary files to disk.

```javascript
const bufferResult = await storage.uploadBuffer({
  buffer: req.file.buffer,
  folder: 'invoices',
  publicId: 'invoice_2026_09'
});
```

#### Generating Delivery URLs (`getUrl`)

Computes transformed public delivery URLs instantaneously without making network API calls.

```javascript
const urlResult = storage.getUrl({
  publicId: 'products/product_101',
  transformation: { width: 400, height: 300, crop: 'fill' },
  secure: true // Defaults to true (HTTPS)
});

console.log(urlResult.data.url);
```

#### Deleting Assets (`delete`)

Deletes assets by public ID with optional CDN cache invalidation.

```javascript
const deleteResult = await storage.delete({
  publicId: 'products/product_101',
  invalidate: true
});
```

---

### AWS S3 Integration

`S3Provider` implements object storage using the official AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`). It supports standard AWS S3 buckets as well as S3-compatible cloud storage providers (such as MinIO, Cloudflare R2, Wasabi, or DigitalOcean Spaces).

#### Environment Variables

```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=my-app-uploads
AWS_S3_ENDPOINT= # Optional for MinIO / Cloudflare R2
AWS_S3_FORCE_PATH_STYLE=false # Set to true for local MinIO / path-style S3
```

#### Provider Initialization

```javascript
import { createStorageProvider } from 'mern-integrations';

const s3 = createStorageProvider({
  provider: 's3',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET
});
```

#### Local File Upload (`upload`)

Uploads a local file to S3 with content type inference, metadata tagging, cache control, and folder prefixes.

```javascript
const fileResult = await s3.upload({
  file: './uploads/report.pdf',
  folder: 'reports/2026',
  contentType: 'application/pdf',
  metadata: { author: 'Finance Department' },
  cacheControl: 'max-age=3600'
});
```

#### Normalized S3 Response:
```json
{
  "success": true,
  "provider": "s3",
  "data": {
    "key": "reports/2026/report.pdf",
    "bucket": "my-app-uploads",
    "url": "https://my-app-uploads.s3.ap-south-1.amazonaws.com/reports/2026/report.pdf",
    "etag": "d41d8cd98f00b204e9800998ecf8427e",
    "versionId": null,
    "contentType": "application/pdf",
    "raw": { /* Upstream PutObjectCommand response */ }
  }
}
```

#### In-Memory Buffer Upload (`uploadBuffer`)

Uploads memory buffers without writing temporary files to disk.

```javascript
const bufferResult = await s3.uploadBuffer({
  buffer: req.file.buffer,
  key: 'user_avatar.png',
  folder: 'avatars',
  contentType: 'image/png'
});
```

#### Multipart Stream Upload (`uploadStream`)

Uploads large files via multipart streams using `@aws-sdk/lib-storage` without loading the entire stream into memory.

```javascript
import fs from 'fs';

const stream = fs.createReadStream('./large-video.mp4');
const streamResult = await s3.uploadStream({
  stream,
  key: 'demo.mp4',
  folder: 'videos',
  contentType: 'video/mp4'
});
```

#### URL Generation (`getUrl`)

Supports both standard public object URLs and time-limited pre-signed temporary URLs.

```javascript
// 1. Standard Public URL
const publicUrl = await s3.getUrl({
  key: 'reports/2026/report.pdf',
  signed: false
});

// 2. Pre-signed Temporary URL (Expires in 30 minutes)
const signedUrl = await s3.getUrl({
  key: 'reports/2026/report.pdf',
  signed: true,
  expiresIn: 1800
});

console.log(signedUrl.data.url);
```

#### Deleting Objects (`delete`)

Deletes an object from the S3 bucket by key.

```javascript
const deleteResult = await s3.delete({
  key: 'reports/2026/report.pdf'
});
```

---

## 10. Enterprise Middlewares

Enterprise-grade MERN backends handling money, sensitive customer communications, and webhooks require robust protection against duplicate transactions and inconsistent provider webhook formats. `mern-integrations` provides two production-grade, zero-dependency middlewares designed specifically for Express applications.

### Idempotency Key Middleware

Network timeouts, user double-clicks, and mobile connection retries frequently cause duplicate POST/PUT/PATCH mutations. The idempotency middleware prevents duplicate operations by verifying the client's `Idempotency-Key` HTTP header.

#### How It Works:
1. **Concurrency Lock (`409 Conflict`)**: When a request with an `Idempotency-Key` begins execution, an in-flight lock is acquired. If a concurrent duplicate request arrives while the first is still processing, it is immediately rejected with HTTP `409 Conflict`.
2. **Deterministic Payload Fingerprinting (`422 Unprocessable Entity`)**: The middleware computes a SHA-256 hash of the HTTP method, URL path, and request body. If a subsequent request reuses an `Idempotency-Key` but changes the payload, it is rejected with HTTP `422 Unprocessable Entity` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
3. **Response Caching & Instant Replay (`Idempotent-Replayed: true`)**: Once the handler completes with a 2xx or 4xx status code, the response status, headers, and body are cached in the store. Subsequent identical requests receive the cached response immediately with the header `Idempotent-Replayed: true` without re-executing your database mutations or gateway calls.
4. **Transient Error Eviction**: If your route handler fails with a 5xx server error, the lock is automatically evicted from the store so clients can safely retry.
5. **Zero-Dependency LRU + TTL In-Memory Store**: Includes `InMemoryIdempotencyStore` featuring automatic Least-Recently-Used eviction when max capacity is reached, per-key TTL expiration, and automatic background cleanup timers. Supports custom Redis or database stores conforming to the simple store interface (`get`, `set`, `delete`).

#### Usage in Express:

```javascript
import express from 'express';
import { idempotencyMiddleware, createIdempotencyMiddleware, InMemoryIdempotencyStore } from 'mern-integrations/middleware';
// or from root: import { idempotencyMiddleware } from 'mern-integrations';

const app = express();
app.use(express.json());

// Option A: Use the default global middleware (default in-memory store, 24h TTL)
app.post('/api/checkout/orders', idempotencyMiddleware(), async (req, res) => {
  const { amount, customerId } = req.body;
  // This controller code executes only ONCE per Idempotency-Key
  const order = await paymentService.charge({ amount, customerId });
  res.status(201).json(order);
});

// Option B: Custom configured middleware (e.g. 5-minute TTL, custom store)
const customStore = new InMemoryIdempotencyStore({
  maxEntries: 10000,
  defaultTtlMs: 5 * 60 * 1000 // 5 minutes
});

const checkoutIdempotency = createIdempotencyMiddleware({
  store: customStore,
  headerName: 'idempotency-key', // Header is matched case-insensitively
  required: false,               // Allow non-idempotent requests if header omitted
  ttlMs: 300000,                 // 5 minutes
  lockTimeoutMs: 30000           // In-flight lock expiry
});

app.post('/api/payments/charge', checkoutIdempotency, async (req, res) => {
  // ...
});
```

#### Custom Store Interface (e.g. Redis / MongoDB):

You can easily supply your own distributed store (such as Redis or MongoDB) by implementing 3 simple asynchronous methods:

```javascript
const redisIdempotencyStore = {
  async get(key) {
    const raw = await redisClient.get(`idempotency:${key}`);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, entry, ttlMs) {
    await redisClient.set(`idempotency:${key}`, JSON.stringify(entry), 'PX', ttlMs);
  },
  async delete(key) {
    await redisClient.del(`idempotency:${key}`);
  }
};

app.use(createIdempotencyMiddleware({ store: redisIdempotencyStore }));
```

---

### Unified Webhook Event Normalizer

Payment gateways, SMS aggregators, and email delivery networks each emit radically different webhook schemas (e.g. Stripe uses `event.type` + `event.data.object`, Razorpay uses `event.event` + `event.payload.payment.entity`, PhonePe uses Base64 encoded payloads, Twilio uses urlencoded form bodies).

The **Unified Webhook Event Normalizer** translates payloads from all supported providers into a single, predictable canonical schema: `UnifiedWebhookEvent`.

#### Canonical Webhook Event Schema:

```typescript
interface UnifiedWebhookEvent {
  id: string;              // Standardized event ID or transaction identifier
  provider: string;        // 'stripe' | 'razorpay' | 'phonepe' | 'twilio' | 'msg91' | 'resend' | 'custom'
  type: string;            // Standardized event type (e.g. 'payment.succeeded', 'refund.processed', 'sms.delivered')
  originalType: string;    // Raw event name sent by the provider (e.g. 'payment_intent.succeeded')
  timestamp: string;       // ISO 8601 UTC timestamp
  resourceId: string;      // Gateway transaction/resource ID (e.g. 'pi_123', 'pay_abc', 'SMxxxxxx')
  status: string;          // Normalized status ('succeeded' | 'failed' | 'pending' | 'delivered' | 'refunded' | ...)
  amount: number | null;   // Standardized smallest currency unit (paise / cents) if applicable
  currency: string | null; // ISO currency code ('INR', 'USD') or null
  data: Record<string, any>; // Normalized entity object
  raw: any;                // Complete raw unmodified event payload
}
```

#### Standardized Event Mappings:

| Provider | Gateway Event | Canonical Event Type (`type`) | Normalized Status |
|---|---|---|---|
| **Stripe** | `payment_intent.succeeded` | `payment.succeeded` | `succeeded` |
| **Stripe** | `payment_intent.payment_failed` | `payment.failed` | `failed` |
| **Stripe** | `charge.refunded` | `refund.processed` | `refunded` |
| **Razorpay** | `payment.captured` | `payment.succeeded` | `succeeded` |
| **Razorpay** | `payment.failed` | `payment.failed` | `failed` |
| **Razorpay** | `refund.processed` | `refund.processed` | `refunded` |
| **PhonePe** | `PAYMENT_SUCCESS` | `payment.succeeded` | `succeeded` |
| **PhonePe** | `PAYMENT_ERROR` | `payment.failed` | `failed` |
| **Twilio** | `delivered` | `sms.delivered` | `delivered` |
| **Twilio** | `failed` / `undelivered` | `sms.failed` | `failed` |
| **MSG91** | `1` (Delivered) | `sms.delivered` | `delivered` |
| **MSG91** | `2` (Failed) | `sms.failed` | `failed` |
| **Resend** | `email.delivered` | `email.delivered` | `delivered` |
| **Resend** | `email.bounced` | `email.bounced` | `bounced` |

#### Pure Function Normalization (`normalizeWebhookEvent`):

Use the pure function anywhere in your app, cloud functions, or queue workers:

```javascript
import { normalizeWebhookEvent } from 'mern-integrations';

const canonicalEvent = normalizeWebhookEvent({
  provider: 'stripe',
  payload: stripePayload
});

console.log(canonicalEvent.type);       // 'payment.succeeded'
console.log(canonicalEvent.resourceId); // 'pi_3MtwBwLkdIwHu7ix28a3tqPa'
console.log(canonicalEvent.amount);     // 2000
```

#### Express Webhook Route with Automatic Signature Verification:

The `webhookNormalizerMiddleware` automatically verifies the cryptographic signature (using your provider instance) and attaches `req.webhookEvent` to the Express request object:

```javascript
import express from 'express';
import { 
  rawBodyMiddleware, 
  createWebhookNormalizer, 
  createPaymentProvider 
} from 'mern-integrations';

const app = express();
const razorpay = createPaymentProvider({ provider: 'razorpay' });

// Setup webhook route with raw body capture and unified normalizer:
app.post(
  '/api/webhooks/razorpay',
  rawBodyMiddleware(),
  createWebhookNormalizer({
    provider: 'razorpay',
    providerInstance: razorpay,
    verifySignature: true, // Automatically verifies x-razorpay-signature header
    signatureHeader: 'x-razorpay-signature'
  }),
  async (req, res) => {
    // req.webhookEvent contains the verified, normalized canonical event
    const event = req.webhookEvent;
    console.log(`[Webhook] Provider: ${event.provider}, Type: ${event.type}, ID: ${event.resourceId}`);

    switch (event.type) {
      case 'payment.succeeded':
        await orderService.markPaid(event.resourceId, event.amount);
        break;
      case 'payment.failed':
        await orderService.markFailed(event.resourceId);
        break;
      case 'refund.processed':
        await orderService.recordRefund(event.resourceId, event.amount);
        break;
    }

    res.status(200).json({ status: 'ok' });
  }
);
```

---

## 11. Error Handling & Capability Introspection

### Structured Error Classes

All public methods throw structured, strongly-typed errors inheriting from either `ValidationError` or `IntegrationError`:

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  const result = await payment.createOrder({
    amount: 50000,
    currency: 'INR'
  });
} catch (error) {
  if (error instanceof ValidationError) {
    // Client input validation failed before dispatching network requests
    console.error('Validation Error:', error.message, error.details);
  } else if (error instanceof IntegrationError) {
    // Gateway, authentication, or missing dependency error
    console.error(`Integration Error [${error.code}] (HTTP ${error.statusCode}):`, error.message);
    console.error('Provider:', error.provider);
  } else {
    // Unexpected system error
    console.error('Unexpected error:', error);
  }
}
```

### Standard Error Codes & Failure Categories

The library clearly distinguishes between 3 failure categories:

| Failure Category | Example Scenario | Thrown Error Class | Error Code | HTTP Status |
|---|---|---|---|---|
| **A. Unsupported Provider** | `createPaymentProvider({ provider: 'paypal' })` | `IntegrationError` | `UNSUPPORTED_PROVIDER` | `400` |
| **B. Missing Optional SDK** | Calling `stripe.createOrder()` without `npm install stripe` | `IntegrationError` | `MISSING_PROVIDER_DEPENDENCY` | `500` |
| **C. Input Validation** | Missing `amount` or negative integer | `ValidationError` | `VALIDATION_ERROR` | `400` |
| **C. Gateway Auth Failure** | Invalid API keys or secret tokens | `IntegrationError` | `AUTHENTICATION_ERROR` | `401` / `403` |
| **C. Rate Limit Exceeded** | Provider rate limit hit | `IntegrationError` | `RATE_LIMIT_EXCEEDED` | `429` |
| **C. Unsupported Method** | Calling `mb.sendOTP()` (unsupported on MessageBird) | `IntegrationError` | `UNSUPPORTED_OPERATION` | `501` |
| **C. Upstream Provider Failure** | Provider returned 502/503/timeout | `IntegrationError` | `PROVIDER_ERROR` | `500` / `502` / `504` |

### Provider Capabilities Contract

All concrete provider instances expose an immutable, read-only `capabilities` getter returning an array of supported operation names:

```javascript
import { createPaymentProvider } from 'mern-integrations';

const payment = createPaymentProvider({
  provider: 'razorpay',
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET
});

// Check whether optional operations are supported before invoking:
if (payment.capabilities.includes('refund')) {
  const refundResult = await payment.refund({
    paymentId: 'pay_12345',
    amount: 1000
  });
} else {
  console.log(`Provider '${payment.name}' does not support automated refunds.`);
}
```

### Webhook Raw Body Security Notice & Middleware

> **Security Warning:** Cryptographic webhook verification (for Stripe and Razorpay) requires the **exact, unmodified raw request body string or Buffer** (`req.rawBody` or `req.body`).
> Parsing the body with standard JSON middleware (`express.json()`) mutates whitespace and key order, causing HMAC signature verification to fail. 

`mern-integrations` exports a built-in `rawBodyMiddleware()` helper for Express applications:

```javascript
import express from 'express';
import { rawBodyMiddleware, createPaymentProvider } from 'mern-integrations';

const app = express();
const stripe = createPaymentProvider({ provider: 'stripe' });

// Use rawBodyMiddleware to automatically capture req.rawBody Buffer while maintaining req.body
app.post('/api/webhooks/stripe', rawBodyMiddleware(), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const result = await stripe.verifyWebhookSignature(req.rawBody, sig);
  
  if (result.data?.verified || result === true) {
    res.json({ received: true });
  } else {
    res.status(400).send('Invalid signature');
  }
});
```

### Network Resiliency & Exponential Backoff (`withRetry`)

To handle transient network glitches, 5xx server errors, or 429 rate limit errors from third-party APIs, use `withRetry`:

```javascript
import { withRetry, createEmailProvider } from 'mern-integrations';

const email = createEmailProvider({ provider: 'resend' });

// Executes with automatic exponential backoff (up to 3 retries)
const response = await withRetry(
  () => email.sendEmail({ to: 'user@example.com', subject: 'Welcome!', html: '<h1>Welcome</h1>' }),
  { retries: 3, minTimeout: 300, maxTimeout: 2000 }
);
```

---

## 12. Example Scripts

Complete, runnable examples are organized under the [`examples/`](./examples) directory. See [`examples/README.md`](./examples/README.md) for environment variables and full instructions.

```bash
# Payments
npm run example:razorpay
npm run example:cashfree
npm run example:stripe
npm run example:ccavenue
npm run example:phonepe

# Email
npm run example:resend
npm run example:nodemailer
npm run example:ses

# SMS / WhatsApp
npm run example:msg91
npm run example:messagebird
npm run example:twilio

# Storage
npm run example:cloudinary
npm run example:s3

# Middlewares
npm run example:idempotency
npm run example:webhook-normalizer
```

---

## 13. Testing & Test Coverage

The test suite uses **Jest** with native ES Module support. All external provider SDKs, network transports, and cloud services are 100% mocked with zero live network calls:

```bash
# Run all unit tests
npm test

# Run tests with code coverage analysis & threshold enforcement
npm run test:coverage

# Run tests in interactive watch mode
npm run test:watch
```

### Coverage Quality Gates

| Metric | Configured Threshold | Baseline Achievement |
|---|---|---|
| **Statements** | `>= 90%` | `~92.9%` |
| **Branches** | `>= 75%` | `~79.8%` |
| **Functions** | `>= 90%` | `~92.3%` |
| **Lines** | `>= 90%` | `~92.9%` |

---

## 14. CI/CD & Quality Gates

The repository includes a GitHub Actions Continuous Integration pipeline located at `.github/workflows/ci.yml`.

### Pipeline Stages:
1. **Node.js LTS Matrix**: Tests across `18.x`, `20.x`, and `22.x`.
2. **Clean Install**: Executes `npm ci` leveraging npm cache.
3. **Unit Tests**: Runs `npm test` across all provider test suites.
4. **Coverage Enforcement**: Executes `npm run test:coverage` and validates thresholds.
5. **Security Audit**: Runs `npm audit --audit-level=high`.
6. **Package Verification**: Validates tarball packaging with `npm pack --dry-run`.

---

## 15. Development & Packaging Workflow

### Pre-Publication Packaging Verification

To verify package contents before any future release without publishing:

```bash
npm pack --dry-run
```

This verifies that only runtime files (`src/`), `README.md`, and `LICENSE` are bundled, while sensitive development artifacts (`.env*`, `tests/`, `coverage/`, `examples/`) are completely excluded.

### Local Integration in a MERN Application

To integrate `mern-integrations` into your local Express/MERN backend service:

```bash
# In your backend service project root:
npm install /path/to/mern-integrations
# or using npm link:
cd /path/to/mern-integrations && npm link
cd /path/to/your-mern-backend && npm link mern-integrations
```

---

## 16. Developer Onboarding Guide

### Getting Started

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/MuttuKarani/mern-integrations.git
   cd mern-integrations
   ```

2. **Install Development Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Full Test Suite:**
   ```bash
   npm test
   ```

4. **Verify Test Coverage:**
   ```bash
   npm run test:coverage
   ```

5. **Run Security Audit:**
   ```bash
   npm audit
   ```

6. **Run Example Scripts:**
   ```bash
   npm run example:razorpay
   npm run example:resend
   ```

### Adding a New Provider

To add a new integration provider (e.g., a new payment gateway or SMS service), follow this systematic architectural workflow:

1. **Extend Domain Base Class**:
   - Create a new provider class extending `PaymentProvider`, `EmailProvider`, `SMSProvider`, or `StorageProvider`.
   - Implement the `capabilities` getter returning an immutable array of supported method names.

2. **Implement Private Credential Encapsulation**:
   - Use private class fields (`#apiKey`, `#secretKey`) to guarantee secrets are never leaked via `Object.keys()` or `JSON.stringify()`.

3. **Implement Safe Lazy Loading**:
   - Do NOT use top-level static imports for third-party SDKs.
   - Use `loadOptionalDependency(packageName, providerName, this.#loader)` to dynamically load SDKs only when operations are invoked.

4. **Normalize Responses & Handle Errors**:
   - Return responses wrapped in `this.normalizeSuccess(data)`.
   - Normalize upstream exceptions into `IntegrationError` instances with appropriate `code` and `statusCode`. Redact credentials from error messages.

5. **Register in Factory**:
   - Update the respective factory (`PaymentFactory`, `EmailFactory`, etc.) to recognize the provider name and aliases case-insensitively with whitespace trimming.

6. **Export in Submodule & Root**:
   - Export the new provider class in `src/<domain>/index.js` and `src/index.js`.

7. **Add Comprehensive Mocked Unit Tests**:
   - Add unit tests under `tests/<domain>/<provider>.test.js`. Mock all external SDK calls and verify credential redaction.

8. **Add Example Script & Documentation**:
   - Add an example in `examples/<domain>/<provider>.example.js` and document it in `examples/README.md` and `README.md`.
