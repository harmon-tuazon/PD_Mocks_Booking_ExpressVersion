module.exports = {
  apps: [{
    name: 'user-app',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
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

    // Watch (disabled in production — enable for dev if needed)
    watch: false
  }]
};
