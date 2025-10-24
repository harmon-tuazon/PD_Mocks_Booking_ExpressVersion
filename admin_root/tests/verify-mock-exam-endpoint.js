/**
 * Verification script for GET /api/admin/mock-exams/[id] endpoint
 *
 * This script verifies the endpoint file structure without executing it
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying GET /api/admin/mock-exams/[id] endpoint\n');

// Check if file exists
const endpointPath = path.join(__dirname, '../api/admin/mock-exams/[id].js');

if (!fs.existsSync(endpointPath)) {
  console.error('❌ Endpoint file not found at:', endpointPath);
  process.exit(1);
}

console.log('✅ File exists at correct location\n');

// Read and analyze the file content
const content = fs.readFileSync(endpointPath, 'utf-8');

// Check for required imports
const checks = [
  {
    name: 'requireAdmin import',
    pattern: /require.*requireAdmin/,
    found: false
  },
  {
    name: 'Cache service import',
    pattern: /require.*cache/,
    found: false
  },
  {
    name: 'HubSpot service import',
    pattern: /require.*hubspot/,
    found: false
  },
  {
    name: 'ID extraction from query',
    pattern: /req\.query\.id/,
    found: false
  },
  {
    name: 'ID validation',
    pattern: /Mock exam ID is required/,
    found: false
  },
  {
    name: 'Cache key generation',
    pattern: /admin:mock-exam:details/,
    found: false
  },
  {
    name: '2-minute TTL (120 seconds)',
    pattern: /cache\.set.*120/,
    found: false
  },
  {
    name: 'Available slots calculation',
    pattern: /capacity.*totalBookings|available.*slots/i,
    found: false
  },
  {
    name: '404 error handling',
    pattern: /status\(404\)/,
    found: false
  },
  {
    name: '401 auth error handling',
    pattern: /status\(401\)/,
    found: false
  },
  {
    name: 'Success response structure',
    pattern: /success:\s*true.*data:/s,
    found: false
  },
  {
    name: 'Response meta with timestamp',
    pattern: /meta:.*timestamp/s,
    found: false
  },
  {
    name: 'Cached flag in meta',
    pattern: /meta:.*cached/s,
    found: false
  }
];

// Run checks
console.log('📝 Checking endpoint implementation:\n');
checks.forEach(check => {
  check.found = check.pattern.test(content);
  const status = check.found ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
});

const failedChecks = checks.filter(c => !c.found);
if (failedChecks.length > 0) {
  console.log('\n⚠️ Warning: Some checks failed. Please review the implementation.');
} else {
  console.log('\n🎉 All checks passed!');
}

// Display endpoint summary
console.log('\n📋 Endpoint Summary:');
console.log('-------------------');
console.log('Path: /api/admin/mock-exams/[id]');
console.log('Method: GET');
console.log('Auth: Required (admin)');
console.log('Cache: 2-minute TTL');
console.log('Response format:');
console.log(`{
  success: true,
  data: {
    id: string,
    mock_type: string,
    exam_date: string,
    start_time: string,
    end_time: string,
    capacity: number,
    total_bookings: number,
    available_slots: number,
    location: string,
    address: string,
    is_active: boolean,
    status: string,
    created_at: string,
    updated_at: string
  },
  meta: {
    timestamp: string,
    cached: boolean
  }
}`);

console.log('\nError responses:');
console.log('- 400: Invalid ID format');
console.log('- 401: Authentication failed');
console.log('- 404: Mock exam not found');
console.log('- 500: Server error');

console.log('\n✨ Endpoint verification complete!');