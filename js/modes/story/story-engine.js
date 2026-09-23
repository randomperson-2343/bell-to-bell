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
  // Sectors outside the CASCADE story. Background noise lives here so every day
  // stays tradable even when the scripted drama is pointed somewhere else.
  const SAFE_SECTORS = ['retail', 'haven', 'defense', 'power'];
  // The names the CASCADE trade actually sits in.
  const CASCADE_NAMES = ['BSTN', 'HLST', 'RDGW', 'FRLN', 'AMVL'];

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

      stressCarry(d) { return d > 0 && d % 5 === 0 ? 0.08 : 0.15; },
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
            B.UI.toast(`${p.reason}: ${B.fmt.money(p.amount, true)}`, p.amount >= 0 ? 'good' : 'bad');
          } else if (p.type === 'fineFrac') {
            const amt = Math.max(0, b.equity() * p.frac);
            b.cash -= amt;
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
            B.UI.toast(`Stock grant: ${B.fmt.qty(qty)} ${p.sym}`, 'good');
          }
        }
      },

      onTick(g, t) {
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
          g.broker.cash -= Math.max(0, g.broker.equity() - target);
          B.UI.toast('STACK OFFLINE. Risk flattened the book into the opening auction.', 'bad big');
        }
      },

      onMissedCall(g, call) {
        if (call.kind === 'boss' && !S.f.defected) D.adj(S, {}, { kroll: -2 });
      },
      onTaskFailed() { if (!S.f.defected) D.adj(S, {}, { kroll: -3 }); },
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
          if (!f && !t) parts.push('None of them moved anything.');
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
        if (g.day === 48) {
          const x = S.falseDawnBear;
          S.f.rightTooEarly = !!(x && x.boundary && x.hits >= 6 && x.maxGap <= 2 && r.equity < capital);
        }
        if (r.quota > 0) {
          if (r.quotaMet) {
            S.missStreak = 0;
            notes.push(`${D.boss(S)}: "Quota met. Again tomorrow."`);
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
                const last = missed[missed.length - 1];
                S.quotaLedger = S.quotaLedger.filter((e) => e !== last);
                S.forgivenDays = (S.forgivenDays || []).concat(last.day);
                S.quotaStrikes = S.quotaLedger.length;
                wiped = ` It wipes one missed day off your record: <b>career strikes ${S.quotaStrikes} of ${QUOTA_STRIKE_LIMIT}.</b>`;
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
        if (r.earlyEnd === 'wiped' || r.equity < capital * 0.1) return { notes, ending: this.buildEnding(g, 'wiped') };
        if (S.quotaStrikes >= QUOTA_STRIKE_LIMIT || (!S.f.defected && S.rel.kroll <= 0)) return { notes, ending: this.buildEnding(g, 'fired') };
        if (g.day % 5 === 4 && g.day < D.DAYS.length - 1) {
          const bases = { integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 };
          for (const k in bases) S.m[k] = B.clamp(S.m[k] + (bases[k] - S.m[k]) * 0.08, 0, 100);
          notes.push('The closed market takes a little pressure out of every meter. Not enough.');
        }
        if (S.m.heat >= 50) notes.push('Your heat with regulators is <b>high</b>.');
        if (g.day === D.DAYS.length - 1) return { notes, ending: this.buildEnding(g, 'final') };
        return { notes };
      },

      afterDay(g, cb) {
        const d = g.day;
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
            if (S.f.fled) {
              this.liquidate(g);
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

      buildEnding(g, reason) {
        const ctx = { S, wealth: g.broker.equity(), start: capital, reason,
          days: g.history.length, quotaMet: g.history.filter((h) => h.quotaMet).length };
        const e = B.StoryEndings.resolve(ctx);
        return {
          id: e.id, title: e.title, headline: e.headline, deck: e.deck,
          story: e.story(ctx), wealth: e.wealth(ctx),
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
