---
phase: 22-in-game-stream-command-cheat-sheet-streamer-ergonomics
plan: 01
subsystem: ui
tags: [electron, ipc, streamer-dashboard, kofi, canvas-2d, start-screen, littlejs]

# Dependency graph
requires:
  - phase: 19-hud-ergonomics-banner-containment-field-manual-text-wrapping-engine
    provides: Universal drawWrappedText engine and HiDPI Field Manual modal container scaling
  - phase: 20-field-manual-arsenal-bestiary-compendium-completion
    provides: Field Manual Tab 3 Twitch APG matrix and Streamer Setup bottom-right card
  - phase: 21-16-bit-retro-arcade-start-screen-visual-overhaul
    provides: 16-bit start screen safe zone layout, badge rendering, and interactive hover/click state machine
provides:
  - Desktop application exit IPC bridge (window.electronAPI.exitApp -> desktop:exit-app -> app.quit() with cleanTeardown)
  - Streamer Dashboard monetization overhaul replacing legacy #viewer-badge with warm coral/amber .bmc-kofi-btn (☕ Buy Me A Coffee!) and null-guarded viewerBadge references
  - Start Screen retro [ EXIT GAME ] button at H * 0.88 with #AC3232 crimson border, hover glow, and desktop/browser exit routing
  - Field Manual Tab 3 and STREAMER_GUIDE.md documentation for [C] and Shift+C cheat-sheet overlay ergonomics
affects: [22-02-PLAN, 22-03-PLAN, 24-release-v1-3-0-packaging-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-parameter IPC exit bridge (desktop:exit-app) delegating to Electron app.quit() to ensure supervised before-quit relay process teardown"
    - "Defensive DOM null-guarding (if (viewerBadge)) in dashboard telemetry handlers when retiring legacy badge elements"
    - "Dual-environment application exit routing (window.electronAPI.exitApp() on Electron desktop with window.close() web fallback)"

key-files:
  created: []
  modified:
    - desktop/preload.cjs
    - desktop/main.js
    - relay-server/public/index.html
    - relay-server/public/css/dashboard.css
    - relay-server/public/js/dashboard.js
    - main/src/js/startScreen.js
    - STREAMER_GUIDE.md

key-decisions:
  - "Exposed a zero-argument window.electronAPI.exitApp() preload method sending desktop:exit-app to ipcMain, which calls app.quit() so the existing before-quit hook runs cleanTeardown() and stops the background relay child process cleanly"
  - "Replaced the non-functional VIEWERS: 0 badge in the Streamer Dashboard header with a warm coral/amber gradient CTA (☕ Buy Me A Coffee!) routed through desktop:open-external IPC on desktop, while wrapping viewerBadge updates in dashboard.js with null guards"
  - "Anchored the Start Screen [ EXIT GAME ] button at H * 0.88 between [H] HOW TO PLAY & GUIDE (H * 0.83) and the dashboard shortcut prompt (H * 0.93) within isolated save()/restore() canvas state to preserve zero-deviation stack balance"

patterns-established:
  - "IPC exit lifecycle: renderer calls window.electronAPI.exitApp() -> preload sends desktop:exit-app -> main calls app.quit() -> before-quit runs cleanTeardown()"
  - "Canvas 2D button state isolation: wrap button backplate and shadowBlur strokes in overlayContext.save()/restore() before drawTextWithOutline"

requirements-completed:
  - HUD-05
  - HUD-06

# Metrics
duration: 5min
completed: 2026-11-10
---

# Phase 22 Plan 01: Desktop Exit IPC Bridge, Streamer Dashboard Monetization Overhaul & Start Screen Exit Ergonomics Summary

**Desktop `desktop:exit-app` IPC teardown bridge, Streamer Dashboard `☕ Buy Me A Coffee!` monetization CTA with null-guarded viewer badge removal, and Start Screen `[ EXIT GAME ]` button with updated `[C]` / `Shift+C` cheat-sheet documentation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-10T07:37:24Z
- **Completed:** 2026-11-10T07:42:15Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Exposed `window.electronAPI.exitApp()` in `desktop/preload.cjs` and registered the `desktop:exit-app` IPC listener in `desktop/main.js` invoking `app.quit()`, ensuring the supervised `before-quit` lifecycle runs `cleanTeardown()` and `relayManager.stop()` without orphaned processes.
- Overhauled the Streamer Dashboard header and update modal (`relay-server/public/index.html`, `dashboard.css`, `dashboard.js`) by removing the obsolete `#viewer-badge` counter, styling `#kofi-header-btn` and `#btn-support-kofi` as warm coral/amber `.bmc-kofi-btn` (`☕ Buy Me A Coffee!`) CTAs routing via `openExternal('https://ko-fi.com/baiz1d')`, and wrapping `viewerBadge` assignments in defensive null guards.
- Added the retro `[ EXIT GAME ]` button to the Start Screen (`main/src/js/startScreen.js`) at `H * 0.88` with crimson `#AC3232` framing, pointer hover feedback, audio stinger, and desktop/browser exit routing, alongside updating Field Manual Tab 3 and `STREAMER_GUIDE.md` with `[C]` and `Shift+C` cheat-sheet controls.

## Task Commits

Each task was committed atomically:

1. **Task 1: Desktop Application Exit IPC Bridge in Electron Preload and Main Processes** - `0f0dc8e` (feat)
2. **Task 2: Streamer Dashboard Monetization Overhaul, Purge Viewer Badge & Add Null Guards** - `a6b91f6` (feat)
3. **Task 3: Start Screen [ EXIT GAME ] Button, Hover Handling & Tab 3 Footer Documentation** - `617af17` (feat)

## Files Created/Modified
- `desktop/preload.cjs` - Added `exitApp: () => ipcRenderer.send('desktop:exit-app')` to `window.electronAPI`.
- `desktop/main.js` - Registered `ipcMain.on('desktop:exit-app', () => app.quit())` handler inside `initApp()`.
- `relay-server/public/index.html` - Removed `#viewer-badge` and upgraded `#kofi-header-btn` and `#btn-support-kofi` to `☕ Buy Me A Coffee!` with `.bmc-kofi-btn`.
- `relay-server/public/css/dashboard.css` - Defined `.bmc-kofi-btn` and `.bmc-kofi-btn:hover` with `linear-gradient(135deg, #FF5E5B, #FFAA00)` and `#ffcc00` border glow.
- `relay-server/public/js/dashboard.js` - Added `if (viewerBadge)` null guard in `updateStatusUI()` and click handler on `#kofi-header-btn` routing through `openExternal()`.
- `main/src/js/startScreen.js` - Added `g_startHoverExit`, rendered `[ EXIT GAME ]` at `H * 0.88`, wired hover/click exit handling in `updateStartScreen()`, and appended cheat-sheet hotkey guidance in `renderHelpTabStreamer()`.
- `STREAMER_GUIDE.md` - Added subsection documenting `[C]` / `[SELECT]` cheat-sheet toggle, `Shift+C` docking flip, `[ QUIT TO MAIN MENU ]`, and `[ EXIT GAME ]`.

## Decisions Made
- Used a zero-parameter `desktop:exit-app` IPC event rather than generic shell or process termination hooks to uphold ASVS L1 V14.4 IPC security and guarantee `cleanTeardown()` execution on quit.
- Preserved `#btn-support-kofi` element ID while adding `.bmc-kofi-btn` styling so existing Phase 9 distribution tests (`scripts/test-phase9-distribution.js`) continue to pass 100% green.
- Wrapped `[ EXIT GAME ]` button drawing in `overlayContext.save()` / `overlayContext.restore()` and explicitly cleared `shadowBlur = 0` so downstream HUD and start screen passes experience zero canvas state bleed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Desktop exit IPC bridge, Streamer Dashboard monetization overhaul, and Start Screen `[ EXIT GAME ]` ergonomics are complete and verified against `test:phase16`, `test:phase17`, `test:phase19`, `test:phase20`, `test:phase21`, and `test-phase9-distribution.js`.
- Ready for Plan 22-02 (In-Game Twitch Command Cheat-Sheet Overlay, Live 45-Frame Trigger Pulse, Hotkey Toggles & Pause Menu Controls).

## Self-Check: PASSED
- Verified all 7 modified files exist on disk and `main/dist/js/index.js` compiles cleanly.
- Verified task commits `0f0dc8e`, `a6b91f6`, and `617af17` exist in git history.
- Verified `npm run test:phase21`, `npm run test:phase20`, and `node scripts/test-phase9-distribution.js` pass 100% green.

---
*Phase: 22-in-game-stream-command-cheat-sheet-streamer-ergonomics*
*Completed: 2026-11-10*
