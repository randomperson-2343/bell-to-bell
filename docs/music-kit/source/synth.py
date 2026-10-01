"""
synth.py - tiny DSP toolkit for the Bell to Bell music previews.

Design rule: every building block here has a direct Web Audio equivalent, so the
in-game engine can rebuild each sound from OscillatorNode, BiquadFilterNode,
GainNode, DelayNode, ConvolverNode, WaveShaperNode and noise AudioBuffers.
No samples, no audio files.
"""
import numpy as np
from scipy.signal import lfilter, fftconvolve

SR = 44100


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


# ---------------------------------------------------------------- oscillators
def _blep(t, dt):
    y = np.zeros_like(t)
    a = t < dt
    if a.any():
        x = t[a] / dt[a]
        y[a] = x + x - x * x - 1.0
    b = t > 1.0 - dt
    if b.any():
        x = (t[b] - 1.0) / dt[b]
        y[b] = x * x + x + x + 1.0
    return y


def _inc(freq, n):
    f = np.asarray(freq, dtype=float)
    if f.ndim == 0:
        f = np.full(n, float(f))
    return f / SR


def osc(kind, freq, n, pw=0.5, phase0=0.0):
    """kind: sine | triangle | sawtooth | square. freq scalar or per-sample array."""
    inc = _inc(freq, n)
    ph = (np.cumsum(inc) + phase0) % 1.0
    if kind == "sine":
        return np.sin(2 * np.pi * ph)
    if kind == "triangle":
        return 2.0 * np.abs(2.0 * ph - 1.0) - 1.0
    if kind == "sawtooth":
        return 2.0 * ph - 1.0 - _blep(ph, inc)
    if kind == "square":
        y = np.where(ph < pw, 1.0, -1.0)
        y = y + _blep(ph, inc) - _blep((ph - pw) % 1.0, inc)
        return y
    raise ValueError(kind)


def vibrato_curve(f, n, rate, cents, delay=0.0, fade=0.0, rng=None):
    t = np.arange(n) / SR
    depth = cents * np.clip((t - delay) / max(fade, 1e-6), 0.0, 1.0) if fade > 0 else cents
    ph0 = 0.0 if rng is None else rng.random()
    return f * 2.0 ** ((depth * np.sin(2 * np.pi * (rate * t + ph0))) / 1200.0)


# ------------------------------------------------------------------ envelopes
def env(dur, a, d_tc, s, r_tc):
    """Attack (linear), decay to sustain (exponential, time constant d_tc), release (exponential)."""
    n_on = max(int(dur * SR), 2)
    t = np.arange(n_on) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1.0 - s) * np.exp(-(t - a) / max(d_tc, 1e-6)))
    last = e[-1]
    n_rel = int(min(r_tc * 7.0, 12.0) * SR)
    tr = np.arange(n_rel) / SR
    rel = last * np.exp(-tr / max(r_tc, 1e-6))
    # short fade to avoid a click at the very end of the release
    fade = min(int(0.005 * SR), n_rel)
    if fade > 0:
        rel[-fade:] *= np.linspace(1, 0, fade)
    return np.concatenate([e, rel])


def perc_env(length, tc):
    t = np.arange(int(length * SR)) / SR
    e = np.exp(-t / tc)
    e[:int(0.0015 * SR)] *= np.linspace(0, 1, int(0.0015 * SR))
    return e


# -------------------------------------------------------------------- filters
def _rbj(kind, fc, q):
    fc = float(np.clip(fc, 20.0, SR * 0.45))
    w0 = 2 * np.pi * fc / SR
    c, s = np.cos(w0), np.sin(w0)
    al = s / (2.0 * max(q, 1e-3))
    if kind == "lp":
        b = np.array([(1 - c) / 2, 1 - c, (1 - c) / 2])
    elif kind == "hp":
        b = np.array([(1 + c) / 2, -(1 + c), (1 + c) / 2])
    elif kind == "bp":
        b = np.array([al, 0.0, -al])
    else:
        raise ValueError(kind)
    a = np.array([1 + al, -2 * c, 1 - al])
    return b / a[0], a / a[0]


def filt(x, kind, fc, q=0.7071):
    b, a = _rbj(kind, fc, q)
    return lfilter(b, a, x)


def filt_var(x, kind, fc_curve, q=0.7071, block=128):
    """Biquad whose cutoff changes every `block` samples (same idea as an automated Biquad frequency param)."""
    n = len(x)
    fc_curve = np.asarray(fc_curve, dtype=float)
    if fc_curve.ndim == 0:
        return filt(x, kind, float(fc_curve), q)
    if len(fc_curve) < n:
        fc_curve = np.pad(fc_curve, (0, n - len(fc_curve)), mode="edge")
    y = np.empty(n)
    zi = np.zeros(2)
    for i in range(0, n, block):
        j = min(i + block, n)
        b, a = _rbj(kind, fc_curve[i], q)
        y[i:j], zi = lfilter(b, a, x[i:j], zi=zi)
    return y


def exp_sweep(n, f_start, f_end, tc):
    t = np.arange(n) / SR
    return f_end + (f_start - f_end) * np.exp(-t / tc)


# --------------------------------------------------------------------- noise
def noise(n, rng):
    return rng.standard_normal(n)


# -------------------------------------------------------------------- effects
def saturate(x, drive=1.5):
    """WaveShaperNode with a tanh curve."""
    return np.tanh(drive * x) / np.tanh(drive)


def mod_delay(x, base_ms, depth_ms, rate, phase=0.0):
    """DelayNode whose delayTime is driven by an LFO (chorus / tape wobble)."""
    n = len(x)
    t = np.arange(n) / SR
    d = (base_ms + depth_ms * np.sin(2 * np.pi * (rate * t + phase))) * 1e-3 * SR
    idx = np.arange(n) - d
    return np.interp(idx, np.arange(n), x, left=0.0)


def chorus(x, rate=0.3, depth_ms=3.0, base_ms=14.0, mix=0.5):
    """Returns stereo (n,2). Two modulated delays in opposite phase."""
    l = mod_delay(x, base_ms, depth_ms, rate, 0.0)
    r = mod_delay(x, base_ms + 2.0, depth_ms, rate, 0.5)
    dry = x[:, None] * (1 - mix)
    return dry + mix * np.stack([l, r], axis=1)


def pingpong(x_stereo, delay_s, fb=0.42, lp_hz=3200.0):
    """Stereo ping-pong delay (wet only, no dry copy).
    Web Audio layout: input -> delayR -> (out right) ; delayR -> lowpass -> feedback gain -> delayL -> (out left) ;
    delayL -> lowpass -> feedback gain -> delayR. First echo lands on the right after one delay time, next on the left, and so on."""
    n = len(x_stereo)
    D = int(delay_s * SR)
    out = np.zeros_like(x_stereo)
    mono = x_stereo.mean(axis=1)
    b, a = _rbj("lp", lp_hz, 0.7071)
    prev_x = np.zeros(D)
    prev_l = np.zeros(D)
    prev_r = np.zeros(D)
    k = 0
    while k * D < n:
        s0, e0 = k * D, min((k + 1) * D, n)
        m = e0 - s0
        cur_r = prev_x + fb * lfilter(b, a, prev_l)      # right line: last block's input + filtered left echo
        cur_l = fb * lfilter(b, a, prev_r)               # left line: filtered right echo
        out[s0:e0, 0] = cur_l[:m]
        out[s0:e0, 1] = cur_r[:m]
        nx = np.zeros(D)
        nx[:m] = mono[s0:e0]
        prev_x, prev_l, prev_r = nx, cur_l, cur_r
        k += 1
    return out


def make_ir(seconds, rng, predelay=0.02):
    """Synthetic reverb impulse response (what a ConvolverNode buffer would be filled with).
    Three noise bands: lows ring the longest, highs die first. Each band has its own exponential decay."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    chans = []
    for _ in range(2):
        w = rng.standard_normal(n)
        low = filt(w, "lp", 450.0)
        mid = filt(filt(w, "lp", 2400.0), "hp", 450.0)
        high = filt(filt(w, "lp", 7500.0), "hp", 2400.0)
        sig = (low * 1.0 * np.exp(-6.9 * t / seconds)
               + mid * 0.9 * np.exp(-6.9 * t / (seconds * 0.7))
               + high * 0.6 * np.exp(-6.9 * t / (seconds * 0.38)))
        pre = int(predelay * SR)
        sig = np.concatenate([np.zeros(pre), sig])[:n]
        sig[pre:pre + int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
        chans.append(sig / np.sqrt(np.sum(sig ** 2)))
    return np.stack(chans, axis=1)


def reverb(x_stereo, ir):
    n = len(x_stereo)
    out = np.zeros_like(x_stereo)
    for c in range(2):
        # feed both input channels into each IR channel so the image stays wide but centred
        src = x_stereo[:, c]
        out[:, c] = fftconvolve(src, ir[:, c], mode="full")[:n]
    return out


def pan(sig, p):
    """Equal-power pan of a mono array. p in [-1,1]. Returns (n,2)."""
    a = (p + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)


def add_at(buf, sig, start_s, gain=1.0):
    """Mix mono/stereo `sig` into stereo `buf` at start_s (clips at buffer end)."""
    i = int(round(start_s * SR))
    if i >= len(buf):
        return
    j = min(i + len(sig), len(buf))
    if sig.ndim == 1:
        buf[i:j, 0] += sig[: j - i] * gain
        buf[i:j, 1] += sig[: j - i] * gain
    else:
        buf[i:j] += sig[: j - i] * gain
