// The motion kit: fourteen reusable animated drawing elements and three helpers for cutscene shots.
// Every element is a pure function of (geometry, t, options): same arguments, same rectangles. Nothing here
// reads the clock, Math.random, document or B.Settings, so the Node runners can load it. B.Rhythm and
// B.Shots are only touched at draw time, never at load.
//
// Conventions: the signature is K.name(ctx, ...geometry, t, o); T = t + (o.t0 || 0); every computed
// position and size goes through Math.round; alpha and clips live inside save/restore; colours come
// from the caller (B.Pal values), the few defaults below are the ones the motion bible names.
(function (B) {
  'use strict';
  const P = B.Pal, X = B.Pixel;

  const R = Math.round;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clamp01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
  const wrap = (v, m) => ((v % m) + m) % m;
  const timeOf = (t, o) => t + ((o && o.t0) || 0);

  // The only drawing primitive: rounds, skips empty rectangles and null colours.
  function fill(ctx, x, y, w, h, col) {
    w = R(w); h = R(h);
    if (!col || w <= 0 || h <= 0) return;
    X.rect(ctx, R(x), R(y), w, h, col);
  }
  function fillAlpha(ctx, x, y, w, h, col, a) {
    ctx.save(); ctx.globalAlpha = a; fill(ctx, x, y, w, h, col); ctx.restore();
  }
  function outline(ctx, x, y, w, h, th, col) {
    x = R(x); y = R(y); w = R(w); h = R(h);
    fill(ctx, x, y, w, th, col);
    fill(ctx, x, y + h - th, w, th, col);
    fill(ctx, x, y + th, th, h - 2 * th, col);
    fill(ctx, x + w - th, y + th, th, h - 2 * th, col);
  }

  // ---- helpers ---------------------------------------------------------------
  // 0 before a, 1 from b, linear between. A zero-length span is a step.
  const span = (T, a, b) => (b === a ? (T >= b ? 1 : 0) : clamp01((T - a) / (b - a)));
  // An easing for a beat camera that moves only between seconds a and b of a beat of length dur.
  const camSpan = (dur, a, b, ease) => (p) => ease((p * dur - a) / (b - a));
  // A depth-1 layer lifts dy px into place between a and b seconds; depth-0 layers stay still.
  const rise = (dy, dur, a, b) => ({ from: { x: 0, y: -dy, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 }, ease: camSpan(dur, a, b, B.Motion.ease.out) });

  // ---- 1. blink --------------------------------------------------------------
  // One rect, on or off. With `end` the phase is taken from the end, so the light is on at T = end.
  function blink(ctx, x, y, w, h, t, o) {
    const T = timeOf(t, o), period = o.period || 1.0, duty = o.duty == null ? 0.5 : o.duty;
    const on = o.end != null ? wrap(o.end - T, period) < duty * period : wrap(T + (o.phase || 0), period) < duty * period;
    fill(ctx, x, y, w, h, on ? o.on : o.off);
  }

  // ---- 2. crt ----------------------------------------------------------------
  function crt(ctx, x, y, w, h, t, o) {
    const T = timeOf(t, o), at = o.at;
    x = R(x); y = R(y); w = R(w); h = R(h);
    const bg = o.bg || P.screenD, ly = y + Math.floor(h / 2) - 1;
    if (o.mode === 'roll') {
      const dur = o.dur || 0.36, band = o.band || 6, q = (T - at) / dur;
      if (!(q >= 0 && q < 1)) return;
      const top = y - band + Math.floor(q * (h + band)), y0 = Math.max(top, y), y1 = Math.min(top + band, y + h);
      if (y1 > y0) fillAlpha(ctx, x, y0, w, y1 - y0, P.phosphorD, 0.22);
      const edge = top + band - 1;
      if (edge >= y && edge < y + h) fillAlpha(ctx, x, edge, w, 1, P.phosphor, 0.4);
    } else if (o.mode === 'off') {
      if (T < at) return;
      fill(ctx, x, y, w, h, bg);
      if (T < at + 0.05) fill(ctx, x, ly, w, 2, P.phosphor);
      if (T < at + 0.10) fill(ctx, x + Math.floor(w / 2) - 2, ly, 4, 2, P.white);
      if (o.dim) fillAlpha(ctx, x, y, w, h, P.ink, o.dim);
    } else if (o.mode === 'on') {
      if (T < at) fill(ctx, x, y, w, h, bg);
      else if (T < at + 0.05) { fill(ctx, x, y, w, h, bg); fill(ctx, x, ly, w, 2, P.phosphor); }
      else if (T < at + 0.10) fillAlpha(ctx, x, y, w, h, P.bone, 0.12);
    }
  }

  // ---- 3. flicker ------------------------------------------------------------
  // A practical light stuttering dark in hard steps: from explicit spans, or from the seeded lamp.
  function flicker(ctx, x, y, w, h, seed, t, o) {
    const T = timeOf(t, o);
    let dark;
    if (o.spans) dark = o.spans.some((s) => T >= s[0] && T < s[1]);
    else dark = T >= o.from && T < o.to && B.Motion.flicker(seed, T, o.rate || 12) < (o.chance == null ? 0.07 : o.chance);
    if (dark) fillAlpha(ctx, x, y, w, h, o.col || P.ink, o.a == null ? 0.3 : o.a);
  }

  // ---- 4. trace --------------------------------------------------------------
  // A plotted series. The shot derives o.from and o.n from time; `t` is accepted for symmetry.
  function trace(ctx, ys, t, o) {
    const from = o.from || 0, n = o.n == null ? ys.length - from : o.n, step = o.step == null ? (o.w || 3) : o.step;
    const w = o.w || 3, h = o.h || 2, x0 = o.x0 || 0;
    for (let k = 0; k < n; k++) {
      const yv = ys[from + k];
      if (typeof yv !== 'number' || !isFinite(yv)) continue;
      fill(ctx, x0 + k * step, yv, w, h, o.head && k === n - 1 ? o.head : o.col);
    }
  }

  // Runs fn(x, y) in the coordinates the text is drawn in: the caller's own for scale 1, otherwise a scaled frame at (x, y).
  function scaled(ctx, x, y, scale, fn) {
    x = R(x); y = R(y);
    if (!scale || scale === 1) { fn(x, y); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    fn(0, 0);
    ctx.restore();
  }

  // ---- 5. tally --------------------------------------------------------------
  // A number counting to its true value, in 15 steps a second. Returns the value.
  function tally(ctx, x, y, t, o) {
    const T = timeOf(t, o), fps = o.fps || 15, fmt = o.fmt || String, ease = o.ease || B.Motion.ease.linear;
    const ts = Math.floor(T * fps) / fps, q = span(ts, o.at, o.at + o.dur);
    // At and after at + dur the value is `to` itself, even when the 15 fps step lags the end by a tick.
    const value = q >= 1 || T >= o.at + o.dur ? o.to : Math.round(o.from + (o.to - o.from) * ease(q));
    if (T < o.at && o.before !== 'from') return o.from;
    scaled(ctx, x, y, o.scale, (px, py) => X.textShadow(ctx, fmt(T < o.at ? o.from : value), px, py, o.col || P.bone, o.shadow || P.ink, { align: o.align || 'left' }));
    return T < o.at ? o.from : value;
  }

  // ---- 6. typeOn -------------------------------------------------------------
  // In-picture text typing at 16 characters a second; alignment comes from the full string.
  function typeOn(ctx, str, x, y, t, o) {
    const T = timeOf(t, o), cps = o.cps || 16, len = str.length, scale = o.scale || 1;
    if (T < o.at) return;
    const n = clamp(Math.floor((T - o.at) * cps), 0, len), tw = X.textWidth(str);
    const base = scale === 1 ? R(x) : 0;
    const x0 = o.align === 'center' ? (base - (tw - 1) / 2) | 0 : o.align === 'right' ? (base - (tw - 1)) | 0 : base;
    const done = o.at + len / cps;
    let cursor = false;
    if (o.cursor) cursor = n < len || (T < done + 1.0 && wrap(T - done, 0.5) < 0.25);
    scaled(ctx, x, y, scale, (px, py) => {
      const dx = x0 - base + px;
      if (n > 0) X.textShadow(ctx, str.slice(0, n), dx, py, o.col || P.bone, o.shadow || P.ink);
      if (cursor) fill(ctx, dx + n * 6, py, 5, 7, o.cursor.col);
    });
  }

  // ---- 7. stamp --------------------------------------------------------------
  // A stamp landing in three hard frames on the final rect. Returns the phase (0 to 3).
  function stamp(ctx, x, y, w, h, t, o) {
    const T = timeOf(t, o), frame = o.frame == null ? 0.04 : o.frame, grow = o.grow || [16, 6];
    x = R(x); y = R(y); w = R(w); h = R(h);
    const phase = T < o.at ? 0 : T < o.at + frame ? 1 : T < o.at + 2 * frame ? 2 : 3;
    // the height grows by half of the width growth: (w + 16) x (h + 8), then (w + 6) x (h + 3)
    const around = (g, th) => outline(ctx, R(x - g / 2), R(y - g / 4), w + g, h + R(g / 2), th, o.col);
    if (phase === 1) around(grow[0], 1);
    else if (phase === 2) around(grow[1], 2);
    else if (phase === 3 && (o.style || 'double') === 'double') {
      outline(ctx, x, y, w, h, 1, o.col);
      outline(ctx, x + 2, y + 2, w - 4, h - 4, 1, o.col);
    }
    return phase;
  }

  // ---- 8. marker -------------------------------------------------------------
  // A pen stroke drawing on along the art's own marker rects, in pen order.
  function marker(ctx, segs, t, o) {
    const T = timeOf(t, o), fps = o.fps || 20, col = o.col || P.crimson;
    let total = 0;
    for (const s of segs) total += Math.max(s.w, s.h);
    const q = T >= o.at + o.dur ? 1 : span(Math.floor(T * fps) / fps, o.at, o.at + o.dur);
    let left = total * q;
    for (const s of segs) {
      const long = Math.max(s.w, s.h), part = R(clamp(left, 0, long));
      left -= long;
      if (part <= 0) continue;
      const rev = s.dir === -1;
      if (s.w >= s.h) fill(ctx, rev ? s.x + s.w - part : s.x, s.y, part, s.h, col);
      else fill(ctx, s.x, rev ? s.y + s.h - part : s.y, s.w, part, col);
    }
  }

  // ---- 9. lamps --------------------------------------------------------------
  // Cells switching in sequence. With `on: null` and an `off` colour the cells switch dark instead.
  function lamps(ctx, cells, t, o) {
    const T = timeOf(t, o), n = cells.length, order = o.order || 'index';
    let rank = (k) => k;
    if (order === 'reverse') rank = (k) => n - 1 - k;
    else if (order === 'seed') {
      const idx = cells.map((c, k) => k), key = idx.map((k) => B.hashSeed(o.seed + ':' + k));
      idx.sort((a, b) => key[a] - key[b] || a - b);
      const pos = []; idx.forEach((k, r) => { pos[k] = r; });
      rank = (k) => pos[k];
    }
    const a = o.a == null ? 1 : o.a;
    if (a !== 1) ctx.save();
    if (a !== 1) ctx.globalAlpha = a;
    for (let k = 0; k < n; k++) {
      const c = cells[k], switched = T >= o.at + rank(k) * o.step;
      const col = o.on == null ? (switched ? o.off : null) : (switched ? o.on : o.off);
      fill(ctx, c.x, c.y, c.w, c.h, col);
    }
    if (a !== 1) ctx.restore();
  }

  // ---- 10. weather -----------------------------------------------------------
  // The window weather of the pilot, generalised: paper in autumn, rain when grey, snow in winter.
  function weather(ctx, x, y, w, h, day, seed, t, o) {
    o = o || {};
    const T = timeOf(t, o), s = B.Rhythm.season(day), min = o.min == null ? 3 : o.min;
    x = R(x); y = R(y); w = R(w); h = R(h);
    const cap = (n) => (o.max != null ? Math.min(n, o.max) : n);
    let kind, n, tp = T, draw;
    if (s.snow) {
      kind = 'snow'; n = cap(o.count != null ? o.count : clamp(R(w * h / 1000 * (0.4 + 0.6 * s.snow)), min, 40)); tp = Math.floor(T * 12) / 12;
      draw = (q) => { const big = q.s === 2 ? 3 : 2; fill(ctx, q.x, q.y, big, big, P.white); };
    } else if (s.id === 'autumn') {
      kind = 'paper'; n = cap(o.count != null ? o.count : clamp(R(w / 30), min, 14)); tp = Math.floor(T * 12) / 12;
      draw = (q, i) => fill(ctx, q.x, q.y, 3, 2, i % 2 ? P.amber : P.crimsonD);
    } else {
      kind = 'rain'; n = cap(o.count != null ? o.count : clamp(R(w * h / 1500), min, 40));
      draw = (q) => fill(ctx, q.x, q.y, 1, o.rainLen || 6, P.grey2);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    B.Motion.particles({ kind, seed, t: tp, x, y, w, h, count: n }).forEach(draw);
    ctx.restore();
  }

  // ---- 11. motes -------------------------------------------------------------
  // Dust in a light shaft; `up` mirrors the fall for steam.
  function motes(ctx, x, y, w, h, seed, t, o) {
    o = o || {};
    const T = timeOf(t, o), tp = Math.floor(T * 12) / 12;
    x = R(x); y = R(y); w = R(w); h = R(h);
    const count = clamp(o.count == null ? 8 : o.count, 0, 12);
    ctx.save(); ctx.globalAlpha = o.a == null ? 0.45 : o.a;
    B.Motion.particles({ kind: 'dust', seed, t: tp, x, y, w, h, count }).forEach((q) => {
      const py = o.up ? 2 * y + h - 1 - q.y : q.y, sz = q.s === 2 ? 2 : 1;
      fill(ctx, q.x, py, sz, sz, o.col || P.bone);
    });
    ctx.restore();
  }

  // ---- 12. figure ------------------------------------------------------------
  const spriteCache = new WeakMap();
  const spriteOf = (rows) => { let s = spriteCache.get(rows); if (!s) { s = X.sprite(rows); spriteCache.set(rows, s); } return s; };

  // A person: the commuter sprite of B.Rhythm.person (about 400 rects) or the WALKER sprites of scenes.js (36 rects).
  // The bible's original pose wording (swap the leg columns) was replaced by the coordinator's ruling: person poses 1 and 2 lift one foot.
  // 'cross' steps from x to o.x1 between o.at and o.at + o.dur; 'idle' drops the sprite o.dy px for 0.8 s of every o.period.
  function figure(ctx, x, y, t, o) {
    const T = timeOf(t, o);
    let px = R(x), py = R(y), pose = 0, lift = 0;
    if (o.mode === 'cross') {
      const step = o.step || 2, tp = Math.floor(T * 12) / 12, q = span(tp, o.at, o.at + o.dur);
      if (T >= o.at + o.dur) px = R(o.x1);
      else {
        const steps = R((o.x1 - x) * q / step);
        px = R(x) + steps * step;
        pose = Math.abs(steps) % 2;
        lift = steps === 0 ? 0 : pose ? 1 : 2;
      }
    } else if (o.mode === 'idle') {
      if (T >= o.at && wrap(T - o.at, o.period || 2.4) < 0.8) py += o.dy == null ? 2 : o.dy;
    }
    if (o.kind === 'walker') {
      const S = B.Shots, sc = o.scale || 2;
      ctx.save(); ctx.translate(px, py); ctx.scale(sc, sc);
      X.drawSprite(ctx, spriteOf(pose ? S.WALKER_B : S.WALKER), 0, 0);
      ctx.restore();
    } else {
      B.Rhythm.person(ctx, px, py, o.scale || 1, o.act || 0, o.face == null ? 1 : o.face, o.who || 0, lift);
    }
  }

  // ---- 13. passing -----------------------------------------------------------
  // Lights crossing a band, clipped to it: cars (headlight pair and a tail) or one train of windows.
  function passing(ctx, x, y, w, h, seed, t, o) {
    const T = timeOf(t, o), dir = o.dir == null ? 1 : o.dir;
    x = R(x); y = R(y); w = R(w); h = R(h);
    const flip = (rx, rw) => (dir < 0 ? 2 * x + w - rx - rw : rx);
    const put = (rx, ry, rw, rh, col, a) => {
      rx = flip(R(rx), rw);
      if (rx + rw <= x || rx >= x + w) return;
      if (a != null) fillAlpha(ctx, rx, ry, rw, rh, col, a); else fill(ctx, rx, ry, rw, rh, col);
    };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (o.kind === 'train') {
      const u = (T - o.at) * (o.speed || 360), ry = y + Math.floor((h - 6) / 2);
      if (T >= o.at) for (let k = 0; k < 14; k++) put(x - 10 + R(u) - k * 18, ry, 10, 6, P.bone, 0.55);
    } else {
      const speed = o.speed || 220, every = o.every || 1.2, last = o.count != null ? o.count - 1 : Infinity;
      const hi = Math.min(Math.floor((T - o.at) / every), last), lo = Math.max(0, Math.floor((T - o.at - (w + 60) / speed - 0.3) / every), hi - 12);
      const ry = y + Math.floor((h - 2) / 2);
      for (let i = lo; i <= hi; i++) {
        const u = (T - (o.at + i * every + 0.3 * B.RNG(B.hashSeed(seed + i)).next())) * speed;
        if (u < 0) continue;
        const px = x - 10 + R(u);
        put(px, ry, 4, 2, P.bone); put(px + 6, ry, 4, 2, P.bone); put(px - 40, ry, 2, 2, P.crimson);
      }
    }
    ctx.restore();
  }

  // ---- 14. ping --------------------------------------------------------------
  // A screen or notification lighting up in hard steps: `off` rects cover before at and inside gaps,
  // `on` rects draw from at, and one flare shows for flare.dur.
  function ping(ctx, t, o) {
    const T = timeOf(t, o), drawAll = (list) => (list || []).forEach((r) => (r.a == null || r.a === 1 ? fill(ctx, r.x, r.y, r.w, r.h, r.col) : fillAlpha(ctx, r.x, r.y, r.w, r.h, r.col, r.a)));
    const gap = (o.gaps || []).some((g) => T >= g[0] && T < g[1]);
    if (T < o.at || gap) { drawAll(o.off); return; }
    drawAll(o.on);
    const f = o.flare;
    if (f && T < o.at + (f.dur == null ? 0.08 : f.dur)) fillAlpha(ctx, f.x, f.y, f.w, f.h, f.col || P.bone, f.a == null ? 0.15 : f.a);
  }

  B.MotionKit = { span, camSpan, rise, blink, crt, flicker, trace, tally, typeOn, stamp, marker, lamps, weather, motes, figure, passing, ping };
})(window.BTB);
