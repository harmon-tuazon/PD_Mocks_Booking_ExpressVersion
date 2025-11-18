require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const RedisLockService = require('../_shared/redis');

/**
 * Get actual booking count from HubSpot associations (source of truth)
 */
async function getActualBookingCountWithDetails(hubspot, examId) {
  try {
    // Get associations from exam to bookings
    const associationsResponse = await hubspot.apiCall('GET',
      `/crm/v4/objects/2-50158913/${examId}/associations/2-50158943`
    );

    const bookingIds = associationsResponse?.results?.map(r => r.toObjectId) || [];

    if (bookingIds.length === 0) {
      return { count: 0, bookings: [] };
    }

    // Batch read booking details (max 100 per request)
    const batchSize = 100;
    let allBookings = [];

    for (let i = 0; i < bookingIds.length; i += batchSize) {
      const batch = bookingIds.slice(i, i + batchSize);

      try {
        const batchResponse = await hubspot.apiCall('POST',
          '/crm/v3/objects/2-50158943/batch/read',
          {
            properties: ['is_active', 'exam_date', 'booking_id'],
            propertiesWithHistory: [],
            inputs: batch.map(id => ({ id }))
          }
        );

        if (batchResponse?.results) {
          allBookings = allBookings.concat(batchResponse.results);
        }
      } catch (batchError) {
        console.error(`Failed to fetch booking batch:`, batchError.message);
      }
    }

    // Get associations from bookings to contacts
    const bookingContactMap = new Map();
    for (let i = 0; i < bookingIds.length; i += batchSize) {
      const batch = bookingIds.slice(i, i + batchSize);

      try {
        for (const bookingId of batch) {
          const contactAssocResponse = await hubspot.apiCall('GET',
            `/crm/v4/objects/2-50158943/${bookingId}/associations/0-1`
          );

          if (contactAssocResponse?.results && contactAssocResponse.results.length > 0) {
            bookingContactMap.set(bookingId, contactAssocResponse.results[0].toObjectId);
          }
        }
      } catch (assocError) {
        console.error(`Failed to fetch contact associations:`, assocError.message);
      }
    }

    // Add contact_id to bookings
    allBookings.forEach(booking => {
      booking.contact_id = bookingContactMap.get(booking.id);
    });

    // Count only active bookings
    const activeCount = allBookings.filter(b =>
      b.properties?.is_active !== 'Cancelled' &&
      b.properties?.is_active !== 'cancelled' &&
      b.properties?.is_active !== false &&
      b.properties?.is_active !== 'false'
    ).length;

    return { count: activeCount, bookings: allBookings };
  } catch (error) {
    console.error(`Failed to get actual booking count for exam ${examId}:`, error.message);
    return { count: 0, bookings: [] };
  }
}

/**
 * Vercel Cron Job: Reconcile Redis counters with HubSpot (source of truth)
 * Schedule: Every 5 minutes
 * Purpose: Fix data drift and handle admin-side cancellations
 */
module.exports = async (req, res) => {
  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    console.error('❌ Unauthorized cron job access attempt');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  console.log('🔄 [CRON] Starting counter reconciliation job...');

  let redis = null;
  let hubspot = null;

  try {
    redis = new RedisLockService();
    hubspot = new HubSpotService();

    // Get all exam counter keys from Redis
    const examKeys = await redis.keys('exam:*:bookings');

    if (examKeys.length === 0) {
      console.log('ℹ️ No exam counters found in Redis');
      return res.status(200).json({
        success: true,
        reconciled: 0,
        statusUpdates: 0,
        message: 'No counters to reconcile',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 Found ${examKeys.length} exam counters to reconcile`);

    const reconciled = [];
    const statusUpdates = [];

    for (const key of examKeys) {
      const examId = key.split(':')[1];
      const redisCount = parseInt(await redis.get(key)) || 0;

      // Fetch ACTUAL count from HubSpot associations (source of truth)
      const { count: actualCount, bookings } = await getActualBookingCountWithDetails(hubspot, examId);

      if (redisCount !== actualCount) {
        console.warn(`🔄 Counter drift detected for exam ${examId}: Redis=${redisCount}, Actual=${actualCount}`);

        // Reconcile: Update BOTH Redis and HubSpot to actual count
        await redis.set(key, actualCount);

        try {
          await hubspot.apiCall('PATCH', `/crm/v3/objects/2-50158913/${examId}`, {
            properties: {
              total_bookings: actualCount.toString()
            }
          });

          reconciled.push({
            examId,
            from: redisCount,
            to: actualCount,
            drift: actualCount - redisCount
          });

          console.log(`✅ Reconciled counter for exam ${examId}: ${redisCount} → ${actualCount}`);
        } catch (updateError) {
          console.error(`❌ Failed to update HubSpot for exam ${examId}:`, updateError.message);
        }
      }

      // IMPORTANT: Also update duplicate detection cache for cancelled bookings
      for (const booking of bookings) {
        const isActive = booking.properties?.is_active;
        const isCancelled = isActive === 'Cancelled' ||
                           isActive === 'cancelled' ||
                           isActive === false ||
                           isActive === 'false';

        if (isCancelled) {
          const contactId = booking.contact_id;
          const examDate = booking.properties?.exam_date;

          if (contactId && examDate) {
            const cacheKey = `booking:${contactId}:${examDate}`;

            // Clear cache for cancelled bookings to allow rebooking
            await redis.del(cacheKey);

            statusUpdates.push({
              bookingId: booking.id,
              action: 'cache_cleared',
              contactId,
              examDate
            });

            console.log(`🗑️ Cleared stale cache for cancelled booking ${booking.id}`);
          }
        }
      }
    }

    console.log(`✅ Reconciliation completed: ${reconciled.length} drifts fixed, ${statusUpdates.length} caches cleared`);

    return res.status(200).json({
      success: true,
      reconciled: reconciled.length,
      statusUpdates: statusUpdates.length,
      details: {
        reconciled: reconciled.slice(0, 10), // First 10 for response size
        statusUpdates: statusUpdates.slice(0, 10)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Counter reconciliation failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (redis) {
      try {
        await redis.close();
      } catch (closeError) {
        console.error('❌ Failed to close Redis connection:', closeError.message);
      }
    }
  }
};
