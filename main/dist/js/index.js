/** @format */

var mapMan;

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

	g_levelDef = levelDefs[g_level % levelDefs.length];
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

	g_levelDef = levelDefs[g_level % levelDefs.length];

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

	if (g_state == STATE_PLAYING) {
		// ESC (27) or P (80) toggles in-game pause
		if (keyWasPressed(27) || keyWasPressed(80)) {
			g_isPaused = !g_isPaused;
			if (g_isPaused) uiSound(1);
		}
		if (g_isPaused) {
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

	// Title Screen: All-Time persistent records (D-29)
	if (g_state == STATE_CLICK_TO_START) {
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

/** @format */

const STATE_CLICK_TO_START = 0;
const STATE_PLAYING = 1;
const STATE_DEAD = 2;
const STATE_CLEARED = 3;
const STATE_LOBBY = 4;
const STATE_OUTCOME = 5;

const TILE_SIZE = vec2(12);
const MINI_TILE_SIZE = vec2(4);
const MOB_SIZE = vec2(0.6, 0.8);
const TILES_PER_SCREEN = 13;

fontDefault = "Courier New";

// "Courier";
// "American Typewriter";
// "Courier New";
// "Luminari"

const g_CHEATMODE = 0;
let g_score = 0;
let g_level = 0;
let g_levelDef = undefined;

let g_screenShake = vec2(0);

const tileNumbers_player = 0;
const tileNumbers_zombie = 1;
const tileNumbers_vampire = 2;
const tileNumbers_bat = 3;
const tileNumbers_ghost = 4;
const tileNumbers_beefyZombie = 5;
const tileNumbers_bossPlaceholder = 4;
const tileNumbers_facePlayer = 5;
const tileNumbers_faceZombie = 6;
const tileNumbers_faceVampire = 7;
const tileNumbers_pistol = 15;
const tileNumbers_shotgun = 16;
const tileNumbers_shellIcon = 17;
const tileNumbers_bulletIcon = 18;
const tileNumbers_rifleAmmoIcon = 19;
const tileNumbers_rifle = 20;
const tileNumbers_smg = 25;
const tileNumbers_boxBullets = 21;
const tileNumbers_boxShells = 22;
const tileNumbers_boxRifleAmmo = 23;
const tileNumbers_floorStone = 12;
const tileNumbers_door = 11;

// Reserve Ammo Caps (BAL-10, BAL-21, D-09)
const MAX_AMMO_BULLETS = 36;
const MAX_AMMO_SHELLS = 8; // Lowered from 12 to 8 (D-09)
const MAX_AMMO_RIFLE = 8;

// Level Transition Opening Reserve Caps (BAL-21, D-18)
const LEVEL_TRANSITION_MAX_BULLETS = 18;
const LEVEL_TRANSITION_MAX_SHELLS = 4;
const LEVEL_TRANSITION_MAX_RIFLE = 3;

let g_player = null;
var g_savedEquipment = null;

var g_difficulty = 0;

var g_enemies = [];
var g_doors = {};
var g_splatter = [];
var g_holes = [];
//var g_sparks = [];
var g_corpses = [];
var g_shells = [];
var g_moss = [];
var g_shadows = {};
var g_transforms = [];

var colorBlack = new Color(0, 0, 0);
var colorWhite = new Color();
var colorGrey = colorWhite.scale(0.5);

var colorBlood = new Color(172 / 255, 50 / 255, 50 / 255);
var colorBullet = new Color(217 / 255, 160 / 255, 102 / 255);
//var colorScoreText = new Color(106 / 255, 190 / 255, 48 / 255);
var colorShell = new Color(217 / 255, 87 / 255, 99 / 255);
var colorRifleRound = new Color(99 / 255, 155 / 255, 255 / 255);

var colorSpark = new Color(251 / 255, 242 / 255, 54 / 255);

var colorEarth = colorBullet; // new Color(143 / 255, 86 / 255, 59 / 255);

var colorZombie = new Color(55 / 255, 148 / 255, 110 / 255);

var g_state = STATE_CLICK_TO_START;
let g_isPaused = false;

const miniTileNumbers_miniFacePlayer = 18 * 15 + 0;
const miniTileNumbers_miniFaceZombie = 18 * 15 + 1;
const miniTileNumbers_miniFaceVampire = 18 * 15 + 2;
const miniTileNumbers_miniFaceGhost = 18 * 15 + 3;
const miniTileNumbers_miniFaceBoss = 9;
const miniTileNumbers_miniFaceBossAngry = 19;
const miniTileNumbers_moss = 18 * 15 + 4;

const mobDefs = {
	Zombie: {
		hp: 2,
		hpGainPerlevel: 0,
		maxSpeed: 0.06,
	},
	BossZombie: {
		hp: 22,
		hpGainPerlevel: 5,
		maxSpeed: 0.5,
	},
	Vampire: {
		hp: 1,
		hpGainPerlevel: 0,
		maxSpeed: 0.2,
		addTransformHp: 5,
	},
	Ghost: {
		hp: 1,
		hpGainPerlevel: 0,
		maxSpeed: 0.05,
	},
};

const levelDefs = [
	{
		// start
		map: 0,
		enemiesToSpawn: 10,
		enemiesMaxAlive: 3,
		spawns: [{ chance: 1 }],
	},
	{
		// graveyard
		map: 1,
		enemiesToSpawn: 12,
		enemiesMaxAlive: 3,
		spawns: [{ chance: 1 }],
	},
	{
		// intro to vampires
		map: 3,
		enemiesToSpawn: 15,
		enemiesMaxAlive: 4,
		spawns: [{ chance: 0.5 }, { type: "v", chance: 0.5 }],
	},
	{
		// intro to ghosts
		map: 4,
		enemiesToSpawn: 15,
		enemiesMaxAlive: 4,
		spawns: [{ chance: 0.5 }, { type: "g", chance: 0.5 }],
	},
	{
		// final boss
		map: 2,
		enemiesToSpawn: Infinity,
		enemiesMaxAlive: 5,
		spawns: [{ chance: 0.4 }, { type: "v", chance: 0.3 }, { type: "g", chance: 0.3 }],
	},
];


function soundPlayExtra(sound, pos, vol, pitch, rand = 0, delay = 0, repeat = 1, initDelay=0) {
	for (let i = 0; i < repeat; i++) { 
		setTimeout( () => sound.play(pos, vol, pitch, rand), initDelay + delay * (i+1) )
	}
 }




/// Player

var soundPlayerScream = new Sound([1,,440,,.1,1,3,1,-.2,,50,,,.4,,.05,.05,.9,.5,]);


var soundPickup = new Sound([1,.1,200,,,,4,,,1.2,50,.57,,,,.2,.2,,.2,]);



var soundLevelCleared = new Sound([2,0,685,0,.57,.3,0,3,.6,0,174,.08,.04,0,0,0,.15,.7,.1,.32])
	
	
//	[1.29, .05, 685, .04, .13, .23, 2, 1.91, .6, 0, 174, .08, .04, 0, 0, 0, .06, .98, .28, .14]);


/// Weapons

var soundRifle = new Sound([3,,164.8138,,,,4,,,,,,,,,-.3]);
var soundPistol = new Sound([1,,164.8138,,,,4,,,,,,,,,-.3]);
var soundShotgun = new Sound([3,,352,.07,.01,.2,4,3,,.4,,,.15,1.5,,.7,.12,.2]);

var soundBulletHit =new Sound([1,.1,137,.02,.02,.04,4,2.98,-0.9,-3.5,0,0,0,1.6,-2.3,.1,0,.87,0,0]);
	
var soundGunReload = new Sound([,.3,,.01,,.01,4,,20,6,600,.07,.3,3.6,12,,,,,.12]);
var soundGunEmpty = new Sound([1,,65,,,.02,4,,,,,,,2,,,,1,,0]);



/// Monsters

var soundEnemyGroan = new Sound([ 1,.5,329.6276,.16,.62,.33,,.5,,,-50,.14,.13,2.5,28,,,.9,.07,.12,]);
var soundBossStep = new Sound([3.5,,15,.02,.1,.05,,3.67,,.6,,,.13,1.8,,.3,,.35,.01]);
var soundBossThrow = new Sound([,,1650,.01,.09,.02,4,.5,1,,,.06,,,13,,,.9,.1]);
var soundBossTearing = new Sound([1.08,,50,,.18,.45,4,,,,,,.01,.3,,1.2,,.3,.11]);
var soundVampireGroan = new Sound([,.1,3665.40639,.12,.05,.09,3,.7,7.4,2.5,,.19,,.9,12,,.04,-.57,.13,]);
var soundGhostGroan = new Sound([2, .1, 130, .06, .2, .5, 0, 1, 0, -2, 0, .3, .3, .1, 0, .1, .01, .8, .07, 0]);
	
	
	//.5, .1, 523.2511, .06, .2, .5, 0, 1, 0, -2, -100, .3, .3, .1, 100, .1, .01, .8, .07, 0]);
	
	//1.01, 0, 523.2511, .06, .2, .15, 0, .07, 0, -1, 0, 0, .3, 1, 0, 0, .1, .49, .07, .33]);


var soundBoulderDestroy = new Sound([1.08,,50,,.18,.45,4,,,,,,.01,.3,,1.7,,.3,.11]);

/// APG Audience Cues

var soundTeamGood = new Sound([1.2, 0, 520, .04, .18, .22, 0, 1.6, 0, 0, 180, .06, .04, 0, 0, 0, .05, .8, .1, .2]);
var soundTeamBad = new Sound([2.0, 0, 115, .08, .35, .42, 3, 2.2, -4, 0, 0, 0, .08, 1.1, -8, .2, .08, .6, .18, .3]);
var soundCountdownBeep = new Sound([0.8, 0, 660, 0.01, 0.04, 0.06, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.02]);
var soundPredictionLocked = new Sound([1.5, 0, 220, 0.02, 0.25, 0.35, 2, 1.8, 0, 0, 110, 0.08, 0.06, 0, 0, 0, 0.08, 0.85, 0.1, 0.25]);

/// Phase 3 APG Action & Clutch Stingers
var soundJam = new Sound([1.6, 0, 140, 0.01, 0.05, 0.12, 4, 2.5, -8, 0, -90, 0.03, 0, 2.2, 0, 0.15, 0.04, 0.75, 0.02, 0]);
var soundBlackout = new Sound([1.8, 0, 95, 0.05, 0.28, 0.45, 2, 1.4, -3, -1, 0, 0, 0, 0.6, 0, 0.1, 0.08, 0.7, 0.15, 0.25]);
var soundBossSpawn = new Sound([2.2, 0, 75, 0.04, 0.35, 0.55, 3, 2.8, -1.5, 0, -40, 0.05, 0.08, 1.5, 8, 0.2, 0.1, 0.85, 0.15, 0.3]);
var soundShieldBreak = new Sound([1.5, 0, 380, 0.01, 0.08, 0.22, 1, 2.1, 4, -6, 160, 0.04, 0.03, 0.8, 0, 0.1, 0.05, 0.8, 0.05, 0.15]);
var soundDivineFlash = new Sound([2.2, 0, 587.33, 0.03, 0.38, 0.65, 0, 1.9, 0.5, 1.2, 293.66, 0.07, 0.05, 0, 0, 0, 0.12, 0.9, 0.15, 0.4]);

/// Phase 4 APG Outcome Stingers
var soundOutcomeGood = new Sound([1.8, 0, 523.25, 0.04, 0.45, 0.75, 0, 1.8, 0, 0, 261.6, 0.08, 0.06, 0, 0, 0, 0.06, 0.88, 0.12, 0.35]);
var soundOutcomeBad = new Sound([2.4, 0, 85, 0.08, 0.65, 0.95, 3, 2.5, -3, -1, -50, 0.08, 0.12, 1.4, -6, 0.25, 0.1, 0.9, 0.2, 0.35]);

/// Phase 13 Combat Vulnerability & Pacing Escalation Stingers

// Deep biological heartbeat thump for 1 HP danger state (D-05)
// Low sine wave (shape 0), 60Hz, fast attack 0.01s, quick decay with pitch drop
var soundHeartbeat = new Sound([1.5, 0, 60, 0.01, 0.05, 0.14, 0, 1.8, -6, 0, 0, 0, 0, 0, 0, 0, 0, 0.65, 0.02, 0]);

// Ominous war-horn stinger for Blood Surge / Frenzy activation (D-13)
// Low saw/brass tone (shape 2), 110Hz, slow attack 0.08s, long sustain 0.6s, pitch slide
var soundWarHorn = new Sound([1.8, 0, 110, 0.08, 0.6, 0.9, 2, 2.1, -1.2, -0.4, 0, 0, 0, 0.1, 0.05, 0.15, 0.08, 0.8, 0.12, 0.3]);

// Seismic rumble for 2-second pre-surge telegraph (D-11)
// Sub-bass sine wave (shape 0), 42Hz, slow attack 0.2s, 1.2s sustain with atmospheric noise
var soundRumble = new Sound([1.2, 0, 42, 0.2, 1.2, 1.4, 0, 1.4, 0, 0, 0, 0, 0, 0.4, 0, 0.1, 0.15, 0.75, 0.2, 0.1]);


/** @format */

var songData = [
	[
		[, 0, 43, 0.01, , 0.3, 2, , , , , , , , , 0.02, 0.01], // 0 bass
		[20, 0, 170, 0.003, , 0.008, , 0.97, -35, 53, , , , , , 0.1], // 1 base drum
		[0.8, 0, 270, , , 0.12, 3, 1.65, -2, , , , , 4.5, , 0.02], // 2 snare

		// [, 0, 86, , , , , 0.7, , , , 0.5, , 6.7, 1, 0.05], // 3 hh
		// [, 0, 77, , , 0.7, 2, 0.41, , , , , , , , 0.06], // 4 bass
		// [, 0, 41, , 0.05, 0.4, 2, 0, , , 9, 0.01, , , , 0.08, 0.02], // 5 bass
		// [, 0, 2200, , , 0.04, 3, 2, , , 800, 0.02, , 4.8, , 0.01, 0.1], // 6 hh / click
		// [0.3, 0, 16, , , 0.3, 3], // 7 bass
	],
	[[], []],
	[0, 1], // patterns
	50,
];

function unfoldPattern(instrument, pan, startnode, pattern, starts) {
	var nodes = [];
	nodes.push(instrument);
	nodes.push(pan);

	for (const s of starts) {
		for (const b of pattern) {
			nodes.push(startnode + b + s);
		}
	}

	return nodes;
}

function createMinorIssues() {
	// prettier-ignore
	let chordStarts = [
		undefined, undefined, undefined, undefined,
		2, 2, 2, 2,
		0, 0, 0, 0,
		2, 2, 2, 2,
		0, 0, 0, 0,
		7, 7, 7, 7,
		5, 5, 5, 5,
		9, 9, 11, 11,
		13, 15, 17, 19,
	];

	let bassPattern = [0, 12, 14, 15, 0, 12, 15, 14];

	let bassNodes = unfoldPattern(0, -0.1, 7, bassPattern, chordStarts);
	songData[1][1].push(bassNodes);

	let bassNodes2 = unfoldPattern(0, 0.1, 7 + 7, bassPattern, chordStarts);
	songData[1][1].push(bassNodes2);

	// let drumStarts = Array(chordStarts.length / 2).fill(0);
	// let bdPattern = [0, , , , 0, 0, , , 0, , , , 0, 0, , ,];
	// songData[1][0].push(unfoldPattern(1, 0, 8, bdPattern, drumStarts));

	// let snarePattern = [, , 0, , , , 0, , , , 0, , , , 0, 0];
	// songData[1][0].push(unfoldPattern(2, 0.1, 7, snarePattern, drumStarts));

	let bdStarts = Array(chordStarts.length).fill(0);
	let snareStarts = Array(chordStarts.length / 2).fill(0);
	let bdPattern = [0, 0, undefined, undefined, 0, 0, undefined, undefined];
	let snarePattern = [
		undefined,
		undefined,
		0,
		undefined,
		undefined,
		undefined,
		0,
		undefined,
		undefined,
		undefined,
		0,
		undefined,
		undefined,
		undefined,
		0,
		0,
	];

	songData[1][0].push(unfoldPattern(1, 0, 7, bdPattern, [0, 0, 0, 0]));

	songData[1][1].push(unfoldPattern(1, 0, 7, bdPattern, bdStarts));
	songData[1][1].push(unfoldPattern(2, 0.1, 7, snarePattern, snareStarts));
}

var vol = 0.6; //0.5; //.7;

var music;
var source;

function musicStart() {
	//createBlues();
	createMinorIssues();

	if (music) return;

	music = new Music(songData);
	source = music.play(vol);
}

function musicResume() {
	if (!music) return;

	if (!source) {
		source = music.play(vol);
	}
}

/** @format */

class APGNetwork {
	constructor() {
		this.ws = null;
		this.connected = false;
		this.isMock = false;
		this.hasHelixAuth = false;
		this.channel = "";
		this.viewerCount = 0;
		this.reconnectDelay = 1000;
		this.maxReconnectDelay = 5000;
		this.listeners = {
			action: [],
			vote: [],
			status: [],
			prediction: [],
			predictionLocked: [],
			charge: [],
			outcomeResolved: [],
		};
		this.lastAudioCue = { good: 0, bad: 0 };
		this.lastOutcome = null;
		this.reconnectTimer = null;
		this.localTimer = null;
		this.prediction = this._createDefaultPrediction();
		this.lockedPrediction = null;
		this.chargeState = {};
	}

	_createDefaultPrediction(level = 1, durationSeconds = 60) {
		return {
			status: "IDLE",
			mode: "chat",
			level: level,
			title: "Will Chat be GOOD or BAD this run?",
			remainingSeconds: durationSeconds,
			durationSeconds: durationSeconds,
			goodCount: 0,
			badCount: 0,
			goodPct: 50,
			badPct: 50,
			recentGoodVoters: [],
			recentBadVoters: [],
			totalVoters: 0,
			lockRequested: false,
		};
	}

	_stopLocalTimer() {
		if (this.localTimer) {
			clearInterval(this.localTimer);
			this.localTimer = null;
		}
	}

	_applyPredictionState(predData) {
		if (!predData || typeof predData !== "object") return;
		this.prediction = Object.assign({}, this.prediction, predData);
		if (predData.status === "LOCKED") {
			this.lockedPrediction = Object.assign({}, this.lockedPrediction || {}, predData);
		}
	}

	send(payload) {
		if (this.ws && this.ws.readyState === 1) {
			try {
				this.ws.send(JSON.stringify(payload));
				return true;
			} catch (err) {
				return false;
			}
		}
		return false;
	}

	sendMatchOutcome(payload) {
		return this.send(Object.assign({ type: "MATCH_OUTCOME" }, payload));
	}

	startPrediction(level = 1, durationSeconds = 60) {
		this._stopLocalTimer();
		this.prediction = this._createDefaultPrediction(level, durationSeconds);
		this.prediction.status = "LOBBY";
		this.chargeState = {};

		this.send({ type: "START_PREDICTION", level: level });

		var self = this;
		this.localTimer = setInterval(function () {
			if (!self.connected && self.prediction && self.prediction.status === "LOBBY") {
				self.prediction.remainingSeconds = Math.max(0, (self.prediction.remainingSeconds || 0) - 1);
				for (var i = 0; i < self.listeners.prediction.length; i++) {
					self.listeners.prediction[i](self.prediction);
				}
				if (self.prediction.remainingSeconds <= 0) {
					self.lockPrediction();
				}
			}
		}, 1000);
	}

	lockPrediction() {
		this._stopLocalTimer();
		if (this.send({ type: "LOCK_PREDICTION" })) {
			if (this.prediction) {
				this.prediction.lockRequested = true;
			}
			return;
		}

		if (!this.connected && this.prediction) {
			this.prediction.status = "LOCKED";
			this.prediction.remainingSeconds = 0;
			this.lockedPrediction = {
				status: "LOCKED",
				mode: "chat",
				level: this.prediction.level,
				goodCount: this.prediction.goodCount || 0,
				badCount: this.prediction.badCount || 0,
				goodPct: typeof this.prediction.goodPct === "number" ? this.prediction.goodPct : 50,
				badPct: typeof this.prediction.badPct === "number" ? this.prediction.badPct : 50,
				teamGood: this.prediction.recentGoodVoters || [],
				teamBad: this.prediction.recentBadVoters || [],
			};
			for (var i = 0; i < this.listeners.predictionLocked.length; i++) {
				self_notifyLocked(this.listeners.predictionLocked[i], this.lockedPrediction);
			}
		}
	}

	connect(url) {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		var wsUrl =
			url ||
			(window.location.protocol === "https:" ? "wss://" : "ws://") +
				(window.location.host || "localhost:8080");

		try {
			this.ws = new WebSocket(wsUrl);
		} catch (e) {
			this._scheduleReconnect(url);
			return;
		}

		var self = this;

		this.ws.onopen = function () {
			self.connected = true;
			self.reconnectDelay = 1000;
			self._notifyStatus();
			if (typeof g_state !== "undefined" && g_state === STATE_LOBBY && self.prediction && self.prediction.status === "LOBBY") {
				self.send({ type: "START_PREDICTION", level: self.prediction.level || 1 });
			}
		};

		this.ws.onmessage = function (event) {
			try {
				if (!event || typeof event.data !== "string") return;
				var data = JSON.parse(event.data);
				if (!data || typeof data.type !== "string") return;

				if (data.type === "STATUS") {
					self.connected = !!data.connected;
					self.channel = data.channel || "";
					self.viewerCount = data.viewers || 0;
					self.isMock = data.mode === "mock";
					self.hasHelixAuth = !!data.hasHelixAuth;
					if (data.prediction) {
						self._applyPredictionState(data.prediction);
					}
					self._notifyStatus();
				} else if (data.type === "PREDICTION_STATE") {
					self._stopLocalTimer();
					self._applyPredictionState(data);
					for (var p = 0; p < self.listeners.prediction.length; p++) {
						self.listeners.prediction[p](self.prediction);
					}
				} else if (data.type === "PREDICTION_LOCKED") {
					self._stopLocalTimer();
					self.lockedPrediction = data;
					self.prediction = Object.assign({}, self.prediction, data, {
						status: "LOCKED",
						remainingSeconds: 0,
					});
					for (var l = 0; l < self.listeners.predictionLocked.length; l++) {
						self.listeners.predictionLocked[l](self.lockedPrediction);
					}
				} else if (data.type === "CHARGE_UPDATE") {
					if (typeof data.action === "string") {
						self.chargeState[data.action] = data;
					}
					for (var c = 0; c < self.listeners.charge.length; c++) {
						self.listeners.charge[c](data);
					}
				} else if (data.type === "ACTION") {
					if (typeof data.action !== "string" || typeof data.team !== "string") return;
					self.playActionSound(data.team);
					for (var i = 0; i < self.listeners.action.length; i++) {
						self.listeners.action[i](data);
					}
				} else if (data.type === "VOTE") {
					if (typeof data.team !== "string") return;
					for (var j = 0; j < self.listeners.vote.length; j++) {
						self.listeners.vote[j](data);
					}
				} else if (data.type === "OUTCOME_RESOLVED") {
					self.lastOutcome = data;
					for (var r = 0; r < self.listeners.outcomeResolved.length; r++) {
						self.listeners.outcomeResolved[r](data);
					}
				}
			} catch (err) {
				// Discard invalid or malformed packets silently
			}
		};

		this.ws.onclose = function () {
			self.connected = false;
			self._notifyStatus();
			self._scheduleReconnect(url);
		};

		this.ws.onerror = function () {
			console.warn("[APGNetwork] Connection error");
		};
	}

	_scheduleReconnect(url) {
		var self = this;
		var jitter = Math.random() * 500;
		var delay = Math.min(this.maxReconnectDelay, this.reconnectDelay * 1.5) + jitter;
		this.reconnectDelay = delay;
		this.reconnectTimer = setTimeout(function () {
			self.connect(url);
		}, delay);
	}

	_notifyStatus() {
		var statusObj = {
			connected: this.connected,
			isMock: this.isMock,
			hasHelixAuth: this.hasHelixAuth,
			channel: this.channel,
			viewerCount: this.viewerCount,
		};
		for (var i = 0; i < this.listeners.status.length; i++) {
			this.listeners.status[i](statusObj);
		}
	}

	onAction(callback) {
		if (typeof callback === "function") {
			this.listeners.action.push(callback);
		}
	}

	onVote(callback) {
		if (typeof callback === "function") {
			this.listeners.vote.push(callback);
		}
	}

	onStatus(callback) {
		if (typeof callback === "function") {
			this.listeners.status.push(callback);
		}
	}

	onPrediction(callback) {
		if (typeof callback === "function") {
			this.listeners.prediction.push(callback);
		}
	}

	onPredictionLocked(callback) {
		if (typeof callback === "function") {
			this.listeners.predictionLocked.push(callback);
		}
	}

	onCharge(callback) {
		if (typeof callback === "function") {
			this.listeners.charge.push(callback);
		}
	}

	onOutcomeResolved(callback) {
		if (typeof callback === "function") {
			this.listeners.outcomeResolved.push(callback);
		}
	}

	playActionSound(team) {
		var now = Date.now();
		if (team === "good") {
			if (now - this.lastAudioCue.good < 200) return;
			this.lastAudioCue.good = now;
			if (typeof soundTeamGood !== "undefined") {
				soundTeamGood.play();
			}
		} else if (team === "bad") {
			if (now - this.lastAudioCue.bad < 200) return;
			this.lastAudioCue.bad = now;
			if (typeof soundTeamBad !== "undefined") {
				soundTeamBad.play();
			}
		}
	}

	renderBadge() {
		if (typeof mainCanvasSize === "undefined") return;

		var x = mainCanvasSize.x - 12;
		var y = 20;
		var fontSize = 14;

		if (this.connected) {
			if (this.isMock) {
				// DEV MOCK: Amber dot
				drawTextScreen("● DEV MOCK", vec2(x, y), fontSize, new Color(1, 0.7, 0.1), 2, colorBlack, "right");
			} else {
				// LIVE: Bright Green dot with channel name and optional viewer count
				var badgeText =
					"● LIVE #" +
					(this.channel || "channel") +
					(this.viewerCount > 0 ? " | " + this.viewerCount + " viewers" : "");
				drawTextScreen(badgeText, vec2(x, y), fontSize, new Color(0.2, 1, 0.3), 2, colorBlack, "right");
			}
		} else {
			// RECONNECTING: Flashing red/amber dot using LittleJS frame counter
			var blink = typeof frame !== "undefined" ? Math.sin(frame / 10) > 0 : true;
			var col = blink ? new Color(1, 0.2, 0.2) : new Color(0.5, 0.5, 0.5);
			drawTextScreen("○ RECONNECTING...", vec2(x, y), fontSize, col, 2, colorBlack, "right");
		}

		if (typeof g_state !== "undefined" && g_state === STATE_PLAYING && this.lockedPrediction) {
			var goodPct = typeof this.lockedPrediction.goodPct === "number" ? this.lockedPrediction.goodPct : 50;
			var badPct = typeof this.lockedPrediction.badPct === "number" ? this.lockedPrediction.badPct : 50;
			var predText = "PREDICTED: " + goodPct + "% GOOD / " + badPct + "% BAD";
			drawTextScreen(predText, vec2(x, 38), 13, colorBullet, 2, colorBlack, "right");
		}

		if (typeof g_state !== "undefined" && g_state === STATE_PLAYING) {
			var mobCount = typeof g_enemies !== "undefined" ? g_enemies.length : 0;
			var isFinalStand = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.finalStand;
			var mobText = "MOBS: " + mobCount + "/25" + (isFinalStand ? " [FINAL STAND]" : mobCount >= 25 ? " [MAX]" : "");
			var mobCol = mobCount >= 25 || isFinalStand ? colorBlood : colorZombie;
			drawTextScreen(mobText, vec2(x, this.lockedPrediction ? 55 : 38), 13, mobCol, 2, colorBlack, "right");
		}
	}
}

function self_notifyLocked(cb, payload) {
	if (typeof cb === "function") {
		cb(payload);
	}
}

var g_apgNetwork = new APGNetwork();

/** @format */

function getMaxActiveMobs(lvl) {
	const levelIdx = typeof lvl === "number" ? lvl : typeof g_level !== "undefined" ? g_level : 0;
	const caps = [15, 18, 20, 23, 25];
	return caps[clamp(levelIdx, 0, caps.length - 1)];
}
const MAX_ACTIVE_MOBS = 25;
const MAX_AUDIENCE_BOSSES = 2;

// Base Action Impact Weights for Contributor Scoring (D-21)
const ACTION_IMPACT_WEIGHTS = {
	barrier: 3,
	repair: 3,
	slow: 2,
	light: 2,
	ammo: 2,
	boss: 5,
	frenzy: 3,
	jam: 3,
	blackout: 2,
	mob: 2,
};

class APGManager {
	constructor() {
		this.goodActions = 0;
		this.badActions = 0;
		this.displayedGoodPct = 50;
		this.ammoDropCount = 0;
		this.enrageStacks = 0;
		this.postWaveFrames = 0;
		this.finalStand = false;

		// Active timed effects in frames (60fps)
		this.timers = {
			light: 0, // 600 frames (10s, D-04)
			slow: 0, // 480 frames (8s, D-05)
			barrier: 0, // 360 frames (6s, D-06)
			repairWards: 0, // 600 frames (10s, D-02)
			blackout: 0, // 480 frames (8s, D-09)
			frenzy: 0, // 480 frames (8s, D-11)
		};

		// Divine Flash clutch tracking (D-14, D-15, D-16)
		this.clutchComboFrames = 0;
		this.clutchComboKills = 0;
		this.divineFlashCooldown = 0; // 1800 frames (30s)
		this.shockwaves = [];

		// UI & Feedback queues
		this.toasts = []; // max 3, 240 frames (4s)
		this.chargePills = {}; // action -> { action, team, current, required, user, expireFrames }
		this.worldPopups = []; // { text, pos, color, life, maxLife }
		this.centerBanner = null; // { text, subtext, color, frames, maxFrames }
		this.footprints = []; // { pos, life }
		this.frenzySparks = []; // { pos, life }
		this.doorWardPositions = []; // [{ x, y }]

		// Contributor tracking for Phase 4 MVP / Public Enemy #1 with Dual Accounting (D-08, D-21)
		this.levelStats = {
			goodActions: 0,
			badActions: 0,
			contributors: { good: {}, bad: {} },
		};
		this.runStats = {
			goodActions: 0,
			badActions: 0,
			contributors: { good: {}, bad: {} },
			levelsCleared: 0,
		};
		// Backward compatibility alias
		this.contributorStats = this.levelStats.contributors;

		// Action History for Fatal Saboteur Strike 3.0s (180 frame) window (D-22)
		this.recentBadActions = []; // { user, action, frame }

		// All-Time Records persisted in localStorage (D-29)
		this.allTimeRecords = this.loadAllTimeRecords();
		this.matchSummary = null;

		// Ambient Auto-Frenzy cadence & telegraph tracking (BAL-20, D-07..D-11)
		this.ambientFrenzyTimer = rand(2700, 3600) | 0; // 45-60s initial grace period (D-07, D-10)
		this.ambientTelegraphFired = false;
		this.bottomHudAlpha = 1.0;

		// Register network listeners
		if (typeof g_apgNetwork !== "undefined" && g_apgNetwork) {
			var self = this;
			g_apgNetwork.onAction(function (data) {
				self.handleActionPacket(data);
			});
			g_apgNetwork.onCharge(function (data) {
				self.handleChargePacket(data);
			});
		}
	}

	resetForNewGame() {
		this.runStats = {
			goodActions: 0,
			badActions: 0,
			contributors: { good: {}, bad: {} },
			levelsCleared: 0,
		};
		this.recentBadActions = [];
		this.matchSummary = null;
		this.ambientFrenzyTimer = rand(2700, 3600) | 0;
		this.ambientTelegraphFired = false;
		this.bottomHudAlpha = 1.0;
		this.resetForNewLevel();
	}

	resetForNewLevel() {
		this.goodActions = 0;
		this.badActions = 0;
		this.levelStats = {
			goodActions: 0,
			badActions: 0,
			contributors: { good: {}, bad: {} },
		};
		this.contributorStats = this.levelStats.contributors;
		this.recentBadActions = [];
		this.displayedGoodPct = 50;
		this.enrageStacks = 0;
		this.postWaveFrames = 0;
		this.finalStand = false;
		this.chargePills = {};
		this.toasts = [];
		this.worldPopups = [];
		this.centerBanner = null;
		this.clutchComboFrames = 0;
		this.clutchComboKills = 0;
		this.ambientFrenzyTimer = rand(2700, 3600) | 0;
		this.ambientTelegraphFired = false;
		this.bottomHudAlpha = 1.0;
		this.clearActiveEffects();
	}

	clearActiveEffects() {
		this.timers = {
			light: 0,
			slow: 0,
			barrier: 0,
			repairWards: 0,
			blackout: 0,
			frenzy: 0,
		};
		this.shockwaves = [];
		this.footprints = [];
		this.frenzySparks = [];
		this.doorWardPositions = [];
		if (typeof g_shadows !== "undefined") {
			g_shadows = {};
		}
	}

	getActiveSabotageCount() {
		let count = 0;
		if (this.timers.blackout > 0) count++;
		if (this.timers.frenzy > 0) count++;
		if (typeof g_player !== "undefined" && g_player && g_player.gun && g_player.gun.isJammed) count++;
		if (typeof g_enemies !== "undefined") {
			for (let i = 0; i < g_enemies.length; i++) {
				let e = g_enemies[i];
				if (e && e.isAudienceBoss && e.hp > 0) {
					count++;
					break;
				}
			}
		}
		return count;
	}

	formatUserTag(user) {
		let clean = String(user || "Chat").trim().replace(/^@+/, "") || "Chat";
		if (clean.length > 14) {
			return clean.slice(0, 12) + "..";
		}
		return clean;
	}

	addToast(text, team) {
		this.toasts.unshift({
			text: text,
			team: team || "good",
			frames: 240,
			maxFrames: 240,
		});
		if (this.toasts.length > 3) {
			this.toasts.length = 3;
		}
	}

	addWorldPopup(text, pos, color, maxLife = 72) {
		if (!pos) return;
		this.worldPopups.push({
			text: text,
			pos: pos.copy(),
			color: color,
			life: maxLife,
			maxLife: maxLife,
		});
	}

	isPosVisibleToPlayer(worldPos) {
		if (!g_player || !worldPos) return false;
		if (this.timers.light > 0) return true;
		if (this.timers.blackout > 0 && worldPos.distance(g_player.pos) > 3.2) return false;
		if (typeof g_shadows !== "undefined") {
			let key = Math.floor(worldPos.x) + "_" + Math.floor(worldPos.y);
			let sh = g_shadows[key];
			if (sh && sh.alpha > 0.6) return false;
		}
		return true;
	}

	createEnemyByClass(type, pos, twitchUser) {
		let mob;
		if (type === "v") {
			mob = new Vampire(pos);
		} else if (type === "g") {
			mob = new Ghost(pos);
		} else {
			mob = new Zombie(pos);
		}
		if (twitchUser) {
			mob.twitchUser = twitchUser;
		}
		return mob;
	}

	handleChargePacket(data) {
		if (!data || !data.action) return;
		let action = String(data.action).toLowerCase();
		if (data.completed) {
			delete this.chargePills[action];
		} else {
			this.chargePills[action] = {
				action: action,
				team: data.team || "good",
				current: typeof data.current === "number" ? data.current : 1,
				required: typeof data.required === "number" ? data.required : 1,
				user: this.formatUserTag(data.user),
				expireFrames: 300,
			};
		}
	}

	handleActionPacket(data) {
		if (typeof g_state === "undefined" || g_state !== STATE_PLAYING || !g_player || g_player.hp <= 0) return;

		let action = String((data && data.action) || "").toLowerCase();
		let team = data && data.team === "bad" ? "bad" : "good";
		let rawUser = String((data && data.user) || "Chat").trim().replace(/^@+/, "") || "Chat";
		let tag = this.formatUserTag(rawUser);

		// Special Demo / Clutch trigger (divine_flash)
		if (action === "divine_flash") {
			this.triggerDivineFlash("DEMO", rawUser, true);
			return;
		}

		// Action tallies & dual accounting (D-08)
		if (team === "good") {
			this.goodActions++;
			this.levelStats.goodActions++;
			this.runStats.goodActions++;
		} else {
			this.badActions++;
			this.levelStats.badActions++;
			this.runStats.badActions++;
		}

		// Weighted impact scoring (D-21) & chronological tracking (D-23)
		let pts = ACTION_IMPACT_WEIGHTS[action] || 1;
		let now = Date.now();
		let targetStats = [this.levelStats.contributors[team], this.runStats.contributors[team]];
		for (let s = 0; s < targetStats.length; s++) {
			let map = targetStats[s];
			if (!map[rawUser]) {
				map[rawUser] = {
					user: rawUser,
					score: 0,
					actions: 0,
					actionCounts: {},
					firstActionTime: now,
					clutchSave: false,
					fatalStrike: false,
				};
			}
			let entry = map[rawUser];
			entry.score += pts;
			entry.actions += 1;
			entry.actionCounts[action] = (entry.actionCounts[action] || 0) + 1;
		}

		// Track recent bad actions for fatal strike attribution (180 frames / 3.0s window, D-22)
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		if (team === "bad") {
			this.recentBadActions.push({
				user: rawUser,
				action: action,
				frame: curFrame,
			});
			if (this.recentBadActions.length > 50) {
				this.recentBadActions = this.recentBadActions.filter(function (a) {
					return curFrame - a.frame <= 300;
				});
			}
		}

		// Register additional contributors if provided in packet
		if (data && Array.isArray(data.contributors)) {
			for (let i = 0; i < data.contributors.length; i++) {
				let c = String(data.contributors[i]).trim().replace(/^@+/, "");
				if (c && c !== rawUser) {
					for (let s = 0; s < targetStats.length; s++) {
						let map = targetStats[s];
						if (!map[c]) {
							map[c] = {
								user: c,
								score: 0,
								actions: 0,
								actionCounts: {},
								firstActionTime: now,
								clutchSave: false,
								fatalStrike: false,
							};
						}
						map[c].score += 1;
						map[c].actions += 1;
					}
				}
			}
		}

		delete this.chargePills[action];

		// Path B 1-HP Guardian clutch save check (before applying repair HP gain, D-22)
		let isProtectiveGood = action === "repair" || action === "barrier" || action === "light";
		let enemyClose =
			typeof g_enemies !== "undefined" &&
			g_enemies.some(function (e) {
				return e && e.hp > 0 && e.pos.distance(g_player.pos) <= 6.0;
			});
		let triggerGuardianClutch =
			isProtectiveGood && g_player.hp === 1 && enemyClose && this.divineFlashCooldown <= 0;

		// Award Guardian Angel Save bonus (+5 pts) to rawUser if condition met (D-22)
		if (triggerGuardianClutch) {
			let gTargets = [this.levelStats.contributors.good, this.runStats.contributors.good];
			for (let s = 0; s < gTargets.length; s++) {
				let gMap = gTargets[s];
				if (gMap[rawUser]) {
					gMap[rawUser].score += 5;
					gMap[rawUser].clutchSave = true;
				}
			}
		}

		// Execute specific action
		if (action === "ammo") {
			// D-01: Ammo care package + smart upgrade
			this.ammoDropCount++;
			let pos =
				typeof findFreePosRange === "function"
					? findFreePosRange(2.0, 3.2, true)
					: g_player.pos.add(vec2(1.5, 0));
			let gunTile = g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
			new AmmoBox(pos, gunTile, rawUser, false);

			if (gunTile === tileNumbers_pistol && (this.ammoDropCount % 3 === 0 || rand() < 0.25)) {
				let upPos =
					typeof findFreePosRange === "function"
						? findFreePosRange(1.8, 2.8, true)
						: pos.add(vec2(0.6, 0));
				let curLevel = typeof g_level !== "undefined" ? g_level : 0;
				let r = rand();

				// BAL-21, D-07: Shotgun gatekeeping
				if (curLevel < 2) {
					// Levels 0-1: Shotguns disabled; 50% Rifle / 50% Machine Pistol
					if (r < 0.50) {
						new Rifle(upPos);
					} else {
						new MachinePistol(upPos);
					}
				} else {
					// Level 2+: 10% Shotgun / 45% Rifle / 45% Machine Pistol
					if (r < 0.10) {
						new Shotgun(upPos);
					} else if (r < 0.55) {
						new Rifle(upPos);
					} else {
						new MachinePistol(upPos);
					}
				}
				this.addToast("[GOOD] @" + tag + " dropped Ammo + WEAPON UPGRADE!", "good");
			} else {
				this.addToast("[GOOD] @" + tag + " dropped Ammo Care Package!", "good");
			}
		} else if (action === "repair") {
			// D-02: One-way door wards + shield tune-up
			this.doorWardPositions = [];
			if (typeof g_doors !== "undefined") {
				for (let key in g_doors) {
					let d = g_doors[key];
					if (d && typeof d.x === "number" && typeof d.y === "number") {
						if (!d.broken && typeof breakDoorAt === "function") {
							breakDoorAt(d.x, d.y, false);
						}
						this.doorWardPositions.push(vec2(d.x + 0.5, d.y + 0.5));
					}
				}
			}
			this.timers.repairWards = 600; // 10s
			g_player.hp = min(g_player.maxHp || 4, g_player.hp + 1);
			g_player.blood = [];
			if (g_player.gun && typeof g_player.gun.unjamAndRefill === "function") {
				g_player.gun.unjamAndRefill(true);
			}
			this.addWorldPopup("+1 SHIELD & UNJAM!", g_player.pos.add(vec2(0, 0.8)), colorSpark);
			this.addToast("[GOOD] @" + tag + " cast Door Wards + Shield/Tune-Up!", "good");
		} else if (action === "light") {
			// D-04, D-12: Light + Speed
			this.timers.blackout = 0;
			this.timers.light = 600; // 10s
			this.addToast("[GOOD] @" + tag + " cast Full-Arena Light + Speed!", "good");
		} else if (action === "slow") {
			// D-05, D-12: Frost chill
			this.timers.frenzy = 0;
			this.timers.slow = 480; // 8s
			this.addToast("[GOOD] @" + tag + " chilled all enemies (-50% speed)!", "good");
		} else if (action === "barrier") {
			// D-06: Octagonal rune barrier
			this.timers.barrier = 360; // 6s
			this.addToast("[GOOD] @" + tag + " raised Octagonal Push Barrier!", "good");
		} else if (action === "mob") {
			// D-07, D-17, D-18: Perimeter mob pair or horde enrage
			if (this.finalStand || (typeof g_enemies !== "undefined" && g_enemies.length >= getMaxActiveMobs())) {
				this.enrageExistingHorde(rawUser);
				this.addToast("[BAD] @" + tag + " spawned Mob (ENRAGED HORDE!)", "bad");
			} else {
				let pos1 =
					typeof findFreePosRange === "function"
						? findFreePosRange(5.0, 9.0, false)
						: findFreePos(5);
				let mob1 = this.createEnemyByClass(
					typeof getNextEnemySpawnClass === "function" ? getNextEnemySpawnClass() : null,
					pos1,
					rawUser
				);
				mob1.isAudienceSpawned = true;
				mob1.twitchUser = rawUser;
				mob1.spawnTelegraphFrames = 72;
				if (typeof mob1.riseFrames !== "undefined") {
					mob1.riseFrames = 0;
					mob1.pos.y += 0.5;
				}
				if (typeof g_transforms !== "undefined") {
					g_transforms.push({ pos: pos1.copy(), life: 72, tileIndex: tileNumbers_faceZombie });
				}
				g_enemies.push(mob1);

				if (g_level >= 2 && g_enemies.length < getMaxActiveMobs(g_level)) {
					let flankerType =
						typeof g_level !== "undefined" && g_level >= 1 && rand() < 0.2
							? rand() < 0.5
								? "v"
								: "g"
							: typeof getNextEnemySpawnClass === "function"
							? getNextEnemySpawnClass()
							: null;
					let pos2 =
						typeof findFreePosRange === "function"
							? findFreePosRange(5.0, 9.0, false)
							: findFreePos(5);
					let mob2 = this.createEnemyByClass(flankerType, pos2, null);
					mob2.isAudienceSpawned = true;
					mob2.spawnTelegraphFrames = 72;
					if (typeof mob2.riseFrames !== "undefined") {
						mob2.riseFrames = 0;
						mob2.pos.y += 0.5;
					}
					if (typeof g_transforms !== "undefined") {
						g_transforms.push({ pos: pos2.copy(), life: 72, tileIndex: tileNumbers_faceZombie });
					}
					g_enemies.push(mob2);
				}
				this.addToast(
					"[BAD] @" + tag + (g_level >= 2 ? " spawned a Perimeter Mob Pair!" : " spawned a Zombie!"),
					"bad"
				);
			}
		} else if (action === "boss") {
			// D-08, D-17, D-18: Elite mini-boss or boss empowerment
			let livingBosses =
				typeof g_enemies !== "undefined"
					? g_enemies.filter(function (e) {
							return e && e.isAudienceBoss && e.hp > 0;
					  })
					: [];
			if (this.finalStand || livingBosses.length >= MAX_AUDIENCE_BOSSES) {
				if (livingBosses.length > 0) {
					let b = livingBosses[0];
					b.maxHp = (b.maxHp || 16) + 4;
					b.hp = min(b.maxHp, b.hp + 4);
					b.enrageMult = min(1.4, (b.enrageMult || 1.0) * 1.15);
					b.twitchUser = rawUser;
					this.addWorldPopup("[BOSS ENRAGED +4 HP!]", b.pos.add(vec2(0, 1.2)), colorSpark);
					this.addToast("[BAD] @" + tag + " empowered [Boss] @" + tag + "!", "bad");
				} else {
					this.enrageExistingHorde(rawUser);
					this.addToast("[BAD] @" + tag + " enraged Final Stand monsters!", "bad");
				}
			} else {
				if (typeof g_enemies !== "undefined" && g_enemies.length >= getMaxActiveMobs()) {
					let sacrificeIdx = -1;
					for (let i = 0; i < g_enemies.length; i++) {
						let em = g_enemies[i];
						if (em && !em.isAudienceBoss && !em.twitchUser) {
							sacrificeIdx = i;
							break;
						}
					}
					if (sacrificeIdx < 0) {
						for (let i = 0; i < g_enemies.length; i++) {
							let em = g_enemies[i];
							if (em && !em.isAudienceBoss) {
								sacrificeIdx = i;
								break;
							}
						}
					}
					if (sacrificeIdx >= 0) {
						let sacrificed = g_enemies.splice(sacrificeIdx, 1)[0];
						if (sacrificed && sacrificed.destroy) sacrificed.destroy();
					}
				}
				let bossPos =
					typeof findFreePosRange === "function"
						? findFreePosRange(5.5, 9.0, false)
						: findFreePos(6);
				let boss = new BossZombie(bossPos, true, rawUser);
				boss.spawnTelegraphFrames = 54;
				g_enemies.push(boss);
				if (typeof g_transforms !== "undefined") {
					g_transforms.push({ pos: bossPos.copy(), life: 54, tileIndex: tileNumbers_beefyZombie });
				}
				if (typeof soundBossSpawn !== "undefined") soundBossSpawn.play(bossPos);
				if (typeof fx_shakeScreen === "function") fx_shakeScreen(0.8);
				this.addToast("[BAD] @" + tag + " summoned [Boss] @" + tag + "!", "bad");
			}
		} else if (action === "blackout") {
			// D-09, D-12: Arena blackout
			this.timers.light = 0;
			this.timers.blackout = 480; // 8s
			if (typeof soundBlackout !== "undefined") soundBlackout.play();
			this.addToast("[BAD] @" + tag + " triggered Arena BLACKOUT!", "bad");
		} else if (action === "jam") {
			// D-10: Jam weapon
			if (g_player && g_player.gun && typeof g_player.gun.jam === "function") {
				g_player.gun.jam();
			}
			this.addWorldPopup("GUN JAMMED!", g_player.pos.add(vec2(0, 0.85)), colorBlood);
			this.addToast("[BAD] @" + tag + " JAMMED the streamer's weapon!", "bad");
		} else if (action === "frenzy") {
			// D-11, D-12, D-14: Blood frenzy refresh & extension, capped at max 8.0s
			this.timers.slow = 0;
			this.timers.frenzy = Math.min(480, Math.max(this.timers.frenzy || 0, 0) + 480);
			this.ambientFrenzyTimer = rand(2700, 3600) | 0; // Reset ambient countdown
			this.ambientTelegraphFired = false;
			this.addToast("[BAD] @" + tag + " unleashed Enemy Blood FRENZY!", "bad");
		}

		// Trigger Guardian Clutch if condition was met
		if (triggerGuardianClutch) {
			this.triggerDivineFlash("GUARDIAN", rawUser, false);
		}
	}

	enrageExistingHorde(rawUser) {
		this.enrageStacks++;
		if (typeof g_enemies === "undefined" || !g_enemies.length) return;

		// Promote one unnamed basic enemy to carry rawUser
		for (let i = 0; i < g_enemies.length; i++) {
			let e = g_enemies[i];
			if (e && !e.twitchUser && !e.isAudienceBoss && e.hp > 0) {
				e.twitchUser = rawUser;
				break;
			}
		}

		for (let i = 0; i < g_enemies.length; i++) {
			let e = g_enemies[i];
			if (!e || e.hp <= 0) continue;
			if ((e.enrageBonusHp || 0) < 3) {
				e.enrageBonusHp = (e.enrageBonusHp || 0) + 1;
				e.hp += 1;
				if (e.maxHp) e.maxHp += 1;
			}
			e.enrageMult = min(1.4, (e.enrageMult || 1.0) * 1.15);
			if (!e._enrageSized) {
				e._enrageSized = true;
				e.size = e.size.scale(1.15);
			}
		}
	}

	triggerDivineFlash(mode, saverUser, isDemo) {
		if (!isDemo && this.divineFlashCooldown > 0) return;
		if (!isDemo) this.divineFlashCooldown = 1800; // 30s
		this.clutchComboFrames = 0;
		this.clutchComboKills = 0;

		// Purge active sabotages
		this.timers.blackout = 0;
		this.timers.frenzy = 0;
		if (g_player && g_player.gun && g_player.gun.isJammed && typeof g_player.gun.unjamAndRefill === "function") {
			g_player.gun.unjamAndRefill(false);
		}

		// Grant player 2.5s golden invulnerability
		if (g_player) {
			g_player.invulnFrames = Math.max(g_player.invulnFrames || 0, 150);
			g_player.divineInvuln = true;
		}

		// Visual & audio nova
		if (typeof uiflashScreen === "function") uiflashScreen("#fbf236", 12);
		if (typeof fx_shakeScreen === "function") fx_shakeScreen(1.2);
		if (typeof soundDivineFlash !== "undefined") {
			soundDivineFlash.play(g_player ? g_player.pos : typeof cameraPos !== "undefined" ? cameraPos : vec2(0));
		}

		if (g_player) {
			this.shockwaves.push({
				pos: g_player.pos.copy(),
				radius: 0.4,
				maxRadius: 11.0,
				alpha: 1.0,
			});

			// Vaporize inner basic mobs (<= 3.5 tiles) and stun/blast outer mobs + Bosses for 3.0s (180 frames)
			if (typeof g_enemies !== "undefined") {
				let snapshot = g_enemies.slice();
				for (let i = 0; i < snapshot.length; i++) {
					let e = snapshot[i];
					if (!e || e.hp <= 0) continue;
					let toEnemy = e.pos.subtract(g_player.pos);
					let dist = toEnemy.length();
					let pushDir = dist > 0.01 ? toEnemy.normalize(0.35) : vec2(0, 0.35);

					if (typeof BossZombie !== "undefined" && e instanceof BossZombie) {
						let holyDmg = min(3, Math.max(0, e.hp - 1));
						if (holyDmg > 0 && typeof e.hit === "function") {
							e.hit(pushDir, e.pos, holyDmg);
						}
						e.stunFrames = 180;
						if (typeof e.applyForce === "function") e.applyForce(pushDir);
					} else if (dist <= 3.5) {
						if (typeof Ghost !== "undefined" && e instanceof Ghost) e.solid = true;
						if (typeof e.hit === "function") {
							e.hit(pushDir, e.pos, e.hp + 10);
						}
					} else {
						if (typeof Ghost !== "undefined" && e instanceof Ghost) {
							e.solid = true;
							if (e.color) e.color.a = 1;
							if (e._armColor) e._armColor.a = 1;
						}
						e.stunFrames = 180;
						if (typeof e.applyForce === "function") e.applyForce(pushDir);
					}
				}
			}
		}

		if (mode === "GUARDIAN" && saverUser) {
			let sTag = this.formatUserTag(saverUser);
			this.centerBanner = {
				text: "★ DIVINE FLASH! SAVED BY @" + sTag + " ★",
				subtext: "HOLY SHOCKWAVE — SABOTAGES PURGED & HORDE STUNNED!",
				color: colorSpark,
				frames: 180,
				maxFrames: 180,
			};
			this.addToast("⚡ DIVINE FLASH! Guardian Save by @" + sTag + "!", "good");
		} else {
			this.centerBanner = {
				text: "★ DIVINE FLASH! CLUTCH SURVIVAL! ★",
				subtext: "HOLY SHOCKWAVE — SABOTAGES PURGED & HORDE STUNNED!",
				color: colorSpark,
				frames: 180,
				maxFrames: 180,
			};
			this.addToast("⚡ DIVINE FLASH! Streamer Clutch Activated!", "good");
		}
	}

	triggerAmbientFrenzy() {
		this.timers.slow = 0;
		// 360 frames (6.0s duration) without double speed stacking (D-08, D-14)
		this.timers.frenzy = Math.min(480, (this.timers.frenzy || 0) + 360);
		this.ambientFrenzyTimer = rand(2700, 3600) | 0;
		this.ambientTelegraphFired = false;

		if (typeof soundWarHorn !== "undefined") soundWarHorn.play();
		uiflashScreen("#ac3232", 8);

		this.centerBanner = {
			text: "⚠️ BLOOD SURGE: The Horde has Enraged!",
			subtext: "ALL ENEMIES SPRINTING WITH ENHANCED FURY (6s)",
			color: colorBlood,
			frames: 180,
			maxFrames: 180,
		};
		this.addToast("⚠️ BLOOD SURGE: Horde Enraged (6.0s)!", "bad");
	}

	update() {
		// Ambient Frenzy countdown & gating (D-07..D-11, D-14)
		if (typeof g_state !== "undefined" && g_state === STATE_PLAYING && !g_isPaused && g_player && g_player.hp > 0) {
			let livingEnemies = typeof g_enemies !== "undefined" ? g_enemies.filter(e => e && e.hp > 0).length : 0;

			// Only countdown if frenzy is not currently active
			if (this.timers.frenzy <= 0) {
				if (this.ambientFrenzyTimer > 0) {
					this.ambientFrenzyTimer--;

					// 120-frame (2.0s) atmospheric rumble telegraph (D-11)
					if (this.ambientFrenzyTimer === 120 && !this.ambientTelegraphFired) {
						this.ambientTelegraphFired = true;
						if (typeof soundRumble !== "undefined") soundRumble.play();
					}
				} else if (livingEnemies > 0) {
					// Timer hit 0 and enemies are present: trigger surge! (D-08, D-12, D-13)
					this.triggerAmbientFrenzy();
				}
			}
		}

		// Smooth Karma Bar interpolation
		let total = this.goodActions + this.badActions;
		let targetPct = total === 0 ? 50 : Math.round((this.goodActions / total) * 100);
		this.displayedGoodPct += (targetPct - this.displayedGoodPct) * 0.12;

		// Decrement timers
		for (let t in this.timers) {
			if (this.timers[t] > 0) this.timers[t]--;
		}

		if (this.divineFlashCooldown > 0) {
			this.divineFlashCooldown--;
		}

		// Update toasts
		for (let i = 0; i < this.toasts.length; i++) {
			this.toasts[i].frames--;
		}
		this.toasts = this.toasts.filter(function (t) {
			return t.frames > 0;
		});

		// Update charge pills
		for (let a in this.chargePills) {
			if (this.chargePills[a].expireFrames > 0) {
				this.chargePills[a].expireFrames--;
			}
			if (this.chargePills[a].expireFrames <= 0) {
				delete this.chargePills[a];
			}
		}

		// Update world popups
		for (let i = 0; i < this.worldPopups.length; i++) {
			let wp = this.worldPopups[i];
			wp.life--;
			wp.pos.y += 0.012;
		}
		this.worldPopups = this.worldPopups.filter(function (wp) {
			return wp.life > 0;
		});

		// Update center banner
		if (this.centerBanner) {
			this.centerBanner.frames--;
			if (this.centerBanner.frames <= 0) {
				this.centerBanner = null;
			}
		}

		// Update footprints & frenzy sparks
		for (let i = 0; i < this.footprints.length; i++) {
			this.footprints[i].life--;
		}
		this.footprints = this.footprints.filter(function (f) {
			return f.life > 0;
		});

		for (let i = 0; i < this.frenzySparks.length; i++) {
			this.frenzySparks[i].life--;
		}
		this.frenzySparks = this.frenzySparks.filter(function (s) {
			return s.life > 0;
		});

		// Update shockwaves
		for (let i = 0; i < this.shockwaves.length; i++) {
			let sw = this.shockwaves[i];
			sw.radius += 0.35;
			sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
		}
		this.shockwaves = this.shockwaves.filter(function (sw) {
			return sw.radius < sw.maxRadius && sw.alpha > 0.01;
		});

		// Active barrier aura (D-06)
		if (this.timers.barrier > 0 && g_player) {
			pushers.push(new Pusher(g_player.pos.copy(), 0.06, 0.5, 2.8, 1 / 60, PushTo.ENEMIES));
			if (typeof g_enemies !== "undefined") {
				for (let i = 0; i < g_enemies.length; i++) {
					let e = g_enemies[i];
					if (!e || e.hp <= 0) continue;
					let diff = e.pos.subtract(g_player.pos);
					let dist = diff.length();
					if (dist < 2.8) {
						if (dist > 0.01) e.applyForce(diff.normalize(0.08));
						if (typeof Ghost !== "undefined" && e instanceof Ghost && !e.solid) {
							e.solid = true;
							if (e.color) e.color.a = 1;
							if (e._armColor) e._armColor.a = 1;
							e.transformCount = Math.max(e.transformCount || 0, 90);
						}
					}
				}
			}
			if (typeof engineObjects !== "undefined") {
				for (let i = 0; i < engineObjects.length; i++) {
					let o = engineObjects[i];
					if (typeof Boulder !== "undefined" && o instanceof Boulder && o.pos.distance(g_player.pos) < 2.8) {
						if (typeof o.collideWithTile === "function") o.collideWithTile();
					}
				}
			}
		}

		// Active repair door wards (D-02)
		if (this.timers.repairWards > 0 && this.doorWardPositions.length > 0) {
			for (let i = 0; i < this.doorWardPositions.length; i++) {
				let wPos = this.doorWardPositions[i];
				pushers.push(new Pusher(wPos.copy(), 0.05, 0.2, 1.35, 1 / 60, PushTo.ENEMIES));
				if (typeof g_enemies !== "undefined") {
					for (let j = 0; j < g_enemies.length; j++) {
						let e = g_enemies[j];
						if (e && e.hp > 0 && e.pos.distance(wPos) < 1.1) {
							let diff = e.pos.subtract(wPos);
							e.applyForce(diff.length() > 0.01 ? diff.normalize(0.06) : vec2(0, 0.06));
						}
					}
				}
			}
		}

		// Path A Sabotage Combo Evaluation (D-14)
		let activeSabotages = this.getActiveSabotageCount();
		if (activeSabotages >= 2 && this.divineFlashCooldown <= 0) {
			this.clutchComboFrames++;
			if (this.clutchComboFrames >= 360 || this.clutchComboKills >= 3) {
				this.triggerDivineFlash("SURVIVAL", null, false);
			}
		} else if (activeSabotages < 2) {
			this.clutchComboFrames = Math.max(0, this.clutchComboFrames - 2);
			this.clutchComboKills = 0;
		}
	}

	onEnemyKilled(enemy) {
		if (!enemy) return;
		if (this.getActiveSabotageCount() >= 2) {
			this.clutchComboKills++;
		}
		if (enemy.isAudienceBoss) {
			let bTag = this.formatUserTag(enemy.twitchUser || "Chat");
			this.centerBanner = {
				text: "★ PLAYER ELIMINATED @" + bTag + "'S BOSS! (+5) ★",
				subtext: "FREE AMMO CARE PACKAGE DROPPED!",
				color: colorSpark,
				frames: 150,
				maxFrames: 150,
			};
			this.addToast("★ Player eliminated @" + bTag + "'s Boss! (+5)", "good");
		} else if (enemy.twitchUser) {
			let mTag = this.formatUserTag(enemy.twitchUser);
			this.addWorldPopup("KILLED @" + mTag + "!", enemy.pos.add(vec2(0, 0.5)), colorSpark);
		}
	}

	onAmmoPickedUp(box) {
		if (box && box.twitchUser) {
			let aTag = this.formatUserTag(box.twitchUser);
			this.addWorldPopup("+AMMO (THANKS @" + aTag + "!)", box.pos.add(vec2(0, 0.5)), colorZombie);
		}
	}

	onPlayerDied(killerInfo) {
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		let awardedUsers = {};

		// 1. Fatal Saboteur Strike (+5 pts within 180 frames / 3.0s, D-22)
		for (let i = 0; i < this.recentBadActions.length; i++) {
			let badAct = this.recentBadActions[i];
			if (curFrame - badAct.frame <= 180 && !awardedUsers[badAct.user]) {
				awardedUsers[badAct.user] = true;
				let bTargets = [this.levelStats.contributors.bad, this.runStats.contributors.bad];
				for (let s = 0; s < bTargets.length; s++) {
					let bMap = bTargets[s];
					if (bMap[badAct.user]) {
						bMap[badAct.user].score += 5;
						bMap[badAct.user].fatalStrike = true;
					}
				}
			}
		}

		// 2. Fatal strike blow by viewer's mob (+5 pts, D-22)
		if (killerInfo && killerInfo.twitchUser) {
			let kUser = String(killerInfo.twitchUser).trim().replace(/^@+/, "");
			if (kUser && !awardedUsers[kUser]) {
				awardedUsers[kUser] = true;
				let bTargets = [this.levelStats.contributors.bad, this.runStats.contributors.bad];
				for (let s = 0; s < bTargets.length; s++) {
					let bMap = bTargets[s];
					if (!bMap[kUser]) {
						bMap[kUser] = {
							user: kUser,
							score: 0,
							actions: 0,
							actionCounts: {},
							firstActionTime: Date.now(),
							clutchSave: false,
							fatalStrike: false,
						};
					}
					bMap[kUser].score += 5;
					bMap[kUser].fatalStrike = true;
				}
			}
		}
	}

	deriveTitle(userEntry, team) {
		if (!userEntry) return team === "good" ? "GUARDIAN ANGEL" : "PUBLIC ENEMY";

		if (team === "good") {
			if (userEntry.clutchSave) return "LIFE SAVER";
			let highestAction = "";
			let highestCount = 0;
			if (userEntry.actionCounts) {
				for (let a in userEntry.actionCounts) {
					if (userEntry.actionCounts[a] > highestCount) {
						highestCount = userEntry.actionCounts[a];
						highestAction = a;
					}
				}
			}
			if (highestAction === "barrier") return "SHIELD BEARER";
			if (highestAction === "repair") return "HOLY MECHANIC";
			if (highestAction === "light") return "ILLUMINATOR";
			if (highestAction === "slow") return "FROST WARDEN";
			if (highestAction === "ammo") return "SUPPLY ANGEL";
			return "GUARDIAN ANGEL";
		} else {
			if (userEntry.fatalStrike) return "FATAL SABOTEUR";
			let highestAction = "";
			let highestCount = 0;
			if (userEntry.actionCounts) {
				for (let a in userEntry.actionCounts) {
					if (userEntry.actionCounts[a] > highestCount) {
						highestCount = userEntry.actionCounts[a];
						highestAction = a;
					}
				}
			}
			if (highestAction === "boss") return "DOOM LORD";
			if (highestAction === "frenzy") return "BLOOD CALLER";
			if (highestAction === "jam") return "WEAPON GREMLIN";
			if (highestAction === "blackout") return "SHADOW BRINGER";
			if (highestAction === "mob") return "HORDE MASTER";
			return "PUBLIC ENEMY";
		}
	}

	getPodiumStandings(contributorsMap, team) {
		if (!contributorsMap) return { mvp: null, runnersUp: [] };
		let list = Object.values(contributorsMap);
		if (list.length === 0) return { mvp: null, runnersUp: [] };

		// Sort by score descending; chronological first-to-reach tie-breaker (D-23)
		var self = this;
		list.sort(function (a, b) {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return (a.firstActionTime || 0) - (b.firstActionTime || 0);
		});

		let top = list[0];
		let mvp = {
			user: top.user,
			score: top.score,
			actions: top.actions,
			title: this.deriveTitle(top, team),
			clutchSave: Boolean(top.clutchSave),
			fatalStrike: Boolean(top.fatalStrike),
		};

		let runnersUp = list.slice(1, 3).map(function (c) {
			return {
				user: c.user,
				score: c.score,
				actions: c.actions,
				title: self.deriveTitle(c, team),
			};
		});

		return { mvp: mvp, runnersUp: runnersUp };
	}

	getMvpAndTraitor() {
		return {
			goodPodium: this.getPodiumStandings(this.levelStats.contributors.good, "good"),
			badPodium: this.getPodiumStandings(this.levelStats.contributors.bad, "bad"),
		};
	}

	loadAllTimeRecords() {
		let records = {
			mvp: null,
			traitor: null,
			goodWins: 0,
			badWins: 0,
		};
		try {
			if (typeof localStorage !== "undefined") {
				let mvpRaw = localStorage.getItem("da_apg_mvp");
				if (mvpRaw) records.mvp = JSON.parse(mvpRaw);
				let traitorRaw = localStorage.getItem("da_apg_traitor");
				if (traitorRaw) records.traitor = JSON.parse(traitorRaw);
				records.goodWins = parseInt(localStorage.getItem("da_apg_good_wins") || "0", 10) || 0;
				records.badWins = parseInt(localStorage.getItem("da_apg_bad_wins") || "0", 10) || 0;
			}
		} catch (e) {
			// LocalStorage unavailable in sandbox or private mode
		}
		return records;
	}

	updateAllTimeRecords(winner, goodPodium, badPodium, level) {
		if (winner === "good") {
			this.allTimeRecords.goodWins++;
		} else if (winner === "bad") {
			this.allTimeRecords.badWins++;
		}

		if (goodPodium && goodPodium.mvp && (!this.allTimeRecords.mvp || goodPodium.mvp.score > this.allTimeRecords.mvp.score)) {
			this.allTimeRecords.mvp = {
				user: goodPodium.mvp.user,
				score: goodPodium.mvp.score,
				title: goodPodium.mvp.title,
				level: level,
				timestamp: Date.now(),
			};
		}

		if (badPodium && badPodium.mvp && (!this.allTimeRecords.traitor || badPodium.mvp.score > this.allTimeRecords.traitor.score)) {
			this.allTimeRecords.traitor = {
				user: badPodium.mvp.user,
				score: badPodium.mvp.score,
				title: badPodium.mvp.title,
				level: level,
				timestamp: Date.now(),
			};
		}

		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("da_apg_good_wins", String(this.allTimeRecords.goodWins));
				localStorage.setItem("da_apg_bad_wins", String(this.allTimeRecords.badWins));
				if (this.allTimeRecords.mvp) {
					localStorage.setItem("da_apg_mvp", JSON.stringify(this.allTimeRecords.mvp));
				}
				if (this.allTimeRecords.traitor) {
					localStorage.setItem("da_apg_traitor", JSON.stringify(this.allTimeRecords.traitor));
				}
			}
		} catch (e) {
			// Suppress error safely
		}
	}

	onMatchOrLevelEnd(newState) {
		let total = this.goodActions + this.badActions;
		let finalGoodPct = total === 0 ? 50 : Math.round((this.goodActions / total) * 100);
		let finalBadPct = 100 - finalGoodPct;
		let targetGoodPct =
			typeof g_apgNetwork !== "undefined" &&
			g_apgNetwork &&
			g_apgNetwork.lockedPrediction &&
			typeof g_apgNetwork.lockedPrediction.goodPct === "number"
				? g_apgNetwork.lockedPrediction.goodPct
				: 50;

		let winner = "refund";
		let reason = "pacifist_zero_actions";

		if (total === 0) {
			winner = "refund";
			reason = "pacifist_zero_actions";
		} else if (newState === STATE_DEAD) {
			if (total < 3) {
				winner = "refund";
				reason = "threshold_early_death";
			} else {
				winner = "bad";
				reason = "streamer_eliminated";
			}
		} else if (newState === STATE_CLEARED) {
			if (finalGoodPct > targetGoodPct) {
				winner = "good";
				reason = "survived_beat_target";
			} else if (finalGoodPct < targetGoodPct) {
				winner = "bad";
				reason = "survived_under_target";
			} else {
				winner = "refund";
				reason = "exact_ratio_tie";
			}
		}

		let curLevel = typeof g_level !== "undefined" ? g_level : 0;
		let isGrandVictory = Boolean(newState === STATE_CLEARED && curLevel >= 4);

		if (newState === STATE_CLEARED) {
			this.runStats.levelsCleared++;
		}

		let goodPodium = this.getPodiumStandings(this.levelStats.contributors.good, "good");
		let badPodium = this.getPodiumStandings(this.levelStats.contributors.bad, "bad");
		let runGoodPodium = this.getPodiumStandings(this.runStats.contributors.good, "good");
		let runBadPodium = this.getPodiumStandings(this.runStats.contributors.bad, "bad");

		let causeOfDeath = "";
		if (newState === STATE_DEAD && typeof g_player !== "undefined" && g_player && g_player.killer) {
			let k = g_player.killer;
			if (k.isAudienceBoss) {
				causeOfDeath = "KILLED BY @" + this.formatUserTag(k.twitchUser || "Chat") + "'S BOSS ZOMBIE";
			} else if (k.twitchUser) {
				causeOfDeath = "KILLED BY @" + this.formatUserTag(k.twitchUser) + "'S ENRAGED MOB";
			} else {
				causeOfDeath = "SLAIN BY " + (k.type || "ZOMBIE").toUpperCase();
			}
		}

		this.updateAllTimeRecords(winner, goodPodium, badPodium, curLevel + 1);

		this.matchSummary = {
			state: newState,
			level: curLevel + 1,
			winner: winner,
			reason: reason,
			isGrandVictory: isGrandVictory,
			goodActions: this.goodActions,
			badActions: this.badActions,
			totalActions: total,
			finalGoodPct: finalGoodPct,
			finalBadPct: finalBadPct,
			goodPct: finalGoodPct,
			badPct: finalBadPct,
			targetGoodPct: targetGoodPct,
			goodPodium: goodPodium,
			badPodium: badPodium,
			runGoodPodium: runGoodPodium,
			runBadPodium: runBadPodium,
			mvpGood: goodPodium.mvp,
			mvpBad: badPodium.mvp,
			causeOfDeath: causeOfDeath,
			allTimeRecords: this.allTimeRecords,
			contributorStats: JSON.parse(JSON.stringify(this.levelStats.contributors)),
			timestamp: Date.now(),
		};

		if (typeof g_apgNetwork !== "undefined" && g_apgNetwork && typeof g_apgNetwork.sendMatchOutcome === "function") {
			g_apgNetwork.sendMatchOutcome(this.matchSummary);
		}

		this.clearActiveEffects();
		if (typeof g_shadows !== "undefined") g_shadows = {};
	}

	renderWorldPre() {
		// Ground-level world FX rendered before entities on mainCanvas

		// 1. Golden footprints from !light
		for (let i = 0; i < this.footprints.length; i++) {
			let fp = this.footprints[i];
			let alpha = Math.max(0, fp.life / 60);
			drawRect(fp.pos, vec2(1 / 12), new Color(251 / 255, 242 / 255, 54 / 255, alpha));
		}

		// 2. Red sparks from !frenzy
		for (let i = 0; i < this.frenzySparks.length; i++) {
			let sp = this.frenzySparks[i];
			let alpha = Math.max(0, sp.life / 40);
			drawRect(sp.pos, vec2(1 / 12), new Color(172 / 255, 50 / 255, 50 / 255, alpha));
		}

		// 3. Shimmering dashed Door Wards from !repair (D-02)
		if (this.timers.repairWards > 0 && this.doorWardPositions.length > 0) {
			let alpha = 0.6 + 0.35 * Math.sin(frame / 6);
			let wardCol = new Color(55 / 255, 148 / 255, 110 / 255, alpha);
			let sparkCol = new Color(251 / 255, 242 / 255, 54 / 255, alpha * 0.85);
			for (let i = 0; i < this.doorWardPositions.length; i++) {
				let wp = this.doorWardPositions[i];
				drawRect(wp, vec2(11 / 12, 1.8 / 12), wardCol);
				let dShift = Math.sin(frame / 8 + i) * 0.25;
				drawRect(wp.add(vec2(dShift, 0)), vec2(3 / 12, 3.5 / 12), sparkCol);
				drawRect(wp.add(vec2(-dShift, 0)), vec2(2 / 12, 2.5 / 12), sparkCol);
			}
		}

		// 4. Care Package Beacon Rings on floor (D-01, D-22)
		if (typeof engineObjects !== "undefined") {
			for (let i = 0; i < engineObjects.length; i++) {
				let obj = engineObjects[i];
				if (typeof AmmoBox !== "undefined" && obj instanceof AmmoBox && obj.twitchUser) {
					let curFrame = typeof frame !== "undefined" ? frame : 0;
					let elapsed = curFrame - (obj.spawnFrame || 0);
					if (1800 - elapsed <= 300 && Math.floor(curFrame / 4) % 2 === 0) {
						continue;
					}
					let p = 0.55 + 0.4 * Math.sin((frame - (obj.spawnFrame || 0)) / 6);
					let ringRad = 0.55 + 0.08 * Math.sin((frame - (obj.spawnFrame || 0)) / 10);
					let rot = (frame - (obj.spawnFrame || 0)) * 0.04;
					let ringCol = (frame % 30 < 15 ? colorSpark : colorZombie).scale(p);
					for (let k = 0; k < 4; k++) {
						let ang = rot + (k * PI) / 2;
						let pt = obj.pos.add(vec2(Math.cos(ang) * ringRad, Math.sin(ang) * ringRad));
						drawRect(pt, vec2(2.5 / 12), ringCol, ang);
					}
					drawRect(obj.pos, vec2(1.5 / 12), ringCol);
				}
			}
		}

		// 5. Portal Spawn Pentagram / Summoning Rings (D-07, D-08)
		if (typeof g_enemies !== "undefined") {
			for (let i = 0; i < g_enemies.length; i++) {
				let e = g_enemies[i];
				if (e && e.spawnTelegraphFrames > 0) {
					let rot = -frame * 0.06;
					let rad = e.isAudienceBoss ? 1.4 : 0.85;
					let teleCol = e.isAudienceBoss ? colorSpark : colorBlood;
					let pulse = 0.6 + 0.4 * Math.sin(frame / 4);
					teleCol = teleCol.scale(pulse);
					for (let k = 0; k < 8; k++) {
						let ang = rot + (k * PI) / 4;
						let pt = e.pos.add(vec2(Math.cos(ang) * rad, Math.sin(ang) * rad));
						drawRect(pt, vec2(2.5 / 12), teleCol, ang);
					}
					for (let k = 0; k < 4; k++) {
						let ang = -rot + (k * PI) / 2;
						let pt = e.pos.add(vec2(Math.cos(ang) * (rad * 0.5), Math.sin(ang) * (rad * 0.5)));
						drawRect(pt, vec2(2 / 12), teleCol, ang);
					}
				}
			}
		}

		// 6. Dual-layer counter-rotating octagonal rune barrier from !barrier (D-06)
		if (this.timers.barrier > 0 && g_player) {
			let isFlashing = this.timers.barrier <= 90 && frame % 6 < 3;
			let col1 = isFlashing ? colorWhite : colorSpark;
			let col2 = isFlashing ? colorSpark : colorZombie;
			let rad = 2.7;
			let rot1 = frame * 0.025;
			let rot2 = -frame * 0.035;

			// Outer 8-segment octagonal ring
			for (let k = 0; k < 8; k++) {
				let a1 = rot1 + (k * PI) / 4;
				let a2 = rot1 + ((k + 1) * PI) / 4;
				let p1 = g_player.pos.add(vec2(Math.cos(a1) * rad, Math.sin(a1) * rad));
				let p2 = g_player.pos.add(vec2(Math.cos(a2) * rad, Math.sin(a2) * rad));
				let mid = p1.add(p2).scale(0.5);
				let segLen = p1.distance(p2);
				let segAng = p2.subtract(p1).angle();

				drawRect(mid, vec2(segLen, 1.4 / 12), col2, segAng);
				drawRect(p1, vec2(2.5 / 12), col1, a1);
			}

			// Inner counter-rotating ring nodes
			for (let k = 0; k < 8; k++) {
				let a = rot2 + (k * PI) / 4;
				let p = g_player.pos.add(vec2(Math.cos(a) * (rad * 0.88), Math.sin(a) * (rad * 0.88)));
				drawRect(p, vec2(2 / 12), col1, a);
			}
		}

		// 7. Divine Flash expanding golden shockwave rings with trailing motes (D-15)
		for (let i = 0; i < this.shockwaves.length; i++) {
			let sw = this.shockwaves[i];
			let swCol = new Color(251 / 255, 242 / 255, 54 / 255, sw.alpha);
			let whiteCol = new Color(1, 1, 1, sw.alpha * 0.8);
			for (let s = 0; s < 24; s++) {
				let ang = (s * PI * 2) / 24;
				let p = sw.pos.add(vec2(Math.cos(ang) * sw.radius, Math.sin(ang) * sw.radius));
				drawRect(p, vec2(3 / 12, 3 / 12), s % 2 === 0 ? swCol : whiteCol, ang);
				if (sw.radius > 1.2) {
					let trailP = sw.pos.add(vec2(Math.cos(ang) * (sw.radius - 0.6), Math.sin(ang) * (sw.radius - 0.6)));
					drawRect(trailP, vec2(1.5 / 12), swCol);
				}
			}
		}
	}

	renderWorldLabels(W, H, u) {
		if (typeof g_state === "undefined" || g_state !== STATE_PLAYING || !g_player) return;

		// 1. Care Package Beacon Labels (@User's Ammo - always visible through FOW and !blackout per D-22, NAME-03)
		if (typeof engineObjects !== "undefined") {
			for (let i = 0; i < engineObjects.length; i++) {
				let obj = engineObjects[i];
				if (typeof AmmoBox !== "undefined" && obj instanceof AmmoBox && obj.twitchUser) {
					let curFrame = typeof frame !== "undefined" ? frame : 0;
					let elapsed = curFrame - (obj.spawnFrame || 0);
					if (1800 - elapsed <= 300 && Math.floor(curFrame / 4) % 2 === 0) {
						continue;
					}
					let bobOffset = 0.68 + 0.09 * Math.sin((frame - (obj.spawnFrame || 0)) / 8);
					let screenPos = worldToScreen(obj.pos.add(vec2(0, bobOffset)));
					if (screenPos.x >= 20 && screenPos.x <= W - 20 && screenPos.y >= 20 && screenPos.y <= H - 20) {
						let label = "@" + this.formatUserTag(obj.twitchUser) + "'s Ammo";
						let pillW = label.length * (u * 0.44) + 12;
						let pillH = u * 0.88;
						uiDrawRectScreen(screenPos, vec2(pillW, pillH), new Color(0, 0, 0, 0.72));
						let labelCol = frame % 30 < 15 ? colorSpark : colorZombie;
						drawTextWithOutline(label, screenPos, u * 0.72, labelCol, 2, colorBlack);
					}
				}
			}
		}

		// 2. LoS-Aware Enemy @User and [Boss] @User Tags + Boss HP Bar (NAME-01, D-22)
		if (typeof g_enemies !== "undefined") {
			let labeledEnemies = [];
			for (let i = 0; i < g_enemies.length; i++) {
				let e = g_enemies[i];
				if (e && (e.twitchUser || e.isAudienceBoss) && e.hp > 0 && this.isPosVisibleToPlayer(e.pos)) {
					labeledEnemies.push(e);
				}
			}

			for (let i = 0; i < labeledEnemies.length; i++) {
				let e = labeledEnemies[i];
				let yOffset = e.isAudienceBoss ? 1.18 : 0.7;
				for (let j = 0; j < i; j++) {
					if (e.pos.distance(labeledEnemies[j].pos) < 1.0) {
						yOffset += 0.34;
					}
				}
				let screenPos = worldToScreen(e.pos.add(vec2(0, yOffset)));
				if (screenPos.x < 15 || screenPos.x > W - 15 || screenPos.y < 15 || screenPos.y > H - 15) continue;

				let tag = this.formatUserTag(e.twitchUser || "Chat");
				if (e.isAudienceBoss) {
					// Compact Boss HP Bar
					let barW = u * 3.6;
					let barH = Math.max(5, u * 0.34);
					let hpRatio = clamp(e.hp / (e.maxHp || 16), 0, 1);
					let barPos = vec2(screenPos.x, screenPos.y + u * 0.62);
					uiDrawRectScreen(barPos, vec2(barW + 2, barH + 2), colorBlack);
					uiDrawRectScreen(barPos, vec2(barW, barH), new Color(0.2, 0.2, 0.2, 0.85));
					if (hpRatio > 0) {
						uiDrawRectScreen(
							vec2(barPos.x - (barW * (1 - hpRatio)) / 2, barPos.y),
							vec2(barW * hpRatio, barH),
							colorBlood
						);
					}
					let bossLabel = "[Boss] @" + tag;
					let pillW = bossLabel.length * (u * 0.5) + 12;
					uiDrawRectScreen(screenPos, vec2(pillW, u * 0.95), new Color(0, 0, 0, 0.75));
					drawTextWithOutline(bossLabel, screenPos, u * 0.82, colorSpark, 2, colorBlack);
				} else {
					let mobLabel = "@" + tag;
					let pillW = mobLabel.length * (u * 0.44) + 10;
					uiDrawRectScreen(screenPos, vec2(pillW, u * 0.82), new Color(0, 0, 0, 0.7));
					let col = this.timers.slow > 0 ? colorRifleRound : colorBlood;
					drawTextWithOutline(mobLabel, screenPos, u * 0.7, col, 2, colorBlack);
				}
			}
		}

		// 3. Floating World Combat Popups (D-23)
		this.renderWorldPopups(W, H, u);
	}

	renderWorldPopups(W, H, u) {
		for (let i = 0; i < this.worldPopups.length; i++) {
			let wp = this.worldPopups[i];
			let sPos = worldToScreen(wp.pos);
			if (sPos.x < 10 || sPos.x > W - 10 || sPos.y < 10 || sPos.y > H - 10) continue;
			let alpha = clamp(wp.life / (wp.maxLife * 0.3), 0, 1);
			let col = wp.color ? new Color(wp.color.r, wp.color.g, wp.color.b, alpha) : colorWhite;
			drawTextWithOutline(wp.text, sPos, u * 0.78, col, 2, colorBlack);
		}
	}

	renderKarmaMeter(W, H, cx, u, alpha = 1.0) {
		let total = this.goodActions + this.badActions;
		let liveGoodPct = total === 0 ? 50 : Math.round((this.goodActions / total) * 100);
		let liveBadPct = 100 - liveGoodPct;
		let dispGood = clamp(this.displayedGoodPct, 0, 100);
		let dispBad = 100 - dispGood;
		let targetGoodPct =
			typeof g_apgNetwork !== "undefined" &&
			g_apgNetwork.lockedPrediction &&
			typeof g_apgNetwork.lockedPrediction.goodPct === "number"
				? g_apgNetwork.lockedPrediction.goodPct
				: 50;

		let meterAlpha = typeof alpha === "number" ? alpha : 1.0;
		let barY = Math.round(H - Math.max(24, u * 1.5));
		let barW = Math.min(W * 0.42, u * 21);
		let barH = Math.max(16, u * 1.15);
		let barLeft = cx - barW / 2;
		let barRight = cx + barW / 2;

		// Outer frame & background track
		uiDrawRectScreen(vec2(cx, barY), vec2(barW + 4, barH + 4), colorWhite.scale(0.35 * meterAlpha));
		uiDrawRectScreen(vec2(cx, barY), vec2(barW, barH), new Color(0, 0, 0, 0.85 * meterAlpha));

		// Good (Left) and Bad (Right) fills
		let goodW = barW * (dispGood / 100);
		let badW = barW * (dispBad / 100);
		if (goodW > 0) {
			uiDrawRectScreen(vec2(barLeft + goodW / 2, barY), vec2(goodW, barH), colorZombie.scale(meterAlpha));
		}
		if (badW > 0) {
			uiDrawRectScreen(vec2(barRight - badW / 2, barY), vec2(badW, barH), colorBlood.scale(meterAlpha));
		}
		uiDrawRectScreen(vec2(cx, barY), vec2(1, barH), new Color(0, 0, 0, meterAlpha));

		// Frame ends with mini pixel portraits from t.png
		let portraitSize = vec2(Math.max(18, u * 1.55));
		uiDrawTileScreen(vec2(barLeft - u * 1.15, barY), portraitSize, tileNumbers_facePlayer, colorWhite.scale(meterAlpha), false);
		let badFaceTile =
			typeof g_level !== "undefined" && g_level % 5 === 2 ? tileNumbers_faceVampire : tileNumbers_faceZombie;
		uiDrawTileScreen(vec2(barRight + u * 1.15, barY), portraitSize, badFaceTile, colorWhite.scale(meterAlpha), true);

		// Golden Locked-Prediction Target Pin (D-20)
		let pinX = barLeft + barW * (clamp(targetGoodPct, 0, 100) / 100);
		uiDrawRectScreen(vec2(pinX, barY), vec2(3, barH + 8), colorSpark.scale(meterAlpha));
		uiDrawRectScreen(vec2(pinX, barY - barH * 0.55), vec2(7, 3), colorSpark.scale(meterAlpha));

		// Inner text
		let leftLabel = "GOOD " + liveGoodPct + "% (" + this.goodActions + ")";
		let rightLabel = "(" + this.badActions + ") " + liveBadPct + "% BAD";
		drawTextWithOutline(leftLabel, vec2(barLeft + barW * 0.25, barY), u * 0.62, colorWhite.scale(meterAlpha), 2, new Color(0, 0, 0, meterAlpha));
		drawTextWithOutline(rightLabel, vec2(barRight - barW * 0.25, barY), u * 0.62, colorWhite.scale(meterAlpha), 2, new Color(0, 0, 0, meterAlpha));

		// Target & Lead status line (D-16, D-20) - stacked directly above bar
		let statusY = barY - Math.max(16, u * 1.05);
		let goodLeading = liveGoodPct >= targetGoodPct;
		let statusText = "TARGET: " + targetGoodPct + "% GOOD  |  " + (goodLeading ? "▲ GOOD LEADING" : "▼ BAD LEADING");
		let statusCol = goodLeading ? colorZombie : colorBlood;
		drawTextWithOutline(statusText, vec2(cx, statusY), u * 0.66, statusCol.scale(meterAlpha), 2, new Color(0, 0, 0, meterAlpha));
	}

	renderActiveTimerPills(W, H, cx, u, alpha = 1.0) {
		let pills = [];
		if (this.timers.light > 0) {
			pills.push({ text: "★ LIGHT " + (this.timers.light / 60).toFixed(1) + "s", col: colorSpark });
		}
		if (this.timers.barrier > 0) {
			pills.push({ text: "✦ BARRIER " + (this.timers.barrier / 60).toFixed(1) + "s", col: colorZombie });
		}
		if (this.timers.slow > 0) {
			pills.push({ text: "❄ SLOW " + (this.timers.slow / 60).toFixed(1) + "s", col: colorRifleRound });
		}
		if (this.timers.repairWards > 0) {
			pills.push({ text: "🛡 WARDS " + (this.timers.repairWards / 60).toFixed(1) + "s", col: colorZombie });
		}
		if (this.timers.blackout > 0) {
			pills.push({ text: "☠ BLACKOUT " + (this.timers.blackout / 60).toFixed(1) + "s", col: colorBlood });
		}
		if (this.timers.frenzy > 0) {
			pills.push({ text: "🔥 FRENZY " + (this.timers.frenzy / 60).toFixed(1) + "s", col: colorBlood });
		}
		if (g_player && g_player.gun && g_player.gun.isJammed) {
			pills.push({ text: "⚠ JAMMED", col: colorBlood });
		}

		let pillAlpha = typeof alpha === "number" ? alpha : 1.0;
		let barY = Math.round(H - Math.max(24, u * 1.5));
		let statusY = barY - Math.max(16, u * 1.05);
		let py = statusY - Math.max(18, u * 1.15); // Stacked above status line (~H - 58px)
		let clutchY = pills.length > 0 ? py - Math.max(16, u * 1.05) : statusY - Math.max(16, u * 1.05);

		if (pills.length > 0) {
			let pillWidths = [];
			let totalW = 0;
			let spacing = 8;
			for (let i = 0; i < pills.length; i++) {
				let pw = pills[i].text.length * (u * 0.42) + 14;
				pillWidths.push(pw);
				totalW += pw + (i > 0 ? spacing : 0);
			}

			let startX = cx - totalW / 2;
			let currX = startX;
			for (let i = 0; i < pills.length; i++) {
				let pw = pillWidths[i];
				let px = currX + pw / 2;
				uiDrawRectScreen(vec2(px, py), vec2(pw, u * 0.82), new Color(0, 0, 0, 0.78 * pillAlpha));
				drawTextWithOutline(pills[i].text, vec2(px, py), u * 0.6, pills[i].col.scale(pillAlpha), 2, new Color(0, 0, 0, pillAlpha));
				currX += pw + spacing;
			}
		}

		// Clutch combo charging bar (D-14, D-21)
		if (this.getActiveSabotageCount() >= 2 && this.divineFlashCooldown <= 0) {
			let clutchPct = Math.min(
				100,
				Math.round(Math.max(this.clutchComboFrames / 360, this.clutchComboKills / 3) * 100)
			);
			let clutchBarW = Math.min(W * 0.38, u * 18);
			let clutchBarH = Math.max(12, u * 0.85);

			uiDrawRectScreen(vec2(cx, clutchY), vec2(clutchBarW + 2, clutchBarH + 2), colorSpark.scale(pillAlpha));
			uiDrawRectScreen(vec2(cx, clutchY), vec2(clutchBarW, clutchBarH), new Color(0.1, 0.05, 0, 0.88 * pillAlpha));

			let fillW = clutchBarW * (clutchPct / 100);
			if (fillW > 0) {
				uiDrawRectScreen(vec2(cx - clutchBarW / 2 + fillW / 2, clutchY), vec2(fillW, clutchBarH), colorSpark.scale(pillAlpha));
			}
			let clutchText = "⚡ CLUTCH CHARGING: " + clutchPct + "%";
			drawTextWithOutline(clutchText, vec2(cx, clutchY), u * 0.62, colorWhite.scale(pillAlpha), 2, new Color(0, 0, 0, pillAlpha));
		}
	}

	renderToastsAndCharges(W, H, u) {
		let startX = 14;
		// Position below the top-left player equipment HUD in the left-middle margin (HUD-01)
		let currY = Math.max(H * 0.38, u * 6.8);

		// 1. Up to 3 active toasts (D-21)
		for (let i = 0; i < Math.min(3, this.toasts.length); i++) {
			let t = this.toasts[i];
			let alpha = 1.0;
			let offsetX = 0;
			if (t.frames > 225) {
				let tIn = (240 - t.frames) / 15;
				offsetX = (1 - tIn) * -150;
			} else if (t.frames < 40) {
				alpha = t.frames / 40;
			}

			let pillW = t.text.length * (u * 0.42) + 18;
			let pillH = u * 0.92;
			let pillPos = vec2(startX + pillW / 2 + offsetX, currY);

			uiDrawRectScreen(pillPos, vec2(pillW, pillH), new Color(0, 0, 0, 0.78 * alpha));
			let accentCol = t.team === "good" ? colorZombie : colorBlood;
			uiDrawRectScreen(vec2(startX + 2 + offsetX, currY), vec2(4, pillH), accentCol.scale(alpha));

			drawTextScreen(
				t.text,
				vec2(startX + 10 + offsetX, currY),
				u * 0.62,
				accentCol.scale(alpha),
				2,
				colorBlack,
				"left"
			);
			currY += pillH + 6;
		}

		// 2. Active community charge progress pills (D-21)
		let chargeKeys = Object.keys(this.chargePills);
		for (let i = 0; i < Math.min(3, chargeKeys.length); i++) {
			let cp = this.chargePills[chargeKeys[i]];
			if (!cp) continue;
			let pillText =
				"⚡ Charging !" + cp.action + " [" + cp.current + "/" + cp.required + "]" + (cp.user ? " (@" + cp.user + ")" : "");
			let pillW = pillText.length * (u * 0.42) + 16;
			let pillH = u * 0.88;
			let pillPos = vec2(startX + pillW / 2, currY);

			uiDrawRectScreen(pillPos, vec2(pillW, pillH), new Color(0, 0, 0, 0.78));
			let ratio = clamp(cp.current / cp.required, 0, 1);
			if (ratio > 0) {
				uiDrawRectScreen(
					vec2(startX + (pillW * ratio) / 2, currY + pillH * 0.38),
					vec2(pillW * ratio, 3),
					cp.team === "bad" ? colorBlood : colorZombie
				);
			}
			drawTextScreen(pillText, vec2(startX + 8, currY), u * 0.58, colorWhite, 2, colorBlack, "left");
			currY += pillH + 6;
		}
	}

	renderCenterBanner(W, H, cx, u) {
		if (!this.centerBanner || this.centerBanner.frames <= 0) return;

		let bannerW = Math.min(W * 0.75, u * 30);
		let bannerH = u * 2.6;
		let bannerPos = vec2(cx, H * 0.22);
		let bPulse = 1 + 0.05 * Math.sin(frame / 4);

		uiDrawRectScreen(bannerPos, vec2(bannerW + 6, bannerH + 6), colorSpark);
		uiDrawRectScreen(bannerPos, vec2(bannerW, bannerH), new Color(0.12, 0.02, 0.02, 0.92));

		drawTextWithOutline(this.centerBanner.text, vec2(cx, H * 0.2), u * 1.05 * bPulse, colorSpark, 2, colorBlack);
		if (this.centerBanner.subtext) {
			drawTextWithOutline(this.centerBanner.subtext, vec2(cx, H * 0.25), u * 0.64, colorWhite, 2, colorBlack);
		}
	}

	renderAmbientTelegraphVignette(W, H, cx) {
		if (this.ambientFrenzyTimer <= 120 && this.ambientFrenzyTimer > 0 && typeof overlayContext !== "undefined") {
			let t = 1 - this.ambientFrenzyTimer / 120;
			let pulse = 0.25 + 0.1 * Math.sin(frame * 0.15);
			let vignetteAlpha = t * pulse;
			let cy = H / 2;
			let grad = overlayContext.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.72);
			grad.addColorStop(0, "rgba(180, 0, 0, 0)");
			grad.addColorStop(1, "rgba(180, 0, 0, " + vignetteAlpha.toFixed(3) + ")");
			overlayContext.fillStyle = grad;
			overlayContext.fillRect(0, 0, W, H);
		}
	}

	renderHUD() {
		if (typeof g_state === "undefined" || g_state !== STATE_PLAYING) return;
		const W =
			typeof mainCanvasSize !== "undefined"
				? mainCanvasSize.x
				: typeof overlayCanvas !== "undefined"
				? overlayCanvas.width
				: 800;
		const H =
			typeof mainCanvasSize !== "undefined"
				? mainCanvasSize.y
				: typeof overlayCanvas !== "undefined"
				? overlayCanvas.height
				: 600;
		const cx = W / 2;
		const u = Math.max(11, Math.min(W, H) / 42);

		let targetAlpha = 1.0;
		if (typeof g_player !== "undefined" && g_player && g_player.hp > 0) {
			let playerScreen = worldToScreen(g_player.pos);
			let dist = playerScreen.distance(vec2(cx, H - 35));
			if (dist < 110) {
				targetAlpha = 0.35 + 0.65 * clamp(dist / 110, 0, 1);
			}
		}
		this.bottomHudAlpha = this.bottomHudAlpha !== undefined ? this.bottomHudAlpha : 1.0;
		this.bottomHudAlpha += (targetAlpha - this.bottomHudAlpha) * 0.15;
		let alpha = this.bottomHudAlpha;

		this.renderWorldLabels(W, H, u);
		this.renderKarmaMeter(W, H, cx, u, alpha);
		this.renderActiveTimerPills(W, H, cx, u, alpha);
		this.renderToastsAndCharges(W, H, u);
		this.renderCenterBanner(W, H, cx, u);
		this.renderAmbientTelegraphVignette(W, H, cx);
	}
}

var g_apgManager = new APGManager();


/** @format */
class Mob extends EngineObject {
	constructor(pos, size, tileIndex) {
		super(pos, size, tileIndex, vec2(9, 12));

		this.walkCyclePlace = 0;
		this._walkCycleFrames = 60;
		this._hitbox = vec2(0.5);

		this.miniFace = undefined;
		this.setCollision(true, true);
		this.mass = 1;
		this.elasticity = 0.1;
		this.damping = 1;

		// this._maxSpeed = 0.4;

		this.bumpWalk = 0;
		this.mirror = false;
		this.hp = 3;

		this.blood = [];

		// for arms
		this.pointingAngle = rand(2 * PI);
		this._armColor = undefined;

		this.enemyToTarget = undefined;
		this.soundGroan = undefined;
		this.bloodEmitter = undefined;
	}

	applyDrag(dragConst) {
		let speed = this.velocity.length();

		let drag = speed * speed * dragConst;

		if (drag > speed) drag = speed;

		let dragForce = this.velocity.normalize(drag);

		this.velocity = this.velocity.subtract(dragForce);
	}

	groan(chance, strength, pitch = 1, repeat = 1) {
		if (rand() > chance) return;

		const MAX_VOL = 0.5;

		let vol = MAX_VOL;

		if (this.enemyToTarget) {
			let d = this.enemyToTarget.length() / 10;
			vol = d < 1 ? MAX_VOL : MAX_VOL / (d * d);
		}

		soundPlayExtra(this.soundGroan, this.pos, strength * vol, pitch, 1, 50, repeat, 100);

		//		this.soundGroan.play(this.pos, strength * vol, strength * rand(1, 2), 0.5);
	}

	update() {
		if (this.velocity.length() > 0.01) {
			this.walkCyclePlace = (this.walkCyclePlace + 1) % this._walkCycleFrames;
			this.mirror = this.walkCyclePlace > this._walkCycleFrames / 2 ? true : false;
			this.bumpWalk = this.walkCyclePlace > this._walkCycleFrames / 2 ? 0 : 1 / 12;
		} else {
			this.walkCyclePlace = 0;
			this.mirror = false;
		}

		if (this.bloodEmitter) this.bloodEmitter.pos = this.pos;

		super.update(); // update object physics and position
	}

	render() {
		let drawCol = this.color;

		// Phase 3 APG enemy status tints (D-05 !slow, D-11 !frenzy, D-15 Divine Flash stun).
		// Alpha is preserved so Ghost phasing still reads correctly.
		if (typeof Enemy !== "undefined" && this instanceof Enemy) {
			let a = this.color ? this.color.a : 1;
			if (this.stunFrames > 0) {
				drawCol = new Color(colorSpark.r, colorSpark.g, colorSpark.b, a);
			} else if (typeof g_apgManager !== "undefined" && g_apgManager) {
				if (g_apgManager.timers.slow > 0) {
					drawCol = new Color(colorRifleRound.r, colorRifleRound.g, colorRifleRound.b, a);
				} else if (g_apgManager.timers.frenzy > 0) {
					let p = 0.75 + 0.25 * Math.sin(frame / 4);
					drawCol = new Color(colorBlood.r * p, colorBlood.g * p, colorBlood.b * p, a);
				}
			}
		}

		drawTile(
			vec2(this.pos.x, this.pos.y + this.bumpWalk),
			this.size,
			this.tileIndex,
			this.tileSize,
			drawCol,
			this.angle,
			this.mirror
		);

		// holy stun: two golden pixel stars orbiting above the head (D-15)
		if (typeof Enemy !== "undefined" && this instanceof Enemy && this.stunFrames > 0) {
			let starAngle = frame / 6;
			let topY = this.pos.y + this.size.y * 0.55;
			drawRect(
				vec2(this.pos.x + Math.cos(starAngle) * 0.28, topY + Math.sin(starAngle) * 0.08),
				vec2(1.2 / 12),
				colorSpark
			);
			drawRect(
				vec2(this.pos.x - Math.cos(starAngle) * 0.28, topY - Math.sin(starAngle) * 0.08),
				vec2(1.2 / 12),
				colorSpark
			);
		}

		this.postRender();
	}

	postRender() {
		// draw face
		if (this.miniFace && this.enemyToTarget && this.enemyToTarget.y <= 0) {
			drawTile(
				this.pos.add(vec2((this.enemyToTarget.x > 0 ? 1 : 0) / 12, 3 / 12 + this.bumpWalk)),
				vec2(1 / 4),
				this.miniFace,
				MINI_TILE_SIZE
			);
		}
		this.drawBlood();
	}

	drawBlood() {
		// blood
		for (let i = 0; i < this.blood.length; i++) {
			let blood = this.blood[i];
			for (let j = 0; j < blood.pattern.length; j++) {
				if (blood.pattern[j]) {
					let x = this.pos.x + blood.pos.x - (j % 2) / 12;
					let y = this.pos.y + blood.pos.y - Math.floor(j / 2) / 12;
					drawRect(vec2(x, y), vec2(1 / 12), colorBlood);
				}
			}
		}
	}
}

/** @format */

class Enemy extends Mob {
	constructor(pos, size, tileIndex, mobDef) {
		super(pos, size, tileIndex);

		this._maxSpeed = mobDef.maxSpeed + mobDef.maxSpeed * 0.1 * g_difficulty;
		this.hp = mobDef.hp + Math.floor(g_difficulty * mobDef.hpGainPerlevel);

		//this.enemyThinkPause = 0;
		this.enemyThinkMin = 20;
		this.enemyThinkMax = 100;
		this.enemyThinkPause = rand(this.enemyThinkMin, this.enemyThinkMax);
		this.enemyAccel = 0.1;
		this.enemyJitterForce = 0.01;
		this.enemyDrag = 1.5;
		this.enemyToTarget = undefined;
		this.lastTilePos = undefined;

		this.soundGroan = soundEnemyGroan;

		// Phase 3 APG tracking fields (D-03, D-05, D-07, D-08, D-11, D-15, D-17)
		this.maxHp = this.hp;
		this._baseMaxSpeed = this._maxSpeed;
		// walk-cycle / accel bases are captured lazily in update() because subclasses
		// (Vampire, Zombie) override them after this constructor runs
		this._baseWalkCycleFrames = 0;
		this._customBaseAccel = 0;
		this._wasTransformed = false;
		this.enrageMult = 1.0;
		this.enrageBonusHp = 0;
		this.stunFrames = 0;
		this.spawnTelegraphFrames = 0;
		this.doorStuckFrames = 0;
		this.twitchUser = null;
		this.isAudienceSpawned = false;
		this.isAudienceBoss = false;
	}

	update() {
		if (!g_player) return;

		// Portal telegraph: frozen in place while the spawn portal flashes (D-07, BAL-06)
		if (this.spawnTelegraphFrames > 0) {
			this.spawnTelegraphFrames--;
			this.velocity = vec2(0);
			if (this.spawnTelegraphFrames % 15 === 0) {
				g_transforms.push({
					pos: this.pos.copy(),
					life: 30,
					tileIndex: this.isAudienceBoss ? tileNumbers_beefyZombie : tileNumbers_faceZombie,
				});
			}
			super.update();
			return;
		}

		// Divine Flash holy stun: drift to a halt, no thinking or stepping (D-15)
		if (this.stunFrames > 0) {
			this.stunFrames--;
			this.applyDrag(this.enemyDrag);
			super.update();
			return;
		}

		// Dynamic non-compounding speed & accel modifiers (D-05, D-11, D-12, D-17).
		// Everything is recomputed from base values every frame so multipliers never stack.
		let transformedNow = Boolean(this.transformed);
		if (!this._customBaseAccel || transformedNow !== this._wasTransformed) {
			this._customBaseAccel = abs(this.enemyAccel) || 0.1;
			this._baseWalkCycleFrames = this._walkCycleFrames || 60;
			this._wasTransformed = transformedNow;
		}
		let accelSign = this.enemyAccel < 0 ? -1 : 1; // Vampire flees (negative accel) while transforming
		let slowActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.slow > 0;
		let frenzyActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.frenzy > 0;
		let speedMult = this.enrageMult || 1.0;
		let accelMult = 1.0;
		if (slowActive) {
			speedMult *= 0.5;
			this._walkCycleFrames = Math.max(10, this._baseWalkCycleFrames * 2);
		} else if (frenzyActive) {
			speedMult *= 1.6;
			accelMult = 1.6;
			this._walkCycleFrames = Math.max(8, Math.round(this._baseWalkCycleFrames * 0.65));
			if (frame % 6 === 0 && g_apgManager.frenzySparks) {
				g_apgManager.frenzySparks.push({
					pos: this.pos.add(randInCircle(0.25)),
					life: 18,
				});
			}
		} else {
			this._walkCycleFrames = this._baseWalkCycleFrames;
		}
		this._maxSpeed = this._baseMaxSpeed * speedMult;
		this.enemyAccel = accelSign * this._customBaseAccel * accelMult;

		// think and look
		if (this.enemyThinkPause-- <= 0) {
			if (typeof g_player !== "undefined" && g_player) {
				this.enemyToTarget = g_player.pos.subtract(this.pos);
			} else {
				this.enemyToTarget = null;
			}
			this.enemyThinkPause = rand(this.enemyThinkMin, this.enemyThinkMax);
			this.groan(0.3, rand(0.9, 1.2));
		}

		// take a step
		if (rand() < 0.1) {
			let force = vec2(0);
			if (this.enemyToTarget) force = this.enemyToTarget.normalize(this.enemyAccel);

			let jitter = randInCircle(this.enemyJitterForce);
			force = force.add(jitter);

			this.applyForce(force);
		}

		this.applyDrag(this.enemyDrag);
		this.velocity = this.velocity.clampLength(this._maxSpeed);

		super.update();
	}

	collideWithTile(tileData, tilePos) {
		// Stuck-door anti-softlock bash (D-03): after ~3s pressed against a door, smash it open
		if (tileData == tileNumbers_door) {
			this.doorStuckFrames = (this.doorStuckFrames || 0) + 1;
			if (this.doorStuckFrames > 180) {
				breakDoorAt(tilePos.x, tilePos.y, true);
				this.doorStuckFrames = 0;
				return false;
			}
		}

		if (this.lastTilePos && tilePos.distanceSquared(this.lastTilePos) < 0.01) {
			if (rand() < 0.1) {
				let colPos = tilePos.add(vec2(0.5));
				colPos = colPos.lerp(this.pos, 0.5);
				pushers.push(new Pusher(colPos, 0.02, 0, rand(1, 2), rand(1, 2), PushTo.ENEMIES));
			}
		}

		this.lastTilePos = tilePos.copy();
		return true;
	}

	collideWithObject(o) {
		if (o instanceof Enemy) {
			const TOO_CLOSE = 0.7;

			let toOther = o.pos.subtract(this.pos);
			if (toOther.length() < TOO_CLOSE) {
				let pushForce = toOther.normalize(rand(0.1) / (toOther.length() + 0.001));
				o.applyForce(pushForce);
				this.groan(0.1, 0.9, 1);
			}
		}

		if (o instanceof MobPlayer) {
			// eating the corpse
			this.groan(0.1, 0.3, rand(2, 3));
			//vibrate(200);
		}

		if (o instanceof Boulder) {
			if (o.isThrown) this.hit(o.velocity, o.pos, 1);
		}

		return false;
	}

	hit(velocity, pos, dam) {
		if (this.hp <= 0) return;

		this.hp -= dam;
		this.groan(1, 2, rand(1, 1.5));

		this.applyForce(velocity.scale(1 + dam));

		this.bloodEmitter = makeParticles(this.pos, rand(dam / 4, dam / 2));

		for (let i = dam; i--; ) fx_splatter(pos);

		if (this.hp <= 0) {
			this.groan(1, 3, rand(2, 2.5), 2 + rand(3));

			let corpse = new Corpse(this.pos.copy(), this.size.copy(), this.tileIndex, this.tileSize);
			corpse.pushCorpse(velocity /* 1 + g_difficulty */);
			g_corpses.push(corpse);

			let i = g_enemies.indexOf(this);
			g_enemies.splice(i, 1);

			// a dying BossZombie must not leave an unthrown boulder behind (D-08)
			if (this instanceof BossZombie && this.boulder && !this.boulder.isThrown) {
				this.boulder.collideWithTile(); // crumbles with dust FX, then destroy()
				this.boulder = undefined;
			}

			if (this instanceof BossZombie) {
				if (this.isAudienceBoss) {
					// D-08: Audience Mini-Boss does NOT end the level or wipe other enemies!
					g_score += 4; // +4 here + 1 below = +5 bonus score
					let gunTile = g_player && g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
					// D-05: Mini-boss drops Full Care Package (isFullPackage = true)
					new AmmoBox(this.pos.copy(), gunTile, this.twitchUser, false, true);
					if (typeof g_apgManager !== "undefined" && g_apgManager) {
						g_apgManager.onEnemyKilled(this);
					}
				} else {
					// Native Level 5 Stage Boss: kill all enemies and complete level
					while (g_enemies.length > 0) {
						g_enemies[0].hp = 1;
						g_enemies[0].hit(velocity, g_enemies[0].pos, 1);
					}

					Boulder.destroyAllBoulders();

					g_score += 10;
					levelCleared = true;
				}
			} else {
				// Regular enemy kill ammo drop logic (BAL-15, D-01, D-02, D-03, D-17)
				let gunTile = g_player && g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
				let reserve = 0;
				if (g_player) {
					if (gunTile === tileNumbers_shotgun) reserve = g_player.ammoShells;
					else if (gunTile === tileNumbers_rifle) reserve = g_player.ammoRifle;
					else reserve = g_player.ammoBullets;
				}

				// D-01, D-02: Clutch thresholds: <3 bullets for Pistol/SMG, <2 shells/rifle
				let clutchThreshold = (gunTile === tileNumbers_shotgun ? 2 : gunTile === tileNumbers_rifle ? 2 : 3);
				let isLowAmmo = g_player && reserve < clutchThreshold;

				// D-03: 60-frame (1.0s) throttle prevents simultaneous drops from multi-kills
				let nowFrame = typeof frame !== "undefined" ? frame : 0;
				Enemy.lastClutchDropFrame = Enemy.lastClutchDropFrame || -999;
				let isClutch = isLowAmmo && (nowFrame - Enemy.lastClutchDropFrame >= 60);

				// D-17: Tiered base kill drop rates by mob lethality (averaging ~7%)
				let dropRate = 0.07;
				if (this instanceof Zombie) dropRate = 0.05;
				else if (this instanceof Vampire) dropRate = 0.10;
				else if (this instanceof Ghost) dropRate = 0.12;

				let shouldDrop = !(this instanceof BossZombie) && (isClutch || rand() < dropRate);
				if (shouldDrop) {
					if (isClutch) {
						Enemy.lastClutchDropFrame = nowFrame;
					}
					new AmmoBox(this.pos.copy(), gunTile, null, true);
					if (typeof soundPickup !== "undefined" && soundPickup) {
						soundPickup.play(this.pos, 0.3, 2);
					}
				}

				if (typeof g_apgManager !== "undefined" && g_apgManager) {
					g_apgManager.onEnemyKilled(this);
				}
			}

			this.destroy();

			g_score++;
			return true;
		}

		// splatter on mob
		for (let d = dam; d--; ) {
			let wound = { pos: pos.subtract(this.pos).scale(0.33), pattern: [] };
			wound.pos = wound.pos.add(randInCircle(0.2));

			for (let i = 4; i--; ) wound.pattern.push(rand(2) | 0);
			this.blood.push(wound);
		}
		return false;
	}

	drawReachingArms() {
		const armLenght = 4 / 12;

		let toPlayer = this.enemyToTarget || (typeof g_player !== "undefined" && g_player ? g_player.pos.subtract(this.pos) : vec2(0, 1));
		let toPlayerAngle = toPlayer.angle();

		this.pointingAngle += turnTowards(toPlayerAngle - this.pointingAngle, (2 * PI) / 100); //turnTowards(this.pointingAngle, toPlayerAngle, rand(2 * PI) / 100);
		let pointing = vec2(1).setAngle(this.pointingAngle, armLenght);

		// draw arms
		const chestWidth = 3 / 12;
		const chestHeight = 1.5 / 12;

		let pos = this.pos.add(vec2(chestWidth, chestHeight));
		drawLine(pos, pos.add(pointing), 1.2 / 12, this._armColor, !!glEnable);
		pos = this.pos.add(vec2(-chestWidth, chestHeight));
		drawLine(pos, pos.add(pointing), 1.2 / 12, this._armColor, !!glEnable);
	}
}

/** @format */

class Gun extends EngineObject {
	constructor(pos, tileIndex) {
		super(pos, vec2(1), tileIndex, TILE_SIZE);
		// your object init code here
		this._distance = 0.7;
		this._mysize = this.size.y;
		this._speed = 0.4;

		this._maxAmmo = 6;
		this._ammoIconTile = tileNumbers_bulletIcon;
		this._hitbox = vec2(0.4);

		this.ammo = this._maxAmmo;
		this.reloading = false;
		this.reloadTimer = undefined;
		this.reloadTimePerBullet = 0.25;

		this._soundFire = undefined;
		this.noExtraAmmo = false;

		this.soundReload = soundGunReload;
		this.soundEmpty = soundGunEmpty;

		this.autoFire = false;

		this.spread = 0;

		// Phase 3 APG: !jam state (D-10)
		this.isJammed = false;
		this._baseReloadTimePerBullet = 0;
	}

	update() {
		if (this.spread > 0) this.spread /= 1.1;

		if (this.owner && this.owner.hp > 0) {
			// key r or space
			if (isTouchDevice && gamepadWasPressed(0)) {
				this.reload();
				return;
			} else if (keyWasReleased(82) || keyWasReleased(32)) {
				this.reload();
				return;
			}

			let angle = -this.angle;

			if (isUsingGamepad) {
				if (gamepadStick(1).length() > 0.1) {
					angle = Math.atan2(gamepadStick(1).y, gamepadStick(1).x);
				}
			} else if (!isTouchDevice) {
				// use mouse position
				angle = Math.atan2(mousePos.y - this.owner.pos.y, mousePos.x - this.owner.pos.x);
			}

			this.pos.x = this.owner.pos.x + this._distance * Math.cos(angle);
			this.pos.y = this.owner.pos.y + this._distance * Math.sin(angle);

			this.angle = -angle;
			this.size.y = abs(this.angle) > PI / 2 ? -this._mysize : this._mysize;

			if (g_state == STATE_PLAYING) {
				var triggerPulled = isTouchDevice ? gamepadWasReleased(1) || keyWasPressed(13) : mouseWasPressed(0);

				var triggerIsHeld = isTouchDevice ? gamepadIsDown(1) || keyIsDown(13) : mouseIsDown(0);

				this.angle += (Math.random() - 0.5) * this.spread;

				if (this.autoFire) {
					if (triggerIsHeld) this.fire();
				} else {
					if (triggerPulled) this.fire();
				}
			}

			if (this.reloading) {
				if (this.reloadTimer.elapsed()) {
					this.noExtraAmmo = false;

					if (this.tileIndex == tileNumbers_rifle) {
						this.noExtraAmmo = g_player.ammoRifle <= 0;
						g_player.ammoRifle = max(0, g_player.ammoRifle - 1);
					} else if (this.tileIndex == tileNumbers_shotgun) {
						this.noExtraAmmo = g_player.ammoShells <= 0;
						g_player.ammoShells = max(0, g_player.ammoShells - 1);
					} else {
						// pistol
						this.noExtraAmmo = g_player.ammoBullets <= 0;
						g_player.ammoBullets = max(0, g_player.ammoBullets - 1);
					}

					if (!this.noExtraAmmo) {
						this.soundReload.play();
						this.ammo = min(this._maxAmmo, this.ammo + 1);
						this.reloadTimer.set(this.reloadTimePerBullet);
					}
					if (this.ammo == this._maxAmmo || this.noExtraAmmo) {
						this.reloadTimer.unset();
						this.reloading = false;
						if (this.isJammed) {
							// jammed reload finished -> restore normal reload speed
							this.isJammed = false;
							if (this._baseReloadTimePerBullet > 0) {
								this.reloadTimePerBullet = this._baseReloadTimePerBullet;
							}
						}
					}
				}
			}

			if (this.ammo <= 0 && !this.reloading) {
				//this.soundEmpty.play();
				this.reload();
			}
		} else if (!this.owner) {
			// look for owner
			if (typeof g_player !== "undefined" && g_player) {
				let playerTouch = isOverlapping(this.pos, this._hitbox, g_player.pos, g_player._hitbox);

				if (g_player.hp > 0 && playerTouch && !this.playerTouchLastFrame) {
					this.setOwner(g_player);
				}

				this.playerTouchLastFrame = playerTouch;
			}
		}

		super.update(); // update object physics and position
	}

	render() {
		// draw laser
		if (this.owner && (isTouchDevice || this.tileIndex == tileNumbers_rifle) && !this.reloading && rand() > 0.4) {
			const laserLength = 100;
			var laserEndPoint = vec2();

			laserEndPoint = this.owner.pos.add(vec2(laserLength * Math.cos(-this.angle), laserLength * Math.sin(-this.angle)));

			let hitPoint = tileCollisionRaycast(this.owner.pos, laserEndPoint);
			let distToHit = hitPoint.subtract(this.owner.pos).length() - rand(1, 1.2);

			laserEndPoint = this.pos.add(vec2(distToHit * Math.cos(-this.angle), distToHit * Math.sin(-this.angle)));

			drawLine(this.pos, laserEndPoint, 0.02, colorBlood);
		}

		super.render();
	}

	setOwner(player) {
		if (player.gun) {
			// D-11: Swapping weapons returns loaded cylinder ammo to player's reserve pool
			if (player.gun.ammo > 0) {
				if (player.gun.tileIndex == tileNumbers_rifle) {
					player.ammoRifle += player.gun.ammo;
				} else if (player.gun.tileIndex == tileNumbers_shotgun) {
					player.ammoShells += player.gun.ammo;
				} else {
					player.ammoBullets += player.gun.ammo;
				}
				player.gun.ammo = 0;
				if (typeof player.clampAmmo === "function") {
					player.clampAmmo();
				}
			}

			// throw current gun
			player.gun.size.y = this._mysize;
			player.gun.angle = 0;
			player.gun.owner = null;
			player.gun.pos = this.pos.copy();
			soundPickup.play(this.pos);
		}
		this.owner = player;
		player.gun = this;
	}

	fire(color) {
		musicResume();
		if (this.reloading || this.ammo <= 0) {
			this.soundEmpty.play(this.pos);
			return false;
		}

		this.spread += 0.35;

		!isTouchDevice && uiflashScreen("#fff", 1);

		//fx.shakeScreen(0.1);
		fx_addSpark(this.pos.add(this.pos.subtract(this.owner.pos).normalize(1 - this._distance)));

		this.ammo--;

		const shotVol = 3;

		// playing the sound multiple times to make it "bigger" and louder
		this._soundFire.play(this.pos, shotVol, 0.5);
		this._soundFire.play(this.pos, shotVol, 1);
		this._soundFire.play(this.pos, shotVol, 1.02);

		// eject shell
		g_shells.push({
			pos: this.pos.copy(),
			velocity: vec2(rand(-1 / 30, 1 / 30), 1.1 / 12),
			angularVelocity: 0.3,
			angle: 0,
			color: color,
			life: randInt(20, 40),
		});

		return true;
	}

	reload() {
		// if (g_CHEATMODE) this.reloadTimePerBullet = 0.1;

		if (this.reloading || this.ammo == this._maxAmmo) {
			return;
		}

		this.reloadTimer = new Timer(this.reloadTimePerBullet);
		this.reloading = true;
	}

	/**
	 * Phase 3 APG `!jam` (D-10): eject the current magazine back into the
	 * player's reserve pool (ammo is never deleted), then force a slow
	 * jammed reload at double the per-bullet reload time.
	 */
	jam() {
		if (!this._baseReloadTimePerBullet) {
			this._baseReloadTimePerBullet = this.reloadTimePerBullet;
		}
		if (this.ammo > 0 && typeof g_player !== "undefined" && g_player) {
			if (this.tileIndex == tileNumbers_rifle) {
				g_player.ammoRifle += this.ammo;
			} else if (this.tileIndex == tileNumbers_shotgun) {
				g_player.ammoShells += this.ammo;
			} else {
				g_player.ammoBullets += this.ammo;
			}
			this.ammo = 0;
		}
		this.isJammed = true;
		this.reloadTimePerBullet = Math.max(0.45, this._baseReloadTimePerBullet * 2);
		this.reloading = true;
		this.reloadTimer = new Timer(Math.max(0.8, this.reloadTimePerBullet));
		if (typeof soundJam !== "undefined") {
			soundJam.play(this.pos);
		}
	}

	/**
	 * Phase 3 APG `!repair` / Divine Flash (D-02, D-15): cancel any jam,
	 * restore normal reload speed, reset spread and optionally refill the
	 * magazine for free.
	 */
	unjamAndRefill(freeFullMag = false) {
		if (this._baseReloadTimePerBullet > 0) {
			this.reloadTimePerBullet = this._baseReloadTimePerBullet;
		}
		this.isJammed = false;
		this.reloading = false;
		if (this.reloadTimer) {
			this.reloadTimer.unset();
		}
		this.spread = 0;
		if (freeFullMag) {
			this.ammo = this._maxAmmo;
		}
	}
}

/** @format */

class AmmoBox extends EngineObject {
	static getCount() {
		var c = 0;
		for (const o of engineObjects) {
			if (o instanceof AmmoBox) c++;
		}

		return c;
	}

	constructor(pos, gunType, twitchUser = null, isScavenged = false, isFullPackage = false) {
		// D-19: Scavenged clips render at 0.75x tile scale
		let boxSize = isScavenged ? vec2(0.75) : vec2(1);
		super(pos, boxSize, getAmmoForGunType(gunType), TILE_SIZE);

		this._hitbox = vec2(0.5);
		// Phase 3 APG care package attribution (D-01, NAME-03)
		this.twitchUser = twitchUser;
		this.isScavenged = Boolean(isScavenged);
		this.isFullPackage = Boolean(isFullPackage);
		this.spawnFrame = typeof frame !== "undefined" ? frame : 0;
	}

	update() {
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		let maxLife = this.isScavenged ? 1500 : this.twitchUser ? 1800 : Infinity;
		let elapsed = curFrame - this.spawnFrame;

		if (elapsed >= maxLife) {
			if (typeof makeParticles === "function") {
				makeParticles(this.pos, 0.4, colorWhite, 0.5);
			}
			this.destroy();
			return;
		}

		if (!g_player) return;

		if (isOverlapping(this.pos, this._hitbox, g_player.pos, g_player._hitbox)) {
			if (this.isScavenged) {
				// BAL-16: Scavenged enemy drop yields (+2 bullets / +1 shell / +1 rifle)
				if (this.tileIndex == tileNumbers_boxShells) {
					g_player.ammoShells += 1;
				} else if (this.tileIndex == tileNumbers_boxRifleAmmo) {
					g_player.ammoRifle += 1;
				} else {
					g_player.ammoBullets += 2;
				}
				// D-19: Lighter high-pitch pickup chirp for scavenged clips
				soundPickup.play(this.pos, 0.7, 1.6);
			} else if (this.twitchUser) {
				if (this.isFullPackage) {
					// D-05: Slain audience mini-boss Full Care Package reward
					g_player.ammoBullets += 4;
					g_player.ammoShells += 2;
					g_player.ammoRifle += 1;
				} else {
					// D-12, BAL-17: Pure Primary Yields (zero cross-pool bleed)
					let activeGun = g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
					if (activeGun == tileNumbers_shotgun) {
						g_player.ammoShells += 2;
					} else if (activeGun == tileNumbers_rifle) {
						g_player.ammoRifle += 1;
					} else {
						g_player.ammoBullets += 4;
					}
				}
				if (typeof g_apgManager !== "undefined" && g_apgManager) {
					g_apgManager.onAmmoPickedUp(this);
				}
				soundPickup.play(this.pos);
			} else {
				// D-13: Map-placed stationary supply crates (+8 / +3 / +2)
				if (this.tileIndex == tileNumbers_boxShells) {
					g_player.ammoShells += 3;
				} else if (this.tileIndex == tileNumbers_boxRifleAmmo) {
					g_player.ammoRifle += 2;
				} else {
					g_player.ammoBullets += 8;
				}
				soundPickup.play(this.pos);
			}

			if (typeof g_player.clampAmmo === "function") {
				g_player.clampAmmo();
			}
			this.destroy();
		}
	}

	render() {
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		let maxLife = this.isScavenged ? 1500 : this.twitchUser ? 1800 : Infinity;
		let remaining = maxLife - (curFrame - this.spawnFrame);

		// D-14, D-15: Final 5-second rapid flashing warning (toggle every 4 frames ~7.5Hz)
		if (remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0) {
			return;
		}
		super.render();
	}
}

/** @format */

function makeParticles(pos, time, color, size) {
	let emitter = new ParticleEmitter(
		pos, // pos
		0, // angle
		0, // emitSize
		time, // emitTime
		rand(10, 20), // emitRate
		PI, // emiteConeAngle
		-1, // tileIndex
		undefined, // tileSize
		color || colorBlood, // colorStartA
		color || colorBlood, // colorStartB
		colorBlack, // colorEndA
		colorBlack, // colorEndB
		time * 2, // particleTime
		size || 0.12, // sizeStart
		size || 0.1, // sizeEnd
		rand(0.1, 0.4), // particleSpeed
		2 / 12, // particleAngleSpeed
		0.5, // damping
		1, // angleDamping
		0, // gravityScale
		PI, // particleCone
		0.1, //fadeRate,
		0.5, // randomness
		false, // collide
		false, // additive
		false, // randomColorLinear
		1e8 // renderOrder
	);

	return emitter;
}

/** @format */

class Boulder extends EngineObject {
	static destroyAllBoulders() {
		var c = 0;
		for (const o of engineObjects) {
			if (o instanceof Boulder) o.collideWithTile();
		}
	}

	constructor(pos, tileIndex) {
		super(pos, vec2(1), tileIndex, TILE_SIZE, rand(-PI / 8, PI / 8), colorWhite);

		//vibrate(100);
		this.setCollision(true, true);
		this.isThrown = false;
		this.damping = 1;
	}

	collideWithTile() {
		fx_shakeScreen(0.5);
		//vibrate(200);

		soundBoulderDestroy.play();
		makeParticles(this.pos, rand(0.4, 0.8), colorGrey);
		this.destroy();
		return false;
	}
}

/** @format */

class Bullet extends EngineObject {
	constructor(pos, angle, color, lifetime, penetration) {
		let size = vec2(0.15);
		super(pos, size, -1, TILE_SIZE, angle, color);

		this._lifetime = lifetime;
		this._hitbox = vec2(0.25);

		this.penetration = penetration || 1;
		this.timeAlive = 0;
		this.setCollision(true, true, true);

		this.hitSound = soundBulletHit;
	}

	update() {
		this.timeAlive++;
		if (this.timeAlive > this._lifetime) {
			this.destroy();
			return;
		}
		super.update();
	}

	hitWall(big) {
		// bullet holes
		let pos = this.pos.add(this.velocity.normalize(rand(0.2, 0.6)));
		g_holes.push({ pos: pos, color: colorBlack });
		for (let i = 0; i < 4; i++) {
			g_holes.push({
				size: big ? 3 : 1,
				pos: pos.add(randInCircle(1 / 12)),
				color: new Color(0, 0, 0, rand(0.1, 0.5)),
			});
		}

		fx_addSpark(pos.copy());
	}

	collideWithTile(tileData, pos) {
		if (tileData == tileNumbers_door) {
			let idx = pos.x + "_" + pos.y;
			if (g_doors[idx]) {
				g_doors[idx].hp--;
				this.hitWall(true);
				soundBoulderDestroy.play(pos, 1.5);
				makeParticles(pos.add(vec2(0.5)), 0.1, colorWhite, 0.25);
				if (g_doors[idx].hp <= 0) {
					// shared anti-softlock helper (D-02, D-03)
					breakDoorAt(pos.x, pos.y, true);
				}
			}
		}
		this.hitWall();
		this.destroy();
		this.hitSound.play();
		return false; // no more col resolve
	}

	collideWithObject(o) {
		//console.log("bullet hit : ", o);
		if (this.penetration <= 0) return false;

		if (o instanceof Enemy) {
			if (o.hp <= 0) return false;

			var damage = min(o.hp, this.penetration);

			o.hit(this.velocity.copy(), this.pos.copy(), damage);
			this.hitSound.play(this.pos);

			this.penetration -= damage;

			if (this.penetration <= 0) {
				this.destroy();
				return;
			}
		}

		return false; // no auto resolve of collision
	}
}

/** @format */
class Corpse extends EngineObject {
	constructor(pos, size, tileIndex, tileSize) {
		super(pos, size, tileIndex, tileSize, 0, new Color(1, 1, 1, 0.7));
		// your object init code here

		this._animLifetime = 10;

		this.timeAlive = 0;
		this.fallDirection = 1;
		this.finalAngle = PI;
		this.setCollision(false, false, true);

		this.bloodEmitter = makeParticles(this.pos, rand(0.5, 1));
		this.splatterTime = 90;
	}

	update() {
		this.timeAlive++;

		this.angle = (this.fallDirection * min(1, this.timeAlive / this._animLifetime) * this.finalAngle) / 2;

		this.velocity.x = this.velocity.x * 0.9;
		this.velocity.y = this.velocity.y * 0.9;

		this.bloodEmitter.pos = this.pos;
		if (this.splatterTime) {
			if (rand() < 0.1) fx_splatter(this.pos);
			this.splatterTime--;
		}
		super.update(); // update object physics and position
	}

	// skip render so it stays in background
	render() {}

	renderNow() {
		super.render(); // draw object as a sprite
	}

	// postRender() {
	// 	// draw score
	// 	if (this.scoreObj && this.scoreObj.life) {
	// 		drawText(
	// 			"+" + this.scoreObj.score,
	// 			this.pos.add(vec2(0, this.scoreObj.y)),
	// 			0.5,
	// 			colorScoreText,
	// 			1 / 6,
	// 			undefined,
	// 			"center"
	// 		);
	// 		this.scoreObj.y += (1 - (3 * this.scoreObj.y) / 4) / 12;
	// 		this.scoreObj.life--;
	// 	}
	// }

	pushCorpse(velocity /*, score*/) {
		this.velocity.x = velocity.x / 3;
		this.velocity.y = velocity.y / 3;
		this.fallDirection = velocity.x > 0 ? 1 : -1;
		this.finalAngle = -PI / 2 + rand(PI) + PI;

		// if (score) {
		// 	this.scoreObj = {
		// 		score: score,
		// 		y: 0,
		// 		life: 60,
		// 	};
		// }
	}
}



function fx_addSpark (pos) {
	makeParticles(pos, .1, colorSpark, 0.06)

	// for (let i = 0; i < 4; i++) {
	// 	g_sparks.push({
	// 		pos: pos.copy(),
	// 		angle: rand(PI * 2),
	// 		life: 6,
	// 	});
	// }
	
}

function fx_shakeScreen (amt) {
	g_screenShake = vec2(rand(-amt, amt), rand(-amt, amt));
}

function fx_updateScreenShake () {

	if (g_screenShake.length() > 0.01) {
		g_screenShake = g_screenShake.multiply(vec2(-0.7));
	}

}

function fx_splatter(pos) {
	// splatter on floor
	let splatterPattern = {
		pos: pos.add(randInCircle(0.2)),
		color: colorBlood.scale(rand()),
		pattern: [],
	};
	for (let i = 0; i < 16; i++) {
		splatterPattern.pattern.push(rand() > 0.5 ? 1 : 0);
	}
	g_splatter.push(splatterPattern);
}





/** @format */

class MachinePistol extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_smg);
		// your object init code here
		this._distance = 0.7;
		this._speed = 0.4;

		this._maxAmmo = 20;
		this.ammo = this._maxAmmo;
		this._ammoIconTile = tileNumbers_bulletIcon;

		this.reloadTimePerBullet = 0.02;

		this._soundFire = soundPistol;
		this.autoFire = true;

		this.fireDelay = 100; // ms between shots
		this.lastFireTime = 0;
	}

	fire() {
		var now = new Date().getTime();

		if (now - this.lastFireTime < this.fireDelay) return;

		this.lastFireTime = now;

		if (super.fire(colorBullet)) {
			let bullet = new Bullet(this.pos.copy(), 0, colorBullet, 28);
			bullet.velocity.x = Math.cos(-this.angle) * this._speed;
			bullet.velocity.y = Math.sin(-this.angle) * this._speed;
		}
		return true;
	}
}

/** @format */

class Pistol extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_pistol);
		// your object init code here
		this._distance = 0.7;
		this._speed = 0.4;

		this._maxAmmo = 6;
		this.ammo = this._maxAmmo;
		this._ammoIconTile = tileNumbers_bulletIcon;

		this.reloadTimePerBullet = 0.18;

		this._soundFire = soundPistol;
	}

	fire() {
		if (super.fire(colorBullet)) {
			let bullet = new Bullet(this.pos.copy(), 0, colorBullet, 28);
			bullet.velocity.x = Math.cos(-this.angle) * this._speed;
			bullet.velocity.y = Math.sin(-this.angle) * this._speed;
		}
		return true;
	}
}

/** @format */

class Rifle extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_rifle);
		// your object init code here
		this._distance = 0.3;
		this._speed = 0.5;

		this._maxAmmo = 1;
		this._ammoIconTile = tileNumbers_rifleAmmoIcon;

		this.ammo = this._maxAmmo;
		this.reloadTimePerBullet = 2;

		this._soundFire = soundRifle;
	}

	fire() {
		if (super.fire(colorRifleRound)) {
			const penetration = 12;

			let bullet = new Bullet(this.pos.copy(), 0, colorRifleRound, 40, penetration);
			bullet.velocity.x = Math.cos(-this.angle) * this._speed;
			bullet.velocity.y = Math.sin(-this.angle) * this._speed;
		}
		return true;
	}
}

/** @format */
class Shotgun extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_shotgun);
		this._distance = 0.3;
		this._speed = 0.3;
		this._maxAmmo = 2;
		this._ammoIconTile = tileNumbers_shellIcon;

		this.ammo = this._maxAmmo;
		this.reloadTimePerBullet = 0.6;

		this._soundFire = soundShotgun;
	}

	fire() {
		if (super.fire(colorShell)) {
			var bulletColor = colorShell;
			var bulletLife = 22;

			const bullets = 4;
			const spread = PI / 6;
			let angle = -this.angle - spread / 2;
			for (let i = 0; i < bullets; i++) {
				let bullet = new Bullet(this.pos.copy(), 0, bulletColor, bulletLife);
				bullet.velocity.x = Math.cos(angle) * this._speed;
				bullet.velocity.y = Math.sin(angle) * this._speed;
				angle += spread / bullets;
			}
		}
		return true;
	}
}

/** @format */

var tileLayer;
var playerSpawn;

// Phase 3 APG: feathered !blackout flashlight ring (D-09)
const BLACKOUT_INNER_RADIUS = 2.5;
const BLACKOUT_OUTER_RADIUS = 3.5;

/** Target shadow alpha for a tile at `dist` from the player while !blackout is active (D-09). */
function blackoutTargetAlpha(dist) {
	if (dist <= BLACKOUT_INNER_RADIUS) return 0;
	return dist >= BLACKOUT_OUTER_RADIUS ? 0.96 : 0.55 + (dist - BLACKOUT_INNER_RADIUS) * 0.41;
}

function apgTimerActive(name) {
	return typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers && g_apgManager.timers[name] > 0;
}

/**
 * Phase 3 APG anti-softlock helper (D-02, D-03): permanently breaks the door at
 * tile (x, y), swapping it for a floor tile and clearing its collision.
 * Used by bullets, `!repair` and enemies stuck against a door.
 * Returns true if a door was actually broken.
 */
function breakDoorAt(x, y, playEffects = true) {
	let idx = x + "_" + y;
	let door = g_doors[idx];
	if (door) {
		if (door.broken) return false;
		door.hp = 0;
		door.broken = true;
	} else {
		g_doors[idx] = { hp: 0, x: x, y: y, broken: true };
	}
	let pos = vec2(x, y);
	let floorTile = new TileLayerData(
		tileNumbers_floorStone,
		randInt(4),
		false,
		new Color(1, 1, 1, rand(0.2, 0.5))
	);
	if (tileLayer) {
		tileLayer.setData(pos, floorTile, true);
		tileLayer.redraw();
	}
	setTileCollisionData(pos, 0);
	if (playEffects) {
		soundBoulderDestroy.play(pos, 3);
		makeParticles(pos.add(vec2(0.5)), 0.3, colorWhite, 0.5);
	}
	return true;
}

/**
 * Phase 3 APG line-of-sight query (D-22): is `worldPos` currently visible to
 * the player through Fog of War / !blackout? Used to cull @User name tags.
 */
function isPosVisibleToPlayer(worldPos) {
	if (!g_player || !worldPos) return false;
	if (apgTimerActive("light")) return true;
	if (apgTimerActive("blackout") && worldPos.distance(g_player.pos) > 3.2) return false;
	let key = Math.floor(worldPos.x) + "_" + Math.floor(worldPos.y);
	let sh = g_shadows[key];
	return !sh || sh.alpha <= 0.6;
}

class MapManager {
	constructor() {
		this.createMap();
	}

	createMap() {
		let theMap = mapData[g_levelDef.map];
		let w = theMap.w;
		let h = theMap.h;

		g_doors = {};

		// TileLayer is an EngineObject and will render with the other engineObjects (and respect renderOrder if given)
		tileLayer = new TileLayer(vec2(0), vec2(w, h), TILE_SIZE);
		initTileCollision(vec2(w, h));

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				// floor
				let floorTile = new TileLayerData(
					tileNumbers_floorStone,
					randInt(4),
					false,
					new Color(1, 1, 1, rand(0.2, 0.5))
				);
				tileLayer.setData(vec2(x, h - 1 - y), floorTile);

				let t = theMap.data[x + y * w];
				if (t) {
					t -= 1;

					let offsetVec = vec2(x + 0.5, h - 1 - y + 0.5);

					if (t == tileNumbers_player) {
						playerSpawn = offsetVec;
						continue;
					} else if (t == tileNumbers_pistol) {
						new Pistol(offsetVec);
						continue;
					} else if (t == tileNumbers_shotgun) {
						// BAL-21, D-08: Defer shotgun discovery to Level 2+
						if (g_level < 2) {
							new MachinePistol(offsetVec);
						} else {
							new Shotgun(offsetVec);
						}
						continue;
					} else if (t == tileNumbers_rifle) {
						new Rifle(offsetVec);
						continue;
					} else if (t == tileNumbers_smg) {
						new MachinePistol(offsetVec);
						continue;
					} else if (t == tileNumbers_bossPlaceholder) {
						g_enemies.push(new BossZombie(offsetVec));
						continue;
					} else if (t == tileNumbers_boxBullets) {
						new AmmoBox(offsetVec, tileNumbers_pistol);
						continue;
					} else if (t == tileNumbers_boxShells) {
						// BAL-21, D-08: Replace shell crates with bullet crates in Levels 0-1
						if (g_level < 2) {
							new AmmoBox(offsetVec, tileNumbers_pistol);
						} else {
							new AmmoBox(offsetVec, tileNumbers_shotgun);
						}
						continue;
					} else if (t == tileNumbers_boxRifleAmmo) {
						new AmmoBox(offsetVec, tileNumbers_rifle);
						continue;
					}

					if (t == tileNumbers_door) {
						// Phase 3: full doorway registry so !repair knows every door (D-02)
						let dy = h - 1 - y;
						g_doors[x + "_" + dy] = { hp: 3, x: x, y: dy, broken: false };
					} else {
						// pushers on all collision stuff except doors
						pushers.push(new Pusher(offsetVec, 0.01, 0.5, 1.5, 0, PushTo.ALL));

						// moss (not on doors)
						g_moss.push({
							pos: offsetVec.add(randInCircle(5 / 12)),
							tileIndex: miniTileNumbers_moss + randInt(11),
							angle: rand(PI * 2),
						});
					}

					setTileCollisionData(vec2(x, h - 1 - y), t);
					/*let tint = new Color(rand(0.8, 1), rand(0.8, 1), rand(0.8, 1));
					if (g_level % 2 == 0) {
						// brown houses
						tint = tint.add(new Color(217 / 255, 160 / 255, 102 / 255));
					}
					if (g_level % mapData.length == 2 || g_level % mapData.length == 3) {
						// swap wall and roof tiles
						if (t == 9) t = 13;
						else if (t == 13) t = 9;
						else if (t == 14) t = 24;
						else if (t == 24) t = 14;
					}*/
					// roofs and hedgdetops
					try {
						if ((t == 14 || t == 9) && t == theMap.data[x + (y + 1) * w] - 1) {
							t = t == 14 ? 24 : 13;
						}
					} catch (ex) {} // off edge of map

					let tld = new TileLayerData(t, 0, t == 24 ? false : rand() < 0.5);
					tileLayer.setData(vec2(x, h - 1 - y), tld);
				}
			}
		}

		// Draw the whole tilemap to the offscreen buffer
		tileLayer.redraw();
	}

	render() {
		tileLayer.renderNow();
	}

	// STUPID FOG OF WAR / LINE OF SIGHT
	renderFOW() {
		if (!g_player) return;
		let theMap = mapData[g_levelDef.map];
		const fps = frameRate || 60;

		// Phase 3 APG lighting overrides (D-04 !light, D-09 !blackout)
		let lightActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.light > 0;
		let blackoutActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.blackout > 0;

		let pos = vec2(0);
		for (let x = 0; x < theMap.w; x++) {
			for (let y = 0; y < theMap.h; y++) {
				let cx = x + 0.5;
				let cy = y + 0.5;
				// check if this tile is onscreen
				if (
					abs(cx - cameraPos.x) - 1 > overlayCanvas.width / (cameraScale * 2) ||
					abs(cy - cameraPos.y) - 1 > overlayCanvas.height / (cameraScale * 2)
				) {
					continue;
				}

				// !light: full arena vision, no new shadows (D-04)
				if (lightActive) continue;

				// !blackout: feathered flashlight beam around the player (D-09)
				if (blackoutActive && g_player) {
					let dist = vec2(cx, cy).distance(g_player.pos);
					if (dist > BLACKOUT_INNER_RADIUS) {
						let targetAlpha = blackoutTargetAlpha(dist);
						let shadow = g_shadows[x + "_" + y] || { x: cx, y: cy, alpha: 0 };
						// smooth ~0.4s ramp up to the target darkness (never lowers existing darker shadows)
						shadow.alpha = min(max(shadow.alpha, targetAlpha), shadow.alpha + (0.04 * 60) / fps);
						g_shadows[x + "_" + y] = shadow;
						continue;
					}
					// tiles inside the beam still get normal wall raycast shadows
				}

				let dVec = vec2(g_player.pos.x - cx, g_player.pos.y - cy);
				dVec = dVec.clampLength(min(1.5, dVec.length()));
				pos.x = cx + dVec.x;
				pos.y = cy + dVec.y;
				let pos2 = tileCollisionRaycast(g_player.pos, pos);
				// if collision and the collision is not this tile
				if (pos2 && !(pos2.x == cx && pos2.y == cy)) {
					let shadow = g_shadows[x + "_" + y] || {
						x: cx,
						y: cy,
						alpha: 1,
					};
					shadow.alpha = min(1, shadow.alpha + 0.1);

					g_shadows[x + "_" + y] = shadow;
					//drawRect(pos, vec2(0.1), new Color(1, 0, 0));
				} else {
					//drawRect(pos, vec2(0.1), new Color(0, 1, 0));
				}
			}
		}

		const shadowSize = vec2(1.01);
		let color = colorBlack.copy();
		for (let key in g_shadows) {
			let shadow = g_shadows[key];
			// fade
			if (lightActive) {
				// clear all shadows in ~0.3s (D-04)
				shadow.alpha -= (0.06 * 60) / fps;
			} else if (blackoutActive && g_player) {
				let dist = vec2(shadow.x, shadow.y).distance(g_player.pos);
				if (dist <= BLACKOUT_INNER_RADIUS) {
					shadow.alpha -= (0.025 * 60) / fps;
				} else {
					// hold darkness at (at least) the feathered target while blackout lasts (D-09)
					let targetAlpha = blackoutTargetAlpha(dist);
					if (shadow.alpha > targetAlpha) {
						shadow.alpha = max(targetAlpha, shadow.alpha - (0.01 * 60) / fps);
					}
				}
			} else {
				shadow.alpha -= (0.01 * 60) / fps;
			}
			if (shadow.alpha <= 0) {
				delete g_shadows[key];
			} else {
				pos.x = shadow.x;
				pos.y = shadow.y;
				color.a = shadow.alpha;
				drawRect(pos, shadowSize, color);
			}
		}

		// warm colorSpark ambient flare over the whole view while !light is active (D-04)
		if (lightActive && g_player) {
			let remaining = g_apgManager.timers.light;
			// ease the tint in/out over the first/last ~0.5s and add a gentle flicker
			let fade = min(1, remaining / 30);
			let flicker = 0.85 + 0.15 * Math.sin(frame / 9);
			drawRect(
				cameraPos,
				vec2(overlayCanvas.width / cameraScale + 2, overlayCanvas.height / cameraScale + 2),
				new Color(251 / 255, 242 / 255, 54 / 255, 0.08 * fade * flicker)
			);
		}
	}
}

/** @format */

class BossZombie extends Enemy {
	constructor(pos, isAudienceBoss = false, twitchUser = null) {
		super(
			pos,
			isAudienceBoss ? vec2(1.25, 1.65) : vec2(1.5, 2), // audience mini-boss is ~1.25x a normal mob (D-08)
			tileNumbers_beefyZombie,
			mobDefs.BossZombie
		);

		this.mass = 12;

		// Phase 3 APG: `!boss` scaled elite mini-boss `[Boss] @User` (D-08, NAME-01)
		this.isAudienceBoss = Boolean(isAudienceBoss);
		this.isAudienceSpawned = Boolean(isAudienceBoss);
		this.twitchUser = twitchUser;

		if (this.isAudienceBoss) {
			// level-scaled HP so it is killable on Level 1
			this.maxHp = 12 + (typeof g_level !== "undefined" ? g_level : 0) * 4;
			this.hp = this.maxHp;
			this._baseMaxSpeed = 0.16 + 0.015 * (typeof g_difficulty !== "undefined" ? g_difficulty : 1);
			this._maxSpeed = this._baseMaxSpeed;
		} else {
			this.maxHp = this.hp;
		}

		this.oldMirror = false;
		this.throwing = false;
		this.tearing = false;
		this.boulder = undefined;

		this.soundStep = soundBossStep;
		this.soundThrow = soundBossThrow;
		this.soundTearing = soundBossTearing;

		this.miniFace = miniTileNumbers_miniFaceBoss;
	}

	update() {
		if (g_state == STATE_DEAD) return;

		// portal telegraph / Divine Flash stun pause all boulder behaviour (D-07, D-15)
		if (this.spawnTelegraphFrames > 0 || this.stunFrames > 0) {
			super.update();
			return;
		}

		if (this.tearing) {
			this.miniFace = miniTileNumbers_miniFaceBossAngry;
			if (!this.boulder) {
				this.tearing = false;
				return;
			}
			this.boulder.pos = this.pos.copy();
			if (!this.tearingTimer.elapsed()) return;

			// throw chunk
			this.tearing = false;
			this.throwing = true;
			this.throwingTimer = new Timer(1);
			let targetDir = typeof g_player !== "undefined" && g_player ? g_player.pos.subtract(this.pos) : vec2(0, 1);
			this.boulder.velocity = targetDir.normalize(0.2);
			this.boulder.angleVelocity = rand(0.1, 0.2);
			this.boulder.isThrown = true;
			this.soundThrow.play(this.pos);
		}

		if (this.throwing) {
			if (!this.throwingTimer.elapsed()) return;
			this.throwing = false; // base-game typo fix (was `thowing`) (D-08)
			this.miniFace = miniTileNumbers_miniFaceBoss;
		}

		super.update();

		if (this.mirror != this.oldMirror) {
			fx_shakeScreen(0.5);
			//vibrate(200);
			this.soundStep.play(this.pos);
			this.oldMirror = this.mirror;
		}
	}

	postRender() {
		// draw face
		let lookRight = typeof g_player !== "undefined" && g_player ? g_player.pos.subtract(this.pos).x > -1 : false;
		drawTile(
			this.pos.add(vec2((lookRight ? 1 : 0) / 12, 7 / 12 + this.bumpWalk)),
			vec2(1 / 2),
			this.miniFace,
			vec2(6)
		);
		this.drawBlood();
	}

	collideWithObject(o) {
		return true;
	}

	collideWithTile(tileData, pos) {
		if (this.tearing) return;
		// no wall tearing while frozen in a spawn portal or holy-stunned (D-07, D-15)
		if (this.spawnTelegraphFrames > 0 || this.stunFrames > 0) return true;

		// tearing out a door counts as breaking it, keep the registry in sync (D-02)
		if (tileData == tileNumbers_door) {
			let door = g_doors[pos.x + "_" + pos.y];
			if (door) {
				door.hp = 0;
				door.broken = true;
			}
		}

		if (pos.x > 0 && pos.y > 0 && pos.x < tileLayer.size.x - 1 && pos.y < tileLayer.size.y - 1) {
			tileLayer.setData(pos, 0, true);
			setTileCollisionData(pos, 0);
		}

		this.tearing = true;
		this.soundTearing.play(this.pos);

		// tear out chunk
		this.boulder = new Boulder(this.pos.copy(), tileData);

		this.tearingTimer = new Timer(1);

		return true;
	}
}

/** @format */

class Ghost extends Enemy {
	constructor(pos) {
		super(pos, MOB_SIZE, tileNumbers_ghost, mobDefs.Ghost);

		this.miniFace = miniTileNumbers_miniFaceGhost;
		this.mass = 2;

		this._armColor = colorGrey.copy();
		this.color = this._armColor;
		this.transformCount = rand(30, 120);
		this.solid = false;

		this.soundGroan = soundGhostGroan;
	}

	update() {
		this.transformCount--;

		// transform
		if (this.transformCount < 0) {
			this.transformCount = rand(30, 120);
			this.solid = !this.solid;
			this.color.a = this.solid ? 1 : 0.3;
			this._armColor.a = this.color.a;
		}

		this.setCollision(this.solid, this.solid, this.solid);

		super.update();
	}

	postRender() {
		this.drawReachingArms();

		super.postRender();
	}
}

/** @format */
class MobPlayer extends Mob {
	constructor(pos) {
		super(pos, MOB_SIZE, tileNumbers_player);

		this.miniFace = miniTileNumbers_miniFacePlayer;

		this._walkCycleFrames = 20;

		this.setCollision(true, true);
		this.mass = 1;
		this.damping = 0.95;
		this.mirror = false;
		this.gun = undefined;

		this.ammoBullets = 12;
		this.ammoShells = 0;
		this.ammoRifle = 0;

		// Phase 3 APG: 3-Heart Survival System (D-13, BAL-07)
		// 3 base hearts, upgradable to a golden 4th armor shield pip via !repair
		this.maxHp = 4;
		this.hp = 3;
		this.invulnFrames = 0; // post-hit / Divine Flash invulnerability frames
		this.divineInvuln = false; // true while invulnerability comes from Divine Flash (gold flash)

		this.killer = null; // fatal attacker metadata (D-17)

		this.soundScream = soundPlayerScream;

		this.clampAmmo();
	}

	clampAmmo() {
		if (this.ammoBullets > MAX_AMMO_BULLETS) this.ammoBullets = MAX_AMMO_BULLETS;
		if (this.ammoShells > MAX_AMMO_SHELLS) this.ammoShells = MAX_AMMO_SHELLS;
		if (this.ammoRifle > MAX_AMMO_RIFLE) this.ammoRifle = MAX_AMMO_RIFLE;
	}

	getAmmoForCurrentGun() {
		if (this.gun.tileIndex == tileNumbers_shotgun) {
			return this.gun.ammo + this.ammoShells;
		} else if (this.gun.tileIndex == tileNumbers_rifle) {
			return this.gun.ammo + this.ammoRifle;
		}
		return this.gun.ammo + this.ammoBullets;
	}

	update() {
		if (this.invulnFrames > 0) {
			this.invulnFrames--;
			if (this.invulnFrames === 0) this.divineInvuln = false;
		}

		// Continuous rhythmic heartbeat pulse (~1.2Hz / 50 frames) while at 1 HP (D-05)
		if (this.hp === 1 && typeof g_state !== "undefined" && g_state === STATE_PLAYING && !g_isPaused) {
			if (frame % 50 === 0 && typeof soundHeartbeat !== "undefined") {
				soundHeartbeat.play(this.pos, 0.75, 1.0);
				setTimeout(() => {
					if (typeof soundHeartbeat !== "undefined" && typeof g_player !== "undefined" && g_player && g_player.hp === 1) {
						soundHeartbeat.play(g_player.pos, 0.55, 0.88);
					}
				}, 140);
			}
		}

		// !light grants +25% movement speed (D-04, BAL-08)
		const baseSpeed = 0.0115;
		const lightActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.light > 0;
		const speed = lightActive ? baseSpeed * 1.25 : baseSpeed;

		super.update(); // update object physics and position

		if (this.hp > 0) {
			let dx = 0;
			let dy = 0;

			if (g_state == STATE_PLAYING) {
				if (isUsingGamepad) {
					dx = gamepadStick(0).x * speed;
					dy = gamepadStick(0).y * speed;
				} else {
					if (keyIsDown(38)) {
						// key w
						dy = speed;
					}
					if (keyIsDown(37)) {
						// key a
						dx = -speed;
					}
					if (keyIsDown(40)) {
						// key s
						dy = -speed;
					}
					if (keyIsDown(39)) {
						// key d
						dx = speed;
					}
				}
			}

			this.applyForce(new Vector2(dx, dy));

			this.applyDrag(1.1);

			// golden footprints trail while !light is active (D-04)
			if (lightActive && g_apgManager.footprints && this.velocity.length() > 0.01 && frame % 7 === 0) {
				g_apgManager.footprints.push({
					pos: this.pos.add(vec2(rand(-0.12, 0.12), -0.25)),
					life: 45,
				});
			}
		} else {
			if (this.gun) {
				this.gun.owner = null;
				this.gun = null;
			}
			this.damping = 0.1;
		}
	}

	collideWithObject(o) {
		if (
			(o instanceof Vampire && o.transformed) ||
			o instanceof Zombie ||
			o instanceof Ghost ||
			o instanceof BossZombie ||
			o instanceof Boulder
		) {
			// enemies still rising out of a spawn portal can't hurt yet (D-07)
			if (o instanceof Enemy && o.spawnTelegraphFrames > 0) return false;

			let v = this.pos.subtract(o.pos);
			let d = v.length();
			if (d < 0.5) {
				if (this.hp <= 0) return false;

				if (this.invulnFrames > 0) {
					// invulnerable: gentle separation only, no damage (D-13)
					v.normalize(0.002);
					this.applyForce(v);
					return false;
				}

				if (!g_CHEATMODE) this.hp--;
				v.normalize(0.001);
				this.applyForce(v);
				//vibrate(200);

				makeParticles(this.pos, 0.05);
				fx_splatter(this.pos.copy());

				if (this.hp > 0) {
					// survived the hit: 0.75s i-frames (45 frames) + radial knockback (D-01, D-02, D-06)
					this.invulnFrames = 45;
					this.divineInvuln = false;
					pushers.push(new Pusher(this.pos.copy(), 0.08, 0.2, 2.2, 0.2, PushTo.ENEMIES));
					if (typeof soundShieldBreak !== "undefined") soundShieldBreak.play(this.pos);
					uiflashScreen("#ac3232", 6);

					// Immediate double-thump heartbeat on dropping to 1 HP (D-05)
					if (this.hp === 1 && typeof soundHeartbeat !== "undefined") {
						soundHeartbeat.play(this.pos, 1.3, 1.0);
						setTimeout(() => {
							if (typeof soundHeartbeat !== "undefined" && typeof g_player !== "undefined" && g_player && g_player.hp === 1) {
								soundHeartbeat.play(g_player.pos, 1.0, 0.88);
							}
						}, 140);
					}
				} else {
					// WE DIE !
					// Record fatal attacker metadata for Cause of Death attribution (D-17)
					this.killer = {
						type: o ? (o.constructor ? o.constructor.name : "Unknown") : "Zombie",
						twitchUser: o && o.twitchUser ? o.twitchUser : "",
						isAudienceBoss: Boolean(o && o.isAudienceBoss),
					};
					if (typeof g_apgManager !== "undefined" && g_apgManager && typeof g_apgManager.onPlayerDied === "function") {
						g_apgManager.onPlayerDied(this.killer);
					}

					for (let i = 0; i < 10; i++) {
						fx_splatter(this.pos);
						makeParticles(this.pos, rand());
					}

					this.angle = PI / 2;
					this.soundScream.play(this.pos);
				}
			}
		}

		return false; // no auto resolve of collision
	}

	render() {
		// invulnerability flash: gold for Divine Flash (10Hz), red-ghost blink for post-hit i-frames (15Hz) (D-03, D-04)
		if (this.invulnFrames > 0 && this.hp > 0) {
			if (this.divineInvuln) {
				this.color = frame % 6 < 3 ? colorSpark : colorWhite;
			} else {
				this.color = frame % 4 < 2 ? new Color(1, 0.4, 0.4, 0.5) : colorWhite;
			}
		} else {
			this.color = colorWhite;
		}

		super.render(); // draw object as a sprite

		if (this.hp > 0 && this.gun) {
			// arms
			drawLine(this.pos.add(vec2(3 / 12, 2 / 16 + this.bumpWalk)), this.gun.pos, 1 / 12, colorBlood, !!glEnable);
			drawLine(this.pos.add(vec2(-3 / 12, 2 / 16 + this.bumpWalk)), this.gun.pos, 1 / 12, colorBlood, !!glEnable);
			// draw face
			let toCursor = this.gun.pos.subtract(this.pos);
			if (toCursor.y <= 0) {
				drawTile(
					this.pos.add(vec2((toCursor.x > 0 ? 1 : 0) / 12, 3 / 12 + this.bumpWalk)),
					vec2(1 / 4),
					this.miniFace,
					MINI_TILE_SIZE
				);
			}
		}
	}
}

/** @format */

class Vampire extends Enemy {
	constructor(pos) {
		super(pos, MOB_SIZE, tileNumbers_bat, mobDefs.Vampire);

		this.mass = 2;

		// before transform! ... BAT STATS

		this.enemyToTarget = undefined;
		this.enemyAccel = rand(0.3, 0.5);
		this.enemyJitterForce = 0.5;
		this._walkCycleFrames = 20;

		this.transformTimer = undefined;
		this.transforming = false;
		this.transformed = false;

		//this.pos.y -= 0.5; //

		this.soundGroan = soundVampireGroan;
	}

	update() {
		if (!this.transformed) {
			// flap wings
			this.angle = this.walkCyclePlace > this._walkCycleFrames / 2 ? 0 : PI;

			if (this.transforming) {
				if (this.transformTimer.elapsed()) {
					// transform! ... VAMPIRE STATS
					this.angle = 0;
					this.miniFace = miniTileNumbers_miniFaceVampire;
					this._walkCycleFrames = 15;
					makeParticles(this.pos, rand(), colorRifleRound);
					this.tileIndex = tileNumbers_vampire;
					this.hp += mobDefs.Vampire.addTransformHp + g_difficulty;
					this.mass = 2;
					this.enemyAccel = rand(0.4, 0.5);
					this.enemyThinkMin = 20;
					this.enemyThinkMax = 50;
					this.enemyJitterForce = 0;
					this.transformed = true;
					this.soundGroan = soundEnemyGroan;
					this.damping = 0.95; // on ground
				}
			} else {
				if (typeof g_player !== "undefined" && g_player && isOverlapping(this.pos, this._hitbox, g_player.pos, g_player._hitbox)) {
					// scary foreboding hint at what is coming
					g_transforms.push({ pos: this.pos.copy(), life: 60, tileIndex: tileNumbers_faceVampire });
					this.transformTimer = new Timer(2);
					this.transforming = true;
					this.enemyAccel = -this.enemyAccel; // run from player while transforming !
				}
			}
		}

		super.update(); // update object physics and position
	}

	render() {
		super.render();
	}

	hit(velocity, pos, dam) {
		this.enemyToTarget = undefined;
		this.groan(1, this.transformed ? 1 : 0.3);
		return super.hit(velocity, pos, dam);
	}
}

/** @format */

const JIT = 0.01;
const RISE_FRAMES = 240;

class Zombie extends Enemy {
	constructor(pos) {
		super(pos, MOB_SIZE, tileNumbers_zombie, mobDefs.Zombie);

		this.miniFace = miniTileNumbers_miniFaceZombie;

		this.mass = 2;
		this._armColor = colorZombie;

		this.riseFrames = RISE_FRAMES;
		this.pos.y -= 0.5; // for the rising to look good-ish

		this.enemyJitterForce = 0.01;
		this.enemyAccel = rand(0.2, 0.3);

		//this.pointingAngle = rand(2 * PI);
		this.damping = 0; // stand still until first move

		this.groan(1, rand(0.9, 1.1), 1);
	}

	update() {
		if (this.spawnTelegraphFrames > 0) {
			if (this.riseFrames > 0) {
				this.pos.y += 0.5 * (this.riseFrames / RISE_FRAMES);
				this.tileSize = vec2(9, 12);
				this.size = vec2(this.size.x, 0.8);
				this.riseFrames = 0;
			}
			super.update();
			return;
		}

		if (this.riseFrames > 0) {
			// dirt particles when rising
			if (this.riseFrames % 20 == 0) makeParticles(this.pos.subtract(vec2(0, this.size.y / 2)), 0.4, colorEarth);

			this.riseFrames--;
			let frac = 1 - this.riseFrames / RISE_FRAMES;
			this.tileSize = vec2(9, 12 * frac);
			this.size = vec2(this.size.x, 0.8 * frac);
			this.pos.y += 0.5 / RISE_FRAMES;

			if (this.riseFrames == 0) {
				this.groan(1, 1, 1.5);
				this.velocity = vec2(0);
			}
			return;
		}

		if (this.enemyToTarget) this.damping = 0.95; // now you can move

		super.update();
	}

	hit(velocity, pos, dam) {
		//this.moveSpeed = rand(0.05, 0.2);
		this.enemyThinkPause += rand(10, 30);
		this.enemyToTarget = undefined;
		this.groan(1, 2, rand(2, 3));
		return super.hit(velocity, pos, dam);
	}

	postRender() {
		if (this.riseFrames <= 0) {
			super.postRender(); // render face (and blood)
		}

		if (!this.enemyToTarget) this.pointingAngle = PI;

		this.drawReachingArms();
	}
}

function angleNormalize(angleRad) {
	return (angleRad + 100 * PI) % (2 * PI);
}

function turnTowards(toRad, maxTurnRad) {
	toRad = angleNormalize(toRad);

	if (abs(toRad) < maxTurnRad) return toRad;

	if (toRad > 0 && abs(toRad) < PI) {
		return maxTurnRad;
	} else {
		return -maxTurnRad;
	}
}

/** @format */

const enableDrawPushers = false;

const PushTo = {
	PLAYER: 1,
	ENEMIES: 2,
	ALL: 3,
};

class Pusher {
	/**
	 * At minDist the strenght of the push is pushStrength at maxDist it is zero.
	 *
	 * @param {Vector2} pos
	 * @param {number} pushStrength
	 * @param {number} minDist
	 * @param {number} maxDist
	 * @param {number} secs Seconds to live. If 0 or negative, live for ever.
	 * @param {number} whoIsAffected (Affects)
	 */
	constructor(pos, pushStrength, minDist, maxDist, secs = 0, whoIsAffected = PushTo.ALL) {
		this.pos = pos;
		this.minDist = minDist;
		this.maxDist = maxDist;
		this.pushStrength = pushStrength;
		this.tics = Math.round(secs * 60);
		this.affects = whoIsAffected;
	}

	affectMob(e) {
		if (!e.collideWithTile) return;

		let toMob = e.pos.subtract(this.pos);

		let dist = toMob.length();

		if (dist > this.maxDist) return;

		let strenght = this.pushStrength;

		if (dist > this.minDist) {
			let p = 1 - percent(dist, this.minDist, this.maxDist);
			//strenght *= p; // lineary falloff
			//strenght *= 1 + Math.cos(p * PI); // sigmoidal falloff
			strenght *= 2 * p * p; // squared falloff
		}

		// console.log("strenght", strenght);

		let force = toMob.normalize(rand(strenght));

		e.applyForce(force);
	}

	update() {
		this.tics = this.tics - 1;

		if (this.affects & PushTo.ENEMIES) {
			for (const e of g_enemies) {
				this.affectMob(e);
			}
		}

		if (this.affects & PushTo.PLAYER) {
			this.affectMob(g_player);
		}
	}

	// draw() {
	// 	debugCircle(this.pos, this.minDist, "#f00", 1 / 60, false);
	// 	debugCircle(this.pos, this.maxDist, "#0f0", 1 / 60, false);
	// }
}

var pushers = [];

function updatePushers() {
	for (let i = 0; i < pushers.length; i++) {
		let p = pushers[i];
		p.update();
		if (p.tics === 0) {
			pushers.splice(i, 1);
			i--;
		}
	}
}

function drawPushers() {
	if (!enableDrawPushers) return;
	for (const p of pushers) {
		p.draw();
	}
}

function clearPushers() {
	pushers = [];
}

/** @format */

// this draws the ui on top of everything (in theory)

var ui_fadeTarget = 0;
var ui_fade = 1;
var ui_onFaded = undefined;

const ui_clearColors = [
	[0.5, 0, 0, 0.035],     // Level 0: 3.5% Red
	[0.25, 0.25, 0, 0.035], // Level 1: 3.5% Brown/Yellow
	[0.5, 0.5, 0, 0.035],   // Level 2: 3.5% Yellow/Olive
	[0, 0, 0.5, 0.035],     // Level 3: 3.5% Blue
	[0, 0.5, 0.5, 0.035],   // Level 4: 3.5% Teal
];

const ui_fadeCol = new Color(0.2, 0, 0); // when screen is all faded out !

function uiFadeOutAndCall(fadeFunc) {
	if (!ui_onFaded) {
		ui_onFaded = fadeFunc;
		ui_fadeTarget = 1;
	}
}

function uiFading() {
	// fade
	const FADE_TIME = 0.5;
	const fadeSpeed = 1 / (FADE_TIME * 60);
	let dFade = ui_fadeTarget == 0 ? -fadeSpeed / 1.5 : fadeSpeed; // fading in looks slower somehow ... strange but true

	ui_fade = clamp(ui_fade + dFade, 0, 1);

	if (ui_fade == 1) {
		ui_fadeTarget = 0;
		if (ui_onFaded) {
			ui_onFaded();
			ui_onFaded = undefined;
		}
	}
}

var ui_flashColor = undefined;
var ui_flashFrames = 0;

function uiflashScreen(colorString, frames) {
	ui_flashColor = colorString;
	ui_flashFrames = frames;
}

function uiDrawRectScreen(screenPos, screenSize, color) {
	drawRect(screenToWorld(screenPos), screenSize.scale(1 / cameraScale), color);
}

function uiDrawTileScreen(screenPos, screenSize, tileIndex, color = colorWhite, mirror = false) {
	drawTile(
		screenToWorld(screenPos),
		screenSize.scale(1 / cameraScale),
		tileIndex,
		TILE_SIZE,
		color,
		0,
		mirror
	);
}

function uiDrawHeartPipWorld(worldPos, scale, stateType) {
	// Crisp pixel-art heart / golden armor shield pip in world space (D-13, D-21)
	const s = (scale || 1) * 0.18;
	if (stateType === "heart") {
		// Crimson colorBlood heart with white highlight pixel
		drawRect(worldPos.add(vec2(-s * 0.6, s * 0.3)), vec2(s * 1.0, s * 1.0), colorBlood);
		drawRect(worldPos.add(vec2(s * 0.6, s * 0.3)), vec2(s * 1.0, s * 1.0), colorBlood);
		drawRect(worldPos.add(vec2(0, -s * 0.4)), vec2(s * 1.8, s * 1.2), colorBlood);
		drawRect(worldPos.add(vec2(0, -s * 0.9)), vec2(s * 0.9, s * 0.7), colorBlood);
		drawRect(worldPos.add(vec2(-s * 0.6, s * 0.5)), vec2(s * 0.45, s * 0.45), colorWhite);
	} else if (stateType === "armor") {
		// Golden colorSpark shield pip (3rd HP)
		const shimmer = 0.85 + 0.15 * Math.sin(frame / 5);
		const goldCol = colorSpark.scale(shimmer);
		drawRect(worldPos, vec2(s * 2.2, s * 2.2), colorWhite);
		drawRect(worldPos, vec2(s * 1.8, s * 1.8), goldCol);
		drawRect(worldPos.add(vec2(0, -s * 0.7)), vec2(s * 1.2, s * 1.0), goldCol);
		drawRect(worldPos, vec2(s * 0.5, s * 1.1), colorWhite);
		drawRect(worldPos, vec2(s * 1.1, s * 0.5), colorWhite);
	} else {
		// Empty heart slot (dark hollow backing)
		drawRect(worldPos, vec2(s * 2.0, s * 2.0), colorBlack);
		drawRect(worldPos, vec2(s * 1.5, s * 1.5), colorGrey.scale(0.35));
	}
}

function renderLobbyHUD() {
	let pred =
		typeof g_apgNetwork !== "undefined" && g_apgNetwork.prediction
			? g_apgNetwork.prediction
			: {
					status: "LOBBY",
					mode: "chat",
					level: g_level + 1,
					remainingSeconds: 60,
					durationSeconds: 60,
					goodCount: 0,
					badCount: 0,
					goodPct: 50,
					badPct: 50,
					recentGoodVoters: [],
					recentBadVoters: [],
			  };

	const W = mainCanvas.width;
	const H = mainCanvas.height;
	const cx = W / 2;
	const u = Math.max(12, Math.min(W, H) / 40);

	// 1. Dimmed Arena Backdrop & Central Arcade Card Panel (D-07, D-21)
	uiDrawRectScreen(vec2(cx, H / 2), vec2(W, H), new Color(0, 0, 0, 0.58));
	const cardW = Math.min(W * 0.88, u * 34);
	const cardH = H * 0.78;
	uiDrawRectScreen(vec2(cx, H * 0.52), vec2(cardW + 4, cardH + 4), colorWhite.scale(0.25));
	uiDrawRectScreen(vec2(cx, H * 0.52), vec2(cardW, cardH), new Color(0.05, 0.05, 0.07, 0.86));

	// 2. Flickering Blood-Red Header (D-21, D-22)
	const headerText = "LEVEL " + (g_level + 1) + ": WILL CHAT BE GOOD OR BAD?";
	const headerSize = Math.min(u * 1.45, W / 24);
	let flicker = (1.5 + Math.sin(frame / 50)) * 0.005;
	for (let i = 0; i < 10; i++) {
		drawTextScreen(
			headerText,
			vec2(rand(1 - flicker, 1 + flicker) * cx, rand(1 - flicker, 1 + flicker) * (H * 0.17)),
			headerSize,
			colorBlack.lerp(colorBlood, i / 10)
		);
	}
	drawTextWithOutline(headerText, vec2(cx, H * 0.17), headerSize, colorBlood);

	// 3. Poll Mode Subtitle Pill (D-22)
	const isHelix = pred.mode === "helix";
	const modeText = isHelix
		? "★ TWITCH CHANNEL POINTS + CHAT POLL (!good / !bad)"
		: "● LIVE CHAT POLL — TYPE !good OR !bad IN CHAT";
	drawTextWithOutline(modeText, vec2(cx, H * 0.24), u * 0.78, isHelix ? colorSpark : colorBullet);

	// 4. Large Countdown Timer or 2-Second Lock Splash (PRED-02, D-06, D-22)
	const goodPct = clamp(typeof pred.goodPct === "number" ? pred.goodPct : 50, 0, 100);
	const badPct = 100 - goodPct;

	if (pred.status === "LOCKED") {
		const bannerW = Math.min(W * 0.72, u * 26);
		uiDrawRectScreen(vec2(cx, H * 0.34), vec2(bannerW + 4, u * 2.4 + 4), colorSpark);
		uiDrawRectScreen(vec2(cx, H * 0.34), vec2(bannerW, u * 2.4), new Color(0.15, 0.05, 0.05, 0.95));
		const lockText = "VOTES LOCKED: " + goodPct + "% GOOD vs " + badPct + "% BAD";
		drawTextWithOutline(lockText, vec2(cx, H * 0.34), u * 1.35, colorSpark);
	} else {
		const rem = Math.max(0, Math.ceil(Number(pred.remainingSeconds) || 0));
		const mins = Math.floor(rem / 60);
		const secs = rem % 60;
		const clockStr = (mins < 10 ? "0" + mins : "" + mins) + ":" + (secs < 10 ? "0" + secs : "" + secs);
		const isUrgent = rem <= 10;
		const pulse = isUrgent ? 1 + 0.12 * Math.sin(frame / 4) : 1;
		const timerColor = isUrgent ? colorBlood : colorSpark;
		drawTextWithOutline(clockStr, vec2(cx, H * 0.34), u * 2.4 * pulse, timerColor);
	}

	// 5. Horizontal Tug-of-War Split Bar Framed by Pixel Portraits (D-21, D-22)
	const barY = H * 0.46;
	const barW = Math.min(W * 0.62, u * 24);
	const barH = u * 1.7;
	const barLeft = cx - barW / 2;
	const barRight = cx + barW / 2;

	uiDrawRectScreen(vec2(cx, barY), vec2(barW + 6, barH + 6), colorWhite.scale(0.35));
	uiDrawRectScreen(vec2(cx, barY), vec2(barW, barH), colorBlack);

	const goodW = barW * (goodPct / 100);
	const badW = barW * (badPct / 100);
	if (goodW > 0) {
		uiDrawRectScreen(vec2(barLeft + goodW / 2, barY), vec2(goodW, barH), colorZombie);
	}
	if (badW > 0) {
		uiDrawRectScreen(vec2(barRight - badW / 2, barY), vec2(badW, barH), colorBlood);
	}
	uiDrawRectScreen(vec2(cx, barY), vec2(3, barH + 6), colorSpark);

	// Pixel art portraits from t.png (D-21, D-22)
	const portraitSize = vec2(u * 2.2);
	uiDrawTileScreen(vec2(barLeft - u * 1.8, barY), portraitSize, tileNumbers_facePlayer, colorWhite, false);
	const badFaceTile = g_level % 5 === 2 ? tileNumbers_faceVampire : tileNumbers_faceZombie;
	uiDrawTileScreen(vec2(barRight + u * 1.8, barY), portraitSize, badFaceTile, colorWhite, true);

	const goodLabel = "TEAM GOOD " + goodPct + "% (" + (pred.goodCount || 0) + ")";
	const badLabel = "(" + (pred.badCount || 0) + ") " + badPct + "% TEAM BAD";
	drawTextWithOutline(goodLabel, vec2(cx - barW * 0.24, barY), u * 0.78, colorWhite);
	drawTextWithOutline(badLabel, vec2(cx + barW * 0.24, barY), u * 0.78, colorWhite);

	// 6. Dual Team Roster Columns (D-22)
	const colW = barW * 0.46;
	const colH = H * 0.19;
	const colY = H * 0.65;
	const leftColX = cx - barW * 0.27;
	const rightColX = cx + barW * 0.27;

	uiDrawRectScreen(vec2(leftColX, colY), vec2(colW, colH), colorWhite.scale(0.12));
	uiDrawRectScreen(vec2(rightColX, colY), vec2(colW, colH), colorWhite.scale(0.12));

	drawTextWithOutline("▲ GUARDIAN ROSTER", vec2(leftColX, H * 0.58), u * 0.76, colorZombie);
	drawTextWithOutline("▼ SABOTEUR ROSTER", vec2(rightColX, H * 0.58), u * 0.76, colorBlood);

	const goodVoters = Array.isArray(pred.recentGoodVoters) ? pred.recentGoodVoters.slice(0, 5) : [];
	const badVoters = Array.isArray(pred.recentBadVoters) ? pred.recentBadVoters.slice(0, 5) : [];

	if (goodVoters.length === 0) {
		drawTextWithOutline("Waiting for !good votes...", vec2(leftColX, H * 0.64), u * 0.66, colorGrey);
	} else {
		for (let i = 0; i < goodVoters.length; i++) {
			drawTextWithOutline("+ @" + goodVoters[i], vec2(leftColX, H * 0.62 + i * (u * 0.85)), u * 0.68, colorWhite);
		}
	}

	if (badVoters.length === 0) {
		drawTextWithOutline("Waiting for !bad votes...", vec2(rightColX, H * 0.64), u * 0.66, colorGrey);
	} else {
		for (let i = 0; i < badVoters.length; i++) {
			drawTextWithOutline("+ @" + badVoters[i], vec2(rightColX, H * 0.62 + i * (u * 0.85)), u * 0.68, colorWhite);
		}
	}

	// 7. Bottom Command Cheat-Sheet & Quick-Lock Prompt (D-04, D-22)
	const cheatText = "GOOD: !ammo !repair !light !slow !barrier   |   BAD: !mob !boss !blackout !jam !frenzy";
	drawTextWithOutline(cheatText, vec2(cx, H * 0.82), u * 0.7, colorBullet);

	const promptAlpha = 0.82 + 0.18 * Math.sin(frame / 12);
	const promptText = "Chat: !good or !bad   |   Streamer: [SPACE] or [RIGHT-CLICK] Lock Votes & Start Now";
	drawTextWithOutline(promptText, vec2(cx, H * 0.88), u * 0.78, colorSpark.scale(promptAlpha));
}

function renderOutcomeHUD(inW, inH, inCx, inU) {
	let matchSummary = typeof g_apgManager !== "undefined" && g_apgManager ? g_apgManager.matchSummary : null;
	if (!matchSummary) return;

	const W = inW || (typeof mainCanvasSize !== "undefined" ? mainCanvasSize.x : typeof overlayCanvas !== "undefined" ? overlayCanvas.width : 800);
	const H = inH || (typeof mainCanvasSize !== "undefined" ? mainCanvasSize.y : typeof overlayCanvas !== "undefined" ? overlayCanvas.height : 600);
	const cx = inCx || W / 2;
	const u = inU || Math.max(12, Math.min(W, H) / 40);

	// 1. Atmospheric Dark Vignette Overlay (D-18)
	uiDrawRectScreen(vec2(cx, H / 2), vec2(W, H), new Color(0.04, 0.04, 0.06, 0.78));

	// Pulsing faction screen border (D-16)
	let pulseAlpha = 0.5 + 0.3 * Math.sin(frame / 8);
	let borderCol = matchSummary.winner === "good" ? colorSpark : matchSummary.winner === "bad" ? colorBlood : colorGrey;
	borderCol = borderCol.scale(pulseAlpha);
	uiDrawRectScreen(vec2(cx, 3), vec2(W, 6), borderCol);
	uiDrawRectScreen(vec2(cx, H - 3), vec2(W, 6), borderCol);
	uiDrawRectScreen(vec2(3, H / 2), vec2(6, H), borderCol);
	uiDrawRectScreen(vec2(W - 3, H / 2), vec2(6, H), borderCol);

	// 2. Top Outcome Banner (D-05, D-14, D-16)
	let bannerText = "";
	let bannerSubtext = "";
	let bannerColor = colorWhite;

	if (matchSummary.isGrandVictory) {
		bannerText = "★ SURVIVED DEAD AGAIN: GRAND VICTORY! ★";
		bannerSubtext = "STREAMER CONQUERED ALL 5 ARENAS — ALL-TIME LEGEND!";
		bannerColor = colorSpark;
	} else if (matchSummary.winner === "good") {
		bannerText = "★ TEAM GOOD CONQUERED LEVEL " + matchSummary.level + "! ★";
		bannerSubtext = "STREAMER SURVIVED — CHAT EXCEEDED PROMISED ASSISTANCE!";
		bannerColor = colorSpark;
	} else if (matchSummary.winner === "bad") {
		bannerText = "☠ TEAM BAD DESTROYED THE STREAMER! ☠";
		bannerSubtext = matchSummary.causeOfDeath ? matchSummary.causeOfDeath : "AUDIENCE SABOTAGE PREVAILED!";
		bannerColor = colorBlood;
	} else {
		bannerText = "⚖ PACIFIST RUN / POINT REFUND (PUSH) ⚖";
		bannerSubtext = "NO AUDIENCE ACTIONS OR RATIO TIED — CHANNEL POINTS RETURNED";
		bannerColor = colorBullet;
	}

	let bannerPulse = 1 + 0.035 * Math.sin(frame / 6);
	let bannerY = H * 0.085;
	drawTextWithOutline(bannerText, vec2(cx, bannerY), u * 1.35 * bannerPulse, bannerColor);
	drawTextWithOutline(bannerSubtext, vec2(cx, bannerY + u * 1.0), u * 0.72, colorWhite);

	// 3. Channel Points Payout Multiplier Badge (D-32)
	let multText =
		typeof g_apgNetwork !== "undefined" && g_apgNetwork && g_apgNetwork.lastOutcome && g_apgNetwork.lastOutcome.multiplierText
			? g_apgNetwork.lastOutcome.multiplierText
			: "1:2.0x";
	if (matchSummary.winner === "refund") {
		multText = "1:1.0x (REFUNDED)";
	}
	let payoutY = bannerY + u * 1.85;
	let payoutText = "PAYOUT: " + multText + " CHANNEL POINTS RETURN";
	let pW = payoutText.length * (u * 0.44) + 18;
	uiDrawRectScreen(vec2(cx, payoutY), vec2(pW, u * 0.88), new Color(0, 0, 0, 0.75));
	drawTextWithOutline(payoutText, vec2(cx, payoutY), u * 0.65, colorSpark);

	// 4. Final Karma Tug-of-War Breakdown (D-14)
	let barY = H * 0.28;
	let barW = Math.min(W * 0.68, u * 27);
	let barH = u * 1.5;
	let barLeft = cx - barW / 2;
	let barRight = cx + barW / 2;

	uiDrawRectScreen(vec2(cx, barY), vec2(barW + 4, barH + 4), colorWhite.scale(0.3));
	uiDrawRectScreen(vec2(cx, barY), vec2(barW, barH), colorBlack);

	let gPct = clamp(matchSummary.finalGoodPct, 0, 100);
	let bPct = 100 - gPct;
	let gW = barW * (gPct / 100);
	let bW = barW * (bPct / 100);
	if (gW > 0) uiDrawRectScreen(vec2(barLeft + gW / 2, barY), vec2(gW, barH), colorZombie);
	if (bW > 0) uiDrawRectScreen(vec2(barRight - bW / 2, barY), vec2(bW, barH), colorBlood);
	uiDrawRectScreen(vec2(cx, barY), vec2(2, barH), colorBlack);

	// Locked prediction target pin (D-20, D-14)
	let pinPct = clamp(matchSummary.targetGoodPct, 0, 100);
	let pinX = barLeft + barW * (pinPct / 100);
	uiDrawRectScreen(vec2(pinX, barY), vec2(3, barH + 8), colorSpark);
	uiDrawRectScreen(vec2(pinX, barY - barH * 0.55), vec2(7, 3), colorSpark);

	// Pixel portraits on ends
	let pSize = vec2(u * 1.8);
	uiDrawTileScreen(vec2(barLeft - u * 1.4, barY), pSize, tileNumbers_facePlayer, colorWhite, false);
	let badFace = matchSummary.level % 5 === 2 ? tileNumbers_faceVampire : tileNumbers_faceZombie;
	uiDrawTileScreen(vec2(barRight + u * 1.4, barY), pSize, badFace, colorWhite, true);

	drawTextWithOutline("GOOD " + gPct + "% (" + matchSummary.goodActions + ")", vec2(barLeft + barW * 0.25, barY), u * 0.62, colorWhite);
	drawTextWithOutline("(" + matchSummary.badActions + ") " + bPct + "% BAD", vec2(barRight - barW * 0.25, barY), u * 0.62, colorWhite);

	let tgtStr = "FINAL KARMA: " + gPct + "% GOOD vs " + bPct + "% BAD  |  LOCKED TARGET: " + pinPct + "% GOOD";
	drawTextWithOutline(tgtStr, vec2(cx, barY + barH * 0.88), u * 0.64, colorBullet);

	// 5. Split Podium Cards: Guardian Angel MVP vs Public Enemy #1 (D-14, D-15, D-19, D-24)
	let cardY = H * 0.58;
	let cardW = Math.min(W * 0.42, u * 16.5);
	let cardH = H * 0.42;
	let leftCardX = cx - cardW * 0.58;
	let rightCardX = cx + cardW * 0.58;

	// --- Left Card: Guardian Angel MVP ---
	let isGoodWin = matchSummary.winner === "good";
	let goodBorderCol = isGoodWin ? colorSpark : colorZombie;
	uiDrawRectScreen(vec2(leftCardX, cardY), vec2(cardW + 4, cardH + 4), goodBorderCol.scale(0.85));
	uiDrawRectScreen(vec2(leftCardX, cardY), vec2(cardW, cardH), new Color(0.04, 0.08, 0.05, 0.9));

	drawTextWithOutline("▲ GUARDIAN ANGEL MVP ▲", vec2(leftCardX, cardY - cardH * 0.42), u * 0.78, colorZombie);

	let goodMVP = matchSummary.goodPodium && matchSummary.goodPodium.mvp ? matchSummary.goodPodium.mvp : null;
	if (goodMVP) {
		uiDrawTileScreen(vec2(leftCardX, cardY - cardH * 0.22), vec2(u * 2.6), tileNumbers_facePlayer, colorWhite, false);
		drawTextWithOutline("@" + goodMVP.user, vec2(leftCardX, cardY - cardH * 0.04), u * 0.95, colorWhite);
		drawTextWithOutline("★ " + goodMVP.title + " ★", vec2(leftCardX, cardY + cardH * 0.1), u * 0.72, colorSpark);
		drawTextWithOutline(goodMVP.score + " PTS  |  " + goodMVP.actions + " Buffs", vec2(leftCardX, cardY + cardH * 0.22), u * 0.68, colorZombie);

		let gRunners = matchSummary.goodPodium.runnersUp || [];
		if (gRunners.length > 0) {
			let r1 = "#2 @" + gRunners[0].user + " (" + gRunners[0].score + " pts)";
			drawTextWithOutline(r1, vec2(leftCardX, cardY + cardH * 0.33), u * 0.58, colorWhite.scale(0.8));
		}
		if (gRunners.length > 1) {
			let r2 = "#3 @" + gRunners[1].user + " (" + gRunners[1].score + " pts)";
			drawTextWithOutline(r2, vec2(leftCardX, cardY + cardH * 0.41), u * 0.58, colorWhite.scale(0.65));
		}
	} else {
		// 'NO ONE STEPPED UP' Placeholder Card (D-15)
		uiDrawTileScreen(vec2(leftCardX, cardY - cardH * 0.2), vec2(u * 2.4), tileNumbers_facePlayer, colorGrey.scale(0.25), false);
		drawTextWithOutline("NO GUARDIAN ANGEL", vec2(leftCardX, cardY), u * 0.82, colorGrey);
		drawTextWithOutline("'Chat offered no salvation'", vec2(leftCardX, cardY + cardH * 0.15), u * 0.65, colorGrey.scale(0.8));
	}

	// --- Right Card: Public Enemy #1 ---
	let isBadWin = matchSummary.winner === "bad";
	let badBorderCol = isBadWin ? colorSpark : colorBlood;
	uiDrawRectScreen(vec2(rightCardX, cardY), vec2(cardW + 4, cardH + 4), badBorderCol.scale(0.85));
	uiDrawRectScreen(vec2(rightCardX, cardY), vec2(cardW, cardH), new Color(0.08, 0.04, 0.04, 0.9));

	drawTextWithOutline("▼ PUBLIC ENEMY #1 ▼", vec2(rightCardX, cardY - cardH * 0.42), u * 0.78, colorBlood);

	let badMVP = matchSummary.badPodium && matchSummary.badPodium.mvp ? matchSummary.badPodium.mvp : null;
	if (badMVP) {
		uiDrawTileScreen(vec2(rightCardX, cardY - cardH * 0.22), vec2(u * 2.6), tileNumbers_faceZombie, colorWhite, true);
		drawTextWithOutline("@" + badMVP.user, vec2(rightCardX, cardY - cardH * 0.04), u * 0.95, colorWhite);
		drawTextWithOutline("☠ " + badMVP.title + " ☠", vec2(rightCardX, cardY + cardH * 0.1), u * 0.72, colorBlood);
		drawTextWithOutline(badMVP.score + " PTS  |  " + badMVP.actions + " Sabotages", vec2(rightCardX, cardY + cardH * 0.22), u * 0.68, colorBlood);

		let bRunners = matchSummary.badPodium.runnersUp || [];
		if (bRunners.length > 0) {
			let r1 = "#2 @" + bRunners[0].user + " (" + bRunners[0].score + " pts)";
			drawTextWithOutline(r1, vec2(rightCardX, cardY + cardH * 0.33), u * 0.58, colorWhite.scale(0.8));
		}
		if (bRunners.length > 1) {
			let r2 = "#3 @" + bRunners[1].user + " (" + bRunners[1].score + " pts)";
			drawTextWithOutline(r2, vec2(rightCardX, cardY + cardH * 0.41), u * 0.58, colorWhite.scale(0.65));
		}
	} else {
		// 'NO ONE STEPPED UP' Placeholder Card (D-15)
		uiDrawTileScreen(vec2(rightCardX, cardY - cardH * 0.2), vec2(u * 2.4), tileNumbers_faceZombie, colorGrey.scale(0.25), true);
		drawTextWithOutline("NO PUBLIC ENEMY", vec2(rightCardX, cardY), u * 0.82, colorGrey);
		drawTextWithOutline("'Chat showed mercy'", vec2(rightCardX, cardY + cardH * 0.15), u * 0.65, colorGrey.scale(0.8));
	}

	// 6. Bottom Navigation & Countdown Footer (D-20, D-29, D-30)
	let isMidRun = matchSummary.state === STATE_CLEARED && !matchSummary.isGrandVictory;
	if (isMidRun) {
		let elapsedSec = Math.floor(getMsSinceStateChange() / 1000);
		let remainingSec = Math.max(0, 6 - elapsedSec);
		let navText = "NEXT LEVEL IN " + remainingSec + "s... [CLICK / SPACE TO ADVANCE]";
		let navPulse = 0.7 + 0.3 * Math.sin(frame / 6);
		drawTextWithOutline(navText, vec2(cx, H * 0.86), u * 0.82, colorSpark.scale(navPulse));
	} else {
		let navText = "[CLICK / SPACE] PLAY AGAIN   |   [ESC] TITLE SCREEN";
		let navPulse = 0.7 + 0.3 * Math.sin(frame / 10);
		drawTextWithOutline(navText, vec2(cx, H * 0.86), u * 0.82, colorWhite.scale(navPulse));
	}

	// All-Time Records Ticker at bottom (D-29)
	let rec =
		matchSummary.allTimeRecords ||
		(typeof g_apgManager !== "undefined" && g_apgManager ? g_apgManager.allTimeRecords : null);
	if (rec) {
		let mvpInfo = rec.mvp ? "@" + rec.mvp.user + " (" + rec.mvp.score + " pts)" : "None";
		let traitorInfo = rec.traitor ? "@" + rec.traitor.user + " (" + rec.traitor.score + " pts)" : "None";
		let ticker =
			"ALL-TIME: MVP " +
			mvpInfo +
			"  |  TRAITOR " +
			traitorInfo +
			"  |  RECORD: " +
			rec.goodWins +
			" GOOD - " +
			rec.badWins +
			" BAD";
		drawTextWithOutline(ticker, vec2(cx, H * 0.93), u * 0.62, colorBullet);
	}
}

function gameRenderPost() {
	// called after objects are rendered
	// draw effects or hud that appear above all objects
	scaleCameraToScreenSize();

	if (g_player) {
		let pos = vec2(0);

		mapMan.renderFOW();

		// scary transforms
		for (let i = 0; i < g_transforms.length; i++) {
			let trans = g_transforms[i];
			drawTile(trans.pos, vec2((60 - trans.life) / 6), trans.tileIndex, TILE_SIZE, colorWhite.scale(0.15));
			trans.life--;
			if (trans.life <= 0) {
				g_transforms.splice(i, 1);
				i--;
			}
		}

		// score texts
		// for (let i = 0; i < g_corpses.length; i++) {
		// 	g_corpses[i].postRender();
		// }

		// make sure UI can fit onto screen
		let scaleUI = min(1, overlayCanvas.width / (12 * cameraScale));

		pos = vec2(
			cameraPos.x - overlayCanvas.width / (cameraScale * 2) + 6 * scaleUI,
			cameraPos.y + overlayCanvas.height / (cameraScale * 2) - scaleUI
		);

		// UI background
		drawRect(pos, vec2(8, 2).scale(scaleUI), colorWhite.scale(0.4));

		// portrait
		let scaleX = frame % 240 > 200 ? -2 : 2;
		drawTile(
			vec2(pos.x - 5 * scaleUI, pos.y),
			vec2(scaleX, 2).scale(scaleUI),
			tileNumbers_facePlayer,
			TILE_SIZE,
			colorWhite.scale(0.7)
		);

		// 3-Heart / Golden Shield Pips above portrait (D-13, D-21, BAL-07)
		for (let i = 0; i < 4; i++) {
			let pipPos = vec2(pos.x - 5.7 * scaleUI + i * 0.65 * scaleUI, pos.y + 1.25 * scaleUI);
			let pipType = "empty";
			if (i < 3) {
				pipType = g_player.hp >= i + 1 ? "heart" : "empty";
			} else {
				pipType = g_player.hp >= 4 ? "armor" : "empty";
			}
			// Synchronized ~1.2Hz biological double-beat pulse while at 1 HP (D-05)
			let heartPulse = 0;
			if (i === 0 && g_player.hp === 1) {
				let cycle = frame % 50;
				if (cycle < 12) {
					heartPulse = 0.28 * Math.sin((cycle / 12) * Math.PI);
				} else if (cycle >= 14 && cycle < 24) {
					heartPulse = 0.16 * Math.sin(((cycle - 14) / 10) * Math.PI);
				}
			}
			let pipScale = scaleUI * (1 + heartPulse);
			uiDrawHeartPipWorld(pipPos, pipScale, pipType);
		}

		// total ammo
		const rectCol = colorWhite.scale(0.2, 1); //  new Color(0.2, 0.2, 0.2);
		const boxSize = vec2(1.5, 0.5).scale(scaleUI);
		drawRect(pos.subtract(vec2(3 * scaleUI, -0.6 * scaleUI)), boxSize, rectCol);
		drawRect(pos.subtract(vec2(3 * scaleUI, 0)), boxSize, rectCol);
		drawRect(pos.subtract(vec2(3 * scaleUI, 0.6 * scaleUI)), boxSize, rectCol);

		const iconSize = vec2(0.45).scale(scaleUI);
		drawTile(pos.subtract(vec2(3.5 * scaleUI, -0.6 * scaleUI)), iconSize, tileNumbers_bulletIcon, TILE_SIZE);
		drawTile(pos.subtract(vec2(3.5 * scaleUI, 0)), iconSize, tileNumbers_rifleAmmoIcon, TILE_SIZE);
		drawTile(pos.subtract(vec2(3.5 * scaleUI, 0.6 * scaleUI)), iconSize, tileNumbers_shellIcon, TILE_SIZE);

		const txtSize = 0.4 * scaleUI;
		const txtCol = colorWhite.scale(0.9); // new Color(0.9, 0.9, 0.9);
		const txtDx = 2.5 * scaleUI;
		let y = pos.y - 0.025;

		const bulletCapped = g_player.ammoBullets >= MAX_AMMO_BULLETS;
		const rifleCapped = g_player.ammoRifle >= MAX_AMMO_RIFLE;
		const shellCapped = g_player.ammoShells >= MAX_AMMO_SHELLS; // D-09: Triggers at 8 shells

		let activeGun = g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
		let isPistolActive = (activeGun !== tileNumbers_shotgun && activeGun !== tileNumbers_rifle);
		let isShotgunActive = (activeGun === tileNumbers_shotgun);
		let isRifleActive = (activeGun === tileNumbers_rifle);

		// D-01, D-02: Low-ammo threshold checks on equipped weapon
		let isLowBullets = isPistolActive && g_player.ammoBullets < 3;
		let isLowShells = isShotgunActive && g_player.ammoShells < 2;
		let isLowRifle = isRifleActive && g_player.ammoRifle < 2;

		// D-20: Pulse amber/red at ~5Hz
		const pulse = 0.5 + 0.5 * Math.sin(frame * 0.2);
		const pulseCol = new Color(1, 0.2 + 0.45 * pulse, 0.2);

		const bulletCol = bulletCapped ? colorSpark : isLowBullets ? pulseCol : txtCol;
		const rifleCol = rifleCapped ? colorSpark : isLowRifle ? pulseCol : txtCol;
		const shellCol = shellCapped ? colorSpark : isLowShells ? pulseCol : txtCol;

		drawText(g_player.ammoBullets, vec2(pos.x - txtDx, y + 0.6 * scaleUI), txtSize, bulletCol, -1, undefined, "right");
		drawText(g_player.ammoRifle, vec2(pos.x - txtDx, y), txtSize, rifleCol, -1, undefined, "right");
		drawText(g_player.ammoShells, vec2(pos.x - txtDx, y - 0.6 * scaleUI), txtSize, shellCol, -1, undefined, "right");

		if (bulletCapped) drawText("MAX", vec2(pos.x - txtDx + 0.55 * scaleUI, y + 0.6 * scaleUI), 0.28 * scaleUI, colorSpark);
		if (rifleCapped) drawText("MAX", vec2(pos.x - txtDx + 0.55 * scaleUI, y), 0.28 * scaleUI, colorSpark);
		if (shellCapped) drawText("MAX", vec2(pos.x - txtDx + 0.55 * scaleUI, y - 0.6 * scaleUI), 0.28 * scaleUI, colorSpark);

		// ammo
		if (g_player.gun) {
			for (let i = 0; i < g_player.gun._maxAmmo; i++) {
				drawTile(
					vec2(pos.x - 1.4 * scaleUI + i * 0.95 * scaleUI, pos.y),
					vec2(scaleUI),
					g_player.gun._ammoIconTile,
					TILE_SIZE,
					i + 1 > g_player.gun.ammo ? colorWhite.scale(0.2) : colorWhite
				);
			}
		}

		// score (middle-right, clear of top-right connection badge & Karma bar, HUD-02)
		drawTextWithOutline(
			g_score.toString(),
			vec2(overlayCanvas.width - 2 * cameraScale * scaleUI, overlayCanvas.height * 0.38),
			cameraScale * 2,
			colorBlood
		);
	}

	if (g_state == STATE_LOBBY) {
		renderLobbyHUD();
	}

	if (g_state == STATE_OUTCOME) {
		renderOutcomeHUD();
	}

	if (g_isPaused && g_state == STATE_PLAYING) {
		const W = mainCanvas.width;
		const H = mainCanvas.height;
		const cx = W / 2;
		const u = Math.max(12, Math.min(W, H) / 40);

		// Dimmed overlay
		uiDrawRectScreen(vec2(cx, H / 2), vec2(W, H), new Color(0, 0, 0, 0.75));

		// Pause Card
		const cardW = Math.min(W * 0.72, u * 26);
		const cardH = H * 0.52;
		uiDrawRectScreen(vec2(cx, H * 0.5), vec2(cardW + 4, cardH + 4), colorWhite.scale(0.3));
		uiDrawRectScreen(vec2(cx, H * 0.5), vec2(cardW, cardH), new Color(0.06, 0.06, 0.08, 0.95));

		// Pause Header
		drawTextWithOutline("GAME PAUSED", vec2(cx, H * 0.36), u * 1.6, colorBlood);

		// Resume Prompt / Button
		const resumeY = H * 0.47;
		drawTextWithOutline("[ RESUME ] (ESC / P)", vec2(cx, resumeY), u * 0.85, colorSpark);

		// Desktop Streamer Dashboard Button (D-13)
		const hasDesktopAPI = typeof window !== 'undefined' && (window.isDesktop || (window.electronAPI && window.electronAPI.openDashboard));
		if (hasDesktopAPI) {
			const dashY = H * 0.58;
			const btnW = Math.min(W * 0.55, u * 20);
			const btnH = u * 2.0;

			// Interactive button hover/click detection
			const mX = mousePosScreen ? mousePosScreen.x : (mousePos ? mousePos.x : 0);
			const mY = mousePosScreen ? mousePosScreen.y : (mousePos ? mousePos.y : 0);
			const hovered = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - dashY) < btnH / 2;

			uiDrawRectScreen(vec2(cx, dashY), vec2(btnW, btnH), hovered ? colorBullet.scale(0.4) : colorWhite.scale(0.12));
			drawTextWithOutline("★ OPEN APG DASHBOARD (D) ★", vec2(cx, dashY), u * 0.75, hovered ? colorSpark : colorWhite);

			if (hovered && mouseWasPressed(0)) {
				if (window.electronAPI && window.electronAPI.openDashboard) {
					window.electronAPI.openDashboard();
				}
			}
		}
	}

	textsDraw();

	// FADE THE SCREEN

	let ui_clearCol = new Color(...ui_clearColors[g_level % levelDefs.length]);

	let col = ui_clearCol.lerp(ui_fadeCol, ui_fade);

	let color = col.getHex();
	let alpha = col.a;

	if (ui_flashFrames > 0) {
		ui_flashFrames--;
		alpha = 0.5;
		color = ui_flashColor;
	}

	overlayContext.beginPath();
	overlayContext.rect(0, 0, mainCanvasSize.x, mainCanvasSize.y);
	overlayContext.globalAlpha = alpha;
	overlayContext.fillStyle = color;
	overlayContext.fill();
	overlayContext.globalAlpha = 1;

	//overlayContext.globalAlpha = 0.5;

	drawPushers();

	if (typeof g_apgManager !== "undefined" && g_apgManager) {
		g_apgManager.renderHUD();
	}

	if (typeof g_apgNetwork !== "undefined") {
		g_apgNetwork.renderBadge();
	}
}


function getNextEnemySpawnClass() {
	let chance = 0;
	let rando = rand();
	let type;
	for (let i = 0; i < g_levelDef.spawns.length; i++) {
		chance += g_levelDef.spawns[i].chance;
		if (rando <= chance) {
			type = g_levelDef.spawns[i].type;
			break;
		}
	}
	return type;
}

function generateMapFromLevel(level) {

	let mapToCopy = mapData[level];

	let newMap = {
		w: mapToCopy.h,
		h: mapToCopy.w,
		data: []
	};

	for (let y = 0; y < newMap.h; y++) {
		for (let x = 0; x < newMap.w; x++) {
			newMap.data[(newMap.w - 1 - x) + newMap.w * (newMap.h - 1 - y)] = mapToCopy.data[y + mapToCopy.w * x];
		}
	}

	mapData.push(newMap);

}

function getAmmoForGunType(gunType) {
	
	if (gunType == tileNumbers_rifle) {
		return tileNumbers_boxRifleAmmo;
	} else if (gunType == tileNumbers_shotgun) {
		return tileNumbers_boxShells;
	}
	
	return tileNumbers_boxBullets;
}
// THIS FILE IS GENERATED BY THE BUILD SCRIPT
let mapData = [];
mapData[0] = { w: 32, h: 20, data: [14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,15,15,15,14,14,14,14,14,14,14,14,14,14,14,14,11,11,11,11,11,11,,,,,,11,11,,,,11,,,,11,,,11,11,,,,11,11,11,11,11,11,11,11,,,,,,,,,,,,,,,1,,,,,,,,,,,,11,11,11,11,11,11,,,,10,10,10,,,,,,,,,,,,,,,,,,,,,11,11,11,11,,,,,,,,,,,,11,,,11,,,,11,,,,,,,11,,,11,11,11,11,,,,11,,,,,,,,,,,,,,,,,,11,,,,,,,,11,11,11,,,,,,,15,15,15,15,,,,,,,,,,,,,,,,,,,,11,11,11,,,,,,,15,,,,,,,,11,,,,11,,,,,,,,,,11,11,11,,,,,,,,15,22,,15,,,,,,,,,,,,,,11,,,,,,11,11,,,,,,,,15,15,15,15,,,,,,,,,,,,,,,,,11,,,11,11,,,11,,,,,,,,,,,,,11,,,,11,,,,,,,,,,,11,11,,,,,,,,,,,,,11,,,,,,,,,,11,,,,,,,,11,11,,,,,,,11,,,,,,,,,,,,,,,,,,,,,,,11,11,11,,,,,,,,,,,,,,,,11,,,,11,,,,,,11,,,,11,11,10,,,,10,10,10,10,10,,,11,,,,,,,,,,,,,,,,,,,11,11,10,,,,10,,,,10,,,,,,,,,,,,,,,,,,,11,15,12,15,11,10,,,,10,,14,9,10,,,,,,,,11,,,,11,,,,,,,11,15,22,15,11,10,,,,10,,10,10,10,,,,,,,,,,,,,,,11,,,11,11,15,15,15,11,10,9,16,9,10,,,,,,,,,11,,,,,,,,,11,11,11,11,11,11,11,11,11,11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,14,14,14,10,10,10,10,10,10,10,10,10,10,10,10] }; 
mapData[1] = { w: 20, h: 32, data: [15,15,15,15,11,11,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,11,,,,,,,,,,,11,15,,,9,,23,15,15,,,,1,,,,,,,,,15,,,,,,15,15,,,9,,,9,,,9,,,,15,,,,,,15,15,,,,,,,,,,,,,12,,,9,,,15,15,,,,,,17,,,,,,,15,15,15,15,15,15,15,15,,,,,,,,,,,,,,,,,,11,15,15,,,,,,,,,,,11,,,,,,,,15,15,,,9,,,9,,,9,,,,,,,,,,15,15,,,11,,,,,,,,,,,,,,,,15,15,,,,,,,,,,,,11,,,,,,,15,15,,,,,,,,,,,,,,,15,,,,15,15,,,,,10,10,10,10,10,,,,,,15,,,,15,15,11,,,,10,,,23,10,,,,,,15,,,,15,15,,,,,10,,10,9,10,,,,,,,,,11,15,15,,,,,10,,10,10,10,,,,,,,,,,15,15,,,,,10,,,,,,,,,,,,,,15,15,,,,,10,10,10,10,10,,,,,,,,,,15,15,,,,,,,,,,,,,9,,,9,,,15,15,,,,,,,,,,,,,,,,,,,15,15,,,11,,,,11,,,,,,,,,,,,15,15,,,,,,,,,,,,,,,,,,11,15,15,,,,,,,,,,,,,,,,11,11,15,15,15,15,15,15,15,15,15,12,15,,,,11,11,11,11,15,15,15,15,15,,,,,,,,15,,,,,,,11,11,15,15,15,15,,,9,,,,,15,,,,,,,,,11,11,15,15,,,9,,,,,15,,,,,,,,,,,15,15,,,,,,,,15,,,11,15,15,11,,,,,15,15,,,9,,,,,15,,,,,,,,,,,15,15,,23,9,,,,,12,,,,,,,,,,11,15,15,,,,,,,,15,,,,,,,,,11,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,11,11,15,15,15,15,15] }; 
mapData[2] = { w: 32, h: 20, data: [15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,,,,,,11,,,,,,,,,11,,,,,11,,,,,,,,,,,15,15,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,15,15,,,,,,,,11,,,,,,,,,,11,,,,9,,,9,,,24,,,15,15,,,,11,,,,,,,,11,,,,,,,,,,,,,9,,,9,,,15,15,,,,,,,,,,15,15,15,15,15,,,,,,,,,,,,,,11,,,15,15,,,,,,,,,11,15,24,,21,15,,15,15,,,15,,,,,,,,11,,,15,15,,,,,,,,,,15,,,,15,,,,,,15,,,,,9,,,,,,15,15,,,,,,,11,,,15,15,12,15,15,,,,,,,,,,,9,,,,,,15,15,,,11,,,,,,,,,,,,,,,,,,,,,,9,,,9,,,15,15,,,,,,,,,,,,,,,,,,,,,11,,,,,,,,,,15,15,,,,,,,,,,,,,,,1,,11,,,,,,,,,,,,,,15,15,,,9,9,,,9,9,,,,,,,,,11,,,,,,,9,9,,,9,,,15,15,,,,,,,,,,,15,15,15,,,,11,,,,,,,,,,,9,,,15,15,,,,,,,,,,,15,,,,,,,,,,,,,,,,,,,,15,15,,,,,,,,,,,15,,,,,,,,11,,5,,,,11,11,,,,,15,15,,,9,,,,9,9,,,15,15,15,15,,,,,,,,,,,,,,,,9,15,15,,24,,,,,,,,,,,,,,,,,,,,,,,,,,,,,15,15,,,,,11,,,,,,,,,,,11,,,,,,11,,,,,,,,,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15] }; 

init();
