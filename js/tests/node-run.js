// Headless test runner: node js/tests/node-run.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const store = {};
const ctx = {
  console, Math, Date, JSON, Intl, performance: { now: () => Date.now() },
  setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  }
};
ctx.window = ctx;
vm.createContext(ctx);

const run = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

[
  'js/core/util.js', 'js/core/rng.js', 'js/core/events.js', 'js/core/storage.js', 'js/core/save.js', 'js/core/clock.js',
  'js/art/palette.js', 'js/art/pixel.js', 'js/art/scenes.js', 'js/art/rhythm.js',
  'js/market/tickers.js', 'js/market/engine.js', 'js/market/news.js',
  'js/trading/options.js', 'js/trading/broker.js', 'js/stress.js',
  'js/audio/sfx.js', 'js/audio/music.js', 'js/interrupts.js', 'js/game.js'
].forEach(run);

// Headless stand-ins for everything that needs a DOM.
vm.runInContext(`
  const B = window.BTB;
  B.Settings = {
    get: () => ({ storyDayLength: 180, effects: 'off', cinematics: 'off' }),
    set: () => {}, fx: () => 0, motion: () => false, apply: () => {}
  };
  B.Cinematic = { running: false, play: (n, o, cb) => cb && cb() };
  B.Screens = { briefing: (g, b, cb) => cb && cb(), eod: (g, r, cb) => cb && cb(), choice: () => {}, aftermath: (t, x, cb) => cb && cb(), ending: () => {}, closeModal: () => {} };
`, ctx);

['js/modes/story/story-data.js', 'js/modes/story/patch3-data.js', 'js/modes/story/endings.js', 'js/modes/story/patch3-endings.js', 'js/modes/story/story-engine.js', 'js/tests/tests.js'].forEach(run);

const res = ctx.BTB.Tests.results;
let fail = 0;
for (const r of res) {
  if (r.ok) console.log('  PASS  ' + r.name);
  else { fail++; console.log('  FAIL  ' + r.name + '\n        ' + r.err); }
}
if (ctx.BTB.__storyReach) console.log('\nStory paths explored:', ctx.BTB.__storyReach.paths, '\nEnding reach counts:', JSON.stringify(ctx.BTB.__storyReach.reached));
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
