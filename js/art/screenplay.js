// The long decision scenes. Every decision plays as a full scene of about 45
// seconds before its choices (B.Scenes.screenplay), then a payoff scene for the
// option picked (B.Scenes.payoff); the career ends on a montage of the desk
// decisions you made (B.Scenes.recap). The scripts are js/art/screenplay-data.js;
// this file turns each shot into a beat, drawn from the game's own rooms, faces,
// documents and places.
// The three scenes are `stepped`: a tap or a key moves to the next shot, the
// SKIP button (or Esc) ends the scene. Every other scene keeps tap-to-skip.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal, R = B.Rhythm, V = R.view;
  const D = () => B.ScreenplayData;
  const DA = () => B.DecisionArt;
  const SB = () => B.Storyboard;
  const SH = () => B.Shots;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- words ----
  // {pet}, {he}, {him}, {his} (and capitalised) from the wallet's pet; with no pet, the words a scene about one would never show.
  function fill(line, W) {
    const pet = W && W.pet, girl = pet && pet.sex === 'girl';
    const words = { pet: pet ? pet.name : 'your pet', he: girl ? 'she' : 'he', him: girl ? 'her' : 'him', his: girl ? 'her' : 'his' };
    return String(line || '').replace(/\{(pet|Pet|he|He|him|Him|his|His)\}/g, (_, k) => {
      const w = words[k.toLowerCase()];
      return k[0] === k[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
    });
  }
  // How long a caption stays up, and how long it takes to type on.
  const readFor = (line) => clamp(2.6 + line.length * 0.035, 3.5, 7);
  const payFor = (line) => clamp(2.8 + line.length * 0.04, 3.6, 7.5);
  const typeFor = (line) => clamp(line.length * 0.028, 1.15, 3);
  // A shot plays when its flag condition holds.
  const wanted = (s, S) => {
    const f = (S && S.f) || {};
    if (s.if && !f[s.if]) return false;
    if (s.unless && f[s.unless]) return false;
    return true;
  };

  // ---- pictures ----
  const at2x = (ctx, fn, day) => SB().at2x(ctx, fn, day);
  function floor(ctx, s, day) {
    at2x(ctx, (c) => {
      SH().tradingFloor(c, s.z == null ? 0.15 : s.z, !s.dark, day);
      if (s.dark && !SH().floorArt()) { c.save(); c.globalAlpha = 0.42; X.rect(c, 0, 0, 320, 180, P.ink); c.restore(); }
    }, day);
  }
  function home(ctx, s, day, W) {
    const sb = SB(), h = sb.homeOf(W);
    sb.apartmentShot(ctx, day, h, !!s.night, W || null);
  }
  // A phone screen held up in the dark: who, and one message.
  function textShot(ctx, s, day, S, W) {
    // at home for a personal beat (the apartment after dark), at the office for the desk's
    if (s.home) home(ctx, { night: true }, day, W); else floor(ctx, { z: 0.45, dark: true }, day);
    DA().dim(ctx, 0.55);
    const w = 236, h = 300, x = (V.w - w) >> 1, y = 20;
    X.cel(ctx, x, y, w, h, P.ink2, P.slate2, P.ink, P.ink, 3);
    X.rect(ctx, x + 12, y + 18, w - 24, h - 36, P.ink);
    X.rect(ctx, x + 12, y + 18, w - 24, 34, P.slate);
    ctx.save(); ctx.scale(2, 2);
    X.textShadow(ctx, R.clean(s.from || '').slice(0, 17), Math.round((x + 22) / 2), Math.round((y + 28) / 2), P.bone, P.ink);
    ctx.restore();
    const lines = X.wrap(R.clean(s.body || ''), (w - 60) / 2).slice(0, 4);
    const bh = lines.length * 18 + 18;
    X.cel(ctx, x + 22, y + 70, w - 44, bh, P.bone, P.white, P.putty, P.ink, 2);
    ctx.save(); ctx.scale(2, 2);
    lines.forEach((l, i) => X.text(ctx, l, Math.round((x + 32) / 2), Math.round((y + 80 + i * 18) / 2), P.ink));
    ctx.restore();
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }
  // A time card: the hour large, what it is the hour of beneath.
  function clockShot(ctx, s, day) {
    const a = B.StoryData.actIndex(day) + 1, c = R.colors(a);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    X.gradient(ctx, 0, 0, V.w, V.h, P.ink2, P.ink, 10);
    const t = R.clean(s.time || '').slice(0, 9);
    ctx.save(); ctx.scale(8, 8);
    X.textShadow(ctx, t, 40, 9, P.bone, P.ink, { align: 'center' });
    ctx.restore();
    X.rect(ctx, 180, 158, 280, 2, c.signal);
    ctx.save(); ctx.scale(2, 2);
    X.textShadow(ctx, R.clean(s.note || '').slice(0, 40), 160, 86, c.signal, P.ink, { align: 'center' });
    ctx.restore();
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }
  // The city: the day's skyline, or after dark the towers on plain ink with the act's windows lit (the act card's city, with no title).
  function sky(ctx, s, day) {
    if (!s.night) return SB().skylineShot(ctx, day, '');
    const a = B.StoryData.actIndex(day) + 1, c = R.colors(a);
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    if (B.Art && B.Art.has('news/skyline') && X.drawArt(ctx, 'news/skyline', R.skyVar(day), 0, V.h - 168, { scale: 2 })) R.skylineLit(day * 7 + 3, V.h, day).forEach((q) => X.rect(ctx, q.x, q.y, q.w, q.h, c.wash));
    else R.skyline(ctx, a, day * 7 + 3, 300, day);
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, 0.05);
  }
  // A close-up: the speaker at 5x in front of the room (or the floor), dimmed.
  function faceBack(ctx, s, day, S) {
    if (s.on === 'floor' || !s.on) floor(ctx, { z: 0.45, dark: false }, day);
    else DA().room(ctx, s.on, day, false, S);
    DA().dim(ctx, 0.35);
  }
  const faceNight = (s) => !!(s.on && s.on !== 'floor' && DA().isNight(s.on));

  // The flat picture of one shot (640x360).
  function picture(ctx, s, day, S, W) {
    switch (s.k) {
      case 'floor': return floor(ctx, s, day);
      case 'room': return DA().room(ctx, s.room, day, !!s.after, S);
      case 'face': faceBack(ctx, s, day, S); if (!DA().speaker(ctx, s.who, s.x || 40, faceNight(s))) DA().dim(ctx, 0.1); return;
      case 'doc': return SB().insertShot(ctx, day, s.value || '', s.doc || 'memo');
      case 'text': return textShot(ctx, s, day, S, W);
      case 'clock': return clockShot(ctx, s, day);
      case 'desk': return R.officeFrame(ctx, day, true, false, S);
      case 'sky': return sky(ctx, s, day);
      case 'home': return home(ctx, s, day, W);
      case 'tableau': return at2x(ctx, (c) => { if (!SB().tableau(c, s.n)) SH().apartment(c, 0.6); }, day);
      case 'racks': return SB().racksShot(ctx, day);
      default: X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    }
  }

  // ---- beats ----
  const SFX = { room: 'room', home: 'apartment', text: 'news', clock: 'tick', doc: 'click', tableau: 'broadcast' };
  // Whether a shot is drawn at 2x (a camera on it moves in 2 px steps, so the dither never flips phase).
  const twoX = (s) => s.k === 'floor' || s.k === 'tableau' || s.k === 'text' || (s.k === 'face' && (!s.on || s.on === 'floor'));
  // One shot as a beat. key: the scene, the decision and the shot's place, for the beat id and the picture cache.
  function shotBeat(s, key, dur, day, S, W, first) {
    const line = fill(s.line, W);
    s = Object.assign({}, s, { body: fill(s.body, W), value: fill(s.value, W) });
    const M = B.Motion, K = B.MotionKit;
    const base = R.beat('screenplay', key, dur, (c) => picture(c, s, day, S, W), line,
      { sfx: first ? 'room' : SFX[s.k], typeFor: typeFor(line), transition: first ? 'fade' : (s.k === 'clock' ? 'cut' : undefined) });
    if (!M || !M.layered || !K) return base;
    // the room's own movement, where the decision art has one, held for the whole shot
    if (s.k === 'room') {
      const L = DA().roomLayers(s.room, day, !!s.after, S, 'room');
      if (L) return M.layered(Object.assign({}, base, L, { camera: K.settle(6, M.ease.inOut) }));
    }
    if (s.k === 'face' && B.Portraits && B.Portraits.has(s.who)) {
      const night = faceNight(s), name = s.who, DAx = DA(), x = s.x || 40;
      return M.layered(Object.assign({}, base, {
        camera: K.rise(12, dur, 0.3, 0.8),
        layers: [
          { id: 'back', depth: 0.3, draw(c) { faceBack(c, s, day, S); } },
          { id: 'speaker', depth: 1, draw(c) { DAx.speaker(c, name, x, night); },
            // a blink once the caption has typed, and one more on a long shot
            animate(g, v, t) {
              const b1 = Math.min(dur - 0.4, base.typeFor + 0.4), b2 = dur - 1.2;
              if ((t >= b1 && t < b1 + 0.12) || (dur > 5 && t >= b2 && t < b2 + 0.12)) DAx.speakerSpace(g, (sp) => B.Portraits.paintEyes(sp, name, night), x, name);
            } }
        ]
      }));
    }
    if (s.k === 'floor' && s.ticker) {
      const tick = R.clean(s.ticker).toUpperCase(), gap = '   ·   ', unit = tick + gap, run = unit.repeat(Math.ceil(120 / unit.length) + 1);
      return M.layered(Object.assign({}, base, {
        camera: K.settle(6, M.ease.inOut, { step2: true }),
        layers: [
          { id: 'floor', depth: 1, draw(c) { floor(c, s, day); } },
          { id: 'ticker', depth: 0, draw() {}, animate(g, v, t) {
            g.save(); g.globalAlpha = 0.85; X.rect(g, 0, 14, V.w, 20, P.ink); g.restore();
            X.rect(g, 0, 33, V.w, 1, P.amberD);
            // only the 56 letters on screen are drawn (each letter is a run of 1 px rects), in whole 2 px steps
            const off = Math.floor(t * 18) % (unit.length * 6), first = Math.floor(off / 6);
            g.save(); g.scale(2, 2); X.text(g, run.slice(first, first + 56), -(off % 6), 10, P.amber); g.restore();
          } }
        ]
      }));
    }
    // every other shot: one slow settle, a few pixels, so no picture is ever a dead still
    return Object.assign(base, { camera: K.settle(twoX(s) ? 6 : 4, M.ease.inOut, twoX(s) ? { step2: true } : undefined) });
  }

  // A personal beat's phone screens are lit at home, not at the office.
  const homed = (id, shots) => (B.Life && B.Life.byId && B.Life.byId(id) ? shots.map((s) => (s.k === 'text' ? Object.assign({ home: true }, s) : s)) : shots);
  // Shot and reverse shot: when the same face comes back to back, it changes sides of the frame, so a speech reads as a conversation.
  function sided(shots) {
    let prev = null, right = false;
    return shots.map((s) => {
      if (s.k !== 'face') { prev = null; return s; }
      right = prev === s.who ? !right : false;
      prev = s.who;
      return right ? Object.assign({}, s, { x: 360 }) : s;
    });
  }
  // The scene before the choices: the script's shots, stretched or squeezed so the scene runs TARGET seconds.
  function screenplayBeats(o) {
    const sc = D() && D().SCRIPTS[o.id];
    if (!sc) return null;
    const day = o.day || 0, S = o.S || null, W = o.W || (S && S.wallet) || null;
    const shots = sided(homed(o.id, sc.shots.filter((s) => wanted(s, S))));
    const raw = shots.map((s) => readFor(fill(s.line, W)));
    const k = D().TARGET / raw.reduce((a, b) => a + b, 0);
    const pet = W && W.pet ? ':' + W.pet.name : '';
    return shots.map((s, i) => shotBeat(s, `${o.id}:${Math.floor(day / 5)}${pet}:${i}`, Math.round(raw[i] * k * 100) / 100, day, S, W, i === 0));
  }
  B.Scenes.screenplay = function (o) {
    const beats = screenplayBeats(o || {});
    if (!beats) return B.Scenes.decision(o || {});
    // short mode plays one beat: the last, which carries the question
    beats[beats.length - 1].informative = true;
    return beats;
  };
  B.Scenes.screenplay.stepped = true;

  // The payoff: the picked option's shots, each as long as its words need.
  B.Scenes.payoff = function (o) {
    o = o || {};
    const sc = D() && D().SCRIPTS[o.id], shots = sc && sc.after[o.opt];
    if (!shots) return [];
    const day = o.day || 0, S = o.S || null, W = o.W || (S && S.wallet) || null, pet = W && W.pet ? ':' + W.pet.name : '';
    const list = sided(homed(o.id, shots.filter((s) => wanted(s, S))));
    const beats = list.map((s, i) => shotBeat(s, `${o.id}:${o.opt}:${Math.floor(day / 5)}${pet}:${i}`, payFor(fill(s.line, W)), day, S, W, i === 0));
    if (beats.length) beats[0].informative = true;
    return beats;
  };
  B.Scenes.payoff.stepped = true;

  // The career, before the ending: one shot for each desk decision you made, in order, with what you did.
  function recapShots(S) {
    const out = [];
    if (!S || !S.choices || !D() || !B.StoryData || !B.StoryData.CHOICES) return out;
    const C = B.StoryData.CHOICES;
    Object.keys(C).filter((id) => S.choices[id] && D().SCRIPTS[id]).sort((a, b) => C[a].day - C[b].day).forEach((id) => {
      const sc = D().SCRIPTS[id], opt = S.choices[id], line = sc.recap && sc.recap[opt];
      if (!line) return;
      // the payoff's first picture that needs no flag, else the scene's room
      const pic = ((sc.after[opt] || []).find((s) => !s.if && !s.unless && s.k !== 'clock')) || { k: 'room', room: id };
      out.push({ id, day: C[id].day, shot: Object.assign({}, pic, { line }) });
    });
    return out;
  }
  B.Scenes.recap = function (o) {
    o = o || {};
    const list = recapShots(o.S);
    if (list.length < 2) return [];
    return list.map((r, i) => shotBeat(r.shot, `recap:${r.id}:${(o.S.choices || {})[r.id]}`, 3.6, r.day, o.S, o.W || null, i === 0));
  };
  B.Scenes.recap.stepped = true;

  // For the tests and the storyboard doc.
  B.Screenplay = { fill, readFor, payFor, typeFor, screenplayBeats, recapShots, picture, has: (id) => !!(D() && D().SCRIPTS[id]) };
})(window.BTB);
