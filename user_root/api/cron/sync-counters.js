require('dotenv').config();
const { HubSpotService } = require('../_shared/hubspot');
const RedisLockService = require('../_shared/redis');

/**
 * Vercel Cron Job: Sync Redis counters to HubSpot
 * Schedule: Every 1 minute
 * Purpose: Push real-time Redis booking counters to HubSpot for eventual consistency
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

  console.log('🔄 [CRON] Starting counter sync job...');

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
        synced: 0,
        message: 'No counters to sync',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 Found ${examKeys.length} exam counters to sync`);

    // Prepare batch updates
    const updates = [];
    for (const key of examKeys) {
      const examId = key.split(':')[1];
      const count = await redis.get(key);

      if (count !== null) {
        updates.push({
          id: examId,
          properties: {
            total_bookings: count.toString()
          }
        });
      }
    }

    if (updates.length === 0) {
      console.log('ℹ️ No valid counters to sync');
      return res.status(200).json({
        success: true,
        synced: 0,
        message: 'No valid counters found',
        timestamp: new Date().toISOString()
      });
    }

    // Batch update HubSpot (maximum 100 per batch)
    const batchSize = 100;
    let totalSynced = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      try {
        await hubspot.apiCall('POST', '/crm/v3/objects/2-50158913/batch/update', {
          inputs: batch
        });

        totalSynced += batch.length;
        console.log(`✅ Synced batch ${Math.floor(i / batchSize) + 1}: ${batch.length} counters`);
      } catch (batchError) {
        console.error(`❌ Failed to sync batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
        // Continue with next batch
      }
    }

    console.log(`✅ Counter sync completed: ${totalSynced}/${updates.length} synced successfully`);

    return res.status(200).json({
      success: true,
      synced: totalSynced,
      total: updates.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Counter sync failed:', error);
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
