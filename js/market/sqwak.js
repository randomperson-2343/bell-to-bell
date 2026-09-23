// Sqwak: the in-game social network. Account profiles, deterministic
// engagement numbers, sentiment reading, and hype that moves prices.
//
// Internally every Sqwak post is still an event with kind 'chirp'. That key is
// stored inside save files, so it is never renamed; only the player-facing name
// changed.
//
// All accounts are invented.
(function (B) {
  'use strict';

  // followers: raw count. acc: hidden share of posts that turn out right.
  // col: palette token used for the avatar ring.
  const ACCOUNTS = {
    '@MacroMaven':         { name: 'Macro Maven',          followers: 1650000, acc: 0.80, col: 'sky' },
    '@BondVigilante':      { name: 'Bond Vigilante',       followers: 1120000, acc: 0.76, col: 'sky' },
    '@Quant_Kween':        { name: 'Quant Kween',          followers: 1380000, acc: 0.70, col: 'violet' },
    '@TheTapeReader':      { name: 'The Tape Reader',      followers: 870000,  acc: 0.66, col: 'phosphor' },
    '@BearCaveBets':       { name: 'Bear Cave',            followers: 1040000, acc: 0.55, col: 'crimson' },
    '@DeepValueDane':      { name: 'Dane | Deep Value',    followers: 460000,  acc: 0.55, col: 'amber' },
    '@CallsOnlyCarl':      { name: 'Carl (calls only)',    followers: 2400000, acc: 0.22, col: 'jade' },
    '@TendiesTomorrow':    { name: 'tendies tomorrow',     followers: 1900000, acc: 0.20, col: 'jade' },
    '@DiamondHandsDiane':  { name: 'Diamond Hands Diane',              followers: 1300000, acc: 0.24, col: 'jade' },
    '@PromptAndPray':      { name: 'prompt & pray',        followers: 390000,  acc: 0.40, col: 'violet' },
    '@GPUgoblin':          { name: 'GPU goblin',           followers: 720000,  acc: 0.40, col: 'phosphor' },
    '@FlopsPerDollar':     { name: 'flops per dollar',     followers: 310000,  acc: 0.40, col: 'phosphor' },
    '@ScalingLawSteve':    { name: 'Scaling Law Steve',    followers: 1150000, acc: 0.40, col: 'amber' },
    '@HedgeHog88':         { name: 'HedgeHog',             followers: 95000,   acc: 0.40, col: 'grey2' }
  };

  const hash = (s) => B.hashSeed(String(s));

  function account(handle) {
    const h = handle || '@anon';
    if (ACCOUNTS[h]) return Object.assign({ handle: h }, ACCOUNTS[h]);
    // Unknown handles get a stable, small profile derived from the name.
    const n = hash(h);
    return { handle: h, name: h.replace(/^@/, ''), followers: 2000 + (n % 90000), acc: 0.4, col: 'grey2' };
  }

  function initials(acct) {
    const w = acct.name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '??';
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }

  // Engagement is a pure function of the post, so a replayed save shows the
  // same numbers. Bigger accounts and louder posts get more.
  function metrics(post) {
    const a = account(post.src);
    const n = hash(post.src + '|' + post.text + '|' + (post.t || 0));
    const loud = /!|\?\?|BREAKING|LMAO|HUGE|INSANE/i.test(post.text) ? 1.8 : 1;
    const base = Math.sqrt(a.followers) * loud;
    return {
      likes: Math.round(base * (1.2 + (n % 1000) / 400)),
      resqwaks: Math.round(base * (0.25 + ((n >>> 10) % 1000) / 1600)),
      replies: Math.round(base * (0.05 + ((n >>> 20) % 1000) / 7000))
    };
  }

  const BULL = /\b(buy|buying|bought|loading|loaded|calls|long|huge|insane|rip|moon|squeeze|premium|bullish|10-bagger|obliterated|risk on|up only)\b/i;
  const BEAR = /\b(sell|selling|short|puts|halted|bankrupt\w*|dump\w*|cooked|smells|fail\w*|slash\w*|getting out|late|ugly|probe|blow the lid|hammering|diesel|lawyer)\b/i;
  function sentiment(text) {
    const up = BULL.test(text), down = BEAR.test(text);
    return up && !down ? 1 : down && !up ? -1 : 0;
  }
  const tickersIn = (text) => (String(text).match(/\$[A-Z]{2,5}/g) || []).map((s) => s.slice(1));

  const HYPE_MIN_FOLLOWERS = 1000000;

  // Who posts what. Rumours that come true come from sharp accounts; fake
  // rumours from hype accounts; idle chatter from the jokers. That is what
  // makes the hidden accuracy scores something a player can learn.
  const VOICES = {
    sharp: ['@MacroMaven', '@BondVigilante', '@Quant_Kween', '@TheTapeReader', '@BearCaveBets', '@DeepValueDane'],
    hype: ['@CallsOnlyCarl', '@TendiesTomorrow', '@DiamondHandsDiane', '@ScalingLawSteve'],
    noise: ['@PromptAndPray', '@GPUgoblin', '@FlopsPerDollar', '@HedgeHog88', '@TendiesTomorrow', '@DiamondHandsDiane']
  };
  const pickHandle = (rng, voice) => rng.pick(VOICES[voice] || VOICES.noise);

  // Hype: a big account naming a ticker moves it, true or not, and the move
  // fades. Runs once when the day's scenario is built so saves replay exactly.
  // Uses its own seed so the rest of the day's random stream is untouched.
  function hype(events, seedKey, strength) {
    const k = strength == null ? 1 : strength;
    if (!k) return events;
    const rng = B.RNG(hash('sqwak-hype|' + seedKey));
    const valid = (sym) => B.TICKERS.some((t) => t.sym === sym && t.sector !== 'index' && t.sector !== 'fear');
    const add = [];
    const make = (t, handle, text, scale) => {
      const a = account(handle);
      if (a.followers < HYPE_MIN_FOLLOWERS) return;
      const dir = sentiment(text);
      const sym = tickersIn(text).find(valid);
      if (!dir || !sym) return;
      // 0.6% at 1M followers up to 1.8% at 3M+.
      const size = B.clamp(0.006 + (a.followers - 1e6) / 2e6 * 0.012, 0.006, 0.018) * scale * k * rng.range(0.85, 1.15);
      // The engine's shocks jump ~70% at once and settle over minutes, so the
      // pop is one shock and the fade is an opposite shock 8 to 13 minutes on.
      const fadeAt = t + 3 + Math.round(rng.range(5, 10));
      const overshoot = rng.chance(1 / 3) ? rng.range(1.15, 1.4) : 1;
      add.push({ t: t, hype: true, impacts: [{ scope: 'ticker', id: sym, pct: dir * size, over: 0.3 }] });
      add.push({ t: fadeAt, hype: true, impacts: [{ scope: 'ticker', id: sym, pct: -dir * size * overshoot, over: 0.2 }] });
    };
    for (const e of events) {
      if (e.kind === 'chirp' && e.src) make(e.t, e.src, e.text, 1);
      // A rumour ahead of real news moves at half size so it does not double up.
      if (e.rumor) make(Math.max(0, e.t - e.rumor.lead), e.rumor.src, e.rumor.text, 0.5);
    }
    return events.concat(add);
  }

  B.Sqwak = { ACCOUNTS, VOICES, pickHandle, HYPE_MIN_FOLLOWERS, account, initials, metrics, sentiment, tickersIn, hype };
})(window.BTB);
