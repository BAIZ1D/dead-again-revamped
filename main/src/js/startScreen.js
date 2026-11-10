/** @format */

// Start Screen Modular Engine (Phase 17, Phase 21, VIS-01..VIS-04)
// 0 KB external asset overhead: 100% procedural Canvas 2D + LittleJS tiles

let g_startEmbers = [];
let g_startHelpOpen = false;
let g_startCreditsOpen = false;
let g_startHelpTab = 0; // 0: Combat & Weapons, 1: Twitch APG & Karma, 2: Streamer Setup
let g_startLaunchTimer = 0;
let g_startFlashFrames = 0;
let g_startGamepadDebounce = false;
let g_startMoonPulseFrames = 0;
let g_startModalSpringFrames = 0;
let g_startUserInteracted = false;
let g_startWindTimer = 780; // 13s initial procedural wind cadence (720-960 frames, D-23)
let g_startHoverCTA = false;
let g_startHoverGuide = false;
let g_startHoverCredits = false;
var g_startHoverExit = false;

// Tab Pitch Multiplier Table for Compendium Navigation Chirps (D-24)
const START_TAB_PITCH_RATES = [1.0, 1.12, 1.25];

// Classic 4x4 Bayer Ordered Dither Matrix normalized [0..15] / 16 (D-11)
const START_BAYER_4X4 = [
    0 / 16,  8 / 16,  2 / 16, 10 / 16,
   12 / 16,  4 / 16, 14 / 16,  6 / 16,
    3 / 16, 11 / 16,  1 / 16,  9 / 16,
   15 / 16,  7 / 16, 13 / 16,  5 / 16
];

// 3 Procedural Shaded Lunar Craters: [dxRatio, dyRatio, radiusRatio, depth] (D-12)
const START_MOON_CRATERS = [
    [-0.22,  0.14, 0.30, 0.85], // Primary impact basin
    [ 0.28, -0.20, 0.17, 0.70], // Upper-right crater pit
    [ 0.14,  0.36, 0.14, 0.65]  // Lower-right crater pit
];

// Compute Lunar Center & Radius Clamped to 16:9 Safe Zone (D-09, D-20)
function getStartMoonMetrics(W, H, u, safeW, safeH) {
    const sw = safeW || W;
    const sh = safeH || H;
    const offsetX = (W - sw) / 2;
    const offsetY = (H - sh) / 2;
    const moonX = offsetX + sw * 0.76;
    const moonY = offsetY + sh * 0.21;
    const moonR = u * 3.7;
    return { moonX, moonY, moonR };
}

// Procedural 16-Bit Bayer-Dithered Blood/Harvest Moon & Twin Halo Rings (VIS-03, D-09..D-12, D-25)
function renderStartMoon(cx, cy, u, W, H, safeW, safeH) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    overlayContext.save();

    const { moonX, moonY, moonR } = getStartMoonMetrics(W, H, u, safeW, safeH);
    const step = Math.max(2, Math.round(u / 8));
    const breathAlpha = 0.12 + 0.08 * Math.sin(frame * 0.03);

    // 1. Twin Concentric Breathing Halo Glow Rings (1.55 * moonR and 1.25 * moonR, D-12)
    const outerHaloR = 1.55 * moonR;
    const innerHaloR = 1.25 * moonR;

    overlayContext.fillStyle = `rgba(234, 88, 12, ${(breathAlpha * 0.55).toFixed(3)})`;
    overlayContext.beginPath();
    overlayContext.arc(moonX, moonY, outerHaloR, 0, Math.PI * 2);
    overlayContext.fill();

    overlayContext.strokeStyle = `rgba(245, 158, 11, ${(breathAlpha * 0.90).toFixed(3)})`;
    overlayContext.lineWidth = Math.max(1.5, step * 0.6);
    overlayContext.stroke();

    overlayContext.fillStyle = `rgba(253, 224, 71, ${(breathAlpha * 0.85).toFixed(3)})`;
    overlayContext.beginPath();
    overlayContext.arc(moonX, moonY, innerHaloR, 0, Math.PI * 2);
    overlayContext.fill();

    overlayContext.strokeStyle = `rgba(253, 224, 71, ${Math.min(1, breathAlpha * 1.25).toFixed(3)})`;
    overlayContext.lineWidth = Math.max(1.5, step * 0.75);
    overlayContext.stroke();

    // 2. Interactive Easter Egg: 10-Frame Chromatic Corona Flare Rings (D-25)
    if (g_startMoonPulseFrames > 0) {
        const pulseProgress = (10 - g_startMoonPulseFrames) / 10;
        const flareR1 = moonR * (1.15 + pulseProgress * 0.95);
        const flareR2 = moonR * (1.05 + pulseProgress * 0.65);
        const flareAlpha = (g_startMoonPulseFrames / 10) * 0.85;

        overlayContext.save();
        overlayContext.strokeStyle = '#FF4D4D';
        overlayContext.lineWidth = Math.max(2, step * 1.2);
        overlayContext.globalAlpha = flareAlpha;
        overlayContext.beginPath();
        overlayContext.arc(moonX, moonY, flareR1, 0, Math.PI * 2);
        overlayContext.stroke();

        overlayContext.strokeStyle = '#FBF236';
        overlayContext.lineWidth = Math.max(1.5, step * 0.9);
        overlayContext.beginPath();
        overlayContext.arc(moonX, moonY, flareR2, 0, Math.PI * 2);
        overlayContext.stroke();
        overlayContext.restore();
    }

    // 3. Bayer 4x4 Ordered Dithered Lunar Disk & 3 Shaded Craters (D-10, D-11, D-12)
    // Blood/Harvest Hybrid Palette stops (0: sunlit upper-left -> 4: deep burgundy lower-right)
    const palette = ['#FDE047', '#F59E0B', '#EA580C', '#7F1D1D', '#450A0A'];
    const craterFloors = ['#2B070E', '#1E050A'];

    const rSq = moonR * moonR;
    const startX = Math.floor((moonX - moonR) / step) * step;
    const endX = Math.ceil((moonX + moonR) / step) * step;
    const startY = Math.floor((moonY - moonR) / step) * step;
    const endY = Math.ceil((moonY + moonR) / step) * step;

    for (let py = startY; py <= endY; py += step) {
        const dy = py + step * 0.5 - moonY;
        const dySq = dy * dy;
        const by = ((py / step) & 3) << 2;

        for (let px = startX; px <= endX; px += step) {
            const dx = px + step * 0.5 - moonX;
            const distSq = dx * dx + dySq;
            if (distSq > rSq) continue;

            const nx = dx / moonR;
            const ny = dy / moonR;
            const bayerThreshold = START_BAYER_4X4[by + ((px / step) & 3)];

            // Check 3 procedural craters
            let inCrater = 0;
            let onCraterRim = false;
            for (let c = 0; c < 3; c++) {
                const crater = START_MOON_CRATERS[c];
                const cdx = nx - crater[0];
                const cdy = ny - crater[1];
                const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
                const cRad = crater[2];
                if (cDist < cRad * 0.78) {
                    inCrater = c + 1;
                    break;
                } else if (cDist < cRad * 1.06) {
                    onCraterRim = true;
                }
            }

            if (inCrater > 0) {
                overlayContext.fillStyle = (bayerThreshold < 0.45) ? craterFloors[0] : craterFloors[1];
                overlayContext.fillRect(px, py, step, step);
                continue;
            }

            // Directional terminator shading: upper-left (-0.7, -0.7) is sunlit gold (0.0), lower-right is crimson shadow (1.0)
            let shade = (nx * 0.68 + ny * 0.72 + 1.0) * 0.5;
            // Spherical limb darkening near edge
            const edgeRatio = distSq / rSq;
            shade = shade * 0.82 + edgeRatio * 0.24;
            if (onCraterRim) shade = Math.min(1.0, shade + 0.28);
            if (g_startMoonPulseFrames > 0) shade = Math.min(1.0, shade + 0.18);
            shade = Math.max(0, Math.min(0.999, shade));

            const scaled = shade * (palette.length - 1);
            const bandIdx = scaled | 0;
            const frac = scaled - bandIdx;
            const colorIdx = (frac > bayerThreshold && bandIdx < palette.length - 1) ? bandIdx + 1 : bandIdx;

            overlayContext.fillStyle = palette[colorIdx];
            overlayContext.fillRect(px, py, step, step);
        }
    }

    // 4. Illuminated Upper-Left Lunar Rim Highlight (#FDE047)
    overlayContext.strokeStyle = '#FDE047';
    overlayContext.lineWidth = Math.max(1.2, step * 0.5);
    overlayContext.beginPath();
    overlayContext.arc(moonX, moonY, moonR, Math.PI * 0.85, Math.PI * 1.65);
    overlayContext.stroke();

    overlayContext.restore();
}

// Static Normalized Anchor Tables for 3-Plane Gothic Graveyard Silhouette (VIS-02, D-01..D-08)
// Format: [xRatio, widthU, heightU, type, extra]
// Plane 1: Distant gothic cathedral spires (0), pointed roofs (1), stone mausoleums (2)
const START_GRAVEYARD_PLANE1 = [
    [0.06, 2.2, 6.8, 0, 1], // Far-left cathedral spire with lancet window
    [0.12, 3.0, 4.2, 1, 0], // Left pointed nave roof
    [0.19, 2.5, 5.8, 0, 1], // Inner-left bell spire with lancet window
    [0.27, 2.6, 3.1, 2, 0], // Left-mid distant stone mausoleum
    [0.73, 2.8, 3.3, 2, 0], // Right-mid distant stone mausoleum
    [0.81, 2.4, 6.2, 0, 1], // Inner-right bell spire with lancet window
    [0.88, 3.2, 4.4, 1, 0], // Right pointed chapel roof
    [0.94, 2.3, 7.1, 0, 1]  // Far-right tall cathedral spire with lancet window
];

// Plane 2: Twisted dead oak trees (0), weathered stone vaults (1), crooked Latin/Celtic crosses (2, 3)
const START_GRAVEYARD_PLANE2 = [
    [0.04, 1.4, 6.4, 0, -1], // Far-left gnarled dead oak reaching right
    [0.15, 0.9, 2.4, 2, -0.14], // Left crooked Latin cross
    [0.23, 2.2, 2.5, 1, 0],  // Left weathered stone vault
    [0.32, 1.0, 2.6, 3, 0.12],  // Left-center Celtic cross
    [0.68, 1.0, 2.5, 2, -0.16], // Right-center crooked Latin cross
    [0.76, 2.3, 2.6, 1, 0],  // Right weathered stone vault
    [0.85, 1.0, 2.7, 3, 0.15],  // Right Celtic cross
    [0.95, 1.5, 6.8, 0, 1]   // Far-right gnarled dead oak reaching left
];

// Plane 3: Leaning headstones (0), crooked crosses (1), cracked obelisks (2), flat burial slabs (3)
const START_GRAVEYARD_PLANE3 = [
    [0.08, 1.1, 1.9, 0, -0.12], // Leaning round-top headstone
    [0.14, 1.8, 0.7, 3, 0.0],   // Flat mossy burial slab
    [0.20, 0.9, 3.2, 2, 0.05],  // Cracked pointed obelisk
    [0.28, 1.0, 1.8, 0, 0.14],  // Leaning round-top headstone
    [0.36, 0.8, 2.1, 1, -0.18], // Foreground crooked cross
    [0.44, 1.6, 0.6, 3, 0.0],   // Center-left low burial slab
    [0.56, 1.7, 0.6, 3, 0.0],   // Center-right low burial slab
    [0.64, 1.1, 1.9, 0, -0.15], // Leaning round-top headstone
    [0.72, 0.9, 3.4, 2, -0.06], // Cracked pointed obelisk
    [0.80, 0.8, 2.2, 1, 0.16],  // Foreground crooked cross
    [0.87, 1.8, 0.7, 3, 0.0],   // Flat mossy burial slab
    [0.92, 1.2, 2.0, 0, 0.11]   // Far-right leaning headstone
];

// Scooped U-Profile Ground Baseline Y Evaluator (VIS-02, D-02)
// Dips to 76% H (24% from bottom) at screen center, rising to 60% H (40% from bottom) at flanks
function getStartHorizonY(x, W, H, planeOffsetRatio) {
    const normX = (x / Math.max(1, W)) * 2 - 1; // -1 at left edge, 0 at center, +1 at right edge
    const scoop = normX * normX; // Parabolic U-profile: 0 at center, 1 at edges
    const baseYRatio = 0.76 - 0.16 * scoop + (planeOffsetRatio || 0);
    return H * baseYRatio;
}

// 3-Plane Gothic Graveyard Silhouette & Scooped U-Profile Horizon Engine (VIS-02, D-01..D-08)
function renderStartGraveyard(W, H, u, safeW, safeH, plane) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    const targetPlane = (typeof plane === 'number') ? plane : 0;
    overlayContext.save();

    const step = Math.max(2, Math.round(u / 8));
    const slices = 48;
    const sliceW = Math.ceil(W / slices) + 1;

    // Helper: draw scooped U-profile ground mass and lunar rim highlight for a given plane
    const drawScoopedGround = (planeOffset, fillHex, rimHex) => {
        overlayContext.fillStyle = fillHex;
        overlayContext.beginPath();
        overlayContext.moveTo(0, H);
        for (let i = 0; i <= slices; i++) {
            const sx = (i / slices) * W;
            const sy = Math.round(getStartHorizonY(sx, W, H, planeOffset) / step) * step;
            overlayContext.lineTo(sx, sy);
        }
        overlayContext.lineTo(W, H);
        overlayContext.closePath();
        overlayContext.fill();

        // 1px stepped lunar rim highlight facing upper-right moon (D-03)
        overlayContext.fillStyle = rimHex;
        for (let i = 0; i < slices; i++) {
            const sx = Math.floor((i / slices) * W);
            const sy = Math.round(getStartHorizonY(sx, W, H, planeOffset) / step) * step;
            overlayContext.fillRect(sx, sy, sliceW, Math.max(1, (step * 0.5) | 0));
        }
    };

    // PLANE 1: Distant Cathedral Spires, Pointed Roofs & Mausoleums with Lancet Windows (D-01, D-07)
    if (targetPlane === 0 || targetPlane === 1) {
        const p1Offset = -0.035;
        drawScoopedGround(p1Offset, '#12091A', '#3A1230');

        for (let i = 0; i < START_GRAVEYARD_PLANE1.length; i++) {
            const item = START_GRAVEYARD_PLANE1[i];
            const mx = item[0] * W;
            const mw = item[1] * u;
            const mh = item[2] * u;
            const mType = item[3];
            const hasWindow = item[4];
            const baseY = getStartHorizonY(mx, W, H, p1Offset) + u * 0.4;

            overlayContext.fillStyle = '#12091A';
            if (mType === 0) {
                // Gothic Cathedral Spire (tower body + steep pointed steeple + finial cross)
                const towerH = mh * 0.48;
                const spireH = mh * 0.52;
                overlayContext.fillRect(mx - mw * 0.5, baseY - towerH, mw, towerH);
                overlayContext.beginPath();
                overlayContext.moveTo(mx - mw * 0.58, baseY - towerH);
                overlayContext.lineTo(mx, baseY - mh);
                overlayContext.lineTo(mx + mw * 0.58, baseY - towerH);
                overlayContext.closePath();
                overlayContext.fill();

                // Right-edge 1px lunar rim highlight (#3A1230)
                overlayContext.strokeStyle = '#3A1230';
                overlayContext.lineWidth = 1.2;
                overlayContext.beginPath();
                overlayContext.moveTo(mx, baseY - mh);
                overlayContext.lineTo(mx + mw * 0.58, baseY - towerH);
                overlayContext.lineTo(mx + mw * 0.5, baseY - towerH);
                overlayContext.lineTo(mx + mw * 0.5, baseY);
                overlayContext.stroke();

                // Finial spire cross
                const finH = u * 0.7;
                overlayContext.fillStyle = '#3A1230';
                overlayContext.fillRect(mx - 1, baseY - mh - finH, 2, finH);
                overlayContext.fillRect(mx - u * 0.25, baseY - mh - finH * 0.65, u * 0.5, 2);

                // Arched Lancet Window Pips with Warm Amber/Rose Flicker (D-07)
                if (hasWindow) {
                    const flicker = 0.70 + 0.30 * Math.sin(frame * 0.09 + i * 2.1);
                    const winW = Math.max(2, Math.round(u * 0.16));
                    const winH = Math.max(4, Math.round(u * 0.36));
                    const winY = baseY - towerH * 0.68;
                    overlayContext.fillStyle = `rgba(255, 170, 50, ${(0.45 * flicker).toFixed(3)})`;
                    overlayContext.fillRect(mx - winW - 1, winY, winW, winH);
                    overlayContext.fillRect(mx + 2, winY, winW, winH);
                }
            } else if (mType === 1) {
                // Pointed Nave Roof
                const wallH = mh * 0.55;
                overlayContext.fillRect(mx - mw * 0.5, baseY - wallH, mw, wallH);
                overlayContext.beginPath();
                overlayContext.moveTo(mx - mw * 0.55, baseY - wallH);
                overlayContext.lineTo(mx, baseY - mh);
                overlayContext.lineTo(mx + mw * 0.55, baseY - wallH);
                overlayContext.closePath();
                overlayContext.fill();

                overlayContext.strokeStyle = '#3A1230';
                overlayContext.lineWidth = 1.0;
                overlayContext.beginPath();
                overlayContext.moveTo(mx, baseY - mh);
                overlayContext.lineTo(mx + mw * 0.55, baseY - wallH);
                overlayContext.stroke();
            } else {
                // Imposing Stone Mausoleum with stepped pediment
                overlayContext.fillRect(mx - mw * 0.5, baseY - mh * 0.75, mw, mh * 0.75);
                overlayContext.fillRect(mx - mw * 0.38, baseY - mh * 0.92, mw * 0.76, mh * 0.17);
                overlayContext.fillStyle = '#3A1230';
                overlayContext.fillRect(mx + mw * 0.5 - 1.5, baseY - mh * 0.75, 1.5, mh * 0.75);
            }
        }
    }

    // PLANE 2: Midground Twisted Dead Oaks, Stone Vaults & Crooked Crosses (D-01, D-05, D-06)
    if (targetPlane === 0 || targetPlane === 2) {
        const p2Offset = -0.015;
        drawScoopedGround(p2Offset, '#100718', '#4A1536');

        for (let i = 0; i < START_GRAVEYARD_PLANE2.length; i++) {
            const item = START_GRAVEYARD_PLANE2[i];
            const mx = item[0] * W;
            const mw = item[1] * u;
            const mh = item[2] * u;
            const mType = item[3];
            const tilt = item[4];
            const baseY = getStartHorizonY(mx, W, H, p2Offset) + u * 0.25;

            if (mType === 0) {
                // Gnarled Dead Oak Tree with skeletal diagonal branch fingers (D-06)
                const dir = tilt < 0 ? 1 : -1; // Reach inward toward center/moon
                overlayContext.save();
                overlayContext.fillStyle = '#12091A';
                overlayContext.strokeStyle = '#12091A';
                overlayContext.lineCap = 'butt';

                // Gnarled trunk
                overlayContext.beginPath();
                overlayContext.moveTo(mx - mw * 0.55, baseY);
                overlayContext.lineTo(mx - mw * 0.25 + dir * u * 0.3, baseY - mh * 0.55);
                overlayContext.lineTo(mx + dir * u * 0.7, baseY - mh);
                overlayContext.lineTo(mx + mw * 0.22 + dir * u * 0.5, baseY - mh * 0.55);
                overlayContext.lineTo(mx + mw * 0.55, baseY);
                overlayContext.closePath();
                overlayContext.fill();

                // Skeletal diagonal branch fingers
                const branches = [
                    [0.45, dir * 2.2, -0.35, 0.22],
                    [0.65, dir * 2.8, -0.42, 0.18],
                    [0.78, -dir * 1.6, -0.28, 0.16],
                    [0.88, dir * 1.9, -0.30, 0.14]
                ];
                for (let b = 0; b < branches.length; b++) {
                    const br = branches[b];
                    const bx0 = mx + dir * u * 0.3 * br[0];
                    const by0 = baseY - mh * br[0];
                    const bx1 = bx0 + br[1] * u;
                    const by1 = by0 + br[2] * mh;
                    overlayContext.lineWidth = Math.max(2, br[3] * u);
                    overlayContext.beginPath();
                    overlayContext.moveTo(bx0, by0);
                    overlayContext.lineTo(bx1, by1);
                    overlayContext.stroke();

                    // Sub-twig fingers
                    overlayContext.lineWidth = Math.max(1.5, br[3] * u * 0.55);
                    overlayContext.beginPath();
                    overlayContext.moveTo((bx0 + bx1) * 0.5, (by0 + by1) * 0.5);
                    overlayContext.lineTo(bx1 + dir * u * 0.5, by1 - u * 0.6);
                    overlayContext.stroke();
                }

                // Lunar rim highlight on upper-right edges (#4A1536)
                overlayContext.strokeStyle = '#4A1536';
                overlayContext.lineWidth = 1.2;
                overlayContext.beginPath();
                overlayContext.moveTo(mx + mw * 0.45, baseY);
                overlayContext.lineTo(mx + mw * 0.22 + dir * u * 0.5, baseY - mh * 0.55);
                overlayContext.lineTo(mx + dir * u * 0.7, baseY - mh);
                overlayContext.stroke();
                overlayContext.restore();
            } else if (mType === 1) {
                // Weathered Stone Vault
                overlayContext.fillStyle = '#12091A';
                overlayContext.fillRect(mx - mw * 0.5, baseY - mh * 0.8, mw, mh * 0.8);
                overlayContext.beginPath();
                overlayContext.arc(mx, baseY - mh * 0.8, mw * 0.5, Math.PI, 0);
                overlayContext.fill();
                overlayContext.strokeStyle = '#4A1536';
                overlayContext.lineWidth = 1.2;
                overlayContext.beginPath();
                overlayContext.arc(mx, baseY - mh * 0.8, mw * 0.5, Math.PI * 1.45, 0);
                overlayContext.lineTo(mx + mw * 0.5, baseY);
                overlayContext.stroke();
            } else {
                // Crooked Latin (2) or Celtic (3) Cross (D-05)
                overlayContext.save();
                overlayContext.translate(mx, baseY);
                overlayContext.rotate(tilt);
                overlayContext.fillStyle = '#12091A';
                const stemW = Math.max(3, mw * 0.28);
                const crossBarY = -mh * 0.72;
                overlayContext.fillRect(-stemW / 2, -mh, stemW, mh);
                overlayContext.fillRect(-mw * 0.55, crossBarY - stemW * 0.45, mw * 1.1, stemW * 0.9);
                if (mType === 3) {
                    // Celtic ring
                    overlayContext.strokeStyle = '#12091A';
                    overlayContext.lineWidth = Math.max(2, stemW * 0.65);
                    overlayContext.beginPath();
                    overlayContext.arc(0, crossBarY, mw * 0.34, 0, Math.PI * 2);
                    overlayContext.stroke();
                }
                // Lunar rim highlight
                overlayContext.fillStyle = '#4A1536';
                overlayContext.fillRect(stemW / 2 - 1, -mh, 1.2, mh);
                overlayContext.fillRect(-mw * 0.55, crossBarY - stemW * 0.45, mw * 1.1, 1.2);
                overlayContext.restore();
            }
        }
    }

    // PLANE 3: Foreground Tombstones, Obelisks, Burial Slabs & Wrought-Iron Spear Railings (D-01, D-05, D-08)
    if (targetPlane === 0 || targetPlane === 3) {
        const p3Offset = 0.0;
        drawScoopedGround(p3Offset, '#12091A', '#5A183C');

        // 1. Wrought-Iron Spear-Picket Fence Segments & Stepped Pixel Grass Tufts (D-08)
        const fenceClusters = [
            [0.09, 0.26],
            [0.30, 0.42],
            [0.58, 0.70],
            [0.74, 0.91]
        ];
        const picketSpacing = Math.max(5, Math.round(u * 0.42));
        const picketH = u * 1.35;

        for (let c = 0; c < fenceClusters.length; c++) {
            const xStart = Math.floor(fenceClusters[c][0] * W);
            const xEnd = Math.floor(fenceClusters[c][1] * W);

            // Horizontal wrought-iron rails
            overlayContext.strokeStyle = '#2D1E3A';
            overlayContext.lineWidth = Math.max(1.2, u * 0.08);
            overlayContext.beginPath();
            const yStart = getStartHorizonY(xStart, W, H, p3Offset);
            const yEnd = getStartHorizonY(xEnd, W, H, p3Offset);
            overlayContext.moveTo(xStart, yStart - picketH * 0.75);
            overlayContext.lineTo(xEnd, yEnd - picketH * 0.75);
            overlayContext.moveTo(xStart, yStart - picketH * 0.28);
            overlayContext.lineTo(xEnd, yEnd - picketH * 0.28);
            overlayContext.stroke();

            // Spear pickets + stepped grass tufts at base
            let pIdx = 0;
            for (let px = xStart; px <= xEnd; px += picketSpacing) {
                const py = getStartHorizonY(px, W, H, p3Offset);
                const bend = ((pIdx % 5 === 2) ? 0.09 : (pIdx % 7 === 4 ? -0.08 : 0));
                const topX = px + bend * picketH;
                const topY = py - picketH;

                overlayContext.strokeStyle = (pIdx % 3 === 0) ? '#5A183C' : '#2D1E3A';
                overlayContext.lineWidth = Math.max(1.2, u * 0.09);
                overlayContext.beginPath();
                overlayContext.moveTo(px, py + 2);
                overlayContext.lineTo(topX, topY);
                overlayContext.stroke();

                // Spearhead finial tip
                overlayContext.fillStyle = '#5A183C';
                overlayContext.beginPath();
                overlayContext.moveTo(topX, topY - u * 0.22);
                overlayContext.lineTo(topX - u * 0.11, topY + u * 0.06);
                overlayContext.lineTo(topX + u * 0.11, topY + u * 0.06);
                overlayContext.closePath();
                overlayContext.fill();

                // Stepped pixel grass tufts at horizon base (D-08)
                overlayContext.fillStyle = '#12091A';
                overlayContext.fillRect(px - 2, py - step, step, step);
                if (pIdx % 2 === 0) {
                    overlayContext.fillStyle = '#3A1230';
                    overlayContext.fillRect(px + 1, py - step * 1.5, step, step);
                }
                pIdx++;
            }
        }

        // 2. 4 Iconic 16-Bit Marker Primitives (Headstones, Crooked Crosses, Obelisks, Burial Slabs, D-05)
        for (let i = 0; i < START_GRAVEYARD_PLANE3.length; i++) {
            const item = START_GRAVEYARD_PLANE3[i];
            const mx = item[0] * W;
            const mw = item[1] * u;
            const mh = item[2] * u;
            const mType = item[3];
            const tilt = item[4];
            const baseY = getStartHorizonY(mx, W, H, p3Offset) + u * 0.15;

            overlayContext.save();
            overlayContext.translate(mx, baseY);
            if (tilt) overlayContext.rotate(tilt);

            if (mType === 0) {
                // Leaning Round-Top Headstone
                const straightH = mh * 0.68;
                const archR = mw * 0.5;
                overlayContext.fillStyle = '#12091A';
                overlayContext.fillRect(-archR, -straightH, mw, straightH);
                overlayContext.beginPath();
                overlayContext.arc(0, -straightH, archR, Math.PI, 0);
                overlayContext.fill();

                // 1px lunar rim highlight (#5A183C)
                overlayContext.strokeStyle = '#5A183C';
                overlayContext.lineWidth = 1.4;
                overlayContext.beginPath();
                overlayContext.arc(0, -straightH, archR, Math.PI * 1.35, 0);
                overlayContext.lineTo(archR, 0);
                overlayContext.stroke();

                // Engraved RIP notch pixels
                overlayContext.fillStyle = '#3A1230';
                overlayContext.fillRect(-mw * 0.25, -straightH * 0.72, mw * 0.5, Math.max(1.5, step * 0.6));
            } else if (mType === 1) {
                // Foreground Crooked Cross
                const stemW = Math.max(3, mw * 0.30);
                const barY = -mh * 0.70;
                overlayContext.fillStyle = '#12091A';
                overlayContext.fillRect(-stemW / 2, -mh, stemW, mh);
                overlayContext.fillRect(-mw * 0.55, barY - stemW * 0.45, mw * 1.1, stemW * 0.9);
                overlayContext.fillStyle = '#5A183C';
                overlayContext.fillRect(stemW / 2 - 1.2, -mh, 1.4, mh);
                overlayContext.fillRect(-mw * 0.55, barY - stemW * 0.45, mw * 1.1, 1.4);
            } else if (mType === 2) {
                // Cracked Pointed Obelisk
                const shaftH = mh * 0.78;
                overlayContext.fillStyle = '#12091A';
                overlayContext.beginPath();
                overlayContext.moveTo(-mw * 0.55, 0);
                overlayContext.lineTo(-mw * 0.35, -shaftH);
                overlayContext.lineTo(0, -mh);
                overlayContext.lineTo(mw * 0.35, -shaftH);
                overlayContext.lineTo(mw * 0.55, 0);
                overlayContext.closePath();
                overlayContext.fill();

                // Crack notch & right lunar rim highlight (#5A183C)
                overlayContext.strokeStyle = '#5A183C';
                overlayContext.lineWidth = 1.4;
                overlayContext.beginPath();
                overlayContext.moveTo(0, -mh);
                overlayContext.lineTo(mw * 0.35, -shaftH);
                overlayContext.lineTo(mw * 0.55, 0);
                overlayContext.stroke();
            } else {
                // Flat Mossy Burial Slab
                overlayContext.fillStyle = '#12091A';
                overlayContext.fillRect(-mw * 0.5, -mh, mw, mh);
                overlayContext.fillStyle = '#5A183C';
                overlayContext.fillRect(-mw * 0.5, -mh, mw, 1.5);
                overlayContext.fillRect(mw * 0.5 - 1.5, -mh, 1.5, mh);
            }
            overlayContext.restore();
        }
    }

    overlayContext.restore();
}

// 3-Layer Parallax Pixel Fog Config Table (VIS-04, D-13..D-16)
const START_FOG_LAYERS = [
    { speed: 0.25, color: 'rgba(32, 22, 50, 0.18)', baseOffset: 0.035, freq1: 0.0045, freq2: 0.0110, phase: 0.0, bandH: 3.4 },
    { speed: 0.60, color: 'rgba(45, 30, 68, 0.26)', baseOffset: 0.055, freq1: 0.0062, freq2: 0.0145, phase: 2.1, bandH: 2.9 },
    { speed: 1.05, color: 'rgba(62, 42, 90, 0.35)', baseOffset: 0.080, freq1: 0.0080, freq2: 0.0185, phase: 4.3, bandH: 2.4 }
];

// Evaluate Parallax Fog Wave Crest Y (Strictly Constrained Below CTA Cartouche Baseline, D-14)
function getStartFogCrestY(x, W, H, u, layerIdx) {
    const cfg = START_FOG_LAYERS[layerIdx] || START_FOG_LAYERS[0];
    const amp = Math.max(3, Math.round(u * 0.18));
    const vStep = 4; // Quantized 3-4px vertical pixel step (D-16)
    const driftX = x - frame * cfg.speed;
    const wave = Math.sin(driftX * cfg.freq1 + cfg.phase) * 0.65 + Math.cos(driftX * cfg.freq2 - cfg.phase) * 0.35;

    const ctaH = u * 2.3;
    const ctaBottom = H * 0.74 + ctaH / 2;
    const minCrestY = ctaBottom + Math.max(4, stepFloor(u * 0.20));
    const rawY = H * (0.76 + cfg.baseOffset) + wave * amp;
    const quantizedY = Math.round(rawY / vStep) * vStep;
    return Math.max(minCrestY, quantizedY);
}

function stepFloor(v) {
    return Math.floor(v);
}

// 3-Layer Parallax Drifting Pixel Fog Engine (VIS-04, D-13..D-16, D-20)
function renderStartParallaxFog(W, H, u, layer) {
    if (typeof overlayContext === 'undefined' || !overlayContext) return;
    const targetLayer = (typeof layer === 'number') ? layer : 0;
    overlayContext.save();

    const hStep = Math.max(8, Math.round(u * 0.5));
    const ditherBlock = Math.max(3, Math.round(u * 0.2));
    const vStep = 4; // Quantized 4px vertical step

    const renderSingleFogLayer = (layerIdx) => {
        const cfg = START_FOG_LAYERS[layerIdx];
        if (!cfg) return;
        const ribbonDepth = Math.round((cfg.bandH * u) / vStep) * vStep;
        overlayContext.fillStyle = cfg.color;

        const driftCols = Math.floor((frame * cfg.speed) / ditherBlock);
        let colIdx = 0;
        for (let x = 0; x < W; x += hStep) {
            const colW = Math.min(hStep, W - x);
            const crestY = getStartFogCrestY(x, W, H, u, layerIdx);
            const bodyY = crestY + vStep;
            const bodyH = Math.min(H - bodyY, ribbonDepth);

            if (bodyH > 0) {
                overlayContext.fillRect(x, bodyY, colW, bodyH);
            }

            // Alternating 1-in-2 Bayer dithered pixels along upper crest edge row (D-16)
            for (let dx = x; dx < x + colW; dx += ditherBlock) {
                const subCol = ((dx / ditherBlock) | 0) - driftCols;
                if ((subCol & 1) === 0) {
                    overlayContext.fillRect(dx, crestY, Math.min(ditherBlock, x + colW - dx), vStep);
                }
            }
            colIdx++;
        }
    };

    if (targetLayer >= 1 && targetLayer <= 3) {
        renderSingleFogLayer(targetLayer - 1);
    } else {
        renderSingleFogLayer(0);
        renderSingleFogLayer(1);
        renderSingleFogLayer(2);
    }

    overlayContext.restore();
}

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
    const sheenWindow = (g_startHoverCTA || g_startHoverGuide) ? 35 : 60;
    if (cycle < sheenWindow) {
        const sweepProgress = cycle / sheenWindow; // 0 to 1
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

    // 16-Bit Retro Arcade Record Plaque (D-18)
    const plaqueY = (typeof g_score !== 'undefined' && g_score > 0) ? H * 0.49 : H * 0.53;
    const plaqueW = Math.min(safeW * 0.72, u * 22);
    const plaqueH = u * 1.5;

    overlayContext.save();
    overlayContext.fillStyle = 'rgba(18, 14, 24, 0.90)';
    overlayContext.fillRect(cx - plaqueW / 2, plaqueY - plaqueH / 2, plaqueW, plaqueH);
    overlayContext.strokeStyle = '#792138';
    overlayContext.lineWidth = 1.4;
    overlayContext.strokeRect(cx - plaqueW / 2, plaqueY - plaqueH / 2, plaqueW, plaqueH);

    // Corner rivets in gold
    overlayContext.fillStyle = '#D4AF37';
    overlayContext.fillRect(cx - plaqueW / 2 + 3, plaqueY - plaqueH / 2 + 3, 3, 3);
    overlayContext.fillRect(cx + plaqueW / 2 - 6, plaqueY - plaqueH / 2 + 3, 3, 3);
    overlayContext.fillRect(cx - plaqueW / 2 + 3, plaqueY + plaqueH / 2 - 6, 3, 3);
    overlayContext.fillRect(cx + plaqueW / 2 - 6, plaqueY + plaqueH / 2 - 6, 3, 3);

    let bestWave = typeof getNightmareBestWave === "function" ? getNightmareBestWave() : parseInt(safeGetPref('da_nightmare_best_wave', '0'), 10) || 0;
    let bestTime = typeof getNightmareBestTime === "function" ? getNightmareBestTime() : parseInt(safeGetPref('da_nightmare_best_time', '0'), 10) || 0;
    let plaqueStr = "";
    if (bestWave > 0) {
        let mins = Math.floor(bestTime / 60);
        let secs = bestTime % 60;
        let timeStr = (mins < 10 ? "0" + mins : "" + mins) + ":" + (secs < 10 ? "0" + secs : "" + secs);
        plaqueStr = "BEST SURVIVAL: WAVE " + bestWave + " - " + timeStr;
    } else {
        plaqueStr = "BEST SURVIVAL: WAVE -- - --:--";
    }

    drawTextWithOutline(plaqueStr, vec2(cx, plaqueY), Math.max(11, u * 0.58), colorSpark);
    overlayContext.restore();

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

    // Glowing neon border alternating between Gold and Crimson (hover glow surge 0.45 -> 0.85, D-26)
    const borderMix = 0.5 + 0.5 * Math.sin(frame * 0.12);
    const neonColor = borderMix > 0.5 ? '#FBF236' : '#AC3232';
    const ctaGlowAlpha = g_startHoverCTA ? 0.85 : 0.45;
    overlayContext.strokeStyle = neonColor;
    overlayContext.lineWidth = 2.4;
    overlayContext.shadowColor = borderMix > 0.5
        ? `rgba(251, 242, 54, ${ctaGlowAlpha})`
        : `rgba(172, 50, 50, ${ctaGlowAlpha})`;
    overlayContext.shadowBlur = g_startHoverCTA ? 16 : 10;
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

    // 3. Symmetrical Dual Buttons: "[H] HOW TO PLAY & GUIDE" and "[C] CREDITS" at H * 0.83 (D-01, D-05)
    const rowY = H * 0.83;
    const btnW = Math.min(safeW * 0.38, u * 11);
    const btnH = Math.min(u * 1.6, H * 0.044);
    const gap = Math.max(8, u * 0.8);
    const guideX = cx - btnW / 2 - gap / 2;
    const creditsX = cx + btnW / 2 + gap / 2;

    // Left Button: [H] HOW TO PLAY & GUIDE
    const guideGlowAlpha = g_startHoverGuide ? 0.85 : 0.45;
    overlayContext.save();
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.88)';
    overlayContext.fillRect(guideX - btnW / 2, rowY - btnH / 2, btnW, btnH);
    overlayContext.strokeStyle = '#FBF236';
    overlayContext.lineWidth = 1.4;
    overlayContext.shadowColor = `rgba(251, 242, 54, ${guideGlowAlpha})`;
    overlayContext.shadowBlur = g_startHoverGuide ? 12 : 4;
    overlayContext.strokeRect(guideX - btnW / 2, rowY - btnH / 2, btnW, btnH);
    overlayContext.shadowBlur = 0;
    overlayContext.restore();

    drawTextWithOutline("[H] HOW TO PLAY & GUIDE", vec2(guideX, rowY), Math.max(11, u * 0.58), colorSpark);

    // Right Button: [C] CREDITS
    const creditsGlowAlpha = g_startHoverCredits ? 0.85 : 0.45;
    overlayContext.save();
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.88)';
    overlayContext.fillRect(creditsX - btnW / 2, rowY - btnH / 2, btnW, btnH);
    overlayContext.strokeStyle = '#D4AF37';
    overlayContext.lineWidth = 1.4;
    overlayContext.shadowColor = `rgba(212, 175, 55, ${creditsGlowAlpha})`;
    overlayContext.shadowBlur = g_startHoverCredits ? 12 : 4;
    overlayContext.strokeRect(creditsX - btnW / 2, rowY - btnH / 2, btnW, btnH);
    overlayContext.shadowBlur = 0;
    overlayContext.restore();

    drawTextWithOutline("[C] CREDITS", vec2(creditsX, rowY), Math.max(11, u * 0.58), colorSpark);

    // 3b. Application Exit Button: "[ EXIT GAME ]" (D-25, D-26)
    const exitY = H * 0.88;
    const exitW = Math.min(safeW * 0.42, u * 12);
    const exitH = Math.min(u * 1.4, H * 0.042);
    const exitGlowAlpha = g_startHoverExit ? 0.85 : 0.45;

    overlayContext.save();
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.88)';
    overlayContext.fillRect(cx - exitW / 2, exitY - exitH / 2, exitW, exitH);
    overlayContext.strokeStyle = '#AC3232';
    overlayContext.lineWidth = 1.2;
    overlayContext.shadowColor = `rgba(172, 50, 50, ${exitGlowAlpha})`;
    overlayContext.shadowBlur = g_startHoverExit ? 12 : 4;
    overlayContext.strokeRect(cx - exitW / 2, exitY - exitH / 2, exitW, exitH);
    overlayContext.shadowBlur = 0;
    overlayContext.restore();

    drawTextWithOutline("[ EXIT GAME ]", vec2(cx, exitY), Math.max(10, u * 0.54), g_startHoverExit ? colorSpark : colorBlood);

    // 4. OS-aware Streamer Dashboard Shortcut Bracket (D-08)
    const isMac = typeof navigator !== 'undefined' && (/Mac|iPhone|iPod|iPad/i.test(navigator.platform || '') || /Macintosh|Mac OS X/i.test(navigator.userAgent || ''));
    const keyHint = isMac ? "⌘+D" : "Ctrl+D";
    const dashText = `Press ${keyHint} to Open Streamer Dashboard`;
    const dashY = H * 0.93;
    drawTextWithOutline(dashText, vec2(cx, dashY), Math.max(11, u * 0.55), new Color(0.78, 0.65, 1.0, 0.95), colorBlack);

    overlayContext.restore();
}

// Universal Multi-Line Canvas 2D Word-Wrapping Engine (CLIP-06, D-05)
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxHeight) {
    if (!ctx || text == null || text === '') {
        return { linesRendered: 0, nextY: y, heightUsed: 0 };
    }

    const fontStr = String(ctx.font || '');
    const fontMatch = fontStr.match(/([\d.]+)px/);
    const fontSize = fontMatch ? parseFloat(fontMatch[1]) : 14;
    const safeMaxW = Math.max(1, maxWidth || 100);

    const measureCandidate = (str) => {
        const ctxW = ctx.measureText ? ctx.measureText(str).width : 0;
        return Math.max(ctxW, str.length * fontSize * 0.56);
    };

    const buildWrappedLines = () => {
        const paragraphs = String(text).split('\n');
        const lines = [];
        for (let p = 0; p < paragraphs.length; p++) {
            const para = paragraphs[p];
            if (para.trim() === '') {
                lines.push('');
                continue;
            }
            const words = para.trim().split(/\s+/);
            let currentLine = '';
            for (let w = 0; w < words.length; w++) {
                const word = words[w];
                const testLine = currentLine ? (currentLine + ' ' + word) : word;
                const testW = measureCandidate(testLine);
                if (testW <= safeMaxW || currentLine === '') {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine !== '') {
                lines.push(currentLine);
            }
        }
        return lines;
    };

    let wrappedLines = buildWrappedLines();

    if (maxHeight && maxHeight > 0 && wrappedLines.length * lineHeight > maxHeight) {
        const scale = maxHeight / (wrappedLines.length * lineHeight);
        if (scale >= 0.8) {
            const scaledFontSize = Math.max(8, Math.floor(fontSize * scale));
            const scaledLineHeight = Math.max(8, Math.floor(lineHeight * scale));
            if (scaledFontSize < fontSize && scaledLineHeight < lineHeight && fontMatch) {
                const prevFont = ctx.font;
                ctx.font = fontStr.replace(/([\d.]+)px/, scaledFontSize + 'px');
                const res = drawWrappedText(ctx, text, x, y, maxWidth, scaledLineHeight, 0);
                ctx.font = prevFont;
                if (res.heightUsed <= maxHeight) {
                    return res;
                }
            }
        }
        const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
        if (wrappedLines.length > maxLines) {
            wrappedLines = wrappedLines.slice(0, maxLines);
            wrappedLines[maxLines - 1] = wrappedLines[maxLines - 1].replace(/[.\s]+$/, '') + '...';
        }
    }

    const prevBaseline = ctx.textBaseline;
    ctx.textBaseline = 'top';
    for (let i = 0; i < wrappedLines.length; i++) {
        ctx.fillText(wrappedLines[i], x, y + i * lineHeight);
    }
    ctx.textBaseline = prevBaseline;

    const heightUsed = wrappedLines.length * lineHeight;
    return {
        linesRendered: wrappedLines.length,
        nextY: y + heightUsed,
        heightUsed: heightUsed
    };
}

// Tab 1: Weapon Stat Cards & Health Telemetry (CLIP-06, HELP-01, D-03, D-04)
function renderHelpTabWeapons(x, y, w, h, u) {
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'alphabetic';

    const cardW = (w - u * 0.8) / 2;
    const cardH = (h - u * 2.8) / 2;

    const weapons = [
        {
            name: "SERVICE PISTOL",
            tile: tileNumbers_pistol,
            statLine: "MAG: 6-Shot Cylinder | CAP: 36 Bullets | RELOAD: 0.18s/rd",
            desc: "Reliable starting sidearm (0.4 velocity, 28f range). Snappy per-bullet cylinder reload (1.08s full) and pinpoint semi-auto reset for kiting early Walker waves."
        },
        {
            name: "MACHINE PISTOL (SMG)",
            tile: tileNumbers_smg,
            statLine: "MAG: 20 Rounds (2x10 Grid) | CAP: 36 Bullets | RATE: 80ms",
            desc: "Fast 0.02s/rd reload (0.40s full). Shots 1–3 hold laser precision (≤0.02 rad) with 160ms tap reset; continuous hold (shots 4–20) expands bloom to ±0.48 rad (27.5°) with ±8% velocity jitter."
        },
        {
            name: "COMBAT SHOTGUN",
            tile: tileNumbers_shotgun,
            statLine: "MAG: 2 Shells (Break-Action) | CAP: 8 Shells | RELOAD: 0.60s/sh",
            desc: "Fires 4 heavy pellets across a 30° (π/6) spread cone (0.3 velocity, 22f range). High close-quarters stopping power; scarcity-gated in Levels 1–2 (0% upgrade roll; 10% roll in L3+)."
        },
        {
            name: "HUNTING RIFLE",
            tile: tileNumbers_rifle,
            statLine: "MAG: 1 Round (Bolt-Action) | CAP: 8 Rounds | RELOAD: 2.0s",
            desc: "High-velocity (0.5 speed, 40f range) armor-piercing slug (12 penetration) that punches through entire mob lines and deals heavy stagger to Bosses."
        }
    ];

    for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = x + col * (cardW + u * 0.8);
        const cy = y + row * (cardH + u * 0.4);
        const wep = weapons[i];

        overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
        overlayContext.fillRect(cx, cy, cardW, cardH);
        overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.35)';
        overlayContext.strokeRect(cx, cy, cardW, cardH);

        // Weapon Tile
        overlayContext.save();
        drawOverlayTile(wep.tile, cx + u * 1.5, cy + cardH * 0.35, u * 2.6, 0, false, 1.0);
        overlayContext.restore();

        // Weapon Title & Details
        overlayContext.font = `bold ${Math.max(11, u * 0.58)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FBF236';
        overlayContext.fillText(wep.name, cx + u * 3.3, cy + u * 0.75);

        // Stat Line
        overlayContext.font = `bold ${Math.max(8.5, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#D4AF37';
        overlayContext.fillText(wep.statLine, cx + u * 3.3, cy + u * 1.45);

        // Description
        overlayContext.font = `${Math.max(8.5, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        drawWrappedText(overlayContext, wep.desc, cx + u * 0.7, cy + u * 2.05, cardW - u * 1.4, Math.max(9.5, u * 0.44), cardH - u * 2.3);
    }

    // Health, Supply & Stage Carryover Footer Strip
    const footY = y + cardH * 2 + u * 0.6;
    const footH = h - (footY - y);
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, footY, w, footH);
    overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.30)';
    overlayContext.strokeRect(x, footY, w, footH);

    overlayContext.font = `bold ${Math.max(9.5, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FF4D4D';
    overlayContext.fillText("HEALTH, SUPPLY & LEVEL CARRYOVER", x + u * 0.6, footY + u * 0.55);

    overlayContext.font = `${Math.max(8.5, u * 0.40)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    drawWrappedText(overlayContext, "3 Base Hearts + 1 Golden Shield Pip (!repair, 4 HP cap). 0.75s (45f) post-hit grace with radial knockback pusher; 1 HP triggers heartbeat alarm. Map Supply Crates yield +8B / +3S / +2R. Floor weapon swap refunds chamber ammo. Next stage starting reserves clamp to 18 Bullets / 4 Shells / 3 Rifle.", x + u * 0.6, footY + u * 0.95, w - u * 1.2, Math.max(9.5, u * 0.42), footH - u * 0.9);
}

// Tab 2: Bestiary Dossiers, Boss Siege Intel & Horde Strip (CLIP-06, HELP-02, D-05, D-06)
function renderHelpTabTwitch(x, y, w, h, u) {
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'alphabetic';

    const cardW = (w - u * 0.8) / 2;
    const cardH = (h - u * 2.8) / 2;

    const mobs = [
        {
            name: "WALKER ZOMBIE",
            pill: "SWARM MELEE",
            pillColor: "#FF4D4D",
            borderColor: "#3B5323",
            face: tileNumbers_faceZombie,
            telemetry: "HP: 2 | SPEED: 0.06 (Normal) | DROP: 5% Scavenged (+2B/+1S/+1R)",
            desc: "Rises from graves (4.0s) or !mob portals (1.2s telegraph). Swarms in packs and bashes closed doors after 3.0s (180f). Kite along corridors with Pistol or 3-round SMG tap-bursts."
        },
        {
            name: "AERIAL VAMPIRE / BAT",
            pill: "DIVE FLANKER",
            pillColor: "#FF4D4D",
            borderColor: "#8B0000",
            face: tileNumbers_faceVampire,
            telemetry: "HP: 1 (Bat) → 6+ (Vampire) | SPEED: 0.20 (Fast) | DROP: 10% Scavenged",
            desc: "Dives at high speed in 1 HP Bat form. On player contact, flashes premonition skull, flees for 2.0s, and transforms into a tanky 6+ HP Vampire. Eliminate in 1 HP Bat form before transformation completes."
        },
        {
            name: "PHASING GHOST",
            pill: "WALL-PHASER",
            pillColor: "#4A6984",
            borderColor: "#4A6984",
            face: tileNumbers_ghost,
            telemetry: "HP: 1 | SPEED: 0.05 (Phasing) | DROP: 12% Scavenged",
            desc: "Cycles between intangible (30% alpha — clips through walls/doors, immune to bullets) and solid (100% alpha — vulnerable) every 0.5–2.0s (30–120f). Hold fire until opaque. Divine Flash forces ghosts solid."
        },
        {
            name: "HEAVY BOSS ZOMBIE",
            pill: "SIEGE BOSS",
            pillColor: "#FF4D4D",
            borderColor: "#D4AF37",
            face: tileNumbers_beefyZombie,
            telemetry: "HP: 22+ (Stage) / 12+4·Lvl (!boss) | MASS: 12 | DROP: Full Care Package",
            desc: "Tears chunks out of interior walls and doors (1.0s windup) to hurl spinning Boulders (0.2 speed) that crush cover. Max 2 active audience bosses. Defeating any Boss guarantees a Full Care Package (+4B / +2S / +1R)."
        }
    ];

    for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = x + col * (cardW + u * 0.8);
        const cy = y + row * (cardH + u * 0.4);
        const mob = mobs[i];

        // Card container
        overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
        overlayContext.fillRect(cx, cy, cardW, cardH);
        overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.35)';
        overlayContext.strokeRect(cx, cy, cardW, cardH);

        // Framed portrait badge
        const badgeSize = u * 2.4;
        const badgeX = cx + u * 0.6;
        const badgeY = cy + u * 0.4;
        overlayContext.fillStyle = 'rgba(10, 14, 20, 0.80)';
        overlayContext.fillRect(badgeX, badgeY, badgeSize, badgeSize);
        overlayContext.strokeStyle = mob.borderColor;
        overlayContext.lineWidth = 1.5;
        overlayContext.strokeRect(badgeX, badgeY, badgeSize, badgeSize);

        // Badge sprite
        overlayContext.save();
        if (mob.face === tileNumbers_ghost) {
            overlayContext.globalAlpha = 0.85;
        }
        drawOverlayTile(mob.face, cx + u * 1.8, cy + u * 1.6, u * 2.2, 0, false, 1.0);
        overlayContext.restore();

        // Title
        overlayContext.font = `bold ${Math.max(10.5, u * 0.54)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FBF236';
        overlayContext.textAlign = 'left';
        overlayContext.fillText(mob.name, cx + u * 3.3, cy + u * 0.75);

        // Threat Pill Box
        const pillW = Math.max(70, u * 3.8);
        const pillH = u * 0.65;
        const pillX = cx + cardW - pillW - u * 0.6;
        const pillY = cy + u * 0.35;
        overlayContext.fillStyle = 'rgba(10, 14, 20, 0.85)';
        overlayContext.fillRect(pillX, pillY, pillW, pillH);
        overlayContext.strokeStyle = mob.pillColor;
        overlayContext.lineWidth = 1.0;
        overlayContext.strokeRect(pillX, pillY, pillW, pillH);

        overlayContext.font = `bold ${Math.max(7.5, u * 0.36)}px ${fontDefault}`;
        overlayContext.fillStyle = mob.pillColor;
        overlayContext.textAlign = 'center';
        overlayContext.fillText(mob.pill, pillX + pillW / 2, pillY + pillH * 0.72);
        overlayContext.textAlign = 'left';

        // Telemetry line
        overlayContext.font = `bold ${Math.max(8.0, u * 0.40)}px ${fontDefault}`;
        overlayContext.fillStyle = '#D4AF37';
        overlayContext.fillText(mob.telemetry, cx + u * 3.3, cy + u * 1.45);

        // Description / behavioral tactics
        overlayContext.font = `${Math.max(8.5, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        drawWrappedText(overlayContext, mob.desc, cx + u * 0.7, cy + u * 2.05, cardW - u * 1.4, Math.max(9.5, u * 0.44), cardH - u * 2.3);
    }

    // Horde Progression & Ammo Despawn Footer Strip
    const footY = y + cardH * 2 + u * 0.6;
    const footH = h - (footY - y);
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, footY, w, footH);
    overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.30)';
    overlayContext.lineWidth = 1.0;
    overlayContext.strokeRect(x, footY, w, footH);

    overlayContext.font = `bold ${Math.max(9.5, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#A78BFA';
    overlayContext.fillText("HORDE PROGRESSION & AMMO DESPAWN INTEL", x + u * 0.6, footY + u * 0.55);

    overlayContext.font = `${Math.max(8.5, u * 0.40)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    drawWrappedText(overlayContext, "Active Mob Concurrency Caps: 15 (L1), 18 (L2), 20 (L3), 23 (L4), 25 (L5). Autonomous Ambient Frenzy triggers every 45–60s (2.0s red telegraph + 6.0s surge at +60% speed). Despawn Lifespans: Scavenged Clips 25s, Care Packages 30s. Both flash rapidly at 7.5Hz during final 5.0s.", x + u * 0.6, footY + u * 0.95, w - u * 1.2, Math.max(9.5, u * 0.42), footH - u * 0.9);
}

// Tab 3: Twitch APG 10-Command Matrix, Clutch Economy & Streamer Setup (CLIP-06, HELP-03, D-07, D-08)
function renderHelpTabStreamer(x, y, w, h, u) {
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'alphabetic';

    const colW = (w - u * 0.8) / 2;
    const cmdBoxH = Math.floor(h * 0.58);

    // 1. Left Column: TEAM GOOD — 5 GUARDIAN COMMANDS
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, y, colW, cmdBoxH);
    overlayContext.strokeStyle = 'rgba(74, 222, 128, 0.40)';
    overlayContext.lineWidth = 1.0;
    overlayContext.strokeRect(x, y, colW, cmdBoxH);

    overlayContext.font = `bold ${Math.max(10, u * 0.52)}px ${fontDefault}`;
    overlayContext.fillStyle = '#4ADE80';
    overlayContext.fillText("TEAM GOOD — 5 GUARDIAN COMMANDS", x + u * 0.6, y + u * 0.55);

    const goodCmds = [
        { name: "!ammo", desc: "Drops primary Care Package (+4B / +2S / +1R, 30s life) + weapon upgrade roll (L3+ 10% Shotgun)." },
        { name: "!barrier", desc: "Raises 6.0s octagonal rune push-barrier repelling nearby mobs." },
        { name: "!repair", desc: "Grants +1 Golden Shield Pip (up to 4 HP), unjams gun & casts 10.0s one-way door wards." },
        { name: "!slow", desc: "Chills all enemies (-50% speed for 8.0s) and cancels active Blood Frenzy." },
        { name: "!light", desc: "Casts 10.0s full-arena illumination + player speed boost and clears Blackout." }
    ];

    const itemH = (cmdBoxH - u * 0.85) / 5;
    for (let i = 0; i < 5; i++) {
        const iy = y + u * 0.85 + i * itemH;
        const cmd = goodCmds[i];

        overlayContext.font = `bold ${Math.max(8.5, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#4ADE80';
        overlayContext.fillText(cmd.name, x + u * 0.6, iy + u * 0.35);

        overlayContext.font = `${Math.max(8.0, u * 0.38)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        drawWrappedText(overlayContext, cmd.desc, x + u * 3.4, iy, colW - u * 4.0, Math.max(8.5, u * 0.38), itemH - u * 0.05);
    }

    // 2. Right Column: TEAM BAD — 5 SABOTEUR COMMANDS
    const rx = x + colW + u * 0.8;
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(rx, y, colW, cmdBoxH);
    overlayContext.strokeStyle = 'rgba(255, 77, 77, 0.40)';
    overlayContext.lineWidth = 1.0;
    overlayContext.strokeRect(rx, y, colW, cmdBoxH);

    overlayContext.font = `bold ${Math.max(10, u * 0.52)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FF4D4D';
    overlayContext.fillText("TEAM BAD — 5 SABOTEUR COMMANDS", rx + u * 0.6, y + u * 0.55);

    const badCmds = [
        { name: "!mob", desc: "Spawns 1 zombie (L1–2) or perimeter pair (L3+) with 1.2s portal telegraph (enrages at cap)." },
        { name: "!boss", desc: "Summons [Boss] @User Elite Mini-Boss (4.0s rate limit, max 2 active or empowers +4 HP at cap)." },
        { name: "!jam", desc: "Mechanically jams active weapon, dumping cylinder into reserve and forcing a 2x slow reload." },
        { name: "!blackout", desc: "Plunges arena into 8.0s pitch darkness (3.2-tile vision radius) and clears Light." },
        { name: "!frenzy", desc: "Unleashes 8.0s Blood Frenzy (+60% mob speed/accel, non-stacking 8.0s cap) and clears Slow." }
    ];

    for (let i = 0; i < 5; i++) {
        const iy = y + u * 0.85 + i * itemH;
        const cmd = badCmds[i];

        overlayContext.font = `bold ${Math.max(8.5, u * 0.42)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FF4D4D';
        overlayContext.fillText(cmd.name, rx + u * 0.6, iy + u * 0.35);

        overlayContext.font = `${Math.max(8.0, u * 0.38)}px ${fontDefault}`;
        overlayContext.fillStyle = '#C8D1DC';
        drawWrappedText(overlayContext, cmd.desc, rx + u * 3.6, iy, colW - u * 4.2, Math.max(8.5, u * 0.38), itemH - u * 0.05);
    }

    // 3. Bottom Section: Clutch Economy & Streamer Setup Cards
    const botW = (w - u * 0.8) / 2;
    const botH = h - cmdBoxH - u * 0.4;
    const botY = y + cmdBoxH + u * 0.4;

    // Bottom-Left Card: Clutch Economy & Divine Flash
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(x, botY, botW, botH);
    overlayContext.strokeStyle = '#FBF236';
    overlayContext.lineWidth = 1.5;
    overlayContext.strokeRect(x, botY, botW, botH);

    overlayContext.font = `bold ${Math.max(9.5, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("CLUTCH ECONOMY & DIVINE FLASH", x + u * 0.6, botY + u * 0.55);

    overlayContext.font = `${Math.max(8.0, u * 0.38)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    drawWrappedText(overlayContext, "CLUTCH AMMO FLOOR: Critical reserves (<3 Bullets, <2 Shells, <2 Rifle) trigger a 100% guaranteed scavenged drop on regular kills (1.0s / 60f multi-kill throttle). Emergency crate spawns after 4.0s (240f) if totally dry (0 chamber + 0 reserve).\nDIVINE FLASH: Casting !repair, !barrier, or !light at 1 HP with mobs within 6 tiles (or Karma ≥85%) triggers a holy shockwave: 2.5s invulnerability, vaporizes point-blank mobs, holy-stuns outer mobs/bosses for 3.0s, and forces ghosts solid (30s cooldown).", x + u * 0.6, botY + u * 0.95, botW - u * 1.2, Math.max(9.0, u * 0.40), botH - u * 1.1);

    // Bottom-Right Card: Viewer Scaling & Streamer Setup
    const botRx = x + botW + u * 0.8;
    overlayContext.fillStyle = 'rgba(22, 27, 34, 0.75)';
    overlayContext.fillRect(botRx, botY, botW, botH);
    overlayContext.strokeStyle = '#9146FF';
    overlayContext.lineWidth = 1.5;
    overlayContext.strokeRect(botRx, botY, botW, botH);

    overlayContext.font = `bold ${Math.max(9.5, u * 0.46)}px ${fontDefault}`;
    overlayContext.fillStyle = '#9146FF';
    overlayContext.fillText("VIEWER SCALING & STREAMER SETUP", botRx + u * 0.6, botY + u * 0.55);

    overlayContext.font = `${Math.max(8.0, u * 0.38)}px ${fontDefault}`;
    overlayContext.fillStyle = '#C8D1DC';
    drawWrappedText(overlayContext, "DYNAMIC VIEWER SCALING: Relay server adjusts charge gauges and cooldowns (4.0s !boss, 8.0s !blackout). Gauges: Solo (≤3) = 1 vote; Classroom (4–30) = 3–8 votes; Chaos (>30) = 5–15 votes.\nSTREAMER DASHBOARD: Press Cmd+D (Mac) or Ctrl+D (Win) / F1 to manage predictions, mock audience swarms, and channel settings.\nOBS CAPTURE: Zero overlays needed. Add Window Capture targeting 'Dead Again - Revamped (Twitch Edition)'.\nCHEAT-SHEET OVERLAY: Press [C] to toggle the in-game command cheat-sheet. Press Shift+C or use Pause Menu to flip docking side (Right / Left).", botRx + u * 0.6, botY + u * 0.95, botW - u * 1.2, Math.max(9.0, u * 0.40), botH - u * 1.1);
}

// Tabbed In-Game Field Manual & Streamer Guide (D-11, D-12, D-17, D-22)
function renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH) {
    if (!g_startHelpOpen) return;
    if (typeof overlayContext === 'undefined' || !overlayContext) return;

    overlayContext.save();

    // 1. Dark Backdrop Dimming
    overlayContext.fillStyle = 'rgba(5, 2, 4, 0.78)';
    overlayContext.fillRect(0, 0, W, H);

    // Snappy 4-frame visual spring scale (0.96 -> 1.00) and alpha (0 -> 1.0) on open (D-22)
    if (g_startModalSpringFrames > 0) {
        const springProgress = Math.max(0.25, (4 - g_startModalSpringFrames + 1) / 4);
        const modalScale = 0.96 + 0.04 * springProgress;
        overlayContext.translate(cx, cy);
        overlayContext.scale(modalScale, modalScale);
        overlayContext.translate(-cx, -cy);
        overlayContext.globalAlpha = springProgress;
    }

    // 2. Terminal Card Container (CLIP-06, D-06: responsive HiDPI scaling)
    const modalW = Math.min(safeW * 0.92, Math.max(1020, u * 38));
    const modalH = Math.min(safeH * 0.86, Math.max(680, u * 25.5));
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
    const closeLabel = (typeof g_state !== 'undefined' && g_state === STATE_PLAYING)
        ? "[ESC / X] RETURN TO GAME"
        : "[ESC / X] RETURN TO START";
    overlayContext.fillText(closeLabel, modalX + modalW - u * 1.0, headerY);

    // 4. Tab Header Navigation Bar
    const tabY = headerY + u * 1.5;
    const tabH = u * 1.6;
    const tabW = (modalW - u * 2.0) / 3;
    const tabTitles = [
        "1. COMBAT & WEAPONS",
        "2. BESTIARY & THREATS",
        "3. TWITCH APG & STREAM"
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

// Field Manual Backward Compatibility Helpers (HELP-01..HELP-03, D-02, D-24)
function renderFieldManualModal(W, H, cx, cy, u, safeW, safeH) {
    renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH);
}

// Dedicated Start Screen Credits Modal honoring creators and technologies with zero legalese (D-01..D-05)
function renderCreditsModal(W, H, cx, cy, u, safeW, safeH) {
    if (typeof overlayContext === 'undefined' || !overlayContext || !g_startCreditsOpen) return;

    overlayContext.save();

    // 1. Semi-transparent dark slate backdrop scrim (D-04)
    overlayContext.fillStyle = 'rgba(5, 2, 4, 0.78)';
    overlayContext.fillRect(0, 0, W, H);

    // 2. Terminal Card Container
    const modalW = Math.min(safeW * 0.88, Math.max(880, u * 30));
    const modalH = Math.min(safeH * 0.82, Math.max(560, u * 20));
    const modalX = cx - modalW / 2;
    const modalY = cy - modalH / 2;

    // Dark slate panel
    overlayContext.fillStyle = 'rgba(16, 20, 26, 0.96)';
    overlayContext.fillRect(modalX, modalY, modalW, modalH);

    // Outer ornate gold border
    overlayContext.strokeStyle = '#D4AF37';
    overlayContext.lineWidth = 2.0;
    overlayContext.strokeRect(modalX, modalY, modalW, modalH);

    // Inner crimson hairline
    overlayContext.strokeStyle = '#AC3232';
    overlayContext.lineWidth = 1.0;
    overlayContext.strokeRect(modalX + 4, modalY + 4, modalW - 8, modalH - 8);

    // Corner accent rivets in gold
    overlayContext.fillStyle = '#D4AF37';
    overlayContext.fillRect(modalX + 6, modalY + 6, 4, 4);
    overlayContext.fillRect(modalX + modalW - 10, modalY + 6, 4, 4);
    overlayContext.fillRect(modalX + 6, modalY + modalH - 10, 4, 4);
    overlayContext.fillRect(modalX + modalW - 10, modalY + modalH - 10, 4, 4);

    // 3. Modal Header
    const headerY = modalY + u * 1.3;
    overlayContext.font = `bold ${Math.max(13, u * 0.82)}px ${fontDefault}`;
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'middle';
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("★ CREDITS & ACKNOWLEDGMENTS", modalX + u * 1.0, headerY);

    overlayContext.font = `bold ${Math.max(11, u * 0.58)}px ${fontDefault}`;
    overlayContext.textAlign = 'right';
    overlayContext.fillStyle = '#E8DDFF';
    overlayContext.fillText("[ESC / X] RETURN TO START", modalX + modalW - u * 1.0, headerY);

    // 4. Section 1: Lead Creator Hero Card (D-02)
    const heroBoxX = modalX + u * 1.2;
    const heroBoxY = modalY + u * 2.2;
    const heroBoxW = modalW - u * 2.4;
    const heroBoxH = u * 3.4;

    overlayContext.fillStyle = 'rgba(24, 28, 36, 0.92)';
    overlayContext.fillRect(heroBoxX, heroBoxY, heroBoxW, heroBoxH);
    overlayContext.strokeStyle = '#D4AF37';
    overlayContext.lineWidth = 1.4;
    overlayContext.strokeRect(heroBoxX, heroBoxY, heroBoxW, heroBoxH);

    // Corner rivets on hero box
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillRect(heroBoxX + 3, heroBoxY + 3, 3, 3);
    overlayContext.fillRect(heroBoxX + heroBoxW - 6, heroBoxY + 3, 3, 3);
    overlayContext.fillRect(heroBoxX + 3, heroBoxY + heroBoxH - 6, 3, 3);
    overlayContext.fillRect(heroBoxX + heroBoxW - 6, heroBoxY + heroBoxH - 6, 3, 3);

    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'middle';
    overlayContext.font = `bold ${Math.max(13, u * 0.78)}px ${fontDefault}`;
    overlayContext.fillStyle = '#FBF236';
    overlayContext.fillText("CREATED & REVAMPED BY BAIZID AL HAMID", cx, heroBoxY + heroBoxH * 0.38);

    overlayContext.font = `${Math.max(10, u * 0.52)}px ${fontDefault}`;
    overlayContext.fillStyle = '#E8DDFF';
    overlayContext.fillText("Game Design • Twitch APG Architecture • Combat Overhaul • Pixel Art", cx, heroBoxY + heroBoxH * 0.72);

    // 5. Sections 2, 3, 4: Categorized Attribution Panels
    const cardY = heroBoxY + heroBoxH + u * 0.8;
    const cardH = (modalY + modalH - u * 2.0 - cardY) / 3;
    const cardW = modalW - u * 2.4;
    const cardX = modalX + u * 1.2;

    const sections = [
        {
            title: "ORIGINAL GAME CONCEPT & SOUNDTRACK",
            line1: "Jonas Olmstead (sanojian) & Jesper Rasmussen (repsej) — Original Game Creators",
            line2: "Andrei Moskvitin Josephsen — Original Game Soundtrack"
        },
        {
            title: "TECHNOLOGIES & SOUND SYNTHESIS",
            line1: "LittleJS 2D Engine — Frank Force",
            line2: "ZzFX Micro Sound Synthesizer — Frank Force & Keith Clark"
        },
        {
            title: "STREAMING ARCHITECTURE & INTEGRATION",
            line1: "Twurple (@twurple/api, @twurple/auth) — Twitch Helix & EventSub API",
            line2: "tmi.js — Twitch IRC Real-Time Chat Engine"
        }
    ];

    for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const sy = cardY + s * cardH;

        overlayContext.fillStyle = 'rgba(20, 24, 32, 0.70)';
        overlayContext.fillRect(cardX, sy, cardW, cardH - u * 0.35);
        overlayContext.strokeStyle = 'rgba(212, 175, 55, 0.30)';
        overlayContext.lineWidth = 1.0;
        overlayContext.strokeRect(cardX, sy, cardW, cardH - u * 0.35);

        // Section Title
        overlayContext.textAlign = 'left';
        overlayContext.textBaseline = 'top';
        overlayContext.font = `bold ${Math.max(11, u * 0.58)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FFC837';
        overlayContext.fillText(sec.title, cardX + u * 0.8, sy + u * 0.45);

        // Section Body Lines
        overlayContext.font = `${Math.max(10, u * 0.50)}px ${fontDefault}`;
        overlayContext.fillStyle = '#FFFFFF';
        overlayContext.fillText(sec.line1, cardX + u * 1.0, sy + u * 1.25);
        overlayContext.fillStyle = '#C8D2DE';
        overlayContext.fillText(sec.line2, cardX + u * 1.0, sy + u * 1.95);
    }

    // 6. Footer Banner (Twitch Purple, 100% Free & Open-Source Spectator Survival Shooter)
    const footerY = modalY + modalH - u * 1.0;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'middle';
    overlayContext.font = `bold ${Math.max(11, u * 0.56)}px ${fontDefault}`;
    overlayContext.fillStyle = '#9146FF';
    overlayContext.fillText("100% Free & Open-Source Spectator Survival Shooter", cx, footerY);

    overlayContext.restore();
}

function playStartTabChirp(tabIndex) {
    const pitch = START_TAB_PITCH_RATES[tabIndex] || 1.0;
    const sPos = (typeof cameraPos !== 'undefined' && cameraPos) ? cameraPos : vec2(0, 0);
    if (typeof soundCountdownBeep !== 'undefined' && soundCountdownBeep && soundCountdownBeep.play) {
        soundCountdownBeep.play(sPos, 0.85, pitch);
    }
}

function triggerStartAmbientWindWhisper() {
    const sPos = (typeof cameraPos !== 'undefined' && cameraPos) ? cameraPos : vec2(0, 0);
    if (typeof zzfx === 'function') {
        zzfx(0.08, 0.05, 85, 0.35, 1.15, 0.85, 4, 1.2, 0.3, -0.2, 0, 0, 0, 0.4, 0, 0, 0.1, 0.65, 0.25);
    } else if (typeof soundGhostGroan !== 'undefined' && soundGhostGroan && soundGhostGroan.play) {
        soundGhostGroan.play(sPos, 0.08, 0.65);
    }
}

function switchTab(newTab) {
    if (typeof newTab === 'number' && newTab >= 0 && newTab <= 2) {
        g_startHelpTab = newTab;
        playStartTabChirp(newTab);
    }
}

function drawTabButton(ctx, tx, tabY, tabW, tabH, title, isActive, u) {
    if (!ctx) return;
    ctx.fillStyle = isActive ? 'rgba(212, 175, 55, 0.22)' : 'rgba(22, 27, 34, 0.60)';
    ctx.fillRect(tx, tabY - tabH / 2, tabW - 4, tabH);
    ctx.strokeStyle = isActive ? '#FBF236' : 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = isActive ? 2.0 : 1.0;
    ctx.strokeRect(tx, tabY - tabH / 2, tabW - 4, tabH);
    ctx.font = `bold ${Math.max(10, u * 0.55)}px ${fontDefault}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isActive ? '#FFFFFF' : '#B0B8C4';
    ctx.fillText(title, tx + (tabW - 4) / 2, tabY);
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

// Unified Multi-Input Handling (D-13, D-22..D-26)
function updateStartScreen() {
    const W = mainCanvas ? mainCanvas.width : 1920;
    const H = mainCanvas ? mainCanvas.height : 1080;
    const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(W, H);

    // Decrement 4-frame modal spring animation counter (D-22)
    if (g_startModalSpringFrames > 0) {
        g_startModalSpringFrames--;
    }

    // Periodic procedural ZzFX ambient graveyard wind whisper every 12-16s (720-960 frames) after interaction (D-23)
    if (g_startUserInteracted) {
        g_startWindTimer--;
        if (g_startWindTimer <= 0) {
            triggerStartAmbientWindWhisper();
            g_startWindTimer = 720 + Math.floor(Math.random() * 241);
        }
    }

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
    if (clicked) g_startUserInteracted = true;

    if (g_startCreditsOpen) {
        g_startHoverCTA = false;
        g_startHoverGuide = false;
        g_startHoverCredits = false;
        g_startHoverExit = false;
        if (mainCanvas && mainCanvas.style) mainCanvas.style.cursor = 'default';

        const modalW = Math.min(safeW * 0.88, Math.max(880, u * 30));
        const modalH = Math.min(safeH * 0.82, Math.max(560, u * 20));
        const modalX = cx - modalW / 2;
        const modalY = cy - modalH / 2;

        if (mPos && mainCanvas && mainCanvas.style) {
            if (mPos.x >= modalX + modalW - u * 8.0 && mPos.x <= modalX + modalW - u * 0.5 && mPos.y >= modalY + u * 0.5 && mPos.y <= modalY + u * 2.2) {
                mainCanvas.style.cursor = 'pointer';
            }
        }

        // Mouse click detection inside/outside Credits modal
        if (clicked && mPos) {
            // Close button click (top right) or clicking outside modal backdrop
            if (mPos.x < modalX || mPos.x > modalX + modalW || mPos.y < modalY || mPos.y > modalY + modalH || (mPos.y <= modalY + u * 2.2 && mPos.x >= modalX + modalW - u * 8.0)) {
                g_startCreditsOpen = false;
                playStartTabChirp(0);
                return;
            }
        }

        // Keyboard: Esc (27), 'X' (88), or 'C' (67) closes Credits modal
        if (typeof keyWasPressed !== 'undefined') {
            if (keyWasPressed(27) || keyWasPressed(88) || keyWasPressed(67)) {
                g_startCreditsOpen = false;
                playStartTabChirp(0);
                return;
            }
        }

        // Gamepad: B (1) or Y (3) closes Credits modal
        if (typeof gamepadWasPressed !== 'undefined') {
            if (gamepadWasPressed(1) || gamepadWasPressed(3)) {
                g_startCreditsOpen = false;
                playStartTabChirp(0);
                return;
            }
        }
        return;
    }

    if (g_startHelpOpen) {
        g_startHoverCTA = false;
        g_startHoverGuide = false;
        g_startHoverCredits = false;
        g_startHoverExit = false;
        if (mainCanvas && mainCanvas.style) mainCanvas.style.cursor = 'default';

        // Field Manual Modal Input Routing (CLIP-06, D-06: synchronized HiDPI bounds)
        const modalW = Math.min(safeW * 0.92, Math.max(1020, u * 38));
        const modalH = Math.min(safeH * 0.86, Math.max(680, u * 25.5));
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
                    playStartTabChirp(i);
                    return;
                }
            }
            // Close button / backdrop click
            if (mPos.x < modalX || mPos.x > modalX + modalW || mPos.y < modalY || mPos.y > modalY + modalH || (mPos.y <= modalY + u * 2.2 && mPos.x >= modalX + modalW - u * 8.0)) {
                g_startHelpOpen = false;
                g_startModalSpringFrames = 0;
                return;
            }
        }

        // Keyboard: 1, 2, 3, Left/Right arrows, Esc, H, X (with pitch-shifted chirps, D-24)
        if (typeof keyWasPressed !== 'undefined') {
            if (keyWasPressed(49)) { g_startUserInteracted = true; g_startHelpTab = 0; playStartTabChirp(0); } // '1'
            if (keyWasPressed(50)) { g_startUserInteracted = true; g_startHelpTab = 1; playStartTabChirp(1); } // '2'
            if (keyWasPressed(51)) { g_startUserInteracted = true; g_startHelpTab = 2; playStartTabChirp(2); } // '3'
            if (keyWasPressed(37)) { g_startUserInteracted = true; g_startHelpTab = (g_startHelpTab + 2) % 3; playStartTabChirp(g_startHelpTab); } // Left Arrow
            if (keyWasPressed(39)) { g_startUserInteracted = true; g_startHelpTab = (g_startHelpTab + 1) % 3; playStartTabChirp(g_startHelpTab); } // Right Arrow
            if (keyWasPressed(27) || keyWasPressed(72) || keyWasPressed(88)) { // Esc, 'H', or 'X'
                g_startHelpOpen = false;
                g_startModalSpringFrames = 0;
                return;
            }
        }

        // Gamepad: LB (4) / RB (5) switch tabs, B (1) / Y (3) close
        if (typeof gamepadWasPressed !== 'undefined') {
            if (gamepadWasPressed(4)) { g_startUserInteracted = true; g_startHelpTab = (g_startHelpTab + 2) % 3; playStartTabChirp(g_startHelpTab); }
            if (gamepadWasPressed(5)) { g_startUserInteracted = true; g_startHelpTab = (g_startHelpTab + 1) % 3; playStartTabChirp(g_startHelpTab); }
            if (gamepadWasPressed(1) || gamepadWasPressed(3)) {
                g_startHelpOpen = false;
                g_startModalSpringFrames = 0;
                return;
            }
        }
        return;
    }

    // Start Screen Input Routing (Modal closed)
    const ctaY = H * 0.74;
    const ctaW = Math.min(safeW * 0.65, u * 17);
    const ctaH = u * 2.3;

    const rowY = H * 0.83;
    const btnW = Math.min(safeW * 0.38, u * 11);
    const btnH = Math.min(u * 1.6, H * 0.044);
    const gap = Math.max(8, u * 0.8);
    const guideX = cx - btnW / 2 - gap / 2;
    const creditsX = cx + btnW / 2 + gap / 2;

    const exitY = H * 0.88;
    const exitW = Math.min(safeW * 0.42, u * 12);
    const exitH = Math.min(u * 1.4, H * 0.042);

    if (g_startMoonPulseFrames > 0) {
        g_startMoonPulseFrames--;
    }

    // Hover state detection for CTA cartouche, [H] button, [C] button, [ EXIT GAME ], and Moon (D-25, D-26)
    const { moonX, moonY, moonR } = getStartMoonMetrics(W, H, u, safeW, safeH);
    if (mPos) {
        g_startHoverCTA = Math.abs(mPos.x - cx) < ctaW / 2 && Math.abs(mPos.y - ctaY) < ctaH / 2;
        g_startHoverGuide = Math.abs(mPos.x - guideX) < btnW / 2 && Math.abs(mPos.y - rowY) < btnH / 2;
        g_startHoverCredits = Math.abs(mPos.x - creditsX) < btnW / 2 && Math.abs(mPos.y - rowY) < btnH / 2;
        g_startHoverExit = Math.abs(mPos.x - cx) < exitW / 2 && Math.abs(mPos.y - exitY) < exitH / 2;
        const hoverMoon = Math.hypot(mPos.x - moonX, mPos.y - moonY) <= moonR * 1.35;
        if (mainCanvas && mainCanvas.style) {
            if (g_startHoverCTA || g_startHoverGuide || g_startHoverCredits || g_startHoverExit || hoverMoon) {
                mainCanvas.style.cursor = 'pointer';
            } else {
                mainCanvas.style.cursor = 'default';
            }
        }
    }

    // Mouse click detection
    if (clicked && mPos) {
        // Clicked Moon Easter Egg (D-25)
        const moonDist = Math.hypot(mPos.x - moonX, mPos.y - moonY);
        if (moonDist <= moonR * 1.35) {
            g_startMoonPulseFrames = 10;
            const sPos = (typeof cameraPos !== 'undefined' && cameraPos) ? cameraPos : vec2(0, 0);
            if (typeof soundEnemyGroan !== 'undefined' && soundEnemyGroan && soundEnemyGroan.play) {
                soundEnemyGroan.play(sPos, 0.35, 1.4);
            }
            return;
        }
        // Clicked Exit Game Button (D-25)
        if (Math.abs(mPos.x - cx) < exitW / 2 && Math.abs(mPos.y - exitY) < exitH / 2) {
            const sPos = (typeof cameraPos !== 'undefined' && cameraPos) ? cameraPos : vec2(0, 0);
            if (typeof soundEnemyGroan !== 'undefined' && soundEnemyGroan && soundEnemyGroan.play) {
                soundEnemyGroan.play(sPos, 0.35, 1.0);
            }
            if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.exitApp === 'function') {
                window.electronAPI.exitApp();
            } else if (typeof window !== 'undefined' && typeof window.close === 'function') {
                window.close();
            }
            return;
        }
        // Clicked Guide Button
        if (Math.abs(mPos.x - guideX) < btnW / 2 && Math.abs(mPos.y - rowY) < btnH / 2) {
            g_startHelpOpen = true;
            g_startModalSpringFrames = 4;
            playStartTabChirp(g_startHelpTab);
            return;
        }
        // Clicked Credits Button
        if (Math.abs(mPos.x - creditsX) < btnW / 2 && Math.abs(mPos.y - rowY) < btnH / 2) {
            g_startCreditsOpen = true;
            playStartTabChirp(0);
            return;
        }
        // Clicked CTA Cartouche
        if (Math.abs(mPos.x - cx) < ctaW / 2 && Math.abs(mPos.y - ctaY) < ctaH / 2) {
            triggerStartTheatricalLaunch();
            return;
        }
    }

    // Keyboard: Enter (13) or Space (32) starts; H (72) opens Help; C (67) opens Credits
    if (typeof keyWasPressed !== 'undefined') {
        if (keyWasPressed(13) || keyWasPressed(32)) {
            g_startUserInteracted = true;
            triggerStartTheatricalLaunch();
            return;
        }
        if (keyWasPressed(72)) {
            g_startUserInteracted = true;
            g_startHelpOpen = true;
            g_startModalSpringFrames = 4;
            playStartTabChirp(g_startHelpTab);
            return;
        }
        if (keyWasPressed(67)) {
            g_startUserInteracted = true;
            g_startCreditsOpen = true;
            playStartTabChirp(0);
            return;
        }
    }

    // Gamepad: A (0) starts; Y (3) opens Help
    if (typeof gamepadWasPressed !== 'undefined') {
        if (gamepadWasPressed(0)) {
            g_startUserInteracted = true;
            triggerStartTheatricalLaunch();
            return;
        }
        if (gamepadWasPressed(3)) {
            g_startUserInteracted = true;
            g_startHelpOpen = true;
            g_startModalSpringFrames = 4;
            playStartTabChirp(g_startHelpTab);
            return;
        }
    }
}

// Master Render Entry Point: 15-Step Atmospheric Depth Sandwich Z-Stack (D-17, D-18, D-19, D-21)
function renderStartScreen() {
    if (!overlayContext) return;
    const W = mainCanvas ? mainCanvas.width : 1920;
    const H = mainCanvas ? mainCanvas.height : 1080;
    const { safeW, safeH, cx, cy, u } = getStartScreenSafeZone(W, H);

    overlayContext.save();

    // Step 1: Deep Midnight Sky Background Gradient (#12081C at zenith down to #090A10 at horizon, D-17, D-20)
    const skyGrad = overlayContext.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#12081C');
    skyGrad.addColorStop(0.68, '#0D0916');
    skyGrad.addColorStop(1, '#090A10');
    overlayContext.fillStyle = skyGrad;
    overlayContext.fillRect(0, 0, W, H);

    // Step 2: Bayer-Dithered Blood/Harvest Moon & Twin Pulsating Halo Rings (VIS-03, D-09..D-12)
    renderStartMoon(cx, cy, u, W, H, safeW, safeH);

    // Step 3: Distant Cathedral Spires & Mausoleums - Plane 1 (VIS-02, D-01, D-07)
    renderStartGraveyard(W, H, u, safeW, safeH, 1);

    // Step 4: Parallax Fog Layer 1 - Distant Horizon Mist at 0.25 px/f (VIS-04, D-13)
    renderStartParallaxFog(W, H, u, 1);

    // Step 5: Midground Graveyard, Dead Oaks & Crooked Crosses - Plane 2 (VIS-02, D-01, D-06)
    renderStartGraveyard(W, H, u, safeW, safeH, 2);

    // Step 6: Parallax Fog Layer 2 - Midground Cemetery Fog at 0.60 px/f (VIS-04, D-13)
    renderStartParallaxFog(W, H, u, 2);

    // Step 7: Foreground Tombstones, Obelisks & Spiked Iron Railings - Plane 3 (VIS-02, D-01, D-05, D-08)
    renderStartGraveyard(W, H, u, safeW, safeH, 3);

    // Step 8: Parallax Fog Layer 3 - Foreground Ground Drift at 1.05 px/f (VIS-04, D-13)
    renderStartParallaxFog(W, H, u, 3);

    // Step 9: 24 Procedural Rising Embers drifting upward in front of graveyard (D-17)
    updateAndRenderStartEmbers(W, H);

    // Step 10: Heraldic Hero Crest, Crossed Shotgun/SMG & Bobbing Faction Portraits (D-17)
    renderStartScreenCrest(cx, cy, u);

    // Step 11: "DEAD AGAIN" Chromatic Typography & Subtitle Ribbon (D-17)
    const titleY = cy - u * 0.8;
    renderStartTypography(cx, titleY, u);
    const subY = titleY + u * 1.8;
    const subW = Math.min(safeW * 0.68, u * 18);
    const subH = u * 1.4;
    renderStartSubtitleRibbon(cx, subY, subW, subH, u);

    // Step 12: Arcade CTA Cartouche, Records Ledger & Streamer Shortcut Badges (D-17)
    renderStartScreenBadges(cx, H, u, safeW);

    // Step 13: Full Arcade CRT Phosphor Scanlines (3px pitch) & Dark-Crimson Perimeter Vignette (D-17, D-19)
    renderStartAtmosphere(W, H, cx, cy);

    // Step 14: Field Manual Modal Overlay (when open, g_startHelpOpen, D-17, D-22)
    if (g_startHelpOpen) {
        renderStartScreenHelpManual(W, H, cx, cy, u, safeW, safeH);
    }

    // Step 14b: Credits Modal Overlay (when open, g_startCreditsOpen, D-01..D-05)
    if (g_startCreditsOpen) {
        renderCreditsModal(W, H, cx, cy, u, safeW, safeH);
    }

    // Step 15: Enhanced 12-Frame Phosphor Flash Wipe with Blood-Crimson Vignette Decay (D-17, D-21)
    if (g_startFlashFrames > 0) {
        if (g_startFlashFrames >= 10) {
            overlayContext.fillStyle = 'rgba(255, 255, 255, 0.90)';
            overlayContext.fillRect(0, 0, W, H);
        } else {
            const decayAlpha = (g_startFlashFrames / 9) * 0.85;
            overlayContext.fillStyle = `rgba(172, 50, 50, ${decayAlpha.toFixed(3)})`;
            overlayContext.fillRect(0, 0, W, H);
        }
    }

    overlayContext.restore();
}
