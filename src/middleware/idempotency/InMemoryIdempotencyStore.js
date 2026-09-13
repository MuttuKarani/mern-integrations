/**
 * In-memory storage adapter for idempotency keys.
 * Implements LRU eviction, TTL expiration, and automatic background cleanup
 * with zero external dependencies.
 */
export class InMemoryIdempotencyStore {
  /** @type {Map<string, { status: string, fingerprint: string, response?: Object, createdAt: number, expiresAt: number }>} */
  #records = new Map();
  #maxEntries;
  #cleanupTimer = null;

  /**
   * @param {Object} [options]
   * @param {number} [options.maxEntries=10000] - Maximum number of entries before LRU eviction.
   * @param {number} [options.cleanupIntervalMs=60000] - Interval for sweeping expired keys. Set to 0 to disable.
   */
  constructor({ maxEntries = 10000, cleanupIntervalMs = 60000 } = {}) {
    this.#maxEntries = Math.max(1, Number(maxEntries) || 10000);

    if (cleanupIntervalMs > 0 && typeof setInterval !== 'undefined') {
      this.#cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);

      // Prevent timer from keeping Node process alive
      if (this.#cleanupTimer && typeof this.#cleanupTimer.unref === 'function') {
        this.#cleanupTimer.unref();
      }
    }
  }

  /**
   * Retrieves an idempotency record by key.
   * If the record has expired, it is purged and null is returned.
   *
   * @param {string} key
   * @returns {Object|null}
   */
  async get(key) {
    if (!key || typeof key !== 'string') return null;

    const record = this.#records.get(key);
    if (!record) return null;

    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.#records.delete(key);
      return null;
    }

    // Refresh LRU position by re-inserting
    this.#records.delete(key);
    this.#records.set(key, record);

    return record;
  }

  /**
   * Saves or updates an idempotency record with a TTL.
   *
   * @param {string} key
   * @param {Object} record
   * @param {number} ttlMs - Time-to-live in milliseconds.
   * @returns {Promise<void>}
   */
  async set(key, record, ttlMs = 86400000) {
    if (!key || typeof key !== 'string') return;

    // If key already exists, delete it first to update position
    if (this.#records.has(key)) {
      this.#records.delete(key);
    } else if (this.#records.size >= this.#maxEntries) {
      // LRU: Evict oldest entry (first item in Map iterator)
      const oldestKey = this.#records.keys().next().value;
      if (oldestKey !== undefined) {
        this.#records.delete(oldestKey);
      }
    }

    const ttl = Number(ttlMs) > 0 ? Number(ttlMs) : 86400000;
    const expiresAt = Date.now() + ttl;

    this.#records.set(key, {
      ...record,
      expiresAt
    });
  }

  /**
   * Deletes a record by key.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    return this.#records.delete(key);
  }

  /**
   * Clears all stored records.
   */
  clear() {
    this.#records.clear();
  }

  /**
   * Returns the count of active records.
   * @returns {number}
   */
  get size() {
    return this.#records.size;
  }

  /**
   * Sweeps and removes all expired records.
   * @returns {number} Count of removed entries.
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, record] of this.#records.entries()) {
      if (record.expiresAt && now > record.expiresAt) {
        this.#records.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Stops the background cleanup timer.
   */
  destroy() {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
  }
}
