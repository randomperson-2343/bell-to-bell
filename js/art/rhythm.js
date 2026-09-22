// Cinematic Rhythm presentation layer.
//
// The story is locked. This file never supplies plot, choices, market events or
// dialogue. It gives each of the 61 existing sessions a distinct visual
// storyboard, adds the physical phone handoff into the pre-open feed, and gives
// Friday closes a short weekend breath before Monday begins.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;
  const HV = { w: 480, h: 270 };

  const PLACES = [
    'apartment', 'subway', 'lobby', 'kitchen', 'street',
    'rideshare', 'elevator', 'platform', 'breakroom', 'desk'
  ];
  const CAMERAS = ['wide', 'profile', 'over-shoulder', 'reflection', 'low', 'compressed', 'still'];

  function board(day) {
    const d = Math.max(0, day | 0);
    const week = Math.floor(d / 5) + 1;
    const place = PLACES[d % PLACES.length];
    const camera = CAMERAS[Math.floor(d / PLACES.length) % CAMERAS.length];
    const act = d < 15 ? 1 : d < 30 ? 2 : d < 45 ? 3 : 4;
    return {
      day: d, week, place, camera, act,
      // The tuple stays unique across the 61-session campaign without writing
      // any new narrative fact into the game.
      signature: `${place}:${week}:${camera}`
    };
  }

  const STORYBOARDS = Array.from({ length: 61 }, (_, day) => board(day));

  function paletteFor(act) {
    if (act === 2) return { wash: P.violet, signal: P.sky, dark: P.ink2 };
    if (act === 3) return { wash: P.sky, signal: P.crimson, dark: P.screenD };
    if (act === 4) return { wash: P.crimsonD, signal: P.crimson, dark: P.ink };
    return { wash: P.amberD, signal: P.amber, dark: P.ink2 };
  }

  function label(ctx, text, x, y, color, align) {
    X.textShadow(ctx, String(text || '').slice(0, 54), x, y, color || P.bone, P.ink, { align: align || 'left' });
  }

  function city(ctx, y, act, seed) {
    const q = paletteFor(act);
    X.gradient(ctx, 0, 0, HV.w, y, q.dark, P.ink, 10);
    for (let i = 0; i < 22; i++) {
      const w = 12 + ((i * 19 + seed * 7) % 19);
      const h = 24 + ((i * 37 + seed * 13) % 74);
      const x = i * 23 - 9;
      X.rect(ctx, x, y - h, w, h, i % 3 ? P.ink2 : P.slate);
      for (let wy = 6; wy < h - 4; wy += 8) {
        for (let wx = 4; wx < w - 3; wx += 7) {
          if ((i * 11 + wy + wx + seed) % 9 < 2) X.rect(ctx, x + wx, y - h + wy, 2, 2, q.wash);
        }
      }
    }
  }

  function person(ctx, x, y, scale, facing, act) {
    const s = scale || 1;
    const dir = facing < 0 ? -1 : 1;
    const skin = act > 2 ? P.deskD : P.desk2;
    X.rect(ctx, x - 13 * s, y, 26 * s, 48 * s, P.ink2);
    X.rect(ctx, x - 8 * s, y - 16 * s, 16 * s, 18 * s, skin);
    X.rect(ctx, x - 9 * s, y - 18 * s, 18 * s, 6 * s, P.ink);
    X.rect(ctx, x + dir * 7 * s, y - 8 * s, 2 * s, 2 * s, P.ink);
  }

  function newsScreen(ctx, x, y, w, h, head, kick, act, p) {
    const q = paletteFor(act);
    X.plate(ctx, x - 5, y - 5, w + 10, h + 12, P.plastic, P.plastic2, P.plasticD);
    X.crt(ctx, x, y, w, h, true);
    X.gradient(ctx, x + 2, y + 2, w - 4, h - 19, P.screenGlow, P.screen, 6);
    const cx = x + (w / 2 | 0);
    X.rect(ctx, cx - 11, y + 19, 22, 24, P.ink2);
    X.rect(ctx, cx - 7, y + 8, 14, 14, P.slate2);
    X.rect(ctx, cx - 7, y + 8, 14, 4, P.ink);
    X.rect(ctx, x + 2, y + h - 22, w - 4, 20, q.signal);
    X.rect(ctx, x + 2, y + h - 22, w - 4, 4, P.ink2);
    label(ctx, (kick || 'OVERNIGHT WIRE').slice(0, 25), x + 7, y + h - 20, P.bone);
    const lines = X.wrap(head || '', w - 16).slice(0, 2);
    lines.forEach((line, i) => label(ctx, line, x + 7, y + h - 13 + i * 8, P.ink));
    if (p < .16) X.speckle(ctx, x + 2, y + 2, w - 4, h - 4, P.grey2, .16, act * 19);
    X.scanlines(ctx, x + 2, y + 2, w - 4, h - 4, P.ink, .12);
  }

  function phone(ctx, x, y, w, h, open, feed, act) {
    const q = paletteFor(act);
    X.plate(ctx, x, y, w, h, P.ink2, P.slate2, P.ink);
    X.rect(ctx, x + 5, y + 7, w - 10, h - 14, P.screen);
    X.rect(ctx, x + w / 2 - 16, y + 3, 32, 4, P.ink);
    X.rect(ctx, x + w / 2 - 2, y + h - 5, 4, 2, P.slate2);
    label(ctx, '6:' + String(3 + (act * 7) % 5) + '8', x + 9, y + 12, P.grey2);
    if (!open) {
      X.rect(ctx, x + 12, y + 32, w - 24, 1, P.slate);
      X.rect(ctx, x + 12, y + 43, w - 38, 2, q.wash);
      X.rect(ctx, x + 12, y + 51, w - 51, 2, P.slate2);
      return;
    }
    const shown = Math.min(4, Math.max(2, (feed || []).length));
    for (let i = 0; i < shown; i++) {
      const item = feed[i] || {};
      const yy = y + 29 + i * 34;
      X.rect(ctx, x + 10, yy, w - 20, 29, i === 0 ? P.screenGlow : P.screenD);
      X.rect(ctx, x + 10, yy, 3, 29, item.kind === 'chirp' ? P.violet : item.kind === 'mail' ? P.amber : P.sky);
      label(ctx, (item.source || 'WIRE').slice(0, 18), x + 18, yy + 5, q.wash);
      label(ctx, (item.title || 'Before the bell').slice(0, 26), x + 18, yy + 16, P.bone);
    }
  }

  function establish(ctx, sb, head, kick, p) {
    const q = paletteFor(sb.act);
    X.rect(ctx, 0, 0, HV.w, HV.h, P.ink);
    city(ctx, 181, sb.act, sb.day);

    switch (sb.place) {
      case 'subway':
        X.rect(ctx, 0, 0, HV.w, HV.h, P.plasticD);
        X.rect(ctx, 0, 18, HV.w, 166, P.plastic);
        for (let i = 0; i < 5; i++) X.inset(ctx, 20 + i * 92, 36, 72, 67, P.screenD, P.plastic2, P.plasticD);
        X.rect(ctx, 0, 184, HV.w, 86, P.carpetD);
        for (let i = 0; i < 6; i++) { X.rect(ctx, 38 + i * 76, 18, 3, 31, P.slate); X.rect(ctx, 27 + i * 76, 46, 25, 4, P.slate2); }
        newsScreen(ctx, 164, 28, 152, 83, head, kick, sb.act, p);
        person(ctx, 78, 156, 2, 1, sb.act); person(ctx, 401, 160, 2, -1, sb.act);
        break;
      case 'lobby':
        X.gradient(ctx, 0, 0, HV.w, 206, P.putty2, P.putty, 8);
        X.rect(ctx, 0, 206, HV.w, 64, P.slate);
        X.inset(ctx, 28, 31, 220, 142, P.screenD, P.plastic2, P.plasticD);
        newsScreen(ctx, 48, 46, 180, 110, head, kick, sb.act, p);
        X.plate(ctx, 336, 22, 104, 184, P.plastic, P.plastic2, P.plasticD);
        X.rect(ctx, 386, 31, 4, 166, P.plasticD);
        person(ctx, 299, 172, 2, -1, sb.act);
        break;
      case 'kitchen':
      case 'breakroom':
        X.gradient(ctx, 0, 0, HV.w, 195, P.putty2, P.putty, 7);
        X.rect(ctx, 0, 195, HV.w, 75, P.desk);
        for (let i = 0; i < 7; i++) X.plate(ctx, 12 + i * 68, 43, 58, 47, P.plastic, P.plastic2, P.plasticD);
        newsScreen(ctx, 284, 31, 166, 104, head, kick, sb.act, p);
        X.plate(ctx, 61, 166, 54, 47, P.bone, P.white, P.plasticD);
        X.rect(ctx, 66, 170, 44, 7, P.deskD);
        person(ctx, 194, 175, 2, 1, sb.act);
        break;
      case 'street':
      case 'platform':
        X.rect(ctx, 0, 181, HV.w, 89, P.ink2);
        X.dither(ctx, 0, 181, HV.w, 40, P.ink2, P.slate, .32);
        X.plate(ctx, 271, 28, 179, 124, P.slate, P.slate2, P.ink);
        newsScreen(ctx, 286, 42, 149, 95, head, kick, sb.act, p);
        for (let i = 0; i < 4; i++) person(ctx, 58 + i * 74 + Math.round(p * (i % 2 ? -7 : 7)), 176, 2, i % 2 ? -1 : 1, sb.act);
        break;
      case 'rideshare':
        X.rect(ctx, 0, 0, HV.w, HV.h, P.ink2);
        X.gradient(ctx, 64, 22, 352, 135, P.slate2, P.ink2, 8);
        city(ctx, 154, sb.act, sb.day);
        X.rect(ctx, 0, 157, HV.w, 113, P.ink);
        X.plate(ctx, 190, 61, 100, 126, P.slate, P.slate2, P.ink);
        newsScreen(ctx, 205, 77, 70, 73, head, kick, sb.act, p);
        person(ctx, 48, 184, 2, 1, sb.act); person(ctx, 432, 184, 2, -1, sb.act);
        break;
      case 'elevator':
        X.gradient(ctx, 0, 0, HV.w, HV.h, P.plastic2, P.plasticD, 8);
        for (let i = 0; i < 8; i++) X.rect(ctx, i * 64, 0, 2, HV.h, P.plastic);
        newsScreen(ctx, 157, 31, 166, 111, head, kick, sb.act, p);
        X.inset(ctx, 421, 52, 28, 57, P.ink, P.plastic2, P.plasticD);
        for (let i = 0; i < 4; i++) X.rect(ctx, 430, 61 + i * 11, 10, 4, i === sb.act - 1 ? q.signal : P.slate2);
        person(ctx, 91, 178, 2, 1, sb.act); person(ctx, 390, 178, 2, -1, sb.act);
        break;
      case 'desk':
        X.gradient(ctx, 0, 0, HV.w, 174, P.putty2, P.putty, 7);
        X.rect(ctx, 0, 174, HV.w, 96, P.desk);
        X.plate(ctx, 30, 36, 270, 155, P.plastic, P.plastic2, P.plasticD);
        newsScreen(ctx, 48, 51, 234, 121, head, kick, sb.act, p);
        X.plate(ctx, 328, 55, 120, 137, P.plastic, P.plastic2, P.plasticD);
        X.crt(ctx, 341, 69, 94, 95, true);
        for (let i = 0; i < 6; i++) X.rect(ctx, 351, 79 + i * 13, 70 - i * 4, 3, i < 2 ? q.wash : P.phosphorD);
        break;
      default:
        X.gradient(ctx, 0, 0, HV.w, 197, P.ink2, P.ink, 8);
        X.rect(ctx, 0, 197, HV.w, 73, P.ink2);
        X.inset(ctx, 330, 28, 111, 82, P.slate, P.ink2, P.ink);
        city(ctx, 108, sb.act, sb.day);
        newsScreen(ctx, 45, 72, 190, 111, head, kick, sb.act, p);
        X.plate(ctx, 269, 173, 151, 31, P.slate, P.slate2, P.ink);
        person(ctx, 305, 184, 2, -1, sb.act);
        break;
    }

    // Every board receives a different crop marker and light pattern. These are
    // visual production notes made visible as framing, not story text.
    const crop = (sb.week * 17 + sb.day * 3) % 66;
    ctx.save();
    ctx.globalAlpha = .14;
    X.rect(ctx, crop, 0, 2, HV.h, q.wash);
    X.rect(ctx, 0, 20 + (sb.day * 11) % 92, HV.w, 1, q.wash);
    ctx.restore();
  }

  function phonePocket(ctx, p, sb, feed) {
    X.rect(ctx, 0, 0, HV.w, HV.h, P.ink);
    X.gradient(ctx, 0, 0, HV.w, HV.h, P.ink2, P.ink, 7);
    // Coat and pocket in close-up.
    X.rect(ctx, 0, 0, 287, HV.h, P.slate);
    X.dither(ctx, 0, 0, 287, HV.h, P.slate, P.ink2, .24);
    X.rect(ctx, 48, 90, 171, 135, P.ink2);
    X.rect(ctx, 48, 90, 171, 5, P.slate2);
    const rise = Math.round(B.clamp(p * 1.35, 0, 1) * 108);
    const px = 91, py = 131 - rise;
    phone(ctx, px, py, 94, 158, p > .58, feed, sb.act);
    // Hand and fingers overlap the device so it reads as an object being taken.
    X.rect(ctx, 178, 167 - rise * .45, 86, 46, P.desk2);
    X.rect(ctx, 165, 144 - rise * .45, 26, 18, P.desk2);
    for (let i = 0; i < 4; i++) X.rect(ctx, 184 + i * 17, 153 - rise * .45, 13, 35, P.desk2);
    X.rect(ctx, 287, 0, 193, HV.h, P.ink2);
    X.dither(ctx, 287, 0, 193, HV.h, P.ink2, paletteFor(sb.act).wash, .08);
    label(ctx, 'PRE-OPEN', 382, 93, paletteFor(sb.act).wash, 'center');
    label(ctx, String((feed || []).length) + ' NOTIFICATIONS', 382, 111, P.bone, 'center');
  }

  function phoneClose(ctx, p, sb, feed) {
    X.rect(ctx, 0, 0, HV.w, HV.h, P.ink);
    X.dither(ctx, 0, 0, HV.w, HV.h, P.ink, paletteFor(sb.act).wash, .08);
    const w = 170, h = 238, x = (HV.w - w) / 2, y = 14;
    phone(ctx, x, y, w, h, p > .18, feed, sb.act);
    // Thumb moves toward the first notification, handing control to the DOM UI.
    const tx = 338 - Math.round(p * 36), ty = 232 - Math.round(p * 131);
    X.rect(ctx, tx, ty, 65, 45, P.desk2);
    X.rect(ctx, tx - 14, ty - 8, 29, 20, P.desk2);
  }

  function weekendFrame(ctx, week, act, night, p) {
    const q = paletteFor(act);
    X.rect(ctx, 0, 0, HV.w, HV.h, P.ink);
    X.gradient(ctx, 0, 0, HV.w, 189, night ? P.ink2 : P.sky, P.ink, 9);
    city(ctx, 189, act, week * 9);
    X.rect(ctx, 0, 189, HV.w, 81, night ? P.ink2 : P.carpetD);
    X.plate(ctx, 67, 159, 266, 41, P.slate, P.slate2, P.ink);
    X.plate(ctx, 357, 147, 54, 79, P.ink2, P.slate2, P.ink);
    X.rect(ctx, 364, 158, 40, 53, P.screen);
    if (night) {
      for (let i = 0; i < 5; i++) X.rect(ctx, 370, 166 + i * 8, 26 + (i % 2) * 8, 2, i < 2 ? q.signal : P.phosphorD);
    } else {
      X.rect(ctx, 375, 178, 18, 18, q.wash);
      X.rect(ctx, 382, 168, 4, 39, P.bone);
    }
    // Phone remains present even in the quiet shot, increasingly bright by act.
    phone(ctx, 271, 166, 30, 50, night && p > .35, [], act);
    if (act >= 3 && night) X.rect(ctx, 269, 164, 34, 54, q.signal);
  }

  B.Rhythm = {
    view: HV,
    storyboards: STORYBOARDS,
    storyboard(day) { return STORYBOARDS[day] || board(day); }
  };

  // Replace the repeated apartment/TV opener with a 61-board visual grammar.
  B.Scenes.news = function (o) {
    const b = o.brief || {};
    const sb = B.Rhythm.storyboard(o.day || 0);
    const head = String(b.title || '').replace(/<[^>]+>/g, '');
    const kick = String(b.kicker || '').replace(/[^\w\s·&.-]/g, '').trim();
    const date = B.Calendar && B.Calendar.storyLabel ? B.Calendar.storyLabel(o.day || 0) : `SESSION ${(o.day || 0) + 1}`;
    return [
      {
        view: HV, dur: 2.35, sfx: sb.place === 'elevator' ? 'elevator' : 'room',
        draw(ctx, _v, p) { establish(ctx, sb, head, kick, p * .45); },
        line: date.toUpperCase()
      },
      {
        view: HV, dur: 3.0, sfx: 'broadcast',
        draw(ctx, _v, p) { establish(ctx, sb, head, kick, .45 + p * .55); },
        line: head
      },
      {
        view: HV, dur: 1.25, sfx: 'room',
        draw(ctx) {
          establish(ctx, sb, head, kick, 1);
          ctx.save(); ctx.globalAlpha = .18; X.rect(ctx, 0, 0, HV.w, HV.h, P.ink); ctx.restore();
        },
        line: ''
      }
    ];
  };

  B.Scenes.phone = function (o) {
    const sb = B.Rhythm.storyboard(o.day || 0);
    const feed = (o.brief && o.brief.feed) || [];
    return [
      { view: HV, dur: 2.0, sfx: 'room', draw(ctx, _v, p) { phonePocket(ctx, p, sb, feed); }, line: '' },
      { view: HV, dur: 2.25, sfx: 'news', draw(ctx, _v, p) { phoneClose(ctx, p, sb, feed); }, line: 'PRE-OPEN FEED' }
    ];
  };

  B.Scenes.weekend = function (o) {
    const day = o.day || 0;
    const sb = B.Rhythm.storyboard(day);
    return [
      { view: HV, dur: 2.4, sfx: 'room', draw(ctx, _v, p) { weekendFrame(ctx, sb.week, sb.act, false, p); }, line: `WEEK ${sb.week} · SATURDAY` },
      { view: HV, dur: 2.8, sfx: 'room', draw(ctx, _v, p) { weekendFrame(ctx, sb.week, sb.act, true, p); }, line: 'SUNDAY · 11:48 PM' },
      { view: HV, dur: 1.4, draw(ctx, _v, p) { weekendFrame(ctx, sb.week, sb.act, true, 1); ctx.save(); ctx.globalAlpha = p; X.rect(ctx, 0, 0, HV.w, HV.h, P.ink); ctx.restore(); }, line: '' }
    ];
  };
})(window.BTB);
