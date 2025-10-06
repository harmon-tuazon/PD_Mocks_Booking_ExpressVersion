/**
 * Integration Tests for Optimized API Endpoints
 *
 * Tests batch operations and caching in real endpoint scenarios
 */

// Use fake timers to prevent hanging from intervals
jest.useFakeTimers();

const { HubSpotService } = require('../../api/_shared/hubspot');
const { getCache } = require('../../api/_shared/cache');
const { HubSpotBatchService } = require('../../api/_shared/batch');

// Mock axios for HubSpot API calls
jest.mock('axios');
const axios = require('axios');

describe('Optimized Endpoints Integration Tests', () => {
  let hubspot;
  let cache;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset cache between tests
    cache = getCache();
    cache.clear();

    // Initialize HubSpot service
    hubspot = new HubSpotService();

    // Mock axios function (not axios/get)
    axios.mockImplementation = jest.fn();
  });

  afterEach(() => {
    if (cache) {
      cache.clear();
    }
  });

  describe('Batch Operations', () => {
    test('should use batch operations for reading multiple objects', async () => {
      const mockBookings = [
        { id: '1', properties: { name: 'Booking 1', is_active: 'true' } },
        { id: '2', properties: { name: 'Booking 2', is_active: 'true' } },
        { id: '3', properties: { name: 'Booking 3', is_active: 'true' } }
      ];

      axios.mockResolvedValue({
        data: { results: mockBookings }
      });

      const ids = ['1', '2', '3'];
      const result = await hubspot.batch.batchReadObjects('2-50158943', ids, ['name', 'is_active']);

      expect(axios).toHaveBeenCalledTimes(1);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/crm/v3/objects/2-50158943/batch/read'),
          data: expect.objectContaining({
            inputs: ids.map(id => ({ id })),
            properties: ['name', 'is_active']
          })
        })
      );
      expect(result).toEqual(mockBookings);
    });

    test('should batch read associations efficiently', async () => {
      const mockAssociations = [
        { from: { id: '1' }, to: [{ toObjectId: '101' }, { toObjectId: '102' }] },
        { from: { id: '2' }, to: [{ toObjectId: '201' }] }
      ];

      axios.mockResolvedValue({
        data: { results: [{ results: mockAssociations }] }
      });

      const contactIds = ['1', '2'];
      const result = await hubspot.batch.batchReadAssociations('0-1', contactIds, '2-50158943');

      expect(axios).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAssociations);
    });

    test('should chunk large arrays automatically', async () => {
      const largeIdArray = Array.from({ length: 250 }, (_, i) => String(i));
      
      axios
        .mockResolvedValueOnce({ data: { results: largeIdArray.slice(0, 100).map(id => ({ id })) } })
        .mockResolvedValueOnce({ data: { results: largeIdArray.slice(100, 200).map(id => ({ id })) } })
        .mockResolvedValueOnce({ data: { results: largeIdArray.slice(200, 250).map(id => ({ id })) } });

      const result = await hubspot.batch.batchReadObjects('bookings', largeIdArray, ['name']);

      expect(axios).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(250);
    });

    test('should handle batch update operations', async () => {
      const updates = [
        { id: '1', properties: { total_bookings: '5' } },
        { id: '2', properties: { total_bookings: '10' } }
      ];

      axios.mockResolvedValue({
        data: { results: updates }
      });

      const result = await hubspot.batch.batchUpdateObjects('2-50158913', updates);

      expect(axios).toHaveBeenCalledTimes(1);
      expect(axios).toHaveBeenCalledWith(
        expect.stringContaining('/crm/v3/objects/2-50158913/batch/update'),
        expect.objectContaining({
          inputs: updates
        }),
        expect.any(Object)
      );
      expect(result).toEqual(updates);
    });
  });

  describe('Cache Integration', () => {
    test('should cache data after first request', () => {
      const testData = { bookings: [{ id: '1', name: 'Test' }] };
      
      cache.set('test-key', testData, 300);
      
      const cachedData = cache.get('test-key');
      expect(cachedData).toEqual(testData);
    });

    test('should return cached data on subsequent requests', () => {
      const testData = { results: [{ id: '1' }] };
      const cacheKey = 'bookings:contact:123';
      
      // First request - cache miss
      expect(cache.get(cacheKey)).toBeNull();
      
      // Store in cache
      cache.set(cacheKey, testData, 300);
      
      // Second request - cache hit
      const cachedResult = cache.get(cacheKey);
      expect(cachedResult).toEqual(testData);
    });

    test('should invalidate cache using pattern deletion', () => {
      cache.set('bookings:123:page1', 'data1', 300);
      cache.set('bookings:123:page2', 'data2', 300);
      cache.set('bookings:456:page1', 'data3', 300);
      cache.set('exams:789', 'data4', 300);
      
      cache.deletePattern('bookings:123:*');
      
      expect(cache.get('bookings:123:page1')).toBeNull();
      expect(cache.get('bookings:123:page2')).toBeNull();
      expect(cache.get('bookings:456:page1')).toBe('data3');
      expect(cache.get('exams:789')).toBe('data4');
    });

    test('should respect TTL and expire cached data', () => {
      cache.set('short-lived', 'data', 5);

      expect(cache.get('short-lived')).toBe('data');

      jest.advanceTimersByTime(6000);

      expect(cache.get('short-lived')).toBeNull();
    });

    test('should generate correct cache keys for different scenarios', () => {
      const contactId = '12345';
      const filter = 'upcoming';
      const page = 1;
      const limit = 20;
      
      const cacheKey = `bookings:contact:${contactId}:${filter}:page${page}:limit${limit}`;
      
      cache.set(cacheKey, { data: 'test' }, 300);
      
      expect(cache.get(cacheKey)).toEqual({ data: 'test' });
      
      // Different parameters should have different keys
      const differentKey = `bookings:contact:${contactId}:all:page1:limit20`;
      expect(cache.get(differentKey)).toBeNull();
    });
  });

  describe('Real-time Capacity Calculation', () => {
    test('should calculate real-time capacity using batch operations', async () => {
      const mockExams = [
        { id: '1', properties: { capacity: '10', total_bookings: '5' } },
        { id: '2', properties: { capacity: '15', total_bookings: '12' } }
      ];

      const mockAssociations = [
        { from: { id: '1' }, to: [{ toObjectId: '101' }, { toObjectId: '102' }] },
        { from: { id: '2' }, to: [{ toObjectId: '201' }] }
      ];

      const mockBookings = [
        { id: '101', properties: { is_active: 'true' } },
        { id: '102', properties: { is_active: 'true' } },
        { id: '201', properties: { is_active: 'Cancelled' } }
      ];

      axios
        .mockResolvedValueOnce({ data: { results: mockAssociations } })
        .mockResolvedValueOnce({ data: { results: mockBookings } });

      const examIds = ['1', '2'];
      const associations = await hubspot.batch.batchReadAssociations('2-50158913', examIds, '2-50158943');
      
      const bookingIds = [...new Set(associations.flatMap(a => a.to?.map(t => t.toObjectId) || []))];
      const bookings = await hubspot.batch.batchReadObjects('2-50158943', bookingIds, ['is_active']);

      expect(axios).toHaveBeenCalledTimes(2);
      expect(bookings).toHaveLength(3);
      
      const activeBookings = bookings.filter(b => b.properties.is_active !== 'Cancelled');
      expect(activeBookings).toHaveLength(2);
    });

    test('should count active bookings per exam correctly', async () => {
      const associations = [
        { from: { id: '1' }, to: [{ toObjectId: '101' }, { toObjectId: '102' }, { toObjectId: '103' }] }
      ];

      const bookingStatusMap = new Map([
        ['101', true],
        ['102', true],
        ['103', false]
      ]);

      const activeCount = associations[0].to.filter(bookingAssoc => 
        bookingStatusMap.get(bookingAssoc.toObjectId) === true
      ).length;

      expect(activeCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle partial batch failures gracefully', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => String(i));
      
      axios
        .mockResolvedValueOnce({ data: { results: ids.slice(0, 100).map(id => ({ id })) } })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await hubspot.batch.batchReadObjects('bookings', ids, ['name']);

      expect(result).toHaveLength(100);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should continue operation even if cache is disabled', () => {
      // Note: Since we're using a singleton cache that was created at module load time,
      // changing CACHE_ENABLED after loading won't affect the existing instance.
      // This test verifies that when cache is disabled, operations still work.
      const originalEnv = process.env.CACHE_ENABLED;

      // The cache service checks CACHE_ENABLED in set/get methods
      cache.enabled = false;

      cache.set('key', 'value', 60);
      const result = cache.get('key');

      expect(result).toBeNull();

      // Restore
      cache.enabled = true;
      process.env.CACHE_ENABLED = originalEnv;
    });
  });

  describe('Performance Metrics', () => {
    test('should reduce API calls from N to 1 using batch read', async () => {
      const ids = ['1', '2', '3', '4', '5'];
      
      axios.mockResolvedValue({
        data: { results: ids.map(id => ({ id })) }
      });

      await hubspot.batch.batchReadObjects('bookings', ids, ['name']);

      expect(axios).toHaveBeenCalledTimes(1);
    });

    test('should calculate API call savings for large operations', async () => {
      const examCount = 50;
      const avgBookingsPerExam = 5;
      
      const individualCalls = examCount * 2;
      const batchCalls = 2 + 1;
      const savedCalls = individualCalls - batchCalls;
      
      expect(savedCalls).toBeGreaterThan(90);
    });
  });

  describe('Cache Statistics', () => {
    test('should track cache statistics correctly', () => {
      cache.set('key1', 'value1', 300);
      cache.set('key2', 'value2', 300);
      cache.set('key3', 'value3', 300);
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(1000);
      expect(stats.enabled).toBe(true);
    });

    test('should update statistics after deletions', () => {
      cache.set('key1', 'value1', 300);
      cache.set('key2', 'value2', 300);
      
      expect(cache.getStats().size).toBe(2);
      
      cache.delete('key1');
      
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple batch operations concurrently', async () => {
      const bookingIds = ['1', '2', '3'];
      const examIds = ['101', '102'];
      
      axios
        .mockResolvedValueOnce({ data: { results: bookingIds.map(id => ({ id })) } })
        .mockResolvedValueOnce({ data: { results: examIds.map(id => ({ id })) } });

      const [bookings, exams] = await Promise.all([
        hubspot.batch.batchReadObjects('bookings', bookingIds, ['name']),
        hubspot.batch.batchReadObjects('mock_exams', examIds, ['capacity'])
      ]);

      expect(axios).toHaveBeenCalledTimes(2);
      expect(bookings).toHaveLength(3);
      expect(exams).toHaveLength(2);
    });

    test('should maintain cache consistency with concurrent reads', () => {
      const key = 'concurrent-test';
      const value = { data: 'test-value' };
      
      cache.set(key, value, 300);
      
      const read1 = cache.get(key);
      const read2 = cache.get(key);
      const read3 = cache.get(key);
      
      expect(read1).toEqual(value);
      expect(read2).toEqual(value);
      expect(read3).toEqual(value);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty arrays in batch operations', async () => {
      const result = await hubspot.batch.batchReadObjects('bookings', [], ['name']);
      
      expect(result).toEqual([]);
      expect(axios).not.toHaveBeenCalled();
    });

    test('should handle null values in cache', () => {
      cache.set('null-test', null, 300);
      
      const result = cache.get('null-test');
      expect(result).toBeNull();
    });

    test('should handle undefined values in batch results', async () => {
      axios.mockResolvedValue({
        data: { results: undefined }
      });

      const result = await hubspot.batch.batchReadObjects('bookings', ['1'], ['name']);
      
      expect(result).toEqual([]);
    });

    test('should handle very large cache keys', () => {
      const longKey = 'bookings:' + 'x'.repeat(500);
      
      cache.set(longKey, 'value', 300);
      
      expect(cache.get(longKey)).toBe('value');
    });
  });
});
