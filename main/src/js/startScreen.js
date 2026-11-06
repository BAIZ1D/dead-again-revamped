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

    overlayContext.restore();
}
