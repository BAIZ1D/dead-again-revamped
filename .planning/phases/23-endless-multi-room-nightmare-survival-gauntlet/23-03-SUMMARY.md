# Phase 23 Plan 03: Stage Transition, Telemetry, Defeat Flow & Twitch Sync Summary

## Overview
Implemented seamless campaign-to-endless progression, high-stakes Twitch APG prediction lobbies with procedural 12x12 pixel skulls, the animated 'DEAD AGAIN' defeat screen enforcing campaign climb integrity, real-time HUD telemetry with persistent high scores, audience sabotage pacing, 100% Karma clutch events, and Streamer Dashboard live status synchronization.

## Accomplishments
1. **Stage Transition & Campaign Climb Gate (`main.js`, `ui.js`)**:
   - Defeating the Level 5 Boss (`g_level === 4`) now initiates the Nightmare Gauntlet: triggers golden shockwave fanfare (`soundDivineFlash`), flashes screen `#fbf236`, refreshes player to 3 full hearts (`g_player.hp = 3`), advances `g_level = 5` (Nightmare Wave 1 / overall wave 6), and enters `STATE_LOBBY` with a 15-second prediction countdown.
   - Elimination in Nightmare Mode routes to `STATE_OUTCOME` with an animated 'DEAD AGAIN' defeat screen.
   - Enforced campaign climb integrity (Decisions D-38, D-39): Defeat screen strictly offers `[RESTART CAMPAIGN]` (which resets `g_level = 0`, starting at Level 1) and `[MAIN MENU]` (returning to Title Screen), with zero direct gauntlet restart shortcuts.
   - Interactive defeat buttons docked in safe lower-center bounds `[0.35W, 0.65W] x [0.78H, 0.90H]` with keyboard (`[W]`/`[S]`, Up/Down, Enter/Space), mouse hover/click, and Gamepad D-pad/A navigation.

2. **15s Prediction Lobbies with Procedural 12x12 Skulls (`apgManager.js`, `ui.js`, `main.js`)**:
   - For Nightmare waves (`g_level >= 5`), prediction duration is set to 15 seconds (down from 60s) with early lock supported via `[SPACE]`, Right Mouse Click, or Gamepad A.
   - Header banner displays `'NIGHTMARE WAVE [N]: Will streamer survive?'` styled with crimson-violet borders (`#792138` / `#560039`).
   - Flanked by 12x12 procedural Canvas 2D drawn pixel-art skulls (`drawPixelSkull`) with glowing eye pips pulsating via `Math.sin(frame / 10)`.
   - On wave clear (last mob slain), prediction settles immediately during a 4-second tally banner before cycling to the next room's 15s prediction lobby (Decision D-04).

3. **Top-Center Telemetry Plate & Persistent High Scores (`main.js`, `ui.js`, `startScreen.js`)**:
   - Top-center crimson telemetry plate docked at `[0.38W, 0.62W] x [0.02H, 0.08H]` displaying `NIGHTMARE WAVE [N]` (gold/crimson), MM:SS clock, and mob count (`MOBS: [alive]/[cap]`).
   - Storage schema implemented with safe fallback wrappers: `safeGetPref`/`safeSetPref` managing `da_nightmare_best_wave`, `da_nightmare_best_time`, and `da_high_score` with corrupted data recovery (NaN resets to 0 silently per D-51).
   - High scores update immediately on wave completion (`setNightmareBestWave`, `setNightmareBestTime`, Decision D-50).
   - Personal Best flare: When exceeding prior best wave, displays a golden banner `★ NEW PERSONAL BEST WAVE [N]! ★` with ascending chime.
   - Start Screen renders a 16-bit retro arcade record plaque `BEST SURVIVAL: WAVE [N] - [TIME]` between the title crest and play button.
   - Pause Menu provides a `[RESET HIGH SCORES]` button with two-click confirmation (`⚠ CONFIRM RESET HIGH SCORES? ⚠`).

4. **Audience Sabotage Pacing & Karma Clutch Events (`apgManager.js`, `gun.js`)**:
   - Sabotage pacing limits: 12-second grace period after blackout ends (`blackoutGracePeriodFrames = 720`, D-24); 10-second jam immunity after a player completes a reload (`jamImmunityFrames = 600`, D-25); maximum 2 concurrent major sabotages (`getActiveSabotageCount() >= 2` blocks/rejects a 3rd, D-26); hard cap of 5 concurrent living audience bosses (D-27).
   - 100% Karma Clutch Events:
     - **100% Good (Holy Flash):** 3-second holy stun on all mobs/bosses, vaporizes airborne boulders, grants 2.5s player invulnerability, purges active sabotages (D-60).
     - **100% Bad (Blood Eclipse):** 8-second blood frenzy (+35% speed), spawns 1 bonus audience boss, dims arena lights to 30% (D-61).
     - Recenters Karma to 50/50 with a 10-second lock (`karmaClutchCooldown = 600`, D-62).
     - Rapid meter pulse and flashing directional chevron edge indicators (`<<<` / `>>>`) when Karma exceeds 80% (D-63).

5. **Streamer Dashboard Synchronization (`relay-server/public/index.html`, `dashboard.css`, `dashboard.js`)**:
   - Header status badge switches to a pulsating crimson `NIGHTMARE GAUNTLET - WAVE [N]` badge in Nightmare mode.
   - Dedicated audience boss panel with live mini-cards displaying boss index, summoner name, and animated health bars for up to 5 concurrent active audience bosses.

## Verification
- Automated build (`scripts/build-game.js`) succeeded in 114ms with zero syntax errors.
- Phase 22 regression test suite (`npm run test:phase22`) passed 100% across all static contracts and 7-viewport VM behavioral simulations.
- Verified storage serialization, corrupted data recovery, APGManager karma clutch events, sabotage caps, and procedural skull rasterization in Node VM.

## Self-Check: PASSED
- `main/src/js/main.js` implements stage transition at `g_level === 4`, campaign climb gate, defeat routing, and storage helpers.
- `main/src/js/apgManager.js` implements sabotage pacing, 100% Karma clutch events, 80% chevrons, and immediate wave clear settlement.
- `main/src/js/ui.js` implements 12x12 procedural skulls, animated 'DEAD AGAIN' defeat screen, top-center telemetry plate, and pause menu high score reset.
- `main/src/js/startScreen.js` renders 16-bit retro arcade record plaque.
- `relay-server/public/index.html`, `dashboard.css`, `dashboard.js` implement pulsating nightmare badge and live boss mini-cards.
- All code committed with atomic git history.
