// STORY MODE CONTENT: 21 trading days in 20XX, 8 decisions.
// Each day's scenario is a function of story state S, so choices reshape the market itself.
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
  const cm = (S) => B.clamp(1 + (60 - S.m.stability) / 60 * 0.8 + (S.f.dereg ? 0.2 : 0), 0.85, 2.2);
  const FIN = ['bank', 'lender', 'insurer', 'gse'];
  const boss = (S) => (S.f.defected ? 'Mara Linde' : 'Garrett Vance');

  const QUOTAS = [0.003, 0.004, 0.005, 0.005, 0.006, 0.008, 0.008, 0.008, 0.01, 0.012,
    0.015, 0.015, 0.012, 0.012, 0.012, 0.01, 0.01, 0.02, 0.015, 0.012, 0.015];

  const ACTS = ['I · EUPHORIA', 'II · TREMORS', 'III · CONTAGION', 'IV · RECKONING'];
  const actOf = (d) => (d < 5 ? ACTS[0] : d < 10 ? ACTS[1] : d < 15 ? ACTS[2] : ACTS[3]);

  // =====================================================================
  // DAYS
  // =====================================================================
  const DAYS = [
    // ---- Day 1 ----
    {
      title: 'First Day on the Desk',
      brief: (S) => [
        'Halbrook &amp; Vance, 41st floor. Your badge photo is still warm. <b>Garrett Vance</b>, Head of Trading, has given you a <b>$250,000</b> book and one rule: <i>make money every single day.</i>',
        'The market is at record highs. Home prices have gone up 41 months straight. Everyone is getting rich on <b>HYDRA bonds</b>: AAA-rated bundles of "Flex-rate" mortgages that H&amp;V builds and sells by the billion.',
        '<b>Dana Okafor</b>, the desk\'s senior trader, slides a coffee across. "Watch the Wire. Chirp is mostly idiots, but idiots move prices. And never, ever hold more than you can stomach overnight."'
      ],
      scen: (S) => ({
        regime: 'bubble', market: { gap: 0.002, target: 0.005 }, sectors: { tech: { target: 0.006 } },
        events: [
          ev(45, 'Novaline AI unveils "Oracle-5" model; analysts call it "a new industrial revolution"', [['ticker', 'NOVA', 0.05, 0.4]], { rumor: R(8, 'hearing $NOVA has something HUGE dropping this morning. loading up', '@DeepValueDan') }),
          ev(210, 'Home prices post 42nd straight monthly gain; national index at all-time high', [['sector', 'builder', 0.02], ['market', '', 0.003]]),
          chirp(250, 'housing literally cannot go down. it is physically impossible. do the math', '@SubprimeSteve'),
          ev(335, 'NestEgg Home Lending delays quarterly filing, cites "accounting review"', [['ticker', 'NSTG', -0.05, 0.3]], { rumor: R(12, '$NSTG filing late?? something smells in there', '@BearCaveBets') })
        ]
      }),
      inbox: (S) => [
        { t: 2, from: 'Dana Okafor', text: 'Welcome. Click a ticker on the left, set a size, hit BUY (B) or SELL (S). SELL when you\'re flat means you\'re short.' },
        { t: 20, from: 'Dana Okafor', text: 'Your quota is in the top bar. Hit it every day. Vance counts.' },
        { t: 60, from: 'Dana Okafor', text: 'Stress meter\'s up there too. If it maxes out you\'ll lock up. Going flat or grabbing a coffee brings it down.' },
        { t: 330, from: 'Dana Okafor', text: 'Keep an eye on NestEgg. Late filings are never good news.' }
      ]
    },
    // ---- Day 2 ----
    {
      title: 'Up Only',
      brief: (S) => [
        'Kingsbridge Homes crushed earnings before the open. Talking heads on every screen say the same thing: <i>this time is different.</i>',
        'Vance walks past your desk without looking at you. "Rookies usually blow up by Thursday. Prove me wrong."'
      ],
      scen: (S) => ({
        regime: 'bubble', market: { gap: 0.001, target: 0.004 }, tickers: { KBLD: { gap: 0.035, target: 0.045 } },
        events: [
          ev(0, 'PRE-MARKET: Kingsbridge Homes beats on revenue, raises full-year outlook', []),
          chirp(120, 'BREAKING?? $LRMR getting bought by a sovereign fund at 40% premium. source: my uncle', '@CallsOnlyCarl'),
          ev(150, 'Lorimer Brothers: "We are not in talks with anyone"', [['ticker', 'LRMR', -0.01]]),
          ev(270, 'Fed minutes: officials see "no urgency" to raise rates', [['market', '', 0.005, 0.5]], { rumor: R(10, 'fed minutes leaking dovish. risk ON', '@MacroMaven') })
        ]
      }),
      inbox: (S) => [{ t: 125, from: 'Dana Okafor', text: 'That Lorimer buyout "rumor" on Chirp? Classic bait. Wait for the Wire.' }]
    },
    // ---- Day 3 ----
    {
      title: 'The HYDRA Machine',
      brief: (S) => [
        'H&amp;V just priced its biggest HYDRA deal ever: <b>$14 billion</b> of Flex-rate mortgages, stamped AAA by Monarch Ratings. The sales floor is ringing a ship\'s bell for every billion sold.',
        'Dana is quiet this morning. She keeps pulling up delinquency charts nobody else is looking at.'
      ],
      scen: (S) => ({
        regime: 'bull', market: { gap: 0.001, target: 0.002 },
        events: [
          ev(60, 'H&V prices record $14B HYDRA offering; demand "off the charts"', [['ticker', 'HVNB', 0.025, 0.3]]),
          ev(240, 'Flex-rate mortgage delinquencies climb to 6.1%, highest in a decade', [['sector', 'lender', -0.03, 0.3], ['sector', 'builder', -0.015]], { rumor: R(12, 'delinquency data is going to be ugly. just saying', '@BondVigilante') }),
          chirp(260, '6.1% delinquencies is fine. FINE. everything is fine', '@TendiesTomorrow')
        ]
      }),
      inbox: (S) => [{ t: 250, from: 'Dana Okafor', text: 'Delinquencies up two points in a year and HYDRA is still AAA. Think about that.' }]
    },
    // ---- Day 4 ----
    {
      title: 'Insiders',
      brief: (S) => {
        const p = ['Oil is spiking on Middle East headlines. Energy traders are strutting.'];
        if (S.f.dumped) p.push('Vance clapped you on the shoulder this morning. "Ohio Teachers took all forty million. You\'ll go far." Your bonus hit overnight.');
        if (S.f.refusedDump) p.push('Vance cut your limits after you refused the pension deal. Your max leverage is <b>3x</b> this week.');
        if (S.f.leaked) p.push('Rae Castellano texted at 2 AM: "Got the documents. Running it next week. Thank you."');
        return p;
      },
      scen: (S) => ({
        regime: 'bull', market: { gap: 0.0, target: 0.001 },
        tickers: S.f.dumped ? { HVNB: { target: 0.015 } } : {},
        events: [
          ev(90, 'Oil jumps 6% on supply fears; PetroRex at 52-week high', [['sector', 'energy', 0.035, 0.3]]),
          ev(315, 'Filings show NestEgg CEO sold 40% of his personal stake last month', [['ticker', 'NSTG', -0.07, 0.3]], { rumor: R(12, 'NestEgg CEO dumping shares?? form 4s are wild rn', '@TheTapeReader') })
        ]
      })
    },
    // ---- Day 5 ----
    {
      title: 'Hairline Cracks',
      brief: (S) => [
        'Friday. Sentinel Re, the insurer that guarantees half the HYDRA market, is quietly raising reserves. Nobody on TV mentions it.',
        'Your phone has three missed calls from <b>Theo Mercer</b>, your college friend who works at Monarch Ratings.'
      ],
      scen: (S) => ({
        regime: 'chop', market: { gap: -0.001, target: -0.004 },
        events: [
          ev(30, 'Sentinel Re raises loss reserves on mortgage insurance book', [['ticker', 'SENT', -0.035, 0.3]]),
          ev(360, 'Monarch Ratings declines to comment on reports of HYDRA review', [['sector', 'lender', -0.02]])
        ]
      }),
      calls: (S) => [{
        t: 300, scripted: true, kind: 'choice', choiceId: 'c2', from: 'Theo Mercer', role: 'Monarch Ratings · personal cell',
        text: 'I shouldn\'t be calling you. Monarch downgrades 400+ HYDRA tranches Monday before the open. NestEgg and FlexRate are going to get destroyed. I just... I needed to tell someone.',
        options: [
          { id: 'trade', label: 'Say thanks. Position before the close.' },
          { id: 'report', label: 'Tell Theo you have to report this to compliance.' },
          { id: 'ignore', label: 'Hang up. Pretend you never heard it.' }
        ],
        defaultOpt: 'ignore', timer: 20
      }]
    },
    // ---- Day 6 ----
    {
      title: 'Downgrade',
      brief: (S) => {
        const p = ['Monday, 6:02 AM: <b>Monarch Ratings downgrades 412 HYDRA tranches.</b> AAA stamps pulled overnight. Futures are red. Mortgage lenders are indicated down double digits.'];
        if (S.f.reported) p.push('Because you reported Theo\'s call, the SEC is halting NestEgg and FlexRate for the first 30 minutes while it investigates the leak.');
        if (S.f.insider) p.push('You know exactly why this is happening. So, possibly, does someone else.');
        return p;
      },
      scen: (S) => {
        const c = cm(S);
        const lg = S.f.reported ? -0.08 : -0.12;
        return {
          regime: 'bear', fearBase: 24,
          market: { gap: -0.012, target: -0.018 * c },
          sectors: { lender: { gap: lg, target: lg - 0.04 }, gse: { gap: -0.04, target: -0.05 }, builder: { gap: -0.05, target: -0.06 }, insurer: { gap: -0.03, target: -0.04 } },
          halts: S.f.reported ? [{ sym: 'NSTG', t: 0, dur: 30 }, { sym: 'FLXR', t: 0, dur: 30 }] : [],
          events: [
            ev(0, 'MONARCH DOWNGRADES 412 HYDRA TRANCHES; AAA RATINGS PULLED', [], { big: true }),
            ev(150, 'Two Halcyon Partners hedge funds freeze investor redemptions', [['sector', 'bank', -0.03, 0.4], ['market', '', -0.01, 0.3]], { rumor: R(10, 'hearing Halcyon is gating. HYDRA marks are fiction', '@BearCaveBets') }),
            ev(300, 'H&V: exposure to Halcyon funds is "immaterial"', [['ticker', 'HVNB', 0.02, 0.4]])
          ]
        };
      }
    },
    // ---- Day 7 ----
    {
      title: 'Frozen',
      brief: (S) => {
        const p = ['The funding markets are seizing up. Banks are hoarding cash. Your Bloomberg chat is nothing but "who has HYDRA exposure?"'];
        if (S.f.leaked) p.push('Rae\'s story drops this morning. Your name isn\'t in it. Yet.');
        p.push('Senator <b>Harlan Whitfield</b>, chair of the Banking Committee, is unveiling a bill today.');
        return p;
      },
      scen: (S) => {
        const c = cm(S);
        const ev7 = [
          ev(90, 'Senate unveils "Financial Freedom Act" to "unleash lending"', [['market', '', 0.008, 0.3], ['sector', 'bank', 0.02]]),
          ev(270, 'FlexRate Financial slashes dividend 80%', [['ticker', 'FLXR', -0.09, 0.3]], { rumor: R(8, '$FLXR dividend is toast. hearing board meeting today', '@SubprimeSteve') })
        ];
        if (S.f.leaked) ev7.unshift(ev(15, 'THE DAILY LEDGER: H&V dumped toxic HYDRA bonds on Ohio teachers\' pension, documents show', [['ticker', 'HVNB', -0.07, 0.2], ['sector', 'bank', -0.01]], { big: true, src: 'THE DAILY LEDGER' }));
        return { regime: 'bear', market: { gap: -0.004, target: -0.01 * c }, events: ev7 };
      },
      inbox: (S) => [{ t: 100, from: 'Dana Okafor', text: 'Whitfield\'s bill would let banks lever 40-to-1. In THIS market. His office wants to talk to traders tonight. Careful.' }]
    },
    // ---- Day 8 ----
    {
      title: 'Dead Cat Bounce',
      brief: (S) => {
        const p = ['The Fed is expected to act. Shorts are nervous. Longs are praying.'];
        if (S.f.dereg) p.push('Whitfield\'s office sent a thank-you basket. Your firm raised your leverage cap to <b>6x</b>.');
        if (S.f.regulation) p.push('After your testimony to Whitfield\'s staff, compliance capped your leverage at <b>3x</b>. Reformers are quoting you anonymously.');
        return p;
      },
      scen: (S) => {
        const e = [
          ev(60, 'Fed injects $50B in emergency liquidity into funding markets', [['market', '', 0.015, 0.6]], { big: true }),
          ev(320, 'NestEgg draws down entire $4B credit line', [['ticker', 'NSTG', -0.11, 0.3]], { rumor: R(10, 'NestEgg just maxed their revolver. that is a bank run in slow motion', '@BondVigilante') })
        ];
        if (S.f.dereg) e.push(ev(200, 'Financial Freedom Act clears committee', [['sector', 'bank', 0.025]]));
        if (S.f.regulation) e.push(ev(200, 'Reform amendment to Freedom Act gains bipartisan support', [['sector', 'bank', -0.01]]));
        return { regime: 'chop', market: { gap: 0.003, target: 0.012 }, events: e };
      }
    },
    // ---- Day 9 ----
    {
      title: 'The Pack',
      brief: (S) => [
        'Lorimer Brothers, the fourth-largest investment bank in the country, is sitting on $60 billion of HYDRA. Its credit-default swaps are flashing red.',
        'The desk heads have been in Vance\'s office with the door closed since 7 AM.'
      ],
      scen: (S) => {
        const c = cm(S);
        const e = [
          ev(180, 'Lorimer credit-default swaps blow out to record', [['ticker', 'LRMR', S.f.raid ? -0.12 : -0.06, 0.3]], { rumor: R(10, 'LRMR CDS going vertical. someone knows something', '@TheTapeReader') }),
          ev(330, S.f.tipShortBan ? 'SEC weighs emergency short-sale ban on financial stocks' : 'SEC chair: "We are monitoring unusual short activity"', [['sector', 'bank', S.f.tipShortBan ? 0.03 : 0.01]])
        ];
        return { regime: 'bear', market: { gap: -0.004, target: -0.012 * c }, tickers: { LRMR: { target: -0.03 } }, events: e };
      },
      calls: (S) => [{
        t: 90, scripted: true, kind: 'choice', choiceId: 'c4', from: boss(S), role: 'Head of Trading · internal line',
        text: 'Listen close. Every big desk on the Street is shorting Lorimer today. Together. We push it under, we buy the pieces cheap. I\'m putting a short in your book equal to your whole account. You in?',
        options: [
          { id: 'join', label: '"I\'m in." (Take the short)' },
          { id: 'refuse', label: '"Not my trade, Garrett."' },
          { id: 'tip', label: 'Say yes, then quietly call the SEC.' }
        ],
        defaultOpt: 'refuse', timer: 20
      }]
    },
    // ---- Day 10 ----
    {
      title: 'Run on Lorimer',
      brief: (S) => {
        const p = ['Friday. Hedge funds are pulling their money out of Lorimer Brothers. Depositors are lining up at its private bank branches.'];
        if (S.f.raid) p.push('Your book holds a massive Lorimer short. Every tick down is money in your pocket. Every tick up could end you.');
        if (S.f.tipShortBan) p.push('<b>SEC EMERGENCY ORDER:</b> short selling of financial stocks is BANNED through Tuesday.');
        return p;
      },
      scen: (S) => {
        const c = cm(S);
        return {
          regime: 'bear', fearBase: 32,
          market: { gap: -0.006, target: -0.025 * c },
          tickers: { LRMR: { gap: -0.04, target: S.f.raid ? -0.18 : -0.1 } },
          events: [
            ev(30, 'Three major hedge funds pull prime brokerage accounts from Lorimer', [['ticker', 'LRMR', -0.08, 0.3]]),
            ev(210, 'Lorimer CEO: "Our liquidity position is strong"', [['ticker', 'LRMR', 0.06, 0.8]]),
            ev(300, 'Report: Lorimer burned through $30B of cash in two days', [['ticker', 'LRMR', -0.14, 0.2], ['sector', 'bank', -0.03]], { big: true, rumor: R(8, 'lorimer is DONE. friends there are packing boxes', '@HedgeHog88') }),
            ev(370, 'Treasury Secretary Evelyn Marsh summons bank CEOs for emergency weekend talks', [])
          ]
        };
      }
    },
    // ---- Day 11 ----
    {
      title: 'Monday',
      brief: (S) => {
        if (S.f.bailout) return ['<b>TREASURY RESCUES LORIMER.</b> $85 billion of taxpayer money, announced at 11 PM Sunday. Futures are up big. Chirp is on fire: <i>#NoMoreBailouts</i>.'];
        if (S.f.merger) return ['<b>H&amp;V TO ABSORB LORIMER</b> in a Treasury-brokered deal. You\'re holding a slice of the new giant. Your firm now owns $60B of Lorimer\'s HYDRA on top of its own.'];
        return ['<b>LORIMER BROTHERS FILES FOR BANKRUPTCY.</b> 158 years, gone in a weekend. Asian markets lost 6% overnight. Futures are limit down.', 'Dana, staring at the pre-market screen: "Nobody knows who owes what to whom. This is how it starts."'];
      },
      scen: (S) => {
        const c = cm(S);
        if (S.f.bailout) {
          return {
            regime: 'recovery', market: { gap: 0.025, target: 0.005 }, sectors: { bank: { gap: 0.04, target: 0.02 } },
            tickers: { LRMR: { gap: 0.25, target: 0.12 } },
            events: [
              ev(0, 'TREASURY RESCUES LORIMER WITH $85B LIFELINE', [], { big: true }),
              chirp(120, 'so we just print money for bankers now? cool cool cool #NoMoreBailouts', '@RealFinanceGuy'),
              ev(200, 'Protesters surround Treasury; lawmakers vow "never again"', [['market', '', -0.01, 0.3]])
            ]
          };
        }
        if (S.f.merger) {
          return {
            regime: 'bear', market: { gap: -0.01, target: -0.02 * c },
            tickers: { HVNB: { gap: -0.12, target: -0.15 }, LRMR: { gap: 0.18, target: 0.2 } },
            events: [
              ev(0, 'H&V TO ABSORB LORIMER IN TREASURY-BROKERED DEAL', [], { big: true }),
              ev(200, 'Analysts question whether H&V can digest Lorimer\'s HYDRA book', [['ticker', 'HVNB', -0.05, 0.3]])
            ]
          };
        }
        return {
          regime: 'panic', fearBase: 45, market: { gap: -0.035 * c, target: -0.09 * c },
          sectors: { lender: { gap: -0.15, target: -0.25 }, insurer: { gap: -0.12, target: -0.2 }, bank: { gap: -0.05, target: -0.1 } },
          tickers: { LRMR: { gap: -0.82, target: -0.9 }, SENT: { gap: -0.08, target: -0.15 } },
          halts: [{ sym: 'LRMR', t: 0, dur: 25 }],
          events: [
            ev(0, 'LORIMER BROTHERS FILES FOR CHAPTER 11 BANKRUPTCY', [], { big: true }),
            ev(75, 'Reserve Prime money market fund "breaks the buck" on Lorimer losses', [['market', '', -0.03, 0.3]], { big: true }),
            ev(250, 'Sentinel Re shares halted; insurer seeks emergency funding', [['ticker', 'SENT', -0.2, 0.2]], { halt: { sym: 'SENT', dur: 15 } })
          ]
        };
      },
      inbox: (S) => S.f.raid && S.f.bailout ? [{ t: 5, from: 'Dana Okafor', text: 'You\'re short Lorimer into a bailout. Get out. NOW.' }] : []
    },
    // ---- Day 12 ----
    {
      title: 'Contagion',
      brief: (S) => [
        'Sentinel Re insured over $400 billion of HYDRA against default. If it goes, every bank that bought that insurance goes with it.',
        S.f.lorimerFailed ? 'With Lorimer gone, Sentinel\'s counterparties are panicking.' : 'The Lorimer deal bought a weekend. It didn\'t fix anything.'
      ],
      scen: (S) => {
        const c = cm(S);
        const hit = S.f.lorimerFailed ? -0.4 : -0.25;
        return {
          regime: 'panic', market: { gap: -0.01 * c, target: -0.03 * c },
          events: [
            ev(60, 'Sentinel Re seeks $40B emergency loan; downgrade looms', [['ticker', 'SENT', hit, 0.2], ['sector', 'bank', -0.03]], { big: true, halt: { sym: 'SENT', dur: 10 } }),
            ev(270, 'Federal Reserve agrees to rescue Sentinel Re', [['market', '', 0.03, 0.5], ['ticker', 'SENT', 0.3, 0.5]], { big: true, rumor: R(12, 'hearing the Fed is taking Sentinel. squeeze incoming', '@MacroMaven') })
          ]
        };
      }
    },
    // ---- Day 13 ----
    {
      title: 'Whipsaw',
      brief: (S) => ['Shorts are scrambling to cover after the Sentinel rescue. Europe opens in a panic. Nobody knows which way this breaks.'],
      scen: (S) => {
        const c = cm(S);
        return {
          regime: 'panic', market: { gap: 0.008, target: -0.01 * c },
          events: [
            ev(30, 'Short sellers scramble to cover; financials rip higher', [['market', '', 0.025, 0.3], ['sector', 'bank', 0.03]]),
            ev(240, 'Global markets slide as contagion spreads to European banks', [['market', '', -0.04 * c, 0.2], ['sector', 'bank', -0.03]], { big: true }),
            chirp(250, 'I went long at 10am and short at 2pm and somehow lost money on both', '@TendiesTomorrow')
          ]
        };
      }
    },
    // ---- Day 14 ----
    {
      title: 'The Auditors',
      brief: (S) => [
        'Outside auditors arrived at Halbrook &amp; Vance at 7 AM. They\'ve been in the CFO\'s office ever since.',
        S.f.merger ? 'With Lorimer\'s book added, H&amp;V holds more than $90 billion of HYDRA.' : 'H&amp;V says it holds $12 billion of HYDRA. Dana thinks it\'s closer to forty.'
      ],
      scen: (S) => {
        const c = cm(S);
        return {
          regime: 'bear', market: { gap: -0.005, target: -0.02 * c },
          events: [
            chirp(120, 'hearing $HVNB is hiding HUGE hydra losses. like enron huge', '@BearCaveBets'),
            ev(150, 'Sources: H&V\'s HYDRA exposure may be triple the reported figure', [['ticker', 'HVNB', S.f.merger ? -0.1 : -0.07, 0.3]]),
            ev(240, 'H&V: reports are "false and irresponsible"', [['ticker', 'HVNB', 0.04, 0.5]])
          ]
        };
      }
    },
    // ---- Day 15 ----
    {
      title: 'Consequences',
      brief: (S) => {
        if (S.f.disclosed) return ['H&amp;V announced <b>$41 billion</b> in HYDRA writedowns before the open. The stock is indicated down 35%. Vance hasn\'t spoken to you. Dana left a note on your keyboard: <i>"Proud of you. Watch your back."</i>'];
        if (S.f.fraud) return ['The auditors signed off on H&amp;V\'s marks. The stock is up in pre-market. Vance winked at you in the elevator.', 'The real numbers are in a spreadsheet called <i>Q3_final_FINAL_v2</i>. You know where it is.'];
        if (S.f.defected) return ['You\'re at <b>Goldstone Capital</b> now, with a new desk and a new boss: <b>Mara Linde</b>. H&amp;V\'s lawyers have already called. Twice.'];
        return ['H&amp;V is holding its breath.'];
      },
      scen: (S) => {
        const c = cm(S);
        const t = {};
        if (S.f.disclosed) t.HVNB = { gap: S.f.merger ? -0.5 : -0.35, target: S.f.merger ? -0.55 : -0.4 };
        else if (S.f.fraud) t.HVNB = { gap: 0.02, target: 0.03 };
        else if (S.f.defected) t.HVNB = { gap: -0.12, target: -0.14 };
        return {
          regime: 'bear', market: { gap: -0.004, target: -0.015 * c }, tickers: t,
          events: [
            ev(330, 'Treasury unveils $700B "Stabilization Act" to buy toxic HYDRA assets', [['market', '', 0.04, 0.5], ['sector', 'bank', 0.06, 0.4]], { big: true, rumor: R(10, 'hearing Treasury announcing something MASSIVE before the close', '@MacroMaven') })
          ]
        };
      }
    },
    // ---- Day 16 ----
    {
      title: 'The Hearing',
      brief: (S) => {
        const p = ['Secretary Marsh testifies before Congress today. The Stabilization Act needs votes. America is furious.'];
        if (S.f.dumped) p.push('<b>Ohio Teachers\' Retirement System sued H&amp;V overnight. You are named in the complaint.</b> Legal says your share of the settlement is $40,000.');
        return p;
      },
      scen: (S) => {
        const e = [
          ev(90, 'Marsh to senators: "If this bill fails, God help us"', [['market', '', -0.02, 0.3]]),
          ev(270, 'Senate leaders signal deal on Stabilization Act', [['market', '', 0.025, 0.3]])
        ];
        if (S.f.dumped) e.unshift(ev(0, 'Ohio teachers sue H&V over HYDRA sales; junior trader named', [['ticker', 'HVNB', -0.03]], { big: true }));
        if (S.f.bailout) e.push(ev(150, 'Goldstone shares wobble as investors test the next "too big to fail"', [['ticker', 'GSTN', -0.08, 0.3]]));
        return { regime: 'chop', fearBase: 34, market: { gap: 0, target: 0.003 }, events: e };
      }
    },
    // ---- Day 17 ----
    {
      title: 'Whip Count',
      brief: (S) => ['The House votes tomorrow at 2 PM. Every news channel has a vote tracker. Every trader in America is staring at it.'],
      scen: (S) => ({
        regime: 'bear', market: { gap: -0.004, target: -0.015 },
        events: [
          chirp(60, 'hill staffer here: votes are NOT there. anyone saying otherwise is lying', '@BondVigilante'),
          chirp(120, 'VOTE IS IN THE BAG. 300+ yes votes. load the boat', '@CallsOnlyCarl'),
          ev(200, 'House whip: "We do not have the votes"', [['market', '', -0.02, 0.3]]),
          ev(330, 'Late push for votes; leadership "optimistic"', [['market', '', 0.015, 0.3]])
        ]
      }),
      inbox: (S) => [{ t: 340, from: 'Sen. Harlan Whitfield', text: 'Tomorrow decides everything. I need people who move markets to pick a side tonight.' }]
    },
    // ---- Day 18 ----
    {
      title: 'The Vote',
      brief: (S) => [
        'The House votes on the <b>Stabilization Act at 2:00 PM</b>, in the middle of the trading session.',
        'If it passes, the market rips. If it fails... nobody wants to say it out loud.',
        '<i>Position accordingly. Or don\'t.</i>'
      ],
      scen: (S) => {
        const c = cm(S);
        const pass = S.f.billPassed;
        const e = [
          ev(240, 'House floor vote on Stabilization Act underway', []),
          chirp(255, 'vote count on CSPAN is... not great. not great at all', '@TheTapeReader')
        ];
        if (pass) {
          e.push(ev(270, 'HOUSE PASSES STABILIZATION ACT, 263-171', [['market', '', 0.045, 0.4], ['sector', 'bank', 0.06, 0.4]], { big: true }));
        } else {
          e.push(ev(270, 'HOUSE REJECTS STABILIZATION ACT, 205-228', [['market', '', -0.075 * c, 0.1], ['sector', 'bank', -0.08], ['sector', 'lender', -0.1], ['sector', 'insurer', -0.08]], { big: true, script: 'voteFail' }));
          e.push(ev(300, 'Credit markets freeze; interbank lending rates spike to record', [['market', '', -0.04 * c, 0.2]], { big: true }));
        }
        return { regime: pass ? 'bear' : 'panic', fearBase: 36, market: { gap: 0.003, target: 0.008 }, events: e };
      }
    },
    // ---- Day 19 ----
    {
      title: 'Aftershock',
      brief: (S) => S.f.billPassed
        ? ['The bill passed. The relief rally is already fading. It turns out $700 billion doesn\'t fix a broken housing market overnight.']
        : ['The biggest point drop in history. Retirement accounts cut in half overnight. Congress is scrambling to rewrite the bill.'],
      scen: (S) => {
        const c = cm(S);
        const e = [];
        if (S.f.fraud && !S.f.defected) e.push(ev(90, 'AUDITORS: H&V HID $41B IN HYDRA LOSSES', [['ticker', 'HVNB', -0.55, 0.1]], { big: true, halt: { sym: 'HVNB', dur: 30 } }));
        if (S.f.insider && S.m.heat >= 50) e.push(ev(200, 'SEC opens insider-trading probe into trades ahead of HYDRA downgrade', [['sector', 'lender', -0.01]], { big: true }));
        return S.f.billPassed
          ? { regime: 'bear', market: { gap: 0.005, target: -0.015 }, events: e }
          : { regime: 'panic', fearBase: 48, market: { gap: -0.025 * c, target: -0.035 * c }, events: e };
      }
    },
    // ---- Day 20 ----
    {
      title: 'Second Chances',
      brief: (S) => S.f.billPassed
        ? ['Central banks around the world are rumored to be coordinating an emergency rate cut.']
        : ['A revised Stabilization Act, now packed with sweeteners, goes to a second vote this afternoon.'],
      scen: (S) => S.f.billPassed
        ? { regime: 'recovery', market: { gap: 0.004, target: -0.005 }, events: [ev(30, 'Central banks announce coordinated emergency rate cut', [['market', '', 0.025, 0.5]], { big: true })] }
        : { regime: 'recovery', fearBase: 40, market: { gap: -0.01, target: 0.0 }, events: [ev(210, 'House passes revised Stabilization Act on second vote', [['market', '', 0.06, 0.3], ['sector', 'bank', 0.05]], { big: true })] }
    },
    // ---- Day 21 ----
    {
      title: 'The Reckoning',
      brief: (S) => [
        'The last trading day of the month. Whatever happens at 4:00 PM is how this chapter of your life ends.',
        S.m.stability >= 60 ? 'For the first time in weeks, the pre-market is calm.' : S.m.stability >= 30 ? 'The pre-market is shaky. Nobody believes the worst is over.' : 'Global markets are in freefall. Unemployment claims just posted their biggest jump since the Depression.'
      ],
      scen: (S) => {
        const c = cm(S);
        const e = [];
        if ((S.f.fraud || S.f.insiderTraded) && S.m.heat >= 70 && !S.f.cooperated) e.push(ev(180, 'FBI agents seen entering H&V headquarters', [['ticker', 'HVNB', -0.1]], { big: true }));
        if (S.m.stability >= 60) return { regime: 'recovery', market: { gap: 0.004, target: 0.015 }, events: e };
        if (S.m.stability >= 30) return { regime: 'bear', market: { gap: -0.005, target: -0.02 }, events: e };
        e.push(ev(150, 'Global markets in freefall as recession fears spike', [['market', '', -0.04 * c, 0.2]], { big: true }));
        return { regime: 'panic', fearBase: 50, market: { gap: -0.02, target: -0.08 * c }, events: e };
      }
    }
  ];

  // =====================================================================
  // CHOICES (end-of-day unless noted). req() hides options; apply() mutates S.
  // pending actions: {type:'cash',amount,reason} | {type:'short',sym,mult} | {type:'grant',sym,value}
  // =====================================================================
  const CHOICES = {
    c1: {
      day: 2, speaker: 'Garrett Vance', role: 'Head of Trading, Halbrook & Vance', title: 'The Pension Dump',
      text: [
        '"Close the door." Vance doesn\'t look up from his screen. "We\'ve got forty million of HYDRA-7 mezzanine sitting on our books. The stuff the rating says is AAA but, you know."',
        '"Ohio Teachers\' Retirement System wants yield. You\'re going to call them tonight and sell it to them. Easy trade. Nice bonus. Your first real test."'
      ],
      options: [
        { id: 'comply', label: 'Make the call.', hint: 'Easy money. Teachers probably won\'t notice for years.',
          apply: (S) => { S.f.dumped = true; adj(S, { integrity: -20, anger: 5 }, { vance: 15, dana: -10 }); S.pending.push({ type: 'cash', amount: 25000, reason: 'Pension deal bonus' }); },
          after: ['You make the call. Forty million dollars of teachers\' retirement money buys bonds you wouldn\'t touch yourself.', 'A $25,000 bonus lands in your account before you get home.'],
          headline: 'Trader sold toxic HYDRA to Ohio teachers\' pension' },
        { id: 'refuse', label: 'Refuse.', hint: 'Vance won\'t forget.',
          apply: (S) => { S.f.refusedDump = true; adj(S, { integrity: 10 }, { vance: -20, dana: 10 }); },
          after: ['"Then get out of my office." Your leverage gets cut to 3x for the rest of the week.', 'Someone else makes the call.'],
          headline: 'Refused to dump HYDRA on a pension fund' },
        { id: 'leak', label: 'Say yes. Then send the deal docs to a reporter.', hint: 'Rae Castellano at the Daily Ledger has been sniffing around HYDRA.',
          apply: (S) => { S.f.leaked = true; adj(S, { integrity: 15, heat: 10, stability: 5, firm: -10 }, { rae: 35, vance: -5 }); },
          after: ['You send the documents from a burner email at 1 AM. Rae replies in four minutes: "Holy. Okay. Give me a week."'],
          headline: 'Leaked pension-dump documents to the Daily Ledger' }
      ]
    },
    c2: { // mid-session call, day 5
      day: 4, mid: true, title: 'The Tip',
      options: [
        { id: 'trade', apply: (S) => { S.f.insider = true; adj(S, { integrity: -15, heat: 20 }, { dana: -5 }); },
          reply: 'Theo: "Just... be careful. Please." Monday\'s gap is coming. Position before the close, if you dare.',
          headline: 'Traded on an inside tip about the HYDRA downgrade' },
        { id: 'report', apply: (S) => { S.f.reported = true; adj(S, { integrity: 15, heat: -5, influence: 5 }, { dana: 5 }); },
          reply: 'Compliance thanks you and forwards the report to the SEC. Theo stops answering your texts.',
          headline: 'Reported a ratings-agency leak to regulators' },
        { id: 'ignore', apply: (S) => { S.f.ignoredTip = true; },
          reply: 'You hang up. It doesn\'t stop you from thinking about it.',
          headline: null }
      ]
    },
    c3: {
      day: 6, speaker: 'Sen. Harlan Whitfield', role: 'Chair, Senate Banking Committee', title: 'The Financial Freedom Act',
      text: [
        'A steakhouse on K Street. Whitfield cuts his ribeye into perfect squares. "Traders like you understand what bureaucrats don\'t. Capital needs to <i>move</i>."',
        '"My Freedom Act lifts leverage limits and ends HYDRA reporting rules. A few words from the Street and it sails through. Or," he dabs his mouth, "you could tell me why I\'m wrong."'
      ],
      options: [
        { id: 'dereg', label: 'Back the bill. Lobby for deregulation.', hint: 'More leverage for everyone, including you.',
          apply: (S) => { S.f.dereg = true; adj(S, { stability: -20, influence: 15 }, { whitfield: 20 }); },
          after: ['Whitfield beams. "You\'ll find I have a long memory for friends." By morning your leverage cap is 6x.'],
          headline: 'Lobbied for the Financial Freedom Act' },
        { id: 'regulate', label: 'Tell him the truth about HYDRA. Push for regulation.', hint: 'Safer system. Tighter limits on you.',
          apply: (S) => { S.f.regulation = true; adj(S, { stability: 20, influence: 5, anger: -5, integrity: 5 }, { whitfield: -15 }); },
          after: ['Whitfield\'s smile doesn\'t move, but his eyes go cold. Two days later, reformers add your arguments to an amendment. Compliance caps your leverage at 3x.'],
          headline: 'Warned Congress about HYDRA and pushed for reform' },
        { id: 'stayout', label: 'Eat the steak. Commit to nothing.', hint: 'Politics isn\'t your job.',
          apply: (S) => { adj(S, {}, { whitfield: -5 }); },
          after: ['You nod a lot and say nothing quotable. Whitfield picks up the check without looking at you.'],
          headline: null }
      ]
    },
    c4: { // mid-session call, day 9
      day: 8, mid: true, title: 'The Pack',
      options: [
        { id: 'join', apply: (S) => { S.f.raid = true; adj(S, { integrity: -10, heat: 15, stability: -10 }, { vance: 10 }); S.pending.push({ type: 'short', sym: 'LRMR', mult: 1.0 }); },
          reply: 'A Lorimer short worth your entire account appears in your book. Vance: "Welcome to the big leagues."',
          headline: 'Joined a coordinated short raid on Lorimer Brothers' },
        { id: 'refuse', apply: (S) => { adj(S, { integrity: 5 }, { vance: -10, dana: 5 }); },
          reply: 'Vance: "Your loss, choirboy." The line goes dead.',
          headline: null },
        { id: 'tip', apply: (S) => { S.f.tipShortBan = true; adj(S, { integrity: 10, heat: -5, stability: 10 }, { vance: -15 }); },
          reply: 'The SEC listens. Tomorrow an emergency order bans short selling of financial stocks for three days.',
          headline: 'Tipped the SEC about a coordinated short raid' }
      ]
    },
    c5: {
      day: 9, speaker: 'Evelyn Marsh', role: 'Secretary of the Treasury', title: 'Rescue Weekend',
      kicker: 'SATURDAY, 11:40 PM · FEDERAL RESERVE BANK OF NEW YORK',
      text: [
        'You\'re in a conference room with the most powerful people in finance, because Marsh wants someone who actually trades HYDRA. Cold pizza. Nobody has slept.',
        '"Lorimer opens Monday or it doesn\'t," Marsh says. "Option one: taxpayers bail it out. Option two: we let it fail and send a message. Option three: someone buys it. Your firm is the only bidder. What do you tell me?"'
      ],
      options: [
        { id: 'bailout', label: '"Bail them out. The system can\'t take it."', hint: 'Stops the bleeding. The public will be furious.',
          apply: (S) => { S.f.bailout = true; adj(S, { stability: 10, anger: 20, influence: 10 }, {}); },
          after: ['Marsh closes her eyes. "God help us." At 11 PM Sunday, Treasury announces an $85 billion rescue of Lorimer Brothers.'],
          headline: 'Advised Treasury to bail out Lorimer Brothers' },
        { id: 'fail', label: '"Let it fail. No more moral hazard."', hint: 'A clean message. Maybe a catastrophe.',
          apply: (S) => { S.f.lorimerFailed = true; adj(S, { stability: -25, anger: -5, influence: 5 }, {}); },
          after: ['The room goes silent. Marsh nods slowly. At 1:45 AM Monday, Lorimer Brothers files for bankruptcy.'],
          headline: 'Advised Treasury to let Lorimer Brothers fail' },
        { id: 'merger', label: '"Let H&V buy it. I\'ll make it work."', hint: 'You get a stake. H&V inherits the toxic book.',
          req: (S) => S.rel.vance >= 35 && !S.f.defected,
          apply: (S) => { S.f.merger = true; adj(S, { stability: 5, firm: -20, influence: 5 }, { vance: 15 }); S.pending.push({ type: 'grant', sym: 'HVNB', value: 50000 }); },
          after: ['Vance signs at 4 AM. For your trouble you get $50,000 of H&V stock. Nobody has fully read Lorimer\'s balance sheet.'],
          headline: 'Brokered H&V\'s takeover of Lorimer Brothers' }
      ]
    },
    c6: {
      day: 13, speaker: 'Garrett Vance', role: 'Head of Trading, Halbrook & Vance', title: 'The Marks',
      text: [
        'Vance\'s office, 9 PM. For once he looks scared. "The auditors want our HYDRA marks. We\'ve got it at 92 cents on the dollar. Real market\'s about... thirty."',
        '"You built the model. Tell them 92 is right, sign off, and nobody finds out until this blows over. Or we\'re all finished. You included."'
      ],
      options: [
        { id: 'hide', label: 'Sign off on the fake marks.', hint: 'Save the firm. Commit fraud.',
          req: (S) => !S.f.defected,
          apply: (S) => { S.f.fraud = true; adj(S, { integrity: -20, heat: 20 }, { vance: 15, dana: -15 }); },
          after: ['You sign. Your hand only shakes a little. H&amp;V reports "manageable" HYDRA exposure. The stock holds up.'],
          headline: 'Signed off on fraudulent HYDRA valuations' },
        { id: 'disclose', label: 'Refuse. Tell the auditors the real number.', hint: 'The stock will crater. So might your career.',
          apply: (S) => { S.f.disclosed = true; adj(S, { integrity: 20, heat: -10, firm: -20 }, { vance: -25, rae: 10, dana: 15 }); },
          after: ['You walk the auditors through the real model. It takes four hours. At 5 AM, H&amp;V announces $41 billion in writedowns.'],
          headline: 'Exposed H&V\'s hidden HYDRA losses to auditors' },
        { id: 'defect', label: 'Walk out. Take your client list to Goldstone.', hint: 'New desk, new boss. H&V\'s lawyers will be furious.',
          apply: (S) => { S.f.defected = true; adj(S, { integrity: -10, heat: 15, influence: 5 }, {}); S.rel.vance = 50; },
          after: ['Mara Linde at Goldstone answers on the first ring. "Be here at six. Bring the list." You leave your H&amp;V badge on Vance\'s chair.'],
          headline: 'Defected to Goldstone with H&V\'s client list' }
      ]
    },
    c7: {
      day: 16, speaker: 'Sen. Harlan Whitfield', role: 'Chair, Senate Banking Committee', title: 'The Stabilization Act',
      text: [
        'Whitfield calls at 10 PM. "Tomorrow at two the House votes on Marsh\'s $700 billion. The people I talk to are split down the middle."',
        '"Cable news wants a trader on air tonight. Somebody who can explain what happens if this fails. Or what happens if it passes. Which somebody are you?"'
      ],
      options: [
        { id: 'yes', label: 'Go on TV. Lobby for YES.', hint: '"Pass it or we all go down together."',
          apply: (S) => { S.f.lobbyYes = true; adj(S, { influence: 15, anger: 5 }, { whitfield: 10 }); },
          after: ['You tell nine million viewers their 401(k)s depend on this bill. Clips go viral in both directions.'],
          headline: 'Went on national TV to push the bailout bill' },
        { id: 'no', label: 'Go on TV. Lobby for NO.', hint: '"No more bailouts for Wall Street."',
          apply: (S) => { S.f.lobbyNo = true; adj(S, { influence: 5, anger: -10, stability: -10 }, { whitfield: -10 }); },
          after: ['"Let them fail," you say. A populist congressman retweets you. Marsh\'s office stops returning calls.'],
          headline: 'Went on national TV to kill the bailout bill' },
        { id: 'testify', label: 'Testify publicly about what really happened.', hint: 'The whole truth: HYDRA, the ratings, the lies.',
          req: (S) => S.rel.rae >= 40 || S.m.integrity >= 60,
          apply: (S) => { S.f.testified = true; const exposed = S.f.fraud || S.f.insider || S.f.raid || S.f.dumped; adj(S, { integrity: 15, stability: 10, anger: -10, heat: exposed ? 25 : 0 }, { rae: 15 }); },
          after: ['You testify for three hours. You name names. Some of them, uncomfortably, include your own.'],
          headline: 'Testified before Congress about the HYDRA scheme' },
        { id: 'quiet', label: 'Decline. Let the vote happen.', hint: 'Trade the outcome instead of changing it.',
          apply: (S) => {},
          after: ['You turn your phone off and stare at the ceiling until 4 AM.'],
          headline: null }
      ]
    },
    c8: {
      day: 18, speaker: 'Dana Okafor', role: 'Senior Trader · your mentor', title: 'The Offer',
      kicker: 'THURSDAY NIGHT · A BAR ON STONE STREET',
      text: [
        'Dana orders two whiskeys. "Whatever you do next, you do it now. The music stopped. Everybody\'s looking for a chair."',
        '"People have been calling me about you. Here\'s what\'s on the table."'
      ],
      options: [
        { id: 'treasury', label: 'Take the Deputy Treasury Secretary job.', hint: 'Marsh wants someone who knows where the bodies are buried.',
          req: (S) => S.m.influence >= 50 && S.f.billPassed,
          apply: (S) => { S.f.treasury = true; adj(S, { influence: 10 }, {}); },
          after: ['Marsh calls personally. "Start Monday. Divest everything." Two more days of trading, then you work for the people you just advised.'],
          headline: 'Accepted a senior post at Treasury' },
        { id: 'book', label: 'Go public with Rae. Tell the whole story.', hint: 'A book deal, and your name on everything.',
          req: (S) => S.rel.rae >= 50,
          apply: (S) => { S.f.goPublic = true; adj(S, { integrity: 10 }, { rae: 20 }); },
          after: ['Rae buys the next round. "This is going to be the story of the decade. You understand that, right?"'],
          headline: 'Went public with the Daily Ledger' },
        { id: 'cooperate', label: 'Cooperate with federal prosecutors.', hint: 'Pay a fine. Tell them everything. Stay out of prison.',
          req: (S) => S.m.heat >= 45,
          apply: (S) => { S.f.cooperated = true; adj(S, { heat: -40, integrity: 15 }, { vance: -30 }); S.pending.push({ type: 'fineFrac', frac: 0.25, reason: 'Cooperation settlement' }); },
          after: ['You meet the Assistant U.S. Attorney at 7 AM. You pay 25% of everything you have. You start talking.'],
          headline: 'Cooperated with federal prosecutors' },
        { id: 'flee', label: 'Take the jet to Port Solace. Tonight.', hint: 'No extradition treaty. Liquidate everything and go.',
          req: (S, w) => S.m.heat >= 55 || (w || 0) >= 2 * S.startCapital,
          apply: (S) => { S.f.fled = true; },
          after: ['A private terminal in Teterboro. No questions asked. By sunrise you\'re over the Atlantic with everything you own converted to cash.'],
          headline: 'Fled the country on a private jet' },
        { id: 'stay', label: 'Keep your head down. Trade.', hint: 'Finish the month. See what\'s left standing.',
          apply: (S) => {},
          after: ['Dana nods, finishes her drink and leaves a hundred on the bar. "See you at the bell."'],
          headline: null }
      ]
    }
  };

  B.StoryData = { DAYS, CHOICES, QUOTAS, actOf, adj, cm, boss, FIN };
})(window.BTB);
