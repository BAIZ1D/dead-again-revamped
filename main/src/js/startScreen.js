/** @format */

// Start Screen Modular Engine (Phase 17, VIS-01)
// 0 KB external asset overhead: 100% procedural Canvas 2D + LittleJS tiles

let g_startEmbers = [];
let g_startHelpOpen = false;
let g_startHelpTab = 0; // 0: Combat & Weapons, 1: Twitch APG & Karma, 2: Streamer Setup
let g_startLaunchTimer = 0;
let g_startFlashFrames = 0;
let g_startGamepadDebounce = false;

// 16:9 Virtual Safe Zone Clamping (D-15)
function getStartScreenSafeZone(canvasW, canvasH) {
    const targetAspect = 16 / 9;
    let safeW = canvasW;
    let safeH = canvasH;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasW / canvasH > targetAspect) {
        // Ultrawide display: pillarbox safe zone centered horizontally
        safeW = canvasH * targetAspect;
        offsetX = (canvasW - safeW) / 2;
    } else if (canvasW / canvasH < targetAspect) {
        // Narrow/tall display: letterbox safe zone centered vertically
        safeH = canvasW / targetAspect;
        offsetY = (canvasH - safeH) / 2;
    }

    const u = Math.max(12, Math.min(32, safeW / 48));
    return {
        safeW,
        safeH,
        offsetX,
        offsetY,
        cx: canvasW / 2,
        cy: canvasH / 2,
        u
    };
}

// Direct Screen-Space Tile Drawer (re-uses tileImage without engine mainContext redirection)
function drawOverlayTile(tileIndex, x, y, size, angle = 0, mirror = false, alpha = 1.0) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    if (typeof tileImage === 'undefined' || !tileImage || !tileImage.width) return;
    const tileSize = 12; // LittleJS TILE_SIZE.x
    const cols = (tileImage.width / tileSize) | 0;
    if (cols <= 0) return;
    const sX = (tileIndex % cols) * tileSize + 0.3; // 0.3px anti-bleed margin
    const sY = ((tileIndex / cols) | 0) * tileSize + 0.3;
    const sW = tileSize - 0.6;
    const sH = tileSize - 0.6;

    overlayContext.save();
    overlayContext.translate(x, y);
    if (angle) overlayContext.rotate(angle);
    if (mirror) overlayContext.scale(-1, 1);
    overlayContext.globalAlpha = alpha;
    overlayContext.imageSmoothingEnabled = false;
    overlayContext.drawImage(tileImage, sX, sY, sW, sH, -size / 2, -size / 2, size, size);
    overlayContext.restore();
}

// Heraldic Shield Polygon Geometry (D-01, D-02)
function createShieldPath(cx, cy, w, h) {
    if (typeof Path2D === 'undefined') return null;
    const path = new Path2D();
    const chamfer = w * 0.08;
    const topW = w * 0.48;
    const midY = cy + h * 0.08;
    const botY = cy + h * 0.50;

    path.moveTo(cx - topW + chamfer, cy - h * 0.50);
    path.lineTo(cx + topW - chamfer, cy - h * 0.50);
    path.lineTo(cx + topW, cy - h * 0.50 + chamfer);
    path.lineTo(cx + topW, midY);
    path.quadraticCurveTo(cx + topW * 0.90, cy + h * 0.35, cx, botY);
    path.quadraticCurveTo(cx - topW * 0.90, cy + h * 0.35, cx - topW, midY);
    path.lineTo(cx - topW, cy - h * 0.50 + chamfer);
    path.lineTo(cx - topW + chamfer, cy - h * 0.50);
    path.closePath();
    return path;
}

// Dynamic Idle Floating Faction Portraits with Faction Auras (D-03)
function renderStartFactionPortraits(cx, cy, shieldW, u) {
    const portraitRadius = u * 1.35;
    const portraitSize = u * 3.4;

    // Left: Survivor (tileNumbers_facePlayer = 5) with ±3px sine float & golden aura
    const playerBob = Math.sin(frame * 0.05) * 3;
    const playerX = cx - shieldW * 0.86;
    const playerY = cy + playerBob;

    overlayContext.save();
    // Golden Divine Aura
    overlayContext.shadowColor = 'rgba(251, 242, 54, 0.65)';
    overlayContext.shadowBlur = 14 + 4 * Math.sin(frame * 0.08);
    overlayContext.fillStyle = 'rgba(251, 242, 54, 0.18)';
    overlayContext.beginPath();
    overlayContext.arc(playerX, playerY, portraitRadius + 4, 0, Math.PI * 2);
    overlayContext.fill();
    overlayContext.strokeStyle = '#FBF236';
    overlayContext.lineWidth = 1.8;
    overlayContext.stroke();
    overlayContext.restore();

    drawOverlayTile(tileNumbers_facePlayer, playerX, playerY, portraitSize, 0, false, 1.0);

    // Right: Zombie (tileNumbers_faceZombie = 6, Mirrored) with out-of-phase float & crimson miasma
    const zombieBob = Math.sin(frame * 0.05 + Math.PI) * 3;
    const zombieX = cx + shieldW * 0.86;
    const zombieY = cy + zombieBob;

    overlayContext.save();
    // Crimson/Toxic Miasma Aura
    overlayContext.shadowColor = 'rgba(172, 50, 50, 0.75)';
    overlayContext.shadowBlur = 14 + 4 * Math.cos(frame * 0.08);
    overlayContext.fillStyle = 'rgba(172, 50, 50, 0.22)';
    overlayContext.beginPath();
    overlayContext.arc(zombieX, zombieY, portraitRadius + 4, 0, Math.PI * 2);
    overlayContext.fill();
    overlayContext.strokeStyle = '#AC3232';
    overlayContext.lineWidth = 1.8;
    overlayContext.stroke();
    overlayContext.restore();

    drawOverlayTile(tileNumbers_faceZombie, zombieX, zombieY, portraitSize, 0, true, 1.0);
}

// Centered Hero Crest: Shield, Crossed Weapons, Faction Portraits, Split Insignia (D-01..D-04)
function renderStartScreenCrest(cx, cy, u) {
    const shieldW = u * 5.4;
    const shieldH = u * 6.2;
    const crestCenterY = cy - u * 5.8;

    overlayContext.save();

    // 1. Crossed Weapons protruding behind shield (D-01)
    // Shotgun (-35° angle, protruding upper-left)
    const weaponSize = u * 4.6;
    drawOverlayTile(tileNumbers_shotgun, cx - u * 2.2, crestCenterY - u * 1.4, weaponSize, -0.610865, false, 0.95);
    // SMG (+35° angle, protruding upper-right)
    drawOverlayTile(tileNumbers_smg, cx + u * 2.2, crestCenterY - u * 1.4, weaponSize, 0.610865, false, 0.95);

    // Specular glint on crossed weapons
    overlayContext.save();
    overlayContext.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    overlayContext.lineWidth = 1.2;
    overlayContext.beginPath();
    overlayContext.moveTo(cx - u * 3.4, crestCenterY - u * 2.4);
    overlayContext.lineTo(cx - u * 2.6, crestCenterY - u * 1.8);
    overlayContext.moveTo(cx + u * 3.4, crestCenterY - u * 2.4);
    overlayContext.lineTo(cx + u * 2.6, crestCenterY - u * 1.8);
    overlayContext.stroke();
    overlayContext.restore();

    // 2. Armored Heater Shield Body (D-02)
    const shieldPath = createShieldPath(cx, crestCenterY, shieldW, shieldH);

    // Outer bronze drop shadow
    overlayContext.save();
    overlayContext.shadowColor = 'rgba(0, 0, 0, 0.85)';
    overlayContext.shadowBlur = 16;
    overlayContext.shadowOffsetY = 6;
    overlayContext.fillStyle = '#080A0E';
    if (shieldPath) overlayContext.fill(shieldPath);
    overlayContext.restore();

    // Dark-slate beveled interior fill
    const slateGrad = overlayContext.createLinearGradient(cx, crestCenterY - shieldH / 2, cx, crestCenterY + shieldH / 2);
    slateGrad.addColorStop(0, '#222933');
    slateGrad.addColorStop(0.5, '#161B22');
    slateGrad.addColorStop(1, '#0B0D12');
    overlayContext.fillStyle = slateGrad;
    if (shieldPath) overlayContext.fill(shieldPath);

    // 3D Faceted vertical ridge (left half lighter slate, right half darker)
    if (shieldPath) {
        overlayContext.save();
        overlayContext.clip(shieldPath);
        overlayContext.fillStyle = 'rgba(255, 255, 255, 0.06)';
        overlayContext.fillRect(cx - shieldW / 2, crestCenterY - shieldH / 2, shieldW / 2, shieldH);
        overlayContext.fillStyle = 'rgba(0, 0, 0, 0.22)';
        overlayContext.fillRect(cx, crestCenterY - shieldH / 2, shieldW / 2, shieldH);
        overlayContext.restore();
    }

    // Gold-bronze border trim (D-02)
    overlayContext.save();
    overlayContext.strokeStyle = '#D4AF37'; // Royal Gold
    overlayContext.lineWidth = Math.max(2.5, u * 0.14);
    overlayContext.shadowColor = 'rgba(212, 175, 55, 0.45)';
    overlayContext.shadowBlur = 8;
    if (shieldPath) overlayContext.stroke(shieldPath);

    // Inner metallic bronze bevel rim
    const innerShieldPath = createShieldPath(cx, crestCenterY, shieldW - u * 0.45, shieldH - u * 0.45);
    overlayContext.strokeStyle = '#7A5B18';
    overlayContext.lineWidth = 1.2;
    overlayContext.shadowBlur = 0;
    if (innerShieldPath) overlayContext.stroke(innerShieldPath);
    overlayContext.restore();

    // 3. Center Split Tug-of-War Insignia (D-04)
    const insigniaY = crestCenterY - u * 0.25;
    const insigniaR = u * 1.15;

    overlayContext.save();
    // Left Half: Golden Star / Divine Flash Ray (Survivor Good Team)
    overlayContext.beginPath();
    overlayContext.arc(cx, insigniaY, insigniaR, Math.PI * 0.5, Math.PI * 1.5, false);
    overlayContext.closePath();
    overlayContext.fillStyle = 'rgba(251, 242, 54, 0.25)';
    overlayContext.fill();
    overlayContext.strokeStyle = '#FBF236';
    overlayContext.lineWidth = 1.5;
    overlayContext.stroke();

    // 4-Pointed Golden Star Glyph
    overlayContext.fillStyle = '#FBF236';
    overlayContext.beginPath();
    overlayContext.moveTo(cx - insigniaR * 0.45, insigniaY);
    overlayContext.lineTo(cx - insigniaR * 0.25, insigniaY - insigniaR * 0.18);
    overlayContext.lineTo(cx - insigniaR * 0.45, insigniaY - insigniaR * 0.45);
    overlayContext.lineTo(cx - insigniaR * 0.25, insigniaY - insigniaR * 0.25);
    overlayContext.lineTo(cx, insigniaY - insigniaR * 0.45);
    overlayContext.lineTo(cx - insigniaR * 0.15, insigniaY);
    overlayContext.lineTo(cx, insigniaY + insigniaR * 0.45);
    overlayContext.lineTo(cx - insigniaR * 0.25, insigniaY + insigniaR * 0.25);
    overlayContext.lineTo(cx - insigniaR * 0.45, insigniaY + insigniaR * 0.45);
    overlayContext.lineTo(cx - insigniaR * 0.25, insigniaY + insigniaR * 0.18);
    overlayContext.closePath();
    overlayContext.fill();

    // Right Half: Stylized Skull / Infection Glyph (Horde Bad Team)
    overlayContext.beginPath();
    overlayContext.arc(cx, insigniaY, insigniaR, Math.PI * 1.5, Math.PI * 0.5, false);
    overlayContext.closePath();
    overlayContext.fillStyle = 'rgba(172, 50, 50, 0.30)';
    overlayContext.fill();
    overlayContext.strokeStyle = '#AC3232';
    overlayContext.lineWidth = 1.5;
    overlayContext.stroke();

    // Stylized Crimson Skull Glyph
    overlayContext.fillStyle = '#FF4D4D';
    overlayContext.beginPath();
    overlayContext.arc(cx + insigniaR * 0.42, insigniaY - insigniaR * 0.12, insigniaR * 0.28, 0, Math.PI * 2);
    overlayContext.fill();
    overlayContext.fillRect(cx + insigniaR * 0.28, insigniaY + insigniaR * 0.10, insigniaR * 0.28, insigniaR * 0.20);
    // Eye sockets
    overlayContext.fillStyle = '#161B22';
    overlayContext.fillRect(cx + insigniaR * 0.34, insigniaY - insigniaR * 0.16, insigniaR * 0.09, insigniaR * 0.12);
    overlayContext.fillRect(cx + insigniaR * 0.48, insigniaY - insigniaR * 0.16, insigniaR * 0.09, insigniaR * 0.12);

    // Center Seam Tug-of-War dividing line
    overlayContext.strokeStyle = '#FFFFFF';
    overlayContext.lineWidth = 2.0;
    overlayContext.shadowColor = 'rgba(255, 255, 255, 0.85)';
    overlayContext.shadowBlur = 6;
    overlayContext.beginPath();
    overlayContext.moveTo(cx, insigniaY - insigniaR);
    overlayContext.lineTo(cx, insigniaY + insigniaR);
    overlayContext.stroke();
    overlayContext.restore();

    // 4. Dynamic Flanking Faction Portraits (D-01, D-03)
    renderStartFactionPortraits(cx, crestCenterY, shieldW, u);

    overlayContext.restore();
}

function updateStartScreen() {
    if (typeof mouseWasReleased !== 'undefined' && (mouseWasReleased(0) || (typeof gamepadWasPressed !== 'undefined' && gamepadWasPressed(0)))) {
        if (typeof uiSound === 'function') uiSound();
        if (typeof isTouchDevice !== 'undefined' && isTouchDevice && typeof isFullscreen === 'function' && !isFullscreen()) toggleFullscreen();
        if (typeof uiFadeOutAndCall === 'function') {
            uiFadeOutAndCall(() => {
                startNewGame();
                enterLobbyState();
            });
        }
    }
}

function renderStartScreen() {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    const W = mainCanvas ? mainCanvas.width : 1920;
    const H = mainCanvas ? mainCanvas.height : 1080;
    const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(W, H);

    overlayContext.save();
    renderStartScreenCrest(cx, cy, u);
    overlayContext.restore();
}
