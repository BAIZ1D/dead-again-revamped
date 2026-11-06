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
