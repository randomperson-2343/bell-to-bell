// Trading-screen motion. Three things move on the terminal:
//   ticks   a price that changes lights its changed digits in its direction,
//           then steps back to plain over half a second (one step per HUD render);
//   fills   a trade lands: a chip flies from the ticket to the Positions drawer,
//           the chart marks it, the row lights, the P&L rolls to its new value;
//   swings  a hard move (B.Swing) hits: a banner slams onto the chart, the plot
//           washes in the move's colour, the watchlist row strobes, and a huge
//           move on a ticker you hold flashes the room.
// Colour changes are information and always happen. Anything that travels,
// rolls or shakes follows B.Motion.enabled() (Screen effects and the OS
// reduce-motion preference); washes and flashes scale with Screen effects.
(function (B) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const now = () => performance.now();
  const STEP = 125; // ms per colour step: the HUD renders text at this rate

  const Tape = {
    ticks: {},     // key -> { v, text, from, dir, at }
    counters: {},  // key -> { el, shown, target, fmt, cls }
    landed: {},    // sym -> when a fill last landed (positions row light)
    swings: {},    // sym -> { at, dir, level } (watchlist strobe)
    swingState: null,
    bannerTimer: 0,

    moving() { return B.Motion ? B.Motion.enabled() : !!(B.Settings && B.Settings.motion()); },
    fx() { return B.Settings ? B.Settings.fx() : 1; },

    init() {
      B.bus.on('fill', (tr) => this.onFill(tr));
      const banner = $('swing-banner');
      if (banner) banner.addEventListener('click', () => { const s = banner.dataset.sym; if (s && B.UI.g) B.UI.select(s); });
    },

    reset() {
      this.ticks = {}; this.landed = {}; this.swings = {};
      this.swingState = B.Swing ? B.Swing.create() : null;
      for (const k in this.counters) this.counters[k].shown = null;
      if (B.Chart.reset) B.Chart.reset();
      this.hideBanner(true);
    },

    // ---- ticks ----
    // HTML for a ticking value: the digits that changed since the last value sit
    // in a span stepping tk-u0..3 or tk-d0..3; after four steps it goes plain.
    // Always two spans, so the HUD's in-place patch keeps the same nodes.
    tick(key, value, text) {
      const at = now();
      let t = this.ticks[key];
      if (!t) t = this.ticks[key] = { v: value, text, from: text, dir: 0, at: -1e9 };
      else if (value !== t.v) {
        t.dir = value > t.v ? 1 : -1; t.at = at; t.from = t.text; t.v = value; t.text = text;
      } else t.text = text;
      const step = Math.floor((at - t.at) / STEP);
      const lit = t.dir && step <= 3;
      let i = 0;
      if (lit) while (i < text.length - 1 && text[i] === t.from[i]) i++;
      else i = text.length - 1;
      return `<span>${text.slice(0, i)}</span><span class="tk${lit ? ` tk-${t.dir > 0 ? 'u' : 'd'}${step}` : ''}">${text.slice(i)}</span>`;
    },
    // A class for something that should light in a direction for a moment: 'x-u0'..'x-d3' or ''.
    stepClass(prefix, at, dir, steps) {
      if (at == null) return '';
      const step = Math.floor((now() - at) / STEP);
      return step < (steps || 4) ? ` ${prefix}-${dir > 0 ? 'u' : 'd'}${step}` : '';
    },

    // ---- rolling numbers ----
    // count(key, el, target, fmt): el shows fmt(value), rolling toward target in frame().
    count(key, el, target, fmt) {
      let c = this.counters[key];
      if (!c || c.el !== el) c = this.counters[key] = { el, shown: null, target, fmt, last: '' };
      c.target = target; c.fmt = fmt;
      if (c.shown == null) { c.shown = target; this.paint(c); }
    },
    paint(c) {
      const text = c.fmt(c.shown);
      if (text !== c.last) { c.el.textContent = text; c.last = text; }
    },
    frame(dt) {
      const moving = this.moving();
      for (const k in this.counters) {
        const c = this.counters[k];
        if (c.shown == null || c.shown === c.target) continue;
        if (!moving) c.shown = c.target;
        else {
          c.shown += (c.target - c.shown) * (1 - Math.exp(-dt / 0.14));
          if (Math.abs(c.target - c.shown) < Math.max(0.5, Math.abs(c.target) * 1e-5)) c.shown = c.target;
        }
        this.paint(c);
      }
    },

    // ---- fills ----
    onFill(tr) {
      const UI = B.UI;
      if (!UI || !UI.g || !tr) return;
      this.landed[tr.sym] = now();
      B.Chart.land(tr);
      if (!this.moving()) return;
      const fromEl = tr.tag ? $('chart-wrap') : (tr.qty > 0 ? $('tk-buy') : $('tk-sell'));
      const toEl = document.querySelector('.bt-tabs [data-bt="positions"]');
      const text = `${tr.qty > 0 ? '+' : ''}${B.fmt.qty(tr.qty)} ${tr.sym}`;
      this.fly(text, fromEl, toEl, tr.qty > 0 ? 'up' : 'down');
      if (tr.closed && Math.abs(tr.realized) >= 1) {
        const pnl = $('tb-pnl');
        this.fly(B.fmt.money(tr.realized, true), pnl, null, tr.realized >= 0 ? 'up' : 'down', true);
      }
    },
    // A chip that travels from one element to another (or floats up from one) in pixel steps.
    fly(text, fromEl, toEl, dir, float) {
      if (!fromEl || typeof document.body.animate !== 'function') return;
      const a = fromEl.getBoundingClientRect();
      if (!a.width || !a.height) return;
      const b = toEl ? toEl.getBoundingClientRect() : null;
      if (toEl && (!b.width || !b.height)) return;
      const chip = document.createElement('div');
      chip.className = `fly-chip ${dir}`;
      chip.textContent = text;
      document.body.appendChild(chip);
      const w = chip.offsetWidth, h = chip.offsetHeight;
      const x0 = Math.round(a.left + a.width / 2 - w / 2), y0 = Math.round(a.top + a.height / 2 - h / 2);
      const x1 = b ? Math.round(b.left + b.width / 2 - w / 2) : x0, y1 = b ? Math.round(b.top + b.height / 2 - h / 2) : y0 - 34;
      const frames = float
        ? [{ transform: `translate(${x0}px, ${y0}px)`, opacity: 1 }, { transform: `translate(${x1}px, ${y1}px)`, opacity: 1, offset: 0.75 }, { transform: `translate(${x1}px, ${y1 - 6}px)`, opacity: 0 }]
        : [{ transform: `translate(${x0}px, ${y0}px)`, opacity: 1 }, { transform: `translate(${x1}px, ${y1}px)`, opacity: 1, offset: 0.85 }, { transform: `translate(${x1}px, ${y1}px)`, opacity: 0 }];
      const anim = chip.animate(frames, { duration: float ? 1100 : 560, easing: 'steps(8, end)', fill: 'forwards' });
      anim.onfinish = () => chip.remove();
      setTimeout(() => chip.remove(), 1500);
    },

    // ---- swings ----
    scan(g) {
      if (!this.swingState || !B.Swing || !g || !g.running) return;
      const UI = B.UI;
      for (const e of B.Swing.scan(this.swingState, g.market)) {
        this.swings[e.sym] = { at: now(), dir: e.dir, level: e.level };
        const held = !!g.broker.pos[e.sym];
        const sel = e.sym === UI.sel;
        if (sel) B.Chart.shock(e.dir, e.level);
        if (sel || held || e.sym === 'INDX') this.banner(e, held, sel);
        if (held && e.level > 1) {
          const gain = Math.sign(g.broker.pos[e.sym].qty) === e.dir;
          UI.flash(gain ? 'green' : 'red');
          UI.shake(3);
        }
      }
    },
    banner(e, held, sel) {
      const el = $('swing-banner');
      if (!el) return;
      const tk = B.UI.g.market.bySym[e.sym];
      el.dataset.sym = e.sym;
      el.className = `${e.dir > 0 ? 'up' : 'down'} lv${e.level}${this.moving() ? ' slam' : ''}${sel ? '' : ' other'}`;
      el.innerHTML = `<b>${e.dir > 0 ? '▲' : '▼'} ${B.esc(e.sym)} ${B.fmt.pct(e.pct)}</b><small>${e.level > 1 ? 'HUGE MOVE' : 'BIG MOVE'} · ${B.Swing.WINDOW} MIN${held ? ' · YOU HOLD IT' : ''}${sel ? '' : ' · CLICK TO VIEW'}</small>`;
      el.title = tk ? tk.name : '';
      el.hidden = false;
      // restart the slam animation
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => this.hideBanner(), e.level > 1 ? 3200 : 2400);
    },
    hideBanner(now) {
      const el = $('swing-banner');
      if (!el) return;
      clearTimeout(this.bannerTimer);
      if (now || !this.moving()) { el.hidden = true; return; }
      el.classList.add('out');
      this.bannerTimer = setTimeout(() => { el.hidden = true; }, 200);
    }
  };

  B.Tape = Tape;
})(window.BTB);
