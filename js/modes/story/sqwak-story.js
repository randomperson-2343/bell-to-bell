// SQWAK STORY CONTENT: authored social posts for all 46 career sessions.
//
// Two layers per session:
//   INTRADAY[d]  posts that land on the comms monitor during market hours.
//                Posts from 1M+ accounts that name a $TICKER with a clear lean
//                move that stock briefly (see js/market/sqwak.js).
//   PREOPEN[d]   items for the phone before the bell. They fill the slots
//                left after the day's lead headline and its anomaly; the rest
//                come from the act's pool so no session repeats a line.
//
// Everything here is invented: people, firms, handles, places and events.
(function (B) {
  'use strict';
  const D = B.StoryData;

  // [minute after the open, handle, text, 'fake'?]  A post marked 'fake' is a
  // rumour that never comes true; resqwaking it costs heat.
  const INTRADAY = [
    /* D1 First Day */ [[20,'@ScalingLawSteve','LATTICE-9 drops this morning. loading $CRVS calls before the rest of you wake up'],[95,'@GPUgoblin','every datacenter on earth just got a new reason to exist'],[180,'@TheTapeReader','$FRLN volume creeping up with zero news. somebody knows something'],[300,'@PitBoss41','first day kids: the bell at 4 is not a suggestion. neither is your stop']],
    /* D2 Release Notes */ [[45,'@PromptAndPray','LATTICE-9 release notes are 212 pages. nobody has read past page 3 and nobody will'],[130,'@Quant_Kween','The eval section of the $CRVS notes lists "treasury and liquidity operations." Why does a model need that? Bullish, apparently.'],[220,'@DeepValueDane','capex forecasts up again. somebody has to pay for the concrete'],[320,'@CallsOnlyCarl','$VYRN is the cheapest chip name on the board. loading']],
    /* D3 The Rumor */ [[60,'@TheTapeReader','$RDGW calls lighting up out of nowhere this morning'],[125,'@DiamondHandsDiane','RIDGEWAY BUYOUT?? $RDGW loaded. screenshot this','fake'],[160,'@FloorTalk','The Ridgeway denial is on the Wire. The buyout post still has more likes than the denial has views.'],[240,'@PromptAndPray','the lie got 18K likes. the correction got a press release']],
    /* D4 Six Point Four */ [[90,'@BondVigilante','Delinquency print at 1:25. Hearing it will be ugly. $FRLN'],[240,'@CallsOnlyCarl','6.4% delinquencies is priced in. buying $FRLN'],[300,'@Quant_Kween','Delinquencies up two points in a year. CASCADE still AAA. One of those numbers is wrong.'],[370,'@PitBoss41','somebody on 41 is getting the quiet walk to the corner office. not naming names']],
    /* D5 Still AAA */ [[35,'@FloorTalk','Meridian affirms AAA on the entire CASCADE vintage, eleven minutes after the delinquency report.'],[140,'@TendiesTomorrow','AAA means AAA. $HLST bounce is just starting. buying'],[260,'@DeepValueDane','a rating is an opinion somebody paid for. remember who paid']],
    /* D6 Fairline Files */ [[60,'@TheTapeReader','$FRLN falling with nobody on the bid. not halted. just empty'],[170,'@BearCaveBets','$FRLN goes bankrupt today. been saying it for weeks. short anything with a consumer loan in it'],[230,'@DiamondHandsDiane','fairline is bankrupt and the index is at a record. the system works'],[330,'@MacroMaven','A consumer lender failed and the index closed at a record. Read that sentence twice.']],
    /* D7 The Strait */ [[20,'@FloorTalk','Overnight incident in the Kavro Strait. Defense bid, silicon offered.'],[110,'@CallsOnlyCarl','$VNTR calls. conflict is bullish. do not @ me'],[200,'@GPUgoblin','rare earth licences suspended. my accelerators are made of rare earth. i am the rare earth'],[310,'@MacroMaven','Markets price a conflict as a sector rotation. People living near the strait price it differently.']],
    /* D8 Form Four */ [[80,'@TheTapeReader','$FRLN insider filings from last month are wild. who files these that late'],[200,'@SanaFerreira','Working on who knew what at Fairline, and when. DMs open.'],[320,'@BearCaveBets','fairline\'s chief executive sold 40% before the filing. of course he did']],
    /* D9 A Circle */ [[5,'@Quant_Kween','A research note on $THSI and $HALO revenue recognition lands at the open. It is bad. We are selling.'],[60,'@CallsOnlyCarl','one research note written by a robot and everyone panics. buying $THSI'],[160,'@SanaFerreira','Thorncrest invested in Halcyon. Halcyon bought Thorncrest chips with it. Both called it revenue. This has a name: vendor financing.'],[280,'@PromptAndPray','they sold chips to themselves and called it demand. we are all going to be fine though']],
    /* D10 The Physical World */ [[15,'@MacroMaven','Three grid operators rejecting gigawatt interconnects. The first constraint money cannot print its way around.'],[110,'@CallsOnlyCarl','grid problems means power stocks go up. $CLDR calls. easy'],[210,'@FlopsPerDollar','turns out you need electricity. nobody modelled electricity'],[330,'@Quant_Kween','Four-year interconnect queues. A datacenter with no power is a very expensive warehouse.']],
    /* D11 Nineteen Percent */ [[60,'@BearCaveBets','Bastion guidance about to get slashed. $BSTN'],[180,'@DiamondHandsDiane','19% might not energize means 81% WILL. buying $BSTN'],[300,'@SenThorne','Nineteen percent of contracted capacity may never turn on. The debt behind it was rated AAA. My office has questions.']],
    /* D12 Freedom */ [[25,'@ScalingLawSteve','Compute Freedom Act is done. leverage unlocked. $CRVS calls to the moon'],[140,'@BondVigilante','The law just changed the size of every future mistake on the street.'],[260,'@TendiesTomorrow','they made risk legal. loading everything']],
    /* D13 Zero Bid */ [[100,'@BondVigilante','CASCADE auction at 11:50. Hearing demand is ugly. $HLST'],[150,'@FloorTalk','Two CASCADE tranches failed to clear. One bidder. It bid zero.'],[220,'@CallsOnlyCarl','one failed auction lol. $HLST buy the dip'],[330,'@SanaFerreira','A deal that cannot be priced is worth nothing. Everyone on the street knows it and nobody will say it on camera.']],
    /* D14 Green Close */ [[60,'@DiamondHandsDiane','auction failed yesterday and we are GREEN today. nothing can stop this'],[200,'@BearCaveBets','a green close after a failed auction is the scariest chart i have ever seen'],[340,'@HedgeHog88','cant tell if the market is brave or just has not read the news']],
    /* D15 One Vintage */ [[40,'@FloorTalk','Meridian downgrades $5B of a prior vintage and affirms everything else. Every downgrade printed in the same minute.'],[150,'@BondVigilante','Downgrading one vintage and affirming the rest is triage, not analysis. $RDGW has the weakest funding on the street. Selling.'],[280,'@TendiesTomorrow','one vintage. ONE. the rest is fine. $HLST calls']],
    /* D16 Lines Pulled */ [[90,'@BearCaveBets','hearing counterparties pull $RDGW credit lines this afternoon'],[240,'@FloorTalk','Ridgeway intraday lines pulled. Branch managers told to "reassure depositors."'],[330,'@PitBoss41','watched a guy on 39 move his own deposits to a different bank at lunch. says a lot']],
    /* D17 The Pack */ [[60,'@GretaVail','Ridgeway has one night left and the market knows it. Selling $RDGW into every bid.'],[150,'@TheTapeReader','someone is absolutely hammering $RDGW. this is coordinated, screenshot this post'],[260,'@SanaFerreira','If four funds coordinate a raid on a bank and post about it in public, is that a trade or a crime? Asking regulators. No answer yet.']],
    /* D18 The Loop */ [[40,'@Quant_Kween','Four funds on one base model are all de-risking. If one sells, the others read it as a signal. Careful today.'],[110,'@FloorTalk','EVERYTHING IS RED. Correlated model selling across every sector.'],[125,'@CallsOnlyCarl','buying $CRVS with both hands. machines panic, humans profit'],[190,'@DiamondHandsDiane','BOUNCE. told you. machines cannot kill the market'],[300,'@PromptAndPray','the machines are front-running the machines and we all agreed this was fine']],
    /* D19 Systems Normal */ [[60,'@FloorTalk','Exchanges say systems were "operating normally" yesterday. No halt. No correction. No explanation.'],[180,'@SenThorne','"Operating normally" is exactly what worries me.'],[300,'@TendiesTomorrow','flash crash yesterday means discount today. $HALO calls']],
    /* D20 Same Model */ [[80,'@Quant_Kween','Same four funds. Same licensed base model. When they start disagreeing with each other, I will worry less.'],[200,'@BearCaveBets','volatility never came down after the Loop. nobody fixed anything. it just stopped trending'],[320,'@GPUgoblin','diversification is when four funds license the same model from the same vendor']],
    /* D21 The Queue */ [[30,'@TheTapeReader','$RDGW not opening. no bid anywhere. this is the one'],[90,'@FloorTalk','Ridgeway halts limit down after missing a funding call. News vans outside a branch on Third.'],[160,'@SanaFerreira','There is a line outside a Ridgeway branch. There was no line until the cameras arrived.'],[260,'@BearCaveBets','Ridgeway today, who tomorrow. selling $HLST on every bounce']],
    /* D22 All Options */ [[50,'@SenThorne','"All options remain on the table" means nobody has chosen one.'],[160,'@MacroMaven','A rescue decision is coming. Markets hate not knowing more than they hate bad news.'],[300,'@CallsOnlyCarl','they always bail out the banks. $RDGW calls. free money']],
    /* D23 Monday Gap */ [[20,'@FloorTalk','Ridgeway opens on the overnight decision. Ambervale cut three notches in one move.'],[140,'@DeepValueDane','three notches at once. agencies only do that when they are scared of their own last rating'],[280,'@TendiesTomorrow','crisis over. $HLST calls. banks are back']],
    /* D24 Twenty-Two */ [[60,'@FloorTalk','Holloway Stern says its CASCADE marks are "appropriate and independently reviewed."'],[150,'@BearCaveBets','nobody at $HLST believes their own marks. nobody. selling'],[290,'@SanaFerreira','If the paper is worth what the model says, why will nobody buy it at that price?']],
    /* D25 Five and a Half */ [[90,'@BondVigilante','Headline mark on the CASCADE sale: 22 cents. Ask who financed the buyer. Then ask how much the buyer can actually lose.'],[210,'@DiamondHandsDiane','22 cents is a real price from a real buyer. bottom is in. buying $HLST'],[330,'@Quant_Kween','A price that comes with a loan from the seller is not a price. It is a hope with paperwork.']],
    /* D26 Lanyards */ [[50,'@PitBoss41','auditors on the floor. lanyards. laptops. nobody on 41 is making eye contact'],[170,'@TheTapeReader','holloway risk is rejecting orders before they reach the wire. seen it three times today'],[300,'@HedgeHog88','an auditor asked me what CASCADE stands for. i did not know. neither did he']],
    /* D27 The Inquiry */ [[100,'@BearCaveBets','formal probe into CASCADE marks is coming today. $HLST'],[260,'@SenThorne','Today we opened a formal inquiry into CASCADE valuations. Everyone who signed a mark should keep their records.'],[340,'@GPUgoblin','Corvus cut capex 40%. the robots are on a diet']],
    /* D28 The Bottom */ [[60,'@MacroMaven','Selling has stopped. No announcement. Bottoms rarely have one.'],[200,'@DiamondHandsDiane','THE BOTTOM IS IN. buying everything'],[330,'@BearCaveBets','the market stopped falling. the problem did not stop existing']],
    /* D29 No Headline */ [[80,'@TendiesTomorrow','green day with no news means the bad news is priced out. $CRVS calls'],[220,'@Quant_Kween','Small green session, no catalyst. The first day of a rally never feels like one.'],[330,'@PitBoss41','first quiet day in weeks. nobody trusts it']],
    /* D30 A Little Better */ [[70,'@BondVigilante','Credit spreads narrowed a fraction. Not a signal yet. A posture.'],[210,'@CallsOnlyCarl','recovery szn. $HALO calls, i am so back'],[330,'@HedgeHog88','first green week in a while. not trusting it. still smiling']],
    /* D31 Perfect Volume */ [[90,'@TheTapeReader','volume today is perfectly even through lunch. every single minute. humans take lunch. who is trading'],[200,'@ScalingLawSteve','rally is real. $CRVS calls. the machines know'],[330,'@Quant_Kween','The machines do not take lunch. That should bother you more than it does.']],
    /* D32 Over */ [[60,'@FloorTalk','Desks agree the crisis is over. One desk reportedly booked dinner for forty.'],[200,'@DiamondHandsDiane','crisis over. bears lost. $HLST calls'],[320,'@BearCaveBets','everyone agrees it is over. my favorite time to be short $HLST']],
    /* D33 Make It Back */ [[50,'@PitBoss41','quota just went up by half. "make it back, and make it back now." direct quote'],[180,'@TendiesTomorrow','v shaped recovery confirmed. $THSI calls'],[320,'@MacroMaven','Twelve percent off the low in six sessions on no news. Rallies this clean are usually borrowed.']],
    /* D34 Nobody Cares */ [[40,'@SanaFerreira','My CASCADE investigation is out. Nine thousand words. Every number sourced.'],[160,'@CallsOnlyCarl','some journalist wrote a long article lol. $HALO still going up. buying'],[300,'@SanaFerreira','The piece has been out for five hours. The index is up 1.1%.']],
    /* D35 Twenty Percent */ [[90,'@BearCaveBets','shorts getting squeezed out one bleeding session at a time. still short $HLST'],[230,'@DiamondHandsDiane','20% off the lows. bears can go home. $CRVS calls'],[340,'@HedgeHog88','i shorted the top. the top keeps moving']],
    /* D36 The Top */ [[70,'@MacroMaven','Momentum fading into the afternoon without a headline. Tops rarely announce themselves either.'],[200,'@ScalingLawSteve','new highs next week. $HALO calls, all of them'],[320,'@Quant_Kween','Distribution again. The account that bought every tick of the Loop is selling now. Same account.']],
    /* D37 The Footnote */ [[60,'@DeepValueDane','read the footnotes on the Meridian filing. the AAA stamps were reissued after the analyst who signed them left'],[190,'@TendiesTomorrow','small dip. buying $THSI'],[330,'@HedgeHog88','slow bleed day. no headlines. just red']],
    /* D38 The Hearing */ [[40,'@SenThorne','The hearing begins at 10. The committee has the CASCADE structure diagram. So will you.'],[140,'@FloorTalk','Thorne holds up the diagram: "You sold a circle and called it a AAA bond."'],[170,'@BearCaveBets','Meridian withdrawing ratings on the whole vintage. $HLST is cooked'],[290,'@DiamondHandsDiane','hearings are theater. nothing changes. buying $HLST']],
    /* D39 Four Votes */ [[60,'@MacroMaven','Whip count says the Stabilization Act is four votes short. Markets are pricing a pass anyway.'],[190,'@SenThorne','We are four votes short. Call your representative.'],[320,'@TendiesTomorrow','they will pass it. they always pass it. $RDGW calls']],
    /* D40 Breaks the Buck */ [[40,'@BondVigilante','A money fund broke the buck. Cash itself has a price now.'],[160,'@FloorTalk','Short selling in financials banned from tomorrow.'],[300,'@HedgeHog88','my savings were in a money fund. were.']],
    /* D41 The Failed Vote */ [[100,'@SenThorne','Vote at 2:00. We are still short of votes. Every phone in my office is ringing.'],[200,'@DiamondHandsDiane','it will pass. buying $HLST before the vote'],[290,'@FloorTalk','STABILIZATION ACT FAILS. Screens red across the floor.'],[330,'@PromptAndPray','they voted no on saving the thing that pays their donors. democracy']],
    /* D42 Hope */ [[30,'@MacroMaven','Second vote this morning. If it passes, expect relief. Do not expect repair.'],[100,'@CallsOnlyCarl','IT PASSED. $HLST calls. we are so back'],[220,'@DiamondHandsDiane','told you. told ALL of you. buying everything'],[340,'@BearCaveBets','one green day is not a rescue. check back Wednesday']],
    /* D43 The Offer */ [[70,'@TendiesTomorrow','small pullback after the rescue. buying $HLST'],[260,'@FloorTalk','The rescue rally fails. Selling resumes across banks and compute.'],[340,'@Quant_Kween','The rescue is priced in and nothing changed. Look at who is on the other side of your fills.']],
    /* D44 One Counterparty */ [[60,'@TheTapeReader','checked my fills across five venues. same counterparty on most of them. how'],[210,'@FloorTalk','Index down seven percent despite the enacted guarantee.'],[330,'@BondVigilante','A guarantee without buyers is a promise to nobody.']],
    /* D45 Worst Session */ [[40,'@MacroMaven','Futures limit down. Liquidity thin everywhere.'],[200,'@FloorTalk','WORST SESSION IN THE HISTORY OF THE INDEX.'],[300,'@HedgeHog88','i am not refreshing anymore']],
    /* D46 Orphan Monday */ [[20,'@PitBoss41','last bell today. whatever you hold at four is what you keep'],[100,'@Quant_Kween','Every bid on my screen is from the same entity.'],[250,'@HedgeHog88','see you all on the other side']]
  ];

  // Pre-open items, written as short tuples:
  //   ['sq',   handle, post, [replyHandle, reply]?]
  //   ['wire', title, text]
  //   ['mail', from, subject, body]
  //   ['life', source, title, text]
  //   ['pay',  outlet, headline]
  const PREOPEN = [
    /* D1 */ [['mail','Imani Rhodes','Welcome to 41','Coffee is on me today. Watch Fairline. That is the whole lesson.'],['sq','@ScalingLawSteve','LATTICE-9 ships at 10:10. this is the day the world changes. again.',['@DeepValueDane','it changed last month too']]],
    /* D2 */ [['pay','The Ledger','What LATTICE-9 actually does, according to the people who built it'],['sq','@Quant_Kween','Reading the LATTICE-9 notes before the open. Page 140 is doing a lot of work.',['@PromptAndPray','there is a page 140?']]],
    /* D3 */ [['sq','@CallsOnlyCarl','hearing something big on Ridgeway today. cant say more. positioning',['@PitBoss41','you can always say more. that is the problem']],['mail','Imani Rhodes','Today','If you see a buyout rumor before 11, wait for the Wire. If you see one after 11, still wait for the Wire.'],['life','Transit Alerts','Red Line delays','Signal problems near Fulton. Expect 10 to 15 minute delays.'],['pay','The Ledger','Ridgeway\'s funding problem, explained']],
    /* D4 */ [['sq','@BondVigilante','Delinquency data at 1:25. Whisper number is higher than consensus. Much higher.'],['mail','Imani Rhodes','Today','Watch the 1:25 print. Then watch whether anyone changes a rating. They will not.'],['life','Mom','Did you eat breakfast','You sounded tired on the phone. Eat something that is not coffee.'],['sq','@TendiesTomorrow','delinquencies are a lagging indicator. the tape is a leading indicator. the tape says UP']],
    /* D5 */ [['sq','@Quant_Kween','Meridian meets this morning on the CASCADE vintage. My bet: nothing changes. That is the problem.'],['mail','Desmond Kroll','Yesterday','Good talk yesterday. Remember what we discussed. Monday is a new number.'],['pay','The Ledger','How a rating survives a bad week'],['sq','@PitBoss41','week was long. somebody did something they will regret. always happens'],['life','@MetroWx','Cold front','Temperatures fall 20 degrees by evening.']],
    /* D6 */ [['sq','@BearCaveBets','Fairline files today. bet me.'],['wire','Fairline in talks with lenders','The consumer lender is negotiating an emergency facility.'],['mail','HLST Risk','Exposure check','Please confirm any positions in consumer credit before 9:15.'],['life','@HarborSports','Gulls sweep the series','Three straight wins. The city has stopped being cautious.'],['sq','@DiamondHandsDiane','index futures at a record. whatever happens today does not matter']],
    /* D7 */ [['wire','Overnight: incident in the Kavro Strait','Details remain unclear. Shipping insurers have suspended coverage in the region.'],['sq','@CallsOnlyCarl','war means defense. defense means $VNTR. easiest trade of the year'],['sq','@MacroMaven','Rare-earth licence news is the part to watch. Silicon supply chains are longer than the strait is wide.'],['mail','Compliance','Restricted list update','Vantor Defense added to the restricted list for the advisory desk only.'],['life','Transit Alerts','Service suspended','Blue Line suspended between Harbor and Market. Shuttle buses running.']],
    /* D8 */ [['sq','@TheTapeReader','Fairline insider filings from last month finally posted. read them before lunch'],['sq','@SanaFerreira','Somebody knew about Fairline early. A lot of somebodies. Keep reading.'],['mail','Imani Rhodes','Phones','If anyone calls you today with something you should not know, you do not know it.'],['pay','The Ledger','The chief executive who sold first'],['life','Mom','Your cousin\'s wedding','It is in six weeks. You said you would come. You always say you will come.']],
    /* D9 */ [['sq','@Quant_Kween','A research note on Thorncrest and Halcyon went out at 4:02 AM. Read it. Then read who wrote it.',['@PromptAndPray','who wrote it'],],['mail','Compliance','Chronology request','Please send a written timeline of your CASCADE positions for the last two weeks.'],['sq','@CallsOnlyCarl','research notes are fake news. $THSI to new highs'],['life','@MetroWx','Fog','Dense fog along the waterfront until 10.']],
    /* D10 */ [['wire','Grid operators to rule on interconnect requests','Three regional operators will announce decisions on gigawatt-scale requests.'],['sq','@MacroMaven','If the grid operators say no today, the compute trade meets its first physical limit.'],['sq','@FlopsPerDollar','my datacenter is powered by vibes and a diesel generator'],['mail','HLST Research','Morning note','Power availability is the key risk for 2H capacity. See page 9.'],['life','@MetroWx','Heat advisory','Highs near 95. Grid operators ask residents to limit use between 3 and 7 PM.']],
    /* D11 */ [['sq','@BearCaveBets','Bastion updates capacity guidance today. i have a number in mind. it is not a nice number'],['mail','Thorne staff','This evening','The Senator would like a call at 6 PM. It concerns this week\'s bill.'],['sq','@DiamondHandsDiane','bastion is fine. everything is fine. holding'],['pay','The Ledger','The capacity that may never switch on'],['life','Mom','Weekend?','Are you coming for dinner Sunday? You can bring someone. Or not.']],
    /* D12 */ [['sq','@ScalingLawSteve','the Compute Freedom Act is the most bullish law ever written. i will not be taking questions'],['wire','Compute Freedom Act takes effect','Leverage caps on compute-backed lending lifted from today.'],['mail','HLST Risk','New limits','Revised leverage limits are live. Read them before you use them.'],['sq','@BondVigilante','The bill changed the size of every future mistake. Size accordingly.'],['life','@HarborSports','Gulls win game one','The city is loud again.'],['pay','The Ledger','Who wrote the Compute Freedom Act']],
    /* D13 */ [['wire','CASCADE 2026-C auction today','Results due at 11:50 ET.'],['sq','@BondVigilante','Two CASCADE tranches go to auction at 11:50. Hearing the order book is empty.'],['mail','Desmond Kroll','Auction','Do not trade around the auction. Do not talk about the auction.'],['sq','@CallsOnlyCarl','auctions always clear. that is what auctions do'],['life','@HarborSports','Gulls advance','Next round starts Friday.']],
    /* D14 */ [['sq','@FloorTalk','Nobody on the street is talking about yesterday\'s auction. Everybody on the street is thinking about it.'],['sq','@DiamondHandsDiane','futures green. auction who?'],['mail','Imani Rhodes','Yesterday','Write down what you saw at 11:50 yesterday. You will want to remember you saw it.'],['life','@MetroWx','First chill','Low of 41 tonight.'],['wire','Futures edge higher','Index futures up 0.2%. Bank shares mixed.'],['pay','The Ledger','The auction that nobody reported']],
    /* D15 */ [['wire','Meridian to review prior CASCADE vintage','Rating actions expected before the open.'],['sq','@Quant_Kween','Meridian changed its model version overnight. Watch the timestamps on this morning\'s actions.'],['sq','@TendiesTomorrow','one small downgrade. the rest AAA. buy the relief'],['mail','Compliance','Ratings changes','Update internal marks for any downgraded tranches by noon.'],['life','Mom','Are you okay','You have not called in two weeks. Just checking.'],['sq','@BearCaveBets','downgrade one, affirm the rest. i have seen this playbook. i know how it ends'],['pay','The Ledger','Inside Meridian\'s new model']],
    /* D16 */ [['sq','@BearCaveBets','hearing Ridgeway counterparties are having meetings this morning. not the good kind'],['mail','HLST Risk','Counterparty review','Ridgeway exposure is under review. Do not add to it.'],['sq','@FloorTalk','Two Ridgeway prime brokers asked for more collateral overnight.'],['sq','@CallsOnlyCarl','ridgeway calls are so cheap right now. free lottery tickets'],['life','Transit Alerts','Line outside Ridgeway branch','Pedestrian congestion reported near 3rd and Main.'],['wire','Ridgeway shares indicated lower','Premarket trading shows shares down 3%.'],['pay','The Ledger','How long can Ridgeway roll?']],
    /* D17 */ [['sq','@GretaVail','Ridgeway will not survive the week without help. That is not a threat. It is arithmetic.'],['sq','@SanaFerreira','Four hedge funds, one bank, a public feed. I am watching what happens at 11:40.'],['mail','Imani Rhodes','Today','If someone offers you a seat in a pack today, remember that packs leave no witnesses except the ones in them.'],['sq','@TendiesTomorrow','ridgeway squeeze incoming. shorts are too crowded'],['life','@MetroWx','Wind','Gusts to 40 this afternoon.'],['pay','The Ledger','The raid, in real time']],
    /* D18 */ [['sq','@Quant_Kween','Overnight hedging from one large fund. Same base model as three others. If they all read the same signal this morning, hold on.'],['mail','Desmond Kroll','Today','If you market-order into this I will personally take your keyboard.'],['sq','@CallsOnlyCarl','futures down 2.8% = sale. buying the open'],['sq','@TheTapeReader','futures bid has disappeared twice since 6 AM. twice'],['life','Transit Alerts','Normal service','All lines running on schedule. For once.'],['pay','The Ledger','Four funds, one brain']],
    /* D19 */ [['wire','Exchanges review Wednesday\'s trading','Operators say systems functioned "as designed."'],['sq','@SenThorne','"As designed" is the most frightening phrase in finance.'],['sq','@TendiesTomorrow','flash crash was a sale. everybody knows that now'],['mail','Compliance','Order review','All Wednesday orders above $1M are under review. Please do not delete anything.'],['life','@MetroWx','Clear and cold','High of 49.'],['sq','@PitBoss41','two guys on 39 did not come back today'],['pay','The Ledger','What really happened at 11:15']],
    /* D20 */ [['sq','@Quant_Kween','Mapped the four funds from Wednesday. Same base model licence, same vendor, same week.'],['sq','@GPUgoblin','we built one brain and gave it four names'],['mail','Imani Rhodes','Lunch','Buy me a sandwich and I will tell you about the four funds.'],['wire','Volatility stays elevated','Fear index remains near 30.'],['life','Mom','Your cousin\'s wedding','It is tomorrow. Please come.'],['pay','The Ledger','The vendor behind the Loop']],
    /* D21 */ [['sq','@TheTapeReader','$RDGW not indicated. no premarket bid. none'],['wire','Ridgeway misses funding call','The bank failed to meet an intraday funding obligation before the open.'],['sq','@SanaFerreira','Camera crews are already outside the Ridgeway branch on Third. Nobody is in line yet.'],['mail','HLST Risk','Ridgeway','All Ridgeway exposure frozen. Report positions by 9:20.'],['life','Transit Alerts','Detour','Buses rerouted around 3rd and Main due to crowds.'],['sq','@CallsOnlyCarl','ridgeway gets saved by lunch. always happens'],['pay','The Ledger','The line that made itself']],
    /* D22 */ [['wire','Officials: "all options remain on the table"','Treasury officials met overnight on Ridgeway.'],['sq','@SenThorne','When they say all options, they mean no decision.'],['mail','Desmond Kroll','Overnight','We may be called in tonight. Plan accordingly.'],['sq','@MacroMaven','A rescue decides more than a bank. It decides what everyone else can get away with.'],['life','@MetroWx','Overnight rain','Two inches expected by morning.'],['sq','@HedgeHog88','cant sleep. checking futures that do not exist yet'],['pay','The Ledger','Adele Venn\'s longest night']],
    /* D23 */ [['wire','Ridgeway decision announced','Markets open on the rescue decision.'],['sq','@FloorTalk','Ambervale is being cut three notches before the open. Three.'],['mail','Compliance','Marks review','CASCADE marks committee meets Thursday. Attendance required.'],['sq','@DiamondHandsDiane','decision made. crisis over. buying the open'],['life','Mom','Wedding photos','You missed it. Photos attached. Your cousin says hi anyway.'],['sq','@BondVigilante','Three notches in one action means the old rating was wrong for a long time.'],['pay','The Ledger','The night that decided who pays']],
    /* D24 */ [['mail','Desmond Kroll','Marks','Committee at 3. Bring your pen.'],['sq','@BearCaveBets','holloway marks committee today. the model says 61. the desk says 22. place your bets'],['sq','@SanaFerreira','Tell me what CASCADE is worth. Anyone. On the record.'],['wire','Holloway Stern to update CASCADE marks','The firm will release revised marks after the close.'],['life','@MetroWx','Grey','Overcast all day.'],['sq','@TendiesTomorrow','holloway marks will be fine. marks are always fine'],['pay','The Ledger','The price that is not a price']],
    /* D25 */ [['mail','Legal','Addendum','Please review the attached financing addendum before today\'s close.'],['sq','@BondVigilante','Hearing the CASCADE buyer did not bring much of its own money. Worth asking about.'],['sq','@Quant_Kween','Seventy-five percent seller financing is not a sale. It is a loan with a press release.'],['wire','CASCADE sale terms under scrutiny','Analysts question the financing behind yesterday\'s sale.'],['life','Transit Alerts','Delays','Signal problems on the Red Line.'],['sq','@CallsOnlyCarl','22 cents is the bottom. loading holloway'],['pay','The Ledger','Five and a half cents']],
    /* D26 */ [['mail','Compliance','Auditors on site','External auditors will visit desks today. Answer their questions. Do not volunteer answers to questions they did not ask.'],['sq','@PitBoss41','lanyards in the elevator this morning. lots of them'],['sq','@HedgeHog88','cleaned my desk for the auditors. found three coffee cups from august'],['wire','Holloway Stern confirms external review','The review is described as "routine."'],['life','@MetroWx','Snow flurries','First flakes of the season.'],['sq','@DiamondHandsDiane','auditors are good actually. clean books. buying']],
    /* D27 */ [['wire','Formal inquiry into CASCADE expected','A committee announcement is expected this afternoon.'],['sq','@SenThorne','Today we begin asking questions under oath.'],['mail','Legal','Document hold','Do not delete, edit or move any file related to CASCADE.'],['sq','@GPUgoblin','Corvus cutting capex 40%. my GPUs will be lonely'],['life','Mom','Are you in trouble','Your father saw your firm on the news.'],['sq','@TendiesTomorrow','inquiry means they have to bail everyone out after. bullish'],['pay','The Ledger','Riverbend\'s lawyers want names']],
    /* D28 */ [['sq','@MacroMaven','Futures flat. Selling pressure has faded. Nobody knows why, which is how bottoms usually feel.'],['mail','Desmond Kroll','Today','We made it through. Now we make it back.'],['sq','@BearCaveBets','bottoms are for people who read charts. i read balance sheets'],['wire','Futures steady after a rough stretch','Index futures flat before the open.'],['life','@MetroWx','Sunny and cold','A clear, bright day.'],['sq','@DiamondHandsDiane','bottom is in. i am calling it. screenshot this'],['pay','The Ledger','Is it over?']],
    /* D29 */ [['sq','@Quant_Kween','Premarket is green on no news. The best rallies start that way. So do the worst traps.'],['mail','Imani Rhodes','Careful','Green days after a crash make people brave with other people\'s money.'],['sq','@TendiesTomorrow','we are so back'],['wire','Futures higher','Index futures up 0.5%.'],['life','Mom','Thanksgiving','Will you be home? Please say yes.'],['sq','@HedgeHog88','green futures. i do not know how to feel'],['pay','The Ledger','The rally nobody believes']],
    /* D30 */ [['sq','@BondVigilante','Credit spreads a touch tighter. Watch whether it lasts past lunch.'],['mail','Desmond Kroll','Opportunity','The desk should be long this. Be long this.'],['sq','@CallsOnlyCarl','recovery calls are the easiest money of the year'],['wire','Credit markets stabilise','Spreads narrow for a second day.'],['life','@HarborSports','Gulls sign new manager','The city hopes, again.'],['sq','@BearCaveBets','spreads narrowing on no news. somebody is being paid to buy'],['pay','The Ledger','Who is buying?']],
    /* D31 */ [['sq','@TheTapeReader','premarket volume already perfectly even. every minute same size. weird'],['mail','Imani Rhodes','Volume','Look at the volume profile by minute. Tell me who takes no lunch break.'],['sq','@ScalingLawSteve','the rally is algorithmic. that means it is smart'],['wire','Rally extends into fourth day','Index futures up again.'],['life','@MetroWx','Clear','Nothing to report.'],['sq','@PromptAndPray','the robots are buying and the robots are selling and we are watching'],['pay','The Ledger','The machine that never sleeps']],
    /* D32 */ [['mail','Desmond Kroll','Dinner','Desk dinner tonight. Eight o\'clock. We earned it.'],['sq','@DiamondHandsDiane','it is officially over. bears go home'],['sq','@BearCaveBets','the dinner reservation is the top signal'],['wire','Street economists: "worst is behind us"','A survey of desk economists shows rising confidence.'],['life','Mom','So proud','Your father says you are doing well. We are proud of you.'],['sq','@MacroMaven','Consensus that the crisis is over is now near unanimous. Unanimity is not evidence.'],['pay','The Ledger','Wall of worry, or wall of denial?']],
    /* D33 */ [['mail','Desmond Kroll','New quota','Quota is up. Make it back, and make it back now.'],['sq','@PitBoss41','quota up by half overnight. nobody said a word'],['sq','@TendiesTomorrow','v shaped recovery. told you all in october'],['wire','Futures extend gains','Index up 12% from the low.'],['life','@MetroWx','Mild','An unseasonable 60 degrees.'],['sq','@HedgeHog88','i am short and i am bleeding and i am right. probably'],['pay','The Ledger','The quota that ate the rally']],
    /* D34 */ [['sq','@SanaFerreira','My CASCADE investigation publishes at 10. Nine thousand words.'],['mail','Imani Rhodes','Read it','Sana\'s piece is out today. Read all of it. Nobody else will.'],['sq','@CallsOnlyCarl','who reads articles. i read charts'],['wire','Report details CASCADE structure','An investigative piece is expected this morning.'],['life','@HarborSports','Gulls trade their best pitcher','The city is not hopeful.'],['sq','@Quant_Kween','A good story published into a rally is a story nobody will remember.'],['pay','The Ledger','Our reporter spent a year on CASCADE']],
    /* D35 */ [['sq','@BearCaveBets','short book down 20% in eight sessions. still here. still right'],['mail','HLST Risk','Short exposure','Short positions above limit must be reduced by the close.'],['sq','@DiamondHandsDiane','20% off the lows. bears in the ICU'],['wire','Index 20% above the low','The rally is the fastest in years.'],['life','Mom','Call me','Just to talk. Not about money.'],['sq','@MacroMaven','Twenty percent off the low. The textbook calls that a new bull market. Textbooks were written before CASCADE.'],['pay','The Ledger','The fastest rally ever?']],
    /* D36 */ [['sq','@MacroMaven','Futures flat after eight green sessions. The first flat day after a run is worth noticing.'],['mail','Desmond Kroll','Stay long','No reason to change what is working.'],['sq','@ScalingLawSteve','new highs are a matter of time now'],['wire','Futures mixed','Index futures unchanged.'],['life','@MetroWx','Wind picking up','Gusts to 35 by evening.'],['sq','@Quant_Kween','The account that bought every tick in the Loop is selling into this. Same account.'],['pay','The Ledger','When a rally runs out of reasons']],
    /* D37 */ [['sq','@DeepValueDane','reading Meridian filings overnight. the AAA stamps are dated after the analyst who signed them left. dated after'],['mail','Imani Rhodes','Footnote','I left something on your desk. Read it before the open.'],['sq','@TendiesTomorrow','small red day. buy it'],['wire','Futures lower','Index futures down 0.4%.'],['life','@MetroWx','Cold rain','All day.'],['sq','@HedgeHog88','the rally is over and nobody said anything'],['pay','The Ledger','The analyst who left, and the ratings that stayed']],
    /* D38 */ [['wire','CASCADE hearing today','Senator Thorne\'s committee begins at 10 AM.'],['sq','@SenThorne','Today the public sees how CASCADE really worked.'],['mail','Legal','Hearing','If you are called, you say nothing without counsel present.'],['sq','@DiamondHandsDiane','hearings never change anything. buying'],['life','@MetroWx','Snow','Three to five inches.'],['sq','@SanaFerreira','Today the diagram from my story goes on every screen in the country.'],['pay','The Ledger','The circle, under oath']],
    /* D39 */ [['wire','Stabilization Act short of votes','Vote counters say the bill is four votes short.'],['sq','@SenThorne','Four votes. Call your representative.'],['mail','Thorne staff','Votes','The Senator asks whether you can reach anyone before Monday.'],['sq','@TendiesTomorrow','they will pass it. it is the rescue. rescues pass'],['life','Mom','On the news','They keep saying your firm\'s name on the news. Is that bad?'],['sq','@MacroMaven','Markets are pricing a pass. The whip count is not.'],['pay','The Ledger','The four votes']],
    /* D40 */ [['wire','Money fund breaks the buck','A large money market fund reports its value fell below $1 a share.'],['sq','@BondVigilante','Cash has a price now. Think about that.'],['mail','Compliance','Short sale ban','Short sales in financials are prohibited from Monday. Existing shorts must be reported.'],['sq','@HedgeHog88','my savings were in the safe fund. the safe fund'],['life','Mom','Are we okay','Is our money safe? Your father wants to know. So do I.'],['sq','@PromptAndPray','the safest place to put money is now under a mattress, which is also a model'],['pay','The Ledger','When cash stops being cash']],
    /* D41 */ [['wire','Stabilization vote at 2:00 PM','Leadership says the bill has the votes.'],['sq','@SenThorne','We are close. Not there. Close.'],['mail','Desmond Kroll','Vote','Be positioned for a pass. The street is.'],['sq','@DiamondHandsDiane','it passes at 2. buying the morning'],['life','@MetroWx','Clear and bitterly cold','Wind chill near zero.'],['sq','@BearCaveBets','everyone is positioned for a pass. that is the trade that hurts'],['pay','The Ledger','Inside the whip count']],
    /* D42 */ [['wire','Second vote scheduled for this morning','Leaders say changes won enough support.'],['sq','@MacroMaven','If it passes, expect relief. Do not expect repair.'],['mail','Desmond Kroll','Today','Buy the pass.'],['sq','@CallsOnlyCarl','second vote passes. i am going all in'],['life','Mom','Relief','The news says they fixed it. Did they fix it?'],['sq','@SanaFerreira','A rescue does not change what the paper is worth. It changes who holds it.'],['pay','The Ledger','What the bill actually does']],
    /* D43 */ [['wire','Futures slip after rescue rally','Gains from the vote are fading.'],['sq','@BearCaveBets','the rescue passed and the paper is still worth what it was worth'],['mail','Imani Rhodes','Stairwell','Stairwell, 4:10. Come alone.'],['sq','@TendiesTomorrow','small pullback. still bullish'],['life','Transit Alerts','Service changes','Weekend service reduced on all lines.'],['sq','@Quant_Kween','Look at who is on the other side of your fills today.'],['pay','The Ledger','The rescue, priced in']],
    /* D44 */ [['sq','@FloorTalk','Futures down four percent. Guarantee is in force. Buyers are not.'],['life','Mom','Please call','Just call.']],
    /* D45 */ [['life','@MetroWx','Clear and cold','First frost overnight.'],['life','@danir','wedding pics are up','thank you all for coming, it meant everything']],
    /* D46 */ [['life','@MetroWx','Clear','Nothing to report.'],['life','Mom','Monday','Whatever happens today, come home tonight.']]
  ];


  // Act pools fill any slot a session's own list does not cover. They rotate by
  // session, so a line can return weeks later but never twice in one morning.
  const POOLS = [
    /* I · Melt-Up */ [
      ['sq','@TendiesTomorrow','good morning to everyone except people who sold yesterday'],
      ['sq','@GPUgoblin','woke up. checked futures. green. went back to sleep. woke up again. still green'],
      ['life','@MetroWx','Pleasant','Mild and sunny. Light winds.'],
      ['sq','@ScalingLawSteve','every quarter the models get better and the stocks get cheaper relative to what is coming'],
      ['mail','HLST Facilities','Elevator B','Elevator B is out of service. Please use A or the stairs.'],
      ['pay','The Ledger','Is this a bubble? Six people who say no'],
      ['sq','@PitBoss41','new faces on 41 this month. the old faces are on 42 now. that is how you know it is good'],
      ['life','Transit Alerts','On time','All lines running normally.'],
      ['sq','@HedgeHog88','bought high, sold higher, bought higher. i am a genius (for now)'],
      ['wire','Futures edge higher','Index futures up 0.2% ahead of the open.'],
      ['sq','@FlopsPerDollar','the price of compute went down 40% and the price of compute stocks went up 40%. both make sense somehow'],
      ['mail','HLST Human Resources','Bonus pool','Preliminary bonus pools are up year over year. Details to follow.']
    ],
    /* II · Tremors */ [
      ['sq','@BearCaveBets','the footnotes are getting longer. that is never good'],
      ['life','@MetroWx','Unsettled','Showers possible through the afternoon.'],
      ['sq','@MacroMaven','Leadership is narrowing. Five names are doing the work of fifty.'],
      ['mail','Compliance','Communications','Reminder: all client communications are recorded. All of them.'],
      ['pay','The Ledger','Where the power will come from, and where it will not'],
      ['sq','@DiamondHandsDiane','small red candle. big green conviction'],
      ['wire','Futures mixed','Compute higher, banks lower before the open.'],
      ['sq','@PromptAndPray','my model told me not to worry. my model is also the thing i am worried about'],
      ['life','Transit Alerts','Minor delays','Five-minute delays on the Green Line.'],
      ['sq','@TheTapeReader','premarket volume is heavy in the boring names. somebody is getting boring on purpose'],
      ['mail','HLST Risk','VaR update','Desk value-at-risk rose 18% week over week.'],
      ['sq','@HedgeHog88','cant tell if i am early or wrong. same feeling honestly']
    ],
    /* III · Contagion */ [
      ['sq','@PitBoss41','three empty desks on 39 this morning. nobody said anything'],
      ['life','@MetroWx','Grey and cold','Overcast. Highs in the low 40s.'],
      ['sq','@BondVigilante','Funding markets are the only market that matters this week.'],
      ['mail','Compliance','Retention','Do not delete any messages. This includes personal devices used for work.'],
      ['pay','The Ledger','The banks that roll overnight'],
      ['sq','@TendiesTomorrow','the dip is a gift. the gift keeps giving'],
      ['wire','Fear index elevated','Volatility remains near 30 before the open.'],
      ['sq','@GPUgoblin','the robots are fine. it is the people who are nervous'],
      ['life','Mom','Just checking','Are you eating?'],
      ['sq','@MacroMaven','Liquidity is thinner than prices suggest. Prices are not the same as buyers.'],
      ['mail','HLST Risk','Limits cut','Intraday limits reduced 20% effective immediately.'],
      ['sq','@HedgeHog88','my therapist says i should not check futures at 5 AM. my therapist is not long']
    ],
    /* IV · Reckoning */ [
      ['sq','@BearCaveBets','nobody wants to hear it. that is exactly when you should'],
      ['life','@MetroWx','Bitter','Wind chill below zero.'],
      ['sq','@PitBoss41','fewer people in the elevator every week'],
      ['mail','Legal','Hold notice','Your records are subject to a legal hold. Do not alter them.'],
      ['pay','The Ledger','Who signed the marks'],
      ['sq','@DiamondHandsDiane','still holding. still believing. still down'],
      ['wire','Futures lower','Index futures down 0.8% before the open.'],
      ['sq','@PromptAndPray','we trained the models on our mistakes and they learned them perfectly'],
      ['life','Transit Alerts','Reduced service','Fewer trains this week due to staffing.'],
      ['sq','@Quant_Kween','Same counterparty again. Every venue. Every morning.'],
      ['mail','HLST Human Resources','Headcount','Please confirm your role and reporting line by Friday.'],
      ['sq','@HedgeHog88','sold everything. bought it back. sold it again. still here']
    ]
  ];

  // End-of-session Sqwak inserts for the biggest days (played after the 4:00
  // bell so they never spoil what happens during the session). Keyed by day.
  const BREAKING = {
    6: { flag:'BREAKING', when:'8M AGO', head:'Incident in the Kavro Strait', text:'Shipping insurers suspend cover. Rare-earth licences frozen pending review. Defense names close at records while silicon sells off.', stats:['2.1K','9.4K','31K'], reply:['@MacroMaven','Markets priced it as a rotation. It is not a rotation for the people who live there.'] },
    12: { flag:'BREAKING', when:'3H AGO', head:'CASCADE auction fails to clear', text:'Two tranches, one bidder, a bid of zero. Holloway Stern calls the result "technical." The index closed higher.', stats:['1.4K','6.2K','18K'], reply:['@SanaFerreira','A deal that cannot be priced is worth nothing. Everyone knows it.'] },
    17: { flag:'SYSTEM ERROR', when:'5H AGO', head:'Autonomous systems fail across markets', text:'Four funds on one base model sold into their own signal. Unplanned orders, erratic execution, liquidity gone for seventy minutes.', stats:['8.8K','31K','64K'], reply:['@Quant_Kween','Nobody turned it off. It stopped on its own.'] },
    20: { flag:'LIVE', when:'NOW', head:'Line forms outside Ridgeway', text:'Ridgeway missed a funding call and halted limit down. The line outside the branch on Third began after the cameras arrived.', stats:['4.4K','12K','40K'], reply:['@FloorTalk','Officials: "all options remain on the table."'] },
    37: { flag:'CAPITOL', when:'2H AGO', head:'"You sold a circle and called it AAA"', text:'Sen. Thorne holds up the CASCADE diagram at the hearing. Meridian withdraws ratings on the entire vintage.', stats:['6.1K','22K','58K'], reply:['@SenThorne','Everyone who signed a mark should keep their records.'] },
    40: { flag:'BREAKING', when:'2H AGO', head:'Stabilization Act fails', text:'Four votes short at 2:00 PM. The index fell nine percent. Leaders promise a second vote.', stats:['9.9K','41K','88K'], reply:['@BearCaveBets','nobody wanted to be the vote that saved the banks'] },
    41: { flag:'BREAKING', when:'6H AGO', head:'Stabilization Act passes', text:'The second vote clears. The guarantee is law. The index closes up five percent. For one night, everyone believes it.', stats:['7.2K','30K','112K'], reply:['@MacroMaven','Relief is not repair.'] },
    44: { flag:'BREAKING', when:'1H AGO', head:'Worst session in the history of the index', text:'The guarantee is in force and the buyers are not. Every venue, every sector, all day.', stats:['12K','48K','71K'], reply:['@Quant_Kween','Same counterparty on the other side of all of it.'] }
  };

  // Sqwak Memory links posts that already exist in the campaign. The day/time
  // gate keeps a thread from showing a future post during a session or after
  // restoring a mid-day save. This is presentation only: no market or ending
  // calculation reads these labels.
  const THREADS = [
    { id: 'ridgeway', title: 'Ridgeway buyout', sym: 'RDGW', fact: 'DENIED', price: 'HYPE FADED', posts: [
      [2, 125, '@DiamondHandsDiane', 'CLAIM'],
      [2, 160, '@FloorTalk', 'EVIDENCE'],
      [2, 240, '@PromptAndPray', 'OUTCOME']
    ] },
    { id: 'auction', title: 'CASCADE auction', sym: 'HLST', fact: 'ZERO BID', price: 'GREEN NEXT DAY', posts: [
      [12, 100, '@BondVigilante', 'CLAIM'],
      [12, 150, '@FloorTalk', 'EVIDENCE'],
      [12, 220, '@CallsOnlyCarl', 'ATTENTION'],
      [13, 60, '@DiamondHandsDiane', 'OUTCOME']
    ] },
    { id: 'loop', title: 'The model loop', sym: 'CRVS', fact: 'MODEL SELLING', price: 'INTRADAY BOUNCE', posts: [
      [17, 40, '@Quant_Kween', 'CLAIM'],
      [17, 110, '@FloorTalk', 'EVIDENCE'],
      [17, 190, '@DiamondHandsDiane', 'ATTENTION'],
      [18, 60, '@FloorTalk', 'OUTCOME']
    ] }
  ];
  // A thread whose post was edited away is dropped with a warning rather than
  // stopping the game from loading. The test suite still requires every link.
  // The second vote failed (S.f.billPassed false): the lines that say it passed, or that the
  // guarantee is law, are replaced where they are read. Keyed by session index.
  const FAILED_INTRADAY = {
    '41|100|@CallsOnlyCarl': 'they say the vote is "stalled" not dead. $HLST calls. buying the dip',
    '41|220|@DiamondHandsDiane': 'the next vote will do it. told ALL of you. buying everything',
    '41|340|@BearCaveBets': 'no rescue and no green day. check back Wednesday',
    '42|70|@TendiesTomorrow': 'small pullback after the vote. buying $HLST',
    '42|260|@FloorTalk': 'No rescue. Selling resumes across banks and compute.',
    '42|340|@Quant_Kween': 'The rescue never arrived and nothing changed. Look at who is on the other side of your fills.',
    '43|210|@FloorTalk': 'Index down seven percent with no guarantee in sight.',
    '43|330|@BondVigilante': 'A rescue that never arrives is a promise to nobody.'
  };
  // Pre-open phone items, keyed by session index then by the item's original title.
  const FAILED_FEED = {
    41: {
      'second vote passes. i am going all in': { title: 'second vote better pass. i am going all in' },
      'What the bill actually does': { title: 'What the bill would have done' },
      Relief: { title: 'Worry', text: 'The news says they could not fix it. Is that bad?' } },
    42: {
      'Futures slip after rescue rally': { title: 'Futures slip after the second vote fails', text: 'Leaders say a third attempt is possible.' },
      'the rescue passed and the paper is still worth what it was worth': { title: 'the rescue failed and the paper is still worth what it was worth' },
      'The rescue, priced in': { title: 'The rescue that never came' }
    },
    43: { 'Futures down four percent. Guarantee is in force. Buyers are not.': { title: 'Futures down four percent. No guarantee is coming. Buyers are not either.' } }
  };
  const FAILED_BREAKING = {
    41: { head: 'Stabilization Act fails again', text: 'The second vote falls short and credit markets stay shut. The index closes down. Nobody pretends otherwise.', reply: ['@MacroMaven', 'Relief was never on the menu.'] },
    44: { text: 'No guarantee came and neither did the buyers. Every venue, every sector, all day.' }
  };
  // What the close screen shows for a session, given the story state.
  function breaking(d, S) {
    const b = BREAKING[d], alt = !(S && S.f && S.f.billPassed) && FAILED_BREAKING[d];
    return b && alt ? Object.assign({}, b, alt) : b;
  }
  const failedFeed = (d) => FAILED_FEED[d];

  const find = (day, t, src) => (INTRADAY[day] || []).find((p) => p[0] === t && p[1] === src);
  for (let i = THREADS.length - 1; i >= 0; i--) {
    const missing = THREADS[i].posts.find(([day, t, src]) => !find(day, t, src));
    if (missing) {
      if (typeof console !== 'undefined') console.warn(`Sqwak thread "${THREADS[i].id}" skipped: no post at session ${missing[0] + 1}, minute ${missing[1]}`);
      THREADS.splice(i, 1);
    }
  }
  const threadPosts = {};
  for (const thread of THREADS) for (const [day, t, src, stage] of thread.posts) threadPosts[`${day}|${t}|${src}`] = { id: thread.id, stage };
  function threadAt(id, day, minute) {
    const thread = THREADS.find((x) => x.id === id);
    if (!thread) return null;
    const posts = thread.posts.filter(([d, t]) => d < day || (d === day && t <= minute)).map(([d, t, src, stage]) => {
      return { day: d, t, src, text: find(d, t, src)[2], stage };
    });
    return posts.length ? { id, title: thread.title, sym: thread.sym, posts, stage: posts[posts.length - 1].stage,
      fact: posts.some((p) => p.stage === 'EVIDENCE') ? thread.fact : 'UNVERIFIED',
      reach: posts.some((p) => p.stage === 'ATTENTION' || p.stage === 'OUTCOME') ? 'AMPLIFIED' : 'BUILDING',
      price: posts.some((p) => p.stage === 'OUTCOME') ? thread.price : 'STILL OPEN' } : null;
  }

  // Extra accounts that only appear in the story.
  Object.assign(B.Sqwak.ACCOUNTS, {
    '@SanaFerreira': { name: 'Sana Ferreira', followers: 240000, acc: 0.93, col: 'violet' },
    '@SenThorne':    { name: 'Sen. Marcus Thorne', followers: 880000, acc: 0.72, col: 'sky' },
    '@GretaVail':    { name: 'Greta Vail', followers: 1220000, acc: 0.72, col: 'crimson' },
    '@FloorTalk':    { name: 'FloorTalk', followers: 610000, acc: 0.64, col: 'amber' },
    '@PitBoss41':    { name: 'Pit Boss', followers: 96000, acc: 0.70, col: 'desk2' },
    '@MetroWx':      { name: 'Metro Weather', followers: 210000, acc: 0.88, col: 'sky' },
    '@HarborSports': { name: 'Harbor Sportsdesk', followers: 640000, acc: 0.95, col: 'amber' },
    '@danir':        { name: 'Dani R.', followers: 311, acc: 1, col: 'crimson' }
  });

  function toItem(x) {
    const kind = x[0];
    if (kind === 'sq') {
      const reply = x[3] ? `${x[3][0]}: ${x[3][1]}` : 'No replies yet.';
      return { source: x[1], src: x[1], title: x[2], text: reply, kind: 'chirp' };
    }
    if (kind === 'wire') return { source: 'THE WIRE', title: x[1], text: x[2], kind: 'wire' };
    if (kind === 'mail') return { source: 'HLST MAIL · ' + x[1].toUpperCase(), title: x[2], text: x[3], kind: 'mail' };
    if (kind === 'life') return { source: x[1], src: x[1].charAt(0) === '@' ? x[1] : null, title: x[2], text: x[3], kind: 'life' };
    if (kind === 'pay') return { source: x[1].toUpperCase(), title: x[2], text: 'This item is behind the firm subscription wall.', kind: 'wire', locked: true };
    return null;
  }

  // Rebuild each session's pre-open feed: keep the lead headline and the
  // anomaly exactly where they were, then fill the remaining slots with
  // authored items instead of recycled filler.
  D.DAYS.forEach((day, d) => {
    const base = day.feed || [];
    const keep = base.filter((it, i) => i === 0 || it.anomalyId);
    const need = Math.max(0, base.length - keep.length);
    const add = (PREOPEN[d] || []).map(toItem).filter(Boolean).slice(0, need);
    // Any slot still empty comes from the act pool, rotating by session.
    const pool = POOLS[D.actIndex(d)];
    for (let k = 0; add.length < need && k < pool.length; k++) {
      const it = toItem(pool[(d * 5 + k) % pool.length]);
      if (!add.some((x) => x.title === it.title)) add.push(it);
    }
    // Interleave so the phone reads like a feed, not a list of one kind.
    day.feed = keep.slice(0, 1).concat(add.slice(0, 2), keep.slice(1), add.slice(2));

    const posts = (INTRADAY[d] || []).map((p) => Object.assign(D.chirp(p[0], p[2], p[1]), p[3] === 'fake' ? { fake: true } : {},
      threadPosts[`${d}|${p[0]}|${p[1]}`] ? { threadId: threadPosts[`${d}|${p[0]}|${p[1]}`].id,
        threadStage: threadPosts[`${d}|${p[0]}|${p[1]}`].stage } : {}));
    const scen = day.scen;
    day.scen = (S) => {
      const sc = scen(S);
      const failed = !S.f.billPassed;
      sc.events = (sc.events || []).concat(posts.map((p) => {
        const alt = failed && FAILED_INTRADAY[`${d}|${p.t}|${p.src}`];
        return alt ? Object.assign({}, p, { text: alt }) : Object.assign({}, p);
      }));
      return sc;
    };
  });

  B.SqwakStory = { INTRADAY, PREOPEN, POOLS, BREAKING, FAILED_INTRADAY, FAILED_FEED, FAILED_BREAKING, breaking, failedFeed, THREADS, threadAt };
})(window.BTB);
