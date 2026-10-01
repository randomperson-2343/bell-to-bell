"""
compose.py - Bell to Bell: menu theme "Opening Bell" and daily-feed theme "Thumb Scroll" (4 acts).

Everything is deterministic (fixed seeds). Running this file regenerates:
  events/*.json   the exact note-by-note score (what the game engine plays)
  audio previews  rendered with the same recipes the game will use
"""
import json
import itertools
import numpy as np

# ------------------------------------------------------------------ theory helpers
MODES = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
}
NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]


def name(m):
    return f"{NOTE_NAMES[m % 12]}{m // 12 - 1}"


def step_midi(tonic, mode, s):
    """Scale step -> MIDI note. Step 0 = tonic, +1 = next scale note up, -1 = next scale note down."""
    octv, deg = divmod(int(s), 7)
    return tonic + 12 * octv + MODES[mode][deg]


def voice_lead(prev, pcs, lo, hi):
    """Pick the octave of every chord tone so the new chord moves as little as possible from the previous one.
    Brute force over octave choices; penalise crowding in the low register."""
    pcs = sorted(pcs)
    cands = []
    for pc in pcs:
        cands.append([m for m in range(lo, hi + 1) if m % 12 == pc])
    best, best_cost = None, 1e9
    for combo in itertools.product(*cands):
        v = sorted(combo)
        cost = 0.0
        if prev is not None:
            a, b = sorted(prev), v
            k = min(len(a), len(b))
            cost += sum(abs(a[i] - b[i]) for i in range(k)) + 2 * abs(len(a) - len(b))
        for x, y in zip(v, v[1:]):
            d = y - x
            if d == 0:
                cost += 50
            elif d == 1:
                cost += 30            # a semitone between two chord voices sounds crunchy in a pad or piano
            elif d == 2 and x < 67:
                cost += 4             # whole tones low in the register sound murky
            if d < 3 and x < 58:
                cost += 6
        cost += 0.3 * (v[-1] - v[0])          # prefer close voicings
        if cost < best_cost:
            best, best_cost = v, cost
    return best


def euclid(k, n, rot=0):
    """Euclidean rhythm: spread k hits as evenly as possible over n steps (Bjorklund)."""
    pat = [((i * k) % n) < k for i in range(n)]
    r = rot % n
    return pat[r:] + pat[:r]


class Piece:
    def __init__(self, key, title, bpm, bars, tonic, mode, seed, bpb=4):
        self.key, self.title, self.bpm, self.bars, self.bpb = key, title, bpm, bars, bpb
        self.tonic, self.mode = tonic, mode
        self.rng = np.random.default_rng(seed)
        self.events = []
        self.chords = []     # {t, d, name, tones(full chord pcs), ok(extra pcs allowed), bass}
        self.notes = ""

    @property
    def loop_beats(self):
        return self.bars * self.bpb

    @property
    def loop_seconds(self):
        return self.loop_beats * 60.0 / self.bpm

    def add(self, layer, inst, t, d, n=None, v=0.8, p=0.0, **kw):
        e = {"t": round(float(t), 4), "d": round(float(d), 4), "n": None if n is None else int(n),
             "v": round(float(np.clip(v, 0, 1)), 3), "i": inst, "l": layer, "p": round(float(p), 3)}
        e.update(kw)
        self.events.append(e)

    def chord_at(self, beat):
        b = beat % self.loop_beats
        for c in self.chords:
            if c["t"] <= b < c["t"] + c["d"]:
                return c
        return self.chords[-1]

    def export(self):
        return {
            "name": self.key, "title": self.title, "bpm": self.bpm, "beatsPerBar": self.bpb,
            "bars": self.bars, "loopBeats": self.loop_beats, "loopSeconds": round(self.loop_seconds, 3),
            "tonicMidi": self.tonic, "mode": self.mode,
            "chords": [{k: (sorted(v) if isinstance(v, (set, list)) and k in ("tones", "ok") else v)
                        for k, v in c.items()} for c in self.chords],
            "events": sorted(self.events, key=lambda e: (e["t"], e["l"])),
        }


# =====================================================================================
#  MENU  -  "Opening Bell"   D minor, 84 BPM, 32 bars (about 91 s loop)
# =====================================================================================
def build_menu():
    P = Piece("menu_opening_bell", "Opening Bell (Main Menu)", bpm=84, bars=32, tonic=74, mode="minor", seed=2026)
    rng = P.rng
    T_STEPS = [-3, 0, 2, 1, 0]                 # the leitmotif "T": 5th below -> tonic -> up a third -> step up -> home
    T_RHYTHM = [(0, 1), (1, 1), (2, 2), (4, 1), (5, 3)]      # (beat, duration) inside one 8-beat phrase

    cycle = [   # (start, dur, name, chord tones (pitch classes), extra allowed pcs, bass root, section-grid role)
        (0, 8, "Dm9", {2, 5, 9, 0, 4}, set(), 38),
        (8, 8, "Bbmaj7", {10, 2, 5, 9}, {4}, 34),          # E over Bbmaj7 = the lydian #11 (a colour note, allowed)
        (16, 8, "Gm9", {7, 10, 2, 5, 9}, set(), 31),
        (24, 4, "A7sus4", {9, 2, 4, 7}, set(), 33),
        (28, 4, "A7b9", {9, 1, 4, 7, 10}, set(), 33),
    ]
    for cyc in range(4):
        for (s, d, nm, tones, ok, bass) in cycle:
            P.chords.append({"t": cyc * 32 + s, "d": d, "name": nm, "tones": tones, "ok": ok, "bass": bass})

    # ---- PAD: voice-led chords, one voice per chord tone
    prev = None
    for c in P.chords:
        v = voice_lead(prev, c["tones"], 50, 71)
        prev = v
        c["pad"] = v
        for i, m in enumerate(v):
            P.add("pad", "pad", c["t"], c["d"] + 0.15, m, v=0.72, p=0.0)

    # ---- BASS
    for c in P.chords:
        cyc, s = divmod(c["t"], 32)
        root = c["bass"]
        sec = cyc  # 0 = A, 1 = B, 2 = A', 3 = C
        if sec in (0, 3):
            P.add("bass", "sub", c["t"], c["d"] * 0.96, root, v=0.8)
        else:
            bars_here = int(c["d"] // 4)
            for b in range(bars_here):
                t0 = c["t"] + 4 * b
                P.add("bass", "sub", t0, 1.75, root, v=1.0 if b == 0 else 0.9)
                P.add("bass", "sub", t0 + 2.5, 0.5, root, v=0.75)
                P.add("bass", "sub", t0 + 3.5, 0.45, root + (12 if b == 0 else 7), v=0.55)

    # ---- ARP (sections B and A'), 16th notes up/down over the chord tones
    for c in P.chords:
        cyc = c["t"] // 32
        if cyc not in (1, 2):
            continue
        ladder = sorted(m for m in range(57, 82) if m % 12 in c["tones"])
        start = next(i for i, m in enumerate(ladder) if m >= 62)
        bars_here = int(c["d"] // 4)
        for b in range(bars_here):
            base = [0, 1, 2, 3, 2, 1] if b % 2 == 0 else [0, 2, 1, 3, 2, 4, 3, 2]
            pat = (base * 4)[:16]
            for stp in range(16):
                idx = min(start + pat[stp], len(ladder) - 1)
                acc = [0.9, 0.45, 0.62, 0.45][stp % 4] * (0.68 if cyc == 1 else 1.0)
                P.add("arp", "arp", c["t"] + 4 * b + stp * 0.25, 0.2, ladder[idx], v=acc,
                      p=0.22 if stp % 2 else -0.22)

    # ---- LEAD: the T motif, one phrase per chord (transposed by chord root, diatonic)
    def lead_phrase(t0, steps_or_notes, oct_shift, vel, layer="lead"):
        for (bt, dur), sn in zip(T_RHYTHM, steps_or_notes):
            m = sn[1] if isinstance(sn, tuple) else step_midi(74, "minor", sn)
            P.add(layer, "lead", t0 + bt, dur * 0.97, m + oct_shift, v=vel, p=0.05)

    phrases = [
        [-3, 0, 2, 1, 0],                        # over Dm9      A4 D5 F5 E5 D5
        [-5, -2, 0, -1, -2],                     # over Bbmaj7   F4 Bb4 D5 C5 Bb4
        [-7, -4, -2, -3, -4],                    # over Gm9      D4 G4 Bb4 A4 G4
    ]
    for cyc, shift, vel in ((1, 0, 0.7), (2, 12, 0.88)):
        b0 = cyc * 32
        for k, ph in enumerate(phrases):
            lead_phrase(b0 + 8 * k, ph, shift, vel)
            if cyc == 2:
                lead_phrase(b0 + 8 * k, ph, 0, 0.45, layer="lead2")
        # phrase 4 over A7sus4 -> A7b9: E4 A4 D5 | C#5 Bb4 A4 (explicit notes: leading tone and flat-9)
        t4 = b0 + 24
        p4 = [(64, 1), (69, 1), (74, 2)]
        for bt, (m, d) in zip((0, 1, 2), p4):
            P.add("lead", "lead", t4 + bt, d * 0.97, m + shift, v=vel, p=0.05)
        for bt, m, d in ((4, 73, 1.5), (5.5, 70, 0.5), (6, 69, 2)):
            P.add("lead", "lead", t4 + bt, d * 0.97, m + shift, v=vel, p=0.05)
            if cyc == 2:
                P.add("lead2", "lead", t4 + bt, d * 0.97, m, v=0.45, p=0.05)
        if cyc == 2:
            for bt, (m, d) in zip((0, 1, 2), p4):
                P.add("lead2", "lead", t4 + bt, d * 0.97, m, v=0.45, p=0.05)

    # ---- BELLS
    tolls = [(0, 74, 0.8), (8, 77, 0.65), (16, 74, 0.6), (24, 76, 0.6), (30, 73, 0.55)]
    for cyc in range(3):
        b0 = cyc * 32
        gain = [1.0, 0.75, 0.8][cyc]
        for (bt, m, v) in tolls:
            P.add("bell", "bell", b0 + bt, 6, m, v=v * gain, p=0.12, tc=(0.7 if m == 73 else 1.5))
            if cyc == 2:
                P.add("bell", "bell", b0 + bt, 6, m + 12, v=v * 0.5, p=-0.15, tc=(0.6 if m == 73 else 1.1))
        P.add("bell", "bell", b0, 8, 62, v=1.0 * gain, p=-0.05, tc=2.2)      # the "opening bell" low strike
    # section C: the motif T in augmentation (all durations doubled), then T inverted (mirror image)
    aug = [(96, 69), (98, 74), (100, 77), (104, 76), (106, 74)]
    inv = [(112, 79), (114, 74), (116, 70), (120, 69), (124, 73)]
    for (bt, m) in aug + inv:
        P.add("bell", "bell", bt, 8, m, v=0.7, p=0.1, tc=(0.7 if m == 73 else 1.8))

    # ---- PERCUSSION
    for bar in range(32):
        cyc = bar // 8
        t0 = bar * 4
        if cyc in (1, 2) or (cyc == 3 and bar < 30):
            hits = [(0, 0.9), (0.45, 0.5), (2, 0.8), (2.45, 0.45)] if cyc in (1, 2) else [(0, 0.6)]
            for bt, v in hits:
                P.add("kick", "kick", t0 + bt, 0.5, None, v=v)
        if cyc == 2:
            P.add("tock", "tock", t0 + 1, 0.12, None, v=0.55, p=-0.3)
            P.add("tock", "tock", t0 + 3, 0.12, None, v=0.45, p=0.3)
        # ticker tape: euclidean 7-in-16, rotated by bar so it never quite repeats
        lvl = {0: 0.0 if bar < 4 else 0.25 + 0.06 * (bar - 4), 1: 0.7, 2: 0.8}.get(cyc)
        if cyc == 3:
            lvl = 0.6 if bar < 28 else (0.4 if bar < 30 else 0.2)
        if lvl:
            pat = euclid(7, 16, rot=(bar * 3) % 16)
            for s16, hit in enumerate(pat):
                if hit:
                    P.add("tick", "tick", t0 + s16 * 0.25, 0.03, None, v=lvl * float(rng.uniform(0.55, 1.0)),
                          p=-0.4 if s16 % 2 else 0.4)
    # ---- RISER into the loop point
    P.add("riser", "riser", 120, 8, None, v=0.9)

    P.notes = "D minor. Sections: A bars 1-8, B 9-16, A' 17-24, C 25-32."
    P.mix = dict(
        layers={
            "pad": dict(gain=0.36, rev=0.30, dly=0.0),
            "bass": dict(gain=0.42, rev=0.0, dly=0.0),
            "arp": dict(gain=0.50, rev=0.30, dly=0.65),
            "lead": dict(gain=0.48, rev=0.35, dly=0.35),
            "lead2": dict(gain=0.38, rev=0.35, dly=0.30),
            "bell": dict(gain=0.55, rev=0.60, dly=0.20),
            "kick": dict(gain=0.60, rev=0.02, dly=0.0),
            "tock": dict(gain=0.40, rev=0.15, dly=0.0),
            "tick": dict(gain=0.10, rev=0.10, dly=0.05),
            "riser": dict(gain=0.20, rev=0.35, dly=0.0),
        },
        reverb=dict(seconds=3.4, wet=0.55),
        delay=dict(beats=0.75, fb=0.46, lp=3200.0, wet=0.55),
        pad_filter=[(0, 700), (8 * 4, 760), (12 * 4, 1100), (16 * 4, 1250), (20 * 4, 1800), (24 * 4, 1500),
                    (28 * 4, 900), (32 * 4, 700)],
        pad_lfo_cycles=2, pad_q=0.9,
        master=dict(hp=28.0, lp=11000.0, sat=1.15, wobble=None, hiss=0.0, crackle=0.0),
        target_lufs=-17.0,
    )
    return P


# =====================================================================================
#  FEED  -  "Thumb Scroll"   four acts. Key centre F. Tonic for melody steps = F5 (77).
# =====================================================================================
FEED_TONIC = 77
T_STEPS = [-3, 0, 2, 1, 0]
T_RHYTHM = [(0, 1), (1, 1), (2, 2), (4, 1), (5, 3)]


def _humanize(P, base, jitter=0.012):
    return base + float(P.rng.uniform(-jitter, jitter))


def build_feed(act):
    assert act in (1, 2, 3, 4)
    keys = {1: "feed_act1_melt_up", 2: "feed_act2_tremors", 3: "feed_act3_contagion", 4: "feed_act4_reckoning"}
    titles = {1: "Thumb Scroll - Act I (Melt-Up)", 2: "Thumb Scroll - Act II (Tremors)",
              3: "Thumb Scroll - Act III (Contagion)", 4: "Thumb Scroll - Act IV (Reckoning)"}
    bpm = {1: 78, 2: 78, 3: 84, 4: 60}[act]
    mode = "major" if act == 1 else "minor"
    P = Piece(keys[act], titles[act], bpm=bpm, bars=16, tonic=FEED_TONIC, mode=mode, seed=100 + act)
    P.act = act
    rng = P.rng

    # ---------------- chords
    if act == 1:      # ii - V - I - vi   (Gm9  C13  Fmaj9  Dm9), two bars each, twice around
        prog = [("Gm9", {7, 10, 2, 5, 9}, {10, 2, 5, 9}, 43, set()),
                ("C13", {0, 4, 7, 10, 2, 9}, {4, 9, 10, 2}, 36, set()),
                ("Fmaj9", {5, 9, 0, 4, 7}, {9, 0, 4, 7}, 41, set()),
                ("Dm9", {2, 5, 9, 0, 4}, {5, 9, 0, 4}, 38, set())]
        seglen, nseg = 8, 8
    elif act == 2:    # the same shape in the parallel minor
        prog = [("Gm7b5", {7, 10, 1, 5}, {10, 1, 5, 7}, 43, {8}),          # Ab in the melody = b9 colour (allowed)
                ("C7b9", {0, 4, 7, 10, 1}, {4, 7, 10, 1}, 36, set()),
                ("Fm9", {5, 8, 0, 3, 7}, {8, 0, 3, 7}, 41, set()),
                ("Dbmaj7", {1, 5, 8, 0}, {1, 5, 8, 0}, 37, {3})]           # Eb over Dbmaj7 = 9th
        seglen, nseg = 8, 8
    else:             # acts III and IV: 4 bars per chord
        prog = [("Fm9", {5, 8, 0, 3, 7}, {8, 0, 3, 7}, 41, set()),
                ("Dbmaj7", {1, 5, 8, 0}, {1, 5, 8, 0}, 37, {3, 7, 10}),
                ("Bbm9", {10, 1, 5, 8, 0}, {10, 1, 5, 8}, 34, {3, 7}),
                ("C7sus4", {0, 5, 7, 10}, {0, 5, 7, 10}, 36, {3})]
        seglen, nseg = 16, 4

    for k in range(nseg):
        nm, full, voic, bass, ok = prog[k % 4]
        P.chords.append({"t": k * seglen, "d": seglen, "name": nm, "tones": full, "ok": ok, "bass": bass, "voicing": voic})

    # ---------------- harmony voices
    prev = None
    for c in P.chords:
        lo, hi = (53, 72) if act in (1, 2) else (50, 72)
        v = voice_lead(prev, c["voicing"], lo, hi)
        prev = v
        c["v"] = v

    if act in (1, 2):
        # lo-fi comping: three stabs per bar, strummed a hair apart, human timing (seeded)
        stabs_A = [(0, 1.25, 0.8), (1.75, 0.75, 0.5), (3, 1.0, 0.6)]
        stabs_B = [(0, 1.25, 0.75), (2, 0.75, 0.5), (3.25, 0.75, 0.45)]
        for c in P.chords:
            for bar_i, stabs in enumerate((stabs_A, stabs_B)):
                for (bt, dur, vel) in stabs:
                    for j, m in enumerate(c["v"]):
                        t = c["t"] + 4 * bar_i + bt + 0.03 * j
                        P.add("ep", "ep", _humanize(P, t) if t > 0.05 else t, dur, m,
                              v=vel * float(rng.uniform(0.92, 1.05)), p=-0.35 + 0.7 * (m - lo) / (hi - lo),
                              decay=1.3)
        # bass
        for c in P.chords:
            r = c["bass"]
            P.add("bass", "soft_bass", c["t"], 1.5, r, v=0.8)
            P.add("bass", "soft_bass", c["t"] + 2.5, 0.6, r + 7, v=0.5)
            P.add("bass", "soft_bass", c["t"] + 4, 1.25, r, v=0.7)
            P.add("bass", "soft_bass", c["t"] + 6.5, 0.6, r + 12, v=0.45)
        # melody
        shift_g = {1: 0, 2: 0}
        def phrase(t0, steps, vel=0.85, dur_scale=0.98):
            for (bt, dur), s in zip(T_RHYTHM, steps):
                P.add("melody", "ep", t0 + bt, dur * dur_scale, step_midi(FEED_TONIC, mode, s), v=vel, p=0.18, decay=2.2)
        def notes_phrase(t0, midis, vel=0.85):
            for (bt, dur), m in zip(T_RHYTHM, midis):
                P.add("melody", "ep", t0 + bt, dur * 0.98, m, v=vel, p=0.18, decay=2.2)
        def fragment(t0, vel=0.7):
            for bt, s, dur in ((0, 0, 1.5), (1.5, -1, 0.5), (2, -3, 4)):
                P.add("melody", "ep", t0 + bt, dur * 0.98, step_midi(FEED_TONIC, mode, s), v=vel, p=0.18, decay=2.2)
        # pass 1 (bars 1-8): the tune arrives late, over the I chord, as a first small statement
        phrase(16, T_STEPS, 0.8)
        fragment(24)
        # pass 2 (bars 9-16): the tune sequenced across ii, V, I, vi
        phrase(32, [s + 1 for s in T_STEPS], 0.85)                        # over ii: tonic shifted up one step
        if act == 1:
            notes_phrase(40, [67, 72, 76, 74, 72], 0.85)                  # over C13:  G4 C5 E5 D5 C5
        else:
            notes_phrase(40, [67, 72, 76, 73, 72], 0.85)                  # over C7b9: G4 C5 E5 Db5 C5
        phrase(48, T_STEPS, 0.9)
        fragment(56)
        # train: two-clack rail joints, twice a bar; Act II drops some (the ride is less certain)
        for bar in range(16):
            if act == 2 and bar % 4 == 3:
                continue
            for bt in (0, 2):
                P.add("train", "clack", bar * 4 + bt, 0.16, None, v=0.55, bright=0.4, p=-0.2)
                P.add("train", "clack", bar * 4 + bt + 0.33, 0.16, None, v=0.38, bright=0.7, p=-0.2)
        if act == 2:
            # distant tremors: a rumble once every four bars, then a low drone under everything
            for bar in (3, 7, 11, 15):
                P.add("tremor", "tremor", bar * 4 + 2.5, 3.0, None, v=0.6 + 0.1 * (bar // 4))
            for t0 in (0, 32):
                P.add("drone", "drone", t0, 34, 41, v=0.55)
                P.add("drone", "drone", t0, 34, 48, v=0.4)

    elif act == 3:
        # THE LOOP: two copies of the same 8-note pattern. Copy B runs 1/15 slower, so it slips behind copy A
        # by exactly one full pattern over 16 bars, and lands back in unison right at the loop point.
        cell = [65, 72, 67, 75, 70, 72, 65, 67]         # F4 C5 G4 Eb5 Bb4 C5 F4 G4
        acc = [1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]
        for cyc in range(16):
            for j, m in enumerate(cell):
                P.add("osc_a", "ep", cyc * 4 + j * 0.5, 0.5, m, v=0.62 * acc[j], p=-0.55, decay=0.9, dark=0.4)
        pb = 64.0 / 15.0
        for cyc in range(15):
            for j, m in enumerate(cell):
                P.add("osc_b", "ep", cyc * pb + j * (pb / 8), pb / 8, m, v=0.62 * acc[j], p=0.55, decay=0.9, dark=0.4)
        for c in P.chords:
            for m in c["v"]:
                P.add("pad", "pad", c["t"], c["d"] + 0.2, m, v=0.6)
            r = c["bass"]
            for bar in range(4):
                for e8 in range(8):
                    P.add("bass", "soft_bass", c["t"] + bar * 4 + e8 * 0.5, 0.4, r + (12 if e8 % 4 == 3 else 0),
                          v=0.5 if e8 % 2 == 0 else 0.32)
        for k in range(4):        # fragment of T: just the opening fourth (C -> F), once every four bars
            P.add("melody", "bell", 16 * k + 6, 6, 72, v=0.45, p=0.2, tc=1.3)
            P.add("melody", "bell", 16 * k + 8, 6, 77, v=0.45, p=0.2, tc=1.3)
        for beat in range(64):
            for off, v, br in ((0, 0.55, 0.4), (0.33, 0.4, 0.7)):
                P.add("train", "clack", beat + off, 0.16, None, v=v, bright=br, p=-0.2)

    else:  # act 4
        for c in P.chords:
            for m in c["v"]:
                P.add("pad", "pad", c["t"], c["d"] + 0.5, m, v=0.55, attack=2.2, rel=1.5)
            r = c["bass"]
            for j, m in enumerate(c["v"]):     # a slow rolled chord on the EP at the start of each segment
                P.add("ep", "ep", c["t"] + 0.9 * j, 4, m, v=0.38, p=0.1, decay=3.0, dark=0.8)
            P.add("bass", "soft_bass", c["t"], 6, r, v=0.55)
        # the tune T, inverted (mirror image) and stretched to four times its length, tolled on a bell
        inv = [(0, 82), (16, 77), (32, 73), (48, 75), (60, 77)]
        for bt, m in inv:
            P.add("melody", "bell", bt, 12, m, v=0.65, p=0.15, tc=2.2)
        for t0 in (0, 32):
            P.add("drone", "drone", t0, 34, 41, v=0.55)
            P.add("drone", "drone", t0, 34, 48, v=0.4)
        for bar in (3, 7, 11, 15):
            P.add("train", "clack", bar * 4 + 2, 0.16, None, v=0.32, bright=0.3, p=-0.2)
            P.add("train", "clack", bar * 4 + 2.33, 0.16, None, v=0.22, bright=0.5, p=-0.2)

    # ---------------- mix
    dark = {1: 0.0, 2: 0.25, 3: 0.4, 4: 0.7}[act]
    room = {1: 1.8, 2: 2.2, 3: 2.6, 4: 4.6}[act]
    base_layers = {
        "ep": dict(gain=0.42, rev=0.25, dly=0.10),
        "melody": dict(gain=0.54, rev=0.32, dly=0.22),
        "bass": dict(gain=0.50, rev=0.0, dly=0.0),
        "train": dict(gain=0.17 if act < 4 else 0.2, rev=0.12, dly=0.0),
        "tremor": dict(gain=0.32, rev=0.2, dly=0.0),
        "drone": dict(gain=0.22, rev=0.3, dly=0.0),
        "pad": dict(gain=0.32 if act == 3 else 0.42, rev=0.35, dly=0.0),
        "osc_a": dict(gain=0.36, rev=0.15, dly=0.40),
        "osc_b": dict(gain=0.36, rev=0.15, dly=0.40),
    }
    P.mix = dict(
        layers=base_layers,
        reverb=dict(seconds=room, wet=0.5 if act < 4 else 0.75),
        delay=dict(beats=0.75, fb=0.32 if act < 3 else 0.55, lp=2600.0, wet=0.5),
        pad_filter=[(0, 800), (P.loop_beats, 800)] if act != 4 else [(0, 520), (32, 640), (P.loop_beats, 520)],
        pad_lfo_cycles=2, pad_q=0.8,
        master=dict(hp=40.0, lp=7800.0 - 3000 * dark, sat=1.25, wobble=dict(cycles=25, depth_ms=1.2 + 0.6 * act),
                    hiss=0.0035, crackle=0.0007),
        target_lufs={1: -22.0, 2: -22.5, 3: -22.5, 4: -25.0}[act],
    )
    P.notes = f"Act {act}."
    return P


ALL_BUILDERS = {
    "menu_opening_bell": build_menu,
    "feed_act1_melt_up": lambda: build_feed(1),
    "feed_act2_tremors": lambda: build_feed(2),
    "feed_act3_contagion": lambda: build_feed(3),
    "feed_act4_reckoning": lambda: build_feed(4),
}
