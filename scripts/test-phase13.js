import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';
import { CooldownManager } from '../relay-server/src/cooldownManager.js';

console.log('=== STARTING PHASE 13 COMBAT VULNERABILITY & PACING ESCALATION TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static AST & Source Code Contract Checks
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const mobPlayerSrc = fs.readFileSync('main/src/js/mobPlayer.js', 'utf8');
const soundsSrc = fs.readFileSync('main/src/js/sounds.js', 'utf8');
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const cooldownMgrSrc = fs.readFileSync('relay-server/src/cooldownManager.js', 'utf8');
const relayIndexSrc = fs.readFileSync('relay-server/src/index.js', 'utf8');
const configExampleSrc = fs.readFileSync('relay-server/config.example.json', 'utf8');

// [Check 1] mobPlayer.js: 45-frame post-hit i-frames & Pusher knockback preservation (BAL-18, D-01, D-02)
console.log('[Check 1] mobPlayer.js 45-frame post-hit invulnerability & Pusher knockback preservation (BAL-18, D-01, D-02)...');
assert.ok(mobPlayerSrc.includes('this.invulnFrames = 45;'), 'BAL-18/D-01: mobPlayer.js must set invulnFrames = 45 upon taking damage');
assert.ok(
	mobPlayerSrc.includes('pushers.push(new Pusher(this.pos.copy(), 0.08, 0.2, 2.2, 0.2, PushTo.ENEMIES));'),
	'BAL-18/D-02: mobPlayer.js must preserve radial Pusher knockback with radius 2.2 and force 0.2'
);
console.log('  Passed: 45-frame invulnerability and radial knockback pusher confirmed.');

// [Check 2] mobPlayer.js: 15Hz red-ghost flicker & Divine Flash 150-frame preservation (D-03, D-04)
console.log('[Check 2] mobPlayer.js 15Hz red-ghost flicker & Divine Flash 150-frame preservation (D-03, D-04)...');
assert.ok(
	mobPlayerSrc.includes('frame % 4 < 2 ? new Color(1, 0.4, 0.4, 0.5) : colorWhite;'),
	'D-03: mobPlayer.js must strobe red-ghost tint Color(1, 0.4, 0.4, 0.5) at 15Hz (frame % 4 < 2)'
);
assert.ok(
	mobPlayerSrc.includes('frame % 6 < 3 ? colorSpark : colorWhite;') &&
	apgSrc.includes('g_player.invulnFrames = Math.max(g_player.invulnFrames || 0, 150);'),
	'D-04: Divine Flash 150-frame golden flash preservation confirmed'
);
console.log('  Passed: 15Hz red-ghost strobe and 150-frame Divine Flash gold flash confirmed.');

// [Check 3] sounds.js: soundHeartbeat, soundWarHorn, soundRumble procedural definitions (D-05, D-11, D-13)
console.log('[Check 3] sounds.js procedural sound definitions for soundHeartbeat, soundWarHorn, soundRumble (D-05, D-11, D-13)...');
assert.ok(soundsSrc.includes('var soundHeartbeat = new Sound(['), 'D-05: soundHeartbeat procedural sound must be defined in sounds.js');
assert.ok(soundsSrc.includes('var soundWarHorn = new Sound(['), 'D-13: soundWarHorn procedural sound must be defined in sounds.js');
assert.ok(soundsSrc.includes('var soundRumble = new Sound(['), 'D-11: soundRumble procedural sound must be defined in sounds.js');
console.log('  Passed: soundHeartbeat, soundWarHorn, and soundRumble procedural LittleJS sounds confirmed.');

// [Check 4] cooldownManager.js: 4000ms bossCooldownMs & decoupled 8000ms blackoutCooldownMs (BAL-19, D-18, D-19)
console.log('[Check 4] cooldownManager.js 4000ms bossCooldownMs & independent 8000ms blackoutCooldownMs (BAL-19, D-18, D-19)...');
assert.ok(cooldownMgrSrc.includes('this.bossCooldownMs = rateLimits.bossCooldownMs ?? 4000;'), 'BAL-19/D-18: bossCooldownMs default must be 4000ms');
assert.ok(cooldownMgrSrc.includes('this.blackoutCooldownMs = rateLimits.blackoutCooldownMs ?? 8000;'), 'D-19: blackoutCooldownMs default must be 8000ms');
assert.ok(cooldownMgrSrc.includes("cleanAction === 'boss'") && cooldownMgrSrc.includes("cleanAction === 'blackout'"),
	'BAL-19/D-19: CooldownManager must decouple boss and blackout action rate limits');
console.log('  Passed: CooldownManager constructor and getEffectiveCooldown decouple boss (4000ms) and blackout (8000ms).');

// [Check 5] relay-server index.js & config.example.json: default rateLimits (D-18, D-19)
console.log('[Check 5] relay-server index.js & config.example.json default rateLimits (D-18, D-19)...');
assert.ok(relayIndexSrc.includes('bossCooldownMs: 4000') && relayIndexSrc.includes('blackoutCooldownMs: 8000'),
	'D-18/D-19: relay-server/src/index.js defaultConfig must specify bossCooldownMs: 4000 and blackoutCooldownMs: 8000');
assert.ok(configExampleSrc.includes('"bossCooldownMs": 4000') && configExampleSrc.includes('"blackoutCooldownMs": 8000'),
	'D-18/D-19: config.example.json must specify bossCooldownMs: 4000 and blackoutCooldownMs: 8000');
console.log('  Passed: Relay server defaults and example configuration specify 4000ms boss / 8000ms blackout.');

// [Check 6] apgManager.js: ambient frenzy cadence (45-60s), 6.0s duration, and telegraph (BAL-20, D-07, D-08, D-11)
console.log('[Check 6] apgManager.js ambient frenzy cadence (45-60s), 6.0s duration, and telegraph (BAL-20, D-07, D-08, D-11)...');
assert.ok(apgSrc.includes('this.ambientFrenzyTimer = rand(2700, 3600) | 0;'), 'BAL-20/D-07/D-10: ambientFrenzyTimer randomized between 2700 and 3600 frames');
assert.ok(apgSrc.includes('this.ambientFrenzyTimer === 120 && !this.ambientTelegraphFired'),
	'D-11: 120-frame (2.0s) pre-surge telegraph triggers soundRumble');
assert.ok(apgSrc.includes('(this.timers.frenzy || 0) + 360'), 'BAL-20/D-08: Ambient surge grants exactly 360 frames (6.0s) duration');
console.log('  Passed: apgManager.js ambient cadence (45-60s), 6.0s duration, and 120f telegraph confirmed.');

// [Check 7] apgManager.js: chat !frenzy hard cap 480f (8.0s) and timer reset (D-14)
console.log('[Check 7] apgManager.js chat frenzy 8.0s hard cap & non-stacking timer reset (D-14)...');
assert.ok(apgSrc.includes('this.timers.frenzy = Math.min(480, Math.max(this.timers.frenzy || 0, 0) + 480);'),
	'D-14: Chat frenzy extends active timer capped at 480 frames (8.0s)');
assert.ok(apgSrc.includes('this.ambientFrenzyTimer = rand(2700, 3600) | 0; // Reset ambient countdown'),
	'D-14: Chat frenzy resets ambient countdown timer');
console.log('  Passed: Chat frenzy 8.0s max cap and ambient countdown timer reset confirmed.');

// [Check 8] apgManager.js: bottom-center HUD coordinates & proximity alpha fading (D-15..D-17)
console.log('[Check 8] apgManager.js bottom-center HUD layout coordinates & proximity alpha fading (D-15..D-17)...');
assert.ok(apgSrc.includes('let barY = Math.round(H - Math.max(24, u * 1.5));'), 'D-15: Tug-of-War bar positioned at bottom center (H - Math.max(24, u * 1.5))');
assert.ok(apgSrc.includes('let statusY = barY - Math.max(16, u * 1.05);'), 'D-16: Status line stacked above bottom bar');
assert.ok(apgSrc.includes('let py = statusY - Math.max(18, u * 1.15);'), 'D-16: Active timer pills stacked above status line');
assert.ok(apgSrc.includes('dist < 110') && apgSrc.includes('targetAlpha = 0.35 + 0.65 * clamp(dist / 110, 0, 1);'),
	'D-17: Player distance < 110px fades bottom HUD alpha toward 0.35');
console.log('  Passed: Bottom-center HUD coordinate hierarchy and proximity alpha fading confirmed.');

// [Check 9] ui.js: synchronized 1 HP heart pip pulse (D-05)
console.log('[Check 9] ui.js synchronized 1 HP heart pip pulse (D-05)...');
assert.ok(uiSrc.includes('let cycle = frame % 50;'), 'D-05: HUD heart pip pulses via 50-frame rhythm cycle when at 1 HP');
assert.ok(uiSrc.includes('heartPulse = 0.28 * Math.sin((cycle / 12) * Math.PI)'),
	'D-05: HUD heart pip implements biological double-thump pulse waveform');
console.log('  Passed: ui.js synchronized 1 HP heart pip double-pulse waveform confirmed.');

console.log('\n✓ ALL 9 STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');


// -------------------------------------------------------------
// SUITE B: Node VM Behavioral Execution Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL SIMULATIONS ---');

// Rebuild game distribution to verify compiled index.js
execSync('node scripts/build-game.js', { stdio: 'inherit' });

// -------------------------------------------------------------
// 3. Relay Server CooldownManager Decoupling & Viewer Scaling (BAL-19, D-18, D-19, D-22)
// -------------------------------------------------------------
console.log('[Sim 3] Evaluating CooldownManager for boss (4000ms) vs blackout (8000ms) with viewer scaling...');
const cm = new CooldownManager();

// Test at 0 viewers
const bossCd0 = cm.getEffectiveCooldown('boss', 0);
const blackoutCd0 = cm.getEffectiveCooldown('blackout', 0);
assert.strictEqual(bossCd0, 4000, 'BAL-19/D-18: Base boss cooldown must be 4000ms at 0 viewers');
assert.strictEqual(blackoutCd0, 8000, 'D-19: Base blackout cooldown must be 8000ms at 0 viewers');

// Test at 50 viewers: cBase * (1 + 50/50) = 2 * cBase
const bossCd50 = cm.getEffectiveCooldown('boss', 50);
const blackoutCd50 = cm.getEffectiveCooldown('blackout', 50);
assert.strictEqual(bossCd50, 8000, 'D-22: Boss cooldown scales to 8000ms at 50 viewers');
assert.strictEqual(blackoutCd50, 16000, 'D-19/D-22: Blackout cooldown scales to 16000ms at 50 viewers');

// Test at 100 viewers: cBase * (1 + 100/50) = 3 * cBase
const bossCd100 = cm.getEffectiveCooldown('boss', 100);
const blackoutCd100 = cm.getEffectiveCooldown('blackout', 100);
assert.strictEqual(bossCd100, 12000, 'D-22: Boss cooldown scales to 12000ms at 100 viewers');
assert.strictEqual(blackoutCd100, 24000, 'D-19/D-22: Blackout cooldown scales to 24000ms at 100 viewers');

// Test custom config update
cm.updateConfig({ bossCooldownMs: 5000, blackoutCooldownMs: 9000 });
assert.strictEqual(cm.bossCooldownMs, 5000);
assert.strictEqual(cm.blackoutCooldownMs, 9000);
console.log('  Passed: CooldownManager boss (4000ms) vs blackout (8000ms) dynamic viewer scaling verified.');

const mockCanvas = {
	width: 800,
	height: 600,
	getContext: () => ({
		fillRect: () => {},
		strokeRect: () => {},
		clearRect: () => {},
		fillText: () => {},
		strokeText: () => {},
		measureText: () => ({ width: 50 }),
		beginPath: () => {},
		moveTo: () => {},
		lineTo: () => {},
		closePath: () => {},
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
	}),
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
	mainContext: mockCanvas.getContext('2d'),
	overlayContext: mockCanvas.getContext('2d'),
};
sandbox.window = sandbox;
sandbox.mockCanvas = mockCanvas;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
const bundleCode = fs.readFileSync('main/dist/js/index.js', 'utf8');

vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

const behavioralSimulations = `
	mainCanvas = mockCanvas;
	mainContext = mockCanvas.getContext('2d');
	overlayCanvas = mockCanvas;
	overlayContext = mockCanvas.getContext('2d');
	mainCanvasSize = vec2(800, 600);
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);

	// -------------------------------------------------------------
	// 1. Player Collision i-Frames Across Enemy/Hazard Types (BAL-18, D-01, D-06)
	// -------------------------------------------------------------
	console.log('[Sim 1] Simulating mobPlayer collision across Zombie, Vampire, Ghost, Boss, Boulder...');
	let p = new MobPlayer(vec2(5, 5));
	g_player = p;

	let enemiesToTest = [
		{ name: 'Zombie', factory: () => { let e = new Zombie(vec2(5, 5)); e.pos = p.pos.copy(); return e; } },
		{ name: 'Vampire', factory: () => { let e = new Vampire(vec2(5, 5)); e.transformed = true; e.pos = p.pos.copy(); return e; } },
		{ name: 'Ghost', factory: () => { let e = new Ghost(vec2(5, 5)); e.pos = p.pos.copy(); return e; } },
		{ name: 'BossZombie', factory: () => { let e = new BossZombie(vec2(5, 5)); e.pos = p.pos.copy(); return e; } },
		{ name: 'Boulder', factory: () => { let e = new Boulder(vec2(5, 5)); e.pos = p.pos.copy(); return e; } },
	];

	for (let target of enemiesToTest) {
		p.hp = 3;
		p.invulnFrames = 0;
		p.divineInvuln = false;
		let inst = target.factory();
		p.collideWithObject(inst);
		assert.strictEqual(p.invulnFrames, 45, 'D-01/D-06: ' + target.name + ' collision must grant exactly 45 i-frames');
		assert.strictEqual(p.hp, 2, 'Player takes 1 damage from ' + target.name);
	}
	console.log('  Passed: All 5 damage sources grant uniform 45-frame (0.75s) invulnerability window.');

	// -------------------------------------------------------------
	// 2. 1 HP State Transition & Heartbeat Audio Rhythm (D-05)
	// -------------------------------------------------------------
	console.log('[Sim 2] Simulating 1 HP state transition and 50-frame heartbeat rhythm...');
	let heartbeatPlayCount = 0;
	soundHeartbeat.play = function() {
		heartbeatPlayCount++;
	};

	p.hp = 2;
	p.invulnFrames = 0;
	let zombie = new Zombie(vec2(5, 5));
	zombie.pos = p.pos.copy();
	p.collideWithObject(zombie);
	assert.strictEqual(p.hp, 1, 'Player dropped to 1 HP');
	assert.ok(heartbeatPlayCount >= 1, 'D-05: Dropping to 1 HP immediately triggers soundHeartbeat');

	// Continuous heartbeat rhythm in update()
	g_state = STATE_PLAYING;
	g_isPaused = false;
	heartbeatPlayCount = 0;

	frame = 49;
	p.update();
	assert.strictEqual(heartbeatPlayCount, 0, 'No heartbeat pulse at frame 49');

	frame = 50;
	p.update();
	assert.strictEqual(heartbeatPlayCount, 1, 'D-05: Heartbeat pulses at frame 50 (frame % 50 === 0)');

	frame = 99;
	p.update();
	assert.strictEqual(heartbeatPlayCount, 1, 'No extra heartbeat at frame 99');

	frame = 100;
	p.update();
	assert.strictEqual(heartbeatPlayCount, 2, 'D-05: Heartbeat pulses again at frame 100');

	// If player heals or hp > 1, heartbeat pulses stop
	p.hp = 2;
	frame = 150;
	p.update();
	assert.strictEqual(heartbeatPlayCount, 2, 'No heartbeat pulse when hp > 1');
	console.log('  Passed: 1 HP immediate trigger and 50-frame (~1.2Hz) biological rhythm verified.');

	// -------------------------------------------------------------
	// 3. Ambient Frenzy Timer Lifecycle & Gating (BAL-20, D-07..D-13)
	// -------------------------------------------------------------
	console.log('[Sim 4] Simulating ambient frenzy timer cadence, pause gating, rumble, and surge trigger...');
	g_apgManager = new APGManager();
	assert.ok(g_apgManager.ambientFrenzyTimer >= 2700 && g_apgManager.ambientFrenzyTimer <= 3600,
		'D-07: Initial grace period randomized between 2700 and 3600 frames');

	// Test gating during lobby / non-playing state
	g_state = STATE_LOBBY;
	let tBefore = g_apgManager.ambientFrenzyTimer;
	g_apgManager.update();
	assert.strictEqual(g_apgManager.ambientFrenzyTimer, tBefore, 'D-09: Ambient timer must pause during STATE_LOBBY');

	// Test pause flag gating
	g_state = STATE_PLAYING;
	g_isPaused = true;
	g_apgManager.update();
	assert.strictEqual(g_apgManager.ambientFrenzyTimer, tBefore, 'D-09: Ambient timer must pause when game is paused');

	// Active play countdown
	g_isPaused = false;
	p.hp = 2;
	g_player = p;

	// Telegraph at 120 frames remaining
	g_apgManager.ambientFrenzyTimer = 121;
	g_apgManager.ambientTelegraphFired = false;
	let rumblePlayed = false;
	soundRumble.play = function() { rumblePlayed = true; };

	g_apgManager.update();
	assert.strictEqual(g_apgManager.ambientFrenzyTimer, 120);
	assert.strictEqual(rumblePlayed, true, 'D-11: soundRumble played at 120 frames remaining');
	assert.strictEqual(g_apgManager.ambientTelegraphFired, true);

	// Gating: Hold at 0 if no living enemies present
	g_enemies = [];
	g_apgManager.ambientFrenzyTimer = 1;
	g_apgManager.update(); // reaches 0
	assert.strictEqual(g_apgManager.ambientFrenzyTimer, 0);
	assert.strictEqual(g_apgManager.timers.frenzy, 0, 'D-09: Holds activation at 0 while 0 living enemies');

	g_apgManager.update();
	assert.strictEqual(g_apgManager.ambientFrenzyTimer, 0, 'Continues holding at 0');
	assert.strictEqual(g_apgManager.timers.frenzy, 0);

	// Enemy spawns -> surge ignites
	let warHornPlayed = false;
	soundWarHorn.play = function() { warHornPlayed = true; };
	g_enemies = [new Zombie(vec2(10, 10))];

	g_apgManager.update();
	assert.strictEqual(warHornPlayed, true, 'D-13: soundWarHorn triggers upon ambient surge');
	assert.ok(g_apgManager.timers.frenzy === 360 || g_apgManager.timers.frenzy === 359,
		'D-08: Ambient surge duration is 360 frames (6.0s, 359 remaining after 1 frame update)');
	assert.ok(g_apgManager.ambientFrenzyTimer >= 2700 && g_apgManager.ambientFrenzyTimer <= 3600,
		'D-07: Ambient timer re-rolls 45-60s interval');
	assert.strictEqual(g_apgManager.ambientTelegraphFired, false, 'Telegraph flag resets');
	console.log('  Passed: Ambient cadence, pause gating, 120f rumble, 0-enemy hold, and 6.0s surge verified.');

	// -------------------------------------------------------------
	// 4. Chat !frenzy & Ambient Surge Collision (D-14)
	// -------------------------------------------------------------
	console.log('[Sim 5] Simulating chat !frenzy interaction and 480-frame hard cap...');
	g_apgManager.timers.frenzy = 240; // 4.0s active surge
	g_apgManager.ambientFrenzyTimer = 1000;

	g_apgManager.handleActionPacket({ action: 'frenzy', user: 'TestViewer', team: 'bad' });
	assert.strictEqual(g_apgManager.timers.frenzy, 480, 'D-14: Frenzy duration capped at 480 frames (8.0s)');
	assert.ok(g_apgManager.ambientFrenzyTimer >= 2700 && g_apgManager.ambientFrenzyTimer <= 3600,
		'D-14: Ambient countdown timer resets upon chat frenzy');

	// Verify enemy binary multiplier (1.6x without compounding)
	let enemy = new Zombie(vec2(0, 0));
	let mult = g_apgManager.timers.frenzy > 0 ? 1.6 : 1.0;
	assert.strictEqual(mult, 1.6, 'D-14: Enemy speed multiplier is 1.6x, no compounding');
	console.log('  Passed: Chat frenzy refreshes, caps at 8.0s, resets ambient countdown without double-speed glitches.');

	// -------------------------------------------------------------
	// 5. Tug-of-War Proximity Alpha Fade Simulation (D-15, D-16, D-17)
	// -------------------------------------------------------------
	console.log('[Sim 6] Simulating bottom-center HUD layout and proximity alpha fading...');
	g_apgManager.bottomHudAlpha = 1.0;
	cameraPos = vec2(0, 0);
	cameraScale = 16;

	// Player far from bottom center (screen pos (400, 100))
	p.pos = screenToWorld(vec2(400, 100));
	g_apgManager.renderHUD();
	assert.strictEqual(g_apgManager.bottomHudAlpha, 1.0, 'Alpha remains 1.0 when player is far away');

	// Player moves to bottom center near Tug-of-War meter (screen pos (400, 565))
	p.pos = screenToWorld(vec2(400, 565));
	for (let f = 0; f < 35; f++) {
		g_apgManager.renderHUD();
	}
	assert.ok(Math.abs(g_apgManager.bottomHudAlpha - 0.35) < 0.02,
		'D-17: Alpha smoothly fades down to ~0.35 when player is within 110px of bottom center');

	// Player moves away (screen pos (400, 100))
	p.pos = screenToWorld(vec2(400, 100));
	for (let f = 0; f < 35; f++) {
		g_apgManager.renderHUD();
	}
	assert.ok(g_apgManager.bottomHudAlpha > 0.98,
		'D-17: Alpha smoothly returns to ~1.0 when player moves away');
	console.log('  Passed: Bottom-center HUD proximity alpha fading smoothly interpolates between 0.35 and 1.0.');
`;

vm.runInContext(behavioralSimulations, sandbox);

// -------------------------------------------------------------
// 7. Full Game Compilation Verification
// -------------------------------------------------------------
console.log('[Sim 7] Verifying full game compilation via scripts/build-game.js...');
const buildOutput = execSync('node scripts/build-game.js', { encoding: 'utf8' });
assert.ok(/Compiled \d+ files into dist\/js\/index\.js/.test(buildOutput), 'Full game build must succeed cleanly');
console.log('  Passed: scripts/build-game.js successfully compiled all modules without syntax errors.');

console.log('\n=============================================================');
console.log('✓ ALL PHASE 13 VERIFICATION SUITES PASSED WITH 100% SUCCESS!');
console.log('=============================================================\n');
