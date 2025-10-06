/**
 * Simple In-Memory Cache Service with TTL
 *
 * Provides TTL-based caching without external dependencies.
 * Automatically cleans expired entries to prevent memory leaks.
 *
 * @module cache
 */

class CacheService {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.enabled = process.env.CACHE_ENABLED !== 'false';

    // Auto-cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
  }

  /**
   * Store a value in cache with TTL
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (any JSON-serializable data)
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, value, ttlSeconds) {
    if (!this.enabled) return;

    // Enforce max size by removing oldest entry if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }

  /**
   * Retrieve a value from cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if expired/not found
   */
  get(key) {
    if (!this.enabled) return null;

    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a specific cache entry
   *
   * @param {string} key - Cache key to delete
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Delete all cache entries matching a pattern
   *
   * @param {string} pattern - Pattern with wildcards (e.g., "bookings:*")
   */
  deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get all cache keys
   *
   * @returns {Array<string>} Array of all cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Remove all expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats (size, enabled status)
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      enabled: this.enabled
    };
  }

  /**
   * Cleanup interval on service shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance for application-wide cache
let cacheInstance = null;

/**
 * Get or create the cache singleton instance
 *
 * @param {number} maxSize - Optional max cache size
 * @returns {CacheService} Cache service instance
 */
function getCache(maxSize = 1000) {
  if (!cacheInstance) {
    cacheInstance = new CacheService(maxSize);
  }
  return cacheInstance;
}

module.exports = { CacheService, getCache };
