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
