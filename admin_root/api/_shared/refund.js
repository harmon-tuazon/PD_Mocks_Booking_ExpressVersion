/**
 * REFUND SERVICE - TOKEN REFUND SYSTEM
 *
 * Phase 1: Core RefundService class for token refunds on booking cancellations
 *
 * FEATURES:
 * - Token type mapping (Mock Discussion, Clinical Skills, Situational Judgment, Mini-mock)
 * - Batch contact token updates (optimized for HubSpot API limits)
 * - Eligibility validation (idempotent refunds)
 * - Detailed result tracking (successful, failed, skipped)
 * - Error handling with partial failure support
 *
 * USAGE:
 * const refundService = require('./_shared/refund');
 * const results = await refundService.processRefunds(bookings, adminEmail);
 */

const hubspot = require('./hubspot');
const { updateContactCreditsInSupabase } = require('./supabase-data');

// HubSpot object type IDs
const HUBSPOT_OBJECTS = {
  'contacts': '0-1',
  'bookings': '2-50158943'
};

// HubSpot batch API limit
const HUBSPOT_BATCH_SIZE = 100;

/**
 * TOKEN PROPERTY MAPPING (FR-4)
 * Maps display names (stored in booking.token_used) to HubSpot contact property names
 */
const TOKEN_PROPERTY_MAP = {
  'Mock Discussion Token': 'mock_discussion_token',
  'Clinical Skills Token': 'cs_credits',
  'Situational Judgment Token': 'sj_credits',
  'Mini-mock Token': 'sjmini_credits'
};

/**
 * Get HubSpot contact property name from token display name
 * @param {string} tokenUsedValue - Display name from booking.token_used (e.g., "Mock Discussion Token")
 * @returns {string|null} HubSpot property name or null if not found
 */
function getTokenPropertyName(tokenUsedValue) {
  if (!tokenUsedValue) {
    console.warn('⚠️ getTokenPropertyName: tokenUsedValue is empty');
    return null;
  }

  const propertyName = TOKEN_PROPERTY_MAP[tokenUsedValue];

  if (!propertyName) {
    console.warn(`⚠️ getTokenPropertyName: Unknown token type "${tokenUsedValue}"`);
    console.log('Valid token types:', Object.keys(TOKEN_PROPERTY_MAP));
    return null;
  }

  return propertyName;
}

/**
 * Validate if a booking is eligible for token refund
 * @param {Object} booking - Booking object with properties
 * @returns {Object} { eligible: boolean, reason: string }
 */
function validateRefundEligibility(booking) {
  const properties = booking.properties || booking;

  // Check if already refunded (idempotency)
  if (properties.token_refunded === 'true') {
    return {
      eligible: false,
      reason: 'Token already refunded'
    };
  }

  // Check if token_used exists
  if (!properties.token_used) {
    return {
      eligible: false,
      reason: 'No token used for this booking'
    };
  }

  // Check if contact ID exists
  if (!properties.associated_contact_id) {
    return {
      eligible: false,
      reason: 'Missing contact ID'
    };
  }

  // Check if token type is valid
  const tokenPropertyName = getTokenPropertyName(properties.token_used);
  if (!tokenPropertyName) {
    return {
      eligible: false,
      reason: `Invalid token type: ${properties.token_used}`
    };
  }

  return {
    eligible: true,
    reason: 'Eligible for refund'
  };
}

/**
 * Group bookings by token type for batch optimization
 * @param {Array} bookings - Array of booking objects
 * @returns {Object} Grouped bookings by token property name
 */
function groupBookingsByTokenType(bookings) {
  const grouped = {};

  bookings.forEach(booking => {
    const properties = booking.properties || booking;
    const tokenPropertyName = getTokenPropertyName(properties.token_used);

    if (!tokenPropertyName) {
      console.warn(`Skipping booking ${booking.id}: Unknown token type "${properties.token_used}"`);
      return;
    }

    if (!grouped[tokenPropertyName]) {
      grouped[tokenPropertyName] = [];
    }

    grouped[tokenPropertyName].push(booking);
  });

  console.log('📊 Bookings grouped by token type:',
    Object.keys(grouped).map(key => `${key}: ${grouped[key].length}`).join(', ')
  );

  return grouped;
}

/**
 * Batch fetch current token values for contacts
 * @param {Array<string>} contactIds - Array of HubSpot contact IDs
 * @param {string} tokenPropertyName - HubSpot property name to fetch
 * @returns {Promise<Map>} Map of contactId => current token value
 */
async function batchFetchContactTokens(contactIds, tokenPropertyName) {
  const tokenValues = new Map();

  // Remove duplicates
  const uniqueContactIds = [...new Set(contactIds)];

  console.log(`🔍 Fetching ${tokenPropertyName} for ${uniqueContactIds.length} unique contacts...`);

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < uniqueContactIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = uniqueContactIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/batch/read`, {
        properties: [tokenPropertyName],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        response.results.forEach(contact => {
          const currentValue = parseInt(contact.properties[tokenPropertyName] || '0');
          tokenValues.set(contact.id, currentValue);
        });
      }

      console.log(`  ✅ Fetched chunk ${i / HUBSPOT_BATCH_SIZE + 1}: ${chunk.length} contacts`);
    } catch (error) {
      console.error(`❌ Error fetching contact token batch:`, error);
      // Continue processing other chunks
    }
  }

  console.log(`✅ Fetched tokens for ${tokenValues.size} contacts`);
  return tokenValues;
}

/**
 * Calculate token update values (increment by 1)
 * @param {Map} currentTokenValues - Map of contactId => current token value
 * @param {string} tokenPropertyName - HubSpot property name
 * @returns {Array} Array of update objects for HubSpot batch API
 */
function calculateTokenUpdates(currentTokenValues, tokenPropertyName) {
  const updates = [];

  currentTokenValues.forEach((currentValue, contactId) => {
    const newValue = currentValue + 1;

    updates.push({
      id: contactId,
      properties: {
        [tokenPropertyName]: newValue.toString() // HubSpot stores as string
      }
    });
  });

  console.log(`📝 Calculated ${updates.length} token updates (+1 each)`);
  return updates;
}

/**
 * Batch update contact token properties in HubSpot
 * @param {Array} updates - Array of update objects { id, properties }
 * @param {string} tokenPropertyName - Token property name for Supabase sync (optional)
 * @returns {Promise<Object>} { successful: Array, failed: Array }
 */
async function batchUpdateContactTokens(updates, tokenPropertyName = null) {
  const results = {
    successful: [],
    failed: []
  };

  console.log(`🔄 Updating ${updates.length} contact tokens in HubSpot...`);

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < updates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = updates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/batch/update`, {
        inputs: chunk
      });

      if (response.results) {
        response.results.forEach(result => {
          results.successful.push({
            contactId: result.id,
            updatedAt: result.updatedAt
          });
        });
      }

      console.log(`  ✅ Updated chunk ${i / HUBSPOT_BATCH_SIZE + 1}: ${chunk.length} contacts`);

      // Sync successful updates to Supabase (non-blocking, batch operation)
      if (tokenPropertyName && response.results && response.results.length > 0) {
        // Map token property to mock_type
        const tokenToMockTypeMapping = {
          'mock_discussion_token': 'Mock Discussion',
          'cs_credits': 'Clinical Skills',
          'sj_credits': 'Situational Judgment',
          'sjmini_credits': 'Mini-mock'
        };

        const mockType = tokenToMockTypeMapping[tokenPropertyName];

        if (mockType) {
          // Sync each successful contact credit update to Supabase
          response.results.forEach(result => {
            // Find the corresponding update to get the new value
            const update = chunk.find(u => u.id === result.id);
            if (update && update.properties[tokenPropertyName]) {
              const newValue = parseInt(update.properties[tokenPropertyName]);

              // Determine specific and shared credits
              let newSpecificCredits = newValue;
              let newSharedCredits = 0;

              // For shared-enabled mock types, we need current shared value (sync will update it properly)
              if (mockType === 'Situational Judgment' || mockType === 'Clinical Skills') {
                // For these types, shared credits might also change
                // The updateContactCreditsInSupabase will handle the proper update
              }

              updateContactCreditsInSupabase(result.id, mockType, newSpecificCredits, newSharedCredits)
                .then(() => {
                  console.log(`✅ [SUPABASE SYNC] Contact ${result.id} credits synced (bulk refund)`);
                })
                .catch(supabaseError => {
                  console.error(`⚠️ [SUPABASE SYNC] Failed to sync contact ${result.id} (non-blocking):`, supabaseError.message);
                });
            }
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error updating contact token batch:`, error);

      // Mark all in this chunk as failed
      chunk.forEach(update => {
        results.failed.push({
          contactId: update.id,
          error: error.message
        });
      });
    }
  }

  console.log(`✅ Token updates complete: ${results.successful.length} successful, ${results.failed.length} failed`);
  return results;
}

/**
 * Mark bookings as token_refunded in HubSpot
 * Sets token_refunded, token_refunded_at, and token_refund_admin properties
 * @param {Array} bookingIds - Array of booking IDs to mark
 * @param {string} adminEmail - Email of admin processing refund (default: 'system')
 * @returns {Promise<Object>} { successful: Array, failed: Array }
 */
async function markBookingsAsRefunded(bookingIds, adminEmail = 'system') {
  const results = {
    successful: [],
    failed: []
  };

  console.log(`🏷️ Marking ${bookingIds.length} bookings as refunded...`);

  // Prepare updates with all three refund properties
  const refundTimestamp = Date.now().toString();
  const updates = bookingIds.map(id => ({
    id,
    properties: {
      token_refunded: 'true',
      token_refunded_at: refundTimestamp,
      token_refund_admin: adminEmail
    }
  }));

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < updates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = updates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
        inputs: chunk
      });

      if (response.results) {
        response.results.forEach(result => {
          results.successful.push({
            bookingId: result.id,
            updatedAt: result.updatedAt
          });
        });
      }

      console.log(`  ✅ Marked chunk ${i / HUBSPOT_BATCH_SIZE + 1}: ${chunk.length} bookings`);
    } catch (error) {
      console.error(`❌ Error marking booking batch as refunded:`, error);

      // Mark all in this chunk as failed
      chunk.forEach(update => {
        results.failed.push({
          bookingId: update.id,
          error: error.message
        });
      });
    }
  }

  console.log(`✅ Marking complete: ${results.successful.length} successful, ${results.failed.length} failed`);
  return results;
}

/**
 * MAIN ORCHESTRATION FUNCTION
 * Process token refunds for cancelled bookings
 *
 * @param {Array} bookings - Array of booking objects to process
 * @param {string} adminEmail - Email of admin processing refunds (for audit trail)
 * @returns {Promise<Object>} { successful: Array, failed: Array, skipped: Array }
 */
async function processRefunds(bookings, adminEmail = 'system') {
  console.log('\n🎯 Starting token refund processing...');
  console.log(`📋 Processing ${bookings.length} bookings`);
  console.log(`👤 Admin: ${adminEmail}`);

  const results = {
    successful: [],
    failed: [],
    skipped: []
  };

  // Step 1: Validate eligibility and filter
  const eligibleBookings = [];

  bookings.forEach(booking => {
    const validation = validateRefundEligibility(booking);

    if (!validation.eligible) {
      console.log(`⏭️ Skipping booking ${booking.id}: ${validation.reason}`);
      results.skipped.push({
        bookingId: booking.id,
        reason: validation.reason
      });
    } else {
      eligibleBookings.push(booking);
    }
  });

  console.log(`✅ Eligible bookings: ${eligibleBookings.length}`);
  console.log(`⏭️ Skipped bookings: ${results.skipped.length}`);

  if (eligibleBookings.length === 0) {
    console.log('ℹ️ No eligible bookings to process');
    return results;
  }

  // Step 2: Group by token type for batch optimization
  const groupedByToken = groupBookingsByTokenType(eligibleBookings);

  // Step 3: Process each token type separately
  for (const [tokenPropertyName, tokenBookings] of Object.entries(groupedByToken)) {
    console.log(`\n📦 Processing ${tokenPropertyName}: ${tokenBookings.length} bookings`);

    try {
      // Step 3.1: Extract contact IDs
      const contactIds = tokenBookings.map(b => {
        const props = b.properties || b;
        return props.associated_contact_id;
      }).filter(Boolean);

      console.log(`👥 Unique contacts: ${[...new Set(contactIds)].length}`);

      // Step 3.2: Fetch current token values
      const currentTokenValues = await batchFetchContactTokens(contactIds, tokenPropertyName);

      // Step 3.3: Calculate updates (+1 to each)
      const tokenUpdates = calculateTokenUpdates(currentTokenValues, tokenPropertyName);

      // Step 3.4: Update contact tokens in HubSpot (with Supabase sync)
      const updateResults = await batchUpdateContactTokens(tokenUpdates, tokenPropertyName);

      // Step 3.5: Mark bookings as refunded
      const bookingIds = tokenBookings.map(b => b.id);
      const markResults = await markBookingsAsRefunded(bookingIds, adminEmail);

      // Step 3.6: Track results
      // Only mark as successful if BOTH token update AND booking mark succeeded
      const successfulContactIds = new Set(updateResults.successful.map(r => r.contactId));
      const successfulBookingIds = new Set(markResults.successful.map(r => r.bookingId));

      tokenBookings.forEach(booking => {
        const contactId = (booking.properties || booking).associated_contact_id;
        const bookingId = booking.id;

        const tokenUpdateSuccess = successfulContactIds.has(contactId);
        const markSuccess = successfulBookingIds.has(bookingId);

        if (tokenUpdateSuccess && markSuccess) {
          results.successful.push({
            bookingId,
            contactId,
            tokenType: tokenPropertyName,
            tokenRefunded: true
          });
        } else {
          results.failed.push({
            bookingId,
            contactId,
            tokenType: tokenPropertyName,
            error: !tokenUpdateSuccess ? 'Token update failed' : 'Marking booking failed'
          });
        }
      });

    } catch (error) {
      console.error(`❌ Critical error processing ${tokenPropertyName}:`, error);

      // Mark all bookings in this token group as failed
      tokenBookings.forEach(booking => {
        results.failed.push({
          bookingId: booking.id,
          contactId: (booking.properties || booking).associated_contact_id,
          tokenType: tokenPropertyName,
          error: error.message
        });
      });
    }
  }

  // Final summary
  console.log('\n📊 REFUND PROCESSING COMPLETE');
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️ Skipped: ${results.skipped.length}`);
  console.log(`📝 Total processed: ${bookings.length}`);

  return results;
}

// Export all functions
module.exports = {
  // Main orchestration
  processRefunds,

  // Core functions
  getTokenPropertyName,
  validateRefundEligibility,
  groupBookingsByTokenType,
  batchFetchContactTokens,
  calculateTokenUpdates,
  batchUpdateContactTokens,
  markBookingsAsRefunded,

  // Constants
  TOKEN_PROPERTY_MAP,
  HUBSPOT_OBJECTS,
  HUBSPOT_BATCH_SIZE
};
