---
phase: 23-endless-multi-room-nightmare-survival-gauntlet
plan: "01"
subsystem: combat-physics-dungeon
tags: [smg-rebalance, barricade-physics, dungeon-rotation, safe-room, float-damage]
requires:
  - BAL-21
  - BAL-23
provides:
  - "SMG global rebalance with 0.65 bullet damage and 90ms cyclic rate"
  - "Weapon drop 30-frame pickup cooldown"
  - "Multi-room dungeon rotation (Maps 0, 1, 3, 4 with Map 2 Boss Arena every 5th wave)"
  - "Dedicated 7x7 starting armory safe room with 4 cardinal diamond weapon pedestals"
  - "Destructible barricade doors (45 HP) with rifle penetration, shotgun point-blank obliteration, and wave reconstruction"
affects:
  - main/src/js/DEFS.js
  - main/src/js/gunMachinePistol.js
  - main/src/js/gunPistol.js
  - main/src/js/gunRifle.js
  - main/src/js/gunShotgun.js
  - main/src/js/gun.js
  - main/src/js/bullet.js
  - main/src/js/mob_enemy.js
  - main/src/js/mapmanager.js
  - main/src/js/main.js
key-files:
  created: []
  modified:
    - main/src/js/DEFS.js
    - main/src/js/gunMachinePistol.js
    - main/src/js/gunPistol.js
    - main/src/js/gunRifle.js
    - main/src/js/gunShotgun.js
    - main/src/js/gun.js
    - main/src/js/bullet.js
    - main/src/js/mob_enemy.js
    - main/src/js/mapmanager.js
    - main/src/js/main.js
key-decisions:
  - "D-07: Sequential multi-room dungeon rotation (Maps 0, 1, 3, 4) with Map 2 (open Boss Arena) appearing every 5th wave"
  - "D-08: Wave 1 and milestone waves generate dedicated 7x7 starting armory safe room at spawn"
  - "D-09: 4 cardinal weapon pedestals at R = 2.8 tiles from spawn with 30-frame drop cooldown"
  - "D-11: Global SMG rebalance to 0.65 damage and 90ms cyclic rate while keeping pistol at 1.0; float damage precision checking (<= 0.05 HP kill)"
  - "D-43, D-45, D-46: 45 HP destructible barricade doors with solid collision, wood splinter particles, and full wave reconstruction"
  - "D-52, D-53: Rifle penetrates doors costing 1 penetration point, point-blank shotgun blasts obliterate doors with forward shrapnel"
requirements-completed:
  - MODE-01
  - MODE-02
duration: "12 min"
completed: "2026-11-10T20:31:00Z"
---

# Phase 23 Plan 01: Core Dungeon Flow, Weapon Rebalance & Barricade Physics Summary

Implemented the core combat rebalance and procedural dungeon physics for Phase 23:
1. **Global SMG Rebalance & Float Damage:** Machine Pistol bullet damage retuned to 0.65 and cyclic rate to 90ms (~7.2 DPS) across the game, requiring 3-4 hits per standard zombie while keeping the Pistol at 1.0 damage. Float damage precision checks added to `Bullet` and `mob_enemy.js` (`<= 0.05 HP kill threshold`).
2. **Weapon Drop Cooldown:** Weapons dropped during weapon swap enforce a 30-frame (0.5s) immunity timer where they cannot be picked back up by the player, eliminating oscillating swaps and reserve ammo loss.
3. **Multi-Room Dungeon Cycling & Starting Armory Safe Room:** Built `getMapIndexForLevel` and `setupMapForLevel` rotating through Maps 0, 1, 3, 4 with Map 2 (Arena) every 5th wave. Starting Armory Safe Room (`setupArmoryRoom`) creates a 7x7 fortified chamber centered at spawn with a North barricade door and 4 cardinal pedestals at R = 2.8 tiles (Pistol, Shotgun, Rifle, SMG).
4. **Destructible Barricade Doors & Ballistics:** Barricade doors (`g_doors`) spawn with 45 HP, block collision while intact, reconstruct to full 45 HP at each wave transition, penetrate with high-caliber Rifle rounds, obliterate into forward splinter shrapnel under point-blank Shotgun blasts, and shatter when reduced to 0 HP.

## Self-Check: PASSED
- [x] SMG damage is 0.65 with 90ms delay, and standard Pistol remains 1.0
- [x] Dropped weapons have 30-frame pickup cooldown
- [x] Map cycling correctly selects Maps 0, 1, 3, 4 with Map 2 every 5th wave
- [x] Starting armory room generates 4 cardinal pedestals at R = 2.8 tiles
- [x] Destructible barricade doors have 45 HP and reconstruct on wave transition
- [x] Rifle bullet penetrates doors; point-blank shotgun blast obliterates doors
