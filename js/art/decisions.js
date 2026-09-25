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
  function cityWindow(ctx, x, y, w, h, day, night, slats) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    R.sky(ctx, x, y, w, h, day, night ? P.ink : P.sky);
    for (let i = 0; i < Math.ceil(w / 27); i++) {
      const bw = 18 + ((i * 17 + day) % 9), bh = 30 + ((i * 41 + day * 7) % (h - 36)), bx = x + i * 27, by = y + h - bh;
      X.rect(ctx, bx, by, bw, bh, P.ink2); X.rect(ctx, bx, by, bw, U, i % 2 ? P.slate2 : P.slate); X.rect(ctx, bx + bw - U, by, U, bh, P.ink);
      if (night) for (let k = 9; k < bh - 6; k += 9) for (let j = 3; j < bw - 6; j += 6) if ((i * 5 + k + j + day) % 3 === 0) X.rect(ctx, bx + j, by + k, U, U, P.amber);
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

  // ---- rooms ----
  // Kroll's corner office, by day and after dark.
  function office(ctx, day, night) {
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
    if (night) glow(ctx, 402, 184, [150, 96, 51], P.amber, 0.07);
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
  function hearing(ctx, day, vote, passed) {
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
      blit(ctx, SENATOR.map((r) => r.replace(/s/g, ['2', '3', 'R', '2', 'J', '3', '2'][i]).replace(/5/g, i === 3 ? 'e' : ['e', 'D', '7', 'e', 'd', '7', 'D'][i])), x, 144);
      X.rect(ctx, x + 36, 162, U, 30, P.grey); X.rect(ctx, x + 33, 159, 9, U, P.ink2);
    }
    cel(ctx, -U, 192, V.w + 2 * U, 48, P.deskD, P.desk2, P.ink2);
    for (let i = 0; i < 7; i++) cel(ctx, 240 + i * 54, 204, 42, 15, P.bone, P.white, P.putty2);
    carpet(ctx, 240, P.carpetD, P.carpet);
    const tx = 426, ty = 30;
    if (vote) {
      cel(ctx, tx, ty, 198, 105, P.ink, P.slate2, P.ink2);
      R.text(ctx, 'STABILIZATION ACT', tx + 99, ty + 12, P.amber, 'center');
      X.rect(ctx, tx + 15, ty + 27, 168, U, P.slate);
      R.text(ctx, 'YEAS', tx + 21, ty + 39, P.jade); R.text(ctx, '214', tx + 177, ty + 39, P.jade, 'right');
      if (passed) { R.text(ctx, 'NEEDED', tx + 21, ty + 55, P.bone); R.text(ctx, '218', tx + 177, ty + 55, P.bone, 'right'); R.text(ctx, 'PASSED', tx + 99, ty + 78, P.jade, 'center'); }
      else { R.text(ctx, 'SHORT', tx + 21, ty + 55, P.crimson); R.text(ctx, '4', tx + 177, ty + 55, P.crimson, 'right'); R.text(ctx, 'NEEDED 218', tx + 99, ty + 78, P.bone, 'center'); }
    } else {
      cel(ctx, tx + 12, ty + 12, 174, 48, P.ink, P.slate2, P.ink2);
      R.text(ctx, 'MARKETS COMMITTEE', tx + 99, ty + 24, P.sky, 'center');
      X.rect(ctx, tx + 78, ty + 40, U * 2, U * 2, P.crimson); R.text(ctx, 'LIVE', tx + 90, ty + 40, P.crimson);
    }
  }

  // Treasury at 2:14 on a Sunday morning: every light on.
  function treasury(ctx, day) {
    X.gradient(ctx, 0, 0, V.w, 210, P.slate, P.ink2, 9);
    for (let i = 0; i < 5; i++) cityWindow(ctx, 246 + i * 78, 30, 54, 138, day + i, true, false);
    cel(ctx, 27, 27, 75, 75, P.plastic, P.plastic2, P.plasticD); cel(ctx, 36, 36, 57, 57, P.bone, P.white, P.putty2);
    big(ctx, '2:14', 65, 57, P.ink, 2, 'center');
    carpet(ctx, 210, P.carpetD, P.carpet);
    glow(ctx, 360, 150, [210, 150, 90], P.amber, 0.06);
    cel(ctx, 45, 198, 582, 21, P.desk, P.desk2, P.deskD); cel(ctx, 57, 216, 558, 36, P.deskD, P.desk, P.ink2);
    for (let i = 0; i < 9; i++) {
      cel(ctx, 240 + i * 42, 195, 33, 9, P.bone, P.white, P.putty2);
      if (i % 2) blit(ctx, MUG, 249 + i * 42, 177);
    }
    R.text(ctx, 'TREASURY · SUNDAY', 606, 258, P.amber, 'right');
  }

  // The stairwell on forty-one, where Imani waits with a folder.
  function stairwell(ctx, day) {
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
  function racks(ctx, day, dark) {
    X.gradient(ctx, 0, 0, V.w, 252, P.screenD, P.ink, 8);
    cel(ctx, 150, 6, 490, 15, P.slate, P.slate2, P.ink2); for (let x = 165; x < 640; x += 30) X.rect(ctx, x, 21, U, 12, P.slate);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      if (r === 0 && i > 5) continue;
      const k = r ? 1 : 0.72, w = Math.round(54 * k / U) * U, h = Math.round(222 * k / U) * U, x = r ? 177 + i * 69 : 228 + i * 51, y = 252 - h;
      cel(ctx, x, y, w, h, P.ink2, P.slate, P.ink);
      for (let s = 9; s < h - 9; s += Math.round(12 * k / U) * U || U) {
        X.rect(ctx, x + 6, y + s, w - 12, U * 2, P.screenD);
        if (!dark && (i * 7 + s + r) % 3) X.rect(ctx, x + 9 + ((i * 3 + s) % (w - 21)), y + s, U, U, (i + s) % 5 ? P.phosphor : P.sky);
      }
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

  // The lobby, where the building's model tells you rent is going up.
  function lobby(ctx, day) {
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
    cel(ctx, 147, 93, 21, 21, P.phosphor, P.white, P.phosphorD); cel(ctx, 216, 93, 21, 21, P.phosphor, P.white, P.phosphorD);
    X.rect(ctx, 150, 141, 84, U * 2, P.phosphor); X.rect(ctx, 144, 135, 9, 9, P.phosphor); X.rect(ctx, 231, 135, 9, 9, P.phosphor);
    X.scanlines(ctx, 99, 60, 186, 123, P.ink, 0.25);
    X.rect(ctx, 183, 207, 18, 36, P.plasticD); cel(ctx, 150, 240, 84, 12, P.plasticD, P.plastic, P.ink2);
    R.text(ctx, 'RENT +9% · CONGRATULATIONS', 192, 189, P.bone, 'center');
    // A checkerboard floor.
    for (let y = 258; y < 360; y += 18) for (let x = ((y / 18) % 2) * 18; x < V.w; x += 36) X.rect(ctx, x, y, 18, 18, P.slate2);
    X.rect(ctx, 0, 258, V.w, U, P.ink2);
  }

  // The steakhouse: good wine, a candle, and an $8,000 advance.
  function dinner(ctx, day) {
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
    cel(ctx, 246, 219, 114, 27, P.bone, P.white, P.plasticD); R.text(ctx, '$8,000', 303, 229, P.jadeD, 'center');
  }

  // Home at night: the kitchen table, the phone, and whatever came in the mail.
  function kitchen(ctx, day, o, S) {
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
      cel(ctx, 312, 165, 132, 45, P.bone, P.white, P.putty2); cel(ctx, 321, 171, 30, 30, P.sky, P.white, P.slate2);
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
  function voicemail(ctx, day, o) {
    X.gradient(ctx, 0, 0, V.w, 300, P.ink2, P.ink, 8);
    glow(ctx, 321, 150, [210, 150, 99], P.screenGlow, 0.07);
    cel(ctx, 228, 18, 186, 258, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 240, 36, 162, 228, P.screen); cel(ctx, 300, 24, 42, 9, P.ink, P.slate, P.ink);
    R.text(ctx, 'VOICEMAIL', 321, 48, P.grey2, 'center');
    big(ctx, o.who || 'UNKNOWN', 321, 72, P.bone, 2, 'center');
    for (let i = 0; i < 26; i++) { const h = 6 + ((i * 37 + 11) % 30); X.rect(ctx, 249 + i * 6, 150 - Math.round(h / 2 / U) * U, U, Math.round(h / U) * U, i < 9 ? P.phosphor : P.slate2); }
    R.text(ctx, '0:12', 252, 177, P.phosphor); R.text(ctx, o.len || '0:30', 390, 177, P.grey2, 'right');
    cel(ctx, 300, 198, 42, 42, P.phosphorD, P.phosphor, P.jadeD); X.rect(ctx, 315, 210, U, 18, P.bone); X.rect(ctx, 318, 213, U, 12, P.bone); X.rect(ctx, 321, 216, U, 6, P.bone);
  }

  // The shelter on your block: kennels, and the two who are still there.
  function shelter(ctx, day) {
    X.gradient(ctx, 0, 0, V.w, 246, P.putty2, P.putty, 8);
    cel(ctx, 27, 30, 150, 90, P.bone, P.white, P.putty2); cel(ctx, 36, 39, 132, 27, P.jadeD, P.jade, P.ink2);
    R.text(ctx, 'ADOPT, DON\'T SHOP', 102, 47, P.white, 'center');
    R.text(ctx, 'OPEN LATE MONDAYS', 102, 78, P.ink, 'center'); R.text(ctx, 'NOBODY ADOPTS IN', 102, 93, P.crimsonD, 'center'); R.text(ctx, 'A CRASH. PROVE US', 102, 102, P.crimsonD, 'center'); R.text(ctx, 'WRONG.', 102, 111, P.crimsonD, 'center');
    boards(ctx, 246, P.desk);
    const SB = B.Storyboard;
    for (let k = 0; k < 4; k++) {
      const x = 225 + k * 102, y = 102;
      cel(ctx, x, y, 96, 144, P.plasticD, P.plastic, P.ink2); X.rect(ctx, x + 6, y + 6, 84, 132, P.slate);
      const kind = k === 1 ? 'cat' : k === 2 ? 'dog' : null;
      if (kind && SB && SB.PET) { const rows = SB.petRows({ kind, sex: 'boy' }, true), sp = X.sprite(rows); blit(ctx, rows, x + 48 - Math.round(sp.w * U / 2), y + 132 - sp.h * U); }
      else cel(ctx, x + 24, y + 114, 30, 15, P.crimsonD, P.crimson, P.ink2);
      ctx.save(); ctx.globalAlpha = 0.5;
      for (let yy = y + 9; yy < y + 138; yy += 9) for (let xx = x + 9 + ((yy / 9) % 2) * 4; xx < x + 90; xx += 9) X.rect(ctx, xx, yy, U, U, P.grey2);
      ctx.restore();
      cel(ctx, x + 27, y - 18, 42, 15, P.bone, P.white, P.putty2);
      R.text(ctx, kind ? (kind === 'cat' ? 'CAT' : 'DOG') : 'EMPTY', x + 48, y - 14, kind ? P.ink : P.grey, 'center');
    }
  }

  // The dentist's chair or the vet's table, with tonight's bill.
  function clinic(ctx, day, o) {
    const vet = o.kind === 'vet';
    X.gradient(ctx, 0, 0, V.w, 246, vet ? P.carpet2 : P.phosphorD, vet ? P.carpet : P.jadeD, 9);
    X.rect(ctx, 0, 246, V.w, 114, P.bone); for (let y = 249; y < 360; y += 18) for (let x = ((y / 18) % 2) * 18; x < V.w; x += 36) X.rect(ctx, x, y, 18, 18, P.putty2);
    X.rect(ctx, 0, 246, V.w, U, P.ink2);
    cel(ctx, 258, 12, 120, 12, P.bone, P.white, P.putty); glow(ctx, 318, 18, [180, 120], P.white, 0.05);
    if (vet) {
      // Exam table, scale, a poster of the right way to hold a cat.
      cel(ctx, 348, 180, 216, 18, P.grey2, P.white, P.grey); X.rect(ctx, 447, 198, 18, 60, P.grey); cel(ctx, 414, 252, 84, 9, P.grey, P.grey2, P.slate2);
      cel(ctx, 582, 219, 45, 36, P.plastic, P.plastic2, P.plasticD); X.rect(ctx, 594, 228, 21, 9, P.screen); R.text(ctx, '4.2', 604, 229, P.phosphor, 'center');
      cel(ctx, 378, 42, 105, 102, P.bone, P.white, P.putty2);
      const rows = B.Storyboard && B.Storyboard.petRows ? B.Storyboard.petRows({ kind: 'cat', sex: 'girl' }, true) : null;
      if (rows) blit(ctx, rows, 407, 69, 3);
      R.text(ctx, 'GENTLE HANDS', 430, 51, P.ink, 'center');
    } else {
      // The chair, the lamp on its arm, the tray.
      cel(ctx, 369, 96, 12, 90, P.grey, P.grey2, P.slate2); cel(ctx, 369, 84, 96, 12, P.grey, P.grey2, P.slate2);
      cel(ctx, 444, 72, 48, 27, P.bone, P.white, P.putty2); glow(ctx, 468, 120, [90, 54], P.white, 0.08);
      cel(ctx, 402, 168, 66, 30, P.jade, P.phosphor, P.jadeD); cel(ctx, 453, 186, 138, 27, P.jade, P.phosphor, P.jadeD);
      cel(ctx, 390, 141, 42, 42, P.jade, P.phosphor, P.jadeD); X.rect(ctx, 516, 213, 18, 45, P.grey); cel(ctx, 477, 252, 96, 9, P.grey, P.grey2, P.slate2);
      cel(ctx, 564, 132, 60, 12, P.grey2, P.white, P.grey); for (let i = 0; i < 4; i++) X.rect(ctx, 570 + i * 12, 126, U, 6, P.grey);
    }
    cel(ctx, 267, 207, 96, 54, P.bone, P.white, P.putty2);
    R.text(ctx, vet ? 'AFTER HOURS' : 'EMERGENCY', 315, 216, P.ink, 'center');
    big(ctx, o.bill || '', 315, 234, P.crimsonD, 2, 'center');
  }

  function room(ctx, id, day, after, S) {
    const [r, o] = ROOMS[id] || ['office'], opt = o || {};
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    if (r === 'office') office(ctx, day, !!opt.night);
    else if (r === 'hearing') hearing(ctx, day, false);
    else if (r === 'vote') hearing(ctx, day, true, !!(after && S && S.f && S.f.billPassed));
    else if (r === 'treasury') treasury(ctx, day);
    else if (r === 'stairwell') stairwell(ctx, day);
    else if (r === 'racks') racks(ctx, day, after && S && S.f && S.f.pulledPlug);
    else if (r === 'lobby') lobby(ctx, day);
    else if (r === 'dinner') dinner(ctx, day);
    else if (r === 'kitchen') kitchen(ctx, day, opt, S);
    else if (r === 'voicemail') voicemail(ctx, day, opt);
    else if (r === 'shelter') shelter(ctx, day);
    else if (r === 'clinic') clinic(ctx, day, opt);
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.04);
  }
  // The speaker, standing in the room at 5x: a medium close-up, feet out of shot.
  function speaker(ctx, name, x) {
    if (!B.Portraits || !B.Portraits.has(name)) return false;
    ctx.save(); ctx.translate(x, 46); ctx.scale(5, 5); B.Portraits.paint(ctx, name, { bare: true }); ctx.restore();
    return true;
  }
  function dim(ctx, a) { ctx.save(); ctx.globalAlpha = a; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }

  B.Scenes.decision = function (o) {
    const id = o.id || 'c1', day = o.day || 0, name = o.speaker || '', S = o.S || null;
    const who = R.clean(name + (o.role ? ' · ' + o.role : '')).toUpperCase().slice(0, 88);
    const pet = S && S.wallet && S.wallet.pet ? `:${S.wallet.pet.name}` : '';
    const tag = `${id}:${Math.floor(day / 5)}${id === 'vetCheck' ? pet : ''}`;
    return [
      R.beat('decision', `${tag}:room`, 1.5, (c) => room(c, id, day, false, S), who, { sfx: 'room', transition: 'fade' }),
      R.beat('decision', `${tag}:face`, 2.1, (c) => {
        room(c, id, day, false, S); dim(c, 0.35);
        if (!speaker(c, name, 40)) dim(c, 0.1);
      }, R.clean(o.title || '').toUpperCase(), { sfx: 'broadcast', informative: true })
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

  B.DecisionArt = { ROOMS, room, still };
})(window.BTB);
