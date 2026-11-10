# Streamer Broadcast & Integration Guide
### Dead Again - Revamped (Twitch Edition)

**Created & Developed by Baizid Al Hamid**

This guide provides step-by-step instructions for broadcasting **Dead Again - Revamped (Twitch Edition)** live on Twitch using OBS Studio, configuring audience participation, and managing dual-monitor controls.

---

## Quick Navigation

- [1. Overview & Core Features](#1-overview--core-features)
- [2. Installation & Security Prompts](#2-installation--security-prompts)
- [3. Dual-Window Layout Architecture](#3-dual-window-layout-architecture)
- [4. OBS Studio Configuration (Window Capture)](#4-obs-studio-configuration-window-capture)
- [5. Streamer Privacy & Security Guidelines](#5-streamer-privacy--security-guidelines)
- [6. Twitch IRC & Channel Points Setup](#6-twitch-irc--channel-points-setup)
- [7. Audience Chat Command Reference](#7-audience-chat-command-reference)
- [8. Mock Dev Simulator (Offline Testing)](#8-mock-dev-simulator-offline-testing)
- [9. OBS & Runtime Troubleshooting](#9-obs--runtime-troubleshooting)
- [10. Support & Community](#10-support--community)

---

## 1. Overview & Core Features

Dead Again - Revamped (Twitch Edition) is a standalone native application that turns retro zombie survival into a live spectator tug-of-war.

| Streamer Capability | Implementation | Benefit |
|---|---|---|
| **Zero Browser Sources** | Native Electron desktop application | Eliminates OBS browser source audio desync and memory leaks. |
| **Unthrottled 60 FPS** | `backgroundThrottling: false` | Keeps game rendering at 60 FPS even when focusing other windows. |
| **Instant Twitch Bridge** | Built-in IRC client | Connects to chat in seconds by typing your channel name. |
| **Audience Tug-of-War** | Real-time Karma Engine | Chat commands spawn zombies or airdrop supplies dynamically. |

---

## 2. Installation & Security Prompts

### macOS Installation

1. Open the downloaded `Dead Again - Revamped (Twitch Edition).dmg` disk image.
2. Drag the **Dead Again - Revamped (Twitch Edition)** app bundle into `/Applications`.
3. **Bypassing macOS Gatekeeper**:
   - Double-click the bundled **`Fix Gatekeeper.command`** helper script located directly inside the DMG (or copy it alongside the app).
   - This script runs `xattr -cr` to remove the macOS quarantine extended attribute from the application bundle.
   - Alternatively, open Terminal manually and run:
     ```bash
     xattr -cr /Applications/"Dead Again - Revamped (Twitch Edition).app"
     ```
4. Launch the application from `/Applications` or Spotlight.

### Windows Installation

1. Run `Dead Again - Revamped Setup.exe` (or extract the portable `.zip` release).
2. The installer runs in per-user scope under `%LOCALAPPDATA%`, requiring zero administrator privileges.
3. **Bypassing Microsoft Defender SmartScreen**:
   - If Windows displays a blue "Windows protected your PC" screen:
     - Click the **More info** link.
     - Click the **Run anyway** button.
4. The installer creates Start Menu and Desktop shortcuts and launches the game immediately.

---

## 3. Dual-Window Layout Architecture

On startup, Dead Again - Revamped initializes two distinct application windows tailored for multi-monitor setups:

```
+------------------------------------+   +------------------------------------+
|         PRIMARY MONITOR 1          |   |         SECONDARY MONITOR 2        |
|                                    |   |                                    |
|   +----------------------------+   |   |   +----------------------------+   |
|   |  Dead Again - Revamped     |   |   |   |  [STREAMER ONLY] Dashboard |   |
|   |  1280x720 / 1080p (16:9)   |   |   |   |  Twitch IRC & Votes Relay  |   |
|   |  Cinematic Canvas          |   |   |   |  Real-time Karma & Swarm   |   |
|   +----------------------------+   |   |   +----------------------------+   |
|      (Stream this via OBS!)        |   |       (Keep this PRIVATE!)         |
+------------------------------------+   +------------------------------------+
```

### Primary Game Window (Monitor 1)
- Clean 16:9 canvas (1280x720 default, switchable to 1080p in the View menu).
- Displays arena combat, spectator HUD, live audience kill counter, and chat feed toasts.
- Stream this window to your viewers using OBS Studio.

### Companion Streamer Dashboard (Monitor 2)
- Automatically opens on your secondary monitor if detected.
- Press **`Cmd+D` / `Ctrl+D`** or **`F1`** at any time to toggle visibility.
- Configured with **hide-on-close**: Closing the window hides it without terminating your Twitch connection.
- Title is prefixed with **`[STREAMER ONLY]`** to prevent accidental stream exposure.

---

## 4. OBS Studio Configuration (Window Capture)

Follow these settings to capture the game with maximum performance and zero stutter:

1. In **OBS Studio**, open your streaming Scene.
2. Under **Sources**, click the **`+`** icon and select **Window Capture**.
3. In the Window dropdown menu, choose:
   ```
   [Dead Again - Revamped (Twitch Edition)]
   ```
4. **Capture Method Configuration**:
   - **Windows 10 / 11**: Set Capture Method to **Windows 10/11 (Windows Graphics Capture - WGC)**. WGC provides hardware-accelerated, tear-free capture and handles overlapping windows cleanly.
   - **macOS**: Use the default **ScreenCaptureKit** window capture method.
5. **Rules to Avoid**:
   - Do **NOT** use Display Capture (which risks exposing your private dashboard).
   - Do **NOT** use Game Capture injection hooks (unnecessary for standard window rendering).

---

## 5. Streamer Privacy & Security Guidelines

Maintaining streamer privacy is critical during interactive broadcasts:

| Security Rule | Description |
|---|---|
| **Never Capture the Dashboard** | The dashboard window titled **`[STREAMER ONLY]`** contains sensitive configuration data, including Twitch Client Secrets and broadcaster OAuth tokens. Keep this window off-stream at all times. |
| **Avoid Display Capture** | Use OBS **Window Capture** targeting exclusively the game canvas. If a window is moved or closed, Display Capture risks exposing desktop alerts and credentials. |
| **Keep User Data Secure** | Your configuration file is stored locally in your operating system user application data directory. Never show the contents of this file during a live broadcast. |

---

## 6. Twitch IRC & Channel Points Setup

### Step 1: Connect Twitch Chat (Zero Authentication Mode)
1. Open the **Streamer Dashboard** (`Cmd+D` or `F1`).
2. In Section 01 (*Twitch Channel Setup*), enter your Twitch channel name in lowercase (e.g. `baiz1d`).
3. Click **Save & Connect**.
4. The connection indicator will switch to green: `CONNECTED`.
5. Your chat audience can immediately use free chat commands (`!ammo`, `!repair`, `!mob`, `!boss`, `!jam`, etc.).

### Step 2: Enable Channel Points Predictions (Optional OAuth)
1. Expand the **Twitch Helix OAuth** panel in Section 01.
2. Enter your **Twitch Client ID** and **Broadcaster Access Token** (generated via Twitch Developer Console).
3. Click **Save & Connect**.
4. The game will now automatically create and settle native Twitch Channel Point predictions during match intermissions.

---

## 7. Audience Chat Command Reference

Audience commands are parsed locally by the relay engine and triggered in real time:

| Command | Faction | Base Cooldown | Description |
|---|---|---|---|
| `!ammo` | Team Good | 3 seconds | Airdrops an emergency ammo crate containing 12 bullets and clips. |
| `!repair` | Team Good | 3 seconds | Repairs damaged doors and reinforces perimeter barricades. |
| `!light` | Team Good | 3 seconds | Illuminates dark sectors and grants the player a temporary speed buff. |
| `!slow` | Team Good | 3 seconds | Casts a freezing frost nova that slows all zombies by 40%. |
| `!barrier` | Team Good | 5 seconds | Drops an octagonal repulsion ring that pushes zombies backward. |
| `!mob` | Team Bad | 3 seconds | Summons a fast-moving strike group of aggressive zombies. |
| `!boss` | Team Bad | 8 seconds | Spawns a heavily armored elite boss zombie in the arena. |
| `!jam` | Team Bad | 8 seconds | Jams the streamer's active firearm, forcing an emergency clearing cycle. |
| `!blackout` | Team Bad | 5 seconds | Cuts arena illumination, creating hazardous visual conditions. |
| `!frenzy` | Team Bad | 5 seconds | Enrages all existing zombies, increasing movement speed and aggression. |

### In-Game Command Cheat-Sheet & Ergonomic Controls

- **In-Game Cheat-Sheet Overlay (`[C]` / `[SELECT]`)**: Press **`[C]`** on keyboard or **`[SELECT]`** (Back) on gamepad at any time during combat or while paused to toggle the non-modal Twitch Chat Commands Cheat-Sheet card. When collapsed, the overlay renders 0 pixels on screen for 100% webcam and gameplay clearance.
- **Docking Side Flip (`Shift+C` / Pause Menu)**: Press **`Shift+C`** or click **`[DOCK: RIGHT / LEFT]`** in the Pause Menu (`ESC` / `P`) to flip the cheat-sheet card between the Bottom-Right and Bottom-Left safe margins to accommodate your webcam layout. Both visibility and docking preferences are automatically saved across sessions.
- **Ergonomic Run & Application Controls**:
  - **`[ QUIT TO MAIN MENU ]`**: Available inside the in-game Pause Menu (`ESC` / `P`) to immediately abandon an active run and return cleanly to the title screen.
  - **`[ EXIT GAME ]`**: Available on the Start Screen below `[H] HOW TO PLAY & GUIDE` to cleanly shut down the desktop application and background relay server.

---

## 8. Mock Dev Simulator (Offline Testing)

You can rehearse and test audience mechanics without broadcasting live:

1. Open the Streamer Dashboard (`Cmd+D` or `F1`).
2. Navigate to Section 03: **Mock Dev Simulator & Bot Swarm**.
3. Select an audience preset:
   - **Solo Test**: Low-frequency bot actions for testing mechanics.
   - **Audience Match**: Balanced two-team tug-of-war simulating a mid-sized stream.
   - **Chaos Swarm**: High-frequency actions and aggressive boss spawns.
4. Adjust the **Chatter Rate** slider (1 to 20 messages per second).
5. Click **Start Bot Swarm** to begin the simulation.
6. Click **Stop Bot Swarm** when finished.

---

## 9. OBS & Runtime Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Black screen in OBS** | Incorrect capture source or hook failure | In OBS, delete and recreate the **Window Capture** source. Ensure Capture Method is set to **WGC** (Windows) or **ScreenCaptureKit** (macOS). |
| **macOS Gatekeeper blocks launch** | Indie app quarantine attribute | Run the bundled **`Fix Gatekeeper.command`** helper script, or run `xattr -cr /Applications/"Dead Again - Revamped (Twitch Edition).app"` in Terminal. |
| **Windows SmartScreen popup** | Unrecognized application executable | Click **More info** followed by **Run anyway** to proceed with installation. |
| **Port 8080 collision error** | Another service occupies port 8080 | Dead Again - Revamped automatically probes and falls back to alternate ports (8081-8090). Check the dashboard header for the active port. |
| **Accidentally closed dashboard** | Dashboard closed during stream | Press **`Cmd+D`** / **`Ctrl+D`** or **`F1`** to restore the window. The background connection remains active. |

---

## 10. Support & Community

Dead Again - Revamped (Twitch Edition) is created and developed by **Baizid Al Hamid ([BAIZ1D](https://github.com/BAIZ1D))**.

- ☕ **Support on Ko-fi**: [ko-fi.com/baiz1d](https://ko-fi.com/baiz1d) — Help support ongoing development and server infrastructure.
- **Itch.io Game Page**: [baiz1d.itch.io/dead-again-revamped](https://baiz1d.itch.io/dead-again-revamped) — Rate the game and leave your feedback.
- **GitHub Releases**: [github.com/BAIZ1D/dead-again-revamped/releases](https://github.com/BAIZ1D/dead-again-revamped/releases) — Download latest builds and changelogs.
- **Issue Tracker**: [GitHub Issues](https://github.com/BAIZ1D/dead-again-revamped/issues) — Report bugs or submit feature requests.

---
*Dead Again - Revamped (Twitch Edition) — Developed by Baizid Al Hamid.*
