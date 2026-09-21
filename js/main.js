// Boot + main menu wiring.
(function (B) {
  'use strict';
  const $ = B.el;

  const Main = {
    refreshMenu() {
      $('btn-story-continue').hidden = !B.storage.get('save:story', null);
      $('btn-endless-continue').hidden = !B.storage.get('save:endless', null);
    },

    newStory() {
      const start = () => {
        B.storage.remove('save:story');
        const g = new B.Game(B.StoryMode());
        g.begin();
      };
      if (B.storage.get('save:story', null) && $('screen-menu').classList.contains('active')) {
        B.Screens.confirm('Start a new story?', 'Your current story save will be overwritten.', 'Start over', start);
      } else start();
    },

    continueStory() {
      const s = B.storage.get('save:story', null);
      if (!s) return;
      const g = new B.Game(B.StoryMode(s.mode), s);
      g.begin();
    },

    openEndless() { B.EndlessSetup.open(); },

    startEndless(cfg) {
      B.storage.remove('save:endless');
      const g = new B.Game(B.EndlessMode(cfg));
      g.begin();
    },

    continueEndless() {
      const s = B.storage.get('save:endless', null);
      if (!s) return;
      const g = new B.Game(B.EndlessMode(s.mode.cfg, s.mode), s);
      g.begin();
    },

    tape() {
      const bits = B.TICKERS.filter((t) => t.sector !== 'fear').map((t) => {
        const ch = (Math.random() - 0.45) * 0.04;
        return `<span class="${ch >= 0 ? 'up' : 'down'}">${t.sym} ${B.fmt.price(t.price * (1 + ch))} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(2)}%</span>`;
      }).join(' &nbsp;·&nbsp; ');
      $('menu-tape').innerHTML = `<span class="inner">${bits} &nbsp;·&nbsp; ${bits} &nbsp;·&nbsp; </span>`;
    }
  };
  B.Main = Main;

  document.addEventListener('DOMContentLoaded', () => {
    B.Settings.apply();
    B.UI.init();
    Main.tape();
    Main.refreshMenu();

    $('btn-story-new').addEventListener('click', () => { B.SFX.unlock(); Main.newStory(); });
    $('btn-story-continue').addEventListener('click', () => { B.SFX.unlock(); Main.continueStory(); });
    $('btn-endless').addEventListener('click', () => { B.SFX.unlock(); Main.openEndless(); });
    $('btn-endless-continue').addEventListener('click', () => { B.SFX.unlock(); Main.continueEndless(); });
    $('btn-howto').addEventListener('click', () => B.Screens.show('howto'));
    $('btn-settings').addEventListener('click', () => { B.Screens.renderSettings(); B.Screens.show('settings'); });
    $('btn-endings').addEventListener('click', () => B.Screens.showEndings());
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => B.Screens.goMenu()));

    if (/[?&]debug=1/.test(location.search) && B.Debug) B.Debug.init();
  });
})(window.BTB);
