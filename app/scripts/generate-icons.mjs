// Generates the PWA app icons with no external dependencies.
// Draws a rounded purple tile with a simple white "house" mark.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function draw(size, padScale) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22; // rounded corners
  const pad = size * padScale; // safe area for maskable
  const inner = size - pad * 2;

  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  const insideRounded = (x, y) => {
    const minX = pad,
      minY = pad,
      maxX = size - pad,
      maxY = size - pad;
    if (x < minX || y < minY || x >= maxX || y >= maxY) return false;
    const dx = Math.min(x - minX, maxX - 1 - x);
    const dy = Math.min(y - minY, maxY - 1 - y);
    if (dx < radius && dy < radius) {
      const cx = dx < radius ? minX + radius : x;
      const cy = dy < radius ? minY + radius : y;
      void cx;
      void cy;
    }
    // simple corner rounding
    const rx = x < minX + radius ? minX + radius : x > maxX - radius ? maxX - radius : x;
    const ry = y < minY + radius ? minY + radius : y > maxY - radius ? maxY - radius : y;
    const ddx = x - rx;
    const ddy = y - ry;
    return ddx * ddx + ddy * ddy <= radius * radius;
  };

  // House geometry (centered in the inner area)
  const cx = size / 2;
  const roofTopY = pad + inner * 0.24;
  const roofBaseY = pad + inner * 0.5;
  const bodyBottomY = size - pad - inner * 0.18;
  const halfW = inner * 0.3;
  const bodyLeft = cx - inner * 0.22;
  const bodyRight = cx + inner * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!insideRounded(x, y)) {
        set(x, y, 0, 0, 0, 0);
        continue;
      }
      // gradient background (purple -> violet)
      const t = (y - pad) / inner;
      const r = lerp(0x6d, 0x8b, t);
      const g = lerp(0x5e, 0x7d, t);
      const b = lerp(0xfc, 0xff, t);
      set(x, y, r, g, b, 255);

      // white house mark
      let house = false;
      if (y >= roofTopY && y <= roofBaseY) {
        const spread = (halfW * (y - roofTopY)) / (roofBaseY - roofTopY);
        if (x >= cx - spread && x <= cx + spread) house = true;
      }
      if (y > roofBaseY && y <= bodyBottomY && x >= bodyLeft && x <= bodyRight) {
        house = true;
      }
      // door cut-out
      const doorTop = bodyBottomY - inner * 0.16;
      if (
        y > doorTop &&
        y <= bodyBottomY &&
        x > cx - inner * 0.06 &&
        x < cx + inner * 0.06
      ) {
        house = false;
      }
      if (house) set(x, y, 0xff, 0xff, 0xff, 255);
    }
  }
  return encodePNG(size, size, buf);
}

// ---- geometry helpers for the notification icons ----

// Signed distance to a rounded rectangle centered at (cx, cy).
function roundedRectDist(x, y, cx, cy, halfW, halfH, r) {
  const dx = Math.abs(x - cx) - halfW + r;
  const dy = Math.abs(y - cy) - halfH + r;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

// Multi-stop gradient sample. stops = [[t, [r,g,b]], ...] with t in 0..1.
function multiStop(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return stops[stops.length - 1][1];
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Instagram-style icon: gradient tile + white camera outline, lens ring, flash dot.
function drawInstagram(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bgRadius = size * 0.24;
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  // Instagram's signature warm-to-cool diagonal gradient.
  const stops = [
    [0.0, [254, 218, 117]],
    [0.25, [250, 126, 30]],
    [0.5, [214, 41, 118]],
    [0.75, [150, 47, 191]],
    [1.0, [79, 91, 213]],
  ];
  const cx = size / 2;
  const cy = size / 2;
  const bodyHalf = size * 0.26;
  const bodyStroke = size * 0.075;
  const lensR = size * 0.155;
  const lensStroke = size * 0.07;
  const dotR = size * 0.032;
  const dotX = cx + size * 0.145;
  const dotY = cy - size * 0.145;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const outer = roundedRectDist(x, y, cx, cy, size / 2, size / 2, bgRadius);
      if (outer > 0) {
        set(x, y, 0, 0, 0, 0);
        continue;
      }
      const t = (x + (size - y)) / (2 * size); // bottom-left -> top-right
      const [r, g, b] = multiStop(stops, t);
      set(x, y, r, g, b, 255);

      // white camera body outline
      const body = roundedRectDist(x, y, cx, cy, bodyHalf, bodyHalf, size * 0.14);
      let white = Math.abs(body) <= bodyStroke / 2;
      // lens ring
      const dl = Math.hypot(x - cx, y - cy);
      if (Math.abs(dl - lensR) <= lensStroke / 2) white = true;
      // flash dot
      if (Math.hypot(x - dotX, y - dotY) <= dotR) white = true;
      if (white) set(x, y, 255, 255, 255, 255);
    }
  }
  return encodePNG(size, size, buf);
}

// Flashy personal icon: neon radial tile + bold white lightning bolt.
function drawFlashy(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bgRadius = size * 0.24;
  const cx = size / 2;
  const cy = size / 2;
  const maxD = Math.hypot(size / 2, size / 2);
  const bolt = [
    [0.58, 0.06],
    [0.3, 0.54],
    [0.48, 0.54],
    [0.4, 0.94],
    [0.74, 0.4],
    [0.54, 0.4],
    [0.64, 0.06],
  ];
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roundedRectDist(x, y, cx, cy, size / 2, size / 2, bgRadius) > 0) {
        set(x, y, 0, 0, 0, 0);
        continue;
      }
      // radial neon: hot yellow core -> electric magenta edge
      const t = Math.hypot(x - cx, y - cy) / maxD;
      const [r, g, b] = multiStop(
        [
          [0.0, [255, 242, 0]],
          [0.55, [255, 94, 0]],
          [1.0, [255, 0, 200]],
        ],
        t,
      );
      set(x, y, r, g, b, 255);
      if (pointInPoly(x / size, y / size, bolt)) {
        set(x, y, 255, 255, 255, 255);
      }
    }
  }
  return encodePNG(size, size, buf);
}

writeFileSync(join(OUT, "icon-512.png"), draw(512, 0.04));
writeFileSync(join(OUT, "icon-192.png"), draw(192, 0.04));
writeFileSync(join(OUT, "icon-maskable-512.png"), draw(512, 0.12));
writeFileSync(join(OUT, "instagram-512.png"), drawInstagram(512));
writeFileSync(join(OUT, "instagram-192.png"), drawInstagram(192));
writeFileSync(join(OUT, "flashy-512.png"), drawFlashy(512));
writeFileSync(join(OUT, "flashy-192.png"), drawFlashy(192));
console.log("Wrote icons to", OUT);
