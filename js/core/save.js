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
  const VERSION = 4;
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

    // Where a brand-new run should live. A finished career keeps its slot, so a
    // full shelf is common: offer the oldest finished one (its ending is already
    // in the tally), and only if every slot is a live run say it can't be kept.
    newRunPlan() {
      const free = this.firstEmpty();
      if (free >= 0) return { kind: 'free', slot: free };
      const idx = this.index();
      let old = -1;
      for (let i = 0; i < SLOTS; i++) {
        if (idx[i] && idx[i].finished && (old < 0 || (idx[i].ts || 0) < (idx[old].ts || 0))) old = i;
      }
      if (old < 0) return { kind: 'full' };
      return { kind: 'replace', slot: old, name: idx[old].name, ending: idx[old].finished.title };
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
      let d = B.storage.get(key(i), null);
      if (!d) return null;
      if (d.v === 2) d = this.migrateV2Snapshot(d);
      if (d && d.v === 3) d = this.migrateV3Snapshot(d);
      return d && d.v === VERSION ? d : null;
    },

    migrateV2Snapshot(d) {
      const out = JSON.parse(JSON.stringify(d));
      out.v = 3;
      if (out.kind !== 'story') return out;
      const wasMidDay = !!out.inDay;
      // Map the shipped fifteen beats to the same beats in the expanded story.
      const map = [0, 3, 8, 12, 15, 18, 23, 26, 30, 33, 36, 39, 51, 55, 60];
      out.day = map[Math.max(0, Math.min(14, out.day || 0))];
      out.history = (out.history || []).map((h) => Object.assign({}, h, { day: map[Math.max(0, Math.min(14, h.day || 0))] }));
      const S = out.mode && out.mode.S;
      if (S) {
        S.choices = S.choices || {};
        if (S.choices.c8 != null) { S.choices.c9 = S.choices.c8; delete S.choices.c8; }
        if (S.choices.c7 != null) { S.choices.c8 = S.choices.c7; delete S.choices.c7; }
        S.log = (S.log || []).map((x) => Object.assign({}, x, { day: map[Math.max(0, Math.min(14, x.day || 0))] }));
        S.anomalies = S.anomalies || 0;
        S.openedAnomalies = S.openedAnomalies || {};
        S.feedsSkipped = S.feedsSkipped || 0;
        S.feedOpenedDays = S.feedOpenedDays || {};
        S.feedSkippedDays = S.feedSkippedDays || {};
        S.f = S.f || {};
        S.f.migratedPatch3 = true;
        if (wasMidDay) S.f.v2RewoundToBell = true;
      }
      // V2 did not preserve enough pre-open state to replay its mid-session tape
      // against the expanded calendar. Resume the mapped session at the bell and
      // say so, instead of silently replaying the wrong story tape.
      if (wasMidDay) {
        out.inDay = false;
        out.market = out.market || out.dayOpen;
        out.migrationNotice = 'This older mid-session save was moved to the matching session opening bell. Your book and decisions were preserved; the intraday tape restarts.';
      }
      return out;
    },

    // V3 -> V4: the 61-session story was cut to 46. V3 day numbers are the kept
    // sessions' original ids (StoryData.DAYS[n].sid), so a save on a removed
    // session moves to the next kept one. Days that no longer exist drop out of
    // the per-day records; a mid-session save restarts at the opening bell,
    // because the week arithmetic it was carrying has changed.
    migrateV3Snapshot(d) {
      const out = JSON.parse(JSON.stringify(d));
      out.v = VERSION;
      if (out.kind !== 'story') return out;
      const D = B.StoryData, sids = D.DAYS.map((x) => x.sid);
      const next = (o) => { const i = sids.findIndex((x) => x >= o); return i < 0 ? sids.length - 1 : i; };
      const kept = (o) => sids.indexOf(+o) >= 0;
      const byDay = (m, fn) => { const r = {}; for (const k in m || {}) if (kept(k)) r[next(+k)] = fn ? fn(m[k]) : m[k]; return r; };
      const oldDay = out.day || 0;
      out.day = next(oldDay);
      // A row for a session that no longer exists is dropped, not moved onto the next
      // kept one (that made duplicates and counted misses nobody could have forgiven).
      const seen = {};
      out.history = (out.history || []).filter((h) => kept(h.day || 0)).map((h) => Object.assign({}, h, { day: next(h.day || 0) }))
        .filter((h) => !seen[h.day] && (seen[h.day] = true));
      const S = out.mode && out.mode.S;
      if (S) {
        const dayed = (x) => Object.assign({}, x, { day: next(x.day || 0) });
        S.log = (S.log || []).filter((x) => kept(x.day || 0)).map(dayed);
        S.quotaLedger = (S.quotaLedger || []).filter((e) => kept(e.day || 0))
          .map((e) => (e.kind === 'week' ? Object.assign(dayed(e), { week: D.weekOf(next(e.day || 0)) }) : dayed(e)));
        for (const k of ['forgivenDays', 'excusedDays']) if (S[k]) S[k] = S[k].filter(kept).map(next);
        // The strike limit fell from 30 to 23. A career that would load at or past it
        // loads one miss short instead: forgive the oldest surplus misses, as a made
        // week would, so the history rebuild on later loads leaves them alone.
        const limit = B.StoryMode && B.StoryMode.QUOTA_STRIKE_LIMIT;
        if (limit) {
          const forgiven = S.forgivenDays = S.forgivenDays || [];
          const taken = {};
          const strikes = (S.quotaLedger || []).map((e) => { if (e.kind !== 'week') taken[e.day] = true; return e; });
          for (const h of out.history) if (h.quotaMet === false && !taken[h.day] && forgiven.indexOf(h.day) < 0) { taken[h.day] = true; strikes.push({ day: h.day, fromHistory: true }); }
          strikes.sort((a, b) => a.day - b.day || (a.kind === 'week') - (b.kind === 'week'));
          for (const e of strikes.slice(0, Math.max(0, strikes.length - (limit - 1)))) {
            if (e.kind !== 'week' && forgiven.indexOf(e.day) < 0) forgiven.push(e.day);
            if (!e.fromHistory) S.quotaLedger = S.quotaLedger.filter((x) => x !== e);
          }
          S.quotaStrikes = Math.min(strikes.length, limit - 1);
        }
        S.feedOpenedDays = byDay(S.feedOpenedDays);
        S.feedSkippedDays = byDay(S.feedSkippedDays);
        if (S.mentor) { const career = S.mentor.career; S.mentor = byDay(S.mentor); if (career) S.mentor.career = career; }
        if (S.resqwak) S.resqwak.day = next(S.resqwak.day || 0);
        if (S.falseDawnBear && S.falseDawnBear.samples) S.falseDawnBear.samples = S.falseDawnBear.samples.filter((x) => kept(x.day)).map(dayed);
        // The open week was sized for the old calendar; the first session back rebuilds it.
        delete S.week;
        const w = S.wallet;
        if (w) {
          // A payslip counts only for a week that has fully gone by in the new calendar.
          const now = D.weekOf(out.day), weeks = {};
          for (const k in w.weeks || {}) {
            const wk = D.weekOf(next(Math.min(k * 5 - 1, 60)));
            if (wk < now) weeks[wk] = w.weeks[k];
          }
          w.weeks = weeks;
          w.days = byDay(w.days);
          w.ddDays = byDay(w.ddDays);
          if (w.ledgerSub && w.ledgerSub.since != null) w.ledgerSub.since = next(w.ledgerSub.since);
          w.ledgerPaidWeek = w.ledgerPaidWeek === Math.floor(oldDay / 5) + 1 ? now : 0;
        }
        S.f = S.f || {};
        S.f.migratedV4 = true;
      }
      if (out.inDay) {
        out.inDay = false;
        out.market = out.market || out.dayOpen;
        out.migrationNotice = 'This mid-session save was moved to the opening bell of the shortened story. Your book and decisions were preserved; the intraday tape restarts.';
      }
      return out;
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

    // Career endings only. Earlier builds also counted Endless results here,
    // and Endless 'fired' collided with the Career ending of the same name;
    // keep only ids the story knows, and let Endless keep its own tally.
    careerTally() {
      const t = this.tally(), ids = B.StoryEndings ? B.StoryEndings.list.map((e) => e.id) : null;
      if (!ids) return t;
      const out = {};
      for (const k in t) if (ids.indexOf(k) >= 0) out[k] = t[k];
      return out;
    },
    recordEndless(id) {
      const t = B.storage.get('endless:tally', {}) || {};
      t[id] = (t[id] || 0) + 1;
      B.storage.set('endless:tally', t);
    },

    discovered() { return Object.keys(this.careerTally()); },

    totalRuns() {
      const t = this.careerTally();
      return Object.keys(t).reduce((a, k) => a + t[k], 0);
    },

    wipe() {
      for (let i = 0; i < SLOTS; i++) B.storage.remove(key(i));
      ['saves:index', 'endings:tally', 'endless:tally', 'endings', 'leaderboard', 'save:story', 'save:endless'].forEach((k) => B.storage.remove(k));
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
