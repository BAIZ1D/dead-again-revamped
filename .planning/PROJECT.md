# Dead Again - Revamped (Twitch Edition)
*Created & Developed by Baizid Al Hamid*

## What This Is

A Twitch Audience Participation Game (APG) transformation of the retro top-down survival shooter *Dead Again*. A single player streams their run while their entire Twitch audience splits into Team Good and Team Bad to vote in pre-game Channel Point predictions, trigger live in-game buffs and sabotages, and battle over a real-time Karma Meter determining whether the run succeeds or fails.

## Core Value

A high-stakes, real-time tug-of-war between streamer survival and audience sabotage powered by native Twitch Channel Point predictions and dynamic in-game audience events--with zero external stream overlays required.

## Shipped Milestones

### Milestone v1.0: Twitch APG Core Transformation (Shipped 2026-10-29)

- 2D Canvas top-down twin-stick shooter engine loop with LittleJS (`engine.all.release.js`)
- Player character movement, mouse/stick aiming, reload mechanics, and health systems (`mobPlayer.js`)
- Weapon arsenal: Pistol, Shotgun, Rifle, and Machine Pistol with distinct ammo pools and projectile ballistics (`gun*.js`, `bullet.js`)
- Enemy hierarchy: Walkers (Zombies), Aerial transformers (Vampires), Phasing mobs (Ghosts), and Heavy Bosses throwing boulders (`mob*.js`, `boulder.js`)
- Procedural level generation using rotated/mirrored Tiled JSON layouts (`mapmanager.js`, `utilsLevel.js`)
- Dynamic line-of-sight shadow casting and destructible barricade doors (`mapmanager.js`, `main.js`)
- Procedural audio effects and chiptune tracker music playback via ZzFX and ZzFXM (`sounds.js`, `music.js`)
- **Twitch Relay Server & WebSocket Bridge (`RELAY-01`, `RELAY-02`):** Unified Node.js relay server on port 8085 bridging Twitch IRC (`tmi.js`) and Helix (`@twurple`), plus global client WebSocket adapter (`apgNetwork.js`), Canvas 2D status badge, and ZzFX audio cues.
- **Mock / Dev Simulator Dashboard (`RELAY-03`):** Integrated retro arcade web dashboard (`/dashboard`) with zero-config channel persistence, manual trigger pads, and bot swarm presets (`Solo`, `Audience Match`, `Chaos`).
- **Pre-Game Prediction & Faction Locking (Phase 2):** Dual-channel pre-game prediction poll (`!good`/`!bad` chat votes + native Twitch Helix predictions), Canvas 2D Lobby HUD, and Streamer Quick-Lock controls.
- **In-Game Audience Actions, Karma Meter & Name Tagging (Phase 3):** 10 real-time chat commands, anti-spam community charging gauge, live Canvas 2D Karma Tug-of-War Meter, and dynamic Twitch username tagging.
- **Match Outcome, Prediction Payout & Hall of Fame (Phase 4):** Faction victory evaluation against the locked target pin, Canvas 2D Split Podium HUD, MVP/Traitor cards, and persistent all-time records.

### Milestone v1.1: Gameplay & Audience Balance Overhaul (Shipped 2026-10-30)

- **BAL-01 & BAL-14: Tense Starting Ammo Pool:** Re-anchored Level 1 starting equipment to 18 bullets (6 loaded + 12 reserve) to establish immediate tactical scavenging.
- **BAL-02 & BAL-11: Scavenged Enemy Kill Drops:** Regular zombie kills drop modest scavenged clips (+5 bullets, +2 shells, +1 rifle) without Twitch attribution, eliminating runaway stockpiling.
- **BAL-03 & BAL-13: Balanced Multi-Weapon Care Packages:** Audience `!ammo` drops grant tailored munitions based on equipped weapon (+12 pistol / +4 shotgun / +2 rifle) plus cross-pool secondary ammo.
- **BAL-04: Proactive Emergency Ammo:** Spawns a nearby ammo crate when completely dry, checking a 3.5-tile reachability radius with raycast line-of-sight.
- **BAL-05: User-Specified Mob Cap Progression:** Strictly enforces 15 (L1), 18 (L2), 20 (L3), 23 (L4), and 25 (L5) mob concurrency caps.
- **BAL-06: Balanced Audience Mob Spawning & 1.2s Telegraph:** Limits `!mob` to 1 zombie in Levels 1-2 (pairs in L3+), with a 72-frame rising claw telegraph and player touch damage immunity.
- **BAL-07: 3-Heart Base Player Health:** Sets baseline health to 3 hits, reserving the 4th slot as a golden shield pip via `!repair`.
- **BAL-08: Player Kiting Agility:** Boosts player base movement speed by +15% (0.0115 base speed).
- **BAL-09: Snappy Pistol Reload:** Decreases reload time per bullet to 0.18s (~1.08s full reload).
- **BAL-10: Strict Reserve Ammo Caps:** Hard-caps reserves at 36 Bullets, 12 Shells, and 8 Rifle rounds, backed by gold HUD "MAX" badges.
- **BAL-12: Tuned 20% Drop Rate with Clutch Guarantee:** Sets base kill drop chance to 20%, escalating to a 100% guaranteed drop when active weapon reserve is critical (<6 bullets, <2 shells, <2 rifle).
- **Level Transition Clamping:** Equipment is strictly clamped to max reserve ceilings across all level transitions.

### Milestone v1.2: Desktop Standalone Packaging & Streamer Launcher (Shipped 2026-10-30, Audited & Released 2026-11-05)

- **Standalone Packaging:** Packaged into zero-dependency standalone native desktop executables and installers for macOS and Windows.
- **Developer Attribution:** Credited Baizid Al Hamid across native About dialogs, menus, package metadata, and dashboard footers.
- **Unified Single Repository & Copyleft Licensing:** Hosted at `BAIZ1D/dead-again-revamped`, licensed under GNU Affero General Public License v3.0 (AGPL-3.0) with third-party open-source acknowledgments in `LICENSE-THIRD-PARTY.txt`.
- **Polished Streamer Quick-Start Guide (`STREAMER_GUIDE.md`):** Clear 3-minute onboarding covering macOS Gatekeeper bypass, Windows SmartScreen bypass, and OBS Window Capture setup.
- **Hardened Relay Server Lifecycle (`RELAY-04`, `RELAY-05`, `RELAY-06`):** Strict loopback `127.0.0.1` binding, `process.env.APG_CONFIG_PATH` OS user data persistence, and IPC `{ type: "RELAY_READY" }` / `{ type: "SHUTDOWN" }` teardown with 1.5s force-kill safety.
- **Electron Launcher Infrastructure (`DESK-01` through `DESK-06`):** Single-instance locking, dynamic port fallback (8085 -> 8086-8105), background supervisor with zero zombies, primary 16:9 OBS-unthrottled Game Window (`backgroundThrottling: false`), persistent hide-on-close Streamer Dashboard (`Cmd/Ctrl+D`, `F1`, pause button), and secure preload bridge.
- **Cross-Platform Packaging & Asset Pipeline (`PKG-01` through `PKG-05`):** Offline pure JS icon generation producing master 1024x1024 PNG, macOS `.icns`, Windows multi-res `.ico`, distinct Twitch purple dashboard badge, custom 540x380 DMG background, and web favicons. Universal macOS (`.dmg`, `.zip`) and Windows (`.exe` NSIS, portable `.zip`).
- **In-App Version & Update Checker (`PKG-07`):** Non-blocking GitHub Releases API checker (`desktop/updater.js`) with 3s timeout resilience, semantic versioning, glowing dashboard update pill, session dismissal via `sessionStorage`, and Release Card modal.
- **Automated GitHub Actions CI/CD Pipeline (`PKG-06`):** Multi-platform matrix CI (`.github/workflows/build-release.yml`) on free `macos-latest` and `windows-latest` runners generating Draft Releases and Workflow Artifacts.

### Milestone v1.3: HUD Layout & Streamer Dashboard Polish (Shipped 2026-11-05)

- **HUD-01: Left-Middle Chat Stream:** Relocated live chat updates and community action toasts to the left-middle column below player avatar and ammo counters (`currY = Math.max(H * 0.38, u * 6.8)`), eliminating overlap with health and ammo boxes.
- **HUD-02: Middle-Right Red Kill Counter:** Relocated red kill counter to middle-right margin (`overlayCanvas.height * 0.38`), eliminating overlap with top-right status badges and Karma bar.
- **HUD-03: Title Screen Ergonomics:** Polished title screen with centered OS-aware shortcut prompts ("Press Cmd+D to Open Streamer Dashboard" on macOS, "Press Ctrl+D to Open Streamer Dashboard" on Windows).
- **DASH-01, DASH-02, DASH-03: Audience Rebranding:** Rebranded mock bot swarm from "Student" to "Audience" across backend engine, dashboard UI, and in-game name tagging (`@Audience_1..25`).
- **BUILD-01, BUILD-02: Non-Destructive Build Integrity:** 100% test passes across packaging, distribution, and runtime verification suites with zero build regressions.

### Milestone v1.4: Game Balancing & Survival Tension Overhaul (Shipped 2026-11-06)

- **BAL-15: Tiered Drop Economy & Clutch Throttle:** Regular enemy kill drop rate reduced from 20% to tiered rates (5% Zombie, 10% Vampire, 12% Ghost; ~7% blended) with clutch floor (<3 bullets, <2 shells/rifle) and 60f multi-kill throttle.
- **BAL-16: Scavenged Munitions & 4.0s Fail-Safe:** Scavenged enemy clips reduced to +2 bullets / +1 shell / +1 rifle round (0.75x visual scale, 1.6-pitch chirp), map supply crates tuned to +8/+3/+2, and 0-ammo fail-safe crate cooldown increased to 240 frames (4.0s).
- **BAL-17: Pure Primary Care Packages & 30s Despawn:** Audience `!ammo` drops strictly deliver pure primary munitions (+4 bullets, +2 shells, +1 rifle) with zero cross-pool bleed. Mini-bosses drop Full Care Packages (+4/+2/+1). Care packages despawn at 30s and scavenged clips at 25s with 5s rapid warning flashing.
- **BAL-18: Combat Vulnerability & 1 HP Heartbeat:** Player post-hit invulnerability grace period halved from 90 frames (1.5s) to 45 frames (0.75s) with 15Hz red-ghost strobe and preserved radial knockback. Taking damage down to 1 HP triggers immediate double-thump heartbeat audio stinger, followed by subtle ~1.2Hz rhythmic pulses synchronized with HUD heart pip.
- **BAL-19: 4-Second Chat Boss Cooldown:** Twitch chat `!boss` command rate limit halved from 8000ms to 4000ms in relay server with dynamic viewer scaling, decoupled from 8000ms blackout, while preserving client 2-boss cap and empowerment stacking.
- **BAL-20: Autonomous Ambient Frenzy:** Ambient Frenzy waves auto-trigger every 45-60s during active gameplay (6.0s duration, 2.0s pre-surge rumble and red vignette telegraph, war horn audio stinger, and non-stacking 8.0s hard cap with chat).
- **BAL-21: Shotgun Gatekeeping & Ammo Preservation Polish:** Shotgun upgrade roll cut to 10% (0% in Levels 0-1), world shotguns replaced in Levels 0-1, reserve cap lowered to 8 shells with gold MAX badge, chamber rounds refunded to reserves on weapon swap, and level transition carryover clamped to 18 bullets / 4 shells / 3 rifle rounds.
- **BAL-22: Visual Clarity, Release Packaging & v1.0.1 Tag:** Full-screen haze alpha reduced from 25% down to 3.5% across all levels, application version bumped to v1.0.1 across package configurations and desktop updater fallbacks, annotated git tag `v1.0.1` created, and all 4 test suites verified 100% green.

### Milestone v1.5: UI Polish, Combat Balance & Visual Overhaul (Shipped 2026-11-06)

- **CLIP-03: Polymorphic Text Outline Signature:** Repaired `drawTextWithOutline` in `main.js` to polymorphically support 5-arg `(text, pos, size, textColor, outlineColor)` and 6-arg `(text, pos, size, textColor, outlineWidth, outlineColor)` invocations, preventing corrupted canvas `strokeStyle` assignments and clipping across all APG HUD components.
- **BAL-23: SMG Burst-Tap Precision vs Spray Bloom Physics:** Re-architected Machine Pistol (SMG) ballistics in `gunMachinePistol.js`: single-tap and 2-round burst firing delivers pinpoint trajectory ($S \le 0.02$ rad / $\approx 1.15^\circ$) with a 160ms burst recovery window; holding fire accelerates cyclic rate to 80ms (~12.5 shots/s; emptying 20-round chamber in ~1.6s) with non-linear bloom expansion up to $\pm 0.48$ rad ($\approx 27.5^\circ$), $\pm 8\%$ velocity jitter, and subtle directional kick.
- **CLIP-01: SMG 2x10 Wrapped Ammo Visualizer:** Re-engineered chambered bullet visualizer for weapons with $>6$ round capacity (SMG) in `ui.js` into a compact 2x10 grid ($0.52 \cdot \text{scaleUI}$, 20% alpha for spent rounds) strictly contained within the top-left equipment card, eliminating cross-screen bullet overflow.
- **HUD-04: Beneath-Avatar Player Health Telemetry:** Relocated player health pips (3 base pixel hearts and 1 golden shield pip) beneath the avatar portrait in LittleJS world coordinates (`pos.y - 1.35 * scaleUI`) with dark armored backing plate (`rgba(0, 0, 0, 0.45)`) and 1 HP biological double-beat pulse.
- **CLIP-02: Dynamic Center Banner Sizing & Relative Anchoring:** Re-architected center notification banners (Divine Flash, Blood Surge) in `apgManager.js` to dynamically scale container height (`u * 2.4` single-line vs `u * 3.4` dual-line), anchor text relative to banner box center, and downscale font sizes on long strings, completely resolving subtitle clipping.
- **VIS-01: Start Screen Retro Arcade Visual Overhaul:** Created `startScreen.js` (1046 lines) featuring procedural Canvas 2D heraldic crest with crossed Shotgun and SMG tiles at $\pm 35^\circ$ with specular glints; floating Survivor vs Zombie portraits with divine (`#FBF236`) and miasma (`#AC3232`) auras; 24 rising embers; CRT scanlines; multi-pass chromatic glows on "DEAD AGAIN"; 4-second specular sheen sweep; pulsating arcade CTA cartouche; in-game 3-tab Field Manual modal (`[H]`); unified multi-input controls; and 12-frame CRT phosphor flash wipe transition.
- **PKG-08: Release v1.2.0 Packaging & Meta-Verification:** Synchronized semantic version `1.2.0` across root `package.json`, `package-lock.json`, `relay-server/package.json`, `desktop/updater.js`, and `desktop/menu.js`; synchronized `README.md`; compiled clean 30-module production bundle `dist/js/index.js` (235.2 KB) with zero ES6 leakage; and passed all 7 regression test suites 100% green via `npm run test:phase18` in 7.80s.

---

## Current State

- **Version:** v1.2.0 (Shipped)
- **Repository:** Unified single repo `BAIZ1D/dead-again-revamped`
- **License:** GNU Affero General Public License v3.0 (AGPL-3.0)
- **Test Status:** 100% green across all 12 test suites (Phase 23, 22, 21, 20, 19, 18, 17, 16, 15, 13, 12, Packaging, Distribution) including 7-viewport multi-resolution Canvas 2D VM verification and full regression suite.
- **Milestones Completed:** v1.0, v1.1, v1.2, v1.3, v1.4, v1.5 (Phases 19, 20, 21, 22, 23 of v1.6 complete).

## Current Milestone: v1.6 UI Clipping Fixes, Retro Visuals & Endless Nightmare Mode (Release v1.3.0)

**Goal:** Eliminate HUD clipping defects, revamp the start screen into authentic 16-bit pixel aesthetics, provide on-screen Twitch command guidance for viewers, and deliver an endless multi-room Nightmare survival mode with escalating mob waves and up to 5 concurrent bosses.

**Target features:**
- Re-anchor top-left health bar (hearts and shield) snuggly under avatar portrait without left-edge clipping
- Deconflict vote lock announcement banners to prevent text overflowing banner boundaries
- Fix text wrapping and bounding box overflow across all Field Manual / Help tabs
- Populate Field Manual with complete weapon stats (Pistol, Shotgun, Rifle, SMG) and mob compendium (Zombies, Vampires, Ghosts, Bosses)
- Overhaul start screen into 16-bit retro arcade pixel aesthetic with animated fog, pixel moon, and graveyard skyline
- Add stream-friendly Twitch chat commands cheat-sheet overlay docked in safe margin (bottom-right)
- Implement post-Level 5 endless multi-room Nightmare dungeon with starting weapon spawns, escalating all-enemy waves, 5-boss audience cap, and high score survival tracking
- Release packaging synchronization to v1.3.0 with complete test suite verification

## Requirements

### Validated

- Milestone v1.0 Twitch APG Core Transformation requirements (37/37) -- v1.0
- Milestone v1.1 Gameplay & Balance Overhaul requirements (14/14) -- v1.1
- Milestone v1.2 Desktop Launcher & Packaging requirements (16/16) -- v1.2
- HUD-01 through HUD-03 & DASH-01 through DASH-03 requirements (8/8) -- v1.3
- BAL-15 through BAL-22 Game Balancing & Survival Tension requirements (8/8) -- v1.4
- CLIP-01, HUD-04, BAL-23, CLIP-02, CLIP-03, VIS-01, PKG-08 UI Polish, Combat Balance & Visual Overhaul requirements (7/7) -- v1.5
- CLIP-04, CLIP-05, CLIP-06 HUD Ergonomics, Banner Containment & Field Manual Text-Wrapping Engine (3/3) -- Phase 19 (v1.6)
- HELP-01, HELP-02, HELP-03 Field Manual Arsenal & Bestiary Compendium Completion (3/3) -- Phase 20 (v1.6)
- VIS-02, VIS-03, VIS-04 16-Bit Retro Arcade Start Screen Visual Overhaul (3/3) -- Phase 21 (v1.6)
- HUD-05, HUD-06 In-Game Stream Command Cheat-Sheet & Streamer Ergonomics (2/2) -- Phase 22 (v1.6)
- MODE-01, MODE-02, MODE-03, MODE-04, MODE-05 Endless Multi-Room Nightmare Survival Gauntlet (5/5) -- Phase 23 (v1.6)

### Active

- [x] Top-left health bar (hearts and shield) snug beneath avatar portrait with zero left-edge screen clipping (`CLIP-04` -- Phase 19)
- [x] Post-vote locked notification banner text strictly contained within banner bounding box (`CLIP-05` -- Phase 19)
- [x] Field manual / Help modal text layout and wrapping across all tabs contained within bounds (`CLIP-06` -- Phase 19)
- [x] Complete arsenal and bestiary documented in Help tabs (all 4 guns and all enemy types) (`HELP-01..03` -- Phase 20)
- [x] 16-bit retro pixel art start screen backdrop and title treatment matching core game aesthetic (`VIS-02..04` -- Phase 21)
- [x] In-game stream-visible Good/Bad chat commands cheat-sheet overlay positioned in bottom-right margin with hotkey toggle (`HUD-05..06` -- Phase 22)
- [x] Endless multi-room Nightmare Level progression after Level 5 with all weapons scattered in starting rooms, escalating waves, 5-boss audience cap, and survival scoring (`MODE-01..05` -- Phase 23)
- [ ] Semantic version v1.3.0 bump across manifests and full test suite verification (`PKG-09..10` -- Phase 24)

### Out of Scope

- Modifying LittleJS engine core (`main/src/js/engine.all.release.js`)
- Paid code signing certificates (Apple Developer Program / Microsoft Authenticode)
- Real-money transactions or pay-to-win microtransactions

## Constraints

- **Architecture**: No ES6 modules inside `main/src/js/` to preserve concatenation compatibility.
- **Port Allocation**: Relay server operates on dynamic loopback starting at port 8085.
- **Currency**: Zero pay-to-win or real money. Must adhere strictly to Twitch Developer Services Agreement.
- **Latency**: WebSocket relay to game client must deliver action triggers under 200ms.
- **Streamer Ergonomics**: Zero-terminal standalone desktop launcher with dual-window layout (OBS game window + streamer dashboard).

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-10 after Phase 22 completion (Milestone v1.6)*
