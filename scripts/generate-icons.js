/**
 * scripts/generate-icons.js
 * Procedural retro pixel-art icon and asset generator for Dead Again: Twitch APG Edition.
 * Generates:
 *  - desktop/assets/icon.png (1024x1024 master badge)
 *  - desktop/assets/icon.ico (multi-resolution Windows icon: 16..256)
 *  - desktop/assets/icon.icns (native macOS icon: 16..1024 Retina)
 *  - desktop/assets/dashboard-icon.png (512x512 Streamer Dashboard icon)
 *  - desktop/assets/dmg-background.png (540x380 custom macOS DMG presentation window)
 *  - desktop/assets/installer-header.bmp (150x57 Windows NSIS installer wizard header)
 *  - relay-server/public/favicon.ico and favicon.png
 *  - main/dist/favicon.ico and favicon.png
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import png2icons from 'png2icons';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// --- CRC-32 & PNG Buffer Generator ---

let crcTable = null;
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(buf) {
  if (!crcTable) crcTable = makeCrcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makePngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function createPngBuffer(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace
  const ihdrChunk = makePngChunk('IHDR', ihdr);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter type 0: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = pixelFn(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const idatData = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makePngChunk('IDAT', idatData);
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

export function createBmpBuffer(width, height, pixelFn) {
  const rowSize = (width * 3 + 3) & ~3;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // Offset to pixel data
  buf.writeUInt32LE(40, 14); // BITMAPINFOHEADER size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // Top-down
  buf.writeUInt16LE(1, 26); // Planes
  buf.writeUInt16LE(24, 28); // 24-bit BGR
  buf.writeUInt32LE(0, 30); // Compression (BI_RGB)
  buf.writeUInt32LE(pixelArraySize, 34);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    const rowStart = offset;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    offset = rowStart + rowSize;
  }
  return buf;
}

// --- 5x7 Retro Pixel Font Bitmap Dictionary ---

const FONT_5X7 = {
  ' ': [
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000'
  ],
  'A': [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],
  'B': [
    '11110',
    '10001',
    '10001',
    '11110',
    '10001',
    '10001',
    '11110'
  ],
  'C': [
    '01111',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '01111'
  ],
  'D': [
    '11110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '11110'
  ],
  'E': [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111'
  ],
  'F': [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000'
  ],
  'G': [
    '01111',
    '10000',
    '10000',
    '10111',
    '10001',
    '10001',
    '01111'
  ],
  'H': [
    '10001',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],
  'I': [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111'
  ],
  'J': [
    '00111',
    '00010',
    '00010',
    '00010',
    '00010',
    '10010',
    '01100'
  ],
  'K': [
    '10001',
    '10010',
    '10100',
    '11000',
    '10100',
    '10010',
    '10001'
  ],
  'L': [
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '11111'
  ],
  'M': [
    '10001',
    '11011',
    '10101',
    '10101',
    '10001',
    '10001',
    '10001'
  ],
  'N': [
    '10001',
    '11001',
    '10101',
    '10011',
    '10001',
    '10001',
    '10001'
  ],
  'O': [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],
  'P': [
    '11110',
    '10001',
    '10001',
    '11110',
    '10000',
    '10000',
    '10000'
  ],
  'Q': [
    '01110',
    '10001',
    '10001',
    '10001',
    '10101',
    '10010',
    '01101'
  ],
  'R': [
    '11110',
    '10001',
    '10001',
    '11110',
    '10100',
    '10010',
    '10001'
  ],
  'S': [
    '01111',
    '10000',
    '10000',
    '01110',
    '00001',
    '00001',
    '11110'
  ],
  'T': [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100'
  ],
  'U': [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],
  'V': [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01010',
    '00100'
  ],
  'W': [
    '10001',
    '10001',
    '10001',
    '10101',
    '10101',
    '11011',
    '10001'
  ],
  'X': [
    '10001',
    '01010',
    '00100',
    '00100',
    '00100',
    '01010',
    '10001'
  ],
  'Y': [
    '10001',
    '10001',
    '01010',
    '00100',
    '00100',
    '00100',
    '00100'
  ],
  'Z': [
    '11111',
    '00001',
    '00010',
    '00100',
    '01000',
    '10000',
    '11111'
  ],
  '0': [
    '01110',
    '10011',
    '10101',
    '10101',
    '11001',
    '10001',
    '01110'
  ],
  '1': [
    '00100',
    '01100',
    '00100',
    '00100',
    '00100',
    '00100',
    '01110'
  ],
  '2': [
    '01110',
    '10001',
    '00001',
    '00110',
    '01000',
    '10000',
    '11111'
  ],
  '3': [
    '11110',
    '00001',
    '00001',
    '01110',
    '00001',
    '00001',
    '11110'
  ],
  '4': [
    '00010',
    '00110',
    '01010',
    '10010',
    '11111',
    '00010',
    '00010'
  ],
  '5': [
    '11111',
    '10000',
    '11110',
    '00001',
    '00001',
    '10001',
    '01110'
  ],
  '6': [
    '01110',
    '10000',
    '11110',
    '10001',
    '10001',
    '10001',
    '01110'
  ],
  '7': [
    '11111',
    '00001',
    '00010',
    '00100',
    '01000',
    '01000',
    '01000'
  ],
  '8': [
    '01110',
    '10001',
    '10001',
    '01110',
    '10001',
    '10001',
    '01110'
  ],
  '9': [
    '01110',
    '10001',
    '10001',
    '01111',
    '00001',
    '00001',
    '01110'
  ],
  ':': [
    '00000',
    '00100',
    '00100',
    '00000',
    '00100',
    '00100',
    '00000'
  ],
  '!': [
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00000',
    '00100'
  ],
  '-': [
    '00000',
    '00000',
    '00000',
    '11111',
    '00000',
    '00000',
    '00000'
  ],
  '.': [
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '01100',
    '01100'
  ],
  '>': [
    '10000',
    '01000',
    '00100',
    '00010',
    '00100',
    '01000',
    '10000'
  ],
  '/': [
    '00001',
    '00010',
    '00010',
    '00100',
    '01000',
    '01000',
    '10000'
  ]
};

// --- Pixel Canvas Class ---

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    } else if (a > 0) {
      const sa = a / 255;
      const da = this.data[idx + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA > 0) {
        this.data[idx] = Math.round((r * sa + this.data[idx] * da * (1 - sa)) / outA);
        this.data[idx + 1] = Math.round((g * sa + this.data[idx + 1] * da * (1 - sa)) / outA);
        this.data[idx + 2] = Math.round((b * sa + this.data[idx + 2] * da * (1 - sa)) / outA);
        this.data[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  getPixel(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
    const idx = (y * this.width + x) * 4;
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
  }

  fillRect(x, y, w, h, [r, g, b, a = 255]) {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(this.width, Math.floor(x + w));
    const endY = Math.min(this.height, Math.floor(y + h));
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  strokeRect(x, y, w, h, thickness, color) {
    this.fillRect(x, y, w, thickness, color);
    this.fillRect(x, y + h - thickness, w, thickness, color);
    this.fillRect(x, y, thickness, h, color);
    this.fillRect(x + w - thickness, y, thickness, h, color);
  }

  fillCircle(cx, cy, radius, [r, g, b, a = 255]) {
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, thickness, [r, g, b, a = 255]) {
    const rOuter2 = (radius + thickness / 2) ** 2;
    const rInner2 = Math.max(0, (radius - thickness / 2) ** 2);
    const minX = Math.max(0, Math.floor(cx - radius - thickness));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + thickness));
    const minY = Math.max(0, Math.floor(cy - radius - thickness));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + thickness));
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (d2 >= rInner2 && d2 <= rOuter2) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  // Draw 5x7 retro text with optional drop shadow
  drawText(text, x, y, scale, color, shadowColor = null) {
    const upper = text.toUpperCase();
    let curX = x;
    for (let i = 0; i < upper.length; i++) {
      const char = upper[i];
      const glyph = FONT_5X7[char] || FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === '1') {
            if (shadowColor) {
              this.fillRect(curX + col * scale + scale, y + row * scale + scale, scale, scale, shadowColor);
            }
            this.fillRect(curX + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      curX += (5 + 1) * scale; // 5 columns + 1 col spacing
    }
  }

  // Draw 2D array matrix with color mapping palette
  drawMatrix(matrix, startX, startY, scale, palette) {
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        const key = matrix[row][col];
        if (key && palette[key]) {
          this.fillRect(startX + col * scale, startY + row * scale, scale, scale, palette[key]);
        }
      }
    }
  }

  toPngBuffer() {
    return createPngBuffer(this.width, this.height, (x, y) => this.getPixel(x, y));
  }

  toBmpBuffer() {
    return createBmpBuffer(this.width, this.height, (x, y) => this.getPixel(x, y));
  }
}

// --- Procedural Pixel Art Sprites ---

// 16x16 Survivor Hero Pixel Matrix
const SURVIVOR_MATRIX = [
  '..GGGGGGGGGG....',
  '.GGGGGGGGGGGG...',
  '.GSSSSSSSSSSG...',
  '.SBBSSSSSSBBS...',
  '.SFFSSSSSSFFS...',
  '.SSSSSSSSSSSS...',
  '..SMMSSSSMMS....',
  '...SSSSSSSS.....',
  '..JJWWWWWWJJ....',
  '.JJJWWWWWWJJJ...',
  '.JJJWWWWWWJJJ...',
  '.JJJWWWWWWJJJ...',
  '..LLWWWWWWLL....',
  '..LL......LL....',
  '..PP......PP....',
  '.PPP......PPP...'
];

// 16x16 Zombie Skull Pixel Matrix
const SKULL_MATRIX = [
  '...ZZZZZZZZZ....',
  '..ZZZZZZZZZZZ...',
  '.ZZZZZZZZZZZZZ..',
  '.ZZKKZZZZZKKZZ..',
  '.ZZRREZZZERREZZ.',
  '.ZZRREZZZERREZZ.',
  '.ZZKKZZZZZKKZZ..',
  '..ZZZZZZZZZZZ...',
  '..ZZZNNNNNZZZ...',
  '...ZZNNNNNZZ....',
  '...ZZZZZZZZZ....',
  '...ZTTTTTTTZ....',
  '...ZTKKTKKTZ....',
  '...ZTTTTTTTZ....',
  '....KK...KK.....',
  '................'
];

// 16x16 APG Twitch Crown Matrix
const CROWN_MATRIX = [
  '..P...P...P.....',
  '.PP...P...PP....',
  '.PPP.PPP.PPP....',
  '.PPPPPPPPPPP....',
  '.PPPPPPPPPPP....',
  '.PPPPPPPPPPP....',
  '.PPPPPPPPPPP....',
  '.PGGPGGPGGGP....',
  '.PGGPGGPGGGP....',
  '..PPPPPPPPP.....',
  '....PPPPP.......',
  '.....PPP........',
  '......P.........',
  '................',
  '................',
  '................'
];

// --- 1. Generate Master Icon (1024x1024) ---
function generateMasterIcon() {
  console.log('[Icon] Rendering 1024x1024 Master Pixel Art Icon...');
  const cv = new PixelCanvas(1024, 1024);

  // Background dark carbon/metallic grid
  for (let y = 0; y < 1024; y++) {
    const grad = Math.floor(18 + (y / 1024) * 16);
    for (let x = 0; x < 1024; x++) {
      const isGrid = (x % 32 === 0 || y % 32 === 0) ? 8 : 0;
      cv.setPixel(x, y, grad + isGrid, grad - 4 + isGrid, grad + 8 + isGrid, 255);
    }
  }

  // Outer Twitch purple edge glow (#9146FF)
  for (let r = 480; r >= 420; r -= 4) {
    const alpha = Math.floor(15 + ((480 - r) / 60) * 120);
    cv.strokeCircle(512, 470, r, 6, [145, 70, 255, alpha]);
  }

  // Hexagonal shield background (#14121d)
  cv.fillCircle(512, 470, 420, [20, 18, 30, 255]);
  cv.strokeCircle(512, 470, 420, 14, [145, 70, 255, 255]);
  cv.strokeCircle(512, 470, 405, 4, [191, 138, 255, 230]); // Inner neon rim

  // Crimson blood splatter accents (#8B0000 / #D2143A)
  const splatters = [
    [512, 380, 80], [620, 320, 50], [420, 360, 45],
    [570, 440, 60], [460, 470, 55], [660, 420, 35],
    [360, 420, 40], [520, 270, 40], [700, 300, 25]
  ];
  for (const [sx, sy, sr] of splatters) {
    cv.fillCircle(sx, sy, sr, [180, 20, 35, 190]);
    cv.fillCircle(sx + 8, sy - 8, sr * 0.6, [220, 30, 50, 220]);
    cv.fillCircle(sx - 12, sy + 10, sr * 0.3, [120, 10, 20, 240]);
  }

  // Palette for Survivor Hero
  const survivorPalette = {
    'G': [46, 139, 87, 255],   // Olive green headband
    'S': [245, 208, 169, 255], // Skin tone
    'B': [40, 40, 40, 255],    // Dark hair/eyebrow
    'F': [255, 255, 255, 255], // Determined eye sclera
    'M': [180, 100, 90, 255],  // Mouth/stubble
    'J': [139, 69, 19, 255],   // Brown leather jacket
    'W': [220, 220, 220, 255], // Undershirt
    'L': [160, 82, 45, 255],   // Gun harness
    'P': [30, 30, 50, 255]     // Combat trousers
  };

  // Palette for Red-Eyed Zombie Skull
  const skullPalette = {
    'Z': [120, 150, 130, 255], // Decayed greenish bone
    'K': [20, 20, 25, 255],    // Deep eye cavity black
    'R': [255, 10, 30, 255],   // Fiery red glowing pupil
    'E': [255, 180, 180, 255], // Intense eye core
    'N': [40, 50, 45, 255],    // Nasal cavity
    'T': [230, 230, 210, 255]  // Jagged teeth
  };

  // Draw Survivor on Left (Scale: 18x18 per pixel, centered around X=240, Y=310)
  cv.drawMatrix(SURVIVOR_MATRIX, 150, 270, 18, survivorPalette);

  // VS Lightning / APG Tug-of-War Center Divider
  cv.fillCircle(512, 430, 40, [145, 70, 255, 230]);
  cv.fillCircle(512, 430, 22, [255, 255, 255, 255]);
  cv.drawText('VS', 484, 412, 6, [255, 255, 255, 255], [40, 10, 70, 255]);

  // Draw Red-Eyed Zombie Skull on Right (Scale: 18x18, centered around X=600, Y=270)
  cv.drawMatrix(SKULL_MATRIX, 580, 270, 18, skullPalette);

  // Bottom Metallic Title Banner Cartridge Plate
  cv.fillRect(80, 750, 864, 210, [15, 12, 22, 255]);
  cv.strokeRect(80, 750, 864, 210, 8, [145, 70, 255, 255]);
  cv.strokeRect(88, 758, 848, 194, 3, [255, 215, 0, 200]); // Gold arcade border

  // Title Text: "DEAD AGAIN" in bold retro lettering
  // 10 chars * 6 cols * scale 11 = 660 px wide. Centered at (1024 - 660)/2 = 182
  cv.drawText('DEAD AGAIN', 182, 775, 11, [235, 30, 55, 255], [40, 0, 0, 255]);

  // Subtitle: "REVAMPED (TWITCH)"
  // 17 chars * 6 cols * scale 6 = 612 px wide. Centered at (1024 - 612)/2 = 206
  cv.drawText('REVAMPED (TWITCH)', 206, 885, 6, [191, 138, 255, 255], [20, 0, 40, 255]);

  return cv.toPngBuffer();
}

// --- 2. Generate Dashboard Secondary Icon (512x512) ---
function generateDashboardIcon() {
  console.log('[Icon] Rendering 512x512 Streamer Dashboard Pixel Art Icon...');
  const cv = new PixelCanvas(512, 512);

  // Twitch purple radial gradient background
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const dx = x - 256;
      const dy = y - 256;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const intensity = Math.max(0, 1 - dist / 320);
      const r = Math.floor(18 + intensity * 60);
      const g = Math.floor(12 + intensity * 25);
      const b = Math.floor(35 + intensity * 120);
      cv.setPixel(x, y, r, g, b, 255);
    }
  }

  // Hexagonal Twitch border (#9146FF)
  cv.strokeCircle(256, 230, 200, 10, [145, 70, 255, 255]);
  cv.strokeCircle(256, 230, 185, 3, [220, 180, 255, 200]);

  // Radar Scanner Rings (APG Audience Radar)
  cv.strokeCircle(256, 230, 140, 3, [90, 45, 160, 220]);
  cv.strokeCircle(256, 230, 90, 2, [120, 60, 200, 200]);
  cv.strokeCircle(256, 230, 40, 2, [145, 70, 255, 220]);

  // Radar Crosshairs
  cv.fillRect(256 - 150, 230 - 1, 300, 2, [145, 70, 255, 160]);
  cv.fillRect(256 - 1, 230 - 150, 2, 300, [145, 70, 255, 160]);

  // Radar Blips (Audience faction indicators)
  cv.fillCircle(200, 180, 8, [50, 205, 50, 255]); // Team Good green blip
  cv.fillCircle(310, 270, 8, [255, 50, 50, 255]);  // Team Bad red blip
  cv.fillCircle(280, 170, 6, [255, 215, 0, 255]); // VIP gold blip

  // Twitch APG Crown in Center
  const crownPalette = {
    'P': [191, 138, 255, 255],
    'G': [255, 215, 0, 255]
  };
  cv.drawMatrix(CROWN_MATRIX, 256 - 8 * 7, 230 - 8 * 7, 7, crownPalette);

  // Equalizer Slider Bars (Streamer Audio & Karma Sliders)
  const barColors = [
    [50, 205, 50, 255], [50, 205, 50, 255],
    [255, 215, 0, 255], [255, 215, 0, 255],
    [255, 69, 0, 255], [255, 0, 50, 255]
  ];
  for (let i = 0; i < 6; i++) {
    const barHeight = 25 + ((i * 13) % 40);
    const bx = 160 + i * 34;
    const by = 380 - barHeight;
    cv.fillRect(bx, by, 18, barHeight, barColors[i]);
  }

  // Title Banner at Bottom: "APG DASHBOARD"
  cv.fillRect(40, 420, 432, 65, [10, 8, 18, 255]);
  cv.strokeRect(40, 420, 432, 65, 4, [145, 70, 255, 255]);
  // 13 chars * 6 cols * scale 4 = 312 px wide. Centered: (512 - 312)/2 = 100
  cv.drawText('APG DASHBOARD', 100, 438, 4, [255, 255, 255, 255], [60, 20, 100, 255]);

  return cv.toPngBuffer();
}

// --- 3. Generate macOS DMG Presentation Window Banner (540x380) ---
function generateDmgBackground() {
  console.log('[Icon] Rendering 540x380 macOS DMG Presentation Background...');
  const cv = new PixelCanvas(540, 380);

  // Dark metallic background
  for (let y = 0; y < 380; y++) {
    const grad = Math.floor(18 + (y / 380) * 14);
    for (let x = 0; x < 540; x++) {
      const isGrid = (x % 20 === 0 || y % 20 === 0) ? 6 : 0;
      cv.setPixel(x, y, grad + isGrid, grad - 2 + isGrid, grad + 8 + isGrid, 255);
    }
  }

  // Neon Purple Outer Border
  cv.strokeRect(0, 0, 540, 380, 5, [145, 70, 255, 255]);
  cv.strokeRect(5, 5, 530, 370, 2, [191, 138, 255, 120]);

  // Corner Blood Splatters
  cv.fillCircle(40, 40, 30, [160, 20, 30, 180]);
  cv.fillCircle(500, 50, 35, [160, 20, 30, 180]);
  cv.fillCircle(490, 330, 25, [160, 20, 30, 180]);

  // Top Header Banner
  cv.fillRect(20, 20, 500, 70, [12, 10, 20, 230]);
  cv.strokeRect(20, 20, 500, 70, 3, [145, 70, 255, 255]);
  // Title: "DEAD AGAIN"
  cv.drawText('DEAD AGAIN', 185, 30, 4, [235, 30, 55, 255], [30, 0, 0, 255]);
  // Subtitle: "REVAMPED (TWITCH)"
  cv.drawText('REVAMPED (TWITCH)', 160, 62, 2, [191, 138, 255, 255]);

  // App Drop Pedestals: App at (140, 190) and /Applications at (400, 190)
  // electron-builder places icon centers at (140, 190) and (400, 190)
  cv.strokeCircle(140, 190, 52, 3, [145, 70, 255, 180]);
  cv.fillCircle(140, 190, 50, [25, 20, 40, 140]);

  cv.strokeCircle(400, 190, 52, 3, [50, 205, 50, 180]);
  cv.fillCircle(400, 190, 50, [20, 40, 25, 140]);

  // Drag Arrow pointing from App (X=210) to Applications (X=330) at Y=190
  const arrowY = 190;
  cv.fillRect(215, arrowY - 6, 85, 12, [191, 138, 255, 255]); // Shaft
  // Arrow Head
  for (let i = 0; i <= 20; i++) {
    cv.fillRect(300 + i, arrowY - (20 - i), 2, (20 - i) * 2, [191, 138, 255, 255]);
  }

  // Label above Arrow: "DRAG TO INSTALL"
  cv.drawText('DRAG TO INSTALL', 215, arrowY - 32, 2, [255, 255, 255, 255], [40, 10, 60, 255]);

  // Bottom Instructions / Gatekeeper Notice
  cv.fillRect(30, 310, 480, 45, [10, 8, 16, 220]);
  cv.strokeRect(30, 310, 480, 45, 2, [145, 70, 255, 180]);
  cv.drawText('IF BLOCKED BY GATEKEEPER: RUN FIX GATEKEEPER.COMMAND', 42, 326, 1, [255, 215, 0, 255]);

  return cv.toPngBuffer();
}

// --- 4. Generate Windows NSIS Installer Header (150x57 BMP) ---
function generateNsisHeader() {
  console.log('[Icon] Rendering 150x57 Windows NSIS Wizard Header BMP...');
  const cv = new PixelCanvas(150, 57);

  // Background
  for (let y = 0; y < 57; y++) {
    for (let x = 0; x < 150; x++) {
      cv.setPixel(x, y, 18, 14, 28, 255);
    }
  }

  // Border
  cv.strokeRect(0, 0, 150, 57, 2, [145, 70, 255, 255]);

  // Mini skull icon on left
  const miniSkull = {
    'Z': [120, 150, 130, 255],
    'R': [255, 20, 30, 255],
    'K': [10, 10, 15, 255]
  };
  const miniMatrix = [
    '.ZZZZ.',
    'ZKKZZK',
    'ZRZZRZ',
    '.ZZZZ.',
    '.ZTTZ.'
  ];
  cv.drawMatrix(miniMatrix, 10, 16, 4, miniSkull);

  // Text: "DEAD AGAIN" & "APG EDITION"
  cv.drawText('DEAD AGAIN', 42, 12, 1, [235, 30, 55, 255]);
  cv.drawText('REVAMPED', 42, 28, 1, [191, 138, 255, 255]);
  cv.drawText('INSTALLER', 42, 42, 1, [255, 215, 0, 255]);

  return cv.toBmpBuffer();
}

// --- 5. Generate Web Favicons (32x32) ---
function generateFaviconPng() {
  const cv = new PixelCanvas(32, 32);

  // Dark background
  cv.fillRect(0, 0, 32, 32, [18, 14, 28, 255]);
  cv.strokeRect(0, 0, 32, 32, 1, [145, 70, 255, 255]);

  // Mini skull + glowing eyes
  const miniSkull = {
    'Z': [120, 150, 130, 255],
    'R': [255, 0, 30, 255],
    'K': [10, 10, 15, 255],
    'T': [230, 230, 220, 255]
  };
  const matrix = [
    '..ZZZZZZ..',
    '.ZZZZZZZZ.',
    'ZZKKZZKKZZ',
    'ZZRRZZRRZZ',
    '.ZZZZZZZZ.',
    '..ZZZZZZ..',
    '..ZTTTTZ..',
    '...KKKK...'
  ];
  cv.drawMatrix(matrix, 6, 8, 2, miniSkull);

  return cv.toPngBuffer();
}

// --- Main Asset Generation Orchestrator ---

export async function runGenerateIcons() {
  const assetsDir = path.join(rootDir, 'desktop', 'assets');
  const relayPublicDir = path.join(rootDir, 'relay-server', 'public');
  const gameDistDir = path.join(rootDir, 'main', 'dist');

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(relayPublicDir, { recursive: true });
  fs.mkdirSync(gameDistDir, { recursive: true });

  console.log('--- Starting Native Icon & Asset Generation Pipeline ---');

  // 1. Primary Master PNG (1024x1024)
  const masterPngPath = path.join(assetsDir, 'icon.png');
  let masterPng;
  if (fs.existsSync(masterPngPath)) {
    console.log(`[Icon] Using existing master icon at ${masterPngPath}`);
    masterPng = fs.readFileSync(masterPngPath);
  } else {
    masterPng = generateMasterIcon();
    fs.writeFileSync(masterPngPath, masterPng);
    console.log(`✓ Generated: ${masterPngPath} (${masterPng.length} bytes)`);
  }

  // 2. Windows Multi-Resolution ICO (16..256 mipmaps)
  // Calling png2icons.createICO with (false, false) produces full uncompressed DIB chunks (> 50KB)
  console.log('[Icon] Converting Master PNG to Windows multi-resolution .ico...');
  const iconIco = png2icons.createICO(masterPng, png2icons.BILINEAR, 0, false, false);
  if (!iconIco) {
    throw new Error('Failed to generate Windows .ico from master PNG');
  }
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, iconIco);
  console.log(`✓ Generated: ${icoPath} (${iconIco.length} bytes)`);

  // 3. macOS Native ICNS (16..1024 Retina)
  console.log('[Icon] Converting Master PNG to macOS native .icns...');
  let iconIcns;
  try {
    if (process.platform === 'darwin') {
      const { execSync } = await import('child_process');
      const iconsetDir = path.join(assetsDir, 'icon.iconset');
      fs.mkdirSync(iconsetDir, { recursive: true });
      const sizes = [
        { name: 'icon_16x16.png', size: 16 },
        { name: 'icon_16x16@2x.png', size: 32 },
        { name: 'icon_32x32.png', size: 32 },
        { name: 'icon_32x32@2x.png', size: 64 },
        { name: 'icon_128x128.png', size: 128 },
        { name: 'icon_128x128@2x.png', size: 256 },
        { name: 'icon_256x256.png', size: 256 },
        { name: 'icon_256x256@2x.png', size: 512 },
        { name: 'icon_512x512.png', size: 512 },
        { name: 'icon_512x512@2x.png', size: 1024 }
      ];
      for (const s of sizes) {
        execSync(`sips -z ${s.size} ${s.size} "${masterPngPath}" --out "${path.join(iconsetDir, s.name)}" >/dev/null 2>&1`);
      }
      const tmpIcns = path.join(assetsDir, 'temp_icon.icns');
      execSync(`iconutil -c icns "${iconsetDir}" -o "${tmpIcns}" >/dev/null 2>&1`);
      iconIcns = fs.readFileSync(tmpIcns);
      fs.unlinkSync(tmpIcns);
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[Icon] Native iconutil fallback to png2icons:', err.message);
  }

  if (!iconIcns) {
    iconIcns = png2icons.createICNS(masterPng, png2icons.BILINEAR, 0);
  }
  if (!iconIcns) {
    throw new Error('Failed to generate macOS .icns from master PNG');
  }
  const icnsPath = path.join(assetsDir, 'icon.icns');
  fs.writeFileSync(icnsPath, iconIcns);
  console.log(`✓ Generated: ${icnsPath} (${iconIcns.length} bytes)`);

  // 4. Secondary Streamer Dashboard Icon (512x512)
  const dashPng = generateDashboardIcon();
  const dashPngPath = path.join(assetsDir, 'dashboard-icon.png');
  fs.writeFileSync(dashPngPath, dashPng);
  console.log(`✓ Generated: ${dashPngPath} (${dashPng.length} bytes)`);

  // 5. macOS DMG Background Banner (540x380)
  const dmgPng = generateDmgBackground();
  const dmgPngPath = path.join(assetsDir, 'dmg-background.png');
  fs.writeFileSync(dmgPngPath, dmgPng);
  console.log(`✓ Generated: ${dmgPngPath} (${dmgPng.length} bytes)`);

  // 6. Windows NSIS Wizard Header BMP (150x57)
  const nsisBmp = generateNsisHeader();
  const nsisBmpPath = path.join(assetsDir, 'installer-header.bmp');
  fs.writeFileSync(nsisBmpPath, nsisBmp);
  console.log(`✓ Generated: ${nsisBmpPath} (${nsisBmp.length} bytes)`);

  // 7. Web Favicons (relay-server/public and main/dist)
  const faviconPng = generateFaviconPng();
  const faviconIco = png2icons.createICO(faviconPng, png2icons.BILINEAR, 0, true, false) || faviconPng;

  const favTargets = [
    { dir: relayPublicDir, name: 'relay-server/public' },
    { dir: gameDistDir, name: 'main/dist' }
  ];

  for (const target of favTargets) {
    const pngPath = path.join(target.dir, 'favicon.png');
    const icoPath = path.join(target.dir, 'favicon.ico');
    fs.writeFileSync(pngPath, faviconPng);
    fs.writeFileSync(icoPath, faviconIco || faviconPng);
    console.log(`✓ Exported favicons to ${target.name}/`);
  }

  console.log('--- Native Icon & Asset Generation Complete ---');
}

// Run directly if invoked from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGenerateIcons().catch((err) => {
    console.error('Error generating icons:', err);
    process.exit(1);
  });
}
