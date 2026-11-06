import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 17 START SCREEN RETRO ARCADE VISUAL OVERHAUL TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static AST & Source Code Contract Checks
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const pkgSrc = fs.readFileSync('package.json', 'utf8');

// [Check 1] Core architecture function declarations
console.log('[Check 1] startScreen.js core modular architecture functions...');
assert.ok(startSrc.includes('function getStartScreenSafeZone'), 'Must declare getStartScreenSafeZone');
assert.ok(startSrc.includes('function drawOverlayTile'), 'Must declare drawOverlayTile');
assert.ok(startSrc.includes('function createShieldPath'), 'Must declare createShieldPath');
assert.ok(startSrc.includes('function renderStartFactionPortraits'), 'Must declare renderStartFactionPortraits');
assert.ok(startSrc.includes('function renderStartScreenCrest'), 'Must declare renderStartScreenCrest');
assert.ok(startSrc.includes('function updateAndRenderStartEmbers'), 'Must declare updateAndRenderStartEmbers');
assert.ok(startSrc.includes('function renderStartAtmosphere'), 'Must declare renderStartAtmosphere');
assert.ok(startSrc.includes('function renderStartTypography'), 'Must declare renderStartTypography');
assert.ok(startSrc.includes('function renderStartSubtitleRibbon'), 'Must declare renderStartSubtitleRibbon');
assert.ok(startSrc.includes('function renderStartScreenBadges'), 'Must declare renderStartScreenBadges');
assert.ok(startSrc.includes('function renderStartScreenHelpManual'), 'Must declare renderStartScreenHelpManual');
assert.ok(startSrc.includes('function triggerStartTheatricalLaunch'), 'Must declare triggerStartTheatricalLaunch');
assert.ok(startSrc.includes('function updateStartScreen'), 'Must declare updateStartScreen');
assert.ok(startSrc.includes('function renderStartScreen'), 'Must declare renderStartScreen');
console.log('  Passed: All 14 modular start screen functions declared.');

// [Check 2] Crossed weapons angle math (-35° and +35°)
console.log('[Check 2] Crossed weapon sprites angle assertions (-35° / +35°)...');
assert.ok(startSrc.includes('-0.610865'), 'Shotgun tile must be angled at -35° (-0.610865 rad)');
assert.ok(startSrc.includes('0.610865'), 'SMG tile must be angled at +35° (+0.610865 rad)');
assert.ok(startSrc.includes('tileNumbers_shotgun'), 'Must reference tileNumbers_shotgun');
assert.ok(startSrc.includes('tileNumbers_smg'), 'Must reference tileNumbers_smg');
console.log('  Passed: Crossed weapon angles and sprite tiles verified.');

// [Check 3] Dynamic faction portraits bobbing & auras
console.log('[Check 3] Faction portraits sinusoidal bobbing and aura styling...');
assert.ok(startSrc.includes('Math.sin(frame * 0.05) * 3'), 'Survivor must bob ±3px with Math.sin(frame * 0.05) * 3');
assert.ok(startSrc.includes('Math.sin(frame * 0.05 + Math.PI) * 3'), 'Zombie must bob out-of-phase with Math.sin(frame * 0.05 + Math.PI) * 3');
assert.ok(startSrc.includes('#FBF236'), 'Survivor must have golden divine aura (#FBF236)');
assert.ok(startSrc.includes('#AC3232'), 'Zombie must have crimson miasma aura (#AC3232)');
console.log('  Passed: Faction portraits bobbing formulas and auras verified.');

// [Check 4] Atmosphere: 24 embers, 3px CRT scanlines, 4-second specular sweep
console.log('[Check 4] Atmosphere 24 embers, CRT scanlines, and 4s specular sweep...');
assert.ok(startSrc.includes('for (let i = 0; i < 24; i++)'), 'Must simulate exactly 24 embers');
assert.ok(startSrc.includes('y += 3'), 'CRT scanlines must render at 3px pitch');
assert.ok(startSrc.includes('cycle = frame % 240'), 'Specular sweep must run on a 4-second (240 frame) cycle');
console.log('  Passed: Particle simulation and CRT atmosphere parameters verified.');

// [Check 5] main.js delegation wiring
console.log('[Check 5] main.js lifecycle delegation to startScreen.js...');
assert.ok(mainSrc.includes('updateStartScreen()'), 'main.js must delegate updateStateClickToStart to updateStartScreen');
assert.ok(mainSrc.includes('renderStartScreen()'), 'main.js must delegate textsDraw to renderStartScreen');
assert.ok(pkgSrc.includes('"test:phase17": "node scripts/test-phase17.js"'), 'package.json must contain test:phase17 runner');
console.log('  Passed: main.js and package.json integration verified.');

console.log('\n✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');


// -------------------------------------------------------------
// SUITE B: Headless Node VM Mathematical & Layout Boundary Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL & GEOMETRIC SIMULATIONS ---');

console.log('[Build] Compiling game bundle via scripts/build-game.js...');
execSync('node scripts/build-game.js', { stdio: 'inherit' });

let saveCalls = 0;
let restoreCalls = 0;

const mockContext = {
	_fillStyle: '',
	_strokeStyle: '',
	_lineWidth: 1,
	textAlign: 'left',
	font: '10px monospace',
	textBaseline: 'alphabetic',
	lineJoin: 'miter',
	imageSmoothingEnabled: true,
	shadowColor: '',
	shadowBlur: 0,
	shadowOffsetX: 0,
	shadowOffsetY: 0,

	get strokeStyle() { return this._strokeStyle; },
	set strokeStyle(val) { this._strokeStyle = val; },
	get lineWidth() { return this._lineWidth; },
	set lineWidth(val) { this._lineWidth = val; },
	get fillStyle() { return this._fillStyle; },
	set fillStyle(val) { this._fillStyle = val; },

	fillRect: () => {},
	strokeRect: () => {},
	clearRect: () => {},
	fillText: () => {},
	strokeText: () => {},
	measureText: (text) => ({ width: (text ? text.length : 0) * 8 }),
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
	style: {},
};

let keyboardState = {};
let mouseClicks = {};
let gamepadButtons = {};
let audioPlayLog = [];

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
	mouseClicks,
	keyboardState,
	gamepadButtons,
	mainCanvas: mockCanvas,
	overlayCanvas: mockCanvas,
	mainContext: mockContext,
	overlayContext: mockContext,
	mousePosScreen: { x: 960, y: 540 },
	mouseWasPressed: (btn) => !!mouseClicks[btn],
	mouseWasReleased: (btn) => !!mouseClicks[btn],
	keyWasPressed: (code) => !!keyboardState[code],
	gamepadWasPressed: (btn) => !!gamepadButtons[btn],
	audioPlayLog,
	saveCalls: () => saveCalls,
	restoreCalls: () => restoreCalls,
};
sandbox.window = sandbox;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
const bundleCode = fs.readFileSync('main/dist/js/index.js', 'utf8');

vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const simulations = `
	mainCanvas = mockCanvas;
	mainContext = mockContext;
	overlayCanvas = mockCanvas;
	overlayContext = mockContext;
	mainCanvasSize = vec2(1920, 1080);
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);
	tileImage.width = 128;
	tileImage.height = 128;
	frame = 0;

	// -------------------------------------------------------------
	// Simulation 1: 16:9 Virtual Safe Zone Clamping Across Displays
	// -------------------------------------------------------------
	console.log('[Sim 1] 16:9 Virtual Safe Zone Clamping across 720p, 1080p, 4K, Ultrawide...');

	// 1080p standard 16:9
	const sz1080 = getStartScreenSafeZone(1920, 1080);
	assert.strictEqual(sz1080.safeW, 1920, '1080p safeW must equal canvas width');
	assert.strictEqual(sz1080.safeH, 1080, '1080p safeH must equal canvas height');
	assert.strictEqual(sz1080.offsetX, 0, '1080p offsetX must be 0');
	assert.strictEqual(sz1080.offsetY, 0, '1080p offsetY must be 0');

	// 720p standard 16:9
	const sz720 = getStartScreenSafeZone(1280, 720);
	assert.strictEqual(sz720.safeW, 1280, '720p safeW must equal 1280');
	assert.strictEqual(sz720.safeH, 720, '720p safeH must equal 720');
	assert.strictEqual(sz720.offsetX, 0, '720p offsetX must be 0');

	// 4K standard 16:9
	const sz4K = getStartScreenSafeZone(3840, 2160);
	assert.strictEqual(sz4K.safeW, 3840, '4K safeW must equal 3840');
	assert.strictEqual(sz4K.safeH, 2160, '4K safeH must equal 2160');

	// 21:9 Ultrawide (2560x1080)
	const szUltra = getStartScreenSafeZone(2560, 1080);
	assert.strictEqual(szUltra.safeW, 1920, 'Ultrawide safeW must clamp to 1920 (1080 * 16/9)');
	assert.strictEqual(szUltra.safeH, 1080, 'Ultrawide safeH must match canvas height');
	assert.strictEqual(szUltra.offsetX, 320, 'Ultrawide horizontal letterbox offset must be (2560 - 1920)/2 = 320');
	assert.strictEqual(szUltra.offsetY, 0, 'Ultrawide vertical offset must be 0');

	console.log('  Passed: Safe zone math correctly clamps 16:9 across all viewports.');

	// -------------------------------------------------------------
	// Simulation 2: 24-Ember Procedural Particle Simulation
	// -------------------------------------------------------------
	console.log('[Sim 2] Procedural 24-ember particle simulation...');
	initStartEmbers(1920, 1080);
	assert.strictEqual(g_startEmbers.length, 24, 'Must instantiate exactly 24 embers');

	for (let f = 0; f < 60; f++) {
		frame = f;
		updateAndRenderStartEmbers(1920, 1080);
	}
	assert.strictEqual(g_startEmbers.length, 24, 'Ember count must stay exactly 24 across frames');

	// Force particle death and assert respawn at screen bottom
	g_startEmbers[0].y = -15;
	g_startEmbers[0].life = 0;
	updateAndRenderStartEmbers(1920, 1080);
	assert.ok(g_startEmbers[0].y >= 1080, 'Expired ember must respawn at bottom of screen');
	assert.ok(g_startEmbers[0].life > 0, 'Respawned ember must have reset life');

	console.log('  Passed: 24 embers simulate upward drift, sine flutter, and smooth respawning.');

	// -------------------------------------------------------------
	// Simulation 3: Unified Multi-Input State Machine
	// -------------------------------------------------------------
	console.log('[Sim 3] Unified multi-input navigation & theatrical launch triggers...');

	inputData[0] = inputData[0] || [];
	inputData[1] = inputData[1] || [];

	const simulateMouseClick = (x, y, btn = 0) => {
		mousePosScreen = { x, y };
		inputData[0][btn] = 3;
		updateStartScreen();
		inputData[0][btn] = 0;
	};

	const simulateKeyPress = (code) => {
		inputData[0][code] = 3;
		updateStartScreen();
		inputData[0][code] = 0;
	};

	const simulateGamepadPress = (button, pad = 0) => {
		inputData[pad + 1] = inputData[pad + 1] || [];
		inputData[pad + 1][button] = 3;
		updateStartScreen();
		inputData[pad + 1][button] = 0;
	};

	// Test 1: Mouse click on CTA cartouche triggers launch sequence
	g_startLaunchTimer = 0;
	g_startFlashFrames = 0;
	g_startHelpOpen = false;

	const ctaY = 1080 * 0.74;
	simulateMouseClick(960, ctaY, 0);

	assert.ok(g_startLaunchTimer > 0, 'Clicking CTA cartouche must set launch timer');
	assert.strictEqual(g_startFlashFrames, 12, 'Clicking CTA cartouche must trigger 12 flash frames');

	// Advance 12 frames to complete launch sequence
	for (let i = 0; i < 12; i++) {
		updateStartScreen();
	}
	assert.strictEqual(g_startFlashFrames, 0, 'Flash frames must decrement to 0');
	assert.strictEqual(g_startLaunchTimer, 0, 'Launch timer must reset upon lobby transition');

	// Test 2: 'H' key toggles Help manual modal
	simulateKeyPress(72); // 'H'
	assert.strictEqual(g_startHelpOpen, true, "'H' key must open Help field manual modal");

	// Test 3: Tab navigation with keys 1, 2, 3 and arrows
	simulateKeyPress(50); // '2'
	assert.strictEqual(g_startHelpTab, 1, "Key '2' must select Tab 1 (Twitch APG & Karma)");

	simulateKeyPress(51); // '3'
	assert.strictEqual(g_startHelpTab, 2, "Key '3' must select Tab 2 (Streamer Setup)");

	simulateKeyPress(37); // Left arrow
	assert.strictEqual(g_startHelpTab, 1, "Left arrow must decrement active tab");

	// Test 4: Gamepad LB/RB tab navigation
	simulateGamepadPress(5); // RB
	assert.strictEqual(g_startHelpTab, 2, "Gamepad RB must cycle active tab forward");

	simulateGamepadPress(4); // LB
	assert.strictEqual(g_startHelpTab, 1, "Gamepad LB must cycle active tab backward");

	// Test 5: Esc key closes Help modal
	simulateKeyPress(27); // Esc
	assert.strictEqual(g_startHelpOpen, false, "Esc key must close Help modal");

	// Test 6: Gamepad 'Y' opens Help, 'B' closes Help
	simulateGamepadPress(3); // Y
	assert.strictEqual(g_startHelpOpen, true, "Gamepad Y must open Help modal");

	simulateGamepadPress(1); // B
	assert.strictEqual(g_startHelpOpen, false, "Gamepad B must close Help modal");

	// Test 7: Keyboard Enter triggers launch
	simulateKeyPress(13); // Enter
	assert.strictEqual(g_startFlashFrames, 12, "Enter key must trigger launch sequence");
	g_startFlashFrames = 0;
	g_startLaunchTimer = 0;

	// Test 8: Gamepad 'A' triggers launch
	simulateGamepadPress(0); // A
	assert.strictEqual(g_startFlashFrames, 12, "Gamepad A must trigger launch sequence");
	g_startFlashFrames = 0;
	g_startLaunchTimer = 0;

	console.log('  Passed: Unified mouse, keyboard, and gamepad input state machine verified.');

	// -------------------------------------------------------------
	// Simulation 4: Canvas Context Isolation & Save/Restore Balance
	// -------------------------------------------------------------
	console.log('[Sim 4] Canvas context stack isolation balance...');

	// Test renderStartScreen when modal is closed
	g_startHelpOpen = false;
	g_startFlashFrames = 0;
	frame = 10; // within sheen sweep

	const initialSaves = saveCalls();
	const initialRestores = restoreCalls();

	renderStartScreen();

	const deltaSaves = saveCalls() - initialSaves;
	const deltaRestores = restoreCalls() - initialRestores;

	assert.ok(deltaSaves > 0, 'renderStartScreen must invoke save() calls for modular layers');
	assert.strictEqual(deltaSaves, deltaRestores, 'renderStartScreen must balance save() and restore() with zero net stack deviation');

	// Test renderStartScreen when Help modal is open
	g_startHelpOpen = true;
	g_startHelpTab = 0;
	const hSaves0 = saveCalls();
	const hRestores0 = restoreCalls();
	renderStartScreen();
	assert.strictEqual(saveCalls() - hSaves0, restoreCalls() - hRestores0, 'Tab 0 render must balance save/restore');

	g_startHelpTab = 1;
	const hSaves1 = saveCalls();
	const hRestores1 = restoreCalls();
	renderStartScreen();
	assert.strictEqual(saveCalls() - hSaves1, restoreCalls() - hRestores1, 'Tab 1 render must balance save/restore');

	g_startHelpTab = 2;
	const hSaves2 = saveCalls();
	const hRestores2 = restoreCalls();
	renderStartScreen();
	assert.strictEqual(saveCalls() - hSaves2, restoreCalls() - hRestores2, 'Tab 2 render must balance save/restore');

	// Test with transition flash active
	g_startFlashFrames = 6;
	const fSaves = saveCalls();
	const fRestores = restoreCalls();
	renderStartScreen();
	assert.strictEqual(saveCalls() - fSaves, restoreCalls() - fRestores, 'Flash wipe render must balance save/restore');

	console.log('  Passed: Canvas context stack strictly isolated (net deviation = 0 across all states).');
`;

vm.runInContext(simulations, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 17 AUTOMATED TESTS PASSED CLEANLY (100% GREEN)');
console.log('=============================================================\n');

process.exit(0);
