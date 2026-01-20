/**
 * Timezone Helper Functions
 *
 * Determines the appropriate timezone label to display for mock exam sessions
 * based on mock type and location.
 */

/**
 * Get timezone label for a mock exam session
 *
 * @param {string} mockType - The type of mock exam (e.g., "Situational Judgment", "Clinical Skills", "Mini-mock")
 * @param {string} location - The exam location (e.g., "Vancouver", "Calgary", "Ottawa")
 * @returns {string} - Timezone label (e.g., "EST", "PST", "MST")
 */
export const getTimezoneLabel = (mockType, location) => {
  // For Situational Judgment and Mini-mock: always EST
  if (mockType === 'Situational Judgment' || mockType === 'Mini-mock') {
    return 'EST';
  }

  // For Clinical Skills: dynamic based on location
  if (mockType === 'Clinical Skills') {
    if (!location) return 'EST'; // Default to EST if location is missing

    const locationLower = location.toLowerCase();

    // Vancouver → PST
    if (locationLower.includes('vancouver')) {
      return 'PST';
    }

    // Calgary → MST
    if (locationLower.includes('calgary')) {
      return 'MST';
    }

    // All other locations → EST (Toronto, Ottawa, Montreal, etc.)
    return 'EST';
  }

  // Default fallback for any other mock type
  return 'EST';
};

/**
 * Format timezone label for display
 *
 * @param {string} timezone - The timezone abbreviation (e.g., "EST")
 * @returns {string} - Formatted timezone string for display (e.g., "(EST)")
 */
export const formatTimezoneForDisplay = (timezone) => {
  return `(${timezone})`;
};
