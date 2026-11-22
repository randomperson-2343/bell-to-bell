// Ending places, part 3 of 3: a backdrop of its own for each ending listed below,
// drawn on the 320x180 art grid behind the ending's prop (js/art/scenes.js endingDetail).
(function (B) {
  'use strict';
  const PL = B.EndingPlaces = B.EndingPlaces || {};
  const X = B.Pixel, P = B.Pal;
  const W = 320, H = 180;
  const R = (ctx, x, y, w, h, c) => X.rect(ctx, x, y, w, h, c);
  const cel = (ctx, x, y, w, h, base, hi, sh, out) => X.cel(ctx, x, y, w, h, base, hi, sh, out || P.ink, 1);

  // Stepped pool of light: concentric flattened ellipses, each faint, stacking up toward the centre.
  function pool(ctx, cx, cy, rx, ry, col, a, steps) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
    const n = steps || 3;
    for (let s = 0; s < n; s++) {
      const k = (n - s) / n, rw = rx * k, rh = ry * k;
      for (let y = -rh | 0; y <= rh; y++) {
        const hw = Math.floor(rw * Math.sqrt(Math.max(0, 1 - (y * y) / (rh * rh || 1))));
        ctx.fillRect(cx - hw, cy + y, hw * 2, 1);
      }
    }
    ctx.restore();
  }
  // Soft-edged cone / wash drawn as a faint trapezoid.
  function cone(ctx, x0, w0, y0, x1, w1, y1, col, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0), cx = x0 + (x1 - x0) * t, w = w0 + (w1 - w0) * t;
      ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w), 1);
    }
    ctx.restore();
  }
  // Lines on a floor, converging on (vx, vy): one 1px step per row.
  function converge(ctx, vx, vy, y0, y1, xs, col) {
    ctx.fillStyle = col;
    for (const xb of xs) for (let y = y0; y < y1; y++) {
      const x = Math.round(vx + (xb - vx) * (y - vy) / (y1 - vy));
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Horizontal floor seams that spread out as they come toward the viewer.
  function seams(ctx, y0, y1, col, n) {
    for (let i = 1; i <= n; i++) { const t = i / n; R(ctx, 0, Math.round(y0 + (y1 - y0) * t * t), W, 1, col); }
  }
  // Flat horizontal bands, top to bottom, instead of a dithered field.
  function bands(ctx, y, h, cols) { const bh = Math.ceil(h / cols.length); cols.forEach((c, i) => R(ctx, 0, y + i * bh, W, Math.min(bh, y + h - (y + i * bh)), c)); }
  const alpha = (ctx, a, fn) => { ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore(); };
  function ellipse(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) { const hw = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry))); ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  }

  // ---------------------------------------------------------------- clawback: a bank vault
  PL.clawback = function (ctx) {
    // back wall: brushed steel, darker toward the top, lit under the lamp
    X.gradient(ctx, 0, 0, W, 90, P.ink, P.slate, 9);
    // receding walls of safe-deposit boxes left and right, columns shrink toward the middle
    for (const side of [-1, 1]) {
      for (let c = 0; c < 6; c++) {
        const w = 14 - c * 2, x = side < 0 ? [0, 14, 26, 36, 44, 50][c] : W - [14, 28, 40, 50, 58, 64][c];
        const ww = c < 5 ? w : 6;
        const top = 6 + c * 4, bot = 90 - c * 3;
        const rows = Math.max(3, 9 - c);
        const rh = (bot - top) / rows;
        for (let r = 0; r < rows; r++) {
          const y = Math.round(top + r * rh), h = Math.round(rh) - 1;
          const lit = side < 0 ? P.grey : P.slate2;
          R(ctx, x, y, ww, h, P.ink);
          R(ctx, x + 1, y + 1, ww - 2, h - 2, (r + c) % 3 ? P.slate2 : P.slate);
          R(ctx, x + 1, y + 1, ww - 2, 1, lit);
          R(ctx, x + (ww >> 1) - 1, y + (h >> 1), 2, 1, P.amberD);
        }
      }
    }
    // the great round door, swung open to the right: seen nearly edge-on
    ellipse(ctx, 284, 52, 22, 46, P.ink);
    ellipse(ctx, 284, 52, 20, 44, P.slate2);
    ellipse(ctx, 281, 52, 16, 38, P.grey);
    ellipse(ctx, 280, 52, 12, 30, P.slate);
    ellipse(ctx, 279, 52, 6, 14, P.grey2);
    ellipse(ctx, 279, 52, 3, 7, P.slate2);
    for (let i = 0; i < 6; i++) R(ctx, 296 - (i % 2) * 1, 14 + i * 14, 4, 4, P.grey2);
    // spokes of the wheel
    R(ctx, 270, 51, 20, 3, P.ink); R(ctx, 278, 40, 3, 24, P.ink);
    // the open doorway: black interior behind the door hinge
    R(ctx, 238, 8, 14, 80, P.ink); R(ctx, 240, 10, 10, 78, P.ink2);
    // hinge post
    R(ctx, 306, 6, 6, 84, P.slate2); R(ctx, 306, 6, 1, 84, P.grey2); R(ctx, 311, 6, 1, 84, P.ink);
    // one hard overhead light and its cone
    R(ctx, 154, 0, 12, 4, P.ink); cel(ctx, 148, 4, 24, 5, P.white, P.white, P.bone);
    cone(ctx, 160, 24, 9, 160, 150, 86, P.bone, 0.07);
    cone(ctx, 160, 24, 9, 160, 100, 86, P.white, 0.06);
    // floor: dark tile with perspective to a vanishing point behind the table
    R(ctx, 0, 90, W, 90, P.ink);
    X.gradient(ctx, 0, 90, W, 90, P.ink2, P.ink, 6);
    converge(ctx, 160, 80, 90, 180, [-200, -110, -40, 20, 90, 160, 230, 300, 370, 440, 520], P.slate);
    seams(ctx, 90, 180, P.slate, 5);
    pool(ctx, 160, 150, 120, 26, P.bone, 0.08, 4);
    // the counting table: steel top, edge, legs, shadow
    R(ctx, 70, 86, 180, 4, P.ink);
    cel(ctx, 64, 80, 192, 8, P.grey2, P.white, P.grey);
    R(ctx, 64, 88, 192, 6, P.slate);
    R(ctx, 64, 88, 192, 1, P.ink);
    R(ctx, 70, 94, 8, 40, P.slate2); R(ctx, 70, 94, 1, 40, P.grey); R(ctx, 78, 94, 1, 40, P.ink);
    R(ctx, 242, 94, 8, 40, P.slate2); R(ctx, 242, 94, 1, 40, P.grey); R(ctx, 250, 94, 1, 40, P.ink);
    R(ctx, 66, 96, 188, 1, P.ink2);
    alpha(ctx, 0.45, () => { R(ctx, 74, 134, 180, 6, P.ink); });
    // a steel trolley, foreground left, and a rope barrier
    cel(ctx, 12, 128, 38, 6, P.slate2, P.grey, P.slate);
    R(ctx, 16, 134, 3, 22, P.slate); R(ctx, 43, 134, 3, 22, P.slate); R(ctx, 16, 156, 30, 2, P.ink2);
    cel(ctx, 14, 112, 14, 16, P.slate, P.slate2, P.ink2);
    R(ctx, 270, 130, 3, 24, P.amberD); R(ctx, 306, 130, 3, 24, P.amberD); R(ctx, 272, 134, 36, 2, P.crimsonD);
  };

  // ---------------------------------------------------------------- right-early: a rooftop at dusk
  PL['right-early'] = function (ctx) {
    // dusk sky: slate/violet above, amber at the horizon
    bands(ctx, 0, 82, [P.ink2, P.ink2, P.slate, P.slate, P.slate2, P.violet, P.violet]);
    R(ctx, 0, 66, W, 16, P.putty2); R(ctx, 0, 66, W, 2, P.violet); R(ctx, 0, 72, W, 10, P.amber);
    X.dither(ctx, 0, 62, W, 4, P.violet, P.putty2, 0.5);
    // the sun, half down behind the far towers, right
    pool(ctx, 270, 80, 64, 22, P.amber, 0.10, 4);
    ellipse(ctx, 270, 82, 11, 9, P.amber); ellipse(ctx, 270, 82, 7, 6, P.white);
    // city receding below: far, then nearer, towers (low, so the sky stays clear)
    for (let i = 0; i < 20; i++) {
      const bx = i * 17 - 6, bh = (bx > 205 && bx < 250) ? 1 : 5 + ((i * 29) % 11), far = (i % 2);
      R(ctx, bx, 79 - bh, 15, bh + 2, far ? P.slate2 : P.slate);
      if (i % 3 === 0) R(ctx, bx + 6, 76 - bh, 1, 3, P.slate2);
      if ((i * 7) % 4 === 0) R(ctx, bx + 3, 82 - bh, 2, 2, P.amber);
      if ((i * 5) % 6 === 1) R(ctx, bx + 9, 84 - bh, 2, 2, P.amberD);
    }
    // street canyon far below the edge: ink with a few lamps
    R(ctx, 0, 80, W, 4, P.ink2);
    for (let i = 0; i < 9; i++) R(ctx, 12 + i * 37, 81, 2, 2, P.amber);
    // the roof: tar surface, receding seams
    R(ctx, 0, 84, W, 96, P.slate);
    bands(ctx, 84, 96, [P.slate2, P.slate2, P.slate, P.slate]);
    converge(ctx, 160, 78, 84, 180, [-140, -40, 60, 160, 260, 360, 460], P.slate);
    seams(ctx, 84, 180, P.slate, 4);
    // far parapet: coping lit by the sunset on top
    R(ctx, 0, 81, W, 5, P.ink2); R(ctx, 0, 80, W, 1, P.amberD); R(ctx, 0, 81, W, 1, P.grey);
    R(ctx, 0, 86, W, 1, P.ink);
    // sun-warmed pool on the roof, and long shadows streaming left
    pool(ctx, 240, 104, 110, 14, P.amber, 0.10, 3);
    // water tank on legs, left, lit from the right
    for (const lx of [12, 28, 48]) R(ctx, lx, 62, 3, 40, P.ink2);
    R(ctx, 10, 78, 44, 2, P.ink2);
    cel(ctx, 6, 22, 50, 42, P.deskD, P.desk, P.ink2);
    R(ctx, 46, 24, 8, 38, P.deskD); R(ctx, 52, 24, 2, 38, P.amberD);
    for (let k = 0; k < 4; k++) R(ctx, 8, 30 + k * 9, 46, 1, P.ink2);
    R(ctx, 4, 18, 54, 6, P.ink2); R(ctx, 10, 15, 42, 4, P.ink); R(ctx, 10, 16, 42, 1, P.amberD);
    alpha(ctx, 0.4, () => { R(ctx, 56, 100, 52, 5, P.ink); });
    // HVAC units
    cel(ctx, 118, 108, 40, 22, P.plastic, P.plastic2, P.plasticD);
    ellipse(ctx, 132, 118, 7, 5, P.ink2); R(ctx, 128, 117, 8, 2, P.slate);
    for (let k = 0; k < 3; k++) R(ctx, 142, 112 + k * 5, 12, 1, P.plasticD);
    R(ctx, 160, 100, 2, 14, P.slate2); R(ctx, 160, 100, 14, 2, P.slate2);
    alpha(ctx, 0.45, () => { R(ctx, 112, 130, 52, 4, P.ink); });
    cel(ctx, 220, 128, 54, 28, P.plastic, P.plastic2, P.plasticD);
    for (let k = 0; k < 2; k++) { ellipse(ctx, 234 + k * 22, 140, 8, 7, P.ink2); R(ctx, 228 + k * 22, 139, 12, 2, P.slate); }
    alpha(ctx, 0.45, () => { R(ctx, 214, 156, 66, 5, P.ink); });
    // near edge of the roof: low wall in the foreground with a lit top
    R(ctx, 0, 164, W, 16, P.ink2); R(ctx, 0, 164, W, 3, P.grey); R(ctx, 0, 164, W, 1, P.amber); R(ctx, 0, 167, W, 1, P.ink);
    for (let i = 0; i < 8; i++) R(ctx, 8 + i * 42, 170, 20, 1, P.slate);
    // stack pipe with a lamp
    R(ctx, 296, 96, 4, 66, P.slate2); R(ctx, 296, 96, 1, 66, P.grey); R(ctx, 292, 92, 12, 5, P.slate); R(ctx, 292, 92, 12, 1, P.grey2);
  };

  // ---------------------------------------------------------------- everything-rally: a supermarket checkout
  PL['everything-rally'] = function (ctx) {
    // ceiling and back wall
    R(ctx, 0, 0, W, 90, P.putty2);
    X.gradient(ctx, 0, 0, W, 90, P.slate2, P.bone, 8);
    // aisles receding: shelves as stepped bays, shrinking toward the centre
    for (const side of [-1, 1]) {
      for (let c = 0; c < 5; c++) {
        const w = [24, 18, 14, 10, 8][c], x = side < 0 ? [0, 24, 42, 56, 66][c] : W - [24, 42, 56, 66, 74][c];
        const top = 22 + c * 5, bot = 86 - c * 2;
        R(ctx, x, top, w, bot - top, P.plasticD);
        R(ctx, x, top, w, 1, P.ink);
        const rows = 5 - (c >> 1);
        for (let r = 0; r < rows; r++) {
          const y = top + 2 + Math.round(r * (bot - top - 6) / rows), rh = Math.round((bot - top - 6) / rows) - 3;
          R(ctx, x, y + rh + 1, w, 2, P.slate2);
          for (let k = 0; k < w - 2; k += 3) {
            const col = [P.crimson, P.amber, P.sky, P.jade, P.bone, P.violet][(k + r * 2 + c * 3 + (side > 0 ? 1 : 0)) % 6];
            R(ctx, x + 1 + k, y + 1, 2, Math.max(2, rh - 1), col);
          }
          R(ctx, x, y + rh + 3, w, 1, P.white); // price-tag rail
          if (c < 3) for (let k = 2; k < w - 2; k += 5) R(ctx, x + k, y + rh + 3, 2, 1, P.amber);
        }
      }
    }
    // the ticker screen: a dark price board that the prop's jade bars rise in front of
    R(ctx, 120, 0, 2, 20, P.ink2); R(ctx, 198, 0, 2, 20, P.ink2);
    cel(ctx, 82, 14, 166, 74, P.screenD, P.screen, P.screen);
    R(ctx, 85, 17, 160, 68, P.screenD);
    for (let k = 0; k < 5; k++) R(ctx, 86, 28 + k * 11, 158, 1, P.screen);
    X.text(ctx, 'FRESH PRICES', 86, 20, P.phosphorD, {});
    R(ctx, 82, 87, 166, 3, P.ink);
    // fluorescent ceiling tubes in perspective, with their light spilling downward
    for (const [x, w, y] of [[20, 44, 2], [116, 88, 1], [256, 44, 2]]) {
      R(ctx, x, y, w, 3, P.white); R(ctx, x, y + 3, w, 1, P.ink2);
      cone(ctx, x + w / 2, w, y + 4, x + w / 2, w + 36, 40, P.white, 0.07);
    }
    // floor: pale tile, perspective, pooled under the tubes
    R(ctx, 0, 90, W, 90, P.putty);
    X.gradient(ctx, 0, 90, W, 90, P.putty2, P.putty, 6);
    converge(ctx, 160, 70, 90, 180, [-160, -60, 40, 130, 190, 280, 380, 480], P.plastic);
    seams(ctx, 90, 180, P.plastic, 5);
    pool(ctx, 160, 122, 130, 22, P.white, 0.18, 4);
    // the checkout: conveyor belt across the foreground, counter top near y 84-90
    cel(ctx, 0, 84, 230, 8, P.slate2, P.grey, P.slate);
    R(ctx, 0, 86, 230, 3, P.ink2);
    for (let i = 0; i < 28; i++) R(ctx, 4 + i * 8, 86, 1, 3, P.slate);
    R(ctx, 0, 92, 232, 28, P.slate);
    X.gradient(ctx, 0, 92, 232, 28, P.slate2, P.slate, 4);
    R(ctx, 0, 92, 232, 1, P.ink);
    for (let k = 0; k < 4; k++) R(ctx, 8 + k * 56, 98, 44, 16, P.slate2), R(ctx, 8 + k * 56, 98, 44, 1, P.grey);
    R(ctx, 0, 120, 232, 3, P.ink);
    alpha(ctx, 0.35, () => { R(ctx, 0, 123, 236, 6, P.ink); });
    // till and card reader, right
    cel(ctx, 250, 56, 54, 36, P.plastic, P.plastic2, P.plasticD);
    cel(ctx, 256, 62, 30, 18, P.screenD, P.screen, P.screenD);
    X.text(ctx, '12.40', 261, 67, P.phosphor, {});
    cel(ctx, 290, 66, 10, 14, P.slate, P.slate2, P.ink2);
    cel(ctx, 246, 90, 74, 34, P.slate, P.slate2, P.ink2);
    R(ctx, 246, 90, 74, 3, P.white); R(ctx, 246, 93, 74, 1, P.ink);
    R(ctx, 254, 100, 58, 1, P.slate2);
    // a checkout number lamp over the lane
    R(ctx, 300, 0, 2, 18, P.ink2); cel(ctx, 292, 18, 18, 12, P.crimson, P.crimson, P.crimsonD); X.text(ctx, '3', 298, 20, P.white, {});
    // basket on the floor
    cel(ctx, 20, 150, 40, 18, P.crimsonD, P.crimson, P.ink2);
    for (let k = 0; k < 4; k++) R(ctx, 25 + k * 8, 154, 4, 8, P.ink2);
    R(ctx, 160, 150, 90, 1, P.putty2);
  };

  // Row of plastic chairs seen from the front, scaled by s (1 = near, 0.5 = far).
  function chairRow(ctx, y, n, x0, step, s, col, hi) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step, w = Math.round(14 * s), bh = Math.round(10 * s), sh = Math.round(7 * s);
      R(ctx, x, y - bh - sh, w, bh, P.ink); R(ctx, x + 1, y - bh - sh + 1, w - 2, bh - 1, col); R(ctx, x + 1, y - bh - sh + 1, w - 2, 1, hi);
      R(ctx, x - 1, y - sh, w + 2, 3, P.ink); R(ctx, x, y - sh, w, 2, col); R(ctx, x, y - sh, w, 1, hi);
      R(ctx, x + 1, y - sh + 3, 2, sh - 3, P.ink); R(ctx, x + w - 3, y - sh + 3, 2, sh - 3, P.ink);
    }
  }

  // ---------------------------------------------------------------- lost-decade: a fluorescent waiting room
  PL['lost-decade'] = function (ctx) {
    // wall: tired institutional green-grey, with a darker dado
    R(ctx, 0, 0, W, 90, P.carpet2);
    X.gradient(ctx, 0, 0, W, 90, P.carpet, P.carpet2, 6);
    R(ctx, 0, 62, W, 28, P.carpet); R(ctx, 0, 62, W, 1, P.putty2); R(ctx, 0, 63, W, 1, P.carpetD);
    X.dither(ctx, 0, 64, W, 26, P.carpet, P.carpetD, 0.2);
    // ceiling strip
    R(ctx, 0, 0, W, 6, P.ink2); R(ctx, 0, 6, W, 1, P.ink);
    // window onto grey weather, left
    cel(ctx, 8, 14, 52, 46, P.grey2, P.putty2, P.grey, P.plasticD);
    X.gradient(ctx, 12, 18, 44, 38, P.grey2, P.putty2, 4);
    R(ctx, 33, 18, 2, 38, P.plasticD); R(ctx, 12, 36, 44, 2, P.plasticD);
    for (let k = 0; k < 3; k++) R(ctx, 16 + k * 12, 50 - k * 3, 8, 6, P.grey); // far buildings in the murk
    R(ctx, 6, 60, 56, 3, P.putty2); R(ctx, 6, 63, 56, 1, P.ink2);
    // wall clock (stopped-looking), right
    ellipse(ctx, 272, 24, 13, 13, P.ink); ellipse(ctx, 272, 24, 11, 11, P.bone);
    R(ctx, 271, 15, 2, 9, P.ink); R(ctx, 272, 23, 7, 2, P.ink); R(ctx, 271, 24, 2, 2, P.crimson);
    for (const [dx, dy] of [[0, -10], [10, 0], [0, 10], [-10, 0]]) R(ctx, 272 + dx - 1, 24 + dy - 1, 2, 2, P.ink2);
    // take-a-number display
    cel(ctx, 252, 42, 56, 18, P.ink2, P.slate, P.ink);
    R(ctx, 256, 46, 48, 10, P.screenD); X.text(ctx, 'NOW 042', 280, 48, P.amber, { align: 'center' });
    R(ctx, 276, 60, 4, 4, P.ink);
    // ticket dispenser on a pole
    R(ctx, 296, 64, 4, 24, P.slate2); cel(ctx, 290, 62, 16, 10, P.crimsonD, P.crimson, P.ink2);
    // floor: dull lino, perspective
    R(ctx, 0, 90, W, 90, P.carpetD);
    X.gradient(ctx, 0, 90, W, 90, P.carpet, P.carpetD, 5);
    R(ctx, 0, 88, W, 3, P.ink2); R(ctx, 0, 90, W, 1, P.ink);
    converge(ctx, 160, 72, 90, 180, [-200, -100, 0, 100, 200, 300, 400, 500, 600], P.carpetD);
    seams(ctx, 90, 180, P.carpetD, 5);
    // light from the failing tube lands as a stepped pool
    cel(ctx, 110, 7, 100, 5, P.white, P.white, P.bone);
    R(ctx, 112, 13, 96, 1, P.ink);
    for (let k = 0; k < 5; k++) R(ctx, 118 + k * 18, 8, 10, 3, k === 3 ? P.putty : P.white); // one segment dead
    cone(ctx, 160, 100, 14, 160, 190, 90, P.white, 0.05);
    pool(ctx, 150, 140, 120, 24, P.white, 0.10, 4);
    cel(ctx, 232, 7, 40, 5, P.putty, P.putty2, P.plasticD); // second tube, mostly dark
    // rows of chairs: far row small on the wall line, nearer rows bigger, linked in 3s
    chairRow(ctx, 90, 7, 66, 26, 0.9, P.plasticD, P.plastic);
    chairRow(ctx, 126, 6, 40, 46, 1.4, P.plastic, P.plastic2);
    chairRow(ctx, 176, 5, 18, 64, 1.9, P.plastic2, P.white);
    alpha(ctx, 0.3, () => { R(ctx, 60, 128, 240, 4, P.ink); });
  };

  // ---------------------------------------------------------------- soft: a spring main street
  PL.soft = function (ctx) {
    // clear mid-morning sky, sun high left
    bands(ctx, 0, 56, [P.sky, P.sky, P.sky, P.putty2, P.putty2, P.bone, P.bone]);
    pool(ctx, 30, 14, 50, 24, P.white, 0.14, 4); ellipse(ctx, 30, 12, 9, 9, P.white);
    // far side of the street: the prop row carries the middle; low buildings continue the row to each edge
    for (const [x, w, h, col] of [[0, 30, 30, P.slate2], [28, 26, 22, P.grey], [266, 28, 24, P.grey], [292, 30, 34, P.slate2]]) {
      R(ctx, x, 80 - h, w, h, P.ink2); R(ctx, x + 1, 81 - h, w - 2, h - 1, col); R(ctx, x + 1, 81 - h, w - 2, 1, P.putty2);
      for (let k = 4; k < w - 6; k += 8) R(ctx, x + k, 86 - h, 4, 5, P.sky);
    }
    // the far pavement and shop ground floor line
    R(ctx, 0, 80, W, 8, P.putty2); R(ctx, 0, 80, W, 1, P.white); R(ctx, 0, 87, W, 1, P.putty);
    // road, receding to a vanishing point mid-street
    R(ctx, 0, 88, W, 52, P.slate2);
    R(ctx, 0, 88, W, 52, P.slate2); R(ctx, 0, 88, W, 12, P.slate);
    converge(ctx, 160, 80, 88, 150, [20, 90, 230, 300], P.grey);
    for (let i = 0; i < 5; i++) { const y = 94 + i * i * 3 + i * 3; R(ctx, 158 - i, y, 4 + i * 2, 1 + (i >> 1), P.putty2); }
    // zebra crossing, middle distance
    for (let k = 0; k < 9; k++) { const x = 84 + k * 18; R(ctx, x, 104, 10, 2, P.bone); R(ctx, x - 2, 112, 12, 3, P.bone); }
    // near kerb and pavement
    R(ctx, 0, 140, W, 40, P.putty2); R(ctx, 0, 140, W, 3, P.bone); R(ctx, 0, 143, W, 1, P.putty);
    seams(ctx, 144, 180, P.putty, 3);
    for (let k = 0; k < 8; k++) R(ctx, 20 + k * 44, 144, 1, 36, P.putty);
    // sun-lit patches, and tree shadows falling to the right of each tree
    pool(ctx, 160, 160, 120, 14, P.white, 0.15, 3);
    // street trees (spring: fresh green), trunks on the near pavement, canopies overlapping the row behind
    for (const tx of [84, 232]) {
      R(ctx, tx, 70, 4, 76, P.deskD); R(ctx, tx, 70, 1, 76, P.desk);
      for (const [dx, dy, r] of [[-12, 38, 12], [14, 36, 12], [0, 22, 15], [-14, 22, 9], [18, 20, 9]]) { ellipse(ctx, tx + 2 + dx, dy, r, r - 2, P.jadeD); ellipse(ctx, tx + dx, dy - 2, r - 2, r - 4, P.jade); }
      ellipse(ctx, tx - 4, 18, 6, 3, P.phosphor);
      alpha(ctx, 0.3, () => { ellipse(ctx, tx + 14, 150, 18, 3, P.ink); });
    }
    // foreground open shops with awnings: left and right, overlapping everything
    for (const [x, w, c1c, c2c] of [[0, 54, P.crimson, P.bone], [268, 52, P.jade, P.bone]]) {
      R(ctx, x, 56, w, 86, P.ink2); R(ctx, x, 56, w, 86, P.putty);
      R(ctx, x + 2, 76, w - 4, 52, P.ink); R(ctx, x + 4, 78, w - 8, 48, P.amberD); R(ctx, x + 4, 78, w - 8, 3, P.amber); // open interior glow
      for (let s = 0; s < 4; s++) R(ctx, x + 8 + s * ((w - 16) / 4 | 0), 96, 8, 10, [P.bone, P.crimsonD, P.jade, P.sky][s]);
      R(ctx, x + 4, 108, w - 8, 3, P.deskD); // counter
      // striped awning
      for (let s = 0; s * 6 < w; s++) { R(ctx, x + s * 6, 60, 6, 16, s % 2 ? c2c : c1c); R(ctx, x + s * 6, 74, 6, 3, s % 2 ? P.putty2 : c1c); }
      R(ctx, x, 58, w, 2, P.ink); R(ctx, x, 77, w, 1, P.ink);
      alpha(ctx, 0.35, () => { R(ctx, x + 2, 78, w - 4, 6, P.ink); });
      R(ctx, x, 128, w, 14, P.slate); R(ctx, x, 128, w, 1, P.ink);
    }
    // a bench and a bike rack, near pavement
    R(ctx, 140, 148, 40, 3, P.desk2); R(ctx, 140, 151, 40, 1, P.deskD); R(ctx, 144, 152, 3, 6, P.ink2); R(ctx, 173, 152, 3, 6, P.ink2);
    R(ctx, 140, 142, 40, 2, P.desk);
  };

  // ---------------------------------------------------------------- quiet: a riverside at night
  PL.quiet = function (ctx) {
    // night sky, a faint glow at the horizon from the city
    X.gradient(ctx, 0, 0, W, 90, P.ink, P.ink2, 7);
    X.gradient(ctx, 0, 60, W, 30, P.ink2, P.slate, 4);
    for (let i = 0; i < 14; i++) R(ctx, (i * 61 + 13) % W, (i * 23) % 40 + 3, 2, 2, i % 3 ? P.slate2 : P.grey);
    // other buildings: dark, lower than the tower; a couple of dim windows
    for (const [x, w, h] of [[0, 34, 40], [32, 28, 26], [58, 40, 34], [226, 30, 36], [254, 36, 48], [288, 32, 30], [100, 10, 18], [212, 16, 22]]) {
      R(ctx, x, 86 - h, w, h, P.ink); R(ctx, x + 1, 87 - h, w - 2, h - 1, P.ink2); R(ctx, x + w - 4, 87 - h, 3, h - 1, P.ink);
      for (let k = 0; k < 4; k++) { const wx = x + 4 + ((k * 9 + x) % Math.max(6, w - 10)), wy = 92 - h + ((k * 13) % Math.max(8, h - 12)); R(ctx, wx, wy, 2, 3, (k + x) % 5 === 0 ? P.amberD : P.slate); }
    }
    R(ctx, 0, 84, W, 4, P.ink); // far bank
    for (let i = 0; i < 12; i++) R(ctx, 8 + i * 27, 85, 2, 2, i % 3 ? P.amberD : P.grey);
    // the river: dark water in bands, reflecting the one lit window
    R(ctx, 0, 88, W, 52, P.screenD);
    X.gradient(ctx, 0, 88, W, 52, P.screen, P.screenD, 5);
    for (let k = 0; k < 14; k++) { const y = 92 + k * 3 + (k * k % 3); R(ctx, (k * 53) % 300, y, 30 + (k * 17) % 30, 1, P.slate); }
    // reflection of the amber window, broken into ripples
    for (let k = 0; k < 11; k++) { const y = 92 + k * 4; const w = 10 - (k % 3) * 3 - (k >> 2); if (w > 1) R(ctx, 176 - (w >> 1) + (k % 2 ? 2 : -2), y, w, 2, k < 4 ? P.amber : P.amberD); }
    // reflected tower, a darker smear under it
    alpha(ctx, 0.5, () => { R(ctx, 112, 88, 96, 24, P.ink); });
    // lamppost reflection down the left
    for (let k = 0; k < 6; k++) R(ctx, 48 + (k % 2) * 2, 110 + k * 4, 6 - (k >> 1), 2, P.amberD);
    // foreground embankment: wet pavement, railing along the river edge
    R(ctx, 0, 140, W, 40, P.slate2);
    X.gradient(ctx, 0, 140, W, 40, P.slate, P.ink2, 5);
    R(ctx, 0, 140, W, 2, P.grey); R(ctx, 0, 142, W, 1, P.ink);
    seams(ctx, 146, 180, P.ink2, 3);
    // lamp light stepped onto the pavement
    pool(ctx, 40, 160, 80, 14, P.amber, 0.14, 4);
    // railing: top rail, posts, lower rail
    R(ctx, 0, 124, W, 3, P.slate2); R(ctx, 0, 124, W, 1, P.grey);
    R(ctx, 0, 138, W, 2, P.slate); 
    for (let i = 0; i < 17; i++) { R(ctx, 6 + i * 19, 124, 3, 16, P.slate2); R(ctx, 6 + i * 19, 124, 1, 16, P.grey); }
    for (let i = 0; i < 17; i++) R(ctx, 14 + i * 19, 130, 1, 8, P.ink2);
    // lamppost, left foreground
    R(ctx, 24, 64, 5, 118, P.ink); R(ctx, 25, 64, 2, 118, P.slate2); R(ctx, 22, 172, 9, 8, P.ink); R(ctx, 22, 172, 9, 2, P.slate2);
    R(ctx, 24, 70, 18, 3, P.ink); // arm
    cel(ctx, 34, 72, 16, 8, P.amber, P.white, P.amberD);
    pool(ctx, 42, 84, 30, 18, P.amber, 0.08, 3);
    cone(ctx, 42, 14, 80, 42, 60, 124, P.amber, 0.05);
    // moored boat silhouette on the near water
    R(ctx, 236, 118, 40, 4, P.ink); R(ctx, 240, 114, 20, 4, P.ink); R(ctx, 248, 106, 2, 8, P.ink);
  };

  // ---------------------------------------------------------------- depression: a winter street
  PL.depression = function (ctx) {
    // flat grey sky, heavier at the top
    R(ctx, 0, 0, W, 90, P.grey);
    R(ctx, 0, 0, W, 24, P.slate2); X.dither(ctx, 0, 24, W, 12, P.slate2, P.grey, 0.5); R(ctx, 0, 60, W, 30, P.grey2);
    // datacentre blocks on the skyline: windowless, no lights, roof plant and cooling stacks
    for (const [x, w, h] of [[0, 62, 66], [60, 40, 30], [120, 70, 26], [196, 44, 34], [256, 64, 72]]) {
      R(ctx, x, 84 - h, w, h, P.ink); R(ctx, x + 1, 85 - h, w - 2, h - 1, P.ink2); R(ctx, x + 1, 85 - h, w - 2, 1, P.putty2);
      for (let k = 4; k < w - 6; k += 6) R(ctx, x + k, 90 - h, 3, h - 10 > 12 ? 8 : 4, P.ink);
      for (let k = 6; k < w - 12; k += 18) { R(ctx, x + k, 80 - h, 10, 4, P.slate); R(ctx, x + k, 80 - h, 10, 1, P.putty2); } // snow on the cooling units
      R(ctx, x + w - 12, 66 - h > 0 ? 66 - h : 2, 4, 8, P.slate);
    }
    // job-centre sign: the one light on the street
    pool(ctx, 292, 100, 36, 8, P.amber, 0.14, 3);
    // ground: snow on the pavement, wet grey road, tracks
    R(ctx, 0, 84, W, 96, P.putty2);
    R(ctx, 0, 84, W, 20, P.bone); R(ctx, 0, 84, W, 4, P.white);
    R(ctx, 0, 84, W, 1, P.ink2);
    bands(ctx, 104, 50, [P.putty, P.putty, P.grey2, P.grey2]);
    converge(ctx, 160, 80, 104, 180, [-40, 60, 130, 190, 260, 360], P.grey);
    // slush tracks
    for (let k = 0; k < 6; k++) { R(ctx, 100 + k * 6 - k, 112 + k * 10, 8 + k * 2, 2, P.grey); R(ctx, 200 - k * 2, 112 + k * 10, 8 + k * 2, 2, P.grey); }
    // kerb: snow bank along the near edge
    R(ctx, 0, 154, W, 26, P.bone); R(ctx, 0, 154, W, 3, P.white); R(ctx, 0, 157, W, 1, P.putty);
    for (let k = 0; k < 7; k++) { ellipse(ctx, 20 + k * 52, 156, 20, 4, P.white); }
    // bare trees: trunks and forked branches, snow on the forks
    for (const [tx, ty] of [[18, 146], [300, 146]]) {
      const s = ty > 140 ? 1 : 0;
      R(ctx, tx, ty - 60 - s * 14, 4, 60 + s * 14, P.ink);
      for (const [dx, dy, l] of [[-10, -50, 14], [8, -60, 14], [-6, -76, 10], [6, -82, 10]]) {
        const bx = tx + (dx < 0 ? dx : 2), by = ty + dy - s * 10;
        R(ctx, bx, by, Math.abs(dx) + 2, 3, P.ink); R(ctx, dx < 0 ? bx : bx + Math.abs(dx), by - 8, 2, 10, P.ink);
        R(ctx, dx < 0 ? bx : bx + Math.abs(dx) - 1, by - 9, 4, 2, P.white);
      }
    }
    // job-centre blade sign on a bracket, right: amber letters on dark
    R(ctx, 284, 84, 4, 76, P.ink); R(ctx, 284, 84, 1, 76, P.slate2);
    cel(ctx, 272, 62, 44, 20, P.ink2, P.slate, P.ink);
    R(ctx, 276, 66, 36, 12, P.screenD);
    X.text(ctx, 'JOBS', 294, 68, P.amber, { align: 'center' });
    R(ctx, 270, 60, 48, 3, P.white); // snow on the sign
    // falling snow, soft: 2px flakes on a loose lattice
    for (let k = 0; k < 40; k++) R(ctx, (k * 79 + 11) % W, (k * 47) % 150, 2, 2, P.white);
  };
})(window.BTB);
