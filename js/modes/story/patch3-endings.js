// Patch 3 ending expansion. Existing ending objects and their relative priority
// are preserved; eleven new outcomes are inserted around them.
(function (B) {
  'use strict';
  const legacy = B.StoryEndings.list;
  const by = (id) => legacy.find((e) => e.id === id);

  by('wiped').story = () => [
    'The campaign ended early. The trader left Holloway Stern with a cardboard box, a parking validation and a balance the risk desk described as a rounding error.',
    'Colleagues say the trader was talented but treated leverage like a personality. The final positions were liquidated automatically.',
    'The risk system did not stay to watch the elevator doors close.'
  ];
  by('soft').story = (c) => [
    'It could have been worse. Thirteen weeks took the system to the edge without pushing it over.',
    'Tighter limits kept leverage from turning every loss into a failure, and the guarantee arrived before the final break.',
    `The trader walked away with ${B.fmt.compact(c.wealth)} and a clean record. Boring. Beautiful.`
  ];
  by('quiet').story = (c) => [
    'There is no photograph and no committee ever asked for the name.',
    `A junior trader read the footnotes, held the position through weeks of disbelief and finished at ${B.fmt.compact(c.wealth)}.`,
    'They were right, told nobody, and watched the thing they were right about happen to everyone else.'
  ];
  by('replaced').story = (c) => [
    'The memo used the word exciting twice.',
    `Holloway Stern moved the flow desk onto the automated stack after a campaign in which it outperformed every human seat, including one that finished at ${B.fmt.compact(c.wealth)}.`,
    'The trader was invited to stay for the transition. The system did not take coffee breaks and would not be asked to testify.'
  ];
  by('grind').hint = 'Survived all thirteen weeks. No heroics, no handcuffs.';
  by('grind').story = (c) => [
    'The campaign ended not with a bang but with a spreadsheet. The young trader who arrived at the top of the bubble was somehow still there at the final close.',
    `Final tally: ${B.fmt.compact(c.wealth)}. No headline, no subpoena, no book deal.`,
    'There was no opening bell the next morning.'
  ];

  const nobody = {
    id:'nobody', icon:'&#128268;', title:'Nobody Turned It Off', hint:'The market remained open after price discovery ended.', lockedHint:'Some warnings only look like noise until the loop closes.',
    test:(c)=>!!c.S.f.aiUncontained && !c.S.f.pulledPlug && ((c.S.anomalies || 0) < 10 || c.S.m.stability < 55),
    headline:'Market Opens, Price Discovery Does Not',
    deck:'Identical autonomous systems converge on the same trade until no human price remains.',
    story:()=>[
      'No system rebelled. No machine made a threat. Every system independently reached the same conclusion at the same moment, and each treated the others as confirmation.',
      'The opening auction never became a market. Orders crossed, marks multiplied and counterparties collapsed into one legal entity identifier. Humans remained at their desks with nothing left to decide.',
      'The account statement attempted to calculate a payout. There was no executable price behind it.'
    ],
    wealth:(c)=>c.wealth, unpriced:true
  };

  const rightEarly = {
    id:'right-early', icon:'&#9203;', title:'Right Too Early', hint:'Held the correct short through the false dawn and paid for the timing.', lockedHint:'Being right and surviving are separate trades.',
    test:(c)=>!!c.S.f.rightTooEarly,
    headline:'Correct Trade Arrives After Capital Does Not', deck:'Trader saw the collapse, survived the rally, and reached the payoff diminished.',
    story:(c)=>[
      'The thesis was right. The calendar was not. For eight sessions the false dawn climbed without a gap large enough to force surrender and without a reason strong enough to justify it.',
      `By the time the collapse arrived, the book was below its starting value and the firm had stopped listening. The final account stood at ${B.fmt.compact(c.wealth)}.`,
      'Markets do not pay for being correct. They pay for being correct while still solvent.'
    ], wealth:(c)=>c.wealth
  };

  const fallGuy = {
    id:'fall-guy', icon:'&#128196;', title:'The Fall Guy', hint:'Refused the marks, then inherited somebody else’s signature.', lockedHint:'A blank signature line is still a position.',
    test:(c)=>!!c.S.f.externalFraud && c.S.m.heat >= 55 && !c.S.f.cooperated,
    headline:'Former Holloway Trader Sentenced in Valuation Case', deck:'The signature was not theirs. The responsibility became theirs anyway.',
    story:()=>[
      'The trader refused to sign the sixty-one-cent mark. Another officer signed it twenty minutes later. At trial, prosecutors argued that refusing privately while continuing to trade publicly made the trader part of the same representation.',
      'The sentence was thirty months. Holloway Stern settled without admitting wrongdoing.',
      'Signatures were not rare. Defendants were.'
    ], wealth:(c)=>c.wealth * .35
  };

  const acquirer = {
    id:'acquirer', icon:'&#127970;', title:'The Acquirer', hint:'Bought the carcass and inherited the combined desk.', lockedHint:'Failure creates inventory for whoever still has a balance sheet.',
    test:(c)=>!!c.S.f.letFail && c.S.m.firm >= 75 && c.S.m.influence >= 40,
    headline:'Holloway Stern Acquires Ridgeway for Nominal Sum', deck:'Junior trader named to combined desk after weekend seizure.',
    story:(c)=>[
      'Ridgeway failed before midnight. Holloway Stern bought the operating assets before breakfast for less than the value of its headquarters.',
      `The trader who argued against a rescue was handed the combined book and finished with ${B.fmt.compact(c.wealth)}.`,
      'The branch signs changed by Tuesday. The liabilities did not disappear. They only changed logos.'
    ], wealth:(c)=>c.wealth
  };

  const ward = {
    id:'ward', icon:'&#127963;', title:'Ward of the State', hint:'The guarantee became ownership and the job survived.', lockedHint:'A rescue can keep the chair while changing who owns it.',
    test:(c)=>!!c.S.f.bailout && c.S.m.stability >= 35 && c.S.m.stability <= 50 && c.S.m.firm < 40,
    headline:'Government Takes Controlling Stake in Holloway Stern', deck:'Firm survives under public ownership and compensation review.',
    story:(c)=>[
      'The guarantee became preferred shares, then voting shares, then control. Holloway Stern still opened Monday. Its logo remained above the doors.',
      `The trader kept the seat and ${B.fmt.compact(c.wealth)}, subject to a compensation committee that now met in a government building.`,
      'The institution survived. The word private did not.'
    ], wealth:(c)=>c.wealth * .8
  };

  const clawback = {
    id:'clawback', icon:'&#8634;', title:'Clawback', hint:'The bonus was seized after the trade was already celebrated.', lockedHint:'Bonuses settle faster than consequences.',
    test:(c)=>c.wealth >= c.start * 2 && (c.S.f.dumped || c.S.f.fraud) && c.S.m.anger >= 60,
    headline:'Crisis-Era Bonuses Seized Under Emergency Rules', deck:'Trader keeps the record and forty cents on every dollar.',
    story:(c)=>[
      'The bonus cleared months before the rule existed. The clawback reached backward anyway.',
      `Sixty percent of the account was seized. The remaining value, ${B.fmt.compact(c.wealth * .4)}, was described by the committee as more than fair.`,
      'The pension fund did not recover sixty percent.'
    ], wealth:(c)=>c.wealth * .4
  };

  const lost = {
    id:'lost-decade', icon:'&#128199;', title:'The Lost Decade', hint:'The system avoided collapse and forgot how to grow.', lockedHint:'Not every crisis ends. Some become the weather.',
    test:(c)=>c.S.m.stability >= 35 && c.S.m.stability <= 45 && !!c.S.f.regulation && !c.S.f.billPassed,
    headline:'Economy Stabilizes at Permanent Standstill', deck:'No depression, no recovery, and no clean balance sheets.',
    story:()=>[
      'Nothing else failed. Nothing healthy replaced what had already failed. Credit survived as a ritual performed between institutions unwilling to recognize losses.',
      'Growth stayed near zero long enough for a generation to stop waiting for it.',
      'The crisis ended on official calendars and continued everywhere else.'
    ], wealth:(c)=>c.wealth * .75
  };

  const fund = {
    id:'fund', icon:'&#128188;', title:'The Fund', hint:'Turned the crisis trade into a firm of your own.', lockedHint:'A track record becomes a company when enough money believes it.',
    test:(c)=>c.wealth >= c.start * 4 && c.S.m.heat < 25 && (c.S.rel.greta >= 60 || c.S.rel.imani >= 60) && !c.S.f.public,
    headline:'Crisis Trader Raises New Fund', deck:'Investors commit billions to the person who read the footnotes first.',
    story:(c)=>[
      `The pitch deck began with one number: ${B.fmt.compact(c.wealth)}. It did not mention the nights, the calls or the people on the other side.`,
      'Imani took the first meeting. Greta brought the first anchor investor. The fund closed above target.',
      'The strategy section promised disciplined skepticism. The fee section was less skeptical.'
    ], wealth:(c)=>c.wealth
  };

  const cassandra = {
    id:'cassandra', icon:'&#128483;', title:'Cassandra', hint:'Warned everyone, changed nothing, and watched it happen.', lockedHint:'Truth without influence is still truth.',
    test:(c)=>c.S.m.integrity >= 85 && c.S.m.influence < 20 && c.S.m.stability <= 30,
    headline:'Warnings Proven Correct After System Collapses', deck:'The record was clear. The response was not.',
    story:()=>[
      'The testimony, memoranda and timestamped warnings were entered into the record. Each described the failure before it happened.',
      'None changed a vote. None changed a limit. None stopped a trade.',
      'Years later, every inquiry cited the warnings as evidence that the disaster was foreseeable.'
    ], wealth:(c)=>c.wealth
  };

  const exit = {
    id:'exit', icon:'&#128682;', title:'The Exit', hint:'Left the industry without a headline.', lockedHint:'Survival can mean refusing the next opening bell.',
    test:(c)=>!!c.S.f.pulledPlug || (!!c.S.f.quiet && c.S.m.integrity >= 60 && c.quotaMet < c.days / 2),
    headline:'Former Trader Leaves Finance Without Comment', deck:'No book deal, no subpoena, no next desk.',
    story:(c)=>c.S.f.pulledPlug ? [
      'The automated stack died before the open. The forced unwind erased the book at the worst available prices, but independent bids returned before the close.',
      'The trader left with almost nothing and with proof that the market was still capable of producing a human price.',
      'There was no next job on the street. That was not a punishment.'
    ] : [
      'There was no announcement. The badge stopped working and the résumé did not go to another bank.',
      'The trader left before finance could turn survival into a new obligation.',
      'The opening bell rang the following morning without them.'
    ], wealth:(c)=>c.S.f.pulledPlug ? Math.min(c.wealth, c.start * .12) : c.wealth
  };

  const everything = {
    id:'everything-rally', icon:'&#128200;', title:'The Everything Rally', hint:'Asset prices recovered. The economy did not.', lockedHint:'A green screen can hide a country in recession.',
    test:(c)=>!!c.S.f.bailout && !!c.S.f.billPassed && c.S.m.stability >= 28 && c.S.m.stability <= 40 && c.wealth >= c.start * 2,
    headline:'Markets Triple as Recovery Passes Households By', deck:'Liquidity restores every asset price except the price of ordinary life.',
    story:(c)=>[
      `The account finished at ${B.fmt.compact(c.wealth * 2)} after emergency liquidity lifted every security the trader could still buy.`,
      'Employment did not recover with the index. Wages did not follow the portfolio. Empty datacenters changed owners and rose in value.',
      'The ending looked like a win on every screen inside the building.'
    ], wealth:(c)=>c.wealth * 2
  };

  // Keep the original eleven in their original order. New endings are inserted
  // only where the Patch 3 priority rules require them.
  const LIST = [
    by('wiped'), by('fired'), nobody, by('perp'), fallGuy, by('master'), by('whistle'), cassandra,
    by('revolving'), acquirer, ward, clawback, rightEarly, lost, fund, everything,
    by('depression'), by('soft'), by('quiet'), by('replaced'), exit, by('grind')
  ];
  ['nobody','fall-guy','ward','clawback','lost-decade','cassandra'].forEach((id) => {
    const ending = LIST.find((e) => e.id === id);
    if (ending) ending.dark = true;
  });

  B.StoryEndings = {
    list: LIST,
    resolve(ctx) { return LIST.find((e) => e.test(ctx)); },
    discovered() { return B.Save.discovered(); },
    count(id) { return B.Save.tally()[id] || 0; },
    record(id) { B.Save.recordEnding(id); }
  };
})(window.BTB);
