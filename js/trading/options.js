// Simplified Black-Scholes pricing for listed calls/puts. Long-only in-game.
(function (B) {
  'use strict';
  const R = 0.03;

  function ncdf(x) {
    // Abramowitz & Stegun 26.2.17
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  function bs(S, K, T, v, type) {
    if (T <= 1e-6 || v <= 0) return Math.max(0, type === 'C' ? S - K : K - S);
    const sq = v * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (R + v * v / 2) * T) / sq;
    const d2 = d1 - sq;
    if (type === 'C') return S * ncdf(d1) - K * Math.exp(-R * T) * ncdf(d2);
    return K * Math.exp(-R * T) * ncdf(-d2) - S * ncdf(-d1);
  }

  function niceStep(x) {
    const steps = [0.5, 1, 2.5, 5, 10, 25, 50];
    for (const s of steps) if (x <= s) return s;
    return 100;
  }

  B.Options = {
    ncdf, bs,
    annVol(market, sym) {
      const tk = market.bySym[sym];
      const mv = (market.regime || B.REGIMES.chop).vol;
      const sv = (B.SECTORS[tk.sector] || {}).vol || 0;
      const d = Math.sqrt(Math.pow(tk.beta * mv, 2) + sv * sv + tk.vol * tk.vol) * market.volMult;
      return Math.max(0.12, d * Math.sqrt(252));
    },
    iv(market, sym) {
      return this.annVol(market, sym) * Math.pow(market.fearMult(), 0.8) * 1.1;
    },
    T(market, expiry) {
      return Math.max((expiry - market.day) + (1 - market.t / B.DAY_MIN), 0.0001) / 252;
    },
    mid(market, o) {
      const S = market.bySym[o.sym].last;
      if (market.day > o.expiry) return Math.max(0, o.type === 'C' ? S - o.strike : o.strike - S);
      return bs(S, o.strike, this.T(market, o.expiry), this.iv(market, o.sym), o.type);
    },
    quote(market, sym, type, strike, expiry) {
      const mid = this.mid(market, { sym, type, strike, expiry });
      const sp = Math.max(0.02, mid * 0.035) * Math.min(2.5, market.fearMult());
      return { mid, bid: Math.max(0, mid - sp / 2), ask: mid + sp / 2 };
    },
    strikes(price) {
      const step = niceStep(price * 0.025);
      const atm = Math.round(price / step) * step;
      const out = [];
      for (let i = -3; i <= 3; i++) {
        const k = +(atm + i * step).toFixed(2);
        if (k > 0) out.push(k);
      }
      return out;
    },
    expiries(day, lastDay) {
      const dow = day % 5;
      let weekly = day + (4 - dow);
      let monthly = weekly + 15;
      if (lastDay != null && isFinite(lastDay)) {
        weekly = Math.min(weekly, lastDay);
        monthly = Math.min(monthly, lastDay);
      }
      const list = [{ day: weekly, label: 'Wkly ' + B.Calendar.dayInfo(weekly).short }];
      if (monthly !== weekly) list.push({ day: monthly, label: 'Mthly ' + B.Calendar.dayInfo(monthly).short });
      return list;
    },
    label(o) {
      return `${o.sym} ${B.Calendar.dayInfo(o.expiry).short} ${o.strike}${o.type}`;
    }
  };
})(window.BTB);
