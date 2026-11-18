# Cutscene Motion Engine and Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the cutscene player a camera, real transitions and layered animated shots, switch camera and transitions on for every shot, and rework three pilot shots for the owner to approve.

**Architecture:** A new DOM-free file `js/art/motion.js` (`B.Motion`) holds the maths, presets, transition painter and the layered-beat wrapper. `js/art/cinematic.js` stays the only player and calls into it. Every new beat field is optional; a layered beat is given a generated `draw` so every existing caller of `beat.draw(ctx, view, 1, opts)` still gets a complete final picture.

**Tech Stack:** Plain browser JavaScript, Canvas 2D, no build step, no dependencies. Tests: Node `vm` loader (`js/tests/harness.js`), Playwright Chromium, `@napi-rs/canvas` for `render-run.js`.

**Spec:** `docs/superpowers/specs/2026-11-13-motion-engine-design.md`. Read it first. This plan covers the engine, stage 1 and the stage 2 pilot, and stops at the owner checkpoint. Stage 3 gets its own plan after the pilot is approved.

## Global Constraints

- No image files, no new dependencies, no build step. Colours only from `B.Pal` (`js/art/palette.js`).
- All drawn positions round to whole virtual pixels.
- No `Math.random` and no wall-clock time in anything that decides a picture. Seed from the beat id with `B.hashSeed` and `B.RNG`.
- `beat.draw(ctx, view, 1, opts)` must return the complete final picture for every beat, layered or not.
- Beat ids are cache keys and must stay unique per story variant. Do not change an existing beat id.
- `frameCache` stays a `Map` on `B.Cinematic`. Cache budget: `36 * 1024 * 1024` bytes, oldest evicted first, cleared when a scene chain ends. Cached pictures are 1x; no supersampling.
- Transition lengths: `fade` 0.28 s, `cross` 0.3 s, `wipe` 0.35 s, `push` 0.35 s. They play inside the start of the incoming beat and add no time.
- Stage 1 changes no beat duration. A reworked shot may run up to 50% longer than today; a morning chain (news + phone + office) may grow at most 3 s in total.
- Motion is on only when `B.Settings.motion()` is true and `matchMedia('(prefers-reduced-motion: reduce)')` does not match. Off means: final still, no camera, no `animate`, and `cross`/`wipe`/`push` become `fade`.
- Existing thresholds must hold unchanged: `node-run.js` all pass; `render-run.js` newsUnique >= 41, establishGroups >= 38, endingUnique 22, weekendUnique 9; `browser-run.js` passes.
- Not in scope: art redraws, resolution changes, UI or CSS, captions, sound content, merging the scene files.
- Commit after each task. Commit messages are plain sentences and carry no model names.

**Running tests** (from the repo root; `NM` is a folder holding `node_modules` with `@napi-rs/canvas`):

```
node js/tests/node-run.js
node js/tests/browser-run.js
NODE_PATH=$NM/node_modules EVIDENCE_DIR=<scratch dir> node js/tests/render-run.js
node js/tests/motion-run.js
```

`browser-run.js` and `render-run.js` rewrite files under `qa/evidence/`. Run `git checkout -- qa/evidence` afterwards unless the task says to commit new evidence.

## Findings from the before review

Verified facts about today's code that every task must respect.

- `render-run.js` and `export-storyboard.js` load the art files with no `B.Settings` at all. `motion.js` must not touch `window.matchMedia`, `document` or `B.Settings` at load, `enabled()` must return false when `B.Settings` is missing, and a layered beat's generated `draw` must never consult settings.
- `Pixel.fit()` (`pixel.js:50`) reassigns the canvas width and height on every call, and `cinematic.js` calls it every frame. That wipes and reallocates the backing store 60 times a second. Task 2 fixes this: resize only when the size actually changes, otherwise just reset the transform.
- The first frame of a beat builds its cached picture, which costs tens of milliseconds. That frame is excluded from the frame-time limit (Task 5), and Task 4 must not add a second build per beat.
- The cache key is the beat id and size only. Some ids do not capture everything the picture depends on (`close:<day>:sqwak`, `phone:<day>:*`, news charts that read the live market). Clearing the cache at the end of each chain (Task 4) is what keeps these from going stale. Do not remove that clear.
- A `draw` that throws is cached as a black frame and nothing is logged; a scene builder that throws silently skips the scene. Task 4 adds one `console.warn` per failure with the beat id.
- `at2x` (`storyboard.js:72`) sets the shared season and clears it to null in `finally`. A nested `at2x` therefore clears the outer one's season. Never nest it.
- Art outside `at2x` (the weekend apartment is native 640x360 on a 3 px grid) gets its weather from `R.weather`, not from the season global.
- `tests.js:1363-1392` calls `DecisionArt.room` with a stub context that has no `drawImage`, `arc` or `getImageData`. Not touched in this plan; noted for stage 3.
- Today's beat lengths: news establish 1.7 s (2.4 s on one-beat days), detail 2.3 s, hold 1.1 s; office 1.45 / 1.8 / 0.85 s; close bell 1.25 s; weekend sat 1.7 s.
- Nothing in the cutscene code reads the Screen effects setting today. `enabled()` in Task 2 is the first place that does.

## Review Focus

1. **Skip during a transition or mid-layer build.** Tap or key must end the scene at once and leave no stray frame, listener or animation loop running. (Task 3)
2. **Window resized or phone rotated mid-shot.** The shot must keep playing at the new size with no stretch, no blank frame and no camera jump. (Task 2)
3. **Screen effects changed while a chain is playing, and `short` mode on a layered beat.** The next frame must obey the new setting; `short` must show the layered beat's final still. (Task 4)
4. **A scene played with no game behind it** (`opts.game` missing, as the debug overlay and the test runners do). Every layered pilot shot must still draw. (Tasks 6 to 8)
5. **One beat whose layers alone exceed the cache budget, or a cache evicted mid-beat.** Layers in use by the current beat must never be evicted, so playback never redraws a layer every frame. (Task 4)

---

### Task 1: `B.Motion` pure helpers

**Files:**
- Create: `js/art/motion.js`
- Modify: `index.html` and `tests.html` (add `<script src="js/art/motion.js"></script>` directly after `js/art/pixel.js`)
- Test: `js/tests/tests.js` (new tests, same `test(name, fn)` / `assert(cond, msg)` style as the file)

**Interfaces:**
- Produces, all on `B.Motion`, all pure and loadable with no DOM:
  - `ease: { linear, in, out, inOut }` each `(p: number) => number`, clamped to 0..1
  - `stepped(p: number, n: number): number` quantises p down to n equal poses
  - `tween(a: number, b: number, p: number, ease?: fn): number`
  - `keyframes(frames: [at: number, value: number][], p: number): number` linear between neighbours, clamped at the ends
  - `cycle(t: number, fps: number, n: number): number` integer frame index 0..n-1
  - `count(from: number, to: number, p: number): number` integer
  - `typed(str: string, p: number): string` prefix of str
  - `flicker(seed: string, t: number, rate: number): number` 0..1, constant within each `1/rate` second
  - `particles(o: { kind: 'snow'|'rain'|'dust'|'paper', seed: string, t: number, x, y, w, h, count: number }): { x: number, y: number, s: number }[]` whole-pixel positions inside the box, wrapping, same output for same input
  - `cameraAt(camera: { from, to, ease? } | null, p: number): { x: number, y: number, zoom: number }` where `from`/`to` are `{ x?, y?, zoom? }`, defaults `0, 0, 1`; x and y rounded; `null` gives `{ x: 0, y: 0, zoom: 1 }`
  - `presetFor(beat): camera | null` picks from `PRESETS` by `B.hashSeed(beat.id)`; returns `null` when `beat.dur < 1` or the id ends in `:hold`
  - `PRESETS`: named cameras `pushIn`, `pullBack`, `driftLeft`, `driftRight`, zooms within 1.04 to 1.08
  - `transitionFor(beat, index: number): 'cut'|'fade'|'cross'|'wipe'|'push'` returns `beat.transition` if set; else `fade` when `index === 0`, `cut` when the id ends in `:hold`, otherwise `cross`
  - `TRANSITION_DUR = { cut: 0, fade: 0.28, cross: 0.3, wipe: 0.35, push: 0.35 }`
  - `CACHE_BYTES = 36 * 1024 * 1024`

- [ ] **Step 1: Write the failing tests** in `js/tests/tests.js`:

```js
test('Motion: easing, stepping and keyframes', () => {
  const M = B.Motion;
  assert(M.ease.inOut(0) === 0 && M.ease.inOut(1) === 1 && M.ease.out(2) === 1 && M.ease.in(-1) === 0, 'easing is not clamped to 0..1');
  assert(M.stepped(0.49, 4) === 0.25 && M.stepped(1, 4) === 1, 'stepped does not quantise down');
  assert(M.tween(10, 20, 0.5) === 15, 'tween midpoint');
  assert(M.keyframes([[0, 0], [0.5, 10], [1, 0]], 0.25) === 5 && M.keyframes([[0.2, 3], [1, 9]], 0) === 3, 'keyframes');
  assert(M.cycle(0.26, 4, 3) === 1 && M.count(0, 41, 1) === 41 && M.typed('BELL', 0.5) === 'BE', 'cycle, count or typed');
});
test('Motion: particles and flicker repeat exactly and stay in their box', () => {
  const M = B.Motion, o = { kind: 'snow', seed: 'a', t: 1.3, x: 10, y: 20, w: 100, h: 50, count: 30 };
  const a = M.particles(o), b = M.particles(o);
  assert(a.length === 30 && JSON.stringify(a) === JSON.stringify(b), 'particles are not deterministic');
  assert(a.every((q) => Number.isInteger(q.x) && Number.isInteger(q.y) && q.x >= 10 && q.x < 110 && q.y >= 20 && q.y < 70), 'particle outside its box or off the pixel grid');
  assert(JSON.stringify(M.particles(Object.assign({}, o, { t: 2 }))) !== JSON.stringify(a), 'particles do not move');
  assert(M.flicker('s', 0.01, 10) === M.flicker('s', 0.09, 10), 'flicker changes inside one step');
});
test('Motion: camera and default presets', () => {
  const M = B.Motion;
  const c = M.cameraAt({ from: { x: 0 }, to: { x: 5, zoom: 1.08 } }, 0.5);
  assert(Number.isInteger(c.x) && c.y === 0 && c.zoom > 1 && c.zoom < 1.08, 'camera midpoint');
  assert(M.cameraAt(null, 0.3).zoom === 1, 'null camera is identity');
  assert(M.presetFor({ id: 'news:3:hold', dur: 2 }) === null && M.presetFor({ id: 'news:3:detail', dur: 0.8 }) === null, 'hold and short beats must not move');
  const p = M.presetFor({ id: 'news:3:detail', dur: 2 });
  assert(p && JSON.stringify(p) === JSON.stringify(M.presetFor({ id: 'news:3:detail', dur: 2 })), 'preset is not stable per id');
  assert(Object.values(M.PRESETS).every((q) => [q.from, q.to].every((e) => (e.zoom || 1) >= 1 && (e.zoom || 1) <= 1.08)), 'preset zoom out of range');
});
test('Motion: default transitions', () => {
  const M = B.Motion;
  assert(M.transitionFor({ id: 'a:b' }, 0) === 'fade' && M.transitionFor({ id: 'a:b' }, 2) === 'cross', 'defaults');
  assert(M.transitionFor({ id: 'a:hold' }, 2) === 'cut' && M.transitionFor({ id: 'a:b', transition: 'cut' }, 2) === 'cut', 'hold and explicit cut');
});
```

- [ ] **Step 2:** Run `node js/tests/node-run.js`. Expected: the four new tests FAIL (`B.Motion` undefined), everything else passes.
- [ ] **Step 3:** Implement `js/art/motion.js` in the same IIFE style as `js/art/palette.js` (`(function (B) { 'use strict'; ... })(window.BTB);`). No `document` or `window.matchMedia` access at load time. Add the script tags.
- [ ] **Step 4:** Run `node js/tests/node-run.js`. Expected: all pass.
- [ ] **Step 5:** Commit.

---

### Task 2: Camera in the player, the Chromium motion runner, and the shimmer gate

**Files:**
- Modify: `js/art/motion.js`, `js/art/cinematic.js`
- Create: `js/tests/motion-run.js`, `js/tests/motion-capture.js`

**Interfaces:**
- Consumes: `B.Motion.cameraAt`, `presetFor` (Task 1).
- Produces:
  - `B.Motion.enabled(): boolean` true only when `B.Settings.motion()` is true and the reduced-motion media query does not match. Safe with no `matchMedia`.
  - `B.Cinematic.pause(): void` stops the loop advancing time; `B.Cinematic.seek(i: number, t: number): void` sets the beat index and time and draws one frame. Used only by tests and capture.
  - `js/tests/motion-run.js`: Chromium runner built like `js/tests/browser-run.js` (own port via `QA_PORT`, default 4179), sets `effects: 'full'`, `cinematics: 'full'`, sound and music off. Exits non-zero on a failed assert. Helper inside it: `frame(scene, opts, i, t)` returns a hash of the `#cine-canvas` pixels after `seek`.
  - `js/tests/motion-capture.js <scene> <optsJSON> <beatIndex> [--video]`: writes a six-frame strip PNG (frames at p = 0, 0.2, 0.4, 0.6, 0.8, 1, side by side at 640x360 each) to `qa/evidence/motion/<scene>-<id>-<i>.png`, and with `--video` a `.webm` of the whole scene played in real time.

The camera transforms only the shot picture (cached frame, `draw`, `drawDynamic`). Letterbox, caption box and the fade overlay are drawn after the transform is restored. Zoom is about the view centre. A beat with no `camera` uses `presetFor(beat)`. With `enabled()` false the camera is identity.

- [ ] **Step 1: Write `js/tests/motion-run.js`** with these asserts (they fail until Step 3):

```js
// news day 7, beat 1 ('detail', 2.3 s): the default camera moves it
assert(await frame('news', day7, 1, 0.5) !== await frame('news', day7, 1, 2.2), 'default camera does not move the shot');
// determinism: same time, same picture
assert(await frame('news', day7, 1, 1.0) === await frame('news', day7, 1, 1.0), 'same time gives a different picture');
// letterbox rows (top 12 px of the 640 view) are identical at both times
assert(await band('news', day7, 1, 0.5) === await band('news', day7, 1, 2.2), 'the camera moved the letterbox');
// motion off: every frame of the beat is identical
await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
assert(await frame('news', day7, 1, 0.5) === await frame('news', day7, 1, 2.2), 'motion off still moves');
// resize mid-shot keeps playing: canvas has non-ink pixels after a viewport change
```

- [ ] **Step 2:** Run `node js/tests/motion-run.js`. Expected: FAIL on the first assert.
- [ ] **Step 3:** Implement `enabled`, `pause`, `seek` and the camera in `cinematic.js` `draw()`. Stop the per-frame canvas reallocation (see Findings): add an assert to `motion-run.js` that the `#cine-canvas` `width` property is assigned at most once across 30 consecutive seeks at a fixed viewport.
- [ ] **Step 4:** Run `node js/tests/motion-run.js`, `node js/tests/node-run.js`, `node js/tests/browser-run.js`. Expected: all pass.
- [ ] **Step 5:** Write `js/tests/motion-capture.js` and capture, with `--video`, these three: `news` day 45 beat 0, `weekend` day 4 beat 0, `decision` (`{ id: 'c1', day: 3, title: 'x' }`) beat 0. Commit code and captures.
- [ ] **Step 6: STOP. Shimmer gate.** Report the capture paths to the coordinator and wait. The coordinator rules one of: keep the presets; or `PRESETS` becomes fixed-zoom pan only (`from.zoom === to.zoom`); or `presetFor` returns `null` for any beat without `layers`. Apply the ruling, update the Task 1 preset test to match, rerun all four runners, commit.

---

### Task 3: Transitions

**Files:**
- Modify: `js/art/motion.js`, `js/art/cinematic.js`, `js/art/rhythm.js` (the `beat()` helper near line 372: remove `transition:'cut'` from its defaults)
- Test: `js/tests/tests.js`, `js/tests/motion-run.js`

**Interfaces:**
- Consumes: `transitionFor`, `TRANSITION_DUR`, `enabled` (Tasks 1, 2).
- Produces: `B.Motion.drawTransition(ctx, view, name, k: number, from: Canvas, to: Canvas): void` paints the blend at progress `k` (0 = all `from`, 1 = all `to`). `cross` reveals `to` through the 4x4 Bayer threshold already in `pixel.js` (16 ordered steps, no alpha). `wipe` moves a hard vertical edge left to right. `push` slides `from` out left as `to` slides in from the right, whole pixels. `from` may be `null` (first beat): paint `to`.

`cinematic.js` keeps a snapshot canvas of the last frame of the outgoing beat (picture only, before letterbox and caption) and uses it for the first `TRANSITION_DUR[name]` seconds of the incoming beat. `play()` drops its own `transition: index ? 'cut' : 'fade'` default and calls `transitionFor`. With `enabled()` false, `cross`/`wipe`/`push` play as `fade`. `skipAll()` and `finish()` must release the snapshot.

- [ ] **Step 1: Failing tests.** In `tests.js`:

```js
test('Storyboard: beats no longer hard-code a cut', () => {
  const bs = B.Scenes.news({ day: 7, brief: { title: 'x', feed: [] } });
  assert(bs[0].transition === 'fade', 'a scene must open on a fade');
  assert(bs.slice(1).every((b, i) => B.Motion.transitionFor(b, i + 1) === (/:hold$/.test(b.id) ? 'cut' : 'cross')), 'later beats should dissolve, holds should cut');
});
```

In `motion-run.js`: at `t = 0.15` into beat 1 of news day 7 the picture differs from both `t = 0` of beat 1 and `t = 1.0` of beat 1 (mid-dissolve); pressing a key at `t = 0.15` leaves `BTB.Cinematic.running === false`, `#cinematic` hidden and the done callback called once; with effects `reduced` no frame of the transition contains more than two distinct blends (it is a fade).

- [ ] **Step 2:** Run both runners. Expected: new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all four runners. Expected: all pass, `render-run.js` counts unchanged from baseline (newsUnique 46, establishGroups 41, endingUnique 22, weekendUnique 9).
- [ ] **Step 5:** Commit.

---

### Task 4: Layers, the generated `draw`, sound cues and the byte-budget cache

**Files:**
- Modify: `js/art/motion.js`, `js/art/cinematic.js`
- Test: `js/tests/tests.js`, `js/tests/motion-run.js`

**Interfaces:**
- Consumes: `cameraAt`, `enabled`, `CACHE_BYTES`.
- Produces:
  - Layer shape: `{ id: string, depth?: number = 1, w?: number, h?: number, draw(ctx, view, opts): void, animate?(ctx, view, t: number, p: number, opts): void }`. `w`/`h` default to the view; a larger layer is centred on the view at camera 0. `draw` paints once into a transparent canvas of `w x h`. `animate` paints every frame in that layer's own coordinates, after the layer is blitted, so it travels with the layer.
  - `B.Motion.layered(beat): beat` takes a beat with `layers` and returns it with `draw(ctx, view, p, opts)` supplied: every layer's `draw` then `animate(ctx, view, p * beat.dur, p, opts)`, back to front, no camera, oversized layers centred. Sets `cache: false`. Throws if two layers share an id.
  - `B.Motion.composite(ctx, view, beat, t, p, opts, cam, getLayer)`: the per-frame path. Layer offset is `-Math.round(cam.x * depth), -Math.round(cam.y * depth)`; zoom applies equally to all layers about the view centre. `getLayer(layer)` returns the cached canvas.
  - `B.Cinematic.layerCanvas(beat, layer, view)`: cached under `` `${beat.id}|${layer.id}|${w}x${h}` `` in `frameCache`.
  - `B.Cinematic.cacheBytes: number`. Eviction: oldest first while over `CACHE_BYTES`, never an entry whose key starts with the current beat's id. `endChain()` and the end of an unchained `finish()` clear the cache.
  - Beat field `cues: [{ at: number, sfx: string }]`: each fired once when `t` passes `at`, through `B.SFX[sfx]`, not fired when skipping.
- In `short` mode and with `enabled()` false, a layered beat shows `draw(ctx, view, 1, opts)` as a cached still.

- [ ] **Step 1: Failing tests.** In `tests.js` (no canvas needed; define `const fakeCtx = () => new Proxy({}, { get: () => () => {} });` beside the test):

```js
test('Motion: a layered beat supplies a full draw in layer order', () => {
  const log = [];
  const beat = B.Motion.layered({ id: 't:x', dur: 2, layers: [
    { id: 'bg', depth: 0, draw: () => log.push('bg') },
    { id: 'fg', depth: 1.5, draw: () => log.push('fg'), animate: (c, v, t, p) => log.push('fg@' + t + '/' + p) }
  ] });
  beat.draw(fakeCtx(), { w: 640, h: 360 }, 1, {});
  assert(log.join() === 'bg,fg,fg@2/1' && beat.cache === false, 'layer order, animate time or cache flag');
  let threw = false; try { B.Motion.layered({ id: 't:y', dur: 1, layers: [{ id: 'a', draw() {} }, { id: 'a', draw() {} }] }); } catch (e) { threw = true; }
  assert(threw, 'duplicate layer ids must be rejected');
});
```

In `motion-run.js`, using a test scene registered on `BTB.Scenes.__layers` from inside the page (two oversized layers at depth 0 and 2 with a camera pan, one `animate`, one cue): the depth-2 layer moves further than the depth-0 layer between `t = 0` and the end; each layer's `draw` ran exactly once across 60 seeks; `seek` to the end matches `beat.draw(..., 1)` pixel for pixel when the camera is identity; effects `reduced` shows one unchanging still; `cinematics: 'short'` shows the final still; the cue fires once in real-time play and not on skip; after playing all 46 news scenes in one chain `BTB.Cinematic.cacheBytes <= BTB.Motion.CACHE_BYTES`; a beat whose layers total more than the budget still draws each layer once.

- [ ] **Step 2:** Run both runners. Expected: new tests FAIL.
- [ ] **Step 3:** Implement. `browser-run.js` reads `frameCache.size`; keep it meaningful. Add the `console.warn` on a throwing `draw` or scene builder (see Findings).
- [ ] **Step 4:** Run all four runners. Expected: all pass, render counts unchanged.
- [ ] **Step 5:** Commit.

---

### Task 5: Performance check

**Files:**
- Modify: `js/tests/motion-run.js`

**Interfaces:**
- Produces: `perf(scene, opts)` in `motion-run.js`: phone viewport 390x844 landscape-rotated to 844x390, CDP `Emulation.setCPUThrottlingRate` 4, plays the scene in real time and records each frame's draw time. Asserts average under 8 ms and no frame over 33 ms, ignoring the first frame of each beat (the one-off layer build). Writes results to `qa/evidence/motion/perf.json`.

- [ ] **Step 1:** Add `perf` and run it on `news` day 7, `close` and `weekend` day 4. Expected: PASS on stage 1 shots. If it fails, report the numbers to the coordinator before changing anything.
- [ ] **Step 2:** Commit.

---

### Tasks 6 to 8: Pilot shots

Each pilot task has the same shape. The coordinator supplies a **motion sheet** for the shot (written by the designer) at `docs/superpowers/motion-sheets/<shot>.md` before the task starts. It names the layers, what moves, the timing, easing, camera and cues. Build exactly that; where it conflicts with Global Constraints, the constraints win and you report the conflict.

Common rules:
- Split the existing drawing function into layer functions by adding parameters or small helper functions next to it. Do not redraw or restyle the art. The picture `beat.draw(ctx, view, 1, opts)` returns must look like today's still plus whatever the sheet adds.
- Existing callers of the shot function (other beats still use it flat) must keep working and look the same.
- `SH.setSeason` is shared state set by `at2x` in `storyboard.js`. Every layer `draw` and `animate` that paints legacy 320x180 art must go through `at2x` so the season is set and cleared.
- Works with `opts.game` missing.
- Steps for each: (1) add `motion-run.js` asserts: the beat has `layers`; frame at `t = 0.1` differs from frame at `dur - 0.1`; same time gives same picture; effects `reduced` gives one still; `perf` passes; (2) run, expect FAIL; (3) implement; (4) run all four runners, expect pass with render counts at or above the thresholds in Global Constraints; (5) capture strip and video with `motion-capture.js`; (6) commit code and captures.

### Task 6: Pilot shot, the session 1 elevator

**Files:** Modify `js/art/scenes.js` (`elevator`, line ~112), `js/art/storyboard.js` (`framed` case `'elevator'` ~408, `B.Scenes.news` ~722).
**Scope:** only the beat `news:0:establish`. Other uses of `SH.elevator` stay flat.
**Extra assert:** `B.Scenes.news({ day: 0, ... })[0].id === 'news:0:establish'` and its duration is at most 2.55 s (today 1.7 s). Note `framed()` already applies a 1.18 zoom to this shot before `SH.elevator` draws; the motion sheet says whether the layered version keeps it.

### Task 7: Pilot shot, the closing bell

**Files:** Modify `js/art/scenes.js` (`bellScene`, line ~279), `js/art/storyboard.js` (`B.Scenes.close` ~741).
**Scope:** the first beat of `B.Scenes.close`, every session. Duration at most 1.9 s (today 1.25 s).
**Extra asserts:** `draw` at `p = 1` for a normal day shows the same swing pose `bellScene(1, ...)` gives today; on day 42 the swing is `p * 0.45`; on day 44 and later the bell does not move between any two times and the line is `4:00 PM. NOBODY RINGS IT.`

### Task 8: Pilot shot, the weekend apartment

**Files:** Modify `js/art/storyboard.js` (`apartmentShot` ~464, `petShot`, `B.Scenes.weekend` ~701).
**Scope:** the `sat` beat of `B.Scenes.weekend`, every housing tier and pet state. The `sun` and `hold` beats stay flat. Duration at most 2.55 s (today 1.7 s). Also fix the existing bug on that beat: `informative: !story` tests a function and is always false; it should be `informative: !story$`, so short mode shows Saturday on weekends with no story line. Add a `tests.js` assert for it.
**Extra asserts:** existing weekend tests in `tests.js` still pass (beat counts 3 and 4; ids differ with and without a pet and for a neglected pet); `render-run.js` weekendUnique is 9; for each of the homes in `B.Storyboard.HOMES` and each of no pet / cat / neglected dog the shot draws without throwing.

---

### Task 9: Final regression, documentation and the owner checkpoint

**Files:** Modify `README.md` (add `motion-run.js` to the test list and one line on the motion engine), `ART_DIRECTION.md` (one bullet under "Implemented visual systems").

- [ ] **Step 1:** Run all four runners plus `node js/tests/phone-run.js`. Expected: all pass.
- [ ] **Step 2:** Record `--video` captures of: the full session 1 morning chain, one close chain, one weekend. Save under `qa/evidence/motion/`.
- [ ] **Step 3:** Commit and push. STOP. The coordinator sends the recordings to the owner. No stage 3 work starts until the owner approves.
