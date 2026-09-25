// STORY MODE CONTENT: 15 trading days, 8 decisions, 4 acts.
// Each day's scenario is a function of story state S, so choices reshape the market itself.
//
// Everything here is invented. The firms, the people, the instruments, the bills,
// the countries and the conflicts are fiction. Any resemblance to a real company,
// person or event is coincidence, not intention.
(function (B) {
  'use strict';

  // ---- helpers ----
  const imp = (list) => (list || []).map((a) => ({ scope: a[0], id: a[1], pct: a[2], over: a[3] || 0 }));
  const ev = (t, text, impacts, x) => Object.assign({ t, text, src: 'NEWSWIRE', impacts: imp(impacts) }, x || {});
  const chirp = (t, text, src) => ({ t, kind: 'chirp', text, src });
  const R = (lead, text, src) => ({ lead, text, src });
  const adj = (S, m, r) => {
    for (const k in m || {}) S.m[k] = B.clamp(S.m[k] + m[k], 0, 100);
    for (const k in r || {}) S.rel[k] = B.clamp(S.rel[k] + r[k], 0, 100);
  };
  // Crash severity: low systemic stability and deregulation make every drop deeper.
  const cm = (S) => B.clamp(1 + (60 - S.m.stability) / 60 * 0.8 + (S.f.dereg ? 0.25 : 0), 0.85, 2.2);
  const FIN = ['bank', 'lender', 'insurer'];
  const STACK = ['ai', 'chip', 'dc'];
  const boss = (S) => (S.f.defected ? 'Imani Rhodes' : 'Desmond Kroll');

  // The desk raises the floor every day. It scales with the book, so getting
  // rich increases the demand instead of buying safety from it.
  const QUOTAS = [0.008, 0.009, 0.010, 0.0115, 0.013, 0.0145, 0.016, 0.0175,
    0.020, 0.0215, 0.0235, 0.025, 0.027, 0.029, 0.032];

  const ACTS = ['I · MELT-UP', 'II · TREMORS', 'III · CONTAGION', 'IV · RECKONING'];
  const actIndex = (d) => (d < 4 ? 0 : d < 8 ? 1 : d < 12 ? 2 : 3);
  const actOf = (d) => ACTS[actIndex(d)];

  // =====================================================================
  // DAYS
  // =====================================================================
  const DAYS = [
    // ---- Day 1 ----
    {
      title: 'First Day on the Desk',
      brief: () => [
        'Holloway Stern, 41st floor. Your badge photo is still warm. <b>Desmond Kroll</b>, Head of Trading, has given you a <b>$250,000</b> book and one rule: <i>make money every single day.</i>',
        'The market is at a record. Corvus Intelligence ships a new model tonight and every company that owns a datacenter has tripled. The firm sells <b>CASCADE notes</b> by the billion: datacenter lease payments and consumer loans, bundled together and stamped AAA by <b>Meridian Ratings</b>.',
        '<b>Imani Rhodes</b>, the desk\'s senior trader, slides a coffee across. "Watch the Wire. Sqwak is mostly idiots, but idiots move prices. And never, ever hold more than you can stomach overnight."'
      ],
      scen: () => ({
        regime: 'melt', market: { gap: 0.002, target: 0.006 }, sectors: { ai: { target: 0.012 }, chip: { target: 0.009 } },
        events: [
          ev(40, 'Corvus Intelligence unveils LATTICE-9; analysts call it "a new industrial revolution"', [['ticker', 'CRVS', 0.055, 0.4], ['sector', 'chip', 0.02]], { rumor: R(9, 'hearing $CRVS drops something HUGE this morning. loading up', '@ScalingLawSteve') }),
          ev(205, 'Compute capex forecasts raised again; datacenter leasing at record', [['sector', 'dc', 0.025], ['market', '', 0.003]]),
          chirp(240, 'compute demand literally cannot go down. it is physically impossible. do the math', '@GPUgoblin'),
          ev(330, 'Fairline Credit delays quarterly filing, cites "accounting review"', [['ticker', 'FRLN', -0.05, 0.3]], { rumor: R(12, '$FRLN filing late?? something smells in there', '@BearCaveBets') })
        ]
      }),
      inbox: () => [
        { t: 2, from: 'Imani Rhodes', text: 'Welcome. Click a ticker on the left, set a size, hit BUY (B) or SELL (S). SELL when you\'re flat means you\'re short.' },
        { t: 22, from: 'Imani Rhodes', text: 'Your quota is on the left screen. Hit it every day. Kroll counts.' },
        { t: 65, from: 'Imani Rhodes', text: 'Stress gauge is on the desk. If it maxes out you lock up. Going flat or grabbing a coffee brings it down.' },
        { t: 320, from: 'Imani Rhodes', text: 'Watch Fairline. Late filings are never good news. Consumer credit is the quiet half of CASCADE.' }
      ]
    },

    // ---- Day 2 ----
    {
      title: 'Up Only',
      brief: () => [
        'Thorncrest Silicon crushed earnings before the open. Every talking head says the same sentence: <i>this time the demand is real.</i>',
        'Kroll walks past your desk without looking at you. "Rookies usually blow up by Thursday. Prove me wrong."'
      ],
      scen: () => ({
        regime: 'melt', market: { gap: 0.001, target: 0.005 }, tickers: { THSI: { gap: 0.038, target: 0.048 } },
        events: [
          ev(0, 'PRE-MARKET: Thorncrest Silicon beats on revenue, raises full-year outlook', []),
          chirp(115, 'BREAKING?? $RDGW getting bought by a sovereign fund at 40% premium. source: my uncle', '@CallsOnlyCarl'),
          ev(150, 'Ridgeway Trust: "We are not in talks with anyone"', [['ticker', 'RDGW', -0.012]]),
          ev(230, 'Halcyon Mind Labs raises at a $90B valuation with no product revenue', [['ticker', 'HALO', 0.09, 0.5], ['sector', 'ai', 0.02]]),
          ev(300, 'Central bank minutes: officials see "no urgency" to raise rates', [['market', '', 0.005, 0.5]], { rumor: R(10, 'minutes leaking dovish. risk ON', '@MacroMaven') })
        ]
      }),
      inbox: () => [{ t: 122, from: 'Imani Rhodes', text: 'That Ridgeway buyout "rumor" on Sqwak? Classic bait. Wait for the Wire.' }]
    },

    // ---- Day 3 ----
    {
      title: 'The CASCADE Machine',
      brief: (S) => {
        const p = [
          'Holloway Stern just priced its biggest CASCADE deal ever: <b>$14 billion</b> of datacenter leases stapled to consumer loans, stamped AAA by Meridian. The sales floor rings a ship\'s bell for every billion sold.',
          'Imani is quiet this morning. She keeps pulling up a chart of consumer delinquencies that nobody else is looking at.'
        ];
        if (S.f.dumped) p.push('Kroll clapped you on the shoulder. "Riverbend took all forty million. You\'ll go far." Your bonus hit overnight.');
        if (S.f.refusedDump) p.push('Kroll cut your limits after you refused the pension trade. Max leverage is <b>3x</b> this week.');
        if (S.f.leaked) p.push('Sana Ferreira texted at 2 AM: "Got the documents. Running it next week. Thank you."');
        return p;
      },
      scen: () => ({
        regime: 'bubble', market: { gap: 0.001, target: 0.002 },
        events: [
          ev(55, 'Holloway Stern prices record $14B CASCADE offering; demand "off the charts"', [['ticker', 'HLST', 0.028, 0.3], ['sector', 'bank', 0.01]]),
          ev(235, 'Consumer loan delinquencies climb to 6.4%, highest in a decade', [['sector', 'lender', -0.035, 0.3], ['sector', 'bank', -0.012]], { rumor: R(12, 'delinquency print is going to be ugly. just saying', '@BondVigilante') }),
          chirp(255, '6.4% delinquencies is fine. FINE. the datacenters pay the coupon anyway', '@TendiesTomorrow'),
          ev(345, 'Bastion Compute signs 12-year lease with an unnamed model lab', [['ticker', 'BSTN', 0.03, 0.3]])
        ]
      }),
      inbox: () => [{ t: 246, from: 'Imani Rhodes', text: 'Delinquencies up two points in a year, and CASCADE is still AAA. Think about what that means.' }]
    },

    // ---- Day 4 ----
    {
      title: 'Insiders',
      brief: () => [
        'Something went wrong overnight in the Kavro Strait. Two tankers and a cable-laying ship. Energy is spiking, defense is spiking, and everyone on the floor suddenly has a geopolitical opinion.',
        'Your phone has three missed calls from <b>Perry Nakash</b>, your college friend who works at Meridian Ratings.'
      ],
      scen: () => ({
        regime: 'chop', market: { gap: -0.001, target: 0.0 },
        sectors: { defense: { gap: 0.02, target: 0.035 }, power: { gap: 0.015, target: 0.03 } },
        events: [
          ev(35, 'Shipping halted through the Kavro Strait after overnight incident', [['sector', 'power', 0.04, 0.3], ['sector', 'defense', 0.03, 0.2], ['market', '', -0.006]]),
          ev(120, 'Rare-earth export licenses suspended pending "security review"', [['sector', 'chip', -0.035, 0.3]], { rumor: R(11, 'export licences getting pulled. chips are cooked', '@FlopsPerDollar') }),
          ev(310, 'Filings show Fairline Credit CEO sold 40% of his personal stake last month', [['ticker', 'FRLN', -0.07, 0.3]], { rumor: R(12, 'Fairline CEO dumping shares?? the form 4s are wild rn', '@TheTapeReader') })
        ]
      }),
      calls: (S) => (S.choices.c2 ? [] : [{
        t: 150, scripted: true, kind: 'choice', choiceId: 'c2', timer: 22,
        from: 'Perry Nakash', role: 'Senior Analyst, Meridian Ratings',
        text: 'I shouldn\'t be calling you. The CASCADE committee met this morning. We are putting the current vintage on downgrade watch. It goes public Monday. I just... someone should know.',
        options: [
          { id: 'trade', label: 'Thank him. Then go short the stack.' },
          { id: 'ignore', label: '"Perry, hang up. I never took this call."' },
          { id: 'warn', label: 'Tell him to put it in writing and go to his compliance desk.' }
        ],
        defaultOpt: 'ignore'
      }]),
      inbox: () => [{ t: 20, from: 'Desmond Kroll', text: 'War tape. Wide spreads, fast fills, real money. Don\'t be a tourist in it.' }]
    },

    // ---- Day 5 ----
    {
      title: 'Circular',
      brief: (S) => {
        const p = [
          'A research note went out at 4 AM from a small shop nobody had heard of. It lays out, with citations, that Thorncrest Silicon invested $6 billion into Halcyon Mind Labs, and that Halcyon spent $5.4 billion of it buying Thorncrest chips.',
          'Both companies booked it as revenue. The note calls it "a circle with an income statement wrapped around it."'
        ];
        if (S.f.insiderTraded) p.push('Compliance has asked you, in writing, to explain the timing of your positions. You have not replied.');
        return p;
      },
      scen: (S) => ({
        regime: 'chop', market: { gap: -0.004, target: -0.008 },
        sectors: { ai: { gap: -0.02, target: -0.035 }, chip: { gap: -0.015, target: -0.025 } },
        events: [
          ev(15, 'Research note alleges circular vendor financing between Thorncrest and Halcyon', [['ticker', 'THSI', -0.05, 0.3], ['ticker', 'HALO', -0.09, 0.4]], { big: true, rumor: R(8, 'someone is about to blow the lid off the chip revenue circle', '@Quant_Kween') }),
          ev(95, 'Thorncrest Silicon calls the report "a deliberate misreading of standard partnerships"', [['ticker', 'THSI', 0.025, 0.4]]),
          chirp(140, 'they sold chips to themselves and called it demand. we are all going to be fine though', '@PromptAndPray'),
          ev(240, 'Meridian Ratings declines to comment on reports of a CASCADE review', [['sector', 'dc', -0.025 * cm(S)]]),
          ev(355, 'Halcyon Mind Labs cancels three datacenter commitments', [['ticker', 'HALO', -0.06, 0.3], ['sector', 'dc', -0.03, 0.3]])
        ]
      }),
      inbox: () => [{ t: 30, from: 'Imani Rhodes', text: 'Read that note. Not the headline, the footnotes. Whoever wrote it is going to be famous or unemployed.' }]
    },

    // ---- Day 6 ----
    {
      title: 'The Grid',
      brief: () => [
        'Three regional grid operators rejected gigawatt-scale interconnect requests overnight. Datacenters promised power this decade are now being told to wait another four years.',
        '<b>Sen. Marcus Thorne</b>, who chairs the Senate Markets Committee, wants fifteen minutes with you after the close. His staff called twice. Nobody on the floor knows why he asked for you specifically.'
      ],
      scen: (S) => ({
        regime: 'bear', market: { gap: -0.003, target: -0.01 },
        sectors: { dc: { gap: -0.02, target: -0.045 * cm(S) }, power: { target: 0.02 } },
        events: [
          ev(25, 'Grid operators reject three gigawatt-scale interconnect requests', [['sector', 'dc', -0.04, 0.3], ['sector', 'power', 0.02]], { big: true }),
          ev(150, 'Power prices in the northern corridor up 38% year on year', [['sector', 'power', 0.03], ['sector', 'dc', -0.02]]),
          ev(285, 'Bastion Compute says 19% of contracted capacity "may not energize on schedule"', [['ticker', 'BSTN', -0.08, 0.35], ['sector', 'dc', -0.02]], { rumor: R(14, 'BSTN capacity guidance is about to get slashed', '@DeepValueDane') }),
          chirp(300, 'turns out you need electricity. nobody modelled electricity', '@FlopsPerDollar')
        ]
      }),
      inbox: () => [{ t: 12, from: 'Desmond Kroll', text: 'Thorne asked for you by name. Whatever he wants, remember who signs your bonus.' }]
    },

    // ---- Day 7 ----
    {
      title: 'Hairline Cracks',
      brief: (S) => {
        const p = ['Ambervale Re, the insurer standing behind half the CASCADE market, is quietly raising reserves on its compute-lease guarantees. It is on page 14 of a filing nobody read.'];
        if (S.f.dereg) p.push('The Compute Freedom Act cleared committee. Leverage limits across the street went <b>up</b>. Your desk cheered. Imani did not.');
        if (S.f.regulation) p.push('Your amendment survived. Position limits are tighter everywhere, your own book included. The desk has not forgiven you.');
        return p;
      },
      scen: (S) => ({
        regime: 'bear', market: { gap: -0.002, target: -0.012 * cm(S) },
        events: [
          ev(30, 'Ambervale Re raises loss reserves on compute-lease guarantee book', [['ticker', 'AMVL', -0.045, 0.3], ['sector', 'insurer', -0.02]]),
          ev(140, 'Two CASCADE tranches fail to find buyers at any price', [['sector', 'bank', -0.03, 0.3], ['sector', 'dc', -0.03]], { big: true, rumor: R(13, 'a CASCADE deal just failed to clear. FAILED TO CLEAR', '@BondVigilante') }),
          ev(265, 'Ridgeway Trust denies "unfounded speculation" about its funding position', [['ticker', 'RDGW', -0.06, 0.4]]),
          ev(350, 'Bullion hits a record as funds rotate out of the compute trade', [['sector', 'haven', 0.025]])
        ]
      }),
      inbox: () => [{ t: 145, from: 'Imani Rhodes', text: 'A deal that cannot be priced is a deal that is worthless. Everyone on this floor knows that and nobody will say it out loud.' }]
    },

    // ---- Day 8 ----
    {
      title: 'The Pack',
      brief: () => [
        'Ridgeway Trust has the weakest funding profile on the street and everyone knows it. Four desks are circling. Somebody is going to push it over, and the only question is whether you are standing on it when it goes.',
        '<b>Greta Vail</b> runs the biggest of those desks. She has never once spoken to you.'
      ],
      scen: (S) => ({
        regime: 'bear', market: { gap: -0.004, target: -0.016 * cm(S) },
        sectors: { bank: { target: -0.03 * cm(S) } },
        events: [
          ev(60, 'Ridgeway Trust shares slide as credit default costs spike', [['ticker', 'RDGW', -0.07, 0.35], ['sector', 'bank', -0.02]]),
          chirp(70, 'someone is absolutely hammering $RDGW. this is coordinated, screenshot this post', '@TheTapeReader'),
          ev(200, 'Ridgeway CEO: "We have ample liquidity and no need to raise capital"', [['ticker', 'RDGW', 0.04, 0.5]]),
          ev(320, 'Two counterparties reportedly pull credit lines from Ridgeway Trust', [['ticker', 'RDGW', -0.11, 0.3], ['sector', 'bank', -0.025], ['market', '', -0.008]], { big: true })
        ]
      }),
      calls: (S) => (S.choices.c4 ? [] : [{
        t: 130, scripted: true, kind: 'choice', choiceId: 'c4', timer: 20,
        from: 'Greta Vail', role: 'Head of Trading, Calloway Partners',
        text: 'Four of us are going to size into Ridgeway shorts at the same time and put the rumor into the right ears. It falls, the funding goes, and we all get paid. You have a seat if you want it. Thirty seconds.',
        options: [
          { id: 'join', label: 'Take the seat. Size in with them.' },
          { id: 'refuse', label: '"I\'ll trade my own book, thanks."' },
          { id: 'tell', label: 'Refuse, then tell Ridgeway\'s desk what\'s coming.' }
        ],
        defaultOpt: 'refuse'
      }])
    },

    // ---- Day 9 ----
    {
      title: 'The Loop',
      brief: () => [
        'At 6:40 this morning, an autonomous execution system at a large fund began selling to hedge a position. The selling moved the price. The move triggered the same model at four other funds, which had been trained on the same data. Which moved the price.',
        'Nobody has turned it off. Nobody is completely sure who could.'
      ],
      scen: (S) => {
        const sev = cm(S);
        const t1 = 105;
        return {
          regime: 'panic', market: { gap: -0.012 * sev, target: -0.05 * sev },
          sectors: { ai: { target: -0.07 * sev }, chip: { target: -0.06 * sev }, dc: { target: -0.07 * sev }, haven: { target: 0.03 } },
          events: [
            ev(20, 'Unusual selling pressure across model-lab and compute names', [['sector', 'ai', -0.03 * sev, 0.2]]),
            ev(t1, 'FLASH CRASH: correlated model selling cascades across the tape', [['market', '', -0.055 * sev, 0.25], ['sector', 'chip', -0.04 * sev]], { big: true, rumor: R(6, 'every fund runs the same model and they are all selling at once', '@Quant_Kween') }),
            ev(t1 + 22, 'Exchanges say systems are functioning normally; no plans to halt', [['market', '', -0.012 * sev]]),
            ev(t1 + 70, 'Buyers step in at the lows; violent reversal off the bottom', [['market', '', 0.035 * sev, 0.4]]),
            ev(300, 'Regulator opens review into automated execution behavior', [['sector', 'ai', -0.02]]),
            chirp(320, 'the machines are front-running the machines and we all agreed this was fine', '@PromptAndPray')
          ]
        };
      },
      inbox: () => [{ t: 8, from: 'Desmond Kroll', text: 'Nobody is getting a normal fill today. Use limits. If you market-order into this I will personally take your keyboard.' }]
    },

    // ---- Day 10 ----
    {
      title: 'Run on Ridgeway',
      brief: (S) => {
        const p = ['Ridgeway Trust could not fund itself this morning. Its counterparties want collateral it does not have. There is a camera crew outside a branch on Third filming a queue that does not need to exist.'];
        if (S.f.raid) p.push('Your name is on a chat log with four other desks. So far nobody has asked about it.');
        if (S.f.toldRidgeway) p.push('Ridgeway\'s desk head left you a voicemail at 5 AM. He just says "thank you," twice, and hangs up.');
        return p;
      },
      scen: (S) => {
        const sev = cm(S);
        return {
          regime: 'panic', market: { gap: -0.01 * sev, target: -0.035 * sev },
          sectors: { bank: { gap: -0.05 * sev, target: -0.09 * sev }, haven: { target: 0.03 } },
          tickers: { RDGW: { gap: -0.22 * sev, target: -0.42 * sev }, HLST: { target: -0.06 * sev } },
          halts: [{ sym: 'RDGW', t: 90, dur: 20 }],
          events: [
            ev(0, 'PRE-MARKET: Ridgeway Trust fails to meet intraday funding call', [], { big: true }),
            ev(75, 'Ridgeway Trust halted, limit down', [['sector', 'bank', -0.04 * sev]], { big: true }),
            ev(175, 'Treasury Secretary Adele Venn: "All options remain on the table"', [['market', '', 0.02, 0.5], ['sector', 'bank', 0.03, 0.5]]),
            ev(280, 'Money market funds report heavy redemptions', [['market', '', -0.025 * sev, 0.3], ['sector', 'bank', -0.03 * sev]]),
            ev(360, 'Emergency weekend talks confirmed at Treasury', [['market', '', 0.012, 0.6]], { script: 'rescueWeekend' })
          ]
        };
      },
      inbox: () => [{ t: 185, from: 'Imani Rhodes', text: '"All options on the table" means they have not decided. Which means the weekend decides it. Which means someone is going to ask you what you think.' }]
    },

    // ---- Day 11 ----
    {
      title: 'Monday',
      brief: (S) => {
        const p = [];
        if (S.f.bailout) p.push('They did it. Ridgeway\'s book was taken onto the public balance sheet over the weekend at a price nobody wants explained. Futures gapped up 3% and then started sliding at 4 AM.');
        else if (S.f.letFail) p.push('They let it go. Ridgeway Trust filed at 11:40 PM Sunday, the largest failure in the country\'s history. Futures are limit down.');
        else p.push('The weekend produced a press conference and no decision. The market has decided to interpret that badly.');
        if (S.f.shortBanOn) p.push('An emergency order bans short selling in financials. Your shorts in those names are frozen where they are.');
        return p;
      },
      scen: (S) => {
        const sev = cm(S);
        const rescued = !!S.f.bailout;
        return {
          regime: rescued ? 'recovery' : 'panic',
          market: { gap: rescued ? 0.025 : -0.045 * sev, target: rescued ? -0.01 : -0.06 * sev },
          sectors: {
            bank: { gap: rescued ? 0.06 : -0.10 * sev, target: rescued ? 0.02 : -0.12 * sev },
            insurer: { target: rescued ? 0.01 : -0.07 * sev },
            haven: { target: rescued ? -0.01 : 0.04 }
          },
          events: [
            ev(10, rescued ? 'Treasury takes Ridgeway book onto public balance sheet' : 'Ridgeway Trust files; largest failure on record',
              rescued ? [['sector', 'bank', 0.04, 0.4]] : [['market', '', -0.03 * sev, 0.3], ['sector', 'bank', -0.05 * sev]], { big: true }),
            ev(110, rescued ? 'Public anger builds over terms of the Ridgeway rescue' : 'Three regional lenders halt withdrawals',
              rescued ? [['market', '', -0.015]] : [['sector', 'lender', -0.08 * sev, 0.3], ['market', '', -0.02 * sev]]),
            ev(230, 'Ambervale Re downgraded three notches; guarantee book in doubt', [['ticker', 'AMVL', -0.14 * sev, 0.3], ['sector', 'insurer', -0.05 * sev]]),
            ev(330, 'Holloway Stern says its CASCADE marks are "appropriate and independently reviewed"', [['ticker', 'HLST', -0.04 * sev, 0.4]], { rumor: R(15, 'nobody at HLST believes their own marks. nobody', '@BearCaveBets') })
          ]
        };
      }
    },

    // ---- Day 12 ----
    {
      title: 'The Auditors',
      brief: (S) => {
        const p = ['There are people in the building who do not work here. They have laptops and lanyards and they are going desk by desk asking for trade blotters.'];
        if (S.f.fraud) p.push('You signed the marks. Your initials are on a page that is now in a banker\'s box on the 38th floor.');
        if (S.m.heat >= 50) p.push('Two of them have already asked for you by name.');
        return p;
      },
      scen: (S) => ({
        regime: 'bear', market: { gap: -0.004, target: -0.018 * cm(S) },
        events: [
          ev(45, 'Regulators open formal inquiry into CASCADE valuation practices', [['sector', 'bank', -0.04, 0.3]], { big: true }),
          ev(140, 'Unemployment claims jump; economists cut growth forecasts', [['market', '', -0.02 * cm(S), 0.3], ['sector', 'retail', -0.03]]),
          ev(250, 'Corvus Intelligence cuts capex plan by 40%', [['ticker', 'CRVS', -0.09, 0.3], ['sector', 'chip', -0.05], ['sector', 'dc', -0.05]], { big: true }),
          ev(340, 'Senate hearing on the compute crisis set for this week', [['market', '', -0.008]])
        ]
      }),
      inbox: () => [{ t: 55, from: 'Compliance', text: 'Preserve everything. Messages, notes, voicemails. Deleting anything today is a much worse crime than whatever you think you did.' }]
    },

    // ---- Day 13 ----
    {
      title: 'The Hearing',
      brief: (S) => {
        const p = ['The hearing runs on every screen on the floor. Kroll is in the second row behind counsel, and he has not blinked in four minutes.'];
        if (S.f.testified) p.push('You testified this morning. You are told you did well. Nobody on the desk will look at you.');
        if (S.f.leaked) p.push('Sana Ferreira\'s piece ran on the front page. Every question the senators ask comes straight out of it.');
        return p;
      },
      scen: (S) => ({
        regime: 'chop', market: { gap: 0.002, target: -0.004 },
        events: [
          ev(40, 'Executives tell lawmakers the CASCADE ratings were "obtained in good faith"', [['sector', 'bank', -0.02]]),
          ev(120, 'Sen. Thorne: "You sold a circle and called it a AAA bond"', [['sector', 'bank', -0.03, 0.3]], { big: true }),
          ev(215, 'Stabilization Act draft released; vote expected tomorrow', [['market', '', 0.02, 0.5]], { rumor: R(12, 'whip count on the stabilization bill is closer than anyone admits', '@MacroMaven') }),
          ev(330, 'Meridian Ratings withdraws ratings on the entire current CASCADE vintage', [['sector', 'dc', -0.05 * cm(S), 0.3], ['sector', 'bank', -0.03 * cm(S)]], { big: true })
        ]
      })
    },

    // ---- Day 14 ----
    {
      title: 'The Vote',
      brief: (S) => [
        'The Stabilization Act goes to the floor at 2 PM. If it passes, the guarantee stops the bleeding. If it fails, there is nothing underneath any of this.',
        S.f.lobbyYes ? 'You spent the week making calls for it. Thorne\'s office says it is "very close."'
          : S.f.lobbyNo ? 'You spent the week arguing against it. Several people who used to take your calls no longer do.'
            : 'You stayed out of it. Both sides noticed.'
      ],
      scen: (S) => {
        const pass = S.f.billPassed;
        const sev = cm(S);
        return {
          regime: pass ? 'recovery' : 'panic',
          market: { gap: 0.004, target: pass ? 0.05 : -0.09 * sev },
          sectors: pass ? { bank: { target: 0.08 }, haven: { target: -0.02 } } : { bank: { target: -0.14 * sev }, haven: { target: 0.05 } },
          events: [
            ev(60, 'Floor debate opens on the Stabilization Act; whip count called "razor thin"', [['market', '', -0.01, 0.4]]),
            ev(270, pass ? 'STABILIZATION ACT PASSES' : 'STABILIZATION ACT FAILS ON THE FLOOR',
              pass ? [['market', '', 0.05, 0.4], ['sector', 'bank', 0.09, 0.4]] : [['market', '', -0.10 * sev, 0.2], ['sector', 'bank', -0.15 * sev, 0.2]],
              { big: true, script: pass ? 'votePass' : 'voteFail' }),
            ev(310, pass ? 'Credit markets reopen; first new issuance in two weeks' : 'Credit markets seize; no issuance at any price',
              pass ? [['market', '', 0.015, 0.5]] : [['market', '', -0.03 * sev, 0.3]])
          ]
        };
      }
    },

    // ---- Day 15 ----
    {
      title: 'The Reckoning',
      brief: (S) => {
        const p = ['Last day of the month. Whatever this was, it is nearly over, and what you are holding when the bell rings is what you keep.'];
        if (S.m.stability < 35) p.push('Unemployment is at 9.4% and climbing. Three more lenders failed over the weekend.');
        else if (S.f.billPassed) p.push('The tape has stopped falling. People are using the word "floor" again, carefully.');
        if (S.m.heat >= 60) p.push('A lawyer you have never met has left two messages. She says it is "not urgent," which is how lawyers say it is urgent.');
        return p;
      },
      scen: (S) => ({
        regime: S.f.billPassed ? 'recovery' : S.m.stability < 35 ? 'panic' : 'chop',
        market: { gap: 0.002, target: S.f.billPassed ? 0.02 : S.m.stability < 35 ? -0.05 * cm(S) : -0.005 },
        events: [
          ev(80, S.f.billPassed ? 'Guarantee facility opens; first drawdowns reported' : 'Second wave of redemption freezes hits credit funds',
            S.f.billPassed ? [['sector', 'bank', 0.03, 0.4]] : [['sector', 'bank', -0.05, 0.3]]),
          ev(200, 'Month-end rebalancing drives outsized moves into the close', [['market', '', 0.01, 0.6]]),
          ev(355, 'Final bell of the worst month in a generation', [])
        ]
      }),
      inbox: (S) => [{ t: 10, from: 'Imani Rhodes', text: S.f.defected ? 'Whatever happens at 4:00, you did the part you could do.' : 'Flat by the close. Whatever you are holding tonight, you own it for a long time.' }]
    }
  ];

  // =====================================================================
  // DECISIONS
  // =====================================================================
  const CHOICES = {
    c1: {
      day: 1, speaker: 'Desmond Kroll', role: 'Head of Trading, Holloway Stern', title: 'The Pension Dump',
      kicker: 'DECISION 1',
      text: [
        'Kroll closes your office door with his foot, which you did not know was possible.',
        '"We are holding forty million of CASCADE paper that is not worth forty million. Riverbend Teachers\' Retirement wants yield. Their consultant does not read footnotes. You walk them through the deck and they buy it at par."',
        '"It is not lying. Everything in the deck is true. It is just not all of it."'
      ],
      options: [
        {
          id: 'dump', label: 'Sell the paper to Riverbend.', hint: 'A $45k desk bonus and $10k of your own. Your fingerprints on it forever.',
          headline: 'Sold $40M of impaired CASCADE paper to a teachers\' pension fund',
          apply: (S) => {
            S.f.dumped = true;
            adj(S, { integrity: -22, heat: 8, firm: 14, stability: -4 }, { kroll: 16, imani: -12 });
            S.pending.push({ type: 'cash', amount: 45000, reason: 'Desk bonus' });
            S.pending.push({ type: 'personal', amount: 10000, reason: 'Your cut, after tax' });
          },
          reply: 'Kroll: "Good. You\'re going to be fine here."',
          after: [
            'The consultant asks two questions. Neither is the right one.',
            'The wire clears at 3:51 PM. Forty million dollars of something nobody wants is now owned by eleven thousand retired teachers, and your bonus is real money in a real account.',
            'Imani watched the whole call from four desks away and has not said a word since.'
          ]
        },
        {
          id: 'refuse', label: 'Refuse. Tell him to find someone else.', hint: 'Kroll will remember. Your limits get cut.',
          headline: 'Refused to place impaired CASCADE paper with a pension fund',
          apply: (S) => {
            S.f.refusedDump = true;
            adj(S, { integrity: 16, firm: -12 }, { kroll: -18, imani: 12 });
          },
          reply: 'Kroll: "Noted."',
          after: [
            '"Noted," he says, and writes nothing down, which is worse.',
            'Someone else does the call within the hour. The paper still moves. The only thing your refusal changed is your leverage limit, which is now 3x, and the way Kroll says your name.',
            'Imani buys you a coffee the next morning without commenting on it.'
          ]
        },
        {
          id: 'leak', label: 'Refuse, and copy the deck to a reporter.', hint: 'Sana Ferreira has been circling. High risk.',
          headline: 'Leaked the internal CASCADE valuation deck to the press',
          apply: (S) => {
            S.f.refusedDump = true;
            S.f.leaked = true;
            S.f.public = true;
            adj(S, { integrity: 26, heat: 18, firm: -18, anger: 8 }, { kroll: -20, imani: 10, sana: 45 });
          },
          reply: 'Sana Ferreira: "I have it. Do not email me again from that address."',
          after: [
            'You photograph fourteen pages in a stairwell with your phone at a bad angle.',
            'Sana Ferreira replies in ninety seconds: <i>I have it. Do not email me again from that address.</i>',
            'You go back to your desk and trade for three more hours like a person who did not just do that.'
          ]
        }
      ]
    },

    c2: { // mid-session call, day 4
      day: 3, mid: true, title: 'The Tip', kicker: 'DECISION 2',
      options: [
        {
          id: 'trade', label: 'Trade on it.',
          headline: 'Traded ahead of the Meridian downgrade on a tip from inside the agency',
          apply: (S) => {
            S.f.insider = true;
            adj(S, { integrity: -18, heat: 14 }, { perry: -10 });
          },
          reply: 'Perry: "Don\'t make it obvious. Please."'
        },
        {
          id: 'ignore', label: 'Never took the call.',
          headline: 'Refused a downgrade tip from inside Meridian Ratings',
          apply: (S) => { adj(S, { integrity: 10 }, { perry: 5 }); },
          reply: 'Perry: "Yeah. Yeah, you\'re right. Forget it."'
        },
        {
          id: 'warn', label: 'Tell him to go to compliance.',
          headline: 'Told a ratings analyst to put the CASCADE downgrade in writing',
          apply: (S) => {
            S.f.perryFiled = true;
            adj(S, { integrity: 16, stability: 4 }, { perry: 20 });
          },
          reply: 'Perry: "If I file this they will know it was me." ... "Okay. Okay."'
        }
      ]
    },

    c3: {
      day: 5, speaker: 'Sen. Marcus Thorne', role: 'Chair, Senate Markets Committee', title: 'The Compute Freedom Act',
      kicker: 'DECISION 3',
      text: [
        'Thorne does not sit down. He stands at the window with his back to you, which you suspect he practiced.',
        '"The Compute Freedom Act raises leverage limits for institutions funding compute infrastructure. My colleagues will vote however the industry tells them to vote, and the industry will say whatever a working trader tells it to say."',
        '"So. You are the working trader. Does it make the system stronger, or does it make it bigger right before it breaks?"'
      ],
      options: [
        {
          id: 'yes', label: 'Back the bill. Higher limits, bigger book.', hint: 'Your leverage goes to 6x. So does everyone else\'s.',
          headline: 'Publicly backed the Compute Freedom Act',
          apply: (S) => {
            S.f.dereg = true;
            S.f.lobbyYes = true;
            adj(S, { integrity: -10, influence: 18, firm: 12, stability: -14 }, { thorne: 18, kroll: 12, imani: -8 });
          },
          reply: 'Thorne: "That is what I hoped you would say."',
          after: [
            'It clears committee in nine days. Leverage limits go up across the street.',
            'Your desk can now hold 6x. So can every desk that is worse at this than you are.',
            'Imani reads the bill text twice and then goes home early for the first time in two years.'
          ]
        },
        {
          id: 'no', label: 'Argue against it. Tighter limits.', hint: 'Costs you influence and your own leverage.',
          headline: 'Testified against the Compute Freedom Act',
          apply: (S) => {
            S.f.regulation = true;
            S.f.lobbyNo = true;
            S.f.public = true;
            adj(S, { integrity: 18, influence: -6, firm: -14, stability: 14 }, { thorne: 8, kroll: -14, imani: 14 });
          },
          reply: 'Thorne: "You have just made both of our lives harder."',
          after: [
            'Your amendment survives by four votes. Position limits tighten everywhere.',
            'Your own book is capped at 3x now, which you argued for, which does not make it feel better on a fast day.',
            'Two months from now, people will argue about whether those four votes mattered. They did.'
          ]
        },
        {
          id: 'dodge', label: 'Say nothing useful.', hint: 'Keep your hands clean. Keep your influence small.',
          headline: 'Declined to take a position on the Compute Freedom Act',
          apply: (S) => { adj(S, { influence: -8 }, { thorne: -10 }); },
          reply: 'Thorne: "Everybody wants to be in the room and nobody wants to be in the minutes."',
          after: [
            'You give him forty minutes of balanced, careful, completely useless commentary.',
            '"Everybody wants to be in the room," he says at the door, "and nobody wants to be in the minutes."',
            'The bill passes anyway, watered down, by a margin that would not have needed you.'
          ]
        }
      ]
    },

    c4: { // mid-session call, day 8
      day: 7, mid: true, title: 'The Pack', kicker: 'DECISION 4',
      options: [
        {
          id: 'join', label: 'Join the raid.',
          headline: 'Joined a coordinated short raid on Ridgeway Trust',
          apply: (S) => {
            S.f.raid = true;
            adj(S, { integrity: -16, heat: 16, stability: -10, anger: 6 }, { greta: 20 });
            S.pending.push({ type: 'short', sym: 'RDGW', mult: 0.8 });
          },
          reply: 'Vail: "Welcome to the pack. Don\'t get sentimental."'
        },
        {
          id: 'refuse', label: 'Trade your own book.',
          headline: 'Declined to join the coordinated raid on Ridgeway Trust',
          apply: (S) => { adj(S, { integrity: 8 }, { greta: -12 }); },
          reply: 'Vail: "Cute. Enjoy your principles."'
        },
        {
          id: 'tell', label: 'Refuse, then warn Ridgeway.',
          headline: 'Warned Ridgeway Trust about a coordinated short raid',
          apply: (S) => {
            S.f.toldRidgeway = true;
            adj(S, { integrity: 14, heat: 10, stability: 6 }, { greta: -30 });
          },
          reply: 'Vail: "Somebody talked. I will find out who."'
        }
      ]
    },

    c5: {
      day: 9, speaker: 'Adele Venn', role: 'Secretary of the Treasury', title: 'Rescue Weekend',
      kicker: 'DECISION 5',
      text: [
        'You are in a conference room at Treasury at 10 PM on a Saturday because somebody on Thorne\'s staff put your name on a list.',
        'Venn has been awake for thirty-one hours. "Ridgeway does not open Monday unless we do something. If we guarantee it, every bank on the street learns that we always will. If we don\'t, we find out what is actually connected to what."',
        '"You trade this paper. You are going to tell me which of those is worse."'
      ],
      options: [
        {
          id: 'bail', label: 'Guarantee it. Stop the run.', hint: 'Stability now. Public fury, and moral hazard, later.',
          headline: 'Argued for a public guarantee of Ridgeway Trust',
          apply: (S) => {
            S.f.bailout = true;
            adj(S, { stability: 22, anger: 20, influence: 10 }, { venn: 16, thorne: 6 });
          },
          reply: 'Venn: "Then I own this. Thank you for being in the room."',
          after: [
            'They announce it at 11:40 PM Sunday. Futures gap up three percent.',
            'By Tuesday the phrase "public money, private bonuses" is on every screen in the country, and it will be for a year.',
            'It worked. That is the part people will find hardest to forgive.'
          ]
        },
        {
          id: 'fail', label: 'Let it fail. Take the pain now.', hint: 'Honest. Also possibly catastrophic.',
          headline: 'Argued that Ridgeway Trust should be allowed to fail',
          apply: (S) => {
            S.f.letFail = true;
            adj(S, { stability: -24, integrity: 10, anger: -6 }, { venn: 8 });
          },
          reply: 'Venn: "I hope you are right. I genuinely do."',
          after: [
            'Ridgeway files at 11:40 PM Sunday. It is the largest failure in the country\'s history by a factor of four.',
            'On Monday, three things nobody had connected to Ridgeway stop working.',
            'Venn calls you at 6 AM. She does not say anything for a while. Then: "Come in."'
          ]
        },
        {
          id: 'ban', label: 'Guarantee it, and ban shorting financials.', hint: 'Buys a week. Freezes your own shorts too.',
          headline: 'Argued for a rescue plus an emergency short-selling ban',
          apply: (S) => {
            S.f.bailout = true;
            S.f.shortBanOn = true;
            S.f.tipShortBan = true;
            adj(S, { stability: 16, anger: 14, influence: 8 }, { venn: 12, greta: -20 });
          },
          reply: 'Venn: "The ban buys us a week. I hope a week is enough."',
          after: [
            'The emergency order lands at 4 AM Monday. Short selling in financials is prohibited until further notice.',
            'Volumes collapse. Spreads triple. Prices stop falling, which everyone agrees is not the same thing as prices being right.',
            'Your own shorts in those names are frozen exactly where they were, which you had not thought about until now.'
          ]
        }
      ]
    },

    c6: {
      day: 10, speaker: 'Desmond Kroll', role: 'Head of Trading, Holloway Stern', title: 'The Marks',
      kicker: 'DECISION 6',
      text: [
        'The valuation committee needs a trading signature on the CASCADE book by 6 PM. Kroll has brought the folder to you personally, which he has never done.',
        '"Model says sixty-one cents. The desk says twenty-two. If we print twenty-two, our capital ratio breaks, the regulator walks in on Thursday, and eleven thousand people here find out what happens next."',
        '"Sign the sixty-one. It is a model output. Models are opinions. Opinions are not lies."'
      ],
      options: [
        {
          id: 'sign', label: 'Sign the marks.', hint: 'The firm survives the week. So does the fraud.',
          headline: 'Signed off on CASCADE marks at 61 cents against a desk bid of 22',
          apply: (S) => {
            S.f.fraud = true;
            adj(S, { integrity: -26, heat: 24, firm: 18, stability: -8 }, { kroll: 18, imani: -18 });
            S.pending.push({ type: 'grant', sym: 'HLST', value: 60000 });
          },
          reply: 'Kroll: "You just saved this firm. Nobody will ever thank you for it."',
          after: [
            'You sign on the second page. It takes four seconds.',
            'The capital ratio holds. The regulator comes Thursday and leaves Thursday. Sixty thousand dollars of restricted Holloway Stern stock appears in your desk account on Friday.',
            'Every one of those things is a separate reason you will not sleep well.'
          ]
        },
        {
          id: 'refuse', label: 'Refuse to sign.', hint: 'Someone else signs it. You are no longer on the inside.',
          headline: 'Refused to sign the CASCADE valuation',
          apply: (S) => {
            adj(S, { integrity: 20, firm: -16 }, { kroll: -22, imani: 16 });
          },
          reply: 'Kroll: "Fine. I\'ll find a signature. They\'re not rare."',
          after: [
            'He finds a signature in twenty minutes. Signatures are not rare.',
            'The marks go out at sixty-one anyway. The only difference is whose name is on page two.',
            'You are removed from the valuation distribution list that evening, which is how this firm says goodbye.'
          ]
        },
        {
          id: 'report', label: 'Refuse, and report it.', hint: 'Regulators, in writing, today. No going back.',
          headline: 'Reported the CASCADE valuation to regulators',
          apply: (S) => {
            S.f.reported = true;
            S.f.public = true;
            adj(S, { integrity: 30, heat: -10, firm: -30, stability: 8, anger: 6 }, { kroll: -40, imani: 20, sana: 20 });
          },
          reply: 'Enforcement Division: "We have your submission. Do not discuss it internally."',
          after: [
            'The form is eleven pages. You fill it out at your own desk, which feels insane, because it is.',
            'Confirmation arrives in four minutes: <i>We have your submission. Do not discuss it internally.</i>',
            'Kroll walks past you twice that afternoon without turning his head, and you understand that he already knows.'
          ]
        }
      ]
    },

    c7: {
      day: 12, speaker: 'Sen. Marcus Thorne', role: 'Chair, Senate Markets Committee', title: 'The Stabilization Act',
      kicker: 'DECISION 7',
      text: [
        'Thorne calls at 9 PM from a corridor. You can hear a vote bell in the background.',
        '"Stabilization Act. Seven hundred billion guarantee facility, and it is four votes short. Four. Some of those votes listen to people who listen to you."',
        '"You want to be useful? Now is the only time it counts."'
      ],
      options: [
        {
          id: 'whip', label: 'Work the phones for it.', hint: 'Spend everything you have on the vote.',
          headline: 'Lobbied hard for the Stabilization Act',
          apply: (S) => {
            S.f.whipped = true;
            adj(S, { influence: 12, integrity: 4, stability: 8 }, { thorne: 20 });
          },
          reply: 'Thorne: "Keep calling."',
          after: ['You make fourteen calls. Two of them matter. You will never find out which two.']
        },
        {
          id: 'against', label: 'Work against it.', hint: 'No more rescues. Let the system clear.',
          headline: 'Lobbied against the Stabilization Act',
          apply: (S) => {
            S.f.whippedAgainst = true;
            adj(S, { influence: 8, stability: -12, anger: -10 }, { thorne: -25 });
          },
          reply: 'Thorne: "Then I hope you can live with the arithmetic."',
          after: ['"I hope you can live with the arithmetic," he says, and hangs up before you answer.']
        },
        {
          id: 'position', label: 'Say nothing. Position for both.', hint: 'Straddle it. Make money either way, if you are right.',
          headline: 'Stayed silent on the vote and positioned for both outcomes',
          apply: (S) => {
            S.f.straddled = true;
            adj(S, { integrity: -8, influence: -10 }, { thorne: -14 });
            S.pending.push({ type: 'cash', amount: 0, reason: 'No position taken' });
          },
          reply: 'Thorne: "I\'ll take that as a no."',
          after: ['You buy protection on both sides of the tape and tell yourself that is not a position. It is a position.']
        }
      ]
    },

    c8: {
      day: 13, speaker: 'Imani Rhodes', role: 'Senior Trader · your mentor', title: 'The Offer',
      kicker: 'FINAL DECISION',
      text: [
        'Imani finds you in the stairwell at 7 PM with a folder she should not have.',
        '"Enforcement wants someone who was in the room. Not a witness, a participant. They are offering full cooperation terms, and they are offering them today."',
        '"There is also a car downstairs that Kroll sent, and there is a plane at Teterboro, and there is a man from Treasury who has called you twice. Everyone is offering you something. Pick one, and pick it now, because tomorrow there is only one option left and it is not a good one."'
      ],
      options: [
        {
          id: 'testify', label: 'Cooperate. Tell them everything.', hint: 'Immunity, probably. A career, no.',
          headline: 'Agreed to cooperate with federal investigators',
          apply: (S) => {
            S.f.testified = true;
            S.f.cooperated = true;
            S.f.public = true;
            adj(S, { integrity: 30, heat: -40, stability: 6, firm: -40 }, { imani: 20, kroll: -50 });
          },
          reply: '',
          after: [
            'It takes nine hours over two days and a lawyer you cannot really afford.',
            'They record everything. At one point you have to explain what a tranche is to someone who will later write the law about tranches.',
            'You walk out at 6 PM on the second day and nobody is waiting for you, which is the whole point.'
          ]
        },
        {
          id: 'public', label: 'Go public. Give it all to Sana.', hint: 'Maximum truth, maximum exposure.',
          headline: 'Gave the full CASCADE file to the press',
          req: (S) => S.rel.sana >= 30 || S.f.leaked,
          apply: (S) => {
            S.f.goPublic = true;
            S.f.public = true;
            adj(S, { integrity: 26, heat: 14, anger: 14, firm: -45, stability: 4 }, { sana: 30, kroll: -50 });
          },
          reply: '',
          after: [
            'Nine thousand words on a Sunday, with the valuation deck reproduced in full on page A14.',
            'By Monday morning it is the only thing anyone is talking about. By Monday afternoon two congressional committees have demanded the same documents you already handed over.',
            'Sana calls once, to say thank you, and then never contacts you again, which is how she protects you.'
          ]
        },
        {
          id: 'treasury', label: 'Take the Treasury job.', hint: 'Needs real influence. The revolving door swings both ways.',
          req: (S) => S.m.influence >= 45 && S.rel.venn >= 40,
          apply: (S) => {
            S.f.treasury = true;
            adj(S, { influence: 20, heat: -25, integrity: -8 }, { venn: 15 });
          },
          reply: '',
          after: [
            'Deputy Secretary for Financial Stability. The office has a window and a fern that somebody else waters.',
            'On your first day you are handed a briefing on the exact instrument you spent a month trading, prepared by people who have never traded anything.',
            'You are, unfortunately, the most qualified person in the room.'
          ]
        },
        {
          id: 'flee', label: 'Take the plane.', hint: 'Liquidate everything tonight. No extradition treaty.',
          req: (S, wealth) => wealth >= 400000,
          apply: (S) => {
            S.f.fled = true;
            adj(S, { integrity: -30, heat: 20 }, { imani: -40 });
          },
          reply: '',
          after: [
            'You liquidate the entire book in ninety minutes of after-hours trading at prices that make you wince.',
            'The wire goes out at 11 PM. The plane leaves at 1:40 AM.',
            'Imani sends one message while you are taxiing. You do not open it.'
          ]
        },
        {
          id: 'quiet', label: 'Say nothing. Go back to the desk.', hint: 'Whatever happens next, happens without you.',
          headline: 'Declined to cooperate, testify or run',
          apply: (S) => {
            S.f.quiet = true;
            adj(S, { integrity: -4 }, { imani: -10 });
          },
          reply: '',
          after: [
            '"Okay," Imani says, after a long time. "Okay."',
            'You go back upstairs. There are forty minutes left in the after-hours session and you spend them working an order, because it is the only thing in the building that still makes sense.',
            'Nobody comes for you. That is not the same as being fine.'
          ]
        }
      ]
    }
  };

  B.StoryData = { DAYS, CHOICES, QUOTAS, ACTS, actIndex, actOf, adj, boss, cm, FIN, STACK, ev, chirp, imp, R };
})(window.BTB);
