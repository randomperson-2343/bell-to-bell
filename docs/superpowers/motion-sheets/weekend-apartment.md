# Motion sheet: weekend apartment, Saturday (`weekend:<key>:sat`)

## 1. Intent

The one day off, which is not really off. The room breathes: weather drifts past the window, the clock keeps blinking 5:58, the pet breathes on its rug, and then the phone on the floor lights up and pings. It should feel like quiet with a leash on it. The single most important movement is **the phone lighting up**, the moment the week reaches into Saturday. The weather and the pet's breathing are the calm it interrupts.

## 2. Duration

**2.4 s** (today 1.7 s, limit 2.55 s). That allows a settled half-second, then the ping at 1.0 s, one full breath of the pet, and a second of hold for the caption (which can carry a payslip figure). Seen nine times in a run.

## 3. Layers (back to front)

Add a sixth argument `part` to `apartmentShot(ctx, day, home, night, w, part)` (storyboard.js 464-634). With `part` undefined it draws exactly what it does today, so `sun` and `hold` stay flat and unchanged. Add `windowRect(home)` returning `{ wx, wy, ww, wh }` (the maths on line 490) so the layers and animate steps share it. All coordinates are native 640x360; no `at2x`.

| id | Contents (source lines in storyboard.js) | depth | Size |
| --- | --- | --- | --- |
| `outside` | 491-509: clip to the window opening, sky, dawn dither, view (shaft, wall, suburb, city, bridges or park), static `R.weather`. Transparent outside the opening. | 0.25 | 640x360 |
| `room` | 467-487 (ink, wall, stripes, picture rail, floor, skirting), drawn inside an even-odd clip that leaves the window opening unpainted: `ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 640, 360); ctx.rect(wx, wy, ww, wh); ctx.clip('evenodd')`, draw, then `ctx.restore()`. This is source-over only, with no erasing. Then, unclipped, 510-542 (frame, mullions, sill, curtains, wreath, radiator, calendar, door and notice), then 546-556 (night lamplight; not drawn on `sat`). | 0.5 | 640x360 |
| `furniture` | 559-615: couch, mattress and wardrobe, or bed; plant; what is on the bed; nightstand, lamp and 5:58 clock | 0.85 | 640x360 |
| `front` | 618-631 (envelopes, phone, rug, night figure) then `petShot(ctx, w)` (663-685) | 1.2 | 640x360 |
| `grain` | 632-633 (night overlay, not on `sat`; scanlines at 0.05) | 0 | 640x360 |

The scanlines are a screen texture, so they stay pinned. No oversized layers: every layer is 640x360, so the layer-sized `view` is the shot view and all coordinates here hold. The window frame's 3 px overlap into the opening hides the `outside` parallax (checked below).

## 4. Camera

`camera: { from: { x: 0, y: 8, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: B.Motion.ease.inOut }` over the whole beat. A slow rise: the room drifts down into place, near things more than far. Offsets at the start: `outside` -2, `room` -4, `furniture` -7, `front` -10, `grain` 0. Up to 4 rows at the bottom are uncovered, under the letterbox. The rug and pet start 10 px higher, fully clear of the caption, and settle to today's place.

Hole check: `outside` moves at most 2 px against `room`. The frame boxes cover 3 px inside each edge of the opening (`wy - 9` + 12, `wx - 9` + 12, and so on), so no gap shows. **Keep `8 × (0.5 - 0.25) <= 3`** if any value here changes.

Vertical only, and no zoom. The shimmer gate ruled out sideways drift and zoom on dithered walls, and zoom would break the 3 px grid.

## 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Helper |
| --- | --- | --- | --- | --- | --- |
| Weather in the window | `outside` | 0-2.4 | `B.Motion.particles({ kind, seed: beat.id + ':wx', t: tp, x: wx, y: wy, w: ww, h: wh, count })` inside `ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip()`. Season from `R.season(day)`. See the weather table below. | see below | `particles` |
| Clock colon blink | `furniture` | off during 0.5-1.0 and 1.5-2.0 | When off: `X.rect(nx + 45, 204, 2, 2, P.ink2)` and `X.rect(nx + 45, 208, 2, 2, P.ink2)`, with `nx = LAYOUT[home.id].stand` (default `studio`) | `ink2` | none |
| Phone lights | `front` | from 1.00 to end | At 1.00: screen `X.rect(219, 264, 21, 6, c)` with `c` = `sky`, or `crimsonD` when `w.lateWeeks > 0`, plus a floor glow `X.rect(207, 276, 45, 3, g)` at alpha 0.3 with `g` = `sky`, or `crimson` when late (above the caption box). From 1.08, also a notification bar `X.rect(222, 266, 12, 2, b)`, `b` = `white`, or `crimson` when late. A second silent notification: from 1.6 to 1.7 the screen, bar and glow are not drawn (dark), lit again from 1.7. No second sound cue. Hard steps, no fade. | see left | none |
| Pet breath | `front` | inhale 0.8-1.7 | Only if `w.pet` exists. During the inhale, draw `petRows(pet, cared).slice(0, 13)` again at `translate(420, fy - 1)` then `scale(3, 3)`, where `fy = 276 - 48 - (cared ? 6 : 0)`. Head and chest rise 1 px; the bottom three rows (haunches and feet) stay. Otherwise draw nothing extra. | the pet's own | `X.drawSprite` |

| Season (`R.season(day)`) | `kind` | `count` | Pose rate | Each particle |
| --- | --- | --- | --- | --- |
| `autumn` | `'paper'` (drifting leaves) | `clamp(Math.round(ww / 30), 4, 14)` | 12 a second: `tp = Math.floor(t * 12) / 12` | 3x2 rect, `i % 2 ? P.amber : P.crimsonD`, as `R.weather` |
| `grey` | `'rain'` (drizzle) | `clamp(Math.round(ww * wh / 1500), 10, 40)` | full rate: `tp = t` | 1x6 rect, `grey2` |
| `winter` (`snow > 0`) | `'snow'` | `clamp(Math.round(ww * wh / 1000 * (0.4 + 0.6 * s.snow)), 12, 40)` | 12 a second | `P.white`: 3x3 when `s === 2`, 2x2 when `s === 1` |

The static speckle and the leaves from `R.weather` stay in the cached layer underneath, as weather that has settled. Worst case per frame: 40 particles plus about 200 sprite rectangles during the inhale plus 6 others.

## 6. Timeline

- 0.00-0.28: fade from black. Weather already falling. The room starts its 8 px rise.
- 0.22-1.37: caption types (week, tier, payslip).
- 0.5-1.0: the clock colon goes out, then back on.
- 0.8: the pet's head and chest rise 1 px (inhale). They come back down at 1.7.
- 1.00: the phone screen lights, with a ping. 1.08: the notification bar appears and stays.
- 1.5-2.0: the colon blinks again.
- 2.4: camera at rest. The phone is still lit.

## 7. Final frame (p = 1)

Today's Saturday still, with three differences: the phone on the floor is lit (sky screen, white bar and a sky floor glow; crimsonD, crimson and crimson when rent is late); weather particles sit in the window at their last 12-per-second pose (t = 2.333 s); and the colon is on (as today). The pet is in its resting pose, the camera at 0. It reads as a complete still: the lit phone is the one point of signal colour on the floor, just above the caption.

## 8. Variants

| Variant | Behaviour |
| --- | --- |
| `couch` | Small window (141x150 at x 463); 5 leaves, 14 drizzle or 12-21 snow (cap 40). Stand at 309, so the colon is at x 354. Phone in front of the couch. |
| `share` | 165 px brick-wall view; weather falls in front of the bricks. Stand at 255 (colon x 300). |
| `studio` (also no-game default) | 180 px airshaft. Same as `share`. Radiator static. |
| `onebed` | 255 px city view. Daytime windows unlit, as today. |
| `loft` | 372 px bridges view, three panes; plant static on `furniture`. |
| `penthouse` | 549x198 window from x 55; counts hit their caps (14, 40, 40). Mullions on `room` occlude the particles correctly. |
| Late rent | Door, notice and envelopes are static props on `room` and `front`. The only change: the phone's screen, bar and glow are crimson instead of sky and white, a bill instead of a feed. No new art. |
| Seasons | Autumn leaves, grey drizzle, winter snow (count scales with `snow`); the wreath stays static. |
| No pet | No breath element; everything else the same. |
| Cat or dog, cared for | Breath as specified; cushion, bowl and toy static. |
| Neglected | Same breath on the mottled sprite with dull eyes. It is alive, and nothing else changes. |
| Night | Not used on `sat`. The `room` and `grain` parts keep their night branches so flat callers still work. |

## 9. Sound cues

- The beat's own `sfx: 'apartment'` stays.
- `cues: [{ at: 1.0, sfx: 'news' }]`: the two-note notification the feed uses, timed to the phone lighting. It ties "it never stops" to the work week.

## 10. Risks and fallbacks

- **Wall dither moving.** The `room` layer moves in 4 one-pixel vertical steps over 2.4 s. Fallback: `room` depth 0, `outside` depth 0, `furniture` 0.4, `front` 0.75 (the wall stays still and the floor objects still separate). Second fallback: no camera.
- **Drizzle in grey weeks is new weather.** `R.weather` draws nothing for `grey`. If the owner wants the window to match other grey shots, set `count` to 0 for `grey`.
- **Breath overdraw.** Redrawing the upper rows 1 px higher stretches horizontal contours (such as the ear tips) by 1 px during the inhale. That is intended; it reads as swelling, not squash. If perf fails at 4x throttle, lower the snow cap to 30 first, then drop the breath.
- **Layer split.** The composited p = 1 picture must equal today's apart from the three additions. Alpha drawing (stripes, scanlines) now goes into transparent layer canvases and may round by one level; `weekendUnique` stays 9. Check `share`, where the wardrobe at x 327 sits on `furniture`, and `penthouse`, where the calendar overlaps the window frame on `room`.
- Clipping inside `animate` must be wrapped in `save`/`restore` so it does not leak into later layers.
