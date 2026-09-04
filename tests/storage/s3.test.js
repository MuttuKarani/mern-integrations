import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
  createStorageProvider,
  StorageProvider,
  S3Provider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Mock presigner and lib-storage
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation((options) => ({
    done: jest.fn().mockResolvedValue({
      Location: `https://${options.params.Bucket}.s3.amazonaws.com/${options.params.Key}`,
      ETag: '"stream_etag_123"',
      VersionId: 'v_stream_1'
    })
  }))
}));

describe('S3Provider & AWS S3 Storage Integration', () => {
  const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const mockSecretAccessKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const mockRegion = 'ap-south-1';
  const mockBucket = 'my-app-uploads';

  let mockClient;
  let mockPresigner;
  let mockUploadFactory;
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      send: jest.fn()
    };

    mockPresigner = jest.fn();
    mockUploadFactory = jest.fn().mockImplementation((options) => ({
      done: jest.fn().mockResolvedValue({
        Location: `https://${options.params.Bucket}.s3.amazonaws.com/${options.params.Key}`,
        ETag: '"stream_etag_123"',
        VersionId: 'v_stream_1'
      })
    }));

    provider = new S3Provider({
      accessKeyId: mockAccessKeyId,
      secretAccessKey: mockSecretAccessKey,
      region: mockRegion,
      bucket: mockBucket,
      client: mockClient,
      presigner: mockPresigner,
      uploadFactory: mockUploadFactory
    });
  });

  describe('StorageProvider / Factory for S3', () => {
    test('should create S3Provider when provider is "s3", "aws-s3", or "awss3"', () => {
      const p1 = createStorageProvider({
        provider: 's3',
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket
      });
      const p2 = createStorageProvider({
        provider: 'aws-s3',
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket
      });
      const p3 = createStorageProvider({
        provider: 'awss3',
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket
      });

      expect(p1).toBeInstanceOf(S3Provider);
      expect(p1).toBeInstanceOf(StorageProvider);
      expect(p1.name).toBe('s3');
      expect(p2).toBeInstanceOf(S3Provider);
      expect(p3).toBeInstanceOf(S3Provider);
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createStorageProvider({ provider: 'S3', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket });
      const p2 = createStorageProvider({ provider: '  s3  ', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket });
      const p3 = createStorageProvider({ provider: '  AWS-S3  ', accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket });

      expect(p1).toBeInstanceOf(S3Provider);
      expect(p2).toBeInstanceOf(S3Provider);
      expect(p3).toBeInstanceOf(S3Provider);
    });

    test('should throw ValidationError if config is missing or invalid', () => {
      expect(() => createStorageProvider(null)).toThrow(ValidationError);
      expect(() => createStorageProvider({})).toThrow(ValidationError);
      expect(() => createStorageProvider({ provider: '' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError for unsupported storage providers', () => {
      expect(() =>
        createStorageProvider({ provider: 'azure-blob', accessKeyId: 'k', secretAccessKey: 's', region: 'r', bucket: 'b' })
      ).toThrow(IntegrationError);
    });
  });

  describe('Constructor & Credentials Validation', () => {
    test('should throw ValidationError if config is not a valid object', () => {
      expect(() => new S3Provider(null)).toThrow(ValidationError);
      expect(() => new S3Provider('invalid')).toThrow(ValidationError);
    });

    test('should throw ValidationError if accessKeyId is missing or empty', () => {
      expect(() => new S3Provider({ secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket })).toThrow(ValidationError);
      expect(() => new S3Provider({ accessKeyId: '', secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket })).toThrow(ValidationError);
      expect(() => new S3Provider({ accessKeyId: '   ', secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: mockBucket })).toThrow(ValidationError);
    });

    test('should throw ValidationError if secretAccessKey is missing or empty', () => {
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, region: mockRegion, bucket: mockBucket })).toThrow(ValidationError);
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, secretAccessKey: '', region: mockRegion, bucket: mockBucket })).toThrow(ValidationError);
    });

    test('should throw ValidationError if region is missing or empty', () => {
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, bucket: mockBucket })).toThrow(ValidationError);
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: '', bucket: mockBucket })).toThrow(ValidationError);
    });

    test('should throw ValidationError if bucket is missing or empty', () => {
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion })).toThrow(ValidationError);
      expect(() => new S3Provider({ accessKeyId: mockAccessKeyId, secretAccessKey: mockSecretAccessKey, region: mockRegion, bucket: '' })).toThrow(ValidationError);
    });

    test('should instantiate successfully and not expose private credentials', () => {
      const p = new S3Provider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket
      });

      expect(p).toBeInstanceOf(S3Provider);
      expect(p.accessKeyId).toBeUndefined();
      expect(p.secretAccessKey).toBeUndefined();
      expect(p['#accessKeyId']).toBeUndefined();
      expect(p['#secretAccessKey']).toBeUndefined();
      expect(JSON.stringify(p)).not.toContain(mockSecretAccessKey);
    });

    test('should support custom endpoint and forcePathStyle', () => {
      const p = new S3Provider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket,
        endpoint: 'https://minio.example.com',
        forcePathStyle: true
      });

      expect(p).toBeInstanceOf(S3Provider);
    });
  });

  describe('upload()', () => {
    test('should validate required file parameter', async () => {
      await expect(provider.upload({})).rejects.toThrow(ValidationError);
      await expect(provider.upload({ file: '' })).rejects.toThrow(ValidationError);
      await expect(provider.upload({ file: '   ' })).rejects.toThrow(ValidationError);
    });

    test('should successfully upload a local file with PutObjectCommand', async () => {
      const sampleFilePath = path.join(process.cwd(), 'package.json');

      mockClient.send.mockResolvedValueOnce({
        ETag: '"etag_package_123"',
        VersionId: 'v_pkg_1'
      });

      const result = await provider.upload({
        file: sampleFilePath,
        folder: 'configs',
        contentType: 'application/json',
        metadata: { env: 'production' },
        cacheControl: 'max-age=3600',
        acl: 'private'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockBucket,
        Key: 'configs/package.json',
        ContentType: 'application/json',
        Metadata: { env: 'production' },
        CacheControl: 'max-age=3600',
        ACL: 'private'
      });
      expect(Buffer.isBuffer(command.input.Body)).toBe(true);

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'configs/package.json',
          bucket: mockBucket,
          url: `https://${mockBucket}.s3.${mockRegion}.amazonaws.com/configs/package.json`,
          etag: 'etag_package_123',
          versionId: 'v_pkg_1',
          contentType: 'application/json',
          raw: {
            ETag: '"etag_package_123"',
            VersionId: 'v_pkg_1'
          }
        }
      });
    });

    test('should support custom key override and infer content type', async () => {
      const sampleFilePath = path.join(process.cwd(), 'README.md');

      mockClient.send.mockResolvedValueOnce({
        ETag: '"etag_readme_123"'
      });

      const result = await provider.upload({
        file: sampleFilePath,
        key: 'docs/custom-readme.md'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command.input.Key).toBe('docs/custom-readme.md');
      expect(result.data.key).toBe('docs/custom-readme.md');
    });

    test('should convert AWS SDK upload error to IntegrationError', async () => {
      const sampleFilePath = path.join(process.cwd(), 'package.json');
      mockClient.send.mockRejectedValueOnce(new Error('S3 Connection Timeout'));

      await expect(
        provider.upload({ file: sampleFilePath })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('uploadBuffer()', () => {
    test('should reject invalid or non-Buffer values', async () => {
      await expect(provider.uploadBuffer({})).rejects.toThrow(ValidationError);
      await expect(provider.uploadBuffer({ buffer: 'not a buffer', key: 'file.txt' })).rejects.toThrow(ValidationError);
      await expect(provider.uploadBuffer({ buffer: Buffer.alloc(0), key: 'file.txt' })).rejects.toThrow(ValidationError);
    });

    test('should validate required key', async () => {
      const buf = Buffer.from('test content');
      await expect(provider.uploadBuffer({ buffer: buf })).rejects.toThrow(ValidationError);
      await expect(provider.uploadBuffer({ buffer: buf, key: '' })).rejects.toThrow(ValidationError);
    });

    test('should successfully upload buffer using PutObjectCommand', async () => {
      const buf = Buffer.from('Hello S3 Buffer');
      mockClient.send.mockResolvedValueOnce({
        ETag: '"buffer_etag_456"',
        VersionId: 'v_buf_2'
      });

      const result = await provider.uploadBuffer({
        buffer: buf,
        key: 'greetings.txt',
        folder: 'texts',
        contentType: 'text/plain'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockBucket,
        Key: 'texts/greetings.txt',
        Body: buf,
        ContentType: 'text/plain'
      });

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'texts/greetings.txt',
          bucket: mockBucket,
          url: `https://${mockBucket}.s3.${mockRegion}.amazonaws.com/texts/greetings.txt`,
          etag: 'buffer_etag_456',
          versionId: 'v_buf_2',
          contentType: 'text/plain',
          raw: {
            ETag: '"buffer_etag_456"',
            VersionId: 'v_buf_2'
          }
        }
      });
    });

    test('should handle uploadBuffer failure properly', async () => {
      const buf = Buffer.from('data');
      mockClient.send.mockRejectedValueOnce({
        name: 'NoSuchBucket',
        message: 'The specified bucket does not exist',
        $metadata: { httpStatusCode: 404 }
      });

      try {
        await provider.uploadBuffer({ buffer: buf, key: 'file.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.statusCode).toBe(404);
        expect(err.provider).toBe('s3');
      }
    });
  });

  describe('uploadStream()', () => {
    test('should reject invalid streams or missing key', async () => {
      await expect(provider.uploadStream({})).rejects.toThrow(ValidationError);
      await expect(provider.uploadStream({ stream: 'not a stream', key: 'data.csv' })).rejects.toThrow(ValidationError);
      const stream = Readable.from(['chunk 1', 'chunk 2']);
      await expect(provider.uploadStream({ stream })).rejects.toThrow(ValidationError);
      await expect(provider.uploadStream({ stream, key: '' })).rejects.toThrow(ValidationError);
    });

    test('should successfully upload stream via multipart Upload', async () => {
      const stream = Readable.from(['stream data']);

      const result = await provider.uploadStream({
        stream,
        key: 'large-data.csv',
        folder: 'reports',
        contentType: 'text/csv'
      });

      expect(mockUploadFactory).toHaveBeenCalledTimes(1);
      expect(mockUploadFactory).toHaveBeenCalledWith({
        client: mockClient,
        params: {
          Bucket: mockBucket,
          Key: 'reports/large-data.csv',
          Body: stream,
          ContentType: 'text/csv'
        }
      });

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'reports/large-data.csv',
          bucket: mockBucket,
          url: `https://${mockBucket}.s3.amazonaws.com/reports/large-data.csv`,
          etag: 'stream_etag_123',
          versionId: 'v_stream_1',
          contentType: 'text/csv',
          raw: {
            Location: `https://${mockBucket}.s3.amazonaws.com/reports/large-data.csv`,
            ETag: '"stream_etag_123"',
            VersionId: 'v_stream_1'
          }
        }
      });
    });

    test('should handle stream upload failure', async () => {
      const stream = Readable.from(['fail stream']);
      mockUploadFactory.mockImplementationOnce(() => ({
        done: jest.fn().mockRejectedValueOnce(new Error('Multipart upload failed'))
      }));

      await expect(
        provider.uploadStream({ stream, key: 'fail.dat' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('delete()', () => {
    test('should validate required key', async () => {
      await expect(provider.delete({})).rejects.toThrow(ValidationError);
      await expect(provider.delete({ key: '' })).rejects.toThrow(ValidationError);
      await expect(provider.delete({ key: '   ' })).rejects.toThrow(ValidationError);
    });

    test('should successfully delete object with DeleteObjectCommand', async () => {
      mockClient.send.mockResolvedValueOnce({
        DeleteMarker: true
      });

      const result = await provider.delete({ key: 'uploads/item.png' });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockBucket,
        Key: 'uploads/item.png'
      });

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'uploads/item.png',
          deleted: true,
          raw: {
            DeleteMarker: true
          }
        }
      });
    });

    test('should handle delete failure properly', async () => {
      mockClient.send.mockRejectedValueOnce(new Error('Access Denied'));

      await expect(
        provider.delete({ key: 'secret.txt' })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('getUrl()', () => {
    test('should validate required key', async () => {
      await expect(provider.getUrl({})).rejects.toThrow(ValidationError);
      await expect(provider.getUrl({ key: '' })).rejects.toThrow(ValidationError);
    });

    test('should return standard public URL when signed is false', async () => {
      const result = await provider.getUrl({
        key: 'photos/vacation.jpg',
        signed: false
      });

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'photos/vacation.jpg',
          url: `https://${mockBucket}.s3.${mockRegion}.amazonaws.com/photos/vacation.jpg`,
          signed: false,
          expiresIn: undefined
        }
      });
    });

    test('should compute custom endpoint URLs correctly', async () => {
      const customProvider = new S3Provider({
        accessKeyId: mockAccessKeyId,
        secretAccessKey: mockSecretAccessKey,
        region: mockRegion,
        bucket: mockBucket,
        endpoint: 'https://r2.cloudflarestorage.com',
        forcePathStyle: true,
        client: mockClient
      });

      const result = await customProvider.getUrl({
        key: 'assets/logo.svg',
        signed: false
      });

      expect(result.data.url).toBe(`https://r2.cloudflarestorage.com/${mockBucket}/assets/logo.svg`);
    });

    test('should generate pre-signed URL when signed is true', async () => {
      mockPresigner.mockResolvedValueOnce('https://my-app-uploads.s3.ap-south-1.amazonaws.com/private/doc.pdf?X-Amz-Signature=mock123');

      const result = await provider.getUrl({
        key: 'private/doc.pdf',
        signed: true,
        expiresIn: 1800
      });

      expect(mockPresigner).toHaveBeenCalledTimes(1);
      const command = mockPresigner.mock.calls[0][1];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockBucket,
        Key: 'private/doc.pdf'
      });
      expect(mockPresigner.mock.calls[0][2]).toEqual({ expiresIn: 1800 });

      expect(result).toEqual({
        success: true,
        provider: 's3',
        data: {
          key: 'private/doc.pdf',
          url: 'https://my-app-uploads.s3.ap-south-1.amazonaws.com/private/doc.pdf?X-Amz-Signature=mock123',
          signed: true,
          expiresIn: 1800
        }
      });
    });

    test('should validate expiresIn for signed URLs', async () => {
      await expect(provider.getUrl({ key: 'doc.pdf', signed: true, expiresIn: 0 })).rejects.toThrow(ValidationError);
      await expect(provider.getUrl({ key: 'doc.pdf', signed: true, expiresIn: -50 })).rejects.toThrow(ValidationError);
      await expect(provider.getUrl({ key: 'doc.pdf', signed: true, expiresIn: 30.5 })).rejects.toThrow(ValidationError);
    });

    test('should handle presigner failure', async () => {
      mockPresigner.mockRejectedValueOnce(new Error('Signing key failed'));

      await expect(
        provider.getUrl({ key: 'doc.pdf', signed: true })
      ).rejects.toThrow(IntegrationError);
    });
  });

  describe('Error Handling & Security', () => {
    test('should map AccessDenied error to AUTHENTICATION_ERROR', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'AccessDenied',
        message: 'User is not authorized to perform: s3:PutObject',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.uploadBuffer({ buffer: Buffer.from('data'), key: 'test.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(403);
        expect(err.provider).toBe('s3');
      }
    });

    test('should map InvalidAccessKeyId to AUTHENTICATION_ERROR', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'InvalidAccessKeyId',
        message: 'The AWS Access Key Id you provided does not exist in our records.',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.uploadBuffer({ buffer: Buffer.from('data'), key: 'test.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    test('should map SignatureDoesNotMatch to AUTHENTICATION_ERROR', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'SignatureDoesNotMatch',
        message: 'The request signature we calculated does not match the signature you provided.',
        $metadata: { httpStatusCode: 403 }
      });

      try {
        await provider.uploadBuffer({ buffer: Buffer.from('data'), key: 'test.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    test('should map NoSuchBucket to PROVIDER_ERROR', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'NoSuchBucket',
        message: 'The specified bucket does not exist',
        $metadata: { httpStatusCode: 404 }
      });

      try {
        await provider.delete({ key: 'test.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(404);
      }
    });

    test('should never expose credentials in error messages or details', async () => {
      mockClient.send.mockRejectedValueOnce({
        name: 'InternalError',
        message: `AWS S3 server error occurred with key ${mockSecretAccessKey}`
      });

      try {
        await provider.delete({ key: 'item.png' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.details).not.toMatchObject({ secretAccessKey: expect.anything() });
      }
    });
  });
});
