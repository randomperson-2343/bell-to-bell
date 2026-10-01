"""
compose_endings.py - one loopable piece of music for each Career ending screen.

Same sound world as the rest of the kit: the same instruments, the same mix chain, the same leitmotif T
(scale steps -3 0 2 1 0, rhythm 1 1 2 1 3 over 8 beats; in D minor that is A D F E D). Every ending treats T
the way its story treats the player:

  reward  = A up to D     penalty = D down to A     major third (F sharp) = hope, used only where hope is real

Ending keys are the game's ending ids (js/modes/story/endings.js): ending_<id>.json.
Everything is deterministic. build_endings.py renders, normalises and exports these.
"""
import numpy as np
import compose
from compose import Piece, step_midi, voice_lead, euclid, name, MODES

MODES.setdefault("dorian", [0, 2, 3, 5, 7, 9, 10])
MODES.setdefault("lydian", [0, 2, 4, 6, 7, 9, 11])

TON = 74                                   # D5, the same melody tonic as the menu and the trading theme
T = [-3, 0, 2, 1, 0]
RH = [(0, 1), (1, 1), (2, 2), (4, 1), (5, 3)]
RH2 = [(2 * b, 2 * d) for b, d in RH]      # augmentation: T at half speed (16 beats)

# the menu's chord cycle (8 beats each): Dm9 Bbmaj7 Gm9 A7sus4
CYCLE = [(8, "Dm9", {2, 5, 9, 0, 4}, (), 38), (8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
         (8, "Gm9", {7, 10, 2, 5, 9}, (), 31), (8, "A7sus4", {9, 2, 4, 7}, (), 33)]
CYC_T = [[-3, 0, 2, 1, 0], [-5, -2, 0, -1, -2], [-7, -4, -2, -3, -4]]      # T over each chord (as in the menu)


def ramp(t, pts):
    xs, ys = zip(*pts)
    return float(np.interp(t, xs, ys))


# ------------------------------------------------------------------ small building blocks
def mk(key, title, bpm, bars, mode, seed, tonic=TON):
    return Piece(f"ending_{key}", title, bpm, bars, tonic, mode, seed)


def addw(P, layer, inst, t, d, n=None, v=0.8, p=0.0, **kw):
    """Add with the start time wrapped into the loop (for anticipations before beat 0)."""
    P.add(layer, inst, t % P.loop_beats, d, n, v=v, p=p, **kw)


def stm(P, layer, inst, t0, steps, *, mode=None, tonic=None, shift=0, octv=0, v=0.8, rh=RH, ds=0.97, d=None,
        p=0.05, **kw):
    """One statement of (a piece of) T at beat t0. `d` fixes every duration (bells); `ds` scales the rhythm's."""
    mode, tonic = mode or P.mode, tonic or P.tonic
    for (bt, dur), s in zip(rh, steps):
        m = step_midi(tonic, mode, s + shift) + 12 * octv
        addw(P, layer, inst, t0 + bt, d if d is not None else dur * ds, m, v=v, p=p, **kw)


def set_chords(P, rows, start=0):
    t = start
    for d, nm, tones, ok, bass in rows:
        P.chords.append(dict(t=t, d=d, name=nm, tones=set(tones), ok=set(ok), bass=bass))
        t += d


def pad_layer(P, v=0.7, lo=50, hi=71, layer="pad", extra=0.15, vel_fn=None, **kw):
    prev = None
    for c in P.chords:
        vo = voice_lead(prev, c.get("voicing", c["tones"]), lo, hi)
        prev = vo
        c["pad"] = vo
        vv = v if vel_fn is None else vel_fn(c["t"])
        for m in vo:
            P.add(layer, "pad", c["t"], c["d"] + extra, m, v=vv, **kw)


def bass_roots(P, inst="sub", v=0.8, frac=0.96, layer="bass", vel_fn=None):
    for c in P.chords:
        P.add(layer, inst, c["t"], c["d"] * frac, c["bass"], v=v if vel_fn is None else vel_fn(c["t"]))


def lubdub(P, t, v, gap=0.45, layer="kick"):
    P.add(layer, "kick", t % P.loop_beats, 0.5, None, v=v)
    P.add(layer, "kick", (t + gap) % P.loop_beats, 0.5, None, v=v * 0.55)


def ticker(P, lvl, k=7, rot=3, layer="tick", bars=None):
    """Ticker tape: euclidean k-in-16, rotated by bar. lvl(bar) is the level (0 = silent); k may be a function."""
    for bar in range(bars if bars is not None else P.bars):
        l = lvl(bar)
        if l <= 0:
            continue
        kk = k(bar) if callable(k) else k
        if kk <= 0:
            continue
        for s16, hit in enumerate(euclid(kk, 16, rot=(bar * rot) % 16)):
            if hit:
                P.add(layer, "tick", bar * 4 + s16 * 0.25, 0.03, None, v=l * float(P.rng.uniform(0.55, 1.0)),
                      p=-0.4 if s16 % 2 else 0.4)


def cyc_statements(P, layer, inst, t0, reps, *, octv=0, v=0.8, p=0.05, d=None, ds=0.97, fourth=True, **kw):
    """T over the four-chord cycle, as in the menu. The fourth chord gets the short E A D figure."""
    for r in range(reps):
        b = t0 + 32 * r
        for k, steps in enumerate(CYC_T):
            stm(P, layer, inst, b + 8 * k, steps, octv=octv, v=v, p=p, d=d, ds=ds, **kw)
        if fourth:
            for bt, m, dur in ((0, 64, 1), (1, 69, 1), (2, 74, 2)):
                addw(P, layer, inst, b + 24 + bt, d if d is not None else dur * ds, m + 12 * octv, v=v, p=p, **kw)


DEF = {   # layer -> (gain, reverb send, delay send); the same values the kit's pieces use
    "pad": (0.36, 0.30, 0.0), "bass": (0.42, 0.0, 0.0), "arp": (0.50, 0.30, 0.65), "lead": (0.48, 0.35, 0.35),
    "lead2": (0.38, 0.35, 0.30), "bell": (0.55, 0.60, 0.20), "kick": (0.60, 0.02, 0.0), "tock": (0.40, 0.15, 0.0),
    "tick": (0.10, 0.10, 0.05), "riser": (0.20, 0.35, 0.0), "ep": (0.42, 0.25, 0.10), "melody": (0.54, 0.32, 0.22),
    "drone": (0.22, 0.30, 0.0), "tremor": (0.32, 0.20, 0.0), "train": (0.17, 0.12, 0.0),
    "osc_a": (0.36, 0.15, 0.40), "osc_b": (0.36, 0.15, 0.40), "swarm_a": (0.34, 0.25, 0.40),
    "swarm_b": (0.34, 0.25, 0.40), "swarm_c": (0.34, 0.25, 0.40), "swarm_d": (0.34, 0.25, 0.40),
    "sharp": (0.40, 0.40, 0.0), "echo": (0.40, 0.40, 0.20), "double": (0.40, 0.30, 0.10), "keys": (0.36, 0.40, 0.15),
}


def finish(P, *, lufs, rev=(3.0, 0.5), dly=(0.75, 0.4, 3000.0, 0.5), pf=(700, 700), lfo=2, q=0.9, master=None,
           over=None, notes=""):
    over = over or {}
    layers = {}
    for l in sorted({e["l"] for e in P.events}):
        g, r, d = over[l] if l in over else DEF[l]
        layers[l] = dict(gain=g, rev=r, dly=d)
    n = len(pf) - 1
    P.mix = dict(
        layers=layers,
        reverb=dict(seconds=rev[0], wet=rev[1]),
        delay=dict(beats=dly[0], fb=dly[1], lp=dly[2], wet=dly[3]),
        pad_filter=[(P.loop_beats * i / n, hz) for i, hz in enumerate(pf)],
        pad_lfo_cycles=lfo, pad_q=q,
        master=dict(hp=30.0, lp=9500.0, sat=1.15, wobble=None, hiss=0.0, crackle=0.0),
        target_lufs=lufs, ghostLayers=[],
    )
    if master:
        P.mix["master"].update(master)
    P.notes = notes
    return P


# =====================================================================================
#  THE ENDINGS
# =====================================================================================
def build_wiped():
    """Cardboard box. T is taken apart: five notes, four, three, then only the falling fifth D to A.
    The heartbeat slows and stops, the ticker thins to nothing, the pad loses a voice at a time."""
    P = mk("wiped", "Wiped Out", 60, 16, "minor", 4101)
    set_chords(P, [(16, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
                   (16, "Gm9", {7, 10, 2, 5, 9}, (), 31), (16, "A7sus4", {9, 2, 4, 7}, (), 33)])
    pad_layer(P, vel_fn=lambda t: [0.70, 0.60, 0.50, 0.42][int(t // 16)], attack=2.2, rel=1.5)
    bass_roots(P, "sub", vel_fn=lambda t: [0.8, 0.7, 0.6, 0.5][int(t // 16)], frac=0.9)
    for k, n_notes in enumerate((5, 4, 3)):                       # T, then less of T each time
        stm(P, "bell", "bell", 16 * k, T[:n_notes], octv=-1, v=0.85 - 0.1 * k, d=6, tc=2.0, p=0.0)
    P.add("bell", "bell", 48, 8, 62, v=0.7, p=0.0, tc=2.4)        # D ...
    P.add("bell", "bell", 52, 8, 57, v=0.6, p=0.0, tc=2.6)        # ... down to A
    P.add("bell", "bell", 57, 10, 38, v=0.55, p=0.0, tc=3.2)      # one deep toll
    t, gap, v = 0.0, 2.0, 0.95                                    # heartbeat: the gaps open up, then nothing
    while t < 54:
        lubdub(P, t, v)
        t += gap
        gap *= 1.11
        v *= 0.96
    ticker(P, lambda b: 0.5 if b < 8 else 0.0, k=lambda b: [6, 5, 5, 4, 3, 2, 1, 1][b] if b < 8 else 0)
    for t in (28, 45):
        P.add("tremor", "tremor", t, 3.5, None, v=0.65)
    P.add("drone", "drone", 36, 28, 38, v=0.5)
    P.add("drone", "drone", 36, 28, 45, v=0.35)
    return finish(P, lufs=-22.0, rev=(4.4, 0.72), dly=(0.75, 0.35, 2400.0, 0.4), pf=(620, 520, 420, 380, 620),
                  master=dict(lp=8000.0),
                  notes="T falls apart. Heartbeat flatlines. Ends on the falling fifth D to A and a low toll.")


def build_fired():
    """One pitch, one rhythm, a clock that does not care. The last phrase drops D to A and the door shuts."""
    P = mk("fired", "Fired", 66, 16, "minor", 4102)
    set_chords(P, [(40, "Dm9", {2, 5, 9, 0, 4}, (), 38), (12, "Gm9", {7, 10, 2, 5, 9}, (), 31),
                   (12, "A7sus4", {9, 2, 4, 7}, (), 33)])
    pad_layer(P, v=0.45, attack=1.6, rel=1.2)
    bass_roots(P, "sub", v=0.65, frac=0.94)
    for k in range(8):                                            # T's rhythm on a single note
        for i, (bt, dur) in enumerate(RH):
            n = 69 if (k in (3, 7) and i == 4) else 74
            P.add("melody", "ep", 8 * k + bt, dur * 0.97, n, v=0.6, p=0.1, decay=1.6, dark=0.3)
    for beat in range(60):                                        # the clock
        P.add("tock", "tock", beat, 0.12, None, v=0.5, p=-0.3 if beat % 2 else 0.3)
    P.add("kick", "kick", 60, 0.5, None, v=0.95)                  # the door
    P.add("bell", "bell", 60.5, 6, 57, v=0.6, tc=2.5)
    P.add("drone", "drone", 0, 34, 38, v=0.4)
    P.add("drone", "drone", 30, 34, 38, v=0.4)
    P.add("drone", "drone", 0, 34, 45, v=0.3)
    P.add("drone", "drone", 30, 34, 45, v=0.3)
    return finish(P, lufs=-22.0, rev=(2.4, 0.4), pf=(480, 480), master=dict(lp=7200.0, hiss=0.002, sat=1.2),
                  notes="Monotone T over a steady clock. Last phrase falls D to A; a door shuts.")


def build_nobody():
    """Autonomous systems converge. Four machine voices drift out of phase and back, a sharp ghost piles up,
    no human pulse anywhere. One bell at the start and nothing answers it."""
    P = mk("nobody", "Nobody Turned It Off", 72, 16, "minor", 4103)
    set_chords(P, [(24, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
                   (16, "Gm9", {7, 10, 2, 5, 9}, (), 31), (8, "A7sus4", {9, 2, 4, 7}, {5, 0}, 33)])
    pad_layer(P, v=0.5, vel_fn=lambda t: 0.5)
    bass_roots(P, "sub", v=0.5, frac=0.95)
    cell = [74, 69, 77, 72, 81, 69, 74, 77]
    acc = [1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]
    voices = [("swarm_a", 16, -0.7, 0, 0), ("swarm_b", 15, -0.25, 2, 12), ("swarm_c", 17, 0.25, 4, 24),
              ("swarm_d", 14, 0.7, 6, 36)]
    for layer, N, pan, rot, enter in voices:                      # N cycles in 64 beats: realign exactly at the loop point
        L = 64.0 / N
        for cyc in range(N):
            for j in range(8):
                t = cyc * L + j * L / 8
                env = ramp(t, [(0, 0), (enter, 0), (enter + 8, 1), (52, 1), (64, 0)])
                if env < 0.03:
                    continue
                P.add(layer, "arp", t, L / 8 * 0.6, cell[(j + rot) % 8], v=0.42 * acc[j] * env, p=pan)
                if layer == "swarm_a" and 24 <= t < 58 and j % 2 == 0:       # the sharp ghost, piling up
                    P.add("sharp", "ghost", t + 0.03, L / 8 * 0.7, cell[(j + rot) % 8], v=0.45 * env, p=-pan,
                          cents=14 + 14 * (t - 24) / 34.0)
    for bar in range(16):                                         # machine pulse, never varies
        for s16, hit in enumerate(euclid(9, 16)):
            if hit:
                P.add("tick", "tick", bar * 4 + s16 * 0.25, 0.03, None, v=0.22 * float(P.rng.uniform(0.6, 1.0)),
                      p=-0.4 if s16 % 2 else 0.4)
    P.add("bell", "bell", 0, 10, 50, v=0.8, tc=3.0)               # the last human bell
    return finish(P, lufs=-23.0, rev=(4.0, 0.6), dly=(0.75, 0.5, 3000.0, 0.55), pf=(520, 900, 1300, 900, 520),
                  over={"sharp": (0.3, 0.45, 0.0)},
                  notes="Four swarm voices (14, 15, 16, 17 cycles) realign at the loop point. No T except the lone bell.")


def build_master():
    """Fled to a yacht. Bright lounge in D major (the only F sharp here is the lie), then the third drops:
    the same tune in D minor, thinner, with one toll instead of sparkle."""
    P = mk("master", "Master of the Universe", 92, 16, "major", 4104)
    major = [(8, "Dmaj9", {2, 6, 9, 1, 4}, (), 38), (8, "Gmaj9", {7, 11, 2, 6, 9}, {1}, 31),
             (8, "Em9", {4, 7, 11, 2, 6}, (), 40), (8, "A7sus4", {9, 2, 4, 7}, {2, 11, 1, 6}, 33)]
    minor = [(8, "Dm9", {2, 5, 9, 0, 4}, (), 38), (8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
             (8, "Gm9", {7, 10, 2, 5, 9}, (), 31), (8, "A7sus4", {9, 2, 4, 7}, {5, 0}, 33)]
    set_chords(P, major + minor)
    prev = None
    for c in P.chords:                                            # upper voicing for the piano stabs (no bass note)
        upper = set(c["tones"]) - {c["bass"] % 12}
        c["keys"] = prev = voice_lead(prev, upper, 57, 76)
    for ph, steps in enumerate(CYC_T):                            # melody: T over each chord, major then minor
        stm(P, "melody", "ep", 8 * ph, steps, mode="major", v=0.85, p=0.18, decay=2.2)
        stm(P, "melody", "ep", 32 + 8 * ph, steps, mode="minor", v=0.8, p=0.18, decay=3.0, dark=0.7)
    for bt, m, dur in ((0, 64, 1), (1, 69, 1), (2, 74, 2)):
        addw(P, "melody", "ep", 24 + bt, dur * 0.97, m, v=0.85, p=0.18, decay=2.2)
        addw(P, "melody", "ep", 56 + bt, dur * 0.97, m, v=0.8, p=0.18, decay=3.0, dark=0.7)
    for c in P.chords:                                            # lounge comping and bass
        half = c["t"] >= 32
        for bar in range(2):
            t0 = c["t"] + 4 * bar
            stabs = [(0.5, 0.75, 0.55), (2.0, 0.75, 0.5), (3.5, 0.4, 0.45)]
            if half:
                stabs = [(0.5, 0.75, 0.3), (3.5, 0.4, 0.25)]
            for bt, dur, vel in stabs:
                for j, m in enumerate(c["keys"]):
                    P.add("ep", "ep", t0 + bt + 0.03 * j, dur, m, v=vel, p=-0.3 + 0.12 * j, decay=1.3,
                          dark=0.6 if half else 0.0)
            if not half:
                P.add("bass", "soft_bass", t0, 1.5, c["bass"], v=0.8)
                P.add("bass", "soft_bass", t0 + 2.5, 0.6, c["bass"] + 7, v=0.5)
                P.add("bass", "soft_bass", t0 + 3, 0.6, c["bass"], v=0.45)
            else:
                P.add("bass", "soft_bass", t0, 3.5, c["bass"], v=0.55)
    for blk in range(4):                                          # clave, then almost nothing
        t0 = 8 * blk
        hits = (0, 1.5, 3, 5, 6) if blk < 4 else ()
        for k, bt in enumerate(hits):
            if t0 < 32:
                P.add("tock", "tock", t0 + bt, 0.12, None, v=0.45, p=0.3 if k % 2 else -0.3)
    for t0 in (32, 40, 48, 56):
        P.add("tock", "tock", t0 + 2, 0.12, None, v=0.28, p=-0.2)
        P.add("tock", "tock", t0 + 6, 0.12, None, v=0.22, p=0.2)
    for bar in range(8):                                          # glitter on the water
        c = P.chord_at(bar * 4)
        pcs = sorted(c["tones"])
        m = next(x for x in range(79, 97) if x % 12 == pcs[(bar * 2) % len(pcs)])
        P.add("bell", "bell", bar * 4 + 1.5, 3, m, v=0.3, p=0.3 if bar % 2 else -0.3, tc=0.9, bright=1.3)
    P.add("bell", "bell", 32, 10, 50, v=0.8, tc=3.0)              # the toll
    P.add("bell", "bell", 56, 8, 57, v=0.5, tc=2.4)
    return finish(P, lufs=-21.0, rev=(2.6, 0.5), dly=(0.75, 0.42, 3000.0, 0.5), pf=(1100, 1400, 1100, 600, 500),
                  over={"bell": (0.5, 0.6, 0.25)}, master=dict(lp=10000.0),
                  notes="D major lounge for 8 bars, then the same tune with the third lowered, hollow.")


def build_whistle():
    """The biggest reform in a century. T rising a step each time (the only ending that may use the major
    third, F sharp, for real), a heartbeat that keeps getting stronger, and the full tune at the end."""
    P = mk("whistle", "The Whistleblower", 80, 16, "major", 4105)
    set_chords(P, [(8, "Dmaj9", {2, 6, 9, 1, 4}, (), 38), (8, "Aadd9", {9, 1, 4, 11}, {2, 6}, 33),
                   (8, "Bm9", {11, 2, 6, 9, 1}, {7}, 35), (8, "Gmaj9", {7, 11, 2, 6, 9}, {1}, 31),
                   (8, "Dmaj9", {2, 6, 9, 1, 4}, (), 38), (8, "Em9", {4, 7, 11, 2, 6}, {1}, 40),
                   (8, "A7sus4", {9, 2, 4, 7}, {11, 1, 6}, 33), (8, "Dmaj9", {2, 6, 9, 1, 4}, (), 38)])
    pad_layer(P, vel_fn=lambda t: 0.45 + 0.3 * t / 56.0, attack=1.4, rel=1.0)
    bass_roots(P, "sub", frac=0.9, vel_fn=lambda t: 0.6 + 0.3 * t / 56.0)
    for k, sh in enumerate([0, 1, 2, 3, 4, 5]):                   # each statement a step higher
        stm(P, "lead", "lead", 8 * k, T, mode="major", shift=sh, v=0.55 + 0.05 * k, p=0.05)
    for bt, m, dur in ((0, 76, 1), (1, 81, 1), (2, 86, 2)):       # E A D: the reach
        addw(P, "lead", "lead", 48 + bt, dur * 0.97, m, v=0.8, p=0.05)
    stm(P, "lead", "lead", 56, T, mode="major", v=0.9, p=0.05)    # the tune, whole and home
    stm(P, "lead2", "lead", 56, T, mode="major", octv=1, v=0.5, p=-0.15)
    stm(P, "bell", "bell", 56, T, mode="major", octv=1, v=0.55, d=6, tc=1.4, p=0.15)
    for k in range(8):                                            # bell on every chord root, growing
        c = P.chords[k]
        P.add("bell", "bell", c["t"], 6, c["bass"] + 36, v=0.35 + 0.04 * k, p=0.1, tc=1.5)
    for bar in range(16):                                         # heartbeat that gains strength
        lubdub(P, bar * 4, 0.3 + 0.5 * bar / 15.0)
        if bar >= 4:
            lubdub(P, bar * 4 + 2, 0.25 + 0.4 * bar / 15.0)
    for c in P.chords[3:]:                                        # glass arpeggio joins halfway
        ladder = sorted(m for m in range(57, 91) if m % 12 in c["tones"])
        start = next(i for i, m in enumerate(ladder) if m >= 62)
        for bar in range(2):
            for s in range(16):
                idx = min(start + [0, 1, 2, 3, 2, 1, 2, 4][s % 8], len(ladder) - 1)
                P.add("arp", "arp", c["t"] + 4 * bar + s * 0.25, 0.2, ladder[idx],
                      v=[0.85, 0.4, 0.55, 0.4][s % 4] * 0.5 * ramp(c["t"], [(24, 0.5), (56, 1.0)]),
                      p=0.22 if s % 2 else -0.22)
    ticker(P, lambda b: 0.0 if b < 4 else 0.4, k=7)
    P.add("riser", "riser", 56, 8, None, v=0.5)
    return finish(P, lufs=-20.0, rev=(3.0, 0.55), dly=(0.75, 0.4, 3200.0, 0.5),
                  pf=(800, 1000, 1300, 1600, 1800, 2000, 2200, 2400, 900),
                  notes="T rises one step per statement in D major, ends whole, doubled in octaves.")


def build_revolving():
    """The architects of the crisis are now in charge. The same four chords turn round and round, and T chases
    itself in canon, passing from ear to ear."""
    P = mk("revolving", "The Revolving Door", 76, 16, "minor", 4106)
    set_chords(P, CYCLE * 2)
    pad_layer(P, v=0.6, vel_fn=lambda t: 0.55 if t < 32 else 0.7, attack=1.4, rel=1.0)
    for r in range(2):
        for k, steps in enumerate(CYC_T):
            b = 32 * r + 8 * k
            stm(P, "melody", "ep", b, steps, v=0.8, p=-0.55 + 1.1 * (k % 2), decay=2.0)
            if r == 1:
                stm(P, "lead2", "ep", b + 1, steps, octv=-1, v=0.6, p=0.55 - 1.1 * (k % 2), decay=2.0)
                P.add("bell", "bell", b, 6, step_midi(74, "minor", steps[0]) + 12, v=0.4, p=0.3, tc=1.3)
        b = 32 * r + 24
        for bt, m, dur in ((0, 64, 1), (1, 69, 1), (2, 74, 2)):
            addw(P, "melody", "ep", b + bt, dur * 0.97, m, v=0.8, p=-0.55, decay=2.0)
            if r == 1:
                addw(P, "lead2", "ep", b + bt + 1, dur * 0.97, m - 12, v=0.6, p=0.55, decay=2.0)
    for bar in range(16):                                         # bass that keeps turning: euclid rotated each bar
        c = P.chord_at(bar * 4)
        hits = [i for i, h in enumerate(euclid(3, 8, rot=bar % 8)) if h]
        for j, i in enumerate(hits):
            P.add("bass", "soft_bass", bar * 4 + i * 0.5, 0.9, c["bass"] + (0, 7, 12)[j % 3], v=0.6)
        P.add("tock", "tock", bar * 4 + 2, 0.12, None, v=0.32, p=-0.4 + 0.8 * ((bar // 2) % 2))
    ticker(P, lambda b: 0.3, k=5)
    return finish(P, lufs=-21.0, rev=(3.0, 0.5), dly=(0.75, 0.45, 2800.0, 0.5), pf=(700, 900, 700),
                  notes="Canon of T, panning left and right each statement. Second pass adds the octave-down echo.")


def build_perp():
    """Handcuffs and cameras. A march, a heart that will not settle, flashes of ticker, and T turned upside down
    (high to low where it used to climb) with the falling fifth at the end."""
    P = mk("perp", "Perp Walk", 84, 16, "minor", 4107)
    set_chords(P, [(8, "Dm9", {2, 5, 9, 0, 4}, {7, 10}, 38), (8, "Gm9", {7, 10, 2, 5, 9}, (), 31),
                   (8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34), (8, "A7b9", {9, 1, 4, 7, 10}, {0, 5, 2}, 33)] * 2)
    pad_layer(P, v=0.55, attack=1.0, rel=0.8)
    bass_roots(P, "sub", v=0.7, frac=0.6)
    inv = [3, 0, -2, -1, 0]
    for r in range(2):
        for k, sh in enumerate([0, -3, -2]):
            stm(P, "lead", "lead", 32 * r + 8 * k, inv, shift=sh, v=0.7, p=0.05)
        addw(P, "bell", "bell", 32 * r + 24, 8, 62, v=0.6, tc=2.0)       # D ...
        addw(P, "bell", "bell", 32 * r + 28, 8, 57, v=0.55, tc=2.2)      # ... down to A
    for bar in range(16):
        t0 = bar * 4
        P.add("kick", "kick", t0, 0.5, None, v=0.85)
        P.add("kick", "kick", t0 + 2, 0.5, None, v=0.7)
        P.add("tock", "tock", t0 + 1, 0.12, None, v=0.55, p=-0.2)
        P.add("tock", "tock", t0 + 3, 0.12, None, v=0.5, p=0.2)
        if bar % 4 == 3:                                          # the cuffs
            P.add("tick", "clack", t0 + 3, 0.16, None, v=0.7, bright=0.9, p=-0.3)
            P.add("tick", "clack", t0 + 3.33, 0.16, None, v=0.5, bright=0.9, p=0.3)
        if bar >= 2 and bar % 3 != 0:                             # camera flashes: short bursts of ticker
            b = float(P.rng.choice([0.5, 1.5, 2.5, 3.5])) + float(P.rng.uniform(-0.05, 0.05))
            for j in range(4):
                P.add("tick", "tick", t0 + b + j * 0.125, 0.03, None, v=0.9 - 0.12 * j, p=-0.5 + 0.33 * j)
        if bar % 2 == 1:
            lubdub(P, t0 + 2.5, 0.35, layer="heart")
    return finish(P, lufs=-21.0, rev=(2.2, 0.4), dly=(0.75, 0.3, 3000.0, 0.35), pf=(700, 900, 700),
                  over={"heart": (0.5, 0.02, 0.0), "tick": (0.16, 0.1, 0.05)}, master=dict(lp=8800.0),
                  notes="March. T inverted on a saw lead. The cuffs click. D to A on a bell.")


def build_fall_guy():
    """A signature that was not theirs. T plays correctly for half the piece, then one note is wrong (E flat) and
    a thin, sharp voice echoes it from somewhere else."""
    P = mk("fall-guy", "The Fall Guy", 70, 16, "minor", 4108)
    set_chords(P, [(16, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Gm9", {7, 10, 2, 5, 9}, (), 31),
                   (16, "Bbmaj7", {10, 2, 5, 9}, {4}, 34), (16, "A7sus4", {9, 2, 4, 7}, (), 33)])
    pad_layer(P, v=0.55, attack=1.8, rel=1.2)
    bass_roots(P, "sub", v=0.65, frac=0.92)
    P.intentional = []
    for k in range(8):
        t0 = 8 * k
        ci = k // 2
        wrong = k >= 4
        if ci < 3:
            notes = [step_midi(74, "minor", x) for x in CYC_T[ci]]
        else:
            notes = [64, 69, 74, 72, 74][:3]
        for i, ((bt, dur), m) in enumerate(zip(RH, notes)):
            if wrong and i == 1:
                m += 1                                            # a semitone off: not their note
                P.intentional.append((round(t0 + bt, 4), m))
            P.add("melody", "ep", t0 + bt, dur * (1.4 if (wrong and i == 1) else 0.97), m, v=0.75, p=0.15, decay=2.0)
            if wrong and i in (1, 2):
                P.add("echo", "ghost", t0 + bt + 1.5, dur * 0.9, m, v=0.32, p=-0.4, cents=28)
        for j in range(3):                                        # pen scratch
            P.add("tick", "tick", t0 + j * 0.08, 0.03, None, v=0.5 - 0.1 * j, p=-0.3)
    for bar in range(16):
        if bar % 2 == 0:
            P.add("kick", "kick", bar * 4, 0.5, None, v=0.55)
        P.add("tock", "tock", bar * 4 + 2, 0.12, None, v=0.3, p=0.3)
    P.add("bell", "bell", 0, 8, 62, v=0.5, tc=2.0)
    P.add("bell", "bell", 32, 8, 62, v=0.6, tc=2.0)
    P.add("bell", "bell", 36, 8, 57, v=0.55, tc=2.4)
    return finish(P, lufs=-22.0, rev=(3.4, 0.6), dly=(0.75, 0.45, 2600.0, 0.5), pf=(600, 700, 600),
                  over={"echo": (0.36, 0.45, 0.25)}, master=dict(hiss=0.0015),
                  notes="Second half: E flat in place of D (on purpose), echoed by a sharp ghost voice.")


def build_cassandra():
    """She warned them and nothing changed. The same rising question is asked four times, louder each time,
    and it always ends up on A (the dominant); nothing ever answers it."""
    P = mk("cassandra", "Cassandra", 72, 16, "minor", 4109)
    rows = []
    for _ in range(4):
        rows += [(8, "Dm9/A", {2, 5, 9, 0, 4}, (), 33), (8, "A7sus4", {9, 2, 4, 7}, {5, 0}, 33)]
    set_chords(P, rows)
    pad_layer(P, vel_fn=lambda t: 0.4 + 0.15 * (t // 16), attack=1.6, rel=1.2)
    Q = [-3, 0, 2, 1, 4]                                          # T, but the last note leaves home for A
    for k in range(4):
        t0 = 16 * k
        stm(P, "lead", "lead", t0, Q, v=0.5 + 0.12 * k, p=0.05)
        if k >= 1:
            stm(P, "lead2", "ep", t0, Q, v=0.55 + 0.1 * k, p=-0.25, decay=2.0)
        if k >= 2:
            stm(P, "bell", "bell", t0, Q, octv=1, v=0.4 + 0.1 * (k - 2), d=6, tc=1.4, p=0.2)
    for bar in range(16):
        P.add("bass", "sub", bar * 4, 3.5, 45 if bar % 2 == 0 else 33, v=0.55)    # the dominant, as a floor
        if bar % 2 == 0:
            P.add("tock", "tock", bar * 4 + 2, 0.12, None, v=0.3, p=0.3)
    ticker(P, lambda b: 0.18, k=5)
    return finish(P, lufs=-22.0, rev=(3.0, 0.55), dly=(0.75, 0.4, 3000.0, 0.5), pf=(650, 800, 650),
                  notes="Four rising statements that end on the dominant. Bass is a dominant pedal. No answer.")


def build_acquirer():
    """The combined desk. T at half speed, low and heavy, played by two voices that begin out of tune with each
    other and tune into unison by the end."""
    P = mk("acquirer", "The Acquirer", 60, 16, "minor", 4110)
    set_chords(P, [(32, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Gm9", {7, 10, 2, 5, 9}, (), 31),
                   (16, "Dm9", {2, 5, 9, 0, 4}, (), 38)])
    pad_layer(P, v=0.6, lo=43, hi=66, attack=1.6, rel=1.2)
    bass_roots(P, "sub", v=0.8, frac=0.95)
    cents = [34, 22, 11, 0]
    for k, (t0, sh) in enumerate([(0, 0), (16, 0), (32, -4), (48, 0)]):
        stm(P, "lead", "lead", t0, T, rh=RH2, shift=sh, octv=-1, v=0.75, p=-0.05)
        stm(P, "double", "ghost", t0, T, rh=RH2, shift=sh, octv=-1, v=0.65, p=0.1, cents=cents[k])
        P.add("bell", "bell", t0, 10, 38 if sh == 0 else 31, v=0.7, tc=2.6, p=0.0)
    for k in range(32):
        P.add("kick", "kick", 2 * k, 0.5, None, v=0.6 if k % 2 == 0 else 0.5)
    for k in range(16):
        P.add("tock", "tock", 4 * k + 2, 0.12, None, v=0.3, p=-0.2 if k % 2 else 0.2)
    ticker(P, lambda b: 0.15, k=3)
    return finish(P, lufs=-21.0, rev=(3.2, 0.5), dly=(1.0, 0.35, 2400.0, 0.4), pf=(500, 650, 800, 650, 500),
                  over={"lead": (0.52, 0.3, 0.2), "double": (0.5, 0.3, 0.1)}, master=dict(lp=8000.0),
                  notes="Augmented T, two voices detuned by 34, 22, 11 then 0 cents: the desks merge.")


def build_ward():
    """Ward of the state. A chorale: T carried by the top voice over slow pad harmony, a metronome, and a
    closing chord that stays on D minor instead of reaching for the dominant."""
    P = mk("ward", "Ward of the State", 58, 16, "minor", 4111)
    set_chords(P, [(8, "Dm9", {2, 5, 9, 0, 4}, (), 38), (8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
                   (8, "Gm9", {7, 10, 2, 5, 9}, (), 31), (8, "Dm9", {2, 5, 9, 0, 4}, (), 38)] * 2)
    pad_layer(P, v=0.68, lo=46, hi=71, attack=0.9, rel=0.9, extra=0.3)
    bass_roots(P, "sub", v=0.7, frac=0.97)
    for r in range(2):
        for k, steps in enumerate([CYC_T[0], CYC_T[1], CYC_T[2], T]):
            b = 32 * r + 8 * k
            stm(P, "lead", "lead", b, steps, v=0.42 if r == 0 else 0.5, ds=1.0, p=0.0)
            if r == 1:
                stm(P, "bell", "bell", b, steps, octv=1, v=0.35, d=5, tc=1.3, p=0.1)
    for k in range(32):
        P.add("tock", "tock", 2 * k, 0.12, None, v=0.36, p=0.0)
    return finish(P, lufs=-22.0, rev=(3.6, 0.6), dly=(1.0, 0.3, 2400.0, 0.35), pf=(700, 900, 700),
                  over={"lead": (0.44, 0.45, 0.15)}, notes="Chorale. T on top, metronome below, resolves home.")


def build_clawback():
    """Bonus seized, forty cents on the dollar. A bright, fast party, then notes are taken away at random until
    only about 40 percent of the music is left."""
    P = mk("clawback", "Clawback", 100, 24, "minor", 4112)
    set_chords(P, CYCLE * 3)
    pad_layer(P, v=0.6)
    for c in P.chords:                                            # bass: driving eighths
        for s in range(0, int(c["d"] * 2)):
            if s % 4 in (0, 3):
                P.add("bass", "sub", c["t"] + s * 0.5, 0.45, c["bass"] + (12 if s % 8 == 7 else 0), v=0.8 if s % 4 == 0 else 0.6)
    cyc_statements(P, "lead", "lead", 0, 3, v=0.75)
    cyc_statements(P, "lead2", "lead", 0, 3, octv=1, v=0.4, p=-0.2)
    prev = None
    for c in P.chords:                                            # piano chops
        upper = set(c["tones"]) - {c["bass"] % 12}
        prev = voice_lead(prev, upper, 57, 76)
        for bar in range(int(c["d"] // 4)):
            for bt, dur, vel in ((0.5, 0.5, 0.7), (1.5, 0.5, 0.5), (3, 0.75, 0.6)):
                for j, m in enumerate(prev):
                    P.add("ep", "ep", c["t"] + 4 * bar + bt + 0.02 * j, dur, m, v=vel, p=-0.3 + 0.12 * j, decay=1.0)
        ladder = sorted(m for m in range(57, 89) if m % 12 in c["tones"])
        start = next(i for i, m in enumerate(ladder) if m >= 64)
        for bar in range(int(c["d"] // 4)):
            for s in range(16):
                idx = min(start + [0, 1, 2, 3, 2, 1][s % 6], len(ladder) - 1)
                P.add("arp", "arp", c["t"] + 4 * bar + s * 0.25, 0.2, ladder[idx], v=[0.9, 0.45, 0.62, 0.45][s % 4] * 0.7,
                      p=0.22 if s % 2 else -0.22)
    for bar in range(24):
        for bt in (0, 1, 2, 3):
            P.add("kick", "kick", bar * 4 + bt, 0.5, None, v=0.8 if bt % 2 == 0 else 0.6)
        P.add("tock", "tock", bar * 4 + 1, 0.12, None, v=0.55, p=-0.3)
        P.add("tock", "tock", bar * 4 + 3, 0.12, None, v=0.5, p=0.3)
    for k in range(9):
        P.add("bell", "bell", 8 * k, 6, (74, 77, 74)[k % 3], v=0.6, p=0.12, tc=1.4)
    ticker(P, lambda b: 0.6, k=7)
    rng = np.random.default_rng(4120)                             # the seizure: keep-probability falls to 0.4
    keep = lambda t: ramp(t, [(44, 1.0), (72, 0.4), (96, 0.4)])
    thin = {"lead", "lead2", "ep", "arp", "kick", "tock", "tick", "bell"}
    P.events = [e for e in P.events if not (e["l"] in thin and e["t"] >= 44 and rng.random() > keep(e["t"]))]
    return finish(P, lufs=-20.0, rev=(2.4, 0.5), dly=(0.75, 0.4, 3200.0, 0.5), pf=(900, 1400, 1800, 1200, 700, 500, 450, 500, 900),
                  notes="Festive for 11 bars, then events are removed at random: 100 percent down to 40 percent.")


def build_fund():
    """Their own firm. D dorian, driving four-on-the-floor, T climbing with confidence, and it lands on an open fifth
    (no third): it is a start, not a happy ending."""
    P = mk("fund", "The Fund", 96, 16, "dorian", 4113)
    cyc = [(8, "Dm9", {2, 5, 9, 0, 4}, (), 38), (8, "G9", {7, 11, 2, 5, 9}, (), 31),
           (8, "Dm9", {2, 5, 9, 0, 4}, (), 38), (8, "Cmaj9", {0, 4, 7, 11, 2}, (), 36)]
    rows = cyc + cyc[:3] + [(8, "D5", {2, 9}, (), 38)]
    set_chords(P, rows)
    pad_layer(P, v=0.62, vel_fn=lambda t: 0.5 if t < 32 else 0.65)
    bass_roots(P, "sub", v=0.8, frac=0.5)
    for c in P.chords[:-1]:
        for s in range(int(c["d"] * 2)):
            P.add("bass", "sub", c["t"] + s * 0.5, 0.4, c["bass"] + (12 if s % 8 == 7 else 0), v=0.75 if s % 2 == 0 else 0.5)
    for r in range(2):
        b = 32 * r
        for k, (sh, nt) in enumerate([(0, T), (3, T), (0, T), (-1, T)]):
            if r == 1 and k == 3:
                continue
            stm(P, "lead", "lead", b + 8 * k, nt, shift=sh, v=0.7 + 0.1 * r, p=0.05)
            if r == 1:
                stm(P, "lead2", "lead", b + 8 * k, nt, shift=sh, octv=1, v=0.4, p=-0.2)
    addw(P, "bell", "bell", 56, 8, 69, v=0.7, p=0.1, tc=2.0)       # A ...
    addw(P, "bell", "bell", 57, 8, 74, v=0.8, p=0.1, tc=2.4)       # ... up to D: the reward motif
    for bar in range(14):
        for bt in range(4):
            P.add("kick", "kick", bar * 4 + bt, 0.5, None, v=0.85 if bt == 0 else 0.65)
        P.add("tock", "tock", bar * 4 + 1.5, 0.12, None, v=0.42, p=0.3)
        P.add("tock", "tock", bar * 4 + 3.5, 0.12, None, v=0.4, p=-0.3)
    for c in P.chords[:-1]:
        ladder = sorted(m for m in range(57, 89) if m % 12 in c["tones"])
        start = next(i for i, m in enumerate(ladder) if m >= 62)
        for bar in range(int(c["d"] // 4)):
            for s in range(8):
                idx = min(start + [0, 2, 1, 3, 2, 4, 3, 2][s], len(ladder) - 1)
                P.add("arp", "arp", c["t"] + 4 * bar + s * 0.5, 0.35, ladder[idx], v=[0.85, 0.5][s % 2] * 0.55, p=0.22 if s % 2 else -0.22)
    ticker(P, lambda b: 0.4 if b < 14 else 0.0, k=7)
    return finish(P, lufs=-20.0, rev=(2.4, 0.45), dly=(0.75, 0.4, 3200.0, 0.5), pf=(800, 1100, 1500, 1200, 900, 1400, 1800, 1100, 700),
                  notes="D dorian. Driving. Last chord is a bare fifth, D and A.")


def build_right_early():
    """Correct short, diminished payoff. T arrives half a beat early every time, each statement smaller than the
    last, and the reward motif A up to D shows up at the end as a whisper."""
    P = mk("right-early", "Right, Too Early", 88, 16, "minor", 4114)
    set_chords(P, CYCLE * 2)
    pad_layer(P, v=0.55, vel_fn=lambda t: 0.6 - 0.1 * t / 56.0)
    early = [(b - 0.5, d) for b, d in RH]
    vels = [0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.28]
    for k in range(8):
        steps = (CYC_T + [[-3, 0, 2]])[k % 4] if k % 4 < 3 else [-3, 0, 2]
        n_keep = 5 if k < 6 else 3
        r = k // 4
        if k % 4 < 3:
            stm(P, "melody", "ep", 8 * k, steps[:n_keep], rh=early, ds=max(0.5, 0.97 - 0.06 * k), v=vels[k], p=0.15, decay=2.0)
        else:
            for bt, m, dur in ((-0.5, 69, 1), (0.5, 74, 3)):
                addw(P, "melody", "ep", 8 * k + bt, dur * max(0.5, 0.97 - 0.06 * k), m, v=vels[k], p=0.15, decay=2.0)
    for c in P.chords:                                            # bass also early
        P.add("bass", "soft_bass", (c["t"] - 0.5) % P.loop_beats, 1.5, c["bass"], v=0.75)
        P.add("bass", "soft_bass", c["t"] + 2.5, 0.6, c["bass"] + 7, v=0.45)
        P.add("bass", "soft_bass", c["t"] + 4.5, 1.25, c["bass"], v=0.55)
    for bar in range(16):
        for i, h in enumerate(euclid(3, 8, rot=bar % 8)):
            if h:
                P.add("kick", "kick", bar * 4 + i * 0.5, 0.5, None, v=0.6 * (1.0 - 0.4 * bar / 15.0))
        P.add("tock", "tock", bar * 4 + 1.5, 0.12, None, v=0.4, p=0.3)
        P.add("tock", "tock", bar * 4 + 3.5, 0.12, None, v=0.3, p=-0.3)
    addw(P, "bell", "bell", 58, 8, 69, v=0.28, tc=2.0, p=0.1)     # A ...
    addw(P, "bell", "bell", 59, 8, 74, v=0.3, tc=2.4, p=0.1)      # ... D, but small
    ticker(P, lambda b: 0.3 * (1 - 0.5 * b / 15.0), k=5)
    return finish(P, lufs=-22.0, rev=(3.0, 0.5), dly=(0.75, 0.4, 2800.0, 0.5), pf=(700, 850, 700),
                  notes="Every statement starts half a beat early; velocity falls through the loop.")


def build_everything_rally():
    """Assets recover, life does not. F lydian on top, shiny and bright; a hollow D underneath that never moves."""
    P = mk("everything-rally", "The Everything Rally", 96, 16, "lydian", 4115, tonic=77)
    cyc = [(8, "Fmaj9/D", {2, 5, 9, 0, 4, 7}, (), 38), (8, "Gadd9/D", {7, 11, 2, 9}, {4, 0}, 38),
           (8, "Cadd9/D", {0, 4, 7, 2}, {9, 5}, 38), (8, "Fmaj9/D", {2, 5, 9, 0, 4, 7}, (), 38)]
    set_chords(P, cyc * 2)
    for c in P.chords:
        c["voicing"] = set(c["tones"]) - {2} if len(c["tones"]) > 4 else c["tones"]
    pad_layer(P, v=0.4, lo=53, hi=76, attack=1.2, rel=1.0)
    bass_roots(P, "sub", v=0.7, frac=0.97)
    P.add("drone", "drone", 0, 34, 38, v=0.45)
    P.add("drone", "drone", 30, 36, 38, v=0.45)
    P.add("drone", "drone", 0, 34, 45, v=0.3)
    P.add("drone", "drone", 30, 36, 45, v=0.3)
    for r in range(2):
        for k, sh in enumerate([0, 1, 4, 0]):
            b = 32 * r + 8 * k
            stm(P, "lead", "lead", b, T, tonic=77, mode="lydian", shift=sh, v=0.6 + 0.1 * r, p=0.05)
            if r == 1:
                stm(P, "lead2", "lead", b, T, tonic=77, mode="lydian", shift=sh, octv=1, v=0.4, p=-0.2)
                stm(P, "bell", "bell", b, T, tonic=77, mode="lydian", shift=sh, octv=1, v=0.4, d=5, tc=1.0, p=0.2, bright=1.6)
    for c in P.chords:
        ladder = sorted(m for m in range(64, 97) if m % 12 in (c["tones"] - {2}))
        for bar in range(2):
            for s in range(16):
                idx = [0, 1, 2, 3, 2, 1, 3, 4][s % 8] % len(ladder)
                P.add("arp", "arp", c["t"] + 4 * bar + s * 0.25, 0.2, ladder[idx], v=[0.8, 0.4, 0.55, 0.4][s % 4] * 0.5,
                      p=0.22 if s % 2 else -0.22)
    for bar in range(16):
        c = P.chord_at(bar * 4)
        pcs = sorted(c["tones"] - {2})
        m = next(x for x in range(84, 100) if x % 12 == pcs[(bar * 3) % len(pcs)])
        P.add("bell", "bell", bar * 4 + 1.5, 3, m, v=0.3, p=0.3 if bar % 2 else -0.3, tc=0.9, bright=1.6)
    ticker(P, lambda b: 0.35, k=7)
    return finish(P, lufs=-21.0, rev=(2.6, 0.55), dly=(0.75, 0.45, 3400.0, 0.55), pf=(600, 900, 600),
                  master=dict(lp=11000.0),
                  notes="F lydian over a D pedal. The bass and drone never move. No kick: no pulse.")


def build_lost_decade():
    """No depression, no recovery. One chord for the whole loop, a worn tape, two copies of a small ostinato that
    slowly slip apart, a commute that never changes, and a tune that keeps starting and never finishes."""
    P = mk("lost-decade", "The Lost Decade", 66, 16, "minor", 4116)
    set_chords(P, [(64, "Dm9", {2, 5, 9, 0, 4}, (), 38)])
    pad_layer(P, v=0.5, attack=2.0, rel=1.5, extra=0.2)
    cell = [69, 74, 77, 76, 74, 72, 69, 72]
    acc = [1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]
    for cyc in range(16):
        for j, m in enumerate(cell):
            P.add("osc_a", "ep", cyc * 4 + j * 0.5, 0.5, m, v=0.5 * acc[j], p=-0.55, decay=0.9, dark=0.4)
    pb = 64.0 / 15.0
    for cyc in range(15):
        for j, m in enumerate(cell):
            P.add("osc_b", "ep", cyc * pb + j * (pb / 8), pb / 8, m, v=0.5 * acc[j], p=0.55, decay=0.9, dark=0.4)
    for bar in range(16):
        P.add("bass", "soft_bass", bar * 4, 3.0, 38, v=0.55 if bar % 2 == 0 else 0.4)
        P.add("train", "clack", bar * 4 + 2, 0.16, None, v=0.45, bright=0.4, p=-0.2)
        P.add("train", "clack", bar * 4 + 2.33, 0.16, None, v=0.3, bright=0.7, p=-0.2)
    for t0 in (6, 22, 38, 54):                                    # T starts and stops: A D F ...
        stm(P, "bell", "bell", t0, T[:3], d=6, tc=1.3, v=0.4, p=0.2)
    return finish(P, lufs=-23.0, rev=(2.6, 0.5), dly=(0.75, 0.5, 2600.0, 0.5), pf=(500, 560, 500),
                  master=dict(lp=6500.0, hiss=0.0035, crackle=0.0007, wobble=dict(cycles=25, depth_ms=2.2), sat=1.25),
                  notes="Single chord. Two ostinato copies 16 and 15 cycles: they realign at the loop point.")


def build_soft():
    """Soft landing. D major, slow, a bass that steps down a stair at a time and then turns home."""
    P = mk("soft", "Soft Landing", 72, 16, "major", 4117)
    rows = [(8, "Dmaj9", {2, 6, 9, 1, 4}, (), 50), (8, "Aadd9/C#", {9, 1, 4, 11}, {2, 6}, 49),
            (8, "Bm9", {11, 2, 6, 9, 1}, (), 47), (8, "A6/9", {9, 1, 4, 11, 6}, {2}, 45),
            (8, "Gmaj9", {7, 11, 2, 6, 9}, {1}, 43), (8, "Dmaj9/F#", {2, 6, 9, 1, 4}, (), 42),
            (8, "Em9", {4, 7, 11, 2, 6}, {1}, 40), (8, "A7sus4", {9, 2, 4, 7}, {11, 1, 6}, 45)]
    set_chords(P, rows)
    pad_layer(P, v=0.5, attack=1.6, rel=1.2)
    bass_roots(P, "soft_bass", v=0.65, frac=0.9)
    for t0, sh in ((0, 0), (16, -2), (32, -4), (48, 1)):
        stm(P, "melody", "ep", t0, T, mode="major", shift=sh, v=0.7, p=0.15, decay=2.6)
    prev = None
    for c in P.chords:
        upper = set(c["tones"]) - {c["bass"] % 12}
        prev = voice_lead(prev, upper, 57, 76)
        for bar in range(2):
            for bt, dur, vel in ((0, 1.5, 0.45), (2.5, 1.0, 0.3)):
                for j, m in enumerate(prev):
                    P.add("ep", "ep", c["t"] + 4 * bar + bt + 0.04 * j, dur, m, v=vel, p=-0.3 + 0.15 * j, decay=1.8, dark=0.2)
    for bar in range(8):
        c = P.chord_at(bar * 8)
        pcs = sorted(c["tones"])
        m = next(x for x in range(79, 97) if x % 12 == pcs[(bar * 2 + 1) % len(pcs)])
        P.add("bell", "bell", bar * 8 + 3.5, 4, m, v=0.3, p=0.3 if bar % 2 else -0.3, tc=1.2)
    for bar in range(16):
        P.add("tock", "tock", bar * 4 + 2, 0.12, None, v=0.22, p=0.2 if bar % 2 else -0.2)
    ticker(P, lambda b: 0.16, k=3)
    return finish(P, lufs=-22.0, rev=(3.2, 0.55), dly=(0.75, 0.42, 2800.0, 0.5), pf=(700, 900, 1100, 900, 700),
                  master=dict(lp=9000.0),
                  notes="D major. Bass steps down D C# B A G F# E, then A back to D.")


def build_quiet():
    """A silent fortune. Almost nothing: a soft pad, a far-away drone, and T rung very quietly, twice, on a bell."""
    P = mk("quiet", "The Quiet Fortune", 60, 16, "minor", 4118)
    set_chords(P, [(32, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Gm9", {7, 10, 2, 5, 9}, (), 31),
                   (16, "Dm9", {2, 5, 9, 0, 4}, (), 38)])
    pad_layer(P, v=0.32, attack=3.0, rel=2.0, extra=0.4)
    stm(P, "bell", "bell", 16, T, d=8, tc=2.0, v=0.35, p=0.1)
    stm(P, "bell", "bell", 48, T[:4], d=8, tc=2.0, v=0.28, p=-0.1)
    P.add("bell", "bell", 60, 8, 69, v=0.22, p=0.0, tc=2.4)       # A ... (it would step up to D on the next loop)
    P.add("drone", "drone", 0, 34, 38, v=0.4)
    P.add("drone", "drone", 30, 34, 38, v=0.4)
    for bar in range(16):
        if bar % 4 == 1:
            P.add("tick", "tick", bar * 4 + 2, 0.03, None, v=0.22, p=0.3)
    return finish(P, lufs=-25.0, rev=(4.6, 0.7), dly=(1.0, 0.45, 2400.0, 0.5), pf=(480, 600, 480),
                  notes="Pad, drone and a soft bell. The quietest piece in the set.")


def build_replaced():
    """The firm's model survived better. People play T at the start: piano, pad, a bell. A grid takes over
    (glass arpeggio, euclidean ticker, straight kick) and the humans drop out; at the end the machine recites T exactly."""
    P = mk("replaced", "Replaced", 100, 16, "minor", 4119)
    set_chords(P, CYCLE * 2)
    pad_layer(P, vel_fn=lambda t: ramp(t, [(0, 0.7), (32, 0.5), (48, 0.2), (64, 0.2)]), attack=1.2, rel=1.0)
    bass_roots(P, "sub", v=0.7, frac=0.96)
    for k, steps in enumerate(CYC_T):                             # the people
        t0 = 8 * k
        for i, (bt, dur) in enumerate(RH):
            if i >= len(steps):
                break
            P.add("melody", "ep", max(0.0, t0 + bt + float(P.rng.uniform(-0.03, 0.03))), dur * 0.97, step_midi(74, "minor", steps[i]),
                  v=0.8 * float(P.rng.uniform(0.9, 1.05)), p=0.15, decay=2.0)
    prev = None
    for c in P.chords[:4]:
        upper = set(c["tones"]) - {c["bass"] % 12}
        prev = voice_lead(prev, upper, 57, 76)
        for bar in range(2):
            for bt, dur, vel in ((0, 1.25, 0.7), (1.75, 0.75, 0.45), (3, 1.0, 0.55)):
                for j, m in enumerate(prev):
                    P.add("ep", "ep", max(0.0, c["t"] + 4 * bar + bt + 0.03 * j + float(P.rng.uniform(-0.012, 0.012))), dur, m,
                          v=vel * float(P.rng.uniform(0.92, 1.05)), p=-0.3 + 0.12 * j, decay=1.4)
    P.add("bell", "bell", 0, 6, 62, v=0.8, tc=2.2)
    P.add("bell", "bell", 8, 6, 65, v=0.5, tc=1.6)
    for c in P.chords:                                            # the machine, arriving bar by bar
        ladder = sorted(m for m in range(57, 89) if m % 12 in c["tones"])
        start = next(i for i, m in enumerate(ladder) if m >= 62)
        for bar in range(int(c["d"] // 4)):
            tb = c["t"] + 4 * bar
            g = ramp(tb, [(8, 0.0), (32, 1.0), (64, 1.0)])
            if g <= 0.02:
                continue
            for s in range(16):
                idx = min(start + [0, 1, 2, 3, 2, 1, 2, 3][s % 8], len(ladder) - 1)
                P.add("arp", "arp", tb + s * 0.25, 0.2, ladder[idx], v=[0.9, 0.45, 0.62, 0.45][s % 4] * 0.65 * g,
                      p=0.22 if s % 2 else -0.22)
    for bar in range(16):
        g = ramp(bar * 4, [(8, 0.0), (24, 1.0)])
        if g > 0.02:
            for bt in range(4):
                P.add("kick", "kick", bar * 4 + bt, 0.5, None, v=(0.75 if bt == 0 else 0.6) * g)
            for i, h in enumerate(euclid(5, 16, rot=0)):
                if h:
                    P.add("tock", "tock", bar * 4 + i * 0.25, 0.12, None, v=0.35 * g, p=-0.2 if i % 2 else 0.2)
    ticker(P, lambda b: 0.2 + 0.4 * min(1.0, b / 8.0), k=7, rot=0)
    for bt, dur, st in ((0, 1, -3), (1, 1, 0), (2, 2, 2), (4, 1, 1), (5, 3, 0)):   # the machine's T: exact, glass
        P.add("arp", "arp", 56 + bt, dur * 0.4, step_midi(74, "minor", st), v=0.7, p=0.0)
        P.add("arp", "arp", 56 + bt, dur * 0.4, step_midi(74, "minor", st) - 12, v=0.5, p=0.0)
    return finish(P, lufs=-21.0, rev=(2.0, 0.4), dly=(0.75, 0.4, 3400.0, 0.45), pf=(800, 900, 800),
                  over={"tick": (0.12, 0.08, 0.05)},
                  notes="Humans (piano, bell, pad) first, machine (arp, kick, euclid) takes over; the machine ends on an exact T.")


def build_depression():
    """Fourteen percent unemployment, the data centres dark. Everything that is playing is taken away a layer at a
    time until a bell tolls T upside down, four times as slowly, over a drone. The last light goes out."""
    P = mk("depression", "The Depression", 54, 16, "minor", 4120)
    set_chords(P, [(16, "Dm9", {2, 5, 9, 0, 4}, (), 38), (16, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
                   (16, "Gm9", {7, 10, 2, 5, 9}, (), 31), (16, "A7sus4", {9, 2, 4, 7}, (), 33)])
    # (layer -> beat at which it stops): pad 40, bass 24, ep 16, ticker 8
    for c in P.chords:
        if c["t"] < 40:
            vo = voice_lead(None, c["tones"], 50, 71)
            c["pad"] = vo
            for m in vo:
                P.add("pad", "pad", c["t"], min(c["d"], 40 - c["t"]) + 0.3, m, v=0.65 - 0.008 * c["t"], attack=1.6, rel=2.0)
    for c in P.chords:
        if c["t"] < 24:
            P.add("bass", "sub", c["t"], min(c["d"], 24 - c["t"]) * 0.95, c["bass"], v=0.7)
    prev = None
    for c in P.chords[:1]:
        upper = set(c["tones"]) - {c["bass"] % 12}
        prev = voice_lead(prev, upper, 57, 76)
        for bar in range(4):
            for bt, dur, vel in ((0, 2.0, 0.5 - 0.06 * bar), (2.5, 1.2, 0.3 - 0.04 * bar)):
                for j, m in enumerate(prev):
                    P.add("ep", "ep", bar * 4 + bt + 0.05 * j, dur, m, v=vel, p=-0.3 + 0.15 * j, decay=2.2, dark=0.6 + 0.08 * bar)
    ticker(P, lambda b: 0.3 * (1 - b / 3.0) if b < 3 else 0.0, k=lambda b: [7, 5, 3][b] if b < 3 else 0)
    for bt, m in ((0, 79), (16, 74), (32, 70), (48, 72), (60, 74)):      # T inverted and four times as slow
        P.add("bell", "bell", bt, 14, m, v=0.6, p=0.1, tc=2.4)
    P.add("bell", "bell", 56, 10, 62, v=0.5, p=0.0, tc=2.8)       # D ...
    P.add("bell", "bell", 62, 10, 57, v=0.5, p=0.0, tc=3.0)       # ... falling to A
    P.add("drone", "drone", 0, 34, 38, v=0.55)
    P.add("drone", "drone", 30, 36, 38, v=0.55)
    P.add("drone", "drone", 0, 34, 45, v=0.4)
    P.add("drone", "drone", 30, 36, 45, v=0.4)
    P.add("tremor", "tremor", 40, 3.5, None, v=0.6)
    return finish(P, lufs=-23.0, rev=(4.6, 0.75), dly=(0.75, 0.4, 2200.0, 0.45), pf=(650, 560, 480, 420, 650),
                  master=dict(lp=7200.0),
                  notes="Ticker gone at beat 8, piano 16, bass 24, pad 40. Left: drone and the slow inverted T.")


def build_exit():
    """Left quietly. A walking tempo: footsteps in the left and right ear that move away, T played softly and then
    in pieces, the ticker tape fading out behind."""
    P = mk("exit", "Quiet Exit", 92, 16, "minor", 4121)
    set_chords(P, CYCLE * 2)
    pad_layer(P, vel_fn=lambda t: ramp(t, [(0, 0.45), (40, 0.55), (64, 0.35)]), attack=1.4, rel=1.0)
    for c in P.chords:                                            # walking bass
        r = c["bass"]
        for bar in range(2):
            for j, off in enumerate((0, 7, 12, 7)):
                P.add("bass", "soft_bass", c["t"] + 4 * bar + j, 0.9, r + off, v=0.6 - 0.1 * (j % 2))
    prev = None
    for k, steps in enumerate(CYC_T):
        for r in range(2):
            t0 = 32 * r + 8 * k
            n_keep = 5 if r == 0 else [3, 2, 2][k]
            stm(P, "melody", "ep", t0, steps[:n_keep], v=0.75 - 0.25 * r, p=0.15 - 0.6 * r, decay=2.2)
    for bt, m, dur in ((0, 64, 1), (1, 69, 1), (2, 74, 2)):
        addw(P, "melody", "ep", 24 + bt, dur * 0.97, m, v=0.75, p=0.15, decay=2.2)
    P.add("bell", "bell", 56, 10, 74, v=0.45, p=0.2, tc=2.4)
    for beat in range(56):                                        # footsteps: alternate ears, drifting right, fading
        P.add("tock", "tock", beat, 0.12, None, v=0.5 * ramp(beat, [(0, 0.7), (16, 1.0), (56, 0.15)]),
              p=(-0.4 if beat % 2 else 0.4) + ramp(beat, [(0, 0), (56, 0.5)]))
    ticker(P, lambda b: ramp(b, [(0, 0.15), (3, 0.6), (12, 0.0)]) if b < 12 else 0.0, k=lambda b: 7 if b < 6 else 4)
    return finish(P, lufs=-22.0, rev=(2.8, 0.5), dly=(0.75, 0.35, 2800.0, 0.4), pf=(700, 900, 700),
                  notes="Walking bass and footsteps moving off. Second pass plays less of T each time.")


def build_grind():
    """Survived; life goes on. Nothing rises and nothing falls: T plain, a heart that beats evenly, a clock, a
    commute. The steadiest piece in the set."""
    P = mk("grind", "The Grind", 84, 16, "minor", 4122)
    set_chords(P, CYCLE * 2)
    pad_layer(P, v=0.55, attack=1.2, rel=0.9)
    bass_roots(P, "sub", v=0.7, frac=0.9)
    for r in range(2):
        for k, steps in enumerate(CYC_T):
            stm(P, "melody", "ep", 32 * r + 8 * k, steps, v=0.7, p=0.15, decay=1.8)
        for bt, m, dur in ((0, 64, 1), (1, 69, 1), (2, 74, 2)):
            addw(P, "melody", "ep", 32 * r + 24 + bt, dur * 0.97, m, v=0.7, p=0.15, decay=1.8)
    for bar in range(16):
        lubdub(P, bar * 4, 0.6)
        lubdub(P, bar * 4 + 2, 0.5)
        P.add("tock", "tock", bar * 4 + 1, 0.12, None, v=0.38, p=-0.3)
        P.add("tock", "tock", bar * 4 + 3, 0.12, None, v=0.34, p=0.3)
        P.add("train", "clack", bar * 4 + 2, 0.16, None, v=0.4, bright=0.4, p=-0.2)
        P.add("train", "clack", bar * 4 + 2.33, 0.16, None, v=0.28, bright=0.7, p=-0.2)
    ticker(P, lambda b: 0.3, k=5)
    for t0 in (0, 32):
        P.add("bell", "bell", t0, 6, 62, v=0.45, tc=1.6)
    return finish(P, lufs=-22.0, rev=(2.4, 0.45), dly=(0.75, 0.35, 2800.0, 0.4), pf=(700, 760, 700),
                  notes="T plain, twice. A regular heartbeat and a clock. No build, no fall.")


BUILDERS = {
    "wiped": build_wiped, "fired": build_fired, "nobody": build_nobody, "master": build_master,
    "whistle": build_whistle, "revolving": build_revolving, "perp": build_perp, "fall-guy": build_fall_guy,
    "cassandra": build_cassandra, "acquirer": build_acquirer, "ward": build_ward, "clawback": build_clawback,
    "fund": build_fund, "right-early": build_right_early, "everything-rally": build_everything_rally,
    "lost-decade": build_lost_decade, "soft": build_soft, "quiet": build_quiet, "replaced": build_replaced,
    "depression": build_depression, "exit": build_exit, "grind": build_grind,
}

# notes outside the key that are there on purpose (declared so the theory check can say so)
CHROMATIC_OK = {
    "master": {5, 0, 10}, "fall-guy": set(), "fund": set(), "perp": {1}, "right-early": set(),
    "everything-rally": set(), "whistle": set(),
}
