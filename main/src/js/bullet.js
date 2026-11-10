/** @format */

class Bullet extends EngineObject {
	constructor(pos, angle, color, lifetime, penetration) {
		let size = vec2(0.15);
		super(pos, size, -1, TILE_SIZE, angle, color);

		this._lifetime = lifetime;
		this._hitbox = vec2(0.25);

		this.penetration = penetration || 1;
		this.penetrationCount = this.penetration;
		this.bulletDamage = this.bulletDamage || this.penetration || 1;
		this.startPos = pos.copy();
		this.timeAlive = 0;
		this.setCollision(true, true, true);

		this.hitSound = soundBulletHit;
	}

	update() {
		this.timeAlive++;
		if (this.timeAlive > this._lifetime) {
			this.destroy();
			return;
		}
		super.update();
	}

	hitWall(big) {
		// bullet holes
		let pos = this.pos.add(this.velocity.normalize(rand(0.2, 0.6)));
		g_holes.push({ pos: pos, color: colorBlack });
		for (let i = 0; i < 4; i++) {
			g_holes.push({
				size: big ? 3 : 1,
				pos: pos.add(randInCircle(1 / 12)),
				color: new Color(0, 0, 0, rand(0.1, 0.5)),
			});
		}

		fx_addSpark(pos.copy());
	}

	collideWithTile(tileData, pos) {
		if (tileData == tileNumbers_door) {
			let idx = Math.floor(pos.x) + "_" + Math.floor(pos.y);
			let door = typeof g_doors !== "undefined" ? g_doors[idx] : null;
			if (door && !door.broken) {
				let destroyBullet = handleBulletDoorCollision(this, door);
				if (destroyBullet) {
					this.hitWall(true);
					this.destroy();
					this.hitSound.play();
					return false;
				} else {
					// Bullet penetrated door (e.g. Rifle per D-52)!
					if (typeof fx_addSpark === "function") {
						fx_addSpark(this.pos.copy());
					}
					return false; // continue flying through door
				}
			}
		}
		this.hitWall();
		this.destroy();
		this.hitSound.play();
		return false; // no more col resolve
	}

	collideWithObject(o) {
		//console.log("bullet hit : ", o);
		if (this.penetration <= 0.05) return false;

		if (o instanceof Enemy) {
			if (o.hp <= 0.05) return false;

			var damage = min(o.hp, this.penetration);

			o.hit(this.velocity.copy(), this.pos.copy(), damage);
			this.hitSound.play(this.pos);

			this.penetration -= damage;
			this.penetrationCount = this.penetration;

			if (this.penetration <= 0.05) {
				this.destroy();
				return false;
			}
		}

		return false; // no auto resolve of collision
	}
}

function spawnSplinterParticles(x, y, count = 4) {
	let p = vec2(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
	if (typeof makeParticles === "function") {
		makeParticles(p, count * 0.05, new Color(180 / 255, 120 / 255, 60 / 255), 0.25);
	}
}

function spawnShotgunShrapnel(x, y, dir) {
	let p = vec2(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
	if (typeof makeParticles === "function") {
		makeParticles(p, 0.4, new Color(180 / 255, 120 / 255, 60 / 255), 0.5);
	}
	if (typeof g_enemies !== "undefined" && g_enemies) {
		for (let i = 0; i < g_enemies.length; i++) {
			let e = g_enemies[i];
			if (e && e.pos && e.pos.distance(p) < 2.0) {
				let toEnemy = e.pos.subtract(p);
				if (toEnemy.dot(dir) > -0.2) {
					e.hit(dir.scale(0.3), e.pos.copy(), 1.0);
				}
			}
		}
	}
}

function handleBulletDoorCollision(bullet, door) {
	if (!door || door.broken) return false;

	let tilePos = vec2(door.x, door.y);
	let dam = bullet.bulletDamage || bullet.damage || bullet.penetration || 1;

	if (bullet.isRifle) {
		// Rifle penetrates door, costing 1 penetration point while damaging the door (D-52)
		door.hp -= dam;
		bullet.penetration -= 1;
		bullet.penetrationCount = (bullet.penetrationCount || bullet.penetration) - 1;
		spawnSplinterParticles(door.x, door.y, 4);
		if (typeof soundDoorBash !== "undefined" && soundDoorBash && soundDoorBash.play) {
			soundDoorBash.play(tilePos);
		} else if (typeof soundBoulderDestroy !== "undefined" && soundBoulderDestroy && soundBoulderDestroy.play) {
			soundBoulderDestroy.play(tilePos, 1.2);
		}
		if (door.hp <= 0.05) {
			breakDoorAt(door.x, door.y, true);
		}
		return bullet.penetration <= 0.05; // destroy only if penetration exhausted
	} else if (bullet.isShotgun && (bullet.startPos ? bullet.pos.distance(bullet.startPos) : 0) < 2.0) {
		// Point-blank shotgun blast obliterates barricade doors into splinters with forward shrapnel (D-53)
		door.hp = 0;
		breakDoorAt(door.x, door.y, true);
		let dir = vec2(1, 0);
		if (bullet.velocity) {
			if (typeof bullet.velocity.length === "function" && bullet.velocity.length() > 0 && typeof bullet.velocity.normalize === "function") {
				dir = bullet.velocity.normalize();
			} else if (bullet.velocity.x || bullet.velocity.y) {
				let len = Math.hypot(bullet.velocity.x, bullet.velocity.y) || 1;
				dir = vec2(bullet.velocity.x / len, bullet.velocity.y / len);
			}
		}
		spawnShotgunShrapnel(door.x, door.y, dir);
		if (typeof soundDoorBreak !== "undefined" && soundDoorBreak && soundDoorBreak.play) {
			soundDoorBreak.play(tilePos);
		} else if (typeof soundBoulderDestroy !== "undefined" && soundBoulderDestroy && soundBoulderDestroy.play) {
			soundBoulderDestroy.play(tilePos, 3);
		}
		return true; // destroy pellet
	} else {
		// Pistol, SMG, or distant Shotgun impact and stop on barricade door surface (D-52)
		door.hp -= dam;
		spawnSplinterParticles(door.x, door.y, 2);
		if (typeof soundDoorBash !== "undefined" && soundDoorBash && soundDoorBash.play) {
			soundDoorBash.play(tilePos);
		} else if (typeof soundBoulderDestroy !== "undefined" && soundBoulderDestroy && soundBoulderDestroy.play) {
			soundBoulderDestroy.play(tilePos, 1.0);
		}
		if (door.hp <= 0.05) {
			breakDoorAt(door.x, door.y, true);
		}
		return true; // destroy bullet
	}
}
