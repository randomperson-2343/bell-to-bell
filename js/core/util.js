// Global namespace + small helpers shared by every system.
window.BTB = window.BTB || {};
(function (B) {
  'use strict';

  B.DAY_MIN = 390; // 9:30 -> 16:00

  B.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  B.lerp = (a, b, f) => a + (b - a) * f;

  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  B.fmt = {
    money(v, signed) {
      const s = v < 0 ? '-' : (signed && v > 0 ? '+' : '');
      return s + '$' + nf0.format(Math.abs(Math.round(v)));
    },
    money2(v, signed) {
      const s = v < 0 ? '-' : (signed && v > 0 ? '+' : '');
      return s + '$' + nf2.format(Math.abs(v));
    },
    compact(v) {
      const a = Math.abs(v), s = v < 0 ? '-' : '';
      if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
      if (a >= 1e4) return s + '$' + (a / 1e3).toFixed(1) + 'K';
      return s + '$' + nf0.format(Math.round(a));
    },
    price(v) { return nf2.format(v); },
    pct(v, signed = true) {
      const s = signed && v > 0 ? '+' : '';
      return s + (v * 100).toFixed(2) + '%';
    },
    qty(n) { return nf0.format(n); },
    cls(v) { return v > 1e-9 ? 'up' : v < -1e-9 ? 'down' : 'flat'; }
  };

  B.el = (id) => document.getElementById(id);
  B.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})(window.BTB);
