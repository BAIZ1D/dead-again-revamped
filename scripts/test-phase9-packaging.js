/**
 * scripts/test-phase9-packaging.js
 * Automated Verification Test Suite for Phase 9 Packaging Requirements (PKG-01..PKG-04)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function runCheck(title, fn) {
  totalChecks++;
  console.log(`\n${colors.cyan}[Check ${totalChecks}] ${title}${colors.reset}`);
  try {
    fn();
    logPass(title);
    passedChecks++;
  } catch (err) {
    logFail(`${title}: ${err.message}`);
    throw err;
  }
}

function readPngDimensions(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Invalid PNG header signature');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

console.log(`${colors.bold}================================================================${colors.reset}`);
console.log(`${colors.bold}  Phase 9 Packaging & Asset Pipeline Verification Test Suite    ${colors.reset}`);
console.log(`${colors.bold}================================================================${colors.reset}`);

try {
  // Check 1: PKG-01 Native Application Icons
  runCheck('PKG-01 Native Icons (icon.png, icon.ico, icon.icns, dashboard-icon.png)', () => {
    // 1. icon.png
    const iconPngPath = path.join(rootDir, 'desktop/assets/icon.png');
    if (!fs.existsSync(iconPngPath)) throw new Error('Missing desktop/assets/icon.png');
    const iconPngBuf = fs.readFileSync(iconPngPath);
    if (iconPngBuf.length < 10000) throw new Error(`icon.png byte size too small: ${iconPngBuf.length}`);
    const { width: iconW, height: iconH } = readPngDimensions(iconPngBuf);
    if (iconW < 1024 || iconH < 1024) throw new Error(`icon.png dimensions too small: ${iconW}x${iconH}`);

    // 2. icon.ico
    const iconIcoPath = path.join(rootDir, 'desktop/assets/icon.ico');
    if (!fs.existsSync(iconIcoPath)) throw new Error('Missing desktop/assets/icon.ico');
    const iconIcoBuf = fs.readFileSync(iconIcoPath);
    if (iconIcoBuf.length < 50000) throw new Error(`icon.ico byte size too small for multi-res: ${iconIcoBuf.length}`);
    const icoHeader = iconIcoBuf.slice(0, 4);
    if (icoHeader[0] !== 0 || icoHeader[1] !== 0 || icoHeader[2] !== 1 || icoHeader[3] !== 0) {
      throw new Error(`Invalid ICO header: ${icoHeader.toString('hex')}`);
    }

    // 3. icon.icns
    const iconIcnsPath = path.join(rootDir, 'desktop/assets/icon.icns');
    if (!fs.existsSync(iconIcnsPath)) throw new Error('Missing desktop/assets/icon.icns');
    const iconIcnsBuf = fs.readFileSync(iconIcnsPath);
    if (iconIcnsBuf.length < 50000) throw new Error(`icon.icns byte size too small: ${iconIcnsBuf.length}`);
    const icnsMagic = iconIcnsBuf.slice(0, 4).toString('ascii');
    if (icnsMagic !== 'icns') throw new Error(`Invalid ICNS magic bytes: ${icnsMagic}`);

    // 4. dashboard-icon.png
    const dashPngPath = path.join(rootDir, 'desktop/assets/dashboard-icon.png');
    if (!fs.existsSync(dashPngPath)) throw new Error('Missing desktop/assets/dashboard-icon.png');
    const dashPngBuf = fs.readFileSync(dashPngPath);
    if (dashPngBuf.length < 1000) throw new Error(`dashboard-icon.png byte size too small: ${dashPngBuf.length}`);
    const { width: dashW, height: dashH } = readPngDimensions(dashPngBuf);
    if (dashW < 512 || dashH < 512) throw new Error(`dashboard-icon.png dimensions too small: ${dashW}x${dashH}`);
  });

  // Check 2: DMG Presentation Banner & Fix Gatekeeper Script
  runCheck('DMG Presentation Banner & Fix Gatekeeper Script Permissions', () => {
    // 1. dmg-background.png
    const dmgBgPath = path.join(rootDir, 'desktop/assets/dmg-background.png');
    if (!fs.existsSync(dmgBgPath)) throw new Error('Missing desktop/assets/dmg-background.png');
    const dmgBuf = fs.readFileSync(dmgBgPath);
    const { width: dmgW, height: dmgH } = readPngDimensions(dmgBuf);
    if (dmgW !== 540 || dmgH !== 380) throw new Error(`dmg-background.png dimensions mismatch: ${dmgW}x${dmgH} (expected 540x380)`);

    // 2. Fix Gatekeeper.command
    const gatekeeperPath = path.join(rootDir, 'desktop/assets/Fix Gatekeeper.command');
    if (!fs.existsSync(gatekeeperPath)) throw new Error('Missing desktop/assets/Fix Gatekeeper.command');
    const stat = fs.statSync(gatekeeperPath);
    const isExecutable = (stat.mode & 0o111) !== 0;
    if (!isExecutable) throw new Error('Fix Gatekeeper.command does not have execute permission (chmod +x)');
  });

  // Check 3: Web Favicons in Public & Dist
  runCheck('Web Favicons in relay-server/public and main/dist', () => {
    const requiredFavicons = [
      'relay-server/public/favicon.ico',
      'relay-server/public/favicon.png',
      'main/dist/favicon.ico',
      'main/dist/favicon.png'
    ];
    for (const rel of requiredFavicons) {
      const fullPath = path.join(rootDir, rel);
      if (!fs.existsSync(fullPath)) throw new Error(`Missing favicon: ${rel}`);
      const buf = fs.readFileSync(fullPath);
      if (buf.length === 0) throw new Error(`Empty favicon file: ${rel}`);
    }
  });

  // Check 4: PKG-02 ASAR Packaging & Selective Unpack Rules
  runCheck('PKG-02 ASAR Packaging & Selective asarUnpack Rules', () => {
    const ymlPath = path.join(rootDir, 'electron-builder.yml');
    if (!fs.existsSync(ymlPath)) throw new Error('Missing electron-builder.yml');
    const ymlContent = fs.readFileSync(ymlPath, 'utf8');

    if (!ymlContent.includes('asar: true')) {
      throw new Error('electron-builder.yml missing "asar: true"');
    }
    if (!ymlContent.includes('relay-server/public/**/*') || !ymlContent.includes('main/dist/**/*')) {
      throw new Error('electron-builder.yml missing asarUnpack rules for relay-server/public and main/dist');
    }
    if (!ymlContent.includes('output: release')) {
      throw new Error('electron-builder.yml directories.output is not "release"');
    }
  });

  // Check 5: PKG-03 macOS Universal Architecture & Zero-Cost Unsigned Rules
  runCheck('PKG-03 macOS Universal Targets & Zero-Cost Unsigned Configuration', () => {
    const ymlContent = fs.readFileSync(path.join(rootDir, 'electron-builder.yml'), 'utf8');
    if (!ymlContent.includes('target: dmg') || !ymlContent.includes('target: zip')) {
      throw new Error('mac targets missing dmg or zip specification');
    }
    if (!ymlContent.includes('universal')) {
      throw new Error('mac targets missing "universal" architecture');
    }
    if (!ymlContent.includes('identity: null')) {
      throw new Error('mac target missing "identity: null" for unsigned ad-hoc builds');
    }
    if (!ymlContent.includes('hardenedRuntime: false')) {
      throw new Error('mac target missing "hardenedRuntime: false"');
    }
  });

  // Check 6: PKG-04 Windows NSIS & Portable Targets
  runCheck('PKG-04 Windows NSIS & Portable Targets (per-user AppData)', () => {
    const ymlContent = fs.readFileSync(path.join(rootDir, 'electron-builder.yml'), 'utf8');
    if (!ymlContent.includes('target: nsis') || !ymlContent.includes('target: portable')) {
      throw new Error('win targets missing nsis or portable specification');
    }
    if (!ymlContent.includes('perMachine: false')) {
      throw new Error('nsis missing "perMachine: false" (required for zero-admin AppData installs)');
    }
    if (!ymlContent.includes('shortcutName: Dead Again - Revamped')) {
      throw new Error('nsis missing shortcutName "Dead Again - Revamped"');
    }
  });

  // Check 7: Licensing & Attribution (Baizid Al Hamid + Frank Force MIT Notice)
  runCheck('Licensing & MIT Attribution (Baizid Al Hamid & Frank Force Notice)', () => {
    const licensePath = path.join(rootDir, 'LICENSE-THIRD-PARTY.txt');
    if (!fs.existsSync(licensePath)) throw new Error('Missing LICENSE-THIRD-PARTY.txt');
    const licenseContent = fs.readFileSync(licensePath, 'utf8');
    if (!licenseContent.includes('Baizid Al Hamid')) {
      throw new Error('LICENSE-THIRD-PARTY.txt missing Baizid Al Hamid author attribution');
    }
    if (!licenseContent.includes('Frank Force') || !licenseContent.includes('MIT License')) {
      throw new Error('LICENSE-THIRD-PARTY.txt missing Frank Force MIT License third-party notice');
    }

    const menuPath = path.join(rootDir, 'desktop/menu.js');
    const menuContent = fs.readFileSync(menuPath, 'utf8');
    if (!menuContent.includes('Baizid Al Hamid')) {
      throw new Error('desktop/menu.js missing Baizid Al Hamid attribution in About dialog');
    }
  });

  // Check 8: Window Icon Bindings (Survivor vs Zombie for Game, APG Radar for Dashboard)
  runCheck('Window Icon Bindings (Game Window vs Streamer Dashboard Window)', () => {
    const winMgrPath = path.join(rootDir, 'desktop/windowManager.js');
    const winMgrContent = fs.readFileSync(winMgrPath, 'utf8');
    if (!winMgrContent.includes("icon: path.join(__dirname, 'assets', 'icon.png')")) {
      throw new Error('desktop/windowManager.js missing icon.png binding in createGameWindow()');
    }
    if (!winMgrContent.includes("icon: path.join(__dirname, 'assets', 'dashboard-icon.png')")) {
      throw new Error('desktop/windowManager.js missing dashboard-icon.png binding in createDashboardWindow()');
    }
  });

  console.log(`\n${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bold}  ALL ${passedChecks}/${totalChecks} PACKAGING VERIFICATION CHECKS PASSED SUCCESSFULLY  ${colors.reset}`);
  console.log(`${colors.bold}================================================================${colors.reset}\n`);
  process.exit(0);

} catch (err) {
  console.error(`\n${colors.red}${colors.bold}PACKAGING VERIFICATION FAILED: ${err.message}${colors.reset}\n`);
  process.exit(1);
}
