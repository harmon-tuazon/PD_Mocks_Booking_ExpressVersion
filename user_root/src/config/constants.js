/**
 * Application constants
 */

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // requests per window

  // Redis TTLs (in seconds)
  REDIS_TTL: {
    CACHE_DEFAULT: 5 * 60,       // 5 minutes
    BOOKING_COUNTER: 7 * 24 * 60 * 60, // 1 week
    LOCK_TIMEOUT: 10,            // 10 seconds
    CONTACT_CACHE: 5 * 60        // 5 minutes
  },

  // HubSpot Object Type IDs
  HUBSPOT_OBJECTS: {
    CONTACTS: '0-1',
    BOOKINGS: '2-50158943',
    MOCK_EXAMS: '2-50158913'
  },

  // Mock types
  MOCK_TYPES: {
    SITUATIONAL_JUDGMENT: 'Situational Judgement',
    CLINICAL_SKILLS: 'Clinical Skills',
    MINI_MOCK: 'Mini-mock',
    MOCK_DISCUSSION: 'Mock Discussion'
  },

  // Credit fields mapped to mock types
  CREDIT_FIELDS: {
    'Situational Judgement': 'sj_credits',
    'Clinical Skills': 'cs_credits',
    'Mini-mock': 'sjmini_credits',
    'Mock Discussion': 'mock_discussion_token'
  },

  // Booking statuses
  BOOKING_STATUS: {
    ACTIVE: 'Active',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed'
  }
};
