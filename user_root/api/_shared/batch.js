/**
 * HubSpot Batch API Service
 *
 * Provides utilities for batch operations with HubSpot CRM API.
 * Automatically handles chunking, parallel processing, and error handling.
 *
 * @module batch
 */

class HubSpotBatchService {
  constructor(hubspotService) {
    this.hubspot = hubspotService;
    this.MAX_BATCH_READ = 100;  // HubSpot limit for object batch reads
    this.MAX_BATCH_ASSOC = 1000; // HubSpot limit for association batch reads
  }

  /**
   * Batch read objects with automatic chunking
   *
   * @param {string} objectType - HubSpot object type (e.g., 'bookings', 'mock_exams')
   * @param {string[]} ids - Array of object IDs (auto-chunks if >100)
   * @param {string[]} properties - Properties to fetch
   * @returns {Promise<Object[]>} Array of HubSpot objects
   */
  async batchReadObjects(objectType, ids, properties) {
    if (ids.length === 0) return [];

    const chunks = this.chunkArray(ids, this.MAX_BATCH_READ);

    console.log(`📦 Batch reading ${ids.length} ${objectType} objects in ${chunks.length} chunk(s)...`);

    // PHASE 3: Sequential processing with throttling instead of parallel
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      // Add delay before subsequent chunks to prevent rate limit errors
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log(`⏳ Throttle delay: 150ms between batch chunks (${i}/${chunks.length})`);
      }
      
      try {
        const response = await this.hubspot.apiCall('POST', `/crm/v3/objects/${objectType}/batch/read`, {
          inputs: chunks[i].map(id => ({ id })),
          properties: properties || []
        });
        results.push({ status: 'fulfilled', value: response });
      } catch (error) {
        console.error(`Batch chunk ${i + 1}/${chunks.length} failed:`, error.message);
        results.push({ status: 'rejected', reason: error });
      }
    }

    return this.extractSuccessfulResults(results);
  }

  /**
   * Batch read associations with automatic chunking
   *
   * @param {string} fromObjectType - Source object type
   * @param {string[]} fromIds - Array of source IDs (auto-chunks if >1000)
   * @param {string} toObjectType - Target object type
   * @returns {Promise<Object[]>} Array of association mappings with structure: { from: {id}, to: [{toObjectId, ...}] }
   */
  async batchReadAssociations(fromObjectType, fromIds, toObjectType) {
    if (fromIds.length === 0) return [];

    const chunks = this.chunkArray(fromIds, this.MAX_BATCH_ASSOC);

    console.log(`🔗 Batch reading associations from ${fromIds.length} ${fromObjectType} to ${toObjectType} in ${chunks.length} chunk(s)...`);

    // PHASE 3: Sequential processing with throttling instead of parallel
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      // Add delay before subsequent chunks to prevent rate limit errors
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log(`⏳ Throttle delay: 150ms between batch chunks (${i}/${chunks.length})`);
      }
      
      try {
        const response = await this.hubspot.apiCall(
          'POST',
          `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`,
          { inputs: chunks[i].map(id => ({ id })) }
        );
        results.push({ status: 'fulfilled', value: response });
      } catch (error) {
        console.error(`Batch chunk ${i + 1}/${chunks.length} failed:`, error.message);
        results.push({ status: 'rejected', reason: error });
      }
    }

    // FIX: extractSuccessfulResults already returns the flattened results array
    // Each result has structure: { from: {id}, to: [{toObjectId, associationTypes}] }
    return this.extractSuccessfulResults(results);
  }

  /**
   * Batch update objects with automatic chunking
   *
   * @param {string} objectType - HubSpot object type
   * @param {Object[]} updates - Array of {id, properties} objects
   * @returns {Promise<Object[]>} Array of updated objects
   */
  async batchUpdateObjects(objectType, updates) {
    if (updates.length === 0) return [];

    const chunks = this.chunkArray(updates, this.MAX_BATCH_READ);

    console.log(`✏️ Batch updating ${updates.length} ${objectType} objects in ${chunks.length} chunk(s)...`);

    // PHASE 3: Sequential processing with throttling instead of parallel
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      // Add delay before subsequent chunks to prevent rate limit errors
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log(`⏳ Throttle delay: 150ms between batch chunks (${i}/${chunks.length})`);
      }

      try {
        const response = await this.hubspot.apiCall('POST', `/crm/v3/objects/${objectType}/batch/update`, {
          inputs: chunks[i]
        });
        results.push({ status: 'fulfilled', value: response });
      } catch (error) {
        console.error(`Batch chunk ${i + 1}/${chunks.length} failed:`, error.message);
        results.push({ status: 'rejected', reason: error });
      }
    }

    return this.extractSuccessfulResults(results);
  }

  /**
   * Batch create associations
   *
   * @param {string} fromObjectType - Source object type
   * @param {string} toObjectType - Target object type
   * @param {Object[]} associations - Array of {from: {id}, to: {id}, type} objects
   * @returns {Promise<Object[]>} Array of created associations
   */
  async batchCreateAssociations(fromObjectType, toObjectType, associations) {
    if (associations.length === 0) return [];

    const chunks = this.chunkArray(associations, this.MAX_BATCH_READ);

    console.log(`🔗 Batch creating ${associations.length} associations in ${chunks.length} chunk(s)...`);

    // PHASE 3: Sequential processing with throttling instead of parallel
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      // Add delay before subsequent chunks to prevent rate limit errors
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log(`⏳ Throttle delay: 150ms between batch chunks (${i}/${chunks.length})`);
      }

      try {
        const response = await this.hubspot.apiCall(
          'POST',
          `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/create`,
          { inputs: chunks[i] }
        );
        results.push({ status: 'fulfilled', value: response });
      } catch (error) {
        console.error(`Batch chunk ${i + 1}/${chunks.length} failed:`, error.message);
        results.push({ status: 'rejected', reason: error });
      }
    }

    return this.extractSuccessfulResults(results);
  }

  /**
   * Helper: Chunk array into smaller arrays
   *
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array[]} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper: Extract successful results from Promise.allSettled
   *
   * @param {Object[]} results - Results from Promise.allSettled
   * @returns {Object[]} Successful results
   */
  extractSuccessfulResults(results) {
    const successful = results
      .filter(r => r.status === 'fulfilled')
      .flatMap((r, index) => {
        const data = r.value;

        // Handle different API response structures
        // v3 batch API: { results: [...] }
        // v4 associations API: { results: [...] }
        // Some APIs: { items: [...] }
        // Direct array response: [...]
        let items = [];

        if (Array.isArray(data)) {
          items = data;
        } else if (data.results) {
          items = data.results;
        } else if (data.items) {
          items = data.items;
        } else if (data.data) {
          items = data.data;
        } else {
          console.warn(`⚠️ Unexpected API response structure in chunk ${index}:`, Object.keys(data));
          // Try to extract any array-like property
          const possibleArrays = Object.values(data).filter(v => Array.isArray(v));
          if (possibleArrays.length > 0) {
            console.warn(`  → Found array property, using it: ${possibleArrays[0].length} items`);
            items = possibleArrays[0];
          } else {
            console.error(`  → No array found in response, returning empty`);
            items = [];
          }
        }

        return items;
      });

    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      console.error(`⚠️ Batch operation partial failure: ${failures.length} chunk(s) failed`);
      failures.forEach(failure => {
        console.error('Batch error details:', failure.reason?.message || failure.reason);
      });
    }

    console.log(`✅ Extracted ${successful.length} total items from ${results.length} chunk(s) (${failures.length} failed)`);

    return successful;
  }
}

module.exports = { HubSpotBatchService };
