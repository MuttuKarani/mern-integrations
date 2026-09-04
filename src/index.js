// Core errors & utilities
export { IntegrationError } from './core/errors/IntegrationError.js';
export { ValidationError } from './core/errors/ValidationError.js';
export * from './core/utils/validators.js';

// Payments module
export { PaymentProvider } from './payments/interfaces/PaymentProvider.js';
export { RazorpayProvider } from './payments/providers/razorpay/RazorpayProvider.js';
export { CCAvenueProvider } from './payments/providers/ccavenue/CCAvenueProvider.js';
export { createPaymentProvider } from './payments/factories/PaymentFactory.js';
export * as ccavenueCrypto from './payments/providers/ccavenue/ccavenue.crypto.js';

// Email module
export { EmailProvider } from './email/interfaces/EmailProvider.js';
export { ResendProvider } from './email/providers/resend/ResendProvider.js';
export { createEmailProvider } from './email/factories/EmailFactory.js';
