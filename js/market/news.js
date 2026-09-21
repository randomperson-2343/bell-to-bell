// Headline templates + random news/rumor generation (Endless mode and story filler).
(function (B) {
  'use strict';

  const HANDLES = ['@DeepValueDan', '@BearCaveBets', '@MacroMaven', '@BondVigilante', '@TendiesTomorrow',
    '@RealFinanceGuy', '@HedgeHog88', '@Quant_Kween', '@CallsOnlyCarl', '@SubprimeSteve', '@TheTapeReader', '@DiamondHandsDiane'];

  const POS = [
    '{name} smashes earnings estimates, raises guidance',
    '{name} announces surprise $5B buyback',
    'Upgrade: Goldstone raises {name} to BUY',
    '{name} lands major federal contract',
    'Report: {name} in early takeover talks',
    '{name} CEO buys $12M of stock on open market'
  ];
  const NEG = [
    '{name} misses on revenue, slashes outlook',
    '{name} CFO resigns "effective immediately"',
    'Downgrade: {name} cut to SELL, target halved',
    '{name} discloses DOJ probe into accounting',
    '{name} recalls flagship product line',
    '{name} warns of "near-term liquidity pressure"'
  ];
  const SECTOR_POS = {
    bank: ['Regulators ease bank capital requirements'],
    lender: ['Mortgage applications jump 12% week over week'],
    builder: ['Housing starts crush forecasts'],
    insurer: ['Catastrophe losses come in far below estimates'],
    gse: ['Congress extends mortgage-agency credit line'],
    tech: ['Chip shortage ends early; tech rips higher'],
    retail: ['Consumer spending surges for third straight month'],
    energy: ['OPEC+ announces surprise production cut'],
    haven: ['Central banks step up gold purchases']
  };
  const SECTOR_NEG = {
    bank: ['Interbank lending rates spike; banks slide'],
    lender: ['Mortgage delinquencies hit decade high'],
    builder: ['New home sales collapse 18%'],
    insurer: ['Insurers face record claims after hurricane'],
    gse: ['Mortgage agencies told to raise capital'],
    tech: ['Antitrust crackdown targets Big Tech'],
    retail: ['Retail sales unexpectedly shrink'],
    energy: ['Oil plunges on demand fears'],
    haven: ['Gold slides as dollar surges']
  };
  const MARKET_POS = ['Fed signals rate cuts ahead', 'Jobs report blows past expectations', 'Inflation cools more than expected', 'Trade deal announced; futures jump'];
  const MARKET_NEG = ['Hot inflation print rattles markets', 'Fed hints at more hikes', 'IMF issues global recession warning', 'Bond yields spike to 16-year high'];
  const FAKE = [
    'BREAKING?? {sym} about to get bought out at 40% premium. source: trust me',
    'hearing {sym} gets halted soon. SEC raid?? 👀',
    '{sym} CEO seen walking into bankruptcy lawyer\'s office. not financial advice',
    'my cousin at {sym} says earnings are going to be INSANE. loading calls',
    '{sym} is the next 10-bagger, shorts are about to get obliterated'
  ];
  const NOISE = [
    'is it too late to buy the dip or too early to panic',
    'chart looks like a ski slope and I forgot my skis',
    'my portfolio is down 30% but my conviction is up 300%',
    'who is selling at these prices. show yourself',
    'the fed has a printer and it goes brrr apparently',
    'just a reminder that the market can stay irrational longer than you can stay solvent',
    'green candle. I have been healed',
    'if this closes red I am becoming a farmer'
  ];

  const fill = (tpl, tk) => tpl.replace('{name}', tk.name).replace('{sym}', '$' + tk.sym);

  B.News = {
    HANDLES,
    NOISE,
    handle(rng) { return rng.pick(HANDLES); },

    // Build a list of random intraday events for a day.
    // cfg: { newsFreq, fakeShare, volMult }
    randomEvents(rng, cfg, opts) {
      opts = opts || {};
      const out = [];
      const tradable = B.TICKERS.filter((t) => t.sector !== 'index' && t.sector !== 'fear');
      const n = Math.round((cfg.newsFreq || 1) * rng.range(4, 7));
      for (let i = 0; i < n; i++) {
        const t = Math.round(rng.range(8, 380));
        const up = rng.chance(opts.bias == null ? 0.5 : opts.bias);
        const roll = rng.next();
        let ev;
        if (roll < 0.6) {
          const tk = rng.pick(tradable);
          const mag = rng.range(0.02, 0.07) * (cfg.volMult || 1);
          ev = { t, text: fill(rng.pick(up ? POS : NEG), tk), impacts: [{ scope: 'ticker', id: tk.sym, pct: up ? mag : -mag, over: rng.range(0, 0.6) }] };
          if (rng.chance(0.35)) ev.rumor = { lead: Math.round(rng.range(4, 14)), text: `hearing something big on $${tk.sym}... ${up ? 'positioning long' : 'getting out now'}`, src: this.handle(rng) };
        } else if (roll < 0.85) {
          const secs = Object.keys(SECTOR_POS);
          const s = rng.pick(secs);
          const list = (up ? SECTOR_POS : SECTOR_NEG)[s];
          const mag = rng.range(0.012, 0.035) * (cfg.volMult || 1);
          ev = { t, text: rng.pick(list), impacts: [{ scope: 'sector', id: s, pct: up ? mag : -mag, over: rng.range(0, 0.5) }] };
        } else {
          const mag = rng.range(0.006, 0.015) * (cfg.volMult || 1);
          ev = { t, text: rng.pick(up ? MARKET_POS : MARKET_NEG), impacts: [{ scope: 'market', id: '', pct: up ? mag : -mag, over: rng.range(0.2, 0.8) }] };
        }
        out.push(ev);
        // "Sell the news": the obvious move reverses a few minutes later.
        if (ev.kind !== 'chirp' && rng.chance(0.2)) {
          const im = ev.impacts[0];
          out.push({ t: t + Math.round(rng.range(4, 12)), impacts: [{ scope: im.scope, id: im.id, pct: -im.pct * rng.range(1.1, 1.6), over: 0.2 }] });
        }
      }
      // Fake rumors: no real impact. Pure bait.
      const nf = Math.round((cfg.fakeShare || 0) * n * 1.4);
      for (let i = 0; i < nf; i++) {
        const tk = rng.pick(tradable);
        out.push({ t: Math.round(rng.range(5, 385)), kind: 'chirp', text: fill(rng.pick(FAKE), tk), src: this.handle(rng) });
      }
      // Flavor chatter.
      const nn = rng.int(3, 6);
      for (let i = 0; i < nn; i++) out.push({ t: Math.round(rng.range(2, 388)), kind: 'chirp', text: rng.pick(NOISE), src: this.handle(rng) });
      return out;
    },

    fakeRumor(rng, sym) {
      return fill(rng.pick(FAKE), B.TICKERS.find((t) => t.sym === sym));
    }
  };
})(window.BTB);
