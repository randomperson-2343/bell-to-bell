---
type: "method"
source_file: "js/game.js"
line: 529
community: "Boot, Menus and Save Slots"
tags:
  - graph/method
  - community/Boot-Menus-and-Save-Slots
---

# game.js · Game.finish()

**Method** in `js/game.js` line 529. Group: [[_COMMUNITY_Boot, Menus and Save Slots|Boot, Menus and Save Slots]].

## Points to
- calls itself (recursion) _(line 533)_
- [calls:: [[hud.js · clearToasts()]]] _(BTB.UI.clearToasts · line 542)_
- [calls:: [[music.js · stop()]]] _(BTB.Music.stop · line 541)_
- [calls:: [[save.js · clear()]]] _(BTB.Save.clear · line 539)_
- [calls:: [[save.js · finish()]]] _(BTB.Save.finish · line 533)_
- [calls:: [[save.js · recordEnding()]]] _(BTB.Save.recordEnding · line 534)_
- [calls:: [[save.js · recordEndless()]]] _(BTB.Save.recordEndless · line 538)_
- [calls:: [[screens.js · ending()]]] _(BTB.Screens.ending · line 543)_
- [uses:: [[hud.js · clearToasts()]]] _(BTB.UI.clearToasts · line 542)_

## Pointed to by
- method of ← [[game.js · Game]] _(line 529)_
- called by ← [[game.js · Game.endDay()]] _(line 500)_
