"""build_sfx.py - render every sound effect, normalise by category, measure, and export the JSON pack."""
import json
import os
import zlib
import numpy as np
from synth import SR, filt
import sfxlib
import sfx_catalog as C
import render

OUT = "out/sfx"
os.makedirs(OUT, exist_ok=True)
os.makedirs("events", exist_ok=True)


def rng_for(id):
    return np.random.default_rng(zlib.crc32(id.encode()))


def render_one(id, spec, n_param=None):
    dry = sfxlib.render_sfx(spec, rng_for(id), n_param=n_param)
    x = sfxlib.with_room(dry, spec["rev"], spec["room"])
    return sfxlib.trim_tail(x)


def db(a):
    return 20 * np.log10(a + 1e-12)


def active_rms_db(x):
    """RMS over the part of the sound that is within 30 dB of its loudest moment (so long quiet tails do not count)."""
    m = np.abs(x).max(axis=1)
    thr = m.max() * 10 ** (-30 / 20)
    sel = x[m > thr]
    return float(db(np.sqrt((sel ** 2).mean())))


def centroid(x):
    mono = x.mean(axis=1)
    if len(mono) < 512:
        mono = np.pad(mono, (0, 512 - len(mono)))
    w = np.abs(np.fft.rfft(mono * np.hanning(len(mono))))
    f = np.fft.rfftfreq(len(mono), 1 / SR)
    return float((f * w).sum() / (w.sum() + 1e-12))


def write_both(x, stem):
    render.write_wav(f"{OUT}/{stem}.wav", x)
    render.to_mp3(f"{OUT}/{stem}.wav", f"{OUT}/{stem}.mp3", kbps=96)


def blip_line(who, text="SELL THE RALLY NOW"):
    spec = C.S[f"text_blip_{who}"]
    cv = spec["charVariation"]
    chars = [c for c in text if c.isalnum()]
    parts = []
    for i, ch in enumerate(chars):
        semis = cv["semitones"][ord(ch) % 5]
        v = dict(spec["voices"][0])
        v["n"] = cv["baseMidi"] + semis
        one = sfxlib.render_sfx({"voices": [v]}, rng_for(who + str(i)))
        parts.append(one)
    step = int(0.05 * SR)
    out = np.zeros((step * len(parts) + max(len(p) for p in parts) + 100, 2))
    for i, p in enumerate(parts):
        out[i * step:i * step + len(p)] += p
    return out


LEVELS = json.load(open("sfx_levels.json")) if os.path.exists("sfx_levels.json") else {}
pack = {"version": 1,
        "units": "Times are seconds. The pack is a score at 60 BPM, so one beat is one second.",
        "voiceTypes": {
            "tone": "OscillatorNode. n=MIDI or f=Hz. Optional: n_end/f_end (glide: gtc = setTargetAtTime time constant, or ramp=true for exponentialRamp over d), fm{ratio,idx,itc}, lp{f0,f1,tc|ramp,q}, vib{rate,cents}, detune (cents), sat (tanh drive), a/dtc/s/rtc envelope, nScale.",
            "noise": "White-noise buffer through a BiquadFilter (filter lp|hp|bp, f0, optional f1 sweep with stc or ramp, q) and a gain envelope.",
            "inst": "A music instrument from the handoff (bell, kick, tock, tick, riser, tremor ...). Extras such as tc, deep pass straight through; d is the note length."},
        "peakTargetsDb": C.PEAK_DB,
        "duck": {"attackS": 0.02, "holdS": 0.35, "releaseS": 0.6,
                 "note": "When a sound has duck > 0, pull the music bus down by that many dB, hold, then release."},
        "sounds": {}}
qa = {}
raw = {}
for id, spec in C.S.items():
    n_param = spec.get("nParam", {}).get("default")
    x = render_one(id, spec, n_param)
    tgt = LEVELS.get(id, C.PEAK_DB[spec["cat"]])
    g = 10 ** ((tgt - db(np.abs(x).max())) / 20)
    raw[id] = (x, g)
    y = x * g
    write_both(y, id)
    qa[id] = dict(cat=spec["cat"], duration_s=round(len(y) / SR, 3), peak_db=round(float(db(np.abs(y).max())), 1),
                  active_rms_db=round(active_rms_db(y), 1), centroid_hz=int(centroid(y)),
                  start_click=round(float(np.abs(y[:8]).max() / (np.abs(y).max() + 1e-12)), 4),
                  end_level_db=round(float(db(np.abs(y[-32:]).max())), 1), gain=round(float(g), 4),
                  nan=bool(np.isnan(y).any()))
    e = {k: v for k, v in spec.items() if k != "nParam"}
    e["gain"] = round(float(g), 4)
    e["durationS"] = qa[id]["duration_s"]
    if "nParam" in spec:
        e["nParam"] = spec["nParam"]
    pack["sounds"][id] = e
    if id == "anomaly_logged":
        for n in (1, 6, 12):
            z = render_one(id, spec, n) * g
            write_both(z, f"anomaly_logged_n{n}")

for who in ("imani", "kroll", "sana", "thorne", "compliance", "narrator"):
    y = blip_line(who)
    g = raw[f"text_blip_{who}"][1]
    write_both(y * g, f"text_demo_{who}")

with open("events/sfx_pack.json", "w") as f:
    json.dump(pack, f, separators=(",", ":"), default=lambda o: float(o))
with open("out/sfx_qa.json", "w") as f:
    json.dump(qa, f, indent=1)

bad = {k: v for k, v in qa.items() if v["nan"] or v["start_click"] > 0.25 or v["end_level_db"] > -50 or v["peak_db"] > -2.5}
print(len(qa), "sounds rendered. Flagged:", bad if bad else "none")
for k, v in qa.items():
    print(f"{k:20s} {v['cat']:9s} {v['duration_s']:5.2f}s peak {v['peak_db']:6.1f} rms {v['active_rms_db']:6.1f} cent {v['centroid_hz']:5d} click {v['start_click']:.3f} end {v['end_level_db']:6.1f}")
