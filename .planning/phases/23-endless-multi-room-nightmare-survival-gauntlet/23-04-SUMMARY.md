# Phase 23 Plan 04: Audio Synthesis, Wave Micro-Purge & OBS Retina Capture Fix Summary

## Overview
Implemented complete procedural ZzFX audio stingers and dynamic music tempo/volume scaling, automated wave-boundary micro-purge memory hygiene, clamped screen shake and camera aim-lead lookahead margins, and resolved OBS macOS Retina window capture scaling across web and Electron desktop runtimes.

## Accomplishments
1. **Procedural ZzFX Audio Synthesis & Acoustic Occlusion (`sounds.js`)**:
   - Synthesized procedural ZzFX sound effects without external files:
     - `soundDoorBash`: Low creak and wood impact thump with pitch variation for barricade impacts.
     - `soundDoorBreak`: Shattering wood splinter burst for barricade door destruction.
     - `soundWaveSurvival`: Harmonious ascending tone for wave survival completion.
     - `soundDefeatCrash`: Distorted minor chord crash for player defeat/death.
   - Implemented acoustic distance attenuation and door/wall occlusion via `playSoundOccluded`:
     - Checks raycasts against solid walls (`tileCollisionRaycast`) and closed barricade doors (`g_doors`).
     - Applies -40% muffling (0.6x volume multiplier) when occluded behind closed barricades or solid walls per Decision D-32.

2. **Dynamic Chiptune Scaling & Critical 1-HP Heartbeat (`music.js`)**:
   - Dynamic tempo escalation (`updateMusicDynamicScaling`): Increases chiptune music tempo by $+2\text{ BPM}$ per wave from 50 up to 70 max (Decision D-28).
   - Dynamic volume ducking: Ducks music volume by $30\%$ (0.7x volume) when player drops to $\le 1$ heart or faces $\ge 3$ active bosses, emphasizing threat presence (Decision D-30).
   - Procedural heartbeat pulse: Triggers low-frequency biological thump (`soundHeartbeat`) at 1 HP during active combat (Decision D-30).

3. **Automated Wave-Boundary Micro-Purge (`main.js`)**:
   - Implemented `performWaveMicroPurge()` invoked on wave clear transitions and inside `enterLobbyState()`:
     - Prunes zombie corpses and blood particle emitters older than 30 seconds (1800 frames) or exceeding a total pool of 60 items, properly invoking `corpse.destroy()` and `corpse.bloodEmitter.destroy()` (Decision D-19).
     - Prunes ground splatters exceeding 60 items.
     - Clears out-of-range dynamic shadow tiles beyond 20 world tiles from the player.
     - Prunes expired or stray `ParticleEmitter` objects in `engineObjects`.

4. **Screen Shake & Camera Aim-Lead Margin Clamps (`fx.js`, `main.js`)**:
   - Screen shake clamp: Clamped `amt` in `fx_shakeScreen` to a maximum ceiling of $0.35$ world tiles, with rapid 6-frame exponential decay (`-0.6` multiplier, zeroing under $0.01$) in `fx_updateScreenShake` per Decision D-64.
   - Camera aim-lead margin clamp: Lookahead offset is clamped such that the player entity never drifts closer than $4.5$ tiles to the screen edge across any aspect ratio, and camera bounds are clamped against map perimeter walls (`tileCollisionSize`) per Decision D-65.

5. **OBS macOS Retina Window Capture Scaling Fix (`desktop/windowManager.js`, `index_dev.html`, `index.html`)**:
   - Added viewport meta tag (`width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`) to `main/src/html/index_dev.html` and `main/dist/index.html`.
   - Enforced explicit CSS styling on `canvas` (`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100% !important; height: 100% !important; object-fit: contain;`).
   - Configured Electron `BrowserWindow` with `useContentSize: true` and synchronized visual zoom level limits (`setVisualZoomLevelLimits(1, 1)`) to eliminate 2x Retina backing store cropping in OBS Window Capture (Decision D-67).

## Verification
- Automated build (`scripts/build-game.js`) completed in 82ms with zero compilation errors.
- Phase 22 regression test suite (`npm run test:phase22`) passed 100% across all static contracts and 7-viewport VM simulations.
- Validated `playSoundOccluded` muffling logic, `updateMusicDynamicScaling` rate/duck calculations, `performWaveMicroPurge` entity pruning, and `fx_shakeScreen` ceiling clamp.

## Self-Check: PASSED
- `main/src/js/sounds.js` provides procedural audio definitions and `playSoundOccluded`.
- `main/src/js/music.js` provides `updateMusicDynamicScaling` with tempo escalation and ducking.
- `main/src/js/fx.js` clamps screen shake to 0.35 tiles with rapid 6-frame decay.
- `main/src/js/main.js` implements `performWaveMicroPurge` and clamped camera aim-lead lookahead.
- `main/src/html/index_dev.html` and `main/dist/index.html` provide viewport meta tag and 100% canvas containment styles.
- `desktop/windowManager.js` sets `useContentSize: true` and `setVisualZoomLevelLimits(1, 1)`.
- All code committed with atomic git history.
