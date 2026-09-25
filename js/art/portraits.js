// Portraits for the story cast, drawn to the same rules as the pet sprite:
// each face is rasterised onto a 48x48 grid in memory, shaded one step down
// the palette on its right side, then given an ink outline, and painted as a
// sprite. Everything stays inside the locked 32-colour palette.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;
  const N = 48;

  // Light-to-dark ramps through the palette. shade() steps one right,
  // light() one left, so every tone a portrait uses is already in the game.
  const RAMPS = [
    [P.white, P.bone, P.putty2, P.putty, P.plasticD, P.slate2],
    [P.desk2, P.desk, P.deskD, P.ink2],
    [P.amber, P.amberD, P.deskD, P.ink2],
    [P.crimson, P.crimsonD, P.ink2],
    [P.jade, P.jadeD, P.carpetD],
    [P.phosphor, P.phosphorD, P.jadeD],
    [P.sky, P.slate2, P.slate, P.ink2],
    [P.violet, P.slate2, P.slate, P.ink2],
    [P.grey2, P.grey, P.slate2, P.slate, P.ink2, P.ink],
    [P.carpet2, P.carpet, P.carpetD, P.ink2],
    [P.plastic2, P.plastic, P.plasticD, P.slate2]
  ];
  function step(c, d) {
    for (const r of RAMPS) { const i = r.indexOf(c); if (i >= 0) return r[Math.max(0, Math.min(r.length - 1, i + d))]; }
    return c;
  }
  const shade = (c) => step(c, 1), light = (c) => step(c, -1);

  const CAST = {
    'Desmond Kroll': { skin: P.desk2, hair: P.grey2, suit: P.crimsonD, accent: P.crimson, cut: 'side', tie: true, brow: 'hard', mouth: 'smirk', jaw: true },
    'Imani Rhodes': { skin: P.deskD, hair: P.ink, suit: P.jadeD, accent: P.jade, cut: 'crown', brow: 'level', mouth: 'flat', earring: P.amber },
    'Sana Ferreira': { skin: P.amberD, hair: P.ink2, suit: P.violet, accent: P.bone, cut: 'bob', badge: true, brow: 'up', mouth: 'flat' },
    'Sen. Marcus Thorne': { skin: P.desk2, hair: P.bone, suit: P.sky, accent: P.white, cut: 'silver', tie: true, brow: 'level', mouth: 'tight', lines: true },
    'Perry Nakash': { skin: P.putty2, hair: P.ink, suit: P.amberD, accent: P.amber, cut: 'crop', glasses: true, brow: 'worry', mouth: 'flat' },
    'Adele Venn': { skin: P.desk, hair: P.ink2, suit: P.phosphorD, accent: P.phosphor, cut: 'crop', brow: 'level', mouth: 'tight', earring: P.bone, lines: true },
    'Greta Vail': { skin: P.putty2, hair: P.crimsonD, suit: P.slate, accent: P.plastic2, cut: 'bob', brow: 'hard', mouth: 'smirk' },
    'Mom': { skin: P.desk2, hair: P.grey2, suit: P.carpet, accent: P.bone, cut: 'bob', cardigan: true, brow: 'worry', mouth: 'smile', lines: true },
    // Household voices: a shelter volunteer, the dentist, the vet, and a
    // building that is managed by a model and shows you a screen.
    'Harbor Street Animal Shelter': { skin: P.amberD, hair: P.deskD, suit: P.jadeD, accent: P.jade, cut: 'crop', apron: true, brow: 'up', mouth: 'smile' },
    'Your dentist': { skin: P.putty2, hair: P.grey, suit: P.white, accent: P.sky, cut: 'crop', coat: true, brow: 'level', mouth: 'flat', mask: true },
    'Your vet': { skin: P.deskD, hair: P.ink2, suit: P.sky, accent: P.slate2, cut: 'bob', scrubs: true, brow: 'up', mouth: 'smile' },
    'Your landlord': { screen: true, suit: P.plastic, accent: P.phosphor }
  };

  // ---- rasteriser ----
  function raster(c) {
    const g = new Array(N * N).fill(null);
    const R = (x, y, w, h, col) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && i < N && j >= 0 && j < N) g[j * N + i] = col && col.a ? ((i + j) % 2 ? col.a : col.b) : col; };
    const px = (x, y, col) => R(x, y, 1, 1, col);

    // Shoulders: rounded, lit from the left, a shaded right side.
    const suit = c.suit;
    R(8, 36, 32, 12, suit); R(5, 39, 38, 9, suit); R(11, 34, 26, 2, suit);
    R(5, 40, 3, 8, light(suit)); R(8, 37, 3, 3, light(suit));
    R(38, 40, 5, 8, shade(suit)); R(36, 37, 3, 4, shade(suit));
    if (c.screen) { // the building's avatar: a monitor on a stand, a smiling line
      R(12, 8, 24, 22, P.plasticD); R(13, 9, 22, 20, P.plastic); R(15, 11, 18, 15, P.screen);
      R(18, 15, 3, 3, c.accent); R(27, 15, 3, 3, c.accent); R(19, 21, 10, 1, c.accent); R(18, 20, 1, 1, c.accent); R(29, 20, 1, 1, c.accent);
      R(13, 9, 22, 1, P.plastic2); R(22, 30, 4, 6, P.plasticD); R(17, 34, 14, 2, P.plasticD);
      return g;
    }
    // Shirt, lapels, collar.
    const shirt = c.coat || c.scrubs ? P.bone : P.bone;
    R(20, 34, 8, 14, shirt); R(21, 34, 1, 2, P.white); R(26, 34, 1, 2, P.white);
    if (!c.scrubs) {
      for (let k = 0; k < 8; k++) { px(19 - (k >> 2), 35 + k, shade(suit)); px(28 + (k >> 2), 35 + k, shade(suit)); }
      R(12, 34, 7, 2, c.accent); R(29, 34, 7, 2, c.accent);
    } else { R(20, 34, 8, 4, suit); for (let k = 0; k < 4; k++) { px(20 + k, 34 + k, shade(suit)); px(27 - k, 34 + k, shade(suit)); } }
    if (c.tie) { R(23, 35, 2, 2, shade(c.accent)); R(22, 37, 4, 8, c.accent); R(25, 37, 1, 8, shade(c.accent)); }
    if (c.cardigan) { R(20, 34, 8, 14, P.putty2); R(23, 37, 2, 2, c.accent); R(23, 41, 2, 2, c.accent); R(23, 45, 2, 2, c.accent); R(20, 34, 1, 14, P.putty); }
    if (c.apron) { R(15, 38, 18, 10, c.accent); R(15, 38, 18, 1, light(c.accent)); R(19, 42, 10, 3, shade(c.accent)); }
    if (c.coat) { R(9, 40, 3, 5, P.sky); px(10, 41, P.bone); }
    if (c.badge) { R(31, 38, 7, 6, P.bone); R(32, 39, 5, 1, P.crimson); R(32, 41, 4, 1, P.grey); R(32, 42, 3, 1, P.grey); }

    // Neck with a shadow under the jaw.
    // The darkest skin tone has no palette step before ink, so it takes a
    // narrow solid rim of shadow instead of a wide soft one.
    const dark = c.skin === P.deskD;
    const sk = c.skin, skS = shade(sk), skL = light(sk);
    const deeper = (col) => (col && col.a ? P.ink2 : shade(col));
    const line = skS.a ? P.ink2 : skS; // one-pixel features stay solid
    R(19, 28, 10, 8, sk); R(19, 29, 10, 2, skS); R(26, 30, 3, 5, skS);
    // Head: rounded, right side in shade, ears.
    R(14, 11, 20, 19, sk); R(15, 10, 18, 1, sk); R(15, 30, 18, 1, sk); R(17, 31, 14, 1, sk);
    if (dark) { R(32, 12, 2, 18, skS); R(30, 29, 2, 2, skS); } else { R(29, 12, 5, 18, skS); R(28, 29, 4, 2, skS); R(26, 31, 5, 1, skS); }
    R(15, 12, 2, 8, skL);
    R(12, 17, 2, 7, sk); R(12, 18, 1, 5, skS); R(34, 17, 2, 7, skS); R(35, 18, 1, 5, deeper(skS));
    if (c.jaw) { R(17, 30, 12, 1, line); }
    // Eyes: whites, pupils looking in, a lid line.
    const eye = (x) => { R(x, 19, 4, 2, P.bone); R(x + (x < 24 ? 2 : 0), 19, 2, 2, P.ink); R(x, 18, 4, 1, line); };
    eye(17); eye(27);
    // Brows set the mood.
    const hb = shade(c.hair === P.ink ? P.ink2 : c.hair);
    const brow = { level: [[16, 16, 5], [27, 16, 5]], hard: [[16, 15, 2], [18, 16, 3], [27, 16, 3], [30, 15, 2]], up: [[16, 15, 5], [27, 15, 5]], worry: [[16, 16, 2], [18, 15, 3], [27, 15, 3], [30, 16, 2]] }[c.brow || 'level'];
    for (const [x, y, w] of brow) R(x, y, w, 1, c.hair === P.bone || c.hair === P.grey2 ? P.grey : hb);
    // Nose: a shaded side and a nostril.
    R(24, 20, 1, 5, line); R(22, 25, 3, 1, line); px(25, 25, deeper(skS));
    // Mouth.
    const lip = deeper(skS);
    if (c.mask) { R(15, 23, 18, 8, P.sky); R(15, 23, 18, 1, P.white); R(29, 24, 4, 7, P.slate2); R(12, 21, 3, 1, P.bone); R(33, 21, 3, 1, P.bone); }
    else if (c.mouth === 'smile') { R(20, 27, 8, 1, lip); px(19, 26, lip); px(28, 26, lip); R(21, 28, 6, 1, skL); }
    else if (c.mouth === 'smirk') { R(20, 27, 7, 1, lip); px(27, 26, lip); px(28, 26, lip); }
    else if (c.mouth === 'tight') { R(20, 27, 8, 1, P.ink2); }
    else { R(20, 27, 8, 1, lip); R(21, 28, 6, 1, line); }
    if (c.lines) { px(16, 22, line); px(31, 22, deeper(skS)); R(19, 13, 3, 1, line); R(26, 13, 3, 1, line); }
    if (c.earring) { R(12, 24, 2, 2, c.earring); }

    // Hair: a mass, a highlight strand, a shaded side.
    const h = c.hair, hS = shade(h), hL = h === P.ink ? P.slate : light(h);
    if (c.cut === 'bob') {
      R(12, 7, 24, 7, h); R(10, 11, 5, 21, h); R(33, 11, 5, 21, h); R(14, 6, 20, 2, h);
      R(33, 11, 5, 21, hS); R(13, 8, 8, 1, hL); R(11, 13, 1, 14, hL); R(22, 12, 11, 2, h);
    } else if (c.cut === 'crown') {
      R(11, 6, 26, 8, h); for (let x = 11, k = 0; x < 35; x += 3, k++) R(x, 4 + (k % 2), 3, 3, h);
      R(11, 12, 4, 10, h); R(33, 12, 4, 10, hS); for (let x = 13; x < 34; x += 6) px(x, 5, hL); R(14, 7, 6, 1, hL);
    } else if (c.cut === 'silver') {
      R(13, 7, 22, 5, h); R(12, 10, 4, 8, h); R(32, 10, 4, 7, hS); R(15, 7, 10, 1, P.white); R(18, 11, 12, 1, P.putty2);
    } else if (c.cut === 'side') {
      R(13, 7, 22, 5, h); R(12, 10, 5, 7, h); R(31, 9, 4, 5, hS); R(17, 11, 9, 2, h); R(26, 9, 8, 1, P.bone); R(14, 8, 6, 1, hL);
    } else {
      R(13, 7, 22, 6, h); R(12, 10, 4, 6, h); R(32, 10, 4, 5, hS); R(14, 8, 8, 1, hL); R(24, 12, 9, 1, h);
    }
    if (c.glasses) {
      const fr = P.slate2;
      R(16, 17, 7, 1, fr); R(16, 22, 7, 1, fr); R(16, 17, 1, 6, fr); R(22, 17, 1, 6, fr);
      R(26, 17, 7, 1, fr); R(26, 22, 7, 1, fr); R(26, 17, 1, 6, fr); R(32, 17, 1, 6, fr);
      R(23, 18, 3, 1, fr); px(17, 18, P.white); px(27, 18, P.white);
    }
    return g;
  }

  // Ink outline around the silhouette, the way the pet is drawn.
  function outline(g) {
    const out = g.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y * N + x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const i = x + dx, j = y + dy; return i >= 0 && i < N && j >= 0 && j < N && g[j * N + i]; });
      if (n) out[y * N + x] = P.ink2;
    }
    return out;
  }

  const KEY = {}; Object.keys(B.PalKeys).forEach((k) => { if (B.PalKeys[k]) KEY[B.PalKeys[k]] = k; });
  const cache = {};
  function sprite(name) {
    if (cache[name]) return cache[name];
    const c = CAST[name] || { skin: P.desk2, hair: P.ink2, suit: P.slate, accent: P.grey2, cut: 'crop', brow: 'level', mouth: 'flat' };
    const g = outline(raster(c));
    const rows = [];
    for (let y = 0; y < N; y++) { let r = ''; for (let x = 0; x < N; x++) r += g[y * N + x] ? (KEY[g[y * N + x]] || '.') : '.'; rows.push(r); }
    return (cache[name] = X.sprite(rows));
  }

  function draw(canvas, name) {
    if (!canvas) return;
    const { ctx } = X.fit(canvas, N, N, 4);
    paint(ctx, name);
  }

  // Paint a portrait into any context on a 48x48 grid. Scenes scale it up
  // with ctx.scale and pass bare: true to drop the card background and frame,
  // so the person stands in the room instead of on a badge.
  function paint(ctx, name, opt) {
    const c = CAST[name] || { accent: P.grey2 };
    const bare = !!(opt && opt.bare);
    if (!bare) {
      X.rect(ctx, 0, 0, N, N, P.ink2);
      X.dither(ctx, 2, 2, 44, 44, P.slate, c.accent, 0.13);
      for (let i = 6; i < 44; i += 8) X.rect(ctx, i, 3, 1, 42, P.ink2);
    }
    X.drawSprite(ctx, sprite(name), 0, 0);
    if (bare) return;
    X.rect(ctx, 0, 0, N, 2, c.accent);
    X.rect(ctx, 0, 46, N, 2, P.ink);
    X.rect(ctx, 0, 0, 2, N, c.accent);
    X.rect(ctx, 46, 0, 2, N, P.ink);
  }

  B.Portraits = {
    CAST,
    draw,
    paint,
    has: (name) => !!CAST[name],
    sprite,
    drawAll(root) {
      (root || document).querySelectorAll('canvas[data-portrait]').forEach((canvas) => draw(canvas, canvas.dataset.portrait));
    }
  };
})(window.BTB);
