#!/usr/bin/env node
// Turns the exported UI sheets in art/export/ui/ into the PNGs the page's CSS
// draws: buttons, frames, plates, gauges, icons, the logo and the phone.
//
//   node tools/art/build-ui.js          rebuild art/ui/
//   node tools/art/build-ui.js --check  exit 1 if art/ui/ is out of date
//
// Each frame of art/export/ui/<name>.png becomes art/ui/<name>--<frame>.png,
// scaled 2x nearest-neighbour (one art pixel = 2 CSS px, STYLE 8.2), so CSS
// can use it as a background or a border-image with whole-pixel slices
// (slice = 2 x the art inset) and the browser never has to resample it.
// ':' in a frame name becomes '-'. The favicons and the logo are written at 1x (the logo's CSS picks 2x or 3x).
//
// Unlike the cutscene art (js/art/sprite-data.js), nothing reads these pixels
// back, so plain PNGs work from a file:// page.
'use strict';
const fs = require('fs');
const path = require('path');
const PNG = require('./png');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art', 'export', 'ui');
const OUT = path.join(ROOT, 'art', 'ui');
const ONE_X = new Set(['favicon-16', 'favicon-32', 'logo', 'logo-closed']); // the logo picks its own whole scale per breakpoint

function build() {
  const files = {};
  for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
    const name = f.slice(0, -4), meta = JSON.parse(fs.readFileSync(path.join(SRC, name + '.json'), 'utf8'));
    const img = PNG.read(fs.readFileSync(path.join(SRC, f)));
    const k = ONE_X.has(name) ? 1 : 2;
    for (const fr of meta.frames) {
      const r = fr.frame, W = r.w * k, H = r.h * k, px = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (((r.y + Math.floor(y / k)) * img.w) + r.x + Math.floor(x / k)) * 4, d = (y * W + x) * 4;
        px[d] = img.px[o]; px[d + 1] = img.px[o + 1]; px[d + 2] = img.px[o + 2]; px[d + 3] = img.px[o + 3] < 128 ? 0 : 255;
      }
      const frame = meta.frames.length === 1 ? 'base' : fr.filename;
      files[`${name}--${String(frame).replace(/:/g, '-')}.png`] = PNG.write(W, H, px);
    }
  }
  return files;
}

if (require.main === module) {
  const files = build();
  const have = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')) : [];
  if (process.argv.includes('--check')) {
    // Compare decoded pixels, not PNG bytes: zlib output can differ between Node versions.
    const same = (a, b) => { const x = PNG.read(a), y = PNG.read(b); return x.w === y.w && x.h === y.h && Buffer.from(x.px).equals(Buffer.from(y.px)); };
    const bad = Object.keys(files).filter((f) => !have.includes(f) || !same(fs.readFileSync(path.join(OUT, f)), files[f]))
      .concat(have.filter((f) => !files[f]));
    if (bad.length) { console.error('art/ui/ is out of date (' + bad.slice(0, 5).join(', ') + '): run node tools/art/build-ui.js'); process.exit(1); }
    console.log('art/ui/ is up to date (' + have.length + ' files)');
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of have) if (!files[f]) fs.unlinkSync(path.join(OUT, f));
    for (const f of Object.keys(files)) fs.writeFileSync(path.join(OUT, f), files[f]);
    console.log('wrote ' + Object.keys(files).length + ' files to art/ui/');
  }
}
module.exports = { build };
