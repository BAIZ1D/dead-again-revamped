/** @format */
class Shotgun extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_shotgun);
		this._distance = 0.3;
		this._speed = 0.3;
		this._maxAmmo = 2;
		this._ammoIconTile = tileNumbers_shellIcon;

		this.ammo = this._maxAmmo;
		this.reloadTimePerBullet = 0.6;

		this.name = 'Shotgun';
		this.bulletDamage = 1.0;

		this._soundFire = soundShotgun;
	}

	fire() {
		if (super.fire(colorShell)) {
			var bulletColor = colorShell;
			var bulletLife = 22;

			const bullets = 4;
			const spread = PI / 6;
			let angle = -this.angle - spread / 2;
			for (let i = 0; i < bullets; i++) {
				let bullet = new Bullet(this.pos.copy(), 0, bulletColor, bulletLife);
				bullet.velocity.x = Math.cos(angle) * this._speed;
				bullet.velocity.y = Math.sin(angle) * this._speed;
				bullet.isShotgun = true;
				bullet.bulletDamage = this.bulletDamage;
				bullet.startPos = this.pos.copy();
				angle += spread / bullets;
			}
		}
		return true;
	}
}
