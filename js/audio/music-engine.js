// Plays the scores in js/audio/music-data.js.
//
// A score is a list of timed note events on named layers. The engine schedules
// them a little ahead of the audio clock, loops forever, and sends every layer
// through the same chain the kit's Python renderer used:
//
//   voices -> layer gain (x intensity curve) -> dry / reverb send / echo send
//   sends  -> shared reverb + ping-pong echo -> master -> track gain
//
// Gameplay scores are adaptive: setIntensity(0..1) moves every layer along its
// own curve. The anomaly ghost (a thin, sharp, late echo of the melody layer)
// is added at start time from the anomaly count.
//
// Nothing here is unseeded: noise comes from a fixed-seed generator and the
// timing jitter that matters is already baked into the score data.
(function (B) {
  'use strict';
  const V = B.AudioVoices;
  const LOOKAHEAD = 0.25;    // seconds of events scheduled ahead of the audio clock
  const TICK_MS = 25;        // how often the scheduler wakes up
  const LATE_DROP = 0.12;    // events later than this are skipped rather than bunched up
  const EASE_TC = 0.4;       // intensity easing, seconds (setTargetAtTime time constant)
  const SKIP_AFTER = 2.5;    // a layer silent this long stops being scheduled, seconds

  // If the audio thread cannot keep up (the audio clock falls behind the wall
  // clock), the engine thins the arrangement in stages rather than crackle. Each
  // stage stops scheduling the layers listed; the score is otherwise the same.
  // The most expensive layers go first (the electric-piano stabs, then the glass
  // arpeggio and the extra swarm copies).
  const LIGHTEN = [
    ['keys', 'lead2', 'tick', 'kick2', 'train', 'osc_b'],
    ['arp', 'swarm_c', 'swarm_d', 'ep', 'tremor'],
    ['tock', 'swarm_b', 'lead', 'melody', 'bell']
  ];
  const DRIFT_WINDOW_S = 10, DRIFT_MIN = 0.95;   // clock ratio under this for 10 s counts as struggling

  // Tuples in the data file -> event objects, once per score.
  function events(score) {
    if (score._ev) return score._ev;
    const list = score.events.map((r, i) => ({ t: r[0], d: r[1], n: r[2], v: r[3], i: r[4], l: r[5], p: r[6], x: r[7] || null, k: i }));
    list.sort((a, b) => a.t - b.t || a.k - b.k);
    return (score._ev = list);
  }

  function curveAt(points, x) {
    if (!points || !points.length) return 1;
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (x <= points[i][0]) {
        const a = points[i - 1], b = points[i];
        return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0] || 1));
      }
    }
    return points[points.length - 1][1];
  }

  // The anomaly ghost of a score for count n (handoff 7.3). Not in the data files.
  function ghostEvents(score, n) {
    if (!(n > 0)) return [];
    const layers = score.mix.ghostLayers || [], spb = 60 / score.bpm, out = [];
    for (const e of events(score)) {
      if (layers.indexOf(e.l) < 0 || e.n == null) continue;
      out.push({
        t: e.t + (n * 0.015) / spb, d: e.d, n: e.n, v: Math.min(1, e.v * (0.22 + 0.045 * n)),
        i: 'ghost', l: 'ghost', p: Math.max(-1, Math.min(1, -e.p - 0.1)), x: { cents: 3 * n }, k: e.k, src: e.l
      });
    }
    out.sort((a, b) => a.t - b.t || a.k - b.k);
    return out;
  }

  class Track {
    // c: AudioContext (or OfflineAudioContext). dest: where the track's output goes.
    // o: { anomaly, intensity, startAt, fadeIn, key }
    constructor(c, score, dest, o) {
      o = o || {};
      this.c = c;
      this.score = score;
      this.key = o.key || score.name;
      this.spb = 60 / score.bpm;
      this.loopSeconds = score.loopBeats * this.spb;   // exact: the data file rounds loopSeconds
      this.anomaly = Math.max(0, Math.min(12, o.anomaly | 0));
      this.intensity = o.intensity == null ? 0.6 : o.intensity;
      this.timer = null;
      this.stopped = false;
      this.only = o.only || null;   // test hook: play just these layers
      this.dropped = {};
      this.lighten(o.light == null ? Engine.light : o.light);
      this.clock = null;
      this.endAt = o.endAt == null ? Infinity : o.endAt;   // test hook: schedule nothing at or after this time
      this.layerState = {};
      this.sources = [];     // free-running oscillators and loops, started in begin()
      this.build(dest);
      const ghost = ghostEvents(score, this.anomaly);
      this.streams = [{ ev: events(score), idx: 0, loop: 0, prep: -1, loopStart: 0 }];
      if (ghost.length) this.streams.push({ ev: ghost, idx: 0, loop: 0, prep: -1, loopStart: 0 });
      this.setIntensity(this.intensity, true);
    }

    build(dest) {
      const c = this.c, mix = this.score.mix, spb = this.spb, bpm = this.score.bpm;
      const curves = mix.intensityCurves || null;
      // ---- master chain
      this.out = c.createGain();
      this.out.gain.value = 1;
      this.out.connect(dest);
      const trackGain = V.gain(c, mix.trackGain == null ? 1 : mix.trackGain);
      trackGain.connect(this.out);
      const mixIn = c.createGain();
      let tail = mixIn;
      const m = mix.master;
      if (m.wobble) {
        // Tape wobble: an 8 ms delay whose time is pushed around by a slow LFO.
        const dl = c.createDelay(0.05);
        dl.delayTime.value = 0.008;
        const lfo = c.createOscillator();
        lfo.frequency.value = m.wobble.cycles / this.loopSeconds;
        const lg = V.gain(c, m.wobble.depth_ms / 1000);
        lfo.connect(lg); lg.connect(dl.delayTime);
        this.sources.push(lfo);
        tail.connect(dl); tail = dl;
      }
      const hp = V.biquad(c, 'hp', m.hp, 0.7071);
      tail.connect(hp); tail = hp;
      if (m.lp) { const lp = V.biquad(c, 'lp', m.lp, 0.7071); tail.connect(lp); tail = lp; }
      // out * 0.9, then tanh. The signal is still large here (the track gain that
      // normalises it comes after), so the curve covers a wide range.
      const sat = V.saturator(c, m.sat, 8, 0.9);
      tail.connect(sat.input);
      sat.output.connect(trackGain);
      if (m.hiss) {
        const n = Math.floor(8 * c.sampleRate), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
        const rng = V.mulberry32(0x41554);
        for (let i = 0; i < n; i++) d[i] = V.gaussian(rng);
        V.filterInPlace(d, V.rbj('lp', 6500, 0.7071, c.sampleRate));
        V.filterInPlace(d, V.rbj('hp', 300, 0.7071, c.sampleRate));
        let s = 0; for (let i = 0; i < n; i++) s += d[i] * d[i];
        const k = 1 / Math.sqrt(s / n);
        for (let i = 0; i < n; i++) d[i] *= k;
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = V.gain(c, m.hiss * 0.5);
        src.connect(g); g.connect(trackGain);
        this.sources.push(src);
      }
      if (m.crackle) {
        const n = Math.floor(8 * c.sampleRate), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
        const rng = V.mulberry32(0xC4AC1E);
        const count = Math.floor(8 * 1.5);
        for (let q = 0; q < count; q++) {
          const p = Math.floor(rng() * (n - 200)), L = 20 + Math.floor(rng() * 70), amp = 0.2 + 0.8 * rng();
          for (let i = 0; i < L; i++) d[p + i] += V.gaussian(rng) * Math.exp(-i / (L / 4)) * amp;
        }
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = V.gain(c, m.crackle * 6);
        src.connect(g); g.connect(trackGain);
        this.sources.push(src);
      }
      // ---- reverb and echo
      const conv = V.convolver(c, mix.reverb.seconds, 5, 0.02);
      const revIn = c.createGain();
      revIn.connect(conv);
      const revOut = V.gain(c, mix.reverb.wet * 1.2);
      conv.connect(revOut); revOut.connect(mixIn);
      const D = mix.delay, dlyIn = c.createGain();
      dlyIn.channelCount = 1; dlyIn.channelCountMode = 'explicit';
      const dR = c.createDelay(4), dL = c.createDelay(4);
      dR.delayTime.value = dL.delayTime.value = D.beats * spb;
      const lpR = V.biquad(c, 'lp', D.lp, 0.7071), lpL = V.biquad(c, 'lp', D.lp, 0.7071);
      const fbR = V.gain(c, D.fb), fbL = V.gain(c, D.fb);
      const merge = c.createChannelMerger(2);
      const dlyOut = V.gain(c, D.wet);
      dlyIn.connect(dR);
      dR.connect(merge, 0, 1);
      dR.connect(lpR); lpR.connect(fbR); fbR.connect(dL);
      dL.connect(merge, 0, 0);
      dL.connect(lpL); lpL.connect(fbL); fbL.connect(dR);
      merge.connect(dlyOut);
      dlyOut.connect(mixIn);
      const dlyToRev = V.gain(c, 0.3);
      dlyOut.connect(dlyToRev); dlyToRev.connect(revIn);
      // ---- layers
      const cfg = Object.assign({}, mix.layers);
      if (this.anomaly > 0) cfg.ghost = { gain: 0.5, rev: 0.4, dly: 0 };
      this.layers = {};
      for (const name of Object.keys(cfg)) {
        const L = cfg[name], lg = c.createGain();
        lg.gain.value = L.gain;
        lg.connect(mixIn);
        if (L.rev) { const s = V.gain(c, L.rev); lg.connect(s); s.connect(revIn); }
        if (L.dly) { const s = V.gain(c, L.dly); lg.connect(s); s.connect(dlyIn); }
        const src = name === 'ghost' ? (mix.ghostLayers || [])[0] : name;
        // A centred note is 0.7071 in each ear (the equal-power pan law), same as a panned one.
        const mono = V.gain(c, Math.SQRT1_2);
        mono.connect(lg);
        this.layers[name] = { node: lg, input: lg, mono, pans: {}, gain: L.gain, curve: curves ? (curves[name] || curves[src] || null) : null };
        this.layerState[name] = { target: null, zeroSince: null };
      }
      // ---- the pad layer gets one shared filter that moves slowly, plus chorus
      if (this.layers.pad) {
        const padIn = c.createGain();
        padIn.channelCount = 1; padIn.channelCountMode = 'explicit';
        padIn.gain.value = Math.SQRT1_2;        // the kit mixes the pad bus down from a panned pair
        const f = V.biquad(c, 'lp', mix.pad_filter[0][1], mix.pad_q);
        const lfo = c.createOscillator();
        lfo.frequency.value = mix.pad_lfo_cycles / this.loopSeconds;
        const lg = V.gain(c, 240);
        lfo.connect(lg); lg.connect(f.detune);
        this.sources.push(lfo);
        padIn.connect(f);
        // chorus: two modulated delays, half a cycle apart, 55 percent wet
        const cm = c.createChannelMerger(2), wet = V.gain(c, 0.55), dry = V.gain(c, 0.45);
        const cl = c.createDelay(0.05), cr = c.createDelay(0.05);
        cl.delayTime.value = 0.014; cr.delayTime.value = 0.016;
        const cLfo = c.createOscillator(); cLfo.frequency.value = 0.28;
        const gl = V.gain(c, 0.0032), gr = V.gain(c, -0.0032);
        cLfo.connect(gl); cLfo.connect(gr); gl.connect(cl.delayTime); gr.connect(cr.delayTime);
        this.sources.push(cLfo);
        f.connect(cl); f.connect(cr); f.connect(dry);
        cl.connect(cm, 0, 0); cr.connect(cm, 0, 1);
        cm.connect(wet); wet.connect(this.layers.pad.node); dry.connect(this.layers.pad.node);
        this.layers.pad.input = padIn;
        this.padFilter = f;
      }
      this.bpm = bpm;
    }

    // One loop's worth of pad filter movement: exponential ramps between the
    // (beat, Hz) points, starting at the loop's first beat.
    prepareLoop(loopStart) {
      const f = this.padFilter;
      if (!f) return;
      const pts = this.score.mix.pad_filter, spb = this.spb;
      f.frequency.setValueAtTime(pts[0][1], loopStart + pts[0][0] * spb);
      for (let i = 1; i < pts.length; i++) f.frequency.exponentialRampToValueAtTime(pts[i][1], loopStart + pts[i][0] * spb);
    }

    // intensity: 0..1. immediate skips the easing (used before the track starts).
    setIntensity(x, immediate) {
      x = Math.max(0, Math.min(1, x));
      this.intensity = x;
      const c = this.c, now = c.currentTime;
      for (const name of Object.keys(this.layers)) {
        const L = this.layers[name];
        if (!L.curve) continue;
        const mult = curveAt(L.curve, x), target = L.gain * mult, st = this.layerState[name];
        if (st.target != null && Math.abs(st.target - target) < 0.0005) continue;
        st.target = target;
        if (mult <= 0) { if (st.zeroSince == null) st.zeroSince = immediate ? -1e9 : now; } else st.zeroSince = null;
        const p = L.node.gain;
        if (immediate) { p.cancelScheduledValues(0); p.value = target; }
        else p.setTargetAtTime(target, now, EASE_TC);
      }
    }

    // Line up the clock: beat 0 of the loop lands at `at`, and the slow LFOs
    // (pad filter, tape wobble, chorus) start there too, so their whole-number
    // cycles per loop come back into step at every loop point.
    begin(at) {
      this.startAt = at;
      for (const s of this.streams) { s.loopStart = at; s.prep = -1; }
      for (const n of this.sources) n.start(at);
      if (this.padFilter) this.padFilter.frequency.setValueAtTime(this.score.mix.pad_filter[0][1], at);
    }

    start(at) {
      const c = this.c;
      this.begin(at == null ? c.currentTime + 0.06 : at);
      this.pump(c.currentTime + LOOKAHEAD);
      // A hidden tab runs timers about once a second, so look much further ahead
      // there or the music would drop out.
      this.timer = setInterval(() => {
        this.pump(this.c.currentTime + (typeof document !== 'undefined' && document.hidden ? 1.6 : LOOKAHEAD));
        this.watchLoad();
      }, TICK_MS);
    }

    // Schedule every event that starts before `horizon` (context time).
    pump(horizon) {
      if (this.stopped) return;
      const c = this.c, now = c.currentTime, spb = this.spb, loopSeconds = this.loopSeconds;
      for (let si = 0; si < this.streams.length; si++) {
        const st = this.streams[si], list = st.ev;
        for (let guard = 0; guard < 20000; guard++) {
          if (st.prep !== st.loop) {
            if (st.loopStart >= horizon) break;
            if (si === 0) this.prepareLoop(st.loopStart);
            st.prep = st.loop;
          }
          const e = list[st.idx], when = st.loopStart + e.t * spb;
          if (when >= horizon || when >= this.endAt) break;
          this.fire(e, when, now, st.loop);
          if (++st.idx >= list.length) { st.idx = 0; st.loop++; st.loopStart += loopSeconds; }
        }
      }
    }

    fire(e, when, now, loop) {
      if (when < now - LATE_DROP) return;
      const L = this.layers[e.l];
      if (!L || (this.only && this.only.indexOf(e.l) < 0) || this.dropped[e.l]) return;
      const st = this.layerState[e.l];
      if (st.zeroSince != null && now - st.zeroSince > SKIP_AFTER) return;
      const inst = V.inst[e.i];
      if (!inst) return;
      const c = this.c, t0 = when < now ? now : when;
      let dest = e.l === 'pad' ? L.input : L.mono;
      if (e.p && e.l !== 'pad') {
        // One panner per layer and pan position (to 0.01), shared by every note
        // that sits there: fewer live nodes for the audio thread to run.
        const pk = Math.round(e.p * 100);
        let pan = L.pans[pk];
        if (!pan) { pan = c.createStereoPanner(); pan.pan.value = pk / 100; pan.connect(L.input); L.pans[pk] = pan; }
        dest = pan;
      }
      const seed = V.hash(e.k, loop, this.score.bpm);
      const x = e.x ? Object.assign({ seed }, e.x) : { seed };
      inst(c, dest, t0, e.n == null ? 0 : e.n, e.v, e.d * this.spb, x);
    }

    // Thin the arrangement to `level` (0 = all layers). Notes already playing ring on.
    lighten(level) {
      this.level = Math.max(0, Math.min(LIGHTEN.length, level | 0));
      this.dropped = {};
      for (let i = 0; i < this.level; i++) for (const name of LIGHTEN[i]) this.dropped[name] = true;
    }

    // Called from the scheduler tick. Compares how far the audio clock has moved
    // with how far the wall clock has, over a 10 second window; a clock that
    // keeps falling behind means the audio thread is missing its deadlines.
    watchLoad() {
      if (typeof performance === 'undefined' || (typeof document !== 'undefined' && document.hidden) || this.c.state !== 'running') { this.clock = null; return; }
      const wall = performance.now() / 1000, ctxT = this.c.currentTime;
      if (!this.clock) { this.clock = { wall, ctxT }; return; }
      const dw = wall - this.clock.wall;
      if (dw < DRIFT_WINDOW_S) return;
      const ratio = (ctxT - this.clock.ctxT) / dw;
      this.clock = { wall, ctxT };
      if (ratio < DRIFT_MIN && this.level < LIGHTEN.length) {
        this.lighten(this.level + 1);
        Engine.light = Math.max(Engine.light, this.level);   // later tracks start thinned too
      }
    }

    // Stop scheduling, fade the master out, and let the graph go.
    stop(tc) {
      if (this.stopped) return;
      this.stopped = true;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      tc = tc == null ? 0.3 : tc;
      const c = this.c, now = c.currentTime;
      try {
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(this.out.gain.value, now);
        this.out.gain.setTargetAtTime(0, now, Math.max(0.01, tc));
      } catch (err) { /* context already closed */ }
      const wait = Math.max(0.5, tc * 8) * 1000;
      setTimeout(() => {
        try { this.out.disconnect(); } catch (err) { /* already gone */ }
        for (const n of this.sources) { try { n.stop(); } catch (err) { /* already stopped */ } }
      }, wait);
    }
  }

  const Engine = {
    Track,
    LIGHTEN,
    light: 0,              // 0 = full arrangement; 1..3 = thinned (see LIGHTEN)
    events,
    curveAt,
    ghostEvents,
    LOOKAHEAD,
    scoreFor(key) { return B.AudioData && B.AudioData.scores && B.AudioData.scores[key]; },

    // Start a score on `mixer`'s music input. Returns the track (or null).
    // o: { anomaly, intensity, fadeIn (time constant, seconds), key }
    play(c, dest, key, o) {
      const score = this.scoreFor(key);
      if (!c || !score) return null;
      o = o || {};
      const tr = new Track(c, score, dest, { anomaly: o.anomaly, intensity: o.intensity, key });
      if (o.fadeIn) {
        tr.out.gain.setValueAtTime(0, c.currentTime);
        tr.out.gain.setTargetAtTime(1, c.currentTime, o.fadeIn);
      }
      tr.start();
      return tr;
    },

    // Render one score offline for tests and level checks. Resolves to an
    // AudioBuffer of `seconds` of the track at a constant intensity.
    // The Web Audio graph is exactly the one the game uses.
    renderOffline(key, o) {
      o = o || {};
      const score = this.scoreFor(key);
      const sr = o.sampleRate || 44100, secs = o.seconds || score.loopSeconds;
      const c = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
      const tr = new Track(c, score, c.destination, { anomaly: o.anomaly, intensity: o.intensity, key, only: o.only, endAt: o.oneLoop ? score.loopBeats * 60 / score.bpm : null });
      tr.begin(0);
      // Feed the graph a couple of seconds at a time, the way the real scheduler
      // does. Scheduling the whole loop up front makes the renderer crawl.
      const step = 2;
      tr.pump(step + LOOKAHEAD);
      for (let t = step; t < secs; t += step) {
        c.suspend(t).then(() => { tr.pump(c.currentTime + step + LOOKAHEAD); c.resume(); });
      }
      return c.startRendering();
    }
  };

  B.MusicEngine = Engine;
})(window.BTB);
