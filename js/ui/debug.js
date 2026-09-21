// Debug overlay (?debug=1): time controls, day jumps, hidden story meters, forced events.
(function (B) {
  'use strict';
  const $ = B.el;

  B.Debug = {
    init() {
      const p = $('debug-panel');
      p.hidden = false;
      setInterval(() => this.render(), 500);
      this.render();
      p.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button[data-dbg]');
        if (b) this.act(b.dataset.dbg, b.dataset.v);
      });
    },

    act(a, v) {
      const g = B.UI.g;
      if (a === 'speed' && g) g.speed = +v;
      else if (a === 'close' && g && g.running) g.market.t = B.DAY_MIN - 0.3;
      else if (a === 'stress' && g) g.stress.v = +v;
      else if (a === 'mc' && g) g.broker.cash -= g.broker.equity() * 0.9;
      else if (a === 'crash' && g && g.running) g.market.injectEvent({ t: g.market.t, text: 'DEBUG CRASH', big: true, impacts: [{ scope: 'market', id: '', pct: -0.09, over: 0.1 }] });
      else if (a === 'story') this.jump(+prompt('Jump career to day (1-' + B.StoryData.DAYS.length + '):', '13') - 1);
      else if (a === 'cine') B.Cinematic.play(v, { brief: { title: 'Debug cinematic', kicker: 'DEBUG' }, report: { pnl: 12345, quotaMet: true, quota: 1 }, title: 'Debug', deck: 'Debug ending card', dark: v === 'ending' }, () => {});
      else if (a === 'saveload' && g) {
        const snap = g.snapshot();
        B.UI.toast('Snapshot taken at ' + B.Calendar.fmtTime(g.market.t) + ' (' + JSON.stringify(snap).length + ' bytes)', 'warn');
        g.quit();
        const g2 = snap.kind === 'story' ? new B.Game(B.StoryMode(snap.mode), snap) : new B.Game(B.EndlessMode(snap.mode.cfg, snap.mode), snap);
        g2.begin();
      }
      else if (a === 'meter' && g && g.mode.S && g.mode.S.m) {
        const [k, d] = v.split(':');
        const S = g.mode.S;
        if (k in S.m) S.m[k] = B.clamp(S.m[k] + +d, 0, 100);
        else S.rel[k] = B.clamp(S.rel[k] + +d, 0, 100);
      }
      this.render();
    },

    jump(d) {
      if (!(d >= 0 && d < B.StoryData.DAYS.length)) return;
      if (B.UI.g) B.UI.g.quit();
      B.Screens.closeModal();
      const g = new B.Game(B.StoryMode());
      g.day = d;
      g.begin();
    },

    render() {
      const g = B.UI.g;
      let meters = '';
      if (g && g.mode.kind === 'story') {
        const S = g.mode.S;
        const row = (k, v) => `<div><span>${k}</span><span>${Math.round(v)} <button data-dbg="meter" data-v="${k}:-10">-</button><button data-dbg="meter" data-v="${k}:10">+</button></span></div>`;
        meters = '<h4>Story meters</h4><div class="dbg-meters">' +
          Object.entries(S.m).map(([k, v]) => row(k, v)).join('') +
          Object.entries(S.rel).map(([k, v]) => row(k, v)).join('') +
          `</div><div>flags: ${Object.keys(S.f).filter((k) => S.f[k]).join(', ') || 'none'}</div><div>vote passes: ${B.StoryMode.votePasses(S)}</div><div>miss streak: ${S.missStreak}</div>`;
      } else if (g) {
        meters = `<div>regime: ${g.market.scen.regime}</div>`;
      }
      $('debug-panel').innerHTML = `<h4>DEBUG</h4>
        <div>speed <button data-dbg="speed" data-v="1">1x</button><button data-dbg="speed" data-v="5">5x</button><button data-dbg="speed" data-v="20">20x</button><button data-dbg="speed" data-v="60">60x</button></div>
        <div><button data-dbg="close">skip to close</button><button data-dbg="story">story: jump day</button></div>
        <div><button data-dbg="stress" data-v="0">stress 0</button><button data-dbg="stress" data-v="95">stress 95</button><button data-dbg="mc">force margin call</button><button data-dbg="crash">crash -9%</button></div>
        <div><button data-dbg="saveload">save+restore now</button></div>
        <div>cine <button data-dbg="cine" data-v="news">news</button><button data-dbg="cine" data-v="office">office</button><button data-dbg="cine" data-v="close">close</button><button data-dbg="cine" data-v="ending">ending</button></div>
        ${meters}`;
    }
  };
})(window.BTB);
