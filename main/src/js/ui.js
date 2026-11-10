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

function drawPixelSkull(ctx, cx, cy, size, pulseAlpha, mirror = false) {
	if (!ctx) return;
	ctx.save();
	ctx.translate(cx, cy);
	if (mirror) ctx.scale(-1, 1);
	let ps = size / 12;
	let ox = -size / 2;
	let oy = -size / 2;

	const skullRows = [
		"   XXXXXX   ",
		"  XXXXXXXX  ",
		" XXXXXXXXXX ",
		" XXXXXXXXXX ",
		" XXX..XX..XX",
		" XXX..XX..XX",
		"  XXXXXXXX  ",
		"   XXXXXX   ",
		"   XX..XX   ",
		"   XXXXXX   ",
		"   X.XX.X   ",
		"   XXXXXX   "
	];

	ctx.fillStyle = "#E0E0E0";
	for (let r = 0; r < 12; r++) {
		let row = skullRows[r];
		for (let c = 0; c < 12; c++) {
			if (row[c] === 'X') {
				ctx.fillRect(ox + c * ps, oy + r * ps, ps + 0.5, ps + 0.5);
			}
		}
	}

	let eyeAlpha = Math.max(0.2, Math.min(1.0, pulseAlpha));
	ctx.fillStyle = `rgba(255, 30, 30, ${eyeAlpha.toFixed(2)})`;
	ctx.shadowColor = "#FF0000";
	ctx.shadowBlur = 6;
	ctx.fillRect(ox + 3 * ps, oy + 4 * ps, 2 * ps, 2 * ps);
	ctx.fillRect(ox + 7 * ps, oy + 4 * ps, 2 * ps, 2 * ps);
	ctx.shadowBlur = 0;
	ctx.restore();
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

	// 2. Header: Nightmare Wave or Campaign Level (D-03, D-21, D-22, CLIP-05)
	let isNightmareLobby = (typeof g_level !== "undefined" && g_level >= 5);
	let headerText = isNightmareLobby
		? "NIGHTMARE WAVE " + (g_level - 4) + ": Will streamer survive?"
		: "LEVEL " + (g_level + 1) + ": WILL CHAT BE GOOD OR BAD?";
	const baseHeaderSize = Math.min(u * 1.45, W / 24);
	const headerFontScale = Math.min(1.0, (cardW - u * 1.6) / Math.max(1, headerText.length * (baseHeaderSize * 0.60)));
	const headerSize = baseHeaderSize * headerFontScale;

	if (isNightmareLobby) {
		let bannerW = Math.min(cardW - u * 2, headerText.length * (headerSize * 0.58) + u * 6);
		let bannerH = headerSize * 1.8;
		let bannerY = H * 0.17;
		uiDrawRectScreen(vec2(cx, bannerY), vec2(bannerW + 6, bannerH + 6), new Color(121 / 255, 33 / 255, 56 / 255, 0.95));
		uiDrawRectScreen(vec2(cx, bannerY), vec2(bannerW, bannerH), new Color(86 / 255, 0 / 255, 57 / 255, 0.95));

		drawTextWithOutline(headerText, vec2(cx, bannerY), headerSize, colorWhite);

		let pulseAlpha = 0.5 + 0.5 * Math.sin(frame / 10);
		let skullSize = Math.min(u * 2.2, bannerH * 0.75);
		let skullLeftX = cx - bannerW * 0.45;
		let skullRightX = cx + bannerW * 0.45;
		drawPixelSkull(overlayContext, skullLeftX, bannerY, skullSize, pulseAlpha, false);
		drawPixelSkull(overlayContext, skullRightX, bannerY, skullSize, pulseAlpha, true);
	} else {
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
	}

	// 3. Poll Mode Subtitle Pill (D-22)
	const isHelix = pred.mode === "helix";
	const modeText = isHelix
		? "★ TWITCH CHANNEL POINTS + CHAT POLL (!good / !bad)"
		: "● LIVE CHAT POLL — TYPE !good OR !bad IN CHAT";
	drawTextWithOutline(modeText, vec2(cx, H * 0.24), u * 0.78, isHelix ? colorSpark : colorBullet);

	// 4. Large Countdown Timer or 2-Second Lock Splash (PRED-02, D-06, D-22, CLIP-05, D-03)
	const goodPct = clamp(typeof pred.goodPct === "number" ? pred.goodPct : 50, 0, 100);
	const badPct = 100 - goodPct;

	if (pred.status === "LOCKED") {
		const lockText = "VOTES LOCKED: " + goodPct + "% GOOD vs " + badPct + "% BAD";
		const baseLockSize = u * 1.35;
		const measuredW = overlayContext && overlayContext.measureText ? overlayContext.measureText(lockText).width : 0;
		const textW = Math.max(measuredW, lockText.length * baseLockSize * 0.60);
		const maxBannerW = Math.min(W * 0.88, cardW - u * 1.2);
		const bannerW = Math.min(maxBannerW, Math.max(u * 26, textW + u * 2.4));
		const fontScale = Math.min(1.0, (bannerW - u * 1.6) / Math.max(1, textW));
		uiDrawRectScreen(vec2(cx, H * 0.34), vec2(bannerW + 4, u * 2.4 + 4), colorSpark);
		uiDrawRectScreen(vec2(cx, H * 0.34), vec2(bannerW, u * 2.4), new Color(0.15, 0.05, 0.05, 0.95));
		drawTextWithOutline(lockText, vec2(cx, H * 0.34), baseLockSize * fontScale, colorSpark);
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

	// 6. Dual Team Roster Columns (D-22, CLIP-05, D-04)
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
			const voterName = goodVoters[i];
			const voterFontScale = Math.min(1.0, (colW - u * 0.6) / Math.max(1, ("+ @" + voterName).length * (u * 0.68 * 0.60)));
			drawTextWithOutline("+ @" + voterName, vec2(leftColX, H * 0.62 + i * (u * 0.85)), u * 0.68 * voterFontScale, colorWhite);
		}
	}

	if (badVoters.length === 0) {
		drawTextWithOutline("Waiting for !bad votes...", vec2(rightColX, H * 0.64), u * 0.66, colorGrey);
	} else {
		for (let i = 0; i < badVoters.length; i++) {
			const voterName = badVoters[i];
			const voterFontScale = Math.min(1.0, (colW - u * 0.6) / Math.max(1, ("+ @" + voterName).length * (u * 0.68 * 0.60)));
			drawTextWithOutline("+ @" + voterName, vec2(rightColX, H * 0.62 + i * (u * 0.85)), u * 0.68 * voterFontScale, colorWhite);
		}
	}

	// 7. Bottom Command Cheat-Sheet & Quick-Lock Prompt (D-04, D-22, CLIP-05)
	const cheatText = "GOOD: !ammo !repair !light !slow !barrier   |   BAD: !mob !boss !blackout !jam !frenzy";
	const cheatFontScale = Math.min(1.0, (cardW - u * 1.6) / Math.max(1, cheatText.length * (u * 0.70 * 0.60)));
	drawTextWithOutline(cheatText, vec2(cx, H * 0.82), u * 0.70 * cheatFontScale, colorBullet);

	const promptAlpha = 0.82 + 0.18 * Math.sin(frame / 12);
	const promptText = "Chat: !good or !bad   |   Streamer: [SPACE] or [RIGHT-CLICK] Lock Votes & Start Now";
	const promptFontScale = Math.min(1.0, (cardW - u * 1.6) / Math.max(1, promptText.length * (u * 0.78 * 0.60)));
	drawTextWithOutline(promptText, vec2(cx, H * 0.88), u * 0.78 * promptFontScale, colorSpark.scale(promptAlpha));
}

function renderNightmareTelemetryPlate(W, H, u) {
	if (typeof g_level === "undefined" || g_level < 5 || (typeof g_state !== "undefined" && g_state !== STATE_PLAYING)) return;
	if (typeof overlayContext === "undefined" || !overlayContext) return;

	overlayContext.save();
	let plateX = W * 0.38;
	let plateW = W * 0.24;
	let plateY = H * 0.02;
	let plateH = H * 0.06;

	overlayContext.fillStyle = "rgba(30, 0, 10, 0.85)";
	overlayContext.fillRect(plateX, plateY, plateW, plateH);
	overlayContext.strokeStyle = "#792138";
	overlayContext.lineWidth = 1.6;
	overlayContext.strokeRect(plateX, plateY, plateW, plateH);

	let curWave = g_level - 4;
	let waveText = "NIGHTMARE WAVE " + curWave;

	let totalSec = Math.floor((typeof g_nightmareSurvivalFrames !== "undefined" ? g_nightmareSurvivalFrames : 0) / 60);
	let mins = Math.floor(totalSec / 60);
	let secs = totalSec % 60;
	let clockText = (mins < 10 ? "0" + mins : "" + mins) + ":" + (secs < 10 ? "0" + secs : "" + secs);

	let mobAlive = typeof g_enemies !== "undefined" ? g_enemies.length : 0;
	let mobCap = typeof getMaxActiveMobs === "function" ? getMaxActiveMobs(g_level) : 40;
	let mobText = "MOBS: " + mobAlive + "/" + mobCap;

	let textY = plateY + plateH * 0.62;
	let fontSize = Math.max(10, Math.min(u * 0.62, plateH * 0.42));

	overlayContext.font = "bold " + fontSize + "px " + fontDefault;
	overlayContext.textBaseline = "middle";

	overlayContext.textAlign = "left";
	overlayContext.fillStyle = "#FBF236";
	overlayContext.fillText(waveText, plateX + 10, textY);

	overlayContext.textAlign = "center";
	overlayContext.fillStyle = "#FFFFFF";
	overlayContext.fillText(clockText, plateX + plateW * 0.52, textY);

	overlayContext.textAlign = "right";
	overlayContext.fillStyle = mobAlive >= mobCap ? "#AC3232" : "#999999";
	overlayContext.fillText(mobText, plateX + plateW - 10, textY);

	overlayContext.restore();
}

function renderNightmareDefeatHUD(W, H, cx, u, matchSummary) {
	// 1. Dark Vignette Overlay & Pulsing Crimson Border
	uiDrawRectScreen(vec2(cx, H / 2), vec2(W, H), new Color(0.04, 0.01, 0.02, 0.88));
	let pulseAlpha = 0.5 + 0.3 * Math.sin(frame / 8);
	let borderCol = colorBlood.scale(pulseAlpha);
	uiDrawRectScreen(vec2(cx, 3), vec2(W, 6), borderCol);
	uiDrawRectScreen(vec2(cx, H - 3), vec2(W, 6), borderCol);
	uiDrawRectScreen(vec2(3, H / 2), vec2(6, H), borderCol);
	uiDrawRectScreen(vec2(W - 3, H / 2), vec2(6, H), borderCol);

	// 2. Animated 'DEAD AGAIN' Header with Chromatic Drip & Pulse (D-06, D-40)
	let headerPulse = 1.0 + 0.05 * Math.sin(frame / 20);
	let headerY = H * 0.10;
	let headerSize = u * 2.2 * headerPulse;
	const headerText = "DEAD AGAIN";

	// Chromatic drip offsets
	drawTextWithOutline(headerText, vec2(cx - 3, headerY), headerSize, colorBlood);
	drawTextWithOutline(headerText, vec2(cx + 3, headerY), headerSize, new Color(121 / 255, 33 / 255, 56 / 255));
	drawTextWithOutline(headerText, vec2(cx, headerY), headerSize, colorWhite);

	let subtext = "SURVIVAL TERMINATED — THE NIGHTMARE GAUNTLET PREVAILED";
	drawTextWithOutline(subtext, vec2(cx, headerY + u * 1.3), u * 0.72, colorBlood);

	// 3. Central Telemetry Card
	let cardW = Math.min(W * 0.76, u * 28);
	let cardH = H * 0.44;
	let cardY = H * 0.48;
	uiDrawRectScreen(vec2(cx, cardY), vec2(cardW + 4, cardH + 4), new Color(121 / 255, 33 / 255, 56 / 255, 0.8));
	uiDrawRectScreen(vec2(cx, cardY), vec2(cardW, cardH), new Color(0.08, 0.02, 0.04, 0.95));

	drawTextWithOutline("— NIGHTMARE SURVIVAL REPORT —", vec2(cx, cardY - cardH * 0.40), u * 0.85, colorSpark);

	let waveNum = Math.max(1, (matchSummary.nightmareWave || (matchSummary.level - 5)));
	let totalSec = Math.floor((typeof g_nightmareSurvivalFrames !== "undefined" ? g_nightmareSurvivalFrames : 0) / 60);
	let mins = Math.floor(totalSec / 60);
	let secs = totalSec % 60;
	let clockStr = (mins < 10 ? "0" + mins : "" + mins) + ":" + (secs < 10 ? "0" + secs : "" + secs);

	let bestW = (typeof getNightmareBestWave === "function") ? getNightmareBestWave() : parseInt(safeGetPref('da_nightmare_best_wave', '0'), 10) || 0;
	let isRecord = waveNum >= bestW && waveNum > 0;

	let row1 = "WAVES SURVIVED: " + (waveNum - 1) + "  |  TOTAL KILLS: " + (typeof g_score !== "undefined" ? g_score : 0);
	drawTextWithOutline(row1, vec2(cx, cardY - cardH * 0.22), u * 0.78, colorWhite);

	let row2 = "SURVIVAL TIME: " + clockStr + "  |  BEST RECORD: WAVE " + bestW;
	drawTextWithOutline(row2, vec2(cx, cardY - cardH * 0.06), u * 0.75, colorBullet);

	if (isRecord) {
		drawTextWithOutline("★ NEW PERSONAL BEST RECORD! ★", vec2(cx, cardY + cardH * 0.10), u * 0.82, colorSpark);
	}

	let mvpBadName = matchSummary.mvpBad ? "@" + matchSummary.mvpBad.user : "None";
	let mvpGoodName = matchSummary.mvpGood ? "@" + matchSummary.mvpGood.user : "None";
	let row3 = "PUBLIC ENEMY: " + mvpBadName + "  |  GUARDIAN: " + mvpGoodName;
	drawTextWithOutline(row3, vec2(cx, cardY + cardH * 0.26), u * 0.68, colorGrey);

	if (matchSummary.causeOfDeath) {
		drawTextWithOutline(matchSummary.causeOfDeath, vec2(cx, cardY + cardH * 0.38), u * 0.62, colorBlood);
	}

	// 4. Safe Lower-Center Bounds [0.35W, 0.65W] x [0.78H, 0.90H] Buttons (D-41, D-42)
	let btnW = W * 0.30;
	let btnH = H * 0.052;
	let btn1Y = H * 0.805;
	let btn2Y = H * 0.875;

	let selIdx = typeof g_defeatSelectedButton !== "undefined" ? g_defeatSelectedButton : 0;

	// Button 1: [ RESTART CAMPAIGN ]
	let isBtn1Sel = (selIdx === 0);
	uiDrawRectScreen(vec2(cx, btn1Y), vec2(btnW + 4, btnH + 4), isBtn1Sel ? colorSpark : new Color(0.2, 0.2, 0.2));
	uiDrawRectScreen(vec2(cx, btn1Y), vec2(btnW, btnH), isBtn1Sel ? new Color(0.25, 0.05, 0.05, 0.95) : new Color(0.08, 0.08, 0.1, 0.9));
	let btn1Text = (isBtn1Sel ? "► [ RESTART CAMPAIGN ]" : "[ RESTART CAMPAIGN ]");
	drawTextWithOutline(btn1Text, vec2(cx, btn1Y), u * 0.75, isBtn1Sel ? colorSpark : colorWhite);

	// Button 2: [ MAIN MENU ]
	let isBtn2Sel = (selIdx === 1);
	uiDrawRectScreen(vec2(cx, btn2Y), vec2(btnW + 4, btnH + 4), isBtn2Sel ? colorSpark : new Color(0.2, 0.2, 0.2));
	uiDrawRectScreen(vec2(cx, btn2Y), vec2(btnW, btnH), isBtn2Sel ? new Color(0.25, 0.05, 0.05, 0.95) : new Color(0.08, 0.08, 0.1, 0.9));
	let btn2Text = (isBtn2Sel ? "► [ MAIN MENU ]" : "[ MAIN MENU ]");
	drawTextWithOutline(btn2Text, vec2(cx, btn2Y), u * 0.75, isBtn2Sel ? colorSpark : colorGrey);
}

function renderOutcomeHUD(inW, inH, inCx, inU) {
	let matchSummary = typeof g_apgManager !== "undefined" && g_apgManager ? g_apgManager.matchSummary : null;
	if (!matchSummary) return;

	const W = inW || (typeof mainCanvasSize !== "undefined" ? mainCanvasSize.x : typeof overlayCanvas !== "undefined" ? overlayCanvas.width : 800);
	const H = inH || (typeof mainCanvasSize !== "undefined" ? mainCanvasSize.y : typeof overlayCanvas !== "undefined" ? overlayCanvas.height : 600);
	const cx = inCx || W / 2;
	const u = inU || Math.max(12, Math.min(W, H) / 40);

	// Check for Nightmare Defeat Screen (D-06, D-40, D-41, D-42)
	let isNightmareDefeat = matchSummary.state === STATE_DEAD && ((typeof g_level !== "undefined" && g_level >= 5) || matchSummary.level > 5);
	if (isNightmareDefeat) {
		renderNightmareDefeatHUD(W, H, cx, u, matchSummary);
		return;
	}

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

		pos.x = cameraPos.x - overlayCanvas.width / (cameraScale * 2) + 6.5 * scaleUI;
		pos.y = cameraPos.y + overlayCanvas.height / (cameraScale * 2) - scaleUI;

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

		// 3-Heart / Golden Shield Pips relocated beneath avatar portrait (HUD-04, CLIP-04, D-01, D-02, D-04, D-05, D-06)
		const platePos = vec2(pos.x - 5.0 * scaleUI, pos.y - 1.35 * scaleUI);
		const plateSize = vec2(2.4, 0.65).scale(scaleUI);

		// Armored backing plate (D-04)
		drawRect(platePos, plateSize, new Color(0, 0, 0, 0.45));

		// 1 HP critical danger red-ghosting highlight beneath avatar (D-05)
		if (g_player.hp === 1) {
			let ghostPulse = 0.25 + 0.15 * Math.sin(frame * 0.2);
			drawRect(platePos, plateSize.add(vec2(0.1 * scaleUI)), colorBlood.scale(ghostPulse));
		}

		const pipStartX = pos.x - (5.975 * scaleUI - 0.195 * scaleUI);
		const pipPitch = 0.52 * scaleUI;
		for (let i = 0; i < 4; i++) {
			// Centered horizontally across X in [pos.x - 5.78 * scaleUI, pos.x - 4.22 * scaleUI] (CLIP-04, D-01, D-02, D-04)
			let pipPos = vec2(pipStartX + i * pipPitch, pos.y - 1.35 * scaleUI);
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
			const maxAmmo = g_player.gun._maxAmmo;
			const curAmmo = g_player.gun.ammo;
			const iconTile = g_player.gun._ammoIconTile;

			if (maxAmmo > 6) {
				// D-01, D-02: Compact 2x10 wrapped grid for high-capacity weapons (Machine Pistol / SMG)
				// col = i % 10, row = Math.floor(i / 10): Row 0 = top, Row 1 = bottom
				const bulletScale = vec2(0.52 * scaleUI);
				const startX = pos.x - 1.45 * scaleUI;
				const pitchX = 0.50 * scaleUI;
				const pitchY = 0.54 * scaleUI;

				for (let i = 0; i < maxAmmo; i++) {
					const col = i % 10;
					const row = Math.floor(i / 10);
					const bulletPos = vec2(
						startX + col * pitchX,
						pos.y + 0.27 * scaleUI - row * pitchY
					);
					// D-03: Spent chambered rounds dim to 20% opacity right-to-left, bottom-to-top
					// Rounds 19..10 (bottom row) dim first right-to-left, then rounds 9..0 (top row)
					const isSpent = (i + 1) > curAmmo;
					const bulletColor = isSpent ? colorWhite.scale(0.2) : colorWhite;
					drawTile(bulletPos, bulletScale, iconTile, TILE_SIZE, bulletColor);
				}
			} else {
				// D-02: Low-capacity weapons (Pistol <= 6, Shotgun = 2, Rifle = 4) retain single-row large icon layout
				for (let i = 0; i < maxAmmo; i++) {
					drawTile(
						vec2(pos.x - 1.4 * scaleUI + i * 0.95 * scaleUI, pos.y),
						vec2(scaleUI),
						iconTile,
						TILE_SIZE,
						i + 1 > curAmmo ? colorWhite.scale(0.2) : colorWhite
					);
				}
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
		const cy = H / 2;
		const u = Math.max(12, Math.min(W, H) / 40);
		const { safeW, safeH } = typeof getStartScreenSafeZone === 'function' ? getStartScreenSafeZone(W, H) : { safeW: W, safeH: H };

		if (typeof g_startHelpOpen !== 'undefined' && g_startHelpOpen && typeof renderStartScreenHelpManual === 'function') {
			renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH);
		} else {
			// Dimmed overlay
			uiDrawRectScreen(vec2(cx, H / 2), vec2(W, H), new Color(0, 0, 0, 0.75));

			// Pause Card
			const cardW = Math.min(W * 0.72, u * 26);
			const cardH = H * 0.72;
			uiDrawRectScreen(vec2(cx, H * 0.5), vec2(cardW + 4, cardH + 4), colorWhite.scale(0.3));
			uiDrawRectScreen(vec2(cx, H * 0.5), vec2(cardW, cardH), new Color(0.06, 0.06, 0.08, 0.95));

			// Pause Header
			drawTextWithOutline("GAME PAUSED", vec2(cx, H * 0.35), u * 1.5, colorBlood);

			// Resume Prompt / Button
			const resumeY = H * 0.44;
			drawTextWithOutline("[ RESUME ] (ESC / P)", vec2(cx, resumeY), u * 0.80, colorSpark);

			// Survivor Field Manual Button (CLIP-06, D-08)
			const manualY = H * 0.50;
			const mBtnW = Math.min(W * 0.55, u * 20);
			const mBtnH = u * 1.8;
			const btnW = mBtnW;
			const btnH = mBtnH;
			const mX = (typeof mousePosScreen !== 'undefined' && mousePosScreen) ? mousePosScreen.x : -1;
			const mY = (typeof mousePosScreen !== 'undefined' && mousePosScreen) ? mousePosScreen.y : -1;
			const manualHover = Math.abs(mX - cx) < mBtnW / 2 && Math.abs(mY - manualY) < mBtnH / 2;
			uiDrawRectScreen(vec2(cx, manualY), vec2(mBtnW, mBtnH), manualHover ? colorBullet.scale(0.4) : colorWhite.scale(0.12));
			drawTextWithOutline("[H] SURVIVOR FIELD MANUAL", vec2(cx, manualY), u * 0.75, manualHover ? colorSpark : colorWhite);
			if (manualHover && mouseWasPressed(0)) {
				uiSound(1);
				g_startHelpOpen = true;
			}

			// Button 1: [C] CHEAT-SHEET: [ON / OFF] (D-23)
			const csY = H * 0.56;
			const csHover = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - csY) < btnH / 2;
			uiDrawRectScreen(vec2(cx, csY), vec2(btnW, btnH), csHover ? colorBullet.scale(0.4) : colorWhite.scale(0.12));
			const csStatus = (typeof g_cheatsheetVisible !== 'undefined' && g_cheatsheetVisible) ? "ON" : "OFF";
			drawTextWithOutline(`[C] CHEAT-SHEET: [${csStatus}]`, vec2(cx, csY), u * 0.75, csHover ? colorSpark : (csStatus === "ON" ? colorZombie : colorGrey));
			if (csHover && mouseWasPressed(0)) {
				g_cheatsheetVisible = !g_cheatsheetVisible;
				if (typeof safeSetPref === 'function') safeSetPref('da_cheatsheet_visible', g_cheatsheetVisible ? '1' : '0');
				uiSound(1);
			}

			// Button 2: [DOCK: RIGHT / LEFT] (D-23)
			const dockY = H * 0.62;
			const dockHover = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - dockY) < btnH / 2;
			uiDrawRectScreen(vec2(cx, dockY), vec2(btnW, btnH), dockHover ? colorBullet.scale(0.4) : colorWhite.scale(0.12));
			const dockSide = (typeof g_cheatsheetDock !== 'undefined' ? g_cheatsheetDock : 'right').toUpperCase();
			drawTextWithOutline(`[DOCK: ${dockSide}]`, vec2(cx, dockY), u * 0.75, dockHover ? colorSpark : colorWhite);
			if (dockHover && mouseWasPressed(0)) {
				g_cheatsheetDock = g_cheatsheetDock === 'right' ? 'left' : 'right';
				if (typeof safeSetPref === 'function') safeSetPref('da_cheatsheet_dock', g_cheatsheetDock);
				uiSound(1);
			}

			// Button 3: [ QUIT TO MAIN MENU ] (D-23, D-24)
			const quitY = H * 0.68;
			const quitHover = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - quitY) < btnH / 2;
			uiDrawRectScreen(vec2(cx, quitY), vec2(btnW, btnH), quitHover ? colorBlood.scale(0.4) : colorWhite.scale(0.12));
			drawTextWithOutline("[ QUIT TO MAIN MENU ]", vec2(cx, quitY), u * 0.75, quitHover ? colorSpark : colorBlood);
			if (quitHover && mouseWasPressed(0)) {
				uiSound(1);
				if (typeof abandonRunToMainMenu === 'function') {
					abandonRunToMainMenu();
				}
			}

			// Button 4: [RESET HIGH SCORES] with two-click confirmation (D-49)
			const resetY = H * 0.74;
			const resetHover = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - resetY) < btnH / 2;
			if (typeof g_resetHighScoreConfirmTimer !== "undefined" && g_resetHighScoreConfirmTimer > 0) {
				g_resetHighScoreConfirmTimer--;
			}
			const isConfirming = (typeof g_resetHighScoreConfirmTimer !== "undefined" && g_resetHighScoreConfirmTimer > 0);
			uiDrawRectScreen(vec2(cx, resetY), vec2(btnW, btnH), resetHover ? colorBlood.scale(0.5) : colorWhite.scale(0.12));
			const resetText = isConfirming ? "⚠ CONFIRM RESET HIGH SCORES? ⚠" : "[ RESET HIGH SCORES ]";
			drawTextWithOutline(resetText, vec2(cx, resetY), u * 0.72, isConfirming ? colorSpark : (resetHover ? colorBlood : colorWhite));
			if (resetHover && mouseWasPressed(0)) {
				uiSound(1);
				if (isConfirming) {
					if (typeof safeSetPref === 'function') {
						safeSetPref('da_nightmare_best_wave', '0');
						safeSetPref('da_nightmare_best_time', '0');
						safeSetPref('da_high_score', '0');
					}
					try { if (typeof localStorage !== 'undefined') localStorage.da_t = 0; } catch (e) {}
					g_resetHighScoreConfirmTimer = 0;
				} else {
					g_resetHighScoreConfirmTimer = 300; // 5s to confirm
				}
			}

			// Desktop Streamer Dashboard Button (D-13)
			const hasDesktopAPI = typeof window !== 'undefined' && (window.isDesktop || (window.electronAPI && window.electronAPI.openDashboard));
			if (hasDesktopAPI) {
				const dashY = H * 0.80;

				// Interactive button hover/click detection
				const hovered = Math.abs(mX - cx) < btnW / 2 && Math.abs(mY - dashY) < btnH / 2;

				uiDrawRectScreen(vec2(cx, dashY), vec2(btnW, btnH), hovered ? colorBullet.scale(0.4) : colorWhite.scale(0.12));
				drawTextWithOutline("★ OPEN APG DASHBOARD (D) ★", vec2(cx, dashY), u * 0.75, hovered ? colorSpark : colorWhite);

				if (hovered && mouseWasPressed(0)) {
					uiSound(1);
					if (window.electronAPI && window.electronAPI.openDashboard) {
						window.electronAPI.openDashboard();
					}
				}
			}
		}
	}

	// Render Nightmare Top-Center Telemetry Plate (D-16)
	let uPlate = Math.max(12, Math.min(mainCanvas.width, mainCanvas.height) / 40);
	renderNightmareTelemetryPlate(mainCanvas.width, mainCanvas.height, uPlate);

	// Render Personal Best Flare Banner (D-17)
	if (typeof g_newPersonalBestBanner !== "undefined" && g_newPersonalBestBanner && g_newPersonalBestBanner.timer > 0) {
		g_newPersonalBestBanner.timer--;
		let bannerPulse = 1.0 + 0.08 * Math.sin(frame * 0.2);
		drawTextWithOutline(g_newPersonalBestBanner.text, vec2(mainCanvas.width / 2, mainCanvas.height * 0.15), uPlate * 1.05 * bannerPulse, colorSpark);
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
