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
    cardLimit: 1500,
    cardApr: 0.22,
    drawPerSession: 260,    // $1,300 a week: covers rent, not life
    taxRate: 0.35,
    bonusMade: 0.25,        // share of new career P&L highs when the week's quota was made
    bonusMissed: 0.10,      // ... when it was missed
    drawdown: 0.05,         // a week that fell this far off peak book equity halves the rate
    breachCut: 0.15,        // each KIND of rule broken this week or last cuts the bonus this much
    cleanKicker: 0.25,      // a clean week (3+ sessions) pays x1.25
    lossLimit: 0.03,        // daily loss limit, share of the day's opening book. At 2%,
                            // stopping there got disciplined traders fired on quota.
    flatWithin: 5,          // minutes to get flat after touching the limit
    levCap: 3,              // gross leverage above this (or 90% of a lower limit) is a breach
    overnightLev: 1,        // gross exposure above 1x equity carried past the close
    hypeWindow: 3,          // minutes after a hype post that count as chasing it
    bonusCap: 0.20,         // new highs paid on are capped at this share of the book per 5 sessions
    bonusMax: 20000,        // and the gross bonus at this per 5 sessions: a big book does not
                            // buy the penthouse in week three; where you live stays a choice
    cardBuffer: 500,        // cash kept back before paying the card down
    lateFee: 100,
    living: 300,            // food, transit, phone, utilities: every week
    loan: 150,              // student loan: every week
    mom: 100                // what you send home: every week
  };

  // Where you live. Rent is weekly. `carry` scales how much stress follows you
  // into the next morning, `floor` is the stress you wake up with, and `calm`
  // scales how fast you settle down during the session.
  const TIERS = [
    { id: 'couch', calm: 0.8, name: "Mom's couch", rent: 0, carry: 1.3, floor: 12, forced: true, note: 'No rent. No sleep. Mom asks about work every night.' },
    { id: 'share', calm: 0.9, name: 'Queens share', rent: 400, carry: 1.1, floor: 6, note: 'Three roommates and a 70-minute commute.' },
    { id: 'studio', calm: 1, name: 'Midtown studio', rent: 750, carry: 1, floor: 3, note: 'A radiator that knocks and a window onto an airshaft.' },
    { id: 'onebed', calm: 1.1, name: 'Downtown one-bedroom', rent: 1600, carry: 0.85, floor: 0, note: 'Quiet. A door between you and the screens.' },
    { id: 'loft', calm: 1.15, name: 'Riverside loft', rent: 3500, carry: 0.7, floor: 0, note: 'Brick, steel and a view of the bridges. People ask what you do.' },
    { id: 'penthouse', calm: 1.2, name: 'Penthouse over the park', rent: 8000, carry: 0.55, floor: 0, note: 'Floor-to-ceiling glass forty floors up. You sleep like the money is real.' }
  ];
  const DEFAULT_TIER = 2;
  const EVICT_STAGES = ['', 'Rent is late. A $100 fee is added.', 'Rent is still late. Your landlord leaves two voicemails before the open.',
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
      if (open[im.id]) { if (!open[im.id].skip) { open[im.id].end = e.t; out.push(open[im.id]); } delete open[im.id]; }
      // Only hype accounts count: a sharp account that turns out right is news, not hype.
      else if (!e.src || !B.Sqwak || B.Sqwak.account(e.src).acc < 0.5) open[im.id] = { sym: im.id, start: e.t, end: e.t + 10, dir: Math.sign(im.pct) };
      else open[im.id] = { skip: true };
    }
    return out;
  }

  const FORCED = ['LIQUIDATION', 'OVERNIGHT MARGIN', 'WIPED OUT', 'STOP-LOSS', 'TAKE-PROFIT', 'EXPIRED', 'LIQUIDATED', 'FAT FINGER', 'DESK SHORT'];

  // The risk desk's read of one session. Pure: same inputs, same verdict.
  // Each breach has a kind; a week is cut per kind, not per incident.
  function review(input) {
    const risk = input.risk || {};
    const start = Math.max(1, input.start || 0);
    const trades = (input.trades || []).filter((t) => FORCED.indexOf(t.tag) < 0);
    const out = [];
    const limit = P.lossLimit * start;
    if (risk.breachT != null) {
      const slow = risk.flatT == null || risk.flatT - risk.breachT > P.flatWithin;
      if (slow) out.push({ id: 'loss', text: `Hit the ${B.fmt.money(-limit)} loss limit and stayed in the market (low ${B.fmt.money(risk.trough - start)})` });
      // A resting order placed before the limit was hit is not revenge.
      const after = trades.filter((t) => t.open && t.t >= risk.breachT && (t.placed == null ? t.t : t.placed) >= risk.breachT).length;
      if (after) out.push({ id: 'revenge', text: `Opened ${after} new trade${after === 1 ? '' : 's'} after hitting the loss limit` });
    }
    if (risk.liq) out.push({ id: 'margin', text: 'Margin call went unanswered. Risk liquidated the book.', zero: true });
    else if (risk.mc) out.push({ id: 'margin', text: 'Took a margin call.', zero: true });
    const cap = Math.min(P.levCap, (input.maxLev || 4) * 0.9);
    if (risk.peakLev > cap) out.push({ id: 'size', text: `Ran ${risk.peakLev.toFixed(1)}x leverage against a ${cap.toFixed(1)}x desk cap` });
    if ((input.forced && input.forced.length) || input.closeLev > P.overnightLev) {
      out.push({ id: 'overnight', text: input.forced && input.forced.length
        ? `Held too much overnight. Force-sold ${input.forced.join(', ')} at the close.`
        : `Carried ${input.closeLev.toFixed(1)}x exposure overnight against a ${P.overnightLev}x cap.` });
    }
    const chased = [];
    for (const h of hypeWindows(input.events)) {
      const side = (t) => (t.opt ? t.dir : Math.sign(t.qty));
      const under = (t) => (t.opt ? t.und : t.sym);
      if (trades.some((t) => t.open && under(t) === h.sym && t.t >= h.start && t.t <= h.start + P.hypeWindow && side(t) === h.dir)) chased.push(h.sym);
    }
    if (chased.length) out.push({ id: 'hype', text: `Chased Sqwak hype in ${chased.filter((s, i) => chased.indexOf(s) === i).join(', ')}` });
    return { breaches: out, hitLimit: risk.breachT != null };
  }

  // Distinct breach kinds in a list of day records.
  const kinds = (list) => (list || []).reduce((acc, b) => (acc.indexOf(b.id) < 0 ? acc.concat(b.id) : acc), []);

  // Bonus multiplier: zero after a margin event this week; otherwise -15% per
  // kind broken this week or last; x1.25 for a clean week of 3+ sessions.
  function multiplier(thisWeek, lastWeek, sessions) {
    if ((thisWeek || []).some((b) => b.zero)) return 0;
    const n = kinds((thisWeek || []).concat(lastWeek || [])).length;
    if (!n && sessions >= 3) return 1 + P.cleanKicker;
    return Math.max(0, 1 - n * P.breachCut);
  }

  function reviewNote(rv) {
    if (!rv.breaches.length) {
      return rv.hitLimit
        ? '<b>Risk desk review:</b> hit the daily loss limit and stopped. That is the job. No breaches.'
        : '<b>Risk desk review:</b> clean. No breaches.';
    }
    const bare = (t) => t.replace(/\.$/, '');
    const items = rv.breaches.map((b) => b.zero ? `${bare(b.text)}. <b>No bonus this week.</b>` : `${bare(b.text)}: <b>-${Math.round(P.breachCut * 100)}% bonus this week and next.</b>`);
    return `<b>Risk desk review:</b> ${items.join(' ')}`;
  }

  // Pay bills in order from cash, then the card. What neither covers is
  // unpaid; rent unpaid becomes arrears.
  function spend(w, amount, cashOnly) {
    const fromCash = Math.min(Math.max(0, w.cash), amount);
    w.cash -= fromCash;
    if (cashOnly) return amount - fromCash;
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
    // New highs paid on are capped per session, so a one-session week cannot
    // pay out a season. The high-water mark still moves the whole way.
    const newHigh = Math.min(Math.max(0, careerPnl - w.hwm), o.equity * P.bonusCap * o.sessions / 5);
    let rate = o.weekMade ? P.bonusMade : P.bonusMissed;
    const dd = !!o.drawdown || o.equity < w.peakEq * (1 - P.drawdown);
    if (dd) rate /= 2;
    const breaches = o.breaches || [];
    const mult = multiplier(breaches, o.lastBreaches, o.sessions);
    const nk = kinds(breaches.concat(o.lastBreaches || [])).length;
    const bonus = round(Math.min(newHigh * rate * mult, P.bonusMax * o.sessions / 5));
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
    const cuts = breaches.some((b) => b.zero) ? ', zeroed by a margin call' : mult === 0 ? ', zeroed by breaches' : nk ? `, cut ${Math.round(Math.min(1, nk * P.breachCut) * 100)}% for ${nk} kind${nk === 1 ? '' : 's'} of breach this week and last` : mult > 1 ? `, x${1 + P.cleanKicker} for a clean week` : '';
    lines.push(`<b>Payslip:</b> ${how}. Bonus rate ${whyRate}${cuts}. After ${Math.round(P.taxRate * 100)}% tax: <b>${B.fmt.money(net, true)}</b>.${w.deficit > 0 ? ` You owe the desk ${B.fmt.money(w.deficit)} of unearned draw.` : ''}`);

    // Card interest first, then fixed bills, then rent.
    const interest = round(w.card * P.cardApr / 52);
    if (interest > 0) w.card += interest;
    // Bills scale with the days in the week: the lone final Monday is one fifth.
    const part = o.sessions / 5;
    const fixed = round((P.living + P.loan + P.mom) * part);
    const unpaid = spend(w, fixed);
    const rentDue = round(T.rent * part) + w.arrears;
    const rentUnpaid = spend(w, rentDue, true);
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
    // Whatever cash is left above a small buffer pays the card down.
    let paid = 0;
    if (w.card > 0 && w.cash > P.cardBuffer) {
      paid = Math.min(w.card, w.cash - P.cardBuffer);
      w.card -= paid;
      w.cash -= paid;
    }
    lines.push(`<b>Bills:</b> ${T.name} rent ${B.fmt.money(round(T.rent * part))}, living ${B.fmt.money(P.living * part)}, student loan ${B.fmt.money(P.loan * part)}, home to Mom ${B.fmt.money(P.mom * part)}${interest ? `, card interest ${B.fmt.money(interest)}` : ''}${paid ? `. Paid ${B.fmt.money(paid)} off the card` : ''}.`);
    let stress = 0;
    if (w.lateWeeks > 0) {
      const stage = Math.min(w.lateWeeks, EVICT_STAGES.length - 1);
      lines.push(`<b>${EVICT_STAGES[stage]}</b> Rent owed: ${B.fmt.money(w.arrears)}.`);
      stress = [0, 4, 8, 12, 16][stage];
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

  // Unearned draw is only ever repaid out of future bonus, so it is not debt.
  function netWorth(w) { return round(w.cash - w.card - w.arrears); }

  // All-in weekly cost of living somewhere.
  const weekly = (t) => t.rent + P.living + P.loan + P.mom;

  function band(w) {
    const n = netWorth(w);
    return n < 0 ? 'broke' : n < 50000 ? 'getting by' : 'rich';
  }

  // Moving: an upgrade costs two weeks of the new rent up front. Moving down
  // is free. Mom's couch is always there.
  function moveOptions(w) {
    const cur = w.tier | 0;
    return TIERS.map((t, i) => {
      const cost = i > cur ? t.rent * 2 : 0;
      return { i, id: t.id, name: t.name, rent: t.rent, weekly: weekly(t), note: t.note, cost, current: i === cur, afford: i === cur || w.cash >= cost };
    }).filter((o) => !TIERS[o.i].forced || o.current);
  }

  function move(w, i) {
    const opt = moveOptions(w).find((o) => o.i === i);
    if (!opt || opt.current || !opt.afford) return false;
    w.cash -= opt.cost;
    w.tier = i;
    return true;
  }

  B.Economy = { P, weekly, TIERS, EVICT_STAGES, multiplier, kinds, DEFAULT_TIER, fresh, ensure, review, reviewNote, hypeWindows, settle, netWorth, band, tier, moveOptions, move };
})(window.BTB);
