/** @format */

var tileLayer;
var playerSpawn;

// Phase 3 APG: feathered !blackout flashlight ring (D-09)
const BLACKOUT_INNER_RADIUS = 2.5;
const BLACKOUT_OUTER_RADIUS = 3.5;

/** Target shadow alpha for a tile at `dist` from the player while !blackout is active (D-09). */
function blackoutTargetAlpha(dist) {
	if (dist <= BLACKOUT_INNER_RADIUS) return 0;
	return dist >= BLACKOUT_OUTER_RADIUS ? 0.96 : 0.55 + (dist - BLACKOUT_INNER_RADIUS) * 0.41;
}

function apgTimerActive(name) {
	return typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers && g_apgManager.timers[name] > 0;
}

/**
 * Break door object or door at (x, y) per D-43, D-45, D-52, D-53.
 */
function breakDoor(door) {
	if (!door) return false;
	return breakDoorAt(door.x, door.y, true);
}

/**
 * Phase 3 / Phase 23 APG anti-softlock and ballistics helper (D-02, D-43, D-52, D-53):
 * breaks the door at tile (x, y), swapping it for a floor tile and clearing its collision.
 * Used by bullets, `!repair` and enemies stuck against a door.
 * Returns true if a door was actually broken.
 */
function breakDoorAt(x, y, playEffects = true) {
	let idx = Math.floor(x) + "_" + Math.floor(y);
	let door = typeof g_doors !== "undefined" ? g_doors[idx] : null;
	if (door) {
		if (door.broken) return false;
		door.hp = 0;
		door.broken = true;
	} else if (typeof g_doors !== "undefined") {
		g_doors[idx] = { hp: 0, x: Math.floor(x), y: Math.floor(y), broken: true, maxHp: typeof DOOR_MAX_HP !== "undefined" ? DOOR_MAX_HP : 45 };
	}
	let pos = vec2(Math.floor(x), Math.floor(y));
	let floorTile = new TileLayerData(
		tileNumbers_floorStone,
		randInt(4),
		false,
		new Color(1, 1, 1, rand(0.2, 0.5))
	);
	if (typeof tileLayer !== "undefined" && tileLayer) {
		tileLayer.setData(pos, floorTile, true);
		tileLayer.redraw();
	}
	if (typeof setTileCollisionData === "function") {
		setTileCollisionData(pos, 0);
	}
	if (playEffects) {
		if (typeof soundDoorBreak !== "undefined" && soundDoorBreak && soundDoorBreak.play) {
			soundDoorBreak.play(pos);
		} else if (typeof soundBoulderDestroy !== "undefined" && soundBoulderDestroy && soundBoulderDestroy.play) {
			soundBoulderDestroy.play(pos, 3);
		}
		if (typeof makeParticles === "function") {
			makeParticles(pos.add(vec2(0.5)), 0.35, new Color(180 / 255, 120 / 255, 60 / 255), 0.5); // 12 wood splinter particles
		}
	}
	return true;
}

/**
 * Reconstruct all barricade doors with full 45 HP at wave transitions per D-45, D-46.
 */
function reconstructDoors() {
	if (typeof g_doors === "undefined" || !g_doors) return;
	for (let key in g_doors) {
		let door = g_doors[key];
		if (!door) continue;
		door.hp = door.maxHp || (typeof DOOR_MAX_HP !== "undefined" ? DOOR_MAX_HP : 45);
		door.broken = false;
		door.bashTimer = 0;
		let pos = vec2(door.x, door.y);
		if (typeof tileLayer !== "undefined" && tileLayer) {
			let doorTile = new TileLayerData(tileNumbers_door, 0);
			tileLayer.setData(pos, doorTile, true);
		}
		if (typeof setTileCollisionData === "function") {
			setTileCollisionData(pos, 1);
		}
	}
	if (typeof tileLayer !== "undefined" && tileLayer) {
		tileLayer.redraw();
	}
}

/**
 * Dungeon cycling rotates sequentially through multi-room layouts (Maps 0, 1, 3, 4)
 * with Map 2 (open Boss Arena) appearing every 5th wave per D-07.
 */
function getMapIndexForLevel(level) {
	if (level < 5) {
		return levelDefs[level % levelDefs.length].map;
	}
	let wave = level - 4; // 1-indexed nightmare wave: 1, 2, 3, 4, 5...
	if (wave % 5 === 0) {
		return 2; // Boss Arena every 5th wave (Wave 5, 10, 15...)
	}
	const multiRoomSequence = [0, 1, 3, 4];
	let cycleIdx = (wave - 1) % 5;
	return multiRoomSequence[cycleIdx];
}

function setupMapForLevel(level) {
	let mapIdx = getMapIndexForLevel(level);
	if (level < 5) {
		g_levelDef = levelDefs[level % levelDefs.length];
	} else {
		g_levelDef = {
			map: mapIdx,
			enemiesToSpawn: Infinity,
			enemiesMaxAlive: Math.min(40, 25 + (level - 5) * 3),
			spawns: [{ chance: 0.4 }, { type: "v", chance: 0.25 }, { type: "g", chance: 0.25 }, { type: "b", chance: 0.1 }],
		};
	}
	return mapIdx;
}

function spawnWeaponPedestal(x, y, weaponType) {
	let pos = vec2(x, y);
	let tilePos = vec2(Math.floor(x), Math.floor(y));
	if (typeof tileLayer !== "undefined" && tileLayer) {
		tileLayer.setData(tilePos, new TileLayerData(tileNumbers_floorStone, 0), true);
	}
	if (weaponType === tileNumbers_pistol) {
		return new Pistol(pos);
	} else if (weaponType === tileNumbers_shotgun) {
		return new Shotgun(pos);
	} else if (weaponType === tileNumbers_rifle) {
		return new Rifle(pos);
	} else if (weaponType === tileNumbers_smg) {
		return new MachinePistol(pos);
	}
}

/**
 * Nightmare Wave 1 and milestone waves generate a dedicated 7x7 starting armory safe room at spawn per D-08.
 * Spawns 4 core weapons at Cardinal points 2.8 tiles from spawn on carved stone floor pedestals per D-09.
 */
function setupArmoryRoom(spawnX, spawnY) {
	let cx = Math.floor(spawnX);
	let cy = Math.floor(spawnY);

	// Clear 7x7 safe chamber: -3 to +3 in dx and dy
	for (let dy = -3; dy <= 3; dy++) {
		for (let dx = -3; dx <= 3; dx++) {
			let tx = cx + dx;
			let ty = cy + dy;
			let pos = vec2(tx, ty);

			if (Math.abs(dx) === 3 || Math.abs(dy) === 3) {
				// Wall boundary
				if (typeof tileLayer !== "undefined" && tileLayer) {
					tileLayer.setData(pos, new TileLayerData(9, 0), true);
				}
				if (typeof setTileCollisionData === "function") {
					setTileCollisionData(pos, 1);
				}
			} else {
				// Floor
				if (typeof tileLayer !== "undefined" && tileLayer) {
					tileLayer.setData(pos, new TileLayerData(tileNumbers_floorStone, randInt(4)), true);
				}
				if (typeof setTileCollisionData === "function") {
					setTileCollisionData(pos, 0);
				}
			}
		}
	}

	// Single 1-tile door opening on the North boundary wall (dx = 0, dy = -3) per D-43
	let doorX = cx;
	let doorY = cy - 3;
	let doorPos = vec2(doorX, doorY);
	if (typeof tileLayer !== "undefined" && tileLayer) {
		tileLayer.setData(doorPos, new TileLayerData(tileNumbers_door, 0), true);
	}
	if (typeof setTileCollisionData === "function") {
		setTileCollisionData(doorPos, 1);
	}
	if (typeof g_doors !== "undefined") {
		let maxHp = typeof DOOR_MAX_HP !== "undefined" ? DOOR_MAX_HP : 45;
		g_doors[doorX + "_" + doorY] = {
			x: doorX,
			y: doorY,
			hp: maxHp,
			maxHp: maxHp,
			reinforced: false,
			broken: false,
			bashTimer: 0
		};
	}

	// Cardinal points (R = 2.8 tiles from spawn)
	// North: Pistol, East: Shotgun, South: Rifle, West: Machine Pistol (SMG) per D-09
	const dist = 2.8;
	spawnWeaponPedestal(spawnX, spawnY - dist, tileNumbers_pistol);         // North
	spawnWeaponPedestal(spawnX + dist, spawnY, tileNumbers_shotgun);        // East
	spawnWeaponPedestal(spawnX, spawnY + dist, tileNumbers_rifle);          // South
	spawnWeaponPedestal(spawnX - dist, spawnY, tileNumbers_smg);            // West

	if (typeof tileLayer !== "undefined" && tileLayer) {
		tileLayer.redraw();
	}
}

/**
 * Phase 3 APG line-of-sight query (D-22): is `worldPos` currently visible to
 * the player through Fog of War / !blackout? Used to cull @User name tags.
 */
function isPosVisibleToPlayer(worldPos) {
	if (!g_player || !worldPos) return false;
	if (apgTimerActive("light")) return true;
	if (apgTimerActive("blackout") && worldPos.distance(g_player.pos) > 3.2) return false;
	let key = Math.floor(worldPos.x) + "_" + Math.floor(worldPos.y);
	let sh = g_shadows[key];
	return !sh || sh.alpha <= 0.6;
}

class MapManager {
	constructor() {
		this.createMap();
	}

	createMap() {
		let theMap = mapData[g_levelDef.map];
		let w = theMap.w;
		let h = theMap.h;

		g_doors = {};

		// TileLayer is an EngineObject and will render with the other engineObjects (and respect renderOrder if given)
		tileLayer = new TileLayer(vec2(0), vec2(w, h), TILE_SIZE);
		initTileCollision(vec2(w, h));

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				// floor
				let floorTile = new TileLayerData(
					tileNumbers_floorStone,
					randInt(4),
					false,
					new Color(1, 1, 1, rand(0.2, 0.5))
				);
				tileLayer.setData(vec2(x, h - 1 - y), floorTile);

				let t = theMap.data[x + y * w];
				if (t) {
					t -= 1;

					let offsetVec = vec2(x + 0.5, h - 1 - y + 0.5);

					if (t == tileNumbers_player) {
						playerSpawn = offsetVec;
						continue;
					} else if (t == tileNumbers_pistol) {
						new Pistol(offsetVec);
						continue;
					} else if (t == tileNumbers_shotgun) {
						// BAL-21, D-08: Defer shotgun discovery to Level 2+
						if (g_level < 2) {
							new MachinePistol(offsetVec);
						} else {
							new Shotgun(offsetVec);
						}
						continue;
					} else if (t == tileNumbers_rifle) {
						new Rifle(offsetVec);
						continue;
					} else if (t == tileNumbers_smg) {
						new MachinePistol(offsetVec);
						continue;
					} else if (t == tileNumbers_bossPlaceholder) {
						g_enemies.push(new BossZombie(offsetVec));
						continue;
					} else if (t == tileNumbers_boxBullets) {
						new AmmoBox(offsetVec, tileNumbers_pistol);
						continue;
					} else if (t == tileNumbers_boxShells) {
						// BAL-21, D-08: Replace shell crates with bullet crates in Levels 0-1
						if (g_level < 2) {
							new AmmoBox(offsetVec, tileNumbers_pistol);
						} else {
							new AmmoBox(offsetVec, tileNumbers_shotgun);
						}
						continue;
					} else if (t == tileNumbers_boxRifleAmmo) {
						new AmmoBox(offsetVec, tileNumbers_rifle);
						continue;
					}

					if (t == tileNumbers_door) {
						// Phase 3 & 23: full doorway registry with 45 HP barricade doors (D-02, D-43)
						let dy = h - 1 - y;
						let maxHp = typeof DOOR_MAX_HP !== "undefined" ? DOOR_MAX_HP : 45;
						g_doors[x + "_" + dy] = { hp: maxHp, maxHp: maxHp, x: x, y: dy, broken: false, reinforced: false, bashTimer: 0 };
					} else {
						// pushers on all collision stuff except doors
						pushers.push(new Pusher(offsetVec, 0.01, 0.5, 1.5, 0, PushTo.ALL));

						// moss (not on doors)
						g_moss.push({
							pos: offsetVec.add(randInCircle(5 / 12)),
							tileIndex: miniTileNumbers_moss + randInt(11),
							angle: rand(PI * 2),
						});
					}

					setTileCollisionData(vec2(x, h - 1 - y), t);
					/*let tint = new Color(rand(0.8, 1), rand(0.8, 1), rand(0.8, 1));
					if (g_level % 2 == 0) {
						// brown houses
						tint = tint.add(new Color(217 / 255, 160 / 255, 102 / 255));
					}
					if (g_level % mapData.length == 2 || g_level % mapData.length == 3) {
						// swap wall and roof tiles
						if (t == 9) t = 13;
						else if (t == 13) t = 9;
						else if (t == 14) t = 24;
						else if (t == 24) t = 14;
					}*/
					// roofs and hedgdetops
					try {
						if ((t == 14 || t == 9) && t == theMap.data[x + (y + 1) * w] - 1) {
							t = t == 14 ? 24 : 13;
						}
					} catch (ex) {} // off edge of map

					let tld = new TileLayerData(t, 0, t == 24 ? false : rand() < 0.5);
					tileLayer.setData(vec2(x, h - 1 - y), tld);
				}
			}
		}

		// Check for Nightmare starting armory safe room generation per D-08
		if (typeof g_level !== "undefined" && g_level >= 5) {
			let nightmareWave = g_level - 4;
			let isArmoryWave = (nightmareWave === 1 || (nightmareWave - 1) % 5 === 0 || nightmareWave % 5 === 0);
			if (isArmoryWave && playerSpawn) {
				setupArmoryRoom(playerSpawn.x, playerSpawn.y);
			}
		}

		// Draw the whole tilemap to the offscreen buffer
		tileLayer.redraw();
	}

	render() {
		tileLayer.renderNow();
	}

	// STUPID FOG OF WAR / LINE OF SIGHT
	renderFOW() {
		if (!g_player) return;
		let theMap = mapData[g_levelDef.map];
		const fps = frameRate || 60;

		// Phase 3 APG lighting overrides (D-04 !light, D-09 !blackout)
		let lightActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.light > 0;
		let blackoutActive = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.timers.blackout > 0;

		let pos = vec2(0);
		for (let x = 0; x < theMap.w; x++) {
			for (let y = 0; y < theMap.h; y++) {
				let cx = x + 0.5;
				let cy = y + 0.5;
				// check if this tile is onscreen
				if (
					abs(cx - cameraPos.x) - 1 > overlayCanvas.width / (cameraScale * 2) ||
					abs(cy - cameraPos.y) - 1 > overlayCanvas.height / (cameraScale * 2)
				) {
					continue;
				}

				// !light: full arena vision, no new shadows (D-04)
				if (lightActive) continue;

				// !blackout: feathered flashlight beam around the player (D-09)
				if (blackoutActive && g_player) {
					let dist = vec2(cx, cy).distance(g_player.pos);
					if (dist > BLACKOUT_INNER_RADIUS) {
						let targetAlpha = blackoutTargetAlpha(dist);
						let shadow = g_shadows[x + "_" + y] || { x: cx, y: cy, alpha: 0 };
						// smooth ~0.4s ramp up to the target darkness (never lowers existing darker shadows)
						shadow.alpha = min(max(shadow.alpha, targetAlpha), shadow.alpha + (0.04 * 60) / fps);
						g_shadows[x + "_" + y] = shadow;
						continue;
					}
					// tiles inside the beam still get normal wall raycast shadows
				}

				let dVec = vec2(g_player.pos.x - cx, g_player.pos.y - cy);
				dVec = dVec.clampLength(min(1.5, dVec.length()));
				pos.x = cx + dVec.x;
				pos.y = cy + dVec.y;
				let pos2 = tileCollisionRaycast(g_player.pos, pos);
				// if collision and the collision is not this tile
				if (pos2 && !(pos2.x == cx && pos2.y == cy)) {
					let shadow = g_shadows[x + "_" + y] || {
						x: cx,
						y: cy,
						alpha: 1,
					};
					shadow.alpha = min(1, shadow.alpha + 0.1);

					g_shadows[x + "_" + y] = shadow;
					//drawRect(pos, vec2(0.1), new Color(1, 0, 0));
				} else {
					//drawRect(pos, vec2(0.1), new Color(0, 1, 0));
				}
			}
		}

		const shadowSize = vec2(1.01);
		let color = colorBlack.copy();
		for (let key in g_shadows) {
			let shadow = g_shadows[key];
			// fade
			if (lightActive) {
				// clear all shadows in ~0.3s (D-04)
				shadow.alpha -= (0.06 * 60) / fps;
			} else if (blackoutActive && g_player) {
				let dist = vec2(shadow.x, shadow.y).distance(g_player.pos);
				if (dist <= BLACKOUT_INNER_RADIUS) {
					shadow.alpha -= (0.025 * 60) / fps;
				} else {
					// hold darkness at (at least) the feathered target while blackout lasts (D-09)
					let targetAlpha = blackoutTargetAlpha(dist);
					if (shadow.alpha > targetAlpha) {
						shadow.alpha = max(targetAlpha, shadow.alpha - (0.01 * 60) / fps);
					}
				}
			} else {
				shadow.alpha -= (0.01 * 60) / fps;
			}
			if (shadow.alpha <= 0) {
				delete g_shadows[key];
			} else {
				pos.x = shadow.x;
				pos.y = shadow.y;
				color.a = shadow.alpha;
				drawRect(pos, shadowSize, color);
			}
		}

		// warm colorSpark ambient flare over the whole view while !light is active (D-04)
		if (lightActive && g_player) {
			let remaining = g_apgManager.timers.light;
			// ease the tint in/out over the first/last ~0.5s and add a gentle flicker
			let fade = min(1, remaining / 30);
			let flicker = 0.85 + 0.15 * Math.sin(frame / 9);
			drawRect(
				cameraPos,
				vec2(overlayCanvas.width / cameraScale + 2, overlayCanvas.height / cameraScale + 2),
				new Color(251 / 255, 242 / 255, 54 / 255, 0.08 * fade * flicker)
			);
		}
	}
}
