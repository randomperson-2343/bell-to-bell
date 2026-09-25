// Story endings: priority-ordered conditions plus front-page copy.
// The first test that passes wins, so the list runs from most specific to least.
(function (B) {
  'use strict';

  // ctx: { S, wealth, start, reason }
  const LIST = [
    {
      id: 'wiped', icon: '&#128165;', title: 'Wiped Out', hint: 'Your account fell below 10% of your starting capital.', lockedHint: 'Some fortunes end faster than others.',
      test: (c) => c.reason === 'wiped',
      headline: 'Rookie Trader\'s Book Vaporized',
      deck: 'Security escorts junior trader from the 41st floor holding a cardboard box.',
      story: () => [
        'It took less than a month. The trader, hired in the last days of the compute melt-up with a quarter-million-dollar book, left Holloway Stern with a cardboard box, a parking validation and a balance the risk desk described as "a rounding error."',
        'Colleagues say the trader was talented but "treated leverage like a personality." The account\'s final positions were liquidated automatically by the firm\'s risk system, which does not have a personality.',
        'Asked for comment, the trader stared into the middle distance and whispered something about a dead cat bounce.'
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
      id: 'soft', icon: '&#127774;', title: 'Soft Landing', hint: 'Regulation passed, the bill passed, and stability held.', lockedHint: 'Maybe the system can be fixed after all.',
      test: (c) => c.S.m.stability >= 55 && c.S.f.regulation && c.S.f.billPassed,
      headline: 'Markets Stabilize as Reforms Take Hold',
      deck: 'Economists credit early limits and a timely guarantee with averting disaster.',
      story: (c) => [
        'It could have been so much worse. That is the verdict of economists looking back on a month that took the financial system to the edge and did not push it over.',
        'Tighter limits, argued for before anyone wanted to hear them, kept leverage from turning losses into failures. The Stabilization Act passed on the first vote.',
        `The trader who argued against the Compute Freedom Act walked away with ${B.fmt.compact(c.wealth)} and a clean record. Boring. Beautiful.`
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'quiet', icon: '&#129323;', title: 'The Quiet Fortune', hint: 'You saw it coming, traded it, and never said a word to anyone.', lockedHint: 'Some people just read the footnotes and then go very quiet.',
      test: (c) => c.wealth >= c.start * 3 && c.S.m.heat < 30 && !c.S.f.public && !c.S.f.fraud && !c.S.f.treasury,
      headline: 'Quietest Trade of the Crisis Was Made by Nobody You Have Heard Of',
      deck: 'No testimony, no leak, no headline. Just a position, held.',
      story: (c) => [
        'There is no photograph of this one. No committee ever asked for the name, and no reporter ever got it.',
        `A junior trader at Holloway Stern read the footnotes in a filing nobody else opened, put the position on, and sat completely still for four weeks while everyone around them lost everything. The account finished at ${B.fmt.compact(c.wealth)}.`,
        'They were right about all of it, and they told no one, and the thing they were right about happened to eleven million people anyway.',
        'They still go in every morning. Nobody at the firm knows.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'replaced', icon: '&#129302;', title: 'Replaced', hint: 'You survived the crash. The firm\'s own model survived it better.', lockedHint: 'What exactly did you think you were building?',
      test: (c) => !!c.S.f.algoDesk && !c.S.f.public && c.S.m.integrity < 70,
      headline: 'Holloway Stern to Run Flow Desk on Automated Execution',
      deck: 'Firm says headcount reduction is "not a comment on individual performance."',
      story: (c) => [
        'The memo went out at 7:04 AM and used the word "exciting" twice.',
        `Holloway Stern's flow desk will be run by an automated execution system from the first of the month. In the month just ended, the system returned more than every human seat on the floor, including one junior trader who finished at ${B.fmt.compact(c.wealth)} and had spent the previous weeks arguing that limits on exactly this kind of system were bad for the industry.`,
        'The trader is invited to stay on in an oversight capacity for two quarters, to help with the transition.',
        'The system does not take coffee breaks. It has never once had a panic attack. It will not be asked to testify.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'grind', icon: '&#9749;', title: 'Still Standing', hint: 'Survived the month. No heroics, no handcuffs.', lockedHint: 'Sometimes the ending is just... Tuesday.',
      test: () => true,
      headline: 'After the Storm, Traders Return to Their Desks',
      deck: 'For survivors on the street, life goes on. Mostly.',
      story: (c) => [
        'The month that nearly broke the financial system ended not with a bang but with a spreadsheet. Among the survivors is a young trader who arrived at the very top of the bubble and somehow is still here.',
        `Final tally: ${B.fmt.compact(c.wealth)}. No headlines, no subpoenas, no book deal. The trader's alarm is set for 5:45 AM.`,
        'The opening bell rings again tomorrow. It always does.'
      ],
      wealth: (c) => c.wealth
    }
  ];

  B.StoryEndings = {
    list: LIST,
    resolve(ctx) { return LIST.find((e) => e.test(ctx)); },
    discovered() { return B.Save.discovered(); },
    count(id) { return B.Save.tally()[id] || 0; },
    record(id) { B.Save.recordEnding(id); }
  };
})(window.BTB);
