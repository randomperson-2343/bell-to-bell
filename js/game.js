// The session orchestrator: clock, day lifecycle, player actions, saving.
// A "mode" object (story or endless) supplies scenarios, rules, quotas and endings.
(function (B) {
  'use strict';
  const SUB = 0.25; // game-minutes per simulation step. Constant, which is what
                    // makes a day replayable tick-for-tick from a save.

  class Game {
    constructor(mode, save) {
      this.mode = mode;
      mode.game = this;
      this.dayLength = mode.dayLength || 180;
      this.market = new B.Market({ seed: mode.seed, volMult: mode.volMult || 1 });
      this.broker = new B.Broker({ cash: mode.capital, feeMult: mode.feeMult, slipMult: mode.feeMult, maintStrict: mode.maintStrict });
      this.broker.attach(this.market);
      this.stress = new B.Stress(mode.stressRate || 1);
      this.interrupts = new B.Interrupts(this);
      this.rng = B.RNG(B.hashSeed(mode.seed + '|game'));
      this.startCapital = mode.capital;
      this.day = 0;
      this.slot = save && save.slot != null ? save.slot : null;
      this.running = false;
      this.paused = false;
      this.speed = 1;
      this.lock = null;
      this.acc = 0;
      this.alive = true;
      this.quota = 0;
      this.history = [];
      this.inboxQueue = [];
      this.resumeAt = null;    // set when a mid-day save is being restored
      this.dayOpen = null;     // market state the current day started from
      this.loop = this.loop.bind(this);
      if (save) this.restore(save);
      else this.warmup();
      if (this.indexStart == null) this.indexStart = this.market.bySym.INDX.last;
    }

    // Simulate one quiet session before day 1 so charts open with yesterday's candles.
    warmup() {
      const m = this.market;
      m.startDay(-1, { regime: this.mode.kind === 'story' ? 'melt' : 'bull' });
      while (m.status === 'open' && m.t < B.DAY_MIN) m.step(1);
      m.close();
      m.status = 'pre';
    }

    get rate() { return B.DAY_MIN / this.dayLength; }

    begin() {
      B.UI.enterGame(this);
      this.last = performance.now();
      requestAnimationFrame(this.loop);
      if (this.resumeAt) this.resumeDay();
      else this.showBriefing();
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

    // ---- day lifecycle ----
    showBriefing() {
      const b = this.mode.briefing(this.day, this);
      if (B.Cinematic.startChain) B.Cinematic.startChain('preopen');
      const open = () => {
        if (B.Cinematic.endChain) B.Cinematic.endChain();
        B.Screens.briefing(this, b, () => this.enterOffice(b));
      };
      const phone = () => this.mode.kind === 'story'
        ? B.Cinematic.play('phone', { brief: b, day: this.day, game: this }, open)
        : open();
      if (b.cinematic !== false) B.Cinematic.play('news', { brief: b, day: this.day, game: this }, phone);
      else open();
    }

    enterOffice(b) {
      B.Music.stop();
      if (B.Cinematic.startChain) B.Cinematic.startChain('office');
      B.Cinematic.play('office', { brief: b, day: this.day, game: this }, () => {
        if (B.Cinematic.endChain) B.Cinematic.endChain();
        this.startDay();
      });
    }

    startDay() {
      const m = this.market, b = this.broker;
      this.applyRules();
      // The desk sets the number before the opening gap, so the amount shown in
      // the briefing is the amount the player is actually judged against.
      this.quota = this.mode.quota(this.day, this) || 0;
      this.quotaMeta = this.mode.quotaMeta ? this.mode.quotaMeta(this.day, this) : null;
      m.startDay(this.day, this.mode.scenario(this.day, this));
      // Snapshot the pre-open tape. A mid-day save rewinds to here and replays.
      this.dayOpen = { px: {}, fearLevel: m.fearLevel };
      for (const tk of m.tickers) this.dayOpen.px[tk.sym] = tk.prevClose;
      b.startDay();
      this.stress.startDay(this.mode.stressCarry ? this.mode.stressCarry(this.day) : undefined);
      if (this.mode.morningStress) this.stress.spike(this.mode.morningStress(this.day));
      this.lock = null;
      this.warned = {};
      this.earlyEnd = null;
      this.inboxQueue = (this.mode.inbox ? this.mode.inbox(this.day, this) : []).slice().sort((a, b2) => a.t - b2.t);
      B.UI.dayStart(this);
      this.interrupts.startDay(this.day, this.mode.calls ? this.mode.calls(this.day, this) : []);
      if (this.mode.onDayStart) this.mode.onDayStart(this);
      B.SFX.bell();
      B.Music.play('trading');
      this.acc = 0;
      this.running = true;
      this.autosave();
    }

    applyRules() {
      const b = this.broker;
      const rules = Object.assign({ maxLev: 4, shortBan: [] }, this.mode.rules(this.day, this));
      b.rules.maxLev = rules.maxLev;
      b.rules.overnightLev = rules.overnightLev || Math.max(1, rules.maxLev / 2);
      b.rules.shortBan = rules.shortBan || [];
      b.rules.locked = null;
      this.rules = rules;
    }

    // Rebuild a half-finished day from a save: same seed, same scenario, same
    // injected events, replayed forward to the exact minute you left off.
    resumeDay() {
      const snap = this.resumeAt;
      this.resumeAt = null;
      const m = this.market, b = this.broker;
      this.applyRules();
      m.restore(snap.dayOpen);
      m.startDay(this.day, this.mode.scenario(this.day, this));
      this.dayOpen = snap.dayOpen;
      for (const e of snap.injected || []) m.injectEvent(e, true);
      m.fastForward(snap.t, SUB);
      // Broker state is laid over the replayed tape, so nothing fills twice.
      b.restore(snap.broker);
      this.stress.restore(snap.stress);
      this.quota = snap.quota;
      this.quotaMeta = snap.quotaMeta || (this.mode.quotaMeta ? this.mode.quotaMeta(this.day, this) : null);
      this.warned = snap.warned || {};
      this.earlyEnd = snap.earlyEnd || null;
      this.inboxQueue = snap.inboxQueue || [];
      if (snap.rng) this.rng.setState(snap.rng);
      this.interrupts.startDay(this.day, []);
      this.interrupts.restore(snap.interrupts);
      if (this.mode.onResume) this.mode.onResume(this, snap);
      B.UI.dayStart(this);
      B.UI.restoreFeed(snap.feed);
      if (snap.lock) this.setLock(Math.max(0, snap.lock.until - m.t), snap.lock.reason, snap.lock.kind, snap.lock);
      B.Music.play('trading');
      this.acc = 0;
      this.running = true;
      B.UI.toast(`Resumed at ${B.Calendar.fmtTime(m.t)}. Positions are live.`, 'warn');
    }

    tick(dt) {
      const m = this.market, b = this.broker;
      for (const e of m.step(dt)) this.onMarket(e);
      for (const r of b.processOrders()) this.onOrderDone(r);
      for (const e of b.checkMargin(m.t)) this.onMargin(e);
      const eq = b.equity();
      if (eq > b.dayPeak) b.dayPeak = eq;
      b.trackRisk(m.t, this.mode.lossLimit || 0);
      if (this.lock && m.t >= this.lock.until) this.unlock(false);
      while (this.inboxQueue.length && this.inboxQueue[0].t <= m.t) B.UI.inbox(this.inboxQueue.shift());
      this.interrupts.update(m.t);
      this.stress.update(dt, this);
      B.Music.setIntensity(this.stress.level(), m.t / B.DAY_MIN);
      if (!this.lock && this.stress.canPanic(false)) this.panicAttack(false);
      if (this.mode.onTick) this.mode.onTick(this, m.t);
      if (!this.running) return;

      const wipe = this.mode.wipeLevel ? this.mode.wipeLevel(this) : 0;
      if (wipe && eq < wipe && !this.earlyEnd) {
        b.flattenAll('WIPED OUT', true);
        b.floorAtZero();
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
          if (e.big) { B.UI.flash('amber'); g.stress.spike(4); if (e.kind !== 'chirp' && e.text) B.UI.toast(`SQWAK ALERT · ${e.text}`, 'warn'); }
          break;
        case 'script':
          if (g.mode.onScript) g.mode.onScript(g, e.id);
          break;
        case 'breaker':
          B.SFX.crash();
          B.Music.cue('breaker');
          B.UI.flash('red');
          B.UI.shake(8);
          g.stress.spike(15);
          if (e.level >= 2) g.panicAttack(true);
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
        B.Music.cue('margin');
        this.stress.spike(10);
        B.UI.flash('red');
        B.UI.toast('MARGIN CALL! Cut positions before the countdown hits zero.', 'bad big');
      } else if (e.type === 'liq') {
        B.SFX.crash();
        this.stress.spike(15);
        this.panicAttack(true);
        B.UI.shake(6);
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
      const protection = B.Broker.validateBracket(o.sl, o.tp);
      if (!protection.ok) return this.reject(protection.msg);
      const b = this.broker;
      let q = Math.trunc(qty);
      if (!q) return this.reject('Enter a size');
      let ff = null;
      if (this.rng.next() < this.stress.fatFingerChance()) {
        ff = this.rng.pick(['x3', 'flip']);
        if (ff === 'flip') q = -q;
        else {
          q *= 3;
          const mx = b.maxQty(sym, Math.sign(q));
          if (Math.abs(q) > mx) q = Math.sign(q) * mx;
        }
      }
      let res;
      if (!o.type || o.type === 'market') {
        res = b.marketOrder(sym, q, { tag: ff ? 'FAT FINGER' : '' });
        if (res.ok) {
          B.SFX.fill(q);
          if ((protection.sl > 0 || protection.tp > 0) && b.posQty(sym)) b.attachBracket(sym, protection.sl, protection.tp);
          if (res.realized > 0 && Math.abs(res.realized) > b.dayStartEquity * 0.003) { this.stress.spike(-5); B.SFX.cash(); }
          if (res.realized < 0 && Math.abs(res.realized) > b.dayStartEquity * 0.01) this.stress.spike(4);
          if (this.mode.onTrade) this.mode.onTrade(this, sym, q);
        } else this.reject(res.msg);
      } else {
        res = b.placeOrder(sym, q, o.type, o.price,
          protection.sl > 0 || protection.tp > 0 ? { protect: { sl: protection.sl, tp: protection.tp } } : null);
        if (res.ok) { B.SFX.click(); B.UI.toast(`${o.type.toUpperCase()} ${q > 0 ? 'BUY' : 'SELL'} ${B.fmt.qty(Math.abs(q))} ${sym} @ ${B.fmt.price(o.price)} working`, ''); }
        else this.reject(res.msg);
      }
      if (ff) {
        const what = ff === 'flip' ? 'you hit the WRONG SIDE' : 'you typed an extra digit';
        B.UI.toast(`FAT FINGER! Hands shaking, ${what}.`, 'bad big');
        B.UI.shake(5);
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

    panicAttack(catastrophic) {
      if (this.lock || !this.stress.beginPanic(!!catastrophic)) return false;
      const keys = ['a', 's', 'd'];
      const seq = [];
      while (seq.length < 3) {
        let k = this.rng.pick(keys);
        if (seq.length && k === seq[seq.length - 1]) k = keys[(keys.indexOf(k) + 1) % keys.length];
        seq.push(k);
      }
      const mins = catastrophic ? 8 : 6;
      this.setLock(mins, catastrophic ? 'SYSTEM SHOCK' : 'PANIC ATTACK', 'panic', {
        seq, step: 0, mistakes: 0, catastrophic: !!catastrophic,
        startedAt: this.market.t, maxUntil: this.market.t + mins + 2
      });
      B.SFX.panic();
      B.Music.cue('panic');
      B.UI.flash('red');
      if (this.mode.onPanic) this.mode.onPanic(this);
      return true;
    }

    panicInput(key) {
      const lock = this.lock;
      if (!lock || lock.kind !== 'panic') return false;
      const expected = lock.seq[lock.step];
      const ok = String(key || '').toLowerCase() === expected;
      if (ok) {
        lock.step++;
        lock.until = Math.max(this.market.t + 0.5, lock.until - 1.25);
        this.stress.spike(-3);
        B.SFX.ground();
        if (lock.step >= lock.seq.length) {
          this.unlock(true);
          B.UI.toast('BREATH BACK. Hands steady enough. Keep trading.', 'good');
          return true;
        }
      } else {
        lock.mistakes++;
        lock.until = Math.min(lock.maxUntil, lock.until + 0.75);
        B.SFX.reject();
        B.UI.shake(2);
      }
      B.UI.panicProgress(lock, ok);
      return ok;
    }

    setLock(mins, reason, kind, extra) {
      this.lock = Object.assign({ until: this.market.t + mins, reason, kind }, extra || {});
      this.broker.rules.locked = reason;
      B.UI.lock(this.lock);
    }

    unlock(interactive) {
      if (this.lock && this.lock.kind === 'panic') this.stress.recover(!!interactive);
      this.lock = null;
      this.broker.rules.locked = null;
      B.UI.unlock();
    }

    togglePause(force) {
      if (!this.running) return;
      this.paused = force == null ? !this.paused : force;
      B.UI.pause(this.paused);
      B.Music.duck(this.paused);
    }

    // ---- day end ----
    endDay() {
      if (!this.running) return;
      this.running = false;
      const m = this.market, b = this.broker;
      if (this.lock) this.unlock();
      m.close();
      this.interrupts.endDay();
      B.Music.stop();
      const eod = b.endOfDay(this.day);
      const eq = b.equity();
      const pnl = eq - b.dayStartEquity;
      const trades = b.dayTrades();
      const realized = trades.map((x) => x.realized);
      const report = {
        day: this.day,
        date: this.mode.kind === 'story' && B.Calendar.storyLabel ? B.Calendar.storyLabel(this.day) : B.Calendar.dayInfo(this.day).long,
        pnl, equity: eq, start: b.dayStartEquity,
        quota: this.quota,
        // A story fine (a settlement, a forced unwind) is not a missed quota.
        quotaMet: this.quota <= 0 || pnl - ((b.dayRisk && b.dayRisk.adj) || 0) >= this.quota,
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
      if (this.mode.kind === 'story' && this.mode.S) {
        report.quotaStrikes = this.mode.S.quotaLedger ? this.mode.S.quotaLedger.length : (this.mode.S.quotaStrikes || 0);
        report.quotaStrikeLimit = this.mode.strikeLimit || B.StoryMode.QUOTA_STRIKE_LIMIT;
      }
      report.notes = verdict.notes || [];
      B.UI.dayEnd(this);
      if (B.Cinematic.startChain) B.Cinematic.startChain('close');
      B.Cinematic.play('close', { report, game: this }, () => {
        if (B.Cinematic.endChain) B.Cinematic.endChain();
        B.Music.play('close');
        B.Screens.eod(this, report, () => {
          if (verdict.ending) return this.finish(verdict.ending);
          this.mode.afterDay(this, (ending) => {
            if (ending) return this.finish(ending);
            const advance = () => {
              this.day++;
              this.autosave();
              this.showBriefing();
            };
            const weekend = this.mode.kind === 'story' && this.day % 5 === 4 && this.day < this.mode.lastDay;
            if (weekend) {
              if (this.mode.weekendLedger) return this.mode.weekendLedger(this, () => {
                if (B.Cinematic.startChain) B.Cinematic.startChain('weekend');
                B.Cinematic.play('weekend', { day: this.day, game: this }, () => {
                  if (B.Cinematic.endChain) B.Cinematic.endChain();
                  advance();
                });
              });
              if (B.Cinematic.startChain) B.Cinematic.startChain('weekend');
              B.Cinematic.play('weekend', { day: this.day, game: this }, () => {
                if (B.Cinematic.endChain) B.Cinematic.endChain();
                advance();
              });
            }
            else advance();
          });
        });
      });
    }

    finish(ending) {
      this.running = false;
      this.alive = false;
      if (this.slot != null) B.Save.finish(this.slot, ending);
      else B.Save.recordEnding(ending.id);
      B.Music.stop();
      if (B.UI.clearToasts) B.UI.clearToasts();
      B.Screens.ending(this, ending);
    }

    quit() {
      this.running = false;
      this.alive = false;
      B.Music.play('menu');
      B.UI.leaveGame();
    }

    // ---- saving ----
    // A snapshot is complete enough to rebuild the session to the exact minute,
    // including a half-traded day. See js/core/save.js for the storage side.
    snapshot() {
      const inDay = this.running || this.paused;
      const snap = {
        kind: this.mode.kind,
        day: this.day,
        dayLength: this.dayLength,
        inDay,
        mode: this.mode.serialize(),
        history: this.history,
        indexStart: this.indexStart,
        startCapital: this.startCapital,
        slot: this.slot
      };
      if (inDay) {
        snap.t = this.market.t;
        snap.dayOpen = this.dayOpen;
        snap.injected = this.market.injected || [];
        snap.broker = this.broker.serializeFull();
        snap.stress = this.stress.serialize();
        snap.quota = this.quota;
        snap.quotaMeta = this.quotaMeta;
        snap.warned = this.warned;
        snap.earlyEnd = this.earlyEnd;
        snap.inboxQueue = this.inboxQueue;
        snap.lock = this.lock;
        snap.rng = this.rng.getState();
        snap.interrupts = this.interrupts.serialize();
        snap.feed = B.UI.snapshotFeed();
      } else {
        snap.broker = this.broker.serialize();
        snap.market = this.market.serialize();
        snap.stress = this.stress.serialize();
      }
      return snap;
    }

    meta() {
      return {
        mode: this.mode.kind,
        day: this.day,
        label: this.mode.slotLabel ? this.mode.slotLabel(this) : `Day ${this.day + 1}`,
        equity: Math.round(this.broker.equity()),
        startCapital: this.startCapital,
        inDay: this.running || this.paused,
        clock: this.running || this.paused ? B.Calendar.fmtTime(this.market.t) : null
      };
    }

    // Called on a deliberate save from the pause menu.
    saveNow() {
      if (this.slot == null) this.slot = B.Save.firstEmpty();
      if (this.slot < 0) { this.slot = null; return false; }
      return B.Save.write(this.slot, this.snapshot(), this.meta());
    }

    // Called at each bell. Silent; never steals a slot that isn't ours.
    autosave() {
      if (this.slot == null) return false;
      const ok = B.Save.write(this.slot, this.snapshot(), this.meta());
      if (!ok && !this.autosaveWarned) {
        this.autosaveWarned = true;
        B.UI.toast('AUTOSAVE FAILED. Storage may be full. Pause and save before leaving.', 'bad big');
      }
      if (ok) this.autosaveWarned = false;
      return ok;
    }

    restore(s) {
      this.day = s.day;
      this.dayLength = s.dayLength || this.dayLength;
      this.history = s.history || [];
      if (this.mode.reconcileQuotaStrikes) this.mode.reconcileQuotaStrikes(this.history);
      this.indexStart = s.indexStart;
      this.startCapital = s.startCapital || this.startCapital;
      if (s.inDay) {
        // The market is rebuilt in resumeDay() once the UI exists.
        this.resumeAt = s;
        this.market.restore(s.dayOpen);
        this.market.status = 'pre';
      } else {
        this.broker.restore(s.broker);
        this.market.restore(s.market);
        this.stress.restore(s.stress);
      }
    }
  }

  B.Game = Game;
})(window.BTB);
