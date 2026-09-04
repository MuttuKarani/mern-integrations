import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from '../../interfaces/StorageProvider.js';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';
import { validateRequiredString } from '../../../core/utils/validators.js';

/**
 * AWS S3 Storage Provider implementation.
 */
export class S3Provider extends StorageProvider {
  /** @type {S3Client} */
  #client;

  /** @type {string} */
  #region;

  /** @type {string} */
  #bucket;

  /** @type {string} */
  #accessKeyId;

  /** @type {string} */
  #secretAccessKey;

  /** @type {string|null} */
  #endpoint;

  /** @type {boolean} */
  #forcePathStyle;

  /** @type {typeof getSignedUrl} */
  #presigner;

  /** @type {typeof Upload} */
  #uploadFactory;

  /**
   * @param {Object} config
   * @param {string} config.accessKeyId - AWS Access Key ID.
   * @param {string} config.secretAccessKey - AWS Secret Access Key.
   * @param {string} config.region - AWS Region (e.g. 'ap-south-1', 'us-east-1').
   * @param {string} config.bucket - S3 Bucket name.
   * @param {string} [config.endpoint] - Optional custom endpoint for S3-compatible providers (e.g. MinIO, Cloudflare R2).
   * @param {boolean} [config.forcePathStyle=false] - Whether to force path-style S3 URLs.
   * @param {S3Client} [config.client] - Custom S3Client instance for testing/mocking.
   * @param {typeof getSignedUrl} [config.presigner] - Custom presigner function for testing.
   * @param {typeof Upload} [config.uploadFactory] - Custom Upload class for testing.
   * @throws {ValidationError} If any required configuration parameter is missing or invalid.
   */
  constructor({
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    endpoint = null,
    forcePathStyle = false,
    client = null,
    presigner = null,
    uploadFactory = null
  } = {}) {
    super('s3');

    validateRequiredString(accessKeyId, 'accessKeyId', 's3');
    validateRequiredString(secretAccessKey, 'secretAccessKey', 's3');
    validateRequiredString(region, 'region', 's3');
    validateRequiredString(bucket, 'bucket', 's3');

    this.#accessKeyId = accessKeyId.trim();
    this.#secretAccessKey = secretAccessKey.trim();
    this.#region = region.trim();
    this.#bucket = bucket.trim();
    this.#endpoint = endpoint ? String(endpoint).trim() : null;
    this.#forcePathStyle = Boolean(forcePathStyle);
    this.#presigner = presigner || getSignedUrl;
    this.#uploadFactory = uploadFactory || Upload;

    if (client) {
      this.#client = client;
    } else {
      const clientConfig = {
        region: this.#region,
        credentials: {
          accessKeyId: this.#accessKeyId,
          secretAccessKey: this.#secretAccessKey
        }
      };

      if (this.#endpoint) {
        clientConfig.endpoint = this.#endpoint;
      }

      if (this.#forcePathStyle !== undefined) {
        clientConfig.forcePathStyle = this.#forcePathStyle;
      }

      this.#client = new S3Client(clientConfig);
    }
  }

  /**
   * Uploads a local file to S3 bucket.
   *
   * @param {Object} params
   * @param {string} params.file - Local file path.
   * @param {string} [params.key] - Custom object key.
   * @param {string} [params.folder] - Destination folder path inside bucket.
   * @param {string} [params.contentType] - MIME type of the file.
   * @param {Object} [params.metadata] - Key-value metadata tags.
   * @param {string} [params.cacheControl] - HTTP Cache-Control header.
   * @param {string} [params.acl] - S3 ACL (e.g. 'private', 'public-read').
   * @param {Object} [params.extraOptions] - Additional PutObject parameters.
   * @returns {Promise<{success: true, provider: 's3', data: Object}>}
   * @throws {ValidationError} If file is missing or invalid.
   * @throws {IntegrationError} If upload fails.
   */
  async upload({
    file,
    key,
    folder,
    contentType,
    metadata,
    cacheControl,
    acl,
    ...extraOptions
  } = {}) {
    validateRequiredString(file, 'file', 's3');

    const fileName = path.basename(file);
    const resolvedKey = this.#buildKey(folder, key, fileName);

    try {
      const fileBuffer = await fs.promises.readFile(file);
      const inferredContentType = contentType || this.#inferContentType(file);

      const command = new PutObjectCommand({
        Bucket: this.#bucket,
        Key: resolvedKey,
        Body: fileBuffer,
        ...(inferredContentType ? { ContentType: inferredContentType } : {}),
        ...(metadata ? { Metadata: metadata } : {}),
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
        ...(acl ? { ACL: acl } : {}),
        ...extraOptions
      });

      const result = await this.#client.send(command);

      return this.normalizeSuccess({
        key: resolvedKey,
        bucket: this.#bucket,
        url: this.#computePublicUrl(resolvedKey),
        etag: result?.ETag ? result.ETag.replace(/"/g, '') : null,
        versionId: result?.VersionId || null,
        contentType: inferredContentType || null,
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'S3 file upload failed');
    }
  }

  /**
   * Uploads an in-memory Buffer to S3.
   *
   * @param {Object} params
   * @param {Buffer} params.buffer - In-memory file Buffer.
   * @param {string} params.key - Object key (or filename).
   * @param {string} [params.folder] - Destination folder.
   * @param {string} [params.contentType] - MIME type of the buffer content.
   * @param {Object} [params.metadata] - Custom metadata.
   * @param {string} [params.cacheControl] - HTTP Cache-Control header.
   * @param {string} [params.acl] - S3 ACL.
   * @param {Object} [params.extraOptions] - Additional PutObject parameters.
   * @returns {Promise<{success: true, provider: 's3', data: Object}>}
   * @throws {ValidationError} If buffer or key is invalid.
   * @throws {IntegrationError} If upload fails.
   */
  async uploadBuffer({
    buffer,
    key,
    folder,
    contentType,
    metadata,
    cacheControl,
    acl,
    ...extraOptions
  } = {}) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError("Field 'buffer' is required and must be a non-empty Buffer", {
        provider: 's3',
        details: { field: 'buffer' }
      });
    }

    validateRequiredString(key, 'key', 's3');
    const resolvedKey = this.#buildKey(folder, key, key);

    try {
      const command = new PutObjectCommand({
        Bucket: this.#bucket,
        Key: resolvedKey,
        Body: buffer,
        ...(contentType ? { ContentType: contentType } : {}),
        ...(metadata ? { Metadata: metadata } : {}),
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
        ...(acl ? { ACL: acl } : {}),
        ...extraOptions
      });

      const result = await this.#client.send(command);

      return this.normalizeSuccess({
        key: resolvedKey,
        bucket: this.#bucket,
        url: this.#computePublicUrl(resolvedKey),
        etag: result?.ETag ? result.ETag.replace(/"/g, '') : null,
        versionId: result?.VersionId || null,
        contentType: contentType || null,
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'S3 buffer upload failed');
    }
  }

  /**
   * Uploads a readable stream to S3 using multipart upload.
   *
   * @param {Object} params
   * @param {import('stream').Readable} params.stream - Readable stream.
   * @param {string} params.key - Object key.
   * @param {string} [params.folder] - Destination folder.
   * @param {string} [params.contentType] - MIME type.
   * @param {Object} [params.metadata] - Custom metadata.
   * @param {string} [params.cacheControl] - HTTP Cache-Control header.
   * @param {Object} [params.extraOptions] - Additional Upload parameters.
   * @returns {Promise<{success: true, provider: 's3', data: Object}>}
   * @throws {ValidationError} If stream or key is invalid.
   * @throws {IntegrationError} If stream upload fails.
   */
  async uploadStream({
    stream,
    key,
    folder,
    contentType,
    metadata,
    cacheControl,
    ...extraOptions
  } = {}) {
    if (!stream || typeof stream.pipe !== 'function' || typeof stream.on !== 'function') {
      throw new ValidationError("Field 'stream' is required and must be a readable stream", {
        provider: 's3',
        details: { field: 'stream' }
      });
    }

    validateRequiredString(key, 'key', 's3');
    const resolvedKey = this.#buildKey(folder, key, key);

    try {
      const UploadClass = this.#uploadFactory;
      const parallelUpload = new UploadClass({
        client: this.#client,
        params: {
          Bucket: this.#bucket,
          Key: resolvedKey,
          Body: stream,
          ...(contentType ? { ContentType: contentType } : {}),
          ...(metadata ? { Metadata: metadata } : {}),
          ...(cacheControl ? { CacheControl: cacheControl } : {}),
          ...extraOptions
        }
      });

      const result = await parallelUpload.done();

      return this.normalizeSuccess({
        key: resolvedKey,
        bucket: this.#bucket,
        url: result?.Location || this.#computePublicUrl(resolvedKey),
        etag: result?.ETag ? result.ETag.replace(/"/g, '') : null,
        versionId: result?.VersionId || null,
        contentType: contentType || null,
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'S3 stream upload failed');
    }
  }

  /**
   * Deletes an object from S3 bucket.
   *
   * @param {Object} params
   * @param {string} params.key - Object key to delete.
   * @param {Object} [params.extraOptions] - Additional DeleteObject parameters.
   * @returns {Promise<{success: true, provider: 's3', data: Object}>}
   * @throws {ValidationError} If key is missing.
   * @throws {IntegrationError} If deletion fails.
   */
  async delete({ key, ...extraOptions } = {}) {
    validateRequiredString(key, 'key', 's3');

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        ...extraOptions
      });

      const result = await this.#client.send(command);

      return this.normalizeSuccess({
        key,
        deleted: true,
        raw: result
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'S3 delete failed');
    }
  }

  /**
   * Generates public or pre-signed URL for an S3 asset.
   *
   * @param {Object} params
   * @param {string} params.key - Object key.
   * @param {number} [params.expiresIn=3600] - Expiry time in seconds (only for signed URLs).
   * @param {boolean} [params.signed=false] - Whether to generate a pre-signed temporary URL.
   * @param {Object} [params.extraOptions] - Additional GetObject parameters.
   * @returns {Promise<{success: true, provider: 's3', data: {key: string, url: string, signed: boolean, expiresIn?: number}}>}
   * @throws {ValidationError} If key or expiresIn validation fails.
   * @throws {IntegrationError} If pre-signing fails.
   */
  async getUrl({
    key,
    expiresIn = 3600,
    signed = false,
    ...extraOptions
  } = {}) {
    validateRequiredString(key, 'key', 's3');

    if (!signed) {
      return this.normalizeSuccess({
        key,
        url: this.#computePublicUrl(key),
        signed: false,
        expiresIn: undefined
      });
    }

    if (typeof expiresIn !== 'number' || !Number.isInteger(expiresIn) || expiresIn <= 0) {
      throw new ValidationError("Field 'expiresIn' must be a positive integer representing seconds", {
        provider: 's3',
        details: { field: 'expiresIn', received: expiresIn }
      });
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        ...extraOptions
      });

      const url = await this.#presigner(this.#client, command, { expiresIn });

      return this.normalizeSuccess({
        key,
        url,
        signed: true,
        expiresIn
      });
    } catch (error) {
      throw this.#handleProviderError(error, 'Failed to generate S3 pre-signed URL');
    }
  }

  /**
   * Constructs the object key from folder and filename.
   *
   * @param {string} [folder]
   * @param {string} [key]
   * @param {string} fallback
   * @returns {string}
   * @private
   */
  #buildKey(folder, key, fallback) {
    const rawKey = key ? key.trim() : fallback;
    const cleanKey = rawKey.replace(/^\/+/g, '');

    if (folder && folder.trim()) {
      const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, '');
      return `${cleanFolder}/${cleanKey}`;
    }

    return cleanKey;
  }

  /**
   * Infers MIME content type from file extension.
   *
   * @param {string} filePath
   * @returns {string|null}
   * @private
   */
  #inferContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg'
    };
    return mimeMap[ext] || null;
  }

  /**
   * Computes standard S3 public URL.
   *
   * @param {string} key
   * @returns {string}
   * @private
   */
  #computePublicUrl(key) {
    const encodedKey = key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    if (this.#endpoint) {
      const cleanEndpoint = this.#endpoint.replace(/\/+$/, '');
      if (this.#forcePathStyle) {
        return `${cleanEndpoint}/${this.#bucket}/${encodedKey}`;
      }
      return `${cleanEndpoint}/${this.#bucket}/${encodedKey}`;
    }

    return `https://${this.#bucket}.s3.${this.#region}.amazonaws.com/${encodedKey}`;
  }

  /**
   * Normalizes AWS SDK errors without exposing credentials.
   *
   * @param {*} error
   * @param {string} fallbackMessage
   * @returns {IntegrationError}
   * @private
   */
  #handleProviderError(error, fallbackMessage) {
    if (error instanceof IntegrationError || error instanceof ValidationError) {
      return error;
    }

    const errorName = error?.name || error?.Code || '';
    const statusCode = error?.$metadata?.httpStatusCode || error?.statusCode || 500;
    const message = error?.message || fallbackMessage;

    let code = 'PROVIDER_ERROR';
    if (
      errorName === 'AccessDenied' ||
      errorName === 'InvalidAccessKeyId' ||
      errorName === 'SignatureDoesNotMatch' ||
      errorName === 'InvalidSecurity' ||
      statusCode === 401 ||
      statusCode === 403
    ) {
      code = 'AUTHENTICATION_ERROR';
    }

    return new IntegrationError(message, {
      code,
      statusCode,
      provider: 's3',
      details: errorName ? { name: errorName } : null
    });
  }
}
