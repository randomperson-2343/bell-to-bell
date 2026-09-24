// Screens + modals: menu navigation, briefings, end-of-day report, choices, endings, settings.
(function (B) {
  'use strict';
  const $ = B.el;
  const F = B.fmt;

  // ---- settings ----
  const DEFAULTS = {
    volume: 0.6, sound: true,
    music: true, musicVolume: 0.45,
    effects: 'full',        // full | reduced | off
    cinematics: 'full',     // full | short | off
    storyDayLength: 180,
    focusMode: false
  };

  B.Settings = {
    cache: null,
    get() {
      if (!this.cache) {
        this.cache = Object.assign({}, DEFAULTS, B.storage.get('settings', {}));
        // Migrate V1's single reducedMotion checkbox.
        if (this.cache.reducedMotion && this.cache.effects === 'full') this.cache.effects = 'reduced';
      }
      return this.cache;
    },
    set(k, v) {
      this.get()[k] = v;
      B.storage.set('settings', this.cache);
      this.apply();
    },
    // Screen-effect intensity multiplier: vignette, flash, shake.
    fx() {
      const e = this.get().effects;
      return e === 'off' ? 0 : e === 'reduced' ? 0.45 : 1;
    },
    // Whether anything is allowed to physically move.
    motion() { return this.get().effects === 'full'; },
    apply() {
      const s = this.get();
      B.SFX.setVolume(s.volume);
      B.SFX.setEnabled(s.sound);
      B.Music.setVolume(s.musicVolume);
      B.Music.setEnabled(s.music);
      document.documentElement.style.setProperty('--fx', this.fx());
    }
  };

  const Screens = {
    show(id) {
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    },

    goMenu() {
      this.closeModal();
      this.show('menu');
      B.Main.refreshMenu();
      B.Music.play('menu');
    },

    // ---- generic modal ----
    modal(o) {
      const layer = $('modal-layer');
      this.closeModal();
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
      if (o.dismissible) {
        this.modalKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); if (o.onDismiss) o.onDismiss(); } };
        document.addEventListener('keydown', this.modalKey);
        layer.onclick = (e) => { if (e.target === layer) { this.closeModal(); if (o.onDismiss) o.onDismiss(); } };
      }
      return layer.querySelector('.modal');
    },

    closeModal() {
      if (this.modalKey) document.removeEventListener('keydown', this.modalKey);
      this.modalKey = null;
      const layer = $('modal-layer');
      layer.onclick = null;
      layer.innerHTML = '';
    },

    confirm(title, body, okLabel, onOk) {
      this.modal({ title, body: `<p>${body}</p>`, dismissible: true, buttons: [{ label: 'Cancel' }, { label: okLabel, cls: 'primary', onClick: onOk }] });
    },

    prompt(title, body, value, okLabel, onOk) {
      this.modal({
        title, dismissible: true,
        body: `<p>${body}</p><input type="text" id="prompt-input" maxlength="22" value="${B.esc(value || '')}" style="width:100%">`,
        buttons: [
          { label: 'Cancel' },
          { label: okLabel, cls: 'primary', onClick: () => onOk(($('prompt-input') || {}).value) }
        ]
      });
      const inp = $('prompt-input');
      if (inp) setTimeout(() => { inp.focus(); inp.select(); }, 60);
    },

    howtoModal(onClose) {
      const html = $('screen-howto').querySelector('.howto').innerHTML;
      this.modal({ title: 'How to Play', body: html, wide: true, dismissible: true, onDismiss: onClose, buttons: [{ label: 'Got it', cls: 'primary', onClick: onClose }] });
    },

    // ---- day briefing ----
    briefing(g, b, onGo) {
      const d = B.Calendar.dayInfo(g.day);
      const dateLabel = g.mode.kind === 'story' && B.Calendar.storyLabel ? B.Calendar.storyLabel(g.day) : d.long;
      const rules = b.rules && b.rules.length ? `<div class="rules-list">${b.rules.map((r) => `<div>&#9656; ${r}</div>`).join('')}</div>` : '';
      // Sqwak posts show as posts (avatar, name, handle); everything else keeps
      // its channel label. Reply text stays hidden until the item is opened.
      const feed = (b.feed || []).map((item, i) => {
        const kind = B.esc(item.kind || 'wire');
        const src = item.src || (item.kind === 'chirp' ? item.source : null);
        if (src && B.Sqwak && String(src).charAt(0) === '@') {
          const a = B.Sqwak.account(src);
          return `<button class="preopen-item sq ${kind}" data-feed-item="${i}">
            <i class="sq-av" style="--av:var(--c-${a.col})">${B.esc(B.Sqwak.initials(a))}</i>
            <span class="sq-who"><b>${B.esc(a.name)}</b>${a.followers >= B.Sqwak.HYPE_MIN_FOLLOWERS ? '<i class="sq-v">&#10004;</i>' : ''}<span>${B.esc(a.handle)}</span></span>
            <strong>${B.esc(item.title || '')}</strong>
            <p hidden>${B.esc(item.text || '')}</p>
          </button>`;
        }
        return `<button class="preopen-item ${kind}" data-feed-item="${i}">
        <span><b>${B.esc(item.source || 'THE WIRE')}</b>${item.locked ? ' · PAYWALLED' : ''}</span>
        <strong>${B.esc(item.title || 'Before the bell')}</strong>
        <p hidden>${B.esc(item.text || '')}</p>
      </button>`;
      }).join('');
      const phone = feed ? `<section class="preopen-device" aria-label="Pre-open phone feed">
        <div class="preopen-speaker" aria-hidden="true"></div>
        <div class="preopen-screen">
          <div class="preopen-status"><span>6:38</span><i></i><span>LTE&nbsp;▮▮▮</span></div>
          <div class="preopen-top"><span class="sq-logo">sqwak</span>${b.anomalyCount == null ? '<b>NOTIFICATIONS</b>' : `<b>ANOMALIES: ${b.anomalyCount}</b>`}</div>
          <div class="preopen-scroll">${feed}</div>
        </div>
        <div class="preopen-home" aria-hidden="true"></div>
      </section>` : '';
      const stats = `<div class="stats">
        <div class="stat"><div class="l">Equity</div><div class="v">${F.money(g.broker.equity())}</div></div>
        <div class="stat quota-stat"><div class="l">${b.quotaMeta ? B.esc(b.quotaMeta.label) : 'Today\'s quota'}</div><div class="v">${b.quota > 0 ? F.money(b.quota) : 'none'}</div>${b.quotaMeta ? `<div class="quota-delta">${(b.quotaMeta.pct * 100).toFixed(2)}% of book${b.quotaMeta.raised ? ` · ${b.quotaMeta.raised > 0 ? '↑' : '↓'} ${Math.abs(b.quotaMeta.raised)}% overnight` : ''}</div>` : ''}</div>
        <div class="stat"><div class="l">Open positions</div><div class="v">${Object.keys(g.broker.pos).length + g.broker.opts.length}</div></div>
        ${b.weekQuota ? `<div class="stat quota-stat week-stat"><div class="l">Weekly quota</div><div class="v">${F.money(b.weekQuota.target)}</div><div class="quota-delta">${F.money(b.weekQuota.made, true)} so far · ${b.weekQuota.left} session${b.weekQuota.left === 1 ? '' : 's'} left</div></div>` : ''}
        ${b.quotaStrikes ? `<div class="stat strike-stat"><div class="l">Career strikes</div><div class="v">${b.quotaStrikes.count} / ${b.quotaStrikes.limit}</div></div>` : ''}
      </div>`;
      const anomalyHelp = b.anomalyCount == null ? '' : '<p class="anomaly-help"><b>Anomalies</b> are unusual details hidden in pre-open items. Open a suspicious item to inspect it. Enough verified anomalies can unlock the final systems decision.</p>';
      const mandate = b.quotaMeta ? `<div class="quota-order"><span>DESK MANDATE</span><p>${B.esc(b.quotaMeta.memo)}</p></div>` : '';
      B.Music.play('brief');
      const opened = new Set();
      const el = this.modal({
        kicker: `${b.kicker || ''} ${dateLabel}`,
        title: b.title,
        body: `<div class="briefing-layout">${phone}<div class="briefing-dossier">${stats + anomalyHelp + mandate + (b.html || '') + rules}</div></div>`,
        wide: true,
        buttons: [
          { label: 'Menu', onClick: () => this.pauseFromBriefing(g, b, onGo), cls: 'ghost' },
          ...(feed ? [{ label: 'Skip Feed', keep: true, onClick: () => {
            if (!opened.size && g.mode.onFeedSkip) g.mode.onFeedSkip(g);
            const scroll = el.querySelector('.preopen-scroll');
            if (scroll) scroll.hidden = true;
          }}] : []),
          { label: 'Ring the Opening Bell', cls: 'primary', onClick: () => {
            if (feed && !opened.size && g.mode.onFeedSkip) g.mode.onFeedSkip(g);
            B.SFX.unlock(); onGo();
          } }
        ]
      });
      el.querySelectorAll('[data-feed-item]').forEach((node) => node.addEventListener('click', () => {
        B.SFX.click();
        const i = +node.dataset.feedItem;
        const item = b.feed[i];
        const detail = node.querySelector('p');
        if (detail) detail.hidden = !detail.hidden;
        if (!opened.has(i)) {
          opened.add(i);
          node.classList.add('opened');
          if (g.mode.onFeedOpen) g.mode.onFeedOpen(g, item);
          const count = el.querySelector('.preopen-top b');
          if (count && item.anomalyId) count.textContent = `ANOMALIES: ${g.mode.S.anomalies}`;
        }
      }));
    },

    pauseFromBriefing(g, b, onGo) {
      const back = () => this.briefing(g, b, onGo);
      this.modal({
        title: 'Paused',
        body: '<p>You are between trading days. Saving now keeps your progress up to the last closing bell.</p>',
        buttons: [
          { label: 'Quit to Menu', cls: 'ghost', onClick: () => g.quit() },
          { label: 'How to Play', onClick: () => this.howtoModal(back) },
          {
            label: 'Save & Quit',
            onClick: () => {
              if (g.saveNow()) { B.UI.toast(`Saved to slot ${g.slot + 1}.`, 'good'); g.quit(); }
              else { B.UI.toast('No free save slot. Free one up from Load Game.', 'bad'); back(); }
            }
          },
          { label: 'Back to Briefing', cls: 'primary', onClick: back }
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
          <div class="stat"><div class="l">Best trade</div><div class="v ${r.best == null ? 'muted' : F.cls(r.best)}">${r.best == null ? 'none closed' : F.money(r.best, true)}</div></div>
          <div class="stat"><div class="l">Worst trade</div><div class="v ${r.worst == null ? 'muted' : F.cls(r.worst)}">${r.worst == null ? 'none closed' : F.money(r.worst, true)}</div></div>
          <div class="stat"><div class="l">Stress peak</div><div class="v ${r.stressPeak > 80 ? 'down' : r.stressPeak > 50 ? 'amber' : ''}">${Math.round(r.stressPeak)}</div></div>
          ${r.quotaStrikeLimit ? `<div class="stat strike-stat"><div class="l">Career strikes</div><div class="v">${r.quotaStrikes} / ${r.quotaStrikeLimit}</div>${r.quotaStrikeLimit - r.quotaStrikes === 1 ? '<div class="quota-delta">FINAL WARNING · ONE MISS LEFT</div>' : ''}</div>` : ''}
        </div>
        ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}`;
      this.modal({
        kicker: r.earlyEnd === 'wiped' ? 'ACCOUNT TERMINATED' : 'CLOSING BELL',
        title: r.date,
        body,
        buttons: [{ label: 'Continue', cls: 'primary', onClick: onNext }]
      });
    },

    // ---- Sunday ledger: the one weekly money decision ----
    ledger(v, onPick) {
      const w = v.wallet, T = v.tiers[w.tier | 0];
      const opts = v.options.filter((o) => !o.current);
      const body = `
        <div class="stats">
          <div class="stat"><div class="l">Cash</div><div class="v ${F.cls(w.cash)}">${F.money(w.cash)}</div></div>
          <div class="stat"><div class="l">Card</div><div class="v ${w.card > 0 ? 'down' : ''}">${w.card > 0 ? F.money(-w.card) : '$0'}</div></div>
          <div class="stat"><div class="l">Rent owed</div><div class="v ${w.arrears > 0 ? 'down' : ''}">${F.money(w.arrears)}</div></div>
          <div class="stat"><div class="l">Unearned draw</div><div class="v ${w.deficit > 0 ? 'amber' : ''}">${F.money(w.deficit)}</div></div>
          <div class="stat"><div class="l">Net worth</div><div class="v ${F.cls(v.worth)}">${F.money(v.worth)}</div></div>
        </div>
        <p>You live in ${w.tier | 0 ? 'the ' : ''}<b>${T.name}</b>${T.rent ? `: ${F.money(T.rent * (w.rentMult || 1))} a week` : ''}. ${T.note}</p>
        <p class="muted">Your draw pays about ${F.money(v.draw)} a week after tax, plus quota pay: ${F.money(v.quotaPay)} for each day you make quota, before tax. Moving up costs two weeks of the new rent up front, and you need a week's costs left over; moving down is free. A better home means less stress in the morning and calmer hands at the desk. Unearned draw is repaid only out of future bonus.</p>`;
      const after = `<div class="choice-list">
        <button class="choice-btn" data-tier=""><b>Stay put</b><span>${T.name} · ${F.money(T.rent * (w.rentMult || 1))} rent · ${F.money(v.weekly)}/week all in</span></button>
        ${opts.map((o) => `<button class="choice-btn" data-tier="${o.i}" ${o.afford ? '' : 'disabled'}><b>${o.i < (w.tier | 0) ? 'Move down' : 'Move up'}: ${o.name}</b><span>${F.money(o.rent)} rent · ${F.money(o.weekly)}/week all in${o.cost ? ` · ${F.money(o.cost)} to move in` : ''}${o.afford ? '' : ' · you cannot afford it'} · ${o.note}</span></button>`).join('')}
      </div>`;
      const el = this.modal({ kicker: 'SUNDAY · YOUR MONEY', title: 'The Ledger', body, after, wide: true });
      el.querySelectorAll('.choice-btn').forEach((btn) => btn.addEventListener('click', () => {
        if (btn.disabled) return;
        B.SFX.unlock();
        this.closeModal();
        onPick(btn.dataset.tier === '' ? null : +btn.dataset.tier);
      }));
    },

    // ---- story choice ----
    choice(c, S, onPick) {
      const opts = c.options.filter((o) => !o.req || o.req(S));
      const body = `<div class="speaker"><canvas class="portrait" data-portrait="${B.esc(c.speaker)}" aria-label="Pixel portrait of ${B.esc(c.speaker)}"></canvas><div><b>${c.speaker}</b><span>${c.role || ''}</span></div></div>` +
        c.text.map((p) => `<p>${p}</p>`).join('');
      const after = `<div class="choice-list">${opts.map((o) => `<button class="choice-btn" data-opt="${o.id}"><b>${o.label}</b>${o.hint ? `<span>${o.hint}</span>` : ''}</button>`).join('')}</div>`;
      const el = this.modal({ kicker: c.kicker || 'DECISION', title: c.title, body, after, wide: true });
      if (B.Portraits) B.Portraits.drawAll(el);
      B.SFX.choice();
      el.querySelectorAll('.choice-btn').forEach((btn) => btn.addEventListener('click', () => {
        B.SFX.unlock();
        onPick(btn.dataset.opt);
      }));
    },

    // Short follow-up after a choice.
    aftermath(title, text, onNext, art) {
      const pic = art && B.DecisionArt ? '<canvas class="aftermath-art" width="640" height="360" aria-hidden="true"></canvas>' : '';
      const el = this.modal({ title, body: pic + text.map((p) => `<p>${p}</p>`).join(''), buttons: [{ label: 'Continue', cls: 'primary', onClick: onNext }] });
      if (pic && el) B.DecisionArt.still(el.querySelector('.aftermath-art'), art);
    },

    // ---- endings ----
    ending(g, ending) {
      const dark = !!ending.dark || ending.good === false || /^(wiped|fired|perp|depression|replaced)$/.test(ending.id);
      const track = dark ? 'endingDark' : 'endingLight';
      const show = () => {
        if (B.Cinematic.endChain) B.Cinematic.endChain();
        B.Music.play(track);
        if (g.mode.kind === 'story') this.storyEnding(g, ending);
        else this.endlessEnding(g, ending);
      };
      if (B.Cinematic.startChain) B.Cinematic.startChain('ending');
      const pulled = !!(g.mode && g.mode.S && g.mode.S.f && g.mode.S.f.pulledPlug);
      B.Cinematic.play('ending', { id: ending.id, title: ending.title, deck: ending.deck, dark, pulled }, show);
    },

    storyEnding(g, e) {
      const scr = document.createElement('section');
      scr.id = 'screen-ending-page';
      document.querySelectorAll('#screen-ending-page').forEach((x) => x.remove());
      scr.className = 'screen active';
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      const tally = B.Save.careerTally();
      const found = Object.keys(tally).length;
      const wealthLabel = e.unpriced ? '<span id="unpriced-value" class="unpriced">$482,119.07</span>' : F.money(e.wealth);
      const returnLabel = e.unpriced ? 'UNPRICED' : F.pct(e.wealth / g.startCapital - 1);
      scr.innerHTML = `<div class="ending-scroll"><article class="paper">
        <div class="mast"><h1>The Daily Ledger</h1><div class="row"><span>${B.Calendar.storyLabel(g.day)}</span><span>Final Edition</span><span>$2.00</span></div></div>
        <div class="hl">${e.headline}</div>
        <div class="deck">${e.deck}</div>
        <div class="cols">
          <div class="lead">${e.story.map((p) => `<p>${p}</p>`).join('')}</div>
          <div class="side">
            <h4>How We Got Here</h4>
            <ul>${(e.timeline || []).map((t) => `<li>${t}</li>`).join('') || '<li>You kept your head down.</li>'}</ul>
            <div class="box">
              <div><span>ENDING</span><b>${e.title}</b></div>
              <div><span>Reached</span><b>${tally[e.id] || 1}x</b></div>
              <div><span>Final book</span><b>${wealthLabel}</b></div>
              ${e.personal ? `<div><span>Your own money</span><b class="${e.personal.label ? '' : F.cls(e.personal.worth)}">${e.personal.label || F.money(e.personal.worth)}</b></div><div><span>Home</span><span>${e.personal.home}</span></div>` : ''}
              <div><span>Starting capital</span><span>${F.money(g.startCapital)}</span></div>
              <div><span>Return</span><b>${returnLabel}</b></div>
              <div><span>Index, campaign</span><span>${F.pct(e.indexMonth || 0)}</span></div>
              <div><span>Days traded</span><span>${g.history.length}</span></div>
              <div><span>Endings found</span><span>${found} / ${B.StoryEndings.list.length}</span></div>
            </div>
          </div>
        </div>
      </article>
      <div class="paper-actions">
        <button class="btn primary" id="end-menu">Main Menu</button>
        <button class="btn" id="end-again">New Career</button>
        <button class="btn ghost" id="end-gallery">Endings</button>
      </div></div>`;
      $('app').appendChild(scr);
      if (e.unpriced) this.animateUnpriced($('unpriced-value'));
      B.SFX.closeBell();
      const leave = () => { scr.remove(); B.UI.leaveGame(); };
      $('end-menu').addEventListener('click', leave);
      $('end-again').addEventListener('click', () => { scr.remove(); B.UI.g = null; B.Main.newStory(); });
      $('end-gallery').addEventListener('click', () => { scr.remove(); B.UI.g = null; B.UI.leaveGame(); this.showEndings(); });
    },

    animateUnpriced(el) {
      if (!el) return;
      const glyphs = '0123456789$€¥£,.;:#?';
      let tick = 0;
      const timer = setInterval(() => {
        tick++;
        if (!el.isConnected || tick >= 80) {
          clearInterval(timer);
          if (el.isConnected) el.textContent = 'UNPRICED';
          return;
        }
        const len = Math.min(24, 10 + Math.floor(tick / 8));
        let s = tick < 24 ? '$' : '';
        for (let i = s.length; i < len; i++) s += glyphs[(tick * 7 + i * 11) % glyphs.length];
        el.textContent = s;
      }, 125);
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
      const tally = B.Save.careerTally();
      const found = Object.keys(tally).length;
      const total = B.StoryEndings.list.length;
      const runs = B.Save.totalRuns();
      $('endings-list').innerHTML =
        `<p class="endings-summary">${found} of ${total} endings found across ${runs} finished ${runs === 1 ? 'career' : 'careers'}.</p>` +
        B.StoryEndings.list.map((e) => {
          const n = tally[e.id] || 0;
          return `<div class="ending-row ${n ? '' : 'locked'}"><div class="ico">${n ? e.icon : '&#128274;'}</div>
            <div><b>${n ? e.title : '???'}</b><span>${n ? e.hint : e.lockedHint}</span></div>
            <div class="count">${n ? '&times;' + n : ''}</div></div>`;
        }).join('');
      this.show('endings');
    },

    renderSettings() {
      const s = B.Settings.get();
      $('settings-form').innerHTML = `
        <div class="fieldset">
          <h3>Audio</h3>
          <div class="check"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><label for="set-sound">Sound effects</label><span></span></div>
          <div class="field"><label for="set-vol">SFX volume</label><input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}"><output id="set-vol-o">${Math.round(s.volume * 100)}%</output></div>
          <div class="check"><input type="checkbox" id="set-music" ${s.music ? 'checked' : ''}><label for="set-music">Music</label><span></span></div>
          <div class="field"><label for="set-mvol">Music volume</label><input type="range" id="set-mvol" min="0" max="1" step="0.05" value="${s.musicVolume}"><output id="set-mvol-o">${Math.round(s.musicVolume * 100)}%</output></div>
          <button class="btn small" id="set-test">Test sound</button>
        </div>
        <div class="fieldset" style="margin-top:14px">
          <h3>Comfort</h3>
          <div class="field"><label for="set-fx">Screen effects</label>
            <select id="set-fx">
              <option value="full">Full (shake, vignette, chart jitter)</option>
              <option value="reduced">Reduced (soft vignette, no movement)</option>
              <option value="off">Off</option>
            </select><output></output></div>
          <div class="field"><label for="set-cine">Cinematics</label>
            <select id="set-cine">
              <option value="full">Full</option>
              <option value="short">Short (one card)</option>
              <option value="off">Skip</option>
            </select><output></output></div>
          <div class="field"><label for="set-dl">Career day length</label>
            <select id="set-dl">
              <option value="120">2 minutes (frantic)</option>
              <option value="180">3 minutes (default)</option>
              <option value="300">5 minutes (relaxed)</option>
            </select><output></output></div>
        </div>
        <div class="fieldset" style="margin-top:14px">
          <h3>Data</h3>
          <button class="btn small danger" id="set-reset">Delete all saves, endings and leaderboards</button>
        </div>`;
      $('set-fx').value = s.effects;
      $('set-cine').value = s.cinematics;
      $('set-dl').value = String(s.storyDayLength);
      $('set-sound').addEventListener('change', (e) => B.Settings.set('sound', e.target.checked));
      $('set-vol').addEventListener('input', (e) => { B.Settings.set('volume', +e.target.value); $('set-vol-o').textContent = Math.round(e.target.value * 100) + '%'; });
      $('set-music').addEventListener('change', (e) => { B.Settings.set('music', e.target.checked); if (e.target.checked) B.Music.play('menu', true); });
      $('set-mvol').addEventListener('input', (e) => { B.Settings.set('musicVolume', +e.target.value); $('set-mvol-o').textContent = Math.round(e.target.value * 100) + '%'; });
      $('set-test').addEventListener('click', () => { B.SFX.unlock(); B.SFX.bell(); });
      $('set-fx').addEventListener('change', (e) => B.Settings.set('effects', e.target.value));
      $('set-cine').addEventListener('change', (e) => B.Settings.set('cinematics', e.target.value));
      $('set-dl').addEventListener('change', (e) => B.Settings.set('storyDayLength', +e.target.value));
      $('set-reset').addEventListener('click', () => this.confirm('Delete everything?', 'Removes every save slot, the endings tally and all leaderboards. This can\'t be undone.', 'Delete', () => {
        B.Save.wipe();
        B.UI.toast('All progress deleted.', 'warn');
        this.renderSettings();
      }));
    }
  };

  B.Screens = Screens;
})(window.BTB);
