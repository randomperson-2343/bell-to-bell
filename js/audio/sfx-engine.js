// The shared output stage and the sound-effect player for the new audio.
//
//   music tracks -> duck -> pause duck -> music volume -+
//                                                        +-> soft limiter -> speakers
//   sound effects ----------------------> sfx volume ----+
//
// The new audio has its own buses and never touches the Classic music bus, so
// the two styles cannot leak into each other. Volumes: the game's sliders keep
// their old defaults (music 0.45, sound 0.6). The kit's loudness targets and its
// sound-effect balance were set with both at their defaults, so a slider at its
// default plays the pieces at exactly the kit's level.
(function (B) {
  'use strict';
  const V = B.AudioVoices;
  const MUSIC_REF = 0.45, SFX_REF = 0.6;

  // ---- mixer ---------------------------------------------------------------
  const MIX = new WeakMap();

  function softLimitCurve() {
    const size = 4096, range = 4, curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1) * 2 - 1) * range, a = Math.abs(x);
      curve[i] = a <= 0.7 ? x : Math.sign(x) * (0.7 + 0.2 * Math.tanh((a - 0.7) / 0.2));
    }
    return curve;
  }

  function createMixer(c) {
    const m = { c, musicOn: true, sfxOn: true, musicVol: MUSIC_REF, sfxVol: SFX_REF, duckState: null };
    m.music = c.createGain();
    m.duckGain = c.createGain();
    m.pauseGain = c.createGain();
    m.musicGain = c.createGain();
    m.sfx = c.createGain();
    m.sfxGain = c.createGain();
    m.sum = c.createGain();
    m.limiter = c.createWaveShaper();
    m.limiter.curve = softLimitCurve();
    const pre = c.createGain();
    pre.gain.value = 1 / 4;
    m.music.connect(m.duckGain); m.duckGain.connect(m.pauseGain); m.pauseGain.connect(m.musicGain); m.musicGain.connect(m.sum);
    m.sfx.connect(m.sfxGain); m.sfxGain.connect(m.sum);
    m.sum.connect(pre); pre.connect(m.limiter); m.limiter.connect(c.destination);
    m.apply = function () {
      const now = c.currentTime;
      m.musicGain.gain.setTargetAtTime(m.musicOn ? m.musicVol / MUSIC_REF : 0, now, 0.03);
      m.sfxGain.gain.setTargetAtTime(m.sfxOn ? m.sfxVol / SFX_REF : 0, now, 0.03);
    };
    m.setMusic = function (vol, on) { m.musicVol = vol; m.musicOn = on; m.apply(); };
    m.setSfx = function (vol, on) { m.sfxVol = vol; m.sfxOn = on; m.apply(); };
    // The pause menu dips the music; it comes back when the game resumes.
    m.setPaused = function (on) {
      m.pauseGain.gain.cancelScheduledValues(c.currentTime);
      m.pauseGain.gain.setTargetAtTime(on ? 0.35 : 1, c.currentTime, 0.08);
    };
    // Duck the music by `db` while a loud sound plays: 20 ms down, hold, 0.6 s
    // back up. A second ducking sound takes the deeper dip and the later release.
    m.duck = function (db, soundSeconds) {
      if (!(db > 0)) return;
      const now = c.currentTime, att = 0.02, rel = 0.6;
      const hold = Math.min(0.35 + 0.15 * (soundSeconds || 0), 2.0);
      const s = m.duckState;
      let depth = Math.pow(10, -db / 20), holdEnd = now + att + hold;
      let from = 1;
      if (s && now < s.relEnd) {
        from = V.duckValue(s, now);
        if (now < s.holdEnd) { depth = Math.min(depth, s.depth); holdEnd = Math.max(holdEnd, s.holdEnd); }
      }
      m.duckState = { depth, holdEnd, relEnd: holdEnd + rel, t0: now, from, att };
      const p = m.duckGain.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(from, now);
      p.linearRampToValueAtTime(depth, now + att);
      p.setValueAtTime(depth, holdEnd);
      p.linearRampToValueAtTime(1, holdEnd + rel);
    };
    return m;
  }

  // Value of the duck envelope at time t, from the state that scheduled it.
  V.duckValue = function (s, t) {
    if (t <= s.t0) return s.from;
    if (t < s.t0 + s.att) return s.from + (s.depth - s.from) * ((t - s.t0) / s.att);
    if (t < s.holdEnd) return s.depth;
    if (t < s.relEnd) return s.depth + (1 - s.depth) * ((t - s.holdEnd) / (s.relEnd - s.holdEnd));
    return 1;
  };

  B.AudioMixer = {
    MUSIC_REF, SFX_REF,
    get(c) {
      if (!c) return null;
      let m = MIX.get(c);
      if (!m) MIX.set(c, m = createMixer(c));
      return m;
    }
  };

  // ---- sound effects -------------------------------------------------------
  const SPEAKERS = { imani: 'imani', kroll: 'kroll', sana: 'sana', thorne: 'thorne', compliance: 'compliance' };

  function makeEngine(mixer) {
    const c = mixer.c;
    const E = { mixer, last: {}, active: {}, rooms: {}, plays: 0 };

    function room(seconds) {
      let r = E.rooms[seconds];
      if (!r) {
        const input = c.createGain(), conv = V.convolver(c, seconds, 31, 0.012), out = V.gain(c, 1.2);
        input.connect(conv); conv.connect(out); out.connect(mixer.sfx);
        r = E.rooms[seconds] = { input };
      }
      return r.input;
    }

    // pack: a sound from sfx-pack.js (or a modified copy). o: { n, delay, gain }
    function build(id, pack, o) {
      const now = c.currentTime, t0 = now + (o.delay || 0);
      const ctl = c.createGain();
      const snd = V.gain(c, pack.gain * (o.gain == null ? 1 : o.gain));
      snd.connect(ctl);
      ctl.connect(mixer.sfx);
      if (pack.rev > 0) { const send = V.gain(c, pack.rev); ctl.connect(send); send.connect(room(pack.room || 1.4)); }
      let end = t0;
      const base = V.hashString(id);
      pack.voices.forEach((v, i) => { end = Math.max(end, V.sfxVoice(c, snd, t0, v, V.hash(base, i, 1), o.n)); });
      return { ctl, end, t0 };
    }

    // Play a sound by id. Returns true if it started.
    E.play = function (id, o) {
      o = o || {};
      const pack = B.AudioData && B.AudioData.sfx && B.AudioData.sfx[id];
      if (!pack) return false;
      const now = c.currentTime;
      if (!o.force && E.last[id] != null && now - E.last[id] < pack.cooldown) return false;
      E.last[id] = now;
      const live = (E.active[id] || (E.active[id] = [])).filter((v) => v.end > now);
      E.active[id] = live;
      while (live.length >= pack.maxVoices) {
        const old = live.shift();
        try {
          old.ctl.gain.cancelScheduledValues(now);
          old.ctl.gain.setValueAtTime(1, now);
          old.ctl.gain.linearRampToValueAtTime(0, now + 0.03);
        } catch (err) { /* already gone */ }
        old.end = now + 0.03;
      }
      let n = o.n;
      if (pack.nParam) n = Math.max(pack.nParam.min, Math.min(pack.nParam.max, n == null ? pack.nParam.default : n));
      const v = build(id, pack, { n, delay: o.delay, gain: o.gain });
      live.push({ ctl: v.ctl, end: v.end });
      if (pack.duck > 0) {
        if (o.delay) setTimeout(() => mixer.duck(pack.duck, pack.durationS), o.delay * 1000);
        else mixer.duck(pack.duck, pack.durationS);
      }
      E.plays++;
      setTimeout(() => { try { v.ctl.disconnect(); } catch (err) { /* already gone */ } }, (v.end - now + 0.3) * 1000);
      return true;
    };

    // One dialogue blip for a printed character (handoff 6.10). Spaces and
    // punctuation are silent.
    E.blip = function (who, ch) {
      if (!ch || !/[A-Za-z0-9]/.test(ch)) return false;
      const id = 'text_blip_' + (SPEAKERS[who] || 'narrator');
      const pack = B.AudioData.sfx[id];
      if (!pack) return false;
      const now = c.currentTime;
      if (E.last[id] != null && now - E.last[id] < pack.cooldown) return false;
      E.last[id] = now;
      const cv = pack.charVariation;
      const n = cv.baseMidi + cv.semitones[ch.charCodeAt(0) % cv.semitones.length];
      const voices = pack.voices.map((v, i) => (i ? v : Object.assign({}, v, { n })));
      const v = build(id, Object.assign({}, pack, { voices }), {});
      setTimeout(() => { try { v.ctl.disconnect(); } catch (err) { /* already gone */ } }, (v.end - now + 0.3) * 1000);
      return true;
    };
    return E;
  }

  B.SfxEngine = { make: makeEngine };
})(window.BTB);
