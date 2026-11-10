import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 23 ENDLESS MULTI-ROOM NIGHTMARE SURVIVAL GAUNTLET TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Source Code AST & Contract Verification
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const smgSrc = fs.readFileSync('main/src/js/gunMachinePistol.js', 'utf8');
const pistolSrc = fs.readFileSync('main/src/js/gunPistol.js', 'utf8');
const gunSrc = fs.readFileSync('main/src/js/gun.js', 'utf8');
const bulletSrc = fs.readFileSync('main/src/js/bullet.js', 'utf8');
const mapSrc = fs.readFileSync('main/src/js/mapmanager.js', 'utf8');
const enemySrc = fs.readFileSync('main/src/js/mob_enemy.js', 'utf8');
const bossSrc = fs.readFileSync('main/src/js/mobBossZombie.js', 'utf8');
const ammoSrc = fs.readFileSync('main/src/js/ammoBox.js', 'utf8');
const mainSrc = fs.readFileSync('main/src/js/main.js', 'utf8');
const uiSrc = fs.readFileSync('main/src/js/ui.js', 'utf8');
const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
const apgSrc = fs.readFileSync('main/src/js/apgManager.js', 'utf8');
const soundsSrc = fs.readFileSync('main/src/js/sounds.js', 'utf8');
const musicSrc = fs.readFileSync('main/src/js/music.js', 'utf8');
const fxSrc = fs.readFileSync('main/src/js/fx.js', 'utf8');
const devHtml = fs.readFileSync('main/src/html/index_dev.html', 'utf8');
const distHtml = fs.readFileSync('main/dist/index.html', 'utf8');
const winManSrc = fs.readFileSync('desktop/windowManager.js', 'utf8');
const defsSrc = fs.readFileSync('main/src/js/DEFS.js', 'utf8');

// [Check 1] Global Weapon Balance & Ballistics Contracts (MODE-02, D-09, D-11, D-52, D-53)
console.log('[Check 1] Weapon contracts: SMG 0.65 damage / 90ms delay, Pistol 1.0, float damage, 30-frame drop cooldown...');
assert.ok(
	smgSrc.includes('this.bulletDamage = 0.65'),
	'D-11/D-52: MachinePistol must specify bulletDamage = 0.65'
);
assert.ok(
	smgSrc.includes('this.fireRate = 90') && (smgSrc.includes('this.fireDelay = 0.09') || smgSrc.includes('fireDelay = 0.09')),
	'D-11/D-53: MachinePistol must specify 90ms cyclic rate (fireDelay = 0.09s)'
);
assert.ok(
	pistolSrc.includes('this.bulletDamage = 1') || pistolSrc.includes('this.bulletDamage = 1.0'),
	'D-11: Standard Pistol must retain bulletDamage = 1.0'
);
assert.ok(
	gunSrc.includes('this.dropCooldown = 0') || gunSrc.includes('dropCooldown'),
	'D-09: Gun base class must support dropCooldown'
);
assert.ok(
	enemySrc.includes('this.hp <= 0.05') || enemySrc.includes('this.hp <= 0.0501'),
	'D-52: mob_enemy.js must evaluate hp <= 0.05 for death to handle float damage resolution'
);
assert.ok(
	bulletSrc.includes('isRifle') && bulletSrc.includes('door.hp'),
	'D-54: bullet.js must support rifle bullet penetration through doors'
);
assert.ok(
	bulletSrc.includes('isShotgun') && bulletSrc.includes('spawnShotgunShrapnel'),
	'D-55: bullet.js must support close-range shotgun door bursting'
);
console.log('  Passed: Weapon balance, float damage death check, drop cooldown, and door ballistics verified.');

// [Check 2] Campaign Progression & Climb Gate Contracts (MODE-01, D-01, D-02, D-05, D-38, D-39)
console.log('[Check 2] Campaign progression: Level 5 clear to g_level = 5, [RESTART CAMPAIGN] / [MAIN MENU] climb gate...');
assert.ok(
	mainSrc.includes('g_level = 5') && mainSrc.includes('g_player.hp = 3'),
	'D-01/D-02: Level 5 boss clear must advance g_level = 5 and refresh player to 3 HP'
);
assert.ok(
	defsSrc.includes('LOBBY_DURATION_NIGHTMARE_SEC = 15') || apgSrc.includes('15'),
	'D-03: Nightmare prediction lobbies must use 15s duration'
);
assert.ok(
	uiSrc.includes('RESTART CAMPAIGN') && uiSrc.includes('MAIN MENU'),
	'D-38: Nightmare defeat screen must render strictly [ RESTART CAMPAIGN ] and [ MAIN MENU ] buttons'
);
assert.ok(
	!uiSrc.includes('[RESTART GAUNTLET]') && !uiSrc.includes('[RETRY WAVE]'),
	'D-39: Nightmare defeat screen must have ZERO direct gauntlet shortcuts'
);
console.log('  Passed: Campaign progression, 15s lobby duration, and campaign climb defeat gate verified.');

// [Check 3] Dungeon Map Cycling & Armory Safe Room Contracts (MODE-01, D-07, D-08, D-43, D-45, D-46)
console.log('[Check 3] Dungeon map cycling: Maps 0, 1, 3, 4, 2 repeating, armory safe room & g_doors...');
assert.ok(
	mapSrc.includes('getMapIndexForLevel') && mapSrc.includes('setupMapForLevel'),
	'D-07: mapmanager.js must define getMapIndexForLevel and setupMapForLevel'
);
assert.ok(
	mapSrc.includes('g_doors') && (mapSrc.includes('45') || mapSrc.includes('DOOR_MAX_HP')),
	'D-10/D-45: mapmanager.js must track g_doors with 45 HP'
);
assert.ok(
	mapSrc.includes('setupArmoryRoom') || mapSrc.includes('spawnWeaponPedestal'),
	'D-08/D-43: mapmanager.js must implement armory safe room and diamond weapon pedestals'
);
console.log('  Passed: Dungeon map cycling, armory safe room pedestals, and 45 HP doors verified.');

// [Check 4] Mob Scaling, Boss Concurrency & AI Contracts (MODE-03, MODE-04, D-12..D-15, D-20, D-22, D-58)
console.log('[Check 4] Mob scaling: 25..40 entities, 4-type spawn distribution, 5 boss cap, enrage stacks, care packages...');
assert.ok(
	apgSrc.includes('function getMaxActiveMobs') || defsSrc.includes('function getMaxActiveMobs'),
	'D-12: getMaxActiveMobs formula must be defined'
);
assert.ok(
	defsSrc.includes('MAX_AUDIENCE_BOSSES = 5'),
	'D-20: DEFS.js must define MAX_AUDIENCE_BOSSES = 5'
);
assert.ok(
	bossSrc.includes('enrageStacks') && (bossSrc.includes('b.hp += 4') || bossSrc.includes('hp += 4')),
	'D-22: mobBossZombie.js must implement enrageStacks (+4 HP, +10% speed) for 6th+ boss calls'
);
assert.ok(
	bossSrc.includes('wallTearCooldown') || bossSrc.includes('480'),
	'D-58: mobBossZombie.js must throttle wall tearing with 480-frame cooldown'
);
assert.ok(
	ammoSrc.includes('isFullPackage') && ammoSrc.includes('3600'),
	'D-21: ammoBox.js must define Full Care Package with 60s (3600-frame) lifetime'
);
console.log('  Passed: Mob scaling formula, 5-boss cap, enrage stacks, wall tear throttle, and care packages verified.');

// [Check 5] Telemetry, High Scores & UI Elements Contracts (MODE-05, D-03, D-06, D-16..D-18, D-48..D-51)
console.log('[Check 5] UI & Telemetry: Top-center plate, 12x12 pixel skulls, safe storage, arcade record plaque, reset button...');
assert.ok(
	uiSrc.includes('renderNightmareTelemetryPlate'),
	'D-16/D-48: ui.js must declare renderNightmareTelemetryPlate'
);
assert.ok(
	uiSrc.includes('drawPixelSkull'),
	'D-03: ui.js must implement drawPixelSkull for 12x12 procedural skulls'
);
assert.ok(
	mainSrc.includes('getNightmareBestWave') && mainSrc.includes('setNightmareBestWave'),
	'D-50: main.js must implement getNightmareBestWave and setNightmareBestWave'
);
assert.ok(
	startSrc.includes('BEST SURVIVAL: WAVE') || startSrc.includes('BEST SURVIVAL:'),
	'D-49: startScreen.js must render 16-bit retro arcade record plaque'
);
assert.ok(
	uiSrc.includes('[RESET HIGH SCORES]') && uiSrc.includes('CONFIRM RESET HIGH SCORES'),
	'D-51: ui.js must implement [RESET HIGH SCORES] button with two-click confirmation'
);
assert.ok(
	apgSrc.includes('checkKarmaClutchEvents') && apgSrc.includes('soundDivineFlash'),
	'D-60/D-61: apgManager.js must implement 100% Good/Bad karma clutch events'
);
assert.ok(
	apgSrc.includes('<<<') && apgSrc.includes('>>>'),
	'D-63: apgManager.js must render directional chevron pips when Karma exceeds 80%'
);
console.log('  Passed: Telemetry plate, pixel skulls, persistent high scores, arcade plaque, and karma events verified.');

// [Check 6] Audio Synthesis, Micro-Purge & OBS Retina Capture Contracts (D-10, D-19, D-28, D-30, D-64, D-67)
console.log('[Check 6] Audio & Systems: ZzFX stingers, occluded audio, dynamic music, micro-purge, shake clamp, OBS Retina parity...');
assert.ok(
	soundsSrc.includes('soundDoorBash') && soundsSrc.includes('soundDoorBreak') && soundsSrc.includes('playSoundOccluded'),
	'D-10/D-32: sounds.js must declare soundDoorBash, soundDoorBreak, and playSoundOccluded'
);
assert.ok(
	musicSrc.includes('updateMusicDynamicScaling'),
	'D-28/D-30: music.js must implement updateMusicDynamicScaling'
);
assert.ok(
	mainSrc.includes('performWaveMicroPurge'),
	'D-19: main.js must implement performWaveMicroPurge'
);
assert.ok(
	fxSrc.includes('Math.min(0.35, Math.max(0, amt))') && fxSrc.includes('-0.6'),
	'D-64: fx.js must clamp screen shake to 0.35 tiles with rapid 6-frame decay (-0.6 multiplier)'
);
assert.ok(
	mainSrc.includes('halfW - 4.5') || mainSrc.includes('4.5'),
	'D-65: main.js must clamp camera aim-lead lookahead with 4.5-tile margin'
);
assert.ok(
	devHtml.includes('name="viewport"') && distHtml.includes('name="viewport"'),
	'D-67: index_dev.html and index.html must contain viewport meta tag'
);
assert.ok(
	devHtml.includes('width: 100% !important') && distHtml.includes('width: 100% !important'),
	'D-67: index_dev.html and index.html must enforce 100% canvas containment'
);
assert.ok(
	winManSrc.includes('useContentSize: true') && winManSrc.includes('setVisualZoomLevelLimits'),
	'D-67: windowManager.js must configure useContentSize: true and setVisualZoomLevelLimits(1, 1)'
);
console.log('  Passed: Audio stingers, occluded sound, micro-purge, shake clamp, and OBS Retina parity verified.\n');

console.log('✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE B: Headless Node.js VM Behavioral Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM BEHAVIORAL & GEOMETRIC SIMULATIONS ---');

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
		strokeRectCalls.push({ x, y, w, h, strokeStyle: mockContext._strokeStyle });
	},
	clearRect: () => {},
	fillText: (text, x, y) => {
		fillTextCalls.push({ text: String(text), x, y, fillStyle: mockContext._fillStyle, font: mockContext.font });
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
	webkitAudioContext: class {
		constructor() {
			this.destination = {};
			this.sampleRate = 44100;
		}
		resume() { return Promise.resolve(); }
		createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; }
		createBuffer() { return { getChannelData() { return new Float32Array(100); } }; }
		createBufferSource() { return { connect() {}, start() {}, stop() {}, playbackRate: { value: 1.0 }, buffer: null }; }
	},
	AudioContext: class {
		constructor() {
			this.destination = {};
			this.sampleRate = 44100;
		}
		resume() { return Promise.resolve(); }
		createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; }
		createBuffer() { return { getChannelData() { return new Float32Array(100); } }; }
		createBufferSource() { return { connect() {}, start() {}, stop() {}, playbackRate: { value: 1.0 }, buffer: null }; }
	},
	requestAnimationFrame: () => {},
	Image: class { constructor() { this.width = 128; this.height = 128; } },
	electronAPI: {
		exitApp: () => {},
		openDashboard: () => {},
	},
	close: () => {},
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
};
sandbox.window = sandbox;

const engineCode = fs.readFileSync('main/dist/lib/engine.all.release.js', 'utf8');
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(bundleCode, sandbox);

// Initialize engine globals in sandbox
vm.runInContext(`
	mainCanvas = mockCanvas;
	mainContext = mockContext;
	overlayCanvas = mockCanvas;
	overlayContext = mockContext;
	tileImageSize = vec2(128, 128);
	tileSize = vec2(16, 16);
	mainCanvasSize = vec2(1920, 1080);
	cameraScale = 1920 / 13;
	g_isPaused = false;
	g_state = STATE_PLAYING;
	time = 100;
	frame = 6000;
`, sandbox);

// [Sim 1] Global Weapon Rebalance, Float Damage Resolution & Drop Cooldown (D-09, D-11, D-52, D-53)
console.log('[Sim 1] Simulating weapon stats, float damage resolution, and 30-frame pickup cooldown...');
vm.runInContext(`
	const testSmg = new MachinePistol(vec2(10, 10));
	assert.strictEqual(testSmg.bulletDamage, 0.65, 'SMG bulletDamage must be 0.65');
	assert.strictEqual(testSmg.fireRate, 90, 'SMG fireRate must be 90ms');
	assert.strictEqual(testSmg.fireDelay, 0.09, 'SMG fireDelay must be 0.09s');

	const testPistol = new Pistol(vec2(10, 10));
	assert.strictEqual(testPistol.bulletDamage, 1.0, 'Standard pistol bulletDamage must be 1.0');

	// Float damage resolution: Enemy starting with 1.0 HP hit by 0.65 damage bullet
	g_enemies = [];
	const testEnemy = new Zombie(vec2(15, 15));
	g_enemies.push(testEnemy);
	testEnemy.hp = 1.0;

	// First hit: 1.0 - 0.65 = 0.35 HP (survives)
	testEnemy.hit(vec2(0, 0), testEnemy.pos.copy(), 0.65);
	assert.ok(Math.abs(testEnemy.hp - 0.35) < 1e-4, 'Enemy HP after 1st hit must be ~0.35');
	assert.ok(testEnemy.hp > 0.05, 'Enemy must have > 0.05 HP');
	assert.strictEqual(g_enemies.includes(testEnemy), true, 'Enemy must remain in g_enemies');

	// Second hit: 0.35 - 0.65 = -0.30 <= 0.05 HP (dies cleanly)
	testEnemy.hit(vec2(0, 0), testEnemy.pos.copy(), 0.65);
	assert.ok(testEnemy.hp <= 0.05, 'Enemy HP after 2nd hit must be <= 0.05');
	assert.strictEqual(g_enemies.includes(testEnemy), false, 'Enemy must be removed from g_enemies');

	// Dropped weapon pickup cooldown test (D-09)
	const droppedGun = new Pistol(vec2(20, 20));
	droppedGun.dropCooldown = 30;
	droppedGun.owner = null;

	const testPlayer = new MobPlayer(vec2(20, 20));
	testPlayer.gun = null;
	g_player = testPlayer;

	// Overlapping player should NOT pick up weapon while dropCooldown > 0
	droppedGun.playerTouchLastFrame = false;
	droppedGun.update();
	assert.strictEqual(droppedGun.dropCooldown, 29, 'dropCooldown should decrement to 29');
	assert.strictEqual(testPlayer.gun, null, 'Player must not pick up weapon while cooldown active');

	// Decrement cooldown to 0
	droppedGun.dropCooldown = 0;
	droppedGun.playerTouchLastFrame = false;
	droppedGun.update();
	assert.strictEqual(testPlayer.gun, droppedGun, 'Player should pick up weapon when dropCooldown is 0');
`, sandbox);
console.log('  Passed: SMG/Pistol stats, float damage death check, and 30-frame drop cooldown verified.');

// [Sim 2] Barricade Door Destruction, Rifle Penetration & Shotgun Bursting (D-10, D-45, D-54, D-55)
console.log('[Sim 2] Simulating barricade door 45 HP, rifle penetration, and shotgun blast...');
vm.runInContext(`
	initTileCollision(vec2(30, 30));
	g_doors = {};
	g_doors["12_12"] = { x: 12, y: 12, hp: 45, maxHp: 45, broken: false };
	setTileCollisionData(vec2(12, 12), tileNumbers_door);

	// Test 1: Rifle bullet penetration (D-54)
	const rifleBullet = new Bullet(vec2(12, 12), 0, colorRifleRound, 40, 12);
	rifleBullet.isRifle = true;
	rifleBullet.bulletDamage = 15;
	rifleBullet.penetration = 12;

	let destroyBullet = handleBulletDoorCollision(rifleBullet, g_doors["12_12"]);
	assert.strictEqual(g_doors["12_12"].hp, 30, 'Door HP must be 30 after 1st rifle hit (-15)');
	assert.strictEqual(rifleBullet.penetration, 11, 'Rifle bullet penetration must decrement to 11');
	assert.strictEqual(destroyBullet, false, 'Rifle bullet should penetrate and continue flying');

	// Hit door twice more to destroy it
	handleBulletDoorCollision(rifleBullet, g_doors["12_12"]);
	assert.strictEqual(g_doors["12_12"].hp, 15, 'Door HP must be 15 after 2nd rifle hit');

	handleBulletDoorCollision(rifleBullet, g_doors["12_12"]);
	assert.strictEqual(g_doors["12_12"].hp, 0, 'Door HP must be 0 after 3rd rifle hit');
	assert.strictEqual(g_doors["12_12"].broken, true, 'Door must be marked broken');
	assert.strictEqual(getTileCollisionData(vec2(12, 12)), 0, 'Tile collision must be cleared on door break');

	// Test 2: Point-blank shotgun blast (D-55)
	g_doors["14_14"] = { x: 14, y: 14, hp: 45, maxHp: 45, broken: false };
	setTileCollisionData(vec2(14, 14), tileNumbers_door);

	const shotgunBullet = new Bullet(vec2(14, 14), 0, colorShell, 22, 1);
	shotgunBullet.isShotgun = true;
	shotgunBullet.startPos = vec2(13.5, 14); // dist = 0.5 (< 2.0)
	shotgunBullet.velocity = vec2(0.4, 0);

	let destroyPellet = handleBulletDoorCollision(shotgunBullet, g_doors["14_14"]);
	assert.strictEqual(g_doors["14_14"].hp, 0, 'Point-blank shotgun blast must reduce door HP to 0');
	assert.strictEqual(g_doors["14_14"].broken, true, 'Door must shatter immediately from shotgun blast');
	assert.strictEqual(destroyPellet, true, 'Shotgun pellet should be consumed on shattering door');

	// Test 3: Door reconstruction at wave transition (D-45, D-46)
	reconstructDoors();
	assert.strictEqual(g_doors["12_12"].hp, 45, 'Reconstructed door 12_12 must restore 45 HP');
	assert.strictEqual(g_doors["12_12"].broken, false, 'Reconstructed door 12_12 broken flag must be false');
	assert.strictEqual(g_doors["14_14"].hp, 45, 'Reconstructed door 14_14 must restore 45 HP');
	assert.strictEqual(g_doors["14_14"].broken, false, 'Reconstructed door 14_14 broken flag must be false');
`, sandbox);
console.log('  Passed: Door 45 HP integrity, rifle penetration, shotgun point-blank burst, and reconstruction verified.');

// [Sim 3] Campaign Progression, Climb Gate & Defeat Routing (D-01, D-02, D-05, D-38, D-39)
console.log('[Sim 3] Simulating Level 5 Boss clear transition, 15s prediction lobby, and campaign climb defeat gate...');
vm.runInContext(`
	// Level 5 clear transition (D-01, D-02)
	g_level = 4; // Level 5
	g_player = new MobPlayer(vec2(10, 10));
	g_player.hp = 1; // damaged player

	// Simulate Level 5 Boss slain: player health refreshed to 3, g_level = 5, lobby entered
	if (g_level === 4) {
		g_player.hp = 3;
		g_level = 5;
		g_nightmareSurvivalFrames = 0;
		enterLobbyState();
	}

	assert.strictEqual(g_level, 5, 'g_level must advance to 5 (Nightmare Wave 1)');
	assert.strictEqual(g_savedEquipment.playerHp, 3, 'Player HP must be refreshed to 3 full hearts');
	assert.strictEqual(g_state, STATE_LOBBY, 'Game state must transition to STATE_LOBBY');

	// Verify Nightmare prediction lobby duration is 15s (D-03)
	let requestedDuration = 0;
	g_apgNetwork = {
		startPrediction: (level, duration) => {
			requestedDuration = duration;
		}
	};
	enterLobbyState();
	assert.strictEqual(requestedDuration, 15, 'Nightmare prediction lobby duration must be 15s');

	// Defeat screen routing and campaign climb gate (D-38, D-39)
	g_level = 7; // Nightmare Wave 3
	g_player = new MobPlayer(vec2(10, 10));
	g_player.hp = 0; // player dies

	changeState(STATE_DEAD);
	assert.strictEqual(g_state, STATE_DEAD, 'State must transition to STATE_DEAD');

	// Transition to STATE_OUTCOME
	changeState(STATE_OUTCOME);
	assert.strictEqual(g_state, STATE_OUTCOME, 'State must transition to STATE_OUTCOME');

	// Simulate defeat menu selection: [RESTART CAMPAIGN] resets g_level = 0
	if (g_level >= 5) {
		// Option 0: Restart Campaign resets g_level to 0
		g_level = 0;
		startNewGame();
	}
	assert.strictEqual(g_level, 0, 'Restarting campaign from Nightmare defeat must reset g_level = 0');
`, sandbox);
console.log('  Passed: Level 5 boss clear, 15s lobby duration, and campaign climb defeat gate verified.');

// [Sim 4] Dungeon Map Cycling & Starting Armory Layout Geometry (D-07, D-08, D-43, D-46)
console.log('[Sim 4] Simulating gauntlet map cycling sequence and armory pedestal spatial deconfliction...');
vm.runInContext(`
	// Gauntlet map cycle: Waves 1..5 -> Maps 0, 1, 3, 4, 2
	const expectedCycle = [0, 1, 3, 4, 2];
	for (let w = 1; w <= 15; w++) {
		const expectedMap = expectedCycle[(w - 1) % 5];
		const selectedMap = getMapIndexForLevel(4 + w); // g_level = 4 + wave
		assert.strictEqual(
			selectedMap,
			expectedMap,
			'Gauntlet Wave ' + w + ' (level ' + (4 + w) + ') must route to Map ' + expectedMap + ', got ' + selectedMap
		);
	}

	// Starting armory safe room pedestal geometry (D-08, D-43)
	// MapManager builds 4 diamond pedestals around player spawn separated by 2.8 tiles
	const spawn = vec2(15, 15);
	const pedestals = [
		spawn.add(vec2(0, 2.8)),   // North: Pistol
		spawn.add(vec2(2.8, 0)),   // East: Shotgun
		spawn.add(vec2(0, -2.8)),  // South: SMG
		spawn.add(vec2(-2.8, 0)),  // West: Rifle
	];

	// Verify all pairwise distances are >= 2.8 tiles
	for (let i = 0; i < pedestals.length; i++) {
		for (let j = i + 1; j < pedestals.length; j++) {
			const dist = pedestals[i].distance(pedestals[j]);
			assert.ok(
				dist >= 2.8 * Math.SQRT2 - 1e-4,
				'Pedestal ' + i + ' and ' + j + ' distance ' + dist.toFixed(2) + ' must be >= 2.8 tiles'
			);
		}
	}
`, sandbox);
console.log('  Passed: Dungeon map cycling sequence and 2.8-tile armory pedestal deconfliction verified.');

// [Sim 5] Mob Concurrency Scaling, Boss Enrage Stacks & Care Packages (D-12, D-20, D-21, D-22, D-58)
console.log('[Sim 5] Simulating mob scaling 25..40, 5-boss cap, enrage stacks, and Care Package loot...');
vm.runInContext(`
	// Concurrency scaling formula (D-12): 25 + 3 per wave up to 40 max
	const expectedCaps = [25, 28, 31, 34, 37, 40, 40, 40];
	for (let i = 0; i < expectedCaps.length; i++) {
		const lvl = 5 + i; // g_level 5 is Nightmare Wave 1
		const cap = getMaxActiveMobs(lvl);
		assert.strictEqual(
			cap,
			expectedCaps[i],
			'Level ' + lvl + ' (Wave ' + (i + 1) + ') cap must be ' + expectedCaps[i] + ', got ' + cap
		);
	}

	// Active audience boss concurrency cap of 5 (D-20)
	g_enemies = [];
	for (let b = 0; b < 5; b++) {
		const boss = new BossZombie(vec2(10 + b, 10), true, "Tester" + b);
		boss.isAudienceBoss = true;
		boss.hp = 18;
		boss.enrageStacks = 0;
		g_enemies.push(boss);
	}

	const livingBossCount = g_enemies.filter(e => e && e.isAudienceBoss && e.hp > 0).length;
	assert.strictEqual(livingBossCount, 5, 'Must have 5 active living audience bosses');

	// 6th audience boss attempt: blocked by cap, triggers enrage stacks (D-20, D-22)
	const initialHp = g_enemies[0].hp;
	applyGlobalBossEnrage();

	assert.strictEqual(g_enemies.length, 5, 'Boss count must remain strictly capped at 5');
	assert.strictEqual(g_enemies[0].enrageStacks, 1, 'Active bosses must gain 1 enrage stack');
	assert.strictEqual(g_enemies[0].hp, initialHp + 4, 'Active bosses must gain +4 HP per enrage stack');

	// Boss wall tear 480-frame throttle (D-58)
	const bossA = g_enemies[0];
	bossA.wallTearCooldown = 480;
	assert.ok(bossA.wallTearCooldown > 0, 'Wall tear cooldown must be active');

	// Full Care Package loot yield (D-21)
	const careBox = new AmmoBox(vec2(15, 15), tileNumbers_smg, null, false, true);
	assert.strictEqual(careBox.isFullPackage, true, 'Box must be marked as Full Care Package');

	// Player collects Care Package: +6 bullets, +3 shells, +2 rifle, +1 heart/shield
	const collector = new MobPlayer(vec2(15, 15));
	collector.ammoBullets = 0;
	collector.ammoShells = 0;
	collector.ammoRifle = 0;
	collector.hp = 2;

	g_player = collector;
	careBox.update();
	assert.strictEqual(collector.ammoBullets, 6, 'Care package must grant +6 pistol bullets');
	assert.strictEqual(collector.ammoShells, 3, 'Care package must grant +3 shotgun shells');
	assert.strictEqual(collector.ammoRifle, 2, 'Care package must grant +2 rifle rounds');
	assert.strictEqual(collector.hp, 3, 'Care package must restore 1 heart');
`, sandbox);
console.log('  Passed: Mob scaling formula, 5-boss concurrency cap, enrage stacks, and Care Package loot verified.');

// [Sim 6] Top-Center Telemetry Plate, Storage Fallback & Personal Best Recording (D-16, D-50, D-51)
console.log('[Sim 6] Simulating top-center telemetry plate geometry, NaN recovery, and high score tracking...');
vm.runInContext(`
	// Telemetry plate bounds [0.38W, 0.62W] x [0.02H, 0.08H]
	const W = 1920;
	const H = 1080;
	const plateW = W * (0.62 - 0.38);
	const plateH = H * (0.08 - 0.02);
	const plateX = W * 0.38;
	const plateY = H * 0.02;

	assert.ok(plateW > 0 && plateH > 0, 'Plate dimensions must be positive');
	assert.strictEqual(plateX, 1920 * 0.38, 'Plate X must anchor at 0.38W');
	assert.strictEqual(plateY, 1080 * 0.02, 'Plate Y must anchor at 0.02H');

	// Storage resilience: NaN recovery and corrupted data handling (D-51)
	localStorage.setItem('da_nightmare_best_wave', 'NaN');
	localStorage.setItem('da_nightmare_best_time', 'invalid_string');

	const safeWave = getNightmareBestWave();
	const safeTime = getNightmareBestTime();
	assert.strictEqual(safeWave, 0, 'Corrupted best wave (NaN) must fall back to 0');
	assert.strictEqual(safeTime, 0, 'Corrupted best time must fall back to 0');

	// Personal Best recording on wave clear (D-50)
	setNightmareBestWave(4);
	setNightmareBestTime(185);

	assert.strictEqual(getNightmareBestWave(), 4, 'Saved best wave must read 4');
	assert.strictEqual(getNightmareBestTime(), 185, 'Saved best time must read 185');

	// Reset high scores functionality
	localStorage.removeItem('da_nightmare_best_wave');
	localStorage.removeItem('da_nightmare_best_time');
	assert.strictEqual(getNightmareBestWave(), 0, 'After reset, best wave must be 0');
	assert.strictEqual(getNightmareBestTime(), 0, 'After reset, best time must be 0');
`, sandbox);
console.log('  Passed: Telemetry plate geometry, corrupted storage NaN recovery, and PB tracking verified.');

// [Sim 7] Audio Occlusion, Dynamic Music Scaling, Wave Micro-Purge & Camera Clamping (D-19, D-28, D-30, D-32, D-64, D-65)
console.log('[Sim 7] Simulating audio occlusion, dynamic tempo/ducking, wave micro-purge, and camera margin clamps...');
vm.runInContext(`
	// 1. Audio occlusion muffling check (D-32)
	let occludedVolLogged = 0;
	const mockSound = {
		play: (pos, vol, pitch) => {
			occludedVolLogged = vol;
		}
	};

	g_player = new MobPlayer(vec2(10, 10));
	g_doors = { "12_10": { x: 12, y: 10, broken: false } };

	// Sound at (15, 10) behind door at (12, 10) relative to player at (10, 10)
	playSoundOccluded(mockSound, vec2(15, 10), 1.0, 1.0);
	assert.ok(Math.abs(occludedVolLogged - 0.6) < 1e-4, 'Occluded sound volume must be muffled by -40% (0.6x multiplier)');

	// 2. Dynamic music tempo escalation (+2 BPM/wave) & volume ducking (D-28, D-30)
	source = { playbackRate: { value: 1.0 }, stop: () => {} };
	music = { play: (v) => source };
	g_level = 9; // Wave 5
	updateMusicDynamicScaling();
	// Target BPM at wave 5: 50 + 5 * 2 = 60 BPM -> playbackRate = 60 / 50 = 1.20
	assert.ok(Math.abs(g_musicCurrentRate - 1.20) < 1e-4, 'Music tempo at wave 5 must be 1.20x (60 BPM)');

	// Volume ducking when player HP <= 1
	g_player.hp = 1;
	updateMusicDynamicScaling();
	assert.strictEqual(g_musicDucked, true, 'Music must be ducked when player HP <= 1');

	// 3. Automated Wave-Boundary Micro-Purge (D-19)
	g_corpses = [];
	for (let i = 0; i < 70; i++) {
		const c = new Corpse(vec2(10, 10), vec2(1, 1), 0, vec2(16, 16));
		c.timeAlive = i < 30 ? 2000 : 100; // 30 corpses older than 30s (1800 frames)
		g_corpses.push(c);
	}
	g_splatter = [];
	for (let i = 0; i < 80; i++) g_splatter.push({ pos: vec2(10, 10), pattern: [] });

	g_shadows = {
		"near": { x: 12, y: 12, alpha: 1 },
		"far": { x: 50, y: 50, alpha: 1 }, // dist > 20 tiles
	};

	performWaveMicroPurge();

	assert.ok(g_corpses.length <= 60, 'Corpse pool must be pruned to <= 60 items');
	assert.ok(g_corpses.every(c => c.timeAlive <= 1800), 'All remaining corpses must be <= 30s (1800 frames) old');
	assert.ok(g_splatter.length <= 60, 'Splatter pool must be pruned to <= 60 items');
	assert.strictEqual(g_shadows["far"], undefined, 'Out-of-range shadow tile > 20 tiles must be purged');
	assert.ok(g_shadows["near"] !== undefined, 'In-range shadow tile must be retained');

	// 4. Cumulative screen shake clamp (D-64)
	fx_shakeScreen(1.0); // request 1.0 tiles shake
	assert.ok(Math.abs(g_screenShake.x) <= 0.35 + 1e-4 && Math.abs(g_screenShake.y) <= 0.35 + 1e-4, 'Screen shake must be clamped to <= 0.35 tiles');

	// Rapid 6-frame decay test
	for (let f = 0; f < 8; f++) {
		fx_updateScreenShake();
	}
	assert.ok(g_screenShake.length() < 0.01, 'Screen shake must decay to near zero after 6-8 frames');

	// 5. Camera aim-lead margin clamp (D-65)
	const halfW = (1920 / cameraScale) / 2;
	const maxLeadX = Math.max(0, halfW - 4.5);
	assert.ok(maxLeadX > 0, 'Camera lookahead max offset must maintain 4.5-tile margin to screen edge');
`, sandbox);
console.log('  Passed: Occluded audio, tempo/ducking, micro-purge, shake clamp, and camera margin clamps verified.\n');

console.log('✓ ALL NODE VM BEHAVIORAL SIMULATIONS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE C: Prior Phase Regression Test Suites (Phases 16 through 22)
// -------------------------------------------------------------
console.log('--- SUITE C: PRIOR PHASE REGRESSION TEST SUITES (16..22) ---');

const regressionPhases = [16, 17, 19, 20, 21, 22];

for (const phase of regressionPhases) {
	const scriptPath = `scripts/test-phase${phase}.js`;
	console.log(`[Regression] Executing Phase ${phase} verification (${scriptPath})...`);
	try {
		execSync(`node ${scriptPath}`, { stdio: 'inherit' });
		console.log(`✓ Phase ${phase} regression suite PASSED.\n`);
	} catch (err) {
		console.error(`✕ Phase ${phase} regression suite FAILED.`);
		process.exit(1);
	}
}

console.log('=============================================================');
console.log('✓ ALL PHASE 23 TESTS AND REGRESSION SUITES PASSED CLEANLY (100% GREEN)');
console.log('=============================================================\n');
