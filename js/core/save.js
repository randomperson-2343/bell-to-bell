// Save slots + the ending tally.
//
// Six independent slots. Each holds a full game snapshot, including a mid-day
// one: you can pause at 11:42, quit, and come back to 11:42. The snapshot itself
// is built and consumed by js/game.js (snapshot()/restoreFrom()); this file owns
// storage, slot metadata and the endings tally.
//
// Storage layout (all through js/core/storage.js):
//   saves:index   -> [meta, meta, ...]   light, read on every menu paint
//   save:slot:N   -> full snapshot       heavy, read only when loading
//   endings:tally -> { endingId: count }
(function (B) {
  'use strict';

  const SLOTS = 6;
  const VERSION = 2;
  const IDX = 'saves:index';
  const key = (i) => 'save:slot:' + i;

  function blankIndex() {
    const a = [];
    for (let i = 0; i < SLOTS; i++) a.push(null);
    return a;
  }

  const Save = {
    SLOTS,
    VERSION,

    index() {
      const raw = B.storage.get(IDX, null);
      if (!Array.isArray(raw)) return blankIndex();
      const out = blankIndex();
      for (let i = 0; i < SLOTS; i++) out[i] = raw[i] || null;
      return out;
    },

    writeIndex(idx) { B.storage.set(IDX, idx); },

    meta(i) { return this.index()[i] || null; },

    // The first slot with nothing in it, or -1 if they're all taken.
    firstEmpty() {
      const idx = this.index();
      for (let i = 0; i < SLOTS; i++) if (!idx[i]) return i;
      return -1;
    },

    defaultName(mode) {
      const idx = this.index();
      const base = mode === 'endless' ? 'Endless' : 'Career';
      let n = 1;
      const taken = idx.filter(Boolean).map((m) => m.name);
      while (taken.indexOf(base + ' ' + n) >= 0) n++;
      return base + ' ' + n;
    },

    write(i, data, meta) {
      if (i < 0 || i >= SLOTS) return false;
      data.v = VERSION;
      if (!B.storage.set(key(i), data)) return false;
      const idx = this.index();
      const prev = idx[i] || {};
      idx[i] = Object.assign({ id: i, name: prev.name || this.defaultName(meta.mode) }, prev, meta, { ts: Date.now(), v: VERSION });
      this.writeIndex(idx);
      return true;
    },

    read(i) {
      const d = B.storage.get(key(i), null);
      if (!d || d.v !== VERSION) return null;
      return d;
    },

    clear(i) {
      B.storage.remove(key(i));
      const idx = this.index();
      idx[i] = null;
      this.writeIndex(idx);
    },

    rename(i, name) {
      const idx = this.index();
      if (!idx[i]) return;
      idx[i].name = String(name || '').slice(0, 22) || idx[i].name;
      this.writeIndex(idx);
    },

    // A finished slot is read-only: you can look at how it ended, not resume it.
    finish(i, ending) {
      const idx = this.index();
      if (!idx[i]) return;
      idx[i].finished = { id: ending.id, title: ending.title, wealth: ending.wealth };
      idx[i].ts = Date.now();
      this.writeIndex(idx);
      this.recordEnding(ending.id);
    },

    // ---- endings tally ----
    tally() { return B.storage.get('endings:tally', {}) || {}; },

    recordEnding(id) {
      const t = this.tally();
      t[id] = (t[id] || 0) + 1;
      B.storage.set('endings:tally', t);
    },

    discovered() { return Object.keys(this.tally()); },

    totalRuns() {
      const t = this.tally();
      return Object.keys(t).reduce((a, k) => a + t[k], 0);
    },

    wipe() {
      for (let i = 0; i < SLOTS; i++) B.storage.remove(key(i));
      ['saves:index', 'endings:tally', 'endings', 'leaderboard', 'save:story', 'save:endless'].forEach((k) => B.storage.remove(k));
    },

    // ---- one-time migration from the V1 single-save layout ----
    migrate() {
      if (B.storage.get('saves:migrated', false)) return;
      B.storage.set('saves:migrated', true);
      // V1 endings were a flat array of discovered ids; seed the tally with one each.
      const old = B.storage.get('endings', null);
      if (Array.isArray(old) && old.length) {
        const t = this.tally();
        for (const id of old) if (!t[id]) t[id] = 1;
        B.storage.set('endings:tally', t);
      }
      // V1 saves used a different story and a different schema; they cannot be
      // resumed here, so they are dropped rather than silently corrupting a slot.
      B.storage.remove('save:story');
      B.storage.remove('save:endless');
    }
  };

  B.Save = Save;
})(window.BTB);
