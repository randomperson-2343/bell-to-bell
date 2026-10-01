"""make_game_refs.py - one seamless loop of every gameplay act at the reference intensity (0.6), at the loudness the game should hit.
These are the files the code session compares its in-browser render against."""
import json, compose_game, render, render_adaptive as RA
for a in (1, 2, 3, 4):
    P = compose_game.build_game(a)
    g = json.load(open(f"events/{P.key}.json"))["mix"]["trackGain"]
    x = RA.render_adaptive(P, 0.6, reps=1, fold=True) * g
    render.write_wav(f"out/ref_{P.key}_i060.wav", x)
    render.to_mp3(f"out/ref_{P.key}_i060.wav", f"out/ref_{P.key}_i060.mp3", kbps=96)
    print("done", P.key, flush=True)
