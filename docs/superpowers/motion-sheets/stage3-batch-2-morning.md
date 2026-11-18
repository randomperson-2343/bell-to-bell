# Stage 3, batch 2: the morning (phone and office)

Seen every session, so every shot here must stay pleasant on the fortieth viewing: one fixed, short key movement, and variation that comes from the game (feed, act, season, market, stability). Binding: the bible (`stage3-bible.md`), sections A (kit) and C (rules). Kit calls are written `K.name` (`B.MotionKit`), `M` is `B.Motion`, `X` is `B.Pixel`, `P` is `B.Pal`, `R` is `B.Rhythm`. Line numbers are today's `js/art/rhythm.js` unless marked.

No durations change. The morning chain (news + phone + office) gains 0 s; session 1 keeps the pilot elevator's 0.7 s.

## 0. Code changes shared by this batch (all in `rhythm.js`)

Every new argument is optional; with it absent each function draws exactly what it draws today, so `closeFrame`, `establishDoc` and every other flat caller is unchanged.

1. `phone(ctx, x, y, w, h, feed, act, day, o)` (220-243) and `phoneFrame(ctx, sb, feed, close, o)` (245-261) take an options object `o`:
   - `o.rows`: the list of items to show (default `feed.slice(0, 4)`). The device size test `close || count > 2` and `compact` use `o.rows.length` capped at 4 for size, so a 5-item list is the big, non-compact phone.
   - `o.count`: the number printed in both counters (default `rows.length`).
   - `o.glow`: how many leading rows get `P.screenGlow` instead of `P.screenD` (default 1).
   - `o.part`: undefined (all), `'room'` (line 246, then 259-260), `'device'` (252-258, which calls `phone()` with its rows), `'back'` (everything except the row cards of lines 234-240), `'rows'` (only the row cards: the `rows.forEach` body of 234-240, with no clip).
   - `o.noDigits`: omit the status count (line 230) and the left label's leading digit. The left label is then drawn as `'NOTIFICATIONS'` (or `'NOTIFICATION'` when `o.count === 1`) at `labelX + 12`.
   - `o.labelX`: left label x. Default stays `close ? 92 : 88`; the layered handoff passes 92 when the big phone is drawn (see Risks).
   - `o.clipOut`: a rect; when given, everything this call draws is inside `ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 640, 360); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip('evenodd'); ... ctx.restore()`.
2. `chart(ctx, x, y, w, h, seed, down, part)` (144-151): `'screen'` draws only `X.crt` (145), `'line'` only the points (146-150).
3. `chartSeries(y, h, seed, down, n)`: new, exported on `B.Rhythm`. Returns `n` y values by the exact recurrence of lines 146-149 with `i = 0, 5, 10, ...` (start `y + h/2`, clamp to `[y + 10, y + h - 18]`), unrounded. For `n = 15` it equals today's line.
4. `weather(ctx, x, y0, w, h, day, noSpeckle)` (59-71): with `noSpeckle` the two `X.speckle` calls (62-63) are skipped. Autumn leaves stay.
5. `officeFrame(ctx, day, detail, down, S, o)` (266-287), `o.part`:
   - `'wall'`: line 269's `X.rect(putty)` and `X.gradient` (not the desk rect), then 271-273 with `weather(..., true)` (snow caps on line 272 stay).
   - `'monitors'`: 274-276.
   - `'desk'`: line 269's `X.rect(ctx, 0, 235, 640, 125, P.desk)`, 277-278, and when `detail` 279-286, with `o.noTopSheets` (skip sheets `i = 2, 3` in line 281 and the `'CASCADE'` label, line 282) and `o.deskChart = 'screen'` (line 285 draws `chart(..., 'screen')`).
6. `person()` is not touched in this batch.

Shared geometry (big phone, `w = 226, h = 308`): device `x = 207, y = 18`; screen `sx = 215, sy = 30, sw = 210, sh = 284`; list window `(217, 51, 206, 260)`; row `i` at `yy = 55 + 44 i`, card `(220, yy, 200, 39)`; status digit right-aligned at `(417, 36)` in `c.wash`; left labels at `labelX`, y 92 and 110. Small phone (`w = 180, h = 250`): `x = 230`, screen `(238, 30, 164, 226)`, compact rows. `c = R.colors(act)`.

---

## Shot 1: phone handoff (`phone:<day>:handoff`)

### 1. Intent
You take the phone out of your pocket before you are awake. It comes up into your hand dark, then wakes on its own and shows what piled up overnight. It should feel like a habit, not an event. The key movement is **the phone rising 56 px into frame**; the wake is its payoff.

### 2. Duration
1.4 s, unchanged. The rise sits between 0.15 and 0.75 s so it is mostly clear of the opening 0.28 s fade; the wake at 0.80 s leaves 0.6 s of rest before the dissolve into the read.

### 3. Layers (back to front)

`L` (the list) is `feed.slice(1, 5)` when `feed.length >= 5`, else `feed.slice(0, 4)`. `o = { rows: L, labelX: big ? 92 : 88 }` with `big = L.length > 2`.

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `room` | `phoneFrame(c, sb, feed, false, Object.assign({ part: 'room' }, o))`: 246 (ink fill, gradient), 259-260 (labels, count `L.length`) | 0 | 640x360 |
| `device` | `phoneFrame(..., { part: 'device', ... })`: 252-258 (reflected edges, `phone()` with rows `L`, bezel lines, home bar, the five signal dashes) | 1 | 640x360 |

### 4. Camera
`camera: K.rise(56, 1.4, 0.15, 0.75)`, that is `{ from: { x: 0, y: -56, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: (p) => M.ease.out((p * 1.4 - 0.15) / 0.6) }`. The device layer is drawn 56 px low until 0.15 s, eases up and reaches offset 0 at about 0.69 s (the offset rounds to 0 once `56 (1 - out) < 0.5`). The room is pinned, so the labels and the background never move: the phone moves, not the eye.

Far end: at t = 0 the device top is at y 74 (glow rect 66), the bottom is off the frame. The room layer covers the whole view, so nothing is ever uncovered.

### 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Asleep screen | `device` | 0-0.80 | `K.ping(c, t, { at: 0.80, off: [{ x: sx, y: sy, w: sw, h: sh, col: P.screenD }], on: [], flare: { x: sx, y: sy, w: sw, h: sh, col: P.bone, a: 0.15, dur: 0.08 } })`. Hides the cached rows and status bar until 0.80. | `screenD`, `bone` | ping |
| Lock-screen time | `device` | 0-0.80 | `c.save(); c.scale(2, 2); X.textShadow(c, '6:' + mm, 160, 39, P.grey2, P.ink, { align: 'center' }); c.restore()` with `mm = String(31 + day % 24).padStart(2, '0')`: 2x digits centred at view (320, 78). Not drawn from 0.80. | `grey2` | none |
| Wake flare | `device` | 0.80-0.88 | Part of the ping above: one hard 0.08 s step, then the cached lit screen. | `bone` 0.15 | ping |

Cost: at most 4 rects plus the time (about 110 rects).

### 6. Timeline
- 0.00-0.28: fade from black on the empty room and its two labels.
- 0.15: the dark phone starts to rise from below, 6:MM in grey on its black face.
- 0.69: it settles in place.
- 0.80: the screen wakes in one hard step with a brief bone flare; status bar, count and the rows of the backlog appear.
- 0.88-1.40: still. No caption on this beat.

### 7. Final frame (p = 1)
Today's handoff picture, with two deliberate differences: the left labels sit at x 92 whenever the big phone is drawn (today 88), and on days with five or more feed items the list shows items 2 to 5 (`feed[1..4]`). The device is at rest at y 18, awake.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Feed of 5 or more (story sessions 3 to 43, `feedCount` 5 to 9) | List is the backlog `feed[1..4]`; the lead arrives in the read. Counters say 4. |
| Feed of exactly 3 or 4 (sessions 1, 2, 44 to 46) | List is `feed[0..3]`, today's content. |
| Feed of 1 or 2 (tests, debug) | Small phone (180x250, compact rows, labels at 88). Rise and wake the same, on the small screen rect. |
| Empty feed | `0 NOTIFICATIONS`, empty screen; the wake still happens (a lit empty screen). |
| Act 1 to 4 | Glow alpha `0.12 + act * 0.025` in `c.signal`, labels and count in `c.wash`: as today, cached. |
| Day | Minute `6:31` to `6:54` on the lock screen and status bar. |
| Item kinds, anomaly item | Stripe colours as today; the anomaly item gets no special treatment (no hint to the player). |
| No game, other modes | The phone scene plays only in story mode; with `opts.game` missing nothing changes (no game state is read). |

### 9. Sound cues
`sfx: 'apartment'` stays. No cue: the wake is silent and the notification sound belongs to the read.

### 10. Risks and fallbacks
- **Rise reads as a camera move.** It should not, because the room is pinned. If it still does, halve it: `K.rise(32, 1.4, 0.15, 0.6)`.
- **Label x.** Moving the labels to 92 on the big phone removes a 4 px jump during the dissolve into the read. Flat callers are unaffected (`establishDoc` 'post' shows one item, the small phone).
- **Backlog content.** The flat handoff still now shows `feed[1..4]` on most days. Nothing reads the handoff for information (short mode shows the read).
- The device glow is an alpha rect drawn into a transparent layer; composited it equals today's within one colour level.

---

## Shot 2: phone read (`phone:<day>:read`)

### 1. Intent
You are reading, and the morning's headline lands on top while you look. The list shifts down to make room. It should feel like the feed is live and you are already behind. The key movement is **the lead notification sliding in at the top and pushing the stack down one row (44 px)**.

### 2. Duration
2.0 s, unchanged. The slide runs 0.70 to 1.00 s; the caption finishes typing at 1.32.

### 3. Layers (back to front)

`n = feed.length`. Arrival day: `n >= 5`. `L = arrival ? feed.slice(0, 5) : feed.slice(0, 4)`. `o = { rows: L, count: arrival ? 5 : L.length, glow: arrival ? 2 : 1, noDigits: true, labelX: 92 }`. (`glow: 2` keeps `feed[1]`, the backlog's newest, highlighted as it was in the handoff, so the dissolve matches.)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `back` | `phoneFrame(c, sb, feed, true, Object.assign({ part: 'back' }, o))`: 246, 252-258 and 259-260, everything except the row cards and the two count digits | 0 | 640x360 |
| `rows` | `phoneFrame(..., { part: 'rows', ... })`: the row cards of `L` at slots 0 to 4 (y 55, 99, 143, 187, 231), unclipped | 1 | 640x360 |
| `glass` | Same as `back` with `o.clipOut = { x: 217, y: 51, w: 206, h: 260 }`: the whole picture with the list window left unpainted | 0 | 640x360 |

`glass` hides any row that is outside the list window, so the slide happens behind the status bar and the bezel exactly as on a real screen. Inside the window `back` provides the flat `P.screen` under the rows.

### 4. Camera
Arrival days only: `camera: { from: { x: 0, y: 44, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: K.camSpan(2.0, 0.70, 1.00, M.ease.out) }`. Only the depth-1 `rows` layer moves: drawn 44 px up until 0.70 (row 0, the lead, sits at y 11-50, wholly above the window and hidden by `glass`; rows 1 to 4 occupy slots 0 to 3, exactly the handoff's last picture), then eases down to 0 by 1.00. Other days: `camera: null`.

Far end check: the lowest row ends at y 270 at rest, inside the window (bottom 311) and above the caption box (280). At the start row 4 sits at 187-226. Nothing ever crosses the window's bottom edge.

### 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Status count | `glass` | whole beat | `R.text(c, String(k), 417, 36, c.wash, 'right')`; `k = arrival && t >= 0.85 ? 5 : min(4, n)`. Drawn on the flat status bar where the cache left it out. | `c.wash` | none |
| Left label digit | `glass` | whole beat | `R.text(c, String(k), 92, 110, P.bone)`, same `k`. | `bone` | none |
| Landing flare | `glass` | arrival 1.00-1.08; other days 0.70-0.78 | `K.ping(c, t, { at, off: [], on: [], flare: { x: 220, y: 55, w: 200, h: 39, col: P.bone, a: 0.15, dur: 0.08 } })` over the top row. None when `n === 0`. | `bone` 0.15 | ping |

Cost: about 60 rects plus one flare rect, over three blits.

### 6. Timeline
- 0.00-0.30: dissolve from the handoff; the pictures match (same device, same rows on arrival days).
- 0.22-1.32: caption `PRE-OPEN FEED` types.
- 0.70: the notification sound; the stack starts to slide down.
- 0.85: both counters step from 4 to 5.
- 1.00: the lead is in place at the top; a 0.08 s bone flare on its card.
- 1.08-2.00: still, two highlighted rows at the top.

### 7. Final frame (p = 1)
Arrival days: today's read with a fifth row (`feed[4]`, y 231-270), the top two rows highlighted (`screenGlow`), counters reading 5 and the label `5 NOTIFICATIONS`. Other days: today's read exactly. The camera is at 0, so the live last frame equals `draw(..., 1)`, which is also what short mode shows.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Feed of 5 or more | Arrival as above. The arriving headline is the day's real lead; rows 2 to 5 differ every day. |
| Feed of 3 or 4 (sessions 1, 2, 44 to 46) | No slide, `camera: null`. The top row flares at 0.70 with the sound. On the last three sessions the thinning feed and the stillness are the point. |
| Feed of 1 or 2 | Big phone (the read is always `close`), compact rows, flare on row 0. |
| Empty feed | `0 NOTIFICATIONS`, no flare. The sound still plays at 0.70. |
| Act, day, kinds | As the handoff. |
| Vote-fail feed (`voteFailFeed`) | Content only; same motion. |

### 9. Sound cues
`cues: [{ at: 0.70, sfx: 'news' }]`, and the beat's own `sfx: 'news'` is removed, so the ping lands with the slide instead of at the cut. On no-arrival days the cue fires with the flare. `phoneOpen` is not used: the briefing plays it when it opens right after.

### 10. Risks and fallbacks
- **The masking layer.** `glass` must be pixel-identical to `back` outside the window (same call, only the clip differs). If an edge pixel shows during the slide, widen nothing: check that `rows` is drawn without `phone()`'s own clip and that the clip rect is exactly `(217, 51, 206, 260)`.
- **Fifth row in the still.** It changes the informative still for short mode (needs a ruling; recommended yes). Fallback: on arrival days draw `L = feed.slice(0, 4)` and slide from the backlog's `feed[1..3]`; the handoff then shows `feed[1..4]` and the bottom row leaves through the window bottom, which is hidden by `glass` too.
- **Two highlights.** If the coordinator prefers one, use `glow: 1`; the backlog's top row then darkens during the dissolve (visible but brief).
- `B.Rhythm.phoneRowCount` stays 4 (`render-run.js` reports it); it describes the flat device, not the read.

---

## Shot 3: office wide (`office:<day>:wide`)

### 1. Intent
FORTY-FIRST FLOOR. The elevator chimes and the floor's screens refresh one after another as you walk in, like the room noticing you. Dead desks do not react. It should feel institutional and slightly mechanical. The key movement is **a refresh band sweeping down each live monitor in turn, left to right**.

### 2. Duration
1.45 s, unchanged. Five sweeps of 0.36 s at 0.12 s spacing need 0.84 s; they start after the fade.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `wall` | `officeFrame(c, day, false, null, S, { part: 'wall' })`: 269 without the desk rect, 271-273 with `noSpeckle` | 0.5 | 640x360 |
| `monitors` | `{ part: 'monitors' }`: 274-276 (five cels, live charts or dead screens with their bar) | 0.75 | 640x360 |
| `desk` | `{ part: 'desk' }`: the desk rect (0, 235, 640, 125), 277-278 (keyboard). No detail. | 1 | 640x360 |

The wall layer's putty fill runs to y 360, so when the desk layer is lower than the wall during the tilt the gap above the desk edge shows plain wall, not ink.

### 4. Camera
`camera: { from: { x: 0, y: -8, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.inOut }` over the whole beat. Offsets: wall 4 → 0, monitors 6 → 0, desk 8 → 0. At most 4 rows are uncovered at the top, under the 12 px letterbox. At t = 0 the window strip starts at y 20 and the desk edge at 243.

### 5. Animated elements

Monitors: `x_i = 24 + 124 i`, screen `(x_i + 10, 92, 84, 78)`. `dead = act - 1`; monitor `i` is live when `i < 5 - dead`. Windows: `wx_i = 18 + 104 i`, sky rect `(wx_i + 2, 18, 86, 40)`.

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Refresh wave | `monitors` | live monitor `i`: `0.35 + 0.12 i` to `+0.36` | `K.crt(c, x_i + 10, 92, 84, 78, t, { mode: 'roll', at: 0.35 + 0.12 * i, dur: 0.36 })`: a 6 px band crosses the 78 px screen top to bottom. Dead monitors: nothing. | `phosphorD` 0.22, edge `phosphor` 0.4 | crt |
| Window weather | `wall` | whole beat | For `i = 0..5`: `K.weather(c, wx_i + 2, 18, 86, 40, day, 'office:' + day + ':wx' + i, t, { t0: 0, count, rainLen: 5 })` with `count` set per window (the window is too small for the area formula): snow `3 + Math.round(3 * season.snow)` (3 to 6), drizzle 4, leaves 3. | as the kit | weather |

Cost: at most 36 particles and 10 band rects.

### 6. Timeline
- 0.00-0.28: fade from black with the elevator chime (`sfx`). The tilt starts.
- 0.22-1.02: caption `FORTY-FIRST FLOOR.` types.
- 0.35, 0.47, 0.59, 0.71, 0.83: the band starts on monitors 0 to 4 (only the live ones run).
- 1.19: the last sweep ends. Weather keeps falling.
- 1.45: tilt at rest.

### 7. Final frame (p = 1)
Today's wide, except: in winter the static snow speckle in the six windows is replaced by falling snow at its 12 fps pose for t = 1.45; in grey weeks four drizzle streaks per window; autumn adds moving leaves to the static ones. No band is on screen.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Act 1 (sessions 1 to 8) | 5 live monitors, 5 sweeps. |
| Act 2, 3, 4 | 4, 3, 2 live monitors; the wave stops before the dead ones, which stay black. The pause where a sweep would be is the story. |
| Season | Autumn leaves, grey drizzle, winter snow (count by `snow`); snow caps on the buildings stay cached. |
| Market down / up | Chart colours as today, cached; the band is the same colour either way. |
| No game, other modes | No game state is read by this beat. |

### 9. Sound cues
`sfx: 'elevator'` stays (it already plays at the cut). No cues.

### 10. Risks and fallbacks
- **Tilt on the wall gradient.** Four one-pixel steps, as the pilot apartment. Fallback 1: wall depth 0, monitors 0.5, desk 1. Fallback 2: no camera.
- **Wave too busy.** If five sweeps read as a gimmick, keep only every other live monitor (0, 2, 4).
- **Weather in 40 px windows** may read as noise. Fallback: drizzle count 0 (grey weeks then match today).
- Layer split: monitors and desk never overlap; the desk rect must not be in `wall`.

---

## Shot 4: office desk (`office:<day>:desk:<k>`)

### 1. Intent
THE DESK IS ALREADY AWAKE (or, later, the dead desks on your row). Your own screen is ticking before you sit down; the CASCADE stack on your desk gives a little more each morning. It should feel like you are late to something that never stops. The key movement is **your desk chart ticking forward one point every 0.25 s**: the whole line shifts left 5 px and a new point enters on the right.

### 2. Duration
1.8 s, unchanged. Seven ticks at 0.25 s from 0.25.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `wall` | as the wide | 0.5 | 640x360 |
| `monitors` | as the wide | 0.75 | 640x360 |
| `desk` | `officeFrame(c, day, true, null, S, { part: 'desk', noTopSheets: true, deskChart: 'screen' })`: desk rect, 277-278, sheets 0 and 1 of line 281, flakes (283, at the final slip), HOLD files (284), desk chart CRT only (285) | 1 | 640x360 |

### 4. Camera
`camera: null`. The wide's tilt is finished; a still desk lets the chart read.

### 5. Animated elements

`st = S && S.m ? S.m.stability : 100`, `slip = Math.round((100 - st) / 12)`, `down = R.marketDown(day - 1)`, `Y = R.chartSeries(218, 50, day, down, 25)`, `col = down ? P.crimson : P.jade`.

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Desk chart ticks | `desk` | 0.25-1.75 | `tc = t` (this beat). `s = clamp(Math.floor((tc - 0.25) / 0.25) + 1, 0, 10)`. `K.trace(c, Y, t, { x0: 546, step: 5, from: s, n: 15, w: 3, h: 2, col, head })`, `head = s >= 1 && tc - (0.25 + (s - 1) * 0.25) < 0.12 ? P.bone : null`. At s = 0 it is today's line exactly. | jade or crimson, head `bone` | trace |
| Stack slip | `desk` | 0.90-1.20 | Sheets `i = 2, 3` drawn as line 281 with `x = 58 + 4 i + sNow`, `y = 250 - 9 i`, `sNow = slip >= 1 ? Math.round(slip * M.ease.out(K.span(t, 0.90, 1.20))) : 0`; then the `'CASCADE'` label (282) on top, as the original order. Steps of 1 px, 1 to 8 px in all. | as today | none (16 + about 170 rects) |
| Window weather | `wall` | whole beat | As the wide with `t0: 1.45` (chain time), same seeds. | as kit | weather |

### 6. Timeline
- 0.00-0.30: dissolve from the wide; the stack, files and your chart fade in.
- 0.22-1.21: caption types.
- 0.25, 0.50, ... 1.75: the chart ticks (7 times); each new point is bone for 0.12 s.
- 0.90-1.20: when stability is below 100, the top two sheets slide right into their slipped place.
- 1.80: rest. Weather continues.

### 7. Final frame (p = 1)
Today's desk with the desk chart showing points 7 to 21 of the series (the line seven ticks on) and the newest point in bone (the last tick at 1.75 is still within its 0.12 s). Sheets at the full slip, as today. Window weather at its pose.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Market down / up | Crimson line drifting down or jade drifting up; new points continue the same drift. |
| Stability 100 (early run, or no game) | `slip = 0`: the stack does not move. Only the chart carries the shot. |
| Stability falling | Slip 1 to 8 px; below 60 the top sheets carry crimsonD bars; below 40 the crimson flakes lie at the final slip (cached). The movement grows across the run. |
| Heat 50+, insider trade, raid | HOLD files static. |
| Act | Dead monitors as the wide (static here); label colour `c.signal`. Caption changes by act (existing). |
| Season | As the wide. |
| No game (`S` missing) | `k = ''`, no slip, no files. |

### 9. Sound cues
`sfx: 'office'` stays. No cues.

### 10. Risks and fallbacks
- **Small dots.** The ticking line covers 74x22 px in 3x2 dots. If the strip shows it too faint at 1440x900, add a 1 px `P.phosphorD` vertical "now" mark at the newest point's x (`x0 + 70`, y 228 to 250) only while `head` is set. Do not enlarge the points.
- **Label order.** The label is redrawn after the sheets so the one row where its shadow overlaps sheet 3 matches today. If perf needs it, draw the label in the cache and accept that one row.
- **Resetting stack.** The stack starts square every morning and slips again. That is intended (someone squared it overnight); fallback: start at `slip - 2`.

---

## Shot 5: office hold (`office:<day>:hold:<k>`)

### 1. Intent
SIT DOWN. NINE THIRTY. Nothing new happens; the room just does not stop. Tier 2, continuity only: **the chart keeps ticking and the weather keeps falling across the cut**.

### 2. Duration
0.85 s, unchanged.

### 3. Layers
Exactly the desk beat's three layers and parts (cached again under the hold's id).

### 4. Camera
None (`camera: null`; a hold).

### 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Chart ticks | `desk` | 0.20, 0.45, 0.70 | As the desk with `tc = t + 1.8`: ticks 8, 9, 10. | as desk | trace |
| Stack | `desk` | whole beat | Sheets 2 and 3 at the full slip, then the label (no movement). | as today | none |
| Weather | `wall` | whole beat | As the wide with `t0: 3.25`. | as kit | weather |

### 6. Timeline
Cut in at 0 (holds cut). Caption types 0.22 to 0.69. Ticks at 0.20, 0.45, 0.70.

### 7. Final frame (p = 1)
The desk's picture with the chart at tick 10 (its head back to line colour: the last tick's 0.12 s ended at 0.82). It is today's hold plus the shifted line and the weather.

### 8. Variants
As the desk beat.

### 9. Sound cues
None (as today).

### 10. Risks and fallbacks
- A cut between two beats with ticking at the same rate shows no jump only if `tc` is chain time. If the engine ever plays the hold alone (short mode never does: it shows the informative desk beat), it starts at tick 7, which is still correct.
