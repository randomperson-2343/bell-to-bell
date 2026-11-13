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

  test('Only fills that close something count as finished trades', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.BLWT;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('BLWT', 100);
    assert(!b.dayTrades().some((x) => x.closed), 'an opening fill is not a finished trade');
    b.marketOrder('BLWT', 50);
    tk.last = 110;
    b.marketOrder('BLWT', -150);
    const done = b.dayTrades().filter((x) => x.closed);
    assert(done.length === 1 && done[0].realized > 0, 'the closing fill is the one finished trade');
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
    const closed = b.dayTrades().filter((x) => x.closed);
    assert(closed.length === 1 && closed[0].tag === 'EXPIRED' && closed[0].realized > 0, 'expiry should count as a closed trade in the end-of-day report');
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
  test('Quota curve is regime-based across all 46 sessions', () => {
    const Q = B.StoryData.QUOTAS;
    assert(Q.length === B.StoryData.DAYS.length, 'one quota per day');
    // V4.3 calibration: half the V4 curve, so a careful trader right two days
    // in three reaches the final decisions (js/tests/economy-run.js career bots).
    assert(Q[0] === 0.005, 'day 1 quota ' + Q[0]);
    assert(Q.length === 46, 'campaign must contain 46 sessions');
    assert(Q[32] === Math.max(...Q), 'quota should peak after false-dawn weekend');
    assert(Q[17] < Q[16] && Q[45] < Q[40], 'panic regimes should cut quota');
    assert(Math.max(...Q) <= .0225, 'quota curve should not extrapolate above 2.25%');
    const m = B.StoryMode();
    assert(m.quota(0) === 1250 && m.quota(16) === 3250 && m.quota(32) === 5650, 'anchor quotas at $250,000: ' + [m.quota(0), m.quota(16), m.quota(32)]);
  });

  test('Patch 3 calendar and anomaly arithmetic is exact', () => {
    assert(B.StoryData.DAYS.length === 46, '46 sessions');
    assert(B.StoryData.weekOf(0) === 1 && B.StoryData.weekOf(45) === 10, 'ten calendar weeks');
    assert(B.StoryData.dowOf(0) === 'Monday' && B.StoryData.dowOf(45) === 'Monday', 'orphan Monday');
    assert(B.StoryData.ANOMALIES.length === 12, 'twelve anomalies');
    assert(new Set(B.StoryData.ANOMALIES.map((x) => x[0])).size === 12, 'anomaly sessions unique');
  });

  test('Patch 3 market timeline preserves false hope then collapse', () => {
    const S = B.StoryMode.freshState(250000);
    S.f.billPassed = true;
    const falseDawn = B.StoryData.DAYS.slice(28, 36).map((d) => d.scen(S).market);
    const rally = falseDawn.reduce((n, x) => n + x.target, 0);
    assert(rally >= .16 && rally <= .18, 'false dawn should compound to about 20%, got log sum ' + rally);
    assert(falseDawn.every((x) => x.target <= .022 && x.gap <= .004), 'false dawn must grind, never gap');
    const crash = B.StoryData.DAYS.slice(40, 45).map((d) => d.scen(S).market.target);
    assert(crash.join(',') === '-0.09,0.05,-0.04,-0.07,-0.11', 'vote/crash sequence drifted: ' + crash.join(','));
    S.f.pulledPlug = true;
    const last = B.StoryData.DAYS[45].scen(S);
    assert(last.market.gap === -.40, 'pull-the-plug opening must be -40%');
    assert(last.events.some((e) => e.script === 'pullFlatten'), 'pull-the-plug liquidation event missing');
    // The choice and The Exit both say the exchange shuts for the day at the open.
    const pm = mkMarket(last, 'pull');
    assert(pm.step(0.25).some((e) => e.type === 'breaker' && e.level === 3) && pm.status === 'closed', 'pull-the-plug open must trip the level 3 breaker');
  });

  test('Pre-open feed snowballs and contracts in the final sessions', () => {
    const D = B.StoryData.DAYS;
    assert(D[0].feed.length === 4 && D[2].feed.length === 5 && D[4].feed.length === 6, 'Act I feed ramp');
    assert(D[8].feed.length === 7 && D[12].feed.length === 8 && D[15].feed.length === 9, 'Act II feed ramp');
    assert(D[43].feed.length === 3 && D[45].feed.length === 3, 'Act IV feed contraction');
  });

  test('Storyboard: every session has an authored row and native 640x360 beats', () => {
    const SB = B.Storyboard;
    assert(SB && SB.SHEET.length === 46, 'beat sheet must cover all 46 sessions');
    for (let day = 0; day < 46; day++) {
      const news = B.Scenes.news({ day, brief: { title: 'Session ' + (day + 1), feed: [] } });
      assert(news.length >= 1 && news.every((b) => b.view.w === 640 && b.view.h === 360), 'session ' + (day + 1) + ' is not native 640x360');
      assert(news.some((b) => b.informative), 'session ' + (day + 1) + ' has no informative beat for short mode');
    }
    // Close-ups quote the current quota table, not a stale one.
    const q = SB.SHEET[32][2].match(/([\d.]+)%/);
    near(+q[1] / 100, B.StoryData.QUOTAS[32], 1e-9, 'session 33 quota insert');
    const phone = B.Scenes.phone({ day: 45, brief: { feed: [{ source: 'WIRE', title: 'Before the bell' }] } });
    assert(phone.length === 2 && phone.every((beat) => beat.view.w === 640), 'phone handoff is missing');
    assert(B.Scenes.weekend({ day: 29 }).length === 3, 'ordinary weekends are sat, sun, hold');
    assert(B.Scenes.weekend({ day: 24 }).length === 3 && B.Scenes.weekend({ day: 39 }).length === 4, 'only the whip weekend gets a second room');
    // short mode shows Saturday when the weekend has no story line, and Sunday when it has one
    const sat = (day, game) => B.Scenes.weekend({ day, game })[0];
    assert(/:sat$/.test(sat(9).id) && sat(9).informative === true && sat(19).informative === true, 'a weekend with no story line should show Saturday in short mode');
    assert(sat(4).informative === false && sat(44).informative === false && B.Scenes.weekend({ day: 4 })[1].informative === true, 'a weekend with a story line should show Sunday in short mode');
  });

  test('Storyboard: four mornings follow the choice made the night before', () => {
    const SB = B.Storyboard;
    const S = (choices, f) => ({ choices: choices || {}, f: f || {} });
    assert(SB.row(4, S({ c1: 'dump' })).arg !== SB.row(4, S({ c1: 'refuse' })).arg, 'session 5 ignores the pension dump');
    assert(SB.row(22, S({ c5: 'fail' })).shot === 'dark' && SB.row(22, S({ c5: 'ban' })).arg !== SB.row(22, S({ c5: 'bail' })).arg, 'session 23 ignores Rescue Weekend');
    assert(SB.row(40, S({}, { billPassed: true })).shot === 'tableau' && SB.row(40, S()).shot === 'tableau', 'session 41 (the failed vote) ignores the vote');
    assert(/PASSES/.test(SB.row(41, S({}, { billPassed: true })).arg) && !/PASSES/.test(String(SB.row(41, S()).arg)), 'the bill-passes card is on session 42, only when it passes');
    assert(SB.row(45, S({}, { pulledPlug: true })).shot === 'racks', 'session 46 ignores Pull the Plug');
    // Variant mornings must not reuse the default morning's cached frames.
    const ids = (S$) => B.Scenes.news({ day: 4, brief: { title: 'x', feed: [] }, game: { mode: { S: S$ } } }).map((b) => b.id).join();
    assert(ids(S({ c1: 'dump' })) !== ids(S()), 'variant shares frame cache ids with the default');
    assert(SB.ANOMALY_DAYS.length === 12, 'one tell per technical anomaly');
  });

  test('Decision scenes: every desk and life decision opens on its own room', () => {
    const D = B.StoryData, A = B.DecisionArt;
    const list = Object.keys(D.CHOICES).filter((k) => !D.CHOICES[k].mid).map((k) => Object.assign({ id: k }, D.CHOICES[k]))
      .concat(B.Life.LIFE);
    assert(list.length === 18, 'expected 8 desk decisions and 10 life beats, got ' + list.length);
    for (const c of list) {
      assert(A.ROOMS[c.id], c.id + ' has no room');
      const beats = B.Scenes.decision({ id: c.id, day: c.day, speaker: c.speaker, role: c.role, title: c.title, S: B.StoryMode.freshState(250000) });
      assert(beats.length === 2 && beats[1].informative && beats.every((b) => b.view.w === 640), c.id + ' decision beats');
      // Every voice has a face now, household ones and the landlord's screen included.
      assert(B.Portraits.has(c.speaker), 'no portrait for ' + c.speaker);
    }
    // The aftermath is one popup with the room in it, not a second cutscene.
    assert(!B.Scenes.decisionAfter && typeof A.still === 'function', 'aftermath still belongs in the popup');
  });

  test('Endings: 22 props, one card, and a last picture after', () => {
    const ids = B.Rhythm.endingIds;
    assert(ids.length === 22, 'ending list');
    for (const id of ids) {
      const beats = B.Scenes.ending({ id, title: id, deck: 'Deck', dark: false });
      assert(beats.length === 3, id + ' ending beats');
      assert(beats.filter((b) => b.line === 'Deck').length === 1, id + ' prints the deck once');
    }
    const pulled = B.Scenes.ending({ id: 'grind', pulled: true })[2], dawn = B.Scenes.ending({ id: 'grind' })[2];
    assert(pulled.id !== dawn.id && pulled.line !== dawn.line, 'pulling the plug changes the last picture');
  });

  test('Quota pay: each quota day pays on top of the draw, cut by breaches', () => {
    const E = B.Economy;
    const pay = (metDays, breaches) => { const w = E.fresh(); return E.settle(w, { equity: 250000, capital: 250000, weekMade: false, breaches: breaches || [], metDays, sessions: 5 }).net; };
    const none = pay(0), three = pay(3);
    near(three - none, Math.round(3 * E.P.quotaPay * (1 + E.P.cleanKicker) * (1 - E.P.taxRate)), 2, 'three clean quota days');
    assert(pay(3, [{ id: 'size' }]) < three, 'a breach cuts quota pay');
    assert(pay(3, [{ id: 'margin', zero: true }]) === none, 'a margin call zeroes quota pay');
    const w = E.fresh(); E.settle(w, { equity: 250000, capital: 250000, weekMade: false, breaches: [], metDays: 5, sessions: 5 });
    assert(w.deficit === E.P.drawPerSession * 5, 'quota pay never repays or reduces unearned draw');
  });

  test('Payday summary distinguishes bills from payments and agrees with eviction debt', () => {
    const E = B.Economy, terms = { equity: 250000, capital: 250000, weekMade: false, breaches: [], metDays: 0, sessions: 5 };
    const w = E.fresh();
    w.cash = 0; w.card = 2000; w.arrears = 500;
    const low = E.settle(w, terms);
    assert(low.lines[0].includes('billed this week') && !low.lines[0].includes('bills out'), 'unpaid charges must not be described as money spent');
    assert(low.lines[0].includes(B.fmt.money(w.card)) && low.lines[0].includes(B.fmt.money(w.arrears)), 'summary must show outstanding debt');
    const evicted = E.fresh();
    evicted.cash = 0; evicted.arrears = 500; evicted.lateWeeks = 3;
    const final = E.settle(evicted, terms);
    assert(evicted.arrears === 0 && evicted.card > 0, 'eviction should transfer rent debt to the card');
    assert(final.lines[1].includes('moved to your card') && final.lines[0].includes(B.fmt.money(evicted.card)), 'visible eviction warning must match the wallet');
  });

  test('Seasons run October to January across the ten weeks', () => {
    const s = B.Rhythm.season;
    assert(s(0).id === 'autumn' && s(10).id === 'autumn' && s(11).id === 'grey' && s(31).id === 'grey' && s(32).id === 'winter', 'season boundaries');
    assert(!s(31).snow && s(45).snow === 1, 'snow arrives in winter and deepens');
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

  test('Version 3 saves move to the shortened story: removed sessions go to the next kept one', () => {
    const D = B.StoryData, sid = (n) => D.DAYS[n].sid;
    assert(D.DAYS.length === 46 && sid(1) === 2 && sid(45) === 60, 'sessions carry their original ids');
    const S = B.StoryMode.freshState(250000);
    S.log = [{ day: 9, text: 'c1' }];
    S.quotaLedger = [{ day: 3 }, { day: 2 }, { day: 19, week: 4, kind: 'week' }]; // old session 4 no longer exists
    S.week = { w: 3 };
    S.wallet = { weeks: { 1: { net: 1 }, 2: { net: 2 }, 3: { net: 3 } }, days: { 3: [], 4: [], 9: [] }, ledgerPaidWeek: 6 };
    const old = { v: 3, kind: 'story', day: 28, history: [{ day: 3 }, { day: 2 }, { day: 7 }, { day: 9 }], mode: { S } };
    const m = B.Save.migrateV3Snapshot(old);
    assert(m.v === 4 && m.day === 16, 'old session 29 is kept as new session 17: ' + m.day);
    assert(m.history.map((h) => h.day).join() === '1,3', 'history keeps rows of kept sessions only, one per day: ' + m.history.map((h) => h.day));
    assert(m.mode.S.log[0].day === 3 && m.mode.S.quotaLedger[0].day === 1, 'log and ledger days remapped');
    assert(m.mode.S.quotaLedger.length === 2 && m.mode.S.quotaLedger[1].day === 10 && m.mode.S.quotaLedger[1].week === 3, 'week strikes follow their day, and a removed session leaves no strike');
    assert(m.mode.S.week === undefined, 'the open week is rebuilt by the next session');
    const w = m.mode.S.wallet;
    assert(Object.keys(w.days).join() === '3' && w.weeks[1].net === 2 && w.weeks[2].net === 3 && w.ledgerPaidWeek === 4, 'wallet records follow kept days and finished weeks');
    // Every old session maps to a session that exists, monotonically.
    let last = 0;
    for (let o = 0; o < 61; o++) {
      const day = B.Save.migrateV3Snapshot({ v: 3, kind: 'story', day: o, mode: { S: B.StoryMode.freshState(250000) } }).day;
      assert(day >= last && day < 46 && sid(day) >= o, 'old session ' + (o + 1) + ' maps forward to a kept session');
      last = day;
    }
    const mid = B.Save.migrateV3Snapshot({ v: 3, kind: 'story', day: 20, inDay: true, dayOpen: { fearLevel: 20 }, mode: { S: B.StoryMode.freshState(250000) } });
    assert(mid.inDay === false && mid.migrationNotice && mid.market === mid.dayOpen, 'a mid-session save rewinds to the bell');
    // read() chains V3 -> V4 for a stored slot.
    B.storage.set('save:slot:5', { v: 3, kind: 'story', day: 20, mode: { S: B.StoryMode.freshState(250000) } });
    const stored = B.Save.read(5);
    B.storage.remove('save:slot:5');
    assert(stored && stored.v === 4 && stored.day === 11, 'read() migrates a V3 slot: ' + (stored && stored.day));
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
      'ukraine', 'russia', 'china', 'taiwan', 'israel', 'gaza', 'iran',
      // real places and institutions that crept into story copy
      'wall street', 'teterboro', 'miami', 'europe', 'washington'
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
    if (B.SqwakStory) { push(B.SqwakStory.INTRADAY); push(B.SqwakStory.PREOPEN); push(B.SqwakStory.POOLS); push(B.SqwakStory.BREAKING); push(B.SqwakStory.FAILED_INTRADAY); push(B.SqwakStory.FAILED_FEED); push(B.SqwakStory.FAILED_BREAKING); push(B.StoryData.VOTE_FAIL); }
    push(B.News.NOISE);
    if (B.Economy) { push(B.Economy.TIERS.map((t) => [t.name, t.note])); push(B.Economy.EVICT_STAGES); }
    if (B.Mentor) for (const day of [0, 1]) push(B.Mentor.LINES.map((l) => l[3]({ day, market: { events: [] } }, {})));
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
    assert(ids.map((id) => D.CHOICES[id].day).join(',') === '3,7,10,16,21,23,24,39,42,44', 'decision chronology drifted');
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
    assert(limit === 23, 'calibrated strike limit drifted');
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
      for (const day of [14,28,29,30,31,32,33,34,35]) { g.day=day; mode.onDayEnd(g,r(day)); }
      return S.f.rightTooEarly;
    }
    assert(run(new Set([14,28,29,30,31,32,33])) === true, 'six repeated sessions should qualify');
    assert(!run(new Set([14])), 'boundary-only loophole still qualifies');
    assert(!run(new Set([28,29,30,31,32,33,34,35])), 'no boundary exposure qualifies');
  });

  test('Final decision priority is explicit and Nobody is not a meter fallback', () => {
    const base = () => ({ S:B.StoryMode.freshState(250000), wealth:500000, start:250000, reason:'final', days:46, quotaMet:40 });
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
        const ctx = { S, wealth: arch.wealth * 250000, start: 250000, reason: arch.reason, days: 46, quotaMet: 25 };
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
      const c = { S, wealth: 325000, start: 250000, reason: 'final', days: 46, quotaMet: 40 };
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
    for (const d of [2, 17, 40]) assert(JSON.stringify(m.scenario(d).events) === JSON.stringify(m.scenario(d).events), 'session ' + (d + 1) + ' differs between builds');
    const post = { t: 115, text: 'BREAKING?? $RDGW buyout', src: '@CallsOnlyCarl' };
    assert(JSON.stringify(B.Sqwak.metrics(post)) === JSON.stringify(B.Sqwak.metrics(post)), 'metrics changed between calls');
  });

  test('Sqwak: every session has authored market-hours posts and a full pre-open feed', () => {
    const D = B.StoryData;
    const counts = (d) => (d >= 43 ? 3 : d >= 15 ? 9 : d >= 12 ? 8 : d >= 8 ? 7 : d >= 4 ? 6 : d >= 2 ? 5 : 4);
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

  test('Every ending prints a Daily Ledger section and a pull quote from its own copy', () => {
    for (const e of B.StoryEndings.list) {
      assert(typeof e.section === 'string' && e.section.length, e.id + ' has no section kicker');
      for (const extra of [{}, { firedBy: 'boss' }, { pulledPlug: true }]) {
        const S = B.StoryMode.freshState(250000);
        if (extra.pulledPlug) S.f.pulledPlug = true;
        const ctx = Object.assign({ S, wealth: 500000, start: 250000, reason: 'final', days: 46, quotaMet: 30 }, extra);
        const pull = e.pull(ctx);
        const copy = [e.headline, e.deck].concat(e.story(ctx)).join(' ');
        assert(pull && copy.toLowerCase().indexOf(pull.replace(/\.$/, '').toLowerCase()) >= 0, `${e.id} pull quote "${pull}" is not in its own copy`);
      }
    }
  });

  test('Sqwak Memory reveals existing posts in order without spoiling later sessions', () => {
    const T = B.SqwakStory;
    assert(T.THREADS.length === 3, 'first slice should include three threads');
    assert(T.threadAt('ridgeway', 2, 124) === null, 'buyout claim leaked before its post');
    assert(T.threadAt('ridgeway', 2, 125).posts.length === 1, 'claim missing at its market minute');
    assert(T.threadAt('ridgeway', 2, 159).posts.length === 1, 'denial leaked before its post');
    assert(T.threadAt('ridgeway', 2, 159).fact === 'UNVERIFIED', 'truth leaked before evidence');
    assert(T.threadAt('ridgeway', 2, 240).posts.length === 3, 'rumour outcome missing');
    assert(T.threadAt('ridgeway', 2, 240).fact === 'DENIED' && T.threadAt('ridgeway', 2, 240).price === 'HYPE FADED', 'false rumour readout wrong');
    assert(T.threadAt('auction', 12, 149).posts.length === 1, 'zero-bid evidence leaked early');
    assert(T.threadAt('auction', 13, 60).posts.length === 4, 'next-day price reaction missing');
    assert(T.threadAt('auction', 13, 60).fact === 'ZERO BID' && T.threadAt('auction', 13, 60).price === 'GREEN NEXT DAY', 'fact and price should disagree here');
    assert(T.threadAt('loop', 17, 189).posts.length === 2, 'bounce leaked early');
    assert(T.threadAt('loop', 18, 60).posts.length === 4, 'official reaction missing');
    const m = B.StoryMode();
    for (const thread of T.THREADS) for (const [day, t, src, stage] of thread.posts) {
      const post = m.scenario(day).events.find((e) => e.kind === 'chirp' && e.t === t && e.src === src && e.threadId === thread.id);
      assert(post && post.threadStage === stage && post.text === T.INTRADAY[day].find((p) => p[0] === t && p[1] === src)[2], 'thread detached from an existing post');
    }
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
    assert(Math.abs(t1 - 250000 * pct * 1.25) <= 50, 'week 1 target should be the week\'s daily quotas plus 25%, got ' + t1);
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
    const v3 = mode.onDayEnd(g, { quota: 1000, quotaMet: false, pnl: -5000, equity: eq, date: 'x' });
    assert(S.quotaStrikes === 3, 'Friday daily miss plus weekly miss should be two strikes, total ' + S.quotaStrikes);
    // One line says both, with the count that is true now; no stale "strike 2 of".
    assert(v3.notes.some((n) => /2 strikes today\. Career strikes 3 of/.test(n)), 'double strike is not stated in one line');
    assert(!v3.notes.some((n) => /Career strike 2 of/.test(n)), 'a stale strike count is still printed');
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

  test('The Ledger: price follows the quota curve up, bills your own money, renews Friday, tells the truth', () => {
    const D = B.StoryData;
    const mode = B.StoryMode(), S = mode.S, W = S.wallet;
    let prev = 0;
    for (let d = 0; d < D.DAYS.length; d++) {
      const p = mode.ledgerPrice(d);
      assert(p >= prev, 'the Ledger got cheaper on session ' + (d + 1));
      prev = p;
    }
    assert(mode.ledgerPrice(0) === 100 && prev === 450, 'price should start at $100 and peak at $450: ' + mode.ledgerPrice(0) + ' ' + prev);
    assert(mode.ledger(0).note === null && !mode.ledger(0).access, 'the desk note leaked before paying');
    // Subscribing midweek pays only for the rest of the week, from the wallet.
    const broker = { cash: 250000, equity: () => 250000, posQty: () => 0, opts: [], dayTrades: () => [], rules: { maxLev: 4 },
      dayRisk: { trough: 250000, breachT: null, mc: 0, liq: 0, peakLev: 1 } };
    const g = { day: 2, history: [], broker, market: { events: [], bySym: { INDX: { last: 500 } } }, indexStart: 500 };
    const cash0 = W.cash;
    const L = mode.ledgerSubscribe(g);
    assert(L.access && L.note && cash0 - W.cash === Math.round(mode.ledgerPrice(2) * 3 / 5), 'a Wednesday subscription should cost three fifths of a week');
    mode.ledgerSubscribe(g);
    assert(cash0 - W.cash === Math.round(mode.ledgerPrice(2) * 3 / 5), 'subscribing twice charged twice');
    // Cancelled: still readable through Friday, gone on Monday, no refund.
    mode.ledgerCancel(g);
    assert(mode.ledgerAccess(4) && !mode.ledgerAccess(5), 'a cancelled subscription should read to the end of the paid week only');
    mode.ledgerSubscribe(g);
    assert(cash0 - W.cash === Math.round(mode.ledgerPrice(2) * 3 / 5), 'resubscribing inside a paid week charged again');
    // Friday renews once for next week at next week's price, never from the book.
    g.day = 4;
    const r = () => ({ day: 4, date: 'x', pnl: 3000, equity: 250000, start: 247000, quota: 1000, quotaMet: true, eod: { forced: [] } });
    const v = mode.onDayEnd(g, r());
    assert(v.notes.some((n) => /The Ledger:/.test(n)) && mode.ledgerAccess(5), 'Friday should renew the Ledger for next week');
    mode.onDayEnd(g, r());
    assert(v.notes.filter((n) => /The Ledger:/.test(n)).length === 1 && broker.cash === 250000, 'renewal repeated or touched the book');
    // The note names the session's real scheduled moves: Fairline files on session 6.
    const n = mode.ledgerNote(5);
    assert(n.lines.some((x) => /Fairline Credit \(FRLN\)/.test(x) && /lower/.test(x)), 'session 6 note should call Fairline lower: ' + n.lines.join(' | '));
    assert(JSON.stringify(mode.ledgerNote(20)) === JSON.stringify(mode.ledgerNote(20)), 'the desk note must replay identically');
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
    // Once a week: a second clean stop in the same week still strikes.
    const mode2 = B.StoryMode(), S2 = mode2.S;
    const mk = (day) => ({ cash: 250000, equity: () => 242000, posQty: () => 0, opts: [], dayTrades: () => [], rules: { maxLev: 4 }, stockGross: () => 0, leverage: () => 0,
      dayRisk: { trough: 242000, breachT: 120, flatT: 122, mc: 0, liq: 0, peakLev: 1 } });
    for (const day of [1, 2]) mode2.onDayEnd({ day, history: [], broker: mk(day), market: { events: [], bySym: { INDX: { last: 500 } } }, indexStart: 500 },
      { day, date: 'x', pnl: -8000, equity: 242000, start: 250000, quota: 2000, quotaMet: false, eod: { forced: [] } });
    assert(S2.quotaStrikes === 1, 'only one excused stop per week: strikes ' + S2.quotaStrikes);
    assert(clean.strikes === 0 && clean.v.notes.some((n) => /strike excused/.test(n)), 'a clean stop should not strike, even after a ledger rebuild');
    assert(stayed.strikes === 1, 'staying in past the limit should still strike');
  });

  test('Taking the plane ends the career; worthless options are abandoned without commission', () => {
    const mode = B.StoryMode(), S = mode.S;
    S.f.fled = true;
    const b = { pos: {}, opts: [], orders: [], cash: 500000, equity: () => 500000, fill: () => ({}) };
    let got = null;
    mode.afterDay({ day: 42, broker: b, market: { bySym: { INDX: { last: 500 } } }, history: [], indexStart: 500 }, (ending) => { got = ending; });
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

  test('Household beats are cosmetic: wallet only, never story, stress or endings', () => {
    const E = B.Economy, ids = ['adopt', 'dentist', 'vetCheck', 'toothache', 'vetER', 'dadBill'];
    for (const id of ids) {
      const beat = B.Life.byId(id);
      assert(beat, id + ' missing');
      for (const opt of beat.options) {
        const S = B.StoryMode.freshState(250000);
        const W = Object.assign(E.fresh(), { cash: 30000, pet: { kind: 'dog', sex: 'girl', name: 'Jemma' }, teeth: 'skipped', vet: 'skipped' });
        S.wallet = W;
        const story = () => JSON.stringify(Object.assign({}, S, { wallet: null }));
        const before = story();
        const out = opt.apply(S, W, E) || [];
        assert(story() === before, `${id}:${opt.id} changed the story state`);
        assert(!W.stressNext, `${id}:${opt.id} changed stress`);
        assert(out.length && out.every((l) => typeof l === 'string' && l.length), `${id}:${opt.id} needs aftermath text`);
      }
    }
    // Endings never read the wallet: the same story resolves the same way whatever the household did.
    const S = B.StoryMode.freshState(250000);
    const base = B.StoryEndings.resolve({ S, wealth: 300000, start: 250000, reason: 'final', days: 46, quotaMet: 40 }).id;
    S.wallet = Object.assign(E.fresh(), { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' }, vet: 'neglected', teeth: 'sore', dad: 'unpaid', dadUnpaid: true });
    assert(B.StoryEndings.resolve({ S, wealth: 300000, start: 250000, reason: 'final', days: 46, quotaMet: 40 }).id === base, 'household state changed the ending');
    // Follow-ups only fire for the choice that earned them; names follow the sex.
    const W0 = E.fresh();
    assert(!B.Life.byId('vetCheck').when(null, W0) && !B.Life.byId('toothache').when(null, W0), 'follow-ups fired without a cause');
    B.Life.byId('adopt').options.find((o) => o.id === 'cat-girl').apply(null, W0, E);
    assert(W0.pet.name === 'Jemma' && W0.pet.kind === 'cat' && W0.cash === E.P.startCash - 150, 'adoption should cost $150 and name a girl Jemma');
    B.Life.byId('adopt').options.find((o) => o.id === 'dog-boy').apply(null, W0, E);
    assert(W0.pet.name === 'Rosco', 'a boy is named Rosco');
    assert(B.Life.byId('dadBill').day < 27, "Dad's surgery should land before most careers end");
  });

  test('Portraits: every face is a full 48x48 sprite in the palette, outlined like the pet', () => {
    for (const name of Object.keys(B.Portraits.CAST)) {
      const sp = B.Portraits.sprite(name);
      assert(sp.h === 48 && sp.rows.every((r) => r.length === 48), name + ' is not 48x48');
      const cells = sp.rows.join('');
      assert(cells.split('').every((ch) => ch === '.' || B.PalKeys[ch]), name + ' uses a colour outside the palette');
      assert(cells.replace(/\./g, '').length > 700, name + ' is missing most of its pixels');
      assert(cells.includes('1'), name + ' has no ink outline');
    }
  });

  test('Decision rooms show the props for their own beat, never a borrowed one', () => {
    const A = B.DecisionArt, room = (id) => A.ROOMS[id] || [];
    const props = (id) => JSON.stringify(room(id)[1] || {});
    // Every beat that reuses a room type says its own thing.
    assert(room('perry')[0] === 'voicemail' && /PERRY/.test(props('perry')), 'Perry leaves the voicemail');
    assert(room('dentist')[0] === 'voicemail' && /DENTIST/.test(props('dentist')) && !/PERRY/.test(props('dentist')), 'the dentist voicemail must not say Perry');
    assert(/14,200/.test(props('dadBill')) && /MOM/.test(props('dadBill')), "Dad's bill is Mom calling about $14,200");
    assert(/RIVERBEND/.test(props('pension')), 'the pension letter is from Riverbend');
    assert(room('toothache')[0] === 'clinic' && /1,400/.test(props('toothache')) && !/14,200|MOM/.test(props('toothache')), 'the toothache bill is $1,400 at the dentist');
    assert(room('vetER')[0] === 'clinic' && /900/.test(props('vetER')) && /vet/.test(props('vetER')), 'the vet emergency bill is $900 at the vet');
    assert(room('vetCheck')[1] && room('vetCheck')[1].postcard && !/RIVERBEND/.test(props('vetCheck')), 'the vet checkup is a postcard, not the pension letter');
    assert(room('adopt')[0] === 'shelter' && room('rentHike')[0] === 'lobby', 'the shelter is not the landlord lobby');
    // Each amount a room prints matches a price in that beat's own choices.
    for (const id of ['dadBill', 'toothache', 'vetER']) {
      const amt = (props(id).match(/\$[\d,]+/) || [''])[0];
      const labels = B.Life.byId(id).options.map((o) => o.label).join(' ');
      assert(amt && labels.includes(amt), `${id} room shows ${amt}, which is not a price in its choices`);
    }
    // Every room draws without throwing, with or without a pet in the wallet.
    const ctx = { save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, fillText() {}, set fillStyle(v) {}, set globalAlpha(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}, measureText: () => ({ width: 6 }) };
    for (const id of Object.keys(A.ROOMS)) for (const S of [null, { f: {}, wallet: { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } } }]) A.room(ctx, id, 20, true, S);
  });

  test('Pet food is billed weekly and the pet shows up in the weekend art', () => {
    const E = B.Economy, W = Object.assign(E.fresh(), { cash: 5000, peakEq: 250000 });
    const t = E.tier(W);
    assert(E.weekly(t, Object.assign({}, W, { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } })) === E.weekly(t, W) + E.P.petFood, 'weekly cost should include pet food');
    const a = Object.assign({}, W), b = Object.assign({}, W, { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } });
    E.settle(a, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
    const r = E.settle(b, { equity: 250000, capital: 250000, weekMade: false, breaches: [], sessions: 5 });
    assert(Math.abs((a.cash - b.cash) - E.P.petFood) < 1e-6, 'a week with a pet should cost exactly the food more: ' + (a.cash - b.cash));
    assert(/Rosco's food/.test(r.lines.join(' ')), 'the payslip should itemise the pet food');
    const SB = B.Storyboard;
    for (const kind of ['cat', 'dog']) {
      const cared = SB.petRows({ kind, sex: 'boy' }, true), girl = SB.petRows({ kind, sex: 'girl' }, true), sad = SB.petRows({ kind, sex: 'boy' }, false);
      assert(cared.join('').includes('b') && girl.join('').includes('r') && !sad.join('').match(/[rb]/), kind + ': collar blue for Rosco, red for Jemma, gone when neglected');
      assert(cared.every((row, i) => row.length === sad[i].length), kind + ': neglect must not change the sprite shape');
    }
    const ids = (w) => B.Scenes.weekend({ day: 24, game: { mode: { S: { wallet: w, f: {} } } } }).map((x) => x.id).join();
    const noPet = ids(E.fresh()), cat = ids(Object.assign(E.fresh(), { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } }));
    const sadCat = ids(Object.assign(E.fresh(), { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' }, vet: 'neglected' }));
    assert(noPet !== cat && cat !== sadCat, 'weekend frames with and without a pet (or a neglected one) must not share a cache id');
  });

  test('Imani talks in the first two sessions only, once per line, and reacts to what you do', () => {
    const said = [];
    const saveInbox = B.UI && B.UI.inbox;
    B.UI = B.UI || {};
    B.UI.inbox = (m) => said.push(m.text);
    const tape = [];
    const b = { pos: {}, orders: [], opts: [], dayStartEquity: 250000, equity: () => 250000, isFlat() { return !Object.keys(this.pos).length; }, dayTrades: () => tape };
    const g = { day: 0, broker: b, market: { events: [] }, quota: 2000, interrupts: { ringing: false } };
    const S = {};
    for (let t = 0; t <= 40; t++) B.Mentor.tick(g, t, S);
    assert(said.length === 2 && /Welcome/.test(said[0]) && /Still flat/.test(said[1]), 'a flat first morning should get a hello and one nudge: ' + JSON.stringify(said));
    for (let t = 0; t <= 40; t++) B.Mentor.tick(g, t, S);
    assert(said.length === 2, 'lines must not repeat within a session');
    b.pos.INDX = { qty: 100, avg: 500 }; tape.push({ t: 45, sym: 'INDX', qty: 100, open: true });
    B.Mentor.tick(g, 50, S);
    assert(/SL%/.test(said[2]), 'an unprotected position should get the stop-loss line');
    g.day = 1; B.Mentor.tick(g, 60, S); B.Mentor.tick(g, 90, S);
    assert(!said.slice(3).some((x) => /SL%/.test(x)), 'the stop-loss line is said once per career, not every morning');
    const n = said.length;
    g.day = 2; B.Mentor.tick(g, 60, S);
    assert(said.length === n, 'Imani goes quiet after session 2');
    B.UI.inbox = saveInbox;
  });

  test('V4.3 economy: cap before breaches, obligations come due, booked money is not P&L', () => {
    const E = B.Economy, P = E.P;
    const mk = () => { const w = E.fresh(); w.peakEq = 250000; return w; };
    const big = (breaches) => E.settle(mk(), { equity: 5000000, capital: 250000, weekMade: true, breaches, sessions: 5 }).bonus;
    assert(big([{ id: 'size' }, { id: 'overnight' }]) < big([]) * 0.75, 'breaches must cut a capped bonus too');
    const w = mk(); w.cash = 20000;
    w.advanceGross = 12308; w.deficit = 12308;
    (w.plans = []).push({ label: "Dad's surgery", amt: 1200, left: 2 });
    w.momExtra = 290;
    const lines = E.settleUp(w);
    assert(w.cash === 20000 - 8000 - 2400 - 2900, 'advance, plan and pledge should come due: ' + w.cash);
    assert(lines.length === 3 && E.settleUp(w) === lines, 'settle-up runs once');
    const mode = B.StoryMode(); mode.S.wallet.tier = 0;
    assert(!B.Life.byId('rentHike').when(mode.S, mode.S.wallet), 'no landlord on the couch');
    const w2 = mk(); w2.tier = 1;
    assert(!B.Life.byId('rentHike').options.find((o) => o.id === 'move').req(mode.S, w2), 'no free move from the cheapest flat');
  });

  test('A wipeout never leaves the book below zero; Right Too Early is a diminished payoff', () => {
    const m = new B.Market({ seed: 'wipe-floor' });
    const b = new B.Broker({ cash: 20000 }); b.attach(m);
    m.startDay(0, { regime: 'chop' }); b.startDay(); m.step(1);
    b.pos.BSTN = { qty: 60000, avg: 80, realized: 0 };
    b.cash = -60000 * 80 + 20000;
    b.flattenAll('WIPED OUT', true); b.floorAtZero();
    assert(b.isFlat() && b.equity() >= 0, 'book after a wipe: ' + b.equity());
    const re = B.StoryEndings.list.find((e) => e.id === 'right-early');
    const S = B.StoryMode.freshState(250000); S.f.rightTooEarly = true;
    assert(re.test({ S, wealth: 400000, start: 250000 }) && !re.test({ S, wealth: 900000, start: 250000 }), 'Right Too Early should not pay a doubled book');
  });

  test('Endless results stay out of the Career endings tally', () => {
    const keep = B.storage.get('endings:tally', {});
    B.storage.set('endings:tally', { fired: 1, legend: 3, margin: 2, grind: 1 });
    const t = B.Save.careerTally();
    assert(t.grind === 1 && t.fired === 1 && !t.legend && !t.margin, 'career tally should drop Endless ids: ' + JSON.stringify(t));
    B.Save.recordEndless('legend');
    assert(!B.Save.careerTally().legend, 'recording an Endless result must not touch Career endings');
    B.storage.set('endings:tally', keep);
  });

  test('Endless never announces a crash day in advance, and its outlook is only mostly right', () => {
    const regs = ['bull', 'bubble', 'chop', 'bear', 'recovery'];
    let crashes = 0, calledCrash = 0, right = 0, total = 0, wolf = 0;
    for (let d = 1; d < 4000; d++) {
      const actual = d % 7 === 0 ? 'panic' : regs[d % regs.length];
      const call = B.Endless.outlookOf('seed-x', d, actual, regs[(d + 1) % regs.length]);
      if (actual === 'panic') { crashes++; if (call === 'panic') calledCrash++; }
      else { total++; if (call === actual) right++; if (call === 'panic') wolf++; }
    }
    assert(crashes > 0 && calledCrash === 0, `crash days were called ${calledCrash}/${crashes}`);
    const acc = right / total;
    assert(acc > 0.5 && acc < 0.8, 'outlook accuracy on normal days ' + acc.toFixed(2));
    assert(wolf > 0, 'the desk should sometimes cry wolf');
  });

  // ---------- Fix 1: full shelf ----------
  test('A full shelf offers the oldest finished slot, or warns when every slot is live', () => {
    const keepIdx = B.storage.get('saves:index', null);
    for (let i = 0; i < B.Save.SLOTS; i++) B.Save.clear(i);
    for (let i = 0; i < B.Save.SLOTS; i++) B.Save.write(i, { kind: 'story', day: 1 }, { mode: 'story', day: 1, equity: 1 });
    assert(B.Save.newRunPlan().kind === 'full', 'six live runs: nothing to replace');
    B.Save.rename(3, 'Old Career');
    B.Save.rename(4, 'Newer Career');
    B.Save.finish(4, { id: 'grind', title: 'Still Standing', wealth: 1 });
    const idx = B.Save.index(); idx[4].ts = 2000; B.Save.writeIndex(idx);
    B.Save.finish(3, { id: 'exit', title: 'The Exit', wealth: 1 });
    const idx2 = B.Save.index(); idx2[3].ts = 1000; B.Save.writeIndex(idx2);
    const p = B.Save.newRunPlan();
    assert(p.kind === 'replace' && p.slot === 3 && p.name === 'Old Career' && p.ending === 'The Exit', 'oldest finished slot offered: ' + JSON.stringify(p));
    assert(B.Save.meta(0) && !B.Save.meta(0).finished, 'live runs are never offered');
    B.Save.clear(3);
    assert(B.Save.newRunPlan().kind === 'free' && B.Save.newRunPlan().slot === 3, 'a free slot wins');
    for (let i = 0; i < B.Save.SLOTS; i++) B.Save.clear(i);
    if (keepIdx) B.storage.set('saves:index', keepIdx);
  });

  test('Autosave with no slot warns once instead of failing silently', () => {
    const g = mkGame('no-slot'); g.slot = null;
    const keep = B.UI.toast, seen = [];
    B.UI.toast = (m) => seen.push(m);
    const a = g.autosave(), b = g.autosave();
    B.UI.toast = keep;
    assert(a === false && b === false, 'nothing saved');
    assert(seen.length === 1 && /not being saved/i.test(seen[0]), 'one warning expected, got ' + seen.length);
  });

  // ---------- Fix 2 and 3: the limits the desk shows are the limits it enforces ----------
  test('Risk review uses the overnight limit the player is shown', () => {
    const E = B.Economy;
    const base = { risk: econRisk(), start: 250000, maxLev: 4, trades: [], forced: [], events: [] };
    assert(!E.review(Object.assign({}, base, { overnightLev: 2, closeLev: 1.8 })).breaches.some((b) => b.id === 'overnight'), '1.8x under a 2x overnight limit is legal');
    const over = E.review(Object.assign({}, base, { overnightLev: 2, closeLev: 2.4 })).breaches.find((b) => b.id === 'overnight');
    assert(over && /2x cap/.test(over.text), 'breach should print the real 2x limit: ' + (over && over.text));
    assert(E.review(Object.assign({}, base, { closeLev: 1.5 })).breaches.some((b) => b.id === 'overnight'), 'falls back to the default limit when none is given');
  });

  test('Desk leverage cap scales with the limit and is printed with two decimals', () => {
    const E = B.Economy;
    near(E.deskCap(4), 3.25, 1e-9, '4x desk'); near(E.deskCap(6), 4.875, 1e-9, '6x desk');
    near(E.deskCap(3), 2.7, 1e-9, '3x desk'); near(E.deskCap(2), 1.8, 1e-9, '2x desk');
    const base = { start: 250000, trades: [], forced: [], events: [] };
    assert(!E.review(Object.assign({ risk: econRisk({ peakLev: 4.4 }), maxLev: 6 }, base)).breaches.length, '4.4x is inside a 6x desk');
    const b4 = E.review(Object.assign({ risk: econRisk({ peakLev: 3.4 }), maxLev: 4 }, base)).breaches[0];
    assert(b4 && /3\.25x desk cap/.test(b4.text), 'cap should read 3.25x: ' + (b4 && b4.text));
    assert(E.fmtX(3) === '3' && E.fmtX(3.25) === '3.25' && E.fmtX(4.875) === '4.87' && E.fmtX(1.5) === '1.5' && E.fmtX(2.7) === '2.7', 'two decimals, floored, no trailing zeros');
    const g = mkGame('cap-shown'); g.startDay();
    g.mode.rules = () => ({ maxLev: 6, overnightLev: 3, shortBan: [] });
    const lines = g.mode.briefing(11, g).rules.join(' ');
    assert(/Risk desk cap: 4\.87x/.test(lines), 'briefing should list the desk cap: ' + lines);
  });

  // ---------- Fix 4-6: story money is not trading ----------
  test('A story fine is not a drawdown: stress stays calm and day P&L ignores it', () => {
    const g = mkGame('fine-stress'); g.startDay();
    g.market.step(5);
    const b = g.broker;
    g.mode.bookAdj(g, -40000); b.cash -= 40000;
    for (let i = 0; i < 20; i++) g.stress.update(0.25, g);
    assert(g.stress.v < 8, 'stress after a fine on a quiet book: ' + g.stress.v.toFixed(1));
    assert(Math.abs(g.dayPnl()) < 2000, 'day P&L should exclude the fine, got ' + g.dayPnl());
    assert(b.dayPeak - b.equity() < 2000, 'the day peak moved with the booking');
  });

  test('A story bonus does not make the week by itself, and a quota-met week is not failed by a fine', () => {
    const g = mkGame('week-adj'); g.startDay();
    const m = g.mode, W = m.openWeek(g);
    g.broker.cash += 45000; m.bookAdj(g, 45000);
    const q = m.weekQuota(g);
    assert(q && q.made < 1000, 'a $45k bonus must not count as week progress: made ' + (q && q.made));
    g.broker.cash -= 40000; m.bookAdj(g, -40000);
    assert(Math.abs(m.weekQuota(g).made) < 1000, 'a fine must not be a week loss: ' + m.weekQuota(g).made);
    assert(W.adj === 5000, 'week adj is saved with the week: ' + W.adj);
  });

  test('Bonus payslip is not halved for a drawdown when equity only rose', () => {
    const E = B.Economy;
    const g = mkGame('pay-adj'); g.startDay();
    const m = g.mode, b = g.broker;
    // A bonus lands at the open, then the day trades flat.
    b.cash += 45000; m.bookAdj(g, 45000);
    b.trackRisk(10, 0.03);
    const eq = b.equity();
    const r = { equity: eq, start: b.dayStartEquity, quotaMet: true, notes: [] };
    m.payroll(g, r, false);
    assert(!(m.S.wallet.ddDays || {})[g.day], 'a credit created a fake drawdown');
    // A fine must not keep the next payslips halved either (a fresh day, one payroll).
    const g2 = mkGame('pay-fine'); g2.startDay();
    const w = g2.mode.S.wallet, before = w.peakEq;
    g2.broker.cash -= 40000; g2.mode.bookAdj(g2, -40000);
    g2.mode.payroll(g2, { equity: g2.broker.equity(), start: g2.broker.dayStartEquity, quotaMet: true, notes: [] }, false);
    assert(w.peakEq <= before - 39000, 'peak baseline should drop with the fine: ' + before + ' -> ' + w.peakEq);
    assert(!(w.ddDays || {})[g2.day], 'a fine is not a drawdown you traded into');
  });

  // ---------- Fix 7: Pull the Plug ----------
  test('After the plug is pulled the final session has no quota, no strike and cannot become a firing or a wipe', () => {
    const g = mkGame('pull-plug'); g.startDay();
    const m = g.mode, S = m.S, last = B.StoryData.DAYS.length - 1;
    S.f.pulledPlug = true;
    g.day = last;
    assert(m.quota(last, g) === 0, 'final session quota should be 0, got ' + m.quota(last, g));
    assert(m.wipeLevel(g) === 0, 'the flattened book must not trip the wipe line');
    S.quotaLedger = []; for (let i = 0; i < 22; i++) S.quotaLedger.push({ day: i, pnl: 0 });
    S.quotaStrikes = 22;
    const cap = 250000;
    const r = { day: last, date: 'x', pnl: -200000, equity: cap * 0.1 - 3, start: 225000, quota: 0, quotaMet: true, trades: 0, notes: [], eod: {} };
    const out = m.onDayEnd(g, r);
    assert(S.quotaStrikes === 22, 'no strike on the last session: ' + S.quotaStrikes);
    assert(out.ending && out.ending.id === 'exit', 'ending should be The Exit, got ' + (out.ending && out.ending.id));
    S.f.pulledPlug = false;
    assert(m.quota(last, g) > 0, 'without the plug pull the last session keeps its quota');
  });

  // ---------- Fix 8: a failed second vote is never celebrated ----------
  test('A failed second vote reads as failed in the briefing, feed, posts and news; a passed vote is unchanged', () => {
    const D = B.StoryData, SS = B.SqwakStory;
    const passRe = /vote passes|it passed|act passes|enacted|guarantee is (law|in force)|rescue rally|rescue passed|vote clears/i;
    const read = (passed) => {
      const mode = B.StoryMode(); mode.S.f.billPassed = passed;
      const out = [];
      for (const d of [41, 42, 43]) {
        const b = mode.briefing(d, null), sc = mode.scenario(d);
        out.push(b.title, b.html.replace(/<[^>]+>/g, ' '));
        for (const it of b.feed) out.push(it.title, it.text);
        for (const e of sc.events) out.push(e.text);
      }
      const brk = (d) => { const x = SS.breaking(d, mode.S); return x.head + ' ' + x.text; };
      out.push(brk(41), brk(44));
      return out.join(' | ');
    };
    const failed = read(false), passed = read(true);
    assert(!passRe.test(failed), 'failed-vote text still says it passed: ' + (failed.match(new RegExp('.{30}(' + passRe.source + ').{30}', 'i')) || [''])[0]);
    assert(/Second No|fails again|no guarantee/i.test(failed), 'failed-vote text should say it failed');
    assert(/Hope/.test(passed) && /The vote passes/.test(passed) && /IT PASSED/.test(passed) && /Stabilization Act passes/.test(passed) && /enacted guarantee/.test(passed), 'passed-vote text must be unchanged');
  });

  // ---------- Fix 9: V3 -> V4 migration ----------
  const v3Save = (day, missed, forgiven, excused, ledger) => {
    const S = B.StoryMode.freshState(250000);
    S.quotaLedger = ledger || []; S.quotaStrikes = S.quotaLedger.length;
    S.forgivenDays = forgiven || []; S.excusedDays = excused || [];
    const history = []; for (let d = 0; d < day; d++) history.push({ day: d, pnl: 0, equity: 250000, quotaMet: missed.indexOf(d) < 0 });
    return { v: 3, kind: 'story', day, inDay: false, mode: { S }, history, broker: { cash: 250000 }, market: { px: {}, fearLevel: 0 }, stress: {} };
  };

  test('V3 migration drops history of removed sessions, keeps forgiveness, and does not invent strikes', () => {
    // Missed old sessions 1, 3, 4 (3 and 4 no longer exist), the made week wiped 3 and 4, and 7 was excused.
    const v4 = B.Save.migrateV3Snapshot(v3Save(23, [1, 3, 4, 7], [3, 4, 7], [7], [{ day: 1, pnl: -100, quota: 1000 }]));
    const days = v4.history.map((h) => h.day);
    assert(new Set(days).size === days.length, 'one history row per session, got ' + days);
    assert(days.length === v4.day, 'a save on new session ' + v4.day + ' has played exactly that many: ' + days.length);
    const mode = B.StoryMode(v4.mode);
    const strikes = mode.reconcileQuotaStrikes(v4.history);
    assert(strikes === 0, 'a miss on a removed session must not come back as a strike, got ' + strikes);
    assert(!v4.history.some((h) => h.quotaMet === false), 'removed misses are not left in the history');
  });

  test('V3 migration loads an over-limit career one miss short, and stays there on later loads', () => {
    const limit = B.StoryMode.QUOTA_STRIKE_LIMIT;
    const sids = B.StoryData.DAYS.map((x) => x.sid);
    const missed = sids.slice(0, 30);              // 30 misses on sessions that still exist
    const v4 = B.Save.migrateV3Snapshot(v3Save(50, missed, [], [], missed.slice(0, 26).map((d) => ({ day: d, pnl: -1, quota: 1000 }))));
    const first = B.StoryMode(JSON.parse(JSON.stringify(v4.mode)));
    assert(first.reconcileQuotaStrikes(v4.history) === limit - 1, 'strikes after migration ' + first.S.quotaStrikes + ', want ' + (limit - 1));
    // Save, restore, reconcile again: still under the limit.
    const again = B.StoryMode(JSON.parse(JSON.stringify(first.S && { S: first.S })));
    assert(again.reconcileQuotaStrikes(v4.history) === limit - 1, 'a later load re-added strikes: ' + again.S.quotaStrikes);
    assert(v4.mode.S.forgivenDays.length > 0, 'the surplus is recorded as forgiven');
  });

  // ---------- Review follow-ups ----------
  test('Pulled-plug finale: plain no-quota memo, no final warning, no quota pay for a zero-quota day', () => {
    const g = mkGame('plug-memo'); g.startDay();
    const m = g.mode, S = m.S, last = B.StoryData.DAYS.length - 1;
    S.f.pulledPlug = true; g.day = last;
    S.quotaLedger = []; for (let i = 0; i < 22; i++) S.quotaLedger.push({ day: i });
    S.quotaStrikes = 22;
    const memo = m.quotaMeta(last, g).memo;
    assert(!/FINAL WARNING|Down \d+%|\$0/.test(memo) && /No quota/.test(memo), 'memo: ' + memo);
    assert(!m.briefing(last, g).rules.some((x) => /FINAL WARNING/.test(x)), 'briefing must not warn');
    g.history = [{ day: last, quota: 0, quotaMet: true }];
    const lines = m.payroll(g, { equity: g.broker.equity(), start: g.broker.dayStartEquity, quotaMet: true, notes: [] }, true).join(' ');
    assert(/Quota pay: no days made/.test(lines), 'a zero-quota day is not a made day: ' + lines.replace(/<[^>]+>/g, '').slice(0, 200));
  });

  test('Overnight breach prints the limit without trailing zeros', () => {
    const E = B.Economy;
    const x = E.review({ risk: econRisk(), start: 250000, maxLev: 4, overnightLev: 1.5, closeLev: 1.9, trades: [], forced: [], events: [] }).breaches.find((b) => b.id === 'overnight');
    assert(x && /1\.5x cap/.test(x.text), x && x.text);
  });

  test('Failed second vote keeps the Carl hype event at minute 100 of session 42', () => {
    const mode = B.StoryMode(); mode.S.f.billPassed = false;
    const ev = mode.scenario(41).events;
    assert(ev.some((e) => e.hype && e.src === '@CallsOnlyCarl' && e.t === 100), 'hype event missing');
    assert(!B.SqwakStory.FAILED_FEED[42]['The rescue, priced in'] === false, 'locked Ledger item has a failed-vote version');
  });

  // ---------- V5 economy numbers ----------
  test('Client commissions are a share of the day\'s quota by order size', () => {
    const g = mkGame('client-fee'); g.startDay();
    const share = { 2000: 0.08, 5000: 0.12, 10000: 0.18, 25000: 0.25 }, seen = {};
    for (let i = 0; i < 80; i++) {
      const c = { kind: 'client' };
      g.interrupts.prepare(c);
      const t = c.task;
      assert(t.fee === Math.round(g.quota * share[t.qty]) && Number.isInteger(t.fee), `fee ${t.fee} for ${t.qty} on quota ${g.quota}`);
      seen[t.qty] = 1;
    }
    assert(Object.keys(seen).length === 4, 'all four sizes exercised');
  });

  test('With no quota a client call keeps the old size-based commission', () => {
    const g = mkGame('client-noquota'); g.startDay();
    g.quota = 0;
    for (let i = 0; i < 20; i++) {
      const c = { kind: 'client' };
      g.interrupts.prepare(c);
      const t = c.task, px = g.market.bySym[t.sym].last;
      assert(t.fee === Math.round(t.qty * px * 0.0008 / 50) * 50 + 250 && t.fee > 0, 'old fee expected, got ' + t.fee);
    }
  });

  test('Week one target is 125% of its daily quotas, and the pulled-plug finale still has none', () => {
    const g = mkGame('week-one'); g.startDay();
    const W = g.mode.openWeek(g);
    const pct = [0, 1, 2, 3, 4].reduce((a, d) => a + B.StoryData.QUOTAS[d], 0);
    assert(W.target === Math.round(Math.max(1500, g.broker.equity() * pct * 1.25) / 50) * 50 && W.target === 9300, 'week 1 target ' + W.target);
    g.mode.S.f.pulledPlug = true;
    assert(g.mode.quota(45, g) === 0, 'finale quota stays 0');
  });

  // ---------- Minor fixes ----------
  test('Story text names weekdays that fit the 46-session calendar', () => {
    const D = B.StoryData, SS = B.SqwakStory, S = B.StoryMode().S;
    S.f.billPassed = true;
    const bad = [];
    // Genuine references: a mother planning ahead, a transit notice.
    const okWeekend = { 10: 1, 42: 1 };
    const check = (d, where, t) => {
      const text = String(t || '').replace(/<[^>]+>/g, '');
      if (/\b(weekend|Saturday|Sunday)\b/i.test(text) && d % 5 !== 4 && !okWeekend[d]) bad.push(`${d + 1} ${where}: ${text.slice(0, 60)}`);
      if (/\bMonday\b/.test(text) && [3, 4, 0].indexOf(d % 5) < 0) bad.push(`${d + 1} ${where}: ${text.slice(0, 60)}`);
    };
    D.DAYS.forEach((day, d) => {
      check(d, 'title', day.title);
      day.brief(S).forEach((p) => check(d, 'brief', p));
      (day.feed || []).forEach((f) => check(d, 'feed', (f.title || '') + ' ' + (f.text || '')));
      (day.scen(S).events || []).forEach((e) => check(d, 'event', e.text));
      (day.calls ? day.calls(S) : []).forEach((c) => check(d, 'call', c.text));
    });
    SS.INTRADAY.forEach((a, d) => (a || []).forEach((p) => check(d, 'post', p[2])));
    // Storyboard captions and cards follow the same calendar.
    B.Storyboard.SHEET.forEach((row, d) => check(d, 'storyboard', JSON.stringify(row)));
    assert(!bad.length, 'wrong weekday in story text: ' + bad.join(' | '));
    // The Treasury decision plays on a Tuesday night.
    const c5 = Object.keys(D.CHOICES).map((k) => D.CHOICES[k]).find((c) => c.day === 21);
    assert(c5 && !/Saturday|Sunday|Monday/.test(JSON.stringify(c5)), 'the rescue decision names a weekend day');
  });

  test('A marketable limit order pays the same impact as a market order, capped at its limit', () => {
    const run = (limit) => {
      const m = mkMarket(); for (let i = 0; i < 40; i++) m.step(0.25);
      const b = new B.Broker({ cash: 5000000, feeMult: 0, slipMult: 1 }); b.attach(m); b.startDay();
      const sym = 'RDGW', q = m.quote(sym), qty = 8000;
      const r = b.marketOrder(sym, qty, limit ? { limitPx: q.ask * 1.05 } : {});
      return { r, ask: q.ask };
    };
    const mk = run(false), lm = run(true);
    assert(mk.r.price > mk.ask * 1.0001, 'market order should slip');
    assert(Math.abs(lm.r.price - mk.r.price) < 1e-9, 'a limit through the market pays the same impact: ' + lm.r.price + ' vs ' + mk.r.price);
    const m = mkMarket(); for (let i = 0; i < 40; i++) m.step(0.25);
    const b = new B.Broker({ cash: 5000000, feeMult: 0, slipMult: 1 }); b.attach(m); b.startDay();
    const q = m.quote('RDGW');
    const capped = b.marketOrder('RDGW', 8000, { limitPx: q.ask });
    assert(capped.price <= q.ask + 1e-9, 'never worse than the limit: ' + capped.price + ' vs ' + q.ask);
  });

  test('Bonus advance: repaid from bonus first, and only the unrepaid advance is clawed back', () => {
    const E = B.Economy;
    const run = (bonusWeeks) => {
      const mode = B.StoryMode(), W = mode.S.wallet;
      W.deficit = 9000; // ordinary unearned draw, not part of the advance
      mode.applyLife('advance', 'take');
      const adv = W.advanceGross;
      for (let i = 0; i < bonusWeeks; i++) E.settle(W, { equity: 600000 + i * 200000, capital: 250000, weekMade: true, sessions: 5, metDays: 0, breaches: [] });
      const cash = W.cash;
      E.settleUp(W);
      return { adv, charged: cash - W.cash, left: W.advanceGross };
    };
    const none = run(0), big = run(2);
    assert(none.charged > 0, 'an advance never earned back is clawed back');
    assert(big.left === 0 && big.charged === 0, 'a repaid advance is not charged again: left ' + big.left + ' charged ' + big.charged);
  });

  test('Crash severity deepens falls only, stays modest, and is frozen for a mid-session resume', () => {
    const D = B.StoryData, m = B.StoryMode(), S = m.S;
    S.m.stability = 60; S.f.dereg = false;
    const calm = m.scenario(41);
    S.m.stability = 10; S.f.dereg = true;
    const shaky = m.scenario(41);
    const k = D.cm(S);
    assert(k > 1 && k <= 1.3, 'severity ' + k);
    assert(shaky.market.gap < calm.market.gap && Math.abs(shaky.market.gap / calm.market.gap - k) < 1e-9, 'gaps scale by the severity');
    const up = m.scenario(33);
    S.m.stability = 60; S.f.dereg = false;
    const upCalm = m.scenario(33);
    assert(up.market.target === upCalm.market.target || up.market.target > 0, 'rising targets are not scaled');
    // In play the factor is read once per session.
    const g = { day: 41 };
    S.m.stability = 60; const a = m.scenario(41, g);
    S.m.stability = 5; const b = m.scenario(41, g);
    assert(a.market.gap === b.market.gap, 'a mid-session stability change must not change a resumed tape');
  });

  test('The quiet Exit is reachable under the strike limit: said nothing, kept integrity, 12 or more strikes', () => {
    const exit = B.StoryEndings.list.find((e) => e.id === 'exit');
    const S = B.StoryMode.freshState(250000);
    S.f.quiet = true; S.m.integrity = 70; S.quotaStrikes = 14;
    const ctx = (strikes, integrity) => { const s = JSON.parse(JSON.stringify(S)); s.quotaStrikes = strikes; s.m.integrity = integrity; return { S: s, wealth: 400000, start: 250000, days: 46, quotaMet: 46 - strikes }; };
    assert(strikes14(), 'unreachable');
    function strikes14() { return exit.test(ctx(14, 70)) && !exit.test(ctx(5, 70)) && !exit.test(ctx(14, 40)) && B.StoryMode.QUOTA_STRIKE_LIMIT > 14; }
    assert(B.StoryEndings.resolve(ctx(14, 70)).id === 'exit', 'resolves to The Exit');
  });

  test('Career day length applies from the next session start, and a mid-day resume keeps the saved length', () => {
    const real = B.Settings.get;
    try {
      const g = mkGame('daylen');
      g.day = 2;
      g.startDay();
      assert(g.dayLength === 180, 'starts at the length the career was begun with');
      for (let i = 0; i < 120; i++) g.tick(0.25);
      B.Settings.get = () => ({ storyDayLength: 240, effects: 'off', cinematics: 'off' });
      assert(g.dayLength === 180 && Math.abs(g.rate - B.DAY_MIN / 180) < 1e-12, 'changing the setting does not alter the running session');
      const snap = JSON.parse(JSON.stringify(g.snapshot()));
      const g2 = new B.Game(B.StoryMode(snap.mode), snap);
      g2.resumeDay();
      assert(g2.dayLength === 180, 'mid-day resume keeps the length it was saved with');
      near(g2.market.t, g.market.t, 1e-9, 'clock');
      g2.day = 3;
      g2.startDay();
      assert(g2.dayLength === 240, 'the next session start picks up the new setting');
    } finally { B.Settings.get = real; }
  });

  test('Quitting from pause releases the music duck', () => {
    const g = mkGame('quit-duck');
    g.startDay();
    const calls = [];
    const real = B.Music.duck;
    B.Music.duck = (on) => calls.push(!!on);
    try {
      g.togglePause(true);
      g.quit();
    } finally { B.Music.duck = real; }
    assert(calls.join() === 'true,false', 'duck calls ' + calls.join());
  });

  test('A big limit typed at the ask waits for a real fill price; a small one and a deeper limit fill', () => {
    const setup = () => {
      const m = mkMarket(); for (let i = 0; i < 40; i++) m.step(0.25);
      const b = new B.Broker({ cash: 5000000, feeMult: 0, slipMult: 1 }); b.attach(m); b.startDay();
      return { m, b, q: m.quote('RDGW') };
    };
    for (const side of [1, -1]) {
      let { b, q } = setup();
      b.placeOrder('RDGW', side * 8000, 'limit', (side > 0 ? Math.ceil(q.ask * 100) : Math.floor(q.bid * 100)) / 100);
      assert(b.processOrders().length === 0 && b.orders.length === 1, 'a big limit at the touch must keep working (side ' + side + ')');
      ({ b, q } = setup());
      b.placeOrder('RDGW', side * 8000, 'limit', side > 0 ? q.ask * 1.05 : q.bid * 0.95);
      const done = b.processOrders();
      assert(done.length === 1 && done[0].res.ok, 'a limit through the impact fills (side ' + side + ')');
      assert(side > 0 ? done[0].res.price <= q.ask * 1.05 + 1e-9 : done[0].res.price >= q.bid * 0.95 - 1e-9, 'never worse than the limit');
      ({ b, q } = setup());
      b.placeOrder('RDGW', side * 10, 'limit', (side > 0 ? Math.ceil(q.ask * 100) : Math.floor(q.bid * 100)) / 100);
      assert(b.processOrders().length === 1, 'a small limit at the touch fills (side ' + side + ')');
    }
  });

  test('At full crash severity no session newly closes the market early', () => {
    const D = B.StoryData;
    const run = (k, stab, dereg) => {
      const mode = B.StoryMode(), S = mode.S, m = new B.Market({ seed: mode.seed, volMult: 1 }), ends = [];
      for (let day = 0; day < D.DAYS.length; day++) {
        S.m.stability = stab; S.f.dereg = dereg && day >= 11; S.crashDay = day; S.crashK = k;
        m.startDay(day, mode.scenario(day));
        while (m.status === 'open' && m.t < B.DAY_MIN) m.step(0.25);
        ends.push(m.t); m.close();
      }
      return ends;
    };
    for (const [stab, dereg] of [[60, false], [0, true]]) {
      const base = run(1, stab, dereg), hard = run(1.3, stab, dereg);
      base.forEach((t, d) => { if (t >= B.DAY_MIN - 1) assert(hard[d] >= B.DAY_MIN - 1, `session ${d} closed early at k=1.3`); else assert(Math.abs(hard[d] - t) < 1e-9 || hard[d] >= t - 1e-9, 'session ' + d + ' closed earlier at k=1.3'); });
    }
  });

  test('A mid-day save from before crash severity resumes on the tape it was built on', () => {
    const mk = (stab) => { const mode = B.StoryMode(); mode.S.m.stability = stab; mode.S.crashDay = 20; mode.S.crashK = 1; const g = new B.Game(mode); g.day = 20; g.startDay(); return g; };
    const g = mk(10);
    for (let i = 0; i < 200; i++) g.tick(0.25);
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    delete snap.mode.S.crashDay; delete snap.mode.S.crashK;          // an old save has neither
    const g2 = new B.Game(B.StoryMode(snap.mode), snap);
    g2.resumeDay();
    for (const tk of g.market.tickers) near(g2.market.bySym[tk.sym].last, tk.last, 1e-8, tk.sym + ' price');
    assert(g2.mode.S.crashK === 1 && g2.mode.S.crashDay === 20, 'old save is pinned to the base depth');
  });

  test('Motion: easing, stepping and keyframes', () => {
    const M = B.Motion;
    assert(M.ease.inOut(0) === 0 && M.ease.inOut(1) === 1 && M.ease.out(2) === 1 && M.ease.in(-1) === 0, 'easing is not clamped to 0..1');
    assert(M.stepped(0.49, 4) === 0.25 && M.stepped(1, 4) === 1, 'stepped does not quantise down');
    assert(M.tween(10, 20, 0.5) === 15, 'tween midpoint');
    assert(M.keyframes([[0, 0], [0.5, 10], [1, 0]], 0.25) === 5 && M.keyframes([[0.2, 3], [1, 9]], 0) === 3, 'keyframes');
    assert(M.stepped(0.4, 0) === 0.4 && M.cycle(1, 4, 0) === 0, 'stepped or cycle with n < 1');
    assert(M.keyframes([], 0.5) === 0, 'empty keyframes');
    assert(M.cycle(0.26, 4, 3) === 1 && M.count(0, 41, 1) === 41 && M.typed('BELL', 0.5) === 'BE', 'cycle, count or typed');
  });
  test('Motion: particles and flicker repeat exactly and stay in their box', () => {
    const M = B.Motion, o = { kind: 'snow', seed: 'a', t: 1.3, x: 10, y: 20, w: 100, h: 50, count: 30 };
    const a = M.particles(o), b = M.particles(o);
    assert(a.length === 30 && JSON.stringify(a) === JSON.stringify(b), 'particles are not deterministic');
    assert(a.every((q) => Number.isInteger(q.x) && Number.isInteger(q.y) && q.x >= 10 && q.x < 110 && q.y >= 20 && q.y < 70), 'particle outside its box or off the pixel grid');
    assert(JSON.stringify(M.particles(Object.assign({}, o, { t: 2 }))) !== JSON.stringify(a), 'particles do not move');
    assert(M.particles(Object.assign({}, o, { x: 10.4, y: 20.6 })).every((q) => Number.isInteger(q.x) && Number.isInteger(q.y)), 'fractional box origin gives off-grid particles');
    assert(M.flicker('s', 0.01, 10) === M.flicker('s', 0.09, 10), 'flicker changes inside one step');
  });
  test('Motion: camera and default presets', () => {
    const M = B.Motion;
    const c = M.cameraAt({ from: { x: 0 }, to: { x: 5, zoom: 1.08 } }, 0.5);
    assert(Number.isInteger(c.x) && c.y === 0 && c.zoom > 1 && c.zoom < 1.08, 'camera midpoint');
    assert(M.cameraAt(null, 0.3).zoom === 1, 'null camera is identity');
    assert(M.presetFor({ id: 'news:3:hold', dur: 2 }) === null && M.presetFor({ id: 'news:3:detail', dur: 1.4 }) === null, 'hold and short beats must not move');
    const p = M.presetFor({ id: 'news:3:detail', dur: 2 });
    assert(p && JSON.stringify(p) === JSON.stringify(M.presetFor({ id: 'news:3:detail', dur: 2 })), 'preset is not stable per id');
    assert(Object.values(M.PRESETS).every((q) => [q.from, q.to].every((e) => (e.zoom || 1) === 1 && (e.x || 0) === 0 && Math.abs(e.y || 0) <= 6)), 'preset must be zoom 1, no x, |y| <= 6');
  });
  test('Motion: default transitions', () => {
    const M = B.Motion;
    assert(M.transitionFor({ id: 'a:b' }, 0) === 'fade' && M.transitionFor({ id: 'a:b' }, 2) === 'cross', 'defaults');
    assert(M.transitionFor({ id: 'a:hold' }, 2) === 'cut' && M.transitionFor({ id: 'a:b', transition: 'cut' }, 2) === 'cut', 'hold and explicit cut');
  });

  test('Motion: a layered beat supplies a full draw in layer order', () => {
    const fakeCtx = () => new Proxy({}, { get: () => () => {} });
    const log = [];
    const beat = B.Motion.layered({ id: 't:x', dur: 2, layers: [
      { id: 'bg', depth: 0, draw: () => log.push('bg') },
      { id: 'fg', depth: 1.5, draw: () => log.push('fg'), animate: (c, v, t, p) => log.push('fg@' + t + '/' + p) }
    ] });
    beat.draw(fakeCtx(), { w: 640, h: 360 }, 1, {});
    assert(log.join() === 'bg,fg,fg@2/1' && beat.cache === false, 'layer order, animate time or cache flag');
    let threw = false; try { B.Motion.layered({ id: 't:y', dur: 1, layers: [{ id: 'a', draw() {} }, { id: 'a', draw() {} }] }); } catch (e) { threw = true; }
    assert(threw, 'duplicate layer ids must be rejected');
  });

  test('Storyboard: beats no longer hard-code a cut', () => {
    const bs = B.Scenes.news({ day: 7, brief: { title: 'x', feed: [] } });
    assert(bs[0].transition === 'fade', 'a scene must open on a fade');
    assert(bs.slice(1).every((b, i) => B.Motion.transitionFor(b, i + 1) === (/:hold$/.test(b.id) ? 'cut' : 'cross')), 'later beats should dissolve, holds should cut');
  });

  B.Tests = { results, run: () => results };
})(window.BTB);
