/**
 * Supabase Edge Function Webhook Service
 *
 * Triggers Supabase Edge Functions to cascade exam updates to bookings.
 * Uses fire-and-forget pattern to avoid blocking admin operations.
 */

/**
 * Trigger Supabase Edge Function to cascade exam updates to bookings
 *
 * @param {string} mockExamId - HubSpot Mock Exam ID
 * @param {Object} updatedProperties - Properties that changed
 * @param {string} updatedProperties.exam_date - New exam date (optional)
 * @param {string} updatedProperties.start_time - New start time (optional)
 * @param {string} updatedProperties.end_time - New end time (optional)
 * @param {string} updatedProperties.location - New location (optional)
 * @param {string} updatedProperties.mock_type - New mock type (optional)
 */
async function triggerExamCascade(mockExamId, updatedProperties) {
  const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL;
  const webhookSecret = process.env.SHAKY_MOCKS_KEY;

  if (!edgeFunctionUrl || !webhookSecret) {
    console.warn('⚠️ Supabase Edge Function not configured - skipping cascade');
    return;
  }

  // Fire-and-forget: trigger webhook without awaiting response
  process.nextTick(async () => {
    try {
      console.log(`🔔 Triggering exam cascade webhook for exam ${mockExamId}`);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret,
        },
        body: JSON.stringify({
          mockExamId,
          updatedProperties,
          source: 'admin',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Webhook cascade failed for exam ${mockExamId}:`, error);
      } else {
        const result = await response.json();
        console.log(`✅ Cascade webhook triggered: ${result.bookingsUpdated || 0} bookings updated`);
      }
    } catch (error) {
      console.error(`❌ Failed to trigger cascade webhook for exam ${mockExamId}:`, error.message);
    }
  });
}

/**
 * Check if exam properties contain fields that should cascade to bookings
 *
 * @param {Object} properties - Exam properties being updated
 * @returns {boolean} True if cascade is needed
 */
function shouldCascadeUpdate(properties) {
  const cascadeFields = [
    'exam_date',
    'start_time',
    'end_time',
    'location',
    'mock_type',
  ];

  return cascadeFields.some(field => properties.hasOwnProperty(field));
}

/**
 * Extract only cascade-relevant properties
 *
 * @param {Object} properties - All exam properties
 * @returns {Object} Filtered properties for cascade
 */
function extractCascadeProperties(properties) {
  const cascadeProps = {};

  if (properties.exam_date !== undefined) cascadeProps.exam_date = properties.exam_date;
  if (properties.start_time !== undefined) cascadeProps.start_time = properties.start_time;
  if (properties.end_time !== undefined) cascadeProps.end_time = properties.end_time;
  if (properties.location !== undefined) cascadeProps.location = properties.location;
  if (properties.mock_type !== undefined) cascadeProps.mock_type = properties.mock_type;

  return cascadeProps;
}

module.exports = {
  triggerExamCascade,
  shouldCascadeUpdate,
  extractCascadeProperties,
};
