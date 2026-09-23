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

  test('Bracket validation rejects impossible protection values', () => {
    assert(!B.Broker.validateBracket(100.1, 10).ok, 'stop over 95% accepted');
    assert(!B.Broker.validateBracket(5, 500.1).ok, 'take-profit over 500% accepted');
    assert(!B.Broker.validateBracket(-1, 5).ok, 'negative stop accepted');
    assert(B.Broker.validateBracket(95, 500).ok, 'documented maxima rejected');
  });

  test('Programmatic bracket attachment clamps long and short triggers', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.BLWT.last = 100; m.bySym.BLWT.spread = 1e-12;
    b.marketOrder('BLWT', 100); b.attachBracket('BLWT', 500, 900);
    const longStop = b.orders.find((o) => o.label === 'STOP-LOSS');
    assert(longStop.price === 5 && longStop.price > 0, 'long stop was not clamped to 95%');
    b.flattenAll('TEST', true);
    b.marketOrder('BLWT', -100); b.attachBracket('BLWT', 500, 900);
    const shortStop = b.orders.find((o) => o.label === 'STOP-LOSS');
    assert(shortStop.price === 195, 'short stop uses wrong side or clamp');
  });

  test('Resting limit and stop fills reattach saved protection', () => {
    for (const type of ['limit', 'stop']) {
      const m = mkMarket(); const b = mkBroker(m);
      m.bySym.BLWT.last = 100; m.bySym.BLWT.spread = 1e-12;
      const r = b.placeOrder('BLWT', 100, type, type === 'limit' ? 101 : 99, { protect: { sl: 5, tp: 12 } });
      assert(r.ok && r.order.protect.sl === 5, type + ' lost metadata at placement');
      const done = b.processOrders();
      assert(done.length === 1 && done[0].res.ok, type + ' did not fill');
      assert(b.orders.filter((o) => o.bracket).length === 2, type + ' did not attach OCO bracket');
    }
  });

  test('Protection survives order reload and sizes to the filled position', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.BLWT.last = 100; m.bySym.BLWT.spread = 1e-12;
    b.marketOrder('BLWT', 40);
    b.placeOrder('BLWT', 60, 'limit', 101, { protect: { sl: 7, tp: 15 } });
    const saved = JSON.parse(JSON.stringify(b.serializeFull()));
    const b2 = mkBroker(m); b2.restore(saved);
    assert(b2.orders[0].protect.tp === 15, 'working protection did not reload');
    b2.processOrders();
    const brackets = b2.orders.filter((o) => o.bracket);
    assert(brackets.length === 2 && brackets.every((o) => Math.abs(o.qty) === 100), 'bracket did not cover full resulting position');
    b2.cancelOrder(brackets[0].id);
    assert(b2.orders.length === 1, 'explicit bracket cancellation failed');
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
  test('Quota curve is regime-based across all 61 sessions', () => {
    const Q = B.StoryData.QUOTAS;
    assert(Q.length === B.StoryData.DAYS.length, 'one quota per day');
    assert(Q[0] >= 0.0075 && Q[0] <= 0.01, 'day 1 quota ' + Q[0]);
    assert(Q.length === 61, 'campaign must contain 61 sessions');
    assert(Q[45] === Math.max(...Q), 'quota should peak after false-dawn weekend');
    assert(Q[30] < Q[29] && Q[60] < Q[55], 'panic regimes should cut quota');
    assert(Math.max(...Q) <= .03, 'quota curve should not extrapolate above 3%');
  });

  test('Patch 3 calendar and anomaly arithmetic is exact', () => {
    assert(B.StoryData.DAYS.length === 61, '61 sessions');
    assert(B.StoryData.weekOf(0) === 1 && B.StoryData.weekOf(60) === 13, 'thirteen calendar weeks');
    assert(B.StoryData.dowOf(0) === 'Monday' && B.StoryData.dowOf(60) === 'Monday', 'orphan Monday');
    assert(B.StoryData.ANOMALIES.length === 12, 'twelve anomalies');
    assert(new Set(B.StoryData.ANOMALIES.map((x) => x[0])).size === 12, 'anomaly sessions unique');
  });

  test('Patch 3 market timeline preserves false hope then collapse', () => {
    const S = B.StoryMode.freshState(250000);
    S.f.billPassed = true;
    const falseDawn = B.StoryData.DAYS.slice(41, 49).map((d) => d.scen(S).market);
    const rally = falseDawn.reduce((n, x) => n + x.target, 0);
    assert(rally >= .16 && rally <= .18, 'false dawn should compound to about 20%, got log sum ' + rally);
    assert(falseDawn.every((x) => x.target <= .022 && x.gap <= .004), 'false dawn must grind, never gap');
    const crash = B.StoryData.DAYS.slice(55, 60).map((d) => d.scen(S).market.target);
    assert(crash.join(',') === '-0.09,0.05,-0.04,-0.07,-0.11', 'vote/crash sequence drifted: ' + crash.join(','));
    S.f.pulledPlug = true;
    const last = B.StoryData.DAYS[60].scen(S);
    assert(last.market.gap === -.40, 'pull-the-plug opening must be -40%');
    assert(last.events.some((e) => e.script === 'pullFlatten'), 'pull-the-plug liquidation event missing');
  });

  test('Pre-open feed snowballs and contracts in the final sessions', () => {
    const D = B.StoryData.DAYS;
    assert(D[0].feed.length === 4 && D[5].feed.length === 5 && D[10].feed.length === 6, 'Act I feed ramp');
    assert(D[15].feed.length === 7 && D[21].feed.length === 8 && D[26].feed.length === 9, 'Act II feed ramp');
    assert(D[58].feed.length === 3 && D[60].feed.length === 3, 'Act IV feed contraction');
  });

  test('Cinematic Rhythm assigns a distinct high-resolution board to all 61 sessions', () => {
    assert(B.Rhythm && B.Rhythm.storyboards.length === 61, 'missing 61-board presentation map');
    const signatures = new Set(B.Rhythm.storyboards.map((x) => x.signature));
    assert(signatures.size === 61, `only ${signatures.size} distinct storyboard signatures`);
    const news = B.Scenes.news({ day: 60, brief: { title: 'Orphan Monday', kicker: 'IV · RECKONING', feed: [] } });
    const phone = B.Scenes.phone({ day: 60, brief: { feed: [{ source: 'WIRE', title: 'Before the bell' }] } });
    const weekend = B.Scenes.weekend({ day: 54 });
    assert(news.length >= 3 && news.every((beat) => beat.view.w === 640 && beat.view.h === 360), 'news boards are not native 640x360');
    assert(phone.length === 2 && phone.every((beat) => beat.view.w === 640), 'phone handoff is missing');
    assert(weekend.length === 3 && weekend.every((beat) => beat.view.h === 360), 'weekend punctuation is missing');
  });

  test('Version 2 story saves migrate to matching Patch 3 beats', () => {
    const old = { v: 2, kind: 'story', day: 13, mode: { S: { f: {}, choices: { c7:'whip', c8:'quiet' }, log: [{ day: 13, text:'x' }] } }, history: [{ day: 12 }] };
    const m = B.Save.migrateV2Snapshot(old);
    assert(m.v === 3 && m.day === 55, 'day 14 should map to session 56');
    assert(m.mode.S.choices.c8 === 'whip' && m.mode.S.choices.c9 === 'quiet', 'choice ids migrated');
    assert(m.history[0].day === 51 && m.mode.S.log[0].day === 55, 'history/log days migrated');
  });

  test('Version 2 mid-session saves rewind honestly to the mapped bell', () => {
    const old = { v:2, kind:'story', day:3, inDay:true, dayOpen:{fearLevel:20,px:{}}, broker:{cash:250000,pos:{},opts:[],orders:[]}, stress:{}, mode:{S:B.StoryMode.freshState(250000)}, history:[] };
    const migrated = B.Save.migrateV2Snapshot(old);
    assert(migrated.day === 12 && migrated.inDay === false, 'incompatible mid-day save did not rewind');
    assert(migrated.migrationNotice && migrated.mode.S.f.v2RewoundToBell, 'rewind was not disclosed');
    assert(migrated.market === migrated.dayOpen, 'opening tape was not promoted to a between-day snapshot');
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
    if (B.Sqwak) Object.keys(B.Sqwak.ACCOUNTS).forEach((h) => push([h, B.Sqwak.ACCOUNTS[h].name]));
    if (B.SqwakStory) { push(B.SqwakStory.INTRADAY); push(B.SqwakStory.PREOPEN); push(B.SqwakStory.POOLS); push(B.SqwakStory.BREAKING); }
    push(B.News.NOISE);
    if (B.Economy) { push(B.Economy.TIERS.map((t) => [t.name, t.note])); push(B.Economy.EVICT_STAGES); }
    if (B.Life) {
      const LS = B.StoryMode.freshState(250000);
      for (const f of [{}, { insider: true }, { perryFiled: true }, { dumped: true }]) {
        const S2 = Object.assign({}, LS, { f });
        for (const b of B.Life.LIFE) push([b.speaker, b.role, b.title, b.text(S2, {}), b.options.map((o) => [o.label, o.hint, o.apply(JSON.parse(JSON.stringify(S2)), B.Economy.fresh(), B.Economy)])]);
      }
    }
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
    assert(ids.length === 10, 'expected 10 decisions, found ' + ids.length);
    assert(ids.map((id) => D.CHOICES[id].day).join(',') === '9,13,19,28,34,36,37,54,57,59', 'decision chronology drifted');
  });

  test('Quota misses are cumulative, logged once, and terminate at the configured limit', () => {
    const mode = B.StoryMode();
    const S = mode.S;
    const g = {
      day: 0,
      history: [],
      indexStart: 500,
      broker: { equity: () => 250000, posQty: () => 0, opts: [] },
      market: { bySym: { INDX: { last: 500 } } }
    };
    const report = (day, quotaMet) => ({
      day, date: `Session ${day + 1}`, pnl: quotaMet ? 2500 : -100,
      equity: 250000, quota: 2000, quotaMet, earlyEnd: null
    });
    const close = (day, quotaMet) => {
      g.day = day;
      g.history.push({ day, pnl: quotaMet ? 2500 : -100, quotaMet });
      return mode.onDayEnd(g, report(day, quotaMet));
    };
    const limit = B.StoryMode.QUOTA_STRIKE_LIMIT;
    assert(limit === 30, 'calibrated strike limit drifted');
    for (let i = 0; i < limit - 1; i++) {
      const verdict = close(i, false);
      assert(!verdict.ending, `fired early on strike ${i + 1}`);
      assert(S.quotaStrikes === i + 1, 'a met quota erased cumulative strikes');
    }
    // Reprocessing one closing report must not create a duplicate strike.
    g.day = limit - 2;
    mode.onDayEnd(g, report(limit - 2, false));
    assert(S.quotaStrikes === limit - 1 && S.quotaLedger.length === limit - 1, 'duplicate strike was logged');
    const finalVerdict = close(limit - 1, false);
    assert(S.quotaStrikes === limit, 'final strike not recorded');
    assert(finalVerdict.ending && finalVerdict.ending.id === 'fired', 'configured strike limit did not terminate the career');
  });

  test('Quota strike ledger rebuilds from legacy save history', () => {
    const mode = B.StoryMode({ S: B.StoryMode.freshState(250000) });
    mode.S.quotaLedger = [];
    mode.S.quotaStrikes = 0;
    mode.reconcileQuotaStrikes([
      { day: 0, quotaMet: false, pnl: -10 },
      { day: 1, quotaMet: true, pnl: 20 },
      { day: 2, quotaMet: false, pnl: -30 },
      { day: 2, quotaMet: false, pnl: -30 }
    ]);
    assert(mode.S.quotaStrikes === 2, 'legacy misses were not deduplicated by session');
    assert(mode.S.quotaLedger[0].day === 0 && mode.S.quotaLedger[1].day === 2, 'ledger order is wrong');
  });

  test('Right Too Early requires meaningful repeated false-dawn exposure', () => {
    function run(exposedDays) {
      const mode = B.StoryMode(), S = mode.S;
      const g = { day:0, history:[], indexStart:500, market:{bySym:{INDX:{last:500},BSTN:{last:100},HLST:{last:100},RDGW:{last:100},FRLN:{last:100},AMVL:{last:100}}},
        broker:{ equity:()=>200000, opts:[], posQty:(sym)=>sym==='BSTN' && exposedDays.has(g.day)?-300:0 } };
      const r = (day) => ({day,date:'x',pnl:0,equity:200000,quota:0,quotaMet:true,earlyEnd:null});
      for (const day of [25,41,42,43,44,45,46,47,48]) { g.day=day; mode.onDayEnd(g,r(day)); }
      return S.f.rightTooEarly;
    }
    assert(run(new Set([25,41,42,43,44,45,46])) === true, 'six repeated sessions should qualify');
    assert(!run(new Set([25])), 'boundary-only loophole still qualifies');
    assert(!run(new Set([41,42,43,44,45,46,47,48])), 'no boundary exposure qualifies');
  });

  test('Final decision priority is explicit and Nobody is not a meter fallback', () => {
    const base = () => ({ S:B.StoryMode.freshState(250000), wealth:500000, start:250000, reason:'final', days:61, quotaMet:40 });
    let c=base(); c.S.f.pulledPlug=true; c.S.f.leftStack=true; c.S.f.aiUncontained=true;
    assert(B.StoryEndings.resolve(c).id==='exit','Pull the Plug lost priority');
    c=base(); c.S.f.leftStack=true; c.S.f.aiUncontained=true; c.S.f.fled=true;
    assert(B.StoryEndings.resolve(c).id==='nobody','Leave It Running lost direct consequence');
    c=base(); c.S.f.aiUncontained=true; c.S.anomalies=1; c.S.m.stability=10;
    assert(B.StoryEndings.resolve(c).id!=='nobody','Nobody still acts as a broad fallback');
  });

  test('Story graph: every chronological decision path resolves safely', () => {
    const order = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
    const reached = {};
    let paths = 0;
    const archetypes = [
      { reason: 'final', wealth: 1.3, tradedTip: false, anomalies: 12 },
      { reason: 'final', wealth: 3.0, tradedTip: true, anomalies: 6 }
    ];
    function walk(S, i, arch) {
      if (i === order.length) {
        paths++;
        if (!S.f.pulledPlug && (S.anomalies < 8 || S.f.leftStack)) S.f.aiUncontained = true;
        const ctx = { S, wealth: arch.wealth * 250000, start: 250000, reason: arch.reason, days: 61, quotaMet: 25 };
        const e = B.StoryEndings.resolve(ctx);
        assert(e, 'no ending resolved');
        reached[e.id] = (reached[e.id] || 0) + 1;
        return;
      }
      const c = D.CHOICES[order[i]];
      if (c.req && !c.req(S, arch.wealth * 250000)) return walk(S, i + 1, arch);
      for (const o of c.options) {
        if (o.req && !o.req(S, arch.wealth * 250000)) continue;
        const S2 = clone(S);
        o.apply(S2);
        if (order[i] === 'c2' && o.id === 'trade' && arch.tradedTip) { S2.f.insiderTraded = true; D.adj(S2, { heat: 20 }); }
        // The firm automates the desk on the deregulated path (see story-engine onDayStart).
        if (order[i] === 'c6' && S2.f.dereg && !S2.f.regulation && !S2.f.reported) S2.f.algoDesk = true;
        if (order[i] === 'c8') S2.f.billPassed = B.StoryMode.votePasses(S2);
        walk(S2, i + 1, arch);
      }
    }
    for (const a of archetypes) {
      const S = B.StoryMode.freshState(250000);
      S.anomalies = a.anomalies;
      walk(S, 0, a);
    }
    assert(paths > 50000, 'too few paths: ' + paths);
    B.__storyReach = { reached, paths };
  });

  test('All 22 ending gates are reachable without priority collisions', () => {
    function ctx(patch) {
      const S = B.StoryMode.freshState(250000);
      S.anomalies = 12;
      const c = { S, wealth: 325000, start: 250000, reason: 'final', days: 61, quotaMet: 40 };
      patch(c, S);
      return c;
    }
    const cases = {
      wiped: (c) => { c.reason = 'wiped'; c.wealth = 10000; },
      fired: (c) => { c.reason = 'fired'; },
      nobody: (c,S) => { S.f.aiUncontained = true; S.f.leftStack = true; S.anomalies = 6; },
      perp: (c,S) => { S.f.fraud = true; S.m.heat = 72; },
      'fall-guy': (c,S) => { S.f.externalFraud = true; S.m.heat = 58; },
      master: (c,S) => { S.f.fled = true; },
      whistle: (c,S) => { S.m.integrity = 75; S.f.reported = true; },
      cassandra: (c,S) => { S.m.integrity = 78; S.m.influence = 18; S.m.stability = 42; },
      revolving: (c,S) => { S.f.treasury = true; },
      acquirer: (c,S) => { S.f.letFail = true; S.m.firm = 68; S.m.influence = 34; },
      ward: (c,S) => { S.f.bailout = true; S.m.stability = 54; S.m.firm = 30; },
      clawback: (c,S) => { c.wealth = 550000; S.f.dumped = true; S.m.anger = 40; },
      'right-early': (c,S) => { S.f.rightTooEarly = true; },
      'lost-decade': (c,S) => { S.f.regulation = true; S.f.billPassed = false; S.m.stability = 40; },
      fund: (c,S) => { c.wealth = 1125000; S.m.heat = 12; S.rel.imani = 70; },
      'everything-rally': (c,S) => { c.wealth = 550000; S.f.bailout = true; S.f.billPassed = true; S.m.stability = 50; S.m.firm = 60; },
      depression: (c,S) => { S.m.stability = 22; },
      soft: (c,S) => { S.m.stability = 60; S.f.regulation = true; S.f.billPassed = true; },
      quiet: (c,S) => { c.wealth = 800000; S.m.heat = 12; S.rel.imani = 40; },
      replaced: (c,S) => { S.f.algoDesk = true; S.m.integrity = 50; },
      exit: (c,S) => { S.f.pulledPlug = true; },
      grind: () => {}
    };
    assert(Object.keys(cases).length === 22, 'fixture count');
    for (const id in cases) {
      const got = B.StoryEndings.resolve(ctx(cases[id]));
      assert(got && got.id === id, `${id} resolves as ${got && got.id}`);
    }
  });

  test('Stabilization vote can go both ways', () => {
    const S = B.StoryMode.freshState(250000);
    const a = clone(S); a.f.whipped = true; a.m.anger = 40; a.m.stability = 70; a.rel.thorne = 60;
    const b2 = clone(S); b2.m.stability = 15; b2.f.whippedAgainst = true; b2.m.anger = 60;
    assert(B.StoryMode.votePasses(a) === true, 'should pass');
    assert(B.StoryMode.votePasses(b2) === false, 'should fail');
  });

  // ---------- Sqwak ----------
  test('Sqwak hype: only 1M+ accounts move prices, and every pop fades', () => {
    const evs = [
      { t: 100, kind: 'chirp', text: 'loading calls on $CRVS', src: '@CallsOnlyCarl' },
      { t: 120, kind: 'chirp', text: 'loading calls on $CRVS', src: '@HedgeHog88' },
      { t: 140, kind: 'chirp', text: 'no ticker here, just vibes. buying', src: '@CallsOnlyCarl' }
    ];
    const out = B.Sqwak.hype(evs, 'test');
    const h = out.filter((e) => e.hype);
    assert(h.length === 2, 'expected one pop and one fade, got ' + h.length);
    const pop = h[0].impacts[0], fade = h[1].impacts[0];
    assert(pop.id === 'CRVS' && pop.pct > 0.005 && pop.pct < 0.021, 'pop size out of range: ' + pop.pct);
    assert(fade.pct < 0 && -fade.pct >= pop.pct * 0.99, 'fade must give back the whole pop');
    assert(h[1].t - h[0].t >= 8 && h[1].t - h[0].t <= 13, 'fade timing out of range');
    assert(B.Sqwak.hype(evs, 'test', 0).length === evs.length, 'strength 0 must switch hype off');
  });

  test('Sqwak hype and engagement are deterministic for save replay', () => {
    const m = B.StoryMode();
    for (const d of [5, 30, 55]) assert(JSON.stringify(m.scenario(d).events) === JSON.stringify(m.scenario(d).events), 'session ' + (d + 1) + ' differs between builds');
    const post = { t: 115, text: 'BREAKING?? $RDGW buyout', src: '@CallsOnlyCarl' };
    assert(JSON.stringify(B.Sqwak.metrics(post)) === JSON.stringify(B.Sqwak.metrics(post)), 'metrics changed between calls');
  });

  test('Sqwak: every session has authored market-hours posts and a full pre-open feed', () => {
    const D = B.StoryData;
    const counts = (d) => (d >= 58 ? 3 : d >= 26 ? 9 : d >= 21 ? 8 : d >= 15 ? 7 : d >= 10 ? 6 : d >= 5 ? 5 : 4);
    assert(B.SqwakStory.INTRADAY.length === D.DAYS.length, 'intraday list must cover every session');
    D.DAYS.forEach((day, d) => {
      assert(B.SqwakStory.INTRADAY[d].length >= 3, 'session ' + (d + 1) + ' has fewer than 3 posts');
      assert(day.feed.length === counts(d), 'session ' + (d + 1) + ' pre-open count ' + day.feed.length + ' breaks the snowball');
      const an = D.ANOMALIES.find((x) => x[0] === d);
      if (an) assert(day.feed.some((it) => it.anomalyId), 'session ' + (d + 1) + ' lost its anomaly');
      const titles = day.feed.map((it) => it.title);
      assert(new Set(titles).size === titles.length, 'session ' + (d + 1) + ' repeats a pre-open item');
    });
  });

  test('Resqwak: false rumours cost heat, true ones build influence, touting draws Compliance', () => {
    const m = B.StoryMode();
    const S = m.S;
    const pos = {};
    const g = { day: 5, broker: { posQty: (sym) => pos[sym] || 0 } };
    const h0 = S.m.heat, i0 = S.m.influence;
    m.onResqwak(g, { text: 'BREAKING?? $RDGW buyout', src: '@CallsOnlyCarl', fake: true });
    assert(S.m.heat === h0 + 3, 'false rumour should add 3 heat, got ' + (S.m.heat - h0));
    for (let i = 0; i < 5; i++) m.onResqwak(g, { text: 'fake again $RDGW', src: '@CallsOnlyCarl', fake: true });
    assert(S.m.heat === h0 + 9, 'heat from resqwaks must cap at 9 per session, got ' + (S.m.heat - h0));
    for (let i = 0; i < 5; i++) m.onResqwak(g, { text: 'hearing something on $CRVS', src: '@MacroMaven', truth: true });
    assert(S.m.influence === i0 + 3, 'influence from true rumours must cap at 3 per session');
    const g2 = { day: 6, broker: { posQty: (sym) => (sym === 'HLST' ? 100 : 0) } };
    const h1 = S.m.heat;
    const note = m.onResqwak(g2, { text: 'loading $HLST calls', src: '@TendiesTomorrow' });
    assert(S.m.heat === h1 + 2 && /Compliance/.test(note || ''), 'touting a held stock should add heat and warn once');
    assert(m.onResqwak(g2, { text: 'more $HLST', src: '@TendiesTomorrow' }) === null, 'Compliance warns only once per session');
    const g3 = { day: 7, broker: { posQty: () => 0, equity: () => 250000, pos: {}, opts: [] }, market: { bySym: {} } };
    m.onResqwak(g3, { text: 'fake $RDGW', src: '@CallsOnlyCarl', fake: true });
    m.onResqwak(g3, { text: 'true $CRVS', src: '@MacroMaven', truth: true });
    const v = m.onDayEnd(g3, { quota: 0, pnl: 0, equity: 250000 }) || {};
    const recap = (v.notes || []).find((n) => /^Sqwak:/.test(n)) || '';
    assert(/2 posts/.test(recap) && /1 turned out to be fake/.test(recap) && /1 was right/.test(recap), 'end-of-day recap missing or wrong: ' + recap);
  });

  test('Weekly quota: resets each Monday, a missed week is one career strike', () => {
    const mode = B.StoryMode({ S: B.StoryMode.freshState(250000) });
    const S = mode.S;
    let eq = 250000;
    const g = { day: 0, broker: { equity: () => eq, posQty: () => 0, opts: [], pos: {} }, market: { bySym: {} }, inboxQueue: [] };
    const close = (day, pnl) => { g.day = day; eq += pnl; return mode.onDayEnd(g, { quota: 1, quotaMet: true, pnl, equity: eq, date: 'x' }); };
    // Week 1: open Monday, clear the target by Friday.
    g.day = 0; mode.openWeek(g);
    const t1 = S.week.target;
    const pct = B.StoryData.QUOTAS.slice(0, 5).reduce((a, b) => a + b, 0);
    assert(Math.abs(t1 - 250000 * pct * 1.15) <= 50, 'week 1 target should be the week\'s daily quotas plus 15%, got ' + t1);
    for (let d = 0; d < 4; d++) close(d, 1000);
    const fri = close(4, t1);
    assert(S.quotaStrikes === 0 && fri.notes.some((n) => /Weekly quota met/.test(n)), 'a cleared week must not strike');
    // Week 2: resets from Friday's equity, and a losing week strikes once.
    g.day = 5; mode.openWeek(g);
    assert(S.week.w === 2 && S.week.startEq === eq, 'week 2 must reset from the new equity');
    for (let d = 5; d < 9; d++) close(d, -100);
    close(9, -100);
    assert(S.quotaStrikes === 1 && S.quotaLedger[0].kind === 'week', 'a missed week must add exactly one strike');
    mode.onDayEnd(g, { quota: 1, quotaMet: true, pnl: 0, equity: eq, date: 'x' });
    assert(S.quotaStrikes === 1, 'reprocessing Friday must not double the weekly strike');
    // A Friday daily miss and a weekly miss are two separate strikes, and survive a ledger rebuild.
    g.day = 10; mode.openWeek(g);
    for (let d = 10; d < 14; d++) close(d, 0);
    g.day = 14; eq -= 5000;
    mode.onDayEnd(g, { quota: 1000, quotaMet: false, pnl: -5000, equity: eq, date: 'x' });
    assert(S.quotaStrikes === 3, 'Friday daily miss plus weekly miss should be two strikes, total ' + S.quotaStrikes);
    mode.reconcileQuotaStrikes([]);
    assert(S.quotaStrikes === 3, 'ledger rebuild merged a weekly strike into a daily one');
    // Week 4: miss Monday, then make the week. The Monday strike is wiped and stays wiped.
    g.day = 15; mode.openWeek(g);
    const t4 = S.week.target;
    g.day = 15; eq -= 100;
    mode.onDayEnd(g, { quota: 1000, quotaMet: false, pnl: -100, equity: eq, date: 'x' });
    assert(S.quotaStrikes === 4, 'Monday miss should strike');
    for (let d = 16; d < 19; d++) close(d, 0);
    const v4 = close(19, t4 + 500);
    assert(S.quotaStrikes === 3 && v4.notes.some((n) => /wipes one missed day/.test(n)), 'a made week should wipe one missed day');
    mode.reconcileQuotaStrikes([{ day: 15, quotaMet: false, pnl: -100 }]);
    assert(S.quotaStrikes === 3, 'a wiped day came back after a ledger rebuild');
  });


  // ---- Personal economy ----
  const econRisk = (o) => Object.assign({ trough: 250000, breachT: null, flatT: null, mc: 0, liq: 0, peakLev: 0 }, o);

  test('Risk desk review: a clean day is clean', () => {
    const E = B.Economy;
    const rv = E.review({ risk: econRisk({ peakLev: 1.5 }), start: 250000, maxLev: 4, trades: [{ t: 10, sym: 'BSTN', qty: 100, open: true }], forced: [], events: [] });
    assert(rv.breaches.length === 0, 'clean day flagged: ' + JSON.stringify(rv.breaches));
    assert(/clean/.test(E.reviewNote(rv)), 'clean note missing');
  });

  test('Risk desk review flags loss limit, revenge, margin, size, overnight and hype chasing', () => {
    const E = B.Economy;
    const events = [
      { t: 100, hype: true, impacts: [{ scope: 'ticker', id: 'HLST', pct: 0.01 }] },
      { t: 110, hype: true, impacts: [{ scope: 'ticker', id: 'HLST', pct: -0.01 }] }
    ];
    const trades = [
      { t: 50, sym: 'BSTN', qty: 100, open: true },
      { t: 205, sym: 'BSTN', qty: -100, tag: '' },
      { t: 210, sym: 'FRLN', qty: 100, open: true },
      { t: 102, sym: 'HLST', qty: 50, open: true },
      { t: 300, sym: 'FRLN', qty: -100, tag: 'STOP-LOSS', open: true }
    ];
    const rv = E.review({ risk: econRisk({ breachT: 200, trough: 238000, mc: 1, peakLev: 3.8 }), start: 250000, maxLev: 4, trades, forced: ['AMVL'], events });
    const ids = rv.breaches.map((b) => b.id).sort().join(',');
    assert(ids === 'hype,loss,margin,overnight,revenge,size', 'wrong breaches: ' + ids);
    const closingOnly = E.review({ risk: econRisk({ breachT: 200, flatT: 203, trough: 242000 }), start: 250000, maxLev: 4, trades: [{ t: 202, sym: 'BSTN', qty: -100 }], events: [] });
    assert(closingOnly.breaches.length === 0 && closingOnly.hitLimit, 'getting flat after the loss limit is discipline, not a breach');
    const lateHype = E.review({ risk: econRisk(), start: 250000, maxLev: 4, trades: [{ t: 106, sym: 'HLST', qty: 50, open: true }], events });
    assert(!lateHype.breaches.length, 'a trade long after the hype post is not chasing it');
    const heavy = E.review({ risk: econRisk(), start: 250000, maxLev: 4, trades: [], closeLev: 1.6 });
    assert(heavy.breaches.length === 1 && heavy.breaches[0].id === 'overnight', 'carrying over 1x overnight should breach');
    const liq = E.review({ risk: econRisk({ mc: 1, liq: 1 }), start: 250000, trades: [] });
    assert(liq.breaches.length === 1 && liq.breaches[0].zero, 'a liquidation should zero the bonus');
  });

  test('Pay is a draw against bonus, and an unearned draw is repaid first', () => {
    const E = B.Economy, P = E.P;
    const w = E.fresh(); w.peakEq = 250000;
    const flat = E.settle(w, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
    assert(flat.bonus === 0 && flat.draw === P.drawPerSession * 5, 'flat week should pay the draw only');
    assert(w.deficit === P.drawPerSession * 5, 'unearned draw not recorded as owed');
    const big = E.settle(w, { equity: 300000, capital: 250000, weekMade: true, breaches: [], sessions: 5 });
    const expectBonus = Math.round(50000 * P.bonusMade * (1 + P.cleanKicker));
    assert(E.multiplier([{ id: 'size' }], [{ id: 'size' }, { id: 'hype' }], 5) === 1 - 2 * P.breachCut, 'breach kinds over two weeks miscounted');
    assert(big.bonus === expectBonus, `bonus ${big.bonus} != ${expectBonus}`);
    const gross = big.draw + (expectBonus - big.draw) - P.drawPerSession * 5;
    assert(big.net === Math.round(gross * (1 - P.taxRate)), 'deficit was not repaid out of the bonus');
    assert(w.deficit === 0, 'deficit should be cleared');
    // Same P&L again pays no bonus: only new highs count.
    const again = E.settle(w, { equity: 300000, capital: 250000, weekMade: true, breaches: [], sessions: 5 });
    assert(again.bonus === 0, 'bonus paid twice on the same high');
  });

  test('Discipline pays: same P&L, breaches earn less, a liquidation earns only the draw', () => {
    const E = B.Economy;
    const run = (breaches) => {
      const w = E.fresh(); w.peakEq = 250000;
      return E.settle(w, { equity: 290000, capital: 250000, weekMade: true, breaches, sessions: 5 }).net;
    };
    const clean = run([]), two = run([{ id: 'revenge' }, { id: 'hype' }]), liq = run([{ id: 'margin', zero: true }]);
    assert(clean > two && two > liq, `clean ${clean} > two breaches ${two} > margin call ${liq}`);
    assert(liq === Math.round(E.P.drawPerSession * 5 * (1 - E.P.taxRate)), 'a margin-call week should pay the bare draw');
    const P = E.P;
    assert(P.drawPerSession * 5 * (1 - P.taxRate) >= E.TIERS[E.DEFAULT_TIER].rent, 'the draw should cover the default rent');
    assert(P.drawPerSession * 5 * (1 - P.taxRate) < E.TIERS[E.DEFAULT_TIER].rent + P.living + P.loan + P.mom, 'the draw should not cover the whole week');
  });

  test('A trader who never makes money slides into eviction, never a game over', () => {
    const E = B.Economy;
    const w = E.fresh(); w.peakEq = 250000;
    let evictedWeek = 0;
    for (let wk = 1; wk <= 13 && !evictedWeek; wk++) {
      E.settle(w, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
      if (w.evictions) evictedWeek = wk;
    }
    assert(evictedWeek >= 5 && evictedWeek <= 10, 'a flat trader on the default flat should be evicted mid-career, got week ' + evictedWeek);
    assert(E.tier(w).id === 'couch' && E.netWorth(w) < 0, 'eviction should land on the couch, in debt');
    // Downsizing early is the way out.
    const w2 = E.fresh(); w2.peakEq = 250000; E.move(w2, 1);
    for (let wk = 1; wk <= 13; wk++) E.settle(w2, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
    assert(!w2.evictions, 'moving to the cheapest flat should keep a flat trader housed');
  });

  test('Career payroll runs once per week and never touches the book', () => {
    const mode = B.StoryMode(), S = mode.S;
    const cash0 = 250000;
    const broker = { cash: cash0, equity: () => 260000, posQty: () => 0, opts: [], dayTrades: () => [], rules: { maxLev: 4 },
      dayRisk: { trough: 250000, breachT: null, mc: 0, liq: 0, peakLev: 1 } };
    const g = { day: 4, history: [], broker, market: { events: [], bySym: { INDX: { last: 500 } } }, indexStart: 500 };
    const r = () => ({ day: 4, date: 'x', pnl: 3000, equity: 260000, start: 257000, quota: 1000, quotaMet: true, eod: { forced: [] } });
    const before = S.wallet.cash;
    const v1 = mode.onDayEnd(g, r());
    const after = S.wallet.cash;
    mode.onDayEnd(g, r());
    assert(S.wallet.cash === after, 'a replayed Friday close paid twice');
    assert(after !== before && v1.notes.some((n) => /Payslip/.test(n)) && v1.notes.some((n) => /Risk desk review/.test(n)), 'payslip or review missing from the closing memo');
    assert(broker.cash === cash0, 'payroll touched the trading book');
    const legacy = B.StoryMode({ S: JSON.parse(JSON.stringify(Object.assign({}, S, { wallet: undefined }))) });
    assert(legacy.S.wallet && legacy.S.wallet.cash === B.Economy.P.startCash, 'a pre-economy save did not get a fresh wallet');
  });

  test('Risk desk edge cases: flips open risk, fat fingers and sharp rumours do not breach, options can chase', () => {
    const E = B.Economy;
    const m = new B.Market({ seed: 'econ-edge' });
    const b = new B.Broker({ cash: 250000 }); b.attach(m);
    m.startDay(0, { regime: 'chop' }); b.startDay();
    m.step(1);
    b.marketOrder('BSTN', 100, {});
    const flip = b.marketOrder('BSTN', -200, {});
    assert(flip.ok && b.trades[b.trades.length - 1].open, 'flipping through zero should count as opening risk');
    const hype = (src) => [
      { t: 100, hype: true, src, impacts: [{ scope: 'ticker', id: 'HLST', pct: 0.01 }] },
      { t: 110, hype: true, src, impacts: [{ scope: 'ticker', id: 'HLST', pct: -0.01 }] }];
    const chase = [{ t: 101, sym: 'HLST', qty: 10, open: true }];
    assert(!E.review({ risk: econRisk(), start: 250000, trades: chase, events: hype('@MacroMaven') }).breaches.length, 'a sharp account is news, not hype');
    assert(E.review({ risk: econRisk(), start: 250000, trades: chase, events: hype('@CallsOnlyCarl') }).breaches.length === 1, 'a hype account post should be chaseable');
    const call = [{ t: 101, sym: 'HLST 20C', und: 'HLST', dir: 1, qty: 2, opt: true, open: true }];
    assert(E.review({ risk: econRisk(), start: 250000, trades: call, events: hype('@CallsOnlyCarl') }).breaches.length === 1, 'chasing with calls should count');
    const ff = [{ t: 250, sym: 'BSTN', qty: 300, open: true, tag: 'FAT FINGER' }];
    assert(!E.review({ risk: econRisk({ breachT: 200, flatT: 201 }), start: 250000, trades: ff, events: [] }).breaches.length, 'a fat finger is not a choice');
    const resting = [{ t: 250, placed: 20, sym: 'BSTN', qty: 100, open: true, tag: 'LIMIT' }];
    assert(!E.review({ risk: econRisk({ breachT: 200, flatT: 201 }), start: 250000, trades: resting, events: [] }).breaches.length, 'a resting order placed before the limit is not revenge');
  });

  test('Card is paid down from spare cash; the lone final Monday bills one fifth of a week', () => {
    const E = B.Economy, P = E.P;
    const w = E.fresh(); w.peakEq = 250000; w.card = 1200; w.cash = 400;
    E.settle(w, { equity: 300000, capital: 250000, weekMade: true, breaches: [], sessions: 5 });
    assert(w.card === 0 && w.cash >= P.cardBuffer, 'spare cash should clear the card: card ' + w.card + ' cash ' + w.cash);
    const w2 = E.fresh(); w2.peakEq = 250000; w2.cash = 10000;
    E.settle(w2, { equity: 250000, capital: 250000, weekMade: true, breaches: [], sessions: 1 });
    const draw1 = Math.round(P.drawPerSession * (1 - P.taxRate));
    const bills1 = Math.round((P.living + P.loan + P.mom) / 5) + Math.round(E.TIERS[E.DEFAULT_TIER].rent / 5);
    assert(w2.cash === 10000 + draw1 - bills1, `final Monday should bill a fifth of a week: ${w2.cash}`);
    const w3 = E.fresh(); w3.peakEq = 250000;
    const jackpot = E.settle(w3, { equity: 5000000, capital: 250000, weekMade: true, breaches: [], sessions: 1 });
    assert(jackpot.bonus <= 5000000 * P.bonusCap / 5 * (1 + P.cleanKicker) + 1, 'one session cannot pay out a season');
  });

  test('Stopping cleanly at the loss limit excuses the missed quota; staying in does not', () => {
    const run = (flatT) => {
      const mode = B.StoryMode(), S = mode.S;
      const broker = { cash: 250000, equity: () => 242000, posQty: () => 0, opts: [], dayTrades: () => [], rules: { maxLev: 4 }, stockGross: () => 0, leverage: () => 0,
        dayRisk: { trough: 242000, breachT: 120, flatT, mc: 0, liq: 0, peakLev: 1 } };
      const g = { day: 2, history: [{ day: 2, pnl: -8000, quotaMet: false }], broker, market: { events: [], bySym: { INDX: { last: 500 } } }, indexStart: 500 };
      const v = mode.onDayEnd(g, { day: 2, date: 'x', pnl: -8000, equity: 242000, start: 250000, quota: 2000, quotaMet: false, eod: { forced: [] } });
      mode.reconcileQuotaStrikes(g.history);
      return { strikes: S.quotaStrikes, v };
    };
    const clean = run(122), stayed = run(null);
    assert(clean.strikes === 0 && clean.v.notes.some((n) => /strike excused/.test(n)), 'a clean stop should not strike, even after a ledger rebuild');
    assert(stayed.strikes === 1, 'staying in past the limit should still strike');
  });

  test('Taking the plane ends the career; worthless options are abandoned without commission', () => {
    const mode = B.StoryMode(), S = mode.S;
    S.f.fled = true;
    const b = { pos: {}, opts: [], orders: [], cash: 500000, equity: () => 500000, fill: () => ({}) };
    let got = null;
    mode.afterDay({ day: 57, broker: b, market: { bySym: { INDX: { last: 500 } } }, history: [], indexStart: 500 }, (ending) => { got = ending; });
    assert(!got, 'no decision that day should mean no ending yet');
    const c9 = Object.keys(B.StoryData.CHOICES).find((k) => B.StoryData.CHOICES[k].options.some((o) => /flee|plane/i.test(o.id + ' ' + o.label)));
    assert(c9, 'the plane option exists');
    const m = new B.Market({ seed: 'abandon' });
    const br = new B.Broker({ cash: 100000 }); br.attach(m);
    m.startDay(0, { regime: 'chop' }); br.startDay(); m.step(1);
    br.opts.push({ id: 999, sym: 'BSTN', type: 'C', strike: 99999, expiry: 1, qty: 1000, avg: 0.05 });
    const cash0 = br.cash;
    br.sellOption(999, 1000, true);
    assert(br.cash >= cash0, 'selling worthless contracts should not cost commission: ' + (br.cash - cash0));
  });

  test('Flatten keeps stop-losses on a position it could not close', () => {
    const m = new B.Market({ seed: 'flatten-halt' });
    const b = new B.Broker({ cash: 250000 }); b.attach(m);
    m.startDay(0, { regime: 'chop' }); b.startDay(); m.step(1);
    b.marketOrder('BSTN', 100, {});
    b.marketOrder('HLST', 100, {});
    b.attachBracket('BSTN', 5, 10);
    b.attachBracket('HLST', 5, 10);
    b.placeOrder('CRVS', 10, 'limit', 1, {});
    m.bySym.HLST.haltUntil = m.t + 30;
    b.flattenAll();
    assert(!b.pos.BSTN && b.pos.HLST, 'the halted name should stay open');
    assert(b.orders.filter((o) => o.bracket && o.sym === 'HLST').length === 2, 'the halted position lost its stop and target');
    assert(!b.orders.some((o) => !o.bracket), 'working orders should be cancelled');
  });

  test('Life beats: fire once, cost your own money, and bill payment plans weekly', () => {
    const mode = B.StoryMode(), S = mode.S, W = S.wallet, E = B.Economy;
    W.cash = 20000; W.card = 0;
    const r1 = mode.applyLife('dadBill', 'plan');
    assert(r1 && W.cash === 12900 && W.card === 0, 'half the bill should come out of cash: ' + W.cash);
    assert(mode.applyLife('dadBill', 'pay') === null, 'a life beat must not fire twice');
    W.peakEq = 250000; W.cash = 20000; W.card = 0;
    E.settle(W, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
    assert(W.plans[0].left === 5, 'the plan should take one payment a week');
    mode.applyLife('pension', 'monthly');
    assert(E.weekly(E.tier(W), W) === E.weekly(E.tier(W)) + 290, 'weekly support should raise the week');
    mode.applyLife('rentHike', 'accept');
    assert(Math.abs(W.rentMult - 1.09) < 1e-9, 'accepting the hike should raise rent 9%');
    const k0 = S.rel.kroll; mode.applyLife('advance', 'take');
    assert(W.deficit > 8000 && S.rel.kroll > k0, 'the advance is owed back out of bonus and pleases Kroll');
    assert(B.Life.LIFE.every((b) => !Object.keys(B.StoryData.CHOICES).some((k) => B.StoryData.CHOICES[k].day === b.day)), 'life beats should not share a day with a desk decision');
  });

  B.Tests = { results, run: () => results };
})(window.BTB);
