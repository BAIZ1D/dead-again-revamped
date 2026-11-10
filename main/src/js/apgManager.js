/** @format */

function getMaxActiveMobs(lvl) {
	const levelIdx = typeof lvl === "number" ? lvl : typeof g_level !== "undefined" ? g_level : 0;
	if (levelIdx >= 5) {
		let wave = levelIdx - 4; // 1-indexed nightmare wave
		let base = typeof BASE_NIGHTMARE_MOBS !== "undefined" ? BASE_NIGHTMARE_MOBS : 25;
		let scale = typeof MOB_SCALING_PER_WAVE !== "undefined" ? MOB_SCALING_PER_WAVE : 3;
		let cap = typeof MAX_NIGHTMARE_MOBS !== "undefined" ? MAX_NIGHTMARE_MOBS : 40;
		return Math.min(cap, base + (wave - 1) * scale);
	}
	const caps = [15, 18, 20, 23, 25];
	return caps[clamp(levelIdx, 0, caps.length - 1)];
}
var MAX_ACTIVE_MOBS = 40;

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

		// Cheat-Sheet command trigger & flare tracking (HUD-05, D-13, D-15, D-18, D-33)
		this.commandLastTriggered = {};
		this.commandPulseFrames = {};
		this.cheatSheetFlare = { color: null, frames: 0, maxFrames: 0 };

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
		this.commandLastTriggered = {};
		this.commandPulseFrames = {};
		this.cheatSheetFlare = { color: null, frames: 0, maxFrames: 0 };
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
		this.commandLastTriggered = {};
		this.commandPulseFrames = {};
		this.cheatSheetFlare = { color: null, frames: 0, maxFrames: 0 };
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
		let action = String((data && data.action) || "").toLowerCase();
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		if (action && action !== "divine_flash" && (typeof g_state === "undefined" || g_state === STATE_PLAYING)) {
			this.commandPulseFrames[action] = 45; // D-13, D-15
		}

		if (typeof g_state === "undefined" || g_state !== STATE_PLAYING || !g_player || g_player.hp <= 0) return;

		if (action && action !== "divine_flash") {
			this.commandLastTriggered[action] = curFrame;
		}

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
			if (this.finalStand || livingBosses.length >= (typeof MAX_AUDIENCE_BOSSES !== "undefined" ? MAX_AUDIENCE_BOSSES : 5)) {
				if (livingBosses.length > 0) {
					for (let j = 0; j < livingBosses.length; j++) {
						let b = livingBosses[j];
						b.maxHp = (b.maxHp || 16) + 4;
						b.hp = min(b.maxHp, b.hp + 4);
						b._maxSpeed = (b._maxSpeed || 0.16) * 1.10;
						b.enrageMult = min(1.8, (b.enrageMult || 1.0) * 1.10);
						b.enrageStacks = (b.enrageStacks || 0) + 1;
						b.enraged = true;
					}
					if (typeof applyGlobalBossEnrage === "function") {
						applyGlobalBossEnrage();
					}
					this.addWorldPopup("[ALL BOSSES ENRAGED +4 HP!]", livingBosses[0].pos.add(vec2(0, 1.2)), colorSpark);
					this.addToast("[BAD] @" + tag + " unleashed GLOBAL BOSS ENRAGE!", "bad");
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
			this.triggerCheatSheetFlare("#FF4D4D", 30);
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
		this.triggerCheatSheetFlare("#FBF236", 30);
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

	triggerCheatSheetFlare(col, frames = 30) {
		this.cheatSheetFlare = { color: col, frames: frames, maxFrames: frames };
	}

	triggerAmbientFrenzy() {
		this.timers.slow = 0;
		// 360 frames (6.0s duration) without double speed stacking (D-08, D-14)
		this.timers.frenzy = Math.min(480, (this.timers.frenzy || 0) + 360);
		this.ambientFrenzyTimer = rand(2700, 3600) | 0;
		this.ambientTelegraphFired = false;
		this.triggerCheatSheetFlare("#FF4D4D", 30);

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
		if (typeof g_isPaused === "undefined" || !g_isPaused) {
			for (let cmd in this.commandPulseFrames) {
				if (this.commandPulseFrames[cmd] > 0) {
					this.commandPulseFrames[cmd]--;
				}
			}
			if (this.cheatSheetFlare && this.cheatSheetFlare.frames > 0) {
				this.cheatSheetFlare.frames--;
			}
		}

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

		let hasSubtext = !!(this.centerBanner.subtext && this.centerBanner.subtext.length > 0);
		// D-07: Dynamic container height: u * 2.4 single-line vs u * 3.4 dual-line
		let bannerH = hasSubtext ? u * 3.4 : u * 2.4;
		let bannerPos = vec2(cx, H * 0.22);

		// D-08: Measure required text width with monospace metric (~0.60 * fontSize) + safe 2.4u padding
		let baseHeadSize = u * 1.05;
		let baseSubSize = u * 0.64;
		let headText = this.centerBanner.text || "";
		let subText = this.centerBanner.subtext || "";

		let headW = headText.length * (baseHeadSize * 0.60);
		let subW = hasSubtext ? subText.length * (baseSubSize * 0.60) : 0;
		let reqContentW = Math.max(headW, subW);
		let padX = u * 2.4;
		let reqWidth = reqContentW + padX;

		// Maximum banner width up to 92% screen width (D-08)
		let maxBannerW = W * 0.92;
		let bannerW = Math.min(maxBannerW, Math.max(u * 26, reqWidth));

		// Responsive font downscaling for long text / long Twitch usernames exceeding maxBannerW
		let fontScale = 1.0;
		if (reqWidth > maxBannerW) {
			fontScale = Math.min(1.0, (maxBannerW - padX) / Math.max(1, reqContentW));
		}
		let headSize = baseHeadSize * fontScale;
		let subSize = baseSubSize * fontScale;

		// D-09: Faction-reactive border styling (colorSpark vs colorBlood)
		let isBad = (this.centerBanner.color === colorBlood ||
			headText.includes("BLOOD SURGE") ||
			headText.includes("⚠️"));
		let baseBorderCol = isBad ? colorBlood : (this.centerBanner.color || colorSpark);

		// D-10: Snappy arcade pulse & subtle shimmer
		let bPulse = 1 + 0.05 * Math.sin(frame / 4);
		let borderPulse = isBad
			? 0.82 + 0.18 * Math.sin(frame / 4)
			: 0.88 + 0.12 * Math.sin(frame / 3);
		let activeBorderCol = baseBorderCol.scale(borderPulse);

		// Dark background plate tinted with subtle faction undertone
		let bgCol = isBad
			? new Color(0.14, 0.02, 0.02, 0.94)
			: new Color(0.04, 0.05, 0.03, 0.94);

		// Arcade entrance snap (D-10)
		let maxF = this.centerBanner.maxFrames || 180;
		let curF = this.centerBanner.frames;
		let snapScale = 1.0;
		if (maxF - curF < 8) {
			let tSnap = clamp((maxF - curF) / 8, 0, 1);
			snapScale = 0.85 + 0.15 * tSnap;
		}

		// Draw border and background box
		uiDrawRectScreen(bannerPos, vec2(bannerW + 6, bannerH + 6), activeBorderCol);
		uiDrawRectScreen(bannerPos, vec2(bannerW, bannerH), bgCol);

		// D-07: Anchoring relative to bannerPos.y (-u*0.45 headline, +u*0.55 subtitle; center for single-line)
		if (hasSubtext) {
			let headY = bannerPos.y - u * 0.45;
			let subY = bannerPos.y + u * 0.55;
			drawTextWithOutline(headText, vec2(cx, headY), headSize * bPulse * snapScale, activeBorderCol, 2, colorBlack);
			drawTextWithOutline(subText, vec2(cx, subY), subSize, colorWhite, 2, colorBlack);
		} else {
			drawTextWithOutline(headText, bannerPos, headSize * bPulse * snapScale, activeBorderCol, 2, colorBlack);
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

	renderCheatSheet(W, H, u) {
		if (typeof g_cheatsheetSlideProgress === 'number' && g_cheatsheetSlideProgress <= 0.001) {
			return;
		}
		if (typeof g_state !== 'undefined' && (g_state === STATE_LOBBY || g_state === STATE_OUTCOME || g_state === STATE_DEAD)) {
			return;
		}
		if (typeof g_startHelpOpen !== 'undefined' && g_startHelpOpen) {
			return;
		}

		const slide = typeof g_cheatsheetSlideProgress === 'number' ? g_cheatsheetSlideProgress : 1.0;
		const isDockLeft = typeof g_cheatsheetDock !== 'undefined' && g_cheatsheetDock === 'left';

		const cardW = Math.round(W * 0.24);
		const cardH = Math.round(H * 0.24);
		const baseCardX = isDockLeft ? Math.round(W * 0.02) : Math.round(W * 0.74);
		const baseCardY = Math.round(H * 0.72);

		const slideOffsetY = Math.round((1 - slide) * 12);
		const cardX = baseCardX;
		const cardY = baseCardY + slideOffsetY;

		overlayContext.save();
		try {
			overlayContext.globalAlpha = Math.max(0, Math.min(1, slide));

			overlayContext.fillStyle = 'rgba(10, 14, 20, 0.75)';
			overlayContext.fillRect(cardX, cardY, cardW, cardH);

			let strokeColor = 'rgba(145, 70, 255, 0.45)';
			if (this.cheatSheetFlare && this.cheatSheetFlare.frames > 0) {
				const flareRatio = this.cheatSheetFlare.frames / (this.cheatSheetFlare.maxFrames || 30);
				strokeColor = this.cheatSheetFlare.color || '#FBF236';
				overlayContext.shadowColor = strokeColor;
				overlayContext.shadowBlur = 10 * flareRatio;
			}
			overlayContext.strokeStyle = strokeColor;
			overlayContext.lineWidth = 1;
			overlayContext.strokeRect(cardX, cardY, cardW, cardH);
			overlayContext.shadowBlur = 0;

			const headerH = Math.max(14, u * 1.1);
			overlayContext.fillStyle = 'rgba(20, 15, 35, 0.85)';
			overlayContext.fillRect(cardX, cardY, cardW, headerH);
			overlayContext.strokeStyle = 'rgba(145, 70, 255, 0.35)';
			overlayContext.strokeRect(cardX, cardY, cardW, headerH);

			const promptKey = (typeof g_lastInputGamepad !== 'undefined' && g_lastInputGamepad) ? '[SELECT]' : '[C]';
			const headerTitle = `TWITCH COMMANDS ${promptKey}`;
			overlayContext.font = `bold ${Math.max(9, u * 0.48)}px ${typeof fontDefault !== 'undefined' ? fontDefault : 'monospace'}`;
			overlayContext.textAlign = 'center';
			overlayContext.textBaseline = 'middle';
			overlayContext.fillStyle = '#E9D5FF';
			overlayContext.fillText(headerTitle, cardX + cardW / 2, cardY + headerH / 2);

			const bodyY = cardY + headerH;
			const bodyH = cardH - headerH;
			const dividerX = Math.round(cardX + cardW / 2);

			overlayContext.beginPath();
			overlayContext.strokeStyle = 'rgba(145, 70, 255, 0.35)';
			overlayContext.lineWidth = 1;
			overlayContext.moveTo(dividerX, bodyY);
			overlayContext.lineTo(dividerX, cardY + cardH);
			overlayContext.stroke();

			const goodCommands = [
				{ cmd: '!ammo', key: 'ammo', label: '+Primary Ammo' },
				{ cmd: '!barrier', key: 'barrier', label: '+Repel Rune' },
				{ cmd: '!repair', key: 'repair', label: '+Shield Pip' },
				{ cmd: '!slow', key: 'slow', label: '-50% Enemy Spd' },
				{ cmd: '!light', key: 'light', label: '+Arena Light' }
			];

			const badCommands = [
				{ cmd: '!mob', key: 'mob', label: '+Zombie Spawn' },
				{ cmd: '!boss', key: 'boss', label: '+Siege Boss' },
				{ cmd: '!jam', key: 'jam', label: 'Weapon Jam' },
				{ cmd: '!blackout', key: 'blackout', label: 'Darkness 8s' },
				{ cmd: '!frenzy', key: 'frenzy', label: 'Blood Frenzy' }
			];

			const rowH = bodyH / 5;
			const colW = (cardW - 4) / 2;

			const renderColumn = (items, startColX, isGood) => {
				const teamHex = isGood ? '#4ADE80' : '#FF4D4D';
				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					const entryY = bodyY + i * rowH;
					const pulseFrames = this.commandPulseFrames[item.key] || 0;
					const isPulsing = pulseFrames > 0;
					const pulseRatio = pulseFrames / 45;

					overlayContext.save();
					if (isPulsing) {
						const midX = startColX + colW / 2;
						const midY = entryY + rowH / 2;
						overlayContext.translate(midX, midY);
						overlayContext.scale(1.0 + 0.05 * pulseRatio, 1.0 + 0.05 * pulseRatio);
						overlayContext.translate(-midX, -midY);

						overlayContext.strokeStyle = teamHex;
						overlayContext.lineWidth = 1.2;
						overlayContext.shadowColor = teamHex;
						overlayContext.shadowBlur = 8 * pulseRatio;
						overlayContext.strokeRect(startColX + 2, entryY + 1, colW - 4, rowH - 2);
						overlayContext.shadowBlur = 0;
					}

					overlayContext.font = `bold ${Math.max(9, u * 0.48)}px ${typeof fontDefault !== 'undefined' ? fontDefault : 'monospace'}`;
					overlayContext.textAlign = 'left';
					overlayContext.textBaseline = 'top';
					overlayContext.fillStyle = teamHex;
					overlayContext.fillText(item.cmd, startColX + 6, entryY + 2);

					overlayContext.font = `${Math.max(7.5, u * 0.38)}px ${typeof fontDefault !== 'undefined' ? fontDefault : 'monospace'}`;
					overlayContext.fillStyle = 'rgba(255, 255, 255, 0.85)';
					overlayContext.fillText(item.label, startColX + 6, entryY + rowH * 0.52);

					overlayContext.restore();
				}
			};

			renderColumn(goodCommands, cardX + 1, true);
			renderColumn(badCommands, dividerX + 1, false);

		} finally {
			overlayContext.restore();
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
		this.renderCheatSheet(W, H, u);
	}
}

var g_apgManager = new APGManager();

