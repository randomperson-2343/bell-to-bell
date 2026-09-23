// The brokerage account: orders, positions, margin, fees, liquidation.
(function (B) {
  'use strict';
  let OID = 1;
  const SL_MAX = 95;
  const TP_MAX = 500;
  const err = (msg) => ({ ok: false, msg });

  function bracketValues(slPct, tpPct) {
    const sl = Number(slPct) || 0;
    const tp = Number(tpPct) || 0;
    if (sl < 0 || sl > SL_MAX) return err(`Stop-loss must be between 0% and ${SL_MAX}%`);
    if (tp < 0 || tp > TP_MAX) return err(`Take-profit must be between 0% and ${TP_MAX}%`);
    return { ok: true, sl, tp };
  }

  class Broker {
    constructor(o) {
      this.cash = o.cash;
      this.feeMult = o.feeMult == null ? 1 : o.feeMult;
      this.slipMult = o.slipMult == null ? 1 : o.slipMult;
      this.maintStrict = o.maintStrict == null ? 1 : o.maintStrict;
      this.pos = {};     // sym -> { qty, avg, realized }
      this.opts = [];    // { id, sym, type, strike, expiry, qty, avg }
      this.orders = [];  // { id, sym, qty, type, price, group, bracket, label }
      this.rules = { maxLev: 4, overnightLev: 2, shortBan: [], locked: null };
      this.mc = null;
      this.trades = [];
      this.fees = 0;
      this.dayStartEquity = o.cash;
      this.dayPeak = o.cash;
      this.market = null;
    }

    attach(market) { this.market = market; }

    // ---- valuation ----
    stockValue() {
      let v = 0;
      for (const s in this.pos) v += this.pos[s].qty * this.market.bySym[s].last;
      return v;
    }
    stockGross() {
      let v = 0;
      for (const s in this.pos) v += Math.abs(this.pos[s].qty * this.market.bySym[s].last);
      return v;
    }
    optValue() {
      let v = 0;
      for (const o of this.opts) v += o.qty * 100 * B.Options.mid(this.market, o);
      return v;
    }
    equity() { return this.cash + this.stockValue() + this.optValue(); }
    // Equity available to back stock exposure (options are paid in full, so excluded).
    netLiq() { return this.equity() - this.optValue(); }
    requirement() { return this.stockGross() / this.rules.maxLev; }
    maintenance() { return this.requirement() * 0.6 * this.maintStrict; }
    excess() { return this.netLiq() - this.requirement(); }
    buyingPower() { return Math.max(0, this.excess() * this.rules.maxLev); }
    leverage() { const e = this.equity(); return e > 0 ? this.stockGross() / e : 99; }
    isFlat() { return Object.keys(this.pos).length === 0 && this.opts.length === 0; }
    posQty(sym) { return this.pos[sym] ? this.pos[sym].qty : 0; }
    unrealized(sym) {
      const p = this.pos[sym];
      return p ? (this.market.bySym[sym].last - p.avg) * p.qty : 0;
    }
    commission(qty) { return Math.max(1, 0.005 * Math.abs(qty)) * this.feeMult; }

    // Largest order (shares) that would still fit in buying power.
    maxQty(sym, side) {
      const tk = this.market.bySym[sym];
      const cur = this.posQty(sym);
      const closable = side > 0 ? Math.max(0, -cur) : Math.max(0, cur);
      const bp = this.buyingPower();
      return Math.max(0, Math.floor(closable + bp / (tk.last * 1.003)));
    }

    // ---- trading ----
    check(sym) {
      const m = this.market;
      if (this.rules.locked) return this.rules.locked;
      if (m.status !== 'open') return 'Market is closed';
      if (m.halt) return 'Market-wide trading HALT';
      if (m.isHalted(sym)) return sym + ' is HALTED';
      return null;
    }

    marketOrder(sym, qty, o) {
      o = o || {};
      qty = Math.trunc(qty);
      if (!qty) return err('Size is zero');
      const m = this.market;
      const tk = m.bySym[sym];
      if (!tk) return err('Unknown symbol');
      // Forced orders (liquidations, brackets) ignore account locks but never halts.
      const bad = this.check(sym);
      if (bad && !(o.forced && bad === this.rules.locked)) return err(bad);

      const cur = this.posQty(sym);
      const nq = cur + qty;
      if (!o.forced && nq < 0 && nq < cur && this.rules.shortBan.includes(tk.sector)) {
        return err('Short-sale BAN on ' + B.SECTORS[tk.sector].name.toLowerCase());
      }
      const q = m.quote(sym);
      let price;
      if (o.limitPx) {
        price = qty > 0 ? Math.min(o.limitPx, q.ask) : Math.max(o.limitPx, q.bid);
      } else {
        price = qty > 0 ? q.ask : q.bid;
        // Market impact: grows with sqrt(size), scaled by the name's liquidity and by panic.
        const liq = (tk.spread || 0.0006) / 0.0006;
        const impact = 0.0012 * liq * Math.sqrt(Math.abs(qty) * price / 1e6) * m.fearMult() * this.slipMult;
        price *= qty > 0 ? (1 + Math.min(impact, 0.03)) : (1 - Math.min(impact, 0.03));
      }
      if (!o.forced && Math.abs(nq) > Math.abs(cur)) {
        const newGross = this.stockGross() - Math.abs(cur) * tk.last + Math.abs(nq) * tk.last;
        if (newGross / this.rules.maxLev > this.netLiq() + 1e-6) return err('Insufficient buying power');
      }
      const fill = this.fill(sym, qty, price, o.tag);
      return { ok: true, price, qty, realized: fill.realized };
    }

    fill(sym, qty, price, tag) {
      const p = this.pos[sym] || (this.pos[sym] = { qty: 0, avg: 0, realized: 0 });
      const opens = Math.abs(p.qty + qty) > Math.abs(p.qty);
      const comm = this.commission(qty);
      this.cash -= qty * price + comm;
      this.fees += comm;
      let realized = 0;
      if (p.qty === 0 || Math.sign(p.qty) === Math.sign(qty)) {
        p.avg = (p.avg * Math.abs(p.qty) + price * Math.abs(qty)) / (Math.abs(p.qty) + Math.abs(qty));
        p.qty += qty;
      } else {
        const closeQ = Math.min(Math.abs(qty), Math.abs(p.qty));
        realized = (price - p.avg) * closeQ * Math.sign(p.qty);
        p.realized += realized;
        const rem = Math.abs(qty) - closeQ;
        p.qty += qty;
        if (p.qty === 0) p.avg = 0;
        else if (rem > 0) p.avg = price;
      }
      realized -= comm;
      const tr = { t: this.market.t, day: this.market.day, sym, qty, price, realized, tag: tag || '' };
      if (opens) tr.open = true;
      this.trades.push(tr);
      if (p.qty === 0) {
        delete this.pos[sym];
        this.orders = this.orders.filter((x) => !(x.bracket && x.sym === sym));
      }
      B.bus.emit('fill', tr);
      return tr;
    }

    placeOrder(sym, qty, type, price, extra) {
      qty = Math.trunc(qty);
      if (!qty) return err('Size is zero');
      if (!(price > 0)) return err('Enter a valid price');
      if (this.rules.locked) return err(this.rules.locked);
      const tk = this.market.bySym[sym];
      const cur = this.posQty(sym);
      if (cur + qty < 0 && cur + qty < cur && this.rules.shortBan.includes(tk.sector)) {
        return err('Short-sale BAN on ' + B.SECTORS[tk.sector].name.toLowerCase());
      }
      const o = Object.assign({ id: OID++, sym, qty, type, price }, extra || {});
      this.orders.push(o);
      return { ok: true, order: o };
    }

    cancelOrder(id) { this.orders = this.orders.filter((o) => o.id !== id); }

    // Attach stop-loss / take-profit (OCO) to the current position.
    attachBracket(sym, slPct, tpPct) {
      this.orders = this.orders.filter((o) => !(o.bracket && o.sym === sym));
      const p = this.pos[sym];
      if (!p) return { ok: false, msg: 'No position in ' + sym };
      // Defense in depth for saves, debug calls and programmatic callers.
      const sl = B.clamp(Number(slPct) || 0, 0, SL_MAX);
      const tp = B.clamp(Number(tpPct) || 0, 0, TP_MAX);
      const side = Math.sign(p.qty);
      const group = 'g' + (OID++);
      if (sl > 0) this.orders.push({ id: OID++, sym, qty: -p.qty, type: 'stop', price: +Math.max(0.01, p.avg * (1 - side * sl / 100)).toFixed(2), bracket: true, group, label: 'STOP-LOSS' });
      if (tp > 0) this.orders.push({ id: OID++, sym, qty: -p.qty, type: 'limit', price: +Math.max(0.01, p.avg * (1 + side * tp / 100)).toFixed(2), bracket: true, group, label: 'TAKE-PROFIT' });
      return { ok: true, sl, tp, group };
    }

    processOrders() {
      const m = this.market;
      if (m.status !== 'open' || m.halt) return [];
      const done = [];
      for (const o of this.orders.slice()) {
        if (!this.orders.includes(o)) continue;
        if (m.isHalted(o.sym)) continue;
        if (this.rules.locked && !o.bracket) continue;
        const q = m.quote(o.sym);
        let qty = o.qty;
        if (o.bracket) {
          const cur = this.posQty(o.sym);
          if (!cur) { this.cancelOrder(o.id); continue; }
          qty = -cur;
        }
        const buy = qty > 0;
        let trig;
        if (o.type === 'limit') trig = buy ? q.ask <= o.price : q.bid >= o.price;
        else trig = buy ? q.ask >= o.price : q.bid <= o.price;
        if (!trig) continue;
        const res = this.marketOrder(o.sym, qty, { tag: o.label || (o.type === 'limit' ? 'LIMIT' : 'STOP'), limitPx: o.type === 'limit' ? o.price : null, forced: !!o.bracket });
        this.cancelOrder(o.id);
        if (res.ok) {
          if (o.group) this.orders = this.orders.filter((x) => x.group !== o.group);
          if (!o.bracket && o.protect && this.posQty(o.sym)) this.attachBracket(o.sym, o.protect.sl, o.protect.tp);
          done.push({ order: o, res });
        } else {
          done.push({ order: o, res, rejected: true });
        }
      }
      return done;
    }

    closePosition(sym, frac, tag) {
      const cur = this.posQty(sym);
      if (!cur) return err('No position in ' + sym);
      let q = -cur;
      if (frac && frac < 1) q = -Math.trunc(cur * frac) || -Math.sign(cur);
      return this.marketOrder(sym, q, { tag: tag || 'CLOSE' });
    }

    flattenAll(tag, forced) {
      const results = [];
      for (const s of Object.keys(this.pos)) results.push(this.marketOrder(s, -this.pos[s].qty, { tag: tag || 'FLATTEN', forced }));
      for (const o of this.opts.slice()) results.push(this.sellOption(o.id, o.qty, forced));
      this.orders = [];
      return results;
    }

    // ---- options ----
    buyOption(sym, type, strike, expiry, n) {
      n = Math.trunc(n);
      if (n <= 0) return err('Contracts must be > 0');
      const bad = this.check(sym);
      if (bad) return err(bad);
      const q = B.Options.quote(this.market, sym, type, strike, expiry);
      const comm = 0.65 * n * this.feeMult;
      const cost = n * 100 * q.ask + comm;
      if (cost > this.excess()) return err('Insufficient buying power (options are paid in full)');
      this.cash -= cost;
      this.fees += comm;
      let o = this.opts.find((x) => x.sym === sym && x.type === type && x.strike === strike && x.expiry === expiry);
      if (o) {
        o.avg = (o.avg * o.qty + q.ask * n) / (o.qty + n);
        o.qty += n;
      } else {
        o = { id: OID++, sym, type, strike, expiry, qty: n, avg: q.ask };
        this.opts.push(o);
      }
      const tr = { t: this.market.t, day: this.market.day, sym: B.Options.label(o), qty: n, price: q.ask, realized: -comm, tag: 'OPT BUY', opt: true, open: true };
      this.trades.push(tr);
      B.bus.emit('fill', tr);
      return { ok: true, price: q.ask };
    }

    sellOption(id, n, forced) {
      const o = this.opts.find((x) => x.id === id);
      if (!o) return err('No such option');
      const bad = this.check(o.sym);
      if (bad && !(forced && bad === this.rules.locked)) return err(bad);
      n = Math.min(o.qty, Math.trunc(n || o.qty));
      const q = B.Options.quote(this.market, o.sym, o.type, o.strike, o.expiry);
      const comm = 0.65 * n * this.feeMult;
      this.cash += n * 100 * q.bid - comm;
      this.fees += comm;
      const realized = (q.bid - o.avg) * n * 100 - comm;
      o.qty -= n;
      if (o.qty <= 0) this.opts = this.opts.filter((x) => x !== o);
      const tr = { t: this.market.t, day: this.market.day, sym: B.Options.label(o), qty: -n, price: q.bid, realized, tag: 'OPT SELL', opt: true };
      this.trades.push(tr);
      B.bus.emit('fill', tr);
      return { ok: true, price: q.bid, realized };
    }

    // ---- risk ----
    checkMargin(t) {
      const ev = [];
      const eq = this.equity();
      if (eq <= 0 && !this.isFlat()) {
        this.flattenAll('WIPED OUT', true);
        this.mc = null;
        ev.push({ type: 'wiped' });
        return ev;
      }
      if (this.stockGross() > 0 && this.netLiq() < this.maintenance()) {
        if (!this.mc) {
          this.mc = { start: t, deadline: t + 30 };
          if (this.dayRisk) this.dayRisk.mc++;
          ev.push({ type: 'mc' });
        } else if (t >= this.mc.deadline) {
          if (this.liquidateForMargin()) {
            this.mc = null;
            if (this.dayRisk) this.dayRisk.liq++;
            ev.push({ type: 'liq' });
          }
        }
      } else if (this.mc) {
        this.mc = null;
        ev.push({ type: 'mcClear' });
      }
      return ev;
    }

    // Worst positions first until back under the initial requirement.
    liquidateForMargin() {
      const m = this.market;
      if (m.status !== 'open' || m.halt) return false;
      for (const o of this.opts.slice()) this.sellOption(o.id, o.qty, true);
      const syms = Object.keys(this.pos).sort((a, b) => this.unrealized(a) - this.unrealized(b));
      for (const s of syms) {
        if (this.netLiq() >= this.requirement() * 1.0 && this.netLiq() >= this.maintenance()) break;
        if (m.isHalted(s)) continue;
        this.marketOrder(s, -this.pos[s].qty, { tag: 'LIQUIDATION', forced: true });
      }
      return true;
    }

    startDay() {
      this.dayStartEquity = this.equity();
      this.dayPeak = this.dayStartEquity;
      this.dayTradeStart = this.trades.length;
      this.dayFeesStart = this.fees;
      this.mc = null;
      this.dayRisk = { trough: this.dayStartEquity, breachT: null, mc: 0, liq: 0, peakLev: 0 };
    }

    // Intraday risk tape for the risk desk review: the day's low, the minute
    // the daily loss limit was first hit, and the most leverage carried.
    trackRisk(t, lossLimit) {
      const r = this.dayRisk;
      if (!r) return;
      const eq = this.equity();
      if (eq < r.trough) r.trough = eq;
      if (r.breachT == null && lossLimit > 0 && eq <= this.dayStartEquity * (1 - lossLimit)) r.breachT = t;
      const lev = this.leverage();
      if (lev < 99 && lev > r.peakLev) r.peakLev = lev;
    }

    // Close-of-day bookkeeping. Market must already be closed.
    endOfDay(day) {
      const m = this.market;
      const out = { forced: [], borrow: 0, interest: 0, expired: [] };
      // Overnight margin: forced reduction at the close price.
      const need = () => this.stockGross() / this.rules.overnightLev;
      if (need() > this.netLiq()) {
        const syms = Object.keys(this.pos).sort((a, b) => this.unrealized(a) - this.unrealized(b));
        for (const s of syms) {
          if (need() <= this.netLiq()) break;
          const p = this.pos[s];
          const px = m.bySym[s].last * (p.qty > 0 ? 0.997 : 1.003);
          out.forced.push(s);
          this.fill(s, -p.qty, px, 'OVERNIGHT MARGIN');
        }
      }
      // Short borrow fees, margin interest.
      for (const s in this.pos) {
        const p = this.pos[s];
        if (p.qty < 0) {
          const tk = m.bySym[s];
          const fee = Math.abs(p.qty * tk.last) * tk.borrow * Math.min(3, m.fearMult()) / 252;
          out.borrow += fee;
        }
      }
      if (this.cash < 0) out.interest = -this.cash * 0.08 / 252;
      this.cash -= out.borrow + out.interest;
      this.fees += out.borrow + out.interest;
      // Option expiry: cash-settled at intrinsic.
      for (const o of this.opts.slice()) {
        if (o.expiry <= day) {
          const S = m.bySym[o.sym].last;
          const intr = Math.max(0, o.type === 'C' ? S - o.strike : o.strike - S);
          this.cash += intr * 100 * o.qty;
          const realized = (intr - o.avg) * 100 * o.qty;
          out.expired.push({ label: B.Options.label(o), intr, realized });
          this.trades.push({ t: B.DAY_MIN, day, sym: B.Options.label(o), qty: -o.qty, price: intr, realized, tag: 'EXPIRED', opt: true });
          this.opts = this.opts.filter((x) => x !== o);
        }
      }
      // Day orders expire; brackets are good-til-cancelled.
      this.orders = this.orders.filter((o) => o.bracket);
      this.mc = null;
      return out;
    }

    dayTrades() { return this.trades.slice(this.dayTradeStart || 0); }

    // Between-day state: what survives the closing bell.
    serialize() {
      return { cash: this.cash, pos: this.pos, opts: this.opts, orders: this.orders.filter((o) => o.bracket), fees: this.fees, feeMult: this.feeMult, slipMult: this.slipMult, maintStrict: this.maintStrict, oid: OID };
    }

    // Everything, including the half-finished session: working orders, today's
    // trade blotter, the running margin call. Used by mid-day saves.
    serializeFull() {
      return Object.assign(this.serialize(), {
        full: true,
        orders: this.orders,
        trades: this.trades,
        dayStartEquity: this.dayStartEquity,
        dayPeak: this.dayPeak,
        dayTradeStart: this.dayTradeStart || 0,
        dayFeesStart: this.dayFeesStart || 0,
        mc: this.mc,
        dayRisk: this.dayRisk || null,
        rules: { maxLev: this.rules.maxLev, overnightLev: this.rules.overnightLev, shortBan: this.rules.shortBan, locked: this.rules.locked }
      });
    }

    restore(o) {
      this.cash = o.cash;
      this.pos = o.pos || {};
      this.opts = o.opts || [];
      this.orders = o.orders || [];
      this.fees = o.fees || 0;
      OID = Math.max(OID, o.oid || 1);
      if (!o.full) return;
      this.trades = o.trades || [];
      this.dayStartEquity = o.dayStartEquity;
      this.dayPeak = o.dayPeak;
      this.dayTradeStart = o.dayTradeStart || 0;
      this.dayFeesStart = o.dayFeesStart || 0;
      this.mc = o.mc || null;
      this.dayRisk = o.dayRisk || { trough: o.dayStartEquity, breachT: null, mc: 0, liq: 0, peakLev: 0 };
      if (o.rules) Object.assign(this.rules, o.rules);
    }
  }

  Broker.SL_MAX = SL_MAX;
  Broker.TP_MAX = TP_MAX;
  Broker.validateBracket = bracketValues;

  B.Broker = Broker;
})(window.BTB);
