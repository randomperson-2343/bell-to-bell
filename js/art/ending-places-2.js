// Ending places, part 2 of 3: a backdrop of its own for each ending listed below,
// drawn on the 320x180 art grid behind the ending's prop (js/art/scenes.js endingDetail).
(function (B) {
  'use strict';
  const PL = B.EndingPlaces = B.EndingPlaces || {};
  const X = B.Pixel, P = B.Pal;
  const R = (ctx, x, y, w, h, c) => X.rect(ctx, x, y, w, h, c);
  const C = (ctx, x, y, w, h, base, hi, sh, out) => X.cel(ctx, x, y, w, h, base, hi, sh, out, 1);
  const G = (ctx, x, y, w, h, a, b, n) => X.gradient(ctx, x, y, w, h, a, b, n);
  const D = (ctx, x, y, w, h, a, b, f) => X.dither(ctx, x, y, w, h, a, b, f);
  // A pixel line (Bresenham) of 1px squares, or t x t.
  function line(ctx, x0, y0, x1, y1, col, t) {
    t = t || 1; ctx.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // A filled ellipse, row by row.
  function ell(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) { const h = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.5); ctx.fillRect(cx - h, cy + y, h * 2, 1); }
  }
  // Stepped light: soft ellipses stacked at low alpha.
  function glow(ctx, cx, cy, rx, ry, col, a, steps) {
    ctx.save(); ctx.globalAlpha = a;
    for (let i = 0; i < (steps || 3); i++) { const k = 1 - i / (steps || 3); ell(ctx, cx, cy, Math.round(rx * k), Math.round(ry * k), col); }
    ctx.restore();
  }
  // A trapezoid between two rows: left/right edges at the top and the bottom.
  function trap(ctx, y0, y1, l0, r0, l1, r1, col) {
    ctx.fillStyle = col;
    for (let y = y0; y <= y1; y++) { const f = (y - y0) / Math.max(1, y1 - y0); const l = Math.round(l0 + (l1 - l0) * f), r = Math.round(r0 + (r1 - r0) * f); ctx.fillRect(l, y, Math.max(0, r - l), 1); }
  }
  function alpha(ctx, a, fn) { ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore(); }
  // A small standing silhouette (person), feet at y.
  function person(ctx, x, y, col, h) {
    h = h || 10; const hh = Math.round(h * 0.3);
    R(ctx, x, y - h, 3, hh, col); R(ctx, x - 1, y - h + hh, 5, h - hh - 3, col); R(ctx, x, y - 3, 1, 3, col); R(ctx, x + 2, y - 3, 1, 3, col);
  }
  function palm(ctx, x, y, h, lean, col, col2) {
    // a curved, stepped trunk, 5px at the foot narrowing to 3, with ring marks
    let tx = x, ty = y;
    for (let i = 0; i < h; i++) {
      const t = i / h; tx = x + Math.round(lean * t * t);
      R(ctx, tx, y - i, i < h * 0.3 ? 7 : i < h * 0.7 ? 6 : 5, 1, col); R(ctx, tx, y - i, 1, 1, P.amberD); if (i % 6 === 0) R(ctx, tx + 2, y - i, 2, 1, col2);
    }
    ty = y - h; tx += 1;
    // fronds: arched leaves 3px thick that droop at the tips
    const fr = [[-28, 6], [-24, -4], [-14, -13], [0, -16], [14, -13], [25, -4], [29, 6], [-16, 12], [18, 12], [0, 8]];
    for (const f of fr) {
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = tx + Math.round(f[0] * t), py = ty + Math.round(f[1] * t * (2 - t) - (f[1] > -9 ? 0 : 0) + 7 * t * t);
        R(ctx, px, py, 4, i < n * 0.7 ? 4 : 3, col); if (i % 3 === 1) R(ctx, px - 1, py + 4, 3, 2, col2);
      }
    }
    ell(ctx, tx, ty + 1, 4, 4, col2); R(ctx, tx - 2, ty + 3, 2, 3, col); R(ctx, tx + 1, ty + 3, 2, 3, col);
  }

  // ---- 1. master: Port Solace harbour at sunset ----
  PL.master = function (ctx) {
    G(ctx, 0, 0, 320, 26, P.slate2, P.violet, 5);
    G(ctx, 0, 26, 320, 26, P.violet, P.crimson, 6);
    G(ctx, 0, 52, 320, 27, P.crimson, P.amber, 7);
    // low clouds
    for (let i = 0; i < 6; i++) { const x = 20 + i * 52 + (i % 2) * 14, y = 18 + (i * 13) % 30; R(ctx, x, y, 34 - (i % 3) * 6, 3, P.crimsonD); R(ctx, x + 4, y - 2, 20, 2, P.crimson); R(ctx, x + 8, y + 3, 24, 1, P.amber); }
    // sun, low, with stepped glow
    glow(ctx, 274, 76, 62, 30, P.amber, 0.14, 4);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 320, 79); ctx.clip(); ell(ctx, 274, 76, 14, 14, P.amber); ell(ctx, 274, 77, 10, 10, P.white); ctx.restore();
    // far headland, right, and the green hills, left
    trap(ctx, 64, 78, 226, 238, 204, 252, P.violet);
    trap(ctx, 71, 78, 236, 244, 224, 256, P.slate2);
    R(ctx, 0, 78, 320, 1, P.slate2);
    const hill = [[0, 44, 70], [30, 36, 64], [64, 50, 44]];
    for (const h of hill) { for (let x = 0; x < h[2]; x++) { const t = (x / h[2]) * 2 - 1; const hh = Math.round(h[1] * (1 - t * t) * 0.55); R(ctx, h[0] + x, 78 - hh, 1, hh, P.jadeD); if (x < h[2] / 2) R(ctx, h[0] + x, 78 - hh, 1, 1, P.jade); } }
    // lit top edges and shaded undersides on the hills
    for (let x = 0; x < 96; x += 4) R(ctx, x, 70 + ((x * 5) % 6), 3, 1, P.jade);
    // the white town climbing the shore
    for (let i = 0; i < 11; i++) {
      const x = 2 + i * 7, w = 5 + (i % 3), h = 5 + ((i * 5) % 7), y = 78 - h - ((i % 4) === 0 ? 3 : 0);
      R(ctx, x, y, w, h, P.white); R(ctx, x + w - 2, y, 2, h, P.putty2); R(ctx, x, y - 1, w, 1, i % 3 ? P.crimson : P.crimsonD);
      R(ctx, x + 1, y + 2, 1, 2, P.slate2); if (w > 5) R(ctx, x + 3, y + 2, 1, 2, P.slate2);
    }
    R(ctx, 46, 58, 2, 6, P.white); R(ctx, 45, 56, 4, 3, P.amber); // church tower
    R(ctx, 0, 78, 84, 3, P.slate2); // sea wall
    // sea: tones that meet the prop's own water band
    D(ctx, 0, 79, 320, 18, P.slate2, P.amberD, 0.35);
    G(ctx, 0, 97, 320, 48, P.screen, P.slate, 8);
    D(ctx, 0, 97, 320, 14, P.screen, P.sky, 0.3);
    // sun's road on the water: widening amber bars
    for (let i = 0; i < 12; i++) { const y = 98 + i * 4, w = 20 + i * 4 - ((i * 7) % 5); R(ctx, 274 - (w >> 1) + ((i * 3) % 5) - 2, y, w, 2, i < 4 ? P.amber : P.amberD); if (i % 2) R(ctx, 274 - (w >> 2), y, w >> 1, 1, P.white); }
    // ripple glints
    for (let i = 0; i < 18; i++) R(ctx, (i * 53) % 300 + 6, 100 + ((i * 29) % 40), 6 + (i % 3) * 2, 1, i % 3 ? P.sky : P.slate2);
    // small boats off the moorings
    for (const b of [[28, 92], [66, 103]]) { R(ctx, b[0], b[1], 12, 3, P.white); R(ctx, b[0] + 2, b[1] + 3, 8, 1, P.putty2); R(ctx, b[0] + 6, b[1] - 8, 1, 8, P.putty2); R(ctx, b[0] + 7, b[1] - 7, 4, 6, P.bone); }
    // quay in the foreground: dark stone, lit lip, bollards, mooring rope
    trap(ctx, 146, 180, 0, 320, 0, 320, P.ink);
    R(ctx, 0, 146, 320, 3, P.putty); R(ctx, 0, 146, 320, 1, P.putty2); R(ctx, 0, 149, 320, 2, P.ink2);
    for (let i = 0; i < 9; i++) { R(ctx, i * 40 + 6, 152, 1, 28, P.ink2); }
    for (let x = 0; x < 320; x += 38) R(ctx, x, 164 + ((x / 38) % 2) * 6, 38, 1, P.ink2);
    for (const bx of [92, 214]) { C(ctx, bx, 138, 8, 9, P.slate2, P.grey2, P.slate, P.ink); R(ctx, bx - 1, 146, 10, 2, P.ink); }
    line(ctx, 96, 143, 150, 156, P.amberD, 1);
    // sun light warm on the quay lip
    D(ctx, 150, 146, 150, 3, P.putty, P.amber, 0.6);
    // palm silhouettes in front, left
    palm(ctx, 30, 150, 112, 14, P.ink, P.ink2);
    palm(ctx, 300, 150, 100, -16, P.ink, P.ink2);
    person(ctx, 160, 146, P.ink, 12); person(ctx, 168, 146, P.ink, 11);
  };

  function flag(ctx, x, top, bot, cols) {
    R(ctx, x, top, 2, bot - top, P.grey2); R(ctx, x, top, 2, 1, P.white); R(ctx, x - 1, top - 2, 4, 2, P.amber);
    for (let i = 0; i < 3; i++) { for (let k = 0; k < 20; k++) R(ctx, x + 2 + k, top + 3 + i * 4 + Math.round(Math.sin(k * 0.45 + i) * 1.4), 1, 4, cols[i]); }
    R(ctx, x + 2, top + 3, 8, 6, P.sky);
    for (let i = 0; i < 4; i++) R(ctx, x + 3 + (i % 2) * 3, top + 4 + (i >> 1) * 3, 1, 1, P.white);
  }

  // ---- 2. revolving: the Treasury steps, and the glass bank next door ----
  PL.revolving = function (ctx) {
    G(ctx, 0, 0, 320, 90, P.sky, P.bone, 9);
    glow(ctx, 40, 6, 90, 40, P.white, 0.1, 3);
    // government building: pale stone, window rows, a stepped cornice
    C(ctx, 44, 14, 236, 72, P.putty2, P.bone, P.putty, P.slate2);
    R(ctx, 44, 14, 236, 3, P.bone); R(ctx, 44, 17, 236, 1, P.putty);
    for (const sx of [46, 252]) for (let row = 0; row < 4; row++) for (let c = 0; c < 4; c++) {
      const x = sx + 2 + c * 7, y = 24 + row * 14;
      C(ctx, x, y, 6, 10, P.sky, P.bone, P.slate2, P.slate); R(ctx, x + 1, y + 1, 1, 7, P.white); R(ctx, x + 3, y + 2, 1, 4, P.white);
    }
    // the glass bank tower, left, reflected in those panes
    R(ctx, 4, 0, 40, 110, P.ink2); R(ctx, 6, 0, 36, 108, P.slate2);
    G(ctx, 6, 0, 36, 108, P.sky, P.slate2, 10);
    for (let y = 4; y < 108; y += 6) R(ctx, 6, y, 36, 1, P.slate);
    for (let x = 12; x < 42; x += 8) R(ctx, x, 0, 1, 108, P.slate);
    for (let i = 0; i < 6; i++) line(ctx, 8 + i * 6, 40, 20 + i * 6, 10, P.white, 1);
    R(ctx, 6, 0, 3, 108, P.white); R(ctx, 39, 0, 3, 108, P.ink2); R(ctx, 4, 108, 40, 2, P.ink);
    R(ctx, 14, 98, 20, 10, P.ink2); X.text(ctx, 'RT', 24, 100, P.amber, { align: 'center' });
    // tower reflected as a long slanted sky streak in the near windows
    for (let row = 0; row < 4; row++) R(ctx, 254, 25 + row * 14, 3, 8, P.slate2);
    // flags
    flag(ctx, 74, 24, 84, [P.crimson, P.bone, P.slate2]);
    flag(ctx, 242, 24, 84, [P.crimson, P.bone, P.slate2]);
    // the steps: nine treads widening toward us, lit top, shaded risers
    const y0 = 84;
    R(ctx, 0, 84, 320, 100, P.putty2); R(ctx, 0, 84, 320, 2, P.putty); D(ctx, 0, 86, 320, 30, P.putty, P.putty2, 0.5);
    R(ctx, 0, 110, 46, 6, P.slate2); R(ctx, 0, 110, 46, 1, P.grey2); R(ctx, 282, 84, 38, 2, P.slate2);
    for (let i = 0; i < 9; i++) {
      const ya = y0 + i * i * 0.35 + i * 5 | 0, yb = y0 + (i + 1) * (i + 1) * 0.35 + (i + 1) * 5 | 0;
      const l = Math.round(84 - i * 7.5), r = 236 + Math.round(i * 7.5);
      const rh = Math.max(2, Math.round((yb - ya) * 0.35));
      R(ctx, l, ya, r - l, yb - ya - rh, P.bone); R(ctx, l, ya, r - l, 1, P.white);
      R(ctx, l, yb - rh, r - l, rh, P.putty); R(ctx, l, yb - 1, r - l, 1, P.slate2);
      D(ctx, l, ya + 1, r - l, 2, P.bone, P.putty, 0.4);
      // shadow of the columns falling across the tread
      for (let c = 0; c < 5; c++) { const sx = 102 + c * 28 - Math.round(i * 4) + 6 + i * 3; alpha(ctx, 0.28, () => R(ctx, sx, ya + 1, 10 + i, yb - ya - 1, P.slate)); }
    }
    const yb = y0 + 81 * 0.35 + 45 | 0;
    // side walls (cheek walls) of the stair, in shade
    trap(ctx, y0, yb, 78, 84, 8, 20, P.slate2); trap(ctx, y0, yb, 236, 242, 320, 312, P.putty);
    // plaza: paving seams converging toward the door
    R(ctx, 0, yb, 320, 180 - yb, P.putty2);
    for (let i = -8; i <= 8; i++) line(ctx, 160 + i * 6, yb, 160 + i * 36, 180, P.putty, 1);
    for (let k = 0; k < 5; k++) { const y = yb + Math.round(Math.pow(k / 5, 1.6) * (180 - yb)) + 3; R(ctx, 0, y, 320, 1, P.putty); }
    D(ctx, 0, yb, 320, 10, P.putty2, P.putty, 0.5);
    // light from the upper left: a long warm shadow of the left flagpole and a bright patch on the plaza
    alpha(ctx, 0.2, () => trap(ctx, yb, 180, 20, 70, -20, 40, P.slate));
    glow(ctx, 210, 160, 70, 14, P.white, 0.18, 3);
    // people crossing the plaza
    for (const pp of [[188, 164, 12, P.slate], [200, 168, 13, P.ink2], [96, 160, 11, P.crimsonD], [240, 172, 14, P.slate2]]) { person(ctx, pp[0], pp[1], pp[3], pp[2]); R(ctx, pp[0] - 1, pp[1], 6, 1, P.putty); }
    // the bank's lamp posts
    for (const lx of [30, 296]) { R(ctx, lx, 138, 2, 30, P.slate); C(ctx, lx - 2, 134, 6, 5, P.amber, P.white, P.amberD, P.ink); }
  };

  // A photographer seen from behind or side: head, shoulders, long lens up at the target.
  function shooter(ctx, x, yb, sc, flash, lens) {
    const u = (n) => Math.round(n * sc);
    const top = yb - u(34);
    ell(ctx, x + u(6), top + u(4), u(5), u(5), P.slate2); ell(ctx, x + u(7), top + u(5), u(5), u(5), P.ink); // head, rim-lit from the lamp
    R(ctx, x + u(5), top + u(9), u(5), u(3), P.ink); // neck
    trap(ctx, top + u(11), yb, x - u(2), x + u(16), x - u(6), x + u(20), P.ink); // coat, shoulders to hem
    line(ctx, x - u(2), top + u(11), x - u(6), yb - u(2), P.slate2, 1); R(ctx, x - u(2), top + u(11), u(2), u(10), P.slate); // lamp rim
    // arms bent up to the camera
    line(ctx, x + u(15), top + u(14), x + u(18), top + u(6), P.ink, u(3)); line(ctx, x, top + u(14), x - u(2), top + u(8), P.ink, u(3));
    // camera at the face; a long lens pointing up and to the right on one
    C(ctx, x + u(3), top + u(1), u(13), u(8), P.ink2, P.slate, P.ink, P.ink);
    R(ctx, x + u(13), top + u(3), u(5), u(4), P.slate2); R(ctx, x + u(15), top + u(2), u(2), u(1), P.grey);
    if (lens) { line(ctx, x + u(16), top + u(4), x + u(31), top - u(2), P.ink2, u(4)); line(ctx, x + u(17), top + u(3), x + u(30), top - u(3), P.slate2, 1); R(ctx, x + u(30), top - u(5), u(3), u(6), P.ink); }
    R(ctx, x + u(5), top - u(3), u(5), u(2), P.grey); // flash gun
    if (flash) { const fx = x + u(lens ? 34 : 18), fy = top - u(2); R(ctx, fx, fy - 4, 3, 11, P.white); R(ctx, fx - 4, fy, 11, 3, P.white); glow(ctx, fx + 1, fy + 1, 18, 13, P.white, 0.22, 3); }
  }

  // ---- 3. perp: the courthouse steps at night ----
  PL.perp = function (ctx) {
    G(ctx, 0, 0, 320, 70, P.ink, P.slate, 8);
    for (let i = 0; i < 14; i++) R(ctx, (i * 61) % 320, (i * 23) % 14 + 2, 2, 2, P.slate2);
    // courthouse: pediment, frieze, columns in shade with the dark doors between
    C(ctx, 40, 4, 240, 16, P.slate, P.slate2, P.ink2, P.ink);
    trap(ctx, 4, 17, 160, 160, 52, 268, P.slate2); trap(ctx, 8, 17, 160, 160, 74, 246, P.slate);
    R(ctx, 40, 18, 240, 5, P.slate2); R(ctx, 40, 22, 240, 2, P.ink);
    R(ctx, 48, 24, 224, 28, P.ink);
    for (let i = 0; i < 9; i++) { const x = 52 + i * 26; R(ctx, x, 24, 8, 28, P.slate); R(ctx, x, 24, 2, 28, P.slate2); R(ctx, x + 6, 24, 2, 28, P.ink2); R(ctx, x - 1, 24, 10, 2, P.slate2); }
    for (let i = 0; i < 8; i++) { const x = 62 + i * 26; R(ctx, x + 2, 32, 12, 20, P.ink2); if (i % 2) R(ctx, x + 4, 34, 8, 14, P.amberD); }
    // the wide steps rising behind the car
    for (let i = 0; i < 5; i++) { const y = 52 + i * 5, l = 36 - i * 8, r = 284 + i * 8; R(ctx, l, y, r - l, 3, P.slate2); R(ctx, l, y, r - l, 1, P.grey); R(ctx, l, y + 3, r - l, 2, P.ink2); }
    // kerb and wet road
    R(ctx, 0, 77, 320, 4, P.slate2); R(ctx, 0, 77, 320, 1, P.grey2); R(ctx, 0, 81, 320, 1, P.ink);
    R(ctx, 0, 82, 320, 20, P.ink2); D(ctx, 0, 82, 320, 20, P.ink2, P.ink, 0.5);
    for (let x = 0; x < 320; x += 40) R(ctx, x + 10, 94, 18, 2, P.slate2);
    // near pavement, wet: banded reflection of the lit steps and the lamps
    R(ctx, 0, 102, 320, 78, P.ink2); R(ctx, 0, 102, 320, 2, P.slate2);
    G(ctx, 0, 104, 320, 76, P.slate, P.ink2, 9);
    for (let i = 0; i < 12; i++) R(ctx, 60 + i * 22 + (i % 3) * 3, 106 + (i * 7) % 20, 12, 1, P.slate);
    alpha(ctx, 0.5, () => { for (let i = 0; i < 9; i++) R(ctx, 52 + i * 26, 108 + (i % 2) * 6, 8, 3, P.slate); });
    // lamps with stepped pools on the wet stone
    for (const lx of [18, 302]) {
      R(ctx, lx, 30, 3, 78, P.ink2); R(ctx, lx - 6, 28, 15, 4, P.slate2); R(ctx, lx - 5, 32, 13, 2, P.amber);
      alpha(ctx, 0.12, () => { for (let k = 0; k < 40; k += 2) R(ctx, lx + 1 - 6 - (k >> 1), 34 + k, 14 + k, 2, P.amber); });
      glow(ctx, lx + 1, 130, 60, 12, P.amber, 0.14, 4); R(ctx, lx - 2, 110, 7, 1, P.amber);
      for (let k = 0; k < 6; k++) R(ctx, lx - 1, 114 + k * 7, 5 - (k % 3), 3, k < 3 ? P.amber : P.amberD);
    }
    // photographers in front, big and dark, one flashing
    shooter(ctx, 36, 172, 1.1, false, false); shooter(ctx, 80, 180, 1.3, true, false);
    shooter(ctx, 222, 178, 1.3, true, true); shooter(ctx, 272, 172, 1.1, false, false); shooter(ctx, 148, 188, 1.4, false, false);
    // a few extra flash sparks in the dark
    for (const f of [[60, 90], [262, 96], [112, 70]]) { R(ctx, f[0], f[1], 1, 5, P.white); R(ctx, f[0] - 2, f[1] + 2, 5, 1, P.white); }
  };

  // ---- 4. fall-guy: inside a courtroom, cold light from the window ----
  PL['fall-guy'] = function (ctx) {
    // back wall: dark panelling with a chair rail
    R(ctx, 0, 0, 320, 90, P.deskD); R(ctx, 0, 0, 320, 30, P.ink2);
    R(ctx, 0, 0, 320, 5, P.ink); R(ctx, 0, 5, 320, 2, P.deskD);
    for (let i = 0; i < 12; i++) { const x = 4 + i * 27; R(ctx, x, 10, 23, 62, P.deskD); R(ctx, x + 2, 12, 19, 58, P.desk); R(ctx, x + 2, 12, 19, 2, P.desk2); R(ctx, x + 2, 12, 2, 58, P.desk2); R(ctx, x + 19, 14, 2, 56, P.deskD); R(ctx, x + 4, 14, 15, 54, P.deskD);  }
    R(ctx, 0, 72, 320, 3, P.desk2); R(ctx, 0, 75, 320, 2, P.ink2); R(ctx, 0, 77, 320, 12, P.deskD);
    for (let i = 0; i < 16; i++) R(ctx, i * 21 + 3, 79, 15, 8, P.desk);
    // the seal on the wall above the bench
    ell(ctx, 62, 30, 15, 15, P.ink); ell(ctx, 62, 30, 13, 13, P.amberD); ell(ctx, 62, 30, 10, 10, P.amber); ell(ctx, 62, 30, 7, 7, P.amberD);
    R(ctx, 61, 24, 3, 12, P.amber); R(ctx, 56, 29, 13, 3, P.amber); R(ctx, 58, 26, 2, 2, P.white);
    // the judge's raised bench, left, with its chair and nameless nameplate
    R(ctx, 10, 44, 8, 30, P.ink2); C(ctx, 28, 36, 36, 26, P.ink, P.ink2, P.ink, P.ink); R(ctx, 34, 40, 24, 3, P.slate2); // chair back
    C(ctx, 6, 56, 110, 28, P.desk, P.desk2, P.deskD, P.ink); R(ctx, 6, 56, 110, 3, P.desk2);
    for (let i = 0; i < 6; i++) { R(ctx, 14 + i * 17, 64, 12, 16, P.deskD); R(ctx, 15 + i * 17, 65, 10, 1, P.desk); }
    R(ctx, 56, 52, 12, 4, P.ink); R(ctx, 58, 52, 8, 1, P.amber);
    for (let i = 0; i < 3; i++) R(ctx, 0 + i * 3, 84 + i * 3, 124 - i * 3, 3, i ? P.deskD : P.desk2); // bench steps
    // window on the right: the cold light source
    R(ctx, 232, 8, 72, 56, P.ink); R(ctx, 235, 11, 66, 50, P.sky); G(ctx, 235, 11, 66, 50, P.white, P.sky, 7);
    R(ctx, 266, 11, 3, 50, P.desk); R(ctx, 235, 34, 66, 3, P.desk); R(ctx, 232, 61, 72, 4, P.desk2);
    for (let i = 0; i < 5; i++) R(ctx, 240 + i * 12, 14, 2, 18, P.white);
    // floor: planks converging on a vanishing point behind the table
    R(ctx, 0, 90, 320, 90, P.deskD); R(ctx, 0, 130, 320, 50, P.ink2); R(ctx, 0, 115, 320, 15, P.deskD);
    for (let i = -6; i <= 6; i++) line(ctx, 160 + i * 16, 90, 160 + i * 68, 180, P.ink, 1);
    for (let k = 1; k < 5; k++) R(ctx, 0, 90 + Math.round(Math.pow(k / 5, 1.7) * 90), 320, 1, P.ink);
    // light falling from the window across the floor and table, toward the viewer's left
    alpha(ctx, 0.13, () => { trap(ctx, 62, 100, 236, 298, 150, 250, P.white); trap(ctx, 100, 160, 150, 250, 30, 140, P.white); });
    alpha(ctx, 0.2, () => { trap(ctx, 118, 150, 160, 210, 100, 190, P.sky); trap(ctx, 150, 178, 100, 190, 20, 130, P.sky); });
    for (let k = 0; k < 3; k++) { alpha(ctx, 0.18, () => R(ctx, 190 - k * 40, 130 + k * 14, 8 - k, 2, P.ink)); }
    // the defence table: lit top, dark front, legs
    trap(ctx, 78, 90, 90, 234, 54, 266, P.desk2); R(ctx, 54, 90, 212, 3, P.desk); trap(ctx, 78, 79, 90, 234, 89, 235, P.putty2);
    R(ctx, 54, 90, 212, 26, P.deskD); R(ctx, 54, 93, 212, 2, P.desk); R(ctx, 54, 114, 212, 2, P.ink); R(ctx, 54, 90, 3, 26, P.desk);
    for (const x of [66, 246]) { R(ctx, x, 116, 7, 20, P.ink2); R(ctx, x, 116, 2, 20, P.deskD); }
    alpha(ctx, 0.14, () => R(ctx, 54, 78, 212, 38, P.sky));
    // empty chairs behind the table
    for (const x of [96, 216]) { R(ctx, x, 56, 14, 22, P.ink2); R(ctx, x + 1, 57, 12, 3, P.slate); R(ctx, x + 1, 62, 3, 14, P.slate); }
    // the gallery rail and benches in front, dark
    R(ctx, 0, 150, 320, 30, P.ink); R(ctx, 0, 148, 320, 4, P.deskD); R(ctx, 0, 148, 320, 1, P.desk2);
    for (let x = 4; x < 320; x += 12) { R(ctx, x, 154, 4, 14, P.ink2); R(ctx, x, 154, 1, 14, P.deskD); }
    R(ctx, 0, 168, 320, 12, P.ink2); R(ctx, 0, 168, 320, 2, P.deskD);
    person(ctx, 30, 150, P.ink, 22); person(ctx, 270, 150, P.ink, 24); person(ctx, 284, 150, P.ink, 20);
  };

  function lamp(ctx, x, y, dir) { // desk lamp with a stepped pool on the desk below it
    R(ctx, x, y - 10, 1, 10, P.ink); R(ctx, x - 1, y, 5, 1, P.ink); line(ctx, x, y - 10, x + 5 * dir, y - 12, P.ink, 1);
    R(ctx, x + 4 * dir, y - 13, 5, 3, P.amber); R(ctx, x + 4 * dir, y - 13, 5, 1, P.white);
    glow(ctx, x + 6 * dir, y + 2, 22, 5, P.amber, 0.2, 3);
  }

  // ---- 5. whistle: a newsroom at night, going to press ----
  PL.whistle = function (ctx) {
    R(ctx, 0, 0, 320, 90, P.ink2); G(ctx, 0, 0, 320, 90, P.ink, P.ink2, 6);
    // big window on the city, centre (calm behind the files)
    R(ctx, 96, 10, 140, 66, P.ink); G(ctx, 99, 13, 134, 60, P.slate, P.ink2, 8);
    for (let i = 0; i < 16; i++) { const bx = 99 + i * 9, bh = 12 + ((i * 17) % 28); R(ctx, bx, 73 - bh, 9, bh, i % 2 ? P.ink : P.ink2); if (i % 3 !== 1) R(ctx, bx + 2, 73 - bh + 3 + (i % 4) * 4, 2, 2, P.amberD); if (i % 4 === 0) R(ctx, bx + 5, 73 - bh + 9, 2, 2, P.sky); }
    R(ctx, 164, 10, 3, 66, P.ink); R(ctx, 96, 40, 140, 2, P.ink);
    R(ctx, 96, 76, 140, 3, P.ink); alpha(ctx, 0.07, () => trap(ctx, 13, 73, 99, 133, 60, 220, P.sky));
    // wall of TV monitors, left: a grid of screens throwing cold light
    R(ctx, 4, 8, 88, 70, P.ink);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 7 + c * 28, y = 11 + r * 22, k = r * 3 + c;
      C(ctx, x, y, 26, 20, P.ink2, P.slate, P.ink, P.ink); R(ctx, x + 2, y + 2, 22, 15, P.screen);
      R(ctx, x + 2, y + 2, 22, 15, k % 2 ? P.screenGlow : P.screen);
      if (k % 3 === 0) { for (let b = 0; b < 6; b++) R(ctx, x + 4 + b * 3, y + 14 - ((b * 5 + k) % 9) - 1, 2, ((b * 5 + k) % 9) + 1, b % 2 ? P.crimson : P.sky); }
      else if (k % 3 === 1) { R(ctx, x + 5, y + 5, 14, 5, P.slate2); R(ctx, x + 5, y + 12, 10, 1, P.grey); R(ctx, x + 5, y + 14, 14, 1, P.grey); }
      else { line(ctx, x + 4, y + 14, x + 10, y + 8, P.phosphor, 1); line(ctx, x + 10, y + 8, x + 14, y + 12, P.phosphor, 1); line(ctx, x + 14, y + 12, x + 21, y + 5, P.phosphor, 1); }
      R(ctx, x + 2, y + 2, 22, 1, P.screenGlow);
    }
    alpha(ctx, 0.1, () => trap(ctx, 78, 150, 4, 92, -30, 140, P.sky));
    // the press floor through glass, right: orange glow, a roll, a catwalk
    R(ctx, 240, 10, 76, 70, P.ink); G(ctx, 243, 13, 70, 64, P.carpetD, P.amberD, 8);
    ell(ctx, 268, 56, 13, 13, P.slate2); ell(ctx, 268, 56, 9, 9, P.putty); ell(ctx, 268, 56, 3, 3, P.ink2);
    R(ctx, 243, 66, 70, 11, P.ink2); for (let i = 0; i < 7; i++) R(ctx, 246 + i * 10, 68, 6, 7, i % 2 ? P.slate : P.slate2);
    R(ctx, 243, 38, 70, 2, P.slate2); for (let i = 0; i < 7; i++) R(ctx, 245 + i * 10, 38, 1, 8, P.slate2);
    for (let i = 0; i < 4; i++) R(ctx, 296, 24 + i * 7, 14, 4, P.putty2);
    R(ctx, 278, 10, 2, 70, P.ink); R(ctx, 243, 44, 70, 1, P.ink); alpha(ctx, 0.08, () => R(ctx, 243, 13, 70, 64, P.white));
    D(ctx, 243, 14, 36, 24, P.carpetD, P.amberD, 0.0);
    // floor: carpet in perspective, runners toward the glass
    R(ctx, 0, 90, 320, 90, P.carpetD); G(ctx, 0, 90, 320, 90, P.carpetD, P.ink, 9);
    for (let i = -10; i <= 10; i++) line(ctx, 160 + i * 6, 90, 160 + i * 30, 180, P.carpetD, 1);
    D(ctx, 0, 90, 320, 6, P.ink, P.carpetD, 0.5);
    // receding desks with lamps, both sides
    for (const d of [[10, 84, 80, 0], [244, 84, 66, 1]]) {
      C(ctx, d[0], d[1], d[2], 6, P.desk, P.desk2, P.deskD, P.ink); R(ctx, d[0] + 3, d[1] + 6, 4, 14, P.ink); R(ctx, d[0] + d[2] - 7, d[1] + 6, 4, 14, P.ink);
      R(ctx, d[0] + 6, d[1] - 8, 14, 8, P.ink2); R(ctx, d[0] + 7, d[1] - 7, 12, 5, P.screenGlow);
      lamp(ctx, d[0] + (d[3] ? 36 : 44), d[1], d[3] ? -1 : 1);
    }
    // the editor's desk in the front, the files on it
    trap(ctx, 80, 92, 92, 242, 72, 262, P.desk2); trap(ctx, 80, 82, 92, 242, 92, 242, P.putty2);
    R(ctx, 72, 92, 190, 22, P.deskD); R(ctx, 72, 92, 190, 2, P.desk); R(ctx, 72, 112, 190, 2, P.ink);
    for (let i = 0; i < 2; i++) { R(ctx, 140 + i * 56, 98, 38, 12, P.ink2); R(ctx, 141 + i * 56, 99, 36, 2, P.desk); R(ctx, 156 + i * 56, 103, 6, 2, P.amberD); }
    lamp(ctx, 112, 84, 1); R(ctx, 90, 83, 8, 4, P.ink2);
    glow(ctx, 160, 88, 90, 9, P.amber, 0.12, 4);
    // foreground: chair backs and the glow of an unseen screen
    for (const x of [30, 270]) { R(ctx, x, 148, 34, 32, P.ink); R(ctx, x + 2, 146, 30, 4, P.ink2); R(ctx, x + 14, 178, 6, 2, P.ink2); }
    R(ctx, 128, 160, 70, 20, P.ink); R(ctx, 132, 154, 62, 8, P.ink2); R(ctx, 134, 156, 58, 3, P.slate);
  };

  // A pinned chart printout: paper, a small line graph, a red pin.
  function chartSheet(ctx, x, y, w, h, k, lit) {
    const paper = lit ? P.bone : P.putty;
    R(ctx, x + 1, y + 1, w, h, P.ink); R(ctx, x, y, w, h, paper); R(ctx, x, y, w, 1, lit ? P.white : P.putty2);
    const col = k % 3 === 0 ? P.crimsonD : k % 3 === 1 ? P.slate2 : P.jadeD;
    let py = y + h - 3 - (k % 3);
    for (let i = 2; i < w - 2; i += 2) { const ny = Math.max(y + 3, Math.min(y + h - 3, py + ((i * 7 + k * 3) % 5) - 2 - (k % 2))); R(ctx, x + i, ny, 2, 1, col); py = ny; }
    if (h > 10) { R(ctx, x + 2, y + 2, w - 6, 1, P.grey); }
    R(ctx, x + (w >> 1), y - 1, 2, 2, P.crimson);
  }

  // ---- 6. cassandra: a cramped home office, late ----
  PL.cassandra = function (ctx) {
    R(ctx, 0, 0, 320, 180, P.ink2); G(ctx, 0, 0, 320, 90, P.ink, P.slate, 8);
    D(ctx, 0, 0, 320, 90, P.ink2, P.ink, 0.3);
    // the wall of pinned printouts, thickest on the left where the lamp reaches
    const pins = [];
    for (let i = 0; i < 17; i++) {
      const x = 6 + (i % 5) * 18 + (i * 7) % 6, y = 8 + Math.floor(i / 5) * 18 + (i * 3) % 5, lit = x < 96;
      pins.push([x + 6, y]);
      chartSheet(ctx, x, y, 14 + (i % 3) * 2, 10 + (i % 2) * 3, i, lit);
    }
    for (let i = 0; i < 9; i++) { const x = 100 + i * 22 + (i * 5) % 7, y = 4 + (i * 11) % 12; if (i % 3 === 1) { R(ctx, x, y, 12, 9, P.slate2); R(ctx, x, y, 12, 1, P.grey); } else { R(ctx, x, y, 12, 9, P.slate); R(ctx, x, y, 12, 1, P.slate2); } R(ctx, x + 5, y - 1, 2, 2, P.crimsonD); pins.push([x + 6, y]); }
    for (let i = 0; i < 6; i++) { const x = 248 + (i % 3) * 20, y = 62 + Math.floor(i / 3) * 14; chartSheet(ctx, x, y, 14, 9, i + 2, false); pins.push([x + 7, y]); }
    // red string from pin to pin
    for (let i = 0; i < pins.length - 1; i += 1) if (i % 4 !== 3) line(ctx, pins[i][0], pins[i][1], pins[i + 1][0], pins[i + 1][1], P.crimsonD, 1);
    line(ctx, pins[0][0], pins[0][1], pins[9][0], pins[9][1], P.crimson, 1); line(ctx, pins[16][0], pins[16][1], pins[24][0], pins[24][1], P.crimson, 1);
    // the small window, upper right: a city where the lights are going out
    R(ctx, 258, 6, 56, 54, P.ink); R(ctx, 261, 9, 50, 48, P.slate2); G(ctx, 261, 9, 50, 48, P.slate, P.ink, 7);
    for (let i = 0; i < 9; i++) { const bx = 261 + i * 6, bh = 12 + ((i * 11) % 22); R(ctx, bx, 57 - bh, 6, bh, i % 2 ? P.ink : P.ink2); for (let w = 0; w < 4; w++) { const on = ((i * 3 + w * 5) % 7) < 2; if (3 + w * 5 < bh - 2) R(ctx, bx + 2 + (w % 2), 57 - bh + 3 + w * 5, 2, 2, on ? P.amber : P.ink); } }
    R(ctx, 285, 9, 2, 48, P.ink); R(ctx, 261, 30, 50, 2, P.ink); R(ctx, 255, 58, 62, 4, P.desk);
    alpha(ctx, 0.1, () => trap(ctx, 10, 60, 261, 311, 250, 320, P.amber));
    // desk: shelf-wide, lit by a lamp at the left
    R(ctx, 0, 84, 320, 8, P.desk2); R(ctx, 0, 84, 320, 1, P.bone); R(ctx, 0, 92, 320, 18, P.deskD); R(ctx, 0, 92, 320, 2, P.desk); R(ctx, 0, 108, 320, 2, P.ink);
    for (const x of [4, 296]) { R(ctx, x, 110, 14, 48, P.deskD); R(ctx, x, 110, 2, 48, P.desk); }
    R(ctx, 120, 96, 80, 10, P.ink2); R(ctx, 122, 98, 76, 6, P.deskD); // drawer
    // lamp, left, and its pool on the wall and desk
    R(ctx, 36, 82, 10, 3, P.ink); R(ctx, 40, 66, 2, 16, P.ink); line(ctx, 41, 66, 56, 56, P.ink, 2); C(ctx, 52, 52, 14, 8, P.amber, P.white, P.amberD, P.ink);
    glow(ctx, 50, 38, 70, 36, P.amber, 0.1, 4); glow(ctx, 56, 86, 44, 6, P.amber, 0.22, 3);
    for (let k = 0; k < 6; k++) alpha(ctx, 0.14, () => R(ctx, 46 - k * 3, 60 + k * 3, 14 + k * 6, 3, P.amber));
    // clutter on the desk: a mug, a stack of books, a cold monitor glow
    C(ctx, 270, 70, 11, 12, P.bone, P.white, P.putty2, P.ink); R(ctx, 281, 73, 3, 6, P.ink2);
    for (let i = 0; i < 3; i++) R(ctx, 238, 74 + i * 4, 26 - i * 3, 4, [P.crimsonD, P.slate2, P.amberD][i]);
    // floor and the dark foreground: chair back, a box of papers
    R(ctx, 0, 140, 320, 40, P.ink); G(ctx, 0, 140, 320, 40, P.carpetD, P.ink, 4);
    R(ctx, 120, 128, 60, 52, P.ink); R(ctx, 124, 124, 52, 8, P.ink2); R(ctx, 126, 126, 48, 2, P.slate);
    C(ctx, 214, 144, 50, 32, P.ink2, P.slate, P.ink, P.ink); for (let i = 0; i < 3; i++) R(ctx, 220 + i * 14, 140, 10, 6, P.bone);
  };

  // A glass tower face: sky reflection that fades down, mullions, a bright left edge, a shaded right one.
  function glassTower(ctx, x, y, w, h, hi, lo, step, lit) {
    R(ctx, x - 1, y - 1, w + 2, h + 1, P.ink2); G(ctx, x, y, w, h, hi, lo, 8);
    for (let yy = y + step; yy < y + h; yy += step) R(ctx, x, yy, w, 1, P.slate2);
    for (let xx = x + step; xx < x + w - 1; xx += step) R(ctx, xx, y, 1, h, P.slate2);
    R(ctx, x, y, 2, h, P.white); R(ctx, x + w - 3, y, 3, h, P.slate2);
    for (let i = 0; i < 3; i++) line(ctx, x + 4 + i * 5, y + 22, x + 12 + i * 5, y + 6, P.white, 1);
    if (lit) for (let r = 0; r < h / step - 1; r++) for (let c = 0; c < w / step - 1; c++) if ((r * 5 + c * 3 + (x >> 2)) % 7 === 0) R(ctx, x + 2 + c * step, y + 2 + r * step, step - 2, step - 2, P.amber);
  }
  function youngTree(ctx, x, y, h) {
    R(ctx, x - 5, y - 4, 12, 4, P.slate2); R(ctx, x - 5, y - 4, 12, 1, P.grey2); R(ctx, x - 5, y, 12, 1, P.ink);
    R(ctx, x, y - h, 2, h - 3, P.deskD); ell(ctx, x + 1, y - h - 4, 8, 7, P.jadeD); ell(ctx, x, y - h - 5, 7, 6, P.jade); ell(ctx, x - 2, y - h - 7, 3, 2, P.phosphor);
    alpha(ctx, 0.35, () => ell(ctx, x + 14, y + 1, 14, 2, P.slate));
  }

  // ---- 7. fund: a bright new office district, morning ----
  PL.fund = function (ctx) {
    G(ctx, 0, 0, 320, 40, P.sky, P.bone, 6); G(ctx, 0, 40, 320, 50, P.bone, P.putty2, 6);
    glow(ctx, 20, 8, 110, 70, P.white, 0.18, 4); ell(ctx, 22, 12, 9, 9, P.white);
    // receding towers: paler and smaller the further back
    glassTower(ctx, 96, 40, 28, 50, P.sky, P.grey2, 6, false); glassTower(ctx, 258, 34, 24, 56, P.sky, P.grey2, 6, false);
    for (let i = 0; i < 5; i++) { const bx = 126 + i * 28, bh = 14 + (i * 13) % 22; if (bx > 126 && bx < 250) { R(ctx, bx, 84 - bh, 22, bh, P.putty2); R(ctx, bx, 84 - bh, 22, 1, P.bone); D(ctx, bx, 84 - bh, 22, bh, P.putty2, P.grey2, 0.25); } }
    glassTower(ctx, 280, 14, 36, 76, P.white, P.sky, 7, true);
    glassTower(ctx, 0, 0, 62, 112, P.sky, P.slate2, 7, true);
    R(ctx, 0, 112, 66, 4, P.slate); R(ctx, 0, 112, 66, 1, P.grey2); // its base
    R(ctx, 4, 100, 50, 12, P.ink2); X.text(ctx, 'ARCH', 29, 104, P.amber, { align: 'center' });
    R(ctx, 280, 90, 40, 4, P.slate);
    // the plaza: pale pavers with seams converging, long shadows from the sun on the left
    R(ctx, 0, 90, 320, 90, P.putty2); G(ctx, 0, 90, 320, 90, P.bone, P.putty2, 8);
    for (let i = -10; i <= 10; i++) line(ctx, 160 + i * 5, 90, 160 + i * 34, 180, P.putty, 1);
    for (let k = 0; k < 7; k++) R(ctx, 0, 92 + Math.round(Math.pow(k / 7, 1.6) * 88), 320, 1, P.putty);
    R(ctx, 0, 90, 320, 2, P.slate2);
    alpha(ctx, 0.3, () => { trap(ctx, 90, 150, 0, 62, 80, 220, P.slate); trap(ctx, 90, 120, 280, 316, 250, 320, P.slate); });
    // glare of the sun bouncing off the glass onto the plaza
    glow(ctx, 160, 140, 120, 22, P.white, 0.2, 4);
    // young trees in planters, nearer ones larger
    youngTree(ctx, 100, 102, 22); youngTree(ctx, 252, 104, 22); youngTree(ctx, 40, 152, 40); youngTree(ctx, 290, 160, 46);
    // people as small silhouettes, with their shadows
    for (const pp of [[120, 112, 9], [133, 114, 10], [214, 110, 9], [176, 124, 12], [190, 128, 12], [70, 132, 14], [236, 140, 14]]) {
      alpha(ctx, 0.3, () => R(ctx, pp[0] + 2, pp[1], pp[2], 1, P.slate)); person(ctx, pp[0], pp[1], pp[1] % 2 ? P.ink2 : P.slate2, pp[2]);
    }
    // benches / a low planter wall in the foreground
    R(ctx, 0, 166, 320, 14, P.putty); R(ctx, 0, 166, 320, 2, P.bone); R(ctx, 0, 178, 320, 2, P.slate2);
  };

  // ---- 8. exit: the fire stairwell and back corridor, the door onto daylight ----
  PL.exit = function (ctx) {
    const L = 104, Rr = 216, T = 14, Bt = 90; // the end wall; the corridor runs from here out to the viewer
    R(ctx, 0, 0, 320, 180, P.slate);
    // end wall, flat grey, lit warmly around the door
    R(ctx, L, T, Rr - L, Bt - T, P.slate2); G(ctx, L, T, Rr - L, Bt - T, P.slate2, P.slate, 5);
    // side walls: perspective panels with a handrail and a lit stripe
    trap(ctx, 0, 180, 0, 0, L, L, P.slate); // placeholder fill for rows (left wall drawn below by columns)
    for (let x = 0; x < L; x++) { const f = x / L, top = Math.round(0 + (T - 0) * f), bot = Math.round(180 + (Bt - 180) * f); R(ctx, x, top, 1, bot - top, (x >> 3) % 2 ? P.slate : P.ink2); }
    for (let x = 0; x < L; x++) { const f = x / L, top = Math.round(0 + (T - 0) * f), bot = Math.round(180 + (Bt - 180) * f); R(ctx, 320 - 1 - x, top, 1, bot - top, (x >> 3) % 2 ? P.slate : P.ink2); }
    // ceiling and floor planes
    for (let x = 0; x < L; x++) { const f = x / L, top = Math.round(T * f); R(ctx, x, 0, 1, top, P.ink); R(ctx, 319 - x, 0, 1, top, P.ink); }
    trap(ctx, 0, 14, 0, 320, L, Rr, P.ink);
    for (let k = 0; k < 4; k++) { const f = (k + 1) / 5, y = Math.round(T * f * f); const w = Math.round(60 - 40 * f * f); R(ctx, 160 - w, y, w * 2, 1, P.grey); }
    // the floor, a cold grey, with tile seams converging on the door
    trap(ctx, Bt, 180, L, Rr, 0, 320, P.slate2);
    for (let y = Bt; y < 180; y++) { const l = Math.round(L * (180 - y) / 90); R(ctx, l, y, 320 - 2 * l, 1, y < 118 ? P.slate2 : y < 148 ? P.slate : P.ink2); }
    for (let i = -8; i <= 8; i++) line(ctx, 160 + i * 5, Bt, 160 + i * 36, 180, P.slate, 1);
    for (let k = 0; k < 6; k++) R(ctx, 0, Bt + Math.round(Math.pow((k + 1) / 7, 1.8) * 90), 320, 1, P.slate);
    // the wall/floor joints and skirting
    line(ctx, 0, 180, L, Bt, P.ink, 2); line(ctx, 319, 180, Rr, Bt, P.ink, 2);
    // handrails running to the door
    line(ctx, 0, 118, L, 66, P.grey2, 2); line(ctx, 0, 121, L, 69, P.ink2, 1); line(ctx, 319, 118, Rr - 1, 66, P.grey2, 2); line(ctx, 319, 121, Rr - 1, 69, P.ink2, 1);
    // painted floor number, an extinguisher, a notice board on the left wall
    C(ctx, 22, 58, 12, 34, P.crimsonD, P.crimson, P.ink, P.ink); R(ctx, 26, 52, 4, 6, P.ink); R(ctx, 34, 62, 4, 2, P.ink);
    C(ctx, 40, 40, 22, 28, P.putty, P.putty2, P.plasticD, P.ink); R(ctx, 44, 46, 14, 1, P.grey); R(ctx, 44, 50, 14, 1, P.grey); R(ctx, 44, 54, 9, 1, P.grey);
    X.text(ctx, '3', 288, 44, P.grey2); R(ctx, 280, 38, 20, 22, P.slate2); X.text(ctx, '3', 287, 45, P.bone);
    // exit sign above the door, the only coloured thing
    C(ctx, 142, 8, 36, 12, P.ink2, null, null, P.ink); X.text(ctx, 'EXIT', 160, 11, P.jade, { align: 'center' });
    // ceiling tubes, mostly dead; two struggling
    for (const [x, y, w, on] of [[60, 3, 30, 0], [230, 3, 30, 1], [136, 1, 48, 1]]) { R(ctx, x, y, w, 3, on ? P.putty2 : P.slate); R(ctx, x, y, w, 1, on ? P.white : P.grey); }
    // warm light from the door pouring across the grey floor: stepped pools widening toward the viewer
    const pools = [[0.22, 150, 170, 40, 280], [0.16, 134, 160, 20, 300], [0.12, 118, 150, 0, 320]];
    pools.forEach((p, i) => { const y1 = [118, 146, 180][i]; alpha(ctx, p[0], () => trap(ctx, Bt - 2, y1, 138, 182, 160 - (i + 1) * 36, 160 + (i + 1) * 36, P.amber)); });
    alpha(ctx, 0.3, () => trap(ctx, Bt - 2, Bt + 8, 138, 182, 130, 190, P.white));
    // the spill on the side walls near the door
    alpha(ctx, 0.14, () => { trap(ctx, 20, 88, 104, 120, 104, 104, P.amber); trap(ctx, 20, 88, 216, 200, 216, 216, P.amber); });
    // shadows of two door frames/rails cast on the floor
    alpha(ctx, 0.25, () => { for (let i = 0; i < 4; i++) trap(ctx, Bt + 10 + i * 18, Bt + 14 + i * 20, 130 - i * 14, 134 - i * 14, 106 - i * 40, 112 - i * 40, P.ink); });
    // foreground: a mop bucket and a stack of flattened boxes, dark
    C(ctx, 14, 140, 34, 30, P.ink2, P.slate, P.ink, P.ink); R(ctx, 18, 128, 2, 14, P.deskD);
    C(ctx, 262, 150, 50, 14, P.deskD, P.desk, P.ink, P.ink); C(ctx, 268, 138, 40, 14, P.desk, P.desk2, P.deskD, P.ink);
  };
})(window.BTB);
