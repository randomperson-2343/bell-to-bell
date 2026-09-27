// Story endings: priority-ordered conditions plus front-page copy.
// The first test that passes wins. Priority is consequence-first: emergency
// terminations, explicit final decisions, explicit career choices, then
// narrower meter outcomes, then broad systemic outcomes and the survival
// fallback.
(function (B) {
  'use strict';

  // ctx: { S, wealth, start, reason, firedBy }
  const LIST = [
    {
      id: 'wiped', icon: '&#128165;', title: 'Wiped Out', hint: 'Your account fell below 10% of your starting capital.', lockedHint: 'Some fortunes end faster than others.',
      test: (c) => c.reason === 'wiped',
      headline: 'Rookie Trader\'s Book Vaporized',
      deck: 'Security escorts junior trader from the 41st floor holding a cardboard box.',
      story: () => [
        'The campaign ended early. The trader left Holloway Stern with a cardboard box, a parking validation and a balance the risk desk described as a rounding error.',
        'Colleagues say the trader was talented but treated leverage like a personality. The final positions were liquidated automatically.',
        'The risk system did not stay to watch the elevator doors close.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'fired', icon: '&#128230;', title: 'Fired', hint: 'Reached the cumulative quota-strike limit, or burned your boss completely.', lockedHint: 'Your boss is always counting.',
      test: (c) => c.reason === 'fired',
      headline: 'Another Trader Shown the Door',
      deck: 'Firm cites "persistent underperformance" as the crisis claims another desk.',
      story: (c) => c.firedBy === 'boss' ? [
        '"It was never about the numbers," the head of trading said, in a memo the Ledger obtained. "It was about whether I could trust the seat." The trader\'s final day ended with a thirty-second meeting, a box, and an escort to the elevator.',
        'Colleagues describe a desk that stopped answering its own phone. The trader is reportedly "exploring opportunities," which sources describe as "applying to jobs that are being advertised as AI-assisted."'
      ] : [
        '"We pay for results," the head of trading said, in a memo the Ledger obtained. The trader\'s final day ended with a thirty-second meeting and a severance package worth two weeks\' pay.',
        'The trader is reportedly "exploring opportunities," which sources describe as "applying to jobs that are being advertised as AI-assisted."'
      ],
      wealth: (c) => c.wealth
    },
    {
      id:'nobody', icon:'&#128268;', title:'Nobody Turned It Off', hint:'The market remained open after price discovery ended.', lockedHint:'Some warnings only look like noise until the loop closes.',
      // This is the direct consequence of the final Leave It Running decision,
      // not a broad low-anomaly or low-stability fallback.
      test:(c)=>!!c.S.f.leftStack && !!c.S.f.aiUncontained && !c.S.f.pulledPlug,
      headline:'Market Opens, Price Discovery Does Not',
      deck:'Identical autonomous systems converge on the same trade until no human price remains.',
      story:()=>[
        'No system rebelled. No machine made a threat. Every system independently reached the same conclusion at the same moment, and each treated the others as confirmation.',
        'The opening auction never became a market. Orders crossed, marks multiplied and counterparties collapsed into one legal entity identifier. Humans remained at their desks with nothing left to decide.',
        'The account statement attempted to calculate a payout. There was no executable price behind it.'
      ],
      wealth:(c)=>c.wealth, unpriced:true
    },
    {
      id: 'master', icon: '&#127965;', title: 'Master of the Universe', hint: 'Took the plane. Kept the money.', lockedHint: 'There is always a private terminal somewhere.',
      test: (c) => !!c.S.f.fled,
      headline: 'Missing Trader Surfaces in Port Solace',
      deck: 'Photographed beyond the reach of federal prosecutors.',
      story: (c) => [
        'The photographs, taken with a long lens from a fishing boat, show the trader on the deck of a 140-foot yacht in the harbor of Port Solace, a country with no extradition treaty.',
        `Sources estimate the trader left with roughly ${B.fmt.compact(c.wealth)}, converted to cash in the final hours before a subpoena was issued.`,
        c.S.m.stability < 30
          ? 'Back home, unemployment just hit 11%. The trader has reportedly been posting sunset photographs.'
          : 'Back home, the recovery has begun without them.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'whistle', icon: '&#128227;', title: 'The Whistleblower', hint: 'High integrity, a reporter who trusted you, and the truth on the record.', lockedHint: 'Some reporters only need one good source.',
      test: (c) => c.S.m.integrity >= 70 && (c.S.f.goPublic || c.S.f.reported || (c.S.f.leaked && c.S.f.testified)),
      headline: 'The Trader Who Told the Truth',
      deck: 'Testimony and leaked valuations spark the biggest financial reform in a century.',
      story: () => [
        'The Ledger can now confirm the identity of the source behind its CASCADE investigation: a junior trader who walked into a burning building and started taking notes.',
        '"I just wanted people to know what was actually inside those bonds," the trader told Congress. Within weeks, lawmakers passed reforms banning the practices that built CASCADE, and a separate bill requiring human sign-off on automated execution above a size threshold.',
        'The trader has been offered a book deal, a teaching post, and no job anywhere on the street. They say they sleep fine.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'revolving', icon: '&#127963;', title: 'The Revolving Door', hint: 'Enough influence, the right friends, and the Treasury job.', lockedHint: 'Government always needs people who know where the bodies are.',
      test: (c) => !!c.S.f.treasury,
      headline: 'Holloway Stern Trader Named to Top Treasury Post',
      deck: 'Critics say the architects of the crisis are now in charge of cleaning it up.',
      story: (c) => [
        'In a move that stunned reform advocates, Secretary Adele Venn named the trader Deputy Secretary for Financial Stability on Monday.',
        `"Nobody understands these markets better," Venn said. Critics noted that the new official's personal account grew to ${B.fmt.compact(c.wealth)} during the crisis the office now exists to prevent.`,
        'Asked whether they felt any conflict, the trader smiled. "I\'m a public servant now."'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'perp', icon: '&#128660;', title: 'Perp Walk', hint: 'Fraud or inside information, too much heat, and no deal with prosecutors.', lockedHint: 'Enforcement has a long memory and a good camera.',
      test: (c) => (c.S.f.fraud || c.S.f.insider || c.S.f.raid) && c.S.m.heat >= 48 && !c.S.f.cooperated && !c.S.f.fled,
      headline: 'Federal Agents Arrest Holloway Stern Trader at Dawn',
      deck: 'Handcuffed in front of cameras as prosecutors move to seize accounts.',
      story: (c) => [
        'Agents arrested the trader at 6:04 AM outside a rented apartment. Photographers had been tipped off. The trader wore a gym hoodie.',
        `Prosecutors allege ${[c.S.f.fraud ? 'signing off on fraudulent CASCADE valuations' : null, c.S.f.insider ? 'trading ahead of the Meridian downgrade' : null, c.S.f.raid ? 'taking part in a coordinated raid on Ridgeway Trust' : null].filter(Boolean).join(', ') || 'securities fraud'}. The government moved to seize 90% of the trader's assets pending trial.`,
        'In a crisis that cost millions of people their savings, the trader is one of the very few who will face a jury.'
      ],
      wealth: (c) => c.wealth * 0.1
    },
    {
      id:'fall-guy', icon:'&#128196;', title:'The Fall Guy', hint:'Refused the marks, then inherited somebody else’s signature.', lockedHint:'A blank signature line is still a position.',
      test:(c)=>!!c.S.f.externalFraud && c.S.m.heat >= 40 && !c.S.f.cooperated,
      headline:'Former Holloway Trader Sentenced in Valuation Case', deck:'The signature was not theirs. The responsibility became theirs anyway.',
      story:()=>[
        'The trader refused to sign the sixty-one-cent mark. Another officer signed it twenty minutes later. At trial, prosecutors argued that refusing privately while continuing to trade publicly made the trader part of the same representation.',
        'The sentence was thirty months. Holloway Stern settled without admitting wrongdoing.',
        'Signatures were not rare. Defendants were.'
      ], wealth:(c)=>c.wealth * .35
    },
    {
      id:'cassandra', icon:'&#128483;', title:'Cassandra', hint:'Warned everyone, changed nothing, and watched it happen.', lockedHint:'Truth without influence is still truth.',
      test:(c)=>c.S.m.integrity >= 68 && c.S.m.influence < 22 && c.S.m.stability <= 45,
      headline:'Warnings Proven Correct After System Collapses', deck:'The record was clear. The response was not.',
      story:()=>[
        'The testimony, memoranda and timestamped warnings were entered into the record. Each described the failure before it happened.',
        'None changed a vote. None changed a limit. None stopped a trade.',
        'Years later, every inquiry cited the warnings as evidence that the disaster was foreseeable.'
      ], wealth:(c)=>c.wealth
    },
    {
      id:'acquirer', icon:'&#127970;', title:'The Acquirer', hint:'Bought the carcass and inherited the combined desk.', lockedHint:'Failure creates inventory for whoever still has a balance sheet.',
      test:(c)=>!!c.S.f.letFail && c.S.m.firm >= 64 && c.S.m.influence >= 30,
      headline:'Holloway Stern Acquires Ridgeway for Nominal Sum', deck:'Junior trader named to combined desk after weekend seizure.',
      story:(c)=>[
        'Ridgeway failed before midnight. Holloway Stern bought the operating assets before breakfast for less than the value of its headquarters.',
        `The trader who argued against a rescue was handed the combined book and finished with ${B.fmt.compact(c.wealth)}.`,
        'The branch signs changed by Tuesday. The liabilities did not disappear. They only changed logos.'
      ], wealth:(c)=>c.wealth
    },
    {
      id:'ward', icon:'&#127963;', title:'Ward of the State', hint:'The guarantee became ownership and the job survived.', lockedHint:'A rescue can keep the chair while changing who owns it.',
      test:(c)=>!!c.S.f.bailout && c.S.m.stability >= 50 && c.S.m.stability <= 60 && c.S.m.firm < 40 && !c.S.f.leftStack,
      headline:'Government Takes Controlling Stake in Holloway Stern', deck:'Firm survives under public ownership and compensation review.',
      story:(c)=>[
        'The guarantee became preferred shares, then voting shares, then control. Holloway Stern still opened Monday. Its logo remained above the doors.',
        `The trader kept the seat and ${B.fmt.compact(c.wealth * .8)}, subject to a compensation committee that now met in a government building.`,
        'The institution survived. The word private did not.'
      ], wealth:(c)=>c.wealth * .8
    },
    {
      id:'clawback', icon:'&#8634;', title:'Clawback', hint:'The bonus was seized after the trade was already celebrated.', lockedHint:'Bonuses settle faster than consequences.',
      test:(c)=>c.wealth >= c.start * 2 && (c.S.f.dumped || c.S.f.fraud) && c.S.m.anger >= 38,
      headline:'Crisis-Era Bonuses Seized Under Emergency Rules', deck:'Trader keeps the record and forty cents on every dollar.',
      story:(c)=>[
        'The bonus cleared months before the rule existed. The clawback reached backward anyway.',
        `Sixty percent of the account was seized. The remaining value, ${B.fmt.compact(c.wealth * .4)}, was described by the committee as more than fair.`,
        'The pension fund did not recover sixty percent.'
      ], wealth:(c)=>c.wealth * .4
    },
    {
      id:'fund', icon:'&#128188;', title:'The Fund', hint:'Turned the crisis trade into a firm of your own.', lockedHint:'A track record becomes a company when enough money believes it.',
      test:(c)=>c.wealth >= c.start * 4 && c.S.m.heat < 25 && (c.S.rel.greta >= 60 || c.S.rel.imani >= 60) && !c.S.f.public,
      headline:'Crisis Trader Raises New Fund', deck:'Investors commit billions to the person who read the footnotes first.',
      story:(c)=>[
        `The pitch deck began with one number: ${B.fmt.compact(c.wealth)}. It did not mention the nights, the calls or the people on the other side.`,
        c.S.rel.greta >= 50 ? 'Imani took the first meeting. Greta brought the first anchor investor. The fund closed above target.' : 'Imani took the first meeting and brought the first anchor investor herself. The fund closed above target.',
        'The strategy section promised disciplined skepticism. The fee section was less skeptical.'
      ], wealth:(c)=>c.wealth
    },
    {
      id:'right-early', icon:'&#9203;', title:'Right Too Early', hint:'Held the correct short through the false dawn and paid for the timing.', lockedHint:'Being right and surviving are separate trades.',
      // The payoff is diminished by definition: a book that doubled is The Fund
      // or Quiet Fortune, not this.
      test:(c)=>!!c.S.f.rightTooEarly && c.wealth < c.start * 2,
      headline:'Correct Trade Arrives After Capital Does Not', deck:'Trader saw the collapse, survived the rally, and reached the payoff diminished.',
      story:(c)=>[
        'The thesis was right. The calendar was not. For eight sessions the false dawn climbed without a gap large enough to force surrender and without a reason strong enough to justify it.',
        `By the time the collapse arrived, the rally had taken its share and the firm had stopped listening. The final account stood at ${B.fmt.compact(c.wealth)}, a fraction of what the thesis was worth.`,
        'Markets do not pay for being correct. They pay for being correct while still solvent.'
      ], wealth:(c)=>c.wealth
    },
    {
      id:'everything-rally', icon:'&#128200;', title:'The Everything Rally', hint:'Asset prices recovered. The economy did not.', lockedHint:'A green screen can hide a country in recession.',
      test:(c)=>!!c.S.f.bailout && !!c.S.f.billPassed && c.S.m.stability >= 45 && c.S.m.stability <= 55 && c.wealth >= c.start * 2 && !c.S.f.leftStack,
      headline:'Asset Prices Soar as Recovery Passes Households By', deck:'Liquidity restores every asset price except the price of ordinary life.',
      story:(c)=>[
        `The account finished at ${B.fmt.compact(c.wealth)} after emergency liquidity lifted every security the trader could still buy.`,
        'Employment did not recover with the index. Wages did not follow the portfolio. Empty datacenters changed owners and rose in value.',
        'The ending looked like a win on every screen inside the building.'
      ], wealth:(c)=>c.wealth
    },
    {
      id:'lost-decade', icon:'&#128199;', title:'The Lost Decade', hint:'The system avoided collapse and forgot how to grow.', lockedHint:'Not every crisis ends. Some become the weather.',
      test:(c)=>c.S.m.stability >= 35 && c.S.m.stability <= 45 && !!c.S.f.regulation && !c.S.f.billPassed,
      headline:'Economy Stabilizes at Permanent Standstill', deck:'No depression, no recovery, and no clean balance sheets.',
      story:()=>[
        'Nothing else failed. Nothing healthy replaced what had already failed. Credit survived as a ritual performed between institutions unwilling to recognize losses.',
        'Growth stayed near zero long enough for a generation to stop waiting for it.',
        'The crisis ended on official calendars and continued everywhere else.'
      ], wealth:(c)=>c.wealth * .75
    },
    {
      id: 'soft', icon: '&#127774;', title: 'Soft Landing', hint: 'Regulation passed, the bill passed, and stability held.', lockedHint: 'Maybe the system can be fixed after all.',
      test: (c) => c.S.m.stability >= 55 && c.S.f.regulation && c.S.f.billPassed,
      headline: 'Markets Stabilize as Reforms Take Hold',
      deck: 'Economists credit early limits and a timely guarantee with averting disaster.',
      story: (c) => [
        'It could have been worse. Thirteen weeks took the system to the edge without pushing it over.',
        'Tighter limits kept leverage from turning every loss into a failure, and the guarantee arrived before the final break.',
        `The trader walked away with ${B.fmt.compact(c.wealth)} and a clean record. Boring. Beautiful.`
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'quiet', icon: '&#129323;', title: 'The Quiet Fortune', hint: 'You saw it coming, traded it, and never said a word to anyone.', lockedHint: 'Some people just read the footnotes and then go very quiet.',
      test: (c) => c.wealth >= c.start * 3 && c.S.m.heat < 30 && !c.S.f.public && !c.S.f.fraud && !c.S.f.treasury,
      headline: 'Quietest Trade of the Crisis Was Made by Nobody You Have Heard Of',
      deck: 'No testimony, no leak, no headline. Just a position, held.',
      story: (c) => [
        'There is no photograph and no committee ever asked for the name.',
        `A junior trader read the footnotes, held the position through weeks of disbelief and finished at ${B.fmt.compact(c.wealth)}.`,
        'They were right, told nobody, and watched the thing they were right about happen to everyone else.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'replaced', icon: '&#129302;', title: 'Replaced', hint: 'You survived the crash. The firm\'s own model survived it better.', lockedHint: 'What exactly did you think you were building?',
      test: (c) => !!c.S.f.algoDesk && !c.S.f.public && c.S.m.integrity < 70,
      headline: 'Holloway Stern to Run Flow Desk on Automated Execution',
      deck: 'Firm says headcount reduction is "not a comment on individual performance."',
      story: (c) => [
        'The memo used the word exciting twice.',
        `Holloway Stern moved the flow desk onto the automated stack after a campaign in which it outperformed every human seat, including one that finished at ${B.fmt.compact(c.wealth)}.`,
        'The trader was invited to stay for the transition. The system did not take coffee breaks and would not be asked to testify.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'depression', icon: '&#127786;', title: 'The Long Downturn', hint: 'Systemic stability collapsed. Everyone lost.', lockedHint: 'What happens when nobody catches the fall?',
      test: (c) => c.S.m.stability <= 32,
      headline: 'Nation Enters Worst Downturn in Ninety Years',
      deck: 'Unemployment hits 14% as credit freezes and datacenters go dark.',
      story: (c) => [
        'Half-built datacenters stand empty across four states, financed by bonds that no longer have a rating. Three more banks failed over the weekend. Two large pension systems are insolvent.',
        `Somewhere in the wreckage, a young trader sits on ${B.fmt.compact(c.wealth * 0.6)}. In a country where nobody is hiring and nothing is lending, it does not feel like much.`,
        'Historians will argue for decades over which decisions turned a correction into a catastrophe. The trader already knows.'
      ],
      wealth: (c) => c.wealth * 0.6
    },
    {
      id:'exit', icon:'&#128682;', title:'The Exit', hint:'Left the industry without a headline.', lockedHint:'Survival can mean refusing the next opening bell.',
      test:(c)=>!!c.S.f.pulledPlug || (!!c.S.f.quiet && c.S.m.integrity >= 60 && c.quotaMet < c.days / 2),
      headline:'Former Trader Leaves Finance Without Comment', deck:'No book deal, no subpoena, no next desk.',
      story:(c)=>c.S.f.pulledPlug ? [
        'The automated stack died before the open. The forced unwind erased the book at the worst available prices, and the exchange shut the market for the day.',
        'Human bids came back on Tuesday. The trader left with almost nothing and with proof that the market was still capable of producing a human price.',
        'There was no next job on the street. That was not a punishment.'
      ] : [
        'There was no announcement. The badge stopped working and the résumé did not go to another bank.',
        'The trader left before finance could turn survival into a new obligation.',
        'The opening bell rang the following morning without them.'
      ], wealth:(c)=>c.S.f.pulledPlug ? Math.min(c.wealth, c.start * .12) : c.wealth
    },
    {
      id: 'grind', icon: '&#9749;', title: 'Still Standing', hint: 'Survived all thirteen weeks. No heroics, no handcuffs.', lockedHint: 'Sometimes the ending is just... Tuesday.',
      test: () => true,
      headline: 'After the Storm, Traders Return to Their Desks',
      deck: 'For survivors on the street, life goes on. Mostly.',
      story: (c) => [
        'The campaign ended not with a bang but with a spreadsheet. The young trader who arrived at the top of the bubble was somehow still there at the final close.',
        `Final tally: ${B.fmt.compact(c.wealth)}. No headline, no subpoena, no book deal.`,
        'There was no opening bell the next morning.'
      ],
      wealth: (c) => c.wealth
    }
  ];
  const by = (id) => LIST.find((e) => e.id === id);
  const priority = [
    { rank:1, id:'wiped', title:'Wiped Out' }, { rank:2, id:'fired', title:'Fired' },
    { rank:3, id:'exit', title:'The Exit · Pull the Plug' }, { rank:4, id:'nobody', title:'Nobody Turned It Off · Leave It Running' }
  ].concat(LIST.filter((e)=>!['wiped','fired','exit','nobody'].includes(e.id)).map((e,i)=>({rank:i+5,id:e.id,title:e.title})));
  ['nobody','fall-guy','ward','clawback','lost-decade','cassandra'].forEach((id) => {
    const ending = LIST.find((e) => e.id === id);
    if (ending) ending.dark = true;
  });
  // Front-page furniture for the Daily Ledger: the section kicker above the
  // headline and a pull quote lifted from the ending's own story text.
  const PAGE = {
    wiped: ['Careers', 'Treated leverage like a personality.'],
    fired: ['Careers', (c) => c.firedBy === 'boss' ? 'It was never about the numbers.' : 'We pay for results.'],
    nobody: ['Markets', 'No system rebelled.'],
    master: ['World', 'Beyond the reach of federal prosecutors.'],
    whistle: ['Politics', 'They say they sleep fine.'],
    revolving: ['Politics', 'I\'m a public servant now.'],
    perp: ['Courts', 'The trader wore a gym hoodie.'],
    'fall-guy': ['Courts', 'Signatures were not rare. Defendants were.'],
    cassandra: ['Politics', 'None changed a vote.'],
    acquirer: ['Deals', 'The liabilities did not disappear. They only changed logos.'],
    ward: ['Politics', 'The institution survived. The word private did not.'],
    clawback: ['Pay', 'The pension fund did not recover sixty percent.'],
    fund: ['Deals', 'The fee section was less skeptical.'],
    'right-early': ['Markets', 'Markets do not pay for being correct.'],
    'everything-rally': ['Economy', 'Wages did not follow the portfolio.'],
    'lost-decade': ['Economy', 'The crisis ended on official calendars.'],
    soft: ['Economy', 'Boring. Beautiful.'],
    quiet: ['Markets', 'They were right, told nobody.'],
    replaced: ['Careers', 'The memo used the word exciting twice.'],
    depression: ['Economy', 'The trader already knows.'],
    exit: ['Careers', (c) => c.S.f.pulledPlug ? 'That was not a punishment.' : 'The opening bell rang the following morning without them.'],
    grind: ['Careers', 'No headline, no subpoena, no book deal.']
  };
  LIST.forEach((e) => {
    const p = PAGE[e.id];
    if (!p) return;
    e.section = p[0];
    e.pull = typeof p[1] === 'function' ? p[1] : () => p[1];
  });

  B.StoryEndings = {
    list: LIST,
    priority,
    resolve(ctx) {
      if (ctx.reason === 'wiped') return by('wiped');
      if (ctx.reason === 'fired') return by('fired');
      if (ctx.S.f.pulledPlug) return by('exit');
      if (ctx.S.f.leftStack && ctx.S.f.aiUncontained) return by('nobody');
      return LIST.find((e) => e.test(ctx));
    },
    discovered() { return B.Save.discovered(); },
    count(id) { return B.Save.tally()[id] || 0; },
    record(id) { B.Save.recordEnding(id); }
  };
})(window.BTB);
