---
type: "file"
source_file: "js/market/sqwak.js"
line: 1
community: "Endless Mode and Market Feeds"
tags:
  - graph/file
  - community/Endless-Mode-and-Market-Feeds
---

# sqwak.js

**File** in `js/market/sqwak.js` line 1. Group: [[_COMMUNITY_Endless Mode and Market Feeds|Endless Mode and Market Feeds]].

## Points to
- [calls:: [[rng.js]]] _(BTB.hashSeed · line 31)_
- [may call:: [[sqwak.js · account()]]] _(passed as a list entry · line 113 · inferred, 0.85)_
- [may call:: [[sqwak.js · hype()]]] _(passed as a list entry · line 113 · inferred, 0.85)_
- [may call:: [[sqwak.js · initials()]]] _(passed as a list entry · line 113 · inferred, 0.85)_
- [may call:: [[sqwak.js · metrics()]]] _(passed as a list entry · line 113 · inferred, 0.85)_
- [may call:: [[sqwak.js · sentiment()]]] _(passed as a list entry · line 113 · inferred, 0.85)_
- [depends on:: [[rng.js]]] _(via BTB.RNG, BTB.hashSeed)_
- [depends on:: [[tickers.js]]] _(via BTB.TICKERS)_
- [depends on:: [[util.js]]] _(via BTB.clamp)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.Sqwak)_

## Pointed to by
- used by ← [[economy.js · hypeWindows()]] _(BTB.Sqwak · line 88)_
- used by ← [[endless.js · scenario()]] _(BTB.Sqwak · line 154)_
- used by ← [[hud.js · renderFeed()]] _(BTB.Sqwak · line 341)_
- used by ← [[hud.js · sqwakCard()]] _(BTB.Sqwak.HYPE_MIN_FOLLOWERS · line 357)_
- used by ← [[hud.js · sqwakTrending()]] _(BTB.Sqwak · line 402)_
- used by ← [[mentor.js · hypePop()]] _(BTB.Sqwak · line 25)_
- used by ← [[news.js · handle()]] _(BTB.Sqwak · line 105)_
- used by ← [[screens.js · briefing()]] _(BTB.Sqwak · line 128)_
- used by ← [[sqwak-story.js]] _(BTB.Sqwak.ACCOUNTS · line 275)_
- used by ← [[story-engine.js · onResqwak()]] _(BTB.Sqwak · line 309)_
- used by ← [[story-engine.js · scenario()]] _(BTB.Sqwak · line 226)_
- used by ← [[tests.js]] _(BTB.Sqwak · line 635)_
- needed by ← [[economy.js]] _(via BTB.Sqwak)_
- needed by ← [[endless.js]] _(via BTB.Sqwak)_
- needed by ← [[hud.js]] _(via BTB.Sqwak)_
- needed by ← [[mentor.js]] _(via BTB.Sqwak)_
- needed by ← [[news.js]] _(via BTB.Sqwak)_
- needed by ← [[screens.js]] _(via BTB.Sqwak)_
- needed by ← [[sqwak-story.js]] _(via BTB.Sqwak)_
- needed by ← [[story-engine.js]] _(via BTB.Sqwak)_
- needed by ← [[tests.js]] _(via BTB.Sqwak)_
- loaded by ← [[index.html]] _(load step 19)_
- loaded by ← [[tests.html]] _(load step 17)_
- implements ← [[Sqwak rumour network]]
