import { RequestHandler } from 'express';
import { Readable } from 'stream';

// ==========================================
// Core Errors & Utilities
// ==========================================

export interface NormalizedSuccess<T = any> {
  success: true;
  provider: string;
  data: T;
}

export interface NormalizedError {
  success: false;
  provider: string;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class IntegrationError extends Error {
  code: string;
  statusCode: number;
  provider: string;
  details?: any;
  constructor(message: string, options?: { code?: string; statusCode?: number; provider?: string; details?: any });
  toJSON(): NormalizedError;
}

export class ValidationError extends IntegrationError {
  constructor(message: string, options?: { provider?: string; details?: any });
}

export function rawBodyMiddleware(): RequestHandler;

export function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    minTimeout?: number;
    maxTimeout?: number;
    factor?: number;
    shouldRetry?: (error: Error, attempt: number) => boolean;
  }
): Promise<T>;

export function validateRequiredString(value: any, fieldName: string, provider: string): string;
export function validateRequiredObject(value: any, fieldName: string, provider: string): Record<string, any>;
export function validateAmountInSmallestUnit(amount: any, fieldName: string, provider: string): number;
export function validateRawPayload(payload: any, fieldName: string, provider: string): string | Buffer;
export function validateEmail(email: any, fieldName: string, provider: string): string;
export function validateEmailRecipients(recipients: any, fieldName: string, provider: string): string | string[];
export function validateMobileNumber(mobile: any, fieldName: string, provider: string): string;
export function validateMobileRecipients(recipients: any, fieldName: string, provider: string): string | string[];

// ==========================================
// Payments Domain
// ==========================================

export abstract class PaymentProvider {
  readonly name: string;
  constructor(name: string);
  get capabilities(): readonly string[];
  abstract createOrder(params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  initiatePayment(params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  abstract verifyPayment(params: Record<string, any>): Promise<NormalizedSuccess>;
  verifyCallback(params: Record<string, any>): Promise<NormalizedSuccess>;
  refund(params: { paymentId: string; amount?: number; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { payload: string | Buffer; signature: string; secret?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  normalizeSuccess<T = any>(data: T): NormalizedSuccess<T>;
  normalizeError(code: string, message: string, details?: any): NormalizedError;
}

export class RazorpayProvider extends PaymentProvider {
  constructor(config?: { keyId?: string; keySecret?: string; webhookSecret?: string; client?: any; loader?: Function });
  createOrder(params: { amount: number; currency: string; receipt?: string; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyPayment(params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Promise<NormalizedSuccess<{ verified: boolean; orderId: string; paymentId: string }>>;
  refund(params: { paymentId: string; amount?: number; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { payload: string | Buffer; signature: string; secret?: string }): Promise<NormalizedSuccess<{ verified: boolean }>>;
}

export class StripeProvider extends PaymentProvider {
  constructor(config?: { secretKey?: string; webhookSecret?: string; client?: any; loader?: Function });
  createOrder(params: { amount: number; currency: string; description?: string; receiptEmail?: string; metadata?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyPayment(params: { paymentIntentId: string }): Promise<NormalizedSuccess<{ id: string; status: string; amount: number; currency: string; verified: boolean; raw: any }>>;
  refund(params: { paymentIntentId?: string; chargeId?: string; amount?: number; reason?: string; metadata?: Record<string, any> }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { payload: string | Buffer; signature: string; secret?: string }): Promise<NormalizedSuccess<{ verified: boolean; event: any }>>;
}

export class CCAvenueProvider extends PaymentProvider {
  constructor(config?: { merchantId?: string; accessCode?: string; workingKey?: string; baseUrl?: string; testMode?: boolean });
  createOrder(params: { amount: number; currency: string; orderId: string; redirectUrl: string; cancelUrl: string; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyPayment(params: { encResp: string }): Promise<NormalizedSuccess>;
  parseEncryptedResponse(encResp: string): Record<string, string>;
}

export class PhonePeProvider extends PaymentProvider {
  constructor(config?: { merchantId?: string; saltKey?: string; saltIndex?: string | number; baseUrl?: string; testMode?: boolean; redirectMode?: string; callbackUrl?: string; fetch?: typeof fetch });
  createOrder(params: { amount: number; currency?: string; merchantTransactionId?: string; merchantUserId?: string; redirectUrl: string; callbackUrl?: string; mobileNumber?: string; paymentInstrument?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyPayment(params: { merchantTransactionId: string }): Promise<NormalizedSuccess<{ id: string; merchantTransactionId: string; transactionId?: string; amount?: number; state: string; responseCode?: string; verified: boolean; status: string; raw: any }>>;
  verifyCallback(params: { response: string; signature?: string }): Promise<NormalizedSuccess>;
  refund(params: { merchantTransactionId: string; originalTransactionId: string; amount: number; callbackUrl?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { payload: string | Buffer | Record<string, any>; signature: string; saltKey?: string; saltIndex?: string | number }): Promise<NormalizedSuccess<{ verified: boolean; event?: any }>>;
}

export namespace ccavenueCrypto {
  export function encrypt(plainText: string, workingKey: string): string;
  export function decrypt(encText: string, workingKey: string): string;
}

export class MockPaymentProvider extends PaymentProvider {
  constructor(config?: Record<string, any>);
  createOrder(params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyPayment(params?: { orderId?: string; paymentId?: string; signature?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  refund(params: { paymentId: string; amount?: number; notes?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { payload: string | Buffer; signature: string; secret?: string }): Promise<NormalizedSuccess<{ verified: boolean }>>;
  getRecordedOrders(): any[];
  getOrder(orderId: string): any | null;
  getRecordedPayments(): any[];
  getRecordedRefunds(): any[];
  clearHistory(): void;
  reset(): void;
}

export function createPaymentProvider(config: {
  provider: 'razorpay' | 'ccavenue' | 'stripe' | 'phonepe' | 'mock' | (string & {});
  [key: string]: any;
}): PaymentProvider;

// ==========================================
// Email Domain
// ==========================================

export abstract class EmailProvider {
  readonly name: string;
  constructor(name: string);
  get capabilities(): readonly string[];
  abstract send(params: { from?: string; to: string | string[]; subject: string; html?: string; text?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; tags?: Record<string, any>; attachments?: any[]; [key: string]: any }): Promise<NormalizedSuccess>;
  verify(): Promise<NormalizedSuccess>;
  normalizeSuccess<T = any>(data: T): NormalizedSuccess<T>;
  normalizeError(code: string, message: string, details?: any): NormalizedError;
}

export class ResendProvider extends EmailProvider {
  constructor(config?: { apiKey?: string; client?: any; loader?: Function });
  send(params: { from: string; to: string | string[]; subject: string; html?: string; text?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; tags?: Record<string, string>; attachments?: any[] }): Promise<NormalizedSuccess>;
}

export class NodemailerProvider extends EmailProvider {
  constructor(config?: { host?: string; port?: number; secure?: boolean; auth?: { user: string; pass: string }; service?: string; transporter?: any });
  send(params: { from: string; to: string | string[]; subject: string; html?: string; text?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; attachments?: any[] }): Promise<NormalizedSuccess>;
  verify(): Promise<NormalizedSuccess>;
}

export class SESProvider extends EmailProvider {
  constructor(config?: { accessKeyId?: string; secretAccessKey?: string; region?: string; configurationSetName?: string; client?: any });
  send(params: { from: string; to: string | string[]; subject: string; html?: string; text?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; configurationSetName?: string; tags?: Record<string, string> }): Promise<NormalizedSuccess>;
}

export class MockEmailProvider extends EmailProvider {
  constructor(config?: Record<string, any>);
  send(params: { from?: string; to: string | string[]; subject: string; html?: string; text?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  verify(): Promise<NormalizedSuccess<{ connected: boolean }>>;
  getSentEmails(): any[];
  getLastSentEmail(): any | null;
  clearSentEmails(): void;
  reset(): void;
}

export function createEmailProvider(config: {
  provider: 'resend' | 'nodemailer' | 'ses' | 'amazon-ses' | 'amazonses' | 'mock' | (string & {});
  [key: string]: any;
}): EmailProvider;

// ==========================================
// SMS & OTP Domain
// ==========================================

export abstract class SMSProvider {
  readonly name: string;
  constructor(name: string);
  get capabilities(): readonly string[];
  abstract sendSMS(params: { to: string | string[]; message: string; [key: string]: any }): Promise<NormalizedSuccess>;
  sendOTP(params: { to: string; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyOTP(params: { to: string; otp: string; [key: string]: any }): Promise<NormalizedSuccess>;
  resendOTP(params: { to: string; [key: string]: any }): Promise<NormalizedSuccess>;
  sendWhatsApp(params: { to: string; templateName?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  normalizeSuccess<T = any>(data: T): NormalizedSuccess<T>;
  normalizeError(code: string, message: string, details?: any): NormalizedError;
}

export class MSG91Provider extends SMSProvider {
  constructor(config?: { authKey?: string; senderId?: string; baseUrl?: string; fetch?: typeof fetch });
  sendSMS(params: { to: string | string[]; message?: string; templateId?: string; senderId?: string; shortUrl?: boolean; variables?: Record<string, any> }): Promise<NormalizedSuccess>;
  sendOTP(params: { to: string; templateId?: string; otpLength?: number; expiryMinutes?: number }): Promise<NormalizedSuccess>;
  verifyOTP(params: { to: string; otp: string }): Promise<NormalizedSuccess>;
  resendOTP(params: { to: string; retryType?: 'text' | 'voice' }): Promise<NormalizedSuccess>;
  sendWhatsApp(params: { to: string; integratedNumber: string; templateName: string; languageCode?: string; components?: any[] }): Promise<NormalizedSuccess>;
}

export class MessageBirdProvider extends SMSProvider {
  constructor(config?: { apiKey?: string; channelId?: string; namespace?: string; baseUrl?: string; fetch?: typeof fetch });
  sendSMS(params: { to: string | string[]; message: string; originator?: string }): Promise<NormalizedSuccess>;
  sendWhatsApp(params: { to: string; templateName: string; channelId?: string; namespace?: string; languageCode?: string; params?: any[] }): Promise<NormalizedSuccess>;
}

export class TwilioProvider extends SMSProvider {
  constructor(config?: { accountSid?: string; authToken?: string; from?: string; messagingServiceSid?: string; verifyServiceSid?: string; whatsappFrom?: string; baseUrl?: string; verifyBaseUrl?: string; fetch?: typeof fetch });
  sendSMS(params: { to: string; message: string; from?: string; messagingServiceSid?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  sendOTP(params: { to: string; channel?: 'sms' | 'call' | 'whatsapp' | 'email'; serviceSid?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyOTP(params: { to: string; otp: string; serviceSid?: string; [key: string]: any }): Promise<NormalizedSuccess<{ sid: string; serviceSid: string; to: string; status: string; valid: boolean; verified: boolean; raw: any }>>;
  sendWhatsApp(params: { to: string; message?: string; from?: string; contentSid?: string; contentVariables?: Record<string, any>; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyWebhook(params: { url: string; params?: Record<string, any>; signature: string; authToken?: string }): Promise<NormalizedSuccess<{ verified: boolean }>>;
}

export class MockSMSProvider extends SMSProvider {
  constructor(config?: Record<string, any>);
  sendSMS(params: { to: string; message: string; senderId?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  sendOTP(params: { to: string; otp?: string; expirySeconds?: number; [key: string]: any }): Promise<NormalizedSuccess>;
  verifyOTP(params: { to: string; otp: string }): Promise<NormalizedSuccess<{ verified: boolean; to: string; expired: boolean }>>;
  resendOTP(params: { to: string; [key: string]: any }): Promise<NormalizedSuccess>;
  sendWhatsApp(params: { to: string; templateName: string; components?: any[]; [key: string]: any }): Promise<NormalizedSuccess>;
  getSentMessages(): any[];
  getLastSentMessage(): any | null;
  getGeneratedOTPs(): Map<string, any>;
  clearHistory(): void;
  reset(): void;
}

export function createSMSProvider(config: {
  provider: 'msg91' | 'messagebird' | 'twilio' | 'mock' | (string & {});
  [key: string]: any;
}): SMSProvider;

// ==========================================
// Storage Domain
// ==========================================

export abstract class StorageProvider {
  readonly name: string;
  constructor(name: string);
  get capabilities(): readonly string[];
  abstract upload(params: { file: string; fileName?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  uploadBuffer(params: { buffer: Buffer; fileName?: string; key?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  uploadStream(params: { stream: Readable; key?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  delete(params: { publicId?: string; key?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  getUrl(params: { publicId?: string; key?: string; signed?: boolean; expiresIn?: number; [key: string]: any }): string | Promise<string>;
  normalizeSuccess<T = any>(data: T): NormalizedSuccess<T>;
  normalizeError(code: string, message: string, details?: any): NormalizedError;
}

export class CloudinaryProvider extends StorageProvider {
  constructor(config?: { cloudName?: string; apiKey?: string; apiSecret?: string; client?: any; loader?: Function });
  upload(params: { file: string; folder?: string; publicId?: string; resourceType?: string; tags?: string | string[]; transformation?: any }): Promise<NormalizedSuccess>;
  uploadBuffer(params: { buffer: Buffer; folder?: string; publicId?: string; resourceType?: string; tags?: string | string[]; transformation?: any }): Promise<NormalizedSuccess>;
  delete(params: { publicId: string; resourceType?: string; invalidate?: boolean }): Promise<NormalizedSuccess>;
  getUrl(params: { publicId: string; transformation?: any; secure?: boolean }): string;
}

export class S3Provider extends StorageProvider {
  constructor(config?: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucket?: string; endpoint?: string; forcePathStyle?: boolean; client?: any });
  upload(params: { file: string; key?: string; contentType?: string }): Promise<NormalizedSuccess>;
  uploadBuffer(params: { buffer: Buffer; key: string; contentType?: string }): Promise<NormalizedSuccess>;
  uploadStream(params: { stream: Readable; key: string; contentType?: string }): Promise<NormalizedSuccess>;
  delete(params: { key: string }): Promise<NormalizedSuccess>;
  getUrl(params: { key: string; signed?: boolean; expiresIn?: number }): Promise<string>;
}

export class MockStorageProvider extends StorageProvider {
  constructor(config?: Record<string, any>);
  upload(params: { file: string; fileName?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  uploadBuffer(params: { buffer: Buffer; fileName?: string; key?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  uploadStream(params: { stream: Readable; key?: string; folder?: string; [key: string]: any }): Promise<NormalizedSuccess>;
  delete(params: { publicId?: string; key?: string }): Promise<NormalizedSuccess>;
  getUrl(params: { publicId?: string; key?: string; signed?: boolean; expiresIn?: number }): string;
  getFiles(): any[];
  getFile(key: string): any | null;
  clearFiles(): void;
  reset(): void;
}

export function createStorageProvider(config: {
  provider: 'cloudinary' | 's3' | 'aws-s3' | 'awss3' | 'mock' | (string & {});
  [key: string]: any;
}): StorageProvider;
