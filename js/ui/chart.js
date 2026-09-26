// Canvas candlestick chart for the selected ticker.
(function (B) {
  'use strict';
  let cv, ctx, W = 0, H = 0, dpr = 1, MONO = 'monospace', MONO_PX = 11;
  const P = B.Pal;

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(50, r.width);
    H = Math.max(50, r.height);
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

  B.Chart = {
    tf: 5,
    init(canvas) {
      cv = canvas;
      ctx = cv.getContext('2d');
      const root = getComputedStyle(document.documentElement);
      MONO = root.getPropertyValue('--mono').trim() || 'monospace';
      MONO_PX = Math.round(11 * (parseFloat(root.getPropertyValue('--mono-canvas-scale')) || 1));
      if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
      window.addEventListener('resize', resize);
      resize();
    },

    draw(g, sym, jitter) {
      if (!ctx || !g) return;
      const cw = cv.getBoundingClientRect();
      if (Math.abs(cw.width - W) > 1 || Math.abs(cw.height - H) > 1) resize();
      const tk = g.market.bySym[sym];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!tk) return;

      const tf = this.tf;
      const prev = aggregate(tk.prevCandles || [], tf);
      const cur = aggregate(tk.candles || [], tf);
      const dayCount = Math.ceil(B.DAY_MIN / tf);
      const maxBars = tf === 1 ? 150 : tf === 5 ? dayCount + 20 : dayCount + 26;
      const prevShow = prev.slice(Math.max(0, prev.length - Math.max(0, maxBars - dayCount)));
      const bars = prevShow.concat(cur);
      const sepIdx = prevShow.length;
      const slots = tf === 1 ? 150 : prevShow.length + dayCount;
      const offset = tf === 1 ? Math.max(0, bars.length - slots) : 0;
      const view = bars.slice(offset);

      const padR = 64, padT = 12, padB = 20;
      const plotW = W - padR, plotH = H - padT - padB;
      let hi = -Infinity, lo = Infinity;
      for (const c of view) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
      const p = g.broker.pos[sym];
      if (tk.prevClose) { hi = Math.max(hi, tk.prevClose); lo = Math.min(lo, tk.prevClose); }
      if (p) { hi = Math.max(hi, p.avg); lo = Math.min(lo, p.avg); }
      if (!isFinite(hi)) { hi = tk.last * 1.01; lo = tk.last * 0.99; }
      const pad = (hi - lo) * 0.08 || tk.last * 0.005;
      hi += pad; lo -= pad;
      const jx = jitter ? (Math.random() - 0.5) * jitter : 0;
      const jy = jitter ? (Math.random() - 0.5) * jitter : 0;
      const y = (v) => padT + (hi - v) / (hi - lo) * plotH + jy;
      const bw = plotW / slots;
      const x = (i) => i * bw + bw / 2 + jx;

      // grid + axis
      ctx.font = MONO_PX + 'px ' + MONO;
      ctx.fillStyle = P.phosphorD;
      ctx.strokeStyle = '#182622';
      ctx.lineWidth = 1;
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const v = lo + (hi - lo) * (i / steps);
        const yy = Math.round(y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
        ctx.fillText(B.fmt.price(v), plotW + 6, yy + 4);
      }
      // session separator + time labels
      if (tf !== 1 && sepIdx > 0) {
        const sx = Math.round(sepIdx * bw) + 0.5;
        ctx.strokeStyle = P.slate2;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(sx, padT); ctx.lineTo(sx, H - padB); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = P.phosphorD;
        ctx.fillText('prev', Math.max(2, sx - 34), H - 6);
        for (const hr of [0, 90, 210, 330]) {
          const xi = sepIdx + hr / tf;
          ctx.fillText(B.Calendar.fmtTime(hr).replace(' AM', 'a').replace(' PM', 'p'), xi * bw + 2, H - 6);
        }
      }
      // prev close line
      if (tk.prevClose) {
        const yy = Math.round(y(tk.prevClose)) + 0.5;
        ctx.strokeStyle = P.slate2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
        ctx.setLineDash([]);
      }
      // candles
      const cwid = Math.max(1, Math.round(bw * 0.7));
      for (let i = 0; i < view.length; i++) {
        const c = view[i];
        const isPrev = offset + i < sepIdx;
        const upc = c.c >= c.o;
        const col = upc ? P.jade : P.crimson;
        ctx.globalAlpha = isPrev ? 0.35 : 1;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        const xx = Math.round(x(i));
        ctx.beginPath(); ctx.moveTo(Math.round(xx) + 0.5, y(c.h)); ctx.lineTo(Math.round(xx) + 0.5, y(c.l)); ctx.stroke();
        const top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c));
        const rx = Math.round(xx - cwid / 2), ry = Math.round(top);
        const rw = Math.max(1, Math.round(cwid)), rh = Math.max(2, Math.round(bot - top));
        if (upc && rw > 2) {
          ctx.fillStyle = P.screen;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeStyle = col;
          ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, rw - 1), Math.max(1, rh - 1));
        } else ctx.fillRect(rx, ry, rw, rh);
      }
      ctx.globalAlpha = 1;

      // position avg + working orders
      const hline = (v, col, label, dash) => {
        const yy = Math.round(y(v)) + 0.5;
        ctx.strokeStyle = col;
        ctx.setLineDash(dash || []);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.fillText(label, 4, yy - 4);
      };
      if (p) hline(p.avg, P.amber, `${p.qty > 0 ? 'LONG' : 'SHORT'} ${B.fmt.qty(Math.abs(p.qty))} @ ${B.fmt.price(p.avg)}`, [6, 3]);
      for (const o of g.broker.orders) {
        if (o.sym !== sym) continue;
        hline(o.price, o.type === 'stop' ? P.crimson : P.sky, `${o.label || o.type.toUpperCase()} ${B.fmt.price(o.price)}`, [2, 3]);
      }

      // last price tag
      const ly = y(tk.last);
      const upDay = tk.last >= tk.prevClose;
      ctx.fillStyle = upDay ? P.jade : P.crimson;
      ctx.fillRect(plotW + 1, ly - 9, padR - 2, 18);
      ctx.fillStyle = P.ink;
      ctx.font = 'bold ' + MONO_PX + 'px ' + MONO;
      ctx.fillText((upDay ? '▲ ' : '▼ ') + B.fmt.price(tk.last), plotW + 5, ly + 4);
    }
  };
})(window.BTB);
