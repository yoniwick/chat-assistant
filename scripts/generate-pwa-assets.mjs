// Generates PWA icons (no external deps). Run: node scripts/generate-pwa-assets.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public");

function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (c) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

// Point inside rounded rect?
function inRR(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x0 + w - r, x));
  const cy = Math.max(y0 + r, Math.min(y0 + h - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Point inside triangle?
function inTri(px, py, a, b, c) {
  const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
  const d1 = s([px, py], a, b), d2 = s([px, py], b, c), d3 = s([px, py], c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// Draw a blue chat bubble. bg=null -> transparent background.
function drawIcon(size, { bg = null, color = "#4f8cff" } = {}) {
  const [fr, fg, fb] = hex(color);
  const [br, bg_, bb] = bg ? hex(bg) : [0, 0, 0];
  const px = Buffer.alloc(size * size * 4);
  const s = size / 512;
  const bw = 320 * s, bh = 220 * s;
  const bx = (size - bw) / 2, by = (size - bh) / 2 - 20 * s;
  const rad = 48 * s;
  const tail = [
    [size / 2 - 40 * s, by + bh],
    [size / 2 + 40 * s, by + bh],
    [size / 2, by + bh + 70 * s],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const isIcon = inRR(x, y, bx, by, bw, bh, rad) || inTri(x, y, tail[0], tail[1], tail[2]);
      if (isIcon) {
        px[i] = fr; px[i + 1] = fg; px[i + 2] = fb; px[i + 3] = 255;
      } else if (bg) {
        px[i] = br; px[i + 1] = bg_; px[i + 2] = bb; px[i + 3] = 255;
      }
    }
  }
  return png(size, size, px);
}

mkdirSync(OUT, { recursive: true });
for (const s of [48, 72, 96, 128, 144, 152, 192, 384, 512]) {
  writeFileSync(join(OUT, `icon-${s}x${s}.png`), drawIcon(s));
}
for (const s of [192, 512]) {
  writeFileSync(join(OUT, `maskable-${s}x${s}.png`), drawIcon(s, { bg: "#0b0f14" }));
}
writeFileSync(join(OUT, "apple-touch-icon.png"), drawIcon(180, { bg: "#0b0f14" }));
console.log("PWA icons generated in", OUT);