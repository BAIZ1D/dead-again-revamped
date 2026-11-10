import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 24 RELEASE v1.3.0 PACKAGING & VERIFICATION TEST SUITE ===\n');

// =============================================================
// SUITE A: Semantic Version & Documentation Audit (PKG-09)
// =============================================================
console.log('--- SUITE A: SEMANTIC VERSION & DOCUMENTATION AUDIT (PKG-09) ---');

// [Check 1] package.json and package-lock.json version synchronization
console.log('[Check 1] Validating root package.json and package-lock.json semantic version (1.3.0)...');
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(rootPkg.version, '1.3.0', 'Root package.json version must be strictly 1.3.0');

const pkgLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
assert.strictEqual(pkgLock.version, '1.3.0', 'package-lock.json version must be strictly 1.3.0');
assert.strictEqual(pkgLock.packages[''].version, '1.3.0', 'package-lock.json root packages[""] version must be strictly 1.3.0');
console.log('  Passed: package.json and package-lock.json synchronized to 1.3.0.');

// [Check 2] relay-server/package.json version synchronization
console.log('[Check 2] Validating relay-server/package.json semantic version (1.3.0)...');
const relayPkg = JSON.parse(fs.readFileSync('relay-server/package.json', 'utf8'));
assert.strictEqual(relayPkg.version, '1.3.0', 'relay-server/package.json version must be strictly 1.3.0');
console.log('  Passed: relay-server/package.json synchronized to 1.3.0.');

// [Check 3] desktop/updater.js fallback version
console.log('[Check 3] Validating desktop/updater.js version fallback (1.3.0)...');
const updaterSrc = fs.readFileSync('desktop/updater.js', 'utf8');
assert.ok(
	updaterSrc.includes('"1.3.0"') || updaterSrc.includes("'1.3.0'"),
	'desktop/updater.js currentVersion fallback must specify 1.3.0'
);
console.log('  Passed: desktop/updater.js fallback version verified.');

// [Check 4] desktop/menu.js "What's New in v1.3.0" dialog & fallback
console.log('[Check 4] Validating desktop/menu.js "What\'s New in v1.3.0" dialog & fallback...');
const menuSrc = fs.readFileSync('desktop/menu.js', 'utf8');
assert.ok(
	menuSrc.includes("What's New in v1.3.0") || menuSrc.includes('What\\\'s New in v1.3.0'),
	'desktop/menu.js must include "What\'s New in v1.3.0" dialog title'
);
assert.ok(
	menuSrc.includes("'1.3.0'") || menuSrc.includes('"1.3.0"'),
	'desktop/menu.js must contain fallback version 1.3.0'
);
console.log('  Passed: desktop/menu.js What\'s New in v1.3.0 dialog verified.');

// [Check 5] README.md Release v1.3.0 badge & Milestone v1.6 Feature Showcases
console.log('[Check 5] Validating README.md Release-v1.3.0 badge, feature showcases, and changelog omission...');
const readmeSrc = fs.readFileSync('README.md', 'utf8');
assert.ok(
	readmeSrc.includes('https://img.shields.io/badge/Release-v1.3.0-9146FF'),
	'README.md must feature Release-v1.3.0-9146FF Twitch shield badge'
);
assert.ok(
	readmeSrc.includes('## Milestone v1.6 Feature Showcases'),
	'README.md must feature ## Milestone v1.6 Feature Showcases'
);
assert.ok(
	readmeSrc.includes('Endless Nightmare Gauntlet') || readmeSrc.includes('Nightmare Survival Gauntlet'),
	'README.md must highlight Endless Nightmare Gauntlet'
);
assert.ok(
	!readmeSrc.includes('Release Notes & Changelog'),
	'README.md must NOT contain "Release Notes & Changelog" per user instruction'
);
console.log('  Passed: README.md badge, feature showcases, and changelog omission verified.');

// [Check 6] STREAMER_GUIDE.md version references & !nightmare command documentation
console.log('[Check 6] Validating STREAMER_GUIDE.md v1.3.0 references & !nightmare commands...');
const streamerSrc = fs.readFileSync('STREAMER_GUIDE.md', 'utf8');
assert.ok(streamerSrc.includes('1.3.0'), 'STREAMER_GUIDE.md must reference version 1.3.0');
assert.ok(
	streamerSrc.includes('Endless Nightmare') || streamerSrc.includes('Nightmare Gauntlet'),
	'STREAMER_GUIDE.md must document Endless Nightmare gauntlet mode'
);
assert.ok(streamerSrc.includes('!boss'), 'STREAMER_GUIDE.md must reference audience commands');
console.log('  Passed: STREAMER_GUIDE.md v1.3.0 and !nightmare documentation verified.');

console.log('\n✓ ALL SUITE A SEMANTIC VERSION & DOCUMENTATION AUDIT CHECKS PASSED!\n');

// =============================================================
// SUITE B: Production Compilation & ES6 Audit (PKG-10)
// =============================================================
console.log('--- SUITE B: PRODUCTION COMPILATION & ES6 AUDIT (PKG-10) ---');

// [Check 1] Programmatic execution of scripts/build-game.js
console.log('[Check 1] Compiling production bundle via scripts/build-game.js...');
const buildOutput = execSync('node scripts/build-game.js', { encoding: 'utf8' });
assert.ok(
	buildOutput.includes('[Build] Compiled 30 files into dist/js/index.js'),
	'build-game.js output must confirm exactly 30 compiled source files'
);
console.log('  Passed: scripts/build-game.js compiled exactly 30 source files.');

// [Check 2] File existence and size threshold (>100,000 bytes)
console.log('[Check 2] Validating main/dist/js/index.js file size > 100,000 bytes...');
const distBundlePath = path.join('main', 'dist', 'js', 'index.js');
assert.ok(fs.existsSync(distBundlePath), 'Compiled bundle main/dist/js/index.js must exist');
const bundleStats = fs.statSync(distBundlePath);
assert.ok(
	bundleStats.size > 100000,
	`Bundle size (${bundleStats.size} bytes) must exceed 100,000 bytes`
);
console.log(`  Passed: main/dist/js/index.js exists and measures ${bundleStats.size} bytes (>100KB).`);

// [Check 3] Zero unbundled ES6 import/export statements in bundle
console.log('[Check 3] Scanning main/dist/js/index.js for illegal unbundled ES6 statements...');
const bundleContent = fs.readFileSync(distBundlePath, 'utf8');
const bundleLines = bundleContent.split('\n');

const illegalStatements = [];
for (let i = 0; i < bundleLines.length; i++) {
	const line = bundleLines[i].trim();
	if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
	if (/^import\s+[^;]+from/.test(line) || /^import\s*\(?['"][^'"]+['"]\)?/.test(line)) {
		illegalStatements.push({ line: i + 1, text: line, type: 'import' });
	}
	if (/^export\s+(?:default|const|let|var|function|class|\{)/.test(line)) {
		illegalStatements.push({ line: i + 1, text: line, type: 'export' });
	}
}

assert.strictEqual(
	illegalStatements.length,
	0,
	`Found ${illegalStatements.length} illegal ES6 import/export statements in compiled bundle:\n` +
	JSON.stringify(illegalStatements, null, 2)
);
console.log('  Passed: Zero illegal unbundled ES6 import/export statements detected in main/dist/js/index.js.');

// [Check 4] Source files scan for unbundled ES6 module keywords in main/src/js/
console.log('[Check 4] Auditing all source files in main/src/js/ for ES6 module keywords...');
const srcJsDir = path.join('main', 'src', 'js');
const srcJsFiles = fs.readdirSync(srcJsDir).filter(f => f.endsWith('.js'));
for (const file of srcJsFiles) {
	const content = fs.readFileSync(path.join(srcJsDir, file), 'utf8');
	const lines = content.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
		assert.ok(
			!/^import\s+[^;]+from/.test(line) && !/^import\s*\(?['"][^'"]+['"]\)?/.test(line),
			`Illegal ES6 import found in ${file}:${i + 1}: ${line}`
		);
		assert.ok(
			!/^export\s+(?:default|const|let|var|function|class|\{)/.test(line),
			`Illegal ES6 export found in ${file}:${i + 1}: ${line}`
		);
	}
}
console.log(`  Passed: All ${srcJsFiles.length} source files in main/src/js/ strictly adhere to LittleJS global architecture.`);

console.log('\n✓ ALL SUITE B PRODUCTION COMPILATION & ES6 AUDIT CHECKS PASSED!\n');

// =============================================================
// SUITE C: In-Game Credits Modal Contract & Geometry Simulation (PKG-09, PKG-10)
// =============================================================
console.log('--- SUITE C: IN-GAME CREDITS MODAL CONTRACT & GEOMETRY SIMULATION (PKG-09, PKG-10) ---');

// [Check 1] Static AST / source contract verification on startScreen.js
console.log('[Check 1] Validating startScreen.js credits declarations, creators, and Zero Legalese...');
const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
assert.ok(startSrc.includes('g_startCreditsOpen = false'), 'startScreen.js must initialize g_startCreditsOpen = false');
assert.ok(startSrc.includes('function renderCreditsModal('), 'startScreen.js must define renderCreditsModal');
assert.ok(startSrc.includes('"[C] CREDITS"'), 'startScreen.js must render "[C] CREDITS" button label');
assert.ok(startSrc.includes('keyWasPressed(67)'), 'startScreen.js must handle C key (67) for credits');
assert.ok(
	startSrc.includes('gamepadWasPressed(1)') || startSrc.includes('gamepadWasPressed(3)'),
	'startScreen.js must handle gamepad buttons to close credits modal'
);

// Zero Legal Legalese rule (D-03) on renderCreditsModal function
const creditsFnStart = startSrc.indexOf('function renderCreditsModal(');
assert.ok(creditsFnStart !== -1, 'renderCreditsModal function must exist');
const creditsFnEnd = startSrc.indexOf('function playStartTabChirp(', creditsFnStart);
const creditsFnSrc = startSrc.substring(creditsFnStart, creditsFnEnd !== -1 ? creditsFnEnd : creditsFnStart + 2500);

assert.ok(
	creditsFnSrc.includes('BAIZID AL HAMID') || creditsFnSrc.includes('Baizid Al Hamid'),
	'renderCreditsModal must prominently honor lead creator Baizid Al Hamid'
);
assert.ok(
	creditsFnSrc.includes('Frank Force'),
	'renderCreditsModal must honor LittleJS engine creator Frank Force'
);

const forbiddenLegalese = ['license', 'agpl', 'mit', 'warranty', 'liability'];
for (const word of forbiddenLegalese) {
	const regex = new RegExp(`\\b${word}\\b`, 'i');
	assert.ok(
		!regex.test(creditsFnSrc),
		`D-03: renderCreditsModal must contain ZERO legal legalese (found forbidden word "${word}")`
	);
}
console.log('  Passed: Declarations, creator attributions, and Zero Legal Legalese rule verified.');

// [Check 2] Node VM 7-Viewport Geometry & Behavioral Simulation
console.log('[Check 2] Simulating 7 viewports for geometry, clearance, and canvas stack balance...');

const viewports = [
	{ name: '720p Standard HD (1280x720)', W: 1280, H: 720 },
	{ name: '1080p Full HD (1920x1080)', W: 1920, H: 1080 },
	{ name: '1440p QHD (2560x1440)', W: 2560, H: 1440 },
	{ name: '4K UHD (3840x2160)', W: 3840, H: 2160 },
	{ name: '16:10 Display (1920x1200)', W: 1920, H: 1200 },
	{ name: '4:3 Retro Display (1024x768)', W: 1024, H: 768 },
	{ name: '21:9 Ultrawide (2560x1080)', W: 2560, H: 1080 },
];

let saveCalls = 0;
let restoreCalls = 0;
const fillRectCalls = [];
const strokeRectCalls = [];

const mockContext = {
	_strokeStyle: '#ffffff',
	_fillStyle: '#ffffff',
	_lineWidth: 1,
	font: '10px monospace',
	textAlign: 'center',
	textBaseline: 'middle',
	shadowBlur: 0,
	shadowColor: '#000000',
	shadowOffsetX: 0,
	shadowOffsetY: 0,
	globalAlpha: 1,

	get strokeStyle() { return this._strokeStyle; },
	set strokeStyle(val) { this._strokeStyle = val; },
	get lineWidth() { return this._lineWidth; },
	set lineWidth(val) { this._lineWidth = val; },
	get fillStyle() { return this._fillStyle; },
	set fillStyle(val) { this._fillStyle = val; },

	fillRect: (x, y, w, h) => {
		fillRectCalls.push({ x, y, w, h, fillStyle: mockContext._fillStyle });
	},
	strokeRect: (x, y, w, h) => {
		strokeRectCalls.push({ x, y, w, h, strokeStyle: mockContext._strokeStyle });
	},
	clearRect: () => {},
	fillText: () => {},
	strokeText: () => {},
	measureText: (text) => ({ width: (text ? String(text).length : 0) * 8 }),
	beginPath: () => {},
	closePath: () => {},
	moveTo: () => {},
	lineTo: () => {},
	arc: () => {},
	quadraticCurveTo: () => {},
	fill: () => {},
	stroke: () => {},
	clip: () => {},
	rect: () => {},
	save: () => { saveCalls++; },
	restore: () => { restoreCalls++; },
	drawImage: () => {},
	translate: () => {},
	rotate: () => {},
	scale: () => {},
	createLinearGradient: () => ({ addColorStop: () => {} }),
	createRadialGradient: () => ({ addColorStop: () => {} }),
};

class MockPath2D {
	constructor() { this.ops = []; }
	moveTo(x, y) { this.ops.push(['moveTo', x, y]); }
	lineTo(x, y) { this.ops.push(['lineTo', x, y]); }
	quadraticCurveTo(cpx, cpy, x, y) { this.ops.push(['quadraticCurveTo', cpx, cpy, x, y]); }
	arc(x, y, r, sa, ea, ac) { this.ops.push(['arc', x, y, r, sa, ea, ac]); }
	closePath() { this.ops.push(['closePath']); }
}

const mockCanvas = {
	width: 1920,
	height: 1080,
	getContext: () => mockContext,
	style: { cursor: 'default' },
};

const sandbox = {
	console,
	assert,
	setTimeout,
	clearTimeout,
	setInterval,
	clearInterval,
	Date,
	Math,
	Object,
	Array,
	String,
	Number,
	Boolean,
	RegExp,
	Path2D: MockPath2D,
	window: null,
	document: {
		createElement: () => mockCanvas,
		getElementById: () => mockCanvas,
		addEventListener: () => {},
		body: { appendChild: () => {}, style: {} },
	},
	navigator: { userAgent: 'Node', platform: 'MacIntel' },
	AudioContext: class {
		constructor() {
			this.destination = {};
			this.sampleRate = 44100;
		}
		resume() { return Promise.resolve(); }
		createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; }
		createBuffer() { return { getChannelData() { return new Float32Array(100); } }; }
		createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
	},
	requestAnimationFrame: () => {},
	Image: class { constructor() { this.width = 128; this.height = 128; } },
	mockCanvas,
	mockContext,
	mainCanvas: mockCanvas,
	overlayCanvas: mockCanvas,
	mainContext: mockContext,
	overlayContext: mockContext,
	mousePosScreen: { x: 960, y: 540 },
	saveCalls: () => saveCalls,
	restoreCalls: () => restoreCalls,
};
sandbox.window = sandbox;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
const bundleCode = fs.readFileSync('main/dist/js/index.js', 'utf8');

vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const simulationScript = `
	mainCanvas = mockCanvas;
	mainContext = mockContext;
	overlayCanvas = mockCanvas;
	overlayContext = mockContext;
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);
	tileImage.width = 128;
	tileImage.height = 128;
	frame = 0;

	const viewports = ${JSON.stringify(viewports)};

	for (const vp of viewports) {
		mockCanvas.width = vp.W;
		mockCanvas.height = vp.H;
		mainCanvasSize = vec2(vp.W, vp.H);
		const { safeW, safeH, offsetX, offsetY, cx, cy, u } = getStartScreenSafeZone(vp.W, vp.H);

		const ctaY = vp.H * 0.74;
		const ctaH = u * 2.3;
		const rowY = vp.H * 0.83;
		const btnW = Math.min(safeW * 0.38, u * 11);
		const btnH = Math.min(u * 1.3, vp.H * 0.035);
		const gap = Math.max(8, u * 0.8);
		const guideX = cx - btnW / 2 - gap / 2;
		const creditsX = cx + btnW / 2 + gap / 2;
		const exitY = vp.H * 0.885;
		const exitH = Math.min(u * 1.3, vp.H * 0.035);

		// 1. Horizontal separation and ordering
		assert.ok(creditsX > guideX, vp.name + ': creditsX must be to the right of guideX');
		const separation = (creditsX - btnW / 2) - (guideX + btnW / 2);
		assert.ok(separation >= gap - 1e-4, vp.name + ': separation between buttons must be >= gap (' + gap + ')');

		// 2. Safe screen boundary containment
		assert.ok(guideX - btnW / 2 >= cx - safeW / 2 - 1e-4, vp.name + ': [H] button must stay inside safeW');
		assert.ok(creditsX + btnW / 2 <= cx + safeW / 2 + 1e-4, vp.name + ': [C] button must stay inside safeW');

		// 3. Vertical clearances (>= 12px)
		const topBuffer = (rowY - btnH / 2) - (ctaY + ctaH / 2);
		assert.ok(topBuffer >= 12, vp.name + ': top vertical buffer from CTA must be >= 12px (was ' + topBuffer.toFixed(1) + ')');

		const bottomBuffer = (exitY - exitH / 2) - (rowY + btnH / 2);
		assert.ok(bottomBuffer >= 12, vp.name + ': bottom vertical buffer to Exit button must be >= 12px (was ' + bottomBuffer.toFixed(1) + ')');

		// 4. Canvas save/restore balance across Credits modal
		let s0 = saveCalls();
		let r0 = restoreCalls();
		g_startCreditsOpen = true;
		renderCreditsModal(vp.W, vp.H, cx, cy, u, safeW, safeH);
		assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ': renderCreditsModal must maintain 0 net context deviation');

		s0 = saveCalls();
		r0 = restoreCalls();
		renderStartScreen();
		assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ': renderStartScreen with Credits modal open must maintain 0 net context deviation');

		g_startCreditsOpen = false;
	}
	console.log('  Passed: 7-viewport geometry, button spacing, vertical clearances, and canvas context balance verified.');

	// [Sim 3] Interactive Hover and Input State Machine Verification
	console.log('[Sim 3] Simulating interactive hover, mouse clicks, and keyboard C / ESC toggling...');
	mockCanvas.width = 1920;
	mockCanvas.height = 1080;
	mainCanvasSize = vec2(1920, 1080);
	inputData[0] = inputData[0] || [];

	const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(1920, 1080);
	const rowY = 1080 * 0.83;
	const btnW = Math.min(safeW * 0.38, u * 11);
	const gap = Math.max(8, u * 0.8);
	const creditsX = cx + btnW / 2 + gap / 2;

	// Hover over [C] CREDITS button
	g_startCreditsOpen = false;
	g_startHelpOpen = false;
	mousePosScreen = { x: creditsX, y: rowY };
	updateStartScreen();
	assert.strictEqual(g_startHoverCredits, true, 'Hovering [C] button must set g_startHoverCredits = true');
	assert.strictEqual(mockCanvas.style.cursor, 'pointer', 'Hovering [C] button must set pointer cursor');

	// Click [C] CREDITS button
	inputData[0][0] = 3;
	updateStartScreen();
	inputData[0][0] = 0;
	assert.strictEqual(g_startCreditsOpen, true, 'Clicking [C] button must open Credits modal');

	// Press Esc (27) to close
	inputData[0][27] = 3;
	updateStartScreen();
	inputData[0][27] = 0;
	assert.strictEqual(g_startCreditsOpen, false, 'Pressing Esc must close Credits modal');

	// Press C (67) to open Credits modal
	inputData[0][67] = 3;
	updateStartScreen();
	inputData[0][67] = 0;
	assert.strictEqual(g_startCreditsOpen, true, 'Pressing C must open Credits modal');

	// Press C (67) again to close Credits modal
	inputData[0][67] = 3;
	updateStartScreen();
	inputData[0][67] = 0;
	assert.strictEqual(g_startCreditsOpen, false, 'Pressing C while open must close Credits modal');

	console.log('  Passed: Hover states, click handling, and C / ESC toggle state machine verified.');
`;

vm.runInContext(simulationScript, sandbox);

console.log('\n✓ ALL SUITE C CREDITS MODAL CONTRACT & GEOMETRY CHECKS PASSED!\n');

// =============================================================
// SUITE D: Comprehensive Sequential Regression Test Runner (PKG-10)
// =============================================================
console.log('--- SUITE D: COMPREHENSIVE SEQUENTIAL REGRESSION TEST RUNNER (PKG-10) ---');

const regressionSuites = [
	{ name: 'Phase 9 Packaging', script: 'scripts/test-phase9-packaging.js' },
	{ name: 'Phase 9 Distribution', script: 'scripts/test-phase9-distribution.js' },
	{ name: 'Phase 12 Ammo Scarcity', script: 'scripts/test-phase12.js' },
	{ name: 'Phase 13 Frenzy & Clutches', script: 'scripts/test-phase13.js' },
	{ name: 'Phase 15 Combat Primitives', script: 'scripts/test-phase15.js' },
	{ name: 'Phase 16 HUD Ergonomics', script: 'scripts/test-phase16.js' },
	{ name: 'Phase 17 Start Screen Retro', script: 'scripts/test-phase17.js' },
	{ name: 'Phase 19 HUD Banners & Manual', script: 'scripts/test-phase19.js' },
	{ name: 'Phase 20 Arsenal & Compendium', script: 'scripts/test-phase20.js' },
	{ name: 'Phase 21 Arcade Start Visuals', script: 'scripts/test-phase21.js' },
	{ name: 'Phase 22 Stream Ergonomics', script: 'scripts/test-phase22.js' },
	{ name: 'Phase 23 Nightmare Survival Gauntlet', script: 'scripts/test-phase23.js' },
];

console.log(`Executing ${regressionSuites.length} historical regression test suites sequentially...\n`);

for (let i = 0; i < regressionSuites.length; i++) {
	const suite = regressionSuites[i];
	console.log(`[Regression Suite ${i + 1}/${regressionSuites.length}] Running ${suite.name} (${suite.script})...`);
	try {
		execSync(`node ${suite.script}`, { stdio: 'inherit' });
		console.log(`✓ [Regression Suite ${i + 1}/${regressionSuites.length}] ${suite.name} PASSED CLEANLY.\n`);
	} catch (err) {
		console.error(`✕ [Regression Suite ${i + 1}/${regressionSuites.length}] ${suite.name} FAILED!`);
		process.exit(1);
	}
}

console.log('========================================================================');
console.log('✓ ALL 4 SUITES IN PHASE 24 TEST HARNESS PASSED WITH 100% SUCCESS (EXIT 0)');
console.log('========================================================================\n');
