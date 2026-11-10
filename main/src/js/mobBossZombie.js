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

		// Phase 23: 8-second wall tearing throttle (480 frames) and enrage tracking (D-14, D-15)
		this.wallTearCooldown = 0;
		this.enrageStacks = 0;
	}

	update() {
		if (g_state == STATE_DEAD) return;

		if (this.wallTearCooldown > 0) {
			this.wallTearCooldown--;
		}

		// Bulldozer parting field: lateral outward impulse within 2.5 tiles (D-58)
		if (typeof g_enemies !== "undefined" && g_enemies) {
			for (let i = 0; i < g_enemies.length; i++) {
				let m = g_enemies[i];
				if (m && m !== this && !(m instanceof BossZombie) && m.hp > 0 && m.pos) {
					let d = this.pos.distance(m.pos);
					if (d < 2.5 && d > 0.01) {
						let moveDir = this.velocity && (this.velocity.x || this.velocity.y) ? this.velocity.normalize() : vec2(0, 1);
						let perp = vec2(-moveDir.y, moveDir.x);
						let toMinion = m.pos.subtract(this.pos);
						let side = toMinion.dot(perp) >= 0 ? 1 : -1;
						let impulse = perp.scale(side * 0.12 * (1 - d / 2.5));
						if (typeof m.applyForce === "function") {
							m.applyForce(impulse);
						} else if (m.velocity) {
							m.velocity = m.velocity.add(impulse);
						}
					}
				}
			}
		}

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
		// Enrage aura (D-14)
		if (this.enrageStacks > 0 || this.enraged) {
			let curFrame = typeof frame !== "undefined" ? frame : 0;
			let auraAlpha = 0.35 + 0.15 * Math.sin(curFrame / 6);
			drawRect(this.pos, this.size.scale(1.25), new Color(1, 0, 0, auraAlpha));
		}

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
		if (this.tearing) return true;
		// no wall tearing while frozen in a spawn portal or holy-stunned (D-07, D-15)
		if (this.spawnTelegraphFrames > 0 || this.stunFrames > 0) return true;

		// 8-second wall tearing throttle (480 frames) per D-15
		if (this.wallTearCooldown > 0) return true;

		// Perimeter boundary walls are strictly immune to boss tearing per D-15
		let mapW = typeof tileLayer !== "undefined" && tileLayer ? tileLayer.size.x : (typeof mapData !== "undefined" && typeof g_levelDef !== "undefined" && mapData[g_levelDef.map] ? mapData[g_levelDef.map].w : 100);
		let mapH = typeof tileLayer !== "undefined" && tileLayer ? tileLayer.size.y : (typeof mapData !== "undefined" && typeof g_levelDef !== "undefined" && mapData[g_levelDef.map] ? mapData[g_levelDef.map].h : 100);
		if (pos.x <= 0 || pos.y <= 0 || pos.x >= mapW - 1 || pos.y >= mapH - 1) {
			return true;
		}

		// tearing out a door counts as breaking it, keep the registry in sync (D-02)
		if (tileData == tileNumbers_door) {
			let idx = Math.floor(pos.x) + "_" + Math.floor(pos.y);
			let door = typeof g_doors !== "undefined" ? g_doors[idx] : null;
			if (door) {
				door.hp = 0;
				door.broken = true;
			}
		}

		if (pos.x > 0 && pos.y > 0 && pos.x < mapW - 1 && pos.y < mapH - 1) {
			if (typeof tileLayer !== "undefined" && tileLayer) {
				tileLayer.setData(pos, 0, true);
			}
			if (typeof setTileCollisionData === "function") {
				setTileCollisionData(pos, 0);
			}
		}

		this.tearing = true;
		this.wallTearCooldown = 480; // 8-second throttle (480 frames at 60 FPS) per D-15
		this.soundTearing.play(this.pos);

		// tear out chunk
		this.boulder = new Boulder(this.pos.copy(), tileData);

		this.tearingTimer = new Timer(1);

		return true;
	}
}

/**
 * Returns active living boss count in current room (D-14).
 */
function getActiveBossCount() {
	if (typeof g_enemies === "undefined" || !g_enemies) return 0;
	let count = 0;
	for (let i = 0; i < g_enemies.length; i++) {
		if (g_enemies[i] instanceof BossZombie && g_enemies[i].hp > 0) {
			count++;
		}
	}
	return count;
}

/**
 * Applies global boss enrage to all living active bosses when boss cap is reached (D-14).
 */
function applyGlobalBossEnrage() {
	if (typeof g_enemies === "undefined" || !g_enemies) return;
	for (let i = 0; i < g_enemies.length; i++) {
		let b = g_enemies[i];
		if (b instanceof BossZombie && b.hp > 0) {
			b.hp += 4;
			b.maxHp = (b.maxHp || b.hp) + 4;
			b._maxSpeed = (b._maxSpeed || 0.16) * 1.10;
			b.enrageStacks = (b.enrageStacks || 0) + 1;
			b.enraged = true;
			if (typeof fx_shakeScreen === "function") {
				fx_shakeScreen(0.4);
			}
		}
	}
	if (typeof soundBossRoar !== "undefined" && soundBossRoar && soundBossRoar.play) {
		soundBossRoar.play();
	}
}
