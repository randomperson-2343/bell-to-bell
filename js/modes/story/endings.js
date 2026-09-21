// Story endings: priority-ordered conditions plus front-page copy.
(function (B) {
  'use strict';

  // ctx: { S, wealth, start, reason }
  const LIST = [
    {
      id: 'wiped', icon: '&#128165;', title: 'Wiped Out', hint: 'Your account fell below 10% of your starting capital.', lockedHint: 'Some fortunes end faster than others.',
      test: (c) => c.reason === 'wiped',
      headline: 'Rookie Trader\'s Book Vaporized',
      deck: 'Security escorts junior trader from the 41st floor holding a cardboard box.',
      story: (c) => [
        'It took less than a month. The trader, hired in the last days of the HYDRA boom with a quarter-million-dollar book, left Halbrook &amp; Vance with a cardboard box, a parking validation and a balance the risk desk described as "a rounding error."',
        'Colleagues say the trader was talented but "treated leverage like a personality." The account\'s final trades were liquidated automatically by the firm\'s risk system.',
        'Asked for comment, the trader stared into the middle distance and whispered something about "a dead cat bounce."'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'fired', icon: '&#128230;', title: 'Fired', hint: 'Missed quota three days running, or burned your boss completely.', lockedHint: 'Your boss is always counting.',
      test: (c) => c.reason === 'fired',
      headline: 'Another Trader Shown the Door',
      deck: 'Firm cites "persistent underperformance" as crisis claims another desk.',
      story: (c) => [
        `"We pay for results," the head of trading said, in a memo the Ledger obtained. The trader's final day ended with a thirty-second meeting and a severance package worth two weeks' pay.`,
        'The trader is reportedly "exploring opportunities," which sources describe as "sending résumés to regional credit unions."'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'perp', icon: '&#128660;', title: 'Perp Walk', hint: 'Fraud or insider trading, with too much heat, and no deal with prosecutors.', lockedHint: 'The SEC has a long memory.',
      test: (c) => (c.S.f.fraud || c.S.f.insiderTraded || (c.S.f.insider && c.S.m.heat >= 80)) && c.S.m.heat >= 70 && !c.S.f.cooperated && !c.S.f.fled,
      headline: 'FBI Arrests H&amp;V Trader at Dawn',
      deck: 'Handcuffed in front of cameras as prosecutors seize accounts.',
      story: (c) => [
        'Federal agents arrested the trader at 6:04 AM at a Tribeca apartment. Photographers had been tipped off. The trader wore a gym hoodie.',
        `Prosecutors allege ${[c.S.f.fraud ? 'signing off on fraudulent HYDRA valuations' : null, c.S.f.insiderTraded || c.S.f.insider ? 'trading ahead of the Monarch downgrade' : null, c.S.f.raid ? 'taking part in a coordinated raid on Lorimer Brothers' : null].filter(Boolean).join(', ') || 'securities fraud'}. The government seized 90% of the trader's assets pending trial.`,
        'In a crisis that ruined millions of people, the trader is one of the very few who will face a jury.'
      ],
      wealth: (c) => c.wealth * 0.1
    },
    {
      id: 'master', icon: '&#127965;', title: 'Master of the Universe', hint: 'Took the jet. Kept the money.', lockedHint: 'There\'s always a private terminal in Teterboro.',
      test: (c) => !!c.S.f.fled,
      headline: 'Missing Trader Surfaces in Port Solace',
      deck: 'Sipping champagne beyond the reach of U.S. prosecutors.',
      story: (c) => [
        'The photographs, taken with a long lens from a fishing boat, show the trader on the deck of a 140-foot yacht in the harbor of Port Solace, a country with no extradition treaty with the United States.',
        `Sources estimate the trader left the country with roughly ${B.fmt.compact(c.wealth)}, converted to cash in the final hours before a federal subpoena was issued.`,
        c.S.m.stability < 30 ? 'Back home, unemployment just hit 11%. The trader has reportedly posted sunset photos to social media.' : 'Back home, the recovery has begun without them.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'whistle', icon: '&#128227;', title: 'The Whistleblower', hint: 'High integrity. Rae as an ally. You told the truth.', lockedHint: 'Some reporters just need one good source.',
      test: (c) => c.S.m.integrity >= 70 && c.S.rel.rae >= 60 && (c.S.f.leaked || c.S.f.testified || c.S.f.goPublic),
      headline: 'The Trader Who Told the Truth',
      deck: 'Testimony and leaked documents spark the biggest financial reform in a century.',
      story: (c) => [
        'The Ledger can now confirm the identity of the source behind its HYDRA investigation: a junior trader who walked into a burning building and started taking notes.',
        '"I just wanted people to know what was actually in those bonds," the trader told Congress. Within weeks, lawmakers passed reforms banning the practices that built HYDRA.',
        'The trader has been offered a book deal, a teaching post, and no job anywhere on Wall Street. They say they sleep fine.'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'revolving', icon: '&#127963;', title: 'The Revolving Door', hint: 'Enough influence, the bill passed, and you took the Treasury job.', lockedHint: 'Washington always needs people who know where the bodies are.',
      test: (c) => !!c.S.f.treasury,
      headline: 'Wall Street Trader Named to Top Treasury Post',
      deck: 'Critics say the architects of the crisis are now in charge of cleaning it up.',
      story: (c) => [
        'In a move that stunned reform advocates, Secretary Evelyn Marsh named the trader Deputy Secretary for Financial Stability on Monday.',
        `"Nobody understands these markets better," Marsh said. Critics pointed out that the new official's personal trading account grew to ${B.fmt.compact(c.wealth)} during the crisis the office is now meant to prevent.`,
        'Asked whether they felt any conflict, the trader smiled. "I\'m a public servant now."'
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'depression', icon: '&#127786;', title: 'Depression 20XX', hint: 'Systemic stability collapsed. Everyone lost.', lockedHint: 'What happens when nobody catches the fall?',
      test: (c) => c.S.m.stability <= 25,
      headline: 'Nation Enters Worst Downturn Since 1930s',
      deck: 'Unemployment hits 14% as banks fail and credit freezes.',
      story: (c) => [
        'Breadlines have returned to American cities for the first time in living memory. Three more major banks failed over the weekend. Pension funds, including Ohio Teachers\', are insolvent.',
        `Somewhere in the wreckage, a young trader sits on ${B.fmt.compact(c.wealth)}. In a world where the dollar buys 40% less and nobody is hiring, it doesn\'t feel like much.`,
        'Historians will argue for decades over which decisions turned a correction into a catastrophe. The trader already knows.'
      ],
      wealth: (c) => c.wealth * 0.6
    },
    {
      id: 'soft', icon: '&#127774;', title: 'Soft Landing', hint: 'Regulation passed, the bill passed, and stability held.', lockedHint: 'Maybe the system can be fixed after all.',
      test: (c) => c.S.m.stability >= 55 && c.S.f.regulation && c.S.f.billPassed,
      headline: 'Markets Stabilize as Reforms Take Hold',
      deck: 'Economists credit early regulation and a timely rescue with averting disaster.',
      story: (c) => [
        'It could have been so much worse. That is the verdict of economists looking back on a month that brought the financial system to the edge.',
        'Early reforms to the Financial Freedom Act limited the leverage that turned losses into collapses, and the Stabilization Act passed on the first vote.',
        `The trader who warned Congress about HYDRA walked away with ${B.fmt.compact(c.wealth)} and a clean record. Boring. Beautiful.`
      ],
      wealth: (c) => c.wealth
    },
    {
      id: 'grind', icon: '&#9749;', title: 'Still Standing', hint: 'Survived the month. No heroics, no handcuffs.', lockedHint: 'Sometimes the ending is just... Tuesday.',
      test: () => true,
      headline: 'After the Storm, Traders Return to Their Desks',
      deck: 'For survivors on the Street, life goes on. Mostly.',
      story: (c) => [
        'The month that nearly broke Wall Street ended not with a bang but with a spreadsheet. Among the survivors is a young trader who came in at the top of the bubble and somehow is still here.',
        `Final tally: ${B.fmt.compact(c.wealth)}. No headlines, no subpoenas, no book deal. The trader\'s alarm is set for 5:45 AM.`,
        'The opening bell rings again tomorrow. It always does.'
      ],
      wealth: (c) => c.wealth
    }
  ];

  B.StoryEndings = {
    list: LIST,
    resolve(ctx) {
      return LIST.find((e) => e.test(ctx));
    },
    discovered() { return B.storage.get('endings', []); },
    record(id) {
      const d = this.discovered();
      if (!d.includes(id)) { d.push(id); B.storage.set('endings', d); }
    }
  };
})(window.BTB);
