// Cutscene artwork. Everything here is drawn procedurally from js/art/pixel.js
// primitives on a 320x180 virtual canvas, so there are no image assets to ship
// and the whole thing stays on the locked palette.
//
// A scene is a list of beats: { dur, draw(ctx, V, p, o), line, who }
// p runs 0..1 through the beat, which is how the pans and fades are driven.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;
  const V = { w: 320, h: 180 };
  // The storyboard layer sets the season before drawing a set piece (see
  // B.Rhythm.season): exteriors seen through windows follow October to January.
  let SEASON = null;
  function setSeason(s) { SEASON = s || null; }
  function windowWeather(ctx, x, y, w, h, seed) {
    if (!SEASON) return;
    if (SEASON.snow) {
      X.speckle(ctx, x, y, w, h, P.bone, 0.02 + SEASON.snow * 0.03, seed || 5);
      X.rect(ctx, x, y + h - 2, w, 2, P.bone);
    } else if (SEASON.id === 'autumn') {
      X.dither(ctx, x, y + Math.round(h * 0.6), w, Math.round(h * 0.4), P.slate2, P.amberD, 0.3);
    }
  }

  // ---------- reusable set pieces ----------

  // Pre-dawn apartment: one window, a TV throwing light on the far wall.
  function apartment(ctx, glow) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 120, P.ink2, P.ink, 6);
    // window with a dead-blue city outside
    X.inset(ctx, 214, 24, 74, 56, P.slate, P.ink2, P.ink);
    X.gradient(ctx, 216, 26, 70, 52, P.slate2, P.ink2, 5);
    if (SEASON) X.dither(ctx, 216, 52, 70, 26, P.ink2, SEASON.dawn, SEASON.glow);
    for (let i = 0; i < 7; i++) {
      const bx = 218 + i * 10, bh = 14 + ((i * 37) % 26);
      X.rect(ctx, bx, 78 - bh, 8, bh, P.ink2);
      for (let wy = 0; wy < bh - 3; wy += 4) {
        for (let wx = 0; wx < 6; wx += 3) {
          if (((i * 7 + wy + wx) % 5) < 2) X.rect(ctx, bx + 1 + wx, 78 - bh + 2 + wy, 2, 2, P.amberD);
        }
      }
    }
    windowWeather(ctx, 216, 26, 70, 52, 3);
    // TV light spill on the floor and wall
    if (glow > 0) {
      X.dither(ctx, 0, 96, V.w, 84, P.ink, P.screenGlow, 0.22 * glow);
      X.dither(ctx, 10, 60, 120, 60, P.ink, P.slate, 0.3 * glow);
    }
    // couch + floor line
    X.rect(ctx, 0, 140, V.w, 40, P.ink2);
    X.rect(ctx, 0, 140, V.w, 1, P.slate);
    X.plate(ctx, 150, 118, 130, 30, P.slate, P.slate2, P.ink);
    // Blinds cut the television glow into hard, tired bands.
    ctx.save();
    ctx.globalAlpha = 0.24 * glow;
    for (let i = 0; i < 6; i++) X.rect(ctx, 0, 73 + i * 9, 184 - i * 9, 2, P.sky);
    ctx.restore();
    // Phone and alarm clock keep the setting contemporary without naming a year.
    X.plate(ctx, 158, 112, 24, 10, P.ink, P.slate, P.ink2);
    X.text(ctx, '5:58', 170, 114, P.crimson, { align: 'center' });
    X.plate(ctx, 190, 116, 12, 21, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 192, 119, 8, 14, P.screenGlow);
    X.rect(ctx, 195, 121, 2, 2, P.sky);
    // The player stays anonymous: a foreground shoulder makes the shot feel
    // observed rather than diagrammed.
    X.rect(ctx, 0, 126, 34, 54, P.ink);
    X.rect(ctx, 8, 112, 18, 19, P.ink2);
    X.rect(ctx, 11, 108, 12, 9, P.slate);
    X.rect(ctx, 12, 108, 10, 3, P.ink);
  }

  // The TV itself, with whatever headline is running under it.
  function tvSet(ctx, x, y, w, h, headline, kicker, statics) {
    X.plate(ctx, x - 6, y - 6, w + 12, h + 18, P.plastic, P.plastic2, P.plasticD);
    X.crt(ctx, x, y, w, h, true);
    if (statics > 0.02) {
      X.speckle(ctx, x + 2, y + 2, w - 4, h - 4, P.putty, 0.35 * statics, 1);
      X.speckle(ctx, x + 2, y + 2, w - 4, h - 4, P.slate2, 0.25 * statics, 2);
    }
    if (statics < 0.9) {
      // anchor silhouette behind a desk
      X.rect(ctx, x + 2, y + 2, w - 4, h - 4, P.screen);
      X.gradient(ctx, x + 2, y + 2, w - 4, h - 18, P.screenGlow, P.screen, 4);
      const cx = x + w / 2 | 0;
      X.rect(ctx, cx - 7, y + 14, 14, 16, P.ink2);       // shoulders
      X.rect(ctx, cx - 5, y + 6, 10, 10, P.slate);        // head
      X.rect(ctx, cx - 5, y + 6, 10, 3, P.ink2);          // hair
      X.rect(ctx, x + 2, y + h - 18, w - 4, 16, P.ink);   // desk
      // lower third
      X.rect(ctx, x + 3, y + h - 16, w - 6, 8, P.crimsonD);
      X.text(ctx, (kicker || 'MARKET WATCH').slice(0, 26), x + 6, y + h - 14, P.white);
      const lines = X.wrap(headline || '', w - 12).slice(0, 2);
      // One line: a second one would print on the bezel.
      lines.slice(0, 1).forEach((ln, i) => X.text(ctx, ln, x + 6, y + h - 6 + i * 8, P.amber));
      X.scanlines(ctx, x + 2, y + 2, w - 4, h - 4, P.ink, 0.2);
    }
    // standby light
    X.rect(ctx, x + w - 4, y + h + 8, 2, 2, statics > 0.5 ? P.crimson : P.jade);
  }

  // Lobby elevator. `open` 0..1 slides the doors apart.
  function elevator(ctx, open, floor) {
    // lobby wall + carpet
    X.rect(ctx, 0, 0, V.w, V.h, P.ink2);
    X.gradient(ctx, 0, 0, V.w, 132, P.slate, P.ink2, 7);
    X.rect(ctx, 0, 132, V.w, V.h - 132, P.carpetD);
    X.speckle(ctx, 0, 132, V.w, V.h - 132, P.carpet, 0.05, 11);
    // the car behind the doors: lit ceiling, back wall, handrail, floor
    X.rect(ctx, 96, 24, 128, 108, P.slate);
    X.gradient(ctx, 96, 24, 128, 108, P.slate2, P.ink2, 6);
    X.rect(ctx, 96, 24, 128, 4, P.bone);              // ceiling light
    X.rect(ctx, 100, 74, 120, 2, P.plastic);          // handrail
    X.rect(ctx, 96, 124, 128, 8, P.carpet);           // car floor
    // floor indicator above the doors
    X.plate(ctx, 134, 8, 52, 14, P.plastic, P.plastic2, P.plasticD);
    X.inset(ctx, 137, 11, 46, 8, P.ink, P.plastic2, P.screenD);
    X.text(ctx, String(floor || 41), 160, 12, P.amber, { align: 'center' });
    // doors, with brushed panel lines and a seam handle
    const slide = Math.round(open * 62);
    const door = (x) => {
      X.plate(ctx, x, 24, 62, 108, P.plastic, P.plastic2, P.plasticD);
      for (let i = 4; i < 62; i += 6) X.rect(ctx, x + i, 26, 1, 104, P.plastic2);
      X.rect(ctx, x + 3, 30, 56, 1, P.plastic2);
      X.rect(ctx, x + 3, 126, 56, 1, P.plasticD);
    };
    door(96 - slide);
    door(162 + slide);
    X.rect(ctx, 158 - slide, 24, 2, 108, P.plasticD);
    X.rect(ctx, 160 + slide, 24, 2, 108, P.plasticD);
    // door frame
    X.rect(ctx, 92, 20, 4, 116, P.plasticD);
    X.rect(ctx, 224, 20, 4, 116, P.plasticD);
    X.rect(ctx, 92, 20, 136, 4, P.plasticD);
  }

  // Wide shot of the trading floor. `zoom` 0..1 pushes toward your desk.
  function tradingFloor(ctx, zoom, lit, seed) {
    const z = 1 + zoom * 2.4;
    const cx = 160, cy = 104;
    const sx = (v) => Math.round(cx + (v - cx) * z);
    const sy = (v) => Math.round(cy + (v - cy) * z);
    const sw = (v) => Math.max(1, Math.round(v * z));

    // wall + windows behind the floor
    X.rect(ctx, 0, 0, V.w, V.h, P.putty);
    X.gradient(ctx, 0, 0, V.w, sy(70), P.putty2, P.putty, 6);
    // Fluorescent ceiling tracks converge toward the desk and strengthen the
    // one-point composition.
    for (let i = 0; i < 5; i++) {
      const x = sx(32 + i * 64);
      X.rect(ctx, x, sy(5 + Math.abs(2 - i) * 2), sw(32), Math.max(1, sw(2)), lit ? P.bone : P.slate2);
    }
    for (let i = 0; i < 6; i++) {
      const wx = sx(8 + i * 52), wy = sy(14), ww = sw(40), wh = sw(48);
      if (wx + ww < 0 || wx > V.w) continue;
      X.inset(ctx, wx, wy, ww, wh, P.slate2, P.putty2, P.plasticD);
      const top = !SEASON ? (lit ? P.sky : P.slate) : SEASON.id === 'winter' ? (lit ? P.slate2 : P.ink2) : SEASON.id === 'grey' ? (lit ? P.grey : P.slate) : (lit ? P.sky : P.slate);
      X.gradient(ctx, wx + 1, wy + 1, ww - 2, wh - 2, top, SEASON && SEASON.id === 'autumn' ? P.amber : P.putty, 5);
      // skyline beyond
      for (let b = 0; b < 4; b++) {
        const bh = sw(8 + ((i * 5 + b * 11) % 20));
        X.rect(ctx, wx + 2 + b * sw(9), wy + wh - 1 - bh, sw(7), bh, P.slate);
        if (SEASON && SEASON.snow) X.rect(ctx, wx + 2 + b * sw(9), wy + wh - 1 - bh, sw(7), 1, P.bone);
      }
      if (SEASON && SEASON.snow) X.speckle(ctx, wx + 1, wy + 1, ww - 2, wh - 2, P.bone, 0.02 + SEASON.snow * 0.02, i + 3);
    }
    // carpet
    X.rect(ctx, 0, sy(70), V.w, V.h, P.carpet);
    X.gradient(ctx, 0, sy(70), V.w, V.h - sy(70), P.carpet2, P.carpetD, 6);
    X.speckle(ctx, 0, sy(70), V.w, Math.max(1, V.h - sy(70)), P.carpetD, 0.03, seed || 3);

    // rows of desks receding, nearest row last
    const rows = [[56, 12], [74, 18], [96, 26], [126, 38]];
    for (let r = 0; r < rows.length; r++) {
      const [baseY, deskH] = rows[r];
      const y = sy(baseY), dh = sw(deskH);
      const per = sw(34 + r * 10);
      for (let i = -1; i < 12; i++) {
        const x = sx(-10 + i * (34 + r * 10));
        if (x + per < -10 || x > V.w + 10) continue;
        // monitor pair
        const mh = Math.max(2, dh - sw(6));
        X.plate(ctx, x + sw(3), y - mh, per - sw(8), mh, P.plastic, P.plastic2, P.plasticD);
        X.rect(ctx, x + sw(5), y - mh + sw(2), Math.max(1, per - sw(12)), Math.max(1, mh - sw(4)), P.screen);
        if (r >= 2) {
          // close enough to show something on the glass
          const late = (seed || 0) >= 45;
          const on = late ? ((i * 7 + r * 3 + seed) % 5) < 2 : ((i * 7 + r * 3) % 5) !== 0;
          X.dither(ctx, x + sw(5), y - mh + sw(2), Math.max(1, per - sw(12)), Math.max(1, mh - sw(4)),
            P.screen, on ? P.jadeD : P.crimsonD, 0.4);
          if (late && !on) X.rect(ctx, x + sw(5), y - mh + sw(2), Math.max(1, per - sw(12)), Math.max(1, mh - sw(4)), P.screenD);
        }
        // desk slab + chair + a person, sometimes
        X.plate(ctx, x, y, per - sw(4), sw(4), P.desk, P.desk2, P.deskD);
        const occupied = (seed || 0) >= 45 ? ((i * 3 + r + seed) % 6) === 0
          : (seed || 0) >= 30 ? ((i * 3 + r + seed) % 4) < 2 : ((i * 3 + r) % 3) !== 0;
        if (occupied) {
          X.rect(ctx, x + sw(10), y + sw(4), sw(9), sw(10), P.ink2);
          X.rect(ctx, x + sw(12), y + sw(1), sw(5), sw(4), P.slate2);
        } else if (r >= 2) {
          X.rect(ctx, x + sw(12), y + sw(6), sw(10), sw(7), P.ink2);
          X.rect(ctx, x + sw(13), y + sw(12), sw(8), Math.max(1, sw(2)), P.slate2);
        }
      }
    }
    // Foreground figures crop into frame as the camera pushes forward.
    if (zoom > 0.12) {
      const a = B.clamp((zoom - 0.12) * 2, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      X.rect(ctx, 0, 111, 31, 69, P.ink2);
      X.rect(ctx, 8, 98, 17, 19, P.slate);
      X.rect(ctx, 10, 95, 13, 7, P.ink);
      X.rect(ctx, 287, 116, 33, 64, P.ink2);
      X.rect(ctx, 296, 103, 16, 18, P.deskD);
      X.rect(ctx, 295, 100, 18, 7, P.ink);
      ctx.restore();
    }
  }

  // Your own desk, filling the frame. This is the shot the live HUD takes over from.
  function deskCloseup(ctx, p, o) {
    const lit = o && o.dim ? P.slate : P.putty;
    X.rect(ctx, 0, 0, V.w, V.h, lit);
    X.gradient(ctx, 0, 0, V.w, 70, P.putty2, lit, 5);
    X.rect(ctx, 0, 132, V.w, 48, P.desk);
    X.gradient(ctx, 0, 132, V.w, 48, P.desk2, P.deskD, 5);
    // two monitors
    const mon = (x, w, label, fill) => {
      X.plate(ctx, x, 26, w, 104, P.plastic, P.plastic2, P.plasticD);
      X.crt(ctx, x + 5, 31, w - 10, 84, true);
      X.text(ctx, label, x + w / 2, 119, P.plasticD, { align: 'center' });
      X.plate(ctx, x + w / 2 - 9, 130, 18, 6, P.plasticD, P.plastic, P.ink2);
      if (fill) fill(x + 6, 32, w - 12, 82);
    };
    mon(10, 176, 'TRADE', (x, y, w, h) => {
      // a little candle chart, so the screen isn't dead
      let v = h * 0.6;
      for (let i = 0; i < w - 4; i += 3) {
        v += (((i * 37) % 11) - 5) * 0.8 - (o && o.crash ? 0.7 : -0.25);
        v = B.clamp(v, 6, h - 6);
        const up = ((i * 13) % 7) > 3;
        X.rect(ctx, x + 2 + i, y + v, 2, Math.max(2, 3 + ((i * 5) % 6)), up ? P.jade : P.crimson);
      }
      X.rect(ctx, x, y + h - 9, w, 9, P.screenD);
      X.text(ctx, o && o.ticker ? o.ticker : 'INDX', x + 2, y + h - 8, P.phosphor);
    });
    mon(196, 114, 'COMMS', (x, y, w, h) => {
      for (let i = 0; i < 6; i++) {
        X.rect(ctx, x + 2, y + 3 + i * 13, w - 4, 10, P.screenGlow);
        X.rect(ctx, x + 3, y + 5 + i * 13, ((i * 29) % (w - 20)) + 10, 2, i % 3 === 0 ? P.amber : P.phosphorD);
        X.rect(ctx, x + 3, y + 9 + i * 13, ((i * 17) % (w - 26)) + 8, 2, P.phosphorD);
      }
    });
    // desk clutter
    X.plate(ctx, 20, 140, 16, 18, P.bone, P.white, P.plasticD);      // coffee
    X.rect(ctx, 22, 142, 12, 3, P.deskD);
    X.plate(ctx, 250, 142, 48, 20, P.ink2, P.slate, P.ink);          // phone
    for (let i = 0; i < 3; i++) X.rect(ctx, 254 + i * 14, 152, 10, 6, P.slate2);
    X.rect(ctx, 96, 146, 40, 12, P.bone);                             // paper
    X.rect(ctx, 98, 149, 36, 1, P.grey);
    X.rect(ctx, 98, 152, 28, 1, P.grey);
    // Keyboard, hands and a CASCADE briefing sheet anchor the point of view.
    X.plate(ctx, 135, 148, 76, 16, P.plasticD, P.plastic2, P.ink2);
    for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 9; kx++) X.rect(ctx, 140 + kx * 7, 151 + ky * 5, 5, 3, P.slate);
    X.rect(ctx, 116, 158, 19, 12, P.desk2);
    X.rect(ctx, 210, 157, 19, 13, P.desk2);
    for (let i = 0; i < 4; i++) X.rect(ctx, 101 + i * 2, 155 - i * 2, 25 - i * 2, 2, i < 2 ? P.sky : P.crimsonD);
  }

  // Closing bell on the wall, with the floor emptying out below it.
  function bellScene(ctx, swing, empty) {
    X.rect(ctx, 0, 0, V.w, V.h, P.putty);
    X.gradient(ctx, 0, 0, V.w, 132, P.putty2, P.putty, 7);
    X.rect(ctx, 0, 126, V.w, 6, '#a29c8e');            // chair rail
    X.rect(ctx, 0, 132, V.w, V.h - 132, P.carpet);
    X.gradient(ctx, 0, 132, V.w, V.h - 132, P.carpet2, P.carpetD, 4);

    // wall clock, stuck on four o'clock
    X.plate(ctx, 30, 24, 30, 30, P.plastic, P.plastic2, P.plasticD);
    X.inset(ctx, 33, 27, 24, 24, P.bone, P.plastic2, P.plasticD);
    X.rect(ctx, 44, 29, 2, 11, P.ink);                 // minute hand to 12
    X.rect(ctx, 46, 39, 7, 2, P.ink);                  // hour hand to 4
    X.rect(ctx, 44, 38, 2, 2, P.crimson);

    // A window: at four o'clock it is daylight in October, sunset by
    // mid-November and full dark in December.
    if (SEASON) {
      X.inset(ctx, 232, 14, 64, 44, P.slate2, P.putty2, P.plasticD);
      const late = SEASON.week >= 8, dark = SEASON.week >= 11;
      X.gradient(ctx, 234, 16, 60, 40, dark ? P.ink : late ? P.violet : P.sky, dark ? P.ink2 : late ? P.crimson : P.putty2, 5);
      for (let b = 0; b < 5; b++) {
        const bh = 8 + ((b * 13) % 18);
        X.rect(ctx, 236 + b * 12, 56 - bh, 10, bh, dark ? P.ink2 : P.slate);
        if (dark || late) for (let wy = 3; wy < bh - 2; wy += 5) X.rect(ctx, 238 + b * 12 + (wy % 4), 56 - bh + wy, 2, 2, P.amber);
      }
      windowWeather(ctx, 234, 16, 60, 40, 9);
      X.rect(ctx, 263, 14, 2, 44, P.plasticD);
    }

    // the bell: bracket, yoke, flared body, rim, clapper
    const a = Math.round(Math.sin(swing * Math.PI * 7) * (1 - swing) * 6);
    const bx = 160 + a;
    X.rect(ctx, 146, 14, 28, 4, P.plasticD);
    X.rect(ctx, 158, 18, 4, 8, P.plasticD);
    X.rect(ctx, bx - 4, 24, 8, 4, P.amberD);
    for (let i = 0; i < 26; i++) {                     // flared body
      const w = 10 + Math.round(i * 0.85);
      X.rect(ctx, bx - w, 28 + i, w * 2, 1, i < 4 ? P.bone : P.amber);
    }
    X.rect(ctx, bx - 23, 54, 46, 5, P.amberD);         // rim
    X.rect(ctx, bx - 23, 54, 46, 1, P.bone);
    X.rect(ctx, bx - 2, 59, 4, 6, P.deskD);            // clapper
    // sound rings
    for (let i = 0; i < 3; i++) {
      const r = 30 + i * 13 + Math.round(swing * 28);
      if (1 - swing - i * 0.22 <= 0.05) continue;
      X.rect(ctx, bx - r, 42 - i * 3, 5, 2, P.bone);
      X.rect(ctx, bx + r - 5, 42 - i * 3, 5, 2, P.bone);
    }

    // desks, high enough to stay clear of the caption box
    for (let i = 0; i < 5; i++) {
      const x = 10 + i * 62;
      X.plate(ctx, x, 84, 50, 26, P.plastic, P.plastic2, P.plasticD);
      X.rect(ctx, x + 3, 87, 44, 18, empty ? P.screenD : P.screen);
      if (!empty) X.dither(ctx, x + 3, 87, 44, 18, P.screen, i % 2 ? P.crimsonD : P.jadeD, 0.45);
      X.plate(ctx, x - 3, 110, 56, 5, P.desk, P.desk2, P.deskD);
      X.rect(ctx, x + 6, 115, 3, 11, P.deskD);
      X.rect(ctx, x + 41, 115, 3, 11, P.deskD);
    }

    // people walking out between the desk rows, once the floor empties.
    // They sit above y=132 so the caption box never swallows them.
    if (empty) {
      for (let i = 0; i < 4; i++) {
        const px = 58 + i * 62 + Math.round(swing * 14);
        X.rect(ctx, px, 106, 9, 18, P.ink2);           // coat
        X.rect(ctx, px + 2, 99, 5, 7, P.slate2);       // head
        X.rect(ctx, px + 2, 99, 5, 2, P.ink);          // hair
        X.rect(ctx, px + 9, 113, 5, 4, P.deskD);       // bag
        X.rect(ctx, px + 1, 124, 3, 4, P.ink);         // legs
        X.rect(ctx, px + 5, 124, 3, 4, P.ink);
      }
    }
  }

  // A single establishing shot behind the ending card.
  // Story-specific broadcast tableaux. These use contemporary systems imagery
  // without naming a calendar year: fibre maps, server racks, hearings, queues.
  function briefingTableau(ctx, day, p) {
    if ([3, 5, 8, 9, 11, 12, 13, 14].indexOf(day) < 0) return false;
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 138, P.ink2, P.screenD, 7);
    X.rect(ctx, 0, 0, V.w, 13, P.slate);
    X.text(ctx, day >= 11 ? 'PUBLIC FEED' : 'OVERNIGHT WIRE', 8, 3, P.bone);
    X.rect(ctx, 265, 3, 46, 7, day >= 9 ? P.crimsonD : P.sky);
    X.text(ctx, day >= 9 ? 'LIVE' : 'UPDATE', 288, 3, P.white, { align: 'center' });

    if (day === 3) {
      // Kavro Strait: a live shipping and cable map.
      X.gradient(ctx, 0, 13, V.w, 125, P.carpetD, P.screen, 6);
      X.dither(ctx, 0, 13, 78, 125, P.slate, P.carpet, 0.45);
      X.dither(ctx, 250, 13, 70, 125, P.slate, P.carpet, 0.5);
      ctx.strokeStyle = P.sky; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(48, 109); ctx.bezierCurveTo(112, 64, 195, 102, 279, 41); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const x = 123 + i * 35 + Math.round(p * 9);
        X.rect(ctx, x, 66 + i * 12, 19, 4, i === 1 ? P.crimson : P.bone);
        X.rect(ctx, x + 5, 62 + i * 12, 8, 4, P.slate2);
      }
      X.box(ctx, 87, 21, 146, 21);
      X.text(ctx, 'KAVRO STRAIT', 160, 28, P.amber, { align: 'center', spacing: 2 });
    } else if (day === 5) {
      // Grid capacity and datacenter demand on the same schematic.
      X.rect(ctx, 0, 104, V.w, 34, P.carpetD);
      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 73;
        X.rect(ctx, x, 43, 3, 61, P.slate2);
        X.rect(ctx, x - 12, 55, 27, 2, P.sky);
        ctx.strokeStyle = i > 1 ? P.crimson : P.amber; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(x - 12, 57); ctx.lineTo(x + 61, 57); ctx.stroke(); ctx.setLineDash([]);
      }
      for (let i = 0; i < 5; i++) {
        const x = 182 + (i % 3) * 34, y = 77 + Math.floor(i / 3) * 21;
        X.plate(ctx, x, y, 28, 17, P.plastic, P.plastic2, P.plasticD);
        X.rect(ctx, x + 4, y + 4, 20, 5, i > 2 ? P.crimsonD : P.screenGlow);
      }
      X.text(ctx, 'GRID REQUESTS: DELAYED', 12, 23, P.crimson);
      X.text(ctx, 'COMPUTE LOAD: +38%', 12, 34, P.amber);
    } else if (day === 8) {
      // The automated feedback loop, shown as racks feeding one another.
      for (let i = 0; i < 5; i++) {
        const x = 28 + i * 55;
        X.plate(ctx, x, 34, 38, 76, P.slate, P.slate2, P.ink);
        for (let r = 0; r < 6; r++) {
          X.rect(ctx, x + 5, 40 + r * 10, 28, 6, P.screen);
          X.rect(ctx, x + 7 + ((r + i) % 4) * 5, 42 + r * 10, 2, 2, r > 3 ? P.crimson : P.phosphor);
        }
        if (i < 4) {
          X.rect(ctx, x + 38, 70, 16, 2, i > 1 ? P.crimson : P.sky);
          X.rect(ctx, x + 49, 67, 5, 8, i > 1 ? P.crimson : P.sky);
        }
      }
      X.text(ctx, 'CORRELATED MODEL FLOW', 160, 19, P.violet, { align: 'center', spacing: 2 });
    } else if (day === 9) {
      // A bank queue photographed through a phone camera and rebroadcast live.
      X.rect(ctx, 34, 31, 252, 82, P.putty);
      X.rect(ctx, 43, 42, 234, 49, P.plastic2);
      X.rect(ctx, 49, 48, 72, 38, P.screenD);
      X.rect(ctx, 199, 48, 72, 38, P.screenD);
      X.rect(ctx, 126, 48, 68, 38, P.sky);
      X.text(ctx, 'RIDGEWAY TRUST', 160, 34, P.ink, { align: 'center' });
      for (let i = 0; i < 9; i++) {
        const x = 52 + i * 27 + Math.round((i % 2) * p * 3);
        X.rect(ctx, x, 91, 9, 24, i % 3 ? P.ink2 : P.crimsonD);
        X.rect(ctx, x + 2, 84, 5, 7, i % 2 ? P.desk2 : P.deskD);
      }
      X.rect(ctx, 0, 113, V.w, 25, P.ink2);
      X.text(ctx, 'WITHDRAWAL QUEUE · THIRD STREET', 160, 120, P.white, { align: 'center' });
    } else if (day === 11) {
      // Regulatory preservation sweep: cartons, badges and locked terminals.
      for (let i = 0; i < 6; i++) {
        const x = 16 + i * 50;
        X.plate(ctx, x, 76, 42, 31, P.desk2, P.putty2, P.deskD);
        X.rect(ctx, x + 6, 85, 30, 4, P.crimsonD);
        X.text(ctx, 'HOLD', x + 21, 94, P.ink, { align: 'center' });
      }
      for (let i = 0; i < 3; i++) {
        const x = 66 + i * 86;
        X.rect(ctx, x, 37, 13, 31, P.slate);
        X.rect(ctx, x + 3, 29, 7, 8, P.desk2);
        X.rect(ctx, x + 2, 46, 9, 7, P.sky);
      }
      X.text(ctx, 'PRESERVE ALL RECORDS', 160, 18, P.crimson, { align: 'center', spacing: 2 });
    } else if (day === 12 || day === 13) {
      // Hearing and floor vote share the same institutional visual grammar.
      X.rect(ctx, 0, 93, V.w, 45, P.deskD);
      X.rect(ctx, 32, 36, 256, 48, P.slate);
      X.rect(ctx, 40, 44, 240, 31, P.ink2);
      for (let i = 0; i < 7; i++) {
        const x = 56 + i * 34;
        X.rect(ctx, x, 56, 12, 22, P.ink2);
        X.rect(ctx, x + 3, 49, 6, 7, i === 3 ? P.desk2 : P.grey2);
      }
      X.rect(ctx, 86, 96, 148, 11, P.plasticD);
      X.rect(ctx, 154, 85, 12, 12, P.desk2);
      X.text(ctx, day === 12 ? 'MARKETS COMMITTEE · LIVE' : 'STABILIZATION VOTE · LIVE', 160, 20, day === 12 ? P.sky : P.amber, { align: 'center' });
      if (day === 13) {
        X.box(ctx, 111, 112, 98, 20);
        X.text(ctx, 'VOTE PENDING', 160, 118, P.crimson, { align: 'center' });
      }
    } else {
      // Final day: the city and network remain, but half the nodes have gone dark.
      endingShot(ctx, 'dark');
      for (let i = 0; i < 7; i++) {
        const x = 24 + i * 45, y = 35 + (i % 3) * 18;
        X.rect(ctx, x, y, 5, 5, i < 3 ? P.sky : P.crimsonD);
        if (i < 6) {
          ctx.strokeStyle = i < 3 ? P.sky : P.slate2;
          ctx.beginPath(); ctx.moveTo(x + 5, y + 2); ctx.lineTo(x + 45, 37 + ((i + 1) % 3) * 18); ctx.stroke();
        }
      }
      X.text(ctx, 'SYSTEM STATUS: UNRESOLVED', 160, 18, P.bone, { align: 'center' });
    }
    X.scanlines(ctx, 0, 13, V.w, 125, P.ink, 0.1);
    return true;
  }

  // A compact visual signature for each ending, layered over the city shot.
  const c1 = (ctx, x, y, w, h, base, hi, sh, out) => X.cel(ctx, x, y, w, h, base, hi, sh, out, 1);
  const R = (ctx, x, y, w, h, c) => X.rect(ctx, x, y, w, h, c);
  const spr = (ctx, rows, x, y) => X.drawSprite(ctx, X.sprite(rows), x, y);
  function rings(ctx, cx, cy, radii, col, a) {
    for (const rad of radii) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
      for (let y = cy - rad; y < cy + rad; y++) { const h = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - cy) * (y - cy))) * 1.2); ctx.fillRect(cx - h, y, h * 2, 1); }
      ctx.restore(); }
  }

  // ---- endings, drawn to the pet's rules at the 320 grid (ink outlines, light
  // top-left, shade bottom-right, light as stepped rings) ----
  const COLD = ['wiped', 'fired', 'perp', 'fall-guy', 'ward', 'replaced', 'depression', 'nobody'];
  const PAPER = ['whistle', 'cassandra', 'revolving', 'clawback', 'lost-decade'];
  function endingShot(ctx, kind, id) {
    const light = kind === 'light', cold = COLD.indexOf(id) >= 0, paper = PAPER.indexOf(id) >= 0;
    const skyA = cold ? P.slate2 : paper ? P.putty2 : light ? P.amber : P.slate2;
    const skyB = cold ? P.ink2 : paper ? P.crimsonD : light ? P.crimsonD : P.ink2;
    const lit = cold ? P.sky : paper ? P.bone : P.amber;
    X.gradient(ctx, 0, 0, V.w, 132, skyA, skyB, 9);
    if (light && !cold) { rings(ctx, 262, 118, [40, 26, 14], P.amber, 0.12); R(ctx, 254, 110, 16, 16, P.amber); R(ctx, 256, 110, 12, 2, P.white); }
    // Far skyline: outlined towers, a shaded right face, roof trim, a few water tanks.
    for (let i = 0; i < 11; i++) {
      const bw = 22 + ((i * 17) % 14), bh = 26 + ((i * 41) % 58), bx = i * 30 - 6, by = 132 - bh;
      c1(ctx, bx, by, bw, bh + 1, light && !cold ? P.slate : P.ink2, light && !cold ? P.slate2 : P.slate, P.ink, P.ink);
      R(ctx, bx + bw - 5, by + 2, 3, bh - 2, P.ink);
      if (i % 4 === 1) { c1(ctx, bx + 5, by - 7, 9, 7, P.deskD, P.desk, P.ink2, P.ink); R(ctx, bx + 6, by - 1, 1, 1, P.ink); R(ctx, bx + 12, by - 1, 1, 1, P.ink); }
      if (i % 5 === 3) R(ctx, bx + bw / 2 | 0, by - 12, 1, 12, P.grey);
      for (let wy = 5; wy < bh - 5; wy += 6) for (let wx = 3; wx < bw - 7; wx += 5) {
        if (((i * 5 + wy + wx) % (light ? 3 : 6)) < 2) { R(ctx, bx + wx, by + wy, 2, 2, lit); R(ctx, bx + wx, by + wy + 2, 2, 1, P.ink); }
      }
    }
    // The street: sidewalk and curb, road, lane marks, streetlamps.
    R(ctx, 0, 132, V.w, 48, P.ink);
    R(ctx, 0, 132, V.w, 6, cold ? P.slate : P.slate2); R(ctx, 0, 132, V.w, 1, cold ? P.sky : paper ? P.bone : light ? P.amberD : P.grey); R(ctx, 0, 138, V.w, 1, P.ink2);
    for (let x = 6; x < V.w; x += 24) R(ctx, x, 158, 12, 1, P.slate2);
    for (const lx of [24, 296]) {
      R(ctx, lx, 104, 2, 29, P.slate2); R(ctx, lx - 1, 131, 4, 2, P.slate); c1(ctx, lx - 3, 101, 8, 4, P.slate2, P.grey2, P.slate, P.ink);
      R(ctx, lx - 1, 105, 4, 1, lit); ctx.save(); ctx.globalAlpha = light ? 0.08 : 0.14; for (let k = 0; k < 26; k += 2) R(ctx, lx + 1 - (k >> 1), 106 + k, k + 2, 2, lit); ctx.restore();
    }
    if (light) X.dither(ctx, 0, 139, V.w, 18, P.ink, P.amberD, 0.3);
    else {
      // Rain in short slants, and the streetlights doubled in the wet road.
      ctx.save(); ctx.globalAlpha = 0.5;
      for (let k = 0; k < 90; k++) { const x = (k * 37) % V.w, y = (k * 53) % 128; R(ctx, x, y, 1, 3, P.grey2); R(ctx, x + 1, y + 3, 1, 2, P.grey2); }
      ctx.restore();
      X.dither(ctx, 0, 139, V.w, 14, P.ink, P.slate, 0.2);
      for (const lx of [24, 296]) { R(ctx, lx - 1, 142, 4, 1, lit); R(ctx, lx, 145, 2, 1, lit); R(ctx, lx, 148, 2, 1, P.slate2); }
    }
  }

  // Small sprites for the props. Keys are js/art/palette.js characters.
  const BOX = ['.111111111111111.', '1eeeeeeeeeeeeeee1', '1ee1111111111ee.1', '1eeeeeeeeeeeeeeD1', '1eeeeeeeeeeeeeeD1', '1eeeeeeeeeeeeeeD1', '1DDDDDDDDDDDDDDD1', '.111111111111111.'];
  const LEAF = ['..j..j..', '.jJj.jJ.', 'jJjjjJjj', '.jJjjJj.', '..jjJj..', '...11...'];
  const FLASH = ['...9...', '...9...', '..999..', '9999999', '..999..', '...9...', '...9...'];
  const BAG = ['...1111...', '..1....1..', '1111111111', '1DDDDDDDD1', '1DeeeeeeD1', '1DDDDDDDD1', '1DDDDDDDD1', '1111111111'];
  const GAVEL = ['1111111...', '1eeeeee1..', '1DDDDDD1..', '1111111...', '...1D1....', '...1D1....', '...1D1....', '..1DDD1...'];
  const FIG = ['.11.', '1221', '1221', '.11.', '1221', '1221', '1221', '1..1'];
  const COIN = ['.111.', '1aaa1', '1aAa1', '1aaa1', '.111.'];

  function endingDetail(ctx, id, p) {
    const cx = 160;
    if (id === 'wiped') { // the book's charts, falling off the desk
      for (let i = 0; i < 6; i++) {
        const drop = Math.round(p * i * 2), x = 112 + i * 7, y = 20 + i * 8 + drop;
        c1(ctx, x, y, 70 - i * 4, 11, P.bone, P.white, P.putty2);
        for (let k = 0; k < 6; k++) R(ctx, x + 4 + k * 5, y + 3 + (i > 2 ? k : 5 - k), 3, 1, i > 2 ? P.crimson : P.sky);
      }
    } else if (id === 'fired') { // the box: a plant, a mug, PERSONAL
      spr(ctx, LEAF, 130, 24); R(ctx, 133, 30, 2, 8, P.deskD);
      c1(ctx, 170, 28, 12, 11, P.bone, P.white, P.putty2); R(ctx, 182, 31, 2, 5, P.ink2);
      c1(ctx, 120, 38, 80, 34, P.desk2, P.putty2, P.desk); c1(ctx, 116, 34, 88, 7, P.desk, P.desk2, P.deskD);
      c1(ctx, 136, 48, 48, 13, P.bone, P.white, P.putty2); X.text(ctx, 'PERSONAL', cx, 51, P.ink, { align: 'center' });
    } else if (id === 'perp') { // the car at the curb, the flashes
      c1(ctx, 108, 46, 104, 20, P.bone, P.white, P.grey2, P.ink); R(ctx, 111, 54, 98, 4, P.ink2); c1(ctx, 128, 34, 62, 14, P.bone, P.white, P.grey2, P.ink);
      R(ctx, 132, 37, 24, 8, P.sky); R(ctx, 160, 37, 26, 8, P.sky); R(ctx, 158, 37, 2, 8, P.ink2); c1(ctx, 140, 29, 28, 6, P.ink2, null, null, P.ink); R(ctx, 142, 30, 11, 4, P.crimson); R(ctx, 155, 30, 11, 4, P.sky);
      c1(ctx, 116, 60, 16, 14, P.ink2, P.slate2, P.ink, P.ink); c1(ctx, 188, 60, 16, 14, P.ink2, P.slate2, P.ink, P.ink); R(ctx, 122, 66, 4, 2, P.grey); R(ctx, 194, 66, 4, 2, P.grey);
      if (p > 0.3) { spr(ctx, FLASH, 88, 18); spr(ctx, FLASH, 222, 26); }
      if (p > 0.6) { ctx.save(); ctx.globalAlpha = 0.25; R(ctx, 70, 10, 180, 66, P.white); ctx.restore(); }
    } else if (id === 'master') { // the yacht, off somewhere warm
      c1(ctx, 86, 56, 150, 10, P.white, P.white, P.putty2); R(ctx, 92, 66, 138, 4, P.bone);
      c1(ctx, 122, 40, 70, 18, P.white, P.white, P.putty2); for (let i = 0; i < 5; i++) R(ctx, 128 + i * 12, 45, 8, 4, P.slate);
      R(ctx, 158, 16, 2, 26, P.slate2); R(ctx, 160, 18, 20, 7, P.amber); R(ctx, 160, 18, 20, 1, P.white);
      X.dither(ctx, 0, 72, 320, 18, P.screen, P.sky, 0.35); for (let i = 0; i < 8; i++) R(ctx, 96 + i * 18, 74 + (i % 2) * 3, 10, 1, P.white);
    } else if (id === 'whistle') { // the file and the front page
      for (let i = 0; i < 4; i++) c1(ctx, 100 + i * 5, 22 + i * 7, 96, 20, P.bone, P.white, P.putty2);
      c1(ctx, 126, 50, 44, 11, P.bone, null, null, P.crimsonD); X.text(ctx, 'LEAKED', 148, 53, P.crimsonD, { align: 'center' });
      c1(ctx, 196, 30, 34, 44, P.putty2, P.white, P.plasticD); R(ctx, 200, 34, 26, 4, P.ink); for (let k = 0; k < 5; k++) R(ctx, 200, 42 + k * 5, 22 - (k % 2) * 6, 1, P.grey);
    } else if (id === 'revolving') { // the door between the two buildings
      c1(ctx, 90, 22, 140, 8, P.bone, P.white, P.putty2);
      for (let i = 0; i < 5; i++) c1(ctx, 100 + i * 28, 30, 10, 42, P.bone, P.white, P.putty2);
      c1(ctx, 144, 42, 32, 30, P.sky, P.white, P.slate2); R(ctx, 159, 42, 2, 30, P.slate2); R(ctx, 146, 56, 28, 1, P.slate2);
      R(ctx, 86, 72, 148, 4, P.slate2); X.text(ctx, 'PRIVATE / PUBLIC', cx, 12, P.amber, { align: 'center' });
    } else if (id === 'depression') { // shuttered fronts and a queue
      for (let i = 0; i < 6; i++) { const x = 70 + i * 32; c1(ctx, x, 26, 28, 46, P.ink2, P.slate, P.ink, P.ink); for (let k = 0; k < 6; k++) R(ctx, x + 2, 34 + k * 6, 24, 1, P.slate2); if (i % 2) { c1(ctx, x + 4, 28, 20, 6, P.crimsonD, P.crimson, P.ink2, P.ink); } }
      for (let i = 0; i < 9; i++) spr(ctx, FIG, 78 + i * 18, 66);
      R(ctx, 54, 74, 212, 3, P.crimsonD);
    } else if (id === 'soft') { // a street with its lights back on
      for (let i = 0; i < 7; i++) { const x = 66 + i * 28, h = 34 + (i % 2) * 9; c1(ctx, x, 74 - h, 24, h, P.slate, P.slate2, P.ink2); for (let w = 0; w < 2; w++) for (let r = 0; r < 2; r++) c1(ctx, x + 4 + w * 9, 74 - h + 6 + r * 12, 6, 6, P.amber, P.white, P.amberD); }
      for (const tx of [84, 176, 232]) spr(ctx, LEAF, tx, 60);
      R(ctx, 52, 74, 216, 3, P.jade);
    } else if (id === 'quiet') { // one window lit on a dark tower
      c1(ctx, 108, 14, 104, 64, P.ink2, P.slate, P.ink, P.ink);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) { const on = x === 4 && y === 2; R(ctx, 116 + x * 13, 20 + y * 11, 7, 6, on ? P.amber : P.screenD); if (on) rings(ctx, 171, 45, [12], P.amber, 0.15); }
    } else if (id === 'replaced') { // the racks that took the desk
      for (let i = 0; i < 4; i++) { const x = 98 + i * 34; c1(ctx, x, 20, 28, 56, P.ink2, P.slate, P.ink); for (let r = 0; r < 5; r++) { R(ctx, x + 4, 26 + r * 9, 20, 5, P.screenD); R(ctx, x + 6 + (i * 3 + r) % 12, 27 + r * 9, 2, 2, (i + r) % 3 ? P.phosphor : P.sky); } }
    } else if (id === 'exit') { // an open door, the light beyond it, a bag
      c1(ctx, 136, 16, 48, 62, P.deskD, P.desk, P.ink2); R(ctx, 142, 22, 36, 56, P.bone); X.dither(ctx, 142, 22, 36, 56, P.bone, P.amber, 0.3);
      rings(ctx, 160, 60, [36, 22], P.amber, 0.1);
      c1(ctx, 190, 60, 34, 16, P.deskD, P.desk, P.ink2); R(ctx, 196, 55, 2, 6, P.ink2); R(ctx, 214, 55, 2, 6, P.ink2); R(ctx, 196, 55, 20, 2, P.ink2); R(ctx, 192, 66, 30, 1, P.desk2);
    } else if (id === 'nobody') { // every screen says the same thing
      for (let i = 0; i < 5; i++) { const x = 90 + i * 28; c1(ctx, x, 22, 24, 40, P.slate, P.slate2, P.ink); R(ctx, x + 3, 25, 18, 30, P.screenD); R(ctx, x + 11, 29, 3, 16, P.crimson); R(ctx, x + 7, 43, 11, 3, P.crimson); R(ctx, x + 9, 46, 7, 3, P.crimson); R(ctx, x + 10, 62, 4, 8, P.slate); }
      X.text(ctx, 'SELL SELL SELL SELL SELL', cx, 12, P.crimson, { align: 'center' });
    } else if (id === 'fall-guy') { // a signature that was never yours
      c1(ctx, 116, 26, 88, 48, P.bone, P.white, P.putty2);
      R(ctx, 124, 34, 52, 2, P.grey); R(ctx, 124, 40, 62, 2, P.grey); R(ctx, 124, 64, 70, 1, P.ink);
      X.text(ctx, 'NOT MINE', cx, 50, P.crimsonD, { align: 'center' });
      for (let k = 0; k < 8; k++) R(ctx, 170 + k * 3, 60 - (k % 3), 3, 1, P.slate);
      spr(ctx, GAVEL, 210, 60);
    } else if (id === 'cassandra') { // the warnings nobody opened
      for (let i = 0; i < 6; i++) c1(ctx, 94 + i * 3, 50 - i * 4, 62, 24, P.bone, P.white, P.putty2);
      R(ctx, 102, 32, 34, 5, P.crimsonD); X.text(ctx, 'UNREAD', 126, 41, P.ink, { align: 'center' });
      c1(ctx, 176, 24, 52, 50, P.amberD, P.amber, P.deskD); R(ctx, 176, 22, 22, 4, P.amberD);
      c1(ctx, 182, 30, 40, 22, P.bone, P.white, P.putty2); X.text(ctx, 'FILED', 202, 33, P.ink, { align: 'center' }); X.text(ctx, 'WEEK 3', 202, 43, P.crimson, { align: 'center' });
    } else if (id === 'acquirer') { // two banks, one sign going up
      c1(ctx, 86, 34, 50, 40, P.slate, P.slate2, P.ink); for (let i = 0; i < 4; i++) R(ctx, 91 + i * 12, 42, 4, 32, P.slate2);
      c1(ctx, 184, 34, 50, 40, P.crimsonD, P.crimson, P.ink); for (let i = 0; i < 4; i++) R(ctx, 189 + i * 12, 42, 4, 32, P.crimson);
      R(ctx, 158, 6, 2, 26, P.amberD); R(ctx, 130, 6, 60, 2, P.amberD); R(ctx, 170, 8, 1, 14, P.grey);
      c1(ctx, 140, 22, 60, 14, P.amber, P.white, P.amberD); X.text(ctx, 'HLST', 170, 26, P.ink, { align: 'center' });
    } else if (id === 'ward') { // a public building and its flag
      c1(ctx, 112, 30, 96, 8, P.bone, P.white, P.putty2); c1(ctx, 118, 38, 84, 36, P.slate2, P.grey2, P.slate);
      for (let i = 0; i < 5; i++) c1(ctx, 124 + i * 16, 40, 8, 34, P.bone, P.white, P.putty2);
      R(ctx, 158, 8, 2, 22, P.grey2); c1(ctx, 160, 8, 24, 12, P.sky, P.bone, P.slate2); R(ctx, 161, 13, 22, 2, P.bone);
    } else if (id === 'clawback') { // forty cents on the dollar
      for (let i = 0; i < 10; i++) { const kept = i < 4, h = kept ? 6 : 3; for (let k = 0; k < h; k++) spr(ctx, COIN, 100 + i * 12, 68 - k * 4); if (!kept) R(ctx, 98 + i * 12, 54, 11, 2, P.crimson); }
      X.text(ctx, '40 CENTS', cx, 16, P.amber, { align: 'center' });
    } else if (id === 'fund') { // your name on a glass tower
      c1(ctx, 132, 12, 56, 66, P.slate2, P.sky, P.ink2); for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) c1(ctx, 138 + x * 16, 18 + y * 12, 10, 8, P.amber, P.white, P.amberD);
      for (let i = 0; i < 9; i++) R(ctx, 196 + i * 6, 70 - i * 5, 5, 3, P.jade); R(ctx, 244, 26, 6, 6, P.jade);
    } else if (id === 'right-early') { // correct, eventually
      const ys = [30, 34, 40, 48, 44, 36, 28, 22, 20, 30, 46, 58, 66];
      ys.forEach((y, i) => { const up = i < 4 || i > 8; c1(ctx, 94 + i * 10, y + 2, 10, 5, up ? P.crimson : P.jade, P.white, up ? P.crimsonD : P.jadeD); });
      spr(ctx, FIG, 228, 64);
    } else if (id === 'everything-rally') { // the portfolio and the grocery bill
      for (let i = 0; i < 7; i++) c1(ctx, 90 + i * 16, 74 - (20 + i * 6), 13, 20 + i * 6, P.jade, P.phosphor, P.jadeD);
      c1(ctx, 210, 16, 32, 60, P.bone, P.white, P.putty2); for (let i = 0; i < 6; i++) R(ctx, 214, 22 + i * 7, 22 - (i % 3) * 4, 1, P.grey);
      R(ctx, 214, 66, 24, 2, P.crimson); for (let k = 0; k < 8; k++) R(ctx, 210 + k * 4, 75 + (k % 2), 3, 1, P.bone);
    } else if (id === 'lost-decade') { // ten calendars on a line
      R(ctx, 78, 20, 164, 1, P.grey2);
      for (let i = 0; i < 10; i++) { const x = 84 + i * 15, y = 22 + (i % 2) * 2; c1(ctx, x, y, 13, 18, P.bone, P.white, P.putty2); R(ctx, x + 1, y + 1, 11, 4, P.crimsonD); R(ctx, x + 5, y - 2, 2, 3, P.grey); }
      R(ctx, 78, 74, 164, 2, P.slate2);
    } else { // still standing: the desk, the monitor, the coffee
      c1(ctx, 104, 46, 112, 12, P.desk, P.desk2, P.deskD); R(ctx, 110, 58, 4, 16, P.deskD); R(ctx, 206, 58, 4, 16, P.deskD);
      c1(ctx, 140, 22, 40, 26, P.plasticD, P.plastic2, P.ink2); R(ctx, 145, 27, 30, 16, P.screenGlow); R(ctx, 148, 31, 18, 1, P.phosphor); R(ctx, 148, 35, 12, 1, P.sky);
      c1(ctx, 118, 34, 12, 13, P.bone, P.white, P.putty2); R(ctx, 120, 36, 8, 2, P.deskD); R(ctx, 130, 38, 2, 5, P.ink2);
    }
  }


  // ---------- scene scripts ----------

  const Scenes = {
    V,

    // Before the open: the news you wake up to.
    news(o) {
      const b = o.brief || {};
      const head = (b.title || '').replace(/<[^>]+>/g, '');
      const kick = (b.kicker || '').replace(/[^\w\s·&.-]/g, '').trim();
      return [
        {
          dur: 2.4,
          sfx: 'room',
          draw(ctx, _v, p) {
            if (!briefingTableau(ctx, o.day, p)) {
              apartment(ctx, p * 0.7);
              tvSet(ctx, 40, 50, 104, 68, head, kick, 1 - B.clamp(p * 1.6, 0, 1));
            }
          },
          line: '5:58 AM. The television is already on. It always is.'
        },
        {
          dur: 3.4,
          sfx: 'broadcast',
          draw(ctx, _v, p) {
            if (!briefingTableau(ctx, o.day, p)) {
              apartment(ctx, 0.7);
              // Push in on the TV, pivoting high enough that the lower-third
              // headline never slides under the caption box.
              const z = 1 + p * 0.34;
              const px = 92, py = 74;
              ctx.save();
              ctx.translate(px * (1 - z), py * (1 - z));
              ctx.scale(z, z);
              tvSet(ctx, 40, 50, 104, 68, head, kick, 0);
              ctx.restore();
            }
          },
          line: head || 'Markets open in three and a half hours.'
        }
      ];
    },

    // Getting to the desk. The last beat hands off to the live HUD.
    office(o) {
      const crash = o && o.brief && /crash|panic|collapse|halt/i.test(o.brief.title || '');
      return [
        {
          dur: 2.4,
          sfx: 'elevator',
          draw(ctx, _v, p) { elevator(ctx, B.clamp((p - 0.45) * 2.4, 0, 1), 41); },
          line: 'Forty-first floor. The doors take their time.'
        },
        {
          dur: 3.0,
          sfx: 'office',
          draw(ctx, _v, p) { tradingFloor(ctx, p * 0.35, true, 3); },
          line: 'Two hundred people, all of them certain about something different.'
        },
        {
          dur: 2.5,
          draw(ctx, _v, p) {
            tradingFloor(ctx, 0.35 + p * 0.65, true, 3);
            if (p > 0.55) {
              const f = (p - 0.55) / 0.45;
              ctx.save();
              ctx.globalAlpha = f;
              deskCloseup(ctx, 1, { crash });
              ctx.restore();
            }
          },
          line: ''
        },
        {
          dur: 1.8,
          draw(ctx, _v, p) {
            deskCloseup(ctx, 1, { crash });
            if (p > 0.55) {
              ctx.save();
              ctx.globalAlpha = (p - 0.55) / 0.45;
              X.rect(ctx, 0, 0, V.w, V.h, P.ink);
              ctx.restore();
            }
          },
          line: 'Sit down. Nine thirty.'
        }
      ];
    },

    // After the bell.
    close(o) {
      const r = o.report || {};
      const good = (r.pnl || 0) >= 0;
      const met = r.quotaMet;
      return [
        {
          dur: 2.5,
          sfx: 'closeBell',
          draw(ctx, _v, p) { bellScene(ctx, p, false); },
          line: '4:00 PM. Somebody rings it like they mean it.'
        },
        {
          dur: 3.2,
          sfx: 'office',
          draw(ctx, _v, p) {
            bellScene(ctx, 1, true);
            ctx.save();
            ctx.globalAlpha = 0.34 * p;
            X.rect(ctx, 0, 0, V.w, V.h, P.ink);
            ctx.restore();
            const bw = 200, bx = (V.w - bw) / 2 | 0;
            X.box(ctx, bx, 66, bw, 46);
            X.text(ctx, met ? 'QUOTA MET' : (r.quota > 0 ? 'QUOTA MISSED' : 'BELL TO BELL'),
              V.w / 2, 76, met ? P.jade : P.crimson, { align: 'center' });
            const amt = B.fmt.money(r.pnl || 0, true);
            const show = amt.slice(0, Math.max(1, Math.ceil(amt.length * B.clamp(p * 2, 0, 1))));
            X.textShadow(ctx, show, V.w / 2, 90, good ? P.jade : P.crimson, P.ink, { align: 'center', spacing: 2 });
          },
          line: good ? 'You made money. Nobody says well done.' : 'You lost money. Everybody noticed.'
        }
      ];
    },

    // One establishing shot before the newspaper page.
    ending(o) {
      const dark = !!o.dark;
      return [{
        dur: 3.6,
        sfx: 'room',
        draw(ctx, _v, p) {
          endingShot(ctx, dark ? 'dark' : 'light');
          endingDetail(ctx, o.id || 'grind', p);
          const t = B.clamp((p - 0.25) / 0.6, 0, 1);
          if (t <= 0) return;
          ctx.save();
          ctx.globalAlpha = t;
          X.box(ctx, 30, 70, 260, 40);
          X.textShadow(ctx, (o.title || '').slice(0, 30), V.w / 2, 82, dark ? P.crimson : P.amber, P.ink, { align: 'center', spacing: 2 });
          X.text(ctx, 'ENDING REACHED', V.w / 2, 96, P.grey2, { align: 'center' });
          ctx.restore();
        },
        line: o.deck ? String(o.deck).replace(/<[^>]+>/g, '').slice(0, 110) : ''
      }];
    }
  };

  B.Scenes = Scenes;
  // The hand-drawn 320x180 set pieces, for the storyboard layer to reuse at 2x.
  B.Shots = { V, setSeason, apartment, tvSet, elevator, tradingFloor, deskCloseup, bellScene, endingShot, briefingTableau, endingDetail };
})(window.BTB);
