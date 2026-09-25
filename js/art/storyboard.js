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
    ['elevator', 'XL'], ['insert', 'S', 'DESK QUOTA RAISED'], ['insert', 'M', '212 PAGES OF RELEASE NOTES'], ['floor', 'M'],
    ['tv', 'M', '$90B · NO REVENUE'], ['insert', 'M', '18K LIKES · DENIAL: 0 VIEWS'], ['insert', 'M', 'AUDITOR RESIGNS · FRLN UP'],
    ['place', 'S'], ['bell', 'L', 'THE BELL RINGS FOURTEEN TIMES'], ['insert', 'L', 'DELINQUENCY 6.4%'],
    ['insert', 'M', 'RATING AFFIRMED: AAA'], ['insert', 'L', 'FRLN HALTED · INDEX AT A RECORD'], ['tableau', 'L', 3],
    ['place', 'L'], ['insert', 'M', '-3% AT TEN · FLAT AT THE CLOSE'],
    ['insert', 'XL', 'A CIRCLE: THSI > HALO > THSI'], ['tv', 'S'], ['insert', 'M', 'SAME EXIT CLAUSE · THREE TIMES'],
    ['tableau', 'L', 5], ['dark', 'L', '19% OF RACKS NEVER ENERGIZE'], ['insert', 'M', 'COMPUTE FREEDOM ACT · SIGNED'],
    ['floor', 'L'], ['insert', 'M', 'PAGE 14 · FOOTNOTE 9'], ['insert', 'XL', 'BIDS: 1 · PRICE: 0.00'], ['place', 'S'],
    ['insert', 'M', '40 DOWNGRADES · SAME MINUTE'], ['place', 'M'], ['insert', 'M', 'CREDIT LINE WITHDRAWN'], ['place', 'L'],
    ['insert', 'S', 'VOLUME UP · PRICE FLAT'],
    ['tableau', 'XL', 8], ['tv', 'S'], ['insert', 'M', 'FOUR FUNDS · ONE MODEL'], ['tableau', 'XL', 9], ['place', 'L'],
    ['place', 'L'], ['insert', 'L', 'MARKED AT 22 CENTS'], ['insert', 'L', 'AT RISK: 5.5 CENTS'], ['tableau', 'M', 11],
    ['place', 'M'], ['skyline', 'S'], ['skyline', 'S'], ['skyline', 'S'], ['insert', 'M', 'VOLUME: PERFECTLY EVEN'], ['place', 'M'],
    ['insert', 'XL', 'QUOTA: 1.5% OF BOOK'], ['insert', 'M', '9,000 WORDS · 0 READS'], ['place', 'M'], ['skyline', 'S'],
    ['insert', 'L', 'VOICEMAIL · PERRY · 0:41'], ['skyline', 'S'], ['tableau', 'XL', 12], ['insert', 'L', 'YEAS 214 · NEEDED 218'],
    ['dark', 'L', 'THE ONE THEY LEAVE'], ['insert', 'M', 'MONEY FUND NAV 0.99'], ['tableau', 'XL', 13], ['floor', 'XL'],
    ['place', 'L'], ['insert', 'L', '61% OF FILLS · ONE COUNTERPARTY'], ['dark', 'XL'], ['tableau', 'XL', 14]
  ];
  const WEIGHTS = { S: 1, M: 2, L: 3, XL: 3 };

  // Which document each close-up is. Anything not listed is an internal memo.
  const DOCS = {
    2: 'footnote', 4: 'rating', 5: 'post', 6: 'chart', 9: 'chart', 10: 'rating', 11: 'ticket', 14: 'chart', 15: 'footnote',
    17: 'footnote', 20: 'vote', 22: 'footnote', 23: 'ticket', 25: 'rating', 29: 'chart', 36: 'ticket', 37: 'footnote',
    43: 'chart', 46: 'post', 49: 'voicemail', 52: 'vote', 54: 'ticket', 58: 'chart'
  };
  const LABELS = {
    memo: 'HOLLOWAY STERN · INTERNAL', footnote: 'OFFERING MEMORANDUM', rating: 'MERIDIAN RATINGS · ACTION', post: 'SQWAK',
    chart: 'RISK PRINTOUT', ticket: 'ORDER BOOK', vote: 'FLOOR TALLY', voicemail: 'VOICEMAIL'
  };
  // The twelve technical anomalies (patch3-data.js, A) sit on these sessions.
  // The morning of each one has one small thing wrong in the picture.
  const ANOMALY_DAYS = [0, 2, 15, 19, 23, 25, 30, 32, 38, 43, 49, 58];

  // Four mornings depend on what you chose the night before.
  function variant(day, S) {
    if (!S) return null;
    const c = S.choices || {}, f = S.f || {};
    if (day === 10 && c.c1 === 'dump') return ['insert', 'M', 'RIVERBEND BUYS AT PAR', 'ticket'];
    if (day === 10 && c.c1 === 'leak') return ['insert', 'M', 'LEAKED DECK · FRONT PAGE', 'post'];
    if (day === 35 && c.c5 === 'fail') return ['dark', 'L', 'NO RESCUE · DESKS CLEARED'];
    if (day === 35 && c.c5 === 'ban') return ['insert', 'L', 'SHORT SALES BANNED · 5 DAYS', 'ticket'];
    if (day === 35 && c.c5 === 'bail') return ['insert', 'L', 'GUARANTEE SIGNED · 2:14 AM', 'memo'];
    if (day === 55 && f.billPassed) return ['insert', 'XL', 'THE BILL PASSES · 218 YEAS', 'vote'];
    if (day === 60 && f.pulledPlug) return ['racks', 'XL', 'THE STACK IS OFF'];
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
  function tableau(c, n, zoom) {
    X.rect(c, 0, 0, 320, 180, P.ink);
    c.save();
    if (zoom) { c.translate(160 * (1 - zoom), 76 * (1 - zoom)); c.scale(zoom, zoom); }
    c.translate(0, 7);
    const ok = SH.briefingTableau(c, n, 0.6);
    c.restore();
    if (!ok) return false;
    if (!zoom) X.rect(c, 0, 0, 320, 7, P.slate);
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

  // The false dawn as a motif: sessions 42-49 light one more window each;
  // after the top they go out again.
  function lit(day) {
    if (day < 41) return 0.18;
    if (day <= 48) return 0.18 + (day - 40) * 0.08;
    return Math.max(0.04, 0.82 - (day - 48) * 0.07);
  }
  function skylineShot(ctx, day, title) {
    const a = B.clamp(Math.ceil((day + 1) / 15), 1, 4), s = R.season(day);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 260, day >= 41 && day <= 48 ? P.amberD : P.ink2, P.ink, 12);
    const f = lit(day);
    for (let i = 0; i < 26; i++) {
      const w = 18 + ((i * 17) % 20), h = 60 + ((i * 41) % 150), x = i * 26 - 6;
      X.rect(ctx, x, 260 - h, w, h, i % 3 ? P.ink2 : P.slate);
      if (s.snow) X.rect(ctx, x, 260 - h, w, 2, P.bone);
      for (let yy = 8; yy < h - 6; yy += 12) for (let xx = 4; xx < w - 4; xx += 8) {
        const k = ((i * 131 + xx * 7 + yy * 3) % 100) / 100;
        if (k < f) X.rect(ctx, x + xx, 260 - h + yy, 3, 3, day > 48 ? P.sky : P.amber);
      }
    }
    R.weather(ctx, 0, 0, V.w, 240, day);
    X.rect(ctx, 0, 260, V.w, 100, P.ink);
    R.text(ctx, `LIGHTS ON: ${Math.round(f * 100)}%`, 24, 24, a >= 3 ? P.sky : P.amber);
    if (title) R.text(ctx, title, 24, 38, P.bone);
  }

  // ---- Close-ups: the day's one number, on the document it came from ----
  function deskUnder(ctx) {
    X.rect(ctx, 0, 0, V.w, V.h, P.desk);
    X.gradient(ctx, 0, 0, V.w, V.h, P.desk2, P.deskD, 10);
  }
  function paper(ctx, x, y, w, h, label) {
    X.rect(ctx, x + 6, y + 6, w, h, P.deskD);
    X.plate(ctx, x, y, w, h, P.bone, P.white, P.plasticD);
    X.rect(ctx, x + 16, y + 18, w - 32, 2, P.grey);
    R.text(ctx, label, x + 20, y + 26, P.ink);
  }
  function valueLines(value, width) { return X.wrap(R.clean(value), width).slice(0, 2); }
  const DOC_DRAW = {
    memo(ctx, day, value, c) {
      deskUnder(ctx); paper(ctx, 96, 34, 448, 232, LABELS.memo);
      for (let i = 0; i < 5; i++) X.rect(ctx, 116, 180 + i * 12, 200 + ((i * 67 + day * 13) % 200), 2, P.grey2);
      X.rect(ctx, 112, 96, 416, 58, c.wash);
      const lines = valueLines(value, 200);
      lines.forEach((ln, i) => big(ctx, ln, 320, 104 + i * 22 + (lines.length === 1 ? 10 : 0), P.ink, 2, 'center'));
    },
    footnote(ctx, day, value) {
      deskUnder(ctx); paper(ctx, 70, 20, 380, 252, LABELS.footnote);
      for (let i = 0; i < 16; i++) X.rect(ctx, 90, 50 + i * 12, 300 - ((i * 41 + day * 7) % 90), 2, P.grey2);
      // One line circled in red marker, and the number written in the margin.
      const ly = 50 + (6 + day % 6) * 12;
      X.rect(ctx, 84, ly - 7, 290, 2, P.crimson); X.rect(ctx, 84, ly + 7, 290, 2, P.crimson);
      X.rect(ctx, 82, ly - 5, 2, 12, P.crimson); X.rect(ctx, 374, ly - 5, 2, 12, P.crimson);
      X.rect(ctx, 376, ly, 60, 2, P.crimson);
      X.plate(ctx, 440, 70, 180, 150, P.amber, P.bone, P.amberD);
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
    post(ctx, day, value, c) {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink); R.skyline(ctx, Math.ceil((day + 1) / 15), day * 5, 300, day);
      X.plate(ctx, 190, 16, 260, 300, P.ink2, P.slate2, P.ink);
      X.rect(ctx, 200, 28, 240, 276, P.screenD);
      big(ctx, 'sqwak', 320, 36, P.bone, 2, 'center');
      X.rect(ctx, 208, 60, 224, 150, P.screen);
      X.rect(ctx, 216, 70, 10, 10, P.crimson); R.text(ctx, 'TRENDING', 232, 72, P.crimson);
      valueLines(value, 96).forEach((ln, i) => big(ctx, ln, 216, 96 + i * 20, P.bone, 2));
      for (let i = 0; i < 3; i++) X.rect(ctx, 216 + i * 70, 190, 44, 6, i === 2 ? P.sky : P.slate2);
      X.scanlines(ctx, 200, 28, 240, 276, P.ink, 0.1);
    },
    chart(ctx, day, value) {
      deskUnder(ctx); paper(ctx, 60, 30, 520, 236, LABELS.chart);
      X.rect(ctx, 90, 60, 460, 120, P.white);
      for (let i = 1; i < 4; i++) X.rect(ctx, 90, 60 + i * 30, 460, 1, P.putty2);
      let y = 120; const down = R.marketDown(day);
      for (let i = 0; i < 90; i++) { y = B.clamp(y + (((i * 19 + day * 7) % 13) - 6) * 0.8 + (down ? 0.5 : -0.3), 66, 172); X.rect(ctx, 92 + i * 5, y, 4, 2, P.ink2); }
      // A red marker circle around the move that matters.
      const cx = 92 + 60 * 5;
      X.rect(ctx, cx - 30, 70, 60, 2, P.crimson); X.rect(ctx, cx - 30, 166, 60, 2, P.crimson);
      X.rect(ctx, cx - 32, 72, 2, 94, P.crimson); X.rect(ctx, cx + 30, 72, 2, 94, P.crimson);
      valueLines(value, 240).forEach((ln, i) => big(ctx, ln, 320, 196 + i * 22, P.crimsonD, 2, 'center'));
    },
    ticket(ctx, day, value) {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink); X.gradient(ctx, 0, 0, V.w, V.h, P.ink2, P.ink, 8);
      X.plate(ctx, 60, 20, 520, 256, P.plastic, P.plastic2, P.plasticD);
      X.crt(ctx, 74, 34, 492, 214, true);
      R.text(ctx, LABELS.ticket, 90, 46, P.phosphorD);
      R.text(ctx, 'BID', 150, 66, P.jade, 'center'); R.text(ctx, 'ASK', 490, 66, P.crimson, 'center');
      for (let i = 0; i < 5; i++) {
        X.rect(ctx, 100, 80 + i * 14, 100 - i * 18, 8, i ? P.screenGlow : P.jadeD);
        X.rect(ctx, 540 - (60 + i * 12), 80 + i * 14, 60 + i * 12, 8, P.crimsonD);
      }
      valueLines(value, 150).forEach((ln, i) => big(ctx, ln, 320, 160 + i * 28, P.phosphor, 3, 'center'));
      X.scanlines(ctx, 74, 34, 492, 214, P.ink, 0.12);
    },
    vote(ctx, day, value) {
      X.rect(ctx, 0, 0, V.w, V.h, P.deskD); X.gradient(ctx, 0, 0, V.w, V.h, P.desk, P.deskD, 8);
      X.plate(ctx, 40, 20, 560, 256, P.ink, P.slate2, P.ink2);
      R.text(ctx, LABELS.vote, 320, 32, P.amber, 'center');
      // Two banks of lamps, yea and nay.
      for (let r = 0; r < 6; r++) for (let k = 0; k < 18; k++) {
        X.rect(ctx, 64 + k * 13, 56 + r * 13, 9, 9, (r * 18 + k) % 7 ? P.jadeD : P.ink2);
        X.rect(ctx, 340 + k * 13, 56 + r * 13, 9, 9, (r * 18 + k) % 5 ? P.crimsonD : P.ink2);
      }
      valueLines(value, 180).forEach((ln, i) => big(ctx, ln, 320, 160 + i * 28, P.bone, 3, 'center'));
    },
    voicemail(ctx, day, value) {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.save(); ctx.globalAlpha = 0.14; X.rect(ctx, 170, 0, 300, 300, P.screenGlow); ctx.restore();
      X.plate(ctx, 200, 14, 240, 290, P.ink2, P.slate2, P.ink);
      X.rect(ctx, 212, 28, 216, 262, P.screen);
      R.text(ctx, LABELS.voicemail, 320, 40, P.grey2, 'center');
      for (let i = 0; i < 34; i++) { const h = 4 + ((i * 37 + day) % 36); X.rect(ctx, 224 + i * 5.8, 110 - h / 2, 3, h, i < 12 ? P.phosphor : P.slate2); }
      valueLines(value, 90).forEach((ln, i) => big(ctx, ln, 320, 150 + i * 22, P.bone, 2, 'center'));
    }
  };
  function insertShot(ctx, day, value, doc) {
    const a = B.clamp(Math.ceil((day + 1) / 15), 1, 4), c = R.colors(a);
    (DOC_DRAW[doc] || DOC_DRAW.memo)(ctx, day, value, c);
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }

  function actCard(ctx, day) {
    const a = B.clamp(Math.ceil((day + 1) / 15), 1, 4), c = R.colors(a);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, V.h, c.wash, P.ink, 12);
    const label = act(day);
    big(ctx, label.split('·')[1] ? label.split('·')[1].trim() : label, 320, 150, P.bone, 4, 'center');
    big(ctx, `ACT ${label.split('·')[0].trim()}`, 320, 112, c.signal, 2, 'center');
  }

  // A small version of the day's document, lying on your desk. The camera
  // tilts down so the paper sits above the caption box: z pushes in on it.
  function deskWithDoc(ctx, day, r, zoom) {
    const z = zoom || 1.15, ty = zoom ? 84 : 104;
    at2x(ctx, (c) => {
      X.rect(c, 0, 0, 320, 180, P.desk);
      c.save();
      c.translate(Math.round(160 - 119 * z), Math.round(ty - 153 * z)); c.scale(z, z);
      SH.deskCloseup(c, 1, { crash: R.marketDown(day - 1), ticker: ['INDX', 'CRVS', 'FRLN', 'MRDN', 'BSTN'][day % 5] });
      X.plate(c, 90, 138, 58, 30, P.bone, P.white, P.plasticD);
      X.rect(c, 94, 142, 50, 1, P.grey);
      X.rect(c, 94, 148, 50, 7, r.doc === 'rating' || r.doc === 'vote' ? P.sky : r.doc === 'chart' ? P.crimsonD : P.amberD);
      X.text(c, R.clean(r.arg || '').slice(0, 9), 95, 158, P.ink);
      c.restore();
    }, day);
  }
  // Where you are when the day's document reaches you.
  function establishDoc(ctx, day, r, title) {
    switch (r.doc) {
      case 'rating': return at2x(ctx, (c) => { SH.apartment(c, 0.7); SH.tvSet(c, 40, 50, 104, 68, r.arg || title, act(day), 0); }, day);
      case 'post': return R.phoneFrame(ctx, R.storyboard(day), [{ source: 'SQWAK', title: r.arg || title, kind: 'chirp' }], false);
      case 'vote': return B.DecisionArt ? B.DecisionArt.room(ctx, day > 40 ? 'c8' : 'c3', day, true, { f: { billPassed: /PASSES/.test(r.arg || '') } }) : at2x(ctx, (c) => SH.apartment(c, 0.6), day);
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
      X.plate(ctx, 30 + i * 76, 40, 60, 210, P.ink2, P.slate, P.ink);
      for (let k = 8; k < 200; k += 12) X.rect(ctx, 36 + i * 76, 40 + k, 48, 6, P.screenD);
    }
    X.rect(ctx, 0, 250, V.w, 110, P.slate);
  }

  // The underlying set pieces have 320-pixel silhouettes. These fine marks
  // live on the 640-pixel canvas, giving glass, paper and architecture their
  // own scale without changing a storyboard's subject or blocking its caption.
  function finePass(ctx, day, r, phase) {
    const signal = R.colors(B.clamp(Math.ceil((day + 1) / 15), 1, 4)).signal;
    const top = phase === 'detail' ? 19 : 12;
    if (r.shot === 'insert' && phase === 'detail') return; // native documents already have fine linework
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (r.shot === 'floor' || r.shot === 'dark' || r.shot === 'place') {
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
      X.rect(ctx, 308, 28, 24, 1, P.amber);
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
      case 'dark': return at2x(ctx, (c) => { SH.tradingFloor(c, 0.15, false, day); c.save(); c.globalAlpha = 0.42; X.rect(c, 0, 0, 320, 180, P.ink); c.restore(); }, day);
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
  function framed(ctx, day, r, title) {
    const flat = r.shot === 'skyline' || r.shot === 'tableau' || r.shot === 'bell' || (r.shot === 'insert' && (r.weight === 'S' || r.doc === 'vote'));
    const cam = flat ? CAMS.wide : CAM_ORDER[kindIndex(day, r) % CAM_ORDER.length];
    if (cam[0] === 1) return shotFrame(ctx, day, r, title);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    ctx.save();
    ctx.translate(Math.round(cam[1] * V.w * (1 - cam[0])), Math.round(0.4 * V.h * (1 - cam[0])));
    ctx.scale(cam[0], cam[0]);
    shotFrame(ctx, day, r, title);
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
    9: 'THE BONUS EMAIL SITS UNREAD ALL WEEKEND.',
    19: 'THE BILL IS ON EVERY CHANNEL. NOBODY HAS READ IT.',
    34: 'RESCUE WEEKEND. THE LIGHTS AT TREASURY NEVER GO OFF.',
    44: 'KROLL PAID FOR DINNER. IT IS OVER, HE SAYS.',
    49: 'THE TOP. NOBODY RINGS A BELL AT THE TOP.',
    54: 'FOUR VOTES SHORT. THE PHONES RING ALL NIGHT.',
    59: '3:17 AM. THE MACHINES ARE STILL TRADING.'
  };
  function wallet(o) { const g = o && o.game; return g && g.mode && g.mode.S && g.mode.S.wallet; }
  function homeOf(w) {
    const E = B.Economy;
    const t = w && E ? E.tier(w) : { id: 'studio', name: 'Midtown studio' };
    return { id: t.id, name: t.name, look: HOMES[t.id] || HOMES.studio };
  }
  function apartmentShot(ctx, day, home, night, w) {
    const L = home.look, week = Math.floor(day / 5) + 1;
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 250, night ? L.wall : L.wall2, night ? P.ink2 : L.wall, 10);
    X.rect(ctx, 0, 250, V.w, 110, L.floor);
    // Skirting, flooring and a receding seam make the space read as a room,
    // not two flat colour fields. The same apartment ages with the season.
    X.rect(ctx, 0, 244, V.w, 3, night ? P.slate2 : P.putty2);
    X.rect(ctx, 0, 248, V.w, 2, P.deskD);
    for (let i = 0; i < 9; i++) {
      const x = 22 + i * 81;
      X.rect(ctx, x, 251, 1, 109, P.deskD);
      X.rect(ctx, x + 28, 273, 20, 1, P.desk2);
    }
    X.rect(ctx, 0, 24, V.w, 2, night ? P.ink2 : P.putty2);
    // The window grows with the rent. What is outside it changes too.
    const ww = Math.round(V.w * L.win), wx = V.w - ww - 36, wy = 40, wh = L.win > 0.8 ? 200 : 150;
    X.inset(ctx, wx, wy, ww, wh, P.slate, P.ink2, P.ink);
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 3, wy + 3, ww - 6, wh - 6); ctx.clip();
    X.gradient(ctx, wx, wy, ww, wh, night ? P.ink2 : P.sky, night ? P.ink : P.slate2, 8);
    const s = R.season(day);
    if (!night) X.dither(ctx, wx, wy + wh / 2, ww, wh / 2, P.slate2, s.dawn, s.glow);
    if (L.view === 'shaft' || L.view === 'wall') {
      X.rect(ctx, wx, wy, ww, wh, L.view === 'shaft' ? P.deskD : P.slate);
      for (let yy = wy; yy < wy + wh; yy += 8) for (let xx = wx + ((yy / 8) % 2) * 8; xx < wx + ww; xx += 16) X.rect(ctx, xx, yy, 15, 1, P.ink2);
    } else {
      const lights = night ? lit(day) : 0;
      const n = Math.ceil(ww / 22);
      for (let i = 0; i < n; i++) {
        const bw = 12 + ((i * 17 + week) % 12), bh = (L.view === 'suburb' ? 18 : 40) + ((i * 41 + week * 7) % (L.view === 'suburb' ? 24 : 110));
        const bx = wx + i * 22, by = wy + wh - bh;
        X.rect(ctx, bx, by, bw, bh, i % 3 ? P.ink2 : P.slate);
        for (let yy = 5; yy < bh - 4; yy += 9) for (let xx = 3; xx < bw - 3; xx += 6) if (((i * 13 + xx + yy + week) % 100) / 100 < lights) X.rect(ctx, bx + xx, by + yy, 2, 2, P.amber);
      }
      if (L.view === 'bridges') { X.rect(ctx, wx, wy + wh - 48, ww, 3, P.grey); for (let i = 0; i < 6; i++) X.rect(ctx, wx + 20 + i * (ww / 6), wy + wh - 72, 3, 26, P.grey); }
      if (L.view === 'park') X.rect(ctx, wx, wy + wh - 30, ww, 30, s.snow ? P.bone : s.id === 'autumn' ? P.amberD : P.jadeD);
    }
    R.weather(ctx, wx, wy, ww, wh, day);
    ctx.restore();
    if (s.wreath) { X.rect(ctx, wx + ww / 2 - 14, wy - 10, 28, 6, P.jadeD); X.rect(ctx, wx + ww / 2 - 3, wy - 6, 6, 6, P.crimson); }
    // Furniture: the couch you sleep on, or the bed you paid for.
    if (home.id === 'couch') { X.plate(ctx, 40, 212, 250, 52, P.violet, P.sky, P.slate); X.rect(ctx, 60, 204, 120, 12, P.bone); }
    else if (home.id === 'share') { X.rect(ctx, 30, 236, 200, 24, P.bone); X.rect(ctx, 30, 256, 200, 6, P.deskD); X.plate(ctx, 250, 150, 70, 110, P.plasticD, P.plastic, P.ink2); }
    else { X.plate(ctx, 40, 214, 230, 48, P.slate, P.slate2, P.ink); if (L.win > 0.5) X.plate(ctx, 300, 226, 90, 30, P.deskD, P.desk2, P.ink); }
    if (home.id === 'studio') for (let i = 0; i < 6; i++) X.rect(ctx, 48 + i * 10, 150, 6, 50, P.plasticD);
    // Practical objects vary by week and housing tier. They have no plot
    // content of their own, but keep a dozen weekends from sharing one still.
    const lampX = home.id === 'couch' || home.id === 'share' ? 300 : 281;
    X.plate(ctx, lampX - 12, 215, 80, 12, P.deskD, P.desk2, P.ink2);
    X.rect(ctx, lampX + 18, 177, 3, 38, P.plastic2);
    X.rect(ctx, lampX, 172, 39, 5, P.bone);
    X.rect(ctx, lampX + 6, 162, 27, 11, night ? P.amberD : P.putty2);
    if (night) {
      ctx.save(); ctx.globalAlpha = 0.12;
      X.rect(ctx, lampX - 56, 178, 138, 72, P.amber);
      ctx.restore();
    }
    X.plate(ctx, lampX + 44, 192, 38, 24, P.plasticD, P.plastic2, P.ink);
    X.rect(ctx, lampX + 48, 196, 30, 15, P.screen);
    X.rect(ctx, lampX + 51, 199, 22 - week % 5, 1, P.sky);
    X.rect(ctx, lampX + 51, 204, 15 + week % 7, 1, P.phosphorD);
    if (week % 3 === 0) {
      X.plate(ctx, 52, 191, 48, 20, P.bone, P.white, P.plasticD);
      X.rect(ctx, 59, 198, 27, 2, P.grey);
      X.rect(ctx, 59, 203, 17, 1, P.grey2);
    } else if (week % 3 === 1) {
      X.rect(ctx, 44, 181, 38, 29, P.slate2);
      X.rect(ctx, 49, 186, 28, 18, P.screen);
      X.rect(ctx, 54, 193, 17, 1, P.phosphor);
    } else {
      X.plate(ctx, 51, 191, 53, 18, P.desk2, P.putty2, P.ink);
      X.rect(ctx, 58, 195, 37, 1, P.grey2);
    }
    // The week number on a paper calendar, and the phone that never stops.
    X.plate(ctx, 40, 70, 64, 72, P.bone, P.white, P.plasticD);
    X.rect(ctx, 40, 70, 64, 14, P.crimsonD);
    big(ctx, String(week), 72, 96, P.ink, 3, 'center');
    X.plate(ctx, 150, 244, 30, 16, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 154, 247, 22, 10, night ? P.screenGlow : P.screen);
    // The seven established weekend beats have distinct physical traces.
    if (day === 9 || day === 54) {
      for (let i = 0; i < (day === 54 ? 4 : 1); i++) {
        X.plate(ctx, 188 + i * 22, 236 - (i % 2) * 4, 36, 21, P.bone, P.white, P.plasticD);
        X.rect(ctx, 193 + i * 22, 242 - (i % 2) * 4, 22, 2, day === 54 ? P.crimsonD : P.amberD);
      }
    } else if (day === 19 || day === 34) {
      X.plate(ctx, 184, 219, 74, 37, P.ink2, P.slate2, P.ink);
      X.rect(ctx, 191, 226, 60, 21, P.screen);
      for (let i = 0; i < 4; i++) X.rect(ctx, 198, 230 + i * 4, 42 - i * 5, 1, day === 34 ? P.amber : P.sky);
    } else if (day === 44 || day === 49) {
      X.plate(ctx, 194, 232, 60, 21, P.bone, P.white, P.plasticD);
      X.rect(ctx, 199, 237, 42, 2, day === 49 ? P.crimsonD : P.amberD);
      X.rect(ctx, 199, 243, 32, 1, P.grey2);
    } else if (day === 59) {
      X.rect(ctx, 183, 242, 100, 1, P.sky);
      for (let i = 0; i < 9; i++) X.rect(ctx, 190 + i * 10, 238 - (i * 7 % 12), 3, 2, i > 5 ? P.crimson : P.phosphorD);
    }
    // Money trouble shows up at the door, where you can see it over the caption:
    // envelopes on the mat, and after three late weeks a red notice on the door.
    const late = w ? w.lateWeeks | 0 : 0;
    if (late > 0) {
      X.plate(ctx, 116, 100, 72, 152, P.deskD, P.desk2, P.ink2);
      X.rect(ctx, 176, 176, 6, 6, P.amber);
      X.rect(ctx, 104, 244, 96, 10, P.carpetD);
      for (let i = 0; i < Math.min(5, late * 2); i++) X.plate(ctx, 110 + i * 16, 236 - (i % 2) * 5, 30, 14, P.bone, P.white, P.plasticD);
      if (late >= 3) { X.plate(ctx, 130, 120, 44, 50, P.bone, P.white, P.crimsonD); X.rect(ctx, 136, 128, 32, 6, P.crimson); X.rect(ctx, 136, 140, 28, 2, P.grey); X.rect(ctx, 136, 146, 30, 2, P.grey); }
    }
    // Sunday night on the couch, or any night the rent is late: you, sitting
    // up, lit by the phone. Your mother calls on Sundays.
    if (night && (home.id === 'couch' || late > 0)) {
      X.rect(ctx, 214, 176, 34, 40, P.ink); X.rect(ctx, 220, 156, 22, 22, P.ink2); X.rect(ctx, 220, 156, 22, 6, P.ink);
      X.rect(ctx, 248, 186, 12, 18, P.screenGlow);
      ctx.save(); ctx.globalAlpha = 0.25; X.rect(ctx, 224, 160, 30, 26, P.screenGlow); ctx.restore();
    }
    if (night) { ctx.save(); ctx.globalAlpha = 0.28; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }
  function sundayShot(ctx, day, home, w) {
    // A closer Sunday camera holds on the phone and the unread material.
    // Monday's alarm is already intruding on the private room.
    ctx.save();
    // Framed so the wall calendar and most of the window (the housing tier
    // reads through its size) stay in shot.
    ctx.translate(-36, -50);
    ctx.scale(1.18, 1.18);
    apartmentShot(ctx, day, home, true, w);
    ctx.restore();
    X.rect(ctx, 0, 0, 5, 276, P.ink2);
    X.rect(ctx, 0, 0, 44, 2, P.amberD);
  }

  function story(o) { const g = o && o.game; return g && g.mode && g.mode.S; }
  B.Scenes.weekend = function (o) {
    const day = o.day || 0, week = Math.floor(day / 5) + 1, w = wallet(o), home = homeOf(w), S = story(o);
    const pulled = !!(S && S.f && S.f.pulledPlug);
    const story$ = day === 59 && pulled ? '3:17 AM. FOR THE FIRST TIME IN YEARS, NOTHING IS TRADING.' : WEEKENDS[day];
    const key = `${week}:${home.id}:${w ? Math.min(3, w.lateWeeks | 0) : 0}:${pulled ? 'p' : ''}`;
    const sat = w && w.weeks && w.weeks[week] ? `WEEK ${week} · ${home.name.toUpperCase()} · PAYSLIP ${B.fmt.money(w.weeks[week].net, true)}` : `WEEK ${week} · SATURDAY · ${home.name.toUpperCase()}`;
    const beats = [
      R.beat('weekend', `${key}:sat`, 1.7, (c) => apartmentShot(c, day, home, false, w), sat, { sfx: 'apartment', transition: 'fade', informative: !story }),
      R.beat('weekend', `${key}:sun`, 1.8, (c) => sundayShot(c, day, home, w), story$ || 'SUNDAY NIGHT. THE ALARM IS SET FOR 5:58.', { sfx: 'apartment', informative: !!story$ })
    ];
    // Two weekends get a second room: Treasury with every light on, and the
    // whip's phones the night before the vote.
    if (day === 34 && B.DecisionArt) beats.push(R.beat('weekend', `${key}:treasury`, 1.6, (c) => B.DecisionArt.room(c, 'c5', day), '2:14 AM. THE TERM SHEET IS ON ITS NINTH DRAFT.', { sfx: 'room' }));
    if (day === 54 && B.DecisionArt) beats.push(R.beat('weekend', `${key}:whip`, 1.6, (c) => B.DecisionArt.room(c, 'c8', day), 'THE WHIP HAS 214. HE NEEDS 218.', { sfx: 'room' }));
    beats.push(R.beat('weekend', `${key}:hold`, 0.8, (c) => { apartmentShot(c, day, home, true, w); c.save(); c.globalAlpha = 0.3; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); }, '', {}));
    if (day === 59) beats.push(R.beat('weekend', `${key}:317`, 1.6, (c) => (pulled && B.DecisionArt ? B.DecisionArt.room(c, 'c10', day, true, S) : at2x(c, (cc) => SH.tradingFloor(cc, 0.4, false, 60), day)),
      pulled ? 'THE FLOOR IS DARK. SO ARE THE RACKS.' : 'THE FLOOR IS DARK. THE RACKS ARE NOT.', {}));
    return beats;
  };

  B.Storyboard = { SHEET, DOCS, ANOMALY_DAYS, row, variant, lit, actTurns, HOMES, WEEKENDS, insertShot, shotFrame };

  B.Scenes.news = function (o) {
    const day = o.day || 0, r = row(day, story(o)), n = WEIGHTS[r.weight] || 2;
    const title = R.clean((o.brief || {}).title);
    const date = B.Calendar && B.Calendar.storyLabel ? B.Calendar.storyLabel(day) : `SESSION ${day + 1}`;
    const beats = [];
    if (r.weight === 'XL' && actTurns(day)) beats.push(R.beat('news', `${day}:act`, 1.7, (c) => actCard(c, day), act(day), { sfx: 'broadcast', transition: 'fade' }));
    const v = r.arg && variant(day, story(o)) ? ':' + r.arg : '';
    beats.push(R.beat('news', `${day}${v}:establish`, n === 1 ? 2.4 : 1.7, (c) => { framed(c, day, r, title); finePass(c, day, r, 'establish'); tell(c, day); }, n === 1 ? title : date,
      { sfx: r.shot === 'tv' ? 'room' : r.shot === 'floor' || r.shot === 'dark' ? 'office' : 'apartment', transition: beats.length ? 'cut' : 'fade', informative: n === 1 }));
    if (n >= 2) beats.push(R.beat('news', `${day}${v}:detail`, 2.3, (c) => { detailFrame(c, day, r, title); finePass(c, day, r, 'detail'); }, title, { sfx: 'broadcast', informative: true }));
    if (n >= 3) beats.push(R.beat('news', `${day}${v}:hold`, 1.1, (c) => { shotFrame(c, day, r, title); c.save(); c.globalAlpha = 0.18; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); }, '', {}));
    return beats;
  };

  // The closing bell finally has a bell: the hand-drawn one, swinging. Three
  // days ring differently: fourteen times on the fourteen-billion day, one
  // long slow swing the day of the offer, and not at all at the end.
  const close = B.Scenes.close;
  function bellSwing(day, p) {
    if (day === 8) return (p * 2) % 1;
    if (day === 57) return p * 0.45;
    return p;
  }
  B.Scenes.close = function (o) {
    const beats = close(o);
    const r = o.report || {}, day = r.day || 0, silent = day >= 59;
    if (beats[0]) {
      beats[0] = Object.assign({}, beats[0], {
        cache: false,
        line: silent ? '4:00 PM. NOBODY RINGS IT.' : day === 8 ? '4:00 PM. IT RINGS FOURTEEN TIMES.' : beats[0].line,
        draw: (c, v, p) => {
          at2x(c, (cc) => {
            SH.bellScene(cc, silent ? 1 : bellSwing(day, p == null ? 1 : p), day >= 38);
            if (silent) { cc.save(); cc.globalAlpha = 0.45; X.rect(cc, 0, 0, 320, 180, P.ink); cc.restore(); }
          }, day);
          finePass(c, day, { shot: 'bell' }, 'establish');
        }
      });
    }
    // The report says the one number the desk cares about.
    const rep = beats.find((b) => /:report$/.test(b.id));
    if (rep && r.quota > 0) rep.line = `${rep.line} QUOTA ${B.fmt.money(r.quota)}: ${r.quotaMet ? 'MET' : 'MISSED'}.`;
    return beats;
  };

  // ---- Endings: the hand-drawn city and a prop for each of the 22 ----
  function endingWorld(ctx, o, p, card) {
    at2x(ctx, (c) => {
      X.rect(c, 0, 0, 320, 180, P.ink);
      SH.endingShot(c, o.dark ? 'dark' : 'light', o.id);
      c.save(); c.translate(0, 8); SH.endingDetail(c, o.id || 'grind', p); c.restore();
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
  function lastLight(ctx, pulled) {
    if (pulled && B.DecisionArt) return B.DecisionArt.room(ctx, 'c10', 60, true, { f: { pulledPlug: true } });
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    R.skyline(ctx, 1, 61, 270, 60);
    X.dither(ctx, 0, 180, V.w, 90, P.ink, P.amber, 0.18);
    X.rect(ctx, 0, 270, V.w, 90, P.ink);
  }
  B.Scenes.ending = function (o) {
    const id = o.id || 'grind', pulled = !!o.pulled;
    return [
      R.beat('ending', `${id}:world`, 1.8, (c) => endingWorld(c, o, 0.3, false), '', { sfx: 'apartment', transition: 'fade' }),
      R.beat('ending', `${id}:card`, 2.6, (c) => endingWorld(c, o, 1, true), R.clean(o.deck), { informative: true }),
      R.beat('ending', `${id}:after:${pulled ? 'p' : ''}`, 2.2, (c) => lastLight(c, pulled),
        pulled ? 'THE RACKS STAY DARK. FOR NOW.' : 'FIRST LIGHT. THE CITY IS STILL THERE.', { sfx: 'room' })
    ];
  };
})(window.BTB);
