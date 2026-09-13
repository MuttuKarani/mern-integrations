import { StorageProvider } from '../storage/interfaces/StorageProvider.js';
import { ValidationError } from '../core/errors/ValidationError.js';
import { validateRequiredString } from '../core/utils/validators.js';

/**
 * In-memory mock storage provider for local development, integration testing, and CI pipelines.
 */
export class MockStorageProvider extends StorageProvider {
  #files;
  #counter;

  /**
   * @param {Object} [config={}] - Optional configuration.
   */
  constructor(config = {}) {
    super('mock');
    this.#files = new Map();
    this.#counter = 0;
  }

  /**
   * List of supported capabilities for MockStorageProvider.
   * @returns {readonly string[]}
   */
  get capabilities() {
    return Object.freeze(['upload', 'uploadBuffer', 'uploadStream', 'delete', 'getUrl']);
  }

  /**
   * Simulates file upload.
   *
   * @param {Object} params
   * @param {string} params.file - File path or dummy string.
   * @param {string} [params.fileName] - Target file name.
   * @param {string} [params.folder] - Target folder.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async upload({ file, fileName, folder, ...extra } = {}) {
    validateRequiredString(file, 'file', 'mock');

    this.#counter++;
    const key = (folder ? `${folder}/` : '') + (fileName || `mock_asset_${this.#counter}`);
    const url = `https://mock-storage.local/${key}`;

    const record = {
      key,
      publicId: key,
      url,
      secureUrl: url,
      bytes: 1024,
      file,
      folder: folder || null,
      uploadedAt: new Date().toISOString(),
      ...extra
    };

    this.#files.set(key, record);

    return this.normalizeSuccess(record);
  }

  /**
   * Simulates Buffer upload into memory.
   *
   * @param {Object} params
   * @param {Buffer} params.buffer - Buffer payload.
   * @param {string} [params.fileName] - Target file name.
   * @param {string} [params.key] - Explicit key/identifier.
   * @param {string} [params.folder] - Target folder.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async uploadBuffer({ buffer, fileName, key, folder, ...extra } = {}) {
    if (!Buffer.isBuffer(buffer)) {
      throw new ValidationError('Buffer parameter must be an instance of Buffer', {
        provider: 'mock',
        details: { receivedType: typeof buffer }
      });
    }

    this.#counter++;
    const assetKey = key || ((folder ? `${folder}/` : '') + (fileName || `mock_buf_${this.#counter}.bin`));
    const url = `https://mock-storage.local/${assetKey}`;

    const record = {
      key: assetKey,
      publicId: assetKey,
      url,
      secureUrl: url,
      bytes: buffer.length,
      buffer,
      folder: folder || null,
      uploadedAt: new Date().toISOString(),
      ...extra
    };

    this.#files.set(assetKey, record);

    return this.normalizeSuccess({
      key: assetKey,
      publicId: assetKey,
      url,
      secureUrl: url,
      bytes: buffer.length
    });
  }

  /**
   * Simulates Stream upload into memory.
   *
   * @param {Object} params
   * @param {Stream} params.stream - Readable stream.
   * @param {string} [params.key] - Explicit key.
   * @param {string} [params.folder] - Target folder.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async uploadStream({ stream, key, folder, ...extra } = {}) {
    if (!stream || (typeof stream.pipe !== 'function' && typeof stream.on !== 'function')) {
      throw new ValidationError('Stream parameter must be a readable stream', {
        provider: 'mock',
        details: { receivedType: typeof stream }
      });
    }

    this.#counter++;
    const assetKey = key || ((folder ? `${folder}/` : '') + `mock_stream_${this.#counter}.bin`);
    const url = `https://mock-storage.local/${assetKey}`;

    const record = {
      key: assetKey,
      publicId: assetKey,
      url,
      secureUrl: url,
      uploadedAt: new Date().toISOString(),
      ...extra
    };

    this.#files.set(assetKey, record);

    return this.normalizeSuccess({
      key: assetKey,
      publicId: assetKey,
      url,
      secureUrl: url
    });
  }

  /**
   * Simulates deleting a stored asset.
   *
   * @param {Object} params
   * @param {string} [params.publicId] - Public ID / key.
   * @param {string} [params.key] - Key / public ID.
   * @returns {Promise<{success: true, provider: 'mock', data: Object}>}
   */
  async delete({ publicId, key } = {}) {
    const target = publicId || key;
    validateRequiredString(target, 'publicId or key', 'mock');

    const existed = this.#files.delete(target);

    return this.normalizeSuccess({
      deleted: true,
      target,
      existed
    });
  }

  /**
   * Generates a simulated public or presigned URL.
   *
   * @param {Object} params
   * @param {string} [params.publicId] - Public ID / key.
   * @param {string} [params.key] - Key.
   * @param {boolean} [params.signed=false] - Whether to generate a signed URL.
   * @param {number} [params.expiresIn=3600] - Expiry in seconds.
   * @returns {string}
   */
  getUrl({ publicId, key, signed = false, expiresIn = 3600 } = {}) {
    const target = publicId || key;
    validateRequiredString(target, 'publicId or key', 'mock');

    return signed
      ? `https://mock-storage.local/${target}?signed=true&expires=${expiresIn}`
      : `https://mock-storage.local/${target}`;
  }

  // --- Testing and Inspection Helpers ---

  /**
   * Retrieves all stored files in memory.
   * @returns {Array<Object>}
   */
  getFiles() {
    return Array.from(this.#files.values());
  }

  /**
   * Retrieves a file record by key.
   * @param {string} key
   * @returns {Object|null}
   */
  getFile(key) {
    return this.#files.get(key) || null;
  }

  /**
   * Clears all stored files from memory.
   */
  clearFiles() {
    this.#files.clear();
    this.#counter = 0;
  }

  /**
   * Reset helper alias for clearFiles.
   */
  reset() {
    this.clearFiles();
  }
}
