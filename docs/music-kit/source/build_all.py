"""build_all.py - regenerate every deliverable: score JSON, WAV, MP3 previews, QA report."""
import json
import os
import numpy as np
import compose
import render
import checks
from synth import SR

OUT = "out"
EV = "events"
os.makedirs(OUT, exist_ok=True)
os.makedirs(EV, exist_ok=True)

WRAP_S = 10.0            # seconds of the loop repeated at the end of each preview, so you can hear the loop point
qa = {}
audio = {}


def wrap_preview(x):
    n = int(WRAP_S * SR)
    return np.concatenate([x, x[:n]])


for key, builder in compose.ALL_BUILDERS.items():
    P = builder()
    oos, clashes, ring = checks.theory_report(P, chromatic_ok={1} if key.startswith("menu") else ())
    x = render.render(P)
    x = render.normalise(x, P.mix["target_lufs"])
    audio[key] = x
    norm_gain = render.normalise.last_gain
    render.write_wav(f"{OUT}/{key}.wav", x)
    lufs, tp = render.measure_lufs(f"{OUT}/{key}.wav")
    seam = checks.loop_seam(x)
    cen = checks.spectral_centroid_stats(x)
    qa[key] = {
        "bpm": P.bpm, "bars": P.bars, "loop_seconds": round(P.loop_seconds, 2), "events": len(P.events),
        "voicing_crunch": checks.crunch_report(P), "notes_out_of_scale": len(oos), "melodic_clashes": len(clashes), "bell_ring_clashes": [list(r) for r in ring],
        "loudness_lufs": lufs, "true_peak_dbfs": tp, "loop_seam_jump_over_typical_step": round(seam["jump_over_typical"], 2),
        "spectral_centroid_mean_hz": round(cen[0]), "layer_levels_db": {k: round(v, 1) for k, v in P._dbg["layers_db"].items()
                                                                         if v > -100},
        "norm_gain_linear": round(norm_gain, 4), "dry_db": round(P._dbg["dry"], 1), "reverb_db": round(P._dbg["reverb"], 1),
    }
    ex = P.export()
    ex["mix"] = P.mix
    ex["notes"] = P.notes
    with open(f"{EV}/{key}.json", "w") as f:
        json.dump(ex, f, separators=(",", ":"), default=lambda o: sorted(o) if isinstance(o, set) else (int(o) if isinstance(o, np.integer) else float(o)))
    checks.piano_roll(P, f"{OUT}/{key}_roll.png")
    checks.spectrogram(x, f"{OUT}/{key}_spec.png", key)
    render.write_wav(f"{OUT}/{key}_prev.wav", wrap_preview(x))
    render.to_mp3(f"{OUT}/{key}_prev.wav", f"{OUT}/{key}.mp3", kbps=96)
    print(key, qa[key]["loudness_lufs"], qa[key]["true_peak_dbfs"], "events", len(P.events))
    if key == "feed_act2_tremors":
        P2 = builder()
        y = render.render(P2, ghost_n=12)
        y = render.normalise(y, P2.mix["target_lufs"])
        render.write_wav(f"{OUT}/feed_act2_anomaly12_prev.wav", wrap_preview(y))
        render.to_mp3(f"{OUT}/feed_act2_anomaly12_prev.wav", f"{OUT}/feed_act2_anomaly12.mp3", kbps=96)
        audio["feed_act2_anomaly12"] = y
        yl = render.render(P2, ghost_n=6)
        yl = render.normalise(yl, P2.mix["target_lufs"])
        audio["feed_act2_anomaly6"] = yl

# ---- the four-act arc in one short file: excerpts joined with 1.5 s crossfades
def excerpt(x, a, b):
    return x[int(a * SR):int(b * SR)]

pieces = [
    ("feed_act1_melt_up", 24.6, 39.0),
    ("feed_act2_tremors", 24.6, 39.0),
    ("feed_act3_contagion", 17.0, 31.0),
    ("feed_act4_reckoning", 0.0, 18.0),
]
xf = int(1.5 * SR)
arc = None
for k, a, b in pieces:
    seg = excerpt(audio[k], a, b).copy()
    if arc is None:
        arc = seg
    else:
        fade = np.linspace(0, 1, xf)[:, None]
        arc[-xf:] = arc[-xf:] * (1 - fade) + seg[:xf] * fade
        arc = np.concatenate([arc, seg[xf:]])
arc[-int(2 * SR):] *= np.linspace(1, 0, int(2 * SR))[:, None]
render.write_wav(f"{OUT}/feed_arc.wav", arc)
render.to_mp3(f"{OUT}/feed_arc.wav", f"{OUT}/feed_arc.mp3", kbps=96)

with open(f"{OUT}/qa_report.json", "w") as f:
    json.dump(qa, f, indent=1)
print("done")
