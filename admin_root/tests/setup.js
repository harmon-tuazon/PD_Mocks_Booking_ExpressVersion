// Test setup file for admin_root
require('dotenv').config({ path: '.env.local' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock HubSpot API token if not set
if (!process.env.HS_PRIVATE_APP_TOKEN) {
  process.env.HS_PRIVATE_APP_TOKEN = 'test-token-12345';
}

// Global test timeout
jest.setTimeout(30000);
