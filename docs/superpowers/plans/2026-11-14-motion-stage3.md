# Cutscene Motion Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan batch by batch.

**Goal:** Give every remaining cutscene shot the layered or animated treatment the owner approved in the pilot.

**Architecture:** No engine changes are planned. Each batch reworks a group of shots with `B.Motion.layered`, following the three pilot shots (`elevatorOpening`, `bellLayers`, `saturdayLayers` in `js/art/storyboard.js`). A small shared kit of reusable moving elements is built first so shots stay consistent and cheap to build.

**Spec:** `docs/superpowers/specs/2026-11-13-motion-engine-design.md`. Pilot plan and its Global Constraints: `docs/superpowers/plans/2026-11-13-motion-engine-pilot.md`. Every Global Constraint there binds this plan too.

## Additional constraints learned in the pilot

- A shot's key movement must cover at least about 20x20 px and be clearly brighter or darker than its surroundings. A 2 px change is background life only.
- Check what the existing art does at the far end of a movement before keeping it.
- Do not add moving particles on top of dense static speckle. Thin or replace the static texture in that layer instead.
- No zoom and no sideways camera on flat or dithered art. Vertical whole-pixel tilts and parallax only, unless a layer is oversized and free of dither.
- Layers paint source-over only. Legacy 320x180 art goes through `at2x`, never nested.
- `draw(ctx, view, 1, opts)` must be a complete, good still and must run in Node with no DOM and no settings.
- Timing: a morning chain (news + phone + office) may grow at most 3 s in total against the pre-overhaul lengths. Any other beat may grow at most 50%.
- `render-run.js` thresholds are floors: newsUnique >= 41, establishGroups >= 38 (now 39, one of margin), endingUnique 22, weekendUnique 9. A batch that would drop establishGroups below 39 must say so before committing.
- Phone performance limits hold for every reworked shot: average under 8 ms, no frame over 33 ms, first frame of each beat excluded, measured at 844x390, device pixel ratio 3, CPU throttle 4.
- The coordinator checks shimmer on captures taken at a 1440x900 viewport, not only at exact-scale sizes.

## Two tiers of treatment

- **Tier 1, full layers:** the art is split into depth layers with parallax, plus moving elements. For shots seen often or at key story moments.
- **Tier 2, living still:** the existing picture is one cached layer, with moving elements on top and a whole-pixel camera tilt. For shots seen once or twice.

The designer assigns the tier per shot in the motion bible.

## Deliverables and order

| # | Batch | Shots | Seen |
| --- | --- | --- | --- |
| 0 | Motion bible and kit design | Designer writes `docs/superpowers/motion-sheets/stage3-bible.md`: the shared kit, a tier and one-line motion for every remaining shot, and a full sheet per batch | n/a |
| 1 | Shared kit | `B.MotionKit` in a new file `js/art/motion-kit.js`: the reusable moving elements the bible names, each a pure function drawing from time, with unit tests | n/a |
| 2 | Morning routine | `phone` (handoff, read), `office` (wide, desk, hold) | every session |
| 3 | Close chain | `close` report card and hold, Sqwak breaking insert and read | every session |
| 4 | Act cards and document inserts | act card, the eight document close-ups (`DOC_DRAW`), `deskWithDoc`, `establishDoc` variants | about 25 sessions |
| 5 | Places | `placeFrame` places (apartment, subway, lobby, kitchen, street, rideshare, platform, breakroom, desk), trading floor lit and dark, TV, skyline, racks, the remaining elevator beats | about 20 sessions |
| 6 | Story tableaux | `briefingTableau` set pieces used by the `tableau` shot | 9 sessions |
| 7 | Decisions | the rooms in `js/art/decisions.js` and the speaker close-up | every decision |
| 8 | Weekend remainder | Sunday shot, hold, the whip room, the 3:17 floor | 9 weekends |
| 9 | Endings | `endingWorld`, the ending card, `lastLight` | once per run |
| 10 | Final regression and owner review | all runners, a full reel, documentation | n/a |

## How each build batch runs

1. The implementer reads the batch's sheet in the bible, the pilot code, and the Global Constraints.
2. Failing asserts first in `js/tests/motion-run.js`: each reworked beat has `layers`; its picture changes between `t = 0.1` and `dur - 0.1`; the same time gives the same picture; Screen effects `reduced` gives one still; a representative scene is added to the perf list.
3. Build. Existing flat callers of a drawing function must look the same unless the sheet says otherwise.
4. Run all five runners (`node-run`, `motion-run`, `browser-run`, `render-run`, `phone-run`).
5. Capture a strip and video per reworked shot type with `js/tests/motion-capture.js` into `qa/evidence/motion/`.
6. Commit. The reviewer checks the batch against its sheet; the coordinator views the strips.

The designer critiques built batches in groups (after batches 3, 6 and 9), and fixes from a critique go back to the implementer as one round.
