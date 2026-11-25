#!/usr/bin/env node
// Pixel grids: the text form of a sprite, one character per pixel, using the
// palette keys from js/art/palette.js ('.' is transparent). A grid file holds
// one or more frames:
//
//   # comments start with #
//   @frame open
//   ....0000....
//   ...
//   @frame closed
//   ...
//
// Commands:
//   grid.js check   <file.grid>                     sizes, keys, colour count
//   grid.js png     <file.grid> <out.png>            frames side by side at 1x (what Aseprite imports)
//   grid.js preview <file.grid> <out.png> [scale]    1x, 3x and a big zoom with a pixel grid, for looking at
//   grid.js frompng <in.png> <out.grid> [frameW]     back from a PNG (a frame strip is split every frameW px)
'use strict';
const fs = require('fs');
const path = require('path');
const PNG = require('./png');

const ROOT = path.join(__dirname, '..', '..');

function palette() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'art', 'palette.js'), 'utf8');
  const hex = {}; for (const m of src.matchAll(/(\w+): '#([0-9a-f]{6})'/g)) hex[m[1]] = m[2];
  const keys = {}; for (const m of src.matchAll(/'(.)': P\.(\w+)/g)) keys[m[1]] = hex[m[2]];
  const rgb = {}; for (const k of Object.keys(keys)) rgb[k] = [0, 2, 4].map((i) => parseInt(keys[k].slice(i, i + 2), 16));
  const byRgb = {}; for (const k of Object.keys(rgb)) byRgb[rgb[k].join(',')] = k;
  return { keys, rgb, byRgb };
}

function parse(text) {
  const frames = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@frame')) { cur = { name: line.slice(6).trim() || String(frames.length), rows: [] }; frames.push(cur); continue; }
    if (!cur) { cur = { name: '0', rows: [] }; frames.push(cur); }
    cur.rows.push(line.trim());
  }
  return frames;
}

function check(frames, pal, file) {
  const errs = [];
  const w = frames[0].rows[0].length, h = frames[0].rows.length;
  frames.forEach((f) => {
    if (f.rows.length !== h) errs.push(`frame ${f.name}: ${f.rows.length} rows, expected ${h}`);
    f.rows.forEach((r, y) => {
      if (r.length !== w) errs.push(`frame ${f.name} row ${y}: ${r.length} wide, expected ${w}`);
      for (let x = 0; x < r.length; x++) if (r[x] !== '.' && !pal.keys[r[x]]) errs.push(`frame ${f.name} row ${y} col ${x}: '${r[x]}' is not a palette key`);
    });
  });
  if (errs.length) { console.error((file || 'grid') + ':\n  ' + errs.slice(0, 30).join('\n  ')); process.exit(1); }
  return { w, h };
}

function toRgba(frames, pal, w, h, scale, gap) {
  scale = scale || 1; gap = gap || 0;
  const W = frames.length * w * scale + (frames.length - 1) * gap, H = h * scale, px = new Uint8Array(W * H * 4);
  frames.forEach((f, i) => {
    const ox = i * (w * scale + gap);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = f.rows[y][x]; if (k === '.') continue;
      const c = pal.rgb[k];
      for (let j = 0; j < scale; j++) for (let q = 0; q < scale; q++) { const o = ((y * scale + j) * W + ox + x * scale + q) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
    }
  });
  return { W, H, px };
}

function preview(frames, pal, w, h, big) {
  big = big || Math.max(4, Math.floor(720 / h));
  const bg = [60, 67, 84], pad = 8;
  const views = [1, 3, big];
  const colW = views.map((s) => frames.length * w * s + (frames.length - 1) * pad);
  const W = Math.max(...colW) + pad * 2, H = views.reduce((a, s) => a + h * s + pad, pad);
  const px = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
  let oy = pad;
  for (const s of views) {
    const im = toRgba(frames, pal, w, h, s, pad);
    for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) {
      const i = (y * im.W + x) * 4; if (!im.px[i + 3]) continue;
      const o = ((oy + y) * W + pad + x) * 4;
      let r = im.px[i], g = im.px[i + 1], b = im.px[i + 2];
      if (s >= 6 && (x % s === 0 || y % s === 0)) { r = r * 0.82; g = g * 0.82; b = b * 0.82; } // faint pixel grid on the zoom
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
    oy += h * s + pad;
  }
  return PNG.write(W, H, px);
}

function fromPng(buf, pal, frameW) {
  const { w, h, px } = PNG.read(buf), fw = frameW || w, n = Math.floor(w / fw), frames = [], bad = new Set();
  for (let f = 0; f < n; f++) {
    const rows = [];
    for (let y = 0; y < h; y++) {
      let r = '';
      for (let x = 0; x < fw; x++) {
        const o = (y * w + f * fw + x) * 4;
        if (px[o + 3] < 128) { r += '.'; continue; }
        const k = pal.byRgb[`${px[o]},${px[o + 1]},${px[o + 2]}`];
        if (!k) { bad.add(`#${[px[o], px[o + 1], px[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`); r += '.'; continue; }
        r += k;
      }
      rows.push(r);
    }
    frames.push({ name: String(f), rows });
  }
  return { frames, bad: [...bad] };
}

module.exports = { palette, parse, check, toRgba, preview, fromPng };

if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  const pal = palette();
  if (cmd === 'frompng') {
    const r = fromPng(fs.readFileSync(a), pal, c ? +c : 0);
    if (r.bad.length) { console.error('colours outside the palette: ' + r.bad.join(' ')); process.exit(1); }
    fs.writeFileSync(b, r.frames.map((f) => `@frame ${f.name}\n${f.rows.join('\n')}`).join('\n') + '\n');
    process.exit(0);
  }
  const frames = parse(fs.readFileSync(a, 'utf8'));
  const { w, h } = check(frames, pal, a);
  if (cmd === 'check') {
    const used = new Set(frames.flatMap((f) => f.rows.join('').split('')).filter((k) => k !== '.'));
    const filled = frames[0].rows.join('').replace(/\./g, '').length;
    console.log(`${a}: ${frames.length} frame(s) ${w}x${h}, ${used.size} colours [${[...used].sort().join('')}], ${filled} filled pixels in frame 1`);
  } else if (cmd === 'png') {
    const im = toRgba(frames, pal, w, h, 1, 0); fs.writeFileSync(b, PNG.write(im.W, im.H, im.px));
  } else if (cmd === 'preview') {
    fs.writeFileSync(b, preview(frames, pal, w, h, c ? +c : 0));
  } else { console.error('usage: grid.js check|png|preview|frompng ...'); process.exit(2); }
}
