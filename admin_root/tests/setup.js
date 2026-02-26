// Test setup file for admin_root
require('dotenv').config({ path: '.env.local' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock HubSpot API token if not set
if (!process.env.HS_PRIVATE_APP_TOKEN) {
  process.env.HS_PRIVATE_APP_TOKEN = 'test-token-12345';
}

// Mock Supabase credentials if not set (required for client initialization)
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-12345';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key-12345';
}

// Global test timeout
jest.setTimeout(30000);
