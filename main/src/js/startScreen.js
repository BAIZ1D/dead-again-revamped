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
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
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
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
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

// 24 Procedural Rising Ember Particles (D-05, D-16)
function initStartEmbers(W, H) {
    g_startEmbers = [];
    for (let i = 0; i < 24; i++) {
        g_startEmbers.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vy: -(0.5 + Math.random() * 0.9), // upward drift 0.5 - 1.4 px/frame
            size: 1.2 + Math.random() * 2.0,  // 1.2 - 3.2 px
            flutterPhase: Math.random() * Math.PI * 2,
            flutterSpeed: 0.02 + Math.random() * 0.03,
            flutterAmp: 0.4 + Math.random() * 0.8,
            maxLife: 240 + Math.random() * 240,
            life: Math.random() * 300,
            isGold: Math.random() > 0.45      // 55% crimson, 45% gold
        });
    }
}

function updateAndRenderStartEmbers(W, H) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    if (!g_startEmbers || g_startEmbers.length !== 24) initStartEmbers(W, H);

    overlayContext.save();
    for (let i = 0; i < 24; i++) {
        const p = g_startEmbers[i];
        p.y += p.vy;
        p.x += Math.sin(frame * p.flutterSpeed + p.flutterPhase) * p.flutterAmp;
        p.life--;

        // Fade in at bottom, fade out near top
        let alpha = 1.0;
        if (p.y > H * 0.85) alpha = Math.max(0, (H - p.y) / (H * 0.15));
        else if (p.y < H * 0.25) alpha = Math.max(0, p.y / (H * 0.25));

        // Respawn when off screen or expired
        if (p.y < -10 || p.life <= 0 || p.x < -20 || p.x > W + 20) {
            p.x = Math.random() * W;
            p.y = H + 5 + Math.random() * 25;
            p.vy = -(0.5 + Math.random() * 0.9);
            p.life = p.maxLife;
            p.isGold = Math.random() > 0.45;
            continue;
        }

        overlayContext.fillStyle = p.isGold
            ? `rgba(251, 242, 54, ${alpha * 0.85})`
            : `rgba(220, 50, 50, ${alpha * 0.85})`;
        overlayContext.shadowColor = p.isGold ? '#FBF236' : '#FF3B30';
        overlayContext.shadowBlur = 4;
        overlayContext.fillRect(p.x, p.y, p.size, p.size);
    }
    overlayContext.restore();
}

// CRT Scanline Raster & Dark-Crimson Radial Vignette (D-06)
function renderStartAtmosphere(W, H, cx, cy) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    overlayContext.save();
    // 1. Dark-crimson radial lighting vignette
    const R = Math.hypot(cx, cy);
    const vig = overlayContext.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.55, 'rgba(15, 0, 2, 0.28)');
    vig.addColorStop(0.85, 'rgba(25, 0, 4, 0.68)');
    vig.addColorStop(1, 'rgba(25, 0, 4, 0.78)');
    overlayContext.fillStyle = vig;
    overlayContext.fillRect(0, 0, W, H);

    // 2. Authentic horizontal CRT scanlines every 3px (alpha ~0.055)
    overlayContext.fillStyle = 'rgba(0, 0, 0, 0.055)';
    for (let y = 0; y < H; y += 3) {
        overlayContext.fillRect(0, y, W, 1);
    }
    overlayContext.restore();
}

// "DEAD AGAIN" Layered Chromatic Typography (D-09)
function renderStartTypography(cx, titleY, u) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    overlayContext.save();
    const titleSize = Math.max(38, u * 2.8);
    overlayContext.font = `bold ${titleSize}px ${fontDefault}`;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'middle';

    // Pass 1: Deep drop shadow
    overlayContext.shadowColor = 'rgba(0, 0, 0, 0.95)';
    overlayContext.shadowBlur = 12;
    overlayContext.shadowOffsetX = 4;
    overlayContext.shadowOffsetY = 6;
    overlayContext.fillStyle = '#050002';
    overlayContext.fillText("DEAD AGAIN", cx, titleY);

    // Pass 2: Chromatic Outer Halo (Twitch Purple #9146FF & Blood Red)
    const haloMix = 0.5 + 0.5 * Math.sin(frame * 0.04);
    const haloR = Math.round(172 + (145 - 172) * haloMix);
    const haloG = Math.round(30 + (70 - 30) * haloMix);
    const haloB = Math.round(40 + (255 - 40) * haloMix);
    const haloColor = `rgba(${haloR}, ${haloG}, ${haloB}, 0.80)`;

    overlayContext.shadowColor = haloColor;
    overlayContext.shadowBlur = 18 + 6 * Math.sin(frame * 0.06);
    overlayContext.lineWidth = Math.max(3, titleSize / 14);
    overlayContext.strokeStyle = haloColor;
    overlayContext.strokeText("DEAD AGAIN", cx, titleY);

    // Pass 3: Specular Gold/Crimson Bevel Gradient Fill
    const textGrad = overlayContext.createLinearGradient(cx, titleY - titleSize / 2, cx, titleY + titleSize / 2);
    textGrad.addColorStop(0, '#FFF5C0');
    textGrad.addColorStop(0.28, '#FF8A3D');
    textGrad.addColorStop(0.65, '#DC2626');
    textGrad.addColorStop(1, '#5C000C');
    overlayContext.fillStyle = textGrad;
    overlayContext.fillText("DEAD AGAIN", cx, titleY);

    // Pass 4: Specular Core Highlight Rim
    overlayContext.shadowBlur = 0;
    overlayContext.lineWidth = 1.2;
    overlayContext.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    overlayContext.strokeText("DEAD AGAIN", cx, titleY);
    overlayContext.restore();
}

// Subtitle Ribbon Bracket with 4-Second Specular Glint (D-10, D-16)
function renderStartSubtitleRibbon(cx, subY, subW, subH, u) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    if (typeof Path2D === 'undefined') return;
    overlayContext.save();
    const halfW = subW / 2;
    const halfH = subH / 2;
    const chamfer = 6;

    const path = new Path2D();
    path.moveTo(cx - halfW + chamfer, subY - halfH);
    path.lineTo(cx + halfW - chamfer, subY - halfH);
    path.lineTo(cx + halfW, subY - halfH + chamfer);
    path.lineTo(cx + halfW, subY + halfH - chamfer);
    path.lineTo(cx + halfW - chamfer, subY + halfH);
    path.lineTo(cx - halfW + chamfer, subY + halfH);
    path.lineTo(cx - halfW, subY + halfH - chamfer);
    path.lineTo(cx - halfW, subY - halfH + chamfer);
    path.closePath();

    // Dark-violet plate background fill
    overlayContext.fillStyle = 'rgba(18, 10, 32, 0.92)';
    overlayContext.fill(path);

    // Twitch-purple glowing border (#9146FF)
    overlayContext.strokeStyle = '#9146FF';
    overlayContext.lineWidth = 1.8;
    overlayContext.shadowColor = 'rgba(145, 70, 255, 0.60)';
    overlayContext.shadowBlur = 8;
    overlayContext.stroke(path);
    overlayContext.shadowBlur = 0;

    // Specular sheen sweep every 4s (240 frames) during first 1.0s (60 frames)
    const cycle = frame % 240;
    if (cycle < 60) {
        const sweepProgress = cycle / 60; // 0 to 1
        const sweepX = (cx - halfW) + sweepProgress * (subW + 60);

        overlayContext.save();
        overlayContext.clip(path);
        const sheen = overlayContext.createLinearGradient(sweepX - 30, subY - halfH, sweepX + 30, subY + halfH);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.70)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        overlayContext.fillStyle = sheen;
        overlayContext.fillRect(sweepX - 35, subY - halfH, 70, subH);
        overlayContext.restore();
    }

    // Subtitle text
    overlayContext.font = `bold ${Math.max(12, u * 0.75)}px ${fontDefault}`;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'middle';
    overlayContext.fillStyle = '#E8DDFF';
    overlayContext.fillText("- REVAMPED (TWITCH EDITION) -", cx, subY);
    overlayContext.restore();
}

// Interactive Cartouche, Help Button, All-Time Trophy Ledger & Streamer Bracket (D-07, D-08)
function renderStartScreenBadges(cx, H, u, safeW) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    overlayContext.save();

    // Previous Score Display (if present)
    if (typeof g_score !== 'undefined' && g_score > 0) {
        const scoreY = H * 0.54;
        const topScore = (typeof localStorage !== 'undefined' && localStorage.da_t) ? localStorage.da_t : g_score;
        drawTextWithOutline(`PREVIOUS SCORE: ${g_score}  ★  HIGH SCORE: ${topScore}`, vec2(cx, scoreY), Math.max(11, u * 0.60), colorSpark);
    }

    // 1. All-Time Records Trophy Ledger Plate (D-08)
    const ledgerY = H * 0.60;
    const ledgerW = Math.min(safeW * 0.88, u * 28);
    const ledgerH = u * 2.1;

    overlayContext.fillStyle = 'rgba(18, 22, 28, 0.85)';
    overlayContext.fillRect(cx - ledgerW / 2, ledgerY - ledgerH / 2, ledgerW, ledgerH);
    overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    overlayContext.lineWidth = 1.2;
    overlayContext.strokeRect(cx - ledgerW / 2, ledgerY - ledgerH / 2, ledgerW, ledgerH);

    let rec = (typeof g_apgManager !== 'undefined' && g_apgManager)
        ? (g_apgManager.allTimeRecords || (g_apgManager.loadAllTimeRecords && g_apgManager.loadAllTimeRecords()))
        : null;

    let mvpStr = rec && rec.mvp ? `ALL-TIME MVP: @${rec.mvp.user} (${rec.mvp.score} pts)` : "ALL-TIME MVP: None (0 pts)";
    let traitorStr = rec && rec.traitor ? `ALL-TIME TRAITOR: @${rec.traitor.user} (${rec.traitor.score} pts)` : "ALL-TIME TRAITOR: None (0 pts)";
    let winsStr = rec ? `RECORD: ${rec.goodWins || 0} GOOD WINS - ${rec.badWins || 0} BAD WINS` : "RECORD: 0 GOOD WINS - 0 BAD WINS";

    drawTextWithOutline(`${mvpStr}  |  ${traitorStr}`, vec2(cx, ledgerY - u * 0.35), Math.max(10, u * 0.52), colorSpark);
    drawTextWithOutline(winsStr, vec2(cx, ledgerY + u * 0.40), Math.max(10, u * 0.48), colorBullet);

    // 2. Primary CTA: Pulsating Arcade Cartouche Badge (D-07)
    const ctaY = H * 0.74;
    const ctaW = Math.min(safeW * 0.65, u * 17);
    const ctaH = u * 2.3;

    // Retro "INSERT COIN" double-beat heartbeat timing
    const cycle = frame % 60;
    let pulseScale = 1.0;
    if (cycle < 10) pulseScale = 1.0 + 0.05 * Math.sin((cycle / 10) * Math.PI);
    else if (cycle >= 14 && cycle < 24) pulseScale = 1.0 + 0.03 * Math.sin(((cycle - 14) / 10) * Math.PI);

    overlayContext.save();
    overlayContext.translate(cx, ctaY);
    overlayContext.scale(pulseScale, pulseScale);

    // Cartouche Pill Path
    const pillR = ctaH / 2;
    overlayContext.beginPath();
    overlayContext.moveTo(-ctaW / 2 + pillR, -ctaH / 2);
    overlayContext.lineTo(ctaW / 2 - pillR, -ctaH / 2);
    overlayContext.arc(ctaW / 2 - pillR, 0, pillR, -Math.PI / 2, Math.PI / 2);
    overlayContext.lineTo(-ctaW / 2 + pillR, ctaH / 2);
    overlayContext.arc(-ctaW / 2 + pillR, 0, pillR, Math.PI / 2, -Math.PI / 2);
    overlayContext.closePath();

    // Dark pill background
    overlayContext.fillStyle = 'rgba(12, 14, 18, 0.94)';
    overlayContext.fill();

    // Glowing neon border alternating between Gold and Crimson
    const borderMix = 0.5 + 0.5 * Math.sin(frame * 0.12);
    const neonColor = borderMix > 0.5 ? '#FBF236' : '#AC3232';
    overlayContext.strokeStyle = neonColor;
    overlayContext.lineWidth = 2.4;
    overlayContext.shadowColor = neonColor;
    overlayContext.shadowBlur = 10;
    overlayContext.stroke();
    overlayContext.shadowBlur = 0;

    // Call-to-Action text based on input scheme
    const ctaText = "CLICK / TAP TO SURVIVE";
    overlayContext.font = `bold ${Math.max(13, u * 0.78)}px ${fontDefault}`;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'middle';
    overlayContext.fillStyle = '#FFFFFF';
    overlayContext.fillText(ctaText, 0, 0);
    overlayContext.restore();

    // 3. Secondary CTA: "[H] HOW TO PLAY & GUIDE" Button (D-11)
    const guideY = H * 0.83;
    const guideW = Math.min(safeW * 0.50, u * 15);
    const guideH = u * 1.7;

    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.88)';
    overlayContext.fillRect(cx - guideW / 2, guideY - guideH / 2, guideW, guideH);
    overlayContext.strokeStyle = '#FBF236';
    overlayContext.lineWidth = 1.4;
    overlayContext.strokeRect(cx - guideW / 2, guideY - guideH / 2, guideW, guideH);

    drawTextWithOutline("[H] HOW TO PLAY & GUIDE", vec2(cx, guideY), Math.max(11, u * 0.62), colorSpark);

    // 4. OS-aware Streamer Dashboard Shortcut Bracket (D-08)
    const isMac = typeof navigator !== 'undefined' && (/Mac|iPhone|iPod|iPad/i.test(navigator.platform || '') || /Macintosh|Mac OS X/i.test(navigator.userAgent || ''));
    const keyHint = isMac ? "⌘+D" : "Ctrl+D";
    const dashText = `Press ${keyHint} to Open Streamer Dashboard`;
    const dashY = H * 0.93;
    drawTextWithOutline(dashText, vec2(cx, dashY), Math.max(11, u * 0.55), new Color(0.78, 0.65, 1.0, 0.95), colorBlack);

    overlayContext.restore();
}

// Tab 1: Weapon Stat Cards & Health Telemetry
function renderHelpTabWeapons(x, y, w, h, u) {
    const cardW = (w - u * 0.8) / 2;
    const cardH = (h - u * 1.8) / 2;

    const weapons = [
        {
            name: "SERVICE PISTOL",
            tile: tileNumbers_pistol,
            mag: "6 Rounds (Single Row)",
            cap: "36 Bullets Reserve",
            desc: "Balanced sidearm. Precision semi-auto fire with crisp trigger reset."
        },
        {
            name: "MACHINE PISTOL (SMG)",
            tile: tileNumbers_smg,
            mag: "20 Rounds (2x10 Grid)",
            cap: "36 Bullets Reserve",
            desc: "Rapid spray (12.5 rps) with hold bloom; tap burst for pinpoint accuracy."
        },
        {
            name: "COMBAT SHOTGUN",
            tile: tileNumbers_shotgun,
            mag: "2 Heavy Shells",
            cap: "8 Shells Reserve",
            desc: "High close-range lethality with wide pellet spread. Scarcity-tuned."
        },
        {
            name: "HUNTING RIFLE",
            tile: tileNumbers_rifle,
            mag: "4 Rounds",
            cap: "8 Rounds Reserve",
            desc: "Piercing long-range stopping power. Heavy knockdown against bosses."
        }
    ];

    for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = x + col * (cardW + u * 0.8);
        const cy = y + row * (cardH + u * 0.6);
        const wep = weapons[i];

        overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
        overlayContext.fillRect(cx, cy, cardW, cardH);
        overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.35)';
        overlayContext.strokeRect(cx, cy, cardW, cardH);

        // Weapon Tile
        drawOverlayTile(wep.tile, cx + u * 1.5, cy + cardH * 0.35, u * 2.8, 0, false, 1.0);

        // Weapon Title & Details
        overlayContext.font = `bold ${Math.max(11, u * 0.62)}px ${fontDefault}`;
        overlayContext.textAlign = 'left';
        overlayContext.fillStyle = '#FBF236';
        overlayContext.fillText(wep.name, cx + u * 3.4, cy + u * 0.8);

        overlayContext.font = `bold ${Math.max(9, u * 0.46)}px ${fontDefault}`;
        overlayContext.fillStyle = '#D4AF37';
        overlayContext.fillText(`MAG: ${wep.mag} | CAP: ${wep.cap}`, cx + u * 3.4, cy + u * 1.6);

        overlayContext.font = `${Math.max(9, u * 0.44)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        overlayContext.fillText(wep.desc, cx + u * 0.8, cy + cardH - u * 0.5);
    }

    // Health Telemetry Footer
    const footY = y + cardH * 2 + u * 0.9;
    overlayContext.font = `bold ${Math.max(10, u * 0.52)}px ${fontDefault}`;
    overlayContext.textAlign = 'left';
    overlayContext.fillStyle = '#FF4D4D';
    overlayContext.fillText("HEALTH & SURVIVAL: 3 Base Hearts + 1 Golden Shield Pip. 1 HP triggers critical danger pulse.", x + u * 0.5, footY);
}

// Tab 2: Twitch APG Karma, Commands & Mob Threat Cards
function renderHelpTabTwitch(x, y, w, h, u) {
    // Karma Meter Explanation
    overlayContext.font = `bold ${Math.max(11, u * 0.62)}px ${fontDefault}`;
    overlayContext.textAlign = 'left';
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("TWITCH TUG-OF-WAR KARMA ENGINE", x, y + u * 0.6);

    overlayContext.font = `${Math.max(9, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    overlayContext.fillText("Audience votes & chat events shift the live Karma balance between GOOD (Survivor) and BAD (Horde).", x, y + u * 1.3);

    // Command Cheat Sheet Box
    const cmdY = y + u * 2.0;
    const cmdH = u * 3.8;
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, cmdY, w, cmdH);
    overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    overlayContext.strokeRect(x, cmdY, w, cmdH);

    overlayContext.font = `bold ${Math.max(10, u * 0.52)}px ${fontDefault}`;
    overlayContext.fillStyle = '#4ADE80';
    overlayContext.fillText("GOOD TEAM COMMANDS: !buff (Speed/Damage), !drop / !ammo (Supply Drop), !heal (Clutch Shield)", x + u * 0.8, cmdY + u * 1.0);

    overlayContext.fillStyle = '#FF4D4D';
    overlayContext.fillText("BAD TEAM COMMANDS: !sabotage (Jam Gun), !frenzy (Blood Surge), !zombie (Spawn Horde)", x + u * 0.8, cmdY + u * 2.2);

    overlayContext.fillStyle = '#9146FF';
    overlayContext.fillText("CLUTCH EVENTS: Karma ≥85% unlocks DIVINE FLASH (Board Stun) or BLOOD SURGE (Nightmare Swarm)", x + u * 0.8, cmdY + u * 3.2);

    // Mob Threat Cards
    const mobY = cmdY + cmdH + u * 0.8;
    overlayContext.font = `bold ${Math.max(11, u * 0.58)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("MOB THREAT INTEL", x, mobY);

    const mobs = [
        { name: "ZOMBIE", speed: "Normal", threat: "Swarm", face: tileNumbers_faceZombie },
        { name: "VAMPIRE", speed: "Very Fast", threat: "Flanker", face: tileNumbers_faceVampire },
        { name: "GHOST", speed: "Phasing", threat: "Wall-Clipper", face: tileNumbers_ghost }
    ];

    const mCardW = (w - u * 0.8) / 3;
    for (let i = 0; i < 3; i++) {
        const mx = x + i * (mCardW + u * 0.4);
        const my = mobY + u * 0.4;
        const mob = mobs[i];

        overlayContext.fillStyle = 'rgba(22, 27, 34, 0.65)';
        overlayContext.fillRect(mx, my, mCardW, u * 3.0);
        overlayContext.strokeStyle = 'rgba(172, 50, 50, 0.45)';
        overlayContext.strokeRect(mx, my, mCardW, u * 3.0);

        drawOverlayTile(mob.face, mx + u * 1.0, my + u * 1.5, u * 2.0, 0, false, 1.0);

        overlayContext.font = `bold ${Math.max(10, u * 0.50)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FF4D4D';
        overlayContext.fillText(mob.name, mx + u * 2.4, my + u * 1.0);

        overlayContext.font = `${Math.max(9, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        overlayContext.fillText(`SPEED: ${mob.speed}`, mx + u * 2.4, my + u * 1.8);
        overlayContext.fillText(`TACTIC: ${mob.threat}`, mx + u * 2.4, my + u * 2.5);
    }
}

// Tab 3: Streamer Dashboard & OBS Integration
function renderHelpTabStreamer(x, y, w, h, u) {
    overlayContext.font = `bold ${Math.max(11, u * 0.62)}px ${fontDefault}`;
    overlayContext.textAlign = 'left';
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("STREAMER SETUP & BROADCAST INSTRUCTIONS", x, y + u * 0.6);

    const cardH = (h - u * 1.5) / 3;

    // Card 1: Dashboard Shortcut
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, y + u * 1.2, w, cardH);
    overlayContext.strokeStyle = 'rgba(145, 70, 255, 0.55)';
    overlayContext.strokeRect(x, y + u * 1.2, w, cardH);

    overlayContext.font = `bold ${Math.max(10, u * 0.55)}px ${fontDefault}`;
    overlayContext.fillStyle = '#9146FF';
    overlayContext.fillText("1. STREAMER DASHBOARD (Cmd+D / Ctrl+D)", x + u * 0.8, y + u * 2.1);

    overlayContext.font = `${Math.max(9, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    overlayContext.fillText("Open the companion dashboard to view live prediction wagers, trigger manual clutches, or simulate audience events.", x + u * 0.8, y + u * 2.9);

    // Card 2: Prediction Lifecycle
    const y2 = y + u * 1.2 + cardH + u * 0.4;
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, y2, w, cardH);
    overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    overlayContext.strokeRect(x, y2, w, cardH);

    overlayContext.font = `bold ${Math.max(10, u * 0.55)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("2. CHANNEL POINTS PREDICTION LIFECYCLE", x + u * 0.8, y2 + u * 0.9);

    overlayContext.font = `${Math.max(9, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    overlayContext.fillText("Lobby opens prediction -> Locked on level start -> Automatically resolves payouts upon Victory or Player Death.", x + u * 0.8, y2 + u * 1.7);

    // Card 3: OBS Studio Capture
    const y3 = y2 + cardH + u * 0.4;
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, y3, w, cardH);
    overlayContext.strokeStyle = 'rgba(74, 222, 128, 0.45)';
    overlayContext.strokeRect(x, y3, w, cardH);

    overlayContext.font = `bold ${Math.max(10, u * 0.55)}px ${fontDefault}`;
    overlayContext.fillStyle = '#4ADE80';
    overlayContext.fillText("3. ZERO-OVERLAY OBS CAPTURE", x + u * 0.8, y3 + u * 0.9);

    overlayContext.font = `${Math.max(9, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    overlayContext.fillText("No external browser sources or overlays required. Add a Window/Game Capture in OBS targeting Dead Again.", x + u * 0.8, y3 + u * 1.7);
}

// Tabbed In-Game Field Manual & Streamer Guide (D-11, D-12, D-17)
function renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH) {
    if (!g_startHelpOpen) return;
    if (typeof overlayContext === 'undefined' || !overlayContext) return;

    overlayContext.save();

    // 1. Dark Backdrop Dimming
    overlayContext.fillStyle = 'rgba(5, 2, 4, 0.78)';
    overlayContext.fillRect(0, 0, W, H);

    // 2. Terminal Card Container
    const modalW = Math.min(safeW * 0.92, 1020);
    const modalH = Math.min(safeH * 0.86, 680);
    const modalX = cx - modalW / 2;
    const modalY = cy - modalH / 2;

    // Dark slate backdrop
    overlayContext.fillStyle = 'rgba(16, 20, 26, 0.96)';
    overlayContext.fillRect(modalX, modalY, modalW, modalH);

    // Gold border with corner rivets
    overlayContext.strokeStyle = '#D4AF37';
    overlayContext.lineWidth = 2.0;
    overlayContext.strokeRect(modalX, modalY, modalW, modalH);

    // 3. Modal Header
    const headerY = modalY + u * 1.4;
    overlayContext.font = `bold ${Math.max(14, u * 0.88)}px ${fontDefault}`;
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'middle';
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("★ SURVIVOR FIELD MANUAL & STREAMER GUIDE", modalX + u * 1.0, headerY);

    overlayContext.font = `bold ${Math.max(11, u * 0.58)}px ${fontDefault}`;
    overlayContext.textAlign = 'right';
    overlayContext.fillStyle = '#E8DDFF';
    overlayContext.fillText("[ESC / X] RETURN TO START", modalX + modalW - u * 1.0, headerY);

    // 4. Tab Header Navigation Bar
    const tabY = headerY + u * 1.5;
    const tabH = u * 1.6;
    const tabW = (modalW - u * 2.0) / 3;
    const tabTitles = [
        "1. COMBAT & WEAPONS",
        "2. TWITCH APG & KARMA",
        "3. STREAMER SETUP"
    ];

    for (let i = 0; i < 3; i++) {
        const tx = modalX + u * 1.0 + i * tabW;
        const isActive = (g_startHelpTab === i);

        overlayContext.fillStyle = isActive ? 'rgba(212, 175, 55, 0.22)' : 'rgba(22, 27, 34, 0.60)';
        overlayContext.fillRect(tx, tabY - tabH / 2, tabW - 4, tabH);

        overlayContext.strokeStyle = isActive ? '#FBF236' : 'rgba(212, 175, 55, 0.35)';
        overlayContext.lineWidth = isActive ? 2.0 : 1.0;
        overlayContext.strokeRect(tx, tabY - tabH / 2, tabW - 4, tabH);

        overlayContext.font = `bold ${Math.max(10, u * 0.55)}px ${fontDefault}`;
        overlayContext.textAlign = 'center';
        overlayContext.fillStyle = isActive ? '#FFFFFF' : '#B0B8C4';
        overlayContext.fillText(tabTitles[i], tx + (tabW - 4) / 2, tabY);
    }

    // 5. Tab Content Area
    const contentY = tabY + tabH / 2 + u * 0.6;
    const contentH = modalH - (contentY - modalY) - u * 0.8;
    const contentW = modalW - u * 2.0;
    const contentX = modalX + u * 1.0;

    if (g_startHelpTab === 0) {
        // TAB 1: COMBAT & WEAPONS (D-11, D-12, BAL-23, CLIP-01)
        renderHelpTabWeapons(contentX, contentY, contentW, contentH, u);
    } else if (g_startHelpTab === 1) {
        // TAB 2: TWITCH APG & AUDIENCE (D-11, D-12)
        renderHelpTabTwitch(contentX, contentY, contentW, contentH, u);
    } else {
        // TAB 3: STREAMER SETUP (D-11)
        renderHelpTabStreamer(contentX, contentY, contentW, contentH, u);
    }

    overlayContext.restore();
}

// Theatrical Launch Sequence & Audio Triggers (D-14, D-15)
function triggerStartTheatricalLaunch() {
    if (g_startLaunchTimer > 0) return;
    g_startLaunchTimer = Date.now();
    g_startFlashFrames = 12;

    const sPos = (typeof cameraPos !== 'undefined' && cameraPos) ? cameraPos : vec2(0, 0);

    // Staggered theatrical audio feedback (D-14)
    if (typeof soundGunReload !== 'undefined' && soundGunReload && soundGunReload.play) {
        soundGunReload.play(sPos, 1.2, 1.0);
    }
    setTimeout(() => {
        if (typeof soundShotgun !== 'undefined' && soundShotgun && soundShotgun.play) {
            soundShotgun.play(sPos, 1.5, 0.85);
        }
    }, 110);
    setTimeout(() => {
        if (typeof soundBossSpawn !== 'undefined' && soundBossSpawn && soundBossSpawn.play) {
            soundBossSpawn.play(sPos, 1.2, 0.9);
        } else if (typeof soundEnemyGroan !== 'undefined' && soundEnemyGroan && soundEnemyGroan.play) {
            soundEnemyGroan.play(sPos, 1.4, 0.6);
        }
    }, 220);
    setTimeout(() => {
        if (typeof soundDivineFlash !== 'undefined' && soundDivineFlash && soundDivineFlash.play) {
            soundDivineFlash.play(sPos, 1.0, 1.2);
        } else if (typeof soundTeamGood !== 'undefined' && soundTeamGood && soundTeamGood.play) {
            soundTeamGood.play(sPos, 1.0, 1.4);
        }
    }, 360);
}

// Unified Multi-Input Handling (D-13)
function updateStartScreen() {
    const W = mainCanvas ? mainCanvas.width : 1920;
    const H = mainCanvas ? mainCanvas.height : 1080;
    const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(W, H);

    // Flash countdown
    if (g_startFlashFrames > 0) {
        g_startFlashFrames--;
        if (g_startFlashFrames === 0) {
            if (typeof startNewGame === 'function') startNewGame();
            if (typeof enterLobbyState === 'function') enterLobbyState();
            g_startLaunchTimer = 0;
        }
        return;
    }

    const mPos = (typeof mousePosScreen !== 'undefined' && mousePosScreen) ? mousePosScreen : null;
    const clicked = (typeof mouseWasPressed !== 'undefined') ? mouseWasPressed(0) : false;

    if (g_startHelpOpen) {
        // Field Manual Modal Input Routing
        const modalW = Math.min(safeW * 0.92, 1020);
        const modalH = Math.min(safeH * 0.86, 680);
        const modalX = cx - modalW / 2;
        const modalY = cy - modalH / 2;
        const headerY = modalY + u * 1.4;
        const tabY = headerY + u * 1.5;
        const tabH = u * 1.6;
        const tabW = (modalW - u * 2.0) / 3;

        // Mouse click on tabs
        if (clicked && mPos) {
            for (let i = 0; i < 3; i++) {
                const tx = modalX + u * 1.0 + i * tabW;
                if (mPos.x >= tx && mPos.x <= tx + tabW - 4 && mPos.y >= tabY - tabH / 2 && mPos.y <= tabY + tabH / 2) {
                    g_startHelpTab = i;
                    if (typeof soundCountdownBeep !== 'undefined' && soundCountdownBeep.play) soundCountdownBeep.play();
                    return;
                }
            }
            // Close button / backdrop click
            if (mPos.x < modalX || mPos.x > modalX + modalW || mPos.y < modalY || mPos.y > modalY + modalH || (mPos.y <= modalY + u * 2.2 && mPos.x >= modalX + modalW - u * 8.0)) {
                g_startHelpOpen = false;
                return;
            }
        }

        // Keyboard: 1, 2, 3, Left/Right arrows, Esc, H
        if (typeof keyWasPressed !== 'undefined') {
            if (keyWasPressed(49)) g_startHelpTab = 0; // '1'
            if (keyWasPressed(50)) g_startHelpTab = 1; // '2'
            if (keyWasPressed(51)) g_startHelpTab = 2; // '3'
            if (keyWasPressed(37)) g_startHelpTab = (g_startHelpTab + 2) % 3; // Left Arrow
            if (keyWasPressed(39)) g_startHelpTab = (g_startHelpTab + 1) % 3; // Right Arrow
            if (keyWasPressed(27) || keyWasPressed(72)) { // Esc or 'H'
                g_startHelpOpen = false;
                return;
            }
        }

        // Gamepad: LB (4) / RB (5) switch tabs, B (1) / Y (3) close
        if (typeof gamepadWasPressed !== 'undefined') {
            if (gamepadWasPressed(4)) g_startHelpTab = (g_startHelpTab + 2) % 3;
            if (gamepadWasPressed(5)) g_startHelpTab = (g_startHelpTab + 1) % 3;
            if (gamepadWasPressed(1) || gamepadWasPressed(3)) {
                g_startHelpOpen = false;
                return;
            }
        }
        return;
    }

    // Start Screen Input Routing (Modal closed)
    const ctaY = H * 0.74;
    const ctaW = Math.min(safeW * 0.65, u * 17);
    const ctaH = u * 2.3;

    const guideY = H * 0.83;
    const guideW = Math.min(safeW * 0.50, u * 15);
    const guideH = u * 1.7;

    // Mouse click detection
    if (clicked && mPos) {
        // Clicked Help Button
        if (Math.abs(mPos.x - cx) < guideW / 2 && Math.abs(mPos.y - guideY) < guideH / 2) {
            g_startHelpOpen = true;
            if (typeof soundCountdownBeep !== 'undefined' && soundCountdownBeep.play) soundCountdownBeep.play();
            return;
        }
        // Clicked CTA Cartouche
        if (Math.abs(mPos.x - cx) < ctaW / 2 && Math.abs(mPos.y - ctaY) < ctaH / 2) {
            triggerStartTheatricalLaunch();
            return;
        }
    }

    // Keyboard: Enter (13) or Space (32) starts; H (72) opens Help
    if (typeof keyWasPressed !== 'undefined') {
        if (keyWasPressed(13) || keyWasPressed(32)) {
            triggerStartTheatricalLaunch();
            return;
        }
        if (keyWasPressed(72)) {
            g_startHelpOpen = true;
            if (typeof soundCountdownBeep !== 'undefined' && soundCountdownBeep.play) soundCountdownBeep.play();
            return;
        }
    }

    // Gamepad: A (0) starts; Y (3) opens Help
    if (typeof gamepadWasPressed !== 'undefined') {
        if (gamepadWasPressed(0)) {
            triggerStartTheatricalLaunch();
            return;
        }
        if (gamepadWasPressed(3)) {
            g_startHelpOpen = true;
            if (typeof soundCountdownBeep !== 'undefined' && soundCountdownBeep.play) soundCountdownBeep.play();
            return;
        }
    }
}

// Master Render Entry Point: Isolated inside save() and restore() (D-09)
function renderStartScreen() {
    if (!overlayContext) return;
    const W = mainCanvas ? mainCanvas.width : 1920;
    const H = mainCanvas ? mainCanvas.height : 1080;
    const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(W, H);

    overlayContext.save();

    // 1. Atmosphere (CRT Scanlines & Radial Vignette, D-06)
    renderStartAtmosphere(W, H, cx, cy);

    // 2. 24 Rising Ember Particles (D-05, D-16)
    updateAndRenderStartEmbers(W, H);

    // 3. Heraldic Hero Crest & Crossed Weapons (D-01..D-04)
    renderStartScreenCrest(cx, cy, u);

    // 4. "DEAD AGAIN" Layered Chromatic Typography (D-09)
    const titleY = cy - u * 0.8;
    renderStartTypography(cx, titleY, u);

    // 5. "- REVAMPED (TWITCH EDITION) -" Subtitle Ribbon (D-10)
    const subY = titleY + u * 1.8;
    const subW = Math.min(safeW * 0.68, u * 18);
    const subH = u * 1.4;
    renderStartSubtitleRibbon(cx, subY, subW, subH, u);

    // 6. Badges & Secondary Panels (CTA, Records Ledger, Streamer Hint, D-07, D-08)
    renderStartScreenBadges(cx, H, u, safeW);

    // 7. Field Manual Modal Overlay (if active, D-11, D-12)
    if (g_startHelpOpen) {
        renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH);
    }

    // 8. 12-Frame Transition Flash Wipe (D-15)
    if (g_startFlashFrames > 0) {
        const flashAlpha = g_startFlashFrames / 12;
        overlayContext.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.85})`;
        overlayContext.fillRect(0, 0, W, H);
    }

    overlayContext.restore();
}
