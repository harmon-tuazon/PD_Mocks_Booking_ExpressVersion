require('dotenv').config({ path: '.env.local' });

process.env.NODE_ENV = 'test';

if (!process.env.HS_PRIVATE_APP_TOKEN) {
  process.env.HS_PRIVATE_APP_TOKEN = 'test-token-12345';
}

jest.setTimeout(30000);
