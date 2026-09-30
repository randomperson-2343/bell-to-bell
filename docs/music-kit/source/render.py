"""
render.py - plays a Piece's note events through the instrument recipes and the mix chain.

Loop-safe: everything is rendered for the loop plus a tail, then the tail is folded back onto the start,
so reverb and delay tails from the end of the loop ring into the beginning (this is what will happen
in the game when the loop repeats).
"""
import subprocess
import wave
import numpy as np
from synth import (SR, filt, filt_var, mod_delay, chorus, pingpong, make_ir, reverb, pan, add_at, saturate)
from instruments import INSTRUMENTS, hiss, crackle

TAIL_S = 9.0


def periodic_curve(points, loop_beats, bpm, n, lfo_cycles=0, lfo_depth=0.14):
    t = np.arange(n) / SR
    beat = (t * bpm / 60.0) % loop_beats
    xs = [p[0] for p in points]
    ys = np.log([p[1] for p in points])
    hz = np.exp(np.interp(beat, xs, ys))
    if lfo_cycles:
        hz = hz * (1.0 + lfo_depth * np.sin(2 * np.pi * lfo_cycles * beat / loop_beats))
    return hz


def render(piece, ghost_n=0, seed=99, quiet=True):
    mix = piece.mix
    bpm = piece.bpm
    spb = 60.0 / bpm
    L = int(round(piece.loop_seconds * SR))
    N = L + int(TAIL_S * SR)
    rng = np.random.default_rng(seed)

    events = list(piece.events)
    if ghost_n > 0:
        for e in piece.events:
            if e["l"] == "melody" and e["n"] is not None:
                g = dict(e)
                g["l"] = "ghost"
                g["i"] = "ghost"
                g["t"] = e["t"] + ghost_n * 0.015 / spb
                g["v"] = min(1.0, e["v"] * (0.22 + 0.045 * ghost_n))
                g["cents"] = 3.0 * ghost_n
                g["p"] = -e["p"] - 0.1
                events.append(g)

    layers = dict(mix["layers"])
    if ghost_n > 0:
        layers["ghost"] = dict(gain=0.5, rev=0.4, dly=0.0)

    buses = {k: np.zeros((N, 2)) for k in layers}
    for e in events:
        fn = INSTRUMENTS[e["i"]]
        kw = {k: v for k, v in e.items() if k not in ("t", "d", "n", "v", "i", "l", "p")}
        dur_s = e["d"] * spb
        n = e["n"] if e["n"] is not None else 0
        y = fn(n, e["v"], rng, dur=dur_s, **kw)
        if e["i"] == "riser":
            pass
        add_at(buses[e["l"]], pan(y, e["p"]), e["t"] * spb)

    # ---- pad bus: one shared lowpass with slow movement, then chorus
    if "pad" in buses:
        mono = buses["pad"].mean(axis=1)
        cut = periodic_curve(mix["pad_filter"], piece.loop_beats, bpm, N, mix["pad_lfo_cycles"])
        mono = filt_var(mono, "lp", cut, q=mix["pad_q"])
        buses["pad"] = chorus(mono, rate=0.28, depth_ms=3.2, base_ms=14.0, mix=0.55)

    dry = np.zeros((N, 2))
    rev_in = np.zeros((N, 2))
    dly_in = np.zeros((N, 2))
    for k, b in buses.items():
        cfg = layers[k]
        dry += b * cfg["gain"]
        rev_in += b * cfg["gain"] * cfg["rev"]
        dly_in += b * cfg["gain"] * cfg["dly"]

    d = mix["delay"]
    dly_out = pingpong(dly_in, d["beats"] * spb, d["fb"], d["lp"]) * d["wet"]
    rev_in = rev_in + 0.3 * dly_out
    ir = make_ir(mix["reverb"]["seconds"], np.random.default_rng(5))
    rev_out = reverb(rev_in, ir) * mix["reverb"]["wet"] * 1.2

    out = dry + dly_out + rev_out
    rms = lambda a: float(20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-12))
    piece._dbg = {"dry": rms(dry), "delay": rms(dly_out), "reverb": rms(rev_out),
                  "layers_db": {k: rms(b * layers[k]["gain"]) for k, b in buses.items()}}

    m = mix["master"]
    if m.get("wobble"):
        w = m["wobble"]
        rate = w["cycles"] / piece.loop_seconds
        for c in range(2):
            out[:, c] = mod_delay(out[:, c], 8.0, w["depth_ms"], rate, phase=0.0 + 0.03 * c)
    out[:, 0] = filt(out[:, 0], "hp", m["hp"])
    out[:, 1] = filt(out[:, 1], "hp", m["hp"])
    if m.get("lp"):
        out[:, 0] = filt(out[:, 0], "lp", m["lp"])
        out[:, 1] = filt(out[:, 1], "lp", m["lp"])
    out = saturate(out * 0.9, m["sat"])

    # ---- fold the tail back onto the start (loop-safe)
    tail = out[L:L + int(TAIL_S * SR)].copy()
    out = out[:L]
    out[: len(tail)] += tail[: len(out)]

    if m.get("hiss"):
        h = hiss(piece.loop_seconds + 0.1, np.random.default_rng(11))[:L]
        out += m["hiss"] * h[:, None] / (np.std(h) + 1e-9) * 0.5
        c = crackle(piece.loop_seconds + 0.1, np.random.default_rng(12))[:L]
        out += m["crackle"] * c[:, None] * 6.0
    return out


# ------------------------------------------------------------------ files / loudness
def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype(np.int16)
    with wave.open(path, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def measure_lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stderr
    i = txt.rfind("Integrated loudness:")
    seg = txt[i:]
    lufs = float(seg.split("I:")[1].split("LUFS")[0])
    p = txt.rfind("True peak:")
    tp = float(txt[p:].split("Peak:")[1].split("dBFS")[0])
    return lufs, tp


def normalise(x, target_lufs, tmp="/tmp/_n.wav"):
    write_wav(tmp, x * 0.25)
    lufs, _ = measure_lufs(tmp)
    gain = 0.25 * 10 ** ((target_lufs - lufs) / 20.0)
    normalise.last_gain = float(gain)
    y = x * gain
    # gentle safety limiter so true peaks stay under about -1.5 dBFS without hard clipping
    ceiling = 10 ** (-1.5 / 20)
    y = np.where(np.abs(y) > 0.8, np.sign(y) * (0.8 + (ceiling - 0.8) * np.tanh((np.abs(y) - 0.8) / (ceiling - 0.8))), y)
    return y


def to_mp3(wav_path, mp3_path, kbps=112):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", wav_path, "-codec:a", "libmp3lame",
                    "-b:a", f"{kbps}k", mp3_path], check=True)
