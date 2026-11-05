import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('--- STARTING PHASE 6 MULTI-WEAPON AMMO ECONOMY TEST SUITE ---');

// 1. Static Verification Checks
const defsSrc = fs.readFileSync('main/src/js/DEFS.js', 'utf8');
const playerSrc = fs.readFileSync('main/src/js/mobPlayer.js', 'utf8');
const ammoBoxSrc = fs.readFileSync('main/src/js/ammoBox.js', 'utf8');
const enemySrc = fs.readFileSync('main/src/js/mob_enemy.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');

// BAL-10: Strict reserve caps
assert.ok(defsSrc.includes('MAX_AMMO_BULLETS = 36'), 'BAL-10: MAX_AMMO_BULLETS is 36 in DEFS.js');
assert.ok(defsSrc.includes('MAX_AMMO_SHELLS = 12'), 'BAL-10: MAX_AMMO_SHELLS is 12 in DEFS.js');
assert.ok(defsSrc.includes('MAX_AMMO_RIFLE = 8'), 'BAL-10: MAX_AMMO_RIFLE is 8 in DEFS.js');
assert.ok(playerSrc.includes('clampAmmo()'), 'BAL-10: MobPlayer has clampAmmo method');

// BAL-11: Scavenged clips vs full boxes
assert.ok(ammoBoxSrc.includes('this.isScavenged = Boolean(isScavenged)'), 'BAL-11: AmmoBox tracks isScavenged flag');
assert.ok(ammoBoxSrc.includes('g_player.ammoBullets += 5'), 'BAL-11: Scavenged bullet clip yields +5');
assert.ok(ammoBoxSrc.includes('g_player.ammoShells += 2'), 'BAL-11: Scavenged shell clip yields +2');
assert.ok(ammoBoxSrc.includes('g_player.ammoRifle += 1'), 'BAL-11: Scavenged rifle clip yields +1');

// BAL-12: 20% drop rate and low-ammo clutch
assert.ok(enemySrc.includes('rand() < 0.20'), 'BAL-12: Base drop rate is 20% in mob_enemy.js');
assert.ok(enemySrc.includes('reserve < (gunTile === tileNumbers_shotgun ? 2 : gunTile === tileNumbers_rifle ? 2 : 6)'), 'BAL-12: Weapon-specific low-ammo clutch threshold in mob_enemy.js');
assert.ok(enemySrc.includes('new AmmoBox(this.pos.copy(), gunTile, null, true)'), 'BAL-12: Slain regular enemies spawn scavenged AmmoBox with null attribution');

// BAL-13: Balanced multi-weapon care packages
assert.ok(ammoBoxSrc.includes('g_player.ammoShells += 4') && ammoBoxSrc.includes('g_player.ammoRifle += 2'), 'BAL-13: Tailored care package yields based on equipped weapon');
assert.ok(apgSrc.includes('new AmmoBox(pos, gunTile, rawUser, false)'), 'BAL-13: Audience !ammo action spawns care package with isScavenged=false');

// BAL-14: Starting loadout & level transition clamping
assert.ok(playerSrc.includes('this.ammoBullets = 12'), 'BAL-14: MobPlayer starts with 12 reserve bullets (18 total with pistol)');
assert.ok(mainSrc.includes('Math.min(g_player.ammoBullets, MAX_AMMO_BULLETS)'), 'BAL-14: enterLobbyState clamps saved bullets');
assert.ok(mainSrc.includes('Math.min(g_player.ammoShells, MAX_AMMO_SHELLS)'), 'BAL-14: enterLobbyState clamps saved shells');
assert.ok(mainSrc.includes('Math.min(g_player.ammoRifle, MAX_AMMO_RIFLE)'), 'BAL-14: enterLobbyState clamps saved rifle');
assert.ok(mainSrc.includes('g_player.clampAmmo()'), 'BAL-14: startNextLevel invokes clampAmmo');

// HUD MAX indicator
assert.ok(uiSrc.includes('bulletCapped') && uiSrc.includes('MAX'), 'BAL-10/BAL-14: ui.js renders MAX indicator badge');
assert.ok(uiSrc.includes('colorSpark'), 'BAL-10/BAL-14: ui.js renders gold colorSpark on capped ammo');

console.log('✓ All 15 static checks PASSED!');

// 2. Behavioral VM execution checks
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

const testCode = `
	mainCanvas = mockCanvas;
	mainContext = mockCanvas.getContext('2d');
	overlayCanvas = mockCanvas;
	overlayContext = mockCanvas.getContext('2d');
	mainCanvasSize = vec2(800, 600);

	// 1. Verify Player Initial Ammo
	let p = new MobPlayer(vec2(5, 5));
	g_player = p;
	assert.strictEqual(p.ammoBullets, 12, 'BAL-14: Player starts with 12 reserve bullets');
	assert.strictEqual(p.ammoShells, 0, 'BAL-14: Player starts with 0 shells');
	assert.strictEqual(p.ammoRifle, 0, 'BAL-14: Player starts with 0 rifle rounds');

	// Equip pistol
	p.gun = new Pistol(p.pos);
	p.gun.ammo = 6;
	assert.strictEqual(p.getAmmoForCurrentGun(), 18, 'BAL-14: Total starting ammo with pistol is 18 (6 loaded + 12 reserve)');

	// 2. Test Clamping
	p.ammoBullets = 100;
	p.ammoShells = 50;
	p.ammoRifle = 25;
	p.clampAmmo();
	assert.strictEqual(p.ammoBullets, 36, 'BAL-10: ammoBullets clamped to MAX_AMMO_BULLETS (36)');
	assert.strictEqual(p.ammoShells, 12, 'BAL-10: ammoShells clamped to MAX_AMMO_SHELLS (12)');
	assert.strictEqual(p.ammoRifle, 8, 'BAL-10: ammoRifle clamped to MAX_AMMO_RIFLE (8)');

	// 3. Test Scavenged Pickups
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;

	// Pick up scavenged pistol clip (+5)
	let scavBox1 = new AmmoBox(p.pos.copy(), tileNumbers_pistol, null, true);
	scavBox1.update();
	assert.strictEqual(p.ammoBullets, 15, 'BAL-11: Scavenged pistol clip gave +5 bullets');

	// Pick up scavenged shotgun clip (+2)
	let scavBox2 = new AmmoBox(p.pos.copy(), tileNumbers_shotgun, null, true);
	scavBox2.update();
	assert.strictEqual(p.ammoShells, 4, 'BAL-11: Scavenged shotgun clip gave +2 shells');

	// Pick up scavenged rifle clip (+1)
	let scavBox3 = new AmmoBox(p.pos.copy(), tileNumbers_rifle, null, true);
	scavBox3.update();
	assert.strictEqual(p.ammoRifle, 2, 'BAL-11: Scavenged rifle clip gave +1 rifle round');

	// Test pickup clamping
	p.ammoBullets = 34;
	let scavBox4 = new AmmoBox(p.pos.copy(), tileNumbers_pistol, null, true);
	scavBox4.update();
	assert.strictEqual(p.ammoBullets, 36, 'BAL-10/BAL-11: Pickup clamped at MAX_AMMO_BULLETS (36) instead of 39');

	// 4. Test Audience Care Packages (BAL-13)
	// Equipped with Pistol:
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;
	let careBox1 = new AmmoBox(p.pos.copy(), tileNumbers_pistol, "testUser1", false);
	careBox1.update();
	assert.strictEqual(p.ammoBullets, 22, 'BAL-13: Care package gave +12 pistol bullets to pistol user');
	assert.strictEqual(p.ammoShells, 4, 'BAL-13: Care package gave +2 shells bonus');
	assert.strictEqual(p.ammoRifle, 2, 'BAL-13: Care package gave +1 rifle bonus');

	// Equipped with Shotgun:
	p.gun = new Shotgun(p.pos);
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;
	let careBox2 = new AmmoBox(p.pos.copy(), tileNumbers_shotgun, "testUser2", false);
	careBox2.update();
	assert.strictEqual(p.ammoShells, 6, 'BAL-13: Care package gave +4 shells to shotgun user');
	assert.strictEqual(p.ammoBullets, 16, 'BAL-13: Care package gave +6 bullets bonus');
	assert.strictEqual(p.ammoRifle, 2, 'BAL-13: Care package gave +1 rifle bonus');

	// Equipped with Rifle:
	p.gun = new Rifle(p.pos);
	p.ammoBullets = 10;
	p.ammoShells = 2;
	p.ammoRifle = 1;
	let careBox3 = new AmmoBox(p.pos.copy(), tileNumbers_rifle, "testUser3", false);
	careBox3.update();
	assert.strictEqual(p.ammoRifle, 3, 'BAL-13: Care package gave +2 rifle rounds to rifle user');
	assert.strictEqual(p.ammoBullets, 16, 'BAL-13: Care package gave +6 bullets bonus');
	assert.strictEqual(p.ammoShells, 4, 'BAL-13: Care package gave +2 shells bonus');

	console.log('✓ All VM behavioral tests PASSED successfully!');
`;

vm.runInContext(testCode, sandbox);
console.log('--- ALL PHASE 6 CHECKS PASSED WITH ZERO ERRORS ---');
