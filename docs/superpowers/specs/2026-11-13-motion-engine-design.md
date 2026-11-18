# Cutscene motion engine: design

Date: 2026-11-13
Status: awaiting approval
Part 1 of 3 in the graphical overhaul (motion engine, then pixel art, then interface).

## Intent

Bell to Bell's cutscenes are a slideshow. Each shot is drawn once, saved as a
still and held for one to two seconds. Only the closing bell moves. The owner
wants the game to look and move like a polished pixel art game, and agreed the
first step is going from stills to active animation.

This project gives the cutscene player real motion and reworks the shots to
use it. Art quality and the interface are separate, later projects.

## Goals

1. Every cutscene shot has visible motion: at minimum a moving camera and a
   real transition into the next shot.
2. Important shots have depth and life inside the picture: layers that drift
   at different speeds, and things that move (weather, screens, people, doors,
   paper, numbers).
3. It runs smoothly on phones.
4. The owner sees a three-shot pilot and approves the feel before the other
   shots are reworked.

## Non-goals

- Redrawing art in a new style, or raising its detail. Shots are split into
  layers and gain moving elements, drawn with the existing toolkit and palette.
- Unifying the mixed resolutions (320x180 doubled, 640x360, 480x270).
- Any change to the trading interface, menus, popups or CSS animation.
- Image files. Art stays code-drawn.
- Story, caption or sound content changes.
- Merging `scenes.js`, `rhythm.js` and `storyboard.js` into one file.

## Anti-goals

These would make the project a failure even if it technically works.

- Cutscenes that take noticeably longer to sit through.
- Smooth, floaty, "web animation" movement that fights the pixel art.
  Movement lands on whole pixels and may step at a lower frame rate on purpose.
- Shimmering or crawling pixels during camera moves.
- Stutter on phones, or a phone tab killed for memory.
- Motion that cannot be turned off.

## Constraints (from the existing code)

- `js/art/cinematic.js` plays a list of beats. A beat is
  `{ id, view, dur, draw(ctx, view, p, opts), line, sfx, transition, cache, informative }`.
  With `cache: true` (the default) `draw` runs once at `p = 1` and the picture
  is reused. `cache: false` redraws every frame. `drawDynamic` is an existing,
  unused hook for a per-frame overlay.
- Shot art is expensive to draw (thousands of 1px rectangles, dither loops),
  which is why caching exists. Per-frame full redraws are not acceptable.
- `js/tests/render-run.js`, `js/tests/export-storyboard.js`, `browser-run.js`
  and `tests.js` call `beat.draw(ctx, view, 1, opts)` directly and expect a
  complete, final picture. Unique-frame counts are asserted (41+ news,
  22 endings, 9 weekends, 38+ establishing groups).
- Beat ids are cache keys. Tests assert that story variants do not share ids.
- Settings already exist: Cinematics `full | short | off` and Screen effects
  `full | reduced | off` (`B.Settings.motion()` is true only for `full`).
  The browser's `prefers-reduced-motion` is honoured in CSS only today; the
  engine must check it itself with `matchMedia`.
- `R.beat` in `rhythm.js` stamps `transition: 'cut'` on every beat, so the
  player's own default never applies. Scene-opening beats set `fade`.
- Some older shot functions in `scenes.js` (elevator doors, trading floor)
  already take a progress value but are cached at `p = 1`, so that animation
  never plays. `beat.cacheAt` picks the cached pose and stays honoured.
- `cinematic.js` needs a real DOM, so the Node test loader skips it. The test
  loader also stubs Settings with motion off.
- No build step, no dependencies. Plain script files loaded in order from
  `index.html`, `tests.html` and `js/tests/harness.js`.
- All colours come from the locked palette in `js/art/palette.js`.

## Approaches considered

**A. Moving camera over the existing stills.** Each shot stays one flat
picture; the camera pans or pushes in and shots blend with real transitions.
Cheap and covers every shot at once, but nothing inside the picture moves.

**B. Layered shots with moving parts.** Each shot is split into cached layers
that drift at different speeds, with per-frame moving elements between them,
under the same camera. Looks like a real pixel art cutscene and stays fast
because layers are drawn once. Each shot must be reworked by hand.

**C. Redraw every shot every frame.** Maximum freedom, but the art is too
expensive to draw 60 times a second on a phone. Ruled out.

**Chosen: A and B combined, picked by the owner.** One engine supports both.
Camera and transitions switch on for every shot first, so the whole game
improves immediately. Shots are then reworked into layers in order of story
importance, after a three-shot pilot.

## Design

### 1. Engine

A new file, `js/art/motion.js`, loaded after `pixel.js`. `cinematic.js` is
extended to use it. Every addition to a beat is optional, so an untouched beat
plays exactly as it does today plus the default camera and transition.

**Camera.** A beat may carry `camera: { from, to, ease }` where `from` and `to`
are `{ x, y, zoom }`. The camera transforms the shot picture only. Letterbox
bars and the caption box are drawn afterwards and never move. Offsets are
rounded to whole virtual pixels.

**Default camera.** A beat with no `camera` gets a gentle preset (slow push in,
slow drift left or right, slow pull back) chosen from its id, so the same shot
always moves the same way. A flat still has no picture beyond its edges, so
presets use a small zoom (about 1.04 to 1.08) to make room to move. Beats
shorter than one second and `hold` beats get no camera move.

The default camera is the first thing built and is judged on three detailed
frames before anything else depends on it, because zooming a flat pixel image
can make pixels crawl. The fallbacks are fixed in advance, in this order:
(1) hold one fixed zoom and pan only; (2) if that still crawls, flat stills get
no default camera, stage 1 delivers transitions only, and camera movement
arrives with layered shots, whose oversized layers pan with no zoom. Cached
pictures stay at 1x in every case. There is no supersampled cache.

**Transitions.** `transition` gains `cross` (dithered dissolve using the Bayer
matrix already in `pixel.js`, so it stays on palette and looks like pixel art,
not an opacity fade), `wipe`, and `push` (old shot slides out as the new one
slides in). `cut` and `fade` keep working. The outgoing picture is the last
drawn frame of the previous beat.

`R.beat` stops stamping `cut`. A beat that names no transition gets `fade`
from black if it opens a scene, `cut` if it is a `hold` beat (same picture,
darkened), and `cross` otherwise. A beat can still ask for `cut` by name.

A transition plays inside the start of the incoming beat and adds no time:
about 0.3 s for `cross`, 0.35 s for `wipe` and `push`. Each scene (`play()`
call) still opens with a fade from black; nothing blends across the game
screens that sit between scenes.

**Layers.** A beat may carry `layers: [{ id, depth, draw(ctx, view, opts), animate }]`
in back-to-front order.
- `draw` paints the layer once onto its own transparent canvas, cached under
  `beat.id + layer.id`.
- `depth` scales how far the layer moves with the camera: 0 is pinned (sky),
  1 moves with the camera, above 1 moves more (foreground).
- A layer may be wider or taller than the view, so it can pan with no zoom.
- `animate(ctx, view, t, p, opts)` is optional and runs every frame on top of
  that layer for cheap moving elements. `t` is seconds into the beat, `p` is
  0 to 1.

**Compatibility rule.** A layered beat still has a `draw(ctx, view, p, opts)`.
The engine supplies it: all layers and their `animate` steps, composited with
no camera at the given `p`. So `draw(ctx, view, 1, opts)` still returns the
complete final picture, and the render tests, the storyboard exporter, short
mode and reduced motion keep working without knowing about layers.

**Motion helpers** in `B.Motion`, all deterministic (same time in, same
picture out, seeded from the beat id, never `Math.random`):
- easing functions, plus `stepped(p, n)` to quantise movement into n poses
- `tween` and `keyframes` for values over time
- sprite frame cycling for walk and blink loops
- particles: snow, rain, dust, paper
- screen flicker and scanline roll
- counting numbers and typed text
- timed sound cues: `cues: [{ at, sfx }]` on a beat, fired once each, using
  the existing `B.SFX` names

**Pixel discipline.** All positions round to whole virtual pixels. Motion may
deliberately run at 12 or 15 poses a second ("on twos") while the camera runs
at full rate. Zoom moves must not visibly shimmer; if one does in review, it is
replaced by a pan over an oversized layer or by a stepped zoom.

**Memory.** The cache changes from "40 frames" to a byte budget of about
36 MB (the same as today's 40 full frames), evicting oldest first, and is
cleared when a scene chain ends. It stays a `Map` named `frameCache`, because
`browser-run.js` reads its size.

**Turning it off.** When Screen effects is not `full`, or the browser asks for
reduced motion (a new `matchMedia` check in the engine), the engine plays the shot as today: final still, no camera,
no `animate`, `cross` and `wipe` and `push` fall back to `fade`. Cinematics
`short` shows the informative beat as a still with a fade. `off` is unchanged.

**Timing.** Stage 1 changes no durations. A reworked shot may run up to 50%
longer than its current beat when the movement needs it, but a full morning
chain (news, phone, office) may grow by no more than 3 seconds in total.
Tap or key to skip is unchanged.

### 2. Rollout

**Stage 1: every shot.** Default camera and transitions on all beats in all
seven scenes (news, phone, office, close, weekend, decision, ending). No shot
art changes.

**Stage 2: pilot, three shots reworked into layers.**
1. Session 1 opening, the elevator: doors open, floor counter climbs, light
   spills, camera pushes in. First impression of the game.
   This is the beat `news:0:establish` built in `storyboard.js`.
2. The closing bell: floor behind, bell in front, the existing swing kept,
   with the two special cases (slow swing on session 43, silent from 45).
   Seen every session. This is the first beat of `B.Scenes.close` in
   `storyboard.js`. Its swing stays driven by `p` exactly as today, and
   `draw` at `p = 1` shows the same pose as today, so its test hash holds.
3. The weekend apartment on Saturday: weather outside the window by season,
   lamp and phone glow, the pet breathing, slight parallax between wall,
   furniture and foreground. Seen nine times, once a week. This is the `sat`
   beat of `B.Scenes.weekend` (`apartmentShot` in `storyboard.js`), for every
   housing tier and pet state. Weather is a moving element over the window,
   not separate art per season.

**Checkpoint.** The owner is sent short screen recordings of the pilot and a
playable branch. Nothing in stage 3 starts until they approve the feel.

**Stage 3: the rest, in this order.**
1. Act cards and the remaining opening shots of each act
2. Close chain: report card, Sqwak breaking insert
3. Endings (all 22 share `endingWorld` and `lastLight`)
4. Decision rooms and the speaker close-up
5. Weekend apartment, including the pet
6. Document inserts: stamp lands, marker circle draws on, numbers tick,
   lamps light on the vote board
7. Story tableaux
8. Routine places: subway, lobby, kitchen, street, rideshare, platform,
   breakroom, trading floor, skyline
9. Phone and office frames

### 3. Team and workflow

- **Fable** coordinates, owns this design, checks every result.
- **Haiku** reviews the cutscene code before work starts (a map of what draws
  what, and the risks) and reviews every change after it lands.
- **Opus** writes a motion sheet for each shot before it is built: what moves,
  in what order, how fast, with which easing and camera, and what the shot
  should feel like. Opus then critiques frame strips of the built shot.
- **Sonnet** builds the engine and the shots from the motion sheets.

### 4. Verification

- All existing test runners keep passing, with their thresholds unchanged.
- The pure helpers in `motion.js` (easing, keyframes, particles) load without
  a DOM and get unit tests in `js/tests/tests.js`.
- A new Chromium runner in the style of `browser-run.js`,
  `js/tests/motion-run.js`, with motion switched on:
  - every beat's `draw` at `p = 1` matches the composited layers
  - a moving beat's picture at `p = 0` differs from `p = 1`
  - the same `t` always gives the same picture
  - with motion off, every frame of a beat is identical
  - cache stays inside its byte budget across a full 46-session run
- Performance, measured in Chromium with 4x CPU slowdown at a phone viewport:
  average frame draw under 8 ms, no frame over 33 ms, for every reworked shot.
- Each reworked shot gets a frame strip (six frames across its duration) saved
  under `qa/evidence/motion/` for design review.

## Decided by the owner

- Go from stills to active animation.
- Motion engine before art and interface.
- The combined approach: camera and transitions everywhere, then layered
  shots by story importance, after a three-shot pilot.
- Team roles: Fable, Opus, Sonnet, Haiku as above.

## Calls made by Fable (correct any of these)

- Which three shots form the pilot.
- The stage 3 order.
- Dithered dissolve as the default transition.
- Whole-pixel movement and optional low-pose-rate animation.
- The timing limits (50% per shot, 3 seconds per morning chain).
- Motion follows the existing Screen effects setting rather than a new one.
- Pilot review by screen recording plus a playable branch.
- Opus designs motion through written motion sheets and frame-strip critique.

## Left to the builder

- Internal structure of `motion.js` and how `cinematic.js` calls it.
- Exact preset values, easing curves and particle counts, within the rules
  above.
- How each existing shot function is split into layers.
- How frame strips and recordings are captured.
