# Stage 3, batch 9: endings

The three beats of `B.Scenes.ending` (`storyboard.js` 1810-1818) for all 22 ending ids (`R.endingIds`, `rhythm.js` 10), dark and light, plus the pulled-plug `after`. Binding: the bible sections A and C, the stage 3 plan's constraints, and the critique lessons (key movement about 20x20 px or larger and clearly contrasting; nothing that matters below screen y 272 while a caption is up; no key movement under the opening fade; no particles over static speckle; nothing steps backwards across a cut; no layout shift; the kit's three blink rates; 30 fps steps under half the spacing of any repeating pattern crossed). Notation: `K` = `B.MotionKit`, `M` = `B.Motion`, `X` = `B.Pixel`, `P` = `B.Pal`, `SH` = `B.Shots`. Line numbers: `scenes.js` unless marked.

An ending is seen once per run and is the last cutscene before the ending screen, which then starts its own music and ending sound (`screens.js` 365-378, `show()`). So each ending gets **one clear, unhurried movement of its own prop** in the world beat; the card holds still except for one landing; the after beat has one slow change. No busyness, no competing sound.

Durations unchanged (world 1.8 s, card 2.6 s, after 2.2 s): every movement below fits in 0.40-1.40 s. Morning chains are not touched.

## 0. Shared

### 0.1 Code changes (all optional; with the new argument absent every function draws exactly what it draws today)

1. `scenes.js` `endingDetail(ctx, id, p, o)` (620): new optional `o`:
   - `o.part`: `'base'` draws the prop without its mover; `'mover'` draws only the mover; undefined draws both in today's order. The mover per id is listed in 0.3 (column "Mover lines"); for ids with no mover, `'mover'` draws nothing and `'base'` draws everything. In every id the mover's lines either come after the base lines they overlap or do not overlap them (checked per id in 0.3), so base-then-mover gives today's pixels.
   - `o.n` (integer, default "all"): how many of the mover's repeated items are drawn (per id in 0.3).
   - `o.dx`, `o.dy` (integer art units, default 0): an offset added to the mover (master `dx`; acquirer and ward `dy`).
   - `p` keeps today's meaning (wiped, perp).
2. `scenes.js` new `endingGeom(id)`, exported on `SH`, returning the static rects (art units, before the 8-unit drop) that `endingDetail` draws and the layer builders cover or reveal; `endingDetail` is refactored to draw those rects from it (same arithmetic, same order):
   - `soft`: `wins[k]` (k = 4 i + 2 r + w for building `i` 0-6, window column `w`, row `r`) = `{ x: 66 + 28 i + 4 + 9 w, y: 74 - h_i + 6 + 12 r, w: 6, h: 6 }`, `h_i = 34 + (i % 2) * 9` (658).
   - `quiet`: `cells` = the 34 dark windows `{ x: 116 + 13 x, y: 20 + 11 y, w: 7, h: 6 }` except (4, 2) (663).
   - `fired`: `label` = `{ x: 137, y: 51, w: 47, h: 7 }` ('PERSONAL', centred on 160, 632).
   - `nobody`: `screens[i]` = `{ x: 93 + 28 i, y: 25, w: 18, h: 30 }` (671).
   - `grind`: `screen` = `{ x: 145, y: 27, w: 30, h: 16 }` (713).
   - `replaced`: `strips[i]` = five rects `{ x: 102 + 34 i, y: 26 + 9 r, w: 20, h: 5 }` (665).
   - `whistle`: `stamp` = `{ x: 126, y: 50, w: 44, h: 11 }` (646). `fall-guy`: `stamp` = `{ x: 137, y: 50, w: 47, h: 7 }` ('NOT MINE', 676).
   - `exit`: `door` = `{ x: 142, y: 22, w: 36, h: 56 }` (667).
   - `revolving`: `glass` = `{ x: 145, y: 44, w: 28, h: 26 }`, `bar` = `{ x: 159, w: 2 }`, `rail` = `{ y: 56 }` (651).
3. `storyboard.js` new `endingSpace(c, fn)`: `at2x(c, (cc) => { cc.save(); cc.translate(0, 8); fn(cc); cc.restore(); }, 60)` (the transform of line 1772). `endingWorld` uses it.
4. `storyboard.js` `endingWorld(ctx, o, p, card, lo)` (1768): new optional `lo.part = 'base'`: as today but `endingDetail(c, id, p, { part: 'base' })`. Undefined: today.
5. `rhythm.js` `skyline(ctx, act, seed, y, day, noSpeckle, o)` (75): new optional `o.noWindows` skips the lit windows of line 85. New exported `R.skylineWindows(act, seed, y)`: the lit window rects `{ x: x + xx, y: y - h + yy, w: 2, h: 2 }` of lines 80-86 (same loop and test), which `skyline` draws from. `lastLight` (1803) gains an optional second argument object `lo` with `lo.part = 'city'`: `R.skyline(ctx, 1, 61, 270, 60, true, { noWindows: true })` in place of line 1806; undefined: today.
6. `decisions.js` `LAYER.racks` (527): the branch of batch 8 (0.1 item 8) also takes `e.phase === 'after'` (2.5 below). `PHASE_DUR.after = 2.2` (batch 8).

### 0.2 Beats and ids

| Beat id | Dur | Caption | Transition | Own sfx |
| --- | --- | --- | --- | --- |
| `ending:<id>:world` | 1.8 | none | fade 0.28 | `apartment` |
| `ending:<id>:card` | 2.6 | the deck, types 0.22-1.37 | cross 0.3 | none |
| `ending:<id>:after:` / `ending:<id>:after:p` | 2.2 | `FIRST LIGHT. THE CITY IS STILL THERE.` / `THE RACKS STAY DARK. FOR NOW.`, types 0.22-1.37 | cross 0.3 | `room` |

`<id>` is one of the 22. `o.dark` (from `screens.js` 366: wiped, fired, perp, depression, replaced, and the six flagged in `endings.js` 275-278: nobody, fall-guy, ward, clawback, lost-decade, cassandra) changes only `endingShot`'s sky and street (static) and the title colour; every recipe below works the same on both. Coordinates: art units (320x180), inside `endingSpace` for the prop (screen `sx = 2 ax`, `sy = 2 (ay + 8)`), inside plain `at2x` for the card (`sy = 2 ay`).

### 0.3 The 22 endings: what moves (world beat)

Ten recipes. "Time" is when the key starts and ends; every key starts at 0.40 or later (after the fade) and ends by 1.40.

| Id | Recipe | What moves | Mover lines (part 'mover') | Screen box of the key | Time |
| --- | --- | --- | --- | --- | --- |
| wiped | A, p by time | The six chart sheets slide off the desk, the lowest 20 px | 623-627 (all) | x 224-364, y 56-198 | 0.40-1.30 |
| perp | A, p by time | Press flashes: the two flash stars pop, then the white burst fires three times | 637-638 | x 140-500, y 36-168 | 0.50-1.30 |
| cassandra | B, count | The six unread warnings pile up one by one; UNREAD lands with the last | 680-681 (`n` pages 0-6; bar and text when `n = 6`) | x 188-342, y 44-164 | 0.40-1.00 |
| lost-decade | B, count | Ten calendars hung on the line, one a year | 709 (`n` 0-10) | x 168-494, y 56-100 | 0.40-1.21 |
| depression | B, count | The queue grows, left to right | 655 (`n` 0-9) | x 156-468, y 148-164 | 0.40-1.20 |
| right-early | B, count | The candles draw on left to right; the late up-moves land last | 701 (`n` 0-13) | x 188-448, y 64-150 | 0.40-1.24 |
| everything-rally | B, count | The seven jade bars rise one after another | 704 (`n` 0-7) | x 180-406, y 72-180 | 0.40-1.12 |
| fund | B, count | The jade chart climbs to the corner square | 698 (`n` 0-10: rects `i < min(n, 9)`, the square when `n = 10`) | x 392-512, y 68-162 | 0.40-1.12 |
| clawback | B, count | Six stacks lose their top three coins and are struck through, left to right | 694, split: base draws the stacks as today without the strike bars; mover (`n` 0-6) draws, for `i = 4..9`, the strike bar if `i - 4 < n`, else coins `k = 3..5` | x 196-320, y 112-136 | 0.50-1.25 |
| master | C, slide | The yacht sails in from the left, 48 px | 640-642 (`dx`) | x 124-472, y 48-156 | 0.40-1.40 |
| acquirer | C, hoist | The HLST sign is hoisted 24 px into place on its cable | 687 cable `R(170, 8, 1, 14 + dy)` and 688 sign and text (`dy`) | x 280-400, y 60-140 | 0.40-1.40 |
| ward | C, hoist | The flag is run up the pole 20 px | 692 flag cel and band (`dy`; the pole stays in base) | x 320-368, y 32-76 | 0.40-1.40 |
| soft | D, cover lifts | The street's 28 windows come back on, building by building | none (cover) | x 140-524, y 60-136 | 0.40-1.24 |
| fired | D, cover lifts | PERSONAL is written on the box, letter by letter | none (cover) | x 274-368, y 118-132 | 0.50-1.13 |
| quiet | E, lights out | Every other window on the tower goes dark; yours stays | none (drawn until switch) | x 232-412, y 56-176 | 0.40-1.40 |
| grind | F, screen on | The monitor switches on | none (crt) | x 290-350, y 70-102 | 0.60-0.70 |
| nobody | F, screens on | The five screens switch on one by one, all saying SELL | none (crt) | x 186-420, y 66-126 | 0.45-1.15 |
| replaced | G, pulse | A pulse runs along the four racks' screen strips | none (overlay) | x 204-480, y 68-156 | 0.45-1.11 |
| whistle | H, stamp | LEAKED is stamped on the file | none (cover + stamp) | x 220-372, y 108-152 (largest frame) | 0.70-0.78 |
| fall-guy | H, stamp | NOT MINE is stamped on the signature page | none (cover + stamp) | x 252-380, y 108-142 | 0.70-0.78 |
| exit | I, light swells | The light in the open doorway brightens in three hard steps | none (overlay) | x 284-356, y 60-172 | 0.40-0.90 |
| revolving | J, door turns | The revolving door's wing turns once round and stops | none (cover on the glass) | x 290-348, y 104-156 | 0.40-1.40 |

All boxes lie between screen y 36 and 198: no caption is up on the world beat, and all are clear of the card box (y 192-260) and caption (280-344) anyway. Recipe count: **10** (A p-by-time, B count, C slide or hoist, D cover lifts, E lights out, F screen on, G pulse, H stamp, I light swells, J door turns).

---

## 1. World (`ending:<id>:world`)

### 1.1 Intent
The city on the morning of the ending, and the ending's prop doing the one thing it is about: sheets falling, a sign going up, a queue growing, a window staying lit. One movement, unhurried, then stillness.

### 1.2 Duration
1.8 s, unchanged. The longest movement (0.40-1.40) leaves 0.4 s of still picture.

### 1.3 Layers
| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `world` | `endingWorld(c, o, 1, false, { part: 'base' })` (storyboard 1768-1800: ink, `endingShot` 574-609, the prop without its mover, the native street signature 1785-1799); animate: the recipe, inside `endingSpace` | 1 | 640x360 |

One layer: the sky is a 2x dither gradient, and a parallax sky layer (bible: depth 0.5) would move it by odd pixels and flip its dither phase every step (the tableau strips of batch 6 show exactly this). The world is therefore a tier 2 living still with a tilt; the bible's tier 1 is withdrawn for this shot.

### 1.4 Camera
`{ from: { x: 0, y: -8, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: (p) => Math.round(M.ease.inOut(p) * 4) / 4 }`: the bible's −8 → 0 settle, quantised to 2 px (one art unit) so the 2x dither never changes phase. 8 rows at the top uncovered at the start, under the 12 px letterbox. Runs under the fade (camera only).

### 1.5 Animated elements (per recipe; art units, in `endingSpace` unless stated)

Let `E = SH.endingGeom(id)`, `D = (q, extra) => SH.endingDetail(g, id, q, Object.assign({ part: 'mover' }, extra))`, `n(a, step, N) = Math.max(0, Math.min(N, Math.floor((t - a) / step + 1e-9) + 1))` (the count is 0 before `a`, then steps up).

| Recipe | Ids | Animate | Colours | Kit | Worst rects |
| --- | --- | --- | --- | --- | --- |
| A | wiped | `D(M.ease.in(K.span(t, 0.40, 1.30)))`: the art's `drop = round(p * i * 2)`, sheet `i` falls `2 i` units (gravity easing); 1 unit = 2 px steps. Ends at `p = 1`. | the art's | (p) | 72 |
| A | perp | `D(t < 0.50 ? 0 : (t >= 1.30 \|\| (t >= 0.60 && t < 0.68) \|\| (t >= 0.95 && t < 1.03)) ? 1 : 0.45)`: the flash stars at 0.50 (`p > 0.3`), the white 0.25 burst (`p > 0.6`, 360x132 px) at 0.60 and 0.95 for 0.08 s, and from 1.30 on (today's card). The one full-screen-ish alpha rect is the art's own. | the art's | (p) | 35 |
| B | cassandra, lost-decade, depression, right-early, everything-rally, fund | `D(1, { n: n(0.40, step, N) })`; `step` / `N`: cassandra 0.12 / 6, lost-decade 0.09 / 10, depression 0.10 / 9, right-early 0.07 / 13, everything-rally 0.12 / 7, fund 0.08 / 10. Each item appears whole in one frame. | the art's | (count) | depression 234, cassandra 140 |
| B | clawback | `D(1, { n: n(0.50, 0.15, 6) })`: stack `4 + k` loses its top three coins and gains its strike at `0.50 + 0.15 k`. | the art's | (count) | 384 at `t < 0.50` |
| C | master | `D(1, { dx: -24 + Math.round(24 * M.ease.out(K.span(t, 0.40, 1.40))) })`: fastest step 1.6 units (3.2 px) a frame at 30 fps; the yacht crosses only the sky gradient (no repeating pattern). | the art's | (slide) | 22 |
| C | acquirer | `D(1, { dy: Math.round(12 * (1 - M.ease.out(K.span(t, 0.40, 1.40)))) })`: sign and cable rise 12 units. | the art's | (hoist) | 71 |
| C | ward | `D(1, { dy: Math.round(10 * (1 - M.ease.out(K.span(t, 0.40, 1.40)))) })`. | the art's | (hoist) | 7 |
| D | soft | Cover form: each window `k` draws `X.rect(g, w.x, w.y, 6, 6, P.slate)` while `t < 0.40 + 0.03 k` (building interiors are flat `slate`). Ends drawing nothing. | `slate` cover | lamps (cover) | 28 |
| D | fired | Letter `k` (0-7) of the label `E.label` covered by `X.rect(g, 137 + 6 k, 51, 5, 7, P.bone)` while `t < 0.50 + 0.09 k`; for `k = 0` the cover's first column is `P.white` (the label's highlight column x 137). Label interior is flat bone. | `bone` cover | lamps (cover) | 8 |
| E | quiet | Each cell `k` of `E.cells` draws `X.rect(g, c.x, c.y, 7, 6, P.amberD)` while `t < a_k`, `a_k = 0.40 + 1.00 * rank_k / 33`, `rank` from `B.hashSeed('ending:quiet:' + k)` order (seeded, as `lamps` order `'seed'`): the tower starts lit in dim amber and empties until only your window (bright amber, cached with its glow) is left. Ends drawing nothing. | `amberD` | lamps (seed order, lights out) | 34 |
| F | grind | `K.crt(g, 145, 27, 30, 16, t, { mode: 'on', at: 0.60, bg: P.screenD })`. | crt | crt (on) | 4 |
| F | nobody | screen `i`: `K.crt(g, s.x, s.y, 18, 30, t, { mode: 'on', at: 0.45 + 0.15 i, bg: P.screenD })` (the red arrow is inside the screen, so it appears with it). | crt | crt (on) | 20 |
| G | replaced | rack `i` (0-3) while `0.45 + 0.12 i <= t < 0.60 + 0.12 i`: its five strips at `P.phosphorD` alpha 0.45 (the batch 7 rack pulse). Overlay, never a cover. | `phosphorD` 0.45 | (overlay) | 5 |
| H | whistle, fall-guy | `const ph = K.stamp(g, s.x - 2, s.y - 2, s.w + 4, s.h + 4, t, { at: 0.70, col: P.crimson, frame: 0.04, grow: [16, 6], style: 'none' }); if (ph < 3) X.rect(g, s.x, s.y, s.w, s.h, P.bone)`, `s = E.stamp`: a blank page, the stamp's two hard frames, then the cached mark. Both rects lie on flat bone (whistle: page 3's interior; fall-guy: the document's interior). | `crimson`, `bone` cover | stamp | 9 |
| I | exit | `X.rect` over `E.door` in `P.ink` at alpha 0.60 while `t < 0.50`, 0.40 while `t < 0.70`, 0.20 while `t < 0.90`, then nothing (the cached light). Overlay on the dither, hard steps. | `ink` | (overlay) | 1 |
| J | revolving | For `0.40 <= t < 1.40`: wing `x_b = [163, 167, 151, 155, 159, 163, 167, 151, 155, 159][Math.floor((t - 0.40) / 0.10)]`; draw `X.rect(g, 159, 44, 2, 26, P.sky)` (cover the art's wing on the flat glass), `X.rect(g, 159, 56, 2, 1, P.slate2)` (restore the rail), then the wing `X.rect(g, x_b, 44, 2, 26, P.slate2)`. From 1.40 nothing (art wing at 159). | `sky` cover, `slate2` | (cover) | 3 |

### 1.6 Timeline
0-0.28 fade up, camera settling in 2 px steps to 1.8. 0.40 (0.45-0.70 for some) the prop's movement begins; by 1.40 it is done; still to 1.8. Cross into the card.

### 1.7 Final frame
Today's world still for 20 ids. **Changes** for wiped (sheets at `p = 1`, fallen, as the card shows) and perp (flash stars and the white burst, as the card shows), because the beat now arrives at the card's state instead of today's 0.3. The world beat is not counted by any test.

### 1.8 Variants
Dark and light: `endingShot`'s sky, rain streaks, wet reflections and sun rings are cached and static; every recipe draws the same. The bible's moving rain on dark endings is **not** adopted (see 4, ruling 1): the static streaks stay, so there are no particles over them and the prop is the only thing that moves.

### 1.9 Sound cues
None. The own `apartment` stays.

### 1.10 Risks and fallbacks
- clawback is the budget ceiling (384). Fallback: draw only the strike bars (mover = the bars, coins all cached at today's heights): 6 rects, weaker read.
- revolving's wing is 4 px wide; if it reads as a flicker rather than a turn, widen the wing to 4 units (`X.rect(g, x_b - 1, 44, 4, 26, ...)` and cover `158, 44, 4, 26` with sky plus the rail).
- Every id must be checked at `t = 0.1` and `t = 1.8` (bible risk): at 0.1 the B items are absent, soft is dark, fired is blank, quiet is lit, grind and nobody are dark, whistle and fall-guy are blank, and the 2.2 still equals `draw(p = 1)`.

---

## 2. Card (`ending:<id>:card`)

### 2.1 Intent
The verdict. The title box is there from the first frame, legible and still; when the deck has finished typing, the box is stamped and ENDING REACHED appears under the title.

### 2.2 Duration
2.6 s.

### 2.3 Layers
| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `card` | `endingWorld(c, o, 1, true)` (today's card picture, whole); animate in plain `at2x(c, fn, 60)` | 1 | 640x360 |

### 2.4 Camera
`camera: null`. The box never moves.

### 2.5 Animated elements (art units, `at2x` without the drop)
| What | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Line hidden | 0 to phase 3 | `X.rect(g, 119, 117, 83, 6, P.ink)` and `X.rect(g, 119, 123, 83, 1, P.ink2)`: ENDING REACHED (14 glyphs, x 119-201) hidden on the box's flat ink interior and its ink2 bottom line. The title (y 106-113) is never covered. | `ink`, `ink2` | cover |
| Stamp | 1.30-1.38 | `K.stamp(g, 40, 100, 240, 26, t, { at: 1.30, col: o.dark ? P.crimson : P.amber, frame: 0.04, grow: [16, 6], style: 'none' })`: a 256x34-unit outline (screen x 64-576, y 192-260), then 246x29, then nothing; the cover lifts at phase 3 (1.38, within 0.1 s of the caption's end at 1.37). Outlines only; the box itself is untouched. | title colour | stamp |

Worst case 6 rects.

### 2.6 Timeline
Cross in (0-0.30) on the still prop and the box with its title. 0.22-1.37 the deck types in the caption. 1.30 the stamp lands round the box; 1.38 ENDING REACHED is there. Still to 2.6.

### 2.7 Final frame
**Today's card exactly** for all 22 (cover gone, stamp style `'none'`): `endingUnique` stays 22 and no two endings become alike.

### 2.8 Variants
Dark endings stamp in crimson, light in amber (the title's own colour). Long titles (36 characters max) do not affect the line or the box.

### 2.9 Sound cues
`{ at: 1.30, sfx: 'click' }`: a dry click as the stamp lands, ahead of the ending screen's own music and sound (which start only when the chain ends, after the after beat). No other cue.

### 2.10 Risks and fallbacks
- If the coordinator reads the stamp frames as the box moving (ruling 2): drop the stamp, keep the cover and lift it at 1.37 with `K.ping(g, t, { at: 1.37, flare: { x: 119, y: 117, w: 83, h: 7, col: P.bone, a: 0.15, dur: 0.08 } })`.

---

## 3. After (`ending:<id>:after:` and `:after:p`)

### 3.1 Intent
- **Not pulled**: first light. **The city's lit windows go out across the skyline from right to left**, as the day reaches them. The city is still there; nobody needs the lights.
- **Pulled**: the rack room, dark. **One amber standby light comes on, goes off and comes back**: the racks stay dark, for now.

### 3.2 Duration
2.2 s.

### 3.3 Layers
Not pulled:

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `city` | `lastLight(c, false, { part: 'city' })`: ink, `R.skyline(c, 1, 61, 270, 60, true, { noWindows: true })`, the dawn dither (1807), the ink ground (1808); animate the windows | 1 | 640x360 |

Pulled: `DecisionArt.roomLayers('c10', 60, true, { f: { pulledPlug: true } }, 'after')`: `room` (`room(c, 'c10', 60, true, S, { noGrain: true })`) and `grain`, as batch 7.

### 3.4 Camera
`camera: null` for both.

### 3.5 Animated elements
Not pulled (native 640 coordinates; `Wn = R.skylineWindows(1, 61, 270)`, 117 windows of 2x2):

| What | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Lights out | 0.40-1.40 | Window `w` drawn `X.rect(c, w.x, w.y, 2, 2, P.amber)` while `t < 0.40 + 1.00 * (1 - (w.x + 1) / 640)`: a front of darkness sweeps right to left across 640 px in 1.0 s (about 21 px a frame at 30 fps; the windows are not a regular pattern along the sweep). Lit windows are drawn in `amber`, brighter than the art's `amberD`, so the field of lights reads before it goes. All above y 270 (towers end at 270). Ends drawing nothing, on time with the caption's end (1.37). | `amber` | lamps (drawn until switch) |

Worst case 117 rects.

Pulled (`LAYER.racks`, `e.phase === 'after'`; native):

| What | Times (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Standby | 0.40-2.20 | For `t >= 0.40`, when `K.blink`'s standby phase is on (`period 1.0, duty 0.5, end: 2.2`: on 0.70-1.20 and 1.70-2.20): `glow(g, 186, 42, [21, 12], P.amber, 0.12)` and `X.rect(g, 183, 39, 6, 6, P.amber)` on the top panel of the first front rack. The halo is about 54x42 px (screen x 159-213, y 21-63) in a dark room. On at the end. | `amber` | blink (standby) |

Worst case 30 rects.

### 3.6 Timeline
Not pulled: cross in on the lit city; 0.22-1.37 caption; 0.40-1.40 the lights go out from the right; 1.40-2.2 the dark towers at dawn. Pulled: cross in on the dark room; 0.70 the standby light, off at 1.20, back at 1.70; still.

### 3.7 Final frame
**Changes** in both: not pulled, the towers have no lit windows and no still snow speckle (only the snow caps on the roofs say winter); pulled, the room gains the amber standby light and its halo. The after beat is not counted by any test, and it is the same picture for every ending id (as today).

### 3.8 Variants
Not pulled / pulled only (`o.pulled`, `screens.js` 376). The not-pulled skyline uses act 1 and seed 61 for every ending (as today).

### 3.9 Sound cues
None beyond the own `room`: the ending screen's music starts as this beat ends.

### 3.10 Risks and fallbacks
- Dense static snow (bible risk): removed with the existing `noSpeckle` flag, so the dots going out are the only dots. If the coordinator wants snow kept, thin it instead with a new optional density factor on `R.weather` (not specified here).
- 2x2 windows are small one by one; the sweep is the read. Fallback: draw the lit windows 2x4 (the art's window plus the row below, inside the tower) while lit.
- Pulled: if ruling 3 is no, use the bible's version: the same LED and halo drawn from 0.40 and gone from 1.30 (`t < 1.30`), final frame today's.

---

## 4. Rulings needed

1. Moving rain on dark endings (bible): **recommend no**; it would be the busiest thing in the frame and compete with the single prop movement.
2. The card's stamp frames around a still box: **recommend yes** (the box does not move; fallback in 2.10).
3. Pulled `after`: a standby light that ends on ("for now") instead of the bible's last LED dying: **recommend yes**; the racks have already died on screen at 3:17 (batch 8) and on day 45.
