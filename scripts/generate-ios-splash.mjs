// iOS launch images (no deps). Run: node scripts/generate-ios-splash.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(dir, "..", "public");

function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(t, d) {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(d.length, 0);
  const tb = Buffer.from(t, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0);
  return Buffer.concat([l, tb, d, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const data = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) raw.copy(data, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(data, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function inRR(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x0 + w - r, x));
  const cy = Math.max(y0 + r, Math.min(y0 + h - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function splash(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const s = w / 375;
  const iw = 120 * s, ih = 82 * s, ix = (w - iw) / 2, iy = (h - ih) / 2 - 20 * s, rad = 18 * s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (inRR(x, y, ix, iy, iw, ih, rad)) {
        buf[i] = 79; buf[i + 1] = 140; buf[i + 2] = 255; buf[i + 3] = 255;
      } else {
        buf[i] = 11; buf[i + 1] = 15; buf[i + 2] = 20; buf[i + 3] = 255;
      }
    }
  }
  return png(w, h, buf);
}
mkdirSync(OUT, { recursive: true });
const specs = [
  ["splash-iphone-se.png", 750, 1334],
  ["splash-iphone-8-plus.png", 1242, 2208],
  ["splash-iphone-x.png", 1125, 2436],
  ["splash-iphone-xs-max.png", 1242, 2688],
  ["splash-iphone-xr.png", 828, 1792],
  ["splash-iphone-12-13-14.png", 1170, 2532],
  ["splash-iphone-12-13-14-pro-max.png", 1284, 2778],
  ["splash-iphone-14-15-pro.png", 1179, 2556],
  ["splash-iphone-14-15-pro-max.png", 1290, 2796],
  ["splash-iphone-16-pro-max.png", 1320, 2868],
  ["splash-ipad-11.png", 1668, 2388],
  ["splash-ipad-12-9.png", 2048, 2732],
];
for (const [f, w, h] of specs) {
  writeFileSync(join(OUT, f), splash(w, h));
  console.log("wrote", f);
}
console.log("iOS splash images generated in", OUT);