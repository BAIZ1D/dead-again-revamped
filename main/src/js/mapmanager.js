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
 * Phase 3 APG anti-softlock helper (D-02, D-03): permanently breaks the door at
 * tile (x, y), swapping it for a floor tile and clearing its collision.
 * Used by bullets, `!repair` and enemies stuck against a door.
 * Returns true if a door was actually broken.
 */
function breakDoorAt(x, y, playEffects = true) {
	let idx = x + "_" + y;
	let door = g_doors[idx];
	if (door) {
		if (door.broken) return false;
		door.hp = 0;
		door.broken = true;
	} else {
		g_doors[idx] = { hp: 0, x: x, y: y, broken: true };
	}
	let pos = vec2(x, y);
	let floorTile = new TileLayerData(
		tileNumbers_floorStone,
		randInt(4),
		false,
		new Color(1, 1, 1, rand(0.2, 0.5))
	);
	if (tileLayer) {
		tileLayer.setData(pos, floorTile, true);
		tileLayer.redraw();
	}
	setTileCollisionData(pos, 0);
	if (playEffects) {
		soundBoulderDestroy.play(pos, 3);
		makeParticles(pos.add(vec2(0.5)), 0.3, colorWhite, 0.5);
	}
	return true;
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
						// Phase 3: full doorway registry so !repair knows every door (D-02)
						let dy = h - 1 - y;
						g_doors[x + "_" + dy] = { hp: 3, x: x, y: dy, broken: false };
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
