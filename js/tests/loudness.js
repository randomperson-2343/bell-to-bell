// Loudness and brightness meters for the audio render check.
// Integrated loudness follows ITU-R BS.1770-4 (K-weighting, 400 ms blocks with
// 75 percent overlap, absolute gate at -70 LUFS, relative gate 10 LU below),
// the same measurement as ffmpeg's ebur128 filter.
'use strict';

function kWeight(x, fs) {
  // stage 1: high shelf
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  // stage 2: high pass
  const g0 = 38.13547087602444, Q2 = 0.5003270373238773;
  K = Math.tan(Math.PI * g0 / fs);
  a0 = 1 + K / Q2 + K * K;
  const s2 = { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q2 + K * K) / a0] };
  const run = (inp, f) => {
    const out = new Float64Array(inp.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < inp.length; i++) {
      const x0 = inp[i];
      const y0 = f.b[0] * x0 + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      out[i] = y0;
    }
    return out;
  };
  return run(run(x, s1), s2);
}

// channels: array of Float32Array / Float64Array (L, R). Returns LUFS.
function lufs(channels, fs) {
  const w = channels.map((c) => kWeight(c, fs));
  const n = w[0].length, block = Math.round(0.4 * fs), step = Math.round(0.1 * fs);
  const z = [];
  for (let i = 0; i + block <= n; i += step) {
    let sum = 0;
    for (const ch of w) { let s = 0; for (let j = i; j < i + block; j++) s += ch[j] * ch[j]; sum += s / block; }
    z.push(sum);
  }
  const loud = (m) => -0.691 + 10 * Math.log10(m);
  let keep = z.filter((m) => loud(m) > -70);
  if (!keep.length) return -Infinity;
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const gate = loud(mean(keep)) - 10;
  keep = keep.filter((m) => loud(m) > gate);
  return keep.length ? loud(mean(keep)) : -Infinity;
}

// Average spectral centroid (Hz), the kit's "brightness" (checks.py): 4096-point
// Hann windows every 8192 samples on the mono mix.
function centroid(channels, fs) {
  const n = channels[0].length, mono = new Float64Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  const win = 4096, hop = 2048 * 4, hann = new Float64Array(win);
  for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / win);
  const bins = win / 2 + 1, cs = [];
  const re = new Float64Array(win), im = new Float64Array(win);
  for (let i = 0; i + win < n; i += hop) {
    for (let j = 0; j < win; j++) { re[j] = mono[i + j] * hann[j]; im[j] = 0; }
    fft(re, im);
    let num = 0, den = 0;
    for (let k = 0; k < bins; k++) { const mag = Math.hypot(re[k], im[k]); num += (k * fs / win) * mag; den += mag; }
    if (den > 1e-6) cs.push(num / den);
  }
  return cs.reduce((p, q) => p + q, 0) / cs.length;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function peakDb(channels) {
  let p = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > p) p = a; }
  return 20 * Math.log10(p + 1e-12);
}

// Jump at the loop point compared with the loudest 1 percent of ordinary
// sample steps (under 1.3 means no click).
function seamRatio(channels) {
  const n = channels[0].length, mono = new Float64Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  const steps = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) steps[i] = Math.abs(mono[i + 1] - mono[i]);
  const sorted = Array.from(steps).sort((a, b) => a - b);
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return Math.abs(mono[0] - mono[n - 1]) / (p99 + 1e-12);
}

module.exports = { lufs, centroid, peakDb, seamRatio, kWeight };
