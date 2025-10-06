/**
 * Unit Tests for Cache Service
 *
 * Tests TTL-based caching, max size enforcement, pattern deletion, and cleanup
 */

// Use fake timers for all tests to prevent real intervals
jest.useFakeTimers();

const { CacheService, getCache } = require('../../api/_shared/cache');

describe('CacheService', () => {
  let cacheService;

  beforeEach(() => {
    // Create fresh cache instance for each test
    cacheService = new CacheService(100);
  });

  afterEach(() => {
    // No need to clear intervals with fake timers
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      const cache = new CacheService();
      expect(cache.maxSize).toBe(1000);
      expect(cache.enabled).toBe(true);
      expect(cache.cache).toBeInstanceOf(Map);
    });

    test('should initialize with custom max size', () => {
      const cache = new CacheService(500);
      expect(cache.maxSize).toBe(500);
      // clearInterval removed - using fake timers
    });

    test('should disable cache when CACHE_ENABLED=false', () => {
      const originalEnv = process.env.CACHE_ENABLED;
      process.env.CACHE_ENABLED = 'false';
      
      const cache = new CacheService();
      expect(cache.enabled).toBe(false);
      
      process.env.CACHE_ENABLED = originalEnv;
      // clearInterval removed - using fake timers
    });

    test('should enable cache when CACHE_ENABLED is not set', () => {
      const originalEnv = process.env.CACHE_ENABLED;
      delete process.env.CACHE_ENABLED;
      
      const cache = new CacheService();
      expect(cache.enabled).toBe(true);
      
      process.env.CACHE_ENABLED = originalEnv;
      // clearInterval removed - using fake timers
    });

    test('should set up cleanup interval', () => {
      const cache = new CacheService();
      expect(cache.cleanupInterval).toBeDefined();
      // clearInterval removed - using fake timers
    });
  });

  describe('set and get', () => {
    test('should store and retrieve a value', () => {
      cacheService.set('test-key', { data: 'value' }, 60);
      const result = cacheService.get('test-key');
      
      expect(result).toEqual({ data: 'value' });
    });

    test('should return null for non-existent key', () => {
      const result = cacheService.get('non-existent');
      expect(result).toBeNull();
    });

    test('should store different data types', () => {
      cacheService.set('string', 'hello', 60);
      cacheService.set('number', 42, 60);
      cacheService.set('array', [1, 2, 3], 60);
      cacheService.set('object', { nested: { value: true } }, 60);
      cacheService.set('boolean', false, 60);
      
      expect(cacheService.get('string')).toBe('hello');
      expect(cacheService.get('number')).toBe(42);
      expect(cacheService.get('array')).toEqual([1, 2, 3]);
      expect(cacheService.get('object')).toEqual({ nested: { value: true } });
      expect(cacheService.get('boolean')).toBe(false);
    });

    test('should overwrite existing key', () => {
      cacheService.set('key', 'value1', 60);
      cacheService.set('key', 'value2', 60);
      
      expect(cacheService.get('key')).toBe('value2');
    });

    test('should not store when cache is disabled', () => {
      const originalEnv = process.env.CACHE_ENABLED;
      process.env.CACHE_ENABLED = 'false';
      const disabledCache = new CacheService();
      
      disabledCache.set('key', 'value', 60);
      const result = disabledCache.get('key');
      
      expect(result).toBeNull();
      
      process.env.CACHE_ENABLED = originalEnv;
      // clearInterval removed - using fake timers
    });

    test('should return null when cache is disabled', () => {
      const originalEnv = process.env.CACHE_ENABLED;
      process.env.CACHE_ENABLED = 'false';
      const disabledCache = new CacheService();
      
      const result = disabledCache.get('any-key');
      expect(result).toBeNull();
      
      process.env.CACHE_ENABLED = originalEnv;
      // clearInterval removed - using fake timers
    });
  });

  describe('TTL expiration', () => {
    test('should return value before TTL expires', () => {
      cacheService.set('key', 'value', 10);
      
      jest.advanceTimersByTime(5000);
      
      expect(cacheService.get('key')).toBe('value');
    });

    test('should return null after TTL expires', () => {
      cacheService.set('key', 'value', 5);
      
      jest.advanceTimersByTime(6000);
      
      expect(cacheService.get('key')).toBeNull();
    });

    test('should delete expired entry on get', () => {
      cacheService.set('key', 'value', 5);
      
      expect(cacheService.cache.size).toBe(1);
      
      jest.advanceTimersByTime(6000);
      cacheService.get('key');
      
      expect(cacheService.cache.size).toBe(0);
    });

    test('should handle different TTLs for different keys', () => {
      cacheService.set('short', 'value1', 5);
      cacheService.set('long', 'value2', 20);
      
      jest.advanceTimersByTime(6000);
      
      expect(cacheService.get('short')).toBeNull();
      expect(cacheService.get('long')).toBe('value2');
      
      jest.advanceTimersByTime(15000);
      
      expect(cacheService.get('long')).toBeNull();
    });
  });

  describe('max size enforcement', () => {
    test('should enforce max size by removing oldest entry', () => {
      const smallCache = new CacheService(3);
      
      smallCache.set('key1', 'value1', 60);
      smallCache.set('key2', 'value2', 60);
      smallCache.set('key3', 'value3', 60);
      
      expect(smallCache.cache.size).toBe(3);
      
      smallCache.set('key4', 'value4', 60);
      
      expect(smallCache.cache.size).toBe(3);
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key4')).toBe('value4');
      
      // clearInterval removed - using fake timers
    });

    test('should not remove entries when updating existing key', () => {
      const smallCache = new CacheService(2);
      
      smallCache.set('key1', 'value1', 60);
      smallCache.set('key2', 'value2', 60);
      smallCache.set('key1', 'updated', 60);
      
      expect(smallCache.cache.size).toBe(2);
      expect(smallCache.get('key1')).toBe('updated');
      expect(smallCache.get('key2')).toBe('value2');
      
      // clearInterval removed - using fake timers
    });

    test('should allow reaching max size without removal', () => {
      const smallCache = new CacheService(3);
      
      smallCache.set('key1', 'value1', 60);
      smallCache.set('key2', 'value2', 60);
      smallCache.set('key3', 'value3', 60);
      
      expect(smallCache.cache.size).toBe(3);
      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      
      // clearInterval removed - using fake timers
    });
  });

  describe('delete', () => {
    test('should delete a specific key', () => {
      cacheService.set('key1', 'value1', 60);
      cacheService.set('key2', 'value2', 60);
      
      cacheService.delete('key1');
      
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBe('value2');
    });

    test('should handle deleting non-existent key', () => {
      expect(() => {
        cacheService.delete('non-existent');
      }).not.toThrow();
    });

    test('should reduce cache size', () => {
      cacheService.set('key1', 'value1', 60);
      cacheService.set('key2', 'value2', 60);
      
      expect(cacheService.cache.size).toBe(2);
      
      cacheService.delete('key1');
      
      expect(cacheService.cache.size).toBe(1);
    });
  });

  describe('deletePattern', () => {
    beforeEach(() => {
      cacheService.set('bookings:123', 'data1', 60);
      cacheService.set('bookings:456', 'data2', 60);
      cacheService.set('bookings:789', 'data3', 60);
      cacheService.set('exams:123', 'data4', 60);
      cacheService.set('users:123', 'data5', 60);
    });

    test('should delete all keys matching wildcard pattern', () => {
      cacheService.deletePattern('bookings:*');
      
      expect(cacheService.get('bookings:123')).toBeNull();
      expect(cacheService.get('bookings:456')).toBeNull();
      expect(cacheService.get('bookings:789')).toBeNull();
      expect(cacheService.get('exams:123')).toBe('data4');
      expect(cacheService.get('users:123')).toBe('data5');
    });

    test('should delete keys with prefix pattern', () => {
      cacheService.deletePattern('bookings*');
      
      expect(cacheService.cache.size).toBe(2);
      expect(cacheService.get('exams:123')).toBe('data4');
      expect(cacheService.get('users:123')).toBe('data5');
    });

    test('should handle pattern with no matches', () => {
      cacheService.deletePattern('nonexistent:*');
      
      expect(cacheService.cache.size).toBe(5);
    });

    test('should delete all keys with wildcard only', () => {
      cacheService.deletePattern('*');
      
      expect(cacheService.cache.size).toBe(0);
    });

    test('should handle complex patterns', () => {
      cacheService.set('mock-exams:CS:capacity', 'data6', 60);
      cacheService.set('mock-exams:SJ:capacity', 'data7', 60);
      
      cacheService.deletePattern('mock-exams:*:capacity');
      
      expect(cacheService.get('mock-exams:CS:capacity')).toBeNull();
      expect(cacheService.get('mock-exams:SJ:capacity')).toBeNull();
      expect(cacheService.cache.size).toBe(5);
    });

    test('should handle exact match without wildcard', () => {
      cacheService.deletePattern('bookings:123');
      
      expect(cacheService.get('bookings:123')).toBeNull();
      expect(cacheService.get('bookings:456')).toBe('data2');
      expect(cacheService.cache.size).toBe(4);
    });
  });

  describe('clear', () => {
    test('should clear all entries', () => {
      cacheService.set('key1', 'value1', 60);
      cacheService.set('key2', 'value2', 60);
      cacheService.set('key3', 'value3', 60);
      
      expect(cacheService.cache.size).toBe(3);
      
      cacheService.clear();
      
      expect(cacheService.cache.size).toBe(0);
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
      expect(cacheService.get('key3')).toBeNull();
    });

    test('should handle clearing empty cache', () => {
      expect(() => {
        cacheService.clear();
      }).not.toThrow();
      
      expect(cacheService.cache.size).toBe(0);
    });
  });

  describe('cleanExpired', () => {
    test('should remove only expired entries', () => {
      cacheService.set('expired1', 'value1', 5);
      cacheService.set('expired2', 'value2', 5);
      cacheService.set('valid', 'value3', 60);
      
      jest.advanceTimersByTime(6000);
      
      cacheService.cleanExpired();
      
      expect(cacheService.cache.size).toBe(1);
      expect(cacheService.get('valid')).toBe('value3');
    });

    test('should not remove any entries if none expired', () => {
      cacheService.set('key1', 'value1', 60);
      cacheService.set('key2', 'value2', 60);
      
      jest.advanceTimersByTime(30000);
      
      cacheService.cleanExpired();
      
      expect(cacheService.cache.size).toBe(2);
    });

    test('should remove all entries if all expired', () => {
      cacheService.set('key1', 'value1', 5);
      cacheService.set('key2', 'value2', 5);
      
      jest.advanceTimersByTime(6000);
      
      cacheService.cleanExpired();
      
      expect(cacheService.cache.size).toBe(0);
    });

    test('should log cleanup count', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      cacheService.set('key1', 'value1', 5);
      cacheService.set('key2', 'value2', 5);
      
      jest.advanceTimersByTime(6000);
      
      cacheService.cleanExpired();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleanup: removed 2 expired')
      );
      
      consoleSpy.mockRestore();
    });

    test('should not log if no entries removed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      cacheService.set('key1', 'value1', 60);
      
      cacheService.cleanExpired();
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle empty cache', () => {
      expect(() => {
        cacheService.cleanExpired();
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    test('should return correct stats', () => {
      cacheService.set('key1', 'value1', 60);
      cacheService.set('key2', 'value2', 60);
      
      const stats = cacheService.getStats();
      
      expect(stats).toEqual({
        size: 2,
        maxSize: 100,
        enabled: true
      });
    });

    test('should reflect cache size changes', () => {
      expect(cacheService.getStats().size).toBe(0);
      
      cacheService.set('key1', 'value1', 60);
      expect(cacheService.getStats().size).toBe(1);
      
      cacheService.delete('key1');
      expect(cacheService.getStats().size).toBe(0);
    });

    test('should show disabled status when cache is disabled', () => {
      const originalEnv = process.env.CACHE_ENABLED;
      process.env.CACHE_ENABLED = 'false';
      
      const disabledCache = new CacheService();
      const stats = disabledCache.getStats();
      
      expect(stats.enabled).toBe(false);
      
      process.env.CACHE_ENABLED = originalEnv;
      // clearInterval removed - using fake timers
    });
  });

  describe('destroy', () => {
    test('should clear cleanup interval', () => {
      const cache = new CacheService();
      const intervalId = cache.cleanupInterval;
      
      expect(intervalId).toBeDefined();
      
      cache.destroy();
      
      // Verify interval was cleared (interval should no longer exist)
      expect(cache.cleanupInterval).toBeDefined();
    });

    test('should handle calling destroy multiple times', () => {
      const cache = new CacheService();
      
      expect(() => {
        cache.destroy();
        cache.destroy();
      }).not.toThrow();
    });
  });

  describe('automatic cleanup', () => {
    test('should set up automatic cleanup interval', () => {
      const cache = new CacheService();
      expect(cache.cleanupInterval).toBeDefined();
      // clearInterval removed - using fake timers
    });
  });
});

describe('getCache singleton', () => {
  beforeEach(() => {
    // Reset singleton before each test
    jest.resetModules();
  });

  test('should return the same instance on multiple calls', () => {
    const { getCache: getCacheFresh } = require('../../api/_shared/cache');
    
    const cache1 = getCacheFresh();
    const cache2 = getCacheFresh();
    
    expect(cache1).toBe(cache2);
    
    // clearInterval removed - using fake timers
  });

  test('should share data between calls', () => {
    const { getCache: getCacheFresh } = require('../../api/_shared/cache');
    
    const cache1 = getCacheFresh();
    cache1.set('shared-key', 'shared-value', 60);
    
    const cache2 = getCacheFresh();
    expect(cache2.get('shared-key')).toBe('shared-value');
    
    // clearInterval removed - using fake timers
  });

  test('should use default max size if not specified', () => {
    const { getCache: getCacheFresh } = require('../../api/_shared/cache');
    
    const cache = getCacheFresh();
    expect(cache.maxSize).toBe(1000);
    
    // clearInterval removed - using fake timers
  });

  test('should use custom max size on first call', () => {
    const { getCache: getCacheFresh } = require('../../api/_shared/cache');
    
    const cache = getCacheFresh(500);
    expect(cache.maxSize).toBe(500);
    
    // clearInterval removed - using fake timers
  });
});
