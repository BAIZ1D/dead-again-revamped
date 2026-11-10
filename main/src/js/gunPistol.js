/** @format */

class Pistol extends Gun {
	constructor(pos) {
		super(pos, tileNumbers_pistol);
		// your object init code here
		this._distance = 0.7;
		this._speed = 0.4;

		this._maxAmmo = 6;
		this.ammo = this._maxAmmo;
		this._ammoIconTile = tileNumbers_bulletIcon;

		this.reloadTimePerBullet = 0.18;

		this.name = 'Pistol';
		this.bulletDamage = 1.0; // Standard pistol remains untouched at 1.0 damage per shot per D-11

		this._soundFire = soundPistol;
	}

	fire() {
		if (super.fire(colorBullet)) {
			let bullet = new Bullet(this.pos.copy(), 0, colorBullet, 28, this.bulletDamage);
			bullet.velocity.x = Math.cos(-this.angle) * this._speed;
			bullet.velocity.y = Math.sin(-this.angle) * this._speed;
			bullet.bulletDamage = this.bulletDamage;
			bullet.isPistol = true;
		}
		return true;
	}
}
