# Graph Report - bell-to-bell  (2026-09-27)

## Corpus Check
- 71 files · ~121,016 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .woff2 12, (none) 3, .css 3)

## Summary
- 805 nodes · 2473 edges · 23 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Boot, Menus and Save Slots
- Trading Desk HUD and Order Ticket
- Game Loop and Sound Effects
- Storyboard and Decision Scenes
- Endless Mode and Market Feeds
- Cinematics and Stress
- Price Engine and Design Concepts
- Pixel Art, Palette and Fonts
- Brokerage Account
- Story Briefings and Quotas
- Rhythm Storyboard Layer
- Render Regression Tests
- Chiptune Music
- Phone Interruptions
- Personal Economy
- Ending Reachability Tests
- Storyboard Export Tool
- Headless Test Loader
- Balance and Unit Test Runners
- Life Beats and Payroll
- Ending Resolution
- The Ledger Subscription
- Full-Game Bot Simulation

## God Nodes (most connected - your core abstractions)
1. `Broker` - 45 edges
2. `Game` - 45 edges
3. `BTB namespace (window.BTB)` - 42 edges
4. `tone()` - 27 edges
5. `init()` - 26 edges
6. `toast()` - 26 edges
7. `Market` - 24 edges
8. `Interrupts` - 19 edges
9. `play()` - 18 edges
10. `money()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `CASCADE stack symbol` --conceptually_related_to--> `Career mode (61 sessions, 22 endings)`  [INFERRED]
  ART_DIRECTION.md → README.md
- `Three pixel fonts` --implemented_in--> `Silkscreen (font)`  [EXTRACTED]
  ART_DIRECTION.md → css/fonts.css
- `Three pixel fonts` --implemented_in--> `Tiny5 (font)`  [EXTRACTED]
  ART_DIRECTION.md → css/fonts.css
- `Three pixel fonts` --implemented_in--> `VT323 (font)`  [EXTRACTED]
  ART_DIRECTION.md → css/fonts.css
- `apply()` --calls--> `setEnabled()`  [EXTRACTED]
  js/ui/screens.js → js/audio/sfx.js

## Import Cycles
- None detected.

## Communities (23 total, 0 thin omitted)

### Community 0 - "Boot, Menus and Save Slots"
Cohesion: 0.06
Nodes (66): BTB namespace (window.BTB), unlock(), storyLabel(), off(), on(), blankIndex(), careerTally(), clear() (+58 more)

### Community 1 - "Trading Desk HUD and Order Ticket"
Cohesion: 0.06
Nodes (70): Imani's first three sessions, Simplified options, draw(), news(), dayInfo(), fmtTime(), firstEmpty(), compact() (+62 more)

### Community 2 - "Game Loop and Sound Effects"
Cohesion: 0.07
Nodes (44): endChain(), startChain(), alarm(), apartment(), bell(), bellRing(), broadcast(), cash() (+36 more)

### Community 3 - "Storyboard and Decision Scenes"
Cohesion: 0.08
Nodes (63): big(), blit(), boards(), carpet(), cityWindow(), clinic(), dim(), dinner() (+55 more)

### Community 4 - "Endless Mode and Market Feeds"
Cohesion: 0.06
Nodes (42): Endless mode, speckle(), hash(), startEndless(), fakeRumor(), handle(), randomEvents(), account() (+34 more)

### Community 5 - "Cinematics and Stress"
Cohesion: 0.06
Nodes (37): cachedFrame(), draw(), ensure(), finish(), layout(), mode(), optsOf(), play() (+29 more)

### Community 6 - "Price Engine and Design Concepts"
Cohesion: 0.06
Nodes (20): Twelve hidden anomalies, Career mode (61 sessions, 22 endings), CASCADE stack symbol, Adaptive chiptune score, Cinematics and storyboard, Circuit breakers, Deterministic replay saves, Everything-is-invented denylist test (+12 more)

### Community 7 - "Pixel Art, Palette and Fonts"
Cohesion: 0.08
Nodes (34): Four-act visual progression, Story residue on the desk, Faded Power (visual thesis), Locked 32-colour palette, Three pixel fonts, Procedural pixel portraits, Jacquard 24 (font), Jersey 10 (font) (+26 more)

### Community 8 - "Brokerage Account"
Cohesion: 0.12
Nodes (3): emit(), mkBroker(), Broker

### Community 9 - "Story Briefings and Quotas"
Cohesion: 0.09
Nodes (15): applyPending(), bossMood(), briefing(), calls(), inbox(), onDayStart(), onTrade(), openWeek() (+7 more)

### Community 10 - "Rhythm Storyboard Layer"
Cohesion: 0.23
Nodes (24): big(), board(), chart(), clean(), closeFrame(), colors(), endingFrame(), figureSprite() (+16 more)

### Community 11 - "Render Regression Tests"
Cohesion: 0.10
Nodes (19): phoneRowCount(), captureOnly, {createCanvas}, crypto, digest(), endings, fs, groups (+11 more)

### Community 12 - "Chiptune Music"
Cohesion: 0.28
Nodes (17): applyBus(), bus(), ctx(), cue(), drum(), duck(), fadePresence(), play() (+9 more)

### Community 13 - "Phone Interruptions"
Cohesion: 0.22
Nodes (4): qty(), Interrupts, phoneHide(), renderTasks()

### Community 14 - "Personal Economy"
Cohesion: 0.18
Nodes (15): Personal economy (wallet, draw, bonus, rent), Risk desk discipline review, homeOf(), band(), charge(), ensure(), fresh(), move() (+7 more)

### Community 15 - "Ending Reachability Tests"
Cohesion: 0.18
Nodes (16): freshState(), advance(), archetypes, audit, clone(), counts, ctx, eqOf() (+8 more)

### Community 16 - "Storyboard Export Tool"
Cohesion: 0.15
Nodes (13): context, { createCanvas }, exportBeats(), fs, { load }, manifest, output, path (+5 more)

### Community 17 - "Headless Test Loader"
Cohesion: 0.20
Nodes (10): fs, GROUP(), load(), path, root, scripts(), vm, fs (Node built-in) (+2 more)

### Community 18 - "Balance and Unit Test Runners"
Cohesion: 0.22
Nodes (9): Headless test runners, ctx, { load, STUBS }, results, simulate(), styles, STUBS, ctx (+1 more)

### Community 19 - "Life Beats and Payroll"
Cohesion: 0.33
Nodes (8): Life beats (personal decisions), money(), applyLife(), bearishExposure(), lifeBeat(), onDayEnd(), payroll(), riskReview()

### Community 20 - "Ending Resolution"
Cohesion: 0.29
Nodes (8): resolve(), afterDay(), buildEnding(), liquidate(), votePasses(), assert(), clone(), walk()

### Community 21 - "The Ledger Subscription"
Cohesion: 0.32
Nodes (8): ledger(), ledgerAccess(), ledgerCancel(), ledgerCharge(), ledgerNote(), ledgerPrice(), ledgerSubscribe(), weekendLedger()

### Community 22 - "Full-Game Bot Simulation"
Cohesion: 0.40
Nodes (4): bot(), { load: loadGame, STUBS }, play(), POLICIES

## Knowledge Gaps
- **57 isolated node(s):** `captureOnly`, `{createCanvas}`, `crypto`, `endings`, `fs` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Game` connect `Game Loop and Sound Effects` to `Boot, Menus and Save Slots`, `Trading Desk HUD and Order Ticket`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `render()` connect `Trading Desk HUD and Order Ticket` to `Story Briefings and Quotas`, `Cinematics and Stress`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `captureOnly`, `{createCanvas}`, `crypto` to the rest of the system?**
  _57 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Boot, Menus and Save Slots` be split into smaller, more focused modules?**
  _Cohesion score 0.055206548638873025 - nodes in this community are weakly interconnected._
- **Should `Trading Desk HUD and Order Ticket` be split into smaller, more focused modules?**
  _Cohesion score 0.05826330532212885 - nodes in this community are weakly interconnected._
- **Should `Game Loop and Sound Effects` be split into smaller, more focused modules?**
  _Cohesion score 0.07010710808179163 - nodes in this community are weakly interconnected._
- **Should `Storyboard and Decision Scenes` be split into smaller, more focused modules?**
  _Cohesion score 0.07757885763000852 - nodes in this community are weakly interconnected._