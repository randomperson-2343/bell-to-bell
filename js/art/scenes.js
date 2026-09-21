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

  // ---------- reusable set pieces ----------

  // Pre-dawn apartment: one window, a TV throwing light on the far wall.
  function apartment(ctx, glow) {
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, 120, P.ink2, P.ink, 6);
    // window with a dead-blue city outside
    X.inset(ctx, 214, 24, 74, 56, P.slate, P.ink2, P.ink);
    X.gradient(ctx, 216, 26, 70, 52, P.slate2, P.ink2, 5);
    for (let i = 0; i < 7; i++) {
      const bx = 218 + i * 10, bh = 14 + ((i * 37) % 26);
      X.rect(ctx, bx, 78 - bh, 8, bh, P.ink2);
      for (let wy = 0; wy < bh - 3; wy += 4) {
        for (let wx = 0; wx < 6; wx += 3) {
          if (((i * 7 + wy + wx) % 5) < 2) X.rect(ctx, bx + 1 + wx, 78 - bh + 2 + wy, 2, 2, P.amberD);
        }
      }
    }
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
      lines.forEach((ln, i) => X.text(ctx, ln, x + 6, y + h - 6 + i * 8, P.amber));
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
      X.gradient(ctx, wx + 1, wy + 1, ww - 2, wh - 2, lit ? P.sky : P.slate, P.putty, 5);
      // skyline beyond
      for (let b = 0; b < 4; b++) {
        const bh = sw(8 + ((i * 5 + b * 11) % 20));
        X.rect(ctx, wx + 2 + b * sw(9), wy + wh - 1 - bh, sw(7), bh, P.slate);
      }
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
          const on = ((i * 7 + r * 3) % 5) !== 0;
          X.dither(ctx, x + sw(5), y - mh + sw(2), Math.max(1, per - sw(12)), Math.max(1, mh - sw(4)),
            P.screen, on ? P.jadeD : P.crimsonD, 0.4);
        }
        // desk slab + chair + a person, sometimes
        X.plate(ctx, x, y, per - sw(4), sw(4), P.desk, P.desk2, P.deskD);
        if (((i * 3 + r) % 3) !== 0) {
          X.rect(ctx, x + sw(10), y + sw(4), sw(9), sw(10), P.ink2);
          X.rect(ctx, x + sw(12), y + sw(1), sw(5), sw(4), P.slate2);
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
  function endingShot(ctx, kind) {
    const light = kind === 'light';
    // sky
    X.gradient(ctx, 0, 0, V.w, 130, light ? P.amber : P.slate2, light ? P.crimsonD : P.ink2, 9);
    // far skyline, flat silhouettes so the shape reads at a glance
    for (let i = 0; i < 11; i++) {
      const bw = 22 + ((i * 17) % 14);
      const bh = 26 + ((i * 41) % 58);
      const bx = i * 30 - 6;
      X.rect(ctx, bx, 132 - bh, bw, bh, light ? P.slate : P.ink2);
      for (let wy = 5; wy < bh - 5; wy += 7) {
        for (let wx = 4; wx < bw - 4; wx += 7) {
          const on = ((i * 5 + wy + wx) % (light ? 3 : 6)) < 2;
          if (on) X.rect(ctx, bx + wx, 132 - bh + wy, 3, 3, light ? P.amber : P.sky);
        }
      }
    }
    // foreground block + street
    X.rect(ctx, 0, 132, V.w, V.h - 132, P.ink);
    X.rect(ctx, 0, 132, V.w, 2, light ? P.amberD : P.slate);
    if (light) {
      // low sun flare on the street
      X.dither(ctx, 0, 134, V.w, 20, P.ink, P.amberD, 0.35);
    } else {
      X.speckle(ctx, 0, 0, V.w, 130, P.grey2, 0.003, 9);   // rain
      X.dither(ctx, 0, 134, V.w, 16, P.ink, P.slate, 0.25); // wet tarmac
    }
  }

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
      X.text(ctx, 'WITHDRAWAL QUEUE · MERCER STREET', 160, 120, P.white, { align: 'center' });
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
  function endingDetail(ctx, id, p) {
    const cx = 160;
    if (id === 'wiped') {
      for (let i = 0; i < 6; i++) {
        const drop = Math.round(p * i * 2);
        X.plate(ctx, 116 + i * 6, 22 + i * 7 + drop, 67 - i * 5, 7, P.bone, P.white, P.plasticD);
        X.rect(ctx, 121 + i * 6, 24 + i * 7 + drop, 21, 2, i > 2 ? P.crimson : P.sky);
      }
    } else if (id === 'fired') {
      X.plate(ctx, 126, 37, 68, 30, P.desk2, P.putty2, P.deskD);
      X.rect(ctx, 134, 43, 32, 4, P.crimsonD);
      X.text(ctx, 'PERSONAL', cx, 53, P.ink, { align: 'center' });
      X.rect(ctx, 145, 27, 30, 10, P.slate);
    } else if (id === 'perp') {
      for (let i = 0; i < 5; i++) X.rect(ctx, 112 + i * 24, 19, 7, 53, P.slate2);
      X.rect(ctx, 139, 34, 42, 28, P.ink2);
      X.rect(ctx, 151, 25, 18, 13, P.grey2);
      if (p > .45) X.dither(ctx, 80, 12, 160, 62, P.ink, P.white, .18);
    } else if (id === 'master') {
      X.rect(ctx, 86, 59, 148, 5, P.bone);
      X.rect(ctx, 106, 64, 104, 8, P.plastic2);
      X.rect(ctx, 138, 38, 42, 21, P.white);
      X.rect(ctx, 151, 24, 4, 34, P.slate2);
      X.rect(ctx, 155, 25, 39, 3, P.amber);
      X.dither(ctx, 0, 72, 320, 18, P.screen, P.sky, .35);
    } else if (id === 'whistle') {
      for (let i = 0; i < 4; i++) X.plate(ctx, 106 + i * 5, 25 + i * 7, 95, 13, P.bone, P.white, P.plasticD);
      X.rect(ctx, 122, 35, 57, 4, P.crimsonD);
      X.rect(ctx, 122, 46, 48, 2, P.grey);
      X.rect(ctx, 122, 54, 62, 2, P.grey);
    } else if (id === 'revolving') {
      for (let i = 0; i < 5; i++) X.rect(ctx, 102 + i * 28, 31, 8, 40, P.bone);
      X.rect(ctx, 94, 25, 132, 7, P.sky);
      X.rect(ctx, 90, 70, 140, 5, P.slate2);
      X.text(ctx, 'PRIVATE / PUBLIC', cx, 15, P.amber, { align: 'center' });
    } else if (id === 'depression') {
      for (let i = 0; i < 8; i++) {
        X.rect(ctx, 64 + i * 28, 30 + (i % 3) * 8, 20, 44 - (i % 3) * 8, P.ink2);
        if (i === 2) X.rect(ctx, 70 + i * 28, 39, 4, 4, P.crimsonD);
      }
      X.rect(ctx, 54, 73, 222, 4, P.crimsonD);
    } else if (id === 'soft') {
      for (let i = 0; i < 7; i++) {
        X.rect(ctx, 68 + i * 28, 38 + (i % 2) * 9, 21, 36, P.slate);
        for (let w = 0; w < 2; w++) X.rect(ctx, 73 + i * 28 + w * 8, 48, 4, 4, P.amber);
      }
      X.rect(ctx, 52, 74, 216, 4, P.jade);
    } else if (id === 'quiet') {
      X.rect(ctx, 111, 18, 98, 58, P.ink2);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) X.rect(ctx, 120 + x * 14, 25 + y * 12, 6, 5, x === 4 && y === 2 ? P.amber : P.screenD);
    } else if (id === 'replaced') {
      for (let i = 0; i < 4; i++) {
        X.plate(ctx, 98 + i * 34, 23, 27, 53, P.slate, P.slate2, P.ink);
        for (let r = 0; r < 4; r++) X.rect(ctx, 103 + i * 34, 30 + r * 10, 17, 5, P.screenGlow);
        X.rect(ctx, 105 + i * 34, 31, 2, 2, P.phosphor);
      }
    } else {
      X.plate(ctx, 108, 45, 104, 12, P.desk, P.desk2, P.deskD);
      X.plate(ctx, 143, 28, 34, 20, P.plastic, P.plastic2, P.plasticD);
      X.rect(ctx, 148, 33, 24, 10, P.screenGlow);
      X.rect(ctx, 122, 34, 12, 14, P.bone);
      X.rect(ctx, 124, 36, 8, 3, P.deskD);
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
})(window.BTB);
