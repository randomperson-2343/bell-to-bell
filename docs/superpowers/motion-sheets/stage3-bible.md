# Stage 3 motion bible

Date: 2026-11-14. Covers every shot left after the pilot (batches 2 to 9 of `docs/superpowers/plans/2026-11-14-motion-stage3.md`). Batch sheets: `stage3-batch-2-morning.md`, `stage3-batch-3-close.md`; batches 4 to 9 follow after the engineer has built these.

Binding on every shot: the pilot plan's Global Constraints, the stage 3 plan's "Additional constraints learned in the pilot", and section C below.

## A. The kit: `B.MotionKit` (`js/art/motion-kit.js`)

Fourteen pure drawing elements. File style as `motion.js`: an IIFE on `window.BTB`, loaded after `motion.js` and `rhythm.js` (it calls `B.Rhythm.text` and `B.Rhythm.person` lazily, at draw time, never at load). No DOM, no settings, no `Math.random`, no clock.

**Conventions for every element**

- The signature is `K.name(ctx, ...geometry, t, o)`. `t` is seconds into the beat. Every element reads `T = t + (o.t0 || 0)`, so a shot can run an element on chain time across several beats (weather, a ticking chart).
- Geometry is in the coordinates of the layer the element is drawn in (the `animate` coordinates). Every computed position and size goes through `Math.round` before `B.Pixel.rect`. Nothing is drawn at a fraction of a pixel, except when the caller has deliberately wrapped it in a fixed art transform (`at2x`, a framed zoom); then the element obeys the same grid as the art under it.
- Colours are `B.Pal` values passed by the caller (`P.amber`). Elements never choose a colour by act; the shot passes it (section C3).
- Any alpha drawing is inside `ctx.save()` / `ctx.restore()`. Any clip is inside `save` / `restore`. Source-over only.
- Each element costs at most the rectangle count given. A beat's `animate` steps together stay under 400 rectangles a frame (C9).

**Two timing helpers and one camera recipe** (not drawing elements; same file):

- `K.span(T, a, b)` returns `clamp01((T - a) / (b - a))`.
- `K.camSpan(dur, a, b, ease)` returns `(p) => ease((p * dur - a) / (b - a))`: an easing for a beat `camera` that moves only between seconds `a` and `b` of a beat of length `dur`. (`B.Motion.ease` functions already clamp.)
- `K.rise(dy, dur, a, b)` returns `{ from: { x: 0, y: -dy, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: K.camSpan(dur, a, b, B.Motion.ease.out) }`. With a depth-1 layer this lifts that layer `dy` px into place between `a` and `b` seconds and leaves depth-0 layers still. It is the one way a hand-held device enters the frame (C4).

| # | Element and signature | What it draws and how it moves | Cost / frame |
| --- | --- | --- | --- |
| 1 | `blink(ctx, x, y, w, h, t, o)` | One rect, on or off. `o = { on, off = null, period = 1.0, duty = 0.5, end = null, phase = 0 }`. On when `((T + phase) mod period) < duty * period`. If `end` is given (pass the beat's `dur`) the phase is taken from the end: on when `(((end - T) mod period) + period) mod period < duty * period`, so the light is on at `T = end` and the final frame equals the art. Off draws `off` (a flat cover colour) or nothing. Three rates only (C5): standby 1.0 s / 0.5, badge 0.5 s / 0.6, cursor 0.5 s / 0.5. | 1 rect |
| 2 | `crt(ctx, x, y, w, h, t, o)` | Screen events, `o.mode`: **`'roll'`** a refresh band travels top to bottom once: `o.at`, `o.dur = 0.36`, `o.band = 6`. `q = (T - at) / dur`; nothing outside `0 <= q < 1`. Band top `y - band + Math.floor(q * (h + band))`, clipped to `[y, y + h)`. Band: `P.phosphorD` at alpha 0.22; its bottom row: `P.phosphor` at alpha 0.4. **`'off'`** a CRT switching off at `o.at`: `[at, at + 0.05)` fill `o.bg = P.screenD`, a 2 px line `(x, y + floor(h/2) - 1, w, 2)` in `P.phosphor`, a 4x2 dot at the centre in `P.white`; `[at + 0.05, at + 0.10)` fill and dot; from `at + 0.10` fill only. With `o.dim = a`, an `P.ink` rect at alpha `a` over `(x, y, w, h)` follows every off frame (for screens inside a darkened layer). **`'on'`** the reverse: before `at` fill `o.bg` (covers the lit cached screen); `[at, at + 0.05)` fill and the 2 px phosphor line; `[at + 0.05, at + 0.10)` nothing but a `P.bone` alpha 0.12 flare over the screen; then nothing. | 2 to 4 rects |
| 3 | `flicker(ctx, x, y, w, h, seed, t, o)` | A practical light stuttering dark: an overlay rect `o.col = P.ink` at `o.a = 0.3` while dark. Dark when `T` is inside any `o.spans` (`[[a, b], ...]`, hard steps), or, with no spans, when `o.from <= T < o.to` and `B.Motion.flicker(seed, T, o.rate = 12) < o.chance = 0.07`. Hard steps only, never a fade. | 1 rect |
| 4 | `trace(ctx, ys, t, o)` | A plotted series. `ys` is an array of y values (unrounded, as the art computes them). Draws `ys[from + k]` at `(o.x0 + k * o.step, ys[...])`, size `o.w x o.h` (default 3x2), colour `o.col`, for `k < o.n`. `o.from` and `o.n` are integers the shot derives from time (draw-on: `from = 0`, `n` grows; ticking: `from` grows, `n` fixed). `o.head`, when set, colours the point `k = n - 1`. The line moves only by whole steps of `o.step` px. | n rects |
| 5 | `tally(ctx, x, y, t, o)` | A number counting to its true value. `o = { from, to, at, dur, ease = linear, fps = 15, fmt, col, shadow = P.ink, align = 'left', scale = 1, before = 'none' }`. `Ts = floor(T * fps) / fps`, `q = span(Ts, at, at + dur)`, value `q >= 1 ? to : Math.round(from + (to - from) * ease(q))` (the end value is `to` itself, unrounded, so `fmt(to)` equals the art). Before `at` draws nothing, or `fmt(from)` when `before === 'from'`. Text drawn as `B.Pixel.textShadow`, scaled by `scale` inside save/restore. Never covers anything: the shot leaves the number out of the cached layer, on a flat fill. Returns the value. | about 28 rects a glyph |
| 6 | `typeOn(ctx, str, x, y, t, o)` | In-picture text typing. `o = { at, cps = 16, col, shadow = P.ink, scale = 1, align = 'left', cursor = null }`. Shows the first `clamp(floor((T - at) * cps), 0, len)` characters. Alignment is computed from the full string's width, so letters never slide as the string grows. `o.cursor = { col }` draws a `5 x 7` (times `scale`) block after the last character while typing and blinks it (cursor rate) for 1.0 s after the last letter, then it is gone. | about 28 rects a glyph shown |
| 7 | `stamp(ctx, x, y, w, h, t, o)` | A stamp landing in three hard frames on the final rect `(x, y, w, h)`. `o = { at, col, frame = 0.04, grow = [16, 6], style = 'double' }`. Phase 0 before `at`: nothing. Phase 1 `[at, at + frame)`: a 1 px outline of `(w + 16) x (h + 8)` on the same centre. Phase 2 `[at + frame, at + 2 frame)`: a 2 px outline of `(w + 6) x (h + 3)`. Phase 3: `'double'` draws a 1 px outline on the final rect and a second one inset 2 px; `'none'` draws nothing (the cached art already has the stamp, revealed by the shot when phase 3 starts). Returns the phase, so the shot can lift a cover at the right frame. | up to 8 rects |
| 8 | `marker(ctx, segs, t, o)` | A pen stroke drawing on. `segs` is the existing art's marker rects in pen order (`{ x, y, w, h, dir }`; `dir = -1` reveals right to left or bottom to top). `o = { at, dur, col = P.crimson, fps = 20 }`. Total length is the sum of each segment's long side; the drawn length is that times `span(floor(T * fps) / fps, at, at + dur)`; each segment fills along its long side in order. At the end it is exactly the art's rects. Also does a highlighter swipe (one wide segment). | segs.length rects |
| 9 | `lamps(ctx, cells, t, o)` | Cells switching in sequence. `cells = [{ x, y, w, h }]`; `o = { at, step, order = 'index', seed, on, off = null, a = 1 }`. Cell `k` switches at `at + rank(k) * step`, rank from `order`: `'index'`, `'reverse'`, or `'seed'` (cells sorted by `B.hashSeed(seed + ':' + k)`). Before its time a cell draws `off` (or nothing); after, `on`. `on: null` with an `off` colour switches lights out; an `off` equal to a flat background is a cover-reveal. | cells.length rects |
| 10 | `weather(ctx, x, y, w, h, day, seed, t, o)` | The pilot window weather, generalised. Season `B.Rhythm.season(day)`. Clipped to the rect (save/clip/restore). `B.Motion.particles({ kind, seed, t: Tp, x, y, w, h, count })`. Autumn: `'paper'`, `clamp(round(w / 30), o.min, 14)`, 12 poses a second, 3x2 rects `i % 2 ? P.amber : P.crimsonD`. Grey: `'rain'`, `clamp(round(w * h / 1500), o.min, 40)`, full rate, `1 x o.rainLen` (default 6) in `P.grey2`. Winter: `'snow'`, `clamp(round(w * h / 1000 * (0.4 + 0.6 * snow)), o.min, 40)`, 12 a second, `P.white` 2x2 (3x3 when the particle's `s === 2`). `o.min` defaults to 3, `o.max` caps any count, and `o.count`, when given, replaces the formula (small windows). | up to 40 rects |
| 11 | `motes(ctx, x, y, w, h, seed, t, o)` | Dust in a light shaft or steam. `B.Motion.particles` kind `'dust'` (2 px/s fall, 3 px/s drift, 2 px sway), 12 poses a second, `o.count = 8`, 1x1 (2x2 when `s === 2`) in `o.col = P.bone` at alpha `o.a = 0.45`. `o.up = true` mirrors the fall (`y' = 2y + h - 1 - py`) for steam. | up to 12 rects |
| 12 | `figure(ctx, x, y, t, o)` | A person. `o.kind`: `'person'` (the commuter sprite of `B.Rhythm.person`, needs a `pose` argument added there: pose 1 swaps the two leg columns of the last five body rows) or `'walker'` (the `WALKER` / `WALKER_B` sprites in `scenes.js`). `o.mode`: `'cross'` moves from `x` to `o.x1` between `o.at` and `o.at + o.dur`, quantised to whole steps of `o.step` (2 px for 2x art) at 12 poses a second, legs alternating each step; `'idle'` drops the whole sprite by `o.dy = 2` px during `[o.at, o.at + 0.8)` of every `o.period = 2.4` s (a breath or a shift of weight). | person about 330, walker about 30 |
| 13 | `passing(ctx, x, y, w, h, seed, t, o)` | Lights crossing a band, clipped to it. `o.kind = 'car'`: each car is a headlight pair (two 4x2 `P.bone` rects 6 px apart) and, 40 px behind, a 2x2 `P.crimson` tail; cars launch at `o.at + i * o.every + 0.3 * r_i` (`r_i` from `B.RNG(B.hashSeed(seed + i))`), travel at `o.speed = 220` px/s in direction `o.dir = 1`. `o.kind = 'train'`: one train of 14 windows, each 10x6 `P.bone` at alpha 0.55, 18 px apart, entering at `o.at`, at `o.speed = 360` px/s. Whole-pixel x. | up to 40 rects |
| 14 | `ping(ctx, t, o)` | A screen or notification lighting up (the pilot's Saturday phone, generalised). `o = { at, off: [r], on: [r], flare: { x, y, w, h, col = P.bone, a = 0.15, dur = 0.08 }, gaps: [[a, b]] }`, each `r = { x, y, w, h, col, a }`. Before `at` draws `off` (covers); from `at`, outside any gap, draws `on`; during `[at, at + flare.dur)` draws the flare. Hard steps. | rects given |

Unit tests for the kit (batch 1): every element is deterministic for a given `t`, draws nothing outside its rect (weather, passing, crt), ends on its documented final state at `T = end`, and runs in Node against a recording fake context.

## B. Assignment table

Seen = how often a player sees the shot in one 46-session story run. Tier 1 = full layers (art split into depth layers, parallax, moving elements). Tier 2 = living still (the existing picture as one cached layer, split at most once around an animate-only layer when something must pass under text, moving elements on top, at most a whole-pixel vertical tilt). Δ = change to the beat's length.

### Batch 2, morning (sheet: `stage3-batch-2-morning.md`)

| Shot (function · beat id) | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `phoneFrame` · `phone:<d>:handoff` | 46 | 1 | Phone rises 56 px into frame, asleep, then wakes with all its rows at 0.80 s | ping | `rise(56)` on the device only | 0 | Reads as a camera move if the room drifts: room stays depth 0 |
| `phoneFrame` · `phone:<d>:read` | 46 | 1 | The lead headline slides in on top and pushes the list down one row (44 px), days 2 to 42 | tally, ping | rows layer only, y 44 → 0 between 0.70 and 1.00 s | 0 | Needs a masking `glass` layer; final still gains a fifth row |
| `officeFrame` · `office:<d>:wide` | 46 | 1 | A refresh band sweeps each live monitor in turn, left to right; dead monitors stay black | crt roll, weather | tilt y −8 → 0 | 0 | Tilt on the wall dither (4 one-pixel steps) |
| `officeFrame` · `office:<d>:desk:<k>` | 46 | 1 | Your desk chart ticks forward one point every 0.25 s; the CASCADE stack slips into place when stability is down | trace, weather | none | 0 | Chart dots are small (74x22 area); fallback in the sheet |
| `officeFrame` · `office:<d>:hold:<k>` | 46 | 2 | Chart keeps ticking, weather keeps falling across the cut | trace, weather | none | 0 | Continuity relies on chain time `t0` |

### Batch 3, close (sheet: `stage3-batch-3-close.md`)

| Shot | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `closeFrame` · `close:<tag>:report` | 46 | 1 | The verdict stamp lands round QUOTA MET or MISSED as the caption finishes; the P&L counts up first | stamp, tally, lamps | tilt y −6 → 0, ease out | 0 | Final still gains the stamp outline |
| `closeFrame` · `close:<tag>:hold` | 46 | 2 | The floor's live screens switch off one by one, right to left | crt off | none | 0 | Most monitors sit behind the card; two and the desk chart carry it |
| `sqwakFrame` · `close:<d>:sqwak` | 8 | 1 | Phone and hand rise 40 px over the skyline | blink | `rise(40)`; city depth 0.25 | 0 | Rise partly inside the 0.3 s dissolve |
| `sqwakFrame` · `close:<d>:sqwak-read` | 8 | 1 | The same phone keeps rising 26 px to reading height; engagement counts climb | tally, blink | `rise(26)`; city depth 0 | 0 | Continuity with the insert depends on the depths in the sheet |

### Batch 4, act cards and documents

| Shot | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `actCard` · `news:<d>:act` | 3 (d 8, 17, 32) | 2 | "ACT II" lands, then the act name types on in 4x letters with a bone cursor | typeOn, blink | none | 0 | Full-screen wash dither must stay cached |
| `DOC_DRAW.memo` · `news:<d>:detail`, S establish | 4 | 2 | Highlighter band (416x58, act wash) wipes left to right under the value | marker (swipe) | none | 0 | Band is under the text: paper / animate-only / text sandwich |
| `DOC_DRAW.footnote` | 3 | 2 | Red marker loop draws round the line, then runs out to the margin note | marker | none | 0 | 2 px pen: check it reads at 1440x900 |
| `DOC_DRAW.rating` | 2 | 2 | The rating stamp (340x110) lands in three frames | stamp (`'none'`), cover | none | 0 | Cover must be the flat bone of the paper only |
| `DOC_DRAW.post` | 3 | 2 | Phone rises 32 px over the skyline, as the Sqwak insert | rise, blink, lamps | `rise(32)` | 0 | Skyline speckle: no particles here |
| `DOC_DRAW.chart` | 3 | 2 | Red marker circle (60x96) draws round the move | marker | none | 0 | none |
| `DOC_DRAW.ticket` | 6 | 2 | The book drains: bid bars step out, ask bars step longer | lamps | none | 0 | Bars sit on a dithered CRT: sandwich, never a cover |
| `DOC_DRAW.vote` | 3 | 2 | The two lamp banks sweep on, row by row | lamps | none | 0 | 216 cells is the frame budget's ceiling |
| `DOC_DRAW.voicemail` | 1 | 2 | Playback lights the waveform bar by bar | lamps, blink | none | 0 | none |
| `deskWithDoc` · memo and footnote establish and hold, `desk` place | 6 | 2 | The day's paper slides 40 px onto the desk | blink (LED) | none | 0 | Drawn inside a 2.3x to 3x transform; positions in art units |
| `establishDoc` voicemail (`apartment(0.15)`) | 1 | 2 | Phone on the couch arm lights | ping | tilt y −6 → 0 | 0 | none |

The other `establishDoc` cases reuse a row: rating → apartment and TV (batch 5), post → phone handoff (batch 2 recipe), vote → decision vote room (batch 7), ticket → trading floor lit (batch 5), chart → office wide (batch 2).

### Batch 5, places

| Shot | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `placeFrame` subway and platform | 4 | 2 | A lit train sweeps past behind the seven window cells | passing (train), figure (idle) | tilt y −6 → 0 | 0 | Train must stay inside the cells (clip each) |
| `placeFrame` street | 2 | 2 | Headlights pass along the kerb line | passing (car), weather | tilt | 0 | Winter speckle: thin it in that layer |
| `placeFrame` kitchen and breakroom | 3 | 2 | The wire monitor rolls and its signal band flashes an update | crt roll, ping | tilt | 0 | none |
| `placeFrame` other comps (lobby, desk, apartment, rideshare) in detail beats | 4 | 2 | Wire monitor rolls; the desk comp's chart ticks; rideshare streetlights pass | crt, trace, passing | tilt | 0 | Rideshare and breakroom are not in the default sheet |
| `SH.apartment` + `SH.tvSet` (tv, rating establish, apartment place) | 3 | 2 | The TV cuts to a graphic and back; the wall glow steps with it | ping, flicker | tilt | 0 | TV art is 2x: whole art pixels only |
| `SH.elevator` places, `news:0:detail`, `news:0:hold` | 5 | 2 | Doors slide to the day's opening (pilot door parts) | pilot parts, flicker | tilt | 0 | Reuse the pilot `part`s, never nest `at2x` |
| `SH.tradingFloor` lit (floor, ticket establish) | 5 | 2 | Refresh wave across the near-row screens | crt roll, figure (idle) | tilt | 0 | Near screens are dither at 2x; the band is an overlay |
| `SH.tradingFloor` dark (dark, detail, 3:17) | 3 | 2 | The last lit screens stutter; one goes out | flicker, crt off | none | 0 | none |
| `skylineShot` | 4 | 2 | False dawn: windows light one by one as LIGHTS ON counts up (go out after d 35) | lamps, tally, weather | none | 0 | Thin winter speckle |
| `racksShot` | 0 to 1 | 2 | LED rows go dark top to bottom | lamps | none | 0 | none |
| Any `news:<d>:hold` | 25 | 2 | None: the establish's layers at their final pose, background life continuing | as establish | none | 0 | Keep each hold's 0.18 dim in its own top layer |

### Batch 6, story tableaux (`briefingTableau` via `tableau()`)

All tier 2, seen once each, tilt y −6 → 0 on establish, no camera on the 1.3x detail, Δ 0. The tableau needs a `part` split so its mover is not cached.

| Tableau (session) | Key movement | Kit | Risk |
| --- | --- | --- | --- |
| 3 Kavro Strait (d 6) | Three ships sail 9 art px along the lane (the existing `p`) | (p) | Redraw ships only |
| 5 grid (d 9) | Load cells flash red in sequence | lamps | none |
| 8 model flow (d 17) | Flow arrows pulse rack to rack | lamps, blink | none |
| 9 bank queue (d 20) | The queue shuffles forward (existing `p`) | figure | none |
| 11 records (d 25) | HOLD stamps land carton by carton | stamp | none |
| 12 hearing (d 37) | LIVE badge blinks; the witness leans to the mic | blink, figure | none |
| 13 vote (d 40) | VOTE PENDING box blinks at badge rate | blink | none |
| 14 final day (d 45) | Network nodes go dark in sequence | lamps | Rain streaks static: do not add particles |

### Batch 7, decisions (`js/art/decisions.js`)

Rooms are tier 2, seen once or twice each, tilt y −6 → 0, Δ 0. Risk for all: `tests.js` 1363-1392 calls `DecisionArt.room` with a stub context lacking `drawImage`, `arc` and `getImageData`; the flat `room()` must stay drawable on it.

| Room (decisions) | Key movement | Kit |
| --- | --- | --- |
| office by day (c1, c6) | Kroll's desk screen rolls; weather behind the blinds | crt roll, weather |
| office at night (c7) | The desk lamp clicks on in two hard steps | ping |
| hearing (c3) | LIVE dot blinks; one senator leans to the mic | blink, figure |
| vote (c8, also the d 39 whip room) | The tally board fills line by line; YEAS counts to 214 | lamps (cover), tally |
| treasury (c5) | Window lights come on in sequence; the 2:14 colon blinks | lamps, blink |
| stairwell (c9) | The EXIT sign stutters | flicker |
| racks (c10) | LEDs chase across the racks | lamps |
| lobby (rentHike) | The management screen's smiley blinks | blink, crt roll |
| dinner (advance) | Candle and sconces flicker (risk: small; fallback sconces dim in sequence) | flicker |
| kitchen with a phone (dadBill, pension) | The phone rings: screen and glow flash at badge rate | ping, blink |
| kitchen with the postcard (vetCheck) | City windows go out one by one; steam off the mug | lamps, motes |
| voicemail (perry, dentist) | Playback lights the bars; play button blinks | lamps, blink |
| shelter (adopt) | Cat and dog breathe, the dog's tail wags (risk: under 20x20; fallback kennel light flicker) | figure-style breath |
| clinic (toothache, vetER) | The exam light switches on in two steps | ping, flicker |
| speaker close-up · `decision:<tag>:face` (every decision, about 16) | **Tier 1.** Room dimmed at depth 0.3, portrait at depth 1: the speaker rises 12 px into frame (no portrait: room only, no camera) | rise |

### Batch 8, weekend remainder

| Shot | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sundayShot` · `weekend:<key>:sun` | 9 | 1 | The phone's light on your face pulses as you scroll (figure), or the floor phone lights (no figure) | ping, blink (clock colon), weather | tilt y 6 → 0 | 0 | Saturday's parts inside the fixed 1.18 transform |
| weekend hold | 9 | 2 | None: Sunday's layers at rest, colon and weather continue | blink, weather | none | 0 | none |
| whip room (d 39) | 1 | 2 | As the decision vote room | lamps, tally | tilt | 0 | none |
| 3:17 floor (d 44) | 1 | 2 | Not pulled: rack LEDs keep chasing on the dark floor. Pulled: one standby LED blinks out | lamps, blink | none | 0 | none |

### Batch 9, endings

| Shot | Seen | Tier | Key movement | Kit | Camera | Δ | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `endingWorld` · `ending:<id>:world` | 1 | 1 | The ending's prop moves where its art takes `p` (wiped papers fall, perp flashes); otherwise the street lamps flicker on; dark endings get moving rain in place of the static streaks | lamps, flicker, weather | tilt y −8 → 0, sky depth 0.5 | 0 | 22 variants: every one checked at both ends |
| `endingWorld` card · `ending:<id>:card` | 1 | 2 | The title box lands; ENDING REACHED types on | stamp, typeOn | none | 0 | Box is 2x art: stamp in art units |
| `lastLight` · `ending:<id>:after:` | 1 | 2 | First light: the city's lit windows go out one by one (pulled: the last rack LED dies) | lamps | none | 0 | Dense static snow: thin it, no particles |

Tier count: 10 shots at tier 1 (phone handoff and read, office wide and desk, close report, Sqwak insert and read, speaker close-up, Sunday, ending world), 51 at tier 2.

Time added: morning chain 0 s (session 1 keeps the pilot's 0.7 s); close chain 0 s beyond the pilot bell's 0.57 s; every other beat 0 s.

## C. Cross-shot rules

**C1. One screen language.** Every CRT, monitor or phone in every shot uses `crt` and `ping` with the numbers above: refresh band 6 px, `phosphorD` 0.22 with a `phosphor` 0.4 edge, 0.36 s per screen; off and on in the same three 0.05 s frames. No screen gets more than one event per beat. A dead screen never comes back on in the same chain ("the dead stay dead"). Screens are hardware: their effects never take the act colour.

**C2. Captions and motion.** The caption types from 0.22 s and finishes at `0.22 + min(1.15, 0.55 * dur)`. A verdict (stamp, final count, arrival) lands within 0.1 s of that moment or before the caption starts, never in its middle. Nothing that matters moves below y 272 while a caption is up (the box covers 280 to 344). Key movements start at 0.25 s or later, outside the opening `fade` (0.28 s) or `cross` (0.3 s); only cameras and background life may run under a transition.

**C3. Act colour.** Kit elements never pick colours. Shots pass `B.Rhythm.colors(act).signal` for status marks (badges, labels, cursors on act cards) and `.wash` for highlighter bands. Market state (jade, crimson) comes from the data (P&L sign, `marketDown`), never from the act. Weather, screens and practical lights ignore the act.

**C4. Camera vocabulary.** Four moves, all vertical and whole-pixel, no zoom, no sideways move: (a) settle tilt y −8 → 0 (or −6) with `ease.inOut` or `ease.out` across the beat, for establishing places; (b) `rise(dy)` for a hand-held device entering, depth 1 for the device and 0 (or 0.25) for the world behind; (c) a list scroll by moving only a depth-1 rows layer between depth-0 layers (phone read only); (d) no camera on holds and on shots whose key is a stamp, count or draw-on. Every camera ends at 0, so the live last frame equals `draw(ctx, view, 1, opts)`. A layered beat that must not move passes `camera: null`. A framed zoom (`framed()`, `deskWithDoc`, `sundayShot`) is baked into each layer's `draw` and wraps each `animate` in the same transform; it never animates.

**C5. Rates.** Devices and cameras at full frame rate. Particles and figure poses at 12 poses a second. Counters at 15. Typing at 16 characters a second. Blinks only at the three rates of `blink`. Every light that blinks is on at the beat's end.

**C6. Continuity across a chain.** An element that spans beats (weather in a window, a ticking chart) uses one seed for the chain (`office:<day>:wx<i>`, not the beat id) and `o.t0` equal to the time already played in the chain, so a cut or dissolve never restarts it.

**C7. What never moves.** Letterbox, caption box, `finePass` corner brackets and in-world marks, the anomaly `tell`, portraits' faces (no mouths), information text except a counter landing on its true value, and the CASCADE label. Cameras never zoom.

**C8. Covering and sandwiches.** A cover (drawing a flat colour over cached art to hide or change it) is allowed only on a flat fill that the sheet names (phone screen `P.screen`, report box `P.ink`, rating paper `P.bone`). Never cover dither, gradient or speckle. To show something changing under text or on a dithered screen, split the picture: cached layer, an animate-only layer (`draw() {}`), cached layer above. Numbers that count are left out of the cache and drawn whole each frame.

**C9. Budget.** At most 6 layers per beat, at most 2 oversized. Per-frame `animate` work under 400 rectangles in total. No full-screen alpha rect in an `animate` except a single fade-style overlay the sheet names. No dither, gradient or speckle in an `animate`.

**C10. Quiet variation.** What varies from session to session comes from the game: feed content and length, P&L, quota, act (dead desks), season, stability, heat. The timing of each key movement is fixed per shot, so the rhythm stays reliable on the fortieth viewing. Idle life (blink phase, flicker moments) is seeded by day so no two mornings tick in step.

**C11. Static texture.** In any layer where particles fall, the static speckle of `weather()` or `windowWeather()` is not drawn (pass the sheet's flag). Flat callers of the same function are unchanged.

**C12. Sound.** At most one cue per beat. Only callable names on the game's `B.SFX` (`sound.js`): `news`, `click`, `elevator`, `office`, `room`, `apartment`, `broadcast`, `ring` and the others listed there. Never repeat a sound the game itself plays next to the chain: `marketClose` before the close chain, `phoneOpen` when the briefing opens, `quotaMissed`, `weekMade` and `strike` on the end-of-day screen.

**C13. Off means off.** With motion off the engine shows `draw(ctx, view, 1, opts)`; no shot adds anything that only exists in motion.
