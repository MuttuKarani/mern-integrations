import dotenv from 'dotenv';
import { createStorageProvider, ValidationError, IntegrationError } from '../src/index.js';

dotenv.config();

/**
 * Example demonstrating how to use the AWS S3 Storage provider inside a Node / MERN backend.
 */
async function runExample() {
  console.log('=== AWS S3 Storage Provider Example ===\n');

  // 1. Initialize AWS S3 provider using factory
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'sample_aws_access_key';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'sample_aws_secret_key';
  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucket = process.env.AWS_S3_BUCKET || 'my-sample-bucket';
  const endpoint = process.env.AWS_S3_ENDPOINT || null;

  const storage = createStorageProvider({
    provider: 's3',
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    endpoint
  });

  console.log(`Initialized provider: ${storage.name}`);

  // 2. Prepare sample Buffer upload payload
  const sampleBuffer = Buffer.from('Hello MERN Stack from AWS S3 Storage!');
  const sampleBufferPayload = {
    buffer: sampleBuffer,
    key: 'sample_document.txt',
    folder: 'mern_app/documents',
    contentType: 'text/plain',
    metadata: { author: 'MERN Developer', category: 'reports' }
  };

  console.log('\n--- 1. Buffer Upload Payload Preparation ---');
  console.log({
    bufferLength: sampleBuffer.length,
    key: sampleBufferPayload.key,
    folder: sampleBufferPayload.folder,
    contentType: sampleBufferPayload.contentType,
    metadata: sampleBufferPayload.metadata
  });

  // 3. Public URL generation (Instantaneous offline computation)
  console.log('\n--- 2. Public Object URL Generation ---');
  const publicUrlResult = await storage.getUrl({
    key: 'mern_app/documents/sample_document.txt',
    signed: false
  });
  console.log('Standard Public URL:', JSON.stringify(publicUrlResult, null, 2));

  // 4. Pre-signed temporary URL generation payload
  console.log('\n--- 3. Pre-signed Temporary URL Preparation ---');
  const signedUrlPayload = {
    key: 'mern_app/documents/sample_document.txt',
    signed: true,
    expiresIn: 1800 // 30 minutes
  };
  console.log(JSON.stringify(signedUrlPayload, null, 2));

  // 5. Delete preparation
  console.log('\n--- 4. Delete Object Payload Preparation ---');
  const deletePayload = {
    key: 'mern_app/documents/sample_document.txt'
  };
  console.log(JSON.stringify(deletePayload, null, 2));

  // 6. Dry-run safety check
  const isPlaceholder =
    !process.env.AWS_ACCESS_KEY_ID ||
    accessKeyId.includes('sample') ||
    accessKeyId.includes('placeholder') ||
    accessKeyId.includes('mock') ||
    bucket.includes('sample');

  if (isPlaceholder) {
    console.log(
      '\n[INFO] Skipping live AWS S3 API calls because AWS credentials are not configured or are placeholders.'
    );
    console.log('[INFO] In production with valid AWS credentials and S3 bucket, call:');
    console.log('       1. const uploadResult = await storage.uploadBuffer(sampleBufferPayload);');
    console.log('          Result: { success: true, provider: "s3", data: { key: "...", bucket: "...", url: "https://...", etag: "..." } }');
    console.log('       2. const signedUrlResult = await storage.getUrl(signedUrlPayload);');
    console.log('          Result: { success: true, provider: "s3", data: { key: "...", url: "https://...X-Amz-Signature=...", signed: true } }');
    console.log('       3. const deleteResult = await storage.delete(deletePayload);');
    console.log('          Result: { success: true, provider: "s3", data: { key: "...", deleted: true } }');
    console.log('\n=== AWS S3 Example Run Complete (Dry Run) ===');
    return;
  }

  try {
    const uploadResult = await storage.uploadBuffer(sampleBufferPayload);
    console.log('\nUpload Buffer Result:', JSON.stringify(uploadResult, null, 2));

    const signedResult = await storage.getUrl(signedUrlPayload);
    console.log('\nGenerated Pre-signed URL:', JSON.stringify(signedResult, null, 2));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.toJSON());
    } else if (error instanceof IntegrationError) {
      console.error('Provider error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
  }

  console.log('\n=== AWS S3 Example Run Complete ===');
}

runExample().catch(console.error);
