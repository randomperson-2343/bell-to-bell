// Seeded PRNG (mulberry32) so every day/run is reproducible from its seed.
// getState/setState let a saved game resume at the exact same cursor, which is
// what makes mid-day saves restore identically (see js/core/save.js).
(function (B) {
  'use strict';

  B.RNG = function (seed) {
    let s = (seed >>> 0) || 1;
    let spare = null;
    const next = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      normal() {
        if (spare !== null) { const v = spare; spare = null; return v; }
        let u = 0;
        while (u === 0) u = next();
        const v = next();
        const r = Math.sqrt(-2 * Math.log(u));
        spare = r * Math.sin(2 * Math.PI * v);
        return r * Math.cos(2 * Math.PI * v);
      },
      getState() { return { s: s, spare: spare }; },
      setState(st) {
        if (!st) return;
        s = (st.s >>> 0) || 1;
        spare = st.spare == null ? null : st.spare;
      }
    };
  };

  B.hashSeed = function (str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
})(window.BTB);
