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
  ['toast', 'inbox', 'addNews', 'phoneHide', 'renderTasks', 'shake', 'flash'].forEach((k) => { if (!B.UI[k]) B.UI[k] = () => {}; });

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

  // ---------- Broker ----------
  test('Long round trip realizes correct P&L', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.MRTM;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('MRTM', 100);
    tk.last = 110;
    const r = b.marketOrder('MRTM', -100);
    near(r.realized, 1000, 0.01, 'realized');
    near(b.equity(), 101000, 0.01, 'equity');
    assert(b.isFlat(), 'should be flat');
  });

  test('Short round trip profits when price falls', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.MRTM;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('MRTM', -200);
    near(b.equity(), 100000, 0.01, 'equity unchanged at entry');
    tk.last = 90;
    near(b.equity(), 102000, 0.01, 'short gains');
    const r = b.marketOrder('MRTM', 200);
    near(r.realized, 2000, 0.01);
  });

  test('Flip from long to short keeps accounting straight', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.MRTM;
    tk.last = 50; tk.spread = 1e-12;
    b.marketOrder('MRTM', 100);
    tk.last = 60;
    b.marketOrder('MRTM', -300);
    assert(b.posQty('MRTM') === -200, 'qty');
    near(b.pos.MRTM.avg, 60, 1e-9, 'avg resets on flip');
    near(b.equity(), 101000, 0.01);
  });

  test('Buying power limits exposure to max leverage', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.MRTM.last = 100; m.bySym.MRTM.spread = 1e-12;
    b.rules.maxLev = 4;
    assert(!b.marketOrder('MRTM', 4100).ok, 'should reject > 4x');
    assert(b.marketOrder('MRTM', 3900).ok, 'should allow < 4x');
    assert(b.maxQty('MRTM', 1) < 200, 'little buying power left');
  });

  test('Short-sale ban blocks new shorts but allows covering', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.LRMR.spread = 1e-12;
    b.marketOrder('LRMR', -100);
    b.rules.shortBan = ['bank'];
    assert(!b.marketOrder('LRMR', -100).ok, 'ban should block adding');
    assert(b.marketOrder('LRMR', 100).ok, 'covering allowed');
  });

  test('Margin call then liquidation', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.MRTM;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('MRTM', 3900);
    tk.last = 75; // -25% on ~3.9x
    let ev = b.checkMargin(10);
    assert(ev.some((e) => e.type === 'mc'), 'margin call issued');
    ev = b.checkMargin(41);
    assert(ev.some((e) => e.type === 'liq'), 'liquidated after deadline');
    assert(b.netLiq() >= b.maintenance(), 'back above maintenance');
  });

  test('Overnight margin force-sells excess at the close', () => {
    const m = mkMarket(); const b = mkBroker(m);
    m.bySym.MRTM.last = 100; m.bySym.MRTM.spread = 1e-12;
    b.rules.maxLev = 4; b.rules.overnightLev = 2;
    b.marketOrder('MRTM', 3500);
    m.close();
    const out = b.endOfDay(0);
    assert(out.forced.length === 1, 'forced sale');
    assert(b.stockGross() / 2 <= b.netLiq() + 1, 'within overnight limit');
  });

  test('Bracket stop-loss fires and cancels its take-profit', () => {
    const m = mkMarket(); const b = mkBroker(m);
    const tk = m.bySym.MRTM;
    tk.last = 100; tk.spread = 1e-12;
    b.marketOrder('MRTM', 100);
    b.attachBracket('MRTM', 5, 10);
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
    const tk = m.bySym.MRTM;
    tk.last = 100;
    const r = b.buyOption('MRTM', 'P', 100, 0, 2);
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

  test('Single-stock volatility halt on a huge shock', () => {
    const m = mkMarket({ regime: 'chop', events: [{ t: 60, text: 'x', impacts: [{ scope: 'ticker', id: 'NSTG', pct: -0.35 }] }] }, 'luld');
    const out = runDay(m);
    assert(out.some((e) => e.type === 'luld' && e.sym === 'NSTG'), 'LULD halt');
  });

  test('Rumors appear before their news', () => {
    const m = mkMarket({ regime: 'chop', events: [{ t: 100, text: 'news', impacts: [], rumor: { lead: 10, text: 'rumor' } }] });
    const out = runDay(m).filter((e) => e.type === 'news');
    assert(out[0].text === 'rumor' && out[1].text === 'news', 'order');
    assert(out[1].t - out[0].t >= 9.5, 'lead time');
  });

  // ---------- Story graph ----------
  const D = B.StoryData;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  test('Every story day builds a valid scenario and briefing', () => {
    const variants = [{}, { dereg: true, lorimerFailed: true, fraud: true, insider: true, dumped: true, raid: true },
      { regulation: true, bailout: true, disclosed: true, leaked: true, reported: true, billPassed: true, tipShortBan: true },
      { merger: true, defected: true, refusedDump: true }];
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

  test('Story graph: every ending is reachable through choices', () => {
    const order = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    const reached = {};
    let paths = 0;
    const archetypes = [
      { reason: 'final', wealth: 1.3, tradedTip: false },
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
    const a = clone(S); a.f.bailout = true; a.m.anger = 40; a.m.stability = 70;
    const b2 = clone(S); b2.m.stability = 15; b2.f.lobbyNo = true;
    assert(B.StoryMode.votePasses(a) === true, 'should pass');
    assert(B.StoryMode.votePasses(b2) === false, 'should fail');
  });

  B.Tests = { results, run: () => results };
})(window.BTB);
