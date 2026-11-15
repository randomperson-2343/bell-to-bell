# Stage 3, batch 4: act cards and documents

The act card, the eight document close-ups (`DOC_DRAW`), the day's paper on your desk (`deskWithDoc`) and the voicemail apartment (`establishDoc`). Binding: the bible (`stage3-bible.md`) sections A and C, the stage 3 plan's constraints, and the lessons of the batch 2 and 3 critique: one key movement per shot, at least about 20x20 px and clearly contrasting; no count that steps backwards across a cut; nothing that shifts layout as it grows; only the kit's three blink rates; no particles over static speckle. Notation as the batch 3 sheet (`K` = `B.MotionKit`, `M` = `B.Motion`, `X` = `B.Pixel`, `P` = `B.Pal`, `R` = `B.Rhythm`, `SH` = `B.Shots`). Line numbers are today's `js/art/storyboard.js` unless marked.

All shots are tier 2. No durations change (bible: Δ 0 on every row). No establish beat's final frame changes in this batch, so the establishGroups count (39) is untouched.

## 0. Shared

### 0.1 Code changes (all optional; with the new argument absent every function draws exactly what it draws today)

1. `framed(ctx, day, r, title, o)` (394-404). `o.draw(c)`: called in place of `shotFrame(ctx, day, r, title)` (line 402, and line 397 when the camera is wide). `o.noBack`: skip the `P.ink` fill of line 398. Used two ways: the bottom layer of an establish passes `{ draw }`; every other layer and every `animate` of the same beat passes `{ draw, noBack: true }`, so animated elements are drawn in exactly the transform the art was drawn in. When the camera is wide (`cam[0] === 1`) there is no transform and `o.draw` is called directly.
2. `insertShot(ctx, day, value, doc, o)` (252-256): passes `o` to the `DOC_DRAW` function as a fifth argument; `o.noGrain` skips line 255 (the full-screen 0.05 scanlines). Every layered document beat draws line 255 itself in its top layer, so animated marks sit under the grain exactly as in today's still.
3. `DOC_DRAW.<doc>(ctx, day, value, c, o)` (169-251), per document:
   - `memo`: `o.part` `'paper'` = 171-172 (desk, paper, grey lines); `'ink'` = 174-175 (the value text only). The band (173) is drawn only when `part` is undefined.
   - `footnote`: `o.noMarker` skips 182-184 (the red loop and the run to the margin).
   - `rating`: none (a cover is used, see Shot 4).
   - `post`: `o.part` `'city'` = the first two statements of 197 (ink fill, skyline); `'phone'` = 198-205. `o.noFlag` skips the 10x10 crimson square of 202 (the TRENDING text stays).
   - `chart`: `o.noMarker` skips 214-216.
   - `ticket`: `o.part` `'screen'` = 220-224 (background, cel, CRT, label, BID and ASK); `'glass'` = 229-230 (value text, CRT scanlines). The bars (225-228) are drawn only when `part` is undefined.
   - `vote`: `o.unlit` draws every one of the 216 cells of 237-240 in `P.ink2` (the lamps' off state).
   - `voicemail`: `o.played` (default 12) replaces the literal 12 of line 248: bars `i < played` are `P.phosphor`, the rest `P.slate2`.
4. `actCard(ctx, day, o)` (258-265): `o.noName` skips line 263 (the act name in 4x letters).
5. `deskWithDoc(ctx, day, r, zoom, o)` (269-282): `o.part` `'desk'` = 272-275 (the desk fill and `deskCloseup`, no paper); `'paper'` = 276-279 only (no desk fill, no `deskCloseup`), inside the same `at2x` and the same translate and scale, with `o.dy` (default 0, whole art units) added to every y of 276-279 (cel 138, rule 142, bar 148, text 158). New helper next to it, `deskSpace(ctx, day, zoom, fn)`: `at2x` plus line 274's translate and scale, then `fn(c)`; `deskWithDoc` uses it, so both stay in step. `z = zoom || 1.15`, `ty = zoom ? 84 : 104` as today.

### 0.2 Which beats this batch reworks

`B.Scenes.news` (863-876) builds the beats; wrap its result after line 874 (as `B.Scenes.close` does), keyed on the beat id and `r = row(day, story(o))`. `v` is `':' + r.arg` on the four variant mornings (line 869), else empty, so the ids are `news:<d>:<phase>` or `news:<d>:<arg>:<phase>`.

| Beat | Condition | Shot |
| --- | --- | --- |
| `news:<d>:act` | always (d 8, 17, 32 in the sheet) | 1 act card |
| `news:<d>[v]:detail` | `r.shot` is `insert`, or `dark` / `racks` with `r.arg` (line 408 then draws `insertShot`) | the document's shot, 2 to 9, by `r.doc` |
| `news:<d>[v]:establish` | `r.shot === 'insert'`, `r.weight === 'S'` (line 377 draws `insertShot`, flat camera) | the document's shot, as its detail. No session in `SHEET` today |
| `news:<d>[v]:establish` | `r.shot === 'insert'` and `r.doc` is `memo` or `footnote`; or `r.shot === 'place'` and `R.storyboard(d).place === 'desk'` | 10 desk with paper |
| `news:<d>[v]:hold` | the same cases as the row above | 10 desk with paper, hold version |
| `news:<d>[v]:establish` | `r.shot === 'insert'`, `r.doc === 'voicemail'` | 11 voicemail apartment |
| `news:<d>[v]:establish` | `r.shot === 'insert'`, `r.doc` is `post` or `chart` | 12 reuse cases |

Not reworked here: rating and ticket establishes (batch 5, apartment and TV; trading floor), vote establishes and the d 41 vote hold (batch 7, decision rooms), the voicemail hold (d 36: nothing in it lives; it stays flat), chart holds (batch 5, "any hold").

Sessions, from `SHEET`, `DOCS` and `variant()` (index = `day`; framing = the establish's `framed()` camera, from `CAM_ORDER[kindIndex % 6]`; documents with `doc === 'vote'` are flat):

| Doc | Sessions (weight; establish framing) | Detail | Hold |
| --- | --- | --- | --- |
| memo | 15 (M; profile 1.18), 19 (M; over-shoulder 1.18), 32 (XL; close 1.34); variant 22 `bail` (L; close 1.34); as the detail of `dark` 10 and variant 22 `fail`, and of `racks` variant 45 `pulledPlug` | 10, 15, 19, 32, 22v, 45v | 32, 22 `bail` |
| footnote | 1 (M; wide), 8 (XL; insert 1.34), 24 (L; profile 1.18) | 1, 8, 24 | 8, 24 |
| rating | 4 (M), 14 (M) | 4, 14 | none |
| post | 2 (M; profile 1.18), 33 (M; over-shoulder 1.18); variant 4 `leak` (M; over-shoulder 1.18) | 2, 33, 4v | none |
| chart | 3 (L; wide), 30 (M; insert 1.34), 43 (L; profile 1.18) | 3, 30, 43 | 3, 43 (batch 5) |
| ticket | 5 (L), 12 (XL), 23 (L), 39 (M); variants 4 `dump` (M), 22 `ban` (L) | all six | batch 5 |
| vote | 11 (M), 38 (L); variant 41 `billPassed` (XL) | all three | batch 7 |
| voicemail | 36 (L; insert 1.34) | 36 | flat |

Act cards: d 8 (II · TREMORS), d 17 (III · CONTAGION), d 32 (IV · RECKONING): the XL days where `actTurns`.

### 0.3 Common layer patterns

- **Document beat** (shots 2 to 9): back to front, the document's cached layer(s), its moving marks in an `animate`, and a top cached layer that ends with `X.scanlines(c, 0, 0, 640, 360, P.ink, 0.05)` (line 255). Coordinates: native 640x360 canvas, no transform; every value below is in screen pixels. `camera: null` unless the shot says otherwise. When the beat is a `dark` or `racks` detail (memo), the top layer also draws `finePass(c, day, r, 'detail')` after the grain (line 873 draws it today; for `insert` it returns at line 323).
- **Establish beat** (shots 10 to 12): art layers drawn through `framed(c, day, r, title, { draw, noBack })`, then a top `marks` layer (depth 0, cached): `finePass(c, day, r, 'establish'); tell(c, day)`, exactly line 871's order. For an `insert` the world branch of `finePass` draws nothing, so `marks` is the corner brackets and, on anomaly days (1, 8, 12, 14, 19, 30, 36, 43 among these), the tear. Marks never move (C7).
- **Hold beat** (shot 10): the art layer(s) at rest, then a top `dim` layer (depth 0, cached): `c.save(); c.globalAlpha = 0.18; X.rect(c, 0, 0, 640, 360, P.ink); c.restore()` (line 874). `camera: null`. Animated life sits under `dim`.

### 0.4 Sound

Every beat keeps its own `sfx` (`broadcast` on act cards and details, `apartment` on establishes, none on holds). One cue in the whole batch: `click` on the rating stamp (Shot 4).

---

## Shot 1: act card (`news:<d>:act`)

### 1. Intent
A chapter heading, typed by the same machine that prints everything else. ACT II fades up with the card; the act's name then types out in large letters, a cursor running ahead of it. It should feel deliberate and a little ominous. Key movement: **the act name typing on in 4x letters** (up to 212x28 px, bone on the dark wash).

### 2. Duration
1.7 s, unchanged. First beat of the chain: `transition: 'fade'` (0.28 s). Caption (`II · TREMORS`) types 0.22 to `0.22 + min(1.15, 0.935) = 1.155`.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `card` | `actCard(c, day, { noName: true })`: 260-261 (ink, the 12-band wash gradient, the only expensive build) and 264 (`ACT II` at 2x in `c.signal`) | 1 | 640x360 |

One layer: the gradient is built once and never repeated.

### 4. Camera
`camera: null` (key movement is typing, C4 d).

### 5. Animated elements (on `card`; screen pixels)

`label = act(day)`, `name = R.clean(label.split('·')[1] ? label.split('·')[1].trim() : label).slice(0, 44)` (exactly the string line 263 draws), `n = name.length`, `tw = 6 * n`, `left = 4 * ((80 - (tw - 1) / 2) | 0)`, `top = 152` (`4 * Math.round(150 / 4)`), `done = 0.45 + n / 16`.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Act name | 0.45 to `done` (0.89 for TREMORS, 1.01 for CONTAGION and RECKONING) | `K.typeOn(c, name, left, top, t, { at: 0.45, cps: 16, col: P.bone, shadow: P.ink, scale: 4, align: 'left', cursor: t < done + 0.5 ? { col: c.signal } : null })`. Left-aligned at the final string's computed left edge, so letters never move: `left` is 236 for TREMORS, 212 for the two nine-letter names. This reproduces line 263's pixels exactly (`big()` scales by 4 and draws at `(cx, 38)` in scaled units; `typeOn` with `scale: 4` translates to `(left, 152)` and draws at the origin; the shadow is +1 scaled unit in both). Do not pass `align: 'center'` with `scale: 4`: the kit's centring truncates toward zero on negative values and lands 4 px right of the art. | `bone`, shadow `ink`, cursor `c.signal` (C3: cursors on act cards take the signal colour; the bible table's "bone cursor" yields to C3) | typeOn |

Cursor: a 20x28 block after the last letter while typing, then one cursor-rate blink (on 0.25 s, off 0.25 s), then gone at `done + 0.5` (at most 1.51 s), so the final frame has no cursor. Cost: at most about 270 rects.

### 6. Timeline
- 0.00-0.28: fade up on the wash and ACT II.
- 0.22: caption starts.
- 0.45: the name starts typing at 16 characters a second, cursor leading.
- 0.89 / 1.01: last letter; the cursor blinks once.
- 1.155: caption ends.
- by 1.51: cursor gone; still to 1.70.

### 7. Final frame (p = 1)
Today's act card exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| d 8, act II | Violet wash, ACT II in sky, cursor sky, TREMORS (7 letters). |
| d 17, act III | Sky wash, crimson ACT III and cursor, CONTAGION (9). |
| d 32, act IV | CrimsonD wash, crimson ACT IV and cursor, RECKONING (9). |
| Label without `·` (no StoryData) | `name` is the whole label, typed the same way; empty label types nothing (the card is a still). |
| Season, story state | None read. The act card only exists on XL days where the act turns. |

### 9. Sound cues
`sfx: 'broadcast'` stays. No cue (typing has no sound in the game).

### 10. Risks and fallbacks
- **Cursor in the final frame.** Guarded by `cursor: null` after `done + 0.5`; the motion-run "same time, same picture" assert at `dur` must equal the flat still.
- **Gradient build cost** on the first frame: one full-screen 12-band dither, as today's still. No second copy.

---

## Shot 2: memo (`DOC_DRAW.memo`, detail; S establish)

### 1. Intent
An internal memo with the one line that matters, highlighted by someone before it reached you. Key movement: **the highlighter band (416x58, act wash) wiping left to right under the value**.

### 2. Duration
Detail 2.3 s, unchanged. Opens on `cross` (0.3 s). Caption (the brief title) types 0.22 to 1.37.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `paper` | `DOC_DRAW.memo(c, day, value, cc, { part: 'paper' })`: 171-172 (`deskUnder`, the paper, five grey lines) | 1 | 640x360 |
| `band` | animate-only (`draw() {}`) | 1 | 640x360 |
| `ink` | `DOC_DRAW.memo(..., { part: 'ink' })`: 174-175 (the value, 2x, `P.ink`), then line 255's grain; for `dark` and `racks` details also `finePass(c, day, r, 'detail')` | 1 | 640x360 |

`cc = R.colors(B.StoryData.actIndex(day) + 1)` (line 253). The band passes under the text: a sandwich (C8), never a cover.

### 4. Camera
`camera: null` (draw-on, C4 d).

### 5. Animated elements (screen pixels)

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Highlighter | `band` | 0.35-0.85 | `K.marker(c, [{ x: 112, y: 96, w: 416, h: 58 }], t, { at: 0.35, dur: 0.50, col: cc.wash, fps: 20 })`: the band fills from x 112 rightward in ten 42 px steps; at 0.85 it is exactly line 173's rect. | `cc.wash` (amberD, violet, sky, crimsonD by act; C3) | marker (swipe) |

Cost: 1 rect.

### 6. Timeline
- 0.00-0.30: cross from the establish. The paper and the value are already there; no band.
- 0.35-0.85: the band sweeps under the value.
- 0.85-2.30: still. Caption ends 1.37.

### 7. Final frame (p = 1)
Today's memo exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Act | Band colour `cc.wash`. |
| One or two value lines | Text in `ink` as today; the band is the same rect. |
| `dark` detail (d 10 `19% OF RACKS NEVER ENERGIZE`, variant 22 `NO RESCUE · DESKS CLEARED`), `racks` detail (variant 45 `THE STACK IS OFF`) | Same shot; `ink` adds `finePass(..., 'detail')` (the floor's or racks' world marks and the corner brackets at y 19), as today. |
| Variant 22 `bail` (`GUARANTEE SIGNED · 2:14 AM`) | Insert memo, same shot. |
| `day` | Grey line lengths (172) vary by day, cached. |
| S-weight memo establish (none in `SHEET`) | Same layers under the establish's id, plus the `marks` layer of 0.3 (flat camera, so no transform). Caption is the title, 0.22 to 1.37 on a 2.4 s beat; same times. |

### 9. Sound cues
None (`broadcast` stays).

### 10. Risks and fallbacks
- **Text between two cached layers.** `ink` must not repaint the paper: it draws only the value and the grain on a transparent canvas.
- If the swipe reads as a loading bar, fallback `fps: 12` (six steps).

---

## Shot 3: footnote (`DOC_DRAW.footnote`, detail)

### 1. Intent
Someone went through the offering memorandum with a red pen. Key movement: **the red marker loop drawing round the line, then running out to the margin note** (290x14 px loop, 60 px run).

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `doc` | `DOC_DRAW.footnote(c, day, value, cc, { noMarker: true })`: 178-181, 185-186 (desk, paper, sixteen lines, the amber margin note and its value) | 1 | 640x360 |
| `grain` | line 255 only | 1 | 640x360 |

Nothing drawn after the marker in today's art overlaps it (the note starts at x 440, the run ends at x 435), so the marker draws in `doc`'s `animate`, under the grain.

### 4. Camera
`camera: null`.

### 5. Animated elements (on `doc`; screen pixels)

`ly = 50 + (6 + day % 6) * 12` (line 181): 134 on d 1, 146 on d 8, 122 on d 24. Segments in pen order (each is one of the art's rects; `dir: -1` draws right to left or bottom to top):

```
[{ x: 84,  y: ly - 7, w: 290, h: 2 },            // top, left to right
 { x: 374, y: ly - 5, w: 2,   h: 12 },           // right side, down
 { x: 84,  y: ly + 7, w: 290, h: 2, dir: -1 },   // bottom, right to left
 { x: 82,  y: ly - 5, w: 2,   h: 12, dir: -1 },  // left side, up
 { x: 376, y: ly,     w: 60,  h: 2 }]            // the run out to the note
```

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Pen | 0.35-1.15 | `K.marker(c, segs, t, { at: 0.35, dur: 0.80, col: P.crimson, fps: 20 })`. Total length 664 px, 33 px per step. The loop closes at about 1.06; the run to the note follows. At 1.15 the five rects are exactly 182-184. | `crimson` | marker |

Cost: at most 5 rects.

### 6. Timeline
- 0.00-0.30: cross in; the page and the amber note with its number are there.
- 0.35-1.06: the pen circles the line.
- 1.06-1.15: it runs out to the note.
- 1.15-2.30: still. Caption ends 1.37.

### 7. Final frame (p = 1)
Today's footnote exactly.

### 8. Variants
`day % 6` picks the circled line (y 122 to 182); line lengths vary by day (cached). Act: none (crimson is the pen, not the act). One or two note lines: cached. Sessions 1, 8, 24.

### 9. Sound cues
None.

### 10. Risks and fallbacks
- **2 px pen at 1440x900** (bible risk): the stroke is long and crimson on bone, so it reads; if the strip shows it thin, keep the art and slow it (`dur: 1.0`, ending 1.35, with the caption).

---

## Shot 4: rating (`DOC_DRAW.rating`, detail)

### 1. Intent
The agency's action, stamped. Key movement: **the rating stamp (340x110) landing in three hard frames as the caption finishes**.

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37; the stamp lands 1.30 to 1.38, with it (C2).

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `doc` | `DOC_DRAW.rating(c, day, value, cc)`: 189-194, whole (desk, paper, lines, stamp, value) | 1 | 640x360 |
| `grain` | line 255 | 1 | 640x360 |

### 4. Camera
`camera: null` (a stamp, C4 d).

### 5. Animated elements (on `doc`; screen pixels)

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Cover | 0-1.38 | While the stamp phase is below 3: `X.rect(c, 150, 64, 340, 110, P.bone)`. Every pixel of that rect is the paper's flat `P.bone` interior when the stamp is absent (paper interior x 123-516, y 27-268; the label rule and text end at y 57, the grey lines start at y 196), so this is the named flat-fill cover of C8. | `bone` | none |
| Stamp | 1.30 on | `phase = K.stamp(c, 150, 64, 340, 110, t, { at: 1.30, col: cc.signal, frame: 0.04, grow: [16, 6], style: 'none' })`. Phase 1 (1.30): 1 px outline `(142, 60, 356, 118)`. Phase 2 (1.34): 2 px outline `(147, 63, 346, 113)`. Phase 3 (1.38): nothing drawn; the cover lifts and the cached stamp and value appear. | `cc.signal` (the stamp's own colour in the art) | stamp |

Draw order inside `animate`: the cover first, then `K.stamp` (so the phase 1 and 2 outlines show on the covered paper). Both phase outlines lie inside the paper interior. Cost: at most 5 rects.

### 6. Timeline
- 0.00-0.30: cross in on a page with no stamp (label, lines).
- 0.22: caption types the headline.
- 1.30, 1.34, 1.38: the stamp comes down; the double rule and value are there from 1.38.
- 1.37: caption ends.
- 1.38-2.30: still.

### 7. Final frame (p = 1)
Today's rating exactly.

### 8. Variants
Act: stamp and outline in `cc.signal` (amber, sky, crimson); value in `amberD` when the signal is amber (line 194), cached. One or two value lines: cached under the cover (line 194 positions both inside the stamp). Sessions 4 (`RATING AFFIRMED: AAA`) and 14 (`40 DOWNGRADES · SAME MINUTE`). On session 4 with `c1 === 'dump'` or `'leak'` the document is a ticket or post instead.

### 9. Sound cues
`cues: [{ at: 1.30, sfx: 'click' }]`: a dry mechanical knock as the stamp lands. Not the beat's own `broadcast`.

### 10. Risks and fallbacks
- **The informative still for 1.3 s has no value.** The caption carries the headline; short mode shows the final frame. If the coordinator wants the value readable early, fallback: start the stamp at 0.30 (before the caption is past its first words; C2 allows a verdict before the caption) and drop the cue time to match.

---

## Shot 5: post (`DOC_DRAW.post`, detail)

### 1. Intent
The thing everyone is passing around, held up against the city: the morning cousin of the Sqwak breaking insert. Key movement: **the phone rising 32 px over the skyline** (a 260x300 device), the same gesture as the handoff and the Sqwak insert (C4 b).

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `city` | `DOC_DRAW.post(c, day, value, cc, { part: 'city' })`: ink fill and `R.skyline(c, act, day * 5, 300, day)` (gradient, dawn dither, buildings, static weather) | 0 | 640x360 |
| `phone` | `{ part: 'phone', noFlag: true }`: 198-205 (case, screen, `sqwak`, card, TRENDING, value, the three bars, the phone's 0.1 scanlines) | 1 | 640x360 |
| `grain` | line 255 | 0 | 640x360 |

City at depth 0, not 0.25: the skyline carries static winter speckle on d 33 and nothing in it should drift.

### 4. Camera
`camera: K.rise(32, 2.3, 0.30, 0.80)`. Only `phone` moves: offset 32 → 0, ease out. At t = 0 the phone's top is at y 48; the 32 rows above it show the city (the phone layer is transparent there). The grain stays pinned.

### 5. Animated elements (on `phone`; screen pixels in the phone layer's own coordinates)

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| TRENDING light | whole beat | `K.blink(c, 216, 70, 10, 10, t, { on: P.crimson, period: 1.0, duty: 0.5, end: 2.3 })`. Off draws nothing (the card's flat `P.screen` is cached under it). Standby rate, on at the end. | `crimson` | blink |

Background life only; the rise is the key movement. The bible row also lists lamps on the three bars: dropped (one key movement per shot; the bars are 44x6). Cost: 1 rect.

### 6. Timeline
- 0.00-0.30: cross from the establish; the phone sits 32 px low.
- 0.30-0.80: the phone comes up into place.
- Throughout: the TRENDING square blinks; on at 2.30.
- 0.80-2.30: still. Caption ends 1.37.

### 7. Final frame (p = 1)
Today's post exactly.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Sessions 2 (`18K LIKES · DENIAL: 0 VIEWS`), 33 (`9,000 WORDS · 0 READS`), variant 4 `leak` (`LEAKED DECK · FRONT PAGE`) | Same motion. |
| Act | Skyline sky and window colours (cached). |
| Season | d 2 and 4: nine static leaves in the sky; d 33: winter snow caps and static speckle. All cached; no falling weather (C11 and the speckle lesson). |
| One or two value lines | Cached. |

### 9. Sound cues
None. (The beat's `broadcast` plays; a `news` ping here would anticipate the phone chain that follows the news chain.)

### 10. Risks and fallbacks
- **Phone bottom under the caption.** The case already ends at y 316; the rise only moves art that is under the box anyway. Nothing that matters is below 272.
- Fallback for a too-busy dissolve: `K.rise(24, 2.3, 0.30, 0.80)`.

---

## Shot 6: chart (`DOC_DRAW.chart`, detail)

### 1. Intent
A risk printout with one move circled in red. Key movement: **the red marker circle (64x98) drawing round the move**.

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `doc` | `DOC_DRAW.chart(c, day, value, cc, { noMarker: true })`: 208-212 and 217 | 1 | 640x360 |
| `grain` | line 255 | 1 | 640x360 |

### 4. Camera
`camera: null`.

### 5. Animated elements (on `doc`; screen pixels)

Segments in pen order (`cx = 392`): `[{ x: 362, y: 70, w: 60, h: 2 }, { x: 422, y: 72, w: 2, h: 94 }, { x: 362, y: 166, w: 60, h: 2, dir: -1 }, { x: 360, y: 72, w: 2, h: 94, dir: -1 }]` (top left to right, right side down, bottom right to left, left side up).

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Circle | 0.40-0.95 | `K.marker(c, segs, t, { at: 0.40, dur: 0.55, col: P.crimson, fps: 20 })`. Length 308 px, 28 px a step. Ends exactly on 215-216. | `crimson` | marker |

Cost: at most 4 rects. The pen passes over the plotted points as the art does (it is drawn after them in both).

### 6. Timeline
0.00-0.30 cross in, the printout and the caption's value already printed; 0.40-0.95 the circle draws; still to 2.30.

### 7. Final frame (p = 1)
Today's chart exactly.

### 8. Variants
Market up or down (`R.marketDown(day)`) shapes the line (cached); the circle is fixed at x 360-423. Sessions 3 (`DELINQUENCY 6.4%`), 30 (`VOLUME: PERFECTLY EVEN`), 43 (`61% OF FILLS · ONE COUNTERPARTY`). Act: none.

### 9. Sound cues
None.

### 10. Risks and fallbacks
None beyond the build checklist.

---

## Shot 7: ticket (`DOC_DRAW.ticket`, detail)

### 1. Intent
The order book on a CRT, draining as you watch. Key movement: **the book draining: bid bars step shorter, ask bars step longer** (ten bars, 18 px each, across a 440x64 area).

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `screen` | `DOC_DRAW.ticket(c, day, value, cc, { part: 'screen' })`: 220-224 (gradient background, cel, dithered CRT, ORDER BOOK, BID, ASK) | 1 | 640x360 |
| `book` | animate-only (`draw() {}`) | 1 | 640x360 |
| `glass` | `{ part: 'glass' }`: 229-230 (value at 3x, the CRT's 0.12 scanlines), then line 255 | 1 | 640x360 |

The bars sit on the CRT's dither, so shrinking bars must reveal dither: a sandwich, never a cover (bible risk). One gradient (220) and one CRT (222), both in `screen` only.

### 4. Camera
`camera: null`.

### 5. Animated elements (on `book`; screen pixels)

For bar `i = 0..4`: `s_i(t) = 3 - clamp(Math.floor((t - (0.40 + 0.06 i)) / 0.12) + 1, 0, 3)` (3 before `0.40 + 0.06 i`, then 2, 1, 0 at 0.12 s steps).

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Bid bars | 0.40-0.88 | `X.rect(c, 100, 80 + 14 i, (100 - 18 i) + 6 s_i, 8, i ? P.screenGlow : P.jadeD)`: each starts 18 px long and loses 6 px three times (bar 0: 118 → 100; bar 4: 46 → 28). | `jadeD`, `screenGlow` (as the art) | none (explicit rects) |
| Ask bars | 0.40-0.88 | `w = (60 + 12 i) - 6 s_i`; `X.rect(c, 540 - w, 80 + 14 i, w, 8, P.crimsonD)`: right edge fixed at 540, each grows 18 px in three steps (bar 0: 42 → 60; bar 4: 90 → 108). | `crimsonD` | none |

Bar 0 moves at 0.40, 0.52, 0.64; bar 4 at 0.64, 0.76, 0.88. Cost: 10 rects. (`K.lamps` cannot express a lamp that is on before its switch and off after, which the bid bars need; plain rects in the sandwich are simplest.)

### 6. Timeline
0.00-0.30 cross in on a fuller bid side; 0.40-0.88 the bids step away and the asks stack up, top bar first; still to 2.30.

### 7. Final frame (p = 1)
Today's ticket exactly (at `s_i = 0` every bar is line 226-227's rect).

### 8. Variants
Sessions 5 (`FRLN HALTED · INDEX AT A RECORD`), 12 (`BIDS: 1 · PRICE: 0.00`), 23 (`MARKED AT 22 CENTS`), 39 (`MONEY FUND NAV 0.99`), variant 4 `dump` (`RIVERBEND BUYS AT PAR`), variant 22 `ban` (`SHORT SALES BANNED · 5 DAYS`): same motion every time (C10: the timing is the shot's, the content the game's). Act, season: none.

### 9. Sound cues
None.

### 10. Risks and fallbacks
- **`screenGlow` bars are low contrast** on the screen; the jadeD top bid bar and the five crimsonD asks carry the read. If the strip is weak, fallback: 4 steps of 6 px (24 px travel).

---

## Shot 8: vote (`DOC_DRAW.vote`, detail)

### 1. Intent
The floor tally board filling. Key movement: **the two lamp banks sweeping on, row by row** (each row a 230x9 strip of lamps on each bank).

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `doc` | `DOC_DRAW.vote(c, day, value, cc, { unlit: true })`: 233-241 with all 216 cells in `P.ink2` | 1 | 640x360 |
| `grain` | line 255 | 1 | 640x360 |

The cells sit on the cel's flat `P.ink` interior; the unlit cells are cached, so lamps only add the lit colour.

### 4. Camera
`camera: null`.

### 5. Animated elements (on `doc`; screen pixels)

Row `r = 0..5`: `yea_r = [{ x: 64 + 13 k, y: 56 + 13 r, w: 9, h: 9 } for k in 0..17 if (r * 18 + k) % 7]`, `nay_r = [{ x: 340 + 13 k, ... } for k if (r * 18 + k) % 5]` (the cells line 238-239 colour jadeD and crimsonD).

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Rows | 0.40-0.85 | For each `r`: `K.lamps(c, yea_r, t, { at: 0.40 + 0.09 r, step: 0, on: P.jadeD })` and `K.lamps(c, nay_r, t, { at: 0.40 + 0.09 r, step: 0, on: P.crimsonD })`. Both banks light row by row, top first. | `jadeD`, `crimsonD` | lamps |

Cost: at most 180 rects (the lit cells; the ceiling the bible names is 216).

### 6. Timeline
0.00-0.30 cross in on a dark board; 0.40, 0.49, ... 0.85 the six rows light; still to 2.30.

### 7. Final frame (p = 1)
Today's vote exactly.

### 8. Variants
Sessions 11 (`COMPUTE FREEDOM ACT · SIGNED`), 38 (`YEAS 214 · NEEDED 218`), variant 41 `billPassed` (`THE BILL PASSES · 218 YEAS`). The lamp pattern is fixed art (not the vote), so the motion is identical. Act, season: none.

### 9. Sound cues
None.

### 10. Risks and fallbacks
- **Budget.** 180 rects plus nothing else; inside 400.

---

## Shot 9: voicemail (`DOC_DRAW.voicemail`, detail)

### 1. Intent
Perry's message, playing. Key movement: **playback lighting the waveform bar by bar** (12 bars over a 67x39 area, phosphor on the screen).

### 2. Duration
2.3 s, unchanged. Caption 0.22 to 1.37.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `doc` | `DOC_DRAW.voicemail(c, day, value, cc, { played: 0 })`: 244-249 with all 34 bars `P.slate2` | 1 | 640x360 |
| `grain` | line 255 | 1 | 640x360 |

### 4. Camera
`camera: null`.

### 5. Animated elements (on `doc`; screen pixels)

Cells `i = 0..11`: `h_i = 4 + ((i * 37 + day) % 36)`, `{ x: (224 + i * 5.8) | 0, y: (110 - h_i / 2) | 0, w: 3, h: h_i }`. The `| 0` matches `X.rect`'s truncation; the kit rounds, so the cells must be passed already truncated or bars 3, 8 and others land 1 px off.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Playback | 0.40-1.06 | `K.lamps(c, cells, t, { at: 0.40, step: 0.06, on: P.phosphor })`: bar 0 at 0.40, bar 11 at 1.06; playback stops there, as the art. | `phosphor` | lamps |

The bible's blink is dropped: the screen has no play control to blink, and one key movement is enough. Cost: 12 rects.

### 6. Timeline
0.00-0.30 cross in, the waveform all grey; 0.40-1.06 the first twelve bars light left to right; still to 2.30.

### 7. Final frame (p = 1)
Today's voicemail exactly.

### 8. Variants
One session (36, `VOICEMAIL · PERRY · 0:41`). `day` shapes the bar heights (`i * 37 + day`). Nothing else varies.

### 9. Sound cues
None.

### 10. Risks and fallbacks
None.

---

## Shot 10: desk with the day's paper (`deskWithDoc`: memo and footnote establish and hold, `desk` place)

### 1. Intent
The day's paper arrives on your desk before you do. Key movement: **the paper sliding up onto the desk** (16 art units: 37 to 64 screen px depending on the zoom) and settling. Background life: the TRADE monitor's standby LED.

### 2. Duration
Establish 1.7 s, hold 1.1 s, unchanged. The establish is the chain's first beat on these days (`fade`, 0.28 s) except d 8 (after the act card: `cross`). Caption (the date) types 0.22 to 1.155.

### 3. Layers

Establish (`news:<d>[v]:establish`):

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `desk` | `framed(c, day, r, title, { draw: (cc) => deskWithDoc(cc, day, r, Z, { part: 'desk' }) })`: line 398's ink (zoomed days), 272-275 | 1 | 640x360 |
| `marks` | 0.3 establish marks | 0 | 640x360 |

Hold (`news:<d>[v]:hold`):

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `desk` | `deskWithDoc(c, day, r, Z)` whole (272-279: the paper at rest is cached) | 1 | 640x360 |
| `dim` | 0.3 hold dim | 0 | 640x360 |

`Z` is the zoom `establishDoc` and `placeShot` pass today: memo `0` (so `z = 1.15`, `ty = 104`), footnote `1.5` (`ty = 84`), desk place `1.3` with `r = { doc: 'memo', arg: title }` (line 302).

### 4. Camera
`camera: null` on both (the key is a slide; C4 d). `framed()`'s zoom is baked into the layer and wraps the animate (C4).

### 5. Animated elements

**Coordinate space.** Everything below is in `deskCloseup`'s 320x180 art units, drawn through `deskSpace(c, day, Z, fn)` (`at2x`, then translate `(round(160 - 119 z), round(ty - 153 z))`, scale `z`), and on establishes inside `framed(c, day, r, title, { noBack: true, draw: ... })`. Total scale: memo 2.3 (hold), 2.71 (profile 1.18), 3.08 (close 1.34); footnote 3.0 (wide d 1, holds), 3.54 (profile 1.18), 4.02 (insert 1.34); desk place 2.6. Whole art units only, so the paper stays on the art's grid.

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Paper | establish | 0.35-0.75 | `dy = Math.round(16 * (1 - M.ease.out(K.span(t, 0.35, 0.75))))`; `deskWithDoc(c, day, r, Z, { part: 'paper', dy })` inside `framed(..., { noBack: true })`. Before 0.35 the paper sits 16 units low (memo: its top at screen y 210 on the hold scale, against 173 at rest); it slides up and settles, ease out, one art unit at a time. It is drawn last, so as it moves it passes over the keyboard's left end and your left hand, exactly as it lies over them at rest. | the paper's own (bone, amberD / crimsonD / sky bar, ink text) | none |
| TRADE LED | establish and hold | whole beat | Inside `deskSpace`: `K.blink(c, 176, 119, 3, 3, t, { on: P.jade, off: P.plastic, period: 1.0, duty: 0.5, end: dur })`. Off is a cover on the monitor bezel's flat `P.plastic` (named here, C8). On at the end. | `jade` / `plastic` | blink |

On the hold the paper does not move; only the LED blinks (under `dim`). Cost: about 60 rects (paper text is 9 characters at 1x).

### 6. Timeline
Establish: 0.00-0.28 fade up (or cross after the act card) on your desk, the paper low; 0.22 the date types; 0.35-0.75 the paper slides up into place; the LED blinks throughout; still to 1.70.
Hold: cut in; the LED blinks; 1.10 on.

### 7. Final frame (p = 1)
Today's establish (paper at rest, LED on, marks) and today's hold exactly. No establish final frame changes.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Memo sessions 15, 19, 32, variant 22 `bail` | `Z = 0`; establish framing profile, over-shoulder, close, close (zoom 1.18 to 1.34). Holds on 32 and 22 `bail`. |
| Footnote sessions 1, 8, 24 | `Z = 1.5`; framing wide, insert, profile. Holds on 8 and 24. The paper's bar is amberD. |
| Desk place (`R.storyboard(d).place === 'desk'`, d % 10 = 9; no `place` session in `SHEET` lands on it) | `Z = 1.3`, `r = { doc: 'memo', arg: title }`. `marks` then also draws the place's world lines (`finePass` `place` branch), as today. |
| Market | `deskCloseup`'s `crash` reads `R.marketDown(day - 1)` (cached); ticker by `day % 5` (cached). |
| `r.arg` | The first nine characters on the paper (`R.clean(r.arg).slice(0, 9)`), moving with it. |
| Anomaly days 1, 8, 19 (and 12, 14, 30, 36, 43 elsewhere) | The tear in `marks`, static. |
| Season | `at2x` sets it; `deskCloseup` reads none. |

### 9. Sound cues
None (`apartment` on the establish).

### 10. Risks and fallbacks
- **Close framing (d 32, 22 `bail`).** At 3.08x the settled paper's bottom is at screen y 275, three rows into C2's 272 line, and the start pose is under the caption box. The arrival reads above the box; if the coordinator objects, fallback `dy` 10 (the paper starts nearer).
- **Scale.** Positions are art units; the engineer must not convert to screen pixels and round, or the paper will not match the cached art at rest.

---

## Shot 11: voicemail apartment (`establishDoc` voicemail, `apartment(0.15)`)

### 1. Intent
Before dawn, the phone on the couch arm wakes with a message you have not played. Key movement: **the phone's screen lighting, with one bone flare around it** (screen 21x35 px at this framing, flare 54x70).

### 2. Duration
1.7 s, unchanged. First beat, `fade`. Caption (the date) 0.22 to 1.155.

### 3. Layers

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `room` | `framed(c, day, r, title, { draw: (cc) => at2x(cc, (c2) => SH.apartment(c2, 0.15), day) })` (line 289; `scenes.js` 46-83) | 1 | 640x360 |
| `marks` | 0.3 establish marks | 0 | 640x360 |

### 4. Camera
Settle tilt: `{ from: { x: 0, y: -6, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.inOut }` (C4 a). At most 6 rows uncovered at the top, under the letterbox.

### 5. Animated elements (on `room`)

**Coordinate space.** `SH.apartment`'s 320x180 art units, inside `framed(..., { noBack: true, draw: (cc) => at2x(cc, fn, day) })`. Session 36's framing is `insert` (1.34), total scale 2.68, translate (-109, -49): art x maps to `-109 + 2.68 x`, art y to `-49 + 2.68 y`.

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Phone screen | 0-0.45 dark, then lit | `K.ping(c, t, { at: 0.45, off: [{ x: 192, y: 113, w: 8, h: 13, col: P.ink }], on: [], flare: { x: 186, y: 106, w: 20, h: 26, col: P.bone, a: 0.15, dur: 0.08 } })`. Off covers the phone screen's flat `P.screenGlow` (and its sky dot) with `P.ink`: a cover on a flat fill named here (C8). From 0.45 the cached lit screen shows; for 0.08 s a bone flare sits over the phone and the couch arm. | `ink`, flare `bone` 0.15 | ping |

Screen position: x 405-426, y 254-289 (the flare 389-442, 235-305). Cost: 1 or 2 rects.

### 6. Timeline
0.00-0.28 fade up on the dark room, the tilt settling across the beat; 0.22 the date types; 0.45 the phone lights, flare to 0.53; still to 1.70.

### 7. Final frame (p = 1)
Today's establish exactly (screen lit, camera 0).

### 8. Variants
One session (36, winter: the window's static snow speckle is cached; no particles). Nothing reads the story state.

### 9. Sound cues
None (`apartment`). A voicemail arrives silently.

### 10. Risks and fallbacks
- **The screen's lower 17 rows are below y 272** (C2) and 9 rows are under the caption box at this framing. The upper half and the flare read above the box. Fallback: move the ping to 0.30 (still after the fade) so it lands as the date starts typing.
- The hold (`news:36:hold`, flat `apartment(0.15)` at 2x) has no life and stays flat.

---

## Shot 12: establishDoc cases built from earlier recipes (post, chart)

The bible assigns these establishes to batch 2 recipes. They are specified here because they are drawn inside `framed()`, which batch 2's shots are not.

### 12a. Post establish (`news:<d>[v]:establish`, `r.doc === 'post'`: d 2, d 33, variant 4 `leak`)

1. **Intent.** The handoff gesture: a small phone rises, asleep, and wakes on the one post. Key movement: **the phone rising 56 px and waking** (a 164x226 screen going from dark to lit).
2. **Duration.** 1.7 s, unchanged (`fade`, first beat). Caption (date) 0.22 to 1.155.
3. **Layers.** `feed1 = [{ source: 'SQWAK', title: r.arg || title, kind: 'chirp' }]`, `sb = R.storyboard(day)`.

   | id | Contents | depth |
   | --- | --- | --- |
   | `room` | `framed(c, day, r, title, { draw: (cc) => R.phoneFrame(cc, sb, feed1, false, { part: 'room' }) })` | 0 |
   | `device` | `framed(c, day, r, title, { noBack: true, draw: (cc) => R.phoneFrame(cc, sb, feed1, false, { part: 'device' }) })` | 1 |
   | `marks` | 0.3 establish marks | 0 |

4. **Camera.** `K.rise(56, 1.7, 0.30, 0.90)`. Only `device` moves (screen pixels).
5. **Animated elements** (on `device`, inside `framed(..., { noBack: true })`, in the phone's 640x360 coordinates before the zoom; small phone: `R.phoneGeom(1, false)` = case `(230, 18, 180, 250)`, screen `(238, 30, 164, 226)`): `K.ping(c, t, { at: 1.00, off: [{ x: 238, y: 30, w: 164, h: 226, col: P.screenD }], on: [], flare: { x: 238, y: 30, w: 164, h: 226, col: P.bone, a: 0.15, dur: 0.08 } })`; while `t < 1.00`, `c.save(); c.scale(2, 2); X.textShadow(c, '6:' + mm, 160, 39, P.grey2, P.ink, { align: 'center' }); c.restore()` with `mm = String(31 + (sb.day % 24)).padStart(2, '0')` (the batch 2 handoff's sleeping clock). Cover on the phone screen's flat `P.screen` (named in batch 2).
6. **Timeline.** Fade up on the room labels; 0.30-0.90 the dark phone rises; 1.00 it wakes on the post; still to 1.70.
7. **Final frame.** Today's establish exactly.
8. **Variants.** Framing profile (d 2), over-shoulder (d 33, variant 4): zoom 1.18 baked in. Act: label and glow colours (cached). One post line only (compact card, cached).
9. **Sound cues.** None (`apartment`).
10. **Risks.** The rise is 56 screen px under a 1.18 zoom; whole screen pixels, so the scaled phone does not resample. Fallback `K.rise(40, ...)`.

### 12b. Chart establish (`r.doc === 'chart'`: d 3 wide, d 30 insert 1.34, d 43 profile 1.18)

1. **Intent.** The office wide, seen from where the printout came off. Key movement: **a refresh band sweeping each live wall monitor in turn**, as batch 2's office wide.
2. **Duration.** 1.7 s (`fade`). Caption (date) 0.22 to 1.155.
3. **Layers.** `office` (depth 1): `framed(c, day, r, title, { draw: (cc) => R.officeFrame(cc, day, false) })` (the whole flat wide, static window speckle included); `marks` (depth 0).
4. **Camera.** Settle tilt y −6 → 0, `ease.inOut`.
5. **Animated elements** (on `office`, inside `framed(..., { noBack: true })`, `officeFrame`'s 640x360 coordinates before the zoom): for each `m` of `R.officeGeom(day).monitors` with `!m.off`: `K.crt(c, m.screen.x, m.screen.y, m.screen.w, m.screen.h, t, { mode: 'roll', at: 0.35 + 0.12 * m.i, dur: 0.36 })`. No window weather (the windows keep their static speckle, C11).
6. **Timeline.** Bands from 0.35 (monitor 0) to 1.19 (monitor 4 ends), left to right; still to 1.70.
7. **Final frame.** Today's establish exactly.
8. **Variants.** Act: d 3 five live monitors, d 30 three, d 43 two (dead stay black). Market down shapes the cached charts.
9. **Sound cues.** None.
10. **Risks.** The band is a 6 px strip (the critique's weakest key movement); kept for one screen language (C1).
