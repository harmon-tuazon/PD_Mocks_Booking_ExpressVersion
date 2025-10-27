/**
 * Test script to debug bookings API endpoint
 * Usage: node test-bookings-api.js <mockExamId>
 */

const https = require('https');

// Get mock exam ID from command line argument
const mockExamId = process.argv[2] || '30958612792'; // Default to user's exam ID if not provided

console.log(`\n🔍 Testing bookings API for mock exam: ${mockExamId}\n`);

const options = {
  hostname: 'admin-prepdoctors-bookings-mvdouiyia-prepdoctors.vercel.app',
  path: `/api/admin/mock-exams/${mockExamId}/bookings?debug=true`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_AUTH_TOKEN || 'YOUR_TOKEN_HERE'}`,
    'Content-Type': 'application/json'
  }
};

console.log(`📡 Making request to: https://${options.hostname}${options.path}\n`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📥 Response Status: ${res.statusCode}\n`);

    try {
      const jsonData = JSON.parse(data);
      console.log('📊 Response Data:');
      console.log(JSON.stringify(jsonData, null, 2));

      if (jsonData.data?.bookings) {
        console.log(`\n✅ Found ${jsonData.data.bookings.length} bookings`);
      } else {
        console.log('\n⚠️ No bookings found in response');
      }
    } catch (error) {
      console.log('Raw response:', data);
      console.error('❌ Error parsing JSON:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.end();

console.log('⏳ Waiting for response...\n');
console.log('💡 Note: Check Vercel function logs for detailed HubSpot associations debug info');
console.log('💡 Visit: https://vercel.com/prepdoctors/admin-prepdoctors-bookings/logs\n');
