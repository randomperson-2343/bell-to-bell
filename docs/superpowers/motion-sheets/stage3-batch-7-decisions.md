# Stage 3, batch 7: decisions

Every room in `js/art/decisions.js`, the `room` and `face` beats of `B.Scenes.decision`, the speaker close-up, and the vote room where news and the weekend borrow it. Binding: the bible sections A and C, the stage 3 plan's constraints, and the batch 4/5 critique: one key movement per shot, about 20x20 px or larger and clearly contrasting; nothing that matters moving below screen y 272 while a caption is up; no key movement starting under the opening fade (0.28 s) or cross (0.3 s); no count stepping backwards and nothing relighting after it died across a cut; nothing that shifts layout as it grows; only the kit's three blink rates; no particles over static speckle. Notation as batch 6. Line numbers: `decisions.js` unless marked.

All rooms are tier 2; the speaker close-up is tier 1 (bible). No durations change, no beats are added. Every room's and face's final frame is today's picture. The aftermath popup (`DecisionArt.still`, its own canvas outside the player) is not touched and stays a still.

**Coordinates.** Rooms are native 640x360 on a 3 px grid: every number below is a screen pixel, and movers move in multiples of 3 px. The portrait is a 48x48 sprite painted at 5x from (40, 46): portrait numbers are sprite cells (screen = 40 + 5 x, 46 + 5 y).

## 0. Shared

### 0.1 Code changes (all optional; absent, every function draws exactly what it draws today)

1. `room(ctx, id, day, after, S, o)` (332): new optional `o`, passed through to the room functions:
   - `o.noGrain`: skips the 0.04 scanlines (347). Layered beats draw them in their own top layer `grain`, so covers and movers sit under the grain.
   - `o.part`: `'back'` / `'front'` for the four rooms split around an animate-only layer (office at night, clinic, shelter, lobby; definitions in their shots). `'back'` includes the ink rect (334); `'front'` does not. Undefined: whole room.
   - `o.skip`: one named prop left out of the cached picture because the animate draws it: `'chair'` (hearing, senator 3), `'count'` (vote board, the YEAS number), `'envelope'` (dinner), `'cells'` (treasury, the lit windows).
   - The flat `room()` stays drawable on the stub context of `tests.js` 1387: no option uses `drawImage`, `arc` or `getImageData`, and with `o` absent the code path is today's.
2. New `cityCells(x, y, w, h, day)` exported on `DecisionArt`: the lit night windows of one `cityWindow` (the arithmetic of 59-62: `bw`, `bh`, `bx`, `by`, and every `{ x: bx + j, y: by + k, w: 3, h: 3 }` with `(i * 5 + k + j + day) % 3 === 0`), in drawing order. `cityWindow` draws its lit windows from it (pixel-identical), and skips them when passed `skipCells` (from `o.skip === 'cells'`).
3. New `speakerSpace(ctx, fn)` in `decisions.js`: `save; translate(40, 46); scale(5, 5); fn(ctx); restore` (the transform of 352). `speaker()` uses it.
4. `portraits.js`: `sprite(name, o)` gains `o.closed` (cached under `name + ':closed'`), rasterised with `c.closed`: `eye(x)` then draws only `R(x, 19, 4, 1, line)` (no whites, pupil or row-18 lid, so the head colour shows); the screen avatar's eyes become `R(18, 17, 3, 1, accent)` and `R(27, 17, 3, 1, accent)` (a smile-closed `- -`). New `B.Portraits.paintEyes(ctx, name)`: draws, from the closed sprite, only the eye band: cells x 16..32, y 18..20 for every human cast member (glasses frames and glints at 16, 22, 26, 32 and row 18 come from the same raster, so Perry's glasses stay), x 18..29, y 15..17 for `screen` casts. One `fillRect` per opaque cell, at most 51.
5. New `roomLayers(id, day, after, S, phase)` and `faceLayers(id, day, S, name)` exported on `DecisionArt` (the builders, so `storyboard.js` uses the same ones for news and the weekend). They return `{ camera, cues, layers }` or null (flat).
6. `B.Scenes.decision` (357): the two beats are wrapped with `B.Motion.layered(Object.assign({}, beat, L))` when the builder returns `L`. Ids, durations, captions, `sfx` and transitions unchanged.

### 0.2 Beats

| Beat | Id | Dur | Transition | Caption (types 0.22 to) |
| --- | --- | --- | --- | --- |
| Room | `decision:<tag>:room` | 1.5 | fade | `who` = speaker · role, to 1.045 |
| Face | `decision:<tag>:face` | 2.1 | cross | the title, to 1.37 |

`tag = <id>:<floor(day / 5)>`, plus `:<pet name>` for `vetCheck`. Desk decisions (`afterDay`): c1 day 3 (`c1:0`), c3 day 10 (`c3:2`), c5 day 21 (`c5:4`), c6 day 23 (`c6:4`), c7 day 24 (`c7:4`), c8 day 39 (`c8:7`), c9 day 42 (`c9:8`), c10 day 44 (`c10:8`). Life beats (`lifeBeat`, each only when its `when` holds): adopt 4 (`adopt:0`), dentist 8 (`dentist:1`), rentHike 11 (`rentHike:2`), vetCheck 14, dadBill 18 (`dadBill:3`), toothache 25 (`toothache:5`), vetER 27 (`vetER:5`), advance 31 (`advance:6`), perry 36 (`perry:7`), pension 41 (`pension:8`). Seasons: days 0-10 autumn, 11-31 grey, 32-45 winter. `room` is always called with `after = false` from the decision scene.

Borrowed uses (Shot 4): `news:11:establish` (hearing, `c3`, after true), `news:38:establish`, `news:41:THE BILL PASSES · 218 YEAS:establish` (vote, `c8`), `weekend:<key>:whip` (day 39). Their holds (`news:38:hold`, `news:41:…:hold`) stay flat (the board filling is an event). The weekend `:317` racks and `lastLight` are batches 8 and 9.

### 0.3 Common room pattern

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `room` | `room(c, id, day, after, S, { noGrain: true, skip })`, or `{ part: 'back' }` for split rooms; `animate` per shot | 1 | 640x360 |
| `mid` (split rooms only) | animate-only (`draw() {}`) | 1 | 640x360 |
| `front` (split rooms only) | `room(c, id, day, after, S, { noGrain: true, part: 'front' })`; `animate` per shot | 1 | 640x360 |
| `grain` | `X.scanlines(c, 0, 0, 640, 360, P.ink, 0.04)` | 1 | 640x360 |
| `marks` (news establishes only) | `finePass(c, day, r, 'establish'); tell(c, day)` | 0 | 640x360 |

Camera on every room beat and borrowed establish: tilt `{ from: { x: 0, y: -6, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: M.ease.inOut }` (C4 a). Every key movement starts at 0.30 or later and sits above y 272.

### 0.4 The face beat (speaker close-up, every decision)

**Intent.** The person asking steps into frame over their dimmed room. Key movement: **the speaker rising 12 px into frame**; life: one blink.

| id | Contents | depth | Size |
| --- | --- | --- | --- |
| `room` | `room(c, id, day, false, S); dim(c, 0.35)` (today's lines 365), cached; no animate | 0.3 | 640x360 |
| `speaker` | `speaker(c, name, 40)` cached; `animate`: blink | 1 | 640x360 |

**Camera.** `K.rise(12, 2.1, 0.30, 0.80)`: the portrait lifts 12 px into place, the room moves 4 px (`round(12 * 0.3)`), both ending at 0.

**Animated element.** Blink, `t` in [1.55, 1.67) only (after the caption ends at 1.37): `speakerSpace(g, (s) => B.Portraits.paintEyes(s, name))`. Screen region human x 120-205, y 136-151 (two 20x5 px eyes going to a 20x5 lid line); landlord x 130-190, y 121-136. Cost 51 rects. Per character: every human cast member uses the human band (eyes at cells 17 and 27 in every portrait); Perry keeps his glasses; the dentist's mask is below the band; the landlord (`screen`) closes his smiley's eyes to two lines.

**Timeline.** Cross from the room (0.30 s) while the speaker rises 0.30-0.80; title types to 1.37; blink at 1.55; still to 2.10.

**Final frame.** Today's exactly. **Variants.** Speaker without a portrait (`speaker()` false; no story speaker today, only tests): beat stays flat, as today. Room variants are the room's own (cached). **Sound.** None (own `broadcast`). **Risks.** The rise reveals 12 rows under the portrait's shoulders (behind the caption box) and 4 rows of the room under the top letterbox: both hidden. Fallback: no blink (the rise alone).

---

## Shot 1: office by day (c1, c6)

1. **Intent.** Kroll's corner office. Key movement: **Kroll's desk screen switching on** (51x33 px, dark to lit with its four bars), one screen event.
2. **Duration.** Room 1.5 s, unchanged.
3. **Layers.** 0.3 single (`room`, `grain`).
4. **Camera.** Tilt.
5. **Animated elements** (`room`): `K.crt(g, 564, 165, 51, 33, t, { mode: 'on', at: 0.45, bg: P.screenD })`: screen dark until 0.45, the 2 px phosphor line, the bone flare, then the cached lit screen (bars at 570, 171-192). Screen y 165-198. 2-3 rects. The bible's weather behind the blinds is not built: the slats are drawn over the city at 0.55 alpha inside `cityWindow`, so falling weather would need a second split; one key is enough.
6. **Timeline.** Fade up; Kroll's screen off; it comes on at 0.45; still.
7. **Final frame.** Today's.
8. **Variants.** c1 day 3 autumn (static leaves in the window, cached); c6 day 23 grey (nothing in the window). Popup still unchanged.
9. **Sound.** None (own `room`).
10. **Risks.** None.

## Shot 2: office at night (c7)

1. **Intent.** After dark, the addendum on the desk. Key movement: **the desk lamp clicking on in two hard steps**, the lamp (30x30 px) lighting and its amber rings spreading over the window and the wall.
2. **Duration.** Unchanged.
3. **Layers.** Split: `room` = `part: 'back'` = office lines 78-93 (gradient, panels, window, bookshelf, chart, carpet); `mid`; `front` = `part: 'front'` = lines 96-108 (desk, screen, nameplate, lamp, papers, the crimson mark); the glow (94) is in neither (drawn by `mid`); `grain`.
4. **Camera.** Tilt.
5. **Animated elements.**
   - `mid`: from 0.45 `glow(g, 402, 184, [51], P.amber, 0.07)`; from 0.60 `glow(g, 402, 184, [150, 96], P.amber, 0.07)` as well. The three rings together are exactly line 94 (`glow` is exported for this as `DecisionArt.glow`). Rings above the desk: y 34-207.
   - `front`: before 0.45, the lamp off: `blit(g, LAMP_OFF, 381, 150)` with `LAMP_OFF = LAMP.map((r) => r.replace(/a/g, 'A'))` (amber to amberD, same opaque cells). Lamp y 150-180.
   - Cost: 181 ring rects + 40 = 221.
6. **Timeline.** Fade up on the dark office; 0.45 click: the lamp and the inner ring; 0.60 the full pool; still.
7. **Final frame.** Today's.
8. **Variants.** Day 24, grey; city lights in the window cached.
9. **Sound.** `cues: [{ at: 0.45, sfx: 'click' }]`.
10. **Risks.** The rings are 0.07 alpha: the lamp itself carries the click; the pool is the second step.

## Shot 3: hearing (c3; also `news:11:establish`)

1. **Intent.** The committee in session. Key movement: **the chair (senator 3, 24x21 px) leaning to his microphone** and back. Life: the LIVE light blinks.
2. **Duration.** Room 1.5 s; news establish 1.7 s.
3. **Layers.** 0.3 single, `skip: 'chair'` (senator `i = 3` of the loop at 122-126 not blitted; his mic still drawn); news adds `marks`.
4. **Camera.** Tilt.
5. **Animated elements** (`room`):
   - Chair: `blit(g, SENATOR_3, 399 + dx, 144 + dy)` every frame (`SENATOR_3` = the row map of line 124 with `i = 3`, exported as `DecisionArt.senator(i)` and used by line 124), `[dx, dy] = t >= 0.50 && t < 1.10 ? [3, 6] : [0, 0]`. Screen y 144-171; he never reaches his mic (435) or the board (426, y ≤ 135).
   - LIVE: `K.blink(g, 504, 70, 37, 9, t, { on: null, off: P.ink, period: 0.5, duty: 0.6, end: dur })` from 0.30: the red dot and the word covered on the panel's flat ink interior in the off phase. Screen (504, 70)-(541, 79).
   - Cost: about 50 + 1.
6. **Timeline.** Fade; LIVE pulsing; 0.50 the chair leans in, 1.10 back.
7. **Final frame.** Today's.
8. **Variants.** Day 10 autumn (room has no window). News day 11: `after` true is ignored by `hearing`; date caption to 1.155.
9. **Sound.** None.
10. **Risks.** A 3x6 px lean on a 24x21 sprite: if it does not read, `[6, 6]`.

## Shot 4: vote (c8; `news:38`, `news:41` bill passed; the whip, day 39)

1. **Intent.** The chamber the night of the vote. Key movement: **the tally board filling line by line while YEAS counts up to 214**; the last line (the verdict) lands as the caption finishes.
2. **Duration.** Room 1.5 s (caption to 1.045); news establish 1.7 s (to 1.155); whip 1.6 s (to 1.10).
3. **Layers.** 0.3 single, `skip: 'count'` (the `214` of 135 left out of the cache; drawn whole every frame); news adds `marks`.
4. **Camera.** Tilt.
5. **Animated elements** (`room`; board interior flat ink x 432-611, y 36-128):

| What | Start-end (s) | Movement | Colours | Kit |
| --- | --- | --- | --- | --- |
| Line covers | 0 to 0.40 / 1.00 / 1.10 | `X.rect(g, 441, 66, 168, 12, P.ink)` until 0.40 (YEAS); `(441, 82, 168, 12)` until 1.00 (SHORT 4, or NEEDED 218 when passed); `(441, 105, 168, 12)` until 1.10 (NEEDED 218, or PASSED). | `ink` | cover |
| YEAS | 0.40-0.95 | `K.tally(g, 603, 69, t, { from: 180, to: 214, at: 0.40, dur: 0.55, fps: 15, fmt: String, col: P.jade, shadow: P.ink, align: 'right' })`: always three digits, right edge fixed; ends on `R.text`'s exact pixels. | `jade` | tally |

   Screen y 66-117. Cost 3 + about 76.
6. **Timeline.** Fade (or cut, whip) on the board with only its title; 0.40 YEAS appears and counts; 1.00 SHORT 4; 1.10 NEEDED 218. Verdict at 1.10: 0.055 s after the room caption, 0 after the whip's, 0.055 before the news date's.
7. **Final frame.** Today's in every use.
8. **Variants.** Decision c8 and the whip: not passed (`after` false or absent). News 38: not passed. News 41 bill passed: lines NEEDED 218 / PASSED (the board's own art). Holds of 38 and 41: flat. Day 39-41 winter: no window.
9. **Sound.** None (own `room`, `apartment`).
10. **Risks.** Art note for the coordinator, not changed here: the passed board reads YEAS 214 above NEEDED 218 and PASSED, while the news caption says 218 yeas.

## Shot 5: treasury (c5)

1. **Intent.** Treasury at 2:14 on a Sunday, every light on. Key movement: **the five tall windows lighting up one after another, left to right** (each 54x138 px window's floors coming on at once).
2. **Duration.** Unchanged.
3. **Layers.** 0.3 single, `skip: 'cells'`.
4. **Camera.** Tilt.
5. **Animated elements** (`room`):
   - Windows: for `i = 0..4`, `K.lamps(g, DecisionArt.cityCells(246 + 78 i, 30, 54, 138, day + i), t, { at: 0.40 + 0.12 i, step: 0, on: P.amber })`. Drawn after the cached glow: amber over amber is amber, so the lit pixels equal the art's (the grain is above). Screen y 30-168. About 60 rects.
   - Colon: `K.blink(g, 58, 60, 6, 12, t, { on: null, off: P.bone, period: 1.0, duty: 0.5, end: dur })`: the colon of `big('2:14', 65, 57, …, 2, 'center')` and its shadow (glyph at art x 28, scale 2, rows 30-35) covered on the clock face's flat bone. Life only. 1 rect.
6. **Timeline.** Fade on the dark windows; 0.40-0.88 they light window by window; the colon ticks at standby rate; on at the end.
7. **Final frame.** Today's.
8. **Variants.** Day 21 grey: `R.weather` draws nothing over the towers, so the cells sit on flat ink2. (On a winter day the speckle would be cached over the unlit towers and the cells drawn above it; no story day reaches it.)
9. **Sound.** None.
10. **Risks.** Verify the colon rect against `X.textWidth` in the build (the arithmetic of `big` at 48).

## Shot 6: stairwell (c9)

1. **Intent.** Imani waits on forty-one. Key movement: **the EXIT sign stuttering** (102x42 px).
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single. 4. **Camera.** Tilt.
5. **Animated elements** (`room`): `K.flicker(g, 54, 36, 102, 42, 'decision:c9:exit', t, { spans: S, col: P.ink, a: 0.45 })` and its spill `K.flicker(g, 30, 6, 150, 102, …, { spans: S, col: P.ink, a: 0.10 })`, `S = [[0.45, 0.50], [0.56, 0.74], [0.80, 0.84], [1.00, 1.06]]`. Screen y 6-108. 2 rects.
6. **Timeline.** Fade; four stutters 0.45-1.06; lit.
7. **Final frame.** Today's. 8. **Variants.** Day 42 winter; no window. 9. **Sound.** None. 10. **Risks.** None.

## Shot 7: racks (c10)

1. **Intent.** The shared stack, running. Key movement: **a pulse running across the front row of racks**, one rack (54x222 px) at a time.
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single. 4. **Camera.** Tilt.
5. **Animated elements** (`room`): front rack `i = 0..6` (`r = 1`: x `177 + 69 i`, y 30, w 54, h 222; strips `(x + 6, 30 + s, 42, 6)` for `s = 9; s < 213; s += 12`): during `[0.40 + 0.09 i, 0.52 + 0.09 i)` the rack's 17 strips get `P.phosphorD` at alpha 0.45 (one save/restore, 17 rects). Ends 1.06. Screen y 39-243.
6. **Timeline.** Fade; the pulse runs left to right 0.40-1.06.
7. **Final frame.** Today's.
8. **Variants.** The decision room is never dark (`after` false). The dark rack room (`after`, `pulledPlug`) is batch 8 (weekend 3:17) and batch 9 (`lastLight`) and gets no pulse.
9. **Sound.** None. 10. **Risks.** None.

## Shot 8: lobby (rentHike)

1. **Intent.** The building's model congratulates you. Key movement: **the management screen's smiley blinking twice** (two 21x21 eyes closing to lines).
2. **Duration.** Unchanged.
3. **Layers.** Split: `room` = `part: 'back'` = lines 205-215 (wall, mailboxes, elevator, screen, glow) without the eyes; `mid`; `front` = lines 217-223 (mouth, screen scanlines, stand, text, floor); `grain`.
4. **Camera.** Tilt.
5. **Animated elements** (`mid`): open eyes `cel(g, 147, 93, 21, 21, P.phosphor, P.white, P.phosphorD)` and `(216, 93, …)` (line 216, exported as `DecisionArt.lobbyEyes(g, closed)` and used by `lobby`); closed during `[0.55, 0.67)` and `[0.80, 0.92)`: `X.rect(g, 147, 105, 21, 3, P.phosphor)` and `(216, 105, 21, 3)`. Two single events, not a repeating blink. Screen y 93-114. 10 rects.
6. **Timeline.** Fade; the smiley blinks twice; holds its smile.
7. **Final frame.** Today's. 8. **Variants.** Day 11 grey; no window. The landlord's portrait blinks the same way on the face beat (0.4).
9. **Sound.** None. 10. **Risks.** The screen's own 0.25 scanlines are in `front`, over the eyes, as in the flat order.

## Shot 9: dinner (advance)

1. **Intent.** Kroll pays for dinner and slides an $8,000 advance across. Key movement: **the envelope sliding 36 px across the tablecloth to you** (114x27 px). The bible's candle and sconce flicker is replaced: the flame is 6x9 px and a sconce stutter reads as a fault; the envelope is the story.
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single, `skip: 'envelope'` (238 left out). 4. **Camera.** Tilt.
5. **Animated elements** (`room`): every frame, `x = 246 + 3 * round(12 * (1 - M.ease.out(K.span(t, 0.40, 0.85))))`; `cel(g, x, 219, 114, 27, P.bone, P.white, P.plasticD); R.text(g, '$8,000', x + 57, 229, P.jadeD, 'center')` (line 238 with `x`). It travels over the flat bone tablecloth only (x 246-396, y 219-246; clear of the glasses, candle and plate). Cost about 195 rects (the text with its shadow, every frame, because it moves).
6. **Timeline.** Fade with the envelope on Kroll's side; 0.40-0.85 it slides to you; still.
7. **Final frame.** Today's. 8. **Variants.** Day 31 grey; no window. 9. **Sound.** None. 10. **Risks.** Bone on bone: the ink2 outline carries it. Fallback: flicker the candle flame region (420, 147, 12, 51) at ink 0.3, seeded, as life only.

## Shot 10: kitchen with a phone (dadBill, pension)

1. **Intent.** Mom calling after the close. Key movement: **the phone ringing: the handset (78x45 px) flashing twice at badge rate**.
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single (an overlay: no split). 4. **Camera.** Tilt.
5. **Animated elements** (`room`): `K.flicker(g, 477, 165, 78, 45, 'decision:phone', t, { spans: [[0.40, 0.60], [0.90, 1.10]], col: P.phosphor, a: 0.30 })`: badge period 0.5 s with 0.2 s lit; ends as the art. Screen y 165-210. 1 rect.
6. **Timeline.** Fade; ring at 0.40 and 0.90.
7. **Final frame.** Today's.
8. **Variants.** dadBill day 18 grey (`MOM · CALLING`, the $14,200 bill); pension day 41 winter (`MOM · 22:40`, the Riverbend letter; static snow speckle in the window, cached, no particles).
9. **Sound.** `cues: [{ at: 0.40, sfx: 'ring' }]`.
10. **Risks.** None.

## Shot 11: kitchen with the postcard (vetCheck)

1. **Intent.** The vet's reminder on the table. Key movement: **the card's cross icon blinking like a reminder** (the 30x30 sky icon's crimson cross, 18x18).
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single. 4. **Camera.** Tilt.
5. **Animated elements** (`room`): `K.blink(g, 327, 177, 18, 18, t, { on: null, off: P.sky, period: 0.5, duty: 0.6, end: dur })` from 0.30: the cross covered on the icon's flat sky interior (324-347, 174-197) in the off phase; on at the end. 1 rect. The bible's windows going out and steam are not built: the windows are 3x3 cells (under the size rule) and going out would have to stay out on the face beat; steam motes are 1-2 px.
6. **Timeline.** Fade; the cross pulses from 0.30; lit at the end.
7. **Final frame.** Today's. 8. **Variants.** Day 14 grey; pet name on the card (cached; part of the tag). 9. **Sound.** None. 10. **Risks.** Small for a key (18x18); fallback: blink the whole icon (321, 171, 30, 30) to the card's bone.

## Shot 12: voicemail (perry, dentist)

1. **Intent.** A voicemail playing in the dark. Key movement: **playback lighting the waveform bars 3 to 8** (six bars up to 36 px tall, a 36x36 area). Life: the play button blinks.
2. **Duration.** Unchanged. 3. **Layers.** 0.3 single. 4. **Camera.** Tilt.
5. **Animated elements** (`room`):
   - Bars: cells for `i = 3..8` exactly as 277 (`x 249 + 6 i`, `y 150 - round(h / 2 / 3) * 3`, `w 3`, `h round(h / 3) * 3`, `h = 6 + ((i * 37 + 11) % 30)`), from the new `DecisionArt.waveBars()` that 277 also uses; `K.lamps(g, cells, t, { at: 0.40, step: 0.10, on: P.phosphor, off: P.slate2 })`. Screen x 267-300, y 135-165.
   - Play: `K.blink(g, 315, 210, 9, 18, t, { on: null, off: P.phosphorD, period: 0.5, duty: 0.6, end: dur })` from 0.30 (the triangle covered on the button's flat phosphorD face).
   - 7 rects.
6. **Timeline.** Fade with three bars lit; 0.40-0.90 playback lights six more; the button pulses.
7. **Final frame.** Today's. 8. **Variants.** Perry day 36 (`PERRY`, 0:41); dentist day 8 (`DENTIST`, 0:22): names cached. 9. **Sound.** None. 10. **Risks.** None.

## Shot 13: shelter (adopt)

1. **Intent.** The two still at the shelter. Key movement: **the light over the two empty kennels stuttering** (84x132 px each). Life: the cat breathes once, the dog wags.
2. **Duration.** Unchanged.
3. **Layers.** Split: `room` = `part: 'back'` = the room without the kennel meshes (297-298); `mid`; `front` = `part: 'front'` = only the four meshes; `grain`.
4. **Camera.** Tilt.
5. **Animated elements.**
   - `front` animate (key): kennels 0 and 3, interiors `(231, 108, 84, 132)` and `(537, 108, 84, 132)`: `K.flicker(…, { spans: [[0.45, 0.52], [0.60, 0.78], [0.86, 0.90]], col: P.ink, a: 0.35 })`, kennel 3 offset by +0.12 s. Screen y 108-240.
   - `mid` (life): cat (kennel 1; blit at `x + 48 - round(sp.w * 3 / 2)`, `y + 132 - sp.h * 3` as 294) breathes during [0.70, 1.50): its upper 13 rows drawn 3 px higher (the weekend `breathSprite` recipe); dog (kennel 2): during [0.80, 1.30), at 6 poses a second, odd poses cover the tail cells (sprite columns 16-18, rows 8-11, on the kennel's flat slate) and redraw them one cell right.
   - Cost about 165 rects.
6. **Timeline.** Fade; the empty kennels' light stutters 0.45-1.02; the cat breathes, the dog wags.
7. **Final frame.** Today's. 8. **Variants.** Day 4 autumn; no window. Pets are fixed boy sprites (cached). 9. **Sound.** None.
10. **Risks.** The pets' life is under the size rule; it is life, not the key. Fallback: drop the pets' life, keep the flicker.

## Shot 14: clinic (toothache, vetER)

1. **Intent.** After hours. Key movement: **the exam light switching on in two hard steps**: the dentist's lamp (48x27 px) and its white rings; at the vet, the ceiling tube (120x12 px) and its rings.
2. **Duration.** Unchanged.
3. **Layers.** Split around the animated glow: dentist `back` = 307-322 without the lamp glow `glow(468, 120, [90, 54], …)`, `front` = 323-329; vet `back` = 307-309 (gradient, floor) plus the tube cel of 310, without the ceiling glow `glow(318, 18, [180, 120], …)`, `front` = 311-329 (the dentist keeps its ceiling glow in `back`); `mid`; `grain`.
4. **Camera.** Tilt.
5. **Animated elements.**
   - Off state (in `room` animate, before 0.45): dentist lamp `cel(g, 444, 72, 48, 27, P.putty, P.putty2, P.plasticD)`; vet tube `cel(g, 258, 12, 120, 12, P.grey, P.grey2, P.slate2)`.
   - `mid`: dentist ring 54 from 0.45, ring 90 from 0.60 (`glow(…, P.white, 0.08)`); vet ring 120 from 0.45, ring 180 from 0.60 (`P.white, 0.05`). Screen y 12-210.
   - Cost: dentist about 101, vet about 205.
6. **Timeline.** Fade on the unlit lamp; click 0.45, full light 0.60.
7. **Final frame.** Today's. 8. **Variants.** toothache day 25 (dentist, $1,400); vetER day 27 (vet, $900, the cat poster). 9. **Sound.** `cues: [{ at: 0.45, sfx: 'click' }]`. 10. **Risks.** The vet's 0.05 rings are faint: the tube carries it.

---

## Budget summary

Worst cases per beat (rects a frame): vote 80, dinner 195, office night 221, vet clinic 205, shelter 165, treasury 61, hearing 51, face 51, others under 20. All under 400.
