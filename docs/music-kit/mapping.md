# Which sound plays when (New style)

This is the table the handoff asked for before any code (plan step 2). Left: where the game makes sound. Right: what plays in **New**. **Classic** plays exactly what it always did.

Everything goes through `js/audio/sound.js`. Game code still calls `B.SFX.*` and `B.Music.*`; that file sends each call to the new engine or the old one.

## Music

| Where | Call in the game | New plays |
|---|---|---|
| Main menu, first tap | `Music.play('menu')` | **Opening Bell**, loops |
| Pre-open phone (the briefing) | `Music.play('brief')` | **Thumb Scroll** for the act (D1-15 Act I, D16-30 II, D31-45 III, D46-61 IV). Endless uses Act I. The anomaly ghost is the Sqwak counter at the moment the phone opens |
| Skip Feed button | `Music.skipFeed()` | Feed music drops out fast (0.12 s) and `feed_skip` plays |
| Ring the Opening Bell | `Music.stop()` in `enterOffice` | Feed fades out over about a second |
| 9:30 open | `Music.play('trading')` | **Market Hours** for the act, from bar 1 at intensity 0.25, faded in. Same anomaly ghost on the `lead` layer |
| During the day | `Music.setIntensity(stress, dayPos, game)` | Intensity from the formula below, about four times a second |
| 4:00 close | `endDay()` | `bell_close`, music fades out (time constant 0.5 s) |
| Closing report (after the close cinematic) | `Music.play('close')` | **Report bed**: the day's loop at intensity 0.1 (pad, bass, tape only). Not in the kit; see "Decisions for the owner" |
| Ending screens | `Music.ending(ending, 'endingLight' / 'endingDark')` | **That ending's own score**, `end_<id>`, fading in under the ending sound (see "Ending music" below). Classic style still plays the old chiptune |
| Pause | `Music.duck(true)` | Music dips to 35 percent |
| Music switch / volume | `setEnabled`, `setVolume` | Music stops or returns; slider default (45 percent) plays at the kit's level |

### Intensity (handoff 7.6, mapped to real game values)

`intensity = clamp( 0.25 + 0.45 x volatility + 0.15 x exposure + 0.25 x newsBurst + 0.15 x decisionOpen + closeRush + stressPush )`

| Term | What it is in this game |
|---|---|
| `volatility` | `abs(market.indexMove(30)) / max`, where max is 0.7, 1.2, 1.5 and 3 percent for Acts I to IV |
| `exposure` | `broker.stockGross() / (maxLev x netLiq)` |
| `newsBurst` | 1 when a big Wire or Sqwak item lands, falling to 0 over 10 seconds |
| `decisionOpen` | 1 while a timed decision call is open |
| `closeRush` | 0 until 15 real seconds before the close, then rising to 1 |
| `stressPush` | **Added here, not in the kit.** `0.2 x (stress - 0.6) / 0.4` when stress is above 0.6, so a panic attack or a margin call is never played over a calm bed |

Also from the handoff: capped at 0.35 for the first 10 seconds of the day, and from 8 seconds before the close it climbs to 1.0 with the riser.

**Calibration.** The design target was "an ordinary day spends most of its time between 0.25 and 0.6". The volatility maxima were set from simulated careers (bot traders through all four acts, sampled every game tick): the market's 90th-percentile 30-minute index move is about 0.5, 0.8, 1.0 and 1.3 percent in Acts I to IV, and each maximum is about 1.4 times that. Result:

| Who is trading | Time between 0.25 and 0.6 | Median | 90th percentile |
|---|---|---|---|
| Flat desk, all four acts | 86 to 90 percent | 0.32 to 0.37 | 0.61 to 0.69 |
| Careful trader, Acts I and II | 75 to 80 percent | 0.45 to 0.48 | 0.73 to 0.77 |
| All-in trader, Acts I and II | about 60 to 70 percent | 0.5 or more | about 0.8 |

About 5 percent of a day is above 0.85, which is the last eight seconds (the close). What this cannot say is how it *feels*; that needs a day played with headphones.

## Sound effects

"Plays when" is the game event that exists today. Sounds in the pack with no event are listed at the bottom.

### Buying, selling, results

| Game event | Old sound | New plays |
|---|---|---|
| Market buy fills (opens or adds to a long) | `fill(+)` | `order_buy` |
| Market sell fills (closes or reduces a long) | `fill(-)` | `order_sell` |
| Sell that opens a short | `fill(-)` | `order_short` |
| Buy that covers a short | `fill(+)` | `order_cover` |
| Close position / Flatten | `fill` | `order_sell` (long) or `order_cover` (short) |
| Option buy / sell | `fill(+/-)` | `order_buy` / `order_sell` |
| Limit or stop order placed | `click` | `order_limit_set` |
| Resting limit, stop, stop-loss or take-profit fills | `fill` | `order_limit_fill` |
| Order cancelled | `click` | `order_cancel` |
| Order refused, wrong key in the panic sequence | `reject` | `order_reject` |
| A closing trade leaves more than 0.05 percent of the day's starting equity | `cash` (only over 0.3 percent) | `win_close` or `loss_close`, **0.25 s after** the order sound |
| Client order worked (commission earned) | `cash` | `order_limit_fill` |
| Price ticks, continuous P&L | nothing | nothing (deliberate silence) |

### The clock

| Game event | Old sound | New plays |
|---|---|---|
| 9:30 open | `bell` | `bell_open` (ducks music 4 dB) |
| Trading resumes after a halt | `bell` | `bell_open` |
| Last 15 game minutes | `tick` every half second | replaced by the countdown below |
| T-10 to T-4 seconds | none | `countdown_tick`, once a second |
| T-3 to T-1 | none | `countdown_final`, once a second |
| T-8 | none | `close_riser`, music intensity climbs to 1.0 |
| 4:00 close | none | `bell_close` (ducks 5 dB). Not played on a wipe-out |

T is computed from the market clock and the day length setting, so the countdown holds for 2, 3 and 5 minute days.

### Sqwak, messages, feeds

| Game event | Old sound | New plays |
|---|---|---|
| Phone appears (briefing with a feed) | none | `phone_open` |
| Skip Feed | none | `feed_skip` |
| Tap a feed item | `click` | `ui_click` |
| Open an anomaly for the first time | `click` | `anomaly_logged` with n = anomalies logged so far |
| Tap a paywalled headline | `click` | `sqwak_paywall` |
| Subscribe to The Ledger | `news` | `mail_new` |
| Switch comms tab (Wire, Sqwak, Inbox) | none | `ui_tab` |
| New Sqwak post or Wire headline in market hours | `news` (Wire only) | `sqwak_post` (at most one per 0.4 s) |
| Big Wire event | `news` | `sqwak_alert_wire`, no `sqwak_post` on top |
| Big Sqwak item | none | `sqwak_push` |
| Resqwak | `click` | `sqwak_resqwak` |
| Inbox message from Imani | `news` | `dm_imani` |
| Inbox message from Kroll | `news` | `dm_kroll` |
| Inbox message from Compliance | `news` | `dm_compliance` |
| Any other inbox message | `news` | `mail_new` |
| Imani's desk note popup | `news` | `dm_imani` |

### Decisions, meters, shocks

| Game event | Old sound | New plays |
|---|---|---|
| Story decision card opens | `choice` | `decision_prompt` |
| Player picks a story decision option | none | `decision_confirm` |
| Timed decision call opens | `choice` | `decision_prompt` |
| Other phone call answered | `choice` | `ui_click` |
| Timed decision under 8 seconds | none | `decision_tick`, once a second |
| Timed decision runs out, or the call is missed | none | `decision_timeout` |
| Player picks in a timed decision | none | `decision_confirm` |
| Daily quota reached | none | `quota_met`, once a day |
| Report shows a missed quota (no strike) | none | `quota_missed` |
| Report adds a career strike | none | `strike_added` (plays instead of `quota_missed`, same motif) |
| Friday close makes the weekly quota | none | `week_made` (plays instead of anything else) |
| Heat rises (fake Sqwak rumour, touting a stock you hold) | none | `heat_up` |
| Margin call | `alarm` + margin stinger | `halt` |
| Overnight limit warning | `alarm` | `heat_up` |
| Stock halted (limit up/down) | `halt` | `halt` |
| Circuit breaker, liquidation, wipe-out, the Loop, the failed vote | `crash` (+ breaker stinger) | `flash_crash` |
| The vote passes (D57) | `cash` | `hope_chime` |
| Panic attack starts | `panic` + stinger | `decision_timeout` |
| Panic grounding key right | `ground` | `ui_tab` |

### Endings

| Ending | New plays |
|---|---|
| Wiped Out | `ending_wiped` |
| Fired | `ending_fired` |
| Nobody Turned It Off (the unpriced payout) | `ending_unpriced` |
| Master of the Universe, Clawback, The Everything Rally, The Acquirer, Ward of the State | `ending_hollow_win` (wins that cost you) |
| Every other Career ending | `bell_close` (the old game rang its closing bell here) |

## Ending music

The kit had no ending music, so there is one loop for each of the 22 Career endings, composed afterwards in the same sound world (`source/compose_endings.py`: the same instruments, the same mix chain, the same leitmotif T). They are scores like the others (`events/ending_<id>.json`, key `end_<id>` in the game). Each one does something with T that matches what happened to the player:

| Ending | Music |
|---|---|
| Wiped Out | T taken apart (five notes, four, three), then only the falling fifth D to A. The heartbeat slows and stops |
| Fired | T's rhythm on one note, a clock, and a door at the end |
| Nobody Turned It Off | Four machine voices drifting out of phase; a sharp ghost piles up; one bell and no answer |
| Master of the Universe | Bright D major lounge; halfway the third drops and the same tune goes hollow |
| The Whistleblower | T rising a step each time in D major (the one place the major third is used for real), a growing heartbeat, the tune whole at the end |
| The Revolving Door | T in canon with itself over the same four chords, passing ear to ear |
| Perp Walk | March, camera flashes of ticker tape, handcuff clacks, T upside down |
| The Fall Guy | T plays right, then one note is a semitone off and a thin voice echoes it |
| Cassandra | The same rising question four times, louder, always ending on the dominant |
| The Acquirer | T at half speed, two voices tuning into each other |
| Ward of the State | A chorale over a slow metronome, settling on D minor |
| Clawback | A fast festive loop, then notes are removed until about 40 percent is left |
| The Fund | D dorian, driving, ending on a bare fifth |
| Right, Too Early | T arrives half a beat early each time and a little smaller each time |
| The Everything Rally | F lydian shine over a D pedal that never moves |
| The Lost Decade | One chord, a worn tape, two ostinatos slowly slipping apart |
| Soft Landing | D major, the bass stepping down a stair at a time |
| The Quiet Fortune | A soft pad and T rung very quietly on a bell |
| Replaced | People first, then a machine grid takes over and recites T exactly |
| The Depression | Layers taken away one at a time until a bell tolls T upside down over a drone |
| Quiet Exit | Walking bass, footsteps moving away, T in pieces |
| The Grind | T plain, an even heartbeat, a clock, a commute. No build, no fall |

Endless runs borrow: Margin Death and Sudden Death play Wiped Out; Fired (both kinds) play Fired; Burnout and Walked Away play Quiet Exit; Legend plays The Fund; Retired Rich plays Soft Landing; both Survivors play The Grind.

They were composed without being heard: the checks are the same as for the rest of the kit (every melody note in the key or declared, no melodic semitone clashes with the chord, loudness within 0.3 LU of the target in the game's own render). **What that cannot say is whether they are good.** `audition.html` in this folder plays all 22 through the game's own engine so they can be judged by ear.

## Act III trading music is on the beat

The first Act III "Market Hours" had four arpeggio voices running at 28, 30, 32 and 34 cycles per loop, so most of their notes fell between beats and it sounded off the tempo. They now all play the same eight-note cell on the eighth-note grid (one cell per bar at 120 BPM), starting at different points in the cell so they still chase each other. Every note in the score is on a sixteenth-note grid line (checked). The Act III *phone feed* ("Thumb Scroll") keeps its deliberate drift: that one is meant to slip.

## Cost on the audio thread, and the safety net

The kit was rendered offline, so nobody has heard it run live on a phone. The busiest loops (Act I and II gameplay) cost about a quarter of one core of the machine this was built on, measured as offline render time per second of audio. Most of that is the number of live audio nodes, so every instrument was slimmed (constant gains are baked into the waveforms, panners are shared, voices end when they are 48 dB down) and checked again, note by note, against the kit's Python: the sound did not change.

If a device still cannot keep up, the audio clock falls behind the wall clock. The engine watches for that (10 second window, 5 percent behind) and thins the arrangement in three stages, most expensive layers first: the electric-piano stabs, tick and extra copies; then the glass arpeggio and more copies; then the clock tocks, lead and bells. The bass and pad never go. It only reacts while the tab is visible and the audio is running, and it stays thinned for the rest of the session. **Untested on a real phone**: if the owner hears crackle, try Settings > Sound style > Classic and note the device.

## Kept as they are (no good match in the pack)

These play their **Classic** sound in both styles:

- The phone **ringing** (`ring`).
- The cinematic room tones: `room`, `apartment`, `kitchen`, `transit`, `street`, `broadcast`, `elevator`, `office`. They are very quiet textures and the pack has nothing like them.
- `loss` (never called).

## Dropped in New

- The **stress heartbeat** (`heartbeat`): the new score has its own heartbeat layer, and two out-of-step heartbeats would fight.
- The **closing tick** (`tick`): replaced by the 10-second countdown.
- The **margin and breaker stingers** (`Music.cue`): the new sound effects cover those moments.

## In the pack with nothing in the game to trigger it

`screen_in`, `screen_out`, `ui_back` (no screen transition makes a sound today), `cutscene_hit` and `cutscene_whoosh` (the cinematics make no sound beyond the room tones), and the six `text_blip_*` dialogue blips (the game does not print dialogue a letter at a time). `B.SFX.blip(who, char)` exists for the day a screen does.

## Decisions for the owner

These are defaults chosen so the work could be finished. Each is one line to change.

1. **Report bed.** After the closing bell the quiet gameplay loop plays under the closing report. The kit calls this optional and unheard. Off = delete `close` from `PLAN` in `sound.js`.
2. **Ending music** is new, composed after the kit and never heard by its composer. Anything that sounds wrong is a one-file edit in `compose_endings.py` (then run `build_endings.py`). To go back to the old chiptune for one ending, delete its `end_<id>` from `ENDINGS` in `tools/build-audio-data.js` and rebuild.
3. **Intensity.** The volatility maxima and the small stress push are guesses.
4. **Classic fallback** is on by default (Settings > Sound style), as the handoff recommends.
