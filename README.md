# Bell to Bell

A stressful present-day Wall Street simulator rendered in timeless 16-bit pixel art. The opening bell rings at 9:30 and the closing bell at 4:00. Your only job is to make as much money as humanly possible in between.

You sit at a desk on the 41st floor with two CRT monitors: the left one trades, the right one is the phone, the newswire and the rumour mill. A trading day takes about **three real minutes**.

- **Career**: fifteen trading days. A compute bubble built on **CASCADE notes** — datacenter leases stapled to consumer loans and stamped AAA — is about to come apart, while a conflict you only ever see on the tape takes the power grid with it. Eight decisions reshape the market itself, change the rules you trade under, and send you to one of **11 endings**.
- **Endless**: random market regimes and crash days, with sliders for capital, volatility, leverage, fake rumours, crash odds, fees, margin strictness, stress and interruptions. You pick your own win and lose conditions, and each set of settings has its own local leaderboard.

Every company, person, instrument, agency, country and event in this game is invented. Any resemblance to a real firm, person or event is coincidence, not intention — and a test enforces it (see below).

## Play

No install and no build. Open `index.html` in any modern browser.

## How it plays

- Trade stocks long or short with intraday leverage (half that overnight). Market, limit and stop orders, attached stop-loss and take-profit, and simplified options — calls and puts, weekly and monthly expiries.
- **Margin calls** set off an alarm and a countdown. If you don't fix it in time, the risk desk liquidates your worst positions.
- **Circuit breakers**: the whole market halts at -7% and -13% and closes for the day at -20%. Single stocks halt after a sudden 10% move.
- Two feeds carry news. The **Wire** is real news. **Chirp** is rumour.
- **Phone tips are unreliable on purpose.** A tip resolves one of four ways: it pays, it's true but already in the price, it runs your way just long enough to get you to size up and then reverses, or it's simply false. Roughly one in three pays. Acting on every call is how you go broke.
- **Stress 2.0** rises with losses, leverage, margin calls, ringing phones and a looming close. It escalates through visible Loaded, Tunnel and Critical impairment. Panic attacks now last under four real seconds at normal speed and an A/S/D grounding sequence ends them immediately. Recovery creates temporary resistance and a cooldown; one true market catastrophe can bypass it. Fat-finger risk is capped and can no longer add a zero.
- **Desk quotas escalate every day.** The exact mandate, percentage of book and overnight increase are visible in the briefing, inbox and physical desk art.
- **Interruptions**: clients with orders to work, your boss calling to shout, tipsters, and your mother. Some decisions arrive as a timed phone call mid-session.

### Saving

Six independent save slots. Press `Esc` any time — including mid-session — and **Save** or **Save & Quit**. You come back to the same minute, with the same positions, the same working orders and the same tape.

This works by deterministic replay: a day is fully reproducible from its seed, its scenario and the events injected into it mid-session, so a save stores the clock and your book rather than the whole market. `js/core/save.js` owns the storage side; `Game.snapshot()` and `Game.resumeDay()` in `js/game.js` own the rest.

A slot that reaches an ending becomes a read-only record and counts toward the endings tally.

### Keys

| Key | Action | Key | Action |
|---|---|---|---|
| `B` | Buy | `S` | Sell / short |
| `C` | Close selected | `X` | Flatten everything |
| `1`–`5` | Size 10/25/50/75/100% of max | `↑` `↓` | Change ticker |
| `A` | Answer phone | `Esc` | Pause / save |
| `A` `S` `D` | Ground during panic | Tap | Grounding buttons |

## Look and sound

- **16-bit art**, drawn procedurally: a locked 32-colour palette, a 4px design grid, 2px bevels, ordered dithering and a 5x7 bitmap font. The cinematic sets now use foreground silhouettes, practical desk details, harder compositions and visibly deteriorating CASCADE paperwork. IBM Plex Mono handles body copy and financial data while Silkscreen is reserved for display lettering.
- **Cinematics** before the open, on the way into the office, at the closing bell and at each ending. They use longer silent holds, hard letterboxing and environmental SFX. Music stays out until the bell or destination screen. Every scene remains skippable, and Settings can cut them to one card or turn them off.
- **Adaptive chiptune score**, synthesized with WebAudio: two pulse voices, a triangle bass and a noise channel. Trading music is deliberately sparse and stays underneath the tape; its layers and tempo tighten gently with stress and the close. `Music.useTrack(name, url)` swaps in a real audio file later without touching the game code.
- **Screen effects** (vignette, shake, chart jitter) can be set to Full, Reduced or Off.

## Project layout

```
index.html              game shell
css/tokens.css          the locked palette + pixel metrics
css/ui.css              components, tables, modals, newspaper ending
css/office.css          desk, monitor bezels, CRT, stress effects
js/core/                namespace, seeded RNG (with restorable state), event bus,
                        storage adapter, save slots, calendar
js/art/                 palette, pixel-art toolkit, cutscene data, cutscene player
js/audio/               synthesized SFX + adaptive music
js/market/              tickers, price engine, news generator
js/trading/             broker (orders, margin, liquidation, fees), options pricing
js/stress.js            stress meter
js/interrupts.js        phone calls, client orders, mid-session decisions, tip outcomes
js/game.js              day lifecycle, player actions, snapshot/restore
js/ui/                  chart, order ticket, HUD, screens, save slots, debug overlay
js/modes/story/         15 days of content, 8 decisions, story engine, 11 endings
js/modes/endless/       presets, config screen, regimes, end conditions, leaderboard
js/tests/               test suite + headless runners
```

## Testing

- **In a browser**: open `tests.html`.
- **With Node** (18+):

  ```bash
  node js/tests/node-run.js              # unit tests, save round-trips, content lint, story graph
  node js/tests/sim-run.js --no-quota    # full headless Career + Endless runs with a bot trader
  ```

Alongside the usual engine tests, the suite checks that:

- a **mid-day save restores bit-for-bit** — snapshot at 11:17, rebuild, and every price, position, working order and the equity match, then stay matched all the way to the bell;
- **every ending is reachable** through some path of the eight decisions (the graph walk explores ~39,000 paths);
- **no real-world company, person or event** appears in any string the game can print, checked with word-boundary matching against a denylist;
- the **pacing holds**: the quota curve rises every day, ordinary panic stays under four real seconds, a day is three real minutes, and tips pay about a third of the time.

**Debug overlay**: open `index.html?debug=1` for time acceleration, skip-to-close, day jumps, live story meters, forced margin calls and crashes, a save-and-restore-right-now button, and each cinematic on demand.

## Desktop builds

Dependency-free static files with relative paths, and all persistence goes through `js/core/storage.js`. That makes it ready to wrap with [Tauri](https://tauri.app) or Electron. Swap the storage adapter for a filesystem one when packaging.

## License

MIT
