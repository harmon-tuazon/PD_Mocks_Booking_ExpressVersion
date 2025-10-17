/**
 * RedisLockService - Centralized locking for booking race condition prevention
 *
 * Implements simple atomic locking using a single Redis instance to coordinate
 * multiple concurrent Vercel serverless functions.
 *
 * Key Features:
 * - Atomic lock acquisition (SET NX EX)
 * - Safe lock release with ownership verification (Lua script)
 * - Exponential backoff retry strategy
 * - Auto-expiration via TTL (prevents orphaned locks)
 *
 * @see PRDs/booking-race-condition-redis-locking.md
 */

const Redis = require('ioredis');

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RedisLockService {
  constructor() {
    // Get Redis URL from environment
    const redisUrl = process.env.PD_Bookings_Cache_REDIS_URL || process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('Redis URL not configured. Set PD_Bookings_Cache_REDIS_URL or REDIS_URL environment variable.');
    }

    // Initialize Redis client with connection pooling and retry strategy
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        console.log(`⏳ Redis retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      // Connection pool settings
      connectionName: 'booking-lock-service',
    });

    // Handle connection events
    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error.message);
    });

    this.redis.on('close', () => {
      console.log('👋 Redis connection closed');
    });
  }

  /**
   * Acquire lock for a mock exam (single attempt)
   *
   * Uses Redis SET NX EX for atomic "set if not exists with expiration"
   *
   * @param {string} mockExamId - The mock exam ID to lock
   * @param {number} ttl - Time to live in seconds (default: 10)
   * @returns {Promise<string|null>} Lock token if acquired, null if busy
   */
  async acquireLock(mockExamId, ttl = 10) {
    const lockKey = `booking:lock:${mockExamId}`;
    const lockToken = `${Date.now()}-${Math.random()}`; // Unique token for ownership

    try {
      // Redis SET NX EX - Atomic operation
      // SET key value EX seconds NX
      // NX = Set only if key does NOT exist
      // EX = Set expiration time in seconds
      const result = await this.redis.set(lockKey, lockToken, 'EX', ttl, 'NX');

      if (result === 'OK') {
        console.log(`🔒 Lock acquired: exam=${mockExamId}, token=${lockToken}, ttl=${ttl}s`);
        return lockToken;
      } else {
        console.log(`⏸️  Lock busy: exam=${mockExamId}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Lock acquisition error: exam=${mockExamId}`, error.message);
      throw error;
    }
  }

  /**
   * Release lock for a mock exam (with ownership verification)
   *
   * Uses Lua script to atomically verify ownership and delete lock.
   * This prevents process A from releasing process B's lock.
   *
   * @param {string} mockExamId - The mock exam ID to unlock
   * @param {string} lockToken - The token received from acquireLock
   * @returns {Promise<boolean>} True if released, false if already expired/wrong owner
   */
  async releaseLock(mockExamId, lockToken) {
    const lockKey = `booking:lock:${mockExamId}`;

    // Lua script for atomic check-and-delete
    // Only deletes if the stored token matches the provided token
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      // Execute Lua script atomically
      // KEYS[1] = lockKey
      // ARGV[1] = lockToken
      const result = await this.redis.eval(luaScript, 1, lockKey, lockToken);

      if (result === 1) {
        console.log(`🔓 Lock released: exam=${mockExamId}, token=${lockToken}`);
        return true;
      } else {
        console.warn(`⚠️  Lock not released: exam=${mockExamId}, token=${lockToken} (already expired or wrong owner)`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Lock release error: exam=${mockExamId}`, error.message);
      // Don't throw - lock will expire via TTL
      return false;
    }
  }

  /**
   * Acquire lock with retry and exponential backoff
   *
   * Implements exponential backoff with jitter to reduce contention:
   * - Attempt 1: Immediate (0ms)
   * - Attempt 2: 100-200ms
   * - Attempt 3: 200-300ms
   * - Attempt 4: 400-500ms
   * - Attempt 5: 800-900ms
   *
   * Total max wait: ~1.5 seconds for 5 retries
   *
   * @param {string} mockExamId - The mock exam ID to lock
   * @param {number} maxRetries - Maximum retry attempts (default: 5)
   * @param {number} baseDelay - Base delay in milliseconds (default: 100)
   * @param {number} ttl - Lock TTL in seconds (default: 10)
   * @returns {Promise<string|null>} Lock token if acquired, null if all retries exhausted
   */
  async acquireLockWithRetry(mockExamId, maxRetries = 5, baseDelay = 100, ttl = 10) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Attempt lock acquisition
      const lockToken = await this.acquireLock(mockExamId, ttl);

      if (lockToken) {
        console.log(`✅ Lock acquired on attempt ${attempt + 1}/${maxRetries}: exam=${mockExamId}`);
        return lockToken;
      }

      // If not the last attempt, wait with exponential backoff
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        // delay = baseDelay * 2^attempt + random jitter (0-100ms)
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 100;
        const delay = exponentialDelay + jitter;

        console.log(`⏳ Lock busy, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms: exam=${mockExamId}`);
        await sleep(delay);
      }
    }

    // All retries exhausted
    console.error(`❌ Failed to acquire lock after ${maxRetries} attempts: exam=${mockExamId}`);
    return null;
  }

  /**
   * Health check - verify Redis connection
   *
   * @returns {Promise<boolean>} True if connected, false otherwise
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - start;

      if (result === 'PONG') {
        console.log(`✅ Redis health check passed (latency: ${latency}ms)`);
        return true;
      } else {
        console.error(`❌ Redis health check failed: unexpected response "${result}"`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Redis health check failed:`, error.message);
      return false;
    }
  }

  /**
   * Get Redis info for monitoring
   *
   * @returns {Promise<object>} Redis server info
   */
  async getInfo() {
    try {
      const info = await this.redis.info('server');
      const memory = await this.redis.info('memory');

      const redisVersion = info.match(/redis_version:(.*)/)?.[1]?.trim() || 'unknown';
      const usedMemory = memory.match(/used_memory_human:(.*)/)?.[1]?.trim() || 'unknown';
      const maxMemory = memory.match(/maxmemory_human:(.*)/)?.[1]?.trim() || 'unknown';

      return {
        version: redisVersion,
        usedMemory,
        maxMemory,
      };
    } catch (error) {
      console.error('❌ Failed to get Redis info:', error.message);
      return null;
    }
  }

  /**
   * Close Redis connection
   *
   * Should be called when done with the service to prevent connection leaks
   */
  async close() {
    try {
      await this.redis.quit();
      console.log('👋 Redis connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error.message);
      // Force close if graceful quit fails
      this.redis.disconnect();
    }
  }
}

module.exports = RedisLockService;
