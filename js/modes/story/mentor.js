// Imani's first three sessions. Not a tutorial: a colleague on the next seat
// who notices what you are doing and says one thing about it. Every line is
// triggered by the player's own state (flat too long, a position with no stop,
// over quota, near the loss limit, a phone ringing, a hype post firing), fires
// once per session, and goes to the inbox like any other message. Nothing
// pauses the market and nothing points at buttons unless you seem stuck.
(function (B) {
  'use strict';
  const FROM = 'Imani Rhodes';
  const LAST_DAY = 2;

  const flat = (g) => g.broker.isFlat();
  const pnl = (g) => g.broker.equity() - g.broker.dayStartEquity;
  const trades = (g) => (g.broker.dayTrades ? g.broker.dayTrades() : []).length;
  const unprotected = (g) => Object.keys(g.broker.pos).some((s) => !g.broker.orders.some((o) => o.bracket && o.sym === s));
  // The first Sqwak hype pop of the day that has already hit the tape.
  const hypeFired = (g, t) => (g.market.events || []).find((e) => e.hype && e.fired && e.t <= t);

  // [id, days, when(g, t, said) -> bool, text]. `said` is this session's record.
  // Order matters only for ties.
  const LINES = [
    // ---- Session 1: the seat ----
    ['hello', [0], (g, t) => t >= 2, "Welcome to the seat. You don't have to trade the first ten minutes. Watch INDX: it's the whole market in one line."],
    ['stuck', [0], (g, t) => t >= 28 && !trades(g), 'Still flat. Fine. When you want in: INDX, press 1 for a small size, then B to buy or S to short. C closes it.'],
    ['stop', [0, 1], (g) => !flat(g) && unprotected(g), "You're in. Next time put a number in SL% before you buy. The stop does the flinching so you don't have to."],
    ['phone', [0], (g) => g.interrupts && g.interrupts.ringing, "That's your phone. A answers it. Tips are cheap and most of them are wrong. Clients are the ones who pay."],
    ['quota', [0, 1, 2], (g) => g.quota > 0 && pnl(g) >= g.quota && !flat(g), "That's Kroll's number. You can keep going, but nobody pays you for giving it back."],
    ['red', [0, 1], (g) => pnl(g) <= -0.012 * g.broker.dayStartEquity && !flat(g), 'Down is normal. Down and still adding is how people leave this floor. Cut it or cap it.'],
    ['bell', [0, 1, 2], (g, t) => t >= 364 && !flat(g), "Twenty-five minutes. Be flat by the bell unless you have a reason you could say out loud to Kroll."],

    // ---- Session 2: two feeds ----
    ['feeds', [1], (g, t) => t >= 2, "Two feeds on the right. The Wire is news somebody could be sued over. Sqwak is people. People move prices for about ten minutes."],
    ['hype', [1, 2], (g, t) => !!hypeFired(g, t), 'See that? One big account, one post, and the stock jumps. Watch where it is ten minutes from now.'],
    ['fade', [1, 2], (g, t, said) => said.hypeAt != null && t >= said.hypeAt + 11, "And there it goes. Chasing that is how you pay for somebody else's joke. The risk desk counts it, too."],
    ['quiet', [1], (g, t) => t >= 70 && !trades(g), 'Quiet days still have a quota. Small and boring counts the same as clever.'],

    // ---- Session 3: the rules that pay you ----
    ['week', [2], (g, t) => t >= 2, "Kroll has a weekly number as well as the daily one. It's on your briefing. Make the week and he forgets one bad day."],
    ['footnotes', [2], (g, t) => t >= 40, 'Read the dull items in the morning feed. Nobody hides anything in a headline.'],
    ['limit', [2, 1, 0], (g) => pnl(g) <= -0.022 * g.broker.dayStartEquity, "You're close to the risk desk's line: three percent on the day. Hit it and get flat inside five minutes, and they excuse the miss. Stay in and it comes out of your bonus."],
    ['pay', [2], (g, t) => t >= 210, "Friday you get paid: a draw or a bonus, whichever's bigger. The bonus is what the risk desk says you earned, not what you made. Rent comes out the same day."]
  ];

  function tick(g, t, S) {
    if (!g || g.day > LAST_DAY || !g.broker || !g.market) return;
    const M = S.mentor = S.mentor || {};
    const said = M[g.day] = M[g.day] || {};
    // Leave a few minutes between remarks, except for the ones that cannot wait.
    const urgent = (id) => id === 'bell' || id === 'limit' || id === 'phone';
    for (const [id, days, when, text] of LINES) {
      if (said[id] || days.indexOf(g.day) < 0) continue;
      if (!urgent(id) && said.lastT != null && t - said.lastT < 6) continue;
      let ok = false;
      try { ok = when(g, t, said); } catch (e) { ok = false; }
      if (!ok) continue;
      said[id] = true;
      said.lastT = t;
      if (id === 'hype') said.hypeAt = t;
      if (B.UI && B.UI.inbox) B.UI.inbox({ from: FROM, text });
      return; // one line per tick: a person, not a checklist
    }
  }

  B.Mentor = { LINES, LAST_DAY, tick };
})(window.BTB);
