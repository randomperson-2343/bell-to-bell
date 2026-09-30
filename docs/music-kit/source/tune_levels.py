"""tune_levels.py <pass>  pass 1: start from category peaks and move each sound toward its margin target.
pass 2: re-measure. Sounds in the same family are then held to one shared level so paired sounds never differ by accident."""
import json, os, sys, subprocess
import sfx_catalog as C
TARGET = {"order": 7, "ui": 4, "sqwak": 7, "clock": 6, "decision": 8, "story": 8, "reward": 10, "negative": 8, "event": 10, "cutscene": 10, "ending": 10, "text": 2}
FAMILIES = [["order_buy", "order_sell", "order_short", "order_cover"], ["win_close", "loss_close"],
            ["order_limit_set", "order_limit_fill"], ["dm_imani", "dm_kroll", "dm_compliance"],
            ["countdown_tick", "countdown_final"], ["quota_met", "quota_missed"]]
which = sys.argv[1]
aud = json.load(open("out/audibility.json"))["per_sound_median_margin_db"]
cur = json.load(open("sfx_levels.json")) if os.path.exists("sfx_levels.json") else {}
qa = json.load(open("out/sfx_qa.json"))
new = {}
for sid, mg in aud.items():
    if sid == "close_riser":
        continue
    cat = C.S[sid]["cat"]
    base = qa[sid]["peak_db"]
    step = max(-10.0, min(10.0, TARGET.get(cat, 6) - mg))
    new[sid] = round(max(-26.0, min(-3.0, base + step)), 1)
if False:
    for fam in FAMILIES:
        vals = [new[s] for s in fam if s in new]
        if vals:
            m = round(sum(vals) / len(vals), 1)
            for s in fam:
                if s in new:
                    new[s] = m
json.dump(new, open("sfx_levels.json", "w"), indent=1)
print(which, new)
