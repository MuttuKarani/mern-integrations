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
  - [Razorpay Integration](#razorpay-integration)
  - [CCAvenue Integration](#ccavenue-integration)
  - [Stripe Integration](#stripe-integration)
- [7. Email Providers](#7-email-providers)
  - [Resend Integration](#resend-integration)
  - [Nodemailer SMTP Integration](#nodemailer-smtp-integration)
  - [Amazon SES Integration](#amazon-ses-integration)
- [8. SMS & OTP Providers](#8-sms--otp-providers)
  - [MSG91 Integration](#msg91-integration)
  - [MessageBird Integration](#messagebird-integration)
- [9. Storage Providers](#9-storage-providers)
  - [Cloudinary Integration](#cloudinary-integration)
  - [AWS S3 Integration](#aws-s3-integration)
- [10. Error Handling & Response Normalization](#10-error-handling--response-normalization)
- [11. Example Scripts](#11-example-scripts)
- [12. Testing & Test Coverage](#12-testing--test-coverage)
- [13. CI/CD & Quality Gates](#13-cicd--quality-gates)
- [14. Development & Packaging Workflow](#14-development--packaging-workflow)

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
│   │   │   ├── ccavenue/
│   │   │   │   ├── CCAvenueProvider.js   # CCAvenue redirect & callback implementation
│   │   │   │   └── ccavenue.crypto.js    # Official AES-128-CBC crypto helpers
│   │   │   └── stripe/
│   │   │       └── StripeProvider.js     # Stripe SDK PaymentIntents implementation
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
│   │   │   └── messagebird/
│   │   │       └── MessageBirdProvider.js# MessageBird WhatsApp & SMS implementation
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
│   └── index.js                          # Root package entry point
│
├── examples/
│   ├── razorpay-example.js               # Razorpay usage example
│   ├── ccavenue-example.js               # CCAvenue usage example
│   ├── stripe-example.js                 # Stripe usage example
│   ├── resend-example.js                 # Resend usage example
│   ├── nodemailer-example.js             # Nodemailer usage example
│   ├── ses-example.js                    # Amazon SES usage example
│   ├── msg91-example.js                  # MSG91 SMS & OTP usage example
│   ├── messagebird-example.js            # MessageBird SMS & WhatsApp example
│   ├── cloudinary-example.js             # Cloudinary storage usage example
│   └── s3-example.js                     # AWS S3 storage usage example
│
├── tests/
│   ├── index.test.js                     # Root exports and submodule tests
│   ├── payments/
│   │   ├── razorpay.test.js              # Razorpay unit tests with SDK mocks
│   │   ├── ccavenue.test.js              # CCAvenue unit tests with crypto vectors
│   │   └── stripe.test.js                # Stripe unit tests with SDK mocks
│   ├── email/
│   │   ├── resend.test.js                # Resend unit tests with SDK mocks
│   │   ├── nodemailer.test.js            # Nodemailer unit tests with mocks
│   │   └── ses.test.js                   # Amazon SES unit tests with SDK mocks
│   ├── sms/
│   │   ├── msg91.test.js                 # MSG91 unit tests with mock transport
│   │   └── messagebird.test.js           # MessageBird unit tests with mocks
│   └── storage/
│       ├── cloudinary.test.js            # Cloudinary unit tests with mocks
│       └── s3.test.js                    # AWS S3 unit tests with mocks
│
├── .env.example
├── .gitignore
├── LICENSE
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

# Stripe Credentials
STRIPE_SECRET_KEY=sk_test_YourStripeSecretKeyHere
STRIPE_WEBHOOK_SECRET=whsec_YourWebhookSecretHere

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

## 10. Error Handling & Response Normalization

All public methods throw structured errors inheriting from `IntegrationError` or `ValidationError`:

```javascript
import { IntegrationError, ValidationError } from 'mern-integrations';

try {
  await storage.upload({ file: '' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.toJSON());
  } else if (error instanceof IntegrationError) {
    console.error('Provider error:', error.toJSON());
  }
}
```

---

## 11. Example Scripts

Run the standalone example scripts:

```bash
# Run Razorpay payment example
npm run example:razorpay

# Run CCAvenue payment example
npm run example:ccavenue

# Run Stripe payment example
npm run example:stripe

# Run Resend email example
npm run example:resend

# Run Nodemailer SMTP email example
npm run example:nodemailer

# Run Amazon SES email example
npm run example:ses

# Run MSG91 SMS & OTP example
npm run example:msg91

# Run MessageBird WhatsApp & SMS example
npm run example:messagebird

# Run Cloudinary storage example
npm run example:cloudinary

# Run AWS S3 storage example
npm run example:s3
```

---

## 12. Testing & Test Coverage

The test suite uses **Jest** with experimental ES Module support. All gateway SDKs, network transports, and AWS/Cloudinary APIs are 100% mocked with verified cryptographic reference test vectors to ensure deterministic, zero-network-leak test execution.

```bash
# Run all unit tests
npm test

# Run tests with code coverage analysis & threshold enforcement
npm run test:coverage

# Run tests in interactive watch mode
npm run test:watch
```

### Coverage Quality Gates

Jest is configured with strict coverage thresholds to guard against quality regressions:

| Metric | Configured Threshold | Baseline Achievement |
|---|---|---|
| **Statements** | `>= 90%` | `~95.5%` |
| **Branches** | `>= 75%` | `~80.9%` |
| **Functions** | `>= 90%` | `~95.5%` |
| **Lines** | `>= 90%` | `~95.5%` |

> **Note on Branch Coverage:** Branch coverage threshold is set to 75% to account for abstract interface base classes (which contain defensive guard branches and intentional runtime throw methods) and provider fallback status code handling.

Coverage reports are generated in multiple formats under the `coverage/` directory:
- `text` & `text-summary`: Console output during test runs
- `lcov` (`lcov-report/index.html`): Detailed browser-viewable visual report
- `json-summary`: Machine-readable summary for CI integration

---

## 13. CI/CD & Quality Gates

The repository includes a GitHub Actions Continuous Integration workflow located at `.github/workflows/ci.yml`.

### Workflow Pipeline:
1. **Triggering Events**: Triggers on `push` to `master`, `main`, `ci-quality`, feature/fix branches, and on `pull_request` targeting `master` or `main`.
2. **Node.js LTS Matrix**: Tests across supported Node.js LTS versions (`18.x`, `20.x`, `22.x`).
3. **Clean Dependency Installation**: Executes `npm ci` leveraging npm caching.
4. **Unit Test Execution**: Runs `npm test` across all provider suites.
5. **Coverage Quality Gate**: Executes `npm run test:coverage` and fails the pipeline if thresholds are not met.
6. **Security Vulnerability Audit**: Runs `npm audit --audit-level=high`.
7. **Package Packaging Validation**: Verifies tarball packing via `npm pack --dry-run`.

---

## 14. Development & Packaging Workflow

### Pre-Publication Packaging Verification

To verify package contents before any future release without publishing:

```bash
npm pack --dry-run
```

This verifies that only runtime files (`src/`), `README.md`, and `LICENSE` are bundled, while sensitive development artifacts (`.env*`, `tests/`, `coverage/`, `examples/`) are completely excluded.

### Local Integration in a MERN Application

To integrate `mern-integrations` into your local Express/MERN backend service prior to public registry publication:

```bash
# In your backend service project root:
npm install /path/to/mern-integrations
# or using npm link:
cd /path/to/mern-integrations && npm link
cd /path/to/your-mern-backend && npm link mern-integrations
```
