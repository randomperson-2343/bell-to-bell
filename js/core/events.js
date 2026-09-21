// Tiny pub/sub bus for notifications (fills, news, sounds, toasts).
(function (B) {
  'use strict';
  const map = {};
  B.bus = {
    on(evt, fn) {
      (map[evt] = map[evt] || []).push(fn);
      return () => B.bus.off(evt, fn);
    },
    off(evt, fn) {
      if (map[evt]) map[evt] = map[evt].filter((f) => f !== fn);
    },
    emit(evt, data) {
      (map[evt] || []).slice().forEach((fn) => {
        try { fn(data); } catch (err) { console.error('[bus]', evt, err); }
      });
    }
  };
})(window.BTB);
