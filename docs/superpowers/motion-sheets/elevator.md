# Motion sheet: session 1 elevator (`news:0:establish`)

## 1. Intent

The first picture of the game. The player waits in a lobby on the forty-first floor. The counter climbs, the car arrives, a fluorescent stutter, and the doors part onto an empty, lit car. It should feel like being admitted to an institution that was running fine without you. The single most important movement is **the doors opening**. Everything else leads up to it.

## 2. Duration

**2.4 s** (today 1.7 s, limit 2.55 s). The counter needs about 1 s to read as climbing, and the doors need 0.9 s to read as heavy steel and not a UI slide. The last 0.25 s holds the final still. This adds 0.7 s to the session 1 morning chain, well inside its 3 s allowance.

## 3. Layers (back to front)

All 320x180 art is drawn through `at2x(ctx, fn, 0)`. Add a fourth argument `part` to `SH.elevator(ctx, open, floor, part)` (scenes.js 112-140). With `part` undefined it draws exactly what it does today, so every other caller stays flat and unchanged.

| id | Contents (source) | depth | Size |
| --- | --- | --- | --- |
| `car` | `part === 'car'`: car interior only, scenes.js 120-124 (back wall, gradient, ceiling strip, `stepGlow`, handrail, car floor). Transparent elsewhere. | 0.75 | 640x360 |
| `lobby` | `part === 'lobby'`: scenes.js 113-118 (wall gradient, stone panels, carpet), 126-127 (indicator housing and its dark well, **no number**), 129 (call button). The doorway is left unpainted: first `ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 320, 180); ctx.rect(98, 26, 124, 105); ctx.clip('evenodd')`, then draw lines 113-118, then `ctx.restore()`. The hole is art (98, 26, 124, 105), view x 196-444, y 52-262. Everything stays source-over, with no erasing. | 1 | 640x360 |
| `frame` | `part === 'frame'`: scenes.js 139 (two posts and the lintel). Then, outside `at2x`, the in-world marks of `finePass` for the elevator (storyboard.js 332-335) at alpha 0.5, with one change: the amber mark moves from y 28 to **y 45** (see Risks). | 1 | 640x360 |
| `marks` | Screen-space marks: `finePass` corner brackets (storyboard.js 355-359, alpha 0.65, signal colour) and `tell(ctx, 0)` (storyboard.js 95-101). | 0 | 640x360 |

To make this possible, give `finePass` a fifth argument `which`: `'world'` draws only the shot-specific marks (lines 323-354), `'frame'` only the corner brackets (355-359), undefined both (today).

No oversized layers. Every layer is 640x360, so the layer-sized `view` passed to `draw` and `animate` is the same as the shot view. The car's 2 px top and side margins inside the hole hide the car's parallax; checked below.

**Drop the 1.18 zoom.** This beat no longer goes through `framed()`. At 1.18 the floor indicator sits under the top letterbox (today you see the bottom half of "41"), and a 2.36x scale gives the 2x art uneven pixel widths. At zoom 1 the indicator (view y 12-44) and the whole doorway (y 36-272) both clear the letterbox and the caption top (y 280).

## 4. Camera

`camera: { from: { x: 0, y: -8, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: B.Motion.ease.inOut }` over the whole beat. This is a slow tilt down from the counter to the doors. Layer offsets: `lobby` and `frame` move 8 px to 0, `car` moves 6 px to 0, `marks` stays still. The car settles 2 px behind the doorway, enough to read as space behind the doors. At the start the top 8 rows are uncovered; they are under the 12 px letterbox.

Check: the car layer content spans view y 48-264. The hole spans 52-262 and sits at most 2 px lower than the car, so the hole always shows car content.

## 5. Animated elements

| What | Layer | Start-end (s) | Movement | Colours | Helper |
| --- | --- | --- | --- | --- | --- |
| Floor number | `lobby` | 0-1.05 | `floor = 38 + Math.min(3, Math.floor(t / 0.35))`: 38, 39 at 0.35, 40 at 0.70, 41 at 1.05. Hard cuts. Each frame redraw the well `k1(136, 9, 48, 10, P.ink, P.screenD, P.ink, P.ink2)`, then `X.text(String(floor), 160, 11, ..., { align: 'center' })` | `amber` | none |
| Up arrow | `lobby` | 0-1.05 | Glyph `'↑'` at art (140, 11) while `floor < 41`, then gone | `amberD` | `X.text` |
| Light spill | `lobby` | 1.25-2.4 | 8 rows at art y 133-140 (row k = 0..7). Each row runs from x `160 - (2 + slide) - k` to `160 + (2 + slide) + k`, 1 art px tall. Drawn only while `slide >= 1`. Tracks the doors, so it lands on whole art pixels. | `bone` at alpha 0.2 (rows 0-3), 0.1 (rows 4-7) | none |
| Doors | `lobby` | 1.25-2.15 | `open = 0.6 * ease.inOut((t - 1.25) / 0.9)`, `slide = Math.round(open * 62)` art px: 0 to 37 (74 view px). Full frame rate, whole art pixels. Draw with `SH.elevator(c, open, 41, 'doors')` = scenes.js 131-137. Before 1.25 the doors are closed (`open = 0`), which leaves today's 4 px lit seam. | as today | `ease.inOut` |
| Car flicker | `car` | 1.45-1.53 and 1.62-1.70 | One rect over the car, art (96, 24, 128, 108), seen through the parting doors. Two hard off-steps, nothing in between. | `ink` at alpha 0.2 | none |

The draw order inside `lobby.animate` is: number and arrow, spill, doors. Everything goes through `at2x(c, fn, 0)`. That is about 80 rectangles per frame.

## 6. Timeline

- 0.00-0.28: the scene opens on its fade from black. Steel doors closed, with a thin lit seam. The counter reads 38, with an arrow. The tilt starts.
- 0.35: 39. 0.70: 40. Caption "WEEK 1 · MONDAY" is typing (0.22-1.37).
- 1.05: 41. The arrow goes out and the chime sounds.
- 1.25: the doors begin to part. Light widens on the carpet threshold.
- 1.45 and 1.62: the car's light stutters twice through the gap.
- 2.15: the doors stop at 0.6 open.
- 2.15-2.4: hold. The tilt finishes at 2.4.

## 7. Final frame (p = 1)

Today's elevator at zoom 1 and today's door opening (0.6). It shows the full doorway, indicator "41" with no arrow, the lit empty car, a soft band of light on the carpet below the doors, today's glass lines, amber floor line and corner brackets, and the session 1 anomaly tear on the left panel. The bottom of the doorway and the light band sit just above the caption box. It reads as a complete still: a symmetrical, open door.

## 8. Variants

None. This beat exists only for session index 0: no act card, no story variant (`variant()` has no day 0 entry), and an interior with no window, so season does not matter. `tell` always draws on this day. Works with `opts.game` missing (nothing reads it).

## 9. Sound cues

- The beat's own `sfx: 'apartment'` (room tone) stays.
- `cues: [{ at: 1.05, sfx: 'elevator' }]`: the two-tone chime on arrival at 41.

Note for the coordinator: `office:<day>:wide` ("FORTY-FIRST FLOOR.") also plays `elevator`, about 4 s later in the same chain. I think the arrival chime is the hook of the first shot and is worth the repeat. If you disagree, drop this cue rather than the office one.

## 10. Risks and fallbacks

- **Tilt crawl on the dithered stone panels and the wall gradient.** It is 8 one-pixel steps over 2.4 s, the same kind of vertical tilt the shimmer gate accepted. Fallback: remove `camera` (a layered beat gets no preset). The doors carry the shot alone.
- **No zoom anywhere.** If the owner misses the tighter framing, do not bring back a zoom on this 2x art. Leave it wide.
- **Built: door clip.** The doors are clipped to art (90, 18, 140, 118) inside `elevator()` for all callers, flat path included, so they vanish behind the posts and every elevator picture matches. The outer steel panels no longer cover the wall. (Original risk text follows.)
- **Doors slide out over the stone panels.** Today's art draws open doors in front of the wall and behind the posts. In motion this may read as panels sliding over the wall. The default is to keep it (no restyle). Fallback, only if the strip shows it reading wrong: clip the `doors` draw to art x 90-230, so the doors vanish behind the posts. The final still then loses the outer steel panels; the coordinator rules.
- **finePass amber mark.** At zoom 1, the mark at y 28 strikes through the digits. Moving it to y 45 (under the indicator housing, where it sat at 1.18) is required for this beat. Making the change in `finePass` itself also fixes the same strike-through on today's `news:0:detail` beat. Report that side effect.
- **Continuity into `news:0:detail`.** The next beat is the same elevator at zoom 1 with the doors fully open, so the 0.3 s `cross` reads as the doors continuing to open. That is acceptable. The two beats now share a framing; noted for stage 3.
- The layer split is clean: none of the five parts overlaps another out of order, so composited at p = 1 it equals `SH.elevator(c, 0.6, 41)` at zoom 1, plus the spill.
