---
type: "file"
source_file: "js/market/engine.js"
line: 1
community: "Price Engine and Design Concepts"
tags:
  - graph/file
  - community/Price-Engine-and-Design-Concepts
---

# engine.js

**File** in `js/market/engine.js` line 1. Group: [[_COMMUNITY_Price Engine and Design Concepts|Price Engine and Design Concepts]].

## Points to
- [contains:: [[engine.js · curve()]]] _(line 12)_
- [contains:: [[engine.js · Factor]]] _(line 19)_
- [contains:: [[engine.js · Market]]] _(line 60)_
- [uses:: [[util.js]]] _(BTB.DAY_MIN · line 8)_
- [depends on:: [[rng.js]]] _(via BTB.RNG, BTB.hashSeed)_
- [depends on:: [[tickers.js]]] _(via BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_
- [depends on:: [[util.js]]] _(via BTB.DAY_MIN, BTB.clamp)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.Market, BTB.lr)_

## Pointed to by
- needed by ← [[balance-run.js]] _(via BTB.Market)_
- needed by ← [[economy-run.js]] _(via BTB.Market)_
- needed by ← [[game.js]] _(via BTB.Market)_
- needed by ← [[tests.js]] _(via BTB.Market)_
- loaded by ← [[index.html]] _(load step 17)_
- loaded by ← [[tests.html]] _(load step 15)_
- implements ← [[Circuit breakers]] _(inferred, 0.85)_
- implements ← [[Deterministic replay saves]] _(inferred, 0.85)_
- implements ← [[Factor price model]]
