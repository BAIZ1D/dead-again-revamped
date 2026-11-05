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
