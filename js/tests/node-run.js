// Headless test runner: node js/tests/node-run.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const store = {};
const ctx = {
  console, Math, Date, JSON, Intl, performance: { now: () => Date.now() },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }
};
ctx.window = ctx;
vm.createContext(ctx);

const files = [
  'js/core/util.js', 'js/core/rng.js', 'js/core/events.js', 'js/core/storage.js', 'js/core/clock.js',
  'js/market/tickers.js', 'js/market/engine.js', 'js/market/news.js',
  'js/trading/options.js', 'js/trading/broker.js', 'js/stress.js',
  'js/modes/story/story-data.js', 'js/modes/story/endings.js',
  'js/tests/tests.js'
];
// story-engine needs B.Settings; provide a stub before loading it.
for (const f of files) {
  if (f === 'js/tests/tests.js') {
    vm.runInContext('window.BTB.Settings = { get: () => ({ storyDayLength: 240 }) };', ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/modes/story/story-engine.js'), 'utf8'), ctx, { filename: 'story-engine.js' });
  }
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}

const res = ctx.BTB.Tests.results;
let fail = 0;
for (const r of res) {
  if (r.ok) console.log('  PASS  ' + r.name);
  else { fail++; console.log('  FAIL  ' + r.name + '\n        ' + r.err); }
}
if (ctx.BTB.__storyReach) console.log('\nStory paths explored:', ctx.BTB.__storyReach.paths, '\nEnding reach counts:', JSON.stringify(ctx.BTB.__storyReach.reached));
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
