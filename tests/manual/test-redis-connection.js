/**
 * Manual Test: Redis Connection
 *
 * Tests the Redis connection and basic lock operations
 *
 * Usage:
 *   node tests/manual/test-redis-connection.js
 */

require('dotenv').config({ path: '.env.development.local' });
const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...\n');

  // Check if REDIS_URL is configured (try both variable names)
  const redisUrl = process.env.PD_Bookings_Cache_REDIS_URL || process.env.REDIS_URL;

  if (!redisUrl) {
    console.error('❌ Redis URL environment variable not found!');
    console.log('💡 Looked for: PD_Bookings_Cache_REDIS_URL or REDIS_URL');
    console.log('💡 Add it to Vercel with: vercel env add PD_Bookings_Cache_REDIS_URL');
    console.log('💡 Then pull it with: vercel env pull .env.development.local');
    process.exit(1);
  }

  const varName = process.env.PD_Bookings_Cache_REDIS_URL ? 'PD_Bookings_Cache_REDIS_URL' : 'REDIS_URL';
  console.log(`✅ ${varName} found`);
  console.log(`📍 URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  let redis;

  try {
    // Initialize Redis client
    console.log('🔌 Connecting to Redis...');
    redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Failed to connect after 3 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        console.log(`⏳ Retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    });

    // Wait for connection
    await redis.ping();
    console.log('✅ Connected to Redis successfully!\n');

    // Test 1: Basic SET/GET
    console.log('📝 Test 1: Basic SET/GET');
    await redis.set('test:connection', 'Hello from PrepDoctors!', 'EX', 10);
    const value = await redis.get('test:connection');
    console.log(`   SET: test:connection = "Hello from PrepDoctors!"`);
    console.log(`   GET: test:connection = "${value}"`);
    console.log(value === 'Hello from PrepDoctors!' ? '   ✅ PASS\n' : '   ❌ FAIL\n');

    // Test 2: Lock Acquisition (SET NX EX)
    console.log('🔒 Test 2: Lock Acquisition (SET NX EX)');
    const lockKey = 'test:lock:exam-123';
    const lockToken = `${Date.now()}-${Math.random()}`;

    const lockResult = await redis.set(lockKey, lockToken, 'EX', 10, 'NX');
    console.log(`   SET ${lockKey} NX EX 10`);
    console.log(`   Result: ${lockResult}`);
    console.log(lockResult === 'OK' ? '   ✅ Lock acquired\n' : '   ❌ FAIL\n');

    // Test 3: Lock Already Held (should fail)
    console.log('🔒 Test 3: Lock Already Held (should return null)');
    const lockResult2 = await redis.set(lockKey, 'another-token', 'EX', 10, 'NX');
    console.log(`   SET ${lockKey} NX EX 10 (while already locked)`);
    console.log(`   Result: ${lockResult2}`);
    console.log(lockResult2 === null ? '   ✅ PASS (correctly rejected)\n' : '   ❌ FAIL\n');

    // Test 4: Lock Release with Lua Script
    console.log('🔓 Test 4: Lock Release (Lua Script)');
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const releaseResult = await redis.eval(luaScript, 1, lockKey, lockToken);
    console.log(`   Lua: Check token and delete if match`);
    console.log(`   Result: ${releaseResult}`);
    console.log(releaseResult === 1 ? '   ✅ Lock released\n' : '   ❌ FAIL\n');

    // Test 5: Redis INFO
    console.log('📊 Test 5: Redis Server Info');
    const info = await redis.info('server');
    const memory = await redis.info('memory');

    const redisVersion = info.match(/redis_version:(.*)/)?.[1]?.trim() || 'unknown';
    const usedMemory = memory.match(/used_memory_human:(.*)/)?.[1]?.trim() || 'unknown';
    const maxMemory = memory.match(/maxmemory_human:(.*)/)?.[1]?.trim() || 'unknown';

    console.log(`   Redis Version: ${redisVersion}`);
    console.log(`   Used Memory: ${usedMemory}`);
    console.log(`   Max Memory: ${maxMemory}`);
    console.log('   ✅ Server info retrieved\n');

    // Test 6: Latency Test
    console.log('⚡ Test 6: Latency Test (10 operations)');
    const latencies = [];

    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      latencies.push(latency);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`   Min: ${minLatency}ms`);
    console.log(`   Max: ${maxLatency}ms`);
    console.log(avgLatency < 100 ? '   ✅ PASS (latency acceptable)\n' : '   ⚠️ WARNING (high latency)\n');

    // Cleanup
    console.log('🧹 Cleanup: Deleting test keys');
    await redis.del('test:connection');
    console.log('   ✅ Test keys deleted\n');

    console.log('═══════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════');
    console.log('\n📌 Next Steps:');
    console.log('   1. Add REDIS_URL to Vercel production:');
    console.log('      vercel env add REDIS_URL production');
    console.log('   2. Implement RedisLockService in api/_shared/redis.js');
    console.log('   3. Integrate locking into api/bookings/create.js\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (redis) {
      await redis.quit();
      console.log('👋 Redis connection closed');
    }
  }
}

// Run tests
testRedisConnection().catch(console.error);
