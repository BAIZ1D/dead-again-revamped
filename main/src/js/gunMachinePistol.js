/** @format */

class MachinePistol extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_smg);
		// your object init code here
		this._distance = 0.7;
		this._speed = 0.4;

		this._maxAmmo = 20;
		this.ammo = this._maxAmmo;
		this._ammoIconTile = tileNumbers_bulletIcon;

		this.reloadTimePerBullet = 0.02;

		this.autoFire = true;

		this.fireDelay = 0.08; // 80ms cyclic rate in engine seconds
		this.burstRecoveryTime = 0.16; // 160ms trigger release pause reset threshold
		this.lastFireTime = -100;
		this.burstCount = 0;
		this.currentBloom = 0;
		this.currentPitchFactor = 1.0;

		this._soundFire = {
			play: (pos, volume, pitch) => {
				if (typeof soundPistol !== 'undefined' && soundPistol && soundPistol.play) {
					soundPistol.play(pos, volume, (pitch || 1) * this.currentPitchFactor);
				}
			}
		};
	}

	update() {
		if (typeof g_isPaused !== 'undefined' && g_isPaused) return;

		super.update();

		const curTime = typeof time !== 'undefined' ? time : (typeof frame !== 'undefined' ? frame / 60 : 0);
		if (this.lastFireTime >= 0 && (curTime - this.lastFireTime) >= this.burstRecoveryTime - 0.0001) {
			this.burstCount = 0;
			this.currentBloom = 0;
			this.currentPitchFactor = 1.0;
		}
	}

	fire() {
		if (typeof g_isPaused !== 'undefined' && g_isPaused) return false;
		if (this.reloading || this.ammo <= 0) return super.fire(colorBullet);

		const curTime = typeof time !== 'undefined' ? time : (typeof frame !== 'undefined' ? frame / 60 : 0);

		// 160ms recovery window resets burst counter (D-04)
		if (this.lastFireTime >= 0 && (curTime - this.lastFireTime) >= this.burstRecoveryTime - 0.0001) {
			this.burstCount = 0;
		}

		// Cyclic rate limiting: 80ms delay between shots (D-01, D-06)
		if (this.lastFireTime >= 0 && (curTime - this.lastFireTime) < this.fireDelay - 0.0001) return false;

		this.lastFireTime = curTime;
		this.burstCount++;

		// Burst accuracy vs bloom calculation (D-02, D-03)
		let bloom = 0;
		if (this.burstCount <= 3) {
			// Shots 1-3: Pinpoint laser accuracy (S <= 0.02 rad / ~1.15 deg)
			bloom = 0.02;
		} else {
			// Shots 4-20: Smooth non-linear bloom expansion up to 0.48 rad (~27.5 deg)
			const tau = clamp((this.burstCount - 3) / 17, 0, 1);
			bloom = 0.02 + 0.46 * Math.pow(tau, 1.5);
		}
		this.currentBloom = Math.min(bloom, 0.48);

		// Micro-screenshake & pitch escalation on continuous hold (shots 4+) (D-05)
		if (this.burstCount > 3) {
			if (typeof fx_shakeScreen === 'function') {
				fx_shakeScreen(0.12);
			}
			const pitchTau = clamp((this.burstCount - 3) / 17, 0, 1);
			this.currentPitchFactor = clamp(1.0 + pitchTau * 0.25, 1.0, 1.25);
		} else {
			this.currentPitchFactor = 1.0;
		}

		if (super.fire(colorBullet)) {
			// Reset base Gun.spread to 0 so Gun.prototype.update does not double-jitter this.angle
			this.spread = 0;

			// Dispersion offset bounded within [-currentBloom, +currentBloom]
			const spreadOffset = (rand() - 0.5) * 2 * this.currentBloom;
			const bulletAngle = -this.angle + spreadOffset;

			// Velocity jitter +/-8% (0.92 to 1.08) per D-03
			const velocityJitter = 1 + (rand() - 0.5) * 0.16;
			const bulletSpeed = this._speed * velocityJitter;

			let bullet = new Bullet(this.pos.copy(), 0, colorBullet, 28);
			bullet.velocity.x = Math.cos(bulletAngle) * bulletSpeed;
			bullet.velocity.y = Math.sin(bulletAngle) * bulletSpeed;
		}
		return true;
	}
}
