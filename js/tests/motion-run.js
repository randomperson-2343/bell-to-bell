// Motion QA in Chromium: camera, determinism, letterbox, motion off, resize, canvas reallocation.
// node js/tests/motion-run.js
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4179);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };

(async () => {
  await wait(450);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
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

  // motion off: every frame of the beat is identical
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('news', day7, 1, 0.5) === await shot('news', day7, 1, 2.2), 'motion off still moves');
  const cam = await page.evaluate(() => BTB.Motion.enabled());
  assert(cam === false, 'enabled() true with effects reduced');

  console.log('motion-run: all asserts passed');
  await browser.close(); server.kill();
})().catch((error) => { console.error(error.stack || error); server.kill(); process.exit(1); });
