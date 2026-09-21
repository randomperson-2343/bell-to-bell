// Price simulation.
// Every price = prevClose * exp(beta*Market + Sector + Idiosyncratic).
// Each factor tracks an "anchor" path (a seeded Brownian bridge from the
// day's gap to its target close) plus news shocks, with a little noise on top.
// Scenarios therefore control roughly where a day ends while the path stays tradable.
(function (B) {
  'use strict';
  const DAY = B.DAY_MIN;
  const lr = (p) => Math.log(Math.max(0.001, 1 + p));

  // Intraday volatility: wild open, sleepy lunch, busy close.
  function curve(t) {
    if (t < 30) return 1.8 - 0.8 * (t / 30);
    if (t > 360) return 1.0 + 0.6 * ((t - 360) / 30);
    if (t > 150 && t < 270) return 0.75;
    return 1.0;
  }

  class Factor {
    constructor(rng, spec, volMult) {
      this.gap = spec.gap || 0;
      this.target = spec.target || 0;
      this.vol = (spec.vol == null ? 0.01 : spec.vol) * volMult;
      this.x = this.gap;
      this.shocks = [];
      this.step = 10;
      const n = DAY / this.step;
      const ws = [0];
      let w = 0;
      for (let i = 1; i <= n; i++) {
        w += rng.normal() * this.vol * Math.sqrt(this.step / DAY) * curve(i * this.step - 5);
        ws.push(w);
      }
      this.keys = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        this.keys.push(this.gap + (this.target - this.gap) * f + ws[i] - f * ws[n]);
      }
    }
    anchor(t) {
      const i = Math.min(Math.floor(t / this.step), this.keys.length - 2);
      const f = (t - i * this.step) / this.step;
      let a = this.keys[i] * (1 - f) + this.keys[i + 1] * f;
      for (const s of this.shocks) {
        if (t >= s.t) a += s.v * (1 + s.over * Math.exp(-(t - s.t) / 12));
      }
      return a;
    }
    addShock(t, v, over) {
      this.shocks.push({ t, v, over: over || 0 });
      this.x += v * 0.7; // most of the move is instant; the rest follows in minutes
    }
    update(t, dt, rng) {
      const a = this.anchor(t);
      this.x += 0.18 * (a - this.x) * dt +
        rng.normal() * this.vol / Math.sqrt(DAY) * 0.9 * curve(t) * Math.sqrt(dt);
    }
  }

  class Market {
    constructor(opts) {
      this.seed = String(opts.seed || 'btb');
      this.volMult = opts.volMult || 1;
      this.tickers = B.TICKERS.map((d) => Object.assign({}, d));
      this.bySym = {};
      for (const tk of this.tickers) {
        this.bySym[tk.sym] = tk;
        tk.last = tk.open = tk.high = tk.low = tk.prevClose = tk.price;
        tk.candles = [];
        tk.prevCandles = [];
        tk.haltUntil = -1;
        tk.luldCool = 0;
      }
      this.fearLevel = this.bySym.FEAR.price;
      this.t = 0;
      this.day = -1;
      this.status = 'pre';
      this.halt = null;
      this.scen = { regime: 'bull' };
    }

    startDay(day, scen) {
      this.day = day;
      this.scen = scen;
      this.t = 0;
      this.status = 'open';
      this.halt = null;
      this.breakers = { l1: false, l2: false, l3: false };
      this.rng = B.RNG(B.hashSeed(this.seed + '|' + day + '|' + (scen.salt || '')));
      const reg = B.REGIMES[scen.regime] || B.REGIMES.chop;
      this.regime = reg;

      this.M = new Factor(this.rng, Object.assign({ vol: reg.vol, target: 0, gap: 0 }, scen.market), this.volMult);
      this.S = {};
      for (const k in B.SECTORS) {
        if (k === 'index' || k === 'fear') continue;
        const spec = Object.assign({ vol: B.SECTORS[k].vol, target: 0, gap: 0 }, (scen.sectors || {})[k]);
        this.S[k] = new Factor(this.rng, spec, this.volMult);
      }
      this.I = {};
      for (const tk of this.tickers) {
        tk.prevClose = tk.last;
        if (tk.candles.length) tk.prevCandles = tk.candles;
        tk.candles = [];
        tk.haltUntil = -1;
        tk.luldCool = 0;
        tk.resumed = false;
        if (tk.sector === 'fear') continue;
        const spec = Object.assign({ vol: tk.vol, target: 0, gap: 0 }, (scen.tickers || {})[tk.sym]);
        this.I[tk.sym] = new Factor(this.rng, spec, this.volMult);
      }
      this.fearBase = scen.fearBase || reg.fear;
      const fg = Math.log(Math.max(8, this.fearLevel) / this.fearBase);
      this.fearN = new Factor(this.rng, { vol: 0.05, gap: fg, target: fg * 0.5 }, 1);

      this.events = (scen.events || []).map((e) => Object.assign({ fired: false, rumorFired: false }, e)).sort((a, b) => a.t - b.t);
      for (const h of scen.halts || []) {
        const tk = this.bySym[h.sym];
        if (tk) tk.haltUntil = Math.max(tk.haltUntil, (h.t || 0) + h.dur);
      }

      this.computePrices(true);
      for (const tk of this.tickers) {
        tk.open = tk.high = tk.low = tk.last;
        tk.candles.push({ o: tk.last, h: tk.last, l: tk.last, c: tk.last });
      }
    }

    priceFor(tk) {
      if (tk.sector === 'index') return tk.prevClose * Math.exp(this.M.x + this.I[tk.sym].x);
      if (tk.sector === 'fear') return B.clamp(this.fearBase * Math.exp(this.fearN.x - 9 * this.M.x), 9, 95);
      const s = this.S[tk.sector];
      return Math.max(0.05, tk.prevClose * Math.exp(tk.beta * this.M.x + (s ? s.x : 0) + this.I[tk.sym].x));
    }

    computePrices(force) {
      for (const tk of this.tickers) {
        if (!force && tk.haltUntil > this.t) continue; // halted names freeze on screen
        tk.last = this.priceFor(tk);
        if (tk.last > tk.high) tk.high = tk.last;
        if (tk.last < tk.low) tk.low = tk.last;
      }
    }

    applyEvent(e, t) {
      for (const im of e.impacts || []) {
        const f = im.scope === 'market' ? this.M : im.scope === 'sector' ? this.S[im.id] : this.I[im.id];
        if (f) f.addShock(t, lr(im.pct), im.over);
        // Liquidity dries up around news: spreads blow out on the names it hits.
        for (const tk of this.tickers) {
          if (im.scope === 'market' || (im.scope === 'sector' && tk.sector === im.id) || tk.sym === im.id) tk.newsUntil = t + 4;
        }
      }
      if (e.halt) {
        const tk = this.bySym[e.halt.sym];
        if (tk) tk.haltUntil = Math.max(tk.haltUntil, t + e.halt.dur);
      }
    }

    injectEvent(e) {
      this.events.push(Object.assign({ fired: false, rumorFired: false }, e));
      this.events.sort((a, b) => a.t - b.t);
    }

    // Advance dt game-minutes. Returns a list of things that happened.
    step(dt) {
      const out = [];
      if (this.status !== 'open') return out;
      const t1 = Math.min(DAY, this.t + dt);

      if (this.halt) {
        if (t1 >= this.halt.until) {
          out.push({ type: 'haltEnd', level: this.halt.level });
          this.halt = null;
        } else {
          this.t = t1;
          this.touchCandles();
          return out;
        }
      }

      for (const e of this.events) {
        if (e.rumor && !e.rumorFired && t1 >= e.t - e.rumor.lead) {
          e.rumorFired = true;
          out.push({ type: 'news', kind: 'chirp', text: e.rumor.text, src: e.rumor.src, t: t1 });
        }
        if (!e.fired && t1 >= e.t) {
          e.fired = true;
          this.applyEvent(e, t1);
          if (e.text) out.push({ type: 'news', kind: e.kind || 'wire', text: e.text, src: e.src, t: t1, big: !!e.big, tone: e.tone });
          if (e.script) out.push({ type: 'script', id: e.script, t: t1 });
        }
      }

      this.M.update(t1, dt, this.rng);
      for (const k in this.S) this.S[k].update(t1, dt, this.rng);
      for (const k in this.I) this.I[k].update(t1, dt, this.rng);
      this.fearN.update(t1, dt, this.rng);
      this.t = t1;
      this.computePrices();

      // Single-stock halts (limit up/limit down): >10% in 5 minutes.
      const idx = Math.floor(this.t);
      for (const tk of this.tickers) {
        if (tk.sector === 'index' || tk.sector === 'fear') continue;
        if (tk.haltUntil > this.t) continue;
        if (tk.haltUntil > 0 && tk.haltUntil <= this.t && !tk.resumed) {
          tk.resumed = true;
          tk.luldCool = this.t + 5;
          out.push({ type: 'luldEnd', sym: tk.sym });
        }
        if (this.t < tk.luldCool) continue;
        const ref = tk.candles[Math.max(0, idx - 5)];
        if (ref && Math.abs(tk.last / ref.c - 1) > 0.10) {
          tk.haltUntil = this.t + 5;
          tk.resumed = false;
          out.push({ type: 'luld', sym: tk.sym, dir: tk.last > ref.c ? 1 : -1 });
        }
      }

      // Market-wide circuit breakers.
      const ix = this.bySym.INDX;
      const d = ix.last / ix.prevClose - 1;
      if (d <= -0.20 && !this.breakers.l3) {
        this.breakers.l3 = true;
        this.status = 'closed';
        out.push({ type: 'breaker', level: 3 });
      } else if (d <= -0.13 && !this.breakers.l2 && this.t < 365) {
        this.breakers.l2 = true;
        this.halt = { level: 2, until: this.t + 15 };
        out.push({ type: 'breaker', level: 2 });
      } else if (d <= -0.07 && !this.breakers.l1 && this.t < 365) {
        this.breakers.l1 = true;
        this.halt = { level: 1, until: this.t + 15 };
        out.push({ type: 'breaker', level: 1 });
      }

      this.touchCandles();
      return out;
    }

    touchCandles() {
      const idx = Math.min(Math.floor(this.t), DAY - 1);
      for (const tk of this.tickers) {
        const c = tk.candles;
        while (c.length <= idx) {
          const p = c.length ? c[c.length - 1].c : tk.last;
          c.push({ o: p, h: p, l: p, c: p });
        }
        const cur = c[idx];
        cur.c = tk.last;
        if (tk.last > cur.h) cur.h = tk.last;
        if (tk.last < cur.l) cur.l = tk.last;
      }
    }

    close() {
      this.status = 'closed';
      this.fearLevel = this.bySym.FEAR.last;
    }

    fearMult() { return B.clamp(this.bySym.FEAR.last / 16, 0.6, 5); }

    isHalted(sym) {
      return !!this.halt || this.status !== 'open' || (this.bySym[sym] && this.bySym[sym].haltUntil > this.t);
    }

    quote(sym) {
      const tk = this.bySym[sym];
      const sp = (tk.spread || 0.0005) * this.fearMult() * (this.t < 5 ? 2 : 1) * (tk.newsUntil > this.t ? 4 : 1);
      return {
        sym, last: tk.last,
        bid: tk.last * (1 - sp / 2), ask: tk.last * (1 + sp / 2),
        prevClose: tk.prevClose, open: tk.open, high: tk.high, low: tk.low,
        chg: tk.last - tk.prevClose, chgPct: tk.last / tk.prevClose - 1,
        halted: this.isHalted(sym)
      };
    }

    indexMove(mins) {
      const ix = this.bySym.INDX;
      const ref = ix.candles[Math.max(0, Math.floor(this.t) - mins)];
      return ref ? ix.last / ref.c - 1 : 0;
    }

    indexDayPct() {
      const ix = this.bySym.INDX;
      return ix.last / ix.prevClose - 1;
    }

    serialize() {
      const px = {};
      for (const tk of this.tickers) px[tk.sym] = tk.last;
      return { seed: this.seed, volMult: this.volMult, fearLevel: this.fearLevel, px };
    }

    restore(o) {
      this.fearLevel = o.fearLevel;
      for (const tk of this.tickers) {
        if (o.px[tk.sym] != null) tk.last = tk.prevClose = tk.open = tk.high = tk.low = o.px[tk.sym];
      }
    }
  }

  B.Market = Market;
  B.lr = lr;
})(window.BTB);
