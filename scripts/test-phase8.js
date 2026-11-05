import fs from 'fs';
import path from 'path';
import net from 'net';
import { execSync } from 'child_process';
import { findAvailablePort, isPortAvailable } from '../desktop/portFinder.js';
import { RelayManager } from '../desktop/relayManager.js';

console.log('--- Starting Phase 8 Automated Verification Suite ---');

// 1. Static Contract Checks
console.log('[Check 1] Verifying DESK-01 Single-Instance Lock in desktop/main.js...');
const mainJs = fs.readFileSync('desktop/main.js', 'utf8');
if (!mainJs.includes('app.requestSingleInstanceLock()') || !mainJs.includes("app.on('second-instance'")) {
  throw new Error('DESK-01: Single-instance lock or second-instance handler missing');
}

console.log('[Check 2] Verifying DESK-02 Dynamic Port Finder in desktop/portFinder.js...');
const portFinderJs = fs.readFileSync('desktop/portFinder.js', 'utf8');
if (!portFinderJs.includes('findAvailablePort') || !portFinderJs.includes('127.0.0.1')) {
  throw new Error('DESK-02: Port finder missing loopback findAvailablePort');
}

console.log('[Check 3] Verifying DESK-03 Relay Supervisor in desktop/relayManager.js...');
const relayMgrJs = fs.readFileSync('desktop/relayManager.js', 'utf8');
if (!relayMgrJs.includes('RELAY_READY') || !relayMgrJs.includes('SHUTDOWN') || !relayMgrJs.includes('SIGKILL')) {
  throw new Error('DESK-03: Relay manager missing RELAY_READY, SHUTDOWN, or SIGKILL fallback');
}

console.log('[Check 4] Verifying DESK-04 Game Window Specs in desktop/windowManager.js...');
const winMgrJs = fs.readFileSync('desktop/windowManager.js', 'utf8');
if (!winMgrJs.includes('setAspectRatio(16 / 9)') || !winMgrJs.includes('backgroundThrottling: false')) {
  throw new Error('DESK-04: Game window missing 16:9 aspect ratio or backgroundThrottling override');
}

console.log('[Check 5] Verifying DESK-05 Dashboard Specs in desktop/windowManager.js and menu.js...');
if (!winMgrJs.includes('[STREAMER ONLY]') || !winMgrJs.includes('event.preventDefault()')) {
  throw new Error('DESK-05: Dashboard window missing private title or hide-on-close handler');
}
const menuJs = fs.readFileSync('desktop/menu.js', 'utf8');
if (!menuJs.includes('CmdOrCtrl+D') || !menuJs.includes('F1')) {
  throw new Error('DESK-05: Menu missing CmdOrCtrl+D or F1 shortcuts');
}

console.log('[Check 6] Verifying DESK-06 Preload Bridge in desktop/preload.cjs and pause hook...');
const preloadJs = fs.readFileSync('desktop/preload.cjs', 'utf8');
if (!preloadJs.includes('contextBridge.exposeInMainWorld') || !preloadJs.includes('openDashboard')) {
  throw new Error('DESK-06: Preload missing secure contextBridge openDashboard');
}

// 2. Live Unit Tests
console.log('[Live Test 1] Port probe and collision fallback...');
const testPort1 = await findAvailablePort(8200, 10);
const blocker = net.createServer().listen(testPort1, '127.0.0.1');
await new Promise((resolve) => blocker.once('listening', resolve));
const fallbackPort = await findAvailablePort(testPort1, 10);
if (fallbackPort <= testPort1) {
  blocker.close();
  throw new Error('Port fallback failed to increment past occupied port');
}
await new Promise((resolve) => blocker.close(resolve));
console.log(`  Passed: Port ${testPort1} collision triggered smooth fallback to ${fallbackPort}`);

console.log('[Live Test 2] Relay supervisor lifecycle & zero zombie verification...');
const testConfigPath = path.resolve('test-tmp/phase8-test-config.json');
const supervisor = new RelayManager(fallbackPort, testConfigPath);
const ready = await supervisor.start(8000);
if (!ready || ready.port !== fallbackPort) {
  throw new Error('Relay failed to signal readiness on target port');
}
const isOccupiedWhileRunning = !(await isPortAvailable(fallbackPort, '127.0.0.1'));
if (!isOccupiedWhileRunning) {
  throw new Error('Port should be occupied while relay is running');
}
await supervisor.stop();
const isFreeAfterStop = await isPortAvailable(fallbackPort, '127.0.0.1');
if (!isFreeAfterStop) {
  throw new Error('Port remains locked after supervisor.stop(); zombie process detected!');
}
console.log(`  Passed: Relay started, signaled RELAY_READY, and cleanly shut down with zero zombies`);

console.log('[Live Test 3] Game compilation and pause hook validation...');
execSync('node scripts/build-game.js', { stdio: 'inherit' });
const compiledJs = fs.readFileSync('main/dist/js/index.js', 'utf8');
if (!compiledJs.includes('g_isPaused') || !compiledJs.includes('openDashboard')) {
  throw new Error('dist/js/index.js missing g_isPaused or openDashboard hook');
}
console.log('  Passed: Compiled game distribution includes desktop pause button');

console.log('\n--- ALL PHASE 8 VERIFICATIONS PASSED SUCCESSFULLY ---');
