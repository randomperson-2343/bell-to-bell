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
  // What a player has earned across careers. One career played to its last day, any ending and any path,
  // unlocks SKIP SCENE in the long decision scenes and the Endless mode. Kept apart from the save slots,
  // so deleting a save does not lock them again.
  B.Progress = {
    careerDone() { return !!B.storage.get('careerDone', false); },
    markCareerDone() { B.storage.set('careerDone', true); }
  };
})(window.BTB);
