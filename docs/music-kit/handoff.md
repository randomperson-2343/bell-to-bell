# Bell to Bell: new music and sound (menu, daily feed, gameplay, sound effects): handoff for the code session

Written 29 September 2026. **Revised 30 September 2026:** the owner approved the menu and daily-feed music ("it completely changes the vibe of the game") and then asked for the **gameplay music and the sound effects** to be upgraded to match. This revision adds both, and changes the old promise that the trading music would stay untouched. Author of the music: Claude (chat session). This file is the plan, the exact composition, and the methods, so a code session can build it without asking anyone what was meant.

**What changed in this revision (so nobody builds from the old version):**

- Scope is now **four things**: menu music, daily-feed music, **gameplay music ("Market Hours", new)** and a **sound-effect pack (56 sounds, new)**.
- The old trading music and old sound effects are **replaced, but kept behind a setting** so the owner can switch back (section 7.8). Before, they were "do not touch".
- New sections: 3.5, 3.6, 4 (methods 13 to 17), 5.4, 5.5, 6.10, 7.6 to 7.8, 8.3, 8.4, 9.2 to 9.4. Rewritten: 0, 1, 2, 7.5, 10, 11, 12. Small edits in 7.2 and 7.3.
- The menu and feed music are **byte-for-byte unchanged** since the owner approved them (checked by rebuilding from source and comparing file hashes).

---

## 0. Read this first

**What this changes.** Four things: the **main menu music**, the **music behind the daily pre-open phone feed (Sqwak)**, the **gameplay (trading-hours) music**, and **all sound effects**. Everything is synthesized in the browser. No audio files.

**Honest status (please do not skip).**

- [Certain] The owner listened to the **menu and feed** music and loved it. That is the only part with a human ear on it.
- [Certain] The **gameplay music and the sound effects were made after that and had not been reviewed by the owner when this was written.** Treat them as a draft until the owner says otherwise. Section 12 lists what to ask.
- [Certain] Everything was composed and rendered offline in Python. **Nothing has been run inside the game.**
- [Certain] The author (Claude) **cannot hear audio**. Checks were measurements (levels, loop seams, notes in key, chord clashes, how far each sound effect sits above the music) and music theory. **The MP3 previews are the reference sound.** If the in-game version sounds different from the previews, fix the game version, not the previews.
- [Certain] The author **could not open the game's GitHub repo** (`randomperson-2343/bell-to-bell`) from the chat session, so it has **never seen the existing audio code or the list of existing sound effects.** Anything below that touches existing code is marked **[Guessing]** and must be checked first.
- [Likely] The game makes its sound with the Web Audio API and no audio files. If it plays files instead, keep the design and swap the engine section for a file player (the WAV and MP3 renders can be regenerated from the source).
- [Certain] The old trading music's loudness was never measured. That no longer blocks anything, because the **new gameplay music is now the reference**: it sits at -21 LUFS at its middle intensity, and the sound effects were balanced against it. If the old music is kept as "Classic", match it to the new level, not the other way round.
- [Certain] **Listening fatigue is the biggest design risk.** A player hears gameplay music for roughly three hours across 61 sessions of 3 minutes. The design answers this with adaptive layers (most of a normal day plays only quiet layers), but the author could not test it by ear. Keep the Classic fallback (7.8).

**The one-sentence design.** One five-note tune (call it **T**) is the thread through the whole game. It opens the menu as a bell, it is bright in the Act I feed, it turns minor in Act II, it shrinks to two notes in Act III, and in Act IV it is played upside down, slowed down, on one bell. The gameplay music uses the menu's harmony and the same tune, and **gets tenser and thinner or fuller as the market does**. Reward sounds begin with the first two notes of T (A to D). Penalty sounds play that interval backwards. The feed and the gameplay music share one hidden mechanic: a **ghost** echo of the melody that grows with the anomaly counter (0 to 12).

---

## 1. What is in the kit

| File | What it is |
|---|---|
| `handoff.md` | This document. |
| `events/menu_opening_bell.json` | Menu score (785 events). |
| `events/feed_act1_melt_up.json`, `feed_act2_tremors.json`, `feed_act3_contagion.json`, `feed_act4_reckoning.json` | Daily-feed scores (314, 306, 528, 53 events). |
| `events/gameplay_act1_melt_up.json`, `gameplay_act2_tremors.json`, `gameplay_act3_contagion.json`, `gameplay_act4_reckoning.json` | **New.** Gameplay scores, one per act (1822, 1872, 2110, 331 events). Each has its intensity curves and track gain inside `mix`. |
| `events/sfx_pack.json` | **New.** All 56 sound effects as data (voices, reverb send, ducking, cooldown, gain). |
| `source/*.py`, `source/sfx_levels.json` | The Python that wrote every score and rendered every preview. `compose.py` (menu and feed), `compose_game.py` (gameplay), `sfx_catalog.py` and `sfxlib.py` (sound effects), `instruments.py`, `synth.py`, `render.py`, `render_adaptive.py`, `checks.py` and the build scripts. Run from inside `source/`: `python3 build_all.py` (menu and feed), `python3 build_game.py 1` to `4` (gameplay), `python3 build_sfx.py` (sound effects). Needs numpy, scipy, matplotlib, ffmpeg. Everything is seeded, so the scores regenerate identically. |
| `previews/menu_and_feed/*.mp3` | The approved menu and feed audio. Each plays the loop once plus the first 10 seconds again so the loop point can be heard. `feed_arc.mp3` is four short excerpts; `feed_act2_anomaly12.mp3` is Act II with the ghost at 12. |
| `previews/gameplay/ref_gameplay_actN_*_i060.mp3` | **New.** One seamless loop of each gameplay act at the **reference intensity 0.6**, at the final loudness (-21 LUFS). This is what the in-game render is compared against. |
| `previews/gameplay/game_session_act1.mp3` | **New.** A full 3:00 Act I trading day with music, tension changes and sound effects mixed in, including ducking. The schedule is in `source/make_game_previews.py`. |
| `previews/gameplay/game_ramp_act2.mp3`, `act3`, `act4`, `game_act2_ghost12.mp3` | **New.** Music-only tension ramps per act, and the ghost at 12 on gameplay Act II. |
| `previews/sfx/*.mp3` | **New.** Every sound effect, plus `anomaly_logged_n1`, `n6`, `n12` and six `text_demo_*` lines. WAV versions are not shipped (size). `python3 build_sfx.py` recreates them exactly. |
| `previews/*_roll.png` | Picture of each score (piano-roll), for orientation. |
| `qa_report.json`, `qa_gameplay.json`, `qa_sfx.json`, `audibility.json` | The measurements in section 9. |

**The scores and the pack are the source of truth.** The game does not need any composing logic. It needs (1) a player for the JSON events with the intensity system (5.4), (2) an SFX player (5.5) and (3) the instrument and voice recipes (section 6). Do not re-derive notes from the description in section 8; load the JSON.

---

## 2. The plan for the code session, in order

1. **Read before writing.** Find how the game makes sound today: Web Audio or files; where the single `AudioContext` lives; how the current menu and trading music start and stop; the music and SFX volume and mute settings; the first-tap unlock; **every existing sound effect and every place in the code that triggers one**; and where the menu, the pre-open phone (Sqwak, `js/ui/screens.js` inside `briefing()` [Guessing]), the trading terminal, the closing report, the decision cards and the cinematics live. **Reuse the existing `AudioContext`, music bus and SFX bus. Do not create a second context.**
2. **Write the mapping table before any code:** existing sound effect, where it fires, new sound id from section 8.4. Anything with no good match keeps its old sound, and goes in a short list for the owner. Sounds in the new pack with no existing trigger are simply unused until the owner asks for one.
3. **Add the fallback setting** (7.8): "Sound style: New / Classic", default New. Keep the old audio code working. Do not delete it.
4. **Build the engine** (5.1 to 5.5) as new modules with the score and pack data in separate data files. Suggested names [Guessing, follow the repo's naming]: `js/audio/music-engine.js`, `js/audio/sfx-engine.js`, `js/audio/music-data.js`, `js/audio/sfx-pack.js`.
5. **Wire the menu** (7.1). Check by ear against `previews/menu_and_feed/menu_opening_bell.mp3`.
6. **Wire the feed** (7.2) with the act mapping and skip behaviour. Check each act against its preview.
7. **Wire the gameplay music** (7.6): start on the bell, the intensity input, the close sequence. Check each act against its `ref_*_i060.mp3`.
8. **Wire the sound effects** (7.7), highest-traffic first (orders, clicks, Sqwak posts), then the rest. Enforce cooldowns, voice limits and ducking.
9. **Add the ghost** (7.3) for the feed and for the gameplay `lead` layer.
10. **Loudness and A/B pass** (section 10). Render each track and several sounds with an `OfflineAudioContext`, measure, compare to the previews and to `qa_*.json`.
11. **Tests** (section 10).
12. **Optional polish** (7.5), only if the owner asks.

**Do not touch:** the save format, the internal `kind: 'chirp'` key (the Sqwak plan already says never rename it), game balance, and the cinematic visuals. Audio that exists today is **replaced behind the setting**, not deleted.

---

## 3. Musical design (plain English)

### 3.1 The tune T
Five notes. In scale steps counting from the tonic (0): **-3, 0, +2, +1, 0**. In D minor that is **A D F E D**. Rhythm inside an 8-beat phrase (beat, length in beats): (0,1) (1,1) (2,2) (4,1) (5,3). It leaps up to the tonic, climbs a third, leans one step, and comes home. Both the menu and the feed use it.

### 3.2 How T changes (this is the story told in music)

| Where | What happens to T | Technique |
|---|---|---|
| Menu, sections B and A' | Played by a lead synth, moved up or down with each chord (A D F E D, then F Bb D C Bb, then D G Bb A G) | Diatonic sequence |
| Menu, section C | Bells play T at half speed, then T mirrored (G D Bb C D) | Augmentation, then inversion |
| Feed Act I (F major) | Piano plays C F A G F, then walks it across the four chords | Sequence |
| Feed Act II (F minor) | Same tune, same chord shape, but the third note drops a half step (C F Ab G F) | Parallel minor (mode change) |
| Feed Act III | Only the first two notes remain (C to F), on a bell, once every four bars | Fragmentation |
| Feed Act IV | Mirrored (Bb F Db Eb F), four times slower, tolled on one bell | Inversion plus augmentation |

### 3.3 The anomaly ghost
The Sqwak header shows "Anomalies: n" from D16 with no explanation. The music reacts to n with no explanation either: a thin, slightly sharp, slightly late echo of the melody is mixed in, stronger as n grows (0 to 12). At n = 0 it is silent. It is a **render-time effect**, not extra events (section 7.3).

### 3.4 Sound world
- **Menu, "Opening Bell":** expensive, slow-burning, a little dread. FM bells, a wide detuned pad, a sub bass, a glassy arpeggio, a heartbeat kick, ticker-tape clicks, clock tocks. D minor, 84 BPM.
- **Feed, "Thumb Scroll":** intimate and low-key, because the player is reading. Soft electric piano, round bass, a two-clack train rhythm (the doc says the feed is read on a train twenty minutes before the desk), tape wobble, hiss and dust. Key centre F. It gets darker act by act (measured brightness falls from 925 to 570 Hz).

---

### 3.5 Gameplay music: "Market Hours" (plain English)

- **One track per act, each a 32-bar loop, all in D minor like the menu.** Act I and II at 112 BPM, Act III at 120, Act IV at 84 (the menu's tempo). 112 is to the menu's 84 as 4 is to 3, so three menu beats equal four gameplay beats and a menu-to-game handover lines up cleanly.
- **It shares the menu's harmony.** Act I plays the menu's exact chord cycle (Dm9, Bbmaj7, Gm9, A7sus4 to A7b9). The game sounds like the same world.
- **It is adaptive.** The game sets one number, **intensity** (0 to 1). Each layer has a curve saying how loud it is at each intensity. Calm market: pad, bass, ticker tape, a soft heartbeat. More tension: piano stabs and clock tocks, then the glass arpeggio, then the tune on the lead, then a four-on-the-floor kick drive. A normal day lives at 0.25 to 0.6, where none of the loud layers play. That is the main defence against listening fatigue.
- **The acts change the sound the same way the feed does:**
  - Act I, Melt-Up: the menu's harmony, confident, lead plays T.
  - Act II, Tremors: a tighter cadence (Gm9, Em7 flat 5, A7 flat 9), a low drone and distant rumbles.
  - Act III, Contagion: a D pedal under Dm9 and Eb major 7. **Four copies of one pattern run at four slightly different speeds** (the four funds running the same model). Copies join as tension rises. They all start together and land together at the loop point. T shrinks to its first two notes on a bell.
  - Act IV, Reckoning: half-tempo and sparse. T is played upside down and very slowly on a bell. It answers to intensity but never gets loud.
- **Timeline of one normal 3-minute day** (design intent): open calm, bump up on news, settle through the midday lull, rise into the close, riser, closing bell.

### 3.6 Sound effects (plain English)

- **Tuned to the music.** Pitched sounds use D minor pentatonic (D F G A C), so they never fight the music, which is in D minor (menu, gameplay) or F (feed, its relative key).
- **The tune is the reward code.** Quota met plays A4 then D5 (T's first two notes). Missed quota, strikes and losses play D5 then A4 (the same interval backwards). The only major third in the whole sound world is the D57 hope chime (F sharp), and the hollow-win ending turns it minor again.
- **Buy goes up a fourth, sell goes down.** Short is three falling notes, cover is three rising.
- **Sqwak is a bird.** Push alerts are two quick chirps (the squawk-box name joke). Wire alerts are teletype taps and bells. Kroll's messages are two low taps, Compliance's are two cold beeps a tritone apart, Imani's are warm.
- **The anomaly sound carries the ghost.** `anomaly_logged` is a thin ping with a ghost copy that gets sharper, later and louder as the count goes up.
- **Deliberate silences.** No sound on price ticks or continuous profit-and-loss updates (too fatiguing over 61 sessions). Dialogue blips are provided but optional.
- **Loud moments duck the music** a few dB (the opening and closing bells, strikes, crashes, endings) so they land without being louder overall.

---

## 4. Methods of composition (what was actually done)

1. **Leitmotif with transformations.** One tune, changed by transposition, mode change, fragmentation, inversion and augmentation (section 3.2). This is the "method" behind the story arc.
2. **Diatonic sequencing.** The tune is moved to each chord's root by counting scale steps, so every note stays in key. Helper: `step_midi(tonic, mode, step)`.
3. **Voice leading by least movement.** For each chord, a brute-force search picks the octave of every chord tone so the whole chord moves as little as possible from the previous chord. It **penalises** notes a semitone apart (crunchy), whole tones low in the register (murky), doubled notes, and cramped low voicings. Result: zero semitone pairs in any pad or piano voicing (checked).
4. **Euclidean rhythm.** The menu's ticker tape is 7 hits spread as evenly as possible over 16 steps, rotated by 3 steps each bar (`rot = (bar*3) % 16`) so it never quite repeats but is fully deterministic.
5. **Phase shifting (Act III).** Two copies of the same 8-note piano pattern. Copy A is exactly on the beat. Copy B runs 1/15 slower (its pattern lasts 64/15 = 4.2667 beats instead of 4). Over 16 bars B slips behind by exactly one whole pattern and lands back in unison **exactly at the loop point**. This mirrors the story's "four funds running the same model".
6. **Additive and subtractive arrangement.** The menu builds in sections: A (bars 1-8) sparse, B (9-16) adds arpeggio, kick and lead, A' (17-24) adds octave doubling and clock tocks, C (25-32) strips to bells and pad, then a riser. Act IV strips the feed to almost nothing.
7. **Harmonic storytelling.** Act I is ii-V-I-vi in F major (Gm9, C13, Fmaj9, Dm9). Act II is the same shape in F minor (Gm7b5, C7b9, Fm9, Dbmaj7). Acts III and IV move slowly through Fm9, Dbmaj7, Bbm9, C7sus4.
8. **Determinism.** Every random choice (timing wobble, velocity variation, tick loudness, noise) uses a fixed-seed generator and is **baked into the JSON**. Same file, same music, every time. The game must not add `Math.random()` to the music (see section 10).
9. **Synthesis only, no samples.** FM synthesis (bell, electric piano), subtractive synthesis (pad, lead, arpeggio, bass), filtered noise (drums, ticks, train, riser, tape hiss), sine-based drone and rumble.
10. **Effects.** Reverb by convolving with a synthetic impulse response (three bands of decaying noise), a ping-pong echo with a low-passed feedback path, chorus and tape wobble from modulated delays, tanh saturation, and a slow filter LFO on the pad.
11. **Loop-safe rendering.** Each track is rendered with a tail, then the tail is folded back onto the start so reverb and echo from the end ring into the beginning. All slow LFO rates are whole numbers of cycles per loop so they line up at the loop point. In the game this happens on its own if the scheduler keeps playing sounds across the loop boundary (section 5).
12. **Checks used** (section 9): notes in key, semitone clash search between melody and chords, loop seam measurement, loudness (ffmpeg ebur128), spectral brightness by act, and pictures of the score and spectrum.

13. **Adaptive layering.** Each layer has a piecewise-linear intensity curve. The engine multiplies the layer's gain by the curve value and eases changes with a 0.4 s time constant. All layers are scheduled all the time so a layer that fades in is already in sync.
14. **Shared harmony and tune across tracks.** The gameplay scores reuse the menu's chord cycle, voice-leading search and T phrases. Act II bends the cycle (Em7 flat 5 to A7 flat 9). Act III holds a D pedal.
15. **Four-copy phase drift (gameplay Act III).** Extends the feed's two-copy idea. Each copy plays the same 8-note cell for a whole number of cycles in 128 beats: 32, 30, 34 and 28 cycles (periods 4, 4.2667, 3.7647 and 4.5714 beats). Copies drift both ways and all realign exactly at the loop point.
16. **Sound effects as data.** Every sound is a list of voices of three types (tone, noise, inst). The same JSON drives the Python preview and the game. No per-sound code.
17. **Closed-loop level setting for sound effects.** Every sound started at a peak target by category. Then each sound's loudness was measured the way a person hears it: A-weighted RMS (which discounts deep bass and credits the 1 to 6 kHz range) over the sound's own active part, compared with one fixed reference, the A-weighted level of the whole 3:00 Act I demo day of music. Each sound was then raised or lowered toward a category margin over that reference (orders +7 dB, buttons +4, Sqwak +7, clock +6, decisions +8, story meters +8, rewards +10, penalties +8, big events +10, cinematics +10, endings +10, dialogue blips +2), limited to a peak of -3 dBFS. Four passes. An earlier version measured each sound in a band around its own brightness and against the music at the moment it played; that made buy 7 dB quieter than sell and made reward bells nearly inaudible, so it was replaced. Results and exceptions are in 9.4.

---

## 5. Engine design (Web Audio)

### 5.1 Score format (every JSON file)
```
{ name, title, bpm, beatsPerBar, bars, loopBeats, loopSeconds, tonicMidi, mode,
  chords: [ {t, d, name, tones, ok, bass, pad|v, voicing} ],   // reference only, the engine does not need it
  events: [ {t, d, n, v, i, l, p, ...extras} ],
  mix:    { layers:{ layer:{gain, rev, dly} }, reverb:{seconds, wet}, delay:{beats, fb, lp, wet},
            pad_filter:[[beat,hz],...], pad_lfo_cycles, pad_q, master:{hp, lp, sat, wobble, hiss, crackle}, target_lufs } }
```
- `t` start and `d` length are in **beats** from loop start. Seconds = beats x 60 / bpm.
- `n` is a MIDI note number (69 = A4 = 440 Hz), or `null` for percussion.
- `v` velocity 0 to 1. `p` pan -1 to 1. `i` instrument id (section 6). `l` layer id (a mixer channel).
- Extras: `tc` (bell ring time constant, seconds), `decay` and `dark` (piano), `attack` and `rel` (pad), `bright` (train clack).
- `ghost` is **not** in the files; the engine creates it (7.3).

### 5.2 Scheduler
Use the standard "look-ahead" pattern: a `setInterval` every 25 ms schedules every event whose start time falls inside the next ~150 ms of `AudioContext` time. Keep `loopStart` (context time) and an index into the time-sorted events. When the index passes the last event, add `loopSeconds` to `loopStart` and reset the index to 0. **Do not cut off sounds at the loop boundary.** Voices ring on and overlap the next pass, which is what gives the seamless loop.

### 5.3 Signal chain (per track)
```
each event -> voice (section 6) -> layer bus [GainNode, StereoPanner per voice]
layer buses: dry sum x layer.gain
             reverb send = bus x layer.gain x layer.rev -> ConvolverNode(IR) -> gain (reverb.wet x 1.2) -> master
             delay  send = bus x layer.gain x layer.dly -> ping-pong -> gain delay.wet -> master  (and x0.3 -> reverb input)
pad layer: voices summed to mono -> BiquadFilter lowpass (frequency automated, see 6.3) -> chorus -> layer bus
master: [tape wobble for feed] -> highpass -> lowpass -> gain 0.9 -> WaveShaper curve tanh(drive x)/tanh(drive) -> GainNode(track gain, see section 9) -> existing music volume node
```
Reverb IR (make it once per track at load): three bands of white noise, left and right different seeds, length `reverb.seconds`. Low band: lowpass 450 Hz, decay to -60 dB at `seconds`. Mid band: bandpass 450 to 2400 Hz, level 0.9, -60 dB at 0.7 x seconds. High band: bandpass 2400 to 7500 Hz, level 0.6, -60 dB at 0.38 x seconds. Pre-delay 20 ms, 3 ms fade-in, then normalise each channel to unit energy. If a 2-channel IR does not behave as expected in `ConvolverNode`, use two mono convolvers and a `ChannelMergerNode`.

Ping-pong echo: delay time = `delay.beats` x 60 / bpm. `input -> delayR -> outR`. `delayR -> lowpass(delay.lp) -> gain(fb) -> delayL -> outL`. `delayL -> lowpass -> gain(fb) -> delayR`. The echo output is **wet only** (no dry copy).

Tape wobble (feed only): a `DelayNode` at 8 ms whose `delayTime` is modulated by an LFO of depth `master.wobble.depth_ms` at `cycles / loopSeconds` Hz (whole cycles per loop so it lines up). Hiss: noise through highpass 300 Hz and lowpass 6.5 kHz at a very low level (about 42 dB below the average level of the mix, so you only notice it in quiet moments and on headphones). Crackle: about 1.5 tiny noise clicks per second at very low level. Both are optional polish; if CPU is tight, drop them first.

Use a **seeded** random generator (for example mulberry32) for every noise buffer and jitter inside the engine. No `Math.random()`.

### 5.4 Intensity system (gameplay music)
- The engine holds one number, `intensity` (0 to 1). The game calls `setIntensity(x)` at most about 4 times a second. The engine does the smoothing.
- Per-layer chain: `layer bus -> intensityGain -> layerGain (mix.layers[L].gain) -> split: dry, reverb send (x rev), echo send (x dly)`. `intensityGain` target = the layer's curve at the current intensity (`mix.intensityCurves[L]`, linear between points), applied with `setTargetAtTime(target, now, 0.4)`. Sends are taken **after** the intensity gain, exactly as the Python preview renders them.
- `mix.trackGain` is the final master multiplier. With it, **intensity 0.6 measures -21.0 LUFS** in the Python render. Measured in Python at intensity 0.15 / 0.6 / 1.0 (LUFS): Act I -25.6 / -21.0 / -19.4, Act II -25.6 / -21.0 / -19.5, Act III -23.9 / -21.0 / -19.7, Act IV -23.8 / -21.0 / -19.1.
- **Always schedule every layer's events.** Optional CPU saving: if a layer's gain has been below 0.01 for more than 2 s, stop scheduling it and resume from the current loop time when it becomes audible again (missing notes already in progress is fine).
- Acts change by session, not mid-session. A session starts the new act's loop at bar 1. No act crossfade is needed.

### 5.5 SFX player
- Load `sfx_pack.json` once. `playSfx(id, opts)`:
  1. **Cooldown:** ignore the call if the same id played less than `cooldown` seconds ago.
  2. **Voice limit:** if `maxVoices` copies of that id are still sounding, fade the oldest to zero over 30 ms and stop it.
  3. **Build the voices** at `now + voice.t` (section 6.10). Sum them into one `GainNode` set to `gain x userSfxVolume`.
  4. **Routing:** that gain goes to the SFX bus (dry) and, times `rev`, to a shared `ConvolverNode` "room" send. Two room impulse responses are built once: 1.4 s and 2.2 s (see 5.3 for how to make an impulse response; predelay 12 ms). Use the one named by the sound's `room`. The convolver output gain is 1.2.
  5. **Ducking:** if `duck` is above 0, pull the music bus down by `duck` dB with a 0.02 s linear attack, hold for `min(0.35 + 0.15 x soundLength, 2.0)` seconds, then release linearly over 0.6 s. A second ducking sound while one is active takes the deeper of the two.
  6. Stop and disconnect the voices after the sound's `durationS`.
- Noise buffers are seeded (any fixed seed per sound id). **No `Math.random()` in audio code.**
- `anomaly_logged` takes `n`; dialogue blips take the character (6.10).
- **Sounds that follow each other:** when one action fires two sounds (closing a winning trade: `order_sell` then `win_close`), play the second **0.25 s** after the first. The demo day does exactly this.

---

## 6. Instrument recipes (each one is Web Audio parts)

Notation: `f` = note frequency, `vel` = event velocity, `t0` = start time, `dur` = event length in seconds. "Envelope" means a `GainNode` driven by `setValueAtTime`, `linearRampToValueAtTime` and `setTargetAtTime`. For lowpass and highpass `BiquadFilterNode`s, the Web Audio `Q` value is in **dB**: `Q_dB = 20 x log10(Q_linear)`. The Q values below are linear (so Q 0.9 = -0.9 dB, Q 1.3 = +2.3 dB, Q 0.7071 = -3 dB). Bandpass `Q` is unitless (use as written).

Each recipe lists the final level. Levels are relative and are set against the layer gains in the mix tables.

### 6.1 `bell` (FM bell)
- Pair 1: carrier `sine` at `f`; modulator `sine` at 3.5 x `f`. Modulator gain node feeds `carrier.frequency` with depth = `index(t)` x 3.5 x `f`. `index(t)` starts at `bright` x (1.2 + 4.2 x vel) + 0.35 (bright defaults to 1) and falls to 0.35 with time constant 0.30 s (`setTargetAtTime`).
- Pair 2: carrier `sine` at 2.76 x `f`; modulator `sine` at 0.5 x `f`; index starts at 1.6 and falls to 0 with time constant 0.18 s.
- Amplitude: pair 1 amplitude falls with time constant `tc` (event extra, default 1.4 s). Pair 2 is mixed at 0.22 and falls with time constant 0.35 x `tc`.
- Hammer tick: 4 ms of white noise, bandpass 3200 Hz Q 1.2, fading linearly to zero, mixed at 0.35.
- Attack ramp 2 ms. Stop the oscillators after min(7 x `tc`, 11) seconds with a 50 ms fade.
- Final gain: (0.35 + 0.65 x vel) x 0.7.

### 6.2 `ep` (electric piano, FM)
- Body: carrier `sine` at `f`, modulator `sine` at `f` (ratio 1). Index starts at (0.9 + 0.9 x vel) x (1 - 0.5 x dark) + 0.25 and falls to 0.25 with time constant 0.9 s.
- Tine: carrier `sine` at `f`, modulator `sine` at 14 x `f`. Index starts at (0.6 + 2.2 x vel) x (1 - 0.7 x dark) and falls to 0 with time constant 0.07 s. Mixed at 0.22 x (1 - 0.6 x dark).
- Envelope: attack 3 ms linear, then decay to 0 with time constant `decay` x (1 - 0.012 x (note - 60)) seconds (`decay` is an event extra; default 1.5). On note end, release with time constant 0.35 s. `dark` defaults to 0.
- Then `gain (0.8 + 0.7 x vel)` -> WaveShaper with curve tanh(1.3 x)/tanh(1.3) -> gain 0.6 x (0.3 + 0.7 x vel).

### 6.3 `pad` (one voice per chord tone)
- Three `sawtooth` oscillators at `detune` -11, 0, +11 cents, each at gain 0.55 / 3. Plus one `sine` at `f` / 2 at gain 0.5.
- Envelope: attack `attack` extra (default 1.3 s) linear to 1, hold at 1, release time constant `rel` extra (default 0.9 s) at note end (note end = `d` beats). Voice gain 0.4 + 0.6 x vel.
- **Shared by the whole pad layer:** one `BiquadFilterNode` lowpass. Its base frequency follows `mix.pad_filter` (a list of [beat, Hz] points, joined with **exponential** ramps, and the last point equals the first so it repeats). A slow LFO moves it by +/-14 percent, `mix.pad_lfo_cycles` whole cycles per loop; implement it as an `OscillatorNode` into a gain of about 240 feeding `filter.detune` (cents). Q linear = `mix.pad_q`.
- Then chorus: two `DelayNode`s at 14 ms and 16 ms, `delayTime` modulated at 0.28 Hz, depth 3.2 ms, LFOs half a cycle apart, one per stereo channel (`ChannelMergerNode`), 55 percent wet and 45 percent dry.

### 6.4 `sub` (menu bass)
- `sine` at `f` plus `triangle` at 2 x `f` at gain 0.28. Envelope: attack 8 ms, decay to sustain 0.6 with time constant 0.5 s, release time constant 0.12 s. Then gain 1.4 -> WaveShaper tanh drive 2.0 (curve tanh(2x)/tanh(2)). Final gain 0.4 + 0.6 x vel.
- The saturation and the octave-up triangle are deliberate: they make the bass audible on phone speakers that cannot play 50 Hz. Keep them.

### 6.5 `soft_bass` (feed bass)
- `sine` at `f` (gain 0.8), `triangle` at `f` (0.35), `sine` at 2 x `f` (0.12). Envelope attack 12 ms, decay to sustain 0.5 with time constant 0.6 s, release 0.15 s. WaveShaper tanh drive 1.4. Final gain (0.4 + 0.6 x vel) x 0.9.

### 6.6 `arp` (glass arpeggio)
- `triangle` at gain 0.6 plus a **pulse wave with 35 percent width** at gain 0.4. Web Audio has no pulse-width control, so build a `PeriodicWave` for a 35 percent pulse, or subtract a delayed inverted sawtooth from a sawtooth.
- Lowpass: frequency set to 1500 + 3200 x vel Hz at the start and `setTargetAtTime` to 650 Hz with time constant 0.12 s. Q linear 1.3.
- Envelope: attack 2 ms, decay to 0 with time constant 0.12 s, release time constant 0.08 s. Final gain 0.25 + 0.75 x vel. Note length is 0.2 beats.

### 6.7 `lead`
- `sawtooth` at gain 0.6 plus `square` (50 percent) at +7 cents at gain 0.5.
- Vibrato: an `OscillatorNode` at 5.2 Hz into `detune` of both oscillators, depth 14 cents, silent for the first 0.22 s then fading up over 0.4 s.
- Lowpass from 3600 Hz falling to 2100 Hz with time constant 0.25 s, Q linear 0.9.
- Envelope: attack 25 ms, decay to sustain 0.85 with time constant 0.3 s, release time constant 0.35 s. Final gain (0.35 + 0.65 x vel) x 0.8.

### 6.8 Percussion and noise
- `kick`: `sine` whose frequency starts at 135 Hz and falls to 45 Hz with time constant 0.035 s; amplitude falls with time constant 0.16 s; 2 ms noise click at 0.2; gain 1.3 -> WaveShaper tanh drive 1.2. Final gain 0.35 + 0.65 x vel. Length 0.55 s.
- `tock`: `sine` at 780 Hz falling with time constant 0.028 s plus white noise through bandpass 1500 Hz Q 2 falling with time constant 0.012 s at 0.5. Final gain (0.3 + 0.7 x vel) x 0.8. Length 0.12 s.
- `tick`: white noise through highpass 5 kHz, falling with time constant 0.006 s, length 30 ms. Final gain 0.3 + 0.7 x vel.
- `clack` (train rail joint): `sine` at 80 + 40 x `bright` Hz falling with time constant 0.045 s (gain 0.9) plus white noise through bandpass at 1400 + 1800 x `bright` Hz, Q 1.4, falling with time constant 0.018 s (gain 0.9). Everything through a lowpass at 3.5 kHz. Length 0.16 s. Final gain 0.3 + 0.7 x vel.
- `riser`: white noise through a bandpass (Q 1.1) whose centre sweeps exponentially from 250 Hz to 6000 Hz over the event length; gain rises as (progress) to the power 2.2; ends exactly at the loop point. Final gain 0.9.

### 6.9 Feed extras
- `drone`: three `sine`s: `f`, `f` x 1.0018 (gain 0.9, so the pair slowly beats) and 2 x `f` (gain 0.25). Envelope attack 2.5 s, hold, release time constant 2.0 s. Final gain 0.5 x (0.4 + 0.6 x vel).
- `tremor`: brown noise (a running sum of white noise with the drift removed, normalised) through a lowpass at 170 Hz. Amplitude is three bumps (Gaussian, width 0.28 s) centred 0.15 s, 0.95 s and 1.9 s into a 3 s event. Final gain 0.3 + 0.7 x vel. Note: this sits in the low mids on purpose; small speakers cannot play deep rumble.
- `ghost`: `sine` at `f` x 2^(cents/1200) plus `triangle` at gain 0.3, through a lowpass at 2.4 kHz. Envelope attack 20 ms, decay to sustain 0.6 with time constant 0.5 s, release 0.4 s. Final gain 0.7 x (0.3 + 0.7 x vel).

### 6.10 Sound-effect voices (`sfx_pack.json`)
Times are in seconds (the pack is a score at 60 BPM). Every sound is a list of voices. Final level per sound = the voice levels summed, times the sound's `gain`.

**Envelope used by `tone` and `noise`:** attack `a` (linear ramp, default 2 ms), exponential decay toward sustain `s` (default 0) with time constant `dtc`, hold for `d` seconds, then release with time constant `rtc` (default 0.04 s, stop after 7 x `rtc`, at most 12 s). In Web Audio: `linearRampToValueAtTime`, `setTargetAtTime`, then `setTargetAtTime` at note end.

**`tone`**: one `OscillatorNode` (`wave` sine, triangle, sawtooth or square; `n` = MIDI or `f` = Hz).
- Glide to `n_end` or `f_end`: default is `setTargetAtTime(end, t, gtc)`. With `ramp: true` use `exponentialRampToValueAtTime(end, t + d)` instead. Apply the same automation to every oscillator in the voice (including the FM modulator).
- `fm {ratio, idx, itc}`: a second sine oscillator at `ratio x f` into a gain feeding the carrier's frequency. Modulation depth in Hz = `idx(t) x ratio x f`, where `idx(t)` starts at `idx` and falls to 0 with time constant `itc`. (The Python render uses phase modulation with index `idx`, which is the same thing.)
- `lp {f0, f1, tc | ramp, q}`: `BiquadFilterNode` lowpass starting at `f0`, sweeping to `f1` the same two ways. `q` is linear, so convert to dB for the node: `q_dB = 20 x log10(q)`.
- `vib {rate, cents}`: an LFO `OscillatorNode` into the carrier's `detune`. `detune` (cents): a constant offset.
- `sat`: `WaveShaperNode` with curve `tanh(sat x) / tanh(sat)`.
- Python uses naive sawtooth and square waves plus a gentle lowpass; in Web Audio use the native band-limited waveforms and skip that lowpass.
- `nScale {cents, delayS, vBase, vPer}` (only on the ghost half of `anomaly_logged`): with anomaly count `n`, add `cents x n` to the detune, delay the voice by `delayS x n` seconds, and multiply its level by `vBase + vPer x n` (capped at 1).

**`noise`**: a seeded white-noise `AudioBuffer` through a `BiquadFilterNode` (`filter` lp, hp or bp; start `f0`; optional sweep to `f1` with `stc` or `ramp`; bandpass `q` is used as written, lowpass and highpass `q` is linear) and the envelope above.

**`inst`**: one of the music instruments from 6.1 to 6.9 (`bell`, `kick`, `tock`, `tick`, `riser`, `tremor` and others). Extra fields such as `tc` or `deep` pass straight through. Its `d` is the note length in seconds (for `riser` and `tremor`, the sweep or pulse length).

**Dialogue blips (`text_blip_*`)**: one blip per printed character. Pitch = `baseMidi` + `[0, 3, 5, 7, 10][charCode % 5]` semitones. Skip spaces and punctuation. Speaker bases: Imani D5 triangle, Kroll A3 square with a 1.2 kHz lowpass, Sana A5 sine, Thorne D3 triangle with a 900 Hz lowpass, Compliance C5 sine, everyone else A4 sine.

### 6.11 Gameplay notes on the recipes
- Act III's four swarm layers use the `arp` recipe (6.6), one note per `d` (about 0.23 to 0.26 s).
- Act IV uses the `pad` recipe (6.3) with `attack` 2.2 s and `rel` 1.5 s, and the `ep` recipe (6.2) with `dark` 0.8 and `decay` 3.0.
- The menu and feed recipes are unchanged.

---

## 7. Wiring it into the game

### 7.1 Menu
- Start `menu_opening_bell` when the main menu is first shown (after the first tap unlocks audio on browsers that require a tap; see 7.4). It loops forever.
- Optional intro: none needed. The first bar is already the opening bell strike.
- On "New game", "Continue" or any action that leaves the menu: fade the master gain to 0 with `setTargetAtTime` (time constant 0.3 s), stop the scheduler after 2 s, then disconnect.

### 7.2 Daily feed (pre-open phone)
- **Which act plays:** by session number. **D1 to D15: Act I. D16 to D30: Act II. D31 to D45: Act III. D46 to D61: Act IV.** (Numbers from the Patch 3 design notes: four acts of 15 sessions plus D61.)
- Start the feed track when the pre-open phone screen opens (fade in with time constant 0.5 s). It loops until the player leaves the phone screen.
- **Skip gesture** (always available, from D1): play `feed_skip`, fade the feed out fast (time constant 0.12 s), stop after 0.8 s. The day then starts as in 7.6.
- **Normal exit** (player reaches the bell): fade out over about 1 s, then the day starts as in 7.6.
- When the phone screen appears, play `phone_open`.
- **Endless mode** [Guessing whether it has a pre-open feed]: use Act I.
- **Weekend and Monday feeds** use the same act track.
- The **phone-in-hand breaking-news cutscenes** (D13, D24, D31, D34, D52, D56, D57, D60) happen after the 4:00 bell, not in the pre-open feed. Use only `cutscene_hit` and `cutscene_whoosh` (7.7) where a cinematic already makes a sound today.

### 7.3 Anomaly ghost
- Input: the anomaly counter `n` (integer 0 to 12, the same number shown in the header).
- If `n` is 0, do nothing. Otherwise, for **every event on a ghost layer** also schedule a `ghost` voice. The ghost layer is `melody` in the feed scores, and `lead` in the gameplay scores (listed in `mix.ghostLayers`). The ghost voice:
  - start = event start + n x 15 ms
  - velocity = min(1, event.v x (0.22 + 0.045 x n))
  - `cents` = 3 x n (sharp)
  - pan = -event.p - 0.1 (opposite side)
  - layer gain 0.5, reverb send 0.4, echo send 0
- Update `n` at the moment the phone screen opens (once per session). No smooth ramp needed. The gameplay music uses the same `n` for the whole day. Reference: `previews/gameplay/game_act2_ghost12.mp3`.
- Reference audio: `previews/feed_act2_anomaly12.mp3` (n = 12).
- Acts II to IV only matter in practice, since the counter appears from D16. Act I always has n = 0.

### 7.4 Browser rules
- Audio can only start after a user tap or key press on many browsers. If the menu opens before any gesture, queue the start and begin on the first gesture. Reuse whatever the game already does for this.
- Respect the existing music volume and mute setting: connect the track master to the existing music volume node.
- Do not run audio work when the existing game pauses audio (tab hidden, etc.); follow the existing behaviour.

### 7.5 Optional polish (only if the owner asks; the ideas below are **not rendered and not heard**, apart from the sounds named)
- **D57** (the one-session false hope): when the vote passes, play `hope_chime`. For the feed, an idea: play the Act I feed at 0.8x tempo through a lowpass around 3 kHz, like a memory of Act I.
- **D59** (three items, none about the market): cap the gameplay intensity at 0.4 that day.
- **Report-screen bed:** after the closing bell, play the current gameplay loop at intensity 0.1 (pad, bass and ticker tape only). Not rendered. At 0.15 the loop measures about -24 to -26 LUFS.

### 7.6 Gameplay music (the trading day)
- **Start.** When the pre-open phone ends (skip or normal), play `bell_open` and start the gameplay loop for the act at bar 1 at intensity 0.25, fading the music in with time constant 0.25 s. Act by session number: **D1 to D15 Act I, D16 to D30 Act II, D31 to D45 Act III, D46 to D61 Act IV.** `bell_open` ducks the music 4 dB.
- **Intensity input** (design intent: the variable names are [Guessing], map them to what the game really has, then tune by play):
  `intensity = clamp( 0.25 + 0.45 x volatility + 0.15 x exposure + 0.25 x newsBurst + 0.15 x decisionOpen + closeRush, 0, 1 )`
  - `volatility`: recent market movement, scaled 0 to 1 (for example, the index's absolute return over the last 30 game-minutes divided by a per-act maximum).
  - `exposure`: the player's open position size divided by the allowed size.
  - `newsBurst`: 1 for a big Wire event, falling linearly to 0 over 10 seconds.
  - `decisionOpen`: 1 while a decision card is open.
  - `closeRush`: 0 until 15 seconds before the close, then rises linearly to 1.
  - Cap at 0.35 for the first 10 seconds of the day. Feed the result through `setIntensity`.
  - Design target: an ordinary day spends most of its time between 0.25 and 0.6.
- **The close.** The real-time day is 3 minutes [Certain, from the Sqwak plan]. With T = the closing bell:
  - T minus 10 s to T minus 4 s: `countdown_tick` once a second. T minus 3 s to T minus 1 s: `countdown_final` once a second.
  - T minus 8 s: start `close_riser` and ramp intensity to 1.0.
  - T: play `bell_close` (ducks 5 dB) and fade the music out with time constant 0.5 s. Stop the scheduler after 2.5 s.
  - The demo `game_session_act1.mp3` follows exactly this timing.
- **Decisions.** `decision_prompt` when a card opens. `decision_tick` once a second while the timer is under about 8 seconds. `decision_timeout` if it runs out. `decision_confirm` when the player picks. Timers are 20 to 22 seconds on some days [Certain, from the Patch 3 notes].
- **Big moments.** `flash_crash` when the screen shakes (the Loop on D31, the failed vote on D56). `halt` when a stock is halted (for example Ridgeway on D34). `hope_chime` when the D57 vote passes.
- **Weekends and the closing report** [Guessing whether they have music today]: keep whatever they use now, or use the report bed in 7.5. Ask the owner.
- **Ghost:** 7.3.

### 7.7 Sound effects: which sound plays when
Section 8.4 lists every sound with its trigger, ducking, cooldown and voice limit. Rules on top of that:

- **Never play a sound for price ticks or continuous profit-and-loss changes.**
- Enforce `cooldown` and `maxVoices` from the pack. The buy and sell sounds are the most frequent sounds in the game, so test them by tapping quickly.
- Two results at once: `order_sell` (or `order_cover`) first, `win_close` or `loss_close` 0.25 s later.
- Sqwak in market hours: at most one `sqwak_post` per 0.4 s however many posts arrive.
- `anomaly_logged` takes the anomaly count `n` after the increment (1 to 12).
- `quota_met` once per day at the moment it is reached. `quota_missed` at the closing report if under quota. `week_made` on the Friday close if the weekly quota is made. `strike_added` when a career strike is added. `heat_up` when heat rises (the 0.5 s cooldown covers bursts).
- Endings (`ending_*`) play once when the ending screen appears.
- Dialogue blips (`text_blip_*`): only if the game already prints dialogue one letter at a time.
- Sounds under 50 ms long can be dropped on some phones. Check `ui_click` and the dialogue blips on a real device.
- Sound-effect volume follows the existing SFX setting. Music volume follows the existing music setting. Ducking is applied on top of the music setting.

### 7.8 Keeping the old audio (fallback)
- Add a setting **"Sound style: New or Classic"**, default New. Store it with the other settings, **not in the save file**, so save compatibility is untouched.
- Classic runs the existing code unchanged. New runs the engines in this document. Only one is active at a time.
- Keep Classic until the owner has played several full sessions and says to remove it. Do not delete the old code in this work.
- If the owner wants a mix (new music, old sound effects), the two halves are independent: music and SFX can each have their own toggle.

---

## 8. The exact composition

Times in this section are in bars and beats of the loop. Bar 1 beat 0 is the loop start. All notes below are in the JSON; this is the readable map.

### 8.1 Menu: "Opening Bell"
- **Key** D minor (declared extra note: C sharp, the leading tone, used only in the A7 bars). **Tempo** 84 BPM, 4/4. **Length** 32 bars = 128 beats = 91.43 s. **Tonic for step maths** MIDI 74 (D5).
- **Sections:** A bars 1-8, B bars 9-16, A' bars 17-24, C bars 25-32.
- **Chord cycle** (8 bars, repeated four times, so once per section): Dm9 (bars 1-2), Bbmaj7 (3-4), Gm9 (5-6), A7sus4 (7), A7b9 (8). First cycle voicings (later cycles can move by octave for smoother voice leading; use the JSON):

| Bars | Beat start | Length (beats) | Chord | Pad or piano voicing (low to high) | Bass root |
|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Dm9 | D3 F3 A3 C4 E4 | D2 |
| 3-4 | 8 | 8 | Bbmaj7 | D3 F3 Bb3 A4 | Bb1 |
| 5-6 | 16 | 8 | Gm9 | D3 F3 Bb3 G4 A4 | G1 |
| 7 | 24 | 4 | A7sus4 | E3 A3 D4 G4 | A1 |
| 8 | 28 | 4 | A7b9 | E3 A3 Db4 G4 Bb4 | A1 |

**What plays in each section**

| Layer | A (1-8) | B (9-16) | A' (17-24) | C (25-32) |
|---|---|---|---|---|
| pad | yes | yes | yes | yes |
| bass (`sub`) | one long root per chord | pulse pattern | pulse pattern | one long root per chord |
| bell | strikes at the start of each chord, low D plus high D at bar 1 | same, softer | same, plus an octave-up bell | T in augmentation (bars 25-28), then T inverted (bars 29-32) |
| arp | none | 16th notes | 16th notes, louder | none |
| lead | none | T phrases | T phrases an octave up, plus an octave-below double (`lead2`) | none |
| kick (heartbeat) | none | lub-dub twice a bar | lub-dub twice a bar | one soft beat per bar to bar 30 |
| tock | none | none | beats 2 and 4 | none |
| tick (ticker tape) | fades in from bar 5 | full | fuller | fades out from bar 29 |
| riser | none | none | none | bars 31-32 (beats 120-128) |

**Bass pulse pattern (B and A'), per 4-beat bar of a chord:** root at beat 0 (1.75 beats long), root at beat 2.5 (0.5 long, softer), then at beat 3.5 (0.45 long) the octave above in the first bar and the fifth above in the second bar. A7 bars only get the first-bar pattern.

**Arp:** 16 sixteenth-notes per bar, each 0.2 beat long, alternating pan -0.22 and +0.22. The notes come from the chord tones stacked between MIDI 57 and 81 (a ladder); starting from the first ladder note at or above MIDI 62, the step pattern is `[0,1,2,3,2,1]` repeated (first bar of a chord) or `[0,2,1,3,2,4,3,2]` repeated (second bar). Accent per step within a beat: 0.9, 0.45, 0.62, 0.45 (times 0.68 in section B).

**Lead phrases** (each 8 beats, over one chord; rhythm of T: beat 0 length 1, beat 1 length 1, beat 2 length 2, beat 4 length 1, beat 5 length 3):

| Over | Notes |
|---|---|
| Dm9 | A4 D5 F5 E5 D5 |
| Bbmaj7 | F4 Bb4 D5 C5 Bb4 |
| Gm9 | D4 G4 Bb4 A4 G4 |
| A7sus4 then A7b9 (8 beats) | E4 (beat 0, 1 long), A4 (1, 1), D5 (2, 2), C#5 (4, 1.5), Bb4 (5.5, 0.5), A4 (6, 2) |

Section B plays these at velocity 0.7. Section A' plays them an octave up at velocity 0.88 and doubles them at the written pitch at velocity 0.45 (`lead2`).

**Bells:** at the start of each cycle in A, B and A' (beats 0, 32, 64) a low D4 (MIDI 62, `tc` 2.2, 8 beats long) rings, and on the cycle beats 0, 8, 16, 24 and 30 come tolls at D5 (74), F5 (77), D5 (74), E5 (76) and C#5 (73), velocities 0.8, 0.65, 0.6, 0.6, 0.55, scaled by 1.0 (A), 0.75 (B), 0.8 (A'), `tc` 1.5 (the C# bell uses `tc` 0.7 so the leading tone is nearly gone when the D arrives). In A' each toll also gets an octave-up bell at half velocity. Section C (beats 96-127): T augmented starts at beat 96: A4 (96), D5 (98), F5 (100), E5 (104), D5 (106). Then T inverted starts at beat 112: G5 (112), D5 (114), Bb4 (116), A4 (120), C#5 (124). Velocity 0.7, `tc` 1.8, 8 beats long. The C#5 at beat 124 rings into the D strike at the loop point (a leading tone resolving over the loop seam).

**Percussion:** kick pattern per bar in B and A': hits at beats 0 (v 0.9), 0.45 (0.5), 2 (0.8), 2.45 (0.45). Tock in A': beat 1 (v 0.55, pan -0.3) and beat 3 (v 0.45, pan +0.3). Ticks: 7-in-16 euclidean, rotated `(bar*3) % 16`, pan alternating -0.4 and +0.4, each hit's velocity = section level x a fixed random 0.55 to 1.0 (baked into the JSON). Section levels: bars 5-8 rising 0.25 to 0.43, B 0.7, A' 0.8, bars 25-28 0.6, 29-30 0.4, 31-32 0.2.

**Mix (menu):**

| Layer | Level (gain) | Reverb send | Echo send |
|---|---|---|---|
| pad | 0.36 | 0.3 | 0.0 |
| bass | 0.42 | 0.0 | 0.0 |
| arp | 0.5 | 0.3 | 0.65 |
| lead | 0.48 | 0.35 | 0.35 |
| lead2 | 0.38 | 0.35 | 0.3 |
| bell | 0.55 | 0.6 | 0.2 |
| kick | 0.6 | 0.02 | 0.0 |
| tock | 0.4 | 0.15 | 0.0 |
| tick | 0.1 | 0.1 | 0.05 |
| riser | 0.2 | 0.35 | 0.0 |

Other mix settings (also in the JSON `mix` block):

```json
{
 "reverb": {
  "seconds": 3.4,
  "wet": 0.55
 },
 "delay": {
  "beats": 0.75,
  "fb": 0.46,
  "lp": 3200.0,
  "wet": 0.55
 },
 "pad_filter": [
  [
   0,
   700
  ],
  [
   32,
   760
  ],
  [
   48,
   1100
  ],
  [
   64,
   1250
  ],
  [
   80,
   1800
  ],
  [
   96,
   1500
  ],
  [
   112,
   900
  ],
  [
   128,
   700
  ]
 ],
 "pad_lfo_cycles": 2,
 "pad_q": 0.9,
 "master": {
  "hp": 28.0,
  "lp": 11000.0,
  "sat": 1.15,
  "wobble": null,
  "hiss": 0.0,
  "crackle": 0.0
 },
 "target_lufs": -17.0
}
```

### 8.2 Feed: "Thumb Scroll" (all four acts)
Common to all acts: 16 bars, 4/4, tune steps counted from F5 (MIDI 77). Loop lengths: Act I and II 49.23 s (78 BPM), Act III 45.71 s (84 BPM), Act IV 64.0 s (60 BPM).

**Act I, Melt-Up** (F major, 78 BPM). Chords, two bars each, played twice through: Gm9, C13, Fmaj9, Dm9.

| Bars | Beat start | Length (beats) | Chord | Pad or piano voicing (low to high) | Bass root |
|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Gm9 | Bb3 D4 F4 A4 | G2 |
| 3-4 | 8 | 8 | C13 | Bb3 D4 E4 A4 | C2 |
| 5-6 | 16 | 8 | Fmaj9 | A3 C4 E4 G4 | F2 |
| 7-8 | 24 | 8 | Dm9 | F3 C4 E4 A4 | D2 |

- **Piano comping** (`ep`, layer `ep`): three soft stabs per bar (bar 1 of a chord: beats 0, 1.75, 3 at velocities 0.8, 0.5, 0.6; bar 2: beats 0, 2, 3.25 at 0.75, 0.5, 0.45). Each chord is strummed 0.03 beat per voice, timing wobble up to +/-12 ms (baked in), velocity variation 0.92 to 1.05 (baked in), pan by pitch -0.35 to +0.35, `decay` 1.3.
- **Bass** (`soft_bass`) per 8-beat chord: root at beat 0 (1.5 long, v 0.8), fifth at 2.5 (0.6 long, v 0.5), root at 4 (1.25 long, v 0.7), octave at 6.5 (0.6 long, v 0.45).
- **Melody** (layer `melody`, instrument `ep`, pan +0.18, `decay` 2.2): first pass the tune arrives late. Beat 16 (over Fmaj9): T = C5 F5 A5 G5 F5 at v 0.8. Beat 24 (over Dm9): a fragment F5 (1.5 long), E5 (0.5), C5 (4 long) at v 0.7. Second pass: beat 32 (over Gm9) T moved up one step: D5 G5 Bb5 A5 G5 (v 0.85); beat 40 (over C13): G4 C5 E5 D5 C5; beat 48 (over Fmaj9): T again (v 0.9); beat 56 (over Dm9): the fragment again.
- **Train** (`clack`): two clacks (offset 0.33 beat, v 0.55 then 0.38, pan -0.2) at beat 0 and beat 2 of every bar.

**Act II, Tremors** (F minor, 78 BPM). Same layout as Act I with these changes.

| Bars | Beat start | Length (beats) | Chord | Pad or piano voicing (low to high) | Bass root |
|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Gm7b5 | G3 Bb3 Db4 F4 | G2 |
| 3-4 | 8 | 8 | C7b9 | G3 Bb3 Db4 E4 | C2 |
| 5-6 | 16 | 8 | Fm9 | Ab3 C4 Eb4 G4 | F2 |
| 7-8 | 24 | 8 | Dbmaj7 | Ab3 Db4 F4 C5 | Db2 |

- Melody: beat 16 (over Fm9): T with the minor third: C5 F5 Ab5 G5 F5; beat 24 (over Dbmaj7): F5 Eb5 C5 fragment; beat 32 (over Gm7b5): Db5 G5 Bb5 Ab5 G5; beat 40 (over C7b9): G4 C5 E5 Db5 C5; beat 48: T minor; beat 56: fragment. Colour notes deliberately allowed against the chords: Ab over Gm7b5 (the flat nine), Eb over Dbmaj7 (the nine).
- **Train** drops its clacks in every fourth bar (bars 4, 8, 12, 16).
- **Tremors** (`tremor`): at beats 14.5, 30.5, 46.5 and 62.5 (3 s each), velocities 0.6, 0.7, 0.8, 0.9.
- **Drone** (`drone`): F2 (MIDI 41, v 0.55) and C3 (48, v 0.4), two overlapping events at beats 0 and 32, 34 beats long each.

**Act III, Contagion** (F minor, 84 BPM). Four bars per chord.

| Bars | Beat start | Length (beats) | Chord | Pad or piano voicing (low to high) | Bass root |
|---|---|---|---|---|---|
| 1-4 | 0 | 16 | Fm9 | Ab3 C4 Eb4 G4 | F2 |
| 5-8 | 16 | 16 | Dbmaj7 | Ab3 Db4 F4 C5 | Db2 |
| 9-12 | 32 | 16 | Bbm9 | Ab3 Db4 F4 Bb4 | Bb1 |
| 13-16 | 48 | 16 | C7sus4 | G3 C4 F4 Bb4 | C2 |

- **The loop** (layers `osc_a` and `osc_b`, instrument `ep` with `decay` 0.9 and `dark` 0.4, pans -0.55 and +0.55): the 8-note cell is F4 C5 G4 Eb5 Bb4 C5 F4 G4 (MIDI 65 72 67 75 70 72 65 67), eighth notes, velocities 0.62 x [1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]. **Copy A** plays the cell 16 times, cell starts every 4 beats. **Copy B** plays it 15 times, cell starts every 64/15 = 4.26667 beats, with its 8 notes spread evenly across that time. Both begin together at beat 0 and end together at beat 64.
- **Pad** (`pad`): the chord voicing, v 0.6, whole chord length. **Bass**: eighth-note pulses on the root (octave above on the 4th eighth of each half bar), v 0.5 and 0.32 alternating.
- **Bell fragment** (layer `melody`, instrument `bell`, `tc` 1.3, v 0.45, pan +0.2): C5 at beat 16k + 6 and F5 at beat 16k + 8, for k = 0 to 3. This layer feeds the ghost.
- **Train:** two clacks on every beat (fast).

**Act IV, Reckoning** (F minor, 60 BPM). Same chords and voicings as Act III, four bars each.

- **Pad** with slow attack (2.2 s), release time constant 1.5 s, v 0.55. **Piano** (`ep`, `decay` 3, `dark` 0.8, v 0.38): each chord rolled slowly upward, one voice every 0.9 beat, at the start of each chord. **Bass** one note per chord, 6 beats long, v 0.55.
- **Bell tolls** (layer `melody`, `tc` 2.2, v 0.65, 12 beats long, pan +0.15): Bb5 (82) at beat 0, F5 (77) at 16, Db5 (73) at 32, Eb5 (75) at 48, F5 (77) at 60. This is T inverted and stretched to four times its length. The F at beat 60 rings into the loop start.
- **Drone** as in Act II. **Train:** one distant clack pair at beat 2 of bars 4, 8, 12, 16 (v 0.32 and 0.22).

**Feed mix per act** (layer gains; sends are in the JSON):

| Setting | Act I | Act II | Act III | Act IV |
|---|---|---|---|---|
| reverb length | 1.8 s | 2.2 s | 2.6 s | 4.6 s |
| reverb wet | 0.5 | 0.5 | 0.5 | 0.75 |
| echo feedback | 0.32 | 0.32 | 0.55 | 0.55 |
| master lowpass | 7800 Hz | 7050 Hz | 6600 Hz | 5700 Hz |
| tape wobble depth | 1.8 ms | 2.4 ms | 3.0 ms | 3.6 ms |
| target loudness | -22.0 LUFS | -22.5 | -22.5 | -25.0 |

Common: echo time 0.75 beat, echo lowpass 2600 Hz, echo wet 0.5, master highpass 40 Hz, saturation drive 1.25, hiss 0.0035, crackle 0.0007, wobble 25 whole cycles per loop. The exact numbers per act are in each JSON `mix` block.

Feed layer gains (Act I as the example; all acts are in the JSON):

| Layer | Level (gain) | Reverb send | Echo send |
|---|---|---|---|
| ep | 0.42 | 0.25 | 0.1 |
| melody | 0.54 | 0.32 | 0.22 |
| bass | 0.5 | 0.0 | 0.0 |
| train | 0.17 | 0.12 | 0.0 |
| tremor | 0.32 | 0.2 | 0.0 |
| drone | 0.22 | 0.3 | 0.0 |
| pad | 0.42 | 0.35 | 0.0 |
| osc_a | 0.36 | 0.15 | 0.4 |
| osc_b | 0.36 | 0.15 | 0.4 |

### 8.3 Gameplay: "Market Hours"
Bar 1 beat 0 is the loop start. All notes are in the JSON; this is the readable map.

**Common to all four acts.** 32 bars of 4/4 (128 beats). Step maths use tonic D5 (MIDI 74, D minor). The loop is four cycles of 8 bars (32 beats). Tempo and loop length: Act I 112 BPM, 68.571 s; Act II 112 BPM, 68.571 s; Act III 120 BPM, 64.0 s; Act IV 84 BPM, 91.429 s. Average events per second: Act I about 27, Act II about 27, Act III about 33, Act IV about 4 (measure CPU on a phone at intensity 1.0, Act III is the heaviest).

Every layer listed below is a `l` (layer) value in the events and a key in `mix.layers` and `mix.intensityCurves`.

**Patterns shared by acts (per bar unless stated):**

- **bass** (`sub`): Acts I and II: a 6-in-16 Euclidean rhythm, rotated by 0 steps on even bars and 3 steps on odd bars; each hit 0.32 beat long, velocity 0.95 on step 0 and 0.7 otherwise; on every fourth bar (bar 4, 8, ...) the last hit of the bar is an octave up. Act III: sixteenth notes on D2 (MIDI 38), an octave up on steps 7 and 15, velocity 0.6 and 0.32 alternating, 0.2 beat long. Act IV: one long note per 8 beats (7.6 beats long, velocity 0.8) on the chord root.
- **kick**: Acts I and II: heartbeat at beats 0 (0.9), 0.45 (0.5), 2 (0.8), 2.45 (0.45). `kick2` adds soft hits on beats 1 and 3 (0.5). Act III: a kick on every beat (0.85 on beat 1, 0.7 after) and `kick2` at beat 3.5 (0.4). Act IV: the heartbeat (beats 0 and 0.45) only on every other bar.
- **tick** (ticker tape): 7-in-16 Euclidean, rotated `(bar x 3) mod 16` (Act IV: 3-in-16). Velocity 0.6 x a fixed random 0.55 to 1.0 (baked in the JSON). Pan alternates -0.4 and +0.4.
- **tock**: Acts I and II: beats 1 and 3 (velocity 0.55 and 0.45, pan -0.3 and +0.3). Act III: every beat (0.4). Act IV: beat 2 of every bar (0.5).
- **keys** (`ep`): Acts I and II: four soft stabs a bar at beats 0.75, 1.5, 2.5 and 3.25 (0.5 beat long, velocity 0.6, 0.45, 0.55, 0.4 times a baked random 0.92 to 1.05), strummed 0.03 beat per voice, pan by pitch from -0.3 to +0.3, `decay` 1.0. The voicing is the chord tones minus the bass note, voice-led between MIDI 57 and 76. Act III: none. Act IV: each chord rolled slowly, one voice every 0.9 beat, 4 beats long, velocity 0.38, `decay` 3.0, `dark` 0.8.
- **arp** (Acts I and II only): sixteenth notes, 0.2 beat long, alternating pan -0.22 and +0.22. Notes come from the chord tones stacked between MIDI 57 and 81, starting at the first one at or above MIDI 62. Step pattern `[0,1,2,3,2,1]` (first bar of a chord) or `[0,2,1,3,2,4,3,2]` (second bar), repeated. Accent within a beat: 0.9, 0.45, 0.62, 0.45.
- **pad**: every chord tone, `pad` recipe, velocity 0.7 (Act IV 0.6, with `attack` 2.2 and `rel` 1.5), length = chord length + 0.15 beat (Act IV + 0.5).
- **drone** (Acts II to IV): D2 (MIDI 38, velocity 0.5) and A2 (45, 0.35), 66 beats long, starting at beats 0 and 64. **tremor** (Acts II to IV): at beats 46.5 and 110.5, velocity 0.6, 3 seconds long.
- **bell**: Acts I and II: a low D4 (MIDI 62, `tc` 2.2, 8 beats, velocity 0.9) at each cycle start, plus tolls at cycle beats 0 (D5), 8 (F5), 16 (D5), 24 (E5), 30 (C sharp 5) at velocities 0.64, 0.52, 0.48, 0.48, 0.44 (`tc` 1.5; the C sharp uses 0.7 so the leading tone is almost gone when the D arrives). Act III: low D4 at each cycle start and a D5 at cycle beat 16 (velocity 0.6). Act IV: low D4 (`tc` 2.4) at each cycle start and an F5 at cycle beat 8 (velocity 0.5, `tc` 1.8).

**Lead (the tune T, layer `lead`; ghost layer).**

- **Act I**, cycles 2 (bars 9-16) and 4 (bars 25-32). Cycle 2 at written pitch, velocity 0.75. Cycle 4 an octave up, velocity 0.88, with `lead2` doubling at written pitch, velocity 0.45. Phrases (8 beats each, T's rhythm: beat 0 long 1, beat 1 long 1, beat 2 long 2, beat 4 long 1, beat 5 long 3): over Dm9 A4 D5 F5 E5 D5. Over Bbmaj7 F4 Bb4 D5 C5 Bb4. Over Gm9 D4 G4 Bb4 A4 G4. Over A7sus4 then A7b9 (8 beats) E4 (beat 0, 1 long), A4 (1, 1), D5 (2, 2), C sharp 5 (4, 1.5), Bb4 (5.5, 0.5), A4 (6, 2).
- **Act II**, same cycles and levels. Over Dm9 and Bbmaj7#11 the same two phrases. Over Gm9 then Em7 flat 5 (beats 16 to 24): D4 (1), G4 (1), Bb4 (2), then G4 (1.5), Bb4 (0.5), D5 (2). Over A7b9 (beats 24 to 32): E4 (1), G4 (1), Bb4 (2), then C sharp 5 (1.5), Bb4 (0.5), A4 (2).
- **Act III:** only the first two notes of T on a bell (`tc` 1.3, velocity 0.5, pan +0.2): A4 at cycle beat 1 and D5 at cycle beat 3, once per cycle.
- **Act IV:** T inverted and slowed, tolled on a bell (12 beats long, `tc` 2.2, velocity 0.65, pan +0.15): G5 at beat 0, D5 at 16, Bb4 at 40, C5 at 64, D5 at 80. (A pure 16x stretch would put the third note at beat 32, which clashes with the chord, so it is placed at beat 40 instead.)

**Act III swarm** (layers `swarm_a` to `swarm_d`, instrument `arp`). Cell of 8 notes: G4 D5 C5 F5 D5 F5 C5 D5 (MIDI 67 74 72 77 74 77 72 74), accents `[1.0, 0.55, 0.6, 0.9, 0.55, 0.6, 0.85, 0.5]` x 0.6. All four copies start at beat 0 and end at beat 128:

| Layer | Cycles in 128 beats | Period (beats) | Pan | Joins at intensity |
|---|---|---|---|---|
| swarm_a | 32 | 4.0 | -0.7 | 0.15 to 0.3 |
| swarm_b | 30 | 4.2667 | -0.25 | 0.4 to 0.55 |
| swarm_c | 34 | 3.7647 | +0.25 | 0.6 to 0.75 |
| swarm_d | 28 | 4.5714 | +0.7 | 0.8 to 0.92 |

Note spacing in a copy is period / 8. The notes are G, C, D and F only because those are the only notes that are safe over both Dm9 and Eb major 7.

**Chords and voicings** (first cycle; later cycles may move by octaves for smoother voice leading, use the JSON).

*Act I (the menu's chords):*

| Bars | Beat start | Length (beats) | Chord | Pad voicing (low to high) | Keys voicing | Bass root |
|---|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Dm9 | D3 F3 A3 C4 E4 | F4 A4 C5 E5 | D2 |
| 3-4 | 8 | 8 | Bbmaj7 | D3 F3 Bb3 A4 | F4 A4 D5 | Bb1 |
| 5-6 | 16 | 8 | Gm9 | D3 F3 Bb3 G4 A4 | Bb3 F4 A4 D5 | G1 |
| 7 | 24 | 4 | A7sus4 | E3 A3 D4 G4 | D4 E4 G4 | A1 |
| 8 | 28 | 4 | A7b9 | E3 A3 Db4 G4 Bb4 | Db4 E4 G4 Bb4 | A1 |

*Act II:*

| Bars | Beat start | Length (beats) | Chord | Pad voicing (low to high) | Keys voicing | Bass root |
|---|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Dm9 | D3 F3 A3 C4 E4 | F4 A4 C5 E5 | D2 |
| 3-4 | 8 | 8 | Bbmaj7#11 | D3 F3 Bb3 E4 A4 | F4 A4 D5 E5 | Bb1 |
| 5 | 16 | 4 | Gm9 | D3 F3 Bb3 G4 A4 | Bb3 F4 A4 D5 | G1 |
| 6 | 20 | 4 | Em7b5 | D3 G3 Bb3 E4 | Bb3 D4 G4 | E2 |
| 7-8 | 24 | 8 | A7b9 | E3 G3 Bb3 Db4 A4 | Bb3 Db4 G4 E5 | A1 |

*Act III (D pedal):*

| Bars | Beat start | Length (beats) | Chord | Pad voicing (low to high) | Keys voicing | Bass root |
|---|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Dm9 | D3 F3 A3 C4 E4 | F4 A4 C5 E5 | D2 |
| 3-4 | 8 | 8 | Ebmaj7/D | Eb3 G3 Bb3 D4 | Eb4 G4 Bb4 | D2 |
| 5-6 | 16 | 8 | Dm9 | D3 F3 A3 C4 E4 | F4 A4 C5 E5 | D2 |
| 7-8 | 24 | 8 | Ebmaj7/D | Eb3 G3 Bb3 D4 | Eb4 G4 Bb4 | D2 |

*Act IV:*

| Bars | Beat start | Length (beats) | Chord | Pad voicing (low to high) | Keys voicing | Bass root |
|---|---|---|---|---|---|---|
| 1-2 | 0 | 8 | Dm9 | D3 F3 A3 C4 E4 | F4 A4 C5 E5 | D2 |
| 3-4 | 8 | 8 | Bbmaj7 | D3 F3 Bb3 A4 | F4 A4 D5 | Bb1 |
| 5-6 | 16 | 8 | Gm9 | D3 F3 Bb3 G4 A4 | Bb3 F4 A4 D5 | G1 |
| 7-8 | 24 | 8 | A7b9 | E3 G3 Bb3 Db4 A4 | Bb3 E4 G4 Db5 | A1 |

**Mix and intensity curves per act** (layer gain is the level at full curve value; the curve multiplies it).

*Act I:*

| Layer | Gain at full | Reverb send | Echo send | Intensity curve (intensity:multiplier) |
|---|---|---|---|---|
| pad | 0.36 | 0.3 | 0.0 | 0:0.75, 1:0.45 |
| bass | 0.42 | 0.0 | 0.0 | 0:0.55, 1:1.0 |
| kick | 0.6 | 0.02 | 0.0 | 0:0.0, 0.15:0.0, 0.3:0.8, 1:1.0 |
| kick2 | 0.45 | 0.02 | 0.0 | 0:0, 0.7:0, 0.9:1.0, 1:1.0 |
| tick | 0.1 | 0.1 | 0.05 | 0:0.5, 1:1.0 |
| tock | 0.36 | 0.15 | 0.0 | 0:0, 0.2:0, 0.4:1.0, 1:1.0 |
| keys | 0.4 | 0.25 | 0.25 | 0:0, 0.2:0, 0.45:1.0, 1:1.0 |
| arp | 0.44 | 0.3 | 0.65 | 0:0, 0.4:0, 0.65:1.0, 1:1.0 |
| lead | 0.48 | 0.35 | 0.35 | 0:0, 0.65:0, 0.85:1.0, 1:1.0 |
| lead2 | 0.38 | 0.35 | 0.3 | 0:0, 0.65:0, 0.85:1.0, 1:1.0 |
| bell | 0.5 | 0.55 | 0.2 | 0:0.7, 1:1.0 |

Reverb 2.4 s at wet 0.45. Echo 0.75 beat, feedback 0.4, lowpass 3000.0 Hz, wet 0.5. Master highpass 30.0 Hz, lowpass 10000 Hz, saturation drive 1.15. Pad filter points (beat, Hz): [[0, 700], [32, 760], [48, 1100], [64, 1250], [80, 1800], [96, 1500], [112, 900], [128, 700]]. Track gain 0.2472 (makes intensity 0.6 measure -21.0 LUFS).

*Act II:*

| Layer | Gain at full | Reverb send | Echo send | Intensity curve (intensity:multiplier) |
|---|---|---|---|---|
| pad | 0.36 | 0.3 | 0.0 | 0:0.75, 1:0.45 |
| bass | 0.42 | 0.0 | 0.0 | 0:0.55, 1:1.0 |
| kick | 0.6 | 0.02 | 0.0 | 0:0.0, 0.15:0.0, 0.3:0.8, 1:1.0 |
| kick2 | 0.45 | 0.02 | 0.0 | 0:0, 0.7:0, 0.9:1.0, 1:1.0 |
| tick | 0.1 | 0.1 | 0.05 | 0:0.5, 1:1.0 |
| tock | 0.36 | 0.15 | 0.0 | 0:0, 0.2:0, 0.4:1.0, 1:1.0 |
| keys | 0.4 | 0.25 | 0.25 | 0:0, 0.2:0, 0.45:1.0, 1:1.0 |
| arp | 0.44 | 0.3 | 0.65 | 0:0, 0.4:0, 0.65:1.0, 1:1.0 |
| lead | 0.48 | 0.35 | 0.35 | 0:0, 0.65:0, 0.85:1.0, 1:1.0 |
| lead2 | 0.38 | 0.35 | 0.3 | 0:0, 0.65:0, 0.85:1.0, 1:1.0 |
| bell | 0.5 | 0.55 | 0.2 | 0:0.7, 1:1.0 |
| drone | 0.22 | 0.3 | 0.0 | 0:0.6, 1:1.0 |
| tremor | 0.32 | 0.2 | 0.0 | 0:0, 0.5:0.3, 1:1.0 |

Reverb 2.4 s at wet 0.45. Echo 0.75 beat, feedback 0.4, lowpass 3000.0 Hz, wet 0.5. Master highpass 30.0 Hz, lowpass 9167 Hz, saturation drive 1.15. Pad filter points (beat, Hz): [[0, 700], [32, 760], [48, 1100], [64, 1250], [80, 1800], [96, 1500], [112, 900], [128, 700]]. Track gain 0.2333 (makes intensity 0.6 measure -21.0 LUFS).

*Act III:*

| Layer | Gain at full | Reverb send | Echo send | Intensity curve (intensity:multiplier) |
|---|---|---|---|---|
| pad | 0.3 | 0.35 | 0.0 | 0:0.75, 1:0.45 |
| bass | 0.42 | 0.0 | 0.0 | 0:0.55, 1:1.0 |
| kick | 0.6 | 0.02 | 0.0 | 0:0.0, 0.1:0.0, 0.25:0.8, 1:1.0 |
| kick2 | 0.45 | 0.02 | 0.0 | 0:0, 0.7:0, 0.9:1.0, 1:1.0 |
| tick | 0.1 | 0.1 | 0.05 | 0:0.5, 1:1.0 |
| tock | 0.36 | 0.15 | 0.0 | 0:0, 0.2:0, 0.4:1.0, 1:1.0 |
| lead | 0.48 | 0.35 | 0.35 | 0:0.5, 1:1.0 |
| bell | 0.5 | 0.55 | 0.2 | 0:0.7, 1:1.0 |
| drone | 0.22 | 0.3 | 0.0 | 0:0.6, 1:1.0 |
| tremor | 0.32 | 0.2 | 0.0 | 0:0, 0.5:0.3, 1:1.0 |
| swarm_a | 0.36 | 0.2 | 0.45 | 0:0, 0.15:0, 0.3:1.0, 1:1.0 |
| swarm_b | 0.36 | 0.2 | 0.45 | 0:0, 0.4:0, 0.55:1.0, 1:1.0 |
| swarm_c | 0.36 | 0.2 | 0.45 | 0:0, 0.6:0, 0.75:1.0, 1:1.0 |
| swarm_d | 0.36 | 0.2 | 0.45 | 0:0, 0.8:0, 0.92:1.0, 1:1.0 |

Reverb 2.4 s at wet 0.45. Echo 0.75 beat, feedback 0.5, lowpass 3000.0 Hz, wet 0.5. Master highpass 30.0 Hz, lowpass 8333 Hz, saturation drive 1.15. Pad filter points (beat, Hz): [[0, 620], [64, 760], [128, 620]]. Track gain 0.2773 (makes intensity 0.6 measure -21.0 LUFS).

*Act IV:*

| Layer | Gain at full | Reverb send | Echo send | Intensity curve (intensity:multiplier) |
|---|---|---|---|---|
| pad | 0.42 | 0.45 | 0.0 | 0:0.55, 1:0.9 |
| bass | 0.42 | 0.0 | 0.0 | 0:0.4, 1:1.0 |
| kick | 0.6 | 0.02 | 0.0 | 0:0.0, 0.3:0.0, 0.5:0.7, 1:1.0 |
| tick | 0.1 | 0.1 | 0.05 | 0:0.5, 1:1.0 |
| tock | 0.36 | 0.15 | 0.0 | 0:0, 0.2:0, 0.4:1.0, 1:1.0 |
| keys | 0.36 | 0.4 | 0.15 | 0:0.25, 1:1.0 |
| lead | 0.52 | 0.6 | 0.25 | 0:0.3, 1:1.0 |
| bell | 0.48 | 0.65 | 0.15 | 0:0.55, 1:1.0 |
| drone | 0.22 | 0.3 | 0.0 | 0:0.5, 1:1.0 |
| tremor | 0.32 | 0.2 | 0.0 | 0:0, 0.5:0.3, 1:1.0 |

Reverb 3.6 s at wet 0.6. Echo 0.75 beat, feedback 0.4, lowpass 3000.0 Hz, wet 0.5. Master highpass 30.0 Hz, lowpass 7500 Hz, saturation drive 1.15. Pad filter points (beat, Hz): [[0, 620], [64, 760], [128, 620]]. Track gain 0.3076 (makes intensity 0.6 measure -21.0 LUFS).

### 8.4 Sound-effect pack (56 sounds)
Exact voices are in `events/sfx_pack.json`; this is the catalogue. "Duck" is how many dB the music is pulled down. Peaks are the final normalised peaks measured in the Python renders.

**Buying and selling**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `order_buy` | Two quick glassy notes rising a fourth (A4 to D5). | A buy order fills. | 0.0 | 0.06 | 3 | 0.989 | -9.5 |
| `order_sell` | The same two notes falling (D5 to A4), a little darker. | A sell order fills. | 0.0 | 0.06 | 3 | 1.189 | -7.7 |
| `order_short` | Three falling notes (D5, A4, F4) with a soft thump. | A short sale opens. | 0.0 | 0.06 | 3 | 1.293 | -7.0 |
| `order_cover` | Three rising notes (F4, A4, D5). | A short position is covered. | 0.0 | 0.06 | 3 | 1.242 | -9.3 |
| `order_limit_set` | Tap, tap: an order is resting. | A limit or stop order is placed but not filled. | 0.0 | 0.06 | 2 | 0.848 | -8.8 |
| `order_limit_fill` | A small bright bell ding (D6 over D5). | A resting limit or stop order fills. | 0.0 | 0.08 | 2 | 3.291 | -11.4 |
| `order_reject` | Two dry low buzzes a tritone apart. Nothing happened. | An order is refused (no cash, halted, not allowed). | 0.0 | 0.1 | 1 | 0.388 | -5.9 |
| `order_cancel` | A small falling blip with a puff of air. | A resting order is cancelled. | 0.0 | 0.06 | 2 | 0.253 | -9.4 |
| `win_close` | Rising D minor arpeggio (D5 F5 A5) ending on a tiny bell. | A position closes in profit. | 0.0 | 0.15 | 2 | 2.925 | -7.2 |
| `loss_close` | Falling steps (D5, C5, A4) ending on a low thump. Muted. | A position closes at a loss. | 0.0 | 0.15 | 2 | 1.263 | -3.0 |

**Buttons and screens**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `ui_click` | Glass tap for any button. | Every generic button press. | 0.0 | 0.03 | 3 | 0.202 | -10.5 |
| `ui_tab` | Softer pluck for switching tabs (Home, Explore, Alerts, DMs, Me). | Tab change on the phone or terminal. | 0.0 | 0.04 | 2 | 0.238 | -10.7 |
| `ui_back` | Falling tap for back, close or cancel. | Back, close, dismiss. | 0.0 | 0.04 | 2 | 0.252 | -14.9 |
| `screen_in` | Soft rising air for a panel or screen opening. | A screen, panel or card slides in. | 0.0 | 0.1 | 1 | 0.771 | -10.4 |
| `screen_out` | Soft falling air for a panel or screen closing. | A screen, panel or card closes. | 0.0 | 0.1 | 1 | 0.329 | -9.4 |

**The clock**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `bell_open` | The menu's opening bell: low D4, D5 and a faint D6. One strike. | 9:30 a.m. market open, start of every trading day. | 4.0 | 0.0 | 1 | 11.133 | -7.1 |
| `bell_close` | Closing bell: low D4 and D5, four softer D5 strikes, then one low D3. | 4:00 p.m. market close. | 5.0 | 0.0 | 1 | 14.154 | -6.5 |
| `close_riser` | Noise sweeps upward while a low saw tone climbs two octaves. It ends where the bell begins. | Start it 8 seconds before the closing bell. | 0.0 | 0.0 | 1 | 8.772 | -15.0 |
| `countdown_tick` | A wood tock with a tiny high tick. | Once a second during the last 10 seconds before the close (except the last 3). | 0.0 | 0.2 | 1 | 0.158 | -10.2 |
| `countdown_final` | The same tock with a higher, longer tick. | Once a second for the last 3 seconds before the close. | 0.0 | 0.2 | 1 | 0.197 | -9.5 |

**Decisions**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `decision_prompt` | Three bells (D4, A4, G5) swell in under a low sine. Unresolved on purpose. | A decision card appears (Decisions 1 to 10). | 3.0 | 0.0 | 1 | 5.952 | -8.6 |
| `decision_tick` | A dull low tock. | Once a second while a decision timer is under about 8 seconds. | 0.0 | 0.3 | 1 | 0.196 | -6.4 |
| `decision_timeout` | Low buzz and kick: you waited too long. | A decision timer runs out. | 4.0 | 0.0 | 1 | 1.294 | -3.0 |
| `decision_confirm` | Kick, low bell, tiny click: a choice is locked in. | The player picks a decision option. | 0.0 | 0.0 | 1 | 3.877 | -3.0 |

**Sqwak phone and messages**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `phone_open` | Three tiny ticks and a rising chirp. | The pre-open phone appears. | 0.0 | 0.0 | 1 | 0.837 | -5.9 |
| `sqwak_post` | A tiny pop. | A new Sqwak post appears in the market-hours feed. | 0.0 | 0.4 | 1 | 0.224 | -11.2 |
| `sqwak_push` | Two quick bird-like chirps, the game's name joke. | A Sqwak push alert interrupts the scroll. | 0.0 | 0.25 | 1 | 0.842 | -10.2 |
| `sqwak_alert_wire` | Four teletype taps, then two A5 bell dings. | A big Wire event banner (events marked big) slides in. | 2.0 | 0.5 | 1 | 4.16 | -9.3 |
| `sqwak_resqwak` | Tap, small chirp, tiny D6 tick. No undo, so it should feel final. | The player resqwaks a post. | 0.0 | 0.15 | 2 | 0.514 | -5.7 |
| `sqwak_paywall` | Two dull bonks: you cannot open this. | The player taps a paywalled headline. | 0.0 | 0.3 | 2 | 0.413 | -3.0 |
| `feed_skip` | A quick falling swish and a soft thud. | The one-gesture skip out of the pre-open feed. | 0.0 | 0.0 | 1 | 0.822 | -3.1 |
| `mail_new` | Two bell notes a fifth apart (G5 to D6). | New firm mail (HLST Mail: Research, Ops, Risk). | 0.0 | 0.3 | 1 | 2.954 | -11.4 |
| `dm_imani` | Warm: A5 to D6 on a soft FM tone. | A DM from Imani. | 0.0 | 0.3 | 1 | 0.923 | -10.6 |
| `dm_kroll` | Curt: two low taps and a low bell. | A DM or email from Kroll. | 0.0 | 0.3 | 1 | 2.886 | -8.6 |
| `dm_compliance` | Cold: two thin beeps a tritone apart (E5 and B flat 5). | A Compliance DM (also plays when a post names a ticker). | 0.0 | 0.3 | 1 | 0.71 | -10.9 |
| `anomaly_logged` | A thin D6 ping plus a ghost copy. The ghost gets sharper, later and louder as the anomaly count n grows. | The player opens an anomaly item. Pass n = anomalies logged so far, 1 to 12. | 0.0 | 0.5 | 1 | 0.912 | -12.2 |

**Story meters**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `quota_met` | A4 then D5 on bells: the first two notes of the game's tune. | The daily quota is reached. | 0.0 | 1.0 | 1 | 5.639 | -6.9 |
| `week_made` | The quota notes, then F5, A5, D6 bells and a slow pad swell. | The weekly quota is made (Friday close). | 2.0 | 0.0 | 1 | 8.445 | -3.4 |
| `quota_missed` | D5 then A4 falling, a low sine under the second bell. | The day or week closes under quota. | 0.0 | 0.0 | 1 | 7.05 | -7.4 |
| `strike_added` | D5 then A4 on bells (the tune's opening interval played backwards), and a heavy low thud. | A career strike is added. | 5.0 | 0.0 | 1 | 11.002 | -3.0 |
| `heat_up` | A dark noise swell with a low tone. | The heat meter rises. | 0.0 | 0.5 | 1 | 1.349 | -3.6 |

**Big moments and cinematics**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `flash_crash` | Two deep kicks, a rumble, and a falling siren that wails. | Screen shake days: the Loop (D31) and the failed vote (D56). | 6.0 | 0.0 | 1 | 4.202 | -3.0 |
| `halt` | Three descending beeps (D6, G5, D5) and a low buzz. | A stock halts (limit up or down). | 3.0 | 1.0 | 1 | 1.893 | -6.3 |
| `hope_chime` | D major bells (D5, F sharp 5, A5, D6) over a pad. The only major third in the game. | D57 only: the vote passes. | 2.0 | 0.0 | 1 | 10.644 | -3.0 |
| `cutscene_hit` | A kick, a low bell and a falling noise burst. | Hard cut or impact in a cinematic. | 3.0 | 0.0 | 1 | 5.433 | -3.0 |
| `cutscene_whoosh` | A slow rising swish of air. | Camera moves and transitions in a cinematic. | 0.0 | 0.0 | 1 | 1.957 | -3.0 |

**Endings**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `ending_fired` | One D3 bell, then a low sine. Then quiet. | Ending: Fired. | 6.0 | 0.0 | 1 | 11.716 | -5.5 |
| `ending_wiped` | A saw tone falls from A4 to A1 through a closing filter, then one huge low bell. | Ending: Wiped Out. | 6.0 | 0.0 | 1 | 15.309 | -3.0 |
| `ending_hollow_win` | D major bells, then the third drops to F and the chord turns minor. Reads as a win, feels like a loss. | The win that costs you (Ending 22 and similar). | 3.0 | 0.0 | 1 | 14.113 | -6.5 |
| `ending_unpriced` | Twelve glassy pings, each one sharper than the last, like the anomaly ghost piling up. | The rogue AI ending: the payout will not price. | 3.0 | 0.0 | 1 | 3.417 | -6.7 |

**Dialogue blips (optional)**

| Id | What it is | Plays when | Duck (dB) | Cooldown (s) | Max voices | Length (s) | Final peak (dBFS) |
|---|---|---|---|---|---|---|---|
| `text_blip_imani` | Imani: warm, mid. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.1 | -13.8 |
| `text_blip_kroll` | Kroll: low, blunt. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.1 | -12.3 |
| `text_blip_sana` | Sana: light, bright. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.1 | -17.1 |
| `text_blip_thorne` | Thorne: gravel, low. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.099 | -3.7 |
| `text_blip_compliance` | Compliance: flat, even. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.1 | -14.5 |
| `text_blip_narrator` | Everyone else. Only if the game prints dialogue one letter at a time. | One per printed character (see charVariation). | 0.0 | 0.03 | 2 | 0.1 | -13.6 |

**Category peak targets used before tuning (dBFS):** ui -16, order -12, sqwak -13, reward -9, negative -9, story -8, event -5, text -22, clock -15, decision -10, cutscene -7, ending -6. Several sounds were then adjusted by the closed-loop pass (method 17). The final per-sound peaks are in the table above.

---

## 9. What was measured (Python renders, not the game)

### 9.1 Menu and feed

| Track | Loop | Loudness (LUFS) | True peak (dBFS) | Loop seam jump vs normal sample step | Average brightness (Hz) | Notes outside key | Melody clashes | Semitone pairs in chords |
|---|---|---|---|---|---|---|---|---|
| menu_opening_bell | 91.43 s | -17.0 | -6.9 | x0.57 | 1026 | 0 | 0 | 0 |
| feed_act1_melt_up | 49.23 s | -22.0 | -12.9 | x0.54 | 925 | 0 | 0 | 0 |
| feed_act2_tremors | 49.23 s | -22.5 | -12.7 | x0.43 | 819 | 0 | 0 | 0 |
| feed_act3_contagion | 45.71 s | -22.5 | -11.9 | x0.79 | 766 | 0 | 0 | 0 |
| feed_act4_reckoning | 64.0 s | -25.0 | -13.7 | x0.69 | 570 | 0 | 0 | 0 |

How to read it:

- **Loudness** is integrated loudness measured with ffmpeg `ebur128` on the final normalised render. The menu is meant to be louder than the feed, and Act IV is meant to be the quietest.
- **Loop seam** is the size of the jump between the last and first sample of the loop, compared with a normal sample-to-sample step. Under 1.3 means no click.
- **Average brightness** is the average spectral centroid. It falls act by act (925, 819, 766, 570 Hz), which is the intended darkening. [Certain: measured.]
- **Notes outside key, melody clashes and semitone pairs are all zero.** One exception is expected and declared: in the menu the C sharp bell (the leading tone) is flagged 4 times as "rings into" a D minor chord. It is intentional (a leading tone resolving to the tonic) and is shortened to a 0.7 s ring so it is mostly gone when the D arrives. The four flags are the menu's tolls at beats 30, 62 and 94, plus the octave-up C sharp bell at beat 94.
- **Loudness normalisation.** Python multiplied each finished mix by the gain below, then applied a soft limiter that keeps true peaks under about -1.5 dBFS. The Web Audio chain will not match these numbers exactly, so **measure and re-tune** (section 10).

| Track | Linear gain applied after the mix (Python) | Target loudness |
|---|---|---|
| menu_opening_bell | 0.3572 | -17.0 LUFS |
| feed_act1_melt_up | 0.2056 | -22.0 LUFS |
| feed_act2_tremors | 0.1875 | -22.5 LUFS |
| feed_act3_contagion | 0.2306 | -22.5 LUFS |
| feed_act4_reckoning | 0.1455 | -25.0 LUFS |

### 9.2 Gameplay music (Python renders, not the game)
Loudness and true peak are measured with ffmpeg `ebur128` on one seamless loop rendered at a constant intensity. The middle column is the reference point the track gain was set from.

| Track | Loop | Events | LUFS at intensity 0.15 | 0.6 | 1.0 | True peak at 0.6 and 1.0 (dBFS) | Loop seam vs loudest 1% of steps | Brightness at 0.6 (Hz) | Out of key | Clashes | Semitone pairs | Track gain |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gameplay_act1_melt_up | 68.57 s | 1822 | -25.6 | -21.0 | -19.4 | -9.5 / -8.4 | x0.36 | 1140 | 0 | 0 | 0 | 0.2472 |
| gameplay_act2_tremors | 68.57 s | 1872 | -25.6 | -21.0 | -19.5 | -9.6 / -8.4 | x0.39 | 1062 | 0 | 0 | 0 | 0.2333 |
| gameplay_act3_contagion | 64.0 s | 2110 | -23.9 | -21.0 | -19.7 | -10.4 / -8.6 | x0.06 | 747 | 0 | 0 | 0 | 0.2773 |
| gameplay_act4_reckoning | 91.43 s | 331 | -23.8 | -21.0 | -19.1 | -7.7 / -6.5 | x0.41 | 481 | 0 | 0 | 0 | 0.3076 |

- [Certain] Every melodic note in every gameplay act is in key or a declared colour note. No melody note clashes with its chord. No pad or keys voicing has a semitone inside it.
- [Certain] Bell "rings into" flags: Acts I and II have 3 each (the declared C sharp leading-tone bell ringing toward Dm9, the same as in the menu); Acts III and IV have 0 and 0. An earlier Act III draft had 4 flags; the A4 bell was moved from cycle beat 4 to beat 1 and the D5 from beat 6 to beat 3 to remove them.
- [Certain] Loop seam: the jump between the last and first sample is at most 0.41 of the 99th-percentile sample step in every act at every measured intensity (under 1 means no click). This uses a stricter measure than the menu's table in 9.1.
- [Certain] Loudness grows by about 6 dB from intensity 0.15 to 1.0 in Acts I and II and by about 4 to 5 dB in Acts III and IV (they stay quieter on purpose). Brightness falls act by act (1140, 1062, 747, 481 Hz at 0.6).
- [Certain] Act III swarm: all four copies start at beat 0 and their last notes begin within 0.6 beat of beat 128, so they all realign at the loop point.
- [Guessing] How the Web Audio version compares to these numbers. Section 10 says how to check.

### 9.3 Sound effects (Python renders)
| Category | Sounds | Peak range (dBFS) | Longest (s) |
|---|---|---|---|
| ui | 5 | -14.9 to -9.4 | 0.771 |
| order | 8 | -11.4 to -5.9 | 3.291 |
| reward | 3 | -7.2 to -3.4 | 8.445 |
| negative | 2 | -7.4 to -3.0 | 7.05 |
| event | 5 | -7.1 to -3.0 | 14.154 |
| clock | 3 | -15.0 to -9.5 | 8.772 |
| decision | 4 | -8.6 to -3.0 | 5.952 |
| sqwak | 11 | -11.4 to -3.0 | 4.16 |
| story | 3 | -12.2 to -3.0 | 11.002 |
| ending | 4 | -6.7 to -3.0 | 15.309 |
| cutscene | 2 | -3.0 to -3.0 | 5.433 |
| text | 6 | -17.1 to -3.7 | 0.1 |

- [Certain] 56 sounds rendered, no NaN values, every sound ends below -80 dBFS and also has a 20 ms fade to zero at the end, so nothing cuts off audibly.
- [Certain] Four sounds start with a sharp transient on purpose (`countdown_tick`, `countdown_final`, `decision_tick`, `decision_timeout`): they begin with a wood-block or kick attack. That is not a click bug.
- [Certain] The longest sounds are the bells and endings (up to about 15 s including the reverb tail). They need their nodes kept alive that long.

### 9.4 How loud each sound effect is against the music
Method (also method 17): A-weighted RMS of each sound over its own active part, minus the A-weighted RMS of the whole 3:00 Act I demo day of music (one fixed reference, so timing in the demo cannot distort the result). All 55 sounds were measured (the closing riser is excluded: it is meant to blend into the music). Targets by category:

| Category | Target margin over the music (dB) |
|---|---|
| order | +7 |
| ui | +4 |
| sqwak | +7 |
| clock | +6 |
| decision | +8 |
| story | +8 |
| reward | +10 |
| negative | +8 |
| event | +10 |
| cutscene | +10 |
| ending | +10 |
| text | +2 |

- [Certain] 48 of 55 sounds are within 0.6 dB of their category target.
- [Certain] The other 7 could not reach their target because they are bass-heavy or long and hit the -3 dBFS peak ceiling first. They are listed with their margin and with the music duck that helps them while they play:

| Sound | Category | Measured margin (dB) | Target (dB) | Music duck (dB) | Effective margin while ducked (dB) |
|---|---|---|---|---|---|
| `ending_wiped` | ending | -3.1 | 10 | 6.0 | 2.9 |
| `decision_timeout` | decision | -0.4 | 8 | 4.0 | 3.6 |
| `cutscene_hit` | cutscene | 2.9 | 10 | 3.0 | 5.9 |
| `cutscene_whoosh` | cutscene | 3.2 | 10 | 0.0 | 3.2 |
| `flash_crash` | event | 3.8 | 10 | 6.0 | 9.8 |
| `sqwak_paywall` | sqwak | 5.5 | 7 | 0.0 | 5.5 |
| `strike_added` | story | 6.3 | 8 | 5.0 | 11.3 |

- [Likely] The ones most likely to need a change after listening: `decision_timeout` (the weakest one that plays over gameplay music), then `cutscene_whoosh`, `cutscene_hit` and `sqwak_paywall`. `ending_wiped` has the lowest number, but endings and cinematics probably play without gameplay music under them [Guessing], in which case the margin does not matter.
- This is a measurement of loudness, not a listening test. A phone speaker cannot reproduce deep bass, so bass-heavy sounds will feel quieter than the numbers say.

---

## 10. Definition of done (tests and checks)

**A/B against the previews (the important one).**
1. Render each menu, feed and gameplay track with an `OfflineAudioContext` for one loop plus a few seconds of tail. For gameplay, render each act at **intensity 0.6** and save a WAV.
2. Measure loudness with ffmpeg `ebur128`. Targets: menu -17, feed -22, -22.5, -22.5, -25, **gameplay -21.0 at intensity 0.6** (Acts I to IV). Each must be within **1.5 LU**. If the game's overall output level forces a change, shift **all** tracks together so the gaps between them stay the same.
3. Compare the gameplay render against `previews/gameplay/ref_gameplay_act*_i060.mp3`: loudness within 1.5 LU, brightness (spectral centroid) within 15 percent of `qa_gameplay.json` (1140, 1062, 747, 481 Hz). A bigger gap usually means a filter Q or FM depth was mapped wrongly (lowpass and highpass Q are in dB).
4. Render 10 sound effects (`order_buy`, `order_sell`, `ui_click`, `order_reject`, `win_close`, `bell_open`, `bell_close`, `sqwak_push`, `flash_crash`, `anomaly_logged` at n = 6) and compare their peak level to `qa_sfx.json` within 2 dB and their length within 15 percent.
5. Loop each music track twice and listen to the seam. No click, no gap, no level jump.
6. Play the day: start a session, let the intensity move, hit the close sequence (7.6) and compare with `game_session_act1.mp3`. The owner listens next to the preview.

**Automated tests** [Guessing at the repo's test style; follow the existing one]:
- Every score JSON validates: `t` in `[0, loopBeats)`, `n` an integer 0 to 127 or `null`, `i` a known instrument, `l` a layer present in `mix.layers`. Every gameplay layer has an entry in `mix.intensityCurves`.
- Every pack sound validates: voice `type` is tone, noise or inst; `inst` ids are known; `gain`, `cooldown` and `maxVoices` exist; `duck` is 0 or positive.
- Intensity mapping: for each layer and each of intensity 0, 0.3, 0.6, 1.0 the engine's target gain equals the layer curve's linear interpolation.
- Scheduler with a fake `AudioContext`: events fire in time order, the loop wraps without dropping or doubling a note, `stop()` cancels everything.
- SFX player with a fake clock: cooldown blocks a second play inside the window, `maxVoices` steals the oldest, ducking goes down and returns, the two-result rule (0.25 s) holds.
- Act mapping: sessions 1 to 15 give Act I, 16 to 30 Act II, 31 to 45 Act III, 46 to 61 Act IV, for the feed and for the gameplay music.
- Close sequence: ticks at T-10 to T-4, final ticks at T-3 to T-1, riser at T-8, bell at T, music stopped by T+2.5 s.
- Ghost parameters for n = 0 (nothing), 1, 6 and 12 match 7.3 exactly, on the feed `melody` layer and the gameplay `lead` layer; `anomaly_logged` ghost follows `nScale`.
- Classic and New: the setting switches cleanly, only one is active, the setting is not in the save file, and a save from before this change loads.
- No `Math.random()` in any audio code.
- The existing "no real-world names" test needs nothing new (audio adds no text). All existing tests still pass.

**Manual checks:**
- First-tap unlock works on a phone and on desktop.
- Menu stops cleanly when a game starts. Feed stops cleanly on skip and on reaching the bell. The day starts with `bell_open` and the gameplay loop together.
- Tap buy and sell 20 times quickly: no pile-up, no clicking, no runaway volume.
- The music volume slider, the SFX volume slider and mute still work, separately.
- On a low-end phone at intensity 1.0 in Act III (the heaviest), the music does not stutter. If it does, drop in this order: hiss and crackle (feed), tick layer, tock layer, echo send, arp, then shorten the reverb to 1.5 s.

---

## 11. Known risks and things not verified

- **[Certain] The repo was never read.** The audio engine, file names, hooks, the existing sound list and namespaces are guesses.
- **[Certain] Nothing has been heard by the author and nothing has been run in a browser.** The Python renderer and the Web Audio engine are different programs. Expect small differences: native oscillators are band-limited while the Python ones use a different method; FM at very high notes can alias; filter shapes and envelope curves are close but not identical.
- **[Certain] The gameplay music and sound effects have not been heard by the owner** (only the menu and feed have). They are a draft.
- **[Likely] Listening fatigue in the gameplay music.** Three hours of it. Mitigation built in: a normal day plays only quiet layers, and the tune appears only in tense moments. If it still wears, the first levers are the heartbeat kick and the tock layers, then the bell tolls, then lower the intensity floor.
- **[Likely] Sound-effect pile-up.** Buy and sell fire most often. Cooldowns are 0.06 s; if that is still too busy, raise them or drop the second note of `order_buy` and `order_sell`.
- **[Likely] The FM bell can sound harsh on high notes in Web Audio.** If so, lower the `bright` factor (6.1) or add a lowpass around 9 kHz on the bell layer before touching the score.
- **[Likely] The menu and gameplay bass is heavy on tiny speakers.** Saturation and an octave-up triangle are there to help; if it still disappears, raise the triangle gain.
- **[Likely] 7 bass-heavy sounds could not reach their target loudness** within the peak ceiling (9.4). `decision_timeout` is the weakest one that plays over gameplay music. Judge those by ear first.
- **[Guessing] The existing sound list.** The mapping table (plan step 2) is where this gets resolved. Some existing sounds may have no match, and some new sounds (limit orders, `halt`, dialogue blips) may have no trigger in the game today.
- **[Guessing] The intensity formula** (7.6) uses variable names that may not exist. The curve design (which layer enters at which intensity) is the part that was composed; the input mapping is the part to tune by play.
- **[Guessing] CPU on phones.** The busiest loops run about 27 to 33 scored events a second plus reverb and echo. Measure it.
- **The D57 and D59 ideas, the report-screen bed and the dialogue blips** are ideas or options only. Only `hope_chime` and the dialogue blips were rendered.
- Act III's phase drift and its four copies are subtle on purpose. If the owner cannot hear the drift, the fix is to widen the pans or raise a copy's level, not to change the timing.

---

## 12. Questions for the owner before or during the code session

**Menu and feed** (already approved; ask only if something sounds different in the game):
1. Does the menu feel like Bell to Bell?
2. Is the feed quiet enough to read over, and does it darken enough between acts?
3. Can you hear Act III's two copies drift apart and meet at the loop point? Is the anomaly ghost too subtle, too loud, or right?

**Gameplay music (new, not yet heard when this was written):**
4. Play the full 3:00 demo day. Does the way the music gets tenser and thinner fit how a day feels?
5. Is the calm end too quiet or too empty? Is the top end too busy?
6. In Act III, can you hear the four copies join one by one and drift?
7. Is Act IV too sparse, or right?

**Sound effects (new):**
8. Tap buy and sell over and over. Pleasant, or tiring?
9. Is `order_reject` clear enough? Do `decision_timeout`, the crash siren and the strike sound feel heavy enough (they are the ones the loudness measure could not fully lift)?
10. Do you want the dialogue blips, or is there no letter-by-letter text in the game?

**Decisions for the code session:**
11. Keep "Sound style: Classic" as a fallback setting? (Recommended yes.)
12. Should the weekend screens and the closing report have music (report bed in 7.5), or stay as they are?
13. Should Endless mode use the Act I gameplay music and Act I feed music?
