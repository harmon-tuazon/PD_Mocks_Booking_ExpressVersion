/**
 * Unit Tests for RedisLockService
 * Tests atomic locking operations, retry logic, and failure scenarios
 *
 * @see PRDs/booking-race-condition-redis-locking.md
 */

// Load environment variables from .env.development.local
require('dotenv').config({ path: '.env.development.local' });

const RedisLockService = require('../../api/_shared/redis');

// Mock delay for testing
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('RedisLockService', () => {
  let redis;
  const TEST_EXAM_ID = `test-exam-${Date.now()}`;

  beforeEach(async () => {
    // Create new Redis instance for each test
    redis = new RedisLockService();
  });

  afterEach(async () => {
    // Clean up: close connection after each test
    if (redis) {
      await redis.close();
    }
  });

  describe('acquireLock', () => {
    test('should acquire lock successfully on first attempt', async () => {
      const lockToken = await redis.acquireLock(TEST_EXAM_ID, 10);

      expect(lockToken).not.toBeNull();
      expect(typeof lockToken).toBe('string');
      expect(lockToken).toContain('-'); // Format: timestamp-random

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken);
    });

    test('should return null when lock is already held', async () => {
      // First lock acquisition
      const lockToken1 = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken1).not.toBeNull();

      // Second lock acquisition should fail
      const lockToken2 = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken2).toBeNull();

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken1);
    });

    test('should create lock with correct TTL', async () => {
      const lockToken = await redis.acquireLock(TEST_EXAM_ID, 2); // 2 second TTL
      expect(lockToken).not.toBeNull();

      // Wait for TTL to expire
      await sleep(2500);

      // Lock should be available again
      const lockToken2 = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken2).not.toBeNull();

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken2);
    });
  });

  describe('releaseLock', () => {
    test('should release lock successfully with valid token', async () => {
      const lockToken = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken).not.toBeNull();

      const released = await redis.releaseLock(TEST_EXAM_ID, lockToken);
      expect(released).toBe(true);

      // Verify lock is available again
      const lockToken2 = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken2).not.toBeNull();

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken2);
    });

    test('should fail to release lock with invalid token', async () => {
      const lockToken = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken).not.toBeNull();

      // Attempt to release with wrong token
      const wrongToken = 'invalid-token-123';
      const released = await redis.releaseLock(TEST_EXAM_ID, wrongToken);
      expect(released).toBe(false);

      // Lock should still be held by original token
      const lockToken2 = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockToken2).toBeNull();

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken);
    });

    test('should return false when releasing already expired lock', async () => {
      const lockToken = await redis.acquireLock(TEST_EXAM_ID, 1); // 1 second TTL
      expect(lockToken).not.toBeNull();

      // Wait for lock to expire
      await sleep(1500);

      // Attempt to release expired lock
      const released = await redis.releaseLock(TEST_EXAM_ID, lockToken);
      expect(released).toBe(false);
    });
  });

  describe('acquireLockWithRetry', () => {
    test('should succeed on first attempt when lock is available', async () => {
      const lockToken = await redis.acquireLockWithRetry(TEST_EXAM_ID, 5, 100, 10);

      expect(lockToken).not.toBeNull();
      expect(typeof lockToken).toBe('string');

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken);
    });

    test('should succeed after retry when lock becomes available', async () => {
      // Acquire lock in first Redis instance
      const lockToken1 = await redis.acquireLock(TEST_EXAM_ID, 2); // 2 second TTL
      expect(lockToken1).not.toBeNull();

      // Create second Redis instance and try to acquire (should retry and succeed after TTL)
      const redis2 = new RedisLockService();

      const startTime = Date.now();
      const lockToken2 = await redis2.acquireLockWithRetry(TEST_EXAM_ID, 5, 100, 10);
      const duration = Date.now() - startTime;

      expect(lockToken2).not.toBeNull();
      expect(duration).toBeGreaterThan(2000); // Should wait for first lock to expire

      // Clean up
      await redis2.releaseLock(TEST_EXAM_ID, lockToken2);
      await redis2.close();
    }, 10000); // 10 second timeout for this test

    test('should fail after max retries if lock never becomes available', async () => {
      // Acquire lock with long TTL
      const lockToken1 = await redis.acquireLock(TEST_EXAM_ID, 30); // 30 second TTL
      expect(lockToken1).not.toBeNull();

      // Create second Redis instance and try to acquire (should fail after retries)
      const redis2 = new RedisLockService();

      const startTime = Date.now();
      const lockToken2 = await redis2.acquireLockWithRetry(TEST_EXAM_ID, 3, 50, 10); // 3 retries, 50ms base
      const duration = Date.now() - startTime;

      expect(lockToken2).toBeNull();
      expect(duration).toBeGreaterThan(0); // Should have attempted retries
      expect(duration).toBeLessThan(2000); // Should not wait 30 seconds

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken1);
      await redis2.close();
    });

    test('should use exponential backoff for retries', async () => {
      // Acquire lock with long TTL
      const lockToken1 = await redis.acquireLock(TEST_EXAM_ID, 20);
      expect(lockToken1).not.toBeNull();

      // Create second Redis instance
      const redis2 = new RedisLockService();

      const startTime = Date.now();
      const lockToken2 = await redis2.acquireLockWithRetry(TEST_EXAM_ID, 4, 100, 10);
      const duration = Date.now() - startTime;

      expect(lockToken2).toBeNull();

      // Expected delays (with jitter): 0ms, 100-200ms, 200-300ms, 400-500ms
      // Minimum total: 700ms, Maximum total: 1000ms (plus some processing time)
      expect(duration).toBeGreaterThan(600);
      expect(duration).toBeLessThan(2000);

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockToken1);
      await redis2.close();
    });
  });

  describe('healthCheck', () => {
    test('should return true when Redis is available', async () => {
      const healthy = await redis.healthCheck();
      expect(healthy).toBe(true);
    });

    test('should return false when Redis is unavailable', async () => {
      // Close connection to simulate Redis being down
      await redis.close();

      // Health check should fail on closed connection
      const healthy = await redis.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('getInfo', () => {
    test('should return Redis server information', async () => {
      const info = await redis.getInfo();

      expect(info).not.toBeNull();
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('usedMemory');
      expect(info).toHaveProperty('maxMemory');
    });

    test('should handle errors gracefully', async () => {
      // Close connection
      await redis.close();

      const info = await redis.getInfo();
      expect(info).toBeNull();
    });
  });

  describe('connection management', () => {
    test('should close connection gracefully', async () => {
      await expect(redis.close()).resolves.not.toThrow();
    });

    test('should handle multiple close calls', async () => {
      await redis.close();
      await expect(redis.close()).resolves.not.toThrow();
    });
  });

  describe('lock ownership verification', () => {
    test('should prevent one process from releasing another process lock', async () => {
      // Process A acquires lock
      const lockTokenA = await redis.acquireLock(TEST_EXAM_ID, 10);
      expect(lockTokenA).not.toBeNull();

      // Process B tries to release Process A's lock (should fail)
      const redis2 = new RedisLockService();
      const lockTokenB = 'fake-token-456';
      const released = await redis2.releaseLock(TEST_EXAM_ID, lockTokenB);
      expect(released).toBe(false);

      // Lock should still be held by Process A
      const lockTokenC = await redis2.acquireLock(TEST_EXAM_ID, 10);
      expect(lockTokenC).toBeNull();

      // Clean up
      await redis.releaseLock(TEST_EXAM_ID, lockTokenA);
      await redis2.close();
    });
  });

  describe('concurrent lock attempts', () => {
    test('should allow only one lock acquisition among concurrent requests', async () => {
      const redis2 = new RedisLockService();
      const redis3 = new RedisLockService();

      // Simulate 3 concurrent lock acquisition attempts
      const [token1, token2, token3] = await Promise.all([
        redis.acquireLock(TEST_EXAM_ID, 10),
        redis2.acquireLock(TEST_EXAM_ID, 10),
        redis3.acquireLock(TEST_EXAM_ID, 10)
      ]);

      // Exactly one should succeed
      const tokens = [token1, token2, token3].filter(t => t !== null);
      expect(tokens).toHaveLength(1);

      // Clean up
      const successfulToken = tokens[0];
      await redis.releaseLock(TEST_EXAM_ID, successfulToken);
      await redis2.close();
      await redis3.close();
    });
  });
});
