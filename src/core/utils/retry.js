/**
 * Utility function to execute an asynchronous operation with exponential backoff retries.
 *
 * @template T
 * @param {() => Promise<T>} fn - Asynchronous function to execute.
 * @param {Object} [options={}] - Retry options.
 * @param {number} [options.retries=3] - Maximum number of retry attempts.
 * @param {number} [options.minTimeout=200] - Initial delay in milliseconds before first retry.
 * @param {number} [options.maxTimeout=3000] - Maximum delay in milliseconds between retries.
 * @param {number} [options.factor=2] - Exponential factor for backoff calculation.
 * @param {(error: Error, attempt: number) => boolean} [options.shouldRetry] - Custom predicate function to determine if error is retryable.
 * @returns {Promise<T>} Resolves with the result of `fn`.
 */
export async function withRetry(fn, options = {}) {
  const {
    retries = 3,
    minTimeout = 200,
    maxTimeout = 3000,
    factor = 2,
    shouldRetry = (err) => {
      // Don't retry validation errors
      if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
        return false;
      }
      // Retry 5xx status codes or network/rate limit issues
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        return false;
      }
      return true;
    }
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt > retries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate exponential backoff delay with jitter
      const calculatedDelay = Math.min(minTimeout * Math.pow(factor, attempt - 1), maxTimeout);
      const jitter = Math.random() * 100;
      const delay = calculatedDelay + jitter;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
