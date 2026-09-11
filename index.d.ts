import { RequestHandler } from 'express';

// Core Errors
export class IntegrationError extends Error {
  code: string;
  statusCode: number;
  provider: string;
  details?: any;
  constructor(message: string, options?: { code?: string; statusCode?: number; provider?: string; details?: any });
  toJSON(): { success: false; provider: string; error: { code: string; message: string; details?: any } };
}

export class ValidationError extends IntegrationError {
  constructor(message: string, options?: { provider?: string; details?: any });
}

// Utilities
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

// Payments
export abstract class PaymentProvider {
  readonly providerName: string;
  constructor(providerName: string);
  abstract createOrder(params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, any> }): Promise<any>;
  abstract verifyWebhookSignature(payload: string | Buffer | Record<string, any>, signature: string, secret?: string): boolean;
}

export class RazorpayProvider extends PaymentProvider {
  constructor(config?: { keyId?: string; keySecret?: string; webhookSecret?: string; client?: any; loader?: Function });
  createOrder(params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, any> }): Promise<any>;
  verifyWebhookSignature(payload: string | Buffer | Record<string, any>, signature: string, secret?: string): boolean;
  fetchPayment(paymentId: string): Promise<any>;
  refund(paymentId: string, options?: { amount?: number; notes?: Record<string, any> }): Promise<any>;
}

export class StripeProvider extends PaymentProvider {
  constructor(config?: { secretKey?: string; webhookSecret?: string; client?: any; loader?: Function });
  createOrder(params: { amount: number; currency?: string; receipt?: string; metadata?: Record<string, any> }): Promise<any>;
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret?: string): boolean;
}

export function createPaymentProvider(config: { provider: 'razorpay' | 'ccavenue' | 'stripe' | string; [key: string]: any }): PaymentProvider;

// Email
export abstract class EmailProvider {
  readonly providerName: string;
  constructor(providerName: string);
  abstract sendEmail(params: { to: string | string[]; subject: string; html?: string; text?: string; from?: string }): Promise<any>;
}

export class ResendProvider extends EmailProvider {
  constructor(config?: { apiKey?: string; client?: any; loader?: Function });
  sendEmail(params: { to: string | string[]; subject: string; html?: string; text?: string; from?: string }): Promise<any>;
}

export function createEmailProvider(config: { provider: 'resend' | 'nodemailer' | 'ses' | string; [key: string]: any }): EmailProvider;

// Storage
export abstract class StorageProvider {
  readonly providerName: string;
  constructor(providerName: string);
  abstract uploadFile(params: { file: Buffer | string; fileName: string; folder?: string }): Promise<any>;
}

export class S3Provider extends StorageProvider {
  constructor(config?: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucket?: string; endpoint?: string; forcePathStyle?: boolean });
  uploadFile(params: { file: Buffer | string; fileName: string; folder?: string }): Promise<any>;
}

export function createStorageProvider(config: { provider: 'cloudinary' | 's3' | string; [key: string]: any }): StorageProvider;
