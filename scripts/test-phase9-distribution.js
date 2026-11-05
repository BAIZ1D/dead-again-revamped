/**
 * scripts/test-phase9-distribution.js
 * Automated Verification Test Suite for Phase 9 Distribution, Updater, Workflow, and Streamer Guide (PKG-05, PKG-06, PKG-07)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compareSemver, checkLatestRelease } from '../desktop/updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper for colored console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m'
};

function logPass(message) {
  console.log(`  ${colors.green}✓ PASS:${colors.reset} ${message}`);
}

function logFail(message) {
  console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${message}`);
}

let passedChecks = 0;
let totalChecks = 0;

async function runCheck(title, fn) {
  totalChecks++;
  console.log(`\n${colors.cyan}[Check ${totalChecks}] ${title}${colors.reset}`);
  try {
    await fn();
    logPass(title);
    passedChecks++;
  } catch (err) {
    logFail(`${title}: ${err.message}`);
    throw err;
  }
}

console.log(`${colors.bold}================================================================${colors.reset}`);
console.log(`${colors.bold}  Phase 9 Distribution & Update Pipeline Verification Suite    ${colors.reset}`);
console.log(`${colors.bold}================================================================${colors.reset}`);

async function main() {
  // Check 1: PKG-07 Semantic Versioning Logic
  await runCheck('PKG-07: Semantic Versioning Comparison (compareSemver)', () => {
    if (compareSemver('1.2.0', '1.0.0') !== 1) {
      throw new Error("Expected compareSemver('1.2.0', '1.0.0') === 1");
    }
    if (compareSemver('1.0.0', '1.0.0') !== 0) {
      throw new Error("Expected compareSemver('1.0.0', '1.0.0') === 0");
    }
    if (compareSemver('1.0.0', '1.2.0') !== -1) {
      throw new Error("Expected compareSemver('1.0.0', '1.2.0') === -1");
    }
    if (compareSemver('v2.0.1', '1.9.9') !== 1) {
      throw new Error("Expected compareSemver('v2.0.1', '1.9.9') === 1 (leading 'v' stripped)");
    }
    if (compareSemver('1.0.1-beta', '1.0.0') !== 1) {
      throw new Error("Expected compareSemver('1.0.1-beta', '1.0.0') === 1 (prerelease parsed)");
    }
  });

  // Check 2: PKG-07 Updater Timeout Resilience & Silent Catch
  await runCheck('PKG-07: Updater Network Cutoff Resilience & Silent Handling', async () => {
    const startTime = Date.now();
    // Test with unreachable non-routable IP to test timeout or network error handling
    const result = await checkLatestRelease('http://10.255.255.1/timeout-test', '1.0.0');
    const elapsed = Date.now() - startTime;

    if (result.updateAvailable !== false) {
      throw new Error('Expected updateAvailable to be false on network error');
    }
    if (elapsed > 3500) {
      throw new Error(`Expected network timeout within 3500ms, elapsed: ${elapsed}ms`);
    }
  });

  // Check 3: Preload Bridge IPC Exposure
  await runCheck('PKG-07: Desktop Preload Bridge Exposure (preload.cjs)', () => {
    const preloadPath = path.join(rootDir, 'desktop', 'preload.cjs');
    if (!fs.existsSync(preloadPath)) {
      throw new Error('desktop/preload.cjs does not exist');
    }
    const content = fs.readFileSync(preloadPath, 'utf8');

    if (!content.includes('checkForUpdates')) {
      throw new Error('preload.cjs missing checkForUpdates method');
    }
    if (!content.includes('onUpdateAvailable')) {
      throw new Error('preload.cjs missing onUpdateAvailable listener');
    }
    if (!content.includes('openExternalUrl')) {
      throw new Error('preload.cjs missing openExternalUrl method');
    }
    if (!content.includes('desktop:check-updates') || !content.includes('desktop:update-available')) {
      throw new Error('preload.cjs missing expected IPC channels');
    }
  });

  // Check 4: Application Menu Integration
  await runCheck('PKG-05 / PKG-07: Desktop Application Menu Integration (menu.js)', () => {
    const menuPath = path.join(rootDir, 'desktop', 'menu.js');
    if (!fs.existsSync(menuPath)) {
      throw new Error('desktop/menu.js does not exist');
    }
    const content = fs.readFileSync(menuPath, 'utf8');

    if (!content.includes('Check for Updates...')) {
      throw new Error('menu.js missing "Check for Updates..." item');
    }
    if (!content.includes('Ko-fi')) {
      throw new Error('menu.js missing "Ko-fi" monetization link');
    }
    if (!content.includes('Itch.io')) {
      throw new Error('menu.js missing "Itch.io" link');
    }
    if (!content.includes('Baizid Al Hamid')) {
      throw new Error('menu.js missing Baizid Al Hamid developer credit');
    }
    if (!content.includes('Third-Party Licenses')) {
      throw new Error('menu.js missing Third-Party Licenses reference');
    }
  });

  // Check 5: Streamer Dashboard UI Elements & Session Dismissal
  await runCheck('PKG-07: Streamer Dashboard Update UI & Session Dismissal', () => {
    const htmlPath = path.join(rootDir, 'relay-server', 'public', 'index.html');
    const jsPath = path.join(rootDir, 'relay-server', 'public', 'js', 'dashboard.js');
    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) {
      throw new Error('Dashboard files missing');
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const js = fs.readFileSync(jsPath, 'utf8');

    const requiredIds = [
      'update-notification-pill',
      'update-modal',
      'btn-download-github',
      'btn-view-itch',
      'btn-support-kofi'
    ];
    for (const id of requiredIds) {
      if (!html.includes(`id="${id}"`)) {
        throw new Error(`index.html missing element with id="${id}"`);
      }
    }

    if (!js.includes('sessionStorage') || !js.includes('apg_update_dismissed')) {
      throw new Error('dashboard.js missing sessionStorage dismissal handling');
    }
  });

  // Check 6: PKG-06 GitHub Actions Workflow
  await runCheck('PKG-06: GitHub Actions Release CI/CD Workflow (build-release.yml)', () => {
    const workflowPath = path.join(rootDir, '.github', 'workflows', 'build-release.yml');
    if (!fs.existsSync(workflowPath)) {
      throw new Error('.github/workflows/build-release.yml does not exist');
    }
    const yaml = fs.readFileSync(workflowPath, 'utf8');

    if (!yaml.includes("v*.*.*")) {
      throw new Error('Workflow missing tag trigger for v*.*.*');
    }
    if (!yaml.includes('workflow_dispatch')) {
      throw new Error('Workflow missing workflow_dispatch trigger');
    }
    if (!yaml.includes('macos-latest') || !yaml.includes('windows-latest')) {
      throw new Error('Workflow matrix missing macos-latest or windows-latest runners');
    }
    if (!yaml.includes('actions/upload-artifact@v4')) {
      throw new Error('Workflow missing upload-artifact action');
    }
    if (!yaml.includes('draft: true')) {
      throw new Error('Workflow missing draft: true in release configuration');
    }
    if (!yaml.includes('.dmg') || !yaml.includes('.exe') || !yaml.includes('.zip')) {
      throw new Error('Workflow release configuration missing .dmg, .exe, or .zip artifact patterns');
    }
  });

  // Check 7: PKG-05 Streamer Quick-Start Guide Completeness
  await runCheck('PKG-05: Streamer Quick-Start Guide (STREAMER_GUIDE.md)', () => {
    const guidePath = path.join(rootDir, 'STREAMER_GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      throw new Error('STREAMER_GUIDE.md does not exist');
    }
    const guide = fs.readFileSync(guidePath, 'utf8');

    if (!guide.includes('Fix Gatekeeper.command')) {
      throw new Error('STREAMER_GUIDE.md missing Fix Gatekeeper.command helper reference');
    }
    if (!guide.includes('xattr -cr')) {
      throw new Error('STREAMER_GUIDE.md missing terminal xattr -cr fallback command');
    }
    if (!guide.includes('SmartScreen') || !guide.includes('Run anyway')) {
      throw new Error('STREAMER_GUIDE.md missing Windows SmartScreen bypass instructions');
    }
    if (!guide.includes('Window Capture') || !guide.includes('WGC')) {
      throw new Error('STREAMER_GUIDE.md missing OBS Window Capture and WGC instructions');
    }
    if (!guide.includes('[STREAMER ONLY]') || !guide.includes('privacy')) {
      throw new Error('STREAMER_GUIDE.md missing dashboard stream privacy warning');
    }
  });

  console.log(`\n${colors.bold}================================================================${colors.reset}`);
  console.log(`  ${colors.green}${colors.bold}ALL CHECKS PASSED (${passedChecks}/${totalChecks})${colors.reset}`);
  console.log(`${colors.bold}================================================================\n${colors.reset}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n${colors.red}${colors.bold}Verification suite failed: ${err.message}${colors.reset}\n`);
  process.exit(1);
});
