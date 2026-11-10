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
		// D-19, D-21: Scavenged clips render at 0.75x tile scale, Full Care Packages at 1.25x scale
		let boxSize = isFullPackage ? vec2(1.25) : (isScavenged ? vec2(0.75) : vec2(1));
		super(pos, boxSize, getAmmoForGunType(gunType), TILE_SIZE);

		this._hitbox = vec2(0.5);
		// Phase 3 & 23 APG care package attribution (D-01, D-14, D-20, NAME-03)
		this.twitchUser = twitchUser;
		this.isScavenged = Boolean(isScavenged);
		this.isFullPackage = Boolean(isFullPackage);
		this.spawnFrame = typeof frame !== "undefined" ? frame : 0;
	}

	update() {
		let curFrame = typeof frame !== "undefined" ? frame : 0;
		// Full Care Packages persist for 60 seconds (3600 frames) per D-22
		let maxLife = this.isFullPackage ? 3600 : (this.isScavenged ? 1500 : this.twitchUser ? 1800 : Infinity);
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
			} else if (this.twitchUser || this.isFullPackage) {
				if (this.isFullPackage) {
					if (this.twitchUser) {
						// D-05: Slain audience mini-boss Full Care Package reward
						g_player.ammoBullets += 4;
						g_player.ammoShells += 2;
						g_player.ammoRifle += 1;
					} else {
						// D-14, D-20, D-21: Slain boss / Gauntlet Care Package reward (+6 bullets, +3 shells, +2 rifle, +1 heart/shield capped at 4 HP)
						g_player.ammoBullets += 6;
						g_player.ammoShells += 3;
						g_player.ammoRifle += 2;
						if (g_player.hp < 3) {
							g_player.hp = Math.min(3, g_player.hp + 1);
						} else {
							g_player.hp = Math.min(4, g_player.hp + 1); // Shield pip up to 4 HP max
						}
					}
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
		let maxLife = this.isFullPackage ? 3600 : (this.isScavenged ? 1500 : this.twitchUser ? 1800 : Infinity);
		let remaining = maxLife - (curFrame - this.spawnFrame);

		// D-14, D-15, D-22: Final warning rapid flashing (10 seconds remaining for Full Care Package = 600 frames)
		if ((remaining <= 300 && Math.floor(curFrame / 4) % 2 === 0) || (this.isFullPackage && remaining <= 600 && Math.floor(curFrame / 4) % 2 === 0)) {
			return;
		}

		if (this.isFullPackage) {
			// Golden metallic border glow (#FFD700), subtle sparkle particles, vertical light beam (D-21)
			drawRect(this.pos, this.size.scale(1.2), new Color(1, 215 / 255, 0, 0.4));
			let beamHeight = 4.0;
			let beamPos = this.pos.add(vec2(0, beamHeight / 2));
			drawRect(beamPos, vec2(0.5, beamHeight), new Color(1, 215 / 255, 0, 0.25));
			let pulse = 0.8 + 0.2 * Math.sin(curFrame / 10);
			drawRect(this.pos, vec2(this.size.x * pulse), new Color(1, 215 / 255, 0, 0.2));
		}

		super.render();
	}
}

/**
 * Radial scatter deconfliction search (1.5 - 2.0 tiles) so care packages never overlap per D-23.
 */
function findScatterDropPos(origin) {
	if (!origin) return vec2(5, 5);
	for (let i = 0; i < 16; i++) {
		let ang = rand(PI * 2);
		let r = rand(1.5, 2.0);
		let p = origin.add(vec2(Math.cos(ang) * r, Math.sin(ang) * r));
		if (typeof tileCollisionTest === "function" && tileCollisionTest(p, vec2(0.8))) continue;
		let overlaps = false;
		if (typeof engineObjects !== "undefined") {
			for (let obj of engineObjects) {
				if (obj instanceof AmmoBox && obj.pos && obj.pos.distance(p) < 1.0) {
					overlaps = true;
					break;
				}
			}
		}
		if (!overlaps) return p;
	}
	return origin.copy();
}
