import { ValidationError } from '../errors/ValidationError.js';

/**
 * Validates that a value is a non-empty string.
 *
 * @param {*} value - Value to validate.
 * @param {string} fieldName - Name of the field for error reporting.
 * @param {string} [provider='unknown'] - Provider name.
 * @throws {ValidationError}
 */
export function validateRequiredString(value, fieldName, provider = 'unknown') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`Field '${fieldName}' is required and must be a non-empty string`, {
      provider,
      details: { field: fieldName }
    });
  }
}

/**
 * Validates that an amount is a positive integer in the smallest currency unit.
 *
 * @param {*} value - Value to validate.
 * @param {string} [fieldName='amount'] - Name of the field for error reporting.
 * @param {string} [provider='unknown'] - Provider name.
 * @throws {ValidationError}
 */
export function validateAmountInSmallestUnit(value, fieldName = 'amount', provider = 'unknown') {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new ValidationError(
      `Field '${fieldName}' must be a positive integer representing the amount in smallest currency sub-units (e.g., paise for INR: ₹10 = 1000)`,
      {
        provider,
        details: { field: fieldName, received: value }
      }
    );
  }
}

/**
 * Validates that a value is a non-null object.
 *
 * @param {*} value - Value to validate.
 * @param {string} fieldName - Name of the field for error reporting.
 * @param {string} [provider='unknown'] - Provider name.
 * @throws {ValidationError}
 */
export function validateRequiredObject(value, fieldName, provider = 'unknown') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`Field '${fieldName}' is required and must be an object`, {
      provider,
      details: { field: fieldName }
    });
  }
}

/**
 * Validates that a webhook payload is a Buffer or a string.
 *
 * @param {*} value - Value to validate.
 * @param {string} [fieldName='payload'] - Name of the field.
 * @param {string} [provider='unknown'] - Provider name.
 * @throws {ValidationError}
 */
export function validateRawPayload(value, fieldName = 'payload', provider = 'unknown') {
  if (value === undefined || value === null) {
    throw new ValidationError(`Field '${fieldName}' is required for webhook signature verification`, {
      provider,
      details: { field: fieldName }
    });
  }

  const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(value);
  const isString = typeof value === 'string';

  if (!isBuffer && !isString) {
    throw new ValidationError(
      `Field '${fieldName}' must be the exact raw string or Buffer payload received in the HTTP request body`,
      {
        provider,
        details: { field: fieldName }
      }
    );
  }
}
