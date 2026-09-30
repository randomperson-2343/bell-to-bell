"""
sfxlib.py - sound effects as DATA.

Every sound effect is a short list of "voices" (JSON). The same JSON is what the game engine plays.
Voice types (each maps straight onto Web Audio nodes):
  tone   OscillatorNode (+ optional FM modulator, glide, lowpass, vibrato, saturation)
  noise  white-noise AudioBuffer -> BiquadFilter (optionally swept) -> GainNode envelope
  inst   one of the music instruments from instruments.py (bell, kick, tock, tick, riser, tremor ...)
Times are in SECONDS (the pack is a score at 60 BPM, so one beat = one second).
"""
import numpy as np
from synth import (SR, mtof, osc, env, filt, filt_var, noise, saturate, pan, add_at, make_ir, reverb,
                   vibrato_curve)
from instruments import INSTRUMENTS


def _curve(n, f0, f1, tc=None, ramp=False, dur=None):
    """Parameter curve over n samples. Two shapes, both exist in Web Audio:
       target: f1 + (f0-f1) * exp(-t/tc)           -> setTargetAtTime
       ramp  : f0 * (f1/f0) ** (t/dur)             -> exponentialRampToValueAtTime"""
    t = np.arange(n) / SR
    if f1 is None or f1 == f0:
        return np.full(n, float(f0))
    if ramp:
        return f0 * (f1 / f0) ** np.clip(t / max(dur, 1e-3), 0, 1)
    return f1 + (f0 - f1) * np.exp(-t / max(tc, 1e-4))


def _freq(v):
    if "f" in v:
        return float(v["f"])
    return float(mtof(v["n"]))


def render_voice(v, rng, n_param=None):
    """Returns stereo (samples, 2) and its start time in seconds."""
    typ = v["type"]
    t0 = float(v.get("t", 0.0))
    p = float(v.get("p", 0.0))
    vel = float(v.get("v", 0.6))
    # n-dependent scaling (the anomaly ghost): the engine applies the same rule at run time
    if "nScale" in v and n_param is not None:
        ns = v["nScale"]
        n = n_param
        t0 += ns.get("delayS", 0.0) * n
        vel = min(1.0, vel * (ns.get("vBase", 1.0) + ns.get("vPer", 0.0) * n))
        v = dict(v)
        v["detune"] = v.get("detune", 0.0) + ns.get("cents", 0.0) * n
        p = float(np.clip(ns.get("pan", p), -1, 1)) if "pan" in ns else p
    if typ == "inst":
        fn = INSTRUMENTS[v["inst"]]
        kw = {k: val for k, val in v.items() if k not in ("type", "t", "inst", "n", "v", "p", "d", "nScale")}
        y = fn(int(v.get("n", 0)), vel, rng, dur=float(v.get("d", 1.0)), **kw)
        return pan(y, p), t0
    d = float(v.get("d", 0.1))
    e = env(d, v.get("a", 0.002), v.get("dtc", 0.06), v.get("s", 0.0), v.get("rtc", 0.04))
    n_s = len(e)
    if typ == "tone":
        f0 = _freq(v)
        if "f_end" in v or "n_end" in v:
            f1 = float(v["f_end"]) if "f_end" in v else float(mtof(v["n_end"]))
        else:
            f1 = None
        f = _curve(n_s, f0, f1, tc=v.get("gtc", 0.05), ramp=v.get("ramp", False), dur=d)
        if v.get("detune"):
            f = f * 2 ** (v["detune"] / 1200.0)
        if "vib" in v:
            vb = v["vib"]
            f = vibrato_curve(f, n_s, vb["rate"], vb["cents"], delay=vb.get("delay", 0.0), fade=vb.get("fade", 0.0))
        ph = np.cumsum(f) / SR
        wave = v.get("wave", "sine")
        if "fm" in v:
            fm = v["fm"]
            t = np.arange(n_s) / SR
            idx = fm["idx"] * np.exp(-t / fm.get("itc", 0.05))
            y = np.sin(2 * np.pi * ph + idx * np.sin(2 * np.pi * fm["ratio"] * ph))
        elif wave == "sine":
            y = np.sin(2 * np.pi * ph)
        elif wave == "triangle":
            y = 2.0 * np.abs(2.0 * (ph % 1.0) - 1.0) - 1.0
        elif wave == "sawtooth":
            inc = np.diff(np.concatenate([[0.0], ph]))
            frac = ph % 1.0
            y = 2.0 * frac - 1.0
            # cheap anti-aliasing: one-pole smoothing relative to pitch
            y = filt(y, "lp", min(SR * 0.42, float(np.mean(f)) * 9.0 + 2000.0), 0.7)
        elif wave == "square":
            frac = ph % 1.0
            y = np.where(frac < 0.5, 1.0, -1.0)
            y = filt(y, "lp", min(SR * 0.42, float(np.mean(f)) * 9.0 + 2000.0), 0.7)
        else:
            raise ValueError(wave)
        if "lp" in v:
            lp = v["lp"]
            cut = _curve(n_s, lp["f0"], lp.get("f1"), tc=lp.get("tc", 0.1), ramp=lp.get("ramp", False), dur=d)
            y = filt_var(y, "lp", cut, q=lp.get("q", 0.7071))
        if v.get("sat"):
            y = saturate(y, v["sat"])
        y = y * e * vel
        return pan(y, p), t0
    if typ == "noise":
        x = noise(n_s, rng)
        kind = v.get("filter", "bp")
        f0 = float(v.get("f0", 1000.0))
        f1 = v.get("f1")
        cut = _curve(n_s, f0, None if f1 is None else float(f1), tc=v.get("stc", 0.1), ramp=v.get("ramp", False), dur=d)
        y = filt_var(x, kind, cut, q=v.get("q", 0.8))
        y = y * e * vel
        return pan(y, p), t0
    raise ValueError(typ)


def render_sfx(spec, rng, n_param=None):
    """Mix all voices of one sound. Returns dry stereo array (no reverb, no normalisation)."""
    parts = [render_voice(v, rng, n_param) for v in spec["voices"]]
    end = max(t0 + len(y) / SR for y, t0 in parts)
    out = np.zeros((int(end * SR) + 64, 2))
    for y, t0 in parts:
        add_at(out, y, t0)
    return out


_ROOM = {}


def room_ir(seconds=1.4):
    if seconds not in _ROOM:
        _ROOM[seconds] = make_ir(seconds, np.random.default_rng(31), predelay=0.012)
    return _ROOM[seconds]


def with_room(dry, send, seconds=1.4):
    """dry + reverb send. The reverb runs long enough to ring out after the dry sound ends."""
    if send <= 0:
        return dry
    pad = int(seconds * SR)
    x = np.concatenate([dry, np.zeros((pad, 2))])
    wet = reverb(x * send, room_ir(seconds)) * 1.2
    n = max(len(x), len(wet))
    out = np.zeros((n, 2))
    out[:len(x)] += x
    out[:len(wet)] += wet[:n]
    return out


def trim_tail(x, thresh_db=-50.0):
    pk = np.abs(x).max() + 1e-12
    idx = np.where(np.abs(x).max(axis=1) > pk * 10 ** (thresh_db / 20))[0]
    if len(idx) == 0:
        return x
    end = min(len(x), idx[-1] + int(0.02 * SR))
    y = x[:end].copy()
    fade = min(int(0.02 * SR), len(y))
    y[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return y
