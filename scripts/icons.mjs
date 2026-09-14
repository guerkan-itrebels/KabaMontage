// Erzeugt die PWA-Icons (PNG) aus der Bildmarke des Logos – ohne zusätzliche Abhängigkeiten.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [15, 28, 46];
const WEISS = [255, 255, 255];
const AMBER = [242, 169, 0];

function pfad(d) {
  const t = d.match(/[MLCZ]|-?\d+(\.\d+)?/g);
  const pts = [];
  let i = 0, cur = [0, 0];
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { cur = [+t[i++], +t[i++]]; pts.push(cur); }
    else if (c === 'C') {
      const p1 = [+t[i++], +t[i++]], p2 = [+t[i++], +t[i++]], p3 = [+t[i++], +t[i++]];
      const p0 = cur;
      for (let s = 1; s <= 16; s++) {
        const u = s / 16, v = 1 - u;
        pts.push([0, 1].map((k) => v*v*v*p0[k] + 3*v*v*u*p1[k] + 3*v*u*u*p2[k] + u*u*u*p3[k]));
      }
      cur = p3;
    }
  }
  return pts;
}
const linie = (x1, y1, x2, y2, w) => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = (-dy / l) * w / 2, ny = (dx / l) * w / 2;
  return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
};
function innen(poly, x, y) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

const hammer = [
  pfad('M108 62 C130 22 180 18 222 38 L246 50 L238 80 L212 72 L200 60 C172 46 140 48 108 62 Z'),
  pfad('M200 62 L226 76 L128 244 L104 244 L100 227 Z'),
  pfad('M36 228 C38 205 52 190 72 182 L88 192 L62 232 Z'),
];
const keil = pfad('M156 234 L300 78 L300 234 Z');
const keilInnen = pfad('M186 220 L288 109 L288 220 Z');
const streifen = [160, 190, 220, 250, 280].map((x) => linie(x, 232, x + 200, 15, 13));

function farbe(x, y) {
  if (innen(keil, x, y)) {
    if (innen(keilInnen, x, y) && streifen.some((s) => innen(s, x, y))) return NAVY;
    return AMBER;
  }
  if (hammer.some((h) => innen(h, x, y))) return WEISS;
  return NAVY;
}

function png(groesse, datei, rand) {
  const box = { x: 36, y: 18, w: 264, h: 234 };
  const nutz = groesse * (1 - 2 * rand);
  const s = nutz / Math.max(box.w, box.h);
  const ox = (groesse - box.w * s) / 2 - box.x * s;
  const oy = (groesse - box.h * s) / 2 - box.y * s;
  const SS = 4;
  const roh = Buffer.alloc((groesse * 3 + 1) * groesse);
  for (let py = 0; py < groesse; py++) {
    roh[py * (groesse * 3 + 1)] = 0;
    for (let px = 0; px < groesse; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = farbe((px + (sx + 0.5) / SS - ox) / s, (py + (sy + 0.5) / SS - oy) / s);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = py * (groesse * 3 + 1) + 1 + px * 3;
      roh[o] = r / SS / SS; roh[o + 1] = g / SS / SS; roh[o + 2] = b / SS / SS;
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (typ, daten) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(daten.length);
    const td = Buffer.concat([Buffer.from(typ), daten]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0); ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(datei, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(roh)), chunk('IEND', Buffer.alloc(0)),
  ]));
  console.log('geschrieben:', datei);
}

png(192, 'public/icon-192.png', 0.2);
png(512, 'public/icon-512.png', 0.2);
png(180, 'public/apple-touch-icon.png', 0.14);
