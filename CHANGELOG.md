# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-04

### Added
- **Core Architecture**:
  - Native Node.js ECMAScript Module (ESM) architecture with `"type": "module"`.
  - Zero required runtime external dependencies (`dependencies: {}`).
  - Optional peer dependency loading system (`loadOptionalDependency`) allowing consumers to install only the SDKs they use.
  - Standardized error hierarchy with `IntegrationError` and `ValidationError`.
  - Immutable provider capabilities introspection (`provider.capabilities`) across all domain providers.
  - Comprehensive input validators with helpful error messages.

- **Payments Domain (`mern-integrations/payments`)**:
  - `RazorpayProvider`: Order creation with paise integer conversions, cryptographic HMAC SHA-256 signature verification, webhook verification, and refund management.
  - `StripeProvider`: PaymentIntents order workflow, client secret handling, webhook signature verification, and refunds.
  - `CCAvenueProvider`: Zero-SDK integration using native Node.js crypto for AES-128-CBC query string encryption/decryption and redirect descriptor formulation.
  - `PaymentFactory` (`createPaymentProvider`): Unified factory supporting case-insensitive matching and strict validation.

- **Email Domain (`mern-integrations/email`)**:
  - `ResendProvider`: Transactional HTML/text email delivery with custom tags support.
  - `NodemailerProvider`: Full SMTP transport support, connection verification (`verify`), and attachments.
  - `SESProvider`: AWS SES v3 transactional email sending with optional Configuration Sets.
  - `EmailFactory` (`createEmailProvider`): Unified factory with input validation.

- **SMS & Messaging Domain (`mern-integrations/sms`)**:
  - `MSG91Provider`: Zero-SDK Flow SMS sending, OTP generation, verification, and resend.
  - `MessageBirdProvider`: Zero-SDK REST SMS delivery and WhatsApp HSM template messaging.
  - `SMSFactory` (`createSMSProvider`): Unified factory with validation.

- **Storage Domain (`mern-integrations/storage`)**:
  - `CloudinaryProvider`: Buffer and file uploads, transformed secure URL generation, and asset deletion.
  - `S3Provider`: AWS S3 v3 PutObject, multipart stream upload, pre-signed temporary URL generation, and deletion.
  - `StorageFactory` (`createStorageProvider`): Unified factory with validation.

- **Developer Experience & Quality**:
  - Subpath exports: `.` (root), `./payments`, `./email`, `./sms`, `./storage`.
  - Domain-categorized runnable example scripts under `examples/`.
  - Comprehensive documentation, developer onboarding guide, and PR template.
  - Automated CI matrix validating Node.js 18.x, 20.x, and 22.x with strict code coverage quality gates ($\ge 90\%$ Statements/Functions/Lines, $\ge 75\%$ Branches).
