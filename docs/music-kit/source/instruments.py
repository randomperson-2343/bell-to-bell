"""
instruments.py - every sound in the Bell to Bell music, built from Web Audio-style parts.
Each function returns a mono float array. `vel` is 0..1. `rng` is a numpy Generator (seeded, so renders are repeatable).
"""
import numpy as np
from synth import (SR, mtof, osc, env, perc_env, filt, filt_var, exp_sweep, noise,
                   saturate, vibrato_curve)


# ------------------------------------------------------------------- BELL (FM)
def bell(m, vel, rng, tc=1.4, bright=1.0, **_):
    """FM bell. Carrier = sine at f. Modulator = sine at 3.5 x f (inharmonic, that is what makes it metal).
    Modulation index starts high and falls fast (the 'strike'), amplitude rings out slowly.
    Web Audio: modGain.gain = index * f * 3.5, connected to carrier.frequency."""
    f = float(mtof(m))
    dur = min(tc * 7.0, 11.0)
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = bright * (1.2 + 4.2 * vel) * np.exp(-t / 0.30) + 0.35
    mod = np.sin(2 * np.pi * f * 3.5 * t)
    car = np.sin(2 * np.pi * f * t + idx * mod)
    # second, quieter FM pair at a 'wrong' ratio gives the tubular-bell shimmer
    idx2 = 1.6 * np.exp(-t / 0.18)
    car2 = np.sin(2 * np.pi * f * 2.76 * t + idx2 * np.sin(2 * np.pi * f * 0.5 * t))
    amp = np.exp(-t / tc)
    amp2 = np.exp(-t / (tc * 0.35))
    y = car * amp + 0.22 * car2 * amp2
    # hammer tick: 4 ms of filtered noise
    k = int(0.004 * SR)
    click = filt(noise(k, rng), "bp", 3200.0, 1.2) * np.linspace(1, 0, k)
    y[:k] += 0.35 * click
    a = 0.002
    y[: int(a * SR)] *= np.linspace(0, 1, int(a * SR))
    y[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return y * (0.35 + 0.65 * vel) * 0.7


# --------------------------------------------------------- ELECTRIC PIANO (FM)
def ep(m, vel, rng, dur=1.0, decay=1.5, dark=0.0, **_):
    """Rhodes-style FM piano. Two FM pairs: a fast 'tine' (ratio 14, dies in ~80 ms) and a warm body (ratio 1).
    `dark` (0..1) pulls the brightness down for the later acts."""
    f = float(mtof(m))
    hold = max(dur, 0.1)
    rel_tc = 0.35
    e = env(hold, 0.003, decay * (1.0 - 0.012 * (m - 60)), 0.0, rel_tc)
    n = len(e)
    t = np.arange(n) / SR
    body_idx = (0.9 + 0.9 * vel) * (1 - 0.5 * dark) * np.exp(-t / 0.9) + 0.25
    body = np.sin(2 * np.pi * f * t + body_idx * np.sin(2 * np.pi * f * t))
    tine_idx = (0.6 + 2.2 * vel) * (1 - 0.7 * dark) * np.exp(-t / 0.07)
    tine = np.sin(2 * np.pi * f * t + tine_idx * np.sin(2 * np.pi * f * 14.0 * t))
    y = (body + 0.22 * (1 - 0.6 * dark) * tine) * e
    y = saturate(y * (0.8 + 0.7 * vel), 1.3) * 0.6
    return y * (0.3 + 0.7 * vel)


# --------------------------------------------------------------------- PAD
def pad_voice(m, vel, rng, dur=4.0, attack=1.3, rel=0.9, **_):
    """Three detuned saws (-11, 0, +11 cents) + a sine one octave down.
    Filtering is done once on the whole pad bus (one shared BiquadFilter with a slow LFO), not per voice."""
    f = float(mtof(m))
    e = env(dur, attack, 1.0, 1.0, rel)
    n = len(e)
    y = np.zeros(n)
    for c in (-11.0, 0.0, 11.0):
        y += osc("sawtooth", f * 2 ** (c / 1200.0), n, phase0=rng.random())
    y = y / 3.0 * 0.55 + 0.5 * osc("sine", f / 2.0, n)
    return y * e * (0.4 + 0.6 * vel)


# -------------------------------------------------------------------- BASS
def sub(m, vel, rng, dur=1.0, **_):
    """Sine + a quiet octave-up triangle, then tanh saturation.
    The saturation and the triangle add overtones so a phone speaker (which cannot play 50 Hz) still hears the note."""
    f = float(mtof(m))
    e = env(dur, 0.008, 0.5, 0.6, 0.12)
    n = len(e)
    y = osc("sine", f, n) + 0.28 * osc("triangle", f * 2, n)
    y = saturate(y * 1.4, 2.0) * e
    return y * (0.4 + 0.6 * vel)


def soft_bass(m, vel, rng, dur=1.0, **_):
    """Feed bass: rounder and quieter. Triangle + sine, no grit."""
    f = float(mtof(m))
    e = env(dur, 0.012, 0.6, 0.5, 0.15)
    n = len(e)
    y = osc("sine", f, n) * 0.8 + 0.35 * osc("triangle", f, n) + 0.12 * osc("sine", f * 2, n)
    return saturate(y, 1.4) * e * (0.4 + 0.6 * vel) * 0.9


# --------------------------------------------------------------------- ARP
def glass_arp(m, vel, rng, dur=0.2, **_):
    """Plucky synth: triangle + narrow square through a lowpass whose cutoff falls fast (a 'pluck').
    Web Audio: lowpass.frequency.setValueAtTime(3600) then setTargetAtTime(700, t, 0.12)."""
    f = float(mtof(m))
    e = env(dur, 0.002, 0.12, 0.0, 0.08)
    n = len(e)
    y = 0.6 * osc("triangle", f, n) + 0.4 * osc("square", f, n, pw=0.35)
    cut = exp_sweep(n, 1500 + 3200 * vel, 650.0, 0.12)
    y = filt_var(y, "lp", cut, q=1.3)
    return y * e * (0.25 + 0.75 * vel)


# -------------------------------------------------------------------- LEAD
def lead(m, vel, rng, dur=1.0, **_):
    """Warm 'signal' lead: saw + square (7 cents apart), lowpass at ~2.4 kHz, vibrato that fades in after 0.25 s."""
    f = float(mtof(m))
    e = env(dur, 0.025, 0.3, 0.85, 0.35)
    n = len(e)
    fv = vibrato_curve(f, n, 5.2, 14.0, delay=0.22, fade=0.4, rng=rng)
    y = 0.6 * osc("sawtooth", fv, n) + 0.5 * osc("square", fv * 2 ** (7 / 1200.0), n, pw=0.5)
    cut = exp_sweep(n, 3600.0, 2100.0, 0.25)
    y = filt_var(y, "lp", cut, q=0.9)
    return y * e * (0.35 + 0.65 * vel) * 0.8


# -------------------------------------------------------------------- DRUMS
def kick(m, vel, rng, deep=1.0, **_):
    """Heartbeat kick: sine whose pitch falls from ~135 Hz to 45 Hz in 40 ms. Soft, round."""
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    fr = 45.0 * deep + 90.0 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.16)
    k = int(0.002 * SR)
    y[:k] += 0.2 * noise(k, rng)
    y[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return saturate(y * 1.3, 1.2) * (0.35 + 0.65 * vel)


def tock(m, vel, rng, **_):
    """Wood-block clock tock: a fast sine blip at 780 Hz plus a burst of band-passed noise."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 780.0 * t) * np.exp(-t / 0.028)
    y += 0.5 * filt(noise(n, rng), "bp", 1500.0, 2.0) * np.exp(-t / 0.012)
    return y * (0.3 + 0.7 * vel) * 0.8


def tick(m, vel, rng, **_):
    """Ticker-tape click: 25 ms of noise through a 5 kHz highpass."""
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    y = filt(noise(n, rng), "hp", 5000.0) * np.exp(-t / 0.006)
    return y * (0.3 + 0.7 * vel)


def clack(m, vel, rng, bright=0.5, **_):
    """Train rail-joint clack: a low thump (95 Hz sine) plus a short band-passed noise, all behind a 3.5 kHz lowpass."""
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    y = 0.9 * np.sin(2 * np.pi * (80.0 + 40 * bright) * t) * np.exp(-t / 0.045)
    y += 0.9 * filt(noise(n, rng), "bp", 1400.0 + 1800 * bright, 1.4) * np.exp(-t / 0.018)
    y = filt(y, "lp", 3500.0)
    return y * (0.3 + 0.7 * vel)


def riser(m, vel, rng, dur=8.0, **_):
    """Noise through a band-pass whose centre sweeps 250 Hz -> 6 kHz while the volume swells. Ends right at the loop point."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n, rng)
    cut = 250.0 * (24.0 ** (t / dur))
    y = filt_var(x, "bp", cut, q=1.1)
    a = (t / dur) ** 2.2
    y = y * a
    y[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return y * 0.9


# -------------------------------------------------------------- FEED EXTRAS
def drone(m, vel, rng, dur=8.0, **_):
    """Two sines a fraction of a Hz apart (they slowly 'beat'), long fade in and out."""
    f = float(mtof(m))
    e = env(dur, 2.5, 3.0, 1.0, 2.0)
    n = len(e)
    y = osc("sine", f, n) + osc("sine", f * 1.0018, n) * 0.9 + 0.25 * osc("sine", f * 2.0, n)
    return y * e * 0.5 * (0.4 + 0.6 * vel)


def tremor(m, vel, rng, dur=3.0, **_):
    """A distant rumble: brown-ish noise through a 170 Hz lowpass, swelling in 3 quick pulses."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.cumsum(noise(n, rng))
    x = x - np.linspace(x[0], x[-1], n)
    x = filt(x, "lp", 170.0)
    x = x / (np.max(np.abs(x)) + 1e-9)
    pulse = np.zeros(n)
    for c in (0.15, 0.95, 1.9):
        pulse += np.exp(-((t - c) / 0.28) ** 2)
    return x * np.clip(pulse, 0, 1) * (0.3 + 0.7 * vel)


def ghost(m, vel, rng, dur=1.0, cents=0.0, **_):
    """The 'anomaly' voice: a thin, slightly out-of-tune double of the melody. Sine + triangle, dulled."""
    f = float(mtof(m)) * 2 ** (cents / 1200.0)
    e = env(dur, 0.02, 0.5, 0.6, 0.4)
    n = len(e)
    y = osc("sine", f, n) + 0.3 * osc("triangle", f, n)
    y = filt(y, "lp", 2400.0)
    return y * e * (0.3 + 0.7 * vel) * 0.7


def hiss(dur, rng):
    """Tape hiss: pink-ish noise (lowpass) at a very low level. One bus, runs the whole loop."""
    n = int(dur * SR)
    y = filt(noise(n, rng), "lp", 6500.0)
    y = filt(y, "hp", 300.0)
    return y


def crackle(dur, rng, rate=1.5):
    """Sparse tiny clicks like a worn tape or dusty speaker. Deterministic from the seed."""
    n = int(dur * SR)
    y = np.zeros(n)
    count = int(dur * rate)
    pos = rng.integers(0, n - 200, count)
    for p in pos:
        L = int(rng.integers(20, 90))
        y[p:p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1.0)
    return y


INSTRUMENTS = {
    "bell": bell, "ep": ep, "pad": pad_voice, "sub": sub, "soft_bass": soft_bass,
    "arp": glass_arp, "lead": lead, "kick": kick, "tock": tock, "tick": tick,
    "clack": clack, "riser": riser, "drone": drone, "tremor": tremor, "ghost": ghost,
}
