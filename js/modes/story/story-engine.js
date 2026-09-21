// Story Mode controller: turns story state into scenarios, rules, quotas, consequences and endings.
(function (B) {
  'use strict';
  const D = B.StoryData;
  const SAFE_SECTORS = ['tech', 'retail', 'energy', 'haven'];

  function freshState(capital) {
    return {
      m: { integrity: 50, heat: 10, influence: 20, firm: 60, stability: 60, anger: 20 },
      rel: { dana: 60, rae: 20, whitfield: 30, vance: 50 },
      f: {}, choices: {}, log: [], pending: [], missStreak: 0, startCapital: capital, complianceWarned: false
    };
  }

  // Deterministic vote outcome from the political state (see plan: stability, anger, lobbying).
  function votePasses(S) {
    let score = 50 + (S.m.stability - 50) * 0.5 - (S.m.anger - 30) * 0.5;
    if (S.f.lobbyYes) score += 18 + (S.rel.whitfield >= 50 ? 8 : 0);
    if (S.f.lobbyNo) score -= 22;
    if (S.f.testified) score += 10;
    return score >= 50;
  }

  B.StoryMode = function (save) {
    const capital = 250000;
    const S = save ? save.S : freshState(capital);

    const mode = {
      kind: 'story',
      saveKey: 'save:story',
      seed: 'hydra-20XX',
      capital,
      dayLength: B.Settings.get().storyDayLength || 240,
      lastDay: 20,
      volMult: 1, feeMult: 1, maintStrict: 1, stressRate: 1, callFreq: 1, fakeShare: 0.35,
      S,

      briefing(d, g) {
        const day = D.DAYS[d];
        const r = this.rules(d);
        const rules = [];
        if (r.maxLev !== 4) rules.push(`Leverage limit: ${r.maxLev}x intraday / ${r.maxLev / 2}x overnight`);
        if (r.shortBan.length) rules.push('SEC EMERGENCY ORDER: short selling of financial stocks is banned');
        if (S.m.heat >= 50) rules.push('Compliance is watching you. SEC examiners may visit.');
        if (S.missStreak > 0) rules.push(`Missed-quota strikes: ${S.missStreak}/3`);
        if (d === 0) rules.push('Tip: open How to Play from the pause menu (Esc) any time.');
        return {
          kicker: D.actOf(d) + ' ·',
          title: `Day ${d + 1}: ${day.title}`,
          html: day.brief(S).filter(Boolean).map((p) => `<p>${p}</p>`).join(''),
          quota: this.quota(d, g),
          rules
        };
      },

      rules(d) {
        let lev = 4;
        if (S.f.refusedDump && d >= 3 && d <= 4) lev = 3;
        if (S.f.dereg && d >= 7) lev += 2;
        if (S.f.regulation && d >= 7) lev = Math.min(lev, 3);
        if (S.f.lorimerFailed && d >= 10) lev = Math.max(2, lev - 1);
        const shortBan = S.f.tipShortBan && d >= 9 && d <= 11 ? D.FIN : [];
        return { maxLev: lev, overnightLev: lev / 2, shortBan };
      },

      scenario(d) {
        const scen = D.DAYS[d].scen(S);
        // Background noise on sectors outside the housing story keeps every day tradable.
        const rng = B.RNG(B.hashSeed('story-noise|' + d));
        const extra = B.News.randomEvents(rng, { newsFreq: 0.6, fakeShare: 0.3, volMult: 1 }).filter((e) => {
          if (e.kind === 'chirp') return true;
          const im = e.impacts[0];
          if (im.scope === 'market') return false;
          if (im.scope === 'sector') return SAFE_SECTORS.includes(im.id);
          const tk = B.TICKERS.find((t) => t.sym === im.id);
          return tk && SAFE_SECTORS.includes(tk.sector);
        });
        scen.events = (scen.events || []).concat(extra);
        return scen;
      },

      quota(d, g) {
        const eq = g ? g.broker.equity() : capital;
        return Math.round(Math.max(500, eq * D.QUOTAS[d]) / 50) * 50;
      },

      calls(d) { return D.DAYS[d].calls ? D.DAYS[d].calls(S) : []; },
      inbox(d) { return D.DAYS[d].inbox ? D.DAYS[d].inbox(S) : []; },
      bossName() { return D.boss(S); },
      wipeLevel() { return capital * 0.1; },

      onDayStart(g) {
        const b = g.broker;
        this.applyPending(g);
        if (g.day === 5 && S.f.insider) {
          // Did you actually profit from Theo's tip? Short lenders or lender puts held over the weekend.
          const shorted = ['NSTG', 'FLXR'].some((s) => b.posQty(s) < 0) || b.opts.some((o) => ['NSTG', 'FLXR'].includes(o.sym) && o.type === 'P');
          if (shorted) {
            S.f.insiderTraded = true;
            D.adj(S, { heat: 20 });
            g.inboxQueue.push({ t: 20, from: 'Compliance', text: 'Your lender shorts were opened hours before the Monarch downgrade. Explain yourself. In writing. Today.' });
          }
        }
        if (g.day === 15 && S.f.dumped) {
          b.cash -= 40000;
          D.adj(S, { heat: 15 });
          B.UI.toast('Legal: $40,000 deducted for your share of the Ohio Teachers settlement.', 'bad');
        }
        this.auditAt = null;
        if (S.m.heat >= 50) {
          const rng = B.RNG(B.hashSeed('audit|' + g.day));
          if (rng.next() < (S.m.heat - 40) / 120) this.auditAt = Math.round(rng.range(60, 300));
        }
        g.inboxQueue.sort((a, c) => a.t - c.t);
      },

      applyPending(g) {
        const b = g.broker, m = g.market;
        while (S.pending.length) {
          const p = S.pending.shift();
          if (p.type === 'cash') {
            b.cash += p.amount;
            B.UI.toast(`${p.reason}: ${B.fmt.money(p.amount, true)}`, p.amount >= 0 ? 'good' : 'bad');
          } else if (p.type === 'fineFrac') {
            const amt = Math.max(0, b.equity() * p.frac);
            b.cash -= amt;
            B.UI.toast(`${p.reason}: -${B.fmt.money(amt)}`, 'bad');
          } else if (p.type === 'short') {
            const px = m.bySym[p.sym].last;
            const qty = Math.floor(b.equity() * p.mult / px);
            if (qty > 0 && m.status === 'open') b.marketOrder(p.sym, -qty, { forced: true, tag: 'FIRM SHORT' });
            B.UI.toast(`Firm short added: ${B.fmt.qty(qty)} ${p.sym}`, 'warn');
          } else if (p.type === 'grant') {
            const px = m.bySym[p.sym].last;
            const qty = Math.floor(p.value / px);
            const cur = b.pos[p.sym];
            if (cur && cur.qty > 0) { cur.avg = (cur.avg * cur.qty + px * qty) / (cur.qty + qty); cur.qty += qty; }
            else if (!cur) b.pos[p.sym] = { qty, avg: px, realized: 0 };
            else b.cash += p.value; // short in the name: take it as cash instead
            B.UI.toast(`Stake granted: ${B.fmt.qty(qty)} ${p.sym}`, 'good');
          }
        }
      },

      onTick(g, t) {
        if (this.auditAt != null && t >= this.auditAt && !g.lock) {
          this.auditAt = null;
          g.setLock(30, 'SEC examiners at your desk. Account frozen.', 'audit');
          B.UI.addNews({ kind: 'chirp', text: 'SEC people on the 41st floor at H&V right now. someone is in trouble', src: '@TheTapeReader', t });
          g.stress.spike(10);
        }
      },

      onTrade(g, sym) {
        if (sym === 'HVNB' && !S.f.defected) {
          D.adj(S, { heat: 1 });
          if (!S.complianceWarned) {
            S.complianceWarned = true;
            B.UI.inbox({ from: 'Compliance', text: 'Reminder: trading your own firm\'s stock is logged and reviewed. Every single trade.' });
          }
        }
      },

      onScript(g, id) {
        if (id === 'voteFail') { g.stress.spike(20); B.UI.shake(22); B.SFX.crash(); }
      },

      onMissedCall(g, call) {
        if (call.kind === 'boss' && !S.f.defected) D.adj(S, {}, { vance: -2 });
      },
      onTaskFailed() { if (!S.f.defected) D.adj(S, {}, { vance: -3 }); },
      onTaskDone() { if (!S.f.defected) D.adj(S, {}, { vance: 2 }); },

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
            if (!S.f.defected) D.adj(S, {}, { vance: 3 });
            notes.push(`${D.boss(S)}: "Quota met. Again tomorrow."`);
          } else {
            S.missStreak++;
            if (!S.f.defected) D.adj(S, {}, { vance: -8 });
            notes.push(`<b>Missed quota. Strike ${S.missStreak} of 3.</b> ${D.boss(S)} is not happy.`);
          }
        }
        if (r.earlyEnd === 'wiped' || r.equity < capital * 0.1) return { notes, ending: this.buildEnding(g, 'wiped') };
        if (S.missStreak >= 3 || (!S.f.defected && S.rel.vance <= 0)) return { notes, ending: this.buildEnding(g, 'fired') };
        if (S.m.heat >= 50) notes.push('Your heat with regulators is <b>high</b>.');
        if (g.day === D.DAYS.length - 1) return { notes, ending: this.buildEnding(g, 'final') };
        return { notes };
      },

      afterDay(g, cb) {
        const d = g.day;
        const c = Object.values(D.CHOICES).find((x) => x.day === d && !x.mid);
        if (!c) return cb();
        const wealth = g.broker.equity();
        const view = Object.assign({}, c, { options: c.options.filter((o) => !o.req || o.req(S, wealth)).map((o) => Object.assign({}, o, { req: null })) });
        const id = Object.keys(D.CHOICES).find((k) => D.CHOICES[k] === c);
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
        B.StoryEndings.record(e.id);
        return {
          id: e.id, title: e.title, headline: e.headline, deck: e.deck,
          story: e.story(ctx), wealth: e.wealth(ctx),
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
