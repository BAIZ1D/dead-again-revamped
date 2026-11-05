/** @format */
class Mob extends EngineObject {
	constructor(pos, size, tileIndex) {
		super(pos, size, tileIndex, vec2(9, 12));

		this.walkCyclePlace = 0;
		this._walkCycleFrames = 60;
		this._hitbox = vec2(0.5);

		this.miniFace = undefined;
		this.setCollision(true, true);
		this.mass = 1;
		this.elasticity = 0.1;
		this.damping = 1;

		// this._maxSpeed = 0.4;

		this.bumpWalk = 0;
		this.mirror = false;
		this.hp = 3;

		this.blood = [];

		// for arms
		this.pointingAngle = rand(2 * PI);
		this._armColor = undefined;

		this.enemyToTarget = undefined;
		this.soundGroan = undefined;
		this.bloodEmitter = undefined;
	}

	applyDrag(dragConst) {
		let speed = this.velocity.length();

		let drag = speed * speed * dragConst;

		if (drag > speed) drag = speed;

		let dragForce = this.velocity.normalize(drag);

		this.velocity = this.velocity.subtract(dragForce);
	}

	groan(chance, strength, pitch = 1, repeat = 1) {
		if (rand() > chance) return;

		const MAX_VOL = 0.5;

		let vol = MAX_VOL;

		if (this.enemyToTarget) {
			let d = this.enemyToTarget.length() / 10;
			vol = d < 1 ? MAX_VOL : MAX_VOL / (d * d);
		}

		soundPlayExtra(this.soundGroan, this.pos, strength * vol, pitch, 1, 50, repeat, 100);

		//		this.soundGroan.play(this.pos, strength * vol, strength * rand(1, 2), 0.5);
	}

	update() {
		if (this.velocity.length() > 0.01) {
			this.walkCyclePlace = (this.walkCyclePlace + 1) % this._walkCycleFrames;
			this.mirror = this.walkCyclePlace > this._walkCycleFrames / 2 ? true : false;
			this.bumpWalk = this.walkCyclePlace > this._walkCycleFrames / 2 ? 0 : 1 / 12;
		} else {
			this.walkCyclePlace = 0;
			this.mirror = false;
		}

		if (this.bloodEmitter) this.bloodEmitter.pos = this.pos;

		super.update(); // update object physics and position
	}

	render() {
		let drawCol = this.color;

		// Phase 3 APG enemy status tints (D-05 !slow, D-11 !frenzy, D-15 Divine Flash stun).
		// Alpha is preserved so Ghost phasing still reads correctly.
		if (typeof Enemy !== "undefined" && this instanceof Enemy) {
			let a = this.color ? this.color.a : 1;
			if (this.stunFrames > 0) {
				drawCol = new Color(colorSpark.r, colorSpark.g, colorSpark.b, a);
			} else if (typeof g_apgManager !== "undefined" && g_apgManager) {
				if (g_apgManager.timers.slow > 0) {
					drawCol = new Color(colorRifleRound.r, colorRifleRound.g, colorRifleRound.b, a);
				} else if (g_apgManager.timers.frenzy > 0) {
					let p = 0.75 + 0.25 * Math.sin(frame / 4);
					drawCol = new Color(colorBlood.r * p, colorBlood.g * p, colorBlood.b * p, a);
				}
			}
		}

		drawTile(
			vec2(this.pos.x, this.pos.y + this.bumpWalk),
			this.size,
			this.tileIndex,
			this.tileSize,
			drawCol,
			this.angle,
			this.mirror
		);

		// holy stun: two golden pixel stars orbiting above the head (D-15)
		if (typeof Enemy !== "undefined" && this instanceof Enemy && this.stunFrames > 0) {
			let starAngle = frame / 6;
			let topY = this.pos.y + this.size.y * 0.55;
			drawRect(
				vec2(this.pos.x + Math.cos(starAngle) * 0.28, topY + Math.sin(starAngle) * 0.08),
				vec2(1.2 / 12),
				colorSpark
			);
			drawRect(
				vec2(this.pos.x - Math.cos(starAngle) * 0.28, topY - Math.sin(starAngle) * 0.08),
				vec2(1.2 / 12),
				colorSpark
			);
		}

		this.postRender();
	}

	postRender() {
		// draw face
		if (this.miniFace && this.enemyToTarget && this.enemyToTarget.y <= 0) {
			drawTile(
				this.pos.add(vec2((this.enemyToTarget.x > 0 ? 1 : 0) / 12, 3 / 12 + this.bumpWalk)),
				vec2(1 / 4),
				this.miniFace,
				MINI_TILE_SIZE
			);
		}
		this.drawBlood();
	}

	drawBlood() {
		// blood
		for (let i = 0; i < this.blood.length; i++) {
			let blood = this.blood[i];
			for (let j = 0; j < blood.pattern.length; j++) {
				if (blood.pattern[j]) {
					let x = this.pos.x + blood.pos.x - (j % 2) / 12;
					let y = this.pos.y + blood.pos.y - Math.floor(j / 2) / 12;
					drawRect(vec2(x, y), vec2(1 / 12), colorBlood);
				}
			}
		}
	}
}
