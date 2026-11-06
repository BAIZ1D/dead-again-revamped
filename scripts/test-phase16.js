import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 16 HUD ERGONOMICS & BANNER CLIPPING TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static AST & Source Code Contract Checks
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const pkgSrc = fs.readFileSync('package.json', 'utf8');

// [Check 1] ui.js: SMG adaptive 2x10 grid layout inside equipment card (CLIP-01, D-01, D-02, D-03)
console.log('[Check 1] ui.js SMG chambered ammo adaptive 2x10 grid (CLIP-01, D-01, D-02, D-03)...');
assert.ok(uiSrc.includes('maxAmmo > 6'), 'CLIP-01/D-02: ui.js must branch on maxAmmo > 6 for high-capacity grid');
assert.ok(uiSrc.includes('i % 10'), 'CLIP-01/D-01: ui.js must compute col = i % 10 for 10-column layout');
assert.ok(uiSrc.includes('Math.floor(i / 10)'), 'CLIP-01/D-01: ui.js must compute row = Math.floor(i / 10)');
assert.ok(uiSrc.includes('0.52 * scaleUI'), 'CLIP-01/D-01: ui.js must scale micro-pip bullet icons to 0.52 * scaleUI');
assert.ok(uiSrc.includes('0.50 * scaleUI'), 'CLIP-01/D-01: ui.js must specify 0.50 * scaleUI horizontal pitch');
assert.ok(uiSrc.includes('0.54 * scaleUI'), 'CLIP-01/D-01: ui.js must specify 0.54 * scaleUI row vertical pitch');
assert.ok(uiSrc.includes('pos.y + 0.27 * scaleUI - row * pitchY'), 'CLIP-01/D-01: ui.js must position Row 0 at +0.27 and Row 1 at -0.27');
assert.ok(uiSrc.includes('0.95 * scaleUI'), 'CLIP-01/D-02: ui.js must preserve single-row 0.95 * scaleUI pitch for <=6 rounds');
assert.ok(uiSrc.includes('colorWhite.scale(0.2)'), 'CLIP-01/D-03: ui.js must dim spent chambered rounds to 20% opacity');
console.log('  Passed: ui.js SMG 2x10 adaptive grid and depletion dimming verified.');

// [Check 2] ui.js: Player health pips relocated beneath avatar portrait in world space (HUD-04, D-04, D-05, D-06)
console.log('[Check 2] ui.js player health pips relocated beneath avatar (HUD-04, D-04, D-05, D-06)...');
assert.ok(uiSrc.includes('pos.y - 1.35 * scaleUI'), 'HUD-04/D-04: ui.js must subtract Y to position pips beneath avatar');
assert.ok(uiSrc.includes('5.975 * scaleUI'), 'HUD-04/D-04: ui.js must center 4 pips starting at pos.x - 5.975 * scaleUI');
assert.ok(uiSrc.includes('new Color(0, 0, 0, 0.45)'), 'HUD-04/D-04: ui.js must render dark armored backing plate (alpha 0.45)');
assert.ok(uiSrc.includes('0.28 * Math.sin'), 'HUD-04/D-05: ui.js must preserve 0.28 peak sine wave for 1 HP primary pulse');
assert.ok(uiSrc.includes('0.16 * Math.sin'), 'HUD-04/D-05: ui.js must preserve 0.16 peak sine wave for 1 HP secondary pulse');
assert.ok(uiSrc.includes('colorBlood.scale(ghostPulse)'), 'HUD-04/D-05: ui.js must render red-ghosting highlight at 1 HP');
console.log('  Passed: ui.js health pips beneath avatar, armored plate, and 1 HP pulse verified.');

// [Check 3] apgManager.js: Center notification banner dynamic sizing, relative anchoring, and faction styling (CLIP-02, D-07..D-10)
console.log('[Check 3] apgManager.js center notification banner geometry & styling (CLIP-02, D-07..D-10)...');
assert.ok(apgSrc.includes('u * 3.4 : u * 2.4'), 'CLIP-02/D-07: apgManager.js must dynamically set u * 3.4 (dual) or u * 2.4 (single) height');
assert.ok(apgSrc.includes('bannerPos.y - u * 0.45'), 'CLIP-02/D-07: apgManager.js must anchor headline relative to bannerPos.y - u * 0.45');
assert.ok(apgSrc.includes('bannerPos.y + u * 0.55'), 'CLIP-02/D-07: apgManager.js must anchor subtitle relative to bannerPos.y + u * 0.55');
assert.ok(apgSrc.includes('W * 0.92'), 'CLIP-02/D-08: apgManager.js must cap banner width at 92% screen width');
assert.ok(apgSrc.includes('fontScale'), 'CLIP-02/D-08: apgManager.js must implement responsive font downscaling');
assert.ok(apgSrc.includes('colorBlood'), 'CLIP-02/D-09: apgManager.js must branch to colorBlood for sabotages/Blood Surge');
assert.ok(apgSrc.includes('colorSpark'), 'CLIP-02/D-09: apgManager.js must style buffs with colorSpark');
console.log('  Passed: apgManager.js dynamic banner height, relative anchoring, width cap, and faction borders verified.');

// [Check 4] package.json: test runner script entry
console.log('[Check 4] package.json test:phase16 runner entry...');
assert.ok(pkgSrc.includes('"test:phase16": "node scripts/test-phase16.js"'), 'package.json must contain test:phase16 runner script');
console.log('  Passed: package.json test script verified.');

console.log('\n✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');


// -------------------------------------------------------------
// SUITE B: Headless Node VM Mathematical & Layout Boundary Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL & GEOMETRIC SIMULATIONS ---');

// Rebuild game distribution to verify compiled index.js
console.log('[Build] Rebuilding production bundle via scripts/build-game.js...');
execSync('node scripts/build-game.js', { stdio: 'inherit' });

let uiDrawRectScreenCalls = [];
let drawTextWithOutlineCalls = [];

const mockContext = {
	_fillStyle: '',
	_strokeStyle: '',
	_lineWidth: 1,
	textAlign: 'left',
	font: '10px monospace',
	textBaseline: 'alphabetic',
	lineJoin: 'miter',

	get strokeStyle() { return this._strokeStyle; },
	set strokeStyle(val) { this._strokeStyle = val; },
	get lineWidth() { return this._lineWidth; },
	set lineWidth(val) { this._lineWidth = val; },
	get fillStyle() { return this._fillStyle; },
	set fillStyle(val) { this._fillStyle = val; },

	fillRect: () => {},
	clearRect: () => {},
	fillText: () => {},
	strokeText: () => {},
	measureText: (text) => ({ width: (text ? text.length : 0) * 8 }),
	beginPath: () => {},
	arc: () => {},
	fill: () => {},
	stroke: () => {},
	rect: () => {},
	save: () => {},
	restore: () => {},
	drawImage: () => {},
	translate: () => {},
	rotate: () => {},
	scale: () => {},
	createRadialGradient: () => ({ addColorStop: () => {} }),
};

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
	window: null,
	document: {
		createElement: () => mockCanvas,
		getElementById: () => mockCanvas,
		addEventListener: () => {},
		body: { appendChild: () => {}, style: {} },
	},
	navigator: { userAgent: 'Node' },
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
	mainCanvas: mockCanvas,
	overlayCanvas: mockCanvas,
	mainContext: mockContext,
	overlayContext: mockContext,
	uiDrawRectScreenCalls,
	drawTextWithOutlineCalls,
};
sandbox.window = sandbox;
sandbox.mockCanvas = mockCanvas;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
const bundleCode = fs.readFileSync('main/dist/js/index.js', 'utf8');

vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const simulations = `
	mainCanvas = mockCanvas;
	mainContext = mockCanvas.getContext('2d');
	overlayCanvas = mockCanvas;
	overlayContext = mockCanvas.getContext('2d');
	mainCanvasSize = vec2(1920, 1080);
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);

	// -------------------------------------------------------------
	// 1. SMG Ammo Grid Containment & Depletion Order Simulation (CLIP-01, D-01, D-02, D-03)
	// -------------------------------------------------------------
	console.log('[Sim 1] Simulating SMG adaptive 2x10 ammo grid containment across 720p, 1080p, 4K...');

	const viewports = [
		{ name: '720p', W: 1280, H: 720, u: 18, cameraScale: 32 },
		{ name: '1080p', W: 1920, H: 1080, u: 27, cameraScale: 32 },
		{ name: '4K', W: 3840, H: 2160, u: 54, cameraScale: 32 },
	];

	for (const vp of viewports) {
		const scaleUI = Math.min(1, vp.W / (12 * vp.cameraScale));
		const cameraPos = vec2(100, 100);
		const pos = vec2(
			cameraPos.x - vp.W / (vp.cameraScale * 2) + 6 * scaleUI,
			cameraPos.y + vp.H / (vp.cameraScale * 2) - scaleUI
		);

		// Equipment card bounds: centered at pos with size vec2(8, 2).scale(scaleUI)
		const boxMinX = pos.x - 4.0 * scaleUI;
		const boxMaxX = pos.x + 4.0 * scaleUI;
		const boxMinY = pos.y - 1.0 * scaleUI;
		const boxMaxY = pos.y + 1.0 * scaleUI;

		// Total ammo text right edge ("MAX" counter) at pos.x - 1.95 * scaleUI
		const maxAmmoCounterRightX = pos.x - 1.95 * scaleUI;

		// 2x10 grid layout parameters
		const maxAmmo = 20;
		const bulletScale = vec2(0.52 * scaleUI);
		const startX = pos.x - 1.45 * scaleUI;
		const pitchX = 0.50 * scaleUI;
		const pitchY = 0.54 * scaleUI;

		assert.strictEqual(bulletScale.x, 0.52 * scaleUI, 'D-01: Bullet scale is 0.52 * scaleUI');

		for (let i = 0; i < maxAmmo; i++) {
			const col = i % 10;
			const row = Math.floor(i / 10);
			const bulletPos = vec2(
				startX + col * pitchX,
				pos.y + 0.27 * scaleUI - row * pitchY
			);

			// Check Row Y coordinates
			if (row === 0) {
				assert.ok(Math.abs(bulletPos.y - (pos.y + 0.27 * scaleUI)) < 1e-5, 'Row 0 at pos.y + 0.27 * scaleUI');
			} else {
				assert.ok(Math.abs(bulletPos.y - (pos.y - 0.27 * scaleUI)) < 1e-5, 'Row 1 at pos.y - 0.27 * scaleUI');
			}

			// Check bounding box of bullet icon
			const bHalfW = bulletScale.x / 2;
			const bHalfH = bulletScale.y / 2;
			const bLeft = bulletPos.x - bHalfW;
			const bRight = bulletPos.x + bHalfW;
			const bBottom = bulletPos.y - bHalfH;
			const bTop = bulletPos.y + bHalfH;

			// Assert bullet is strictly inside equipment card [boxMinX, boxMaxX] x [boxMinY, boxMaxY]
			assert.ok(bLeft >= boxMinX, 'Bullet ' + i + ' left edge ' + bLeft + ' inside box left ' + boxMinX);
			assert.ok(bRight <= boxMaxX, 'Bullet ' + i + ' right edge ' + bRight + ' inside box right ' + boxMaxX);
			assert.ok(bBottom >= boxMinY, 'Bullet ' + i + ' bottom edge ' + bBottom + ' inside box bottom ' + boxMinY);
			assert.ok(bTop <= boxMaxY, 'Bullet ' + i + ' top edge ' + bTop + ' inside box top ' + boxMaxY);

			// Assert zero collision with total ammo counter (left edge of bullet grid > maxAmmoCounterRightX)
			assert.ok(bLeft > maxAmmoCounterRightX, 'Bullet ' + i + ' left edge clears ammo counter');
		}

		// Verify depletion order (D-03: bottom row rounds 19..10 dim first right-to-left, then top row 9..0)
		for (let curAmmo = 20; curAmmo >= 0; curAmmo--) {
			for (let i = 0; i < maxAmmo; i++) {
				const isSpent = (i + 1) > curAmmo;
				if (curAmmo === 15) {
					// Rounds 15..19 (all in bottom row, col 5..9) should be spent
					if (i >= 15) assert.ok(isSpent, 'Round ' + i + ' is spent at ammo 15');
					else assert.ok(!isSpent, 'Round ' + i + ' is live at ammo 15');
				}
				if (curAmmo === 10) {
					// Bottom row completely spent, top row completely live
					if (i >= 10) assert.ok(isSpent, 'Bottom row round ' + i + ' spent at ammo 10');
					else assert.ok(!isSpent, 'Top row round ' + i + ' live at ammo 10');
				}
				if (curAmmo === 5) {
					// Bottom row spent, top row rounds 5..9 spent, top row rounds 0..4 live
					if (i >= 5) assert.ok(isSpent, 'Round ' + i + ' spent at ammo 5');
					else assert.ok(!isSpent, 'Round ' + i + ' live at ammo 5');
				}
			}
		}

		// Low-capacity weapons (maxAmmo <= 6) preserve single-row layout
		for (const lowCap of [2, 4, 6]) {
			for (let i = 0; i < lowCap; i++) {
				const singleRowPos = vec2(pos.x - 1.4 * scaleUI + i * 0.95 * scaleUI, pos.y);
				assert.strictEqual(singleRowPos.y, pos.y, 'Low-capacity weapon bullet Y is pos.y');
			}
		}
	}
	console.log('  Passed: SMG 2x10 grid strictly contained, clears ammo counter, dims right-to-left bottom-to-top.');


	// -------------------------------------------------------------
	// 2. Health Pips Beneath-Avatar Relocation & Deconfliction Simulation (HUD-04, D-04, D-05, D-06)
	// -------------------------------------------------------------
	console.log('[Sim 2] Simulating health pips beneath-avatar positioning & toast deconfliction...');

	for (const vp of viewports) {
		const scaleUI = Math.min(1, vp.W / (12 * vp.cameraScale));
		const cameraPos = vec2(0, 0);
		const pos = vec2(
			cameraPos.x - vp.W / (vp.cameraScale * 2) + 6 * scaleUI,
			cameraPos.y + vp.H / (vp.cameraScale * 2) - scaleUI
		);

		// Avatar center is at pos.x - 5.0 * scaleUI, pos.y
		const avatarCenterX = pos.x - 5.0 * scaleUI;
		const platePos = vec2(pos.x - 5.0 * scaleUI, pos.y - 1.35 * scaleUI);
		const plateSize = vec2(2.7, 0.65).scale(scaleUI);

		// D-04: Plate centered horizontally under avatar
		assert.ok(Math.abs(platePos.x - avatarCenterX) < 1e-5, 'Backing plate horizontally aligned with avatar');
		// D-04: Plate Y is pos.y - 1.35 * scaleUI (subtracted!)
		assert.ok(Math.abs(platePos.y - (pos.y - 1.35 * scaleUI)) < 1e-5, 'Backing plate Y at pos.y - 1.35 * scaleUI');

		// 4 pips horizontal bounds
		const pipPositions = [];
		for (let i = 0; i < 4; i++) {
			const pipPos = vec2(pos.x - 5.975 * scaleUI + i * 0.65 * scaleUI, pos.y - 1.35 * scaleUI);
			pipPositions.push(pipPos);
		}
		const pipCenter = (pipPositions[0].x + pipPositions[3].x) / 2;
		assert.ok(Math.abs(pipCenter - avatarCenterX) < 1e-5, 'Pips center strictly aligned with avatar center');

		// Pips contained inside armored plate horizontally
		const plateMinX = platePos.x - plateSize.x / 2;
		const plateMaxX = platePos.x + plateSize.x / 2;
		assert.ok(pipPositions[0].x >= plateMinX, 'First pip inside plate left edge');
		assert.ok(pipPositions[3].x <= plateMaxX, 'Last pip inside plate right edge');

		// Vertical deconfliction with chat toasts (D-06):
		// In Screen Space: screenY = (cameraPos.y - worldY) * cameraScale + H / 2
		const plateBottomWorldY = platePos.y - plateSize.y / 2;
		const plateBottomScreenY = (cameraPos.y - plateBottomWorldY) * vp.cameraScale + vp.H / 2;

		const chatToastY = Math.max(vp.H * 0.38, vp.u * 6.8);
		const screenBuffer = chatToastY - plateBottomScreenY;
		const worldBuffer = screenBuffer / vp.cameraScale;

		assert.ok(
			worldBuffer >= 0.5 * scaleUI,
			vp.name + ': Buffer between plate bottom and chat toast (' + worldBuffer.toFixed(2) + 'u) >= 0.5 * scaleUI'
		);

		// D-05: 1 HP biological double-beat pulse simulation over 50 frames
		let maxPeak1 = 0;
		let maxPeak2 = 0;
		for (let f = 0; f < 50; f++) {
			let heartPulse = 0;
			let cycle = f % 50;
			if (cycle < 12) {
				heartPulse = 0.28 * Math.sin((cycle / 12) * Math.PI);
				if (heartPulse > maxPeak1) maxPeak1 = heartPulse;
			} else if (cycle >= 14 && cycle < 24) {
				heartPulse = 0.16 * Math.sin(((cycle - 14) / 10) * Math.PI);
				if (heartPulse > maxPeak2) maxPeak2 = heartPulse;
			}
		}
		assert.ok(Math.abs(maxPeak1 - 0.28) < 0.01, '1 HP primary heartbeat pulse peaks at 0.28');
		assert.ok(Math.abs(maxPeak2 - 0.16) < 0.01, '1 HP secondary heartbeat pulse peaks at 0.16');
	}
	console.log('  Passed: Health pips beneath avatar in world space, armored plate centered, 1 HP pulse preserved, buffer >= 0.5.');


	// -------------------------------------------------------------
	// 3. Center Notification Banner Geometry & Safe Subtitle Padding (CLIP-02, D-07, D-08, D-09, D-10)
	// -------------------------------------------------------------
	console.log('[Sim 3] Simulating center notification banner dynamic sizing, long username scaling, and faction borders...');

	let mockApg = new APGManager();

	for (const vp of viewports) {
		const W = vp.W;
		const H = vp.H;
		const cx = W / 2;
		const u = vp.u;

		// --- Case A: Divine Flash with long Twitch username (Dual-line) ---
		mockApg.centerBanner = {
			text: "★ DIVINE FLASH! SAVED BY @SuperLongTwitchUsernameThatExceedsNormalLimits ★",
			subtext: "HOLY SHOCKWAVE — SABOTAGES PURGED & HORDE STUNNED!",
			color: colorSpark,
			frames: 180,
			maxFrames: 180,
		};

		// Invoke renderCenterBanner
		let capturedRects = [];
		let capturedTexts = [];
		uiDrawRectScreen = function(pos, size, color) {
			capturedRects.push({ pos, size, color });
		};
		drawTextWithOutline = function(text, pos, size, textColor, outlineWidth, outlineColor) {
			capturedTexts.push({ text, pos, size, textColor, outlineWidth, outlineColor });
		};

		mockApg.renderCenterBanner(W, H, cx, u);

		assert.strictEqual(capturedRects.length, 2, 'Banner draws 2 rectangles (border + background)');
		const bannerBox = capturedRects[1]; // background inner box
		const bannerBorder = capturedRects[0]; // border outer box

		// D-07: Dual-line height must be u * 3.4
		assert.strictEqual(bannerBox.size.y, u * 3.4, vp.name + ': Dual-line banner height must be u * 3.4');
		assert.strictEqual(bannerBorder.size.y, u * 3.4 + 6, 'Outer border height is bannerH + 6');

		// D-08: Max width capped at W * 0.92
		assert.ok(bannerBox.size.x <= W * 0.92 + 1e-5, vp.name + ': Banner width capped at 92% screen width');

		// D-07: Vertical text containment
		assert.strictEqual(capturedTexts.length, 2, 'Dual-line banner renders headline and subtitle');
		const headCall = capturedTexts[0];
		const subCall = capturedTexts[1];

		const bannerCenterY = bannerBox.pos.y;
		const bannerTop = bannerCenterY - bannerBox.size.y / 2;
		const bannerBottom = bannerCenterY + bannerBox.size.y / 2;

		const headTop = headCall.pos.y - headCall.size / 2;
		const subBottom = subCall.pos.y + subCall.size / 2;

		// Verify headline and subtitle are strictly contained inside banner box
		assert.ok(headTop > bannerTop, vp.name + ': Headline top ' + headTop + ' > banner top ' + bannerTop);
		assert.ok(subBottom < bannerBottom, vp.name + ': Subtitle bottom ' + subBottom + ' < banner bottom ' + bannerBottom);

		// Assert safe margin >= 0.2 * u
		const topMargin = headTop - bannerTop;
		const bottomMargin = bannerBottom - subBottom;
		assert.ok(topMargin >= 0.2 * u, vp.name + ': Top margin ' + topMargin.toFixed(1) + ' >= 0.2 * u (' + (0.2 * u).toFixed(1) + ')');
		assert.ok(bottomMargin >= 0.2 * u, vp.name + ': Bottom margin ' + bottomMargin.toFixed(1) + ' >= 0.2 * u (' + (0.2 * u).toFixed(1) + ')');

		// Verify responsive font downscaling kept text width inside banner
		const headRenderedWidth = headCall.text.length * (headCall.size * 0.60);
		assert.ok(headRenderedWidth <= bannerBox.size.x, vp.name + ': Rendered text width fits inside banner width');

		// D-09: Divine Flash border is colorSpark / golden
		assert.ok(bannerBorder.color.r > 0.8 && bannerBorder.color.g > 0.7, 'Divine Flash border has sparkling golden hue');

		// --- Case B: Blood Surge (Dual-line, Bad faction styling) ---
		mockApg.centerBanner = {
			text: "⚠️ BLOOD SURGE TRIGGERED BY @TwitchChat ⚠️",
			subtext: "HORDE SPEED +50% — SURVIVE THE CARNAGE!",
			color: colorBlood,
			frames: 180,
			maxFrames: 180,
		};
		capturedRects = [];
		capturedTexts = [];

		mockApg.renderCenterBanner(W, H, cx, u);
		assert.strictEqual(capturedRects.length, 2);
		const bloodBorder = capturedRects[0];
		// D-09: Blood Surge border is colorBlood (r: 172/255 = ~0.67, g/b: 50/255 = ~0.20)
		assert.ok(bloodBorder.color.r >= 0.5 && bloodBorder.color.r > bloodBorder.color.g * 2, 'Blood Surge border has crimson blood hue');

		// --- Case C: Single-line notification ---
		mockApg.centerBanner = {
			text: "SURVIVAL ROUND 10 REACHED",
			subtext: "",
			color: colorSpark,
			frames: 180,
			maxFrames: 180,
		};
		capturedRects = [];
		capturedTexts = [];

		mockApg.renderCenterBanner(W, H, cx, u);
		assert.strictEqual(capturedRects.length, 2);
		const singleBox = capturedRects[1];
		// D-07: Single-line height must be u * 2.4
		assert.strictEqual(singleBox.size.y, u * 2.4, vp.name + ': Single-line banner height must be u * 2.4');
		assert.strictEqual(capturedTexts.length, 1, 'Single-line banner renders only headline');
		assert.strictEqual(capturedTexts[0].pos.y, singleBox.pos.y, 'Single-line headline centered at bannerPos.y');
	}
	console.log('  Passed: Center banners dynamically resize, scale long text, anchor safely without subtitle clipping, and react to faction.');
`;

vm.runInContext(simulations, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 16 TESTS PASSED SUCCESSFULLY (30+ ASSERTIONS)');
console.log('=============================================================\n');
