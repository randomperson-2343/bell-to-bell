// Save/load adapter. localStorage today; swap the body for a filesystem
// backend when the game is wrapped for desktop (Tauri/Electron).
(function (B) {
  'use strict';
  const P = 'btb:';
  B.storage = {
    get(key, def) {
      try {
        const v = localStorage.getItem(P + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(P + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(P + key); } catch (e) { /* storage unavailable */ }
    }
  };
})(window.BTB);
