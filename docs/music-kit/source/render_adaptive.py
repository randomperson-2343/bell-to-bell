"""
render_adaptive.py - renders adaptive (intensity-driven) tracks the way the game engine will play them.

Signal order per layer (same as the Web Audio plan):
    voices -> layer bus -> x intensity curve gain (GainNode, eased) -> split: dry / reverb send / echo send
    sends -> shared reverb + ping-pong echo -> master (highpass, lowpass, tanh) -> track gain
"""
import wave
import numpy as np
from synth import (SR, filt, filt_var, mod_delay, chorus, pingpong, make_ir, reverb, pan, add_at, saturate)
from instruments import INSTRUMENTS
from render import periodic_curve, TAIL_S


def layer_buses(piece, seed=99, extra_events=None, layers_cfg=None):
    """Render each layer's dry bus for ONE loop (length L + tail). Pad layer gets its shared filter and chorus."""
    spb = 60.0 / piece.bpm
    L = int(round(piece.loop_seconds * SR))
    N = L + int(TAIL_S * SR)
    rng = np.random.default_rng(seed)
    events = list(piece.events) + list(extra_events or [])
    cfg = layers_cfg or piece.mix["layers"]
    buses = {k: np.zeros((N, 2)) for k in cfg}
    for e in events:
        fn = INSTRUMENTS[e["i"]]
        kw = {k: v for k, v in e.items() if k not in ("t", "d", "n", "v", "i", "l", "p")}
        y = fn(e["n"] if e["n"] is not None else 0, e["v"], rng, dur=e["d"] * spb, **kw)
        add_at(buses[e["l"]], pan(y, e["p"]), e["t"] * spb)
    if "pad" in buses:
        mono = buses["pad"].mean(axis=1)
        cut = periodic_curve(piece.mix["pad_filter"], piece.loop_beats, piece.bpm, N, piece.mix["pad_lfo_cycles"])
        mono = filt_var(mono, "lp", cut, q=piece.mix["pad_q"])
        buses["pad"] = chorus(mono, rate=0.28, depth_ms=3.2, base_ms=14.0, mix=0.55)
    return {k: v.astype(np.float32) for k, v in buses.items()}, L


def ghost_events(piece, n):
    """The anomaly ghost: same rule as the feed. Applies to every event on piece.mix['ghostLayers']."""
    spb = 60.0 / piece.bpm
    out = []
    for e in piece.events:
        if e["l"] in piece.mix.get("ghostLayers", []) and e["n"] is not None:
            g = dict(e)
            g["l"], g["i"] = "ghost", "ghost"
            g["t"] = e["t"] + n * 0.015 / spb
            g["v"] = min(1.0, e["v"] * (0.22 + 0.045 * n))
            g["cents"] = 3.0 * n
            g["p"] = -e["p"] - 0.1
            g["_src"] = e["l"]
            out.append(g)
    return out


def _tile(bus, L, reps, total):
    out = np.zeros((total, 2), dtype=np.float32)
    for r in range(reps):
        i = r * L
        j = min(i + len(bus), total)
        out[i:j] += bus[: j - i]
    return out


def smooth(x, tc_s, rate=SR):
    """One-pole smoothing (what setTargetAtTime does to a parameter)."""
    a = 1.0 - np.exp(-1.0 / (tc_s * rate))
    from scipy.signal import lfilter
    return lfilter([a], [1, a - 1], x)


def intensity_from_points(points, total_samples, tc_s=0.4):
    """points = [(seconds, intensity), ...] linear in between, then eased like the engine would."""
    xs = [p[0] * SR for p in points]
    ys = [p[1] for p in points]
    x = np.interp(np.arange(total_samples), xs, ys).astype(np.float64)
    return smooth(x, tc_s).astype(np.float32)


def render_adaptive(piece, intensity, reps=1, ghost_n=0, seed=99, fold=False, buses_cache=None,
                    tail_s=TAIL_S, gain_boost=None):
    """intensity: float (constant) or float32 array of per-sample intensity (length reps*L + tail).
    Returns stereo float64. If fold=True (reps must be 1) the tail is wrapped onto the start (seamless single loop)."""
    mix = piece.mix
    cfg = dict(mix["layers"])
    curves = mix["intensityCurves"]
    extra = ghost_events(piece, ghost_n) if ghost_n > 0 else None
    if ghost_n > 0:
        cfg["ghost"] = dict(gain=0.5, rev=0.4, dly=0.0)
    if buses_cache is not None and ghost_n == 0:
        buses, L = buses_cache
    else:
        buses, L = layer_buses(piece, seed=seed, extra_events=extra, layers_cfg=cfg)
    tail = int(tail_s * SR)
    total = reps * L + tail
    if np.isscalar(intensity):
        inten = np.full(total, float(intensity), dtype=np.float32)
    else:
        inten = np.asarray(intensity, dtype=np.float32)
        if len(inten) < total:
            inten = np.pad(inten, (0, total - len(inten)), mode="edge")
        inten = inten[:total]
    dry = np.zeros((total, 2), dtype=np.float32)
    rev_in = np.zeros((total, 2), dtype=np.float32)
    dly_in = np.zeros((total, 2), dtype=np.float32)
    for k, bus in buses.items():
        c = cfg[k]
        curve = curves.get(k) or curves.get("lead") if k == "ghost" else curves.get(k)
        if curve is None:
            m = np.ones(total, dtype=np.float32)
        else:
            xs = [p[0] for p in curve]
            ys = [p[1] for p in curve]
            m = np.interp(inten, xs, ys).astype(np.float32)
        tiled = _tile(bus, L, reps, total)
        scaled = tiled * (m * c["gain"])[:, None]
        dry += scaled
        if c["rev"]:
            rev_in += scaled * c["rev"]
        if c["dly"]:
            dly_in += scaled * c["dly"]
        del tiled, scaled
    spb = 60.0 / piece.bpm
    d = mix["delay"]
    dly_out = pingpong(dly_in.astype(np.float64), d["beats"] * spb, d["fb"], d["lp"]) * d["wet"]
    del dly_in
    rev_in = rev_in.astype(np.float64) + 0.3 * dly_out
    ir = make_ir(mix["reverb"]["seconds"], np.random.default_rng(5))
    rev_out = reverb(rev_in, ir) * mix["reverb"]["wet"] * 1.2
    del rev_in
    out = dry.astype(np.float64) + dly_out + rev_out
    del dry, dly_out, rev_out
    m = mix["master"]
    out[:, 0] = filt(out[:, 0], "hp", m["hp"])
    out[:, 1] = filt(out[:, 1], "hp", m["hp"])
    if m.get("lp"):
        out[:, 0] = filt(out[:, 0], "lp", m["lp"])
        out[:, 1] = filt(out[:, 1], "lp", m["lp"])
    out = saturate(out * 0.9, m["sat"])
    if fold:
        assert reps == 1
        t = out[L:L + tail].copy()
        out = out[:L]
        out[: len(t)] += t[: len(out)]
    return out


# ------------------------------------------------------------------- SFX in the session demo
def load_wav(path):
    with wave.open(path, "rb") as f:
        n, ch = f.getnframes(), f.getnchannels()
        raw = np.frombuffer(f.readframes(n), dtype=np.int16).astype(np.float64) / 32768.0
    return raw.reshape(-1, ch)


def duck_envelope(total, events, attack=0.02, hold=0.35, release=0.6):
    """events: [(time_s, dB, sfx_length_s)]. Returns a per-sample gain array (1.0 = no ducking)."""
    g = np.ones(total)
    for (t, db, length) in events:
        amt = 10 ** (-db / 20.0)
        i0 = int(t * SR)
        a = int(attack * SR)
        h = int(min(hold + 0.15 * length, 2.0) * SR)
        r = int(release * SR)
        seg = np.ones(a + h + r)
        seg[:a] = np.linspace(1, amt, a)
        seg[a:a + h] = amt
        seg[a + h:] = np.linspace(amt, 1, r)
        j = min(i0 + len(seg), total)
        if i0 < total:
            g[i0:j] = np.minimum(g[i0:j], seg[: j - i0])
    return g
