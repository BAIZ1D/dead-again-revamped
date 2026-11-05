import fs from 'fs';
import path from 'path';
import http from 'http';
import assert from 'assert';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const relayIndexPath = path.resolve(rootDir, 'relay-server/src/index.js');
const tmpDir = path.resolve(rootDir, 'test-tmp');

console.log('--- STARTING PHASE 7 VERIFICATION TEST SUITE ---');

// ==========================================
// 1. Static Verification Checks
// ==========================================
console.log('\n[1/4] Running Static Verification Checks...');
const relaySrc = fs.readFileSync(relayIndexPath, 'utf8');

// RELAY-04: Strict loopback 127.0.0.1 binding with APG_HOST override
assert.ok(
  relaySrc.includes("const HOST = process.env.APG_HOST || '127.0.0.1';"),
  'RELAY-04: HOST defaults to 127.0.0.1 with process.env.APG_HOST override'
);
assert.ok(
  relaySrc.includes('server.listen(PORT, HOST'),
  'RELAY-04: server.listen explicitly specifies HOST parameter'
);

// RELAY-05: External config persistence via APG_CONFIG_PATH with auto-seeding & corrupt recovery
assert.ok(
  relaySrc.includes('process.env.APG_CONFIG_PATH'),
  'RELAY-05: activeConfigPath resolves process.env.APG_CONFIG_PATH'
);
assert.ok(
  relaySrc.includes('.bak'),
  'RELAY-05: Corrupt config is backed up with .bak extension'
);
assert.ok(
  relaySrc.includes('.tmp.'),
  'RELAY-05: saveConfig uses atomic temp file write'
);

// RELAY-06: Child process IPC lifecycle hooks & graceful teardown
assert.ok(
  relaySrc.includes("type: 'RELAY_READY'"),
  'RELAY-06: server.listen emits RELAY_READY IPC handshake'
);
assert.ok(
  relaySrc.includes("msg.type === 'SHUTDOWN'"),
  'RELAY-06: IPC message handler responds to SHUTDOWN message'
);
assert.ok(
  relaySrc.includes("process.on('disconnect'"),
  'RELAY-06: Parent disconnect trap hooked via process.on("disconnect")'
);
assert.ok(
  relaySrc.includes('1500'),
  'RELAY-06: Teardown includes 1500ms hard safety timeout'
);

console.log('✓ All static checks PASSED!');

// ==========================================
// Helper Utilities for Live Tests
// ==========================================
function spawnRelay(envOverrides = {}) {
  const child = fork(relayIndexPath, [], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...envOverrides
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  });

  const readyPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for RELAY_READY signal'));
    }, 5000);

    const onMessage = (msg) => {
      if (msg && msg.type === 'RELAY_READY') {
        clearTimeout(timer);
        child.off('message', onMessage);
        resolve(msg);
      }
    };
    child.on('message', onMessage);
  });

  return { child, readyPromise };
}

function waitForExit(child, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Child did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

// Reset tmp directory
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

async function runLiveTests() {
  try {
    // ==========================================
    // 2. Live Test 1: Loopback Binding & APG_HOST Override (RELAY-04)
    // ==========================================
    console.log('\n[2/4] Testing Loopback Binding & APG_HOST Override (RELAY-04)...');
    const port1 = 8190;
    const { child: child1, readyPromise: ready1 } = spawnRelay({
      PORT: String(port1),
      APG_HOST: '127.0.0.1'
    });

    const readyMsg1 = await ready1;
    assert.strictEqual(readyMsg1.port, port1, `Ready port must match ${port1}`);
    assert.strictEqual(readyMsg1.host, '127.0.0.1', 'Ready host must match 127.0.0.1');

    const res1 = await httpGet(`http://127.0.0.1:${port1}/api/status`);
    assert.strictEqual(res1.status, 200, 'HTTP /api/status should return 200 OK');
    assert.strictEqual(res1.data.connected, true, 'Status response should indicate connected: true');

    // Trigger graceful shutdown
    child1.send({ type: 'SHUTDOWN' });
    const exit1 = await waitForExit(child1, 2000);
    assert.strictEqual(exit1.code, 0, 'Relay should exit cleanly with code 0 on SHUTDOWN');
    console.log('✓ Live Test 1 PASSED: Loopback 127.0.0.1 bound and clean IPC SHUTDOWN verified.');

    // ==========================================
    // 3. Live Test 2: External Config Persistence, Auto-Seeding & Corrupt Recovery (RELAY-05)
    // ==========================================
    console.log('\n[3/4] Testing Config Auto-Seeding & Corrupt Recovery (RELAY-05)...');

    // Part A: Auto-seeding
    const seedConfigPath = path.join(tmpDir, 'phase7-auto-seed', 'config.json');
    assert.ok(!fs.existsSync(seedConfigPath), 'Seed config should not exist before relay boots');

    const port2 = 8191;
    const { child: child2, readyPromise: ready2 } = spawnRelay({
      PORT: String(port2),
      APG_CONFIG_PATH: seedConfigPath
    });

    await ready2;
    assert.ok(fs.existsSync(seedConfigPath), 'Config file should be auto-created on startup');
    const seededData = JSON.parse(fs.readFileSync(seedConfigPath, 'utf8'));
    assert.ok(seededData.rateLimits && typeof seededData.rateLimits.baseCooldownMs === 'number', 'Seeded config must have rateLimits');
    assert.strictEqual(seededData.port, 8080, 'Default config port should be 8080');

    child2.send({ type: 'SHUTDOWN' });
    const exit2 = await waitForExit(child2, 2000);
    assert.strictEqual(exit2.code, 0, 'Relay should exit cleanly with code 0');

    // Part B: Corrupted config recovery
    const corruptDir = path.join(tmpDir, 'phase7-corrupt');
    fs.mkdirSync(corruptDir, { recursive: true });
    const corruptConfigPath = path.join(corruptDir, 'config.json');
    const corruptContent = '{ "corrupt": true, invalid syntax ...';
    fs.writeFileSync(corruptConfigPath, corruptContent, 'utf8');

    const port3 = 8192;
    const { child: child3, readyPromise: ready3 } = spawnRelay({
      PORT: String(port3),
      APG_CONFIG_PATH: corruptConfigPath
    });

    await ready3;

    // Verify .bak created with the corrupt content
    const backupPath = `${corruptConfigPath}.bak`;
    assert.ok(fs.existsSync(backupPath), '.bak file should exist after corrupt config recovery');
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    assert.strictEqual(backupContent, corruptContent, 'Backup file should contain original corrupt content');

    // Verify re-seeded clean config
    assert.ok(fs.existsSync(corruptConfigPath), 'Original config path should be re-seeded');
    const recoveredData = JSON.parse(fs.readFileSync(corruptConfigPath, 'utf8'));
    assert.ok(recoveredData.rateLimits, 'Re-seeded config should contain valid default rateLimits');

    child3.send({ type: 'SHUTDOWN' });
    const exit3 = await waitForExit(child3, 2000);
    assert.strictEqual(exit3.code, 0, 'Relay should exit cleanly with code 0');

    console.log('✓ Live Test 2 PASSED: Auto-seeding and corrupt config recovery verified.');

    // ==========================================
    // 4. Live Test 3: Parent Disconnect Trap & Zombie Prevention (RELAY-06)
    // ==========================================
    console.log('\n[4/4] Testing Parent Disconnect Trap & Zombie Prevention (RELAY-06)...');
    const port4 = 8193;
    const { child: child4, readyPromise: ready4 } = spawnRelay({
      PORT: String(port4)
    });

    await ready4;

    // Simulate parent process dying by closing IPC channel
    child4.disconnect();
    const exit4 = await waitForExit(child4, 2000);
    assert.strictEqual(exit4.code, 0, 'Relay should terminate cleanly with code 0 on parent disconnect');
    console.log('✓ Live Test 3 PASSED: Parent disconnect trap verified (zero zombie processes).');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 7 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
    process.exit(1);
  }
}

runLiveTests();
