// Deterministic quota calibration against the real Market and Broker engines.
// Usage: node js/tests/balance-run.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = { console, Math, Date, JSON, Intl, performance: { now: () => Date.now() } };
ctx.window = ctx;
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.setTimeout = () => 0;
vm.createContext(ctx);
const run = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
[
  'js/core/util.js', 'js/core/rng.js', 'js/core/events.js', 'js/core/storage.js', 'js/core/save.js',
  'js/core/clock.js', 'js/market/tickers.js', 'js/market/engine.js', 'js/market/news.js', 'js/market/sqwak.js',
  'js/trading/options.js', 'js/trading/broker.js'
].forEach(run);
vm.runInContext(`
  const B = window.BTB;
  B.Settings = { get: () => ({ storyDayLength: 180 }), set: () => {} };
  B.UI = new Proxy({}, { get: () => () => {} });
`, ctx);
['js/modes/story/story-data.js', 'js/modes/story/patch3-data.js', 'js/modes/story/endings.js', 'js/modes/story/patch3-endings.js', 'js/modes/story/story-engine.js'].forEach(run);

const B = ctx.BTB;
const styles = {
  conservative: { exposure: 0.35, missEvery: 5 },
  human: { exposure: 0.62, missEvery: 9 },
  foresight: { exposure: 0.90, missEvery: 0 }
};

function simulate(name, cfg) {
  const mode = B.StoryMode();
  const m = new B.Market({ seed: mode.seed, volMult: 1 });
  const b = new B.Broker({ cash: mode.capital });
  b.attach(m);
  let strikes = 0, hit = 0, firedAt = null, missStreak = 0, maxMissStreak = 0, backstopAt = null;
  const rows = [];
  for (let day = 0; day < B.StoryData.DAYS.length; day++) {
    const rules = mode.rules(day);
    b.rules.maxLev = rules.maxLev;
    b.rules.overnightLev = rules.overnightLev;
    b.rules.shortBan = rules.shortBan;
    const quota = mode.quota(day, { broker: b });
    const scen = mode.scenario(day);
    m.startDay(day, scen);
    b.startDay();
    const start = b.equity();
    const wrong = cfg.missEvery && day % cfg.missEvery === cfg.missEvery - 1;
    const direction = (scen.market && scen.market.target || 0) >= 0 ? 1 : -1;
    const side = wrong ? -direction : direction;
    const max = b.maxQty('INDX', side);
    const qty = Math.max(0, Math.floor(max * cfg.exposure));
    if (qty) b.marketOrder('INDX', side * qty, { tag: name.toUpperCase() });
    while (m.status === 'open' && m.t < B.DAY_MIN) {
      m.step(0.25);
      b.processOrders();
    }
    m.close();
    if (b.posQty('INDX')) b.marketOrder('INDX', -b.posQty('INDX'), { forced: true, tag: 'CLOSE' });
    b.endOfDay(day);
    const pnl = b.equity() - start;
    const met = pnl >= quota;
    if (met) { hit++; missStreak = 0; } else { strikes++; missStreak++; }
    maxMissStreak = Math.max(maxMissStreak, missStreak);
    if (!backstopAt && missStreak >= 5) backstopAt = day + 1;
    if (!firedAt && strikes >= B.StoryMode.QUOTA_STRIKE_LIMIT) firedAt = day + 1;
    rows.push({ day: day + 1, pnl: Math.round(pnl), quota, met, strikes, equity: Math.round(b.equity()) });
  }
  return { strategy: name, hitRate: hit / rows.length, strikes, threshold: B.StoryMode.QUOTA_STRIKE_LIMIT, firedAt, maxMissStreak, fifthConsecutiveAt: backstopAt, finalEquity: Math.round(b.equity()), reached61: !firedAt || firedAt >= 61, rows };
}

const results = Object.entries(styles).map(([name, cfg]) => simulate(name, cfg));
for (const r of results) {
  console.log(`${r.strategy.padEnd(12)} hit=${(r.hitRate * 100).toFixed(1)}% strikes=${String(r.strikes).padStart(2)} thresholdAt=${r.firedAt || '-'} maxStreak=${r.maxMissStreak} fifthConsecutive=${r.fifthConsecutiveAt || '-'} equity=$${r.finalEquity.toLocaleString()} reaches61=${r.reached61}`);
}
console.log(JSON.stringify(results.map(({ rows, ...summary }) => summary), null, 2));
