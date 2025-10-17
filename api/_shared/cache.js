/**
 * Distributed Cache Service with Redis Backend
 *
 * Provides distributed TTL-based caching using Redis for serverless environments.
 * Replaces in-memory Map to survive cold starts and share cache across instances.
 *
 * @module cache
 */

const RedisLockService = require('./redis');

class CacheService {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.enabled = process.env.CACHE_ENABLED !== 'false';

    // Use Redis for distributed caching instead of in-memory Map
    this.redis = new RedisLockService();

    console.log('✅ CacheService initialized with Redis backend (distributed cache)');
  }

  /**
   * Store a value in Redis cache with TTL
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (any JSON-serializable data)
   * @param {number} ttlSeconds - Time to live in seconds
   */
  async set(key, value, ttlSeconds) {
    if (!this.enabled) return;

    try {
      await this.redis.cacheSet(key, value, ttlSeconds);
    } catch (error) {
      console.error(`❌ Cache set error for key "${key}":`, error.message);
      // Fail gracefully - don't throw
    }
  }

  /**
   * Retrieve a value from Redis cache
   *
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null if expired/not found
   */
  async get(key) {
    if (!this.enabled) return null;

    try {
      return await this.redis.cacheGet(key);
    } catch (error) {
      console.error(`❌ Cache get error for key "${key}":`, error.message);
      return null; // Fail gracefully
    }
  }

  /**
   * Delete a specific cache entry from Redis
   *
   * @param {string} key - Cache key to delete
   */
  async delete(key) {
    try {
      await this.redis.cacheDelete(key);
    } catch (error) {
      console.error(`❌ Cache delete error for key "${key}":`, error.message);
    }
  }

  /**
   * Delete all Redis cache entries matching a pattern
   *
   * @param {string} pattern - Pattern with wildcards (e.g., "bookings:*")
   */
  async deletePattern(pattern) {
    try {
      await this.redis.cacheDeletePattern(pattern);
    } catch (error) {
      console.error(`❌ Cache pattern delete error for pattern "${pattern}":`, error.message);
    }
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  async clear() {
    try {
      await this.redis.cacheDeletePattern('*');
    } catch (error) {
      console.error('❌ Cache clear error:', error.message);
    }
  }

  /**
   * Get all cache keys from Redis
   *
   * @returns {Promise<Array<string>>} Array of all cache keys
   */
  async keys() {
    try {
      return await this.redis.cacheKeys('*');
    } catch (error) {
      console.error('❌ Cache keys error:', error.message);
      return [];
    }
  }

  /**
   * Redis handles expiration automatically via TTL
   * This method is kept for backward compatibility but does nothing
   */
  cleanExpired() {
    // No-op: Redis handles expiration automatically via TTL
    console.log('ℹ️ Redis handles cache expiration automatically via TTL');
  }

  /**
   * Get cache statistics from Redis
   *
   * @returns {Promise<Object>} Cache stats
   */
  async getStats() {
    try {
      const redisInfo = await this.redis.getInfo();
      const keys = await this.keys();

      return {
        backend: 'redis',
        size: keys.length,
        maxSize: this.maxSize,
        enabled: this.enabled,
        redis: redisInfo
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error.message);
      return {
        backend: 'redis',
        size: 0,
        maxSize: this.maxSize,
        enabled: this.enabled,
        error: error.message
      };
    }
  }

  /**
   * Cleanup Redis connection on service shutdown
   */
  async destroy() {
    try {
      await this.redis.close();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error.message);
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
