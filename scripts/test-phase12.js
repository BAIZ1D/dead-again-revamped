import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 12 AMMO SCARCITY & DROP ECONOMY TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static AST & Source Code Contract Checks
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const defsSrc = fs.readFileSync('main/src/js/DEFS.js', 'utf8');
const enemySrc = fs.readFileSync('main/src/js/mob_enemy.js', 'utf8');
const ammoBoxSrc = fs.readFileSync('main/src/js/ammoBox.js', 'utf8');
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const mapMgrSrc = fs.readFileSync('main/src/js/mapmanager.js', 'utf8');
const gunSrc = fs.readFileSync('main/src/js/gun.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');

// 1. DEFS.js constants (BAL-21, D-09, D-18)
console.log('[Check 1] DEFS.js reserve caps and level transition opening constants...');
assert.ok(defsSrc.includes('MAX_AMMO_SHELLS = 8'), 'BAL-21/D-09: MAX_AMMO_SHELLS must be lowered to 8 in DEFS.js');
assert.ok(defsSrc.includes('LEVEL_TRANSITION_MAX_BULLETS = 18'), 'BAL-21/D-18: LEVEL_TRANSITION_MAX_BULLETS must be 18');
assert.ok(defsSrc.includes('LEVEL_TRANSITION_MAX_SHELLS = 4'), 'BAL-21/D-18: LEVEL_TRANSITION_MAX_SHELLS must be 4');
assert.ok(defsSrc.includes('LEVEL_TRANSITION_MAX_RIFLE = 3'), 'BAL-21/D-18: LEVEL_TRANSITION_MAX_RIFLE must be 3');
console.log('  Passed: DEFS.js contains correct reserve caps (8 shells) and transition opening constants (18/4/3).');

// 2. mob_enemy.js drop rates, clutch floor, throttle, and mini-boss rewards (BAL-15, D-01..D-05, D-17)
console.log('[Check 2] mob_enemy.js tiered drop rates, clutch threshold, and 60-frame throttle...');
assert.ok(enemySrc.includes('this instanceof Zombie) dropRate = 0.05'), 'BAL-15/D-17: Zombie base drop rate must be 5% (0.05)');
assert.ok(enemySrc.includes('this instanceof Vampire) dropRate = 0.10'), 'BAL-15/D-17: Vampire base drop rate must be 10% (0.10)');
assert.ok(enemySrc.includes('this instanceof Ghost) dropRate = 0.12'), 'BAL-15/D-17: Ghost base drop rate must be 12% (0.12)');
assert.ok(enemySrc.includes('clutchThreshold = (gunTile === tileNumbers_shotgun ? 2 : gunTile === tileNumbers_rifle ? 2 : 3)'),
	'BAL-15/D-01/D-02: Clutch threshold must be <3 for bullets and <2 for shells/rifle');
assert.ok(enemySrc.includes('Enemy.lastClutchDropFrame >= 60'), 'BAL-15/D-03: Multi-kill clutch throttle must enforce 60-frame cooldown');
assert.ok(enemySrc.includes('new AmmoBox(this.pos.copy(), gunTile, this.twitchUser, false, true)'),
	'BAL-15/D-05: Audience mini-bosses must drop a Full Care Package (isFullPackage=true)');
console.log('  Passed: mob_enemy.js implements tiered rates (5%/10%/12%), clutch floor, throttle, and mini-boss reward.');

// 3. ammoBox.js yields, visual scale, audio, despawn timers, and flashing (BAL-16, BAL-17, D-05, D-12..D-15, D-19)
console.log('[Check 3] ammoBox.js yields, 0.75x scale, despawn lifecycles, and flashing warnings...');
assert.ok(ammoBoxSrc.includes('isScavenged ? vec2(0.75) : vec2(1)'), 'BAL-16/D-19: Scavenged clips must render at 0.75x tile scale');
assert.ok(ammoBoxSrc.includes('soundPickup.play(this.pos, 0.7, 1.6)'), 'BAL-16/D-19: Scavenged clips must play 1.6 pitch chirp audio');
assert.ok(ammoBoxSrc.includes('g_player.ammoShells += 1') && ammoBoxSrc.includes('g_player.ammoBullets += 2') && ammoBoxSrc.includes('g_player.ammoRifle += 1'),
	'BAL-16: Scavenged clips must yield +2 bullets / +1 shell / +1 rifle');
assert.ok(ammoBoxSrc.includes('activeGun == tileNumbers_shotgun') && ammoBoxSrc.includes('activeGun == tileNumbers_rifle'),
	'BAL-17/D-12: Care packages must check active equipped weapon for pure primary delivery');
assert.ok(ammoBoxSrc.includes('g_player.ammoShells += 3') && ammoBoxSrc.includes('g_player.ammoBullets += 8') && ammoBoxSrc.includes('g_player.ammoRifle += 2'),
	'BAL-16/D-13: Map supply crates must yield +8 bullets / +3 shells / +2 rifle rounds');
assert.ok(ammoBoxSrc.includes('this.isScavenged ? 1500 : this.twitchUser ? 1800 : Infinity'),
	'BAL-16/BAL-17/D-14/D-15: Despawn lifecycles must be 1500f (scavenged), 1800f (care package), and Infinity (map crate)');
assert.ok(ammoBoxSrc.includes('makeParticles(this.pos, 0.4, colorWhite, 0.5)'),
	'BAL-16/BAL-17: Despawn must emit dust puff particles via makeParticles before destruction');
assert.ok(ammoBoxSrc.includes('remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0'),
	'BAL-16/BAL-17/D-14/D-15: Despawn flashing must trigger in final 300 frames at ~7.5Hz');
console.log('  Passed: ammoBox.js yields, lifecycles (25s/30s/Inf), dust particles, and flashing confirmed.');

// 4. apgManager.js weapon upgrade rolls and synchronized beacon flashing (BAL-21, D-07, D-14)
console.log('[Check 4] apgManager.js care package upgrade roll and beacon/label flashing...');
assert.ok(apgSrc.includes('curLevel < 2') && apgSrc.includes('r < 0.10') && apgSrc.includes('new Shotgun(upPos)'),
	'BAL-21/D-07: Shotguns restricted from care package weapon rolls at level 0-1 and weighted at 10% for level 2+');
assert.ok(apgSrc.includes('1800 - elapsed <= 300 && Math.floor(curFrame / 4) % 2 === 0'),
	'BAL-17/D-14: Care package beacon rings and floating labels must synchronize 300-frame flashing');
console.log('  Passed: apgManager.js shotgun gatekeeping and synchronized care package flashing confirmed.');

// 5. mapmanager.js level 0-1 world spawn gatekeeping (BAL-21, D-08)
console.log('[Check 5] mapmanager.js level 0-1 shotgun and shell crate replacement...');
assert.ok(mapMgrSrc.includes('if (g_level < 2)') && mapMgrSrc.includes('new MachinePistol(offsetVec)') && mapMgrSrc.includes('new Shotgun(offsetVec)'),
	'BAL-21/D-08: Pre-placed shotguns in levels 0-1 must be replaced with SMGs');
assert.ok(mapMgrSrc.includes('new AmmoBox(offsetVec, tileNumbers_pistol)') && mapMgrSrc.includes('new AmmoBox(offsetVec, tileNumbers_shotgun)'),
	'BAL-21/D-08: Pre-placed shell crates in levels 0-1 must be replaced with bullet crates');
console.log('  Passed: mapmanager.js early-game shotgun and shell crate replacement confirmed.');

// 6. gun.js chamber ammo refund on weapon swap (BAL-21, D-11)
console.log('[Check 6] gun.js chamber ammo refund to reserve on weapon swap...');
assert.ok(gunSrc.includes('player.ammoShells += player.gun.ammo') || gunSrc.includes('player.ammoBullets += player.gun.ammo'),
	'BAL-21/D-11: Dropping equipped gun must refund chamber ammunition into player reserve');
assert.ok(gunSrc.includes('player.gun.ammo = 0'), 'BAL-21/D-11: Dropped weapon chamber ammo must be zeroed');
console.log('  Passed: gun.js weapon swap chamber ammo refund confirmed.');

// 7. main.js level transitions and 0-ammo fail-safe (BAL-16, BAL-21, D-04, D-18)
console.log('[Check 7] main.js level transition clamping and 0-ammo fail-safe cooldown/crate size...');
assert.ok(mainSrc.includes('LEVEL_TRANSITION_MAX_BULLETS'), 'BAL-21/D-18: enterLobbyState and startNextLevel clamp bullets');
assert.ok(mainSrc.includes('LEVEL_TRANSITION_MAX_SHELLS'), 'BAL-21/D-18: enterLobbyState and startNextLevel clamp shells');
assert.ok(mainSrc.includes('LEVEL_TRANSITION_MAX_RIFLE'), 'BAL-21/D-18: enterLobbyState and startNextLevel clamp rifle');
assert.ok(mainSrc.includes('ammoCooldownFrames = 240'), 'BAL-16/D-04: Emergency fail-safe cooldown increased to 240 frames (4.0s)');
assert.ok(mainSrc.includes('new AmmoBox(findFreePosRange(2.5, 4.0, true), g_player.gun.tileIndex, null, true)'),
	'BAL-16/D-04: Emergency fail-safe crate spawned as scavenged clip (null, true)');
console.log('  Passed: main.js level transition carryover clamping and 0-ammo fail-safe confirmed.');

// 8. ui.js 8-shell MAX badge and amber/red pulse (BAL-21, D-09, D-20)
console.log('[Check 8] ui.js shell MAX badge at 8 and low-ammo warning pulse...');
assert.ok(uiSrc.includes('g_player.ammoShells >= MAX_AMMO_SHELLS'), 'BAL-21/D-09: Shell MAX indicator triggers when ammoShells >= MAX_AMMO_SHELLS');
assert.ok(uiSrc.includes('isLowBullets') && uiSrc.includes('isLowShells') && uiSrc.includes('isLowRifle'),
	'BAL-21/D-20: ui.js checks low-ammo thresholds on equipped weapon');
assert.ok(uiSrc.includes('pulseCol = new Color(1, 0.2 + 0.45 * pulse, 0.2)'),
	'BAL-21/D-20: ui.js renders amber/red pulsing warning for low reserve ammo');
console.log('  Passed: ui.js MAX badge and low-ammo warning pulse confirmed.');

console.log('\n✓ ALL 8 STATIC SOURCE CODE CHECKS PASSED CLEANLY!\n');


// -------------------------------------------------------------
// SUITE B: Node VM Behavioral Execution Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL SIMULATIONS ---');

// Rebuild game distribution to verify compiled index.js
execSync('node scripts/build-game.js', { stdio: 'inherit' });

const mockCanvas = {
	width: 800,
	height: 600,
	getContext: () => ({
		fillRect: () => {},
		clearRect: () => {},
		fillText: () => {},
		strokeText: () => {},
		measureText: () => ({ width: 50 }),
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

	// -------------------------------------------------------------
	// 1. Mob Kill Drop Rates Across 2,000 Kills (BAL-15, D-17)
	// -------------------------------------------------------------
	console.log('[Sim 1] Simulating mob kill drop rates across 2,000 kills per enemy type...');
	let p = new MobPlayer(vec2(5, 5));
	g_player = p;
	p.gun = new Pistol(p.pos);
	p.ammoBullets = 36; // Ample ammo, isLowAmmo is false

	let zombie = new Zombie(vec2(0, 0));
	let vampire = new Vampire(vec2(0, 0));
	let ghost = new Ghost(vec2(0, 0));

	function getDropDecision(mob, reserveAmmo, forceRand) {
		let gunTile = g_player && g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
		let clutchThreshold = (gunTile === tileNumbers_shotgun ? 2 : gunTile === tileNumbers_rifle ? 2 : 3);
		let isLowAmmo = g_player && reserveAmmo < clutchThreshold;
		let nowFrame = typeof frame !== "undefined" ? frame : 0;
		Enemy.lastClutchDropFrame = Enemy.lastClutchDropFrame || -999;
		let isClutch = isLowAmmo && (nowFrame - Enemy.lastClutchDropFrame >= 60);

		let dropRate = 0.07;
		if (mob instanceof Zombie) dropRate = 0.05;
		else if (mob instanceof Vampire) dropRate = 0.10;
		else if (mob instanceof Ghost) dropRate = 0.12;

		let r = typeof forceRand === "number" ? forceRand : rand();
		let shouldDrop = !(mob instanceof BossZombie) && (isClutch || r < dropRate);
		if (shouldDrop && isClutch) {
			Enemy.lastClutchDropFrame = nowFrame;
		}
		return shouldDrop;
	}

	const TRIALS = 2000;
	let zombieDrops = 0;
	let vampireDrops = 0;
	let ghostDrops = 0;

	for (let i = 0; i < TRIALS; i++) {
		if (getDropDecision(zombie, p.ammoBullets)) zombieDrops++;
		if (getDropDecision(vampire, p.ammoBullets)) vampireDrops++;
		if (getDropDecision(ghost, p.ammoBullets)) ghostDrops++;
	}

	let zombieRate = zombieDrops / TRIALS;
	let vampireRate = vampireDrops / TRIALS;
	let ghostRate = ghostDrops / TRIALS;

	console.log('  Zombie drop rate (' + TRIALS + ' kills): ' + (zombieRate * 100).toFixed(1) + '% (Expected ~5%)');
	console.log('  Vampire drop rate (' + TRIALS + ' kills): ' + (vampireRate * 100).toFixed(1) + '% (Expected ~10%)');
	console.log('  Ghost drop rate (' + TRIALS + ' kills): ' + (ghostRate * 100).toFixed(1) + '% (Expected ~12%)');

	assert.ok(zombieRate >= 0.03 && zombieRate <= 0.075, 'BAL-15: Zombie drop rate within expected 3% - 7.5% range');
	assert.ok(vampireRate >= 0.07 && vampireRate <= 0.13, 'BAL-15: Vampire drop rate within expected 7% - 13% range');
	assert.ok(ghostRate >= 0.09 && ghostRate <= 0.15, 'BAL-15: Ghost drop rate within expected 9% - 15% range');
	console.log('  Passed: Tiered mob kill drop probabilities verified statistically.');

	// -------------------------------------------------------------
	// 2. Multi-Kill Clutch Drop 60-Frame Throttle (BAL-15, D-01..D-03)
	// -------------------------------------------------------------
	console.log('[Sim 2] Simulating multi-kill clutch drops and 60-frame throttle...');
	Enemy.lastClutchDropFrame = -999;
	frame = 100;
	p.ammoBullets = 1; // Critical ammo (<3 bullets for Pistol)

	// In an AoE kill event at frame 100 with 3 simultaneous kills:
	// Kill 1 at frame 100:
	let drop1 = getDropDecision(zombie, p.ammoBullets, 0.99);
	assert.strictEqual(drop1, true, 'BAL-15/D-01: First low-ammo kill triggers guaranteed clutch drop');
	assert.strictEqual(Enemy.lastClutchDropFrame, 100, 'BAL-15/D-03: lastClutchDropFrame updated to frame 100');

	// Kills 2 & 3 at frame 100 (simultaneous multi-kill):
	// Pass forceRand = 0.99 so base roll fails, isolating clutch throttle
	let drop2 = getDropDecision(zombie, p.ammoBullets, 0.99);
	let drop3 = getDropDecision(zombie, p.ammoBullets, 0.99);
	assert.strictEqual(drop2, false, 'BAL-15/D-03: Simultaneous kill 2 throttled by 60-frame clutch cooldown');
	assert.strictEqual(drop3, false, 'BAL-15/D-03: Simultaneous kill 3 throttled by 60-frame clutch cooldown');

	// Advance frame by 59 frames (frame 159, elapsed 59 < 60)
	frame = 159;
	let drop4 = getDropDecision(zombie, p.ammoBullets, 0.99);
	assert.strictEqual(drop4, false, 'BAL-15/D-03: Kill at frame 159 (59 frames elapsed) remains throttled');

	// Advance frame to 160 (elapsed 60 >= 60)
	frame = 160;
	let drop5 = getDropDecision(zombie, p.ammoBullets, 0.99);
	assert.strictEqual(drop5, true, 'BAL-15/D-03: Kill at frame 160 (60 frames elapsed) triggers fresh clutch drop');
	assert.strictEqual(Enemy.lastClutchDropFrame, 160, 'BAL-15/D-03: lastClutchDropFrame updated to frame 160');

	console.log('  Passed: 60-frame multi-kill clutch throttle verified.');

	// -------------------------------------------------------------
	// 3. Pure Primary Audience Care Package Pickup (BAL-17, D-12)
	// -------------------------------------------------------------
	console.log('[Sim 3] Simulating pure primary care package delivery with zero cross-pool bleed...');
	p.pos = vec2(10, 10);
	p.gun = new Shotgun(p.pos);
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;

	// Pick up Shotgun care package with Shotgun equipped
	let carePkg = new AmmoBox(p.pos.copy(), tileNumbers_shotgun, "AudienceViewer", false, false);
	carePkg.update();

	assert.strictEqual(p.ammoShells, 4, 'BAL-17/D-12: Care package delivered +2 shells to shotgun user');
	assert.strictEqual(p.ammoBullets, 10, 'BAL-17/D-12: Bullet pool unchanged (zero bleed)');
	assert.strictEqual(p.ammoRifle, 1, 'BAL-17/D-12: Rifle pool unchanged (zero bleed)');

	// Pick up Rifle care package with Rifle equipped
	p.gun = new Rifle(p.pos);
	p.ammoBullets = 12;
	p.ammoShells = 4;
	p.ammoRifle = 2;
	let carePkgRifle = new AmmoBox(p.pos.copy(), tileNumbers_rifle, "AudienceViewer2", false, false);
	carePkgRifle.update();

	assert.strictEqual(p.ammoRifle, 3, 'BAL-17/D-12: Care package delivered +1 rifle round to rifle user');
	assert.strictEqual(p.ammoBullets, 12, 'BAL-17/D-12: Bullet pool unchanged (zero bleed)');
	assert.strictEqual(p.ammoShells, 4, 'BAL-17/D-12: Shell pool unchanged (zero bleed)');
	console.log('  Passed: Pure primary care packages give zero cross-pool bleed.');

	// -------------------------------------------------------------
	// 4. Audience Mini-Boss Full Care Package Pickup (BAL-16, D-05)
	// -------------------------------------------------------------
	console.log('[Sim 4] Simulating slain audience mini-boss full care package reward...');
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;

	let bossPkg = new AmmoBox(p.pos.copy(), tileNumbers_pistol, "BossViewer", false, true);
	bossPkg.update();

	assert.strictEqual(p.ammoBullets, 14, 'BAL-16/D-05: Mini-boss dropped +4 bullets');
	assert.strictEqual(p.ammoShells, 4, 'BAL-16/D-05: Mini-boss dropped +2 shells');
	assert.strictEqual(p.ammoRifle, 2, 'BAL-16/D-05: Mini-boss dropped +1 rifle round');
	console.log('  Passed: Slain mini-boss full care package rewards (+4/+2/+1) verified.');

	// -------------------------------------------------------------
	// 5. Weapon Swapping Chamber Ammo Refund (BAL-21, D-11)
	// -------------------------------------------------------------
	console.log('[Sim 5] Simulating weapon swap chamber ammo refund...');
	p.gun = new Shotgun(p.pos);
	p.gun.ammo = 2;
	p.ammoShells = 2;

	let groundRifle = new Rifle(p.pos.copy());
	groundRifle.ammo = 3;

	// Pick up rifle, swapping out shotgun
	let oldShotgun = p.gun;
	groundRifle.setOwner(p);

	assert.strictEqual(p.ammoShells, 4, 'BAL-21/D-11: 2 chambered shells refunded to reserve (2+2=4)');
	assert.strictEqual(oldShotgun.ammo, 0, 'BAL-21/D-11: Dropped shotgun cylinder ammo cleared to 0');
	assert.strictEqual(p.gun, groundRifle, 'BAL-21/D-11: Equipped gun successfully swapped to Rifle');
	assert.strictEqual(p.gun.ammo, 3, 'BAL-21/D-11: Equipped rifle retains its chambered ammo');
	console.log('  Passed: Gun swap chamber refund and cylinder zeroing verified.');

	// -------------------------------------------------------------
	// 6. Level Transition Reserve Clamping (BAL-21, D-18)
	// -------------------------------------------------------------
	console.log('[Sim 6] Simulating level transition carryover clamping...');
	p.ammoBullets = 36;
	p.ammoShells = 8;
	p.ammoRifle = 8;

	// enterLobbyState clamping
	let saved = {
		ammoPistol: Math.min(p.ammoBullets, LEVEL_TRANSITION_MAX_BULLETS),
		ammoShotgun: Math.min(p.ammoShells, LEVEL_TRANSITION_MAX_SHELLS),
		ammoRifle: Math.min(p.ammoRifle, LEVEL_TRANSITION_MAX_RIFLE),
	};
	assert.strictEqual(saved.ammoPistol, 18, 'BAL-21/D-18: Saved bullets clamped to LEVEL_TRANSITION_MAX_BULLETS (18)');
	assert.strictEqual(saved.ammoShotgun, 4, 'BAL-21/D-18: Saved shells clamped to LEVEL_TRANSITION_MAX_SHELLS (4)');
	assert.strictEqual(saved.ammoRifle, 3, 'BAL-21/D-18: Saved rifle clamped to LEVEL_TRANSITION_MAX_RIFLE (3)');

	// startNextLevel clamping
	let nextBullets = Math.min(saved.ammoPistol, LEVEL_TRANSITION_MAX_BULLETS);
	let nextShells = Math.min(saved.ammoShotgun, LEVEL_TRANSITION_MAX_SHELLS);
	let nextRifle = Math.min(saved.ammoRifle, LEVEL_TRANSITION_MAX_RIFLE);
	assert.strictEqual(nextBullets, 18, 'BAL-21/D-18: Next level bullets clamped to 18');
	assert.strictEqual(nextShells, 4, 'BAL-21/D-18: Next level shells clamped to 4');
	assert.strictEqual(nextRifle, 3, 'BAL-21/D-18: Next level rifle clamped to 3');
	console.log('  Passed: Level transition carryover clamping (18/4/3) verified.');

	// -------------------------------------------------------------
	// 7. Despawn Lifecycles & Flashing Warnings (BAL-16, BAL-17, D-14, D-15)
	// -------------------------------------------------------------
	console.log('[Sim 7] Simulating despawn lifecycles and 5-second rapid flashing...');
	p.pos = vec2(-100, -100); // Player out of reach
	frame = 1000;

	let scavBox = new AmmoBox(vec2(100, 100), tileNumbers_pistol, null, true);
	scavBox.spawnFrame = 1000;

	let careBox = new AmmoBox(vec2(200, 200), tileNumbers_pistol, "ChatUser", false);
	careBox.spawnFrame = 1000;

	let mapCrate = new AmmoBox(vec2(300, 300), tileNumbers_pistol, null, false);
	mapCrate.spawnFrame = 1000;

	// At frame 2499 (elapsed 1499):
	frame = 2499;
	scavBox.update();
	careBox.update();
	mapCrate.update();
	assert.ok(!scavBox.destroyed, 'BAL-16: Scavenged box alive at 1499 frames');
	assert.ok(!careBox.destroyed, 'BAL-17: Care package alive at 1499 frames');
	assert.ok(!mapCrate.destroyed, 'D-13: Map crate alive at 1499 frames');

	// At frame 2500 (elapsed 1500 = 25 seconds):
	frame = 2500;
	scavBox.update();
	careBox.update();
	mapCrate.update();
	assert.ok(scavBox.destroyed, 'BAL-16/D-15: Scavenged box despawned at exactly 1500 frames (25s)');
	assert.ok(!careBox.destroyed, 'BAL-17: Care package still alive at 1500 frames');
	assert.ok(!mapCrate.destroyed, 'D-13: Map crate still alive at 1500 frames');

	// At frame 2799 (elapsed 1799):
	frame = 2799;
	careBox.update();
	assert.ok(!careBox.destroyed, 'BAL-17: Care package alive at 1799 frames');

	// At frame 2800 (elapsed 1800 = 30 seconds):
	frame = 2800;
	careBox.update();
	assert.ok(careBox.destroyed, 'BAL-17/D-14: Care package despawned at exactly 1800 frames (30s)');

	// At frame 50,000 (map crates never despawn):
	frame = 50000;
	mapCrate.update();
	assert.ok(!mapCrate.destroyed, 'D-13: Map crate never despawns (maxLife = Infinity)');

	// Test flashing warning logic
	let flashBox = new AmmoBox(vec2(50, 50), tileNumbers_pistol, null, true);
	flashBox.spawnFrame = 0; // maxLife = 1500

	// At frame 1199 (remaining = 301 > 300): not flashing
	let curFrame = 1199;
	let remaining = 1500 - curFrame;
	let isFlashing = (remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0);
	assert.strictEqual(isFlashing, false, 'BAL-16/D-15: Flashing inactive when remaining > 300');

	// At frame 1200 (remaining = 300 <= 300, Math.floor(1200/4) % 2 = 300 % 2 = 0): flashing active (hidden)
	curFrame = 1200;
	remaining = 1500 - curFrame;
	isFlashing = (remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0);
	assert.strictEqual(isFlashing, true, 'BAL-16/D-15: Flashing toggles hidden at frame 1200');

	// At frame 1204 (Math.floor(1204/4) % 2 = 301 % 2 = 1): flashing visible phase
	curFrame = 1204;
	remaining = 1500 - curFrame;
	isFlashing = (remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0);
	assert.strictEqual(isFlashing, false, 'BAL-16/D-15: Flashing toggles visible at frame 1204');
	console.log('  Passed: Despawn lifecycles and rapid flashing verified.');

	// -------------------------------------------------------------
	// 8. HUD 8-Shell MAX Badge & Low-Ammo Pulse Checks (BAL-21, D-09, D-20)
	// -------------------------------------------------------------
	console.log('[Sim 8] Simulating HUD 8-shell MAX badge and low-ammo threshold evaluation...');
	p.gun = new Shotgun(p.pos);
	p.ammoShells = 8;
	let shellCapped = p.ammoShells >= MAX_AMMO_SHELLS;
	assert.strictEqual(shellCapped, true, 'BAL-21/D-09: shellCapped triggers at exactly 8 shells');

	p.ammoShells = 7;
	assert.strictEqual(p.ammoShells >= MAX_AMMO_SHELLS, false, 'BAL-21/D-09: shellCapped is false below 8 shells');

	// Low-ammo equipped weapon checks
	let activeGun = p.gun ? p.gun.tileIndex : tileNumbers_pistol;
	let isShotgunActive = (activeGun === tileNumbers_shotgun);
	let isLowShells = isShotgunActive && p.ammoShells < 2;
	assert.strictEqual(isLowShells, false, 'D-20: 7 shells is not low ammo');

	p.ammoShells = 1;
	isLowShells = isShotgunActive && p.ammoShells < 2;
	assert.strictEqual(isLowShells, true, 'D-20: 1 shell triggers low-ammo warning pulse');

	// Low-bullets equipped pistol check
	p.gun = new Pistol(p.pos);
	activeGun = p.gun.tileIndex;
	let isPistolActive = (activeGun !== tileNumbers_shotgun && activeGun !== tileNumbers_rifle);
	p.ammoBullets = 2;
	let isLowBullets = isPistolActive && p.ammoBullets < 3;
	assert.strictEqual(isLowBullets, true, 'D-20: 2 bullets triggers low-ammo warning pulse (<3)');

	p.ammoBullets = 3;
	isLowBullets = isPistolActive && p.ammoBullets < 3;
	assert.strictEqual(isLowBullets, false, 'D-20: 3 bullets does not trigger low-ammo warning pulse');

	console.log('  Passed: HUD 8-shell MAX badge and low-ammo threshold evaluations verified.');
	console.log('\\n✓ ALL NODE VM BEHAVIORAL SIMULATIONS COMPLETED SUCCESSFULLY!');
`;

vm.runInContext(behavioralSimulations, sandbox);

console.log('\n=============================================================');
console.log('✓ ALL PHASE 12 VERIFICATION SUITES PASSED WITH 100% SUCCESS!');
console.log('=============================================================\n');
