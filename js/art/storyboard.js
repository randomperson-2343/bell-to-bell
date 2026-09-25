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

  function apartmentShot(ctx, day, home, night, w) {
    const L = home.look, week = Math.floor(day / 5) + 1, s = R.season(day), lay = LAYOUT[home.id] || LAYOUT.studio;
    const late = w ? w.lateWeeks | 0 : 0;
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

    // The window grows with the rent. What is outside it changes too.
    const ww = Math.round(V.w * L.win / U) * U, wx = V.w - ww - 36, wy = 42, wh = L.win > 0.8 ? 198 : 150;
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
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
    if (day === 9 || day === 54) {
      for (let i = 0; i < (day === 54 ? 4 : 1); i++) { box(ctx, bx + i * 21, by + 6 - (i % 2) * 3, 36, 21, P.bone, P.white, P.putty2); X.rect(ctx, bx + 6 + i * 21, by + 12 - (i % 2) * 3, 21, U, day === 54 ? P.crimsonD : P.amberD); }
    } else if (day === 44 || day === 49) {
      box(ctx, bx, by + 3, 60, 24, P.bone, P.white, P.putty2); X.rect(ctx, bx + 6, by + 9, 42, U, day === 49 ? P.crimsonD : P.amberD); X.rect(ctx, bx + 6, by + 15, 30, U, P.grey2);
    } else if (day === 59) {
      box(ctx, bx, by - 3, 54, 30, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, bx + 6, by + 3, 42, 18, night ? P.screenGlow : P.screen);
      for (let i = 0; i < 9; i++) X.rect(ctx, bx + 9 + i * 4, by + 15 - (i * 7 % 9), 2, 2, i > 5 ? P.crimson : P.phosphorD);
      box(ctx, bx - 6, by + 24, 66, 9, P.plastic, P.plastic2, P.plasticD);
    } else if (day === 19 || day === 34 || week % 3 === 0) {
      box(ctx, bx, by - 3, 54, 30, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, bx + 6, by + 3, 42, 18, night ? P.screenGlow : P.screen);
      const c = day === 34 ? P.amber : P.sky;
      if (day === 19 || day === 34) for (let i = 0; i < 4; i++) X.rect(ctx, bx + 9, by + 6 + i * 4, 33 - i * 6, 2, c);
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

    // The door's envelopes, where you can see them over the caption.
    if (late > 0) for (let i = 0; i < Math.min(5, late * 2); i++) box(ctx, 105 + i * 21, 258 - (i % 2) * 3, 30, 15, P.bone, P.white, P.putty2);
    // Your phone, face up on the floor. It never stops.
    box(ctx, 213, 261, 33, 15, P.ink2, P.slate2, P.ink); X.rect(ctx, 219, 264, 21, 6, night ? P.screenGlow : P.screen);
    // A rug where the pet sleeps.
    box(ctx, 372, 258, 234, 27, P.carpetD, P.carpet, P.ink2); for (let x = 384; x < 600; x += 18) X.rect(ctx, x, 264, 9, U, P.carpet2);

    // Sunday night on the couch, or any night the rent is late: you, sitting
    // up, lit by the phone. Your mother calls on Sundays.
    if (night && (home.id === 'couch' || late > 0)) {
      const fy = home.id === 'share' ? 213 : 180;
      blit(ctx, FIGURE, 207, fy);
      ctx.save(); ctx.globalAlpha = 0.18; X.rect(ctx, 213, fy + 6, 36, 24, P.screenGlow); ctx.restore();
    }
    petShot(ctx, w);
    if (night) { ctx.save(); ctx.globalAlpha = 0.28; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
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
    const pet = w && w.pet ? `${w.pet.kind}-${w.pet.sex}-${w.vet === 'neglected' ? 'n' : 'c'}` : '';
    const key = `${week}:${home.id}:${w ? Math.min(3, w.lateWeeks | 0) : 0}:${pulled ? 'p' : ''}:${pet}`;
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

  B.Storyboard = { PET, petRows, SHEET, DOCS, ANOMALY_DAYS, row, variant, lit, actTurns, HOMES, WEEKENDS, insertShot, shotFrame };

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
