// V4.2 authored beat sheet. Every Career session now picks its pre-open shot
// from what actually happens that day, instead of rotating ten compositions
// by day % 10. The hand-drawn 320x180 set pieces in scenes.js (B.Shots) are
// back, drawn at 2x; new inserts put the day's one important number or line
// on screen; act cards mark the four acts; and the skyline carries the false
// dawn: a window lights for every day of the rally and goes dark after it.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal, R = B.Rhythm, SH = B.Shots;
  if (!R || !SH) return;
  const V = R.view;

  // [shot, weight, insert text]. Weight sets how long the morning runs:
  // S one frame, M two, L three, XL three plus an act card when the act turns.
  // Shots: place (rhythm composition), tv, floor, dark (empty floor),
  // elevator, bell, insert, tableau, skyline.
  const SHEET = [
    ['elevator', 'XL'], ['insert', 'M', '212 PAGES OF RELEASE NOTES'], ['insert', 'M', '18K LIKES · DENIAL: 0 VIEWS'],
    ['insert', 'L', 'DELINQUENCY 6.4%'], ['insert', 'M', 'RATING AFFIRMED: AAA'], ['insert', 'L', 'FRLN HALTED · INDEX AT A RECORD'],
    ['tableau', 'L', 3], ['place', 'L'], ['insert', 'XL', 'A CIRCLE: THSI > HALO > THSI'],
    ['tableau', 'L', 5], ['dark', 'L', '19% OF RACKS NEVER ENERGIZE'], ['insert', 'M', 'COMPUTE FREEDOM ACT · SIGNED'],
    ['insert', 'XL', 'BIDS: 1 · PRICE: 0.00'], ['place', 'S'], ['insert', 'M', '40 DOWNGRADES · SAME MINUTE'],
    ['insert', 'M', 'CREDIT LINE WITHDRAWN'], ['place', 'L'], ['tableau', 'XL', 8],
    ['tv', 'S'], ['insert', 'M', 'FOUR FUNDS · ONE MODEL'], ['tableau', 'XL', 9],
    ['place', 'L'], ['place', 'L'], ['insert', 'L', 'MARKED AT 22 CENTS'],
    ['insert', 'L', 'AT RISK: 5.5 CENTS'], ['tableau', 'M', 11], ['place', 'M'],
    ['skyline', 'S'], ['skyline', 'S'], ['skyline', 'S'],
    ['insert', 'M', 'VOLUME: PERFECTLY EVEN'], ['place', 'M'], ['insert', 'XL', 'QUOTA: 2.25% OF BOOK'],
    ['insert', 'M', '9,000 WORDS · 0 READS'], ['place', 'M'], ['skyline', 'S'],
    ['insert', 'L', 'VOICEMAIL · PERRY · 0:41'], ['tableau', 'XL', 12], ['insert', 'L', 'YEAS 214 · NEEDED 218'],
    ['insert', 'M', 'MONEY FUND NAV 0.99'], ['tableau', 'XL', 13], ['floor', 'XL'],
    ['place', 'L'], ['insert', 'L', '61% OF FILLS · ONE COUNTERPARTY'], ['dark', 'XL'],
    ['tableau', 'XL', 14]
  ];
  const WEIGHTS = { S: 1, M: 2, L: 3, XL: 3 };

  // Which document each close-up is. Anything not listed is an internal memo.
  const DOCS = {
    1: 'footnote', 2: 'post', 3: 'chart', 4: 'rating', 5: 'ticket', 8: 'footnote', 11: 'vote', 12: 'ticket',
    14: 'rating', 23: 'ticket', 24: 'footnote', 30: 'chart', 33: 'post', 36: 'voicemail', 38: 'vote', 39: 'ticket',
    43: 'chart'
  };
  const LABELS = {
    memo: 'HOLLOWAY STERN · INTERNAL', footnote: 'OFFERING MEMORANDUM', rating: 'MERIDIAN RATINGS · ACTION', post: 'SQWAK',
    chart: 'RISK PRINTOUT', ticket: 'ORDER BOOK', vote: 'FLOOR TALLY', voicemail: 'VOICEMAIL'
  };
  // The twelve technical anomalies (story-data.js, ANOMALIES) sit on these sessions.
  // The morning of each one has one small thing wrong in the picture.
  const ANOMALY_DAYS = [0, 1, 8, 10, 12, 14, 17, 19, 25, 30, 36, 43];

  // Four mornings depend on what you chose the night before.
  function variant(day, S) {
    if (!S) return null;
    const c = S.choices || {}, f = S.f || {};
    if (day === 4 && c.c1 === 'dump') return ['insert', 'M', 'RIVERBEND BUYS AT PAR', 'ticket'];
    if (day === 4 && c.c1 === 'leak') return ['insert', 'M', 'LEAKED DECK · FRONT PAGE', 'post'];
    if (day === 22 && c.c5 === 'fail') return ['dark', 'L', 'NO RESCUE · DESKS CLEARED'];
    if (day === 22 && c.c5 === 'ban') return ['insert', 'L', 'SHORT SALES BANNED · 5 DAYS', 'ticket'];
    if (day === 22 && c.c5 === 'bail') return ['insert', 'L', 'GUARANTEE SIGNED · 2:14 AM', 'memo'];
    if (day === 41 && f.billPassed) return ['insert', 'XL', 'THE BILL PASSES · 218 YEAS', 'vote'];
    if (day === 45 && f.pulledPlug) return ['racks', 'XL', 'THE STACK IS OFF'];
    return null;
  }
  function row(day, S) {
    const r = variant(day, S) || SHEET[day] || ['place', 'M'];
    return { shot: r[0], weight: r[1], arg: r[2], doc: r[3] || DOCS[day] || 'memo' };
  }
  function act(day) { const D = B.StoryData; return D && D.actOf ? D.actOf(day) : ''; }
  function actTurns(day) { return day > 0 && act(day) !== act(day - 1); }

  // Legacy art is authored at 320x180: draw it at exactly 2x, in the day's season.
  function at2x(ctx, fn, day) {
    if (SH.setSeason) SH.setSeason(day == null ? null : R.season(day));
    ctx.save(); ctx.scale(2, 2);
    try { fn(ctx); } finally { ctx.restore(); if (SH.setSeason) SH.setSeason(null); }
  }
  // The tableaux were drawn with a header strip at y=0, which the letterbox
  // hides. Drop them 7px so the strip reads, and extend it up to the top.
  // tableauSpace is the transform: the 1.3 zoom about (160, 76) when asked, then the 7 px drop. fn draws in it.
  function tableauSpace(c, zoom, fn) {
    c.save();
    if (zoom) { c.translate(160 * (1 - zoom), 76 * (1 - zoom)); c.scale(zoom, zoom); }
    c.translate(0, 7);
    fn(c);
    c.restore();
  }
  // o (optional, layer builders): part 'art' is the ink and the picture without its scanlines (and without the mover when o.noMover), no header strip;
  // part 'scan' is the scanlines (and the header strip when not zoomed) alone; o.over: tableau 9's lower band and caption move from 'art' to 'scan' (see briefingTableau); o.p replaces the constant 0.6.
  function tableau(c, n, zoom, o) {
    const part = o && o.part, p = o && o.p != null ? o.p : 0.6;
    if (part !== 'scan') X.rect(c, 0, 0, 320, 180, P.ink);
    let ok = true;
    tableauSpace(c, zoom, (g) => { ok = SH.briefingTableau(g, n, p, o ? { part, noMover: o.noMover, over: o.over } : undefined); });
    if (!ok) return false;
    if (!zoom && part !== 'art') X.rect(c, 0, 0, 320, 7, P.slate);
    return true;
  }
  function big(ctx, value, x, y, color, scale, align) {
    ctx.save(); ctx.scale(scale, scale);
    X.textShadow(ctx, R.clean(value).slice(0, 44), Math.round(x / scale), Math.round(y / scale), color, P.ink, { align: align || 'left' });
    ctx.restore();
  }
  function tell(ctx, day) {
    if (ANOMALY_DAYS.indexOf(day) < 0) return;
    // A one-pixel tear across the picture and one pixel the wrong colour.
    const y = 60 + ((day * 37) % 150), x = 40 + ((day * 53) % 480);
    X.rect(ctx, x, y, 44, 1, P.phosphor);
    X.rect(ctx, x + 47, y, 2, 1, P.crimson);
  }

  // The false dawn as a motif: sessions 29-36 light one more window each;
  // after the top they go out again.
  function lit(day) {
    if (day < 28) return 0.18;
    if (day <= 35) return 0.18 + (day - 27) * 0.08;
    return Math.max(0.04, 0.82 - (day - 35) * 0.07);
  }
  // o (optional): part 'city' draws the ink, gradient and towers with their windows, 'top' the weather, the ground and the text; o.skip = [lo, hi]
  // leaves out the windows lit by a k in [lo, hi) (the ones a shot switches on itself); o.noLabel leaves out the LIGHTS ON text, o.labelStem leaves only its 'LIGHTS ON: ' stem.
  function skylineShot(ctx, day, title, o) {
    const part = o && o.part, skip = o && o.skip, a = (B.StoryData.actIndex(day) + 1), s = R.season(day);
    if (part !== 'top') {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink);
      X.gradient(ctx, 0, 0, V.w, 260, day >= 28 && day <= 35 ? P.amberD : P.ink2, P.ink, 12);
      const f = lit(day);
      for (let i = 0; i < 26; i++) {
        const w = 18 + ((i * 17) % 20), h = 60 + ((i * 41) % 150), x = i * 26 - 6;
        X.rect(ctx, x, 260 - h, w, h, i % 3 ? P.ink2 : P.slate);
        if (s.snow) X.rect(ctx, x, 260 - h, w, 2, P.bone);
        for (let yy = 8; yy < h - 6; yy += 12) for (let xx = 4; xx < w - 4; xx += 8) {
          const k = ((i * 131 + xx * 7 + yy * 3) % 100) / 100;
          if (k < f && !(skip && skip[0] <= k && k < skip[1])) X.rect(ctx, x + xx, 260 - h + yy, 3, 3, day > 35 ? P.sky : P.amber);
        }
      }
    }
    if (part === 'city') return;
    const f = lit(day);
    R.weather(ctx, 0, 0, V.w, 240, day);
    X.rect(ctx, 0, 260, V.w, 100, P.ink);
    // o.labelStem draws only 'LIGHTS ON: ' (the shot's tally draws the number after it, at x 24 + 11 x 6)
    if (o && o.labelStem) R.text(ctx, 'LIGHTS ON:', 24, 24, a >= 3 ? P.sky : P.amber);
    else if (!(o && o.noLabel)) R.text(ctx, `LIGHTS ON: ${Math.round(f * 100)}%`, 24, 24, a >= 3 ? P.sky : P.amber);
    if (title) R.text(ctx, title, 24, 38, P.bone);
  }
  // The windows the day lights: those with k in [lo, f) (lo = f - 0.08), as the 3x3 rects skylineShot draws, left out when a later (nearer) tower
  // covers them, since a lamp drawn over the city would show through it. The same arithmetic as skylineShot's loop.
  function skyCells(day) {
    const f = lit(day), lo = f - 0.08, towers = [], cells = [];
    for (let i = 0; i < 26; i++) towers.push({ w: 18 + ((i * 17) % 20), h: 60 + ((i * 41) % 150), x: i * 26 - 6 });
    for (let i = 0; i < 26; i++) {
      const { w, h, x } = towers[i];
      for (let yy = 8; yy < h - 6; yy += 12) for (let xx = 4; xx < w - 4; xx += 8) {
        const k = ((i * 131 + xx * 7 + yy * 3) % 100) / 100;
        if (!(lo <= k && k < f)) continue;
        const cx = x + xx, cy = 260 - h + yy;
        if (cx >= 640) continue;
        if (towers.some((q, j) => j > i && cx < q.x + q.w && cx + 3 > q.x && cy + 3 > 260 - q.h)) continue;
        cells.push({ x: cx, y: cy, w: 3, h: 3 });
      }
    }
    return { cells, lo, f };
  }

  // ---- Close-ups: the day's one number, on the document it came from ----
  // Wood planks under the day's paper: ink seams, a lit top edge and a shaded
  // bottom edge on each board, grain in 3px strokes, and the desk lamp's pool
  // stepped in rings from the top left, fading to shadow at the bottom right.
  function steppedDisc(ctx, cx, cy, r, col, a) {
    ctx.save(); ctx.globalAlpha = a;
    for (let y = -r; y < r; y += 3) {
      const w = Math.round(Math.sqrt(r * r - y * y) / 3) * 3;
      X.rect(ctx, cx - w, cy + y, w * 2, 3, col);
    }
    ctx.restore();
  }
  function deskUnder(ctx) {
    X.rect(ctx, 0, 0, V.w, V.h, P.desk);
    for (let k = 0, top = -18; top < V.h; k++, top += 72) {
      for (let i = 0; i < 16; i++) {
        const gx = (i * 97 + k * 211) % V.w, gy = top + 12 + ((i * 29 + k * 13) % 48), len = 30 + ((i * 53 + k * 7) % 90);
        X.rect(ctx, gx, gy, len, 3, i % 4 ? P.deskD : P.desk2);
        if (i % 5 === 0) X.rect(ctx, gx + len, gy + 3, 24, 3, P.deskD);
      }
      const kx = (k * 263 + 120) % (V.w - 60) + 30, ky = top + 36;
      X.rect(ctx, kx - 6, ky - 3, 12, 3, P.deskD); X.rect(ctx, kx - 9, ky, 18, 3, P.deskD); X.rect(ctx, kx - 3, ky, 6, 3, P.ink2); X.rect(ctx, kx - 6, ky + 3, 12, 3, P.deskD);
      X.rect(ctx, 0, top + 66, V.w, 3, P.deskD);
      X.rect(ctx, 0, top + 69, V.w, 3, P.ink2);
      X.rect(ctx, 0, top + 72, V.w, 3, P.desk2);
      for (let j = 0; j < 3; j++) { const jx = ((k + j) * 331 + 90) % V.w; X.rect(ctx, jx, top + 3, 3, 66, P.ink2); X.rect(ctx, jx + 3, top + 3, 3, 66, P.desk2); }
    }
    steppedDisc(ctx, 60, 20, 420, P.desk2, 0.1);
    steppedDisc(ctx, 60, 20, 300, P.desk2, 0.1);
    steppedDisc(ctx, 60, 20, 180, P.putty2, 0.08);
    ctx.save(); ctx.globalAlpha = 0.14; X.rect(ctx, 0, V.h - 30, V.w, 30, P.ink); X.rect(ctx, V.w - 30, 0, 30, V.h, P.ink); ctx.restore();
  }
  function paper(ctx, x, y, w, h, label) {
    X.rect(ctx, x + 6, y + 6, w, h, P.deskD);
    X.cel(ctx, x, y, w, h, P.bone, P.white, P.plasticD, P.ink2, 3);
    X.rect(ctx, x + 16, y + 18, w - 32, 2, P.grey);
    R.text(ctx, label, x + 20, y + 26, P.ink);
  }
  function valueLines(value, width) { return X.wrap(R.clean(value), width).slice(0, 2); }
  // The footnote's circled line (y of the pen's middle).
  const footnoteLine = (day) => 50 + (6 + day % 6) * 12;
  // Where the documents' moving marks sit, read by the flat art (DOC_DRAW) and by the layered documents (docLayers), so the two cannot drift apart.
  // ticket: the order book's bars at step s (0 = the art, 3 = the start); vote: the 6 x 18 lamp banks and which lamps are lit; voicemail: the 34 level bars (the day sets
  // the heights); memo: the highlighter band.
  const DOC_GEOM = {
    memo: { band: { x: 112, y: 96, w: 416, h: 58 } },
    ticket: {
      bid: (i, s) => ({ x: 100, y: 80 + i * 14, w: 100 - i * 18 + 12 * (s || 0), h: 8 }),
      ask: (i, s) => { const w = 60 + i * 12 - 12 * (s || 0); return { x: 540 - w, y: 80 + i * 14, w, h: 8 }; }
    },
    vote: {
      rows: 6, cols: 18,
      yea: (q, k) => ({ x: 64 + 13 * k, y: 56 + 13 * q, w: 9, h: 9 }), nay: (q, k) => ({ x: 340 + 13 * k, y: 56 + 13 * q, w: 9, h: 9 }),
      yeaLit: (q, k) => (q * 18 + k) % 7 !== 0, nayLit: (q, k) => (q * 18 + k) % 5 !== 0
    },
    voicemail: { count: 34, bar: (i, day) => { const h = 4 + ((i * 37 + day) % 36); return { x: 224 + i * 5.8, y: 110 - h / 2, w: 3, h }; } }
  };
  const DOC_DRAW = {
    // o (all optional; absent draws the whole flat picture) is each document's own options: memo part 'paper' (desk, paper, grey lines)
    // or 'ink' (the value only), the highlighter band only when no part; footnote noMarker; post part 'city' / 'phone' / 'glass' and noFlag;
    // chart noMarker; ticket part 'screen' / 'glass' (the bars only when no part); vote unlit; voicemail played (bars lit, default 12).
    memo(ctx, day, value, c, o) {
      const part = o && o.part;
      if (!part || part === 'paper') {
        deskUnder(ctx); paper(ctx, 96, 34, 448, 232, LABELS.memo);
        for (let i = 0; i < 5; i++) X.rect(ctx, 116, 180 + i * 12, 200 + ((i * 67 + day * 13) % 200), 2, P.grey2);
      }
      if (!part) { const b = DOC_GEOM.memo.band; X.rect(ctx, b.x, b.y, b.w, b.h, c.wash); }
      if (!part || part === 'ink') {
        const lines = valueLines(value, 200);
        lines.forEach((ln, i) => big(ctx, ln, 320, 104 + i * 22 + (lines.length === 1 ? 10 : 0), P.ink, 2, 'center'));
      }
    },
    footnote(ctx, day, value, c, o) {
      deskUnder(ctx); paper(ctx, 70, 20, 380, 252, LABELS.footnote);
      for (let i = 0; i < 16; i++) X.rect(ctx, 90, 50 + i * 12, 300 - ((i * 41 + day * 7) % 90), 2, P.grey2);
      // One line circled in red marker, and the number written in the margin.
      if (!(o && o.noMarker)) {
        const ly = footnoteLine(day);
        X.rect(ctx, 84, ly - 7, 290, 2, P.crimson); X.rect(ctx, 84, ly + 7, 290, 2, P.crimson);
        X.rect(ctx, 82, ly - 5, 2, 12, P.crimson); X.rect(ctx, 374, ly - 5, 2, 12, P.crimson);
        X.rect(ctx, 376, ly, 60, 2, P.crimson);
      }
      X.cel(ctx, 440, 70, 180, 150, P.amber, P.bone, P.amberD, P.ink2, 3);
      valueLines(value, 80).forEach((ln, i) => big(ctx, ln, 530, 110 + i * 26, P.ink, 2, 'center'));
    },
    rating(ctx, day, value, c) {
      deskUnder(ctx); paper(ctx, 120, 24, 400, 248, LABELS.rating);
      for (let i = 0; i < 4; i++) X.rect(ctx, 140, 196 + i * 12, 240 + ((i * 53) % 100), 2, P.grey2);
      // A stamp, double-ruled, in the act's signal colour.
      X.rect(ctx, 150, 64, 340, 110, c.signal); X.rect(ctx, 156, 70, 328, 98, P.bone); X.rect(ctx, 162, 76, 316, 86, c.signal); X.rect(ctx, 166, 80, 308, 78, P.bone);
      const lines = valueLines(value, 150);
      lines.forEach((ln, i) => big(ctx, ln, 320, 96 + i * 28 + (lines.length === 1 ? 12 : 0), c.signal === P.amber ? P.amberD : c.signal, 3, 'center'));
    },
    post(ctx, day, value, c, o) {
      const part = o && o.part;
      if (!part || part === 'city') { X.rect(ctx, 0, 0, V.w, V.h, P.ink); R.skyline(ctx, B.StoryData.actIndex(day) + 1, day * 5, 300, day); }
      if (!part || part === 'phone') {
        X.cel(ctx, 190, 16, 260, 300, P.ink2, P.slate2, P.ink, P.ink2, 3);
        X.rect(ctx, 200, 28, 240, 276, P.screenD);
        big(ctx, 'sqwak', 320, 36, P.bone, 2, 'center');
        X.rect(ctx, 208, 60, 224, 150, P.screen);
        if (!(o && o.noFlag)) X.rect(ctx, 216, 70, 10, 10, P.crimson);
        R.text(ctx, 'TRENDING', 232, 72, P.crimson);
        valueLines(value, 96).forEach((ln, i) => big(ctx, ln, 216, 96 + i * 20, P.bone, 2));
        for (let i = 0; i < 3; i++) X.rect(ctx, 216 + i * 70, 190, 44, 6, i === 2 ? P.sky : P.slate2);
      }
      if (!part || part === 'glass') X.scanlines(ctx, 200, 28, 240, 276, P.ink, 0.1);
    },
    chart(ctx, day, value, c, o) {
      deskUnder(ctx); paper(ctx, 60, 30, 520, 236, LABELS.chart);
      X.rect(ctx, 90, 60, 460, 120, P.white);
      for (let i = 1; i < 4; i++) X.rect(ctx, 90, 60 + i * 30, 460, 1, P.putty2);
      let y = 120; const down = R.marketDown(day);
      for (let i = 0; i < 90; i++) { y = B.clamp(y + (((i * 19 + day * 7) % 13) - 6) * 0.8 + (down ? 0.5 : -0.3), 66, 172); X.rect(ctx, 92 + i * 5, y, 4, 2, P.ink2); }
      // A red marker circle around the move that matters.
      if (!(o && o.noMarker)) {
        const cx = 92 + 60 * 5;
        X.rect(ctx, cx - 30, 70, 60, 2, P.crimson); X.rect(ctx, cx - 30, 166, 60, 2, P.crimson);
        X.rect(ctx, cx - 32, 72, 2, 94, P.crimson); X.rect(ctx, cx + 30, 72, 2, 94, P.crimson);
      }
      valueLines(value, 240).forEach((ln, i) => big(ctx, ln, 320, 196 + i * 22, P.crimsonD, 2, 'center'));
    },
    ticket(ctx, day, value, c, o) {
      const part = o && o.part;
      if (!part || part === 'screen') {
        X.rect(ctx, 0, 0, V.w, V.h, P.ink); X.gradient(ctx, 0, 0, V.w, V.h, P.ink2, P.ink, 8);
        X.cel(ctx, 60, 20, 520, 256, P.plastic, P.plastic2, P.plasticD, P.ink2, 3);
        X.crt(ctx, 74, 34, 492, 214, true);
        R.text(ctx, LABELS.ticket, 90, 46, P.phosphorD);
        R.text(ctx, 'BID', 150, 66, P.jade, 'center'); R.text(ctx, 'ASK', 490, 66, P.crimson, 'center');
      }
      if (!part) {
        for (let i = 0; i < 5; i++) {
          const bid = DOC_GEOM.ticket.bid(i), ask = DOC_GEOM.ticket.ask(i);
          X.rect(ctx, bid.x, bid.y, bid.w, bid.h, i ? P.screenGlow : P.jadeD);
          X.rect(ctx, ask.x, ask.y, ask.w, ask.h, P.crimsonD);
        }
      }
      if (!part || part === 'glass') {
        valueLines(value, 150).forEach((ln, i) => big(ctx, ln, 320, 160 + i * 28, P.phosphor, 3, 'center'));
        X.scanlines(ctx, 74, 34, 492, 214, P.ink, 0.12);
      }
    },
    vote(ctx, day, value, c, o) {
      X.rect(ctx, 0, 0, V.w, V.h, P.deskD); X.gradient(ctx, 0, 0, V.w, V.h, P.desk, P.deskD, 8);
      X.cel(ctx, 40, 20, 560, 256, P.ink, P.slate2, P.ink2, P.ink2, 3);
      R.text(ctx, LABELS.vote, 320, 32, P.amber, 'center');
      // Two banks of lamps, yea and nay.
      const VG = DOC_GEOM.vote;
      for (let r = 0; r < VG.rows; r++) for (let k = 0; k < VG.cols; k++) {
        const y = VG.yea(r, k), n = VG.nay(r, k);
        X.rect(ctx, y.x, y.y, y.w, y.h, VG.yeaLit(r, k) && !(o && o.unlit) ? P.jadeD : P.ink2);
        X.rect(ctx, n.x, n.y, n.w, n.h, VG.nayLit(r, k) && !(o && o.unlit) ? P.crimsonD : P.ink2);
      }
      valueLines(value, 180).forEach((ln, i) => big(ctx, ln, 320, 160 + i * 28, P.bone, 3, 'center'));
    },
    voicemail(ctx, day, value, c, o) {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.save(); ctx.globalAlpha = 0.14; X.rect(ctx, 170, 0, 300, 300, P.screenGlow); ctx.restore();
      X.cel(ctx, 200, 14, 240, 290, P.ink2, P.slate2, P.ink, P.ink2, 3);
      X.rect(ctx, 212, 28, 216, 262, P.screen);
      R.text(ctx, LABELS.voicemail, 320, 40, P.grey2, 'center');
      for (let i = 0; i < DOC_GEOM.voicemail.count; i++) { const b = DOC_GEOM.voicemail.bar(i, day); X.rect(ctx, b.x, b.y, b.w, b.h, i < (o && o.played != null ? o.played : 12) ? P.phosphor : P.slate2); }
      valueLines(value, 90).forEach((ln, i) => big(ctx, ln, 320, 150 + i * 22, P.bone, 2, 'center'));
    }
  };
  // o is the document's own options (see DOC_DRAW); o.noGrain leaves out the full-screen 0.05 scanlines, which a layered beat draws in its top layer.
  function insertShot(ctx, day, value, doc, o) {
    const a = (B.StoryData.actIndex(day) + 1), c = R.colors(a);
    (DOC_DRAW[doc] || DOC_DRAW.memo)(ctx, day, value, c, o);
    if (!(o && o.noGrain)) X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }

  // The act's name as the card shows it (the part after the dot, 44 letters at most).
  function actName(day) { const label = act(day); return R.clean(label.split('·')[1] ? label.split('·')[1].trim() : label).slice(0, 44); }
  // o.noName leaves the name out: the layered card types it on.
  function actCard(ctx, day, o) {
    const a = (B.StoryData.actIndex(day) + 1), c = R.colors(a);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, V.h, c.wash, P.ink, 12);
    const label = act(day);
    if (!(o && o.noName)) big(ctx, label.split('·')[1] ? label.split('·')[1].trim() : label, 320, 150, P.bone, 4, 'center');
    big(ctx, `ACT ${label.split('·')[0].trim()}`, 320, 112, c.signal, 2, 'center');
  }

  // A small version of the day's document, lying on your desk. The camera
  // tilts down so the paper sits above the caption box: z pushes in on it.
  // o (optional; absent draws everything): part 'desk' is the desk and the room (no paper), 'paper' only the paper, at o.dy art units lower (whole units).
  // deskSpace runs fn(c) in the same art space as the paper and the desk: 2x, then the zoom's translate and scale; a layered beat draws its moving marks there.
  function deskXform(c, z, ty, fn) {
    c.save();
    c.translate(Math.round(160 - 119 * z), Math.round(ty - 153 * z)); c.scale(z, z);
    fn(c);
    c.restore();
  }
  // The desk's zoom (1.15 when none is given) and the y it is placed at: one source for the paper and the marks drawn on it.
  const deskZoom = (zoom) => ({ z: zoom || 1.15, ty: zoom ? 84 : 104 });
  function deskSpace(ctx, day, zoom, fn) {
    const { z, ty } = deskZoom(zoom);
    at2x(ctx, (c) => deskXform(c, z, ty, fn), day);
  }
  function deskWithDoc(ctx, day, r, zoom, o) {
    const { z, ty } = deskZoom(zoom), part = o && o.part, dy = (o && o.dy) || 0;
    at2x(ctx, (c) => {
      if (part !== 'paper') X.rect(c, 0, 0, 320, 180, P.desk);
      deskXform(c, z, ty, (g) => {
        if (part !== 'paper') SH.deskCloseup(g, 1, { crash: R.marketDown(day - 1), ticker: ['INDX', 'CRVS', 'FRLN', 'MRDN', 'BSTN'][day % 5] });
        if (part === 'desk') return;
        X.cel(g, 90, 138 + dy, 58, 30, P.bone, P.white, P.putty, P.ink, 1);
        X.rect(g, 94, 142 + dy, 50, 1, P.grey);
        X.rect(g, 94, 148 + dy, 50, 7, r.doc === 'rating' || r.doc === 'vote' ? P.sky : r.doc === 'chart' ? P.crimsonD : P.amberD);
        X.text(g, R.clean(r.arg || '').slice(0, 9), 95, 158 + dy, P.ink);
      });
    }, day);
  }
  // Where you are when the day's document reaches you.
  function establishDoc(ctx, day, r, title) {
    switch (r.doc) {
      case 'rating': return at2x(ctx, (c) => { SH.apartment(c, 0.7); SH.tvSet(c, 40, 50, 104, 68, r.arg || title, act(day), 0); }, day);
      case 'post': return R.phoneFrame(ctx, R.storyboard(day), [{ source: 'SQWAK', title: r.arg || title, kind: 'chirp' }], false);
      case 'vote': return B.DecisionArt ? B.DecisionArt.room(ctx, day > 27 ? 'c8' : 'c3', day, true, { f: { billPassed: /PASSES/.test(r.arg || '') } }) : at2x(ctx, (c) => SH.apartment(c, 0.6), day);
      case 'voicemail': return at2x(ctx, (c) => SH.apartment(c, 0.15), day);
      case 'ticket': return at2x(ctx, (c) => SH.tradingFloor(c, 0.45 + (day % 4) * 0.08, true, day), day);
      case 'chart': return R.officeFrame(ctx, day, false);
      case 'footnote': return deskWithDoc(ctx, day, r, 1.5);
      default: return deskWithDoc(ctx, day, r, 0);
    }
  }
  // Ordinary mornings: the place you are when the news finds you.
  function placeShot(ctx, day, title) {
    const sb = R.storyboard(day);
    switch (sb.place) {
      case 'apartment': return at2x(ctx, (c) => { SH.apartment(c, 0.5); SH.tvSet(c, 40, 50, 104, 68, title, act(day), 0); }, day);
      case 'lobby': case 'elevator': return at2x(ctx, (c) => SH.elevator(c, 0.15 + (day % 5) * 0.12, 41), day);
      case 'desk': return deskWithDoc(ctx, day, { doc: 'memo', arg: title }, 1.3);
      default: return R.placeFrame(ctx, sb, title, false);
    }
  }
  function racksShot(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    for (let i = 0; i < 8; i++) {
      X.cel(ctx, 30 + i * 76, 40, 60, 210, P.ink2, P.slate, P.ink, P.ink2, 3);
      for (let k = 8; k < 200; k += 12) X.rect(ctx, 36 + i * 76, 40 + k, 48, 6, P.screenD);
    }
    X.rect(ctx, 0, 250, V.w, 110, P.slate);
  }

  // The underlying set pieces have 320-pixel silhouettes. These fine marks
  // live on the 640-pixel canvas, giving glass, paper and architecture their
  // own scale without changing a storyboard's subject or blocking its caption.
  function finePass(ctx, day, r, phase, which) {
    // `which`: 'world' draws only the shot's own marks, 'frame' only the corner brackets, undefined both.
    const world = which !== 'frame', corners = which !== 'world';
    const signal = R.colors((B.StoryData.actIndex(day) + 1)).signal;
    const top = phase === 'detail' ? 19 : 12;
    if (r.shot === 'insert' && phase === 'detail') return; // native documents already have fine linework
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (!world) { /* corner brackets only */ }
    else if (r.shot === 'floor' || r.shot === 'dark' || r.shot === 'place') {
      for (let i = 0; i < 8; i++) {
        const x = 82 + i * 69 + ((day * 11) % 17);
        X.rect(ctx, x, 119 + (i % 3) * 5, 1, 61, P.grey2);
        X.rect(ctx, x + 8, 202 + (i % 2) * 7, 22, 1, signal);
      }
      X.rect(ctx, 0, 245, V.w, 1, P.grey2);
      for (let i = 0; i < 19; i++) X.rect(ctx, i * 37 + (day % 7), 247 + i % 3, 13, 1, P.slate2);
    } else if (r.shot === 'elevator') {
      for (let i = 0; i < 9; i++) X.rect(ctx, 199 + i * 28, 58, 1, 178, P.bone);
      X.rect(ctx, 187, 245, 266, 1, signal);
      X.rect(ctx, 308, 45, 24, 1, P.amber); // below the indicator housing, clear of the digits
    } else if (r.shot === 'tableau' || r.shot === 'tv') {
      for (let y = 48; y < 239; y += 8) X.rect(ctx, 14, y, 1, 2, signal);
      for (let y = 48; y < 239; y += 8) X.rect(ctx, V.w - 15, y, 1, 2, signal);
      X.rect(ctx, 14, 241, 74, 1, P.grey2);
      X.rect(ctx, V.w - 88, 241, 74, 1, P.grey2);
    } else if (r.shot === 'skyline') {
      for (let i = 0; i < 18; i++) {
        const x = 17 + i * 35, y = 62 + ((i * 29 + day * 7) % 63);
        X.rect(ctx, x, y, 1, 1, P.bone);
      }
      X.rect(ctx, 0, 259, V.w, 1, signal);
    } else if (r.shot === 'racks') {
      for (let i = 0; i < 8; i++) {
        X.rect(ctx, 34 + i * 76, 53, 1, 186, P.grey2);
        for (let j = 0; j < 8; j++) X.rect(ctx, 73 + i * 76, 58 + j * 22, 2, 1, j > 3 ? P.crimson : P.sky);
      }
    } else if (r.shot === 'bell') {
      for (let i = 0; i < 12; i++) X.rect(ctx, 217 + i * 17, 218 - i % 3, 9, 1, P.amber);
    }
    if (!corners) { ctx.restore(); return; }
    ctx.globalAlpha = 0.65;
    X.rect(ctx, 16, top, 38, 1, signal);
    X.rect(ctx, 16, top, 1, 10, signal);
    X.rect(ctx, V.w - 54, top, 38, 1, signal);
    X.rect(ctx, V.w - 17, top, 1, 10, signal);
    ctx.restore();
  }

  function shotFrame(ctx, day, r, title) {
    switch (r.shot) {
      case 'tv': return at2x(ctx, (c) => { SH.apartment(c, 0.7); SH.tvSet(c, 40, 50, 104, 68, r.arg || title, act(day), 0); }, day);
      case 'floor': return at2x(ctx, (c) => SH.tradingFloor(c, 0.15, true, day), day);
      case 'dark': return at2x(ctx, (c) => { SH.tradingFloor(c, 0.15, false, day); if (!SH.floorArt()) { c.save(); c.globalAlpha = 0.42; X.rect(c, 0, 0, 320, 180, P.ink); c.restore(); } }, day);
      case 'elevator': return at2x(ctx, (c) => SH.elevator(c, 0.6, 41), day);
      case 'bell': return at2x(ctx, (c) => SH.bellScene(c, 0.5, false), day);
      case 'tableau': return at2x(ctx, (c) => { if (!tableau(c, r.arg)) SH.apartment(c, 0.6); }, day);
      case 'skyline': return skylineShot(ctx, day, '');
      case 'racks': return racksShot(ctx, day);
      case 'insert': return r.weight === 'S' ? insertShot(ctx, day, r.arg || title, r.doc) : establishDoc(ctx, day, r, title);
      default: return placeShot(ctx, day, title);
    }
  }
  // Framing for the opening shot, from the rhythm board's camera: a wide, a
  // push-in, or a push-in held off-centre. Documents and title cards stay square-on.
  const CAMS = { wide: [1, 0.5], profile: [1.18, 0.2], 'over-shoulder': [1.18, 0.85], insert: [1.34, 0.5], close: [1.34, 0.25], desk: [1.24, 0.7] };
  // Repeats of the same kind of shot take the next framing in turn, so two
  // desk mornings in a week never open on the same picture.
  const CAM_ORDER = ['wide', 'insert', 'profile', 'over-shoulder', 'close', 'desk'].map((k) => CAMS[k]);
  function kindOf(r, day) { return r.shot === 'insert' ? 'doc:' + r.doc : r.shot === 'place' ? 'place:' + R.storyboard(day).place : r.shot; }
  function kindIndex(day, r) {
    const k = kindOf(r, day);
    let n = 0;
    for (let d = 0; d < day; d++) if (kindOf(row(d), d) === k) n++;
    return n + (k.length % 3);
  }
  // o (optional): draw(c) is drawn in place of the shot, noBack leaves out the ink behind a zoomed shot. A layered establish draws its bottom layer
  // with { draw } and its animated marks with { draw, noBack: true }, so they sit in exactly the transform the art was drawn in.
  function framed(ctx, day, r, title, o) {
    const draw = (o && o.draw) || ((c) => shotFrame(c, day, r, title));
    const flat = r.shot === 'skyline' || r.shot === 'tableau' || r.shot === 'bell' || (r.shot === 'insert' && (r.weight === 'S' || r.doc === 'vote'));
    const cam = flat ? CAMS.wide : CAM_ORDER[kindIndex(day, r) % CAM_ORDER.length];
    if (cam[0] === 1) return draw(ctx);
    if (!(o && o.noBack)) X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    ctx.save();
    ctx.translate(Math.round(cam[1] * V.w * (1 - cam[0])), Math.round(0.4 * V.h * (1 - cam[0])));
    ctx.scale(cam[0], cam[0]);
    draw(ctx);
    ctx.restore();
  }
  function detailFrame(ctx, day, r, title) {
    switch (r.shot) {
      case 'insert': case 'dark': case 'racks':
        return r.arg ? insertShot(ctx, day, r.arg, r.doc) : at2x(ctx, (c) => SH.tradingFloor(c, 0.7, false, day), day);
      case 'skyline': return skylineShot(ctx, day, title);
      case 'tableau': return at2x(ctx, (c) => { if (!tableau(c, r.arg, 1.3)) SH.apartment(c, 0.6); }, day);
      case 'floor': return at2x(ctx, (c) => SH.tradingFloor(c, 0.7, true, day), day);
      case 'elevator': return at2x(ctx, (c) => SH.elevator(c, 1, 41), day);
      case 'bell': return at2x(ctx, (c) => { c.save(); c.translate(160 * -0.6, 40 * -0.6); c.scale(1.6, 1.6); SH.bellScene(c, 0.2, false); c.restore(); }, day);
      case 'tv': return at2x(ctx, (c) => { SH.apartment(c, 0.7); c.save(); c.translate(92 * -0.3, 74 * -0.3); c.scale(1.3, 1.3); SH.tvSet(c, 40, 50, 104, 68, r.arg || title, act(day), 0); c.restore(); }, day);
      default: return R.placeFrame(ctx, R.storyboard(day), title, true);
    }
  }

  // ---- Weekends: home, by rent tier, with the week's story on top ----
  // Tier ids from js/modes/story/economy.js, cheapest first.
  const HOMES = {
    couch: { wall: P.putty, wall2: P.putty2, floor: P.carpet, win: 0.22, view: 'suburb' },
    share: { wall: P.slate, wall2: P.slate2, floor: P.carpetD, win: 0.26, view: 'wall' },
    studio: { wall: P.putty, wall2: P.plastic2, floor: P.deskD, win: 0.28, view: 'shaft' },
    onebed: { wall: P.plastic2, wall2: P.bone, floor: P.desk, win: 0.40, view: 'city' },
    loft: { wall: P.deskD, wall2: P.desk, floor: P.desk2, win: 0.58, view: 'bridges' },
    penthouse: { wall: P.bone, wall2: P.white, floor: P.desk2, win: 0.86, view: 'park' }
  };
  // The weekends the story cares about: Friday's day index -> caption.
  const WEEKENDS = {
    4: 'THE BONUS EMAIL SITS UNREAD ALL WEEKEND.',
    14: 'THE BILL IS ON EVERY CHANNEL. NOBODY HAS READ IT.',
    24: 'THE LIGHTS AT TREASURY ARE STILL ON.',
    34: 'KROLL PAID FOR DINNER. IT IS OVER, HE SAYS.',
    39: 'FOUR VOTES SHORT. THE PHONES RING ALL NIGHT.',
    44: '3:17 AM. THE MACHINES ARE STILL TRADING.'
  };
  function wallet(o) { const g = o && o.game; return g && g.mode && g.mode.S && g.mode.S.wallet; }
  function homeOf(w) {
    const E = B.Economy;
    const t = w && E ? E.tier(w) : { id: 'studio', name: 'Midtown studio' };
    return { id: t.id, name: t.name, look: HOMES[t.id] || HOMES.studio };
  }
  // ---- the apartment, drawn to the pet's rules ----
  // Every prop sits on a 3px grid with an ink outline, light on the top and
  // left edges and shade on the bottom and right, so furniture, story props
  // and the pet read as one set.
  const U = 3;
  const box = (ctx, x, y, w, h, base, hi, sh, out) => X.cel(ctx, x, y, w, h, base, hi, sh, out, U);
  function blit(ctx, rows, x, y) { ctx.save(); ctx.translate(x, y); ctx.scale(U, U); X.drawSprite(ctx, X.sprite(rows), 0, 0); ctx.restore(); }
  // 3x5 clock digits on a 2px grid: the alarm is always set for 5:58.
  const CLOCK = { '5': ['111', '100', '111', '001', '111'], '8': ['111', '101', '111', '101', '111'], ':': ['0', '1', '0', '1', '0'] };
  function clockFace(ctx, x, y, col) {
    let cx = x;
    for (const ch of '5:58') { CLOCK[ch].forEach((row, j) => row.split('').forEach((b, i) => { if (b === '1') X.rect(ctx, cx + i * 2, y + j * 2, 2, 2, col); })); cx += ch === ':' ? 4 : 8; }
  }
  const LAMP = ['....111111....', '...18888881...', '..1888888881..', '.188888888871.', '18888888888771', '11111111111111'];
  // You, up late, hood up, face lit by the phone.
  const FIGURE = ['....1111......', '...122221.....', '..12222221....', '..122gg221....', '..12gggg21....', '...12gg21.....',
    '..1222222111..', '.122222222hh1.', '.12222222hHh1.', '.1222222221111', '.122222222221.', '.122222222221.', '.111111111111.'];
  const PLANT = ['...1..1..1....', '..1j11j11j1...', '.1jJj1jJ1jj1..', '.1jJjjJjjJj1..', '..1jJjJjJj1...', '...11J1J11....', '....1ddd1.....', '...1DDDDD1....', '...1DeDDD1....', '...1DDDDd1....', '....11111.....'];
  // Where the bed or couch ends and the nightstand stands, per home.
  const LAYOUT = {
    couch: { stand: 309 }, share: { stand: 255 }, studio: { stand: 255 },
    onebed: { stand: 255 }, loft: { stand: 255, plant: 327 }, penthouse: { stand: 255, plant: 327 }
  };

  // The window opening grows with the rent; layers and animate steps share this.
  function windowRect(home) {
    const L = home.look, ww = Math.round(V.w * L.win / U) * U;
    return { wx: V.w - ww - 36, wy: 42, ww, wh: L.win > 0.8 ? 198 : 150 };
  }
  // The glow on a sitting figure's face and chest (the rect of the night figure's screen light).
  function faceGlow(home) { return { x: 213, y: (home.id === 'share' ? 213 : 180) + 6, w: 36, h: 24 }; }
  // The day-44 laptop's screen on the bed (where the story left it).
  function laptopRect(home) {
    const top = home.id === 'couch' ? 210 : home.id === 'share' ? 252 : 204;
    return { x: (home.id === 'share' ? 132 : 150) + 6, y: top - 21, w: 42, h: 18 };
  }
  // The Sunday phone's light (apartment art units): the lit floor phone's screen and notification bar, and the light it throws up
  // from a face-up screen in three hard steps. Only the sky blue screen exists: a late week (crimson) sits a figure at the phone, whose face glows instead.
  function phoneSpill() {
    const col = P.sky;
    return {
      screen: { x: 219, y: 264, w: 21, h: 6, col: P.sky },
      bar: { x: 222, y: 266, w: 12, h: 2, col: P.white },
      spill: [{ x: 204, y: 240, w: 51, h: 21, col, a: 0.10 }, { x: 210, y: 249, w: 39, h: 12, col, a: 0.12 }, { x: 216, y: 258, w: 27, h: 6, col, a: 0.14 }]
    };
  }
  // `part` picks one layer of the layered Saturday shot: 'outside' (sky, view, still weather in the opening),
  // 'room' (walls, floor, window frame, curtains, wall props), 'furniture', 'front' (floor props and the pet), 'grain'.
  // With no part it draws the whole flat picture, back to front, exactly as before.
  function apartmentShot(ctx, day, home, night, w, part) {
    const L = home.look, week = Math.floor(day / 5) + 1, s = R.season(day), lay = LAYOUT[home.id] || LAYOUT.studio;
    const late = w ? w.lateWeeks | 0 : 0;
    const on = (name) => !part || part === name;
    const { wx, wy, ww, wh } = windowRect(home);
    if (on('room')) {
    // As a layer the wall leaves the window opening unpainted (even-odd clip, source-over only).
    if (part) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, V.w, V.h); ctx.rect(wx, wy, ww, wh); ctx.clip('evenodd'); }
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    // Wall: the tier's paint, a quiet stripe, a picture rail.
    X.gradient(ctx, 0, 0, V.w, 240, night ? L.wall : L.wall2, night ? P.ink2 : L.wall, 10);
    ctx.save(); ctx.globalAlpha = 0.18; for (let x = 0; x < V.w; x += 24) X.dither(ctx, x, 30, 6, 210, L.wall, P.plasticD, 0.35); ctx.restore();
    X.rect(ctx, 0, 24, V.w, U, night ? P.ink2 : P.putty2); X.rect(ctx, 0, 27, V.w, U, P.plasticD);
    // Floor: staggered boards, or carpet where the tier is carpeted.
    X.rect(ctx, 0, 249, V.w, 111, L.floor);
    if (L.floor === P.carpet || L.floor === P.carpetD) {
      X.dither(ctx, 0, 252, V.w, 108, L.floor, L.floor === P.carpet ? P.carpet2 : P.carpet, 0.18);
      X.rect(ctx, 0, 252, V.w, U, P.ink2);
    } else {
      for (let row = 0; row < 7; row++) {
        const y = 252 + row * 15, off = (row % 3) * 57;
        X.rect(ctx, 0, y, V.w, U, P.deskD);
        for (let x = -off; x < V.w; x += 171) {
          X.rect(ctx, x, y, U, 15, P.deskD);
          if (Math.round(x / 171 + row) % 3 === 0) { ctx.save(); ctx.globalAlpha = 0.25; X.rect(ctx, x + U, y + U, 168, 12, P.desk2); ctx.restore(); }
        }
      }
    }
    box(ctx, -U, 237, V.w + 2 * U, 15, night ? P.slate2 : P.putty2, night ? P.grey : P.bone, night ? P.slate : P.putty);
    if (part) ctx.restore();
    }

    // What is outside the window changes with the rent too.
    if (on('outside')) {
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    // as a night layer (Sunday's fractional frame) the opening is backed with ink: adjacent gradient bands that each cover part of a pixel row would otherwise leave it part transparent
    if (part && night) X.rect(ctx, wx, wy, ww, wh, P.ink);
    X.gradient(ctx, wx, wy, ww, wh, night ? P.ink2 : P.sky, night ? P.ink : P.slate2, 8);
    if (!night) X.dither(ctx, wx, wy + wh / 2, ww, wh / 2, P.slate2, s.dawn, s.glow);
    if (L.view === 'shaft' || L.view === 'wall') {
      X.rect(ctx, wx, wy, ww, wh, L.view === 'shaft' ? P.deskD : P.slate);
      for (let yy = wy; yy < wy + wh; yy += 9) for (let xx = wx + ((yy / 9) % 2) * 9; xx < wx + ww; xx += 18) X.rect(ctx, xx, yy, 15, U, P.ink2);
    } else {
      const lights = night ? lit(day) : 0, n = Math.ceil(ww / 24);
      for (let i = 0; i < n; i++) {
        const bw = 15 + ((i * 17 + week) % 12), bh = (L.view === 'suburb' ? 21 : 42) + ((i * 41 + week * 7) % (L.view === 'suburb' ? 24 : 105));
        const bx = wx + i * 24, by = wy + wh - bh;
        X.rect(ctx, bx, by, bw, bh, P.ink2); X.rect(ctx, bx, by, bw, U, i % 2 ? P.slate2 : P.slate); X.rect(ctx, bx + bw - U, by, U, bh, P.ink);
        for (let yy = 6; yy < bh - 6; yy += 9) for (let xx = 3; xx < bw - 6; xx += 6) if (((i * 13 + xx + yy + week) % 100) / 100 < lights) X.rect(ctx, bx + xx, by + yy, U, U, P.amber);
      }
      if (L.view === 'bridges') { X.rect(ctx, wx, wy + wh - 48, ww, U, P.grey); for (let i = 0; i < 6; i++) X.rect(ctx, wx + 21 + Math.round(i * ww / 6 / U) * U, wy + wh - 72, U, 24, P.grey); }
      if (L.view === 'park') X.rect(ctx, wx, wy + wh - 30, ww, 30, s.snow ? P.bone : s.id === 'autumn' ? P.amberD : P.jadeD);
    }
    R.weather(ctx, wx, wy, ww, wh, day);
    ctx.restore();
    }
    if (on('room')) {
    const fr = night ? P.slate2 : P.plastic2, frH = night ? P.grey : P.white, frS = night ? P.slate : P.plasticD;
    box(ctx, wx - 9, wy - 9, ww + 18, 12, fr, frH, frS); box(ctx, wx - 9, wy + wh - 3, ww + 18, 12, fr, frH, frS);
    box(ctx, wx - 9, wy, 12, wh, fr, frH, frS); box(ctx, wx + ww - 3, wy, 12, wh, fr, frH, frS);
    if (L.win > 0.5) { const panes = Math.round(ww / 132); for (let k = 1; k < panes; k++) box(ctx, wx + Math.round(k * ww / panes / U) * U - 6, wy, 12, wh, fr, frH, frS); }
    else { box(ctx, wx + Math.round(ww / 2 / U) * U - 6, wy, 12, wh, fr, frH, frS); box(ctx, wx, wy + Math.round(wh / 2 / U) * U - 6, ww, 9, fr, frH, frS); }
    box(ctx, wx - 12, wy + wh + 6, ww + 24, 12, fr, frH, frS);
    // Curtains on a rod, in the tier's fabric, where the wall has room.
    const cur = home.id === 'couch' ? [P.crimsonD, P.crimson] : home.id === 'loft' || home.id === 'penthouse' ? [P.putty, P.bone] : home.id === 'share' ? [P.slate, P.slate2] : [P.carpet, P.carpet2];
    X.rect(ctx, wx - 36, wy - 21, ww + 72, U * 2, P.ink2); X.rect(ctx, wx - 36, wy - 21, ww + 72, U, P.grey);
    for (const cx of [wx - 33, wx + ww + 3].filter((c) => c > 0 && c + 30 <= V.w)) {
      box(ctx, cx, wy - 15, 30, wh + 30, cur[0], cur[1], P.ink2);
      for (let k = 9; k < 27; k += 9) X.rect(ctx, cx + k, wy - 12, U, wh + 24, cur[1]);
    }
    if (s.wreath) { box(ctx, wx + Math.round(ww / 2 / U) * U - 18, wy - 30, 36, 12, P.jadeD, P.jade, P.ink2); box(ctx, wx + Math.round(ww / 2 / U) * U - 6, wy - 24, 12, 12, P.crimson, P.white, P.crimsonD); }
    // The studio's radiator knocks under the window.
    if (home.id === 'studio') { box(ctx, wx + 12, 207, 84, 30, P.plasticD, P.plastic, P.ink2); for (let x = wx + 21; x < wx + 90; x += 12) X.rect(ctx, x, 213, U, 18, P.ink2); }

    // The week number on a paper calendar, on a nail, with rings.
    X.rect(ctx, 69, 60, U, U, P.ink2);
    box(ctx, 39, 66, 66, 78, P.bone, P.white, P.putty2);
    box(ctx, 39, 66, 66, 18, P.crimsonD, P.crimson, P.crimsonD);
    for (const kx of [51, 69, 87]) { X.rect(ctx, kx, 63, U * 2, 9, P.grey2); X.rect(ctx, kx, 63, U * 2, U, P.white); }
    for (let x = 42; x < 102; x += 6) X.rect(ctx, x, 138, U, U, P.putty);
    ctx.save(); ctx.scale(5, 5); X.text(ctx, String(week), 14, 19, P.ink, { align: 'center' }); ctx.restore();

    // Money trouble shows up at the door: the door behind the bed, envelopes
    // slid across the floor in front of it, a red notice after three late weeks.
    if (late > 0) {
      box(ctx, 120, 99, 75, 150, P.deskD, P.desk, P.ink2);
      box(ctx, 132, 111, 51, 48, P.deskD, P.desk, P.ink2);
      X.rect(ctx, 180, 174, 6, 6, P.amber);
      if (late >= 3) { box(ctx, 135, 117, 45, 42, P.bone, P.white, P.crimsonD); X.rect(ctx, 141, 123, 33, 6, P.crimson); X.rect(ctx, 141, 135, 27, U, P.grey); X.rect(ctx, 141, 141, 30, U, P.grey); }
    }

    // Lamplight at night: three hard-edged rings on the wall and floor, drawn
    // behind the furniture so objects sit in the light, not under a haze.
    if (night) {
      const lx = lay.stand + 21, ly = 186;
      for (const [rad, a] of [[120, 0.07], [78, 0.08], [42, 0.1]]) {
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = P.amber;
        for (let y = ly - rad; y < Math.min(282, ly + rad); y += U) {
          const half = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - ly) * (y - ly))) * 1.35 / U) * U;
          ctx.fillRect(lx - half, y, half * 2, U);
        }
        ctx.restore();
      }
    }

    }

    if (on('furniture')) {
    // Furniture: Mom's couch, a mattress on a shared floor, or a bed you pay for.
    const V1 = '#b4a7d0', V2 = '#76699a';
    let top = 204; // where things on the bed sit
    if (home.id === 'couch') {
      box(ctx, 42, 180, 246, 42, P.violet, V1, V2);
      for (let i = 0; i < 3; i++) box(ctx, 63 + i * 69, 216, 72, 30, P.violet, V1, V2);
      box(ctx, 30, 198, 36, 60, P.violet, V1, V2); box(ctx, 264, 198, 36, 60, P.violet, V1, V2);
      for (const lx of [39, 282]) box(ctx, lx, 255, 9, 12, P.deskD, P.desk, P.ink2);
      box(ctx, 69, 204, 45, 21, P.white, P.white, P.putty2); box(ctx, 120, 213, 138, 33, P.sky, '#9cbbdb', P.slate2);
      top = 210;
    } else if (home.id === 'share') {
      box(ctx, 30, 234, 210, 27, P.bone, P.white, P.putty2);
      box(ctx, 36, 225, 48, 18, P.white, P.white, P.putty2);
      box(ctx, 96, 228, 144, 30, P.slate, P.slate2, P.ink2); X.rect(ctx, 99, 237, 138, U, P.ink2);
      box(ctx, 327, 99, 90, 153, P.plasticD, P.plastic, P.ink2); X.rect(ctx, 369, 102, U, 147, P.ink2); X.rect(ctx, 360, 168, 6, 6, P.grey2); X.rect(ctx, 375, 168, 6, 6, P.grey2);
      top = 252;
    } else {
      box(ctx, 36, 171, 24, 96, P.deskD, P.desk, P.ink2); box(ctx, 57, 234, 192, 21, P.desk, P.desk2, P.deskD);
      for (const lx of [60, 234]) X.rect(ctx, lx, 255, 9, 12, P.ink2);
      box(ctx, 57, 210, 192, 30, P.bone, P.white, P.putty2);
      box(ctx, 63, 198, 51, 24, P.white, P.white, P.putty2);
      const bl = home.id === 'penthouse' ? [P.crimsonD, P.crimson, P.ink2] : home.id === 'loft' ? [P.jadeD, P.jade, P.ink2] : [P.slate, P.slate2, P.ink2];
      box(ctx, 117, 204, 132, 39, bl[0], bl[1], bl[2]); X.rect(ctx, 120, 216, 126, U, bl[1]); X.rect(ctx, 120, 219, 126, U, P.ink2);
      for (let k = 129; k < 240; k += 18) X.rect(ctx, k, 228, 9, U, bl[1]);
    }
    if (lay.plant) blit(ctx, PLANT, lay.plant, 258 - PLANT.length * U);

    // What is on the bed this week, or what the story left there.
    const bx = home.id === 'share' ? 132 : 150, by = top - 24;
    if (day === 4 || day === 39) {
      for (let i = 0; i < (day === 39 ? 4 : 1); i++) { box(ctx, bx + i * 21, by + 6 - (i % 2) * 3, 36, 21, P.bone, P.white, P.putty2); X.rect(ctx, bx + 6 + i * 21, by + 12 - (i % 2) * 3, 21, U, day === 39 ? P.crimsonD : P.amberD); }
    } else if (day === 34) {
      box(ctx, bx, by + 3, 60, 24, P.bone, P.white, P.putty2); X.rect(ctx, bx + 6, by + 9, 42, U, P.amberD); X.rect(ctx, bx + 6, by + 15, 30, U, P.grey2);
    } else if (day === 44) {
      const lr = laptopRect(home);
      box(ctx, bx, by - 3, 54, 30, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, lr.x, lr.y, lr.w, lr.h, night ? P.screenGlow : P.screen);
      for (let i = 0; i < 9; i++) X.rect(ctx, bx + 9 + i * 4, by + 15 - (i * 7 % 9), 2, 2, i > 5 ? P.crimson : P.phosphorD);
      box(ctx, bx - 6, by + 24, 66, 9, P.plastic, P.plastic2, P.plasticD);
    } else if (day === 14 || day === 24 || week % 3 === 0) {
      box(ctx, bx, by - 3, 54, 30, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, bx + 6, by + 3, 42, 18, night ? P.screenGlow : P.screen);
      const c = day === 24 ? P.amber : P.sky;
      if (day === 14 || day === 24) for (let i = 0; i < 4; i++) X.rect(ctx, bx + 9, by + 6 + i * 4, 33 - i * 6, 2, c);
      else { X.rect(ctx, bx + 9, by + 9, 24 - week % 5, U, P.sky); X.rect(ctx, bx + 9, by + 15, 15 + week % 7, U, P.phosphorD); }
      box(ctx, bx - 6, by + 24, 66, 9, P.plastic, P.plastic2, P.plasticD);
    } else if (week % 3 === 1) {
      for (let i = 0; i < 3; i++) box(ctx, bx + i * 6, by + 9 - i * 3, 45, 18, P.bone, P.white, P.putty2);
      X.rect(ctx, bx + 18, by + 9, 27, U, P.grey);
    } else {
      box(ctx, bx, by + 6, 39, 24, P.bone, P.white, P.putty2); X.rect(ctx, bx + 6, by + 12, 27, U, P.crimsonD);
      box(ctx, bx + 42, by + 12, 18, 18, P.crimsonD, P.crimson, P.ink2);
    }

    // Nightstand: a drawer, a shaded lamp and the 5:58 alarm.
    const nx = lay.stand;
    box(ctx, nx, 213, 60, 51, P.desk, P.desk2, P.deskD); X.rect(ctx, nx + 6, 234, 48, U, P.deskD); X.rect(ctx, nx + 27, 240, 6, U, P.amber);
    box(ctx, nx + 12, 201, 18, 15, P.slate, P.slate2, P.ink2); X.rect(ctx, nx + 19, 177, U, 24, P.grey);
    blit(ctx, LAMP, nx, 162);
    if (night) X.rect(ctx, nx + 3, 180, 36, U, P.amber);
    box(ctx, nx + 33, 198, 27, 18, P.ink2, P.slate, P.ink); clockFace(ctx, nx + 37, 202, P.crimson);
    }

    if (on('front')) {
    // The door's envelopes, where you can see them over the caption.
    if (late > 0) for (let i = 0; i < Math.min(5, late * 2); i++) box(ctx, 105 + i * 21, 258 - (i % 2) * 3, 30, 15, P.bone, P.white, P.putty2);
    // Your phone, face up on the floor. It never stops.
    box(ctx, 213, 261, 33, 15, P.ink2, P.slate2, P.ink); X.rect(ctx, 219, 264, 21, 6, night ? P.screenGlow : P.screen);
    // A rug where the pet sleeps.
    box(ctx, 372, 258, 234, 27, P.carpetD, P.carpet, P.ink2); for (let x = 384; x < 600; x += 18) X.rect(ctx, x, 264, 9, U, P.carpet2);

    // Sunday night on the couch, or any night the rent is late: you, sitting
    // up, lit by the phone. Your mother calls on Sundays.
    if (night && (home.id === 'couch' || late > 0)) {
      const fy = home.id === 'share' ? 213 : 180, fg = faceGlow(home);
      blit(ctx, FIGURE, 207, fy);
      ctx.save(); ctx.globalAlpha = 0.18; X.rect(ctx, fg.x, fg.y, fg.w, fg.h, P.screenGlow); ctx.restore();
    }
    petShot(ctx, w);
    }
    if (on('grain')) {
    if (night) { ctx.save(); ctx.globalAlpha = 0.28; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
    }
  }
  // The pet from the adoption beat, in the sprite DSL (js/art/palette.js keys):
  // 1 outline, a/A amber coat, 8 bone, h eyes, 0 pupils, D/d/e dog browns and
  // r for the collar, which is blue for Rosco and red for Jemma. Neglect is
  // purely visual: a matted coat, no collar, dull eyes, a tipped bowl.
  const PET = {
    cat: ['..1.....1.......', '.1a1...1a1......', '.1aa111aa1......', '.1aAaaaAa1......', '.1ah0a0ha1......', '.1aa8r8aa1......',
      '..1a888a1.......', '..1rrarr1....11.', '.1aaaaaaa1..1a1.', '.1aA888Aaa1..1A1', '1aaA8888aAa1.1a1', '1aa88888aaAa11a1',
      '1aA88888aaaAaa1.', '1aa8888aaAaaa1..', '.1aaaaaaaaaa1...', '..1111111111....'],
    dog: ['...1111111..........', '..1DDDDDDD1.........', '.1dDDDDDDDd1........', '1ddD0DDD0Ddd1.......', '1ddDDDDDDDdd1.......',
      '1ddDeeeeeDdd1.......', '.1d1eee0ee1d1.......', '..1.1eeee1.1........', '....1rrarr1......11.', '...1DDDDDDD1....1D1.',
      '..1DDeeeeDDD1...1D1.', '.1DDeeeeeeDDD1..1D1.', '.1DDeeeeeeDDDD11DD1.', '.1DDeeeeeDDDDDDDD1..', '.1De1eee1eDDDDDD1...',
      '..1111111111111.....']
  };
  function petRows(pet, cared) {
    const coat = pet.kind === 'cat' ? 'a' : 'D', collar = pet.sex === 'girl' ? 'r' : 'b';
    return PET[pet.kind].map((r, y) => {
      if (!cared) r = r.replace('rrarr', coat.repeat(5));
      return r.split('').map((ch, x) => {
        if (ch === 'r') return cared ? collar : coat;
        if (cared) return ch;
        if (ch === 'h') return 'H';
        if (ch === '8') return (x + y) % 2 ? '7' : '6';
        if (ch === coat && (x * 3 + y) % 4 === 0) return '6';
        if (ch === 'e' && (x + y) % 3 === 0) return '6';
        return ch;
      }).join('');
    });
  }
  // The raised upper body for the breath, built once per kind, sex and care.
  const breathSprites = new Map();
  function breathSprite(pet, cared) {
    const key = `${pet.kind}:${pet.sex}:${cared ? 1 : 0}`;
    if (!breathSprites.has(key)) breathSprites.set(key, X.sprite(petRows(pet, cared).slice(0, 13)));
    return breathSprites.get(key);
  }
  function petShot(ctx, w) {
    const pet = w && w.pet;
    if (!pet || !PET[pet.kind]) return;
    const cared = w.vet !== 'neglected';
    const sp = X.sprite(petRows(pet, cared)), s = 3, fx = 420, floor = 276, fy = floor - sp.h * s - (cared ? 6 : 0);
    if (cared) { // a round cushion bed
      X.rect(ctx, fx - 10, floor - 8, sp.w * s + 14, 10, P.carpetD);
      X.rect(ctx, fx - 6, floor - 10, sp.w * s + 6, 4, P.carpet);
      X.rect(ctx, fx - 4, floor - 8, sp.w * s + 2, 2, P.carpet2);
    } else { ctx.save(); ctx.globalAlpha = 0.25; X.rect(ctx, fx + 2, floor - 2, sp.w * s - 4, 3, P.ink); ctx.restore(); }
    ctx.save(); ctx.translate(fx, fy); ctx.scale(s, s); X.drawSprite(ctx, sp, 0, 0); ctx.restore();
    const bx = fx - 56, by = floor - 18;
    if (cared) { // full bowl and a toy
      X.rect(ctx, bx, by + 6, 30, 9, P.crimsonD); X.rect(ctx, bx + 3, by + 6, 24, 2, P.crimson);
      X.rect(ctx, bx + 4, by + 2, 22, 4, P.desk2); X.rect(ctx, bx + 7, by + 1, 6, 2, P.deskD); X.rect(ctx, bx + 16, by + 1, 5, 2, P.deskD);
      X.rect(ctx, fx + sp.w * s + 14, floor - 10, 9, 9, P.sky); X.rect(ctx, fx + sp.w * s + 16, floor - 8, 3, 3, P.white);
    } else { // tipped, empty, crumbs and fur on the boards
      X.rect(ctx, bx + 4, by + 9, 26, 7, P.crimsonD); X.rect(ctx, bx + 6, by + 9, 22, 2, P.slate2);
      for (const [a, b] of [[-8, 13], [-16, 15], [-4, 16]]) X.rect(ctx, bx + a, by + b, 3, 2, P.desk2);
      const tuft = pet.kind === 'cat' ? P.amberD : P.deskD;
      for (const [a, b] of [[-70, 262], [70, 258], [92, 268], [-20, 254], [120, 262]]) { X.rect(ctx, fx + a, b, 5, 2, tuft); X.rect(ctx, fx + a + 1, b - 1, 2, 1, tuft); }
    }
  }
  // The Sunday framing: the wall calendar and most of the window (the housing tier reads through its size) stay in shot. fn draws in apartment art units.
  function sundaySpace(c, fn) { c.save(); c.translate(-36, -50); c.scale(1.18, 1.18); fn(c); c.restore(); }
  // The two native-pixel edge rects over the Sunday picture (the left margin and the amber tab).
  function SUN_EDGE(c) { X.rect(c, 0, 0, 5, 276, P.ink2); X.rect(c, 0, 0, 44, 2, P.amberD); }
  function sundayShot(ctx, day, home, w) {
    // A closer Sunday camera holds on the phone and the unread material.
    // Monday's alarm is already intruding on the private room.
    sundaySpace(ctx, (c) => apartmentShot(c, day, home, true, w));
    SUN_EDGE(ctx);
  }

  // Saturday, five layers back to front. The window frame overlaps the opening by 3 px, which hides the
  // outside layer's parallax: keep CAM_Y * (depth.room - depth.outside) <= 3.
  const SAT_DUR = 2.4, CAM_Y = 8;
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  // `when`: a time t (s) is in [a, b) for any of the given spans.
  const within = (t, spans) => spans.some((sp) => t >= sp[0] && t < sp[1]);
  // The pet's head and chest rise one pixel for one breath: the upper 13 rows drawn again one unit up.
  function breathDraw(c, w) {
    const cared = w.vet !== 'neglected';
    c.save(); c.translate(420, 276 - 48 - (cared ? 6 : 0) - 1); c.scale(3, 3);
    X.drawSprite(c, breathSprite(w.pet, cared), 0, 0);
    c.restore();
  }
  // o (optional; absent, the five layers of Saturday exactly): night (the night room), space (fn(c, draw): wraps every layer's draw and animate, Sunday's 1.18 frame),
  // t0 (chain time added to the weather), seed (the weather's seed, default id + ':wx'), dur (the beat's length, for the colon's end), blink (the colon blinks from the end
  // so it is lit at dur), front (fn(c, t) replaces Saturday's phone and breath), top (fn(c) drawn after the grain, outside space), flat (outside, interior, grain: no camera).
  function saturdayLayers(day, home, w, id, o) {
    o = o || {};
    const K = B.MotionKit, s = R.season(day), { wx, wy, ww, wh } = windowRect(home), lay = LAYOUT[home.id] || LAYOUT.studio;
    const space = o.space || ((c, fn) => fn(c)), t0 = o.t0 || 0, wseed = o.seed || id + ':wx', dur = o.dur || SAT_DUR;
    const part = (name) => (c) => space(c, (cc) => apartmentShot(cc, day, home, !!o.night, w, name));
    const colon = (c, t) => {
      if (o.blink) {
        K.blink(c, lay.stand + 45, 204, 2, 2, t, { on: null, off: P.ink2, period: 1.0, duty: 0.5, end: dur });
        K.blink(c, lay.stand + 45, 208, 2, 2, t, { on: null, off: P.ink2, period: 1.0, duty: 0.5, end: dur });
      } else if (within(t, [[0.5, 1.0], [1.5, 2.0]])) { X.rect(c, lay.stand + 45, 204, 2, 2, P.ink2); X.rect(c, lay.stand + 45, 208, 2, 2, P.ink2); } // the 5:58 alarm's colon blinks off twice
    };
    const front = (c, t) => {
      if (o.front) { o.front(c, t); return; }
      // the phone on the floor lights at 1.0 s (a sky screen and floor glow, crimson when rent is late),
      // the notification bar follows at 1.08 s, and a second silent notification blinks it dark from 1.6 to 1.7 s
      const late = w && w.lateWeeks > 0;
      if (t >= 1.0 && !(t >= 1.6 && t < 1.7)) {
        X.rect(c, 219, 264, 21, 6, late ? P.crimsonD : P.sky);
        if (t >= 1.08) X.rect(c, 222, 266, 12, 2, late ? P.crimson : P.white);
        c.save(); c.globalAlpha = 0.3; X.rect(c, 207, 276, 45, 3, late ? P.crimson : P.sky); c.restore();
      }
      // the pet's head and chest rise one pixel for one breath
      if (w && w.pet && PET[w.pet.kind] && t >= 0.8 && t < 1.7) breathDraw(c, w);
    };
    // the window's weather is the kit's own (snow, leaves or rain by the season); the least number of flakes, leaves or drops differs by kind
    const weatherAnim = (c, v, t) => space(c, (cc) => K.weather(cc, wx, wy, ww, wh, day, wseed, t, { t0, min: s.snow ? 12 : s.id === 'autumn' ? 4 : 10 }));
    const outside = { id: 'outside', depth: o.flat ? 1 : 0.25, draw: part('outside'), animate: weatherAnim };
    const grain = { id: 'grain', depth: o.flat ? 1 : 0, draw(c) { part('grain')(c); if (o.top) o.top(c); } };
    if (o.flat) {
      return [outside, {
        id: 'interior', depth: 1,
        draw(c) { part('room')(c); part('furniture')(c); part('front')(c); },
        animate(c, v, t) { space(c, (cc) => { colon(cc, t); front(cc, t); }); }
      }, grain];
    }
    return [
      outside,
      { id: 'room', depth: 0.5, draw: part('room') },
      { id: 'furniture', depth: 0.85, draw: part('furniture'), animate(c, v, t) { space(c, (cc) => { colon(cc, t); if (o.furniture) o.furniture(cc, t); }); } },
      { id: 'front', depth: 1.2, draw: part('front'), animate(c, v, t) { space(c, (cc) => front(cc, t)); } },
      grain
    ];
  }

  // The dark trading floor at 3:17 (day 44, not pulled): a refresh wave crosses the lit screens left to right (the lit-floor wave of batch 5 on the screens this
  // picture has). Art units inside at2x; the near-row screens only, row 3's clipped at art y 136 (screen 272) so nothing that matters moves under the caption.
  function floor317Layers(day) {
    const K = B.MotionKit, wave = SH.floorGeom(0.4, 60).filter((g) => g.on && g.x + g.w > 0 && g.x < 320)
      .map((g) => ({ g, a: 0.35 + 0.5 * clampN((g.x + g.w / 2) / 320, 0, 1), h: Math.min(g.h, 136 - g.y) })).filter((q) => q.h > 0);
    return [{
      id: 'floor', depth: 1,
      draw(c) { at2x(c, (cc) => SH.tradingFloor(cc, 0.4, false, 60), day); },
      animate(c, v, t) {
        if (t >= 1.25) return;
        at2x(c, (cc) => {
          wave.forEach(({ g, a, h }) => {
            K.crt(cc, g.x, g.y, g.w, h, t, { mode: 'roll', at: a, dur: 0.36, band: 12 });
            K.ping(cc, t, { at: a, flare: { x: g.x, y: g.y, w: g.w, h, col: P.bone, a: 0.18, dur: 0.08 } });
          });
          // the colleagues and heads in front of the screens go back over the wave
          SH.floorFront(cc, 0.4, false, 60, wave.filter((q) => t >= q.a && t < q.a + 0.36).map((q) => q.g));
        }, day);
      }
    }];
  }

  function story(o) { const g = o && o.game; return g && g.mode && g.mode.S; }
  B.Scenes.weekend = function (o) {
    const day = o.day || 0, week = Math.floor(day / 5) + 1, w = wallet(o), home = homeOf(w), S = story(o);
    const pulled = !!(S && S.f && S.f.pulledPlug);
    const story$ = day === 44 && pulled ? '3:17 AM. FOR THE FIRST TIME IN YEARS, NOTHING IS TRADING.' : WEEKENDS[day];
    const pet = w && w.pet ? `${w.pet.kind}-${w.pet.sex}-${w.vet === 'neglected' ? 'n' : 'c'}` : '';
    const key = `${week}:${home.id}:${w ? Math.min(3, w.lateWeeks | 0) : 0}:${pulled ? 'p' : ''}:${pet}`;
    const sat = w && w.weeks && w.weeks[week] ? `WEEK ${week} · ${home.name.toUpperCase()} · PAYSLIP ${B.fmt.money(w.weeks[week].net, true)}` : `WEEK ${week} · SATURDAY · ${home.name.toUpperCase()}`;
    const satId = `weekend:${key}:sat`;
    const K = B.MotionKit, late = w ? w.lateWeeks | 0 : 0, fig = home.id === 'couch' || late > 0, pulled44 = day === 44 && pulled;
    // Sunday and the hold carry what Sunday changes: the lit floor phone (no figure) or the dead laptop (day 44, plug pulled)
    const lap = laptopRect(home), SP = phoneSpill(), spillOn = [].concat(SP.spill, [SP.screen, SP.bar]);
    const sunFront = (c, t) => {
      if (w && w.pet && PET[w.pet.kind] && t >= 0.40 && t < 1.00) breathDraw(c, w);
      if (pulled44) return;
      if (fig) {
        const g = faceGlow(home);
        K.flicker(c, g.x, g.y, g.w, g.h, 'weekend:sun:face', t, { spans: [[0.45, 0.55], [0.80, 0.90], [1.15, 1.30]], col: late > 0 ? P.crimson : P.screenGlow, a: 0.40 });
        return;
      }
      const flare = { x: 216, y: 261, w: 27, h: 12, col: P.bone, a: 0.15, dur: 0.08 };
      if (day === 39) {
        // the phones ring all night: the screen and bar show while the badge phase is on (and end lit); the spill stays
        K.ping(c, t, { at: 1.15, on: SP.spill, flare });
        const bl = (r, from) => { if (t >= from) K.blink(c, r.x, r.y, r.w, r.h, t, { on: r.col, off: null, period: 0.5, duty: 0.6, end: 1.8 }); };
        bl(SP.screen, 1.15); bl(SP.bar, 1.23);
      } else {
        K.ping(c, t, { at: 1.15, on: SP.spill.concat([SP.screen]), flare });
        K.ping(c, t, { at: 1.23, on: [SP.bar] });
      }
    };
    const holdFront = (c, t) => {
      if (pulled44) X.rect(c, lap.x, lap.y, lap.w, lap.h, P.screenD);
      else if (!fig) K.ping(c, t, { at: -1, on: spillOn });
    };
    const dim03 = (c) => { c.save(); c.globalAlpha = 0.3; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); };
    const sunCues = pulled44 ? [{ at: 1.15, sfx: 'click' }] : day === 39 ? [{ at: 1.15, sfx: 'ring' }] : fig ? [] : [{ at: 1.15, sfx: 'news' }];
    const sunBeat = R.beat('weekend', `${key}:sun`, 1.8, (c) => sundayShot(c, day, home, w), story$ || 'SUNDAY NIGHT. THE ALARM IS SET FOR 5:58.', { sfx: 'apartment', informative: !!story$ });
    const holdBeat = R.beat('weekend', `${key}:hold`, 0.8, (c) => { apartmentShot(c, day, home, true, w); c.save(); c.globalAlpha = 0.3; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); }, '', {});
    const beats = [
      B.Motion.layered(R.beat('weekend', `${key}:sat`, SAT_DUR, null, sat, {
        sfx: 'apartment', transition: 'fade', informative: !story$, cache: false,
        cues: [{ at: 1.0, sfx: 'news' }],
        camera: B.MotionKit.settle(-CAM_Y, B.Motion.ease.inOut),
        layers: saturdayLayers(day, home, w, satId)
      })),
      B.Motion.layered(Object.assign({}, sunBeat, {
        camera: B.MotionKit.settle(-6, B.Motion.ease.inOut), cues: sunCues,
        layers: saturdayLayers(day, home, w, satId, {
          night: true, space: sundaySpace, t0: 2.4, seed: satId + ':wx', blink: true, dur: 1.8, front: sunFront, top: SUN_EDGE,
          furniture: pulled44 ? (c, t) => K.crt(c, lap.x, lap.y, lap.w, lap.h, t, { mode: 'off', at: 1.15, bg: P.screenD }) : null
        })
      }))
    ];
    // One weekend gets a second room: the whip's phones the night before the vote.
    if (day === 39 && B.DecisionArt) {
      const whip = R.beat('weekend', `${key}:whip`, 1.6, (c) => B.DecisionArt.room(c, 'c8', day), 'THE WHIP HAS 214. HE NEEDS 218.', { sfx: 'room' });
      const wl = B.DecisionArt.roomLayers && B.DecisionArt.roomLayers('c8', day, false, null, 'whip');
      beats.push(wl ? B.Motion.layered(Object.assign({}, whip, wl)) : whip);
    }
    // the hold: the night room under a 0.3 dim, no camera; the colon and the weather continue and Sunday's change stays
    beats.push(B.Motion.layered(Object.assign({}, holdBeat, {
      camera: null,
      layers: saturdayLayers(day, home, w, satId, { night: true, flat: true, t0: day === 39 ? 5.8 : 4.2, seed: satId + ':wx', blink: true, dur: 0.8, front: holdFront, top: dim03 })
    })));
    if (day === 44) {
      const f317 = R.beat('weekend', `${key}:317`, 1.6, (c) => (pulled && B.DecisionArt ? B.DecisionArt.room(c, 'c10', day, true, S) : at2x(c, (cc) => SH.tradingFloor(cc, 0.4, false, 60), day)),
        pulled ? 'THE FLOOR IS DARK. SO ARE THE RACKS.' : 'THE FLOOR IS DARK. THE RACKS ARE NOT.', {});
      const rl = pulled && B.DecisionArt && B.DecisionArt.roomLayers && B.DecisionArt.roomLayers('c10', day, true, S, '317');
      if (pulled) beats.push(rl ? B.Motion.layered(Object.assign({}, f317, rl)) : f317);
      else beats.push(B.Motion.layered(Object.assign({}, f317, { camera: null, cues: [{ at: 0.30, sfx: 'office' }], layers: floor317Layers(day) })));
    }
    return beats;
  };

  B.Storyboard = { bellSilent, PET, petRows, SHEET, DOCS, ANOMALY_DAYS, row, variant, lit, actTurns, HOMES, WEEKENDS, insertShot, actCard, DOC_DRAW, deskWithDoc, shotFrame, skylineShot, racksShot, at2x, tableau, tableauSpace, finePass, bellSwing, apartmentShot, windowRect, homeOf, SAT_DUR, sundayShot, sundaySpace, SUN_EDGE, phoneSpill, faceGlow, laptopRect, saturdayLayers };

  // Session 1 opens in the lobby: the counter climbs to 41, the car arrives, the doors part.
  // Built on the same cached parts as news:0:detail and :hold (`elevBase`: wall, car, top in the flat picture's own order), so at the cut the two
  // pictures are the same room: `room` (those parts, then the counter, the car's flicker, the light spill and the doors animated on it), `frame`, `marks`.
  // (The pilot drew a separate car layer at depth 0.75 and a lobby layer with the doorway left open; the car's glow, which reaches past the doorway onto
  // the wall in the flat picture, and the car's bottom row could not be reproduced that way, so the room is one layer and the car has no parallax.)
  function elevatorOpening(day, r, date) {
    const E = (name, open, floor) => (c) => at2x(c, (cc) => SH.elevator(cc, open, floor, name), 0);
    const M = B.Motion, rr = { shot: 'elevator' };
    const slideAt = (t) => Math.round(0.6 * M.ease.inOut((t - 1.25) / 0.9) * 62);
    return M.layered({
      id: `news:${day}:establish`, view: V, dur: 2.4, line: date, cache: false, sfx: 'apartment', informative: false, transition: 'fade',
      cues: [{ at: 1.05, sfx: 'elevator' }],
      camera: B.MotionKit.settle(8, M.ease.inOut, { step2: true }),
      layers: [
        {
          id: 'room', depth: 1, draw: elevBase(0),
          animate(c, v, t) {
            const floor = 38 + Math.min(3, Math.floor(t / 0.35)), slide = slideAt(t);
            at2x(c, (cc) => {
              // the car's light stutters twice through the gap (over the car, under the doors)
              if ((t >= 1.45 && t < 1.53) || (t >= 1.62 && t < 1.70)) { cc.save(); cc.globalAlpha = 0.2; X.rect(cc, 96, 24, 128, 108, P.ink); cc.restore(); }
              SH.elevator(cc, 0, floor, 'number');
              if (floor < 41) SH.elevator(cc, 0, floor, 'arrow');
              if (slide >= 1) {
                for (let k = 0; k < 8; k++) {
                  cc.save(); cc.globalAlpha = k < 4 ? 0.2 : 0.1;
                  X.rect(cc, 160 - (2 + slide) - k, 133 + k, 2 * (2 + slide + k), 1, P.bone);
                  cc.restore();
                }
              }
              SH.elevator(cc, 0.6 * M.ease.inOut((t - 1.25) / 0.9), 41, 'doors');
            }, 0);
          }
        },
        { id: 'frame', depth: 1, draw(c) { at2x(c, (cc) => SH.elevator(cc, 0, 41, 'frame'), 0); finePass(c, day, rr, 'establish', 'world'); } },
        marksLayer(day, rr, false, 'frame')
      ]
    });
  }

  // ---- Act cards and document close-ups as layers (stage 3, batch 4) ----
  // The act card: the wash, ACT II and the cursor's colour are cached; the act's name types on in 4x letters in an animate,
  // left-aligned at the string's final left edge so no letter moves. At the end it is today's card exactly.
  function actLayers(day) {
    const K = B.MotionKit, c = R.colors(B.StoryData.actIndex(day) + 1), name = actName(day), n = name.length;
    // 16 letters a second for every real act name (7 to 9 letters); a label too long to finish by 1.15 s types faster, so the beat still ends on the full card
    const left = 4 * ((80 - (X.textWidth(name) - 1) / 2) | 0), top = 4 * Math.round(150 / 4), cps = Math.max(16, n / 0.70), done = 0.45 + n / cps;
    return [{
      id: 'card', depth: 1, draw(g) { actCard(g, day, { noName: true }); },
      animate(g, v, t) {
        if (!n) return;
        K.typeOn(g, name, left, top, t, { at: 0.45, cps, col: P.bone, shadow: P.ink, scale: 4, align: 'left', cursor: t < done + 0.5 ? { col: c.signal } : null });
      }
    }];
  }
  // The ticket's order book at time t: bar i steps three times, 12 px each (36 px in all), from 0.40 + 0.06 i in 0.12 s steps (3 = the start, 0 = the art).
  const bookStep = (i, t) => 3 - Math.max(0, Math.min(3, Math.floor((t - (0.40 + 0.06 * i)) / 0.12) + 1));
  // The documents' moving marks, in the screen pixels of the art. Each is the same rectangles the flat document draws, drawn on.
  function docLayers(day, r, dur) {
    const K = B.MotionKit, doc = DOC_DRAW[r.doc] ? r.doc : 'memo', value = r.arg, D = DOC_DRAW[doc], cc = R.colors(B.StoryData.actIndex(day) + 1);
    const grain = (g) => X.scanlines(g, 0, 0, V.w, V.h, P.ink, 0.05);
    // the top cached layer: the full-screen grain, then the world marks a dark floor or the racks add (nothing for an insert)
    const top = (id, part) => ({ id, depth: 1, draw(g) { if (part) D(g, day, value, cc, { part }); grain(g); finePass(g, day, r, 'detail'); } });
    const camera = null;
    if (doc === 'memo') {
      return {
        camera, layers: [
          { id: 'paper', depth: 1, draw(g) { D(g, day, value, cc, { part: 'paper' }); } },
          { id: 'band', depth: 1, draw() {}, animate(g, v, t) { K.marker(g, [DOC_GEOM.memo.band], t, { at: 0.35, dur: 0.50, col: cc.wash, fps: 20 }); } },
          top('ink', 'ink')
        ]
      };
    }
    if (doc === 'footnote') {
      const ly = footnoteLine(day);
      const segs = [{ x: 84, y: ly - 7, w: 290, h: 2 }, { x: 374, y: ly - 5, w: 2, h: 12 }, { x: 84, y: ly + 7, w: 290, h: 2, dir: -1 }, { x: 82, y: ly - 5, w: 2, h: 12, dir: -1 }, { x: 376, y: ly, w: 60, h: 2 }];
      return {
        camera, layers: [
          { id: 'doc', depth: 1, draw(g) { D(g, day, value, cc, { noMarker: true }); }, animate(g, v, t) { K.marker(g, segs, t, { at: 0.35, dur: 0.80, col: P.crimson, fps: 20 }); } },
          top('grain')
        ]
      };
    }
    if (doc === 'rating') {
      return {
        camera, cues: [{ at: 1.30, sfx: 'click' }], layers: [
          {
            id: 'doc', depth: 1, draw(g) { D(g, day, value, cc); },
            animate(g, v, t) {
              // the stamp and the value stay under the paper-coloured cover (a flat fill) until the third frame of the stamp
              // (the value is 3x text and can run past the stamp's edges, so the cover is the paper's flat interior across, x 124 to 516)
              if (t < 1.30 + 2 * 0.04) X.rect(g, 124, 64, 392, 110, P.bone);
              K.stamp(g, 150, 64, 340, 110, t, { at: 1.30, col: cc.signal, frame: 0.04, grow: [16, 6], style: 'none' });
            }
          },
          top('grain')
        ]
      };
    }
    if (doc === 'post') {
      return {
        camera: K.rise(32, dur, 0.30, 0.80), layers: [
          { id: 'city', depth: 0, draw(g) { D(g, day, value, cc, { part: 'city' }); } },
          { id: 'phone', depth: 1, draw(g) { D(g, day, value, cc, { part: 'phone', noFlag: true }); }, animate(g, v, t) { K.blink(g, 216, 70, 10, 10, t, { on: P.crimson, period: 1.0, duty: 0.5, end: dur }); } },
          // the phone's own scanlines lie over its TRENDING light, as in the flat picture, so they move with the phone in a layer above it
          { id: 'glass', depth: 1, draw(g) { D(g, day, value, cc, { part: 'glass' }); } },
          { id: 'grain', depth: 0, draw(g) { grain(g); finePass(g, day, r, 'detail'); } }
        ]
      };
    }
    if (doc === 'chart') {
      const segs = [{ x: 362, y: 70, w: 60, h: 2 }, { x: 422, y: 72, w: 2, h: 94 }, { x: 362, y: 166, w: 60, h: 2, dir: -1 }, { x: 360, y: 72, w: 2, h: 94, dir: -1 }];
      return {
        camera, layers: [
          { id: 'doc', depth: 1, draw(g) { D(g, day, value, cc, { noMarker: true }); }, animate(g, v, t) { K.marker(g, segs, t, { at: 0.40, dur: 0.55, col: P.crimson, fps: 20 }); } },
          top('grain')
        ]
      };
    }
    if (doc === 'ticket') {
      return {
        camera, layers: [
          { id: 'screen', depth: 1, draw(g) { D(g, day, value, cc, { part: 'screen' }); } },
          {
            id: 'book', depth: 1, draw() {},
            animate(g, v, t) {
              for (let i = 0; i < 5; i++) {
                const s = bookStep(i, t), bid = DOC_GEOM.ticket.bid(i, s), ask = DOC_GEOM.ticket.ask(i, s);
                X.rect(g, bid.x, bid.y, bid.w, bid.h, i ? P.screenGlow : P.jadeD);
                X.rect(g, ask.x, ask.y, ask.w, ask.h, P.crimsonD);
              }
            }
          },
          top('glass', 'glass')
        ]
      };
    }
    if (doc === 'vote') {
      const VG = DOC_GEOM.vote, yea = [], nay = [];
      for (let q = 0; q < VG.rows; q++) {
        yea.push([]); nay.push([]);
        for (let k = 0; k < VG.cols; k++) {
          if (VG.yeaLit(q, k)) yea[q].push(VG.yea(q, k));
          if (VG.nayLit(q, k)) nay[q].push(VG.nay(q, k));
        }
      }
      return {
        camera, layers: [
          {
            id: 'doc', depth: 1, draw(g) { D(g, day, value, cc, { unlit: true }); },
            animate(g, v, t) {
              for (let q = 0; q < 6; q++) {
                K.lamps(g, yea[q], t, { at: 0.40 + 0.09 * q, step: 0, on: P.jadeD });
                K.lamps(g, nay[q], t, { at: 0.40 + 0.09 * q, step: 0, on: P.crimsonD });
              }
            }
          },
          top('grain')
        ]
      };
    }
    // voicemail: the twelve bars the flat art lights, in X.rect's own truncation
    const cells = [];
    for (let i = 0; i < 12; i++) { const b = DOC_GEOM.voicemail.bar(i, day); cells.push({ x: b.x | 0, y: b.y | 0, w: b.w, h: b.h }); }
    return {
      camera, layers: [
        { id: 'doc', depth: 1, draw(g) { D(g, day, value, cc, { played: 0 }); }, animate(g, v, t) { K.lamps(g, cells, t, { at: 0.40, step: 0.06, on: P.phosphor }); } },
        top('grain')
      ]
    };
  }

  // ---- The establishes of the documents' places as layers (stage 3, batch 4, part 2) ----
  // The art is drawn through framed(), so every moving mark is drawn through framed() too, with noBack, in the same transform.
  // The places' tilt, 6 px: SETTLE for native 640x360 art, SETTLE2 for art drawn at 2x (see B.MotionKit.settle: steps of 2 px).
  const SETTLE = () => B.MotionKit.settle(6, B.Motion.ease.inOut);
  const SETTLE2 = () => B.MotionKit.settle(6, B.Motion.ease.inOut, { step2: true });
  // The marks layer on top (depth 0, never moved by the camera): the shot's fine marks, and on an establish the anomaly tear. part 'frame': the corner brackets only
  // (the shot's own marks are drawn by another layer); no part: both.
  const marksLayer = (day, r, detail, part) => ({ id: 'marks', depth: 0, draw(c) { finePass(c, day, r, detail ? 'detail' : 'establish', part); if (!detail) tell(c, day); } });
  // The 0.18 ink dim a hold lies under.
  const holdDim = (c) => { c.save(); c.globalAlpha = 0.18; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); };
  const dimLayer = () => ({ id: 'dim', depth: 0, draw: holdDim });
  // The desk with the day's paper (memo and footnote). The establish slides the paper up 16 art units onto the desk; the hold has it at rest.
  // Both blink the TRADE monitor's standby LED (a 5x5 flat-bezel cover over the 3x3 light while it is off, nothing while it is on).
  function deskLayers(day, r, title, hold, dur) {
    const K = B.MotionKit, M = B.Motion, Z = r.doc === 'footnote' ? 1.5 : 0;
    const led = (c, t) => deskSpace(c, day, Z, (g) => K.blink(g, 175, 118, 5, 5, t, { on: null, off: P.plastic, period: 1.0, duty: 0.5, end: dur }));
    if (hold) {
      return [
        { id: 'desk', depth: 1, draw(c) { deskWithDoc(c, day, r, Z); }, animate(c, v, t) { led(c, t); } },
        dimLayer()
      ];
    }
    return [
      {
        id: 'desk', depth: 1, draw(c) { framed(c, day, r, title, { draw: (cc) => deskWithDoc(cc, day, r, Z, { part: 'desk' }) }); },
        animate(c, v, t) {
          const dy = Math.round(16 * (1 - M.ease.out(K.span(t, 0.35, 0.75))));
          framed(c, day, r, title, { noBack: true, draw: (cc) => { led(cc, t); deskWithDoc(cc, day, r, Z, { part: 'paper', dy }); } });
        }
      },
      marksLayer(day, r, false)
    ];
  }
  // The voicemail on the couch arm: the room is cached with the phone's screen dark; it lights at 0.45 s with one bone flare.
  function voicemailRoomLayers(day, r, title) {
    const K = B.MotionKit;
    return [
      { id: 'room', depth: 1, draw(c) { framed(c, day, r, title, { draw: (cc) => at2x(cc, (c2) => SH.apartment(c2, 0.15, { noScreen: true }), day) }); },
        animate(c, v, t) {
          framed(c, day, r, title, { noBack: true, draw: (cc) => at2x(cc, (c2) => K.ping(c2, t, { at: 0.45, off: [], on: [{ x: 192, y: 113, w: 8, h: 13, col: P.screenGlow }, { x: 194, y: 115, w: 2, h: 2, col: P.sky }], flare: { x: 186, y: 106, w: 20, h: 26, col: P.bone, a: 0.15, dur: 0.08 } }), day) });
        } },
      marksLayer(day, r, false)
    ];
  }
  // The vote and hearing rooms borrowed by the floor-tally establishes (sessions 11, 38 and the bill passed on 41): the decision room's own layers, then the marks.
  function voteRoomLayers(day, r) {
    const D = B.DecisionArt, L = D && D.roomLayers && D.roomLayers(day > 27 ? 'c8' : 'c3', day, true, { f: { billPassed: /PASSES/.test(r.arg || '') } }, 'establish');
    return L ? L.layers.concat(marksLayer(day, r, false)) : null;
  }
  // The post establish is the phone handoff's recipe: the room still, a small dark device rising into it, waking on the one post.
  function postRoomLayers(day, r, title) {
    const K = B.MotionKit, sb = R.storyboard(day), feed1 = [{ source: 'SQWAK', title: r.arg || title, kind: 'chirp' }];
    const { sx, sy, sw, sh } = R.phoneGeom(feed1.length, false), mm = R.lockMinute(day);
    return [
      { id: 'room', depth: 0, draw(c) { framed(c, day, r, title, { draw: (cc) => R.phoneFrame(cc, sb, feed1, false, { part: 'room' }) }); } },
      {
        id: 'device', depth: 1, draw(c) { framed(c, day, r, title, { noBack: true, draw: (cc) => R.phoneFrame(cc, sb, feed1, false, { part: 'device' }) }); },
        animate(c, v, t) {
          framed(c, day, r, title, {
            noBack: true,
            draw: (cc) => {
              // asleep until 1.00 s: the cached post is covered by the dark screen (one unit larger, so a zoom's partial pixels are covered too) and 6:MM shows at 2x; then one bone flare
              K.ping(cc, t, { at: 1.00, off: [{ x: sx - 1, y: sy - 1, w: sw + 2, h: sh + 2, col: P.screenD }], on: [], flare: { x: sx, y: sy, w: sw, h: sh, col: P.bone, a: 0.15, dur: 0.08 } });
              if (t < 1.00) { cc.save(); cc.scale(2, 2); X.textShadow(cc, '6:' + mm, 160, 39, P.grey2, P.ink, { align: 'center' }); cc.restore(); }
            }
          });
        }
      },
      marksLayer(day, r, false)
    ];
  }
  // The chart establish is the office wide: a refresh band down each live monitor in turn (the monitors the office wide of the morning rolls).
  function chartRoomLayers(day, r, title) {
    const K = B.MotionKit, G = R.officeGeom(day);
    return [
      { id: 'office', depth: 1, draw(c) { framed(c, day, r, title, { draw: (cc) => R.officeFrame(cc, day, false) }); },
        animate(c, v, t) {
          framed(c, day, r, title, { noBack: true, draw: (cc) => G.monitors.forEach((m) => { if (!m.off) K.crt(cc, m.screen.x, m.screen.y, m.screen.w, m.screen.h, t, { mode: 'roll', at: 0.35 + 0.12 * m.i, dur: 0.36, band: 12 }); }) });
        } },
      marksLayer(day, r, false)
    ];
  }

  // ---- The places as layers (stage 3, batch 5) ----
  // The placeFrame places split at the wall: `back` (skyline, wall, cells, floor), one animate-only layer for what passes behind the monitor and the
  // commuter (the train, the road), then `front` (the wire monitor, the commuter, the camera's props, the scanlines and the shot's world marks);
  // the corner brackets and the anomaly tear sit on `marks`, which the tilt never moves. Establishes draw every layer through framed(); the
  // details are unframed. placeFrame's own coordinates are 640x360 (no at2x).
  const placeArt = (c, day, r, title, detail, o, fn) => (detail ? fn(c) : framed(c, day, r, title, Object.assign({ draw: fn }, o)));
  function placeSandwich(day, r, title, detail, mid) {
    const sb = R.storyboard(day), ph = detail ? 'detail' : 'establish', art = (c, o, fn) => placeArt(c, day, r, title, detail, o, fn);
    return [
      { id: 'back', depth: 1, draw(c) { art(c, null, (cc) => R.placeFrame(cc, sb, title, detail, { part: 'back', noSpeckle: mid.noSpeckle })); } },
      { id: mid.id, depth: 1, draw() {}, animate(c, v, t) { art(c, { noBack: true }, (cc) => mid.paint(cc, t)); } },
      { id: 'front', depth: 1, draw(c) { art(c, { noBack: true }, (cc) => R.placeFrame(cc, sb, title, detail, { part: 'front' })); finePass(c, day, r, ph, 'world'); }, animate: mid.refresh ? (c, v, t) => mid.refresh(c, t) : undefined },
      marksLayer(day, r, detail, 'frame')
    ];
  }
  // Shot 1: a lit train sweeps past behind the seven window cells without stopping. One train of 14 windows, 28 px apart, moving at 330 px/s (a
  // frame's step is 11 px at 30 fps and 5.5 px at 60 fps, always under half the spacing, so it never reads as crawling backwards), cut into the
  // cells by one clipped K.passing per cell and row: cell i is timed 94 i / 330 s after the first, so the seven pieces are one train.
  // The 14 windows take 3.0 s to clear the last cell, so the train starts at -1.48 (clears at 1.52) on the establish, -0.88 (2.12) on the detail.
  function trainPaint(day, detail) {
    const K = B.MotionKit, A = detail ? -0.88 : -1.48;
    return (c, t) => {
      for (let i = 0; i < 7; i++) for (const y of [58, 68]) K.passing(c, 24 + 94 * i, y, 64, 60, `news:${day}:train`, t, { kind: 'train', at: A + (94 * i) / 330, speed: 330, gap: 28 });
    };
  }
  // Shot 2: snow in place of the still speckle, and cars' lights on the road from 0.30 s, one every 0.45 s (background life; the key movement is the wire monitor refreshing).
  function roadPaint(day) {
    const K = B.MotionKit;
    return (c, t) => {
      K.weather(c, 0, 12, 640, 220, day, `news:${day}:snow`, t, { max: 40 });
      // background life, twice the size: headlights 8x4 px, tail lights 4x4 px, on the road (screen y 256 to 259, below the amberD kerb at y 249); 110 units a second is the old 220 px
      c.save(); c.scale(2, 2);
      K.passing(c, 0, 127, 320, 4, `news:${day}:cars`, t, { kind: 'car', at: 0.30, every: 0.45, speed: 110, dir: 1 });
      c.restore();
    };
  }
  // The layers, camera and cues of a place beat (establish or detail), or null when the place has none (the desk establish is deskWithDoc, batch 4).
  function placeLayers(day, r, title, detail) {
    const sb = R.storyboard(day), p = sb.place, cue = (sfx) => (detail ? {} : { cues: [{ at: 0.30, sfx }] });
    if (p === 'subway' || p === 'platform') return Object.assign({ camera: SETTLE(), layers: placeSandwich(day, r, title, detail, { id: 'train', paint: trainPaint(day, detail) }) }, cue('transit'));
    if (p === 'street') return Object.assign({ camera: SETTLE(), layers: placeSandwich(day, r, title, detail, { id: 'road', noSpeckle: true, paint: roadPaint(day), refresh: monitorRefresh(day, r, title, detail) }) }, cue('street'));
    if (detail) return { camera: SETTLE(), layers: monitorLayers(day, r, title, true) };
    if (p === 'kitchen' || p === 'breakroom' || p === 'rideshare') return { camera: SETTLE(), cues: [{ at: 0.30, sfx: p === 'rideshare' ? 'street' : 'kitchen' }], layers: monitorLayers(day, r, title, false) };
    if (p === 'lobby' || p === 'elevator') return { camera: SETTLE2(), cues: [{ at: 0.35, sfx: 'elevator' }], layers: elevatorPlaceLayers(day, r, title) };
    if (p === 'apartment') return { camera: SETTLE2(), layers: tvRoomLayers(day, r, title, 0.5, [0.45, 0.95]) };
    return null;
  }

  // Shot 3: the wire monitor refreshes: a band rolls down the screen (0.40 to 0.76 s) and the signal band flashes as the roll reaches it. No split:
  // nothing is drawn over the monitor in any comp. One screen event (roll and flare).
  // The wire monitor's refresh: a roll down the screen at 0.40 s (0.36 s long) and one flare on the signal band as the roll reaches it. Returns the animate
  // for the layer that draws the monitor (drawn through placeArt in the same transform as the art, noBack).
  function monitorRefresh(day, r, title, detail) {
    const K = B.MotionKit, sb = R.storyboard(day), G = R.monitorGeom(sb, detail);
    const tf = 0.40 + 0.36 * (G.h - 42) / (G.h + 6), band = { x: G.x + 3, y: G.y + G.h - 48, w: G.w - 6, h: 45 };
    return (c, t) => {
      if (t >= tf + 0.08 && t >= 0.76) return;
      placeArt(c, day, r, title, detail, { noBack: true }, (cc) => {
        K.crt(cc, G.x, G.y, G.w, G.h, t, { mode: 'roll', at: 0.40, dur: 0.36 });
        K.ping(cc, t, { at: tf, off: [], on: [], flare: { x: band.x, y: band.y, w: band.w, h: band.h, col: P.bone, a: 0.15, dur: 0.08 } });
      });
    };
  }
  function monitorLayers(day, r, title, detail) {
    const sb = R.storyboard(day), ph = detail ? 'detail' : 'establish', refresh = monitorRefresh(day, r, title, detail);
    return [
      {
        id: 'place', depth: 1,
        draw(c) { placeArt(c, day, r, title, detail, null, (cc) => R.placeFrame(cc, sb, title, detail)); finePass(c, day, r, ph, 'world'); },
        animate(c, v, t) { refresh(c, t); }
      },
      marksLayer(day, r, detail, 'frame')
    ];
  }

  // Shot 4: the TV in the dark room cuts to a bar graphic for 0.6 s (the span `cut`) while the wall glow steps darker, then back.
  function tvRoomLayers(day, r, title, glow, cut) {
    const K = B.MotionKit, H = r.arg || title, HK = [20, 28, 12];
    return [
      {
        id: 'room', depth: 1,
        draw(c) { framed(c, day, r, title, { draw: (cc) => at2x(cc, (c2) => { SH.apartment(c2, glow); SH.tvSet(c2, 40, 50, 104, 68, H, act(day), 0); }, day) }); finePass(c, day, r, 'establish', 'world'); },
        animate(c, v, t) {
          if (t < cut[0] || t >= cut[1]) return;
          framed(c, day, r, title, {
            noBack: true,
            draw: (cc) => at2x(cc, (c2) => {
              K.flicker(c2, 0, 73, 184, 47, `news:${day}:tv`, t, { spans: [cut], col: P.ink, a: 0.15 });
              X.rect(c2, 42, 52, 100, 48, P.screen);
              for (let k = 0; k < 3; k++) X.rect(c2, 56 + 26 * k, 92 - HK[k], 14, HK[k], k === 2 ? P.crimson : P.phosphor);
              X.rect(c2, 50, 92, 84, 1, P.screenGlow);
              X.scanlines(c2, 42, 52, 100, 48, P.ink, 0.2);
            }, day)
          });
        }
      },
      marksLayer(day, r, false, 'frame')
    ];
  }

  // Shot 5: the lobby elevator. The pilot's parts: car, lobby (doorway unpainted), number in the room layer; the doors animated on it; the frame above.
  const elevE = (day, part, open, floor) => (c) => at2x(c, (cc) => SH.elevator(cc, open, floor, part), day);
  // The lobby wall, the lit car over its doorway and the indicator housing, number and call button, in the flat picture's own order, so the
  // cached room is today's pixels (the car's glow reaches past the doorway onto the wall).
  const elevBase = (day) => (c) => { elevE(day, 'wall')(c); elevE(day, 'car')(c); elevE(day, 'top', 0, 41)(c); };
  function elevatorPlaceLayers(day, r, title) {
    const K = B.MotionKit, M = B.Motion, O = 0.15 + (day % 5) * 0.12;
    return [
      {
        id: 'room', depth: 1, draw(c) { framed(c, day, r, title, { draw: elevBase(day) }); },
        animate(c, v, t) {
          const open = O * M.ease.inOut(K.span(t, 0.35, 1.15));
          framed(c, day, r, title, {
            noBack: true,
            draw: (cc) => at2x(cc, (c2) => {
              K.flicker(c2, 96, 24, 128, 108, `news:${day}:car`, t, { spans: [[1.30, 1.36]], col: P.ink, a: 0.2 });
              SH.elevator(c2, open, 41, 'doors');
            }, day)
          });
        }
      },
      { id: 'frame', depth: 1, draw(c) { framed(c, day, r, title, { noBack: true, draw: elevE(day, 'frame', 0, 41) }); finePass(c, day, r, 'establish', 'world'); } },
      marksLayer(day, r, false, 'frame')
    ];
  }
  // Session 1's detail and hold: the doors carry on from the opening (0.6 open): to fully open on the detail, back to 0.6 on the hold.
  function elevatorDoorsLayers(day, r, hold) {
    const K = B.MotionKit, M = B.Motion;
    return [
      {
        id: 'room', depth: 1, draw: elevBase(day),
        animate(c, v, t) { elevE(day, 'doors', hold ? 1.0 - 0.4 * M.ease.inOut(K.span(t, 0.20, 0.90)) : 0.6 + 0.4 * M.ease.inOut(K.span(t, 0.35, 1.05)), 41)(c); }
      },
      hold ? { id: 'frame', depth: 1, draw: elevE(day, 'frame', 0, 41) } : { id: 'frame', depth: 1, draw(c) { elevE(day, 'frame', 0, 41)(c); finePass(c, day, r, 'detail', 'world'); } },
      hold ? dimLayer() : marksLayer(day, r, true, 'frame')
    ];
  }

  // Shots 6 and 7: the trading floor. One layer `floor` (the art, then its animate on top in the same transform) and `marks` (the corner brackets
  // and the anomaly tear, never moved by the tilt) or, on a hold, `dim` (the 0.18 ink rect). Lit: a refresh wave crosses the near-row screens, left to
  // right (K.crt bands, overlays on the dither, never a cover). Dark: the biggest near screen stutters in hard steps and the others flicker
  // lightly; every flicker ends lit, so the final frame is the art. Coordinates are 320x180 art units, inside framed()'s zoom on the establish.
  const FLOOR_ZOOM = (day, r, detail) => (r.shot === 'floor' ? (detail ? 0.7 : 0.15) : 0.45 + (day % 4) * 0.08);
  function floorLayers(day, r, title, o) {
    const K = B.MotionKit, hold = o.phase === 'hold', detail = o.phase === 'detail', dark = o.dark, Z = o.zoom;
    const S = SH.floorGeom(Z, day), dur = o.dur;
    // the screens the wave crosses: not under the foreground colleagues (zoom > 0.12: x 26 to 286 only), not the late floor's dead ones
    // (the authored floor's dark screens are dead glass on any day, so it skips every unlit one)
    const wave = dark ? [] : S.filter((g) => ((SH.floorArt() ? Z < 0.3 : Z <= 0.12) || (g.x >= 26 && g.x + g.w <= 286)) && !((day >= 45 || SH.floorArt()) && !g.on));
    let key = null;
    if (dark) { let best = 1e9; S.forEach((g) => { const d = Math.abs(g.x + g.w / 2 - 160); if (g.r === 3 && d < best) { best = d; key = g; } }); }
    // the dark floor's lesser flickers skip the screens under the foreground colleagues too (zoom > 0.12: x 26 to 286 only), as the wave does
    const rest = dark ? S.filter((g) => g !== key && ((SH.floorArt() ? Z < 0.3 : Z <= 0.12) || (g.x >= 26 && g.x + g.w <= 286))) : [];
    const art = (c, fn, noBack) => (detail || hold ? at2x(c, fn, day) : framed(c, day, r, title, { noBack, draw: (cc) => at2x(cc, fn, day) }));
    const paint = (c2) => { SH.tradingFloor(c2, Z, !dark, day); if (dark && !detail && !SH.floorArt()) { c2.save(); c2.globalAlpha = 0.42; X.rect(c2, 0, 0, 320, 180, P.ink); c2.restore(); } };
    return [
      {
        id: 'floor', depth: 1,
        draw(c) { art(c, paint, false); if (!hold) finePass(c, day, r, detail ? 'detail' : 'establish', 'world'); },
        animate(c, v, t) {
          if (t < (dark ? 0.10 : 0.35) || t >= (dark ? dur - 0.10 : 1.25)) return;
          art(c, (c2) => {
            if (dark) {
              if (!hold) K.flicker(c2, key.x, key.y, key.w, key.h, `news:${day}:k`, t, { spans: [[0.40, 0.46], [0.52, 0.70], [0.78, 0.82], [0.95, 1.25]], col: P.ink, a: 0.5 });
              else K.flicker(c2, key.x, key.y, key.w, key.h, `news:${day}:k`, t, { from: 0.10, to: 1.00, rate: 12, chance: 0.15, col: P.ink, a: 0.5 });
              rest.forEach((g) => K.flicker(c2, g.x, g.y, g.w, g.h, `news:${day}:${g.r}:${g.i}`, t, { from: 0.30, to: dur - 0.10, rate: 12, chance: 0.07, col: P.ink, a: 0.3 }));
            } else {
              // a band 12 art units tall rolls down each screen, which flares bone (0.18, 0.08 s) as its band starts
              wave.forEach((g) => {
                const at = 0.35 + 0.5 * Math.max(0, Math.min(1, (g.x + g.w / 2) / 320));
                K.crt(c2, g.x, g.y, g.w, g.h, t, { mode: 'roll', at, dur: 0.36, band: 12 });
                K.ping(c2, t, { at, flare: { x: g.x, y: g.y, w: g.w, h: g.h, col: P.bone, a: 0.18, dur: 0.08 } });
              });
            }
            // what stands in front of the screens (heads, nearer rows, the colleagues) goes back over what was painted on them
            SH.floorFront(c2, Z, !dark, day, dark ? [key].concat(rest).filter(Boolean) : wave.filter((g) => { const at = 0.35 + 0.5 * Math.max(0, Math.min(1, (g.x + g.w / 2) / 320)); return t >= at && t < at + 0.36; }));
          }, true);
        }
      },
      hold ? dimLayer() : marksLayer(day, r, detail, 'frame')
    ];
  }

  // Shot 8: the false dawn. `city` (the towers with every window lit before today's, and the day's newest ones switching on one by one, 0.35 to
  // 1.25 s) and `top` (weather, ground, the fine marks), where the LIGHTS ON count climbs 8 points over the same time.
  function skylineLayers(day, r) {
    const K = B.MotionKit, a = B.StoryData.actIndex(day) + 1, { cells, lo, f } = skyCells(day), to = Math.round(f * 100);
    return [
      {
        id: 'city', depth: 1,
        draw(c) { skylineShot(c, day, '', { part: 'city', skip: [lo, f] }); },
        animate(c, v, t) {
          // a left to right sweep (index order); each window pops, a 7x7 bone flash for 0.10 s centred on it, as it switches
          const step = 0.90 / cells.length;
          K.lamps(c, cells, t, { at: 0.35, step, order: 'index', on: day > 35 ? P.sky : P.amber });
          const k1 = Math.min(cells.length - 1, Math.floor((t - 0.35) / step));
          for (let k = Math.max(0, Math.ceil((t - 0.35 - 0.10) / step)); k <= k1; k++) {
            const w = cells[k];
            K.ping(c, t, { at: 0.35 + k * step, flare: { x: w.x - 2, y: w.y - 2, w: 7, h: 7, col: P.bone, a: 0.35, dur: 0.10 } });
          }
        }
      },
      {
        id: 'top', depth: 1,
        draw(c) { skylineShot(c, day, '', { part: 'top', labelStem: true }); finePass(c, day, r, 'establish'); tell(c, day); },
        animate(c, v, t) { K.tally(c, 24 + 11 * 6, 24, t, { from: to - 8, to, at: 0.35, dur: 0.90, fps: 15, fmt: (n) => n + '%', col: a >= 3 ? P.sky : P.amber, align: 'left', before: 'from' }); }
      }
    ];
  }

  // Shot 9: the rack room, the stack pulled. The LED strips go dark row by row, top to bottom, left to right along each row (0.35 to 1.37 s): each strip
  // shows lit (phosphorD) until its switch and then the art's own dark screenD. The fine marks are `marks`, above the lamps.
  function racksLayers(day, r, title) {
    const K = B.MotionKit, cells = [];
    for (let j = 0; j < 17; j++) for (let i = 0; i < 8; i++) cells.push({ x: 36 + 76 * i, y: 40 + 8 + 12 * j, w: 48, h: 6 });
    return [
      {
        id: 'racks', depth: 1,
        draw(c) { framed(c, day, r, title, { draw: (cc) => racksShot(cc, day) }); },
        // once the last strip has switched the art shows as it is (drawing screenD over screenD again would blend the edges the 1.18 zoom leaves half covered)
        animate(c, v, t) { if (t >= 0.35 + 135 * 0.0075) return; framed(c, day, r, title, { noBack: true, draw: (cc) => K.lamps(cc, cells, t, { at: 0.35, step: 0.0075, on: P.screenD, off: P.phosphorD }) }); }
      },
      marksLayer(day, r, false)
    ];
  }

  // ---- Stage 3, batch 6: the story tableaux ----
  // Layers: `art` (the picture without its mover and scanlines, cached; the animate draws the mover and the covers in the tableau's own transform),
  // `glass` (the scanlines, the header strip and the fine marks, above every cover and mover) and `marks` (establish: the corner brackets and the tear)
  // or `dim` (hold: the 0.18 ink rect). Coordinates in the paints are art units (320x180, before the 7 px drop). Returns null for a flat beat.
  const TAB_CUES = { 25: [{ at: 1.10, sfx: 'click' }] };
  function tableauLayers(day, r, phase, dur) {
    const K = B.MotionKit, M = B.Motion, n = r.arg, G = SH.tableauGeom(n), P_ = P;
    const est = phase === 'establish', det = phase === 'detail', hold = phase === 'hold', Z = det ? 1.3 : 0;
    const noMover = n === 3 || n === 9 || n === 12 || n === 13, over = n === 9;
    let paint = null;
    if (n === 3) {
      if (est) paint = (g, t) => SH.tableauMover(g, 3, (-4 + Math.round(9 * M.ease.out(K.span(t, 0.35, 1.35)))) / 9);
      else if (det) paint = (g, t) => SH.tableauMover(g, 3, Math.min(9, 5 + Math.floor(4 * K.span(t, 0.35, 1.95) + 1e-9)) / 9);
    }
    else if (n === 5) {
      // the five load cells flash bright crimson in turn (a cover on the bars' flat fills), three recover at 1.10 s; the detail and hold pulse the two that stay red
      const pulse = (from) => (g, t) => { if (t >= from) [3, 4].forEach((k) => { const b = G.bars[k]; K.blink(g, b.x, b.y, b.w, b.h, t, { on: null, off: P.crimson, period: 0.5, duty: 0.6, end: dur }); }); };
      if (est) paint = (g, t) => { if (t < 1.10) K.lamps(g, G.bars, t, { at: 0.40, step: 0.10, on: P.crimson }); };
      else paint = pulse(det ? 0.35 : 0.10);
    }
    else if (n === 8 && !hold) {
      // one pass per beat: rack k flares (0.20 bone, 0.08 s) at A + 0.18 k and the link to the next rack flashes white a moment later
      const A = est ? 0.36 : 0.40;
      paint = (g, t) => {
        for (let k = 0; k < 5; k++) {
          const a = A + 0.18 * k;
          K.ping(g, t, { at: a, off: [], on: [], flare: Object.assign({ col: P.bone, a: 0.20, dur: 0.08 }, G.slots[k]) });
          if (k < 4 && t >= a + 0.04 && t < a + 0.14) G.links[k].forEach((l) => X.rect(g, l.x, l.y, l.w, l.h, P.white));
        }
      };
    }
    else if (n === 9 && !hold) {
      // the queue edges up (establish: each figure steps 2 units from its place at 0.40 + 0.07 i, front first) or leans in and back (detail); the sway of p = 0.6 stays
      const d = est ? (i, t) => (t < 0.40 + 0.07 * i ? 2 : 0) : (i, t) => (t >= 0.40 + 0.07 * i && t < 0.68 + 0.07 * i ? -2 : 0);
      paint = (g, t) => SH.tableauMover(g, 9, 0.6, { shift: (i) => [d(i, t), 0] });
    }
    else if (n === 11 && est) {
      // six HOLD stamps land carton by carton: the bar and the word are hidden under the plate's flat desk2 until the stamp's third frame (nothing is drawn after the last, 1.18 s)
      paint = (g, t) => {
        G.marks.forEach((m, i) => {
          const ph = K.stamp(g, m.x, m.y, m.w, m.h, t, { at: 0.55 + 0.11 * i, col: P.crimson, frame: 0.04, grow: [16, 6], style: 'none' });
          if (ph < 3) X.rect(g, m.x, m.y, m.w, m.h, P.desk2);
        });
      };
    }
    else if (n === 12 || n === 13) {
      // the witness (drawn here, not in the art) leans in to the microphone; on 12 the LIVE badge pulses at the badge rate (covered by the header's flat slate while off),
      // on 13 the VOTE PENDING line does (covered by the box's flat ink)
      // (the line's cover starts at the text's own left edge: X.text centres with one truncation, so 124, not the sheet's 125)
      const W = G.badge, tw = X.textWidth('VOTE PENDING') - 1, Pd = { x: (160 - tw / 2) | 0, y: 118, w: tw, h: 7 }, dy = est ? (t) => -3 + Math.min(3, Math.max(0, Math.floor((t - 0.45) / 0.10 + 1e-9) + 1)) : det ? (t) => (t >= 0.60 && t < 1.30 ? 3 : 0) : () => 0;
      paint = (g, t) => {
        SH.tableauMover(g, n, 0.6, { shift: () => [0, dy(t)] });
        if (!det && t >= (est ? 0.30 : 0.10)) {
          if (n === 12) K.blink(g, W.x, W.y, W.w, W.h, t, { on: null, off: P.slate, period: 0.5, duty: 0.6, end: dur });
          else K.blink(g, Pd.x, Pd.y, Pd.w, Pd.h, t, { on: null, off: P.ink, period: 0.5, duty: 0.6, end: dur });
        }
      };
    }
    else if (n === 14 && !hold) {
      if (est) {
        // the four nodes on the right (3 to 6) are alive (sky, a cover on the node itself) until they die in turn, 0.60 + 0.18 k, each with one hard bone flash
        paint = (g, t) => G.nodes.slice(3).forEach((nd, k) => K.ping(g, t, { at: 0.60 + 0.18 * k, off: [{ x: nd.x, y: nd.y, w: 5, h: 5, col: P.sky }], on: [], flare: { x: nd.x - 3, y: nd.y - 3, w: 11, h: 11, col: P.bone, a: 0.45, dur: 0.08 } }));
      } else {
        // the last live node stutters three times and holds (node 6 is off frame here, so the deaths are not replayed)
        const nd = G.nodes[2];
        paint = (g, t) => K.flicker(g, nd.x, nd.y, 5, 5, 'news:45:n2', t, { spans: [[0.50, 0.56], [0.64, 0.80], [0.90, 0.94]], col: P.ink, a: 0.6 });
      }
    }
    if (!paint) return null;
    return [
      {
        id: 'art', depth: 1,
        draw(c) { at2x(c, (cc) => tableau(cc, n, Z, { part: 'art', noMover, over }), day); },
        animate(c, v, t) { at2x(c, (cc) => tableauSpace(cc, Z, (g) => paint(g, t)), day); }
      },
      {
        id: 'glass', depth: 1,
        draw(c) {
          at2x(c, (cc) => tableau(cc, n, Z, { part: 'scan', over }), day);
          if (est) finePass(c, day, r, 'establish', 'world'); else if (det) finePass(c, day, r, 'detail');
        }
      },
      hold ? dimLayer()
        : est ? marksLayer(day, r, false, 'frame') : null
    ].filter(Boolean);
  }

  B.Scenes.news = function (o) {
    const day = o.day || 0, r = row(day, story(o)), n = WEIGHTS[r.weight] || 2;
    const title = R.clean((o.brief || {}).title);
    const date = B.Calendar && B.Calendar.storyLabel ? B.Calendar.storyLabel(day) : `SESSION ${day + 1}`;
    const beats = [];
    if (r.weight === 'XL' && actTurns(day)) beats.push(R.beat('news', `${day}:act`, 1.7, (c) => actCard(c, day), act(day), { sfx: 'broadcast', transition: 'fade' }));
    const v = r.arg && variant(day, story(o)) ? ':' + r.arg : '';
    if (day === 0 && r.shot === 'elevator') beats.push(elevatorOpening(day, r, date));
    else beats.push(R.beat('news', `${day}${v}:establish`, n === 1 ? 2.4 : 1.7, (c) => { framed(c, day, r, title); finePass(c, day, r, 'establish'); tell(c, day); }, n === 1 ? title : date,
      Object.assign({ sfx: r.shot === 'tv' ? 'room' : r.shot === 'floor' || r.shot === 'dark' ? 'office' : 'apartment', informative: n === 1 }, beats.length ? {} : { transition: 'fade' })));
    if (n >= 2) beats.push(R.beat('news', `${day}${v}:detail`, 2.3, (c) => { detailFrame(c, day, r, title); finePass(c, day, r, 'detail'); }, title, { sfx: 'broadcast', informative: true }));
    if (n >= 3) beats.push(R.beat('news', `${day}${v}:hold`, 1.1, (c) => { shotFrame(c, day, r, title); holdDim(c); }, '', {}));
    // Stage 3, batch 4: the act card and the documents' details as layers. Beat ids, durations, captions and sounds stay as they were.
    // the establish of a document's place (the weight S establish draws the document itself, as the detail: no session has one)
    const insertEstablish = r.shot === 'insert' && r.weight !== 'S';
    const docDetail = (r.shot === 'insert' || r.shot === 'dark' || r.shot === 'racks') && r.arg;
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (/:act$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: actLayers(day) }));
      else if (docDetail && /:detail$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, docLayers(day, r, b.dur)));
      else if (insertEstablish && /:establish$/.test(b.id)) {
        const doc = r.doc, L = doc === 'memo' || doc === 'footnote' ? deskLayers(day, r, title, false, b.dur) : doc === 'voicemail' ? voicemailRoomLayers(day, r, title) : doc === 'post' ? postRoomLayers(day, r, title) : doc === 'chart' ? chartRoomLayers(day, r, title) : doc === 'rating' ? tvRoomLayers(day, r, title, 0.7, [0.45, 0.95]) : doc === 'ticket' ? floorLayers(day, r, title, { phase: 'establish', zoom: FLOOR_ZOOM(day, r, false), dur: b.dur }) : doc === 'vote' ? voteRoomLayers(day, r) : null;
        if (L) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: doc === 'post' ? B.MotionKit.rise(56, b.dur, 0.30, 0.90) : doc === 'voicemail' || doc === 'rating' || doc === 'ticket' ? SETTLE2() : doc === 'chart' || doc === 'vote' ? SETTLE() : null, layers: L }, doc === 'ticket' ? { cues: [{ at: 0.30, sfx: 'office' }] } : {}));
      } else if (insertEstablish && /:hold$/.test(b.id) && (r.doc === 'memo' || r.doc === 'footnote')) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: deskLayers(day, r, title, true, b.dur) }));
      else if (r.shot === 'tv' && /:establish$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: SETTLE2(), layers: tvRoomLayers(day, r, title, 0.7, [0.55, 1.15]) }));
      else if (r.shot === 'elevator' && /:(detail|hold)$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: elevatorDoorsLayers(day, r, /:hold$/.test(b.id)) }));
      else if (r.shot === 'floor' && /:(establish|detail)$/.test(b.id)) {
        const det = /:detail$/.test(b.id);
        beats[i] = B.Motion.layered(Object.assign({}, b, { camera: SETTLE2(), layers: floorLayers(day, r, title, { phase: det ? 'detail' : 'establish', zoom: FLOOR_ZOOM(day, r, det), dur: b.dur }) }));
      }
      else if (r.shot === 'dark' && (/:(establish|hold)$/.test(b.id) || (/:detail$/.test(b.id) && !r.arg))) {
        const ph = /:hold$/.test(b.id) ? 'hold' : /:detail$/.test(b.id) ? 'detail' : 'establish';
        beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: floorLayers(day, r, title, { phase: ph, dark: true, zoom: ph === 'detail' ? 0.7 : 0.15, dur: b.dur }) }));
      }
      else if (r.shot === 'skyline' && /:establish$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: skylineLayers(day, r) }));
      else if (r.shot === 'racks' && /:establish$/.test(b.id)) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: null, layers: racksLayers(day, r, title) }));
      else if (r.shot === 'tableau') {
        const ph = /:establish$/.test(b.id) ? 'establish' : /:detail$/.test(b.id) ? 'detail' : 'hold', L = tableauLayers(day, r, ph, b.dur);
        if (L) beats[i] = B.Motion.layered(Object.assign({}, b, { camera: ph === 'establish' ? SETTLE2() : null, layers: L }, TAB_CUES[day] && ph === 'establish' ? { cues: TAB_CUES[day] } : {}));
        // Kavro Strait: the hold shows the ships where the detail left them (p = 1)
        else if (r.arg === 3 && ph === 'hold') beats[i] = Object.assign({}, b, { draw: (c) => { at2x(c, (cc) => tableau(cc, 3, 0, { p: 1 }), day); holdDim(c); } });
        // a flat detail (the records, day 25) stays where it is: no camera
        else if (ph === 'detail') beats[i] = Object.assign({}, b, { camera: null });
      }
      else if (r.shot === 'place' && /:(establish|detail)$/.test(b.id)) {
        const L = placeLayers(day, r, title, /:detail$/.test(b.id));
        if (L) beats[i] = B.Motion.layered(Object.assign({}, b, L));
      }
    }
    return beats;
  };

  // The closing bell finally has a bell: the hand-drawn one, swinging. Two
  // days ring differently: one long slow swing the day of the offer, and not
  // at all at the end.
  const close = B.Scenes.close;
  // From session index 44 nobody rings the closing bell: the close shot is still and game.js plays no bell.
  function bellSilent(day) { return (day | 0) >= 44; }
  function bellSwing(day, p) { return day === 42 ? p * 0.45 : p; }
  // The sound is B.SFX.marketClose(), which the game fires in the same tick the close scene starts (the bell beat's own `sfx` plays
  // nothing: the game's B.SFX has no closeBell). Its strikes are 0.55 s apart (0, 0.55, 1.10, 1.65, 2.20, then a low one at 2.75).
  // The swing is 7 half-swings, so at 1.9 s the bell crosses centre every 0.2714 s: within about 20 ms of the strikes at 0.55,
  // 1.10 and 1.65 s (and at 0 s), and once between strikes.
  // That sync holds for every ringing day except session index 42: there the bell is one long slow swing (p * 0.45, under half a
  // swing in the whole beat) and is deliberately not synced to the strikes.
  const BELL_DUR = 1.9;
  // Layers back to front: wall (static room, the bell animated on it), desks (walkers and fine dashes animated on them), frame (corner brackets).
  // draw(ctx, view, 1, opts) is the old flat picture: wall, bell, desks, walkers, dashes, brackets.
  function bellLayers(day, empty) {
    const rr = { shot: 'bell' };
    return [
      {
        id: 'wall', depth: 0.5,
        draw(c) { at2x(c, (cc) => SH.bellScene(cc, 1, empty, 'wall'), day); },
        animate(c, v, t, p) { at2x(c, (cc) => SH.bellScene(cc, bellSwing(day, p), empty, 'bell'), day); }
      },
      {
        id: 'desks', depth: 1,
        draw(c) { at2x(c, (cc) => SH.bellScene(cc, 1, empty, 'desks'), day); },
        animate(c, v, t, p) {
          if (empty) at2x(c, (cc) => SH.bellScene(cc, bellSwing(day, p), true, 'walkers'), day);
          finePass(c, day, rr, 'establish', 'world');
        }
      },
      { id: 'frame', depth: 0, draw() {}, animate(c) { finePass(c, day, rr, 'establish', 'frame'); } }
    ];
  }
  // ---- The close: report card, hold, and the Sqwak insert and read (stage 3, batch 3) ----
  // Report and hold share two layers: `office` (the floor under the 0.32 ink overlay) and `card` (the box, the verdict label, the quota
  // and the date). The P&L, the nine dashes and the stamp are left out of the cached card and drawn on it each frame. With `rest` (the
  // hold) the card is final and the live screens go dark one by one, right to left.
  // Where the P&L count starts: a value with the final's number of digits (1,234,567 from 1,000,000; 950 from 100; 7 from 1; a loss
  // mirrors it; 0 stays 0), so the printed string keeps one width and the sign and dollar sign do not walk as digits are added.
  const countStart = (v) => { const a = Math.round(Math.abs(v)); return a === 0 ? v : (v < 0 ? -1 : 1) * Math.pow(10, String(a).length - 1); };
  function closeLayers(r, rest) {
    const K = B.MotionKit, M = B.Motion, G = R.closeGeom(r), O = R.officeGeom(r.day || 0), S = G.stamp;
    const verdictCol = G.met ? P.jade : P.crimson, dim = R.CLOSE_DIM;
    // Cache keys, shared by the report and the hold. office: the floor is a function of the day and whether the market fell (R.closeDown).
    // card: the box, the label (G.label, G.met), the quota and the date; the P&L, the dashes and the stamp are animated, not in the picture.
    return [
      {
        id: 'office', key: `close:office:${r.day || 0}:${R.closeDown(r) ? 1 : 0}`, depth: 0.5, draw(c) { R.closeFrame(c, r, true, { part: 'office' }); },
        animate(c, v, t) {
          if (!rest) return;
          const dc = O.deskChart;
          K.crt(c, dc.x + 1, dc.y + 1, dc.w - 2, dc.h - 2, t, { mode: 'off', at: 0.15, bg: P.screenD, dim });
          O.monitors.forEach((m) => {
            if (m.off) return;
            const at = 0.25 + 0.10 * (O.live - 1 - m.i), sc = m.screen, bar = m.bar;
            K.crt(c, sc.x, sc.y, sc.w, sc.h, t, { mode: 'off', at, bg: P.screenD, dim });
            if (t >= at + 0.10) { X.rect(c, bar.x, bar.y, bar.w, bar.h, bar.col || P.plasticD); c.save(); c.globalAlpha = dim; X.rect(c, bar.x, bar.y, bar.w, bar.h, P.ink); c.restore(); }
          });
        }
      },
      {
        id: 'card', key: `close:card:${JSON.stringify([G.label, G.met, r.quota || 0, r.date || ''])}`, depth: 1, draw(c) { R.closeFrame(c, r, true, { part: 'card', noPnl: true, noDashes: true }); },
        animate(c, v, t) {
          const at = rest ? -1 : 0.30, atStamp = rest ? -1 : 1.26;
          K.tally(c, G.pnlAt.x, G.pnlAt.y, t, { from: countStart(G.pnl), to: G.pnl, at, dur: rest ? 0.01 : 0.60, ease: M.ease.out, fps: 15, fmt: (x) => B.fmt.money(x, true), col: G.good ? P.jade : P.crimson, align: 'center', anchor: 'final' });
          K.lamps(c, G.dashes, t, { at, step: 0.0667, on: G.met ? P.jadeD : P.crimsonD });
          if (!G.verdict) return;
          // the label is hidden on the box's flat ink until the stamp's second frame
          const phase = K.stamp(c, S.x, S.y, S.w, S.h, t, { at: atStamp, col: verdictCol, frame: 0.04, grow: [16, 6], style: 'double' });
          if (phase < 2) X.rect(c, G.cover.x, G.cover.y, G.cover.w, G.cover.h, P.ink);
        }
      }
    ];
  }
  // One engagement count as a tally spec: its value, the format that prints the source string exactly (null when none does), and the source.
  function statCount(src) {
    const s = String(src), v = parseFloat(s) * (/K$/.test(s) ? 1000 : 1);
    const fmt = /K$/.test(s) ? (/\./.test(s) ? (x) => (x / 1000).toFixed(1) + 'K' : (x) => Math.round(x / 1000) + 'K') : (x) => String(Math.round(x));
    return isFinite(v) && fmt(v) === s ? { v, fmt } : null;
  }
  // Insert and read: city (skyline), phone (hand and post; the flag blinks, in the read the counts climb) and grain (scanlines, in the
  // insert the act wash), all drawn by sqwakFrame parts. The camera lifts only the phone layer.
  function sqwakLayers(sb, beat, full) {
    const K = B.MotionKit, M = B.Motion, G = R.sqwakGeom(full), F = G.flag, b = beat.post, dur = beat.dur, period = 1.0; // the kit's standby rate (bible C5)
    const stats = R.sqwakStats(b).map(String);
    return [
      // key: the skyline is a function of the day alone (its act, seed and lights); the read and the insert draw the same city
      { id: 'city', key: `sqwak:city:${sb.day}`, depth: full ? 0 : 0.25, draw(c) { R.sqwakFrame(c, sb, b, full, { part: 'city' }); } },
      {
        id: 'phone', depth: 1, draw(c) { R.sqwakFrame(c, sb, b, full, { part: 'phone', noFlag: true, noStats: true }); },
        animate(c, v, t) {
          K.blink(c, F.x, F.y, F.w, F.h, t, { on: P.crimson, period, duty: 0.5, end: dur });
          // the insert shows the read's starting counts (80%), static; the read counts from them to the authored strings
          const at = full ? 0.6 : 1e9;
          let x = G.stats.x;
          stats.forEach((src, k) => {
            const n = statCount(src);
            if (n) K.tally(c, x, G.stats.y, t, { from: Math.round(0.8 * n.v), to: n.v, at, dur: 1.6, ease: M.ease.linear, fps: 8, before: 'from', col: P.grey2, fmt: n.fmt });
            else R.text(c, src, x, G.stats.y, P.grey2);
            x += 6 * (src.length + 3);
          });
        }
      },
      { id: 'grain', depth: 0, draw(c) { R.sqwakFrame(c, sb, b, full, { part: 'grain' }); } }
    ];
  }
  B.Scenes.close = function (o) {
    const beats = close(o);
    const r = o.report || {}, day = r.day || 0, silent = bellSilent(day);
    if (beats[0] && silent) {
      // Nobody rings it: one still picture for the whole beat, no layers, no camera.
      beats[0] = Object.assign({}, beats[0], {
        dur: BELL_DUR, cache: true, sfx: 'room', line: '4:00 PM. NOBODY RINGS IT.',
        camera: { from: { y: 0 }, to: { y: 0 } },
        draw: (c) => {
          at2x(c, (cc) => {
            SH.bellScene(cc, 1, day >= 25);
            cc.save(); cc.globalAlpha = 0.45; X.rect(cc, 0, 0, 320, 180, P.ink); cc.restore();
          }, day);
          finePass(c, day, { shot: 'bell' }, 'establish');
        }
      });
    } else if (beats[0]) {
      beats[0] = B.Motion.layered(Object.assign({}, beats[0], {
        dur: BELL_DUR,
        camera: B.MotionKit.settle(8, B.Motion.ease.out, { step2: true }),
        layers: bellLayers(day, day >= 25)
      }));
    }
    const K = B.MotionKit, M = B.Motion;
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (/:sqwak$/.test(b.id)) beats[i] = M.layered(Object.assign({}, b, { camera: K.rise(40, b.dur, 0.20, 0.70), layers: sqwakLayers(R.storyboard(day), b, false) }));
      else if (/:sqwak-read$/.test(b.id)) beats[i] = M.layered(Object.assign({}, b, { camera: K.rise(26, b.dur, 0, 0.6), layers: sqwakLayers(R.storyboard(day), b, true) }));
      else if (/:report$/.test(b.id)) beats[i] = M.layered(Object.assign({}, b, { camera: K.settle(6, M.ease.out), layers: closeLayers(r, false) }));
      else if (/:hold$/.test(b.id)) beats[i] = M.layered(Object.assign({}, b, { camera: null, layers: closeLayers(r, true) }));
    }
    // The report says the one number the desk cares about.
    const rep = beats.find((b) => /:report$/.test(b.id));
    if (rep && r.quota > 0) rep.line = `${rep.line} QUOTA ${B.fmt.money(r.quota)}: ${r.quotaMet ? 'MET' : 'MISSED'}.`;
    return beats;
  };

  // ---- The morning: phone handoff and read, office wide, desk and hold ----
  // The phone beats and the office beats of rhythm.js, each rebuilt as layers (stage 3, batch 2).
  const wxSeed = (day, i) => `office:${day}:wx${i}`;
  // Window weather in the six office windows: the pilot weather, counts set per window (the kit's area formula is too big for 40 px).
  // Each window uses the same day as the static art in it (day + i, as officeFrame), so leaves and particles always match.
  function officeWeather(c, day, t, t0) {
    R.officeGeom(day).windows.forEach((W, i) => {
      const s = R.season(day + i), n = s.snow ? 3 + Math.round(3 * s.snow) : s.id === 'autumn' ? 3 : 4;
      B.MotionKit.weather(c, W.sky.x, W.sky.y, W.sky.w, W.sky.h, day + i, wxSeed(day, i), t, { t0, count: n, rainLen: 5 });
    });
  }
  // The read brings the lead in on top of the backlog when the feed has three or more items: the handoff shows items 2 to 5 (2 to n
  // for three and four items). Feeds of zero, one and two items have no arrival.
  const phoneArrival = (feed) => feed.length >= 3;
  const phoneBacklog = (feed) => (phoneArrival(feed) ? feed.slice(1, 5) : feed.slice(0, 4));

  // Handoff: the room is pinned at depth 0, the dark device rises into it at depth 1 and wakes at 0.80 s.
  function phoneHandoffLayers(sb, feed) {
    // The device is always the read's big one (close = true), so the dissolve into the read does not change its size.
    const K = B.MotionKit, L = phoneBacklog(feed), o = { rows: L, labelX: 92 };
    // the backlog keeps the read's 39 px rows even at two (three items), so the lead's slide of 44 px lands on the same slots
    if (phoneArrival(feed)) o.compact = false;
    const { sx, sy, sw, sh } = R.phoneGeom(L.length, true);
    const mm = R.lockMinute(sb.day);
    return [
      { id: 'room', depth: 0, draw(c) { R.phoneFrame(c, sb, feed, true, Object.assign({ part: 'room' }, o)); } },
      {
        id: 'device', depth: 1,
        draw(c) { R.phoneFrame(c, sb, feed, true, Object.assign({ part: 'device' }, o)); },
        animate(c, v, t) {
          // asleep until 0.80 s: the cached rows and status bar are covered, 6:MM shows at 2x; then one bone flare
          K.ping(c, t, { at: 0.80, off: [{ x: sx, y: sy, w: sw, h: sh, col: P.screenD }], on: [], flare: { x: sx, y: sy, w: sw, h: sh, col: P.bone, a: 0.15, dur: 0.08 } });
          if (t < 0.80) { c.save(); c.scale(2, 2); X.textShadow(c, '6:' + mm, 160, 39, P.grey2, P.ink, { align: 'center' }); c.restore(); }
        }
      }
    ];
  }
  // Read: `back` is everything but the cards, `rows` the cards (the only layer the camera moves), `glass` repaints the picture above
  // the list window (y < 51, the only place a row can leave the window: it starts 44 px up and never goes sideways or below),
  // so a row outside the window never shows. It is the same pixels as `back` there; drawing only that band avoids a second full room. The two counters are drawn whole on `glass`.
  function phoneReadLayers(sb, feed) {
    const K = B.MotionKit, n = feed.length, arrival = phoneArrival(feed), five = n >= 5, L = five ? feed.slice(0, 5) : feed.slice(0, 4);
    // five or more items end with a fifth row and the top two highlighted; three and four end exactly as the flat read does
    const o = { rows: L, count: L.length, glow: five ? 2 : 1, noDigits: true, labelX: 92 };
    const frame = (c, extra) => R.phoneFrame(c, sb, feed, true, Object.assign({}, o, extra));
    const wash = R.colors(sb.act).wash, landing = arrival ? 1.0 : 0.70, top = L.length;
    return [
      { id: 'back', depth: 0, draw(c) { frame(c, { part: 'back' }); } },
      { id: 'rows', depth: 1, draw(c) { frame(c, { part: 'rows' }); } },
      {
        id: 'glass', depth: 0,
        draw(c) { frame(c, { part: 'back', area: { x: 0, y: 0, w: V.w, h: 51 } }); },
        animate(c, v, t) {
          const k = arrival && t >= 0.85 ? top : arrival ? top - 1 : Math.min(4, n);
          R.text(c, String(k), 417, 36, wash, 'right');
          R.text(c, String(k), 92, 110, P.bone);
          if (n > 0) K.ping(c, t, { at: landing, off: [], on: [], flare: { x: 220, y: 55, w: 200, h: 39, col: P.bone, a: 0.15, dur: 0.08 } });
        }
      }
    ];
  }
  const phone = B.Scenes.phone;
  B.Scenes.phone = function (o) {
    const beats = phone(o), sb = R.storyboard(o.day || 0), feed = (o.brief && o.brief.feed) || [], K = B.MotionKit, M = B.Motion;
    const arrival = phoneArrival(feed);
    beats[0] = M.layered(Object.assign({}, beats[0], { camera: K.rise(56, beats[0].dur, 0.15, 0.75), layers: phoneHandoffLayers(sb, feed) }));
    const read = Object.assign({}, beats[1], {
      cues: [{ at: 0.70, sfx: 'news' }],
      camera: arrival ? K.settle(-44, K.camSpan(beats[1].dur, 0.70, 1.00, M.ease.out)) : null,
      layers: phoneReadLayers(sb, feed)
    });
    delete read.sfx;
    beats[1] = M.layered(read);
    return beats;
  };

  // Office: wall (windows, weather), monitors (refresh on the wide) and desk (your desk, the ticking chart and the slipping stack).
  function officeLayers(day, S, down, beatKind) {
    const K = B.MotionKit, M = B.Motion, wide = beatKind === 'wide', hold = beatKind === 'hold';
    const G = R.officeGeom(day, S), dc = G.deskChart, slip = G.slip;
    const t0 = wide ? 0 : hold ? 3.25 : 1.45, tc0 = hold ? 1.8 : 0;
    const x0 = dc.x + 6, Y = R.chartSeries(dc.y, dc.h, day, down, 25).map(Math.floor), col = down ? P.crimson : P.jade;
    // Cache keys (see Cinematic.layerKey): the three beats of one morning draw these pictures identically, so they are built once.
    // wall: the putty, the six windows and their skylines, season and sky are all functions of the day (no story state, no market).
    // monitors: the five screens: which are dead (the act, from the day), and the charts (the day and whether the market fell).
    // desk: the desk and your desk (detail, no top sheets, chart as a screen): the chart (day, market), the stack's slip and the red
    // stack (stability), the HOLD FILES (the heat or the flags: G.files). The wide beat's desk has no detail and is its own picture.
    const dn = down ? 1 : 0;
    const layers = [
      { id: 'wall', key: `office:wall:${day}`, depth: 0.5, draw(c) { R.officeFrame(c, day, false, down, S, { part: 'wall' }); }, animate(c, v, t) { officeWeather(c, day, t, t0); } },
      { id: 'monitors', key: `office:monitors:${day}:${dn}`, depth: 0.75, draw(c) { R.officeFrame(c, day, false, down, S, { part: 'monitors' }); } }
    ];
    if (wide) {
      layers[1].animate = (c, v, t) => { G.monitors.forEach((m) => { if (!m.off) K.crt(c, m.screen.x, m.screen.y, m.screen.w, m.screen.h, t, { mode: 'roll', at: 0.35 + 0.12 * m.i, dur: 0.36, band: 12 }); }); };
      layers.push({ id: 'desk', depth: 1, draw(c) { R.officeFrame(c, day, false, down, S, { part: 'desk' }); } });
    } else {
      layers.push({
        id: 'desk', key: `office:desk:${day}:${dn}:${G.st}:${G.files ? 1 : 0}`, depth: 1,
        draw(c) { R.officeFrame(c, day, true, down, S, { part: 'desk', noTopSheets: true, deskChart: 'screen' }); },
        animate(c, v, t) {
          const tc = t + tc0, s = Math.max(0, Math.min(10, Math.floor((tc - 0.25) / 0.25) + 1));
          const head = s >= 1 && tc - (0.25 + (s - 1) * 0.25) < 0.12 ? P.bone : null;
          // the top two sheets slip into their place between 0.90 and 1.20 s; on the hold they already sit there
          const slipNow = hold ? slip : slip >= 1 ? Math.round(slip * M.ease.out(K.span(t, 0.90, 1.20))) : 0;
          R.officeFrame(c, day, true, down, S, { part: 'top', slipNow });
          // the now-mark (sheet 2, section 10): a 2 px wide bone column at alpha 0.5 at the newest point's x, only while that point is lit, behind the dots
          if (head) {
            const mx = Math.max(dc.x + 1, Math.min(dc.x + dc.w - 3, x0 + 70)), my0 = Math.max(dc.y + 1, dc.y + 10), my1 = Math.min(dc.y + dc.h - 2, dc.y + dc.h - 18);
            c.save(); c.globalAlpha = 0.5; X.rect(c, mx, my0, 2, my1 - my0 + 1, P.bone); c.restore();
          }
          K.trace(c, Y, t, { x0, step: 5, from: s, n: 15, w: 3, h: 2, col, head });
        }
      });
    }
    return layers;
  }
  const office = B.Scenes.office;
  B.Scenes.office = function (o) {
    const beats = office(o), day = o.day || 0, g = o.game, S = g && g.mode && g.mode.S, down = R.marketDown(day - 1), M = B.Motion;
    const kinds = ['wide', 'desk', 'hold'];
    return beats.map((b, i) => M.layered(Object.assign({}, b, {
      camera: i === 0 ? B.MotionKit.settle(8, M.ease.inOut) : null,
      layers: officeLayers(day, S, down, kinds[i])
    })));
  };

  // ---- Endings: the hand-drawn city and a prop for each of the 22 ----
  // The endings' prop space: 320x180 art at 2x with the 8-unit drop of the prop. fn draws in it. (Never nest it: it is an at2x.)
  function endingSpace(c, fn) { at2x(c, (cc) => { cc.save(); cc.translate(0, 8); fn(cc); cc.restore(); }, 60); }
  // lo (optional): lo.part 'base' draws the prop without its mover (endingDetail's part), for the layered world beat.
  function endingWorld(ctx, o, p, card, lo) {
    at2x(ctx, (c) => {
      X.rect(c, 0, 0, 320, 180, P.ink);
      SH.endingShot(c, o.dark ? 'dark' : 'light', o.id);
      c.save(); c.translate(0, 8); SH.endingDetail(c, o.id || 'grind', p, lo && lo.part ? { part: lo.part } : undefined); c.restore();
      if (card) {
        c.save(); c.globalAlpha = 0.5; X.rect(c, 0, 96, 320, 40, P.ink); c.restore();
        X.box(c, 40, 100, 240, 26);
        X.textShadow(c, R.clean(o.title || '').toUpperCase().slice(0, 36), 160, 106, o.dark ? P.crimson : P.amber, P.ink, { align: 'center', spacing: 2 });
        X.text(c, 'ENDING REACHED', 160, 117, P.grey2, { align: 'center' });
      }
    }, 60);
    const index = Math.max(0, R.endingIds.indexOf(o.id));
    const signal = ['wiped','fired','perp','fall-guy','ward','replaced','depression','nobody'].includes(o.id) ? P.sky
      : ['whistle','cassandra','revolving','clawback','lost-decade'].includes(o.id) ? P.bone : P.amber;
    // Native 640-pixel street detail and a quiet signature for each ending.
    // The large prop remains unobstructed in the middle of the composition.
    // An ending with a place of its own (B.EndingPlaces) has no street, so it gets no street signature.
    if (B.EndingPlaces && B.EndingPlaces[o.id]) return;
    ctx.save(); ctx.globalAlpha = 0.68;
    for (let i = 0; i < 14; i++) {
      const xx = 18 + i * 47;
      X.rect(ctx, xx, 260 + (i * 7 + index) % 6, 29, 1, i % 4 === 0 ? signal : P.slate2);
      X.rect(ctx, xx + 6, 252, 1, 5, P.grey2);
    }
    for (let i = 0; i < 6; i++) {
      X.rect(ctx, 14 + i * 10, 24 + (i * 11 + index * 3) % 28, 2, 2, signal);
      X.rect(ctx, V.w - 74 + i * 10, 32 + (i * 13 + index * 5) % 22, 2, 2, signal);
    }
    X.rect(ctx, 14, 14, 58, 1, signal);
    X.rect(ctx, V.w - 72, 14, 58, 1, signal);
    X.rect(ctx, 14, 14, 1, 11, signal);
    X.rect(ctx, V.w - 15, 14, 1, 11, signal);
    ctx.restore();
  }
  // Whatever happened, the last picture is the morning after: the city at
  // first light, or, if you pulled the plug, the rack room in the dark.
  // lo (optional): lo.part 'city' draws the skyline with no lit windows and no still snow speckle (the layered after beat draws the windows).
  function lastLight(ctx, pulled, lo) {
    if (pulled && B.DecisionArt) return B.DecisionArt.room(ctx, 'c10', 60, true, { f: { pulledPlug: true } });
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    if (lo && lo.part === 'city') R.skyline(ctx, 1, 61, 270, 60, true, { noWindows: true });
    else R.skyline(ctx, 1, 61, 270, 60);
    X.dither(ctx, 0, 180, V.w, 90, P.ink, P.amber, 0.18);
    X.rect(ctx, 0, 270, V.w, 90, P.ink);
  }
  // ---- The endings, animated (stage 3, batch 9) ----
  // World: one layer (the city and the prop without its mover, the street's signature), the prop's one movement drawn above it inside endingSpace.
  // Card: the cached card, the ENDING REACHED line hidden until a stamp lands round the box. After: the city's windows going out, or the dark racks' one standby light.
  const quietRank = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const cells = SH.endingGeom('quiet').cells, idx = cells.map((c, k) => k), key = idx.map((k) => B.hashSeed('ending:quiet:' + k));
      idx.sort((x, y) => key[x] - key[y] || x - y);
      const pos = []; idx.forEach((k, r) => { pos[k] = r; });
      return (cache = pos);
    };
  })();
  // each id's movement: a function (g, t) drawing in endingSpace. n(t) counts items 0..N, one every `step` from `a`.
  function endingMotion(id) {
    const K = B.MotionKit, M = B.Motion, G = SH.endingGeom(id);
    const D = (g, q, extra) => SH.endingDetail(g, id, q, Object.assign({ part: 'mover' }, extra));
    const count = (t, a, step, N) => Math.max(0, Math.min(N, Math.floor((t - a) / step + 1e-9) + 1));
    const COUNT = { cassandra: [0.40, 0.12, 6], 'lost-decade': [0.40, 0.09, 10], depression: [0.40, 0.10, 9], 'right-early': [0.40, 0.07, 13], 'everything-rally': [0.40, 0.12, 7], fund: [0.40, 0.08, 10], clawback: [0.50, 0.15, 6] };
    if (id === 'wiped') return (g, t) => D(g, M.ease.in(K.span(t, 0.40, 1.30)));
    if (id === 'perp') return (g, t) => D(g, t < 0.50 ? 0 : (t >= 1.30 || (t >= 0.60 && t < 0.68) || (t >= 0.95 && t < 1.03)) ? 1 : 0.45);
    if (COUNT[id]) { const c = COUNT[id]; return (g, t) => D(g, 1, { n: count(t, c[0], c[1], c[2]) }); }
    if (id === 'master') return (g, t) => D(g, 1, { dx: -24 + Math.round(24 * M.ease.out(K.span(t, 0.40, 1.40))) });
    if (id === 'acquirer' || id === 'ward') { const far = id === 'ward' ? 10 : 12; return (g, t) => D(g, 1, { dy: Math.round(far * (1 - M.ease.out(K.span(t, 0.40, 1.40)))) }); }
    if (id === 'soft') {
      // each window is covered with the building's flat slate; the three tree sprites that overlap windows 3, 18 and 26 are drawn again over the covers
      const need = G.wins.map((w, k) => (G.leaves.some((l) => w.x < l.x + l.w && w.x + w.w > l.x && w.y < l.y + l.h && w.y + w.h > l.y) ? 0.40 + 0.03 * k : 0));
      const last = Math.max.apply(null, need);
      return (g, t) => {
        G.wins.forEach((w, k) => { if (t < 0.40 + 0.03 * k) X.rect(g, w.x, w.y, 6, 6, P.slate); });
        if (t < last) D(g, 1);
      };
    }
    if (id === 'fired') {
      // PERSONAL is written letter by letter: each letter's 5 x 7 cell of the label is covered with the label's paper. The text starts on the label's outline
      // column (x 136, ink2) and its second column is the white highlight; the last letter ends on the shade column (x 182, putty2).
      return (g, t) => {
        for (let k = 0; k < 8; k++) {
          if (t >= 0.50 + 0.09 * k) continue;
          const x = G.label.x + 6 * k, y = G.label.y;
          if (k === 0) { X.rect(g, x, y, 1, 7, P.ink2); X.rect(g, x + 1, y, 1, 7, P.white); X.rect(g, x + 2, y, 3, 7, P.bone); }
          else if (k === 7) { X.rect(g, x, y, 4, 7, P.bone); X.rect(g, x + 4, y, 1, 7, P.putty2); }
          else X.rect(g, x, y, 5, 7, P.bone);
        }
      };
    }
    if (id === 'quiet') return (g, t) => { const rk = quietRank(); G.cells.forEach((c, k) => { if (t < 0.40 + 1.00 * rk[k] / 33) X.rect(g, c.x, c.y, 7, 6, P.amberD); }); };
    if (id === 'nobody') return (g, t) => G.screens.forEach((s, i) => K.crt(g, s.x, s.y, 18, 30, t, { mode: 'on', at: 0.45 + 0.15 * i, bg: P.screenD }));
    if (id === 'replaced') {
      return (g, t) => {
        for (let i = 0; i < 4; i++) {
          if (!(t >= 0.45 + 0.12 * i && t < 0.60 + 0.12 * i)) continue;
          g.save(); g.globalAlpha = 0.45; G.strips[i].forEach((r) => X.rect(g, r.x, r.y, r.w, r.h, P.phosphorD)); g.restore();
        }
      };
    }
    if (id === 'whistle' || id === 'fall-guy') {
      const s = G.stamp;
      return (g, t) => {
        const ph = K.stamp(g, s.x - 2, s.y - 2, s.w + 4, s.h + 4, t, { at: 0.70, col: P.crimson, frame: 0.04, grow: [16, 6], style: 'none' });
        if (ph < 3) X.rect(g, s.x, s.y, s.w, s.h, P.bone);
      };
    }
    if (id === 'exit') {
      const d = G.door;
      return (g, t) => { const a = t < 0.50 ? 0.60 : t < 0.70 ? 0.40 : t < 0.90 ? 0.20 : 0; if (a) { g.save(); g.globalAlpha = a; X.rect(g, d.x, d.y, d.w, d.h, P.ink); g.restore(); } };
    }
    if (id === 'revolving') {
      const WING = [163, 167, 151, 155, 159, 163, 167, 151, 155, 159];
      return (g, t) => {
        if (t < 0.40 || t >= 1.40) return;
        const xb = WING[Math.floor((t - 0.40) / 0.10 + 1e-9)];
        X.rect(g, 159, 44, 2, 26, P.sky); X.rect(g, 159, 56, 2, 1, P.slate2); X.rect(g, xb, 44, 2, 26, P.slate2);
      };
    }
    // grind (and any id with no prop of its own): the monitor switches on
    return (g, t) => K.crt(g, G.screen.x, G.screen.y, G.screen.w, G.screen.h, t, { mode: 'on', at: 0.60, bg: P.screenD });
  }
  function endingWorldLayers(o) {
    const motion = endingMotion(o.id || 'grind');
    return [{ id: 'world', depth: 1, draw(c) { endingWorld(c, o, 1, false, { part: 'base' }); }, animate(c, v, t) { endingSpace(c, (g) => motion(g, t)); } }];
  }
  function endingCardLayers(o) {
    const K = B.MotionKit;
    return [{
      id: 'card', depth: 1,
      draw(c) { endingWorld(c, o, 1, true); },
      animate(c, v, t) {
        // ENDING REACHED (art x 119-201, y 117-123) is hidden on the box's flat ink and its ink2 bottom line until the stamp has landed
        at2x(c, (g) => {
          const ph = K.stamp(g, 40, 100, 240, 26, t, { at: 1.30, col: o.dark ? P.crimson : P.amber, frame: 0.04, grow: [16, 6], style: 'none' });
          if (ph < 3) { X.rect(g, 119, 117, 83, 6, P.ink); X.rect(g, 119, 123, 83, 1, P.ink2); }
        }, 60);
      }
    }];
  }
  // the city's lit windows go out from the right: window w is lit (amber, brighter than the art's) until 0.40 + (1 - x / 640) s
  function endingCityLayers() {
    const wins = R.skylineWindows(1, 61, 270).filter((w) => w.shown);
    return [{
      id: 'city', depth: 1,
      draw(c) { lastLight(c, false, { part: 'city' }); },
      animate(c, v, t) { for (const w of wins) if (t < 0.40 + 1.00 * (1 - (w.x + 1) / 640)) X.rect(c, w.x, w.y, 2, 2, P.amber); }
    }];
  }
  B.Scenes.ending = function (o) {
    const id = o.id || 'grind', pulled = !!o.pulled, M = B.Motion;
    const beats = [
      R.beat('ending', `${id}:world`, 1.8, (c) => endingWorld(c, o, 1, false), '', { sfx: 'apartment', transition: 'fade' }),
      R.beat('ending', `${id}:card`, 2.6, (c) => endingWorld(c, o, 1, true), R.clean(o.deck), { informative: true }),
      R.beat('ending', `${id}:after:${pulled ? 'p' : ''}`, 2.2, (c) => lastLight(c, pulled),
        pulled ? 'THE RACKS STAY DARK. FOR NOW.' : 'FIRST LIGHT. THE CITY IS STILL THERE.', { sfx: 'room' })
    ];
    beats[0] = M.layered(Object.assign({}, beats[0], {
      camera: B.MotionKit.settle(8, M.ease.inOut, { step2: true }),
      layers: endingWorldLayers(o)
    }));
    beats[1] = M.layered(Object.assign({}, beats[1], { camera: null, cues: [{ at: 1.30, sfx: 'click' }], layers: endingCardLayers(o) }));
    if (pulled && B.DecisionArt) {
      const L = B.DecisionArt.roomLayers('c10', 60, true, { f: { pulledPlug: true } }, 'after');
      if (L) beats[2] = M.layered(Object.assign({}, beats[2], { camera: null, cues: L.cues, layers: L.layers }));
    } else beats[2] = M.layered(Object.assign({}, beats[2], { camera: null, layers: endingCityLayers() }));
    return beats;
  };
})(window.BTB);
