module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/**/*.test.js',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.test.js',
    '<rootDir>/tests/api/**/*.test.js',
  ],
  // TODO: Increase thresholds as test coverage improves
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  modulePathIgnorePatterns: [
    '<rootDir>/frontend/',
    '<rootDir>/admin_root/',
    '<rootDir>/user_root/',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/admin_root/',
    '<rootDir>/user_root/',
    // TODO: These tests reference old serverless paths (api/_shared/) and need rewriting for Express
    '<rootDir>/tests/unit/redis-lock\\.test\\.js',
    '<rootDir>/tests/unit/cache\\.test\\.js',
    '<rootDir>/tests/unit/batch\\.test\\.js',
    '<rootDir>/tests/unit/validation\\.test\\.js',
    '<rootDir>/tests/unit/hubspot-service\\.test\\.js',
    '<rootDir>/tests/api/bookings/create\\.test\\.js',
    '<rootDir>/tests/integration/booking-race-condition\\.test\\.js',
    '<rootDir>/tests/integration/optimized-endpoints\\.test\\.js',
  ],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
};