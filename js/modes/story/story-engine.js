// Story Mode controller: turns story state into scenarios, rules, quotas, consequences and endings.
(function (B) {
  'use strict';
  const D = B.StoryData;
  // Sectors outside the CASCADE story. Background noise lives here so every day
  // stays tradable even when the scripted drama is pointed somewhere else.
  const SAFE_SECTORS = ['retail', 'haven', 'defense', 'power'];
  // The names the CASCADE trade actually sits in.
  const CASCADE_NAMES = ['BSTN', 'HLST', 'RDGW', 'FRLN', 'AMVL'];

  function freshState(capital) {
    return {
      m: { integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 },
      rel: { imani: 60, sana: 20, thorne: 30, kroll: 50, venn: 25, perry: 45, greta: 20 },
      f: {}, choices: {}, log: [], pending: [], missStreak: 0, startCapital: capital, complianceWarned: false
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
        return `${D.actOf(g.day)} · Day ${g.day + 1}/${D.DAYS.length}`;
      },

      briefing(d, g) {
        const day = D.DAYS[d];
        const r = this.rules(d);
        const qm = this.quotaMeta(d, g);
        const rules = [];
        if (r.maxLev !== 4) rules.push(`Leverage limit: ${r.maxLev}x intraday / ${r.maxLev / 2}x overnight`);
        if (r.shortBan.length) rules.push('EMERGENCY ORDER: short selling of financial stocks is banned');
        if (S.m.heat >= 50) rules.push('Compliance is watching you. Examiners may visit your desk.');
        if (S.missStreak > 0) rules.push(`Missed-quota strikes: ${S.missStreak}/3`);
        if (d === 0) rules.push('Tip: open How to Play from the pause menu (Esc) any time.');
        return {
          kicker: D.actOf(d) + ' ·',
          title: `Day ${d + 1}: ${day.title}`,
          html: day.brief(S).filter(Boolean).map((p) => `<p>${p}</p>`).join(''),
          quota: this.quota(d, g),
          quotaMeta: qm,
          rules
        };
      },

      rules(d) {
        let lev = 4;
        if (S.f.refusedDump && d >= 2 && d <= 3) lev = 3;
        if (S.f.dereg && d >= 6) lev = 6;
        if (S.f.regulation && d >= 6) lev = 3;
        if (S.f.letFail && d >= 10) lev = Math.max(2, lev - 1);
        const shortBan = S.f.tipShortBan && d >= 10 && d <= 12 ? D.FIN : [];
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
        const memo = d === 0
          ? `${who}: Desk floor set at ${B.fmt.money(amount)}. This is the minimum, not the target.`
          : `${who}: New ${labels[D.actIndex(d)].toLowerCase()}: ${B.fmt.money(amount)}. ${raised > 0 ? `Up ${raised}% from yesterday.` : 'No relief from yesterday.'} Volatility is not an excuse.`;
        return { label: labels[D.actIndex(d)], pct, previousPct: prev, raised, memo };
      },

      calls(d) { return D.DAYS[d].calls ? D.DAYS[d].calls(S) : []; },
      inbox(d) { return D.DAYS[d].inbox ? D.DAYS[d].inbox(S) : []; },
      bossName() { return D.boss(S); },
      wipeLevel() { return capital * 0.1; },

      onDayStart(g) {
        const b = g.broker;
        this.applyPending(g);

        // Day 5: did you actually trade on Perry's downgrade tip?
        if (g.day === 4 && S.f.insider && !S.f.insiderChecked) {
          S.f.insiderChecked = true;
          const shorted = CASCADE_NAMES.some((s) => b.posQty(s) < 0)
            || b.opts.some((o) => CASCADE_NAMES.indexOf(o.sym) >= 0 && o.type === 'P');
          if (shorted) {
            S.f.insiderTraded = true;
            D.adj(S, { heat: 20 });
            g.inboxQueue.push({ t: 20, from: 'Compliance', text: 'Your positions in the CASCADE names were opened hours before the Meridian downgrade. Explain the timing. In writing. Today.' });
          }
        }

        // Day 11: the pension fund you sold to has lawyers.
        if (g.day === 10 && S.f.dumped && !S.f.riverbendPaid) {
          S.f.riverbendPaid = true;
          b.cash -= 40000;
          D.adj(S, { heat: 15 });
          B.UI.toast('Legal: $40,000 deducted for your share of the Riverbend settlement.', 'bad');
        }

        // Day 13: with limits raised and nobody watching, the firm automates the desk.
        if (g.day === 12 && S.f.dereg && !S.f.regulation && !S.f.reported && !S.f.algoDesk) {
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
        if (r.quota > 0) {
          if (r.quotaMet) {
            S.missStreak = 0;
            if (!S.f.defected) D.adj(S, {}, { kroll: 3 });
            notes.push(`${D.boss(S)}: "Quota met. Again tomorrow."`);
          } else {
            S.missStreak++;
            if (!S.f.defected) D.adj(S, {}, { kroll: -8 });
            notes.push(`<b>Missed quota. Strike ${S.missStreak} of 3.</b> ${D.boss(S)} is not happy.`);
          }
        }
        if (r.earlyEnd === 'wiped' || r.equity < capital * 0.1) return { notes, ending: this.buildEnding(g, 'wiped') };
        if (S.missStreak >= 3 || (!S.f.defected && S.rel.kroll <= 0)) return { notes, ending: this.buildEnding(g, 'fired') };
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
        const view = Object.assign({}, c, {
          options: c.options.filter((o) => !o.req || o.req(S, wealth)).map((o) => Object.assign({}, o, { req: null }))
        });
        B.Screens.choice(view, S, (optId) => {
          const opt = c.options.find((o) => o.id === optId);
          opt.apply(S);
          S.choices[id] = optId;
          if (opt.headline) S.log.push({ day: d, text: opt.headline });
          if (id === 'c7') S.f.billPassed = votePasses(S);
          B.Screens.aftermath(c.title, opt.after || [], () => {
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

      buildEnding(g, reason) {
        const ctx = { S, wealth: g.broker.equity(), start: capital, reason };
        const e = B.StoryEndings.resolve(ctx);
        return {
          id: e.id, title: e.title, headline: e.headline, deck: e.deck,
          story: e.story(ctx), wealth: e.wealth(ctx),
          dark: ['wiped', 'fired', 'perp', 'depression', 'replaced'].indexOf(e.id) >= 0,
          timeline: S.log.map((l) => `<b>Day ${l.day + 1}:</b> ${l.text}`),
          indexMonth: g.market.bySym.INDX.last / (g.indexStart || 512.4) - 1
        };
      },

      serialize() { return { S }; }
    };
    return mode;
  };

  B.StoryMode.votePasses = votePasses;
  B.StoryMode.freshState = freshState;
})(window.BTB);
