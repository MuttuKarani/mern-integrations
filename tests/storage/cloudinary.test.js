import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  createStorageProvider,
  StorageProvider,
  CloudinaryProvider,
  IntegrationError,
  ValidationError
} from '../../src/index.js';

describe('StorageProvider & Cloudinary Integration', () => {
  const mockCloudName = 'demo_cloud';
  const mockApiKey = 'mock_api_key_12345';
  const mockApiSecret = 'mock_api_secret_67890';

  let mockClient;
  let provider;

  beforeEach(() => {
    mockClient = {
      uploader: {
        upload: jest.fn(),
        upload_stream: jest.fn(),
        destroy: jest.fn()
      },
      url: jest.fn()
    };

    provider = new CloudinaryProvider({
      cloudName: mockCloudName,
      apiKey: mockApiKey,
      apiSecret: mockApiSecret,
      client: mockClient
    });
  });

  describe('Abstract StorageProvider Base Class', () => {
    test('should prevent direct instantiation of StorageProvider', () => {
      expect(() => new StorageProvider('test')).toThrow(IntegrationError);
      expect(() => new StorageProvider('test')).toThrow('abstract class');
    });

    test('unimplemented subclass abstract methods should throw IntegrationError', async () => {
      class UnimplementedStorageProvider extends StorageProvider {
        constructor() {
          super('custom-storage');
        }
      }

      const dummy = new UnimplementedStorageProvider();
      await expect(dummy.upload({})).rejects.toThrow(IntegrationError);
      await expect(dummy.delete({})).rejects.toThrow(IntegrationError);
      expect(() => dummy.getUrl({})).toThrow(IntegrationError);
    });

    test('unsupported optional methods should throw IntegrationError with UNSUPPORTED_OPERATION (501)', async () => {
      class BasicStorageProvider extends StorageProvider {
        constructor() {
          super('basic-storage');
        }
      }

      const dummy = new BasicStorageProvider();
      try {
        await dummy.uploadBuffer({});
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
      }

      try {
        await dummy.uploadStream({});
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('UNSUPPORTED_OPERATION');
        expect(err.statusCode).toBe(501);
      }
    });

    test('normalizeSuccess and normalizeError format responses accurately', () => {
      const successRes = provider.normalizeSuccess({ id: 'item_1' });
      expect(successRes).toEqual({
        success: true,
        provider: 'cloudinary',
        data: { id: 'item_1' }
      });

      const errorRes = provider.normalizeError('UPLOAD_FAILED', 'Failed to upload', { file: 'test.png' });
      expect(errorRes).toEqual({
        success: false,
        provider: 'cloudinary',
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload',
          details: { file: 'test.png' }
        }
      });
    });
  });

  describe('StorageFactory', () => {
    test('should create CloudinaryProvider when provider is "cloudinary"', () => {
      const p = createStorageProvider({
        provider: 'cloudinary',
        cloudName: mockCloudName,
        apiKey: mockApiKey,
        apiSecret: mockApiSecret
      });

      expect(p).toBeInstanceOf(CloudinaryProvider);
      expect(p.name).toBe('cloudinary');
    });

    test('provider matching should be case-insensitive and trim whitespace', () => {
      const p1 = createStorageProvider({ provider: 'CLOUDINARY', cloudName: mockCloudName, apiKey: mockApiKey, apiSecret: mockApiSecret });
      const p2 = createStorageProvider({ provider: '  cloudinary  ', cloudName: mockCloudName, apiKey: mockApiKey, apiSecret: mockApiSecret });
      const p3 = createStorageProvider({ provider: 'Cloudinary', cloudName: mockCloudName, apiKey: mockApiKey, apiSecret: mockApiSecret });

      expect(p1).toBeInstanceOf(CloudinaryProvider);
      expect(p2).toBeInstanceOf(CloudinaryProvider);
      expect(p3).toBeInstanceOf(CloudinaryProvider);
    });

    test('should throw ValidationError if config is missing or invalid', () => {
      expect(() => createStorageProvider(null)).toThrow(ValidationError);
      expect(() => createStorageProvider({})).toThrow(ValidationError);
      expect(() => createStorageProvider({ provider: '' })).toThrow(ValidationError);
    });

    test('should throw IntegrationError for unsupported storage providers', () => {
      expect(() =>
        createStorageProvider({ provider: 'aws-s3', cloudName: 'test', apiKey: 'k', apiSecret: 's' })
      ).toThrow(IntegrationError);

      try {
        createStorageProvider({ provider: 'gcp-storage', cloudName: 'test', apiKey: 'k', apiSecret: 's' });
      } catch (error) {
        expect(error.code).toBe('UNSUPPORTED_PROVIDER');
        expect(error.statusCode).toBe(400);
        expect(error.provider).toBe('gcp-storage');
      }
    });
  });

  describe('CloudinaryProvider Constructor', () => {
    test('should throw ValidationError if cloudName is missing, empty, or whitespace', () => {
      expect(() => new CloudinaryProvider({ apiKey: mockApiKey, apiSecret: mockApiSecret })).toThrow(ValidationError);
      expect(() => new CloudinaryProvider({ cloudName: '', apiKey: mockApiKey, apiSecret: mockApiSecret })).toThrow(ValidationError);
      expect(() => new CloudinaryProvider({ cloudName: '   ', apiKey: mockApiKey, apiSecret: mockApiSecret })).toThrow(ValidationError);
    });

    test('should throw ValidationError if apiKey is missing, empty, or whitespace', () => {
      expect(() => new CloudinaryProvider({ cloudName: mockCloudName, apiSecret: mockApiSecret })).toThrow(ValidationError);
      expect(() => new CloudinaryProvider({ cloudName: mockCloudName, apiKey: '', apiSecret: mockApiSecret })).toThrow(ValidationError);
    });

    test('should throw ValidationError if apiSecret is missing, empty, or whitespace', () => {
      expect(() => new CloudinaryProvider({ cloudName: mockCloudName, apiKey: mockApiKey })).toThrow(ValidationError);
      expect(() => new CloudinaryProvider({ cloudName: mockCloudName, apiKey: mockApiKey, apiSecret: '' })).toThrow(ValidationError);
    });

    test('should instantiate successfully with valid credentials and not expose private fields', () => {
      const p = new CloudinaryProvider({
        cloudName: mockCloudName,
        apiKey: mockApiKey,
        apiSecret: mockApiSecret
      });

      expect(p).toBeInstanceOf(CloudinaryProvider);
      expect(p.apiSecret).toBeUndefined();
      expect(p['#apiSecret']).toBeUndefined();
      expect(JSON.stringify(p)).not.toContain(mockApiSecret);
    });
  });

  describe('upload()', () => {
    test('should validate required file parameter', async () => {
      await expect(provider.upload({})).rejects.toThrow(ValidationError);
      await expect(provider.upload({ file: '' })).rejects.toThrow(ValidationError);
      await expect(provider.upload({ file: '   ' })).rejects.toThrow(ValidationError);
    });

    test('should successfully upload file and map parameters to Cloudinary SDK', async () => {
      const mockResult = {
        public_id: 'samples/shoes',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/shoes.jpg',
        url: 'http://res.cloudinary.com/demo/image/upload/v1/samples/shoes.jpg',
        resource_type: 'image',
        format: 'jpg',
        bytes: 10240,
        width: 800,
        height: 600,
        created_at: '2026-09-04T12:00:00Z'
      };

      mockClient.uploader.upload.mockResolvedValueOnce(mockResult);

      const result = await provider.upload({
        file: './uploads/shoes.jpg',
        folder: 'samples',
        publicId: 'shoes',
        overwrite: true,
        tags: ['footwear', 'sale'],
        transformation: { width: 500, crop: 'scale' }
      });

      expect(mockClient.uploader.upload).toHaveBeenCalledWith('./uploads/shoes.jpg', {
        resource_type: 'auto',
        folder: 'samples',
        public_id: 'shoes',
        overwrite: true,
        tags: ['footwear', 'sale'],
        transformation: { width: 500, crop: 'scale' }
      });

      expect(result).toEqual({
        success: true,
        provider: 'cloudinary',
        data: {
          publicId: 'samples/shoes',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/shoes.jpg',
          url: 'http://res.cloudinary.com/demo/image/upload/v1/samples/shoes.jpg',
          resourceType: 'image',
          format: 'jpg',
          bytes: 10240,
          width: 800,
          height: 600,
          createdAt: '2026-09-04T12:00:00Z',
          raw: mockResult
        }
      });
    });

    test('should convert Cloudinary upload error to IntegrationError', async () => {
      mockClient.uploader.upload.mockRejectedValueOnce({
        message: 'Invalid image file',
        http_code: 400
      });

      try {
        await provider.upload({ file: 'invalid.txt' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('PROVIDER_ERROR');
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Invalid image file');
        expect(err.provider).toBe('cloudinary');
      }
    });

    test('should map 401 error to AUTHENTICATION_ERROR', async () => {
      mockClient.uploader.upload.mockRejectedValueOnce({
        message: 'Invalid API key or secret',
        http_code: 401
      });

      try {
        await provider.upload({ file: 'test.jpg' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.code).toBe('AUTHENTICATION_ERROR');
        expect(err.statusCode).toBe(401);
      }
    });
  });

  describe('uploadBuffer()', () => {
    test('should reject non-Buffer values with ValidationError', async () => {
      await expect(provider.uploadBuffer({})).rejects.toThrow(ValidationError);
      await expect(provider.uploadBuffer({ buffer: 'not a buffer' })).rejects.toThrow(ValidationError);
      await expect(provider.uploadBuffer({ buffer: [1, 2, 3] })).rejects.toThrow(ValidationError);
    });

    test('should successfully upload buffer using upload_stream', async () => {
      const sampleBuffer = Buffer.from('fake image binary content');
      const mockResult = {
        public_id: 'invoices/inv_123',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/invoices/inv_123.png',
        url: 'http://res.cloudinary.com/demo/image/upload/v1/invoices/inv_123.png',
        resource_type: 'image',
        format: 'png',
        bytes: 512,
        width: 300,
        height: 200,
        created_at: '2026-09-04T12:00:00Z'
      };

      mockClient.uploader.upload_stream.mockImplementation((options, callback) => {
        const stream = new EventEmitter();
        stream.end = (buf) => {
          expect(buf).toBe(sampleBuffer);
          callback(null, mockResult);
        };
        return stream;
      });

      const result = await provider.uploadBuffer({
        buffer: sampleBuffer,
        folder: 'invoices',
        publicId: 'inv_123'
      });

      expect(mockClient.uploader.upload_stream).toHaveBeenCalledWith(
        {
          resource_type: 'auto',
          folder: 'invoices',
          public_id: 'inv_123'
        },
        expect.any(Function)
      );

      expect(result).toEqual({
        success: true,
        provider: 'cloudinary',
        data: {
          publicId: 'invoices/inv_123',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/invoices/inv_123.png',
          url: 'http://res.cloudinary.com/demo/image/upload/v1/invoices/inv_123.png',
          resourceType: 'image',
          format: 'png',
          bytes: 512,
          width: 300,
          height: 200,
          createdAt: '2026-09-04T12:00:00Z',
          raw: mockResult
        }
      });
    });

    test('should handle upload stream callback error', async () => {
      const sampleBuffer = Buffer.from('bad stream');
      mockClient.uploader.upload_stream.mockImplementation((options, callback) => {
        const stream = new EventEmitter();
        stream.end = () => {
          callback(new Error('Corrupted stream'));
        };
        return stream;
      });

      await expect(provider.uploadBuffer({ buffer: sampleBuffer })).rejects.toThrow(IntegrationError);
    });

    test('should handle stream error events', async () => {
      const sampleBuffer = Buffer.from('broken pipe');
      mockClient.uploader.upload_stream.mockImplementation((options, callback) => {
        const stream = new EventEmitter();
        stream.end = () => {
          stream.emit('error', new Error('Stream pipe broken'));
        };
        return stream;
      });

      await expect(provider.uploadBuffer({ buffer: sampleBuffer })).rejects.toThrow(IntegrationError);
    });
  });

  describe('delete()', () => {
    test('should validate required publicId', async () => {
      await expect(provider.delete({})).rejects.toThrow(ValidationError);
      await expect(provider.delete({ publicId: '' })).rejects.toThrow(ValidationError);
    });

    test('should successfully delete asset and map destroy parameters', async () => {
      const mockResult = { result: 'ok' };
      mockClient.uploader.destroy.mockResolvedValueOnce(mockResult);

      const result = await provider.delete({
        publicId: 'samples/shoes',
        resourceType: 'image',
        invalidate: true
      });

      expect(mockClient.uploader.destroy).toHaveBeenCalledWith('samples/shoes', {
        resource_type: 'image',
        invalidate: true
      });

      expect(result).toEqual({
        success: true,
        provider: 'cloudinary',
        data: {
          publicId: 'samples/shoes',
          result: 'ok',
          raw: mockResult
        }
      });
    });

    test('should convert delete failure into IntegrationError', async () => {
      mockClient.uploader.destroy.mockRejectedValueOnce({
        message: 'Asset not found',
        http_code: 404
      });

      try {
        await provider.delete({ publicId: 'non_existing' });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Asset not found');
      }
    });
  });

  describe('getUrl()', () => {
    test('should validate required publicId', () => {
      expect(() => provider.getUrl({})).toThrow(ValidationError);
      expect(() => provider.getUrl({ publicId: '' })).toThrow(ValidationError);
    });

    test('should generate secure URL by default with transformations', () => {
      mockClient.url.mockReturnValueOnce('https://res.cloudinary.com/demo/image/upload/w_300,h_200/sample.jpg');

      const result = provider.getUrl({
        publicId: 'sample',
        transformation: { width: 300, height: 200 }
      });

      expect(mockClient.url).toHaveBeenCalledWith('sample', {
        resource_type: 'image',
        secure: true,
        transformation: { width: 300, height: 200 }
      });

      expect(result).toEqual({
        success: true,
        provider: 'cloudinary',
        data: {
          publicId: 'sample',
          url: 'https://res.cloudinary.com/demo/image/upload/w_300,h_200/sample.jpg'
        }
      });
    });

    test('should allow disabling secure URL', () => {
      mockClient.url.mockReturnValueOnce('http://res.cloudinary.com/demo/image/upload/sample.jpg');

      const result = provider.getUrl({
        publicId: 'sample',
        secure: false
      });

      expect(mockClient.url).toHaveBeenCalledWith('sample', {
        resource_type: 'image',
        secure: false
      });

      expect(result.data.url).toBe('http://res.cloudinary.com/demo/image/upload/sample.jpg');
    });
  });
});
