---
phase: 22
slug: in-game-stream-command-cheat-sheet-streamer-ergonomics
status: verified
threats_open: 0
asvs_level: 1
created: 2026-11-10
---

# Phase 22 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Renderer → Main Process (IPC) | Desktop Electron renderer IPC (`desktop:exit-app`, `desktop:open-external`) crossing context isolation boundary via `preload.cjs` into Node.js main process | Signal events, external URL strings |
| Dashboard Web / Renderer → OS Browser | Web Dashboard external link clicks crossing into OS default browser via `shell.openExternal` | Web URLs (Ko-fi, Itch.io) |
| Renderer → Local Storage | Game client preference persistence crossing into browser/Electron local storage | Configuration key-value strings (`da_cheatsheet_visible`, `da_cheatsheet_dock`) |
| Twitch Audience → Client Canvas HUD | Real-time chat action commands flowing from Relay Server WebSocket into in-game HUD telemetry | Action names, faction identifiers, user names |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-22-01 | Elevation of Privilege (ASVS V14.4) | `desktop/preload.cjs`, `desktop/main.js` | mitigate | Zero-parameter `exitApp()` bridge triggering supervised `app.quit()` with graceful child process cleanup | closed |
| T-22-02 | Tampering (ASVS V5.1) | `desktop/main.js`, `relay-server/public/js/dashboard.js` | mitigate | `desktop:open-external` strictly asserts `https://` or `http://` prefix before `shell.openExternal()`; hardcoded donation/itch URLs | closed |
| T-22-03 | Denial of Service (Stability) | `relay-server/public/js/dashboard.js` | mitigate | Defensive `if (viewerBadge)` null guards on all viewer count assignments | closed |
| T-22-04 | Tampering (Visual Stability) | `main/src/js/startScreen.js` | mitigate | `[ EXIT GAME ]` button operations wrapped in strict `save()`/`restore()` pairs with `shadowBlur = 0` reset | closed |
| T-22-05 | Denial of Service (ASVS V8.3) | `main/src/js/main.js` | mitigate | `safeGetPref` and `safeSetPref` `try/catch` wrapper functions preventing unhandled exceptions in sandboxed storage | closed |
| T-22-06 | Denial of Service (Combat Usability) | `main/src/js/ui.js`, `main/src/js/apgManager.js` | mitigate | Cheat-sheet card is 100% click-through during active combat; interactive click events scoped to `g_isPaused` | closed |
| T-22-07 | Tampering (Input Ambiguity) | `main/src/js/main.js` | mitigate | `Shift+C` chord disambiguation prioritizing `keyIsDown(16)` before single key toggle | closed |
| T-22-08 | Denial of Service (Engine Stability) | `main/src/js/apgManager.js` | mitigate | Strict Canvas 2D `save()`/`restore()` state isolation in `renderCheatSheet()` with 0 net stack deviation across 50 frames | closed |
| T-22-09 | Denial of Service (State Corruption) | `main/src/js/main.js` | mitigate | Synchronous reset of enemies, spawners, timers, LittleJS `engineObjectsDestroy()` execution, and state transition during run abandonment | closed |
| T-22-10 | Denial of Service (Geometric Collision) | `main/src/js/apgManager.js`, `scripts/test-phase22.js` | mitigate | Safe-zone clamping to $[0.74W, 0.98W] \times [0.72H, 0.96H]$ with positive mathematical clearance across 7 viewports | closed |
| T-22-11 | Tampering (Timer Synchronization) | `main/src/js/apgManager.js` | mitigate | Pulse and flare decay counters decremented only when `!g_isPaused`, freezing highlight state during pause | closed |
| T-22-12 | Denial of Service (Canvas State Leak) | `scripts/test-phase22.js`, `main/src/js/apgManager.js` | mitigate | Node VM test suite validates 0 net save/restore deviation across 50 heterogeneous render cycles | closed |
| T-22-13 | Denial of Service (Bundle Integrity) | `scripts/build-game.js`, `scripts/test-phase22.js` | mitigate | Automated headless Node VM execution verifies zero unbundled ES6 imports/exports and clean compilation | closed |

*Status: open · closed*  
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks. All identified threats have active automated and code-level mitigations.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-10 | 13 | 13 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-10
