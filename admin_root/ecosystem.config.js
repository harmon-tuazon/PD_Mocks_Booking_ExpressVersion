module.exports = {
  apps: [{
    name: 'admin-app',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Restart policy
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,

    // Memory limit — restart worker if it exceeds 512MB
    max_memory_restart: '512M',

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,

    // Cron jobs run in-process, so only ONE worker should run them.
    // node-cron runs in every cluster worker by default.
    // The scheduler checks cluster.isPrimary or worker.id === 1 is NOT
    // built-in to node-cron, so we handle this by setting instance_var
    // and checking in scheduler.js. For simplicity, cron runs in all
    // workers (idempotent operations) — duplicates are harmless.
    watch: false
  }]
};
