# The music kit

The new music and sound effects were composed and rendered offline in Python (by a chat session), then handed over as a kit. This folder keeps the parts of that kit the code depends on.

| File | What it is |
|---|---|
| `handoff.md` | The plan, the composition in plain English and the exact recipes. Written before the code existed, so it guesses at the game's own code in places; `mapping.md` is what was actually built. |
| `mapping.md` | Which game event plays which sound, what stayed Classic, and the decisions left for the owner. |
| `events/*.json` | The scores (menu, four feeds, four gameplay acts) and the 56-sound pack. **These are the source of truth.** |
| `source/*.py` | The Python that wrote every score and rendered the previews. Needs numpy, scipy and ffmpeg. |
| `qa_*.json`, `audibility.json` | The measurements the kit shipped with. `js/tests/audio-expected.json` is the part the render check compares against. |

The MP3 previews and the piano-roll pictures are not kept here (16 MB); they are in the original zip. The previews are the reference sound: if the game sounds different from them, fix the game.

## How it reaches the game

The game runs from `file://` with no build step, so `events/*.json` cannot be fetched. `tools/build-audio-data.js` packs them into two plain scripts:

```bash
node tools/build-audio-data.js        # reads docs/music-kit/events, writes js/audio/music-data.js and sfx-pack.js
```

If the kit's scores change, edit or replace `events/`, run that command, and re-run `node js/tests/audio-run.js` and `node js/tests/audio-render-run.js`.

## What matches the Python exactly

The in-game synthesis was checked note by note and layer by layer against the kit's Python, because the two are different programs. Two things needed care:

- **The reverb tails** are built from numpy's own random stream (PCG64 and the ziggurat normal sampler, re-implemented in `js/audio/voices.js`). A steady low tone, such as the Act IV drone, sits right on a reverb tail's random low-frequency response; a different random draw changed its level by about 5 dB. The tails now equal the kit's sample for sample.
- **FM with a whole-number ratio is phase sensitive.** The kit phase-modulates with a sine; Web Audio's frequency modulation is the same as phase modulation by a cosine, so the modulators here are cosines.
