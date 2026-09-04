import dotenv from 'dotenv';
import { createStorageProvider, IntegrationError, ValidationError } from '../../src/index.js';

// Load environment variables from .env file (optional)
dotenv.config();

/**
 * Cloudinary Storage Provider Example
 *
 * Requirements:
 *   npm install mern-integrations cloudinary
 *
 * Environment Variables:
 *   CLOUDINARY_CLOUD_NAME=...
 *   CLOUDINARY_API_KEY=...
 *   CLOUDINARY_API_SECRET=...
 */
async function main() {
  console.log('=== Cloudinary Storage Provider Example ===\n');

  // 1. Initialize provider using factory
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'sample_cloud_name';
  const apiKey = process.env.CLOUDINARY_API_KEY || '123456789012345';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'sampleApiSecret12345';

  const storage = createStorageProvider({
    provider: 'cloudinary',
    cloudName,
    apiKey,
    apiSecret
  });

  console.log(`Initialized provider: ${storage.name}`);
  console.log(`Capabilities: ${storage.capabilities.join(', ')}`);

  // 2. Uploading in-memory Buffer directly (e.g. from Multer / Express file upload)
  if (storage.capabilities.includes('uploadBuffer')) {
    console.log('\n--- 1. Uploading in-memory Buffer ---');
    try {
      // 1x1 transparent PNG buffer
      const samplePngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const uploadOptions = {
        buffer: samplePngBuffer,
        folder: 'user-avatars',
        publicId: `avatar_${Date.now()}`,
        resourceType: 'image'
      };
      console.log('Upload buffer options:', { ...uploadOptions, buffer: '<Buffer length=70>' });

      // In production:
      // const uploadResult = await storage.uploadBuffer(uploadOptions);
      // console.log('Upload result:', uploadResult);
      console.log('(Skipped live Cloudinary upload in placeholder mode)');
    } catch (error) {
      handleError(error);
    }
  }

  // 3. Generating Optimized Delivery URLs
  if (storage.capabilities.includes('getUrl')) {
    console.log('\n--- 2. Generating Optimized Delivery URL ---');
    try {
      const urlResult = storage.getUrl({
        publicId: 'user-avatars/sample_avatar',
        transformation: {
          width: 300,
          height: 300,
          crop: 'fill',
          quality: 'auto'
        }
      });
      console.log('Transformed secure delivery URL:', urlResult.data.url);
    } catch (error) {
      handleError(error);
    }
  }

  // 4. Deleting an asset
  if (storage.capabilities.includes('delete')) {
    console.log('\n--- 3. Deleting Asset by Public ID ---');
    try {
      console.log('Deleting asset publicId: "user-avatars/sample_avatar"...');
      // In production:
      // const deleteResult = await storage.delete({ publicId: 'user-avatars/sample_avatar' });
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
