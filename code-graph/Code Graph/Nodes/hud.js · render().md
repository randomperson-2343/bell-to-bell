---
type: "function"
source_file: "js/ui/hud.js"
line: 647
community: "Trading Desk HUD and Order Ticket"
tags:
  - graph/function
  - community/Trading-Desk-HUD-and-Order-Ticket
---

# hud.js · render()

**Function** in `js/ui/hud.js` line 647. Group: [[_COMMUNITY_Trading Desk HUD and Order Ticket|Trading Desk HUD and Order Ticket]].

## Points to
- [calls:: [[clock.js · fmtTime()]]] _(BTB.Calendar.fmtTime · line 659)_
- [calls:: [[hud.js · applyNarrativeSkin()]]] _(line 651)_
- calls itself (recursion) _(line 758)_
- [calls:: [[hud.js · renderBottom()]]] _(line 759)_
- [calls:: [[hud.js · renderWatch()]]] _(line 745)_
- [calls:: [[ticket.js · render()]]] _(BTB.Ticket.render · line 758)_
- [calls:: [[util.js]]] _(BTB.clamp · line 679)_
- [uses:: [[story-engine.js]]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 702)_

## Pointed to by
- defined in ← [[hud.js]] _(line 647)_
- called by ← [[hud.js · dayEnd()]] _(line 266)_
- called by ← [[hud.js · dayStart()]] _(line 258)_
- called by ← [[hud.js · frame()]] _(line 643)_
- called by ← [[hud.js · select()]] _(line 208)_
