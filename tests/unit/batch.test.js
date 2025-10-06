/**
 * Unit Tests for HubSpot Batch Service
 * 
 * Tests batch operations including chunking, error handling, and API call optimizations
 */

const { HubSpotBatchService } = require('../../api/_shared/batch');

// Mock HubSpot Service
const createMockHubSpotService = () => ({
  apiCall: jest.fn()
});

describe('HubSpotBatchService', () => {
  let mockHubSpot;
  let batchService;

  beforeEach(() => {
    mockHubSpot = createMockHubSpotService();
    batchService = new HubSpotBatchService(mockHubSpot);
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct limits', () => {
      expect(batchService.MAX_BATCH_READ).toBe(100);
      expect(batchService.MAX_BATCH_ASSOC).toBe(1000);
      expect(batchService.hubspot).toBe(mockHubSpot);
    });
  });

  describe('chunkArray', () => {
    test('should return empty array for empty input', () => {
      const result = batchService.chunkArray([], 100);
      expect(result).toEqual([]);
    });

    test('should return single chunk for array smaller than chunk size', () => {
      const input = [1, 2, 3, 4, 5];
      const result = batchService.chunkArray(input, 10);
      expect(result).toEqual([[1, 2, 3, 4, 5]]);
    });

    test('should return single chunk for array equal to chunk size', () => {
      const input = Array.from({ length: 100 }, (_, i) => i);
      const result = batchService.chunkArray(input, 100);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(100);
    });

    test('should chunk array into multiple chunks', () => {
      const input = Array.from({ length: 250 }, (_, i) => i);
      const result = batchService.chunkArray(input, 100);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(100);
      expect(result[1]).toHaveLength(100);
      expect(result[2]).toHaveLength(50);
    });

    test('should handle exact multiple of chunk size', () => {
      const input = Array.from({ length: 200 }, (_, i) => i);
      const result = batchService.chunkArray(input, 100);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(100);
      expect(result[1]).toHaveLength(100);
    });

    test('should preserve array values in chunks', () => {
      const input = ['a', 'b', 'c', 'd', 'e'];
      const result = batchService.chunkArray(input, 2);
      
      expect(result).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    });
  });

  describe('extractSuccessfulResults', () => {
    test('should extract results from fulfilled promises', () => {
      const results = [
        { status: 'fulfilled', value: { results: [{ id: '1' }, { id: '2' }] } },
        { status: 'fulfilled', value: { results: [{ id: '3' }] } }
      ];

      const extracted = batchService.extractSuccessfulResults(results);
      
      expect(extracted).toHaveLength(3);
      expect(extracted).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });

    test('should handle empty results array', () => {
      const results = [
        { status: 'fulfilled', value: { results: [] } }
      ];

      const extracted = batchService.extractSuccessfulResults(results);
      expect(extracted).toEqual([]);
    });

    test('should ignore rejected promises', () => {
      const results = [
        { status: 'fulfilled', value: { results: [{ id: '1' }] } },
        { status: 'rejected', reason: new Error('API error') },
        { status: 'fulfilled', value: { results: [{ id: '2' }] } }
      ];

      const extracted = batchService.extractSuccessfulResults(results);
      
      expect(extracted).toHaveLength(2);
      expect(extracted).toEqual([{ id: '1' }, { id: '2' }]);
    });

    test('should handle all rejected promises', () => {
      const results = [
        { status: 'rejected', reason: new Error('Error 1') },
        { status: 'rejected', reason: new Error('Error 2') }
      ];

      const extracted = batchService.extractSuccessfulResults(results);
      expect(extracted).toEqual([]);
    });

    test('should handle missing results property', () => {
      const results = [
        { status: 'fulfilled', value: {} },
        { status: 'fulfilled', value: { results: [{ id: '1' }] } }
      ];

      const extracted = batchService.extractSuccessfulResults(results);
      expect(extracted).toEqual([{ id: '1' }]);
    });

    test('should log errors for rejected promises', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = [
        { status: 'rejected', reason: new Error('Test error') }
      ];

      batchService.extractSuccessfulResults(results);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Batch operation partial failure')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('batchReadObjects', () => {
    test('should return empty array for empty input', async () => {
      const result = await batchService.batchReadObjects('bookings', [], ['name']);
      
      expect(result).toEqual([]);
      expect(mockHubSpot.apiCall).not.toHaveBeenCalled();
    });

    test('should make single API call for small array (< 100)', async () => {
      const ids = ['1', '2', '3'];
      const mockResponse = { results: [{ id: '1' }, { id: '2' }, { id: '3' }] };
      mockHubSpot.apiCall.mockResolvedValue(mockResponse);

      const result = await batchService.batchReadObjects('2-50158943', ids, ['name', 'email']);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(mockHubSpot.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v3/objects/2-50158943/batch/read',
        {
          inputs: [{ id: '1' }, { id: '2' }, { id: '3' }],
          properties: ['name', 'email']
        }
      );
      expect(result).toEqual(mockResponse.results);
    });

    test('should make single API call for exactly 100 items', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => String(i));
      const mockResponse = { results: ids.map(id => ({ id })) };
      mockHubSpot.apiCall.mockResolvedValue(mockResponse);

      const result = await batchService.batchReadObjects('bookings', ids, ['name']);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(100);
    });

    test('should chunk and make multiple API calls for large array (> 100)', async () => {
      const ids = Array.from({ length: 250 }, (_, i) => String(i));
      
      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: ids.slice(0, 100).map(id => ({ id })) })
        .mockResolvedValueOnce({ results: ids.slice(100, 200).map(id => ({ id })) })
        .mockResolvedValueOnce({ results: ids.slice(200, 250).map(id => ({ id })) });

      const result = await batchService.batchReadObjects('bookings', ids, ['name']);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(250);
    });

    test('should handle partial failures gracefully', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => String(i));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: ids.slice(0, 100).map(id => ({ id })) })
        .mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const result = await batchService.batchReadObjects('bookings', ids, ['name']);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(100);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('partial failure')
      );

      consoleSpy.mockRestore();
    });

    test('should use empty properties array if not provided', async () => {
      const ids = ['1'];
      mockHubSpot.apiCall.mockResolvedValue({ results: [{ id: '1' }] });

      await batchService.batchReadObjects('bookings', ids);

      expect(mockHubSpot.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v3/objects/bookings/batch/read',
        {
          inputs: [{ id: '1' }],
          properties: []
        }
      );
    });
  });

  describe('batchReadAssociations', () => {
    test('should return empty array for empty input', async () => {
      const result = await batchService.batchReadAssociations('contacts', [], 'bookings');
      
      expect(result).toEqual([]);
      expect(mockHubSpot.apiCall).not.toHaveBeenCalled();
    });

    test('should make single API call for small array (< 1000)', async () => {
      const ids = ['1', '2', '3'];
      const mockAssociations = [
        { from: { id: '1' }, to: [{ toObjectId: '10' }] },
        { from: { id: '2' }, to: [{ toObjectId: '20' }] }
      ];
      // FIXED: Mock correct HubSpot API response structure
      // The v4 batch associations API returns { results: [...] }
      // where each result has { from: {id}, to: [{toObjectId, ...}] }
      mockHubSpot.apiCall.mockResolvedValue({
        results: mockAssociations
      });

      const result = await batchService.batchReadAssociations('0-1', ids, '2-50158943');

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(mockHubSpot.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v4/associations/0-1/2-50158943/batch/read',
        { inputs: [{ id: '1' }, { id: '2' }, { id: '3' }] }
      );
      expect(result).toEqual(mockAssociations);
    });

    test('should make single API call for exactly 1000 items', async () => {
      const ids = Array.from({ length: 1000 }, (_, i) => String(i));
      const mockAssociations = ids.map(id => ({ from: { id }, to: [] }));
      mockHubSpot.apiCall.mockResolvedValue({
        results: mockAssociations
      });

      const result = await batchService.batchReadAssociations('contacts', ids, 'bookings');

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAssociations);
    });

    test('should chunk and make multiple API calls for large array (> 1000)', async () => {
      const ids = Array.from({ length: 2500 }, (_, i) => String(i));
      const chunk1 = ids.slice(0, 1000).map(id => ({ from: { id }, to: [] }));
      const chunk2 = ids.slice(1000, 2000).map(id => ({ from: { id }, to: [] }));
      const chunk3 = ids.slice(2000, 2500).map(id => ({ from: { id }, to: [] }));

      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: chunk1 })
        .mockResolvedValueOnce({ results: chunk2 })
        .mockResolvedValueOnce({ results: chunk3 });

      const result = await batchService.batchReadAssociations('contacts', ids, 'bookings');

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(3);
      expect(result).toEqual([...chunk1, ...chunk2, ...chunk3]);
    });

    test('should flatten results from multiple chunks', async () => {
      const ids = ['1', '2'];
      const mockAssociations = [
        { from: { id: '1' }, to: [{ toObjectId: '10' }, { toObjectId: '11' }] },
        { from: { id: '2' }, to: [{ toObjectId: '20' }] }
      ];

      mockHubSpot.apiCall.mockResolvedValue({
        results: mockAssociations
      });

      const result = await batchService.batchReadAssociations('contacts', ids, 'bookings');

      expect(result).toEqual(mockAssociations);
      expect(result[0].to).toHaveLength(2);
    });

    test('should handle partial failures gracefully', async () => {
      const ids = Array.from({ length: 1500 }, (_, i) => String(i));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const successfulAssociations = [{ from: { id: '1' }, to: [] }];

      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: successfulAssociations })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await batchService.batchReadAssociations('contacts', ids, 'bookings');

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(2);
      expect(result).toEqual(successfulAssociations);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('batchUpdateObjects', () => {
    test('should return empty array for empty input', async () => {
      const result = await batchService.batchUpdateObjects('bookings', []);
      
      expect(result).toEqual([]);
      expect(mockHubSpot.apiCall).not.toHaveBeenCalled();
    });

    test('should make single API call for small array', async () => {
      const updates = [
        { id: '1', properties: { status: 'active' } },
        { id: '2', properties: { status: 'cancelled' } }
      ];
      const mockResponse = { results: updates };
      mockHubSpot.apiCall.mockResolvedValue(mockResponse);

      const result = await batchService.batchUpdateObjects('bookings', updates);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(mockHubSpot.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v3/objects/bookings/batch/update',
        { inputs: updates }
      );
      expect(result).toEqual(updates);
    });

    test('should chunk large updates into multiple API calls', async () => {
      const updates = Array.from({ length: 250 }, (_, i) => ({
        id: String(i),
        properties: { total_bookings: String(i) }
      }));
      
      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: updates.slice(0, 100) })
        .mockResolvedValueOnce({ results: updates.slice(100, 200) })
        .mockResolvedValueOnce({ results: updates.slice(200, 250) });

      const result = await batchService.batchUpdateObjects('mock_exams', updates);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(250);
    });

    test('should handle update failures gracefully', async () => {
      const updates = Array.from({ length: 150 }, (_, i) => ({
        id: String(i),
        properties: { status: 'updated' }
      }));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: updates.slice(0, 100) })
        .mockRejectedValueOnce(new Error('Update failed'));

      const result = await batchService.batchUpdateObjects('bookings', updates);

      expect(result).toHaveLength(100);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('batchCreateAssociations', () => {
    test('should return empty array for empty input', async () => {
      const result = await batchService.batchCreateAssociations('contacts', 'bookings', []);
      
      expect(result).toEqual([]);
      expect(mockHubSpot.apiCall).not.toHaveBeenCalled();
    });

    test('should make single API call for small array', async () => {
      const associations = [
        { from: { id: '1' }, to: { id: '10' }, type: 'contact_to_booking' },
        { from: { id: '2' }, to: { id: '20' }, type: 'contact_to_booking' }
      ];
      const mockResponse = { results: associations };
      mockHubSpot.apiCall.mockResolvedValue(mockResponse);

      const result = await batchService.batchCreateAssociations('contacts', 'bookings', associations);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(1);
      expect(mockHubSpot.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v4/associations/contacts/bookings/batch/create',
        { inputs: associations }
      );
      expect(result).toEqual(associations);
    });

    test('should chunk large association arrays', async () => {
      const associations = Array.from({ length: 250 }, (_, i) => ({
        from: { id: String(i) },
        to: { id: String(i + 1000) },
        type: 'association_type'
      }));
      
      mockHubSpot.apiCall
        .mockResolvedValueOnce({ results: associations.slice(0, 100) })
        .mockResolvedValueOnce({ results: associations.slice(100, 200) })
        .mockResolvedValueOnce({ results: associations.slice(200, 250) });

      const result = await batchService.batchCreateAssociations('from_type', 'to_type', associations);

      expect(mockHubSpot.apiCall).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(250);
    });
  });

  describe('Console logging', () => {
    test('should log batch operation details', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const ids = Array.from({ length: 250 }, (_, i) => String(i));
      
      mockHubSpot.apiCall.mockResolvedValue({ results: [] });

      await batchService.batchReadObjects('bookings', ids, ['name']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Batch reading 250 bookings objects in 3')
      );

      consoleSpy.mockRestore();
    });
  });
});
