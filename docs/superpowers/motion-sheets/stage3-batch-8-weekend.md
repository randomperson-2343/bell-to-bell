# Stage 3, batch 8: the weekend remainder

The beats of `B.Scenes.weekend` (`storyboard.js` 873-900) after Saturday: `sun` (Sunday night), `hold`, and on day 44 the `317` beat in its floor and rack-room forms. The `whip` beat (day 39) is built (batch 7, `DecisionArt.roomLayers('c8', day, false, null, 'whip')`); it is named here only for weather continuity (2.3). Binding: the bible (`stage3-bible.md`) sections A and C, the stage 3 plan's constraints, the pilot sheet `weekend-apartment.md`, and the critique lessons: key movement about 20x20 px or larger and clearly contrasting; nothing that matters moving below screen y 272 while a caption is up; no key movement starting under the opening fade or cross; no particles over static speckle; counts and states never step backwards across a cut; nothing shifts layout as it grows; only the kit's three blink rates; movement steps at 30 fps under half the spacing of any repeating pattern crossed. Notation: `K` = `B.MotionKit`, `M` = `B.Motion`, `X` = `B.Pixel`, `P` = `B.Pal`, `SH` = `B.Shots`. Line numbers: `storyboard.js` unless marked.

Durations unchanged: `sun` 1.8 s, `hold` 0.8 s, `317` 1.6 s. Morning chains untouched. `weekendUnique` is measured on `sat` (built) and does not move.

## 0. Shared

### 0.1 Code changes (all optional; with the new argument absent every function draws exactly what it draws today)

1. `storyboard.js` new `sundaySpace(c, fn)`, exported on `B.Storyboard`: `c.save(); c.translate(-36, -50); c.scale(1.18, 1.18); fn(c); c.restore();` (the transform of `sundayShot` lines 803-809). `sundayShot` is rewritten to `sundaySpace(ctx, (c) => apartmentShot(c, day, home, true, w)); X.rect(ctx, 0, 0, 5, 276, P.ink2); X.rect(ctx, 0, 0, 44, 2, P.amberD);` (same pixels).
2. `storyboard.js` new `SUN_EDGE(c)`: the two native edge rects of line 810-811, used by `sundayShot` and the Sunday `grain` layer.
3. `saturdayLayers(day, home, w, id, o)` (820-870): new optional `o`. **This is the one set of weekend parts; Sunday and the hold use it, no second set.**
   - `o.night` (bool): `part(name)` passes `night = true` to `apartmentShot` (today hard-coded `false`, line 822).
   - `o.space` (function `(c, fn)`): wraps every layer `draw` and every `animate` body in it (Sunday passes `sundaySpace`; absent = identity, as today).
   - `o.t0` (s, default 0): chain time added to the weather's `t` (C6) and to the colon's blink.
   - `o.seed` (string, default `id + ':wx'`): weather seed. Sunday and hold pass the Saturday beat's `satId + ':wx'` so the same particles keep falling.
   - `o.dur` (default `SAT_DUR`): used for `end` of the colon blink when `o.blink` is set.
   - `o.blink` (bool): the colon uses `K.blink(c, nx + 45, 204, 2, 2, t, { on: null, off: P.ink2, period: 1.0, duty: 0.5, end: o.dur })` and the same for `(nx + 45, 208)`, instead of Saturday's fixed spans (Saturday's 2.0 s second span would leave the colon off at 1.8 s).
   - `o.front` (function `(c, t)` or null): replaces the Saturday `front` animate (phone at 1.0, breath 0.8-1.7). Absent = Saturday's.
   - `o.top` (function `(c)`): drawn after `part('grain')` in the `grain` layer, outside `o.space` (Sunday: `SUN_EDGE`; hold: the 0.3 dim).
   - `o.flat` (bool): merges `room`, `furniture` and `front` into one layer `interior` (depth 1, draw = the three parts in order, animate = colon then `o.front`). Used by the hold, which has no camera.
   With `o` absent `saturdayLayers` returns exactly today's five layers.
4. `apartmentShot(ctx, day, home, night, w, part)` (554-741): no change. Its night branches (wall 564/566/582, sky 589-590, city lights 595, frame colours 609, lamplight 645-655, lamp bar 716, laptop screenGlow 694/698, figure 730-734, night overlay 738) already serve the layers.
5. `storyboard.js` new `phoneSpill(late)`: the Sunday phone light, returned as rect lists in apartment art units, used by the Sunday and hold animates:
   - `screen`: `{ x: 219, y: 264, w: 21, h: 6, col: late ? P.crimsonD : P.sky }`
   - `bar`: `{ x: 222, y: 266, w: 12, h: 2, col: late ? P.crimson : P.white }`
   - `spill` (light thrown up from a face-up screen, three hard steps, no gradient): `{ x: 204, y: 240, w: 51, h: 21, col: late ? P.crimson : P.sky, a: 0.10 }`, `{ x: 210, y: 249, w: 39, h: 12, col: same, a: 0.12 }`, `{ x: 216, y: 258, w: 27, h: 6, col: same, a: 0.14 }`.
6. `storyboard.js` new `faceGlow(home)`: `{ x: 213, y: (home.id === 'share' ? 213 : 180) + 6, w: 36, h: 24 }` (the glow rect of line 733); `apartmentShot` line 733 is rewritten to use it (same pixels).
7. `storyboard.js` new `laptopRect(home)`: `{ x: (home.id === 'share' ? 132 : 150) + 6, y: top - 21, w: 42, h: 18 }` with `top` as line 662-675 (couch 210, share 252, else 204): the day-44 laptop screen of line 694. Line 694 is rewritten to use it.
8. `decisions.js`: `PHASE_DUR` (451) gains `'317': 1.6, after: 2.2`. New exported `rackLeds(day)` returning the LED rects the lit racks draw (`racks()` 212-233, the `!dark` branch: rack row `r`, rack `i`, slot `s`: `{ r, i, x: x + 9 + ((i * 3 + s) % (w - 21)), y: y + s, w: 3, h: 3, col: (i + s) % 5 ? P.phosphor : P.sky }` for every slot where `(i * 7 + s + r) % 3`); `racks()` draws its LEDs from it (same arithmetic, same order). `LAYER.racks` (527) gains a branch for `e.after` with `S.f.pulledPlug` (3.5, and batch 9's pulled `after`).
9. `scenes.js` `floorGeom(zoom, seed)` (187) is used as is.

### 0.2 Which beats

| Beat id | Dur | Caption | Transition in | Own sfx |
| --- | --- | --- | --- | --- |
| `weekend:<key>:sun` | 1.8 | `story$` or `SUNDAY NIGHT. THE ALARM IS SET FOR 5:58.`, types 0.22-1.21 | cross 0.3 | `apartment` |
| `weekend:<key>:whip` (day 39, built) | 1.6 | | cross | `room` |
| `weekend:<key>:hold` | 0.8 | none | cut (`isHold`) | none |
| `weekend:<key>:317` (day 44) | 1.6 | `THE FLOOR IS DARK. THE RACKS ARE NOT.` / `... SO ARE THE RACKS.` (pulled), types 0.22-1.10 | cross 0.3 | none |

`key = <week>:<home.id>:<late 0-3>:<p or empty>:<pet kind-sex-c|n or empty>` (line 878). Chain time at the start of each beat (for `t0`): `sun` 2.4; `whip` 4.2; `hold` 4.2, or 5.8 on day 39; `317` 5.0.

### 0.3 Coordinates and the 1.18 zoom

Apartment art units are the native 640x360 coordinates of `apartmentShot` (3 px grid). On Sunday every layer draws inside `sundaySpace`: screen `sx = 1.18 ax - 36`, `sy = 1.18 ay - 50`. Every art unit edge lands on a fractional pixel, so:
- Every moving element is drawn in art units inside the same `sundaySpace` call as its layer's art (the engineers' rule), so its edges blend exactly as the art's do.
- A cover (the colon) must end by drawing nothing: the colon blink ends on, drawing nothing at `t = dur`.
- Additions that stay (the lit phone, the dead laptop) are drawn over the same rect as the art; their edge pixels blend over the art's already-blended edges. On the lit phone this is a colour change anyway; on the laptop (3.5 of the Sunday shot) a faint one-pixel screenGlow fringe may remain, which is accepted (it reads as the dying phosphor).
- No `X.dither`, gradient or speckle in any animate (C9).

### 0.4 Rect budget

Worst cases per frame: `sun` 40 weather + 2 colon + about 210 breath sprite pixels (dog, cared) + 6 phone = 258; `hold` 40 + 2 + 5 = 47; `317` floor 33, rack room 137 + nothing else. No text drawn per frame.

---

## 1. Sunday night (`weekend:<key>:sun`)

### 1.1 Intent
The last night before the alarm, the same room as Saturday, closer and darker. Key movement: **your phone lights up in the dark**: either the floor phone pinging with its light thrown up onto the bed and skirting (no figure), or, when you are sitting up with it (couch or late rent), its light pulsing on your face as you scroll. Life: the weather keeps falling, the 5:58 colon blinks, the pet breathes once.

### 1.2 Duration
1.8 s, unchanged.

### 1.3 Layers
`saturdayLayers(day, home, w, satId, { night: true, space: sundaySpace, t0: 2.4, seed: satId + ':wx', blink: true, dur: 1.8, front: sunFront, top: SUN_EDGE })`. The same five layers as Saturday:

| id | Contents (source lines) | depth | Size |
| --- | --- | --- | --- |
| `outside` | `apartmentShot(..., true, w, 'outside')` (587-607): night sky, city lights by `lit(day)`, static `R.weather`, in `sundaySpace` | 0.25 | 640x360 |
| `room` | part `room` (559-584, 608-657): night wall, frame, curtains, calendar, door and notice, lamplight rings | 0.5 | 640x360 |
| `furniture` | part `furniture` (659-718): bed or couch, story props on the bed, nightstand with the lit lamp bar (716) and clock | 0.85 | 640x360 |
| `front` | part `front` (720-736): envelopes, floor phone, rug, the figure when `couch` or late, `petShot` | 1.2 | 640x360 |
| `grain` | part `grain` (737-740: night overlay 0.28, scanlines 0.05) in `sundaySpace`, then `SUN_EDGE` (native) | 0 | 640x360 |

The weather's static speckle question (C11): Saturday keeps the static `R.weather` under its particles because in winter `R.weather` speckles only the window (dense in `penthouse`). Same here, unchanged from the approved pilot.

### 1.4 Camera
`{ from: { x: 0, y: 6, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.inOut }`. Start offsets `outside` -2 (rounded from 1.5), `room` -3, `furniture` -5, `front` -7, `grain` 0. Hole check: `6 x (0.5 - 0.25) = 1.5 <= 3 x 1.18 = 3.5` (the frame's 3-unit overlap, scaled). The 1.18 picture extends 15 px past the bottom of the screen, so the upward start offsets uncover nothing.

### 1.5 Animated elements

Figure present: `fig = (home.id === 'couch' || late > 0)` (line 730). `late = w ? w.lateWeeks | 0 : 0`. `pulled44 = day === 44 && pulled`.

| What | Layer | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Weather | `outside` | whole beat | Saturday's element unchanged, `t + 2.4`, seed `satId + ':wx'`, so the particles continue Saturday's fall in the same window. | as Saturday | (particles) |
| Colon | `furniture` | off 0-0.30 and 0.80-1.30, on at 1.8 | 0.1 item 3, `o.blink`. Screen: `stand + 45` art x, y 204-210 (studio 300 → screen x 318, y 191-198). | `ink2` cover | blink (standby) |
| **Phone (no figure, not `pulled44`)** | `front` | from 1.15 | `K.ping(c, t, { at: 1.15, on: [S.spill..., S.screen, S.bar], flare: { x: 216, y: 261, w: 27, h: 12, col: P.bone, a: 0.15, dur: 0.08 } })`, `S = phoneSpill(late > 0)`; the bar only from 1.23 (second `ping` with `at: 1.23, on: [S.bar]`). Day 39 (`THE PHONES RING ALL NIGHT`): after 1.15 the screen and bar are drawn only while `K.blink`'s badge phase is on (`period 0.5, duty 0.6, end: 1.8`), so it rings and ends lit; the spill stays. Screen: the spill and screen cover x 205-265, y 233-269 (61x36 px); all above 272. The cached floor glow line is not touched. | `sky`/`white`, late `crimsonD`/`crimson` | ping, blink (badge, day 39 only) |
| **Face glow (figure)** | `front` | spans [0.45, 0.55), [0.80, 0.90), [1.15, 1.30) | `K.flicker(c, g.x, g.y, g.w, g.h, 'weekend:sun:face', t, { spans, col: late > 0 ? P.crimson : P.screenGlow, a: 0.30 })`, `g = faceGlow(home)`: each scroll throws a harder light on the face and chest. Screen x 215-258, y 170-198 (share: y 209-237); 43x28 px. Ends drawing nothing (art). The floor phone stays dark (you are holding the phone). | `screenGlow`, late `crimson` | flicker (spans) |
| **Laptop dies (`pulled44`)** | `furniture` | at 1.15 | `K.crt(c, L.x, L.y, L.w, L.h, t, { mode: 'off', at: 1.15, bg: P.screenD })`, `L = laptopRect(home)` (`NOTHING IS TRADING`): the bed laptop's chart screen collapses to a line and dot and stays dark. Screen (studio) x 148-198, y 162-183 (50x21 px). Replaces the phone ping for this one variant; no figure pulse either when `fig` (one key). | `screenD`, `phosphor`, `white` | crt (off) |
| Pet breath | `front` | 0.40-1.00 | Saturday's breath (`breathSprite`, upper 13 rows one art unit up), moved earlier so it ends before the key. Only with a pet. | the pet's | (sprite) |

`sunFront(c, t)` draws, in this order: breath, then the phone or the face glow. The laptop is drawn by the `furniture` animate after the colon.

### 1.6 Timeline
0-0.30 cross from Saturday (weather already falling, camera starting its 6 px settle). 0.22-1.21 caption types. 0.40-1.00 the pet breathes. Figure: three scroll flashes on the face at 0.45, 0.80, 1.15. No figure: 1.15 the floor phone lights with one flare and throws its light up the bed; 1.23 the notification bar. Pulled day 44: 1.15 the laptop switches off. 1.30 colon back on. 1.8 still.

### 1.7 Final frame
Changes from today in the no-figure case: the floor phone is lit (sky screen, white bar, the three spill rects; crimson family when late). Pulled day 44: the laptop screen is dark. Figure case: today's. Weather particles at their 12-a-second pose for chain time 4.2 s. `sun` is not in any uniqueness count.

### 1.8 Variants
| Variant | Behaviour |
| --- | --- |
| `couch` | Figure always (`fig`): face glow. Window 141x150; weather counts as Saturday. |
| `share` | Figure only when late; the figure sits at y 213, so the face glow is at art y 219. Stand 255. |
| `studio`, `onebed`, `loft`, `penthouse` | No figure unless late: floor phone. The 1.18 frame keeps the calendar and most of the window (penthouse's window runs off the right edge, as today). |
| Late rent 1-3 | Figure present in every home; crimson pulse. Envelopes, door and notice static. |
| Season | Saturday's three weathers at night (snow white on the night sky; drizzle grey2; leaves). |
| Pet none / cat / dog, cared / neglected | Breath only with a pet; neglected sprite breathes the same. |
| Story days 4, 14, 24, 34, 39, 44 | Bed props static (`furniture`). Day 39 rings (badge blink, cue `ring`). Day 44 not pulled: the phone lights (the machines still trading). Day 44 pulled: laptop off instead. |
| No game (`w` undefined) | studio, no pet, no figure, floor phone sky. |

### 1.9 Sound cues
One cue, never `apartment` (own sfx): no figure `{ at: 1.15, sfx: 'news' }` (day 39 `ring`); figure: none, except day 39 `{ at: 1.15, sfx: 'ring' }`; pulled day 44 `{ at: 1.15, sfx: 'click' }`.

### 1.10 Risks and fallbacks
- Fractional edges (0.3). If the laptop's fringe shows at 1440x900, draw the off fill one art unit larger on each side (`L.x - 1, L.y - 1, L.w + 2, L.h + 2`); it then covers one unit of the bezel's inner edge, which is `plasticD` on both sides and reads the same.
- Layer split under a fractional transform: each layer canvas blends its own edges; where two layers' edges meet (furniture over room) the composite may differ from the flat still by one level on edge pixels. Not tested (`sun` is not counted); check `share` (wardrobe) and `penthouse` (calendar over frame) by eye.
- If the face pulse reads too weakly under the 0.28 night overlay, raise `a` to 0.40.
- Fallback: camera null (no parallax), all elements kept.

---

## 2. Weekend hold (`weekend:<key>:hold`)

### 2.1 Intent
The night room, wide again, under a 0.3 dim: rest. No key movement; the colon and the weather continue, and what Sunday changed stays changed.

### 2.2 Duration
0.8 s.

### 2.3 Layers
`saturdayLayers(day, home, w, satId, { night: true, flat: true, t0: day === 39 ? 5.8 : 4.2, seed: satId + ':wx', blink: true, dur: 0.8, front: holdFront, top: dim03 })`, no `space` (the hold is the flat night room at 1.0, line 896). Three layers, which is all the motion needs:

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `outside` | part `outside`, night; animate: weather | 1 | 640x360 |
| `interior` | parts `room`, `furniture`, `front` in order; animate: colon, then `holdFront` | 1 | 640x360 |
| `grain` | part `grain` (night overlay, scanlines), then `dim03`: `X.rect` ink at 0.3 over 640x360 (line 896) | 1 | 640x360 |

### 2.4 Camera
`camera: null`.

### 2.5 Animated elements
| What | Layer | Times | Movement | Kit |
| --- | --- | --- | --- | --- |
| Weather | `outside` | whole beat | as Saturday, chain time `t + t0`, same seed: continuous from Saturday through Sunday (and the whip). Native coordinates: the window rect is Saturday's own. | (particles) |
| Colon | `interior` | off 0-0.30, on 0.30-0.80 | `o.blink` with `end: 0.8`. Sunday ended on an on phase, so the next off phase follows across the cut (0.3 s, shortened from 0.5 so the hold ends lit). | blink |
| State carried (`holdFront`) | `interior` | static | No figure, not `pulled44`: `S.screen`, `S.bar`, `S.spill` of `phoneSpill(late > 0)` drawn every frame (the phone Sunday lit stays lit). `pulled44`: `X.rect(L, P.screenD)` (the dead laptop stays dead). Figure: nothing. | none |

### 2.6 Timeline
Cut in. 0.30 colon on. Weather throughout.

### 2.7 Final frame
Changes from today exactly as Sunday's (lit phone, or dark laptop on pulled day 44), otherwise today's.

### 2.8 Variants
As 1.8, at the wide framing (Saturday's geometry). Day 39: the hold follows the whip room; weather `t0` 5.8.

### 2.9 Sound cues
None.

### 2.10 Risks and fallbacks
- Three layers in a 0.8 s beat: the first frame builds them. If the phone perf gate fails on this beat, merge `outside` into `interior` and drop the weather (colon only).

---

## 3. The 3:17 beat, day 44 (`weekend:<key>:317`)

Two pictures share the id pattern (`key` carries `p` when pulled). Both 1.6 s, cross in, caption types 0.22-1.10, no own sfx.

### 3.1 Intent
- **Not pulled** (`THE RACKS ARE NOT.`): the dark floor at 3:17 AM, where only the machines' screens are lit. Key movement: **a refresh wave crosses the lit screens left to right**, the machines still trading in an empty room.
- **Pulled** (`SO ARE THE RACKS.`): the rack room at the moment the token dies (story text of c10: "The token dies at 3:17 AM"). Key movement: **the racks' LEDs go dark rack by rack, spreading from the red switch to the right**.

The bible's "rack LEDs keep chasing" cannot be done on the floor without new art: the floor picture (`SH.tradingFloor(0.4, false, 60)`) has no racks, only screens. The wave is designed on the screens it does have. The bible's "one standby LED blinks out" is under 20x20 px; replaced by the whole room going dark, which is the moment itself.

### 3.2 Duration
1.6 s.

### 3.3 Layers
Not pulled, new `floor317Layers(day)` in `storyboard.js`:

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `floor` | `at2x(c, (cc) => SH.tradingFloor(cc, 0.4, false, 60), day)` (line 897's picture); animate the wave | 1 | 640x360 |

Pulled: `B.Motion.layered(Object.assign({}, beat, DecisionArt.roomLayers('c10', day, true, S, '317')))`: `room` (`room(c, 'c10', 44, true, S, { noGrain: true })`, the dark racks of `decisions.js` 212-233 with the 0.45 dim) and `grain` (0.04 scanlines), as batch 7.

### 3.4 Camera
`camera: null` for both (bible).

### 3.5 Animated elements

**Not pulled** (art units, inside `at2x`; `G = SH.floorGeom(0.4, 60).filter((g) => g.on)`): the near-row screens the late floor leaves lit, about 8 visible (rows 2 and 3, art y 51-85 and 87-144; screen y 102-170 and 174-288).

| What | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Wave | `a_g = 0.35 + 0.5 * clamp01((g.x + g.w / 2) / 320)`, to 1.21 | For each `g`: `K.crt(c2, g.x, g.y, g.w, h, t, { mode: 'roll', at: a_g, dur: 0.36, band: 12 })` and `K.ping(c2, t, { at: a_g, flare: { x: g.x, y: g.y, w: g.w, h, col: P.bone, a: 0.18, dur: 0.08 } })` with `h = Math.min(g.h, 136 - g.y)`: row 3's screens are clipped at art y 136 (screen 272) so nothing that matters moves under the caption. The batch 5 lit-floor wave exactly (band 12 units, bone flare), on the lit screens only. A row-2 screen is about 60x68 px, so each flare reads alone. Overlays on the dither, never a cover. Stop drawing at 1.25. | `phosphorD` 0.22, `phosphor` 0.4, `bone` 0.18 | crt (roll), ping |

Worst case 3 rects a screen, about 33.

**Pulled** (`LAYER.racks` branch when `e.after && e.S && e.S.f && e.S.f.pulledPlug && e.phase === '317'`; native 640 coordinates; `Ls = DecisionArt.rackLeds(day)`): the dark art has no LEDs; the animate draws each LED lit, full brightness over the dim, until its rack dies.

| What | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Racks die | front row (`r = 1`) rack `i` at `0.40 + 0.10 i` (0.40-1.00); back row (`r = 0`) rack `i` at `0.45 + 0.10 i` (0.45-0.95) | `Ls.forEach((L) => { if (t < (L.r ? 0.40 : 0.45) + 0.10 * L.i) X.rect(g, L.x, L.y, 3, 3, L.col); })`: hard steps, no flare (the lights simply stop). Each rack column is 54x222 px (front) or 39x159 px (back) of about ten LEDs; the darkness moves from the switch (x 99-171) across the room. Screen x 177-660 (clipped at 640), y 30-252: above 272. The last rack dies at 1.00, within 0.1 s of the caption's end (1.10). | `phosphor`, `sky` (the art's own LED colours) | lamps-style (cells drawn until their switch) |

Worst case 137 rects at `t < 0.40`.

### 3.6 Timeline
Not pulled: cross in 0-0.30; 0.35-1.21 the wave crosses the lit screens left to right; still. Pulled: cross in on a room still lit with LEDs; 0.40-1.00 the racks go dark one after another from the switch outward; 1.00-1.60 the dark room.

### 3.7 Final frame
Both: today's still exactly (the wave ends by drawing nothing; the LEDs are gone at the end, which is the dark art).

### 3.8 Variants
Not pulled / pulled only. Home, pet and season do not reach this beat (the floor reads day 44's season through `at2x` in its windows, static).

### 3.9 Sound cues
Not pulled `{ at: 0.30, sfx: 'office' }` (the floor's hum, the one sound of the empty floor). Pulled `{ at: 0.40, sfx: 'click' }` (the switch, as the first rack dies).

### 3.10 Risks and fallbacks
- Not pulled: the transition is a cross, so the wave starts at 0.35, after it.
- Pulled: LEDs drawn at full brightness over the 0.45 dim are brighter than the lit room's LEDs ever were; intended (a dark room with its last lights). If the coordinator finds it too bright, draw them at alpha 0.7.
- `rackLeds` must reproduce `racks()`'s `continue` for `r === 0 && i > 5` and its slot step `Math.round(12 * k / U) * U || U`.
- The `c10` decision's own room beat (`after = false`) is untouched; the branch requires `e.after`.

---

## 4. Continuity notes

- The `whip` beat (built) sits between `sun` and `hold` on day 39; it has no weather. The hold's weather `t0` counts its 1.6 s.
- What Sunday changes (lit phone, dead laptop) the hold keeps; nothing relights across a cut.
- The floor `317` follows the hold on day 44 with a cross; the pulled `317` shows the moment the plug takes effect, and the news of day 45 (batch 5 `racksLayers`) and the pulled ending `after` (batch 9) show the dark that follows.
