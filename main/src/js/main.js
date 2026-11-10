/** @format */

var mapMan;

function safeGetPref(key, fallback) {
	try {
		if (typeof localStorage !== 'undefined') {
			const val = localStorage.getItem(key);
			return val !== null ? val : fallback;
		}
	} catch (e) {}
	return fallback;
}

function safeSetPref(key, value) {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(key, String(value));
		}
	} catch (e) {}
}

var g_cheatsheetVisible = safeGetPref('da_cheatsheet_visible', '1') === '1'; // D-06
var g_cheatsheetDock = safeGetPref('da_cheatsheet_dock', 'right'); // 'right' or 'left', D-10
var g_cheatsheetSlideProgress = g_cheatsheetVisible ? 1.0 : 0.0; // D-08
var g_lastInputGamepad = false; // D-22

function init() {
	if (!document.body) {
		// html document is not ready yet (safari mobile)
		return setTimeout(init, 100);
	}

	// generate new maps
	generateMapFromLevel(0);
	generateMapFromLevel(1);

	// startup LittleJS with your game functions after the tile image is loaded
	engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, "t.png");
}

function gameInit() {
	scaleCameraToScreenSize();
	if (typeof g_apgNetwork !== "undefined" && !g_apgNetwork.connected) {
		g_apgNetwork.connect();
	}
	document.body.style.cursor = "crosshair";

	touchGamepadEnable = 1;
	touchGamepadAnalog = 1;
	//vibrateEnable = 1;
	startNewGame();
}

function scaleCameraToScreenSize() {
	// try to fit same tiles on a screen
	let tiles = TILES_PER_SCREEN;

	// smaller on mobile
	//if (isTouchDevice) tiles = tiles - 3;

	cameraScale = min(window.innerWidth, window.innerHeight) / tiles;

	touchGamepadSize = (80 * cameraScale) / 32;
}

function startNewGame() {
	g_score = 0;
	g_level = 0;
	g_player = null;
	g_savedEquipment = null;
	g_isPaused = false;
	if (typeof g_apgManager !== "undefined" && g_apgManager) g_apgManager.resetForNewGame();
}

function abandonRunToMainMenu() {
	g_isPaused = false;
	if (typeof g_startHelpOpen !== 'undefined') g_startHelpOpen = false;
	clearPushers();
	g_enemies = [];
	g_corpses = [];
	g_splatter = [];
	g_holes = [];
	g_moss = [];
	g_shells = [];
	g_shadows = {};
	enemiesSpawned = 0;
	ammoCooldownFrames = 0;
	if (typeof enemySpawnTimer !== 'undefined' && enemySpawnTimer.set) {
		enemySpawnTimer.set(999);
	}
	if (typeof engineObjectsDestroy === 'function') {
		engineObjectsDestroy();
	}
	uiFadeOutAndCall(() => {
		if (typeof engineObjectsDestroy === 'function') {
			engineObjectsDestroy();
		}
		startNewGame();
		changeState(STATE_CLICK_TO_START);
	});
}

var g_lobbyLockBannerTimer = 0;
var g_lobbyLastBeepSecond = -1;
var g_lobbyTransitioning = false;

function enterLobbyState() {
	if (g_player) {
		g_savedEquipment = {
			ammoPistol: Math.min(g_player.ammoBullets, LEVEL_TRANSITION_MAX_BULLETS),
			ammoShotgun: Math.min(g_player.ammoShells, LEVEL_TRANSITION_MAX_SHELLS),
			ammoRifle: Math.min(g_player.ammoRifle, LEVEL_TRANSITION_MAX_RIFLE),
			currentGun: g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol,
			gunAmmo: g_player.gun ? g_player.gun.ammo : 6,
			playerHp: g_player ? clamp(g_player.hp, 1, 4) : 3,
		};
	} else if (!g_savedEquipment) {
		g_savedEquipment = {
			ammoPistol: 12,
			ammoShotgun: 0,
			ammoRifle: 0,
			currentGun: tileNumbers_pistol,
			gunAmmo: 6,
			playerHp: 3,
		};
	}

	clearPushers();
	g_player = null;
	g_moss = [];
	g_shadows = {};
	g_enemies = [];
	g_splatter = [];
	g_holes = [];
	g_corpses = [];
	g_shells = [];
	enemiesSpawned = 0;
	ammoCooldownFrames = 0;

	engineObjectsDestroy();

	if (typeof setupMapForLevel === "function") {
		setupMapForLevel(g_level);
	} else {
		g_levelDef = levelDefs[g_level % levelDefs.length];
	}
	mapMan = new MapManager();

	for (let i = 0; i < g_enemies.length; i++) {
		g_enemies[i].destroy();
	}
	g_enemies = [];

	if (playerSpawn) {
		cameraPos = playerSpawn.copy();
	}

	g_lobbyLockBannerTimer = 0;
	g_lobbyLastBeepSecond = -1;
	g_lobbyTransitioning = false;

	changeState(STATE_LOBBY);

	if (typeof g_apgNetwork !== "undefined") {
		g_apgNetwork.startPrediction(g_level + 1);
	}
}

function startNextLevel() {
	// save gun and ammo
	let ammoPistol = Math.min(g_player ? g_player.ammoBullets : g_savedEquipment ? g_savedEquipment.ammoPistol : 12, LEVEL_TRANSITION_MAX_BULLETS);
	let ammoShotgun = Math.min(g_player ? g_player.ammoShells : g_savedEquipment ? g_savedEquipment.ammoShotgun : 0, LEVEL_TRANSITION_MAX_SHELLS);
	let ammoRifle = Math.min(g_player ? g_player.ammoRifle : g_savedEquipment ? g_savedEquipment.ammoRifle : 0, LEVEL_TRANSITION_MAX_RIFLE);
	let currentGun = g_player && g_player.gun ? g_player.gun.tileIndex : g_savedEquipment ? g_savedEquipment.currentGun : tileNumbers_pistol; // default
	let gunAmmo = g_player && g_player.gun ? g_player.gun.ammo : g_savedEquipment ? g_savedEquipment.gunAmmo : 6;
	let savedHp = g_player ? clamp(g_player.hp, 1, 4) : (g_savedEquipment && g_savedEquipment.playerHp ? clamp(g_savedEquipment.playerHp, 1, 4) : 3);
	g_savedEquipment = null;

	///////////////////
	// Clean up

	clearPushers();

	g_player = undefined;
	g_isPaused = false;

	g_moss = [];
	g_shadows = {};
	g_enemies = [];

	g_splatter = [];
	g_holes = [];
	// g_sparks = [];
	g_corpses = [];
	g_shells = [];

	enemiesSpawned = 0;
	ammoCooldownFrames = 0;

	engineObjectsDestroy(); // destroy all objects handled by the engine

	/////////////////////
	// Setup new level

	if (typeof setupMapForLevel === "function") {
		setupMapForLevel(g_level);
	} else {
		g_levelDef = levelDefs[g_level % levelDefs.length];
	}

	mapMan = new MapManager();

	g_player = new MobPlayer(playerSpawn);
	g_player.hp = savedHp;
	cameraPos = playerSpawn.copy();

	if (typeof g_apgManager !== "undefined" && g_apgManager) {
		g_apgManager.resetForNewLevel();
	}
	if (typeof g_apgNetwork !== "undefined" && g_apgNetwork) {
		g_apgNetwork.send({ type: "RESET_LEVEL", level: g_level + 1 });
	}

	if (g_level >= 5 && g_level % 5 == 0) {
		new MachinePistol(g_player.pos.add(vec2(1, 1)));
	}

	// give player saved equipment
	g_player.ammoBullets = ammoPistol;
	g_player.ammoShells = ammoShotgun;
	g_player.ammoRifle = ammoRifle;
	g_player.clampAmmo();
	let theGun;
	if (currentGun == tileNumbers_smg) {
		theGun = new MachinePistol(g_player.pos);
	} else if (currentGun == tileNumbers_rifle) {
		theGun = new Rifle(g_player.pos);
	} else if (currentGun == tileNumbers_shotgun) {
		theGun = new Shotgun(g_player.pos);
	} else {
		theGun = new Pistol(g_player.pos);
	}
	theGun.ammo = gunAmmo;

	levelCleared = false;

	musicStart();
}

function findFreePos(minDistToPlayer) {
	let pos, dist2player, inTileCol;

	do {
		pos = vec2(rand(mapData[g_levelDef.map].w), rand(mapData[g_levelDef.map].h));
		pos.x = Math.floor(pos.x) + 0.5;
		pos.y = Math.floor(pos.y) + 0.5;

		dist2player = pos.distance(g_player.pos);
		inTileCol = tileCollisionTest(pos, vec2(1));
	} while (dist2player < minDistToPlayer || inTileCol);

	return pos;
}

function findFreePosRange(minDist, maxDist, requireLineOfSight = false) {
	if (!g_player || !g_levelDef) return vec2(5.5, 5.5);
	let mapW = mapData[g_levelDef.map].w;
	let mapH = mapData[g_levelDef.map].h;
	let bestFallback = null;
	for (let attempt = 0; attempt < 100; attempt++) {
		let angle = rand(PI * 2);
		let dist = rand(minDist, maxDist);
		let x = Math.floor(g_player.pos.x + Math.cos(angle) * dist) + 0.5;
		let y = Math.floor(g_player.pos.y + Math.sin(angle) * dist) + 0.5;
		if (x < 1.5 || y < 1.5 || x > mapW - 1.5 || y > mapH - 1.5) continue;
		let pos = vec2(x, y);
		if (tileCollisionTest(pos, vec2(0.85))) continue;
		if (!bestFallback) bestFallback = pos;
		if (requireLineOfSight) {
			let hit = tileCollisionRaycast(g_player.pos, pos);
			if (hit) continue;
		}
		return pos;
	}
	return bestFallback || findFreePos(minDist);
}

var enemiesSpawned = 0;
function spawnEnemy() {
	var p = findFreePos(5);
	let enemyClass = getNextEnemySpawnClass();

	let enemy;
	if (enemyClass == "v") {
		enemy = new Vampire(p);
	} else if (enemyClass == "g") {
		enemy = new Ghost(p);
	} else {
		enemy = new Zombie(p);
	}
	g_enemies.push(enemy);
	enemiesSpawned++;
}

function gameUpdate() {
	uiFading();

	if (typeof keyWasPressed !== 'undefined' && (keyWasPressed(67) || keyWasPressed(27) || keyWasPressed(80) || keyWasPressed(32))) {
		g_lastInputGamepad = false;
	}
	if (typeof gamepadWasPressed !== 'undefined' && (gamepadWasPressed(8) || gamepadWasPressed(0) || gamepadWasPressed(1) || gamepadWasPressed(2) || gamepadWasPressed(3))) {
		g_lastInputGamepad = true;
	}

	if (g_state == STATE_PLAYING) {
		// Cheat-sheet hotkeys: [C] toggle, Shift+C dock flip, Gamepad Select (8) toggle (D-07, D-10, D-19)
		if (typeof g_startHelpOpen === 'undefined' || !g_startHelpOpen) {
			if (typeof gamepadWasPressed !== 'undefined' && gamepadWasPressed(8)) {
				g_cheatsheetVisible = !g_cheatsheetVisible;
				safeSetPref('da_cheatsheet_visible', g_cheatsheetVisible ? '1' : '0');
				uiSound(1);
			}
			if (keyWasPressed(67)) {
				if (keyIsDown(16)) {
					// Shift+C: Flip docking between Right and Left (D-10)
					g_cheatsheetDock = g_cheatsheetDock === 'right' ? 'left' : 'right';
					safeSetPref('da_cheatsheet_dock', g_cheatsheetDock);
					uiSound(1);
				} else {
					// [C]: Toggle visibility (D-07)
					g_cheatsheetVisible = !g_cheatsheetVisible;
					safeSetPref('da_cheatsheet_visible', g_cheatsheetVisible ? '1' : '0');
					uiSound(1);
				}
			}
		}

		const targetProgress = g_cheatsheetVisible ? 1.0 : 0.0;
		const slideStep = 1 / 7;
		if (g_cheatsheetSlideProgress < targetProgress) {
			g_cheatsheetSlideProgress = Math.min(targetProgress, g_cheatsheetSlideProgress + slideStep);
		} else if (g_cheatsheetSlideProgress > targetProgress) {
			g_cheatsheetSlideProgress = Math.max(targetProgress, g_cheatsheetSlideProgress - slideStep);
		}

		// ESC (27) or P (80) toggles in-game pause or closes Field Manual if open (CLIP-06, D-08)
		if (keyWasPressed(27) || keyWasPressed(80)) {
			if (typeof g_startHelpOpen !== "undefined" && g_startHelpOpen) {
				g_startHelpOpen = false;
				return;
			} else {
				g_isPaused = !g_isPaused;
				if (g_isPaused) uiSound(1);
			}
		}
		if (g_isPaused) {
			// [H] key (72) toggles Survivor Field Manual modal while paused (CLIP-06, D-08)
			if (keyWasPressed(72)) {
				g_startHelpOpen = !g_startHelpOpen;
				return;
			}
			if (typeof g_startHelpOpen !== "undefined" && g_startHelpOpen) {
				if (keyWasPressed(49)) g_startHelpTab = 0; // '1'
				if (keyWasPressed(50)) g_startHelpTab = 1; // '2'
				if (keyWasPressed(51)) g_startHelpTab = 2; // '3'
				if (keyWasPressed(37)) g_startHelpTab = (g_startHelpTab + 2) % 3; // Left Arrow
				if (keyWasPressed(39)) g_startHelpTab = (g_startHelpTab + 1) % 3; // Right Arrow
				if (keyWasPressed(88) || keyWasPressed(27)) { // 'X' or Esc
					g_startHelpOpen = false;
					return;
				}
				if (typeof gamepadWasPressed !== "undefined") {
					if (gamepadWasPressed(4)) g_startHelpTab = (g_startHelpTab + 2) % 3;
					if (gamepadWasPressed(5)) g_startHelpTab = (g_startHelpTab + 1) % 3;
					if (gamepadWasPressed(1) || gamepadWasPressed(3)) {
						g_startHelpOpen = false;
						return;
					}
				}
				const W = mainCanvas ? mainCanvas.width : 1920;
				const H = mainCanvas ? mainCanvas.height : 1080;
				const { safeW, safeH, cx, cy, u } = typeof getStartScreenSafeZone === "function"
					? getStartScreenSafeZone(W, H)
					: { safeW: W, safeH: H, cx: W / 2, cy: H / 2, u: Math.max(12, Math.min(W, H) / 40) };
				const modalW = Math.min(safeW * 0.92, Math.max(1020, u * 38));
				const modalH = Math.min(safeH * 0.86, Math.max(680, u * 25.5));
				const modalX = cx - modalW / 2;
				const modalY = cy - modalH / 2;
				const headerY = modalY + u * 1.4;
				const tabY = headerY + u * 1.5;
				const tabH = u * 1.6;
				const tabW = (modalW - u * 2.0) / 3;
				const mPos = typeof mousePosScreen !== "undefined" && mousePosScreen ? mousePosScreen : null;
				if (typeof mouseWasPressed !== "undefined" && mouseWasPressed(0) && mPos) {
					for (let i = 0; i < 3; i++) {
						const tx = modalX + u * 1.0 + i * tabW;
						if (mPos.x >= tx && mPos.x <= tx + tabW - 4 && mPos.y >= tabY - tabH / 2 && mPos.y <= tabY + tabH / 2) {
							g_startHelpTab = i;
							return;
						}
					}
					if (mPos.x < modalX || mPos.x > modalX + modalW || mPos.y < modalY || mPos.y > modalY + modalH || (mPos.y <= modalY + u * 2.2 && mPos.x >= modalX + modalW - u * 8.0)) {
						g_startHelpOpen = false;
						return;
					}
				}
				return;
			}
			// In desktop mode, 'D' key (68) triggers openDashboard
			if (keyWasPressed(68) && typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openDashboard) {
				window.electronAPI.openDashboard();
			}
			// Freeze game updates while paused
			return;
		}
	}

	if (g_state == STATE_CLICK_TO_START) {
		updateStateClickToStart();
	} else if (g_state == STATE_LOBBY) {
		updateStateLobby();
	} else if (g_state == STATE_PLAYING) {
		updateStatePlaying();
	} else if (g_state == STATE_DEAD) {
		updateStateDead();
	} else if (g_state == STATE_CLEARED) {
		updateStateCleared();
	} else if (g_state == STATE_OUTCOME) {
		updateStateOutcome();
	}

	// CAN BE REMOVED
	//mouseWasPressed(2) && toggleFullscreen();
}

function updateStateLobby() {
	let pred = typeof g_apgNetwork !== "undefined" && g_apgNetwork.prediction ? g_apgNetwork.prediction : null;

	if (playerSpawn) {
		cameraPos = playerSpawn.add(vec2(Math.sin(frame / 120) * 0.6, Math.cos(frame / 150) * 0.4));
	}

	if (pred && pred.status === "LOBBY" && !pred.lockRequested && (keyWasPressed(32) || mouseWasPressed(2) || gamepadWasPressed(0))) {
		g_apgNetwork.lockPrediction();
	}

	if (pred && pred.status === "LOBBY" && pred.remainingSeconds <= 5 && pred.remainingSeconds >= 1) {
		if (pred.remainingSeconds !== g_lobbyLastBeepSecond) {
			g_lobbyLastBeepSecond = pred.remainingSeconds;
			if (typeof soundCountdownBeep !== "undefined") {
				soundCountdownBeep.play();
			}
		}
	}

	if (pred && pred.status === "LOCKED") {
		if (g_lobbyLockBannerTimer === 0) {
			g_lobbyLockBannerTimer = Date.now();
			if (typeof soundPredictionLocked !== "undefined") {
				soundPredictionLocked.play();
			}
		}
		if (Date.now() - g_lobbyLockBannerTimer >= 2000 && !g_lobbyTransitioning) {
			g_lobbyTransitioning = true;
			uiFadeOutAndCall(() => {
				startNextLevel();
				changeState(STATE_PLAYING);
			});
		}
	}
}

function uiSound(f = 5) {
	for (let i = 0; i < f; i++) {
		soundRifle.play(cameraPos.add(vec2(10, 0)), 1, 0.5 + i / 10);
		setTimeout(() => soundEnemyGroan.play(cameraPos.add(vec2(-10, 0)), 0.5, 2 + i / 5, 0.5), 300 + i * 50);
	}
}

function updateStateClickToStart() {
	if (typeof updateStartScreen === "function") {
		textsClear();
		updateStartScreen();
		return;
	}

	drawTile(
		cameraPos,
		vec2(4),
		tileNumbers_faceZombie,
		TILE_SIZE,
		new Color(1, 1, 1, max(0, 0.2 * Math.sin((frame * PI) / 1000)))
	);

	textTitle = "DEAD AGAIN";

	if (g_score) {
		textMiddle = "Score: " + g_score + "  Top: " + localStorage.da_t;
	}

	textBottom = "Click to start";

	if (mouseWasReleased(0) || gamepadWasPressed(0)) {
		uiSound();
		if (isTouchDevice && !isFullscreen()) toggleFullscreen();
		uiFadeOutAndCall(() => {
			startNewGame();
			enterLobbyState();
		});
	}
}

function updateStateDead() {
	textMiddle = "YOU DIED";

	if (getMsSinceStateChange() > 2000) {
		changeState(STATE_OUTCOME);
	}
}

function updateStateCleared() {
	textMiddle = "Level " + (g_level + 1) + " cleared";

	if (getMsSinceStateChange() > 2000) {
		changeState(STATE_OUTCOME);
	}
}

function updateStateOutcome() {
	// Atmospheric slow camera pan across battlefield (D-18)
	cameraPos = cameraPos.add(vec2(Math.sin(frame / 180) * 0.008, Math.cos(frame / 200) * 0.006));

	let matchSummary = typeof g_apgManager !== "undefined" && g_apgManager ? g_apgManager.matchSummary : null;
	let isMidRunClear = matchSummary && matchSummary.state === STATE_CLEARED && !matchSummary.isGrandVictory;

	if (isMidRunClear) {
		// 6-second countdown bar for mid-run level clear (D-30)
		let elapsedSec = Math.floor(getMsSinceStateChange() / 1000);
		let remainingSec = Math.max(0, 6 - elapsedSec);

		if (remainingSec <= 0 || mouseWasPressed(0) || keyWasPressed(32) || gamepadWasPressed(0)) {
			uiSound(3);
			uiFadeOutAndCall(() => {
				g_level++;
				enterLobbyState();
			});
		}
	} else {
		// Game Over or Level 5 Grand Victory pauses indefinitely (D-30)
		if (mouseWasPressed(0) || keyWasPressed(32) || gamepadWasPressed(0)) {
			uiSound();
			uiFadeOutAndCall(() => {
				startNewGame();
				enterLobbyState();
			});
		} else if (keyWasPressed(27)) {
			// ESC key returns to Title Screen (D-20)
			uiFadeOutAndCall(() => {
				startNewGame();
				changeState(STATE_CLICK_TO_START);
			});
		}
	}
}

var stateChangedTime = new Date().getTime();
function changeState(newState) {
	textsClear();
	stateChangedTime = new Date().getTime();
	g_state = newState;
	if ((newState === STATE_DEAD || newState === STATE_CLEARED) && typeof g_apgManager !== "undefined" && g_apgManager) {
		g_apgManager.onMatchOrLevelEnd(newState);
	}
	if (newState === STATE_OUTCOME && typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.matchSummary) {
		let w = g_apgManager.matchSummary.winner;
		if (w === "good") {
			if (typeof soundOutcomeGood !== "undefined") soundOutcomeGood.play();
			if (g_apgManager.matchSummary.isGrandVictory && typeof uiflashScreen === "function") {
				uiflashScreen("#fbf236", 18);
			}
		} else if (w === "bad") {
			if (typeof soundOutcomeBad !== "undefined") soundOutcomeBad.play();
		}
	}
}

function getMsSinceStateChange() {
	return new Date().getTime() - stateChangedTime;
}

var ticsToSpawn = 0;
var ammoSpawned = false;
var ammoCooldownFrames = 0;

var levelCleared = false;

function updateStatePlaying() {
	// game gets more difficult as you play
	g_difficulty = 1 + ((g_level / levelDefs.length) | 0);

	// enemies are a tiny bit repulsed by each other ... and thus try to spread out
	for (const e of g_enemies) {
		pushers.push(new Pusher(e.pos, 0.002, 1, 3, 2 / 60, PushTo.ENEMIES));
	}

	// player leaves foot prints that attracts monsters
	if (rand() < 0.1) pushers.push(new Pusher(g_player.pos, -0.001, 0, 5, rand(5), PushTo.ENEMIES));

	updatePushers();
	if (typeof g_apgManager !== "undefined" && g_apgManager) g_apgManager.update();

	textMiddle = getMsSinceStateChange() > 3000 ? "" : "Level " + (g_level + 1);

	ticsToSpawn--;

	let enemiesToSpawn = (g_levelDef.enemiesToSpawn * (1 + g_difficulty)) / 2;
	let enemiesMaxAlive = g_levelDef.enemiesMaxAlive * g_difficulty;

	let naturalAlive = 0;
	for (let i = 0; i < g_enemies.length; i++) {
		if (g_enemies[i] && !g_enemies[i].isAudienceSpawned) {
			naturalAlive++;
		}
	}

	let naturalRemainingToSpawn = Math.max(0, enemiesToSpawn - enemiesSpawned);
	let enemiesLeft = naturalRemainingToSpawn + g_enemies.length;

	if (isFinite(enemiesToSpawn) && enemiesSpawned >= enemiesToSpawn && typeof g_apgManager !== "undefined" && g_apgManager) {
		g_apgManager.postWaveFrames++;
		if (g_enemies.length <= 2 || g_apgManager.postWaveFrames >= 900) {
			g_apgManager.finalStand = true;
		}
	}

	if (enemiesLeft <= 3 && isFinite(enemiesLeft)) textBottom = enemiesLeft + " left";

	if (enemiesSpawned >= enemiesToSpawn && g_enemies.length <= 0) levelCleared = true;

	if (levelCleared) {
		changeState(STATE_CLEARED);
		g_player.gun.reload();
		//g_level++;
		soundPlayExtra(soundLevelCleared, cameraPos, 2, 0.8, 0, 1000);
		return;
	}

	if (!levelCleared && naturalAlive < enemiesMaxAlive && g_enemies.length < getMaxActiveMobs(g_level) && enemiesSpawned < enemiesToSpawn && ticsToSpawn <= 0) {
		spawnEnemy();
		ticsToSpawn = rand(120);
	}

	if (g_player.hp <= 0) {
		changeState(STATE_DEAD);
		localStorage.da_t = max(g_score, localStorage.da_t || 0);
		return;
	}

	if (ammoCooldownFrames > 0) {
		ammoCooldownFrames--;
	}

	if (g_player.gun && g_player.getAmmoForCurrentGun() === 0) {
		if (ammoCooldownFrames <= 0) {
			let hasNearbyReachableAmmo = false;
			for (const o of engineObjects) {
				if (o instanceof AmmoBox && o.pos.distance(g_player.pos) <= 3.5 && !tileCollisionRaycast(g_player.pos, o.pos)) {
					hasNearbyReachableAmmo = true;
					break;
				}
			}
			if (!hasNearbyReachableAmmo) {
				let newAmmo = new AmmoBox(findFreePosRange(2.5, 4.0, true), g_player.gun.tileIndex, null, true);
				soundLevelCleared.play(newAmmo.pos, 0.5, 3);
				ammoCooldownFrames = 240;
			}
		}
	}

	let newPoint = mousePos;
	if (isTouchDevice && g_player.gun) {
		// halfway from player to screen
		newPoint = g_player.pos.add(
			vec2(0)
				.setAngle(g_player.gun.angle + PI / 2)
				.normalize(TILES_PER_SCREEN - 7)
		);
	}
	// camera goes halfway between player and mouse
	cameraPos = cameraPos.lerp(g_player.pos.add(newPoint.subtract(g_player.pos).scale(0.5)), 0.03);

	fx_updateScreenShake();

	cameraPos = cameraPos.add(g_screenShake);

	if (g_CHEATMODE && mouseWasPressed(1)) {
		g_level++;
		startNextLevel();
		changeState(STATE_PLAYING);
		soundPlayExtra(soundLevelCleared, cameraPos, 2, 0.8, 0, 1000);
	}
}

function gameUpdatePost() {
	// called after physics and objects are updated
	// setup camera and prepare for render
}

var textTitle;
var textMiddle;
var textBottom;

function textsClear() {
	textTitle = undefined;
	textMiddle = undefined;
	textBottom = undefined;
}

function drawTextWithOutline(text, pos, size, textColor, arg5, arg6, textAlign = 'center') {
	let outlineWidth;
	let outlineColor;

	if (typeof arg5 === 'number') {
		// 6-argument call: (text, pos, size, textColor, outlineWidth, outlineColor)
		outlineWidth = arg5;
		outlineColor = arg6 || colorBlack;
	} else {
		// 4 or 5-argument call: (text, pos, size, textColor, outlineColor)
		outlineWidth = Math.max(1.5, size / 15);
		outlineColor = arg5 || colorBlack;
		if (typeof arg6 === 'string') {
			textAlign = arg6;
		}
	}

	drawTextScreen(text, pos, size, textColor, outlineWidth, outlineColor, textAlign);
}

function testForMiscount() {
	let e = 0;
	for (const o of engineObjects) {
		if (o instanceof Enemy) e++;
	}

	if (e != g_enemies.length) {
		debugger;
	}
}

function textsDraw() {
	debug && testForMiscount();

	if (g_CHEATMODE) {
		drawTextScreen("CHEAT MODE ON ", vec2(100, 25), 20, colorWhite, 0, undefined, "left");
		drawTextScreen("enemies: " + g_enemies.length, vec2(100, 50), 20, colorWhite, 0, undefined, "left");
	}

	if (textTitle) {
		let flicker = (1.5 + Math.sin(frame / 50)) * 0.007;

		for (let i = 0; i < 10; i++) {
			drawTextScreen(
				textTitle,
				vec2(
					(rand(1 - flicker, 1 + flicker) * mainCanvas.width) / 2,
					(rand(1 - flicker, 1 + flicker) * mainCanvas.height) / 3.4
				),
				mainCanvas.width / 10,
				colorBlack.lerp(colorBlood, i / 10)
			);
		}

		// Subtitle: REVAMPED (TWITCH EDITION) with Twitch purple / blood arcade flicker
		let subFlicker = (1.5 + Math.cos(frame / 40)) * 0.005;
		let purpleGlow = new Color(0.57, 0.27, 1.0);
		for (let i = 0; i < 6; i++) {
			drawTextScreen(
				"- REVAMPED (TWITCH EDITION) -",
				vec2(
					(rand(1 - subFlicker, 1 + subFlicker) * mainCanvas.width) / 2,
					(rand(1 - subFlicker, 1 + subFlicker) * mainCanvas.height) / 3.4 + mainCanvas.width / 15
				),
				mainCanvas.width / 24,
				colorBlack.lerp(purpleGlow, i / 6)
			);
		}

		// Streamer Dashboard shortcut hint (auto-detects Mac vs Windows)
		const isMac = typeof navigator !== 'undefined' && (/Mac|iPhone|iPod|iPad/i.test(navigator.platform || '') || /Macintosh|Mac OS X/i.test(navigator.userAgent || ''));
		const dashboardHint = isMac ? "Press Cmd+D to Open Streamer Dashboard" : "Press Ctrl+D to Open Streamer Dashboard";
		drawTextWithOutline(
			dashboardHint,
			vec2(mainCanvas.width / 2, mainCanvas.height - mainCanvas.height / 14),
			Math.max(12, mainCanvas.width / 42),
			new Color(0.78, 0.65, 1.0, 0.9),
			colorBlack
		);
	}

	if (textMiddle) {
		drawTextWithOutline(
			textMiddle,
			vec2(mainCanvas.width / 2, mainCanvas.height / 2),
			mainCanvas.width / 20,
			colorBlood
		);
	}

	if (textBottom) {
		let amt = 0.5 + Math.sin(frame / 10) / 2;

		if (g_state == STATE_PLAYING) amt = 1;

		//let col = new Color((amt * 172) / 255, (amt * 50) / 255, (amt * 50) / 255);

		let col = colorBlood.scale(amt);

		drawTextWithOutline(
			textBottom,
			vec2(mainCanvas.width / 2, (4 * mainCanvas.height) / 5),
			mainCanvas.width / 30,
			col
		);
	}

	// Start Screen: Procedural retro arcade artwork (Phase 17, VIS-01)
	if (g_state == STATE_CLICK_TO_START) {
		if (typeof renderStartScreen === "function") {
			renderStartScreen();
		} else {
			let rec =
				typeof g_apgManager !== "undefined" && g_apgManager
					? g_apgManager.allTimeRecords || g_apgManager.loadAllTimeRecords()
					: null;
			if (rec) {
				let mvpStr = "ALL-TIME MVP: " + (rec.mvp ? "@" + rec.mvp.user + " (" + rec.mvp.score + " pts)" : "None");
				let traitorStr = "ALL-TIME TRAITOR: " + (rec.traitor ? "@" + rec.traitor.user + " (" + rec.traitor.score + " pts)" : "None");
				let winsStr = "RECORD: " + rec.goodWins + " GOOD WINS - " + rec.badWins + " BAD WINS";
				let recY = mainCanvas.height * 0.62;
				let u = Math.max(12, mainCanvas.width / 45);
				drawTextWithOutline(mvpStr + "  |  " + traitorStr, vec2(mainCanvas.width / 2, recY), u * 0.72, colorSpark);
				drawTextWithOutline(winsStr, vec2(mainCanvas.width / 2, recY + u * 1.05), u * 0.65, colorBullet);
			}
		}
	}
}

function gameRender() {
	mapMan?.render();

	// called before objects are rendered
	// draw any background effects that appear behind objects

	while (g_corpses.length > 40) {
		let oldCorpse = g_corpses.shift();
		if (oldCorpse && oldCorpse.destroy) oldCorpse.destroy();
	}

	for (let i = 0; i < g_corpses.length; i++) {
		g_corpses[i].renderNow();
	}

	while (g_shells.length > 48) {
		g_shells.shift();
	}

	for (let i = 0; i < g_shells.length; i++) {
		let shell = g_shells[i];
		drawRect(shell.pos, vec2(1 / 12, 2 / 12), shell.color, shell.angle);
		if (shell.life > 0) {
			shell.pos = shell.pos.add(shell.velocity);
			shell.velocity.y -= 1 / 144;
			shell.angle += shell.angularVelocity;
			shell.life--;
		}
	}

	while (g_splatter.length > 512) {
		g_splatter.shift();
	}

	for (let i = 0; i < g_splatter.length; i++) {
		for (let j = 0; j < g_splatter[i].pattern.length; j++) {
			if (g_splatter[i].pattern[j]) {
				let x = g_splatter[i].pos.x - (2 + (j % 4)) / 12;
				let y = g_splatter[i].pos.y - (2 + Math.floor(j / 4)) / 12;
				drawRect(vec2(x, y), vec2(1.1 / 12), g_splatter[i].color);
			}
		}
	}

	// moss
	for (let i = 0; i < g_moss.length; i++) {
		let moss = g_moss[i];
		drawTile(moss.pos, vec2(1 / 3), moss.tileIndex, MINI_TILE_SIZE, colorWhite, moss.angle);
	}

	// bullet holes
	for (let i = 0; i < g_holes.length; i++) {
		let hole = g_holes[i];
		drawRect(hole.pos, vec2(hole.size / 12), hole.color);
	}

	if (typeof g_apgManager !== "undefined" && g_apgManager) {
		g_apgManager.renderWorldPre();
	}

	// // sparks
	// for (let i = 0; i < g_sparks.length; i++) {
	// 	let spark = g_sparks[i];
	// 	spark.pos.x += Math.cos(spark.angle) / 32;
	// 	spark.pos.y += Math.sin(spark.angle) / 32;
	// 	drawRect(spark.pos, vec2(1 / 24), colorSpark);
	// 	if (--spark.life <= 0) {
	// 		g_sparks.splice(i, 1);
	// 	}
	// }

	//textsDraw();
}
