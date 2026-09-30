"""build_game.py <act> - render one gameplay act at three intensities, normalise, measure, export score JSON."""
import sys, os, json, time, numpy as np
os.makedirs('events', exist_ok=True); os.makedirs('out', exist_ok=True)
import compose_game, checks, render, render_adaptive as RA
from synth import SR

act = int(sys.argv[1])
key = compose_game.KEYS[act]
P = compose_game.build_game(act)
oos, clashes, ring = checks.theory_report(P, chromatic_ok={1})
t0 = time.time()
cache = RA.layer_buses(P)
print("buses", round(time.time() - t0, 1), "s")
res = {}
raw = {}
for i in (0.15, 0.6, 1.0):
    x = RA.render_adaptive(P, i, reps=1, fold=True, buses_cache=cache)
    raw[i] = x
    render.write_wav("/tmp/_g.wav", x * 0.25)
    lufs, tp = render.measure_lufs("/tmp/_g.wav")
    res[i] = (lufs + 12.04, tp + 12.04)          # undo the 0.25 pre-gain (20*log10(0.25) = -12.04 dB)
    print(f"  intensity {i}: LUFS {res[i][0]:.1f}  TP {res[i][1]:.1f}  ({round(time.time()-t0,1)} s)")
# normalise so that reference intensity 0.6 lands on target loudness
tgt = P.mix["target_lufs"]
gain = 10 ** ((tgt - res[0.6][0]) / 20.0)
out = {}
for i, x in raw.items():
    y = x * gain
    lufs = res[i][0] + 20 * np.log10(gain)
    tp = res[i][1] + 20 * np.log10(gain)
    seam = checks.loop_seam(y)
    cen = checks.spectral_centroid_stats(y)
    out[str(i)] = dict(lufs=round(float(lufs), 1), true_peak=round(float(tp), 1), seam=round(seam["jump_over_typical"], 2), seam_over_p99=round(seam["jump_over_p99"], 2),
                       centroid=round(cen[0]))
P.export_mix_gain = float(gain)
ex = P.export()
ex["mix"] = P.mix
ex["notes"] = P.notes
ex["mix"]["trackGain"] = round(float(gain), 4)
with open(f"events/{key}.json", "w") as f:
    json.dump(ex, f, separators=(",", ":"), default=lambda o: sorted(o) if isinstance(o, set) else (int(o) if isinstance(o, np.integer) else float(o)))
checks.piano_roll(P, f"out/{key}_roll.png")
x1 = raw[1.0] * gain
checks.spectrogram(x1, f"out/{key}_spec.png", key + " at intensity 1.0")
layer_db = {}
for k in P.mix["layers"]:
    b = cache[0][k].astype(np.float64)
    layer_db[k] = round(float(20 * np.log10(np.sqrt((b ** 2).mean()) * P.mix["layers"][k]["gain"] * gain + 1e-12)), 1)
qa = dict(bpm=P.bpm, bars=P.bars, loop_seconds=round(P.loop_seconds, 2), events=len(P.events),
          notes_out_of_scale=len(oos), melodic_clashes=len(clashes), bell_ring_clashes=[list(r) for r in ring],
          voicing_crunch=checks.crunch_report(P), norm_gain_linear=round(float(gain), 4), target_lufs=tgt,
          by_intensity=out, layer_rms_db_full_loop=layer_db)
json.dump(qa, open(f"out/qa_{key}.json", "w"), indent=1)
print(json.dumps(qa["by_intensity"]))
print("total", round(time.time() - t0, 1), "s")
