---
type: "file"
source_file: "js/core/rng.js"
line: 1
community: "Endless Mode and Market Feeds"
tags:
  - graph/file
  - community/Endless-Mode-and-Market-Feeds
---

# rng.js

**File** in `js/core/rng.js` line 1. Group: [[_COMMUNITY_Endless Mode and Market Feeds|Endless Mode and Market Feeds]].

## Points to
- [contains:: [[rng.js · getState()]]] _(line 31)_
- [contains:: [[rng.js · normal()]]] _(line 22)_
- [contains:: [[rng.js · setState()]]] _(line 32)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.RNG, BTB.hashSeed)_

## Pointed to by
- called by ← [[economy-run.js · career()]] _(BTB.RNG · line 47)_
- called by ← [[endless.js · cfgKey()]] _(BTB.hashSeed · line 67)_
- called by ← [[endless.js · nextRegime()]] _(BTB.RNG · line 88)_
- called by ← [[endless.js · outlookOf()]] _(BTB.RNG · line 56)_
- called by ← [[endless.js · scenario()]] _(BTB.RNG · line 128)_
- called by ← [[engine.js · Market.startDay()]] _(BTB.RNG · line 89)_
- called by ← [[game.js · Game.constructor()]] _(BTB.RNG · line 18)_
- called by ← [[hud.js · addNews()]] _(BTB.hashSeed · line 294)_
- called by ← [[interrupts.js · Interrupts.startDay()]] _(BTB.RNG · line 36)_
- called by ← [[pixel.js · speckle()]] _(BTB.RNG · line 189)_
- called by ← [[rhythm.js · hash()]] _(BTB.hashSeed · line 11)_
- called by ← [[sim-run.js · play()]] _(BTB.RNG · line 52)_
- called by ← [[sqwak.js]] _(BTB.hashSeed · line 31)_
- called by ← [[sqwak.js · hype()]] _(BTB.RNG · line 87)_
- called by ← [[story-engine.js · onDayStart()]] _(BTB.RNG · line 402)_
- called by ← [[story-engine.js · onResume()]] _(BTB.RNG · line 412)_
- called by ← [[story-engine.js · scenario()]] _(BTB.RNG · line 215)_
- called by ← [[tests.js]] _(BTB.RNG · line 40)_
- needed by ← [[economy-run.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[endless.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[engine.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[game.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[hud.js]] _(via BTB.hashSeed)_
- needed by ← [[interrupts.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[pixel.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[rhythm.js]] _(via BTB.hashSeed)_
- needed by ← [[sim-run.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[sqwak.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[story-engine.js]] _(via BTB.RNG, BTB.hashSeed)_
- needed by ← [[tests.js]] _(via BTB.RNG, BTB.hashSeed)_
- loaded by ← [[index.html]] _(load step 2)_
- loaded by ← [[tests.html]] _(load step 2)_
- implements ← [[Deterministic replay saves]]
