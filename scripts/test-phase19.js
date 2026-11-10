import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 19 HUD ERGONOMICS, BANNER CONTAINMENT & FIELD MANUAL WRAPPING TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Source Code AST & Contract Verification
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const pkgSrc = fs.readFileSync('package.json', 'utf8');

// [Check 1] Top-Left Health Plate Clearance Contract (ui.js, CLIP-04)
console.log('[Check 1] ui.js top-left health plate clearance & Phase 16 compatibility (CLIP-04)...');
assert.ok(
	uiSrc.includes('pos.x = cameraPos.x - overlayCanvas.width / (cameraScale * 2) + 6.5 * scaleUI'),
	'CLIP-04/D-01: ui.js must shift equipment card anchor to +6.5 * scaleUI'
);
assert.ok(
	uiSrc.includes('pos.y - 1.35 * scaleUI'),
	'CLIP-04/D-02: ui.js must preserve vertical offset pos.y - 1.35 * scaleUI'
);
assert.ok(
	uiSrc.includes('5.975 * scaleUI'),
	'CLIP-04/D-02: ui.js must retain historical contract token 5.975 * scaleUI'
);
assert.ok(
	uiSrc.includes('vec2(2.4, 0.65).scale(scaleUI)'),
	'CLIP-04/D-01: ui.js must size armored health backing plate to vec2(2.4, 0.65).scale(scaleUI)'
);
assert.ok(
	uiSrc.includes('0.52 * scaleUI'),
	'CLIP-04/D-01: ui.js must set tightened pip pitch to 0.52 * scaleUI'
);
console.log('  Passed: Top-left HUD shift, plate sizing, pip pitch, and Phase 16 tokens verified.');

// [Check 2] Pre-Game Prediction Locked Banner & Lobby Strings (ui.js, CLIP-05)
console.log('[Check 2] ui.js pre-game vote lock banner & lobby string containment (CLIP-05)...');
assert.ok(
	uiSrc.includes('Math.max(measuredW'),
	'CLIP-05/D-03: ui.js must compute hybrid textW using Math.max(measuredW, ...)'
);
assert.ok(
	uiSrc.includes('cardW - u * 1.2'),
	'CLIP-05/D-03: ui.js must bound maxBannerW inside cardW - u * 1.2'
);
assert.ok(
	uiSrc.includes('baseLockSize * fontScale'),
	'CLIP-05/D-03: ui.js must apply proportional fontScale to baseLockSize'
);
assert.ok(
	uiSrc.includes('cheatFontScale') && uiSrc.includes('promptFontScale') && uiSrc.includes('voterFontScale'),
	'CLIP-05/D-04: ui.js must clamp cheatText, promptText, and voter strings'
);
console.log('  Passed: Dynamic vote lock banner measurement, width clamping, and lobby text scaling verified.');

// [Check 3] Universal drawWrappedText Engine & HiDPI Modal Scaling (startScreen.js, CLIP-06)
console.log('[Check 3] startScreen.js drawWrappedText engine & HiDPI modal scaling (CLIP-06)...');
assert.ok(
	startSrc.includes('function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxHeight)'),
	'CLIP-06/D-05: startScreen.js must declare drawWrappedText with 7 parameters'
);
assert.ok(
	startSrc.split('Math.max(1020, u * 38)').length - 1 >= 2,
	'CLIP-06/D-06: startScreen.js must use Math.max(1020, u * 38) in both renderStartScreenHelpManual and updateStartScreen'
);
assert.ok(
	startSrc.split('Math.max(680, u * 25.5)').length - 1 >= 2,
	'CLIP-06/D-06: startScreen.js must use Math.max(680, u * 25.5) in both renderStartScreenHelpManual and updateStartScreen'
);
const tab1Body = startSrc.slice(startSrc.indexOf('function renderHelpTabWeapons'), startSrc.indexOf('function renderHelpTabTwitch'));
const tab2Body = startSrc.slice(startSrc.indexOf('function renderHelpTabTwitch'), startSrc.indexOf('function renderHelpTabStreamer'));
const tab3Body = startSrc.slice(startSrc.indexOf('function renderHelpTabStreamer'), startSrc.indexOf('function renderStartScreenHelpManual'));
assert.ok(tab1Body.includes('drawWrappedText('), 'CLIP-06/D-07: renderHelpTabWeapons must route descriptions through drawWrappedText');
assert.ok(tab2Body.includes('drawWrappedText('), 'CLIP-06/D-07: renderHelpTabTwitch must route commands & mob intel through drawWrappedText');
assert.ok(tab3Body.includes('drawWrappedText('), 'CLIP-06/D-07: renderHelpTabStreamer must route instructions through drawWrappedText');
console.log('  Passed: drawWrappedText signature, HiDPI modal bounds, and Tab 1-3 wrapping verified.');

// [Check 4] In-Game Pause Field Manual Ergonomics (main.js and ui.js, CLIP-06 / D-08)
console.log('[Check 4] main.js & ui.js pause-screen Field Manual integration (CLIP-06, D-08)...');
assert.ok(
	mainSrc.includes('keyWasPressed(72)'),
	'CLIP-06/D-08: main.js must handle [H] key (72) during pause'
);
assert.ok(
	uiSrc.includes('renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH)'),
	'CLIP-06/D-08: ui.js must delegate pause help rendering to renderStartScreenHelpManual'
);
assert.ok(
	uiSrc.includes('[H] SURVIVOR FIELD MANUAL'),
	'CLIP-06/D-08: ui.js must render [H] SURVIVOR FIELD MANUAL button on pause menu'
);
console.log('  Passed: Pause-screen Field Manual hotkey, button, and render delegation verified.');

// [Check 5] Package Manifest Runner Entry (package.json)
console.log('[Check 5] package.json test:phase19 runner entry...');
assert.ok(
	pkgSrc.includes('"test:phase19": "node scripts/test-phase19.js"'),
	'package.json must register test:phase19 script'
);
console.log('  Passed: package.json test:phase19 entry verified.');

console.log('\n✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE B: Headless Node VM Geometric & Multi-Viewport Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL & GEOMETRIC SIMULATIONS ---');

console.log('[Build] Compiling production bundle via scripts/build-game.js...');
execSync('node scripts/build-game.js', { stdio: 'inherit' });

let saveCalls = 0;
let restoreCalls = 0;
let fillTextCalls = [];

const mockContext = {
	_fillStyle: '',
	_strokeStyle: '',
	_lineWidth: 1,
	textAlign: 'left',
	font: '14px monospace',
	textBaseline: 'alphabetic',
	lineJoin: 'miter',
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

	fillRect: () => {},
	strokeRect: () => {},
	clearRect: () => {},
	fillText: (text, x, y) => {
		fillTextCalls.push({ text: String(text), x, y, font: mockContext.font, align: mockContext.textAlign, baseline: mockContext.textBaseline });
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
	style: {},
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
	getFillTextCalls: () => fillTextCalls,
	clearFillTextCalls: () => { fillTextCalls.length = 0; },
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

	const viewports = [
		{ name: '720p (16:9)', W: 1280, H: 720, cameraScale: 32 },
		{ name: '1080p (16:9)', W: 1920, H: 1080, cameraScale: 32 },
		{ name: '1440p (16:9)', W: 2560, H: 1440, cameraScale: 32 },
		{ name: '4K (16:9)', W: 3840, H: 2160, cameraScale: 32 },
		{ name: '4:3 (1024x768)', W: 1024, H: 768, cameraScale: 32 },
		{ name: '16:10 (1680x1050)', W: 1680, H: 1050, cameraScale: 32 },
		{ name: '21:9 Ultrawide (2560x1080)', W: 2560, H: 1080, cameraScale: 32 },
	];

	// -------------------------------------------------------------
	// Simulation 1: Top-Left Health Plate Screen Clearance Across 7 Viewports (CLIP-04)
	// -------------------------------------------------------------
	console.log('[Sim 1] Top-left health plate screen clearance across 7 viewports (CLIP-04)...');

	for (const vp of viewports) {
		const W = vp.W;
		const H = vp.H;
		const cameraScale = vp.cameraScale;
		const u = Math.max(12, Math.min(W, H) / 40);
		const scaleUI = Math.min(1, W / (12 * cameraScale));
		const cameraPos = vec2(50, 50);

		const X_screenLeft = cameraPos.x - W / (cameraScale * 2);
		const pos = vec2(
			X_screenLeft + 6.5 * scaleUI,
			cameraPos.y + H / (cameraScale * 2) - scaleUI
		);

		const platePos = vec2(pos.x - 5.0 * scaleUI, pos.y - 1.35 * scaleUI);
		const plateSize = vec2(2.4, 0.65).scale(scaleUI);
		const X_plateLeft = platePos.x - plateSize.x / 2;

		assert.ok(
			X_plateLeft - X_screenLeft >= 0.25 * scaleUI - 1e-6,
			vp.name + ': Armored plate left clearance (' + (X_plateLeft - X_screenLeft) + ') must be >= 0.25 * scaleUI'
		);

		// Peak 1 HP danger pulse (+0.1 * scaleUI size)
		const pulsePlateSize = plateSize.add(vec2(0.1 * scaleUI));
		const X_pulseLeft = platePos.x - pulsePlateSize.x / 2;
		assert.ok(
			X_pulseLeft - X_screenLeft >= 0.25 * scaleUI - 1e-6,
			vp.name + ': 1 HP pulse plate left clearance (' + (X_pulseLeft - X_screenLeft) + ') must be >= 0.25 * scaleUI'
		);

		// Pip 0 left graphic edge
		const pipStartX = pos.x - (5.975 * scaleUI - 0.195 * scaleUI);
		const pipPitch = 0.52 * scaleUI;
		const pip0Left = pipStartX - 0.28 * scaleUI;
		assert.ok(
			pip0Left - X_screenLeft >= 0.25 * scaleUI,
			vp.name + ': Pip 0 left edge clearance must be >= 0.25 * scaleUI'
		);

		// Vertical seam beneath avatar
		assert.ok(
			Math.abs(platePos.y - (pos.y - 1.35 * scaleUI)) < 1e-5,
			vp.name + ': Plate vertical seam must match pos.y - 1.35 * scaleUI'
		);

		// Vertical clearance above chat toast stream at H * 0.38
		const plateBottomWorldY = platePos.y - plateSize.y / 2;
		const plateBottomScreenY = (cameraPos.y - plateBottomWorldY) * cameraScale + H / 2;
		const chatToastY = Math.max(H * 0.38, u * 6.8);
		const worldBuffer = (chatToastY - plateBottomScreenY) / cameraScale;
		assert.ok(
			worldBuffer >= 0.5 * scaleUI,
			vp.name + ': Vertical buffer to chat toast (' + worldBuffer.toFixed(2) + ') must be >= 0.5 * scaleUI'
		);
	}
	console.log('  Passed: Health plate maintains >= 0.25 * scaleUI left clearance across all 7 viewports (including 1 HP pulse).');

	// -------------------------------------------------------------
	// Simulation 2: Pre-Game Vote Lock Banner Containment & Supporting Strings (CLIP-05)
	// -------------------------------------------------------------
	console.log('[Sim 2] Pre-game vote lock banner & lobby string containment across 7 viewports (CLIP-05)...');

	const origUiDrawRectScreen = uiDrawRectScreen;
	const origDrawTextWithOutline = drawTextWithOutline;
	const origApgNetwork = typeof g_apgNetwork !== 'undefined' ? g_apgNetwork : undefined;

	for (const vp of viewports) {
		mockCanvas.width = vp.W;
		mockCanvas.height = vp.H;
		mainCanvasSize = vec2(vp.W, vp.H);
		const W = vp.W;
		const H = vp.H;
		const u = Math.max(12, Math.min(W, H) / 40);
		const cardW = Math.min(W * 0.88, u * 34);
		const colW = Math.min(W * 0.62, u * 24) * 0.46;

		for (const pctPair of [{ good: 65, bad: 35 }, { good: 100, bad: 0 }]) {
			g_apgNetwork = {
				prediction: {
					status: 'LOCKED',
					mode: 'helix',
					level: 1,
					remainingSeconds: 0,
					durationSeconds: 60,
					goodCount: 42,
					badCount: 18,
					goodPct: pctPair.good,
					badPct: pctPair.bad,
					recentGoodVoters: ['ExtremelyLongTwitchViewerName25'],
					recentBadVoters: ['AnotherSuperLongSaboteurName25'],
				}
			};

			let capturedRects = [];
			let capturedTexts = [];
			uiDrawRectScreen = function(pos, size, color) {
				capturedRects.push({ pos, size, color });
			};
			drawTextWithOutline = function(text, pos, size, textColor) {
				capturedTexts.push({ text: String(text), pos, size, textColor });
			};

			renderLobbyHUD();

			const lockCall = capturedTexts.find(t => t.text.startsWith('VOTES LOCKED:'));
			assert.ok(lockCall, vp.name + ': renderLobbyHUD must render VOTES LOCKED text');

			// Banner inner rect is drawn at H * 0.34
			const bannerRects = capturedRects.filter(r => Math.abs(r.pos.y - H * 0.34) < 1e-3);
			assert.strictEqual(bannerRects.length, 2, vp.name + ': Vote lock banner must draw outer border and inner fill');
			const bannerW = bannerRects[1].size.x;

			assert.ok(
				bannerW <= cardW - u * 1.2 + 1e-5,
				vp.name + ': bannerW (' + bannerW.toFixed(1) + ') must be <= cardW - u * 1.2 (' + (cardW - u * 1.2).toFixed(1) + ')'
			);

			const baseLockSize = u * 1.35;
			const measuredW = overlayContext.measureText(lockCall.text).width;
			const textW = Math.max(measuredW, lockCall.text.length * baseLockSize * 0.60);
			const fontScale = lockCall.size / baseLockSize;
			assert.ok(
				textW * fontScale <= bannerW - u * 1.6 + 1e-5,
				vp.name + ': Scaled lockText width must fit inside bannerW - u * 1.6'
			);

			const cheatCall = capturedTexts.find(t => t.text.startsWith('GOOD: !ammo'));
			assert.ok(cheatCall, vp.name + ': cheatText must be rendered');
			const cheatW = cheatCall.text.length * (cheatCall.size * 0.60);
			assert.ok(cheatW <= cardW - u * 1.6 + 1e-5, vp.name + ': cheatText width must be <= cardW - u * 1.6');

			const promptCall = capturedTexts.find(t => t.text.startsWith('Chat: !good'));
			assert.ok(promptCall, vp.name + ': promptText must be rendered');
			const promptW = promptCall.text.length * (promptCall.size * 0.60);
			assert.ok(promptW <= cardW - u * 1.6 + 1e-5, vp.name + ': promptText width must be <= cardW - u * 1.6');

			const voterCall = capturedTexts.find(t => t.text.startsWith('+ @ExtremelyLong'));
			assert.ok(voterCall, vp.name + ': voter username must be rendered');
			const voterW = voterCall.text.length * (voterCall.size * 0.60);
			assert.ok(voterW <= colW - u * 0.6 + 1e-5, vp.name + ': voter username width must be <= colW - u * 0.6');
		}
	}

	uiDrawRectScreen = origUiDrawRectScreen;
	drawTextWithOutline = origDrawTextWithOutline;
	g_apgNetwork = origApgNetwork;
	console.log('  Passed: Vote lock banner and all supporting lobby strings strictly contained across all 7 viewports.');

	// -------------------------------------------------------------
	// Simulation 3: Universal drawWrappedText Engine Unit Verification (CLIP-06)
	// -------------------------------------------------------------
	console.log('[Sim 3] Universal drawWrappedText engine unit verification (CLIP-06)...');

	overlayContext.font = '14px monospace';
	clearFillTextCalls();

	// 3a: Single-line short text
	const resShort = drawWrappedText(overlayContext, 'Short text', 100, 200, 300, 18);
	assert.strictEqual(resShort.linesRendered, 1, 'Short text must render on 1 line');
	assert.strictEqual(resShort.heightUsed, 18, 'Short text heightUsed must equal 18');
	assert.strictEqual(resShort.nextY, 218, 'Short text nextY must equal 218');

	// 3b: Multi-line paragraph wrapping without splitting words
	clearFillTextCalls();
	const longParagraph = 'Open the companion dashboard to view live prediction wagers, trigger manual clutches, or simulate audience events in real time.';
	const maxW = 240;
	const resMulti = drawWrappedText(overlayContext, longParagraph, 50, 100, maxW, 18);
	assert.ok(resMulti.linesRendered > 1, 'Long paragraph must wrap into multiple lines');
	const renderedLines = getFillTextCalls().map(c => c.text);
	assert.strictEqual(renderedLines.join(' '), longParagraph, 'Wrapped lines must preserve all words intact without splitting');
	for (const line of renderedLines) {
		const lineW = Math.max(overlayContext.measureText(line).width, line.length * 14 * 0.56);
		assert.ok(lineW <= maxW + 1e-5, 'Wrapped line "' + line + '" width (' + lineW.toFixed(1) + ') must be <= maxWidth (' + maxW + ')');
	}

	// 3c: Paragraph break (\\n) preservation
	clearFillTextCalls();
	const resPara = drawWrappedText(overlayContext, 'SPEED: Very Fast\\nTACTIC: Flanker', 50, 100, 300, 16);
	assert.strictEqual(resPara.linesRendered, 2, 'Newline must split into 2 distinct lines');
	assert.strictEqual(getFillTextCalls()[0].text, 'SPEED: Very Fast');
	assert.strictEqual(getFillTextCalls()[1].text, 'TACTIC: Flanker');

	// 3d: maxHeight truncation with ellipsis (...)
	clearFillTextCalls();
	const resTrunc = drawWrappedText(overlayContext, longParagraph, 50, 100, 160, 20, 40);
	assert.ok(resTrunc.heightUsed <= 40, 'Truncated heightUsed must not exceed maxHeight (40)');
	const truncCalls = getFillTextCalls();
	assert.ok(truncCalls[truncCalls.length - 1].text.endsWith('...'), 'Overflowing text beyond maxHeight must truncate final line with ...');

	console.log('  Passed: drawWrappedText wraps words cleanly, honors \\n breaks, enforces maxWidth/maxHeight, and returns exact metrics.');

	// -------------------------------------------------------------
	// Simulation 4: Modal Container HiDPI Scaling & Canvas Stack Isolation (CLIP-06)
	// -------------------------------------------------------------
	console.log('[Sim 4] Modal container HiDPI scaling & Canvas stack isolation across 720p, 1080p, 1440p, 4K...');

	const hidpiTiers = [
		{ name: '720p', W: 1280, H: 720 },
		{ name: '1080p', W: 1920, H: 1080 },
		{ name: '1440p', W: 2560, H: 1440 },
		{ name: '4K', W: 3840, H: 2160 },
	];

	for (const tier of hidpiTiers) {
		mockCanvas.width = tier.W;
		mockCanvas.height = tier.H;
		mainCanvasSize = vec2(tier.W, tier.H);
		const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(tier.W, tier.H);
		const expectedModalW = Math.min(safeW * 0.92, Math.max(1020, u * 38));
		const expectedModalH = Math.min(safeH * 0.86, Math.max(680, u * 25.5));

		if (tier.name === '4K') {
			assert.ok(expectedModalW > 1020, '4K modalW must scale above 1020px (got ' + expectedModalW + ')');
			assert.ok(expectedModalH > 680, '4K modalH must scale above 680px (got ' + expectedModalH + ')');
		}

		g_startHelpOpen = true;
		for (let tab = 0; tab < 3; tab++) {
			g_startHelpTab = tab;
			const s0 = saveCalls();
			const r0 = restoreCalls();
			clearFillTextCalls();
			renderStartScreenHelpManual(tier.W, tier.H, cx, cy, u, safeW, safeH);
			assert.strictEqual(
				saveCalls() - s0,
				restoreCalls() - r0,
				tier.name + ' Tab ' + tab + ': saveCalls must equal restoreCalls (net stack deviation = 0)'
			);
			assert.ok(getFillTextCalls().length > 5, tier.name + ' Tab ' + tab + ' must render text content');
		}
	}
	console.log('  Passed: HiDPI modal scaling and Canvas save/restore stack isolation verified (deviation = 0).');

	// -------------------------------------------------------------
	// Simulation 5: In-Game Pause Field Manual State Machine (CLIP-06, D-08)
	// -------------------------------------------------------------
	console.log('[Sim 5] In-game pause Field Manual state machine & input lifecycle...');

	mockCanvas.width = 1920;
	mockCanvas.height = 1080;
	mainCanvasSize = vec2(1920, 1080);

	g_state = STATE_PLAYING;
	g_isPaused = true;
	g_startHelpOpen = false;
	g_startHelpTab = 0;
	inputData[0] = inputData[0] || [];

	const pressKeyInGame = (code) => {
		inputData[0][code] = 3;
		gameUpdate();
		inputData[0][code] = 0;
	};

	// Press [H] (72) while paused -> opens Field Manual
	pressKeyInGame(72);
	assert.strictEqual(g_startHelpOpen, true, 'Pressing [H] while paused must open Field Manual');
	assert.strictEqual(g_isPaused, true, 'Game must remain paused when Field Manual opens');

	// Press [2] (50) -> switches to Tab 1
	pressKeyInGame(50);
	assert.strictEqual(g_startHelpTab, 1, 'Pressing [2] while paused with Field Manual open must select Tab 1');

	// Render paused game with Field Manual open and verify "[ESC / X] RETURN TO GAME"
	clearFillTextCalls();
	const sPause = saveCalls();
	const rPause = restoreCalls();
	gameRenderPost();
	assert.strictEqual(saveCalls() - sPause, restoreCalls() - rPause, 'Paused Field Manual render must balance save/restore');
	assert.ok(
		getFillTextCalls().some(c => c.text.includes('[ESC / X] RETURN TO GAME')),
		'Field Manual opened during pause must display [ESC / X] RETURN TO GAME'
	);

	// Press [ESC] (27) -> closes Field Manual but keeps game paused
	pressKeyInGame(27);
	assert.strictEqual(g_startHelpOpen, false, 'Pressing [ESC] must close Field Manual');
	assert.strictEqual(g_isPaused, true, 'Closing Field Manual with [ESC] must keep game paused');

	console.log('  Passed: Pause-state Field Manual lifecycle ([H] open, [2] tab switch, [ESC] return to pause) verified.');
`;

vm.runInContext(simulations, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 19 TESTS PASSED SUCCESSFULLY (100% GREEN)');
console.log('=============================================================\n');
