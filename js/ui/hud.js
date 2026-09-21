// In-game HUD: the wall clock, the two monitors, the desk, and the stress effects.
(function (B) {
  'use strict';
  const $ = B.el;
  const F = B.fmt;

  // Dynamic tables are re-rendered several times a second, so their buttons act on
  // pointerdown (instant, never lost to a re-render) and on keyboard "click" (detail 0).
  function onPress(root, fn) {
    root.addEventListener('pointerdown', (e) => { if (e.button === 0) fn(e); });
    root.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
  }

  const UI = {
    g: null,
    sel: 'INDX',
    feedTab: 'wire',
    btTab: 'positions',
    feed: { wire: [], chirp: [], inbox: [] },
    unread: 0,
    lastRender: 0,
    lastPx: {},
    shakeAmt: 0,
    beatAcc: 0,
    tickAcc: 0,

    init() {
      B.Chart.init($('chart'));
      B.Ticket.init();

      onPress($('watch-list'), (e) => {
        const row = e.target.closest('.wl-row');
        if (row) this.select(row.dataset.sym);
      });
      document.querySelectorAll('.tf button').forEach((b) => b.addEventListener('click', () => {
        B.Chart.tf = +b.dataset.tf;
        document.querySelectorAll('.tf button').forEach((x) => x.classList.toggle('on', x === b));
      }));
      document.querySelectorAll('.feed-tabs button').forEach((b) => b.addEventListener('click', () => {
        this.feedTab = b.dataset.feed;
        document.querySelectorAll('.feed-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        if (this.feedTab === 'inbox') { this.unread = 0; this.updateBadge(); }
        this.renderFeed();
      }));
      document.querySelectorAll('.bt-tabs button').forEach((b) => b.addEventListener('click', () => {
        this.btTab = b.dataset.bt;
        document.querySelectorAll('.bt-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        this.renderBottom(true);
      }));
      onPress($('bt-content'), (e) => {
        const btn = e.target.closest('button[data-act]');
        if (btn) {
          e.preventDefault();
          const g = this.g;
          if (!g) return;
          const a = btn.dataset.act, id = btn.dataset.id;
          if (a === 'close') g.closePos(id);
          else if (a === 'half') g.closePos(id, 0.5);
          else if (a === 'cancel') g.cancelOrder(+id);
          else if (a === 'sellopt') g.sellOption(+id);
          this.renderBottom(true);
          return;
        }
        const row = e.target.closest('tr[data-sym]');
        if (row) this.select(row.dataset.sym);
      });
      onPress($('phone'), (e) => {
        const btn = e.target.closest('button');
        if (!btn || !this.g) return;
        e.preventDefault();
        B.SFX.unlock();
        if (btn.dataset.ph === 'answer') this.g.interrupts.answer();
        else if (btn.dataset.ph === 'decline') this.g.interrupts.miss();
        else if (btn.dataset.ph === 'hang') this.g.interrupts.hangup();
        else if (btn.dataset.opt) this.g.interrupts.resolveChoice(btn.dataset.opt, false);
      });
      onPress($('tasks'), (e) => {
        const btn = e.target.closest('button[data-task]');
        if (btn && this.g) { e.preventDefault(); this.g.interrupts.executeTask(btn.dataset.task); }
      });
      $('btn-coffee').addEventListener('click', () => this.g && this.g.coffee());
      $('btn-pause').addEventListener('click', () => this.g && this.g.togglePause());
      $('btn-focus').addEventListener('click', () => {
        const on = document.body.classList.toggle('focus');
        B.Settings.set('focusMode', on);
      });
      $('btn-resume').addEventListener('click', () => this.g && this.g.togglePause(false));
      $('btn-save').addEventListener('click', () => this.saveFromPause(false));
      $('btn-save-quit').addEventListener('click', () => this.saveFromPause(true));
      $('btn-quit').addEventListener('click', () => {
        if (!this.g) return;
        B.Screens.confirm('Quit without saving?',
          'Anything since your last save is lost.', 'Quit', () => {
            this.pause(false);
            this.g.quit();
          });
      });
      $('btn-howto-ingame').addEventListener('click', () => B.Screens.howtoModal());
      document.addEventListener('keydown', (e) => this.key(e));
    },

    saveFromPause(thenQuit) {
      const g = this.g;
      if (!g) return;
      if (g.slot == null && B.Save.firstEmpty() < 0) {
        B.Screens.confirm('All six slots are full',
          'Free one up on the Load Game screen, then come back and save.', 'OK', () => {});
        return;
      }
      const ok = g.saveNow();
      if (!ok) return this.toast('Could not save. Browser storage may be full.', 'bad');
      const meta = B.Save.meta(g.slot);
      this.toast(`Saved to slot ${g.slot + 1}: ${meta ? meta.name : ''}`, 'good');
      this.refreshPauseSlot();
      if (thenQuit) { this.pause(false); g.quit(); }
    },

    refreshPauseSlot() {
      const g = this.g;
      const el = $('pause-slot');
      if (!el) return;
      if (!g) { el.textContent = ''; return; }
      const meta = g.slot != null ? B.Save.meta(g.slot) : null;
      el.textContent = meta
        ? `Slot ${g.slot + 1} · ${meta.name} · last saved ${B.timeAgo(meta.ts)}`
        : 'Not saved yet. Saving will use the first free slot.';
    },

    key(e) {
      const g = this.g;
      if (!g || !$('screen-game').classList.contains('active')) return;
      if (document.querySelector('#modal-layer .modal')) return;
      if (B.Cinematic.running) return;
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
      if (e.key === 'Escape') { e.preventDefault(); if (typing) document.activeElement.blur(); else g.togglePause(); return; }
      if (typing && e.key !== 'Enter') return;
      if (g.paused) return;
      B.SFX.unlock();
      const k = e.key.toLowerCase();
      if (typing && e.key === 'Enter') { document.activeElement.blur(); return; }
      if (k === 'b') { e.preventDefault(); B.Ticket.send(1); }
      else if (k === 's') { e.preventDefault(); B.Ticket.send(-1); }
      else if (k === 'c') { e.preventDefault(); g.closePos(this.sel); }
      else if (k === 'x') { e.preventDefault(); g.flatten(); }
      else if (k === 'a') { e.preventDefault(); g.interrupts.answer(); }
      else if (k >= '1' && k <= '5') { e.preventDefault(); B.Ticket.sizePct([0.1, 0.25, 0.5, 0.75, 1][+k - 1]); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = g.market.tickers.map((t) => t.sym);
        const i = list.indexOf(this.sel);
        this.select(list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]);
      }
    },

    select(sym) {
      this.sel = sym;
      const tk = this.g.market.bySym[sym];
      $('ch-sym').textContent = sym;
      $('ch-name').textContent = tk.name;
      if ($('tk-type').value !== 'market') $('tk-price').value = tk.last.toFixed(2);
      B.Ticket.renderChain(true);
      this.render(true);
    },

    enterGame(g) {
      this.g = g;
      this.feed = { wire: [], chirp: [], inbox: [] };
      this.unread = 0;
      this.updateBadge();
      this.lastPx = {};
      document.body.classList.toggle('focus', !!B.Settings.get().focusMode);
      $('wall-date').textContent = B.Calendar.dayInfo(g.day).label;
      B.Screens.show('game');
      this.select('INDX');
    },

    leaveGame() {
      this.g = null;
      this.unlock();
      this.pause(false);
      $('mc-banner').hidden = true;
      document.documentElement.style.setProperty('--stress', 0);
      $('game-root').style.transform = '';
      B.Screens.goMenu();
    },

    dayStart(g) {
      const d = B.Calendar.dayInfo(g.day);
      $('wall-date').textContent = d.label;
      const sep = { kind: 'sep', text: `— ${d.label} · OPENING BELL —` };
      this.feed.wire.unshift(sep);
      this.feed.chirp.unshift(sep);
      this.renderFeed();
      this.render(true);
    },

    dayEnd() {
      $('mc-banner').hidden = true;
      this.render(true);
    },

    // ---- feed ----
    addNews(e) {
      const kind = e.kind === 'chirp' ? 'chirp' : 'wire';
      const item = { kind, text: e.text, src: e.src || (kind === 'chirp' ? '@anon' : 'NEWSWIRE'), t: e.t, big: e.big };
      this.feed[kind].unshift(item);
      if (this.feed[kind].length > 120) this.feed[kind].pop();
      if (kind === 'wire') B.SFX.news();
      this.renderFeed();
    },

    inbox(msg) {
      this.feed.inbox.unshift({ kind: 'inbox', text: msg.text, src: msg.from, t: this.g ? this.g.market.t : 0 });
      if (this.feedTab !== 'inbox') { this.unread++; this.updateBadge(); }
      B.SFX.news();
      this.renderFeed();
      if (msg.toast !== false) this.toast(`${msg.from}: ${msg.text.length > 90 ? msg.text.slice(0, 88) + '…' : msg.text}`, 'warn');
    },

    // Feeds are part of a save: coming back to a session with an empty Wire
    // would lose the whole narrative thread of the day.
    snapshotFeed() {
      const trim = (a) => a.slice(0, 60);
      return { wire: trim(this.feed.wire), chirp: trim(this.feed.chirp), inbox: trim(this.feed.inbox), unread: this.unread };
    },

    restoreFeed(f) {
      if (!f) return;
      this.feed = { wire: f.wire || [], chirp: f.chirp || [], inbox: f.inbox || [] };
      this.unread = f.unread || 0;
      this.updateBadge();
      this.renderFeed();
    },

    updateBadge() {
      $('inbox-badge').hidden = !this.unread;
      $('inbox-badge').textContent = this.unread;
    },

    renderFeed() {
      const list = this.feed[this.feedTab];
      if (!list.length) { $('feed-list').innerHTML = '<div class="empty">Nothing yet.</div>'; return; }
      $('feed-list').innerHTML = list.slice(0, 80).map((n) => {
        if (n.kind === 'sep') return `<div class="news sep">${B.esc(n.text)}</div>`;
        return `<div class="news ${n.kind}${n.big ? ' big' : ''}"><div class="meta"><span>${B.Calendar.fmtTime(n.t || 0)}</span><span class="src">${B.esc(n.src)}</span></div><div class="txt">${B.esc(n.text)}</div></div>`;
      }).join('');
    },

    // ---- phone ----
    phoneRing(call) {
      const p = $('phone');
      p.hidden = false;
      p.classList.add('ringing');
      p.innerHTML = `<div class="ph-top"><div><div class="ph-from">&#9742; ${B.esc(call.from)}</div><div class="ph-role">${B.esc(call.role || 'Incoming call')}</div></div>
        <div><button class="btn small buy" data-ph="answer">Answer <kbd>A</kbd></button>${call.kind === 'choice' ? '' : ' <button class="btn small" data-ph="decline">Ignore</button>'}</div></div>
        <div class="ph-timer" id="ph-timer" style="width:100%"></div>`;
      this.ringTimer = true;
      B.SFX.ring();
      this.ringAcc = 0;
    },

    phoneOpen(call) {
      const p = $('phone');
      p.classList.remove('ringing');
      this.ringTimer = false;
      let body = `<div class="ph-top"><div><div class="ph-from">${B.esc(call.from)}</div><div class="ph-role">${B.esc(call.role || '')}</div></div>`;
      body += call.kind === 'choice' ? '</div>' : '<button class="btn small" data-ph="hang">Hang up</button></div>';
      body += `<div class="ph-text">${B.esc(call.text)}</div>`;
      if (call.kind === 'choice') {
        body += '<div class="ph-opts">' + call.options.map((o) => `<button class="btn" data-opt="${o.id}">${B.esc(o.label)}</button>`).join('') + '</div>';
        body += '<div class="ph-timer" id="ph-timer" style="width:100%"></div>';
      }
      p.innerHTML = body;
      B.SFX.choice();
    },

    phoneHide() {
      $('phone').hidden = true;
      $('phone').classList.remove('ringing');
      this.ringTimer = false;
    },

    renderTasks(tasks) {
      const open = (tasks || []).filter((t) => !t.done);
      $('tasks').innerHTML = open.map((t) => `<div class="task"><span>Client: <b>${B.esc(t.label)}</b> · fee ${F.money(t.fee)} <em class="muted" data-deadline="${t.id}"></em></span><button class="btn small" data-task="${t.id}">Execute</button></div>`).join('');
    },

    // ---- overlays ----
    toast(text, cls) {
      const el = document.createElement('div');
      el.className = 'toast ' + (cls || '');
      el.textContent = text;
      const box = $('toasts');
      box.appendChild(el);
      while (box.children.length > 5) box.firstChild.remove();
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, (cls || '').includes('big') ? 4200 : 2800);
    },

    flash(color) {
      if (B.Settings.fx() <= 0) return;
      const f = $('flash');
      f.className = color;
      requestAnimationFrame(() => requestAnimationFrame(() => { f.className = ''; }));
    },

    // V1 shook the whole screen by up to 18px on a circuit breaker. Callers now
    // pass roughly half that, and the setting scales it again from there.
    shake(n) {
      if (!B.Settings.motion()) return;
      this.shakeAmt = Math.max(this.shakeAmt, n * B.Settings.fx());
    },

    lock(lock) {
      const o = $('lock-overlay');
      o.hidden = false;
      o.className = lock.kind === 'panic' ? 'panic' : '';
      const msg = {
        panic: '<div class="breathe"></div><h2>PANIC ATTACK</h2><p>Your chest is tight. The numbers are swimming. You can\'t make your hands work. Breathe in with the square. Your positions are still live.</p>',
        coffee: '<h2>COFFEE BREAK</h2><p>You step away from the screens. Your positions are still live. Try not to look.</p>',
        audit: '<h2>EXAMINERS</h2><p>Two people in grey suits are at your desk asking for your trade blotter. Your account is frozen until they leave.</p>'
      }[lock.kind] || `<h2>LOCKED</h2><p>${B.esc(lock.reason)}</p>`;
      o.innerHTML = `<div class="lock-box">${msg}<div class="lock-pnl" id="lock-pnl"></div><div class="muted" id="lock-left"></div></div>`;
    },

    unlock() { $('lock-overlay').hidden = true; },

    pause(on) {
      $('pause-overlay').hidden = !on;
      if (on) this.refreshPauseSlot();
    },

    // ---- per-frame ----
    frame(g, dt) {
      if (!g || g !== this.g) return;
      const s = g.stress.level();
      const fx = B.Settings.fx();
      const motion = B.Settings.motion();
      document.documentElement.style.setProperty('--stress', s);
      document.documentElement.style.setProperty('--fx', fx);

      // screen shake — gentler threshold and a third of V1's amplitude
      let amp = this.shakeAmt;
      if (motion && g.running && s > 0.72) amp = Math.max(amp, (s - 0.72) * 5 * fx);
      if (!motion) amp = 0;
      $('game-root').style.transform = amp > 0.3 ? `translate(${Math.round((Math.random() - 0.5) * amp)}px, ${Math.round((Math.random() - 0.5) * amp)}px)` : '';
      this.shakeAmt *= Math.pow(0.02, dt);

      // heartbeat + closing ticks
      if (g.running && !g.paused) {
        if (s > 0.35) {
          this.beatAcc += dt;
          const interval = 60 / (55 + s * 110);
          if (this.beatAcc >= interval) { this.beatAcc = 0; B.SFX.heartbeat(s); }
        }
        if (g.market.t > 375) {
          this.tickAcc += dt;
          if (this.tickAcc >= 0.5) { this.tickAcc = 0; B.SFX.tick(); }
        }
        if (this.ringTimer) {
          this.ringAcc += dt;
          if (this.ringAcc > 1.4) { this.ringAcc = 0; B.SFX.ring(); }
        }
      }

      const jitter = motion && g.running && s > 0.78 ? (s - 0.78) * 7 * fx : 0;
      B.Chart.draw(g, this.sel, jitter);

      const now = performance.now();
      if (now - this.lastRender > 125) {
        this.lastRender = now;
        this.render();
      }
    },

    render(force) {
      const g = this.g;
      if (!g) return;
      const m = g.market, b = g.broker;
      const s = g.stress.level();
      // Price display lag under heavy stress: sometimes the screen just doesn't update.
      const lagging = !force && g.running && s > 0.85 && Math.random() < (s - 0.85) * 2;

      // wall. Before the bell the market clock is still parked at yesterday's
      // close, so show the time the day is about to start from instead.
      const clock = $('tb-clock');
      clock.textContent = B.Calendar.fmtTime(!g.running && m.status === 'pre' ? 0 : m.t, true);
      clock.className = 'wall-clock' + (m.t > 375 && g.running ? ' final' : m.t > 330 && g.running ? ' late' : '');
      const st = $('tb-status');
      if (!g.running) { st.textContent = m.status === 'pre' ? 'PRE-MARKET' : 'CLOSED'; st.className = 'wall-plate status-closed'; }
      else if (m.halt) { st.textContent = `HALT L${m.halt.level}`; st.className = 'wall-plate status-halt'; }
      else { st.textContent = 'OPEN'; st.className = 'wall-plate status-open'; }

      // terminal stats
      const ip = m.indexDayPct();
      $('tb-indx').innerHTML = `${F.price(m.bySym.INDX.last)} <span class="${F.cls(ip)}">${F.pct(ip)}</span>`;
      const fear = m.bySym.FEAR.last;
      $('tb-fear').innerHTML = `<span class="${fear > 30 ? 'down' : fear > 20 ? 'amber' : 'up'}">${fear.toFixed(1)}</span>`;
      const eq = b.equity(), pnl = eq - b.dayStartEquity;
      const pe = $('tb-pnl');
      pe.textContent = F.money(pnl, true);
      pe.className = 'v ' + F.cls(pnl);
      $('tb-equity').textContent = F.money(eq);
      $('tb-bp').textContent = F.compact(b.buyingPower());
      if (g.quota > 0) {
        $('tb-quota-amt').textContent = F.money(g.quota);
        const qp = B.clamp(pnl / g.quota, 0, 1);
        $('tb-quota-bar').style.width = (qp * 100) + '%';
        $('tb-quota-bar').className = qp >= 1 ? 'met' : '';
      } else {
        $('tb-quota-amt').textContent = 'none';
        $('tb-quota-bar').style.width = '0%';
      }
      $('tb-stress-bar').style.width = (s * 100) + '%';
      $('tb-stress-num').textContent = Math.round(g.stress.v);

      // margin call banner
      const mc = $('mc-banner');
      if (b.mc && g.running) {
        mc.hidden = false;
        const left = Math.max(0, (b.mc.deadline - m.t) / g.rate);
        mc.innerHTML = `MARGIN CALL · ${left.toFixed(0)}s TO LIQUIDATION<br><small>equity ${F.money(b.netLiq())} · need ${F.money(b.maintenance())}</small>`;
      } else mc.hidden = true;

      // lock overlay details
      if (g.lock) {
        const lp = $('lock-pnl');
        if (lp) { lp.textContent = F.money(pnl, true); lp.className = 'lock-pnl ' + F.cls(pnl); }
        const ll = $('lock-left');
        if (ll) ll.textContent = `${Math.max(0, Math.ceil(g.lock.until - m.t))} market minutes left`;
      }

      // phone timers
      const a = g.interrupts.active;
      const pt = $('ph-timer');
      if (a && pt) {
        let frac = 1;
        if (a.state === 'ringing') frac = (a.ringEnd - m.t) / (g.interrupts.realMin(a.kind === 'choice' ? 10 : 6));
        else if (a.kind === 'choice') frac = (a.choiceEnd - m.t) / g.interrupts.realMin(a.timer || 20);
        pt.style.width = B.clamp(frac, 0, 1) * 100 + '%';
      }
      document.querySelectorAll('[data-deadline]').forEach((el) => {
        const t = g.interrupts.tasks.find((x) => x.id === el.dataset.deadline);
        if (t) el.textContent = `${Math.max(0, Math.ceil((t.deadline - m.t) / g.rate))}s`;
      });

      if (!lagging) this.renderWatch();
      // chart header
      const tk = m.bySym[this.sel];
      $('ch-price').textContent = F.price(tk.last);
      const cp = tk.last / tk.prevClose - 1;
      $('ch-chg').innerHTML = `<span class="${F.cls(cp)}">${F.money2(tk.last - tk.prevClose, true)} (${F.pct(cp)})</span> <span class="muted">H ${F.price(tk.high)} L ${F.price(tk.low)}</span>`;
      const p = b.pos[this.sel];
      $('ch-pos').textContent = p ? `${p.qty > 0 ? 'LONG' : 'SHORT'} ${F.qty(Math.abs(p.qty))} · ${F.money(b.unrealized(this.sel), true)}` : '';
      const hb = $('halt-banner');
      if (g.running && m.halt) { hb.hidden = false; hb.innerHTML = `MARKET-WIDE HALT<small>Level ${m.halt.level} circuit breaker · resumes ${B.Calendar.fmtTime(m.halt.until)}</small>`; }
      else if (g.running && tk.haltUntil > m.t) { hb.hidden = false; hb.innerHTML = `${this.sel} HALTED<small>Volatility pause · resumes ${B.Calendar.fmtTime(tk.haltUntil)}</small>`; }
      else hb.hidden = true;

      B.Ticket.render(g);
      this.renderBottom(force);
    },

    renderWatch() {
      const g = this.g, m = g.market, b = g.broker;
      const html = m.tickers.map((tk) => {
        const ch = tk.last / tk.prevClose - 1;
        const prev = this.lastPx[tk.sym];
        let fl = '';
        if (prev != null && Math.abs(tk.last / prev - 1) > 0.004) fl = tk.last > prev ? ' flash-up' : ' flash-down';
        this.lastPx[tk.sym] = tk.last;
        const q = b.posQty(tk.sym);
        const dot = q ? `<span class="pos-dot" style="background:${q > 0 ? 'var(--up)' : 'var(--down)'}"></span>` : '';
        const ban = b.rules.shortBan.includes(tk.sector) ? '<span class="ban-tag">NO SHORT</span>' : '';
        const halted = m.status === 'open' && tk.haltUntil > m.t ? ' halted' : '';
        return `<div class="wl-row${tk.sym === this.sel ? ' sel' : ''}${fl}${halted}" data-sym="${tk.sym}">
          <div class="wl-sym">${tk.sym}${dot}${ban}</div><div class="wl-px">${F.price(tk.last)}</div>
          <div class="wl-name">${B.esc(tk.name)}</div><div class="wl-chg ${F.cls(ch)}">${F.pct(ch)}</div></div>`;
      }).join('');
      $('watch-list').innerHTML = html;
    },

    renderBottom() {
      const g = this.g, b = g.broker, m = g.market;
      $('orders-count').hidden = !b.orders.length;
      $('orders-count').textContent = b.orders.length;
      $('bt-summary').textContent = `Lev ${b.leverage().toFixed(2)}x · Cash ${F.money(b.cash)} · Fees today ${F.money(b.fees - (b.dayFeesStart || 0))}`;
      let html = '';
      if (this.btTab === 'positions') {
        const syms = Object.keys(b.pos);
        if (!syms.length) html = '<div class="empty">Flat. No open positions.</div>';
        else {
          html = '<table class="tbl"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>Mkt Value</th><th>Unrealized</th><th>%</th><th></th></tr></thead><tbody>' +
            syms.map((s) => {
              const p = b.pos[s], last = m.bySym[s].last;
              const u = (last - p.avg) * p.qty;
              const pc = (last / p.avg - 1) * Math.sign(p.qty);
              return `<tr data-sym="${s}"><td>${s} <span class="${p.qty > 0 ? 'up' : 'down'}">${p.qty > 0 ? 'LONG' : 'SHORT'}</span></td><td>${F.qty(p.qty)}</td><td>${F.price(p.avg)}</td><td>${F.price(last)}</td><td>${F.money(p.qty * last)}</td><td class="${F.cls(u)}">${F.money(u, true)}</td><td class="${F.cls(pc)}">${F.pct(pc)}</td><td><button data-act="half" data-id="${s}">&frac12;</button><button data-act="close" data-id="${s}">Close</button></td></tr>`;
            }).join('') + '</tbody></table>';
        }
      } else if (this.btTab === 'orders') {
        if (!b.orders.length) html = '<div class="empty">No working orders.</div>';
        else html = '<table class="tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Type</th><th>Price</th><th>Last</th><th></th></tr></thead><tbody>' +
          b.orders.map((o) => {
            const qty = o.bracket ? -b.posQty(o.sym) : o.qty;
            return `<tr data-sym="${o.sym}"><td>${o.sym}</td><td class="${qty > 0 ? 'up' : 'down'}">${qty > 0 ? 'BUY' : 'SELL'}</td><td>${F.qty(Math.abs(qty))}</td><td>${o.label || o.type.toUpperCase()}</td><td>${F.price(o.price)}</td><td>${F.price(m.bySym[o.sym].last)}</td><td><button data-act="cancel" data-id="${o.id}">Cancel</button></td></tr>`;
          }).join('') + '</tbody></table>';
      } else if (this.btTab === 'opts') {
        if (!b.opts.length) html = '<div class="empty">No options. Open the Options tab on the ticket to buy calls or puts.</div>';
        else html = '<table class="tbl"><thead><tr><th>Contract</th><th>Qty</th><th>Avg</th><th>Mark</th><th>Value</th><th>P&amp;L</th><th></th></tr></thead><tbody>' +
          b.opts.map((o) => {
            const mark = B.Options.mid(m, o);
            const pl = (mark - o.avg) * o.qty * 100;
            return `<tr data-sym="${o.sym}"><td>${B.Options.label(o)}</td><td>${o.qty}</td><td>${F.price(o.avg)}</td><td>${F.price(mark)}</td><td>${F.money(mark * o.qty * 100)}</td><td class="${F.cls(pl)}">${F.money(pl, true)}</td><td><button data-act="sellopt" data-id="${o.id}">Sell</button></td></tr>`;
          }).join('') + '</tbody></table>';
      } else {
        const tr = b.dayTrades().slice().reverse();
        if (!tr.length) html = '<div class="empty">No trades today.</div>';
        else html = '<table class="tbl"><thead><tr><th>Time</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Realized</th><th>Note</th></tr></thead><tbody>' +
          tr.slice(0, 60).map((x) => `<tr><td>${B.Calendar.fmtTime(x.t)}</td><td>${B.esc(x.sym)}</td><td class="${x.qty > 0 ? 'up' : 'down'}">${F.qty(x.qty)}</td><td>${F.price(x.price)}</td><td class="${F.cls(x.realized)}">${F.money(x.realized, true)}</td><td class="muted">${B.esc(x.tag || '')}</td></tr>`).join('') + '</tbody></table>';
      }
      $('bt-content').innerHTML = html;
    }
  };

  B.UI = UI;
})(window.BTB);
