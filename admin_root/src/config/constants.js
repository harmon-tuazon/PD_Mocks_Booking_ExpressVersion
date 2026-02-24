/**
 * Application Constants
 * Centralized constants used across the admin app
 */

const HUBSPOT_OBJECT_TYPES = {
  CONTACTS: '0-1',
  DEALS: '0-3',
  COURSES: '0-410',
  BOOKINGS: '2-50158943',
  MOCK_EXAMS: '2-50158913',
  TRANSACTIONS: '2-47045790',
  PAYMENT_SCHEDULES: '2-47381547',
  CREDIT_NOTES: '2-41609496',
  CAMPUS_VENUES: '2-41607847',
  ENROLLMENTS: '2-41701559',
  LAB_STATIONS: '2-41603799'
};

const CREDIT_FIELDS = {
  sj_credits: 'Situational Judgment',
  cs_credits: 'Clinical Skills',
  sjmini_credits: 'Mini-mock',
  mock_discussion_token: 'Mock Discussion',
  shared_mock_credits: 'Shared (any type)'
};

const BOOKING_STATUSES = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

module.exports = {
  HUBSPOT_OBJECT_TYPES,
  CREDIT_FIELDS,
  BOOKING_STATUSES
};
