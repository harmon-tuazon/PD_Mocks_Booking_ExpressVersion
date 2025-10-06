require('dotenv').config();
const axios = require('axios');

const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const bookingIds = [
  '35214453265', '35782536092', '35207858728', '35286006455',
  '35930967887', '35335278135', '35371654718', '35760493356'
];

async function checkBookings() {
  console.log('Checking is_active status for all associated bookings...\n');

  const response = await hubspotApi.post(
    '/crm/v3/objects/2-50158943/batch/read',
    {
      inputs: bookingIds.map(id => ({ id })),
      properties: ['booking_id', 'is_active', 'name', 'mock_type', 'exam_date']
    }
  );

  console.log(`Total bookings checked: ${response.data.results.length}\n`);

  let activeCount = 0;
  let cancelledCount = 0;
  let otherCount = 0;

  response.data.results.forEach(b => {
    const isActive = b.properties.is_active;

    if (isActive === 'Active') activeCount++;
    else if (isActive === 'Cancelled' || isActive === 'cancelled') cancelledCount++;
    else otherCount++;

    console.log(`Booking ${b.id}:`);
    console.log(`  booking_id: ${b.properties.booking_id}`);
    console.log(`  is_active: ${isActive}`);
    console.log(`  name: ${b.properties.name}`);
    console.log(`  exam: ${b.properties.mock_type} on ${b.properties.exam_date}\n`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Active: ${activeCount}`);
  console.log(`  Cancelled: ${cancelledCount}`);
  console.log(`  Other: ${otherCount}`);
  console.log('='.repeat(60));
}

checkBookings().catch(console.error);
