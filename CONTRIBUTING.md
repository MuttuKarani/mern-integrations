# Contributing to mern-integrations

Thank you for your interest in contributing to `mern-integrations`! This guide explains how to set up your development environment, run tests, adhere to project standards, and submit pull requests.

---

## 1. Architectural Principles

Before making changes, please understand the core architectural rules of this library:

1. **Native ECMAScript Modules (ESM)**: The package is 100% native ESM (`"type": "module"`). Use standard `import` and `export` statements with full file extensions (e.g. `import ... from './validators.js'`).
2. **Zero Required Runtime Dependencies**: The core package has **zero** external runtime dependencies. All third-party provider SDKs (such as `stripe`, `razorpay`, `resend`, `@aws-sdk/*`, `cloudinary`, `nodemailer`) are optional peer dependencies loaded lazily via dynamic `import()`.
3. **Node.js Compatibility**: Supports Node.js `>=18.0.0`.
4. **Defensive Validation & Secure Defaults**: All user inputs must be strictly validated with `ValidationError`. Secrets and credentials must be stored privately and never leaked into error messages, stack traces, logs, or normalized output.
5. **Standardized Error Architecture**: Use `ValidationError` (400) for input errors and `IntegrationError` with standard codes (`UNSUPPORTED_PROVIDER`, `MISSING_PROVIDER_DEPENDENCY`, `UNSUPPORTED_OPERATION`, `AUTHENTICATION_ERROR`, `PROVIDER_ERROR`) for runtime provider issues.

---

## 2. Getting Started

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`
- **Git**

### Setup
```bash
# 1. Fork and clone repository
git clone https://github.com/MuttuKarani/mern-integrations.git
cd mern-integrations

# 2. Install all development dependencies (includes mock SDKs for testing)
npm install
```

---

## 3. Development & Testing Workflow

### Running Tests
All tests are located under `tests/` and use Jest in ESM mode:
```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Coverage Enforcement
Coverage thresholds are strictly enforced via Jest:
```bash
npm run test:coverage
```
Repository Minimum Thresholds:
- **Statements**: $\ge 90\%$
- **Branches**: $\ge 75\%$
- **Functions**: $\ge 90\%$
- **Lines**: $\ge 90\%$

### Running Examples
```bash
# Test provider example scripts locally
npm run example:razorpay
npm run example:stripe
npm run example:resend
npm run example:s3
```

---

## 4. Pre-Submission Quality Gates

Before opening a pull request, run all quality checks locally:

```bash
# 1. Run all unit tests
npm test

# 2. Verify test coverage thresholds
npm run test:coverage

# 3. Check for security vulnerabilities
npm audit

# 4. Verify distribution package contents
npm pack --dry-run

# 5. Check for whitespace/formatting errors
git diff --check
```

---

## 5. Adding a New Provider Checklist

When contributing a new provider integration, follow this checklist:

1. **Domain Interface**: Implement the provider class extending the domain's abstract base class (`PaymentProvider`, `EmailProvider`, `SMSProvider`, `StorageProvider`).
2. **Dynamic Dependency Loading**: Use `safeImport('<sdk-package-name>', 'ProviderName')` in `src/core/utils/dependencies.js` for optional external SDKs.
3. **Private Credentials**: Keep all API keys, secrets, and credentials in `#private` instance fields.
4. **Capability Contract**: Define the immutable `capabilities` array (e.g. `['createOrder', 'verifyPayment', 'refund']`).
5. **Factory Mapping**: Register the provider in the domain factory (`PaymentFactory.js`, `EmailFactory.js`, etc.) with case-insensitive, trimmed matching.
6. **Error Normalization**: Map third-party SDK error codes to standardized `IntegrationError` instances.
7. **Test Coverage**: Provide comprehensive unit and integration tests under `tests/<domain>/<provider>.test.js` using fully mocked SDKs. Never make live network requests in tests.
8. **Export Mapping**: Re-export classes in domain barrels (`src/<domain>/index.js`) and root barrel (`src/index.js`).
9. **Example Script**: Add a runnable example in `examples/<domain>/<provider>.example.js` and document it in `examples/README.md`.
10. **Documentation**: Update `README.md` with configuration options, capabilities, and dependency requirements.

---

## 6. Pull Request Process

1. Create a feature branch from `master` (`git checkout -b feature/my-feature`).
2. Implement your changes following the architectural principles.
3. Ensure all quality gates pass cleanly.
4. Fill out the pull request template completely.
5. Maintain a clean commit history with descriptive commit messages.
