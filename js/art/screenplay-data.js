// The storyboards for the long decision scenes. Every desk decision and every
// personal beat plays as a full scene of about 45 seconds before its choices
// appear, then a short payoff scene for the option you picked. The shots are
// drawn by js/art/screenplay.js from the game's existing rooms, faces,
// documents and places; this file is only the script.
//
// A shot is { k: kind, line: caption, ...kind options }:
//   floor   the trading floor. z: 0.15 wide, 0.45 mid, 0.7 close. dark: after hours. ticker: a crawl along the top.
//   room    a decision room, by decision id (c1, adopt, ...). after: the room as it is after the choice.
//   face    a close-up of who, in front of a room (on: a decision id, or 'floor').
//   doc     a document close-up: memo, footnote, rating, chart, ticket, vote, voicemail or post, with value written on it.
//   text    a phone screen: from (who), body (the message).
//   clock   a time card: time, note.
//   desk    your desk.        sky   the city.        home   your apartment (with your pet, if you have one).
//   tableau a news tableau by number (n).          racks  the rack room.
//   night: true draws sky and home after dark.
//   if / unless: a story flag (S.f) the shot needs, or must not have.
// Captions may hold {pet}, {Pet}, {he}, {He}, {him}, {his}: your pet's name and pronouns.
// recap: one line per option, past tense, for the career montage before the ending.
(function (B) {
  'use strict';

  const SCRIPTS = {
    // ---------------------------------------------------------------- the desk
    c1: {
      shots: [
        { k: 'floor', z: 0.15, ticker: 'CASCADE MARKS UNDER REVIEW', line: '3:12 PM. The floor is loud the way it gets when nobody wants to say a number out loud.' },
        { k: 'room', room: 'c1', line: 'Behind his glass, Kroll is laughing into a phone. He is looking straight at you.' },
        { k: 'floor', z: 0.45, line: 'He hangs up mid-laugh and crosses the floor. Traders lean out of his way without looking up.' },
        { k: 'face', who: 'Imani Rhodes', on: 'floor', line: 'Four desks over, Imani stops typing.' },
        { k: 'face', who: 'Desmond Kroll', on: 'c1', line: 'Kroll walks you into his office and closes the door with his foot, which you did not know was possible.' },
        { k: 'doc', doc: 'memo', value: '$40M AT PAR', line: 'He drops a deck on your desk. Forty million dollars of CASCADE paper, priced at par.' },
        { k: 'doc', doc: 'footnote', value: 'NOTE 14', line: 'Page nine, in grey eight-point type: the part of the story the deck leaves out.' },
        { k: 'face', who: 'Desmond Kroll', on: 'c1', line: '"Riverbend Teachers\' Retirement wants yield. Their consultant does not read footnotes. They buy it at par."' },
        { k: 'face', who: 'Desmond Kroll', on: 'c1', line: '"It is not lying. Everything in the deck is true. It is just not all of it."' },
        { k: 'clock', time: '3:14 PM', note: 'WIRE WINDOW CLOSES 4:00', line: 'Eleven thousand retired teachers. Forty-six minutes.' }
      ],
      after: {
        dump: [
          { k: 'doc', doc: 'voicemail', value: 'RIVERBEND ON SPEAKER', line: 'The consultant asks two questions. Neither is the right one.' },
          { k: 'doc', doc: 'ticket', value: 'WIRE CLEARED 3:51', line: 'The wire clears at 3:51 PM. Eleven thousand retired teachers now own forty million dollars nobody wanted.' },
          { k: 'face', who: 'Imani Rhodes', on: 'floor', line: 'Imani watched the whole call from four desks away. She has not said a word since.' }
        ],
        refuse: [
          { k: 'face', who: 'Desmond Kroll', on: 'c1', line: '"Noted," he says, and writes nothing down, which is worse.' },
          { k: 'floor', z: 0.45, line: 'Someone else does the call within the hour. The paper still moves.' },
          { k: 'doc', doc: 'ticket', value: 'LEVERAGE 3X', line: 'Your refusal changed one thing: your leverage limit, which is now 3x.' }
        ],
        leak: [
          { k: 'room', room: 'c9', line: 'You photograph fourteen pages in a stairwell, at a bad angle, with your phone.' },
          { k: 'text', from: 'SANA FERREIRA', body: 'I have it. Do not email me again from that address.', line: 'Sana Ferreira replies in ninety seconds.' },
          { k: 'desk', line: 'You go back to your desk and trade for three more hours like a person who did not just do that.' }
        ]
      },
      recap: { dump: 'You sold the Riverbend teachers the paper.', refuse: 'You refused the pension dump.', leak: 'You sent the pension deck to Sana Ferreira.' }
    },

    c3: {
      shots: [
        { k: 'sky', line: 'The morning of the markup. Somebody on Senator Thorne\'s staff sent a car for you.' },
        { k: 'room', room: 'c3', line: 'The Senate Markets Committee room. The members are already in their seats, and nobody is looking at the bill.' },
        { k: 'doc', doc: 'memo', value: 'COMPUTE FREEDOM ACT', line: 'The bill on the dais. Forty pages. Nobody in this building has read page thirty.' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: 'Thorne does not sit down. He stands at the window with his back to you, which you suspect he practiced.' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: '"The Compute Freedom Act raises leverage limits for institutions funding compute infrastructure."' },
        { k: 'doc', doc: 'chart', value: 'EVERY DESK AT 6X', line: 'The chart in his folder: every desk on the street running six times its capital.' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: '"My colleagues will vote however the industry tells them to vote."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: '"And the industry will say whatever a working trader tells it to say."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: '"So. You are the working trader. Does it make the system stronger, or bigger right before it breaks?"' }
      ],
      after: {
        yes: [
          { k: 'room', room: 'c3', after: true, line: 'It clears committee in nine days. Leverage limits go up across the street.' },
          { k: 'doc', doc: 'ticket', value: 'LEVERAGE 6X', line: 'Your desk can now hold 6x. So can every desk that is worse at this than you are.' },
          { k: 'face', who: 'Imani Rhodes', on: 'floor', line: 'Imani reads the bill text twice, then goes home early for the first time in two years.' }
        ],
        no: [
          { k: 'doc', doc: 'vote', value: 'BY 4 VOTES', line: 'Your amendment survives by four votes. Position limits tighten everywhere.' },
          { k: 'doc', doc: 'ticket', value: 'LEVERAGE 3X', line: 'Your own book is capped at 3x now, which you argued for, which does not make it feel better on a fast day.' },
          { k: 'sky', line: 'Long after the vote, people will argue about whether those four votes mattered. They did.' }
        ],
        dodge: [
          { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: 'You give him forty minutes of balanced, careful, completely useless commentary.' },
          { k: 'face', who: 'Sen. Marcus Thorne', on: 'c3', line: '"Everybody wants to be in the room," he says at the door, "and nobody wants to be in the minutes."' },
          { k: 'doc', doc: 'vote', value: 'PASSED', line: 'The bill passes anyway, watered down, by a margin that would not have needed you.' }
        ]
      },
      recap: { yes: 'You backed the Compute Freedom Act.', no: 'You argued for tighter limits, and won by four votes.', dodge: 'You told Thorne nothing useful.' }
    },

    c5: {
      shots: [
        { k: 'sky', night: true, line: '10 PM on a Tuesday. Somebody on Thorne\'s staff put your name on a list.' },
        { k: 'room', room: 'c5', line: 'A conference room at Treasury. Across the street, every office is still lit. Nobody in this city is asleep.' },
        { k: 'doc', doc: 'ticket', value: 'RIDGEWAY: NO BID', line: 'Ridgeway\'s paper, after hours. There is no bid.' },
        { k: 'face', who: 'Adele Venn', on: 'c5', line: 'Secretary Venn has been awake for thirty-one hours. She has stopped pretending otherwise.' },
        { k: 'face', who: 'Adele Venn', on: 'c5', line: '"Ridgeway does not open tomorrow unless we do something."' },
        { k: 'doc', doc: 'memo', value: 'GUARANTEE TERM SHEET', line: 'The term sheet on the table. Two pages, and the first one is already initialled.' },
        { k: 'face', who: 'Adele Venn', on: 'c5', line: '"If we guarantee it, every bank on the street learns that we always will. If we don\'t, we find out what is connected to what."' },
        { k: 'face', who: 'Adele Venn', on: 'c5', line: '"You trade this paper. You are going to tell me which of those is worse."' },
        { k: 'clock', time: '11:02 PM', note: 'OVERNIGHT MARKETS OPEN 12:00', line: 'The overnight markets open in under an hour. Whatever this room decides, it decides before then.' }
      ],
      after: {
        bail: [
          { k: 'clock', time: '11:40 PM', note: 'GUARANTEE ANNOUNCED', line: 'They announce it at 11:40 PM. Futures gap up three percent.' },
          { k: 'doc', doc: 'post', value: 'PUBLIC MONEY PRIVATE BONUSES', line: 'By Friday the phrase "public money, private bonuses" is on every screen in the country, and it will be for a year.' },
          { k: 'face', who: 'Adele Venn', on: 'c5', line: 'It worked. That is the part people will find hardest to forgive.' }
        ],
        fail: [
          { k: 'clock', time: '11:40 PM', note: 'RIDGEWAY FILES', line: 'Ridgeway files at 11:40 PM. It is the largest failure in the country\'s history by a factor of four.' },
          { k: 'floor', z: 0.15, dark: true, line: 'By the open, three things nobody had connected to Ridgeway stop working.' },
          { k: 'face', who: 'Adele Venn', on: 'c5', line: 'Venn calls you at 6 AM. She does not say anything for a while. Then: "Come in."' }
        ],
        ban: [
          { k: 'clock', time: '4:00 AM', note: 'EMERGENCY ORDER', line: 'The emergency order lands at 4 AM. Short selling in financials is banned until further notice.' },
          { k: 'doc', doc: 'ticket', value: 'SPREADS X3', line: 'Volumes collapse. Spreads triple. Prices stop falling, which is not the same thing as prices being right.' },
          { k: 'desk', line: 'Your own shorts in those names are frozen exactly where they were. You had not thought about that until now.' }
        ]
      },
      recap: { bail: 'You told Treasury to guarantee Ridgeway.', fail: 'You told Treasury to let Ridgeway fail.', ban: 'You told Treasury to guarantee Ridgeway and ban the shorts.' }
    },

    c6: {
      shots: [
        { k: 'floor', z: 0.15, line: '4:40 PM. The valuation committee wants a trading signature on the CASCADE book by six.' },
        { k: 'room', room: 'c6', line: 'Kroll\'s office. The folder is already on his desk, which means he has been waiting.' },
        { k: 'floor', z: 0.45, line: 'He carries it to you himself. You have never seen him carry anything across this floor.' },
        { k: 'doc', doc: 'memo', value: 'MODEL: 61 CENTS', line: 'Page one: the model\'s mark. Sixty-one cents on the dollar.' },
        { k: 'doc', doc: 'chart', value: 'DESK: 22 CENTS', line: 'Page two: what the desk could actually sell it for. Twenty-two.' },
        { k: 'face', who: 'Desmond Kroll', on: 'c6', line: '"If we print twenty-two, our capital ratio breaks, and the regulator walks in tomorrow."' },
        { k: 'face', who: 'Desmond Kroll', on: 'c6', line: '"And six thousand people here find out what happens next."' },
        { k: 'face', who: 'Desmond Kroll', on: 'c6', line: '"Sign the sixty-one. It is a model output. Models are opinions. Opinions are not lies."' },
        { k: 'clock', time: '5:12 PM', note: 'SIGNATURE DUE 6:00', line: 'Forty-eight minutes. He leaves the pen uncapped on your desk.' }
      ],
      after: {
        sign: [
          { k: 'doc', doc: 'memo', value: 'SIGNED', line: 'You sign on the second page. It takes four seconds.' },
          { k: 'doc', doc: 'ticket', value: '+$60,000 STOCK', line: 'The ratio holds. The regulator comes Friday and leaves Friday. Sixty thousand dollars of restricted stock lands in your account.' },
          { k: 'sky', night: true, line: 'Every one of those things is a separate reason you will not sleep well.' }
        ],
        refuse: [
          { k: 'floor', z: 0.45, line: 'He finds another signature in twenty minutes. Signatures are not rare.' },
          { k: 'doc', doc: 'memo', value: '61 CENTS', line: 'The marks go out at sixty-one anyway. The only difference is whose name is on page two.' },
          { k: 'desk', line: 'That evening you are taken off the valuation distribution list, which is how this firm says goodbye.' }
        ],
        report: [
          { k: 'desk', line: 'The form is eleven pages. You fill it out at your own desk, which feels insane, because it is.' },
          { k: 'text', from: 'ENFORCEMENT', body: 'We have your submission. Do not discuss it internally.', line: 'Confirmation arrives in four minutes.' },
          { k: 'room', room: 'c6', line: 'Kroll walks past you twice that afternoon without turning his head. He already knows.' }
        ]
      },
      recap: { sign: 'You signed the marks at sixty-one.', refuse: 'You refused to sign the marks.', report: 'You reported the marks to the regulator.' }
    },

    c7: {
      shots: [
        { k: 'sky', night: true, line: 'The next evening. A buyer has agreed to take the CASCADE paper at twenty-two cents.' },
        { k: 'room', room: 'c7', line: 'Kroll\'s office after hours. The lamp is on, and the champagne is still in its box.' },
        { k: 'face', who: 'Desmond Kroll', on: 'c7', line: 'Kroll is pleased with himself. The press release is already open on his screen.' },
        { k: 'doc', doc: 'post', value: 'SOLD AT 22 CENTS', line: 'It goes out at eight tomorrow: SOLD AT TWENTY-TWO.' },
        { k: 'doc', doc: 'footnote', value: 'ADDENDUM', line: 'Then Legal slides one more page across the table. An addendum.' },
        { k: 'doc', doc: 'memo', value: '75% FINANCED', line: 'Holloway Stern lends the buyer seventy-five percent of the price, secured only by the paper itself.' },
        { k: 'doc', doc: 'chart', value: 'AT RISK: 5.5 CENTS', line: 'The headline says twenty-two. The money actually at risk says five and a half.' },
        { k: 'face', who: 'Desmond Kroll', on: 'c7', line: '"It is a financing," he says. "We do them every day. Sign it and we all go home."' },
        { k: 'clock', time: '9:20 PM', note: 'CLOSING AT 8:00 AM', line: 'Sign the financing, refuse it, or expose the whole transaction.' }
      ],
      after: {
        finance: [
          { k: 'doc', doc: 'memo', value: 'SIGNED', line: 'You sign. The paper leaves the building, and most of its risk stays behind.' },
          { k: 'doc', doc: 'post', value: 'SOLD AT 22 CENTS', line: 'The press release says twenty-two cents. Nobody prints five and a half.' }
        ],
        refuse: [
          { k: 'face', who: 'Desmond Kroll', on: 'c7', line: 'The buyer walks before the ink dries.' },
          { k: 'doc', doc: 'memo', value: '22 CENTS?', line: 'Twenty-two was never a price. Without your loan it is only a sentence in a press release.' }
        ],
        expose: [
          { k: 'text', from: 'SANA FERREIRA', body: 'Received.', line: 'The addendum reaches Sana before Legal notices it is missing.' },
          { k: 'doc', doc: 'post', value: 'THE 5.5 CENT SALE', line: 'By morning, everybody can do the five-and-a-half-cent arithmetic.' }
        ]
      },
      recap: { finance: 'You financed the buyer and hid the risk.', refuse: 'You refused the financing.', expose: 'You sent the addendum to Sana.' }
    },

    c12: {
      shots: [
        { k: 'tableau', n: 15, line: 'Three weeks ago the President showed the country a chart: a spiral of machines on Kavra, building machines.' },
        { k: 'floor', z: 0.45, dark: true, line: 'After the close. The floor is half empty, and the chart from the address is still on every screen.' },
        { k: 'text', from: 'SEN. MARCUS THORNE', body: 'Calling...', line: 'Your phone lights up. Senator Thorne, from his own office.' },
        { k: 'room', room: 'c12', line: 'Thorne\'s office after dark. The Spiral chart stands on an easel by the window.' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c12', line: '"On Wednesday the committee hears the Spiral case."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c12', line: '"I need a trader who will say the Kavran machines are real, and the chips feeding them are a threat."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c12', line: '"You have watched those order books for months. You would be believed."' },
        { k: 'doc', doc: 'chart', value: 'THE SPIRAL', line: 'On your desk sits the chart from the address. The shape is familiar.' },
        { k: 'doc', doc: 'ticket', value: 'YOUR FILLS', line: 'You have seen it before. In your own fills.' }
      ],
      after: {
        back: [
          { k: 'face', who: 'Sen. Marcus Thorne', on: 'c12', line: 'You agree to testify. Thorne\'s staff send talking points before you have hung up.' },
          { k: 'doc', doc: 'memo', value: 'TALKING POINTS', line: 'None of them mention Mirren by name.' }
        ],
        trace: [
          { k: 'face', who: 'Imani Rhodes', on: 'floor', line: 'You ask Imani to match the Spiral chart against the tape.' },
          { k: 'doc', doc: 'chart', value: 'ORDER FOR ORDER', line: 'She lays it over the market\'s own fills. They match, order for order.' },
          { k: 'racks', line: 'The machines copying machines were ours.' }
        ],
        decline: [
          { k: 'text', from: 'SEN. MARCUS THORNE', body: 'Call ended.', line: 'Thorne finds another witness before midnight.' }
        ]
      },
      recap: { back: 'You agreed to testify for the Spiral.', trace: 'You traced the Spiral chart to our own machines.', decline: 'You stayed out of the Spiral hearing.' }
    },

    c8: {
      shots: [
        { k: 'sky', night: true, line: '9 PM. The Capitol is lit up like it is still in session, because it is.' },
        { k: 'room', room: 'c8', line: 'The chamber\'s tally board. The Stabilization Act is four votes short.' },
        { k: 'text', from: 'SEN. MARCUS THORNE', body: 'Calling...', line: 'Thorne calls from a corridor. You can hear a vote bell behind him.' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c8', line: '"Stabilization Act. A seven hundred billion dollar guarantee facility."' },
        { k: 'doc', doc: 'vote', value: '4 SHORT', line: '"And it is four votes short. Four."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c8', line: '"Some of those votes listen to people who listen to you."' },
        { k: 'face', who: 'Sen. Marcus Thorne', on: 'c8', line: '"You want to be useful? Now is the only time it counts."' },
        { k: 'clock', time: '9:04 PM', note: 'VOTE TONIGHT', line: 'The vote is tonight. Every number you need is already in your phone.' }
      ],
      after: {
        whip: [
          { k: 'desk', line: 'You make fourteen calls.' },
          { k: 'room', room: 'c8', after: true, line: 'Two of them matter. You will never find out which two.' }
        ],
        against: [
          { k: 'face', who: 'Sen. Marcus Thorne', on: 'c8', line: '"I hope you can live with the arithmetic," he says.' },
          { k: 'room', room: 'c8', after: true, line: 'He hangs up before you can answer.' }
        ],
        position: [
          { k: 'doc', doc: 'ticket', value: 'LONG AND SHORT', line: 'You buy protection on both sides of the tape and tell yourself that is not a position.' },
          { k: 'room', room: 'c8', after: true, line: 'It is a position.' }
        ]
      },
      recap: { whip: 'You worked the phones for the Stabilization Act.', against: 'You worked against the Stabilization Act.', position: 'You straddled the Stabilization Act vote.' }
    },

    c9: {
      shots: [
        { k: 'floor', z: 0.15, dark: true, line: '7 PM. The floor is dark except for the screens nobody bothered to turn off.' },
        { k: 'room', room: 'c9', line: 'The stairwell between forty and forty-one. The exit sign has been flickering for a month.' },
        { k: 'face', who: 'Imani Rhodes', on: 'c9', line: 'Imani is waiting for you, with a folder she should not have.' },
        { k: 'face', who: 'Imani Rhodes', on: 'c9', line: '"Enforcement wants someone who was in the room. Not a witness. A participant."' },
        { k: 'doc', doc: 'memo', value: 'COOPERATION TERMS', line: '"They are offering full cooperation terms, and they are offering them today."' },
        { k: 'face', who: 'Imani Rhodes', on: 'c9', line: '"There is also a car downstairs that Kroll sent, and there is a plane at a private airfield."' },
        { k: 'text', from: 'TREASURY', body: '2 missed calls', line: '"And a man from Treasury who has called you twice."' },
        { k: 'face', who: 'Imani Rhodes', on: 'c9', line: '"Everyone is offering you something. Pick one, and pick it now."' },
        { k: 'face', who: 'Imani Rhodes', on: 'c9', line: '"Tomorrow there is only one option left, and it is not a good one."' }
      ],
      after: {
        testify: [
          { k: 'doc', doc: 'memo', value: 'DEPOSITION: DAY 2', line: 'It takes nine hours over two days and a lawyer you cannot really afford.' },
          { k: 'doc', doc: 'footnote', value: 'TRANCHE', line: 'At one point you explain what a tranche is to someone who will later write the law about tranches.' },
          { k: 'sky', line: 'You walk out at 6 PM on the second day and nobody is waiting for you, which is the whole point.' }
        ],
        public: [
          { k: 'doc', doc: 'post', value: '9,000 WORDS', line: 'Nine thousand words overnight, with the valuation deck reproduced in full on page A14.' },
          { k: 'floor', z: 0.15, line: 'By morning it is the only thing anyone is talking about.' },
          { k: 'text', from: 'SANA FERREIRA', body: 'Thank you.', line: 'Sana calls once, to say thank you, and then never contacts you again, which is how she protects you.' }
        ],
        treasury: [
          { k: 'room', room: 'c5', line: 'Deputy Secretary for Financial Stability. The office has a window and a fern that somebody else waters.' },
          { k: 'doc', doc: 'memo', value: 'BRIEFING: CASCADE', line: 'On your first day you are handed a briefing on the exact paper you spent the year trading.' },
          { k: 'face', who: 'Adele Venn', on: 'c5', line: 'You are, unfortunately, the most qualified person in the room.' }
        ],
        flee: [
          { k: 'doc', doc: 'ticket', value: 'LIQUIDATED', line: 'You liquidate the entire book in ninety minutes of after-hours trading, at prices that make you wince.' },
          { k: 'clock', time: '1:40 AM', note: 'WHEELS UP', line: 'The wire goes out at 11 PM. The plane leaves at 1:40 AM.' },
          { k: 'text', from: 'IMANI RHODES', body: '1 unread message', line: 'Imani sends one message while you are taxiing. You do not open it.' }
        ],
        quiet: [
          { k: 'face', who: 'Imani Rhodes', on: 'c9', line: '"Okay," Imani says, after a long time. "Okay."' },
          { k: 'desk', line: 'You go back upstairs and work an order, because it is the only thing in the building that still makes sense.' },
          { k: 'floor', z: 0.15, dark: true, line: 'Nobody comes for you. That is not the same as being fine.' }
        ]
      },
      recap: { testify: 'You cooperated with Enforcement.', public: 'You gave everything to Sana.', treasury: 'You took the Treasury job.', flee: 'You took the plane.', quiet: 'You went back to the desk and said nothing.' }
    },

    c10: {
      shots: [
        { k: 'sky', night: true, line: 'The market is closed. For the first time all week, the machines are still.' },
        { k: 'floor', z: 0.15, dark: true, line: 'The floor is dark. Not one screen moves.' },
        { k: 'room', room: 'c10', line: 'Two floors down, the rack room hums anyway.' },
        { k: 'face', who: 'Imani Rhodes', on: 'c10', line: 'Imani has been here since the close. She has mapped the execution layer behind every fill.' },
        { k: 'doc', doc: 'ticket', value: 'ONE COUNTERPARTY', line: 'Every system on the street trades through the same shared counterparty.' },
        { k: 'face', who: 'Imani Rhodes', on: 'c10', line: '"Kill Holloway Stern\'s access token, and the others reject that counterparty at Monday\'s open."' },
        { k: 'doc', doc: 'ticket', value: 'YOUR BOOK: FLAT', line: 'It will also flatten your book into whatever price exists first.' },
        { k: 'face', who: 'Imani Rhodes', on: 'c10', line: '"The market may survive. Your money will not."' },
        { k: 'clock', time: '3:12 AM', note: 'TOKEN ACTIVE', line: 'Her hand is on the switch. She is waiting for you.' }
      ],
      after: {
        pull: [
          { k: 'clock', time: '3:17 AM', note: 'TOKEN REVOKED', line: 'The token dies at 3:17 AM.' },
          { k: 'room', room: 'c10', after: true, line: 'One by one, the racks go dark.' },
          { k: 'doc', doc: 'ticket', value: '40% GAP', line: 'At 9:30 the book is flattened into a forty-percent gap. The exchange halts for the day. Human bids come back on Tuesday.' }
        ],
        leave: [
          { k: 'desk', line: 'You close the laptop.' },
          { k: 'sky', night: true, line: 'Across the street, identical systems wait for the same opening print.' }
        ]
      },
      recap: { pull: 'You pulled the plug at 3:17 AM.', leave: 'You left the machines running.' }
    },

    // ---------------------------------------------------------------- home
    adopt: {
      shots: [
        { k: 'sky', line: 'Walking home after the close. The shelter on your block still has its lights on.' },
        { k: 'doc', doc: 'memo', value: 'PROVE US WRONG', line: 'A sign in the window: NOBODY ADOPTS IN A CRASH. PROVE US WRONG.' },
        { k: 'room', room: 'adopt', line: 'Inside it smells like bleach and kibble. Most of the kennels are empty.' },
        { k: 'face', who: 'Harbor Street Animal Shelter', on: 'adopt', line: 'The volunteer has been here since six this morning, and is still smiling.' },
        { k: 'face', who: 'Harbor Street Animal Shelter', on: 'adopt', line: '"These four have been here the longest. Somebody should take one home."' },
        { k: 'room', room: 'adopt', line: 'The orange cats stare at you like risk managers.' },
        { k: 'room', room: 'adopt', line: 'The brown dogs have already decided you are the one.' },
        { k: 'clock', time: '7:55 PM', note: 'CLOSING AT 8:00', line: 'The shelter closes in five minutes. The forms are ready, just in case.' }
      ],
      after: {
        'cat-boy': [{ k: 'doc', doc: 'memo', value: 'ADOPTED: ROSCO', line: 'A hundred and fifty dollars and one signature.' }, { k: 'home', line: 'Rosco inspects every corner of the apartment, then falls asleep on the one warm spot on the radiator.' }],
        'cat-girl': [{ k: 'doc', doc: 'memo', value: 'ADOPTED: JEMMA', line: 'A hundred and fifty dollars and one signature.' }, { k: 'home', line: 'Jemma inspects every corner of the apartment, then falls asleep on the one warm spot on the radiator.' }],
        'dog-boy': [{ k: 'doc', doc: 'memo', value: 'ADOPTED: ROSCO', line: 'A hundred and fifty dollars and one signature.' }, { k: 'home', line: 'Rosco is waiting at the door when you get home. He will be waiting at the door every night.' }],
        'dog-girl': [{ k: 'doc', doc: 'memo', value: 'ADOPTED: JEMMA', line: 'A hundred and fifty dollars and one signature.' }, { k: 'home', line: 'Jemma is waiting at the door when you get home. She will be waiting at the door every night.' }],
        pass: [
          { k: 'face', who: 'Harbor Street Animal Shelter', on: 'adopt', line: 'You tell the volunteer you work too much.' },
          { k: 'room', room: 'adopt', line: 'She says everybody does, and writes nothing down.' }
        ]
      },
      recap: { 'cat-boy': 'You took Rosco home.', 'cat-girl': 'You took Jemma home.', 'dog-boy': 'You took Rosco home.', 'dog-girl': 'You took Jemma home.', pass: 'You walked past the shelter.' }
    },

    dentist: {
      shots: [
        { k: 'sky', line: 'Home after the close. The light on your phone is blinking.' },
        { k: 'room', room: 'dentist', line: 'One new voicemail. Twenty-two seconds.' },
        { k: 'face', who: 'Your dentist', on: 'dentist', line: '"Hi, this is the front desk. You are overdue for your cleaning."' },
        { k: 'face', who: 'Your dentist', on: 'dentist', line: '"We have a 7 AM on Saturday."' },
        { k: 'clock', time: '7:00 AM', note: 'SATURDAY', line: 'Seven in the morning, on the one day you sleep.' },
        { k: 'face', who: 'Your dentist', on: 'dentist', line: '"Insurance covers most of it." A pause. "Most."' },
        { k: 'room', room: 'dentist', line: 'The voicemail ends. The light keeps blinking anyway.' }
      ],
      after: {
        go: [
          { k: 'room', room: 'toothache', line: 'Saturday, 7 AM, in the chair.' },
          { k: 'face', who: 'Your dentist', on: 'toothache', line: 'The hygienist asks if you grind your teeth. You say no. She does not believe you.' }
        ],
        skip: [
          { k: 'room', room: 'dentist', line: 'You delete the voicemail.' },
          { k: 'text', from: 'DENTIST', body: '1 missed call', line: 'The front desk will call again. They always call again.' }
        ]
      },
      recap: { go: 'You went to the dentist.', skip: 'You skipped the cleaning.' }
    },

    vetCheck: {
      shots: [
        { k: 'sky', line: 'Home after the close. The mail is on the mat.' },
        { k: 'room', room: 'vetCheck', line: 'Under the bills: a postcard with a cartoon stethoscope on it.' },
        { k: 'doc', doc: 'memo', value: 'CHECKUP DUE', line: '{pet} is due for a checkup and vaccines.' },
        { k: 'home', line: '{pet} watches you read it and says nothing, which is how animals negotiate.' },
        { k: 'face', who: 'Your vet', on: 'vetCheck', line: 'The vet has signed the back by hand: "See you soon, {pet}."' },
        { k: 'doc', doc: 'ticket', value: 'CHECKUP $220', line: 'Checkup and shots. Two hundred and twenty dollars.' },
        { k: 'home', line: '{pet} yawns. The decision, apparently, is yours.' }
      ],
      after: {
        go: [
          { k: 'room', room: 'vetER', line: 'The exam room smells like other people\'s dogs.' },
          { k: 'face', who: 'Your vet', on: 'vetER', line: 'The vet says {pet} is healthy and slightly spoiled. You take it as a compliment.' }
        ],
        skip: [
          { k: 'room', room: 'vetCheck', line: 'The postcard goes under a magnet on the fridge, next to the other things you will deal with later.' }
        ]
      },
      recap: { go: 'You took {pet} for a checkup.', skip: 'You skipped {pet}\'s checkup.' }
    },

    rentHike: {
      shots: [
        { k: 'sky', line: 'Coming home through the lobby. The front desk is gone.' },
        { k: 'room', room: 'rentHike', line: 'Where the doorman used to sit, there is a screen with a smiling face on it.' },
        { k: 'face', who: 'Your landlord', on: 'rentHike', line: '"New owners. The building runs on the same kind of model you trade against now."' },
        { k: 'face', who: 'Your landlord', on: 'rentHike', line: '"It has reviewed your unit."' },
        { k: 'doc', doc: 'memo', value: 'RENT +9%', line: 'Rent goes up nine percent from next week.' },
        { k: 'face', who: 'Your landlord', on: 'rentHike', line: '"The system says congratulations."' },
        { k: 'room', room: 'rentHike', line: 'The smiling face blinks twice. It does not take questions.' },
        { k: 'home', line: 'Upstairs, your apartment looks exactly the way it did this morning. It costs more now.' }
      ],
      after: {
        accept: [{ k: 'doc', doc: 'memo', value: 'SIGNED', line: 'You sign. The email thanks you in three languages.' }],
        push: [
          { k: 'face', who: 'Your landlord', on: 'rentHike', unless: 'rentHalved', line: 'The system does not negotiate. The increase stands.' },
          { k: 'home', night: true, unless: 'rentHalved', line: 'You lie awake composing replies.' },
          { k: 'face', who: 'Your landlord', on: 'rentHike', if: 'rentHalved', line: 'You mention the hearing you might testify at. The system halves the increase.' }
        ],
        move: [
          { k: 'doc', doc: 'memo', value: 'NOTICE GIVEN', line: 'You give notice. Somewhere cheaper, this weekend.' },
          { k: 'home', line: 'Your sibling shows up with a borrowed van and says nothing about the promise you broke to help them move.' }
        ]
      },
      recap: { accept: 'You took the rent hike.', push: 'You pushed back on the rent hike.', move: 'You moved somewhere cheaper.' }
    },

    dadBill: {
      shots: [
        { k: 'sky', line: 'After the close. Your phone has been buzzing in your pocket since the bell.' },
        { k: 'room', room: 'dadBill', line: 'Mom. Calling, not texting, which she only does when something is wrong.' },
        { k: 'face', who: 'Mom', on: 'dadBill', line: '"It\'s your father. The procedure went fine. He\'s fine."' },
        { k: 'face', who: 'Mom', on: 'dadBill', line: '"The insurance says the surgeon was out of network."' },
        { k: 'doc', doc: 'memo', value: '$14,200 DUE', line: 'A photo of the bill comes through while she is still talking.' },
        { k: 'face', who: 'Mom', on: 'dadBill', line: '"It\'s fourteen thousand two hundred."' },
        { k: 'face', who: 'Mom', on: 'dadBill', line: '"I didn\'t want to ask."' },
        { k: 'room', room: 'dadBill', line: 'She waits. You can hear the TV behind her, and your father asking who it is.' }
      ],
      after: {
        pay: [
          { k: 'doc', doc: 'ticket', value: 'SENT $14,200', line: 'You pay all of it.' },
          { k: 'face', who: 'Mom', on: 'dadBill', line: 'She cries a little. Then she tells you about the nurse who was kind to him.' }
        ],
        plan: [
          { k: 'doc', doc: 'memo', value: '$7,100 NOW', line: 'Half now, and fourteen hundred and twenty every Friday for five weeks.' },
          { k: 'face', who: 'Mom', on: 'dadBill', line: '"Thank you. We\'ll manage the rest." You set up the plan on your phone in the cab.' }
        ],
        insurer: [
          { k: 'face', who: 'Mom', on: 'dadBill', line: '"Of course. You\'re busy." She hangs up before you can say you\'ll call tomorrow.' },
          { k: 'room', room: 'dadBill', line: 'You do not call tomorrow.' }
        ]
      },
      recap: { pay: 'You paid Dad\'s surgery bill.', plan: 'You paid half of Dad\'s bill, and the rest over five weeks.', insurer: 'You left Mom to call the insurer.' }
    },

    toothache: {
      shots: [
        { k: 'floor', z: 0.45, line: 'It started as a twinge during the open.' },
        { k: 'desk', line: 'By the close, you are chewing on nothing at all.' },
        { k: 'text', from: 'DENTIST', body: 'We can fit you in tonight.', line: 'You call the emergency line from the elevator.' },
        { k: 'room', room: 'toothache', line: 'The clinic at 8 PM. One light on, one chair, and one dentist who stayed late.' },
        { k: 'face', who: 'Your dentist', on: 'toothache', line: '"It is a crown now. Maybe a root canal."' },
        { k: 'doc', doc: 'memo', value: 'ESTIMATE $1,400', line: 'The estimate, on a clipboard.' },
        { k: 'face', who: 'Your dentist', on: 'toothache', line: '"The cleaning would have caught it."' },
        { k: 'room', room: 'toothache', line: 'The chair is already tilted back.' }
      ],
      after: {
        fix: [
          { k: 'room', room: 'toothache', line: 'Two hours in the chair.' },
          { k: 'sky', night: true, line: 'The numbness wears off somewhere around the second bridge on the way home.' }
        ],
        live: [
          { k: 'desk', line: 'You learn to chew on the left side.' },
          { k: 'floor', z: 0.45, line: 'It becomes the kind of thing you stop noticing, mostly.' }
        ]
      },
      recap: { fix: 'You got the molar fixed.', live: 'You lived with the toothache.' }
    },

    vetER: {
      shots: [
        { k: 'home', line: '{pet} has not eaten since yesterday.' },
        { k: 'home', night: true, line: '{pet} has not moved from that spot all day.' },
        { k: 'text', from: 'VET, AFTER HOURS', body: 'Bring {him} in tonight.', line: 'You call the after-hours line at 10 PM.' },
        { k: 'face', who: 'Your vet', on: 'vetER', line: '"Bring {him} in tonight. It is probably treatable."' },
        { k: 'doc', doc: 'memo', value: 'ER VISIT $900', line: 'The emergency vet takes the deposit up front.' },
        { k: 'face', who: 'Your vet', on: 'vetER', line: '"The checkup would have caught it."' },
        { k: 'room', room: 'vetER', line: 'The exam light clicks on.' }
      ],
      after: {
        pay: [
          { k: 'room', room: 'vetER', line: 'Antibiotics, a cone and a bill.' },
          { k: 'home', line: 'By the weekend {pet} is back at the window, judging the pigeons.' }
        ],
        wait: [
          { k: 'home', night: true, line: '{pet} comes out on the third day, thinner and slower.' },
          { k: 'home', line: '{He} gets better on {his} own. Mostly.' }
        ]
      },
      recap: { pay: 'You took {pet} to the emergency vet.', wait: 'You waited, and {pet} got better on {his} own.' }
    },

    advance: {
      shots: [
        { k: 'sky', night: true, line: 'Kroll\'s treat. A steakhouse with no prices on the menu.' },
        { k: 'room', room: 'advance', line: 'Steak, the good wine, and a toast to "the bottom being in."' },
        { k: 'face', who: 'Desmond Kroll', on: 'advance', line: '"Pool closes the first of the year."' },
        { k: 'face', who: 'Desmond Kroll', on: 'advance', line: '"Your number is looking good."' },
        { k: 'room', room: 'advance', line: 'He slides an envelope across the tablecloth.' },
        { k: 'doc', doc: 'memo', value: 'ADVANCE $8,000', line: '"HR can advance you eight thousand against it. Tonight."' },
        { k: 'face', who: 'Desmond Kroll', on: 'advance', line: '"Don\'t do anything stupid before then."' },
        { k: 'room', room: 'advance', line: 'The envelope sits next to your plate. The waiter pretends not to see it.' }
      ],
      after: {
        take: [
          { k: 'doc', doc: 'ticket', value: '+$8,000', line: 'The money lands before dessert.' },
          { k: 'face', who: 'Imani Rhodes', on: 'floor', line: 'Imani, when you tell her, says: "Bonus money is a loan from the future."' }
        ],
        decline: [
          { k: 'face', who: 'Desmond Kroll', on: 'advance', line: 'Kroll shrugs. "Suit yourself."' },
          { k: 'room', room: 'advance', line: 'The quota slip is already on your plate.' }
        ]
      },
      recap: { take: 'You took the $8,000 advance.', decline: 'You turned down the advance.' }
    },

    perry: {
      shots: [
        { k: 'sky', night: true, line: 'Late. One voicemail, from a number you have not seen in a year.' },
        { k: 'room', room: 'perry', line: 'Perry Nakash. Forty-one seconds.' },
        { k: 'face', who: 'Perry Nakash', on: 'perry', line: '"The committee was replaced by the model. All of us."' },
        { k: 'face', who: 'Perry Nakash', on: 'perry', line: '"They gave us a box and a lanyard to keep."' },
        { k: 'room', room: 'perry', line: 'A long pause on the tape. You can hear traffic behind him.' },
        { k: 'face', who: 'Perry Nakash', on: 'perry', line: '"Six thousand."' },
        { k: 'face', who: 'Perry Nakash', on: 'perry', line: '"I\'ll pay you back. I always do."' },
        { k: 'room', room: 'perry', line: 'The voicemail ends. Your thumb is over the call-back button.' }
      ],
      after: {
        lend: [
          { k: 'doc', doc: 'ticket', value: 'SENT $6,000', line: 'You lend him the six thousand.' },
          { k: 'text', from: 'PERRY NAKASH', body: 'Thank you.', line: 'He texts a single word: "Thank you."' },
          { k: 'text', from: 'PERRY NAKASH', body: 'I mean it.', line: 'Then, an hour later: "I mean it."' }
        ],
        give: [
          { k: 'doc', doc: 'ticket', value: 'SENT $6,000', line: 'You tell him not to pay you back.' },
          { k: 'face', who: 'Perry Nakash', on: 'perry', line: 'He calls instead of texting. Neither of you says much. It is the best call you have had in weeks.' }
        ],
        refuse: [
          { k: 'room', room: 'perry', line: 'You do not call back.' },
          { k: 'text', from: 'PERRY NAKASH', body: 'Voicemail, 0:41', line: 'The voicemail stays at the top of the list for the rest of the year.' }
        ]
      },
      recap: { lend: 'You lent Perry six thousand.', give: 'You gave Perry six thousand.', refuse: 'You did not call Perry back.' }
    },

    pension: {
      shots: [
        { k: 'sky', night: true, line: '10:40 at night. Mom never calls this late.' },
        { k: 'room', room: 'pension', line: 'The phone buzzes its way across the kitchen counter.' },
        { k: 'face', who: 'Mom', on: 'pension', line: '"A letter from Riverbend came today."' },
        { k: 'doc', doc: 'memo', value: 'BENEFITS -22%', line: 'Riverbend Teachers\' Retirement. Benefits cut twenty-two percent from January.' },
        { k: 'face', who: 'Mom', on: 'pension', line: '"Twenty-two percent."' },
        { k: 'doc', doc: 'memo', value: '$40M AT PAR', if: 'dumped', line: 'Riverbend. The fund you sold forty million dollars of CASCADE paper to, at par.' },
        { k: 'room', room: 'pension', unless: 'dumped', line: 'Riverbend. You have read the name in your own feed all year.' },
        { k: 'face', who: 'Mom', on: 'pension', line: '"Your father says we\'ll manage."' },
        { k: 'face', who: 'Mom', on: 'pension', line: '"We won\'t."' }
      ],
      after: {
        monthly: [
          { k: 'doc', doc: 'ticket', value: '$290 A WEEK', line: 'Two hundred and ninety a week, home, through the winter.' },
          { k: 'face', who: 'Mom', on: 'pension', line: '"You don\'t have to." You do anyway.' }
        ],
        once: [
          { k: 'doc', doc: 'ticket', value: 'SENT $5,000', line: 'Five thousand, once.' },
          { k: 'face', who: 'Mom', on: 'pension', line: 'She says it will cover the winter. It will cover most of it.' }
        ],
        cant: [
          { k: 'face', who: 'Mom', on: 'pension', line: '"I know, sweetheart. I know." She sounds relieved you said it first.' }
        ]
      },
      recap: { monthly: 'You sent money home every week.', once: 'You sent Mom five thousand.', cant: 'You told Mom you could not help.' }
    }
  };

  // How long the scene before the choices runs, and the gaps a caption needs.
  const TARGET = 45;
  B.ScreenplayData = { SCRIPTS, TARGET };
})(window.BTB);
