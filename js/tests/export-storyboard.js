// Export every authored storyboard beat at its native 640x360 resolution.
// NODE_PATH=<runtime node_modules> node js/tests/export-storyboard.js <output dir>
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.join(__dirname, '..', '..');
const output = path.resolve(process.argv[2] || path.join(root, 'qa', 'storyboard-export'));
fs.mkdirSync(output, { recursive: true });
for (const group of ['news', 'phone', 'close', 'weekends', 'endings', 'decisions', 'variants', 'housing'])
  fs.rmSync(path.join(output, group), { recursive: true, force: true });
const context = { console, Math, Date, JSON, Intl, performance };
context.window = context; vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }); }
[
  'js/core/util.js', 'js/core/rng.js', 'js/core/clock.js',
  'js/art/palette.js', 'js/art/pixel.js', 'js/art/portraits.js',
  'js/art/scenes.js', 'js/art/rhythm.js', 'js/art/storyboard.js', 'js/art/decisions.js',
  'js/market/tickers.js', 'js/market/sqwak.js',
  'js/modes/story/story-data.js', 'js/modes/story/patch3-data.js', 'js/modes/story/sqwak-story.js',
  'js/modes/story/endings.js', 'js/modes/story/patch3-endings.js',
  'js/modes/story/economy.js', 'js/modes/story/life.js'
].forEach(load);
const B = context.BTB, V = B.Rhythm.view, manifest = [], previews = {};
const safe = value => String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
function save(group, name, beat, opts) {
  const canvas = createCanvas(V.w, V.h), c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  beat.draw(c, V, 1, opts || {});
  const dir = path.join(output, group); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(group, safe(name) + '.png');
  fs.writeFileSync(path.join(output, file), canvas.toBuffer('image/png'));
  manifest.push({ file, id: beat.id || null, line: beat.line || '', width: V.w, height: V.h });
  previews[group] ||= []; previews[group].push({ name, canvas });
}
function exportBeats(group, name, beats, opts) {
  beats.forEach((beat, index) => save(group, `${name}-${String(index + 1).padStart(2, '0')}-${beat.id || 'beat'}`, beat, opts));
}
for (let day = 0; day < 61; day++) {
  const d = B.StoryData.DAYS[day], name = `session-${String(day + 1).padStart(2, '0')}`;
  const o = { day, brief: { title: d.title, feed: d.feed || [] } };
  exportBeats('news', name, B.Scenes.news(o), o);
  exportBeats('phone', name, B.Scenes.phone(o), o);
  exportBeats('close', name, B.Scenes.close({ report: { day, pnl: 0, equity: 250000, quota: 0 } }), o);
}
for (let day = 4; day < 60; day += 5) {
  const o = { day };
  exportBeats('weekends', `after-session-${String(day + 1).padStart(2, '0')}`, B.Scenes.weekend(o), o);
}
for (const ending of B.StoryEndings.list) {
  const o = { id: ending.id, title: ending.title, deck: ending.deck, dark: false };
  exportBeats('endings', ending.id, B.Scenes.ending(o), o);
}
for (const [id, c] of Object.entries(B.StoryData.CHOICES)) {
  if (!B.DecisionArt.ROOMS[id]) continue; // two decisions occur in other scene systems
  const o = { id, day: c.day, speaker: c.speaker, role: c.role, title: c.title, S: { f: {} } };
  exportBeats('decisions', id, B.Scenes.decision(o), o);
}
for (const life of B.Life.LIFE) {
  const o = { id: life.id, day: life.day, speaker: life.speaker, role: life.role, title: life.title, S: { f: {} } };
  exportBeats('decisions', life.id, B.Scenes.decision(o), o);
}
// Branch-sensitive mornings and the housing ladder are separately visible.
for (const [day, S, label] of [
  [10, { choices: { c1: 'dump' }, f: {} }, 'pension-dump'],
  [10, { choices: { c1: 'leak' }, f: {} }, 'pension-leak'],
  [35, { choices: { c5: 'fail' }, f: {} }, 'rescue-fail'],
  [35, { choices: { c5: 'ban' }, f: {} }, 'short-ban'],
  [35, { choices: { c5: 'bail' }, f: {} }, 'rescue-bail'],
  [55, { choices: {}, f: { billPassed: true } }, 'bill-passes'],
  [60, { choices: {}, f: { pulledPlug: true } }, 'plug-pulled']
]) {
  const o = { day, brief: { title: B.StoryData.DAYS[day].title }, game: { mode: { S } } };
  exportBeats('variants', label, B.Scenes.news(o), o);
}
for (const [tier, id] of Object.keys(B.Storyboard.HOMES).entries()) {
  const wallet = { tier, lateWeeks: id === 'couch' ? 3 : 0 };
  const o = { day: 49, game: { mode: { S: { wallet, f: {} } } } };
  exportBeats('housing', id, B.Scenes.weekend(o).slice(0, 2), o);
}
function contact(name, group, choose, columns) {
  const items = (previews[group] || []).filter(choose), tw = 320, th = 180, pad = 22, cols = columns || 5;
  const rows = Math.ceil(items.length / cols), cv = createCanvas(cols * (tw + pad), rows * (th + pad));
  const c = cv.getContext('2d'); c.fillStyle = '#171922'; c.fillRect(0, 0, cv.width, cv.height);
  c.font = '12px sans-serif'; c.textBaseline = 'top';
  items.forEach(({ name, canvas }, i) => {
    const x = (i % cols) * (tw + pad), y = Math.floor(i / cols) * (th + pad);
    c.drawImage(canvas, x, y, tw, th); c.fillStyle = '#ded8ca'; c.fillText(name.slice(0, 48), x + 3, y + th + 4);
  });
  fs.writeFileSync(path.join(output, name + '.png'), cv.toBuffer('image/png'));
}
contact('contact-news', 'news', x => /establish|detail/.test(x.name), 5);
contact('contact-weekends', 'weekends', x => /sat|sun/.test(x.name), 4);
contact('contact-endings', 'endings', x => /card/.test(x.name), 4);
contact('contact-decisions', 'decisions', () => true, 4);
contact('contact-housing', 'housing', () => true, 4);
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ generatedFrom: 'Bell to Bell storyboard', count: manifest.length, panels: manifest }, null, 2));
fs.writeFileSync(path.join(output, 'README.txt'), `Bell to Bell storyboard panel export\n${manifest.length} frames at ${V.w}x${V.h}.\nOpen the contact sheets for an overview. The folders hold every exported beat at native resolution.\nThe variants folder holds choice-sensitive mornings. The housing folder shows each home tier.\nAll plot lines and decision text come from the existing game content.\n`);
console.log(`Exported ${manifest.length} frames and five contact sheets to ${output}`);
