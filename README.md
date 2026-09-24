# Bell to Bell

A stressful present-day Wall Street simulator rendered in timeless 16-bit pixel art. The opening bell rings at 9:30 and the closing bell at 4:00. Your only job is to make as much money as humanly possible in between.

You sit at a desk on the 41st floor with two CRT monitors: the left one trades, the right one is the phone, the newswire and the rumour mill. A trading day takes about **three real minutes**.

- **Career**: sixty-one trading sessions across thirteen calendar weeks. A compute bubble built on **CASCADE notes** — datacenter leases stapled to consumer loans and stamped AAA — comes apart while a conflict you only ever see on the tape constrains the power grid. Ten decisions reshape the market itself, change the rules you trade under, and send you to one of **22 endings**.
- Every session begins with its own skippable news tableau, followed by a physical phone reveal and the pre-open feed. Twelve unmarked anomalies are hidden in public information; opening them changes what is possible on the final weekend.
- The story uses two false dawns: an eight-session rally that punishes correct shorts, then one violent relief session after the rescue passes before the worst selloff of the campaign.
- **Endless**: random market regimes and crash days, with sliders for capital, volatility, leverage, fake rumours, crash odds, fees, margin strictness, stress and interruptions. The morning analyst outlook is a forecast, right about two days in three, and nobody calls a crash the day before. You pick your own win and lose conditions, and each set of settings has its own local leaderboard.

Every company, person, instrument, agency, country and event in this game is invented. Any resemblance to a real firm, person or event is coincidence, not intention — and a test enforces it (see below).

## Play

No install and no build. Open `index.html` in any modern browser.

## How it plays

- Trade stocks long or short with intraday leverage (half that overnight). Market, limit and stop orders, attached stop-loss and take-profit, and simplified options — calls and puts, weekly and monthly expiries.
- **Margin calls** set off an alarm and a countdown. If you don't fix it in time, the risk desk liquidates your worst positions.
- **Circuit breakers**: the whole market halts at -7% and -13% and closes for the day at -20%. Single stocks halt after a sudden 10% move.
- Two feeds carry news. The **Wire** is real news. **Sqwak** is rumour, and a post from a big account can move a stock for a few minutes whether it is true or not.
- **Sqwak** runs through every career session: authored market-hours posts for all 61 sessions, a Sqwak-styled pre-open phone, and a breaking-news phone insert after the 4:00 bell on the eight biggest days. Every account has a hidden accuracy record: rumours that come true come from sharp accounts, fake ones from hype accounts.
- **Phone tips are unreliable on purpose.** A tip resolves one of four ways: it pays, it's true but already in the price, it runs your way just long enough to get you to size up and then reverses, or it's simply false. Roughly one in three pays. Acting on every call is how you go broke.
- **Stress 2.0** rises with losses, leverage, margin calls, ringing phones and a looming close. It escalates through visible Loaded, Tunnel and Critical impairment. Panic attacks now last under four real seconds at normal speed and an A/S/D grounding sequence ends them immediately. Recovery creates temporary resistance and a cooldown; one true market catastrophe can bypass it. Fat-finger risk is capped and can no longer add a zero.
- **Desk quotas escalate by market regime.** A missed mandate adds one permanent career strike, logged once for that session. The thirtieth strike ends the run. The exact mandate, percentage of book, overnight increase and strike count are visible in the briefing, inbox, closing memo, HUD and debug overlay.
- **Weekly quota** on top of the daily one, reset every Monday: the week has to clear the sum of its daily quotas plus 15%. A missed week is one more career strike; a made week wipes up to two missed days from that week. The orphan final Monday has no weekly quota.
- **Your own money.** The $250k book is the firm's. You are paid every Friday: a $1,300 weekly draw against a bonus of 25% of new career P&L highs (10% if the weekly quota was missed, halved after a 5% drawdown). You get the bigger of the two, never both, and a draw you did not earn is repaid out of future bonus. On top of either, quota pay adds $300 for every session you made quota, cut by the risk desk like the bonus, so steady trading shows in your wallet from the first week. Rent, living costs, a student loan and money home come out the same day. Rent is cash only; unpaid rent runs late fee, landlord calls, eviction notice, then your mother's couch. Being broke is never a game over, but where you sleep sets how much stress you wake up with. On Sundays the Ledger lets you move, from a Queens share up to a penthouse over the park.
- **Your first three sessions are eased in, not taught.** Imani Rhodes, on the next seat, sends a line to your inbox when something you do calls for one: sitting flat, buying with no stop, a phone ringing, clearing quota, the first Sqwak hype pop and its fade, drifting toward the loss limit, holding into the bell. The briefing adds Kroll's mood on session 2 and your money and the risk desk on session 3. After that she goes quiet.
- **Life costs money too.** Five personal decisions land after the closing bell and are paid from your own money, never the book: an AI-managed rent hike, Kroll's bonus advance at the false top, your father's surgery bill, Perry asking for six thousand, and your mother's pension cut. They show up on later payslips and in the ending.
- **The risk desk grades discipline, not just profit.** Every closing memo carries a risk desk review. Breaches: staying in the market after the 3% daily loss limit, opening new trades after it, taking a margin call (no bonus that week), running more than 3.25x leverage, carrying over 1x overnight or getting force-sold, and chasing Sqwak hype within three minutes of the post. Each kind of breach cuts the bonus 15% this week and next; a clean week pays x1.25. A reckless trader can grow a bigger book and still take home less. Hit the loss limit before 3:00 PM and get flat within minutes, with no other breach, and that day's missed quota is excused, once a week. Your boss's patience is shown in every briefing; he can fire you through session 57.
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

- **High-resolution pixel art**, rendered as cached authored storyboard frames: a locked 32-colour palette, a native 640x360 cinematic canvas, integer desktop scaling, 16:9 letterboxing, ordered dithering and bitmap-aligned typography. Pixelify Sans handles display and control lettering, IBM Plex Sans Condensed carries interface copy, and IBM Plex Mono remains reserved for financial data.
- **Cinematics** before the open, on the way into the office, over each weekend, around every decision, at the closing bell and at each ending. A 61-row beat sheet picks each morning's shot and framing; close-ups use eight kinds of document (memo, footnote, rating, Sqwak post, printout, order book, vote tally, voicemail). Every decision opens on the speaker in their own room, and the aftermath shows that room again above what happened. The weather follows the calendar from October amber to January snow. Four mornings change with the choice made the night before, each of the 22 endings has its own prop, and the twelve anomaly mornings each hide one wrong pixel. The news scene leads into a physical phone extraction before the interactive notification feed. Every scene remains skippable, and Settings can cut them to one card or turn them off.
- **Adaptive chiptune score**, synthesized with WebAudio: two pulse voices, a triangle bass and a noise channel. Trading music breathes in and out in phrases, leaving longer office-sound gaps at low stress and staying present more often as stress and the close intensify. `Music.useTrack(name, url)` swaps in a real audio file later without touching the game code.
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
js/modes/story/         61 sessions, pre-open feeds, 10 decisions, story engine, 22 endings
js/modes/endless/       presets, config screen, regimes, end conditions, leaderboard
js/tests/               test suite + headless runners
```

## Testing

- **In a browser**: open `tests.html`.
- **With Node** (18+):

  ```bash
  node js/tests/node-run.js              # unit tests, save round-trips, content lint, story graph
  node js/tests/sim-run.js               # full headless Career + Endless runs with bot traders
  node js/tests/balance-run.js           # deterministic quota calibration
  node js/tests/economy-run.js           # bot careers: discipline must out-earn recklessness
  node js/tests/reachability-run.js      # chronological all-ending reachability
  node js/tests/render-run.js            # native canvas hashes and frame evidence
  node js/tests/browser-run.js           # Chromium viewport, mobile and flow checks
  ```

Alongside the usual engine tests, the suite checks that:

- a **mid-day save restores bit-for-bit** — snapshot at 11:17, rebuild, and every price, position, working order and the equity match, then stay matched all the way to the bell;
- **all 22 ending gates are reachable** without priority collisions, while the chronological decision walk explores more than 59,000 valid paths;
- the **calendar arithmetic holds** at twelve full trading weeks plus one final Monday, with every decision and anomaly on its specified session;
- the **false dawn and collapse arithmetic holds**: no rally gap above 0.4%, no rally session above 2.2%, then -9%, +5%, -4%, -7% and -11%;
- **no real-world company, person or event** appears in any string the game can print, checked with word-boundary matching against a denylist;
- the **pacing holds**: the quota curve tracks the intended market regimes, ordinary panic stays under four real seconds, a day is three real minutes, and tips pay about a third of the time;
- the **quota ledger holds**: each missed mandate creates exactly one permanent strike, legacy saves can rebuild their ledger from history, and the run ends on the configured thirtieth strike;
- deterministic calibration covers conservative, human-like and foresight strategies, and the fast chronological reachability harness resolves all 22 endings through the real story transitions;
- rendered-pixel hashes cover all 61 news boards, all 12 weekends and all 22 ending signatures.

**Debug overlay**: open `index.html?debug=1` for time acceleration, skip-to-close, day jumps, live story meters, forced margin calls and crashes, a save-and-restore-right-now button, and each cinematic on demand.

## Desktop builds

Dependency-free static files with relative paths, and all persistence goes through `js/core/storage.js`. That makes it ready to wrap with [Tauri](https://tauri.app) or Electron. Swap the storage adapter for a filesystem one when packaging.

## License

MIT
