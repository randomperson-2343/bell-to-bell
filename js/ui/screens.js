// Screens + modals: menu navigation, briefings, end-of-day report, choices, endings, settings.
(function (B) {
  'use strict';
  const $ = B.el;
  const F = B.fmt;

  // ---- settings ----
  const DEFAULTS = { volume: 0.6, sound: true, reducedMotion: false, storyDayLength: 240 };
  B.Settings = {
    cache: null,
    get() {
      if (!this.cache) this.cache = Object.assign({}, DEFAULTS, B.storage.get('settings', {}));
      return this.cache;
    },
    set(k, v) {
      this.get()[k] = v;
      B.storage.set('settings', this.cache);
      this.apply();
    },
    apply() {
      const s = this.get();
      B.SFX.setVolume(s.volume);
      B.SFX.setEnabled(s.sound);
    }
  };

  const AVATAR = {
    'Garrett Vance': '#ff4d61', 'Dana Okafor': '#1fd67f', 'Rae Castellano': '#b48cff', 'Sen. Harlan Whitfield': '#4da3ff',
    'Theo Mercer': '#ffb627', 'Evelyn Marsh': '#7fd3ff', 'Mara Linde': '#ff9a3c'
  };
  const initials = (n) => n.replace(/^Sen\. /, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

  const Screens = {
    show(id) {
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    },

    goMenu() {
      this.closeModal();
      this.show('menu');
      B.Main.refreshMenu();
    },

    // ---- generic modal ----
    modal(o) {
      const layer = $('modal-layer');
      const buttons = (o.buttons || []).map((b, i) => `<button class="btn ${b.cls || ''}" data-mb="${i}">${b.label}</button>`).join('');
      layer.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-h">${o.kicker ? `<div class="kicker">${o.kicker}</div>` : ''}${o.title ? `<h2>${o.title}</h2>` : ''}</div>
        <div class="modal-b">${o.body || ''}</div>
        ${o.after || ''}
        ${buttons ? `<div class="modal-f">${buttons}</div>` : ''}
      </div>`;
      layer.querySelectorAll('[data-mb]').forEach((el) => el.addEventListener('click', () => {
        const b = o.buttons[+el.dataset.mb];
        B.SFX.unlock();
        if (b.keep) { b.onClick && b.onClick(); return; }
        this.closeModal();
        b.onClick && b.onClick();
      }));
      const primary = layer.querySelector('.btn.primary');
      if (primary) setTimeout(() => primary.focus(), 50);
      return layer.querySelector('.modal');
    },

    closeModal() { $('modal-layer').innerHTML = ''; },

    confirm(title, body, okLabel, onOk) {
      this.modal({ title, body: `<p>${body}</p>`, buttons: [{ label: 'Cancel' }, { label: okLabel, cls: 'primary', onClick: onOk }] });
    },

    howtoModal(onClose) {
      const html = $('screen-howto').querySelector('.howto').innerHTML;
      this.modal({ title: 'How to Play', body: html, wide: true, buttons: [{ label: 'Got it', cls: 'primary', onClick: onClose }] });
    },

    // ---- day briefing ----
    briefing(g, b, onGo) {
      const d = B.Calendar.dayInfo(g.day);
      const rules = b.rules && b.rules.length ? `<div class="rules-list">${b.rules.map((r) => `<div>&#9656; ${r}</div>`).join('')}</div>` : '';
      const stats = `<div class="stats">
        <div class="stat"><div class="l">Equity</div><div class="v">${F.money(g.broker.equity())}</div></div>
        <div class="stat"><div class="l">Today's quota</div><div class="v">${b.quota > 0 ? F.money(b.quota) : 'none'}</div></div>
        <div class="stat"><div class="l">Open positions</div><div class="v">${Object.keys(g.broker.pos).length + g.broker.opts.length}</div></div>
      </div>`;
      this.modal({
        kicker: `${b.kicker || ''} ${d.long}`,
        title: b.title,
        body: stats + (b.html || '') + rules,
        wide: true,
        buttons: [
          { label: 'Menu', onClick: () => this.pauseFromBriefing(g, b, onGo), cls: 'ghost' },
          { label: '&#128276; Ring the Opening Bell', cls: 'primary', onClick: () => { B.SFX.unlock(); onGo(); } }
        ]
      });
    },

    pauseFromBriefing(g, b, onGo) {
      this.modal({
        title: 'Paused',
        body: '<p>Progress auto-saves at the end of each trading day.</p>',
        buttons: [
          { label: 'Quit to Menu', cls: 'ghost', onClick: () => g.quit() },
          { label: 'How to Play', onClick: () => this.howtoModal(() => this.pauseFromBriefing(g, b, onGo)) },
          { label: 'Back to Briefing', cls: 'primary', onClick: () => this.briefing(g, b, onGo) }
        ]
      });
    },

    // ---- end of day ----
    eod(g, r, onNext) {
      const pnlPct = r.pnl / Math.max(1, r.start);
      const quota = r.quota > 0
        ? `<span class="stamp ${r.quotaMet ? 'good' : 'bad'}">${r.quotaMet ? 'QUOTA MET' : 'QUOTA MISSED'}</span>`
        : '';
      const extra = [];
      if (r.eod.forced.length) extra.push(`Overnight margin: force-sold ${r.eod.forced.join(', ')} at the close.`);
      if (r.eod.borrow > 1) extra.push(`Short borrow fees: ${F.money(r.eod.borrow)}.`);
      if (r.eod.interest > 1) extra.push(`Margin interest: ${F.money(r.eod.interest)}.`);
      for (const x of r.eod.expired) extra.push(`Option expired: ${x.label} settled at ${F.price(x.intr)} (${F.money(x.realized, true)}).`);
      const notes = extra.concat(r.notes || []);
      const body = `
        <div style="text-align:center">${quota}</div>
        <div class="eod-big ${F.cls(r.pnl)}">${F.money(r.pnl, true)}</div>
        <div style="text-align:center" class="muted">${F.pct(pnlPct)} on the day · Index ${F.pct(r.indexPct)}</div>
        <div class="stats">
          <div class="stat"><div class="l">Equity</div><div class="v">${F.money(r.equity)}</div></div>
          <div class="stat"><div class="l">Quota</div><div class="v">${r.quota > 0 ? F.money(r.quota) : 'none'}</div></div>
          <div class="stat"><div class="l">Trades</div><div class="v">${r.trades}</div></div>
          <div class="stat"><div class="l">Best trade</div><div class="v ${F.cls(r.best)}">${F.money(r.best, true)}</div></div>
          <div class="stat"><div class="l">Worst trade</div><div class="v ${F.cls(r.worst)}">${F.money(r.worst, true)}</div></div>
          <div class="stat"><div class="l">Stress peak</div><div class="v ${r.stressPeak > 80 ? 'down' : r.stressPeak > 50 ? 'amber' : ''}">${Math.round(r.stressPeak)}</div></div>
        </div>
        ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}`;
      this.modal({
        kicker: r.earlyEnd === 'wiped' ? 'ACCOUNT TERMINATED' : 'CLOSING BELL',
        title: r.date,
        body,
        buttons: [{ label: 'Continue', cls: 'primary', onClick: onNext }]
      });
    },

    // ---- story choice ----
    choice(c, S, onPick) {
      const opts = c.options.filter((o) => !o.req || o.req(S));
      const av = AVATAR[c.speaker] || '#888';
      const body = `<div class="speaker"><div class="avatar" style="background:${av}">${initials(c.speaker)}</div><div><b>${c.speaker}</b><span>${c.role || ''}</span></div></div>` +
        c.text.map((p) => `<p>${p}</p>`).join('');
      const after = `<div class="choice-list">${opts.map((o) => `<button class="choice-btn" data-opt="${o.id}"><b>${o.label}</b>${o.hint ? `<span>${o.hint}</span>` : ''}</button>`).join('')}</div>`;
      const el = this.modal({ kicker: c.kicker || 'DECISION', title: c.title, body, after, wide: true });
      B.SFX.choice();
      el.querySelectorAll('.choice-btn').forEach((btn) => btn.addEventListener('click', () => {
        B.SFX.unlock();
        onPick(btn.dataset.opt);
      }));
    },

    // Short follow-up after a choice.
    aftermath(title, text, onNext) {
      this.modal({ title, body: text.map((p) => `<p>${p}</p>`).join(''), buttons: [{ label: 'Continue', cls: 'primary', onClick: onNext }] });
    },

    // ---- endings ----
    ending(g, ending) {
      if (g.mode.kind === 'story') this.storyEnding(g, ending);
      else this.endlessEnding(g, ending);
    },

    storyEnding(g, e) {
      const scr = $('screen-endings').cloneNode(false);
      scr.id = 'screen-ending-page';
      document.querySelectorAll('#screen-ending-page').forEach((x) => x.remove());
      scr.className = 'screen active';
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      const found = B.StoryEndings.discovered();
      scr.innerHTML = `<div class="ending-scroll"><article class="paper">
        <div class="mast"><h1>The Daily Ledger</h1><div class="row"><span>${B.Calendar.dayInfo(Math.min(g.day + 1, 21)).long}</span><span>Final Edition</span><span>$2.00</span></div></div>
        <div class="hl">${e.headline}</div>
        <div class="deck">${e.deck}</div>
        <div class="cols">
          <div class="lead">${e.story.map((p) => `<p>${p}</p>`).join('')}</div>
          <div class="side">
            <h4>How We Got Here</h4>
            <ul>${(e.timeline || []).map((t) => `<li>${t}</li>`).join('') || '<li>You kept your head down.</li>'}</ul>
            <div class="box">
              <div><span>ENDING</span><b>${e.title}</b></div>
              <div><span>Final net worth</span><b>${F.money(e.wealth)}</b></div>
              <div><span>Starting capital</span><span>${F.money(g.startCapital)}</span></div>
              <div><span>Return</span><b>${F.pct(e.wealth / g.startCapital - 1)}</b></div>
              <div><span>Index, month</span><span>${F.pct(e.indexMonth || 0)}</span></div>
              <div><span>Days traded</span><span>${g.history.length}</span></div>
              <div><span>Endings found</span><span>${found.length} / ${B.StoryEndings.list.length}</span></div>
            </div>
          </div>
        </div>
      </article>
      <div class="paper-actions">
        <button class="btn primary" id="end-menu">Main Menu</button>
        <button class="btn" id="end-again">Play Story Again</button>
        <button class="btn ghost" id="end-gallery">Endings</button>
      </div></div>`;
      $('app').appendChild(scr);
      B.SFX.closeBell();
      const leave = () => { scr.remove(); B.UI.leaveGame(); };
      $('end-menu').addEventListener('click', leave);
      $('end-again').addEventListener('click', () => { scr.remove(); B.UI.g = null; B.Main.newStory(); });
      $('end-gallery').addEventListener('click', () => { scr.remove(); B.UI.g = null; B.UI.leaveGame(); this.showEndings(); });
    },

    endlessEnding(g, e) {
      const body = `
        <div style="text-align:center"><span class="stamp ${e.good ? 'good' : 'bad'}">${e.title.toUpperCase()}</span></div>
        <p style="text-align:center;margin-top:14px">${e.text}</p>
        <div class="eod-big ${F.cls(e.wealth - g.startCapital)}">${F.money(e.wealth)}</div>
        <div class="stats">
          <div class="stat"><div class="l">Return</div><div class="v ${F.cls(e.wealth - g.startCapital)}">${F.pct(e.wealth / g.startCapital - 1)}</div></div>
          <div class="stat"><div class="l">Days survived</div><div class="v">${g.history.length}</div></div>
          <div class="stat"><div class="l">Best day</div><div class="v up">${F.money(Math.max(0, ...g.history.map((h) => h.pnl)), true)}</div></div>
          <div class="stat"><div class="l">Worst day</div><div class="v down">${F.money(Math.min(0, ...g.history.map((h) => h.pnl)), true)}</div></div>
          <div class="stat"><div class="l">Quotas met</div><div class="v">${g.history.filter((h) => h.quotaMet).length}/${g.history.length}</div></div>
          <div class="stat"><div class="l">Rank</div><div class="v">${e.rank ? '#' + e.rank : '-'}</div></div>
        </div>
        <p class="muted" style="text-align:center">Seed: <code>${B.esc(g.mode.seed)}</code> · Preset: ${B.esc(g.mode.cfg.presetName)}</p>`;
      this.modal({
        kicker: 'RUN OVER', title: 'Endless Mode', body,
        buttons: [
          { label: 'Main Menu', onClick: () => B.UI.leaveGame() },
          { label: 'New Run', cls: 'primary', onClick: () => { B.UI.leaveGame(); B.Main.openEndless(); } }
        ]
      });
    },

    showEndings() {
      const found = B.StoryEndings.discovered();
      $('endings-list').innerHTML = B.StoryEndings.list.map((e) => {
        const got = found.includes(e.id);
        return `<div class="ending-row ${got ? '' : 'locked'}"><div class="ico">${got ? e.icon : '&#128274;'}</div><div><b>${got ? e.title : '???'}</b><span>${got ? e.hint : e.lockedHint}</span></div></div>`;
      }).join('');
      this.show('endings');
    },

    renderSettings() {
      const s = B.Settings.get();
      $('settings-form').innerHTML = `
        <div class="fieldset">
          <h3>Audio</h3>
          <div class="check"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><label for="set-sound">Sound effects</label><span></span></div>
          <div class="field"><label for="set-vol">Volume</label><input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}"><output id="set-vol-o">${Math.round(s.volume * 100)}%</output></div>
          <button class="btn small" id="set-test">Test sound</button>
        </div>
        <div class="fieldset" style="margin-top:14px">
          <h3>Comfort</h3>
          <div class="check"><input type="checkbox" id="set-rm" ${s.reducedMotion ? 'checked' : ''}><label for="set-rm">Reduced motion (no screen shake or chart jitter)</label><span></span></div>
          <div class="field"><label for="set-dl">Story day length</label>
            <select id="set-dl"><option value="120">2 minutes (frantic)</option><option value="240">4 minutes (default)</option><option value="420">7 minutes (relaxed)</option></select><output></output></div>
        </div>
        <div class="fieldset" style="margin-top:14px">
          <h3>Data</h3>
          <button class="btn small danger" id="set-reset">Delete all saves, endings and leaderboards</button>
        </div>`;
      $('set-dl').value = String(s.storyDayLength);
      $('set-sound').addEventListener('change', (e) => B.Settings.set('sound', e.target.checked));
      $('set-vol').addEventListener('input', (e) => { B.Settings.set('volume', +e.target.value); $('set-vol-o').textContent = Math.round(e.target.value * 100) + '%'; });
      $('set-test').addEventListener('click', () => { B.SFX.unlock(); B.SFX.bell(); });
      $('set-rm').addEventListener('change', (e) => B.Settings.set('reducedMotion', e.target.checked));
      $('set-dl').addEventListener('change', (e) => B.Settings.set('storyDayLength', +e.target.value));
      $('set-reset').addEventListener('click', () => this.confirm('Delete everything?', 'Removes story and endless saves, discovered endings and leaderboards. This can\'t be undone.', 'Delete', () => {
        ['save:story', 'save:endless', 'endings', 'leaderboard'].forEach((k) => B.storage.remove(k));
        B.UI.toast('All progress deleted.', 'warn');
        this.renderSettings();
      }));
    }
  };

  B.Screens = Screens;
})(window.BTB);
