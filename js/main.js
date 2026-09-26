// Boot + main menu wiring.
(function (B) {
  'use strict';
  const $ = B.el;

  const Main = {
    refreshMenu() {
      const used = B.Save.index().filter(Boolean).length;
      const btn = $('btn-load');
      btn.textContent = used ? `Continue (${used}/${B.Save.SLOTS})` : 'Continue';
      btn.disabled = !used;
    },

    // slot: optional target slot. Otherwise the first free one is claimed at the
    // first save, so a quick play can start without touching the slot screen.
    newStory(slot) {
      const start = () => {
        const g = new B.Game(B.StoryMode());
        g.slot = slot != null ? slot : B.Save.firstEmpty();
        if (g.slot < 0) g.slot = null;
        g.begin();
      };
      const existing = slot != null ? B.Save.meta(slot) : null;
      if (existing) {
        B.Screens.confirm('Overwrite this slot?', `"${B.esc(existing.name)}" will be replaced.`, 'Overwrite', () => {
          B.Save.clear(slot);
          start();
        });
      } else start();
    },

    openEndless() { B.EndlessSetup.open(); },

    startEndless(cfg) {
      const g = new B.Game(B.EndlessMode(cfg));
      g.slot = B.Save.firstEmpty();
      if (g.slot < 0) g.slot = null;
      g.begin();
    },

    // Night skyline behind the menu, drawn on the same palette as the cutscenes.
    // Deterministic, so it does not shimmer when the window is resized.
    skyline() {
      const cv = $('menu-bg');
      if (!cv || !B.Pixel) return;
      // A 480x270 field gives the menu a finer pixel grain than the original
      // 320x180 backdrop while keeping integer nearest-neighbour scaling.
      const V = { w: 480, h: 270 };
      const { ctx } = B.Pixel.fit(cv, V.w, V.h);
      const X = B.Pixel, P = B.Pal;
      X.rect(ctx, 0, 0, V.w, V.h, P.ink);
      X.gradient(ctx, 0, 0, V.w, 150, P.ink2, P.ink, 8);
      X.speckle(ctx, 0, 0, V.w, 120, P.slate, 0.0025, 4);
      // A present-day infrastructure lattice: fibre, grid and compute all share
      // the same city. It reads as systems, not a specific decade.
      ctx.save();
      ctx.globalAlpha = 0.55;
      const nodes = [[24, 64], [82, 43], [139, 78], [198, 39], [254, 67], [316, 46], [376, 75], [444, 52]];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        ctx.strokeStyle = i < 3 ? P.sky : P.violet;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        X.rect(ctx, a[0] - 2, a[1] - 2, 4, 4, i < 4 ? P.sky : P.violet);
        X.rect(ctx, a[0] - 1, a[1] - 1, 2, 2, P.ink);
      }
      X.rect(ctx, 442, 50, 5, 5, P.crimson);
      X.rect(ctx, 443, 51, 3, 3, P.ink);
      ctx.restore();
      // two silhouetted layers for depth, kept low so the menu copy stays readable
      for (let layer = 0; layer < 2; layer++) {
        const base = layer ? V.h : V.h - 12;
        const col = layer ? P.ink : P.ink2;
        const lit = layer ? P.amberD : P.slate;
        for (let i = 0; i < 25; i++) {
          const bw = 14 + ((i * 23 + layer * 7) % 14);
          const bh = (layer ? 23 : 18) + ((i * 37 + layer * 19) % (layer ? 51 : 39));
          const bx = i * 20 - 7 + layer * 8;
          X.rect(ctx, bx, base - bh, bw, bh, col);
          for (let wy = 4; wy < bh - 3; wy += 6) {
            for (let wx = 3; wx < bw - 3; wx += 5) {
              if (((i * 5 + wy * 3 + wx + layer) % 7) < 1) X.rect(ctx, bx + wx, base - bh + wy, 2, 2, lit);
            }
          }
        }
      }
      // The CASCADE mark begins aligned and slips as it falls toward the skyline.
      for (let i = 0; i < 6; i++) {
        const y = 113 + i * 8;
        X.rect(ctx, 384 + i * 3, y, 54 - i * 4, 4, i < 2 ? P.amberD : i < 4 ? P.sky : P.crimsonD);
      }
    },

    tape() {
      const bits = B.TICKERS.filter((t) => t.sector !== 'fear').map((t) => {
        const ch = (Math.random() - 0.45) * 0.04;
        return `<span class="${ch >= 0 ? 'up' : 'down'}">${t.sym} ${B.fmt.price(t.price * (1 + ch))} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(2)}%</span>`;
      }).join(' &nbsp;&middot;&nbsp; ');
      $('menu-tape').innerHTML = `<span class="inner">${bits} &nbsp;&middot;&nbsp; ${bits} &nbsp;&middot;&nbsp; </span>`;
    }
  };
  B.Main = Main;

  document.addEventListener('DOMContentLoaded', () => {
    B.Save.migrate();
    B.Settings.apply();
    B.UI.init();
    Main.tape();
    Main.skyline();
    Main.refreshMenu();
    window.addEventListener('resize', () => Main.skyline());

    // Splash: 1s fade in, hold, 1s fade out, menu at 5s. Any click or key
    // skips to the fade out.
    const boot = $('screen-boot');
    let bootTimers = [];
    const leaveBoot = () => {
      if (!boot.classList.contains('active') || boot.classList.contains('leaving')) return;
      bootTimers.forEach(clearTimeout);
      boot.classList.add('leaving');
      bootTimers = [setTimeout(() => { boot.classList.remove('leaving'); B.Screens.show('menu'); }, 1000)];
    };
    bootTimers.push(setTimeout(leaveBoot, 4000));
    boot.addEventListener('pointerdown', leaveBoot);
    document.addEventListener('keydown', (e) => { if (boot.classList.contains('active')) { e.preventDefault(); leaveBoot(); } });

    // Browsers keep audio locked until the first click or key press, so the
    // menu music waits for that.
    const unlockAudio = () => {
      document.removeEventListener('pointerdown', unlockAudio, true);
      document.removeEventListener('keydown', unlockAudio, true);
      B.SFX.unlock();
      if (!B.UI.g) B.Music.play('menu');
    };
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);

    // A page may only close a window a script opened, so in a normal tab
    // this falls through to the goodbye screen.
    $('btn-exit').addEventListener('click', () => {
      window.close();
      setTimeout(() => { B.Music.stop(); B.Screens.show('exit'); }, 150);
    });

    $('btn-story-new').addEventListener('click', () => { B.SFX.unlock(); Main.newStory(); });
    $('btn-endless').addEventListener('click', () => { B.SFX.unlock(); Main.openEndless(); });
    $('btn-load').addEventListener('click', () => { B.SFX.unlock(); B.Slots.open(); });
    $('btn-settings').addEventListener('click', () => { B.Screens.renderSettings(); B.Screens.show('settings'); });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => B.Screens.goMenu()));

    if (/[?&]debug=1/.test(location.search) && B.Debug) B.Debug.init();
  });
})(window.BTB);
