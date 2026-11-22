// Canvas candlestick chart for the selected ticker, with its own motion:
// the live price glides between ticks and pulses on each one, your fills land
// on the chart as markers, a big swing hits the plot with a wash, and the
// mouse gets a crosshair readout. Motion follows B.Motion.enabled() (the
// Screen effects setting and the OS reduce-motion preference); with motion
// off every one of those still shows, it just does not move.
(function (B) {
  'use strict';
  let cv, ctx, W = 0, H = 0, dpr = 1, MONO = 'monospace';
  // VT323 sits on its pixel grid at 12.5 canvas px (25 on a 2x screen), which
  // is the 10px CSS size with the cap-height adjustment the page applies.
  const MONO_PX = 12.5;
  const P = B.Pal;
  const PAD_R = 68, PAD_T = 12, PAD_B = 22;
  const now = () => performance.now();

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(50, Math.round(r.width));
    H = Math.max(50, Math.round(r.height));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }

  function aggregate(list, tf) {
    if (tf <= 1) return list.slice();
    const out = [];
    for (let i = 0; i < list.length; i += tf) {
      const chunk = list.slice(i, i + tf);
      let h = -Infinity, l = Infinity;
      for (const c of chunk) { if (c.h > h) h = c.h; if (c.l < l) l = c.l; }
      out.push({ o: chunk[0].o, h, l, c: chunk[chunk.length - 1].c });
    }
    return out;
  }

  // A dotted 1px line, in whole pixels.
  function hdots(y, x0, x1, gap) { for (let x = x0; x < x1; x += gap) ctx.fillRect(x, y, 1, 1); }
  function vdots(x, y0, y1, gap) { for (let y = y0; y < y1; y += gap) ctx.fillRect(x, y, 1, 1); }
  // A small pixel triangle, tip at (x, y), pointing up (dir 1) or down (dir -1), with an ink outline.
  function tri(x, y, dir, col) {
    const rows = [1, 3, 5, 7];
    ctx.fillStyle = P.ink;
    ctx.fillRect(x, y - dir, 1, 1);
    rows.forEach((w, i) => ctx.fillRect(x - (w >> 1) - 1, y + dir * i, w + 2, 1));
    ctx.fillRect(x - 4, y + dir * 4, 9, 1);
    ctx.fillStyle = col;
    rows.forEach((w, i) => ctx.fillRect(x - (w >> 1), y + dir * i, w, 1));
  }
  function tag(x, y, w, text, bg, fg, notch) {
    const h = 15, top = Math.round(y - h / 2);
    ctx.fillStyle = bg;
    ctx.fillRect(x, top, w, h);
    if (notch) for (let i = 0; i < 4; i++) ctx.fillRect(x - 1 - i, top + 3 + i, 1, h - 6 - i * 2);
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 4, top + 11);
  }

  B.Chart = {
    tf: 5,
    disp: {},       // sym -> the price the chart shows, gliding toward the last trade
    pulse: null,    // { sym, dir, at } the last tick
    lastSeen: {},   // sym -> last price seen, to notice ticks
    landing: [],    // fills that just landed: { tr, at }
    shockAt: null,  // { dir, level, at } a swing hit on the selected ticker
    hover: null,    // { x, y } mouse position in CSS px
    lastFrame: 0,

    init(canvas) {
      cv = canvas;
      ctx = cv.getContext('2d');
      const root = getComputedStyle(document.documentElement);
      MONO = root.getPropertyValue('--mono').trim() || 'monospace';
      // A resize clears the canvas; redraw straight away so a sliding drawer never shows a blank chart.
      const again = () => { resize(); if (this.last) this.draw(this.last.g, this.last.sym, 0); };
      if (window.ResizeObserver) new ResizeObserver(again).observe(cv);
      window.addEventListener('resize', resize);
      cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); this.hover = { x: e.clientX - r.left, y: e.clientY - r.top }; });
      cv.addEventListener('mouseleave', () => { this.hover = null; });
      resize();
    },

    moving() { return B.Motion ? B.Motion.enabled() : !!(B.Settings && B.Settings.motion()); },

    // A fill just happened (B.Tape forwards the broker's 'fill' event).
    land(tr) { this.landing.push({ tr, at: now() }); if (this.landing.length > 8) this.landing.shift(); },
    // A big move on the selected ticker.
    shock(dir, level) { this.shockAt = { dir, level, at: now() }; },
    reset() { this.disp = {}; this.lastSeen = {}; this.landing = []; this.shockAt = null; this.pulse = null; },

    draw(g, sym, jitter) {
      if (!ctx || !g) return;
      this.last = { g, sym };
      const cw = cv.getBoundingClientRect();
      if (Math.abs(cw.width - W) > 1 || Math.abs(cw.height - H) > 1) resize();
      const tk = g.market.bySym[sym];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!tk) return;
      const t = now(), dt = Math.min(0.1, (t - (this.lastFrame || t)) / 1000);
      this.lastFrame = t;
      const moving = this.moving();

      // The live price: a tick starts a pulse; the shown price glides to it.
      if (this.lastSeen[sym] !== tk.last) {
        if (this.lastSeen[sym] != null) this.pulse = { sym, dir: tk.last > this.lastSeen[sym] ? 1 : -1, at: t };
        this.lastSeen[sym] = tk.last;
      }
      let shown = this.disp[sym];
      if (shown == null || !moving || Math.abs(shown / tk.last - 1) > 0.02) shown = tk.last;
      else shown += (tk.last - shown) * (1 - Math.exp(-dt / 0.09));
      if (Math.abs(shown - tk.last) < tk.last * 1e-5) shown = tk.last;
      this.disp[sym] = shown;

      const tf = this.tf;
      const prev = aggregate(tk.prevCandles || [], tf);
      const cur = aggregate(tk.candles || [], tf);
      if (cur.length) {
        const lc = cur[cur.length - 1] = Object.assign({}, cur[cur.length - 1]);
        lc.c = shown; lc.h = Math.max(lc.h, shown); lc.l = Math.min(lc.l, shown);
      }
      const dayCount = Math.ceil(B.DAY_MIN / tf);
      const maxBars = tf === 1 ? 150 : tf === 5 ? dayCount + 20 : dayCount + 26;
      const prevShow = prev.slice(Math.max(0, prev.length - Math.max(0, maxBars - dayCount)));
      const bars = prevShow.concat(cur);
      const sepIdx = prevShow.length;
      const slots = tf === 1 ? 150 : prevShow.length + dayCount;
      const offset = tf === 1 ? Math.max(0, bars.length - slots) : 0;
      const view = bars.slice(offset);

      const plotW = W - PAD_R, plotH = H - PAD_T - PAD_B;
      let hi = -Infinity, lo = Infinity;
      for (const c of view) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
      const p = g.broker.pos[sym];
      if (tk.prevClose) { hi = Math.max(hi, tk.prevClose); lo = Math.min(lo, tk.prevClose); }
      if (p) { hi = Math.max(hi, p.avg); lo = Math.min(lo, p.avg); }
      if (!isFinite(hi)) { hi = tk.last * 1.01; lo = tk.last * 0.99; }
      const pad = (hi - lo) * 0.08 || tk.last * 0.005;
      hi += pad; lo -= pad;
      const jx = jitter ? Math.round((Math.random() - 0.5) * jitter) : 0;
      const jy = jitter ? Math.round((Math.random() - 0.5) * jitter) : 0;
      const y = (v) => PAD_T + (hi - v) / (hi - lo) * plotH + jy;
      const bw = plotW / slots;
      const x = (i) => i * bw + bw / 2 + jx;
      const barOfMinute = (min) => sepIdx + Math.floor(min / tf) - offset;
      ctx.font = MONO_PX + 'px ' + MONO;
      ctx.textBaseline = 'alphabetic';

      // Yesterday sits in a darker band, so today reads as the live part.
      const sx = tf !== 1 && sepIdx > 0 ? Math.round((sepIdx - offset) * bw) : 0;
      if (sx > 0) {
        ctx.fillStyle = P.screenD; ctx.globalAlpha = 0.45; ctx.fillRect(0, 0, sx, H - PAD_B); ctx.globalAlpha = 1;
      }
      // Grid: dotted price lines with their labels, dotted hour lines.
      const steps = Math.max(3, Math.min(6, Math.floor(plotH / 42)));
      const ly = Math.round(y(shown));
      for (let i = 0; i <= steps; i++) {
        const v = lo + (hi - lo) * (i / steps);
        const yy = Math.round(y(v));
        ctx.fillStyle = P.screenGlow; hdots(yy, 0, plotW, 3);
        ctx.fillStyle = P.slate; ctx.fillRect(plotW, yy, 3, 1);
        if (Math.abs(yy - ly) > 14) { ctx.fillStyle = P.grey2; ctx.fillText(B.fmt.price(v), plotW + 7, yy + 4); }
      }
      // The axis rail between plot and labels.
      ctx.fillStyle = P.slate; ctx.fillRect(plotW, 0, 1, H - PAD_B);
      ctx.fillStyle = P.slate; ctx.fillRect(0, H - PAD_B, W, 1);
      if (tf !== 1 && sepIdx > 0) {
        ctx.fillStyle = P.slate2; vdots(sx, PAD_T - 6, H - PAD_B, 2);
        ctx.fillStyle = P.grey; ctx.fillText('PREV', Math.max(3, sx - 30), H - 7);
        for (const hr of [0, 60, 120, 180, 240, 300, 360]) {
          const xi = Math.round((barOfMinute(hr)) * bw);
          if (hr) { ctx.fillStyle = P.screenGlow; vdots(xi, PAD_T, H - PAD_B, 3); }
          ctx.fillStyle = P.slate; ctx.fillRect(xi, H - PAD_B, 1, 3);
          if (hr % 120 === 0 || plotW > 560) {
            ctx.fillStyle = P.grey2;
            ctx.fillText(B.Calendar.fmtTime(hr).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p'), xi + 3, H - 7);
          }
        }
      }
      // Yesterday's close: a dashed line and a slate tag on the axis.
      if (tk.prevClose) {
        const yy = Math.round(y(tk.prevClose));
        ctx.fillStyle = P.slate2;
        for (let xx = 0; xx < plotW; xx += 8) ctx.fillRect(xx, yy, 4, 1);
      }

      // Candles. Up bars are hollow, down bars filled; the live bar is outlined in white.
      const cwid = Math.max(1, Math.round(bw * 0.7));
      for (let i = 0; i < view.length; i++) {
        const c = view[i];
        const isPrev = offset + i < sepIdx;
        const live = i === view.length - 1 && !isPrev;
        const upc = c.c >= c.o;
        const col = upc ? P.jade : P.crimson;
        ctx.globalAlpha = isPrev ? 0.38 : 1;
        const xx = Math.round(x(i));
        const yh = Math.round(y(c.h)), yl = Math.round(y(c.l));
        ctx.fillStyle = col; ctx.fillRect(xx, yh, 1, Math.max(1, yl - yh + 1));
        const top = Math.round(y(Math.max(c.o, c.c))), bot = Math.round(y(Math.min(c.o, c.c)));
        const rx = Math.round(xx - (cwid >> 1)), rw = Math.max(1, cwid), rh = Math.max(2, bot - top);
        if (upc && rw > 2) {
          ctx.fillRect(rx, top, rw, rh);
          ctx.fillStyle = P.screen; ctx.fillRect(rx + 1, top + 1, rw - 2, Math.max(0, rh - 2));
        } else ctx.fillRect(rx, top, rw, rh);
        if (live && rw > 1) {
          ctx.fillStyle = upc ? P.phosphor : P.crimson;
          ctx.fillRect(rx - 1, top - 1, rw + 2, 1); ctx.fillRect(rx - 1, top + rh, rw + 2, 1);
        }
      }
      ctx.globalAlpha = 1;

      // Your average price and working orders: a dashed line and a tag on the left.
      const hline = (v, col, label, dash) => {
        const yy = Math.round(y(v));
        ctx.fillStyle = col;
        for (let xx = 0; xx < plotW; xx += dash[0] + dash[1]) ctx.fillRect(xx, yy, dash[0], 1);
        const w = Math.ceil(ctx.measureText(label).width) + 8;
        ctx.fillStyle = P.screen; ctx.fillRect(3, yy - 13, w, 12);
        ctx.fillStyle = col; ctx.fillText(label, 7, yy - 3);
      };
      if (p) hline(p.avg, P.amber, `${p.qty > 0 ? 'LONG' : 'SHORT'} ${B.fmt.qty(Math.abs(p.qty))} @ ${B.fmt.price(p.avg)}`, [6, 3]);
      for (const o of g.broker.orders) {
        if (o.sym !== sym) continue;
        hline(o.price, o.type === 'stop' ? P.crimson : P.sky, `${o.label || o.type.toUpperCase()} ${B.fmt.price(o.price)}`, [2, 3]);
      }

      // Your fills today: a buy is a jade arrow under its price, a sell a crimson one over it.
      // A fill that just landed drops in, rings, and shows its size for a moment.
      const trades = g.broker.dayTrades ? g.broker.dayTrades() : [];
      for (const tr of trades) {
        if (tr.sym !== sym) continue;
        const bi = barOfMinute(tr.t);
        if (bi < 0 || bi >= slots) continue;
        const fx = Math.round(x(bi)), fy = Math.round(y(tr.price));
        const buy = tr.qty > 0, dir = buy ? 1 : -1;
        const L = this.landing.find((q) => q.tr === tr);
        const age = L ? t - L.at : Infinity;
        // it travels the last 26px to its price in six steps: a buy rises into place, a sell drops
        const off = moving && age < 360 ? Math.round((1 - Math.floor(age / 60) / 6) * 26) : 0;
        tri(fx, buy ? fy + 3 + off : fy - 3 - off, dir, buy ? P.jade : P.crimson);
        if (age < 1600) {
          if (moving && age >= 300 && age < 660) {
            const r = 3 + Math.floor((age - 300) / 90) * 4;
            ctx.fillStyle = buy ? P.phosphor : P.crimson;
            for (let k = -r; k <= r; k += 2) { ctx.fillRect(fx + k, fy - r, 1, 1); ctx.fillRect(fx + k, fy + r, 1, 1); ctx.fillRect(fx - r, fy + k, 1, 1); ctx.fillRect(fx + r, fy + k, 1, 1); }
          }
          const label = `${buy ? '+' : ''}${B.fmt.qty(tr.qty)} @ ${B.fmt.price(tr.price)}`;
          const w = Math.ceil(ctx.measureText(label).width) + 8;
          const lx = Math.max(2, Math.min(plotW - w - 2, fx - (w >> 1))), lyy = buy ? fy + 22 : fy - 12;
          ctx.fillStyle = buy ? P.jadeD : P.crimsonD; ctx.fillRect(lx, lyy - 11, w, 14);
          ctx.fillStyle = P.white; ctx.fillText(label, lx + 4, lyy);
        }
      }
      this.landing = this.landing.filter((q) => t - q.at < 1600);

      // The live price: a dashed line from the bar to the axis, a pulse on each tick, and the tag.
      const upDay = tk.last >= tk.prevClose;
      const liveCol = upDay ? P.jade : P.crimson;
      const lastX = view.length ? Math.round(x(view.length - 1)) : 0;
      ctx.fillStyle = liveCol;
      for (let xx = lastX + 4; xx < plotW; xx += 4) ctx.fillRect(xx, ly, 2, 1);
      if (this.pulse && this.pulse.sym === sym && moving) {
        const age = t - this.pulse.at;
        if (age < 375) {
          const r = 2 + Math.floor(age / 125) * 3;
          ctx.fillStyle = this.pulse.dir > 0 ? P.phosphor : P.crimson;
          ctx.fillRect(lastX - r, ly - r, r * 2 + 1, 1); ctx.fillRect(lastX - r, ly + r, r * 2 + 1, 1);
          ctx.fillRect(lastX - r, ly - r, 1, r * 2 + 1); ctx.fillRect(lastX + r, ly - r, 1, r * 2 + 1);
        }
      }
      ctx.font = MONO_PX + 'px ' + MONO;
      tag(plotW + 2, ly, PAD_R - 4, (upDay ? '▲ ' : '▼ ') + B.fmt.price(shown), liveCol, P.ink, true);

      // A swing on this ticker: the plot takes a wash of its colour that steps away,
      // and a huge one tears a few rows sideways for a moment.
      const S = this.shockAt;
      if (S) {
        const age = t - S.at, fx = B.Settings ? B.Settings.fx() : 1;
        if (age > 900) this.shockAt = null;
        else if (fx > 0) {
          const step = Math.floor(age / 150);
          ctx.globalAlpha = Math.max(0, (S.level > 1 ? 0.30 : 0.18) * (1 - step / 6)) * fx;
          ctx.fillStyle = S.dir > 0 ? P.jade : P.crimson;
          ctx.fillRect(0, 0, plotW, H - PAD_B);
          ctx.globalAlpha = 1;
          if (moving && S.level > 1 && age < 260) {
            const band = Math.max(4, Math.round(plotH / 14));
            for (let k = 0; k < 3; k++) {
              const by = PAD_T + Math.round(((k * 37 + Math.floor(age / 65) * 53) % 97) / 97 * (plotH - band));
              const sh = (k % 2 ? 1 : -1) * (3 + k * 2) * S.dir;
              ctx.drawImage(cv, 0, by * dpr, plotW * dpr, band * dpr, sh, by, plotW, band);
            }
          }
        }
      }

      // Crosshair: dotted lines, the price on the axis, the time underneath, the bar's OHLC.
      const hv = this.hover;
      if (hv && hv.x >= 0 && hv.x < plotW && hv.y >= PAD_T && hv.y < H - PAD_B) {
        const hx = Math.round(hv.x), hy = Math.round(hv.y);
        ctx.fillStyle = P.grey; hdots(hy, 0, plotW, 2); vdots(hx, 0, H - PAD_B, 2);
        const v = hi - (hy - PAD_T) / plotH * (hi - lo);
        tag(plotW + 2, hy, PAD_R - 4, B.fmt.price(v), P.bone, P.ink, true);
        const bi = Math.floor(hx / bw);
        const c = view[bi];
        if (c) {
          const abs = offset + bi;
          if (abs >= sepIdx) {
            const label = B.Calendar.fmtTime((abs - sepIdx) * tf);
            const w = Math.ceil(ctx.measureText(label).width) + 8;
            ctx.fillStyle = P.bone; ctx.fillRect(Math.min(plotW - w, Math.max(0, hx - (w >> 1))), H - PAD_B + 2, w, 15);
            ctx.fillStyle = P.ink; ctx.fillText(label, Math.min(plotW - w, Math.max(0, hx - (w >> 1))) + 4, H - 8);
          }
          const ohlc = `O ${B.fmt.price(c.o)}  H ${B.fmt.price(c.h)}  L ${B.fmt.price(c.l)}  C ${B.fmt.price(c.c)}`;
          const w = Math.ceil(ctx.measureText(ohlc).width) + 10;
          ctx.fillStyle = P.screen; ctx.globalAlpha = 0.9; ctx.fillRect(3, 3, w, 15); ctx.globalAlpha = 1;
          ctx.fillStyle = c.c >= c.o ? P.phosphor : P.crimson; ctx.fillText(ohlc, 8, 14);
        }
      }
    }
  };
})(window.BTB);
