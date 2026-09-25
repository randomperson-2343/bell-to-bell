// Phone calls, client orders and mid-session choices that fight for your attention.
//
// Tips are deliberately unreliable. A tip resolves one of four ways:
//   real      it moves your way and pays
//   stale     it is true, but the move lands before you can click. You eat fees.
//   reversal  it runs your way, then violently reverses into you
//   fake      nothing happens at all
// Roughly one in three pays. Acting on every call is how you go broke.
(function (B) {
  'use strict';

  const TIPSTERS = ['Your old college roommate', 'A guy from your gym', 'Your barber', 'Ex-colleague at Calloway', 'Unknown number', 'Your cousin down south'];
  const FAMILY = [
    ['Mom', 'Is the stock market okay? It was on the news. Should I sell my pension? Call me back.'],
    ['Your landlord', 'Rent check bounced. Again. I need it by Friday.'],
    ['Your dentist', 'Reminder: you have missed your last three appointments.'],
    ['Your sibling', 'Remember you promised to help me move on Saturday. You promised.'],
    ['Wrong number', 'Is this Pizza Palace? I want a large pepperoni. Hello? HELLO?'],
    ['Your landlord', 'The building is going "AI-managed". Rent goes up 9%. The robot says congratulations.']
  ];

  const DEFAULT_ODDS = { real: 0.35, stale: 0.16, reversal: 0.12 };

  class Interrupts {
    constructor(g) {
      this.g = g;
      this.queue = [];
      this.active = null;
      this.ringing = false;
      this.tasks = [];
      this.tipsActed = 0;
    }

    startDay(day, scripted) {
      const g = this.g;
      const rng = B.RNG(B.hashSeed(g.mode.seed + '|calls|' + day));
      this.rng = rng;
      const freq = g.mode.callFreq == null ? 1 : g.mode.callFreq;
      const n = Math.round(rng.range(2, 4.5) * freq);
      const random = [];
      for (let i = 0; i < n; i++) {
        const t = Math.round(rng.range(20, 370));
        const r = rng.next();
        // Tips are now the rarest kind of call, not the most common.
        if (r < 0.15) random.push({ t, kind: 'tip' });
        else if (r < 0.45) random.push({ t, kind: 'boss' });
        else if (r < 0.80) random.push({ t, kind: 'client' });
        else random.push({ t, kind: 'family' });
      }
      this.queue = (scripted || []).concat(random).sort((a, b) => a.t - b.t);
      this.active = null;
      this.ringing = false;
      this.tasks = [];
      this.tipsActed = 0;
      B.UI.phoneHide();
      B.UI.renderTasks(this.tasks);
    }

    endDay() {
      if (this.active && this.active.kind === 'choice' && this.active.state !== 'done') {
        this.resolveChoice(this.active.defaultOpt, true);
      }
      this.active = null;
      this.ringing = false;
      this.queue = [];
      this.tasks = [];
      B.UI.phoneHide();
      B.UI.renderTasks(this.tasks);
    }

    realMin(sec) { return sec * this.g.rate; }

    update(t) {
      const a = this.active;
      if (a) {
        if (a.state === 'ringing' && t >= a.ringEnd) this.miss();
        else if (a.state === 'open' && a.kind === 'choice' && t >= a.choiceEnd) this.resolveChoice(a.defaultOpt, true);
        else if (a.state === 'open' && a.kind !== 'choice' && t >= a.openEnd) this.hangup();
      } else if (this.queue.length && t >= this.queue[0].t) {
        const next = this.queue.shift();
        // Scripted calls are never skipped; random ones are dropped while the account is frozen.
        if (next.scripted || !this.g.lock) this.ring(next, t);
      }
      for (const task of this.tasks) {
        if (!task.done && t >= task.deadline) {
          task.done = true;
          task.failed = true;
          this.g.stress.spike(5);
          B.UI.toast(`Client order missed: ${task.label}`, 'bad');
          if (this.g.mode.onTaskFailed) this.g.mode.onTaskFailed(this.g, task);
          B.UI.renderTasks(this.tasks);
        }
      }
    }

    ring(call, t) {
      this.prepare(call);
      call.state = 'ringing';
      call.ringEnd = t + this.realMin(call.kind === 'choice' ? 10 : 6);
      this.active = call;
      this.ringing = true;
      B.UI.phoneRing(call);
    }

    // Fill in the details of random calls at ring time so they react to the moment.
    prepare(call) {
      const g = this.g, rng = this.rng;
      if (call.from) return;
      const tradable = B.TICKERS.filter((x) => x.sector !== 'index' && x.sector !== 'fear');
      if (call.kind === 'tip') {
        const tk = rng.pick(tradable);
        const up = rng.chance(0.5);
        call.from = rng.pick(TIPSTERS);
        call.text = `Heard ${tk.name} (${tk.sym}) is about to ${up ? 'rip higher' : 'fall off a cliff'}. Don't ask me how I know.`;
        call.tip = { sym: tk.sym, up, outcome: this.rollTipOutcome(rng) };
      } else if (call.kind === 'boss') {
        call.from = g.mode.bossName ? g.mode.bossName(g) : 'Risk Manager';
      } else if (call.kind === 'client') {
        const tk = rng.pick(tradable);
        const side = rng.chance(0.5) ? 'BUY' : 'SELL';
        const qty = rng.pick([2000, 5000, 10000, 25000]);
        call.from = rng.pick(['Pension client', 'Family office', 'Hedge fund client', 'Sovereign fund desk']);
        const px = g.market.bySym[tk.sym].last;
        call.task = { sym: tk.sym, side, qty, fee: Math.round(qty * px * 0.0008 / 50) * 50 + 250 };
        call.text = `Need you to ${side} ${B.fmt.qty(qty)} ${tk.sym} for us in the next few minutes. Don't screw it up.`;
      } else if (call.kind === 'family') {
        const f = rng.pick(FAMILY);
        call.from = f[0];
        call.text = f[1];
        // No landlord once you are back on your mother's couch.
        if (f[0] === 'Your landlord' && g.mode.onCouch && g.mode.onCouch()) {
          call.from = 'Mom';
          call.text = 'Are you eating? You left your good shirt in the dryer. Call me back.';
        }
      }
    }

    rollTipOutcome(rng) {
      const o = Object.assign({}, DEFAULT_ODDS, this.g.mode.tipOdds || {});
      // Story mode caps how many tips can actually pay in one session.
      const cap = this.g.mode.tipCap == null ? 99 : this.g.mode.tipCap;
      const r = rng.next();
      if (r < o.real && this.tipsActed < cap) { this.tipsActed++; return 'real'; }
      if (r < o.real + o.stale) return 'stale';
      if (r < o.real + o.stale + o.reversal) return 'reversal';
      return 'fake';
    }

    // Turn a tip into actual market events. Everything is injected as a normal
    // scripted event, so it shows up on the Wire like any other headline.
    fireTip(tip, t) {
      const g = this.g, rng = this.rng, tk = g.market.bySym[tip.sym];
      const dir = tip.up ? 1 : -1;
      const good = tip.up
        ? `${tk.name} surges on report of takeover interest`
        : `${tk.name} plunges after surprise profit warning`;
      if (tip.outcome === 'real') {
        g.market.injectEvent({
          t: t + Math.round(rng.range(6, 16)), text: good,
          impacts: [{ scope: 'ticker', id: tip.sym, pct: rng.range(0.04, 0.09) * dir, over: 0.3 }]
        });
      } else if (tip.outcome === 'stale') {
        // True, but the tape already knows. The move lands before you can size up,
        // then nothing. You paid the spread for a headline everyone had.
        g.market.injectEvent({
          t: t + 1, text: good,
          impacts: [{ scope: 'ticker', id: tip.sym, pct: rng.range(0.012, 0.022) * dir, over: 0.1 }]
        });
        g.market.injectEvent({
          t: t + Math.round(rng.range(5, 10)),
          text: `${tk.name} gives back early move; traders call it "fully priced"`,
          impacts: [{ scope: 'ticker', id: tip.sym, pct: rng.range(0.008, 0.016) * -dir, over: 0.2 }]
        });
      } else if (tip.outcome === 'reversal') {
        // Runs your way just long enough to get you to add, then turns.
        g.market.injectEvent({
          t: t + Math.round(rng.range(5, 12)), text: good,
          impacts: [{ scope: 'ticker', id: tip.sym, pct: rng.range(0.03, 0.05) * dir, over: 0.3 }]
        });
        g.market.injectEvent({
          t: t + Math.round(rng.range(20, 34)),
          text: tip.up
            ? `${tk.name} denies takeover report; shares reverse hard`
            : `${tk.name} says warning reports are "categorically false"; shares rip back`,
          impacts: [{ scope: 'ticker', id: tip.sym, pct: rng.range(0.06, 0.095) * -dir, over: 0.35 }],
          big: true
        });
      }
      // 'fake' fires nothing at all.
    }

    answer() {
      const a = this.active, g = this.g;
      if (!a || a.state !== 'ringing') return;
      const t = g.market.t;
      a.state = 'open';
      this.ringing = false;
      if (a.kind === 'choice') a.choiceEnd = t + this.realMin(a.timer || 20);
      else a.openEnd = t + this.realMin(9);

      if (a.kind === 'boss') {
        const pnl = g.broker.equity() - g.broker.dayStartEquity;
        if (pnl < 0) { a.text = `You're down ${B.fmt.money(-pnl)} on the day. I don't pay you to lose money. Fix it. NOW.`; g.stress.spike(5); }
        else if (g.quota > 0 && pnl < g.quota) { a.text = `You're ${B.fmt.money(g.quota - pnl)} short of quota. Clock's ticking, hotshot.`; g.stress.spike(3); }
        else { a.text = `Up ${B.fmt.money(pnl)}. Nice. Don't get cocky, it's not five o'clock yet.`; g.stress.spike(-4); }
      } else if (a.kind === 'tip') {
        this.fireTip(a.tip, t);
      } else if (a.kind === 'client') {
        const task = Object.assign({ id: 'task' + t, done: false, deadline: t + this.realMin(22) }, a.task);
        task.label = `${task.side} ${B.fmt.qty(task.qty)} ${task.sym}`;
        this.tasks.push(task);
        B.UI.renderTasks(this.tasks);
      } else if (a.kind === 'family') {
        g.stress.spike(2);
      }
      if (a.onAnswer) a.onAnswer(g);
      B.UI.phoneOpen(a);
    }

    miss() {
      const a = this.active, g = this.g;
      this.ringing = false;
      g.stress.spike(6);
      if (a.kind === 'choice') {
        B.UI.toast(`Missed call from ${a.from}. They decided for you.`, 'bad');
        a.state = 'open';
        this.resolveChoice(a.defaultOpt, true);
        return;
      }
      if (g.mode.onMissedCall) g.mode.onMissedCall(g, a);
      B.UI.toast(`Missed call: ${a.from}`, 'warn');
      this.active = null;
      B.UI.phoneHide();
    }

    resolveChoice(optId, timedOut) {
      const a = this.active;
      if (!a || a.kind !== 'choice' || a.state === 'done') return;
      a.state = 'done';
      const reply = this.g.mode.resolveMidChoice(this.g, a.choiceId, optId, timedOut);
      this.active = null;
      B.UI.phoneHide();
      if (reply) B.UI.inbox({ from: a.from, text: reply });
    }

    hangup() {
      this.active = null;
      this.ringing = false;
      B.UI.phoneHide();
    }

    executeTask(id) {
      const g = this.g;
      const task = this.tasks.find((x) => x.id === id);
      if (!task || task.done) return;
      const bad = g.act() || (g.market.isHalted(task.sym) ? task.sym + ' is halted' : null);
      if (bad) { B.UI.toast(bad, 'bad'); B.SFX.reject(); return; }
      task.done = true;
      g.broker.cash += task.fee;
      g.stress.spike(-3);
      B.SFX.cash();
      B.UI.toast(`Client order worked: ${task.label}. Commission +${B.fmt.money(task.fee)}`, 'good');
      if (g.mode.onTaskDone) g.mode.onTaskDone(g, task);
      B.UI.renderTasks(this.tasks);
    }

    // ---- save/restore (see js/core/save.js) ----
    serialize() {
      return {
        queue: this.queue,
        active: this.active,
        ringing: this.ringing,
        tasks: this.tasks,
        tipsActed: this.tipsActed,
        rng: this.rng ? this.rng.getState() : null
      };
    }

    restore(s) {
      if (!s) return;
      this.queue = s.queue || [];
      this.tasks = s.tasks || [];
      this.tipsActed = s.tipsActed || 0;
      if (this.rng && s.rng) this.rng.setState(s.rng);
      // A call that was mid-ring when you saved goes back on the queue rather than
      // resuming mid-animation, except a story choice, which must not be lost.
      const a = s.active;
      this.active = null;
      this.ringing = false;
      if (a && a.state !== 'done') {
        if (a.kind === 'choice') this.queue.unshift(Object.assign({}, a, { state: null, ringEnd: 0, t: this.g.market.t }));
        else if (a.scripted) this.queue.unshift(Object.assign({}, a, { state: null, ringEnd: 0, t: this.g.market.t + 2 }));
      }
      this.queue.sort((x, y) => x.t - y.t);
      B.UI.renderTasks(this.tasks);
    }
  }

  B.Interrupts = Interrupts;
})(window.BTB);
