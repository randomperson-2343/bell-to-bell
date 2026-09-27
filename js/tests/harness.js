// Shared headless loader for the node runners.
//
// The script order comes from index.html, so a file added, renamed or
// removed there is picked up here without editing every runner. Files that
// need a real DOM (the UI, the menu, the cinematic player, the desk canvas)
// are never loaded headless.
//
//   const { load, STUBS } = require('./harness');
//   const B = load({ groups: ['core', 'market', 'trading', 'story'], setup: STUBS.story }).BTB;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');

const DOM_ONLY = /^js\/ui\/|^js\/main\.js$|^js\/art\/cinematic\.js$|^js\/art\/story-art\.js$/;
const GROUP = (f) => {
  if (f.startsWith('js/core/')) return 'core';
  if (f.startsWith('js/art/')) return 'art';
  if (f.startsWith('js/market/')) return 'market';
  if (f.startsWith('js/trading/')) return 'trading';
  if (f.startsWith('js/modes/story/')) return 'story';
  if (f.startsWith('js/modes/endless/')) return 'endless';
  return 'game'; // stress, audio, interrupts, game.js
};

function scripts() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !DOM_ONLY.test(f));
}

// Headless stand-ins, run just before the first game-mode file loads.
const SETTINGS = `B.Settings = {
  get: () => ({ storyDayLength: 180, effects: 'off', cinematics: 'off' }),
  set: () => {}, fx: () => 0, motion: () => false, apply: () => {}
};`;
const NOOP = (name) => `B.${name} = new Proxy({}, { get: () => () => {} });`;
const STUBS = {
  SETTINGS,
  // A full game with its screens answered at once (unit tests).
  game: `${SETTINGS}
B.Cinematic = { running: false, play: (n, o, cb) => cb && cb() };
B.Screens = { briefing: (g, b, cb) => cb && cb(), eod: (g, r, cb) => cb && cb(), choice: () => {}, aftermath: (t, x, cb) => cb && cb(), ending: () => {}, closeModal: () => {} };`,
  // StoryMode driven directly, with no game loop or screens.
  story: `${SETTINGS}
${NOOP('UI')} ${NOOP('SFX')} ${NOOP('Music')}
B.Screens = {};`
};

// groups: which parts of the game to load, in index.html order.
// setup: JS run with B = window.BTB before the first js/modes/ file.
// extra: files loaded last, after the game (a test suite, say).
function load(o) {
  const want = new Set(o.groups);
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
  let setupDone = !o.setup;
  for (const f of scripts()) {
    if (!want.has(GROUP(f))) continue;
    if (!setupDone && f.startsWith('js/modes/')) {
      vm.runInContext(`(function (B) {\n${o.setup}\n})(window.BTB);`, ctx);
      setupDone = true;
    }
    run(f);
  }
  if (!setupDone) vm.runInContext(`(function (B) {\n${o.setup}\n})(window.BTB);`, ctx);
  (o.extra || []).forEach(run);
  return ctx;
}

module.exports = { load, STUBS, root, scripts };
