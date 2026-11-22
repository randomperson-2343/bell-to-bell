// Ending places, part 1 of 3: a backdrop of its own for each ending listed below,
// drawn on the 320x180 art grid behind the ending's prop (js/art/scenes.js endingDetail).
// wiped, fired, nobody, grind, replaced, ward, acquirer.
(function (B) {
  'use strict';
  const PL = B.EndingPlaces = B.EndingPlaces || {};
  const X = B.Pixel, P = B.Pal;
  const R = (c, x, y, w, h, col) => X.rect(c, x, y, w, h, col);
  const c1 = (c, x, y, w, h, base, hi, sh, out) => X.cel(c, x, y, w, h, base, hi, sh, out || P.ink, 1);
  const W = 320, H = 180;

  // ---- shared helpers ----
  function alpha(ctx, a, fn) { ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore(); }
  function disc(ctx, cx, cy, r, col) {
    for (let y = -r; y <= r; y++) { const h = Math.round(Math.sqrt(r * r - y * y)); R(ctx, cx - h, cy + y, h * 2 + 1, 1, col); }
  }
  // Solid horizontal bands, top to bottom: a flat-colour gradient with no dither noise.
  function bands(ctx, x, y, w, h, cols) {
    const n = cols.length;
    for (let i = 0; i < n; i++) { const y0 = y + Math.round(h * i / n), y1 = y + Math.round(h * (i + 1) / n); R(ctx, x, y0, w, y1 - y0, cols[i]); }
  }
  // Stepped elliptical pool of light: three nested rings, each a flat translucent fill.
  function pool(ctx, cx, cy, rx, ry, col, a) {
    for (const f of [1, 0.66, 0.34]) {
      alpha(ctx, a, () => {
        ctx.fillStyle = col;
        const r = Math.max(1, Math.round(ry * f));
        for (let y = -r; y < r; y++) { const h = Math.round(rx * f * Math.sqrt(1 - (y * y) / (r * r))); ctx.fillRect(cx - h, cy + y, h * 2, 1); }
      });
    }
  }
  // Round glow on a wall (taller than a pool).
  function glow(ctx, cx, cy, radii, col, a) {
    for (const rad of radii) {
      alpha(ctx, a, () => {
        ctx.fillStyle = col;
        for (let y = cy - rad; y < cy + rad; y++) { const h = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - cy) * (y - cy))) * 1.25); ctx.fillRect(cx - h, y, h * 2, 1); }
      });
    }
  }
  // A horizontal-edged quad between two widths (a floor, a beam of light, a desk top).
  function trap(ctx, y0, y1, xl0, xr0, xl1, xr1, col) {
    const n = Math.max(1, y1 - y0 - 1);
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / n, xl = Math.round(xl0 + (xl1 - xl0) * t), xr = Math.round(xr0 + (xr1 - xr0) * t);
      R(ctx, xl, y, xr - xl, 1, col);
    }
  }
  // Lines running to a vanishing point: bottom x positions at y = yB.
  function fan(ctx, vx, vy, y0, yB, xs, col) {
    for (const xb of xs) {
      for (let y = y0; y < yB; y++) {
        const t1 = (y - vy) / (yB - vy), t2 = (y + 1 - vy) / (yB - vy);
        const a = Math.round(vx + (xb - vx) * t1), b = Math.round(vx + (xb - vx) * t2);
        R(ctx, Math.min(a, b), y, Math.abs(b - a) + 1, 1, col);
      }
    }
  }
  // Floor tile rows (spacing grows toward the viewer).
  function rows(ctx, y0, y1, n, col) {
    for (let k = 1; k < n; k++) R(ctx, 0, Math.round(y0 + (y1 - y0) * Math.pow(k / n, 1.7)), W, 1, col);
  }
  // A two-colour chequered floor in perspective, from y0 to H.
  function checker(ctx, vx, vy, y0, nRows, xs, colA, colB) {
    const ys = [];
    for (let k = 0; k <= nRows; k++) ys.push(Math.round(y0 + (H - y0) * Math.pow(k / nRows, 1.8)));
    for (let k = 0; k < nRows; k++) {
      for (let y = ys[k]; y < ys[k + 1]; y++) {
        const t = (y - vy) / (H - vy);
        for (let j = 0; j < xs.length - 1; j++) {
          const xl = Math.round(vx + (xs[j] - vx) * t), xr = Math.round(vx + (xs[j + 1] - vx) * t);
          const a = Math.max(0, xl), b = Math.min(W, xr);
          if (b > a) R(ctx, a, y, b - a, 1, (j + k) % 2 ? colB : colA);
        }
      }
    }
  }
  // One desk seen from the aisle: slab, knee panel, monitor, a pushed-in chair.
  function deskUnit(ctx, cx, gy, s, o, k) {
    const w = Math.round(56 * s), dh = Math.max(4, Math.round(20 * s)), th = Math.max(2, Math.round(3 * s));
    const x = cx - (w >> 1), top = gy - dh - th;
    alpha(ctx, 0.4, () => R(ctx, x - 2, gy - 1, w + 8, Math.max(2, Math.round(3 * s)), P.ink));
    R(ctx, x, gy - dh, w, dh, o.body);
    R(ctx, x + Math.round(3 * s), gy - dh + 1, w - Math.round(6 * s), dh - 1, o.knee);
    R(ctx, x, top, w, th, o.top); R(ctx, x, top, w, 1, o.topHi);
    const mw = Math.round(24 * s), mh = Math.round(16 * s), mx = cx - (mw >> 1) - Math.round(8 * s), my = top - mh - Math.max(1, Math.round(3 * s));
    R(ctx, mx + (mw >> 1) - 1, my + mh, 3, Math.max(1, Math.round(3 * s)), o.frame);
    const sc = o.scr(k);
    if (mw >= 9) {
      R(ctx, mx, my, mw, mh, o.frame); R(ctx, mx, my, mw, 1, o.frameHi);
      R(ctx, mx + 1, my + 1, mw - 2, mh - 2, sc[1]); R(ctx, mx + 1, my + 1, mw - 2, Math.max(1, (mh - 2) >> 1), sc[0]);
      if (s > 0.55) { for (let i = 0; i < 4; i++) R(ctx, mx + 3 + i * 4, my + 4 + ((i * 5 + k) % 5), 2, 1, sc[2] || sc[0]); }
    } else R(ctx, mx, my, mw, mh, sc[0]);
    if (o.chairs) {
      const cw = Math.round(16 * s), ch = Math.round(18 * s), chx = cx + Math.round(6 * s), chy = gy - Math.round(26 * s);
      R(ctx, chx - 1, chy - 1, cw + 2, ch + 2, P.ink);
      R(ctx, chx, chy, cw, ch, o.chair); R(ctx, chx, chy, cw, 1, o.chairHi);
      R(ctx, chx + (cw >> 1) - 1, gy - Math.round(8 * s), 2, Math.round(8 * s), P.ink);
      R(ctx, chx - 2, gy - 1, cw + 4, 1, P.ink);
    }
    if (o.floorGlow) pool(ctx, mx + (mw >> 1), gy + Math.round(5 * s), Math.round(30 * s), Math.round(7 * s), o.floorGlow, o.floorA || 0.06);
  }
  // Rows of desks receding along both sides of a central aisle.
  function deskRows(ctx, o) {
    const ss = o.scales;
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i], gy = Math.round(o.hy + (H - o.hy) * s * 0.95 + 4);
      for (const side of [-1, 1]) for (let c = 0; c < o.cols.length; c++) {
        deskUnit(ctx, Math.round(160 + side * o.cols[c] * s), gy, s, o, i * 4 + c * 2 + (side > 0 ? 1 : 0));
      }
    }
  }
  function person(ctx, x, gy, s, col, rim) {
    const h = Math.round(40 * s), hd = Math.round(5 * s), bw = Math.round(11 * s), lg = Math.round(14 * s);
    disc(ctx, x, gy - h + hd, hd, col);
    R(ctx, x - (bw >> 1), gy - h + hd * 2, bw, h - hd * 2 - lg + 2, col);
    R(ctx, x - (bw >> 1), gy - lg, Math.round(4 * s), lg, col); R(ctx, x + 1, gy - lg, Math.round(4 * s), lg, col);
    if (rim) { R(ctx, x - (bw >> 1), gy - h + hd * 2, 1, h - hd * 2 - lg, rim); R(ctx, x - hd, gy - h + hd - 1, 1, 3, rim); }
  }

  // ---------------------------------------------------------------------------
  // wiped: your own desk on the trading floor at night, every screen red.
  PL.wiped = function (ctx) {
    R(ctx, 0, 0, W, H, P.ink);
    R(ctx, 0, 4, W, 56, P.ink2);
    bands(ctx, 0, 6, W, 52, [P.ink, P.ink, P.ink2, P.slate]);
    alpha(ctx, 0.3, () => R(ctx, 0, 46, W, 12, P.crimsonD));
    for (let i = 0; i < 14; i++) {
      const bx = i * 24 - 6, bw = 20 + (i * 7) % 8, bh = 14 + (i * 37) % 24;
      R(ctx, bx, 58 - bh, bw, bh, P.ink);
      for (let wy = 4; wy < bh - 3; wy += 6) for (let wx = 3; wx < bw - 4; wx += 6) if (((i * 5 + wy + wx) % 11) === 0) R(ctx, bx + wx, 58 - bh + wy, 2, 2, P.crimsonD);
    }
    for (let x = 0; x < W; x += 64) R(ctx, x, 4, 4, 56, P.ink);
    R(ctx, 0, 58, W, 4, P.slate); R(ctx, 0, 58, W, 1, P.slate2);
    bands(ctx, 0, 62, W, 24, [P.ink2, P.carpetD]);
    fan(ctx, 160, 60, 66, 100, [-200, -80, 40, 160, 280, 400, 520], P.ink);
    const dim = { body: P.ink2, knee: P.ink, top: P.slate, topHi: P.slate2, frame: P.ink2, frameHi: P.slate, chair: P.ink2, chairHi: P.slate, chairs: false, scr: () => [P.crimsonD, P.ink2, P.crimson] };
    for (const x of [18, 54, 92, 232, 268, 304]) deskUnit(ctx, x, 78, 0.42, dim, x);
    glow(ctx, 41, 58, [60, 40], P.crimson, 0.05); glow(ctx, 279, 58, [60, 40], P.crimson, 0.05);
    // your desk, foreground: a deep top running toward you, red light pooled on it
    bands(ctx, 0, 84, W, 62, [P.deskD, P.deskD, P.deskD, P.desk]);
    R(ctx, 0, 84, W, 2, P.desk);
    alpha(ctx, 0.45, () => R(ctx, 0, 86, W, 60, P.ink));
    alpha(ctx, 0.35, () => fan(ctx, 160, 60, 86, 146, [-300, -120, 40, 160, 280, 440, 620], P.ink));
    R(ctx, 0, 146, W, 4, P.desk2); R(ctx, 0, 150, W, 1, P.ink);
    R(ctx, 0, 151, W, 29, P.ink2);
    pool(ctx, 41, 104, 80, 14, P.crimson, 0.13); pool(ctx, 279, 104, 80, 14, P.crimson, 0.13);
    const mon = (x, y, w, h, seed) => {
      R(ctx, x + (w >> 1) - 5, y + h, 10, 84 - y - h, P.ink2); R(ctx, x + (w >> 1) - 14, 82, 28, 3, P.ink);
      c1(ctx, x, y, w, h, P.ink2, P.slate, P.ink);
      R(ctx, x + 3, y + 3, w - 6, h - 6, P.ink);
      bands(ctx, x + 3, y + 3, w - 6, h - 6, [P.crimsonD, P.crimsonD, P.ink2, P.ink2]);
      for (let i = 0; i < ((w - 8) >> 1); i++) { const yy = y + 8 + Math.floor(i * (h - 20) / ((w - 8) >> 1)) + ((i * 7 + seed) % 4); R(ctx, x + 4 + i * 2, Math.min(y + h - 6, yy), 2, 2, P.crimson); }
      R(ctx, x + 3, y + h - 8, w - 6, 1, P.crimsonD);
    };
    mon(6, 32, 70, 46, 1); mon(244, 40, 70, 40, 3);
    // keyboards, a cold mug, a dead phone, sheets already on the desk
    c1(ctx, 18, 108, 50, 12, P.slate, P.slate2, P.ink2); c1(ctx, 250, 104, 44, 11, P.slate, P.slate2, P.ink2);
    c1(ctx, 84, 118, 12, 13, P.bone, P.white, P.putty2); R(ctx, 96, 122, 3, 6, P.putty2);
    c1(ctx, 226, 124, 20, 11, P.ink2, P.slate, P.ink); R(ctx, 230, 127, 6, 3, P.screenGlow);
    c1(ctx, 100, 96, 14, 4, P.bone, P.white, P.putty2); c1(ctx, 206, 96, 12, 4, P.putty2, P.white, P.putty);
    c1(ctx, 22, 130, 28, 9, P.bone, P.white, P.putty2);
    alpha(ctx, 0.3, () => R(ctx, 126, 100, 66, 6, P.ink));
  };

  // ---------------------------------------------------------------------------
  // fired: the ground-floor lobby: security desk, turnstiles, revolving doors.
  PL.fired = function (ctx) {
    R(ctx, 0, 0, W, H, P.ink2);
    R(ctx, 0, 0, W, 12, P.ink); R(ctx, 0, 12, W, 1, P.slate);
    for (const lx of [24, 116, 208]) { R(ctx, lx, 4, 52, 3, P.bone); R(ctx, lx, 7, 52, 1, P.putty); }
    bands(ctx, 0, 13, W, 78, [P.slate, P.slate, P.ink2]);
    for (const px of [96, 214]) { R(ctx, px, 13, 8, 80, P.slate2); R(ctx, px, 13, 2, 80, P.grey); R(ctx, px + 6, 13, 2, 80, P.ink2); }
    for (let x = 108; x < 212; x += 26) R(ctx, x, 20, 1, 60, P.slate2);
    X.text(ctx, 'HOLLOWAY STERN', 160, 17, P.putty, { align: 'center' });
    glow(ctx, 70, 12, [34, 22], P.amber, 0.05); glow(ctx, 160, 12, [40, 24], P.amber, 0.05);
    R(ctx, 0, 90, W, 90, P.ink);
    checker(ctx, 160, 90, 90, 7, [-500, -430, -360, -290, -220, -150, -80, -10, 60, 130, 200, 270, 340, 410, 480, 550, 620, 690, 760, 830], P.ink2, P.ink);
    // revolving doors with the dusk street beyond
    c1(ctx, 222, 16, 82, 80, P.grey, P.grey2, P.slate2);
    R(ctx, 228, 22, 70, 70, P.ink);
    bands(ctx, 228, 22, 70, 46, [P.slate2, P.grey, P.amberD, P.amber]);
    for (let i = 0; i < 6; i++) { const bh = 8 + (i * 13) % 20; R(ctx, 228 + i * 12, 68 - bh, 11, bh, i % 2 ? P.slate : P.ink2); R(ctx, 231 + i * 12, 68 - bh + 3, 2, 2, P.amber); }
    R(ctx, 228, 68, 70, 24, P.slate); R(ctx, 228, 68, 70, 6, P.amberD);
    R(ctx, 228, 68, 70, 1, P.grey);
    R(ctx, 262, 22, 3, 70, P.grey2); R(ctx, 262, 22, 1, 70, P.white);
    alpha(ctx, 0.25, () => { R(ctx, 232, 24, 26, 64, P.white); R(ctx, 268, 24, 26, 64, P.sky); });
    R(ctx, 228, 56, 70, 2, P.grey); R(ctx, 222, 92, 82, 4, P.slate2);
    // cold street light spilling across the floor
    for (const f of [1, 0.7, 0.4]) alpha(ctx, 0.1, () => trap(ctx, 96, 180, Math.round(228 + 30 * (1 - f)), Math.round(298 - 30 * (1 - f)), Math.round(120 + 95 * (1 - f)), Math.round(300 + 40 * f), P.sky));
    // security desk, a guard behind it, a monitor wall
    c1(ctx, 24, 28, 56, 26, P.ink, P.slate, P.ink); R(ctx, 27, 31, 50, 20, P.screenD);
    for (let i = 0; i < 3; i++) { R(ctx, 29 + i * 16, 33, 14, 8, P.screenGlow); R(ctx, 29 + i * 16, 44, 14, 5, P.screenGlow); }
    glow(ctx, 52, 44, [36], P.sky, 0.04);
    R(ctx, 44, 60, 16, 22, P.ink); R(ctx, 46, 62, 12, 18, P.slate); disc(ctx, 52, 56, 5, P.putty); R(ctx, 47, 50, 11, 3, P.ink);
    c1(ctx, 6, 74, 90, 28, P.slate2, P.grey, P.slate); R(ctx, 4, 70, 94, 5, P.putty2); R(ctx, 4, 70, 94, 1, P.white); R(ctx, 4, 75, 94, 1, P.putty);
    for (let i = 0; i < 4; i++) R(ctx, 12 + i * 22, 82, 14, 14, P.slate);
    c1(ctx, 70, 62, 14, 9, P.ink2, P.slate, P.ink); R(ctx, 72, 64, 10, 5, P.screenGlow);
    // turnstile bank: a stone ledge for the box, glass flaps either end
    R(ctx, 98, 80, 118, 3, P.putty2); R(ctx, 98, 80, 118, 1, P.white); R(ctx, 98, 83, 118, 2, P.putty);
    R(ctx, 98, 85, 118, 14, P.slate2); R(ctx, 98, 85, 118, 1, P.grey2); R(ctx, 98, 98, 118, 2, P.ink);
    for (const gx of [100, 160, 210]) { R(ctx, gx, 89, 5, 2, P.amber); R(ctx, gx + 1, 92, 3, 1, P.amberD); }
    for (const px of [98, 210]) { R(ctx, px, 68, 6, 32, P.grey); R(ctx, px, 68, 1, 32, P.grey2); R(ctx, px + 5, 68, 1, 32, P.slate); }
    alpha(ctx, 0.3, () => { R(ctx, 104, 70, 4, 12, P.sky); R(ctx, 202, 70, 4, 12, P.sky); });
    alpha(ctx, 0.35, () => R(ctx, 112, 80, 94, 3, P.ink));
    pool(ctx, 150, 150, 80, 14, P.amber, 0.06); pool(ctx, 60, 140, 46, 9, P.amber, 0.05);
    R(ctx, 0, 100, W, 1, P.slate2);
  };

  // ---------------------------------------------------------------------------
  // nobody: the trading floor with no humans: empty chairs, desks to a far bench, screen light only.
  PL.nobody = function (ctx) {
    R(ctx, 0, 0, W, H, P.ink);
    bands(ctx, 0, 0, W, 84, [P.ink, P.ink2]);
    fan(ctx, 160, 84, 0, 60, [-200, -80, 40, 160, 280, 400, 520], P.ink2);
    for (let i = 0; i < 4; i++) { const y = 30 - i * 7; R(ctx, 60 - i * 8, y, 20, 2, P.ink2); R(ctx, 240 + i * 8, y, 20, 2, P.ink2); }
    bands(ctx, 0, 84, W, 96, [P.carpetD, P.ink2, P.ink]);
    fan(ctx, 160, 84, 88, H, [-300, -180, -60, 60, 160, 260, 380, 500, 620], P.ink2);
    rows(ctx, 88, H, 9, P.ink2);
    R(ctx, 74, 80, 172, 10, P.deskD); R(ctx, 74, 80, 172, 2, P.desk); R(ctx, 74, 90, 172, 4, P.ink2);
    const o = { hy: 84, scales: [0.2, 0.28, 0.39, 0.54, 0.74, 1.0], cols: [74, 160], body: P.ink2, knee: P.ink, top: P.slate, topHi: P.slate2, frame: P.ink2, frameHi: P.slate, chair: P.ink2, chairHi: P.slate, chairs: true, floorGlow: P.crimson, floorA: 0.07, scr: (k) => (k % 5 === 0 ? [P.crimsonD, P.ink, P.crimson] : [P.crimsonD, P.screenD, P.crimson]) };
    deskRows(ctx, o);
    for (const f of [1, 0.66, 0.36]) alpha(ctx, 0.05, () => trap(ctx, 90, H, Math.round(160 - 36 * f), Math.round(160 + 36 * f), Math.round(160 - 130 * f), Math.round(160 + 130 * f), P.crimson));
  };

  // ---------------------------------------------------------------------------
  // grind: the same floor on an ordinary morning: tall windows, daylight shafts, desks, arrivals.
  PL.grind = function (ctx) {
    R(ctx, 0, 0, W, H, P.putty);
    R(ctx, 0, 0, W, 78, P.putty2);
    for (let i = 0; i < 5; i++) {
      const wx = 10 + i * 62;
      R(ctx, wx - 1, 3, 54, 74, P.slate2);
      bands(ctx, wx + 1, 5, 50, 70, [P.sky, P.grey2, P.bone, P.white]);
      for (let b = 0; b < 4; b++) { const bh = 8 + ((i * 3 + b) * 13) % 22; R(ctx, wx + 1 + b * 13, 75 - bh, 12, bh, P.grey2); R(ctx, wx + 1 + b * 13, 75 - bh, 12, 1, P.white); }
      R(ctx, wx + 25, 5, 2, 70, P.slate2); R(ctx, wx + 1, 30, 50, 2, P.slate2);
    }
    R(ctx, 0, 76, W, 5, P.putty); R(ctx, 0, 76, W, 1, P.white); R(ctx, 0, 0, W, 3, P.slate2);
    bands(ctx, 0, 81, W, 99, [P.carpet2, P.carpet]);
    fan(ctx, 160, 80, 84, H, [-300, -180, -60, 60, 160, 260, 380, 500, 620], P.carpet);
    rows(ctx, 84, H, 9, P.carpet);
    for (let i = 0; i < 5; i++) {
      const wx = 10 + i * 62;
      for (const pad of [0, 8]) alpha(ctx, 0.15, () => {
        for (let y = 84; y < H; y++) {
          const f = 1 + (y - 84) / 40, xl = Math.round(160 + (wx + pad - 160) * f), xr = Math.round(160 + (wx + 52 - pad - 160) * f);
          R(ctx, xl, y, xr - xl, 1, P.white);
        }
      });
    }
    const o = { hy: 82, scales: [0.2, 0.28, 0.39, 0.54, 0.74, 1.0], cols: [74, 160], body: P.deskD, knee: P.ink2, top: P.desk2, topHi: P.putty2, frame: P.slate, frameHi: P.slate2, chair: P.slate, chairHi: P.slate2, chairs: true, scr: (k) => (k % 3 === 0 ? [P.sky, P.slate, P.white] : k % 3 === 1 ? [P.jadeD, P.screenD, P.phosphor] : [P.slate2, P.screenD, P.sky]) };
    deskRows(ctx, o);
    alpha(ctx, 0.3, () => { R(ctx, 46, 152, 22, 3, P.ink); R(ctx, 254, 150, 22, 3, P.ink); });
    person(ctx, 54, 152, 1.0, P.ink2, P.amber); person(ctx, 262, 150, 1.0, P.ink2, P.amber);
    R(ctx, 267, 124, 4, 5, P.bone);
    glow(ctx, 160, 30, [70, 46], P.amber, 0.05);
  };

  // ---------------------------------------------------------------------------
  // replaced: a cold blue server hall where the desks used to be.
  PL.replaced = function (ctx) {
    R(ctx, 0, 0, W, H, P.ink);
    bands(ctx, 0, 0, W, 50, [P.ink, P.ink2]);
    fan(ctx, 160, 50, 0, 50, [-120, 0, 100, 220, 320, 440], P.slate);
    for (const xb of [-40, 60, 260, 360]) for (let y = 0; y < 50; y++) {
      const x = Math.round(160 + (xb - 160) * (50 - y) / 50);
      R(ctx, x, y, 3, 1, (y % 4 < 2) ? P.slate2 : P.slate);
    }
    for (let i = 0; i < 4; i++) R(ctx, 0, 6 + i * 10 + i * i * 2, W, 2 + (i >> 1), P.ink2);
    for (const lx of [40, 130, 190, 280]) { R(ctx, lx, 12, 24, 2, P.white); alpha(ctx, 0.07, () => R(ctx, lx - 4, 14, 32, 14, P.sky)); }
    bands(ctx, 0, 50, W, 34, [P.ink2, P.slate]);
    bands(ctx, 0, 84, W, 96, [P.slate, P.slate, P.ink2]);
    fan(ctx, 160, 84, 84, H, [-500, -400, -300, -200, -100, 0, 80, 160, 240, 320, 400, 480, 560, 660, 760, 860], P.ink);
    rows(ctx, 84, H, 10, P.ink);
    for (const side of [-1, 1]) for (const s of [0.5, 0.64, 0.8, 1.0]) {
      const gy = Math.round(84 + 96 * s), cx = Math.round(160 + side * 150 * s), w = Math.round(30 * s), h = Math.round(96 * s);
      c1(ctx, cx - (w >> 1), gy - h, w, h, P.ink2, P.slate, P.ink);
      for (let r = 0; r < 7; r++) {
        R(ctx, cx - (w >> 1) + 3, gy - h + 5 + r * Math.round(12 * s), w - 6, Math.round(6 * s), P.screenD);
        R(ctx, cx - (w >> 1) + 4 + (r * 3) % 6, gy - h + 7 + r * Math.round(12 * s), 2, 2, (r + Math.round(s * 9)) % 3 ? P.phosphor : P.sky);
      }
      alpha(ctx, 0.3, () => R(ctx, cx - (w >> 1) - 1, gy - 1, w + 8, 3, P.ink));
    }
    for (const lx of [90, 150, 215]) pool(ctx, lx, 100 + (lx % 7) * 3, 36, 8, P.sky, 0.07);
    for (const f of [1, 0.66, 0.36]) alpha(ctx, 0.06, () => trap(ctx, 86, H, Math.round(160 - 30 * f), Math.round(160 + 30 * f), Math.round(160 - 120 * f), Math.round(160 + 120 * f), P.sky));
    // a desk's outline taped on the floor, and the one chair left behind
    const y0 = 142, y1 = 176, xl0 = 214, xr0 = 280, xl1 = 190, xr1 = 306;
    R(ctx, xl0, y0, xr0 - xl0, 2, P.amber); R(ctx, xl1, y1 - 2, xr1 - xl1, 2, P.amber);
    for (let y = y0; y < y1; y++) { const t = (y - y0) / (y1 - y0), xl = Math.round(xl0 + (xl1 - xl0) * t), xr = Math.round(xr0 + (xr1 - xr0) * t); R(ctx, xl, y, 2, 1, P.amber); R(ctx, xr - 2, y, 2, 1, P.amber); }
    c1(ctx, 50, 120, 22, 22, P.slate, P.slate2, P.ink2);
    c1(ctx, 46, 140, 30, 7, P.slate, P.slate2, P.ink2); R(ctx, 59, 147, 4, 12, P.ink); R(ctx, 48, 159, 26, 2, P.ink); R(ctx, 46, 160, 4, 2, P.ink); R(ctx, 72, 160, 4, 2, P.ink);
    alpha(ctx, 0.4, () => R(ctx, 44, 162, 34, 3, P.ink));
  };

  // ---------------------------------------------------------------------------
  // ward: the Holloway Stern atrium, government banners, marble floor, the ceremonial frontage seen through glass.
  PL.ward = function (ctx) {
    R(ctx, 0, 0, W, H, P.ink2);
    R(ctx, 0, 0, W, 6, P.ink);
    R(ctx, 64, 4, 192, 82, P.ink);
    bands(ctx, 68, 6, 184, 78, [P.grey2, P.putty2, P.bone]);
    for (let i = 0; i < 9; i++) { const bh = 10 + (i * 17) % 18; R(ctx, 68 + i * 21, 82 - bh, 20, bh, P.grey); }
    R(ctx, 68, 80, 184, 4, P.putty);
    for (const mx of [68, 98, 214, 250]) R(ctx, mx, 4, 4, 82, P.slate);
    R(ctx, 64, 4, 192, 3, P.slate); R(ctx, 64, 84, 192, 4, P.slate2); R(ctx, 64, 84, 192, 1, P.grey);
    for (const x of [0, 256]) bands(ctx, x, 6, 64, 80, [P.slate, P.ink2]);
    for (const x of [58, 256]) { R(ctx, x, 6, 6, 82, P.slate2); R(ctx, x, 6, 2, 82, P.grey); }
    const banner = (bx) => {
      R(ctx, bx - 2, 8, 30, 3, P.amberD); R(ctx, bx - 2, 8, 30, 1, P.amber);
      c1(ctx, bx, 11, 26, 58, P.ink2, P.slate, P.ink);
      R(ctx, bx + 3, 14, 20, 52, P.crimsonD);
      disc(ctx, bx + 13, 34, 9, P.amberD); disc(ctx, bx + 13, 34, 7, P.ink2); disc(ctx, bx + 13, 34, 4, P.amber); R(ctx, bx + 12, 31, 2, 6, P.ink2);
      for (let i = 0; i < 5; i++) R(ctx, bx + 4 + i * 4, 66, 2, 4, P.amberD);
      X.text(ctx, 'STATE', bx + 13, 50, P.bone, { align: 'center' });
    };
    banner(18); banner(278);
    R(ctx, 0, 88, W, 92, P.slate);
    checker(ctx, 160, 88, 88, 8, [-480, -340, -200, -60, 80, 220, 360, 500, 640, 780], P.slate2, P.slate);
    for (const f of [1, 0.7, 0.4]) alpha(ctx, 0.11, () => trap(ctx, 90, H, Math.round(160 - 90 * f), Math.round(160 + 90 * f), Math.round(160 - 190 * f), Math.round(160 + 190 * f), P.white));
    c1(ctx, 20, 96, 70, 26, P.slate2, P.grey, P.slate); R(ctx, 18, 94, 74, 4, P.putty2); R(ctx, 18, 94, 74, 1, P.white);
    for (const sx of [120, 150, 180, 210]) { R(ctx, sx, 92, 2, 12, P.amberD); R(ctx, sx - 1, 104, 4, 2, P.ink); }
    R(ctx, 120, 94, 90, 1, P.crimsonD);
    X.text(ctx, 'HLST', 55, 104, P.ink, { align: 'center' });
    alpha(ctx, 0.3, () => R(ctx, 243, 164, 18, 3, P.ink));
    person(ctx, 250, 164, 0.8, P.ink, P.grey2);
  };

  // ---------------------------------------------------------------------------
  // acquirer: a financial-district street at golden hour, a crane over a scaffolded old sign.
  PL.acquirer = function (ctx) {
    bands(ctx, 0, 0, W, 90, [P.sky, P.sky, P.grey2, P.putty2, P.amber]);
    glow(ctx, 160, 86, [90, 60, 32], P.amber, 0.1);
    disc(ctx, 160, 88, 9, P.white);
    for (let i = 0; i < 12; i++) {
      const bx = i * 28 - 4, bw = 22 + (i * 11) % 12, bh = 24 + (i * 29) % 40;
      R(ctx, bx, 88 - bh, bw, bh, P.slate2); R(ctx, bx, 88 - bh, 2, bh, P.amberD); R(ctx, bx + bw - 4, 88 - bh, 4, bh, P.slate);
      for (let wy = 4; wy < bh - 4; wy += 6) if ((i + wy) % 3 === 0) R(ctx, bx + 6, 88 - bh + wy, 2, 2, P.amber);
    }
    bands(ctx, 0, 88, W, 92, [P.slate2, P.slate, P.ink2]);
    R(ctx, 0, 88, W, 1, P.amberD);
    fan(ctx, 160, 88, 90, H, [-100, 0, 100, 220, 300, 420], P.slate);
    for (let k = 0; k < 6; k++) { const y = 94 + k * k * 2 + k * 3; R(ctx, 156 - k, y, 8 + 2 * k, 1 + (k >> 1), P.putty2); }
    // left building with scaffolding and Ridgeway's old sign
    R(ctx, 0, 10, 72, 98, P.crimsonD); R(ctx, 0, 10, 72, 2, P.crimson); R(ctx, 64, 12, 8, 96, P.ink2);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) R(ctx, 6 + c * 15, 24 + r * 14, 9, 8, (r + c) % 3 ? P.ink2 : P.amber);
    for (let x = 2; x < 70; x += 17) R(ctx, x, 14, 2, 92, P.ink);
    for (let y = 26; y < 100; y += 22) R(ctx, 0, y, 72, 2, P.ink);
    c1(ctx, 6, 42, 62, 12, P.bone, P.white, P.putty2); X.text(ctx, 'RIDGEWAY', 37, 45, P.crimsonD, { align: 'center' });
    // right building and the tower crane
    R(ctx, 258, 40, 62, 66, P.slate); R(ctx, 258, 40, 2, 66, P.amberD); R(ctx, 258, 40, 62, 2, P.slate2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) R(ctx, 266 + c * 17, 50 + r * 13, 10, 7, (r + c) % 2 ? P.ink2 : P.amberD);
    R(ctx, 296, 4, 4, 40, P.amberD); R(ctx, 296, 4, 1, 40, P.amber); for (let y = 6; y < 40; y += 6) R(ctx, 297, y, 3, 1, P.ink);
    R(ctx, 190, 14, 124, 3, P.amberD); R(ctx, 190, 14, 124, 1, P.amber); R(ctx, 300, 4, 16, 2, P.amberD); R(ctx, 306, 17, 8, 6, P.ink2);
    for (const f of [1, 0.66, 0.36]) alpha(ctx, 0.13, () => trap(ctx, 90, H, Math.round(100 - 30 * f), Math.round(100 + 40 * f), Math.round(40 - 150 * f), Math.round(100 + 160 * f), P.amber));
    alpha(ctx, 0.22, () => { trap(ctx, 90, 180, 150, 280, 200, 420, P.ink); trap(ctx, 90, 180, 70, 90, 110, 150, P.ink); });
    const barrier = (x, y, w) => {
      R(ctx, x + 2, y + 10, 3, 12, P.ink); R(ctx, x + w - 5, y + 10, 3, 12, P.ink);
      R(ctx, x, y, w, 12, P.ink);
      for (let i = 0; i < w - 2; i += 8) { R(ctx, x + 1 + i, y + 1, 4, 10, P.bone); R(ctx, x + 5 + i, y + 1, 4, 10, P.crimson); }
      R(ctx, x, y, w, 1, P.white);
    };
    barrier(12, 140, 72); barrier(104, 148, 80); barrier(228, 142, 76);
    for (const c of [[96, 160], [196, 164], [214, 156]]) { R(ctx, c[0] - 5, c[1] + 7, 10, 2, P.ink); R(ctx, c[0] - 3, c[1] + 2, 6, 5, P.amber); R(ctx, c[0] - 2, c[1] - 4, 4, 6, P.amber); R(ctx, c[0] - 3, c[1] + 3, 6, 1, P.bone); }
  };
})(window.BTB);
