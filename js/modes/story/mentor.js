// Imani's first three sessions. Not a tutorial: a colleague on the next seat
// who notices what you are doing and says one thing about it. Every line is
// triggered by the player's own state (flat too long, a position with no stop,
// over quota, near the loss limit, a phone ringing, a hype post firing), and
// shows as a desk note long enough to read, with the full text kept in the
// inbox. Nothing pauses the market and nothing points at buttons unless you
// seem stuck. Lines never repeat word for word, and she leaves real gaps.
(function (B) {
  'use strict';
  const FROM = 'Imani Rhodes';
  const LAST_DAY = 2;
  const GAP = 20; // game minutes between remarks (about nine real seconds)

  const touch = () => !!(B.UI && B.UI.isTouch && B.UI.isTouch());
  const flat = (g) => g.broker.isFlat();
  const pnl = (g) => g.broker.equity() - g.broker.dayStartEquity;
  const today = (g) => (g.broker.dayTrades ? g.broker.dayTrades() : []);
  const opened = (g) => today(g).some((t) => t.open);
  const unprotected = (g) => Object.keys(g.broker.pos).some((s) => !g.broker.orders.some((o) => o.bracket && o.sym === s));
  // Still adding: an opening trade in the last ten minutes while the day is red.
  const adding = (g, t) => today(g).some((x) => x.open && x.t >= t - 10);
  // The first Sqwak hype pop from a hype account that has hit the tape today.
  function hypePop(g, t) {
    return (g.market.events || []).find((e) => e.hype && e.fired && e.t <= t && e.impacts && e.impacts[0] &&
      (!e.src || !B.Sqwak || B.Sqwak.account(e.src).acc < 0.5));
  }
  // ...and whether its fade (the next hype event on the same name) has fired.
  function faded(g, pop) {
    const sym = pop.impacts[0].id;
    return (g.market.events || []).some((e) => e.hype && e.fired && e !== pop && e.t > pop.t && e.impacts && e.impacts[0] && e.impacts[0].id === sym);
  }

  // [id, days, when(g, t, said, M) -> bool, text(g, said) -> string, once per career?]
  const LINES = [
    // ---- Session 1: the seat ----
    ['hello', [0], (g, t) => t >= 2, () => "Welcome to the seat. You don't have to trade the first ten minutes. Watch INDX: it's the whole market in one line."],
    ['stuck', [0], (g, t) => t >= 28 && !today(g).length,
      () => (touch() ? 'Still flat. Fine. When you want in: INDX, tap 10%, then BUY or SELL. CLOSE gets you out.'
        : 'Still flat. Fine. When you want in: INDX, press 1 for a small size, then B to buy or S to short. C closes it.')],
    ['stop', [0, 1], (g) => opened(g) && !flat(g) && unprotected(g),
      () => "You're in with no stop. Put a number in SL% before you buy next time. The stop does the flinching so you don't have to.", true],
    ['phone', [0], (g) => g.interrupts && g.interrupts.ringing,
      () => (touch() ? "Your phone's ringing. Answer it. Tips are cheap and mostly wrong. Clients are the ones who pay."
        : "That's your phone. A answers it. Tips are cheap and mostly wrong. Clients are the ones who pay.")],
    ['quota', [0, 1], (g) => g.quota > 0 && pnl(g) >= g.quota && !flat(g), (g) => (g.day === 0
      ? "That's Kroll's number. You can keep going, but nobody pays you for giving it back."
      : "Over the number again. Protect it. The afternoon is where days go to die.")],
    ['red', [0, 1], (g, t) => pnl(g) <= -0.012 * g.broker.dayStartEquity && !flat(g) && adding(g, t),
      () => 'Down is normal. Down and still adding is how people leave this floor. Cut it or cap it.', true],
    ['bell', [0, 1], (g, t) => t >= 364 && !flat(g), (g) => (g.day === 0
      ? 'Twenty-five minutes. Be flat by the bell unless you have a reason you could say out loud to Kroll.'
      : "Close is coming. Same rule as yesterday: if you can't say why you're holding it overnight, don't.")],

    // ---- Session 2: two feeds ----
    ['feeds', [1], (g, t) => t >= 2, () => (touch()
      ? 'Two feeds under the terminal. The Wire is news somebody could be sued over. Sqwak is people. People move prices for about ten minutes.'
      : 'Two feeds on the right. The Wire is news somebody could be sued over. Sqwak is people. People move prices for about ten minutes.')],
    ['hype', [1, 2], (g, t, said) => { const p = hypePop(g, t); if (p) said.pop = p.t; return !!p; },
      (g, said) => {
        const p = (g.market.events || []).find((e) => e.hype && e.t === said.pop);
        const sym = p ? p.impacts[0].id : 'that one', up = !p || p.impacts[0].pct > 0;
        return `See ${sym}? One big account, one post, and it ${up ? 'jumped' : 'dropped'}. Watch where it is ten minutes from now.`;
      }, true],
    ['fade', [1, 2], (g, t, said, M) => {
      if (said.pop == null || !M.career.hype) return false;
      const p = (g.market.events || []).find((e) => e.hype && e.t === said.pop);
      return !!p && faded(g, p) && t >= said.pop + 6;
    }, () => "And there it goes. Chasing that is how you pay for somebody else's joke. The risk desk counts it, too.", true],
    ['quiet', [1], (g, t) => t >= 70 && !today(g).length, () => 'Quiet days still have a quota. Small and boring counts the same as clever.'],

    // ---- Session 3: the rules that pay you ----
    ['week', [2], (g, t) => t >= 2, () => 'Kroll has a weekly number as well as the daily one. Make the week and he wipes up to two bad days off your record.'],
    ['limit', [0, 1, 2], (g) => pnl(g) <= -0.020 * g.broker.dayStartEquity,
      () => "You're near the risk desk's line: three percent on the day. Hit it before three, get flat fast, keep leverage under 3.25x, and they excuse the miss once a week. Stay in and it comes out of your bonus.", true],
    ['pay', [2], (g, t) => t >= 210, () => "Friday you get paid: a draw or a bonus, whichever's bigger. The bonus is what the risk desk says you earned, not what you made. Rent comes out the same day."]
  ];
  // Lines that cannot wait for the gap.
  const URGENT = { phone: 1, limit: 1, bell: 1 };

  function tick(g, t, S) {
    if (!g || g.day > LAST_DAY || !g.broker || !g.market || t < 2) return;
    const M = S.mentor = S.mentor || {};
    M.career = M.career || {};
    const said = M[g.day] = M[g.day] || {};
    for (const [id, days, when, text, once] of LINES) {
      if (said[id] || days.indexOf(g.day) < 0 || (once && M.career[id])) continue;
      if (!URGENT[id] && said.lastT != null && t - said.lastT < GAP) continue;
      let ok = false;
      try { ok = when(g, t, said, M); } catch (e) { ok = false; }
      if (!ok) continue;
      said[id] = true;
      if (once) M.career[id] = true;
      said.lastT = t;
      const line = text(g, said);
      if (B.UI && B.UI.mentor) B.UI.mentor(FROM, line);
      else if (B.UI && B.UI.inbox) B.UI.inbox({ from: FROM, text: line });
      return; // one line per tick: a person, not a checklist
    }
  }

  B.Mentor = { LINES, LAST_DAY, GAP, tick };
})(window.BTB);
