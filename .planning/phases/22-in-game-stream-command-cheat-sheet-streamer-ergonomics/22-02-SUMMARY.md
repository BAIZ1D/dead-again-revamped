---
phase: 22-in-game-stream-command-cheat-sheet-streamer-ergonomics
plan: 02
subsystem: ui
tags: [canvas-2d, littlejs, twitch-apg, hud, cheat-sheet, pause-menu, localStorage, gamepad]

# Dependency graph
requires:
  - phase: 22-in-game-stream-command-cheat-sheet-streamer-ergonomics
    provides: Desktop exit IPC bridge, Start Screen [ EXIT GAME ] button, and Field Manual Tab 3 cheat-sheet documentation (22-01)
provides:
  - Resilient localStorage preference helpers (safeGetPref, safeSetPref) and global cheat-sheet state lifecycle (g_cheatsheetVisible, g_cheatsheetDock, g_cheatsheetSlideProgress, g_lastInputGamepad) in main.js
  - Clean run abandonment routine (abandonRunToMainMenu) purging active entities and returning to STATE_CLICK_TO_START
  - Dual-column procedural Canvas 2D Twitch command cheat-sheet overlay (renderCheatSheet) with 10 action-oriented summaries, safe-margin right/left docking, pure auto-hide, 45-frame pause-synchronized trigger pulse glows, and 30-frame major event border flares in apgManager.js
  - Interactive Pause Menu buttons ([C] CHEAT-SHEET: [ON/OFF], [DOCK: RIGHT/LEFT], [ QUIT TO MAIN MENU ]) with tactile audio and hover feedback in ui.js
affects: [22-03-PLAN, 24-release-v1-3-0-packaging-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Try/catch localStorage wrapper helpers (safeGetPref / safeSetPref) for sandboxed/incognito resilience"
    - "Pause-synchronized frame decay counters (commandPulseFrames, cheatSheetFlare) that freeze during g_isPaused"
    - "Pure auto-hide HUD overlay (0 pixels rendered when slideProgress <= 0.001) with strict overlayContext.save()/restore() isolation"
    - "Combat mouse pass-through: cheat-sheet overlay is 100% click-through while unpaused, interactive controls scoped to g_isPaused"

key-files:
  created: []
  modified:
    - main/src/js/main.js
    - main/src/js/apgManager.js
    - main/src/js/ui.js
    - main/dist/js/index.js

key-decisions:
  - "Evaluated keyIsDown(16) (Shift) first inside keyWasPressed(67) ('C') so Shift+C exclusively flips docking side without triggering visibility toggle"
  - "Maintained dedicated frame counters (commandPulseFrames and cheatSheetFlare.frames) decremented in APGManager.update() only when !g_isPaused so pausing mid-raid preserves the 45-frame neon command highlight"
  - "Clamped default right dock to [0.74W, 0.98W] x [0.72H, 0.96H] and mirrored left dock to [0.02W, 0.26W] x [0.72H, 0.96H] to guarantee geometric clearance from the Karma tug-of-war meter, red kill counter, and chat toast stream across all 7 resolutions"

patterns-established:
  - "Chorded hotkey disambiguation: check modifier keyIsDown(16) inside primary keyWasPressed(67) branch before fallback toggle"
  - "Pause-synchronized HUD telemetry decay: gate frame counter decrements behind if (typeof g_isPaused === 'undefined' || !g_isPaused)"

requirements-completed:
  - HUD-05
  - HUD-06

# Metrics
duration: 6min
completed: 2026-11-10
---

# Phase 22 Plan 02: In-Game Twitch Command Cheat-Sheet Overlay, Live Trigger Pulse & Pause Menu Ergonomics Summary

**Dual-column Canvas 2D Twitch APG command cheat-sheet overlay (`renderCheatSheet`) with 45-frame pause-synchronized neon trigger pulses, `[C]` / `Shift+C` / `[SELECT]` hotkeys, safe-margin right/left docking, and interactive Pause Menu streamer controls**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-10T07:44:39Z
- **Completed:** 2026-11-10T07:50:15Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Implemented `safeGetPref` and `safeSetPref` in `main/src/js/main.js` with try/catch wrapping, initialized `g_cheatsheetVisible`, `g_cheatsheetDock`, `g_cheatsheetSlideProgress`, and `g_lastInputGamepad`, wired `[C]`, `Shift+C`, and Gamepad Select (`gamepadWasPressed(8)`) hotkeys with 7-frame slide/alpha interpolation, and added `abandonRunToMainMenu()` for clean run teardown.
- Built `renderCheatSheet(W, H, u)` and `triggerCheatSheetFlare(col, frames)` on `APGManager` (`main/src/js/apgManager.js`) featuring a translucent slate backplate (`rgba(10, 14, 20, 0.75)`), dynamic `[C]` / `[SELECT]` header badge, Team Good (`#4ADE80`) and Team Bad (`#FF4D4D`) columns with 10 action-oriented tactical summaries, 45-frame decaying neon command pulses with 1.05x micro-scale punch, 30-frame major event border hue surges, and pure auto-hide when collapsed.
- Expanded the in-game Pause Menu card in `main/src/js/ui.js` (`cardH = H * 0.64`) with interactive buttons for `[C] CHEAT-SHEET: [ON/OFF]`, `[DOCK: RIGHT/LEFT]`, and `[ QUIT TO MAIN MENU ]` with `uiSound(1)` tactile audio feedback.

## Task Commits

Each task was committed atomically:

1. **Task 1: Storage Helpers, Cheat-Sheet State Lifecycle, Hotkey/Gamepad Polling & Run Abandonment in main.js** - `ea0577e` (feat)
2. **Task 2: Twitch APG Cheat-Sheet Overlay Engine, Pulse Decay Timers & Major Event Flares in apgManager.js** - `26090b8` (feat)
3. **Task 3: In-Game Pause Menu Interactive Buttons and Ergonomic Controls in ui.js** - `13bf413` (feat)

## Files Created/Modified
- `main/src/js/main.js` - Added `safeGetPref`, `safeSetPref`, global cheat-sheet state variables, `abandonRunToMainMenu()`, input device detection, `[C]` / `Shift+C` / `gamepadWasPressed(8)` hotkeys, and slide progress interpolation.
- `main/src/js/apgManager.js` - Added `commandLastTriggered`, `commandPulseFrames`, `cheatSheetFlare`, pause-synchronized decay in `update()`, `triggerCheatSheetFlare()`, and `renderCheatSheet(W, H, u)` called from `renderHUD()`.
- `main/src/js/ui.js` - Expanded Pause Menu card height to `H * 0.64` and added interactive `[C] CHEAT-SHEET: [ON/OFF]`, `[DOCK: RIGHT/LEFT]`, and `[ QUIT TO MAIN MENU ]` buttons.
- `main/dist/js/index.js` - Recompiled 30-file production game bundle cleanly.

## Decisions Made
- Checked `keyIsDown(16)` (Shift) first inside `keyWasPressed(67)` ('C') so `Shift+C` flips the docking side between `'right'` and `'left'` without inadvertently toggling cheat-sheet visibility.
- Tracked command trigger glow pulses via a dedicated `commandPulseFrames` dictionary decremented only when `!g_isPaused`, ensuring that pausing the game freezes active command highlights rather than letting frame timestamps expire.
- Anchored the cheat-sheet card to `[0.74W, 0.98W] x [0.72H, 0.96H]` (Right Dock) and `[0.02W, 0.26W] x [0.72H, 0.96H]` (Left Dock), keeping it 100% click-through during unpaused combat (`D-21`) and fully illuminated on `overlayContext` during `!blackout` (`D-32`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All in-game cheat-sheet overlay rendering, live command pulse animations, hotkey/controller toggles, docking flips, and Pause Menu controls are implemented and verified against `test:phase19`, `test:phase20`, and `test:phase21`.
- Ready for Plan 22-03 (`scripts/test-phase22.js` automated static contract and 7-viewport headless VM verification suite).

## Self-Check: PASSED
- Verified `main/src/js/main.js`, `main/src/js/apgManager.js`, `main/src/js/ui.js`, and `main/dist/js/index.js` exist and compile cleanly.
- Verified task commits `ea0577e`, `26090b8`, and `13bf413` exist in git history.
- Verified `npm run test:phase21`, `npm run test:phase20`, and `npm run test:phase19` pass 100% green.

---
*Phase: 22-in-game-stream-command-cheat-sheet-streamer-ergonomics*
*Completed: 2026-11-10*
