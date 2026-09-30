// Synthesis building blocks for the new music and sound-effect engines.
//
// Every instrument recipe here is the Web Audio twin of the Python recipe in the
// music kit (instruments.py, sfxlib.py). Nothing is sampled. Noise and reverb
// impulse responses come from a seeded generator, so the same score sounds the
// same every time. (A test keeps unseeded randomness out of the audio code.)
//
// An instrument is a function (ctx, out, t0, midiNote, velocity, seconds, extras)
// that schedules its own nodes into `out` and returns the context time at which
// it has gone silent, so the caller knows when it can be let go.
(function (B) {
  'use strict';
  const V = B.AudioVoices = {};
  const { PI, exp, log10, tanh, sin, cos, sqrt, floor, min, max } = Math;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // Web Audio lowpass/highpass Q is in decibels; the recipes use linear Q.
  const qdb = (q) => 20 * log10(q);
  V.mtof = mtof;
  V.qdb = qdb;

  // ---- seeded randomness ---------------------------------------------------
  V.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Standard normal (unit RMS), like the numpy noise the levels were tuned with.
  V.gaussian = function (rng) {
    let u = 0;
    while (u === 0) u = rng();
    return sqrt(-2 * Math.log(u)) * cos(2 * PI * rng());
  };
  V.hash = function (a, b, c) {
    let h = 2166136261 ^ (a | 0);
    h = Math.imul(h ^ (b | 0), 16777619);
    h = Math.imul(h ^ (c | 0), 16777619);
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  };
  V.hashString = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  // ---- offline filters (for building buffers) ------------------------------
  // RBJ biquad, the same maths as the Python and as a BiquadFilterNode.
  function rbj(kind, fc, q, sr) {
    fc = min(max(fc, 20), sr * 0.45);
    const w0 = 2 * PI * fc / sr, c = cos(w0), s = sin(w0), al = s / (2 * max(q, 1e-3));
    let b;
    if (kind === 'lp') b = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (kind === 'hp') b = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else b = [al, 0, -al];
    const a0 = 1 + al;
    return { b: b.map((x) => x / a0), a: [(-2 * c) / a0, (1 - al) / a0] };
  }
  function filterInPlace(d, f) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const [b0, b1, b2] = f.b, [a1, a2] = f.a;
    for (let i = 0; i < d.length; i++) {
      const x0 = d[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      d[i] = y0;
    }
  }
  V.filterInPlace = filterInPlace;
  V.rbj = rbj;

  // ---- per-context caches --------------------------------------------------
  const CACHE = new WeakMap();
  function cache(c) { let k = CACHE.get(c); if (!k) CACHE.set(c, k = {}); return k; }

  const NOISE_S = 6;
  function noiseBuffer(c) {
    const k = cache(c);
    if (!k.noise) {
      const n = floor(NOISE_S * c.sampleRate), buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0), rng = V.mulberry32(0x5EED01);
      for (let i = 0; i < n; i++) d[i] = V.gaussian(rng);
      k.noise = buf;
    }
    return k.noise;
  }
  // A noise source that starts somewhere inside the shared buffer, chosen from
  // `key`, so different events do not all play the same stretch of noise.
  function noiseSource(c, key, dur) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const room = NOISE_S - dur - 0.1;
    if (room < 0.5) { src.loop = true; return { src, off: (V.hash(key, 7, 1) / 4294967296) * (NOISE_S - 0.5) }; }
    return { src, off: (V.hash(key, 7, 1) / 4294967296) * room };
  }
  V.noiseSource = noiseSource;

  // Brown noise rumble, lowpassed and normalised, with the three Gaussian
  // pulses already baked in (see `tremor` in instruments.py).
  function tremorBuffer(c) {
    const k = cache(c);
    if (!k.tremor) {
      const sr = c.sampleRate, n = floor(3 * sr), buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
      const rng = V.mulberry32(0x7E3302);
      let acc = 0;
      for (let i = 0; i < n; i++) { acc += V.gaussian(rng); d[i] = acc; }
      const first = d[0], last = d[n - 1];
      for (let i = 0; i < n; i++) d[i] -= first + (last - first) * (i / (n - 1));
      filterInPlace(d, rbj('lp', 170, 0.7071, sr));
      let pk = 1e-9;
      for (let i = 0; i < n; i++) pk = max(pk, Math.abs(d[i]));
      let e2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let p = 0;
        for (const ct of [0.15, 0.95, 1.9]) p += exp(-Math.pow((t - ct) / 0.28, 2));
        d[i] = (d[i] / pk) * min(p, 1);
        e2 += d[i] * d[i];
      }
      // The kit's rumble has an RMS of about 0.249 (mean over 60 noise draws;
      // one draw can land 3 dB either side). Pin ours to that.
      const k2 = 0.249 / sqrt(e2 / n);
      for (let i = 0; i < n; i++) d[i] *= k2;
      k.tremor = buf;
    }
    return k.tremor;
  }

  // ---- the kit's reverb, sample for sample ---------------------------------
  // The kit builds its reverb tails from numpy's random stream (PCG64 with the
  // ziggurat normal sampler) at 44.1 kHz. A steady low tone (the Act IV drone,
  // a bass note) sits right on the tail's random low-frequency response, so a
  // different random draw changes how loud it comes out by several dB. To play
  // the approved previews as they sound, this reproduces numpy's exact stream
  // for the two seeds the kit uses. It needs BigInt; without it the seeded
  // fallback generator is used (same character, different draw).
  const NP = {
    5: ['304397142111423816445458517940380168174', '233193750087604940414945475171846202189'],
    31: ['308480732742731926985724723158193190582', '107090353359002252723118071224206516545']
  };
  let ZIG = null;
  function zigTables() {
    if (ZIG) return ZIG;
    const R = 3.6541528853610088, AREA = 0.00492867323399, MASK = 4503599627370496;
    const ki = new Array(256), wi = new Float64Array(256), fi = new Float64Array(256);
    let x1 = R;
    wi[255] = x1 / MASK; fi[255] = exp(-0.5 * x1 * x1);
    ki[0] = Math.trunc(x1 * fi[255] / AREA * MASK);
    wi[0] = AREA / fi[255] / MASK; fi[0] = 1.0;
    for (let i = 254; i > 0; i--) {
      const x = sqrt(-2 * Math.log(AREA / x1 + fi[i + 1]));
      ki[i + 1] = Math.trunc(x / x1 * MASK);
      wi[i] = x / MASK; fi[i] = exp(-0.5 * x * x);
      x1 = x;
    }
    ki[1] = 0;
    return (ZIG = { ki, wi, fi, R });
  }
  // Fill out[from..to) with the next standard normals of numpy's stream for `seed`
  // (identical to np.random.default_rng(seed).standard_normal). `st` carries the
  // generator state between calls, so a long fill can be done in slices.
  function fillNormals(seed, out, from, to, st) {
    const B_ = BigInt, M128 = (B_(1) << B_(128)) - B_(1), M64 = (B_(1) << B_(64)) - B_(1);
    const MULT = B_('0x2360ED051FC65DA44385DF649FCCF645'), b8 = B_(8), b11 = B_(11), b64 = B_(64), b58 = B_(58), b63 = B_(63), b1 = B_(1);
    const inc = B_(NP[seed][1]), m52 = B_('0x000fffffffffffff'), m255 = B_(255);
    let s = st.s == null ? B_(NP[seed][0]) : st.s;
    const { ki, wi, fi, R } = zigTables();
    const u64 = () => {
      s = (s * MULT + inc) & M128;
      const hi = s >> b64, x = hi ^ (s & M64), rot = hi >> b58;
      return ((x >> rot) | (x << ((b64 - rot) & b63))) & M64;
    };
    const dbl = () => Number(u64() >> b11) / 9007199254740992;
    for (let i = from; i < to; i++) {
      for (;;) {
        let r = u64();
        const idx = Number(r & m255);
        r >>= b8;
        const neg = Number(r & b1);
        const rabs = Number((r >> b1) & m52);
        let x = rabs * wi[idx];
        if (neg) x = -x;
        if (rabs < ki[idx]) { out[i] = x; break; }
        if (idx === 0) {
          let done = false;
          for (;;) {
            const xx = -0.27366123732975827203338247596 * Math.log1p(-dbl());
            const yy = -Math.log1p(-dbl());
            if (yy + yy > xx * xx) { out[i] = ((rabs >> 8) & 1) ? -(R + xx) : R + xx; done = true; break; }
          }
          if (done) break;
        } else if ((fi[idx - 1] - fi[idx]) * dbl() + fi[idx] < exp(-0.5 * x * x)) { out[i] = x; break; }
      }
    }
    st.s = s;
  }
  V.numpyNormals = function (seed, count) { const o = new Float64Array(count); fillNormals(seed, o, 0, count, {}); return o; };

  // The two-channel reverb tail: three noise bands, lows ring longest, highs die
  // first (make_ir in synth.py). Built at 44.1 kHz like the kit, then resampled
  // to the context's rate if that differs.
  const IR_SR = 44100, SLICE = 12000;
  // A generator so the work can be done a slice at a time (see V.warm). Each
  // yield is a few milliseconds of work; the return value is the two channels.
  function* irSteps(seconds, seed, predelay) {
    const n = floor(seconds * IR_SR), pre = floor(predelay * IR_SR), exact = typeof BigInt === 'function' && NP[seed];
    const state = {}, rng = exact ? null : V.mulberry32(seed * 7919 + 13);
    const fLow = rbj('lp', 450, 0.7071, IR_SR);
    const fMidA = rbj('lp', 2400, 0.7071, IR_SR), fMidB = rbj('hp', 450, 0.7071, IR_SR);
    const fHiA = rbj('lp', 7500, 0.7071, IR_SR), fHiB = rbj('hp', 2400, 0.7071, IR_SR);
    const chans = [];
    for (let ch = 0; ch < 2; ch++) {
      const w = new Float64Array(n);
      for (let i = 0; i < n; i += SLICE) {
        const to = min(n, i + SLICE);
        if (exact) fillNormals(seed, w, i, to, state); else for (let j = i; j < to; j++) w[j] = V.gaussian(rng);
        yield;
      }
      const low = Float64Array.from(w), mid = Float64Array.from(w), high = Float64Array.from(w);
      filterInPlace(low, fLow); yield;
      filterInPlace(mid, fMidA); filterInPlace(mid, fMidB); yield;
      filterInPlace(high, fHiA); filterInPlace(high, fHiB); yield;
      const d = new Float64Array(n), fade = floor(0.003 * IR_SR);
      let energy = 0;
      for (let i = pre; i < n; i++) {
        const j = i - pre, t = j / IR_SR;
        let v = low[j] * exp(-6.9 * t / seconds) + 0.9 * mid[j] * exp(-6.9 * t / (seconds * 0.7)) + 0.6 * high[j] * exp(-6.9 * t / (seconds * 0.38));
        if (j < fade) v *= j / (fade - 1);
        d[i] = v;
        energy += v * v;
      }
      const norm = 1 / sqrt(energy || 1);
      for (let i = 0; i < n; i++) d[i] *= norm;
      chans.push(d);
      yield;
    }
    return chans;
  }
  function drain(gen) { for (;;) { const r = gen.next(); if (r.done) return r.value; } }
  function buildIR(seconds, seed, predelay) { return drain(irSteps(seconds, seed, predelay)); }

  // The finished tail as an AudioBuffer at the context's rate.
  function toBuffer(c, chans) {
    const sr = c.sampleRate, n = chans[0].length, m = sr === IR_SR ? n : floor(n * sr / IR_SR);
    const buf = c.createBuffer(2, m, sr);
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch), src = chans[ch];
      if (m === n) { for (let i = 0; i < n; i++) out[i] = src[i]; continue; }
      const ratio = IR_SR / sr;
      for (let i = 0; i < m; i++) {
        const pos = i * ratio, i0 = floor(pos), f = pos - i0;
        out[i] = src[i0] * (1 - f) + (i0 + 1 < n ? src[i0 + 1] : 0) * f;
      }
      if (m !== n) {   // resampling changes the sample count: keep unit energy
        let e = 0; for (let i = 0; i < m; i++) e += out[i] * out[i];
        const k2 = 1 / sqrt(e || 1); for (let i = 0; i < m; i++) out[i] *= k2;
      }
    }
    return buf;
  }
  function makeIR(c, seconds, seed, predelay) {
    const key = 'ir:' + seconds + ':' + seed + ':' + predelay, k = cache(c);
    if (k[key]) return k[key];
    // a background build of this one may be part-way: finish it here
    const gen = (k.pending && k.pending[key]) || irSteps(seconds, seed, predelay);
    if (k.pending) delete k.pending[key];
    return (k[key] = toBuffer(c, drain(gen)));
  }
  V.makeIR = makeIR;
  V.buildIR = buildIR;

  // Build reverb tails ahead of the moment they are needed, a few milliseconds
  // at a time between frames, so nothing stalls mid-game. `list` is
  // [[seconds, seed, predelay], ...] in the order they will be wanted.
  V.warm = function (c, list) {
    const k = cache(c);
    k.pending = k.pending || {};
    let i = 0, cur = null;
    const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const pump = () => {
      const t0 = now();
      while (now() - t0 < 6) {
        if (!cur) {
          if (i >= list.length) return;
          const it = list[i++], key = 'ir:' + it[0] + ':' + it[1] + ':' + it[2];
          if (k[key]) continue;
          cur = { key, gen: k.pending[key] = irSteps(it[0], it[1], it[2]) };
        }
        if (k.pending[cur.key] !== cur.gen) { cur = null; continue; }   // finished elsewhere
        let r;
        try { r = cur.gen.next(); } catch (e) { delete k.pending[cur.key]; cur = null; continue; }
        if (r.done) { k[cur.key] = toBuffer(c, r.value); delete k.pending[cur.key]; cur = null; }
      }
      setTimeout(pump, 12);
    };
    setTimeout(pump, 0);
  };

  // A ConvolverNode on an impulse response. normalize must be off: the IR is
  // already scaled to unit energy, which is what the levels were tuned against.
  V.convolver = function (c, seconds, seed, predelay) {
    const conv = c.createConvolver();
    conv.normalize = false;
    conv.buffer = makeIR(c, seconds, seed, predelay);
    return conv;
  };

  // tanh waveshaper. The curve covers [-range, range] so loud signals are
  // shaped the way the Python tanh shapes them instead of being clipped at +/-1.
  // Returns { input, output }: a pre-gain (1 / range) feeding the shaper.
  V.saturator = function (c, drive, range, preGain) {
    const key = 'sat:' + drive + ':' + range, k = cache(c);
    let curve = k[key];
    if (!curve) {
      const size = 4096;
      curve = new Float32Array(size);
      const dn = tanh(drive);
      for (let i = 0; i < size; i++) curve[i] = tanh(drive * ((i / (size - 1) * 2 - 1) * range)) / dn;
      k[key] = curve;
    }
    const pre = c.createGain();
    pre.gain.value = (preGain == null ? 1 : preGain) / range;
    const ws = c.createWaveShaper();
    ws.curve = curve;
    pre.connect(ws);
    return { input: pre, output: ws };
  };

  // Waves in the kit's phase and at its exact amplitude. The built-in oscillator
  // types start in a different phase (which changes what a saturator does to the
  // sum of two waves) and are normalised a little low, so the kit's waves are
  // built as PeriodicWaves with normalisation off.
  //   triangle: peak at phase 0 (the kit's 2|2ph-1|-1)
  //   sawtooth: rising from -1 (2ph-1)
  //   square / pulse: +1 for the first `width` of the cycle, no DC term
  const HARM = 200;
  function periodicWave(c, key, build) {
    const k = cache(c);
    if (!k[key]) {
      const re = new Float32Array(HARM + 1), im = new Float32Array(HARM + 1);
      build(re, im);
      k[key] = c.createPeriodicWave(re, im, { disableNormalization: true });
    }
    return k[key];
  }
  function pulseWave(c, width) {
    return periodicWave(c, 'pulse:' + width, (re, im) => {
      for (let n = 1; n <= HARM; n++) {
        re[n] = (2 / (n * PI)) * sin(2 * PI * n * width);
        im[n] = (2 / (n * PI)) * (1 - cos(2 * PI * n * width));
      }
    });
  }
  // Frequency-modulating a carrier with A*cos(w t) is the same as phase-modulating
  // it with (A/w)*sin(w t), which is what the kit's Python does. A sine modulator
  // would add a quarter-cycle shift and change the tone (and its loudness) when
  // the two frequencies are in a whole-number ratio. So modulators are cosines.
  function cosineWave(c) {
    return periodicWave(c, 'cos', (re) => { re[1] = 1; });
  }
  function shapeWave(c, type) {
    if (type === 'triangle') return periodicWave(c, 'tri', (re) => { for (let n = 1; n <= HARM; n += 2) re[n] = 8 / (PI * PI * n * n); });
    if (type === 'sawtooth') return periodicWave(c, 'saw', (re, im) => { for (let n = 1; n <= HARM; n++) im[n] = -2 / (PI * n); });
    return pulseWave(c, 0.5);
  }
  // The same waves with a fixed gain baked in. A voice that would have had an
  // oscillator -> gain pair gets one oscillator instead, which is the whole point:
  // the audio thread pays for every live node, so fewer nodes means less CPU.
  // type: sine | triangle | sawtooth | square | pulse35. amp multiplies the wave.
  function ampWave(c, type, amp) {
    return periodicWave(c, 'amp:' + type + ':' + amp.toFixed(5), (re, im) => {
      if (type === 'sine') { im[1] = amp; return; }
      if (type === 'triangle') { for (let n = 1; n <= HARM; n += 2) re[n] = amp * 8 / (PI * PI * n * n); return; }
      if (type === 'sawtooth') { for (let n = 1; n <= HARM; n++) im[n] = -amp * 2 / (PI * n); return; }
      const w = type === 'pulse35' ? 0.35 : 0.5;
      for (let n = 1; n <= HARM; n++) {
        re[n] = amp * (2 / (n * PI)) * sin(2 * PI * n * w);
        im[n] = amp * (2 / (n * PI)) * (1 - cos(2 * PI * n * w));
      }
    });
  }
  // An oscillator playing one of those waves, start to stop.
  function wOsc(c, type, amp, f, t0, t1, detune) {
    const o = c.createOscillator();
    o.setPeriodicWave(ampWave(c, type, amp));
    o.frequency.setValueAtTime(f, t0);
    if (detune) o.detune.value = detune;
    o.start(t0);
    o.stop(t1);
    return o;
  }
  // A tanh shaper over [-range, range]; the signal into it is scaled by the
  // caller (its amplitudes already include 1/range), so there is no pre-gain node.
  function shaper(c, drive, range) {
    const key = 'sat:' + drive + ':' + range, k = cache(c);
    let curve = k[key];
    if (!curve) {
      const size = 4096;
      curve = new Float32Array(size);
      const dn = tanh(drive);
      for (let i = 0; i < size; i++) curve[i] = tanh(drive * ((i / (size - 1) * 2 - 1) * range)) / dn;
      k[key] = curve;
    }
    const ws = c.createWaveShaper();
    ws.curve = curve;
    return ws;
  }

  // ---- envelopes -----------------------------------------------------------
  // Attack (linear), decay toward sustain `s` (exponential, time constant dtc),
  // hold for `dur`, release (exponential, time constant rtc). Computed
  // analytically so nothing depends on cancelAndHoldAtTime. Returns the time
  // at which the release has finished.
  // How long the release needs: until the voice is 48 dB below its own peak,
  // never more than 7 time constants (-61 dB) or 12 s. A note that had already
  // decayed by the time it ended needs almost none. Ending a voice sooner means
  // fewer live nodes for the audio thread, and the cut is far below hearing.
  function relTime(o) {
    const a = o.a == null ? 0.002 : o.a, dtc = o.dtc == null ? 0.06 : o.dtc, s = o.s == null ? 0 : o.s;
    const rtc = o.rtc == null ? 0.04 : o.rtc, dur = max(o.dur, 0.002);
    const vEnd = a > 0 && dur <= a ? dur / a : s + (1 - s) * exp(-(dur - a) / max(dtc, 1e-4));
    return min(max(rtc * Math.log(max(vEnd, 1e-9) / 0.004), 0.03), rtc * 7, 12);
  }
  V.tail = function (o) { return max(o.dur, 0.002) + relTime(o); };
  function adsr(param, t0, o) {
    const peak = o.peak == null ? 1 : o.peak, a = o.a == null ? 0.002 : o.a;
    const dtc = o.dtc == null ? 0.06 : o.dtc, s = o.s == null ? 0 : o.s, rtc = o.rtc == null ? 0.04 : o.rtc;
    const dur = max(o.dur, 0.002), tEnd = t0 + dur;
    param.setValueAtTime(0, t0);
    let vEnd;
    if (a > 0 && dur <= a) {
      vEnd = peak * dur / a;
      param.linearRampToValueAtTime(vEnd, tEnd);
    } else {
      if (a > 0) param.linearRampToValueAtTime(peak, t0 + a); else param.setValueAtTime(peak, t0);
      if (s !== 1) param.setTargetAtTime(peak * s, t0 + a, max(dtc, 1e-4));
      vEnd = peak * (s + (1 - s) * exp(-(dur - a) / max(dtc, 1e-4)));
    }
    param.setValueAtTime(vEnd, tEnd);
    param.setTargetAtTime(0, tEnd, max(rtc, 1e-4));
    const rel = relTime(o), fade = min(0.005, rel);
    param.setValueAtTime(vEnd * exp(-(rel - fade) / rtc), tEnd + rel - fade);
    param.linearRampToValueAtTime(0, tEnd + rel);
    return tEnd + rel;
  }
  V.adsr = adsr;

  // ---- node helpers --------------------------------------------------------
  function osc(c, type, f, t0, t1, detune) {
    const o = c.createOscillator();
    if (type === 'sine') o.type = 'sine'; else o.setPeriodicWave(shapeWave(c, type));
    o.frequency.setValueAtTime(f, t0);
    if (detune) o.detune.value = detune;
    o.start(t0);
    o.stop(t1);
    return o;
  }
  function gain(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
  function biquad(c, type, f, qLin, isBandpass) {
    const b = c.createBiquadFilter();
    b.type = type === 'lp' ? 'lowpass' : type === 'hp' ? 'highpass' : 'bandpass';
    b.frequency.value = f;
    b.Q.value = isBandpass || type === 'bp' ? qLin : qdb(qLin);
    // A swept cutoff recomputes the filter every sample unless it is k-rate (once
    // per 128 samples). The sweeps here are slow, so nothing is heard and the
    // cost drops a lot. Browsers without automationRate ignore this.
    try { b.frequency.automationRate = 'k-rate'; } catch (e) { /* older browser */ }
    return b;
  }
  function modOsc(c, f, t0, t1) {
    const o = c.createOscillator();
    o.setPeriodicWave(cosineWave(c));
    o.frequency.setValueAtTime(f, t0);
    o.start(t0);
    o.stop(t1);
    return o;
  }
  V.osc = osc; V.gain = gain; V.biquad = biquad;

  // Short noise burst through a filter with an exponential fall.
  function noiseBurst(c, out, t0, dur, key, filt, f, q, tc, level) {
    const { src, off } = noiseSource(c, key, dur);
    const fl = biquad(c, filt, f, q);
    const g = c.createGain();
    g.gain.setValueAtTime(level, t0);
    g.gain.setTargetAtTime(0, t0, tc);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t0, off, dur + 0.01);
    return t0 + dur;
  }

  // ---- instruments ---------------------------------------------------------
  const I = V.inst = {};

  I.bell = function (c, out, t0, m, vel, dur, x) {
    const f = mtof(m), tc = x.tc || 1.4, bright = x.bright == null ? 1 : x.bright;
    // The kit lets a bell ring for 7 time constants (down to -61 dB); 6 is -52 dB
    // under a 50 ms fade, and the quiet second pair is gone well before that.
    const len = min(tc * 6, 11), t1 = t0 + len, len2 = min(len, tc * 2);
    const level = (0.35 + 0.65 * vel) * 0.7, g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.002);
    g.gain.setValueAtTime(level, t1 - 0.05);
    g.gain.linearRampToValueAtTime(0, t1);
    g.connect(out);
    // Pair 1: carrier f, modulator 3.5f. The index starts high and falls: the strike.
    const car = osc(c, 'sine', f, t0, t1), mod = modOsc(c, 3.5 * f, t0, t1);
    const mg = c.createGain();
    mg.gain.setValueAtTime(3.5 * f * (bright * (1.2 + 4.2 * vel) + 0.35), t0);
    mg.gain.setTargetAtTime(3.5 * f * 0.35, t0, 0.30);
    mod.connect(mg); mg.connect(car.frequency);
    const a1 = c.createGain();
    a1.gain.setValueAtTime(1, t0); a1.gain.setTargetAtTime(0, t0, tc);
    car.connect(a1); a1.connect(g);
    // Pair 2: a quieter pair at a wrong ratio for the tubular shimmer.
    const car2 = osc(c, 'sine', 2.76 * f, t0, t0 + len2), mod2 = modOsc(c, 0.5 * f, t0, t0 + len2);
    const mg2 = c.createGain();
    mg2.gain.setValueAtTime(0.5 * f * 1.6, t0);
    mg2.gain.setTargetAtTime(0, t0, 0.18);
    mod2.connect(mg2); mg2.connect(car2.frequency);
    const a2 = c.createGain();
    a2.gain.setValueAtTime(0.22, t0); a2.gain.setTargetAtTime(0, t0, 0.35 * tc);
    car2.connect(a2); a2.connect(g);
    // Hammer tick: 4 ms of noise.
    const { src, off } = noiseSource(c, x.seed | 0, 0.004);
    const bp = biquad(c, 'bp', 3200, 1.2), tg = c.createGain();
    tg.gain.setValueAtTime(0.35, t0); tg.gain.linearRampToValueAtTime(0, t0 + 0.004);
    src.connect(bp); bp.connect(tg); tg.connect(g);
    src.start(t0, off, 0.005);
    return t1;
  };

  I.ep = function (c, out, t0, m, vel, dur, x) {
    const f = mtof(m), decay = x.decay == null ? 1.5 : x.decay, dark = x.dark || 0;
    const hold = max(dur, 0.1), rtc = 0.35, tc = decay * (1 - 0.012 * (m - 60));
    const eo = { peak: (0.8 + 0.7 * vel) / 2.5, a: 0.003, dtc: tc, s: 0, dur: hold, rtc }, t1 = t0 + V.tail(eo);
    // Body: ratio 1.
    const body = osc(c, 'sine', f, t0, t1), bm = modOsc(c, f, t0, t1), bg = c.createGain();
    const bi0 = (0.9 + 0.9 * vel) * (1 - 0.5 * dark) + 0.25;
    bg.gain.setValueAtTime(bi0 * f, t0); bg.gain.setTargetAtTime(0.25 * f, t0, 0.9);
    bm.connect(bg); bg.connect(body.frequency);
    // Tine: ratio 14, gone in about 80 ms. Its mix level is baked into the wave.
    // the tine's modulator is spent after 0.6 s (its index fell by e^-8.6), so it stops then
    const tine = wOsc(c, 'sine', 0.22 * (1 - 0.6 * dark), f, t0, t1), tm = modOsc(c, 14 * f, t0, min(t1, t0 + 0.6)), tg = c.createGain();
    tg.gain.setValueAtTime((0.6 + 2.2 * vel) * (1 - 0.7 * dark) * 14 * f, t0); tg.gain.setTargetAtTime(0, t0, 0.07);
    tm.connect(tg); tg.connect(tine.frequency);
    // envelope (with gain 0.8 + 0.7 vel folded in, over the shaper's range) -> tanh(1.3 x) -> 0.6 x (0.3 + 0.7 vel)
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    body.connect(env); tine.connect(env);
    const ws = shaper(c, 1.3, 2.5);
    env.connect(ws);
    const post = gain(c, 0.6 * (0.3 + 0.7 * vel));
    ws.connect(post); post.connect(out);
    return t1;
  };

  // One voice of the pad. The shared filter and chorus live on the layer.
  I.pad = function (c, out, t0, m, vel, dur, x) {
    const f = mtof(m), attack = x.attack == null ? 1.3 : x.attack, rel = x.rel == null ? 0.9 : x.rel;
    const eo = { peak: 0.4 + 0.6 * vel, a: attack, s: 1, dur, rtc: rel }, t1 = t0 + V.tail(eo);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    env.connect(out);
    for (const cents of [-11, 0, 11]) wOsc(c, 'sawtooth', 0.55 / 3, f, t0, t1, cents).connect(env);
    wOsc(c, 'sine', 0.5, f / 2, t0, t1).connect(env);
    return t1;
  };

  I.sub = function (c, out, t0, m, vel, dur) {
    const f = mtof(m), rtc = 0.12, eo = { peak: 0.4 + 0.6 * vel, a: 0.008, dtc: 0.5, s: 0.6, dur, rtc }, t1 = t0 + V.tail(eo);
    // Saturate first, then shape with the envelope (as the Python does). The
    // 1.4 pre-gain over the shaper's range of 2 is baked into the two waves.
    const ws = shaper(c, 2.0, 2);
    wOsc(c, 'sine', 1.4 / 2, f, t0, t1).connect(ws);
    wOsc(c, 'triangle', 0.28 * 1.4 / 2, 2 * f, t0, t1).connect(ws);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    ws.connect(env); env.connect(out);
    return t1;
  };

  I.soft_bass = function (c, out, t0, m, vel, dur) {
    const f = mtof(m), rtc = 0.15, eo = { peak: (0.4 + 0.6 * vel) * 0.9, a: 0.012, dtc: 0.6, s: 0.5, dur, rtc }, t1 = t0 + V.tail(eo);
    const ws = shaper(c, 1.4, 2);
    wOsc(c, 'sine', 0.8 / 2, f, t0, t1).connect(ws);
    wOsc(c, 'triangle', 0.35 / 2, f, t0, t1).connect(ws);
    wOsc(c, 'sine', 0.12 / 2, 2 * f, t0, t1).connect(ws);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    ws.connect(env); env.connect(out);
    return t1;
  };

  I.arp = function (c, out, t0, m, vel, dur) {
    const f = mtof(m), rtc = 0.08, eo = { peak: 0.25 + 0.75 * vel, a: 0.002, dtc: 0.12, s: 0, dur, rtc }, t1 = t0 + V.tail(eo);
    const lp = biquad(c, 'lp', 1500 + 3200 * vel, 1.3);
    lp.frequency.setValueAtTime(1500 + 3200 * vel, t0);
    lp.frequency.setTargetAtTime(650, t0, 0.12);
    wOsc(c, 'triangle', 0.6, f, t0, t1).connect(lp);
    wOsc(c, 'pulse35', 0.4, f, t0, t1).connect(lp);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    lp.connect(env); env.connect(out);
    return t1;
  };

  I.lead = function (c, out, t0, m, vel, dur) {
    const f = mtof(m), rtc = 0.35, eo = { peak: (0.35 + 0.65 * vel) * 0.8, a: 0.025, dtc: 0.3, s: 0.85, dur, rtc }, t1 = t0 + V.tail(eo);
    const saw = wOsc(c, 'sawtooth', 0.6, f, t0, t1), sq = wOsc(c, 'square', 0.5, f, t0, t1, 7);
    // Vibrato: silent for 0.22 s, then fades up to 14 cents.
    const lfo = osc(c, 'sine', 5.2, t0, t1), depth = c.createGain();
    depth.gain.setValueAtTime(0, t0); depth.gain.setValueAtTime(0, t0 + 0.22); depth.gain.linearRampToValueAtTime(14, t0 + 0.62);
    lfo.connect(depth); depth.connect(saw.detune); depth.connect(sq.detune);
    const lp = biquad(c, 'lp', 3600, 0.9);
    lp.frequency.setValueAtTime(3600, t0); lp.frequency.setTargetAtTime(2100, t0, 0.25);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    saw.connect(lp); sq.connect(lp); lp.connect(env); env.connect(out);
    return t1;
  };

  I.kick = function (c, out, t0, m, vel, dur, x) {
    const deep = x.deep == null ? 1 : x.deep, t1 = t0 + 0.55, pre = 1.3 / 3;   // 1.3 pre-gain over the shaper's range of 3
    const o = c.createOscillator();
    o.frequency.setValueAtTime(45 * deep + 90, t0);
    o.frequency.setTargetAtTime(45 * deep, t0, 0.035);
    o.start(t0); o.stop(t1);
    const ws = shaper(c, 1.2, 3);
    const ag = c.createGain();
    ag.gain.setValueAtTime(pre, t0); ag.gain.setTargetAtTime(0, t0, 0.16);
    o.connect(ag); ag.connect(ws);
    const { src, off } = noiseSource(c, x.seed | 0, 0.002);
    const ck = gain(c, 0.2 * pre);
    src.connect(ck); ck.connect(ws); src.start(t0, off, 0.002);
    const lv = c.createGain(), level = 0.35 + 0.65 * vel;
    lv.gain.setValueAtTime(level, t0); lv.gain.setValueAtTime(level, t1 - 0.02); lv.gain.linearRampToValueAtTime(0, t1);
    ws.connect(lv); lv.connect(out);
    return t1;
  };

  I.tock = function (c, out, t0, m, vel, dur, x) {
    const t1 = t0 + 0.12, level = (0.3 + 0.7 * vel) * 0.8;
    const o = osc(c, 'sine', 780, t0, t1), og = c.createGain();
    og.gain.setValueAtTime(level, t0); og.gain.setTargetAtTime(0, t0, 0.028);
    o.connect(og); og.connect(out);
    noiseBurst(c, out, t0, 0.12, x.seed | 0, 'bp', 1500, 2, 0.012, 0.5 * level);
    return t1;
  };

  I.tick = function (c, out, t0, m, vel, dur, x) {
    noiseBurst(c, out, t0, 0.03, x.seed | 0, 'hp', 5000, 0.7071, 0.006, 0.3 + 0.7 * vel);
    return t0 + 0.03;
  };

  I.clack = function (c, out, t0, m, vel, dur, x) {
    const bright = x.bright == null ? 0.5 : x.bright, t1 = t0 + 0.16, lvl = 0.3 + 0.7 * vel;
    const lp = biquad(c, 'lp', 3500, 0.7071);
    const o = osc(c, 'sine', 80 + 40 * bright, t0, t1), og = c.createGain();
    og.gain.setValueAtTime(0.9 * lvl, t0); og.gain.setTargetAtTime(0, t0, 0.045);
    o.connect(og); og.connect(lp);
    noiseBurst(c, lp, t0, 0.16, x.seed | 0, 'bp', 1400 + 1800 * bright, 1.4, 0.018, 0.9 * lvl);
    lp.connect(out);
    return t1;
  };

  I.riser = function (c, out, t0, m, vel, dur, x) {
    const len = max(dur, 0.5), t1 = t0 + len;
    const { src, off } = noiseSource(c, x.seed | 0, len);
    const bp = biquad(c, 'bp', 250, 1.1);
    bp.frequency.setValueAtTime(250, t0);
    bp.frequency.exponentialRampToValueAtTime(6000, t1);
    const g = c.createGain();
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = 0.9 * Math.pow(i / (n - 1), 2.2);
    g.gain.setValueAtTime(0, t0);
    g.gain.setValueCurveAtTime(curve, t0, len - 0.02);
    g.gain.setValueAtTime(0, t1);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t0, off, len + 0.01);
    return t1;
  };

  I.drone = function (c, out, t0, m, vel, dur) {
    const f = mtof(m), rtc = 2.0, eo = { peak: 0.5 * (0.4 + 0.6 * vel), a: 2.5, s: 1, dur, rtc }, t1 = t0 + V.tail(eo);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    osc(c, 'sine', f, t0, t1).connect(env);
    wOsc(c, 'sine', 0.9, f * 1.0018, t0, t1).connect(env);
    wOsc(c, 'sine', 0.25, 2 * f, t0, t1).connect(env);
    env.connect(out);
    return t1;
  };

  I.tremor = function (c, out, t0, m, vel, dur) {
    const src = c.createBufferSource();
    src.buffer = tremorBuffer(c);
    const g = gain(c, 0.3 + 0.7 * vel);
    src.connect(g); g.connect(out);
    src.start(t0);
    return t0 + 3;
  };

  I.ghost = function (c, out, t0, m, vel, dur, x) {
    const f = mtof(m) * Math.pow(2, (x.cents || 0) / 1200), rtc = 0.4, eo = { peak: (0.3 + 0.7 * vel) * 0.7, a: 0.02, dtc: 0.5, s: 0.6, dur, rtc }, t1 = t0 + V.tail(eo);
    const lp = biquad(c, 'lp', 2400, 0.7071);
    osc(c, 'sine', f, t0, t1).connect(lp);
    wOsc(c, 'triangle', 0.3, f, t0, t1).connect(lp);
    const env = c.createGain();
    adsr(env.gain, t0, eo);
    lp.connect(env); env.connect(out);
    return t1;
  };

  // ---- sound-effect voices (sfx_pack.json) ---------------------------------
  // Returns the context time at which the voice is silent.
  V.sfxVoice = function (c, out, t0, v, seed, n) {
    const p = v.p || 0;
    let vel = v.v == null ? 0.6 : v.v, start = t0 + (v.t || 0), detune = v.detune || 0;
    if (v.nScale && n != null) {
      const ns = v.nScale;
      start += (ns.delayS || 0) * n;
      vel = min(1, vel * ((ns.vBase == null ? 1 : ns.vBase) + (ns.vPer || 0) * n));
      detune += (ns.cents || 0) * n;
    }
    // Always through a panner: a centred voice is 0.7071 in each ear (equal-power pan law), as in the kit.
    const pan = c.createStereoPanner();
    pan.pan.value = max(-1, min(1, p));
    pan.connect(out);
    const dest = pan;
    if (v.type === 'inst') {
      const x = {};
      for (const k of Object.keys(v)) if (!['type', 't', 'inst', 'n', 'v', 'p', 'd', 'nScale'].includes(k)) x[k] = v[k];
      x.seed = seed;
      return I[v.inst](c, dest, start, v.n == null ? 0 : v.n, vel, v.d == null ? 1 : v.d, x);
    }
    const d = v.d == null ? 0.1 : v.d;
    const env = c.createGain();
    const rtc = v.rtc == null ? 0.04 : v.rtc;
    const tEnd = adsr(env.gain, start, { peak: vel, a: v.a, dtc: v.dtc, s: v.s, dur: d, rtc });
    if (v.type === 'tone') {
      const f0 = v.f != null ? v.f : mtof(v.n);
      const f1 = v.f_end != null ? v.f_end : v.n_end != null ? mtof(v.n_end) : null;
      const o = c.createOscillator();
      const wave = v.wave || 'sine';
      // The kit's FM voice always has a sine carrier, whatever `wave` says.
      if (wave === 'sine' || v.fm) o.type = 'sine'; else o.setPeriodicWave(shapeWave(c, wave));
      const glide = (param, from, to, tc) => {
        param.setValueAtTime(from, start);
        if (to == null || to === from) return;
        if (v.ramp) param.exponentialRampToValueAtTime(to, start + d);
        else param.setTargetAtTime(to, start, tc);
      };
      glide(o.frequency, f0, f1, v.gtc == null ? 0.05 : v.gtc);
      if (detune) o.detune.value = detune;
      o.start(start); o.stop(tEnd);
      if (v.vib) {
        const lfo = osc(c, 'sine', v.vib.rate, start, tEnd), lg = gain(c, v.vib.cents);
        lfo.connect(lg); lg.connect(o.detune);
      }
      let node = o;
      if (v.fm) {
        // Phase modulation in the Python = frequency modulation here, with the
        // depth following the carrier's pitch (index x ratio x f(t)).
        const fm = v.fm, mo = c.createOscillator();
        mo.setPeriodicWave(cosineWave(c));
        glide(mo.frequency, f0 * fm.ratio, f1 == null ? null : f1 * fm.ratio, v.gtc == null ? 0.05 : v.gtc);
        mo.start(start); mo.stop(tEnd);
        const gi = c.createGain();
        gi.gain.setValueAtTime(fm.idx * fm.ratio, start);
        gi.gain.setTargetAtTime(0, start, fm.itc == null ? 0.05 : fm.itc);
        const gf = c.createGain();
        glide(gf.gain, f0, f1, v.gtc == null ? 0.05 : v.gtc);
        mo.connect(gi); gi.connect(gf); gf.connect(o.frequency);
      }
      if (v.lp) {
        const lp = biquad(c, 'lp', v.lp.f0, v.lp.q == null ? 0.7071 : v.lp.q);
        lp.frequency.setValueAtTime(v.lp.f0, start);
        if (v.lp.f1 != null && v.lp.f1 !== v.lp.f0) {
          if (v.lp.ramp) lp.frequency.exponentialRampToValueAtTime(v.lp.f1, start + d);
          else lp.frequency.setTargetAtTime(v.lp.f1, start, v.lp.tc == null ? 0.1 : v.lp.tc);
        }
        node.connect(lp); node = lp;
      }
      if (v.sat) {
        const s = V.saturator(c, v.sat, 1.5, 1);
        node.connect(s.input); node = s.output;
      }
      node.connect(env); env.connect(dest);
      return tEnd;
    }
    if (v.type === 'noise') {
      const total = tEnd - start;
      const { src, off } = noiseSource(c, seed, total);
      const kind = v.filter || 'bp';
      const fl = biquad(c, kind, v.f0 == null ? 1000 : v.f0, v.q == null ? 0.8 : v.q);
      fl.frequency.setValueAtTime(v.f0 == null ? 1000 : v.f0, start);
      if (v.f1 != null && v.f1 !== v.f0) {
        if (v.ramp) fl.frequency.exponentialRampToValueAtTime(v.f1, start + d);
        else fl.frequency.setTargetAtTime(v.f1, start, v.stc == null ? 0.1 : v.stc);
      }
      src.connect(fl); fl.connect(env); env.connect(dest);
      src.start(start, off, total + 0.01);
      return tEnd;
    }
    throw new Error('unknown voice type ' + v.type);
  };
})(window.BTB);
