#!/usr/bin/env node
// Art pipeline, Aseprite in the middle.
//
//   node tools/art/pack.js <file.grid> <group>/<name>
//       grid -> art/src/<group>/<name>.aseprite (indexed, Faded Power palette, one
//       frame per @frame, tagged with the frame names) -> export -> rebuild sprite-data.js
//   node tools/art/pack.js --export-all
//       re-export every art/src/**/*.aseprite to art/export/ and rebuild sprite-data.js
//       (run this after editing any .aseprite by hand in Aseprite)
//
// Needs the Aseprite command line: set ASEPRITE=/path/to/aseprite (defaults to `aseprite` on PATH).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./grid');
const PNG = require('./png');

const ROOT = path.join(__dirname, '..', '..');
const ASE = process.env.ASEPRITE || 'aseprite';
const GPL = path.join(ROOT, 'art', 'palette', 'faded-power.gpl');
const ase = (args) => execFileSync(ASE, ['-b', ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function exportOne(src) {
  const rel = path.relative(path.join(ROOT, 'art', 'src'), src).replace(/\.aseprite$/, '');
  const out = path.join(ROOT, 'art', 'export', rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ase([src, '--sheet', out + '.png', '--sheet-type', 'horizontal', '--data', out + '.json', '--format', 'json-array', '--list-tags', '--filename-format', '{tag}']);
  // Keep the JSON stable across machines: no absolute paths, no app version.
  const j = JSON.parse(fs.readFileSync(out + '.json', 'utf8'));
  j.meta = { image: path.basename(out) + '.png', size: j.meta.size, frameTags: (j.meta.frameTags || []).map((t) => ({ name: t.name, from: t.from, to: t.to })) };
  j.frames = j.frames.map((f) => ({ filename: f.filename, frame: f.frame }));
  fs.writeFileSync(out + '.json', JSON.stringify(j, null, 1) + '\n');
  return rel;
}

function pack(gridFile, id) {
  const pal = G.palette(), frames = G.parse(fs.readFileSync(gridFile, 'utf8'));
  const { w, h } = G.check(frames, pal, gridFile);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btb-art-'));
  const strip = path.join(tmp, 'strip.png');
  const im = G.toRgba(frames, pal, w, h, 1, 0);
  fs.writeFileSync(strip, PNG.write(im.W, im.H, im.px));
  const src = path.join(ROOT, 'art', 'src', id + '.aseprite');
  fs.mkdirSync(path.dirname(src), { recursive: true });
  ase(['--script-param', 'strip=' + strip, '--script-param', 'fw=' + w, '--script-param', 'out=' + src, '--script-param', 'palette=' + GPL,
    '--script-param', 'tags=' + frames.map((f) => f.name).join(','), '--script-param', 'layer=' + path.basename(id),
    '--script', path.join(__dirname, 'aseprite', 'strip-to-aseprite.lua')]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return exportOne(src);
}

function all(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(path.join(dir, e.name)) : e.name.endsWith('.aseprite') ? [path.join(dir, e.name)] : [])); }

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--export-all') { for (const s of all(path.join(ROOT, 'art', 'src'))) console.log('exported ' + exportOne(s)); }
  else if (a.length === 2) console.log('packed ' + pack(a[0], a[1]));
  else { console.error('usage: pack.js <file.grid> <group>/<name> | --export-all'); process.exit(2); }
  execFileSync(process.execPath, [path.join(__dirname, 'build-sprites.js')], { stdio: 'inherit' });
}
module.exports = { pack, exportOne };
