# Milestone Roadmap: Dead Again - Revamped (Twitch Edition)

**Milestone:** v1.6: UI Clipping Fixes, Retro Visuals & Endless Nightmare Mode (Release v1.3.0)  
**Status:** In Progress (Roadmap Created)  
**Phases:** 19–24  
**Total Requirements:** 18/18 Mapped (100% Coverage)  
**Release Target:** `v1.3.0`  

---

## Active Milestone: v1.6 (Release v1.3.0)

Milestone v1.6 elevates *Dead Again - Revamped (Twitch Edition)* into a production-grade, infinitely replayable Twitch APG survival shooter. It eliminates lingering Canvas 2D HUD clipping defects, equips the player and streamer with comprehensive in-game compendiums and an unobtrusive chat command cheat-sheet, overhauls the title screen with authentic procedural 16-bit pixel art, and expands the campaign into an endless multi-room Nightmare survival gauntlet with escalating waves and up to 5 concurrent audience bosses.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MILESTONE v1.6 DEPENDENCY GRAPH                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   Phase 19: HUD Ergonomics, Banner Containment & Text-Wrapping Engine                  │
│             (CLIP-04, CLIP-05, CLIP-06)                                                │
│                                │                                                       │
│                                ▼                                                       │
│   Phase 20: Field Manual Arsenal & Bestiary Compendium Completion                      │
│             (HELP-01, HELP-02, HELP-03)                                                │
│                 │                                  │                                   │
│                 ▼                                  ▼                                   │
│   Phase 21: 16-Bit Retro Pixel Title Screen    Phase 22: In-Game Stream Cheat-Sheet    │
│             (VIS-02, VIS-03, VIS-04)                     (HUD-05, HUD-06)              │
│                                                            │                           │
│                                                            ▼                           │
│                                                Phase 23: Endless Nightmare Gauntlet    │
│                                                          (MODE-01..MODE-05)            │
│                                                            │                           │
│                                                            ▼                           │
│                                                Phase 24: Release v1.3.0 Packaging      │
│                                                          (PKG-09, PKG-10)              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phases

### Phase 19: HUD Ergonomics, Banner Containment & Field Manual Text-Wrapping Engine

**Goal:** Eliminate all remaining HUD clipping defects by snuggly seating the top-left player health bar beneath the avatar portrait with guaranteed left-edge screen clearance, dynamically sizing pre-game vote lock banners, and implementing a universal multi-line Canvas 2D word-wrapping engine for modals.  
**Depends on:** Phase 18 (Milestone v1.5 shipped)  
**Requirements:** `CLIP-04`, `CLIP-05`, `CLIP-06`  
**Target Files:** `main/src/js/ui.js`, `main/src/js/startScreen.js`, `scripts/test-phase16.js` (regression guard), `scripts/test-phase19.js`  

**Measurable Success Criteria (Observable User Behaviors):**
1. Player views the top-left armored health plate (hearts and shield pip) seated snuggly beneath the player avatar portrait with at least $0.25 \cdot scaleUI$ clearance from the left screen boundary across all aspect ratios (16:9, 16:10, 4:3, ultrawide) with zero offscreen clipping.
2. Player and audience view the pre-game prediction locked announcement banner ("VOTES LOCKED: XX% GOOD vs YY% BAD") fully contained within its visual borders via dynamic width expansion up to $0.88 \cdot W$ and responsive font downscaling.
3. Player can open the Field Manual / Help modal (`[H]`) across all screen dimensions and see multi-line text cleanly wrapped within card margins without character or line overflow, driven by `drawWrappedText()`.

**Architectural Approach & Pitfall Mitigations:**
- Health Bar Clearance: Shift the parent equipment card anchor rightward (`cardMarginX = 0.5 * scaleUI`) and set heart plate position to `pos.x - 4.45 * scaleUI` with tightened pip pitch (`0.55 * scaleUI`). Preserves the literal `5.975 * scaleUI` expression in `ui.js` to avoid breaking `test-phase16.js` Check 2.
- Responsive Banner Expansion: In `renderLobbyHUD()`, measure headline text width with `overlayContext.measureText()` and compute `bannerW = Math.min(W * 0.88, Math.max(minWidth, textW + padding))`. If text width still exceeds $0.80 \cdot W$, scale down `fontSize` proportionally.
- Universal Text-Wrapping Engine: Implement `drawWrappedText(ctx, text, x, y, maxWidth, lineHeight)` in `startScreen.js` (and export to game globals) using word tokenization and iterative `measureText()` width checks.

---

### Phase 20: Field Manual Arsenal & Bestiary Compendium Completion

**Goal:** Fill the in-game Field Manual modal (`[H]`) with complete, accurate mechanical telemetry for all 4 weapons and tactical behavioral dossiers for all 4 enemy types (including boss mechanics and drops), plus Twitch APG clutch rules.  
**Depends on:** Phase 19  
**Requirements:** `HELP-01`, `HELP-02`, `HELP-03`  
**Target Files:** `main/src/js/startScreen.js`, `scripts/test-phase20.js`  

**Measurable Success Criteria (Observable User Behaviors):**
1. In Field Manual Tab 1 (Weapons), player can inspect exact mechanical stats and firing physics for all 4 weapons: Pistol (6-shot cylinder, 36 reserve cap, 0.18s snappy reload), SMG (20-shot mag, 36 reserve cap, 80ms cyclic rate, burst-tap pinpoint accuracy vs erratic hold spray bloom), Shotgun (2-shell break-action, 8 reserve cap, wide pellet spread), and Rifle (single-shot bolt, 8 reserve cap, high-velocity armor piercing).
2. In Field Manual Tab 2 (Bestiary), player can inspect full behavioral profiles, threat levels, and counter-tactics for all 4 enemy types: Walkers (Zombies, swarm melee), Aerial (Vampires, high-speed dive-bombers), Phasing (Ghosts, ignores wall collision), and Heavy Boss Zombies (boulder throwing ballistics, destructible cover destruction, and guaranteed Full Care Package drops on kill).
3. In Field Manual Tab 3 (Twitch APG), streamer and audience can reference accurate rules for all 10 chat commands, dynamic viewer-scaling rate limits, and clutch ammo drop guarantees (<3 bullets, <2 shells/rifle).

**Architectural Approach & Pitfall Mitigations:**
- Multi-Tab Layout: Leverage the universal `drawWrappedText()` from Phase 19 to render formatted statistic tables and lore blocks inside Tab 1, Tab 2, and Tab 3 cards.
- Content Accuracy: Match weapon and enemy values exactly to constants defined in `gunMachinePistol.js`, `gunShotgun.js`, `gunRifle.js`, `mobEnemy.js`, and `mobBossZombie.js`.
- Preserve Test Signatures: Maintain all 14 function signatures asserted by `test-phase17.js` (e.g., `renderFieldManualModal`, `switchTab`, `drawTabButton`).

---

### Phase 21: 16-Bit Retro Arcade Start Screen Visual Overhaul

**Goal:** Replace flat title screen backdrops and unstyled elements with authentic procedural 16-bit retro arcade visuals featuring a stepped graveyard silhouette, a cratered Bayer-dithered harvest/blood moon, and 3-layer parallax drifting pixel fog with zero external asset dependencies.  
**Depends on:** Phase 20  
**Requirements:** `VIS-02`, `VIS-03`, `VIS-04`  
**Target Files:** `main/src/js/startScreen.js`, `scripts/test-phase21.js`  

**Measurable Success Criteria (Observable User Behaviors):**
1. Player experiences an authentic 16-bit retro pixel start screen featuring a procedural stepped graveyard silhouette (tombstones, crooked crosses, twisted dead trees, and cathedral spires) replacing flat backgrounds.
2. Player views a procedural Bayer-dithered retro pixel harvest/blood moon with shaded craters and concentric halo glow rings on the title screen.
3. Player observes 3-layer parallax drifting pixel fog undulating horizontally across the title horizon with sinusoidal motion at 60 FPS without external image dependencies or dropped frames.

**Architectural Approach & Pitfall Mitigations:**
- Procedural Pixel Art: Implement integer coordinate rasterization in `renderStartAtmosphere()` using procedural geometry and Bayer 4x4 dither matrices for lunar and crater shading.
- Parallax Pixel Fog: Render 3 distinct horizontal fog bands moving at staggered velocities ($v_1 = 0.3$, $v_2 = 0.6$, $v_3 = 1.1$ px/frame) with vertical sinusoidal undulation ($A = 4\text{px}$, $f = 0.05$).
- Preservation of v1.5 Heraldic Elements: Retain the crossed weapon tiles, dual faction portraits, and 24 rising embers established in Phase 17, blending them harmoniously over the new graveyard backdrop.
- Regression Guard: Verify `scripts/test-phase17.js` passes 100% without signature regressions.

---

### Phase 22: In-Game Stream Command Cheat-Sheet & Streamer Ergonomics

**Goal:** Provide an on-screen Twitch APG chat command cheat-sheet card docked in the bottom-right viewport margin with hotkey toggle (`[C]`), live trigger highlight pulses, and guaranteed deconfliction from Karma and kill counters.  
**Depends on:** Phase 19, Phase 20  
**Requirements:** `HUD-05`, `HUD-06`  
**Target Files:** `main/src/js/apgManager.js`, `main/src/js/main.js`, `main/src/js/ui.js`, `scripts/test-phase22.js`  

**Measurable Success Criteria (Observable User Behaviors):**
1. Streamer and viewers see a dedicated Good vs Bad Twitch chat commands cheat-sheet card docked in the safe bottom-right margin ($[0.74W, 0.98W] \times [0.72H, 0.96H]$), displaying all 10 commands with concise 2-word tactical summaries.
2. The cheat-sheet card maintains zero visual overlap with the bottom-center Karma tug-of-war meter and the middle-right red kill counter across all standard resolutions.
3. Streamer can toggle the cheat-sheet card on or off via hotkey `[C]`, displaying a compact collapsed hint pill (`[C] Commands`) when hidden to free screen area for streamer webcams.
4. When audience members execute a chat command, the corresponding entry on the cheat-sheet card pulses with a glowing faction border for 45 frames.

**Architectural Approach & Pitfall Mitigations:**
- Safe Margin Docking: Anchor within $[0.74W, 0.98W] \times [0.72H, 0.96H]$, docking strictly below the kill counter ($H \times 0.38$) and to the right of the Karma bar ($0.72W$).
- Translucent Backing: Render using translucent dark slate (`rgba(10, 14, 20, 0.70)`) to preserve peripheral combat visibility.
- Hotkey Listener: Wire keybind `[C]` in `main.js` input loop with toggle state persisted in `localStorage.da_show_cheatsheet`.
- Pulse Telemetry: Hook command execution in `apgManager.js` to set `commandLastTriggered[cmd] = currentFrame`, rendering a 45-frame decaying glow stroke.

---

### Phase 23: Endless Multi-Room Nightmare Survival Gauntlet

**Goal:** Deliver an endless post-Level 5 Nightmare survival mode featuring wave-specific prediction lobbies, multi-room dungeon map cycling with destructible barricade doors, a starting armory safe room spawning all 4 weapons on separated pedestals, escalating mob caps up to 40 entities, up to 5 concurrent audience bosses with enrage buffs, and persistent high score survival tracking.  
**Depends on:** Phase 22  
**Requirements:** `MODE-01`, `MODE-02`, `MODE-03`, `MODE-04`, `MODE-05`  
**Target Files:** `main/src/js/main.js`, `main/src/js/DEFS.js`, `main/src/js/mapmanager.js`, `main/src/js/mob_enemy.js`, `main/src/js/mobBossZombie.js`, `main/src/js/apgManager.js`, `scripts/test-phase23.js`  
**Status:** Completed (All 5 Plans Executed & 100% Verified)

**Plans:**
- [x] 23-01: Core Dungeon Flow, Weapon Rebalance & Barricade Physics (`MODE-01`, `MODE-02`)
- [x] 23-02: Mob Scaling, Boss Concurrency & AI Navigation (`MODE-03`, `MODE-04`)
- [x] 23-03: Stage Transition, Telemetry, Defeat Flow & Twitch Sync (`MODE-01`, `MODE-05`)
- [x] 23-04: Audio Synthesis, Wave Micro-Purge & OBS Retina Capture Fix (`MODE-01`..`MODE-05`)
- [x] 23-05: Comprehensive Verification & Regression Test Suite (`MODE-01`..`MODE-05`)  

**Measurable Success Criteria (Observable User Behaviors):**
1. Defeating the Level 5 Boss transitions the player seamlessly into endless Nightmare Mode (`g_level >= 5`), progressing through wave-specific pre-game prediction lobbies instead of a terminal game-over screen.
2. Player spawns into a multi-room dungeon layout featuring destructible barricade doors and a dedicated starting armory room holding all 4 weapons (Pistol, Shotgun, Rifle, SMG) placed on separated floor pedestals without weapon overlap or swap screeching.
3. Player faces escalating endless waves with mob concurrency caps scaling dynamically from 25 up to 40 entities, actively spawning all 4 enemy types (Zombies, Vampires, Ghosts, Bosses).
4. Stream audience can summon up to 5 concurrent active bosses simultaneously during Nightmare Mode (`MAX_AUDIENCE_BOSSES = 5`), with bosses dropping Full Care Packages on defeat and wall tearing throttled to 8 seconds to prevent dungeon destruction.
5. Player can track endless survival metrics (waves survived, kills, survival time) in real-time on the HUD, and review a persistent high score summary on defeat saved to `localStorage` (`da_nightmare_best_wave`, `da_high_score`).

**Architectural Approach & Pitfall Mitigations:**
- Stage Transition & Boss Tagging: Set `isAudienceBoss = true` on all Nightmare boss spawns so boss deaths trigger individual care packages without invoking the legacy Level 5 stage clear (`g_enemies.length > 0 hit()`).
- Starting Weapon Spacing: Spawn weapons on verified walkable floor tiles separated by $\ge 2.5$ tiles with a 30-frame drop cooldown to prevent rapid cascade swapping or cylinder ammo reserve dumping.
- Wall Preservation: Add an 8-second tearing cooldown per boss and protect perimeter boundary walls.
- Memory & Entity Hygiene: Enforce wave-boundary micro-purges destroying particles older than 30s, clamp mob speed buffs to $+50\%$, and prune `g_shadows` coordinate keys outside a 20-tile player radius.
- Persistence: Store high scores, best wave, and best survival time in `localStorage` under `da_nightmare_best_wave` and `da_high_score`, displaying personal best banners on the HUD.

---

### Phase 24: Release v1.3.0 Packaging & Verification

**Goal:** Synchronize application semantic version to `1.3.0` across all package manifests, desktop updater endpoints, and documentation, compile production bundles with zero ES6 leakage, and verify 100% green test passes across all historical and new test suites.  
**Depends on:** Phase 23  
**Requirements:** `PKG-09`, `PKG-10`  
**Target Files:** `package.json`, `package-lock.json`, `relay-server/package.json`, `desktop/updater.js`, `desktop/menu.js`, `README.md`, `scripts/build-game.js`, `scripts/test-phase24.js`  
**Status:** Complete (Shipped 2026-11-10)

**Plans:**
- [x] 24-01: In-Game Credits Modal & Semantic Version Synchronization (`PKG-09`)
- [x] 24-02: Production Compilation Audit & Comprehensive Regression Meta-Verification Harness (`PKG-10`)  

**Measurable Success Criteria (Observable User Behaviors):**
1. Standalone desktop application, relay server, and updater endpoints report semantic version `1.3.0` consistently across About dialogs, dashboard footers, package manifests, and console logs.
2. Non-destructive production compilation via `scripts/build-game.js` bundles all source modules into `dist/js/index.js` with zero ES6 module syntax (`import`/`export`) or top-level variable collisions.
3. Developer and CI pipeline verify 100% green passing status across all existing regression suites (Phases 12–18) and new suites (Phases 19–24) via unified runner `npm run test:phase24`.

**Architectural Approach & Pitfall Mitigations:**
- Manifest Synchronization: Update `version: "1.3.0"` in root `package.json`, `package-lock.json`, and `relay-server/package.json`; update fallback versions in `desktop/updater.js` and `desktop/menu.js`.
- Bundle Verification: Run `scripts/build-game.js` and verify AST/regex checks ensuring zero `const`/`let` in global scope collisions and zero `import`/`export` keywords.
- Meta-Verification Harness: Implement `scripts/test-phase24.js` executing manifest validation, bundle audit, and sequential runs of test suites for Phases 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, and 23.

---

## Milestones Archive

- ✅ **v1.0 Twitch APG Core Transformation** — Phases 1–4 (Shipped 2026-10-29) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Gameplay & Audience Balance Overhaul** — Phases 5–6 (Shipped 2026-10-30) — [Archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Desktop Standalone Packaging & Streamer Launcher** — Phases 7–9 (Shipped 2026-10-30, Released 2026-11-05) — [Archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 HUD Layout & Streamer Dashboard Polish** — Phases 10–11 (Shipped 2026-11-05) — [Archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 Game Balancing & Survival Tension Tuning (Release v1.0.1)** — Phases 12–14 (Shipped 2026-11-06) — [Archive](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 UI Polish, Combat Balance & Visual Overhaul (Release v1.2.0)** — Phases 15–18 (Shipped 2026-11-06) — [Archive](milestones/v1.5-ROADMAP.md)

---
*Last updated: 2026-11-10 upon Milestone v1.6 roadmap creation*
