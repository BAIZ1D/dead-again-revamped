/** @format */

class AmmoBox extends EngineObject {
	static getCount() {
		var c = 0;
		for (const o of engineObjects) {
			if (o instanceof AmmoBox) c++;
		}

		return c;
	}

	constructor(pos, gunType, twitchUser = null, isScavenged = false) {
		super(pos, vec2(1), getAmmoForGunType(gunType), TILE_SIZE);

		this._hitbox = vec2(0.5);
		// Phase 3 APG care package attribution (D-01, NAME-03)
		this.twitchUser = twitchUser;
		this.isScavenged = Boolean(isScavenged);
		this.spawnFrame = typeof frame !== "undefined" ? frame : 0;
	}

	update() {
		if (!g_player) return;

		if (isOverlapping(this.pos, this._hitbox, g_player.pos, g_player._hitbox)) {
			if (this.isScavenged) {
				// BAL-11: Scavenged clips from slain enemies
				if (this.tileIndex == tileNumbers_boxShells) {
					g_player.ammoShells += 2;
				} else if (this.tileIndex == tileNumbers_boxRifleAmmo) {
					g_player.ammoRifle += 1;
				} else {
					g_player.ammoBullets += 5;
				}
			} else if (this.twitchUser) {
				// Audience care package: handled with multi-weapon yields in Plan 06-02
				let activeGun = g_player.gun ? g_player.gun.tileIndex : tileNumbers_pistol;
				if (activeGun == tileNumbers_shotgun) {
					g_player.ammoShells += 4;
					g_player.ammoBullets += 6;
					g_player.ammoRifle += 1;
				} else if (activeGun == tileNumbers_rifle) {
					g_player.ammoRifle += 2;
					g_player.ammoBullets += 6;
					g_player.ammoShells += 2;
				} else {
					g_player.ammoBullets += 12;
					g_player.ammoShells += 2;
					g_player.ammoRifle += 1;
				}
				if (typeof g_apgManager !== "undefined" && g_apgManager) {
					g_apgManager.onAmmoPickedUp(this);
				}
			} else {
				// Map-placed supply crates
				if (this.tileIndex == tileNumbers_boxShells) {
					g_player.ammoShells += 6;
				} else if (this.tileIndex == tileNumbers_boxRifleAmmo) {
					g_player.ammoRifle += 3;
				} else {
					g_player.ammoBullets += 12;
				}
			}

			if (typeof g_player.clampAmmo === "function") {
				g_player.clampAmmo();
			}

			soundPickup.play(this.pos);
			this.destroy();
		}
	}
}
