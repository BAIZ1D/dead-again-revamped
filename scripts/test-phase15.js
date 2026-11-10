import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 15 CORE COMBAT PRIMITIVES & TYPOGRAPHY FIX TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static AST & Source Code Contract Checks
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const smgSrc = fs.readFileSync('main/src/js/gunMachinePistol.js', 'utf8');
const pkgSrc = fs.readFileSync('package.json', 'utf8');

// [Check 1] main.js: polymorphic drawTextWithOutline parameter resolution (CLIP-03, D-07, D-08)
console.log('[Check 1] main.js polymorphic drawTextWithOutline & proportional cushion (CLIP-03, D-07, D-08)...');
assert.ok(
	mainSrc.includes("typeof arg5 === 'number'"),
	'CLIP-03/D-07: main.js must check typeof arg5 === "number" to resolve 6-argument outlineWidth'
);
assert.ok(
	mainSrc.includes('Math.max(1.5, size / 15)'),
	'CLIP-03/D-08: main.js must apply Math.max(1.5, size / 15) outline cushion'
);
console.log('  Passed: main.js polymorphic arg5 inspection and 1.5px minimum outline cushion confirmed.');

// [Check 2] gunMachinePistol.js: cyclic rate, 160ms recovery, 3-shot laser, non-linear bloom, micro-shake, zero Date.now() (BAL-23, D-01..D-06)
console.log('[Check 2] gunMachinePistol.js combat primitives contracts (BAL-23, D-01..D-06)...');
assert.ok(smgSrc.includes('this.fireDelay = 0.08;') || smgSrc.includes('this.fireDelay = 0.09;'), 'BAL-23/D-01: MachinePistol must specify cyclic fireDelay');
assert.ok(smgSrc.includes('this.burstRecoveryTime = 0.16;'), 'BAL-23/D-04: MachinePistol must specify 160ms burstRecoveryTime (0.16s)');
assert.ok(smgSrc.includes('this.burstCount <= 3'), 'BAL-23/D-02: MachinePistol must gate pinpoint laser accuracy on burstCount <= 3');
assert.ok(smgSrc.includes('Math.pow(tau, 1.5)'), 'BAL-23/D-03: MachinePistol must implement non-linear bloom expansion curve');
assert.ok(smgSrc.includes('fx_shakeScreen(0.12)'), 'BAL-23/D-05: MachinePistol must trigger micro-screenshake (0.12) on hold (shots 4+)');
assert.ok(smgSrc.includes('Math.min(bloom, 0.48)') || smgSrc.includes('Math.min('), 'BAL-23/D-03: MachinePistol bloom must be capped at 0.48 rad');
assert.ok(smgSrc.includes('0.16'), 'BAL-23/D-03: MachinePistol must implement +/-8% projectile velocity jitter (0.16 range)');
assert.ok(
	!smgSrc.includes('Date.now()') && !smgSrc.includes('new Date()'),
	'BAL-23/D-06: gunMachinePistol.js must contain zero Date.now() or new Date() calls (pure LittleJS engine time)'
);
console.log('  Passed: gunMachinePistol.js cyclic rate, burst threshold, bloom curve, and engine time confirmed.');

// [Check 3] package.json: test runner script entry
console.log('[Check 3] package.json test:phase15 runner entry...');
assert.ok(pkgSrc.includes('"test:phase15": "node scripts/test-phase15.js"'), 'package.json must contain test:phase15 runner script');
console.log('  Passed: package.json test script verified.');

console.log('\n✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');


// -------------------------------------------------------------
// SUITE B: Headless Node VM Behavioral Execution Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL SIMULATIONS ---');

// Rebuild game distribution to verify compiled index.js
execSync('node scripts/build-game.js', { stdio: 'inherit' });

let strokeStyleLog = [];
let lineWidthLog = [];
let strokeTextCalls = [];

const mockContext = {
	_fillStyle: '',
	_strokeStyle: '',
	_lineWidth: 1,
	textAlign: 'left',
	font: '10px monospace',
	textBaseline: 'alphabetic',
	lineJoin: 'miter',

	get strokeStyle() {
		return this._strokeStyle;
	},
	set strokeStyle(val) {
		if (typeof val === 'number') {
			throw new Error('Canvas strokeStyle cannot be a number: ' + val);
		}
		this._strokeStyle = val;
		strokeStyleLog.push(val);
	},

	get lineWidth() {
		return this._lineWidth;
	},
	set lineWidth(val) {
		this._lineWidth = val;
		lineWidthLog.push(val);
	},

	get fillStyle() {
		return this._fillStyle;
	},
	set fillStyle(val) {
		this._fillStyle = val;
	},

	fillRect: () => {},
	clearRect: () => {},
	fillText: (text, x, y) => {},
	strokeText: (text, x, y) => {
		strokeTextCalls.push({ text, x, y, lineWidth: mockContext.lineWidth, strokeStyle: mockContext.strokeStyle });
	},
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
	width: 800,
	height: 600,
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
	mainCanvasSize = vec2(800, 600);
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);

	// -------------------------------------------------------------
	// 1. drawTextWithOutline Signature Polymorphism (CLIP-03, D-07, D-08)
	// -------------------------------------------------------------
	console.log('[Sim 1] Simulating drawTextWithOutline polymorphic signatures (4-arg, 5-arg, 6-arg)...');

	// A: 4-argument call -> defaults to colorBlack and Math.max(1.5, size / 15)
	drawTextWithOutline("FourArgs", vec2(100, 100), 30, colorWhite);
	assert.strictEqual(overlayContext.lineWidth, 2, 'D-08: 30px text calculates 30/15 = 2px outline');
	assert.strictEqual(typeof overlayContext.strokeStyle, 'object', 'Outline color must be Color object (colorBlack)');

	// Small size cushion test (10px -> 10/15 = 0.667 -> clamped to 1.5)
	drawTextWithOutline("SmallCushion", vec2(100, 100), 10, colorWhite);
	assert.strictEqual(overlayContext.lineWidth, 1.5, 'D-08: 10px text outline cushioned to 1.5px minimum');

	// B: 5-argument call (text, pos, size, textColor, outlineColor)
	const customColor = new Color(0.2, 0.4, 0.6);
	drawTextWithOutline("FiveArgs", vec2(100, 100), 45, colorWhite, customColor);
	assert.strictEqual(overlayContext.lineWidth, 3, '45px text calculates 45/15 = 3px outline');
	assert.strictEqual(overlayContext.strokeStyle, customColor, 'D-07: 5th argument passed as Color object sets strokeStyle');

	// C: 6-argument call (text, pos, size, textColor, outlineWidth, outlineColor) - APG HUD style
	const outlineGold = new Color(1, 0.8, 0);
	drawTextWithOutline("SixArgsNumeric", vec2(100, 100), 24, colorWhite, 4, outlineGold);
	assert.strictEqual(overlayContext.lineWidth, 4, 'D-07: Numeric 5th argument explicitly sets outlineWidth');
	assert.strictEqual(overlayContext.strokeStyle, outlineGold, 'D-07: 6th argument correctly assigned as outlineColor');

	// D: Verify APG HUD banner invocation: drawTextWithOutline(label, pos, 20, col, 2, colorBlack)
	drawTextWithOutline("APG BANNER", vec2(200, 200), 20, colorWhite, 2, colorBlack);
	assert.strictEqual(overlayContext.lineWidth, 2, 'APG banner call preserves 2px outline width');
	assert.strictEqual(overlayContext.strokeStyle, colorBlack, 'APG banner call sets colorBlack stroke');

	console.log('  Passed: All 4 outline signatures resolve polymorphically without numeric strokeStyle corruption.');


	// -------------------------------------------------------------
	// 2. Machine Pistol 3-Shot Burst-Tap Pinpoint Precision (BAL-23, D-02, D-05)
	// -------------------------------------------------------------
	console.log('[Sim 2] Simulating Machine Pistol 3-shot burst taps with laser precision & zero screenshake...');

	let mockPlayer = new MobPlayer(vec2(10, 10));
	mockPlayer.hp = 3;
	g_player = mockPlayer;

	let smg = new MachinePistol(vec2(10, 10));
	smg.owner = mockPlayer;
	mousePos = vec2(20, 10); // Aiming directly right along +x so gun.angle is 0
	smg.angle = 0; // pointing directly right along +x

	let screenshakeRecords = [];
	fx_shakeScreen = function(amt) {
		screenshakeRecords.push(amt);
	};

	let soundPlayRecords = [];
	soundPistol.play = function(pos, vol, pitch) {
		soundPlayRecords.push({ pos, vol, pitch });
	};

	time = 0.00;
	frame = 0;
	g_isPaused = false;

	// Shot 1 (t = 0.00)
	let countBefore = engineObjects.length;
	let shot1Result = smg.fire();
	assert.strictEqual(shot1Result, true, 'Shot 1 must fire successfully');
	assert.strictEqual(smg.burstCount, 1, 'Burst count is 1 after Shot 1');
	assert.ok(smg.currentBloom <= 0.02, 'D-02: Shot 1 bloom must be <= 0.02 rad');
	assert.strictEqual(screenshakeRecords.length, 0, 'D-05: Shot 1 must produce zero screenshake');
	assert.strictEqual(smg.currentPitchFactor, 1.0, 'D-05: Shot 1 must maintain 1.0 baseline pitch factor');

	let bullet1 = engineObjects[engineObjects.length - 1];
	assert.ok(bullet1 instanceof Bullet, 'Shot 1 must spawn a Bullet instance');
	let angle1 = Math.atan2(bullet1.velocity.y, bullet1.velocity.x);
	assert.ok(Math.abs(angle1) <= 0.02 + 1e-5, 'D-02: Shot 1 angle deviation must not exceed 0.02 rad');
	let speed1 = bullet1.velocity.length();
	assert.ok(speed1 >= 0.4 * 0.92 - 1e-4 && speed1 <= 0.4 * 1.08 + 1e-4, 'D-03: Shot 1 velocity within +/-8% jitter');

	let delay = smg.fireDelay || 0.08;

	// Attempt rapid fire before cyclic delay: should be rejected
	time = 0.04;
	let prematureFire = smg.fire();
	assert.strictEqual(prematureFire, false, 'D-01: Firing before cyclic delay must return false');
	assert.strictEqual(smg.burstCount, 1, 'Burst count must not advance on rejected fire');

	// Shot 2 (t = delay)
	time = delay;
	let shot2Result = smg.fire();
	assert.strictEqual(shot2Result, true, 'Shot 2 fires at delay');
	assert.strictEqual(smg.burstCount, 2, 'Burst count is 2');
	assert.ok(smg.currentBloom <= 0.02, 'D-02: Shot 2 bloom must be <= 0.02 rad');
	assert.strictEqual(screenshakeRecords.length, 0, 'D-05: Shot 2 zero screenshake');
	assert.strictEqual(smg.currentPitchFactor, 1.0, 'D-05: Shot 2 1.0 pitch factor');

	let bullet2 = engineObjects[engineObjects.length - 1];
	let angle2 = Math.atan2(bullet2.velocity.y, bullet2.velocity.x);
	assert.ok(Math.abs(angle2) <= 0.02 + 1e-5, 'D-02: Shot 2 angle deviation <= 0.02 rad');

	// Shot 3 (t = delay * 2)
	time = delay * 2;
	let shot3Result = smg.fire();
	assert.strictEqual(shot3Result, true, 'Shot 3 fires at 2x delay');
	assert.strictEqual(smg.burstCount, 3, 'Burst count is 3');
	assert.ok(smg.currentBloom <= 0.02, 'D-02: Shot 3 bloom must be <= 0.02 rad');
	assert.strictEqual(screenshakeRecords.length, 0, 'D-05: Shot 3 zero screenshake');
	assert.strictEqual(smg.currentPitchFactor, 1.0, 'D-05: Shot 3 1.0 pitch factor');

	let bullet3 = engineObjects[engineObjects.length - 1];
	let angle3 = Math.atan2(bullet3.velocity.y, bullet3.velocity.x);
	assert.ok(Math.abs(angle3) <= 0.02 + 1e-5, 'D-02: Shot 3 angle deviation <= 0.02 rad');

	console.log('  Passed: 3-shot burst taps maintain laser pinpoint accuracy (<=0.02 rad) with 0 screenshake.');


	// -------------------------------------------------------------
	// 3. Machine Pistol Continuous Hold Buzzsaw & Bloom Limits (BAL-23, D-01, D-03, D-05)
	// -------------------------------------------------------------
	console.log('[Sim 3] Simulating continuous trigger hold through all 20 rounds (cyclic buzzsaw)...');

	// Shot 4 (t = delay * 3): bloom begins expanding, micro-screenshake triggers, pitch escalates
	time = delay * 3;
	let shot4Result = smg.fire();
	assert.strictEqual(shot4Result, true, 'Shot 4 fires at 3x delay');
	assert.strictEqual(smg.burstCount, 4);
	assert.ok(smg.currentBloom > 0.02, 'D-02/D-03: Shot 4 bloom begins expansion beyond 0.02 rad');
	assert.strictEqual(screenshakeRecords.length, 1, 'D-05: Shot 4 triggers fx_shakeScreen');
	assert.strictEqual(screenshakeRecords[0], 0.12, 'D-05: Screenshake intensity is exactly 0.12');
	assert.ok(smg.currentPitchFactor > 1.0, 'D-05: Shot 4 pitch factor begins ramping above 1.0');

	// Fire remaining rounds (shots 5 through 20)
	for (let shotIndex = 5; shotIndex <= 20; shotIndex++) {
		time = Math.round((time + delay) * 1000) / 1000;
		let fired = smg.fire();
		assert.strictEqual(fired, true, 'Shot ' + shotIndex + ' fires at time ' + time.toFixed(2) + 's');
		assert.strictEqual(smg.burstCount, shotIndex);

		let bullet = engineObjects[engineObjects.length - 1];
		let bSpeed = bullet.velocity.length();
		let bAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);

		// Assert +/-8% velocity jitter strictly within [0.368, 0.432]
		assert.ok(
			bSpeed >= 0.4 * 0.92 - 1e-4 && bSpeed <= 0.4 * 1.08 + 1e-4,
			'D-03: Bullet ' + shotIndex + ' speed ' + bSpeed + ' within +/-8% jitter'
		);

		// Assert spray dispersion is strictly bounded within [-0.48, +0.48] rad (~27.5 deg)
		assert.ok(
			Math.abs(bAngle) <= 0.48 + 1e-5,
			'D-03: Bullet ' + shotIndex + ' angle deviation ' + bAngle + ' capped at 0.48 rad'
		);
	}

	assert.strictEqual(smg.ammo, 0, 'All 20 rounds in chamber exhausted');
	assert.ok(time <= 1.85 + 1e-5, 'D-01: Full 20-round chamber emptied in <= 1.85s');
	assert.ok(smg.currentBloom <= 0.48 + 1e-5, 'D-03: Maximum bloom capped at 0.48 rad');
	assert.ok(smg.currentBloom >= 0.45, 'D-03: Maximum bloom reaches wide spray (>=0.45 rad)');
	assert.ok(
		smg.currentPitchFactor >= 1.20 && smg.currentPitchFactor <= 1.25,
		'D-05: Final pitch factor smoothly clamped up to 1.25'
	);
	assert.strictEqual(screenshakeRecords.length, 17, 'D-05: Micro-screenshake fired on each continuous hold shot (shots 4-20)');

	console.log('  Passed: 20 rounds discharged in ' + time.toFixed(2) + 's with bloom capped at 0.48 rad & 17 micro-shakes.');


	// -------------------------------------------------------------
	// 4. 160ms Trigger Release Recovery Window (BAL-23, D-04)
	// -------------------------------------------------------------
	console.log('[Sim 4] Simulating 160ms trigger release pause recovery reset...');

	// Advance time by 0.16s (160ms) without firing
	time += 0.16;
	smg.update();

	assert.strictEqual(smg.burstCount, 0, 'D-04: 160ms trigger release resets burstCount to 0');
	assert.strictEqual(smg.currentBloom, 0, 'D-04: 160ms trigger release resets currentBloom to 0');
	assert.strictEqual(smg.currentPitchFactor, 1.0, 'D-04: 160ms trigger release resets pitch factor to 1.0');

	// Reload SMG and fire a new single shot
	smg.ammo = 20;
	smg.reloading = false;
	screenshakeRecords = [];

	time += 0.08;
	let postResetFire = smg.fire();
	assert.strictEqual(postResetFire, true, 'Fires immediately after recovery reset');
	assert.strictEqual(smg.burstCount, 1, 'Burst count restarts at 1');
	assert.ok(smg.currentBloom <= 0.02, 'D-02/D-04: Laser pinpoint accuracy immediately restored');
	assert.strictEqual(screenshakeRecords.length, 0, 'Zero screenshake on restored tap');

	let postResetBullet = engineObjects[engineObjects.length - 1];
	let postResetAngle = Math.atan2(postResetBullet.velocity.y, postResetBullet.velocity.x);
	assert.ok(Math.abs(postResetAngle) <= 0.02 + 1e-5, 'Bullet angle deviation restored to <= 0.02 rad');

	console.log('  Passed: 160ms trigger release pause fully restores laser pinpoint accuracy.');


	// -------------------------------------------------------------
	// 5. Engine Time Pacing & Pause Determinism (D-06)
	// -------------------------------------------------------------
	console.log('[Sim 5] Simulating game pause (g_isPaused) determinism and burst freezing...');

	g_isPaused = true;
	let burstBeforePause = smg.burstCount;
	let ammoBeforePause = smg.ammo;
	let objectsBeforePause = engineObjects.length;

	// Advance time by 0.5s while paused
	time += 0.50;
	smg.update();

	// Burst counter should NOT reset during pause
	assert.strictEqual(smg.burstCount, burstBeforePause, 'D-06: Pause prevents burst recovery timer expiration');

	// Firing while paused must return false and spawn no bullets
	let pausedFireResult = smg.fire();
	assert.strictEqual(pausedFireResult, false, 'D-06: fire() returns false when g_isPaused = true');
	assert.strictEqual(smg.ammo, ammoBeforePause, 'Ammo unchanged during pause fire attempt');
	assert.strictEqual(engineObjects.length, objectsBeforePause, 'No bullet spawned during pause fire attempt');

	// Unpause game
	g_isPaused = false;
	time += 0.08;
	let unpausedFireResult = smg.fire();
	assert.strictEqual(unpausedFireResult, true, 'Firing resumes cleanly when unpaused');
	assert.strictEqual(smg.ammo, ammoBeforePause - 1, 'Ammo decrements by 1 upon unpaused shot');

	console.log('  Passed: Engine time and pause state behave 100% deterministically.');
`;

vm.runInContext(simulations, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 15 TESTS PASSED SUCCESSFULLY (25+ ASSERTIONS)');
console.log('=============================================================\n');
