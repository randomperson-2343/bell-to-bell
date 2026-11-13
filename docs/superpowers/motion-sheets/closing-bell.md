# Motion sheet: closing bell (first beat of `B.Scenes.close`)

## 1. Intent

4:00 PM, every session. The bell strikes and the room absorbs it. Nothing celebrates, and the desks sit a little in front of the wall. It should feel like routine punctuation, a little heavier each time. The single most important movement is **the bell's existing swing**, now paced so each half-swing lands on a strike of the `closeBell` sound.

## 2. Duration

**1.82 s** (today 1.25 s, limit 1.9 s). `closeBell` strikes five times, 0.26 s apart. The swing `sin(swing * 7π)` makes 7 half-swings. At `dur = 7 × 0.26 = 1.82` the bell passes centre exactly on each strike (t = 0, 0.26, 0.52, 0.78, 1.04), then dies away over three silent half-swings. Silent days use the same 1.82 s, so the silence takes up the slot the ringing used to fill.

## 3. Layers (back to front): normal days and session index 42

Add a fourth argument `part` to `SH.bellScene(ctx, swing, empty, part)` (scenes.js 279-348). With `part` undefined it draws exactly what it does today. Every layer `draw` and `animate` that paints 320 art goes through `at2x(c, fn, day)`.

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `wall` | `part === 'wall'`: scenes.js 280-306 (wall, gradient, skirting, carpet, clock, window and its static `windowWeather`) | 0.5 | 640x360 |
| `desks` | `part === 'desks'`: scenes.js 331-339 (five desks, screens lit, or dark when `empty`) | 1 | 640x360 |
| `frame` | Draws nothing (no-op `draw`). Its `animate` paints the `finePass` corner brackets (storyboard.js 355-359, alpha 0.65). | 0 | 640x360 |

Give `finePass` a fifth argument `which` (`'world'` = shot marks only, `'frame'` = brackets only, undefined = both), shared with the elevator sheet.

**Why the brackets and dashes are animate steps, not cached:** both are drawn with alpha. Drawing them straight onto the frame, in today's order, keeps `draw(..., 1)` pixel-identical to today's still. Caching them in a transparent layer can shift a colour by one level.

## 4. Camera

`camera: { from: { x: 0, y: -8, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: B.Motion.ease.out }` over the whole beat. The shot opens looking slightly up at the bell and settles fast, then rests. `out` puts most of the travel under the opening fade. Offsets: `desks` moves 8 px to 0, `wall` (with the bell) 4 px to 0. Uncovered rows are at most 4 at the top, under the 12 px letterbox. At the start the desk legs sit at view y 260, still above the caption (280). No zoom.

## 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Helper |
| --- | --- | --- | --- | --- | --- |
| Bell, bracket and sound waves | `wall` | 0-1.82 | `SH.bellScene(cc, bellSwing(day, p), empty, 'bell')` = scenes.js 308-329, unchanged maths. The offset is already whole art pixels. Full frame rate, no stepping. | as today | `bellSwing` (storyboard.js 740) |
| Walkers (only when `empty`) | `desks` | 0-1.82 | `part === 'walkers'` = scenes.js 341-347. Positions as today: `58 + 62i + Math.round(swing * 14)`. New two-pose legs: use pose B when `Math.round(swing * 14)` is odd, else today's `WALKER`. Pose B is `WALKER` with its last two rows `'1.1..'` replaced by `'.11..'` (add `WALKER_B` beside `WALKER`, scenes.js 33). | as today | none |
| Fine dashes | `desks` | whole beat | `finePass(c, day, { shot: 'bell' }, 'establish', 'world')` = storyboard.js 352-353, drawn after the walkers | `amber` alpha 0.5 | none |
| Corner brackets | `frame` | whole beat | `finePass(..., 'frame')` | act signal colour, alpha 0.65 | none |

That is about 350 rectangles per frame (bell 150, walkers 160, marks 16). Today this beat redraws the whole scene, dithers included, every frame, so this is cheaper.

## 6. Timeline (normal day)

- 0.00: the first strike sounds. The bell is at centre, swinging hard (±6 art px). The fade from black runs to 0.28, and the camera has settled most of its 8 px by about 0.5.
- 0.26, 0.52, 0.78, 1.04: the bell crosses centre on each strike. The bone wave marks spread outward. The outer wave drops out at 0.93, the middle one at 1.33 and the inner one at 1.73.
- 1.04-1.82: three silent half-swings, shrinking.
- 1.82: the bell hangs still at centre. Caption "4:00 PM." typed by 1.2.
- Empty floor (from session 25): four figures shuffle right 28 view px through the whole beat, legs alternating each art-pixel step.

## 7. Final frame (p = 1)

Pixel-identical to today's `close` first beat at p = 1. Camera at rest, bell at centre (`swing = 1` gives offset 0 and no waves), desks lit, or dark with the four walkers in today's pose (`round(14)` is even, so pose A). Dashes and brackets as today.

## 8. Variants

| Session index | Behaviour |
| --- | --- |
| 0-24 (normal) | As above, `empty = false`: lit screens, no walkers. |
| 25-41 and 43 (empty floor) | `empty = true`: dark screens, walkers walk out. Same camera and swing. |
| 42 | `swing = p * 0.45`, unchanged. Over 1.82 s the bell makes about 1.6 slow half-swings (centre crossings at 0, 0.58, 1.16, 1.73 s). All three waves stay up, spreading slowly. Walkers move 6 art px. Same camera. Final pose is today's: offset -1 art px, waves frozen mid-ring. |
| 44 and later (silent) | **Not layered.** Keep today's flat draw (`swing = 1`, `empty`, 0.45 ink overlay, `finePass`), with `cache: true`, `dur: 1.82` and `camera: { from: { y: 0 }, to: { y: 0 } }`. The explicit identity camera stops `presetFor` from adding a tilt now that the beat is 1.5 s or longer. Line "4:00 PM. NOBODY RINGS IT." Not one pixel moves for 1.82 s: after 44 sessions of a swinging bell, stillness is the motion. |

Season: the window (`SEASON` set by `at2x`) is drawn in the cached `wall` layer, as today. No moving weather here; the bell is the subject.

## 9. Sound cues

None. The beat's own `sfx: 'closeBell'` stays and now lines up with the swing.

**Needs a ruling (not built unless approved):** on silent days the beat still fires `closeBell` today, under the line "NOBODY RINGS IT." I recommend `sfx: 'room'` (low room tone) on index 44 and later. If not approved, leave `closeBell`.

## 10. Risks and fallbacks

- **Tilt crawl on the wall gradient** (4 one-pixel steps) and the desk-screen dither (8 steps). Fallback 1: `wall` depth 0 (pinned) and `desks` depth 0.5. Fallback 2: no `camera`, and the swing carries the shot.
- **p = 1 hash.** It relies on the composite order wall, bell, desks, walkers, dashes, brackets, with dashes and brackets in `animate` steps. If the engine cannot run an `animate` on a layer whose `draw` is a no-op, put the brackets at the end of `desks.animate` instead. They then ride the 8 px tilt, which is acceptable.
- **Length.** It adds 0.57 s per session (46 sessions). If the owner finds it slow, go back to 1.25 s with the same layers. The cadence lock is lost but nothing else changes. Do not choose a value in between.
- **Walk cycle.** At about 8 alternations a second the figures shuffle. If it reads as jitter, drop pose B (today's glide).
- `beats[0]` today is built with `Object.assign` over the rhythm beat. Keep the id (`close:<tag>:bell`), `sfx` and `transition: 'fade'`, and replace `cache: false` and `draw` with the layered version through `B.Motion.layered`.
