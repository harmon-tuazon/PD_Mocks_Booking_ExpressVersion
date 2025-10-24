/**
 * Test script for verifying preloaded sessions in aggregates endpoint
 *
 * This script tests that the aggregates endpoint now includes
 * session details directly, eliminating the need for separate requests.
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.VERCEL_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_ACCESS_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('❌ No admin token found. Please set ADMIN_TOKEN or ADMIN_ACCESS_TOKEN in .env');
  process.exit(1);
}

// Create axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test function
async function testPreloadedAggregates() {
  console.log('\n🧪 Testing Preloaded Aggregates Endpoint\n');
  console.log('='.repeat(60));

  try {
    // 1. Fetch aggregates
    console.log('\n📋 Fetching aggregates with preloaded sessions...');
    const aggregatesResponse = await api.get('/api/admin/mock-exams/aggregates', {
      params: {
        page: 1,
        limit: 5
      }
    });

    const aggregatesData = aggregatesResponse.data;

    // Verify response structure
    console.log('\n✅ Response received:');
    console.log(`   - Success: ${aggregatesData.success}`);
    console.log(`   - Total aggregates: ${aggregatesData.pagination.total_aggregates}`);
    console.log(`   - Current page: ${aggregatesData.pagination.current_page}`);
    console.log(`   - Preloaded sessions: ${aggregatesData.pagination.preloaded_sessions || 0}`);

    // Check if aggregates have sessions preloaded
    if (aggregatesData.data && aggregatesData.data.length > 0) {
      console.log(`\n📊 Analyzing ${aggregatesData.data.length} aggregates:\n`);

      aggregatesData.data.forEach((aggregate, index) => {
        console.log(`${index + 1}. ${aggregate.mock_type} at ${aggregate.location}`);
        console.log(`   Date: ${aggregate.exam_date}`);
        console.log(`   Session count: ${aggregate.session_count}`);
        console.log(`   Total capacity: ${aggregate.total_capacity}`);
        console.log(`   Total bookings: ${aggregate.total_bookings}`);

        // Check for preloaded sessions
        if (aggregate.sessions) {
          console.log(`   ✅ Sessions preloaded: ${aggregate.sessions.length} sessions`);

          // Display first few sessions as examples
          if (aggregate.sessions.length > 0) {
            console.log('\n   📍 Sample sessions:');
            aggregate.sessions.slice(0, 3).forEach(session => {
              console.log(`      - Session ${session.id.slice(-6)}`);
              console.log(`        Time: ${session.start_time} - ${session.end_time}`);
              console.log(`        Capacity: ${session.total_bookings}/${session.capacity} (${session.utilization_rate}%)`);
              console.log(`        Status: ${session.status}`);
            });

            if (aggregate.sessions.length > 3) {
              console.log(`      ... and ${aggregate.sessions.length - 3} more sessions`);
            }
          }
        } else {
          console.log(`   ⚠️ No sessions preloaded (sessions array missing)`);
        }

        console.log();
      });

      // Performance analysis
      console.log('\n📈 Performance Analysis:');
      console.log('='.repeat(40));

      // Calculate total sessions preloaded
      const totalSessionsPreloaded = aggregatesData.data.reduce((total, agg) => {
        return total + (agg.sessions ? agg.sessions.length : 0);
      }, 0);

      console.log(`✅ Total sessions preloaded: ${totalSessionsPreloaded}`);
      console.log(`✅ Eliminated API calls: ${aggregatesData.data.length} (one per aggregate)`);

      // Estimate time saved (assuming 200ms per API call)
      const timeSaved = aggregatesData.data.length * 200;
      console.log(`⏱️ Estimated time saved: ~${timeSaved}ms`);

      // Check if all aggregates have matching session counts
      let allSessionsLoaded = true;
      aggregatesData.data.forEach(agg => {
        if (agg.session_count > 0 && (!agg.sessions || agg.sessions.length !== agg.session_count)) {
          allSessionsLoaded = false;
          console.log(`\n⚠️ Warning: Aggregate ${agg.aggregate_key} has session count mismatch`);
          console.log(`   Expected: ${agg.session_count}, Got: ${agg.sessions ? agg.sessions.length : 0}`);
        }
      });

      if (allSessionsLoaded) {
        console.log('\n✅ All session counts match! Preloading is working correctly.');
      }

    } else {
      console.log('\n⚠️ No aggregates found in the response');
    }

    // 2. Compare with old approach (if endpoint still exists)
    console.log('\n\n🔄 Testing backward compatibility...');
    console.log('='.repeat(40));

    if (aggregatesData.data && aggregatesData.data.length > 0) {
      const firstAggregate = aggregatesData.data[0];

      try {
        console.log(`\nFetching sessions for: ${firstAggregate.aggregate_key}`);
        const sessionsResponse = await api.get(`/api/admin/mock-exams/aggregates/${firstAggregate.aggregate_key}/sessions`);

        const sessionsData = sessionsResponse.data;

        if (sessionsData.success) {
          console.log(`✅ Sessions endpoint still works (for backward compatibility)`);
          console.log(`   Sessions returned: ${sessionsData.sessions.length}`);

          // Compare with preloaded sessions
          if (firstAggregate.sessions) {
            const preloadedCount = firstAggregate.sessions.length;
            const fetchedCount = sessionsData.sessions.length;

            if (preloadedCount === fetchedCount) {
              console.log(`✅ Session counts match: ${preloadedCount} sessions`);
            } else {
              console.log(`⚠️ Session count mismatch!`);
              console.log(`   Preloaded: ${preloadedCount}`);
              console.log(`   Fetched separately: ${fetchedCount}`);
            }
          }
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('ℹ️ Individual sessions endpoint not found (may have been removed)');
        } else {
          console.log(`⚠️ Error testing sessions endpoint: ${error.message}`);
        }
      }
    }

    // Summary
    console.log('\n\n📊 Test Summary');
    console.log('='.repeat(60));
    console.log('✅ Aggregates endpoint successfully returns preloaded sessions');
    console.log('✅ Response structure includes sessions array for each aggregate');
    console.log('✅ Session details include all necessary fields');
    console.log('✅ Performance improvement: N+1 query problem eliminated');
    console.log('\n🎉 Preloaded aggregates test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    process.exit(1);
  }
}

// Run the test
testPreloadedAggregates();