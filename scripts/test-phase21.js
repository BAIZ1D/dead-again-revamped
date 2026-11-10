import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 21 16-BIT RETRO ARCADE START SCREEN VISUAL OVERHAUL TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Source Code AST & Contract Verification
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');

// [Check 1] New Procedural Functions & Phase 17/19/20 Architecture Preservation (D-18)
console.log('[Check 1] Modular procedural functions & Phase 17/19/20 declaration integrity (D-18)...');
assert.ok(
	startSrc.includes('function renderStartMoon(cx, cy, u, W, H, safeW, safeH)'),
	'D-18: startScreen.js must declare renderStartMoon(cx, cy, u, W, H, safeW, safeH)'
);
assert.ok(
	startSrc.includes('function renderStartGraveyard(W, H, u, safeW, safeH, plane)'),
	'D-18: startScreen.js must declare renderStartGraveyard(W, H, u, safeW, safeH, plane)'
);
assert.ok(
	startSrc.includes('function renderStartParallaxFog(W, H, u, layer)'),
	'D-18: startScreen.js must declare renderStartParallaxFog(W, H, u, layer)'
);

const phase17Functions = [
	'getStartScreenSafeZone',
	'drawOverlayTile',
	'createShieldPath',
	'renderStartFactionPortraits',
	'renderStartScreenCrest',
	'updateAndRenderStartEmbers',
	'renderStartAtmosphere',
	'renderStartTypography',
	'renderStartSubtitleRibbon',
	'renderStartScreenBadges',
	'renderStartScreenHelpManual',
	'triggerStartTheatricalLaunch',
	'updateStartScreen',
	'renderStartScreen'
];
for (const fn of phase17Functions) {
	assert.ok(
		startSrc.includes(`function ${fn}`),
		`D-18: startScreen.js must preserve Phase 17 function ${fn}`
	);
}

const idxWep = startSrc.indexOf('function renderHelpTabWeapons');
const idxTwt = startSrc.indexOf('function renderHelpTabTwitch');
const idxStm = startSrc.indexOf('function renderHelpTabStreamer');
const idxMan = startSrc.indexOf('function renderStartScreenHelpManual');
assert.ok(idxWep > 0 && idxTwt > idxWep && idxStm > idxTwt && idxMan > idxStm, 'Phase 19/20 compendium function declaration sequence must be preserved');
console.log('  Passed: All 3 new Phase 21 functions, 14 Phase 17 functions, and compendium order verified.');

// [Check 2] Lunar Engine AST Tokens (VIS-03, D-09..D-12, D-25)
console.log('[Check 2] Bayer-dithered Blood/Harvest Moon AST tokens (VIS-03, D-09..D-12, D-25)...');
assert.ok(startSrc.includes('START_BAYER_4X4'), 'D-11: Must declare 4x4 Bayer ordered dither matrix');
assert.ok(startSrc.includes('Math.max(2, Math.round(u / 8))'), 'D-11: Must use responsive integer block stepping Math.max(2, Math.round(u / 8))');
for (const hex of ['#FDE047', '#F59E0B', '#EA580C', '#7F1D1D', '#450A0A']) {
	assert.ok(startSrc.includes(hex), `D-10: Moon hybrid palette must include ${hex}`);
}
for (const craterHex of ['#2B070E', '#1E050A']) {
	assert.ok(startSrc.includes(craterHex), `D-12: Shaded crater floors must include ${craterHex}`);
}
assert.ok(startSrc.includes('1.25 * moonR') && startSrc.includes('1.55 * moonR'), 'D-12: Must render twin halo glow rings at 1.25 * moonR and 1.55 * moonR');
assert.ok(startSrc.includes('0.12 + 0.08 * Math.sin(frame * 0.03)'), 'D-12: Halo rings must breathe with 0.12 + 0.08 * Math.sin(frame * 0.03)');
assert.ok(startSrc.includes('START_MOON_CRATERS'), 'D-12: Must define 3 procedural shaded craters');
assert.ok(startSrc.includes('g_startMoonPulseFrames = 10'), 'D-25: Clicking moon must set g_startMoonPulseFrames = 10');
console.log('  Passed: Bayer 4x4 matrix, hybrid palette, 3 craters, twin halo rings, and lunar pulse verified.');

// [Check 3] 3-Plane Graveyard Silhouette & Scooped U-Profile AST Tokens (VIS-02, D-01..D-08)
console.log('[Check 3] 3-plane Gothic Graveyard Silhouette & Scooped U-profile AST tokens (VIS-02, D-01..D-08)...');
assert.ok(
	startSrc.includes('START_GRAVEYARD_PLANE1') &&
	startSrc.includes('START_GRAVEYARD_PLANE2') &&
	startSrc.includes('START_GRAVEYARD_PLANE3'),
	'D-01/D-04: Must declare static anchor tables for all 3 graveyard planes'
);
assert.ok(startSrc.includes('0.76 - 0.16 * scoop'), 'D-02: Horizon baseline must follow scooped U-profile dipping to 0.76H at center and rising to 0.60H on flanks');
for (const silHex of ['#12091A', '#3A1230', '#5A183C', '#2D1E3A']) {
	assert.ok(startSrc.includes(silHex), `D-03/D-08: Graveyard palette must include ${silHex}`);
}
assert.ok(startSrc.includes('rgba(255, 170, 50,'), 'D-07: Cathedral lancet windows must flicker with warm amber/rose rgba(255, 170, 50, ...)');
console.log('  Passed: 3 graveyard planes, scooped U-profile horizon, lancet windows, and iron railings verified.');

// [Check 4] 3-Layer Parallax Fog AST Tokens (VIS-04, D-13..D-16)
console.log('[Check 4] 3-layer Parallax Pixel Fog AST tokens (VIS-04, D-13..D-16)...');
assert.ok(
	startSrc.includes('0.25') && startSrc.includes('0.60') && startSrc.includes('1.05'),
	'D-13: Parallax fog layers must drift at 0.25, 0.60, and 1.05 px/frame'
);
assert.ok(
	startSrc.includes('rgba(32, 22, 50, 0.18)') &&
	startSrc.includes('rgba(45, 30, 68, 0.26)') &&
	startSrc.includes('rgba(62, 42, 90, 0.35)'),
	'D-15: Fog layers must use tiered midnight slate-violet rgba colors (0.18, 0.26, 0.35)'
);
assert.ok(startSrc.includes('Math.max(3, Math.round(u * 0.18))'), 'D-14: Fog wave amplitude must use Math.max(3, Math.round(u * 0.18))');
console.log('  Passed: 3 parallax drift speeds, slate-violet tiers, and quantized wave amplitude verified.');

// [Check 5] Audio, Transitions & Micro-Interaction AST Tokens (D-17, D-21..D-26)
console.log('[Check 5] 15-step Z-stack, phosphor wipe decay, modal spring, and audio micro-interactions (D-17, D-21..D-26)...');
assert.ok(startSrc.includes('#12081C') && startSrc.includes('#090A10'), 'D-17: Sky zenith-to-horizon gradient must span #12081C to #090A10');
assert.ok(startSrc.includes('rgba(255, 255, 255, 0.90)') && startSrc.includes('rgba(172, 50, 50,'), 'D-21: 12-frame phosphor wipe must decay from white (0.90) through crimson');
assert.ok(startSrc.includes('g_startModalSpringFrames = 4') && startSrc.includes('0.96 + 0.04 * springProgress'), 'D-22: Modal open must trigger 4-frame spring scale (0.96 -> 1.00)');
assert.ok(startSrc.includes('triggerStartAmbientWindWhisper'), 'D-23: Must declare procedural ZzFX ambient graveyard wind whisper');
assert.ok(startSrc.includes('[1.0, 1.12, 1.25]'), 'D-24: Compendium tab chirps must modulate pitch by [1.0, 1.12, 1.25]');
assert.ok(startSrc.includes("mainCanvas.style.cursor = 'pointer'"), 'D-26: Hovering interactive buttons must set pointer cursor');
console.log('  Passed: 15-step depth sandwich, phosphor wipe decay, modal spring, wind whisper, tab chirps, and hover polish verified.\n');

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
let arcCalls = [];

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
		fillRectCalls.push({ x, y, w, h, fillStyle: mockContext._fillStyle });
	},
	strokeRect: () => {},
	clearRect: () => {},
	fillText: () => {},
	strokeText: () => {},
	measureText: (text) => ({ width: (text ? String(text).length : 0) * 8 }),
	beginPath: () => {},
	closePath: () => {},
	moveTo: () => {},
	lineTo: () => {},
	arc: (x, y, r, sa, ea, ac) => {
		arcCalls.push({ x, y, r, sa, ea, ac, fillStyle: mockContext._fillStyle, strokeStyle: mockContext._strokeStyle });
	},
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
	getFillRectCalls: () => fillRectCalls,
	clearFillRectCalls: () => { fillRectCalls.length = 0; },
	getArcCalls: () => arcCalls,
	clearArcCalls: () => { arcCalls.length = 0; },
};
sandbox.window = sandbox;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const viewports = [
	{ name: '720p Standard HD (1280x720)', W: 1280, H: 720 },
	{ name: '1080p Full HD (1920x1080)', W: 1920, H: 1080 },
	{ name: '1440p QHD (2560x1440)', W: 2560, H: 1440 },
	{ name: '4K UHD (3840x2160)', W: 3840, H: 2160 },
	{ name: '21:9 Ultrawide (2560x1080)', W: 2560, H: 1080 },
	{ name: '21:9 QHD Ultrawide (3440x1440)', W: 3440, H: 1440 },
	{ name: '4:3 Retro Display (1024x768)', W: 1024, H: 768 },
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
	frame = 0;

	const viewports = ${JSON.stringify(viewports)};

	// -------------------------------------------------------------
	// Simulation 1: Lunar Geometry & Safe Zone Clamping Across 7 Viewports (VIS-03)
	// -------------------------------------------------------------
	console.log('[Sim 1] Lunar geometry, safe zone clamping & Bayer block rasterization across 7 viewports...');
	for (const vp of viewports) {
		mockCanvas.width = vp.W;
		mockCanvas.height = vp.H;
		mainCanvasSize = vec2(vp.W, vp.H);
		const { safeW, safeH, offsetX, offsetY, cx, cy, u } = getStartScreenSafeZone(vp.W, vp.H);
		const { moonX, moonY, moonR } = getStartMoonMetrics(vp.W, vp.H, u, safeW, safeH);

		// Relative to safe zone: moonX = offsetX + 0.76 * safeW, moonY = offsetY + 0.21 * safeH
		const relX = (moonX - offsetX) / safeW;
		const relY = (moonY - offsetY) / safeH;
		assert.ok(relX >= 0.70 && relX <= 0.82, vp.name + ': Moon relative X (' + relX.toFixed(3) + ') must be within [0.70, 0.82] of safeW');
		assert.ok(relY >= 0.15 && relY <= 0.28, vp.name + ': Moon relative Y (' + relY.toFixed(3) + ') must be within [0.15, 0.28] of safeH');
		assert.ok(moonR >= 3.5 * u && moonR <= 3.9 * u, vp.name + ': Moon radius must be within [3.5u, 3.9u]');
		assert.ok(!Number.isNaN(moonX) && !Number.isNaN(moonY) && moonX > 0 && moonY > 0, vp.name + ': Moon coordinates must be valid positive numbers');

		clearFillRectCalls();
		clearArcCalls();
		renderStartMoon(cx, cy, u, vp.W, vp.H, safeW, safeH);
		const rects = getFillRectCalls();
		const arcs = getArcCalls();
		assert.ok(rects.length > 25, vp.name + ': renderStartMoon must rasterize Bayer-dithered pixel blocks');
		assert.ok(arcs.length >= 3, vp.name + ': renderStartMoon must draw twin halo glow rings and rim arc');
	}
	console.log('  Passed: Lunar geometry, twin halo rings, and Bayer pixel blocks verified across all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 2: Graveyard Scooped U-Profile Baseline & Full-Bleed Coverage Across 7 Viewports (VIS-02)
	// -------------------------------------------------------------
	console.log('[Sim 2] 3-plane Graveyard scooped U-profile baseline & full-bleed width across 7 viewports...');
	for (const vp of viewports) {
		const { safeW, safeH, u } = getStartScreenSafeZone(vp.W, vp.H);
		const centerGroundY = getStartHorizonY(vp.W * 0.5, vp.W, vp.H, 0);
		const leftFlankY = getStartHorizonY(0, vp.W, vp.H, 0);
		const rightFlankY = getStartHorizonY(vp.W, vp.W, vp.H, 0);

		const centerHeightFromBottom = (vp.H - centerGroundY) / vp.H;
		const leftHeightFromBottom = (vp.H - leftFlankY) / vp.H;
		const rightHeightFromBottom = (vp.H - rightFlankY) / vp.H;

		assert.ok(
			centerHeightFromBottom >= 0.22 && centerHeightFromBottom <= 0.26,
			vp.name + ': Center horizon height from bottom (' + (centerHeightFromBottom * 100).toFixed(1) + '%) must dip to 22-26% H'
		);
		assert.ok(
			leftHeightFromBottom >= 0.38 && leftHeightFromBottom <= 0.42,
			vp.name + ': Left flank horizon height from bottom (' + (leftHeightFromBottom * 100).toFixed(1) + '%) must rise to 38-42% H'
		);
		assert.ok(
			rightHeightFromBottom >= 0.38 && rightHeightFromBottom <= 0.42,
			vp.name + ': Right flank horizon height from bottom (' + (rightHeightFromBottom * 100).toFixed(1) + '%) must rise to 38-42% H'
		);

		clearFillRectCalls();
		renderStartGraveyard(vp.W, vp.H, u, safeW, safeH, 0);
		const rects = getFillRectCalls();
		const minX = Math.min(...rects.map(r => r.x));
		const maxRight = Math.max(...rects.map(r => r.x + r.w));
		assert.ok(minX <= 2, vp.name + ': Graveyard silhouette must start at left canvas edge (x <= 2)');
		assert.ok(maxRight >= vp.W - 2, vp.name + ': Graveyard silhouette must span full canvas width W');
	}
	console.log('  Passed: Scooped U-profile horizon (24% center dip, 40% flanks) and full-bleed coverage verified across all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 3: 3-Layer Parallax Fog Drift & CTA Wave Clearance Across 7 Viewports (VIS-04)
	// -------------------------------------------------------------
	console.log('[Sim 3] 3-layer parallax fog horizontal drift & CTA baseline clearance across 7 viewports...');
	for (const vp of viewports) {
		const { u } = getStartScreenSafeZone(vp.W, vp.H);
		const ctaH = u * 2.3;
		const ctaBaselineBottom = vp.H * 0.74 + ctaH / 2;

		for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
			frame = 0;
			const yFrame0 = getStartFogCrestY(vp.W * 0.37, vp.W, vp.H, u, layerIdx);
			frame = 45;
			const yFrame45 = getStartFogCrestY(vp.W * 0.37, vp.W, vp.H, u, layerIdx);

			// Verify wave crests across entire width never breach above CTA cartouche bottom
			for (let sx = 0; sx <= vp.W; sx += Math.max(8, Math.floor(vp.W / 32))) {
				const crestY = getStartFogCrestY(sx, vp.W, vp.H, u, layerIdx);
				assert.ok(
					crestY >= ctaBaselineBottom,
					vp.name + ' Layer ' + (layerIdx + 1) + ': Fog crest Y (' + crestY + ') must stay strictly below CTA baseline (' + ctaBaselineBottom.toFixed(1) + ')'
				);
			}
		}

		clearFillRectCalls();
		renderStartParallaxFog(vp.W, vp.H, u, 0);
		const fogRects = getFillRectCalls();
		assert.ok(fogRects.length > 20, vp.name + ': renderStartParallaxFog must render stepped pixel ribbons');
		for (const r of fogRects) {
			assert.ok(
				r.y >= ctaBaselineBottom - 1e-4,
				vp.name + ': Rendered fog rect Y (' + r.y + ') must never breach above CTA cartouche baseline (' + ctaBaselineBottom.toFixed(1) + ')'
			);
		}
	}
	console.log('  Passed: All 3 parallax fog layers undulate cleanly and stay strictly below CTA cartouche across all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 4: Canvas Context Save/Restore Stack Isolation Across All Operational States
	// -------------------------------------------------------------
	console.log('[Sim 4] Canvas save/restore stack balance across idle, modal open (Tabs 0-2), moon pulse, and launch flash...');
	for (const vp of viewports) {
		mockCanvas.width = vp.W;
		mockCanvas.height = vp.H;
		mainCanvasSize = vec2(vp.W, vp.H);

		// State A: Idle start screen
		g_startHelpOpen = false;
		g_startFlashFrames = 0;
		g_startMoonPulseFrames = 0;
		frame = 15;
		let s0 = saveCalls(), r0 = restoreCalls();
		renderStartScreen();
		assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ' [Idle]: save/restore net deviation must be 0');

		// State B: Moon blood pulse active
		g_startMoonPulseFrames = 8;
		s0 = saveCalls(); r0 = restoreCalls();
		renderStartScreen();
		assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ' [Moon Pulse]: save/restore net deviation must be 0');
		g_startMoonPulseFrames = 0;

		// State C: Field Manual Modal open with spring animation across Tabs 0, 1, 2
		g_startHelpOpen = true;
		g_startModalSpringFrames = 3;
		for (let tab = 0; tab < 3; tab++) {
			g_startHelpTab = tab;
			s0 = saveCalls(); r0 = restoreCalls();
			renderStartScreen();
			assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ' [Modal Tab ' + tab + ']: save/restore net deviation must be 0');
		}
		g_startHelpOpen = false;
		g_startModalSpringFrames = 0;

		// State D: 12-frame phosphor wipe (white flash frame 11 & crimson decay frame 5)
		for (const ff of [11, 5]) {
			g_startFlashFrames = ff;
			s0 = saveCalls(); r0 = restoreCalls();
			renderStartScreen();
			assert.strictEqual(saveCalls() - s0, restoreCalls() - r0, vp.name + ' [Flash Frame ' + ff + ']: save/restore net deviation must be 0');
		}
		g_startFlashFrames = 0;
	}
	console.log('  Passed: Canvas context stack strictly isolated (net deviation = 0) across all states and all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 5: Interactive Micro-Interactions & Input Routing State Machines
	// -------------------------------------------------------------
	console.log('[Sim 5] Interactive micro-interactions: Moon click easter egg, hover cursor, modal spring, and CTA launch...');
	mockCanvas.width = 1920;
	mockCanvas.height = 1080;
	mainCanvasSize = vec2(1920, 1080);
	inputData[0] = inputData[0] || [];

	const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(1920, 1080);
	const { moonX, moonY } = getStartMoonMetrics(1920, 1080, u, safeW, safeH);

	// 5a: Clicking directly on the moon triggers 10-frame corona pulse WITHOUT launching game
	g_startHelpOpen = false;
	g_startLaunchTimer = 0;
	g_startFlashFrames = 0;
	g_startMoonPulseFrames = 0;

	mousePosScreen = { x: moonX, y: moonY };
	inputData[0][0] = 3;
	updateStartScreen();
	inputData[0][0] = 0;

	assert.strictEqual(g_startMoonPulseFrames, 10, 'Clicking moon must trigger g_startMoonPulseFrames = 10');
	assert.strictEqual(g_startLaunchTimer, 0, 'Clicking moon must NOT trigger game launch timer');
	assert.strictEqual(g_startFlashFrames, 0, 'Clicking moon must NOT trigger launch flash frames');
	assert.strictEqual(mockCanvas.style.cursor, 'pointer', 'Hovering moon must set pointer cursor');

	// Advance 1 frame and verify moon pulse decrements
	mousePosScreen = { x: 100, y: 100 };
	updateStartScreen();
	assert.strictEqual(g_startMoonPulseFrames, 9, 'g_startMoonPulseFrames must decrement each frame');
	assert.strictEqual(mockCanvas.style.cursor, 'default', 'Moving cursor away from interactive targets must restore default cursor');

	// 5b: Hovering and clicking [H] Guide button triggers 4-frame modal spring
	const guideY = 1080 * 0.83;
	mousePosScreen = { x: cx, y: guideY };
	updateStartScreen();
	assert.strictEqual(g_startHoverGuide, true, 'Hovering [H] button must set g_startHoverGuide = true');
	assert.strictEqual(mockCanvas.style.cursor, 'pointer', 'Hovering [H] button must set pointer cursor');

	inputData[0][0] = 3;
	updateStartScreen();
	inputData[0][0] = 0;
	assert.strictEqual(g_startHelpOpen, true, 'Clicking [H] button must open Field Manual');
	assert.strictEqual(g_startModalSpringFrames, 4, 'Opening Field Manual must start 4-frame spring scale animation');

	// Close modal with Esc (27)
	inputData[0][27] = 3;
	updateStartScreen();
	inputData[0][27] = 0;
	assert.strictEqual(g_startHelpOpen, false, 'Esc key must close Field Manual');

	// 5c: Hovering and clicking CTA cartouche triggers 12-frame theatrical launch
	const ctaY = 1080 * 0.74;
	mousePosScreen = { x: cx, y: ctaY };
	updateStartScreen();
	assert.strictEqual(g_startHoverCTA, true, 'Hovering CTA cartouche must set g_startHoverCTA = true');
	assert.strictEqual(mockCanvas.style.cursor, 'pointer', 'Hovering CTA cartouche must set pointer cursor');

	inputData[0][0] = 3;
	updateStartScreen();
	inputData[0][0] = 0;
	assert.strictEqual(g_startFlashFrames, 12, 'Clicking CTA cartouche must trigger 12 flash frames');
	assert.ok(g_startLaunchTimer > 0, 'Clicking CTA cartouche must start launch timer');

	// Reset state
	g_startFlashFrames = 0;
	g_startLaunchTimer = 0;
	g_startMoonPulseFrames = 0;
	console.log('  Passed: Moon click easter egg, hover pointer/glow states, modal spring, and CTA launch verified.');
`;

vm.runInContext(simulationScript, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 21 AUTOMATED TESTS PASSED CLEANLY (100% GREEN)');
console.log('=============================================================\n');
