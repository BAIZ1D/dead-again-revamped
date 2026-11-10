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

		// Phase 23: Weapon drop pickup cooldown to prevent swap oscillating/ammo loss (D-09)
		this.dropCooldown = 0;
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
						if (typeof g_apgManager !== "undefined" && g_apgManager) {
							g_apgManager.jamImmunityFrames = 600; // 10s jam immunity post-reload (D-25)
						}
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
			if (this.dropCooldown > 0) {
				this.dropCooldown--;
			} else if (typeof g_player !== "undefined" && g_player) {
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
			player.gun.dropCooldown = typeof WEAPON_DROP_COOLDOWN !== "undefined" ? WEAPON_DROP_COOLDOWN : 30;
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
