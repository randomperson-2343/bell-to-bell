// Motion maths for cutscenes: easing, keyframes, seeded particles, camera
// presets and default transitions. Pure and DOM-free so Node runners can load
// it; nothing here reads the clock, Math.random, document or B.Settings.
(function (B) {
  'use strict';

  const clamp01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
  const wrap = (v, m) => ((v % m) + m) % m;

  const ease = {
    linear: (p) => clamp01(p),
    in: (p) => { p = clamp01(p); return p * p; },
    out: (p) => { p = clamp01(p); return 1 - (1 - p) * (1 - p); },
    inOut: (p) => { p = clamp01(p); return p * p * (3 - 2 * p); }
  };

  const stepped = (p, n) => (n < 1 ? clamp01(p) : Math.floor(clamp01(p) * n) / n);
  const tween = (a, b, p, fn) => a + (b - a) * (fn ? fn(p) : p);

  function keyframes(frames, p) {
    if (!frames.length) return 0;
    const last = frames.length - 1;
    if (p <= frames[0][0]) return frames[0][1];
    if (p >= frames[last][0]) return frames[last][1];
    for (let i = 1; i <= last; i++) {
      if (p <= frames[i][0]) {
        const a = frames[i - 1], b = frames[i];
        return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * ((p - a[0]) / (b[0] - a[0]));
      }
    }
    return frames[last][1];
  }

  const cycle = (t, fps, n) => (n < 1 ? 0 : wrap(Math.floor(t * fps), n));
  const count = (from, to, p) => Math.round(tween(from, to, clamp01(p)));
  const typed = (str, p) => str.slice(0, Math.floor(str.length * clamp01(p)));

  // One value per 1/rate second, so a lamp holds still between steps.
  const flicker = (seed, t, rate) => B.RNG(B.hashSeed(seed + ':' + Math.floor(t * rate))).next();

  // Fall speed (px/s), sideways speed (px/s) and sway amplitude (px) per kind.
  const KINDS = {
    snow: { vy: 14, vx: 3, sway: 4, big: 0.25 },
    rain: { vy: 120, vx: -18, sway: 0, big: 0 },
    dust: { vy: 2, vx: 3, sway: 2, big: 0.1 },
    paper: { vy: 22, vx: 6, sway: 9, big: 0.5 }
  };

  function particles(o) {
    const k = KINDS[o.kind] || KINDS.dust, out = [];
    const w = Math.max(1, o.w), h = Math.max(1, o.h), ox = Math.round(o.x), oy = Math.round(o.y);
    for (let i = 0; i < o.count; i++) {
      const r = B.RNG(B.hashSeed(o.seed + ':' + o.kind + ':' + i));
      const x0 = r.next() * w, y0 = r.next() * h, sp = 0.7 + r.next() * 0.6, ph = r.next() * 6.2832, big = r.next() < k.big;
      const px = wrap(x0 + k.vx * sp * o.t + Math.sin(o.t * 1.3 * sp + ph) * k.sway, w);
      const py = wrap(y0 + k.vy * sp * o.t, h);
      out.push({ x: ox + Math.floor(px), y: oy + Math.floor(py), s: big ? 2 : 1 });
    }
    return out;
  }

  // Whole-pixel vertical tilts only: zoom or sideways drift makes dithered walls band and crawl.
  // The few rows a tilt exposes sit under the 12 px letterbox bars.
  const PRESETS = {
    tiltUp: { from: { y: 4 }, to: { y: -4 }, ease: ease.inOut },
    tiltDown: { from: { y: -4 }, to: { y: 4 }, ease: ease.inOut }
  };
  const PRESET_NAMES = Object.keys(PRESETS);

  function cameraAt(camera, p) {
    if (!camera) return { x: 0, y: 0, zoom: 1 };
    const f = camera.from || {}, t = camera.to || {}, e = camera.ease || ease.linear;
    return {
      x: Math.round(tween(f.x || 0, t.x || 0, p, e)),
      y: Math.round(tween(f.y || 0, t.y || 0, p, e)),
      // zoom other than 1 is only for layered shots; presets never zoom
      zoom: tween(f.zoom || 1, t.zoom || 1, p, e)
    };
  }

  // True only when the Screen effects setting is full and the OS does not ask for reduced motion.
  function enabled() {
    if (!B.Settings || typeof B.Settings.motion !== 'function' || !B.Settings.motion()) return false;
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) { /* no media query support: treat as allowed */ }
    return true;
  }

  const isHold = (beat) => /:hold$/.test(beat.id);

  function presetFor(beat) {
    if (beat.dur < 1.5 || isHold(beat)) return null;
    return PRESETS[PRESET_NAMES[B.hashSeed(beat.id) % PRESET_NAMES.length]];
  }

  function transitionFor(beat, index) {
    if (beat.transition) return beat.transition;
    if (index === 0) return 'fade';
    return isHold(beat) ? 'cut' : 'cross';
  }

  const TRANSITION_DUR = { cut: 0, fade: 0.28, cross: 0.3, wipe: 0.35, push: 0.35 };
  // Blend two shot pictures (canvases the size of view) onto ctx. k: 0 = all from, 1 = all to.
  // Every output pixel is a pixel of `from` or of `to`; nothing is alpha-mixed. cross, wipe and push only; the player draws fade as an ink overlay.
  let scratch = null;
  const tiles = [];
  function tile(step) {
    if (tiles[step]) return tiles[step];
    // 8x8 mask: each Bayer cell is 2x2 virtual pixels so the dither reads chunky.
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const g = c.getContext('2d'), bayer = B.Pixel.BAYER;
    g.fillStyle = '#000';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (bayer[(y >> 1) & 3][(x >> 1) & 3] < step) g.fillRect(x, y, 1, 1);
    return (tiles[step] = g.createPattern(c, 'repeat'));
  }
  function drawTransition(ctx, view, name, k, from, to) {
    k = clamp01(k);
    const w = view.w, h = view.h;
    if (!from || name === 'cut' || k >= 1) { ctx.drawImage(to, 0, 0, w, h); return; }
    if (name === 'cross') {
      const step = Math.round(k * 16);
      ctx.drawImage(from, 0, 0, w, h);
      if (step <= 0) return;
      if (step >= 16) { ctx.drawImage(to, 0, 0, w, h); return; }
      if (!scratch || scratch.width !== w || scratch.height !== h) {
        scratch = document.createElement('canvas'); scratch.width = w; scratch.height = h;
      }
      const g = scratch.getContext('2d');
      g.globalCompositeOperation = 'copy';
      g.drawImage(to, 0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = tile(step);
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(scratch, 0, 0, w, h);
    } else if (name === 'wipe') {
      const x = Math.round(k * w);
      ctx.drawImage(from, 0, 0, w, h);
      if (x > 0) ctx.drawImage(to, 0, 0, x, h, 0, 0, x, h);
    } else if (name === 'push') {
      const x = Math.round(k * w);
      ctx.drawImage(from, -x, 0, w, h);
      ctx.drawImage(to, w - x, 0, w, h);
    }
  }
  function releaseScratch() { scratch = null; }

  const CACHE_BYTES = 36 * 1024 * 1024;

  B.Motion = { enabled, ease, stepped, tween, keyframes, cycle, count, typed, flicker, particles, cameraAt, presetFor, PRESETS, transitionFor, TRANSITION_DUR, drawTransition, releaseScratch, CACHE_BYTES };
})(window.BTB);
