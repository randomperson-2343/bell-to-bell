---
type: "file"
source_file: "js/market/tickers.js"
line: 1
community: "Endless Mode and Market Feeds"
tags:
  - graph/file
  - community/Endless-Mode-and-Market-Feeds
---

# tickers.js

**File** in `js/market/tickers.js` line 1. Group: [[_COMMUNITY_Endless Mode and Market Feeds|Endless Mode and Market Feeds]].

## Points to
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.AISTACK, BTB.CASCADE, BTB.FINANCIALS, BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_

## Pointed to by
- used by ← [[broker.js · Broker.marketOrder()]] _(BTB.SECTORS · line 102)_
- used by ← [[broker.js · Broker.placeOrder()]] _(BTB.SECTORS · line 167)_
- used by ← [[economy-run.js · bestStory()]] _(BTB.TICKERS.filter · line 33)_
- used by ← [[economy-run.js · career()]] _(BTB.TICKERS.find · line 68)_
- used by ← [[economy-run.js · sigmaOf()]] _(BTB.TICKERS.find · line 26)_
- used by ← [[endless.js · briefing()]] _(BTB.REGIMES · line 105)_
- used by ← [[endless.js · scenario()]] _(BTB.REGIMES · line 129)_
- used by ← [[engine.js · Market.constructor()]] _(BTB.TICKERS.map · line 64)_
- used by ← [[engine.js · Market.startDay()]] _(BTB.REGIMES · line 90)_
- used by ← [[hud.js · sqwakText()]] _(BTB.TICKERS.some · line 350)_
- used by ← [[hud.js · sqwakTrending()]] _(BTB.TICKERS.some · line 409)_
- used by ← [[interrupts.js · Interrupts.prepare()]] _(BTB.TICKERS.filter · line 109)_
- used by ← [[main.js · tape()]] _(BTB.TICKERS.filter · line 97)_
- used by ← [[news.js · fakeRumor()]] _(BTB.TICKERS.find · line 154)_
- used by ← [[news.js · randomEvents()]] _(BTB.TICKERS.filter · line 112)_
- used by ← [[options.js · annVol()]] _(BTB.REGIMES.chop · line 33)_
- used by ← [[reachability-run.js · game()]] _(BTB.TICKERS · line 14)_
- used by ← [[sqwak.js · hype()]] _(BTB.TICKERS.some · line 88)_
- used by ← [[story-engine.js · ledgerNote()]] _(BTB.TICKERS.find · line 193)_
- used by ← [[story-engine.js · scenario()]] _(BTB.TICKERS.find · line 221)_
- used by ← [[tests.js]] _(BTB.REGIMES · line 234)_
- needed by ← [[broker.js]] _(via BTB.SECTORS)_
- needed by ← [[economy-run.js]] _(via BTB.SECTORS, BTB.TICKERS)_
- needed by ← [[endless.js]] _(via BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_
- needed by ← [[engine.js]] _(via BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_
- needed by ← [[hud.js]] _(via BTB.TICKERS)_
- needed by ← [[interrupts.js]] _(via BTB.TICKERS)_
- needed by ← [[main.js]] _(via BTB.TICKERS)_
- needed by ← [[news.js]] _(via BTB.TICKERS)_
- needed by ← [[options.js]] _(via BTB.REGIMES, BTB.SECTORS)_
- needed by ← [[reachability-run.js]] _(via BTB.TICKERS)_
- needed by ← [[sqwak.js]] _(via BTB.TICKERS)_
- needed by ← [[story-engine.js]] _(via BTB.SECTORS, BTB.TICKERS)_
- needed by ← [[tests.js]] _(via BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_
- loaded by ← [[index.html]] _(load step 16)_
- loaded by ← [[tests.html]] _(load step 14)_
- implements ← [[Everything-is-invented denylist test]]
