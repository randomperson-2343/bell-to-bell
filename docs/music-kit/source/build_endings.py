"""build_endings.py <id> [<id> ...] | all
Render each ending piece with the kit's own renderer, normalise to its target loudness, measure, and write
events/ending_<id>.json (score + mix + trackGain) plus a QA record. Previews (WAV, piano roll, spectrogram) go to $OUT.
"""
import sys, os, json, time
import numpy as np
import compose_endings as CE, checks, render
from compose import name

OUT = os.environ.get("OUT", "out")
os.makedirs(OUT, exist_ok=True)
EV = os.environ.get("EV", "../events")
os.makedirs(EV, exist_ok=True)
QA = {}
ids = list(CE.BUILDERS) if sys.argv[1:] == ["all"] else sys.argv[1:]
if ids == ["collect"]:
    import glob
    for f in sorted(glob.glob(f"{OUT}/qa_ending_*.json")):
        QA[os.path.basename(f)[3:-5]] = json.load(open(f))
    json.dump(QA, open("../qa_endings.json", "w"), indent=1)
    print("collected", len(QA))
    sys.exit(0)
for i in ids:
    t0 = time.time()
    P = CE.BUILDERS[i]()
    oos, cl, ring = checks.theory_report(P, chromatic_ok=CE.CHROMATIC_OK.get(i, set()))
    for t_, n_ in getattr(P, "intentional", []):
        cl = [x for x in cl if not (abs(x[0] - t_) < 1e-3 and x[2] == name(n_))]
        oos = [x for x in oos if not (abs(x[0] - t_) < 1e-3 and x[1] == name(n_))]
    x = render.render(P)
    y = render.normalise(x, P.mix["target_lufs"], tmp=f"{OUT}/_n_{i}.wav")
    gain = render.normalise.last_gain
    wav = f"{OUT}/ending_{i}.wav"
    render.write_wav(wav, y)
    lufs, tp = render.measure_lufs(wav)
    seam = checks.loop_seam(y)
    cen = checks.spectral_centroid_stats(y)
    P.mix["trackGain"] = round(float(gain), 4)
    ex = P.export()
    ex["mix"] = P.mix
    ex["notes"] = P.notes
    with open(f"{EV}/ending_{i}.json", "w") as f:
        json.dump(ex, f, separators=(",", ":"),
                  default=lambda o: sorted(o) if isinstance(o, set) else (int(o) if isinstance(o, np.integer) else float(o)))
    checks.piano_roll(P, f"{OUT}/ending_{i}_roll.png")
    checks.spectrogram(y, f"{OUT}/ending_{i}_spec.png", i)
    qa = dict(bpm=P.bpm, bars=P.bars, loop_seconds=round(P.loop_seconds, 2), events=len(P.events),
              notes_out_of_scale=len(oos), intentional_wrong_notes=len(getattr(P, 'intentional', [])), melodic_clashes=len(cl), bell_ring_clashes=[list(r) for r in ring],
              voicing_crunch=checks.crunch_report(P), target_lufs=P.mix["target_lufs"], loudness_lufs=lufs,
              true_peak_dbfs=tp, norm_gain_linear=round(float(gain), 4), seam_jump_over_typical=round(seam["jump_over_typical"], 2),
              seam_over_p99=round(seam["jump_over_p99"], 2), rms_end_db=round(seam["rms_end_db"], 1),
              rms_start_db=round(seam["rms_start_db"], 1), centroid_hz=round(cen[0]))
    json.dump(qa, open(f"{OUT}/qa_ending_{i}.json", "w"), indent=1)
    # the combined record the repo keeps (merge, so ids can be rebuilt one at a time)
    # (parallel runs can race on this file; `build_endings.py collect` rebuilds it from $OUT)
    QA[f"ending_{i}"] = qa
    print(i, f"LUFS {lufs:.1f} TP {tp:.1f} gain {gain:.4f} seam {seam['jump_over_typical']:.2f} ({time.time()-t0:.0f}s)", flush=True)
