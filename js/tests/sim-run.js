// Headless full-game simulation: node js/tests/sim-run.js
// Plays complete Story and Endless runs with a bot trader to catch runtime errors and check endings.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
function load() {
  const store = {};
  const ctx = {
    console, Math, Date, JSON, Intl, performance: { now: () => Date.now() },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.setTimeout = () => 0;
  const files = ['js/core/util.js', 'js/core/rng.js', 'js/core/events.js', 'js/core/storage.js', 'js/core/save.js', 'js/core/clock.js',
    'js/market/tickers.js', 'js/market/engine.js', 'js/market/news.js', 'js/trading/options.js', 'js/trading/broker.js',
    'js/stress.js', 'js/audio/sfx.js', 'js/audio/music.js', 'js/interrupts.js', 'js/game.js'];
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(`
    const B = window.BTB;
    B.Settings = {
      get: () => ({ storyDayLength: 180, effects: 'off', cinematics: 'off' }),
      set: () => {}, fx: () => 0, motion: () => false, apply: () => {}
    };
    const noop = () => {};
    B.UI = new Proxy({}, { get: (t, k) => (k === 'snapshotFeed' ? () => ({}) : noop) });
    B.Cinematic = { running: false, play: (n, o, cb) => cb && cb() };
    B.Screens = { pendingCb: null, result: null,
      briefing(g, b, cb) { this.pendingCb = cb; },
      eod(g, r, cb) { this.log.push(r); cb(); },
      choice(c, S, pick) { pick(this.policy(c)); },
      aftermath(t, x, cb) { cb(); },
      ending(g, e) { this.result = e; },
      closeModal() {},
      log: [] };
  `, ctx);
  for (const f of ['js/modes/story/story-data.js', 'js/modes/story/endings.js', 'js/modes/story/story-engine.js', 'js/modes/endless/endless.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.BTB;
}

function bot(B, g, rng, style) {
  const m = g.market, b = g.broker;
  if (g.interrupts.active && g.interrupts.active.state === 'ringing') g.interrupts.answer();
  const a = g.interrupts.active;
  if (a && a.kind === 'choice' && a.state === 'open') g.interrupts.resolveChoice(g.__policy[a.choiceId] || a.defaultOpt, false);
  for (const t of g.interrupts.tasks) if (!t.done && rng.next() < 0.2) g.interrupts.executeTask(t.id);
  if (g.act()) return;
  if (rng.next() < (style === 'yolo' ? 0.08 : 0.03)) {
    const syms = m.tickers.map((t) => t.sym);
    const sym = syms[Math.floor(rng.next() * syms.length)];
    const side = rng.next() < 0.5 ? 1 : -1;
    const q = Math.floor(b.maxQty(sym, side) * (style === 'yolo' ? 0.9 : 0.3));
    if (q > 0) g.trade(sym, side * q, rng.next() < 0.3 ? { sl: 2, tp: 3 } : {});
  }
  if (rng.next() < 0.02 && Object.keys(b.pos).length) g.closePos(Object.keys(b.pos)[0]);
  if (m.t > 380 && style !== 'yolo' && !b.isFlat()) g.flatten();
}

function play(B, mode, policy, style, seed) {
  const g = new B.Game(mode);
  g.__policy = policy || {};
  B.Screens.policy = (c) => {
    const id = Object.keys(B.StoryData ? B.StoryData.CHOICES : {}).find((k) => B.StoryData.CHOICES[k].title === c.title);
    const want = policy[id];
    return (c.options.find((o) => o.id === want) || c.options[0]).id;
  };
  B.Screens.result = null;
  const rng = B.RNG(B.hashSeed(seed || 'bot'));
  g.showBriefing();
  let guard = 0;
  while (!B.Screens.result && guard++ < 200000) {
    if (!g.running && B.Screens.pendingCb) { const f = B.Screens.pendingCb; B.Screens.pendingCb = null; f(); }
    if (g.running) { bot(B, g, rng, style); g.tick(0.25); }
    else if (!B.Screens.pendingCb) break;
    if (mode.kind === 'endless' && g.day > 60) break;
  }
  return { ending: B.Screens.result, days: g.history.length, equity: Math.round(g.broker.equity()), S: mode.S, history: g.history };
}

const POLICIES = {
  whistle: { c1: 'leak', c2: 'warn', c3: 'no', c4: 'tell', c5: 'bail', c6: 'report', c7: 'whip', c8: 'public' },
  depression: { c1: 'dump', c2: 'ignore', c3: 'yes', c4: 'join', c5: 'fail', c6: 'sign', c7: 'against', c8: 'quiet' },
  soft: { c1: 'refuse', c2: 'warn', c3: 'no', c4: 'refuse', c5: 'bail', c6: 'refuse', c7: 'whip', c8: 'quiet' },
  crook: { c1: 'dump', c2: 'trade', c3: 'yes', c4: 'join', c5: 'ban', c6: 'sign', c7: 'position', c8: 'flee' },
  insider: { c1: 'dump', c2: 'trade', c3: 'yes', c4: 'join', c5: 'bail', c6: 'sign', c7: 'whip', c8: 'quiet' },
  treasury: { c1: 'dump', c2: 'warn', c3: 'yes', c4: 'refuse', c5: 'bail', c6: 'refuse', c7: 'whip', c8: 'treasury' }
};

let errors = 0;
for (const [name, pol] of Object.entries(POLICIES)) {
  for (const style of ['careful', 'yolo']) {
    try {
      const B = load();
      const mode = B.StoryMode();
      if (process.argv.includes('--no-quota')) mode.quota = () => 0;
      const r = play(B, mode, pol, style, name + style);
      const idx = r.history.map((h) => h.index);
      console.log(`STORY ${name.padEnd(10)} ${style.padEnd(7)} -> ${r.ending ? r.ending.title.padEnd(22) : 'NO ENDING'.padEnd(22)} days=${String(r.days).padStart(2)} equity=$${r.equity.toLocaleString()} vote=${r.S.f.billPassed} stab=${r.S.m.stability} heat=${r.S.m.heat} INDX ${idx.length ? Math.round(idx[0]) + '->' + Math.round(Math.min(...idx)) + '(min)->' + Math.round(idx[idx.length - 1]) : ''}`);
      if (!r.ending) errors++;
    } catch (e) { errors++; console.log(`STORY ${name} ${style} THREW:`, e.stack); }
  }
}
for (const preset of ['intern', 'trader', 'shark', 'degenerate']) {
  try {
    const B = load();
    const cfg = JSON.parse(JSON.stringify(Object.assign({ preset, seed: 'SIM' + preset, ends: B.Endless.DEFAULT_ENDS }, B.Endless.PRESETS[preset])));
    cfg.ends.days = true; cfg.ends.daysN = 15;
    const r = play(B, B.EndlessMode(cfg), {}, preset === 'degenerate' ? 'yolo' : 'careful', preset);
    console.log(`ENDLESS ${preset.padEnd(10)} -> ${r.ending ? r.ending.title : 'NO ENDING'} days=${r.days} equity=$${r.equity.toLocaleString()}`);
    if (!r.ending) errors++;
  } catch (e) { errors++; console.log(`ENDLESS ${preset} THREW:`, e.stack); }
}
console.log(errors ? `\n${errors} problem(s)` : '\nAll simulated runs completed.');
process.exit(errors ? 1 : 0);
