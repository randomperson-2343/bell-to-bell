// Decision scenes. Every desk decision and every personal beat opens on a
// room with the person asking: Kroll behind his glass, Thorne on the dais,
// Venn at Treasury at two in the morning, Imani in the stairwell, the rack
// room for Pull the Plug, and the household: the shelter, the dentist, the
// vet. The speaker's portrait (js/art/portraits.js) is painted at 5x
// straight into the scene. After you choose, one still of the same room
// plays under the first line of what happened.
//
// Rooms are drawn to the pet sprite's rules, like the weekend apartment: a
// 3px grid, an ink outline, light on the top and left, shade on the bottom
// and right, and lamplight as hard-edged rings rather than a translucent box.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal, R = B.Rhythm;
  if (!R) return;
  const V = R.view;
  const U = 3;

  // Which room each decision happens in, and what that room shows. The
  // props are data so a room reused by another beat says the right thing.
  const ROOMS = {
    c1: ['office'], c3: ['hearing'], c5: ['treasury'], c6: ['office'], c7: ['office', { night: true }], c8: ['vote'], c9: ['stairwell'], c10: ['racks'],
    rentHike: ['lobby'], advance: ['dinner'],
    dadBill: ['kitchen', { phone: 'MOM · CALLING', doc: ['AMOUNT DUE', '$14,200'] }],
    pension: ['kitchen', { phone: 'MOM · 22:40', doc: ['RIVERBEND PENSION', 'BENEFITS -22%'] }],
    perry: ['voicemail', { who: 'PERRY', len: '0:41' }],
    dentist: ['voicemail', { who: 'DENTIST', len: '0:22' }],
    adopt: ['shelter'],
    vetCheck: ['kitchen', { postcard: true }],
    toothache: ['clinic', { kind: 'dentist', bill: '$1,400' }],
    vetER: ['clinic', { kind: 'vet', bill: '$900' }]
  };

  // ---- drawing kit ----
  const cel = (ctx, x, y, w, h, base, hi, sh, out) => X.cel(ctx, x, y, w, h, base, hi, sh, out, U);
  function blit(ctx, rows, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || U, s || U); X.drawSprite(ctx, X.sprite(rows), 0, 0); ctx.restore(); }
  // Light as stepped rings, widest first.
  function glow(ctx, cx, cy, radii, col, a) {
    for (const rad of radii) {
      ctx.save(); ctx.globalAlpha = a || 0.08; ctx.fillStyle = col;
      for (let y = cy - rad; y < Math.min(282, cy + rad); y += U) {
        const half = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - cy) * (y - cy))) * 1.3 / U) * U;
        ctx.fillRect(cx - half, y, half * 2, U);
      }
      ctx.restore();
    }
  }
  function big(ctx, s, x, y, col, k, align) { ctx.save(); ctx.scale(k, k); X.textShadow(ctx, s, Math.round(x / k), Math.round(y / k), col, P.ink, { align: align || 'left' }); ctx.restore(); }
  function carpet(ctx, y, a, b) { X.rect(ctx, 0, y, V.w, V.h - y, a); X.dither(ctx, 0, y + U, V.w, V.h - y, a, b, 0.16); X.rect(ctx, 0, y, V.w, U, P.ink2); }
  function boards(ctx, y, base) {
    X.rect(ctx, 0, y, V.w, V.h - y, base);
    for (let row = 0; row < 8; row++) { const yy = y + row * 15; X.rect(ctx, 0, yy, V.w, U, P.deskD); for (let x = -((row % 3) * 57); x < V.w; x += 171) X.rect(ctx, x, yy, U, 15, P.deskD); }
  }
  function panels(ctx, x0, y0, w, h, base, hi, sh, step) { for (let x = x0; x < x0 + w; x += step) cel(ctx, x, y0, step, h, base, hi, sh); }
  // A window of the city: frame, sky, towers, weather, then blinds or panes.
  // The geometry of tower i of a window of the city, and its lit night windows in drawing order. Shared by cityWindow and the animates
  // that light the windows one by one (the treasury).
  function tower(i, x, y, w, h, day) { return { bw: 18 + ((i * 17 + day) % 9), bh: 30 + ((i * 41 + day * 7) % (h - 36)), bx: x + i * 27, by: y + h - (30 + ((i * 41 + day * 7) % (h - 36))) }; }
  function towerCells(i, x, y, w, h, day) {
    const { bw, bh, bx, by } = tower(i, x, y, w, h, day), out = [];
    for (let k = 9; k < bh - 6; k += 9) for (let j = 3; j < bw - 6; j += 6) if ((i * 5 + k + j + day) % 3 === 0) out.push({ x: bx + j, y: by + k, w: 3, h: 3 });
    return out;
  }
  function cityCells(x, y, w, h, day) {
    const out = [];
    for (let i = 0; i < Math.ceil(w / 27); i++) for (const c of towerCells(i, x, y, w, h, day)) out.push(c);
    return out;
  }
  function cityWindow(ctx, x, y, w, h, day, night, slats, skipCells) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    R.sky(ctx, x, y, w, h, day, night ? P.ink : P.sky);
    for (let i = 0; i < Math.ceil(w / 27); i++) {
      const { bw, bh, bx, by } = tower(i, x, y, w, h, day);
      X.rect(ctx, bx, by, bw, bh, P.ink2); X.rect(ctx, bx, by, bw, U, i % 2 ? P.slate2 : P.slate); X.rect(ctx, bx + bw - U, by, U, bh, P.ink);
      if (night && !skipCells) for (const c of towerCells(i, x, y, w, h, day)) X.rect(ctx, c.x, c.y, c.w, c.h, P.amber);
    }
    R.weather(ctx, x, y, w, h - 24, day);
    if (slats) { ctx.save(); ctx.globalAlpha = 0.55; for (let yy = y + 6; yy < y + h; yy += 12) { X.rect(ctx, x, yy, w, U, P.putty2); X.rect(ctx, x, yy + U, w, 1, P.plasticD); } ctx.restore(); }
    ctx.restore();
    const f = night ? P.slate2 : P.plastic2, fh = night ? P.grey : P.white, fs = night ? P.slate : P.plasticD;
    cel(ctx, x - 9, y - 9, w + 18, 12, f, fh, fs); cel(ctx, x - 9, y + h - 3, w + 18, 12, f, fh, fs);
    cel(ctx, x - 9, y, 12, h, f, fh, fs); cel(ctx, x + w - 3, y, 12, h, f, fh, fs);
  }
  const GLASS = ['.1111.', '1rRRr1', '1rRRr1', '.1RR1.', '..11..', '..q1..', '..q1..', '..q1..', '.1qq1.', '1qqqq1'];
  const MUG = ['.111111...', '1dDDDDd1..', '1qqqqqq111', '1q9qqqq1.1', '1q9qqqq1.1', '1qqqqqq111', '1qqqqqp1..', '.111111...'];
  const LAMP = ['......111.', '.....1aa1.', '....1aaaa1', '...1aaaaa1', '..11111111', '.......1..', '.......1..', '.......1..', '.....111..', '....11111.'];

  // ---- the authored rooms (rooms/<name>): 214x121 cells at 3x from (-2,-2); screen px = 3*cell - 2. Each room draws its art when packed, else the code path below. ----
  const hasA = (n) => !!(B.Art && B.Art.has('rooms/' + n));
  const aArt = (ctx, n, frame, map) => X.drawArt(ctx, 'rooms/' + n, frame, -2, -2, { scale: U, map });
  const aSpr = (ctx, n, frame, cx, cy) => X.drawArt(ctx, 'rooms/' + n, frame, cx * U - 2, cy * U - 2, { scale: U });
  const SEASON = (day) => R.season(day).id;

  // ---- rooms ----
  // Kroll's corner office, by day and after dark.
  // part: 'back' is the room up to the lamplight, 'front' the desk and what is on it (the night office is split there, the lamplight rings drawn between).
  function office(ctx, day, night, o) {
    const part = o && o.part;
    if (B.Art && B.Art.has(OFFICE)) {
      if (part !== 'front') officeArtBack(ctx, day, night);
      // at night the front layer leaves the lamp to its animate (off, then on at the click), so no lit pixel shows before 0.45 s
      if (part !== 'back') officeArtFront(ctx, night, !part, !(night && part === 'front'));
      return;
    }
    if (part !== 'front') officeBack(ctx, day, night, !part);
    if (part !== 'back') officeFront(ctx, night);
  }
  // The drawn office (art/src/rooms/kroll-office.aseprite): 214x121 cells at 3x from (-2,-2), so its grid meets the speaker's.
  // Layers: window (behind the glass), back (the room), front (desk and what is on it), lamp, and at night glow:1 and glow:2,
  // the lamp's light as lit copies of what it falls on. The day sky takes the season: its key and the clouds' are swapped,
  // then the weather falls inside the glass (307,37 300x150).
  const OFFICE = 'rooms/kroll-office';
  const OFFICE_SKY = { autumn: { 8: 'a', 7: 'A' }, grey: { b: '6', 8: '7', 7: 'P' }, winter: { b: '7', 8: '9', 7: '8' } };
  const art = (ctx, frame, map) => X.drawArt(ctx, OFFICE, frame, -2, -2, { scale: U, map });
  function officeArtBack(ctx, day, night) {
    if (night) art(ctx, 'window:night');
    else { art(ctx, 'window:day', OFFICE_SKY[R.season(day).id]); R.weather(ctx, 307, 37, 300, 126, day); }
    art(ctx, night ? 'back:night' : 'back:day');
  }
  // The monitor's screen (565,166 51x33) is left dark in the art for the chart and the CRT turn-on.
  const OFFICE_SCREEN = { x: 565, y: 166, w: 51, h: 33 };
  function officeArtFront(ctx, night, glowToo, lamp) {
    art(ctx, night ? 'front:night' : 'front:day');
    const m = OFFICE_SCREEN;
    X.rect(ctx, m.x, m.y, m.w, m.h, night ? P.screenGlow : P.screen);
    for (let i = 0; i < 4; i++) X.rect(ctx, m.x + 6, m.y + 6 + i * 6, 36 - i * 6, U, i % 2 ? P.jade : P.crimson);
    if (lamp !== false) art(ctx, night ? 'lamp:on' : 'lamp:off');
    if (night && glowToo) { art(ctx, 'glow:1'); art(ctx, 'glow:2'); }
  }
  function officeBack(ctx, day, night, withGlow) {
    X.gradient(ctx, 0, 0, V.w, 240, night ? P.slate : P.putty2, night ? P.ink2 : P.putty, 10);
    panels(ctx, 0, 150, V.w, 90, night ? P.ink2 : P.deskD, night ? P.deskD : P.desk, P.ink2, 60);
    cityWindow(ctx, 306, 36, 300, 150, day, night, true);
    // A bookshelf and the framed chart of the firm's best year.
    cel(ctx, 24, 51, 144, 186, P.deskD, P.desk, P.ink2);
    for (let s = 0; s < 3; s++) {
      const sy = 63 + s * 57; X.rect(ctx, 30, sy + 48, 132, U, P.desk);
      for (let b = 0; b < 12; b++) {
        const bh = 30 + ((b * 7 + s * 3) % 15), c = [P.crimsonD, P.slate, P.jadeD, P.amberD, P.bone][(b + s) % 5];
        if ((b * 5 + s) % 7 === 3) continue;
        cel(ctx, 33 + b * 10, sy + 48 - bh, 10, bh, c, null, null);
      }
    }
    cel(ctx, 186, 45, 90, 66, P.deskD, P.desk2, P.ink2); X.rect(ctx, 195, 54, 72, 48, P.bone);
    for (let i = 0; i < 11; i++) X.rect(ctx, 198 + i * 6, 93 - i * 3, U * 2, U, P.jadeD);
    carpet(ctx, 237, night ? P.ink : P.carpetD, P.carpet);
    if (night && withGlow) glow(ctx, 402, 184, [150, 96, 51], P.amber, 0.07);
  }
  function officeFront(ctx, night) {
    // The desk: slab, front panel, drawers, brass.
    cel(ctx, 246, 207, 400, 18, P.desk, P.desk2, P.deskD);
    cel(ctx, 258, 222, 382, 54, P.deskD, P.desk, P.ink2);
    for (const dx of [276, 468]) { cel(ctx, dx, 231, 150, 18, P.deskD, P.desk, P.ink2); X.rect(ctx, dx + 69, 237, 12, U, P.amber); }
    cel(ctx, 555, 156, 69, 51, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, 564, 165, 51, 33, night ? P.screenGlow : P.screen);
    for (let i = 0; i < 4; i++) X.rect(ctx, 570, 171 + i * 6, 36 - i * 6, U, i % 2 ? P.jade : P.crimson);
    X.rect(ctx, 585, 204, 9, 6, P.plasticD);
    cel(ctx, 453, 189, 96, 21, P.amberD, P.amber, P.deskD); R.text(ctx, 'D. KROLL', 501, 195, P.ink, 'center');
    cel(ctx, 297, 192, 48, 18, P.ink2, P.slate2, P.ink); X.rect(ctx, 303, 186, 36, 6, P.ink2);
    if (night) {
      blit(ctx, LAMP, 381, 150);
      for (let i = 0; i < 3; i++) cel(ctx, 348 + i * 9, 198 - i * 6, 84, 12, P.bone, P.white, P.putty2);
      X.rect(ctx, 405, 186, 3, 3, P.crimsonD);
    }
  }

  // The committee room, or the chamber on the night of the vote.
  const SENATOR = ['..1111..', '.155551.', '.155551.', '..1551..', '.111111.', '1ssssss1', '1ssssss1'];
  const senatorRows = (i) => SENATOR.map((r) => r.replace(/s/g, ['2', '3', 'R', '2', 'J', '3', '2'][i]).replace(/5/g, i === 3 ? 'e' : ['e', 'D', '7', 'e', 'd', '7', 'D'][i]));
  // The whip has 214 votes; the bill passes with 218, so the board reads 218 then.
  function voteYeas(passed) { return passed ? 218 : 214; }
  function hearing(ctx, day, vote, passed, o) {
    const skip = o && o.skip, ART = hasA('hearing');
    if (ART) { aArt(ctx, 'hearing', vote ? 'room:vote' : 'room:hearing'); if (skip !== 'chair') aSpr(ctx, 'hearing-chair', 'chair', 133, 48); }
    else {
    X.gradient(ctx, 0, 0, V.w, 240, P.desk, P.deskD, 8);
    for (let i = 0; i < 9; i++) { cel(ctx, 12 + i * 72, 12, 18, 192, P.desk, P.desk2, P.deskD); cel(ctx, 6 + i * 72, 6, 30, 12, P.desk2, P.bone, P.desk); }
    // The seal: a ringed disc with a column and stars.
    const sx = 321, sy = 63;
    for (const [r, c] of [[42, P.ink2], [39, P.amberD], [33, P.slate], [30, P.sky]]) for (let y = -r; y <= r; y += U) { const half = Math.floor(Math.sqrt(r * r - y * y) / U) * U; X.rect(ctx, sx - half, sy + y, half * 2, U, c); }
    cel(ctx, 312, 42, 18, 42, P.bone, P.white, P.putty); cel(ctx, 306, 36, 30, 9, P.bone, P.white, P.putty); cel(ctx, 306, 81, 30, 9, P.bone, P.white, P.putty);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; X.rect(ctx, sx + Math.round(Math.cos(a) * 36 / U) * U, sy + Math.round(Math.sin(a) * 36 / U) * U, U, U, P.bone); }
    // Senators behind the dais, microphones up.
    for (let i = 0; i < 7; i++) {
      const x = 237 + i * 54;
      if (!(skip === 'chair' && i === 3)) blit(ctx, senatorRows(i), x, 144);
      X.rect(ctx, x + 36, 162, U, 30, P.grey); X.rect(ctx, x + 33, 159, 9, U, P.ink2);
    }
    cel(ctx, -U, 192, V.w + 2 * U, 48, P.deskD, P.desk2, P.ink2);
    for (let i = 0; i < 7; i++) cel(ctx, 240 + i * 54, 204, 42, 15, P.bone, P.white, P.putty2);
    carpet(ctx, 240, P.carpetD, P.carpet);
    }
    const tx = ART ? 424 : 426, ty = ART ? 28 : 30;
    if (vote) {
      if (!ART) cel(ctx, tx, ty, 198, 105, P.ink, P.slate2, P.ink2);
      R.text(ctx, 'STABILIZATION ACT', tx + 99, ty + 12, P.amber, 'center');
      if (!ART) X.rect(ctx, tx + 15, ty + 27, 168, U, P.slate);
      R.text(ctx, 'YEAS', tx + 21, ty + 39, P.jade); if (skip !== 'count') R.text(ctx, String(voteYeas(passed)), tx + 177, ty + 39, P.jade, 'right');
      if (passed) { R.text(ctx, 'NEEDED', tx + 21, ty + 55, P.bone); R.text(ctx, '218', tx + 177, ty + 55, P.bone, 'right'); R.text(ctx, 'PASSED', tx + 99, ty + 78, P.jade, 'center'); }
      else { R.text(ctx, 'SHORT', tx + 21, ty + 55, P.crimson); R.text(ctx, '4', tx + 177, ty + 55, P.crimson, 'right'); R.text(ctx, 'NEEDED 218', tx + 99, ty + 78, P.bone, 'center'); }
    } else {
      if (ART) { // the board's CRT is flat ink in the art (439,43,168x42); the LIVE light and its text sit in the flat 502,67,36x9
        R.text(ctx, 'MARKETS COMMITTEE', 523, 55, P.sky, 'center');
        X.rect(ctx, 505, 68, U * 2, U * 2, P.crimson); R.text(ctx, 'LIVE', 517, 68, P.crimson);
      } else {
        cel(ctx, tx + 12, ty + 12, 174, 48, P.ink, P.slate2, P.ink2);
        R.text(ctx, 'MARKETS COMMITTEE', tx + 99, ty + 24, P.sky, 'center');
        X.rect(ctx, tx + 78, ty + 40, U * 2, U * 2, P.crimson); R.text(ctx, 'LIVE', tx + 90, ty + 40, P.crimson);
      }
    }
  }

  // Treasury at 2:14 on a Sunday morning: every light on.
  // part: 'back' is the windows, the clock and the carpet (the animate lights the windows there), 'glow' only the lamplight rings over them, 'front' the desk.
  function treasury(ctx, day, o) {
    const part = o && o.part;
    if (hasA('treasury')) { // back, glow, then the season's windows over the glow; the lit cells and the colon are the animate's
      if (part === 'glow') return;
      if (part !== 'front') {
        aArt(ctx, 'treasury', 'back'); aArt(ctx, 'treasury', 'glow'); aArt(ctx, 'treasury', 'window:' + SEASON(day));
        big(ctx, '2:14', 65, 57, P.ink, 2, 'center');
        if (!(o && o.skip === 'cells')) for (const c of treasuryArtCells()) X.rect(ctx, c.x, c.y, c.w, c.h, P.amber);
      }
      if (part !== 'back') { aArt(ctx, 'treasury', 'front'); R.text(ctx, 'TREASURY · 2:14 AM', 606, 258, P.amber, 'right'); }
      return;
    }
    if (part === 'glow') { glow(ctx, 360, 150, [210, 150, 90], P.amber, 0.06); return; }
    if (part !== 'front') treasuryBack(ctx, day, o);
    if (!part) glow(ctx, 360, 150, [210, 150, 90], P.amber, 0.06);
    if (part !== 'back') treasuryFront(ctx);
  }
  // The lit windows of the treasury art: the one-cell amber pixels of its `cells` frame, five windows at x 82+26i (18 wide), as screen rects.
  let TCELLS = null;
  function treasuryArtCells() {
    if (TCELLS) return TCELLS;
    const a = B.Art.get('rooms/treasury', 'cells'), out = [];
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.rows[y][x] !== '.') out.push({ x: x * U - 2, y: y * U - 2, w: U, h: U, i: Math.max(0, Math.min(4, Math.floor((x - 82) / 26))) });
    return (TCELLS = out);
  }
  function treasuryBack(ctx, day, o) {
    X.gradient(ctx, 0, 0, V.w, 210, P.slate, P.ink2, 9);
    for (let i = 0; i < 5; i++) cityWindow(ctx, 246 + i * 78, 30, 54, 138, day + i, true, false, !!(o && o.skip === 'cells'));
    cel(ctx, 27, 27, 75, 75, P.plastic, P.plastic2, P.plasticD); cel(ctx, 36, 36, 57, 57, P.bone, P.white, P.putty2);
    big(ctx, '2:14', 65, 57, P.ink, 2, 'center');
    carpet(ctx, 210, P.carpetD, P.carpet);
  }
  function treasuryFront(ctx) {
    cel(ctx, 45, 198, 582, 21, P.desk, P.desk2, P.deskD); cel(ctx, 57, 216, 558, 36, P.deskD, P.desk, P.ink2);
    for (let i = 0; i < 9; i++) {
      cel(ctx, 240 + i * 42, 195, 33, 9, P.bone, P.white, P.putty2);
      if (i % 2) blit(ctx, MUG, 249 + i * 42, 177);
    }
    R.text(ctx, 'TREASURY · 2:14 AM', 606, 258, P.amber, 'right');
  }

  // The stairwell on forty-one, where Imani waits with a folder.
  function stairwell(ctx, day) {
    if (hasA('stairwell')) { aArt(ctx, 'stairwell', 'room'); big(ctx, 'EXIT', 105, 50, P.white, 2, 'center'); big(ctx, '41', 196, 204, P.ink, 2, 'center'); return; }
    X.gradient(ctx, 0, 0, V.w, 360, P.grey, P.slate, 9);
    X.dither(ctx, 0, 0, V.w, 262, P.grey, P.slate2, 0.08);
    cel(ctx, 222, 9, 240, 12, P.bone, P.white, P.putty); glow(ctx, 342, 18, [180, 120], P.white, 0.05);
    for (let i = 0; i < 9; i++) {
      const x = 246 + i * 42, y = 243 - i * 27;
      cel(ctx, x, y, V.w - x + U, 30, P.grey2, P.bone, P.slate2); X.rect(ctx, x + U, y + U, V.w - x, U, P.amberD);
    }
    for (let i = 0; i < 9; i++) X.rect(ctx, 270 + i * 42, 192 - i * 27, U, 54, P.ink2);
    for (let i = 0; i < 8; i++) { const x0 = 270 + i * 42, y0 = 192 - i * 27; for (let k = 0; k < 14; k++) X.rect(ctx, x0 + k * 3, y0 - Math.round(k * 27 / 14), U, U * 2, P.ink2); }
    cel(ctx, 54, 36, 102, 42, P.jadeD, P.jade, P.ink2); glow(ctx, 105, 57, [60, 36], P.jade, 0.08);
    big(ctx, 'EXIT', 105, 50, P.white, 2, 'center');
    cel(ctx, 165, 84, 63, 171, P.plasticD, P.plastic, P.ink2); cel(ctx, 180, 102, 18, 45, P.slate, P.sky, P.ink2);
    cel(ctx, 171, 159, 51, 12, P.grey2, P.bone, P.slate2); big(ctx, '41', 196, 204, P.ink, 2, 'center');
    X.rect(ctx, 0, 258, V.w, U, P.ink2); X.rect(ctx, 0, 261, V.w, 99, P.slate2); X.dither(ctx, 0, 264, V.w, 96, P.slate2, P.grey, 0.12);
  }

  // The rack room, where the shared stack runs, and the red switch.
  // The geometry of one rack: row r (0 back, 1 front), index i. The back row has six racks.
  function rackBox(r, i) {
    const k = r ? 1 : 0.72, w = Math.round(54 * k / U) * U, h = Math.round(222 * k / U) * U, x = r ? 177 + i * 69 : 228 + i * 51;
    return { k, w, h, x, y: 252 - h, step: Math.round(12 * k / U) * U || U };
  }
  // The LED rects the lit racks draw, in the order racks() draws them (row, rack, slot): { r, i, x, y, w: 3, h: 3, col }. day is accepted for symmetry (the racks do not depend on it).
  function rackLeds(day) {
    const out = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      if (r === 0 && i > 5) continue;
      const b = rackBox(r, i);
      for (let s = 9; s < b.h - 9; s += b.step) if ((i * 7 + s + r) % 3) out.push({ r, i, x: b.x + 9 + ((i * 3 + s) % (b.w - 21)), y: b.y + s, w: U, h: U, col: (i + s) % 5 ? P.phosphor : P.sky });
    }
    return out;
  }
  function racks(ctx, day, dark) {
    if (hasA('racks')) {
      aArt(ctx, 'racks', 'room');
      if (dark) {
        ctx.save(); ctx.globalAlpha = 0.45; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore();
        // the red switch stays lit and off: the art's cover (cells 34,37 24x31) redrawn, then the authored switch:off frame over it: button pulled down, its slot dark
        ctx.save(); ctx.beginPath(); ctx.rect(100, 109, 72, 93); ctx.clip(); aArt(ctx, 'racks', 'room'); ctx.restore();
        aArt(ctx, 'racks', 'switch:off');
      } else aArt(ctx, 'racks', 'leds:on');
      return;
    }
    X.gradient(ctx, 0, 0, V.w, 252, P.screenD, P.ink, 8);
    cel(ctx, 150, 6, 490, 15, P.slate, P.slate2, P.ink2); for (let x = 165; x < 640; x += 30) X.rect(ctx, x, 21, U, 12, P.slate);
    const leds = dark ? [] : rackLeds(day);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      if (r === 0 && i > 5) continue;
      const b = rackBox(r, i), w = b.w, h = b.h, x = b.x, y = b.y;
      cel(ctx, x, y, w, h, P.ink2, P.slate, P.ink);
      for (let s = 9; s < h - 9; s += b.step) X.rect(ctx, x + 6, y + s, w - 12, U * 2, P.screenD);
      leds.forEach((L) => { if (L.r === r && L.i === i) X.rect(ctx, L.x, L.y, L.w, L.h, L.col); });
    }
    X.rect(ctx, 0, 252, V.w, 108, P.slate); for (let x = 0; x < V.w; x += 42) { X.rect(ctx, x, 252, U, 108, P.slate2); } for (let y = 264; y < 360; y += 30) X.rect(ctx, 0, y, V.w, U, P.slate2);
    if (dark) { ctx.save(); ctx.globalAlpha = 0.45; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    else glow(ctx, 420, 120, [240, 160], P.sky, 0.05);
    // The red switch under its hazard-striped cover.
    cel(ctx, 99, 108, 72, 93, P.amberD, P.amber, P.ink2);
    for (let k = 0; k < 6; k++) X.rect(ctx, 105 + k * 12, 111, 6, 87, P.ink2);
    cel(ctx, 111, 120, 48, 69, P.slate, P.slate2, P.ink);
    cel(ctx, 120, 129, 30, 51, dark ? P.crimsonD : P.crimson, dark ? P.crimson : P.white, P.crimsonD);
    cel(ctx, 126, dark ? 165 : 135, 18, 9, P.bone, P.white, P.putty2);
  }

  // The management screen's eyes: two open squares, or two lines when it blinks.
  function lobbyEyes(ctx, closed) {
    if (hasA('bldg-lobby')) { aArt(ctx, 'bldg-lobby', closed ? 'eyes:closed' : 'eyes:open'); return; }
    for (const x of [147, 216]) { if (closed) X.rect(ctx, x, 105, 21, U, P.phosphor); else cel(ctx, x, 93, 21, 21, P.phosphor, P.white, P.phosphorD); }
  }
  // The lobby, where the building's model tells you rent is going up.
  // part: 'back' is the wall to the screen's glow, 'front' the mouth onwards; the eyes are drawn between (lobbyEyes), by the flat room or by the animate.
  function lobby(ctx, day, o) {
    const part = o && o.part;
    if (part !== 'front') lobbyBack(ctx);
    if (!part) lobbyEyes(ctx, false);
    if (part !== 'back') lobbyFront(ctx);
  }
  function lobbyBack(ctx) {
    if (hasA('bldg-lobby')) { aArt(ctx, 'bldg-lobby', 'back'); return; }
    X.gradient(ctx, 0, 0, V.w, 258, P.putty2, P.plasticD, 10);
    X.dither(ctx, 0, 0, V.w, 258, P.putty2, P.bone, 0.05);
    // Mailboxes and the elevator.
    cel(ctx, 348, 45, 132, 150, P.plasticD, P.plastic, P.ink2);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { cel(ctx, 354 + c * 30, 51 + r * 27, 30, 27, P.plastic, P.plastic2, P.plasticD); X.rect(ctx, 363 + c * 30, 60 + r * 27, 9, U, P.amberD); }
    cel(ctx, 504, 36, 120, 222, P.plasticD, P.plastic2, P.ink2);
    cel(ctx, 516, 60, 48, 198, P.grey2, P.bone, P.grey); cel(ctx, 564, 60, 48, 198, P.grey2, P.bone, P.grey);
    cel(ctx, 546, 42, 36, 15, P.ink, P.slate, P.ink2); R.text(ctx, '41', 564, 46, P.amber, 'center');
    // The management screen, smiling on its stand.
    cel(ctx, 84, 45, 216, 162, P.plasticD, P.plastic2, P.ink2); X.rect(ctx, 99, 60, 186, 123, P.screen);
    glow(ctx, 192, 120, [150, 90], P.phosphor, 0.05);
  }
  function lobbyFront(ctx) {
    if (hasA('bldg-lobby')) {
      aArt(ctx, 'bldg-lobby', 'front'); X.scanlines(ctx, 97, 61, 186, 123, P.ink, 0.25);
      R.text(ctx, '41', 564, 46, P.amber, 'center'); R.text(ctx, 'RENT +9% · CONGRATULATIONS', 192, 189, P.bone, 'center'); return;
    }
    X.rect(ctx, 150, 141, 84, U * 2, P.phosphor); X.rect(ctx, 144, 135, 9, 9, P.phosphor); X.rect(ctx, 231, 135, 9, 9, P.phosphor);
    X.scanlines(ctx, 99, 60, 186, 123, P.ink, 0.25);
    X.rect(ctx, 183, 207, 18, 36, P.plasticD); cel(ctx, 150, 240, 84, 12, P.plasticD, P.plastic, P.ink2);
    R.text(ctx, 'RENT +9% · CONGRATULATIONS', 192, 189, P.bone, 'center');
    // A checkerboard floor.
    for (let y = 258; y < 360; y += 18) for (let x = ((y / 18) % 2) * 18; x < V.w; x += 36) X.rect(ctx, x, y, 18, 18, P.slate2);
    X.rect(ctx, 0, 258, V.w, U, P.ink2);
  }

  // The steakhouse: good wine, a candle, and an $8,000 advance.
  const ENV = { x: 246, y: 219, w: 114, h: 27 };
  // the postcard's photo square (a cel with a 3 px outline, drawn in the kitchen with a postcard); the animate covers it with the card's paper
  const PHOTO_OLD = { x: 321, y: 171, w: 30, h: 30 }, PHOTO_ART = { x: 322, y: 172, w: 30, h: 30 };
  const photo = () => (hasA('kitchen') ? PHOTO_ART : PHOTO_OLD);
  // The $8,000 envelope at x (it slides in from 36 px to the right).
  // The art's envelope sprite rests at cell 82,73 (px 244,217); `x` stays the old px (ENV.x + slide), so the art draws at x - 2.
  function envelope(ctx, x) {
    if (hasA('dinner-envelope')) { X.drawArt(ctx, 'rooms/dinner-envelope', 'base', x - 2, 217, { scale: U }); R.text(ctx, '$8,000', x - 2 + 57, 227, P.jadeD, 'center'); return; }
    cel(ctx, x, ENV.y, ENV.w, ENV.h, P.bone, P.white, P.plasticD); R.text(ctx, '$8,000', x + 57, 229, P.jadeD, 'center');
  }
  function dinner(ctx, day, o) {
    if (hasA('dinner')) { aArt(ctx, 'dinner', 'room'); if (!(o && o.skip === 'envelope')) envelope(ctx, ENV.x); return; }
    X.gradient(ctx, 0, 0, V.w, 240, P.deskD, P.ink2, 9);
    panels(ctx, 0, 120, V.w, 120, P.crimsonD, P.crimson, P.ink2, 90);
    for (let i = 0; i < 6; i++) { const x = 42 + i * 108; cel(ctx, x, 54, 18, 27, P.amberD, P.amber, P.deskD); glow(ctx, x + 9, 66, [48, 27], P.amber, 0.08); }
    X.rect(ctx, 0, 258, V.w, 102, P.ink);
    glow(ctx, 426, 180, [150, 96, 54], P.amber, 0.07);
    cel(ctx, 195, 198, 450, 66, P.bone, P.white, P.putty);
    for (let x = 207; x < 640; x += 30) X.rect(ctx, x, 249, U, 12, P.putty2);
    cel(ctx, 420, 159, 12, 39, P.bone, P.white, P.putty2); X.rect(ctx, 423, 150, 6, 9, P.amber); X.rect(ctx, 424, 147, U, U, P.white);
    for (const x of [333, 507]) blit(ctx, GLASS, x, 168);
    cel(ctx, 447, 210, 117, 30, P.bone, P.white, P.plastic); cel(ctx, 468, 213, 66, 18, P.deskD, P.desk, P.ink2); X.rect(ctx, 474, 219, 12, U, P.desk2);
    if (!(o && o.skip === 'envelope')) envelope(ctx, ENV.x);
  }

  // Home at night: the kitchen table, the phone, and whatever came in the mail.
  function kitchen(ctx, day, o, S) {
    if (hasA('kitchen')) {
      aArt(ctx, 'kitchen', 'room'); aArt(ctx, 'kitchen', 'window:' + SEASON(day));
      if (o.phone) aArt(ctx, 'kitchen', 'phone');
      if (o.doc) { aArt(ctx, 'kitchen', 'doc'); R.text(ctx, o.doc[0], 374, 175, P.ink, 'center'); R.text(ctx, o.doc[1], 374, 193, P.crimsonD, 'center'); }
      if (o.postcard) {
        const pet = S && S.wallet && S.wallet.pet ? S.wallet.pet.name.toUpperCase() : 'YOUR PET';
        aArt(ctx, 'kitchen', 'postcard'); R.text(ctx, pet, 397, 175, P.ink, 'center'); R.text(ctx, 'CHECKUP DUE', 397, 190, P.crimsonD, 'center');
      }
      if (o.phone) R.text(ctx, o.phone, 517, 183, P.phosphor, 'center');
      aArt(ctx, 'kitchen', o.postcard ? 'mug:b' : 'mug:a');
      return;
    }
    X.gradient(ctx, 0, 0, V.w, 240, P.slate, P.ink2, 8);
    cityWindow(ctx, 396, 30, 204, 126, day, true, true);
    for (let i = 0; i < 4; i++) { cel(ctx, 27 + i * 81, 36, 78, 57, P.plasticD, P.plastic, P.ink2); X.rect(ctx, 93 + i * 81, 60, U, 12, P.grey2); }
    // The fridge, with magnets.
    cel(ctx, 27, 111, 105, 156, P.plastic2, P.white, P.plastic); X.rect(ctx, 30, 168, 99, U, P.plasticD); X.rect(ctx, 114, 132, U, 24, P.grey); X.rect(ctx, 114, 186, U, 30, P.grey);
    for (const [mx, my, mc] of [[45, 126, P.crimson], [72, 144, P.sky], [96, 123, P.jade]]) cel(ctx, mx, my, 12, 12, mc, P.white, null);
    boards(ctx, 222, P.deskD);
    cel(ctx, 168, 204, 474, 30, P.desk, P.desk2, P.deskD); X.rect(ctx, 186, 234, 9, 42, P.ink2); X.rect(ctx, 612, 234, 9, 42, P.ink2);
    if (o.phone) glow(ctx, 516, 180, [120, 72, 39], P.screenGlow, 0.08);
    if (o.doc) {
      cel(ctx, 297, 168, 159, 45, P.bone, P.white, P.putty2);
      R.text(ctx, o.doc[0], 376, 177, P.ink, 'center'); R.text(ctx, o.doc[1], 376, 195, P.crimsonD, 'center');
    }
    if (o.postcard) { // the vet's reminder, face up on the table, with a cartoon cross
      const pet = S && S.wallet && S.wallet.pet ? S.wallet.pet.name.toUpperCase() : 'YOUR PET';
      cel(ctx, 312, 165, 132, 45, P.bone, P.white, P.putty2); cel(ctx, PHOTO_OLD.x, PHOTO_OLD.y, PHOTO_OLD.w, PHOTO_OLD.h, P.sky, P.white, P.slate2);
      X.rect(ctx, 327, 184, 18, U, P.crimson); X.rect(ctx, 334, 177, U, 18, P.crimson);
      R.text(ctx, pet, 399, 177, P.ink, 'center'); R.text(ctx, 'CHECKUP DUE', 399, 192, P.crimsonD, 'center');
    }
    if (o.phone) {
      cel(ctx, 477, 165, 78, 45, P.ink, P.slate2, P.ink2); X.rect(ctx, 486, 174, 60, 27, P.screenGlow);
      R.text(ctx, o.phone, 516, 182, P.phosphor, 'center');
    }
    blit(ctx, MUG, o.postcard ? 471 : 420, 180);
  }

  // A voicemail, played back in the dark.
  // The 26 waveform bars of the voicemail: i, x, y, w, h.
  function waveBars() {
    const out = [];
    const d = hasA('voicemail') ? 2 : 0; // the art's bars are on the cell grid: 2 px up and left of the code's
    for (let i = 0; i < 26; i++) { const h = 6 + ((i * 37 + 11) % 30); out.push({ i, x: 249 - d + i * 6, y: 150 - d - Math.round(h / 2 / U) * U, w: U, h: Math.round(h / U) * U }); }
    return out;
  }
  function voicemail(ctx, day, o) {
    if (hasA('voicemail')) {
      aArt(ctx, 'voicemail', 'room');
      big(ctx, o.who || 'UNKNOWN', 321, 72, P.bone, 2, 'center'); R.text(ctx, 'VOICEMAIL', 321, 48, P.grey2, 'center');
      R.text(ctx, '0:12', 252, 177, P.phosphor); R.text(ctx, o.len || '0:30', 390, 177, P.grey2, 'right');
      return;
    }
    X.gradient(ctx, 0, 0, V.w, 300, P.ink2, P.ink, 8);
    glow(ctx, 321, 150, [210, 150, 99], P.screenGlow, 0.07);
    cel(ctx, 228, 18, 186, 258, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 240, 36, 162, 228, P.screen); cel(ctx, 300, 24, 42, 9, P.ink, P.slate, P.ink);
    R.text(ctx, 'VOICEMAIL', 321, 48, P.grey2, 'center');
    big(ctx, o.who || 'UNKNOWN', 321, 72, P.bone, 2, 'center');
    for (const b of waveBars()) X.rect(ctx, b.x, b.y, b.w, b.h, b.i < 9 ? P.phosphor : P.slate2);
    R.text(ctx, '0:12', 252, 177, P.phosphor); R.text(ctx, o.len || '0:30', 390, 177, P.grey2, 'right');
    cel(ctx, 300, 198, 42, 42, P.phosphorD, P.phosphor, P.jadeD); X.rect(ctx, 315, 210, U, 18, P.bone); X.rect(ctx, 318, 213, U, 12, P.bone); X.rect(ctx, 321, 216, U, 6, P.bone);
  }

  // Kennel k of the shelter: its box, and the pet in it (cat in 1, dog in 2) with the sprite rows and where they are drawn.
  function kennel(k) {
    const x = 225 + k * 102, y = 102, kind = k === 1 ? 'cat' : k === 2 ? 'dog' : null, SB = B.Storyboard;
    const out = { k, x, y, kind, rows: null, px: 0, py: 0 };
    if (kind && SB && SB.PET) { out.rows = SB.petRows({ kind, sex: 'boy' }, true); const sp = X.sprite(out.rows); out.px = x + 48 - Math.round(sp.w * U / 2); out.py = y + 132 - sp.h * U; }
    return out;
  }
  // The pets from their sprite grids: the cat at cell 116,69 and the dog at 148,67 (bottom-centre of kennels 1 and 2; the grid header's 84 and 118 are off by one kennel) (frames rest|breathe, rest|wag).
  function shelterPets(ctx, cat, dog) { aSpr(ctx, 'shelter-cat', cat, 116, 69); aSpr(ctx, 'shelter-dog', dog, 148, 67); }
  // part: 'back' is everything but the four wire meshes, 'front' is only the meshes.
  function shelter(ctx, day, o) {
    const part = o && o.part;
    if (hasA('shelter')) {
      if (part !== 'front') {
        aArt(ctx, 'shelter', 'back');
        R.text(ctx, 'ADOPT, DON\'T SHOP', 102, 48, P.white, 'center');
        R.text(ctx, 'OPEN LATE MONDAYS', 102, 78, P.ink, 'center'); R.text(ctx, 'NOBODY ADOPTS IN', 102, 93, P.crimsonD, 'center'); R.text(ctx, 'A CRASH. PROVE US', 102, 102, P.crimsonD, 'center'); R.text(ctx, 'WRONG.', 102, 111, P.crimsonD, 'center');
        for (let k = 0; k < 4; k++) { const kind = k === 1 ? 'cat' : k === 2 ? 'dog' : null; R.text(ctx, kind ? (kind === 'cat' ? 'CAT' : 'DOG') : 'EMPTY', 273 + 102 * k, 88, kind ? P.ink : P.grey, 'center'); }
        if (!part) shelterPets(ctx, 'rest', 'rest');
      }
      if (part !== 'back') aArt(ctx, 'shelter', 'front');
      return;
    }
    if (part !== 'front') {
      X.gradient(ctx, 0, 0, V.w, 246, P.putty2, P.putty, 8);
      cel(ctx, 27, 30, 150, 90, P.bone, P.white, P.putty2); cel(ctx, 36, 39, 132, 27, P.jadeD, P.jade, P.ink2);
      R.text(ctx, 'ADOPT, DON\'T SHOP', 102, 47, P.white, 'center');
      R.text(ctx, 'OPEN LATE MONDAYS', 102, 78, P.ink, 'center'); R.text(ctx, 'NOBODY ADOPTS IN', 102, 93, P.crimsonD, 'center'); R.text(ctx, 'A CRASH. PROVE US', 102, 102, P.crimsonD, 'center'); R.text(ctx, 'WRONG.', 102, 111, P.crimsonD, 'center');
      boards(ctx, 246, P.desk);
    }
    for (let k = 0; k < 4; k++) {
      const g = kennel(k), x = g.x, y = g.y;
      if (part !== 'front') {
        cel(ctx, x, y, 96, 144, P.plasticD, P.plastic, P.ink2); X.rect(ctx, x + 6, y + 6, 84, 132, P.slate);
        if (g.rows) blit(ctx, g.rows, g.px, g.py);
        else cel(ctx, x + 24, y + 114, 30, 15, P.crimsonD, P.crimson, P.ink2);
      }
      if (part !== 'back') {
        ctx.save(); ctx.globalAlpha = 0.5;
        for (let yy = y + 9; yy < y + 138; yy += 9) for (let xx = x + 9 + ((yy / 9) % 2) * 4; xx < x + 90; xx += 9) X.rect(ctx, xx, yy, U, U, P.grey2);
        ctx.restore();
      }
      if (part !== 'front') {
        cel(ctx, x + 27, y - 18, 42, 15, P.bone, P.white, P.putty2);
        R.text(ctx, g.kind ? (g.kind === 'cat' ? 'CAT' : 'DOG') : 'EMPTY', x + 48, y - 14, g.kind ? P.ink : P.grey, 'center');
      }
    }
  }

  // The dentist's chair or the vet's table, with tonight's bill.
  // part: 'back' is the room to the exam light (the dentist's lamp, the vet's tube) without that light's rings, 'front' the rest;
  // the vet's ceiling rings and the dentist's lamp rings are drawn between by the animate (clinicGlow).
  function clinicGlow(ctx, vet, stage) { // stage 1: the inner ring, 2: both
    if (hasA('clinic')) { const k = vet ? 'vet' : 'dentist'; aArt(ctx, 'clinic', 'glow:' + k + ':1'); if (stage > 1) aArt(ctx, 'clinic', 'glow:' + k + ':2'); return; }
    if (vet) glow(ctx, 318, 18, stage === 1 ? [120] : [180, 120], P.white, 0.05);
    else glow(ctx, 468, 120, stage === 1 ? [54] : [90, 54], P.white, 0.08);
  }
  function clinic(ctx, day, o, part) {
    const vet = o.kind === 'vet', back = part !== 'front', front = part !== 'back';
    if (hasA('clinic')) {
      const k = vet ? 'vet' : 'dentist';
      if (back) {
        aArt(ctx, 'clinic', 'back:' + k);
        if (!part) { clinicGlow(ctx, vet, 2); } // the whole room is lit
      }
      if (front) {
        aArt(ctx, 'clinic', 'front:' + k);
        if (vet) { R.text(ctx, '4.2', 604, 229, P.phosphor, 'center'); R.text(ctx, 'GENTLE HANDS', 429, 51, P.ink, 'center'); }
        R.text(ctx, vet ? 'AFTER HOURS' : 'EMERGENCY', 315, 216, P.ink, 'center');
        big(ctx, o.bill || '', 315, 234, P.crimsonD, 2, 'center');
      }
      return;
    }
    if (back) {
      X.gradient(ctx, 0, 0, V.w, 246, vet ? P.carpet2 : P.phosphorD, vet ? P.carpet : P.jadeD, 9);
      X.rect(ctx, 0, 246, V.w, 114, P.bone); for (let y = 249; y < 360; y += 18) for (let x = ((y / 18) % 2) * 18; x < V.w; x += 36) X.rect(ctx, x, y, 18, 18, P.putty2);
      X.rect(ctx, 0, 246, V.w, U, P.ink2);
      cel(ctx, 258, 12, 120, 12, P.bone, P.white, P.putty);
      if (!(vet && part)) glow(ctx, 318, 18, [180, 120], P.white, 0.05);
    }
    if (vet) {
      if (front) {
        // Exam table, scale, a poster of the right way to hold a cat.
        cel(ctx, 348, 180, 216, 18, P.grey2, P.white, P.grey); X.rect(ctx, 447, 198, 18, 60, P.grey); cel(ctx, 414, 252, 84, 9, P.grey, P.grey2, P.slate2);
        cel(ctx, 582, 219, 45, 36, P.plastic, P.plastic2, P.plasticD); X.rect(ctx, 594, 228, 21, 9, P.screen); R.text(ctx, '4.2', 604, 229, P.phosphor, 'center');
        cel(ctx, 378, 42, 105, 102, P.bone, P.white, P.putty2);
        const rows = B.Storyboard && B.Storyboard.petRows ? B.Storyboard.petRows({ kind: 'cat', sex: 'girl' }, true) : null;
        if (rows) blit(ctx, rows, 407, 69, 3);
        R.text(ctx, 'GENTLE HANDS', 430, 51, P.ink, 'center');
      }
    } else {
      if (back) {
        // The chair, the lamp on its arm, the tray.
        cel(ctx, 369, 96, 12, 90, P.grey, P.grey2, P.slate2); cel(ctx, 369, 84, 96, 12, P.grey, P.grey2, P.slate2);
        cel(ctx, 444, 72, 48, 27, P.bone, P.white, P.putty2); if (!part) glow(ctx, 468, 120, [90, 54], P.white, 0.08);
      }
      if (front) {
        cel(ctx, 402, 168, 66, 30, P.jade, P.phosphor, P.jadeD); cel(ctx, 453, 186, 138, 27, P.jade, P.phosphor, P.jadeD);
        cel(ctx, 390, 141, 42, 42, P.jade, P.phosphor, P.jadeD); X.rect(ctx, 516, 213, 18, 45, P.grey); cel(ctx, 477, 252, 96, 9, P.grey, P.grey2, P.slate2);
        cel(ctx, 564, 132, 60, 12, P.grey2, P.white, P.grey); for (let i = 0; i < 4; i++) X.rect(ctx, 570 + i * 12, 126, U, 6, P.grey);
      }
    }
    if (front) {
      cel(ctx, 267, 207, 96, 54, P.bone, P.white, P.putty2);
      R.text(ctx, vet ? 'AFTER HOURS' : 'EMERGENCY', 315, 216, P.ink, 'center');
      big(ctx, o.bill || '', 315, 234, P.crimsonD, 2, 'center');
    }
  }

  // o (optional, for the layered beats; absent, the room is drawn whole as it always was): noGrain leaves out the final scanlines (a layer of their own),
  // part 'back' / 'front' draws one half of a split room (the back half starts with the ink behind the room), skip names the one prop the animate draws:
  // 'chair' (hearing), 'count' (the YEAS number on the vote board), 'envelope' (dinner), 'cells' (the lit windows of the treasury).
  function room(ctx, id, day, after, S, o) {
    const [r, ropt] = ROOMS[id] || ['office'], opt = ropt || {};
    if (!(o && (o.part === 'front' || o.part === 'glow'))) X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    if (r === 'office') office(ctx, day, !!opt.night, o);
    else if (r === 'hearing') hearing(ctx, day, false, false, o);
    else if (r === 'vote') hearing(ctx, day, true, !!(after && S && S.f && S.f.billPassed), o);
    else if (r === 'treasury') treasury(ctx, day, o);
    else if (r === 'stairwell') stairwell(ctx, day);
    else if (r === 'racks') racks(ctx, day, after && S && S.f && S.f.pulledPlug);
    else if (r === 'lobby') lobby(ctx, day, o);
    else if (r === 'dinner') dinner(ctx, day, o);
    else if (r === 'kitchen') kitchen(ctx, day, opt, S);
    else if (r === 'voicemail') voicemail(ctx, day, opt);
    else if (r === 'shelter') shelter(ctx, day, o);
    else if (r === 'clinic') clinic(ctx, day, opt, o && o.part);
    if (!(o && o.noGrain)) X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.04);
  }
  // The portrait's own space, 240 px square from (40, 46): a drawn 80x80 face at 3x, a procedural 48x48 one at 5x.
  function speakerSpace(ctx, fn, x, name) {
    const k = Math.max(1, Math.floor(240 / (name && B.Portraits ? B.Portraits.size(name) : 48)));
    ctx.save(); ctx.translate(x == null ? 40 : x, 46); ctx.scale(k, k); fn(ctx); ctx.restore();
  }
  // The speaker, standing in the room at 5x: a medium close-up, feet out of shot.
  // night: the room is after dark, so the face steps one key down with it.
  function speaker(ctx, name, x, night) {
    if (!B.Portraits || !B.Portraits.has(name)) return false;
    speakerSpace(ctx, (s) => {
      B.Portraits.paint(s, name, { bare: true, night });
      // A drawn face is cut at the chest; its torso is authored art (torso/<name>, 120x32 cells) that picks up the last row and runs out of shot.
      // The landlord's screen stands on its own foot, so it is left as drawn.
      if (!B.Portraits.drawn(name) || (B.Portraits.CAST[name] || {}).screen) return;
      const sp = B.Portraits.sprite(name, { night }), k = Math.max(1, Math.floor(240 / sp.h));
      const below = Math.ceil((V.h - 46) / k) - sp.h;
      const tid = 'torso/' + (B.Portraits.SLUG[name] || '');
      if (B.Art && B.Art.has(tid)) { X.drawArt(s, tid, night ? 'night' : 'day', -20, sp.h); return; }
      // no torso art: a clean crop, the last row dropped straight down and one ink band at the foot, no stretch
      const row = sp.rows[sp.h - 1], key = (i) => B.PalKeys[row[i]];
      for (let i = 0; i < row.length; i++) { const col = key(i); if (col) { s.fillStyle = col; s.fillRect(i, sp.h, 1, below); } }
      s.fillStyle = P.ink; s.fillRect(-20, sp.h + below - 2, 120, 2);
    }, x, name);
    return true;
  }
  function dim(ctx, a) { ctx.save(); ctx.globalAlpha = a; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }

  // ---- the layered beats (stage 3, batch 7) ----
  // roomLayers(id, day, after, S, phase) and faceLayers(id, day, S, name) return { camera, cues, layers } for B.Motion.layered, or null (the beat stays flat).
  // phase: 'room' (the decision's room beat, 1.5 s), 'establish' (the news establish that borrows the room, 1.7 s), 'whip' (the weekend's whip, 1.6 s).
  // Every layer is the flat room() split into cached parts (noGrain, the scanlines in a layer of their own on top) with the moving things drawn above.
  const TILT = () => B.MotionKit.settle(6, B.Motion.ease.inOut);
  const PHASE_DUR = { room: 1.5, establish: 1.7, whip: 1.6, '317': 1.6, after: 2.2 };
  const LAYER = {};
  // ---- shot 1 and 2: Kroll's office ----
  // By day: his screen switches on at 0.45 s (dark, the phosphor line, one flare, then the lit screen of the cached picture).
  // At night (split around the lamplight): the desk lamp clicks on at 0.45 s and the pool of light spreads at 0.60 s.
  const LAMP_OFF = LAMP.map((r) => r.replace(/a/g, 'A'));
  LAYER.office = (e, flat, grain) => {
    const K = e.K;
    if (B.Art && B.Art.has(OFFICE)) {
      const m = OFFICE_SCREEN;
      if (!e.opt.night) return { layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) { K.crt(g, m.x, m.y, m.w, m.h, t, { mode: 'on', at: 0.45, bg: P.screenD }); } }, grain] };
      // At night the lamp clicks on at 0.45 s with the first pool of light, and the light spreads at 0.60 s.
      return {
        cues: [{ at: 0.45, sfx: 'click' }],
        layers: [
          { id: 'room', depth: 1, draw: flat({ part: 'back' }) },
          { id: 'front', depth: 1, draw: flat({ part: 'front' }), animate(g, v, t) { if (t < 0.45) art(g, 'lamp:off'); else { art(g, 'lamp:on'); art(g, 'glow:1'); if (t >= 0.60) art(g, 'glow:2'); } } },
          grain
        ]
      };
    }
    if (!e.opt.night) return { layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) { K.crt(g, 564, 165, 51, 33, t, { mode: 'on', at: 0.45, bg: P.screenD }); } }, grain] };
    return {
      cues: [{ at: 0.45, sfx: 'click' }],
      layers: [
        { id: 'room', depth: 1, draw: flat({ part: 'back' }) },
        // the three rings are line 94 of the flat room in its own order: the inner ring alone first, then all three
        { id: 'mid', depth: 1, draw() {}, animate(g, v, t) { if (t >= 0.60) glow(g, 402, 184, [150, 96, 51], P.amber, 0.07); else if (t >= 0.45) glow(g, 402, 184, [51], P.amber, 0.07); } },
        { id: 'front', depth: 1, draw: flat({ part: 'front' }), animate(g, v, t) { if (t < 0.45) blit(g, LAMP_OFF, 381, 150); } },
        grain
      ]
    };
  };

  // ---- shot 3: the hearing (the chair leans to his microphone, the LIVE light blinks) ----
  LAYER.hearing = (e, flat, grain) => {
    const K = e.K, chair = senatorRows(3);
    return {
      layers: [{
        id: 'room', depth: 1, draw: flat({ skip: 'chair' }),
        animate(g, v, t) {
          const lean = t >= 0.50 && t < 1.10, ART = hasA('hearing');
          if (ART) aSpr(g, 'hearing-chair', 'chair', 133 + (lean ? 1 : 0), 48 + (lean ? 2 : 0)); else blit(g, chair, 399 + (lean ? 3 : 0), 144 + (lean ? 6 : 0));
          // the committee board's screen (the interior of its cel, 441,45,168x42; the art's is 439,43) refreshes once at 0.40 s: the key movement; the LIVE light stays background life
          if (ART) e.K.crt(g, 439, 43, 168, 42, t, { mode: 'roll', at: 0.40, dur: 0.36 }); else e.K.crt(g, 441, 45, 168, 42, t, { mode: 'roll', at: 0.40, dur: 0.36 });
          if (t >= 0.30) K.blink(g, ...(ART ? [502, 67, 36, 9] : [504, 70, 37, 9]), t, { on: null, off: P.ink, period: 0.5, duty: 0.6, end: e.dur });
        }
      }, grain]
    };
  };
  // ---- shot 4: the vote (the tally board fills line by line while YEAS counts up to 214, or 218 when the bill passed) ----
  LAYER.vote = (e, flat, grain) => {
    const K = e.K;
    return {
      layers: [{
        id: 'room', depth: 1, draw: flat({ skip: 'count' }),
        animate(g, v, t) {
          const A = hasA('hearing'), cx = A ? 439 : 441, ys = A ? [64, 79, 103] : [66, 82, 105];
          if (t < 0.40) X.rect(g, cx, ys[0], 168, 12, P.ink);
          if (t < 1.00) X.rect(g, cx, ys[1], 168, 12, P.ink);
          if (t < 1.10) X.rect(g, cx, ys[2], 168, 12, P.ink);
          K.tally(g, A ? 601 : 603, A ? 67 : 69, t, { from: 180, to: voteYeas(e.after && e.S && e.S.f && e.S.f.billPassed), at: 0.40, dur: 0.55, fps: 15, fmt: String, col: P.jade, shadow: P.ink, align: 'right' });
        }
      }, grain]
    };
  };

  // ---- shot 5: the treasury (the five tall windows light one after another; the clock's colon ticks) ----
  LAYER.treasury = (e, flat, grain) => {
    const K = e.K, A = hasA('treasury'), wins = A ? [0, 1, 2, 3, 4].map((i) => treasuryArtCells().filter((c) => c.i === i)) : [0, 1, 2, 3, 4].map((i) => cityCells(246 + 78 * i, 30, 54, 138, e.day + i));
    return {
      // split around the lamplight rings, which sit over the windows in the flat room: the cells are drawn under them, so the lit pixels are the art's exactly
      layers: [{
        id: 'room', depth: 1, draw: flat({ skip: 'cells', part: 'back' }),
        animate(g, v, t) {
          wins.forEach((cells, i) => K.lamps(g, cells, t, { at: 0.40 + 0.12 * i, step: 0, on: P.amber }));
          // the colon of '2:14' (art x 28-29 at 2x, plus its shadow) on the clock face's flat bone
          K.blink(g, ...(A ? [55, 58] : [56, 60]), 6, 12, t, { on: null, off: P.bone, period: 1.0, duty: 0.5, end: e.dur });
        }
      }, { id: 'mid', depth: 1, draw: flat({ part: 'glow' }) }, { id: 'front', depth: 1, draw: flat({ part: 'front' }) }, grain]
    };
  };
  // ---- shot 6: the stairwell (the EXIT sign stutters) ----
  const EXIT_SPANS = [[0.45, 0.50], [0.56, 0.74], [0.80, 0.84], [1.00, 1.06]];
  LAYER.stairwell = (e, flat, grain) => {
    const K = e.K;
    return { layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) {
      K.flicker(g, 54, 36, 102, 42, 'decision:c9:exit', t, { spans: EXIT_SPANS, col: P.ink, a: 0.45 });
      K.flicker(g, 30, 6, 150, 102, 'decision:c9:exit', t, { spans: EXIT_SPANS, col: P.ink, a: 0.10 });
    } }, grain] };
  };
  // ---- shot 7: the racks (a pulse runs left to right along the front row) ----
  // The weekend's 3:17 with the plug pulled (phase '317', after): the dark racks have no LEDs, so the animate draws each LED lit, full brightness over the dim, until its rack dies:
  // the front row (r 1) rack i at 0.40 + 0.10 i, the back row (r 0) rack i at 0.45 + 0.10 i, from the red switch to the right in hard steps; no camera, a click as the first one goes.
  let LEDS_C = null;
  const LEDS = { forEach(fn) { (LEDS_C || (LEDS_C = rackLeds())).forEach(fn); } };
  const RACK_DEATH = (L) => (L.r ? 0.40 : 0.45) + 0.10 * L.i;
  // The ending's after beat with the plug pulled (phase 'after', 2.2 s, no camera): the dark rack room and one amber standby light on the first front rack's top panel
  // (art x 183-188, y 39-44, over the panel's flat screenD strip) with its halo, blinking at the standby rate and on at the end of the beat ("for now").
  const standbyOn = (t, dur) => (((dur - t) % 1.0) + 1.0) % 1.0 < 0.5;
  LAYER.racks = (e, flat, grain) => e.after && e.S && e.S.f && e.S.f.pulledPlug && e.phase === 'after' ? ({
    camera: null,
    layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) {
      if (t < 0.40) return;
      const a = hasA('racks');
      if (standbyOn(t, e.dur)) glow(g, a ? 187 : 186, a ? 43 : 42, [21, 12], P.amber, 0.12);
      e.K.blink(g, a ? 184 : 183, a ? 40 : 39, 6, 6, t, { on: P.amber, period: 1.0, duty: 0.5, end: e.dur });
    } }, grain]
  }) : e.after && e.S && e.S.f && e.S.f.pulledPlug && e.phase === '317' ? ({
    camera: null, cues: [{ at: 0.40, sfx: 'click' }],
    layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) { const a = hasA('racks'); LEDS.forEach((L) => { if (t < RACK_DEATH(L)) X.rect(g, a ? Math.round((L.x + 2) / U) * U - 2 : L.x, a ? Math.round((L.y + 2) / U) * U - 2 : L.y, L.w, L.h, L.col); }); } }, grain]
  }) : ({ layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) {
    for (let i = 0; i < 7; i++) {
      if (!(t >= 0.40 + 0.09 * i && t < 0.52 + 0.09 * i)) continue;
      g.save(); g.globalAlpha = 0.45;
      for (let sy = 9; sy < 213; sy += 12) X.rect(g, (hasA('racks') ? 178 : 177) + 69 * i + 6, (hasA('racks') ? 31 : 30) + sy, 42, 6, P.phosphorD);
      g.restore();
    }
  } }, grain] });

  // ---- shot 8: the lobby (the management screen's smiley blinks twice) ----
  LAYER.lobby = (e, flat, grain) => ({
    layers: [
      { id: 'room', depth: 1, draw: flat({ part: 'back' }) },
      { id: 'mid', depth: 1, draw() {}, animate(g, v, t) { lobbyEyes(g, (t >= 0.55 && t < 0.67) || (t >= 0.80 && t < 0.92)); } },
      { id: 'front', depth: 1, draw: flat({ part: 'front' }) },
      grain
    ]
  });
  // ---- shot 9: the dinner (the $8,000 envelope slides 36 px across the cloth to you) ----
  LAYER.dinner = (e, flat, grain) => ({
    layers: [{ id: 'room', depth: 1, draw: flat({ skip: 'envelope' }), animate(g, v, t) { envelope(g, ENV.x + 3 * Math.round(12 * (1 - e.M.ease.out(e.K.span(t, 0.40, 0.85))))); } }, grain]
  });
  // ---- shots 10 and 11: the kitchen (the phone rings twice; the postcard's photo blinks under a paper cover) ----
  LAYER.kitchen = (e, flat, grain) => {
    const K = e.K;
    if (e.opt.phone) return { cues: [{ at: 0.40, sfx: 'ring' }], layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) { K.flicker(g, ...(hasA('kitchen') ? [478, 166] : [477, 165]), 78, 45, 'decision:phone', t, { spans: [[0.40, 0.60], [0.90, 1.10]], col: P.phosphor, a: 0.30 }); } }, grain] };
    if (e.opt.postcard) return { layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) { if (t >= 0.30) K.blink(g, photo().x, photo().y, photo().w, photo().h, t, { on: null, off: P.bone, period: 0.5, duty: 0.6, end: e.dur }); } }, grain] };
    return null;
  };

  // ---- shot 12: the voicemail (playback lights bars 3 to 8; the play button blinks) ----
  LAYER.voicemail = (e, flat, grain) => {
    const K = e.K, cells = waveBars().slice(3, 9);
    return { layers: [{ id: 'room', depth: 1, draw: flat(), animate(g, v, t) {
      K.lamps(g, cells, t, { at: 0.40, step: 0.10, on: P.phosphor, off: P.slate2 });
      if (t >= 0.30) K.blink(g, ...(hasA('voicemail') ? [313, 208] : [315, 210]), 9, 18, t, { on: null, off: P.phosphorD, period: 0.5, duty: 0.6, end: e.dur });
    } }, grain] };
  };
  // ---- shot 13: the shelter (the light over the two empty kennels stutters; the cat breathes, the dog wags) ----
  LAYER.shelter = (e, flat, grain) => {
    const K = e.K, cat = kennel(1), dog = kennel(2), upper = cat.rows ? cat.rows.slice(0, 13) : null;
    // the dog's tail (sprite columns 16-18, rows 8-11) one cell to the right
    const tail = dog.rows ? dog.rows.slice(8, 12).map((r) => '.'.repeat(17) + r.slice(16, 19) + '.') : null;
    const spans = [[0.45, 0.52], [0.60, 0.78], [0.86, 0.90]];
    return {
      layers: [
        { id: 'room', depth: 1, draw: flat({ part: 'back' }) },
        {
          id: 'mid', depth: 1, draw() {},
          animate(g, v, t) {
            if (hasA('shelter')) { shelterPets(g, t >= 0.70 && t < 1.50 ? 'breathe' : 'rest', t >= 0.80 && t < 1.30 && Math.floor(t * 6) % 2 === 1 ? 'wag' : 'rest'); return; }
            // life: the cat's upper 13 rows 3 px higher for one breath; the dog's tail flicks on odd poses (6 a second)
            if (upper && t >= 0.70 && t < 1.50) blit(g, upper, cat.px, cat.py - U);
            if (tail && t >= 0.80 && t < 1.30 && Math.floor(t * 6) % 2 === 1) { X.rect(g, dog.px + 48, dog.py + 24, 9, 12, P.slate); blit(g, tail, dog.px, dog.py + 24); }
          }
        },
        {
          id: 'front', depth: 1, draw: flat({ part: 'front' }),
          animate(g, v, t) {
            const A = hasA('shelter');
            K.flicker(g, A ? 229 : 231, A ? 106 : 108, 84, 132, 'decision:adopt:k0', t, { spans, col: P.ink, a: 0.35 });
            K.flicker(g, A ? 535 : 537, A ? 106 : 108, 84, 132, 'decision:adopt:k3', t, { spans: spans.map((p) => [p[0] + 0.12, p[1] + 0.12]), col: P.ink, a: 0.35 });
          }
        },
        grain
      ]
    };
  };
  // ---- shot 14: the clinic (the exam light switches on in two hard steps) ----
  LAYER.clinic = (e, flat, grain) => {
    const vet = e.opt.kind === 'vet';
    return {
      cues: [{ at: 0.45, sfx: 'click' }],
      layers: [
        { id: 'room', depth: 1, draw: flat({ part: 'back' }), animate(g, v, t) {
          if (t < 0.45) { const A = hasA('clinic'); if (vet) cel(g, A ? 256 : 258, A ? 10 : 12, 120, 12, P.grey, P.grey2, P.slate2); else cel(g, A ? 442 : 444, A ? 70 : 72, 48, 27, P.putty, P.putty2, P.plasticD); }
        } },
        { id: 'mid', depth: 1, draw() {}, animate(g, v, t) { if (t >= 0.60) clinicGlow(g, vet, 2); else if (t >= 0.45) clinicGlow(g, vet, 1); } },
        { id: 'front', depth: 1, draw: flat({ part: 'front' }) },
        grain
      ]
    };
  };

  function roomLayers(id, day, after, S, phase) {
    const M = B.Motion, K = B.MotionKit;
    if (!M || !M.layered || !K) return null;
    const kind = (ROOMS[id] || ['office'])[0], build = LAYER[kind];
    if (!build) return null;
    const opt = (ROOMS[id] || [])[1] || {};
    const env = { id, day, after, S, opt, dur: PHASE_DUR[phase] || 1.5, M, K, phase };
    const flat = (o) => (c) => room(c, id, day, after, S, Object.assign({ noGrain: true }, o));
    const grain = { id: 'grain', depth: 1, draw(c) { X.scanlines(c, 0, 0, V.w, V.h, P.ink, 0.04); } };
    const L = build(env, flat, grain);
    return L ? Object.assign({ camera: TILT() }, L) : null;
  }
  const isNight = (id) => !!((ROOMS[id] || [])[1] || {}).night;
  function faceLayers(id, day, S, name) {
    const M = B.Motion, K = B.MotionKit, night = isNight(id);
    if (!M || !M.layered || !K || !B.Portraits || !B.Portraits.has(name)) return null;
    // the room dimmed behind (depth 0.3), the speaker rising 12 px into frame from 0.30 to 0.80 s, one blink at 1.55 s (after the caption has typed)
    return {
      camera: K.rise(12, 2.1, 0.30, 0.80),
      layers: [
        { id: 'room', depth: 0.3, draw(c) { room(c, id, day, false, S); dim(c, 0.35); } },
        { id: 'speaker', depth: 1, draw(c) { speaker(c, name, 40, night); }, animate(g, v, t) { if (t >= 1.55 && t < 1.67) speakerSpace(g, (sp) => B.Portraits.paintEyes(sp, name, night), 40, name); } }
      ]
    };
  }

  B.Scenes.decision = function (o) {
    const id = o.id || 'c1', day = o.day || 0, name = o.speaker || '', S = o.S || null;
    const who = R.clean(name + (o.role ? ' · ' + o.role : '')).toUpperCase().slice(0, 88);
    const pet = S && S.wallet && S.wallet.pet ? `:${S.wallet.pet.name}` : '';
    const tag = `${id}:${Math.floor(day / 5)}${id === 'vetCheck' ? pet : ''}`;
    const L = (l, b) => (l ? B.Motion.layered(Object.assign({}, b, l)) : b);
    return [
      L(roomLayers(id, day, false, S, 'room'), R.beat('decision', `${tag}:room`, 1.5, (c) => room(c, id, day, false, S), who, { sfx: 'room', transition: 'fade' })),
      L(faceLayers(id, day, S, name), R.beat('decision', `${tag}:face`, 2.1, (c) => {
        room(c, id, day, false, S); dim(c, 0.35);
        if (!speaker(c, name, 40, isNight(id))) dim(c, 0.1);
      }, R.clean(o.title || '').toUpperCase(), { sfx: 'broadcast', informative: true }))
    ];
  };
  // V4.5: the room after the choice is a picture in the aftermath popup,
  // not a separate cutscene that repeated the popup's first sentence.
  function still(canvas, o) {
    if (!canvas || !canvas.getContext) return false;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    room(ctx, o.id || 'c1', o.day || 0, true, o.S || null);
    dim(ctx, 0.3);
    return true;
  }

  B.DecisionArt = { ROOMS, room, still, glow, cityCells, senator: senatorRows, lobbyEyes, waveBars, kennel, roomLayers, faceLayers, rackLeds, postcardPhoto: () => Object.assign({}, photo()) };
})(window.BTB);
