/**
 * HubSpot Webhook Service
 * Sends webhook triggers to HubSpot workflows for real-time property updates
 */

const WEBHOOK_URL = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/AIvBwN0';

class HubSpotWebhookService {
  /**
   * Send total_bookings sync webhook to HubSpot
   *
   * @param {string} mockExamId - HubSpot Mock Exam ID
   * @param {number} totalBookings - Current booking count from Redis
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async syncTotalBookings(mockExamId, totalBookings) {
    try {
      const payload = {
        mock_exam_id: mockExamId,
        total_bookings: parseInt(totalBookings),
      };

      console.log(`📤 [WEBHOOK] Sending total_bookings sync for exam ${mockExamId}: ${totalBookings}`);

      const startTime = Date.now();
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        console.log(`✅ [WEBHOOK] Sync successful (${duration}ms) - Status: ${response.status}`);
        return {
          success: true,
          message: `Webhook sent successfully (${duration}ms)`
        };
      } else {
        const errorText = await response.text();
        console.error(`❌ [WEBHOOK] Sync failed - Status: ${response.status}, Error: ${errorText}`);
        return {
          success: false,
          message: `Webhook failed: ${response.status} ${errorText}`
        };
      }

    } catch (error) {
      console.error(`❌ [WEBHOOK] Exception:`, error.message);
      return {
        success: false,
        message: `Webhook error: ${error.message}`
      };
    }
  }

  /**
   * Sync with retry logic (for critical operations)
   *
   * @param {string} mockExamId
   * @param {number} totalBookings
   * @param {number} maxRetries
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async syncWithRetry(mockExamId, totalBookings, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.syncTotalBookings(mockExamId, totalBookings);

      if (result.success) {
        return result;
      }

      if (attempt < maxRetries) {
        const delay = attempt * 1000; // 1s, 2s, 3s
        console.log(`⏳ [WEBHOOK] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error(`❌ [WEBHOOK] All ${maxRetries} attempts failed for exam ${mockExamId}`);
    return {
      success: false,
      message: `All ${maxRetries} webhook attempts failed`
    };
  }
}

module.exports = { HubSpotWebhookService };
