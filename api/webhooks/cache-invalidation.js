require('dotenv').config();
const { getCache } = require('../_shared/cache');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables
} = require('../_shared/auth');
const crypto = require('crypto');

/**
 * Verify HubSpot webhook signature
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['x-hubspot-signature-v3'];
  const timestamp = req.headers['x-request-timestamp'];
  const clientSecret = process.env.HUBSPOT_WEBHOOK_SECRET;

  if (!signature || !timestamp || !clientSecret) {
    console.error('Missing signature, timestamp, or client secret');
    return false;
  }

  // Check timestamp to prevent replay attacks (within 5 minutes)
  const currentTime = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(currentTime - requestTime) > 300000) { // 5 minutes
    console.error('Webhook timestamp too old');
    return false;
  }

  // Construct the source string
  const method = req.method;
  const uri = `https://${req.headers.host}${req.url}`;
  const body = JSON.stringify(req.body);
  const sourceString = method + uri + body + timestamp;

  // Calculate expected signature
  const hash = crypto.createHmac('sha256', clientSecret)
    .update(sourceString)
    .digest('base64');

  const expectedSignature = `v3=${hash}`;

  return signature === expectedSignature;
}

/**
 * Determine cache invalidation patterns based on event type
 */
function getCacheInvalidationPatterns(event) {
  const patterns = [];
  const objectType = event.objectId ? 'booking' : 'mock_exam'; // Simplified detection

  if (event.subscriptionType?.includes('contact.')) {
    // Booking-related event
    patterns.push('bookings:contact:*'); // Invalidate all contact booking lists
    patterns.push('mock-exams:*'); // Invalidate mock exam availability
  } else if (event.subscriptionType?.includes('deal.')) {
    // Mock exam-related event (assuming deals represent mock exams)
    patterns.push('mock-exams:*'); // Invalidate all mock exam queries
  }

  return patterns;
}

/**
 * POST /api/webhooks/cache-invalidation
 * Handle HubSpot webhook events for cache invalidation
 * Automatically invalidates relevant cache entries when data changes
 */
module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      createErrorResponse(new Error('Method not allowed'))
    );
  }

  try {
    // Verify environment variables
    verifyEnvironmentVariables();

    // Verify webhook signature if in production
    if (process.env.NODE_ENV === 'production' && process.env.HUBSPOT_WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(req)) {
        console.error('Invalid webhook signature');
        return res.status(401).json(
          createErrorResponse(new Error('Unauthorized'))
        );
      }
    }

    const events = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      console.log('No events to process');
      return res.status(200).json(createSuccessResponse({
        processed: 0,
        message: 'No events to process'
      }));
    }

    console.log(`Processing ${events.length} cache invalidation events`);

    // Get cache instance
    const cache = getCache();

    // Track invalidation stats
    const invalidationPatterns = new Set();

    // Process each event and collect patterns
    for (const event of events) {
      const patterns = getCacheInvalidationPatterns(event);
      patterns.forEach(pattern => invalidationPatterns.add(pattern));
    }

    // Invalidate cache entries
    let totalInvalidated = 0;
    for (const pattern of invalidationPatterns) {
      console.log(`🗑️ Invalidating cache pattern: ${pattern}`);
      cache.deletePattern(pattern);
      totalInvalidated++;
    }

    const response = {
      processed: events.length,
      patternsInvalidated: totalInvalidated,
      patterns: Array.from(invalidationPatterns),
      message: `Processed ${events.length} events, invalidated ${totalInvalidated} cache patterns`
    };

    console.log('Cache invalidation complete:', response);

    res.status(200).json(createSuccessResponse(response));

  } catch (error) {
    console.error('Error processing cache invalidation webhook:', error);

    // Return 200 to prevent webhook retries for permanent errors
    console.error('Webhook error (returning 200 to prevent retries):', error);
    res.status(200).json(createSuccessResponse({
      processed: 0,
      error: 'Error processed, check logs',
      message: error.message
    }));
  }
};
