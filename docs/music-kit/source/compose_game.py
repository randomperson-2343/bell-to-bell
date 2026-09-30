"""
compose_game.py - "Market Hours", the trading-day theme. Four acts, each a 32-bar loop.

The track is ADAPTIVE. Every layer has an intensity curve (0 to 1). The game sets one number, intensity,
and each layer fades in or out along its curve. Calm market = pulse, ticker tape, pad. Tense market = arp, lead, drive.

Harmony is the menu's (D minor, Dm9 Bbmaj7 Gm9 A7) so the game sounds like the same world.
"""
import numpy as np
from compose import Piece, step_midi, voice_lead, euclid, name

GAME_TONIC = 74          # D5, same as the menu
BPM = {1: 112, 2: 112, 3: 120, 4: 84}
KEYS = {1: "gameplay_act1_melt_up", 2: "gameplay_act2_tremors", 3: "gameplay_act3_contagion", 4: "gameplay_act4_reckoning"}
TITLES = {1: "Market Hours - Act I (Melt-Up)", 2: "Market Hours - Act II (Tremors)",
          3: "Market Hours - Act III (Contagion)", 4: "Market Hours - Act IV (Reckoning)"}

T_RHYTHM = [(0, 1), (1, 1), (2, 2), (4, 1), (5, 3)]


def cycle_for(act):
    """(start beat, length, name, chord tones as pitch classes, extra allowed pcs, bass MIDI). 32 beats per cycle."""
    if act == 1:
        return [(0, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
                (8, 8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
                (16, 8, "Gm9", {7, 10, 2, 5, 9}, set(), 31),
                (24, 4, "A7sus4", {9, 2, 4, 7}, set(), 33),
                (28, 4, "A7b9", {9, 1, 4, 7, 10}, set(), 33)]
    if act == 2:
        return [(0, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
                (8, 8, "Bbmaj7#11", {10, 2, 5, 9, 4}, set(), 34),
                (16, 4, "Gm9", {7, 10, 2, 5, 9}, set(), 31),
                (20, 4, "Em7b5", {4, 7, 10, 2}, {5, 0}, 40),
                (24, 8, "A7b9", {9, 1, 4, 7, 10}, set(), 33)]
    if act == 3:     # a D pedal under two chords: the ground never moves, the colour above it does
        return [(0, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
                (8, 8, "Ebmaj7/D", {3, 7, 10, 2}, set(), 38),
                (16, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
                (24, 8, "Ebmaj7/D", {3, 7, 10, 2}, set(), 38)]
    return [(0, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
            (8, 8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),
            (16, 8, "Gm9", {7, 10, 2, 5, 9}, set(), 31),
            (24, 8, "A7b9", {9, 1, 4, 7, 10}, set(), 33)]


def build_game(act):
    assert act in (1, 2, 3, 4)
    P = Piece(KEYS[act], TITLES[act], bpm=BPM[act], bars=32, tonic=GAME_TONIC, mode="minor", seed=300 + act)
    P.act = act
    rng = P.rng
    cyc = cycle_for(act)
    for c_i in range(4):
        for (s, d, nm, tones, ok, bass) in cyc:
            P.chords.append({"t": c_i * 32 + s, "d": d, "name": nm, "tones": tones, "ok": ok, "bass": bass})

    # ---------------- voicings: pad (low, wide) and keys (upper, without the bass note)
    prev_pad, prev_key = None, None
    for c in P.chords:
        vp = voice_lead(prev_pad, c["tones"], 50, 71)
        prev_pad = vp
        c["pad"] = vp
        bass_pc = c["bass"] % 12
        upper = set(c["tones"]) - {bass_pc} if len(c["tones"]) > 3 else set(c["tones"])
        vk = voice_lead(prev_key, upper, 57, 76)
        prev_key = vk
        c["keys"] = vk

    # ---------------- PAD
    pad_v = 0.7 if act != 4 else 0.6
    for c in P.chords:
        for m in c["pad"]:
            if act == 4:
                P.add("pad", "pad", c["t"], c["d"] + 0.5, m, v=pad_v, attack=2.2, rel=1.5)
            else:
                P.add("pad", "pad", c["t"], c["d"] + 0.15, m, v=pad_v)

    # ---------------- BASS
    for bar in range(32):
        t0 = bar * 4
        c = P.chord_at(t0)
        root = c["bass"]
        if act in (1, 2):
            pat = euclid(6, 16, rot=0 if bar % 2 == 0 else 3)
            hits = [s for s, h in enumerate(pat) if h]
            for k, s in enumerate(hits):
                note = root + (12 if (bar % 4 == 3 and k == len(hits) - 1) else 0)
                P.add("bass", "sub", t0 + s * 0.25, 0.32, note, v=0.95 if s == 0 else 0.7)
        elif act == 3:
            for s in range(16):
                note = root + (12 if s % 8 == 7 else 0)
                P.add("bass", "sub", t0 + s * 0.25, 0.2, note, v=0.6 if s % 2 == 0 else 0.32)
        else:
            if c["t"] == t0 or t0 % 8 == 0:
                if t0 % 8 == 0:
                    P.add("bass", "sub", t0, 7.6, root, v=0.8)

    # ---------------- KICK (heartbeat) and KICK2 (extra drive)
    for bar in range(32):
        t0 = bar * 4
        if act in (1, 2):
            for bt, v in ((0, 0.9), (0.45, 0.5), (2, 0.8), (2.45, 0.45)):
                P.add("kick", "kick", t0 + bt, 0.5, None, v=v)
            for bt in (1, 3):
                P.add("kick2", "kick", t0 + bt, 0.5, None, v=0.5)
        elif act == 3:
            for bt in range(4):
                P.add("kick", "kick", t0 + bt, 0.5, None, v=0.85 if bt == 0 else 0.7)
            P.add("kick2", "kick", t0 + 3.5, 0.5, None, v=0.4)
        else:
            if bar % 2 == 0:
                P.add("kick", "kick", t0, 0.5, None, v=0.8)
                P.add("kick", "kick", t0 + 0.45, 0.5, None, v=0.45)

    # ---------------- TICKER TAPE and TOCK
    for bar in range(32):
        t0 = bar * 4
        k_hits = 7 if act != 4 else 3
        pat = euclid(k_hits, 16, rot=(bar * 3) % 16)
        for s16, hit in enumerate(pat):
            if hit:
                P.add("tick", "tick", t0 + s16 * 0.25, 0.03, None, v=0.6 * float(rng.uniform(0.55, 1.0)),
                      p=-0.4 if s16 % 2 else 0.4)
        if act in (1, 2):
            P.add("tock", "tock", t0 + 1, 0.12, None, v=0.55, p=-0.3)
            P.add("tock", "tock", t0 + 3, 0.12, None, v=0.45, p=0.3)
        elif act == 3:
            for bt in range(4):
                P.add("tock", "tock", t0 + bt, 0.12, None, v=0.4, p=-0.3 if bt % 2 == 0 else 0.3)
        else:
            P.add("tock", "tock", t0 + 2, 0.12, None, v=0.5, p=0.0)

    # ---------------- KEYS (syncopated stabs in acts I and II, slow rolled chords in act IV)
    if act in (1, 2):
        stabs = [(0.75, 0.5, 0.6), (1.5, 0.5, 0.45), (2.5, 0.5, 0.55), (3.25, 0.5, 0.4)]
        for bar in range(32):
            t0 = bar * 4
            c = P.chord_at(t0)
            for (bt, dur, vel) in stabs:
                for j, m in enumerate(c["keys"]):
                    P.add("keys", "ep", t0 + bt + 0.03 * j, dur, m, v=vel * float(rng.uniform(0.92, 1.05)),
                          p=-0.3 + 0.6 * (m - 57) / 19, decay=1.0)
    elif act == 4:
        for c in P.chords:
            for j, m in enumerate(c["keys"]):
                P.add("keys", "ep", c["t"] + 0.9 * j, 4, m, v=0.38, p=0.1, decay=3.0, dark=0.8)

    # ---------------- ARP (acts I and II only)
    if act in (1, 2):
        for c in P.chords:
            ladder = sorted(m for m in range(57, 82) if m % 12 in c["tones"])
            start = next(i for i, m in enumerate(ladder) if m >= 62)
            for b in range(int(c["d"] // 4)):
                base = [0, 1, 2, 3, 2, 1] if b % 2 == 0 else [0, 2, 1, 3, 2, 4, 3, 2]
                pat = (base * 4)[:16]
                for stp in range(16):
                    idx = min(start + pat[stp], len(ladder) - 1)
                    acc = [0.9, 0.45, 0.62, 0.45][stp % 4]
                    P.add("arp", "arp", c["t"] + 4 * b + stp * 0.25, 0.2, ladder[idx], v=acc,
                          p=0.22 if stp % 2 else -0.22)

    # ---------------- LEAD: the tune T
    def lead_phrase(t0, steps, shift, vel, layer="lead"):
        for (bt, dur), s in zip(T_RHYTHM, steps):
            P.add(layer, "lead", t0 + bt, dur * 0.97, step_midi(74, "minor", s) + shift, v=vel, p=0.05)

    def lead_notes(notes, shift, vel, layer="lead"):
        for (t, m, d) in notes:
            P.add(layer, "lead", t, d * 0.97, m + shift, v=vel, p=0.05)

    if act in (1, 2):
        for c_i, shift, vel in ((1, 0, 0.75), (3, 12, 0.88)):
            b0 = c_i * 32
            lead_phrase(b0, [-3, 0, 2, 1, 0], shift, vel)
            lead_phrase(b0 + 8, [-5, -2, 0, -1, -2], shift, vel)
            if c_i == 3:
                lead_phrase(b0, [-3, 0, 2, 1, 0], 0, 0.45, layer="lead2")
                lead_phrase(b0 + 8, [-5, -2, 0, -1, -2], 0, 0.45, layer="lead2")
            if act == 1:
                lead_phrase(b0 + 16, [-7, -4, -2, -3, -4], shift, vel)
                a7 = [(b0 + 24, 64, 1), (b0 + 25, 69, 1), (b0 + 26, 74, 2), (b0 + 28, 73, 1.5), (b0 + 29.5, 70, 0.5), (b0 + 30, 69, 2)]
            else:
                lead_notes([(b0 + 16, 62, 1), (b0 + 17, 67, 1), (b0 + 18, 70, 2),
                            (b0 + 20, 67, 1.5), (b0 + 21.5, 70, 0.5), (b0 + 22, 74, 2)], shift, vel)
                a7 = [(b0 + 24, 64, 1), (b0 + 25, 67, 1), (b0 + 26, 70, 2), (b0 + 28, 73, 1.5), (b0 + 29.5, 70, 0.5), (b0 + 30, 69, 2)]
                if c_i == 3:
                    lead_notes([(b0 + 16, 62, 1), (b0 + 17, 67, 1), (b0 + 18, 70, 2),
                                (b0 + 20, 67, 1.5), (b0 + 21.5, 70, 0.5), (b0 + 22, 74, 2)], 0, 0.45, layer="lead2")
            lead_notes(a7, shift, vel)
            if c_i == 3:
                lead_notes(a7, 0, 0.45, layer="lead2")
    elif act == 3:   # fragmentation: only the first two notes of T (A then D) on a bell, once per cycle
        for k in range(4):
            P.add("lead", "bell", 32 * k + 1, 6, 69, v=0.5, p=0.2, tc=1.3)
            P.add("lead", "bell", 32 * k + 3, 6, 74, v=0.5, p=0.2, tc=1.3)
    else:            # inversion plus augmentation: G D Bb C D, tolled very slowly
        for (t, m) in ((0, 79), (16, 74), (40, 70), (64, 72), (80, 74)):
            P.add("lead", "bell", t, 12, m, v=0.65, p=0.15, tc=2.2)

    # ---------------- BELLS
    tolls = [(0, 74, 0.8), (8, 77, 0.65), (16, 74, 0.6), (24, 76, 0.6), (30, 73, 0.55)]
    for k in range(4):
        b0 = k * 32
        if act in (1, 2):
            for (bt, m, v) in tolls:
                P.add("bell", "bell", b0 + bt, 6, m, v=v * 0.8, p=0.12, tc=(0.7 if m == 73 else 1.5))
            P.add("bell", "bell", b0, 8, 62, v=0.9, p=-0.05, tc=2.2)
        elif act == 3:
            P.add("bell", "bell", b0, 8, 62, v=0.9, p=-0.05, tc=2.2)
            P.add("bell", "bell", b0 + 16, 6, 74, v=0.6, p=0.12, tc=1.5)
        else:
            P.add("bell", "bell", b0, 8, 62, v=0.9, p=-0.05, tc=2.4)
            P.add("bell", "bell", b0 + 8, 6, 77, v=0.5, p=0.12, tc=1.8)

    # ---------------- DRONE and TREMOR (acts II to IV)
    if act >= 2:
        for t0 in (0, 64):
            P.add("drone", "drone", t0, 66, 38, v=0.5)
            P.add("drone", "drone", t0, 66, 45, v=0.35)
        spb = 60.0 / P.bpm
        for t0 in (46.5, 110.5):
            P.add("tremor", "tremor", t0, 3.0 / spb, None, v=0.6)

    # ---------------- ACT III SWARM: four funds, one pattern, four slightly different speeds
    if act == 3:
        cell = [67, 74, 72, 77, 74, 77, 72, 74]              # G4 D5 C5 F5 D5 F5 C5 D5 (safe over Dm9 and Ebmaj7/D)
        acc = [1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]
        copies = {"swarm_a": (32, -0.7), "swarm_b": (30, -0.25), "swarm_c": (34, 0.25), "swarm_d": (28, 0.7)}
        for layer, (cycles, pn) in copies.items():
            period = 128.0 / cycles                          # every copy ends exactly on the loop point
            for cy in range(cycles):
                for j, m in enumerate(cell):
                    P.add(layer, "arp", cy * period + j * (period / 8), period / 8 * 0.9, m, v=0.6 * acc[j], p=pn)

    # ---------------- MIX: layer gain at intensity 1.0, and the intensity curves
    ev_layers = {e["l"] for e in P.events}
    base = {
        "pad": dict(gain=0.36, rev=0.30, dly=0.0), "bass": dict(gain=0.42, rev=0.0, dly=0.0),
        "kick": dict(gain=0.60, rev=0.02, dly=0.0), "kick2": dict(gain=0.45, rev=0.02, dly=0.0),
        "tick": dict(gain=0.10, rev=0.10, dly=0.05), "tock": dict(gain=0.36, rev=0.15, dly=0.0),
        "keys": dict(gain=0.40, rev=0.25, dly=0.25), "arp": dict(gain=0.44, rev=0.30, dly=0.65),
        "lead": dict(gain=0.48, rev=0.35, dly=0.35), "lead2": dict(gain=0.38, rev=0.35, dly=0.30),
        "bell": dict(gain=0.50, rev=0.55, dly=0.20), "drone": dict(gain=0.22, rev=0.30, dly=0.0),
        "tremor": dict(gain=0.32, rev=0.20, dly=0.0),
        "swarm_a": dict(gain=0.36, rev=0.20, dly=0.45), "swarm_b": dict(gain=0.36, rev=0.20, dly=0.45),
        "swarm_c": dict(gain=0.36, rev=0.20, dly=0.45), "swarm_d": dict(gain=0.36, rev=0.20, dly=0.45),
    }
    layers = {k: base[k] for k in base if k in ev_layers}
    if act == 4:
        layers["pad"] = dict(gain=0.42, rev=0.45, dly=0.0)
        layers["keys"] = dict(gain=0.36, rev=0.40, dly=0.15)
        layers["lead"] = dict(gain=0.52, rev=0.60, dly=0.25)
        layers["bell"] = dict(gain=0.48, rev=0.65, dly=0.15)
    if act == 3:
        layers["pad"] = dict(gain=0.30, rev=0.35, dly=0.0)
    # intensity curve = [[intensity, multiplier], ...], linear between points
    curves = {
        "pad": [[0, 0.75], [1, 0.45]], "bass": [[0, 0.55], [1, 1.0]], "tick": [[0, 0.5], [1, 1.0]],
        "kick": [[0, 0.0], [0.15, 0.0], [0.3, 0.8], [1, 1.0]], "kick2": [[0, 0], [0.7, 0], [0.9, 1.0], [1, 1.0]],
        "tock": [[0, 0], [0.2, 0], [0.4, 1.0], [1, 1.0]], "keys": [[0, 0], [0.2, 0], [0.45, 1.0], [1, 1.0]],
        "arp": [[0, 0], [0.4, 0], [0.65, 1.0], [1, 1.0]], "lead": [[0, 0], [0.65, 0], [0.85, 1.0], [1, 1.0]],
        "lead2": [[0, 0], [0.65, 0], [0.85, 1.0], [1, 1.0]], "bell": [[0, 0.7], [1, 1.0]],
        "drone": [[0, 0.6], [1, 1.0]], "tremor": [[0, 0], [0.5, 0.3], [1, 1.0]],
        "swarm_a": [[0, 0], [0.15, 0], [0.3, 1.0], [1, 1.0]], "swarm_b": [[0, 0], [0.4, 0], [0.55, 1.0], [1, 1.0]],
        "swarm_c": [[0, 0], [0.6, 0], [0.75, 1.0], [1, 1.0]], "swarm_d": [[0, 0], [0.8, 0], [0.92, 1.0], [1, 1.0]],
    }
    if act == 4:   # the last act never gets loud, but it should still answer to intensity
        curves["pad"] = [[0, 0.55], [1, 0.9]]
        curves["keys"] = [[0, 0.25], [1, 1.0]]
        curves["lead"] = [[0, 0.3], [1, 1.0]]
        curves["bell"] = [[0, 0.55], [1, 1.0]]
        curves["drone"] = [[0, 0.5], [1, 1.0]]
        curves["bass"] = [[0, 0.4], [1, 1.0]]
        curves["kick"] = [[0, 0.0], [0.3, 0.0], [0.5, 0.7], [1, 1.0]]
    if act == 3:
        curves["kick"] = [[0, 0.0], [0.1, 0.0], [0.25, 0.8], [1, 1.0]]
        curves["lead"] = [[0, 0.5], [1, 1.0]]
    P.mix = dict(
        layers=layers,
        intensityCurves={k: curves[k] for k in layers if k in curves},
        intensityNote="Layer gain = layers[layer].gain x curve(intensity). Ease changes with setTargetAtTime (time constant 0.4 s).",
        ghostLayers=["lead"],
        reverb=dict(seconds=2.4 if act != 4 else 3.6, wet=0.45 if act != 4 else 0.6),
        delay=dict(beats=0.75, fb=0.40 if act != 3 else 0.5, lp=3000.0, wet=0.5),
        pad_filter=[(0, 700), (32, 760), (48, 1100), (64, 1250), (80, 1800), (96, 1500), (112, 900), (128, 700)]
        if act in (1, 2) else [(0, 620), (64, 760), (128, 620)],
        pad_lfo_cycles=2, pad_q=0.9,
        master=dict(hp=30.0, lp=10000.0 - 2500 * (act - 1) / 3.0, sat=1.15, wobble=None, hiss=0.0, crackle=0.0),
        target_lufs=-21.0, reference_intensity=0.6,
    )
    P.notes = f"Gameplay, act {act}."
    return P


GAME_BUILDERS = {KEYS[a]: (lambda a=a: build_game(a)) for a in (1, 2, 3, 4)}
