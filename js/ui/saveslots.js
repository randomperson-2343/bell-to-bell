// The Load Game screen: six slots, each an independent run.
//
// A slot that reached an ending stays as a record — you can read how it ended
// and it counts toward the endings tally, but it cannot be resumed.
(function (B) {
  'use strict';
  const $ = B.el;
  const F = B.fmt;

  const Slots = {
    open() {
      this.render();
      B.Screens.show('saves');
    },

    render() {
      const idx = B.Save.index();
      $('slots-list').innerHTML = idx.map((m, i) => this.row(m, i)).join('');
      $('slots-list').querySelectorAll('button[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => this.act(btn.dataset.act, +btn.dataset.slot));
      });
    },

    row(m, i) {
      if (!m) {
        return `<div class="slot empty-slot"><div class="n">${i + 1}</div>
          <div><b>Empty slot</b><div class="meta">Start a new career or endless run and save into it.</div></div>
          <div class="acts"><button class="btn small" data-act="new" data-slot="${i}">New Career</button></div></div>`;
      }
      const fin = m.finished;
      const state = fin
        ? `<span class="tag">Finished &mdash; ${B.esc(fin.title)}</span> · ${F.money(fin.wealth || m.equity)}`
        : m.inDay
          ? `<span class="live">Mid-session ${B.esc(m.clock || '')}</span> · ${F.money(m.equity)}`
          : `Between days · ${F.money(m.equity)}`;
      const acts = fin
        ? `<button class="btn small" data-act="delete" data-slot="${i}">Delete</button>`
        : `<button class="btn small primary" data-act="load" data-slot="${i}">Continue</button>
           <button class="btn small" data-act="rename" data-slot="${i}">Rename</button>
           <button class="btn small ghost" data-act="delete" data-slot="${i}">Delete</button>`;
      return `<div class="slot ${fin ? 'finished' : ''}"><div class="n">${i + 1}</div>
        <div><b>${B.esc(m.name)}</b>
          <div class="meta">${m.mode === 'story' ? 'Career' : 'Endless'} · ${B.esc(m.label || '')}<br>${state}<br>Saved ${B.timeAgo(m.ts)}</div>
        </div>
        <div class="acts">${acts}</div></div>`;
    },

    act(a, i) {
      const m = B.Save.meta(i);
      if (a === 'new') return B.Main.newStory(i);
      if (a === 'load') return this.load(i);
      if (a === 'rename') {
        return B.Screens.prompt('Rename slot', 'What should this run be called?', m.name, 'Rename', (v) => {
          B.Save.rename(i, v);
          this.render();
        });
      }
      if (a === 'delete') {
        return B.Screens.confirm('Delete this save?',
          `"${B.esc(m.name)}" is gone for good. ${m.finished ? 'The ending it reached stays in your tally.' : ''}`,
          'Delete', () => { B.Save.clear(i); this.render(); });
      }
    },

    load(i) {
      const snap = B.Save.read(i);
      if (!snap) return B.UI.toast('That save could not be read. It may be from an older version.', 'bad');
      snap.slot = i;
      B.SFX.unlock();
      let g;
      try {
        if (snap.kind === 'story') g = new B.Game(B.StoryMode(snap.mode), snap);
        else g = new B.Game(B.EndlessMode(snap.mode.cfg, snap.mode), snap);
      } catch (e) {
        return B.UI.toast('That save could not be loaded.', 'bad');
      }
      g.begin();
      if (snap.migrationNotice) setTimeout(() => B.UI.toast(snap.migrationNotice, 'warn big'), 250);
    }
  };

  B.Slots = Slots;
})(window.BTB);
