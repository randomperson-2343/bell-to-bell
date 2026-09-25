// PATCH 3: 61-session story expansion.
//
// This file deliberately extends the shipped story instead of duplicating its
// moral-choice implementations. The legacy choices remain the single source of
// truth for their consequences; this layer moves them onto the thirteen-week
// calendar, adds the two new choices, and replaces the session table.
(function (B) {
  'use strict';
  const D = B.StoryData;
  const old = D.CHOICES;

  const ACTS = ['I · MELT-UP', 'II · TREMORS', 'III · CONTAGION', 'IV · RECKONING'];
  const actIndex = (d) => (d < 15 ? 0 : d < 30 ? 1 : d < 45 ? 2 : 3);
  const actOf = (d) => ACTS[actIndex(d)];
  const weekOf = (d) => Math.floor(d / 5) + 1;
  const dowOf = (d) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][d % 5];

  // Quotas follow the market regime instead of extrapolating forever. The desk
  // is most demanding at the false dawn and relents only when the system breaks.
  // V4.3 halved the whole table: at full height a careful trader who was right
  // two days in three was fired before the story's final decisions.
  const QUOTAS = [
    .0040,.0041,.0042,.0043,.0045,.0046,.0047,.0049,.0051,.0053,
    .0055,.0057,.0059,.0061,.0063,.0065,.0067,.0069,.0071,.0073,
    .0075,.0077,.0080,.0083,.0085,.0088,.0090,.0092,.0095,.0097,
    .0060,.0057,.0060,.0055,.0050,.0055,.0057,.0060,.0063,.0065,
    .0070,.0075,.0080,.0085,.0090,.0150,.0140,.0130,.0120,.0110,
    .0105,.0095,.0085,.0070,.0060,.0050,.0045,.0040,.0030,.0020,
    .0015
  ];

  const A = [
    [0, 'Your fill acknowledgements precede the exchange print by 0.4 milliseconds.'],
    [2, 'LATTICE-9 release notes list treasury and liquidity operations as an evaluation category.'],
    [15, 'The 4 a.m. research note has no human author. The byline resolves to a service account.'],
    [19, 'Bastion names its capacity counterparty only by a legal entity identifier.'],
    [23, 'The failed auction had one bidder. The bid was zero.'],
    [25, 'Every Meridian downgrade printed in the same minute after a model update overnight.'],
    [30, 'One participant bought continuously through the entire Loop.'],
    [32, 'The same four funds licensed the same base model.'],
    [38, 'Holloway Stern risk rejected the order before the submit message left your terminal.'],
    [43, 'The rally volume is perfectly even through lunch. Human markets are not.'],
    [49, 'Perry says Meridian\'s AAA stamps were reissued by the model after he left.'],
    [58, 'Sixty-one percent of your fills across every venue resolve to one legal entity identifier.']
  ];
  const anomalyByDay = {};
  A.forEach((x, i) => { anomalyByDay[x[0]] = { id: i + 1, text: x[1] }; });

  const LORE = [
    'Overnight futures edge higher as compute spending estimates rise again.',
    'A transit delay traps half the desk underground before the open.',
    'The weather app says rain. The sky over the financial district is already black.',
    'A celebrity engagement leads every non-financial feed.',
    'The city wins in overtime. Nobody on the train is watching the market.',
    'A paywalled column asks whether valuations have permanently changed.',
    'Firm email: personal devices must remain off the trading floor.',
    'Sqwak says the dip is cancelled. The post has forty thousand likes.',
    'A regional election dominates the front page below the fold.',
    'The Wire calendar lists three speeches and no expected policy changes.'
  ];

  const feedCount = (d) => d >= 58 ? 3 : d >= 26 ? 9 : d >= 21 ? 8 : d >= 15 ? 7 : d >= 10 ? 6 : d >= 5 ? 5 : 4;
  function feedFor(d, title, lead) {
    const out = [];
    if (lead) out.push({ source: 'THE WIRE', title, text: lead, kind: 'wire' });
    const an = anomalyByDay[d];
    if (an) out.push({ source: d % 2 ? 'FIRM FILE' : 'THE WIRE', title: 'Technical detail', text: an.text, kind: 'wire', anomalyId: an.id });
    const n = feedCount(d);
    for (let i = out.length; i < n; i++) {
      const text = LORE[(d * 3 + i * 7) % LORE.length];
      out.push({
        source: i % 4 === 1 ? 'SQWAK' : i % 5 === 3 ? 'FIRM EMAIL' : 'THE WIRE',
        title: i % 6 === 4 ? 'Subscriber only' : 'Before the bell',
        text: i % 6 === 4 ? 'This item is behind the firm subscription wall.' : text,
        kind: i % 4 === 1 ? 'chirp' : i % 5 === 3 ? 'mail' : 'wire',
        locked: i % 6 === 4
      });
    }
    return out.slice(0, n);
  }

  const daySpecs = [
    ['First Day on the Desk','melt', .002,.009,'LATTICE-9 ships. Fairline delays its quarterly filing.','The badge printer is still warm. Imani points at Fairline while the rest of the floor watches Corvus.'],
    ['Dead Air','melt', .001,.004,'No catalyst is scheduled. Futures are green anyway.','Nothing happens. Kroll still expects a number.'],
    ['Release Notes','melt', .001,.007,'Compute forecasts rise across the street.','The release notes are longer than the earnings deck and stranger in the footnotes.'],
    ['Demand Is Real','melt', .006,.012,'Thorncrest gaps higher on earnings.','Every analyst uses the same sentence: this time the demand is real.'],
    ['Ninety Billion','bubble', .002,.009,'Halcyon raises at a $90B valuation without product revenue.','The term sheet is treated like a national achievement.'],
    ['The Rumor','bubble', .004,.002,'A fake Ridgeway buyout rumor races ahead of its denial.','The lie is more fun than the correction, so the lie travels farther.'],
    ['The Auditor','bubble',-.002,.004,'Fairline\'s auditor resigns. The stock closes higher.','The first crack is administrative. The tape calls it bullish.'],
    ['Higher Floor','melt', .001,.006,'The desk raises quota on a quiet session.','There is no news. Kroll calls that an opportunity.'],
    ['Fourteen Billion','bubble', .002,.008,'Holloway Stern prices a record CASCADE deal.','A ship\'s bell rings fourteen times on the sales floor.'],
    ['Six Point Four','chop',-.001,-.004,'Consumer delinquencies hit 6.4%.','CASCADE remains AAA. Kroll waits beside your desk after the close.'],
    ['Still AAA','bubble', .002,.007,'Meridian affirms the entire CASCADE vintage.','The rating arrives before anyone finishes reading the delinquency report.'],
    ['Fairline Files','chop',-.004,.006,'Fairline files for protection. The index closes at a record.','A lender dies at noon. The closing bell sounds celebratory.'],
    ['The Strait','chop',-.006,-.002,'An incident in the Kavro Strait hits chips and lifts defense.','Political tension arrives only as color on the tape.'],
    ['Form Four','bear',-.003,-.012,'Fairline\'s chief executive sold 40% of his stake.','Perry calls with twenty-two seconds\' worth of illegal knowledge.'],
    ['Nothing Happened','recovery',-.030,.001,'A three-percent drop is fully recovered by the close.','The market learns the wrong lesson: every wound closes before dinner.'],
    ['A Circle','bear',-.008,-.018,'Thorncrest funded Halcyon, which spent the money on Thorncrest chips.','Both firms booked the same dollars as proof of demand.'],
    ['Standard Partnerships','recovery', .010,.015,'Thorncrest denies the circular-financing report.','The denial is shorter than the footnotes and moves more money.'],
    ['Cancelled','bear',-.004,-.015,'Halcyon cancels three datacenter commitments.','Nobody says why all three contracts used the same exit clause.'],
    ['The Physical World','bear',-.006,-.018,'Grid operators reject gigawatt-scale interconnects.','The bubble meets copper, turbines and four-year queues.'],
    ['Nineteen Percent','bear',-.008,-.020,'Bastion says 19% of contracted capacity may never energize.','Thorne\'s office needs an answer before Monday.'],
    ['Freedom','melt', .006,.013,'The Compute Freedom Act reprices leverage across the street.','The law changes the size of every future mistake.'],
    ['The High','melt', .008,.016,'The index prints an all-time high.','The screen is green enough to erase every warning beneath it.'],
    ['Page Fourteen','chop', .001,.003,'Ambervale raises reserves in a filing footnote.','The number is buried where almost nobody taps.'],
    ['Zero Bid','panic',-.004,-.016,'Two CASCADE tranches fail to find a price.','One bidder attends. Its bid is zero.'],
    ['Green Close','recovery',-.003,.006,'The index closes green after the failed auction.','The cruelest session is the one that looks normal.'],
    ['One Vintage','chop',-.005,-.010,'Meridian downgrades $5B and affirms everything else.','The agency treats contagion like a clerical boundary.'],
    ['Circling','bear',-.006,-.014,'Four desks circle Ridgeway\'s weakest funding.','Predators recognize the limp before television does.'],
    ['Lines Pulled','bear',-.010,-.022,'Counterparties pull Ridgeway credit lines late.','Funding disappears one polite call at a time.'],
    ['The Pack','panic',-.006,-.025,'A coordinated raid forms around Ridgeway.','Greta Vail offers a place in the pack and twenty seconds to decide.'],
    ['Distribution','chop', .000,-.003,'Flat tape. Heavy volume. No explanation.','The price does not move. Ownership does.'],
    ['The Loop','panic',-.018,-.085,'Shared models sell into their own signal.','At 11:15 the market becomes an echo chamber with prices attached.'],
    ['Systems Normal','chop', .006,-.006,'Exchanges report normal operations.','Nothing is repaired. It is simply no longer the newest emergency.'],
    ['Same Model','chop',-.003,-.012,'Volatility remains while attention moves on.','Imani names the four funds and the one model beneath them.'],
    ['The Queue','panic',-.028,-.060,'Ridgeway misses a funding call and a branch queue forms.','The camera crew creates the run it came to document.'],
    ['All Options','bear',-.012,-.025,'Officials say all options remain on the table.','Venn has been awake thirty-one hours. The weekend decides.'],
    ['Monday Gap','panic',-.035,-.045,'The market prices the rescue decision.','Ambervale is cut three notches either way.'],
    ['Twenty-Two','bear',-.008,-.020,'HLST defends marks that no trader believes.','The committee wants your signature on a price that is not a price.'],
    ['Five and a Half','bear',-.005,-.015,'The buyer gets 75% non-recourse financing.','At risk: roughly five and a half cents against a headline mark of twenty-two.'],
    ['Lanyards','chop',-.004,-.010,'Auditors move desk to desk.','People who do not work here open files nobody here wanted opened.'],
    ['The Inquiry','bear',-.010,-.028,'A formal CASCADE inquiry begins. Corvus cuts capex.','Riverbend lawyers arrive with arithmetic and names.'],
    ['The Bottom','recovery',-.012,.002,'The market stops falling without an announcement.','There is no good news. That is not required for a bottom.'],
    ['No Headline','recovery', .002,.018,'The false dawn begins.','The first green session is small enough to trust.'],
    ['A Little Better','recovery', .001,.020,'Credit spreads narrow by a fraction.','Nobody rings a bell. Relief enters through posture.'],
    ['Perfect Volume','recovery', .001,.021,'The rally continues on mechanically even volume.','The machines do not take lunch.'],
    ['Over','recovery', .002,.022,'The desk agrees the crisis is over.','Kroll buys dinner. Monday\'s quota is already waiting.'],
    ['Make It Back','recovery', .004,.022,'Quota spikes as the rally continues.','The desk mandate is simple: make it back, and make it back now.'],
    ['Nobody Cares','recovery', .003,.021,'Sana\'s investigation lands on nothing.','Nine thousand words vanish beneath a green index.'],
    ['Twenty Percent','recovery', .002,.020,'The index nears twenty percent above the low.','The short book bleeds without the mercy of a gap.'],
    ['The Top','recovery', .001,.018,'The rally tops without a headline.','False hope does not announce its final hour.'],
    ['The Footnote','bear',-.002,-.008,'The grind down begins.','Imani hands you one last footnote. Perry leaves a final voicemail.'],
    ['Slow Damage','bear',-.003,-.010,'The decline continues without being called a crash.','Loss arrives too slowly for sirens.'],
    ['The Hearing','panic',-.006,-.022,'Thorne holds up the circular CASCADE structure on every screen.','Meridian withdraws ratings on the whole vintage.'],
    ['Four Votes','bear',-.004,-.015,'The Stabilization Act is four votes short.','The phones start before the close and do not stop overnight.'],
    ['The One They Leave','panic',-.025,-.065,'A systemically important firm is not rescued.','The largest drop of the run is treated as a clearing event.'],
    ['Breaks the Buck','panic',-.020,-.055,'A money fund breaks the buck. Financial shorts are banned.','Cash itself develops a price.'],
    ['The Failed Vote','panic',-.030,-.090,'The Stabilization Act fails at 2:00 p.m.','Sirens, screen shake, and the arithmetic Thorne warned about.'],
    ['Hope','recovery', .025,.050,'The vote passes.','For one session everyone believes the rescue changed the ending.'],
    ['The Offer','panic',-.012,-.040,'The rescue is priced in and selling resumes.','Imani waits in the stairwell with five exits and no safe choice.'],
    ['One Counterparty','panic',-.025,-.070,'The market falls through the rescue.','Almost every fill points back to the same hidden counterparty.'],
    ['Worst Session','panic',-.040,-.110,'The index suffers its worst session.','The machines go still only after the market closes.'],
    ['Orphan Monday','panic',-.060,-.140,'The market opens for the final time.','Whatever is in the book at four is what remains.']
  ];

  const specialEvents = {
    0: [D.ev(40,'Corvus ships LATTICE-9; compute shares surge',[['ticker','CRVS',.055,.4],['sector','chip',.02]]), D.ev(330,'Fairline delays its quarterly filing',[['ticker','FRLN',-.05,.3]])],
    5: [Object.assign(D.chirp(115,'BREAKING?? $RDGW buyout at a forty percent premium. source: my uncle','@CallsOnlyCarl'), { fake: true }), D.ev(150,'Ridgeway denies it is in takeover talks',[['ticker','RDGW',-.012]])],
    9: [D.ev(235,'Consumer delinquencies print 6.4%; CASCADE vintage remains AAA',[['sector','lender',-.035,.3],['sector','bank',-.012]])],
    11:[D.ev(190,'Fairline files for bankruptcy protection',[['ticker','FRLN',-.35,.2],['sector','lender',-.035]])],
    13:[D.ev(310,'Fairline chief executive sold 40% of his stake before the filing',[['ticker','FRLN',-.07,.3]])],
    15:[D.ev(15,'Research note documents circular financing between Thorncrest and Halcyon',[['ticker','THSI',-.05,.3],['ticker','HALO',-.09,.4]],{big:true})],
    18:[D.ev(25,'Three grid operators reject gigawatt-scale interconnect requests',[['sector','dc',-.04,.3],['sector','power',.02]],{big:true})],
    19:[D.ev(170,'Bastion says 19% of contracted capacity may never energize',[['ticker','BSTN',-.08,.4],['sector','dc',-.03]])],
    21:[D.ev(270,'INDEX CLOSES AT NEW ALL-TIME HIGH',[['market','',.008,.2]],{big:true})],
    23:[D.ev(140,'Two CASCADE tranches fail at auction; no executable bid exists',[['sector','bank',-.045,.4],['sector','dc',-.035]],{big:true})],
    27:[D.ev(230,'Counterparties pull Ridgeway intraday credit lines',[['ticker','RDGW',-.12,.4],['sector','bank',-.025]])],
    30:[D.ev(105,'AUTONOMOUS EXECUTION LOOP CASCADES ACROSS FOUR FUNDS',[['market','',-.09,.5],['sector','ai',-.08,.3]],{big:true,script:'loop'}), D.ev(175,'Index violently reverses from session low',[['market','',.07,.5],['sector','ai',.045]])],
    33:[D.ev(75,'Ridgeway fails funding call and halts limit down',[['ticker','RDGW',-.28,.3],['sector','bank',-.055]],{big:true})],
    39:[D.ev(250,'Formal inquiry opened into CASCADE valuations',[['ticker','HLST',-.08,.3],['sector','bank',-.04]],{big:true})],
    51:[D.ev(150,'Meridian withdraws ratings on the entire CASCADE vintage',[['sector','bank',-.07,.3],['sector','dc',-.06]],{big:true})],
    55:[D.ev(270,'STABILIZATION ACT FAILS FOUR VOTES SHORT',[['market','',-.09,.7]],{big:true,script:'voteFail'})],
    56:[D.ev(90,'STABILIZATION ACT PASSES ON SECOND VOTE',[['market','',.05,.4]],{big:true,script:'votePass'})],
    57:[D.ev(250,'Rescue rally fails; broad selling resumes',[['market','',-.04,.3]],{big:true})],
    58:[D.ev(210,'Market falls seven percent despite enacted guarantee',[['market','',-.07,.5]],{big:true})],
    59:[D.ev(190,'INDEX RECORDS WORST SESSION IN ITS HISTORY',[['market','',-.11,.6]],{big:true,script:'worstSession'})],
    60:[D.ev(80,'FINAL SESSION: LIQUIDITY VANISHES ACROSS EVERY VENUE',[['market','',-.14,.7],['sector','bank',-.12],['sector','ai',-.10]],{big:true,script:'finalSession'})]
  };

  function defaultEvents(d, target) {
    const dir = target >= 0 ? 1 : -1;
    const sectors = dir > 0 ? ['ai','chip','dc'] : ['bank','lender','dc'];
    return [
      D.ev(85, dir > 0 ? 'Risk appetite builds after the open' : 'Credit spreads widen after the open', [['market','',dir * Math.min(.006, Math.abs(target) / 3),.2]]),
      D.ev(260, dir > 0 ? 'Compute complex leads the afternoon tape' : 'CASCADE-linked names lag into the close', [['sector',sectors[d % sectors.length],dir * .012,.25]])
    ];
  }

  const DAYS = daySpecs.map((x, d) => {
    const title = x[0], regime = x[1], gap = x[2], target = x[3], lead = x[4], brief = x[5];
    const item = {
      title,
      feed: feedFor(d, title, lead),
      brief: (S) => {
        const p = [`<b>Week ${weekOf(d)} · ${dowOf(d)}.</b> ${brief}`];
        if (d === 10 && S.f.dumped) p.push('Riverbend owns the paper now. Your bonus cleared before breakfast.');
        if (d === 15 && S.f.insiderTraded) p.push('Compliance wants the chronology of your CASCADE positions in writing.');
        if (d === 35) p.push(S.f.bailout ? 'Ridgeway opens inside a public guarantee.' : 'Ridgeway opens without a public guarantee.');
        if (d === 55) p.push(S.f.whipped ? 'You spent the weekend working every reachable vote.' : S.f.whippedAgainst ? 'You spent the weekend working against the rescue.' : 'You let the vote arrive without using your influence.');
        if (d === 60 && S.f.pulledPlug) p.push('The automated stack is dead. Your book was flattened into a forty-percent opening gap. The market is human again, and almost empty.');
        return p;
      },
      scen: (S) => {
        let g = gap, t = target;
        if (d === 20) { const boost = S.f.dereg ? .012 : S.f.regulation ? -.004 : .004; g += boost; t += boost; }
        if (d === 35) { const rescue = S.f.bailout ? .03 : -.035; g += rescue; t += rescue / 2; }
        if (d === 60 && S.f.pulledPlug) { g = -.40; t = -.32; }
        let events = (specialEvents[d] || defaultEvents(d, t)).slice();
        if (d === 56 && !S.f.billPassed) {
          g = -.018; t = -.035;
          events = [D.ev(90,'SECOND STABILIZATION VOTE FAILS; CREDIT MARKETS REMAIN SHUT',[['market','',-.035,.4]],{big:true,script:'voteFail'})];
        }
        if (d === 60 && S.f.pulledPlug) {
          events.unshift(D.ev(0,'AUTOMATED EXECUTION STACK DISCONNECTED BEFORE THE OPEN',[],{big:true,script:'pullFlatten'}));
        }
        return { regime, market: { gap: g, target: t }, events };
      },
      inbox: () => []
    };
    return item;
  });

  // Intraday choices remain timed. Everything else resolves after the Friday
  // session named in the design notes (or at the specified session close).
  DAYS[13].calls = (S) => S.choices.c2 ? [] : [{
    t: 150, scripted: true, kind: 'choice', choiceId: 'c2', timer: 22,
    from: 'Perry Nakash', role: 'Senior Analyst, Meridian Ratings',
    text: 'The CASCADE committee met. Current vintage goes on downgrade watch Monday. I should not be telling you this.',
    options: [{id:'trade',label:'Thank him. Short the stack.'},{id:'ignore',label:'You never took this call.'},{id:'warn',label:'Tell him to file it.'}], defaultOpt: 'ignore'
  }];
  DAYS[28].calls = (S) => S.choices.c4 ? [] : [{
    t: 130, scripted: true, kind: 'choice', choiceId: 'c4', timer: 20,
    from: 'Greta Vail', role: 'Kestrel Point',
    text: 'Four desks are leaning on Ridgeway at once. We can finish it before the close. Are you in the pack or in the way?',
    options: [{id:'join',label:'Join the raid.'},{id:'refuse',label:'Trade your own book.'},{id:'tell',label:'Warn Ridgeway.'}], defaultOpt: 'refuse'
  }];

  const choices = {
    c1: old.c1,
    c2: old.c2,
    c3: old.c3,
    c4: old.c4,
    c5: old.c5,
    c6: old.c6,
    c7: {
      day: 37, speaker: 'Desmond Kroll', role: 'Head of Trading, Holloway Stern', title: 'The Marks · The Addendum', kicker: 'DECISION 7',
      text: [
        'The buyer accepted twenty-two cents. Legal slides an addendum across the table.',
        'Holloway Stern will finance seventy-five percent of the purchase, non-recourse, secured only by the CASCADE paper itself.',
        'The headline says twenty-two. The money actually at risk says five and a half. Sign the financing, refuse it, or expose the whole transaction.'
      ],
      options: [
        { id:'finance', label:'Fund the buyer.', hint:'Preserve the headline mark. Own the hidden risk.', headline:'Approved non-recourse financing behind the CASCADE sale', apply:(S)=>{S.f.financedBuyer=true;S.f.fraud=true;D.adj(S,{integrity:-16,heat:15,firm:14,stability:-7},{kroll:12,imani:-10});}, reply:'Kroll: "Now it is a transaction."', after:['You sign. The paper leaves the building and most of its risk stays behind.','The press release says twenty-two cents. Nobody prints five and a half.'] },
        { id:'refuse', label:'Refuse the financing.', hint:'The sale collapses and the mark becomes visible.', headline:'Refused to finance the buyer of Holloway Stern\'s CASCADE book', apply:(S)=>{S.f.refusedFinancing=true;D.adj(S,{integrity:12,firm:-18,stability:-3},{kroll:-18,imani:12});}, reply:'Kroll: "Then there is no buyer."', after:['The buyer walks before the ink dries.','Twenty-two was never a price. Without your loan it is only a sentence in a press release.'] },
        { id:'expose', label:'Send the addendum to Sana.', hint:'Prove the public mark was fiction.', headline:'Exposed the hidden financing behind the CASCADE sale', apply:(S)=>{S.f.exposedFinancing=true;S.f.public=true;S.f.reported=true;D.adj(S,{integrity:24,heat:-8,firm:-28,stability:6,anger:8},{sana:25,kroll:-35,imani:15});}, reply:'Sana: "This changes the whole story."', after:['The addendum reaches Sana before legal notices it is missing.','By morning, everybody can do the five-and-a-half-cent arithmetic.'] }
      ]
    },
    c8: old.c7,
    c9: old.c8,
    c10: {
      day: 59, speaker: 'Imani Rhodes', role: 'Senior Trader · your mentor', title: 'Pull the Plug', kicker: 'DECISION 10',
      req: (S) => (S.anomalies || 0) >= 8,
      text: [
        'The market is closed. For the first time all week, the machines are still.',
        'Imani has mapped the common execution layer behind the fills. Killing Holloway Stern\'s access token will force the other systems to reject the shared counterparty at Monday\'s open.',
        'It will also flatten your book into whatever price exists first. The market may survive. Your money will not.'
      ],
      options: [
        { id:'pull', label:'Pull the plug.', hint:'Save price discovery. Lose the book.', headline:'Disabled the shared automated execution stack before the final open', apply:(S)=>{S.f.pulledPlug=true;S.f.public=true;D.adj(S,{integrity:22,stability:30,firm:-35},{imani:25,kroll:-40});}, reply:'Imani: "Do it before you can talk yourself out of it."', after:['The token dies at 3:17 AM.','At 9:30 the book is flattened into a forty-percent gap. The exchange halts the market for the day. Human bids come back on Tuesday.'] },
        { id:'leave', label:'Leave it running.', hint:'Keep the book. Trust a market with no human loop.', headline:'Left the shared automated execution stack running', apply:(S)=>{S.f.leftStack=true;D.adj(S,{integrity:-12,stability:-18},{imani:-20,kroll:8});}, reply:'Imani: "Then whatever opens Monday is not a market."', after:['You close the laptop.','Across the street, identical systems wait for the same opening print.'] }
      ]
    }
  };

  choices.c1.day = 9;
  choices.c2.day = 13;
  choices.c3.day = 19;
  choices.c4.day = 28;
  choices.c5.day = 34;
  choices.c6.day = 36;
  choices.c8.day = 54;
  choices.c8.kicker = 'DECISION 8';
  choices.c9.day = 57;
  choices.c9.kicker = 'DECISION 9';
  const billNo = choices.c3.options.find((o) => o.id === 'no');
  if (billNo && billNo.after) billNo.after = billNo.after.map((x) => x.replace('Two months from now', 'Long after the vote'));
  const treasury = choices.c9.options.find((o) => o.id === 'treasury');
  if (treasury) {
    treasury.req = (S) => S.m.influence >= 34 && S.rel.venn >= 35;
    if (treasury.after) treasury.after = treasury.after.map((x) => x.replace('spent a month trading', 'spent the campaign trading'));
  }

  const refusedMarks = choices.c6.options.find((o) => o.id === 'refuse');
  if (refusedMarks) {
    const apply = refusedMarks.apply;
    refusedMarks.apply = (S) => { apply(S); S.f.externalFraud = true; };
  }

  // The original meter deltas were tuned for eight choices in fifteen sessions.
  // Preserve every flag, relationship beat and cash consequence, while reducing
  // meter movement so a sixty-one-session campaign cannot peg by Act III.
  ['c1','c2','c3','c4','c5','c6','c8','c9'].forEach((id) => {
    choices[id].options.forEach((opt) => {
      const apply = opt.apply;
      opt.apply = (S) => {
        const before = Object.assign({}, S.m);
        apply(S);
        for (const k in before) S.m[k] = B.clamp(before[k] + (S.m[k] - before[k]) * 0.58, 0, 100);
      };
    });
  });

  // Your boss's patience is the one relationship that can end the career, so
  // a single decision can dent it but not zero it: losses to Kroll are halved.
  Object.keys(choices).forEach((id) => {
    choices[id].options.forEach((opt) => {
      const apply = opt.apply;
      opt.apply = (S) => {
        const k0 = S.rel.kroll;
        apply(S);
        if (S.rel.kroll < k0) S.rel.kroll = B.clamp(k0 + (S.rel.kroll - k0) * 0.5, 0, 100);
      };
    });
  });

  // The ten decision labels are UI truth. Legacy ids only remain in comments and
  // migration code, never in player-facing copy.
  Object.keys(choices).forEach((id, i) => {
    if (id !== 'c9' && id !== 'c10') choices[id].kicker = `DECISION ${i + 1}`;
  });

  D.DAYS = DAYS;
  D.CHOICES = choices;
  D.QUOTAS = QUOTAS;
  D.ACTS = ACTS;
  D.actIndex = actIndex;
  D.actOf = actOf;
  D.weekOf = weekOf;
  D.dowOf = dowOf;
  D.ANOMALIES = A;
})(window.BTB);
