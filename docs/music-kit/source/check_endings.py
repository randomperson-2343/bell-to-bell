"""check_endings.py [ids...] - theory and structure checks for the ending scores (no rendering)."""
import sys, json
import compose_endings as CE, checks
from compose import name
ids = sys.argv[1:] or list(CE.BUILDERS)
for i in ids:
    P = CE.BUILDERS[i]()
    oos, cl, ring = checks.theory_report(P, chromatic_ok=CE.CHROMATIC_OK.get(i, set()))
    for t_, n_ in getattr(P, "intentional", []):
        cl = [x for x in cl if not (abs(x[0] - t_) < 1e-3 and x[2] == name(n_))]
        oos = [x for x in oos if not (abs(x[0] - t_) < 1e-3 and x[1] == name(n_))]
    bad = [e for e in P.events if e["t"] < 0 or e["t"] >= P.loop_beats]
    print(f"== {i}: {len(P.events)} events, {P.loop_seconds:.1f}s, out-of-scale {len(oos)}, clashes {len(cl)}, ring {len(ring)}, "
          f"crunch {checks.crunch_report(P)['semitone_pairs']}, bad-times {len(bad)}")
    for x in oos[:8]: print("   OOS", x)
    for x in cl[:8]: print("   CLASH", x)
    for x in ring[:4]: print("   RING", x)
