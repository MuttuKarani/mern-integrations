import dotenv from 'dotenv';
import { createStorageProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * AWS S3 Storage Provider Example
 *
 * Requirements:
 *   npm install mern-integrations @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
 *
 * Environment Variables:
 *   AWS_ACCESS_KEY_ID=AKIA...
 *   AWS_SECRET_ACCESS_KEY=...
 *   AWS_REGION=us-east-1
 *   AWS_S3_BUCKET=my-app-uploads
 *   AWS_S3_ENDPOINT=https://... (optional, for MinIO / Cloudflare R2 / DigitalOcean Spaces)
 */
async function main() {
  console.log('=== AWS S3 Storage Provider Example ===\n');

  // 1. Initialize provider using factory
  const storage = createStorageProvider({
    provider: 's3',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAEXAMPLE12345',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'sampleSecretAccessKey67890',
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || 'my-app-uploads',
    endpoint: process.env.AWS_S3_ENDPOINT || undefined
  });

  console.log(`Initialized provider: ${storage.name}`);
  console.log(`Capabilities: ${storage.capabilities.join(', ')}`);

  // 2. Uploading in-memory Buffer directly
  if (storage.capabilities.includes('uploadBuffer')) {
    console.log('\n--- 1. Uploading in-memory Buffer to S3 ---');
    try {
      const documentBuffer = Buffer.from('Invoice #10023\nDate: 2026-09-04\nTotal: $120.00\n');

      const uploadOptions = {
        buffer: documentBuffer,
        folder: 'invoices/2026',
        key: 'inv_10023.txt',
        contentType: 'text/plain',
        metadata: {
          customerId: 'cust_882',
          orderId: 'ord_991'
        }
      };
      console.log('Upload options:', { ...uploadOptions, buffer: `<Buffer length=${documentBuffer.length}>` });

      // In production:
      // const uploadResult = await storage.uploadBuffer(uploadOptions);
      // console.log('S3 upload result:', uploadResult);
      console.log('(Skipped live S3 upload in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Generating Public URL vs Pre-signed Temporary URL
  if (storage.capabilities.includes('getUrl')) {
    console.log('\n--- 2. Generating Public and Pre-signed Temporary URLs ---');
    try {
      // A. Public URL (instant, purely deterministic format)
      const publicUrlResult = await storage.getUrl({
        key: 'invoices/2026/inv_10023.txt',
        signed: false
      });
      console.log('Public URL:', publicUrlResult.data.url);

      // B. Pre-signed Temporary URL (Expires in 1 hour = 3600 seconds)
      console.log('Pre-signed URL generation (expiresIn: 3600s)...');
      // In production:
      // const signedUrlResult = await storage.getUrl({
      //   key: 'invoices/2026/inv_10023.txt',
      //   signed: true,
      //   expiresIn: 3600
      // });
      // console.log('Pre-signed Temporary URL:', signedUrlResult.data.url);
      console.log('(Skipped pre-signing in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 4. Deleting an object
  if (storage.capabilities.includes('delete')) {
    console.log('\n--- 3. Deleting Object from S3 Bucket ---');
    try {
      console.log('Deleting S3 key: "invoices/2026/inv_10023.txt"...');
      // In production:
      // const deleteResult = await storage.delete({ key: 'invoices/2026/inv_10023.txt' });
      // console.log('Delete result:', deleteResult);
      console.log('(Skipped live delete in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  console.log('\n=== Example completed successfully ===');
}

function handleError(error) {
  if (error instanceof ValidationError) {
    console.error('[ValidationError]', error.message, error.details);
  } else if (error instanceof IntegrationError) {
    console.error(`[IntegrationError - ${error.code} (${error.statusCode})]`, error.message);
  } else {
    console.error('[UnexpectedError]', error);
  }
}

main().catch(console.error);
