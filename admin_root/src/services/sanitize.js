/**
 * Input Sanitization Utility
 *
 * Sanitizes user-provided string fields before storing in database.
 * Defense-in-depth against stored XSS - strips HTML/script tags from
 * free-text inputs while preserving safe content.
 *
 * Portable: Pure Node.js, no platform-specific dependencies.
 */

const xss = require('xss');

// Configure xss with strict whitelist (allow no HTML tags)
const xssOptions = {
  whiteList: {},           // No HTML tags allowed
  stripIgnoreTag: true,    // Strip tags not in whitelist
  stripIgnoreTagBody: ['script', 'style'], // Remove script/style content entirely
};

/**
 * Sanitize a single string value
 * @param {string} value - Raw user input
 * @returns {string} Sanitized string
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value, xssOptions);
}

/**
 * Sanitize specified fields in an object
 * Only processes string values for the given field names.
 * Non-string fields and fields not in the list are left untouched.
 *
 * @param {object} obj - Object containing user input
 * @param {string[]} fields - Field names to sanitize
 * @returns {object} New object with sanitized fields
 *
 * @example
 * const clean = sanitizeFields(req.body, ['group_name', 'instructor_name', 'notes']);
 */
function sanitizeFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;

  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = sanitizeString(result[field]);
    }
  }
  return result;
}

module.exports = {
  sanitizeString,
  sanitizeFields,
};
