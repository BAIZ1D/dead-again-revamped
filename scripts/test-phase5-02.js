import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('--- STARTING PLAN 05-02 BALANCED GAMEPLAY TEST SUITE ---');

// 1. Static Verification Checks
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const enemySrc = fs.readFileSync('main/src/js/mob_enemy.js', 'utf8');
const playerSrc = fs.readFileSync('main/src/js/mobPlayer.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const gunSrc = fs.readFileSync('main/src/js/gunPistol.js', 'utf8');

assert.ok(apgSrc.includes('caps = [15, 18, 20, 23, 25]'), 'BAL-05: caps array defined in apgManager.js');
assert.ok(mainSrc.includes('getMaxActiveMobs(g_level)'), 'BAL-05: main.js calls getMaxActiveMobs(g_level)');
assert.ok(apgSrc.includes('spawnTelegraphFrames = 72'), 'BAL-06: 72 frames telegraph in apgManager.js');
assert.ok(enemySrc.includes('this.spawnTelegraphFrames > 0'), 'BAL-06: enemy pauses during telegraph in mob_enemy.js');
assert.ok(playerSrc.includes('this.maxHp = 4'), 'BAL-07: maxHp is 4 in mobPlayer.js');
assert.ok(playerSrc.includes('this.hp = 3'), 'BAL-07: starting hp is 3 in mobPlayer.js');
assert.ok(mainSrc.includes('clamp(g_player.hp, 1, 4)'), 'BAL-07: hp clamped 1-4 in main.js');
assert.ok(playerSrc.includes('baseSpeed = 0.0115'), 'BAL-08: baseSpeed is 0.0115 (+15%) in mobPlayer.js');
assert.ok(gunSrc.includes('this.reloadTimePerBullet = 0.18'), 'BAL-09: reloadTimePerBullet is 0.18 in gunPistol.js');
console.log('✓ All static checks PASSED');

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
		body: { appendChild: () => {} },
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
	// Initialize Mock Game World
	mainCanvas = mockCanvas;
	mainContext = mockCanvas.getContext('2d');
	overlayCanvas = mockCanvas;
	overlayContext = mockCanvas.getContext('2d');
	mainCanvasSize = vec2(800, 600);
	tileImageSize = vec2(128, 128);
	tileFixBleedScale = 0;
	mapMan = { renderFOW: () => {} };
	cameraPos = vec2(10, 10);
	cameraScale = 16;
	frame = 100;

	// Verify getMaxActiveMobs for all levels 0..4 (and out-of-bounds)
	assert.strictEqual(getMaxActiveMobs(0), 15, 'Level 1 cap should be 15');
	assert.strictEqual(getMaxActiveMobs(1), 18, 'Level 2 cap should be 18');
	assert.strictEqual(getMaxActiveMobs(2), 20, 'Level 3 cap should be 20');
	assert.strictEqual(getMaxActiveMobs(3), 23, 'Level 4 cap should be 23');
	assert.strictEqual(getMaxActiveMobs(4), 25, 'Level 5 cap should be 25');
	assert.strictEqual(getMaxActiveMobs(10), 25, 'High level cap clamped to 25');
	assert.strictEqual(getMaxActiveMobs(-1), 15, 'Negative level cap clamped to 15');

	// Verify MobPlayer starting hp and maxHp
	let p = new MobPlayer(vec2(10, 10));
	assert.strictEqual(p.hp, 3, 'Player should start with 3 HP (3 base hearts)');
	assert.strictEqual(p.maxHp, 4, 'Player maxHp should be 4');

	// Verify Pistol reload time
	let pistol = new Pistol(vec2(10, 10));
	assert.strictEqual(pistol.reloadTimePerBullet, 0.18, 'Pistol reload time per bullet should be 0.18');

	// Verify !mob in Level 1 (g_level = 0): exactly 1 zombie spawned with 72 frames telegraph
	g_state = STATE_PLAYING;
	g_level = 0;
	g_levelDef = levelDefs[0];
	g_enemies = [];
	g_transforms = [];
	g_player = p;
	g_apgManager.handleActionPacket({ action: 'mob', team: 'bad', user: 'TestViewer' });
	assert.strictEqual(g_enemies.length, 1, 'Level 1 !mob should spawn exactly 1 zombie');
	assert.strictEqual(g_enemies[0].spawnTelegraphFrames, 72, 'Spawned zombie should have 72 telegraph frames');

	// Verify telegraph disables enemy movement & touch damage
	let z = g_enemies[0];
	z.velocity = vec2(5, 5);
	z.update();
	assert.strictEqual(z.spawnTelegraphFrames, 71, 'Telegraph decrements');
	assert.strictEqual(z.velocity.x, 0, 'Velocity is zeroed');
	assert.strictEqual(z.velocity.y, 0, 'Velocity is zeroed');
	assert.strictEqual(p.collideWithObject(z), false, 'Player cannot be hurt while enemy is telegraphing');
	assert.strictEqual(p.hp, 3, 'Player hp remains intact');

	// Verify !mob in Level 3 (g_level = 2): flanker mob pair spawned
	g_level = 2;
	g_enemies = [];
	g_apgManager.handleActionPacket({ action: 'mob', team: 'bad', user: 'TestViewer2' });
	assert.strictEqual(g_enemies.length, 2, 'Level 3 !mob should spawn flanker pair (2 zombies)');
	assert.strictEqual(g_enemies[0].spawnTelegraphFrames, 72, 'First zombie has 72 frames telegraph');
	assert.strictEqual(g_enemies[1].spawnTelegraphFrames, 72, 'Second zombie has 72 frames telegraph');

	// Verify 4th shield pip via !repair
	p.hp = 3;
	g_apgManager.handleActionPacket({ action: 'repair', team: 'good', user: 'Healer' });
	assert.strictEqual(p.hp, 4, 'Repair should increase player hp to 4 (golden shield pip)');
`;

sandbox.assert = assert;
vm.runInContext(testCode, sandbox);

console.log('✓ All behavioral VM execution checks PASSED');
console.log('======================================================');
console.log('ALL PLAN 05-02 BALANCED GAMEPLAY SPECIFICATIONS VERIFIED!');
console.log('======================================================');
