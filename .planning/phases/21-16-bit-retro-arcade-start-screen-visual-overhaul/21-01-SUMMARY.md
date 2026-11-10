---
phase: 21-16-bit-retro-arcade-start-screen-visual-overhaul
plan: 01
subsystem: ui
tags: [canvas-2d, retro-arcade, bayer-dithering, parallax-fog, graveyard-silhouette, zzfx, littlejs]

# Dependency graph
requires:
  - phase: 17-start-screen-retro-arcade-visual-overhaul
    provides: Modular 14-function start screen architecture, heraldic shield crest, crossed weapons, embers, CRT scanlines
  - phase: 19-hud-ergonomics-banner-containment-field-manual-text-wrapping-engine
    provides: Universal drawWrappedText engine and HiDPI Field Manual modal container scaling
  - phase: 20-field-manual-arsenal-bestiary-compendium-completion
    provides: 3-tab Field Manual arsenal, bestiary dossiers, and 10-command Twitch APG matrix
provides:
  - Procedural 16-bit Bayer-dithered Blood/Harvest Moon engine (renderStartMoon) with 3 craters, twin breathing halo rings, and click easter egg
  - 3-plane Gothic Graveyard Silhouette engine (renderStartGraveyard) along a scooped U-profile horizon with lancet window flicker and wrought-iron spear railings
  - 3-layer Parallax Drifting Pixel Fog engine (renderStartParallaxFog) with quantized 4px ribbons and 1-in-2 Bayer dithered crests constrained below the CTA cartouche
  - 15-step Atmospheric Depth Sandwich Z-Stack in renderStartScreen() with 12-frame white-to-crimson phosphor flash decay, 4-frame modal spring scale, ZzFX wind whisper, pitch-shifted tab chirps, and hover glow surge
affects: [21-02-PLAN, 24-release-v1-3-0-packaging-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static normalized coordinate anchor tables (START_GRAVEYARD_PLANE1..3, START_MOON_CRATERS, START_BAYER_4X4) for zero-allocation 60 FPS procedural Canvas 2D rendering"
    - "15-step Atmospheric Depth Sandwich Z-Stack interleaving sky gradient, moon, 3 graveyard planes, and 3 parallax fog layers behind foreground UI and CRT optics"

key-files:
  created: []
  modified:
    - main/src/js/startScreen.js

key-decisions:
  - "Anchored the celestial moon at 76% safeW X and 21% safeH Y with radius 3.7u and responsive integer Bayer 4x4 stepping Math.max(2, Math.round(u / 8)) to preserve 16-bit pixel chunkiness across 720p to 4K and prevent ultrawide clipping"
  - "Constructed a parabolic scooped U-profile horizon (0.76 - 0.16 * scoop) dipping to 24% height from bottom at screen center and rising to 40% at flanks, ensuring full-bleed edge-to-edge coverage while keeping the central hero crest and CTA cartouche unencumbered"
  - "Clamped all 3 parallax fog wave crests strictly below H * 0.74 + ctaH / 2 + buffer so undulating mist never obscures the primary CTA text"

patterns-established:
  - "Plane-indexed and layer-indexed procedural rendering: renderStartGraveyard(W, H, u, safeW, safeH, plane) and renderStartParallaxFog(W, H, u, layer) allow interleaved depth sandwiching or single-call full rendering"
  - "Strict Canvas 2D save()/restore() stack isolation across all 15 depth layers and sub-primitives (net stack deviation = 0)"

requirements-completed:
  - VIS-02
  - VIS-03
  - VIS-04

# Metrics
duration: 8min
completed: 2026-11-10
---

# Phase 21 Plan 01: Procedural 16-Bit Celestial Moon, Multi-Plane Graveyard & 3-Layer Parallax Fog Engine Summary

**Procedural 16-bit Bayer-dithered Blood/Harvest Moon, 3-plane scooped-horizon gothic graveyard silhouette, and 3-layer parallax pixel fog orchestrated in a 15-step atmospheric depth sandwich with zero external asset overhead**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-10T05:50:00Z
- **Completed:** 2026-11-10T05:57:46Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Implemented `renderStartMoon(cx, cy, u, W, H, safeW, safeH)` in `main/src/js/startScreen.js` featuring a 4x4 Bayer ordered dither matrix, responsive integer stepping (`Math.max(2, Math.round(u / 8))`), a Blood/Harvest hybrid palette (`#FDE047`, `#F59E0B`, `#EA580C`, `#7F1D1D`, `#450A0A`), 3 shaded craters (`#2B070E`, `#1E050A`), twin concentric breathing halo rings (`1.25 * moonR` and `1.55 * moonR`), and a clickable 10-frame chromatic corona flare easter egg (`g_startMoonPulseFrames = 10`) with a pitch-shifted distant zombie howl (`soundEnemyGroan` at 1.4x pitch).
- Implemented `renderStartGraveyard(W, H, u, safeW, safeH, plane)` across 3 distinct depth planes anchored to static normalized tables (`START_GRAVEYARD_PLANE1`, `START_GRAVEYARD_PLANE2`, `START_GRAVEYARD_PLANE3`) along a full-bleed parabolic scooped U-profile horizon dipping to 24% height from bottom at center (`H * 0.76`) and rising to 40% at flanks (`H * 0.60`), complete with flickering warm amber lancet windows (`rgba(255, 170, 50, 0.45 * flicker)`), gnarled dead oaks with diagonal branch fingers, 4 monument primitives, and rusted wrought-iron spear-picket fences rooted in stepped grass tufts.
- Implemented `renderStartParallaxFog(W, H, u, layer)` animating 3 horizontal mist ribbons at staggered velocities (`0.25`, `0.60`, `1.05 px/frame`) in tiered midnight slate-violet alphas (`0.18`, `0.26`, `0.35`) with quantized 4px vertical steps, 1-in-2 Bayer dithered crests constrained strictly below the CTA cartouche baseline, and orchestrated the complete 15-step Atmospheric Depth Sandwich Z-Stack in `renderStartScreen()` alongside 12-frame white-to-crimson phosphor wipe decay, 4-frame modal spring scaling, periodic ZzFX ambient wind whispers, pitch-shifted compendium tab chirps (`1.0x`, `1.12x`, `1.25x`), and hover neon glow surge (`0.45` to `0.85`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Procedural Bayer-Dithered Blood/Harvest Moon Engine & Interactive Easter Egg** - `99bde73` (feat)
2. **Task 2: 3-Plane Gothic Graveyard Silhouette & Scooped U-Profile Horizon Engine** - `b3729ab` (feat)
3. **Task 3: 3-Layer Parallax Fog, Atmospheric Sandwich Z-Stack & Interactive Audio Polish** - `1346590` (feat)

## Files Created/Modified
- `main/src/js/startScreen.js` - Added `renderStartMoon`, `renderStartGraveyard`, `renderStartParallaxFog`, static normalized coordinate tables, 15-step depth sandwich orchestration in `renderStartScreen`, and interactive audio/hover polish in `updateStartScreen`.

## Decisions Made
- Used plane-selective (`plane = 1, 2, 3`) and layer-selective (`layer = 1, 2, 3`) parameters on `renderStartGraveyard` and `renderStartParallaxFog` (while defaulting to rendering all planes/layers when called without the selective index) so `renderStartScreen()` can interleave Plane 1 → Fog 1 → Plane 2 → Fog 2 → Plane 3 → Fog 3 in the exact 15-step Atmospheric Depth Sandwich Z-Stack while also supporting standalone unit invocations.
- Maintained zero runtime object/array allocations inside the lunar, graveyard, and fog rasterization loops by pre-declaring static module-level coordinate tables.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `main/src/js/startScreen.js` is complete, verified against `test:phase16`, `test:phase17`, `test:phase19`, and `test:phase20` (all 100% green), and ready for Plan 21-02 (`scripts/test-phase21.js` 7-viewport headless Node.js VM regression suite).

## Self-Check: PASSED
- Verified `main/src/js/startScreen.js` exists and compiles cleanly into `main/dist/js/index.js`.
- Verified commits `99bde73`, `b3729ab`, and `1346590` in git history.
- Verified all 4 existing milestone test suites (`test:phase16`, `test:phase17`, `test:phase19`, `test:phase20`) pass 100% green.

---
*Phase: 21-16-bit-retro-arcade-start-screen-visual-overhaul*
*Completed: 2026-11-10*
