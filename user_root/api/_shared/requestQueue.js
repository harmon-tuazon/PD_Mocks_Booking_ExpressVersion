/**
 * Request Queue with Rate Limiting
 * Prevents HubSpot API rate limit errors by queuing and throttling requests
 *
 * HubSpot Rate Limits:
 * - SECONDLY: 10 requests per second
 * - We throttle to 8 req/sec for safety margin
 */

class RequestQueue {
  constructor(options = {}) {
    this.maxRequestsPerSecond = options.maxRequestsPerSecond || 8; // Safe margin below HubSpot's 10/sec limit
    this.minTimeBetweenRequests = 1000 / this.maxRequestsPerSecond; // milliseconds
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Async function that makes the API call
   * @returns {Promise} - Resolves with API response or rejects with error
   */
  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
        addedAt: Date.now()
      });

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Throttle: Wait if we're too close to the last request
      if (timeSinceLastRequest < this.minTimeBetweenRequests) {
        const waitTime = this.minTimeBetweenRequests - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Get next request from queue
      const item = this.queue.shift();

      try {
        // Execute the request
        this.lastRequestTime = Date.now();
        const result = await item.requestFn();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      minTimeBetweenRequests: this.minTimeBetweenRequests
    };
  }

  /**
   * Clear the queue (useful for testing or emergency)
   */
  clear() {
    this.queue = [];
    this.processing = false;
  }
}

// Singleton instance for HubSpot API calls
let hubspotQueue = null;

/**
 * Get or create the HubSpot request queue singleton
 */
function getHubSpotQueue() {
  if (!hubspotQueue) {
    hubspotQueue = new RequestQueue({
      maxRequestsPerSecond: 8 // Safe margin below HubSpot's 10/sec SECONDLY limit
    });
  }
  return hubspotQueue;
}

module.exports = {
  RequestQueue,
  getHubSpotQueue
};
