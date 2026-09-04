import crypto from 'node:crypto';
import { IntegrationError } from '../../../core/errors/IntegrationError.js';
import { ValidationError } from '../../../core/errors/ValidationError.js';

/**
 * CCAvenue official 16-byte static Initialization Vector (IV).
 * Verified against official CCAvenue Web Integration Kit (ccavutil.js).
 */
const CCAVENUE_IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
]);

/**
 * Derives the 128-bit AES key from the merchant working key by calculating its MD5 digest.
 *
 * @param {string} workingKey - 32-character CCAvenue Working Key.
 * @returns {Buffer} 16-byte binary MD5 key.
 * @throws {ValidationError} If workingKey is not a valid non-empty string.
 */
export function deriveKey(workingKey) {
  if (typeof workingKey !== 'string' || workingKey.trim().length === 0) {
    throw new ValidationError('Working key is required for CCAvenue cryptographic operations', {
      provider: 'ccavenue',
      details: { field: 'workingKey' }
    });
  }

  return crypto.createHash('md5').update(workingKey).digest();
}

/**
 * Encrypts a plaintext query string using AES-128-CBC per official CCAvenue specification.
 *
 * @param {string} plainText - Plaintext parameter query string (e.g. "merchant_id=...&amount=10.00").
 * @param {string} workingKey - Merchant Working Key.
 * @returns {string} Encrypted ciphertext formatted as a hex string.
 * @throws {ValidationError} If plainText is not a string.
 * @throws {IntegrationError} If encryption fails.
 */
export function encrypt(plainText, workingKey) {
  if (typeof plainText !== 'string') {
    throw new ValidationError('Plaintext to encrypt must be a string', {
      provider: 'ccavenue',
      details: { field: 'plainText' }
    });
  }

  try {
    const key = deriveKey(workingKey);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, CCAVENUE_IV);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new IntegrationError('CCAvenue encryption failed', {
      code: 'ENCRYPTION_ERROR',
      statusCode: 500,
      provider: 'ccavenue',
      details: { reason: error.message }
    });
  }
}

/**
 * Decrypts a CCAvenue hex-encoded ciphertext string using AES-128-CBC.
 *
 * @param {string} encText - Hex-encoded encrypted response string.
 * @param {string} workingKey - Merchant Working Key.
 * @returns {string} Decrypted plaintext query string.
 * @throws {ValidationError} If encText is not a valid hex string.
 * @throws {IntegrationError} If decryption fails (e.g. corrupted payload or bad key).
 */
export function decrypt(encText, workingKey) {
  if (typeof encText !== 'string' || encText.trim().length === 0) {
    throw new ValidationError('Encrypted response must be a non-empty hex string', {
      provider: 'ccavenue',
      details: { field: 'encText' }
    });
  }

  // Hex strings must have an even length and contain only hexadecimal characters
  const trimmed = encText.trim();
  if (trimmed.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(trimmed)) {
    throw new ValidationError('Encrypted payload is not a valid hexadecimal string', {
      provider: 'ccavenue',
      details: { field: 'encText' }
    });
  }

  try {
    const key = deriveKey(workingKey);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, CCAVENUE_IV);
    let decrypted = decipher.update(trimmed, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new IntegrationError(
      'Failed to decrypt CCAvenue response. The payload may be corrupted or encrypted with a different working key.',
      {
        code: 'DECRYPTION_ERROR',
        statusCode: 400,
        provider: 'ccavenue',
        details: { reason: error.message }
      }
    );
  }
}

/**
 * Decrypts and parses a CCAvenue encrypted callback query string into a key-value object.
 *
 * @param {string} encResp - Encrypted response hex string received in the callback.
 * @param {string} workingKey - Merchant Working Key.
 * @returns {Record<string, string>} Key-value map of parsed response parameters.
 * @throws {ValidationError|IntegrationError}
 */
export function parseEncryptedResponse(encResp, workingKey) {
  const decryptedText = decrypt(encResp, workingKey);
  const params = new URLSearchParams(decryptedText);
  const result = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}
