// Story Mode controller: turns story state into scenarios, rules, quotas, consequences and endings.
(function (B) {
  'use strict';
  const D = B.StoryData;
  // Calibrated against real Market/Broker runs. Twelve cumulative misses fired
  // even a perfect-foresight trader before the late-game choices. Thirty keeps
  // misses permanent while allowing a competent run to reach session 61.
  const QUOTA_STRIKE_LIMIT = 30;
  // Weekly quota: on top of the daily mandate, the desk wants the whole week
  // to clear the sum of its daily quotas plus a margin. It resets every
  // Monday. A missed week is one more career strike, logged at Friday's close.
  // A made week wipes one missed day from that same week: make it back.
  const WEEK_MULT = 1.15;
  // How many missed days a made week wipes. The week is the real mandate: a
  // trader who is wrong one day in three but makes the week keeps the seat.
  const WEEK_WIPES = 2;
  // Sectors outside the CASCADE story. Background noise lives here so every day
  // stays tradable even when the scripted drama is pointed somewhere else.
  const SAFE_SECTORS = ['retail', 'haven', 'defense', 'power'];
  // The names the CASCADE trade actually sits in.
  const CASCADE_NAMES = ['BSTN', 'HLST', 'RDGW', 'FRLN', 'AMVL'];
  // Your boss can fire you through session 57. After that he can only shout.
  const BOSS_FIRE_LAST = 57;
  // A loss-limit stop can excuse a missed quota once a week, if it comes before 3:00 PM.
  const EXCUSE_BEFORE = 330;

  function freshState(capital) {
    return {
      m: { integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 },
      rel: { imani: 60, sana: 20, thorne: 30, kroll: 50, venn: 25, perry: 45, greta: 20 },
      f: {}, choices: {}, log: [], pending: [], missStreak: 0, quotaStrikes: 0, quotaLedger: [], startCapital: capital, complianceWarned: false,
      anomalies: 0, openedAnomalies: {}, feedsSkipped: 0, feedOpenedDays: {}, feedSkippedDays: {}
    };
  }

  // Deterministic vote outcome from the political state.
  function votePasses(S) {
    let score = 50 + (S.m.stability - 50) * 0.5 - (S.m.anger - 30) * 0.5;
    if (S.f.whipped) score += 18 + (S.rel.thorne >= 50 ? 8 : 0) + S.m.influence / 12;
    if (S.f.whippedAgainst) score -= 24;
    if (S.f.testified || S.f.reported) score += 8;
    if (S.f.bailout) score += 5;
    return score >= 50;
  }

  B.StoryMode = function (save) {
    const capital = 250000;
    const S = save ? save.S : freshState(capital);
    S.m = Object.assign({ integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 }, S.m || {});
    S.rel = Object.assign({ imani: 60, sana: 20, thorne: 30, kroll: 50, venn: 25, perry: 45, greta: 20 }, S.rel || {});
    S.f = S.f || {};
    S.choices = S.choices || {};
    S.log = S.log || [];
    S.pending = S.pending || [];
    S.anomalies = S.anomalies || 0;
    S.openedAnomalies = S.openedAnomalies || {};
    S.feedsSkipped = S.feedsSkipped || 0;
    S.feedOpenedDays = S.feedOpenedDays || {};
    S.feedSkippedDays = S.feedSkippedDays || {};
    S.quotaLedger = Array.isArray(S.quotaLedger) ? S.quotaLedger : [];
    // Legacy saves only knew the current consecutive streak. Preserve that
    // value until Game.restore can rebuild the cumulative ledger from history.
    if (!Number.isFinite(S.quotaStrikes)) S.quotaStrikes = Math.max(0, S.missStreak | 0);
    // Saves from before the personal economy start with a fresh wallet.
    const E = B.Economy;
    const W$ = E.ensure(S, capital);

    const mode = {
      kind: 'story',
      seed: 'cascade-20XX',
      capital,
      dayLength: B.Settings.get().storyDayLength || 180,
      lastDay: D.DAYS.length - 1,
      volMult: 1, feeMult: 1, maintStrict: 1, stressRate: 1, callFreq: 1,
      fakeShare: 0.55,
      // Roughly one tip in three pays, and at most one per session actually works.
      tipOdds: { real: 0.33, stale: 0.18, reversal: 0.14 },
      tipCap: 1,
      lossLimit: E.P.lossLimit,
      S,

      slotLabel(g) {
        return `${D.actOf(g.day)} · W${D.weekOf(g.day)} ${D.dowOf(g.day)} · ${g.day + 1}/${D.DAYS.length}`;
      },

      briefing(d, g) {
        const day = D.DAYS[d];
        const r = this.rules(d);
        const qm = this.quotaMeta(d, g);
        const rules = [];
        if (r.maxLev !== 4) rules.push(`Leverage limit: ${r.maxLev}x intraday / ${r.maxLev / 2}x overnight`);
        if (r.shortBan.length) rules.push('EMERGENCY ORDER: short selling of financial stocks is banned');
        if (S.m.heat >= 50) rules.push('Compliance is watching you. Examiners may visit your desk.');
        const remaining = QUOTA_STRIKE_LIMIT - S.quotaStrikes;
        if (S.quotaStrikes > 0) rules.push(`Career quota strikes: ${S.quotaStrikes}/${QUOTA_STRIKE_LIMIT}`);
        // The first sessions introduce the desk's systems one at a time:
        // Kroll from session 2, your money and the risk desk from session 3.
        if (!S.f.defected && (d >= 1 || this.bossMood().warn)) {
          const mood = this.bossMood();
          rules.push(`${mood.warn ? '<b>' : ''}${D.boss(S)}: ${mood.label} (${mood.value}/100).${mood.warn ? ' At zero he fires you.</b>' : ''} Answering his calls and working client orders keeps him on side.`);
        }
        const T = E.tier(W$);
        if (d >= 2) rules.push(`Your money: ${B.fmt.money(W$.cash)} cash${W$.card > 0 ? `, ${B.fmt.money(-W$.card)} on the card` : ''}. ${T.name}${T.rent ? `, ${B.fmt.money(T.rent * (W$.rentMult || 1))} rent due Friday` : ''}.${W$.arrears > 0 ? ` <b>${B.fmt.money(W$.arrears)} rent overdue.</b>` : ''}`);
        if (d >= 2) rules.push(`Risk desk: daily loss limit ${B.fmt.money(-E.P.lossLimit * (g && g.broker ? g.broker.equity() : capital))}. Hit it before 3:00 PM and get flat within ${E.P.flatWithin} minutes, and a missed quota that day is excused, once a week. Each kind of breach cuts your bonus ${Math.round(E.P.breachCut * 100)}% this week and next.`);
        if (remaining === 1) rules.push('FINAL WARNING: one more missed quota ends this career.');
        else if (remaining === 2) rules.push('WARNING: two missed quotas remain before termination.');
        if (S.f.v2RewoundToBell) rules.push('SAVE MIGRATION: this V2 mid-session save was rewound to the matching opening bell; book and decisions were preserved.');
        if (d === 0) rules.push('Tip: open How to Play from the pause menu (Esc) any time.');
        return {
          kicker: D.actOf(d) + ' ·',
          title: `Session ${d + 1}: ${day.title}`,
          html: day.brief(S).filter(Boolean).map((p) => `<p>${p}</p>`).join(''),
          feed: day.feed || [],
          anomalyCount: d >= 15 ? S.anomalies : null,
          quotaStrikes: { count: S.quotaStrikes, limit: QUOTA_STRIKE_LIMIT },
          weekQuota: g && g.broker ? (this.openWeek(g), this.weekQuota(g)) : null,
          quota: this.quota(d, g),
          quotaMeta: qm,
          rules
        };
      },

      rules(d) {
        let lev = 4;
        if (S.f.refusedDump && d >= 10 && d <= 14) lev = 3;
        if (S.f.dereg && d >= 20) lev = 6;
        if (S.f.regulation && d >= 20) lev = 3;
        if (S.f.letFail && d >= 35) lev = Math.max(2, lev - 1);
        const shortBan = (S.f.tipShortBan && d >= 35 && d <= 39) || d === 54 ? D.FIN : [];
        return { maxLev: lev, overnightLev: Math.max(1, lev / 2), shortBan };
      },

      scenario(d) {
        const scen = D.DAYS[d].scen(S);
        const rng = B.RNG(B.hashSeed('story-noise|' + d));
        const extra = B.News.randomEvents(rng, { newsFreq: 0.6, fakeShare: 0.35, volMult: 1 }).filter((e) => {
          if (e.kind === 'chirp') return true;
          const im = e.impacts[0];
          if (!im || im.scope === 'market') return false;
          if (im.scope === 'sector') return SAFE_SECTORS.indexOf(im.id) >= 0;
          const tk = B.TICKERS.find((t) => t.sym === im.id);
          return tk && SAFE_SECTORS.indexOf(tk.sector) >= 0;
        });
        scen.events = (scen.events || []).concat(extra);
        // Sqwak hype: big accounts naming a ticker move it briefly, true or not.
        if (B.Sqwak) scen.events = B.Sqwak.hype(scen.events, 'story|' + d);
        return scen;
      },

      quota(d, g) {
        const eq = g ? g.broker.equity() : capital;
        return Math.round(Math.max(750, eq * D.QUOTAS[d]) / 50) * 50;
      },

      quotaMeta(d, g) {
        const labels = ['BASELINE FLOOR', 'GROWTH MANDATE', 'LIQUIDITY EXTRACTION', 'SURVIVAL FLOOR'];
        const pct = D.QUOTAS[d];
        const prev = d > 0 ? D.QUOTAS[d - 1] : pct;
        const raised = d > 0 ? Math.round((pct / prev - 1) * 100) : 0;
        const amount = this.quota(d, g);
        const who = D.boss(S);
        let memo = d === 0
          ? `${who}: Desk floor set at ${B.fmt.money(amount)}. This is the minimum, not the target.`
          : `${who}: New ${labels[D.actIndex(d)].toLowerCase()}: ${B.fmt.money(amount)}. ${raised > 0 ? `Up ${raised}% from yesterday.` : 'No relief from yesterday.'} Volatility is not an excuse.`;
        const remaining = QUOTA_STRIKE_LIMIT - S.quotaStrikes;
        if (remaining === 1) memo += ' FINAL WARNING: one more miss ends your career.';
        else if (remaining === 2) memo += ' WARNING: only two misses remain.';
        return { label: labels[D.actIndex(d)], pct, previousPct: prev, raised, memo };
      },

      bearishExposure(g) {
        const eq = Math.max(1, g.broker.equity());
        let notional = 0;
        for (const sym of CASCADE_NAMES) {
          const qty = g.broker.posQty(sym);
          if (qty < 0 && g.market.bySym[sym]) notional += Math.abs(qty) * g.market.bySym[sym].last;
        }
        for (const o of g.broker.opts || []) {
          if (o.type === 'P' && CASCADE_NAMES.indexOf(o.sym) >= 0 && g.market.bySym[o.sym]) {
            notional += Math.abs(o.qty) * 100 * g.market.bySym[o.sym].last;
          }
        }
        return notional / eq;
      },

      stressCarry(d) { return (d > 0 && d % 5 === 0 ? 0.08 : 0.15) * E.tier(W$).carry; },

      calmMult() { return E.tier(W$).calm || 1; },
      onCouch() { return (W$.tier | 0) === 0; },

      // What home does to you before the bell: where you sleep, and whatever
      // the landlord did last week.
      morningStress() {
        const s = E.tier(W$).floor + (W$.stressNext || 0);
        W$.stressNext = 0;
        return s;
      },
      reconcileQuotaStrikes(history) {
        const byDay = {};
        const key = (entry) => (entry.kind === 'week' ? 'w' + entry.week : String(entry.day));
        for (const entry of S.quotaLedger) if (entry && Number.isFinite(entry.day)) byDay[key(entry)] = entry;
        for (const row of history || []) {
          if (!row || row.quotaMet !== false || byDay[String(row.day)]) continue;
          if ((S.forgivenDays || []).indexOf(row.day) >= 0) continue; // wiped by a made week
          byDay[String(row.day)] = { day: row.day, pnl: row.pnl || 0, migrated: true };
        }
        S.quotaLedger = Object.keys(byDay).map((k) => byDay[k]).sort((a, b) => a.day - b.day || (a.kind === 'week') - (b.kind === 'week'));
        S.quotaStrikes = S.quotaLedger.length;
        return S.quotaStrikes;
      },
      onFeedOpen(g, item) {
        S.feedOpenedDays[g.day] = true;
        if (!item || !item.anomalyId || S.openedAnomalies[item.anomalyId]) return;
        S.openedAnomalies[item.anomalyId] = true;
        S.anomalies = Object.keys(S.openedAnomalies).length;
      },
      // Resqwak consequences. Amplifying a rumour that never comes true costs
      // heat; amplifying one that does builds a little influence; touting a
      // stock you hold draws Compliance. Per-session caps stop farming.
      onResqwak(g, item) {
        const day = g.day;
        if (!S.resqwak || S.resqwak.day !== day) S.resqwak = { day, heat: 0, influence: 0, warned: false, count: 0, fakes: 0, trues: 0 };
        const R = S.resqwak;
        R.count++;
        S.resqwakTotal = (S.resqwakTotal || 0) + 1;
        let note = null;
        if (item.fake) R.fakes = (R.fakes || 0) + 1;
        else if (item.truth) R.trues = (R.trues || 0) + 1;
        if (B.Sqwak && B.Sqwak.account(item.src).followers >= B.Sqwak.HYPE_MIN_FOLLOWERS && B.Sqwak.tickersIn(item.text).length) R.moved = (R.moved || 0) + 1;
        if (item.fake) {
          const add = Math.min(3, 9 - R.heat);
          if (add > 0) { S.m.heat = B.clamp(S.m.heat + add, 0, 100); R.heat += add; }
          S.rumorsSpread = (S.rumorsSpread || 0) + 1;
        } else if (item.truth && R.influence < 3) {
          S.m.influence = B.clamp(S.m.influence + 1, 0, 100);
          R.influence++;
        }
        const syms = B.Sqwak ? B.Sqwak.tickersIn(item.text) : [];
        const held = syms.find((sym) => g.broker && g.broker.posQty(sym) !== 0);
        if (held) {
          const add = Math.min(2, 9 - R.heat);
          if (add > 0) { S.m.heat = B.clamp(S.m.heat + add, 0, 100); R.heat += add; }
          if (!R.warned) {
            R.warned = true;
            note = `Compliance: you publicly promoted $${held} while holding it.`;
            if (B.UI && B.UI.inbox) B.UI.inbox({ from: 'Compliance', text: `You resqwaked a post about $${held} while holding a position in it. Public promotion of your own positions is logged and reviewed.`, toast: false });
          }
        }
        return note;
      },
      onFeedSkip(g) {
        if (S.feedOpenedDays[g.day] || S.feedSkippedDays[g.day]) return;
        S.feedSkippedDays[g.day] = true;
        S.feedsSkipped++;
      },

      calls(d) { return D.DAYS[d].calls ? D.DAYS[d].calls(S) : []; },
      inbox(d) { return D.DAYS[d].inbox ? D.DAYS[d].inbox(S) : []; },
      bossName() { return D.boss(S); },
      wipeLevel() { return capital * 0.1; },

      weekBounds(d) {
        const start = Math.floor(d / 5) * 5;
        return { start, end: Math.min(start + 4, D.DAYS.length - 1) };
      },

      // Opens the week's book the first session of each week (or the first
      // session played after a load, using only the sessions that remain).
      openWeek(g) {
        const w = D.weekOf(g.day);
        if (S.week && S.week.w === w) return S.week;
        const eq = g.broker.equity();
        const { end } = this.weekBounds(g.day);
        let pct = 0;
        for (let d = g.day; d <= end; d++) pct += D.QUOTAS[d];
        S.week = { w, start: g.day, end, solo: Math.floor(g.day / 5) * 5 === end, startEq: eq, target: Math.round(Math.max(1500, eq * pct * WEEK_MULT) / 50) * 50, done: false };
        return S.week;
      },

      weekQuota(g, equity) {
        const W = S.week;
        // The orphan final Monday is a week of one session: the daily quota covers it.
        if (!W || W.w !== D.weekOf(g.day) || W.solo) return null;
        const eq = equity == null ? g.broker.equity() : equity;
        return { week: W.w, target: W.target, made: eq - W.startEq, left: W.end - g.day + 1, done: W.done };
      },

      onDayStart(g) {
        const b = g.broker;
        this.openWeek(g);
        this.applyPending(g);

        // Session 16: did you actually trade on Perry's downgrade tip?
        if (g.day === 15 && S.f.insider && !S.f.insiderChecked) {
          S.f.insiderChecked = true;
          const shorted = CASCADE_NAMES.some((s) => b.posQty(s) < 0)
            || b.opts.some((o) => CASCADE_NAMES.indexOf(o.sym) >= 0 && o.type === 'P');
          if (shorted) {
            S.f.insiderTraded = true;
            D.adj(S, { heat: 20 });
            g.inboxQueue.push({ t: 20, from: 'Compliance', text: 'Your positions in the CASCADE names were opened hours before the Meridian downgrade. Explain the timing. In writing. Today.' });
          }
        }

        // Session 40: the pension fund you sold to has lawyers.
        if (g.day === 39 && S.f.dumped && !S.f.riverbendPaid) {
          S.f.riverbendPaid = true;
          b.cash -= 40000;
          if (b.dayRisk) { b.dayRisk.adj = (b.dayRisk.adj || 0) - 40000; b.dayRisk.trough -= 40000; }
          D.adj(S, { heat: 15 });
          B.UI.toast('Legal: $40,000 deducted for your share of the Riverbend settlement.', 'bad');
        }

        // Session 52: with limits raised and nobody watching, the firm automates the desk.
        if (g.day === 51 && S.f.dereg && !S.f.regulation && !S.f.reported && !S.f.algoDesk) {
          S.f.algoDesk = true;
          g.inboxQueue.push({ t: 45, from: 'Desmond Kroll', text: 'FYI: risk has signed off on running flow through the automated stack next month. Cost line goes down. You\'ll like the bonus math.' });
        }

        this.auditAt = null;
        if (S.m.heat >= 50) {
          const rng = B.RNG(B.hashSeed('audit|' + g.day));
          if (rng.next() < (S.m.heat - 40) / 120) this.auditAt = Math.round(rng.range(60, 300));
        }
        g.inboxQueue.sort((a, c) => a.t - c.t);
      },

      // A mid-day save rebuilds the day, so the audit roll has to be rebuilt too.
      onResume(g) {
        this.auditAt = null;
        if (S.m.heat >= 50) {
          const rng = B.RNG(B.hashSeed('audit|' + g.day));
          if (rng.next() < (S.m.heat - 40) / 120) {
            const at = Math.round(rng.range(60, 300));
            if (at > g.market.t) this.auditAt = at;
          }
        }
      },

      applyPending(g) {
        const b = g.broker, m = g.market;
        while (S.pending.length) {
          const p = S.pending.shift();
          if (p.type === 'cash') {
            if (!p.amount) continue;
            b.cash += p.amount;
            // Booked money is not trading: it moves the day's baseline, not its P&L.
            if (b.dayRisk) b.dayRisk.adj = (b.dayRisk.adj || 0) + p.amount;
            B.UI.toast(`${p.reason}: ${B.fmt.money(p.amount, true)}`, p.amount >= 0 ? 'good' : 'bad');
          } else if (p.type === 'personal') {
            // Money that is yours, not the book's.
            W$.cash += p.amount;
            B.UI.toast(`${p.reason}: ${B.fmt.money(p.amount, true)} to your own account`, 'good');
          } else if (p.type === 'fineFrac') {
            const amt = Math.max(0, b.equity() * p.frac);
            b.cash -= amt;
            if (b.dayRisk) { b.dayRisk.adj = (b.dayRisk.adj || 0) - amt; b.dayRisk.trough -= amt; }
            B.UI.toast(`${p.reason}: -${B.fmt.money(amt)}`, 'bad');
          } else if (p.type === 'short') {
            const px = m.bySym[p.sym].last;
            const qty = Math.floor(b.equity() * p.mult / px);
            if (qty > 0 && m.status === 'open') b.marketOrder(p.sym, -qty, { forced: true, tag: 'DESK SHORT' });
            B.UI.toast(`Desk short added: ${B.fmt.qty(qty)} ${p.sym}`, 'warn');
          } else if (p.type === 'grant') {
            const px = m.bySym[p.sym].last;
            const qty = Math.floor(p.value / px);
            const cur = b.pos[p.sym];
            if (cur && cur.qty > 0) { cur.avg = (cur.avg * cur.qty + px * qty) / (cur.qty + qty); cur.qty += qty; }
            else if (!cur) b.pos[p.sym] = { qty, avg: px, realized: 0 };
            else b.cash += p.value; // already short the name: take it as cash instead
            if (b.dayRisk) b.dayRisk.adj = (b.dayRisk.adj || 0) + qty * px;
            B.UI.toast(`Stock grant: ${B.fmt.qty(qty)} ${p.sym}`, 'good');
          }
        }
      },

      onTick(g, t) {
        if (B.Mentor && g.day <= B.Mentor.LAST_DAY) B.Mentor.tick(g, t, S);
        if (this.auditAt != null && t >= this.auditAt && !g.lock) {
          this.auditAt = null;
          g.setLock(30, 'Examiners at your desk. Account frozen.', 'audit');
          B.UI.addNews({ kind: 'chirp', text: 'regulators on the 41st floor at HLST right now. someone is in trouble', src: '@TheTapeReader', t });
          g.stress.spike(10);
        }
      },

      onTrade(g, sym) {
        if (sym === 'HLST' && !S.f.defected) {
          D.adj(S, { heat: 1 });
          if (!S.complianceWarned) {
            S.complianceWarned = true;
            B.UI.inbox({ from: 'Compliance', text: 'Reminder: trading your own firm\'s stock is logged and reviewed. Every single trade.' });
          }
        }
      },

      onScript(g, id) {
        if (id === 'voteFail') { g.stress.spike(20); B.UI.shake(10); B.SFX.crash(); B.Music.cue('breaker'); }
        if (id === 'votePass') { g.stress.spike(-10); B.SFX.cash(); }
        if (id === 'loop' || id === 'worstSession' || id === 'finalSession') { g.stress.spike(16); B.UI.shake(8); B.SFX.crash(); }
        if (id === 'pullFlatten' && !S.f.pullCostApplied) {
          S.f.pullCostApplied = true;
          this.liquidate(g);
          const target = capital * 0.10;
          const cut = Math.max(0, g.broker.equity() - target);
          g.broker.cash -= cut;
          const dr = g.broker.dayRisk;
          if (dr) { dr.adj = (dr.adj || 0) - cut; dr.trough = Math.min(dr.trough, g.broker.equity()); }
          B.UI.toast('STACK OFFLINE. Risk flattened the book into the opening auction.', 'bad big');
        }
      },

      onMissedCall(g, call) {
        if (call.kind === 'boss' && !S.f.defected) D.adj(S, {}, { kroll: -2 });
      },
      onTaskFailed() { if (!S.f.defected) D.adj(S, {}, { kroll: -2 }); },
      onTaskDone() { if (!S.f.defected) D.adj(S, {}, { kroll: 2 }); },

      resolveMidChoice(g, choiceId, optId, timedOut) {
        const c = D.CHOICES[choiceId];
        const opt = c.options.find((o) => o.id === optId) || c.options.find((o) => o.id === 'ignore' || o.id === 'refuse');
        opt.apply(S);
        S.choices[choiceId] = opt.id;
        if (opt.headline) S.log.push({ day: g.day, text: opt.headline });
        if (S.pending.length) this.applyPending(g);
        return (timedOut ? '(You hesitated too long.) ' : '') + opt.reply;
      },

      onDayEnd(g, r) {
        const notes = [];
        // The day's resqwaks are judged after the bell, once the truth is out.
        const R = S.resqwak;
        if (R && R.day === g.day && R.count) {
          const n = R.count, f = R.fakes || 0, t = R.trues || 0;
          const parts = [`You resqwaked ${n} post${n === 1 ? '' : 's'} today.`];
          if (f) parts.push(`<b>${f} turned out to be fake.</b> Compliance noticed.`);
          if (t) parts.push(`${t} ${t === 1 ? 'was' : 'were'} right, and people saw you share ${t === 1 ? 'it' : 'them'} first.`);
          const mv = R.moved || 0;
          if (mv) parts.push(`${mv === n ? (n === 1 ? 'It' : 'All of them') : mv} moved a stock for a few minutes, true or not.`);
          if (!f && !t && !mv) parts.push('None of them moved anything.');
          notes.push(`Sqwak: ${parts.join(' ')}`);
        }
        if (g.day === D.DAYS.length - 1 && !S.f.pulledPlug && ((S.anomalies || 0) < 8 || S.f.leftStack)) {
          S.f.aiUncontained = true;
        }
        if (g.day === 25) {
          S.falseDawnBear = { boundary: this.bearishExposure(g) >= 0.10, hits: 0, gaps: 0, maxGap: 0, samples: [] };
        }
        if (g.day >= 41 && g.day <= 48) {
          S.falseDawnBear = S.falseDawnBear || { boundary: false, hits: 0, gaps: 0, maxGap: 0, samples: [] };
          const ratio = this.bearishExposure(g);
          const held = ratio >= 0.10;
          S.falseDawnBear.samples.push({ day: g.day, ratio: +ratio.toFixed(4), held });
          if (held) { S.falseDawnBear.hits++; S.falseDawnBear.gaps = 0; }
          else { S.falseDawnBear.gaps++; S.falseDawnBear.maxGap = Math.max(S.falseDawnBear.maxGap, S.falseDawnBear.gaps); }
        }
        if (g.day === 40) {
          S.falseDawnBear = S.falseDawnBear || { boundary: false, hits: 0, gaps: 0, maxGap: 0, samples: [] };
          S.falseDawnBear.rallyStart = r.equity;
        }
        if (g.day === 48) {
          // The rally has to hurt: holding the bear case through it must have
          // cost at least 5% of the book since the rally began.
          const x = S.falseDawnBear;
          const hurt = x && (x.rallyStart ? r.equity <= x.rallyStart * 0.95 : r.equity < capital);
          S.f.rightTooEarly = !!(x && x.boundary && x.hits >= 6 && x.maxGap <= 2 && hurt);
        }
        const rv = this.riskReview(g, r);
        // Stopping cleanly at the loss limit is the job. The risk desk excuses
        // that day's missed quota, so the lesson and the rules agree.
        // One excuse per week, and only for a limit hit before 3:00 PM, so the
        // rule rewards stopping, not losing on purpose to dodge a strike.
        const wk = D.weekOf(g.day);
        const usedThisWeek = (S.excusedDays || []).some((d) => d !== g.day && D.weekOf(d) === wk);
        const early = !g.broker.dayRisk || g.broker.dayRisk.breachT == null || g.broker.dayRisk.breachT < EXCUSE_BEFORE;
        const excused = !r.quotaMet && rv.hitLimit && !rv.breaches.length && !usedThisWeek && early;
        if (r.quota > 0) {
          if (r.quotaMet) {
            S.missStreak = 0;
            // Kroll notices results, not just whether you pick up the phone.
            if (!S.f.defected) D.adj(S, {}, { kroll: 1 });
            notes.push(`${D.boss(S)}: "Quota met.${g.day === D.DAYS.length - 1 ? '"' : ' Again tomorrow."'}`);
          } else if (excused) {
            if ((S.forgivenDays || []).indexOf(g.day) < 0) S.forgivenDays = (S.forgivenDays || []).concat(g.day);
            if ((S.excusedDays || []).indexOf(g.day) < 0) S.excusedDays = (S.excusedDays || []).concat(g.day);
            S.quotaLedger = S.quotaLedger.filter((e) => !(e.day === g.day && e.kind !== 'week'));
            S.quotaStrikes = S.quotaLedger.length;
            notes.push(`<b>Quota missed, strike excused.</b> You stopped at the loss limit and got flat. The risk desk signed off on the day. ${D.boss(S)} did not like it, but the rule is the rule.`);
          } else {
            S.missStreak++;
            if (!S.quotaLedger.some((entry) => entry.day === g.day && entry.kind !== 'week')) {
              S.quotaLedger.push({ day: g.day, pnl: r.pnl, quota: r.quota, date: r.date });
              S.quotaLedger.sort((a, b) => a.day - b.day);
            }
            S.quotaStrikes = S.quotaLedger.length;
            const left = QUOTA_STRIKE_LIMIT - S.quotaStrikes;
            const warning = left === 1 ? ' FINAL WARNING: one more miss ends your career.' : left === 2 ? ' Only two misses remain.' : '';
            notes.push(`<b>Missed quota. Career strike ${S.quotaStrikes} of ${QUOTA_STRIKE_LIMIT}.</b>${warning} ${D.boss(S)} logged the miss.`);
          }
        }
        const W = S.week;
        // Only sessions that carry a quota count toward the week.
        if (W && W.w === D.weekOf(g.day) && !W.done && !W.solo && r.quota > 0) {
          const made = r.equity - W.startEq;
          if (g.day >= W.end) {
            W.done = true;
            if (made >= W.target) {
              D.adj(S, { firm: 2 }, { kroll: 3 });
              let wiped = '';
              const missed = S.quotaLedger.filter((e) => e.kind !== 'week' && e.day >= W.start && e.day <= W.end);
              if (missed.length) {
                const wipe = missed.slice(-WEEK_WIPES);
                S.quotaLedger = S.quotaLedger.filter((e) => wipe.indexOf(e) < 0);
                S.forgivenDays = (S.forgivenDays || []).concat(wipe.map((e) => e.day));
                S.quotaStrikes = S.quotaLedger.length;
                wiped = ` It wipes ${wipe.length === 1 ? 'one missed day' : wipe.length + ' missed days'} off your record: <b>career strikes ${S.quotaStrikes} of ${QUOTA_STRIKE_LIMIT}.</b>`;
              }
              notes.push(`<b>Weekly quota met:</b> ${B.fmt.money(made, true)} against ${B.fmt.money(W.target)}.${wiped} ${D.boss(S)}: "Good week. The next one starts higher."`);
            } else {
              if (!S.quotaLedger.some((e) => e.kind === 'week' && e.week === W.w)) {
                S.quotaLedger.push({ day: g.day, week: W.w, kind: 'week', pnl: made, quota: W.target, date: r.date });
                S.quotaLedger.sort((a, b) => a.day - b.day || (a.kind === 'week') - (b.kind === 'week'));
              }
              S.quotaStrikes = S.quotaLedger.length;
              notes.push(`<b>Weekly quota missed:</b> ${B.fmt.money(made, true)} against ${B.fmt.money(W.target)}. Career strike ${S.quotaStrikes} of ${QUOTA_STRIKE_LIMIT}. The week resets Monday.`);
            }
          } else {
            const need = W.target - made;
            const left = W.end - g.day;
            notes.push(need > 0
              ? `Week so far: ${B.fmt.money(made, true)} of ${B.fmt.money(W.target)}. ${B.fmt.money(need)} to go with ${left} session${left === 1 ? '' : 's'} left.`
              : `Week so far: ${B.fmt.money(made, true)}. Weekly quota of ${B.fmt.money(W.target)} already cleared. Hold it through Friday.`);
          }
        }
        notes.push(...this.payroll(g, r));
        if (r.earlyEnd === 'wiped' || r.equity < capital * 0.1) return { notes, ending: this.buildEnding(g, 'wiped') };
        if (S.quotaStrikes >= QUOTA_STRIKE_LIMIT) return { notes, ending: this.buildEnding(g, 'fired') };
        // Kroll can fire you, but not in the final week: by then the ending is yours.
        if (!S.f.defected && S.rel.kroll <= 0 && g.day < BOSS_FIRE_LAST) return { notes, ending: this.buildEnding(g, 'fired', 'boss') };
        const mood = this.bossMood();
        if (!S.f.defected && mood.warn && g.day < BOSS_FIRE_LAST) notes.push(`<b>${D.boss(S)} is losing patience with you (${mood.value}/100).</b> Missed calls and blown client orders cost you with him. At zero, you are out.`);
        if (g.day % 5 === 4 && g.day < D.DAYS.length - 1) {
          const bases = { integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 };
          for (const k in bases) S.m[k] = B.clamp(S.m[k] + (bases[k] - S.m[k]) * 0.08, 0, 100);
          notes.push('The closed market takes a little pressure out of every meter. Not enough.');
        }
        if (S.m.heat >= 50) notes.push('Your heat with regulators is <b>high</b>.');
        if (g.day === D.DAYS.length - 1) return { notes, ending: this.buildEnding(g, 'final') };
        return { notes };
      },

      // Risk desk review every session; payslip and bills every Friday and on
      // the lone final Monday. Keyed by day and week so a replayed close never
      // pays or bills twice.
      // How your boss rates you, in words the player can act on.
      bossMood() {
        const v = Math.round(S.rel.kroll);
        const label = v >= 60 ? 'trusts you' : v >= 35 ? 'is watching you' : v >= 20 ? 'is losing patience' : 'is looking for a reason';
        return { value: v, label, warn: v < 35 };
      },

      // The risk desk's verdict on one close, computed once per report.
      riskReview(g, r) {
        if (r.riskReview) return r.riskReview;
        const b = g.broker;
        r.riskReview = E.review({
          risk: b.dayRisk, start: (r.start || 0) + ((b.dayRisk && b.dayRisk.adj) || 0), trades: b.dayTrades ? b.dayTrades() : [],
          forced: r.eod && r.eod.forced, maxLev: b.rules && b.rules.maxLev,
          closeLev: b.leverage && Number.isFinite(r.equity) && r.equity > 0 ? b.stockGross() / r.equity : 0,
          events: g.market && g.market.events
        });
        return r.riskReview;
      },

      payroll(g, r) {
        const out = [];
        const b = g.broker;
        const rv = this.riskReview(g, r);
        W$.days[g.day] = rv.breaches.map((x) => ({ id: x.id, zero: !!x.zero }));
        // Drawdown is measured against the running peak of the book, intraday.
        if (Number.isFinite(r.equity)) {
          // Story fines move the baseline; they are not a drawdown you traded into.
          const low = b.dayRisk ? b.dayRisk.trough - (b.dayRisk.adj || 0) : r.equity;
          if (low < W$.peakEq * (1 - E.P.drawdown)) (W$.ddDays = W$.ddDays || {})[g.day] = true;
          W$.peakEq = Math.max(W$.peakEq, r.equity, b.dayPeak || 0);
        }
        r.riskReview = rv;
        out.push(E.reviewNote(rv));
        const last = g.day === D.DAYS.length - 1;
        if (g.day % 5 !== 4 && !last) return out;
        const wk = D.weekOf(g.day);
        if (W$.weeks[wk] || !Number.isFinite(r.equity)) return out;
        const first = (wk - 1) * 5;
        const breaches = [], lastBreaches = [];
        let drawdown = false;
        for (let d = first; d <= g.day; d++) {
          for (const x of W$.days[d] || []) breaches.push(x);
          if (W$.ddDays && W$.ddDays[d]) drawdown = true;
        }
        for (let d = Math.max(0, first - 5); d < first; d++) for (const x of W$.days[d] || []) lastBreaches.push({ id: x.id });
        const weekMade = last && g.day % 5 === 0
          ? !!r.quotaMet
          : !S.quotaLedger.some((e) => e.kind === 'week' && e.week === wk);
        const res = E.settle(W$, { equity: r.equity, capital, weekMade, breaches, lastBreaches, drawdown, sessions: g.day - first + 1 });
        W$.weeks[wk] = { net: res.net, bonus: res.bonus, draw: res.draw };
        W$.stressNext = (W$.stressNext || 0) + res.stress;
        r.payslip = res;
        return out.concat(res.lines);
      },

      // Sunday: the one weekly money decision. Where you live.
      weekendLedger(g, cb) {
        if (!B.Screens.ledger) return cb();
        B.Screens.ledger({ wallet: W$, options: E.moveOptions(W$), tiers: E.TIERS, worth: E.netWorth(W$), weekly: E.weekly(E.tier(W$), W$),
          draw: Math.round(E.P.drawPerSession * 5 * (1 - E.P.taxRate)) }, (i) => {
          if (i != null) E.move(W$, i);
          cb();
        });
      },

      // Apply one life beat's option to the story state and the wallet, once.
      applyLife(id, optId) {
        const beat = B.Life && B.Life.byId(id);
        if (!beat || (W$.life && W$.life[id])) return null;
        const ok = beat.options.filter((o) => !o.req || o.req(S, W$));
        const opt = ok.find((o) => o.id === optId) || ok[ok.length - 1];
        const after = opt.apply(S, W$, E) || [];
        (W$.life = W$.life || {})[id] = opt.id;
        S.log.push({ day: beat.day, text: `${beat.title}: ${opt.label}` });
        return { beat, opt, after };
      },

      // After the desk's decision (if any), the day's personal-money beat.
      lifeBeat(g, cb) {
        const beat = B.Life && B.Life.byDay(g.day);
        if (!beat || (W$.life && W$.life[beat.id]) || !B.Screens.choice || (beat.when && !beat.when(S, W$))) return cb();
        // You decide with your balance in front of you.
        const bal = `<span class="muted">Your money: ${B.fmt.money(W$.cash)} cash${W$.card > 0 ? ` · ${B.fmt.money(-W$.card)} on the card` : ''} · ${E.tier(W$).name}, ${B.fmt.money(E.weekly(E.tier(W$), W$))} a week all in.</span>`;
        const view = { speaker: beat.speaker, role: beat.role, kicker: beat.kicker, title: beat.title, text: beat.text(S, W$).concat(bal),
          options: beat.options.filter((o) => !o.req || o.req(S, W$)).map((o) => ({ id: o.id, label: o.label, hint: o.hint })) };
        B.Screens.choice(view, S, (optId) => {
          const res = this.applyLife(beat.id, optId);
          B.Screens.aftermath(beat.title, (res && res.after) || [], () => cb());
        });
      },

      afterDay(g, cb) {
        const d = g.day;
        const done = cb;
        cb = (ending) => (ending ? done(ending) : this.lifeBeat(g, done));
        const id = Object.keys(D.CHOICES).find((k) => D.CHOICES[k].day === d && !D.CHOICES[k].mid);
        if (!id) return cb();
        const c = D.CHOICES[id];
        const wealth = g.broker.equity();
        if (c.req && !c.req(S, wealth)) return cb();
        const view = Object.assign({}, c, {
          options: c.options.filter((o) => !o.req || o.req(S, wealth)).map((o) => Object.assign({}, o, { req: null }))
        });
        B.Screens.choice(view, S, (optId) => {
          const opt = c.options.find((o) => o.id === optId);
          opt.apply(S);
          S.choices[id] = optId;
          if (opt.headline) S.log.push({ day: d, text: opt.headline });
          if (id === 'c8') S.f.billPassed = votePasses(S);
          B.Screens.aftermath(c.title, opt.after || [], () => {
            // Taking the plane ends the career on the spot.
            if (S.f.fled) {
              this.liquidate(g);
              return cb(this.buildEnding(g, 'final'));
            }
            cb();
          });
        });
      },

      liquidate(g) {
        const b = g.broker, m = g.market;
        for (const s of Object.keys(b.pos)) b.fill(s, -b.pos[s].qty, m.bySym[s].last, 'LIQUIDATED');
        for (const o of b.opts) b.cash += B.Options.mid(m, o) * o.qty * 100;
        b.opts = [];
        b.orders = [];
      },

      buildEnding(g, reason, firedBy) {
        const ctx = { S, wealth: g.broker.equity(), start: capital, reason, firedBy,
          days: g.history.length, quotaMet: g.history.filter((h) => h.quotaMet).length,
          settled: E.settleUp(W$),
          personal: { worth: E.netWorth(W$), band: E.band(W$), home: E.tier(W$).name, couch: (W$.tier | 0) === 0, evictions: W$.evictions,
            breachDays: Object.keys(W$.days).filter((k) => W$.days[k].length).length } };
        const e = B.StoryEndings.resolve(ctx);
        const P = ctx.personal;
        // A fall guy pays a lawyer before anything else.
        if (e.id === 'fall-guy' && P.worth > 0) { const fee = Math.min(P.worth, 25000); E.charge(W$, fee); P.worth = E.netWorth(W$); P.retainer = fee; }
        const home = P.couch ? "a spot on your mother's couch" : `the ${P.home}`;
        const clean = P.breachDays <= 5;
        const money = B.fmt.money(Math.abs(P.worth));
        const owe = P.worth < 0;
        // Endings where the money is not the point, or not yours to keep.
        const special = {
          perp: owe ? `The seizure order found nothing of yours but debts. You still owe ${money}.` : `The seizure order covered your personal accounts too. The ${money} you had of your own went with the rest.`,
          clawback: owe ? `You owe ${money}, and the clawback froze the deferred pay you were counting on.` : `The clawback reached past the firm: your deferred pay and the ${money} of your own are frozen pending review.`,
          'fall-guy': `Your lawyer's retainer took ${B.fmt.money(P.retainer || 0)} of your own before the first hearing.${owe ? ` You owe ${money} on top.` : P.worth > 0 ? ` ${money} is left.` : ''}`,
          fired: owe ? `Security walked you out owing ${money}${P.couch ? ', back to your mother\'s couch.' : ', with rent due Friday.'}` : `Security walked you out with ${money} of your own and no reference.`,
          wiped: owe ? `The book is gone, and so is your credit: you owe ${money}.` : `The book is gone. You still have ${money} of your own, and nobody who will hire you.`,
          exit: S.f.pulledPlug
            ? `The firm's money went into the gap. ${owe ? `You owe ${money}. You sleep anyway.` : `Yours, ${money}, did not. It is enough to disappear for a while.`}`
            : `You left without a headline. ${owe ? `You owe ${money}, and nobody is looking for you.` : `${money} of your own, and nobody looking for you.`}`,
          nobody: owe ? `You owe ${money} to a system that will never ask for it back.` : `Your own ${money} sits in an account no human will ever look at again.`,
          master: owe ? `You left with the book and ${money} of debt behind you. Neither will follow you, for a while.` : `You left with the book and ${money} of your own. Neither will spend the way it used to.`
        };
        // What the box says your own money is, when the ending took it.
        if (e.id === 'perp' && !owe) P.label = 'Seized';
        if (e.id === 'clawback' && !owe) P.label = 'Frozen';
        const extras = (ctx.settled || []).slice();
        if (W$.perryLoan) extras.push(S.m.stability >= 45 ? 'Perry paid back the six thousand in March, with a note.' : 'Perry never paid back the six thousand. You never asked.');
        if (W$.perryRefused) extras.push('Perry stopped answering your texts sometime in the spring.');
        if (W$.dadUnpaid) extras.push("Your father's surgery bill went to collections. Your mother never mentioned it again.");
        const tail = extras.length ? ' ' + extras.join(' ') : '';
        const epilogue0 = special[e.id] ? `Personally: ${special[e.id]}`
          : P.band === 'broke'
            ? `Personally, you walked away owing ${money}. The book was never yours; the debt is.${P.couch ? " You still sleep on your mother's couch." : ''}`
            : P.band === 'rich'
              ? `Personally, you walked away with ${money} of your own and ${home}. ${clean ? 'The desk paid for discipline, and you gave it some.' : `The risk desk logged breaches on ${P.breachDays} sessions. The money came anyway. It usually does, until it doesn't.`}`
              : P.worth < 5000
                ? `Personally, you walked away with ${money} and ${home}. Not enough for next month.`
                : `Personally, you walked away with ${money} and ${home}. Enough for a month or two. Not enough to stop.`;
        const epilogue = epilogue0 + tail;
        return {
          id: e.id, title: e.title, headline: e.headline,
          deck: firedBy === 'boss' && e.id === 'fired' ? 'Firm cites "a breakdown of trust" as the crisis claims another desk.' : e.deck,
          story: e.story(ctx).concat(epilogue), wealth: e.wealth(ctx), personal: P,
          dark: !!e.dark || ['wiped', 'fired', 'perp', 'depression', 'replaced'].indexOf(e.id) >= 0,
          unpriced: !!e.unpriced,
          timeline: S.log.map((l) => `<b>W${D.weekOf(l.day)} ${D.dowOf(l.day)}:</b> ${l.text}`),
          indexMonth: g.market.bySym.INDX.last / (g.indexStart || 512.4) - 1
        };
      },

      serialize() { return { S }; }
    };
    mode.strikeLimit = QUOTA_STRIKE_LIMIT;
    return mode;
  };

  B.StoryMode.votePasses = votePasses;
  B.StoryMode.freshState = freshState;
  B.StoryMode.QUOTA_STRIKE_LIMIT = QUOTA_STRIKE_LIMIT;
})(window.BTB);
