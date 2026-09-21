// Boot + main menu wiring.
(function (B) {
  'use strict';
  const $ = B.el;

  const Main = {
    refreshMenu() {
      const used = B.Save.index().filter(Boolean).length;
      const btn = $('btn-load');
      btn.textContent = used ? `Load Game (${used}/${B.Save.SLOTS})` : 'Load Game';
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
      const V = { w: 320, h: 180 };
      const { ctx } = B.Pixel.fit(cv, V.w, V.h);
      const X = B.Pixel, P = B.Pal;
      X.rect(ctx, 0, 0, V.w, V.h, P.ink);
      X.gradient(ctx, 0, 0, V.w, 150, P.ink2, P.ink, 8);
      X.speckle(ctx, 0, 0, V.w, 120, P.slate, 0.0025, 4);
      // A present-day infrastructure lattice: fibre, grid and compute all share
      // the same city. It reads as systems, not a specific decade.
      ctx.save();
      ctx.globalAlpha = 0.55;
      const nodes = [[22, 42], [74, 32], [126, 58], [178, 28], [231, 51], [292, 35]];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        ctx.strokeStyle = i < 3 ? P.sky : P.violet;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        X.rect(ctx, a[0] - 2, a[1] - 2, 5, 5, i < 3 ? P.sky : P.violet);
        X.rect(ctx, a[0] - 1, a[1] - 1, 3, 3, P.ink);
      }
      X.rect(ctx, 290, 33, 5, 5, P.crimson);
      X.rect(ctx, 291, 34, 3, 3, P.ink);
      ctx.restore();
      // two silhouetted layers for depth, kept low so the menu copy stays readable
      for (let layer = 0; layer < 2; layer++) {
        const base = layer ? V.h : V.h - 12;
        const col = layer ? P.ink : P.ink2;
        const lit = layer ? P.amberD : P.slate;
        for (let i = 0; i < 17; i++) {
          const bw = 13 + ((i * 23 + layer * 7) % 11);
          const bh = (layer ? 16 : 12) + ((i * 37 + layer * 19) % (layer ? 34 : 26));
          const bx = i * 20 - 6 + layer * 7;
          X.rect(ctx, bx, base - bh, bw, bh, col);
          for (let wy = 4; wy < bh - 3; wy += 6) {
            for (let wx = 3; wx < bw - 3; wx += 5) {
              if (((i * 5 + wy * 3 + wx + layer) % 7) < 1) X.rect(ctx, bx + wx, base - bh + wy, 2, 2, lit);
            }
          }
        }
      }
      // The CASCADE mark begins aligned and slips as it falls toward the skyline.
      for (let i = 0; i < 5; i++) {
        const y = 76 + i * 7;
        X.rect(ctx, 255 + i * 3, y, 36 - i * 3, 4, i < 2 ? P.amberD : i < 4 ? P.sky : P.crimsonD);
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

    // The first click is also what unlocks WebAudio in every browser.
    $('btn-boot').addEventListener('click', () => {
      B.SFX.unlock();
      B.Music.play('menu');
      B.Screens.show('menu');
    });

    $('btn-story-new').addEventListener('click', () => { B.SFX.unlock(); Main.newStory(); });
    $('btn-endless').addEventListener('click', () => { B.SFX.unlock(); Main.openEndless(); });
    $('btn-load').addEventListener('click', () => { B.SFX.unlock(); B.Slots.open(); });
    $('btn-howto').addEventListener('click', () => B.Screens.show('howto'));
    $('btn-settings').addEventListener('click', () => { B.Screens.renderSettings(); B.Screens.show('settings'); });
    $('btn-endings').addEventListener('click', () => B.Screens.showEndings());
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => B.Screens.goMenu()));

    if (/[?&]debug=1/.test(location.search) && B.Debug) B.Debug.init();
  });
})(window.BTB);
