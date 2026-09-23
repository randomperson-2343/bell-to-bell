// Headline templates + random news/rumor generation (Endless mode and story filler).
// All firms, agencies and handles are invented.
(function (B) {
  'use strict';

  const HANDLES = ['@DeepValueDane', '@BearCaveBets', '@MacroMaven', '@BondVigilante', '@TendiesTomorrow',
    '@PromptAndPray', '@HedgeHog88', '@Quant_Kween', '@CallsOnlyCarl', '@ScalingLawSteve',
    '@TheTapeReader', '@DiamondHandsDiane', '@GPUgoblin', '@FlopsPerDollar'];

  const POS = [
    '{name} smashes earnings estimates, raises guidance',
    '{name} announces surprise $5B buyback',
    'Upgrade: Calloway Research raises {name} to BUY',
    '{name} lands major federal contract',
    'Report: {name} in early takeover talks',
    '{name} CEO buys $12M of stock on open market',
    '{name} signs multi-year compute supply deal'
  ];
  const NEG = [
    '{name} misses on revenue, slashes outlook',
    '{name} CFO resigns "effective immediately"',
    'Downgrade: {name} cut to SELL, target halved',
    '{name} discloses federal probe into revenue recognition',
    '{name} delays flagship launch indefinitely',
    '{name} warns of "near-term liquidity pressure"',
    '{name} writes down $2B of capacity commitments'
  ];
  const SECTOR_POS = {
    ai: ['New benchmark results send model labs vertical', 'Enterprise adoption survey: AI budgets up 60%'],
    chip: ['Foundry yields improve; silicon rips higher', 'Export licences granted for next-gen accelerators'],
    dc: ['Datacenter vacancy hits record low', 'Hyperscale leasing demand described as "insatiable"'],
    power: ['Grid operators approve fast-track interconnects', 'Power prices ease as new capacity comes online'],
    bank: ['Regulators ease bank capital requirements', 'Loan loss provisions come in far below estimates'],
    lender: ['Consumer credit applications jump 12% week over week'],
    insurer: ['Catastrophe losses come in far below estimates'],
    defense: ['Supplemental appropriations clear committee'],
    retail: ['Consumer spending surges for third straight month'],
    haven: ['Central banks step up bullion purchases']
  };
  const SECTOR_NEG = {
    ai: ['Model lab funding round reportedly collapses', 'Study finds AI deployments failing to convert to revenue'],
    chip: ['Order cancellations ripple through the supply chain', 'Export controls widen; silicon sells off hard'],
    dc: ['Datacenter lease cancellations surface in filings', 'Utility rejects three gigawatt-scale interconnect requests'],
    power: ['Power prices spike as grid strains under new load', 'Fuel supply disruption hits regional generators'],
    bank: ['Interbank lending rates spike; banks slide'],
    lender: ['Consumer delinquencies hit decade high'],
    insurer: ['Insurers face record claims after storm season'],
    defense: ['Procurement freeze announced pending review'],
    retail: ['Retail sales unexpectedly shrink'],
    haven: ['Bullion slides as the dollar surges']
  };
  const MARKET_POS = ['Central bank signals rate cuts ahead', 'Jobs report blows past expectations', 'Inflation cools more than expected', 'Trade framework announced; futures jump'];
  const MARKET_NEG = ['Hot inflation print rattles markets', 'Central bank hints at more hikes', 'Global growth warning issued as trade slows', 'Bond yields spike to a 16-year high'];
  const FAKE = [
    'BREAKING?? {sym} about to get bought out at 40% premium. source: trust me',
    'hearing {sym} gets halted soon. regulators in the building??',
    '{sym} CFO seen walking into a bankruptcy lawyer\'s office. not financial advice',
    'my cousin at {sym} says the next earnings are INSANE. loading calls',
    '{sym} is the next 10-bagger, shorts are about to get obliterated',
    'a model told me to buy {sym} and models are never wrong',
    '{sym} datacenter is running on a diesel generator lmao. someone check this',
    'loading {sym} calls. do not ask me why. i will not be taking questions',
    '{sym} insiders dumping shares all week. check the filings',
    'hearing {sym} misses tonight. getting out before the rest of you',
    '{sym} short squeeze starts at the open. shorts are obliterated',
    '{sym} is cooked. whole team quit on a group call apparently',
    'my barber is buying {sym}. that is either the top or the bottom',
    '{sym} to the moon. bought more at lunch',
    '{sym} is selling assets to make payroll?? unconfirmed but wow',
    'friend in procurement says {sym} just landed a HUGE order',
    '{sym} probe coming. regulators asking questions all week'
  ];
  const NOISE = [
    'is it too late to buy the dip or too early to panic',
    'chart looks like a ski slope and I forgot my skis',
    'my portfolio is down 30% but my conviction is up 300%',
    'who is selling at these prices. show yourself',
    'every fund on earth runs the same model and we call that diversification',
    'just a reminder that the market can stay irrational longer than you can stay solvent',
    'green candle. I have been healed',
    'if this closes red I am becoming a farmer',
    'we automated the analysts and kept the bubble. efficiency',
    'the machines are front-running the machines now',
    'every chart is a line until you zoom in',
    'the tape is lying to me and i am choosing to believe it',
    'market open is my cardio',
    'i do not have a strategy. i have a feeling and a margin account',
    'the quiet part of the day is the part that scares me',
    'bought the rumor. sold the news. bought the news. sold the rumor. flat',
    'who is buying at these prices. show yourself. again',
    'three monitors and i still cannot see what is coming',
    'my risk manager just sent a thumbs up and i do not know what it means',
    'somewhere a model is reading this post and changing its mind',
    'lunch is for people who are not down 4%',
    'every rally is a relief rally if you are relieved enough'
  ];

  const fill = (tpl, tk) => tpl.replace('{name}', tk.name).replace('{sym}', '$' + tk.sym);

  B.News = {
    HANDLES,
    NOISE,
    // Exposed so js/tests/tests.js can lint every string the game can print.
    TEMPLATES: { POS, NEG, SECTOR_POS, SECTOR_NEG, MARKET_POS, MARKET_NEG, FAKE },
    handle(rng, voice) { return B.Sqwak && voice ? B.Sqwak.pickHandle(rng, voice) : rng.pick(HANDLES); },

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
          if (rng.chance(0.35)) ev.rumor = { lead: Math.round(rng.range(4, 14)), text: `hearing something big on $${tk.sym}... ${up ? 'positioning long' : 'getting out now'}`, src: this.handle(rng, 'sharp') };
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
        out.push({ t: Math.round(rng.range(5, 385)), kind: 'chirp', text: fill(rng.pick(FAKE), tk), src: this.handle(rng, 'hype'), fake: true });
      }
      // Flavor chatter.
      const nn = rng.int(3, 6);
      for (let i = 0; i < nn; i++) out.push({ t: Math.round(rng.range(2, 388)), kind: 'chirp', text: rng.pick(NOISE), src: this.handle(rng, 'noise') });
      return out;
    },

    fakeRumor(rng, sym) {
      return fill(rng.pick(FAKE), B.TICKERS.find((t) => t.sym === sym));
    }
  };
})(window.BTB);
