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
   * Send contact credits sync webhook to HubSpot
   *
   * @param {string} contactId - HubSpot Contact ID
   * @param {string} creditField - Credit field to update (e.g., 'sj_credits')
   * @param {number} newCreditValue - New credit value after deduction
   * @returns {Promise<{success: boolean, message: string}>}
   */
  /**
   * Send contact credits sync webhook to HubSpot
   * Sends ALL credit types to keep HubSpot fully synchronized
   *
   * @param {string} contactId - HubSpot Contact ID
   * @param {Object} allCredits - Object with all credit fields
   * @param {number} allCredits.sj_credits - SJ credits
   * @param {number} allCredits.cs_credits - CS credits
   * @param {number} allCredits.sjmini_credits - SJ Mini credits
   * @param {number} allCredits.mock_discussion_token - Mock discussion tokens
   * @param {number} allCredits.shared_mock_credits - Shared mock credits
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async syncContactCredits(contactId, email, allCredits) {
    try {
      const CONTACT_CREDITS_WEBHOOK = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/PcbOjzx';
      
      // Always send ALL credit types to keep HubSpot fully synchronized
      const payload = {
        contact_id: contactId,
        email: email,
        sj_credits: parseInt(allCredits.sj_credits) || 0,
        cs_credits: parseInt(allCredits.cs_credits) || 0,
        sjmini_credits: parseInt(allCredits.sjmini_credits) || 0,
        mock_discussion_token: parseInt(allCredits.mock_discussion_token) || 0,
        shared_mock_credits: parseInt(allCredits.shared_mock_credits) || 0,
      };

      console.log(`📤 [WEBHOOK] Sending ALL credit types for contact ${contactId}:`, payload);

      const startTime = Date.now();
      const response = await fetch(CONTACT_CREDITS_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        console.log(`✅ [WEBHOOK] Credit sync successful (${duration}ms) - Status: ${response.status}`);
        return {
          success: true,
          message: `Contact credit webhook sent successfully (${duration}ms)`
        };
      } else {
        const errorText = await response.text();
        console.error(`❌ [WEBHOOK] Credit sync failed - Status: ${response.status}, Error: ${errorText}`);
        return {
          success: false,
          message: `Contact credit webhook failed: ${response.status} ${errorText}`
        };
      }

    } catch (error) {
      console.error(`❌ [WEBHOOK] Contact credits exception:`, error.message);
      return {
        success: false,
        message: `Contact credit webhook error: ${error.message}`
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
  static async syncWithRetry(type, ...args) {
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let result;

        if (type === 'totalBookings') {
          result = await this.syncTotalBookings(...args);
        } else if (type === 'contactCredits') {  // ADD THIS
          result = await this.syncContactCredits(...args);
        } else {
          throw new Error(`Unknown sync type: ${type}`);
        }

        if (result.success) {
          return result;
        }

        if (attempt < maxRetries) {
          const delay = attempt * 1000; // 1s, 2s, 3s
          console.log(`[WEBHOOK] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return {
        success: false,
        message: `Failed after ${maxRetries} attempts`
      };
  }
}

module.exports = { HubSpotWebhookService };