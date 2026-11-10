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

		// Anti-Stall Nudge (D-57): Track mob displacement over 240 frames (4s).
		// If displacement < 0.2 tiles while in pursuit, inject orthogonal nudge toward open corridor.
		if (!this.antiStallStartPos || !this.antiStallTimer) {
			this.antiStallStartPos = this.pos.copy();
			this.antiStallTimer = 240;
		} else {
			this.antiStallTimer--;
			if (this.antiStallTimer <= 0) {
				let distMoved = this.pos.distance(this.antiStallStartPos);
				if (distMoved < 0.2 && this.enemyToTarget && this.enemyToTarget.length() > 1.0) {
					let targetDir = this.enemyToTarget.normalize();
					let perp = (rand() < 0.5 ? 1 : -1);
					let nudge = vec2(-targetDir.y * perp, targetDir.x * perp).scale(0.18);
					this.applyForce(nudge);
				}
				this.antiStallStartPos = this.pos.copy();
				this.antiStallTimer = 240;
			}
		}

		// Doorway Force-Fields (D-56): Detect if within 2.0 tiles of any door opening
		this.nearDoor = false;
		if (typeof g_doors !== "undefined" && g_doors) {
			for (let key in g_doors) {
				let d = g_doors[key];
				if (d && this.pos.distance(vec2(d.x + 0.5, d.y + 0.5)) <= 2.0) {
					this.nearDoor = true;
					break;
				}
			}
		}

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
			if (this.enemyToTarget) {
				let jitterMult = this.nearDoor ? (1 + (rand() - 0.5) * 0.3) : 1; // +/-15% forward velocity jitter per D-56
				force = this.enemyToTarget.normalize(this.enemyAccel * jitterMult);
			}

			let jitter = randInCircle(this.enemyJitterForce);
			force = force.add(jitter);

			this.applyForce(force);
		}

		this.applyDrag(this.enemyDrag);
		this.velocity = this.velocity.clampLength(this._maxSpeed);

		super.update();
	}

	collideWithTile(tileData, tilePos) {
		if (tileData == tileNumbers_door) {
			if (this instanceof Ghost || this.tileIndex == tileNumbers_ghost) {
				// Ghosts phase through closed barricade doors unhindered (D-47)
				return false;
			}
			let idx = Math.floor(tilePos.x) + "_" + Math.floor(tilePos.y);
			let door = typeof g_doors !== "undefined" ? g_doors[idx] : null;
			if (door && !door.broken) {
				this.doorBashTimer = (this.doorBashTimer || 0) + 1;
				// Throttled bash attack: normal mobs deal 2 HP/sec (deals 1 damage every 30 frames)
				// Bosses deal 15 damage per hit (D-44)
				let bashInterval = this instanceof BossZombie ? 60 : 30;
				if (this.doorBashTimer >= bashInterval) {
					this.doorBashTimer = 0;
					let dmg = this instanceof BossZombie ? 15 : 1;
					door.hp -= dmg;
					if (typeof spawnSplinterParticles === "function") {
						spawnSplinterParticles(door.x, door.y, 2);
					}
					if (typeof soundDoorBash !== "undefined" && soundDoorBash && soundDoorBash.play) {
						soundDoorBash.play(vec2(door.x, door.y));
					} else if (typeof soundBoulderDestroy !== "undefined" && soundBoulderDestroy && soundBoulderDestroy.play) {
						soundBoulderDestroy.play(vec2(door.x, door.y), 0.8);
					}
					if (door.hp <= 0.05) {
						breakDoorAt(door.x, door.y, true);
					}
				}
				return true;
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
			// Doorway Force-Fields (D-56): +50% lateral repulsion near doorways (1.05 vs 0.7)
			const TOO_CLOSE = (this.nearDoor || o.nearDoor) ? 1.05 : 0.7;

			let toOther = o.pos.subtract(this.pos);
			if (toOther.length() < TOO_CLOSE) {
				let mult = (this.nearDoor || o.nearDoor) ? 1.5 : 1.0;
				let pushForce = toOther.normalize((rand(0.1) * mult) / (toOther.length() + 0.001));
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
		if (this.hp <= 0.05) return;

		this.hp -= dam;
		this.groan(1, 2, rand(1, 1.5));

		this.applyForce(velocity.scale(1 + dam));

		this.bloodEmitter = makeParticles(this.pos, rand(dam / 4, dam / 2));

		let splatCount = Math.max(1, Math.round(dam));
		for (let i = splatCount; i--; ) fx_splatter(pos);

		if (this.hp <= 0.05) {
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
				let isNightmare = typeof g_level !== "undefined" && g_level >= 5;
				if (this.isAudienceBoss || isNightmare) {
					// D-08, D-14, D-20: Defeating any boss in Nightmare drops Full Care Package
					g_score += 4;
					let gunTile = g_player && g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
					// Radial scatter deconfliction (1.5-2.0 tile search) so multiple crates never overlap (D-23)
					let dropPos = typeof findScatterDropPos === "function" ? findScatterDropPos(this.pos) : this.pos.copy();
					new AmmoBox(dropPos, gunTile, this.twitchUser || "NightmareBoss", false, true);
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

/**
 * Returns dynamic concurrency scaling cap (25 to 40 entities) for Nightmare waveNum (D-12).
 * Wave 1: 25, Wave 2: 28, Wave 3: 31, Wave 4: 34, Wave 5: 37, Wave 6+: 40
 */
function getMaxMobsForWave(waveNum) {
	let w = typeof waveNum === "number" ? waveNum : 1;
	let base = typeof BASE_NIGHTMARE_MOBS !== "undefined" ? BASE_NIGHTMARE_MOBS : 25;
	let scale = typeof MOB_SCALING_PER_WAVE !== "undefined" ? MOB_SCALING_PER_WAVE : 3;
	let cap = typeof MAX_NIGHTMARE_MOBS !== "undefined" ? MAX_NIGHTMARE_MOBS : 40;
	return Math.min(cap, base + (w - 1) * scale);
}
