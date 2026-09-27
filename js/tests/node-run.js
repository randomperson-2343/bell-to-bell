// Headless test runner: node js/tests/node-run.js
const { load, STUBS } = require('./harness');

const ctx = load({
  groups: ['core', 'art', 'market', 'trading', 'game', 'story', 'endless'],
  setup: STUBS.game,
  extra: ['js/tests/tests.js']
});

const res = ctx.BTB.Tests.results;
let fail = 0;
for (const r of res) {
  if (r.ok) console.log('  PASS  ' + r.name);
  else { fail++; console.log('  FAIL  ' + r.name + '\n        ' + r.err); }
}
if (ctx.BTB.__storyReach) console.log('\nStory paths explored:', ctx.BTB.__storyReach.paths, '\nEnding reach counts:', JSON.stringify(ctx.BTB.__storyReach.reached));
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
