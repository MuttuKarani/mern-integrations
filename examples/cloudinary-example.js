import dotenv from 'dotenv';
import { createStorageProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the Cloudinary Storage provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== Cloudinary Storage Provider Example ===\n');

  // 1. Initialize Cloudinary provider using factory
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'sample_cloud_name';
  const apiKey = process.env.CLOUDINARY_API_KEY || 'sample_api_key_123';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'sample_api_secret_456';

  const storage = createStorageProvider({
    provider: 'cloudinary',
    cloudName,
    apiKey,
    apiSecret
  });

  console.log(`Initialized provider: ${storage.name}`);

  // 2. Prepare sample upload payload (supports local file, remote URL, or base64 data URI)
  const sampleUploadPayload = {
    file: 'https://images.unsplash.com/photo-1575936123452-b67c3203c357',
    folder: 'mern_app/products',
    publicId: 'sample_product_01',
    tags: ['sample', 'product', 'ecommerce'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  };

  console.log('\n--- 1. File Upload Payload Preparation ---');
  console.log(JSON.stringify(sampleUploadPayload, null, 2));

  // 3. Prepare sample buffer upload payload
  const sampleBuffer = Buffer.from('Simulated image buffer data');
  console.log('\n--- 2. Buffer Upload Payload Preparation ---');
  console.log({
    bufferLength: sampleBuffer.length,
    folder: 'mern_app/documents',
    publicId: 'sample_invoice_101'
  });

  // 4. URL Generation (Offline / instantaneous)
  console.log('\n--- 3. URL Generation Example ---');
  const urlResult = storage.getUrl({
    publicId: 'mern_app/products/sample_product_01',
    transformation: { width: 400, height: 300, crop: 'fill' }
  });
  console.log('Generated Transformation URL:', JSON.stringify(urlResult, null, 2));

  // 5. Delete preparation
  console.log('\n--- 4. Delete Asset Payload Preparation ---');
  const deletePayload = {
    publicId: 'mern_app/products/sample_product_01',
    invalidate: true
  };
  console.log(JSON.stringify(deletePayload, null, 2));

  // 6. Dry-run safety check
  const isPlaceholder =
    !process.env.CLOUDINARY_API_KEY ||
    apiKey.includes('sample') ||
    apiKey.includes('placeholder') ||
    apiKey.includes('mock') ||
    cloudName.includes('sample');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live Cloudinary API calls because CLOUDINARY credentials are not configured or are placeholders.'
    );
    console.log('[INFO] In production with valid credentials, call:');
    console.log('       1. const uploadResult = await storage.upload(sampleUploadPayload);');
    console.log('          Result: { success: true, provider: "cloudinary", data: { publicId: "...", secureUrl: "https://...", ... } }');
    console.log('       2. const bufferResult = await storage.uploadBuffer({ buffer: myBuffer, folder: "uploads" });');
    console.log('          Result: { success: true, provider: "cloudinary", data: { publicId: "...", secureUrl: "https://...", ... } }');
    console.log('       3. const deleteResult = await storage.delete(deletePayload);');
    console.log('          Result: { success: true, provider: "cloudinary", data: { publicId: "...", result: "ok" } }');
    console.log('\n=== Cloudinary Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const uploadResult = await storage.upload(sampleUploadPayload);
    console.log('\nUpload Result:', JSON.stringify(uploadResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('Provider error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
  }

  console.log('\n=== Cloudinary Example Run Complete ===');
}

runExample().catch(console.error);
