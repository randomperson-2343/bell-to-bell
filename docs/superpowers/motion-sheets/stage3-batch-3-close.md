# Stage 3, batch 3: the close (report card, hold, Sqwak breaking)

The close chain runs every session: the pilot bell (`close:<tag>:bell`, 1.82 s), on eight story sessions the Sqwak insert and read, then the report and its hold. Binding: the bible (`stage3-bible.md`), sections A and C. Notation as the batch 2 sheet (`K` = `B.MotionKit`, `M` = `B.Motion`, `X` = `B.Pixel`, `P` = `B.Pal`, `R` = `B.Rhythm`). Line numbers are today's `js/art/rhythm.js` unless marked.

No durations change. The close chain gains 0 s beyond the pilot bell's 0.57 s.

## 0. Code changes shared by this batch (all in `rhythm.js`, all optional)

1. `closeFrame(ctx, report, detail, o)` (288-298), `o.part`:
   - `'office'`: line 290 (`officeFrame(day, true, down)` and the 0.32 ink overlay).
   - `'card'`: 291-297, with `o.noPnl` (skip line 296's P&L text) and `o.noDashes` (skip line 294's nine dashes). The verdict label (295) and the quota and date lines (297) stay cached.
   - Undefined: today's picture.
2. `sqwakFrame(ctx, sb, b, full, o)` (327-370), `o.part`:
   - `'city'`: 329-330 (skyline, ground).
   - `'phone'`: 333-367 (hand, plate, screen, header, post, reply), with `o.noFlag` (skip the 10x10 flag square, line 352) and `o.noStats` (skip line 360).
   - `'grain'`: 368-369 (scanlines; the act wash when not `full`).
3. The office monitors and desk chart use the geometry of `officeFrame` (batch 2 sheet): monitor `i` screen `(34 + 124 i, 92, 84, 78)`, live when `i < 5 - (act - 1)`, its "off" bar `(44 + 124 i, 176, 64, 3)`; desk chart CRT `(540, 218, 86, 50)`, inner `(541, 219, 84, 48)`.

Report card geometry: box `(165, 72, 310, 112)`, flat `P.ink` interior `(167, 74, 306, 108)`; verdict label centred at (320, 93); P&L centred at (320, 124); quota line (320, 146), date (320, 162); dashes `(172 + 37 i, 180, 15, 1)`, `i = 0..8`. `good = pnl >= 0`, `met = !!report.quotaMet`, `verdict = report.quota > 0` (a real quota decided the label).

---

## Shot 1: close report (`close:<tag>:report`)

### 1. Intent
The day's number, delivered by the desk without comment. The figure runs up to what you made or lost, then the verdict is stamped on it as the caption says it. It should feel like paperwork, final and a little cold. The key movement is **the verdict stamp landing in three hard frames round QUOTA MET or QUOTA MISSED**, with the P&L count leading into it.

### 2. Duration
2.0 s, unchanged. The caption (`YOU MADE MONEY... QUOTA $900: MET.`) finishes typing at `0.22 + min(1.15, 1.1) = 1.32`; the stamp lands at 1.26 to 1.34, with it (rule C2). 0.66 s of rest follows.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `office` | `closeFrame(c, r, true, { part: 'office' })`: line 290, the floor (detail on: stack, desk chart, dead monitors) under the 0.32 ink overlay | 0.5 | 640x360 |
| `card` | `closeFrame(c, r, true, { part: 'card', noPnl: true, noDashes: true })`: 291-295 and 297 | 1 | 640x360 |

### 4. Camera
`camera: { from: { x: 0, y: -6, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.out }` over the beat. Offsets: office 3 → 0, card 6 → 0; most of it under the 0.3 s dissolve, so the card reads as set down. At most 3 rows uncovered at the top, under the letterbox. At t = 0 the box spans y 78 to 190, clear of the caption (280).

### 5. Animated elements (all on `card`)

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| P&L count | 0.30-0.90 | `K.tally(c, 320, 124, t, { from: 0, to: r.pnl || 0, at: 0.30, dur: 0.60, ease: M.ease.out, fps: 15, fmt: (v) => B.fmt.money(v, true), col: good ? P.jade : P.crimson, align: 'center' })`. Nothing before 0.30. Losses count down from 0 (sign shown from the first step). The end value is `r.pnl` itself, so the text equals today's. | `jade` / `crimson` | tally |
| Tally dashes | 0.30-0.83 | `K.lamps(c, cells, t, { at: 0.30, step: 0.0667, on: met ? P.jadeD : P.crimsonD })`, cells the nine dashes. One lights per counter step, the last at 0.83. | `jadeD` / `crimsonD` | lamps |
| Verdict cover | 0-1.30 | Only when `verdict`: `X.rect(c, 280, 91, 80, 11, P.ink)` while the stamp phase is below 2. Hides the cached label on the flat box interior (rule C8). | `ink` | none |
| Stamp | 1.26 on | Only when `verdict`. `lw = X.textWidth(label) - 1`, `sw = 2 * Math.ceil((lw + 24) / 2)`, `sx = 320 - sw / 2`. `K.stamp(c, sx, 86, sw, 20, t, { at: 1.26, col: met ? P.jade : P.crimson, frame: 0.04, grow: [16, 6], style: 'double' })`. QUOTA MISSED: final rect `(272, 86, 96, 20)`, inner rule `(274, 88, 92, 16)`; QUOTA MET: `(281, 86, 78, 20)`. Phase 1 (1.26) 112x28 single outline; phase 2 (1.30) 102x23 two-pixel outline, label uncovered; phase 3 (1.34) the double rule. | `jade` / `crimson` | stamp |

The stamp's largest frame spans y 82 to 110, clear of the top keyline (74) and the P&L (124). Cost: about 230 rects at most (P&L text about 200, dashes 9, stamp 8, cover 1).

### 6. Timeline
- 0.00-0.30: dissolve from the bell (or the Sqwak read); the card settles 6 px.
- 0.22: caption starts typing.
- 0.30-0.90: the P&L runs from 0 to the day's figure, fast then settling; a dash lights with each step.
- 1.26, 1.30, 1.34: the stamp comes down in three frames; the verdict label appears inside it at 1.30.
- 1.32: caption ends on MET or MISSED.
- 1.34-2.00: still.

### 7. Final frame (p = 1)
Today's report picture plus the stamp's double rule round the verdict. P&L, dashes, label, quota and date exactly as today. Camera at 0. This is what short mode shows.

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Profit | Jade count upward, jade label colour as today. |
| Loss | Crimson count downward from 0. |
| P&L exactly 0 | The tally shows the formatted 0 from 0.30; no visible count. The stamp carries the shot. |
| Quota met (`quota > 0`) | Jade stamp round QUOTA MET. |
| Quota missed | Crimson stamp round QUOTA MISSED. |
| No quota (`quota <= 0`; the label reads QUOTA MET or CLOSING BELL by today's rule) | No cover, no stamp: the label is shown from the start. The count is the key movement. |
| Large figures | `B.fmt.money` width grows as it counts; centred, so it widens symmetrically. Up to 12 characters fit the box. |
| Act | The office behind: dead monitors and label colour, cached. The stamp ignores the act (market state, rule C3). |
| `indexPct` vs P&L | Drives `down` for the office charts, cached, as today. |
| No game, other modes | Nothing reads the game; the report object is all. |

### 9. Sound cues
`sfx: 'office'` stays. No cue on the stamp: `quotaMissed`, `weekMade` and `strike` play on the end-of-day screen about a second later (`screens.js` 303-305), and a cue here would double them (rule C12).

### 10. Risks and fallbacks
- **Stamp outline in the final still** changes the informative frame (ruling; recommended yes). Fallback: `style: 'none'` with no cover, so the stamp only flashes in phases 1 and 2 and the still is today's.
- **Label cover rect** must stay inside the flat box interior; `(280, 91, 80, 11)` covers both label widths and touches nothing else.
- **Tilt crawl** on the office's wall gradient: 3 one-pixel steps. Fallback: office depth 0.
- The 0.32 overlay is drawn into a transparent layer over the opaque office; the composite may differ by one colour level from today (as the pilot noted).

---

## Shot 2: close hold (`close:<tag>:hold`)

### 1. Intent
After the number, the floor goes home. The screens behind the card switch off one at a time, right to left. It should feel like the end of a shift, unremarkable. Tier 2. The key movement is **the live screens switching off in sequence**, each with a CRT collapse.

### 2. Duration
0.85 s, unchanged.

### 3. Layers
The report's two layers and parts, cached under the hold's id.

### 4. Camera
None (a hold, `camera: null`).

### 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Card at rest | `card` | whole beat | P&L drawn final (`K.tally` with `at: -1, dur: 0.01`), nine dashes on, stamp phase 3 when `verdict` (call `K.stamp` with `at: -1`), no cover. | as report | tally, lamps, stamp |
| Desk chart off | `office` | 0.15 | `K.crt(c, 541, 219, 84, 48, t, { mode: 'off', at: 0.15, bg: P.screenD, dim: 0.32 })` | `screenD`, `phosphor`, `white`, dim `ink` 0.32 | crt |
| Monitors off | `office` | live monitor `i`, `k`-th from the right: `0.25 + 0.10 k` | `K.crt(c, 34 + 124 i, 92, 84, 78, t, { mode: 'off', at, bg: P.screenD, dim: 0.32 })`, then from `at + 0.10` the dead bar `X.rect(c, 44 + 124 i, 176, 64, 3, P.plasticD)` and an `ink` 0.32 rect over the bar alone (the plastic around it is already dimmed in the layer). | as above | crt |

Act 1: off at 0.25 (monitor 4), 0.35, 0.45, 0.55, 0.65 (monitor 0); act 4: 0.25 and 0.35 only. Every collapse is over by 0.75. Cost: at most 30 rects plus the card's 210.

### 6. Timeline
- 0.00: cut in (holds cut). No caption.
- 0.15: your desk chart collapses to a line and goes dark.
- 0.25 onward: the live wall monitors follow, right to left, 0.10 s apart.
- 0.75-0.85: the floor is dark behind the card.

### 7. Final frame (p = 1)
The report's final frame with every live screen dark (dead-monitor look, dimmed like the rest of the floor). Monitors 1 to 3 are mostly behind the card; monitor 0, monitor 4 and the desk chart carry the change.

### 8. Variants
As the report. By act: 5, 4, 3 or 2 monitors switch off after the desk chart; in act 4 the floor is nearly dark already and the sequence is short. When the card covers a monitor completely nothing visible changes there; no special case.

### 9. Sound cues
None (as today).

### 10. Risks and fallbacks
- **Contrast under the 0.32 dim.** The phosphor line of each collapse is the bright part; if the strip shows it too faint, set `dim` on the collapse frames to 0 and keep 0.32 only on the final dark fill.
- Order matters: the office layer's `animate` runs under the card layer, so the card always covers the middle monitors correctly.

---

## Shot 3: Sqwak breaking insert (`close:<day>:sqwak`)

### 1. Intent
After the bell, your phone buzzes with the thing everyone is talking about. You lift it against the city. It should feel like the day's real news arriving after the market has already reacted. The key movement is **the phone and hand rising 40 px over the skyline**, the same gesture as the morning handoff (rule C4).

### 2. Duration
1.0 s, unchanged. The rise sits at 0.10 to 0.60; the insert is a beat in a chain, so it opens on a 0.3 s dissolve and the rise shows through it.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `city` | `sqwakFrame(c, sb, b, false, { part: 'city' })`: 329-330 | 0.25 | 640x360 |
| `phone` | `{ part: 'phone', noFlag: true }`: 333-367 at `py = 40` (stats cached) | 1 | 640x360 |
| `grain` | `{ part: 'grain' }`: 368-369 (scanlines 0.1, wash 0.25 in `c.wash`) | 0 | 640x360 |

### 4. Camera
`camera: K.rise(40, 1.0, 0.10, 0.60)`. Offsets: phone 40 → 0, city 10 → 0. At t = 0 the phone's top is at y 80 and the hand runs off the bottom; the city's top 10 rows are uncovered, under the 12 px letterbox. The wash and scanlines stay pinned (they are the screen, not the world).

### 5. Animated elements

Insert geometry: `sx = 211`, `sy = 52`, `cy = 104`, flag square `(223, 112, 10, 10)`.

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Flag light | `phone` | whole beat | `K.blink(c, 223, 112, 10, 10, t, { on: P.crimson, period: b.flag === 'LIVE' ? 0.5 : 0.8, duty: 0.6, end: 1.0 })`. Off shows the card's flat `P.screen`. | `crimson` | blink |

### 6. Timeline
- 0.00-0.30: dissolve from the bell, notification sound (`sfx: 'news'`).
- 0.10-0.60: the phone comes up; the city drifts 10 px with it.
- Throughout: the flag square blinks (it is on at the end).
- 0.60-1.00: still, under the act's wash.

### 7. Final frame (p = 1)
Today's insert exactly (flag on, camera at 0).

### 8. Variants

| Variant | Behaviour |
| --- | --- |
| Sessions 7, 13, 18, 21, 38, 41, 42, 45 (index 6, 12, 17, 20, 37, 40, 41, 44) | Content from `B.SqwakStory.breaking`; same motion. |
| Vote failed (`FAILED_BREAKING`) | Alternate content; same motion. |
| Flag `LIVE` | Blinks at the badge rate (0.5 s); `BREAKING`, `SYSTEM ERROR`, `CAPITOL` at 0.8 s. |
| Reply or none | Cached; partly visible at the bottom of the insert. |
| Act | Wash colour (amberD, violet, sky, crimsonD) in `grain`. |
| Season | Skyline snow caps and static speckle stay cached; no falling weather here (rule C11 and the pilot's speckle lesson: the subject is the phone). |
| Not story mode | No Sqwak beats at all. |

### 9. Sound cues
`sfx: 'news'` stays. No cues.

### 10. Risks and fallbacks
- **Rise inside the dissolve.** About a third of the travel happens while the dissolve finishes; the strip must show a clear rise from 0.30 to 0.60. If not, start it at 0.20 (`K.rise(40, 1.0, 0.20, 0.70)`).
- **Too large a move for a 1 s beat.** Fallback 24 px.

---

## Shot 4: Sqwak read (`close:<day>:sqwak-read`)

### 1. Intent
You bring the phone up to read it properly. The post is still spreading while you read: the counts climb. The key movement is **the same phone continuing its rise 26 px to reading height** (from the insert's `py = 40` to the read's `py = 14`), so insert and read are one gesture across a dissolve.

### 2. Duration
2.6 s, unchanged.

### 3. Layers (back to front)

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `city` | `sqwakFrame(c, sb, b, true, { part: 'city' })` | 0 | 640x360 |
| `phone` | `{ part: 'phone', noFlag: true, noStats: true }` at `py = 14` | 1 | 640x360 |
| `grain` | `{ part: 'grain' }`: scanlines 0.06, no wash | 0 | 640x360 |

The city is depth 0 here (0.25 in the insert) so it does not jump: the insert ends with the city at offset 0 and the read keeps it there.

### 4. Camera
`camera: K.rise(26, 2.6, 0.0, 0.6)`. The phone starts at offset 26 (its top at y 40, the insert's final place) and eases to 0 by 0.6 s. Nothing else moves.

### 5. Animated elements

Read geometry: `cy = 78`, flag `(223, 86, 10, 10)`, stats at y `cy + 176 = 254`.

| What | Layer | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- | --- |
| Flag light | `phone` | whole beat | As the insert at `(223, 86)`, `end: 2.6`. | `crimson` | blink |
| Engagement counts | `phone` | 0.60-2.20 | Three `K.tally` calls. Source strings `sA, sB, sC = b.stats || ['1.2K', '4.8K', '12K']`. Parse each: `v = parseFloat(s) * (/K$/.test(s) ? 1000 : 1)`. Format: one decimal and K when the source has a decimal point (`(v / 1000).toFixed(1) + 'K'`), whole K when it ends in K without one (`Math.round(v / 1000) + 'K'`), else the integer. `from = Math.round(0.8 * v)`, `to = v`, `at: 0.6, dur: 1.6, ease: M.ease.linear, fps: 8, before: 'from', col: P.grey2`. x positions from the final strings: `xA = 223`, `xB = xA + 6 * (sA.length + 3)`, `xC = xB + 6 * (sB.length + 3)`, left-aligned, so nothing shifts as digits change. At the end each value prints exactly its source string. | `grey2` | tally |

Cost: about 340 rects for the counts plus 1.

### 6. Timeline
- 0.00-0.30: dissolve from the insert; the wash fades away; the phone is where the insert left it.
- 0.00-0.60: the phone rises the last 26 px.
- 0.22-1.37: the caption (the headline) types.
- 0.60-2.20: the three counts climb, each at its own pace (a 1.4K counts in 0.1K steps, an 18K in 1K steps).
- 2.20-2.60: still.

### 7. Final frame (p = 1)
Today's read exactly: phone at `py = 14`, stats as authored, flag on.

### 8. Variants
As the insert, without the wash. Counts are always authored values or the defaults; any value without K counts as an integer. A three-digit K (`112K`) counts from `90K`, widening by one character in place (left-aligned at its final x, so it never overlaps the next number: the gap was computed from the longer final string).

### 9. Sound cues
`sfx: 'broadcast'` stays. No cues.

### 10. Risks and fallbacks
- **Continuity.** If the city or phone visibly jump at the dissolve, check the insert ends at offset 0 and the read starts at the phone's offset 26 with the city at depth 0.
- **Counting reads as a gimmick.** Fallback: count only the third (largest) number.

---

## Note for the coordinator: the bell's sound (pilot shot, not changed here)

`B.SFX` in the game is the facade in `js/audio/sound.js`, which has no `closeBell`; only `js/audio/sfx.js` does. So the pilot bell beat's `sfx: 'closeBell'` plays nothing in the game. The bell the player hears is `B.SFX.marketClose()` (`game.js` 492, `bell_close`, strikes 0.55 s apart, new sound style only), fired just before the close chain starts. The pilot's 1.82 s swing, timed to `closeBell`'s 0.26 s strikes, is therefore not in step with any sound. This batch does not touch the bell; it is listed as a ruling.
