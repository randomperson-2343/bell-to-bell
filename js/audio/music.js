// Adaptive chiptune score. Synthesized, no audio files — same spirit as sfx.js.
//
// Four voices in the SNES/NES tradition: two pulse channels, a triangle bass and
// a noise channel for percussion. Tracks are step patterns; layers fade in and
// out with stress and the clock instead of hard-cutting, so the music tightens as
// the day gets worse without you noticing the seams.
//
// Dropping in real music later: call Music.useTrack('trading', url) and the
// synth stays out of the way. Nothing else in the game needs to change.
(function (B) {
  'use strict';

  const STEP = 16;          // steps per bar
  const LOOKAHEAD = 0.12;   // seconds of scheduling runway

  // Semitone offsets from the track root. null = rest.
  const _ = null;

  const TRACKS = {
    menu: {
      bpm: 84, root: 41, // F2-ish, minor and tired
      bass: [0, _, _, _, 0, _, _, _, -5, _, _, _, -5, _, _, _],
      pad: [12, _, _, _, 15, _, _, _, 19, _, _, _, 15, _, _, _],
      lead: [_, _, 24, _, 27, _, 26, _, 24, _, _, _, 19, _, _, _],
      drums: [_, _, _, _, 1, _, _, _, _, _, _, _, 1, _, 2, _],
      layers: { pad: 0.9, lead: 0.55, drums: 0.25 }
    },
    brief: {
      bpm: 72, root: 45,
      bass: [0, _, _, _, _, _, _, _, -3, _, _, _, _, _, _, _],
      pad: [12, _, _, _, _, _, 16, _, _, _, _, _, 19, _, _, _],
      lead: [_, _, _, _, _, _, _, _, _, _, 24, _, _, _, _, _],
      drums: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
      layers: { pad: 0.7, lead: 0.4, drums: 0 }
    },
    trading: {
      bpm: 108, root: 40,
      bass: [0, _, 0, _, 7, _, 0, _, -2, _, -2, _, 5, _, 3, _],
      pad: [12, _, _, _, 15, _, _, _, 14, _, _, _, 17, _, _, _],
      lead: [24, _, _, _, 31, _, _, _, 26, _, _, _, 19, _, 22, _],
      drums: [1, _, _, _, 3, _, 2, _, 1, _, _, _, 3, _, 2, _],
      layers: { pad: 0.42, lead: 0.24, drums: 0.35 }
    },
    close: {
      bpm: 92, root: 43,
      bass: [0, _, _, _, _, _, _, _, 5, _, _, _, 7, _, _, _],
      pad: [12, _, _, _, 16, _, _, _, 19, _, _, _, 24, _, _, _],
      lead: [_, _, _, _, 28, _, 24, _, _, _, 19, _, _, _, _, _],
      drums: [_, _, _, _, 1, _, _, _, _, _, _, _, 1, _, _, _],
      layers: { pad: 0.8, lead: 0.6, drums: 0.2 }
    },
    endingLight: {
      bpm: 88, root: 45,
      bass: [0, _, _, _, 7, _, _, _, 5, _, _, _, 3, _, _, _],
      pad: [12, _, 16, _, 19, _, 16, _, 17, _, 21, _, 19, _, 16, _],
      lead: [28, _, _, _, 31, _, 28, _, 26, _, _, _, 24, _, _, _],
      drums: [1, _, _, _, 2, _, _, _, 1, _, _, _, 2, _, 2, _],
      layers: { pad: 0.85, lead: 0.7, drums: 0.35 }
    },
    endingDark: {
      bpm: 66, root: 38,
      bass: [0, _, _, _, _, _, _, _, -1, _, _, _, _, _, _, _],
      pad: [12, _, _, _, 13, _, _, _, 12, _, _, _, 11, _, _, _],
      lead: [_, _, _, _, 24, _, _, _, 23, _, _, _, _, _, _, _],
      drums: [_, _, _, _, _, _, _, _, 3, _, _, _, _, _, _, _],
      layers: { pad: 0.9, lead: 0.5, drums: 0.2 }
    }
  };

  const CUES = {
    breaker: [[0, 55, 0.5, 'sawtooth'], [0, 58, 0.5, 'sawtooth'], [0.18, 41, 0.9, 'square']],
    margin: [[0, 466, 0.16, 'square'], [0.18, 440, 0.16, 'square'], [0.36, 415, 0.3, 'square']],
    panic: [[0, 36, 2.4, 'sine'], [0, 37, 2.4, 'sine']]
  };

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const M = {
    vol: 0.45,
    enabled: true,
    track: null,
    name: null,
    step: 0,
    nextTime: 0,
    timer: null,
    intensity: 0,
    dayPos: 0,
    ducked: false,
    external: {},   // name -> url, for real audio dropped in later
    audioEl: null,

    ctx() { return B.SFX.context(); },
    bus() { return B.SFX.musicBus(); },

    setVolume(v) {
      this.vol = v;
      const b = this.bus();
      if (b) b.gain.value = this.enabled ? v * (this.ducked ? 0.35 : 1) : 0;
    },

    setEnabled(on) {
      this.enabled = on;
      this.setVolume(this.vol);
      if (!on) this.stop();
      else if (this.name) this.play(this.name, true);
    },

    duck(on) {
      this.ducked = !!on;
      this.setVolume(this.vol);
    },

    // Swap the synthesized track for a real audio file, if one is ever supplied.
    useTrack(name, url) { this.external[name] = url; },

    play(name, force) {
      if (!this.enabled) { this.name = name; return; }
      if (this.name === name && this.timer && !force) return;
      this.stop();
      this.name = name;
      if (this.external[name]) return this.playExternal(this.external[name]);
      const t = TRACKS[name];
      if (!t) return;
      const c = this.ctx();
      if (!c) return;
      this.setVolume(this.vol);
      this.track = t;
      this.step = 0;
      this.nextTime = c.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 25);
    },

    playExternal(url) {
      try {
        if (!this.audioEl) { this.audioEl = new Audio(); this.audioEl.loop = true; }
        this.audioEl.src = url;
        this.audioEl.volume = this.enabled ? this.vol : 0;
        this.audioEl.play().catch(() => { /* autoplay blocked until first click */ });
      } catch (e) { /* no audio element available */ }
    },

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.audioEl) { try { this.audioEl.pause(); } catch (e) { /* already stopped */ } }
      this.track = null;
    },

    // Stress 0..1 and how far through the session we are 0..1.
    // Layers ride these, which is the whole adaptive trick.
    setIntensity(stress, dayPos) {
      this.intensity = B.clamp(stress, 0, 1);
      this.dayPos = B.clamp(dayPos || 0, 0, 1);
    },

    schedule() {
      const c = this.ctx();
      const t = this.track;
      if (!c || !t) return;
      // Tempo tightens as stress rises and the close approaches.
      const bpm = t.bpm * (1 + this.intensity * 0.10 + this.dayPos * 0.04);
      const spb = 60 / bpm / 4; // sixteenth notes
      while (this.nextTime < c.currentTime + LOOKAHEAD) {
        this.playStep(this.step % STEP, this.nextTime, spb);
        this.step++;
        this.nextTime += spb;
      }
    },

    playStep(i, when, spb) {
      const t = this.track, L = t.layers;
      const ramp = this.intensity;
      // Bass and pad hold the floor; lead and drums come in as it gets worse.
      this.voice(t.bass[i], t.root, when, spb * 3.2, 'triangle', 0.16 * L.pad + 0.06);
      this.voice(t.pad[i], t.root, when, spb * 3.6, 'square', 0.035 * L.pad * (0.6 + ramp * 0.5));
      this.voice(t.lead[i], t.root, when, spb * 1.6, 'square', 0.035 * L.lead * (0.3 + ramp * 0.7));
      this.drum(t.drums[i], when, 0.72 * L.drums * (0.35 + ramp * 0.6));
    },

    voice(n, root, when, dur, type, gain) {
      if (n == null || gain <= 0.001) return;
      const c = this.ctx(), bus = this.bus();
      if (!c || !bus) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(midi(root + n), when);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g); g.connect(bus);
      osc.start(when);
      osc.stop(when + dur + 0.03);
    },

    drum(kind, when, gain) {
      if (kind == null || gain <= 0.01) return;
      const c = this.ctx(), bus = this.bus();
      if (!c || !bus) return;
      if (kind === 1) {                      // kick
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, when);
        o.frequency.exponentialRampToValueAtTime(42, when + 0.09);
        g.gain.setValueAtTime(0.28 * gain, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
        o.connect(g); g.connect(bus);
        o.start(when); o.stop(when + 0.16);
      } else {                               // 2 = hat, 3 = snare
        const src = c.createBufferSource();
        if (!this._noise) {
          this._noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
          const d = this._noise.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        src.buffer = this._noise;
        const f = c.createBiquadFilter();
        f.type = kind === 3 ? 'bandpass' : 'highpass';
        f.frequency.value = kind === 3 ? 1800 : 6500;
        const g = c.createGain();
        const dur = kind === 3 ? 0.13 : 0.04;
        g.gain.setValueAtTime((kind === 3 ? 0.14 : 0.06) * gain, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        src.connect(f); f.connect(g); g.connect(bus);
        src.start(when); src.stop(when + dur + 0.02);
      }
    },

    // One-shot stinger over whatever is playing.
    cue(name) {
      if (!this.enabled) return;
      const c = this.ctx(), bus = this.bus();
      const list = CUES[name];
      if (!c || !bus || !list) return;
      const t0 = c.currentTime;
      for (const [off, note, dur, type] of list) {
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(note > 90 ? note : midi(note), t0 + off);
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + dur);
        osc.connect(g); g.connect(bus);
        osc.start(t0 + off);
        osc.stop(t0 + off + dur + 0.05);
      }
    }
  };

  B.Music = M;
})(window.BTB);
