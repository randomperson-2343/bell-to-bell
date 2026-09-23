// Economy balance guard: node js/tests/economy-run.js
// Plays whole careers with simple bots through the real Market, Broker and
// StoryMode payroll, then checks that the personal economy rewards discipline:
// a careful average trader must out-earn a reckless one with the same skill,
// and a trader who makes nothing must be squeezed out of their flat.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
function load() {
  const ctx = { console, Math, Date, JSON, Intl, performance: { now: () => Date.now() } };
  ctx.window = ctx;
  ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.setTimeout = () => 0;
  vm.createContext(ctx);
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  ['js/core/util.js', 'js/core/rng.js', 'js/core/events.js', 'js/core/storage.js', 'js/core/save.js', 'js/core/clock.js',
    'js/market/tickers.js', 'js/market/engine.js', 'js/market/news.js', 'js/market/sqwak.js', 'js/trading/options.js', 'js/trading/broker.js'].forEach(run);
  vm.runInContext('const B = window.BTB; B.Settings = { get: () => ({ storyDayLength: 180 }), set: () => {} }; B.UI = new Proxy({}, { get: () => () => {} }); B.Screens = {};', ctx);
  ['js/modes/story/story-data.js', 'js/modes/story/patch3-data.js', 'js/modes/story/sqwak-story.js', 'js/modes/story/endings.js',
    'js/modes/story/patch3-endings.js', 'js/modes/story/economy.js', 'js/modes/story/life.js', 'js/modes/story/mentor.js', 'js/modes/story/story-engine.js'].forEach(run);
  return ctx.BTB;
}
const B = load();
const D = B.StoryData, E = B.Economy;

// p: chance of trading the day's authored direction. risk: share of equity put
// at one daily sigma. stop: flatten and stop at the loss limit. chase: when
// losing mid-day, chance to flip and re-enter at full size. overnight: share
// of days the position is carried through the close.
const ARCH = {
  passive: { pick: 'index', risk: 0.006, p: 0.65, stop: false, trade: 0.7 },
  average: { pick: 'story', risk: 0.025, p: 0.82, stop: true, trade: 1 },
  reckless: { pick: 'story', risk: 0.060, p: 0.82, stop: false, trade: 1, chase: 0.35, overnight: 0.3 }
};

function sigmaOf(sym) {
  const t = B.TICKERS.find((x) => x.sym === sym);
  if (t.sector === 'index') return 0.010;
  return Math.sqrt(Math.pow(t.beta * 0.010, 2) + Math.pow(B.SECTORS[t.sector].vol, 2) + Math.pow(t.vol, 2));
}
function bestStory(scen, rules) {
  const f = (o) => ((o && o.target) || 0) - ((o && o.gap) || 0);
  const M = f(scen.market);
  return B.TICKERS.filter((t) => t.sector !== 'fear' && t.sector !== 'index' && !t.htb)
    .map((t) => ({ sym: t.sym, sector: t.sector, mv: t.beta * M + f((scen.sectors || {})[t.sector]) + f((scen.tickers || {})[t.sym]) }))
    .filter((x) => !(x.mv < 0 && (rules.shortBan || []).indexOf(x.sector) >= 0))
    .sort((a, b) => Math.abs(b.mv) / sigmaOf(b.sym) - Math.abs(a.mv) / sigmaOf(a.sym))[0];
}

function career(arch, seed) {
  const cfg = ARCH[arch];
  const mode = B.StoryMode();
  const W = mode.S.wallet;
  const m = new B.Market({ seed: mode.seed + '|' + seed, volMult: 1 });
  const b = new B.Broker({ cash: mode.capital });
  b.attach(m);
  m.startDay(-1, { regime: 'melt' }); while (m.status === 'open' && m.t < B.DAY_MIN) m.step(1); m.close(); m.status = 'pre';
  const rng = B.RNG(B.hashSeed('econ-bot|' + arch + '|' + seed));
  const g = { day: 0, broker: b, market: m, history: [], indexStart: 512.4 };
  const weeks = [];
  for (let day = 0; day < D.DAYS.length; day++) {
    g.day = day;
    const rules = mode.rules(day);
    b.rules.maxLev = rules.maxLev; b.rules.overnightLev = rules.overnightLev; b.rules.shortBan = rules.shortBan;
    const scen = mode.scenario(day);
    m.startDay(day, scen);
    b.startDay();
    mode.openWeek(g);
    const quota = mode.quota(day, g);
    const start = b.equity();
    let sym = 'INDX';
    const tgt = (scen.market && scen.market.target) || 0;
    let dir = tgt > 0 ? 1 : tgt < 0 ? -1 : (rng.next() < 0.5 ? 1 : -1);
    if (cfg.pick === 'story') {
      const best = bestStory(scen, rules);
      if (best && Math.abs(best.mv) > 0.003) { sym = best.sym; dir = best.mv > 0 ? 1 : -1; }
    }
    let side = rng.next() < cfg.p ? dir : -dir;
    const tk = B.TICKERS.find((t) => t.sym === sym);
    if (side < 0 && (rules.shortBan || []).indexOf(tk.sector) >= 0) side = 1;
    const trades = rng.next() < cfg.trade;
    const hold = cfg.overnight && rng.next() < cfg.overnight;
    const entryT = 5 + rng.next() * 25, chaseT = 90 + rng.next() * 200;
    const size = () => Math.min(b.maxQty(sym, side), Math.floor(cfg.risk * b.equity() / sigmaOf(sym) / m.bySym[sym].last));
    let entered = false, stopped = false, chased = false, carried = false;
    while (m.status === 'open' && m.t < B.DAY_MIN) {
      m.step(0.5);
      b.processOrders();
      b.checkMargin(m.t);
      b.trackRisk(m.t, mode.lossLimit);
      if (m.status !== 'open' || m.halt) continue;
      if (!carried) { carried = true; for (const s of Object.keys(b.pos)) b.marketOrder(s, -b.pos[s].qty, { tag: 'CLOSE' }); }
      if (trades && !entered && !stopped && m.t >= entryT) { entered = true; const q = size(); if (q > 0) b.marketOrder(sym, side * q, { tag: '' }); }
      const pos = b.posQty(sym);
      if (cfg.stop && !stopped && pos && b.equity() <= start * (1 - mode.lossLimit)) { stopped = true; b.marketOrder(sym, -pos, { tag: 'CLOSE' }); }
      if (cfg.chase && !chased && entered && m.t >= chaseT) {
        chased = true;
        if (b.equity() < start && rng.next() < cfg.chase * 2) {
          if (pos) b.marketOrder(sym, -pos, { tag: 'CLOSE' });
          side = -side;
          const q = size();
          if (q > 0) b.marketOrder(sym, side * q, { tag: '' });
        }
      }
      if (!hold && m.t >= 385 && b.posQty(sym)) b.marketOrder(sym, -b.posQty(sym), { tag: 'CLOSE' });
    }
    m.close();
    const eod = b.endOfDay(day);
    const eq = b.equity();
    const report = { day, date: 'S' + (day + 1), pnl: eq - start, equity: eq, start, quota, quotaMet: eq - start >= quota, eod };
    g.history.push({ day, pnl: report.pnl, equity: eq, quotaMet: report.quotaMet });
    mode.onDayEnd(g, report); // careers keep going past firing: we want 61 sessions of pay
    if (day % 5 === 4 || day === D.DAYS.length - 1) {
      // Upgrade policy: move up one tier when cash covers the move-in and two
      // more weeks there, and the card is clear.
      const up = E.moveOptions(W).find((o) => o.i === (W.tier | 0) + 1);
      if (up && W.card === 0 && W.cash >= up.cost + 2 * (up.rent + E.P.living + E.P.loan + E.P.mom)) E.move(W, up.i);
      weeks.push({ w: D.weekOf(day), worth: E.netWorth(W), tier: W.tier, evictions: W.evictions, card: W.card });
    }
    if (eq < mode.capital * 0.1) break;
  }
  return { arch, seed, book: Math.round(b.equity()), worth: E.netWorth(W), weeks };
}

const SEEDS = ['s0', 's1', 's2', 's3'];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const R = {};
for (const a of Object.keys(ARCH)) {
  R[a] = SEEDS.map((s) => career(a, s));
  for (const r of R[a]) console.log(`${a.padEnd(9)} ${r.seed}  book $${r.book.toLocaleString().padStart(11)}  own money $${r.worth.toLocaleString().padStart(8)}  weeks: ${r.weeks.map((w) => w.worth + (w.evictions ? 'E' : '')).join(' ')}`);
}

let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + msg); if (!ok) fail++; };
const evictedBy8 = R.passive.filter((r) => r.weeks.some((w) => w.w <= 8 && w.evictions)).length;
check(evictedBy8 >= 3, `a passive trader is evicted by week 8 in at least 3 of 4 careers (${evictedBy8}/4)`);
const avgWorth = med(R.average.map((r) => r.worth)), reckWorth = med(R.reckless.map((r) => r.worth));
check(avgWorth > reckWorth, `discipline pays: average median own money $${avgWorth} beats reckless $${reckWorth}`);
let paired = 0, won = 0;
SEEDS.forEach((s, i) => { if (R.reckless[i].book >= R.average[i].book) { paired++; if (R.average[i].worth > R.reckless[i].worth) won++; } });
check(won === paired, `wherever reckless grew the bigger book, average still took home more (${won}/${paired})`);
check(avgWorth > med(R.passive.map((r) => r.worth)), 'an average trader ends ahead of a passive one');
console.log(`\n${fail ? fail + ' economy check(s) failed' : 'All economy checks passed.'}`);
process.exit(fail ? 1 : 0);
