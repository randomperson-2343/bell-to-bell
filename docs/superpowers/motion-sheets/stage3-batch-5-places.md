# Stage 3, batch 5: places

The places a morning's news finds you: the `placeFrame` compositions, the apartment and TV, the lobby elevator, the trading floor lit and dark, the false-dawn skyline, the rack room, and every news hold. Binding: the bible (`stage3-bible.md`) sections A and C, the stage 3 plan's constraints, and the batch 2 and 3 critique: one key movement per shot, at least about 20x20 px and contrasting; never a count stepping back across a cut; nothing that shifts layout as it grows; only the kit's three blink rates; no particles over static speckle. Notation as batch 4 (`K`, `M`, `X`, `P`, `R`, `SH`). Line numbers: `storyboard.js` unless marked `rhythm.js` or `scenes.js`.

All shots are tier 2. No durations change. One establish final frame changes (street, Shot 2; a ruling); establishGroups is otherwise untouched.

## 0. Shared

### 0.1 Code changes (all optional; absent, every function draws exactly what it draws today)

1. `framed(ctx, day, r, title, o)`: as batch 4 0.1.1 (`o.draw`, `o.noBack`). Batch 5 relies on it for every establish.
2. `rhythm.js` `placeFrame(ctx, sb, headline, detail, o)` (170-235):
   - `o.part` `'back'` = 172-226 (ink, skyline, floor, the place's own block); `'front'` = 227-234 (wire monitor, commuter, the camera's marker props, the 0.08 scanlines). Undefined: both.
   - `o.noSpeckle`: passed to `skyline` at 173 and 212.
3. `rhythm.js` `skyline(ctx, act, seed, y, day, noSpeckle)` (74-88): passes `noSpeckle` to `weather` at 87 (which already takes it: snow speckle skipped, autumn leaves kept).
4. `skylineShot(ctx, day, title, o)` (110-128): `o.part` `'city'` = 112-123, where windows with `o.skip[0] <= k < o.skip[1]` are not drawn; `'top'` = 124-127, with `o.noLabel` skipping 126 (the LIGHTS ON text).
5. New helper in `scenes.js`, `floorGeom(zoom, seed)`, exported on `SH`: the glass rects of the two near desk rows of `tradingFloor` (rows `r = 2, 3`), in 320x180 art units, computed with exactly the arithmetic of 167-221 (`z = 1 + zoom * 2.4`, `sx`, `sy`, `sw`; for each `i = -1..11` not skipped by line 210: `mh`, `mw`, `gx`, `gy`, `gw`, `gh` of 212-214), each `{ r, i, x: gx, y: gy, w: gw, h: gh }`. `tradingFloor` itself is not changed.
6. Nothing changes in `SH.elevator` (the pilot parts are reused), `SH.apartment`, `SH.tvSet` or `racksShot`.

### 0.2 Which beats this batch reworks

Ids as batch 4: `news:<d>[v]:<phase>`, `v = ':' + r.arg` on variant mornings. `r = row(day, story(o))`, `sb = R.storyboard(day)`, `place = sb.place = PLACES[day % 10]`.

| Shot | Beat and condition | Sessions in `SHEET` and `variant()` (framing of the establish) |
| --- | --- | --- |
| 1 subway, platform | establish and detail, `r.shot === 'place'`, place `subway` or `platform` | 7 platform (L; profile 1.18), 21 subway (L; wide), 31 subway (M; insert 1.34) |
| 2 street | establish and detail, place `street` | 34 (M; wide) |
| 3 wire monitor (kitchen, breakroom, lobby comp, desk, rideshare and apartment comps) | establish where `placeFrame` draws it (kitchen, breakroom, rideshare; days 46 and later also others), and every `place` detail not covered by 1 or 2 | establish 13 kitchen (S, 2.4 s; insert 1.34); detail 16, 22, 26, 42 (the lobby comp) |
| 4 apartment and TV | establish, `r.shot === 'tv'`; establish, `r.doc === 'rating'`; establish, place `apartment` | 18 tv (S, 2.4 s; profile 1.18), 4 rating (M; insert 1.34), 14 rating (M; profile 1.18). Apartment place: none |
| 5 lobby elevator | establish, place `lobby` or `elevator`; `news:0:detail`; `news:0:hold` | 16 (profile), 22 (profile), 26 (over-shoulder), 42 (over-shoulder); session 1 detail and hold |
| 6 floor lit | establish and detail, `r.shot === 'floor'`; establish, `r.doc === 'ticket'` | 41 floor (XL; profile); tickets 5 (insert 1.34), 12 (profile), 23 (over-shoulder), 39 (close 1.34), variant 4 `dump` (insert), variant 22 `ban` (over-shoulder) |
| 7 floor dark | establish and hold, `r.shot === 'dark'`; detail when `r.arg` is empty | 10 (L; insert 1.34; detail is the memo, batch 4), 44 (XL; profile; detail here), variant 22 `fail` (L; profile) |
| 8 skyline | establish, `r.shot === 'skyline'` | 27, 28, 29, 35 (S, 2.4 s; flat) |
| 9 racks | establish, `r.shot === 'racks'` | variant 45 `pulledPlug` (XL; profile 1.18) |
| 10 holds | `news:<d>[v]:hold` | see Shot 10 |

The establish and detail beats of other shot kinds belong to batch 4 (documents), 6 (tableaux) and 7 (vote rooms).

### 0.3 Common layer pattern

- **Establish**: art layers through `framed(c, day, r, title, { draw, noBack })`; the topmost art layer then draws `finePass(c, day, r, 'establish', 'world')` (screen space, after `framed`, as line 871); a top `marks` layer, depth 0, cached: `finePass(c, day, r, 'establish', 'frame'); tell(c, day)`. With a tilt, art layers are depth 1 and `marks` depth 0, so brackets and the tear never move (C7) while the world marks move with the world.
- **Detail** (`place`, `floor`, `elevator`, `dark` without arg): as the establish without `framed` (line 873 has none) and without `tell`: the top art layer draws `finePass(c, day, r, 'detail', 'world')`, `marks` draws `finePass(c, day, r, 'detail', 'frame')`.
- **Hold**: art layer(s) at rest with any continuing life, then the `dim` layer (line 874's 0.18 ink rect), depth 0. `camera: null`.
- **Tilt** (C4 a): `{ from: { x: 0, y: -6, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.inOut }` on establish and detail beats of Shots 1 to 6. At most 6 rows uncovered, under the letterbox. Shots 7 to 9 and holds: `camera: null`.
- **Coordinates.** `placeFrame`, `skylineShot`, `racksShot`: native 640x360. `SH.*` set pieces: 320x180 art units inside `at2x`, and inside `framed()`'s zoom on establishes (total scale 2, 2.36, 2.48 or 2.68). Every animated value for set pieces is given in art units and moves in whole art units.

---

## Shot 1: subway and platform (`placeFrame`, subway / platform)

### 1. Intent
Waiting on the platform before six, the wire on the station monitor. A lit train sweeps past behind the window cells without stopping. Key movement: **a lit train crossing the seven window cells** (two rows of bone windows, 252 px long, moving at 360 px/s across 628 px).

### 2. Duration
Establish 1.7 s (`fade`), detail 2.3 s (`cross`), unchanged. Captions: establish the date (0.22 to 1.155), detail the title (0.22 to 1.37).

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `back` | establish: `framed(c, day, r, title, { draw: (cc) => R.placeFrame(cc, sb, title, false, { part: 'back' }) })`; detail: `R.placeFrame(c, sb, title, true, { part: 'back' })` (`rhythm.js` 172-226: skyline, the plasticD wall, the seven cells, floor, LEDs, benches) | 1 | 640x360 |
| `train` | animate-only (`draw() {}`) | 1 | 640x360 |
| `front` | the same call with `part: 'front'` (227-234: wire monitor, commuter, camera props, scanlines; drawn with `noBack: true` on establishes), then `finePass(..., 'world')` | 1 | 640x360 |
| `marks` | 0.3 | 0 | 640x360 |

The monitor and the world marks' vertical lines cross the cells, so the train runs in a sandwich, under them.

### 4. Camera
Tilt (0.3).

### 5. Animated elements (on `train`; `placeFrame` coordinates, inside `framed(..., { noBack: true })` on establishes)

Cell `i = 0..6` (`celIn` at `rhythm.js` 177): flat `P.screenD` interior `(24 + 94 i, 58, 64, 80)`. For each cell and each of two rows, one `K.passing` call clipped to that cell, timed so the seven pieces are one train: `at_i = A + (94 i) / 360`.

```
K.passing(c, 24 + 94 i, 58, 64, 60, 'news:' + day + ':train', t, { kind: 'train', at: at_i, speed: 360 })  // windows at y 85
K.passing(c, 24 + 94 i, 68, 64, 60, 'news:' + day + ':train', t, { kind: 'train', at: at_i, speed: 360 })  // windows at y 95
```

`A = -0.90` on the establish, `-0.30` on the detail. The train's tail leaves cell 6 at `A + 2.42` (1.52 s establish, 2.12 s detail), before the beat ends, so the final frame has no train.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Train | establish 0-1.52, detail 0-2.12 | Windows 10x6 at alpha 0.55, 18 px apart, two rows 4 px apart, left to right, whole pixels. On the establish the train is already crossing as the fade lifts (head at x 338 at t = 0) and clears the last cell at 1.52; on the detail its head is at x 230 when the cross ends. | `bone` 0.55 | passing (train) |

Cost: at most 28 visible rects. The bible's commuter idle is dropped: the commuter is drawn before the camera props, which can overlap him (the close camera's figure), so moving him would need a third cached layer; and one key movement is enough.

### 6. Timeline
Establish: fade up with the train already passing behind the cells; the date types from 0.22; the train's last window clears at 1.52; still to 1.70. Detail: the cross ends at 0.30 with the train mid-platform; it clears at 2.12.

### 7. Final frame (p = 1)
Today's establish and detail exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Session 7 platform (act 1, autumn; board camera over-shoulder, crop 36) | Monitor at x 106 covers cells 1 to 3 on the establish; the train shows in cells 0 and 4 to 6 and between. Over-shoulder figure cached in `front`. |
| Session 21 subway (act 3, grey; profile, crop -42) | Monitor at x 28. Framing wide (no zoom). |
| Session 31 subway (act 3, grey; profile) | Framing insert 1.34: the train is scaled with the art; cells 0 and 6 partly off frame. |
| Detail (all three) | Larger monitor (300x170 at y 56) covers more cells; no commuter. Same train, `A = -0.30`. |
| Season | Skyline weather sits above the wall (y < 26), static; no particles. |
| Act | Monitor band colour, cached. |

### 9. Sound cues
Establish: `cues: [{ at: 0.30, sfx: 'transit' }]` (the beat's own `sfx` is `apartment`). Detail: none (`broadcast`).

### 10. Risks and fallbacks
- **Key movement under the fade.** On the establish the first 0.28 s of the pass is under the fade (C2 allows only background life there); the visible pass 0.28 to 1.52 still crosses five cells. Fallback: `A = -0.60` (clears at 1.82: the last window would then be in the final frame; not taken).
- **Strobing** on a throttled phone at 30 fps (12 px a frame against 18 px spacing). If the strip shows the windows crawling backwards, fallback `speed: 300` with `A = -1.30`.

---

## Shot 2: street (`placeFrame`, street)

### 1. Intent
Outside, early, snow over the towers, cars already on the road. Key movement: **headlights passing along the kerb line**, left to right, every 0.45 s. Background life: falling snow in place of the static speckle.

### 2. Duration
Establish 1.7 s, detail 2.3 s, unchanged.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `back` | as Shot 1 with `{ part: 'back', noSpeckle: true }` | 1 | 640x360 |
| `road` | animate-only | 1 | 640x360 |
| `front` | as Shot 1 (`part: 'front'`, `finePass` world) | 1 | 640x360 |
| `marks` | 0.3 | 0 | 640x360 |

The commuter (head at y 204, feet at 332) and the close camera's figure stand in front of the road, so cars and snow pass behind them.

### 4. Camera
Tilt.

### 5. Animated elements (on `road`; `placeFrame` coordinates)

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Snow | whole beat | `K.weather(c, 0, 12, 640, 220, day, 'news:' + day + ':snow', t, { max: 40 })` (above the posts and kerb; the skyline's own weather area is y 0 to 232). In autumn and grey weeks this gives paper or rain; only session 34 (winter, snow 0.33) is in the sheet. | `white` (snow) | weather |
| Cars | 0.30 on | `K.passing(c, 0, 238, 640, 10, 'news:' + day + ':cars', t, { kind: 'car', at: 0.30, every: 0.45, speed: 220, dir: 1 })`: headlight pairs at y 242, crimson tails 40 px behind, along the amberD kerb (249) in front of the posts. | `bone`, `crimson` | passing (car) |

Cost: about 40 snow plus about 12 car rects.

### 6. Timeline
Fade up on falling snow; the first car's lights enter from the left at 0.30 and cross in about 3 s; a new car every 0.45 s; snow throughout.

### 7. Final frame (p = 1)
**Changes**: the static snow speckle over the skyline is replaced by the snowflakes' pose at `t = dur`, and two to four car-light groups sit on the kerb line. Session 34 is the only street session, so no two opening stills become more alike.

### 8. Variants
Session 34 (act 4, winter; board camera close, crop 74: the close figure at x 516 covers the right third of the road). Detail: larger monitor, no commuter, same road. A street on an autumn or grey day (days 46 and later only) keeps its static leaves and gains falling paper or rain.

### 9. Sound cues
Establish: `{ at: 0.30, sfx: 'street' }`. Detail: none.

### 10. Risks and fallbacks
- **Small lights.** Each car is 4x2 px pairs; the read is the movement across the frame, not the size. Fallback: none needed for the snow; if the cars do not read, drop them and keep the snow (then the final frame still changes).
- **Final frame ruling** (see report). Fallback: no snow, static speckle kept, cars only; the final frame still gains the car lights.

---

## Shot 3: the wire monitor (kitchen, breakroom, and every other `placeFrame` comp)

### 1. Intent
The station, kitchen or lobby screen refreshes with the overnight wire. Key movement: **the wire monitor's refresh: a band rolls down the screen and the signal band flashes as it is reached** (one screen event, C1: the refresh that brings the update).

### 2. Duration
Unchanged: kitchen establish 2.4 s (S), lobby details 2.3 s.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `place` | establish: `framed(c, day, r, title, { draw: (cc) => R.placeFrame(cc, sb, title, false) })` then `finePass(..., 'world')`; detail: `R.placeFrame(c, sb, title, true)` then `finePass(..., 'detail', 'world')` | 1 | 640x360 |
| `marks` | 0.3 | 0 | 640x360 |

Nothing is drawn over the monitor in any comp (the commuter and camera props are clear of it), so no split.

### 4. Camera
Tilt.

### 5. Animated elements (on `place`, `placeFrame` coordinates, inside `framed(..., { noBack: true })` on the establish)

Monitor (`rhythm.js` 227): `mx = clamp(70 + sb.crop, 24, 330)`, `my = detail ? 56 : 76`, `mw = detail ? 300 : 250`, `mh = detail ? 170 : 142`. Signal band `(mx + 3, my + mh - 48, mw - 6, 45)`. `tf = 0.40 + 0.36 * (mh - 42) / (mh + 6)`: the moment the roll band's bottom edge reaches the signal band (0.64 s establish, 0.66 s detail).

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Roll | 0.40-0.76 | `K.crt(c, mx, my, mw, mh, t, { mode: 'roll', at: 0.40, dur: 0.36 })` | `phosphorD` 0.22, `phosphor` 0.4 edge | crt |
| Update | `tf` to `tf + 0.08` | `K.ping(c, t, { at: tf, off: [], on: [], flare: { x: mx + 3, y: my + mh - 48, w: mw - 6, h: 45, col: P.bone, a: 0.15, dur: 0.08 } })`: a 244x45 (or 294x45) flash on the signal band. | `bone` 0.15 | ping |

Cost: 3 rects.

### 6. Timeline
0.40 the band starts down the screen; at about 0.65 it reaches the signal band, which flashes; the band leaves the screen at 0.76; still to the end.

### 7. Final frame (p = 1)
Today's picture exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Session 13 kitchen establish (act 2, grey; insert camera, crop -88: monitor at x 24, the insert card at 468; framing insert 1.34, so the monitor's left 77 px are off frame) | As above, inside the zoom. |
| Lobby comp details 16, 22, 26, 42 (`elevator` / `lobby` places) | Monitor at x 28 (16, 26; crop -42) or 106 (22, 42; crop 36, over-shoulder figure cached). The comp's own wall screen (526, 84) does not change (one event per beat). |
| Breakroom, desk, rideshare, apartment comps (days 46 and later only; no story session lands on them) | Same refresh. The bible's desk-chart tick and rideshare streetlights are not built: no story session shows these comps. |
| Act | Signal band colour (cached); the flare is bone (screens ignore the act, C1 and C3). |

### 9. Sound cues
Kitchen and breakroom establishes: `{ at: 0.30, sfx: 'kitchen' }`. Rideshare establish (unseen): `{ at: 0.30, sfx: 'street' }`. Details: none.

### 10. Risks and fallbacks
- **The 6 px band** is the critique's weakest read; here the flare on the signal band carries the update. If the coordinator rules the roll plus flare to be two events, keep only the flare.

---

## Shot 4: apartment and TV (`SH.apartment` + `SH.tvSet`)

### 1. Intent
Pre-dawn, the TV on in the dark room. The broadcast cuts to a graphic and back; the blinds' glow dims while the screen is dark. Key movement: **the TV picture cutting to a graphic for 0.6 s** (100x48 art units: 200 to 268 px wide on screen).

### 2. Duration
Unchanged: tv 2.4 s (S, caption the title 0.22 to 1.37), rating establish 1.7 s (caption the date 0.22 to 1.155).

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `room` | `framed(c, day, r, title, { draw: (cc) => at2x(cc, (c2) => { SH.apartment(c2, G); SH.tvSet(c2, 40, 50, 104, 68, H, act(day), 0); }, day) })` (lines 286, 300, 369; `scenes.js` 46-83, 86-111), then `finePass(..., 'world')` | 1 | 640x360 |
| `marks` | 0.3 | 0 | 640x360 |

`G` = 0.7 (tv, rating) or 0.5 (apartment place); `H = r.arg || title` (tv, rating) or `title` (place).

### 4. Camera
Tilt.

### 5. Animated elements (on `room`; `SH.apartment` / `tvSet` art units inside `framed(..., { noBack: true })` and `at2x`)

TV screen inner area above the ticker: `(42, 52, 100, 48)` (`scenes.js` 96-97). Cut span `[a, b)`: tv `[0.55, 1.15)`, rating and place `[0.45, 0.95)`.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Graphic | `a`-`b` | During the span: `X.rect(c, 42, 52, 100, 48, P.screen)`; three bars `X.rect(c, 56 + 26 k, 92 - hk, 14, hk, k === 2 ? P.crimson : P.phosphor)`, `hk = [20, 28, 12][k]`; a baseline `X.rect(c, 50, 92, 84, 1, P.screenGlow)`; `X.scanlines(c, 42, 52, 100, 48, P.ink, 0.2)` (the TV's own scanline strength). Hard cut in and out; the ticker band, kicker and headline (y 100 to 116) stay. | `screen`, `phosphor`, `crimson`, `screenGlow` (hardware, not the act) | ping-style hard steps (drawn directly) |
| Wall glow | `a`-`b` | `K.flicker(c, 0, 73, 184, 47, 'news:' + day + ':tv', t, { spans: [[a, b]], col: P.ink, a: 0.15 })`: the blinds' glow bands (`scenes.js` 74-76) step darker while the screen shows the dark graphic. | `ink` 0.15 | flicker |

Cost: about 50 rects during the span, 0 otherwise.

### 6. Timeline
Tilt across the beat; at `a` the anchor cuts to the bar graphic and the wall darkens a step; at `b` it cuts back; still to the end.

### 7. Final frame (p = 1)
Today's picture exactly (anchor on screen).

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Session 18 tv (act 3; profile 1.18, total 2.36x) | Kicker `III · CONTAGION`, headline the title. |
| Sessions 4 and 14 rating (insert 1.34; profile 1.18) | Headline the rating line. Session 4 with `c1` `dump` or `leak` is a ticket or post instead (Shot 6, batch 4). |
| Apartment place (`G = 0.5`; no story session) | Same. |
| Season | The window's autumn dither (session 4) or nothing (grey 14, 18) is cached; no particles. |

### 9. Sound cues
None (tv `room`, rating `apartment`; the broadcast that follows plays `broadcast`).

### 10. Risks and fallbacks
- **The graphic is a flat panel over the screen's gradient** (C8 permits covers only on named flat fills). It is a visible new picture, not a disguised cover; ruling requested. Fallback: no panel; `K.crt` roll on `(40, 50, 104, 68)` at 0.45 plus the wall flicker.

---

## Shot 5: lobby elevator (`SH.elevator` places; `news:0:detail`; `news:0:hold`)

### 1. Intent
The lobby, the car arriving at 41. Key movement: **the doors sliding from closed to the day's opening** (the pilot's door part; each door 17 to 24 art units, 34 to 57 px on screen).

### 2. Duration
Unchanged: place establishes 1.7 s, `news:0:detail` 2.3 s, `news:0:hold` 1.1 s.

### 3. Layers (the pilot's parts, never a nested `at2x`)

`E(part, open, floor)` = `(c) => at2x(c, (cc) => SH.elevator(cc, open, floor, part), day)`, wrapped in `framed(..., { draw })` on place establishes (none on session 1's detail and hold).

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `room` | `E('car')` then `E('lobby')` then `E('number', 0, 41)` (`scenes.js` 119-144: car, lobby with the doorway unpainted, indicator showing 41) | 1 | 640x360 |
| `frame` | `E('frame')` (159-162) then `finePass(..., 'world')` | 1 | 640x360 |
| `marks` / `dim` | establish and detail: 0.3 `marks`; hold: 0.3 `dim` | 0 | 640x360 |

One split (doors between `room` and `frame`, as the art draws them).

### 4. Camera
Place establishes: tilt. `news:0:detail` and `news:0:hold`: `camera: null`.

### 5. Animated elements (on `room`; `SH.elevator` art units)

| What | Beat | Start-end (s) | Movement | Kit |
| --- | --- | --- | --- | --- |
| Doors | place establish | 0.35-1.15 | `open = O * M.ease.inOut(K.span(t, 0.35, 1.15))`, `O = 0.15 + (day % 5) * 0.12` (line 301); `at2x(c, (cc) => SH.elevator(cc, open, 41, 'doors'), day)` inside `framed(..., { noBack: true })`. Closed until 0.35; slide = `round(open * 62)` art units. | pilot part |
| Car light | place establish | 1.30-1.36 | Before the doors: `K.flicker(c, 96, 24, 128, 108, 'news:' + day + ':car', t, { spans: [[1.30, 1.36]], col: P.ink, a: 0.2 })` in `at2x`: one stutter of the car's ceiling light (background life). | flicker |
| Doors | `news:0:detail` | 0.35-1.05 | `open = 0.6 + 0.4 * M.ease.inOut(K.span(t, 0.35, 1.05))`: from where the pilot opening left them (0.6) to fully open (the detail's art, `open = 1`), so the cut from the establish does not jump. | pilot part |
| Doors | `news:0:hold` | 0.20-0.90 | `open = 1.0 - 0.4 * M.ease.inOut(K.span(t, 0.20, 0.90))`: from the detail's fully open doors back to the hold's art (0.6). Today's stills already step from 1.0 to 0.6 at this cut; this turns the jump into the doors starting to close. | pilot part |

Cost: about 40 rects.

### 6. Timeline
Place establish: tilt; doors shut; 0.35-1.15 they part to the day's gap; a stutter in the car at 1.30. Session 1 detail: cross in on the doors at 0.6; they finish opening by 1.05. Session 1 hold: cut in fully open; they drift to 0.6 by 0.90.

### 7. Final frame (p = 1)
Today's pictures exactly (place establish at `O`, detail at 1, hold at 0.6 under its dim).

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Session 16 (`day % 5 = 1`, `O = 0.27`, slide 17), 26 (`O = 0.27`) | Profile 1.18 and over-shoulder 1.18 framing. |
| Sessions 22 and 42 (`O = 0.39`, slide 24) | Profile 1.18, over-shoulder 1.18. Session 22 with `c5` `fail`, `ban` or `bail` is a dark floor or a document instead. |
| Season | The lobby has no window; nothing. |
| `news:0:*` | Floor number 41 throughout (the pilot's count ended there). |

### 9. Sound cues
Place establishes: `{ at: 0.35, sfx: 'elevator' }` (own `sfx` `apartment`). Session 1 detail and hold: none (the pilot establish played `elevator` at 1.05).

### 10. Risks and fallbacks
- **The hold moves** (the bible gives holds no key movement); justified by continuity across the cut. Fallback: hold flat at 0.6 (today's jump).

---

## Shot 6: trading floor, lit (`SH.tradingFloor(c, zoom, true, day)`)

### 1. Intent
The floor before the open, every near screen refreshing in a wave. Key movement: **a refresh wave crossing the near-row screens, left to right** (bands across screens 60 to 190 px wide on screen).

### 2. Duration
Unchanged: establish 1.7 s, floor detail 2.3 s.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `floor` | `framed(c, day, r, title, { draw: (cc) => at2x(cc, (c2) => SH.tradingFloor(c2, Z, true, day), day) })` (lines 290, 370, 411; `scenes.js` 166-246), then `finePass(..., 'world')` | 1 | 640x360 |
| `marks` | 0.3 | 0 | 640x360 |

`Z` = 0.15 (floor establish), 0.7 (floor detail), `0.45 + (day % 4) * 0.08` (ticket establish).

### 4. Camera
Tilt.

### 5. Animated elements (on `floor`; `tradingFloor` art units, inside `framed(..., { noBack: true })` and `at2x`)

`S = SH.floorGeom(Z, day)`, minus, when `Z > 0.12`, any screen with `x < 26` or `x + w > 286` (the foreground colleagues' sprites, `scenes.js` 239-245, cover those).

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Wave | 0.35-1.21 | For each screen `g` in `S`: `K.crt(c, g.x, g.y, g.w, g.h, t, { mode: 'roll', at: 0.35 + 0.5 * clamp((g.x + g.w / 2) / 320, 0, 1), dur: 0.36, band: 6 })`. The band and its edge are overlays on the dithered glass (bible risk: never a cover). Band 6 art units = 12 to 16 screen px. | `phosphorD` 0.22, `phosphor` 0.4 | crt roll |

Cost: about 12 screens, 24 rects. The bible's figure idle is not built: the traders are drawn inline as cels in `tradingFloor` (227-230), not as sprites, so they cannot move without redrawing art.

### 6. Timeline
Tilt across the beat; from 0.35 the bands start on the leftmost near screens and sweep right, the last ending about 1.21; still.

### 7. Final frame (p = 1)
Today's picture exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Session 41 floor (winter: static window speckle, no particles; profile 1.18) | Establish at zoom 0.15 (screens about 86x39 art); detail at 0.7 (two or three huge screens). |
| Tickets 5 (`Z` 0.53), 12 (0.45), 23 (0.69), 39 (0.69), variant 4 `dump` (0.45), variant 22 `ban` (0.61) | Wave as above; edge screens under the colleagues skipped. |
| Late pattern (`seed >= 45`: some screens dark) | No story session reaches it on the lit floor; dark screens (`late && !on`) are skipped (the dead stay dead). |
| Act, market | None read. |

### 9. Sound cues
Ticket establishes: `{ at: 0.30, sfx: 'office' }` (own `sfx` `apartment`). Floor establish and detail: none (own `office`, `broadcast`).

### 10. Risks and fallbacks
- Screens are dither at 2x and more; the band is an alpha overlay, so it is safe on dither. If 12 rolls read as noise, fallback: row 3 only.

---

## Shot 7: trading floor, dark (`dark`; `news:44:detail`)

### 1. Intent
The floor after the desks were cleared. The last lit screens stutter like failing tubes. Key movement: **the biggest near screen stuttering in hard steps** (about 172x78 px at the establish, 0.5 ink in four bursts). The others flicker at random, lightly.

### 2. Duration
Unchanged: establish 1.7 s, detail 2.3 s, hold 1.1 s.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `floor` | establish: `framed(..., { draw: (cc) => at2x(cc, (c2) => { SH.tradingFloor(c2, 0.15, false, day); 0.42 ink rect }, day) })` (line 371) then `finePass(..., 'world')`; detail (session 44): `at2x(c, (cc) => SH.tradingFloor(cc, 0.7, false, day), day)` (line 408) then `finePass(..., 'detail', 'world')`; hold: line 371's picture | 1 | 640x360 |
| `marks` / `dim` | 0.3 | 0 | 640x360 |

### 4. Camera
`camera: null` (C4 d; the stutter is the event).

### 5. Animated elements (on `floor`; art units inside `at2x`, and `framed` on the establish)

`S = SH.floorGeom(zoom, day)` (0.15 or 0.7). Key screen `K0` = the row 3 screen whose centre is nearest x 160; the others `S - K0`.

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Key stutter | establish, detail | 0.40-1.25 | `K.flicker(c, K0.x, K0.y, K0.w, K0.h, 'news:' + day + ':k', t, { spans: [[0.40, 0.46], [0.52, 0.70], [0.78, 0.82], [0.95, 1.25]], col: P.ink, a: 0.5 })` | `ink` 0.5 | flicker |
| Others | establish, detail, hold | 0.30 to `dur - 0.10` | each `g`: `K.flicker(c, g.x, g.y, g.w, g.h, 'news:' + day + ':' + g.r + ':' + g.i, t, { from: 0.30, to: dur - 0.10, rate: 12, chance: 0.07, col: P.ink, a: 0.3 })` | `ink` 0.3 | flicker |
| Key on the hold | hold | 0.10-1.00 | as Others with `chance: 0.15`, seed `...:k` (the stutter goes on behind the dim) | `ink` 0.5 | flicker |

All flicker ends lit, so the final frame is the art. No screen goes out: the bible's "one goes out" would have to stay out in the detail and hold of the same chain (C1, the dead stay dead), which would change two more stills; stutter only. Cost: about 12 rects.

### 6. Timeline
Establish: cut or fade up on the dark floor; from 0.40 the centre screen stutters four times; the rest blink dark now and then; all lit at the end. Detail (44): the same on the pushed-in floor. Hold: stutter continues under the dim.

### 7. Final frame (p = 1)
Today's pictures exactly.

### 8. Variants
Session 10 (act 2, autumn; insert 1.34; detail is the memo, batch 4); session 44 (act 4, winter; profile 1.18; detail here at zoom 0.7, which is not dimmed); variant 22 `fail` (`NO RESCUE · DESKS CLEARED`; profile; detail memo). Static window speckle in winter cached; no particles.

### 9. Sound cues
None (own `office`).

### 10. Risks and fallbacks
- 0.5 ink over a screen already under 0.42 ink may read as black; if the strip shows it too heavy, `a: 0.35`.

---

## Shot 8: skyline, the false dawn (`skylineShot`)

### 1. Intent
The city before dawn, one more window lit each day of the rally. Windows light one by one across the towers as LIGHTS ON counts up to today's figure. Key movement: **about 60 windows switching on across the whole skyline** while the count climbs 8 points.

### 2. Duration
2.4 s, unchanged (S; caption the title 0.22 to 1.37).

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `city` | `skylineShot(c, day, '', { part: 'city', skip: [lo, f] })`: 112-123 without the day's newest windows | 1 | 640x360 |
| `top` | `skylineShot(c, day, '', { part: 'top', noLabel: true })`: 124-127 (static weather, ground, no label), then `finePass(c, day, r, 'establish'); tell(c, day)` | 1 | 640x360 |

`f = lit(day)` (105-109), `lo = f - 0.08` (the same float in both calls, so the windows split exactly). The gradient (113) is built once, in `city`. On session 35 the static snow speckle (124) is in `top`, drawn over the new windows exactly as today.

### 4. Camera
`camera: null` (C4 d; the shot is flat, no `framed` zoom).

### 5. Animated elements (native 640x360)

Cells: for building `i = 0..25`, `w = 18 + (i * 17) % 20`, `h = 60 + (i * 41) % 150`, `x = 26 i - 6`; for `yy = 8; yy < h - 6; yy += 12`, `xx = 4; xx < w - 4; xx += 8`: `k = ((i * 131 + xx * 7 + yy * 3) % 100) / 100`; a cell `{ x: x + xx, y: 260 - h + yy, w: 3, h: 3 }` when `lo <= k < f`. 64, 58, 59 and 63 cells on days 27, 28, 29 and 35.

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Windows | `city` | 0.35-1.25 | `K.lamps(c, cells, t, { at: 0.35, step: 0.90 / cells.length, order: 'seed', seed: 'news:' + day + ':sky', on: P.amber })`: scattered across the towers, one at a time. | `amber` (line 121: `day > 35 ? sky : amber`) | lamps |
| Count | `top` | 0.35-1.25 | `K.tally(c, 24, 24, t, { from: Math.round(f * 100) - 8, to: Math.round(f * 100), at: 0.35, dur: 0.90, fps: 15, fmt: (v) => 'LIGHTS ON: ' + v + '%', col: a >= 3 ? P.sky : P.amber, align: 'left', before: 'from' })`. Always two digits on these sessions (10→18, 18→26, 26→34, 74→82), so nothing shifts. The end value prints exactly line 126's text. | `sky` (acts 3 and 4) | tally |

Cost: about 64 plus about 200 rects.

### 6. Timeline
Fade up (first beat) on the city with the count at its start; 0.35-1.25 windows come on one by one and the count climbs; still to 2.40. Caption ends 1.37.

### 7. Final frame (p = 1)
Today's skyline exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Day 27 (`f = 0.18`) | 10% → 18%; ink2 sky gradient. |
| Days 28, 29 | 18 → 26, 26 → 34; amberD sky gradient (line 113). |
| Day 35 (`f = 0.82`) | 74 → 82; amberD sky; winter: snow caps (cached) and static speckle in `top`; no falling snow (the speckle lesson; the windows are the key). |
| `day > 35` (no skyline session) | The band would be `[f, f + 0.07)` going out: `K.lamps` with `off: P.sky`, `on` the building's own flat colour (`i % 3 ? P.ink2 : P.slate`, a cover on the named flat building fill), count down. Not reached in the story; build only if a later sheet uses it. |

### 9. Sound cues
None (own `apartment`).

### 10. Risks and fallbacks
- **3x3 windows.** Each is small; the read is sixty of them across the frame plus the count. Fallback: band 0.16 (about 120 cells, starting the count 16 points back) — that changes the meaning of the count, so ask first.
- Weather particles from the bible row are not added (one key movement, and the speckle on session 36).

---

## Shot 9: rack room (`racksShot`)

### 1. Intent
You pulled the plug: the racks go dark. Key movement: **the LED strips going dark row by row, top to bottom** (eight racks, 17 strips each).

### 2. Duration
1.7 s, unchanged (establish, caption the date).

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `racks` | `framed(c, day, r, title, { draw: (cc) => racksShot(cc, day) })` (306-313) | 1 | 640x360 |
| `marks` | `finePass(c, day, r, 'establish'); tell(c, day)` (world marks over the strips, so above the lamps) | 0 | 640x360 |

### 4. Camera
`camera: null`.

### 5. Animated elements (on `racks`; native coordinates inside `framed(..., { noBack: true })`, profile 1.18)

Cells row-major: for `j = 0..16` (`k = 8 + 12 j`), for `i = 0..7`: `{ x: 36 + 76 i, y: 40 + k, w: 48, h: 6 }`.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Strips | 0-1.37 | `K.lamps(c, cells, t, { at: 0.35, step: 0.0075, on: P.screenD, off: P.phosphorD })`: every strip shows lit until its switch, then the art's dark `screenD`; the sweep runs left to right along each row, top row first, ending at 1.37. A cover on the strips' flat `screenD` (named here). | `phosphorD` → `screenD` | lamps |

Cost: 136 rects.

### 6. Timeline
Fade up on lit racks; 0.35-1.37 they go dark row by row; still.

### 7. Final frame (p = 1)
Today's picture exactly.

### 8. Variants
Only variant 45 (`pulledPlug`). The detail is the memo (batch 4); the hold (`racksShot` plus dim) has no life and stays flat.

### 9. Sound cues
None.

### 10. Risks and fallbacks
None.

---

## Shot 10: every news hold (`news:<d>[v]:hold`)

### 1. Intent
A held breath after the headline. No key movement: the establish's picture at rest, with any life it has carrying on (bible row). Holds without life stay flat (a layered beat whose picture never changes adds cost and fails the motion-run "picture changes" assert).

### 2. Duration
1.1 s, unchanged. Holds cut in.

### 3. to 5. Per hold

The hold draws `shotFrame` (no `framed` zoom, no `finePass`, no `tell`) plus the 0.18 dim (line 874).

| Hold (sessions) | Picture | Treatment |
| --- | --- | --- |
| 0 (`news:0:hold`, the session 1 elevator) | elevator at 0.6 | Layered: Shot 5 (doors close from 1.0 to 0.6). |
| 8, 24 (footnote), 32 and 22 `bail` (memo) | `deskWithDoc` | Layered: batch 4 Shot 10 (LED). |
| 10, 44, 22 `fail` (dark) | dark floor | Layered: Shot 7 (stutter continues). |
| 3, 43 (chart) | `officeFrame(day, false)` | Flat: the establish's rolls are events, not life. |
| 5, 12, 23, 22 `ban` (ticket); 41 (floor) | lit floor | Flat (the wave is an event). |
| 7 (platform), 21 (subway) | `placeFrame` | Flat (the train is an event). |
| 16, 22, 42 (elevator places) | elevator at `O` | Flat. |
| 36 (voicemail) | apartment(0.15) | Flat (batch 4). |
| 45 `pulledPlug` (racks) | racks | Flat. |
| 6, 9, 17, 20, 37, 40, 45 (tableaux) | tableau | Batch 6. |
| 38, 41 `billPassed` (vote) | decision room | Batch 7. |

Layered holds: layers as their shot, `camera: null`, and the `dim` layer last (depth 0, cached).

### 6. to 9.
Timeline: as the shot's life. Final frame: today's hold exactly. Variants: as the shot. Sound: none (holds have no `sfx`).

### 10. Risks and fallbacks
- A hold that follows a beat whose life it continues (session 1's doors) must start where that beat ended; the others are cuts from a different picture (the detail), so they need no chain time.
