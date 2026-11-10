import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 22 IN-GAME STREAM COMMAND CHEAT-SHEET & STREAMER ERGONOMICS TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Source Code AST & Contract Verification
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
const preloadSrc = fs.readFileSync('desktop/preload.cjs', 'utf8');
const desktopMainSrc = fs.readFileSync('desktop/main.js', 'utf8');
const dashHtml = fs.readFileSync('relay-server/public/index.html', 'utf8');
const dashCss = fs.readFileSync('relay-server/public/css/dashboard.css', 'utf8');
const dashJs = fs.readFileSync('relay-server/public/js/dashboard.js', 'utf8');
const guideMd = fs.readFileSync('STREAMER_GUIDE.md', 'utf8');

// [Check 1] apgManager.js Cheat-Sheet Engine, 10 Commands, Tactical Summaries & Team Colors (HUD-05, D-01..D-04, D-13..D-18, D-33)
console.log('[Check 1] apgManager.js renderCheatSheet signature, 10 commands, tactical summaries & pulse/flare trackers...');
assert.ok(
	apgSrc.includes('renderCheatSheet(W, H, u)'),
	'D-01: apgManager.js must declare renderCheatSheet(W, H, u)'
);
assert.ok(
	apgSrc.includes('this.commandPulseFrames') &&
	apgSrc.includes('this.commandLastTriggered') &&
	apgSrc.includes('triggerCheatSheetFlare'),
	'D-13/D-18/D-33: apgManager.js must declare commandPulseFrames, commandLastTriggered, and triggerCheatSheetFlare'
);

const expectedCommands = [
	{ cmd: '!ammo', label: '+Primary Ammo' },
	{ cmd: '!barrier', label: '+Repel Rune' },
	{ cmd: '!repair', label: '+Shield Pip' },
	{ cmd: '!slow', label: '-50% Enemy Spd' },
	{ cmd: '!light', label: '+Arena Light' },
	{ cmd: '!mob', label: '+Zombie Spawn' },
	{ cmd: '!boss', label: '+Siege Boss' },
	{ cmd: '!jam', label: 'Weapon Jam' },
	{ cmd: '!blackout', label: 'Darkness 8s' },
	{ cmd: '!frenzy', label: 'Blood Frenzy' }
];

for (const entry of expectedCommands) {
	assert.ok(
		apgSrc.includes(`'${entry.cmd}'`) || apgSrc.includes(`"${entry.cmd}"`),
		`D-03: apgManager.js must include command ${entry.cmd}`
	);
	assert.ok(
		apgSrc.includes(`'${entry.label}'`) || apgSrc.includes(`"${entry.label}"`),
		`D-03: apgManager.js must include 2-word tactical summary "${entry.label}" for ${entry.cmd}`
	);
}

assert.ok(apgSrc.includes('#4ADE80'), 'D-01: apgManager.js must include Team Good color #4ADE80');
assert.ok(apgSrc.includes('#FF4D4D'), 'D-01: apgManager.js must include Team Bad color #FF4D4D');
console.log('  Passed: renderCheatSheet(W, H, u), all 10 commands & summaries, team colors, and pulse/flare state verified.');

// [Check 2] main.js Storage Helpers, State Variables, Hotkeys & Run Abandonment (HUD-06, D-06..D-10, D-19, D-22, D-23, D-35)
console.log('[Check 2] main.js safeGetPref/safeSetPref, cheat-sheet state, hotkeys [C]/Shift+C/gamepad(8), and abandonRunToMainMenu...');
assert.ok(
	mainSrc.includes('function safeGetPref') && mainSrc.includes('function safeSetPref'),
	'D-35: main.js must declare safeGetPref and safeSetPref storage helpers'
);
for (const stateVar of ['g_cheatsheetVisible', 'g_cheatsheetDock', 'g_cheatsheetSlideProgress', 'g_lastInputGamepad']) {
	assert.ok(
		mainSrc.includes(stateVar),
		`D-06/D-08/D-10/D-22: main.js must declare global state variable ${stateVar}`
	);
}
assert.ok(
	mainSrc.includes('function abandonRunToMainMenu()'),
	'D-23: main.js must declare function abandonRunToMainMenu()'
);
assert.ok(
	mainSrc.includes('keyWasPressed(67)') && mainSrc.includes('keyIsDown(16)') && mainSrc.includes('gamepadWasPressed(8)'),
	'D-07/D-10/D-19: main.js must poll keyWasPressed(67), keyIsDown(16), and gamepadWasPressed(8)'
);
console.log('  Passed: Storage helpers, global cheat-sheet variables, hotkeys, and abandonRunToMainMenu verified.');

// [Check 3] ui.js Pause Menu Interactive Buttons & Audio Feedback (D-23, D-24)
console.log('[Check 3] ui.js Pause Menu interactive buttons & tactile audio feedback...');
assert.ok(
	uiSrc.includes('[C] CHEAT-SHEET: ['),
	'D-23: ui.js must render [C] CHEAT-SHEET: [ON/OFF] button in Pause Menu'
);
assert.ok(
	uiSrc.includes('[DOCK: '),
	'D-23: ui.js must render [DOCK: RIGHT/LEFT] button in Pause Menu'
);
assert.ok(
	uiSrc.includes('[ QUIT TO MAIN MENU ]'),
	'D-23: ui.js must render [ QUIT TO MAIN MENU ] button in Pause Menu'
);
assert.ok(
	uiSrc.includes('uiSound(1)'),
	'D-24: ui.js must trigger uiSound(1) tactile audio feedback on Pause Menu button clicks'
);
console.log('  Passed: Pause Menu buttons ([C] CHEAT-SHEET, [DOCK, [ QUIT TO MAIN MENU ]) and uiSound(1) verified.');

// [Check 4] startScreen.js [ EXIT GAME ] Button, Hover State, Desktop IPC Call & Tab 3 Note (D-25, D-26, D-36)
console.log('[Check 4] startScreen.js [ EXIT GAME ] button, hover state, exitApp call, and Tab 3 cheat-sheet note...');
assert.ok(
	startSrc.includes('[ EXIT GAME ]') && startSrc.includes('g_startHoverExit'),
	'D-25: startScreen.js must declare g_startHoverExit and render [ EXIT GAME ] button'
);
assert.ok(
	startSrc.includes('window.electronAPI.exitApp()'),
	'D-25: startScreen.js must invoke window.electronAPI.exitApp() on desktop'
);
assert.ok(
	startSrc.includes('CHEAT-SHEET OVERLAY:') && startSrc.includes('[C]') && startSrc.includes('Shift+C'),
	'D-36: startScreen.js Tab 3 must document [C] and Shift+C cheat-sheet controls'
);
console.log('  Passed: Start Screen [ EXIT GAME ] button, exitApp bridge call, and Tab 3 documentation verified.');

// [Check 5] Desktop IPC Exit Bridge & Streamer Dashboard Monetization Overhaul (D-25, D-27..D-31, D-36)
console.log('[Check 5] Desktop IPC exit bridge, Streamer Dashboard Buy Me A Coffee CTA, null guards & STREAMER_GUIDE.md...');
assert.ok(
	preloadSrc.includes('exitApp: () =>') && preloadSrc.includes("ipcRenderer.send('desktop:exit-app')"),
	'D-25: desktop/preload.cjs must expose exitApp sending desktop:exit-app'
);
assert.ok(
	desktopMainSrc.includes("ipcMain.on('desktop:exit-app'"),
	'D-25: desktop/main.js must register ipcMain.on("desktop:exit-app") handler'
);
assert.ok(
	!dashHtml.includes('id="viewer-badge"'),
	'D-27: relay-server/public/index.html must NOT contain legacy #viewer-badge'
);
assert.ok(
	dashHtml.includes('bmc-kofi-btn') && dashHtml.includes('☕ Buy Me A Coffee!'),
	'D-28/D-29: relay-server/public/index.html must include .bmc-kofi-btn and ☕ Buy Me A Coffee! CTA'
);
assert.ok(
	dashCss.includes('.bmc-kofi-btn'),
	'D-28: relay-server/public/css/dashboard.css must define .bmc-kofi-btn styles'
);
assert.ok(
	dashJs.includes('if (viewerBadge)'),
	'D-31: relay-server/public/js/dashboard.js must guard viewerBadge with if (viewerBadge)'
);
assert.ok(
	guideMd.includes('[C]') && guideMd.includes('Shift+C'),
	'D-36: STREAMER_GUIDE.md must document [C] and Shift+C cheat-sheet hotkeys'
);
console.log('  Passed: Desktop IPC bridge, dashboard monetization CTA, viewerBadge null guard, and STREAMER_GUIDE.md verified.\n');

console.log('✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE B: Headless Node.js VM Multi-Viewport Simulations (7 Viewports)
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM 7-VIEWPORT GEOMETRIC & BEHAVIORAL SIMULATIONS ---');

console.log('[Build] Compiling production bundle via scripts/build-game.js...');
execSync('node scripts/build-game.js', { stdio: 'inherit' });

const bundleCode = fs.readFileSync('main/dist/js/index.js', 'utf8');
assert.strictEqual(
	/\b(import|export)\s+/m.test(bundleCode),
	false,
	'Zero ES6 import/export statements may leak into concatenated dist/js/index.js'
);

let saveCalls = 0;
let restoreCalls = 0;
let fillRectCalls = [];
let strokeRectCalls = [];
let fillTextCalls = [];
let storageMap = {};
let storageThrowMode = false;
let exitAppCalled = false;
let windowCloseCalled = false;

const mockLocalStorage = {
	getItem: (key) => {
		if (storageThrowMode) throw new Error('Simulated sandboxed storage restriction');
		return Object.prototype.hasOwnProperty.call(storageMap, key) ? storageMap[key] : null;
	},
	setItem: (key, val) => {
		if (storageThrowMode) throw new Error('Simulated sandboxed storage restriction');
		storageMap[key] = String(val);
	},
	removeItem: (key) => {
		delete storageMap[key];
	},
	get da_t() {
		return storageMap.da_t || 0;
	},
	set da_t(v) {
		storageMap.da_t = String(v);
	}
};

const mockContext = {
	_fillStyle: '',
	_strokeStyle: '',
	_lineWidth: 1,
	textAlign: 'left',
	font: '14px monospace',
	textBaseline: 'alphabetic',
	lineJoin: 'miter',
	lineCap: 'butt',
	imageSmoothingEnabled: true,
	shadowColor: '',
	shadowBlur: 0,
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
		fillRectCalls.push({ x, y, w, h, fillStyle: mockContext._fillStyle, alpha: mockContext.globalAlpha });
	},
	strokeRect: (x, y, w, h) => {
		strokeRectCalls.push({ x, y, w, h, strokeStyle: mockContext._strokeStyle, shadowColor: mockContext.shadowColor, shadowBlur: mockContext.shadowBlur });
	},
	clearRect: () => {},
	fillText: (text, x, y) => {
		fillTextCalls.push({ text: String(text), x, y, fillStyle: mockContext._fillStyle, font: mockContext.font, align: mockContext.textAlign });
	},
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
	localStorage: mockLocalStorage,
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
	electronAPI: {
		exitApp: () => { exitAppCalled = true; },
		openDashboard: () => {},
	},
	close: () => { windowCloseCalled = true; },
	mockCanvas,
	mockContext,
	mainCanvas: mockCanvas,
	overlayCanvas: mockCanvas,
	mainContext: mockContext,
	overlayContext: mockContext,
	mousePosScreen: { x: 960, y: 540 },
	saveCalls: () => saveCalls,
	restoreCalls: () => restoreCalls,
	getFillRectCalls: () => fillRectCalls,
	getStrokeRectCalls: () => strokeRectCalls,
	getFillTextCalls: () => fillTextCalls,
	clearDrawCalls: () => {
		fillRectCalls.length = 0;
		strokeRectCalls.length = 0;
		fillTextCalls.length = 0;
	},
	setStorageThrowMode: (flag) => { storageThrowMode = flag; },
	getStorageItem: (k) => storageMap[k],
	wasExitAppCalled: () => exitAppCalled,
	resetExitCalls: () => { exitAppCalled = false; windowCloseCalled = false; },
};
sandbox.window = sandbox;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const viewports = [
	{ name: '1080p Full HD (1920x1080)', W: 1920, H: 1080 },
	{ name: '720p Standard HD (1280x720)', W: 1280, H: 720 },
	{ name: '1440p QHD (2560x1440)', W: 2560, H: 1440 },
	{ name: '4K UHD (3840x2160)', W: 3840, H: 2160 },
	{ name: '4:3 Retro Display (1024x768)', W: 1024, H: 768 },
	{ name: '16:10 Widescreen (1920x1200)', W: 1920, H: 1200 },
	{ name: '21:9 Ultrawide (2560x1080)', W: 2560, H: 1080 },
];

const simulationScript = `
	mainCanvas = mockCanvas;
	mainContext = mockContext;
	overlayCanvas = mockCanvas;
	overlayContext = mockContext;
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);
	tileImage.width = 128;
	tileImage.height = 128;
	frame = 100;

	const viewports = ${JSON.stringify(viewports)};

	// -------------------------------------------------------------
	// Simulation 1: 7-Viewport Mathematical Clearance & Spatial Containment (HUD-05, D-09, D-11, D-12)
	// -------------------------------------------------------------
	console.log('[Sim 1] 7-Viewport geometric deconfliction against Karma meter, kill counter & chat toast stream...');
	g_state = STATE_PLAYING;
	g_isPaused = false;
	g_startHelpOpen = false;
	g_cheatsheetVisible = true;
	g_cheatsheetSlideProgress = 1.0;

	for (const vp of viewports) {
		const W = vp.W;
		const H = vp.H;
		mockCanvas.width = W;
		mockCanvas.height = H;
		mainCanvasSize = vec2(W, H);

		const u = Math.max(12, Math.min(W, H) / 40);
		const cx = W * 0.50;

		// Karma meter geometry: center 0.50W, width min(0.42W, 21u), mini portraits extend up to 1.9u past bar edges
		const barW = Math.min(0.42 * W, 21 * u);
		const karmaRightEdge = cx + barW / 2 + 1.9 * u;
		const karmaLeftEdge = cx - barW / 2 - 1.9 * u;

		// Kill counter Y at 0.38H; Toast stream bottom <= 0.65H
		const killCounterY = 0.38 * H;
		const toastBottomY = 0.65 * H;

		// Right Dock Safe Zone: X in [0.74W, 0.98W], Y in [0.72H, 0.96H]
		const rightDockLeft = Math.round(W * 0.74);
		const rightDockRight = rightDockLeft + Math.round(W * 0.24);
		const dockTop = Math.round(H * 0.72);
		const dockBottom = dockTop + Math.round(H * 0.24);

		// Left Dock Safe Zone: X in [0.02W, 0.26W], Y in [0.72H, 0.96H]
		const leftDockLeft = Math.round(W * 0.02);
		const leftDockRight = leftDockLeft + Math.round(W * 0.24);

		const rightKarmaClearance = rightDockLeft - karmaRightEdge;
		const rightKillClearance = dockTop - killCounterY;
		const leftKarmaClearance = karmaLeftEdge - leftDockRight;
		const leftToastClearance = dockTop - toastBottomY;

		assert.ok(
			rightKarmaClearance > 0,
			vp.name + ': Right Dock left edge (' + rightDockLeft + ') must clear Karma right edge (' + karmaRightEdge.toFixed(1) + ') by > 0px (got +' + rightKarmaClearance.toFixed(1) + 'px)'
		);
		assert.ok(
			rightKillClearance > 200,
			vp.name + ': Right Dock top edge (' + dockTop + ') must clear Kill Counter Y (' + killCounterY.toFixed(1) + ') (got +' + rightKillClearance.toFixed(1) + 'px)'
		);
		if (W === 1920 && H === 1080) {
			assert.ok(rightKillClearance > 300, '1080p: Right Dock top edge must have > 300px clearance below Kill Counter');
		}
		assert.ok(
			leftKarmaClearance > 0,
			vp.name + ': Left Dock right edge (' + leftDockRight + ') must clear Karma left edge (' + karmaLeftEdge.toFixed(1) + ') by > 0px (got +' + leftKarmaClearance.toFixed(1) + 'px)'
		);
		assert.ok(
			leftToastClearance > 40,
			vp.name + ': Left Dock top edge (' + dockTop + ') must clear Toast bottom Y (' + toastBottomY.toFixed(1) + ') by > 40px (got +' + leftToastClearance.toFixed(1) + 'px)'
		);

		// Render in Right Dock and verify drawn rects/text stay strictly inside [rightDockLeft, rightDockRight] x [dockTop, dockBottom]
		g_cheatsheetDock = 'right';
		clearDrawCalls();
		g_apgManager.renderCheatSheet(W, H, u);
		for (const r of getFillRectCalls()) {
			assert.ok(r.x >= rightDockLeft - 1 && r.x + r.w <= rightDockRight + 1, vp.name + ' [Right Dock]: rect X out of bounds');
			assert.ok(r.y >= dockTop - 1 && r.y + r.h <= dockBottom + 1, vp.name + ' [Right Dock]: rect Y out of bounds');
		}
		assert.strictEqual(getFillTextCalls().length, 21, vp.name + ' [Right Dock]: must render header + 10 commands + 10 tactical summaries (21 texts)');

		// Render in Left Dock and verify drawn rects/text stay strictly inside [leftDockLeft, leftDockRight] x [dockTop, dockBottom]
		g_cheatsheetDock = 'left';
		clearDrawCalls();
		g_apgManager.renderCheatSheet(W, H, u);
		for (const r of getFillRectCalls()) {
			assert.ok(r.x >= leftDockLeft - 1 && r.x + r.w <= leftDockRight + 1, vp.name + ' [Left Dock]: rect X out of bounds');
			assert.ok(r.y >= dockTop - 1 && r.y + r.h <= dockBottom + 1, vp.name + ' [Left Dock]: rect Y out of bounds');
		}
		assert.strictEqual(getFillTextCalls().length, 21, vp.name + ' [Left Dock]: must render header + 10 commands + 10 tactical summaries (21 texts)');
	}
	g_cheatsheetDock = 'right';
	console.log('  Passed: Mathematical clearance and spatial containment verified across all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 2: 45-Frame Pulse Decay & Pause Freeze Synchronization (D-13..D-18, D-33)
	// -------------------------------------------------------------
	console.log('[Sim 2] 45-frame command pulse decay, immediate peak re-trigger & pause freeze...');
	g_state = STATE_PLAYING;
	g_isPaused = false;
	g_apgManager.commandPulseFrames = {};

	// Trigger !ammo packet
	g_apgManager.handleActionPacket({ action: 'ammo', team: 'good', user: 'Viewer1' });
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 45, 'Triggering !ammo must initialize commandPulseFrames.ammo to 45');

	// Advance 15 unpaused frames -> should decay to 30
	for (let i = 0; i < 15; i++) {
		frame++;
		g_apgManager.update();
	}
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 30, 'After 15 active frames, commandPulseFrames.ammo must be 30');

	// Pause game (g_isPaused = true) and advance 60 frames -> must remain strictly frozen at 30 (D-17)
	g_isPaused = true;
	for (let i = 0; i < 60; i++) {
		frame++;
		g_apgManager.update();
	}
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 30, 'During g_isPaused = true across 60 frames, commandPulseFrames.ammo must remain frozen at 30');

	// Unpause game and advance 10 frames -> decays to 20
	g_isPaused = false;
	for (let i = 0; i < 10; i++) {
		frame++;
		g_apgManager.update();
	}
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 20, 'After 10 unpaused frames, commandPulseFrames.ammo must be 20');

	// Immediate peak re-trigger (D-15) -> resets immediately to 45
	g_apgManager.handleActionPacket({ action: 'ammo', team: 'good', user: 'Viewer2' });
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 45, 'Rapid re-trigger must immediately reset commandPulseFrames.ammo to 45');

	// Advance 45 unpaused frames -> decays cleanly to 0
	for (let i = 0; i < 45; i++) {
		frame++;
		g_apgManager.update();
	}
	assert.strictEqual(g_apgManager.commandPulseFrames['ammo'], 0, 'After 45 unpaused frames, commandPulseFrames.ammo must decay cleanly to 0');

	// Major Event Border Flare 30-frame decay & pause freeze (D-33)
	g_apgManager.triggerCheatSheetFlare('#FBF236', 30);
	assert.strictEqual(g_apgManager.cheatSheetFlare.frames, 30, 'triggerCheatSheetFlare must set frames = 30');
	g_isPaused = true;
	for (let i = 0; i < 20; i++) g_apgManager.update();
	assert.strictEqual(g_apgManager.cheatSheetFlare.frames, 30, 'cheatSheetFlare must freeze while paused');
	g_isPaused = false;
	for (let i = 0; i < 30; i++) g_apgManager.update();
	assert.strictEqual(g_apgManager.cheatSheetFlare.frames, 0, 'cheatSheetFlare must decay to 0 after 30 unpaused frames');
	console.log('  Passed: 45-frame pulse decay, pause freeze synchronization, peak re-trigger, and 30-frame event flare verified.');

	// -------------------------------------------------------------
	// Simulation 3: Hotkey State Machine, Shift+C Chord Disambiguation, Prompt Switching & Storage Resilience (HUD-06)
	// -------------------------------------------------------------
	console.log('[Sim 3] Hotkey state machine ([C], Shift+C, Gamepad 8), dynamic prompt switching & localStorage persistence...');
	mockCanvas.width = 1920;
	mockCanvas.height = 1080;
	mainCanvasSize = vec2(1920, 1080);
	const origUpdateStatePlaying = updateStatePlaying;
	updateStatePlaying = () => {};
	g_state = STATE_PLAYING;
	g_isPaused = false;
	g_cheatsheetVisible = true;
	g_cheatsheetDock = 'right';
	g_cheatsheetSlideProgress = 1.0;
	inputData[0] = inputData[0] || [];
	inputData[1] = inputData[1] || [];

	// 3a: Press [C] (67) without Shift -> toggles visibility OFF and persists '0'
	inputData[0][16] = 0;
	inputData[0][67] = 3;
	gameUpdate();
	inputData[0][67] = 0;
	assert.strictEqual(g_cheatsheetVisible, false, 'Pressing [C] must toggle g_cheatsheetVisible to false');
	assert.strictEqual(getStorageItem('da_cheatsheet_visible'), '0', 'Pressing [C] must persist da_cheatsheet_visible = "0"');
	assert.strictEqual(g_cheatsheetDock, 'right', 'Pressing [C] without Shift must not change g_cheatsheetDock');

	// Advance 7 frames so slideProgress reaches 0 -> verify Pure Auto-Hide (0 pixels rendered, D-05)
	for (let i = 0; i < 7; i++) gameUpdate();
	assert.strictEqual(g_cheatsheetSlideProgress, 0, 'After 7 frames collapsed, g_cheatsheetSlideProgress must be 0');
	clearDrawCalls();
	g_apgManager.renderCheatSheet(1920, 1080, 27);
	assert.strictEqual(getFillRectCalls().length, 0, 'D-05: Collapsed cheat-sheet must render 0 rectangles');
	assert.strictEqual(getFillTextCalls().length, 0, 'D-05: Collapsed cheat-sheet must render 0 texts');

	// 3b: Press [C] (67) again -> toggles visibility ON and persists '1'
	inputData[0][67] = 3;
	gameUpdate();
	inputData[0][67] = 0;
	assert.strictEqual(g_cheatsheetVisible, true, 'Pressing [C] again must toggle g_cheatsheetVisible to true');
	assert.strictEqual(getStorageItem('da_cheatsheet_visible'), '1', 'Pressing [C] must persist da_cheatsheet_visible = "1"');
	for (let i = 0; i < 7; i++) gameUpdate();
	assert.strictEqual(g_cheatsheetSlideProgress, 1.0, 'After 7 frames expanded, g_cheatsheetSlideProgress must be 1.0');

	// 3c: Press Shift+C (keyWasPressed(67) with keyIsDown(16)) -> flips dock to 'left' WITHOUT toggling visibility
	inputData[0][16] = 1; // Shift held down
	inputData[0][67] = 3; // C pressed
	gameUpdate();
	inputData[0][16] = 0;
	inputData[0][67] = 0;
	assert.strictEqual(g_cheatsheetDock, 'left', 'Shift+C must flip g_cheatsheetDock from "right" to "left"');
	assert.strictEqual(getStorageItem('da_cheatsheet_dock'), 'left', 'Shift+C must persist da_cheatsheet_dock = "left"');
	assert.strictEqual(g_cheatsheetVisible, true, 'Shift+C must NOT toggle g_cheatsheetVisible');

	// Press Shift+C again -> flips dock back to 'right'
	inputData[0][16] = 1;
	inputData[0][67] = 3;
	gameUpdate();
	inputData[0][16] = 0;
	inputData[0][67] = 0;
	assert.strictEqual(g_cheatsheetDock, 'right', 'Second Shift+C must flip g_cheatsheetDock back to "right"');
	assert.strictEqual(getStorageItem('da_cheatsheet_dock'), 'right', 'Second Shift+C must persist da_cheatsheet_dock = "right"');

	// 3d: Gamepad Select (button 8) toggle & Dynamic Prompt Switching ([C] vs [SELECT], D-19, D-22)
	const origGamepadWasPressed = gamepadWasPressed;
	let mockGamepad8Pressed = true;
	gamepadWasPressed = (btn) => (btn === 8 ? mockGamepad8Pressed : false);

	// Gamepad 8 press toggles visibility OFF and sets g_lastInputGamepad = true
	gameUpdate();
	mockGamepad8Pressed = false;
	assert.strictEqual(g_cheatsheetVisible, false, 'Gamepad button 8 must toggle g_cheatsheetVisible to false');
	assert.strictEqual(g_lastInputGamepad, true, 'Gamepad button 8 must set g_lastInputGamepad = true');

	// Press Gamepad 8 again to toggle ON while in gamepad mode
	mockGamepad8Pressed = true;
	gameUpdate();
	mockGamepad8Pressed = false;
	for (let i = 0; i < 7; i++) gameUpdate();
	clearDrawCalls();
	g_apgManager.renderCheatSheet(1920, 1080, 27);
	assert.ok(
		getFillTextCalls().some(t => t.text === 'TWITCH COMMANDS [SELECT]'),
		'D-22: Header must display TWITCH COMMANDS [SELECT] when gamepad input was last used'
	);

	// Press keyboard key -> switches prompt back to [C]
	gamepadWasPressed = origGamepadWasPressed;
	inputData[0][32] = 3;
	gameUpdate();
	inputData[0][32] = 0;
	assert.strictEqual(g_lastInputGamepad, false, 'Keyboard input must set g_lastInputGamepad = false');
	clearDrawCalls();
	g_apgManager.renderCheatSheet(1920, 1080, 27);
	assert.ok(
		getFillTextCalls().some(t => t.text === 'TWITCH COMMANDS [C]'),
		'D-22: Header must display TWITCH COMMANDS [C] when keyboard input was last used'
	);

	// 3e: Sandboxed localStorage exception resilience (D-35)
	setStorageThrowMode(true);
	assert.strictEqual(safeGetPref('da_cheatsheet_visible', '1'), '1', 'safeGetPref must return fallback when localStorage throws');
	assert.doesNotThrow(() => safeSetPref('da_cheatsheet_visible', '0'), 'safeSetPref must not throw when localStorage is restricted');
	setStorageThrowMode(false);
	updateStatePlaying = origUpdateStatePlaying;
	console.log('  Passed: Hotkey state machine, Shift+C disambiguation, [C]/[SELECT] prompt switching, and storage resilience verified.');

	// -------------------------------------------------------------
	// Simulation 4: Canvas 2D Context Save/Restore Stack Balance Across 50 Render Cycles
	// -------------------------------------------------------------
	console.log('[Sim 4] Canvas 2D save/restore context stack balance across 50 multi-state render cycles...');
	const sStart = saveCalls();
	const rStart = restoreCalls();

	for (let cycle = 0; cycle < 50; cycle++) {
		frame = 200 + cycle;
		// Vary states across expanded, sliding, collapsed, command pulsing, and major event flare
		if (cycle % 10 === 0) {
			g_cheatsheetSlideProgress = 0;
		} else if (cycle % 5 === 0) {
			g_cheatsheetSlideProgress = 0.45;
		} else {
			g_cheatsheetSlideProgress = 1.0;
		}
		g_cheatsheetDock = (cycle % 2 === 0) ? 'right' : 'left';
		g_apgManager.commandPulseFrames['ammo'] = (cycle % 3 === 0) ? 35 : 0;
		g_apgManager.commandPulseFrames['boss'] = (cycle % 4 === 0) ? 20 : 0;
		if (cycle % 7 === 0) {
			g_apgManager.triggerCheatSheetFlare('#FF4D4D', 15);
		}

		const sBefore = saveCalls();
		const rBefore = restoreCalls();
		g_apgManager.renderCheatSheet(1920, 1080, 27);
		assert.strictEqual(
			saveCalls() - sBefore,
			restoreCalls() - rBefore,
			'Cycle ' + cycle + ': renderCheatSheet save/restore net deviation must be 0'
		);
	}
	assert.strictEqual(
		saveCalls() - sStart,
		restoreCalls() - rStart,
		'Cumulative save/restore net deviation across 50 render cycles must be 0'
	);
	g_cheatsheetSlideProgress = 1.0;
	g_cheatsheetDock = 'right';
	g_apgManager.commandPulseFrames = {};
	g_apgManager.cheatSheetFlare = { color: null, frames: 0, maxFrames: 0 };
	console.log('  Passed: 0 net Canvas 2D context stack deviation across 50 heterogeneous render cycles.');

	// -------------------------------------------------------------
	// Simulation 5: Interactive Button Hitboxes (Pause Menu & Start Screen Exit Button) (D-23..D-26)
	// -------------------------------------------------------------
	console.log('[Sim 5] Interactive button hitboxes for Pause Menu controls and Start Screen [ EXIT GAME ]...');
	mockCanvas.width = 1920;
	mockCanvas.height = 1080;
	mainCanvasSize = vec2(1920, 1080);
	const W = 1920;
	const H = 1080;
	const cx = W / 2;

	// 5a: Pause Menu Buttons
	g_state = STATE_PLAYING;
	g_isPaused = true;
	g_startHelpOpen = false;
	g_cheatsheetVisible = true;
	g_cheatsheetDock = 'right';

	// Click Button 1: [C] CHEAT-SHEET: [ON / OFF] at H * 0.56
	mousePosScreen = { x: cx, y: H * 0.56 };
	inputData[0][0] = 3;
	gameRenderPost();
	inputData[0][0] = 0;
	assert.strictEqual(g_cheatsheetVisible, false, 'Clicking Pause Menu [C] CHEAT-SHEET button must toggle g_cheatsheetVisible to false');
	assert.strictEqual(getStorageItem('da_cheatsheet_visible'), '0', 'Clicking Pause Menu [C] CHEAT-SHEET button must persist preference');

	// Click Button 2: [DOCK: RIGHT / LEFT] at H * 0.62
	mousePosScreen = { x: cx, y: H * 0.62 };
	inputData[0][0] = 3;
	gameRenderPost();
	inputData[0][0] = 0;
	assert.strictEqual(g_cheatsheetDock, 'left', 'Clicking Pause Menu [DOCK] button must flip g_cheatsheetDock to "left"');
	assert.strictEqual(getStorageItem('da_cheatsheet_dock'), 'left', 'Clicking Pause Menu [DOCK] button must persist dock preference');

	// Click Button 3: [ QUIT TO MAIN MENU ] at H * 0.68
	g_enemies = [{ hp: 2 }];
	mousePosScreen = { x: cx, y: H * 0.68 };
	inputData[0][0] = 3;
	gameRenderPost();
	inputData[0][0] = 0;
	assert.strictEqual(g_isPaused, false, 'Clicking [ QUIT TO MAIN MENU ] must unpause and initiate run abandonment');
	assert.strictEqual(g_enemies.length, 0, 'Clicking [ QUIT TO MAIN MENU ] must purge active g_enemies array');

	// 5b: Start Screen [ EXIT GAME ] Button at H * 0.88
	g_state = STATE_CLICK_TO_START;
	g_startHelpOpen = false;
	g_startLaunchTimer = 0;
	g_startFlashFrames = 0;
	resetExitCalls();

	mousePosScreen = { x: cx, y: H * 0.88 };
	updateStartScreen();
	assert.strictEqual(g_startHoverExit, true, 'Hovering (cx, H * 0.88) must set g_startHoverExit = true');
	assert.strictEqual(mockCanvas.style.cursor, 'pointer', 'Hovering [ EXIT GAME ] must set pointer cursor');

	inputData[0][0] = 3;
	updateStartScreen();
	inputData[0][0] = 0;
	assert.strictEqual(wasExitAppCalled(), true, 'Clicking [ EXIT GAME ] on desktop must invoke window.electronAPI.exitApp()');
	assert.strictEqual(g_startLaunchTimer, 0, 'Clicking [ EXIT GAME ] must NOT start game launch timer');
	assert.strictEqual(g_startFlashFrames, 0, 'Clicking [ EXIT GAME ] must NOT trigger launch flash frames');
	console.log('  Passed: Pause Menu buttons ([C] CHEAT-SHEET, [DOCK], [ QUIT TO MAIN MENU ]) and Start Screen [ EXIT GAME ] hitboxes verified.');
`;

vm.runInContext(simulationScript, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 22 AUTOMATED TESTS PASSED CLEANLY (100% GREEN)');
console.log('=============================================================\n');
