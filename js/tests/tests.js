// Test suite. Runs in the browser (tests.html) or headless under Node (node js/tests/node-run.js).
(function (B) {
  'use strict';
  const results = [];
  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, err: e && e.message ? e.message : String(e) }); }
  }
  function assert(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }
  function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error(`${msg || ''} expected ${b}, got ${a}`); }

  // Minimal stand-ins so game systems run headless.
  if (!B.UI) B.UI = {};
  ['toast', 'inbox', 'addNews', 'phoneHide', 'phoneRing', 'phoneOpen', 'renderTasks', 'renderFeed',
    'renderWatch', 'renderBottom', 'updateBadge', 'shake', 'flash', 'dayStart', 'dayEnd', 'restoreFeed',
    'lock', 'unlock', 'panicProgress', 'pause', 'enterGame', 'leaveGame', 'select', 'frame', 'render'
  ].forEach((k) => { if (!B.UI[k]) B.UI[k] = () => {}; });
  if (!B.UI.snapshotFeed) B.UI.snapshotFeed = () => ({ wire: [], chirp: [], inbox: [], unread: 0 });

  function mkMarket(scen, seed) {
    const m = new B.Market({ seed: seed || 'test' });
    m.startDay(0, scen || { regime: 'chop' });
    return m;
  }
  function runDay(m) {
    const out = [];
    while (m.status === 'open' && m.t < B.DAY_MIN) out.push(...m.step(0.25));
    m.close();
    return out;
  }
  function mkBroker(m, cash) {
    const b = new B.Broker({ cash: cash || 100000, feeMult: 0, slipMult: 0 });
    b.attach(m);
    b.startDay();
    return b;
  }

  // ---------- RNG ----------
  test('RNG is deterministic per seed', () => {
    const a = B.RNG(42), b = B.RNG(42), c = B.RNG(43);
    const sa = [a.next(), a.next(), a.next()], sb = [b.next(), b.next(), b.next()];
    assert(sa.join() === sb.join(), 'same seed differs');
    assert(sa[0] !== c.next(), 'different seed matches');
  });

  test('RNG state round-trips exactly', () => {
    const a = B.RNG(7);
    for (let i = 0; i < 13; i++) a.normal();
    const st = JSON.parse(JSON.stringify(a.getState()));
    const want = [a.next(), a.normal(), a.next()];
    const b = B.RNG(7);
    b.setState(st);
    const got = [b.next(), b.normal(), b.next()];
    assert(want.join() === got.join(), 'state restore diverged');
  });

  // ---------- Broker ----------
  test('Long round trip realizes correct P&L', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('BLWT', 100);
    tk.last = 110;
    const r = b.marketOrder('BLWT', -100);
    near(r.realized, 1000, 0.01, 'realized');
    near(b.equity(), 101000, 0.01, 'equity');
    assert(b.isFlat(), 'should be flat');
  });

  test('Short round trip profits when price falls', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('BLWT', -200);
    near(b.equity(), 100000, 0.01, 'equity unchanged at entry');
    tk.last = 90;
    near(b.equity(), 102000, 0.01, 'short gains');
    const r = b.marketOrder('BLWT', 200);
    near(r.realized, 2000, 0.01);
  });

  test('Flip from long to short keeps accounting straight', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 50; tk.spread = 1e-12;
    b.marketOrder('BLWT', 100);
    tk.last = 60;
    b.marketOrder('BLWT', -300);
    assert(b.posQty('BLWT') === -200, 'qty');
    near(b.pos.BLWT.avg, 60, 1e-9, 'avg resets on flip');
    near(b.equity(), 101000, 0.01);
  });

  test('Buying power limits exposure to max leverage', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.BLWT.last = 100; m.bySym.BLWT.spread = 1e-12;
    b.rules.maxLev = 4;
    assert(!b.marketOrder('BLWT', 4100).ok, 'should reject > 4x');
    assert(b.marketOrder('BLWT', 3900).ok, 'should allow < 4x');
    assert(b.maxQty('BLWT', 1) < 200, 'little buying power left');
  });

  test('Short-sale ban blocks new shorts but allows covering', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.HLST.spread = 1e-12;
    b.marketOrder('HLST', -100);
    b.rules.shortBan = ['bank'];
    assert(!b.marketOrder('HLST', -100).ok, 'ban should block adding');
    assert(b.marketOrder('HLST', 100).ok, 'covering allowed');
  });

  test('Margin call then liquidation', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('BLWT', 3900);
    tk.last = 75; // -25% on ~3.9x
    let ev = b.checkMargin(10);
    assert(ev.some((e) => e.type === 'mc'), 'margin call issued');
    ev = b.checkMargin(41);
    assert(ev.some((e) => e.type === 'liq'), 'liquidated after deadline');
    assert(b.netLiq() >= b.maintenance(), 'back above maintenance');
  });

  test('Overnight margin force-sells excess at the close', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.BLWT.last = 100; m.bySym.BLWT.spread = 1e-12;
    b.rules.maxLev = 4; b.rules.overnightLev = 2;
    b.marketOrder('BLWT', 3500);
    m.close();
    const out = b.endOfDay(0);
    assert(out.forced.length === 1, 'forced sale');
    assert(b.stockGross() / 2 <= b.netLiq() + 1, 'within overnight limit');
  });

  test('Bracket stop-loss fires and cancels its take-profit', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('BLWT', 100);
    b.attachBracket('BLWT', 5, 10);
    assert(b.orders.length === 2, 'two bracket orders');
    tk.last = 94;
    b.processOrders();
    assert(b.isFlat(), 'stopped out');
    assert(b.orders.length === 0, 'OCO cancelled');
  });

  test('Option pricing sanity (put-call parity, monotonic in strike)', () => {
    const S = 100, T = 0.1, v = 0.3;
    const c = B.Options.bs(S, 100, T, v, 'C'), p = B.Options.bs(S, 100, T, v, 'P');
    near(c - p, S - 100 * Math.exp(-0.03 * T), 0.02, 'parity');
    assert(B.Options.bs(S, 90, T, v, 'C') > B.Options.bs(S, 110, T, v, 'C'), 'calls cheaper at higher strikes');
    near(B.Options.bs(S, 90, 0, v, 'C'), 10, 1e-9, 'expiry = intrinsic');
  });

  test('Option buy, then cash settlement at expiry', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100;
    const r = b.buyOption('BLWT', 'P', 100, 0, 2);
    assert(r.ok, r.msg);
    tk.last = 80;
    m.close();
    const cash0 = b.cash;
    b.endOfDay(0);
    near(b.cash - cash0, 20 * 200, 0.01, 'settles intrinsic');
    assert(!b.opts.length, 'expired option removed');
  });

  // ---------- Market ----------
  test('Prices stay finite and positive across 300 random days', () => {
    const regs = Object.keys(B.REGIMES);
    const m = new B.Market({ seed: 'stress', volMult: 2 });
    for (let d = 0; d < 300; d++) {
      m.startDay(d, { regime: regs[d % regs.length], market: { target: (d % 7 - 3) * 0.01 } });
      runDay(m);
      for (const tk of m.tickers) assert(isFinite(tk.last) && tk.last > 0, `${tk.sym} bad price ${tk.last} on day ${d}`);
    }
  });

  test('Daily index return tracks the scenario target', () => {
    let err = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const target = (i % 11 - 5) * 0.006;
      const m = mkMarket({ regime: 'chop', market: { target } }, 'tgt' + i);
      runDay(m);
      err += Math.abs(Math.log(m.bySym.INDX.last / m.bySym.INDX.prevClose) - target);
    }
    assert(err / N < 0.006, 'mean abs error ' + (err / N).toFixed(4));
  });

  test('Circuit breaker trips on a crash day', () => {
    const m = mkMarket({ regime: 'panic', market: { target: -0.15 } }, 'crash');
    const out = runDay(m);
    assert(out.some((e) => e.type === 'breaker' && e.level === 1), 'L1 breaker');
  });

  // ---------- Stress 2.0 ----------
  test('Stress impairment escalates in readable stages', () => {
    const s = new B.Stress(1);
    s.v = 20; assert(s.stage().id === 'steady', '20 should be steady');
    s.v = 50; assert(s.stage().id === 'loaded', '50 should be loaded');
    s.v = 75; assert(s.stage().id === 'tunnel', '75 should be tunnel');
    s.v = 92; assert(s.stage().id === 'critical', '92 should be critical');
    assert(s.fatFingerChance() > 0 && s.fatFingerChance() < 0.12, 'critical impairment should be meaningful but bounded');
  });

  test('Panic resistance blocks chains but permits one catastrophe bypass', () => {
    const s = new B.Stress(1);
    s.v = 100;
    assert(s.beginPanic(false), 'ordinary panic should begin at 100');
    s.v = 100;
    assert(!s.canPanic(false), 'cooldown should block repeat panic');
    s.v = 94;
    assert(s.beginPanic(true), 'catastrophe should bypass ordinary cooldown once');
    s.v = 100;
    assert(!s.canPanic(true), 'catastrophe bypass should be spent for the day');
  });

  test('Stress state survives a save round trip', () => {
    const s = new B.Stress(1);
    s.v = 83; s.peak = 97; s.cooldown = 31; s.resistance = 0.64; s.panicCount = 2; s.catastropheReady = false;
    const restored = new B.Stress(1);
    restored.restore(JSON.parse(JSON.stringify(s.serialize())));
    near(restored.v, 83, 1e-9, 'value');
    near(restored.cooldown, 31, 1e-9, 'cooldown');
    near(restored.resistance, 0.64, 1e-9, 'resistance');
    assert(restored.panicCount === 2 && !restored.catastropheReady, 'panic history');
  });

  test('Single-stock volatility halt on a huge shock', () => {
    const m = mkMarket({ regime: 'chop', events: [{ t: 60, text: 'x', impacts: [{ scope: 'ticker', id: 'FRLN', pct: -0.35 }] }] }, 'luld');
    const out = runDay(m);
    assert(out.some((e) => e.type === 'luld' && e.sym === 'FRLN'), 'LULD halt');
  });

  test('Rumors appear before their news', () => {
    const m = mkMarket({ regime: 'chop', events: [{ t: 100, text: 'news', impacts: [], rumor: { lead: 10, text: 'rumor' } }] });
    const out = runDay(m).filter((e) => e.type === 'news');
    assert(out[0].text === 'rumor' && out[1].text === 'news', 'order');
    assert(out[1].t - out[0].t >= 9.5, 'lead time');
  });

  test('A day replays identically from the same seed and scenario', () => {
    const scen = { regime: 'bear', market: { gap: -0.01, target: -0.03 }, events: [{ t: 55, text: 'x', impacts: [{ scope: 'sector', id: 'ai', pct: -0.06 }] }] };
    const a = new B.Market({ seed: 'replay' });
    const b = new B.Market({ seed: 'replay' });
    a.startDay(4, JSON.parse(JSON.stringify(scen)));
    b.startDay(4, JSON.parse(JSON.stringify(scen)));
    a.fastForward(213, 0.25);
    b.fastForward(213, 0.25);
    for (const tk of a.tickers) near(b.bySym[tk.sym].last, tk.last, 1e-9, tk.sym);
    near(b.t, a.t, 1e-12, 'clock');
  });

  // ---------- Save system ----------
  function mkGame(seed) {
    const mode = B.StoryMode();
    mode.seed = seed || mode.seed;
    return new B.Game(mode);
  }

  test('A panic is short and the grounding sequence ends it early', () => {
    const g = mkGame('panic-qte');
    g.startDay();
    g.stress.v = 100;
    assert(g.panicAttack(false), 'panic should start');
    const duration = g.lock.until - g.market.t;
    assert(duration <= 6, 'ordinary panic duration ' + duration);
    assert(duration / g.rate < 4, 'ordinary panic should stay under four real seconds');
    const seq = g.lock.seq.slice();
    seq.forEach((k) => g.panicInput(k));
    assert(!g.lock, 'grounding sequence should unlock trading');
    assert(g.stress.v <= 56, 'interactive recovery should lower stress');
    assert(g.stress.cooldown > 0, 'recovery should keep a cooldown');
  });

  test('Mid-day snapshot restores the exact same session', () => {
    const g = mkGame();
    g.day = 2;
    g.startDay();
    for (let i = 0; i < 400; i++) g.tick(0.25);     // t = 100
    g.trade('BLWT', 200);
    g.trade('CRVS', -40);
    g.broker.placeOrder('THSI', 100, 'limit', g.market.bySym.THSI.last * 0.97);
    for (let i = 0; i < 148; i++) g.tick(0.25);     // t = 137
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    assert(snap.inDay, 'should be a mid-day snapshot');
    near(snap.t, 137, 1e-9, 'snapshot clock');

    const g2 = new B.Game(B.StoryMode(snap.mode), snap);
    g2.resumeDay();
    near(g2.market.t, g.market.t, 1e-9, 'clock');
    for (const tk of g.market.tickers) near(g2.market.bySym[tk.sym].last, tk.last, 1e-8, tk.sym + ' price');
    near(g2.broker.equity(), g.broker.equity(), 1e-6, 'equity');
    near(g2.broker.cash, g.broker.cash, 1e-6, 'cash');
    assert(Object.keys(g2.broker.pos).join() === Object.keys(g.broker.pos).join(), 'positions');
    assert(g2.broker.posQty('BLWT') === g.broker.posQty('BLWT'), 'BLWT qty');
    assert(g2.broker.orders.length === g.broker.orders.length, 'working orders');
    near(g2.stress.v, g.stress.v, 1e-9, 'stress');

    // ...and they stay in step all the way to the bell.
    for (let i = 0; i < 600; i++) { g.tick(0.25); g2.tick(0.25); }
    for (const tk of g.market.tickers) near(g2.market.bySym[tk.sym].last, tk.last, 1e-6, tk.sym + ' price after replay');
    near(g2.broker.equity(), g.broker.equity(), 1e-4, 'equity after replay');
  });

  test('Snapshot between days restores day, history and book', () => {
    const g = mkGame();
    g.startDay();
    for (let i = 0; i < 40; i++) g.tick(0.25);
    g.trade('AURX', 60);
    while (g.running) g.tick(1);
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    assert(!snap.inDay, 'should be a between-days snapshot');
    const g2 = new B.Game(B.StoryMode(snap.mode), snap);
    assert(g2.day === g.day, 'day');
    near(g2.broker.cash, g.broker.cash, 1e-6, 'cash');
    assert(g2.broker.posQty('AURX') === g.broker.posQty('AURX'), 'position carried');
    assert(g2.history.length === g.history.length, 'history');
  });

  test('Save slots: write, read, rename, finish, delete', () => {
    for (let i = 0; i < B.Save.SLOTS; i++) B.Save.clear(i);
    assert(B.Save.firstEmpty() === 0, 'all slots free');
    B.Save.write(0, { kind: 'story', day: 3 }, { mode: 'story', day: 3, equity: 1234, label: 'Day 4' });
    const m = B.Save.meta(0);
    assert(m && m.equity === 1234, 'meta written');
    assert(B.Save.firstEmpty() === 1, 'slot 0 now taken');
    assert(B.Save.read(0).day === 3, 'payload read back');
    B.Save.rename(0, 'My Run');
    assert(B.Save.meta(0).name === 'My Run', 'renamed');
    B.Save.finish(0, { id: 'grind', title: 'Still Standing', wealth: 9 });
    assert(B.Save.meta(0).finished.id === 'grind', 'slot marked finished');
    B.Save.clear(0);
    assert(!B.Save.meta(0) && !B.Save.read(0), 'cleared');
  });

  test('Ending tally counts every finished run', () => {
    for (let i = 0; i < B.Save.SLOTS; i++) B.Save.clear(i);
    B.storage.remove('endings:tally');
    B.Save.recordEnding('perp');
    B.Save.recordEnding('perp');
    B.Save.recordEnding('soft');
    assert(B.Save.tally().perp === 2, 'perp counted twice');
    assert(B.Save.totalRuns() === 3, 'total runs');
    assert(B.Save.discovered().length === 2, 'two distinct endings');
    B.storage.remove('endings:tally');
  });

  // ---------- Pacing / balance ----------
  test('Quota curve rises every day and starts near 0.8% of the book', () => {
    const Q = B.StoryData.QUOTAS;
    assert(Q.length === B.StoryData.DAYS.length, 'one quota per day');
    assert(Q[0] >= 0.0075 && Q[0] <= 0.01, 'day 1 quota ' + Q[0]);
    assert(Q[Q.length - 1] >= Q[0] * 4, 'quota should quadruple by the end');
    for (let i = 1; i < Q.length; i++) assert(Q[i] > Q[i - 1], 'quota should rise at day ' + (i + 1));
  });

  test('A trading day is three real minutes by default', () => {
    const mode = B.StoryMode();
    assert(mode.dayLength === 180, 'day length ' + mode.dayLength);
    const g = new B.Game(mode);
    near(g.rate, B.DAY_MIN / 180, 1e-9, 'game-minutes per real second');
  });

  test('Only about a third of tips actually pay', () => {
    const ints = new B.Interrupts({ mode: B.StoryMode() });
    const rng = B.RNG(B.hashSeed('tipdist'));
    const count = { real: 0, stale: 0, reversal: 0, fake: 0 };
    for (let i = 0; i < 4000; i++) {
      ints.tipsActed = 0;              // one session's worth per roll
      count[ints.rollTipOutcome(rng)]++;
    }
    const realShare = count.real / 4000;
    assert(realShare > 0.25 && realShare < 0.42, 'real tip share ' + realShare.toFixed(3));
    assert(count.stale > 0 && count.reversal > 0 && count.fake > 0, 'every outcome should occur');
    assert(count.fake / 4000 > 0.25, 'fakes should stay common');
  });

  test('Story mode caps working tips at one per session', () => {
    const ints = new B.Interrupts({ mode: B.StoryMode() });
    const rng = B.RNG(B.hashSeed('tipcap'));
    let reals = 0;
    for (let i = 0; i < 200; i++) if (ints.rollTipOutcome(rng) === 'real') reals++;
    assert(reals === 1, 'expected exactly one real tip per session, got ' + reals);
  });

  // ---------- Content safety ----------
  // Every company, person and event in this game must be invented. This walks
  // every string the game can print and fails on anything that names a real one.
  test('No real-world companies, people or events appear anywhere', () => {
    const DENY = [
      // firms
      'lehman', 'bear stearns', 'goldman', 'morgan stanley', 'jpmorgan', 'jp morgan', 'citigroup', 'citibank',
      'merrill', 'wachovia', 'countrywide', 'washington mutual', 'aig', 'fannie mae', 'freddie mac',
      'moody', 'standard & poor', 'fitch', 'blackrock', 'blackstone', 'vanguard', 'berkshire',
      'nvidia', 'openai', 'anthropic', 'deepmind', 'google', 'alphabet', 'microsoft', 'amazon', 'apple',
      'meta platforms', 'facebook', 'tesla', 'intel', 'amd', 'tsmc', 'oracle', 'coreweave', 'softbank',
      'walmart', 'exxon', 'chevron', 'robinhood', 'coinbase', 'chatgpt', 'gpt-4', 'gpt4', 'gemini', 'copilot',
      // people
      'buffett', 'bernanke', 'yellen', 'greenspan', 'paulson', 'geithner', 'powell', 'dimon', 'fuld',
      'madoff', 'musk', 'bezos', 'altman', 'zuckerberg', 'huang', 'trump', 'biden', 'obama',
      // agencies, indices, specific real events
      'federal reserve', 'the fed', 'sec', 'securities and exchange commission', 'fdic', 'finra',
      'nasdaq', 'dow jones', 's&p 500', 'nyse', 'wall street journal',
      'covid', 'subprime', '2008', 'great recession', 'dot-com', 'dotcom',
      'ukraine', 'russia', 'china', 'taiwan', 'israel', 'gaza', 'iran'
    ];
    // Whole-word matching: "Corvus Intelligence" must not trip on "intel", and
    // "campaign" must not trip on "aig".
    const rx = DENY.map((w) => ({
      w,
      re: new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i')
    }));
    const corpus = [];
    const push = (v) => {
      if (v == null) return;
      if (typeof v === 'string') corpus.push(v);
      else if (Array.isArray(v)) v.forEach(push);
      else if (typeof v === 'object') Object.keys(v).forEach((k) => push(v[k]));
    };

    for (const t of B.TICKERS) push([t.sym, t.name]);
    Object.keys(B.SECTORS).forEach((k) => push(B.SECTORS[k].name));
    Object.keys(B.REGIMES).forEach((k) => push(B.REGIMES[k].name));
    push(B.News.HANDLES);
    push(B.News.NOISE);
    push(B.News.TEMPLATES);

    const D = B.StoryData;
    push(D.ACTS);
    const flagSets = [{}, { dumped: true, insider: true, dereg: true, raid: true, fraud: true, bailout: true, algoDesk: true },
      { refusedDump: true, leaked: true, regulation: true, letFail: true, shortBanOn: true, testified: true, billPassed: true, toldRidgeway: true }];
    for (const f of flagSets) {
      const S = B.StoryMode.freshState(250000);
      Object.assign(S.f, f);
      for (const day of D.DAYS) {
        push(day.title);
        push(day.brief(S));
        const sc = day.scen(S);
        for (const e of sc.events || []) push([e.text, e.src, e.rumor && e.rumor.text, e.rumor && e.rumor.src]);
        if (day.inbox) for (const msg of day.inbox(S)) push([msg.from, msg.text]);
        if (day.calls) for (const c of day.calls(S)) push([c.from, c.role, c.text, (c.options || []).map((o) => o.label)]);
      }
    }
    Object.keys(D.CHOICES).forEach((k) => {
      const c = D.CHOICES[k];
      push([c.speaker, c.role, c.title, c.kicker, c.text]);
      for (const o of c.options) push([o.label, o.hint, o.headline, o.reply, o.after]);
    });
    for (const e of B.StoryEndings.list) {
      push([e.title, e.hint, e.lockedHint, e.headline, e.deck]);
      const S = B.StoryMode.freshState(250000);
      push(e.story({ S, wealth: 500000, start: 250000, reason: 'final' }));
    }

    const hay = corpus.join(' \n ').toLowerCase();
    const hits = rx.filter((x) => x.re.test(hay)).map((x) => x.w);
    assert(!hits.length, 'real-world references found: ' + hits.join(', '));
  });

  // ---------- Story graph ----------
  const D = B.StoryData;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  test('Every story day builds a valid scenario and briefing', () => {
    const variants = [{},
      { dereg: true, letFail: true, fraud: true, insider: true, dumped: true, raid: true, algoDesk: true },
      { regulation: true, bailout: true, reported: true, leaked: true, billPassed: true, tipShortBan: true, shortBanOn: true },
      { defected: true, refusedDump: true, toldRidgeway: true, testified: true }];
    for (const f of variants) {
      const S = B.StoryMode.freshState(250000);
      Object.assign(S.f, f);
      for (let d = 0; d < D.DAYS.length; d++) {
        const sc = D.DAYS[d].scen(S);
        assert(B.REGIMES[sc.regime], `day ${d + 1} bad regime`);
        for (const e of sc.events || []) for (const im of e.impacts || []) assert(isFinite(im.pct), `day ${d + 1} bad impact`);
        const br = D.DAYS[d].brief(S);
        assert(Array.isArray(br) && br.length, `day ${d + 1} briefing`);
        const m = new B.Market({ seed: 's' });
        m.startDay(d, sc);
        runDay(m);
        for (const tk of m.tickers) assert(tk.last > 0 && isFinite(tk.last), `day ${d + 1} ${tk.sym} price`);
      }
    }
  });

  test('Every decision lands on a day that exists, and mid-session calls are wired up', () => {
    const ids = Object.keys(D.CHOICES);
    for (const id of ids) {
      const c = D.CHOICES[id];
      assert(c.day >= 0 && c.day < D.DAYS.length, id + ' day out of range');
      assert(c.options && c.options.length >= 2, id + ' needs options');
      for (const o of c.options) assert(typeof o.apply === 'function', id + '/' + o.id + ' missing apply');
      if (c.mid) {
        const S = B.StoryMode.freshState(250000);
        const calls = D.DAYS[c.day].calls ? D.DAYS[c.day].calls(S) : [];
        const wired = calls.some((x) => x.choiceId === id);
        assert(wired, id + ' is a mid-session choice but no call on day ' + (c.day + 1) + ' triggers it');
      } else {
        assert(c.text && c.speaker, id + ' needs a speaker and text');
      }
    }
    assert(ids.length === 8, 'expected 8 decisions, found ' + ids.length);
  });

  test('Story graph: every ending is reachable through choices', () => {
    const order = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    const reached = {};
    let paths = 0;
    const archetypes = [
      { reason: 'final', wealth: 1.3, tradedTip: false },
      { reason: 'final', wealth: 3.4, tradedTip: false },
      { reason: 'final', wealth: 3.0, tradedTip: true },
      { reason: 'final', wealth: 0.8, tradedTip: false },
      { reason: 'wiped', wealth: 0.05, tradedTip: false },
      { reason: 'fired', wealth: 0.9, tradedTip: false }
    ];
    function walk(S, i, arch) {
      if (i === order.length) {
        paths++;
        const ctx = { S, wealth: arch.wealth * 250000, start: 250000, reason: arch.reason };
        const e = B.StoryEndings.resolve(ctx);
        assert(e, 'no ending resolved');
        reached[e.id] = (reached[e.id] || 0) + 1;
        return;
      }
      const c = D.CHOICES[order[i]];
      for (const o of c.options) {
        if (o.req && !o.req(S, arch.wealth * 250000)) continue;
        const S2 = clone(S);
        o.apply(S2);
        if (order[i] === 'c2' && o.id === 'trade' && arch.tradedTip) { S2.f.insiderTraded = true; D.adj(S2, { heat: 20 }); }
        // The firm automates the desk on the deregulated path (see story-engine onDayStart).
        if (order[i] === 'c6' && S2.f.dereg && !S2.f.regulation && !S2.f.reported) S2.f.algoDesk = true;
        if (order[i] === 'c7') S2.f.billPassed = B.StoryMode.votePasses(S2);
        walk(S2, i + 1, arch);
      }
    }
    for (const a of archetypes) walk(B.StoryMode.freshState(250000), 0, a);
    const missing = B.StoryEndings.list.map((e) => e.id).filter((id) => !reached[id]);
    assert(!missing.length, 'unreachable endings: ' + missing.join(', '));
    assert(paths > 1000, 'too few paths: ' + paths);
    B.__storyReach = { reached, paths };
  });

  test('Stabilization vote can go both ways', () => {
    const S = B.StoryMode.freshState(250000);
    const a = clone(S); a.f.whipped = true; a.m.anger = 40; a.m.stability = 70; a.rel.thorne = 60;
    const b2 = clone(S); b2.m.stability = 15; b2.f.whippedAgainst = true; b2.m.anger = 60;
    assert(B.StoryMode.votePasses(a) === true, 'should pass');
    assert(B.StoryMode.votePasses(b2) === false, 'should fail');
  });

  B.Tests = { results, run: () => results };
})(window.BTB);
