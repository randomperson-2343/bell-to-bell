// Headless tests for the audio: node js/tests/audio-run.js
//
// The engines run against a fake Web Audio context (js/tests/fake-audio.js), so
// these check data, scheduling and the rules (cooldowns, ducking, acts, the
// closing countdown) but not how anything sounds. Levels against the kit's
// measurements are checked in a real browser by js/tests/audio-render-run.js.
const fs = require('fs');
const path = require('path');
const { load, STUBS, root } = require('./harness');
const { makeContext } = require('./fake-audio');

const ctx = load({
  groups: ['core', 'art', 'market', 'trading', 'game', 'story', 'endless'],
  setup: STUBS.game
});
const B = ctx.BTB;
const V = B.AudioVoices, D = B.AudioData;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e) }); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
const near = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) throw new Error(`${msg || ''} expected ${b}, got ${a}`); };

// A fake AudioContext for the whole run. Classic's ensure() builds it.
let fake = null;
ctx.AudioContext = function () { fake = makeContext(); return fake; };

// ---- data ---------------------------------------------------------------------
const SCORE_EVENTS = { menu: 785, feed1: 314, feed2: 306, feed3: 528, feed4: 53, game1: 1822, game2: 1872, game3: 2110, game4: 331 };

test('Nine scores ship, with the event counts of the kit', () => {
  for (const k of Object.keys(SCORE_EVENTS)) assert(D.scores[k].events.length === SCORE_EVENTS[k], `${k}: ${D.scores[k].events.length} events`);
});

test('Every Career ending has its own score, and it matches its kit file', () => {
  const list = B.StoryEndings.list;
  assert(list.length === 22, 'the game has 22 endings');
  for (const e of list) {
    const s = D.scores['end_' + e.id];
    assert(s, `no score for ending ${e.id}`);
    const kit = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'music-kit', 'events', `ending_${e.id}.json`), 'utf8'));
    assert(s.events.length === kit.events.length, `${e.id}: ${s.events.length} events, kit ${kit.events.length}`);
    near(s.loopSeconds, kit.loopSeconds, 0.001, e.id + ' loop');
    assert(s.mix.ghostLayers.length === 0, e.id + ' has no anomaly ghost');
    assert(typeof s.mix.trackGain === 'number' && s.mix.trackGain > 0.05 && s.mix.trackGain < 1, e.id + ' track gain');
    assert(s.mix.target_lufs <= -19 && s.mix.target_lufs >= -28, `${e.id} target loudness ${s.mix.target_lufs}`);
    assert(s.loopSeconds >= 35 && s.loopSeconds <= 75, `${e.id} loop length ${s.loopSeconds}`);
  }
  assert(Object.keys(D.scores).length === 9 + 22, 'score count');
});

test('Every score event is valid: time in the loop, real note, known instrument and layer', () => {
  for (const k of Object.keys(D.scores)) {
    const s = D.scores[k];
    near(s.loopSeconds, s.loopBeats * 60 / s.bpm, 0.005, k + ' loop length');
    for (const e of B.MusicEngine.events(s)) {
      assert(e.t >= 0 && e.t < s.loopBeats, `${k} t ${e.t}`);
      assert(e.n === null || (Number.isInteger(e.n) && e.n >= 0 && e.n <= 127), `${k} note ${e.n}`);
      assert(typeof V.inst[e.i] === 'function', `${k} unknown instrument ${e.i}`);
      assert(s.mix.layers[e.l], `${k} layer ${e.l} missing from the mix`);
      assert(e.v >= 0 && e.v <= 1.0001 && e.d > 0 && e.p >= -1 && e.p <= 1, `${k} event values`);
    }
  }
});

test('Every gameplay layer has an intensity curve; curves are sorted and in range', () => {
  for (const k of ['game1', 'game2', 'game3', 'game4']) {
    const m = D.scores[k].mix;
    assert(m.ghostLayers.indexOf('lead') >= 0, k + ' ghost layer');
    assert(typeof m.trackGain === 'number' && m.trackGain > 0, k + ' track gain');
    for (const L of Object.keys(m.layers)) {
      const c = m.intensityCurves[L];
      assert(c && c.length >= 2, `${k}.${L} has no curve`);
      for (let i = 0; i < c.length; i++) {
        assert(c[i][0] >= 0 && c[i][0] <= 1 && c[i][1] >= 0 && c[i][1] <= 1.0001, `${k}.${L} point ${i}`);
        if (i) assert(c[i][0] > c[i - 1][0], `${k}.${L} unsorted`);
      }
    }
  }
});

test('The feed and menu scores carry their normalising track gain', () => {
  const want = { menu: 0.3572, feed1: 0.2056, feed2: 0.1875, feed3: 0.2306, feed4: 0.1455 };
  for (const k of Object.keys(want)) near(D.scores[k].mix.trackGain, want[k], 1e-9, k);
});

test('The sound pack has 56 valid sounds', () => {
  const ids = Object.keys(D.sfx);
  assert(ids.length === 56, 'sound count ' + ids.length);
  for (const id of ids) {
    const s = D.sfx[id];
    assert(s.voices.length > 0, id + ' has no voices');
    for (const v of s.voices) {
      assert(['tone', 'noise', 'inst'].indexOf(v.type) >= 0, `${id} voice type ${v.type}`);
      if (v.type === 'inst') assert(typeof V.inst[v.inst] === 'function', `${id} instrument ${v.inst}`);
    }
    assert(s.gain > 0 && isFinite(s.gain), id + ' gain');
    assert(s.cooldown >= 0 && s.maxVoices >= 1 && s.duck >= 0, id + ' limits');
    assert(s.room === 1.4 || s.room === 2.2, id + ' room');
    assert(s.rev >= 0 && s.rev <= 1 && s.durationS > 0, id + ' reverb or length');
  }
  assert(D.sfx.anomaly_logged.voices.some((v) => v.nScale), 'anomaly_logged needs nScale');
});

test('Audio code never calls Math.random()', () => {
  for (const f of ['voices.js', 'music-engine.js', 'sfx-engine.js', 'sound.js', 'music-data.js', 'sfx-pack.js']) {
    const src = fs.readFileSync(path.join(root, 'js', 'audio', f), 'utf8');
    assert(!/Math\.random/.test(src), f + ' uses Math.random');
  }
});

test('index.html and tests.html load the audio files in dependency order', () => {
  for (const f of ['index.html', 'tests.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    const order = ['sfx.js', 'music.js', 'voices.js', 'music-data.js', 'sfx-pack.js', 'music-engine.js', 'sfx-engine.js', 'sound.js'].map((n) => html.indexOf('js/audio/' + n));
    assert(order.every((x) => x > 0), f + ' misses an audio script');
    for (let i = 1; i < order.length; i++) assert(order[i] > order[i - 1], f + ' audio order');
    assert(html.indexOf('js/audio/sound.js') < html.indexOf('js/game.js'), f + ': sound.js before game.js');
  }
});

// ---- the kit's reverb, reproduced -------------------------------------------------
test('Reverb: the random stream is numpy\'s own (seed 5 and seed 31)', () => {
  const a = V.numpyNormals(5, 4), b = V.numpyNormals(31, 3);
  [-0.80193143, -1.324359, -0.24836162, 0.42044524].forEach((x, i) => near(a[i], x, 1e-7, 'seed 5 #' + i));
  [-0.39530129, 0.26391489, 0.60712827].forEach((x, i) => near(b[i], x, 1e-7, 'seed 31 #' + i));
});

test('Reverb: the tails equal make_ir() from the kit sample for sample', () => {
  const ir = V.buildIR(1.8, 5, 0.02);
  assert(ir[0].length === Math.floor(1.8 * 44100), 'length');
  [[0, 1000, 0.0074945163671343165], [0, 20000, -0.00253522009176739], [1, 50000, 2.8605657293340824e-05], [1, 79000, 1.4504656797824665e-05]]
    .forEach(([ch, i, want]) => near(ir[ch][i], want, 1e-9, `1.8 s / seed 5 [${ch}][${i}]`));
  const room = V.buildIR(1.4, 31, 0.012);
  [[0, 1000, 0.011581809759918139], [1, 9000, -0.004983760802137818], [0, 30000, -5.038818966033197e-05]]
    .forEach(([ch, i, want]) => near(room[ch][i], want, 1e-9, `1.4 s / seed 31 [${ch}][${i}]`));
  for (let ch = 0; ch < 2; ch++) {
    let e = 0; for (let i = 0; i < ir[ch].length; i++) e += ir[ch][i] * ir[ch][i];
    near(e, 1, 1e-9, 'unit energy');
    for (let i = 0; i < Math.floor(0.02 * 44100); i++) assert(ir[ch][i] === 0, 'pre-delay is silent');
  }
});

test('Reverb: building in slices gives the same tail as building at once', () => {
  const c = makeContext();
  V.warm(c, [[1.4, 31, 0.012]]);
  const a = V.makeIR(c, 1.4, 31, 0.012);            // forces the pending build to finish
  const b = V.buildIR(1.4, 31, 0.012);
  for (const i of [0, 700, 3000, 41000, 61000]) near(a.getChannelData(0)[i], b[0][i], 1e-6, 'sample ' + i);
});

test('An older browser without the newer Web Audio pieces plays Classic instead of nothing', () => {
  const c2 = load({ groups: ['core', 'art', 'market', 'trading', 'game', 'story', 'endless'], setup: STUBS.game });
  c2.AudioContext = function () { const x = makeContext(); delete x.createStereoPanner; return x; };
  const B2 = c2.BTB;
  B2.SFX.unlock();
  B2.Music.play('menu');
  assert(B2.Sound.state.broken === true, 'did not notice the missing feature');
  assert(B2.ClassicMusic.name === 'menu', 'Classic menu music not playing');
  assert(B2.Sound.state.track === null, 'new track in a browser that cannot run it');
  B2.SFX.click();                     // must not throw
});

// ---- music engine ------------------------------------------------------------
// Replace every instrument with a recorder so the schedule can be inspected.
function recordInstruments() {
  const log = [], saved = {};
  for (const name of Object.keys(V.inst)) {
    saved[name] = V.inst[name];
    V.inst[name] = function (c, out, t0, m, vel, dur, x) { log.push({ name, t0, m, vel, dur, x, out }); return t0 + 1; };
  }
  return { log, restore() { for (const n of Object.keys(saved)) V.inst[n] = saved[n]; } };
}

function drive(tr, c, from, to, step) {
  for (let t = from; t <= to; t += step) { c.currentTime = t; tr.pump(t + B.MusicEngine.LOOKAHEAD); }
}

test('Scheduler: events fire in time order, the loop wraps without dropping or doubling a note', () => {
  const rec = recordInstruments();
  try {
    const c = makeContext();
    const score = D.scores.menu, n = score.events.length, spb = 60 / score.bpm;
    const loop = score.loopBeats * spb;   // the data file rounds loopSeconds; the engine uses beats
    const tr = new B.MusicEngine.Track(c, score, c.destination, { intensity: 0.6 });
    tr.begin(0);
    drive(tr, c, 0, loop * 2.05, 0.05);
    const ev = B.MusicEngine.events(score);
    const first = rec.log.filter((r) => r.t0 < loop - 1e-6);
    assert(first.length === n, `loop 1 fired ${first.length} of ${n}`);
    const second = rec.log.filter((r) => r.t0 >= loop - 1e-6 && r.t0 < 2 * loop - 1e-6);
    assert(second.length === n, `loop 2 fired ${second.length} of ${n}`);
    for (let i = 0; i < n; i++) {
      near(first[i].t0, ev[i].t * spb, 1e-6, 'loop 1 note ' + i);
      near(second[i].t0, ev[i].t * spb + loop, 1e-6, 'loop 2 note ' + i);
    }
    for (let i = 1; i < rec.log.length; i++) assert(rec.log[i].t0 >= rec.log[i - 1].t0 - 1e-9, 'out of order at ' + i);
  } finally { rec.restore(); }
});

test('Scheduler: stop() cancels everything', () => {
  const rec = recordInstruments();
  try {
    const c = makeContext();
    const tr = new B.MusicEngine.Track(c, D.scores.feed1, c.destination, {});
    tr.begin(0);
    drive(tr, c, 0, 3, 0.05);
    const before = rec.log.length;
    tr.stop(0.3);
    drive(tr, c, 3.05, 12, 0.05);
    assert(before > 0 && rec.log.length === before, 'notes kept firing after stop');
    assert(tr.stopped && tr.timer === null, 'still running');
    const last = tr.out.gain.events[tr.out.gain.events.length - 1];
    assert(last[0] === 'target' && last[1] === 0, 'no fade-out scheduled');
  } finally { rec.restore(); }
});

test('Intensity: every layer follows its curve at 0, 0.3, 0.6 and 1', () => {
  for (const k of ['game1', 'game2', 'game3', 'game4']) {
    const c = makeContext(), s = D.scores[k];
    const tr = new B.MusicEngine.Track(c, s, c.destination, { intensity: 0.5 });
    for (const x of [0, 0.3, 0.6, 1]) {
      tr.setIntensity(x, true);
      for (const L of Object.keys(s.mix.layers)) {
        const want = s.mix.layers[L].gain * B.MusicEngine.curveAt(s.mix.intensityCurves[L], x);
        near(tr.layers[L].node.gain.value, want, 1e-9, `${k}.${L} at ${x}`);
      }
    }
  }
});

test('Intensity changes ease with a 0.4 second time constant', () => {
  const c = makeContext();
  const tr = new B.MusicEngine.Track(c, D.scores.game1, c.destination, { intensity: 0.2 });
  c.currentTime = 5;
  tr.setIntensity(0.9);
  const ev = tr.layers.keys.node.gain.events.filter((e) => e[0] === 'target').pop();
  assert(ev && ev[3] === 0.4 && ev[2] === 5, 'no eased target');
});

test('Quiet layers are not scheduled: at 0.25 a normal day plays no arp, lead or second kick', () => {
  const rec = recordInstruments();
  try {
    const c = makeContext();
    const tr = new B.MusicEngine.Track(c, D.scores.game1, c.destination, { intensity: 0.25 });
    tr.begin(0);
    drive(tr, c, 0, 70, 0.1);
    const layers = {};
    for (const r of rec.log) layers[r.name] = (layers[r.name] || 0) + 1;
    assert(!layers.arp && !layers.lead, 'arp or lead played at 0.25: ' + JSON.stringify(layers));
    assert(layers.sub && layers.pad && layers.tick, 'the calm layers must play: ' + JSON.stringify(layers));
  } finally { rec.restore(); }
});

test('A layer that comes back in is scheduled again', () => {
  const rec = recordInstruments();
  try {
    const c = makeContext();
    const tr = new B.MusicEngine.Track(c, D.scores.game1, c.destination, { intensity: 0.25 });
    tr.begin(0);
    drive(tr, c, 0, 10, 0.1);
    assert(!rec.log.some((r) => r.name === 'arp'), 'arp before the rise');
    tr.setIntensity(0.8);
    drive(tr, c, 10.1, 20, 0.1);
    assert(rec.log.some((r) => r.name === 'arp' && r.t0 > 10), 'arp never returned');
  } finally { rec.restore(); }
});

test('Ghost: n = 0 adds nothing; n = 1, 6, 12 follow the handoff rule on the melody and lead layers', () => {
  const M = B.MusicEngine;
  assert(M.ghostEvents(D.scores.feed2, 0).length === 0, 'n 0');
  for (const [key, layer] of [['feed2', 'melody'], ['game2', 'lead']]) {
    const s = D.scores[key], spb = 60 / s.bpm;
    const src = M.events(s).filter((e) => e.l === layer && e.n != null);
    for (const n of [1, 6, 12]) {
      const g = M.ghostEvents(s, n);
      assert(g.length === src.length, `${key} n=${n}: ${g.length} ghosts for ${src.length} notes`);
      // events are sorted by time, so pair them by the event index k
      const byK = {}; for (const e of src) byK[e.k] = e;
      for (const e of g) {
        const o = byK[e.k];
        near(e.t, o.t + (n * 0.015) / spb, 1e-9, 'start');
        near(e.v, Math.min(1, o.v * (0.22 + 0.045 * n)), 1e-9, 'velocity');
        near(e.x.cents, 3 * n, 1e-9, 'cents');
        near(e.p, Math.max(-1, Math.min(1, -o.p - 0.1)), 1e-9, 'pan');
        assert(e.i === 'ghost' && e.l === 'ghost', 'instrument');
      }
    }
  }
});

test('Ghost: the track builds a ghost layer (gain 0.5, reverb 0.4) that follows the lead curve', () => {
  const c = makeContext(), s = D.scores.game3;
  const tr = new B.MusicEngine.Track(c, s, c.destination, { anomaly: 6, intensity: 0.4 });
  assert(tr.layers.ghost, 'no ghost layer');
  near(tr.layers.ghost.gain, 0.5, 1e-9, 'ghost gain');
  near(tr.layers.ghost.node.gain.value, 0.5 * B.MusicEngine.curveAt(s.mix.intensityCurves.lead, 0.4), 1e-9, 'follows lead curve');
  assert(!new B.MusicEngine.Track(c, s, c.destination, { anomaly: 0 }).layers.ghost, 'ghost at n = 0');
});

test('Load shedding: a struggling audio thread thins the arrangement in stages, cheapest sound last', () => {
  const rec = recordInstruments();
  try {
    const M = B.MusicEngine;
    const count = (level) => {
      rec.log.length = 0;
      const c = makeContext();
      const tr = new M.Track(c, D.scores.game2, c.destination, { intensity: 1, light: level });
      tr.begin(0);
      drive(tr, c, 0, 30, 0.1);
      const by = {};
      for (const r of rec.log) by[r.name] = (by[r.name] || 0) + 1;
      return by;
    };
    const full = count(0), l1 = count(1), l2 = count(2), l3 = count(3);
    assert(full.ep > 0 && full.arp > 0 && full.tock > 0, 'full arrangement');
    assert(!l1.ep && l1.arp > 0, 'level 1 drops the piano stabs only');
    assert(!l2.arp && l2.tock > 0, 'level 2 drops the arpeggio');
    assert(!l3.tock && l3.sub > 0 && l3.pad > 0, 'level 3 still has the bass and the pad');
    // the clock watcher: 10 s of audio clock that ran at 80 percent of the wall clock
    const c = makeContext(), tr = new M.Track(c, D.scores.game2, c.destination, {});
    const realNow = ctx.performance.now; let wall = 1000;
    ctx.performance = { now: () => wall };
    try {
      tr.watchLoad();                           // first sample
      wall += 10500; c.currentTime += 8.4;      // 10.5 s later the audio clock moved 8.4 s
      tr.watchLoad();
      assert(tr.level === 1, 'did not lighten, level ' + tr.level);
      wall += 10500; c.currentTime += 10.4;     // healthy window
      tr.watchLoad();
      assert(tr.level === 1, 'lightened a healthy clock');
    } finally { ctx.performance = { now: realNow }; M.light = 0; }
  } finally { rec.restore(); B.MusicEngine.light = 0; }
});

test('Every score builds a full graph and starts cleanly', () => {
  const rec = recordInstruments();
  try {
    for (const k of Object.keys(D.scores)) {
      const c = makeContext();
      const tr = new B.MusicEngine.Track(c, D.scores[k], c.destination, { intensity: 0.6, anomaly: 3 });
      tr.begin(0);
      drive(tr, c, 0, 4, 0.1);
      assert(rec.log.length > 0, k + ' fired nothing');
      rec.log.length = 0;
    }
  } finally { rec.restore(); }
});

test('Pad filter automation loops: ramps end on the first value', () => {
  const c = makeContext(), s = D.scores.menu;
  const tr = new B.MusicEngine.Track(c, s, c.destination, {});
  tr.begin(10);
  tr.prepareLoop(10);
  const pts = s.mix.pad_filter;
  const exp = tr.padFilter.frequency.events.filter((e) => e[0] === 'exp');
  near(exp[exp.length - 1][1], pts[0][1], 1e-9, 'last ramp target');
  near(exp[exp.length - 1][2], 10 + s.loopBeats * 60 / s.bpm, 1e-6, 'last ramp lands on the loop point');
});

// ---- sound effects -----------------------------------------------------------
function freshSfx() {
  const c = makeContext();
  const mixer = B.AudioMixer.get(c);
  return { c, mixer, E: B.SfxEngine.make(mixer) };
}

test('SFX: cooldown blocks a second play inside the window', () => {
  const { c, E } = freshSfx();
  c.currentTime = 1; assert(E.play('order_buy') === true, 'first');
  c.currentTime = 1.03; assert(E.play('order_buy') === false, 'inside 0.06 s');
  c.currentTime = 1.07; assert(E.play('order_buy') === true, 'after');
});

test('SFX: maxVoices steals the oldest voice with a 30 ms fade', () => {
  const { c, E } = freshSfx();
  const max = D.sfx.order_buy.maxVoices;
  const handles = [];
  for (let i = 0; i < max; i++) { c.currentTime = 1 + i * 0.1; E.play('order_buy'); handles.push(E.active.order_buy[i].ctl); }
  c.currentTime = 1 + max * 0.1;
  E.play('order_buy');
  const live = E.active.order_buy;
  assert(live.length === max, 'still at the limit');
  const fade = handles[0].gain.events.filter((e) => e[0] === 'lin').pop();
  assert(fade && fade[1] === 0 && near(fade[2], c.currentTime + 0.03, 1e-9) === undefined, 'oldest not faded');
  assert(handles[1].gain.events.length === 0, 'a newer voice was touched');
});

test('SFX: a loud sound ducks the music down and lets it come back', () => {
  const { c, mixer, E } = freshSfx();
  c.currentTime = 2;
  E.play('flash_crash');
  const ev = mixer.duckGain.gain.events;
  const down = ev.find((e) => e[0] === 'lin');
  near(down[1], Math.pow(10, -6 / 20), 1e-6, 'depth of 6 dB');
  near(down[2], 2.02, 1e-9, '20 ms attack');
  const hold = Math.min(0.35 + 0.15 * D.sfx.flash_crash.durationS, 2);
  const up = ev.filter((e) => e[0] === 'lin').pop();
  near(up[1], 1, 1e-9, 'returns to full');
  near(up[2], 2 + 0.02 + hold + 0.6, 1e-6, 'release 0.6 s after the hold');
});

test('SFX: a second ducking sound takes the deeper dip', () => {
  const { c, mixer } = freshSfx();
  c.currentTime = 1; mixer.duck(6, 1);
  c.currentTime = 1.1; mixer.duck(3, 1);
  near(mixer.duckState.depth, Math.pow(10, -6 / 20), 1e-9, 'kept the 6 dB dip');
  c.currentTime = 1.2; mixer.duck(9, 1);
  near(mixer.duckState.depth, Math.pow(10, -9 / 20), 1e-9, 'deepened to 9 dB');
});

test('SFX: anomaly_logged follows nScale: sharper, later and louder as n grows', () => {
  for (const n of [1, 6, 12]) {
    const c = makeContext(), out = c.createGain();
    const v = D.sfx.anomaly_logged.voices.find((x) => x.nScale);
    V.sfxVoice(c, out, 3, v, 1, n);
    const osc = c.nodes.filter((x) => x.kind === 'osc').pop();
    near(osc.startT, 3 + v.nScale.delayS * n, 1e-9, `n=${n} start`);
    near(osc.detune.value, v.nScale.cents * n, 1e-9, `n=${n} cents`);
    const gains = c.nodes.filter((x) => x.kind === 'gain' && x.gain.events.some((e) => e[0] === 'lin'));
    const peak = gains[gains.length - 1].gain.events.find((e) => e[0] === 'lin')[1];
    near(peak, Math.min(1, v.v * (v.nScale.vBase + v.nScale.vPer * n)), 1e-9, `n=${n} level`);
  }
});

// ---- the front door: New and Classic, acts, the day ------------------------------
function setup() {
  B.Sound.setStyle('new');
  B.SFX.unlock();
  B.Sound.state.trace = [];
  return B.Sound.state;
}
function ids(S) { return S.trace.map((t) => t.id); }

test('Acts: D1-15 Act I, D16-30 II, D31-45 III, D46-61 IV, for the feed and the day; Endless is Act I', () => {
  const S = setup();
  for (let d = 0; d < 61; d++) {
    const want = d < 15 ? 0 : d < 30 ? 1 : d < 45 ? 2 : 3;
    const g = { day: d, mode: { kind: 'story', S: { anomalies: 0 } } };
    B.Music.setGame(g);
    assert(B.Sound.plan.brief().key === 'feed' + (want + 1), `feed on day ${d + 1}`);
    assert(B.Sound.plan.trading().key === 'game' + (want + 1), `game on day ${d + 1}`);
  }
  B.Music.setGame({ day: 40, mode: { kind: 'endless' } });
  assert(B.Sound.plan.brief().key === 'feed1' && B.Sound.plan.trading().key === 'game1', 'endless act');
  S.trace = null;
});

test('Ghost count comes from the anomaly counter and is passed to the track', () => {
  B.Music.setGame({ day: 20, mode: { kind: 'story', S: { anomalies: 7 } } });
  assert(B.Sound.plan.brief().anomaly === 7 && B.Sound.plan.trading().anomaly === 7, 'anomaly count');
  B.Music.setGame({ day: 20, mode: { kind: 'story', S: { anomalies: 40 } } });
  assert(B.Sound.plan.brief().anomaly === 12, 'clamped at 12');
});

test('Music: menu, feed and the day start in the right voice; the old ending tracks stay Classic when asked for by name', () => {
  setup();
  B.Music.setGame({ day: 35, mode: { kind: 'story', S: { anomalies: 0 } } });
  B.Music.play('menu');
  assert(B.Sound.state.trackName === 'menu' && B.Sound.state.track, 'menu');
  B.Music.play('brief');
  assert(B.Sound.state.trackName === 'brief' && B.Sound.state.track.key === 'feed3', 'Act III day 36 plays feed 3');
  B.Music.play('trading');
  assert(B.Sound.state.trackName === 'trading' && B.Sound.state.track.key === 'game3', 'Act III day 36 plays gameplay 3');
  B.Music.play('endingDark');
  assert(B.Sound.state.track === null, 'new track still playing under an ending');
  assert(B.ClassicMusic.name === 'endingDark', 'ending music is Classic');
  B.Music.stop();
});

test('Music: each ending screen plays its own score in New and the old track in Classic', () => {
  const S = setup();
  B.Music.setGame({ day: 60, mode: { kind: 'story', S: { anomalies: 0 } } });
  for (const e of B.StoryEndings.list) {
    B.Music.ending({ id: e.id }, e.dark ? 'endingDark' : 'endingLight');
    assert(S.track && S.trackName === 'ending' && S.track.key === 'end_' + e.id, `${e.id} played ${S.track && S.track.key}`);
    assert(B.ClassicMusic.name === null, 'classic score under a new ending');
  }
  // the ten Endless endings borrow a career ending's music
  const want = { margin: 'wiped', sudden: 'wiped', drawdown: 'fired', fired: 'fired', burnout: 'exit', quit: 'exit', legend: 'fund', rich: 'soft', survivorUp: 'grind', survivor: 'grind' };
  for (const id of Object.keys(want)) {
    B.Music.ending({ id }, 'endingDark');
    assert(S.track.key === 'end_' + want[id], `endless ${id} played ${S.track.key}`);
  }
  // an ending with no score, or no new engine, falls back to the old track
  B.Music.ending({ id: 'no-such-ending' }, 'endingLight');
  assert(S.track === null && B.ClassicMusic.name === 'endingLight', 'unknown ending did not fall back to Classic');
  B.Music.ending({ id: 'soft' }, 'endingLight');
  B.Sound.setStyle('classic');
  assert(S.track === null && B.ClassicMusic.name === 'endingLight', 'Classic style did not play the old ending track');
  B.Sound.setStyle('new');
  assert(S.track && S.track.key === 'end_soft' && B.ClassicMusic.name === null, 'switching back to New lost the ending music');
  // muted: nothing plays, and the score comes back when music is switched on again
  B.Music.setEnabled(false);
  assert(S.track === null, 'ending music playing while muted');
  B.Music.setEnabled(true);
  assert(S.track && S.track.key === 'end_soft', 'ending music did not return after unmuting');
  B.Music.stop();
});

test('Music: building an ending\'s reverb ahead of time does not throw, and is skipped for Classic', () => {
  setup();
  B.Music.prepareEnding({ id: 'wiped' });
  B.Music.prepareEnding({ id: 'no-such-ending' });
  B.Sound.setStyle('classic');
  B.Music.prepareEnding({ id: 'wiped' });
  B.Sound.setStyle('new');
});

test('Music: the day starts at intensity 0.25 and the first 10 seconds stay at or under 0.35', () => {
  setup();
  B.Music.setGame({ day: 0, mode: { kind: 'story', S: { anomalies: 0 } } });
  B.Music.play('trading');
  near(B.Sound.state.track.intensity, 0.25, 1e-9, 'start intensity');
  const g = {
    day: 0, rate: 390 / 180, speed: 1, stress: { level: () => 1 },
    market: { t: 100, indexMove: () => 0.5 },
    broker: { rules: { maxLev: 4 }, netLiq: () => 1000, stockGross: () => 4000 },
    interrupts: { active: { kind: 'choice', state: 'open' } }, mode: { kind: 'story' }
  };
  B.Sound.state.dayStartAt = Date.now();
  assert(B.Music.intensityFor(g, 1) <= 0.35 + 1e-9, 'capped in the first 10 seconds');
  B.Sound.state.dayStartAt = Date.now() - 60000;
  assert(B.Music.intensityFor(g, 1) > 0.9, 'a storm plays at the top');
  g.market.indexMove = () => 0; g.broker.stockGross = () => 0; g.interrupts.active = null;
  near(B.Music.intensityFor(g, 0), 0.25, 1e-9, 'a calm day sits at 0.25');
  B.Music.stop();
});

test('Intensity formula: the last 15 seconds rush toward full, and the last 8 climb to 1.0', () => {
  setup();
  const mk = (t) => ({ day: 0, rate: 390 / 180, speed: 1, market: { t, indexMove: () => 0 },
    broker: { rules: { maxLev: 4 }, netLiq: () => 1000, stockGross: () => 0 }, interrupts: {}, mode: { kind: 'story' } });
  const S = B.Sound.state;
  S.dayStartAt = 0; S.closeRamp = null;
  const at = (secsLeft) => B.Music.intensityFor(mk(390 - secsLeft * 390 / 180), 0);
  near(at(20), 0.25, 1e-9, '20 s out');
  near(at(7.5), 0.25 + 7.5 / 15, 0.06, '7.5 s out'); // closeRush at 7.5 s is 0.5
  assert(at(7) < at(3) && at(3) <= at(0.5), 'rises through the last seconds');
  near(at(0), 1, 1e-9, 'full at the bell');
});

test('Trades map to the pack: buy, sell, short, cover, limit fill, and a result a beat later', () => {
  const S = setup();
  const eq = 250000;
  B.SFX.fill(10, { before: 0, realized: -4, eq });
  B.SFX.fill(-10, { before: 10, realized: 4000, eq });
  B.SFX.fill(-10, { before: 0, realized: -4, eq });
  B.SFX.fill(10, { before: -10, realized: -3000, eq });
  B.SFX.fill(5, { resting: true, realized: 10, eq });
  const got = ids(S);
  const want = ['order_buy', 'order_sell', 'win_close', 'order_short', 'order_cover', 'loss_close', 'order_limit_fill'];
  assert(JSON.stringify(got) === JSON.stringify(want), 'got ' + got.join(','));
  const win = S.trace.find((t) => t.id === 'win_close');
  near(win.o.delay, 0.25, 1e-9, 'win_close comes 0.25 s after order_sell');
  // the old cash() on a market order is now part of fill(): it must not add a second sound
  S.trace.length = 0;
  B.SFX.cash('trade');
  assert(S.trace.length === 0, 'cash(trade) doubled the result');
});

test('Closing countdown: riser at T-8, ticks T-10 to T-4, finals T-3 to T-1', () => {
  const S = setup();
  B.SFX.countdown(999);
  const c = fake;
  c.currentTime = 100;
  const t0 = 100;
  for (let rem = 12; rem >= 0.001; rem = Math.round((rem - 0.05) * 1000) / 1000) {
    c.currentTime = t0 + (12 - rem);
    B.SFX.countdown(rem);
  }
  const got = ids(S);
  const ticks = got.filter((x) => x === 'countdown_tick').length, finals = got.filter((x) => x === 'countdown_final').length;
  assert(ticks === 7 && finals === 3, `ticks ${ticks}, finals ${finals}`);
  assert(got.filter((x) => x === 'close_riser').length === 1, 'riser once');
  const riserAt = S.trace.find((t) => t.id === 'close_riser').t - t0, firstTick = S.trace.find((t) => t.id === 'countdown_tick').t - t0;
  near(firstTick, 2, 0.06, 'first tick is at T-10');
  near(riserAt, 4, 0.06, 'riser at T-8');
  assert(got.indexOf('countdown_final') > got.lastIndexOf('countdown_tick'), 'finals after ticks');
});

test('Every sound the game can ask for exists in the pack', () => {
  const S = setup();
  const eq = 250000;
  B.SFX.bell(); B.SFX.haltEnd(); B.SFX.marketClose();
  B.SFX.fill(1, { before: 0 }); B.SFX.fill(-1, { kind: 'cover', realized: 500, eq });
  B.SFX.cash('vote'); B.SFX.cash('task');
  B.SFX.reject(); B.SFX.limitSet(); B.SFX.orderCancel(); B.SFX.click(); B.SFX.uiTab(); B.SFX.ground();
  B.SFX.phoneOpen(); B.SFX.feedSkip();
  for (const k of ['wire', 'chirp', 'alert', 'push', 'sub']) B.SFX.news({ kind: k });
  for (const f of ['Imani Rhodes', 'Desmond Kroll', 'Compliance', 'Mom']) B.SFX.news({ kind: 'inbox', from: f });
  B.SFX.resqwak(); B.SFX.paywall(); B.SFX.anomaly(4);
  B.SFX.alarm('margin'); B.SFX.alarm('overnight'); B.SFX.crash(); B.SFX.halt(); B.SFX.panic(); B.SFX.heatUp();
  B.SFX.choice('card'); B.SFX.choice('choice'); B.SFX.choice('call');
  B.SFX.decisionTick(); B.SFX.decisionTimeout(); B.SFX.decisionConfirm();
  B.SFX.quotaMet(); B.SFX.quotaMissed(); B.SFX.weekMade(); B.SFX.strike();
  for (const e of [{ id: 'wiped' }, { id: 'fired' }, { unpriced: true }, { id: 'master' }, { id: 'soft' }]) B.SFX.ending(e);
  const seen = new Set(ids(S));
  for (const id of seen) assert(D.sfx[id], 'no such sound: ' + id);
  for (const id of ['bell_open', 'bell_close', 'order_buy', 'order_cover', 'order_limit_fill', 'hope_chime', 'sqwak_post', 'sqwak_alert_wire', 'sqwak_push',
    'dm_imani', 'dm_kroll', 'dm_compliance', 'mail_new', 'ending_wiped', 'ending_fired', 'ending_unpriced', 'ending_hollow_win']) assert(seen.has(id), 'never used: ' + id);
});

test('Ordinary wire and Sqwak items are a quiet pop; a big one is left to its own alert', () => {
  const S = setup();
  B.SFX.news({ kind: 'wire', big: false }); B.SFX.news({ kind: 'chirp', big: false });
  B.SFX.news({ kind: 'wire', big: true });
  B.SFX.news({ kind: 'alert' });
  assert(JSON.stringify(ids(S)) === JSON.stringify(['sqwak_post', 'sqwak_post', 'sqwak_alert_wire']), ids(S).join(','));
});

test('Classic: nothing reaches the new engines, and the old calls still work', () => {
  const S = setup();
  B.Sound.setStyle('classic');
  S.trace = [];
  const before = fake.nodes.length;
  B.SFX.click(); B.SFX.fill(1, { before: 0 }); B.SFX.bell(); B.SFX.reject(); B.SFX.news({ kind: 'wire' }); B.SFX.alarm('margin');
  B.SFX.anomaly(3); B.SFX.ending({ id: 'soft' }); B.Music.play('menu');
  assert(S.trace.length === 0, 'new engine ran in Classic');
  assert(fake.nodes.length > before, 'old sounds did not build any nodes');
  assert(S.track === null, 'new track under Classic');
  assert(B.ClassicMusic.name === 'menu', 'classic menu score not selected');
  B.SFX.tick(); B.SFX.heartbeat(0.8);
  B.Sound.setStyle('new');
  assert(B.Sound.state.track && B.Sound.state.trackName === 'menu', 'switching back did not resume the menu in the new voice');
  assert(B.ClassicMusic.name === null, 'classic score left selected under the new one');
  B.Music.stop();
});

test('New: the closing tick and the stress heartbeat are replaced, not doubled', () => {
  const S = setup();
  const before = fake.nodes.length;
  B.SFX.tick(); B.SFX.heartbeat(1);
  assert(fake.nodes.length === before && S.trace.length === 0, 'classic tick or heartbeat played in New');
});

test('The sound style is a setting, not part of a save', () => {
  const g = new B.Game(B.StoryMode());
  const snap = JSON.stringify(g.snapshot());
  assert(!/soundStyle|"sound"/.test(snap), 'sound style leaked into the save');
});

test('Muting music stops the new score; unmuting brings it back; sound effects follow their own switch', () => {
  const S = setup();
  B.Music.setGame({ day: 0, mode: { kind: 'story', S: { anomalies: 0 } } });
  B.Music.play('menu');
  assert(S.track, 'playing');
  B.Music.setEnabled(false);
  assert(S.track === null, 'still playing while muted');
  B.Music.setEnabled(true);
  assert(S.track && S.trackName === 'menu', 'did not come back');
  B.SFX.setEnabled(false);
  S.trace.length = 0;
  B.SFX.click();
  assert(S.trace.length === 0, 'sound effect played while off');
  B.SFX.setEnabled(true);
  B.Music.stop();
});

// ---- report ---------------------------------------------------------------------
let fail = 0;
for (const r of results) {
  if (r.ok) console.log('  PASS  ' + r.name);
  else { fail++; console.log('  FAIL  ' + r.name + '\n        ' + r.err); }
}
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
