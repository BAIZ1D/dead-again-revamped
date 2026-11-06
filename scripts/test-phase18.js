import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== STARTING PHASE 18 RELEASE v1.2.0 META-VERIFICATION TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Manifest & Config Version Contracts (D-01, D-05)
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC MANIFEST & VERSION CONTRACT VERIFICATION ---');

// 1. Root package.json
console.log('[Check 1] Root package.json version 1.2.0 contract...');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert.strictEqual(pkg.version, '1.2.0', 'package.json version must be 1.2.0');
assert.ok(pkg.scripts && pkg.scripts['test:phase18'], 'package.json must register test:phase18 script');
console.log('  Passed: package.json version is 1.2.0 with test:phase18 registered.');

// 2. Root package-lock.json
console.log('[Check 2] Root package-lock.json version 1.2.0 contract...');
const lockPath = path.join(rootDir, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
assert.strictEqual(lock.version, '1.2.0', 'package-lock.json root version must be 1.2.0');
assert.strictEqual(lock.packages[''].version, '1.2.0', 'package-lock.json packages[""].version must be 1.2.0');
console.log('  Passed: package-lock.json root and packages versions are 1.2.0.');

// 3. relay-server/package.json
console.log('[Check 3] relay-server/package.json version 1.2.0 contract...');
const relayPkgPath = path.join(rootDir, 'relay-server', 'package.json');
const relayPkg = JSON.parse(fs.readFileSync(relayPkgPath, 'utf8'));
assert.strictEqual(relayPkg.version, '1.2.0', 'relay-server/package.json version must be 1.2.0');
console.log('  Passed: relay-server/package.json version is 1.2.0.');

// 4. desktop/updater.js
console.log('[Check 4] desktop/updater.js version 1.2.0 fallbacks...');
const updaterPath = path.join(rootDir, 'desktop', 'updater.js');
const updaterSrc = fs.readFileSync(updaterPath, 'utf8');
assert.ok(updaterSrc.includes("return pkg.version || '1.2.0';"), 'updater.js line 24 must fallback to 1.2.0');
assert.ok(updaterSrc.includes("return '1.2.0';"), 'updater.js line 26 catch block must return 1.2.0');
assert.ok(updaterSrc.includes("currentVersion = '1.2.0'"), 'updater.js line 69 checkLatestRelease default must be 1.2.0');
console.log('  Passed: desktop/updater.js fallbacks and defaults are 1.2.0.');

// 5. desktop/menu.js
console.log('[Check 5] desktop/menu.js version 1.2.0 menu fallbacks...');
const menuPath = path.join(rootDir, 'desktop', 'menu.js');
const menuSrc = fs.readFileSync(menuPath, 'utf8');
assert.ok(menuSrc.includes("applicationVersion: app.getVersion ? app.getVersion() : '1.2.0'"), 'menu.js line 16 must fallback to 1.2.0');
assert.ok(menuSrc.includes("'You are running the latest version (' + (app.getVersion ? app.getVersion() : '1.2.0') + ').'"), 'menu.js line 58 must fallback to 1.2.0');
assert.ok(menuSrc.includes("'Dead Again - Revamped (Twitch Edition) v' + (app.getVersion ? app.getVersion() : '1.2.0')"), 'menu.js line 141 must fallback to 1.2.0');
console.log('  Passed: desktop/menu.js menu and dialog fallbacks are 1.2.0.');

// 6. README.md release badge & version references
console.log('[Check 6] README.md Release-v1.2.0 badge and documentation sync...');
const readmePath = path.join(rootDir, 'README.md');
const readmeSrc = fs.readFileSync(readmePath, 'utf8');
assert.ok(readmeSrc.includes('Release-v1.2.0-9146FF'), 'README.md badge must reference Release-v1.2.0');
assert.ok(readmeSrc.includes('alt="Version 1.2.0"'), 'README.md badge alt must be Version 1.2.0');
assert.ok(readmeSrc.includes('Machine Pistol (SMG)'), 'README.md must detail Machine Pistol (SMG)');
assert.ok(readmeSrc.includes('2x10'), 'README.md must detail SMG 2x10 micro-pip grid');
assert.ok(readmeSrc.includes('pos.y - 1.35 * scaleUI'), 'README.md must detail health pips beneath avatar coordinate');
console.log('  Passed: README.md badge and technical specifications verified.');

console.log('\n✓ ALL STATIC MANIFEST & VERSION CONTRACTS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE B: Production Build Integrity & ES6 Module Leakage Audit
// -------------------------------------------------------------
console.log('--- SUITE B: PRODUCTION BUILD INTEGRITY & ES6 MODULE LEAKAGE AUDIT ---');

console.log('[Check 7] Compiling production bundle via scripts/build-game.js...');
const buildOut = execSync('node scripts/build-game.js', { cwd: rootDir, encoding: 'utf8' });
console.log(buildOut.trim());
assert.ok(buildOut.includes('Compiled 30 files into dist/js/index.js'), 'build-game.js must compile exactly 30 source files');

const distIndexPath = path.join(rootDir, 'main', 'dist', 'js', 'index.js');
assert.ok(fs.existsSync(distIndexPath), 'dist/js/index.js must exist');
const distStats = fs.statSync(distIndexPath);
assert.ok(distStats.size > 100000, `dist/js/index.js must be larger than 100KB (actual: ${distStats.size} bytes)`);
console.log(`  Passed: dist/js/index.js verified (${(distStats.size / 1024).toFixed(1)} KB).`);

console.log('[Check 8] Auditing game engine source files for zero ES6 syntax leakage...');
const gameJsDir = path.join(rootDir, 'main', 'src', 'js');
const gameFiles = fs.readdirSync(gameJsDir).filter(f => f.endsWith('.js') && !f.includes('_GEN.js'));
let importExportFound = 0;
for (const gf of gameFiles) {
    const code = fs.readFileSync(path.join(gameJsDir, gf), 'utf8');
    const lines = code.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const l = lines[idx].trim();
        if (/^(export\s+|import\s+)/.test(l) && !l.startsWith('//') && !l.startsWith('/*')) {
            console.error(`  Violation in ${gf} line ${idx + 1}: ${l}`);
            importExportFound++;
        }
    }
}
assert.strictEqual(importExportFound, 0, 'Zero ES6 import/export statements allowed in main/src/js/*.js');
console.log(`  Passed: Audited ${gameFiles.length} game engine source files: zero ES6 module syntax leakage detected.`);

console.log('\n✓ BUILD INTEGRITY & ES6 AUDIT PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE C: Sequential Execution of All 7 Regression Test Suites
// -------------------------------------------------------------
console.log('--- SUITE C: COMPREHENSIVE REPOSITORY REGRESSION TEST MATRIX ---');

const testSuites = [
    { name: 'Phase 17 (Start Screen Visual Overhaul & Field Manual)', cmd: 'npm run test:phase17' },
    { name: 'Phase 16 (HUD Ergonomics & Anti-Clipping)', cmd: 'npm run test:phase16' },
    { name: 'Phase 15 (Combat Primitives & Typography Signature)', cmd: 'npm run test:phase15' },
    { name: 'Phase 13 (Combat Vulnerability & Pacing Escalation)', cmd: 'npm run test:phase13' },
    { name: 'Phase 12 (Ammo Scarcity & Drop Economy)', cmd: 'npm run test:phase12' },
    { name: 'Phase 9 Packaging (Desktop Assets, DMG, AppData)', cmd: 'npm run test:packaging' },
    { name: 'Phase 9 Distribution (Semver Comparison, Updater & Preload)', cmd: 'npm run test:distribution' }
];

const suiteStartTime = Date.now();
for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    console.log(`\n[Suite ${i + 1}/${testSuites.length}] Running ${suite.name} (${suite.cmd})...`);
    try {
        const stdout = execSync(suite.cmd, { cwd: rootDir, encoding: 'utf8', stdio: 'pipe' });
        const lastLines = stdout.trim().split('\n').slice(-3).join('\n  ');
        console.log(`  Output summary:\n  ${lastLines}`);
        console.log(`  ✓ Passed: ${suite.name}`);
    } catch (err) {
        console.error(`  ✕ FAILED: ${suite.name}`);
        if (err.stdout) console.error(`  stdout:\n${err.stdout}`);
        if (err.stderr) console.error(`  stderr:\n${err.stderr}`);
        process.exit(1);
    }
}

const totalElapsedSec = ((Date.now() - suiteStartTime) / 1000).toFixed(2);
console.log(`\n=============================================================`);
console.log(`✓ ALL 7 REGRESSION TEST SUITES PASSED IN ${totalElapsedSec}s (100% GREEN)`);
console.log(`✓ RELEASE v1.2.0 PACKAGING & VERIFICATION COMPLETE`);
console.log(`=============================================================\n`);
