// Life beats: the personal-money story. Short decisions after the closing bell
// that cost your own money, not the firm's book. Each one fires once, on its
// session, after any desk decision that day. Everything is plain data plus an
// apply function on the story state and the wallet, so saves and replays stay
// exact. Names are the game's existing cast; nothing here is real.
(function (B) {
  'use strict';
  const D = B.StoryData;
  const money = (v) => B.fmt.money(v);

  const LIFE = [
    {
      id: 'rentHike', day: 20, speaker: 'Your landlord', role: 'Building management',
      // No landlord on your mother's couch.
      when: (S, W) => (W.tier | 0) > 0,
      kicker: 'YOUR MONEY', title: 'The Building Is AI-Managed Now',
      text: () => ['New owners. The building runs on the same kind of model you trade against now. It has reviewed your unit.',
        '"Rent goes up nine percent from next week. The system says congratulations."'],
      options: [
        { id: 'accept', label: 'Accept it', hint: 'Rent +9% from next week.',
          apply: (S, W) => { W.rentMult = (W.rentMult || 1) * 1.09; return ['You sign. The email thanks you in three languages.']; } },
        { id: 'push', label: 'Push back', hint: 'Works if people listen to you. If not, it costs you sleep.',
          apply: (S, W) => {
            if (S.m.influence >= 30) { W.rentMult = (W.rentMult || 1) * 1.045; return ['You mention the hearing you might testify at. The system halves the increase.']; }
            W.rentMult = (W.rentMult || 1) * 1.09; W.stressNext = (W.stressNext || 0) + 6;
            return ['The system does not negotiate. The increase stands, and you lie awake composing replies.'];
          } },
        { id: 'move', label: 'Give notice and move somewhere cheaper', hint: 'Down one home this weekend, free. Your sibling helps carry boxes.',
          req: (S, W) => (W.tier | 0) > 1,
          apply: (S, W) => { W.tier = Math.max(1, (W.tier | 0) - 1); return ['Your sibling shows up with a borrowed van and says nothing about the promise you broke to help them move.']; } }
      ]
    },
    {
      id: 'advance', day: 44, speaker: 'Desmond Kroll', role: 'Head of desk, at dinner',
      kicker: 'YOUR MONEY', title: 'The Number Is Looking Good',
      text: (S, W) => [`Kroll pays for dinner. Steak, the good wine, a toast to "the bottom being in."`,
        `"Pool closes the first of the year. Your number is looking good. HR can advance you ${money(8000)} against it tonight. Don't do anything stupid before then."`],
      options: [
        { id: 'take', label: `Take the ${money(8000)} advance`, hint: 'Cash now. It comes out of your future bonus, and whatever you have not earned back is clawed back when you leave.',
          apply: (S, W, E) => { const gross = Math.round(8000 / (1 - E.P.taxRate)); W.cash += 8000; W.deficit += gross; W.advanceGross = (W.advanceGross || 0) + gross; D.adj(S, {}, { kroll: 3 }); return ['The money lands before dessert. Imani, when you tell her, says: "Bonus money is a loan from the future."']; } },
        { id: 'decline', label: 'Decline', hint: 'Nothing changes. Kroll notices.',
          apply: (S) => { D.adj(S, {}, { kroll: -2 }); return ['Kroll shrugs. "Suit yourself." The quota slip is already on your plate.']; } }
      ]
    },
    {
      id: 'dadBill', day: 46, speaker: 'Mom', role: 'Calling after the close',
      kicker: 'YOUR MONEY', title: 'Fourteen Thousand Two Hundred',
      text: () => ['"It\'s your father. The procedure went fine. He\'s fine."',
        '"The insurance says the surgeon was out of network. It\'s fourteen thousand two hundred. I didn\'t want to ask."'],
      options: [
        { id: 'pay', label: `Pay it. All of it. (${money(14200)})`, hint: 'Cash first, then the card, then collections.',
          apply: (S, W, E) => { E.charge(W, 14200); W.stressNext = (W.stressNext || 0) - 4; return ['She cries a little. Then she tells you about the nurse who was kind to him.']; } },
        { id: 'plan', label: `Half now, the rest over six weeks`, hint: `${money(7100)} now, then ${money(1200)} every Friday for six weeks.`,
          apply: (S, W, E) => { E.charge(W, 7100); (W.plans = W.plans || []).push({ label: "Dad's surgery", amt: 1200, left: 6 }); return ['"Thank you. We\'ll manage the rest." You set up the plan on your phone in the cab.']; } },
        { id: 'insurer', label: 'Let me call the insurer first', hint: 'Costs nothing today. Mom handles it alone.',
          apply: (S, W) => { W.stressNext = (W.stressNext || 0) + 8; W.dadUnpaid = true; return ['"Of course. You\'re busy." She hangs up before you can say you\'ll call tomorrow. You do not call tomorrow.']; } }
      ]
    },
    {
      id: 'perry', day: 49, speaker: 'Perry Nakash', role: 'Voicemail, 0:41',
      kicker: 'YOUR MONEY', title: 'Six Thousand',
      text: (S) => [S.f.insider ? '"Enforcement called. I need a lawyer and I can\'t ask my parents."'
        : S.f.perryFiled ? '"They walked me out a week after I filed. Nobody will say it was because of that."'
          : '"The committee was replaced by the model. All of us. They gave us a box and a lanyard to keep."',
        '"Six thousand. I\'ll pay you back. I always do."'],
      options: [
        { id: 'lend', label: `Lend him ${money(6000)}`, hint: 'He means to pay it back.',
          apply: (S, W, E) => { E.charge(W, 6000); W.perryLoan = 6000; D.adj(S, {}, { perry: 10 }); return ['He texts a single word: "Thank you." Then, an hour later: "I mean it."']; } },
        { id: 'give', label: `Give it. Don't pay me back.`, hint: `${money(6000)}, gone.`,
          apply: (S, W, E) => { E.charge(W, 6000); D.adj(S, {}, { perry: 15 }); return ['He calls instead of texting. Neither of you says much. It is the best call you have had in weeks.']; } },
        { id: 'refuse', label: 'Refuse', hint: 'Your money stays yours.',
          apply: (S, W) => { D.adj(S, {}, { perry: -15 }); W.perryRefused = true; return ['You do not call back. The voicemail stays at the top of the list for the rest of the year.']; } }
      ]
    },
    {
      id: 'pension', day: 56, speaker: 'Mom', role: 'Calling after the close',
      kicker: 'YOUR MONEY', title: 'Twenty-Two Percent',
      text: (S) => ['"A letter from Riverbend. Benefits are cut twenty-two percent from January."',
        '"Your father says we\'ll manage. We won\'t."'].concat(S.f.dumped ? ['<i>The paper you sold to Riverbend at par is part of why the letter exists. She will never know that.</i>'] : []),
      options: [
        { id: 'monthly', label: 'Send something every week', hint: `${money(290)} a week home, through the winter: about ${money(2900)} in all.`,
          apply: (S, W) => { W.momExtra = (W.momExtra || 0) + 290; return ['"You don\'t have to." You do anyway.']; } },
        { id: 'once', label: `One time: ${money(5000)}`, hint: 'Cash first, then the card.',
          apply: (S, W, E) => { E.charge(W, 5000); return ['She says it will cover the winter. It will cover most of it.']; } },
        { id: 'cant', label: "I can't right now", hint: 'Nothing leaves your account.',
          apply: (S, W) => { W.stressNext = (W.stressNext || 0) + 8; return ['"I know, sweetheart. I know." She sounds relieved you said it first.']; } }
      ]
    }
  ];

  B.Life = { LIFE, byDay: (day) => LIFE.find((b) => b.day === day) || null, byId: (id) => LIFE.find((b) => b.id === id) || null };
})(window.BTB);
