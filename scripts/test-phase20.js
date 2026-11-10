import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
import { execSync } from 'child_process';

console.log('=== STARTING PHASE 20 FIELD MANUAL ARSENAL, BESTIARY & APG COMPENDIUM TEST SUITE ===\n');

// -------------------------------------------------------------
// SUITE A: Static Source Code AST & Contract Verification
// -------------------------------------------------------------
console.log('--- SUITE A: STATIC SOURCE CONTRACT VERIFICATION ---');

const startSrc = fs.readFileSync('main/src/js/startScreen.js', 'utf8');
const pkgSrc = fs.readFileSync('package.json', 'utf8');

// [Check 1] Tab Navigation & Function Order Integrity
console.log('[Check 1] Tab Navigation & Function Order Integrity...');
assert.ok(
	startSrc.includes('"1. COMBAT & WEAPONS"') &&
	startSrc.includes('"2. BESTIARY & THREATS"') &&
	startSrc.includes('"3. TWITCH APG & STREAM"'),
	'tabTitles must declare all 3 new Phase 20 tab titles'
);

const idxWep = startSrc.indexOf('function renderHelpTabWeapons');
const idxTwt = startSrc.indexOf('function renderHelpTabTwitch');
const idxStm = startSrc.indexOf('function renderHelpTabStreamer');
const idxMan = startSrc.indexOf('function renderStartScreenHelpManual');

assert.ok(idxWep > 0, 'startScreen.js must declare renderHelpTabWeapons');
assert.ok(idxTwt > idxWep, 'renderHelpTabTwitch must follow renderHelpTabWeapons');
assert.ok(idxStm > idxTwt, 'renderHelpTabStreamer must follow renderHelpTabTwitch');
assert.ok(idxMan > idxStm, 'renderStartScreenHelpManual must follow renderHelpTabStreamer');

// All 14 Phase 17 function names
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
		`startScreen.js must declare Phase 17 function ${fn}`
	);
}

// Slice checks: drawWrappedText called in each tab function body
const tab1Body = startSrc.slice(idxWep, idxTwt);
const tab2Body = startSrc.slice(idxTwt, idxStm);
const tab3Body = startSrc.slice(idxStm, idxMan);

assert.ok(tab1Body.includes('drawWrappedText('), 'renderHelpTabWeapons must route text through drawWrappedText');
assert.ok(tab2Body.includes('drawWrappedText('), 'renderHelpTabTwitch must route text through drawWrappedText');
assert.ok(tab3Body.includes('drawWrappedText('), 'renderHelpTabStreamer must route text through drawWrappedText');

// Backward compatibility helpers
assert.ok(startSrc.includes('function renderFieldManualModal'), 'Must declare renderFieldManualModal helper');
assert.ok(startSrc.includes('function switchTab'), 'Must declare switchTab helper');
assert.ok(startSrc.includes('function drawTabButton'), 'Must declare drawTabButton helper');
console.log('  Passed: Tab navigation, exact declaration sequence, all 14 Phase 17 functions, and helpers verified.');

// [Check 2] Tab 1 Arsenal Telemetry & Rifle Bug Fix (HELP-01)
console.log('[Check 2] Tab 1 Arsenal Telemetry & Hunting Rifle Bug Fix (HELP-01)...');
assert.ok(
	startSrc.includes('tileNumbers_pistol') &&
	startSrc.includes('6-Shot Cylinder') &&
	startSrc.includes('36 Bullets') &&
	startSrc.includes('0.18s'),
	'Tab 1 must contain Service Pistol telemetry (tile, cylinder, 36 Bullets, 0.18s)'
);
assert.ok(
	startSrc.includes('tileNumbers_smg') &&
	startSrc.includes('20 Rounds') &&
	startSrc.includes('80ms') &&
	startSrc.includes('160ms tap reset') &&
	startSrc.includes('0.02s') &&
	startSrc.includes('±0.48 rad'),
	'Tab 1 must contain SMG telemetry (tile, 20 Rounds, 80ms, 160ms tap reset, 0.02s, ±0.48 rad)'
);
assert.ok(
	startSrc.includes('tileNumbers_shotgun') &&
	startSrc.includes('2 Shells') &&
	startSrc.includes('8 Shells') &&
	startSrc.includes('4 heavy pellets') &&
	startSrc.includes('0.60s') &&
	startSrc.includes('30°'),
	'Tab 1 must contain Combat Shotgun telemetry (tile, 2 Shells, 8 Shells, 4 heavy pellets, 0.60s, 30°)'
);
assert.ok(
	startSrc.includes('tileNumbers_rifle') &&
	startSrc.includes('1 Round (Bolt-Action)') &&
	startSrc.includes('8 Rounds') &&
	startSrc.includes('2.0s') &&
	startSrc.includes('12 penetration'),
	'Tab 1 must contain Hunting Rifle telemetry (tile, 1 Round Bolt-Action, 8 Rounds, 2.0s, 12 penetration)'
);
assert.strictEqual(
	startSrc.includes('4 Rounds'),
	false,
	'Legacy bug "4 Rounds" must be completely eradicated from startScreen.js'
);
assert.ok(
	startSrc.includes('HEALTH, SUPPLY & LEVEL CARRYOVER') &&
	startSrc.includes('3 Base Hearts') &&
	startSrc.includes('1 Golden Shield Pip') &&
	startSrc.includes('0.75s (45f)') &&
	startSrc.includes('1 HP') &&
	startSrc.includes('+8B / +3S / +2R') &&
	startSrc.includes('refunds chamber') &&
	startSrc.includes('18 Bullets / 4 Shells / 3 Rifle'),
	'Tab 1 must contain complete survival, supply, and carryover telemetry footer'
);
console.log('  Passed: All 4 weapons telemetry, Hunting Rifle 1-Round bug fix, and Survival footer verified.');

// [Check 3] Tab 2 Bestiary Dossiers & Heavy Boss Zombie Siege Intel (HELP-02)
console.log('[Check 3] Tab 2 Bestiary Dossiers & Heavy Boss Zombie Siege Intel (HELP-02)...');
assert.ok(
	startSrc.includes('WALKER ZOMBIE') &&
	startSrc.includes('tileNumbers_faceZombie') &&
	startSrc.includes('HP: 2') &&
	startSrc.includes('0.06') &&
	startSrc.includes('5%') &&
	startSrc.includes('4.0s') &&
	startSrc.includes('1.2s') &&
	startSrc.includes('3.0s (180f)'),
	'Tab 2 must contain Walker Zombie dossier'
);
assert.ok(
	startSrc.includes('AERIAL VAMPIRE / BAT') &&
	startSrc.includes('tileNumbers_faceVampire') &&
	startSrc.includes('HP: 1') &&
	startSrc.includes('6+') &&
	startSrc.includes('0.20') &&
	startSrc.includes('10%') &&
	startSrc.includes('2.0s'),
	'Tab 2 must contain Aerial Vampire / Bat dossier'
);
assert.ok(
	startSrc.includes('PHASING GHOST') &&
	startSrc.includes('tileNumbers_ghost') &&
	startSrc.includes('HP: 1') &&
	startSrc.includes('0.05') &&
	startSrc.includes('12%') &&
	startSrc.includes('0.5–2.0s') &&
	startSrc.includes('30%'),
	'Tab 2 must contain Phasing Ghost dossier'
);
assert.ok(
	startSrc.includes('HEAVY BOSS ZOMBIE') &&
	startSrc.includes('tileNumbers_beefyZombie') &&
	startSrc.includes('22+') &&
	startSrc.includes('12+4') &&
	startSrc.includes('MASS: 12') &&
	startSrc.includes('Full Care Package') &&
	startSrc.includes('+4B / +2S / +1R') &&
	startSrc.includes('1.0s windup') &&
	startSrc.includes('spinning Boulders (0.2 speed)'),
	'Tab 2 must contain Heavy Boss Zombie dossier and siege mechanics'
);
assert.ok(
	startSrc.includes('SWARM MELEE') &&
	startSrc.includes('DIVE FLANKER') &&
	startSrc.includes('WALL-PHASER') &&
	startSrc.includes('SIEGE BOSS'),
	'Tab 2 must contain all 4 threat-tier pills'
);
assert.ok(
	startSrc.includes('HORDE PROGRESSION & AMMO DESPAWN INTEL') &&
	startSrc.includes('15 (L1)') &&
	startSrc.includes('18 (L2)') &&
	startSrc.includes('20 (L3)') &&
	startSrc.includes('23 (L4)') &&
	startSrc.includes('25 (L5)') &&
	startSrc.includes('45–60s') &&
	startSrc.includes('+60% speed') &&
	startSrc.includes('25s') &&
	startSrc.includes('30s') &&
	startSrc.includes('7.5Hz'),
	'Tab 2 must contain complete Horde Progression & Despawn footer telemetry'
);
console.log('  Passed: 4 enemy dossiers, Heavy Boss Zombie siege intel, and Horde footer verified.');

// [Check 4] Tab 3 Twitch APG 10-Command Matrix & Clutch Economy (HELP-03)
console.log('[Check 4] Tab 3 Twitch APG 10-Command Matrix & Clutch Economy (HELP-03)...');
for (const cmd of ['!ammo', '!barrier', '!repair', '!slow', '!light']) {
	assert.ok(startSrc.includes(cmd), `Tab 3 must contain Good command ${cmd}`);
}
for (const cmd of ['!mob', '!boss', '!jam', '!blackout', '!frenzy']) {
	assert.ok(startSrc.includes(cmd), `Tab 3 must contain Bad command ${cmd}`);
}
for (const legacy of ['!buff', '!drop', '!heal', '!sabotage', '!zombie']) {
	assert.strictEqual(startSrc.includes(legacy), false, `Legacy command ${legacy} must be absent`);
}
assert.ok(
	startSrc.includes('CLUTCH ECONOMY & DIVINE FLASH') &&
	startSrc.includes('<3 Bullets, <2 Shells, <2 Rifle') &&
	startSrc.includes('100% guaranteed') &&
	startSrc.includes('60f') &&
	startSrc.includes('4.0s (240f)'),
	'Tab 3 must contain Clutch Ammo Floor and emergency crate guarantees'
);
assert.ok(
	startSrc.includes('1 HP') &&
	startSrc.includes('6 tiles') &&
	startSrc.includes('2.5s invulnerability') &&
	startSrc.includes('3.0s') &&
	startSrc.includes('forces ghosts solid') &&
	startSrc.includes('30s cooldown'),
	'Tab 3 must contain Divine Flash shockwave conditions and effects'
);
assert.ok(
	startSrc.includes('VIEWER SCALING & STREAMER SETUP') &&
	startSrc.includes('Solo (≤3) = 1 vote') &&
	startSrc.includes('Classroom (4–30) = 3–8 votes') &&
	startSrc.includes('Chaos (>30) = 5–15 votes') &&
	startSrc.includes('4.0s !boss') &&
	startSrc.includes('8.0s !blackout') &&
	startSrc.includes('Cmd+D (Mac) or Ctrl+D (Win)') &&
	startSrc.includes('Window Capture'),
	'Tab 3 must contain Viewer Scaling and Streamer Setup card'
);
console.log('  Passed: 10 live APG commands, absence of legacy placeholders, clutch floor, and setup verified.');

// [Check 5] Package Manifest Integration
console.log('[Check 5] package.json test:phase20 runner entry...');
assert.ok(
	pkgSrc.includes('"test:phase20": "node scripts/test-phase20.js"'),
	'package.json must register test:phase20 script'
);
console.log('  Passed: package.json test:phase20 runner registered.\n');

console.log('✓ ALL STATIC SOURCE CONTRACT CHECKS PASSED CLEANLY!\n');

// -------------------------------------------------------------
// SUITE B: Headless Node VM Multi-Viewport Simulations
// -------------------------------------------------------------
console.log('--- SUITE B: NODE VM MULTI-VIEWPORT SIMULATIONS ---');

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
		fillTextCalls.push({
			text: String(text),
			x,
			y,
			font: mockContext.font,
			align: mockContext.textAlign,
			baseline: mockContext.textBaseline
		});
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

const viewports = [
	{ name: '720p HD (16:9)', W: 1280, H: 720 },
	{ name: '1080p FHD (16:9)', W: 1920, H: 1080 },
	{ name: '1440p QHD (16:9)', W: 2560, H: 1440 },
	{ name: '4K UHD (16:9)', W: 3840, H: 2160 },
	{ name: '4:3 Retro', W: 1024, H: 768 },
	{ name: '16:10 Laptop', W: 1680, H: 1050 },
	{ name: '21:9 Ultrawide', W: 2560, H: 1080 },
];

// [Sim 1] 7-Viewport Modal & Card Boundary Containment
console.log('[Sim 1] 7-Viewport Modal & Card Boundary Containment (Tabs 0, 1, 2 across 7 resolutions)...');

const simulationScript = `
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

	for (const vp of ${JSON.stringify(viewports)}) {
		mockCanvas.width = vp.W;
		mockCanvas.height = vp.H;
		mainCanvasSize = vec2(vp.W, vp.H);

		const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(vp.W, vp.H);
		const modalW = Math.min(safeW * 0.92, Math.max(1020, u * 38));
		const modalH = Math.min(safeH * 0.86, Math.max(680, u * 25.5));
		const modalX = cx - modalW / 2;
		const modalY = cy - modalH / 2;

		g_startHelpOpen = true;

		for (let tab = 0; tab < 3; tab++) {
			g_startHelpTab = tab;
			const s0 = saveCalls();
			const r0 = restoreCalls();
			clearFillTextCalls();

			renderStartScreenHelpManual(vp.W, vp.H, cx, cy, u, safeW, safeH);

			// Assertion 1: Stack Balance
			assert.strictEqual(
				saveCalls() - s0,
				restoreCalls() - r0,
				vp.name + ' Tab ' + tab + ': saveCalls must equal restoreCalls (net stack deviation = 0)'
			);

			const textCalls = getFillTextCalls();
			assert.ok(textCalls.length > 5, vp.name + ' Tab ' + tab + ' must render text content');

			// Assertion 2: Text Bounding Containment
			for (const call of textCalls) {
				assert.ok(
					call.x >= modalX - 2 && call.x <= modalX + modalW + 2,
					vp.name + ' Tab ' + tab + ' text "' + call.text + '" X (' + call.x + ') must be within [' + (modalX - 2) + ', ' + (modalX + modalW + 2) + ']'
				);
				assert.ok(
					call.y >= modalY - 2 && call.y <= modalY + modalH + 2,
					vp.name + ' Tab ' + tab + ' text "' + call.text + '" Y (' + call.y + ') must be within [' + (modalY - 2) + ', ' + (modalY + modalH + 2) + ']'
				);
			}

			// Assertion 3: Zero Ellipsis on Primary Stat Headers and Footer Titles
			const primaryHeaders = [
				'SERVICE PISTOL', 'MACHINE PISTOL (SMG)', 'COMBAT SHOTGUN', 'HUNTING RIFLE',
				'WALKER ZOMBIE', 'AERIAL VAMPIRE / BAT', 'PHASING GHOST', 'HEAVY BOSS ZOMBIE',
				'!ammo', '!barrier', '!repair', '!slow', '!light',
				'!mob', '!boss', '!jam', '!blackout', '!frenzy',
				'HEALTH, SUPPLY & LEVEL CARRYOVER',
				'HORDE PROGRESSION & AMMO DESPAWN INTEL',
				'CLUTCH ECONOMY & DIVINE FLASH',
				'VIEWER SCALING & STREAMER SETUP'
			];

			for (const call of textCalls) {
				for (const header of primaryHeaders) {
					if (call.text.includes(header)) {
						assert.ok(
							!call.text.includes('...'),
							vp.name + ' Tab ' + tab + ' primary header "' + header + '" must not contain ellipsis truncation'
						);
					}
				}
			}
		}
	}
`;

vm.runInContext(simulationScript, sandbox);
console.log('  Passed: All 7 viewports verified with 0 net stack deviation, 100% boundary containment, and zero ellipsis on primary headers.');

// [Sim 2] Comprehensive Regression Gauntlet
console.log('\n[Sim 2] Running full regression gauntlet (test:phase16, test:phase17, test:phase19)...');
execSync('npm run test:phase16', { stdio: 'inherit' });
execSync('npm run test:phase17', { stdio: 'inherit' });
execSync('npm run test:phase19', { stdio: 'inherit' });

console.log('\n=============================================================');
console.log('ALL PHASE 20 TESTS PASSED SUCCESSFULLY (100% GREEN)');
console.log('=============================================================\n');
