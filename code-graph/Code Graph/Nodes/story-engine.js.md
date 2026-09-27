---
type: "file"
source_file: "js/modes/story/story-engine.js"
line: 1
community: "Story Briefings and Quotas"
tags:
  - graph/file
  - community/Story-Briefings-and-Quotas
---

# story-engine.js

**File** in `js/modes/story/story-engine.js` line 1. Group: [[_COMMUNITY_Story Briefings and Quotas|Story Briefings and Quotas]].

## Points to
- [contains:: [[story-engine.js · afterDay()]]] _(line 756)_
- [contains:: [[story-engine.js · applyLife()]]] _(line 729)_
- [contains:: [[story-engine.js · applyPending()]]] _(line 420)_
- [contains:: [[story-engine.js · bearishExposure()]]] _(line 251)_
- [contains:: [[story-engine.js · bossMood()]]] _(line 653)_
- [contains:: [[story-engine.js · bossName()]]] _(line 339)_
- [contains:: [[story-engine.js · briefing()]]] _(line 95)_
- [contains:: [[story-engine.js · buildEnding()]]] _(line 793)_
- [contains:: [[story-engine.js · calls()]]] _(line 337)_
- [contains:: [[story-engine.js · calmMult()]]] _(line 268)_
- [contains:: [[story-engine.js · freshState()]]] _(line 29)_
- [contains:: [[story-engine.js · inbox()]]] _(line 338)_
- [contains:: [[story-engine.js · ledger()]]] _(line 151)_
- [contains:: [[story-engine.js · ledgerAccess()]]] _(line 150)_
- [contains:: [[story-engine.js · ledgerCancel()]]] _(line 172)_
- [contains:: [[story-engine.js · ledgerCharge()]]] _(line 145)_
- [contains:: [[story-engine.js · ledgerNote()]]] _(line 179)_
- [contains:: [[story-engine.js · ledgerPrice()]]] _(line 139)_
- [contains:: [[story-engine.js · ledgerSubscribe()]]] _(line 158)_
- [contains:: [[story-engine.js · lifeBeat()]]] _(line 741)_
- [contains:: [[story-engine.js · liquidate()]]] _(line 785)_
- [contains:: [[story-engine.js · morningStress()]]] _(line 273)_
- [contains:: [[story-engine.js · onCouch()]]] _(line 269)_
- [contains:: [[story-engine.js · onDayEnd()]]] _(line 509)_
- [contains:: [[story-engine.js · onDayStart()]]] _(line 368)_
- [contains:: [[story-engine.js · onFeedOpen()]]] _(line 291)_
- [contains:: [[story-engine.js · onFeedSkip()]]] _(line 331)_
- [contains:: [[story-engine.js · onMissedCall()]]] _(line 493)_
- [contains:: [[story-engine.js · onResqwak()]]] _(line 300)_
- [contains:: [[story-engine.js · onResume()]]] _(line 409)_
- [contains:: [[story-engine.js · onScript()]]] _(line 477)_
- [contains:: [[story-engine.js · onTaskDone()]]] _(line 497)_
- [contains:: [[story-engine.js · onTaskFailed()]]] _(line 496)_
- [contains:: [[story-engine.js · onTick()]]] _(line 457)_
- [contains:: [[story-engine.js · onTrade()]]] _(line 467)_
- [contains:: [[story-engine.js · openWeek()]]] _(line 349)_
- [contains:: [[story-engine.js · payroll()]]] _(line 672)_
- [contains:: [[story-engine.js · quota()]]] _(line 230)_
- [contains:: [[story-engine.js · quotaMeta()]]] _(line 235)_
- [contains:: [[story-engine.js · reconcileQuotaStrikes()]]] _(line 278)_
- [contains:: [[story-engine.js · resolveMidChoice()]]] _(line 499)_
- [contains:: [[story-engine.js · riskReview()]]] _(line 660)_
- [contains:: [[story-engine.js · rules()]]] _(line 203)_
- [contains:: [[story-engine.js · scenario()]]] _(line 213)_
- [contains:: [[story-engine.js · scene()]]] _(line 41)_
- [contains:: [[story-engine.js · serialize()]]] _(line 859)_
- [contains:: [[story-engine.js · slotLabel()]]] _(line 91)_
- [contains:: [[story-engine.js · stressCarry()]]] _(line 266)_
- [contains:: [[story-engine.js · votePasses()]]] _(line 46)_
- [contains:: [[story-engine.js · weekBounds()]]] _(line 342)_
- [contains:: [[story-engine.js · weekendLedger()]]] _(line 719)_
- [contains:: [[story-engine.js · weekQuota()]]] _(line 360)_
- [contains:: [[story-engine.js · wipeLevel()]]] _(line 340)_
- [calls:: [[screens.js · get()]]] _(BTB.Settings.get · line 81)_
- [uses:: [[economy.js]]] _(BTB.Economy · line 74)_
- [uses:: [[story-data.js]]] _(BTB.StoryData · line 4)_
- [depends on:: [[cinematic.js]]] _(via BTB.Cinematic)_
- [depends on:: [[clock.js]]] _(via BTB.Calendar)_
- [depends on:: [[economy.js]]] _(via BTB.Economy)_
- [depends on:: [[endings.js]]] _(via BTB.StoryEndings)_
- [depends on:: [[hud.js]]] _(via BTB.UI)_
- [depends on:: [[life.js]]] _(via BTB.Life)_
- [depends on:: [[mentor.js]]] _(via BTB.Mentor)_
- [depends on:: [[music.js]]] _(via BTB.Music)_
- [depends on:: [[news.js]]] _(via BTB.News)_
- [depends on:: [[options.js]]] _(via BTB.Options)_
- [depends on:: [[rng.js]]] _(via BTB.RNG, BTB.hashSeed)_
- [depends on:: [[scenes.js]]] _(via BTB.Scenes)_
- [depends on:: [[screens.js]]] _(via BTB.Screens, BTB.Settings)_
- [depends on:: [[sfx.js]]] _(via BTB.SFX)_
- [depends on:: [[sqwak.js]]] _(via BTB.Sqwak)_
- [depends on:: [[story-data.js]]] _(via BTB.StoryData)_
- [depends on:: [[tickers.js]]] _(via BTB.SECTORS, BTB.TICKERS)_
- [depends on:: [[util.js]]] _(via BTB.DAY_MIN, BTB.clamp, BTB.fmt)_
- [publishes to:: [[BTB namespace (window.BTB)]]] _(BTB.StoryMode)_

## Pointed to by
- called by ← [[balance-run.js · simulate()]] _(BTB.StoryMode · line 14)_
- called by ← [[debug.js · act()]] _(BTB.StoryMode · line 31)_
- called by ← [[debug.js · jump()]] _(BTB.StoryMode · line 47)_
- called by ← [[economy-run.js · career()]] _(BTB.StoryMode · line 41)_
- called by ← [[main.js · newStory()]] _(BTB.StoryMode · line 18)_
- called by ← [[reachability-run.js]] _(BTB.StoryMode · line 86)_
- called by ← [[reachability-run.js · advance()]] _(BTB.StoryMode · line 27)_
- called by ← [[reachability-run.js · walk()]] _(BTB.StoryMode · line 68)_
- called by ← [[saveslots.js · load()]] _(BTB.StoryMode · line 72)_
- called by ← [[sim-run.js]] _(BTB.StoryMode · line 76)_
- called by ← [[tests.js]] _(BTB.StoryMode · line 354)_
- called by ← [[tests.js · mkGame()]] _(BTB.StoryMode · line 321)_
- called by ← [[tests.js · run()]] _(BTB.StoryMode · line 778)_
- used by ← [[balance-run.js · simulate()]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 62)_
- used by ← [[debug.js · render()]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 63)_
- used by ← [[economy-run.js · career()]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 102)_
- used by ← [[game.js · Game.endDay()]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 491)_
- used by ← [[hud.js · render()]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 702)_
- used by ← [[reachability-run.js]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 87)_
- used by ← [[rhythm.js · marketDown()]] _(BTB.StoryMode · line 19)_
- used by ← [[tests.js]] _(BTB.StoryMode.QUOTA_STRIKE_LIMIT · line 746)_
- needed by ← [[balance-run.js]] _(via BTB.StoryMode)_
- needed by ← [[debug.js]] _(via BTB.StoryMode)_
- needed by ← [[economy-run.js]] _(via BTB.StoryMode)_
- needed by ← [[game.js]] _(via BTB.StoryMode)_
- needed by ← [[hud.js]] _(via BTB.StoryMode)_
- needed by ← [[main.js]] _(via BTB.StoryMode)_
- needed by ← [[reachability-run.js]] _(via BTB.StoryMode)_
- needed by ← [[rhythm.js]] _(via BTB.StoryMode)_
- needed by ← [[saveslots.js]] _(via BTB.StoryMode)_
- needed by ← [[sim-run.js]] _(via BTB.StoryMode)_
- needed by ← [[tests.js]] _(via BTB.StoryMode)_
- loaded by ← [[index.html]] _(load step 38)_
- loaded by ← [[tests.html]] _(load step 31)_
- implements ← [[Career mode (61 sessions, 22 endings)]]
- implements ← [[Desk quotas and career strikes]] _(inferred, 0.85)_
- implements ← [[The Ledger subscription]] _(inferred, 0.85)_
