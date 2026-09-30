// The audio front door. Everything in the game keeps calling B.SFX and B.Music;
// this file replaces those two objects with versions that send each call to one
// of two engines:
//
//   New      the synthesized score and sound-effect pack (music-engine.js,
//            sfx-engine.js, data in music-data.js and sfx-pack.js)
//   Classic  the original chiptune and beeps (sfx.js and music.js, untouched)
//
// The player picks with Settings > Sound style. Only one is active at a time.
// The setting lives with the other settings, never in a save file.
//
// In Classic every call does exactly what it always did. In New, each call is
// mapped to a sound id from the pack; the mapping is written out in
// docs/music-kit/mapping.md. Sounds with no good match in the pack (phone ring,
// cinematic room tones) keep their Classic sound in both styles.
(function (B) {
  'use strict';
  const C = { sfx: B.SFX, music: B.Music };
  B.ClassicSFX = C.sfx;
  B.ClassicMusic = C.music;

  const S = {
    style: 'new',
    musicOn: true, musicVol: 0.45, sfxOn: true, sfxVol: 0.6,
    name: null,            // the track the game last asked for
    game: null,            // the running Game, for act / anomaly count / intensity
    nc: null,              // { c, mixer, sfx } once an AudioContext exists
    track: null, trackName: null,
    trace: null,
    lastIntensityAt: 0, dayStartAt: 0, newsAt: -1e9, closeRamp: null, cd: { last: null, riser: false }
  };

  // The old score stays for the ending screens: the kit does not cover them.
  const CLASSIC_ONLY = { endingLight: true, endingDark: true };
  // S.broken: the browser cannot run the new engines, so everything plays Classic.
  const isNew = () => S.style === 'new' && !S.broken;
  const usesClassic = (name) => !isNew() || !!CLASSIC_ONLY[name];

  // The new engines need a few newer Web Audio features (stereo panner, periodic
  // waves, convolver) and BigInt. Anything older plays the Classic sound instead
  // of playing nothing.
  function capable(c) {
    return !!(B.AudioMixer && B.SfxEngine && B.MusicEngine && B.AudioVoices && B.AudioData && B.AudioData.scores && B.AudioData.sfx &&
      c.createStereoPanner && c.createPeriodicWave && c.createConvolver && c.createWaveShaper && c.createChannelMerger && c.createDelay);
  }

  function audio() {
    if (S.nc) return S.nc;
    if (S.broken) return null;
    const c = C.sfx.context();
    if (!c) return null;                       // no Web Audio at all (or not created yet)
    if (!capable(c)) { S.broken = true; return null; }
    const mixer = B.AudioMixer.get(c);
    mixer.setMusic(S.musicVol, S.musicOn);
    mixer.setSfx(S.sfxVol, S.sfxOn);
    // Build the reverb tails in the background, in the order they will be wanted.
    const sc = B.AudioData.scores, list = [[sc.menu.mix.reverb.seconds, 5, 0.02], [1.4, 31, 0.012], [2.2, 31, 0.012]];
    ['feed1', 'game1', 'feed2', 'game2', 'feed3', 'game3', 'feed4', 'game4'].forEach((k) => list.push([sc[k].mix.reverb.seconds, 5, 0.02]));
    B.AudioVoices.warm(c, list);
    return (S.nc = { c, mixer, sfx: B.SfxEngine.make(mixer) });
  }
  const sfx = (id, o) => {
    if (!isNew() || !S.sfxOn) return false;
    const a = audio();
    if (!a) return false;
    const ok = a.sfx.play(id, o);
    if (S.trace) S.trace.push({ id, o, ok, t: a.c.currentTime });   // tests record what was asked for
    return ok;
  };

  // ---- which act are we in --------------------------------------------------
  // D1-D15 Act I, D16-D30 II, D31-D45 III, D46-D61 IV. Endless is always Act I.
  function actOf(g) {
    g = g || S.game;
    if (g && g.mode && g.mode.kind === 'story' && B.StoryData && B.StoryData.actIndex) return B.StoryData.actIndex(g.day);
    return 0;
  }
  function anomalyOf(g) {
    g = g || S.game;
    return g && g.mode && g.mode.kind === 'story' && g.mode.S ? Math.max(0, Math.min(12, g.mode.S.anomalies | 0)) : 0;
  }

  const PLAN = {
    menu: () => ({ key: 'menu', fadeIn: 0.3 }),
    brief: () => ({ key: 'feed' + (actOf() + 1), anomaly: anomalyOf(), fadeIn: 0.5 }),
    trading: () => ({ key: 'game' + (actOf() + 1), anomaly: anomalyOf(), intensity: 0.25, fadeIn: 0.25 }),
    // The report bed: the day's loop with only the pad, bass and tape (handoff 7.5).
    close: () => ({ key: 'game' + (actOf() + 1), anomaly: anomalyOf(), intensity: 0.1, fadeIn: 1 })
  };

  function stopNew(tc) {
    const t = S.track;
    S.track = null; S.trackName = null;
    if (t) t.stop(tc);
  }
  function classicOff() {
    C.music.stop();
    C.music.name = null;   // so a later mute toggle cannot bring the old score back under the new one
  }

  function playNew(name, force) {
    const plan = PLAN[name];
    if (!plan) return false;
    if (S.track && S.trackName === name && !S.track.stopped && !force) return true;
    const a = audio();
    if (!a) return false;
    stopNew(0.25);
    classicOff();
    const p = plan();
    S.track = B.MusicEngine.play(a.c, a.mixer.music, p.key, { anomaly: p.anomaly, intensity: p.intensity, fadeIn: p.fadeIn });
    S.trackName = name;
    if (name === 'trading') { S.dayStartAt = Date.now(); S.closeRamp = null; }
    return !!S.track;
  }

  // ---- Music ----------------------------------------------------------------
  const Music = {
    get vol() { return S.musicVol; },
    get enabled() { return S.musicOn; },
    ctx() { return C.sfx.context(); },
    bus() { return C.sfx.musicBus(); },
    setGame(g) { S.game = g; },

    setVolume(v) {
      S.musicVol = v;
      C.music.setVolume(v);
      if (S.nc) S.nc.mixer.setMusic(v, S.musicOn);
    },
    setEnabled(on) {
      S.musicOn = on;
      if (S.nc) S.nc.mixer.setMusic(S.musicVol, on);
      const classic = S.name && usesClassic(S.name);
      if (!classic) C.music.name = null;       // keep the old score quiet while the new one is the voice
      C.music.setEnabled(on);
      if (!on) { stopNew(0.1); return; }
      if (S.name && !classic) playNew(S.name, true);
    },
    // Pausing the game dips the music.
    duck(on) {
      C.music.duck(on);
      if (S.nc) S.nc.mixer.setPaused(!!on);
    },
    fadePresence(v, s) { return C.music.fadePresence(v, s); },
    useTrack(name, url) { return C.music.useTrack(name, url); },

    play(name, force) {
      S.name = name;
      if (!S.musicOn) { if (!usesClassic(name)) C.music.name = null; else C.music.name = name; return; }
      if (usesClassic(name)) { stopNew(0.25); C.music.play(name, force); return; }
      if (!playNew(name, force)) {
        if (S.broken) C.music.play(name, force);   // this browser cannot run the new engines
        else C.music.name = null;
      }
    },
    // The player skipped the pre-open feed: drop its music fast.
    skipFeed() { if (S.trackName === 'brief') stopNew(0.12); },
    // o.fade: fade-out time constant in seconds (the new engine only).
    stop(o) {
      stopNew(o && o.fade);
      C.music.stop();
    },

    // The trading day. stress and dayPos are the old inputs; the new engine
    // builds its own intensity from the game (see intensityFor).
    setIntensity(stress, dayPos, g) {
      if (!isNew()) { C.music.setIntensity(stress, dayPos); return; }
      const t = S.track;
      if (!t || S.trackName !== 'trading') return;
      const now = Date.now();
      if (now - S.lastIntensityAt < 240) return;      // a few times a second is plenty
      S.lastIntensityAt = now;
      t.setIntensity(Music.intensityFor(g || S.game, stress, now));
    },

    // intensity = clamp(0.25 + 0.45 volatility + 0.15 exposure + 0.25 newsBurst
    //                   + 0.15 decisionOpen + closeRush)            (handoff 7.6)
    // plus a small push from the game's own stress meter, so a panic or a margin
    // call is never played over a calm bed. Capped at 0.35 for the first 10 seconds.
    intensityFor(g, stress, now) {
      now = now == null ? Date.now() : now;
      if (!g || !g.market) return 0.4;
      const act = actOf(g);
      const volMax = [0.007, 0.012, 0.015, 0.03][act];
      const volatility = Math.min(1, Math.abs(g.market.indexMove(30)) / volMax);
      const b = g.broker;
      let exposure = 0;
      const cap = b.rules.maxLev * Math.max(1, b.netLiq());
      if (cap > 0) exposure = Math.min(1, b.stockGross() / cap);
      const burst = Math.max(0, 1 - (now - S.newsAt) / 10000);
      const a = g.interrupts && g.interrupts.active;
      const decision = a && a.kind === 'choice' && a.state === 'open' ? 1 : 0;
      const rem = Music.secondsToClose(g);
      const closeRush = rem < 15 ? (15 - rem) / 15 : 0;
      let x = 0.25 + 0.45 * volatility + 0.15 * exposure + 0.25 * burst + 0.15 * decision + closeRush
        + 0.2 * Math.max(0, ((stress || 0) - 0.6) / 0.4);
      if (rem <= 8) {
        // the last eight seconds climb to full tension with the riser
        if (!S.closeRamp) S.closeRamp = Math.min(1, x);
        x = Math.max(x, S.closeRamp + (1 - S.closeRamp) * (8 - rem) / 8);
      }
      if (now - S.dayStartAt < 10000) x = Math.min(x, 0.35);
      return Math.max(0, Math.min(1, x));
    },
    secondsToClose(g) {
      const rate = (g.rate || 1) * (g.speed || 1);
      return Math.max(0, (B.DAY_MIN - g.market.t) / rate);
    },
    // A big Wire event just landed.
    burst() { S.newsAt = Date.now(); },

    // One-shot stingers. The new pack covers these moments with sound effects.
    cue(name) { if (!isNew()) C.music.cue(name); }
  };

  // ---- Sound effects ----------------------------------------------------------
  const SFX = {
    unlock() { C.sfx.unlock(); if (isNew()) audio(); },
    context() { return C.sfx.context(); },
    musicBus() { return C.sfx.musicBus(); },
    setVolume(v) { S.sfxVol = v; C.sfx.setVolume(v); if (S.nc) S.nc.mixer.setSfx(v, S.sfxOn); },
    setEnabled(e) { S.sfxOn = e; C.sfx.setEnabled(e); if (S.nc) S.nc.mixer.setSfx(S.sfxVol, e); },

    // -- the clock
    bell() { if (isNew()) sfx('bell_open'); else C.sfx.bell(); },
    haltEnd() { if (isNew()) sfx('bell_open'); else C.sfx.bell(); },
    marketClose() { if (isNew()) sfx('bell_close'); },
    // Seconds of real time left before the closing bell; called every tick.
    countdown(rem) {
      if (!isNew()) return;
      const cd = S.cd;
      if (rem > 10) { cd.last = null; cd.riser = false; return; }
      if (rem <= 8 && !cd.riser) { cd.riser = true; sfx('close_riser'); }
      const sec = Math.ceil(rem - 1e-6);
      if (sec < 1 || sec === cd.last) return;
      cd.last = sec;
      sfx(sec >= 4 ? 'countdown_tick' : 'countdown_final');
    },

    // -- orders. side is the signed quantity. info: { before, realized, eq, resting, closing }
    fill(side, info) {
      if (!isNew()) { C.sfx.fill(side); return; }
      info = info || {};
      let kind;
      if (info.resting) kind = 'limit';
      else if (info.kind) kind = info.kind;
      else if (info.before == null) kind = side > 0 ? 'buy' : 'sell';
      else if (side > 0) kind = info.before < 0 ? 'cover' : 'buy';
      else kind = info.before > 0 ? 'sell' : 'short';
      sfx({ limit: 'order_limit_fill', buy: 'order_buy', sell: 'order_sell', short: 'order_short', cover: 'order_cover' }[kind]);
      const closing = info.closing != null ? info.closing : (kind === 'sell' || kind === 'cover' || kind === 'limit');
      if (closing && info.realized != null) {
        const thr = Math.max(1, (info.eq || 250000) * 0.0005);
        // The result plays a beat after the order, so the two do not stack.
        if (info.realized > thr) sfx('win_close', { delay: 0.25 });
        else if (info.realized < -thr) sfx('loss_close', { delay: 0.25 });
      }
    },
    cash(kind) {
      if (!isNew()) { C.sfx.cash(); return; }
      if (kind === 'trade') return;              // fill() already played the result
      if (kind === 'vote') sfx('hope_chime');
      else sfx('order_limit_fill');              // a client order worked
    },
    reject() { if (isNew()) sfx('order_reject'); else C.sfx.reject(); },
    limitSet() { if (isNew()) sfx('order_limit_set'); else C.sfx.click(); },
    orderCancel() { if (isNew()) sfx('order_cancel'); else C.sfx.click(); },

    // -- buttons and screens
    click() { if (isNew()) sfx('ui_click'); else C.sfx.click(); },
    uiTab() { if (isNew()) sfx('ui_tab'); },
    ground() { if (isNew()) sfx('ui_tab'); else C.sfx.ground(); },
    tick() { if (!isNew()) C.sfx.tick(); },                  // the closing countdown replaces it
    heartbeat(i) { if (!isNew()) C.sfx.heartbeat(i); },      // the score has its own heartbeat
    phoneOpen() { sfx('phone_open'); },
    feedSkip() { sfx('feed_skip'); },

    // -- feeds and messages. info: { kind: wire|chirp|inbox|note|sub|alert|push, from, big }
    news(info) {
      info = info || {};
      if (!isNew()) {
        if (info.kind === 'chirp' || info.kind === 'alert' || info.kind === 'push') return;
        C.sfx.news();
        return;
      }
      const k = info.kind || 'wire';
      if (k === 'wire' || k === 'chirp') { if (!info.big) sfx('sqwak_post'); return; }
      if (k === 'alert') { sfx('sqwak_alert_wire'); return; }
      if (k === 'push') { sfx('sqwak_push'); return; }
      const from = String(info.from || '');
      if (/imani/i.test(from)) sfx('dm_imani');
      else if (/kroll/i.test(from)) sfx('dm_kroll');
      else if (/compliance/i.test(from)) sfx('dm_compliance');
      else sfx('mail_new');
    },
    resqwak() { if (isNew()) sfx('sqwak_resqwak'); else C.sfx.click(); },
    paywall() { if (isNew()) sfx('sqwak_paywall'); else C.sfx.click(); },
    anomaly(n) { if (isNew()) sfx('anomaly_logged', { n }); else C.sfx.click(); },

    // -- alarms, shocks
    alarm(kind) {
      if (!isNew()) { C.sfx.alarm(); return; }
      sfx(kind === 'overnight' ? 'heat_up' : 'halt');
    },
    crash() { if (isNew()) sfx('flash_crash'); else C.sfx.crash(); },
    halt() { if (isNew()) sfx('halt'); else C.sfx.halt(); },
    panic() { if (isNew()) sfx('decision_timeout'); else C.sfx.panic(); },
    heatUp() { sfx('heat_up'); },

    // -- decisions. kind: card (a story decision) | choice (a timed call) | call (any other call)
    choice(kind) {
      if (!isNew()) { C.sfx.choice(); return; }
      if (kind === 'call') sfx('ui_click'); else sfx('decision_prompt');
    },
    decisionTick() { sfx('decision_tick'); },
    decisionTimeout() { sfx('decision_timeout'); },
    decisionConfirm() { sfx('decision_confirm'); },

    // -- quotas and endings
    quotaMet() { sfx('quota_met'); },
    quotaMissed() { sfx('quota_missed'); },
    weekMade() { sfx('week_made'); },
    strike() { sfx('strike_added'); },
    // The ending screen. e is the ending: { id, unpriced }.
    ending(e) {
      if (!isNew()) { C.sfx.closeBell(); return; }
      e = e || {};
      const hollow = ['master', 'clawback', 'everything-rally', 'acquirer', 'ward'];
      if (e.unpriced) sfx('ending_unpriced');
      else if (e.id === 'wiped') sfx('ending_wiped');
      else if (e.id === 'fired') sfx('ending_fired');
      else if (hollow.indexOf(e.id) >= 0) sfx('ending_hollow_win');
      else sfx('bell_close');
    },
    // Dialogue blips, if a screen ever prints text a letter at a time.
    blip(who, ch) {
      if (!isNew() || !S.sfxOn) return false;
      const a = audio();
      return a ? a.sfx.blip(who, ch) : false;
    }
  };
  // Sounds with no equivalent in the pack keep their Classic voice in both styles.
  ['loss', 'ring', 'room', 'apartment', 'kitchen', 'transit', 'street', 'broadcast', 'elevator', 'office'].forEach((k) => {
    SFX[k] = function () { return C.sfx[k].apply(C.sfx, arguments); };
  });

  // ---- the setting ------------------------------------------------------------
  B.Sound = {
    style() { return S.style; },
    isNew,
    // 'new' or 'classic'. Anything else counts as new.
    setStyle(style) {
      style = style === 'classic' ? 'classic' : 'new';
      if (style === S.style) return;
      S.style = style;
      if (S.track) stopNew(0.15);
      if (style === 'new') classicOff(); else C.music.stop();
      // carry on with the track the game was playing, in the other voice
      if (S.name && S.musicOn) Music.play(S.name, true);
    },
    state: S,
    // for tests
    plan: PLAN, actOf, anomalyOf
  };

  B.SFX = SFX;
  B.Music = Music;
})(window.BTB);
