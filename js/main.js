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
    Main.refreshMenu();

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
