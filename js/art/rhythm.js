// V4.1 authored 640x360 storyboard layer. The story remains in StoryData;
// this file owns only composition, timing and visual treatment.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal;
  const V = { w: 640, h: 360 };
  const PLACES = ['apartment','subway','lobby','kitchen','street','rideshare','elevator','platform','breakroom','desk'];
  const CAMERAS = ['wide','profile','over-shoulder','insert','close','desk'];
  const ENDING_IDS = ['wiped','fired','exit','nobody','master','whistle','revolving','perp','fall-guy','cassandra','acquirer','ward','clawback','right-early','fund','everything-rally','lost-decade','soft','quiet','replaced','depression','grind'];

  // Which way the market went on a session, from the authored scenario: the
  // charts follow the tape, not the act. Pre-open frames show yesterday.
  function marketDown(day) {
    const D = B.StoryData;
    if (!D || !D.DAYS || day < 0 || !D.DAYS[day]) return false;
    try {
      const g = B.UI && B.UI.g;
      const S = g && g.mode && g.mode.S ? g.mode.S : (B.StoryMode && B.StoryMode.freshState ? B.StoryMode.freshState(250000) : { m: {}, rel: {}, f: {}, choices: {} });
      const m = D.DAYS[day].scen(S).market || {};
      return (m.target || 0) < 0;
    } catch (e) { return false; }
  }
  function clean(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
  function board(day) {
    const d = Math.max(0, day | 0), act = B.StoryData.actIndex(d) + 1;
    const place = PLACES[d % PLACES.length], camera = CAMERAS[(Math.floor(d / 5) + d) % CAMERAS.length];
    const crop = { wide: 0, profile: -42, 'over-shoulder': 36, insert: -88, close: 74, desk: 18 }[camera];
    return { day: d, week: Math.floor(d / 5) + 1, act, place, camera, crop,
      signature: `${d + 1}:${place}:${camera}:${crop}` };
  }

  function colors(act) {
    return act === 4 ? { wash:P.crimsonD, signal:P.crimson, sky:P.ink2 }
      : act === 3 ? { wash:P.sky, signal:P.crimson, sky:P.screenD }
      : act === 2 ? { wash:P.violet, signal:P.sky, sky:P.ink2 }
      : { wash:P.amberD, signal:P.amber, sky:P.ink2 };
  }
  function text(ctx, value, x, y, color, align) {
    X.textShadow(ctx, clean(value).slice(0, 80), x, y, color || P.bone, P.ink, { align: align || 'left' });
  }
  // The calendar runs from October into the new year: amber dawns first, then
  // grey six-o'clock darkness, then snow. Every exterior reads this. The weather
  // follows each session's original calendar slot, so the shorter story still
  // ends in snow.
  function season(day) {
    const D = B.StoryData.DAYS[day], week = Math.floor(Math.max(0, D ? D.sid : day | 0) / 5) + 1;
    if (week <= 4) return { id: 'autumn', week, dawn: P.amberD, glow: 0.34, snow: 0 };
    if (week <= 9) return { id: 'grey', week, dawn: P.slate, glow: 0.22, snow: 0 };
    return { id: 'winter', week, dawn: P.slate2, glow: 0.16, snow: Math.min(1, (week - 9) / 3), wreath: week >= 11 };
  }
  // Sky over the horizon line at y for a given day, then weather on top.
  function sky(ctx, x, y0, w, h, day, top) {
    const s = season(day);
    X.gradient(ctx, x, y0, w, h, top || P.ink2, P.ink, 10);
    X.dither(ctx, x, y0 + Math.round(h * 0.55), w, Math.round(h * 0.45), P.ink, s.dawn, s.glow);
    return s;
  }
  // noSpeckle: the layered office windows swap the still snow texture for falling snow; autumn leaves stay.
  function weather(ctx, x, y0, w, h, day, noSpeckle) {
    const s = season(day);
    if (s.snow) {
      if (noSpeckle) return s;
      X.speckle(ctx, x, y0, w, h, P.bone, 0.006 + s.snow * 0.01, 7 + (day | 0));
      X.speckle(ctx, x, y0, w, h, P.white, 0.002 + s.snow * 0.004, 31 + (day | 0));
    } else if (s.id === 'autumn') {
      for (let i = 0; i < 9; i++) {
        const k = (i * 97 + (day | 0) * 31) % 1000;
        X.rect(ctx, x + (k * 7) % w, y0 + (k * 13) % h, 3, 2, i % 2 ? P.amber : P.crimsonD);
      }
    }
    return s;
  }
  // The skyline's towers: x, width and height of tower i (they are drawn in this order, each over the one before).
  const towerOf = (i, seed) => ({ w: 10 + ((i * 17 + seed * 3) % 22), h: 34 + ((i * 41 + seed * 11) % 128), x: i * 20 - 9 });
  // The lit windows of tower i: 2x2 rectangles, tower-relative offsets in (xx, yy).
  function towerWindows(i, seed, y) {
    const t = towerOf(i, seed), out = [];
    for (let yy = 7; yy < t.h - 5; yy += 10) for (let xx = 4; xx < t.w - 3; xx += 8) {
      if ((i * 13 + xx + yy + seed) % 11 < 2) out.push({ x: t.x + xx, y: y - t.h + yy, w: 2, h: 2 });
    }
    return out;
  }
  // The lit window rectangles of skyline(ctx, act, seed, y), all towers, in drawing order. `shown` is false for a window that a later tower
  // (drawn over it) hides completely.
  function skylineWindows(act, seed, y) {
    y = y || 248;
    const out = [];
    for (let i = 0; i < 34; i++) towerWindows(i, seed, y).forEach((w) => {
      let shown = true;
      for (let j = i + 1; j < 34 && shown; j++) {
        const t = towerOf(j, seed);
        if (w.x >= t.x && w.x + w.w <= t.x + t.w && w.y >= y - t.h) shown = false;
      }
      out.push(Object.assign(w, { shown }));
    });
    return out;
  }
  // The authored skyline (news/skyline, 320x84 cells at 2x; frames a/b/c by day % 3, snow:a/b/c once it snows). Its dark 2x2-cell windows
  // are listed here (x, y in cells, from the grid header); the same (k*13+seed)%11<2 rule as the code towers lights some of them.
  const SKY_WIN = {
    a: '5,67 6,32 6,65 18,57 18,77 28,39 28,72 44,55 51,55 54,45 58,55 82,26 82,59 82,61 89,61 110,55 114,37 114,57 121,37 121,57 128,24 128,37 128,57 150,55 157,55 162,30 162,63 176,43 176,63 183,43 183,63 190,43 190,63 194,58 210,53 210,73 217,53 217,73 222,42 222,75 240,56 244,49 251,49 266,32 266,65 274,59 281,59 288,54 288,59 296,54 304,39 304,69 311,39 311,69',
    b: '0,65 7,65 12,36 12,69 22,63 29,63 36,63 40,35 40,68 56,69 63,69 72,57 84,55 84,75 91,55 91,75 98,55 98,75 122,36 122,69 144,64 146,59 152,64 153,59 160,59 178,28 178,61 180,57 180,77 187,57 187,77 206,36 206,69 208,57 215,57 222,57 228,28 228,61 240,55 240,75 247,55 247,75 250,44 250,77 258,44 258,77 270,55 277,55 284,47 284,55 302,53 302,73 309,53 309,73 316,53 316,73',
    c: '14,67 16,50 21,67 32,38 32,71 40,38 40,71 42,53 49,53 62,39 62,72 66,75 73,75 80,75 82,56 90,56 98,71 105,71 110,64 118,64 124,63 131,63 138,63 144,16 144,49 154,59 161,59 166,47 174,47 176,57 176,77 183,57 183,77 188,60 190,57 190,77 196,60 208,51 212,39 212,72 215,51 236,61 243,61 250,62 260,51 267,51 272,42 272,75 274,51 290,53 297,53 300,53 304,53'
  };
  const SKY_PTS = {};
  const skyPts = (v) => SKY_PTS[v] || (SKY_PTS[v] = SKY_WIN[v].split(' ').map((p) => p.split(',').map(Number)));
  const skyArt = () => !!(B.Art && B.Art.has('news/skyline'));
  const skyVar = (day, seed) => 'abc'[Math.abs((day == null ? seed : day) | 0) % 3];
  // The lit window rects (px) of the authored skyline at baseline y: [{x, y, w, h}], for the shots that light them themselves.
  function skylineLit(seed, y, day) {
    y = y || 248;
    const top = y - 168;
    return skyPts(skyVar(day, seed)).filter((p, k) => (k * 13 + seed) % 11 < 2).map((p) => ({ x: p[0] * 2, y: top + p[1] * 2, w: 4, h: 4 }));
  }
  // noSpeckle (optional): the still snow speckle is left out where falling snow is drawn instead; autumn leaves stay.
  // o.noWindows (optional): the lit windows are left out (a shot draws them itself).
  function skyline(ctx, act, seed, y, day, noSpeckle, o) {
    const c = colors(act); y = y || 248;
    X.gradient(ctx, 0, 0, V.w, y, c.sky, P.ink, 12);
    const s = day == null ? null : season(day);
    if (s) X.dither(ctx, 0, Math.round(y * 0.6), V.w, Math.round(y * 0.4), P.ink, s.dawn, s.glow);
    if (skyArt()) {
      const v = skyVar(day, seed);
      // snow:<v> is a cap overlay on the same canvas, so winter draws the towers first and the caps on top.
      if (X.drawArt(ctx, 'news/skyline', v, 0, y - 168, { scale: 2 })) {
        if (s && s.snow) X.drawArt(ctx, 'news/skyline', 'snow:' + v, 0, y - 168, { scale: 2 });
        if (!(o && o.noWindows)) skylineLit(seed, y, day).forEach((q) => X.rect(ctx, q.x, q.y, q.w, q.h, c.wash));
        if (s) weather(ctx, 0, 0, V.w, y - 20, day, noSpeckle);
        return;
      }
    }
    for (let i = 0; i < 34; i++) {
      const t = towerOf(i, seed), w = t.w, h = t.h, x = t.x;
      X.rect(ctx, x, y - h, w, h, i % 4 ? P.ink2 : P.slate);
      if (s && s.snow) X.rect(ctx, x, y - h, w, 2, P.bone);
      if (!(o && o.noWindows)) towerWindows(i, seed, y).forEach((q) => X.rect(ctx, q.x, q.y, 2, 2, c.wash));
    }
    if (s) weather(ctx, 0, 0, V.w, y - 20, day, noSpeckle);
  }
  // Lit cels on the 3px grid, shared with the apartment and the rooms.
  const cel3 = (ctx, x, y, w, h, base, hi, sh) => X.cel(ctx, x, y, w, h, base, hi, sh, P.ink2, 3);
  const celIn = (ctx, x, y, w, h, base, hi, sh) => X.cel(ctx, x, y, w, h, base, sh, hi, P.ink2, 3);
  // A commuter or colleague in outline: coat with a lit edge, collar, head,
  // hair, and an eye on the side they face. Scale s is the pixel size.
  // Outlined three-quarter figures, lit from the top left like the pet sprite.
  // Each sprite pixel is 2*scale; row 10 (the collar) sits at y. Templates use
  // stand-in letters (H hair, S skin, K coat, T tie, W shirt, L trousers) that
  // each cast member swaps for palette keys, so you are always the same person
  // and the strangers around you are not.
  const HEADS = {
    short: ['.....000000.....', '....0hhHHHH0....', '...0hHHHHHHH0...', '...0HHHHHHSS0...', '...0HHSSSSSS0...',
            '...0HsSSSS0S0...', '...0SSSSSSSSs0..', '...0SSSSSSSs0...', '....0SSSSSs0....', '.....0ssss0.....'],
    long:  ['.....000000.....', '....0hhHHHH0....', '...0hHHHHHHH0...', '..0hHHHHHHSS0...', '..0HHHHSSSSS0...',
            '..0HHHsSSS0S0...', '..0HHHSSSSSSs0..', '..0HHHSSSSSs0...', '..0HHH0SSSs0....', '..0HHH00ss0.....'],
    bald:  ['.....000000.....', '....0SSSSSS0....', '...0SSSSSSSS0...', '...0HHSSSSSS0...', '...0HHSSSSSS0...',
            '...0HsSSSS0S0...', '...0SSSSSSSSs0..', '...0SSSSSSSs0...', '....0SSSSSs0....', '.....0ssss0.....']
  };
  const BODY = [
    '....00WWTW00....', '..00kkWWTWKx00..', '.0kkkKkWTWKKxx0.', '0kkkKKKkTkKKKxx0', '0kkxKKKKTKKKxxx0',
    '0kkxKKKKTKKKxxx0', '0kkxKKKKKKKKxxx0', '0kkxKKKK0KKKxxx0', '0kkxKKKKKKKKxxx0', '0kkxKKKKKKKKxxx0',
    '0kkxKKKK0KKKxxx0', '0kkxKKKKKKKKxxx0', '0kkxKkkKKKKKxxx0', '0kkxKKKKKKKKxxx0', '0kkxKKKKKKKxxxx0',
    '0SS0KKKKKKKx0ss0', '.00.0xxxxxxx000.', '....0lLL0lLL0...', '....0lLL0lLL0...', '....0lLL0lLL0...',
    '....0lLL0lLL0...', '....0000000000..'
  ];
  const CAST = [
    { head: 'short', H: '1', h: '2', S: 'e', s: 'D', K: '2', k: '3', x: '1', W: '8', T: 'r', L: '1', l: '2' },
    { head: 'long',  H: 'A', h: 'a', S: 'e', s: 'D', K: 'C', k: 'v', x: 'c', W: '8', T: '8', L: '1', l: '2' },
    { head: 'bald',  H: '4', h: '5', S: 'e', s: 'D', K: 'd', k: 'D', x: '1', W: '8', T: 'J', L: '2', l: '3' },
    { head: 'short', H: '1', h: '3', S: 'D', s: 'd', K: '4', k: '5', x: '2', W: '9', T: 'b', L: '1', l: '2' }
  ];
  const FIG_SP = {};
  function figureSprite(who, late) {
    const key = who + (late ? 'L' : '');
    if (FIG_SP[key]) return FIG_SP[key];
    const m = Object.assign({}, CAST[who]);
    if (late && who === 0) Object.assign(m, { K: '3', k: '4', x: '2' });
    const rows = HEADS[m.head].concat(BODY).map((r) => r.replace(/[HhSsKkxWTLl]/g, (ch) => m[ch]));
    return (FIG_SP[key] = X.sprite(rows));
  }
  // who: 0 is you; 1-3 are the strangers on your commute.
  // The authored commuters (who 1..3): news/commuters (16x32 cells) at 2*scale for scale 1, news/commuters-big (32x64) at scale from 2 up, so at scale 2 they share the 2 px world pixel with you.
  // You (who 0): news/you, 88x128 cells at 2 px (the world's pixel), centre column 44, head top at y - 20*s (s is the framing: 3 over-shoulder, 4 close);
  // pose 'back' (over-shoulder), 'front' (close) or 'side', ':late' after act 2.
  function youArt(ctx, x, y, s, face, pose, act) {
    if (!(B.Art && B.Art.has('news/you'))) return false;
    ctx.save();
    ctx.translate(x, y - 20 * s);
    ctx.scale(face < 0 ? -1 : 1, 1);
    const ok = X.drawArt(ctx, 'news/you', (pose || 'front') + (act > 2 ? ':late' : ''), -88, 0, { scale: 2 });
    ctx.restore();
    return ok;
  }
  function personArt(ctx, x, y, s, face, who) {
    const big = s >= 2, id = big ? 'news/commuters-big' : 'news/commuters';
    if (who < 1 || who > 3 || !(B.Art && B.Art.has(id))) return false;
    ctx.save();
    ctx.translate(x, y - 20 * s);
    ctx.scale(face < 0 ? -1 : 1, 1);
    const ok = X.drawArt(ctx, id, 'who' + who, -16 * s, 0, { scale: big ? s : 2 * s });
    ctx.restore();
    return ok;
  }
  // The boxes the people occupy in the shot being drawn, so the fine marks (storyboard finePass) leave them alone: placeFrame clears it.
  const peopleBoxes = [];
  function person(ctx, x, y, scale, act, face, who, pose) {
    const s = scale || 1;
    const box = (B.Art && B.Art.has('news/you') && !who && pose) ? { x: x - 78, y: y - 20 * s, w: 156, h: 400 }
      : (who && B.Art && B.Art.has('news/commuters-big')) ? { x: x - 34, y: y - 20 * s, w: 68, h: 400 } : null;
    if (box && !peopleBoxes.some((b) => b.x === box.x && b.y === box.y)) peopleBoxes.push(box);
    if (who && personArt(ctx, x, y, s, face, who)) return;
    if (!who && pose && youArt(ctx, x, y, s, face, pose, act)) return;
    ctx.save();
    ctx.translate(x, y - 20 * s);
    ctx.scale((face < 0 ? -2 : 2) * s, 2 * s);
    X.drawSprite(ctx, figureSprite(who || 0, act > 2), -8, 0);
    ctx.restore();
  }
  // The wire monitor's screen (the CRT) and the headline band on it, for a monitor rect: the authored bezel leaves a 6 px inset
  // at the sides and top and a 10 px chin, so the screen is (x+6, y+6, w-12, h-16) and the band is its bottom 45 px.
  function monitorScreen(G) {
    const sc = { x: G.x + 6, y: G.y + 6, w: G.w - 12, h: G.h - 16 };
    return { screen: sc, band: { x: sc.x, y: sc.y + sc.h - 45, w: sc.w, h: 45 } };
  }
  function monitor(ctx, x, y, w, h, headline, act) {
    const c = colors(act), detail = w >= 300, id = detail ? 'news/wire-monitor-detail' : 'news/wire-monitor';
    if (B.Art && B.Art.has(id)) {
      const M = monitorScreen({ x, y, w, h }), sc = M.screen, b = M.band;
      X.crt(ctx, sc.x, sc.y, sc.w, sc.h, true);
      X.drawArt(ctx, id, 'base', x, y - (detail ? 70 : 78), { scale: 2 });
      X.rect(ctx, b.x, b.y, b.w, b.h, c.signal);
      text(ctx, 'OVERNIGHT WIRE', b.x + 6, b.y + 6, P.bone);
      X.wrap(clean(headline), b.w - 12).slice(0,3).forEach((line,i) => text(ctx, line, b.x + 6, b.y + 19 + i*10, P.ink));
      return;
    }
    cel3(ctx, x-5, y-5, w+10, h+10, P.plastic, P.plastic2, P.plasticD);
    X.crt(ctx, x, y, w, h, true);
    X.rect(ctx, x+3, y+h-48, w-6, 45, c.signal);
    text(ctx, 'OVERNIGHT WIRE', x+10, y+h-42, P.bone);
    X.wrap(clean(headline), w-24).slice(0,3).forEach((line,i) => text(ctx, line, x+10, y+h-29+i*10, P.ink));
  }
  // part: undefined draws the screen and the line; 'screen' only the CRT.
  function chart(ctx, x, y, w, h, seed, down, part) {
    X.crt(ctx, x, y, w, h, true);
    if (part === 'screen') return;
    let py = y + h/2;
    for (let i = 0; i < w-12; i += 5) {
      py = B.clamp(py + (((i*19+seed)%13)-6) * .7 + (down ? .5 : -.25), y+10, y+h-18);
      X.rect(ctx, x+6+i, py, 3, 2, down ? P.crimson : P.jade);
    }
  }
  // The chart line's y values (unrounded) for points i = 0, 5, 10, ...; n = 15 is the line chart() draws at w = 86.
  function chartSeries(y, h, seed, down, n) {
    const out = [];
    let py = y + h/2;
    for (let k = 0, i = 0; k < n; k++, i += 5) {
      py = B.clamp(py + (((i*19+seed)%13)-6) * .7 + (down ? .5 : -.25), y+10, y+h-18);
      out.push(py);
    }
    return out;
  }

  // The wire monitor's rect (x, y, w, h): where it stands in every comp, shifted by the camera's crop; the detail's is larger.
  function monitorGeom(sb, detail) {
    return { x: B.clamp(70 + sb.crop, 24, 330), y: detail ? 56 : 76, w: detail ? 300 : 250, h: detail ? 170 : 142 };
  }
  // o (all optional; absent draws the whole flat composition): part 'back' (the ink, skyline, floor and the place's own block) or 'front' (the wire
  // monitor, the commuter, the camera's marker props and the 0.08 scanlines); noSpeckle leaves the skyline's still snow speckle out.
  // The authored place (news/place-*, 320x180 cells at 2x at 0,0): the ink, the skyline behind it and the place's frames, with what stays code
  // (the lobby's screen bars, the rideshare dash bars, the desk's chart and note line). False when the place has no art (the flat code draws it).
  const PLACE_ART = { subway: 'subway', platform: 'subway', lobby: 'lobby', elevator: 'lobby', kitchen: 'kitchen', breakroom: 'kitchen', desk: 'desk', rideshare: 'rideshare', street: 'street' };
  function placeArt(ctx, sb, ns) {
    const key = PLACE_ART[sb.place], id = 'news/place-' + key;
    if (!key || !(B.Art && B.Art.has(id))) return false;
    const pl = sb.place, s = season(sb.day), art = (f) => X.drawArt(ctx, id, f, 0, 0, { scale: 2 });
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    if (pl === 'rideshare') { X.rect(ctx, 0, 0, V.w, V.h, P.ink2); skyline(ctx, sb.act, sb.day, 210, sb.day, ns); }
    else skyline(ctx, sb.act, sb.day, 252, sb.day, ns);
    art(pl === 'street' || pl === 'rideshare' ? 'back:' + s.id : 'back');
    if (pl === 'platform') art('platform');
    if (pl === 'breakroom') art('breakroom');
    if (pl === 'rideshare') art('seat');
    if (s.wreath && key !== 'subway' && key !== 'street' && key !== 'rideshare') art('wreath');
    if (key === 'lobby') for (let i = 0; i < 4; i++) X.rect(ctx, 534, 92 + i * 11, 40 - i * 6, 2, P.sky);
    if (key === 'desk') {
      chart(ctx, 374, 66, 198, 130, sb.day, marketDown(sb.day - 1));
      X.rect(ctx, 604, 238, 20, 1, P.grey);
    }
    if (pl === 'rideshare') {
      X.rect(ctx, 280, 246, 36, 2, P.sky);
      X.rect(ctx, 324, 246, 28, 2, P.amber);
      person(ctx, 74, 250, 2, sb.act, 1, 1 + sb.day % 3); person(ctx, 574, 250, 2, sb.act, -1, 1 + (sb.day + 1) % 3);
    }
    return true;
  }
  // The commuter's x in a place establish (feet at y 244, sprite 64 px wide about x): the day's spot, kept 8 px clear right of the wire monitor and
  // close enough that the monitor and the commuter fit one 1.5 push-in crop (427 px across), so a zoomed establish holds them both.
  function commuterX(sb) {
    const M = monitorGeom(sb, false), x = B.clamp(470 - sb.crop / 2, 380, 560);
    return B.clamp(x, M.x + M.w + 40, M.x + 380);
  }
  function placeFrame(ctx, sb, headline, detail, o) {
    o = o || {};
    if (o.part !== 'front') peopleBoxes.length = 0;     // the back layer clears and records; the front layer keeps what the back recorded
    const back = o.part !== 'front', front = o.part !== 'back', ns = !!o.noSpeckle;
    const c = colors(sb.act), shift = sb.crop;
    if (back && placeArt(ctx, sb, ns)) { /* authored place */ } else if (back) {
      X.rect(ctx, 0, 0, V.w, V.h, P.ink);
      skyline(ctx, sb.act, sb.day, 252, sb.day, ns);
      X.rect(ctx, 0, 252, V.w, 108, sb.place === 'street' || sb.place === 'platform' ? P.ink2 : P.carpetD);
      if (sb.place === 'subway' || sb.place === 'platform') {
        X.rect(ctx, 0, 26, V.w, 226, P.plasticD);
        for (let i=0;i<7;i++) celIn(ctx, 18+i*94, 52, 76, 92, P.screenD, P.plastic2, P.plasticD);
        X.rect(ctx, 0, 252, V.w, 108, P.carpetD);
        // Platform LEDs, bench ends and rails establish a current transit stop.
        X.rect(ctx, 0, 246, V.w, 3, P.amberD);
        for (let i=0;i<8;i++) {
          X.rect(ctx, 20+i*82, 38, 48, 1, P.bone);
          X.rect(ctx, 35+i*82, 226, 34, 3, P.plastic);
          X.rect(ctx, 40+i*82, 229, 2, 19, P.plasticD);
        }
      } else if (sb.place === 'lobby' || sb.place === 'elevator') {
        X.gradient(ctx, 0, 0, V.w, 278, P.putty2, P.plasticD, 10);
        for (let i=0;i<10;i++) X.rect(ctx, i*68, 0, 2, 278, P.plastic);
        X.rect(ctx, 0, 278, V.w, 82, P.slate);
        for (let i=0;i<8;i++) X.rect(ctx, i*93, 273, 75, 1, P.bone);
        cel3(ctx, 516, 68, 74, 96, P.plasticD, P.plastic2, P.ink2);
        X.rect(ctx, 526, 84, 54, 56, P.screenD);
        for (let i=0;i<4;i++) X.rect(ctx, 534, 92+i*11, 40-i*6, 2, P.sky);
      } else if (sb.place === 'kitchen' || sb.place === 'breakroom') {
        X.gradient(ctx, 0, 0, V.w, 255, P.putty2, P.putty, 9);
        X.rect(ctx, 0, 255, V.w, 105, P.desk);
        for (let i=0;i<9;i++) cel3(ctx, 12+i*72, 52, 62, 52, P.plastic, P.plastic2, P.plasticD);
        cel3(ctx, 0, 207, V.w, 21, P.deskD, P.desk2, P.ink2);
        celIn(ctx, 420, 213, 94, 11, P.plastic2, P.bone, P.plasticD);
        X.rect(ctx, 524, 192, 3, 24, P.plastic2);
        X.rect(ctx, 526, 191, 22, 2, P.plastic2);
        cel3(ctx, 570, 192, 24, 24, P.bone, P.white, P.plasticD);
      } else if (sb.place === 'desk') {
        X.gradient(ctx, 0, 0, V.w, 226, P.putty2, P.putty, 9);
        X.rect(ctx, 0, 226, V.w, 134, P.desk);
        chart(ctx, 374+shift/3, 66, 198, 130, sb.day, marketDown(sb.day - 1));
        X.rect(ctx, 0, 219, V.w, 4, P.deskD);
        for (let i=0;i<7;i++) X.rect(ctx, 398+i*23, 232, 15, 1, P.grey2);
        cel3(ctx, 554, 230, 33, 26, P.plastic2, P.bone, P.plasticD);
        X.rect(ctx, 561, 237, 20, 1, P.grey);
      } else if (sb.place === 'rideshare') {
        X.rect(ctx, 0, 0, V.w, 360, P.ink2); skyline(ctx, sb.act, sb.day, 210, sb.day, ns);
        X.rect(ctx, 0, 214, V.w, 146, P.ink);
        person(ctx, 74, 250, 2, sb.act, 1, 1 + sb.day % 3); person(ctx, 574, 250, 2, sb.act, -1, 1 + (sb.day + 1) % 3);
        X.rect(ctx, 0, 202, V.w, 5, P.slate);
        cel3(ctx, 254, 236, 132, 24, P.slate, P.slate2, P.ink2);
        X.rect(ctx, 269, 242, 102, 10, P.screen);
        X.rect(ctx, 280, 246, 36, 2, P.sky);
        X.rect(ctx, 324, 246, 28, 2, P.amber);
      } else if (sb.place === 'street') {
        for (let i=0;i<10;i++) {
          X.rect(ctx, i*76, 234, 2, 18, P.slate2);
          X.rect(ctx, i*76+5, 249, 38, 1, P.grey2);
        }
        X.rect(ctx, 14, 249, 612, 2, P.amberD);
      }
    }
    if (!front) return;
    const M = monitorGeom(sb, detail), mx = M.x, my = M.y, mw = M.w, mh = M.h;
    monitor(ctx, mx, my, mw, mh, headline, sb.act);
    if (!detail) person(ctx, commuterX(sb), 244, 2, sb.act, -1, 1 + (sb.day + 2) % 3);
    // Observable composition markers: framing and subject position vary by camera.
    if (sb.camera === 'insert' && !(B.Art && B.Art.has('news/place-marker') && X.drawArt(ctx, 'news/place-marker', 'marker:insert', 0, 0, { scale: 2 }))) cel3(ctx, 468, 86, 116, 82, P.bone, P.white, P.plasticD);
    // The over-shoulder and close markers show you (who 0), the same person in every shot; the big commuters are strangers, so they stay out of these.
    if (sb.camera === 'over-shoulder') { person(ctx, 576, 234, 3, sb.act, -1, 0, 'back'); if (!(B.Art && B.Art.has('news/you'))) X.rect(ctx, 516, 278, 124, 82, P.ink2); }
    if (sb.camera === 'close') { person(ctx, 516, 205, 4, sb.act, -1, 0, 'front'); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, .08);
  }

  // o (all optional; absent draws exactly the flat phone): rows (default feed.slice(0, 4)), count (the printed number),
  // glow (leading rows with screenGlow, default 1), compact (the tall 52 px rows; default: two rows or fewer), part (undefined all, 'back' without the row cards, 'rows' only the
  // row cards, unclipped), noDigits (no status count).
  // Numbers two shots both need, in one place: the lock screen's minute (the handoff's asleep screen prints it too), how far the
  // CASCADE stack has slipped at a stability (the office beat id carries it) and the ink overlay's alpha under the close report.
  const lockMinute = (day) => String(31 + ((day || 0) % 24)).padStart(2, '0');
  const stackSlip = (st) => Math.round((100 - st) / 12);
  const CLOSE_DIM = 0.32;
  // The phone's screen rect inside its plate (x, y, w, h).
  const phoneScreen = (x, y, w, h) => ({ sx: x + 8, sy: y + 12, sw: w - 16, sh: h - 24 });
  // The device and its screen for a feed of rowCount rows: the big one (226x308) when close or more than two rows, else the small one.
  function phoneGeom(rowCount, close) {
    const big = close || Math.min(rowCount, 4) > 2, w = big ? 226 : 180, h = big ? 308 : 250, x = (V.w - w) / 2, y = 18;
    return Object.assign({ x, y, w, h }, phoneScreen(x, y, w, h));
  }
  function phone(ctx, x, y, w, h, feed, act, day, o) {
    o = o || {};
    const c = colors(act), rows = o.rows || (feed || []).slice(0, 4), compact = o.compact != null ? o.compact : Math.min(rows.length, 4) <= 2, part = o.part;
    const count = o.count != null ? o.count : rows.length, glow = o.glow == null ? 1 : o.glow;
    const { sx, sy, sw, sh } = phoneScreen(x, y, w, h), rowH = compact ? 52 : 39;
    const cards = () => rows.forEach((item,i) => {
      const yy=sy+25+i*(rowH+5);
      X.rect(ctx, sx+5, yy, sw-10, rowH, i<glow ? P.screenGlow : P.screenD);
      X.rect(ctx, sx+5, yy, 3, rowH, item.kind==='chirp'?P.violet:item.kind==='mail'?P.amber:P.sky);
      text(ctx, X.wrapFit(clean(item.source || 'WIRE'), sw-28, 1)[0] || '', sx+14, yy+6, c.wash);
      // whole words, and an ellipsis on the last line when the title runs longer than the card
      X.wrapFit(clean(item.title || ''), sw-34, compact?3:2).forEach((line,k) => text(ctx,line,sx+14,yy+19+k*10,P.bone));
    });
    if (part === 'rows') { cards(); return rows.length; }
    // Glow is behind the device and never becomes an opaque slab.
    ctx.save(); ctx.globalAlpha = .12 + act*.025; X.rect(ctx, x-8, y-8, w+16, h+16, c.signal); ctx.restore();
    // The authored device (8 cells of reflection line each side of the body, so it sits 16 px left of the body's x) goes over the screen fill;
    // its screen window is transparent. Without the art the flat plate and speaker slot are drawn.
    const devId = w === 226 ? 'news/phone-device-big' : 'news/phone-device-small', devArt = !!(B.Art && B.Art.has(devId));
    if (!devArt) X.plate(ctx, x, y, w, h, P.ink2, P.slate2, P.ink);
    X.rect(ctx, sx, sy, sw, sh, P.screen);
    if (!devArt || !X.drawArt(ctx, devId, 'base', x - 16, y, { scale: 2 })) {
      if (devArt) X.plate(ctx, x, y, w, h, P.ink2, P.slate2, P.ink);
      X.rect(ctx, sx, sy, sw, sh, P.screen);
      X.rect(ctx, x+w/2-18, y+4, 36, 4, P.ink);
    }
    const minute = lockMinute(day);
    text(ctx, `6:${minute}`, sx+7, sy+6, P.grey2);
    if (!o.noDigits) text(ctx, `${count}`, sx+sw-8, sy+6, c.wash, 'right');
    if (part === 'back') return rows.length;
    ctx.save();
    ctx.beginPath(); ctx.rect(sx+2, sy+21, sw-4, sh-24); ctx.clip();
    cards();
    ctx.restore();
    return rows.length;
  }

  // The room background (ink, then the 10-band ink2 gradient) restricted to rect r: the same pixels as the full room inside r,
  // for any r. Each band is dithered from a start aligned to the 4x4 pattern (x to a multiple of 4, y to a multiple of 4 from the
  // band's own top, which is itself a multiple of 4) and clipped to r, so the phase is the full frame's.
  // With the authored room (news/phone-room, 320x180 at 2x) the rect is the art clipped to r; the gradient is the fallback.
  const roomArt = (ctx) => !!(B.Art && B.Art.has('news/phone-room')) && X.drawArt(ctx, 'news/phone-room', 'room', 0, 0, { scale: 2 });
  function roomArea(ctx, r) {
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    const drawn = roomArt(ctx);
    ctx.restore();
    if (drawn) return;
    X.rect(ctx, r.x, r.y, r.w, r.h, P.ink);
    const n = 10, bh = Math.ceil(V.h / n), xa = r.x - (((r.x % 4) + 4) % 4);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    for (let i = 0; i < n; i++) {
      const top = i * bh, y0 = Math.max(top, r.y), y1 = Math.min(top + Math.min(bh, V.h - top), r.y + r.h);
      if (y1 > y0) { const ya = y0 - (y0 - top) % 4; X.dither(ctx, xa, ya, r.x + r.w - xa, y1 - ya, P.ink2, P.ink, i / (n - 1)); }
    }
    ctx.restore();
  }
  // o (all optional; absent draws exactly the flat frame): rows, count, glow, noDigits as phone(); labelX (default 92 close, 88);
  // part: 'room' (background and the two left labels), 'device' (the phone and its edges), 'back' (room and device without the row cards),
  // 'rows' (only the row cards). noDigits leaves the leading digit off the left label, which then starts 12 px further right.
  // area: a rect that everything is clipped to (the room inside it is the full room's pixels).
  function phoneFrame(ctx, sb, feed, close, o) {
    o = o || {};
    const part = o.part, rows = o.rows || (feed||[]).slice(0,4), G = phoneGeom(rows.length, close), { x, y, w, h } = G;
    const count = o.count != null ? o.count : rows.length, lx = o.labelX != null ? o.labelX : (close ? 92 : 88);
    const inner = Object.assign({}, o, { part: part === 'back' || part === 'rows' ? part : undefined });
    if (o.area) { ctx.save(); ctx.beginPath(); ctx.rect(o.area.x, o.area.y, o.area.w, o.area.h); ctx.clip(); }
    if (part === 'rows') phone(ctx,x,y,w,h,feed,sb.act,sb.day,inner);
    else {
      const room = !part || part === 'room' || part === 'back', device = !part || part === 'device' || part === 'back';
      if (room) {
        if (o.area) roomArea(ctx, o.area);
        else if (!roomArt(ctx)) { X.rect(ctx,0,0,V.w,V.h,P.ink); X.gradient(ctx,0,0,V.w,V.h,P.ink2,P.ink,10); }
      }
      if (device) {
        // A thin reflected edge keeps the handoff and the close view grounded
        // as one physical device, while leaving the notification text untouched.
        const devArt = !!(B.Art && B.Art.has(w === 226 ? 'news/phone-device-big' : 'news/phone-device-small'));
        if (!devArt) { X.rect(ctx,x-12,y+16,1,h-24,P.slate2); X.rect(ctx,x+w+11,y+16,1,h-24,P.slate2); }
        phone(ctx,x,y,w,h,feed,sb.act,sb.day,inner);
        if (!devArt) {
          X.rect(ctx,x+3,y+14,1,h-28,P.grey2);
          X.rect(ctx,x+w-4,y+19,1,h-38,P.slate2);
          X.rect(ctx,x+Math.round(w/2)-9,y+h-8,18,1,P.slate2);
        }
        for(let i=0;i<5;i++) X.rect(ctx,x+14+i*8,y+h+12,4,1,colors(sb.act).signal);
      }
      if (room) {
        text(ctx,'SQWAK · PRE-OPEN', lx, 92, colors(sb.act).wash);
        if (o.noDigits) text(ctx,`NOTIFICATION${count===1?'':'S'}`,lx+12,110,P.bone);
        else text(ctx,`${count} NOTIFICATION${count===1?'':'S'}`,lx,110,P.bone);
      }
    }
    if (o.area) ctx.restore();
  }

  // The floor empties by act: one more dead desk each act. Your own desk
  // carries the story: the CASCADE stack slips as stability falls, and the
  // red HOLD files arrive once the heat is on.
  // o (optional; absent draws the whole flat frame): part 'wall' (putty, gradient and the six windows, with the still snow
  // speckle left out), 'monitors' (the five screens), 'desk' (the desk, the keyboard and, with detail, your desk), 'top' (only
  // the two top sheets at x offset o.slipNow, then the CASCADE label). With part 'desk': noTopSheets leaves sheets 2 and 3 and the
  // label out, deskChart 'screen' draws only the desk chart's CRT.
  // Where things are on the floor, for the drawing below and the layered office and close shots: the six windows (x, y, w, h, and the
  // sky inside), the five monitors (cel, screen, and the bar a dead screen shows), your desk's chart screen, how many monitors are dead
  // (one more each act) and how far the CASCADE stack slips (stability falls).
  // The authored desk (art/src/rooms/your-desk.aseprite, 320x180 cells at 2x; the five monitors are one sprite, your-desk-monitor,
  // stamped on or dead). Anchors from the grid header, in 640x360 px (cells x 2).
  const DESK = 'rooms/your-desk', DESK_MON = 'rooms/your-desk-monitor';
  const deskArt = () => !!(B.Art && B.Art.has(DESK) && B.Art.has(DESK_MON));
  function officeGeom(day, S) {
    const dead = board(day).act - 1, st = S && S.m ? S.m.stability : 100, slip = stackSlip(st), windows = [], monitors = [];
    if (deskArt()) {
      for (let i = 0; i < 6; i++) { const x = 20 + i * 104; windows.push({ x, y: 16, w: 84, h: 44, sky: { x, y: 16, w: 84, h: 44 } }); }
      // bar: the power LED on the chin, which a monitor shut down at the close puts out (ink2, as the dead sprite has it)
      for (let i = 0; i < 5; i++) { const x = 18 + i * 122; monitors.push({ i, x, y: 76, w: 112, h: 144, off: i >= 5 - dead, screen: { x: x + 10, y: 88, w: 92, h: 80 }, bar: { x: x + 94, y: 178, w: 4, h: 2, col: P.ink2 } }); }
      const f = (S && S.f) || {}, files = !!(S && S.m && (S.m.heat >= 50 || f.insiderTraded || f.raid));
      return { dead, live: 5 - dead, st, slip, files, windows, monitors, deskChart: { x: 542, y: 202, w: 84, h: 52 } };
    }
    for (let i = 0; i < 6; i++) { const x = 18 + i * 104; windows.push({ x, y: 16, w: 90, h: 44, sky: { x: x + 2, y: 18, w: 86, h: 40 } }); }
    for (let i = 0; i < 5; i++) { const x = 24 + i * 124; monitors.push({ i, x, y: 78, w: 104, h: 126, off: i >= 5 - dead, screen: { x: x + 10, y: 92, w: 84, h: 78 }, bar: { x: x + 20, y: 176, w: 64, h: 3 } }); }
    // the red HOLD FILES stack on your desk appears once the heat is on
    const f = (S && S.f) || {}, files = !!(S && S.m && (S.m.heat >= 50 || f.insiderTraded || f.raid));
    return { dead, live: 5 - dead, st, slip, files, windows, monitors, deskChart: { x: 540, y: 218, w: 86, h: 50 } };
  }
  // Your desk from the authored art: the same parts and options as officeFrame (below). Layers, back to front: the season's sky, the
  // wall, the wreath (week 11 on), the five monitors, the desk, the CASCADE stack's base, the day's clutter, the HOLD FILES, the red
  // bits, the top two sheets (stressed under 60 stability) at the slip. Charts and the CASCADE label stay code, on the authored glass.
  function officeArtFrame(ctx, day, detail, down, S, o) {
    const part = o.part, wall = !part || part === 'wall', mons = !part || part === 'monitors', desk = !part || part === 'desk';
    const sb = board(day), c = colors(sb.act), s = season(day);
    if (down == null) down = marketDown(day - 1);
    const G = officeGeom(day, S), st = G.st, art = (id, f, x, y) => X.drawArt(ctx, id, f, x, y, { scale: 2 });
    const top = (sl) => {
      art(DESK, st < 60 ? 'sheets:top-stressed' : 'sheets:top', sl * 2, 0);
      ctx.save(); ctx.scale(2, 2); X.textShadow(ctx, 'CASCADE', 24, 105, c.signal, P.ink); ctx.restore();
    };
    if (part === 'top') { top(o.slipNow == null ? G.slip : o.slipNow); return; }
    if (wall) {
      art(DESK, 'sky:' + s.id, 0, 0);
      G.windows.forEach((W, i) => weather(ctx, W.sky.x, W.sky.y, W.sky.w, 30, day + i, part === 'wall'));
      art(DESK, 'wall', 0, 0);
      if (s.wreath) art(DESK, 'wreath', 0, 0);
    }
    if (mons) {
      for (const m of G.monitors) { art(DESK_MON, m.off ? 'dead' : 'on', m.x, m.y); if (!m.off) chart(ctx, m.screen.x, m.screen.y, m.screen.w, m.screen.h, day + m.i, down); }
    }
    if (desk) {
      art(DESK, 'desk', 0, 0);
      // the day's clutter: a mug every other day, notes on alternate pairs of days, takeout every fifth day
      if (day % 2) art(DESK, 'clutter:mug', 0, 0);
      if (Math.floor(day / 2) % 2) art(DESK, 'clutter:notes', 0, 0);
      if (day % 5 === 0) art(DESK, 'clutter:takeout', 0, 0);
      // the CASCADE plate is on the desk: its label goes on in the wide too (with detail it rides with the top sheets)
      if (!detail) {
        ctx.save(); ctx.scale(2, 2); X.textShadow(ctx, 'CASCADE', 24, 105, c.signal, P.ink); ctx.restore();
        const dc = G.deskChart; chart(ctx, dc.x, dc.y, dc.w, dc.h, day, down);
      }
      if (detail) {
        art(DESK, 'sheets:base', 0, 0);
        if (G.files) art(DESK, 'hold-files', 0, 0);
        if (st < 40) art(DESK, 'cascade-red', G.slip * 2, 0);
        if (!o.noTopSheets) top(G.slip);
        const dc = G.deskChart; chart(ctx, dc.x, dc.y, dc.w, dc.h, day, down, o.deskChart === 'screen' ? 'screen' : undefined);
      }
    }
  }
  function officeFrame(ctx, day, detail, down, S, o) {
    o = o || {};
    if (deskArt()) return officeArtFrame(ctx, day, detail, down, S, o);
    const part = o.part, wall = !part || part === 'wall', mons = !part || part === 'monitors', desk = !part || part === 'desk';
    const sb=board(day), c=colors(sb.act), s=season(day);
    if (down == null) down = marketDown(day - 1);
    const G=officeGeom(day,S), st=G.st, slip=G.slip;
    const sheet = (i, sl) => {const x=58+i*4+(i>1?sl:0),y=250-i*9;X.rect(ctx,x+4,y+4,110,16,P.deskD);cel3(ctx,x,y,110,16,P.bone,P.white,P.plasticD);X.rect(ctx,x+6,y+5,40,2,i>1&&st<60?P.crimsonD:P.sky);X.rect(ctx,x+6,y+10,80,1,P.grey);};
    if (part === 'top') {
      const sl = o.slipNow == null ? slip : o.slipNow;
      sheet(2, sl); sheet(3, sl);
      text(ctx,'CASCADE',64,216,c.signal);
      return;
    }
    if (wall) { X.rect(ctx,0,0,V.w,V.h,P.putty); X.gradient(ctx,0,0,V.w,235,P.putty2,P.putty,10); }
    if (desk) X.rect(ctx,0,235,V.w,125,P.desk);
    if (wall) {
      // A strip of windows: the season outside the forty-first floor.
      for(let i=0;i<6;i++){const W=G.windows[i],wx=W.x;celIn(ctx,wx,W.y,W.w,W.h,P.slate2,P.putty2,P.plasticD);sky(ctx,W.sky.x,W.sky.y,W.sky.w,W.sky.h,day,P.sky);
        for(let b=0;b<5;b++){const bh=8+((i*5+b*11+day)%20);X.rect(ctx,wx+4+b*17,58-bh,13,bh,P.slate);if(s.snow)X.rect(ctx,wx+4+b*17,58-bh,13,1,P.bone);}
        weather(ctx,W.sky.x,W.sky.y,W.sky.w,30,day+i,part==='wall');}
    }
    if (mons) {
      for(const m of G.monitors){const i=m.i,sc=m.screen,bar=m.bar;cel3(ctx,m.x,m.y,m.w,m.h,P.plastic,P.plastic2,P.plasticD);
        if(m.off){X.rect(ctx,sc.x,sc.y,sc.w,sc.h,P.screenD);X.rect(ctx,bar.x,bar.y,bar.w,bar.h,P.plasticD);}else chart(ctx,sc.x,sc.y,sc.w,sc.h,day+i,down);}
    }
    if (desk) {
      cel3(ctx,196,242,248,30,P.plasticD,P.plastic2,P.ink2);
      for(let i=0;i<12;i++) X.rect(ctx,208+i*18,250,12,5,i%4?P.slate:P.slate2);
      if(detail){
        const top = !o.noTopSheets;
        for(let i=0;i<(top?4:2);i++) sheet(i, slip);
        if(top) text(ctx,'CASCADE',64,216,c.signal);
        if(st<40){X.rect(ctx,176+slip,262,8,4,P.crimson);X.rect(ctx,188+slip,266,5,3,P.crimsonD);}
        if(G.files){cel3(ctx,470,236,56,34,P.crimsonD,P.crimson,P.ink);text(ctx,'HOLD',498,246,P.white,'center');text(ctx,'FILES',498,256,P.bone,'center');}
        const dc=G.deskChart;chart(ctx,dc.x,dc.y,dc.w,dc.h,day,down,o.deskChart==='screen'?'screen':undefined);
      }
    }
  }
  // Whether the market fell on the day a report closes: the index change when it has one, else the P&L.
  const closeDown = (report) => (report.indexPct != null ? report.indexPct : (report.pnl||0)) < 0;
  // The report card and its verdict (a real quota decided it) as numbers: the box, the lines, the nine tally dashes and the stamp's final rect.
  function closeGeom(report) {
    const pnl = report.pnl || 0, met = !!report.quotaMet, verdict = report.quota > 0;
    const label = met ? 'QUOTA MET' : verdict ? 'QUOTA MISSED' : 'CLOSING BELL';
    const sw = 2 * Math.ceil((X.textWidth(label) - 1 + 24) / 2), dashes = [];
    // clipped to the card's inner edge (the box's ink interior ends at x 472), so the ninth is a stump rather than poking out
    for (let i = 0; i < 9; i++) { const x = 172 + i * 37; dashes.push({ x, y: 180, w: Math.min(15, 473 - x), h: 1 }); }
    return {
      pnl, good: pnl >= 0, met, verdict, label, dashes,
      box: { x: 165, y: 72, w: 310, h: 112 },
      labelAt: { x: 320, y: 93 }, pnlAt: { x: 320, y: 124 }, quotaAt: { x: 320, y: 146 }, dateAt: { x: 320, y: 162 },
      cover: { x: 280, y: 91, w: 80, h: 11 }, // flat ink inside the box, over the verdict label
      stamp: { x: 320 - sw / 2, y: 86, w: sw, h: 20 }
    };
  }
  // o (all optional; absent draws the whole flat frame): part 'office' (the floor and its 0.32 ink overlay) or 'card' (the box, the
  // verdict label, with detail the quota and the date); with part 'card', noPnl leaves the P&L out and noDashes the nine dashes.
  function closeFrame(ctx, report, detail, o) {
    o = o || {};
    const part = o.part, G = closeGeom(report), b = G.box;
    if (!part || part === 'office') {
      officeFrame(ctx, report.day||0, true, closeDown(report)); ctx.save(); ctx.globalAlpha=CLOSE_DIM;X.rect(ctx,0,0,V.w,V.h,P.ink);ctx.restore();
    }
    if (part === 'office') return;
    X.box(ctx,b.x,b.y,b.w,b.h);
    X.rect(ctx,166,71,308,1,P.grey2);
    X.rect(ctx,166,185,308,1,P.slate2);
    if (!o.noDashes) G.dashes.forEach((d) => X.rect(ctx,d.x,d.y,d.w,d.h,G.met?P.jadeD:P.crimsonD));
    text(ctx,G.label,G.labelAt.x,G.labelAt.y,G.met?P.jade:P.crimson,'center');
    if (!o.noPnl) text(ctx,B.fmt.money(G.pnl,true),G.pnlAt.x,G.pnlAt.y,G.good?P.jade:P.crimson,'center');
    if(detail){text(ctx,`QUOTA ${B.fmt.money(report.quota||0)}`,G.quotaAt.x,G.quotaAt.y,P.grey2,'center');text(ctx,clean(report.date||''),G.dateAt.x,G.dateAt.y,P.putty,'center');}
  }
  // Sqwak breaking-news insert: a phone held in one hand against the act's
  // skyline, one post filling the screen. Content comes from B.SqwakStory.
  function big(ctx, value, x, y, color, scale, align) {
    ctx.save(); ctx.scale(scale, scale);
    X.textShadow(ctx, clean(value).slice(0, 40), Math.round(x / scale), Math.round(y / scale), color, P.ink, { align: align || 'left' });
    ctx.restore();
  }
  // The insert's phone and post as numbers: the phone, its screen, the post card (cy), the flag square and the stats line.
  // The insert holds the phone at py 40, the read (full) at py 14.
  function sqwakGeom(full) {
    const pw = 236, ph = 330, px = (V.w - pw) / 2, py = full ? 14 : 40, sx = px + 9, sy = py + 12, sw = pw - 18, cy = sy + 52;
    return { pw, ph, px, py, sx, sy, sw, cy, flag: { x: sx + 12, y: cy + 8, w: 10, h: 10 }, stats: { x: sx + 12, y: cy + 176 } };
  }
  // o (all optional; absent draws the whole flat frame): part 'city' (skyline and ground), 'phone' (hand, phone, post and reply) or
  // 'grain' (scanlines and, when not full, the act wash). With part 'phone', noFlag leaves the crimson flag square out, noStats the stats line.
  function sqwakFrame(ctx, sb, b, full, o) {
    o = o || {};
    const c = colors(sb.act), part = o.part;
    if (!part || part === 'city') {
      skyline(ctx, sb.act, sb.day * 7 + 3, 300, sb.day);
      X.rect(ctx, 0, 300, V.w, 60, P.ink);
    }
    if (!part || part === 'phone') {
      const { pw, ph, px, py, sx, sy, sw, cy, flag, stats } = sqwakGeom(full);
      // The authored hand and phone (news/sqwak-hand, 144x165 cells at 2x, origin at the phone's x - 30): the hand's back, the phone, the
      // screen's content below, then the fingers and the thumb over the bezel and the screen's edge.
      const handArt = !!(B.Art && B.Art.has('news/sqwak-hand')), hx = px - 30;
      const hand = (f) => handArt && X.drawArt(ctx, 'news/sqwak-hand', f, hx, py, { scale: 2 });
      const useArt = handArt && hand('hand:back');
      if (useArt) { X.rect(ctx, sx, sy, sw, ph - 24, P.screenD); hand('phone'); }
      else {
      // hand behind the phone
      X.rect(ctx, px - 22, py + 150, 30, 120, P.desk);
      X.rect(ctx, px - 24, py + 150, 6, 110, P.deskD);
      X.rect(ctx, px + pw - 30, py + 112, 44, 150, P.desk);
      X.rect(ctx, px + pw + 10, py + 122, 4, 116, P.deskD);
      X.rect(ctx, px + pw - 6, py + 118, 34, 26, P.desk2);
      X.rect(ctx, px + pw - 6, py + 150, 38, 26, P.desk2);
      X.rect(ctx, px + pw - 6, py + 182, 34, 26, P.desk2);
      X.rect(ctx, px + pw - 6, py + 214, 28, 24, P.desk);
      X.plate(ctx, px, py, pw, ph, P.ink2, P.slate2, P.ink);
      X.rect(ctx, sx, sy, sw, ph - 24, P.screenD);
      X.rect(ctx, px + pw / 2 - 20, py + 4, 40, 5, P.ink);
      }
      // app header
      big(ctx, 'sqwak', px + pw / 2, sy + 12, P.bone, 2, 'center');
      text(ctx, 'MARKETS TALK. EVERYONE LISTENS.', px + pw / 2, sy + 32, P.grey, 'center');
      X.rect(ctx, sx, sy + 44, sw, 1, P.slate);
      // the post
      X.rect(ctx, sx + 6, cy, sw - 12, 190, P.screen);
      if (!o.noFlag) X.rect(ctx, flag.x, flag.y, flag.w, flag.h, P.crimson);
      text(ctx, b.flag || 'BREAKING', sx + 28, cy + 10, P.crimson);
      text(ctx, b.when || 'NOW', sx + sw - 14, cy + 10, P.grey2, 'right');
      // the thumb lies over the post's left edge at py+112..148: the first headline line has the full width, the two under the thumb start 16 px in
      const head = clean(b.head).toUpperCase(), l0 = X.wrap(head, (sw - 30) / 2)[0] || '';
      const hl = useArt ? [l0].concat(X.wrapFit(head.slice(l0.length).trim(), (sw - 46) / 2, 2)) : X.wrapFit(head, (sw - 30) / 2, 3);
      hl.forEach((line, i) => big(ctx, line, sx + 12 + (useArt && i > 0 ? 16 : 0), cy + 26 + i * 18, P.bone, 2));
      const bodyY = cy + 88;
      X.wrapFit(clean(b.text), sw - 30, 5).forEach((line, i) => text(ctx, line, sx + 12, bodyY + i * 10, P.putty2));
      // glitch thumbnail strip
      for (let i = 0; i < 6; i++) X.rect(ctx, sx + 12 + ((i * 29 + sb.day) % (sw - 60)), cy + 150 + i * 4, 30 + (i * 11) % 24, 2, i % 2 ? P.crimsonD : P.crimson);
      if (!o.noStats) text(ctx, sqwakStats(b).join('   '), stats.x, stats.y, P.grey2);
      // reply
      if (b.reply) {
        const ry = cy + 198;
        X.rect(ctx, sx + 12, ry, 14, 14, P.slate);
        text(ctx, X.wrapFit(clean(b.reply[0]), sw - 44, 1)[0] || '', sx + 32, ry + 1, P.sky);
        // four lines fit above the screen's bottom edge (py + 318); a longer reply ends on an ellipsis
        X.wrapFit(clean(b.reply[1]), sw - 44, 4).forEach((line, i) => text(ctx, line, sx + 32, ry + 12 + i * 10, P.bone));
      }
      if (useArt) hand('hand:front');
    }
    if (!part || part === 'grain') {
      X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, full ? .06 : .1);
      if (!full) { ctx.save(); ctx.globalAlpha = .25; X.rect(ctx, 0, 0, V.w, V.h, c.wash); ctx.restore(); }
    }
  }
  // The three engagement counts of a post, as authored or the defaults.
  function sqwakStats(b) { return [b.stats ? b.stats[0] : '1.2K', b.stats ? b.stats[1] : '4.8K', b.stats ? b.stats[2] : '12K']; }

  function beat(scene, id, dur, draw, line, extra) {
    return Object.assign({ id:`${scene}:${id}`, view:V, dur, draw, line:line||'', cache:true }, extra||{});
  }
  B.Rhythm = {
    view:V, endingIds:ENDING_IDS,
    // Drawing helpers for js/art/storyboard.js.
    placeFrame, peopleBoxes, commuterX, monitorGeom, phoneFrame, phoneGeom, lockMinute, stackSlip, CLOSE_DIM, officeFrame, officeGeom, closeFrame, closeGeom, closeDown, sqwakFrame, sqwakGeom, sqwakStats, skyline, skylineWindows, skylineLit, skyVar, monitorScreen, season, sky, weather, text, colors, clean, chart, chartSeries, person, marketDown, beat,
    phoneRowCount(feed){return Math.min(4,(feed||[]).length);},
    storyboard:board
  };

  B.Scenes.phone = function(o){const sb=board(o.day||0),feed=(o.brief&&o.brief.feed)||[];return [
    beat('phone',`${sb.day}:handoff`,1.4,(c)=>phoneFrame(c,sb,feed,true),'',{sfx:'apartment',transition:'fade'}),
    beat('phone',`${sb.day}:read`,2.0,(c)=>phoneFrame(c,sb,feed,true),'PRE-OPEN FEED',{sfx:'news',informative:true})
  ];};
  B.Scenes.office = function(o){const day=o.day||0,g=o.game,S=g&&g.mode&&g.mode.S,k=S&&S.m?`${stackSlip(S.m.stability)}${S.m.heat>=50?'h':''}`:'';const dead=officeGeom(day,S).dead;return [
    beat('office',`${day}:wide`,1.45,(c)=>officeFrame(c,day,false,null,S),'FORTY-FIRST FLOOR.',{sfx:'elevator',transition:'fade'}),
    beat('office',`${day}:desk:${k}`,1.8,(c)=>officeFrame(c,day,true,null,S),dead?`${['','ONE DESK','TWO DESKS','THREE DESKS'][dead]} ON YOUR ROW. NOBODY SITS THERE NOW.`:'THE DESK IS ALREADY AWAKE.',{sfx:'office',informative:true}),
    beat('office',`${day}:hold:${k}`,.85,(c)=>officeFrame(c,day,true,null,S),'SIT DOWN. NINE THIRTY.',{})
  ];};
  B.Scenes.close = function(o){const r=o.report||{};const story=!o.game||!o.game.mode||o.game.mode.kind==='story';
    const sq=story&&B.SqwakStory&&B.SqwakStory.BREAKING?B.SqwakStory.breaking(r.day,o.game&&o.game.mode&&o.game.mode.S):null;const sb=board(r.day||0);
    const tag=`${r.day||0}:${(r.pnl||0)>=0?'u':'d'}${r.quotaMet?'m':''}${Math.round(r.pnl||0)}`;
    const bell=beat('close',`${tag}:bell`,1.25,(c)=>closeFrame(c,r,false),'4:00 PM.',{sfx:'closeBell',transition:'fade'});
    const post=sq?[
      beat('close',`${r.day||0}:sqwak`,1.0,(c)=>sqwakFrame(c,sb,sq,false),'',{sfx:'news',post:sq}),
      beat('close',`${r.day||0}:sqwak-read`,2.6,(c)=>sqwakFrame(c,sb,sq,true),clean(sq.head).toUpperCase(),{sfx:'broadcast',post:sq})
    ]:[];
    return [bell].concat(post,[
      beat('close',`${tag}:report`,2.0,(c)=>closeFrame(c,r,true),(r.pnl||0)>=0?'YOU MADE MONEY. NOBODY SAYS WELL DONE.':'YOU LOST MONEY. EVERYBODY NOTICED.',{sfx:'office',informative:true}),
      beat('close',`${tag}:hold`,.85,(c)=>closeFrame(c,r,true),'',{})
    ]);};
})(window.BTB);
