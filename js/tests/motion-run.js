// Motion QA in Chromium: camera, determinism, letterbox, motion off, resize, canvas reallocation.
// node js/tests/motion-run.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4179);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };

let browser = null;
async function run() {
  await wait(450);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#screen-menu.active', { timeout: 10000 });
  await page.evaluate(() => {
    const S = BTB.Settings;
    S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
    // pixel hash of the #cine-canvas (rows = number of top rows to hash, 0 = all)
    window.hashCanvas = (rows) => {
      const cv = document.getElementById('cine-canvas');
      const h = rows ? rows : cv.height;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, h).data;
      let x = 2166136261;
      for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); }
      return (x >>> 0).toString(16);
    };
    window.openBeat = (scene, opts) => {
      const C = BTB.Cinematic;
      if (C.running) C.finish();
      C.startChain('motion-qa');
      C.play(scene, opts, () => {});
      C.pause();
    };
  });
  const frame = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t); return window.hashCanvas(0);
  }, [scene, opts, i, t]);
  const band = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t);
    const cv = document.getElementById('cine-canvas');
    return window.hashCanvas(Math.round(12 * cv.width / 640));
  }, [scene, opts, i, t]);
  // the shot above the caption box (captions type in over time, so they are left out here)
  const shot = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t);
    return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75));
  }, [scene, opts, i, t]);
  const day7 = { day: 7, brief: { title: 'Headline', feed: [] } };

  assert(await shot('news', day7, 1, 0.5) !== await shot('news', day7, 1, 2.2), 'default camera does not move the shot');
  assert(await frame('news', day7, 1, 1.0) === await frame('news', day7, 1, 1.0), 'same time must give the same picture');
  assert(await band('news', day7, 1, 0.5) === await band('news', day7, 1, 2.2), 'the camera moved the letterbox');

  // default camera: opaque rows 12..347 and zoom exactly 1 at start, middle and end
  for (const t of [0.5, 1.15, 2.29]) {
    const r = await page.evaluate((t) => {
      window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } }); BTB.Cinematic.seek(1, t);
      const cv = document.getElementById('cine-canvas'), k = cv.height / 360;
      const d = cv.getContext('2d').getImageData(0, Math.round(12 * k), cv.width, Math.round(335 * k)).data;
      let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
      const beat = BTB.Cinematic.beats[1];
      return { clear, zoom: BTB.Motion.cameraAt(beat.camera || BTB.Motion.presetFor(beat), t / beat.dur).zoom };
    }, t);
    assert(r.clear === 0, `transparent pixels in the shot rows at t=${t}`);
    assert(r.zoom === 1, `default camera zoom ${r.zoom} at t=${t}`);
  }

  // seek works while paused and does not fire sound effects
  const sfx = await page.evaluate(() => {
    let fired = 0; const orig = BTB.Cinematic.playBeat;
    BTB.Cinematic.playBeat = function () { fired++; return orig.apply(this, arguments); };
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const before = fired; BTB.Cinematic.seek(1, 1.0); BTB.Cinematic.seek(2, 0.3);
    BTB.Cinematic.playBeat = orig; return fired - before;
  });
  assert(sfx === 0, 'seek fired playBeat');

  // canvas width assigned at most once over 30 seeks at a fixed viewport
  const widthWrites = await page.evaluate(() => {
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const cv = document.getElementById('cine-canvas');
    const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    let n = 0;
    Object.defineProperty(cv, 'width', { configurable: true, get() { return desc.get.call(this); }, set(v) { n++; desc.set.call(this, v); } });
    for (let k = 0; k < 30; k++) BTB.Cinematic.seek(1, 0.05 * k);
    delete cv.width;
    return n;
  });
  assert(widthWrites <= 1, `canvas width assigned ${widthWrites} times in 30 seeks`);

  // resize mid-shot: still drawing, no blank frame, canvas follows the new size
  await page.evaluate(() => { window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } }); BTB.Cinematic.seek(1, 1.0); });
  for (const size of [{ width: 800, height: 450 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const r = await page.evaluate(() => {
      BTB.Cinematic.seek(1, 1.0);
      const cv = document.getElementById('cine-canvas');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const first = [d[0], d[1], d[2]]; let other = 0, clear = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) clear++; if (d[i] !== first[0] || d[i + 1] !== first[1] || d[i + 2] !== first[2]) other++; }
      return { w: cv.width, h: cv.height, other, clear, total: d.length / 4, ratio: cv.width / cv.height };
    });
    assert(r.other > r.total * 0.2, `blank or flat frame after resize to ${size.width}x${size.height}`);
    assert(r.clear === 0, `transparent pixels after resize to ${size.width}x${size.height}`);
    assert(Math.abs(r.ratio - 16 / 9) < 0.01, `canvas stretched after resize to ${size.width}x${size.height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // ink underlay: an explicit sideways camera exposes a column that must be opaque P.ink
  const under = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic;
    const V = BTB.Scenes.V;
    BTB.Scenes.qaCam = (o) => [{
      id: 'qa:cam:' + o.n, dur: 2, transition: 'cut', camera: o.camera,
      draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); ctx.fillStyle = P.slate; ctx.fillRect(100, 60, 60, 60); }
    }];
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const run = (n, camera) => {
      window.openBeat('qaCam', { n, camera }); C.seek(0, 1);
      const cv = document.getElementById('cine-canvas'), k = cv.width / V.w;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const px = (x, y) => { const i = (Math.round(y * k) * cv.width + Math.round(x * k)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
      return { px, hash: window.hashCanvas(0) };
    };
    const a = run('x', { from: { x: 40, zoom: 1 }, to: { x: 40, zoom: 1 } });
    const same = (c, e) => c[0] === e[0] && c[1] === e[1] && c[2] === e[2];
    const y = V.h / 2;
    const out = {
      exposedInk: [5, 20, 38].every((x) => { const c = a.px(x, y); return same(c, rgb(P.ink)) && c[3] === 255; }),
      restFill: [45, 200, V.w - 5].every((x) => { const c = a.px(x, y); return same(c, rgb(P.bone)) && c[3] === 255; })
    };
    const flat = run('f', null).hash, zoomed = run('z', { from: { zoom: 1 }, to: { zoom: 1.5 } }).hash;
    out.zoomChanges = flat !== zoomed;
    return out;
  });
  assert(under.exposedInk, 'rows exposed by a camera offset are not opaque ink');
  assert(under.restFill, 'the shifted picture is not the fill colour');
  assert(under.zoomChanges, 'an explicit zoom camera does not change the picture');

  // transitions: a dissolve plays inside the start of beat 1 and finishes on the plain picture
  const d0 = await shot('news', day7, 1, 0), d15 = await shot('news', day7, 1, 0.15), d1 = await shot('news', day7, 1, 1.0);
  assert(d15 !== d0 && d15 !== d1, 'no mid-dissolve picture at t=0.15 of beat 1');

  // cross is on-palette: every pixel of the dissolve is a pixel of the old picture (beat 0 at its end)
  // or of the new one (beat 1 at t=0.15, painted without a transition)
  const palette = await page.evaluate(() => {
    const C = BTB.Cinematic, cv = document.getElementById('cine-canvas');
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const top = Math.round(12 * cv.height / 360), rows = Math.round(cv.height * 0.75); // below the top letterbox bar
    const refer = (beat, p) => {
      const view = beat.view || BTB.Scenes.V, pic = document.createElement('canvas');
      pic.width = view.w; pic.height = view.h;
      C.paint(pic.getContext('2d'), beat, view, p);
      const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height;
      const g = r.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(pic, 0, 0, cv.width, cv.height);
      return g.getImageData(0, top, cv.width, rows - top).data;
    };
    const oldP = refer(C.beats[0], 1), newP = refer(C.beats[1], 0.15 / C.beats[1].dur);
    C.seek(1, 0.15);
    const mid = cv.getContext('2d').getImageData(0, top, cv.width, rows - top).data;
    let bad = 0, fromOld = 0, fromNew = 0;
    for (let i = 0; i < mid.length; i += 4) {
      const a = mid[i] === oldP[i] && mid[i + 1] === oldP[i + 1] && mid[i + 2] === oldP[i + 2];
      const b = mid[i] === newP[i] && mid[i + 1] === newP[i + 1] && mid[i + 2] === newP[i + 2];
      if (!a && !b) bad++;
      if (a && !b) fromOld++;
      if (b && !a) fromNew++;
    }
    return { bad, fromOld, fromNew, total: mid.length / 4 };
  });
  assert(palette.bad === 0, `${palette.bad} of ${palette.total} dissolve pixels are neither old nor new`);
  assert(palette.fromOld > palette.total * 0.1 && palette.fromNew > palette.total * 0.1, `dissolve is not a mix: ${palette.fromOld} old-only, ${palette.fromNew} new-only of ${palette.total}`);

  // a beat shorter than its transition still finishes the blend by its last frame
  const short = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic;
    const still = { from: {}, to: {} };
    const a = { id: 'qa:short:a', dur: 0.5, camera: still, draw(ctx, view) { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, view.w, view.h); } };
    const b = (tr) => ({ id: 'qa:short:b', dur: 0.2, transition: tr, camera: still, draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); ctx.fillStyle = P.slate; ctx.fillRect(40, 40, 80, 80); } });
    BTB.Scenes.qaShort = () => [a, b('push')];
    BTB.Scenes.qaShortRef = () => [b('cut')];
    const hash = (scene, i, t) => { window.openBeat(scene, {}); C.seek(i, t); return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75)); };
    return { end: hash('qaShort', 1, 0.2), own: hash('qaShortRef', 0, 0.2), early: hash('qaShort', 1, 0.05) };
  });
  assert(short.end === short.own, 'a beat shorter than its transition does not end on its own picture');
  assert(short.early !== short.own, 'the short beat shows no transition at all');

  // wipe and push are hard edges in whole pixels (checked on flat two-colour test shots)
  const edges = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic, V = BTB.Scenes.V;
    const still = { from: {}, to: {} };
    BTB.Scenes.qaEdge = (o) => [
      { id: 'qa:edge:a', dur: 2, camera: still, draw(ctx, view) { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, view.w / 2, view.h); ctx.fillStyle = P.slate; ctx.fillRect(view.w / 2, 0, view.w / 2, view.h); } },
      { id: 'qa:edge:b' + o.name, dur: 2, transition: o.name, camera: still, draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); } }
    ];
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const at = (name, t, x) => {
      window.openBeat('qaEdge', { name }); C.seek(1, t);
      const cv = document.getElementById('cine-canvas'), k = cv.width / V.w;
      const d = cv.getContext('2d').getImageData(Math.round(x * k), Math.round(V.h / 2 * k), 1, 1).data;
      return [d[0], d[1], d[2]].join();
    };
    const c = (hex) => rgb(hex).join();
    const half = 0.35 / 2; // k = 0.5
    return {
      wipeNew: at('wipe', half, V.w * 0.3) === c(P.bone), wipeOld: at('wipe', half, V.w * 0.8) === c(P.slate), wipeStart: at('wipe', 0, V.w * 0.3) === c(P.ink),
      pushOld: at('push', half, V.w * 0.3) === c(P.slate), pushNew: at('push', half, V.w * 0.8) === c(P.bone)
    };
  });
    assert(edges.wipeNew && edges.wipeOld && edges.wipeStart, 'wipe edge is not at the middle at k=0.5 or does not start on the old picture');
  assert(edges.pushOld && edges.pushNew, 'push does not slide the old picture out left and the new one in');

  // skipping during a transition ends the scene at once and leaves nothing behind
  const skip = await page.evaluate(() => {
    const C = BTB.Cinematic;
    if (C.running) C.finish();
    window.__done = 0;
    C.startChain('motion-qa');
    C.play('news', { day: 7, brief: { title: 'Headline', feed: [] } }, () => { window.__done++; });
    C.pause(); C.seek(1, 0.15);
    return { snap: !!C.snap };
  });
  assert(skip.snap, 'no snapshot held mid-transition');
  await page.keyboard.press('Space');
  const after = await page.evaluate(async () => {
    const C = BTB.Cinematic, h1 = window.hashCanvas(0);
    await new Promise((r) => setTimeout(r, 120));
    return { running: C.running, hidden: document.getElementById('cinematic').hidden, done: window.__done, snap: C.snap, pic: C.pic, raf: C.raf, key: C.onKey, same: h1 === window.hashCanvas(0) };
  });
  assert(after.running === false && after.hidden === true && after.done === 1, `skip mid-transition: ${JSON.stringify(after)}`);
  assert(!after.snap && !after.pic && after.raf === null && after.key === null && after.same, 'skip left a snapshot, loop, listener or frame behind');

  // ---- layered shots, cues, byte-budget cache ----
  await page.evaluate(() => {
    const P = BTB.Pal;
    window.__ld = {}; window.__cue = 0;
    BTB.SFX.qaCue = () => { window.__cue++; };
    const count = (id) => { window.__ld[id] = (window.__ld[id] || 0) + 1; };
    BTB.Scenes.__layers = (o) => [BTB.Motion.layered({
      id: 'qa:layers:' + ((o && o.n) || 'a'), dur: 1.2, camera: o && o.cam ? { from: { x: 0 }, to: { x: 20 } } : undefined,
      cues: [{ at: 0.2, sfx: 'qaCue' }],
      layers: [
        { id: 'bg', depth: 0, w: 800, h: 450, draw(c) { count('bg'); c.fillStyle = P.slate; c.fillRect(0, 0, 800, 450); c.fillStyle = P.bone; c.fillRect(380, 200, 16, 60); } },
        { id: 'fg', depth: 2, w: 800, h: 450, draw(c) { count('fg'); c.fillStyle = P.white; c.fillRect(480, 200, 16, 60); },
          animate(c, v, t) { c.fillStyle = P.putty; c.fillRect(500 + Math.round(t * 10), 300, 6, 6); } }
      ]
    })];
    // layers well over the budget set below
    BTB.Scenes.__big = () => [BTB.Motion.layered({
      id: 'qa:big', dur: 1.2, camera: { from: { x: 0 }, to: { x: 10 } },
      layers: ['a', 'b', 'c'].map((id, n) => ({ id, depth: n, w: 800, h: 450, draw(c) { count('big' + id); c.fillStyle = P.slate; c.fillRect(0, 0, 800, 450); } }))
    })];
    BTB.Scenes.__throw = () => [BTB.Motion.layered({
      id: 'qa:throw', dur: 1.2,
      layers: [{ id: 'bad', draw() { throw new Error('boom'); } }, { id: 'ok', draw(c) { c.fillStyle = BTB.Pal.bone; c.fillRect(0, 0, 50, 50); } }]
    })];
    // a layer with transparent holes, and cues at and past the duration
    BTB.Scenes.__holes = () => [BTB.Motion.layered({ id: 'qa:holes', dur: 1.2, layers: [{ id: 'dot', draw(c) { c.fillStyle = P.bone; c.fillRect(100, 40, 20, 20); } }] })];
    BTB.Scenes.__lateCue = () => [BTB.Motion.layered({ id: 'qa:late', dur: 0.4, cues: [{ at: 0.4, sfx: 'qaCue' }, { at: 9, sfx: 'qaCue' }], layers: [{ id: 'x', draw() {} }] })];
    BTB.Scenes.__click = () => [BTB.Motion.layered({ id: 'qa:click', dur: 0.5, cues: [{ at: 0.1, sfx: 'click' }], layers: [{ id: 'x', draw() {} }] })];
    BTB.Scenes.__throwBuilder = () => { throw new Error('builder boom'); };
  });
  const cols = (o, i, t) => page.evaluate(([o, i, t]) => {
    window.openBeat('__layers', o); BTB.Cinematic.seek(i, t);
    const cv = document.getElementById('cine-canvas'), V = BTB.Scenes.V, k = cv.width / V.w;
    const d = cv.getContext('2d').getImageData(0, Math.round(V.h / 2 * k), cv.width, 1).data;
    const find = (hex) => { const c = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)); for (let x = 0; x < cv.width; x++) if (d[x * 4] === c[0] && d[x * 4 + 1] === c[1] && d[x * 4 + 2] === c[2]) return x / k; return -1; };
    return { bg: find(BTB.Pal.bone), fg: find(BTB.Pal.white) };
  }, [o, i, t]);
  const c0 = await cols({ n: 'p', cam: true }, 0, 0.4), c1 = await cols({ n: 'p', cam: true }, 0, 1.2);
  assert(c0.bg >= 0 && c0.fg >= 0 && c1.bg >= 0 && c1.fg >= 0, `parallax markers not found ${JSON.stringify([c0, c1])}`);
  assert(Math.abs(c1.fg - c0.fg) > Math.abs(c1.bg - c0.bg) + 20, `depth 2 layer did not move further than depth 0: ${JSON.stringify([c0, c1])}`);

  // each layer draw runs once across 60 seeks
  const draws = await page.evaluate(() => {
    window.__ld = {}; window.openBeat('__layers', { n: 'once', cam: true });
    for (let k = 0; k < 60; k++) BTB.Cinematic.seek(0, 0.02 * k);
    return window.__ld;
  });
  assert(draws.bg === 1 && draws.fg === 1, `layer draws over 60 seeks: ${JSON.stringify(draws)}`);

  // identity camera: the live composite matches beat.draw(.., 1) pixel for pixel
  const ref = await page.evaluate(() => {
    const C = BTB.Cinematic, cv = document.getElementById('cine-canvas'), V = BTB.Scenes.V;
    const rows = (hexOf) => hexOf;
    const hashRef = () => {
      const beat = BTB.Scenes.__layers({ n: 'ref' })[0], pic = document.createElement('canvas');
      pic.width = V.w; pic.height = V.h;
      const g = pic.getContext('2d'); g.fillStyle = BTB.Pal.ink; g.fillRect(0, 0, V.w, V.h);
      beat.draw(g, V, 1, {});
      const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height;
      const h = r.getContext('2d'); h.imageSmoothingEnabled = false; h.drawImage(pic, 0, 0, cv.width, cv.height);
      const top = Math.round(12 * cv.height / 360), end = Math.round(cv.height * 0.75), d = h.getImageData(0, top, cv.width, end - top).data;
      let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16);
    };
    const seen = () => {
      const top = Math.round(12 * cv.height / 360), end = Math.round(cv.height * 0.75), d = cv.getContext('2d').getImageData(0, top, cv.width, end - top).data;
      let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16);
    };
    window.openBeat('__layers', { n: 'ref' }); C.seek(0, 1.2);
    return { live: seen(), ref: hashRef() };
  });
  assert(ref.live === ref.ref, 'live layer composite differs from beat.draw(.., 1) with an identity camera');

  // effects reduced: one unchanging still, equal to the final picture; back to full it moves again
  const refShot = await shot('__layers', { n: 'ref' }, 0, 1.2);
  const lay = (t) => shot('__layers', { n: 'm', cam: true }, 0, t);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  const rd = [await lay(0.5), await lay(0.9), await lay(1.2)];
  assert(rd[0] === rd[1] && rd[1] === rd[2], 'reduced: a layered shot still changes');
  assert(rd[0] === refShot, 'reduced: the layered still is not draw(.., 1)');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  assert(await lay(0.5) !== await lay(1.2), 'effects back to full: a layered shot with a camera does not move on the next frame');

  // short mode: the final still
  await page.evaluate(() => BTB.Settings.set('cinematics', 'short'));
  const sh = [await lay(0.5), await lay(1.2)];
  await page.evaluate(() => BTB.Settings.set('cinematics', 'full'));
  assert(sh[0] === sh[1] && sh[0] === refShot, 'short: a layered shot is not its final still');

  // the still path paints ink first: transparent holes show ink, never the previous frame
  const hole = await page.evaluate(() => {
    const C = BTB.Cinematic, V = BTB.Scenes.V;
    BTB.Settings.set('effects', 'reduced');
    window.openBeat('__layers', { n: 'stale' }); C.seek(0, 0.6); // fills the canvas with slate
    window.openBeat('__holes', {}); C.seek(0, 0.6);
    const cv = document.getElementById('cine-canvas'), k = cv.width / V.w, ink = [1, 3, 5].map((j) => parseInt(BTB.Pal.ink.slice(j, j + 2), 16));
    const at = (x, y) => Array.from(cv.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data);
    const a = at(10, 90), b = at(110, 50);
    BTB.Settings.set('effects', 'full');
    return { holeInk: a[0] === ink[0] && a[1] === ink[1] && a[2] === ink[2] && a[3] === 255, dot: b[0] !== ink[0] };
  });
  assert(hole.holeInk && hole.dot, `layered still left stale pixels in a transparent hole: ${JSON.stringify(hole)}`);

  // effects toggled between two seeks of the same layered beat: still, then live again
  const tog = [];
  await page.evaluate(() => { BTB.Settings.set('effects', 'full'); window.openBeat('__layers', { n: 'm', cam: true }); BTB.Cinematic.seek(0, 0.5); });
  const grab = () => page.evaluate(() => { BTB.Cinematic.seek(0, 0.5); return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75)); });
  tog.push(await grab());
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced')); tog.push(await grab());
  await page.evaluate(() => BTB.Settings.set('effects', 'full')); tog.push(await grab());
  assert(tog[0] !== tog[1] && tog[1] === rd[0] && tog[2] === tog[0], 'toggling Screen effects mid-beat did not switch the next frame to the still and back');

  // cues: once in real time, not from seek, not on skip
  const cues = await page.evaluate(async () => {
    const C = BTB.Cinematic, out = {};
    if (C.running) C.finish();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue' }, () => {}); C.pause(); C.seek(0, 0.5); C.seek(0, 1.1);
    out.seek = window.__cue; C.finish(); C.endChain();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue2' }, () => { window.__fin = true; });
    await new Promise((r) => setTimeout(r, 1600));
    out.real = window.__cue; out.finished = !!window.__fin; C.endChain();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue3' }, () => {}); C.skipAll();
    await new Promise((r) => setTimeout(r, 400));
    out.skip = window.__cue; C.endChain();
    return out;
  });
  assert(cues.seek === 0 && cues.skip === 0, `cue fired from seek or skip: ${JSON.stringify(cues)}`);
  const late = await page.evaluate(async () => {
    const C = BTB.Cinematic; if (C.running) C.finish();
    window.__cue = 0; C.startChain('late'); C.play('__lateCue', {}, () => {});
    await new Promise((r) => setTimeout(r, 900)); C.endChain();
    return window.__cue;
  });
  assert(late === 2, `cues at or past the duration should fire on the last frame, fired ${late}`);
  // sound gate: the real B.SFX gate decides; spy on the audio nodes the cue would create
  const gate = await page.evaluate(async () => {
    const C = BTB.Cinematic, proto = (window.AudioContext || window.webkitAudioContext).prototype, orig = {};
    let nodes = 0;
    ['createOscillator', 'createBufferSource'].forEach((n) => { orig[n] = proto[n]; proto[n] = function () { nodes++; return orig[n].apply(this, arguments); }; });
    const play = async () => {
      if (C.running) C.finish(); nodes = 0;
      C.startChain('gate'); C.play('__click', {}, () => {});
      await new Promise((r) => setTimeout(r, 900)); C.endChain(); return nodes;
    };
    BTB.Settings.set('sound', true); const on = await play();
    BTB.Settings.set('sound', false); const off = await play();
    Object.keys(orig).forEach((n) => { proto[n] = orig[n]; });
    return { on, off };
  });
  assert(gate.on > 0 && gate.off === 0, `cue sound gate: ${JSON.stringify(gate)}`);
  assert(cues.real === 1 && cues.finished, `cue should fire exactly once in real time: ${JSON.stringify(cues)}`);

  // byte-budget cache
  const budget = await page.evaluate(() => {
    const C = BTB.Cinematic, M = BTB.Motion, out = {};
    if (C.running) C.finish();
    C.endChain(); out.cleared = C.frameCache.size === 0 && C.cacheBytes === 0;
    const run = () => {
      C.startChain('budget');
      for (let day = 0; day < 46; day++) {
        window.openBeat('news', { day, brief: { title: 'SESSION ' + day, feed: [] } });
        for (let i = 0; i < C.beats.length; i++) C.seek(i, C.beats[i].dur * 0.9);
      }
      const bytes = [...C.frameCache.values()].reduce((a, c) => a + c.width * c.height * 4, 0);
      const r = { bytes: C.cacheBytes, actual: bytes, size: C.frameCache.size };
      C.finish(); C.endChain(); return r;
    };
    out.real = run();
    const keep = M.CACHE_BYTES; M.CACHE_BYTES = 8 * 1024 * 1024;
    out.small = run();
    // one beat whose layers alone exceed the budget: each layer still draws once
    M.CACHE_BYTES = 1024 * 1024; window.__ld = {};
    window.openBeat('__big', {});
    for (let k = 0; k < 60; k++) C.seek(0, 0.02 * k);
    out.big = { ld: Object.assign({}, window.__ld), bytes: C.cacheBytes, keys: C.frameCache.size };
    M.CACHE_BYTES = keep; C.finish(); C.endChain();
    out.afterChain = C.frameCache.size + C.cacheBytes;
    // an unchained scene clears its cache when it finishes
    C.play('__big', {}, () => {}); C.pause(); C.seek(0, 0.5); out.held = C.frameCache.size; C.finish(); out.unchained = C.frameCache.size + C.cacheBytes;
    return out;
  });
  assert(budget.cleared, 'endChain did not clear the cache');
  assert(budget.real.bytes <= 36 * 1024 * 1024 && budget.real.bytes === budget.real.actual && budget.real.size > 0, `46 news scenes: ${JSON.stringify(budget.real)}`);
  assert(budget.small.bytes <= 8 * 1024 * 1024 && budget.small.bytes === budget.small.actual && budget.small.size > 0, `8 MB budget not honoured: ${JSON.stringify(budget.small)}`);
  assert(budget.big.ld.biga === 1 && budget.big.ld.bigb === 1 && budget.big.ld.bigc === 1 && budget.big.keys === 3, `over-budget beat rebuilt layers: ${JSON.stringify(budget.big)}`);
  assert(budget.afterChain === 0, 'cache not cleared at the end of the chain');
  assert(budget.held > 0 && budget.unchained === 0, `unchained finish did not clear the cache: ${JSON.stringify([budget.held, budget.unchained])}`);

  // failures warn once with the beat id; a throwing layer leaves the rest of the shot
  const before = warnings.length;
  const thr = await page.evaluate(() => {
    const C = BTB.Cinematic; let built = true;
    window.openBeat('__throw', {});
    for (let k = 0; k < 10; k++) C.seek(0, 0.5 + 0.01 * k);
    C.finish(); C.endChain();
    let done = false; C.play('__throwBuilder', {}, () => { done = true; });
    return { done, running: C.running };
  });
  const added = warnings.slice(before);
  assert(thr.done && !thr.running, 'a throwing scene builder did not end the scene');
  assert(added.length === 2 && /qa:throw/.test(added[0]) && /bad/.test(added[0]) && /__throwBuilder/.test(added[1]), `unexpected warnings for throwing layer and builder: ${JSON.stringify(added)}`);
  warnings.length = 0;

  // ---- pilot shot: session 1 elevator (news:0:establish) ----
  const day0 = { day: 0, brief: { title: 'FIRST DAY', feed: [] } };
  const elev = await page.evaluate((o) => { const b = BTB.Scenes.news(o)[0]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id), cue: (b.cues || []).map((c) => c.at + ':' + c.sfx).join() }; }, day0);
  assert(elev.id === 'news:0:establish' && elev.dur <= 2.55 && elev.dur > 1.7, `elevator beat id/duration: ${JSON.stringify(elev)}`);
  assert(elev.layers.join() === 'car,lobby,frame,marks' && elev.cue === '1.05:elevator', `elevator layers/cues: ${JSON.stringify(elev)}`);
  assert(await shot('news', day0, 0, 0.4) !== await shot('news', day0, 0, 2.3), 'elevator: start and end frames are identical');
  assert(await shot('news', day0, 0, 1.6) === await shot('news', day0, 0, 1.6), 'elevator: same time gave different pictures');
  assert(await shot('news', day0, 0, 0.4) !== await shot('news', day0, 0, 1.0), 'elevator: the counter does not move');
  assert(await shot('news', day0, 0, 1.6) !== await shot('news', day0, 0, 1.9), 'elevator: the doors do not move');
  const elevPlain = await page.evaluate((o) => {
    // draws with no game and with no settings consulted: the generated draw at p = 1
    const b = BTB.Scenes.news(o)[0], c = document.createElement('canvas'); c.width = 640; c.height = 360;
    b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {});
    const d = c.getContext('2d').getImageData(0, 0, 640, 360).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i] === 255 ? 1 : 0;
    return a;
  }, day0);
  assert(elevPlain > 640 * 360 * 0.5, 'elevator: draw(p=1) without a game left the picture mostly empty');
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('news', day0, 0, 0.5) === await shot('news', day0, 0, 2.2), 'elevator: reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- pilot shot: the closing bell (first beat of close) ----
  const closeOpts = (day) => ({ report: { day, pnl: 1200, quotaMet: true, quota: 900 } });
  const bellInfo = await page.evaluate((list) => list.map((d) => {
    const b = BTB.Scenes.close({ report: { day: d, pnl: 1200, quotaMet: true, quota: 900 } })[0];
    return { d, id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), sfx: b.sfx, transition: b.transition, line: b.line, cache: b.cache, camera: !!b.camera };
  }), [3, 30, 42, 43, 44, 50]);
  for (const b of bellInfo) {
    assert(/^close:.*:bell$/.test(b.id) && b.dur === 1.82 && b.transition === 'fade', `bell beat id/duration/transition: ${JSON.stringify(b)}`);
    if (b.d >= 44) {
      assert(b.layers === '' && b.sfx === 'room' && b.cache === true && b.camera && b.line === '4:00 PM. NOBODY RINGS IT.', `silent bell beat: ${JSON.stringify(b)}`);
    } else {
      assert(b.layers === 'wall,desks,frame' && b.sfx === 'closeBell' && b.line === '4:00 PM.', `ringing bell beat: ${JSON.stringify(b)}`);
    }
  }
  // p = 1 is the old flat picture, pixel for pixel. The reference is built from the flat functions the old beat called.
  // Returns how many bytes differ between beat.draw(p) and the flat reference at the same swing (null: size mismatch).
  const bellDiff = (day, p) => page.evaluate(([day, p]) => {
    const SB = BTB.Storyboard, SH = BTB.Shots, X = BTB.Pixel, P = BTB.Pal, V = BTB.Rhythm.view;
    const mk = () => { const c = document.createElement('canvas'); c.width = V.w; c.height = V.h; const g = c.getContext('2d'); return g; };
    const silent = day >= 44, swing = silent ? 1 : day === 42 ? p * 0.45 : p;
    const ref = mk();
    SB.at2x(ref, (cc) => {
      SH.bellScene(cc, swing, day >= 25);
      if (silent) { cc.save(); cc.globalAlpha = 0.45; X.rect(cc, 0, 0, 320, 180, P.ink); cc.restore(); }
    }, day);
    SB.finePass(ref, day, { shot: 'bell' }, 'establish');
    const got = mk();
    BTB.Scenes.close({ report: { day, pnl: 1200, quotaMet: true, quota: 900 } })[0].draw(got, V, p, {}); // no game in opts
    const a = ref.getImageData(0, 0, V.w, V.h).data, b = got.getImageData(0, 0, V.w, V.h).data;
    let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }, [day, p]);
  for (const day of [3, 30, 42, 43, 44, 50]) {
    assert(await bellDiff(day, 1) === 0, `bell day ${day}: draw(p=1) is not pixel-identical to the flat picture`);
  }
  // mid-beat: the layered picture equals the flat one at the same swing (swing p, or p * 0.45 on session index 42); p picked so the walker pose matches
  for (const day of [3, 30, 42]) assert(await bellDiff(day, 0.3) === 0, `bell day ${day}: draw(p=0.3) differs from the flat picture at the same swing`);
  assert(await bellDiff(30, 0.5) > 0, 'bell: the second walker pose never shows (round(swing * 14) odd)');
  assert(await bellDiff(3, 0.5) === 0, 'bell: normal day at p=0.5 differs from the flat picture');
  const bell3 = closeOpts(3), bell30 = closeOpts(30), bell42 = closeOpts(42), bell44 = closeOpts(44);
  for (const o of [bell3, bell30, bell42]) {
    assert(await shot('close', o, 0, 0.35) !== await shot('close', o, 0, 1.7), `bell day ${o.report.day}: start and end frames are identical`);
    assert(await shot('close', o, 0, 0.9) === await shot('close', o, 0, 0.9), `bell day ${o.report.day}: same time gave different pictures`);
    assert(await shot('close', o, 0, 0.5) !== await shot('close', o, 0, 0.65), `bell day ${o.report.day}: the bell does not swing`);
  }
  assert(await shot('close', bell30, 0, 1.0) !== await shot('close', bell3, 0, 1.0), 'bell: empty floor looks like a normal day');
  // silent: nothing moves between any two times once the fade is over, and the camera is still
  const silentShots = [];
  for (const t of [0.3, 0.7, 1.2, 1.7, 1.82]) silentShots.push(await shot('close', bell44, 0, t));
  assert(new Set(silentShots).size === 1, `bell silent day: something moves: ${JSON.stringify(silentShots)}`);
  assert(await band('close', bell44, 0, 0.5) === await band('close', bell44, 0, 1.7), 'bell silent day: letterbox moved');
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('close', bell3, 0, 0.5) === await shot('close', bell3, 0, 1.7), 'bell: reduced effects still moves');
  assert(await shot('close', bell30, 0, 0.5) === await shot('close', bell30, 0, 1.7), 'bell (empty floor): reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- pilot shot: the weekend apartment, Saturday (weekend:<key>:sat) ----
  const wk = (day, w) => ({ day, game: w ? { mode: { S: { wallet: w } } } : undefined });
  const wk4 = wk(4), wkCat = wk(44, { tier: 3, lateWeeks: 1, pet: { kind: 'cat', sex: 'boy' } });
  const satInfo = await page.evaluate((o) => { const b = BTB.Scenes.weekend(o)[0]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), depths: (b.layers || []).map((l) => l.depth).join(), cue: (b.cues || []).map((c) => c.at + ':' + c.sfx).join(), cam: b.camera && b.camera.from.y + '>' + b.camera.to.y, n: BTB.Scenes.weekend(o).length }; }, wk4);
  assert(/^weekend:.*:sat$/.test(satInfo.id) && satInfo.dur <= 2.55 && satInfo.dur > 1.7, `sat beat id/duration: ${JSON.stringify(satInfo)}`);
  assert(satInfo.layers === 'outside,room,furniture,front,grain' && satInfo.depths === '0.25,0.5,0.85,1.2,0' && satInfo.cue === '1:news' && satInfo.cam === '8>0' && satInfo.n === 3, `sat layers/cues/camera: ${JSON.stringify(satInfo)}`);
  for (const o of [wk4, wkCat]) {
    assert(await shot('weekend', o, 0, 0.4) !== await shot('weekend', o, 0, 2.3), 'sat: start and end frames are identical');
    assert(await shot('weekend', o, 0, 1.6) === await shot('weekend', o, 0, 1.6), 'sat: same time gave different pictures');
    assert(await shot('weekend', o, 0, 0.9) !== await shot('weekend', o, 0, 1.05), 'sat: the phone does not light at 1.0 s');
    assert(await shot('weekend', o, 0, 1.05) !== await shot('weekend', o, 0, 1.2), 'sat: the notification bar does not appear at 1.08 s');
  }
  // the pet is in the shot
  const petBox = await page.evaluate(([withPet, without]) => {
    const rows = (o) => { window.openBeat('weekend', o); BTB.Cinematic.seek(0, 1.2); const cv = document.getElementById('cine-canvas'), k = cv.width / 640; return cv.getContext('2d').getImageData(Math.round(420 * k), Math.round(210 * k), Math.round(48 * k), Math.round(66 * k)).data.join(); };
    return rows(withPet) !== rows(without);
  }, [wkCat, wk(44, { tier: 3, lateWeeks: 1 })]);
  assert(petBox, 'sat: the pet is missing from the shot');
  // the inhale itself: the front layer's animate at 1.2 s differs from 0.7 s and 1.8 s only in the pet's box (and the phone, which lights at 1.0 s)
  const inhale = await page.evaluate((o) => {
    const b = BTB.Scenes.weekend(o)[0], front = b.layers.find((l) => l.id === 'front'), get = (t) => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
      front.animate(g, { w: 640, h: 360 }, t, t / b.dur, {}); return g.getImageData(0, 0, 640, 360).data;
    };
    const cnt = (a, b2) => { let n = 0, out = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 3] !== b2[i + 3] || a[i] !== b2[i]) { n++; const x = (i / 4) % 640, y = Math.floor(i / 4 / 640); if ((x < 420 || x >= 480 || y < 216 || y >= 276) && !(x >= 219 && x < 240 && y >= 264 && y < 270)) out++; } return { n, out }; };
    const before = get(0.7), during = get(1.2), after = get(1.8);
    return { up: cnt(before, during), down: cnt(during, after), same: cnt(before, after) };
  }, wkCat);
  assert(inhale.up.n > 0 && inhale.up.out === 0 && inhale.down.n > 0 && inhale.down.out === 0 && inhale.same.out === 0, `sat: the pet's breath does not rise and settle: ${JSON.stringify(inhale)}`);
  // each tier x pet state x season draws five layers in the browser, with no game in opts too
  const drawAll = await page.evaluate(() => {
    const out = [];
    const pets = [null, { pet: { kind: 'cat', sex: 'boy' } }, { pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' }];
    for (let tier = 0; tier < 6; tier++) for (const pet of pets) for (const day of [4, 24, 44]) {
      const w = Object.assign({ tier, lateWeeks: tier % 4 }, pet || {});
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: w } } } })[0], c = document.createElement('canvas'); c.width = 640; c.height = 360;
      b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {});
      b.draw(c.getContext('2d'), { w: 640, h: 360 }, 0, undefined);
      out.push(b.layers.length);
    }
    return out.every((n) => n === 5) && out.length === 54;
  });
  assert(drawAll, 'sat: a tier / pet / season combination did not draw five layers');
  // p = 1 is today's still plus the sheet's additions: it differs from the flat apartmentShot only in the window opening
  // (weather particles frozen at 2.4 s) and the phone screen (lit, with its bar).
  const flatDiff = await page.evaluate((cases) => {
    const SB = BTB.Storyboard, out = [];
    for (const [day, w] of cases) {
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: w } } } })[0], home = SB.homeOf(w), rect = SB.windowRect(home);
      const mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; return c.getContext('2d'); };
      const got = mk(); b.draw(got, { w: 640, h: 360 }, 1, {});
      const ref = mk(); SB.apartmentShot(ref, day, home, false, w);
      const a = ref.getImageData(0, 0, 640, 360).data, g = got.getImageData(0, 0, 640, 360).data;
      let win = 0, phone = 0, elsewhere = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] === g[i] && a[i + 1] === g[i + 1] && a[i + 2] === g[i + 2] && a[i + 3] === g[i + 3]) continue;
        const x = (i / 4) % 640, y = Math.floor(i / 4 / 640);
        if (x >= rect.wx && x < rect.wx + rect.ww && y >= rect.wy && y < rect.wy + rect.wh) win++;
        else if (x >= 219 && x < 240 && y >= 264 && y < 270) phone++;
        else elsewhere++;
      }
      out.push({ day, tier: w.tier, win, phone, elsewhere });
    }
    return out;
  }, [
    [4, { tier: 2 }], [24, { tier: 0, lateWeeks: 3 }], [14, { tier: 3, pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' }],
    [44, { tier: 5, pet: { kind: 'cat', sex: 'boy' } }], [34, { tier: 1, lateWeeks: 1 }], [44, { tier: 4 }]
  ]);
  for (const d of flatDiff) assert(d.elsewhere === 0 && d.win > 0 && d.phone > 0, `sat p=1 differs from the flat picture outside the window and phone: ${JSON.stringify(d)}`);
  // no gap between the window frame and the outside layer at any camera position, any tier
  const gaps = await page.evaluate(() => {
    const M = BTB.Motion, bad = [];
    for (let tier = 0; tier < 6; tier++) for (const day of [4, 44]) {
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: { tier } } } } })[0], cache = {};
      for (let y = 0; y <= 8; y++) {
        const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
        const g = cv.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 640, 360);
        M.composite(g, { w: 640, h: 360 }, b, 1, 0.5, {}, { x: 0, y, zoom: 1 }, (layer) => {
          if (cache[layer.id]) return cache[layer.id];
          const lc = document.createElement('canvas'); lc.width = 640; lc.height = 360; layer.draw(lc.getContext('2d'), { w: 640, h: 360 }, {}); return (cache[layer.id] = lc);
        });
        const d = g.getImageData(0, 0, 640, 348).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) n++;
        if (n) bad.push({ tier, day, y, n });
      }
    }
    return bad;
  });
  assert(!gaps.length, `sat: gaps show above the letterbox: ${JSON.stringify(gaps.slice(0, 4))}`);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('weekend', wk4, 0, 0.5) === await shot('weekend', wk4, 0, 2.2), 'sat: reduced effects still moves');
  assert(await shot('weekend', wkCat, 0, 0.5) === await shot('weekend', wkCat, 0, 2.2), 'sat (pet): reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // effects reduced: a plain fade from ink, no dissolve of the old shot
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  const r1 = await shot('news', day7, 1, 0.1), r29 = await shot('news', day7, 1, 0.29), rEnd = await shot('news', day7, 1, 1.0);
  assert(r1 !== rEnd, 'reduced: no fade at t=0.1');
  assert(r29 === rEnd, 'reduced: transition still visible at t=0.29');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // motion off: every frame of the beat is identical
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('news', day7, 1, 0.5) === await shot('news', day7, 1, 2.2), 'motion off still moves');
  const cam = await page.evaluate(() => BTB.Motion.enabled());
  assert(cam === false, 'enabled() true with effects reduced');

  assert(warnings.length === 0, `unexpected console output: ${JSON.stringify(warnings)}`);
  console.log('motion-run: all asserts passed');

  // ---- Performance (phone, CPU throttled 4x). SKIP_PERF=1 skips it. ----
  // Scenes measured; later tasks add their shots here.
  const PERF_SCENES = [
    { scene: 'news', opts: { day: 0, brief: { title: 'FIRST DAY', feed: [] } } },
    { scene: 'news', opts: { day: 7, brief: { title: 'FOUR FUNDS, ONE MODEL', feed: [] } } },
    { scene: 'close', opts: { report: { day: 3, pnl: 1200, quotaMet: true, quota: 900 } } },
    { scene: 'close', opts: { report: { day: 30, pnl: 1200, quotaMet: true, quota: 900 } } },
    { scene: 'weekend', opts: { day: 4 } },
    // heaviest variants: winter snow plus the breath on a cat in a penthouse, and autumn leaves with no pet
    { scene: 'weekend', opts: { day: 44, game: { mode: { S: { wallet: { tier: 5, pet: { kind: 'cat', sex: 'boy' } } } } } } },
    { scene: 'weekend', opts: { day: 9, game: { mode: { S: { wallet: { tier: 3 } } } } } }
  ];
  const PERF_AVG_MS = 8, PERF_MAX_MS = 33, PERF_ATTEMPTS = 3, PERF_TIMEOUT_MS = 20000;
  const pct = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] : 0;
  const round = (x) => Math.round(x * 100) / 100;

  // One real-time playback of the whole scene; returns per-frame draw() times.
  const perfRun = async (scene, opts) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    let cdp = null, timer = null;
    try {
      await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
      await pg.keyboard.press('Enter');
      await pg.waitForSelector('#screen-menu.active', { timeout: 10000 });
      await pg.evaluate(() => {
        const S = BTB.Settings;
        S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
      });
      cdp = await ctx.newCDPSession(pg);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      // A scene that never finishes (or a throw that stops the loop) must not hang the runner.
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`perf: scene '${scene}' did not finish within ${PERF_TIMEOUT_MS / 1000} s`)), PERF_TIMEOUT_MS);
      });
      const playing = pg.evaluate(([s, o]) => new Promise((resolve) => {
        const C = BTB.Cinematic, orig = C.draw, out = [];
        let lastBeat = -1;
        C.draw = function () {
          const t0 = performance.now();
          const r = orig.apply(this, arguments);
          const ms = performance.now() - t0;
          out.push({ beat: this.i, first: this.i !== lastBeat, ms });
          lastBeat = this.i;
          return r;
        };
        if (C.running) C.finish();
        C.startChain('perf-qa');
        C.play(s, o, () => { C.draw = orig; resolve(out); });
      }), [scene, opts]);
      playing.catch(() => {}); // the context is closed on timeout; its late rejection is not news
      return await Promise.race([playing, timeout]);
    } finally {
      clearTimeout(timer);
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
      await ctx.close().catch(() => {});
    }
  };

  const perf = async (scene, opts) => {
    let result;
    const attempts = [];
    for (let attempt = 1; attempt <= PERF_ATTEMPTS; attempt++) {
      const frames = await perfRun(scene, opts);
      const rest = frames.filter((f) => !f.first).map((f) => f.ms);
      const sorted = rest.slice().sort((a, b) => a - b);
      const avg = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : 0;
      const max = sorted.length ? sorted[sorted.length - 1] : 0;
      const firstFrames = frames.filter((f) => f.first).map((f) => ({ beat: f.beat, ms: round(f.ms) }));
      const pass = rest.length > 0 && avg < PERF_AVG_MS && max <= PERF_MAX_MS;
      attempts.push({ avgMs: round(avg), p95Ms: round(pct(sorted, 0.95)), maxMs: round(max) });
      // Top level: the passing attempt, or the last one when none passed.
      result = { scene, status: pass ? 'pass' : 'fail', framesMeasured: rest.length, framesTotal: frames.length, avgMs: round(avg), p95Ms: round(pct(sorted, 0.95)), maxMs: round(max), firstFrameMs: firstFrames, attempts };
      if (pass) break;
    }
    return result;
  };

  if (process.env.SKIP_PERF === '1') console.log('motion-run: perf skipped (SKIP_PERF=1)');
  else {
    const results = [];
    for (const { scene, opts } of PERF_SCENES) {
      const r = await perf(scene, opts);
      results.push(r);
      r.day = opts.day; r.tier = opts.game ? opts.game.mode.S.wallet.tier : undefined; r.pet = !!(opts.game && opts.game.mode.S.wallet.pet);
      console.log(`perf ${scene}${opts.day != null ? ' day ' + opts.day : ''}${r.tier != null ? ' tier ' + r.tier : ''}${r.pet ? ' pet' : ''}: ${r.status} attempts=${r.attempts.length} framesMeasured=${r.framesMeasured}/${r.framesTotal} avg=${r.avgMs} p95=${r.p95Ms} max=${r.maxMs} firstMax=${Math.max(0, ...r.firstFrameMs.map((f) => f.ms))}`);
    }
    const outDir = path.join(root, 'qa', 'evidence', 'motion');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'perf.json'), JSON.stringify({
      viewport: '844x390', deviceScaleFactor: 2, cpuThrottle: 4, limits: { avgMs: PERF_AVG_MS, maxMs: PERF_MAX_MS }, scenes: results
    }, null, 2) + '\n');
    const failed = results.filter((r) => r.status !== 'pass');
    assert(!failed.length, `perf limits exceeded: ${failed.map((r) => r.scene).join(', ')}`);
    console.log('motion-run: perf within limits');
  }
}

// Every path (pass, failed assert, throw) closes the browser, stops the server and sets the exit code.
(async () => {
  try { await run(); }
  finally {
    try { if (browser) await browser.close(); } catch (e) { /* already gone */ }
    server.kill();
  }
})().then(() => process.exit(0), (error) => { console.error(error.stack || error); process.exit(1); });
