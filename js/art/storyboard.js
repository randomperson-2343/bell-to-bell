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
    ['insert', 'XL', 'QUOTA: 3.0% OF BOOK'], ['insert', 'M', '9,000 WORDS · 0 READS'], ['place', 'M'], ['skyline', 'S'],
    ['insert', 'L', 'VOICEMAIL · PERRY · 0:41'], ['skyline', 'S'], ['tableau', 'XL', 12], ['insert', 'L', 'YEAS 214 · NEEDED 218'],
    ['dark', 'L', 'THE ONE THEY LEAVE'], ['insert', 'M', 'MONEY FUND NAV 0.99'], ['tableau', 'XL', 13], ['floor', 'XL'],
    ['place', 'L'], ['insert', 'L', '61% OF FILLS · ONE COUNTERPARTY'], ['dark', 'XL'], ['tableau', 'XL', 14]
  ];
  const WEIGHTS = { S: 1, M: 2, L: 3, XL: 3 };

  function row(day) { const r = SHEET[day] || ['place', 'M']; return { shot: r[0], weight: r[1], arg: r[2] }; }
  function act(day) { const D = B.StoryData; return D && D.actOf ? D.actOf(day) : ''; }
  function actTurns(day) { return day > 0 && act(day) !== act(day - 1); }

  // Legacy art is authored at 320x180: draw it at exactly 2x.
  function at2x(ctx, fn) { ctx.save(); ctx.scale(2, 2); fn(ctx); ctx.restore(); }
  function big(ctx, value, x, y, color, scale, align) {
    ctx.save(); ctx.scale(scale, scale);
    X.textShadow(ctx, R.clean(value).slice(0, 44), Math.round(x / scale), Math.round(y / scale), color, P.ink, { align: align || 'left' });
    ctx.restore();
  }

  // The false dawn as a motif: sessions 42-49 light one more window each;
  // after the top they go out again.
  function lit(day) {
    if (day < 41) return 0.18;
    if (day <= 48) return 0.18 + (day - 40) * 0.08;
    return Math.max(0.04, 0.82 - (day - 48) * 0.07);
  }
  function skylineShot(ctx, day, title) {
    const a = B.clamp(Math.ceil((day + 1) / 15), 1, 4);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 260, day >= 41 && day <= 48 ? P.amberD : P.ink2, P.ink, 12);
    const f = lit(day);
    for (let i = 0; i < 26; i++) {
      const w = 18 + ((i * 17) % 20), h = 60 + ((i * 41) % 150), x = i * 26 - 6;
      X.rect(ctx, x, 260 - h, w, h, i % 3 ? P.ink2 : P.slate);
      for (let yy = 8; yy < h - 6; yy += 12) for (let xx = 4; xx < w - 4; xx += 8) {
        const k = ((i * 131 + xx * 7 + yy * 3) % 100) / 100;
        if (k < f) X.rect(ctx, x + xx, 260 - h + yy, 3, 3, day > 48 ? P.sky : P.amber);
      }
    }
    X.rect(ctx, 0, 260, V.w, 100, P.ink);
    R.text(ctx, `LIGHTS ON: ${Math.round(f * 100)}%`, 24, 24, a >= 3 ? P.sky : P.amber);
    if (title) R.text(ctx, title, 24, 38, P.bone);
  }

  // A document or screen close-up with the day's one number on it.
  function insertShot(ctx, day, headline, value) {
    const a = B.clamp(Math.ceil((day + 1) / 15), 1, 4), c = R.colors(a);
    X.rect(ctx, 0, 0, V.w, V.h, P.desk);
    X.gradient(ctx, 0, 0, V.w, V.h, P.desk2, P.deskD, 10);
    X.plate(ctx, 96, 34, 448, 232, P.bone, P.white, P.plasticD);
    X.rect(ctx, 112, 52, 416, 2, P.grey);
    R.text(ctx, R.clean(headline).toUpperCase().slice(0, 64), 116, 60, P.ink);
    for (let i = 0; i < 5; i++) X.rect(ctx, 116, 180 + i * 12, 200 + ((i * 67 + day * 13) % 200), 2, P.grey2);
    X.rect(ctx, 112, 96, 416, 58, c.wash);
    const lines = X.wrap(R.clean(value), 200).slice(0, 2);
    lines.forEach((ln, i) => big(ctx, ln, 320, 104 + i * 22 + (lines.length === 1 ? 10 : 0), P.ink, 2, 'center'));
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

  function shotFrame(ctx, day, r, title) {
    const sb = B.Rhythm.storyboard(day);
    switch (r.shot) {
      case 'tv': return at2x(ctx, (c) => { SH.apartment(c, 0.7); SH.tvSet(c, 40, 50, 104, 68, r.arg || title, act(day), 0); });
      case 'floor': return at2x(ctx, (c) => SH.tradingFloor(c, 0.15, true, day));
      case 'dark': return at2x(ctx, (c) => SH.tradingFloor(c, 0.15, false, day));
      case 'elevator': return at2x(ctx, (c) => SH.elevator(c, 0.6, 41));
      case 'bell': return at2x(ctx, (c) => SH.bellScene(c, 0.5, false));
      case 'tableau': return at2x(ctx, (c) => { if (!SH.briefingTableau(c, r.arg, 0.6)) SH.apartment(c, 0.6); });
      case 'skyline': return skylineShot(ctx, day, '');
      case 'insert': return R.placeFrame(ctx, sb, title, false);
      default: return R.placeFrame(ctx, sb, title, false);
    }
  }
  function detailFrame(ctx, day, r, title) {
    if (r.shot === 'insert' || (r.arg && typeof r.arg === 'string')) return insertShot(ctx, day, title, r.arg || title);
    if (r.shot === 'skyline') return skylineShot(ctx, day, title);
    if (r.shot === 'tv') return at2x(ctx, (c) => { SH.apartment(c, 0.7); c.save(); c.translate(92 * -0.3, 74 * -0.3); c.scale(1.3, 1.3); SH.tvSet(c, 40, 50, 104, 68, title, act(day), 0); c.restore(); });
    return R.placeFrame(ctx, B.Rhythm.storyboard(day), title, true);
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
    // The window grows with the rent. What is outside it changes too.
    const ww = Math.round(V.w * L.win), wx = V.w - ww - 36, wy = 40, wh = L.win > 0.8 ? 200 : 150;
    X.inset(ctx, wx, wy, ww, wh, P.slate, P.ink2, P.ink);
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 3, wy + 3, ww - 6, wh - 6); ctx.clip();
    X.gradient(ctx, wx, wy, ww, wh, night ? P.ink2 : P.sky, night ? P.ink : P.slate2, 8);
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
      if (L.view === 'park') X.rect(ctx, wx, wy + wh - 30, ww, 30, P.jadeD);
    }
    ctx.restore();
    // Furniture: the couch you sleep on, or the bed you paid for.
    if (home.id === 'couch') { X.plate(ctx, 40, 212, 250, 52, P.violet, P.sky, P.slate); X.rect(ctx, 60, 204, 120, 12, P.bone); }
    else if (home.id === 'share') { X.rect(ctx, 30, 236, 200, 24, P.bone); X.rect(ctx, 30, 256, 200, 6, P.deskD); X.plate(ctx, 250, 150, 70, 110, P.plasticD, P.plastic, P.ink2); }
    else { X.plate(ctx, 40, 214, 230, 48, P.slate, P.slate2, P.ink); if (L.win > 0.5) X.plate(ctx, 300, 226, 90, 30, P.deskD, P.desk2, P.ink); }
    if (home.id === 'studio') for (let i = 0; i < 6; i++) X.rect(ctx, 48 + i * 10, 150, 6, 50, P.plasticD);
    // The week number on a paper calendar, and the phone that never stops.
    X.plate(ctx, 40, 70, 64, 72, P.bone, P.white, P.plasticD);
    X.rect(ctx, 40, 70, 64, 14, P.crimsonD);
    big(ctx, String(week), 72, 96, P.ink, 3, 'center');
    X.plate(ctx, 150, 244, 30, 16, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 154, 247, 22, 10, night ? P.screenGlow : P.screen);
    // Money trouble shows up at the door.
    if (w && w.lateWeeks > 0) for (let i = 0; i < Math.min(5, w.lateWeeks * 2); i++) X.plate(ctx, 480 - i * 18, 300 + (i % 2) * 6, 34, 22, P.bone, P.white, P.plasticD);
    if (w && w.lateWeeks >= 3) { X.plate(ctx, 10, 150, 22, 30, P.bone, P.white, P.crimsonD); X.rect(ctx, 14, 156, 14, 3, P.crimson); }
    if (night) { ctx.save(); ctx.globalAlpha = 0.28; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }

  B.Scenes.weekend = function (o) {
    const day = o.day || 0, week = Math.floor(day / 5) + 1, w = wallet(o), home = homeOf(w);
    const story = WEEKENDS[day];
    const key = `${week}:${home.id}:${w ? Math.min(3, w.lateWeeks | 0) : 0}`;
    const sat = w && w.weeks && w.weeks[week] ? `WEEK ${week} · ${home.name.toUpperCase()} · PAYSLIP ${B.fmt.money(w.weeks[week].net, true)}` : `WEEK ${week} · SATURDAY · ${home.name.toUpperCase()}`;
    const beats = [
      R.beat('weekend', `${key}:sat`, 1.7, (c) => apartmentShot(c, day, home, false, w), sat, { sfx: 'apartment', transition: 'fade', informative: !story }),
      R.beat('weekend', `${key}:sun`, 1.8, (c) => apartmentShot(c, day, home, true, w), story || 'SUNDAY NIGHT. THE ALARM IS SET FOR 5:58.', { sfx: 'apartment', informative: !!story })
    ];
    if (day === 59) beats.push(R.beat('weekend', `${key}:317`, 1.6, (c) => at2x(c, (cc) => SH.tradingFloor(cc, 0.4, false, 60)), 'THE FLOOR IS DARK. THE RACKS ARE NOT.', {}));
    return beats;
  };

  B.Storyboard = { SHEET, row, lit, actTurns, HOMES, WEEKENDS };

  B.Scenes.news = function (o) {
    const day = o.day || 0, r = row(day), n = WEIGHTS[r.weight] || 2;
    const title = R.clean((o.brief || {}).title);
    const date = B.Calendar && B.Calendar.storyLabel ? B.Calendar.storyLabel(day) : `SESSION ${day + 1}`;
    const beats = [];
    if (r.weight === 'XL' && actTurns(day)) beats.push(R.beat('news', `${day}:act`, 1.7, (c) => actCard(c, day), act(day), { sfx: 'broadcast', transition: 'fade' }));
    beats.push(R.beat('news', `${day}:establish`, n === 1 ? 2.4 : 1.7, (c) => shotFrame(c, day, r, title), n === 1 ? title : date,
      { sfx: r.shot === 'tv' ? 'room' : r.shot === 'floor' || r.shot === 'dark' ? 'office' : 'apartment', transition: beats.length ? 'cut' : 'fade', informative: n === 1 }));
    if (n >= 2) beats.push(R.beat('news', `${day}:detail`, 2.3, (c) => detailFrame(c, day, r, title), title, { sfx: 'broadcast', informative: true }));
    if (n >= 3) beats.push(R.beat('news', `${day}:hold`, 1.1, (c) => { shotFrame(c, day, r, title); c.save(); c.globalAlpha = 0.18; X.rect(c, 0, 0, V.w, V.h, P.ink); c.restore(); }, '', {}));
    return beats;
  };

  // The closing bell finally has a bell: the hand-drawn one, swinging.
  const close = B.Scenes.close;
  B.Scenes.close = function (o) {
    const beats = close(o);
    const r = o.report || {};
    if (beats[0]) {
      beats[0] = Object.assign({}, beats[0], {
        cache: false,
        draw: (c, v, p) => at2x(c, (cc) => SH.bellScene(cc, p == null ? 1 : p, (r.day || 0) >= 38))
      });
    }
    return beats;
  };
})(window.BTB);
