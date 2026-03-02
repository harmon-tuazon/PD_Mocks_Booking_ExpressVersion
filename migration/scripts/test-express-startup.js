/**
 * Express Server Startup Validator
 *
 * Starts both admin and user Express servers, hits their health endpoints,
 * and reports whether they launched successfully.
 *
 * Usage: node migration/scripts/test-express-startup.js
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ADMIN_PORT = 5000;
const USER_PORT = 3000;
const STARTUP_TIMEOUT_MS = 15000;
const HEALTH_RETRY_INTERVAL_MS = 1000;

const results = { admin: null, user: null };
const processes = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpGet(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function waitForHealth(port, label) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const resp = await httpGet(port, '/api/health');
      // Accept any response (200, 503 degraded, etc.) — the server is UP
      if (resp.status) {
        return { success: true, status: resp.status, body: resp.body };
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, HEALTH_RETRY_INTERVAL_MS));
  }

  return { success: false, error: `${label} did not respond within ${STARTUP_TIMEOUT_MS / 1000}s` };
}

function startServer(name, cwd, port) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['server.js'], {
      cwd,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    processes.push(proc);

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      resolve({ success: false, error: `Failed to spawn: ${err.message}` });
    });

    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        resolve({ success: false, error: `Exited with code ${code}: ${stderr.trim()}` });
      }
    });

    // Give it time then check health
    waitForHealth(port, name).then(resolve);
  });
}

function cleanup() {
  for (const proc of processes) {
    try { proc.kill('SIGTERM'); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Express Server Startup Validation           ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // Start both servers in parallel
  console.log('Starting servers...\n');

  const [adminResult, userResult] = await Promise.all([
    startServer('Admin', path.join(ROOT, 'admin_root'), ADMIN_PORT),
    startServer('User', path.join(ROOT, 'user_root'), USER_PORT),
  ]);

  results.admin = adminResult;
  results.user = userResult;

  // Report
  console.log('━━━ Results ━━━\n');

  if (adminResult.success) {
    console.log(`  ✅ Admin server: UP on port ${ADMIN_PORT}`);
    console.log(`     Health: ${JSON.stringify(adminResult.body)}`);
  } else {
    console.log(`  ❌ Admin server: FAILED`);
    console.log(`     Error: ${adminResult.error}`);
  }

  console.log('');

  if (userResult.success) {
    console.log(`  ✅ User server: UP on port ${USER_PORT}`);
    console.log(`     Health: ${JSON.stringify(userResult.body)}`);
  } else {
    console.log(`  ❌ User server: FAILED`);
    console.log(`     Error: ${userResult.error}`);
  }

  console.log('\n━━━ Summary ━━━\n');
  const allPassed = adminResult.success && userResult.success;
  if (allPassed) {
    console.log('  🎉 Both servers started successfully!\n');
  } else {
    console.log('  🚫 One or more servers failed to start. See errors above.\n');
  }

  cleanup();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  cleanup();
  process.exit(2);
});
