# Stage 3, batch 6: story tableaux

The eight `briefingTableau` set pieces (`scenes.js` 404-521) as the `tableau` shot draws them through `tableau()` (`storyboard.js` 79-89), in their establish, detail and hold beats. Binding: the bible (`stage3-bible.md`) sections A and C, the stage 3 plan's constraints, and the batch 4/5 critique: one key movement per shot, about 20x20 px or larger and clearly contrasting; nothing that matters moving below screen y 272 while a caption is up; no key movement starting under the opening fade or cross; no count or position stepping backwards across a cut; nothing that shifts layout as it grows; only the kit's three blink rates; no particles over static speckle. Notation as batches 4 and 5 (`K` = `B.MotionKit`, `M` = `B.Motion`, `X` = `B.Pixel`, `P` = `B.Pal`, `SH` = `B.Shots`). Line numbers: `scenes.js` unless marked `storyboard.js`.

All shots are tier 2 (living still). No durations change, no beats are added. Every establish's final frame is today's still (establishGroups untouched). One detail and one hold change (Kavro Strait, ships 4 art units further on; see 1.7).

## 0. Shared

### 0.1 Code changes (all optional; with the new argument absent every function draws exactly what it draws today)

1. `scenes.js` `briefingTableau(ctx, day, p, o)` (404): new optional `o`.
   - `o.part`: `'art'` draws everything except the scanlines of line 519; `'scan'` draws only line 519 (after the number check at 405, nothing else, no ink, no header); undefined draws both, as today.
   - `o.noMover`: leaves out the tableau's mover: tableau 3 the three ships (420-424), tableau 9 the nine queue figures (467-471), tableaux 12 and 13 the witness block at the table (500). Other tableaux ignore it.
2. `scenes.js` new `tableauMover(ctx, n, p, o)`, exported on `SH`: the mover lines moved out of `briefingTableau` unchanged, which `briefingTableau` now calls in their place (when `!o || !o.noMover`) with `(ctx, n, p)`, so the flat picture is pixel-identical. Extra optional arguments, used only by layer builders:
   - `o.shift(i)` returns `[dx, dy]` in whole art units added to item `i` (ship `i`, figure `i`, the witness `i = 0`); default `[0, 0]`.
   - `o.maxY`: rects are cut at that art y (figure bodies: `h = min(24, maxY - 91)`). The flat call passes none (the art draws h 24 and the ink2 strip at 472 covers rows 113-114).
3. `scenes.js` new `tableauGeom(n)`, exported on `SH`, returning the static rects (art units, before the 7 px shift) that `briefingTableau` draws and the layer builders cover or light; `briefingTableau` is refactored to draw those rects from it (same arithmetic, same order, same pixels):
   - 5: `bars[i]` = `{ x: 182 + (i % 3) * 34 + 4, y: 77 + floor(i / 3) * 21 + 4, w: 20, h: 5, red: i > 2 }` (440).
   - 8: `slots[i]` = `{ x: 28 + 55 i + 5, y: 40, w: 28, h: 56 }` (the six screens of rack `i`, 450); `links[i]` (i < 4) = `[{ x: 28 + 55 i + 38, y: 70, w: 16, h: 2 }, { x: 28 + 55 i + 49, y: 67, w: 5, h: 8 }]`, `col` `i > 1 ? crimson : sky` (454-455).
   - 11: `marks[i]` = `{ x: 16 + 50 i + 6, y: 85, w: 30, h: 16 }`: the bar (479) and the HOLD text (480, x + 10 .. x + 32, y 94-100) on the plate's flat `desk2` interior.
   - 12, 13: `witness` = `{ x: 154, y: 85, w: 12, h: 12 }` (500); `badge` = `{ x: 265, y: 3, w: 46, h: 7 }` (410).
   - 14: `nodes[i]` = `{ x: 24 + 45 i, y: 35 + (i % 3) * 18, w: 5, h: 5, lit: i < 3 }` (510-511).
4. `storyboard.js` new `tableauSpace(c, zoom, fn)`: the transform of `tableau()` lines 81-83 (`save`; with `zoom` `translate(160 * (1 - zoom), 76 * (1 - zoom))`, `scale(zoom, zoom)`; `translate(0, 7)`; `fn(c)`; `restore`). `tableau()` is rewritten to use it.
5. `storyboard.js` `tableau(c, n, zoom, o)`: new optional `o`:
   - `o.part: 'art'`: the ink rect (80), then `briefingTableau(c, n, p, { part: 'art', noMover: o.noMover })` in `tableauSpace`; no header strip.
   - `o.part: 'scan'`: no ink rect; `briefingTableau(c, n, p, { part: 'scan' })` in `tableauSpace`; then the slate header strip (87) when `!zoom`.
   - `o.p`: replaces the constant 0.6 (used only by session 6's detail and hold, 1.7).
   - Undefined `o`: today's function exactly.

### 0.2 Which beats

`r.shot === 'tableau'`, `n = r.arg`. No tableau day has a story variant except day 45 (`f.pulledPlug` turns it into the racks, batch 5). Beat ids carry no variant suffix: `news:<d>:establish` (1.7 s, caption the date, 0.22-1.155), `news:<d>:detail` (2.3 s, caption the title, 0.22-1.37), `news:<d>:hold` (1.1 s, no caption).

| Day (session) | Tableau | Weight | Beats (transition into the establish) |
| --- | --- | --- | --- |
| 6 (7) | 3 Kavro Strait | L | establish (fade), detail, hold |
| 9 (10) | 5 grid | L | establish (fade), detail, hold |
| 17 (18) | 8 model flow | XL | act card (batch 4), establish (**cross**, 0.3 s), detail, hold |
| 20 (21) | 9 bank queue | XL | establish (fade), detail, hold |
| 25 (26) | 11 records | M | establish (fade), detail |
| 37 (38) | 12 hearing | XL | establish (fade), detail, hold |
| 40 (41) | 13 floor vote | XL | establish (fade), detail, hold |
| 45 (46) | 14 final day | XL | establish (fade), detail, hold (racks instead when `f.pulledPlug`) |

Routing in `B.Scenes.news` (`storyboard.js` 1349-1373): one new branch `else if (r.shot === 'tableau')` calling `tableauLayers(day, r, phase, b.dur)`; a phase that returns null stays flat.

### 0.3 Common layer pattern

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `art` | `at2x(c, (cc) => tableau(cc, n, Z, { part: 'art', noMover }), day)`; `animate`: `at2x(c, (cc) => tableauSpace(cc, Z, (g) => paint(g, t)), day)` | 1 | 640x360 |
| `glass` | `at2x(c, (cc) => tableau(cc, n, Z, { part: 'scan' }), day)`; then establish `finePass(c, day, r, 'establish', 'world')`, detail `finePass(c, day, r, 'detail')`, hold nothing | 1 | 640x360 |
| `marks` (establish) / `dim` (hold) | establish: `finePass(c, day, r, 'establish', 'frame'); tell(c, day)` (anomaly tear on 17 and 25); hold: the 0.18 ink rect (line 1344) | 0 | 640x360 |

`Z` = 0 (establish, hold) or 1.3 (detail). The detail has no third layer. The `glass` layer is the bible's one split: the 0.1 scanlines sit above every cover and mover, so a cover on a flat fill never loses its scanlines. `framed()` is the identity for tableaux (`flat`, wide camera, `storyboard.js` 463-465), so no `framed` call is needed.

**Camera.** Establish: `SETTLE()` tilt y −6 → 0, `ease.inOut` (`art` and `glass` depth 1; brackets and tear depth 0 never move). Detail and hold: `camera: null`.

**Coordinates.** Every number in the shots below is in `briefingTableau` art units (320x180, before the 7 px drop). Screen position: establish and hold `sx = 2 ax`, `sy = 2 (ay + 7)`; detail (zoom 1.3) `sx = 2.6 ax − 96`, `sy = 2.6 ay − 27.4`. Movers move in whole art units (2 px on the establish, 2.6 px on the detail, the same grid the art itself is drawn on in that transform). On the detail the transform has fractional offsets: covers there must end by drawing nothing (never by redrawing the art colour over itself, which would double the edge blending, the racks lesson of batch 5).

**Sound.** Own `sfx`: establish `apartment`, detail `broadcast`, hold none. One cue only where stated.

**Budget.** Every tableau's animate is under 30 rectangles a frame; worst case per shot given in its section. No text is drawn per frame anywhere in this batch.

---

## 1. Kavro Strait (tableau 3, day 6)

### 1.1 Intent
A live shipping map: the three ships keep sailing along the lane. Key movement: **the three ships sailing east** (each 19x4 hull plus 8x4 cabin; 38x16 px a ship on the establish).

### 1.2 Duration
Unchanged (1.7 / 2.3 / 1.1).

### 1.3 Layers
0.3, `noMover: true`. Hold: flat (1.7).

### 1.4 Camera
0.3.

### 1.5 Animated elements (`art`, art units)

`paint(g, t) = SH.tableauMover(g, 3, off / 9)`, so the art's own `Math.round(p * 9)` gives exactly `off` (draw `off` with `p = off / 9`).

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Ships | establish | 0.35-1.35 | `off = -4 + round(9 * M.ease.out(K.span(t, 0.35, 1.35)))`: −4 → +5 (today's p 0.6), 18 px. Ships at x 119..226, y 62-94; screen x 238-452, y 138-202. | bone, crimson, slate2 (the art's) | (tableauMover) |
| Ships | detail | 0.35-1.95 | `off = 5 + floor(4 * K.span(t, 0.35, 1.95) + 1e-9)` capped at 9: four steps of 2.6 px, from where the establish left them. Screen y 134-217. | as above | (tableauMover) |

Worst case 6 rects.

### 1.6 Timeline
Establish: fade up with the ships 4 units short of today's place; 0.35-1.35 they sail into it; still. Detail: cross in at +5; one step every 0.4 s to +9 by 1.95. Hold: cut in at +9 under the dim.

### 1.7 Final frame
Establish: today's exactly. **Detail and hold change**: ships at `p = 1` (+9, 4 art units east of today). The hold is rebuilt flat for day 6 only (same id, duration and options; draw `at2x(c, (cc) => tableau(cc, 3, 0, { p: 1 }), day)` then the 0.18 dim), so the ships never step back across a cut. No other session shows this map, so no two stills become more alike.

### 1.8 Variants
None (act 1, autumn; the tableau reads neither season nor act; the corner brackets' signal colour is cached).

### 1.9 Sound cues
None.

### 1.10 Risks and fallbacks
- Ships cross the dashed cable stroke (418-419): it is in `art`, under them, as in the flat order.
- Fallback if the detail/hold change is refused: detail and hold flat at +5; the key stays on the establish.

---

## 2. Grid (tableau 5, day 9)

### 2.1 Intent
Data centres overloading the grid. Key movement: **the five load cells flashing red in sequence** (each bar 20x5 = 40x10 px; the cluster is 176x52 px), three recovering, two staying red.

### 2.2 Duration
Unchanged.

### 2.3 Layers
0.3 (`noMover` has no effect). Hold: layered (life continues).

### 2.4 Camera
0.3.

### 2.5 Animated elements (`art`; `B = SH.tableauGeom(5).bars`; screen establish y 176-186 and 218-228, detail y 183-196 and 238-251)

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Overload | establish | 0.40-1.10 | `K.lamps(g, B, t, { at: 0.40, step: 0.10, on: P.crimson })` drawn only while `t < 1.10`: bar `k` turns bright crimson at `0.40 + 0.10 k`; at 1.10 all stop drawing and the art shows (bars 0-2 screenGlow, 3-4 crimsonD). A cover on the bars' flat fills. Settles at 1.10, within 0.1 s of the caption's end (1.155). | `crimson` | lamps |
| Alarm | detail | 0.35-2.30 | bars 3 and 4: `K.blink(g, b.x, b.y, b.w, b.h, t, { on: null, off: P.crimson, period: 0.5, duty: 0.6, end: dur })`, called only for `t >= 0.35`. Ends on (nothing drawn, art). | `crimson` | blink (badge) |
| Alarm | hold | 0.10-1.10 | as the detail, from 0.10 (no transition on a cut; hold has no caption). | `crimson` | blink |

Worst case 5 rects.

### 2.6 Timeline
Establish: fade; the cells go red left to right, top row first, 0.40-0.80; at 1.10 three drop back to green. Detail and hold: the two red cells pulse at badge rate.

### 2.7 Final frame
Today's in all three beats.

### 2.8 Variants
None (act 1, autumn).

### 2.9 Sound cues
None.

### 2.10 Risks and fallbacks
- On the detail the `off` phase covers bars drawn under a fractional transform; the last phase draws nothing (0.3 rule). If edge blending shows during the pulse, fall back to an alpha overlay instead of the opaque off colour: `P.crimson` at 0.6 over the bar (drawn with `K.flicker` spans at the same badge timing).

---

## 3. Model flow (tableau 8, day 17)

### 3.1 Intent
Four funds, one model: the same signal runs rack to rack. Key movement: **a pulse running left to right**: each rack's screen column flares (28x56 = 56x112 px), then the link to the next rack flashes white.

### 3.2 Duration
Unchanged. The establish follows the act card with a 0.3 s cross.

### 3.3 Layers
0.3. Hold: flat.

### 3.4 Camera
0.3.

### 3.5 Animated elements (`art`; `G = SH.tableauGeom(8)`; screen establish y 94-206, detail y 77-222)

Hop `k = 0..4` at `a_k = A + 0.18 k`:

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Rack flare | `a_k` to `a_k + 0.08` | `K.ping(g, t, { at: a_k, off: [], on: [], flare: Object.assign({ col: P.bone, a: 0.20, dur: 0.08 }, G.slots[k]) })` | `bone` 0.20 | ping |
| Link flash | `a_k + 0.04` to `a_k + 0.14` (k < 4) | both rects of `G.links[k]` in `P.white` while inside the span; nothing otherwise (the art's sky/crimson link shows). | `white` | (rect) |

`A = 0.36` on the establish (last flare ends 1.16, at the caption's end), `A = 0.40` on the detail (rack 0 is mostly off frame on the detail: x −10..63; rack 4 at 562-635). One pass per beat; a pulse is an event, not a count, so repeating it on the detail steps nothing back.

Worst case 3 rects.

### 3.6 Timeline
Establish: cross in from the act card; 0.36-1.16 the pulse runs across the five racks. Detail: the same pass, 0.40-1.20. Hold: flat.

### 3.7 Final frame
Today's in all beats.

### 3.8 Variants
Act 3 (Contagion), grey; anomaly tear (day 17) in `marks`.

### 3.9 Sound cues
None.

### 3.10 Risks and fallbacks
- 0.20 bone on dark screens may read faint; raise to 0.30 if the strip shows it weak (still under the 0.1 scanlines in `glass`).

---

## 4. Bank queue (tableau 9, day 20)

### 4.1 Intent
A run on Ridgeway Trust, rebroadcast live. Key movement: **the queue shuffling forward**, a ripple from the front (left) to the back: nine figures (9x24 art, 18x48 px each) stepping 2 art units left one after another.

### 4.2 Duration
Unchanged.

### 4.3 Layers
0.3, `noMover: true`. Hold: flat.

### 4.4 Camera
0.3.

### 4.5 Animated elements (`art`; figures x 52..286, y 84-112; screen establish y 182-240, detail y 191-264)

`paint(g, t) = SH.tableauMover(g, 9, 0.6, { shift: (i) => [d(i, t), 0], maxY: 113 })` (the art's p 0.6 keeps today's sway of the odd figures).

| What | Beat | Start-end (s) | Movement | Kit |
| --- | --- | --- | --- | --- |
| Shuffle forward | establish | 0.40-0.96 | `d(i, t) = t < 0.40 + 0.07 i ? 2 : 0`: everyone starts 2 units back and steps up in turn, front first. | (tableauMover) |
| Press forward | detail | 0.40-1.24 | `d(i, t) = (t >= 0.40 + 0.07 i && t < 0.68 + 0.07 i) ? -2 : 0`: each leans in 2 units and back, front first. | (tableauMover) |

The bodies are cut at y 113 (`maxY`), exactly where the cached ink2 strip covers them in the art. Worst case 18 rects.

### 4.6 Timeline
Establish: fade; the queue edges up, a step passing from front to back in 0.56 s. Detail: a second ripple, leaning in and back.

### 4.7 Final frame
Today's in all beats.

### 4.8 Variants
Act 3, grey. The LIVE badge is cached (crimson; `day >= 9`).

### 4.9 Sound cues
None.

### 4.10 Risks and fallbacks
- The figures stand on the putty facade, the plastic2 band and the screens (all cached in `art` without them). A 4 px step on 18x48 px dark figures over putty is high contrast.

---

## 5. Records (tableau 11, day 25)

### 5.1 Intent
A preservation sweep. Key movement: **HOLD stamps landing carton by carton**, six cartons, left to right, the last as the date caption finishes.

### 5.2 Duration
Unchanged (M: establish and detail; no hold).

### 5.3 Layers
Establish: 0.3. Detail: flat (the cartons are stamped; nothing else on this tableau carries a movement worth a third layer; see 5.10).

### 5.4 Camera
0.3.

### 5.5 Animated elements (establish, `art`; `Mk = SH.tableauGeom(11).marks`; screen y 162-226)

For carton `i`, `a_i = 0.55 + 0.11 i` (last lands 1.10, phase 3 at 1.18, within 0.1 s of 1.155):

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Cover | 0 to `a_i + 0.08` | `X.rect(g, m.x, m.y, m.w, m.h, P.desk2)` while `K.stamp` returns a phase below 3: the bar and HOLD text hidden on the plate's flat desk2 face (named flat fill; the scanlines are in `glass`, above). | `desk2` | cover |
| Stamp | `a_i` to `a_i + 0.08` | `K.stamp(g, m.x, m.y, m.w, m.h, t, { at: a_i, col: P.crimson, frame: 0.04, grow: [16, 6], style: 'none' })`: a 46x24 outline, a 36x19 2-unit outline, then the cached mark is revealed. | `crimson` | stamp |

Worst case 6 covers + 8 outline rects = 14.

### 5.6 Timeline
Fade up on six blank cartons; 0.55-1.10 a stamp lands on each in turn; the last reveal at 1.18.

### 5.7 Final frame
Today's (establish). Detail unchanged and flat.

### 5.8 Variants
Act 3, grey; anomaly tear (day 25) in `marks`. Public feed header (`day >= 11`), cached.

### 5.9 Sound cues
Establish `{ at: 1.10, sfx: 'click' }` (the last stamp).

### 5.10 Risks and fallbacks
- Detail flat: the officers' badges are 9x7 art and blinking ID badges would read as a bug, and replaying a stamp would un-stamp a carton across the cut. Keep flat.

---

## 6. Hearing (tableau 12, day 37)

### 6.1 Intent
The committee, live. Key movement: **the witness leaning in to the microphone** (the 12x12 desk2 block at the table, 24x24 px establish, 31x31 detail). Life: the LIVE badge blinks (establish and hold; the header is off frame on the detail).

### 6.2 Duration
Unchanged.

### 6.3 Layers
0.3, `noMover: true` on all three beats (the witness is drawn by the animate). Hold: layered.

### 6.4 Camera
0.3.

### 6.5 Animated elements (`art`; `W = SH.tableauGeom(12).witness`, `Bd = .badge`)

`paint` always draws `SH.tableauMover(g, 12, 0.6, { shift: () => [0, dy(t)] })`.

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Lean | establish | 0.45-0.65 | `dy = -3 + min(3, max(0, floor((t - 0.45) / 0.10) + 1))`: sits back 3 units, leans in one unit at 0.45, 0.55, 0.65 to today's place. Screen y 178-208. | `desk2` | (tableauMover) |
| Lean | detail | 0.60-1.30 | `dy = t >= 0.60 && t < 1.30 ? 3 : 0`: leans 3 units closer (7.8 px) to speak, sits back. Screen y 194-240. | `desk2` | (tableauMover) |
| Lean | hold | none | `dy = 0`. | | |
| LIVE | establish, hold | from 0.30 (hold 0.10) | `K.blink(g, Bd.x, Bd.y, Bd.w, Bd.h, t, { on: null, off: P.slate, period: 0.5, duty: 0.6, end: dur })`: the badge covered by the header's flat slate in its off phase; on at the end. Screen (530, 20, 92, 14). | `slate` | blink (badge) |

Worst case 2 rects.

### 6.6 Timeline
Establish: fade; the badge pulses; 0.45-0.65 the witness leans to the mic. Detail: at 0.60 the witness leans in, back at 1.30. Hold: badge pulses under the dim.

### 6.7 Final frame
Today's in all beats.

### 6.8 Variants
Act 4, winter (the tableau has no window: nothing). Header text `MARKETS COMMITTEE · LIVE`, cached.

### 6.9 Sound cues
None.

### 6.10 Risks and fallbacks
- The block uncovers the gradient band (y 85-93) when it sits back: cached in `art` without it, so exact.
- If the lean reads too small, 6 units on the detail.

---

## 7. Floor vote (tableau 13, day 40)

### 7.1 Intent
The stabilization vote, pending. Key movement on the establish and hold: **VOTE PENDING blinking** (the line, 71x7 art = 142x14 px, crimson on ink). The detail pushes the box under the caption (screen y 264-316), so its key is the witness lean of 6.5.

### 7.2 Duration
Unchanged.

### 7.3 Layers
0.3, `noMover: true` (the witness, as 6). Hold layered.

### 7.4 Camera
0.3.

### 7.5 Animated elements (`art`)

Cover rect `Pd = { x: 160 - ((X.textWidth('VOTE PENDING') - 1) / 2 | 0), y: 118, w: X.textWidth('VOTE PENDING') - 1, h: 7 }` = (125, 118, 71, 7) on the box's flat ink interior; screen (250, 250, 142, 14), y 250-264, above the caption.

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Pending | establish | 0.30-1.70 | `K.blink(g, Pd.x, Pd.y, Pd.w, Pd.h, t, { on: null, off: P.ink, period: 0.5, duty: 0.6, end: dur })` for `t >= 0.30`. | `ink` | blink (badge) |
| Pending | hold | 0.10-1.10 | as above. | `ink` | blink |
| Witness | all | | as 6.5 (establish lean, detail lean, hold still). On the establish the lean is life; the blink is the key. | `desk2` | (tableauMover) |

Worst case 2 rects.

### 7.6 Timeline
Establish: fade; VOTE PENDING pulses from 0.30; the witness leans in 0.45-0.65. Detail: lean 0.60-1.30. Hold: the line pulses under the dim (no caption).

### 7.7 Final frame
Today's in all beats.

### 7.8 Variants
Act 4, winter. Title in amber, cached.

### 7.9 Sound cues
None.

### 7.10 Risks and fallbacks
- Two movements on the establish (pending blink and the lean): the lean is three 2 px steps, background-scale; drop it on the establish if the strip shows competition.

---

## 8. Final day (tableau 14, day 45)

### 8.1 Intent
The network after the crash. Key movement: **four nodes dying in sequence**, each with a hard white-bone flash (11x11 art = 22x22 px) as it goes from sky to crimsonD, left to right along the network.

### 8.2 Duration
Unchanged.

### 8.3 Layers
0.3. Hold flat. No particles: the rain streaks of `endingShot('dark')` are static speckle-like texture (bible risk).

### 8.4 Camera
0.3.

### 8.5 Animated elements (`art`; `N = SH.tableauGeom(14).nodes`; nodes 3-6 at (159, 35), (204, 53), (249, 71), (294, 35); screen establish x 312-610, y 78-184)

Node `k = 3..6` dies at `a_k = 0.60 + 0.18 (k - 3)` (0.60, 0.78, 0.96, 1.14: the last within 0.1 s of the caption's end).

| What | Beat | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Alive | establish | 0 to `a_k` | `K.ping(g, t, { at: a_k, off: [{ x, y, w: 5, h: 5, col: P.sky }], on: [], flare: { x: x - 3, y: y - 3, w: 11, h: 11, col: P.bone, a: 0.45, dur: 0.08 } })`: the cached crimsonD node covered in sky (named flat fill: the node itself) until its death, then one flash, then the art. | `sky`, `bone` 0.45 | ping |
| Last link | detail | 0.50-0.94 | node 2 (114, 71; screen 200-213 x 157-170): `K.flicker(g, x, y, 5, 5, 'news:45:n2', t, { spans: [[0.50, 0.56], [0.64, 0.80], [0.90, 0.94]], col: P.ink, a: 0.6 })`; ends lit. Background life only (13x13 px). | `ink` 0.6 | flicker |

The links (`stroke`, 513-514) stay as drawn: the links from nodes 3-5 are already slate2 in the art. Worst case 5 rects.

### 8.6 Timeline
Establish: fade on seven lit nodes; 0.60-1.14 the four on the right die, one flash each. Detail: the last live node stutters three times and holds. Hold: flat.

### 8.7 Final frame
Today's in all beats (the dead stay dead: nothing relights after the establish).

### 8.8 Variants
Act 4, winter. With `f.pulledPlug` the session is the racks (batch 5), not this.

### 8.9 Sound cues
None (the establish's own `apartment`; a `loss` sting here would be louder than the moment).

### 8.10 Risks and fallbacks
- Nodes are 10x10 px; the flash carries the read. Fallback: flash 15x15 art.
- Node 6 is off frame on the detail (x 668), which is why the detail does not replay deaths.
