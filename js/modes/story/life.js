// Life beats: the personal-money story. Short decisions after the closing bell
// that cost your own money, not the firm's book. Each one fires once, on its
// session, after any desk decision that day. Everything is plain data plus an
// apply function on the story state and the wallet, so saves and replays stay
// exact. Names are the game's existing cast; nothing here is real.
//
// The household beats (pet, dentist, vet, Dad's surgery) are cosmetic by
// design: they only move your own money and set wallet fields that the
// weekend art and the ending epilogue read. They never touch story meters,
// relationships, flags or stress. A test enforces that.
(function (B) {
  'use strict';
  const D = B.StoryData;
  const money = (v) => B.fmt.money(v);
  // One fixed name per sex, for either animal.
  const PET_NAME = { boy: 'Rosco', girl: 'Jemma' };
  const he = (W) => (W.pet && W.pet.sex === 'girl' ? 'she' : 'he');
  const him = (W) => (W.pet && W.pet.sex === 'girl' ? 'her' : 'him');
  const his = (W) => (W.pet && W.pet.sex === 'girl' ? 'her' : 'his');
  const petName = (W) => (W.pet ? W.pet.name : '');
  const adopt = (kind, sex) => ({
    id: `${kind}-${sex}`,
    label: `The ${kind}: ${PET_NAME[sex]} (${sex})`,
    hint: `${money(150)} adoption fee, then ${money(35)} a week for food.`,
    apply: (S, W, E) => {
      E.charge(W, 150);
      W.pet = { kind, sex, name: PET_NAME[sex] };
      return kind === 'cat'
        ? [`${PET_NAME[sex]} inspects every corner of the apartment, then falls asleep on the one warm spot on the radiator.`]
        : [`${PET_NAME[sex]} is waiting at the door when you get home. ${sex === 'girl' ? 'She' : 'He'} will be waiting at the door every night.`];
    }
  });

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
      id: 'dadBill', day: 31, speaker: 'Mom', role: 'Calling after the close',
      kicker: 'YOUR MONEY', title: 'Fourteen Thousand Two Hundred',
      text: () => ['"It\'s your father. The procedure went fine. He\'s fine."',
        '"The insurance says the surgeon was out of network. It\'s fourteen thousand two hundred. I didn\'t want to ask."'],
      options: [
        { id: 'pay', label: `Pay it. All of it. (${money(14200)})`, hint: 'Cash first, then the card, then collections.',
          apply: (S, W, E) => { E.charge(W, 14200); W.dad = 'paid'; return ['She cries a little. Then she tells you about the nurse who was kind to him.']; } },
        { id: 'plan', label: `Half now, the rest over six weeks`, hint: `${money(7100)} now, then ${money(1200)} every Friday for six weeks.`,
          apply: (S, W, E) => { E.charge(W, 7100); W.dad = 'plan'; (W.plans = W.plans || []).push({ label: "Dad's surgery", amt: 1200, left: 6 }); return ['"Thank you. We\'ll manage the rest." You set up the plan on your phone in the cab.']; } },
        { id: 'insurer', label: 'Let me call the insurer first', hint: 'Costs nothing today. Mom handles it alone.',
          apply: (S, W) => { W.dad = 'unpaid'; W.dadUnpaid = true; return ['"Of course. You\'re busy." She hangs up before you can say you\'ll call tomorrow. You do not call tomorrow.']; } }
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
    },
    {
      id: 'adopt', day: 10, speaker: 'Harbor Street Animal Shelter', role: 'Open late on Mondays',
      kicker: 'YOUR LIFE', title: 'Somebody Should Take Them Home',
      text: () => ['The shelter on your block has a sign in the window: <i>Nobody adopts in a crash. Prove us wrong.</i>',
        'The volunteer walks you down the row of kennels. The orange cats stare at you like risk managers. The brown dogs have already decided you are the one.'],
      options: [adopt('cat', 'boy'), adopt('cat', 'girl'), adopt('dog', 'boy'), adopt('dog', 'girl'),
        { id: 'pass', label: 'Not now', hint: 'Nothing leaves your account.',
          apply: () => ['You tell the volunteer you work too much. She says everybody does, and writes nothing down.'] }]
    },
    {
      id: 'dentist', day: 15, speaker: 'Your dentist', role: 'Front desk, voicemail',
      kicker: 'YOUR LIFE', title: 'Six Months Is Up',
      text: () => ['"Hi, this is the front desk. You are overdue for your cleaning. We have a 7 AM on Saturday."',
        '"Insurance covers most of it. Most."'],
      options: [
        { id: 'go', label: `Go. (${money(180)})`, hint: 'Your share after insurance.',
          apply: (S, W, E) => { E.charge(W, 180); W.teeth = 'clean'; return ['The hygienist asks if you grind your teeth. You say no. She does not believe you.']; } },
        { id: 'skip', label: 'Skip it', hint: 'Nothing leaves your account. Today.',
          apply: (S, W) => { W.teeth = 'skipped'; return ['You delete the voicemail. The front desk will call again. They always call again.']; } }
      ]
    },
    {
      id: 'vetCheck', day: 25, speaker: 'Your vet', role: 'Reminder card',
      when: (S, W) => !!W.pet,
      kicker: 'YOUR LIFE', title: 'Annual Checkup',
      text: (S, W) => [`A postcard with a cartoon stethoscope: <i>${petName(W)} is due for a checkup and vaccines.</i>`,
        `${petName(W)} watches you read it and says nothing, which is how animals negotiate.`],
      options: [
        { id: 'go', label: `Book it. (${money(220)})`, hint: 'Checkup and shots.',
          apply: (S, W, E) => { E.charge(W, 220); W.vet = 'checked'; return [`The vet says ${petName(W)} is healthy and slightly spoiled. You take it as a compliment.`]; } },
        { id: 'skip', label: 'Skip it this year', hint: 'Nothing leaves your account. Today.',
          apply: (S, W) => { W.vet = 'skipped'; return ['The postcard goes under a magnet on the fridge, next to the other things you will deal with later.']; } }
      ]
    },
    {
      id: 'toothache', day: 38, speaker: 'Your dentist', role: 'Emergency line',
      when: (S, W) => W.teeth === 'skipped',
      kicker: 'YOUR LIFE', title: 'The Back Molar',
      text: () => ['It started as a twinge during the open. By the close you are chewing on nothing at all.',
        '"We can fit you in tonight. It is a crown now, maybe a root canal. The cleaning would have caught it."'],
      options: [
        { id: 'fix', label: `Get it fixed tonight. (${money(1400)})`, hint: 'Cash first, then the card.',
          apply: (S, W, E) => { E.charge(W, 1400); W.teeth = 'fixed'; return ['Two hours in the chair. The numbness wears off somewhere around the second bridge on the way home.']; } },
        { id: 'live', label: 'Live with it', hint: 'Nothing leaves your account.',
          apply: (S, W) => { W.teeth = 'sore'; return ['You learn to chew on the left side. It becomes the kind of thing you stop noticing, mostly.']; } }
      ]
    },
    {
      id: 'vetER', day: 40, speaker: 'Your vet', role: 'After-hours line',
      when: (S, W) => !!W.pet && W.vet === 'skipped',
      kicker: 'YOUR LIFE', title: 'Something Is Wrong',
      text: (S, W) => [`${petName(W)} has not eaten since yesterday and will not come out from under the bed.`,
        `"Bring ${him(W)} in tonight. It is probably treatable. The checkup would have caught it."`],
      options: [
        { id: 'pay', label: `Go to the emergency vet. (${money(900)})`, hint: 'Cash first, then the card.',
          apply: (S, W, E) => { E.charge(W, 900); W.vet = 'treated'; return [`Antibiotics, a cone and a bill. By the weekend ${petName(W)} is back on the windowsill, judging the pigeons.`]; } },
        { id: 'wait', label: 'Wait and see', hint: 'Nothing leaves your account.',
          apply: (S, W) => { W.vet = 'neglected'; return [`${petName(W)} comes out on the third day, thinner and slower. ${he(W).charAt(0).toUpperCase() + he(W).slice(1)} gets better on ${his(W)} own. Mostly.`]; } }
      ]
    }
  ];

  B.Life = { LIFE, byDay: (day) => LIFE.find((b) => b.day === day) || null, byId: (id) => LIFE.find((b) => b.id === id) || null };
})(window.BTB);
