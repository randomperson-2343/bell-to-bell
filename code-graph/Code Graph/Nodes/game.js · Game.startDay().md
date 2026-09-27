---
type: "method"
source_file: "js/game.js"
line: 99
community: "Game Loop and Sound Effects"
tags:
  - graph/method
  - community/Game-Loop-and-Sound-Effects
---

# game.js · Game.startDay()

**Method** in `js/game.js` line 99. Group: [[_COMMUNITY_Game Loop and Sound Effects|Game Loop and Sound Effects]].

## Points to
- [calls:: [[game.js · Game.applyRules()]]] _(line 101)_
- [calls:: [[game.js · Game.autosave()]]] _(line 124)_
- calls itself (recursion) _(line 106)_
- [calls:: [[hud.js · dayStart()]]] _(BTB.UI.dayStart · line 117)_
- [calls:: [[music.js · play()]]] _(BTB.Music.play · line 121)_
- [calls:: [[sfx.js · bell()]]] _(BTB.SFX.bell · line 120)_

## Pointed to by
- method of ← [[game.js · Game]] _(line 99)_
- called by ← [[game.js · Game.enterOffice()]] _(line 95)_
- called by ← [[game.js · Game.resumeDay()]] _(line 145)_
- called by ← [[game.js · Game.warmup()]] _(line 42)_
