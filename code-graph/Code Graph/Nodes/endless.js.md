---
type: "file"
source_file: "js/modes/endless/endless.js"
line: 1
community: "Endless Mode and Market Feeds"
tags:
  - graph/file
  - community/Endless-Mode-and-Market-Feeds
---

# endless.js

**File** in `js/modes/endless/endless.js` line 1. Group: [[_COMMUNITY_Endless Mode and Market Feeds|Endless Mode and Market Feeds]].

## Points to
- [contains:: [[endless.js · afterDay()]]] _(line 193)_
- [contains:: [[endless.js · bind()]]] _(line 281)_
- [contains:: [[endless.js · bossName()]]] _(line 165)_
- [contains:: [[endless.js · briefing()]]] _(line 97)_
- [contains:: [[endless.js · buildEnding()]]] _(line 195)_
- [contains:: [[endless.js · nextRegime()]]] _(line 87)_
- [contains:: [[endless.js · onDayEnd()]]] _(line 171)_
- [contains:: [[endless.js · onPanic()]]] _(line 167)_
- [contains:: [[endless.js · open()]]] _(line 237)_
- [contains:: [[endless.js · quota()]]] _(line 158)_
- [contains:: [[endless.js · recordScore()]]] _(line 219)_
- [contains:: [[endless.js · render()]]] _(line 245)_
- [contains:: [[endless.js · rules()]]] _(line 125)_
- [contains:: [[endless.js · scenario()]]] _(line 127)_
- [contains:: [[endless.js · serialize()]]] _(line 213)_
- [contains:: [[endless.js · slotLabel()]]] _(line 85)_
- [contains:: [[endless.js · summary()]]] _(line 318)_
- [contains:: [[endless.js · wipeLevel()]]] _(line 166)_
- [calls:: [[util.js]]] _(BTB.clamp · line 82)_
- [may call:: [[endless.js · cfgKey()]]] _(passed as a list entry · line 330 · inferred, 0.85)_
- [may call:: [[endless.js · outlookOf()]]] _(passed as a list entry · line 330 · inferred, 0.85)_
- [uses:: [[util.js]]] _(BTB.el · line 4)_
- [depends on:: [[main.js]]] _(via BTB.Main)_
- [depends on:: [[news.js]]] _(via BTB.News)_
- [depends on:: [[rng.js]]] _(via BTB.RNG, BTB.hashSeed)_
- [depends on:: [[screens.js]]] _(via BTB.Screens)_
- [depends on:: [[sfx.js]]] _(via BTB.SFX)_
- [depends on:: [[sqwak.js]]] _(via BTB.Sqwak)_
- [depends on:: [[storage.js]]] _(via BTB.storage)_
- [depends on:: [[tickers.js]]] _(via BTB.REGIMES, BTB.SECTORS, BTB.TICKERS)_
- [depends on:: [[util.js]]] _(via BTB.clamp, BTB.el, BTB.esc, BTB.fmt)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.Endless, BTB.EndlessMode, BTB.EndlessSetup)_

## Pointed to by
- called by ← [[debug.js · act()]] _(BTB.EndlessMode · line 31)_
- called by ← [[main.js · startEndless()]] _(BTB.EndlessMode · line 35)_
- called by ← [[saveslots.js · load()]] _(BTB.EndlessMode · line 73)_
- called by ← [[sim-run.js]] _(BTB.EndlessMode · line 100)_
- used by ← [[sim-run.js]] _(BTB.Endless.DEFAULT_ENDS · line 98)_
- needed by ← [[debug.js]] _(via BTB.EndlessMode)_
- needed by ← [[main.js]] _(via BTB.EndlessMode, BTB.EndlessSetup)_
- needed by ← [[saveslots.js]] _(via BTB.EndlessMode)_
- needed by ← [[sim-run.js]] _(via BTB.Endless, BTB.EndlessMode)_
- needed by ← [[tests.js]] _(via BTB.Endless)_
- loaded by ← [[index.html]] _(load step 39)_
- loaded by ← [[tests.html]] _(load step 32)_
- implements ← [[Endless mode]]
