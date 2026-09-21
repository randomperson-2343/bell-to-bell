// The session orchestrator: clock, day lifecycle, player actions, saving.
// A "mode" object (story or endless) supplies scenarios, rules, quotas and endings.
(function (B) {
  'use strict';
  const SUB = 0.25; // game-minutes per simulation step

  class Game {
    constructor(mode, save) {
      this.mode = mode;
      mode.game = this;
      this.dayLength = mode.dayLength || 240;
      this.market = new B.Market({ seed: mode.seed, volMult: mode.volMult || 1 });
      this.broker = new B.Broker({ cash: mode.capital, feeMult: mode.feeMult, slipMult: mode.feeMult, maintStrict: mode.maintStrict });
      this.broker.attach(this.market);
      this.stress = new B.Stress(mode.stressRate || 1);
      this.interrupts = new B.Interrupts(this);
      this.rng = B.RNG(B.hashSeed(mode.seed + '|game'));
      this.startCapital = mode.capital;
      this.day = 0;
      this.running = false;
      this.paused = false;
      this.speed = 1;
      this.lock = null;
      this.acc = 0;
      this.alive = true;
      this.quota = 0;
      this.history = [];
      this.inboxQueue = [];
      this.loop = this.loop.bind(this);
      if (save) this.restore(save);
      else this.warmup();
      if (this.indexStart == null) this.indexStart = this.market.bySym.INDX.last;
    }

    // Simulate one quiet session before day 1 so charts open with yesterday's candles.
    warmup() {
      const m = this.market;
      m.startDay(-1, { regime: this.mode.kind === 'story' ? 'bubble' : 'bull' });
      while (m.status === 'open' && m.t < B.DAY_MIN) m.step(1);
      m.close();
      m.status = 'pre';
    }

    get rate() { return B.DAY_MIN / this.dayLength; }

    begin() {
      B.UI.enterGame(this);
      this.last = performance.now();
      requestAnimationFrame(this.loop);
      this.showBriefing();
    }

    loop(ts) {
      if (!this.alive) return;
      const dt = Math.min(0.1, (ts - this.last) / 1000);
      this.last = ts;
      if (this.running && !this.paused) {
        this.acc += dt * this.rate * this.speed;
        let n = 0;
        while (this.acc >= SUB && this.running && n < 400) {
          this.acc -= SUB;
          this.tick(SUB);
          n++;
        }
      }
      B.UI.frame(this, dt);
      requestAnimationFrame(this.loop);
    }

    showBriefing() {
      const b = this.mode.briefing(this.day, this);
      B.Screens.briefing(this, b, () => this.startDay());
    }

    startDay() {
      const m = this.market, b = this.broker;
      const rules = Object.assign({ maxLev: 4, shortBan: [] }, this.mode.rules(this.day, this));
      b.rules.maxLev = rules.maxLev;
      b.rules.overnightLev = rules.overnightLev || Math.max(1, rules.maxLev / 2);
      b.rules.shortBan = rules.shortBan || [];
      b.rules.locked = null;
      this.rules = rules;
      m.startDay(this.day, this.mode.scenario(this.day, this));
      b.startDay();
      this.stress.startDay();
      this.quota = this.mode.quota(this.day, this) || 0;
      this.lock = null;
      this.warned = {};
      this.earlyEnd = null;
      this.inboxQueue = (this.mode.inbox ? this.mode.inbox(this.day, this) : []).slice().sort((a, b2) => a.t - b2.t);
      B.UI.dayStart(this);
      this.interrupts.startDay(this.day, this.mode.calls ? this.mode.calls(this.day, this) : []);
      if (this.mode.onDayStart) this.mode.onDayStart(this);
      B.SFX.bell();
      this.acc = 0;
      this.running = true;
    }

    tick(dt) {
      const m = this.market, b = this.broker;
      for (const e of m.step(dt)) this.onMarket(e);
      for (const r of b.processOrders()) this.onOrderDone(r);
      for (const e of b.checkMargin(m.t)) this.onMargin(e);
      const eq = b.equity();
      if (eq > b.dayPeak) b.dayPeak = eq;
      if (this.lock && m.t >= this.lock.until) this.unlock();
      while (this.inboxQueue.length && this.inboxQueue[0].t <= m.t) B.UI.inbox(this.inboxQueue.shift());
      this.interrupts.update(m.t);
      this.stress.update(dt, this);
      if (this.stress.v >= 99.5 && !(this.lock && this.lock.kind === 'panic')) this.panicAttack();
      if (this.mode.onTick) this.mode.onTick(this, m.t);
      if (!this.running) return;

      const wipe = this.mode.wipeLevel ? this.mode.wipeLevel(this) : 0;
      if (wipe && eq < wipe && !this.earlyEnd) {
        b.flattenAll('WIPED OUT', true);
        this.earlyEnd = 'wiped';
        B.UI.toast('ACCOUNT WIPED OUT. Risk has frozen your book.', 'bad big');
        B.SFX.crash();
        this.endDay();
        return;
      }
      if (!this.warned.overnight && m.t >= 370 && b.stockGross() / b.rules.overnightLev > b.netLiq()) {
        this.warned.overnight = true;
        B.UI.toast(`Overnight limit is ${b.rules.overnightLev}x. Cut exposure before the bell or get force-sold at the close.`, 'warn');
        B.SFX.alarm();
      }
      if (!this.warned.last && m.t >= 380) {
        this.warned.last = true;
        B.UI.toast('10 MINUTES TO THE CLOSE', 'warn');
      }
      if (m.status === 'closed' || m.t >= B.DAY_MIN) this.endDay();
    }

    onMarket(e) {
      const g = this;
      switch (e.type) {
        case 'news':
          B.UI.addNews(e);
          if (e.big) { B.UI.flash('amber'); g.stress.spike(4); }
          break;
        case 'script':
          if (g.mode.onScript) g.mode.onScript(g, e.id);
          break;
        case 'breaker':
          B.SFX.crash();
          B.UI.flash('red');
          B.UI.shake(18);
          g.stress.spike(15);
          if (e.level === 3) B.UI.toast('LEVEL 3 CIRCUIT BREAKER: market closed for the day', 'bad big');
          else B.UI.toast(`LEVEL ${e.level} CIRCUIT BREAKER: index down ${e.level === 1 ? '7' : '13'}%. Trading halted 15 minutes.`, 'bad big');
          B.UI.addNews({ kind: 'wire', text: `MARKET-WIDE CIRCUIT BREAKER TRIPPED (LEVEL ${e.level})`, src: 'EXCHANGE', t: g.market.t, big: true });
          break;
        case 'haltEnd':
          B.UI.toast('Trading resumes', 'warn');
          B.SFX.bell();
          break;
        case 'luld':
          B.SFX.halt();
          B.UI.toast(`${e.sym} HALTED: volatility pause (${e.dir > 0 ? 'limit up' : 'limit down'})`, 'warn');
          if (g.broker.posQty(e.sym)) g.stress.spike(6);
          break;
        case 'luldEnd':
          B.UI.toast(`${e.sym} resumes trading`, 'warn');
          break;
      }
    }

    onOrderDone(r) {
      if (r.rejected) {
        B.UI.toast(`${r.order.label || r.order.type.toUpperCase()} order on ${r.order.sym} rejected: ${r.res.msg}`, 'bad');
        B.SFX.reject();
        return;
      }
      const o = r.order;
      B.UI.toast(`${o.label || o.type.toUpperCase()} filled: ${r.res.qty > 0 ? 'BUY' : 'SELL'} ${B.fmt.qty(Math.abs(r.res.qty))} ${o.sym} @ ${B.fmt.price(r.res.price)}`, r.res.realized >= 0 ? 'good' : 'bad');
      B.SFX.fill(r.res.qty);
      if (o.label === 'STOP-LOSS') this.stress.spike(3);
    }

    onMargin(e) {
      if (e.type === 'mc') {
        B.SFX.alarm();
        this.stress.spike(10);
        B.UI.flash('red');
        B.UI.toast('MARGIN CALL! Cut positions before the countdown hits zero.', 'bad big');
      } else if (e.type === 'liq') {
        B.SFX.crash();
        this.stress.spike(15);
        B.UI.shake(14);
        B.UI.toast('FORCED LIQUIDATION. Risk dumped your worst positions.', 'bad big');
      } else if (e.type === 'mcClear') {
        B.UI.toast('Margin call cleared.', 'good');
      } else if (e.type === 'wiped') {
        this.earlyEnd = 'wiped';
        B.SFX.crash();
        B.UI.toast('EQUITY BELOW ZERO. Everything is gone.', 'bad big');
        this.endDay();
      }
    }

    // ---- player actions ----
    act() {
      if (!this.running) return 'Market is closed';
      if (this.paused) return 'Game is paused';
      if (this.lock) return this.lock.reason;
      return null;
    }

    reject(msg) {
      B.UI.toast(msg, 'bad');
      B.SFX.reject();
      return { ok: false, msg };
    }

    trade(sym, qty, o) {
      o = o || {};
      const bad = this.act();
      if (bad) return this.reject(bad);
      const b = this.broker;
      let q = Math.trunc(qty);
      if (!q) return this.reject('Enter a size');
      let ff = null;
      if (this.rng.next() < this.stress.fatFingerChance()) {
        ff = this.rng.pick(['x10', 'x3', 'flip']);
        if (ff === 'flip') q = -q;
        else {
          q *= ff === 'x10' ? 10 : 3;
          const mx = b.maxQty(sym, Math.sign(q));
          if (Math.abs(q) > mx) q = Math.sign(q) * mx;
        }
      }
      let res;
      if (!o.type || o.type === 'market') {
        res = b.marketOrder(sym, q, { tag: ff ? 'FAT FINGER' : '' });
        if (res.ok) {
          B.SFX.fill(q);
          if ((o.sl > 0 || o.tp > 0) && b.posQty(sym)) b.attachBracket(sym, o.sl, o.tp);
          if (res.realized > 0 && Math.abs(res.realized) > b.dayStartEquity * 0.003) { this.stress.spike(-5); B.SFX.cash(); }
          if (res.realized < 0 && Math.abs(res.realized) > b.dayStartEquity * 0.01) this.stress.spike(4);
          if (this.mode.onTrade) this.mode.onTrade(this, sym, q);
        } else this.reject(res.msg);
      } else {
        res = b.placeOrder(sym, q, o.type, o.price);
        if (res.ok) { B.SFX.click(); B.UI.toast(`${o.type.toUpperCase()} ${q > 0 ? 'BUY' : 'SELL'} ${B.fmt.qty(Math.abs(q))} ${sym} @ ${B.fmt.price(o.price)} working`, ''); }
        else this.reject(res.msg);
      }
      if (ff) {
        const what = ff === 'flip' ? 'you hit the WRONG SIDE' : `you typed an extra ${ff === 'x10' ? 'zero' : 'digit'}`;
        B.UI.toast(`FAT FINGER! Hands shaking, ${what}.`, 'bad big');
        B.UI.shake(10);
        this.stress.spike(8);
      }
      return res;
    }

    closePos(sym, frac) {
      const bad = this.act();
      if (bad) return this.reject(bad);
      const res = this.broker.closePosition(sym, frac);
      if (res.ok) {
        B.SFX.fill(res.qty);
        if (res.realized > 0) this.stress.spike(-6);
        if (this.mode.onTrade) this.mode.onTrade(this, sym, res.qty);
      } else this.reject(res.msg);
      return res;
    }

    flatten() {
      const bad = this.act();
      if (bad) return this.reject(bad);
      if (this.broker.isFlat() && !this.broker.orders.length) return this.reject('Already flat');
      const res = this.broker.flattenAll('FLATTEN');
      const fails = res.filter((r) => !r.ok);
      if (fails.length) B.UI.toast(`Could not close everything: ${fails[0].msg}`, 'bad');
      else B.UI.toast('FLAT. Every position closed, every order cancelled.', 'good');
      B.SFX.fill(-1);
      this.stress.spike(-8);
    }

    cancelOrder(id) { this.broker.cancelOrder(id); B.SFX.click(); }

    buyOption(sym, type, strike, expiry, n) {
      const bad = this.act();
      if (bad) return this.reject(bad);
      const res = this.broker.buyOption(sym, type, strike, expiry, n);
      if (res.ok) { B.SFX.fill(1); B.UI.toast(`Bought ${n} ${sym} ${strike}${type} @ ${B.fmt.price(res.price)}`, ''); }
      else this.reject(res.msg);
      return res;
    }

    sellOption(id) {
      const bad = this.act();
      if (bad) return this.reject(bad);
      const res = this.broker.sellOption(id);
      if (res.ok) { B.SFX.fill(-1); if (res.realized > 0) this.stress.spike(-5); }
      else this.reject(res.msg);
      return res;
    }

    coffee() {
      const bad = this.act();
      if (bad) return this.reject(bad);
      this.setLock(15, 'Away on a coffee break', 'coffee');
      this.stress.spike(-30);
      B.UI.toast('You step away from the screens. Positions stay live.', '');
    }

    panicAttack() {
      this.setLock(20, 'PANIC ATTACK', 'panic');
      B.SFX.panic();
      B.UI.flash('red');
      if (this.mode.onPanic) this.mode.onPanic(this);
    }

    setLock(mins, reason, kind) {
      this.lock = { until: this.market.t + mins, reason, kind };
      this.broker.rules.locked = reason;
      B.UI.lock(this.lock);
    }

    unlock() {
      if (this.lock && this.lock.kind === 'panic') this.stress.v = 55;
      this.lock = null;
      this.broker.rules.locked = null;
      B.UI.unlock();
    }

    togglePause(force) {
      if (!this.running) return;
      this.paused = force == null ? !this.paused : force;
      B.UI.pause(this.paused);
    }

    // ---- day end ----
    endDay() {
      if (!this.running) return;
      this.running = false;
      const m = this.market, b = this.broker;
      if (this.lock) this.unlock();
      m.close();
      this.interrupts.endDay();
      B.SFX.closeBell();
      const eod = b.endOfDay(this.day);
      const eq = b.equity();
      const pnl = eq - b.dayStartEquity;
      const trades = b.dayTrades();
      const realized = trades.map((x) => x.realized);
      const report = {
        day: this.day,
        date: B.Calendar.dayInfo(this.day).long,
        pnl, equity: eq, start: b.dayStartEquity,
        quota: this.quota,
        quotaMet: this.quota <= 0 || pnl >= this.quota,
        trades: trades.length,
        best: realized.length ? Math.max(...realized) : 0,
        worst: realized.length ? Math.min(...realized) : 0,
        fees: b.fees - b.dayFeesStart,
        stressPeak: this.stress.peak,
        eod,
        indexPct: m.indexDayPct(),
        earlyEnd: this.earlyEnd
      };
      this.history.push({ day: this.day, pnl, equity: eq, quotaMet: report.quotaMet, index: m.bySym.INDX.last });
      const verdict = this.mode.onDayEnd(this, report) || {};
      report.notes = verdict.notes || [];
      B.UI.dayEnd(this);
      B.Screens.eod(this, report, () => {
        if (verdict.ending) return this.finish(verdict.ending);
        this.mode.afterDay(this, (ending) => {
          if (ending) return this.finish(ending);
          this.day++;
          this.save();
          this.showBriefing();
        });
      });
    }

    finish(ending) {
      this.running = false;
      this.alive = false;
      B.storage.remove(this.mode.saveKey);
      B.Screens.ending(this, ending);
    }

    quit() {
      this.running = false;
      this.alive = false;
      B.UI.leaveGame();
    }

    save() {
      B.storage.set(this.mode.saveKey, {
        v: 1,
        day: this.day,
        mode: this.mode.serialize(),
        broker: this.broker.serialize(),
        market: this.market.serialize(),
        stress: this.stress.v,
        history: this.history,
        indexStart: this.indexStart
      });
    }

    restore(s) {
      this.day = s.day;
      this.broker.restore(s.broker);
      this.market.restore(s.market);
      this.stress.v = s.stress || 0;
      this.history = s.history || [];
      this.indexStart = s.indexStart;
    }
  }

  B.Game = Game;
})(window.BTB);
