# Bell to Bell: 20XX

A stressful Wall Street day-trading simulator. The opening bell rings at 9:30 and the closing bell at 4:00. Your only job is to make as much money as humanly possible in between.

- **Story Mode**: one trading month in 20XX. A housing bubble built on "HYDRA" mortgage bonds is about to burst. Eight political and ethical decisions reshape the market itself, change the rules you trade under, and send you to one of **9 endings**.
- **Endless Mode**: random market regimes and crash days, with difficulty sliders for capital, volatility, leverage, fake rumors, crash odds, fees, margin strictness, stress and interruptions. You pick your own win and lose conditions, and each set of settings has its own local leaderboard.

All companies, people and events are fictional.

## Play

No install and no build. Open `index.html` in any modern browser (Chrome, Edge, Firefox or Safari).

Progress auto-saves at the end of each trading day.

## How it plays

- A trading day takes about 4 real minutes (2 or 7 minutes are available in Settings or Endless setup).
- You can trade stocks long or short, with up to 4x leverage intraday and 2x overnight. There are also market, limit and stop orders, attached stop-loss and take-profit orders, and simplified options (calls and puts, weekly and monthly expiries).
- **Margin calls** set off an alarm and a countdown. If you don't fix it in time, the risk desk liquidates your worst positions.
- **Circuit breakers**: the whole market halts at -7% and -13% and closes for the day at -20%. Single stocks halt after a sudden 10% move.
- Two feeds carry news. The **Wire** is real news. **Chirp** is rumors: some are real and early, many are fake.
- **Stress** rises with losses, leverage, margin calls, ringing phones and a looming close. It brings screen shake and a heartbeat, then fat-fingered orders, then a full **panic attack** that locks you out while your positions keep moving.
- **Interruptions**: phone calls from your boss, clients, tipsters and your mom. Some story decisions arrive as timed phone calls mid-session.

### Keys

| Key | Action | Key | Action |
|---|---|---|---|
| `B` | Buy | `S` | Sell / short |
| `C` | Close selected | `X` | Flatten everything |
| `1`–`5` | Size 10/25/50/75/100% of max | `↑` `↓` | Change ticker |
| `A` | Answer phone | `Esc` | Pause |

## Project layout

```
index.html              game shell
css/style.css           terminal UI, panic effects, newspaper ending
js/core/                namespace, seeded RNG, event bus, storage adapter, calendar
js/market/              tickers, price engine (factor model + news shocks + breakers), news generator
js/trading/             broker (orders, margin, liquidation, fees), options pricing
js/stress.js            stress meter
js/interrupts.js        phone calls, client orders, mid-session decisions
js/game.js              day lifecycle, player actions, save/load
js/ui/                  chart, order ticket, HUD, screens/modals, debug overlay
js/modes/story/         21 days of content, 8 decisions, story engine, 9 endings
js/modes/endless/       presets, config screen, regimes, end conditions, leaderboard
js/tests/               test suite + headless runners
```

## Testing

- **In a browser**: open `tests.html`.
- **With Node** (18+):

  ```bash
  node js/tests/node-run.js              # unit tests + story-graph check (every ending reachable)
  node js/tests/sim-run.js --no-quota    # full headless Story + Endless runs with a bot trader
  ```

- **Debug overlay**: open `index.html?debug=1`. It gives you time acceleration, skip-to-close, story day jumps, live story meters, and forced margin calls and crashes.

## Desktop builds

The game is dependency-free static files with relative paths, and all persistence goes through `js/core/storage.js`. That makes it ready to wrap with [Tauri](https://tauri.app) or Electron for Windows and macOS builds. Swap the storage adapter for a filesystem one when packaging.

## License

MIT
