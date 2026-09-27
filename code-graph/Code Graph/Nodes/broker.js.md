---
type: "file"
source_file: "js/trading/broker.js"
line: 1
community: "Boot, Menus and Save Slots"
tags:
  - graph/file
  - community/Boot-Menus-and-Save-Slots
---

# broker.js

**File** in `js/trading/broker.js` line 1. Group: [[_COMMUNITY_Boot, Menus and Save Slots|Boot, Menus and Save Slots]].

## Points to
- [contains:: [[broker.js · bracketValues()]]] _(line 9)_
- [contains:: [[broker.js · Broker]]] _(line 17)_
- [depends on:: [[events.js]]] _(via BTB.bus)_
- [depends on:: [[options.js]]] _(via BTB.Options)_
- [depends on:: [[tickers.js]]] _(via BTB.SECTORS)_
- [depends on:: [[util.js]]] _(via BTB.DAY_MIN, BTB.clamp)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.Broker)_

## Pointed to by
- needed by ← [[balance-run.js]] _(via BTB.Broker)_
- needed by ← [[economy-run.js]] _(via BTB.Broker)_
- needed by ← [[game.js]] _(via BTB.Broker)_
- needed by ← [[tests.js]] _(via BTB.Broker)_
- loaded by ← [[index.html]] _(load step 21)_
- loaded by ← [[tests.html]] _(load step 19)_
- implements ← [[Circuit breakers]] _(inferred, 0.85)_
- implements ← [[Margin calls and liquidation]]
- implements ← [[Risk desk discipline review]] _(inferred, 0.85)_
