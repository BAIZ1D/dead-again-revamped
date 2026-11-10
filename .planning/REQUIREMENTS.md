# Requirements: Dead Again - Revamped (Twitch Edition)

**Defined:** 2026-11-10  
**Core Value:** A high-stakes, real-time tug-of-war between streamer survival and audience sabotage powered by native Twitch Channel Point predictions and dynamic in-game audience events--with zero external stream overlays required.  
**Milestone:** v1.6 (Release v1.3.0)

## v1.6 Requirements

Requirements for Milestone v1.6 (Release v1.3.0). Each maps to roadmap phases.

### HUD Ergonomics & Clipping Fixes (CLIP)

- [x] **CLIP-04**: Player can view the top-left armored health plate (hearts and shield pip) seated snuggly beneath the player avatar portrait with at least $0.25 \cdot scaleUI$ clearance from the left screen boundary across all aspect ratios.
- [x] **CLIP-05**: Player and audience can view the pre-game prediction locked banner ("VOTES LOCKED: XX% GOOD vs YY% BAD") fully contained inside its visual bounding box via dynamic width expansion and responsive font downscaling.
- [x] **CLIP-06**: Player can open the Field Manual / Help modal on any tab without text overflowing or clipping beyond card and modal margins, governed by a universal multi-line `drawWrappedText` Canvas 2D engine.

### Field Manual Compendium (HELP)

- [x] **HELP-01**: Player can inspect complete mechanical statistics and ballistics (magazine capacity, reserve caps, fire rate, tap-precision vs spray bloom physics) for all 4 weapons (Pistol, Shotgun, SMG, Rifle) in Field Manual Tab 1.
- [x] **HELP-02**: Player can inspect complete behavioral profiles, threats, and counter-tactics for all 4 enemy types (Walkers/Zombies, Aerial/Vampires, Phasing/Ghosts, and Heavy Bosses with boulder throw physics and Full Care Package drops) in Field Manual Tab 2.
- [x] **HELP-03**: Player and streamer can reference accurate Twitch APG chat command descriptions and clutch condition rules in Field Manual Tab 3.

### 16-Bit Retro Pixel Start Screen (VIS)

- [x] **VIS-02**: Player can experience an authentic 16-bit retro pixel start screen featuring a procedural stepped graveyard silhouette (tombstones, crooked crosses, twisted trees, and cathedral spires) replacing flat black backgrounds and 3D effects.
- [x] **VIS-03**: Player can view a procedural Bayer-dithered retro pixel harvest/blood moon with shaded craters and concentric halo rings on the title screen.
- [x] **VIS-04**: Player can observe 3-layer parallax drifting pixel fog undulating horizontally across the title horizon without external image asset dependencies.

### In-Game Stream Command Overlay (HUD)

- [x] **HUD-05**: Streamer and stream audience can view a dedicated Good vs Bad Twitch chat commands cheat-sheet card docked in the bottom-right margin displaying all 10 commands with concise descriptions, deconflicted from the bottom-center Karma meter and middle-right kill counter.
- [x] **HUD-06**: Streamer can toggle the bottom-right chat commands cheat-sheet overlay on or off via hotkey (`[C]`), showing a compact collapsed badge when hidden.

### Endless Multi-Room Nightmare Mode (MODE)

- [x] **MODE-01**: Player transitions seamlessly into endless Nightmare Mode upon defeating the Level 5 Boss, progressing through wave-specific pre-game prediction lobbies.
- [x] **MODE-02**: Player spawns into a multi-room dungeon environment featuring barricade doors and a starting armory room holding all 4 weapons (Pistol, Shotgun, Rifle, SMG) placed on separated floor pedestals without weapon collision overlaps.
- [x] **MODE-03**: Player faces escalating endless waves with dynamic mob concurrency caps scaling up to 40 entities and active spawns of all 4 enemy types.
- [x] **MODE-04**: Stream audience can summon up to 5 concurrent active bosses simultaneously during Nightmare Mode (`MAX_AUDIENCE_BOSSES = 5`), with boss enrage mechanics and Full Care Package drops on kill.
- [x] **MODE-05**: Player can track endless survival metrics (waves survived, kills, time survived) in real-time and review a persistent high score summary on defeat saved to `localStorage`.

### Packaging & Verification (PKG)

- [x] **PKG-09**: Player and distributor can run the packaged standalone app and relay server synchronized to semantic version `1.3.0` across all package manifests and updater endpoints.
- [x] **PKG-10**: Developer and CI pipeline can verify 100% green passing status across all existing and new regression test suites with zero ES6 leakage or global namespace collisions.

## Future Requirements (v2.0+)

Deferred to future releases.

### Infinite Procedural BSP Caverns
- **MODE-06**: Fully random procedural BSP room-and-corridor generator generating novel layouts per wave.

### Custom Twitch Channel Point Boss Customization
- **AUD-01**: Viewers redeem channel points to customize spawned boss sprite tints, names, and elite affix traits.

### Streamer Tournament Co-Op
- **NET-01**: Multi-streamer co-op survival over peer-to-peer WebRTC.

## Out of Scope

Explicitly excluded to protect stability, performance, and game balance.

| Feature | Reason |
|---------|--------|
| Modifying LittleJS Engine Core (`engine.all.release.js`) | Upstream engine stability; all UI, rendering, and logic must sit in game scripts. |
| Uncapped Entity Spawning (>50 mobs, >5 bosses) | Severe Canvas 2D CPU bottleneck and unplayable bullet hell frame rate drops. |
| External Image/Video Video Assets for Title Screen | Bloats offline packages and breaks 16-bit pixel scaling architecture; must remain 100% procedural Canvas 2D. |
| Paid Code Signing Certificates | Out of scope for open-source AGPL-3.0 release; handled via gatekeeper helper scripts. |
| Full-Screen Pause Modals for Command Help during Combat | Disrupts live streaming; in-game cheat sheet must be non-modal and unobtrusive. |

## Traceability

Which phases cover which requirements. Filled by the roadmapper agent.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLIP-04 | Phase 19 | Complete |
| CLIP-05 | Phase 19 | Complete |
| CLIP-06 | Phase 19 | Complete |
| HELP-01 | Phase 20 | Complete |
| HELP-02 | Phase 20 | Complete |
| HELP-03 | Phase 20 | Complete |
| VIS-02  | Phase 21 | Complete |
| VIS-03  | Phase 21 | Complete |
| VIS-04  | Phase 21 | Complete |
| HUD-05  | Phase 22 | Complete |
| HUD-06  | Phase 22 | Complete |
| MODE-01 | Phase 23 | Complete |
| MODE-02 | Phase 23 | Complete |
| MODE-03 | Phase 23 | Complete |
| MODE-04 | Phase 23 | Complete |
| MODE-05 | Phase 23 | Complete |
| PKG-09  | Phase 24 | Complete |
| PKG-10  | Phase 24 | Complete |
