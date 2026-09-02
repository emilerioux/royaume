// Génère les icônes PWA (château médiéval) sans dépendance — zlib natif de Node.
const zlib = require("zlib");
const fs = require("fs");

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
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// dessin 16x16 : s ciel, k pierre, l pierre claire, g herbe, d porte, f drapeau, p mât
const ART = [
  "ssssssssssssssss",
  "ssssssssssssssss",
  "sssssssssspffsss",
  "sssssssssspffsss",
  "sssssssssspsssss",
  "skskskskskskskss",
  "skkkkkkkkkkkksss",
  "skkkkkkkkkkkksss",
  "sklkkkkkkkkklkss",
  "skkkkkkkkkkkksss",
  "skkkkkddkkkkksss",
  "skkkkkddkkkkksss",
  "skkkkkddkkkkksss",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];

const PAL = {
  s: null,
  k: [122, 128, 140],
  l: [176, 182, 194],
  g: [46, 82, 46],
  d: [40, 30, 22],
  f: [176, 42, 42],
  p: [90, 66, 40],
};

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cell = size / 16;
  const radius = size * 0.17;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // coins arrondis
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx < radius && cy < radius) {
        const dx = radius - cx, dy = radius - cy;
        if (dx * dx + dy * dy > radius * radius) { buf[i + 3] = 0; continue; }
      }
      const gx = Math.min(15, Math.floor(x / cell));
      const gy = Math.min(15, Math.floor(y / cell));
      const ch = ART[gy][gx];
      let col = PAL[ch];
      if (!col) {
        // ciel dégradé nuit
        const t = y / size;
        col = [Math.round(26 + t * 10), Math.round(35 + t * 18), Math.round(56 + t * 20)];
      }
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

for (const s of [180, 192, 512]) {
  fs.writeFileSync(`icons/icon-${s}.png`, makeIcon(s));
  console.log(`icons/icon-${s}.png`);
}
