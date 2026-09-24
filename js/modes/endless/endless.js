// Endless Mode: configurable difficulty, random regimes, pick-your-own endings, local leaderboard.
(function (B) {
  'use strict';
  const $ = B.el;
  const F = B.fmt;

  const PRESETS = {
    intern: { presetName: 'Intern', capital: 50000, volMult: 0.7, newsFreq: 1, fakeShare: 0.1, crashProb: 0.02, maxLev: 2, feeMult: 0.5, maintStrict: 0.8, stressRate: 0.6, callFreq: 0.6, hypeStrength: 1, dayLength: 180 },
    trader: { presetName: 'Trader', capital: 100000, volMult: 1, newsFreq: 1.2, fakeShare: 0.25, crashProb: 0.05, maxLev: 4, feeMult: 1, maintStrict: 1, stressRate: 1, callFreq: 1, hypeStrength: 1, dayLength: 180 },
    shark: { presetName: 'Shark', capital: 250000, volMult: 1.4, newsFreq: 1.6, fakeShare: 0.4, crashProb: 0.08, maxLev: 6, feeMult: 1.2, maintStrict: 1.1, stressRate: 1.3, callFreq: 1.3, hypeStrength: 1, dayLength: 180 },
    degenerate: { presetName: 'Degenerate', capital: 5000, volMult: 2.2, newsFreq: 2.2, fakeShare: 0.6, crashProb: 0.18, maxLev: 10, feeMult: 1, maintStrict: 1.25, stressRate: 1.7, callFreq: 1.6, hypeStrength: 1, dayLength: 180 }
  };
  const DEFAULT_ENDS = { broke: true, drawdown: false, drawdownPct: 50, sudden: false, quota: false, quotaPct: 0.5, panic: false, target: true, targetMult: 3, days: false, daysN: 20 };

  const SLIDERS = [
    ['capital', 'Starting capital', 5000, 1000000, 5000, (v) => F.money(v)],
    ['volMult', 'Volatility', 0.5, 3, 0.1, (v) => v.toFixed(1) + 'x'],
    ['newsFreq', 'News frequency', 0.3, 3, 0.1, (v) => v.toFixed(1) + 'x'],
    ['fakeShare', 'Fake rumors', 0, 0.8, 0.05, (v) => Math.round(v * 100) + '%'],
    ['crashProb', 'Crash odds / day', 0, 0.3, 0.01, (v) => Math.round(v * 100) + '%'],
    ['maxLev', 'Max leverage', 1, 10, 1, (v) => v + 'x'],
    ['feeMult', 'Fees & slippage', 0, 3, 0.1, (v) => v.toFixed(1) + 'x'],
    ['maintStrict', 'Margin strictness', 0.5, 1.5, 0.05, (v) => v.toFixed(2) + 'x'],
    ['stressRate', 'Stress gain', 0.3, 2.5, 0.1, (v) => v.toFixed(1) + 'x'],
    ['callFreq', 'Phone interruptions', 0, 2.5, 0.1, (v) => v.toFixed(1) + 'x'],
    ['hypeStrength', 'Sqwak hype', 0, 2, 0.25, (v) => (v ? v.toFixed(2) + 'x' : 'off')]
  ];

  const REGIME_NEXT = {
    bubble: [['bubble', 0.55], ['bull', 0.3], ['chop', 0.15]],
    bull: [['bull', 0.55], ['bubble', 0.15], ['chop', 0.25], ['bear', 0.05]],
    chop: [['chop', 0.45], ['bull', 0.25], ['bear', 0.3]],
    bear: [['bear', 0.5], ['chop', 0.25], ['recovery', 0.15], ['panic', 0.1]],
    panic: [['recovery', 0.45], ['bear', 0.35], ['panic', 0.2]],
    recovery: [['bull', 0.4], ['chop', 0.35], ['recovery', 0.15], ['bear', 0.1]]
  };
  const OUTLOOK = {
    bubble: 'Euphoria. Everything is going up and everyone is a genius.',
    bull: 'Steady bull market. Dips are getting bought.',
    chop: 'Choppy, directionless tape. Whipsaws likely.',
    bear: 'Bear market. Rallies are getting sold.',
    panic: 'PANIC. Liquidity is vanishing. Anything can happen.',
    recovery: 'Relief mode. Violent short-covering rallies.'
  };

  // The analyst outlook is a forecast, not the answer. Crash days are never
  // called in advance: the analysts see the tape the day before, so a crash
  // is forecast as whatever came before it, or as nervous chop. Ordinary days
  // are called right about two times in three, and now and then the desk
  // cries wolf with a panic forecast that never comes.
  const NEIGHBOR = {
    bubble: ['bull', 'bubble'], bull: ['bubble', 'chop'], chop: ['bull', 'bear'],
    bear: ['chop', 'recovery'], recovery: ['bull', 'chop'], panic: ['bear', 'chop']
  };
  function outlookOf(seed, d, actual, prev) {
    const rng = B.RNG(B.hashSeed(seed + '|outlook|' + d));
    if (actual === 'panic') return prev && prev !== 'panic' ? (rng.next() < 0.6 ? prev : 'chop') : rng.pick(NEIGHBOR.panic);
    if (rng.next() < 0.06) return 'panic';
    if (rng.next() < 0.67) return actual;
    return rng.pick(NEIGHBOR[actual] || ['chop']);
  }

  function cfgKey(c) {
    // Default hype (1x) is left out of the key so leaderboards from before
    // Sqwak existed keep matching the same settings.
    const k = SLIDERS.filter((s) => !(s[0] === 'hypeStrength' && (c.hypeStrength == null || c.hypeStrength === 1))).map((s) => s[0] + '=' + c[s[0]]).join('&') + '|' + JSON.stringify(c.ends) + '|' + c.dayLength;
    return B.hashSeed(k).toString(36);
  }

  B.EndlessMode = function (cfg, save) {
    const S = save ? save.S : { regime: 'bull', missStreak: 0, quotaDay: 0, ended: false, runId: Date.now().toString(36) };
    const mode = {
      kind: 'endless',
      cfg,
      seed: cfg.seed,
      capital: cfg.capital,
      dayLength: cfg.dayLength,
      lastDay: Infinity,
      volMult: cfg.volMult, feeMult: cfg.feeMult, maintStrict: cfg.maintStrict, stressRate: cfg.stressRate,
      callFreq: cfg.callFreq, fakeShare: cfg.fakeShare,
      // Tips are unreliable here too; the "fake rumors" slider pushes them worse.
      tipOdds: { real: B.clamp(0.42 - cfg.fakeShare * 0.4, 0.1, 0.42), stale: 0.16, reversal: 0.14 },
      S,

      slotLabel(g) { return `${cfg.presetName} · Day ${g.day + 1}`; },

      nextRegime(d) {
        const rng = B.RNG(B.hashSeed(cfg.seed + '|regime|' + d));
        if (d === 0) return rng.pick(['bull', 'bull', 'chop', 'bubble']);
        if (rng.next() < cfg.crashProb) return 'panic';
        const opts = REGIME_NEXT[S.regime] || REGIME_NEXT.chop;
        let r = rng.next();
        for (const [k, p] of opts) { if ((r -= p) <= 0) return k; }
        return opts[0][0];
      },

      briefing(d, g) {
        if (S.regimeDay !== d) {
          const prev = S.regime;
          S.regime = this.nextRegime(d);
          S.regimeDay = d;
          S.outlook = outlookOf(cfg.seed, d, S.regime, d > 0 ? prev : null);
        }
        const call = S.outlook || S.regime;
        const reg = B.REGIMES[call];
        const rules = [`Leverage limit: ${cfg.maxLev}x intraday / ${Math.max(1, cfg.maxLev / 2)}x overnight`];
        const e = cfg.ends;
        const goals = [];
        if (e.target) goals.push(`WIN: reach ${F.money(cfg.capital * e.targetMult)}`);
        if (e.days) goals.push(`WIN: survive ${e.daysN} days (${Math.max(0, e.daysN - d)} to go)`);
        if (e.broke) goals.push('LOSE: go broke');
        if (e.drawdown) goals.push(`LOSE: equity below ${100 - e.drawdownPct}% of starting capital`);
        if (e.sudden) goals.push('LOSE: any losing day');
        if (e.quota) goals.push(`LOSE: miss the escalating quota 2 days in a row (strikes ${S.missStreak}/2)`);
        if (e.panic) goals.push('LOSE: suffer a panic attack');
        return {
          kicker: `ENDLESS · DAY ${d + 1} ·`,
          title: `Analyst outlook: ${reg.name}`,
          html: `<p>${OUTLOOK[call]}</p><p class="muted">Outlooks are only mostly right, and nobody calls a crash the day before. Seed <code>${B.esc(cfg.seed)}</code>.</p>`,
          quota: this.quota(d, g),
          rules: rules.concat(goals)
        };
      },

      rules() { return { maxLev: cfg.maxLev, overnightLev: Math.max(1, cfg.maxLev / 2), shortBan: [] }; },

      scenario(d) {
        const rng = B.RNG(B.hashSeed(cfg.seed + '|day|' + d));
        const reg = B.REGIMES[S.regime];
        const sc = { regime: S.regime, market: {}, sectors: {}, tickers: {}, events: [] };
        sc.market.gap = rng.normal() * reg.vol * 0.35;
        sc.market.target = reg.mu + rng.normal() * reg.vol * 0.7;
        for (const k in B.SECTORS) {
          if (k === 'index' || k === 'fear') continue;
          sc.sectors[k] = { gap: rng.normal() * B.SECTORS[k].vol * 0.3, target: rng.normal() * B.SECTORS[k].vol * 0.6 };
        }
        for (const tk of B.TICKERS) {
          if (tk.sector === 'index' || tk.sector === 'fear') continue;
          sc.tickers[tk.sym] = { gap: rng.normal() * tk.vol * 0.3, target: rng.normal() * tk.vol * 0.6 };
        }
        if (S.regime === 'panic') {
          // A crash day: scripted flash drops on top of a brutal drift.
          const sev = rng.range(0.6, 1.4) * Math.min(2, cfg.volMult);
          sc.market.target = -0.05 * sev;
          sc.market.gap = -0.015 * sev;
          const hit = rng.pick(['bank', 'lender', 'tech', 'insurer', 'energy']);
          sc.sectors[hit] = { gap: -0.03 * sev, target: -0.08 * sev };
          const t1 = Math.round(rng.range(60, 300));
          sc.events.push({ t: t1, text: rng.pick(['FLASH CRASH: algorithms dump everything', 'Major hedge fund implodes; forced selling everywhere', 'Sovereign debt crisis erupts overnight in Europe', 'Surprise emergency Fed statement rattles markets']), big: true, impacts: [{ scope: 'market', id: '', pct: -0.04 * sev, over: 0.25 }] });
          sc.events.push({ t: t1 + Math.round(rng.range(30, 80)), text: 'Dip buyers step in; bounce off the lows', impacts: [{ scope: 'market', id: '', pct: 0.02 * sev, over: 0.4 }] });
        }
        const bias = reg.mu > 0 ? 0.6 : reg.mu < 0 ? 0.4 : 0.5;
        sc.events = sc.events.concat(B.News.randomEvents(rng, cfg, { bias }));
        if (B.Sqwak) sc.events = B.Sqwak.hype(sc.events, cfg.seed + '|' + d, cfg.hypeStrength == null ? 1 : cfg.hypeStrength);
        return sc;
      },

      quota(d, g) {
        if (!cfg.ends.quota) return 0;
        const eq = g ? g.broker.equity() : cfg.capital;
        const pct = (cfg.ends.quotaPct / 100) * (1 + 0.12 * S.quotaDay);
        return Math.round(Math.max(100, eq * pct) / 10) * 10;
      },

      bossName() { return 'Risk Manager'; },
      wipeLevel() { return cfg.ends.broke ? cfg.capital * 0.05 : 1; },
      onPanic(g) {
        if (cfg.ends.panic) { S.panicEnd = true; }
      },

      onDayEnd(g, r) {
        const notes = [];
        const e = cfg.ends;
        const eq = r.equity;
        S.quotaDay++;
        if (e.quota) {
          if (r.quotaMet) S.missStreak = 0;
          else { S.missStreak++; notes.push(`<b>Missed quota. Strike ${S.missStreak} of 2.</b>`); }
        }
        const days = g.history.length;
        let ending = null;
        if (r.earlyEnd === 'wiped' || eq <= 1 || (e.broke && eq < cfg.capital * 0.05)) ending = 'margin';
        else if (e.drawdown && eq < cfg.capital * (1 - e.drawdownPct / 100)) ending = 'drawdown';
        else if (e.sudden && r.pnl < 0) ending = 'sudden';
        else if (e.quota && S.missStreak >= 2) ending = 'fired';
        else if (e.panic && S.panicEnd) ending = 'burnout';
        else if (e.target && eq >= cfg.capital * e.targetMult) ending = days <= 5 ? 'legend' : 'rich';
        else if (e.days && days >= e.daysN) ending = eq >= cfg.capital ? 'survivorUp' : 'survivor';
        if (ending) return { notes, ending: this.buildEnding(g, ending) };
        return { notes };
      },

      afterDay(g, cb) { cb(); },

      buildEnding(g, id) {
        const T = {
          margin: ['Margin Death', false, 'The account is gone. The broker sends a polite email asking for the negative balance.'],
          drawdown: ['Fired', false, 'Risk pulled the plug. Your drawdown blew through the limit and security has your badge.'],
          sudden: ['Sudden Death', false, 'One red day. That was all it took.'],
          fired: ['Fired', false, 'Two missed quotas in a row. Your desk is already being cleaned out.'],
          burnout: ['Burnout', false, 'Your body made the decision your brain wouldn\'t. You walk out of the building and never come back.'],
          legend: ['Legend', true, 'You hit the target in record time. They\'ll be telling stories about this run on trading floors for years.'],
          rich: ['Retired Rich', true, 'Target hit. You close the laptop, book a one-way ticket somewhere warm and never look at a chart again.'],
          survivorUp: ['Survivor', true, 'You made it through every single bell, and you\'re up. Most people can\'t say that.'],
          survivor: ['Survivor (Barely)', false, 'You survived. That\'s about the nicest thing anyone can say.'],
          quit: ['Walked Away', false, 'You walked away from the desk. Sometimes that\'s the best trade.']
        }[id];
        const wealth = g.broker.equity();
        const rank = recordScore(cfg, { mult: wealth / cfg.capital, days: g.history.length, ending: T[0], date: Date.now(), run: `${cfg.seed}|${S.runId || ''}|${g.history.length}` });
        return { id, title: T[0], good: T[1], text: T[2], wealth, rank };
      },

      serialize() { return { S, cfg }; }
    };
    return mode;
  };

  // ---- leaderboard ----
  function recordScore(cfg, entry) {
    const all = B.storage.get('leaderboard', {});
    const key = cfgKey(cfg);
    const list = all[key] || [];
    // Reloading the last day replays it exactly: one run, one entry.
    const dup = list.find((x) => x.run && x.run === entry.run);
    if (dup) return list.indexOf(dup) + 1;
    list.push(entry);
    list.sort((a, b) => b.mult - a.mult);
    all[key] = list.slice(0, 10);
    B.storage.set('leaderboard', all);
    const i = all[key].indexOf(entry);
    return i >= 0 ? i + 1 : null;
  }

  // ---- setup screen ----
  B.EndlessSetup = {
    cfg: null,
    open() {
      const saved = B.storage.get('endlessCfg', null);
      this.cfg = saved || Object.assign({ preset: 'trader', ends: Object.assign({}, DEFAULT_ENDS) }, PRESETS.trader);
      this.cfg.seed = Math.random().toString(36).slice(2, 8).toUpperCase();
      this.render();
      B.Screens.show('endless');
    },

    render() {
      const c = this.cfg;
      const presetBtns = Object.keys(PRESETS).map((k) => `<button class="preset ${c.preset === k ? 'on' : ''}" data-preset="${k}"><b>${PRESETS[k].presetName}</b><span>${F.money(PRESETS[k].capital)} · ${PRESETS[k].maxLev}x · vol ${PRESETS[k].volMult}x</span></button>`).join('') +
        `<button class="preset ${c.preset === 'custom' ? 'on' : ''}" data-preset="custom"><b>Custom</b><span>Tweak everything</span></button>`;
      const sliders = SLIDERS.map(([k, label, min, max, step, fmt]) => `<div class="field"><label for="es-${k}">${label}</label><input type="range" id="es-${k}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${c[k]}"><output id="eo-${k}">${fmt(c[k])}</output></div>`).join('');
      const e = c.ends;
      const chk = (k, label, numK, numAttrs) => `<div class="check"><input type="checkbox" id="ec-${k}" data-end="${k}" ${e[k] ? 'checked' : ''}><label for="ec-${k}">${label}</label>${numK ? `<input type="number" data-endn="${numK}" value="${e[numK]}" ${numAttrs} aria-label="${label} value">` : '<span></span>'}</div>`;
      $('endless-form').innerHTML = `
        <div class="presets">${presetBtns}</div>
        <div class="form-grid">
          <div class="fieldset"><h3>Difficulty</h3>${sliders}
            <div class="field"><label for="es-dayLength">Day length</label><select id="es-dayLength"><option value="120">2 min</option><option value="180">3 min</option><option value="240">4 min</option><option value="420">7 min</option></select><output></output></div>
            <div class="field"><label for="es-seed">Seed</label><input type="text" id="es-seed" value="${B.esc(c.seed)}" maxlength="16"><output></output></div>
          </div>
          <div>
            <div class="fieldset"><h3>Lose conditions</h3>
              ${chk('broke', 'Go broke (equity under 5% of start)')}
              ${chk('drawdown', 'Drawdown limit (% of start lost)', 'drawdownPct', 'min="5" max="95" step="5"')}
              ${chk('sudden', 'Sudden death: any losing day')}
              ${chk('quota', 'Escalating daily quota (% of equity, grows 12%/day)', 'quotaPct', 'min="0.1" max="5" step="0.1"')}
              ${chk('panic', 'A panic attack ends the run')}
            </div>
            <div class="fieldset" style="margin-top:14px"><h3>Win conditions</h3>
              ${chk('target', 'Reach a target (multiple of start)', 'targetMult', 'min="1.1" max="1000" step="0.5"')}
              ${chk('days', 'Survive N trading days', 'daysN', 'min="1" max="250" step="1"')}
              <p class="muted" style="font-size:12px;margin:6px 0 0">Untick everything to play until you quit. Hitting your target in five days or less earns <b>Legend</b>.</p>
            </div>
          </div>
        </div>
        <div class="form-foot"><span class="muted" id="es-summary"></span><button class="btn primary" id="es-go">&#128276; Start Run</button></div>
        <div class="leader" id="es-leader"></div>`;
      $('es-dayLength').value = String(c.dayLength);
      this.bind();
      this.summary();
    },

    bind() {
      const c = this.cfg;
      document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.preset;
        if (k !== 'custom') Object.assign(c, PRESETS[k]);
        c.preset = k;
        this.render();
      }));
      document.querySelectorAll('#endless-form input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
        const s = SLIDERS.find((x) => x[0] === inp.dataset.k);
        c[inp.dataset.k] = +inp.value;
        $('eo-' + inp.dataset.k).textContent = s[5](+inp.value);
        c.preset = 'custom';
        c.presetName = 'Custom';
        document.querySelectorAll('.preset').forEach((p) => p.classList.toggle('on', p.dataset.preset === 'custom'));
        this.summary();
      }));
      document.querySelectorAll('[data-end]').forEach((inp) => inp.addEventListener('change', () => { c.ends[inp.dataset.end] = inp.checked; this.summary(); }));
      // Typed values are clamped to the field's own range: a target of 0 was an instant Legend.
      document.querySelectorAll('[data-endn]').forEach((inp) => inp.addEventListener('change', () => {
        const lo = +inp.min, hi = +inp.max, v = +inp.value;
        const val = B.clamp(Number.isFinite(v) ? v : lo, lo, hi);
        inp.value = String(val);
        c.ends[inp.dataset.endn] = val;
        this.summary();
      }));
      $('es-dayLength').addEventListener('change', (e) => { c.dayLength = +e.target.value; this.summary(); });
      $('es-seed').addEventListener('input', (e) => { c.seed = e.target.value.trim() || 'SEED'; });
      $('es-go').addEventListener('click', () => {
        B.SFX.unlock();
        const save = Object.assign({}, c);
        delete save.seed;
        B.storage.set('endlessCfg', save);
        B.Main.startEndless(JSON.parse(JSON.stringify(c)));
      });
    },

    summary() {
      const c = this.cfg, e = c.ends;
      const ends = [];
      if (e.target) ends.push(`reach ${e.targetMult}x`);
      if (e.days) ends.push(`survive ${e.daysN} days`);
      $('es-summary').textContent = ends.length ? `Win by: ${ends.join(' or ')}` : 'No win condition: play until you drop.';
      const lb = (B.storage.get('leaderboard', {})[cfgKey(c)] || []);
      $('es-leader').innerHTML = `<h3 class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.1em">Leaderboard for these exact settings</h3>` +
        (lb.length ? `<table><thead><tr><th>#</th><th>Return</th><th>Days</th><th>Ending</th><th>Date</th></tr></thead><tbody>${lb.map((r, i) => `<tr><td>${i + 1}</td><td class="${F.cls(r.mult - 1)}">${F.pct(r.mult - 1)}</td><td>${r.days}</td><td>${B.esc(r.ending)}</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No runs yet.</p>');
    }
  };

  B.Endless = { PRESETS, DEFAULT_ENDS, cfgKey, outlookOf };
})(window.BTB);
