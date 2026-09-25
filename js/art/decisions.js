// V4.4 decision scenes. Every desk decision and every personal-money beat now
// opens on a room with the person asking: Kroll behind his glass, Thorne on
// the dais, Venn at Treasury at two in the morning, Imani in the stairwell,
// the rack room for Pull the Plug. The speaker's portrait (js/art/portraits.js)
// is painted at 5x straight into the scene. After you choose, one still of
// the same room plays under the first line of what happened.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal, R = B.Rhythm;
  if (!R) return;
  const V = R.view;

  // Which room each decision happens in. Ids are StoryData.CHOICES and B.Life.
  const ROOMS = {
    c1: 'office', c3: 'hearing', c5: 'treasury', c6: 'office', c7: 'officeNight', c8: 'vote', c9: 'stairwell', c10: 'racks',
    rentHike: 'lobby', advance: 'dinner', dadBill: 'call', perry: 'voicemail', pension: 'letter',
    adopt: 'lobby', dentist: 'voicemail', vetCheck: 'letter', toothache: 'call', vetER: 'call'
  };

  // ---- rooms (640x360; keep what matters above y=276, clear of the caption) ----
  function blinds(ctx, x, y, w, h, day, night) {
    X.inset(ctx, x, y, w, h, P.slate2, P.putty2, P.plasticD);
    const s = R.sky(ctx, x + 3, y + 3, w - 6, h - 6, day, night ? P.ink : P.sky);
    for (let i = 0; i < 7; i++) {
      const bh = 20 + ((i * 29 + day) % 60), bx = x + 6 + i * ((w - 12) / 7);
      X.rect(ctx, bx, y + h - 3 - bh, (w - 12) / 7 - 4, bh, P.slate);
      if (s.snow) X.rect(ctx, bx, y + h - 3 - bh, (w - 12) / 7 - 4, 2, P.bone);
      if (night) for (let k = 6; k < bh - 4; k += 9) X.rect(ctx, bx + 4 + (k % 7), y + h - 3 - bh + k, 3, 3, P.amber);
    }
    R.weather(ctx, x + 3, y + 3, w - 6, h - 30, day);
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let yy = y + 8; yy < y + h - 4; yy += 9) X.rect(ctx, x + 3, yy, w - 6, 2, P.putty2);
    ctx.restore();
  }
  function office(ctx, day, night) {
    X.rect(ctx, 0, 0, V.w, V.h, night ? P.ink2 : P.putty);
    X.gradient(ctx, 0, 0, V.w, 250, night ? P.slate : P.putty2, night ? P.ink2 : P.putty, 10);
    blinds(ctx, 300, 30, 300, 170, day, night);
    // A framed chart of the firm's best year, and the nameplate.
    X.plate(ctx, 190, 50, 84, 60, P.deskD, P.desk2, P.ink);
    X.rect(ctx, 196, 56, 72, 48, P.bone);
    for (let i = 0; i < 12; i++) X.rect(ctx, 200 + i * 5, 96 - i * 3, 4, 3, P.jade);
    X.rect(ctx, 0, 236, V.w, 124, night ? P.ink : P.carpetD);
    X.plate(ctx, 250, 214, 390, 56, P.deskD, P.desk2, P.ink);
    X.plate(ctx, 450, 196, 100, 18, P.bone, P.white, P.plasticD);
    R.text(ctx, 'D. KROLL', 500, 202, P.ink, 'center');
    if (night) {
      X.plate(ctx, 588, 150, 20, 64, P.slate, P.slate2, P.ink);
      X.rect(ctx, 574, 140, 48, 14, P.amber);
      ctx.save(); ctx.globalAlpha = 0.18; X.rect(ctx, 480, 150, 160, 70, P.amber); ctx.restore();
      for (let i = 0; i < 3; i++) X.plate(ctx, 300 + i * 30, 204 - i * 5, 90, 10, P.bone, P.white, P.plasticD);
    }
  }
  function hearing(ctx, day, vote, passed) {
    X.rect(ctx, 0, 0, V.w, V.h, P.deskD);
    X.gradient(ctx, 0, 0, V.w, 230, P.desk, P.deskD, 8);
    for (let i = 0; i < 9; i++) X.rect(ctx, 20 + i * 72, 16, 4, 200, P.desk2);
    // The seal and the dais.
    X.plate(ctx, 280, 26, 80, 80, P.slate, P.slate2, P.ink);
    X.rect(ctx, 296, 42, 48, 48, P.sky);
    X.rect(ctx, 308, 54, 24, 24, P.bone);
    X.rect(ctx, 316, 50, 8, 32, P.amberD);
    X.plate(ctx, 0, 200, V.w, 40, P.deskD, P.desk2, P.ink);
    for (let i = 0; i < 7; i++) {
      X.rect(ctx, 250 + i * 54, 164, 18, 36, P.ink2);
      X.rect(ctx, 254 + i * 54, 150, 10, 14, i === 3 ? P.desk2 : P.grey2);
      X.rect(ctx, 258 + i * 54, 188, 2, 14, P.grey);
    }
    X.rect(ctx, 0, 240, V.w, 120, P.carpetD);
    if (vote) {
      X.plate(ctx, 430, 40, 190, 96, P.ink, P.slate2, P.ink2);
      R.text(ctx, 'STABILIZATION ACT', 525, 50, P.amber, 'center');
      X.rect(ctx, 446, 66, 158, 1, P.slate);
      R.text(ctx, 'YEAS', 470, 78, P.jade); R.text(ctx, '214', 590, 78, P.jade, 'right');
      if (passed) { R.text(ctx, 'NEEDED', 470, 94, P.bone); R.text(ctx, '218', 590, 94, P.bone, 'right'); R.text(ctx, 'PASSED', 525, 116, P.jade, 'center'); }
      else { R.text(ctx, 'SHORT', 470, 94, P.crimson); R.text(ctx, '4', 590, 94, P.crimson, 'right'); R.text(ctx, 'NEEDED 218', 525, 116, P.bone, 'center'); }
    } else {
      X.plate(ctx, 440, 44, 170, 40, P.ink, P.slate2, P.ink2);
      R.text(ctx, 'MARKETS COMMITTEE', 525, 52, P.sky, 'center');
      R.text(ctx, 'LIVE', 525, 66, P.crimson, 'center');
    }
  }
  function treasury(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    for (let i = 0; i < 5; i++) {
      const x = 250 + i * 76;
      X.inset(ctx, x, 20, 56, 150, P.slate, P.ink2, P.ink);
      R.sky(ctx, x + 3, 23, 50, 144, day, P.ink);
      R.weather(ctx, x + 3, 23, 50, 120, day + i);
    }
    // Every light on in the building. Coffee, paper, a clock at 2:14.
    X.plate(ctx, 30, 30, 70, 70, P.plastic, P.plastic2, P.plasticD);
    X.rect(ctx, 36, 36, 58, 58, P.bone);
    R.text(ctx, '2:14', 65, 60, P.ink, 'center');
    X.rect(ctx, 0, 190, V.w, 170, P.carpetD);
    X.plate(ctx, 60, 200, 560, 40, P.deskD, P.desk2, P.ink);
    for (let i = 0; i < 9; i++) {
      X.plate(ctx, 250 + i * 40, 206, 30, 12, P.bone, P.white, P.plasticD);
      if (i % 2) X.plate(ctx, 256 + i * 40, 188, 10, 18, P.bone, P.white, P.plasticD);
    }
    ctx.save(); ctx.globalAlpha = 0.14; X.rect(ctx, 0, 0, V.w, 190, P.amber); ctx.restore();
    R.text(ctx, 'TREASURY · SUNDAY', 600, 184, P.amber, 'right');
  }
  function stairwell(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.slate);
    X.gradient(ctx, 0, 0, V.w, 360, P.grey, P.slate, 9);
    // Concrete flights going up out of frame, a rail, the green exit sign.
    for (let i = 0; i < 9; i++) X.plate(ctx, 250 + i * 40, 250 - i * 26, 390 - i * 40, 26, P.grey2, P.bone, P.slate2);
    for (let i = 0; i < 9; i++) X.rect(ctx, 270 + i * 40, 196 - i * 26, 3, 54, P.ink2);
    X.rect(ctx, 270, 196, 330, 3, P.ink2);
    X.plate(ctx, 60, 40, 90, 34, P.jadeD, P.jade, P.ink);
    R.text(ctx, 'EXIT', 105, 52, P.white, 'center');
    X.plate(ctx, 170, 90, 50, 150, P.plasticD, P.plastic, P.ink2);
    X.rect(ctx, 208, 160, 6, 14, P.grey2);
    R.text(ctx, '41', 195, 100, P.ink, 'center');
    X.rect(ctx, 0, 262, V.w, 98, P.slate2);
  }
  function racks(ctx, day, dark) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 260, P.screenD, P.ink, 8);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      const s = r ? 1 : 0.7, x = r ? 180 + i * 70 : 230 + i * 50, w = Math.round(52 * s), h = Math.round(220 * s), y = 250 - h;
      if (r === 0 && i > 5) continue;
      X.plate(ctx, x, y, w, h, P.ink2, P.slate, P.ink);
      for (let k = 6; k < h - 6; k += Math.round(10 * s)) {
        X.rect(ctx, x + 4, y + k, w - 8, Math.round(5 * s), P.screenD);
        if (!dark && (i * 7 + k + r) % 3) X.rect(ctx, x + 6 + ((i + k) % (w - 16)), y + k + 1, 2, 2, (i + k) % 5 ? P.phosphor : P.sky);
      }
    }
    X.rect(ctx, 0, 250, V.w, 110, P.slate);
    for (let i = 0; i < 16; i++) X.rect(ctx, i * 40, 250, 1, 110, P.slate2);
    if (dark) { ctx.save(); ctx.globalAlpha = 0.45; X.rect(ctx, 0, 0, V.w, V.h, P.ink); ctx.restore(); }
    else { ctx.save(); ctx.globalAlpha = 0.1; X.rect(ctx, 160, 0, 480, 250, P.sky); ctx.restore(); }
    // The red switch.
    X.plate(ctx, 110, 120, 50, 70, P.slate, P.slate2, P.ink);
    X.rect(ctx, 122, 134, 26, 40, dark ? P.crimsonD : P.crimson);
    X.rect(ctx, 128, dark ? 164 : 138, 14, 8, P.bone);
  }
  function lobby(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.putty);
    X.gradient(ctx, 0, 0, V.w, 260, P.putty2, P.plasticD, 10);
    for (let i = 0; i < 10; i++) X.rect(ctx, i * 68, 0, 2, 260, P.plastic);
    for (let i = 0; i < 6; i++) X.plate(ctx, 380 + (i % 3) * 64, 60 + Math.floor(i / 3) * 70, 56, 60, P.plastic, P.plastic2, P.plasticD);
    // The building's management screen, smiling.
    X.plate(ctx, 90, 50, 200, 160, P.plasticD, P.plastic2, P.ink2);
    X.rect(ctx, 102, 62, 176, 120, P.screen);
    X.rect(ctx, 150, 96, 18, 18, P.phosphor); X.rect(ctx, 212, 96, 18, 18, P.phosphor);
    X.rect(ctx, 150, 138, 80, 6, P.phosphor); X.rect(ctx, 144, 132, 8, 8, P.phosphor); X.rect(ctx, 228, 132, 8, 8, P.phosphor);
    X.scanlines(ctx, 102, 62, 176, 120, P.ink, 0.25);
    R.text(ctx, 'RENT +9% · CONGRATULATIONS', 190, 190, P.ink, 'center');
    X.rect(ctx, 0, 260, V.w, 100, P.slate);
  }
  function dinner(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink2);
    X.gradient(ctx, 0, 0, V.w, 240, P.deskD, P.ink2, 9);
    for (let i = 0; i < 6; i++) { X.rect(ctx, 30 + i * 110, 40, 4, 150, P.desk); X.rect(ctx, 20 + i * 110, 70, 24, 10, P.amberD); }
    X.plate(ctx, 200, 200, 440, 60, P.bone, P.white, P.putty);
    // Candle, two glasses of the good wine, the steak.
    X.rect(ctx, 420, 170, 8, 30, P.bone); X.rect(ctx, 421, 160, 6, 10, P.amber);
    ctx.save(); ctx.globalAlpha = 0.2; X.rect(ctx, 360, 120, 130, 90, P.amber); ctx.restore();
    for (let i = 0; i < 2; i++) { const x = 330 + i * 170; X.rect(ctx, x, 164, 16, 20, P.crimsonD); X.rect(ctx, x + 6, 184, 4, 14, P.plastic2); X.rect(ctx, x + 1, 198, 14, 2, P.plastic2); }
    X.plate(ctx, 450, 214, 110, 26, P.bone, P.white, P.plastic);
    X.rect(ctx, 470, 218, 60, 14, P.deskD);
    X.plate(ctx, 250, 224, 110, 24, P.bone, P.white, P.plasticD);
    R.text(ctx, '$8,000', 305, 232, P.jadeD, 'center');
    X.rect(ctx, 0, 260, V.w, 100, P.ink);
  }
  function kitchen(ctx, day, letter) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink2);
    X.gradient(ctx, 0, 0, V.w, 240, P.slate, P.ink2, 8);
    blinds(ctx, 400, 30, 200, 130, day, true);
    for (let i = 0; i < 4; i++) X.plate(ctx, 30 + i * 80, 40, 70, 50, P.plasticD, P.plastic, P.ink2);
    X.rect(ctx, 0, 220, V.w, 140, P.deskD);
    X.plate(ctx, 180, 206, 460, 34, P.desk, P.desk2, P.deskD);
    if (letter) {
      X.plate(ctx, 300, 168, 150, 50, P.bone, P.white, P.plasticD);
      R.text(ctx, 'RIVERBEND PENSION', 375, 176, P.ink, 'center');
      R.text(ctx, 'BENEFITS -22%', 375, 196, P.crimsonD, 'center');
    }
    // The phone face-up on the table, on a call.
    X.plate(ctx, 480, 170, 70, 44, P.ink, P.slate2, P.ink2);
    X.rect(ctx, 486, 176, 58, 32, P.screenGlow);
    R.text(ctx, letter ? 'MOM · 22:40' : 'MOM · CALLING', 515, 186, P.phosphor, 'center');
    ctx.save(); ctx.globalAlpha = 0.16; X.rect(ctx, 440, 120, 150, 110, P.screenGlow); ctx.restore();
    if (!letter) {
      X.plate(ctx, 300, 176, 150, 44, P.bone, P.white, P.plasticD);
      R.text(ctx, 'AMOUNT DUE', 375, 184, P.ink, 'center');
      R.text(ctx, '$14,200', 375, 200, P.crimsonD, 'center');
    }
  }
  function voicemail(ctx, day) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 300, P.ink2, P.ink, 8);
    ctx.save(); ctx.globalAlpha = 0.12; X.rect(ctx, 200, 20, 240, 280, P.screenGlow); ctx.restore();
    X.plate(ctx, 230, 24, 180, 250, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 240, 36, 160, 226, P.screen);
    R.text(ctx, 'VOICEMAIL', 320, 50, P.grey2, 'center');
    ctx.save(); ctx.scale(2, 2); X.textShadow(ctx, 'PERRY', 160, 40, P.bone, P.ink, { align: 'center' }); ctx.restore();
    for (let i = 0; i < 26; i++) { const h = 4 + ((i * 37 + 11) % 30); X.rect(ctx, 250 + i * 5.6, 150 - h / 2, 3, h, i < 9 ? P.phosphor : P.slate2); }
    R.text(ctx, '0:12', 256, 176, P.phosphor); R.text(ctx, '0:41', 384, 176, P.grey2, 'right');
    X.rect(ctx, 304, 200, 32, 32, P.phosphorD); X.rect(ctx, 316, 208, 4, 16, P.bone); X.rect(ctx, 320, 212, 4, 8, P.bone);
  }

  function room(ctx, id, day, after, S) {
    const r = ROOMS[id] || 'office';
    if (r === 'office') office(ctx, day, false);
    else if (r === 'officeNight') office(ctx, day, true);
    else if (r === 'hearing') hearing(ctx, day, false);
    else if (r === 'vote') hearing(ctx, day, true, !!(after && S && S.f && S.f.billPassed));
    else if (r === 'treasury') treasury(ctx, day);
    else if (r === 'stairwell') stairwell(ctx, day);
    else if (r === 'racks') racks(ctx, day, after && S && S.f && S.f.pulledPlug);
    else if (r === 'lobby') lobby(ctx, day);
    else if (r === 'dinner') dinner(ctx, day);
    else if (r === 'call' || r === 'letter') kitchen(ctx, day, r === 'letter');
    else if (r === 'voicemail') voicemail(ctx, day);
    // Fine material marks at the native resolution distinguish these rooms
    // from the 320-pixel establishing shots. All stay above the caption area.
    ctx.save(); ctx.globalAlpha = 0.62;
    if (r === 'office' || r === 'officeNight') {
      for (let i = 0; i < 12; i++) X.rect(ctx, 260 + i * 28, 220, 12, 1, P.bone);
      X.rect(ctx, 306, 210, 170, 1, P.grey2);
      X.rect(ctx, 447, 191, 108, 1, P.amber);
    } else if (r === 'hearing' || r === 'vote') {
      for (let i = 0; i < 7; i++) {
        X.rect(ctx, 257 + i * 54, 155, 1, 32, P.grey2);
        X.rect(ctx, 257 + i * 54, 153, 5, 2, P.bone);
      }
      X.rect(ctx, 0, 238, V.w, 1, P.amberD);
    } else if (r === 'treasury') {
      for (let i = 0; i < 9; i++) {
        X.rect(ctx, 255 + i * 40, 210, 18, 1, P.grey2);
        X.rect(ctx, 255 + i * 40, 214, 10, 1, P.grey2);
      }
      X.rect(ctx, 30, 104, 71, 1, P.amber);
    } else if (r === 'stairwell') {
      for (let i = 0; i < 8; i++) X.rect(ctx, 277 + i * 40, 221 - i * 26, 36, 1, P.bone);
      X.rect(ctx, 170, 84, 51, 1, P.grey2);
    } else if (r === 'racks') {
      for (let i = 0; i < 7; i++) for (let y = 58; y < 237; y += 18)
        X.rect(ctx, 188 + i * 70, y, 1, 4, P.sky);
      X.rect(ctx, 106, 194, 59, 1, P.crimsonD);
    } else if (r === 'lobby') {
      for (let i = 0; i < 8; i++) X.rect(ctx, i * 84, 255, 1, 22, P.bone);
      X.rect(ctx, 90, 213, 200, 1, P.grey2);
    } else if (r === 'dinner') {
      for (let i = 0; i < 6; i++) X.rect(ctx, 204 + i * 75, 244, 42, 1, P.grey2);
      X.rect(ctx, 422, 156, 6, 1, P.bone);
    } else if (r === 'call' || r === 'letter') {
      for (let i = 0; i < 7; i++) X.rect(ctx, 183 + i * 64, 224, 28, 1, P.grey2);
      X.rect(ctx, 480, 215, 72, 1, P.screenGlow);
    } else if (r === 'voicemail') {
      X.rect(ctx, 240, 183, 159, 1, P.slate2);
      X.rect(ctx, 240, 183, 57, 1, P.phosphor);
    }
    ctx.restore();
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
    const tag = `${id}:${Math.floor(day / 5)}`;
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
