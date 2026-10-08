# `mern-integrations` Examples

This directory provides simple, realistic, and production-ready examples demonstrating how to use each provider integration in MERN and Node.js backend applications.

---

## Architecture & Optional Dependencies

`mern-integrations` uses an **optional peer dependency and safe lazy-loading architecture**. You only install the external SDKs needed for the providers you use in your application.

### Dependency & Environment Variable Matrix

| Domain | Provider | Example Script | Required External SDK(s) | Key Environment Variables |
|---|---|---|---|---|
| **Payments** | **Razorpay** | [`payments/razorpay.example.js`](./payments/razorpay.example.js) | `npm install razorpay` | `RAZORPAY_KEY_ID`<br>`RAZORPAY_KEY_SECRET`<br>`RAZORPAY_WEBHOOK_SECRET` |
| | **Stripe** | [`payments/stripe.example.js`](./payments/stripe.example.js) | `npm install stripe` | `STRIPE_SECRET_KEY`<br>`STRIPE_WEBHOOK_SECRET` |
| | **CCAvenue** | [`payments/ccavenue.example.js`](./payments/ccavenue.example.js) | *None* (uses `node:crypto`) | `CCAVENUE_MERCHANT_ID`<br>`CCAVENUE_ACCESS_CODE`<br>`CCAVENUE_WORKING_KEY` |
| | **PhonePe** | [`payments/phonepe.example.js`](./payments/phonepe.example.js) | *None* (uses `fetch` & `node:crypto`) | `PHONEPE_MERCHANT_ID`<br>`PHONEPE_SALT_KEY`<br>`PHONEPE_CALLBACK_URL` |
| **Email** | **Resend** | [`email/resend.example.js`](./email/resend.example.js) | `npm install resend` | `RESEND_API_KEY` |
| | **Nodemailer** | [`email/nodemailer.example.js`](./email/nodemailer.example.js) | `npm install nodemailer` | `SMTP_HOST`, `SMTP_PORT`<br>`SMTP_USER`, `SMTP_PASS` |
| | **Amazon SES** | [`email/ses.example.js`](./email/ses.example.js) | `npm install @aws-sdk/client-ses` | `AWS_ACCESS_KEY_ID`<br>`AWS_SECRET_ACCESS_KEY`<br>`AWS_REGION` |
| **SMS** | **MSG91** | [`sms/msg91.example.js`](./sms/msg91.example.js) | *None* (uses native `fetch`) | `MSG91_AUTH_KEY`<br>`MSG91_SENDER_ID`<br>`MSG91_TEMPLATE_ID` |
| | **MessageBird** | [`sms/messagebird.example.js`](./sms/messagebird.example.js) | *None* (uses native `fetch`) | `MESSAGEBIRD_API_KEY`<br>`MESSAGEBIRD_ORIGINATOR` |
| | **Twilio** | [`sms/twilio.example.js`](./sms/twilio.example.js) | *None* (uses native `fetch` & `node:crypto`) | `TWILIO_ACCOUNT_SID`<br>`TWILIO_AUTH_TOKEN`<br>`TWILIO_FROM` |
| **Storage** | **Cloudinary** | [`storage/cloudinary.example.js`](./storage/cloudinary.example.js) | `npm install cloudinary` | `CLOUDINARY_CLOUD_NAME`<br>`CLOUDINARY_API_KEY`<br>`CLOUDINARY_API_SECRET` |
| | **AWS S3** | [`storage/s3.example.js`](./storage/s3.example.js) | `npm install @aws-sdk/client-s3`<br>`@aws-sdk/lib-storage`<br>`@aws-sdk/s3-request-presigner` | `AWS_ACCESS_KEY_ID`<br>`AWS_SECRET_ACCESS_KEY`<br>`AWS_REGION`<br>`AWS_S3_BUCKET` |
| **Middleware** | **Idempotency** | [`middleware/idempotency.example.js`](./middleware/idempotency.example.js) | *None* (uses `node:crypto`) | *None* (in-memory LRU store) |
| | **Webhook Normalizer** | [`middleware/webhook-normalizer.example.js`](./middleware/webhook-normalizer.example.js) | *None* (pure function & Express middleware) | Optional provider secrets for verification |

---

## Directory Structure

```
examples/
├── README.md                           # This guide
├── payments/
│   ├── razorpay.example.js             # Order creation, HMAC verification & webhooks
│   ├── cashfree.example.js             # Order session generation, status verification & webhooks
│   ├── stripe.example.js               # PaymentIntents, verification, refunds
│   ├── ccavenue.example.js             # AES-128-CBC redirect descriptors & callbacks
│   └── phonepe.example.js              # Standard checkout redirect & webhook verification
├── email/
│   ├── resend.example.js               # Modern transactional email with tags
│   ├── nodemailer.example.js           # Custom SMTP transport, verification & attachments
│   └── ses.example.js                  # Amazon SES v3 email with configuration sets
├── sms/
│   ├── msg91.example.js                # Flow SMS, OTP generation, verification & resend
│   ├── messagebird.example.js          # Global SMS & WhatsApp HSM template messaging
│   └── twilio.example.js               # Twilio SMS, WhatsApp & Verify OTP
├── storage/
│   ├── cloudinary.example.js           # Buffer uploads, transformations & asset deletion
│   └── s3.example.js                   # S3 buffer upload, public & signed URLs
└── middleware/
    ├── idempotency.example.js          # In-flight concurrency lock & response replay demo
    └── webhook-normalizer.example.js   # Multi-provider webhook canonical normalization demo
```

---

## How to Run the Examples

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in the repository root and populate the keys for the providers you wish to test:

```bash
cp .env.example .env
```

> **Security Warning:** Never commit `.env` or real credentials to source control. The `.env` file is excluded via `.gitignore`.

### 2. Run via NPM Scripts

You can execute any example using convenience npm scripts:

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

### 3. Run Directly with Node.js

Alternatively, run any script directly using Node.js:

```bash
node examples/payments/razorpay.example.js
node examples/middleware/idempotency.example.js
```

---

## Best Practices Demonstrated in Examples

1. **Introspect Provider Capabilities**: Check `provider.capabilities.includes('refund')` before calling optional operations to guarantee compatibility across switching providers.
2. **Handle Domain Errors Accurately**: Separate client input mistakes (`ValidationError`) from external gateway failures (`IntegrationError`).
3. **Use Sub-units for Monetary Amounts**: Razorpay (paise), Stripe (cents), and CCAvenue (paise) all require amounts in smallest currency units (integers).
4. **Preserve Raw Request Bodies for Webhooks**: Webhook verification for Stripe and Razorpay cryptographically computes hashes on the raw HTTP payload string or Buffer (`req.body` before JSON parsing).
