// Personal economy for Career mode. The $250k book is the firm's money; this is
// yours. It lives in S.wallet, never in broker cash, so quotas and the book are
// untouched. Everything here is deterministic arithmetic on the day report and
// the broker's trade tape: no random draws, so replay and saves stay exact.
//
// The desk pays a weekly DRAW against a discretionary BONUS. You get whichever
// is bigger, never both, and a draw you did not earn is repaid out of future
// bonus. The bonus is a share of new career P&L highs, cut by every risk desk
// breach. Discipline is what gets paid, not just profit.
(function (B) {
  'use strict';

  const P = {
    startCash: 1500,
    cardLimit: 1000,
    cardApr: 0.22,
    drawPerSession: 300,
    taxRate: 0.35,
    bonusMade: 0.25,        // share of new career P&L highs when the week's quota was made
    bonusMissed: 0.05,      // ... when it was missed
    drawdown: 0.05,         // below this far off peak book equity, the bonus rate halves
    breachCut: 0.25,        // each risk breach cuts that week's bonus by this share
    cleanKicker: 0.10,      // a week with no breaches adds this share
    lossLimit: 0.02,        // daily loss limit, share of the day's opening book
    blowThrough: 2,         // the day's low beyond this many loss limits is its own breach
    levCap: 0.9,            // carrying more than this share of max leverage is a breach
    lateFee: 50,
    living: 350,            // food, transit, phone, utilities: every week
    loan: 120,              // student loan: every week
    mom: 100                // what you send home: every week
  };

  // Where you live. Rent is weekly. `carry` scales how much stress follows you
  // into the next morning; `floor` is the stress you wake up with.
  const TIERS = [
    { id: 'couch', name: "Mom's couch", rent: 0, carry: 1.3, floor: 12, note: 'No rent. No sleep. Mom asks about work every night.' },
    { id: 'share', name: 'Queens share', rent: 550, carry: 1.1, floor: 6, note: 'Three roommates and a 70-minute commute.' },
    { id: 'studio', name: 'Midtown studio', rent: 850, carry: 1, floor: 3, note: 'A radiator that knocks and a window onto an airshaft.' },
    { id: 'doorman', name: 'Doorman one-bedroom', rent: 1200, carry: 0.8, floor: 0, note: 'Quiet. A door between you and the screens.' },
    { id: 'tower', name: 'High-rise with a view', rent: 1600, carry: 0.6, floor: 0, note: 'Floor-to-ceiling glass over the river. You sleep.' }
  ];
  const DEFAULT_TIER = 2;
  const EVICT_STAGES = ['', 'Rent is late. A $50 fee is added and your landlord calls twice before the open.',
    'An eviction notice is taped to your door.', 'Evicted. Your things go into your mother\'s garage.'];

  const tier = (w) => TIERS[B.clamp(w.tier | 0, 0, TIERS.length - 1)];
  const round = (v) => Math.round(v);

  function fresh() {
    return {
      cash: P.startCash, card: 0, tier: DEFAULT_TIER, arrears: 0, lateWeeks: 0,
      deficit: 0, hwm: 0, peakEq: 0, days: {}, weeks: {}, evictions: 0, paidTotal: 0
    };
  }

  function ensure(S, capital) {
    const w = S.wallet = Object.assign(fresh(), S.wallet || {});
    w.days = w.days || {};
    w.weeks = w.weeks || {};
    if (!w.peakEq) w.peakEq = capital;
    return w;
  }

  // Hype pops for the day: each Sqwak hype pop is followed by its fade on the
  // same ticker. Opening in the pop's direction inside that window is chasing.
  function hypeWindows(events) {
    const out = [], open = {};
    for (const e of (events || []).filter((x) => x.hype).sort((a, b) => a.t - b.t)) {
      const im = e.impacts && e.impacts[0];
      if (!im) continue;
      if (open[im.id]) { open[im.id].end = e.t; out.push(open[im.id]); delete open[im.id]; }
      else open[im.id] = { sym: im.id, start: e.t, end: e.t + 10, dir: Math.sign(im.pct) };
    }
    return out;
  }

  const FORCED = ['LIQUIDATION', 'OVERNIGHT MARGIN', 'WIPED OUT', 'STOP-LOSS', 'TAKE-PROFIT', 'EXPIRED', 'LIQUIDATED'];

  // The risk desk's read of one session. Pure: same inputs, same verdict.
  function review(input) {
    const risk = input.risk || {};
    const start = Math.max(1, input.start || 0);
    const trades = (input.trades || []).filter((t) => FORCED.indexOf(t.tag) < 0);
    const out = [];
    const limit = P.lossLimit * start;
    if (risk.breachT != null) {
      const after = trades.filter((t) => t.open && t.t > risk.breachT).length;
      if (after) out.push({ id: 'revenge', text: `Kept opening trades after hitting the daily loss limit (${after} after ${B.fmt.money(-limit)})` });
      if (start - risk.trough > limit * P.blowThrough) out.push({ id: 'blowthrough', text: `Blew through the loss limit: the day's low was ${B.fmt.money(risk.trough - start)}` });
    }
    if (risk.liq) out.push({ id: 'liquidated', text: 'Margin call went unanswered. Risk liquidated the book.', zero: true });
    else if (risk.mc) out.push({ id: 'margin', text: 'Took a margin call' });
    if (input.maxLev && risk.peakLev > input.maxLev * P.levCap) out.push({ id: 'leverage', text: `Ran ${risk.peakLev.toFixed(1)}x of a ${input.maxLev}x limit` });
    if (input.forced && input.forced.length) out.push({ id: 'overnight', text: `Held too much overnight. Force-sold ${input.forced.join(', ')} at the close.` });
    const chased = [];
    for (const h of hypeWindows(input.events)) {
      if (trades.some((t) => t.open && !t.opt && t.sym === h.sym && t.t >= h.start && t.t <= h.end && Math.sign(t.qty) === h.dir)) chased.push(h.sym);
    }
    if (chased.length) out.push({ id: 'hype', text: `Chased Sqwak hype in ${chased.filter((s, i) => chased.indexOf(s) === i).join(', ')}` });
    return { breaches: out, hitLimit: risk.breachT != null };
  }

  function reviewNote(rv) {
    if (!rv.breaches.length) {
      return rv.hitLimit
        ? '<b>Risk desk review:</b> hit the daily loss limit and stopped. That is the job. No breaches.'
        : '<b>Risk desk review:</b> clean. No breaches.';
    }
    const items = rv.breaches.map((b) => b.zero ? `${b.text} <b>No bonus this week.</b>` : `${b.text}: <b>-${Math.round(P.breachCut * 100)}% bonus</b>`);
    return `<b>Risk desk review:</b> ${items.join('; ')}.`;
  }

  // Pay bills in order from cash, then the card. What neither covers is
  // unpaid; rent unpaid becomes arrears.
  function spend(w, amount) {
    const fromCash = Math.min(Math.max(0, w.cash), amount);
    w.cash -= fromCash;
    const room = Math.max(0, P.cardLimit - w.card);
    const fromCard = Math.min(room, amount - fromCash);
    w.card += fromCard;
    return amount - fromCash - fromCard;
  }

  // Friday settlement for week `wk` (or the lone final Monday).
  function settle(w, o) {
    const lines = [];
    const T = tier(w);
    const careerPnl = o.equity - o.capital;
    w.peakEq = Math.max(w.peakEq, o.equity);
    const newHigh = Math.max(0, careerPnl - w.hwm);
    let rate = o.weekMade ? P.bonusMade : P.bonusMissed;
    const dd = o.equity < w.peakEq * (1 - P.drawdown);
    if (dd) rate /= 2;
    const breaches = o.breaches || [];
    let mult = 1;
    if (breaches.some((b) => b.zero)) mult = 0;
    else mult = Math.max(0, 1 - breaches.length * P.breachCut + (breaches.length === 0 ? P.cleanKicker : 0));
    const bonus = round(newHigh * rate * mult);
    if (careerPnl > w.hwm) w.hwm = careerPnl;
    const draw = P.drawPerSession * o.sessions;
    // Draw against bonus: whichever is bigger; an unearned draw is owed back.
    let gross;
    if (bonus <= draw) { gross = draw; w.deficit += draw - bonus; }
    else {
      const excess = bonus - draw;
      const repay = Math.min(w.deficit, excess);
      w.deficit -= repay;
      gross = draw + excess - repay;
    }
    const net = round(gross * (1 - P.taxRate));
    w.cash += net;
    w.paidTotal += net;
    const how = bonus > draw ? `bonus ${B.fmt.money(bonus)}` : `draw ${B.fmt.money(draw)}${bonus ? ` (bonus ${B.fmt.money(bonus)} did not beat it)` : ''}`;
    const whyRate = `${Math.round(rate * 100)}% of new highs${o.weekMade ? '' : ' (weekly quota missed)'}${dd ? ', halved for drawdown' : ''}`;
    const cuts = mult === 0 ? ', zeroed by a liquidation' : breaches.length ? `, cut ${Math.round(breaches.length * P.breachCut * 100)}% for ${breaches.length} breach${breaches.length === 1 ? '' : 'es'}` : `, +${Math.round(P.cleanKicker * 100)}% for a clean week`;
    lines.push(`<b>Payslip:</b> ${how}. Bonus rate ${whyRate}${cuts}. After ${Math.round(P.taxRate * 100)}% tax: <b>${B.fmt.money(net, true)}</b>.${w.deficit > 0 ? ` You owe the desk ${B.fmt.money(w.deficit)} of unearned draw.` : ''}`);

    // Card interest first, then fixed bills, then rent.
    const interest = round(w.card * P.cardApr / 52);
    if (interest > 0) w.card += interest;
    const fixed = P.living + P.loan + P.mom;
    const unpaid = spend(w, fixed);
    const rentDue = T.rent + w.arrears;
    const rentUnpaid = spend(w, rentDue);
    if (unpaid > 0) {
      // Bills you cannot cover go to collections on the card, over the limit.
      w.card += unpaid;
    }
    if (rentUnpaid > 0) {
      w.lateWeeks++;
      w.arrears = rentUnpaid + P.lateFee;
    } else {
      w.lateWeeks = 0;
      w.arrears = 0;
    }
    lines.push(`<b>Bills:</b> ${T.name} rent ${B.fmt.money(T.rent)}, living ${B.fmt.money(P.living)}, student loan ${B.fmt.money(P.loan)}, home to Mom ${B.fmt.money(P.mom)}${interest ? `, card interest ${B.fmt.money(interest)}` : ''}.`);
    let stress = 0;
    if (w.lateWeeks > 0) {
      const stage = Math.min(w.lateWeeks, EVICT_STAGES.length - 1);
      lines.push(`<b>${EVICT_STAGES[stage]}</b> Rent owed: ${B.fmt.money(w.arrears)}.`);
      stress = [0, 6, 12, 16][stage];
      if (stage >= EVICT_STAGES.length - 1) {
        w.card += w.arrears;
        w.arrears = 0;
        w.lateWeeks = 0;
        w.tier = 0;
        w.evictions++;
      }
    }
    lines.push(`<b>Wallet:</b> ${B.fmt.money(w.cash)} cash · card ${w.card > 0 ? B.fmt.money(-w.card) : '$0'} of ${B.fmt.money(-P.cardLimit)} · ${tier(w).name}.`);
    return { lines, net, bonus, draw, stress };
  }

  function netWorth(w) { return round(w.cash - w.card - w.arrears - w.deficit); }

  function band(w) {
    const n = netWorth(w);
    return n < 0 ? 'broke' : n < 15000 ? 'getting by' : 'rich';
  }

  // Moving: an upgrade costs two weeks of the new rent up front. Moving down
  // is free. Mom's couch is always there.
  function moveOptions(w) {
    const cur = w.tier | 0;
    return TIERS.map((t, i) => {
      const cost = i > cur ? t.rent * 2 : 0;
      return { i, id: t.id, name: t.name, rent: t.rent, note: t.note, cost, current: i === cur, afford: i === cur || w.cash >= cost };
    });
  }

  function move(w, i) {
    const opt = moveOptions(w)[i];
    if (!opt || opt.current || !opt.afford) return false;
    w.cash -= opt.cost;
    w.tier = i;
    return true;
  }

  B.Economy = { P, TIERS, EVICT_STAGES, DEFAULT_TIER, fresh, ensure, review, reviewNote, hypeWindows, settle, netWorth, band, tier, moveOptions, move };
})(window.BTB);
