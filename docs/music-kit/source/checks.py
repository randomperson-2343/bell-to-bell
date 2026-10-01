"""checks.py - things I can verify without ears: notes in key, harmonic clashes, loop seam, loudness, spectrum, picture of the score."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from compose import MODES, name
from synth import SR

MELODIC_LAYERS = ("lead", "lead2", "melody", "bell", "osc_a", "osc_b", "swarm_a", "swarm_b", "swarm_c", "swarm_d")


def scale_pcs(P, extra=()):
    return {(P.tonic + i) % 12 for i in MODES[P.mode]} | set(extra)


def theory_report(P, chromatic_ok=()):
    """1) every melodic note is in the scale or in the declared chromatic list
       2) no melodic note sits a semitone from a chord tone unless it is itself a chord tone or declared colour."""
    sc = scale_pcs(P, chromatic_ok)
    out_of_scale, clashes, ring_clashes = [], [], []
    spb = 60.0 / P.bpm
    for e in P.events:
        if e["l"] not in MELODIC_LAYERS or e["n"] is None:
            continue
        pc = e["n"] % 12
        c = P.chord_at(e["t"])
        if pc not in sc and pc not in c["tones"]:
            out_of_scale.append((e["t"], name(e["n"]), c["name"]))
        if pc not in c["tones"] and pc not in c["ok"]:
            near = [t for t in c["tones"] if min((pc - t) % 12, (t - pc) % 12) == 1]
            if near:
                clashes.append((e["t"], e["l"], name(e["n"]), c["name"]))
        # bells ring for a long time: check the chords they ring into (first 2 seconds beyond the strike)
        if e["i"] == "bell":
            ring_end = e["t"] + min(e["d"], 2.5 / spb)
            for c2 in P.chords:
                if c2["t"] > e["t"] and c2["t"] < ring_end % P.loop_beats + (P.loop_beats if ring_end > P.loop_beats else 0):
                    if pc not in c2["tones"] and pc not in c2["ok"]:
                        near = [t for t in c2["tones"] if min((pc - t) % 12, (t - pc) % 12) == 1]
                        if near:
                            ring_clashes.append((e["t"], name(e["n"]), "rings into", c2["name"]))
    return out_of_scale, clashes, ring_clashes


def loop_seam(x):
    """Compare the audio just before the loop point with the audio just after it. Smooth loops have no jump."""
    n = int(0.02 * SR)
    end, start = x[-n:], x[:n]
    jump = np.abs(x[0] - x[-1]).max()
    rms_end = np.sqrt((end ** 2).mean())
    rms_start = np.sqrt((start ** 2).mean())
    typical = np.abs(np.diff(x, axis=0)).mean()
    d99 = float(np.percentile(np.abs(np.diff(x, axis=0)).max(axis=1), 99))
    return {"sample_jump": float(jump), "typical_step": float(typical), "jump_over_typical": float(jump / (typical + 1e-9)),
            "jump_over_p99": float(jump / (d99 + 1e-9)),
            "rms_end_db": float(20 * np.log10(rms_end + 1e-9)), "rms_start_db": float(20 * np.log10(rms_start + 1e-9))}


def spectral_centroid_stats(x):
    m = x.mean(axis=1)
    hop, win = 2048, 4096
    freqs = np.fft.rfftfreq(win, 1 / SR)
    cs = []
    for i in range(0, len(m) - win, hop * 4):
        s = np.abs(np.fft.rfft(m[i:i + win] * np.hanning(win)))
        if s.sum() > 1e-6:
            cs.append((freqs * s).sum() / s.sum())
    return float(np.mean(cs)), float(np.percentile(cs, 90))


def piano_roll(P, path, title=None):
    colors = {"pad": "#6c7ae0", "bass": "#e0a13c", "arp": "#4cc9b0", "lead": "#f25c78", "lead2": "#f7a1b0",
              "bell": "#ffd84a", "melody": "#ffd84a", "ep": "#7fbf7f", "osc_a": "#4cc9b0", "osc_b": "#f25c78",
              "kick": "#bbbbbb", "tock": "#999999", "tick": "#666666", "riser": "#aa66cc", "train": "#886644",
              "tremor": "#aa4444", "drone": "#446688"}
    fig, ax = plt.subplots(figsize=(13, 4.6))
    for e in P.events:
        col = colors.get(e["l"], "#888")
        if e["n"] is not None:
            ax.barh(e["n"], e["d"] / P.bpb, left=e["t"] / P.bpb, height=0.8, color=col, alpha=0.85, lw=0)
        else:
            y = {"kick": 26, "tock": 28, "tick": 30, "riser": 32, "train": 24, "tremor": 22}.get(e["l"], 26)
            ax.plot([e["t"] / P.bpb], [y], "|", color=col, ms=5)
    ax.set_xlim(0, P.bars)
    ax.set_xticks(range(0, P.bars + 1, 4))
    ax.set_xlabel("bar")
    ax.set_ylabel("MIDI note (low = bass, top rows = percussion ticks)")
    ax.set_title(title or P.title)
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    fig.savefig(path, dpi=80)
    plt.close(fig)


def spectrogram(x, path, title=""):
    m = x.mean(axis=1)
    fig, ax = plt.subplots(figsize=(13, 3.6))
    ax.specgram(m, NFFT=4096, Fs=SR, noverlap=2048, cmap="magma", vmin=-130, vmax=-40)
    ax.set_ylim(0, 8000)
    ax.set_title(title)
    ax.set_xlabel("seconds")
    ax.set_ylabel("Hz")
    fig.tight_layout()
    fig.savefig(path, dpi=80)
    plt.close(fig)


def section_levels(x, P, sections):
    """RMS in dBFS per named bar-range, to confirm the arrangement builds and falls the way it was written."""
    out = {}
    for nm, (b0, b1) in sections.items():
        i, j = int(b0 * P.bpb * 60 / P.bpm * SR), int(b1 * P.bpb * 60 / P.bpm * SR)
        seg = x[i:j]
        out[nm] = round(float(20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)), 1)
    return out


def crunch_report(P):
    """Count minor seconds (1 semitone) and total voicings, inside every pad / piano chord voicing."""
    n_voicings, n_semis, worst = 0, 0, []
    for ch in P.chords:
        v = ch.get("pad") or ch.get("v")
        if not v:
            continue
        n_voicings += 1
        semis = [(name(a), name(b)) for a, b in zip(v, v[1:]) if b - a == 1]
        n_semis += len(semis)
        if semis:
            worst.append((ch["name"], semis))
    return {"voicings": n_voicings, "semitone_pairs": n_semis, "where": worst[:6]}
