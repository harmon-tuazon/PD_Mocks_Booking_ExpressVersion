const RedisLockService = require('./redis');
const { supabaseAdmin } = require('./supabase');

let redisInstance = null;

/**
 * Initialize persistent connections for Express (vs cold-start per-request in serverless)
 */
const initializeConnections = async () => {
  console.log('Initializing connections...');

  // Redis - persistent connection (RedisLockService handles its own connection)
  redisInstance = new RedisLockService();
  const healthCheck = await redisInstance.healthCheck();
  if (healthCheck) {
    console.log('Redis connected');
  } else {
    console.warn('Redis health check failed - will retry on first use');
  }

  // Supabase client is already a singleton (imported from supabase.js)
  console.log('Supabase initialized');

  return { redis: redisInstance, supabase: supabaseAdmin };
};

/**
 * Close all persistent connections for graceful shutdown
 */
const closeConnections = async () => {
  console.log('Closing connections...');

  if (redisInstance) {
    try {
      await redisInstance.close();
      console.log('Redis disconnected');
    } catch (err) {
      console.error('Error closing Redis:', err.message);
    }
  }
};

const getRedis = () => {
  if (!redisInstance) {
    redisInstance = new RedisLockService();
  }
  return redisInstance;
};

const getSupabase = () => supabaseAdmin;

module.exports = {
  initializeConnections,
  closeConnections,
  getRedis,
  getSupabase
};
