// Swing detector: notices when a ticker moves hard over the last few market
// minutes, so the trading screen can make a moment of it. Read only: it never
// touches prices, stress or the game; it looks at the 1-minute candles.
//
//   const s = B.Swing.create();
//   for (const e of B.Swing.scan(s, market)) ...  // { sym, pct, dir, level, t }
//
// level 1 is a big move, level 2 a huge one. A ticker that has fired stays
// quiet for COOL market minutes unless the move grows to the next level.
(function (B) {
  'use strict';
  const Swing = {
    WINDOW: 5,
    COOL: 15,
    // |move| over WINDOW minutes for a big and a huge swing, by sector.
    LEVELS: { index: [0.006, 0.012], stock: [0.015, 0.03] },

    create() { return { fired: {} }; },

    levelOf(sector, pct) {
      const L = this.LEVELS[sector === 'index' ? 'index' : 'stock'];
      const a = Math.abs(pct);
      return a >= L[1] ? 2 : a >= L[0] ? 1 : 0;
    },

    scan(state, m) {
      const out = [];
      if (!m || m.status !== 'open') return out;
      const n = Math.floor(m.t);
      if (n < 1) return out;
      for (const tk of m.tickers) {
        if (tk.sector === 'fear' || !tk.candles || !tk.candles.length) continue;
        const ref = tk.candles[Math.max(0, n - this.WINDOW)];
        if (!ref || !(ref.c > 0)) continue;
        const pct = tk.last / ref.c - 1;
        const level = this.levelOf(tk.sector, pct);
        if (!level) continue;
        const dir = pct > 0 ? 1 : -1;
        const prev = state.fired[tk.sym];
        const cooled = !prev || m.t >= prev.t + this.COOL || prev.dir !== dir;
        const grew = prev && prev.dir === dir && level > prev.level;
        if (!cooled && !grew) continue;
        state.fired[tk.sym] = { t: m.t, dir, level };
        out.push({ sym: tk.sym, pct, dir, level, t: m.t });
      }
      return out;
    }
  };
  B.Swing = Swing;
})(window.BTB);
