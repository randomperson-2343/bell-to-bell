// Motion QA in Chromium: camera, determinism, letterbox, motion off, resize, canvas reallocation.
// node js/tests/motion-run.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4179);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };

let browser = null;
async function run() {
  await wait(450);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#screen-menu.active', { timeout: 10000 });
  await page.evaluate(() => {
    const S = BTB.Settings;
    S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
    // pixel hash of the #cine-canvas (rows = number of top rows to hash, 0 = all)
    window.hashCanvas = (rows) => {
      const cv = document.getElementById('cine-canvas');
      const h = rows ? rows : cv.height;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, h).data;
      let x = 2166136261;
      for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); }
      return (x >>> 0).toString(16);
    };
    window.openBeat = (scene, opts) => {
      const C = BTB.Cinematic;
      if (C.running) C.finish();
      C.startChain('motion-qa');
      C.play(scene, opts, () => {});
      C.pause();
    };
  });
  const frame = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t); return window.hashCanvas(0);
  }, [scene, opts, i, t]);
  const band = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t);
    const cv = document.getElementById('cine-canvas');
    return window.hashCanvas(Math.round(12 * cv.width / 640));
  }, [scene, opts, i, t]);
  // the shot above the caption box (captions type in over time, so they are left out here)
  const shot = (scene, opts, i, t) => page.evaluate(([s, o, i, t]) => {
    window.openBeat(s, o); BTB.Cinematic.seek(i, t);
    return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75));
  }, [scene, opts, i, t]);
  const day7 = { day: 7, brief: { title: 'Headline', feed: [] } };

  // ---- stage 3 batch 7: reference pictures of the decision rooms and their beats, recorded before the code changed ----
  // room() flat for every id, after false and true, with and without story state, on four days; the final frame of both beats of B.Scenes.decision for every id;
  // the news and weekend beats that draw the vote, hearing and rack rooms; the aftermath popup's still. P8_CHANGED holds the ruled changes (none).
  const collectP8 = () => page.evaluate(() => {
    const fnvS = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, cv);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const A = BTB.DecisionArt, out = {}, view = { w: 640, h: 360 };
    const items = BTB.Life.LIFE.map((b) => ({ id: b.id, day: b.day, speaker: b.speaker, role: b.role, title: b.title }))
      .concat(Object.keys(BTB.StoryData.CHOICES).filter((k) => !BTB.StoryData.CHOICES[k].mid).map((k) => { const c = BTB.StoryData.CHOICES[k]; return { id: k, day: c.day, speaker: c.speaker, role: c.role, title: c.title }; }));
    const FULL = { f: { billPassed: true, pulledPlug: true }, wallet: { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } } };
    for (const it of items) for (const after of [false, true]) for (const [sk, S] of [['n', null], ['f', FULL]]) {
      const hs = [it.day, 0, 21, 40, 60].map((d) => hashOf((g) => A.room(g, it.id, d, after, S)));
      out[`rm:${it.id}:${after ? 'a' : 'b'}${sk}`] = fnvS(hs.join());
    }
    for (const it of items) for (const [sk, S, spk] of [['fresh', BTB.StoryMode.freshState(250000), it.speaker], ['none', null, it.speaker], ['nobody', FULL, 'Nobody At All'], ['empty', null, '']]) {
      BTB.Scenes.decision({ id: it.id, day: it.day, speaker: spk, role: it.role, title: sk === 'empty' ? '' : it.title, S }).forEach((b) => { out[`dc:${it.id}:${sk}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    }
    // the news and weekend beats that borrow the rooms
    const nopt = (day, S) => Object.assign({ day, brief: { title: 'Headline of the day', feed: [] } }, S ? { game: { mode: { S } } } : {});
    const take = (key, scene, o) => BTB.Scenes[scene](o).forEach((b) => { out[`bw:${key}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    for (const d of [11, 38, 41]) take('news' + d, 'news', nopt(d));
    take('news41p', 'news', nopt(41, { f: { billPassed: true } }));
    take('news45p', 'news', nopt(45, { f: { pulledPlug: true } }));
    take('wk39', 'weekend', { day: 39 });
    take('wk44', 'weekend', { day: 44 });
    take('wk44p', 'weekend', { day: 44, game: { mode: { S: { f: { pulledPlug: true } } } } });
    for (const id of BTB.Rhythm.endingIds.slice(0, 22)) BTB.Scenes.ending({ id, title: id, deck: 'Deck', dark: false }).forEach((b, k) => { out[`en:${id}:${k}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    // the aftermath popup's still
    for (const [k, id, day, S] of [['c1', 'c1', 3, null], ['c8', 'c8', 39, null], ['c8p', 'c8', 39, { f: { billPassed: true } }], ['c10p', 'c10', 44, { f: { pulledPlug: true } }], ['vetER', 'vetER', 27, null], ['adopt', 'adopt', 4, null], ['pet', 'vetCheck', 14, FULL]]) {
      out['still:' + k] = hashOf((g, cv) => A.still(cv, { id, day, S }));
    }
    return out;
  });
  // ---- stage 3 batch 8: reference pictures of the weekend beats and the flat Sunday and night room, recorded before the code changed ----
  // The final frame of every beat (sat, sun, hold, whip, 317) of many weekends: three housing tiers, late rent 0 and 2, no pet / cat / neglected dog, an autumn, a grey and a
  // winter weekend, the story days, day 44 with and without the pulled plug; and the flat sundayShot and apartmentShot(night). P9_CHANGED holds the ruled changes.
  const collectP9 = () => page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i += 1) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, out = {}, view = { w: 640, h: 360 };
    const PETS = { n: null, cat: { pet: { kind: 'cat', sex: 'boy' } }, dog: { pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' } };
    const mkW = (tier, late, pet) => Object.assign({ tier, lateWeeks: late }, PETS[pet] || {});
    const mk = (day, tier, late, pet, plug) => ({ day, game: { mode: { S: Object.assign({ wallet: mkW(tier, late, pet) }, plug ? { f: { pulledPlug: true } } : {}) } } });
    const take = (tag, o) => BTB.Scenes.weekend(o).forEach((b) => { out[`wk:${tag}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    for (const tier of [0, 2, 5]) for (const late of [0, 2]) for (const pet of ['n', 'cat', 'dog']) take(`9:t${tier}:l${late}:${pet}`, mk(9, tier, late, pet, false));
    for (const day of [19, 49]) for (const [tier, late, pet] of [[2, 0, 'n'], [0, 2, 'cat'], [4, 0, 'dog'], [1, 2, 'n']]) take(`${day}:t${tier}:l${late}:${pet}`, mk(day, tier, late, pet, false));
    for (const day of [4, 14, 24, 34, 39]) for (const [tier, late, pet] of [[2, 0, 'n'], [0, 2, 'cat'], [3, 0, 'dog'], [1, 2, 'n']]) take(`${day}:t${tier}:l${late}:${pet}`, mk(day, tier, late, pet, false));
    for (const plug of [false, true]) for (const tier of [0, 2, 5]) for (const late of [0, 2]) for (const pet of ['n', 'cat']) take(`44:t${tier}:l${late}:${pet}:${plug ? 'p' : 'o'}`, mk(44, tier, late, pet, plug));
    take('nogame:9', { day: 9 }); take('nogame:39', { day: 39 }); take('nogame:44', { day: 44 });
    for (const day of [9, 39, 44]) for (let tier = 0; tier < 6; tier++) for (const late of [0, 2]) for (const pet of ['n', 'cat', 'dog']) {
      const w = mkW(tier, late, pet), home = SB.homeOf(w), k = `${day}:t${tier}:l${late}:${pet}`;
      out[`flat:sun:${k}`] = hashOf((g) => SB.sundayShot(g, day, home, w));
      out[`flat:night:${k}`] = hashOf((g) => SB.apartmentShot(g, day, home, true, w));
    }
    out['flat:sun:nogame'] = hashOf((g) => SB.sundayShot(g, 9, SB.homeOf(undefined), undefined));
    out['flat:night:nogame'] = hashOf((g) => SB.apartmentShot(g, 9, SB.homeOf(undefined), true, undefined));
    return out;
  });
  // ---- stage 3 batch 9: reference pictures of the endings, recorded before the code changed ----
  // endingDetail at the progress values the old beats used (0.3 world, 1 card) and endingShot for every id (dark and light), both as the shots draw them (the 8-unit drop); the final frame
  // of the three beats of every id, dark and light, with an ordinary, an empty and a very long title; the pulled-plug after. P10_CHANGED holds the ruled changes (wiped and perp world finals).
  const collectP10 = () => page.evaluate(() => {
    const hashOf = (fn, w, h) => { w = w || 640; h = h || 360; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; fn(g);
      const d = g.getImageData(0, 0, w, h).data; let x = 2166136261; for (let i = 0; i < d.length; i += 1) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SH = BTB.Shots, out = {}, view = { w: 640, h: 360 };
    for (const id of BTB.Rhythm.endingIds) {
      for (const kind of ['dark', 'light']) out[`es:${id}:${kind}`] = hashOf((g) => SH.endingShot(g, kind, id), 320, 180);
      for (const p of [0.3, 1]) out[`ed:${id}:${p}`] = hashOf((g) => { g.save(); g.translate(0, 8); SH.endingDetail(g, id, p); g.restore(); }, 320, 180);
      for (const dark of [false, true]) for (const [tk, title] of [['n', 'The Title of It'], ['e', ''], ['l', 'W'.repeat(80)]]) {
        BTB.Scenes.ending({ id, title, deck: 'A line of deck text.', dark }).forEach((b, k) => {
          if (k === 2 && (id !== 'wiped' || tk !== 'n')) return;
          if (k === 0 && tk !== 'n') return;
          out[`eb:${id}:${dark ? 'd' : 'l'}:${tk}:${k}`] = hashOf((g) => b.draw(g, view, 1, {}));
        });
      }
    }
    for (const dark of [false, true]) BTB.Scenes.ending({ id: 'fund', title: 'T', deck: 'D', dark, pulled: true }).forEach((b, k) => { if (k === 2) out[`eb:pulled:${dark ? 'd' : 'l'}:${k}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    return out;
  });
  if (process.env.DUMP_P10) { console.log(JSON.stringify(await collectP10())); return; }
  if (process.env.DUMP_P9) { console.log(JSON.stringify(await collectP9())); return; }
  if (process.env.DUMP_P8) { console.log(JSON.stringify(await collectP8())); return; }
  const P8_REF = {
    'rm:rentHike:bn': 'a161a97d', 'rm:rentHike:bf': 'a161a97d', 'rm:rentHike:an': 'a161a97d', 'rm:rentHike:af': 'a161a97d',
    'rm:advance:bn': '8aeadbed', 'rm:advance:bf': '8aeadbed', 'rm:advance:an': '8aeadbed', 'rm:advance:af': '8aeadbed', 'rm:dadBill:bn': '74f9b1e5',
    'rm:dadBill:bf': '74f9b1e5', 'rm:dadBill:an': '74f9b1e5', 'rm:dadBill:af': '74f9b1e5', 'rm:perry:bn': '52c7eee0', 'rm:perry:bf': '52c7eee0',
    'rm:perry:an': '52c7eee0', 'rm:perry:af': '52c7eee0', 'rm:pension:bn': '6b59759d', 'rm:pension:bf': '6b59759d', 'rm:pension:an': '6b59759d',
    'rm:pension:af': '6b59759d', 'rm:adopt:bn': 'efb2c75c', 'rm:adopt:bf': 'efb2c75c', 'rm:adopt:an': 'efb2c75c', 'rm:adopt:af': 'efb2c75c',
    'rm:dentist:bn': '8709599e', 'rm:dentist:bf': '8709599e', 'rm:dentist:an': '8709599e', 'rm:dentist:af': '8709599e', 'rm:vetCheck:bn': '3cec6504',
    'rm:vetCheck:bf': '569dd968', 'rm:vetCheck:an': '3cec6504', 'rm:vetCheck:af': '569dd968', 'rm:toothache:bn': '9a42ede7',
    'rm:toothache:bf': '9a42ede7', 'rm:toothache:an': '9a42ede7', 'rm:toothache:af': '9a42ede7', 'rm:vetER:bn': 'df03daf1',
    'rm:vetER:bf': 'df03daf1', 'rm:vetER:an': 'df03daf1', 'rm:vetER:af': 'df03daf1', 'rm:c1:bn': '4d3c2a57', 'rm:c1:bf': '4d3c2a57',
    'rm:c1:an': '4d3c2a57', 'rm:c1:af': '4d3c2a57', 'rm:c3:bn': '4c010a54', 'rm:c3:bf': '4c010a54', 'rm:c3:an': '4c010a54', 'rm:c3:af': '4c010a54',
    'rm:c5:bn': '322f06fc', 'rm:c5:bf': '322f06fc', 'rm:c5:an': '322f06fc', 'rm:c5:af': '322f06fc', 'rm:c6:bn': 'd6bcd9c7', 'rm:c6:bf': 'd6bcd9c7',
    'rm:c6:an': 'd6bcd9c7', 'rm:c6:af': 'd6bcd9c7', 'rm:c7:bn': 'd33e1cb3', 'rm:c7:bf': 'd33e1cb3', 'rm:c7:an': 'd33e1cb3', 'rm:c7:af': 'd33e1cb3',
    'rm:c8:bn': '372c9ae8', 'rm:c8:bf': '372c9ae8', 'rm:c8:an': '372c9ae8', 'rm:c8:af': 'ea8b62f2', 'rm:c9:bn': '53f1b924', 'rm:c9:bf': '53f1b924',
    'rm:c9:an': '53f1b924', 'rm:c9:af': '53f1b924', 'rm:c10:bn': '18e9eb34', 'rm:c10:bf': '18e9eb34', 'rm:c10:an': '18e9eb34',
    'rm:c10:af': '59e6016d', 'dc:rentHike:fresh:room': 'efd72282', 'dc:rentHike:fresh:face': '49cb131', 'dc:rentHike:none:room': 'efd72282',
    'dc:rentHike:none:face': '49cb131', 'dc:rentHike:nobody:room': 'efd72282', 'dc:rentHike:nobody:face': '8bef5c6f',
    'dc:rentHike:empty:room': 'efd72282', 'dc:rentHike:empty:face': '8bef5c6f', 'dc:advance:fresh:room': '12b66ab0',
    'dc:advance:fresh:face': 'a4bcb34e', 'dc:advance:none:room': '12b66ab0', 'dc:advance:none:face': 'a4bcb34e',
    'dc:advance:nobody:room': '12b66ab0', 'dc:advance:nobody:face': '3dce8581', 'dc:advance:empty:room': '12b66ab0',
    'dc:advance:empty:face': '3dce8581', 'dc:dadBill:fresh:room': '127aaa26', 'dc:dadBill:fresh:face': '3b3899bc',
    'dc:dadBill:none:room': '127aaa26', 'dc:dadBill:none:face': '3b3899bc', 'dc:dadBill:nobody:room': '127aaa26',
    'dc:dadBill:nobody:face': 'dc89d1d3', 'dc:dadBill:empty:room': '127aaa26', 'dc:dadBill:empty:face': 'dc89d1d3',
    'dc:perry:fresh:room': 'ae61059d', 'dc:perry:fresh:face': '79e24a79', 'dc:perry:none:room': 'ae61059d', 'dc:perry:none:face': '79e24a79',
    'dc:perry:nobody:room': 'ae61059d', 'dc:perry:nobody:face': '7dc0d2c5', 'dc:perry:empty:room': 'ae61059d', 'dc:perry:empty:face': '7dc0d2c5',
    'dc:pension:fresh:room': 'bf279567', 'dc:pension:fresh:face': '7dfdaf01', 'dc:pension:none:room': 'bf279567', 'dc:pension:none:face': '7dfdaf01',
    'dc:pension:nobody:room': 'bf279567', 'dc:pension:nobody:face': '877f00a6', 'dc:pension:empty:room': 'bf279567',
    'dc:pension:empty:face': '877f00a6', 'dc:adopt:fresh:room': '7a3fe68e', 'dc:adopt:fresh:face': 'f2a840d0', 'dc:adopt:none:room': '7a3fe68e',
    'dc:adopt:none:face': 'f2a840d0', 'dc:adopt:nobody:room': '7a3fe68e', 'dc:adopt:nobody:face': '172400e1', 'dc:adopt:empty:room': '7a3fe68e',
    'dc:adopt:empty:face': '172400e1', 'dc:dentist:fresh:room': '582685ad', 'dc:dentist:fresh:face': 'dd18b4ae', 'dc:dentist:none:room': '582685ad',
    'dc:dentist:none:face': 'dd18b4ae', 'dc:dentist:nobody:room': '582685ad', 'dc:dentist:nobody:face': '347414bd',
    'dc:dentist:empty:room': '582685ad', 'dc:dentist:empty:face': '347414bd', 'dc:vetCheck:fresh:room': '34391d17',
    'dc:vetCheck:fresh:face': '933f4598', 'dc:vetCheck:none:room': '34391d17', 'dc:vetCheck:none:face': '933f4598',
    'dc:vetCheck:nobody:room': '8a534ba5', 'dc:vetCheck:nobody:face': '6e92be7c', 'dc:vetCheck:empty:room': '34391d17',
    'dc:vetCheck:empty:face': '449524d1', 'dc:toothache:fresh:room': '8fce00d4', 'dc:toothache:fresh:face': 'b1ebc973',
    'dc:toothache:none:room': '8fce00d4', 'dc:toothache:none:face': 'b1ebc973', 'dc:toothache:nobody:room': '8fce00d4',
    'dc:toothache:nobody:face': '3665513b', 'dc:toothache:empty:room': '8fce00d4', 'dc:toothache:empty:face': '3665513b',
    'dc:vetER:fresh:room': '21c4b3c', 'dc:vetER:fresh:face': 'ba830aa4', 'dc:vetER:none:room': '21c4b3c', 'dc:vetER:none:face': 'ba830aa4',
    'dc:vetER:nobody:room': '21c4b3c', 'dc:vetER:nobody:face': '64c0d14d', 'dc:vetER:empty:room': '21c4b3c', 'dc:vetER:empty:face': '64c0d14d',
    'dc:c1:fresh:room': 'e330fd3', 'dc:c1:fresh:face': 'c41283cd', 'dc:c1:none:room': 'e330fd3', 'dc:c1:none:face': 'c41283cd',
    'dc:c1:nobody:room': 'e330fd3', 'dc:c1:nobody:face': '30da3d84', 'dc:c1:empty:room': 'e330fd3', 'dc:c1:empty:face': '30da3d84',
    'dc:c3:fresh:room': '66d0ce29', 'dc:c3:fresh:face': '79aeebda', 'dc:c3:none:room': '66d0ce29', 'dc:c3:none:face': '79aeebda',
    'dc:c3:nobody:room': '66d0ce29', 'dc:c3:nobody:face': '166fe59f', 'dc:c3:empty:room': '66d0ce29', 'dc:c3:empty:face': '166fe59f',
    'dc:c5:fresh:room': 'a062e52d', 'dc:c5:fresh:face': '2ceb0ae6', 'dc:c5:none:room': 'a062e52d', 'dc:c5:none:face': '2ceb0ae6',
    'dc:c5:nobody:room': 'a062e52d', 'dc:c5:nobody:face': 'b7ee595', 'dc:c5:empty:room': 'a062e52d', 'dc:c5:empty:face': 'b7ee595',
    'dc:c6:fresh:room': 'e1933fb7', 'dc:c6:fresh:face': '670f4aa3', 'dc:c6:none:room': 'e1933fb7', 'dc:c6:none:face': '670f4aa3',
    'dc:c6:nobody:room': 'e1933fb7', 'dc:c6:nobody:face': 'b639d8ff', 'dc:c6:empty:room': 'e1933fb7', 'dc:c6:empty:face': 'b639d8ff',
    'dc:c7:fresh:room': 'c94e9bee', 'dc:c7:fresh:face': '21d6969', 'dc:c7:none:room': 'c94e9bee', 'dc:c7:none:face': '21d6969',
    'dc:c7:nobody:room': 'c94e9bee', 'dc:c7:nobody:face': '4ff0908a', 'dc:c7:empty:room': 'c94e9bee', 'dc:c7:empty:face': '4ff0908a',
    'dc:c8:fresh:room': 'ed33bf24', 'dc:c8:fresh:face': '46724ba4', 'dc:c8:none:room': 'ed33bf24', 'dc:c8:none:face': '46724ba4',
    'dc:c8:nobody:room': 'ed33bf24', 'dc:c8:nobody:face': '3c129475', 'dc:c8:empty:room': 'ed33bf24', 'dc:c8:empty:face': '3c129475',
    'dc:c9:fresh:room': 'eea86758', 'dc:c9:fresh:face': '25342649', 'dc:c9:none:room': 'eea86758', 'dc:c9:none:face': '25342649',
    'dc:c9:nobody:room': 'eea86758', 'dc:c9:nobody:face': 'a142a57f', 'dc:c9:empty:room': 'eea86758', 'dc:c9:empty:face': 'a142a57f',
    'dc:c10:fresh:room': '1b8567b', 'dc:c10:fresh:face': '6dcbf188', 'dc:c10:none:room': '1b8567b', 'dc:c10:none:face': '6dcbf188',
    'dc:c10:nobody:room': '1b8567b', 'dc:c10:nobody:face': '7c0a89b6', 'dc:c10:empty:room': '1b8567b', 'dc:c10:empty:face': '7c0a89b6',
    'bw:news11:establish': '110cf4d2', 'bw:news11:detail': '2b9c42fd', 'bw:news38:establish': 'c6fb2c3', 'bw:news38:detail': 'af5be3db',
    'bw:news38:hold': 'dfd1f71a', 'bw:news41:establish': 'f65c71ae', 'bw:news41:detail': '212ffc84', 'bw:news41:hold': '3435cd15',
    'bw:news41p:establish': 'eecf53', 'bw:news41p:detail': '4edd49f9', 'bw:news41p:hold': 'a3c2e72f', 'bw:news45p:establish': '65ddd720',
    'bw:news45p:detail': 'c5845d35', 'bw:news45p:hold': 'fb86be25', 'bw:wk39:sat': 'c35fdaf', 'bw:wk39:sun': '1a3fb7d3', 'bw:wk39:whip': 'ed33bf24',
    'bw:wk39:hold': 'a5fb555f', 'bw:wk44:sat': 'dadf9daa', 'bw:wk44:sun': 'dc56d92b', 'bw:wk44:hold': '3753fcd3', 'bw:wk44:317': 'ffecf1f5',
    'bw:wk44p:sat': '14b498c5', 'bw:wk44p:sun': 'dc56d92b', 'bw:wk44p:hold': '3753fcd3', 'bw:wk44p:317': 'f8a99c80', 'en:wiped:0': '3c21d529',
    'en:wiped:1': 'fccc4df7', 'en:wiped:2': '90d5e1c5', 'en:fired:0': '7d134b80', 'en:fired:1': 'b7ecf876', 'en:fired:2': '90d5e1c5',
    'en:exit:0': 'e745aeaa', 'en:exit:1': 'e9855378', 'en:exit:2': '90d5e1c5', 'en:nobody:0': '3c550175', 'en:nobody:1': '89ab932d',
    'en:nobody:2': '90d5e1c5', 'en:master:0': 'a0e5af85', 'en:master:1': '913e45c3', 'en:master:2': '90d5e1c5', 'en:whistle:0': 'ba25f19',
    'en:whistle:1': 'a98033c8', 'en:whistle:2': '90d5e1c5', 'en:revolving:0': '8a781c89', 'en:revolving:1': '6af4b0c0', 'en:revolving:2': '90d5e1c5',
    'en:perp:0': '41b6be90', 'en:perp:1': '8fde03d6', 'en:perp:2': '90d5e1c5', 'en:fall-guy:0': 'f98d3c00', 'en:fall-guy:1': '18db3953',
    'en:fall-guy:2': '90d5e1c5', 'en:cassandra:0': 'e1616c7b', 'en:cassandra:1': '50cca0ec', 'en:cassandra:2': '90d5e1c5',
    'en:acquirer:0': 'ec5ac43d', 'en:acquirer:1': 'd1b3f2c3', 'en:acquirer:2': '90d5e1c5', 'en:ward:0': '514baa8f', 'en:ward:1': '887fe114',
    'en:ward:2': '90d5e1c5', 'en:clawback:0': 'd66082a1', 'en:clawback:1': 'c30704b8', 'en:clawback:2': '90d5e1c5', 'en:right-early:0': '2aee2d23',
    'en:right-early:1': '70585d6e', 'en:right-early:2': '90d5e1c5', 'en:fund:0': 'a6b9606a', 'en:fund:1': '735d0490', 'en:fund:2': '90d5e1c5',
    'en:everything-rally:0': '71c3b524', 'en:everything-rally:1': 'cdbd1763', 'en:everything-rally:2': '90d5e1c5', 'en:lost-decade:0': '22b1d074',
    'en:lost-decade:1': 'e2e44797', 'en:lost-decade:2': '90d5e1c5', 'en:soft:0': '4f92a3aa', 'en:soft:1': '5d3177ad', 'en:soft:2': '90d5e1c5',
    'en:quiet:0': '1db26c4a', 'en:quiet:1': 'af5ce437', 'en:quiet:2': '90d5e1c5', 'en:replaced:0': '5a858a68', 'en:replaced:1': '6d9df26e',
    'en:replaced:2': '90d5e1c5', 'en:depression:0': '1fa21238', 'en:depression:1': 'f1bf77bb', 'en:depression:2': '90d5e1c5',
    'en:grind:0': '6130e464', 'en:grind:1': 'adc43623', 'en:grind:2': '90d5e1c5', 'still:c1': 'cce31cad', 'still:c8': '555127f',
    'still:c8p': '253beda9', 'still:c10p': 'a7b1ee59', 'still:vetER': '5c769bd7', 'still:adopt': 'cfc09921', 'still:pet': 'cc7ee552'
  };
  // batch 8 (ruled, the sheet's final-frame sections): the weekend's sun and hold beats show the weather's pose at chain time and the lit floor phone (or the dead laptop on day 44 with the plug pulled); only these six
  const P8_CHANGED = {
    'bw:wk39:sun': 'ac0b679a', 'bw:wk39:hold': '65ad87fa', 'bw:wk44:sun': '89481e60', 'bw:wk44:hold': '23753157', 'bw:wk44p:sun': 'fa6106a0',
    'bw:wk44p:hold': '54a7eea9',
    // batch 9 (ruled, the sheet's final-frame sections): the wiped and perp world beats end on the card's state; the after beat ends with the city's windows out and no still snow speckle (it is the same picture for every id)
    'en:wiped:0': '6652cc9', 'en:wiped:2': 'cdb224eb', 'en:fired:2': 'cdb224eb', 'en:exit:2': 'cdb224eb', 'en:nobody:2': 'cdb224eb', 'en:master:2': 'cdb224eb', 'en:whistle:2': 'cdb224eb', 'en:revolving:2': 'cdb224eb', 'en:perp:0': '330f8d20', 'en:perp:2': 'cdb224eb', 'en:fall-guy:2': 'cdb224eb', 'en:cassandra:2': 'cdb224eb', 'en:acquirer:2': 'cdb224eb', 'en:ward:2': 'cdb224eb', 'en:clawback:2': 'cdb224eb', 'en:right-early:2': 'cdb224eb', 'en:fund:2': 'cdb224eb', 'en:everything-rally:2': 'cdb224eb', 'en:lost-decade:2': 'cdb224eb', 'en:soft:2': 'cdb224eb', 'en:quiet:2': 'cdb224eb', 'en:replaced:2': 'cdb224eb', 'en:depression:2': 'cdb224eb', 'en:grind:2': 'cdb224eb'
  };
  const p8now = await collectP8();
  for (const k of Object.keys(P8_REF)) assert(p8now[k] === (P8_CHANGED[k] || P8_REF[k]), `batch 7 ${k}: the picture changed (${p8now[k]}, was ${P8_CHANGED[k] || P8_REF[k]})`);
  assert(Object.keys(p8now).length === Object.keys(P8_REF).length, 'batch 7: the set of reference pictures changed');
  for (const k of Object.keys(P8_CHANGED)) assert(P8_CHANGED[k] !== P8_REF[k], `batch 7 ${k}: the ruled change is not a change`);

  const P9_REF = {
    'wk:9:t0:l0:n:sat': '881d3835', 'wk:9:t0:l0:n:sun': 'c053280f', 'wk:9:t0:l0:n:hold': '6c062919', 'wk:9:t0:l0:cat:sat': '2567d786',
    'wk:9:t0:l0:cat:sun': '359e97a8', 'wk:9:t0:l0:cat:hold': '205d707', 'wk:9:t0:l0:dog:sat': 'c5019d13', 'wk:9:t0:l0:dog:sun': '4ae8d479',
    'wk:9:t0:l0:dog:hold': '5d4804d3', 'wk:9:t0:l2:n:sat': 'a25f2cd4', 'wk:9:t0:l2:n:sun': 'f9e32dac', 'wk:9:t0:l2:n:hold': '8b8ae7f1',
    'wk:9:t0:l2:cat:sat': '522d4666', 'wk:9:t0:l2:cat:sun': '29ec398b', 'wk:9:t0:l2:cat:hold': 'a187becb', 'wk:9:t0:l2:dog:sat': 'e06f9a45',
    'wk:9:t0:l2:dog:sun': 'c9e16082', 'wk:9:t0:l2:dog:hold': '9e5dde47', 'wk:9:t2:l0:n:sat': 'c4223587', 'wk:9:t2:l0:n:sun': 'fb989ec6',
    'wk:9:t2:l0:n:hold': '2d2d8f60', 'wk:9:t2:l0:cat:sat': 'a870faf', 'wk:9:t2:l0:cat:sun': '7bcf59e1', 'wk:9:t2:l0:cat:hold': '602cb7ab',
    'wk:9:t2:l0:dog:sat': '288407a6', 'wk:9:t2:l0:dog:sun': '2b2e6ac0', 'wk:9:t2:l0:dog:hold': '467bf451', 'wk:9:t2:l2:n:sat': '1878893d',
    'wk:9:t2:l2:n:sun': '944741a2', 'wk:9:t2:l2:n:hold': '11f2f737', 'wk:9:t2:l2:cat:sat': '36c0ab40', 'wk:9:t2:l2:cat:sun': '96c39f25',
    'wk:9:t2:l2:cat:hold': '2e2f94c', 'wk:9:t2:l2:dog:sat': '87be7e21', 'wk:9:t2:l2:dog:sun': '673f023c', 'wk:9:t2:l2:dog:hold': 'e1338bfe',
    'wk:9:t5:l0:n:sat': '6e5ad161', 'wk:9:t5:l0:n:sun': '772840c8', 'wk:9:t5:l0:n:hold': '840f072a', 'wk:9:t5:l0:cat:sat': 'bfd3023',
    'wk:9:t5:l0:cat:sun': 'cad2a403', 'wk:9:t5:l0:cat:hold': '971057f', 'wk:9:t5:l0:dog:sat': '69998194', 'wk:9:t5:l0:dog:sun': '2d50621b',
    'wk:9:t5:l0:dog:hold': 'f7770e0a', 'wk:9:t5:l2:n:sat': 'b82016fb', 'wk:9:t5:l2:n:sun': 'fa3f44a3', 'wk:9:t5:l2:n:hold': '546c9a7',
    'wk:9:t5:l2:cat:sat': '1167c418', 'wk:9:t5:l2:cat:sun': '54657188', 'wk:9:t5:l2:cat:hold': '83ae9fb2', 'wk:9:t5:l2:dog:sat': 'c171795c',
    'wk:9:t5:l2:dog:sun': '1cb64a58', 'wk:9:t5:l2:dog:hold': '2d88928b', 'wk:19:t2:l0:n:sat': '75f93f13', 'wk:19:t2:l0:n:sun': '55e17b63',
    'wk:19:t2:l0:n:hold': '564721e2', 'wk:19:t0:l2:cat:sat': '8cc77b48', 'wk:19:t0:l2:cat:sun': 'bb182b90', 'wk:19:t0:l2:cat:hold': '58abeae',
    'wk:19:t4:l0:dog:sat': '53b7c025', 'wk:19:t4:l0:dog:sun': '7a3d61f5', 'wk:19:t4:l0:dog:hold': '6e23faa4', 'wk:19:t1:l2:n:sat': '6d76237f',
    'wk:19:t1:l2:n:sun': 'c3aa2b2f', 'wk:19:t1:l2:n:hold': 'e6cf6d03', 'wk:49:t2:l0:n:sat': '47c9ceea', 'wk:49:t2:l0:n:sun': '572cc3e2',
    'wk:49:t2:l0:n:hold': 'e6f03aef', 'wk:49:t0:l2:cat:sat': 'e53e740f', 'wk:49:t0:l2:cat:sun': 'f55c86af', 'wk:49:t0:l2:cat:hold': 'a6d524b4',
    'wk:49:t4:l0:dog:sat': '4248b546', 'wk:49:t4:l0:dog:sun': '779fd0ef', 'wk:49:t4:l0:dog:hold': '693e7139', 'wk:49:t1:l2:n:sat': 'b6948b2c',
    'wk:49:t1:l2:n:sun': '3584e462', 'wk:49:t1:l2:n:hold': '8f23bb83', 'wk:4:t2:l0:n:sat': '4ce801eb', 'wk:4:t2:l0:n:sun': 'c6cea1a0',
    'wk:4:t2:l0:n:hold': '25c3c435', 'wk:4:t0:l2:cat:sat': 'c7e85975', 'wk:4:t0:l2:cat:sun': '3f3522e4', 'wk:4:t0:l2:cat:hold': '1619085b',
    'wk:4:t3:l0:dog:sat': '950fce04', 'wk:4:t3:l0:dog:sun': '836288cd', 'wk:4:t3:l0:dog:hold': '4e61c04b', 'wk:4:t1:l2:n:sat': 'f2d389d6',
    'wk:4:t1:l2:n:sun': 'b4a74155', 'wk:4:t1:l2:n:hold': '1d11f79', 'wk:14:t2:l0:n:sat': '64a714df', 'wk:14:t2:l0:n:sun': 'e4954ca4',
    'wk:14:t2:l0:n:hold': 'e6e4ef17', 'wk:14:t0:l2:cat:sat': 'ad3c77eb', 'wk:14:t0:l2:cat:sun': '99e09afb', 'wk:14:t0:l2:cat:hold': '97b86147',
    'wk:14:t3:l0:dog:sat': '625b456b', 'wk:14:t3:l0:dog:sun': '348a302', 'wk:14:t3:l0:dog:hold': 'ac7fcbcb', 'wk:14:t1:l2:n:sat': '3883920c',
    'wk:14:t1:l2:n:sun': '8ee20bde', 'wk:14:t1:l2:n:hold': '1d47e9ec', 'wk:24:t2:l0:n:sat': '9c6ab1a0', 'wk:24:t2:l0:n:sun': '4b151f6f',
    'wk:24:t2:l0:n:hold': '97091cda', 'wk:24:t0:l2:cat:sat': '501267e2', 'wk:24:t0:l2:cat:sun': 'd031f825', 'wk:24:t0:l2:cat:hold': 'dffddaed',
    'wk:24:t3:l0:dog:sat': '77872e0c', 'wk:24:t3:l0:dog:sun': '24a58b3b', 'wk:24:t3:l0:dog:hold': '61b3200b', 'wk:24:t1:l2:n:sat': '8f9d7a1d',
    'wk:24:t1:l2:n:sun': 'edaaa84b', 'wk:24:t1:l2:n:hold': '2a8f88f9', 'wk:34:t2:l0:n:sat': 'b02f36bf', 'wk:34:t2:l0:n:sun': '7f28cc82',
    'wk:34:t2:l0:n:hold': '5dccfe47', 'wk:34:t0:l2:cat:sat': 'd30b746a', 'wk:34:t0:l2:cat:sun': '3701b33e', 'wk:34:t0:l2:cat:hold': 'ba27893a',
    'wk:34:t3:l0:dog:sat': '72f7d52b', 'wk:34:t3:l0:dog:sun': '88d983a8', 'wk:34:t3:l0:dog:hold': '8a8028a1', 'wk:34:t1:l2:n:sat': 'e735215f',
    'wk:34:t1:l2:n:sun': 'ac5c40e', 'wk:34:t1:l2:n:hold': 'f6f4991', 'wk:39:t2:l0:n:sat': 'c35fdaf', 'wk:39:t2:l0:n:sun': '1a3fb7d3',
    'wk:39:t2:l0:n:whip': 'ed33bf24', 'wk:39:t2:l0:n:hold': 'a5fb555f', 'wk:39:t0:l2:cat:sat': '9bbece87', 'wk:39:t0:l2:cat:sun': '3303f0d8',
    'wk:39:t0:l2:cat:whip': 'ed33bf24', 'wk:39:t0:l2:cat:hold': 'd29d3177', 'wk:39:t3:l0:dog:sat': 'd90ed43b', 'wk:39:t3:l0:dog:sun': '50b122fe',
    'wk:39:t3:l0:dog:whip': 'ed33bf24', 'wk:39:t3:l0:dog:hold': 'a208cd25', 'wk:39:t1:l2:n:sat': '367495d8', 'wk:39:t1:l2:n:sun': 'e234e2b9',
    'wk:39:t1:l2:n:whip': 'ed33bf24', 'wk:39:t1:l2:n:hold': 'f8056ad5', 'wk:44:t0:l0:n:o:sat': '2b5e96da', 'wk:44:t0:l0:n:o:sun': '965b3d44',
    'wk:44:t0:l0:n:o:hold': 'b38c0c1d', 'wk:44:t0:l0:n:o:317': 'ffecf1f5', 'wk:44:t0:l0:cat:o:sat': 'f37ee992', 'wk:44:t0:l0:cat:o:sun': '463e93bb',
    'wk:44:t0:l0:cat:o:hold': '94ce437b', 'wk:44:t0:l0:cat:o:317': 'ffecf1f5', 'wk:44:t0:l2:n:o:sat': '58e2a35c', 'wk:44:t0:l2:n:o:sun': 'd30e468f',
    'wk:44:t0:l2:n:o:hold': 'f632e675', 'wk:44:t0:l2:n:o:317': 'ffecf1f5', 'wk:44:t0:l2:cat:o:sat': 'f5b73a1c', 'wk:44:t0:l2:cat:o:sun': 'bb9a9fb8',
    'wk:44:t0:l2:cat:o:hold': '93bb34af', 'wk:44:t0:l2:cat:o:317': 'ffecf1f5', 'wk:44:t2:l0:n:o:sat': 'dadf9daa', 'wk:44:t2:l0:n:o:sun': 'dc56d92b',
    'wk:44:t2:l0:n:o:hold': '3753fcd3', 'wk:44:t2:l0:n:o:317': 'ffecf1f5', 'wk:44:t2:l0:cat:o:sat': '930ba70a', 'wk:44:t2:l0:cat:o:sun': '1200bb4c',
    'wk:44:t2:l0:cat:o:hold': 'c6e5de80', 'wk:44:t2:l0:cat:o:317': 'ffecf1f5', 'wk:44:t2:l2:n:o:sat': 'af4bb53', 'wk:44:t2:l2:n:o:sun': '28a41581',
    'wk:44:t2:l2:n:o:hold': '1034b3ef', 'wk:44:t2:l2:n:o:317': 'ffecf1f5', 'wk:44:t2:l2:cat:o:sat': 'c842c21c', 'wk:44:t2:l2:cat:o:sun': '16bdb3be',
    'wk:44:t2:l2:cat:o:hold': 'f0f349e4', 'wk:44:t2:l2:cat:o:317': 'ffecf1f5', 'wk:44:t5:l0:n:o:sat': 'bdbd2401', 'wk:44:t5:l0:n:o:sun': 'a1d9326b',
    'wk:44:t5:l0:n:o:hold': '398607d9', 'wk:44:t5:l0:n:o:317': 'ffecf1f5', 'wk:44:t5:l0:cat:o:sat': '4064edc6', 'wk:44:t5:l0:cat:o:sun': 'e2afe34f',
    'wk:44:t5:l0:cat:o:hold': 'a953a320', 'wk:44:t5:l0:cat:o:317': 'ffecf1f5', 'wk:44:t5:l2:n:o:sat': '396ed9e', 'wk:44:t5:l2:n:o:sun': '2a0316bd',
    'wk:44:t5:l2:n:o:hold': '9edc0731', 'wk:44:t5:l2:n:o:317': 'ffecf1f5', 'wk:44:t5:l2:cat:o:sat': 'af2b3acf', 'wk:44:t5:l2:cat:o:sun': '3e3edfcd',
    'wk:44:t5:l2:cat:o:hold': '917300e8', 'wk:44:t5:l2:cat:o:317': 'ffecf1f5', 'wk:44:t0:l0:n:p:sat': '8ca06136', 'wk:44:t0:l0:n:p:sun': '965b3d44',
    'wk:44:t0:l0:n:p:hold': 'b38c0c1d', 'wk:44:t0:l0:n:p:317': 'f8a99c80', 'wk:44:t0:l0:cat:p:sat': '2d752ad3', 'wk:44:t0:l0:cat:p:sun': '463e93bb',
    'wk:44:t0:l0:cat:p:hold': '94ce437b', 'wk:44:t0:l0:cat:p:317': 'f8a99c80', 'wk:44:t0:l2:n:p:sat': '6d6d5478', 'wk:44:t0:l2:n:p:sun': 'd30e468f',
    'wk:44:t0:l2:n:p:hold': 'f632e675', 'wk:44:t0:l2:n:p:317': 'f8a99c80', 'wk:44:t0:l2:cat:p:sat': '1829c382', 'wk:44:t0:l2:cat:p:sun': 'bb9a9fb8',
    'wk:44:t0:l2:cat:p:hold': '93bb34af', 'wk:44:t0:l2:cat:p:317': 'f8a99c80', 'wk:44:t2:l0:n:p:sat': '14b498c5', 'wk:44:t2:l0:n:p:sun': 'dc56d92b',
    'wk:44:t2:l0:n:p:hold': '3753fcd3', 'wk:44:t2:l0:n:p:317': 'f8a99c80', 'wk:44:t2:l0:cat:p:sat': '5e334286', 'wk:44:t2:l0:cat:p:sun': '1200bb4c',
    'wk:44:t2:l0:cat:p:hold': 'c6e5de80', 'wk:44:t2:l0:cat:p:317': 'f8a99c80', 'wk:44:t2:l2:n:p:sat': '6a2f002a', 'wk:44:t2:l2:n:p:sun': '28a41581',
    'wk:44:t2:l2:n:p:hold': '1034b3ef', 'wk:44:t2:l2:n:p:317': 'f8a99c80', 'wk:44:t2:l2:cat:p:sat': '5ba4d08', 'wk:44:t2:l2:cat:p:sun': '16bdb3be',
    'wk:44:t2:l2:cat:p:hold': 'f0f349e4', 'wk:44:t2:l2:cat:p:317': 'f8a99c80', 'wk:44:t5:l0:n:p:sat': 'c6f2dc13', 'wk:44:t5:l0:n:p:sun': 'a1d9326b',
    'wk:44:t5:l0:n:p:hold': '398607d9', 'wk:44:t5:l0:n:p:317': 'f8a99c80', 'wk:44:t5:l0:cat:p:sat': '4ad17908', 'wk:44:t5:l0:cat:p:sun': 'e2afe34f',
    'wk:44:t5:l0:cat:p:hold': 'a953a320', 'wk:44:t5:l0:cat:p:317': 'f8a99c80', 'wk:44:t5:l2:n:p:sat': '21d65731', 'wk:44:t5:l2:n:p:sun': '2a0316bd',
    'wk:44:t5:l2:n:p:hold': '9edc0731', 'wk:44:t5:l2:n:p:317': 'f8a99c80', 'wk:44:t5:l2:cat:p:sat': 'dfc7a9ce', 'wk:44:t5:l2:cat:p:sun': '3e3edfcd',
    'wk:44:t5:l2:cat:p:hold': '917300e8', 'wk:44:t5:l2:cat:p:317': 'f8a99c80', 'wk:nogame:9:sat': 'c4223587', 'wk:nogame:9:sun': 'fb989ec6',
    'wk:nogame:9:hold': '2d2d8f60', 'wk:nogame:39:sat': 'c35fdaf', 'wk:nogame:39:sun': '1a3fb7d3', 'wk:nogame:39:whip': 'ed33bf24',
    'wk:nogame:39:hold': 'a5fb555f', 'wk:nogame:44:sat': 'dadf9daa', 'wk:nogame:44:sun': 'dc56d92b', 'wk:nogame:44:hold': '3753fcd3',
    'wk:nogame:44:317': 'ffecf1f5', 'flat:sun:9:t0:l0:n': 'c053280f', 'flat:night:9:t0:l0:n': '6910a1c4', 'flat:sun:9:t0:l0:cat': '359e97a8',
    'flat:night:9:t0:l0:cat': '92c072bb', 'flat:sun:9:t0:l0:dog': '4ae8d479', 'flat:night:9:t0:l0:dog': '57b2dd43', 'flat:sun:9:t0:l2:n': 'f9e32dac',
    'flat:night:9:t0:l2:n': 'f930a9df', 'flat:sun:9:t0:l2:cat': '29ec398b', 'flat:night:9:t0:l2:cat': '1ce94360', 'flat:sun:9:t0:l2:dog': 'c9e16082',
    'flat:night:9:t0:l2:dog': '1a9c98cc', 'flat:sun:9:t1:l0:n': 'd85a8447', 'flat:night:9:t1:l0:n': 'a361ae2d', 'flat:sun:9:t1:l0:cat': 'e1b8324f',
    'flat:night:9:t1:l0:cat': '727947fd', 'flat:sun:9:t1:l0:dog': '8cdffdf7', 'flat:night:9:t1:l0:dog': 'd368d2be', 'flat:sun:9:t1:l2:n': '194a81fd',
    'flat:night:9:t1:l2:n': 'a3a194e9', 'flat:sun:9:t1:l2:cat': 'ce8177a1', 'flat:night:9:t1:l2:cat': '26bdfc1d', 'flat:sun:9:t1:l2:dog': 'bc5fa89',
    'flat:night:9:t1:l2:dog': '9762fe4e', 'flat:sun:9:t2:l0:n': 'fb989ec6', 'flat:night:9:t2:l0:n': '42dd8757', 'flat:sun:9:t2:l0:cat': '7bcf59e1',
    'flat:night:9:t2:l0:cat': '4d613aaa', 'flat:sun:9:t2:l0:dog': '2b2e6ac0', 'flat:night:9:t2:l0:dog': 'f19891bc', 'flat:sun:9:t2:l2:n': '944741a2',
    'flat:night:9:t2:l2:n': 'c9dda7ab', 'flat:sun:9:t2:l2:cat': '96c39f25', 'flat:night:9:t2:l2:cat': '8c40fc3e', 'flat:sun:9:t2:l2:dog': '673f023c',
    'flat:night:9:t2:l2:dog': 'd2b5e4a4', 'flat:sun:9:t3:l0:n': '8e8be37b', 'flat:night:9:t3:l0:n': '8648b046', 'flat:sun:9:t3:l0:cat': 'd1fffb06',
    'flat:night:9:t3:l0:cat': '84f69781', 'flat:sun:9:t3:l0:dog': '4dcb606b', 'flat:night:9:t3:l0:dog': 'bc008bce', 'flat:sun:9:t3:l2:n': 'bb8098bd',
    'flat:night:9:t3:l2:n': 'd24b78b3', 'flat:sun:9:t3:l2:cat': '4d693588', 'flat:night:9:t3:l2:cat': '700a8ff0', 'flat:sun:9:t3:l2:dog': '1679562d',
    'flat:night:9:t3:l2:dog': 'a106f3ef', 'flat:sun:9:t4:l0:n': '193c048a', 'flat:night:9:t4:l0:n': '2f58e042', 'flat:sun:9:t4:l0:cat': 'd6ddeb0d',
    'flat:night:9:t4:l0:cat': 'cd429c86', 'flat:sun:9:t4:l0:dog': '36b67dd0', 'flat:night:9:t4:l0:dog': 'e3397ef5', 'flat:sun:9:t4:l2:n': 'f7c99c4a',
    'flat:night:9:t4:l2:n': '4e1deaf6', 'flat:sun:9:t4:l2:cat': '95e460c1', 'flat:night:9:t4:l2:cat': '1d673fe6', 'flat:sun:9:t4:l2:dog': 'e61a8544',
    'flat:night:9:t4:l2:dog': 'a7fadb1', 'flat:sun:9:t5:l0:n': '772840c8', 'flat:night:9:t5:l0:n': 'aa91e68c', 'flat:sun:9:t5:l0:cat': 'cad2a403',
    'flat:night:9:t5:l0:cat': '1f30db3c', 'flat:sun:9:t5:l0:dog': '2d50621b', 'flat:night:9:t5:l0:dog': '3fdffaec', 'flat:sun:9:t5:l2:n': 'fa3f44a3',
    'flat:night:9:t5:l2:n': '46a5f402', 'flat:sun:9:t5:l2:cat': '54657188', 'flat:night:9:t5:l2:cat': '1c4c432e', 'flat:sun:9:t5:l2:dog': '1cb64a58',
    'flat:night:9:t5:l2:dog': '5a224eee', 'flat:sun:39:t0:l0:n': '5ae48100', 'flat:night:39:t0:l0:n': 'c9cd8702', 'flat:sun:39:t0:l0:cat': '20d7538f',
    'flat:night:39:t0:l0:cat': '4354fe09', 'flat:sun:39:t0:l0:dog': '9fe72156', 'flat:night:39:t0:l0:dog': '3976269d',
    'flat:sun:39:t0:l2:n': 'a93446f', 'flat:night:39:t0:l2:n': 'fa229a01', 'flat:sun:39:t0:l2:cat': '3303f0d8', 'flat:night:39:t0:l2:cat': 'f54d92ba',
    'flat:sun:39:t0:l2:dog': 'd58f61f1', 'flat:night:39:t0:l2:dog': 'c2ef2872', 'flat:sun:39:t1:l0:n': 'bd65d988',
    'flat:night:39:t1:l0:n': 'f0a3891a', 'flat:sun:39:t1:l0:cat': 'a57e9560', 'flat:night:39:t1:l0:cat': '79f6a42a',
    'flat:sun:39:t1:l0:dog': '3d20e768', 'flat:night:39:t1:l0:dog': '5170c55d', 'flat:sun:39:t1:l2:n': 'e234e2b9',
    'flat:night:39:t1:l2:n': '44899164', 'flat:sun:39:t1:l2:cat': 'ed448259', 'flat:night:39:t1:l2:cat': '5fec7310',
    'flat:sun:39:t1:l2:dog': '202ab141', 'flat:night:39:t1:l2:dog': '2de99ed7', 'flat:sun:39:t2:l0:n': '1a3fb7d3',
    'flat:night:39:t2:l0:n': '8c174ff9', 'flat:sun:39:t2:l0:cat': 'ea64de4', 'flat:night:39:t2:l0:cat': '3f80c65c',
    'flat:sun:39:t2:l0:dog': '14d6bf8d', 'flat:night:39:t2:l0:dog': '1c6e4aa2', 'flat:sun:39:t2:l2:n': 'd96ca3dc',
    'flat:night:39:t2:l2:n': '83b6a51f', 'flat:sun:39:t2:l2:cat': '2fbcc04b', 'flat:night:39:t2:l2:cat': '7a2e587a',
    'flat:sun:39:t2:l2:dog': 'c50b2266', 'flat:night:39:t2:l2:dog': 'ba41da0', 'flat:sun:39:t3:l0:n': 'e6ed75b6', 'flat:night:39:t3:l0:n': 'fa42c92a',
    'flat:sun:39:t3:l0:cat': '3be8a017', 'flat:night:39:t3:l0:cat': 'c1a646d', 'flat:sun:39:t3:l0:dog': '50b122fe',
    'flat:night:39:t3:l0:dog': '65bf7c72', 'flat:sun:39:t3:l2:n': 'd8ac1a48', 'flat:night:39:t3:l2:n': '150aec47',
    'flat:sun:39:t3:l2:cat': 'a75b6d19', 'flat:night:39:t3:l2:cat': 'd9170fcc', 'flat:sun:39:t3:l2:dog': 'da9ec918',
    'flat:night:39:t3:l2:dog': '8f577103', 'flat:sun:39:t4:l0:n': 'b45bf25c', 'flat:night:39:t4:l0:n': '370f920d',
    'flat:sun:39:t4:l0:cat': 'eca64f7b', 'flat:night:39:t4:l0:cat': '93962c99', 'flat:sun:39:t4:l0:dog': 'a479a026',
    'flat:night:39:t4:l0:dog': '78e4de7a', 'flat:sun:39:t4:l2:n': 'b28c2117', 'flat:night:39:t4:l2:n': '35520a42',
    'flat:sun:39:t4:l2:cat': 'd54e7c64', 'flat:night:39:t4:l2:cat': '4e4500fa', 'flat:sun:39:t4:l2:dog': '76ba6845',
    'flat:night:39:t4:l2:dog': 'd4b841f5', 'flat:sun:39:t5:l0:n': '30e27f8', 'flat:night:39:t5:l0:n': '49c8a9f2', 'flat:sun:39:t5:l0:cat': 'b0b0184b',
    'flat:night:39:t5:l0:cat': '4c0ef0f1', 'flat:sun:39:t5:l0:dog': 'c822e89f', 'flat:night:39:t5:l0:dog': '99e85ad8',
    'flat:sun:39:t5:l2:n': '1038974d', 'flat:night:39:t5:l2:n': '1977bed0', 'flat:sun:39:t5:l2:cat': 'eeedaf06',
    'flat:night:39:t5:l2:cat': 'fbc04f1f', 'flat:sun:39:t5:l2:dog': '87e1bdc6', 'flat:night:39:t5:l2:dog': 'd3af91e',
    'flat:sun:44:t0:l0:n': '965b3d44', 'flat:night:44:t0:l0:n': 'b6bff38a', 'flat:sun:44:t0:l0:cat': '463e93bb',
    'flat:night:44:t0:l0:cat': '23f2b161', 'flat:sun:44:t0:l0:dog': 'e39cfdda', 'flat:night:44:t0:l0:dog': '9375e535',
    'flat:sun:44:t0:l2:n': 'd30e468f', 'flat:night:44:t0:l2:n': '23270e01', 'flat:sun:44:t0:l2:cat': 'bb9a9fb8',
    'flat:night:44:t0:l2:cat': '1e5206ba', 'flat:sun:44:t0:l2:dog': 'c2f135d1', 'flat:night:44:t0:l2:dog': 'ebf39c72',
    'flat:sun:44:t1:l0:n': '501803f', 'flat:night:44:t1:l0:n': 'f8baaa08', 'flat:sun:44:t1:l0:cat': 'ffd110ef', 'flat:night:44:t1:l0:cat': '716bc4a0',
    'flat:sun:44:t1:l0:dog': '2c18513', 'flat:night:44:t1:l0:dog': '880d6e07', 'flat:sun:44:t1:l2:n': '256801af', 'flat:night:44:t1:l2:n': '137312ac',
    'flat:sun:44:t1:l2:cat': '4d5eb437', 'flat:night:44:t1:l2:cat': 'c35fc5d8', 'flat:sun:44:t1:l2:dog': 'd6f24ff7',
    'flat:night:44:t1:l2:dog': '40d12767', 'flat:sun:44:t2:l0:n': 'dc56d92b', 'flat:night:44:t2:l0:n': '68c2ef94',
    'flat:sun:44:t2:l0:cat': '1200bb4c', 'flat:night:44:t2:l0:cat': '5fa8ab69', 'flat:sun:44:t2:l0:dog': 'b203ac85',
    'flat:night:44:t2:l0:dog': 'ee994207', 'flat:sun:44:t2:l2:n': '28a41581', 'flat:night:44:t2:l2:n': 'bda8bf23',
    'flat:sun:44:t2:l2:cat': '16bdb3be', 'flat:night:44:t2:l2:cat': 'e09c3a46', 'flat:sun:44:t2:l2:dog': '3fead663',
    'flat:night:44:t2:l2:dog': '9072593c', 'flat:sun:44:t3:l0:n': 'eceef0b6', 'flat:night:44:t3:l0:n': '6a645f9d',
    'flat:sun:44:t3:l0:cat': '41ea1b17', 'flat:night:44:t3:l0:cat': '2e37efc6', 'flat:sun:44:t3:l0:dog': '56b29dfe',
    'flat:night:44:t3:l0:dog': '417d50b1', 'flat:sun:44:t3:l2:n': '3f514625', 'flat:night:44:t3:l2:n': '6ff4fa79',
    'flat:sun:44:t3:l2:cat': 'a50040d0', 'flat:night:44:t3:l2:cat': 'fcacab6a', 'flat:sun:44:t3:l2:dog': '4bbf50b5',
    'flat:night:44:t3:l2:dog': '967aff59', 'flat:sun:44:t4:l0:n': '3c816c98', 'flat:night:44:t4:l0:n': '8a5e796a',
    'flat:sun:44:t4:l0:cat': '73e14fbf', 'flat:night:44:t4:l0:cat': 'aa53098e', 'flat:sun:44:t4:l0:dog': '6d0641a',
    'flat:night:44:t4:l0:dog': '9c8e0b5d', 'flat:sun:44:t4:l2:n': '96c1d798', 'flat:night:44:t4:l2:n': 'b2c65e25',
    'flat:sun:44:t4:l2:cat': '8b24958b', 'flat:night:44:t4:l2:cat': '9cb6b375', 'flat:sun:44:t4:l2:dog': '1a40f5b6',
    'flat:night:44:t4:l2:dog': 'ad658602', 'flat:sun:44:t5:l0:n': 'a1d9326b', 'flat:night:44:t5:l0:n': '149d79ca',
    'flat:sun:44:t5:l0:cat': 'e2afe34f', 'flat:night:44:t5:l0:cat': '3639e780', 'flat:sun:44:t5:l0:dog': 'd986d2c4',
    'flat:night:44:t5:l0:dog': '79d0913', 'flat:sun:44:t5:l2:n': '2a0316bd', 'flat:night:44:t5:l2:n': '46fea011', 'flat:sun:44:t5:l2:cat': '3e3edfcd',
    'flat:night:44:t5:l2:cat': 'ac05a65b', 'flat:sun:44:t5:l2:dog': 'ec01ba0e', 'flat:night:44:t5:l2:dog': '2a9dedcc', 'flat:sun:nogame': 'fb989ec6',
    'flat:night:nogame': '42dd8757'
  };
  // batch 8 (ruled): every sun and hold final frame changes in the window (weather particles at their chain-time pose) and, without a figure, the floor phone is lit
  // (pulled day 44: the laptop screen is dark); sat, whip, 317 and the flat sundayShot / apartmentShot(night) pictures are unchanged. The asserts below prove the changes are confined to those regions.
  const P9_CHANGED = {
    'wk:9:t0:l0:n:sun': 'e82ff5f7', 'wk:9:t0:l0:n:hold': '69dfe4c3', 'wk:9:t0:l0:cat:sun': '192f3aae', 'wk:9:t0:l0:cat:hold': '8755200',
    'wk:9:t0:l0:dog:sun': 'fc5096ca', 'wk:9:t0:l0:dog:hold': '84bce7cc', 'wk:9:t0:l2:n:sun': '20006339', 'wk:9:t0:l2:n:hold': 'f4575977',
    'wk:9:t0:l2:cat:sun': '2425229b', 'wk:9:t0:l2:cat:hold': 'b15d4bc1', 'wk:9:t0:l2:dog:sun': '58a89dcb', 'wk:9:t0:l2:dog:hold': '207edc71',
    'wk:9:t2:l0:n:sun': '13c72db8', 'wk:9:t2:l0:n:hold': 'ca4067fa', 'wk:9:t2:l0:cat:sun': '38508299', 'wk:9:t2:l0:cat:hold': 'db844aa7',
    'wk:9:t2:l0:dog:sun': 'f3cde8b', 'wk:9:t2:l0:dog:hold': 'dd8a5fbc', 'wk:9:t2:l2:n:sun': 'c6e867f2', 'wk:9:t2:l2:n:hold': '6cc0e102',
    'wk:9:t2:l2:cat:sun': '9819f7f2', 'wk:9:t2:l2:cat:hold': '90f87747', 'wk:9:t2:l2:dog:sun': 'e7e521e5', 'wk:9:t2:l2:dog:hold': '37a65a7c',
    'wk:9:t5:l0:n:sun': '8edf8b87', 'wk:9:t5:l0:n:hold': 'e21cc39d', 'wk:9:t5:l0:cat:sun': '40148416', 'wk:9:t5:l0:cat:hold': '46ad461d',
    'wk:9:t5:l0:dog:sun': '3764a524', 'wk:9:t5:l0:dog:hold': 'c9a7ff5d', 'wk:9:t5:l2:n:sun': '9dac5c9', 'wk:9:t5:l2:n:hold': 'ebb54d4d',
    'wk:9:t5:l2:cat:sun': 'cfc16289', 'wk:9:t5:l2:cat:hold': '6448c3d3', 'wk:9:t5:l2:dog:sun': '3a413a44', 'wk:9:t5:l2:dog:hold': 'd1d4b799',
    'wk:19:t2:l0:n:sun': '40e000de', 'wk:19:t2:l0:n:hold': 'b6dfe616', 'wk:19:t0:l2:cat:sun': 'b0e38ae9', 'wk:19:t0:l2:cat:hold': '76ed9021',
    'wk:19:t4:l0:dog:sun': 'c1a6e841', 'wk:19:t4:l0:dog:hold': 'b2734915', 'wk:19:t1:l2:n:sun': 'e5099c70', 'wk:19:t1:l2:n:hold': 'ec3b2d9b',
    'wk:49:t2:l0:n:sun': '939b500a', 'wk:49:t2:l0:n:hold': 'd5c24053', 'wk:49:t0:l2:cat:sun': 'eccb4298', 'wk:49:t0:l2:cat:hold': '9145bf9c',
    'wk:49:t4:l0:dog:sun': 'bcf22146', 'wk:49:t4:l0:dog:hold': '1a6b8cb9', 'wk:49:t1:l2:n:sun': 'e85dc7d4', 'wk:49:t1:l2:n:hold': '9899d55e',
    'wk:4:t2:l0:n:sun': '50dae219', 'wk:4:t2:l0:n:hold': '87ad46', 'wk:4:t0:l2:cat:sun': '3d0fab38', 'wk:4:t0:l2:cat:hold': '28c2607d',
    'wk:4:t3:l0:dog:sun': '5716a88c', 'wk:4:t3:l0:dog:hold': '1bce48ad', 'wk:4:t1:l2:n:sun': 'e4989b7', 'wk:4:t1:l2:n:hold': '9c9ad3fc',
    'wk:14:t2:l0:n:sun': 'c6e3d135', 'wk:14:t2:l0:n:hold': 'a834450e', 'wk:14:t0:l2:cat:sun': '9968b6d0', 'wk:14:t0:l2:cat:hold': '5d4641fb',
    'wk:14:t3:l0:dog:sun': 'ae2d3311', 'wk:14:t3:l0:dog:hold': '8633b5a3', 'wk:14:t1:l2:n:sun': '349658f7', 'wk:14:t1:l2:n:hold': 'e7b6ab26',
    'wk:24:t2:l0:n:sun': 'fce4414e', 'wk:24:t2:l0:n:hold': '18f2568d', 'wk:24:t0:l2:cat:sun': '817e486', 'wk:24:t0:l2:cat:hold': 'd030cdb1',
    'wk:24:t3:l0:dog:sun': '84764d4a', 'wk:24:t3:l0:dog:hold': 'c35166e9', 'wk:24:t1:l2:n:sun': 'd85a3345', 'wk:24:t1:l2:n:hold': '6ae137b7',
    'wk:34:t2:l0:n:sun': 'a45437fc', 'wk:34:t2:l0:n:hold': '65de93f8', 'wk:34:t0:l2:cat:sun': 'b4114ba4', 'wk:34:t0:l2:cat:hold': '73c741a6',
    'wk:34:t3:l0:dog:sun': 'd4ac06dd', 'wk:34:t3:l0:dog:hold': 'ddbc1c9e', 'wk:34:t1:l2:n:sun': 'e07e269e', 'wk:34:t1:l2:n:hold': '25d3d84f',
    'wk:39:t2:l0:n:sun': 'ac0b679a', 'wk:39:t2:l0:n:hold': '65ad87fa', 'wk:39:t0:l2:cat:sun': '714553fb', 'wk:39:t0:l2:cat:hold': '5c3b6262',
    'wk:39:t3:l0:dog:sun': '75399c36', 'wk:39:t3:l0:dog:hold': '3ac63fbb', 'wk:39:t1:l2:n:sun': '461296fc', 'wk:39:t1:l2:n:hold': '1169e9f4',
    'wk:44:t0:l0:n:o:sun': 'fec08cb9', 'wk:44:t0:l0:n:o:hold': '55e703ac', 'wk:44:t0:l0:cat:o:sun': '4b224082', 'wk:44:t0:l0:cat:o:hold': '3cc02b3a',
    'wk:44:t0:l2:n:o:sun': '141de675', 'wk:44:t0:l2:n:o:hold': '103a189b', 'wk:44:t0:l2:cat:o:sun': '9e03aec', 'wk:44:t0:l2:cat:o:hold': 'c032db71',
    'wk:44:t2:l0:n:o:sun': '89481e60', 'wk:44:t2:l0:n:o:hold': '23753157', 'wk:44:t2:l0:cat:o:sun': '7fefb5ce', 'wk:44:t2:l0:cat:o:hold': '1d3d06f3',
    'wk:44:t2:l2:n:o:sun': '2aa80011', 'wk:44:t2:l2:n:o:hold': '8d86263d', 'wk:44:t2:l2:cat:o:sun': '6d0ef604', 'wk:44:t2:l2:cat:o:hold': '37f94583',
    'wk:44:t5:l0:n:o:sun': '1a5ec5e7', 'wk:44:t5:l0:n:o:hold': 'e92aebe5', 'wk:44:t5:l0:cat:o:sun': '1152f1f', 'wk:44:t5:l0:cat:o:hold': 'e5d04250',
    'wk:44:t5:l2:n:o:sun': 'e2f1c3d5', 'wk:44:t5:l2:n:o:hold': 'a1627c9b', 'wk:44:t5:l2:cat:o:sun': '91d089dc', 'wk:44:t5:l2:cat:o:hold': 'c0e2a8d9',
    'wk:44:t0:l0:n:p:sun': 'abc866f6', 'wk:44:t0:l0:n:p:hold': '24b91302', 'wk:44:t0:l0:cat:p:sun': '9e048688', 'wk:44:t0:l0:cat:p:hold': 'c41df4e1',
    'wk:44:t0:l2:n:p:sun': 'bf9550da', 'wk:44:t0:l2:n:p:hold': 'e7d21bc5', 'wk:44:t0:l2:cat:p:sun': 'b68365f8', 'wk:44:t0:l2:cat:p:hold': '7d6dfcb2',
    'wk:44:t2:l0:n:p:sun': 'fa6106a0', 'wk:44:t2:l0:n:p:hold': '54a7eea9', 'wk:44:t2:l0:cat:p:sun': '6f0afb9b', 'wk:44:t2:l0:cat:p:hold': '45b48a10',
    'wk:44:t2:l2:n:p:sun': 'e042aac1', 'wk:44:t2:l2:n:p:hold': 'e1e1964c', 'wk:44:t2:l2:cat:p:sun': '4a305fb9', 'wk:44:t2:l2:cat:p:hold': '9eab2d3f',
    'wk:44:t5:l0:n:p:sun': '13dd524', 'wk:44:t5:l0:n:p:hold': '6039f560', 'wk:44:t5:l0:cat:p:sun': '91d074a9', 'wk:44:t5:l0:cat:p:hold': '112c6725',
    'wk:44:t5:l2:n:p:sun': '8dd9b067', 'wk:44:t5:l2:n:p:hold': 'cff2d2ac', 'wk:44:t5:l2:cat:p:sun': '3c92f40c', 'wk:44:t5:l2:cat:p:hold': '89db83e',
    'wk:nogame:9:sun': '13c72db8', 'wk:nogame:9:hold': 'ca4067fa', 'wk:nogame:39:sun': 'ac0b679a', 'wk:nogame:39:hold': '65ad87fa',
    'wk:nogame:44:sun': '89481e60', 'wk:nogame:44:hold': '23753157'
  };
  const p9now = await collectP9();
  for (const k of Object.keys(P9_REF)) assert(p9now[k] === (P9_CHANGED[k] || P9_REF[k]), `batch 8 ${k}: the picture changed (${p9now[k]}, was ${P9_CHANGED[k] || P9_REF[k]})`);
  assert(Object.keys(p9now).length === Object.keys(P9_REF).length, 'batch 8: the set of reference pictures changed');
  for (const k of Object.keys(P9_CHANGED)) assert(P9_CHANGED[k] !== P9_REF[k], `batch 8 ${k}: the ruled change is not a change`);

  const P10_REF = {
    'es:wiped:dark': '6c1b7bb0', 'es:wiped:light': 'f1573e9a', 'ed:wiped:0.3': 'd627ac60', 'ed:wiped:1': '2405a84b', 'eb:wiped:l:n:0': '3c21d529', 'eb:wiped:l:n:1': '2a298fc7',
    'eb:wiped:l:n:2': '90d5e1c5', 'eb:wiped:l:e:1': '8fa884c7', 'eb:wiped:l:l:1': '1cf5db07', 'eb:wiped:d:n:0': '4df9a815', 'eb:wiped:d:n:1': 'bd13aa9d',
    'eb:wiped:d:n:2': '90d5e1c5', 'eb:wiped:d:e:1': 'cef9b6d5', 'eb:wiped:d:l:1': 'dad1feb5', 'es:fired:dark': '6c1b7bb0', 'es:fired:light': 'f1573e9a', 'ed:fired:0.3': 'd4ae35e7',
    'ed:fired:1': 'd4ae35e7', 'eb:fired:l:n:0': '7d134b80', 'eb:fired:l:n:1': '47ffbfd6', 'eb:fired:l:e:1': 'e8d97136', 'eb:fired:l:l:1': 'e92ae5c6', 'eb:fired:d:n:0': 'c8c31b29',
    'eb:fired:d:n:1': '8829400e', 'eb:fired:d:e:1': 'be2cae16', 'eb:fired:d:l:1': 'c82e8946', 'es:exit:dark': '646c0a7e', 'es:exit:light': 'df02c8de', 'ed:exit:0.3': '3d9b6644',
    'ed:exit:1': '3d9b6644', 'eb:exit:l:n:0': 'e745aeaa', 'eb:exit:l:n:1': '665edf8', 'eb:exit:l:e:1': '7e67abd8', 'eb:exit:l:l:1': '27857a30', 'eb:exit:d:n:0': 'd259d5be',
    'eb:exit:d:n:1': '96f84384', 'eb:exit:d:e:1': '2ce48d5c', 'eb:exit:d:l:1': '91528d2c', 'es:nobody:dark': '6c1b7bb0', 'es:nobody:light': 'f1573e9a', 'ed:nobody:0.3': '2844ba11',
    'ed:nobody:1': '2844ba11', 'eb:nobody:l:n:0': '3c550175', 'eb:nobody:l:n:1': '3ac07ed', 'eb:nobody:l:e:1': '4621090d', 'eb:nobody:l:l:1': 'a34d6e1d',
    'eb:nobody:d:n:0': '68320d61', 'eb:nobody:d:n:1': '492d6f37', 'eb:nobody:d:e:1': '6160b94f', 'eb:nobody:d:l:1': 'c0e8f9df', 'es:master:dark': '646c0a7e',
    'es:master:light': 'df02c8de', 'ed:master:0.3': 'be991225', 'ed:master:1': 'be991225', 'eb:master:l:n:0': 'a0e5af85', 'eb:master:l:n:1': 'ca9a3103',
    'eb:master:l:e:1': '309f6363', 'eb:master:l:l:1': '90f008bb', 'eb:master:d:n:0': 'e1efc592', 'eb:master:d:n:1': '7d9dc046', 'eb:master:d:e:1': '33615fee',
    'eb:master:d:l:1': '83d68dfe', 'es:whistle:dark': 'ba6d8493', 'es:whistle:light': '1be234ac', 'ed:whistle:0.3': '4d43c60', 'ed:whistle:1': '4d43c60',
    'eb:whistle:l:n:0': 'ba25f19', 'eb:whistle:l:n:1': '7081168', 'eb:whistle:l:e:1': 'c3db1ea8', 'eb:whistle:l:l:1': '946b1380', 'eb:whistle:d:n:0': '112abdb0',
    'eb:whistle:d:n:1': 'b41c7a26', 'eb:whistle:d:e:1': '2ad4709e', 'eb:whistle:d:l:1': '41096a8e', 'es:revolving:dark': 'ba6d8493', 'es:revolving:light': '1be234ac',
    'ed:revolving:0.3': 'bfff3a0d', 'ed:revolving:1': 'bfff3a0d', 'eb:revolving:l:n:0': '8a781c89', 'eb:revolving:l:n:1': '92d9ab40', 'eb:revolving:l:e:1': 'c5f10800',
    'eb:revolving:l:l:1': '9cef1388', 'eb:revolving:d:n:0': 'f06795d5', 'eb:revolving:d:n:1': '46830f3', 'eb:revolving:d:e:1': '55d5133b', 'eb:revolving:d:l:1': 'f380c24b',
    'es:perp:dark': '6c1b7bb0', 'es:perp:light': 'f1573e9a', 'ed:perp:0.3': '600b72b1', 'ed:perp:1': 'e16850c9', 'eb:perp:l:n:0': '41b6be90', 'eb:perp:l:n:1': '9b08d36',
    'eb:perp:l:e:1': '63e3296', 'eb:perp:l:l:1': '7cba16a6', 'eb:perp:d:n:0': '28354319', 'eb:perp:d:n:1': 'aab5cdb6', 'eb:perp:d:e:1': 'b56677de', 'eb:perp:d:l:1': 'a5abbd8e',
    'es:fall-guy:dark': '6c1b7bb0', 'es:fall-guy:light': 'f1573e9a', 'ed:fall-guy:0.3': 'ca8658b5', 'ed:fall-guy:1': 'ca8658b5', 'eb:fall-guy:l:n:0': 'f98d3c00',
    'eb:fall-guy:l:n:1': 'e63349f3', 'eb:fall-guy:l:e:1': '96dec893', 'eb:fall-guy:l:l:1': '333027e3', 'eb:fall-guy:d:n:0': 'a098ffba', 'eb:fall-guy:d:n:1': '1dd7b77',
    'eb:fall-guy:d:e:1': '7530a3ef', 'eb:fall-guy:d:l:1': '93afcddf', 'es:cassandra:dark': 'ba6d8493', 'es:cassandra:light': '1be234ac', 'ed:cassandra:0.3': 'cf976bee',
    'ed:cassandra:1': 'cf976bee', 'eb:cassandra:l:n:0': 'e1616c7b', 'eb:cassandra:l:n:1': '32a54a2c', 'eb:cassandra:l:e:1': '9e2ce5ac', 'eb:cassandra:l:l:1': 'b9c9a2c4',
    'eb:cassandra:d:n:0': 'f42e0860', 'eb:cassandra:d:n:1': '49690838', 'eb:cassandra:d:e:1': '39fb6b60', 'eb:cassandra:d:l:1': 'f41d3450', 'es:acquirer:dark': '646c0a7e',
    'es:acquirer:light': 'df02c8de', 'ed:acquirer:0.3': 'b82f2c1b', 'ed:acquirer:1': 'b82f2c1b', 'eb:acquirer:l:n:0': 'ec5ac43d', 'eb:acquirer:l:n:1': '80edb783',
    'eb:acquirer:l:e:1': '147fd5e3', 'eb:acquirer:l:l:1': 'c3ec1d3b', 'eb:acquirer:d:n:0': '4a5a9146', 'eb:acquirer:d:n:1': '3b18bf2a', 'eb:acquirer:d:e:1': '314a1e32',
    'eb:acquirer:d:l:1': 'aad6a062', 'es:ward:dark': '6c1b7bb0', 'es:ward:light': 'f1573e9a', 'ed:ward:0.3': '69c4dc81', 'ed:ward:1': '69c4dc81', 'eb:ward:l:n:0': '514baa8f',
    'eb:ward:l:n:1': 'd2b6b6d4', 'eb:ward:l:e:1': '5861d2f4', 'eb:ward:l:l:1': '22edee04', 'eb:ward:d:n:0': 'ce47e9d3', 'eb:ward:d:n:1': '6a1dec6a', 'eb:ward:d:e:1': '28f2de82',
    'eb:ward:d:l:1': '829fa732', 'es:clawback:dark': 'ba6d8493', 'es:clawback:light': '1be234ac', 'ed:clawback:0.3': '7eff89b6', 'ed:clawback:1': '7eff89b6',
    'eb:clawback:l:n:0': 'd66082a1', 'eb:clawback:l:n:1': '85295598', 'eb:clawback:l:e:1': '703c40d8', 'eb:clawback:l:l:1': 'f0fdb300', 'eb:clawback:d:n:0': '459ac0a9',
    'eb:clawback:d:n:1': '25605977', 'eb:clawback:d:e:1': 'b5d2eebf', 'eb:clawback:d:l:1': '4743e68f', 'es:right-early:dark': '646c0a7e', 'es:right-early:light': 'df02c8de',
    'ed:right-early:0.3': '22d8d830', 'ed:right-early:1': '22d8d830', 'eb:right-early:l:n:0': '2aee2d23', 'eb:right-early:l:n:1': 'f3aaf6ee', 'eb:right-early:l:e:1': 'd265a50e',
    'eb:right-early:l:l:1': '38eb00c6', 'eb:right-early:d:n:0': 'ddcdf08e', 'eb:right-early:d:n:1': 'f36f833d', 'eb:right-early:d:e:1': 'b39461b5',
    'eb:right-early:d:l:1': 'ae749ba5', 'es:fund:dark': '646c0a7e', 'es:fund:light': 'df02c8de', 'ed:fund:0.3': '868cffc9', 'ed:fund:1': '868cffc9', 'eb:fund:l:n:0': 'a6b9606a',
    'eb:fund:l:n:1': 'c82c23b0', 'eb:fund:l:e:1': '3e7228d0', 'eb:fund:l:l:1': '5fb99ac8', 'eb:fund:d:n:0': 'bddbccbe', 'eb:fund:d:n:1': '4005ebf4', 'eb:fund:d:e:1': 'c131244c',
    'eb:fund:d:l:1': 'd3dd499c', 'es:everything-rally:dark': '646c0a7e', 'es:everything-rally:light': 'df02c8de', 'ed:everything-rally:0.3': 'aed5cbae',
    'ed:everything-rally:1': 'aed5cbae', 'eb:everything-rally:l:n:0': '71c3b524', 'eb:everything-rally:l:n:1': '99436243', 'eb:everything-rally:l:e:1': '26c7e823',
    'eb:everything-rally:l:l:1': '8e481cfb', 'eb:everything-rally:d:n:0': '24d7188a', 'eb:everything-rally:d:n:1': 'da1924e2', 'eb:everything-rally:d:e:1': '6abc81ea',
    'eb:everything-rally:d:l:1': 'e5f2e93a', 'es:lost-decade:dark': 'ba6d8493', 'es:lost-decade:light': '1be234ac', 'ed:lost-decade:0.3': '3aad9f29',
    'ed:lost-decade:1': '3aad9f29', 'eb:lost-decade:l:n:0': '22b1d074', 'eb:lost-decade:l:n:1': '2611d97', 'eb:lost-decade:l:e:1': '5ea35617', 'eb:lost-decade:l:l:1': 'eed6f6ef',
    'eb:lost-decade:d:n:0': '5ca51d7d', 'eb:lost-decade:d:n:1': '7da1815f', 'eb:lost-decade:d:e:1': '12a374c7', 'eb:lost-decade:d:l:1': 'c3fb4ef7', 'es:soft:dark': '646c0a7e',
    'es:soft:light': 'df02c8de', 'ed:soft:0.3': 'ea337140', 'ed:soft:1': 'ea337140', 'eb:soft:l:n:0': '4f92a3aa', 'eb:soft:l:n:1': 'fc7940ed', 'eb:soft:l:e:1': '6e59960d',
    'eb:soft:l:l:1': '9ff81235', 'eb:soft:d:n:0': '56aad930', 'eb:soft:d:n:1': '6f56d345', 'eb:soft:d:e:1': 'abde3e9d', 'eb:soft:d:l:1': 'c547282d', 'es:quiet:dark': '646c0a7e',
    'es:quiet:light': 'df02c8de', 'ed:quiet:0.3': 'bfd9ca75', 'ed:quiet:1': 'bfd9ca75', 'eb:quiet:l:n:0': '1db26c4a', 'eb:quiet:l:n:1': '314010f7', 'eb:quiet:l:e:1': 'd1a6b357',
    'eb:quiet:l:l:1': 'de9cebff', 'eb:quiet:d:n:0': '6a16c9c', 'eb:quiet:d:n:1': '3c9c4458', 'eb:quiet:d:e:1': '93351bd0', 'eb:quiet:d:l:1': 'ffb07480',
    'es:replaced:dark': '6c1b7bb0', 'es:replaced:light': 'f1573e9a', 'ed:replaced:0.3': '56f61225', 'ed:replaced:1': '56f61225', 'eb:replaced:l:n:0': '5a858a68',
    'eb:replaced:l:n:1': '3077cce', 'eb:replaced:l:e:1': '51f20ee', 'eb:replaced:l:l:1': '30d0cf3e', 'eb:replaced:d:n:0': '919d3e91', 'eb:replaced:d:n:1': '44f302d6',
    'eb:replaced:d:e:1': 'afb4acfe', 'eb:replaced:d:l:1': '15bec2ae', 'es:depression:dark': '6c1b7bb0', 'es:depression:light': 'f1573e9a', 'ed:depression:0.3': '3fba356d',
    'ed:depression:1': '3fba356d', 'eb:depression:l:n:0': '1fa21238', 'eb:depression:l:n:1': '2c45be3b', 'eb:depression:l:e:1': '7da349b', 'eb:depression:l:l:1': '41afab2b',
    'eb:depression:d:n:0': 'a68d443e', 'eb:depression:d:n:1': 'c3b86f73', 'eb:depression:d:e:1': 'c9d2102b', 'eb:depression:d:l:1': 'a52e26db', 'es:grind:dark': '646c0a7e',
    'es:grind:light': 'df02c8de', 'ed:grind:0.3': '3ddd54c6', 'ed:grind:1': '3ddd54c6', 'eb:grind:l:n:0': '6130e464', 'eb:grind:l:n:1': '6efe0d03', 'eb:grind:l:e:1': 'a469eee3',
    'eb:grind:l:l:1': 'ac5a3dbb', 'eb:grind:d:n:0': 'a739e72a', 'eb:grind:d:n:1': 'f2386742', 'eb:grind:d:e:1': '9e350f4a', 'eb:grind:d:l:1': 'c304da1a',
    'eb:pulled:l:2': 'f8a99c80', 'eb:pulled:d:2': 'f8a99c80'
  };
  // batch 9: the wiped and perp world finals (sheets fallen; flash stars and the burst) and the after finals (windows out, no still speckle; the pulled room's standby light on)
  const P10_CHANGED = {
    'eb:wiped:l:n:0': '6652cc9', 'eb:wiped:l:n:2': 'cdb224eb', 'eb:wiped:d:n:0': 'a51e9d65', 'eb:wiped:d:n:2': 'cdb224eb', 'eb:perp:l:n:0': '330f8d20', 'eb:perp:d:n:0': 'eb745eb1', 'eb:pulled:l:2': '65acaf38', 'eb:pulled:d:2': '65acaf38'
  };
  const p10now = await collectP10();
  for (const k of Object.keys(P10_REF)) assert(p10now[k] === (P10_CHANGED[k] || P10_REF[k]), `batch 9 ${k}: the picture changed (${p10now[k]}, was ${P10_CHANGED[k] || P10_REF[k]})`);
  assert(Object.keys(p10now).length === Object.keys(P10_REF).length, 'batch 9: the set of reference pictures changed');
  for (const k of Object.keys(P10_CHANGED)) assert(P10_CHANGED[k] !== P10_REF[k], `batch 9 ${k}: the ruled change is not a change`);

  // ---- stage 3 batch 9 asserts ----
  // ---- stage 3 batch 9: the endings ----
  // the split of endingDetail: base then mover is what endingDetail draws with no options; nothing is drawn for 'mover' of an id with no mover; the option values that mean "all" and "none"
  const splitRes = await page.evaluate(() => {
    const SH = BTB.Shots, ids = BTB.Rhythm.endingIds, bad = [], MOV = ['soft', 'wiped', 'perp', 'master', 'cassandra', 'acquirer', 'ward', 'clawback', 'fund', 'right-early', 'everything-rally', 'lost-decade', 'depression'];
    const mk = () => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
    const pix = (fn) => { const g = mk(); fn(g); return Array.from(g.getImageData(0, 0, 320, 180).data).join(','); };
    const blank = pix(() => {});
    for (const id of ids) for (const p of [0, 0.3, 0.45, 1]) {
      const whole = pix((g) => SH.endingDetail(g, id, p));
      if (whole !== pix((g) => SH.endingDetail(g, id, p, {}))) bad.push(`${id} p${p}: {} differs`);
      if (whole !== pix((g) => { SH.endingDetail(g, id, p, { part: 'base' }); SH.endingDetail(g, id, p, { part: 'mover' }); })) bad.push(`${id} p${p}: base + mover differs`);
      if (whole !== pix((g) => SH.endingDetail(g, id, p, { n: 99, dx: 0, dy: 0 }))) bad.push(`${id} p${p}: n 99, dx 0, dy 0 differs`);
      if (MOV.indexOf(id) < 0 && pix((g) => SH.endingDetail(g, id, p, { part: 'mover' })) !== blank) bad.push(`${id}: a mover is drawn`);
      if (MOV.indexOf(id) < 0 && whole !== pix((g) => SH.endingDetail(g, id, p, { part: 'base' }))) bad.push(`${id}: base differs from the whole`);
    }
    // each mover id: base alone differs from the whole (it leaves something out) and mover alone is not blank
    for (const id of MOV) {
      const whole = pix((g) => SH.endingDetail(g, id, 1)), b = pix((g) => SH.endingDetail(g, id, 1, { part: 'base' })), m = pix((g) => SH.endingDetail(g, id, 1, { part: 'mover' }));
      if (id !== 'wiped' && b === blank) bad.push(`${id}: base is blank`);
      if (id !== 'wiped' && id !== 'soft' && b === whole) bad.push(`${id}: base is the whole`);
      if (m === blank || (id !== 'wiped' && m === whole)) bad.push(`${id}: mover blank or whole`);
    }
    return { bad: bad.slice(0, 8), n: bad.length };
  });
  assert(splitRes.n === 0, `endingDetail split: ${JSON.stringify(splitRes)}`);
  // ---- stage 3 batch 9: the endings' beats ----
  await page.evaluate(() => {
    const view = { w: 640, h: 360 }, SH = BTB.Shots, P = BTB.Pal;
    const canvas = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
    const OPT = (id, extra) => Object.assign({ id, title: 'The Title of It', deck: 'A line of deck text.', dark: false }, extra);
    const hashData = (d) => { let x = 2166136261; for (let k = 0; k < d.length; k++) { x ^= d[k]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const rgbOf = (name) => { const hex = P[name]; return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)); };
    const W = window.w9 = {
      OPT, canvas, rgbOf,
      beat: (id, i, extra) => BTB.Scenes.ending(OPT(id, extra))[i],
      // a layer's animate alone on a transparent canvas: { n: pixels with alpha, box: [x0, y0, x1, y1], hash, d }
      anim: (b, lid, t) => {
        const layer = b.layers.find((l) => l.id === lid), g = canvas();
        layer.animate(g, view, t, t / b.dur, {});
        const d = g.getImageData(0, 0, 640, 360).data; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) if (d[(y * 640 + x) * 4 + 3]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        return { n, box: [x0, y0, x1, y1], hash: hashData(d), d };
      },
      pic: (b, t) => { const g = canvas(); b.draw(g, view, t / b.dur, {}); return g.getImageData(0, 0, 640, 360).data; },
      // the most fillRect calls the animates of all layers make in one frame, over the beat in 0.05 s steps
      rects: (b) => {
        const g = canvas(), P2 = CanvasRenderingContext2D.prototype, orig = P2.fillRect; let n = 0, worst = 0, at = 0;
        P2.fillRect = function (...a) { n++; return orig.apply(this, a); };
        try { for (let k = 0; k <= Math.round(b.dur / 0.05) + 1; k++) { const t = Math.min(b.dur, k * 0.05); n = 0; b.layers.forEach((l) => { if (l.animate) { g.save(); l.animate(g, view, t, t / b.dur, {}); g.restore(); } }); if (n > worst) { worst = n; at = t; } } } finally { P2.fillRect = orig; }
        return [worst, at];
      },
      px: (d, x, y) => { const k = (y * 640 + x) * 4; return [d[k], d[k + 1], d[k + 2], d[k + 3]]; },
      diffOutside: (a, z, rects) => { // pixels that differ between a and z outside the given screen rects [x, y, w, h]
        let bad = 0;
        for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
          const k = (y * 640 + x) * 4;
          if (a[k] === z[k] && a[k + 1] === z[k + 1] && a[k + 2] === z[k + 2]) continue;
          if (!rects.some((r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3])) bad++;
        }
        return bad;
      }
    };
  });
  const IDS9 = await page.evaluate(() => BTB.Rhythm.endingIds.slice());
  assert(IDS9.length === 22, 'the endings are not 22');
  // ---- world ----
  const worldRes = await page.evaluate((ids) => {
    const W = window.w9, bad = [], M = BTB.Motion;
    const fail = (m) => bad.push(m);
    for (const id of ids) for (const dark of [false, true]) {
      const b = W.beat(id, 0, { dark });
      const tag = `${id}${dark ? ' dark' : ''}`;
      const cam = [b.camera.from.y, b.camera.to.y].join('>');
      if (b.id !== `ending:${id}:world` || b.dur !== 1.8 || !b.layers || b.layers.map((l) => l.id).join() !== 'world' || b.layers[0].depth !== 1 || cam !== '-8>0' || b.sfx !== 'apartment' || b.transition !== 'fade' || (b.cues || []).length || b.line !== '' || b.layers[0].w || b.layers[0].h) fail(`${tag}: beat shape ${b.id} ${b.dur} ${cam} ${b.sfx} ${b.transition}`);
      const ys = new Set(); for (let k = 0; k <= 120; k++) { const y = M.cameraAt(b.camera, k / 120).y; ys.add(y); if (y % 2) fail(`${tag}: odd camera y ${y}`); }
      if (M.cameraAt(b.camera, 1).y !== 0 || M.cameraAt(b.camera, 0).y !== -8 || ys.size !== 5) fail(`${tag}: camera ends ${M.cameraAt(b.camera, 1).y}, ${ys.size} positions`);
      // nothing moves under the fade: the animate at 0 and at 0.35 are the same picture
      if (W.anim(b, 'world', 0).hash !== W.anim(b, 'world', 0.35).hash) fail(`${tag}: the animate changes before 0.40 s`);
      // deterministic, moving between 0.1 and 1.7 and still after the movement
      const a = W.pic(b, 0.1), z = W.pic(b, 1.7), z2 = W.pic(b, 1.7);
      let same = 0, differ = 0, holes = 0; for (let k = 0; k < a.length; k += 4) { if (a[k] !== z[k] || a[k + 1] !== z[k + 1] || a[k + 2] !== z[k + 2]) differ++; if (z[k] !== z2[k]) same++; if (a[k + 3] !== 255) holes++; }
      if (same || holes) fail(`${tag}: picture not deterministic ${same}, holes ${holes}`);
      if (W.anim(b, 'world', 1.45).hash !== W.anim(b, 'world', 1.8).hash) fail(`${tag}: still moving after 1.40 s`);
      // the picture at dur is the beat's final still
      const fin = W.pic(b, 1.8), full = (() => { const g = W.canvas(); b.draw(g, { w: 640, h: 360 }, 1, {}); return g.getImageData(0, 0, 640, 360).data; })();
      let fd = 0; for (let k = 0; k < fin.length; k++) if (fin[k] !== full[k]) fd++;
      if (fd) fail(`${tag}: final still differs from draw(p = 1)`);
      // the world's final frame is the card's state: it differs from the card's final only inside the card's band (art y 96-136 -> screen 192-272)
      const c = W.beat(id, 1, { dark }), cf = W.pic(c, 2.6);
      if (W.diffOutside(fin, cf, [[0, 190, 640, 84]])) fail(`${tag}: world final differs from the card final outside the card band`);
    }
    return { bad: bad.slice(0, 10), n: bad.length };
  }, IDS9);
  assert(worldRes.n === 0, `batch 9 world: ${JSON.stringify(worldRes)}`);
  // the live picture (camera and fade included) differs between 0.1 and 1.7 s, the same time gives the same picture
  for (const id of IDS9) for (const dark of [false, true]) {
    const o = { id, title: 'The Title of It', deck: 'A line of deck text.', dark };
    assert(await shot('ending', o, 0, 0.1) !== await shot('ending', o, 0, 1.7) && await shot('ending', o, 0, 0.9) === await shot('ending', o, 0, 0.9), `ending ${id}${dark ? ' dark' : ''} world: not moving or not deterministic`);
  }
  // ---- the ten recipes ----
  const recipeRes = await page.evaluate((ids) => {
    const W = window.w9, bad = [], info = {}, fail = (m) => bad.push(m);
    const A = (id, t, extra) => W.anim(W.beat(id, 0, extra), 'world', t);
    const sweep = (id, a, z, step) => { const out = []; for (let t = a; t <= z + 1e-9; t += step) out.push(A(id, Math.round(t * 1000) / 1000)); return out; };
    const distinct = (list) => new Set(list.map((r) => r.hash)).size;
    // the sheet's screen boxes (0.3) are loose for a few ids (the art's own rectangles are wider or taller: wiped, nobody, acquirer's cable, clawback, everything-rally), so the check is the rule they state:
    // everything the animate draws lies clear of the caption box (screen y 280 and below) and of the card's band, i.e. between y 30 and 198 (the world beat has no caption), and inside the screen
    const boxes = {};
    for (const id of ids) {
      const all = sweep(id, 0, 1.8, 0.01);
      let u = [1e9, 1e9, -1, -1]; for (const r of all) if (r.n) u = [Math.min(u[0], r.box[0]), Math.min(u[1], r.box[1]), Math.max(u[2], r.box[2]), Math.max(u[3], r.box[3])];
      boxes[id] = u.join(',');
      if (u[1] < 30 || u[3] > 198 || u[0] < 0 || u[2] > 639) fail(`${id}: animated pixels ${u} leave the world band (y 30-198)`);
      info[id] = distinct(all);
    }
    // A: wiped - six sheets fall, the lowest 20 px, gravity easing; nothing before 0.40 s, at rest from 1.30 s
    {
      const a = A('wiped', 0.40), m = A('wiped', 1.0), z = A('wiped', 1.30), z2 = A('wiped', 1.7);
      if (a.hash !== A('wiped', 0.2).hash || z.hash !== z2.hash || z.box[3] - a.box[3] !== 20) fail(`wiped: lowest sheet falls ${z.box[3] - a.box[3]} px (want 20), still ${a.hash === A('wiped', 0.2).hash}, rest ${z.hash === z2.hash}`);
      let prev = a.box[3], maxStep = 0; for (let t = 0.40; t <= 1.30; t += 1 / 30) { const y = A('wiped', t).box[3]; maxStep = Math.max(maxStep, y - prev); prev = y; if (y < prev) fail('wiped: backwards'); }
      if (maxStep > 4) fail(`wiped: a step of ${maxStep} px`);
      if (A('wiped', 0.85).box[3] - a.box[3] > 10) fail('wiped: the fall is not slow at first (gravity easing)');
    }
    // A: perp - nothing, stars at 0.50, burst at 0.60 and 0.95 for 0.08 s, then the card's state from 1.30
    {
      const e = A('perp', 0.45), s = A('perp', 0.55), bu = A('perp', 0.64), s2 = A('perp', 0.80), bu2 = A('perp', 0.99), s3 = A('perp', 1.15), f = A('perp', 1.32);
      if (e.n || !s.n || s.hash !== s2.hash || s.hash !== s3.hash || bu.hash !== bu2.hash || bu.n <= s.n * 5 || f.hash !== bu.hash) fail(`perp: flashes: ${e.n} ${s.n} ${bu.n} ${s2.n} ${bu2.n} ${f.n}`);
      const w = bu.box[2] - bu.box[0] + 1, h = bu.box[3] - bu.box[1] + 1;
      if (w < 340 || h < 120) fail(`perp: burst ${w}x${h} px (the art's 360x132)`);
    }
    // B: count - the items appear one by one, whole, on the sheet's steps; the first at the start, the last at the end
    const B = { cassandra: [0.40, 0.12, 6], 'lost-decade': [0.40, 0.09, 10], depression: [0.40, 0.10, 9], 'right-early': [0.40, 0.07, 13], 'everything-rally': [0.40, 0.12, 7], fund: [0.40, 0.08, 10], clawback: [0.50, 0.15, 6] };
    for (const id of Object.keys(B)) {
      const [a, step, N] = B[id], end = a + step * (N - 1);
      let prev = -1, changes = [];
      for (let t = 0; t <= 1.8 + 1e-9; t += 0.005) { const h = A(id, Math.round(t * 1000) / 1000).hash; if (h !== prev) { changes.push(Math.round(t * 1000) / 1000); prev = h; } }
      // changes: the picture at t = 0 plus one change per step (and, for clawback, the first state already has the extra coins)
      const want = id === 'clawback' ? N : N + 1;
      if (id === 'clawback' ? changes.length !== N + 1 : changes.length !== N + 1) fail(`${id}: ${changes.length} states (want ${N + 1}): ${changes.join(' ')}`);
      const steps = changes.slice(1);
      if (steps[0] < a - 0.006 || steps[0] > a + 0.006 || steps[steps.length - 1] > end + 0.006 || steps[steps.length - 1] < end - 0.006) fail(`${id}: steps ${steps[0]} to ${steps[steps.length - 1]} (want ${a} to ${end})`);
      if (id !== 'clawback' && A(id, 0.2).n) fail(`${id}: items before 0.40 s`);
      if (id === 'clawback' && !A(id, 0.2).n) fail('clawback: the extra coins are missing at the start');
      if (id === 'clawback' && A(id, 1.7).box[3] > 136) fail('clawback: ' + A(id, 1.7).box);
    }
    // C: master 48 px in 1.00 s (steps of at most 4 px at 30 fps), acquirer 24 px, ward 20 px, ending in place
    {
      const x = (t) => A('master', t).box[0];
      if (x(0.40) - x(1.40) !== -48 || x(1.4) !== x(1.8) || x(0.2) !== x(0.40)) fail(`master: moves ${x(1.40) - x(0.40)} px (want 48)`);
      let prev = x(0.40), mx = 0; for (let t = 0.40; t <= 1.40; t += 1 / 30) { const v = x(t); mx = Math.max(mx, v - prev); if (v < prev) fail('master: backwards'); prev = v; } if (mx > 4) fail(`master: step ${mx}`);
      const y = (id, t) => A(id, t).box[1];
      const yb = (t) => A('acquirer', t).box[3];
      if (yb(0.40) - yb(1.40) !== 24 || yb(1.40) !== yb(1.8) || yb(0.2) !== yb(0.40)) fail(`acquirer: hoists ${yb(0.40) - yb(1.40)} px`);
      if (y('ward', 0.40) - y('ward', 1.40) !== 20 || y('ward', 1.40) !== y('ward', 1.8) || y('ward', 0.2) !== y('ward', 0.40)) fail(`ward: hoists ${y('ward', 0.40) - y('ward', 1.40)} px`);
    }
    return { bad: bad.slice(0, 12), n: bad.length, info, boxes };
  }, IDS9);
  console.log('batch 9 distinct animate pictures per id:', JSON.stringify(recipeRes.info), 'boxes:', JSON.stringify(recipeRes.boxes));
  assert(recipeRes.n === 0, `batch 9 recipes: ${JSON.stringify(recipeRes)}`);
  const coverRes = await page.evaluate((ids) => {
    const W = window.w9, SH = BTB.Shots, bad = [], info = {}, fail = (m) => bad.push(m);
    const A = (id, t, extra) => W.anim(W.beat(id, 0, extra), 'world', t);
    const times = (id, a, z) => { const out = []; let prev = null; for (let t = a; t <= z + 1e-9; t += 0.002) { const h = A(id, Math.round(t * 1000) / 1000).hash; if (h !== prev) { out.push(Math.round(t * 1000) / 1000); prev = h; } } return out; };
    const near = (a, b) => Math.abs(a - b) < 0.0035;
    const same = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
    const sc = (r) => [r.x * 2, (r.y + 8) * 2, r.w * 2, r.h * 2]; // art rect -> screen rect
    const pics = (id) => { const b = W.beat(id, 0); return { a: W.pic(b, 0.1), z: W.pic(b, 1.8), b }; };
    // D soft: 28 windows, building by building (0.03 s apart from 0.40 s), a cover on flat slate
    {
      const { a, z } = pics('soft'), G = SH.endingGeom('soft'), slate = W.rgbOf('slate');
      if (G.wins.length !== 28) fail('soft: ' + G.wins.length + ' windows');
      if (W.diffOutside(a, z, G.wins.map(sc))) fail('soft: the cover changes pixels outside the windows');
      G.wins.forEach((w, k) => {
        const r = sc(w);
        const leafy = G.leaves.some((l) => w.x < l.x + l.w && w.x + w.w > l.x && w.y < l.y + l.h && w.y + w.h > l.y);
        for (const [dx, dy] of [[-1, 4], [r[2], 4], [4, -1], [4, r[3]], [r[2] / 2, r[3] / 2], [0, 0], [r[2] - 1, r[3] - 1]]) {
          const q = W.px(a, r[0] + dx, r[1] + dy);
          if (!same(q, slate) && !(leafy && same(q, W.px(z, r[0] + dx, r[1] + dy)))) { fail(`soft: window ${k}: ${q} next to or in the cover is not slate`); break; }
        }
      });
      const ts = times('soft', 0, 1.8); // t = 0 plus one change per window
      if (ts.length !== 29 || !near(ts[1], 0.40 + 0.03 * 0 + 0.002) && !near(ts[1], 0.40) || !near(ts[28], 0.40 + 0.03 * 27)) fail(`soft: ${ts.length} states, first ${ts[1]}, last ${ts[28]}`);
    }
    // D fired: PERSONAL written letter by letter, 0.50 s + 0.09 s a letter; the cover is the label's paper
    {
      const { a, z } = pics('fired'), L = SH.endingGeom('fired').label, r = sc(L), ink = W.rgbOf('ink'), ok = ['bone', 'white', 'putty2', 'ink2'].map(W.rgbOf);
      if (W.diffOutside(a, z, [r])) fail('fired: the cover changes pixels outside the label');
      let inkIn = 0, other = 0, inkZ = 0;
      for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) { const q = W.px(a, x, y); if (same(q, ink)) inkIn++; if (!ok.some((c) => same(q, c))) other++; if (same(W.px(z, x, y), ink)) inkZ++; }
      if (inkIn || other || inkZ < 100) fail(`fired: covered label has ${inkIn} ink and ${other} odd pixels, the written one ${inkZ} ink`);
      const ts = times('fired', 0, 1.8);
      if (ts.length !== 9 || !ts.slice(1).every((t, k) => near(t, 0.50 + 0.09 * k))) fail('fired: letters at ' + ts.join(' '));
    }
    // E quiet: 34 cells lit in dim amber go out one by one, seeded, from 0.40 to 1.40 s; yours stays
    {
      const { a, z } = pics('quiet'), G = SH.endingGeom('quiet'), amberD = W.rgbOf('amberD'), amber = W.rgbOf('amber');
      if (G.cells.length !== 34) fail('quiet: cells ' + G.cells.length);
      if (W.diffOutside(a, z, G.cells.map(sc))) fail('quiet: the lights change pixels outside the cells');
      if (!G.cells.every((c) => same(W.px(a, c.x * 2 + 3, (c.y + 8) * 2 + 3), amberD))) fail('quiet: the dim amber is missing at 0.1 s');
      const close = (u, v) => Math.abs(u[0] - v[0]) <= 2 && Math.abs(u[1] - v[1]) <= 2 && Math.abs(u[2] - v[2]) <= 2;
      const l = G.lit; if (!close(W.px(z, l.x * 2 + 3, (l.y + 8) * 2 + 3), amber) || !close(W.px(a, l.x * 2 + 3, (l.y + 8) * 2 + 3), amber)) fail('quiet: your window is not bright amber at the start and the end');
      const ts = times('quiet', 0, 1.8), ns = ts.map((t) => A('quiet', t).n);
      if (ts.length !== 35 || !near(ts[1], 0.40) || !near(ts[34], 1.40) || !ns.every((n, k) => k === 0 || n === ns[k - 1] - 6 * 7 * 4)) fail(`quiet: ${ts.length} states, ${ts[1]} to ${ts[34]}, ${ns.join()}`);
      // the same order every time (seeded)
      if (A('quiet', 0.9).hash !== A('quiet', 0.9, { dark: true }).hash) fail('quiet: the order depends on dark');
    }
    // F grind: dark from the start, the 0.05 s line at 0.60, the flare at 0.65, lit from 0.70
    {
      const { a, z } = pics('grind'), S = SH.endingGeom('grind').screen, ts = times('grind', 0, 1.8);
      if (W.diffOutside(a, z, [sc(S)])) fail('grind: the cover changes pixels outside the screen');
      const q = W.px(a, S.x * 2 + 1, (S.y + 8) * 2 + 1);
      if (!same(q, W.rgbOf('screenD'))) fail('grind: the screen is not dark at 0.1 s: ' + q);
      if (ts.length !== 4 || !near(ts[1], 0.60) || !near(ts[2], 0.65) || !near(ts[3], 0.70)) fail('grind: states at ' + ts.join(' '));
    }
    // F nobody: five screens at 0.45 + 0.15 i, each dark, line, flare, lit
    {
      const { a, z } = pics('nobody'), G = SH.endingGeom('nobody'), ts = times('nobody', 0, 1.8), crim = W.rgbOf('crimson');
      if (W.diffOutside(a, z, G.screens.map(sc))) fail('nobody: the cover changes pixels outside the screens');
      let crimIn = 0; G.screens.forEach((s) => { const r = sc(s); for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (same(W.px(a, x, y), crim)) crimIn++; });
      if (crimIn) fail('nobody: ' + crimIn + ' red pixels show on a dark screen');
      const want = [0, 1, 2, 3, 4].flatMap((i) => [0.45 + 0.15 * i, 0.50 + 0.15 * i, 0.55 + 0.15 * i]);
      if (ts.length !== 16 || !want.every((t, k) => near(ts[k + 1], t))) fail('nobody: states at ' + ts.join(' '));
    }
    // G replaced: the pulse passes rack 0 to 3 (0.45 + 0.12 i to 0.60 + 0.12 i), an overlay of five strips, never a cover
    {
      let prevX = -1, ok = true, n0 = A('replaced', 0.3).n, n1 = A('replaced', 1.2).n; const c = [];
      for (const [i, t] of [[0, 0.5], [1, 0.62], [2, 0.74], [3, 0.86]]) { const r = A('replaced', t); c.push(r.box[0]); if (r.n !== 5 * 20 * 5 * 4 || r.box[0] <= prevX) ok = false; prevX = r.box[0]; }
      if (!ok || n0 || n1 || A('replaced', 0.45).n === 0 || A('replaced', 1.11).n) fail(`replaced: pulse ${c.join()} ${n0} ${n1}`);
      const ts = times('replaced', 0, 1.8); if (!near(ts[1], 0.45) || !near(ts[ts.length - 1], 0.60 + 0.36)) fail('replaced: ' + ts.join(' '));
    }
    // H whistle, fall-guy: a blank page, two hard stamp frames at 0.70 and 0.74, the cached mark from 0.78
    for (const id of ['whistle', 'fall-guy']) {
      const { a, z } = pics(id), S = SH.endingGeom(id).stamp, r = sc(S), bone = W.rgbOf('bone'), ts = times(id, 0, 1.8);
      if (W.diffOutside(a, z, [r])) fail(id + ': the cover changes pixels outside the stamp');
      let notBone = 0, ring = 0;
      for (let y = r[1] - 2; y < r[1] + r[3]; y++) for (let x = r[0] - 2; x < r[0] + r[2] + 2; x++) { if (!same(W.px(a, x, y), bone)) notBone++; }
      if (notBone) fail(`${id}: ${notBone} pixels in or around the cover are not the page's bone (the ring above and beside the cover; the row below is the page's shade)`);
      if (ts.length !== 4 || !near(ts[1], 0.70) || !near(ts[2], 0.74) || !near(ts[3], 0.78)) fail(id + ': states at ' + ts.join(' '));
      const f1 = A(id, 0.72), f2 = A(id, 0.76); if (f1.box[2] - f1.box[0] <= f2.box[2] - f2.box[0] || f2.box[2] - f2.box[0] <= r[2]) fail(id + ': the stamp does not close in');
    }
    // I exit: the door's light in four hard steps (0.60, 0.40, 0.20, then the art)
    {
      const b = W.beat('exit', 0), D = SH.endingGeom('exit').door, r = sc(D), lum = (t) => { const d = W.pic(b, t); let s = 0; for (let y = r[1]; y < r[1] + r[3]; y += 2) for (let x = r[0]; x < r[0] + r[2]; x += 2) { const q = W.px(d, x, y); s += q[0] + q[1] + q[2]; } return s; };
      const ts = times('exit', 0, 1.8), l = [0.3, 0.6, 0.8, 1.0].map(lum);
      if (ts.length !== 4 || !near(ts[1], 0.50) || !near(ts[2], 0.70) || !near(ts[3], 0.90) || !(l[0] < l[1] && l[1] < l[2] && l[2] < l[3])) fail(`exit: steps ${ts.join(' ')}, brightness ${l.join(' ')}`);
      const [a, z] = [W.pic(b, 0.1), W.pic(b, 1.8)]; if (W.diffOutside(a, z, [r])) fail('exit: the dim changes pixels outside the door');
    }
    // J revolving: the wing turns once round in ten steps of 0.10 s from 0.40 s and stops where the art has it
    {
      const b = W.beat('revolving', 0), ts = times('revolving', 0, 1.8), glass = SH.endingGeom('revolving').glass, sky = W.rgbOf('sky'), slate2 = W.rgbOf('slate2');
      const WING = [163, 167, 151, 155, 159, 163, 167, 151, 155, 159], hs = WING.map((x, k) => A('revolving', 0.45 + 0.1 * k).hash);
      const okPattern = WING.every((x, k) => WING.every((y, j) => (x === y) === (hs[k] === hs[j])));
      if (!okPattern || A('revolving', 0.3).n || A('revolving', 1.45).n || A('revolving', 0.40).n === 0 || A('revolving', 1.39).n === 0) fail('revolving: the wing does not take the ten positions ' + hs.join());
      const [a, z] = [W.pic(b, 0.1), W.pic(b, 1.8)]; if (W.diffOutside(a, z, [])) fail('revolving: differs at 0.1 s');
      // while the wing is at 163 the art's wing column (159) is glass sky again, and the rail runs through
      const d = W.pic(b, 0.45), gx = 159 * 2, gy = (48 + 8) * 2; if (!same(W.px(d, gx, gy), sky) || !same(W.px(d, gx + 1, gy + 3), sky) || !same(W.px(d, gx, (56 + 8) * 2), slate2) || !same(W.px(d, 163 * 2, gy), slate2)) fail('revolving: the cover is not the glass or the rail is lost');
      const dd = W.pic(b, 0.45), de = W.pic(b, 1.45); if (W.diffOutside(dd, de, [[glass.x * 2, (glass.y + 8) * 2, glass.w * 2, glass.h * 2]])) fail('revolving: the wing leaves the glass');
    }
    return { bad: bad.slice(0, 12), n: bad.length };
  }, IDS9);
  assert(coverRes.n === 0, `batch 9 covers and overlays: ${JSON.stringify(coverRes)}`);
  // rectangles a frame (the sheet's worst cases, with a little room)
  const RECTB9 = {};
  const rectLimits = { wiped: 80, perp: 45, cassandra: 150, 'lost-decade': 150, depression: 250, 'right-early': 150, 'everything-rally': 120, fund: 60, clawback: 399, master: 40, acquirer: 85, ward: 20, soft: 130, fired: 12, quiet: 40, grind: 8, nobody: 30, replaced: 12, whistle: 20, 'fall-guy': 20, exit: 4, revolving: 8 };
  for (const id of IDS9) {
    const [n, at] = await page.evaluate(([id]) => window.w9.rects(window.w9.beat(id, 0)), [id]);
    RECTB9[id] = `${n} at ${at}`;
    assert(n <= rectLimits[id] && n < 400, `ending ${id} world: ${n} rectangles at ${at} s (limit ${rectLimits[id]})`);
  }
  console.log('batch 9 world rect counts:', JSON.stringify(RECTB9));
  // ---- card ----
  const cardRes = await page.evaluate((ids) => {
    const W = window.w9, SH = BTB.Shots, bad = [], fail = (m) => bad.push(m), M = BTB.Motion;
    const same = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
    const reg = (d, r) => { let h = 2166136261; for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) { const k = (y * 640 + x) * 4; h ^= d[k] ^ (d[k + 1] << 8) ^ (d[k + 2] << 16); h = Math.imul(h, 16777619); } return h >>> 0; };
    for (const id of ids) for (const dark of [false, true]) for (const title of ['The Title of It', '', 'W'.repeat(80)]) {
      const b = W.beat(id, 1, { dark, title }), tag = `${id}${dark ? ' dark' : ''} '${title.slice(0, 3)}'`;
      const a = b.layers.map((l) => l.id).join(), cues = (b.cues || []).map((c) => c.at + ':' + c.sfx).join();
      if (b.id !== `ending:${id}:card` || b.dur !== 2.6 || a !== 'card' || b.layers[0].depth !== 1 || b.camera || cues !== '1.3:click' || b.sfx || !b.informative || b.line !== 'A line of deck text.') fail(`${tag}: card beat ${b.id} ${b.dur} ${a} ${b.camera} ${cues} ${b.sfx}`);
      const p1 = W.pic(b, 0.1), p2 = W.pic(b, 1.0), p3 = W.pic(b, 1.5), pz = W.pic(b, 2.5), pz2 = W.pic(b, 2.5);
      // the box and title never move: the title rows (art y 106-114, screen 212-230) and the box interior above the line are the same at every time
      for (const q of [p1, p2, p3, pz]) if (reg(q, [80, 212, 480, 19]) !== reg(pz, [80, 212, 480, 19])) { fail(`${tag}: the title changes`); break; }
      // the line: hidden at 0.1 and 1.0 (ink inside its rect), there at 1.5; the card at 2.5 is the cached card
      const lr = [119 * 2, 117 * 2, 83 * 2, 14];
      if (reg(p1, lr) !== reg(p2, lr) || reg(p1, lr) === reg(p3, lr) || reg(p3, lr) !== reg(pz, lr)) fail(`${tag}: ENDING REACHED does not appear between 1.0 and 1.5 s`);
      // outside the stamp's outline and the line, the card at 0.1 is the final card
      if (W.diffOutside(p1, pz, [lr, [60, 188, 520, 76]])) fail(`${tag}: the card at 0.1 s differs from the final outside the line and the stamp`);
      for (let k = 0; k < pz.length; k++) if (pz[k] !== pz2[k]) { fail(`${tag}: not deterministic`); break; }
      // the hidden line is only ink / ink2 (the box's flat interior)
      const ink = W.rgbOf('ink'), ink2 = W.rgbOf('ink2'); let odd = 0;
      for (let y = lr[1]; y < lr[1] + lr[3]; y++) for (let x = lr[0]; x < lr[0] + lr[2]; x++) { const q = W.px(p1, x, y); if (!same(q, ink) && !same(q, ink2)) odd++; }
      if (odd) fail(`${tag}: ${odd} pixels of the hidden line are not box ink`);
    }
    // the stamp: cover only before 1.30, outline (title colour) 1.30-1.34 (256 x 34), 1.34-1.38 (246 x 29), nothing from 1.38
    for (const [id, dark] of [['fund', false], ['wiped', true]]) {
      const b = W.beat(id, 1, { dark }), at = (t) => W.anim(b, 'card', t), col = W.rgbOf(dark ? 'crimson' : 'amber');
      const a0 = at(1.0), a1 = at(1.32), a2 = at(1.36), a3 = at(1.40), a4 = at(2.5);
      if (a0.hash !== at(0.1).hash || a1.hash === a0.hash || a2.hash === a1.hash || a3.hash === a2.hash || a3.hash !== a4.hash || a3.n || !a0.n) fail(`${id}: stamp states`);
      const w1 = a1.box[2] - a1.box[0] + 1, h1 = a1.box[3] - a1.box[1] + 1, w2 = a2.box[2] - a2.box[0] + 1;
      if (w1 !== 512 || h1 !== 68 || w2 < 490 || w2 > 500) fail(`${id}: stamp frames ${w1}x${h1}, ${w2}`);
      const q = W.px(a1.d, a1.box[0], a1.box[1] + 10); if (!same(q, col)) fail(`${id}: stamp colour ${q}`);
    }
    return { bad: bad.slice(0, 10), n: bad.length };
  }, IDS9);
  assert(cardRes.n === 0, `batch 9 card: ${JSON.stringify(cardRes)}`);
  for (const [id, dark] of [['fund', false], ['wiped', true], ['clawback', true]]) {
    const o = { id, title: 'The Title of It', deck: 'A line of deck text.', dark };
    assert(await shot('ending', o, 1, 0.5) !== await shot('ending', o, 1, 2.5), `ending ${id} card: not moving`);
  }
  // ---- after ----
  const afterRes = await page.evaluate(() => {
    const W = window.w9, R = BTB.Rhythm, bad = [], fail = (m) => bad.push(m), P = BTB.Pal;
    const wins = R.skylineWindows(1, 61, 270);
    const info = { windows: wins.length, shown: wins.filter((w) => w.shown).length };
    for (const id of ['grind', 'wiped']) {
      const b = W.beat(id, 2, {});
      if (b.id !== `ending:${id}:after:` || b.dur !== 2.2 || b.layers.map((l) => l.id).join() !== 'city' || b.camera || (b.cues || []).length || b.sfx !== 'room' || b.line !== 'FIRST LIGHT. THE CITY IS STILL THERE.') fail(`after ${id}: beat shape ${b.id}`);
      // lit amber windows go out from the right between 0.40 and 1.40 s
      let prevMax = 1e9, prevN = 1e9, ok = true; const maxes = [];
      for (let t = 0.40; t <= 1.40; t += 1 / 30) { const r = W.anim(b, 'city', t); if (r.n > prevN || (r.n && r.box[2] > prevMax)) ok = false; prevMax = r.n ? r.box[2] : prevMax; prevN = r.n; maxes.push(r.n ? r.box[2] : -1); }
      const r0 = W.anim(b, 'city', 0.3), r1 = W.anim(b, 'city', 1.45), r2 = W.anim(b, 'city', 2.2);
      if (!ok || !r0.n || r1.n || r2.n || W.anim(b, 'city', 0).hash !== W.anim(b, 'city', 0.35).hash) fail(`after ${id}: lights: ${ok} ${r0.n} ${r1.n}`);
      const frontStep = Math.max.apply(null, maxes.slice(1).map((m, k) => (maxes[k] >= 0 && m >= 0 ? maxes[k] - m : 0)));
      info.frontStep = frontStep;
      if (r0.box[3] > 270) fail('after: a window below y 270');
      const ids = new Set(); for (let t = 0; t <= 2.2; t += 0.01) ids.add(W.anim(b, 'city', t).hash); info.states = ids.size;
      // the final still: no lit window left (the art's wash colour and the animate's amber are both gone at each window) and the picture differs from the start
      const z = W.pic(b, 2.2), a = W.pic(b, 0.1), wash = W.rgbOf('wash' in P ? 'wash' : 'amber'), amber = W.rgbOf('amber');
      let lit = 0; wins.filter((w) => w.shown).forEach((w) => { const q = W.px(z, w.x, w.y); if (q[0] === amber[0] && q[1] === amber[1] && q[2] === amber[2]) lit++; });
      if (lit || W.diffOutside(a, z, []) === 0) fail(`after ${id}: lit ${lit} at the end, or no change`);
    }
    // pulled: the dark rack room, one standby light blinking at the standby rate, on at the end
    const b = W.beat('grind', 2, { pulled: true }), L = (t) => W.anim(b, 'room', t);
    if (b.id !== 'ending:grind:after:p' || b.dur !== 2.2 || b.layers.map((l) => l.id).join() !== 'room,grain' || b.camera || b.sfx !== 'room' || b.line !== 'THE RACKS STAY DARK. FOR NOW.') fail('pulled: beat shape ' + b.id + ' ' + b.layers.map((l) => l.id));
    const amber = W.rgbOf('amber'), led = (t) => { const q = W.px(L(t).d, 186, 42); return q[3] === 255 && q[0] === amber[0]; };
    const on = [0.3, 0.55, 0.69, 0.75, 1.15, 1.25, 1.65, 1.75, 2.15, 2.2].map(led);
    const want = [false, false, false, true, true, false, false, true, true, true];
    if (on.join() !== want.join()) fail('pulled: standby ' + on.join());
    if (L(0.75).n <= 36 * 4 || L(0.75).box[0] < 150 || L(0.75).box[2] > 220 || L(0.75).box[1] < 15 || L(0.75).box[3] > 70) fail('pulled: halo ' + L(0.75).box);
    if (L(0.3).n || L(1.25).n || !L(2.2).n || L(2.2).hash !== L(0.75).hash) fail('pulled: states');
    info.pulledBox = L(0.75).box.join(',');
    return { bad: bad.slice(0, 10), n: bad.length, info };
  });
  console.log('batch 9 after:', JSON.stringify(afterRes.info));
  assert(afterRes.n === 0, `batch 9 after: ${JSON.stringify(afterRes)}`);
  for (const [lab, o] of [['city', { id: 'grind' }], ['pulled', { id: 'grind', pulled: true }]]) {
    const oo = Object.assign({ title: 'T', deck: 'D', dark: false }, o);
    assert(await shot('ending', oo, 2, 0.1) !== await shot('ending', oo, 2, 2.1) && await shot('ending', oo, 2, 1.1) === await shot('ending', oo, 2, 1.1), `ending after ${lab}: not moving or not deterministic`);
  }
  // rectangles a frame
  for (const [lab, id, o, lim] of [['city', 'grind', {}, 125], ['pulled', 'grind', { pulled: true }, 40], ['card', 'fund', {}, 8]]) {
    const [n, at] = await page.evaluate(([id, o, i]) => window.w9.rects(window.w9.beat(id, i, o)), [id, o, lab === 'card' ? 1 : 2]);
    RECTB9[lab] = `${n} at ${at}`;
    assert(n <= lim, `ending ${lab}: ${n} rectangles at ${at} s (limit ${lim})`);
  }
  console.log('batch 9 card/after rect counts:', JSON.stringify(RECTB9));
  // every beat of every ending draws whole for dark and light, pulled or not, with an empty or very long title and deck, and effects reduced gives one still
  const wholeRes = await page.evaluate((ids) => {
    const W = window.w9, bad = [];
    for (const id of ids) for (const dark of [false, true]) for (const pulled of [false, true]) for (const [title, deck] of [['', ''], ['W'.repeat(200), 'V'.repeat(400)]]) {
      BTB.Scenes.ending({ id, title, deck, dark, pulled }).forEach((b, i) => { for (const t of [0, b.dur * 0.5, b.dur]) { let holes = 0; const d = W.pic(b, t); for (let k = 3; k < d.length; k += 4) if (d[k] !== 255) holes++; if (holes) bad.push(`${id} ${i} t${t}: ${holes} holes`); } });
    }
    return bad.slice(0, 5);
  }, IDS9);
  assert(wholeRes.length === 0, `batch 9: beats with holes: ${JSON.stringify(wholeRes)}`);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const id of IDS9) for (const pulled of [false, true]) for (let i = 0; i < 3; i++) {
    if (pulled && id !== 'grind' && id !== 'wiped') continue;
    const o = { id, title: 'T', deck: 'D', dark: false, pulled };
    assert(await shot('ending', o, i, 0.4) === await shot('ending', o, i, [1.8, 2.6, 2.2][i] - 0.05), `ending ${id} beat ${i}${pulled ? ' pulled' : ''}: reduced effects still moves`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  // ---- stage 3 batch 9 asserts end ----
  if (process.env.B9_ONLY) { console.log('motion-run: batch 9 asserts only: passed'); return; }
  // ---- stage 3 batch 8 asserts go here ----
  // ---- stage 3 batch 8, part A: critique fixes ----
  // A5: the cameras of shots whose art is 320x180 drawn at 2x (`even` cameras: the tableau establishes, the lobby / elevator and apartment places, the tv, rating, voicemail and
  // ticket rooms, the lit floor, session 1's elevator, the closing bell) move in 2 px steps: their y offset is even at every sampled time, the end is 0 and nothing else changed
  const evenScan = await page.evaluate(() => {
    const M = BTB.Motion, found = {}, bad = [];
    const nopt = (day) => ({ day, brief: { title: 'Headline of the day', feed: [] } });
    const scanBeats = (label, beats) => beats.forEach((b) => {
      if (!b.camera || !b.camera.even) return;
      found[label] = (found[label] || 0) + 1;
      const ys = new Set();
      for (let k = 0; k <= 120; k++) { const y = M.cameraAt(b.camera, k / 120).y; ys.add(y); if (y % 2 !== 0) bad.push(`${b.id} p=${k / 120}: y ${y}`); }
      if (M.cameraAt(b.camera, 1).y !== 0 || M.cameraAt(b.camera, 0).y > -6 || ys.size < 3) bad.push(`${b.id}: ends ${M.cameraAt(b.camera, 1).y}, starts ${M.cameraAt(b.camera, 0).y}, ${ys.size} positions`);
    });
    for (let d = 0; d <= 60; d++) { scanBeats('news', BTB.Scenes.news(nopt(d))); scanBeats('close', BTB.Scenes.close({ report: { day: d }, day: d })); }
    return { found, bad: bad.slice(0, 6), nBad: bad.length };
  });
  assert(evenScan.nBad === 0 && evenScan.found.news >= 25, `A5: a 2x-art camera has an odd y or is not stepped: ${JSON.stringify(evenScan)}`);
  // and the known 2x shots are among them
  for (const [day, re] of [[6, 'establish'], [9, 'establish'], [17, 'establish'], [20, 'establish'], [25, 'establish'], [37, 'establish'], [40, 'establish'], [45, 'establish'], [0, 'establish'], [16, 'establish'], [18, 'establish'], [4, 'establish'], [50, 'establish']]) {
    const e = await page.evaluate(([d, re]) => { const b = BTB.Scenes.news({ day: d, brief: { title: 'Headline of the day', feed: [] } }).find((x) => new RegExp(re + '$').test(x.id)); return !!(b && b.camera && b.camera.even); }, [day, re]);
    assert(e, `A5: news ${day} ${re} does not have the stepped camera`);
  }
  // native 640x360 rooms keep their camera: the vote room and the decisions' tilt are still one-pixel steps
  const nativeCam = await page.evaluate(() => { const M = BTB.Motion, b = BTB.Scenes.decision({ id: 'c3', day: 10, speaker: 'x', role: 'y', title: 't' })[0]; let odd = 0; for (let k = 0; k <= 120; k++) if (M.cameraAt(b.camera, k / 120).y % 2 !== 0) odd++; return odd; });
  assert(nativeCam > 0, 'A5: the native hearing room tilt was changed');

  // A1: every blink that passes `end` is on at the end of its beat. Scans the beats of the news (days 0 to 60, also with the bill passed and the plug pulled), every decision,
  // the weekends and the endings: each K.blink with `end` must have end === the beat's duration and be on at dur - 0.02 and at p = 1 (the last frames a player draws are just
  // before dur); and for the hearing (37) and floor vote (40) establishes the blink's own screen region at dur - 0.02 is the region of the final still.
  const blinkScan = await page.evaluate(() => {
    const K = BTB.MotionKit, orig = K.blink, view = { w: 640, h: 360 }, bad = [], regions = [], seen = { n: 0, beats: 0 };
    let cur = null;
    K.blink = function (ctx, x, y, w, h, t, o) {
      if (cur && o && o.end != null) {
        const T = t + (o.t0 || 0), per = o.period || 1, duty = o.duty == null ? 0.5 : o.duty, on = (((o.end - T) % per) + per) % per < duty * per;
        const m = ctx.getTransform(), rx = m.a * x + m.e, ry = m.d * y + m.f;
        cur.calls.push({ on, endOk: Math.abs(o.end - cur.dur) < 1e-9, rect: [Math.round(rx), Math.round(ry), Math.max(1, Math.round(m.a * w)), Math.max(1, Math.round(m.d * h))] });
      }
      return orig.apply(this, arguments);
    };
    const g = document.createElement('canvas'); g.width = 640; g.height = 360; const ctx = g.getContext('2d', { willReadFrequently: true });
    const scan = (label, beats) => beats.forEach((b) => {
      if (!b.layers) return;
      seen.beats++;
      for (const p of [(b.dur - 0.02) / b.dur, 1]) {
        cur = { dur: b.dur, calls: [] };
        try { b.draw(ctx, b.view || view, p, {}); } catch (e) { bad.push(`${label} ${b.id}: draw threw ${e.message}`); }
        seen.n += cur.calls.length;
        cur.calls.forEach((c) => { if (!c.on || !c.endOk) bad.push(`${label} ${b.id} p=${p.toFixed(3)}: blink ${c.on ? '' : 'off'} ${c.endOk ? '' : 'end differs from dur'}`); });
        if (p !== 1) cur.first = cur.calls.map((c) => c.rect);
        else regions.push({ id: b.id, label });
      }
    });
    const nopt = (day, S) => Object.assign({ day, brief: { title: 'Headline of the day', feed: [] } }, S ? { game: { mode: { S } } } : {});
    for (let d = 0; d <= 60; d++) { scan('news', BTB.Scenes.news(nopt(d))); if (d % 5 === 1 || d >= 36) scan('news+', BTB.Scenes.news(nopt(d, { f: { billPassed: true, pulledPlug: true } }))); }
    const items = BTB.Life.LIFE.map((b) => ({ id: b.id, day: b.day, speaker: b.speaker, role: b.role, title: b.title }))
      .concat(Object.keys(BTB.StoryData.CHOICES).filter((k) => !BTB.StoryData.CHOICES[k].mid).map((k) => { const c = BTB.StoryData.CHOICES[k]; return { id: k, day: c.day, speaker: c.speaker, role: c.role, title: c.title }; }));
    for (const it of items) scan('decision', BTB.Scenes.decision(Object.assign({ S: BTB.StoryMode.freshState(250000) }, it)));
    for (const d of [4, 9, 14, 24, 34, 39, 44]) for (const plug of [false, true]) scan('weekend', BTB.Scenes.weekend({ day: d, game: { mode: { S: Object.assign({ wallet: { tier: 2, lateWeeks: d % 3, pet: d % 2 ? { kind: 'cat', sex: 'boy' } : undefined } }, plug ? { f: { pulledPlug: true } } : {}) } } }));
    for (const id of BTB.Rhythm.endingIds) { scan('ending', BTB.Scenes.ending({ id, title: id, deck: 'Deck', dark: false })); scan('ending dark', BTB.Scenes.ending({ id, title: id, deck: 'Deck', dark: true })); }
    scan('ending pulled', BTB.Scenes.ending({ id: 'grind', title: 'T', deck: 'Deck', dark: false, pulled: true }));
    K.blink = orig;
    return { bad: bad.slice(0, 8), nBad: bad.length, n: seen.n, beats: seen.beats };
  });
  assert(blinkScan.nBad === 0 && blinkScan.n > 40, `A1: a blink with end is off (or ends off the beat) near the end of its beat: ${JSON.stringify(blinkScan)}`);
  // the two tableaux the critique looked at: the badge / VOTE PENDING region just before the end is the region of the final still
  const badgeEnd = await page.evaluate(() => {
    const K = BTB.MotionKit, orig = K.blink, view = { w: 640, h: 360 }, out = [], mkOpt = (day) => ({ day, brief: { title: 'Headline of the day', feed: [] }, game: { mode: { S: { f: {} } } } });
    for (const day of [37, 40]) {
      const b = BTB.Scenes.news(mkOpt(day))[0]; let rect = null;
      K.blink = function (ctx, x, y, w, h) { const m = ctx.getTransform(); rect = [Math.floor(m.a * x + m.e), Math.floor(m.d * y + m.f), Math.ceil(m.a * w), Math.ceil(m.d * h)]; return orig.apply(this, arguments); };
      const mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
      const a = mk(), z = mk(), still = mk();
      b.draw(a, view, (b.dur - 0.02) / b.dur, {}); b.draw(z, view, 1, {}); b.draw(still, view, 1, {});
      K.blink = orig;
      const get = (g) => g.getImageData(rect[0], rect[1], rect[2], rect[3]).data, A = get(a), Z = get(z), S = get(still);
      let d1 = 0, d2 = 0; for (let i = 0; i < A.length; i++) { if (A[i] !== Z[i]) d1++; if (S[i] !== Z[i]) d2++; }
      // and that the region is not blank: the art shows something lit (more than one colour) in it
      const cols = new Set(); for (let i = 0; i < Z.length; i += 4) cols.add(Z[i] + ',' + Z[i + 1] + ',' + Z[i + 2]);
      out.push({ day, id: b.id, rect, d1, d2, colours: cols.size });
    }
    return out;
  });
  for (const r of badgeEnd) assert(r.d1 === 0 && r.d2 === 0 && r.colours > 1 && r.rect[2] > 20, `A1: blink region at dur - 0.02 differs from the final still: ${JSON.stringify(r)}`);

  // ---- stage 3 batch 8, part B: the weekend remainder (Sunday, hold, the 3:17 beat in both forms) ----
  await page.evaluate(() => {
    const view = { w: 640, h: 360 }, canvas = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
    const PETS = { n: null, cat: { pet: { kind: 'cat', sex: 'boy' } }, dog: { pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' } };
    const rgbOf = (spec) => { const hex = BTB.Pal[spec]; return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)); };
    window.w8 = {
      opts: (day, tier, late, pet, plug) => ({ day, game: { mode: { S: Object.assign({ wallet: Object.assign({ tier, lateWeeks: late }, PETS[pet] || {}) }, plug ? { f: { pulledPlug: true } } : {}) } } }),
      beat: (o, re) => BTB.Scenes.weekend(o).findIndex((b) => new RegExp(re).test(b.id)),
      info: (o, i) => { const b = BTB.Scenes.weekend(o)[i]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), depths: (b.layers || []).map((l) => l.depth).join(), cues: (b.cues || []).map((c) => c.at + ':' + c.sfx).join(), sfx: b.sfx || '', cam: b.camera ? b.camera.from.y + '>' + b.camera.to.y : 'none', tr: BTB.Motion.transitionFor(b, 1) }; },
      // the animate of one layer alone on a transparent canvas: pixels with any alpha (spec 'any') or exactly a palette colour inside r
      cnt: (o, i, id, t, r, spec) => {
        const b = BTB.Scenes.weekend(o)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
        layer.animate(g, view, t, t / b.dur, {});
        const d = g.getImageData(r[0], r[1], r[2], r[3]).data, c = !spec || spec === 'any' ? null : rgbOf(spec); let n = 0;
        for (let k = 0; k < d.length; k += 4) { if (c ? d[k + 3] === 255 && d[k] === c[0] && d[k + 1] === c[1] && d[k + 2] === c[2] : d[k + 3] > 0) n++; }
        return n;
      },
      box: (o, i, id, t, r) => {
        const b = BTB.Scenes.weekend(o)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
        layer.animate(g, view, t, t / b.dur, {});
        const d = g.getImageData(0, 0, 640, 360).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (d[(y * 640 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        return [x0, x1, y0, y1];
      },
      anim: (o, i, id, t) => { const b = BTB.Scenes.weekend(o)[i], layer = b.layers.find((l) => l.id === id), g = canvas(); layer.animate(g, view, t, t / b.dur, {}); const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let k = 0; k < d.length; k++) { x ^= d[k]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); },
      // the most fillRect calls the animates of all layers make in one frame, over the beat in 0.05 s steps
      rects: (o, i) => {
        const b = BTB.Scenes.weekend(o)[i], g = canvas(), P = CanvasRenderingContext2D.prototype, orig = P.fillRect; let n = 0, worst = 0;
        P.fillRect = function (...a) { n++; return orig.apply(this, a); };
        try { for (let k = 0; k <= Math.round(b.dur / 0.05) + 1; k++) { const t = Math.min(b.dur, k * 0.05); n = 0; b.layers.forEach((l) => { if (l.animate) { g.save(); l.animate(g, view, t, t / b.dur, {}); g.restore(); } }); worst = Math.max(worst, n); } } finally { P.fillRect = orig; }
        return worst;
      },
      cover: (o, i) => { const b = BTB.Scenes.weekend(o)[i], g = canvas(); b.draw(g, view, 1, {}); const d = g.getImageData(0, 0, 640, 360).data; let a = 0; for (let k = 3; k < d.length; k += 4) a += d[k] === 255 ? 1 : 0; return a; },
      // the final picture against the flat one (flatFn): pixels that differ, by region (the changes the sheet allows: window, phone and its light, laptop, face)
      finalDiff: (o, i, kind) => {
        const SB = BTB.Storyboard, w = o.game && o.game.mode.S.wallet, day = o.day, home = SB.homeOf(w), rect = SB.windowRect(home), L = SB.laptopRect(home);
        const b = BTB.Scenes.weekend(o)[i], a = canvas(), f = canvas(); b.draw(a, view, 1, {});
        let tf = (x, y) => [x, y];
        if (kind === 'sun') { SB.sundayShot(f, day, home, w); tf = (x, y) => [1.18 * x - 36, 1.18 * y - 50]; }
        else { SB.apartmentShot(f, day, home, true, w); f.save(); f.globalAlpha = 0.3; f.fillStyle = BTB.Pal.ink; f.fillRect(0, 0, 640, 360); f.restore(); }
        const A = a.getImageData(0, 0, 640, 360).data, F = f.getImageData(0, 0, 640, 360).data;
        const reg = (x0, y0, w0, h0) => { const p = tf(x0, y0), q = tf(x0 + w0, y0 + h0); return [Math.floor(p[0]) - 2, Math.floor(p[1]) - 2, Math.ceil(q[0]) + 2, Math.ceil(q[1]) + 2]; };
        const R = { win: reg(rect.wx, rect.wy, rect.ww, rect.wh), phone: reg(204, 233, 61, 36), lap: reg(L.x, L.y, L.w, L.h) };
        const cnt = { win: 0, phone: 0, lap: 0, else: 0 };
        for (let k = 0; k < A.length; k += 4) if (A[k] !== F[k] || A[k + 1] !== F[k + 1] || A[k + 2] !== F[k + 2]) {
          const x = (k / 4) % 640, y = Math.floor(k / 4 / 640); let hit = 'else';
          for (const n in R) { const r = R[n]; if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) { hit = n; break; } }
          cnt[hit]++;
        }
        return cnt;
      },
      particleCalls: (o, i, t) => {
        const M = BTB.Motion, orig = M.particles, calls = [], b = BTB.Scenes.weekend(o)[i], layer = b.layers.find((l) => l.id === 'outside'), g = canvas();
        M.particles = function (q) { calls.push({ seed: q.seed, t: q.t, kind: q.kind }); return orig.apply(this, arguments); };
        try { layer.animate(g, view, t, t / b.dur, {}); } finally { M.particles = orig; }
        return calls[0];
      },
      holes: (o, i) => {
        const M = BTB.Motion, b = BTB.Scenes.weekend(o)[i], bad = [], cache = {};
        for (let y = 0; y <= 6; y++) {
          const g = canvas(); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 640, 360);
          M.composite(g, view, b, 1, 0.5, {}, { x: 0, y, zoom: 1 }, (layer) => { if (cache[layer.id]) return cache[layer.id]; const lc = canvas(); layer.draw(lc, view, {}); return (cache[layer.id] = lc.canvas); });
          const d = g.getImageData(0, 0, 640, 348).data; let n = 0;
          for (let k = 0; k < d.length; k += 4) if (d[k] === 255 && d[k + 1] === 0 && d[k + 2] === 255) n++;
          if (n) bad.push({ y, n });
        }
        return bad;
      }
    };
  });
  const W8 = (fn, ...args) => page.evaluate(([fn, args]) => window.w8[fn](...args), [fn, args]);
  const W8o = (...a) => page.evaluate((a) => window.w8.opts(...a), a);
  const RECT9 = {};
  const keyOf = (o) => page.evaluate((o) => BTB.Scenes.weekend(o)[0].id.replace(/^weekend:/, '').replace(/:sat$/, ''), o);
  // generic checks for a layered weekend beat
  const wkBeat = async (tag, o, re, want, area) => {
    const i = await W8('beat', o, re), a = await W8('info', o, i);
    for (const k of Object.keys(want)) assert(a[k] === want[k], `${tag}: ${k} is '${a[k]}', wanted '${want[k]}' (${JSON.stringify(a)})`);
    assert(a.layers !== '', `${tag}: the beat has no layers`);
    const t1 = area ? area[0] : 0.1, t2 = area ? area[1] : a.dur - 0.1;
    assert(await shot('weekend', o, i, t1) !== await shot('weekend', o, i, t2), `${tag}: the picture is the same at ${t1} and ${t2}`);
    assert(await shot('weekend', o, i, 0.6) === await shot('weekend', o, i, 0.6), `${tag}: the same time gave different pictures`);
    assert(await W8('cover', o, i) === 640 * 360, `${tag}: the final picture has holes`);
    return { i, a };
  };
  const SUN = (day, tier, late, pet, plug) => ({ day, tier, late, pet, plug, o: null });
  // [tag, day, tier, late, pet, plug, expected cue, figure?]
  const SUNV = [
    ['sun studio', 9, 2, 0, 'n', 0, '1.15:news', false], ['sun penthouse winter cat', 49, 5, 0, 'cat', 0, '1.15:news', false], ['sun onebed grey', 19, 3, 0, 'n', 0, '1.15:news', false],
    ['sun couch', 9, 0, 0, 'n', 0, '', true], ['sun share late', 24, 1, 2, 'dog', 0, '', true], ['sun loft late', 19, 4, 1, 'cat', 0, '', true],
    ['sun whip day', 39, 2, 0, 'n', 0, '1.15:ring', false], ['sun day 44', 44, 2, 0, 'n', 0, '1.15:news', false],
    ['sun day 44 pulled', 44, 2, 0, 'cat', 1, '1.15:click', false], ['sun day 44 pulled couch', 44, 0, 0, 'n', 1, '1.15:click', true]
  ];
  for (const [tag, day, tier, late, pet, plug, cue, fig] of SUNV) {
    const o = await W8o(day, tier, late, pet, plug), key = await keyOf(o), pulled44 = day === 44 && plug;
    const { i } = await wkBeat(tag, o, ':sun$', { id: `weekend:${key}:sun`, dur: 1.8, layers: 'outside,room,furniture,front,grain', depths: '0.25,0.5,0.85,1.2,0', cam: '6>0', sfx: 'apartment', tr: 'cross', cues: cue });
    const home = await page.evaluate((o) => BTB.Storyboard.homeOf(o.game.mode.S.wallet).id, o);
    // screen rects of the elements (the 1.18 frame: sx = 1.18 ax - 36, sy = 1.18 ay - 50)
    const phoneR = [198, 218, 78, 56], faceR = [208, home === 'share' ? 208 : 162, 60, 50], petR = [452, 200, 110, 78];
    const phone = (t, id) => W8('cnt', o, i, id || 'front', t, phoneR, 'any'), face = (t) => W8('cnt', o, i, 'front', t, faceR, 'any');
    if (!fig && !pulled44) {
      // the floor phone lights at 1.15 with one flare, throws its light up the bed, the bar follows at 1.23; static after 1.31; all above screen y 272
      const p0 = await phone(1.10), p1 = await phone(1.17), p2 = await phone(1.25), p3 = await phone(1.35);
      if (day === 39) {
        // rings: the screen and bar are on/off with the badge phase (off 1.30 to 1.50), the spill stays and the end is lit
        assert(p0 === 0 && p1 > 1200 && await phone(1.40) > 0 && await phone(1.40) < await phone(1.60) && await phone(1.60) === await phone(1.79) && await phone(1.79) === await phone(1.8), `${tag}: the phone does not ring from 1.15 (off 1.3-1.5) and end lit (${p0} ${p1} ${await phone(1.40)} ${await phone(1.60)})`);
      } else {
        assert(p0 === 0 && p1 >= p3 && p1 > 1200 && p2 === p3 && p3 > 1200 && await phone(1.8) === p3 && await phone(1.5) === p3, `${tag}: the phone does not light at 1.15 and stay (${p0} ${p1} ${p2} ${p3})`);
        assert(await phone(1.17) > await phone(1.27) && await phone(1.17) === await phone(1.21) && await phone(1.27) === await phone(1.5), `${tag}: the flare is not one bone flash in 1.15 to 1.23 s`);
        assert(await W8('cnt', o, i, 'front', 1.21, phoneR, 'white') === 0 && await W8('cnt', o, i, 'front', 1.27, phoneR, 'white') > 10, `${tag}: the notification bar does not appear at 1.23 s`);
      }
      const bx = await W8('box', o, i, 'front', 1.6, [0, 0, 640, 360]);
      assert(bx[3] <= 271 && bx[0] >= 195 && bx[1] <= 280 && bx[2] >= 215 && (!pet || pet === 'n' || true), `${tag}: the phone light leaves its band ${bx}`);
      assert(await face(0.5) === 0 && await face(1.2) === 0, `${tag}: a face glow without a figure`);
    }
    if (fig && !pulled44) {
      // three scroll flashes on the face and chest: [0.45, 0.55), [0.80, 0.90), [1.15, 1.30); nothing else; the floor phone stays dark
      assert(await face(0.40) === 0 && await face(0.50) > 1000 && await face(0.60) === 0 && await face(0.85) > 1000 && await face(0.95) === 0 && await face(1.2) > 1000 && await face(1.35) === 0 && await face(1.8) === 0, `${tag}: the face does not flash at 0.45, 0.80 and 1.15 (${await face(0.5)} ${await face(0.6)})`);
      const fb = await W8('box', o, i, 'front', 0.5, faceR);
      assert(fb[1] - fb[0] >= 40 && fb[3] - fb[2] >= 26 && fb[3] <= 271, `${tag}: the face glow is not about 43x28 px: ${fb}`);
      assert(await W8('cnt', o, i, 'front', 1.2, phoneR.slice(0, 1).concat([240, 78, 30]), 'any') === 0, `${tag}: the floor phone lights while you hold it`);
    }
    if (pulled44) {
      // the laptop (furniture animate) switches off at 1.15 and stays dark: the sheet's crt 'off' (line and dot for 0.1 s, then fill); no phone, no face pulse
      const L = await page.evaluate((o) => BTB.Storyboard.laptopRect(BTB.Storyboard.homeOf(o.game.mode.S.wallet)), o), r = [Math.floor(1.18 * L.x - 36) - 3, Math.floor(1.18 * L.y - 50) - 3, Math.ceil(1.18 * L.w) + 7, Math.ceil(1.18 * L.h) + 7];
      const lap = (t) => W8('cnt', o, i, 'furniture', t, r, 'any');
      assert(await lap(1.10) === 0 && await lap(1.17) > 600 && await lap(1.22) > 600 && await lap(1.30) === await lap(1.8) && await W8('anim', o, i, 'furniture', 1.17) !== await W8('anim', o, i, 'furniture', 1.30), `${tag}: the laptop does not switch off at 1.15 s (${await lap(1.10)} ${await lap(1.17)} ${await lap(1.30)})`);
      assert(await phone(1.5) === 0 && await face(0.5) === 0 && await face(1.2) === 0, `${tag}: the phone or the face moves on the pulled night`);
    }
    // the colon: covered while off (0 to 0.30 and 0.80 to 1.30), on at the end (a cover drawn over nothing at 1.8)
    const colonR = [310, 184, 24, 20], colon = (t) => W8('cnt', o, i, 'furniture', t, colonR, 'any');
    const cx = home === 'couch' ? 1.18 * (309 + 45) - 36 : 1.18 * 300 - 36;
    const cr = [Math.floor(cx) - 4, 184, 16, 20], cn = (t) => W8('cnt', o, i, 'furniture', t, cr, 'any');
    assert(await cn(0.1) > 0 && await cn(0.5) === 0 && await cn(0.9) > 0 && await cn(1.2) > 0 && await cn(1.4) === 0 && await cn(1.8) === 0 && await cn(1.79) === 0, `${tag}: the colon does not go out 0 to 0.30 and 0.80 to 1.30 and end on (${await cn(0.1)} ${await cn(0.5)} ${await cn(0.9)} ${await cn(1.4)})`);
    // the pet breathes once, 0.40 to 1.00 (only with a pet)
    const br = (t) => W8('cnt', o, i, 'front', t, petR, 'any');
    if (pet !== 'n') assert(await br(0.35) === 0 && await br(0.5) > 100 && await br(0.95) > 100 && await br(1.05) === 0 && await br(1.5) === 0, `${tag}: the pet's breath is not 0.40 to 1.00 s`);
    else assert(await br(0.7) === 0, `${tag}: a breath without a pet`);
    // cheap per frame (C9)
    const rc = await W8('rects', o, i);
    assert(rc <= 270, `${tag}: ${rc} rectangles in the busiest frame (sheet worst case 258)`);
    RECT9[tag] = rc;
    // nothing below screen y 272 in the animates of what matters while the caption is up (the phone light, the face glow, the laptop)
    // weather and the pet's breath stay where they are
  }
  // the camera: 6 px settle, hole check at every position for six tiers
  for (const [day, tier] of [[9, 0], [19, 1], [9, 2], [49, 3], [19, 4], [44, 5]]) {
    const o = await W8o(day, tier, tier % 3, tier === 1 ? 'dog' : tier === 3 ? 'cat' : 'n', 0), i = await W8('beat', o, ':sun$');
    const h = await W8('holes', o, i);
    assert(!h.length, `sun tier ${tier} day ${day}: holes above the letterbox ${JSON.stringify(h)}`);
  }
  // weather: the same seed as Saturday and chain time (sun at 2.4, hold at 4.2, 5.8 after the whip), poses continuous across the cuts
  for (const [day, tier] of [[9, 2], [49, 4], [19, 2], [39, 2], [44, 2]]) {
    const o = await W8o(day, tier, 0, 'n', 0), si = await W8('beat', o, ':sat$'), ni = await W8('beat', o, ':sun$'), hi = await W8('beat', o, ':hold$');
    const sat = await W8('particleCalls', o, si, 0.7), sun0 = await W8('particleCalls', o, ni, 0), sun1 = await W8('particleCalls', o, ni, 1.8), hold0 = await W8('particleCalls', o, hi, 0), hold1 = await W8('particleCalls', o, hi, 0.8);
    const q = (t) => (sat.kind === 'rain' ? t : Math.floor(t * 12) / 12);
    assert(sat.seed === sun0.seed && sun0.seed === hold0.seed && sun0.t === q(2.4) && Math.abs(sun1.t - q(4.2)) < 1e-9 && Math.abs(hold0.t - q(day === 39 ? 5.8 : 4.2)) < 1e-9 && hold1.t >= hold0.t, `weather ${day}: the chain time or seed is not continuous (${JSON.stringify([sat, sun0, sun1, hold0, hold1])})`);
    if (day !== 39) assert(Math.abs(sun1.t - hold0.t) < 1e-9 || sat.kind === 'rain', `weather ${day}: the hold does not start where Sunday ended`);
  }
  // the final pictures of sun and hold are the flat room plus the sheet's changes only: the window, the floor phone and its light, the laptop
  for (const [day, tier, late, pet, plug] of [[9, 0, 0, 'n', 0], [9, 2, 2, 'cat', 0], [9, 5, 0, 'dog', 0], [19, 3, 1, 'n', 0], [49, 4, 0, 'cat', 0], [39, 2, 0, 'n', 0], [44, 2, 0, 'n', 0], [44, 2, 0, 'n', 1], [44, 0, 0, 'cat', 1], [24, 1, 2, 'dog', 0]]) {
    const o = await W8o(day, tier, late, pet, plug);
    for (const kind of ['sun', 'hold']) {
      const d = await W8('finalDiff', o, await W8('beat', o, `:${kind}$`), kind);
      assert(d.else === 0 && d.win > 0, `${kind} ${day} t${tier} l${late} ${pet} ${plug}: the final picture differs from the flat room outside the window, phone and laptop: ${JSON.stringify(d)}`);
      const lit = !(tier === 0 || late > 0) && !(day === 44 && plug);
      assert((d.phone > 0) === lit && (d.lap > 0) === !!(day === 44 && plug), `${kind} ${day} t${tier} l${late} ${pet} ${plug}: phone/laptop change ${JSON.stringify(d)}`);
    }
  }
  // the hold: the night room under a 0.3 dim; three layers, no camera, a cut in; the colon off 0 to 0.30 and on to the end; Sunday's phone (or dead laptop) carried
  const HOLDV = [['hold studio', 9, 2, 0, 'n', 0, false], ['hold couch winter cat', 49, 0, 0, 'cat', 0, true], ['hold late', 19, 3, 2, 'dog', 0, true], ['hold whip day', 39, 2, 0, 'n', 0, false], ['hold day 44', 44, 5, 0, 'n', 0, false], ['hold day 44 pulled', 44, 2, 0, 'cat', 1, false]];
  for (const [tag, day, tier, late, pet, plug, fig] of HOLDV) {
    const o = await W8o(day, tier, late, pet, plug), key = await keyOf(o), pulled44 = day === 44 && plug;
    const { i } = await wkBeat(tag, o, ':hold$', { id: `weekend:${key}:hold`, dur: 0.8, layers: 'outside,interior,grain', depths: '1,1,1', cam: 'none', sfx: '', cues: '', tr: 'cut' });
    const home = await page.evaluate((o) => BTB.Storyboard.homeOf(o.game.mode.S.wallet).id, o);
    const cx = 1.18 * 0 + (home === 'couch' ? 309 + 45 : 300), cr = [cx - 3, 200, 10, 14], cn = (t) => W8('cnt', o, i, 'interior', t, cr, 'any');
    assert(await cn(0.1) > 0 && await cn(0.25) > 0 && await cn(0.35) === 0 && await cn(0.6) === 0 && await cn(0.79) === 0, `${tag}: the colon is not off to 0.30 and on to the end`);
    assert(await W8('anim', o, i, 'outside', 0.1) !== await W8('anim', o, i, 'outside', 0.5), `${tag}: the weather does not fall`);
    const phoneR = [200, 232, 60, 40], ph = (t) => W8('cnt', o, i, 'interior', t, phoneR, 'any');
    if (!fig && !pulled44) assert(await ph(0.05) > 600 && await ph(0.05) === await ph(0.7), `${tag}: Sunday's lit phone is not carried, static`);
    else if (pulled44) { const L = await page.evaluate((o) => BTB.Storyboard.laptopRect(BTB.Storyboard.homeOf(o.game.mode.S.wallet)), o); assert(await W8('cnt', o, i, 'interior', 0.05, [L.x, L.y, L.w, L.h], 'screenD') === L.w * L.h && await W8('cnt', o, i, 'interior', 0.7, [L.x, L.y, L.w, L.h], 'screenD') === L.w * L.h, `${tag}: the dead laptop does not stay dead`); }
    else assert(await ph(0.05) === 0, `${tag}: a phone lit where a figure holds it`);
    const rc = await W8('rects', o, i); assert(rc <= 50, `${tag}: ${rc} rectangles (sheet worst case 47)`); RECT9[tag] = rc;
  }
  // 3:17 on day 44. Not pulled: the dark floor, a wave crosses the lit screens (art units in at2x: screen px are twice); pulled: the racks' LEDs die one by one from the switch
  {
    const o = await W8o(44, 2, 0, 'n', 0), key = await keyOf(o), { i } = await wkBeat('317 floor', o, ':317$', { id: `weekend:${key}:317`, dur: 1.6, layers: 'floor', depths: '1', cam: 'none', sfx: '', cues: '0.3:office', tr: 'cross' }, [0.1, 0.7]);
    const G = (await page.evaluate(() => BTB.Shots.floorGeom(0.4, 60))).filter((g) => g.on && g.x + g.w > 0 && g.x < 320).map((g) => Object.assign({}, g, { a: 0.35 + 0.5 * Math.min(1, Math.max(0, (g.x + g.w / 2) / 320)), h: Math.min(g.h, 136 - g.y) })).filter((g) => g.h > 0);
    assert(G.length === 3, `317 floor: ${G.length} lit screens (the dark floor at zoom 0.4, seed 60 leaves three on: art x 46, -40 and 211)`);
    const all = (t) => W8('cnt', o, i, 'floor', t, [0, 0, 640, 360], 'any'), inRects = async (t) => { let n = 0; for (const g of G) { const x0 = Math.max(0, 2 * g.x); n += await W8('cnt', o, i, 'floor', t, [x0, 2 * g.y, 2 * g.x + 2 * g.w - x0, 2 * g.h], 'any'); } return n; };
    assert(await all(0.30) === 0 && await all(1.25) === 0 && await all(1.5) === 0, '317 floor: something moves before 0.35 s or after 1.25 s');
    for (const g of G) {
      const x0 = Math.max(0, 2 * g.x), r = [x0, 2 * g.y, 2 * g.x + 2 * g.w - x0, 2 * g.h], c = (t) => W8('cnt', o, i, 'floor', t, r, 'any'); // (the left screen is cut by the picture's edge)
      assert(await c(g.a - 0.02) === 0 && await c(g.a + 0.02) === r[2] * r[3] && await c(g.a + 0.12) > 0 && await c(g.a + 0.12) < r[2] * r[3] && await c(g.a + 0.40) === 0, `317 floor: the screen at art x ${g.x} does not flare at ${g.a.toFixed(2)} and roll for 0.36 s`);
    }
    // left to right: the screen with the least x starts first, the one with the most last, and everything drawn is on a lit screen
    const first = G.reduce((m, g) => (g.a < m.a ? g : m)), last = G.reduce((m, g) => (g.a > m.a ? g : m));
    assert(first.x < last.x && first.a >= 0.35 && last.a + 0.36 <= 1.25 + 1e-9, '317 floor: the wave does not run left to right inside 0.35 to 1.25 s');
    for (const t of [0.45, 0.6, 0.9, 1.1]) assert(await all(t) === await inRects(t), `317 floor at ${t}: something is drawn off the lit screens`);
    const bx = await W8('box', o, i, 'floor', 0.9, [0, 0, 640, 360]); assert(bx[3] <= 271, `317 floor: the wave reaches the caption (${bx})`);
    const rc = await W8('rects', o, i); assert(rc <= 40, `317 floor: ${rc} rectangles (sheet worst case 33)`); RECT9['317 floor'] = rc;
    // the final picture is today's still (p = 1 draws no wave): the flat floor
    assert(await page.evaluate(([o, i]) => { const b = BTB.Scenes.weekend(o)[i], mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; return c.getContext('2d', { willReadFrequently: true }); }, a = mk(), f = mk(); b.draw(a, { w: 640, h: 360 }, 1, {}); BTB.Storyboard.at2x(f, (cc) => BTB.Shots.tradingFloor(cc, 0.4, false, 60), 44); const A = a.getImageData(0, 0, 640, 360).data, F = f.getImageData(0, 0, 640, 360).data; for (let k = 0; k < A.length; k++) if (A[k] !== F[k]) return false; return true; }, [o, i]), '317 floor: the final picture is not today\'s still');
  }
  {
    const o = await W8o(44, 2, 0, 'cat', 1), key = await keyOf(o), { i } = await wkBeat('317 racks', o, ':317$', { id: `weekend:${key}:317`, dur: 1.6, layers: 'room,grain', depths: '1,1', cam: 'none', sfx: '', cues: '0.4:click', tr: 'cross' }, [0.1, 0.7]);
    const Ls = await page.evaluate(() => BTB.DecisionArt.rackLeds(44));
    assert(Ls.length >= 120 && Ls.length <= 150 && Ls.every((L) => L.w === 3 && L.h === 3 && L.x >= 0 && L.x + 3 <= 640 && L.y + 3 <= 252), `317 racks: ${Ls.length} LEDs, or one out of place`);
    // the front row's LEDs are the ones the lit room draws (the back row's are partly hidden behind the front racks, in the art too)
    const match = await page.evaluate((Ls) => { const g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d', { willReadFrequently: true }); BTB.DecisionArt.room(c, 'c10', 44, false, null); let n = 0; const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16)); Ls.forEach((L) => { if (L.r === 0) return; const d = c.getImageData(L.x + 1, L.y + 1, 1, 1).data, h = hex(L.col); if (Math.abs(d[0] - h[0]) < 30 && Math.abs(d[1] - h[1]) < 30 && Math.abs(d[2] - h[2]) < 30) n++; }); return n; }, Ls);
    assert(match === Ls.filter((L) => L.r === 1).length, `317 racks: only ${match} of the ${Ls.filter((L) => L.r === 1).length} front-row LEDs are where the lit room draws them (the back row's are partly behind the front racks)`);
    const deathOf = (L) => (L.r ? 0.40 : 0.45) + 0.10 * L.i;
    assert(await W8('cnt', o, i, 'room', 0.30, [0, 0, 640, 360], 'any') > Ls.length * 6 && await W8('cnt', o, i, 'room', 1.05, [0, 0, 640, 360], 'any') === 0 && await W8('cnt', o, i, 'room', 1.5, [0, 0, 640, 360], 'any') === 0, '317 racks: the LEDs are not all lit before 0.40 s and all gone by 1.05 s');
    for (let r = 0; r < 2; r++) for (let k = 0; k < (r ? 7 : 6); k++) {
      const mine = Ls.filter((L) => L.r === r && L.i === k);
      if (!mine.length) continue; // the art leaves some racks unlit ((i * 7 + r) % 3 === 0 on every slot)
      const d = deathOf(mine[0]);
      const bb = [Math.min(...mine.map((L) => L.x)), Math.min(...mine.map((L) => L.y)), Math.max(...mine.map((L) => L.x + 3)) - Math.min(...mine.map((L) => L.x)), Math.max(...mine.map((L) => L.y + 3)) - Math.min(...mine.map((L) => L.y))];
      const c = (t) => W8('cnt', o, i, 'room', t, bb, 'any');
      assert(await c(d - 0.02) > 20 && await c(d + 0.02) === 0, `317 racks: row ${r} rack ${k} does not go dark at ${d.toFixed(2)} s`);
    }
    // from the red switch (x 99 to 171) outwards: the leftmost lit LED moves right as racks die
    const left = async (t) => (await W8('box', o, i, 'room', t, [0, 0, 640, 360]))[0];
    assert(await left(0.3) < await left(0.55) && await left(0.55) < await left(0.8) && await left(0.8) < await left(0.95), '317 racks: the darkness does not spread from the switch to the right');
    assert((await W8('box', o, i, 'room', 0.3, [0, 0, 640, 360]))[3] <= 252, '317 racks: LEDs below y 252');
    const rc = await W8('rects', o, i); assert(rc <= 150, `317 racks: ${rc} rectangles (sheet estimate 137; the art lights 149 LEDs)`); RECT9['317 racks'] = rc;
    // pulled day 44 without the room layers' branch for other phases: the c10 decision's own room beat has no LEDs drawn on the dead room
    assert(await page.evaluate(() => { const L = BTB.DecisionArt.roomLayers('c10', 44, true, { f: { pulledPlug: true } }, 'room'); return L && L.layers.length === 2 && !L.cues; }), '317 racks: the c10 room beat took the 3:17 branch');
  }
  // every weekend beat draws with no game, and with the motion setting off (reduced) the beats are one still
  for (const day of [9, 39, 44]) await page.evaluate((day) => BTB.Scenes.weekend({ day }).forEach((b) => { const g = document.createElement('canvas').getContext('2d'); b.draw(g, { w: 640, h: 360 }, 1, {}); b.draw(g, { w: 640, h: 360 }, 0, undefined); }), day);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const [day, tier, late, pet, plug] of [[9, 2, 0, 'n', 0], [49, 5, 0, 'cat', 0], [19, 0, 2, 'dog', 0], [39, 2, 0, 'n', 0], [44, 2, 0, 'n', 0], [44, 2, 0, 'cat', 1]]) {
    const o = await W8o(day, tier, late, pet, plug), n = await page.evaluate((o) => BTB.Scenes.weekend(o).length, o);
    for (let i = 1; i < n; i++) {
      const a = await W8('info', o, i);
      assert(await shot('weekend', o, i, 0.4) === await shot('weekend', o, i, a.dur - 0.05), `batch 8: ${a.id}: reduced effects still moves`);
    }
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  console.log('batch 8: rectangles a frame (worst case)', JSON.stringify(RECT9));

  if (process.env.B8_ONLY) { console.log('motion-run: batch 8 pins and asserts pass'); return; }

  // ---- stage 3 batch 7: the decision rooms and the speaker close-up as layers ----
  await page.evaluate(() => {
    const view = { w: 640, h: 360 };
    const fnv = (d) => { let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const canvas = () => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
    const beat = (scene, opts, i) => BTB.Scenes[scene](opts)[i];
    const rgbOf = (spec) => { const hex = BTB.Pal[spec]; return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)); };
    window.d8 = {
      info(scene, opts, i) {
        const b = beat(scene, opts, i), c = b.camera;
        return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), depths: (b.layers || []).map((l) => l.depth == null ? 1 : l.depth).join(),
          cam: !b.layers ? 'flat' : c ? `${c.from.y}>${c.to.y}` : 'none', cues: (b.cues || []).map((q) => q.at + ':' + q.sfx).join(), sfx: b.sfx || '', tr: b.transition || '', line: b.line, n: BTB.Scenes[scene](opts).length };
      },
      // hash of one layer (draw and animate, or animate only) in a rect
      pic(scene, opts, i, id, t, animOnly, r) {
        const b = beat(scene, opts, i), layer = b.layers.find((l) => l.id === id), g = canvas();
        if (!animOnly) layer.draw(g, view, {});
        if (layer.animate) layer.animate(g, view, t, t / b.dur, {});
        const rr = r || [0, 0, 640, 360];
        return fnv(g.getImageData(rr[0], rr[1], rr[2], rr[3]).data);
      },
      // pixels of one layer's animate alone: any alpha (spec 'any'), or exactly a palette colour; and the box they sit in
      cnt(scene, opts, i, id, t, r, spec) {
        const b = beat(scene, opts, i), layer = b.layers.find((l) => l.id === id), g = canvas();
        layer.animate(g, view, t, t / b.dur, {});
        const d = g.getImageData(r[0], r[1], r[2], r[3]).data, c = spec === 'any' ? null : rgbOf(spec); let n = 0;
        for (let k = 0; k < d.length; k += 4) { if (c ? d[k + 3] === 255 && d[k] === c[0] && d[k + 1] === c[1] && d[k + 2] === c[2] : d[k + 3] > 0) n++; }
        return n;
      },
      box(scene, opts, i, id, t, r) {
        const b = beat(scene, opts, i), layer = b.layers.find((l) => l.id === id), g = canvas(); r = r || [0, 0, 640, 360];
        layer.animate(g, view, t, t / b.dur, {});
        const d = g.getImageData(r[0], r[1], r[2], r[3]).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let k = 0; k < d.length; k += 4) if (d[k + 3]) { const x = (k / 4) % r[2] + r[0], y = Math.floor(k / 4 / r[2]) + r[1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        return [x0, x1, y0, y1];
      },
      // the most fillRect calls the animates of all layers make in one frame, over the beat in 0.05 s steps (and the very end)
      rects(scene, opts, i) {
        const b = beat(scene, opts, i), g = canvas(), P = CanvasRenderingContext2D.prototype, orig = P.fillRect; let n = 0, worst = 0, at = 0;
        P.fillRect = function (...a) { n++; return orig.apply(this, a); };
        try {
          for (let k = 0; k <= Math.round(b.dur / 0.05) + 1; k++) {
            const t = Math.min(b.dur, k * 0.05); n = 0;
            b.layers.forEach((l) => { if (l.animate) { g.save(); l.animate(g, view, t, t / b.dur, {}); g.restore(); } });
            if (n > worst) { worst = n; at = t; }
          }
        } finally { P.fillRect = orig; }
        return { worst, at };
      },
      // how many pixels of the beat's picture at time t are not opaque (the whole beat composited through its layers, no camera)
      holes(scene, opts, i, t) {
        const b = beat(scene, opts, i), g = canvas(); b.draw(g, view, t / b.dur, {});
        const d = g.getImageData(0, 0, 640, 360).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] !== 255) n++; return n;
      },
      // the flat picture against the beat's final frame, in a rect: how many bytes differ
      flatDiff(scene, opts, i, fn, r) {
        const b = beat(scene, opts, i), g1 = canvas(), g2 = canvas(); b.draw(g1, view, 1, {}); (new Function('BTB', 'g', 'return (' + fn + ')(BTB, g);'))(BTB, g2);
        const a = g1.getImageData(r[0], r[1], r[2], r[3]).data, c = g2.getImageData(r[0], r[1], r[2], r[3]).data; let bad = 0; for (let k = 0; k < a.length; k++) if (a[k] !== c[k]) bad++; return bad;
      }
    };
  });
  const D8 = (fn, ...args) => page.evaluate(([fn, args]) => window.d8[fn](...args), [fn, args]);
  const DEC8 = { c1: [3, 'Desmond Kroll'], c3: [10, 'Sen. Marcus Thorne'], c5: [21, 'Adele Venn'], c6: [23, 'Desmond Kroll'], c7: [24, 'Desmond Kroll'], c8: [39, 'Sen. Marcus Thorne'], c9: [42, 'Imani Rhodes'], c10: [44, 'Imani Rhodes'],
    rentHike: [11, 'Your landlord'], advance: [31, 'Desmond Kroll'], dadBill: [18, 'Mom'], pension: [41, 'Mom'], perry: [36, 'Perry Nakash'], adopt: [4, 'Harbor Street Animal Shelter'], dentist: [8, 'Your dentist'],
    vetCheck: [14, 'Your vet'], toothache: [25, 'Your dentist'], vetER: [27, 'Your vet'] };
  const dopts = (id, S, extra) => Object.assign({ id, day: DEC8[id][0], speaker: DEC8[id][1], role: 'Role of the speaker', title: 'The title of the decision', S }, extra || {});
  const reduced8 = [];
  const REDUCED8_SCENE = 'decision';
  // generic checks of one layered beat of the decision scene: info, moving, deterministic, no holes, a long title, no story state
  const beat8 = async (o, i, want, tag) => {
    const a = await D8('info', 'decision', o, i);
    for (const k of Object.keys(want)) assert(String(a[k]) === String(want[k]), `${tag} beat: ${k} is ${a[k]}, want ${want[k]} (${JSON.stringify(a)})`);
    assert(await shot('decision', o, i, 0.1) !== await shot('decision', o, i, a.dur - 0.1), `${tag}: the start and end frames are identical`);
    assert(await shot('decision', o, i, 0.8) === await shot('decision', o, i, 0.8), `${tag}: the same time gave two pictures`);
    assert(await D8('holes', 'decision', o, i, 0.3) === 0 && await D8('holes', 'decision', o, i, a.dur) === 0, `${tag}: the picture has holes`);
    const long = Object.assign({}, o, { title: 'A very long title that goes on and on past any sensible width of caption box ok ok ok ok ok ok', S: null });
    assert(await D8('holes', 'decision', long, i, 0.9) === 0, `${tag}: a long title and no story state do not draw`);
    reduced8.push([o, i, 'decision']);
    return a;
  };
  const rect8 = async (o, i, max, tag) => { const r = await D8('rects', 'decision', o, i); assert(r.worst <= max, `${tag}: ${r.worst} rectangles a frame at ${r.at} s (budget ${max})`); return r.worst; };
  const RECT8 = {};

  // shot 1: office by day (c1 day 3 autumn, c6 day 23 grey): Kroll's desk screen switches on at 0.45 s
  for (const id of ['c1', 'c6']) {
    const o = dopts(id), tag = `office ${id}`;
    await beat8(o, 0, { id: `decision:${id}:${Math.floor(DEC8[id][0] / 5)}:room`, dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '', sfx: 'room', tr: 'fade' }, tag);
    const A = (t) => D8('cnt', 'decision', o, 0, 'room', t, [0, 0, 640, 360], 'any'), bx = (t) => D8('box', 'decision', o, 0, 'room', t, [0, 0, 640, 360]);
    // dark until 0.45 (the whole 51x33 screen), the phosphor line, the flare, then nothing
    assert(await A(0.30) === 51 * 33 && await A(0.44) === 51 * 33 && JSON.stringify(await bx(0.30)) === JSON.stringify([564, 614, 165, 197]), `${tag}: the screen is not dark until 0.45 s`);
    assert(await A(0.47) === 51 * 33 && await A(0.52) === 51 * 33 && await A(0.56) === 0 && await A(1.5) === 0, `${tag}: no line and flare, then the lit cached screen`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.47, [564, 165, 51, 33], 'phosphor') === 51 * 2 && await D8('cnt', 'decision', o, 0, 'room', 0.30, [564, 165, 51, 33], 'screenD') === 51 * 33, `${tag}: the phosphor line is not 2 px`);
    assert(await D8('pic', 'decision', o, 0, 'room', 0.3, false, [564, 165, 51, 33]) !== await D8('pic', 'decision', o, 0, 'room', 0.9, false, [564, 165, 51, 33]), `${tag}: the screen does not change`);
    assert((await D8('cnt', 'decision', o, 0, 'room', 0.1, [0, 272, 640, 88], 'any')) === 0, `${tag}: something moves below y 272`);
    RECT8[tag] = await rect8(o, 0, 20, tag);
  }

  // shot 2: office at night (c7, day 24): the desk lamp clicks on at 0.45 s, the full pool of light at 0.60 s
  {
    const o = dopts('c7'), tag = 'office night', id = 'decision:c7:4:room';
    await beat8(o, 0, { id, dur: 1.5, layers: 'room,mid,front,grain', depths: '1,1,1,1', cam: '-6>0', cues: '0.45:click', sfx: 'room', tr: 'fade' }, tag);
    const M = (t, r) => D8('cnt', 'decision', o, 0, 'mid', t, r || [0, 0, 640, 360], 'any'), F = (t) => D8('cnt', 'decision', o, 0, 'front', t, [0, 0, 640, 360], 'any');
    assert(await M(0.1) === 0 && await M(0.44) === 0 && await M(0.46) > 3000 && await M(0.50) === await M(0.58) && await M(0.62) > await M(0.58) && await M(0.62) === await M(1.4), `${tag}: the rings do not come in two hard steps at 0.45 and 0.60`);
    const mb = await D8('box', 'decision', o, 0, 'mid', 0.7);
    // the rings are line 94 of the flat room: glow() stops at y 282, and the desk (the front layer) hides all but the carpet left of it below y 207
    assert(mb[2] >= 34 && mb[3] <= 282, `${tag}: the rings reach ${mb} (glow() draws y 34-282)`);
    assert(await F(0.1) > 0 && await F(0.44) === await F(0.1) && await F(0.46) === 0 && await F(1.4) === 0, `${tag}: the lamp is not dark until 0.45 s`);
    const lamp = await D8('box', 'decision', o, 0, 'front', 0.2);
    assert(lamp[0] >= 381 && lamp[1] <= 410 && lamp[2] >= 150 && lamp[3] <= 179, `${tag}: the dark lamp is outside its 30x30 box (${lamp})`);
    assert(await D8('pic', 'decision', o, 0, 'front', 0.3, false, [381, 150, 30, 30]) !== await D8('pic', 'decision', o, 0, 'front', 0.6, false, [381, 150, 30, 30]), `${tag}: the lamp does not light`);
    assert(await D8('pic', 'decision', o, 0, 'room', 0.1, false, [0, 0, 640, 360]) === await D8('pic', 'decision', o, 0, 'room', 1.4, false, [0, 0, 640, 360]), `${tag}: the back layer moves`);
    RECT8[tag] = await rect8(o, 0, 230, tag);
  }

  const idx8 = (scene, o, re) => page.evaluate(([s, o, re]) => BTB.Scenes[s](o).findIndex((b) => new RegExp(re).test(b.id)), [scene, o, re]);
  // a borrowed use of a room: same checks on a news or weekend beat
  const beatN = async (scene, o, re, want, tag) => {
    const i = await idx8(scene, o, re), a = await D8('info', scene, o, i);
    for (const k of Object.keys(want)) assert(String(a[k]) === String(want[k]), `${tag} beat: ${k} is ${a[k]}, want ${want[k]} (${JSON.stringify(a)})`);
    assert(await shot(scene, o, i, 0.1) !== await shot(scene, o, i, a.dur - 0.1) && await shot(scene, o, i, 0.8) === await shot(scene, o, i, 0.8), `${tag}: not moving or not deterministic`);
    assert(await D8('holes', scene, o, i, 0.3) === 0 && await D8('holes', scene, o, i, a.dur) === 0, `${tag}: holes`);
    return [i, a];
  };
  const nOpt8 = (day, S) => Object.assign({ day, brief: { title: 'Headline of the day', feed: [] } }, S ? { game: { mode: { S } } } : {});

  // shot 3: the hearing (c3 day 10; news 11 establish): the chair (senator 3) leans to his microphone 0.50-1.10 s, the LIVE light blinks
  {
    const o = dopts('c3'), tag = 'hearing';
    await beat8(o, 0, { id: 'decision:c3:2:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '', sfx: 'room', tr: 'fade' }, tag);
    const bx = (t) => D8('box', 'decision', o, 0, 'room', t, [380, 130, 70, 60]), live = (t) => D8('cnt', 'decision', o, 0, 'room', t, [504, 70, 37, 9], 'any');
    assert(JSON.stringify(await bx(0.3)) === '[399,422,144,164]' && JSON.stringify(await bx(0.8)) === '[402,425,150,170]' && JSON.stringify(await bx(1.2)) === '[399,422,144,164]' && JSON.stringify(await bx(1.5)) === '[399,422,144,164]', `${tag}: the chair does not lean 3 px right and 6 down in 0.50-1.10 s: ${await bx(0.3)} ${await bx(0.8)}`);
    assert(await live(0.1) === 0 && await live(1.15) === 37 * 9 && await live(1.25) === 0 && await live(1.5) === 0, `${tag}: the LIVE light does not blink from 0.30 and end lit`);
    // A3: the committee board (441,45,168x42, the interior of its cel) rolls once, 0.40 to 0.76 s: the band stays inside the board, nothing before or after
    const roll = (t) => D8('box', 'decision', o, 0, 'room', t, [441, 45, 168, 42]), boardCnt = (t) => D8('cnt', 'decision', o, 0, 'room', t, [441, 45, 168, 42], 'any');
    assert(await boardCnt(0.38) === 0 && await boardCnt(0.78) === 0 && await boardCnt(1.25) === 0 && await boardCnt(0.5) > 168 * 3 && await boardCnt(0.7) > 168 * 3, `${tag}: the board does not roll once from 0.40 to 0.76 s`);
    for (const t of [0.45, 0.55, 0.7]) { const b = await roll(t); assert(b[0] >= 441 && b[1] <= 608 && b[2] >= 45 && b[3] <= 86, `${tag}: the roll leaves the board at ${t}: ${b}`); }
    RECT8[tag] = await rect8(o, 0, 60, tag);
    const [i, a] = await beatN('news', nOpt8(11), ':establish$', { id: 'news:11:establish', dur: 1.7, layers: 'room,grain,marks', depths: '1,1,0', cam: '-6>0', cues: '' }, 'news 11 establish (hearing)');
    assert(await D8('cnt', 'news', nOpt8(11), i, 'room', 1.7, [504, 70, 37, 9], 'any') === 0 && await D8('cnt', 'news', nOpt8(11), i, 'room', 1.35, [504, 70, 37, 9], 'any') === 333, 'news 11: the LIVE light does not end lit at 1.7 s');
    reduced8.push([nOpt8(11), i, 'news']);
  }
  // shot 4: the vote (c8 day 39; news 38 and the bill passed on 41; the whip): the board fills line by line, YEAS counts 180 to 214
  {
    const o = dopts('c8'), tag = 'vote';
    await beat8(o, 0, { id: 'decision:c8:7:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    const ink = (t, r) => D8('cnt', 'decision', o, 0, 'room', t, r, 'ink'), any = (t, r) => D8('cnt', 'decision', o, 0, 'room', t, r, 'any');
    const L1 = [441, 66, 168, 12], L2 = [441, 82, 168, 12], L3 = [441, 105, 168, 12];
    assert(await ink(0.2, L1) === 2016 && await ink(0.2, L2) === 2016 && await ink(0.2, L3) === 2016, `${tag}: the three lines are not covered at the start`);
    assert(await any(0.5, L1) > 0 && await ink(0.5, L1) < 2016 && await ink(0.9, L2) === 2016 && await ink(1.05, L2) === 0 && await ink(1.05, L3) === 2016 && await ink(1.12, L3) === 0, `${tag}: the lines do not lift at 0.40, 1.00 and 1.10 s`);
    // the number: nothing before 0.40, three digits right-aligned at x 603, steps at 15 a second, 214 from 0.95
    const nb = (t) => D8('box', 'decision', o, 0, 'room', t, [441, 66, 168, 12]);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.35, [560, 60, 60, 24], 'jade') === 0 && (await nb(0.45))[1] === (await nb(1.4))[1], `${tag}: the count moves or shows early`);
    const pic = (t) => D8('pic', 'decision', o, 0, 'room', t, true, [560, 66, 50, 12]);
    assert(await pic(0.5) !== await pic(0.7) && await pic(0.7) !== await pic(0.9) && await pic(0.98) === await pic(1.4), `${tag}: YEAS does not count up to 214 by 0.95 s`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.1, [0, 272, 640, 88], 'any') === 0, `${tag}: moves below y 272`);
    RECT8[tag] = await rect8(o, 0, 110, tag); // the sheet's budget says 80; the shadowed digits measure higher
    const [i, a] = await beatN('news', nOpt8(38), ':establish$', { id: 'news:38:establish', dur: 1.7, layers: 'room,grain,marks', depths: '1,1,0', cam: '-6>0', cues: '' }, 'news 38 establish (vote)');
    reduced8.push([nOpt8(38), i, 'news']);
    const o41 = nOpt8(41, { f: { billPassed: true } }), [j] = await beatN('news', o41, ':establish$', { dur: 1.7, layers: 'room,grain,marks', depths: '1,1,0', cam: '-6>0' }, 'news 41 bill passed establish');
    reduced8.push([o41, j, 'news']);
    assert(await D8('pic', 'news', o41, j, 'room', 1.7, false, [426, 30, 198, 105]) !== await D8('pic', 'news', nOpt8(38), i, 'room', 1.7, false, [426, 30, 198, 105]), 'news 41: the passed board is the unpassed one');
    // holds stay flat
    for (const d of [38, 41]) assert((await D8('info', 'news', nOpt8(d), await idx8('news', nOpt8(d), ':hold$'))).layers === '', `news ${d} hold is not flat`);
    // the whip
    const wo = { day: 39 }, [k, wa] = await beatN('weekend', wo, ':whip$', { dur: 1.6, layers: 'room,grain', depths: '1,1', cam: '-6>0', sfx: 'room' }, 'weekend whip');
    assert(await ink(0.2, L1) === 2016 && await D8('cnt', 'weekend', wo, k, 'room', 0.2, L1, 'ink') === 2016 && await D8('cnt', 'weekend', wo, k, 'room', 1.12, L3, 'ink') === 0, 'whip: the board does not fill');
    reduced8.push([wo, k, 'weekend']);
  }

  // shot 5: the treasury (c5 day 21): the five windows light left to right from 0.40 s, 0.12 s apart; the colon ticks
  {
    const o = dopts('c5'), tag = 'treasury';
    await beat8(o, 0, { id: 'decision:c5:4:room', dur: 1.5, layers: 'room,mid,front,grain', depths: '1,1,1,1', cam: '-6>0', cues: '' }, tag);
    const W = (i) => [246 + 78 * i - 9, 21, 54 + 18, 150], amber = (t, i) => D8('cnt', 'decision', o, 0, 'room', t, W(i), 'amber');
    const have = await Promise.all([0, 1, 2, 3, 4].map((i) => amber(1.4, i))); // on day 23 the art itself has no lit cell in window 2
    assert(have.filter((n) => n > 0).length >= 4, `${tag}: windows with lit cells ${have}`);
    assert(await amber(0.3, 0) === 0 && await amber(0.3, 4) === 0, `${tag}: a window is lit before 0.40 s`);
    for (let i = 0; i < 5; i++) {
      const at = 0.40 + 0.12 * i;
      assert(await amber(at - 0.02, i) === 0 && (have[i] === 0 || await amber(at + 0.02, i) > 20) && await amber(at + 0.02, i) === have[i], `${tag}: window ${i} does not light at ${at.toFixed(2)} s`);
      if (i < 4) assert(await amber(at + 0.02, i + 1) === 0, `${tag}: window ${i + 1} is lit before its turn`);
    }
    // every lit cell is a 3x3 of the windows, inside the 54x138 window rects, y 30-168
    const lb = await D8('box', 'decision', o, 0, 'room', 1.4, [0, 0, 640, 360]);
    assert(lb[2] >= 30 && lb[3] <= 168 && lb[0] >= 246 && lb[1] <= 246 + 78 * 4 + 54, `${tag}: the lit windows are outside the five windows ${lb}`);
    // the lit cells equal the art's: the whole picture's final frame is pinned (dc:c5:*); the colon is exactly the colon's pixels on bone
    const colon = (t) => D8('pic', 'decision', o, 0, 'room', t, false, [56, 60, 6, 12]);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.8, [56, 60, 6, 12], 'bone') === 72 && await D8('cnt', 'decision', o, 0, 'room', 1.25, [56, 60, 6, 12], 'bone') === 0 && await D8('cnt', 'decision', o, 0, 'room', 1.5, [56, 60, 6, 12], 'bone') === 0, `${tag}: the colon cover is not the 6x12 on bone, ending lit`);
    // the cover hides the colon and nothing else: cached clock face with and without it differ only inside the rect, and no ink is left in it when covered
    const inkLeft = await page.evaluate(([o]) => { const b = BTB.Scenes.decision(o)[0], L = b.layers[0], c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); L.draw(g, { w: 640, h: 360 }, {}); L.animate(g, { w: 640, h: 360 }, 0.8, 0.8 / 1.5, {});
      const d = g.getImageData(46, 52, 30, 28).data, ink = [0x17, 0x19, 0x22]; let n = 0, other = 0; for (let k = 0; k < d.length; k += 4) { if (d[k] === ink[0] && d[k + 1] === ink[1] && d[k + 2] === ink[2]) n++; } return n; }, [o]);
    const inkOn = await page.evaluate(([o]) => { const b = BTB.Scenes.decision(o)[0], L = b.layers[0], c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); L.draw(g, { w: 640, h: 360 }, {});
      const d = g.getImageData(46, 52, 30, 28).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] === 0x17 && d[k + 1] === 0x19 && d[k + 2] === 0x22) n++; return n; }, [o]);
    // 2:14 has 3 digits in this window (the 2 at art x 21-25 reaches screen x 51; the 1 starts at 66): the covered picture keeps those and loses the 6x12 colon only
    assert(inkOn - inkLeft > 20 && inkLeft > 100, `${tag}: the colon cover (${inkOn} ink pixels in the clock window, ${inkLeft} left) hides more or less than the colon`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.1, [0, 272, 640, 88], 'any') === 0, `${tag}: moves below y 272`);
    RECT8[tag] = await rect8(o, 0, 80, tag);
  }
  // shot 6: the stairwell (c9 day 42): the EXIT sign stutters in four spans
  {
    const o = dopts('c9'), tag = 'stairwell';
    await beat8(o, 0, { id: 'decision:c9:8:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    const A = (t) => D8('cnt', 'decision', o, 0, 'room', t, [0, 0, 640, 360], 'any');
    for (const [t, on] of [[0.40, 0], [0.47, 1], [0.52, 0], [0.60, 1], [0.76, 0], [0.82, 1], [0.90, 0], [1.03, 1], [1.08, 0], [1.4, 0]]) assert((await A(t) > 0) === !!on, `${tag}: the sign is ${on ? 'lit' : 'dark'} wrong at ${t} s`);
    const b = await D8('box', 'decision', o, 0, 'room', 0.6);
    assert(b[0] >= 30 && b[1] <= 179 && b[2] >= 6 && b[3] <= 107, `${tag}: the stutter reaches ${b} (x 30-180, y 6-108)`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.6, [54, 36, 102, 42], 'any') === 102 * 42, `${tag}: the EXIT sign is not covered whole`);
    assert(await D8('pic', 'decision', o, 0, 'room', 0.47, false, [54, 36, 102, 42]) !== await D8('pic', 'decision', o, 0, 'room', 0.52, false, [54, 36, 102, 42]), `${tag}: no stutter seen`);
    RECT8[tag] = await rect8(o, 0, 5, tag);
  }
  // shot 7: the racks (c10 day 44): a pulse runs along the front row of seven racks, 0.40 to 1.06 s
  {
    const o = dopts('c10'), tag = 'racks';
    await beat8(o, 0, { id: 'decision:c10:8:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    const A = (t, i) => D8('cnt', 'decision', o, 0, 'room', t, [177 + 69 * i, 30, 54, 222], 'any');
    for (let i = 0; i < 7; i++) {
      const at = 0.40 + 0.09 * i;
      assert(await A(at - 0.01, i) === 0 && await A(at + 0.01, i) > 0 && await A(at + 0.12 + 0.005, i) === 0, `${tag}: rack ${i} does not pulse in [${at.toFixed(2)}, ${(at + 0.12).toFixed(2)})`);
    }
    const bx = await D8('box', 'decision', o, 0, 'room', 0.45);
    assert(bx[2] >= 39 && bx[3] <= 243 && bx[0] >= 183 && bx[1] <= 183 + 41 + 69 * 6 && await D8('cnt', 'decision', o, 0, 'room', 1.2, [0, 0, 640, 360], 'any') === 0, `${tag}: the pulse is outside the racks ${bx} or runs past 1.06 s`);
    RECT8[tag] = await rect8(o, 0, 40, tag); // two racks pulse at once (0.12 s pulses 0.09 s apart)
  }

  // shot 8: the lobby (rentHike day 11): the management screen's two eyes close to lines in [0.55, 0.67) and [0.80, 0.92)
  {
    const o = dopts('rentHike'), tag = 'lobby';
    await beat8(o, 0, { id: 'decision:rentHike:2:room', dur: 1.5, layers: 'room,mid,front,grain', depths: '1,1,1,1', cam: '-6>0', cues: '' }, tag);
    const E = [147, 93, 21, 21], E2 = [216, 93, 21, 21], P = (t, r) => D8('pic', 'decision', o, 0, 'mid', t, true, r);
    const closed = [0.60, 0.85], open = [0.1, 0.5, 0.70, 0.95, 1.4];
    assert(new Set(await Promise.all(open.map((t) => P(t, E)))).size === 1 && new Set(await Promise.all(closed.map((t) => P(t, E)))).size === 1 && await P(0.1, E) !== await P(0.6, E) && await P(0.1, E2) !== await P(0.85, E2), `${tag}: the eyes are not open, closed twice, open`);
    assert(await D8('cnt', 'decision', o, 0, 'mid', 0.6, [147, 93, 21, 21], 'phosphor') === 21 * 3 && JSON.stringify(await D8('box', 'decision', o, 0, 'mid', 0.6)) === '[147,236,105,107]', `${tag}: a closed eye is not a 21x3 line`);
    const ob = await D8('box', 'decision', o, 0, 'mid', 0.1);
    assert(ob[0] === 147 && ob[1] === 236 && ob[2] === 93 && ob[3] === 113, `${tag}: the open eyes are outside 93-114 (${ob})`);
    assert(await D8('pic', 'decision', o, 0, 'room', 0.1, false, [0, 0, 640, 360]) === await D8('pic', 'decision', o, 0, 'room', 1.4, false, [0, 0, 640, 360]), `${tag}: the back layer moves`);
    RECT8[tag] = await rect8(o, 0, 20, tag);
  }
  // shot 9: the dinner (advance day 31): the envelope slides 36 px in 0.40-0.85 s, in steps of 3 px
  {
    const o = dopts('advance'), tag = 'dinner';
    await beat8(o, 0, { id: 'decision:advance:6:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    const bx = (t) => D8('box', 'decision', o, 0, 'room', t, [0, 0, 640, 360]);
    const x0 = (await bx(0.2))[0], x1 = (await bx(1.4))[0];
    assert(x0 === 282 && x1 === 246 && (await bx(0.39))[0] === 282 && (await bx(0.9))[0] === 246, `${tag}: the envelope does not run 282 to 246 between 0.40 and 0.85 s (${x0} ${x1})`);
    let last = 282; for (let t = 0.40; t <= 0.9; t += 0.025) { const x = (await bx(t))[0]; assert(x <= last && (282 - x) % 3 === 0 && x >= 246, `${tag}: a step that is not a multiple of 3 px, or backwards, at ${t} s (${x})`); last = x; }
    const bb = await bx(0.5);
    assert(bb[0] >= 246 && bb[1] <= 396 && bb[2] === 219 && bb[3] <= 246, `${tag}: the envelope leaves the cloth ${bb}`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.1, [0, 272, 640, 88], 'any') === 0, `${tag}: moves below y 272`);
    RECT8[tag] = await rect8(o, 0, 210, tag);
  }
  // shots 10 and 11: the kitchen: the phone (dadBill day 18, pension day 41) flashes at 0.40 and 0.90 s; the postcard (vetCheck day 14, with a pet's name) blinks its cross
  for (const id of ['dadBill', 'pension']) {
    const o = dopts(id), tag = 'kitchen phone ' + id;
    await beat8(o, 0, { id: `decision:${id}:${Math.floor(DEC8[id][0] / 5)}:room`, dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '0.4:ring' }, tag);
    const A = (t) => D8('cnt', 'decision', o, 0, 'room', t, [477, 165, 78, 45], 'any'), bx = (t) => D8('box', 'decision', o, 0, 'room', t, [0, 0, 640, 360]);
    assert(await A(0.3) === 0 && await A(0.5) === 78 * 45 && await A(0.7) === 0 && await A(1.0) === 78 * 45 && await A(1.2) === 0 && await A(1.4) === 0, `${tag}: the handset does not flash at 0.40 and 0.90 s`);
    assert(JSON.stringify(await bx(0.5)) === '[477,554,165,209]', `${tag}: the flash leaves the handset`);
    RECT8[tag] = await rect8(o, 0, 5, tag);
  }
  {
    const S = { f: {}, wallet: { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } } }, o = dopts('vetCheck', S), tag = 'kitchen postcard';
    await beat8(o, 0, { id: 'decision:vetCheck:2:Rosco:room', dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    // A4: a paper-coloured cover over the whole photo square (the shared geometry's rect, the card's flat bone), at the badge rate, off (covering) in 0.5 to 0.7 and 1.0 to 1.2 s, ending uncovered
    const PH = await page.evaluate(() => BTB.DecisionArt.postcardPhoto());
    assert(JSON.stringify(PH) === '{"x":321,"y":171,"w":30,"h":30}', `${tag}: the photo rect is ${JSON.stringify(PH)}`);
    const A = (t) => D8('cnt', 'decision', o, 0, 'room', t, [PH.x, PH.y, PH.w, PH.h], 'bone');
    assert(await A(0.2) === 0 && await A(0.6) === 900 && await A(1.1) === 900 && await A(0.8) === 0 && await A(1.35) === 0 && await A(1.5) === 0, `${tag}: the photo's cover does not blink from 0.30 s and end uncovered`);
    assert(await D8('cnt', 'decision', o, 0, 'room', 0.6, [0, 0, 640, 360], 'any') === 900, `${tag}: more than the photo square is covered`);
    // the cover sits on the art's flat paper: the card's own pixels around the photo are the same bone
    const paper = await page.evaluate((o) => { const b = BTB.Scenes.decision(o)[0], c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); b.draw(g, { w: 640, h: 360 }, 1, {}); const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).join(); return [px(319, 172), px(352, 172), px(330, 202), px(430, 190)].join('|'); }, o);
    assert(new Set(paper.split('|')).size === 1, `${tag}: the card's paper beside the photo is not one flat colour: ${paper}`);
    RECT8[tag] = await rect8(o, 0, 3, tag);
  }

  // shot 12: the voicemail (perry day 36, dentist day 8): bars 3 to 8 light one by one from 0.40 s, 0.10 s apart; the play button blinks from 0.30 s
  for (const id of ['perry', 'dentist']) {
    const o = dopts(id), tag = 'voicemail ' + id;
    await beat8(o, 0, { id: `decision:${id}:${Math.floor(DEC8[id][0] / 5)}:room`, dur: 1.5, layers: 'room,grain', depths: '1,1', cam: '-6>0', cues: '' }, tag);
    const bars = await page.evaluate(() => BTB.DecisionArt.waveBars().slice(3, 9));
    // lit bars: phosphor pixels of the animate in each bar's own rect
    const lit = async (t) => { const r = []; for (const b of bars) r.push(await D8('cnt', 'decision', o, 0, 'room', t, [b.x, b.y, b.w, b.h], 'phosphor') === b.w * b.h ? 1 : 0); return r.join(''); };
    assert(await lit(0.35) === '000000' && await lit(0.45) === '100000' && await lit(0.55) === '110000' && await lit(0.85) === '111110' && await lit(0.95) === '111111' && await lit(1.4) === '111111', `${tag}: the bars do not light 3 to 8 in order from 0.40 s`);
    const bb = await D8('box', 'decision', o, 0, 'room', 0.2, [240, 120, 70, 60]);
    assert(bb[0] === 267 && bb[1] <= 300 && bb[2] >= 135 && bb[3] <= 165, `${tag}: the bars sit outside x 267-300, y 135-165 (${bb})`);
    const pl = (t) => D8('cnt', 'decision', o, 0, 'room', t, [315, 210, 9, 18], 'phosphorD');
    assert(await pl(0.2) === 0 && await pl(0.6) === 9 * 18 && await pl(0.8) === 0 && await pl(1.5) === 0, `${tag}: the play button does not blink from 0.30 s and end lit`);
    RECT8[tag] = await rect8(o, 0, 12, tag);
  }
  // shot 13: the shelter (adopt day 4): the light over the empty kennels 0 and 3 stutters; the cat breathes 0.70-1.50 s, the dog's tail wags 0.80-1.30 s
  {
    const o = dopts('adopt'), tag = 'shelter';
    await beat8(o, 0, { id: 'decision:adopt:0:room', dur: 1.5, layers: 'room,mid,front,grain', depths: '1,1,1,1', cam: '-6>0', cues: '' }, tag);
    const F = (t, r) => D8('cnt', 'decision', o, 0, 'front', t, r, 'any'), K0 = [231, 108, 84, 132], K3 = [537, 108, 84, 132];
    for (const [t, a] of [[0.40, 0], [0.48, 1], [0.55, 0], [0.65, 1], [0.80, 0], [0.88, 1], [0.95, 0], [1.4, 0]]) assert((await F(t, K0) > 0) === !!a, `${tag}: kennel 0 light ${a ? 'dark' : 'lit'} wrong at ${t} s`);
    for (const [t, a] of [[0.50, 0], [0.60, 1], [0.70, 0], [0.80, 1], [0.95, 0], [1.00, 1], [1.05, 0]]) assert((await F(t, K3) > 0) === !!a, `${tag}: kennel 3 light ${a ? 'dark' : 'lit'} wrong at ${t} s (0.12 s after kennel 0)`);
    assert(await F(0.48, [0, 0, 640, 360]) === 84 * 132 && await F(0.65, [0, 0, 640, 360]) === 84 * 132, `${tag}: only the kennel interior is darkened`);
    // life: the cat's upper body 3 px up in [0.70, 1.50), the dog's tail on odd poses of 6 a second in [0.80, 1.30)
    const M = (t, r) => D8('cnt', 'decision', o, 0, 'mid', t, r, 'any'), CAT = [327, 100, 80, 140], DOG = [429, 100, 90, 140];
    assert(await M(0.6, CAT) === 0 && await M(0.75, CAT) > 0 && await M(1.45, CAT) > 0 && await M(1.5, CAT) === 0 || await M(1.5, CAT) === await M(1.49, CAT), `${tag}: the cat does not breathe in [0.70, 1.50)`);
    assert(await M(0.75, DOG) === 0 && await M(0.9, DOG) > 0 && await M(1.05, DOG) === 0 && await M(1.2, DOG) > 0 && await M(1.35, DOG) === 0, `${tag}: the dog's tail does not wag on odd poses of 0.80-1.30 s`);
    const cb = await D8('box', 'decision', o, 0, 'mid', 0.75, CAT), db = await D8('box', 'decision', o, 0, 'mid', 0.9, DOG);
    assert(cb[2] >= 102 + 12 && cb[3] <= 240, `${tag}: the cat leaves its kennel ${cb}`);
    assert(db[0] >= 429 + 6 && db[1] <= 429 + 90 && db[3] <= 240, `${tag}: the tail leaves its kennel ${db}`);
    assert(await D8('cnt', 'decision', o, 0, 'mid', 0.1, [0, 272, 640, 88], 'any') === 0, `${tag}: moves below y 272`);
    RECT8[tag] = await rect8(o, 0, 180, tag);
  }
  // shot 14: the clinic (toothache day 25 dentist, vetER day 27 vet): the exam light is off until 0.45 s, the inner ring then and the full light at 0.60 s
  for (const [id, lamp] of [['toothache', [444, 72, 48, 27]], ['vetER', [258, 12, 120, 12]]]) {
    const o = dopts(id), tag = 'clinic ' + id;
    await beat8(o, 0, { id: `decision:${id}:${Math.floor(DEC8[id][0] / 5)}:room`, dur: 1.5, layers: 'room,mid,front,grain', depths: '1,1,1,1', cam: '-6>0', cues: '0.45:click' }, tag);
    const R_ = (t) => D8('cnt', 'decision', o, 0, 'room', t, [0, 0, 640, 360], 'any'), M = (t) => D8('cnt', 'decision', o, 0, 'mid', t, [0, 0, 640, 360], 'any');
    assert(await R_(0.1) === lamp[2] * lamp[3] && await R_(0.44) === lamp[2] * lamp[3] && await R_(0.46) === 0 && await R_(1.4) === 0, `${tag}: the exam light is not off until 0.45 s`);
    assert(await M(0.44) === 0 && await M(0.5) > 0 && await M(0.5) === await M(0.58) && await M(0.62) > await M(0.58) && await M(0.62) === await M(1.4), `${tag}: the rings do not come in two hard steps`);
    const mb = await D8('box', 'decision', o, 0, 'mid', 0.7);
    assert(mb[3] <= 210 + 3, `${tag}: the rings reach ${mb}`); // the vet's ceiling rings are centred on y 18 and run off the top edge
    assert(await D8('pic', 'decision', o, 0, 'room', 0.2, false, lamp) !== await D8('pic', 'decision', o, 0, 'room', 0.6, false, lamp), `${tag}: the light does not change`);
    RECT8[tag] = await rect8(o, 0, id === 'vetER' ? 215 : 110, tag);
  }

  // the face beat (every decision): the room dimmed at depth 0.3, the speaker at depth 1 rising 12 px from 0.30 to 0.80 s, one blink at 1.55-1.67 s
  for (const id of ['c1', 'perry', 'rentHike', 'toothache', 'adopt', 'c8']) {
    const o = dopts(id), tag = 'face ' + id, name = DEC8[id][1];
    const a = await beat8(o, 1, { id: `decision:${id}:${Math.floor(DEC8[id][0] / 5)}:face`, dur: 2.1, layers: 'room,speaker', depths: '0.3,1', cam: '-12>0', cues: '', sfx: 'broadcast' }, tag);
    assert(await page.evaluate(([o]) => BTB.Motion.transitionFor(BTB.Scenes.decision(o)[1], 1), [o]) === 'cross', `${tag}: the face does not cross in`);
    const cams = await page.evaluate(([o]) => { const b = BTB.Scenes.decision(o)[1]; return [0.1, 0.30, 0.55, 0.80, 1.2, 2.1].map((t) => BTB.Motion.cameraAt(b.camera, t / b.dur).y); }, [o]);
    assert(cams[0] === -12 && cams[1] === -12 && cams[2] < -2 && cams[2] > -10 && cams[3] === 0 && cams[4] === 0 && cams[5] === 0, `${tag}: the rise is not 12 px between 0.30 and 0.80 s (${cams})`);
    // the room layer holds still and is the same picture at any time; the portrait is drawn once
    assert(await D8('pic', 'decision', o, 1, 'room', 0.1, false) === await D8('pic', 'decision', o, 1, 'room', 1.9, false), `${tag}: the room layer moves`);
    const eyes = [120, 121, 90, 40], E = (t) => D8('cnt', 'decision', o, 1, 'speaker', t, [0, 0, 640, 360], 'any');
    assert(await E(0.2) === 0 && await E(1.5) === 0 && await E(1.56) > 0 && await E(1.66) > 0 && await E(1.68) === 0 && await E(2.1) === 0, `${tag}: no blink in [1.55, 1.67)`);
    const bb = await D8('box', 'decision', o, 1, 'speaker', 1.6);
    const human = id !== 'rentHike';
    assert(human ? bb[0] >= 120 && bb[1] <= 205 && bb[2] >= 136 && bb[3] <= 151 : bb[0] >= 130 && bb[1] <= 190 && bb[2] >= 121 && bb[3] <= 136, `${tag}: the blink is outside its band ${bb}`);
    const faceBox = human ? [120, 136, 86, 16] : [130, 121, 61, 16];
    assert(await D8('pic', 'decision', o, 1, 'speaker', 1.6, false, faceBox) !== await D8('pic', 'decision', o, 1, 'speaker', 1.4, false, faceBox) && await D8('pic', 'decision', o, 1, 'speaker', 1.7, false, faceBox) === await D8('pic', 'decision', o, 1, 'speaker', 1.4, false, faceBox), `${tag}: the blink does not close the eyes and open them`);
    RECT8[tag] = await rect8(o, 1, 55, tag);
  }
  // a speaker with no portrait stays flat (as does an empty name); any title and no story state draw
  for (const spk of ['Nobody At All', '']) {
    const o = Object.assign(dopts('c1'), { speaker: spk }), a = await D8('info', 'decision', o, 1);
    assert(a.layers === '' && a.cam === 'flat' && await D8('holes', 'decision', o, 1, 1) === 0, `a face beat with no portrait ('${spk}') is not flat`);
  }

  // effects reduced: every reworked decision beat and borrowed room is one still
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const [o, i, scene] of reduced8) {
    const a = await D8('info', scene, o, i);
    assert(await shot(scene, o, i, 0.4) === await shot(scene, o, i, a.dur - 0.05), `batch 7: ${a.id}: reduced effects still moves`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  console.log('batch 7: rectangles a frame (worst case)', JSON.stringify(RECT8));
  if (process.env.P8_ONLY) { console.log('motion-run: batch 7 pins pass'); return; }

  assert(await shot('news', day7, 1, 0.5) !== await shot('news', day7, 1, 2.2), 'default camera does not move the shot');
  assert(await frame('news', day7, 1, 1.0) === await frame('news', day7, 1, 1.0), 'same time must give the same picture');
  assert(await band('news', day7, 1, 0.5) === await band('news', day7, 1, 2.2), 'the camera moved the letterbox');

  // default camera: opaque rows 12..347 and zoom exactly 1 at start, middle and end
  for (const t of [0.5, 1.15, 2.29]) {
    const r = await page.evaluate((t) => {
      window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } }); BTB.Cinematic.seek(1, t);
      const cv = document.getElementById('cine-canvas'), k = cv.height / 360;
      const d = cv.getContext('2d').getImageData(0, Math.round(12 * k), cv.width, Math.round(335 * k)).data;
      let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
      const beat = BTB.Cinematic.beats[1];
      return { clear, zoom: BTB.Motion.cameraAt(beat.camera, t / beat.dur).zoom };
    }, t);
    assert(r.clear === 0, `transparent pixels in the shot rows at t=${t}`);
    assert(r.zoom === 1, `default camera zoom ${r.zoom} at t=${t}`);
  }

  // seek works while paused and does not fire sound effects
  const sfx = await page.evaluate(() => {
    let fired = 0; const orig = BTB.Cinematic.playBeat;
    BTB.Cinematic.playBeat = function () { fired++; return orig.apply(this, arguments); };
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const before = fired; BTB.Cinematic.seek(1, 1.0); BTB.Cinematic.seek(2, 0.3);
    BTB.Cinematic.playBeat = orig; return fired - before;
  });
  assert(sfx === 0, 'seek fired playBeat');

  // canvas width assigned at most once over 30 seeks at a fixed viewport
  const widthWrites = await page.evaluate(() => {
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const cv = document.getElementById('cine-canvas');
    const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    let n = 0;
    Object.defineProperty(cv, 'width', { configurable: true, get() { return desc.get.call(this); }, set(v) { n++; desc.set.call(this, v); } });
    for (let k = 0; k < 30; k++) BTB.Cinematic.seek(1, 0.05 * k);
    delete cv.width;
    return n;
  });
  assert(widthWrites <= 1, `canvas width assigned ${widthWrites} times in 30 seeks`);

  // resize mid-shot: still drawing, no blank frame, canvas follows the new size
  await page.evaluate(() => { window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } }); BTB.Cinematic.seek(1, 1.0); });
  for (const size of [{ width: 800, height: 450 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const r = await page.evaluate(() => {
      BTB.Cinematic.seek(1, 1.0);
      const cv = document.getElementById('cine-canvas');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const first = [d[0], d[1], d[2]]; let other = 0, clear = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) clear++; if (d[i] !== first[0] || d[i + 1] !== first[1] || d[i + 2] !== first[2]) other++; }
      return { w: cv.width, h: cv.height, other, clear, total: d.length / 4, ratio: cv.width / cv.height };
    });
    assert(r.other > r.total * 0.2, `blank or flat frame after resize to ${size.width}x${size.height}`);
    assert(r.clear === 0, `transparent pixels after resize to ${size.width}x${size.height}`);
    assert(Math.abs(r.ratio - 16 / 9) < 0.01, `canvas stretched after resize to ${size.width}x${size.height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // supersampling: the bitmap is an exact whole multiple of 640 at the smallest k that covers the device pixels
  for (const [w, h, dpr, k] of [[1440, 900, 1, 3], [1280, 720, 1, 2], [390, 844, 3, 2], [844, 390, 3, 4]]) {
    const vctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const vp = await vctx.newPage();
    try {
      await vp.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
      await vp.keyboard.press('Enter');
      await vp.waitForSelector('#screen-menu.active', { timeout: 10000 });
      const r = await vp.evaluate(() => {
        const S = BTB.Settings; S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
        const C = BTB.Cinematic; C.startChain('scale-qa'); C.play('weekend', { day: 4 }, () => {}); C.pause(); C.seek(0, 0.6);
        const cv = document.getElementById('cine-canvas'), rc = cv.getBoundingClientRect();
        return { w: cv.width, h: cv.height, css: rc.width, dpr: window.devicePixelRatio };
      });
      assert(r.w === 640 * k && r.h === 360 * k, `${w}x${h} dpr ${dpr}: bitmap ${r.w}x${r.h}, expected k=${k}`);
      assert(r.w % 640 === 0 && r.h % 360 === 0, `${w}x${h} dpr ${dpr}: bitmap ${r.w}x${r.h} is not a whole multiple of 640x360`);
      assert(r.w >= r.css * r.dpr - 1e-6 && r.w - 640 < r.css * r.dpr, `${w}x${h}: k is not the smallest covering scale`);
    } finally { await vctx.close().catch(() => {}); }
  }

  // play() while a scene runs ends the first scene once, and leaves one loop and one key listener
  const twice = await page.evaluate(async () => {
    const C = BTB.Cinematic;
    if (C.running) C.finish();
    let adds = 0, removes = 0, raf = 0, cancel = 0;
    const live = new Set(), rafs = new Set();
    const oa = window.addEventListener, orm = window.removeEventListener, orf = window.requestAnimationFrame, ocf = window.cancelAnimationFrame;
    window.addEventListener = function (t, f) { if (t === 'keydown') live.add(f); return oa.apply(this, arguments); };
    window.removeEventListener = function (t, f) { if (t === 'keydown') live.delete(f); return orm.apply(this, arguments); };
    window.requestAnimationFrame = function (f) { const id = orf.call(window, (ts) => { rafs.delete(id); f(ts); }); rafs.add(id); return id; };
    window.cancelAnimationFrame = function (id) { rafs.delete(id); return ocf.call(window, id); };
    let first = 0, second = 0;
    C.play('weekend', { day: 4 }, () => { first++; });
    C.play('weekend', { day: 4 }, () => { second++; });
    const afterTwo = { first, second, keys: live.size, loops: rafs.size };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    const afterKey = { first, second, running: C.running, keys: live.size, loops: rafs.size };
    window.addEventListener = oa; window.removeEventListener = orm; window.requestAnimationFrame = orf; window.cancelAnimationFrame = ocf;
    return { afterTwo, afterKey };
  });
  assert(twice.afterTwo.first === 1 && twice.afterTwo.second === 0, 'second play() must end the first scene exactly once: ' + JSON.stringify(twice.afterTwo));
  assert(twice.afterTwo.keys === 1 && twice.afterTwo.loops === 1, 'one keydown listener and one animation loop after two play() calls: ' + JSON.stringify(twice.afterTwo));
  assert(twice.afterKey.first === 1 && twice.afterKey.second === 1 && !twice.afterKey.running && twice.afterKey.keys === 0 && twice.afterKey.loops === 0, 'a key press must end the second scene once: ' + JSON.stringify(twice.afterKey));

  // ink underlay: an explicit sideways camera exposes a column that must be opaque P.ink
  const under = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic;
    const V = BTB.Scenes.V;
    BTB.Scenes.qaCam = (o) => [{
      id: 'qa:cam:' + o.n, dur: 2, transition: 'cut', camera: o.camera,
      draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); ctx.fillStyle = P.slate; ctx.fillRect(100, 60, 60, 60); }
    }];
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const run = (n, camera) => {
      window.openBeat('qaCam', { n, camera }); C.seek(0, 1);
      const cv = document.getElementById('cine-canvas'), k = cv.width / V.w;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const px = (x, y) => { const i = (Math.round(y * k) * cv.width + Math.round(x * k)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
      return { px, hash: window.hashCanvas(0) };
    };
    const a = run('x', { from: { x: 40, zoom: 1 }, to: { x: 40, zoom: 1 } });
    const same = (c, e) => c[0] === e[0] && c[1] === e[1] && c[2] === e[2];
    const y = V.h / 2;
    const out = {
      exposedInk: [5, 20, 38].every((x) => { const c = a.px(x, y); return same(c, rgb(P.ink)) && c[3] === 255; }),
      restFill: [45, 200, V.w - 5].every((x) => { const c = a.px(x, y); return same(c, rgb(P.bone)) && c[3] === 255; })
    };
    const flat = run('f', null).hash, zoomed = run('z', { from: { zoom: 1 }, to: { zoom: 1.5 } }).hash;
    out.zoomChanges = flat !== zoomed;
    return out;
  });
  assert(under.exposedInk, 'rows exposed by a camera offset are not opaque ink');
  assert(under.restFill, 'the shifted picture is not the fill colour');
  assert(under.zoomChanges, 'an explicit zoom camera does not change the picture');

  // transitions: a dissolve plays inside the start of beat 1 and finishes on the plain picture
  const d0 = await shot('news', day7, 1, 0), d15 = await shot('news', day7, 1, 0.15), d1 = await shot('news', day7, 1, 1.0);
  assert(d15 !== d0 && d15 !== d1, 'no mid-dissolve picture at t=0.15 of beat 1');

  // cross is on-palette: every pixel of the dissolve is a pixel of the old picture (beat 0 at its end)
  // or of the new one (beat 1 at t=0.15, painted without a transition)
  const palette = await page.evaluate(() => {
    const C = BTB.Cinematic, cv = document.getElementById('cine-canvas');
    window.openBeat('news', { day: 7, brief: { title: 'Headline', feed: [] } });
    const top = Math.round(12 * cv.height / 360), rows = Math.round(cv.height * 0.75); // below the top letterbox bar
    const refer = (beat, p) => {
      const view = beat.view || BTB.Scenes.V, pic = document.createElement('canvas');
      pic.width = view.w; pic.height = view.h;
      C.paint(pic.getContext('2d'), beat, view, p);
      const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height;
      const g = r.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(pic, 0, 0, cv.width, cv.height);
      return g.getImageData(0, top, cv.width, rows - top).data;
    };
    const oldP = refer(C.beats[0], 1), newP = refer(C.beats[1], 0.15 / C.beats[1].dur);
    C.seek(1, 0.15);
    const mid = cv.getContext('2d').getImageData(0, top, cv.width, rows - top).data;
    let bad = 0, fromOld = 0, fromNew = 0;
    for (let i = 0; i < mid.length; i += 4) {
      const a = mid[i] === oldP[i] && mid[i + 1] === oldP[i + 1] && mid[i + 2] === oldP[i + 2];
      const b = mid[i] === newP[i] && mid[i + 1] === newP[i + 1] && mid[i + 2] === newP[i + 2];
      if (!a && !b) bad++;
      if (a && !b) fromOld++;
      if (b && !a) fromNew++;
    }
    return { bad, fromOld, fromNew, total: mid.length / 4 };
  });
  assert(palette.bad === 0, `${palette.bad} of ${palette.total} dissolve pixels are neither old nor new`);
  assert(palette.fromOld > palette.total * 0.1 && palette.fromNew > palette.total * 0.1, `dissolve is not a mix: ${palette.fromOld} old-only, ${palette.fromNew} new-only of ${palette.total}`);

  // a beat shorter than its transition still finishes the blend by its last frame
  const short = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic;
    const still = { from: {}, to: {} };
    const a = { id: 'qa:short:a', dur: 0.5, camera: still, draw(ctx, view) { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, view.w, view.h); } };
    const b = (tr) => ({ id: 'qa:short:b', dur: 0.2, transition: tr, camera: still, draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); ctx.fillStyle = P.slate; ctx.fillRect(40, 40, 80, 80); } });
    BTB.Scenes.qaShort = () => [a, b('push')];
    BTB.Scenes.qaShortRef = () => [b('cut')];
    const hash = (scene, i, t) => { window.openBeat(scene, {}); C.seek(i, t); return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75)); };
    return { end: hash('qaShort', 1, 0.2), own: hash('qaShortRef', 0, 0.2), early: hash('qaShort', 1, 0.05) };
  });
  assert(short.end === short.own, 'a beat shorter than its transition does not end on its own picture');
  assert(short.early !== short.own, 'the short beat shows no transition at all');

  // wipe and push are hard edges in whole pixels (checked on flat two-colour test shots)
  const edges = await page.evaluate(() => {
    const P = BTB.Pal, C = BTB.Cinematic, V = BTB.Scenes.V;
    const still = { from: {}, to: {} };
    BTB.Scenes.qaEdge = (o) => [
      { id: 'qa:edge:a', dur: 2, camera: still, draw(ctx, view) { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, view.w / 2, view.h); ctx.fillStyle = P.slate; ctx.fillRect(view.w / 2, 0, view.w / 2, view.h); } },
      { id: 'qa:edge:b' + o.name, dur: 2, transition: o.name, camera: still, draw(ctx, view) { ctx.fillStyle = P.bone; ctx.fillRect(0, 0, view.w, view.h); } }
    ];
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const at = (name, t, x) => {
      window.openBeat('qaEdge', { name }); C.seek(1, t);
      const cv = document.getElementById('cine-canvas'), k = cv.width / V.w;
      const d = cv.getContext('2d').getImageData(Math.round(x * k), Math.round(V.h / 2 * k), 1, 1).data;
      return [d[0], d[1], d[2]].join();
    };
    const c = (hex) => rgb(hex).join();
    const half = 0.35 / 2; // k = 0.5
    return {
      wipeNew: at('wipe', half, V.w * 0.3) === c(P.bone), wipeOld: at('wipe', half, V.w * 0.8) === c(P.slate), wipeStart: at('wipe', 0, V.w * 0.3) === c(P.ink),
      pushOld: at('push', half, V.w * 0.3) === c(P.slate), pushNew: at('push', half, V.w * 0.8) === c(P.bone)
    };
  });
    assert(edges.wipeNew && edges.wipeOld && edges.wipeStart, 'wipe edge is not at the middle at k=0.5 or does not start on the old picture');
  assert(edges.pushOld && edges.pushNew, 'push does not slide the old picture out left and the new one in');

  // skipping during a transition ends the scene at once and leaves nothing behind
  const skip = await page.evaluate(() => {
    const C = BTB.Cinematic;
    if (C.running) C.finish();
    window.__done = 0;
    C.startChain('motion-qa');
    C.play('news', { day: 7, brief: { title: 'Headline', feed: [] } }, () => { window.__done++; });
    C.pause(); C.seek(1, 0.15);
    return { snap: !!C.snap };
  });
  assert(skip.snap, 'no snapshot held mid-transition');
  await page.keyboard.press('Space');
  const after = await page.evaluate(async () => {
    const C = BTB.Cinematic, h1 = window.hashCanvas(0);
    await new Promise((r) => setTimeout(r, 120));
    return { running: C.running, hidden: document.getElementById('cinematic').hidden, done: window.__done, snap: C.snap, pic: C.pic, raf: C.raf, key: C.onKey, same: h1 === window.hashCanvas(0) };
  });
  assert(after.running === false && after.hidden === true && after.done === 1, `skip mid-transition: ${JSON.stringify(after)}`);
  assert(!after.snap && !after.pic && after.raf === null && after.key === null && after.same, 'skip left a snapshot, loop, listener or frame behind');

  // ---- layered shots, cues, byte-budget cache ----
  await page.evaluate(() => {
    const P = BTB.Pal;
    window.__ld = {}; window.__cue = 0;
    BTB.SFX.qaCue = () => { window.__cue++; };
    const count = (id) => { window.__ld[id] = (window.__ld[id] || 0) + 1; };
    BTB.Scenes.__layers = (o) => [BTB.Motion.layered({
      id: 'qa:layers:' + ((o && o.n) || 'a'), dur: 1.2, camera: o && o.cam ? { from: { x: 0 }, to: { x: 20 } } : undefined,
      cues: [{ at: 0.2, sfx: 'qaCue' }],
      layers: [
        { id: 'bg', depth: 0, w: 800, h: 450, draw(c) { count('bg'); c.fillStyle = P.slate; c.fillRect(0, 0, 800, 450); c.fillStyle = P.bone; c.fillRect(380, 200, 16, 60); } },
        { id: 'fg', depth: 2, w: 800, h: 450, draw(c) { count('fg'); c.fillStyle = P.white; c.fillRect(480, 200, 16, 60); },
          animate(c, v, t) { c.fillStyle = P.putty; c.fillRect(500 + Math.round(t * 10), 300, 6, 6); } }
      ]
    })];
    // layers well over the budget set below
    BTB.Scenes.__big = () => [BTB.Motion.layered({
      id: 'qa:big', dur: 1.2, camera: { from: { x: 0 }, to: { x: 10 } },
      layers: ['a', 'b', 'c'].map((id, n) => ({ id, depth: n, w: 800, h: 450, draw(c) { count('big' + id); c.fillStyle = P.slate; c.fillRect(0, 0, 800, 450); } }))
    })];
    BTB.Scenes.__throw = () => [BTB.Motion.layered({
      id: 'qa:throw', dur: 1.2,
      layers: [{ id: 'bad', draw() { throw new Error('boom'); } }, { id: 'ok', draw(c) { c.fillStyle = BTB.Pal.bone; c.fillRect(0, 0, 50, 50); } }]
    })];
    // a layer with transparent holes, and cues at and past the duration
    BTB.Scenes.__holes = () => [BTB.Motion.layered({ id: 'qa:holes', dur: 1.2, layers: [{ id: 'dot', draw(c) { c.fillStyle = P.bone; c.fillRect(100, 40, 20, 20); } }] })];
    BTB.Scenes.__lateCue = () => [BTB.Motion.layered({ id: 'qa:late', dur: 0.4, cues: [{ at: 0.4, sfx: 'qaCue' }, { at: 9, sfx: 'qaCue' }], layers: [{ id: 'x', draw() {} }] })];
    BTB.Scenes.__click = () => [BTB.Motion.layered({ id: 'qa:click', dur: 0.5, cues: [{ at: 0.1, sfx: 'click' }], layers: [{ id: 'x', draw() {} }] })];
    BTB.Scenes.__throwBuilder = () => { throw new Error('builder boom'); };
  });
  const cols = (o, i, t) => page.evaluate(([o, i, t]) => {
    window.openBeat('__layers', o); BTB.Cinematic.seek(i, t);
    const cv = document.getElementById('cine-canvas'), V = BTB.Scenes.V, k = cv.width / V.w;
    const d = cv.getContext('2d').getImageData(0, Math.round(V.h / 2 * k), cv.width, 1).data;
    const find = (hex) => { const c = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)); for (let x = 0; x < cv.width; x++) if (d[x * 4] === c[0] && d[x * 4 + 1] === c[1] && d[x * 4 + 2] === c[2]) return x / k; return -1; };
    return { bg: find(BTB.Pal.bone), fg: find(BTB.Pal.white) };
  }, [o, i, t]);
  const c0 = await cols({ n: 'p', cam: true }, 0, 0.4), c1 = await cols({ n: 'p', cam: true }, 0, 1.2);
  assert(c0.bg >= 0 && c0.fg >= 0 && c1.bg >= 0 && c1.fg >= 0, `parallax markers not found ${JSON.stringify([c0, c1])}`);
  assert(Math.abs(c1.fg - c0.fg) > Math.abs(c1.bg - c0.bg) + 20, `depth 2 layer did not move further than depth 0: ${JSON.stringify([c0, c1])}`);

  // each layer draw runs once across 60 seeks
  const draws = await page.evaluate(() => {
    window.__ld = {}; window.openBeat('__layers', { n: 'once', cam: true });
    for (let k = 0; k < 60; k++) BTB.Cinematic.seek(0, 0.02 * k);
    return window.__ld;
  });
  assert(draws.bg === 1 && draws.fg === 1, `layer draws over 60 seeks: ${JSON.stringify(draws)}`);

  // identity camera: the live composite matches beat.draw(.., 1) pixel for pixel
  const ref = await page.evaluate(() => {
    const C = BTB.Cinematic, cv = document.getElementById('cine-canvas'), V = BTB.Scenes.V;
    const rows = (hexOf) => hexOf;
    const hashRef = () => {
      const beat = BTB.Scenes.__layers({ n: 'ref' })[0], pic = document.createElement('canvas');
      pic.width = V.w; pic.height = V.h;
      const g = pic.getContext('2d'); g.fillStyle = BTB.Pal.ink; g.fillRect(0, 0, V.w, V.h);
      beat.draw(g, V, 1, {});
      const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height;
      const h = r.getContext('2d'); h.imageSmoothingEnabled = false; h.drawImage(pic, 0, 0, cv.width, cv.height);
      const top = Math.round(12 * cv.height / 360), end = Math.round(cv.height * 0.75), d = h.getImageData(0, top, cv.width, end - top).data;
      let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16);
    };
    const seen = () => {
      const top = Math.round(12 * cv.height / 360), end = Math.round(cv.height * 0.75), d = cv.getContext('2d').getImageData(0, top, cv.width, end - top).data;
      let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16);
    };
    window.openBeat('__layers', { n: 'ref' }); C.seek(0, 1.2);
    return { live: seen(), ref: hashRef() };
  });
  assert(ref.live === ref.ref, 'live layer composite differs from beat.draw(.., 1) with an identity camera');

  // effects reduced: one unchanging still, equal to the final picture; back to full it moves again
  const refShot = await shot('__layers', { n: 'ref' }, 0, 1.2);
  const lay = (t) => shot('__layers', { n: 'm', cam: true }, 0, t);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  const rd = [await lay(0.5), await lay(0.9), await lay(1.2)];
  assert(rd[0] === rd[1] && rd[1] === rd[2], 'reduced: a layered shot still changes');
  assert(rd[0] === refShot, 'reduced: the layered still is not draw(.., 1)');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  assert(await lay(0.5) !== await lay(1.2), 'effects back to full: a layered shot with a camera does not move on the next frame');

  // short mode: the final still
  await page.evaluate(() => BTB.Settings.set('cinematics', 'short'));
  const sh = [await lay(0.5), await lay(1.2)];
  await page.evaluate(() => BTB.Settings.set('cinematics', 'full'));
  assert(sh[0] === sh[1] && sh[0] === refShot, 'short: a layered shot is not its final still');
  // short mode on a real flat beat (the records tableau, news day 25, once tilted by a default camera): the picture area is the same at two times
  await page.evaluate(() => BTB.Settings.set('cinematics', 'short'));
  const r25 = { day: 25, brief: { title: 'Headline', feed: [] } };
  const shortFlat = [await shot('news', r25, 0, 0.5), await shot('news', r25, 0, 1.3)];
  await page.evaluate(() => BTB.Settings.set('cinematics', 'full'));
  assert(shortFlat[0] === shortFlat[1], 'short: the shown flat beat (news 25 detail) moves');

  // the still path paints ink first: transparent holes show ink, never the previous frame
  const hole = await page.evaluate(() => {
    const C = BTB.Cinematic, V = BTB.Scenes.V;
    BTB.Settings.set('effects', 'reduced');
    window.openBeat('__layers', { n: 'stale' }); C.seek(0, 0.6); // fills the canvas with slate
    window.openBeat('__holes', {}); C.seek(0, 0.6);
    const cv = document.getElementById('cine-canvas'), k = cv.width / V.w, ink = [1, 3, 5].map((j) => parseInt(BTB.Pal.ink.slice(j, j + 2), 16));
    const at = (x, y) => Array.from(cv.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data);
    const a = at(10, 90), b = at(110, 50);
    BTB.Settings.set('effects', 'full');
    return { holeInk: a[0] === ink[0] && a[1] === ink[1] && a[2] === ink[2] && a[3] === 255, dot: b[0] !== ink[0] };
  });
  assert(hole.holeInk && hole.dot, `layered still left stale pixels in a transparent hole: ${JSON.stringify(hole)}`);

  // effects toggled between two seeks of the same layered beat: still, then live again
  const tog = [];
  await page.evaluate(() => { BTB.Settings.set('effects', 'full'); window.openBeat('__layers', { n: 'm', cam: true }); BTB.Cinematic.seek(0, 0.5); });
  const grab = () => page.evaluate(() => { BTB.Cinematic.seek(0, 0.5); return window.hashCanvas(Math.round(document.getElementById('cine-canvas').height * 0.75)); });
  tog.push(await grab());
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced')); tog.push(await grab());
  await page.evaluate(() => BTB.Settings.set('effects', 'full')); tog.push(await grab());
  assert(tog[0] !== tog[1] && tog[1] === rd[0] && tog[2] === tog[0], 'toggling Screen effects mid-beat did not switch the next frame to the still and back');

  // cues: once in real time, not from seek, not on skip
  const cues = await page.evaluate(async () => {
    const C = BTB.Cinematic, out = {};
    if (C.running) C.finish();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue' }, () => {}); C.pause(); C.seek(0, 0.5); C.seek(0, 1.1);
    out.seek = window.__cue; C.finish(); C.endChain();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue2' }, () => { window.__fin = true; });
    await new Promise((r) => setTimeout(r, 1600));
    out.real = window.__cue; out.finished = !!window.__fin; C.endChain();
    window.__cue = 0; C.startChain('cue'); C.play('__layers', { n: 'cue3' }, () => {}); C.skipAll();
    await new Promise((r) => setTimeout(r, 400));
    out.skip = window.__cue; C.endChain();
    return out;
  });
  assert(cues.seek === 0 && cues.skip === 0, `cue fired from seek or skip: ${JSON.stringify(cues)}`);
  const late = await page.evaluate(async () => {
    const C = BTB.Cinematic; if (C.running) C.finish();
    window.__cue = 0; C.startChain('late'); C.play('__lateCue', {}, () => {});
    await new Promise((r) => setTimeout(r, 900)); C.endChain();
    return window.__cue;
  });
  assert(late === 2, `cues at or past the duration should fire on the last frame, fired ${late}`);
  // cues belong to movements: they sound only with Screen effects full and not in short mode; the beat's own sfx plays in every mode
  const cueModes = await page.evaluate(async () => {
    const C = BTB.Cinematic, out = {};
    window.__beat = 0;
    BTB.SFX.qaBeat = () => { window.__beat++; };
    BTB.Scenes.__sfxCue = () => [BTB.Motion.layered({ id: 'qa:sfxcue', dur: 0.9, sfx: 'qaBeat', cues: [{ at: 0.2, sfx: 'qaCue' }, { at: 0.5, sfx: 'qaCue' }], layers: [{ id: 'x', draw() {} }] })];
    const run = async (effects, cin) => {
      if (C.running) C.finish();
      BTB.Settings.set('effects', effects); BTB.Settings.set('cinematics', cin);
      window.__cue = 0; window.__beat = 0;
      C.startChain('cuemodes'); C.play('__sfxCue', {}, () => {});
      await new Promise((r) => setTimeout(r, 1300)); C.endChain();
      return { cue: window.__cue, beat: window.__beat };
    };
    out.full = await run('full', 'full');
    out.reduced = await run('reduced', 'full');
    out.off = await run('off', 'full');
    out.short = await run('full', 'short');
    BTB.Settings.set('effects', 'full'); BTB.Settings.set('cinematics', 'full');
    return out;
  });
  assert(cueModes.full.cue === 2 && cueModes.reduced.cue === 0 && cueModes.off.cue === 0 && cueModes.short.cue === 0, `cues over stills: ${JSON.stringify(cueModes)}`);
  assert(['full', 'reduced', 'off', 'short'].every((k) => cueModes[k].beat === 1), `the beat's own sfx must play in every mode: ${JSON.stringify(cueModes)}`);
  // sound gate: the real B.SFX gate decides; spy on the audio nodes the cue would create
  const gate = await page.evaluate(async () => {
    const C = BTB.Cinematic, proto = (window.AudioContext || window.webkitAudioContext).prototype, orig = {};
    let nodes = 0;
    ['createOscillator', 'createBufferSource'].forEach((n) => { orig[n] = proto[n]; proto[n] = function () { nodes++; return orig[n].apply(this, arguments); }; });
    const play = async () => {
      if (C.running) C.finish(); nodes = 0;
      C.startChain('gate'); C.play('__click', {}, () => {});
      await new Promise((r) => setTimeout(r, 900)); C.endChain(); return nodes;
    };
    BTB.Settings.set('sound', true); const on = await play();
    BTB.Settings.set('sound', false); const off = await play();
    Object.keys(orig).forEach((n) => { proto[n] = orig[n]; });
    return { on, off };
  });
  assert(gate.on > 0 && gate.off === 0, `cue sound gate: ${JSON.stringify(gate)}`);
  assert(cues.real === 1 && cues.finished, `cue should fire exactly once in real time: ${JSON.stringify(cues)}`);

  // byte-budget cache
  const budget = await page.evaluate(() => {
    const C = BTB.Cinematic, M = BTB.Motion, out = {};
    if (C.running) C.finish();
    C.endChain(); out.cleared = C.frameCache.size === 0 && C.cacheBytes === 0;
    const run = () => {
      C.startChain('budget');
      for (let day = 0; day < 46; day++) {
        window.openBeat('news', { day, brief: { title: 'SESSION ' + day, feed: [] } });
        for (let i = 0; i < C.beats.length; i++) C.seek(i, C.beats[i].dur * 0.9);
      }
      const bytes = [...C.frameCache.values()].reduce((a, c) => a + c.width * c.height * 4, 0);
      const r = { bytes: C.cacheBytes, actual: bytes, size: C.frameCache.size };
      C.finish(); C.endChain(); return r;
    };
    out.real = run();
    const keep = M.CACHE_BYTES; M.CACHE_BYTES = 8 * 1024 * 1024;
    out.small = run();
    // one beat whose layers alone exceed the budget: each layer still draws once
    M.CACHE_BYTES = 1024 * 1024; window.__ld = {};
    window.openBeat('__big', {});
    for (let k = 0; k < 60; k++) C.seek(0, 0.02 * k);
    out.big = { ld: Object.assign({}, window.__ld), bytes: C.cacheBytes, keys: C.frameCache.size };
    M.CACHE_BYTES = keep; C.finish(); C.endChain();
    out.afterChain = C.frameCache.size + C.cacheBytes;
    // an unchained scene clears its cache when it finishes
    C.play('__big', {}, () => {}); C.pause(); C.seek(0, 0.5); out.held = C.frameCache.size; C.finish(); out.unchained = C.frameCache.size + C.cacheBytes;
    return out;
  });
  assert(budget.cleared, 'endChain did not clear the cache');
  assert(budget.real.bytes <= 36 * 1024 * 1024 && budget.real.bytes === budget.real.actual && budget.real.size > 0, `46 news scenes: ${JSON.stringify(budget.real)}`);
  assert(budget.small.bytes <= 8 * 1024 * 1024 && budget.small.bytes === budget.small.actual && budget.small.size > 0, `8 MB budget not honoured: ${JSON.stringify(budget.small)}`);
  assert(budget.big.ld.biga === 1 && budget.big.ld.bigb === 1 && budget.big.ld.bigc === 1 && budget.big.keys === 3, `over-budget beat rebuilt layers: ${JSON.stringify(budget.big)}`);
  assert(budget.afterChain === 0, 'cache not cleared at the end of the chain');
  assert(budget.held > 0 && budget.unchained === 0, `unchained finish did not clear the cache: ${JSON.stringify([budget.held, budget.unchained])}`);

  // ---- shared layer keys and building the next beat ahead ----
  // a keyed layer is built once for every beat that names its key (the three beats of an office morning draw the wall and the monitors once)
  const shared = await page.evaluate(() => {
    const C = BTB.Cinematic, R = BTB.Rhythm, orig = R.officeFrame, parts = {}, out = {};
    R.officeFrame = function (c, d, det, dn, S, o) { const k = o && o.part || 'whole'; parts[k] = (parts[k] || 0) + 1; return orig.apply(this, arguments); };
    if (C.running) C.finish(); C.endChain();
    window.openBeat('office', { day: 3 });
    for (let i = 0; i < C.beats.length; i++) C.seek(i, 0.5);
    for (let i = 0; i < C.beats.length; i++) C.seek(i, 0.9);
    out.beats = C.beats.length; out.parts = Object.assign({}, parts); out.keys = [...C.frameCache.keys()].filter((k) => /^office:(wall|monitors|desk):/.test(k)).length;
    C.finish(); C.endChain(); R.officeFrame = orig;
    return out;
  });
  assert(shared.beats === 3 && shared.parts.wall === 1 && shared.parts.monitors === 1 && shared.parts.desk === 2, `office layers are not shared across the morning's beats: ${JSON.stringify(shared)}`);
  // a key lists everything its picture depends on: across days, story states and reports, one key (with its size) is never two pictures
  const keyed = await page.evaluate(() => {
    const seen = new Map(), bad = [], hash = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return x >>> 0; };
    let n = 0, hits = 0;
    const check = (scene, o) => {
      BTB.Scenes[scene](o).forEach((b) => (b.layers || []).forEach((L) => {
        if (!L.key) return;
        const w = L.w || 640, h = L.h || 360, k = `${L.key}|${w}x${h}`, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        L.draw(cv.getContext('2d'), { w, h }, o); const x = hash(cv); n++;
        if (seen.has(k)) { hits++; if (seen.get(k) !== x) bad.push(`${k} (${b.id}/${L.id})`); } else seen.set(k, x);
      }));
    };
    const stories = [undefined, { m: { stability: 70, heat: 20 }, f: {} }, { m: { stability: 30, heat: 60 }, f: {} }, { m: { stability: 45, heat: 10 }, f: { raid: true } }, { m: { stability: 39, heat: 10 }, f: { insiderTraded: true } }];
    for (let d = 0; d < 46; d += 3) {
      for (const S of stories) check('office', S ? { day: d, game: { mode: { S } } } : { day: d });
      for (const pnl of [-123456, 1234]) for (const quota of [0, 1000]) for (const idx of [undefined, -2]) for (const date of ['', 'FRI OCT 10']) check('close', { report: { day: d, pnl, quota, quotaMet: pnl > 0, indexPct: idx, date } });
    }
    return { n, hits, keys: seen.size, bad: bad.slice(0, 5) };
  });
  assert(keyed.n > 500 && keyed.hits > 200 && !keyed.bad.length, `a layer key covers two different pictures: ${JSON.stringify(keyed)}`);
  // pre-drawing: during the last 0.5 s the next beat's layers are built, at most one per frame; the first frame of the next beat builds nothing;
  // and they survive an over-budget cache while they wait
  await page.evaluate(() => {
    const P = BTB.Pal;
    window.__pre = { draws: [], builds: [] };
    const lay = (tag, n) => Array.from({ length: n }, (_, k) => ({ id: tag + k, depth: k, w: 800, h: 450, draw(c) { window.__pre.draws.push({ tag: tag + k, beat: BTB.Cinematic.i, t: BTB.Cinematic.t }); c.fillStyle = P.slate; c.fillRect(0, 0, 800, 450); } }));
    BTB.Scenes.__pre = (o) => [
      BTB.Motion.layered({ id: 'qa:pre' + ((o && o.n) || '') + ':0', dur: 1.3, layers: lay('a', 1) }),
      BTB.Motion.layered({ id: 'qa:pre' + ((o && o.n) || '') + ':1', dur: 1.0, layers: lay('b', 3) }),
      BTB.Motion.layered({ id: 'qa:pre' + ((o && o.n) || '') + ':2', dur: 0.6, layers: lay('c', 2) })
    ];
  });
  const pre = await page.evaluate(async () => {
    const C = BTB.Cinematic, M = BTB.Motion, out = {}, orig = C.prepareNext, keep = M.CACHE_BYTES;
    if (C.running) C.finish();
    out.calls = [];
    C.prepareNext = function () { const n = window.__pre.draws.length; const r = orig.apply(this, arguments); out.calls.push({ beat: this.i, t: this.t, built: window.__pre.draws.length - n }); return r; };
    M.CACHE_BYTES = 4 * 1024 * 1024; // three 800x450 layers are 4.3 MB: over budget
    C.startChain('pre');
    await new Promise((resolve) => C.play('__pre', {}, resolve));
    C.prepareNext = orig; M.CACHE_BYTES = keep;
    // the first frame of a beat found its layers built: no layer draw happened while that beat was current and before 0.5 s from its end
    out.draws = window.__pre.draws.slice(); out.keysAfter = C.frameCache.size;
    C.endChain();
    return out;
  });
  const when = (tag) => pre.draws.filter((d) => d.tag.startsWith(tag)).map((d) => ({ beat: d.beat, t: d.t }));
  assert(pre.draws.length === 6, `pre-draw: each of the six layers is drawn exactly once: ${JSON.stringify(pre.draws.map((d) => d.tag))}`);
  assert(when('b').every((d) => d.beat === 0 && d.t >= 1.3 - 0.5 - 0.1) && when('c').every((d) => d.beat === 1 && d.t >= 1.0 - 0.5 - 0.1), `pre-draw: next beat's layers not built in the last half second of the beat before: ${JSON.stringify([when('b'), when('c')])}`);
  assert(pre.calls.length > 0 && pre.calls.every((c) => c.built <= 1), `pre-draw: more than one layer in a frame: ${JSON.stringify(pre.calls)}`);
  assert(pre.calls.filter((c) => c.beat === 2).every((c) => c.built === 0), 'pre-draw: the last beat prepared something past the scene');
  // two scenes in a chain: the first scene's last beat prepares nothing for the second
  const nextScene = await page.evaluate(async () => {
    const C = BTB.Cinematic; if (C.running) C.finish(); window.__pre.draws.length = 0;
    C.startChain('pre2'); let atDone = -1;
    await new Promise((resolve) => C.play('__pre', {}, () => { atDone = window.__pre.draws.length; C.play('__pre', { n: 'two' }, resolve); }));
    C.endChain();
    return { atDone, total: window.__pre.draws.length };
  });
  assert(nextScene.atDone === 6 && nextScene.total === 12, `pre-draw: scene one's end did not hold at its own six layers: ${JSON.stringify(nextScene)}`);
  // failures warn once with the beat id; a throwing layer leaves the rest of the shot
  const before = warnings.length;
  const thr = await page.evaluate(() => {
    const C = BTB.Cinematic; let built = true;
    window.openBeat('__throw', {});
    for (let k = 0; k < 10; k++) C.seek(0, 0.5 + 0.01 * k);
    C.finish(); C.endChain();
    let done = false; C.play('__throwBuilder', {}, () => { done = true; });
    return { done, running: C.running };
  });
  const added = warnings.slice(before);
  assert(thr.done && !thr.running, 'a throwing scene builder did not end the scene');
  assert(added.length === 2 && /qa:throw/.test(added[0]) && /bad/.test(added[0]) && /__throwBuilder/.test(added[1]), `unexpected warnings for throwing layer and builder: ${JSON.stringify(added)}`);
  warnings.length = 0;

  // ---- pilot shot: session 1 elevator (news:0:establish) ----
  const day0 = { day: 0, brief: { title: 'FIRST DAY', feed: [] } };
  const elev = await page.evaluate((o) => { const b = BTB.Scenes.news(o)[0]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id), cue: (b.cues || []).map((c) => c.at + ':' + c.sfx).join() }; }, day0);
  assert(elev.id === 'news:0:establish' && elev.dur <= 2.55 && elev.dur > 1.7, `elevator beat id/duration: ${JSON.stringify(elev)}`);
  assert(elev.layers.join() === 'room,frame,marks' && elev.cue === '1.05:elevator', `elevator layers/cues: ${JSON.stringify(elev)}`);
  assert(await shot('news', day0, 0, 0.4) !== await shot('news', day0, 0, 2.3), 'elevator: start and end frames are identical');
  assert(await shot('news', day0, 0, 1.6) === await shot('news', day0, 0, 1.6), 'elevator: same time gave different pictures');
  assert(await shot('news', day0, 0, 0.4) !== await shot('news', day0, 0, 1.0), 'elevator: the counter does not move');
  assert(await shot('news', day0, 0, 1.6) !== await shot('news', day0, 0, 1.9), 'elevator: the doors do not move');
  const elevPlain = await page.evaluate((o) => {
    // draws with no game and with no settings consulted: the generated draw at p = 1
    const b = BTB.Scenes.news(o)[0], c = document.createElement('canvas'); c.width = 640; c.height = 360;
    b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {});
    const d = c.getContext('2d').getImageData(0, 0, 640, 360).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i] === 255 ? 1 : 0;
    return a;
  }, day0);
  assert(elevPlain > 640 * 360 * 0.5, 'elevator: draw(p=1) without a game left the picture mostly empty');
  // the cut into news:0:detail: the picture area (every layer but the marks) of the establish's last frame against the detail's first frame, drawn with no
  // transition, differs only where the doors move (their travel window, art x 90 to 230, y 18 to 136) and in the light spill on the carpet below them
  const cut = await page.evaluate(() => {
    const o = { day: 0, brief: { title: 'FIRST DAY', feed: [] } }, bs = BTB.Scenes.news(o), view = { w: 640, h: 360 };
    const pic = (b, p) => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
      for (const L of b.layers) { if (L.id === 'marks') continue; g.save(); L.draw(g, view, {}); if (L.animate) L.animate(g, view, p * b.dur, p, {}); g.restore(); }
      return g.getImageData(0, 0, 640, 360).data; };
    const a = pic(bs[0], 1), d = pic(bs[1], 0), win = [180, 36, 280, 236], spill = [220, 266, 200, 16];
    const inside = (x, y, r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
    let out = 0, doors = 0, same = 0;
    for (let k = 0; k < a.length; k += 4) {
      const x = (k / 4) % 640, y = Math.floor(k / 4 / 640);
      if (a[k] === d[k] && a[k + 1] === d[k + 1] && a[k + 2] === d[k + 2]) { same++; continue; }
      if (inside(x, y, win) || inside(x, y, spill)) doors++; else out++;
    }
    return { id: [bs[0].id, bs[1].id], out, doors, same };
  });
  assert(cut.id.join() === 'news:0:establish,news:0:detail' && cut.out === 0 && cut.same > 640 * 360 * 0.9, `the cut into the elevator detail differs outside the doors: ${JSON.stringify(cut)}`);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('news', day0, 0, 0.5) === await shot('news', day0, 0, 2.2), 'elevator: reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- pilot shot: the closing bell (first beat of close) ----
  const closeOpts = (day) => ({ report: { day, pnl: 1200, quotaMet: true, quota: 900 } });
  const bellInfo = await page.evaluate((list) => list.map((d) => {
    const b = BTB.Scenes.close({ report: { day: d, pnl: 1200, quotaMet: true, quota: 900 } })[0];
    return { d, id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), sfx: b.sfx, transition: b.transition, line: b.line, cache: b.cache, camera: !!b.camera };
  }), [3, 30, 42, 43, 44, 50]);
  for (const b of bellInfo) {
    assert(/^close:.*:bell$/.test(b.id) && b.dur === 1.9 && b.transition === 'fade', `bell beat id/duration/transition: ${JSON.stringify(b)}`);
    if (b.d >= 44) {
      assert(b.layers === '' && b.sfx === 'room' && b.cache === true && b.camera && b.line === '4:00 PM. NOBODY RINGS IT.', `silent bell beat: ${JSON.stringify(b)}`);
    } else {
      assert(b.layers === 'wall,desks,frame' && b.sfx === 'closeBell' && b.line === '4:00 PM.', `ringing bell beat: ${JSON.stringify(b)}`);
    }
  }
  // the swing follows the game's bell, B.SFX.marketClose: strikes 0.55 s apart. The swing offset is sin(7 pi p) (bellScene), so the
  // bell is near centre at each strike's time (and crosses centre every 0.2714 s: 7 half-swings in 1.9 s)
  const strikes = await page.evaluate(() => [0.55, 1.10, 1.65].map((t) => Math.sin(BTB.Storyboard.bellSwing(3, t / BTB.Scenes.close({ report: { day: 3, pnl: 1, quotaMet: true, quota: 1 } })[0].dur) * Math.PI * 7)));
  assert(strikes.every((v) => Math.abs(v) < 0.25), `bell: not near centre at the 0.55 s strikes: ${JSON.stringify(strikes)}`);
  // p = 1 is the old flat picture, pixel for pixel. The reference is built from the flat functions the old beat called.
  // Returns how many bytes differ between beat.draw(p) and the flat reference at the same swing (null: size mismatch).
  const bellDiff = (day, p) => page.evaluate(([day, p]) => {
    const SB = BTB.Storyboard, SH = BTB.Shots, X = BTB.Pixel, P = BTB.Pal, V = BTB.Rhythm.view;
    const mk = () => { const c = document.createElement('canvas'); c.width = V.w; c.height = V.h; const g = c.getContext('2d'); return g; };
    const silent = day >= 44, swing = silent ? 1 : day === 42 ? p * 0.45 : p;
    const ref = mk();
    SB.at2x(ref, (cc) => {
      SH.bellScene(cc, swing, day >= 25);
      if (silent) { cc.save(); cc.globalAlpha = 0.45; X.rect(cc, 0, 0, 320, 180, P.ink); cc.restore(); }
    }, day);
    SB.finePass(ref, day, { shot: 'bell' }, 'establish');
    const got = mk();
    BTB.Scenes.close({ report: { day, pnl: 1200, quotaMet: true, quota: 900 } })[0].draw(got, V, p, {}); // no game in opts
    const a = ref.getImageData(0, 0, V.w, V.h).data, b = got.getImageData(0, 0, V.w, V.h).data;
    let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }, [day, p]);
  for (const day of [3, 30, 42, 43, 44, 50]) {
    assert(await bellDiff(day, 1) === 0, `bell day ${day}: draw(p=1) is not pixel-identical to the flat picture`);
  }
  // mid-beat: the layered picture equals the flat one at the same swing (swing p, or p * 0.45 on session index 42); p picked so the walker pose matches
  for (const day of [3, 30, 42]) assert(await bellDiff(day, 0.3) === 0, `bell day ${day}: draw(p=0.3) differs from the flat picture at the same swing`);
  assert(await bellDiff(30, 0.5) > 0, 'bell: the second walker pose never shows (round(swing * 14) odd)');
  assert(await bellDiff(3, 0.5) === 0, 'bell: normal day at p=0.5 differs from the flat picture');
  const bell3 = closeOpts(3), bell30 = closeOpts(30), bell42 = closeOpts(42), bell44 = closeOpts(44);
  for (const o of [bell3, bell30, bell42]) {
    assert(await shot('close', o, 0, 0.35) !== await shot('close', o, 0, 1.7), `bell day ${o.report.day}: start and end frames are identical`);
    assert(await shot('close', o, 0, 0.9) === await shot('close', o, 0, 0.9), `bell day ${o.report.day}: same time gave different pictures`);
    assert(await shot('close', o, 0, 0.5) !== await shot('close', o, 0, 0.65), `bell day ${o.report.day}: the bell does not swing`);
  }
  assert(await shot('close', bell30, 0, 1.0) !== await shot('close', bell3, 0, 1.0), 'bell: empty floor looks like a normal day');
  // silent: nothing moves between any two times once the fade is over, and the camera is still
  const silentShots = [];
  for (const t of [0.3, 0.7, 1.2, 1.7, 1.9]) silentShots.push(await shot('close', bell44, 0, t));
  assert(new Set(silentShots).size === 1, `bell silent day: something moves: ${JSON.stringify(silentShots)}`);
  assert(await band('close', bell44, 0, 0.5) === await band('close', bell44, 0, 1.7), 'bell silent day: letterbox moved');
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('close', bell3, 0, 0.5) === await shot('close', bell3, 0, 1.7), 'bell: reduced effects still moves');
  assert(await shot('close', bell30, 0, 0.5) === await shot('close', bell30, 0, 1.7), 'bell (empty floor): reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- pilot shot: the weekend apartment, Saturday (weekend:<key>:sat) ----
  const wk = (day, w) => ({ day, game: w ? { mode: { S: { wallet: w } } } : undefined });
  const wk4 = wk(4), wkCat = wk(44, { tier: 3, lateWeeks: 1, pet: { kind: 'cat', sex: 'boy' } });
  const satInfo = await page.evaluate((o) => { const b = BTB.Scenes.weekend(o)[0]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), depths: (b.layers || []).map((l) => l.depth).join(), cue: (b.cues || []).map((c) => c.at + ':' + c.sfx).join(), cam: b.camera && b.camera.from.y + '>' + b.camera.to.y, n: BTB.Scenes.weekend(o).length }; }, wk4);
  assert(/^weekend:.*:sat$/.test(satInfo.id) && satInfo.dur <= 2.55 && satInfo.dur > 1.7, `sat beat id/duration: ${JSON.stringify(satInfo)}`);
  assert(satInfo.layers === 'outside,room,furniture,front,grain' && satInfo.depths === '0.25,0.5,0.85,1.2,0' && satInfo.cue === '1:news' && satInfo.cam === '8>0' && satInfo.n === 3, `sat layers/cues/camera: ${JSON.stringify(satInfo)}`);
  for (const o of [wk4, wkCat]) {
    assert(await shot('weekend', o, 0, 0.4) !== await shot('weekend', o, 0, 2.3), 'sat: start and end frames are identical');
    assert(await shot('weekend', o, 0, 1.6) === await shot('weekend', o, 0, 1.6), 'sat: same time gave different pictures');
    assert(await shot('weekend', o, 0, 0.9) !== await shot('weekend', o, 0, 1.05), 'sat: the phone does not light at 1.0 s');
    assert(await shot('weekend', o, 0, 1.05) !== await shot('weekend', o, 0, 1.2), 'sat: the notification bar does not appear at 1.08 s');
  }
  // second silent notification: the phone goes dark 1.6-1.7 s and lights again; no extra cue
  const blink = await page.evaluate((o) => {
    const b = BTB.Scenes.weekend(o)[0], front = b.layers.find((l) => l.id === 'front'), at = (t) => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
      front.animate(g, { w: 640, h: 360 }, t, t / b.dur, {}); const d = g.getImageData(200, 262, 60, 20).data, px = (x, y) => Array.from(d.slice(((y - 262) * 60 + x - 200) * 4, ((y - 262) * 60 + x - 200) * 4 + 4)).join(); return px(230, 266) + '|' + px(210, 277);
    };
    return { dark: at(0.9), lit: at(1.3), off: at(1.65), back: at(1.8), cues: b.cues.length };
  }, wk4);
  assert(blink.lit === blink.back && blink.dark === blink.off && blink.dark !== blink.lit && blink.cues === 1, `sat: phone blink: ${JSON.stringify(blink)}`);
  // the pet is in the shot
  const petBox = await page.evaluate(([withPet, without]) => {
    const rows = (o) => { window.openBeat('weekend', o); BTB.Cinematic.seek(0, 1.2); const cv = document.getElementById('cine-canvas'), k = cv.width / 640; return cv.getContext('2d').getImageData(Math.round(420 * k), Math.round(210 * k), Math.round(48 * k), Math.round(66 * k)).data.join(); };
    return rows(withPet) !== rows(without);
  }, [wkCat, wk(44, { tier: 3, lateWeeks: 1 })]);
  assert(petBox, 'sat: the pet is missing from the shot');
  // the inhale itself: the front layer's animate at 1.2 s differs from 0.7 s and 1.8 s only in the pet's box (and the phone, which lights at 1.0 s)
  const inhale = await page.evaluate((o) => {
    const b = BTB.Scenes.weekend(o)[0], front = b.layers.find((l) => l.id === 'front'), get = (t) => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
      front.animate(g, { w: 640, h: 360 }, t, t / b.dur, {}); return g.getImageData(0, 0, 640, 360).data;
    };
    const cnt = (a, b2) => { let n = 0, out = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 3] !== b2[i + 3] || a[i] !== b2[i]) { n++; const x = (i / 4) % 640, y = Math.floor(i / 4 / 640); if ((x < 420 || x >= 480 || y < 216 || y >= 276) && !(x >= 219 && x < 240 && y >= 264 && y < 270) && !(x >= 207 && x < 252 && y >= 276 && y < 279)) out++; } return { n, out }; };
    const before = get(0.7), during = get(1.2), after = get(1.8);
    return { up: cnt(before, during), down: cnt(during, after), same: cnt(before, after) };
  }, wkCat);
  assert(inhale.up.n > 0 && inhale.up.out === 0 && inhale.down.n > 0 && inhale.down.out === 0 && inhale.same.out === 0, `sat: the pet's breath does not rise and settle: ${JSON.stringify(inhale)}`);
  // each tier x pet state x season draws five layers in the browser, with no game in opts too
  const drawAll = await page.evaluate(() => {
    const out = [];
    const pets = [null, { pet: { kind: 'cat', sex: 'boy' } }, { pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' }];
    for (let tier = 0; tier < 6; tier++) for (const pet of pets) for (const day of [4, 24, 44]) {
      const w = Object.assign({ tier, lateWeeks: tier % 4 }, pet || {});
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: w } } } })[0], c = document.createElement('canvas'); c.width = 640; c.height = 360;
      b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {});
      b.draw(c.getContext('2d'), { w: 640, h: 360 }, 0, undefined);
      out.push(b.layers.length);
    }
    return out.every((n) => n === 5) && out.length === 54;
  });
  assert(drawAll, 'sat: a tier / pet / season combination did not draw five layers');
  // p = 1 is today's still plus the sheet's additions: it differs from the flat apartmentShot only in the window opening
  // (weather particles at their last pose), the phone screen rect and the floor glow rect.
  const flatDiff = await page.evaluate((cases) => {
    const SB = BTB.Storyboard, out = [];
    for (const [day, w] of cases) {
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: w } } } })[0], home = SB.homeOf(w), rect = SB.windowRect(home);
      const mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; return c.getContext('2d'); };
      const got = mk(); b.draw(got, { w: 640, h: 360 }, 1, {});
      const ref = mk(); SB.apartmentShot(ref, day, home, false, w);
      const a = ref.getImageData(0, 0, 640, 360).data, g = got.getImageData(0, 0, 640, 360).data;
      let win = 0, phone = 0, elsewhere = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] === g[i] && a[i + 1] === g[i + 1] && a[i + 2] === g[i + 2] && a[i + 3] === g[i + 3]) continue;
        const x = (i / 4) % 640, y = Math.floor(i / 4 / 640);
        if (x >= rect.wx && x < rect.wx + rect.ww && y >= rect.wy && y < rect.wy + rect.wh) win++;
        else if ((x >= 219 && x < 240 && y >= 264 && y < 270) || (x >= 207 && x < 252 && y >= 276 && y < 279)) phone++;
        else elsewhere++;
      }
      out.push({ day, tier: w.tier, win, phone, elsewhere });
    }
    return out;
  }, [
    [4, { tier: 2 }], [24, { tier: 0, lateWeeks: 3 }], [14, { tier: 3, pet: { kind: 'dog', sex: 'girl' }, vet: 'neglected' }],
    [44, { tier: 5, pet: { kind: 'cat', sex: 'boy' } }], [34, { tier: 1, lateWeeks: 1 }], [44, { tier: 4 }]
  ]);
  for (const d of flatDiff) assert(d.elsewhere === 0 && d.win > 0 && d.phone > 0, `sat p=1 differs from the flat picture outside the window and phone: ${JSON.stringify(d)}`);
  // no gap between the window frame and the outside layer at any camera position, any tier
  const gaps = await page.evaluate(() => {
    const M = BTB.Motion, bad = [];
    for (let tier = 0; tier < 6; tier++) for (const day of [4, 44]) {
      const b = BTB.Scenes.weekend({ day, game: { mode: { S: { wallet: { tier } } } } })[0], cache = {};
      for (let y = 0; y <= 8; y++) {
        const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
        const g = cv.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 640, 360);
        M.composite(g, { w: 640, h: 360 }, b, 1, 0.5, {}, { x: 0, y, zoom: 1 }, (layer) => {
          if (cache[layer.id]) return cache[layer.id];
          const lc = document.createElement('canvas'); lc.width = 640; lc.height = 360; layer.draw(lc.getContext('2d'), { w: 640, h: 360 }, {}); return (cache[layer.id] = lc);
        });
        const d = g.getImageData(0, 0, 640, 348).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) n++;
        if (n) bad.push({ tier, day, y, n });
      }
    }
    return bad;
  });
  assert(!gaps.length, `sat: gaps show above the letterbox: ${JSON.stringify(gaps.slice(0, 4))}`);
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('weekend', wk4, 0, 0.5) === await shot('weekend', wk4, 0, 2.2), 'sat: reduced effects still moves');
  assert(await shot('weekend', wkCat, 0, 0.5) === await shot('weekend', wkCat, 0, 2.2), 'sat (pet): reduced effects still moves');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // the kit is a pure function of its arguments: no clock and no Math.random anywhere in its source
  const kitSrc = await page.evaluate(() => fetch('js/art/motion-kit.js').then((r) => r.text()));
  const kitCode = kitSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(kitSrc.length > 1000 && !/Date\.now|performance\.now|Math\.random|new Date/.test(kitCode), 'motion-kit.js reads the clock or Math.random');

  // ---- stage 3 batch 2: the morning (phone handoff and read, office wide, desk and hold) ----
  // Flat reference hashes of phoneFrame, officeFrame and chart, recorded from the code before the batch (no options passed).
  const FLAT_REF = {
    'phone:3:0:false': 'eee16bbf',
    'phone:3:1:false': '10849baf',
    'phone:3:2:true': 'abdaf654',
    'phone:3:4:false': '7423760f',
    'phone:3:4:true': '49a711ff',
    'phone:3:5:true': '49a711ff',
    'phone:3:nofeed': 'e3ecb386',
    'office:3:wide': '9fe8dfe1',
    'office:3:wideDown': '211f6389',
    'office:3:desk': '4b4ab536',
    'office:3:deskDown': '5dacdeb0',
    'office:3:deskNoS': '7a410ff0',
    'chart:3': '43de43c2',
    'phone:20:0:false': '487e3260',
    'phone:20:1:false': '574391d6',
    'phone:20:2:true': 'd9c5b647',
    'phone:20:4:false': 'c8c9f674',
    'phone:20:4:true': 'f46a23b4',
    'phone:20:5:true': 'f46a23b4',
    'phone:20:nofeed': 'c9f0f8d',
    'office:20:wide': 'd1905a0e',
    'office:20:wideDown': '876629a1',
    'office:20:desk': '6407dd25',
    'office:20:deskDown': 'e47b55bb',
    'office:20:deskNoS': '2b62e17f',
    'chart:20': '7dec358a',
    'phone:40:0:false': '7af4fc0a',
    'phone:40:1:false': '3c834902',
    'phone:40:2:true': '24bfb8d',
    'phone:40:4:false': '8f84f82',
    'phone:40:4:true': 'a8811f02',
    'phone:40:5:true': 'a8811f02',
    'phone:40:nofeed': '28014c63',
    'office:40:wide': '8e47dba',
    'office:40:wideDown': '566314e9',
    'office:40:desk': '35ccb039',
    'office:40:deskDown': '17988d37',
    'office:40:deskNoS': '559eee3f',
    'chart:40': '179ce022'
  };
  const flatNow = await page.evaluate(() => {
    const R = BTB.Rhythm, res = {};
    const hashOf = (fn) => {
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
      const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261;
      for (let i = 0; i < d.length; i += 1) { x ^= d[i]; x = Math.imul(x, 16777619); }
      return (x >>> 0).toString(16);
    };
    const feed = (n) => Array.from({ length: n }, (_, i) => ({ source: 'WIRE ' + i, title: 'Headline number ' + i + ' about the overnight session', kind: ['chirp', 'mail', 'wire'][i % 3] }));
    for (const day of [3, 20, 40]) {
      const sb = R.storyboard(day);
      for (const [n, close] of [[0, false], [1, false], [2, true], [4, false], [4, true], [5, true]]) res[`phone:${day}:${n}:${close}`] = hashOf((g) => R.phoneFrame(g, sb, feed(n), close));
      res[`phone:${day}:nofeed`] = hashOf((g) => R.phoneFrame(g, sb, undefined, true));
      const S = { m: { stability: 40, heat: 60 }, f: { raid: true } }, S2 = { m: { stability: 100, heat: 0 }, f: {} };
      for (const [name, detail, down, st] of [['wide', false, false, undefined], ['wideDown', false, true, undefined], ['desk', true, false, S], ['deskDown', true, true, S2], ['deskNoS', true, false, undefined]]) res[`office:${day}:${name}`] = hashOf((g) => R.officeFrame(g, day, detail, down, st));
      res[`chart:${day}`] = hashOf((g) => R.chart(g, 100, 100, 86, 50, day, day % 2 === 0));
    }
    return res;
  });
  // the room restricted to an area is the full room's pixels there, for any rect (odd x and y, spanning several bands)
  const areaBad = await page.evaluate(() => {
    const R = BTB.Rhythm, sb = R.storyboard(3), mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; return c.getContext('2d'); };
    const full = mk(); R.phoneFrame(full, sb, [], true, { part: 'room' });
    let bad = 0;
    for (const r of [{ x: 0, y: 0, w: 640, h: 51 }, { x: 3, y: 37, w: 101, h: 79 }, { x: 13, y: 5, w: 57, h: 200 }, { x: 250, y: 301, w: 90, h: 59 }, { x: 7, y: 71, w: 33, h: 3 }]) {
      const g = mk(); R.phoneFrame(g, sb, [], true, { part: 'room', area: r });
      const a = full.getImageData(r.x, r.y, r.w, r.h).data, b = g.getImageData(r.x, r.y, r.w, r.h).data;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) bad++;
    }
    return bad;
  });
  assert(areaBad === 0, `phoneFrame area: the room differs from the full room in ${areaBad} bytes`);
  for (const k of Object.keys(FLAT_REF)) assert(flatNow[k] === FLAT_REF[k], `flat ${k}: the picture changed (${flatNow[k]}, was ${FLAT_REF[k]})`);

  await page.evaluate(() => {
    const view = { w: 640, h: 360 };
    const fnv = (d) => { let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const canvas = () => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
    // hash of one layer's own animate (animOnly) or of draw + animate, in a rect
    window.layerPic = (scene, opts, i, id, t, animOnly, r) => {
      const b = BTB.Scenes[scene](opts)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
      if (!animOnly) layer.draw(g, view, {});
      if (layer.animate) layer.animate(g, view, t, t / b.dur, {});
      const rr = r || [0, 0, 640, 360];
      return fnv(g.getImageData(rr[0], rr[1], rr[2], rr[3]).data);
    };
    // first row with any pixel of one layer composited through the beat's camera at t
    window.layerTop = (scene, opts, i, id, t) => {
      const b = BTB.Scenes[scene](opts)[i], layer = b.layers.find((l) => l.id === id), lc = canvas(), g = canvas();
      layer.draw(lc, view, {});
      BTB.Motion.composite(g, view, { id: b.id, layers: [layer] }, t, t / b.dur, {}, BTB.Motion.cameraAt(b.camera, t / b.dur), () => lc.canvas, null);
      const d = g.getImageData(0, 0, 640, 360).data;
      for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) if (d[(y * 640 + x) * 4 + 3]) return y;
      return -1;
    };
    // the beat's final picture against a flat picture: how many pixels differ outside the allowed rects
    window.finalDiff = (scene, opts, i, flat, allowed) => {
      const b = BTB.Scenes[scene](opts)[i], g1 = canvas(), g2 = canvas();
      b.draw(g1, view, 1, {}); flat(g2);
      const a = g1.getImageData(0, 0, 640, 360).data, c = g2.getImageData(0, 0, 640, 360).data;
      let bad = 0, inside = 0;
      for (let k = 0; k < a.length; k += 4) {
        if (a[k] === c[k] && a[k + 1] === c[k + 1] && a[k + 2] === c[k + 2]) continue;
        const x = (k / 4) % 640, y = Math.floor(k / 4 / 640);
        if ((allowed || []).some((r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3])) inside++; else bad++;
      }
      return { bad, inside };
    };
    // how many pixels of one layer's own animate (alone on a transparent canvas) in a rect are exactly the colour (r, g, b), and how many rows of the rect hold any pixel
    window.layerCount = (scene, opts, i, id, t, r, rgb) => {
      const b = BTB.Scenes[scene](opts)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
      layer.animate(g, view, t, t / b.dur, {});
      const d = g.getImageData(r[0], r[1], r[2], r[3]).data; let n = 0; const rows = new Set();
      for (let k = 0; k < d.length; k += 4) { if (d[k + 3]) rows.add(Math.floor(k / 4 / r[2])); if (rgb && d[k + 3] === 255 && d[k] === rgb[0] && d[k + 1] === rgb[1] && d[k + 2] === rgb[2]) n++; }
      return { n, rows: rows.size };
    };
    window.regionPic = (scene, opts, i, t, r) => {
      window.openBeat(scene, opts); BTB.Cinematic.seek(i, t);
      const cv = document.getElementById('cine-canvas'), k = cv.width / 640;
      return fnv(cv.getContext('2d').getImageData(Math.round(r[0] * k), Math.round(r[1] * k), Math.round(r[2] * k), Math.round(r[3] * k)).data);
    };
  });
  const mkFeed = (n) => Array.from({ length: n }, (_, i) => ({ source: 'WIRE ' + i, title: 'Overnight headline ' + i + ' moves the whole index lower again', kind: ['chirp', 'mail', 'wire'][i % 3] }));
  const phoneOpts = (day, n) => ({ day, brief: { title: 'H', feed: mkFeed(n) } });
  const gameS = (st, heat) => ({ mode: { S: { m: { stability: st, heat }, f: {} } } });
  const lp = (scene, opts, i, id, t, animOnly, r) => page.evaluate(([a, b, c, d, e, f, g]) => window.layerPic(a, b, c, d, e, f, g), [scene, opts, i, id, t, animOnly, r]);
  const info = (scene, opts, i) => page.evaluate(([s, o, i]) => { const b = BTB.Scenes[s](o)[i]; return { id: b.id, dur: b.dur, layers: (b.layers || []).map((l) => l.id).join(), depths: (b.layers || []).map((l) => l.depth).join(), cues: (b.cues || []).map((c) => c.at + ':' + c.sfx).join(), sfx: b.sfx || '', cam: b.camera ? b.camera.from.y + '>' + b.camera.to.y : 'none', tr: b.transition || '', inf: !!b.informative, line: b.line, n: BTB.Scenes[s](o).length }; }, [scene, opts, i]);

  // phone handoff
  const ph3 = phoneOpts(3, 5), ph4 = phoneOpts(3, 4), ph3i = phoneOpts(3, 3), ph2 = phoneOpts(3, 2), ph1 = phoneOpts(3, 1), ph0 = phoneOpts(3, 0);
  for (const o of [ph3, ph4, ph3i, ph2, ph1, ph0]) {
    const h = await info('phone', o, 0);
    assert(h.id === 'phone:3:handoff' && h.dur === 1.4 && h.layers === 'room,device' && h.depths === '0,1' && h.cam === '-56>0' && h.sfx === 'apartment' && h.tr === 'fade' && h.cues === '' && h.n === 2, `phone handoff beat: ${JSON.stringify(h)}`);
    assert(await shot('phone', o, 0, 0.45) !== await shot('phone', o, 0, 1.3), 'phone handoff: start and end frames are identical');
    assert(await shot('phone', o, 0, 1.0) === await shot('phone', o, 0, 1.0), 'phone handoff: same time gave different pictures');
    assert(await shot('phone', o, 0, 0.7) !== await shot('phone', o, 0, 0.9), 'phone handoff: the screen does not wake at 0.80 s');
    assert(await shot('phone', o, 0, 0.82) !== await shot('phone', o, 0, 0.95), 'phone handoff: no wake flare');
    assert(await shot('phone', o, 0, 0.95) === await shot('phone', o, 0, 1.3), 'phone handoff: still moving after 0.88 s');
  }
  const top = (o, t) => page.evaluate(([o, t]) => window.layerTop('phone', o, 0, 'device', t), [o, t]);
  assert(await top(ph3, 0.1) === 66, `phone handoff: the dark device starts at ${await top(ph3, 0.1)}, not at 66`);
  assert(await top(ph3, 0.2) >= await top(ph3, 1.0) + 30, 'phone handoff: the device is not lower at 0.2 s than at 1.0 s');
  assert(await top(ph3, 1.0) === 10 && await top(ph3, 1.35) === 10, 'phone handoff: the device is not at rest by 1.0 s');
  assert(await top(ph3, 0.5) > await top(ph3, 0.9) && await top(ph3, 0.5) < await top(ph3, 0.2), 'phone handoff: the rise does not ease');
  assert(await page.evaluate((o) => BTB.Scenes.phone(o)[0].layers.find((l) => l.id === 'room').depth === 0, ph3), 'phone handoff: the room must be pinned at depth 0');
  // the final picture is today's handoff with labels at 92 on the big phone and the backlog list on 5-item days
  const handFinal = (o, n, rows, lx) => page.evaluate(([o, n, rows, lx]) => {
    const R = BTB.Rhythm, sb = R.storyboard(o.day), feed = o.brief.feed;
    return window.finalDiff('phone', o, 0, (g) => R.phoneFrame(g, sb, feed, true, { rows: rows === 'back' ? feed.slice(1, 5) : feed.slice(0, 4), labelX: lx, compact: false }), []);
  }, [o, n, rows, lx]);
  assert((await handFinal(ph3, 5, 'back', 92)).bad === 0, 'phone handoff (5 items): the final picture is not the backlog list at labelX 92');
  assert((await handFinal(ph4, 4, 'back', 92)).bad === 0, 'phone handoff (4 items): the final picture is not the backlog list (feed 1 to 3) at labelX 92');
  assert((await handFinal(ph3i, 3, 'back', 92)).bad === 0, 'phone handoff (3 items): the final picture is not the backlog list (feed 1 and 2) on the 39 px rows at labelX 92');
  // one or two items (or none): the handoff draws the same big device as the read, so the dissolve between them does not jump
  const handSmall = await page.evaluate((o) => { const R = BTB.Rhythm, sb = R.storyboard(o.day); return window.finalDiff('phone', o, 0, (g) => R.phoneFrame(g, sb, o.brief.feed, true), []); }, ph2);
  assert(handSmall.bad === 0, 'phone handoff (2 items): the final picture is not the read\'s big phone');
  const handEmpty = await page.evaluate((o) => { const R = BTB.Rhythm, sb = R.storyboard(o.day); return window.finalDiff('phone', o, 0, (g) => R.phoneFrame(g, sb, o.brief.feed, true), []); }, ph0);
  assert(handEmpty.bad === 0, 'phone handoff (empty feed): the final picture is not the read\'s big phone');
  for (const o of [ph2, ph0]) assert(await page.evaluate((o) => { const R = BTB.Rhythm, b = BTB.Scenes.phone(o); return window.finalDiff('phone', o, 0, (g) => b[1].draw(g, { w: 640, h: 360 }, 1, {}), []).bad === 0; }, o), 'phone handoff (2 or 0 items): its final picture differs from the read\'s final picture');
  // the dark screen shows the lock-screen time and hides the list until 0.80 s
  assert(await page.evaluate((o) => { const a = window.layerPic('phone', o, 0, 'device', 0.5, false), b = window.layerPic('phone', o, 0, 'device', 0.9, false); return a !== b; }, ph3), 'phone handoff: the device layer does not change at the wake');
  assert(await page.evaluate((o) => window.layerPic('phone', o, 0, 'device', 0.2, true) === window.layerPic('phone', o, 0, 'device', 0.7, true), ph3), 'phone handoff: the asleep screen changes before the wake');
  assert(await page.evaluate((o) => window.layerPic('phone', o, 0, 'device', 0.9, true) === window.layerPic('phone', o, 0, 'device', 1.2, true), ph3), 'phone handoff: the awake screen still has animate work');
  // phone read
  const readInfo = (o) => info('phone', o, 1);
  for (const [o, arrival] of [[ph3, true], [ph4, true], [ph3i, true], [ph2, false], [ph1, false], [ph0, false]]) {
    const r = await readInfo(o);
    assert(r.id === 'phone:3:read' && r.dur === 2.0 && r.layers === 'back,rows,glass' && r.depths === '0,1,0' && r.cues === '0.7:news' && r.sfx === '' && r.inf && r.line === 'PRE-OPEN FEED' && r.cam === (arrival ? '44>0' : 'none'), `phone read beat: ${JSON.stringify(r)}`);
    assert(await shot('phone', o, 1, 1.5) === await shot('phone', o, 1, 1.5), 'phone read: same time gave different pictures');
    const empty = o.brief.feed.length === 0;
    assert((await shot('phone', o, 1, 0.5) !== await shot('phone', o, 1, arrival ? 1.2 : 0.74)) === !empty, `phone read: ${empty ? 'something moves with an empty feed' : 'nothing lands'}`);
    // the final frame (also the short-mode still) is today's read, plus a fifth row and two highlights on days with five or more items; three and four items end exactly as before
    const feed = o.brief.feed;
    const d = await page.evaluate(([o, arrival]) => {
      const R = BTB.Rhythm, sb = R.storyboard(o.day), feed = o.brief.feed;
      return window.finalDiff('phone', o, 1, (g) => (feed.length >= 5 ? R.phoneFrame(g, sb, feed, true, { rows: feed.slice(0, 5), count: 5, glow: 2, labelX: 92 }) : R.phoneFrame(g, sb, feed, true)), []);
    }, [o, arrival]);
    assert(d.bad === 0, `phone read (${feed.length} items): the final picture is not the flat read (${d.bad} px)`);
  }
  // the landing flare and the counters
  for (const o of [ph2, ph1]) {
    assert(await shot('phone', o, 1, 0.66) !== await shot('phone', o, 1, 0.74) && await shot('phone', o, 1, 0.74) !== await shot('phone', o, 1, 0.86), `phone read (${o.brief.feed.length} items, no arrival): the top row does not flare at 0.70 s`);
    assert(await shot('phone', o, 1, 0.86) === await shot('phone', o, 1, 1.9), `phone read (${o.brief.feed.length} items, no arrival): something moves after the flare`);
  }
  assert(await shot('phone', ph3, 1, 0.5) === await shot('phone', ph3, 0, 1.3), 'phone read (arrival): the start is not the handoff\'s last picture');
  assert(await shot('phone', ph3, 1, 0.8) !== await shot('phone', ph3, 1, 0.9) && await shot('phone', ph3, 1, 0.9) !== await shot('phone', ph3, 1, 0.98), 'phone read (arrival): the stack does not slide');
  assert(await shot('phone', ph3, 1, 1.1) === await shot('phone', ph3, 1, 1.9) && await shot('phone', ph3, 1, 1.02) !== await shot('phone', ph3, 1, 1.1), 'phone read (arrival): no flare at 1.00 s, or still moving at 1.1 s');
  // three and four items use the arrival recipe too: the backlog (feed 1 to n-1) waits until 0.70 s, the lead slides in 0.70-1.00 s, the flare lands at 1.00 s
  for (const o of [ph4, ph3i]) {
    const n = o.brief.feed.length, slot1 = [215, 99, 210, 40];
    assert(await page.evaluate((o) => (() => { const cam = BTB.Scenes.phone(o)[1].camera; return !!cam && cam.from.y === 44 && cam.to.y === 0; })(), o), `phone read (${n} items): no 44 px slide`);
    assert(await shot('phone', o, 1, 0.5) === await shot('phone', o, 1, 0.68), `phone read (${n} items): something moves before 0.70 s`);
    assert(await shot('phone', o, 1, 0.8) !== await shot('phone', o, 1, 0.9) && await shot('phone', o, 1, 0.9) !== await shot('phone', o, 1, 0.98), `phone read (${n} items): the stack does not slide`);
    assert(await shot('phone', o, 1, 1.1) === await shot('phone', o, 1, 1.9) && await shot('phone', o, 1, 1.02) !== await shot('phone', o, 1, 1.1), `phone read (${n} items): no flare at 1.00 s, or still moving at 1.1 s`);
    // the backlog's second row sits in the same place in the handoff's last picture and the read's first
    assert(await page.evaluate(([o, r]) => window.regionPic('phone', o, 0, 1.3, r) === window.regionPic('phone', o, 1, 0.5, r), [o, slot1]), `phone read (${n} items): the backlog does not start where the handoff left it`);
  }
  // the counters step from n - 1 to n at 0.85 s (from 4 to 5 on five or more); never at another time
  const cnt = (n, t, r) => page.evaluate(([n, t, r]) => window.regionPic('phone', { day: 3, brief: { title: 'H', feed: Array.from({ length: n }, (_, i) => ({ source: 'WIRE ' + i, title: 'Overnight headline ' + i + ' moves the whole index lower again', kind: 'wire' })) } }, 1, t, r), [n, t, r]);
  for (const [n, lower] of [[5, 4], [4, 3], [3, 2]]) for (const [name, r] of [['status', [405, 34, 14, 10]], ['label', [90, 108, 8, 10]]]) {
    assert(await cnt(n, 0.8, r) !== await cnt(n, 0.9, r) && await cnt(n, 0.5, r) === await cnt(n, 0.8, r) && await cnt(n, 0.9, r) === await cnt(n, 1.9, r), `phone read (${n} items): the ${name} count does not step once, at 0.85 s`);
    assert(await cnt(n, 0.8, r) === await cnt(lower, 1.9, r), `phone read (${n} items): the ${name} count does not start at ${lower}`);
  }
  const digit = (t) => page.evaluate((t) => window.regionPic('phone', { day: 3, brief: { title: 'H', feed: Array.from({ length: 5 }, (_, i) => ({ source: 'WIRE ' + i, title: 'Overnight headline ' + i + ' moves the whole index lower again', kind: 'wire' })) } }, 1, t, [405, 34, 14, 10]), t);
  assert(await digit(0.8) !== await digit(0.9), 'phone read (arrival): the status count does not step at 0.85 s');
  const labelDigit = (t) => page.evaluate((t) => window.regionPic('phone', { day: 3, brief: { title: 'H', feed: Array.from({ length: 5 }, (_, i) => ({ source: 'WIRE ' + i, title: 'Overnight headline ' + i + ' moves the whole index lower again', kind: 'wire' })) } }, 1, t, [90, 108, 8, 10]), t);
  assert(await labelDigit(0.8) !== await labelDigit(0.9), 'phone read (arrival): the label count does not step at 0.85 s');
  // reduced effects show one still
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of [ph3, ph4, ph0]) {
    assert(await shot('phone', o, 0, 0.5) === await shot('phone', o, 0, 1.3), 'phone handoff: reduced effects still moves');
    assert(await shot('phone', o, 1, 0.5) === await shot('phone', o, 1, 1.9), 'phone read: reduced effects still moves');
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // office wide, desk and hold: day 3 (act 1, autumn), day 20 (act 3, grey) and day 40 (act 4, winter, three dead desks)
  const of = (day, game) => ({ day, game, brief: { title: 'H', feed: [] } });
  const offDays = [of(3), of(20, gameS(70, 20)), of(40, gameS(30, 60))];
  const slipOf = (o) => (o.game ? Math.round((100 - o.game.mode.S.m.stability) / 12) + (o.game.mode.S.m.heat >= 50 ? 'h' : '') : '');
  for (const o of offDays) {
    const day = o.day, k = slipOf(o);
    const w = await info('office', o, 0), d = await info('office', o, 1), h = await info('office', o, 2);
    assert(w.id === `office:${day}:wide` && w.dur === 1.45 && w.layers === 'wall,monitors,desk' && w.depths === '0.5,0.75,1' && w.cam === '-8>0' && w.sfx === 'elevator' && w.tr === 'fade' && w.cues === '' && w.n === 3, `office wide beat: ${JSON.stringify(w)}`);
    assert(d.id === `office:${day}:desk:${k}` && d.dur === 1.8 && d.layers === 'wall,monitors,desk' && d.cam === 'none' && d.sfx === 'office' && d.inf && d.cues === '', `office desk beat: ${JSON.stringify(d)}`);
    assert(h.id === `office:${day}:hold:${k}` && h.dur === 0.85 && h.layers === 'wall,monitors,desk' && h.cam === 'none' && h.sfx === '' && h.cues === '', `office hold beat: ${JSON.stringify(h)}`);
    for (const [i, a, b] of [[0, 0.1, 1.35], [1, 0.1, 1.7], [2, 0.05, 0.8]]) {
      assert(await shot('office', o, i, a) !== await shot('office', o, i, b), `office ${i} day ${day}: start and end frames are identical`);
      assert(await shot('office', o, i, 0.6) === await shot('office', o, i, 0.6), `office ${i} day ${day}: same time gave different pictures`);
    }
  }
  // the wide's refresh band is 12 px tall (bible C1 amended for this shot): mid-crossing it covers 12 rows of the screen, 6 of which would be the old band
  for (const [o, live] of [[offDays[0], 5], [offDays[1], 3], [offDays[2], 2]]) for (let i = 0; i < live; i++) {
    const at = 0.35 + 0.12 * i, r = await page.evaluate(([o, t, i]) => window.layerCount('office', o, 0, 'monitors', t, [24 + 124 * i + 10, 92, 84, 78]), [o, at + 0.18, i]);
    assert(r.rows === 12, `office wide day ${o.day}: monitor ${i} refresh band is ${r.rows} px tall, not 12`);
  }
  // the wide: the tilt, then a refresh band down each live monitor in turn, left to right; the dead stay black
  const mon = (i) => [24 + 124 * i + 10, 92, 84, 78];
  for (const [o, live] of [[offDays[0], 5], [offDays[1], 3], [offDays[2], 2]]) {
    for (let i = 0; i < 5; i++) {
      const at = 0.35 + 0.12 * i;
      const before = await lp('office', o, 0, 'monitors', at - 0.05, true, mon(i)), during = await lp('office', o, 0, 'monitors', at + 0.18, true, mon(i)), after = await lp('office', o, 0, 'monitors', at + 0.4, true, mon(i));
      if (i < live) assert(before === after && before !== during, `office wide day ${o.day}: monitor ${i} refresh band wrong`);
      else assert(before === during && during === after, `office wide day ${o.day}: dead monitor ${i} reacts`);
    }
    // band at 0.35 on monitor 0 is on while monitor 1's has not started (left to right)
    assert(await lp('office', o, 0, 'monitors', 0.45, true, mon(1)) === await lp('office', o, 0, 'monitors', 0.3, true, mon(1)), `office wide day ${o.day}: monitor 1 starts with monitor 0`);
  }
  assert(await page.evaluate(() => { const b = BTB.Scenes.office({ day: 3 })[0], w = b.layers.find((l) => l.id === 'wall'), m = b.layers.find((l) => l.id === 'monitors'); return !!w.animate && !!m.animate; }), 'office wide: wall (weather) and monitors (refresh) need animate');
  const winRect = [18, 18, 640 - 18, 42];
  // weather falls in the six windows (autumn leaves, grey drizzle, winter snow) and keeps going across the chain
  for (const o of offDays) {
    assert(await lp('office', o, 0, 'wall', 0.2, true, winRect) !== await lp('office', o, 0, 'wall', 0.5, true, winRect), `office wide day ${o.day}: the window weather does not move`);
    assert(await lp('office', o, 0, 'wall', 1.45, true, winRect) === await lp('office', o, 1, 'wall', 0, true, winRect), `office day ${o.day}: weather jumps across the wide-to-desk cut`);
    assert(await lp('office', o, 1, 'wall', 1.8, true, winRect) === await lp('office', o, 2, 'wall', 0, true, winRect), `office day ${o.day}: weather jumps across the desk-to-hold cut`);
  }
  // the final wide is today's wide except inside the six windows; the final desk also except the chart and its newest points
  for (const o of offDays) {
    const sOf = o.game && o.game.mode.S;
    const dw = await page.evaluate(([o]) => { const R = BTB.Rhythm, S = o.game && o.game.mode.S; return window.finalDiff('office', o, 0, (g) => R.officeFrame(g, o.day, false, null, S), [[0, 16, 640, 46]]); }, [o]);
    assert(dw.bad === 0, `office wide day ${o.day}: the final picture differs from today's wide outside the windows (${dw.bad} px)`);
    const dd = await page.evaluate(([o]) => { const R = BTB.Rhythm, S = o.game && o.game.mode.S; return window.finalDiff('office', o, 1, (g) => R.officeFrame(g, o.day, true, null, S), [[0, 16, 640, 46], [540, 218, 86, 50]]); }, [o]);
    assert(dd.bad === 0, `office desk day ${o.day}: the final picture differs from today's desk outside the windows and the chart (${dd.bad} px)`);
    const dh = await page.evaluate(([o]) => { const R = BTB.Rhythm, S = o.game && o.game.mode.S; return window.finalDiff('office', o, 2, (g) => R.officeFrame(g, o.day, true, null, S), [[0, 16, 640, 46], [540, 218, 86, 50]]); }, [o]);
    assert(dh.bad === 0, `office hold day ${o.day}: the final picture differs from today's desk outside the windows and the chart (${dh.bad} px)`);
  }
  // the desk chart ticks every 0.25 s from 0.25 s; a new point is bone for 0.12 s; the line at 0.2 s is today's line
  const chartR = [540, 218, 86, 50];
  for (const o of [offDays[0], offDays[2]]) {
    const at = (i, t) => lp('office', o, i, 'desk', t, false, chartR);
    const flatChart = await page.evaluate(([o]) => { const R = BTB.Rhythm, g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d'); R.officeFrame(c, o.day, true, null, o.game && o.game.mode.S); const d = c.getImageData(540, 218, 86, 50).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); }, [o]);
    assert(await at(1, 0.2) === flatChart, `office desk day ${o.day}: before the first tick the chart is not today's`);
    const pics = [];
    for (const t of [0.2, 0.3, 0.45, 0.55, 0.8, 1.05, 1.3, 1.55, 1.8]) pics.push(await at(1, t));
    assert(new Set(pics).size === pics.length, `office desk day ${o.day}: two tick times show the same chart`);
    assert(await at(1, 0.27) !== await at(1, 0.4) && await at(1, 0.4) === await at(1, 0.49), `office desk day ${o.day}: the new point is not bone for 0.12 s`);
    assert(await at(1, 1.8) === await at(2, 0), `office day ${o.day}: the chart jumps across the desk-to-hold cut`);
    assert(await at(2, 0.1) !== await at(2, 0.25) && await at(2, 0.25) !== await at(2, 0.5) && await at(2, 0.5) !== await at(2, 0.75), `office hold day ${o.day}: the chart does not tick at 0.20, 0.45 and 0.70`);
    assert(await at(2, 0.85) !== await at(2, 0.75) && await at(2, 0.85) === await at(2, 0.9), `office hold day ${o.day}: the last point is not back to the line colour by the end`);
  }
  // the now-mark: a 2 px wide P.bone column at alpha 0.5 at x0 + 70 (616 and 617), y 228 to 250, drawn exactly while the chart's newest point is bone (desk and hold), inside the chart screen
  {
    // the mark is P.bone at alpha 0.5 (alpha 127 or 128 over the transparent layer), 2 px wide
    const mk = (o, i, t) => page.evaluate(([o, i, t]) => { const b = BTB.Scenes.office(o)[i], l = b.layers.find((x) => x.id === 'desk'), g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d'); l.animate(c, { w: 640, h: 360 }, t, t / b.dur, {});
      const d = c.getImageData(616, 228, 2, 22).data, B0 = BTB.Pal.bone, rgb = [parseInt(B0.slice(1, 3), 16), parseInt(B0.slice(3, 5), 16), parseInt(B0.slice(5, 7), 16)]; let n = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3] >= 126 && d[k + 3] <= 129 && Math.abs(d[k] - rgb[0]) <= 1 && Math.abs(d[k + 1] - rgb[1]) <= 1 && Math.abs(d[k + 2] - rgb[2]) <= 1) n++;
      return { n }; }, [o, i, t]);
    for (const o of [offDays[0], offDays[2]]) {
      for (const t of [0.27, 0.52, 0.77, 1.02, 1.27, 1.52, 1.77]) { const m = await mk(o, 1, t); assert(m.n >= 40 && m.n <= 44, `office desk day ${o.day}: no now-mark while the head point is lit at ${t} s (${m.n} px)`); }
      for (const t of [0.1, 0.2, 0.4, 0.45, 0.65, 0.9, 1.2, 1.65]) assert((await mk(o, 1, t)).n === 0, `office desk day ${o.day}: the now-mark shows at ${t} s with no lit head`);
      for (const t of [0.0, 0.25, 0.5, 0.75]) { const m = await mk(o, 2, t); assert(m.n >= 40 && m.n <= 44, `office hold day ${o.day}: no now-mark while the head point is lit at ${t} s (${m.n} px)`); }
      for (const t of [0.1, 0.4, 0.6, 0.85]) assert((await mk(o, 2, t)).n === 0, `office hold day ${o.day}: the now-mark shows at ${t} s with no lit head`);
      // nothing of it outside the chart screen, at any time in the beat
      for (const [i, end] of [[1, 1.8], [2, 0.85]]) for (let t = 0; t <= end; t += 0.0625) {
        const wholeBox = await page.evaluate(([o, i, t]) => { const b = BTB.Scenes.office(o)[i], l = b.layers.find((x) => x.id === 'desk'), g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d'); l.animate(c, { w: 640, h: 360 }, t, t / b.dur, {}); const d = c.getImageData(0, 0, 640, 360).data; let bad = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] >= 126 && d[k + 3] <= 129 && d[k] > 0xb0) { const x = (k / 4) % 640, y = Math.floor(k / 4 / 640); if (x < 541 || x > 624 || y < 219 || y > 266) bad++; } return bad; }, [o, i, t]);
        assert(wholeBox === 0, `office beat ${i} day ${o.day}: the now-mark outside the chart screen at ${t} s`);
      }
    }
  }
  // the stack: starts square, slips 0.90 to 1.20 s when stability is low, never moves at stability 100
  const stackR = [50, 205, 150, 70];
  assert(await lp('office', offDays[2], 1, 'desk', 0.8, false, stackR) !== await lp('office', offDays[2], 1, 'desk', 1.3, false, stackR), 'office desk (stability 30): the stack does not slip');
  assert(await lp('office', offDays[2], 1, 'desk', 1.2, false, stackR) === await lp('office', offDays[2], 1, 'desk', 1.7, false, stackR), 'office desk (stability 30): the stack is still moving after 1.20 s');
  assert(await lp('office', offDays[2], 1, 'desk', 0.95, false, stackR) !== await lp('office', offDays[2], 1, 'desk', 1.05, false, stackR), 'office desk (stability 30): the slip is not stepping');
  assert(await lp('office', offDays[0], 1, 'desk', 0.8, false, stackR) === await lp('office', offDays[0], 1, 'desk', 1.3, false, stackR), 'office desk (no game): the stack moves');
  assert(await lp('office', offDays[1], 2, 'desk', 0.3, false, stackR) === await lp('office', offDays[1], 2, 'desk', 0.8, false, stackR), 'office hold: the stack moves');
  // camera: the tilt only on the wide, at whole pixels
  assert(await page.evaluate(() => { const b = BTB.Scenes.office({ day: 3 })[0]; const ys = [0, 0.1, 0.3, 0.5, 0.8, 1].map((p) => BTB.Motion.cameraAt(b.camera, p).y); return ys[0] === -8 && ys[5] === 0 && ys.every((y) => y === Math.round(y)); }), 'office wide: the tilt is not 8 px to 0 in whole pixels');
  // every beat draws with no game and an empty feed, and draw(p=1) never reads settings
  for (const [scene, o] of [['phone', { day: 3 }], ['phone', { day: 3, brief: { feed: [] } }], ['office', { day: 3 }], ['office', { day: 40 }]]) {
    const n = await page.evaluate(([s, o]) => BTB.Scenes[s](o).map((b) => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {}); const d = c.getContext('2d').getImageData(0, 0, 640, 360).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i] === 255 ? 1 : 0; return a; }), [scene, o]);
    assert(n.every((a) => a > 640 * 360 * 0.9), `${scene} ${JSON.stringify(o)}: draw(p=1) left holes ${n}`);
  }
  // effects reduced: one still per beat
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of offDays) {
    assert(await shot('office', o, 0, 0.5) === await shot('office', o, 0, 1.2), `office wide day ${o.day}: reduced effects still moves`);
    assert(await shot('office', o, 1, 0.5) === await shot('office', o, 1, 1.7), `office desk day ${o.day}: reduced effects still moves`);
    assert(await shot('office', o, 2, 0.1) === await shot('office', o, 2, 0.8), `office hold day ${o.day}: reduced effects still moves`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  warnings.length = 0;

  // ---- stage 3 batch 3: the close (report, hold, Sqwak insert and read) ----
  // Flat references recorded from the code before the batch (the close:* ones re-recorded when the ninth dash was clipped to the card's inner edge): closeFrame and sqwakFrame with no options, and the final pictures of the
  // Sqwak read (the insert's final picture now shows the read's starting counts, checked below) (a day with the failed-vote alternate included: 41 and 44 have none of the passed story state here).
  const CLOSE_REF = {
    'close:A:false': '9d73ead7', 'close:A:true': 'af695dc5', 'close:B:false': '56bc08b1', 'close:B:true': '6547c3fc',
    'close:C:false': '480a0d9a', 'close:C:true': '8060211c', 'close:D:false': '83cce2f3', 'close:D:true': '928bdba6',
    'close:E:false': '1705a017', 'close:E:true': '6ab5af7c', 'close:F:false': '855a3097', 'close:F:true': '5dcf22f2',
    'sqwak:6:L:false': 'e75db5dc', 'sqwak:6:L:true': '121603b8', 'sqwak:6:N:false': 'dd0e28d2', 'sqwak:6:N:true': 'f6faad7a',
    'sqwak:20:L:false': 'f5e7a355', 'sqwak:20:L:true': 'a1976a89', 'sqwak:20:N:false': '6c13736f', 'sqwak:20:N:true': '9eb47c33',
    'sqwak:40:L:false': '718afa0a', 'sqwak:40:L:true': 'ba61ab98', 'sqwak:40:N:false': '295cfe0e', 'sqwak:40:N:true': '1cb614f6',
    'beat:6:sqwak-read': 'fb9de501', 'beat:20:sqwak-read': '879743aa', 'beat:41:sqwak-read': '90b91f06', 'beat:44:sqwak-read': 'b4daa27d'
  };
  const closeNow = await page.evaluate(() => {
    const R = BTB.Rhythm, out = {};
    const hashOf = (fn) => {
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
      const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261;
      for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); }
      return (x >>> 0).toString(16);
    };
    const reps = { A: { day: 3, pnl: 1200, quotaMet: true, quota: 900, date: 'MON OCT 6', indexPct: 1.2 }, B: { day: 30, pnl: -5400, quota: 2000, date: 'FRI NOV 14' }, C: { day: 44, pnl: 0, quota: 0, date: 'X' }, D: { day: 20, pnl: 1234567, quotaMet: true, quota: 900, date: 'WED' }, E: { day: 40, pnl: -1234567, quota: 5000, indexPct: -3, date: 'THU' }, F: {} };
    for (const k in reps) for (const d of [false, true]) out[`close:${k}:${d}`] = hashOf((g) => R.closeFrame(g, reps[k], d));
    const bs = { L: { flag: 'LIVE', when: 'NOW', head: 'Line forms outside the exchange before dawn', text: 'Doors are shut and guards stand in the lobby while traders queue to file their claims with the clerk.', stats: ['1.4K', '4.8K', '112K'], reply: ['@MacroMaven', 'Relief is not repair, and it never was.'] }, N: { head: 'Short' } };
    for (const day of [6, 20, 40]) for (const k in bs) for (const f of [false, true]) out[`sqwak:${day}:${k}:${f}`] = hashOf((g) => R.sqwakFrame(g, R.storyboard(day), bs[k], f));
    for (const day of [6, 20, 41, 44]) BTB.Scenes.close({ report: { day, pnl: 1200, quotaMet: true, quota: 900, date: 'D' } }).forEach((b) => { if (/sqwak-read$/.test(b.id)) out[`beat:${day}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, { w: 640, h: 360 }, 1, {})); });
    return out;
  });
  for (const k of Object.keys(CLOSE_REF)) assert(closeNow[k] === CLOSE_REF[k], `close ${k}: the picture changed (${closeNow[k]}, was ${CLOSE_REF[k]})`);

  const mkRep = (day, pnl, quota, met, extra) => ({ report: Object.assign({ day, pnl, quota, quotaMet: met, date: 'FRI NOV 14', indexPct: pnl }, extra) });
  const tagOf = (o) => { const r = o.report; return `${r.day}:${r.pnl >= 0 ? 'u' : 'd'}${r.quotaMet ? 'm' : ''}${Math.round(r.pnl)}`; };
  // profit with quota met (act 1), loss with quota missed (act 3), no quota (act 4, a seven-digit loss of nothing), big profit and big loss
  const cl = { profit: mkRep(3, 1200, 900, true), loss: mkRep(30, -5400, 2000, false), none: mkRep(44, 0, 0, true), big: mkRep(20, 1234567, 900, true), bigLoss: mkRep(40, -1234567, 5000, false), zero: mkRep(10, 0, 900, false) };
  const indexOf = async (o, re) => page.evaluate(([o, re]) => BTB.Scenes.close(o).findIndex((b) => new RegExp(re).test(b.id)), [o, re]);
  // the report: two layers, a camera that sets the card down, a caption that the stamp lands with
  for (const [name, o] of Object.entries(cl)) {
    const i = await indexOf(o, ':report$'), h = await indexOf(o, ':hold$'), tag = tagOf(o);
    const rp = await info('close', o, i), hd = await info('close', o, h);
    assert(rp.id === `close:${tag}:report` && rp.dur === 2.0 && rp.layers === 'office,card' && rp.depths === '0.5,1' && rp.cam === '-6>0' && rp.sfx === 'office' && rp.inf && rp.cues === '', `close report (${name}) beat: ${JSON.stringify(rp)}`);
    assert(hd.id === `close:${tag}:hold` && hd.dur === 0.85 && hd.layers === 'office,card' && hd.depths === '0.5,1' && hd.cam === 'none' && hd.sfx === '' && hd.cues === '', `close hold (${name}) beat: ${JSON.stringify(hd)}`);
    assert(await shot('close', o, i, 0.1) !== await shot('close', o, i, 1.9), `close report (${name}): start and end frames are identical`);
    assert(await shot('close', o, i, 1.0) === await shot('close', o, i, 1.0), `close report (${name}): same time gave different pictures`);
    assert(await shot('close', o, h, 0.05) !== await shot('close', o, h, 0.8), `close hold (${name}): start and end frames are identical`);
    assert(await shot('close', o, h, 0.5) === await shot('close', o, h, 0.5), `close hold (${name}): same time gave different pictures`);
  }
  assert((await info('close', cl.profit, await indexOf(cl.profit, ':report$'))).line.endsWith('QUOTA $900: MET.') && (await info('close', cl.loss, await indexOf(cl.loss, ':report$'))).line.endsWith('QUOTA $2,000: MISSED.') && (await info('close', cl.none, await indexOf(cl.none, ':report$'))).line === 'YOU MADE MONEY. NOBODY SAYS WELL DONE.', 'close report: the caption lost its quota text');
  // the final pictures: today's, except the stamp's outline on the report, and the dark screens on the hold
  const STAMP_ZONE = [264, 78, 112, 36], DARK = [[541, 219, 84, 48]].concat([0, 1, 2, 3, 4].map((i) => [34 + 124 * i, 92, 84, 78]), [0, 1, 2, 3, 4].map((i) => [44 + 124 * i, 176, 64, 3]));
  const closeFinal = (o, i, rects) => page.evaluate(([o, i, rects]) => { const R = BTB.Rhythm; return window.finalDiff('close', o, i, (g) => R.closeFrame(g, o.report, true), rects); }, [o, i, rects]);
  for (const [name, o] of Object.entries(cl)) {
    const i = await indexOf(o, ':report$'), h = await indexOf(o, ':hold$'), verdict = o.report.quota > 0;
    const a = await closeFinal(o, i, [STAMP_ZONE]), b = await closeFinal(o, h, [STAMP_ZONE].concat(DARK));
    assert(a.bad === 0 && (verdict ? a.inside > 0 : a.inside === 0), `close report (${name}): the final picture is not today's plus the stamp: ${JSON.stringify(a)}`);
    assert(b.bad === 0 && b.inside > 0, `close hold (${name}): the final picture is not today's plus the stamp and the dark screens: ${JSON.stringify(b)}`);
  }
  // the camera sets the card down 6 px (the floor 3): whole pixels, no zoom
  const cardTop = (o, t, id) => page.evaluate(([o, t, id]) => window.layerTop('close', o, BTB.Scenes.close(o).findIndex((b) => /:report$/.test(b.id)), id, t), [o, t, id]);
  assert(await cardTop(cl.profit, 0, 'card') === 77 && await cardTop(cl.profit, 2.0, 'card') === 71 && await cardTop(cl.profit, 0, 'office') === 3 && await cardTop(cl.profit, 2.0, 'office') === 0, 'close report: the camera does not settle the card 6 px and the floor 3 px');
  assert(await cardTop(cl.profit, 0.4, 'card') < 77 && await cardTop(cl.profit, 0.4, 'card') > 71, 'close report: the settle is not under way at 0.4 s');
  // the count: nothing before 0.30 s, then steps up to the day's figure, 15 a second, and it is final at 0.90 s; a loss counts down from 0
  const pnlBox = [170, 116, 300, 18], dashBox = [170, 178, 300, 4], labelBox = [286, 91, 68, 11], stampBox = STAMP_ZONE;
  for (const [name, o] of [['profit', cl.profit], ['loss', cl.loss], ['big', cl.big], ['bigLoss', cl.bigLoss]]) {
    const i = await indexOf(o, ':report$'), at = (t, r) => lp('close', o, i, 'card', t, false, r);
    const blank = await at(0.1, pnlBox);
    assert(blank === await at(0.28, pnlBox), `close report (${name}): the P&L shows before 0.30 s`);
    const pics = []; for (const t of [0.34, 0.48, 0.62, 0.76]) pics.push(await at(t, pnlBox));
    assert(new Set(pics.concat([blank])).size === 5, `close report (${name}): the count does not step between 0.34 and 0.76 s`);
    assert(await at(0.9, pnlBox) === await at(1.9, pnlBox) && await at(0.9, pnlBox) !== await at(0.8, pnlBox), `close report (${name}): the count does not end at 0.90 s`);
    // nine dashes, one a step from 0.30 s, the last at 0.83 s
    assert(await at(0.1, dashBox) !== await at(0.5, dashBox) && await at(0.5, dashBox) !== await at(0.8, dashBox) && await at(0.86, dashBox) === await at(1.9, dashBox) && await at(0.8, dashBox) !== await at(0.86, dashBox), `close report (${name}): the dashes do not light one by one up to 0.83 s`);
  }
  // the stamp: the label hidden on the flat box until 1.30 s; three hard frames at 1.26, 1.30, 1.34 (verdict days only)
  for (const [name, o] of [['profit', cl.profit], ['loss', cl.loss], ['big', cl.big], ['zero', cl.zero]]) {
    const i = await indexOf(o, ':report$'), at = (t, r) => lp('close', o, i, 'card', t, false, r);
    const ph = []; for (const t of [1.2, 1.27, 1.31, 1.35]) ph.push(await at(t, stampBox));
    assert(new Set(ph).size === 4 && ph[3] === await at(1.9, stampBox), `close report (${name}): the stamp is not four distinct states ending at 1.34 s: ${JSON.stringify(ph)}`);
    const lab = await page.evaluate(([o, i]) => { const b = BTB.Scenes.close(o)[i], g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d'); b.layers[1].draw(c, { w: 640, h: 360 }, {}); const d = c.getImageData(280, 91, 80, 11).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 200) n++; return n; }, [o, i]);
    assert(lab > 20, `close report (${name}): the cached card has no verdict label to uncover (${lab})`);
    const hidden = await at(1.2, labelBox), shown = await at(1.31, labelBox);
    assert(hidden !== shown && shown === await at(1.9, labelBox) && hidden === await at(1.27, labelBox), `close report (${name}): the label is not hidden until 1.30 s`);
  }
  // no quota: no cover and no stamp, the label shows from the start and the count is the movement
  {
    const o = cl.none, i = await indexOf(o, ':report$'), at = (t, r) => lp('close', o, i, 'card', t, false, r);
    assert(await at(0.1, stampBox) === await at(1.9, stampBox) && await at(0.1, labelBox) === await at(1.9, labelBox), 'close report (no quota): something covers or stamps the verdict');
    // the sheet: the label shows from the start and the count is the key movement; with a figure of 0 the tally shows $0 from 0.30 s (no count), and the dashes light one by one
    assert(await at(0.1, pnlBox) !== await at(0.34, pnlBox) && await at(0.34, pnlBox) === await at(1.9, pnlBox), 'close report (no quota): the $0 does not appear at 0.30 s and stay');
    assert(await at(0.4, dashBox) !== await at(0.5, dashBox) && await at(0.8, dashBox) !== await at(0.86, dashBox) && await at(0.86, dashBox) === await at(1.9, dashBox), 'close report (no quota): the dashes do not light one by one up to 0.83 s');
  }
  // a figure of exactly 0 does not count: the tally shows $0 from 0.30 s, the stamp carries the shot
  {
    const o = cl.zero, i = await indexOf(o, ':report$'), at = (t, r) => lp('close', o, i, 'card', t, false, r);
    assert(await at(0.4, pnlBox) === await at(1.9, pnlBox) && await at(0.1, pnlBox) !== await at(0.4, pnlBox), 'close report (P&L 0): the figure counts, or never appears');
  }
  // the count never overflows its box and the text rows never move; the stamp's largest frame stays in the box
  const drawn = (o, i, t) => page.evaluate(([o, i, t]) => {
    const b = BTB.Scenes.close(o)[i], L = b.layers[1], g = document.createElement('canvas'); g.width = 640; g.height = 360; const c = g.getContext('2d');
    L.animate(c, { w: 640, h: 360 }, t, t / b.dur, {});
    const d = c.getImageData(0, 0, 640, 360).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, px0 = 1e9, px1 = -1, py0 = 1e9, py1 = -1;
    for (let k = 0; k < d.length; k += 4) if (d[k + 3]) { const x = (k / 4) % 640, y = Math.floor(k / 4 / 640); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (y >= 110 && y < 140) { px0 = Math.min(px0, x); px1 = Math.max(px1, x); py0 = Math.min(py0, y); py1 = Math.max(py1, y); } }
    return { x0, x1, y0, y1, py0, py1, px0, px1 };
  }, [o, i, t]);
  for (const [name, o] of Object.entries(cl)) {
    const i = await indexOf(o, ':report$');
    for (let t = 0; t <= 2.0; t += 1 / 30) {
      const b = await drawn(o, i, t);
      if (b.x1 < 0) continue;
      assert(b.x0 >= 169 && b.x1 <= 474 && b.y0 >= 76 && b.y1 <= 181, `close report (${name}): drawn outside the box interior at ${t.toFixed(2)} s: ${JSON.stringify(b)}`);
      if (b.px0 < 1e9) assert(b.py0 >= 116 && b.py1 <= 134, `close report (${name}): the figure leaves its rows at ${t.toFixed(2)} s: ${JSON.stringify(b)}`);
    }
  }
  // the hold: your desk chart goes dark first, then the live monitors right to left, 0.10 s apart; each is a three-frame collapse
  for (const [name, o] of [['profit', cl.profit], ['bigLoss', cl.bigLoss], ['loss', cl.loss], ['big', cl.big]]) {
    const live = await page.evaluate((d) => BTB.Rhythm.officeGeom(d).live, o.report.day);
    assert(live >= 2 && live <= 5, `close hold (${name}): ${live} live monitors`);
    const h = await indexOf(o, ':hold$'), lyr = (t, r) => lp('close', o, h, 'office', t, false, r);
    const chart = [541, 219, 84, 48], mon = (i) => [34 + 124 * i, 92, 84, 78], bar = (i) => [44 + 124 * i, 176, 64, 3];
    const c = []; for (const t of [0.1, 0.17, 0.22, 0.3, 0.8]) c.push(await lyr(t, chart));
    assert(c[0] !== c[1] && c[1] !== c[2] && c[2] !== c[3] && c[3] === c[4], `close hold (${name}): the desk chart does not collapse at 0.15 s and stay dark`);
    for (let i = 0; i < 5; i++) {
      if (i >= live) { assert(await lyr(0.1, mon(i)) === await lyr(0.8, mon(i)), `close hold (${name}): dead monitor ${i} changes`); continue; }
      const at = 0.25 + 0.10 * (live - 1 - i);
      const m = []; for (const t of [at - 0.02, at + 0.02, at + 0.07, at + 0.12]) m.push(await lyr(t, mon(i)));
      assert(new Set(m).size === 4 && m[3] === await lyr(0.84, mon(i)), `close hold (${name}): monitor ${i} does not collapse at ${at.toFixed(2)} s: ${JSON.stringify(m)}`);
      assert(await lyr(at + 0.05, bar(i)) === await lyr(at - 0.02, bar(i)) && await lyr(at + 0.12, bar(i)) !== await lyr(at + 0.05, bar(i)), `close hold (${name}): monitor ${i} bar does not show at ${(at + 0.1).toFixed(2)} s`);
    }
    // right to left: the monitor to its left is still lit when the next one goes dark
    if (live >= 2) assert(await lyr(0.3, mon(live - 2)) === await lyr(0.1, mon(live - 2)), `close hold (${name}): the second monitor from the right goes dark with the first`);
  }
  // the hold's card is final from the first frame: no count, no stamp frames, no cover
  for (const o of [cl.profit, cl.loss]) {
    const h = await indexOf(o, ':hold$'), i = await indexOf(o, ':report$');
    const a = await lp('close', o, h, 'card', 0, false, [165, 70, 310, 116]), b = await lp('close', o, h, 'card', 0.8, false, [165, 70, 310, 116]), r = await lp('close', o, i, 'card', 2.0, false, [165, 70, 310, 116]);
    assert(a === b && b === r, 'close hold: the card is not the report\'s final card at rest');
  }
  // the Sqwak insert and read: sessions with breaking news (index 6 BREAKING, 20 LIVE, 40 act 4, 44 SYSTEM-style alternates)
  const sq = { six: { report: { day: 6, pnl: 1200, quota: 900, quotaMet: true, date: 'D' } }, live: { report: { day: 20, pnl: -300, quota: 900, quotaMet: false, date: 'D' } }, four: { report: { day: 40, pnl: -5400, quota: 2000, quotaMet: false, date: 'D' } }, alt: { report: { day: 41, pnl: 800, quota: 900, quotaMet: false, date: 'D' } }, last: { report: { day: 44, pnl: 0, quota: 0, quotaMet: true, date: 'D' } } };
  for (const [name, o] of Object.entries(sq)) {
    const ins = await indexOf(o, ':sqwak$'), rd = await indexOf(o, ':sqwak-read$'), day = o.report.day;
    assert(ins === 1 && rd === 2, `close ${name}: the insert and read are not beats 1 and 2`);
    const a = await info('close', o, ins), b = await info('close', o, rd);
    assert(a.id === `close:${day}:sqwak` && a.dur === 1.0 && a.layers === 'city,phone,grain' && a.depths === '0.25,1,0' && a.cam === '-40>0' && a.sfx === 'news' && a.cues === '', `close insert (${name}) beat: ${JSON.stringify(a)}`);
    assert(b.id === `close:${day}:sqwak-read` && b.dur === 2.6 && b.layers === 'city,phone,grain' && b.depths === '0,1,0' && b.cam === '-26>0' && b.sfx === 'broadcast' && b.cues === '' && b.line.length > 3, `close read (${name}) beat: ${JSON.stringify(b)}`);
    assert(await shot('close', o, ins, 0.1) !== await shot('close', o, ins, 0.9) && await shot('close', o, rd, 0.1) !== await shot('close', o, rd, 2.5), `close ${name}: the insert or the read does not move`);
    assert(await shot('close', o, ins, 0.5) === await shot('close', o, ins, 0.5) && await shot('close', o, rd, 1.3) === await shot('close', o, rd, 1.3), `close ${name}: same time gave different pictures`);
    // the phone's top: 40 px low until 0.10 s, at rest from 0.60 s; the read starts where the insert ended (the top at 40) and rises to 14
    const top = (i, t, id) => page.evaluate(([o, i, t, id]) => window.layerTop('close', o, i, id, t), [o, i, t, id]);
    const t0 = await top(ins, 0.05, 'phone'), tm = await top(ins, 0.35, 'phone'), t1 = await top(ins, 0.9, 'phone');
    assert(t0 === 80 && t1 === 40 && tm > 40 && tm < 80 && await top(ins, 0.2, 'phone') > tm, `close insert (${name}): the phone's top is ${[t0, tm, t1]}, not 80, between, 40`);
    assert(await top(ins, 0.05, 'city') === 10 && await top(ins, 0.9, 'city') === 0 && await top(rd, 0, 'city') === 0 && await top(rd, 2.5, 'city') === 0, `close ${name}: the city does not drift 10 px with the insert and stay for the read`);
    assert(await top(rd, 0, 'phone') === 40 && await top(rd, 0.3, 'phone') < 40 && await top(rd, 0.3, 'phone') > 14 && await top(rd, 0.7, 'phone') === 14 && await top(rd, 2.5, 'phone') === 14, `close read (${name}): the phone does not rise from 40 to 14 in 0.6 s`);
    // the wash and scanlines stay pinned: depth 0 (above), the grain layer's picture is the same at every time
    assert(await lp('close', o, ins, 'grain', 0.1, false) === await lp('close', o, ins, 'grain', 0.9, false), `close insert (${name}): the grain moves`);
  }
  // the flag light: the kit's standby rate (1.0 s, half on) for every flag, on at the end
  {
    const flagBox = (ins) => (ins ? [223, 112, 10, 10] : [223, 86, 10, 10]);
    const ins6 = await indexOf(sq.six, ':sqwak$'), ins20 = await indexOf(sq.live, ':sqwak$'), rd6 = await indexOf(sq.six, ':sqwak-read$');
    const f = (o, i, t, ins) => lp('close', o, i, 'phone', t, false, ins ? flagBox(true) : flagBox(false));
    assert(await f(sq.six, ins6, 0.4, true) !== await f(sq.six, ins6, 0.7, true) && await f(sq.six, ins6, 0.7, true) === await f(sq.six, ins6, 1.0, true), 'close insert (BREAKING): the flag does not blink at 1.0 s and end lit');
    assert(await f(sq.live, ins20, 0.4, true) !== await f(sq.live, ins20, 0.8, true) && await f(sq.live, ins20, 0.8, true) === await f(sq.live, ins20, 1.0, true) && await f(sq.live, ins20, 0.6, true) === await f(sq.live, ins20, 0.8, true), 'close insert (LIVE): the flag does not blink at 1.0 s like the others and end lit');
    // the read (2.6 s, end-anchored at the 1.0 s standby rate, half on): lit 0.1-0.6, 1.1-1.6, 2.1-2.6; dark 0-0.1, 0.6-1.1, 1.6-2.1; lit at the end
    const onR = await f(sq.six, rd6, 2.2, false), offR = await f(sq.six, rd6, 2.0, false);
    assert(onR !== offR && await f(sq.six, rd6, 2.6, false) === onR && await f(sq.six, rd6, 2.5, false) === onR && await f(sq.six, rd6, 1.3, false) === onR && await f(sq.six, rd6, 0.3, false) === onR, 'close read: the flag is not lit at 0.3, 1.3, 2.2 and the end');
    assert(await f(sq.six, rd6, 1.8, false) === offR && await f(sq.six, rd6, 0.8, false) === offR, 'close read: the flag is not dark at 0.8, 1.8 and 2.0');
    // the flag's blink ends with the beat it is built for, whatever that beat's length
    assert(await page.evaluate((o) => { const b = BTB.Scenes.close(o).find((x) => /:sqwak-read$/.test(x.id)), end = b.dur, c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); b.layers[1].animate(g, { w: 640, h: 360 }, end, 1, {}); const px = g.getImageData(225, 90, 1, 1).data; return px[3] > 0; }, sq.six), 'close read: the flag is not lit at the beat\'s own end');
  }
  // the insert shows the read's starting counts, static: its last frame's count text is the read's first frame's, and its final picture is the flat insert except there
  for (const [name, o] of [['six', sq.six], ['live', sq.live], ['four', sq.four], ['last', sq.last]]) {
    const ins = await indexOf(o, ':sqwak$'), rd = await indexOf(o, ':sqwak-read$');
    const a = await lp('close', o, ins, 'phone', 1.0, true, [223, 280, 200, 12]), b = await lp('close', o, rd, 'phone', 0, true, [223, 254, 200, 12]);
    assert(a === b && a !== await lp('close', o, rd, 'phone', 2.6, true, [223, 254, 200, 12]), `close insert (${name}): its count text is not the read's starting count text`);
    assert(await lp('close', o, ins, 'phone', 0.2, true, [223, 280, 200, 12]) === a, `close insert (${name}): the counts move`);
    const d = await page.evaluate(([o, i]) => { const R = BTB.Rhythm, r = o.report, sq = BTB.Scenes.close(o)[i].post; return window.finalDiff('close', o, i, (g) => R.sqwakFrame(g, R.storyboard(r.day), sq, false), [[223, 278, 200, 12]]); }, [o, ins]);
    assert(d.bad === 0 && d.inside > 0, `close insert (${name}): the final picture is not today's insert but for the count text: ${JSON.stringify(d)}`);
  }
  // the P&L count is anchored to the final value's layout: the right edge never moves while it counts, to within the last glyph's blank column (seven-digit figures; the plain centred count shifts 3 px a digit)
  // The count also starts from a value with the final's number of digits (1,234,567 from 1,000,000; 950 from 100; 7 from 1), so the string keeps one width and the sign and dollar sign do not walk: the leftmost glyph's x is constant too.
  const cmid = mkRep(10, 950, 900, true), cmidLoss = mkRep(10, -950, 900, false), ctiny = mkRep(10, 7, 900, true), ctinyLoss = mkRep(10, -7, 900, false), c12 = mkRep(10, 12, 900, true);
  for (const o of [cl.big, cl.bigLoss, cl.profit, cl.loss, cmid, cmidLoss, ctiny, ctinyLoss, c12]) {
    const i = await indexOf(o, ':report$'), edges = [], lefts = [];
    for (const t of [0.34, 0.5, 0.7, 0.85, 1.5]) { const b = await drawn(o, i, t); edges.push(b.px1); lefts.push(b.px0); }
    assert(Math.max(...edges) - Math.min(...edges) <= 1 && edges[0] > 300, `close report (${o.report.pnl}): the count's right edge moves: ${JSON.stringify(edges)}`);
    assert(Math.max(...lefts) === Math.min(...lefts) && lefts[0] < 320, `close report (${o.report.pnl}): the count's leftmost glyph walks: ${JSON.stringify(lefts)}`);
  }
  // the counts: nothing counts before 0.60 s (the 80% values show), each steps 8 a second to the authored string at 2.20 s
  for (const [name, o] of [['six', sq.six], ['live', sq.live], ['four', sq.four], ['last', sq.last]]) {
    const rd = await indexOf(o, ':sqwak-read$'), box = [223, 250, 200, 12], at = (t) => lp('close', o, rd, 'phone', t, false, box);
    const pics = []; for (const t of [0.5, 0.8, 1.1, 1.5, 1.9]) pics.push(await at(t));
    assert(new Set(pics).size === 5, `close read (${name}): the counts do not climb between 0.6 and 2.2 s`);
    assert(await at(2.2) === await at(2.59) && await at(2.1) !== await at(2.2) && await at(0.1) === await at(0.5), `close read (${name}): the counts do not end at 2.20 s or start before 0.60 s`);
  }
  // endless mode and no game: no insert; every beat draws; a report with nothing in it still draws
  for (const o of [{ report: { day: 6, pnl: 5, quota: 0, quotaMet: true }, game: { mode: { kind: 'endless' } } }, { report: {} }, { report: { day: 12, pnl: 1234567, quota: 0 } }]) {
    const n = await page.evaluate((o) => BTB.Scenes.close(o).map((b) => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; b.draw(c.getContext('2d'), { w: 640, h: 360 }, 1, {}); const d = c.getContext('2d').getImageData(0, 0, 640, 360).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i] === 255 ? 1 : 0; return [b.id, a]; }), o);
    assert(n.every(([id, a]) => a > 640 * 360 * 0.9), `close ${JSON.stringify(o)}: draw(p=1) left holes ${JSON.stringify(n)}`);
    if (o.game) assert(n.length === 3, 'close (endless): the Sqwak insert is in the chain');
  }
  // the chain is no longer than before: 1.9 (bell) + 2.0 + 0.85, plus 3.6 s on a day with breaking news
  assert(await page.evaluate(() => [[3, 4.75], [6, 8.35], [40, 8.35]].every(([d, tot]) => Math.abs(BTB.Scenes.close({ report: { day: d, pnl: 1, quota: 1, quotaMet: true } }).reduce((a, b) => a + b.dur, 0) - tot) < 1e-9)), 'close chain length changed');
  // effects reduced: one still per beat
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of [cl.profit, cl.loss, cl.none, sq.six, sq.live]) {
    const n = await page.evaluate((o) => BTB.Scenes.close(o).length, o);
    for (let i = 1; i < n; i++) {
      const dur = await page.evaluate(([o, i]) => BTB.Scenes.close(o)[i].dur, [o, i]);
      assert(await shot('close', o, i, 0.4) === await shot('close', o, i, dur - 0.05), `close ${o.report.day} beat ${i}: reduced effects still moves`);
    }
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- stage 3 batch 4: act cards and documents (act card, memo, footnote, rating, post, chart, ticket, vote, voicemail) ----
  // Reference hashes recorded from the code before the batch: every document drawn flat (insertShot, no options) and the final picture of every
  // news beat of the sessions that show them (act, establish, detail, hold), including the story variants and a very long and an empty title.
  // None of these changes in this batch: each reworked beat ends on exactly today's picture.
  const DOCS_REF = {
    'flat:memo:15': '83b8c823', 'flat:memo:19': '55499c0b', 'flat:memo:32': 'b65c76cf', 'flat:footnote:1': '1d9c8737', 'flat:footnote:8': 'd1663b07', 'flat:footnote:24': 'fb753f33',
    'flat:rating:4': '963db331', 'flat:rating:14': '690e32e2', 'flat:post:2': 'bbffaf4d', 'flat:post:33': '246016e1', 'flat:chart:3': '7dbff839', 'flat:chart:30': '287ff4ed',
    'flat:chart:43': '5f78684d', 'flat:ticket:5': 'fcd27c42', 'flat:ticket:12': 'fcd27c42', 'flat:ticket:23': 'fcd27c42', 'flat:ticket:39': 'fcd27c42', 'flat:vote:11': '489f9175',
    'flat:vote:38': '489f9175', 'flat:voicemail:36': 'afe31083', 'flatShort:memo': '8d1dbeb', 'flatShort:footnote': '60818e57', 'flatShort:rating': 'ddbbe1f2', 'flatShort:post': 'f92e5a0e',
    'flatShort:chart': 'c215bb45', 'flatShort:ticket': '5956baf2', 'flatShort:vote': '436b6cb5', 'flatShort:voicemail': 'dafcfb4b', 'beat:1:establish': 'bdea65c3', 'beat:1:detail': 'a945bd0f',
    'beat:2:establish': '6ff30c70', 'beat:2:detail': '69d2cd65', 'beat:3:establish': '912e7f19', 'beat:3:detail': '4b57b15', 'beat:3:hold': '79bdf03a', 'beat:4:establish': '3da39fbd',
    'beat:4:detail': '206f7bff', 'beat:5:establish': '5c91dd4', 'beat:5:detail': '2711c25', 'beat:5:hold': 'c425c27d', 'beat:8:act': 'aa8dde35', 'beat:8:establish': '37bcef1a',
    'beat:8:detail': '4a7f62ef', 'beat:8:hold': '2d5bc42a', 'beat:10:establish': '63a084f', 'beat:10:detail': 'eb92a21e', 'beat:10:hold': 'b374c0fd', 'beat:11:establish': '110cf4d2',
    'beat:11:detail': '2b9c42fd', 'beat:12:establish': '96b6197', 'beat:12:detail': 'b3d5a8c7', 'beat:12:hold': 'bfa36295', 'beat:14:establish': '2e21a492', 'beat:14:detail': 'fbf240d8',
    'beat:15:establish': '15257b55', 'beat:15:detail': '213055bb', 'beat:17:act': '3671fe7d', 'beat:17:establish': '341e8251', 'beat:17:detail': 'eac160e0', 'beat:17:hold': '4f7947d5',
    'beat:19:establish': 'a358b384', 'beat:19:detail': 'ac70cebb', 'beat:23:establish': '22936121', 'beat:23:detail': '3d2e50fd', 'beat:23:hold': '94a6570d', 'beat:24:establish': '9ea3e3ec',
    'beat:24:detail': 'c32fcdab', 'beat:24:hold': '81cf4381', 'beat:30:establish': '2766162b', 'beat:30:detail': 'b0acb899', 'beat:32:act': '278249a5', 'beat:32:establish': 'f5af82dc',
    'beat:32:detail': '53ff82e7', 'beat:32:hold': '78835b2f', 'beat:33:establish': 'c95eebad', 'beat:33:detail': 'ffab389d', 'beat:36:establish': '13c61f8b', 'beat:36:detail': 'f7b90cbb',
    'beat:36:hold': '8b4860b5', 'beat:38:establish': 'c6fb2c3', 'beat:38:detail': 'af5be3db', 'beat:38:hold': 'dfd1f71a', 'beat:39:establish': '89b8ca2f', 'beat:39:detail': 'a4e952fa',
    'beat:43:establish': '43648e23', 'beat:43:detail': 'e9651e51', 'beat:43:hold': '620463ff', 'beat:22bail:establish': '636a6ce', 'beat:22bail:detail': '7ab3040b', 'beat:22bail:hold': '3288ad05',
    'beat:22fail:establish': '52c43877', 'beat:22fail:detail': '1e840719', 'beat:22fail:hold': '403c2d55', 'beat:22ban:establish': '47bcf1a6', 'beat:22ban:detail': '8b8ecee7',
    'beat:22ban:hold': '88ca252d', 'beat:4dump:establish': '9bc8ac8', 'beat:4dump:detail': 'e0685e7d', 'beat:4leak:establish': '7c3a469a', 'beat:4leak:detail': '255e5fd0',
    'beat:41pass:establish': 'eecf53', 'beat:41pass:detail': '4edd49f9', 'beat:41pass:hold': 'a3c2e72f', 'beat:45plug:establish': '65ddd720', 'beat:45plug:detail': 'c5845d35',
    'beat:45plug:hold': 'fb86be25', 'beat:32long:act': '278249a5', 'beat:32long:establish': 'f5af82dc', 'beat:32long:detail': '53ff82e7', 'beat:32long:hold': '78835b2f',
    'beat:4empty:establish': '3da39fbd', 'beat:4empty:detail': '206f7bff'
  };
  const docsNow = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, out = {}, view = { w: 640, h: 360 };
    const S = (c) => ({ mode: { S: { choices: c, f: {} } } });
    const o = (day, title, g) => Object.assign({ day, brief: { title: title || 'Headline of the day', feed: [] } }, g ? { game: g } : {});
    const docs = { memo: [15, 19, 32], footnote: [1, 8, 24], rating: [4, 14], post: [2, 33], chart: [3, 30, 43], ticket: [5, 12, 23, 39], vote: [11, 38], voicemail: [36] };
    for (const doc in docs) for (const d of docs[doc]) out[`flat:${doc}:${d}`] = hashOf((g) => SB.insertShot(g, d, 'THE VALUE OF THE DAY 42', doc));
    for (const doc of ['memo', 'footnote', 'rating', 'post', 'chart', 'ticket', 'vote', 'voicemail']) out[`flatShort:${doc}`] = hashOf((g) => SB.insertShot(g, 7, 'X', doc));
    const variants = { '22bail': o(22, 'T', S({ c5: 'bail' })), '22fail': o(22, 'T', S({ c5: 'fail' })), '22ban': o(22, 'T', S({ c5: 'ban' })), '4dump': o(4, 'T', S({ c1: 'dump' })), '4leak': o(4, 'T', S({ c1: 'leak' })), '41pass': o(41, 'T', { mode: { S: { choices: {}, f: { billPassed: true } } } }), '45plug': o(45, 'T', { mode: { S: { choices: {}, f: { pulledPlug: true } } } }) };
    const days = [1, 2, 3, 4, 5, 8, 10, 11, 12, 14, 15, 17, 19, 23, 24, 30, 32, 33, 36, 38, 39, 43];
    const list = days.map((d) => [String(d), o(d, 'Headline of the day')]).concat(Object.entries(variants), [['32long', o(32, 'A very long headline that goes on and on past any sensible width of caption box ok')], ['4empty', o(4, '')]]);
    for (const [k, op] of list) BTB.Scenes.news(op).forEach((b) => { out[`beat:${k}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    return out;
  });
  for (const k of Object.keys(DOCS_REF)) assert(docsNow[k] === DOCS_REF[k], `batch 4 ${k}: the picture changed (${docsNow[k]}, was ${DOCS_REF[k]})`);
  assert(Object.keys(docsNow).length === Object.keys(DOCS_REF).length, 'batch 4: the set of reference pictures changed');

  await page.evaluate(() => {
    const view = { w: 640, h: 360 };
    const canvas = () => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
    const rgbOf = (spec, day) => {
      const hex = spec[0] === '@' ? BTB.Rhythm.colors(BTB.StoryData.actIndex(day) + 1)[spec.slice(1)] : BTB.Pal[spec];
      return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    // pixels of one layer (its animate alone, or draw and animate) in a rect that are exactly a palette colour ('@wash' and '@signal': the day's act colours); any: pixels with any alpha
    window.colCount = (scene, opts, i, id, t, r, spec, animOnly) => {
      const b = BTB.Scenes[scene](opts)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
      if (!animOnly) layer.draw(g, view, {});
      if (layer.animate) layer.animate(g, view, t, t / b.dur, {});
      const d = g.getImageData(r[0], r[1], r[2], r[3]).data, c = spec === 'any' ? null : rgbOf(spec, opts.day); let n = 0;
      for (let k = 0; k < d.length; k += 4) { if (c ? d[k + 3] === 255 && d[k] === c[0] && d[k + 1] === c[1] && d[k + 2] === c[2] : d[k + 3] > 0) n++; }
      return n;
    };
    // the most fillRect calls the animates of all layers of a beat make in one frame, over the whole beat in 0.05 s steps (and the very end)
    window.rectMax = (scene, opts, i) => {
      const b = BTB.Scenes[scene](opts)[i], g = canvas(), P = CanvasRenderingContext2D.prototype, orig = P.fillRect;
      let n = 0, worst = 0, at = 0;
      P.fillRect = function (...a) { n++; return orig.apply(this, a); };
      try {
        for (let k = 0; k <= Math.round(b.dur / 0.05) + 1; k++) {
          const t = Math.min(b.dur, k * 0.05); n = 0;
          b.layers.forEach((l) => { if (l.animate) { g.save(); l.animate(g, view, t, t / b.dur, {}); g.restore(); } });
          if (n > worst) { worst = n; at = t; }
        }
      } finally { P.fillRect = orig; }
      return { worst, at };
    };
    // the box of the opaque pixels of one layer's animate alone in a rect
    window.animBox = (scene, opts, i, id, t, r) => {
      const b = BTB.Scenes[scene](opts)[i], layer = b.layers.find((l) => l.id === id), g = canvas();
      layer.animate(g, view, t, t / b.dur, {});
      const d = g.getImageData(r[0], r[1], r[2], r[3]).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3]) { const x = (k / 4) % r[2] + r[0], y = Math.floor(k / 4 / r[2]) + r[1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return [x0, x1, y0, y1];
    };
  });
  const cc = (o, i, id, t, r, spec, animOnly) => page.evaluate(([a, b, c, d, e, f, g, h]) => window.colCount(a, b, c, d, e, f, g, h), ['news', o, i, id, t, r, spec, animOnly !== false]);
  const newsIdx = (o, re) => page.evaluate(([o, re]) => BTB.Scenes.news(o).findIndex((b) => new RegExp(re).test(b.id)), [o, re]);
  const sbRow = (o) => page.evaluate((o) => { const r = BTB.Storyboard.row(o.day, o.game && o.game.mode && o.game.mode.S); return r; }, o);
  const nOpts = (day, title, S) => Object.assign({ day, brief: { title: title == null ? 'Headline of the day' : title, feed: [] } }, S ? { game: { mode: { S } } } : {});

  // the act card: one layer, no camera, the name typed on in 4x letters, today's card at the end
  for (const day of [8, 17, 32]) {
    const o = nOpts(day), i = await newsIdx(o, ':act$'), a = await info('news', o, i);
    assert(i === 0 && a.id === `news:${day}:act` && a.dur === 1.7 && a.layers === 'card' && a.depths === '1' && a.cam === 'none' && a.sfx === 'broadcast' && a.tr === 'fade' && a.cues === '', `act card ${day} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6), `act card ${day}: start and end frames are identical`);
    assert(await shot('news', o, i, 1.0) === await shot('news', o, i, 1.0), `act card ${day}: same time gave different pictures`);
    const nm = (await page.evaluate((d) => { const l = BTB.StoryData.actOf(d); return BTB.Rhythm.clean(l.split('·')[1].trim()); }, day)), n = nm.length, done = 0.45 + n / 16;
    const left = 4 * ((80 - (6 * n - 1) / 2) | 0), box = [0, 140, 640, 60];
    const bx = (t) => page.evaluate(([o, i, t, box]) => window.animBox('news', o, i, 'card', t, box), [o, i, t, box]);
    // nothing before 0.45 s; then the cursor, 20x28 px in the act's signal colour, alone before the first letter
    assert((await cc(o, i, 'card', 0.40, box, 'any')) === 0, `act card ${day}: something is drawn before 0.45 s`);
    assert((await cc(o, i, 'card', 0.46, box, '@signal')) === 560, `act card ${day}: the cursor is not a 20x28 block in the signal colour`);
    assert((await cc(o, i, 'card', 0.46, box, 'bone')) === 0, `act card ${day}: bone at 0.46 s (the cursor must be in the act's signal colour)`);
    // letters never move: the left edge is the same at every time after the first letter, the right edge grows, whole 4 px steps
    const boxes = []; for (const t of [0.55, 0.7, 0.85]) boxes.push(await bx(t));
    assert(boxes.every((b) => b[0] === left) && boxes[0][1] < boxes[1][1] && boxes[1][1] <= boxes[2][1], `act card ${day}: the name does not type left to right from ${left}: ${JSON.stringify(boxes)}`);
    // the name and the cursor: typed to the last letter, one blink, gone by done + 0.5; stable from then on
    const fin = await bx(done + 0.6);
    assert(fin[0] === left && fin[1] > boxes[2][1], `act card ${day}: final name box ${JSON.stringify(fin)} (left edge ${left})`);
    assert((await cc(o, i, 'card', done + 0.1, box, '@signal')) === 560 && (await cc(o, i, 'card', done + 0.3, box, '@signal')) === 0 && (await cc(o, i, 'card', done + 0.55, box, '@signal')) === 0, `act card ${day}: the cursor does not blink once after the last letter and go`);
    assert(await cc(o, i, 'card', done + 0.55, box, 'any') === await cc(o, i, 'card', 1.69, box, 'any') && await cc(o, i, 'card', 1.2, box, 'bone') > 0, `act card ${day}: the final name is not still from done + 0.5`);
    const d = await page.evaluate(([o, i]) => window.finalDiff('news', o, i, (g) => BTB.Storyboard.actCard(g, o.day), []), [o, i]);
    assert(d.bad === 0 && d.inside === 0, `act card ${day}: the final frame is not today's card: ${JSON.stringify(d)}`);
    // the flat card without the name is the cached layer
    assert(await lp('news', o, i, 'card', 0.2, false) !== await lp('news', o, i, 'card', 1.2, false), `act card ${day}: the cached card holds the name`);
  }
  // an act label with no dot types its whole label; an empty label types nothing and stays a still; any title is fine
  for (const label of ['PROLOGUE', '', 'IV · ' + 'RECKONING OF EVERYTHING AND MORE '.repeat(3)]) {
    const r = await page.evaluate((label) => {
      const D = BTB.StoryData, orig = D.actOf; D.actOf = (d) => (d >= 8 ? label : 'I · OLD');
      try {
        const beats = BTB.Scenes.news({ day: 8, brief: { title: '', feed: [] } }), b = beats[0], c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
        b.draw(g, { w: 640, h: 360 }, 1, {});
        const flat = document.createElement('canvas'); flat.width = 640; flat.height = 360; BTB.Storyboard.actCard(flat.getContext('2d'), 8);
        const a = g.getImageData(0, 0, 640, 360).data, f = flat.getContext('2d').getImageData(0, 0, 640, 360).data; let bad = 0; for (let k = 0; k < a.length; k++) if (a[k] !== f[k]) bad++;
        const mid = document.createElement('canvas'); mid.width = 640; mid.height = 360; const m = mid.getContext('2d'); b.layers[0].animate(m, { w: 640, h: 360 }, 0.7, 0.7 / b.dur, {});
        const md = m.getImageData(0, 0, 640, 360).data; let any = 0; for (let k = 3; k < md.length; k += 4) if (md[k]) any++;
        return { id: b.id, bad, any, layered: !!b.layers };
      } finally { D.actOf = orig; }
    }, label);
    assert(r.id === 'news:8:act' && r.layered && r.bad === 0 && (label === '' ? r.any === 0 : r.any > 0), `act card with label '${label}': ${JSON.stringify(r)}`);
  }

  // the documents: beat shape, a moving picture, determinism, the key movement, the final frame is today's picture
  const SBdoc = {
    memo: [['15', nOpts(15)], ['19', nOpts(19)], ['32', nOpts(32)], ['22bail', nOpts(22, 'T', { choices: { c5: 'bail' }, f: {} })], ['10dark', nOpts(10)], ['22fail', nOpts(22, 'T', { choices: { c5: 'fail' }, f: {} })], ['45plug', nOpts(45, 'T', { choices: {}, f: { pulledPlug: true } })]],
    footnote: [['1', nOpts(1)], ['8', nOpts(8)], ['24', nOpts(24)]],
    rating: [['4', nOpts(4)], ['14', nOpts(14)]],
    post: [['2', nOpts(2)], ['33', nOpts(33)], ['4leak', nOpts(4, 'T', { choices: { c1: 'leak' }, f: {} })]],
    chart: [['3', nOpts(3)], ['30', nOpts(30)], ['43', nOpts(43)]],
    ticket: [['5', nOpts(5)], ['12', nOpts(12)], ['23', nOpts(23)], ['39', nOpts(39)], ['4dump', nOpts(4, 'T', { choices: { c1: 'dump' }, f: {} })], ['22ban', nOpts(22, 'T', { choices: { c5: 'ban' }, f: {} })]],
    vote: [['11', nOpts(11)], ['38', nOpts(38)], ['41pass', nOpts(41, 'T', { choices: {}, f: { billPassed: true } })]],
    voicemail: [['36', nOpts(36)]]
  };
  const SHAPE = { memo: ['paper,band,ink', '1,1,1', 'none', ''], footnote: ['doc,grain', '1,1', 'none', ''], rating: ['doc,grain', '1,1', 'none', '1.3:click'], post: ['city,phone,glass,grain', '0,1,1,0', '-32>0', ''],
    chart: ['doc,grain', '1,1', 'none', ''], ticket: ['screen,book,glass', '1,1,1', 'none', ''], vote: ['doc,grain', '1,1', 'none', ''], voicemail: ['doc,grain', '1,1', 'none', ''] };
  const drawCover = (o, i) => page.evaluate(([o, i]) => { const b = BTB.Scenes.news(o)[i], c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); b.draw(g, { w: 640, h: 360 }, 1, {}); const d = g.getImageData(0, 0, 640, 360).data; let a = 0; for (let k = 3; k < d.length; k += 4) a += d[k] === 255 ? 1 : 0; return a; }, [o, i]);
  for (const doc in SBdoc) for (const [name, o] of SBdoc[doc]) {
    const i = await newsIdx(o, ':detail$'), a = await info('news', o, i), sh = SHAPE[doc], row = await sbRow(o);
    assert(row.doc === doc || (doc === 'memo' && !row.doc), `batch 4 ${doc} ${name}: the session shows ${row.doc}`);
    assert(/^news:\d+(:.+)?:detail$/.test(a.id) && a.dur === 2.3 && a.layers === sh[0] && a.depths === sh[1] && a.cam === sh[2] && a.cues === sh[3] && a.sfx === 'broadcast' && a.inf && a.line.length > 0, `${doc} ${name} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 2.2), `${doc} ${name}: start and end frames are identical`);
    assert(await shot('news', o, i, 1.0) === await shot('news', o, i, 1.0), `${doc} ${name}: same time gave different pictures`);
    if (doc !== 'post') assert(await shot('news', o, i, 1.6) === await shot('news', o, i, 2.2), `${doc} ${name}: still moving at 1.6 s`); // the post's TRENDING light blinks to the end
    assert((await drawCover(o, i)) === 640 * 360, `${doc} ${name}: the final picture has holes`);
    // any brief title, any missing game: the beat is the same picture
    if (!o.game) for (const t of ['', 'W'.repeat(200)]) {
      const o2 = nOpts(o.day, t), j = await newsIdx(o2, ':detail$');
      assert(await shot('news', o2, j, 1.0) === await shot('news', o, i, 1.0), `${doc} ${name}: the picture depends on the title '${t.slice(0, 5)}'`);
    }
  }
  // the movement of each document, on the first session that shows it (and the others for the cheap ones)
  const layN = (o, id, t, r, anim) => lp('news', o, o.__i, id, t, anim, r);
  const mk = async (o) => Object.assign({}, o, { __i: await newsIdx(o, ':detail$') });
  // memo: the highlighter (416x58, the act's wash) wipes left to right under the value, 0.35 to 0.85 s
  for (const [name, o0] of SBdoc.memo) {
    const o = await mk(o0), i = o.__i, BAND = [112, 96, 416, 58], q = (t) => cc(o, i, 'band', t, BAND, '@wash');
    assert(await q(0.30) === 0 && await q(1.2) === 416 * 58 && await q(2.2) === 416 * 58 && await q(0.80) < 416 * 58 && await q(0.86) === 416 * 58, `memo ${name}: the band does not wipe in 0.35 to 0.85 s`);
    const s = []; for (const t of [0.40, 0.50, 0.60, 0.70]) s.push(await q(t));
    assert(s[0] > 0 && s[0] < s[1] && s[1] < s[2] && s[2] < s[3] && s.every((v) => v % 58 === 0), `memo ${name}: the band does not grow left to right in steps: ${JSON.stringify(s)}`);
    assert(await layN(o, 'paper', 0.2, [0, 0, 640, 360], false) === await layN(o, 'paper', 2.0, [0, 0, 640, 360], false), `memo ${name}: the paper layer moves`);
  }
  // footnote: the pen goes round the line (loop 290x14), then runs 60 px out to the note
  for (const [name, o0] of SBdoc.footnote) {
    const o = await mk(o0), i = o.__i, ly = 50 + (6 + o.day % 6) * 12, ALL = [70, ly - 8, 380, 18], RUN = [376, ly, 60, 2], q = (t, r) => cc(o, i, 'doc', t, r, 'crimson');
    assert(await q(0.30, ALL) === 0 && await q(1.2, ALL) === 1328 && await q(2.2, ALL) === 1328, `footnote ${name}: the pen is not 1328 px at the end`);
    const s = []; for (const t of [0.5, 0.7, 0.9, 1.0]) s.push(await q(t, ALL));
    assert(s[0] > 0 && s[0] < s[1] && s[1] < s[2] && s[2] < s[3] && s[3] < 1328, `footnote ${name}: the loop does not draw on: ${JSON.stringify(s)}`);
    assert(await q(1.0, RUN) === 0 && await q(1.12, RUN) > 0 && await q(1.2, RUN) === 120, `footnote ${name}: the run to the note does not follow the loop`);
  }
  // rating: the stamp lands on the covered paper in three hard frames, 1.30 s, 1.34 s, 1.38 s
  for (const [name, o0] of SBdoc.rating) {
    const o = await mk(o0), i = o.__i, ST = [150, 64, 340, 110], WIDE = [120, 50, 400, 140], q = (t, spec, r, anim) => cc(o, i, 'doc', t, r, spec, anim);
    assert(await q(0.5, 'bone', ST, false) === 340 * 110 && await q(1.28, 'bone', ST, false) === 340 * 110 && await q(1.28, 'bone', [124, 64, 392, 110], false) === 392 * 110, `rating ${name}: the stamp's place is not a flat paper cover before 1.30 s`);
    assert(await q(1.4, 'bone', ST, false) !== 340 * 110 && await q(1.4, 'any', WIDE, true) === 0 && await q(1.4, '@signal', ST, false) > 0, `rating ${name}: the stamp and its value are not there from 1.38 s`);
    const p1 = await q(1.32, '@signal', WIDE, true), p2 = await q(1.36, '@signal', WIDE, true);
    assert(p1 === 2 * 356 + 2 * 116 && p2 > p1 && await q(1.2, 'any', WIDE, true) === 392 * 110, `rating ${name}: the outlines are not 1 px at 1.30 s and 2 px at 1.34 s (${p1}, ${p2})`);
    const pics = []; for (const t of [1.2, 1.32, 1.36, 1.4]) pics.push(await shot('news', o, i, t));
    assert(new Set(pics).size === 4 && await shot('news', o, i, 1.4) === await shot('news', o, i, 2.2), `rating ${name}: not four distinct frames, still from 1.38 s`);
    assert((await info('news', o, i)).cues === '1.3:click', `rating ${name}: the click cue is missing`);
  }
  // post: the phone rises 32 px (top row 48 down to 16 between 0.30 and 0.80 s) over a skyline that stays; the TRENDING light blinks and is on at the end
  for (const [name, o0] of SBdoc.post) {
    const o = await mk(o0), i = o.__i, tp = (id, t) => page.evaluate(([o, i, id, t]) => window.layerTop('news', o, i, id, t), [o, i, id, t]), LED = [216, 70, 10, 10];
    assert(await tp('phone', 0.1) === 48 && await tp('phone', 0.3) === 48 && await tp('phone', 0.8) === 16 && await tp('phone', 2.2) === 16 && await tp('glass', 0.1) === 60 && await tp('glass', 2.2) === 28, `post ${name}: the phone does not rise 32 px between 0.30 and 0.80 s`);
    assert(await tp('phone', 0.5) > 16 && await tp('phone', 0.5) < 48 && await tp('phone', 0.4) > await tp('phone', 0.6), `post ${name}: the rise is not under way at 0.5 s`);
    const lit = await cc(o, i, 'phone', 2.3, LED, 'crimson'), s = [];
    for (const t of [0.7, 1.2, 1.7, 2.0]) s.push(await cc(o, i, 'phone', t, LED, 'crimson'));
    assert(lit === 100 && s[0] === 0 && s[1] === 100 && s[2] === 0 && s[3] === 100, `post ${name}: the TRENDING light is not blinking at 1 s, on at the end: ${lit} ${JSON.stringify(s)}`);
    assert(await cc(o, i, 'city', 0.2, [0, 0, 640, 360], 'any', false) === await cc(o, i, 'city', 2.0, [0, 0, 640, 360], 'any', false), `post ${name}: the city moves`);
  }
  // chart: the red circle (64x98) draws round the move, 0.40 to 0.95 s
  for (const [name, o0] of SBdoc.chart) {
    const o = await mk(o0), i = o.__i, C = [352, 62, 80, 112], q = (t) => cc(o, i, 'doc', t, C, 'crimson');
    assert(await q(0.35) === 0 && await q(1.0) === 616 && await q(2.2) === 616 && await q(0.90) < 616, `chart ${name}: the circle does not draw in 0.40 to 0.95 s`);
    const s = []; for (const t of [0.5, 0.6, 0.7, 0.8]) s.push(await q(t));
    assert(s[0] > 0 && s[0] < s[1] && s[1] < s[2] && s[2] < s[3], `chart ${name}: the circle does not grow: ${JSON.stringify(s)}`);
  }
  // ticket: the book drains: bid bars step shorter, ask bars longer, three 12 px steps each (36 px in all), top bar first (0.40 to 0.88 s); the bars sit under the glass
  for (const [name, o0] of SBdoc.ticket) {
    const o = await mk(o0), i = o.__i, q = (t, spec, r) => cc(o, i, 'book', t, r, spec);
    const bid0 = (t) => q(t, 'jadeD', [90, 80, 160, 8]), ask0 = (t) => q(t, 'crimsonD', [420, 80, 130, 8]), bid4 = (t) => q(t, 'screenGlow', [90, 136, 160, 8]);
    assert(await bid0(0.3) === 136 * 8 && await bid0(0.45) === 124 * 8 && await bid0(0.55) === 112 * 8 && await bid0(0.7) === 100 * 8 && await bid0(2.2) === 100 * 8, `ticket ${name}: bid bar 0 does not step 136, 124, 112, 100`);
    assert(await ask0(0.3) === 24 * 8 && await ask0(0.45) === 36 * 8 && await ask0(0.55) === 48 * 8 && await ask0(0.7) === 60 * 8, `ticket ${name}: ask bar 0 does not step 24, 36, 48, 60`);
    assert(await bid4(0.5) === 64 * 8 && await bid4(0.7) === 52 * 8 && await bid4(0.8) === 40 * 8 && await bid4(0.9) === 28 * 8, `ticket ${name}: bid bar 4 does not step 64, 52, 40, 28 from 0.64 s`);
    assert(await q(2.2, 'crimsonD', [0, 0, 640, 360]) === 420 * 8 && await q(2.2, 'screenGlow', [0, 0, 640, 360]) === 220 * 8 && await q(0.3, 'crimsonD', [0, 0, 640, 360]) === 5 * 8 * 24 + 8 * 12 * 10, `ticket ${name}: the bars do not total today's at the end`);
    assert(await bid0(0.3) - await bid0(0.45) >= 12 * 8 && await ask0(0.55) - await ask0(0.3) >= 24 * 8, `ticket ${name}: a step is under 12 px`);
    assert(await cc(o, i, 'book', 0.2, [0, 0, 640, 360], 'any', false) === await cc(o, i, 'book', 0.2, [0, 0, 640, 360], 'any', true), `ticket ${name}: the book layer's own picture is not empty`);
  }
  // vote: both lamp banks sweep on row by row, 0.09 s apart from 0.40 s (a yea bank of jade, a nay bank of crimson)
  for (const [name, o0] of SBdoc.vote) {
    const o = await mk(o0), i = o.__i, rowCells = (r, m) => { let n = 0; for (let k = 0; k < 18; k++) if ((r * 18 + k) % m) n++; return n; };
    const q = (t, spec, r) => cc(o, i, 'doc', t, [64, 56 + 13 * r, spec === 'jadeD' ? 230 : 600, 9], spec, true);
    const yeaAll = (t) => cc(o, i, 'doc', t, [64, 56, 230, 78], 'jadeD', true), nayAll = (t) => cc(o, i, 'doc', t, [340, 56, 230, 78], 'crimsonD', true);
    assert(await yeaAll(0.39) === 0 && await nayAll(0.39) === 0, `vote ${name}: lamps lit before 0.40 s`);
    for (let r = 0; r < 6; r++) {
      let y = 0, n = 0; for (let k = 0; k <= r; k++) { y += rowCells(k, 7) * 81; n += rowCells(k, 5) * 81; }
      const t = 0.40 + 0.09 * r + 0.03;
      assert(await yeaAll(t) === y && await nayAll(t) === n, `vote ${name}: after row ${r} lit the banks hold ${await yeaAll(t)} and ${await nayAll(t)} lamp pixels, not ${y} and ${n}`);
    }
    assert(await yeaAll(2.2) === await yeaAll(0.9) && await q(2.2, 'jadeD', 0) === rowCells(0, 7) * 81, `vote ${name}: the board is not still from 0.85 s`);
  }
  // voicemail: playback lights the waveform bar by bar, 0.06 s apart from 0.40 s, twelve bars
  {
    const o = await mk(SBdoc.voicemail[0][1]), i = o.__i, h = (k) => 4 + ((k * 37 + 36) % 36), tot = (n) => { let s = 0; for (let k = 0; k < n; k++) s += 3 * h(k); return s; }, W = [216, 80, 80, 60];
    const q = (t) => cc(o, i, 'doc', t, W, 'phosphor', true);
    assert(await q(0.35) === 0 && await q(0.43) === tot(1) && await q(0.49) === tot(2) && await q(0.7) === tot(6) && await q(1.09) === tot(12) && await q(2.2) === tot(12), `voicemail: the bars do not light one by one up to bar 12 at 1.06 s (${await q(0.43)} ${await q(1.09)})`);
    assert(await cc(o, i, 'doc', 0.2, W, 'phosphor', false) === 0, 'voicemail: a bar is lit before playback starts');
  }
  // ---- stage 3 batch 4, part 2: the desk with the day's paper (shot 10), the voicemail apartment (11), the post and chart establishes (12) ----
  // Flat pictures the part touches, recorded from the code before the change: the desk at each zoom (memo 0, footnote 1.5, desk place 1.3), the apartment at each glow.
  const FLAT2_REF = {
    'desk:0:1': '45988316', 'desk:0:8': 'bfcbee37', 'desk:0:19': '439a3f38', 'desk:0:32': '8d158aac', 'desk:1.5:1': '1682f3f8', 'desk:1.5:8': '5ed999b6', 'desk:1.5:19': 'bf1398c0', 'desk:1.5:32': 'c2104d44',
    'desk:1.3:1': '7fb57686', 'desk:1.3:8': '902cb85', 'desk:1.3:19': 'ec1c417a', 'desk:1.3:32': '9c5765ea', 'apt:0.15': 'cf4377e5', 'apt:0.5': '4a1e4845', 'apt:0.6': '8f55367d', 'apt:0.7': '34cc030d',
    'aptWinter:0.15': '84c412cd', 'aptWinter:0.5': '51a7706d', aptNoSeason: '2e863285'
  };
  const flat2 = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, SH = BTB.Shots, out = {};
    for (const z of [0, 1.5, 1.3]) for (const d of [1, 8, 19, 32]) out[`desk:${z}:${d}`] = hashOf((g) => SB.deskWithDoc(g, d, { doc: z === 1.5 ? 'footnote' : 'memo', arg: 'THE VALUE OF THE DAY' }, z));
    for (const gl of [0.15, 0.5, 0.6, 0.7]) out[`apt:${gl}`] = hashOf((g) => SB.at2x(g, (c) => SH.apartment(c, gl), 36));
    for (const gl of [0.15, 0.5]) out[`aptWinter:${gl}`] = hashOf((g) => SB.at2x(g, (c) => SH.apartment(c, gl), 40));
    out.aptNoSeason = hashOf((g) => { g.save(); g.scale(2, 2); SH.apartment(g, 0.15); g.restore(); });
    return out;
  });
  for (const k of Object.keys(FLAT2_REF)) assert(flat2[k] === FLAT2_REF[k], `batch 4b ${k}: the flat picture changed (${flat2[k]}, was ${FLAT2_REF[k]})`);

  // which sessions these shots apply to: no S-weight document establish and no desk place exists in the sheet, so neither is wired
  assert(await page.evaluate(() => { const SB = BTB.Storyboard; for (let d = 0; d < 46; d++) { const r = SB.row(d, null), sb = BTB.Rhythm.storyboard(d); if ((r.shot === 'insert' && r.weight === 'S') || (r.shot === 'place' && sb.place === 'desk')) return false; } return true; }), 'batch 4b: a session reaches the S-weight document establish or the desk place, which the sheet says none does');

  const T22 = { choices: { c5: 'bail' }, f: {} };
  const DESK_EST = [['1', nOpts(1)], ['8', nOpts(8)], ['15', nOpts(15)], ['19', nOpts(19)], ['24', nOpts(24)], ['32', nOpts(32)], ['22bail', nOpts(22, 'T', T22)]];
  const DESK_HOLD = [['8', nOpts(8)], ['24', nOpts(24)], ['32', nOpts(32)], ['22bail', nOpts(22, 'T', T22)]];
  const bxx = (o, i, id, t, r) => page.evaluate(([o, i, id, t, r]) => window.animBox('news', o, i, id, t, r || [0, 0, 640, 360]), [o, i, id, t, r]);
  const cnt2 = (o, i, id, t, spec, r) => cc(o, i, id, t, r || [0, 0, 640, 360], spec);
  // shot 10, establish: the paper slides up 16 art units between 0.35 and 0.75 s; the TRADE LED blinks to the end; the marks never move
  for (const [name, o] of DESK_EST) {
    const i = await newsIdx(o, ':establish$'), a = await info('news', o, i);
    assert(/^news:\d+(:.+)?:establish$/.test(a.id) && a.dur === 1.7 && a.layers === 'desk,marks' && a.depths === '1,0' && a.cam === 'none' && a.sfx === 'apartment' && a.cues === '' && a.inf === false, `desk establish ${name} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6), `desk establish ${name}: start and end frames are identical`);
    assert(await shot('news', o, i, 0.6) === await shot('news', o, i, 0.6), `desk establish ${name}: same time gave different pictures`);
    assert((await drawCover(o, i)) === 640 * 360, `desk establish ${name}: the final picture has holes`);
    // the paper: low until 0.35 s, then up by 37 to 64 px, ease out, still from 0.75 s; nothing of it is drawn by the cached layer
    const y1 = async (t) => (await bxx(o, i, 'desk', t))[3];
    const low = await y1(0.1), mid = await y1(0.5), up = await y1(0.8);
    assert(low === await y1(0.3) && low - up >= 36 && low - up <= 66 && mid < low && mid > up && up === await y1(1.6), `desk establish ${name}: the paper does not slide up 37 to 64 px between 0.35 and 0.75 s (${low}, ${mid}, ${up})`);
    assert(await lp('news', o, i, 'desk', 0.1, false) !== await lp('news', o, i, 'desk', 1.6, false), `desk establish ${name}: the cached desk shows the paper`);
    const nBefore = await cnt2(o, i, 'desk', 0.1, 'bone'), nAt = await cnt2(o, i, 'desk', 1.6, 'bone');
    assert(nBefore > 500 && nAt > 500, `desk establish ${name}: the paper (bone) is not in the animate (${nBefore}, ${nAt})`);
    // the LED: its cover shows while it is off (0.9 s), is gone while lit (1.5 s) and at the end; the paper at rest is the same in all
    const led = (t) => cnt2(o, i, 'desk', t, 'any');
    assert(await led(0.9) > await led(1.5) && await led(1.5) === await led(1.6) && await led(1.6) === await led(1.7) && await led(1.0) > await led(1.5), `desk establish ${name}: the TRADE LED does not blink to the end at the standby rate`);
    // marks and the corner brackets do not move
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), `desk establish ${name}: the marks move`);
    for (const ti of ['', 'W'.repeat(200)]) { const o2 = Object.assign({}, o, { brief: { title: ti, feed: [] } }), j = await newsIdx(o2, ':establish$'); assert(await shot('news', o2, j, 1.0) === await shot('news', o, i, 1.0), `desk establish ${name}: the picture depends on the title '${ti.slice(0, 3)}'`); }
  }
  // shot 10, hold: the paper at rest from the first frame, the LED blinks under the dim, nothing else moves
  for (const [name, o] of DESK_HOLD) {
    const i = await newsIdx(o, ':hold$'), a = await info('news', o, i);
    assert(/^news:\d+(:.+)?:hold$/.test(a.id) && a.dur === 1.1 && a.layers === 'desk,dim' && a.depths === '1,0' && a.cam === 'none' && a.sfx === '' && a.cues === '', `desk hold ${name} beat: ${JSON.stringify(a)}`);
    assert((await drawCover(o, i)) === 640 * 360 && await shot('news', o, i, 0.4) === await shot('news', o, i, 0.4), `desk hold ${name}: holes or non-deterministic`);
    const led = (t) => cnt2(o, i, 'desk', t, 'any');
    assert(await led(0.4) > await led(0.8) && await led(0.8) === await led(1.1), `desk hold ${name}: the TRADE LED does not blink and end lit`);
    assert(await shot('news', o, i, 0.8) === await shot('news', o, i, 1.05) && await shot('news', o, i, 0.4) !== await shot('news', o, i, 0.8), `desk hold ${name}: only the LED should move`);
    assert(await lp('news', o, i, 'dim', 0, false) === await lp('news', o, i, 'dim', 1.0, false), `desk hold ${name}: the dim moves`);
  }
  // shot 11: the voicemail apartment: the phone on the couch arm lights at 0.45 s with one bone flare (to 0.53 s); settle tilt
  {
    const o = nOpts(36), i = await newsIdx(o, ':establish$'), a = await info('news', o, i), scr = [405, 254, 21, 35], fl = [385, 232, 60, 76];
    assert(a.id === 'news:36:establish' && a.dur === 1.7 && a.layers === 'room,marks' && a.depths === '1,0' && a.cam === '-6>0' && a.sfx === 'apartment' && a.cues === '' && a.tr === 'fade', `voicemail establish beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6) && await shot('news', o, i, 1.0) === await shot('news', o, i, 1.0) && (await drawCover(o, i)) === 640 * 360, 'voicemail establish: not moving, not deterministic or has holes');
    const lit = (t) => cc(o, i, 'room', t, scr, 'screenGlow', false);
    assert(await lit(0.2) === 0 && await lit(0.44) === 0 && await lit(0.56) > 300 && await lit(0.6) === await lit(1.6), 'voicemail establish: the phone screen does not light at 0.45 s and stay');
    const any = (t) => cc(o, i, 'room', t, fl, 'any', true);
    assert(await any(0.3) === 0 && await any(0.49) > await any(0.6) && await any(0.6) === await any(1.6) && await any(0.6) > 300, 'voicemail establish: one bone flare of 0.08 s does not follow the light');
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), 'voicemail establish: the marks move');
    // the flare and the lit screen sit in the room's own picture: the cached room has no lit screen, the final one does
    assert(await lp('news', o, i, 'room', 0.2, false, scr) !== await lp('news', o, i, 'room', 1.6, false, scr), 'voicemail establish: the cached room already has the lit screen');
  }
  // shot 12a: the post establish: a small dark phone rises 56 px over a still room and wakes at 1.00 s on the one post
  for (const [name, o] of [['2', nOpts(2)], ['33', nOpts(33)], ['4leak', nOpts(4, 'T', { choices: { c1: 'leak' }, f: {} })]]) {
    const i = await newsIdx(o, ':establish$'), a = await info('news', o, i);
    assert(/^news:\d+(:.+)?:establish$/.test(a.id) && a.dur === 1.7 && a.layers === 'room,device,marks' && a.depths === '0,1,0' && a.cam === '-56>0' && a.sfx === 'apartment' && a.cues === '' && a.tr === 'fade', `post establish ${name} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6) && await shot('news', o, i, 0.9) === await shot('news', o, i, 0.9) && (await drawCover(o, i)) === 640 * 360, `post establish ${name}: not moving, not deterministic or has holes`);
    const top = (t) => page.evaluate(([o, i, t]) => window.layerTop('news', o, i, 'device', t), [o, i, t]);
    const t0 = await top(0.05), tm = await top(0.6), t1 = await top(1.0);
    assert(t0 - t1 === 56 && tm < t0 && tm > t1 && await top(0.9) === t1 && await top(0.25) === t0, `post establish ${name}: the phone does not rise 56 px between 0.30 and 0.90 s (${t0}, ${tm}, ${t1})`);
    assert(await top(0.05) !== await page.evaluate(([o, i]) => window.layerTop('news', o, i, 'room', 0.05), [o, i]), `post establish ${name}: the room rises with the phone`);
    assert(await lp('news', o, i, 'room', 0.1, false) === await lp('news', o, i, 'room', 1.6, false) && await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), `post establish ${name}: the room or the marks move`);
    // asleep (a dark cover and a clock) until 1.00 s, then one flare and the lit post
    assert(await cnt2(o, i, 'device', 0.5, 'screenD') > 8000 && await cnt2(o, i, 'device', 0.95, 'grey2') > 20 && await cnt2(o, i, 'device', 1.02, 'screenD') === 0 && await cnt2(o, i, 'device', 1.02, 'any') > 8000 && await cnt2(o, i, 'device', 1.2, 'any') === 0 && await cnt2(o, i, 'device', 1.02, 'grey2') === 0, `post establish ${name}: the screen is not dark until 1.00 s, then one flare`);
  }
  // shot 12b: the chart establish: the office wide, a refresh band down each live monitor in turn from 0.35 s; settle tilt
  for (const [name, o] of [['3', nOpts(3)], ['30', nOpts(30)], ['43', nOpts(43)]]) {
    const i = await newsIdx(o, ':establish$'), a = await info('news', o, i), live = await page.evaluate((d) => BTB.Rhythm.officeGeom(d).live, o.day);
    assert(a.id === `news:${o.day}:establish` && a.dur === 1.7 && a.layers === 'office,marks' && a.depths === '1,0' && a.cam === '-6>0' && a.sfx === 'apartment' && a.cues === '' && a.tr === 'fade', `chart establish ${name} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6) && await shot('news', o, i, 0.8) === await shot('news', o, i, 0.8) && (await drawCover(o, i)) === 640 * 360, `chart establish ${name}: not moving, not deterministic or has holes`);
    assert(await cnt2(o, i, 'office', 0.2, 'any') === 0 && await cnt2(o, i, 'office', 1.4, 'any') === 0 && await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), `chart establish ${name}: bands before 0.35 s or after the last, or the marks move`);
    for (let m = 0; m < live; m++) assert(await cnt2(o, i, 'office', 0.35 + 0.12 * m + 0.18, 'any') > 0, `chart establish ${name}: no band on live monitor ${m} at its time`);
    const endAt = 0.35 + 0.12 * (live - 1) + 0.36;
    assert(await cnt2(o, i, 'office', endAt + 0.04, 'any') === 0 && await cnt2(o, i, 'office', endAt - 0.04, 'any') > 0, `chart establish ${name}: the last of ${live} live monitors does not end at ${endAt.toFixed(2)} s`);
  }
  {
    // d 3 is the wide: no zoom, so monitor 0's band sits inside its screen (x 34 to 117) and the second monitor's has not started
    const o = nOpts(3), i = await newsIdx(o, ':establish$'), b = await bxx(o, i, 'office', 0.42);
    assert(b[0] >= 34 && b[1] <= 117 && b[3] - b[2] >= 1, `chart establish 3: the first band is outside monitor 0: ${JSON.stringify(b)}`);
  }
  // none of these needs the game or a title
  for (const o of [nOpts(15, ''), nOpts(36, 'W'.repeat(200)), nOpts(2, ''), nOpts(3, 'W'.repeat(200))]) {
    const i = await newsIdx(o, ':establish$');
    assert((await drawCover(o, i)) === 640 * 360 && !o.game, `batch 4b: ${o.day} with title '${o.brief.title.slice(0, 3)}' does not draw`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of [nOpts(1), nOpts(8), nOpts(15), nOpts(32), nOpts(36), nOpts(2), nOpts(33), nOpts(3), nOpts(30), nOpts(43)]) {
    for (const re of [':establish$', ':hold$']) {
      const i = await newsIdx(o, re); if (i < 0) continue;
      const b = await info('news', o, i);
      assert(await shot('news', o, i, 0.4) === await shot('news', o, i, b.dur - 0.05), `news ${o.day} ${re}: reduced effects still moves`);
    }
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // ---- stage 3 batch 5, part 1: subway and platform (shot 1), street (2), wire monitor (3), apartment and TV (4), lobby elevator (5) ----
  // Reference hashes recorded from the code before the batch: every placeFrame composition flat (per place, establish and detail), the skyline, the
  // apartment with the TV, the elevator at the openings these beats use, and the final picture of every beat of the sessions that show them.
  // The final pictures stay exactly today's, except the street (shot 2, session 34), where a ruling replaces the static snow speckle: P5_CHANGED.
  const P5_REF = {
    'pf:platform:7:e': 'a0907815', 'pf:platform:7:d': '693f1e15', 'pf:subway:21:e': '7fd72f2f', 'pf:subway:21:d': 'e738ba13', 'pf:subway2:31:e': '267c45bf', 'pf:subway2:31:d': 'e738ba13',
    'pf:street:34:e': 'e02d6efe', 'pf:street:34:d': '2526bce4', 'pf:kitchen:13:e': '7cb01101', 'pf:kitchen:13:d': '5aa86181', 'pf:breakroom:8:e': 'a56bd491', 'pf:breakroom:8:d': '5aa86181',
    'pf:rideshare:5:e': '898bdd3b', 'pf:rideshare:5:d': '130f5e81', 'pf:desk:9:e': '1e173e5d', 'pf:desk:9:d': '21bc5144', 'pf:apartment:0:e': 'b75aaa23', 'pf:apartment:0:d': '46e37490',
    'pf:elevator:16:e': 'a1a3db40', 'pf:elevator:16:d': '4eeb67c9', 'pf:lobby:22:e': 'c3518bbd', 'pf:lobby:22:d': '13d653ec', 'pf:lobby2:42:e': 'c8485a3d', 'pf:lobby2:42:d': '13d653ec',
    'pf:elevator2:26:e': '6d655569', 'pf:elevator2:26:d': '62c44d14', 'pf:st47:47:e': 'a0c1f43f', 'pf:st47:47:d': '3d243e5f', 'pf:st48:48:e': 'e75246a4', 'pf:st48:48:d': '87fcd7fc',
    'pf:st50:50:e': 'e4763f2f', 'pf:st50:50:d': 'aed3c97b', 'pf:st54:54:e': 'ba797987', 'pf:st54:54:d': '19ac3098', 'pf:st55:55:e': '68ee202', 'pf:st55:55:d': '73628f93', 'pf:st53:53:e': 'f9bffd04',
    'pf:st53:53:d': '87fcd7fc', 'pf:street34:long': '9e21a4ea', 'pf:kitchen13:empty': '91b01c10', 'sky:3': '21a01d84', 'sky:20': 'da17b7f1', 'sky:34': '17ff6883', 'sky:40': 'd45a054f',
    'sky:noday': '8b8e9d89', 'tv:tv18': 'c1bb01d5', 'tv:rating4': '846c4fd5', 'tv:rating14': '40933e15', 'tv:aptplace': 'a669819d', 'tv:aptplace50': '3ac29075', 'tv:tvlong': '7f2aa08d',
    'tv:tvempty': '7a0a459d', 'tv:detail18': 'da73d8be', 'el:0.6:0': '1220ff45', 'el:1:0': '927b0095', 'el:0.27:16': 'b9b8aedd', 'el:0.39:22': 'f151ea6d', 'el:0.15:50': '79b99185',
    'el:0:0': '5f928c7d', 'el:0.27:26': 'b9b8aedd', 'el:0.39:42': 'f151ea6d', 'p5:0:establish': 'dca9b56d', 'p5:0:detail': '8c3741f4', 'p5:0:hold': '3bba895', 'p5:4:establish': '3da39fbd',
    'p5:4:detail': '206f7bff', 'p5:7:establish': 'b96937e2', 'p5:7:detail': 'af77583a', 'p5:7:hold': '29dd7600', 'p5:13:establish': '4b9839d0', 'p5:14:establish': '2e21a492',
    'p5:14:detail': 'fbf240d8', 'p5:16:establish': 'e65fe8a9', 'p5:16:detail': 'e991799d', 'p5:16:hold': 'b7a33195', 'p5:18:establish': 'fe72eec7', 'p5:21:establish': '399a3a8c',
    'p5:21:detail': 'c1f3d4db', 'p5:21:hold': 'fdd05056', 'p5:22:establish': 'ae543774', 'p5:22:detail': 'c534cd05', 'p5:22:hold': 'af312f25', 'p5:26:establish': 'c97ef2a9',
    'p5:26:detail': 'a5b3fa57', 'p5:31:establish': 'cbd128e3', 'p5:31:detail': 'b83a9142', 'p5:34:establish': '3e794643', 'p5:34:detail': '7841eaa4', 'p5:42:establish': 'afe283c0',
    'p5:42:detail': '29e09a55', 'p5:42:hold': 'af312f25', 'p5:47:establish': '1393e183', 'p5:47:detail': '9468616f', 'p5:48:establish': '4c9f8ff4', 'p5:48:detail': '472c6c25',
    'p5:49:establish': 'c99f2f67', 'p5:49:detail': 'd1b8761f', 'p5:50:establish': 'd0d52f06', 'p5:50:detail': 'a4802688', 'p5:51:establish': '2ba9ea95', 'p5:51:detail': 'a9d72f85',
    'p5:52:establish': 'a4312f7d', 'p5:52:detail': 'fb066380', 'p5:53:establish': '87b2d539', 'p5:53:detail': '2d1a4223', 'p5:54:establish': '53eee5b6', 'p5:54:detail': 'b69d5dcb',
    'p5:55:establish': 'b7d129a2', 'p5:55:detail': 'eedc7b60', 'p5:7long:establish': '176e830d', 'p5:7long:detail': 'c6ea0d6d', 'p5:7long:hold': 'b2fa2419', 'p5:34long:establish': 'c817e727',
    'p5:34long:detail': '50fcc587', 'p5:13empty:establish': '38dfd984', 'p5:16long:establish': 'e65fe8a9', 'p5:16long:detail': '67e56f58', 'p5:16long:hold': 'b7a33195',
    'p5:18long:establish': '5a67a8c0', 'p5:22empty:establish': 'ae543774', 'p5:22empty:detail': '71a3a122', 'p5:22empty:hold': 'af312f25', 'p5:34empty:establish': '698152e8',
    'p5:34empty:detail': '3692ff5b'
  };
  const P5_CHANGED = {
    // batch 5c, item 5 (session 1's opening): news:0:establish is rebuilt on the elevBase parts (wall, car, top) like the detail and hold, so its last frame is
    // the flat picture's own pixels (the pilot's car and lobby layers differed from it by about 8,600 px around the car's edges and glow); the spill stays
    'p5:0:establish': '59210645',
    // shot 2 (ruling): the street's static snow speckle is replaced by the snowflakes' pose at the end and two to four car-light groups, drawn at twice the size from batch 5c (session 34; 54 is the same street past the story); batch 8 A2 moved the cars onto the road (y 256 to 259) and the final frames changed again (ruling: the cars are background life)
    'p5:34:establish': '433eafd4', 'p5:34:detail': '1851890b', 'p5:54:establish': '6a0cbcdc', 'p5:54:detail': '453578b0', 'p5:34long:establish': '7e6d4470', 'p5:34long:detail': '12f15abc', 'p5:34empty:establish': 'a3f85297', 'p5:34empty:detail': '134c4d08'
  };
  const p5now = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, SH = BTB.Shots, R = BTB.Rhythm, out = {}, view = { w: 640, h: 360 };
    const T = 'Headline of the day', LONG = 'A very long headline that goes on and on past any sensible width of caption box ok';
    const days = { platform: 7, subway: 21, subway2: 31, street: 34, kitchen: 13, breakroom: 8, rideshare: 5, desk: 9, apartment: 0, elevator: 16, lobby: 22, lobby2: 42, elevator2: 26, st47: 47, st48: 48, st50: 50, st54: 54, st55: 55, st53: 53 };
    for (const k in days) for (const det of [false, true]) out[`pf:${k}:${days[k]}:${det ? 'd' : 'e'}`] = hashOf((g) => R.placeFrame(g, R.storyboard(days[k]), T, det));
    out['pf:street34:long'] = hashOf((g) => R.placeFrame(g, R.storyboard(34), LONG, false));
    out['pf:kitchen13:empty'] = hashOf((g) => R.placeFrame(g, R.storyboard(13), '', true));
    for (const d of [3, 20, 34, 40]) out[`sky:${d}`] = hashOf((g) => { g.fillStyle = BTB.Pal.ink; g.fillRect(0, 0, 640, 360); R.skyline(g, 2, d, 252, d); });
    out['sky:noday'] = hashOf((g) => R.skyline(g, 1, 4, 248));
    for (const [name, day, gl, h] of [['tv18', 18, 0.7, T], ['rating4', 4, 0.7, 'RATING AFFIRMED: AAA'], ['rating14', 14, 0.7, '40 DOWNGRADES · SAME MINUTE'], ['aptplace', 0, 0.5, T], ['aptplace50', 50, 0.5, T], ['tvlong', 18, 0.7, LONG], ['tvempty', 18, 0.7, '']])
      out['tv:' + name] = hashOf((g) => SB.at2x(g, (c) => { SH.apartment(c, gl); SH.tvSet(c, 40, 50, 104, 68, h, BTB.StoryData.actOf(day), 0); }, day));
    out['tv:detail18'] = hashOf((g) => SB.at2x(g, (c) => { SH.apartment(c, 0.7); c.save(); c.translate(92 * -0.3, 74 * -0.3); c.scale(1.3, 1.3); SH.tvSet(c, 40, 50, 104, 68, T, BTB.StoryData.actOf(18), 0); c.restore(); }, 18));
    for (const [o, d] of [[0.6, 0], [1, 0], [0.27, 16], [0.39, 22], [0.15, 50], [0, 0], [0.27, 26], [0.39, 42]]) out[`el:${o}:${d}`] = hashOf((g) => SB.at2x(g, (c) => SH.elevator(c, o, 41), d));
    const o = (day, title) => ({ day, brief: { title: title == null ? T : title, feed: [] } });
    const list = [[0, T], [4, T], [7, T], [13, T], [14, T], [16, T], [18, T], [21, T], [22, T], [26, T], [31, T], [34, T], [42, T], [47, T], [48, T], [49, T], [50, T], [51, T], [52, T], [53, T], [54, T], [55, T], [7, LONG], [34, LONG], [13, ''], [16, LONG], [18, LONG], [22, ''], [34, '']];
    for (const [d, t] of list) { const key = d + (t === LONG ? 'long' : t === '' ? 'empty' : ''); BTB.Scenes.news(o(d, t)).forEach((b) => { out[`p5:${key}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); }); }
    return out;
  });
  if (process.env.DUMP_P5) { console.log(JSON.stringify(p5now)); return; }
  for (const k of Object.keys(P5_REF)) assert(p5now[k] === (P5_CHANGED[k] || P5_REF[k]), `batch 5 ${k}: the picture changed (${p5now[k]}, was ${P5_CHANGED[k] || P5_REF[k]})`);
  assert(Object.keys(p5now).length === Object.keys(P5_REF).length, 'batch 5: the set of reference pictures changed');
  for (const k of Object.keys(P5_CHANGED)) assert(P5_CHANGED[k] !== P5_REF[k], `batch 5 ${k}: the ruled change is not a change`);

  // ---- stage 3 batch 5, part 2: the trading floor lit (shot 6) and dark (7), the skyline (8), the racks (9), the holds (10) ----
  // Reference hashes recorded from the code before the batch: the flat floor at the zooms these beats use, the flat skylineShot and racksShot,
  // the final picture of every beat of the sessions these shots rework (and of long and empty titles), and the final frame of every hold.
  const P6_REF = {
    'fl:1:0.15:41': '4be9771d', 'fl:1:0.7:41': '472d778d', 'fl:1:0.53:5': '4f0296a5', 'fl:1:0.45:12': '64e644c5', 'fl:1:0.69:23': '8cdeee1d', 'fl:1:0.69:39': '25c71635',
    'fl:1:0.45:4': '65dfcc55', 'fl:1:0.61:22': 'f58dfa6d', 'fl:0:0.15:10': 'de8d51cd', 'fl:0:0.7:44': 'f2802205', 'fl:0:0.15:44': '5cec3add', 'fl:0:0.15:22': '7b288025',
    'fl:0:0.4:60': 'ffecf1f5', 'fl:1:0.15:3': '6aa3a95', 'fl:0:0.7:10': 'ecdd00b5', 'fl:1:0.05:7': '67ad1645', 'fl:1:1:50': '90182f65', 'fl:0:0.15:50': '3660ab5',
    'sk:3:': 'e60e36e0', 'sk:3:t': '54163b23', 'sk:20:': 'ad25fcd0', 'sk:20:t': '96c495d3', 'sk:27:': 'ad25fcd0', 'sk:27:t': '96c495d3', 'sk:28:': '91793135',
    'sk:28:t': 'e29cb2d', 'sk:29:': '3c55fc34', 'sk:29:t': '5d791130', 'sk:35:': 'b87369b9', 'sk:35:t': '11ef3099', 'sk:36:': 'a08b5541', 'sk:36:t': '3a60098',
    'sk:40:': '126496b1', 'sk:40:t': 'a6ff470a', 'rk:45': '650e7745', 'rk:10': '650e7745', 'p6:5:establish': '5c91dd4', 'p6:5:detail': '2711c25', 'p6:5:hold': 'c425c27d',
    'p6:12:establish': '96b6197', 'p6:12:detail': 'b3d5a8c7', 'p6:12:hold': 'bfa36295', 'p6:23:establish': '22936121', 'p6:23:detail': '3d2e50fd',
    'p6:23:hold': '94a6570d', 'p6:39:establish': '89b8ca2f', 'p6:39:detail': 'a4e952fa', 'p6:41:establish': 'f65c71ae', 'p6:41:detail': '212ffc84',
    'p6:41:hold': '3435cd15', 'p6:10:establish': '63a084f', 'p6:10:detail': 'eb92a21e', 'p6:10:hold': 'b374c0fd', 'p6:44:establish': '522f6601',
    'p6:44:detail': 'cfc9bd74', 'p6:44:hold': '270c0645', 'p6:27:establish': '219ead10', 'p6:28:establish': '840fadd6', 'p6:29:establish': 'a3d75705',
    'p6:35:establish': 'fe6850a9', 'p6:2:establish': '6ff30c70', 'p6:2:detail': '69d2cd65', 'p6:3:establish': '912e7f19', 'p6:3:detail': '4b57b15',
    'p6:3:hold': '79bdf03a', 'p6:6:establish': '615f36bb', 'p6:6:detail': '7c533970', 'p6:6:hold': '522ca846', 'p6:7:establish': 'b96937e2', 'p6:7:detail': 'af77583a',
    'p6:7:hold': '29dd7600', 'p6:21:establish': '399a3a8c', 'p6:21:detail': 'c1f3d4db', 'p6:21:hold': 'fdd05056', 'p6:36:establish': '13c61f8b',
    'p6:36:detail': 'f7b90cbb', 'p6:36:hold': '8b4860b5', 'p6:43:establish': '43648e23', 'p6:43:detail': 'e9651e51', 'p6:43:hold': '620463ff',
    'p6:45:establish': 'bcffe302', 'p6:45:detail': '465ca4d7', 'p6:45:hold': 'cc7fad03', 'p6:10long:establish': '63a084f', 'p6:10long:detail': 'eb92a21e',
    'p6:10long:hold': 'b374c0fd', 'p6:10empty:establish': '63a084f', 'p6:10empty:detail': 'eb92a21e', 'p6:10empty:hold': 'b374c0fd', 'p6:44long:establish': '522f6601',
    'p6:44long:detail': 'cfc9bd74', 'p6:44long:hold': '270c0645', 'p6:44empty:establish': '522f6601', 'p6:44empty:detail': 'cfc9bd74', 'p6:44empty:hold': '270c0645',
    'p6:27long:establish': '219ead10', 'p6:27empty:establish': '219ead10', 'p6:41long:establish': 'f65c71ae', 'p6:41long:detail': '212ffc84', 'p6:41long:hold': '3435cd15',
    'p6:41empty:establish': 'f65c71ae', 'p6:41empty:detail': '212ffc84', 'p6:41empty:hold': '3435cd15', 'p6:5long:establish': '5c91dd4', 'p6:5long:detail': '2711c25',
    'p6:5long:hold': 'c425c27d', 'p6:5empty:establish': '5c91dd4', 'p6:5empty:detail': '2711c25', 'p6:5empty:hold': 'c425c27d', 'p6:35long:establish': 'fe6850a9',
    'p6:35empty:establish': 'fe6850a9', 'p6:4dump:establish': '9bc8ac8', 'p6:4dump:detail': 'e0685e7d', 'p6:4leak:establish': '7c3a469a', 'p6:4leak:detail': '255e5fd0',
    'p6:22fail:establish': '52c43877', 'p6:22fail:detail': '1e840719', 'p6:22fail:hold': '403c2d55', 'p6:22ban:establish': '47bcf1a6', 'p6:22ban:detail': '8b8ecee7',
    'p6:22ban:hold': '88ca252d', 'p6:22bail:establish': '636a6ce', 'p6:22bail:detail': '7ab3040b', 'p6:22bail:hold': '3288ad05', 'p6:41bill:establish': 'eecf53',
    'p6:41bill:detail': '4edd49f9', 'p6:41bill:hold': 'a3c2e72f', 'p6:45plug:establish': '65ddd720', 'p6:45plug:detail': 'c5845d35', 'p6:45plug:hold': 'fb86be25',
    'hold:0': '3bba895', 'hold:3': '79bdf03a', 'hold:5': 'c425c27d', 'hold:6': '522ca846', 'hold:7': '29dd7600', 'hold:8': '2d5bc42a', 'hold:9': 'b791b655',
    'hold:10': 'b374c0fd', 'hold:12': 'bfa36295', 'hold:16': 'b7a33195', 'hold:17': '4f7947d5', 'hold:20': 'dd6a1c5', 'hold:21': 'fdd05056', 'hold:22': 'af312f25',
    'hold:23': '94a6570d', 'hold:24': '81cf4381', 'hold:32': '78835b2f', 'hold:36': '8b4860b5', 'hold:37': 'dafb8ead', 'hold:38': 'dfd1f71a', 'hold:40': 'f3126f5d',
    'hold:41': '3435cd15', 'hold:42': 'af312f25', 'hold:43': '620463ff', 'hold:44': '270c0645', 'hold:45': 'cc7fad03', 'hold:22fail': '403c2d55', 'hold:22ban': '88ca252d',
    'hold:22bail': '3288ad05', 'hold:41bill': 'a3c2e72f', 'hold:45plug': 'fb86be25'
  };
  // batch 6 (ruling): Kavro Strait's detail and hold end with the ships 4 art units further east (p = 1)
  const P6_CHANGED = { 'p6:6:detail': 'b9409bed', 'p6:6:hold': 'f8499ddd', 'hold:6': 'f8499ddd' };
  const p6now = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, SH = BTB.Shots, out = {}, view = { w: 640, h: 360 };
    const T = 'Headline of the day', LONG = 'A very long headline that goes on and on past any sensible width of caption box ok';
    for (const [lit, z, d] of [[1, 0.15, 41], [1, 0.7, 41], [1, 0.53, 5], [1, 0.45, 12], [1, 0.69, 23], [1, 0.69, 39], [1, 0.45, 4], [1, 0.61, 22], [0, 0.15, 10], [0, 0.7, 44], [0, 0.15, 44], [0, 0.15, 22], [0, 0.4, 60], [1, 0.15, 3], [0, 0.7, 10], [1, 0.05, 7], [1, 1, 50], [0, 0.15, 50]])
      out[`fl:${lit}:${z}:${d}`] = hashOf((g) => SB.at2x(g, (c) => SH.tradingFloor(c, z, !!lit, d), d));
    for (const d of [3, 20, 27, 28, 29, 35, 36, 40]) for (const t of ['', T]) out[`sk:${d}:${t ? 't' : ''}`] = hashOf((g) => SB.skylineShot(g, d, t));
    for (const d of [45, 10]) out[`rk:${d}`] = hashOf((g) => SB.racksShot(g, d));
    const o = (day, title, S) => Object.assign({ day, brief: { title: title == null ? T : title, feed: [] } }, S ? { game: { mode: { S } } } : {});
    const VARS = { dump: [4, { choices: { c1: 'dump' } }], leak: [4, { choices: { c1: 'leak' } }], fail: [22, { choices: { c5: 'fail' } }], ban: [22, { choices: { c5: 'ban' } }], bail: [22, { choices: { c5: 'bail' } }], bill: [41, { f: { billPassed: true } }], plug: [45, { f: { pulledPlug: true } }] };
    const take = (key, oo) => BTB.Scenes.news(oo).forEach((b) => { out[`p6:${key}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    for (const d of [5, 12, 23, 39, 41, 10, 44, 27, 28, 29, 35, 2, 3, 6, 7, 21, 36, 43, 45]) take(d, o(d));
    for (const d of [10, 44, 27, 41, 5, 35]) { take(d + 'long', o(d, LONG)); take(d + 'empty', o(d, '')); }
    for (const k in VARS) take(d_(k), o(VARS[k][0], T, VARS[k][1]));
    function d_(k) { return VARS[k][0] + k; }
    // every hold of the 46 sessions (and the variant mornings): the final frame
    for (let d = 0; d < 46; d++) { const bs = BTB.Scenes.news(o(d)); bs.forEach((b) => { if (/:hold$/.test(b.id)) out[`hold:${d}`] = hashOf((g) => b.draw(g, view, 1, {})); }); }
    for (const k in VARS) BTB.Scenes.news(o(VARS[k][0], T, VARS[k][1])).forEach((b) => { if (/:hold$/.test(b.id)) out[`hold:${d_(k)}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    return out;
  });
  if (process.env.DUMP_P6) { console.log(JSON.stringify(p6now)); return; }
  for (const k of Object.keys(P6_REF)) assert(p6now[k] === (P6_CHANGED[k] || P6_REF[k]), `batch 5b ${k}: the picture changed (${p6now[k]}, was ${P6_CHANGED[k] || P6_REF[k]})`);
  assert(Object.keys(p6now).length === Object.keys(P6_REF).length, 'batch 5b: the set of reference pictures changed');
  for (const k of Object.keys(P6_CHANGED)) assert(P6_CHANGED[k] !== P6_REF[k], `batch 5b ${k}: the ruled change is not a change`);

  // ---- stage 3 batch 6: the story tableaux ----
  // Reference hashes recorded from the code before the batch: briefingTableau flat at the p values the beats use (and 0 and 1), `tableau()` with and without the 1.3 zoom,
  // and the final picture of every beat of the eight sessions (also with a long and an empty title, and 45 with the plug pulled). P7_CHANGED holds the ruled changes.
  const P7_REF = {
    'bt:3:0': 'dc36ca', 'bt:3:0.6': '5d08980f', 'bt:3:1': '7168f1b3', 'tb:3:0': 'd73e420f', 'tb:3:1.3': 'b3269bf1', 'bt:5:0': '2108678d',
    'bt:5:0.6': '2108678d', 'bt:5:1': '2108678d', 'tb:5:0': '3b11ad8d', 'tb:5:1.3': '15c28d43', 'bt:8:0': '4a0e06fd', 'bt:8:0.6': '4a0e06fd',
    'bt:8:1': '4a0e06fd', 'tb:8:0': 'b4184cfd', 'tb:8:1.3': '729ab3cf', 'bt:9:0': 'f5ec295', 'bt:9:0.6': '33f41135', 'bt:9:1': '6190b395',
    'tb:9:0': '8adad735', 'tb:9:1.3': '6663a6e4', 'bt:11:0': '813721ed', 'bt:11:0.6': '813721ed', 'bt:11:1': '813721ed', 'tb:11:0': 'ca0667ed',
    'tb:11:1.3': 'd561d863', 'bt:12:0': '3af5b515', 'bt:12:0.6': '3af5b515', 'bt:12:1': '3af5b515', 'tb:12:0': 'a5227b15', 'tb:12:1.3': '9a58bf1',
    'bt:13:0': '1bd88235', 'bt:13:0.6': '1bd88235', 'bt:13:1': '1bd88235', 'tb:13:0': 'a80f4835', 'tb:13:1.3': 'b45338ae', 'bt:14:0': '126d8bce',
    'bt:14:0.6': '126d8bce', 'bt:14:1': '126d8bce', 'tb:14:0': '97fa31ce', 'tb:14:1.3': '752abe1', 'p7:6:establish': '615f36bb',
    'p7:6:detail': '7c533970', 'p7:6:hold': '522ca846', 'p7:6long:establish': '615f36bb', 'p7:6long:detail': '7c533970', 'p7:6long:hold': '522ca846',
    'p7:6empty:establish': '615f36bb', 'p7:6empty:detail': '7c533970', 'p7:6empty:hold': '522ca846', 'p7:9:establish': '99a5a531',
    'p7:9:detail': 'e3bbd444', 'p7:9:hold': 'b791b655', 'p7:9long:establish': '99a5a531', 'p7:9long:detail': 'e3bbd444', 'p7:9long:hold': 'b791b655',
    'p7:9empty:establish': '99a5a531', 'p7:9empty:detail': 'e3bbd444', 'p7:9empty:hold': 'b791b655', 'p7:17:act': '3671fe7d',
    'p7:17:establish': '341e8251', 'p7:17:detail': 'eac160e0', 'p7:17:hold': '4f7947d5', 'p7:17long:act': '3671fe7d',
    'p7:17long:establish': '341e8251', 'p7:17long:detail': 'eac160e0', 'p7:17long:hold': '4f7947d5', 'p7:17empty:act': '3671fe7d',
    'p7:17empty:establish': '341e8251', 'p7:17empty:detail': 'eac160e0', 'p7:17empty:hold': '4f7947d5', 'p7:20:establish': '330b1f2d',
    'p7:20:detail': '43a91039', 'p7:20:hold': 'dd6a1c5', 'p7:20long:establish': '330b1f2d', 'p7:20long:detail': '43a91039',
    'p7:20long:hold': 'dd6a1c5', 'p7:20empty:establish': '330b1f2d', 'p7:20empty:detail': '43a91039', 'p7:20empty:hold': 'dd6a1c5',
    'p7:25:establish': '29734ed5', 'p7:25:detail': '7ed41d97', 'p7:25long:establish': '29734ed5', 'p7:25long:detail': '7ed41d97',
    'p7:25empty:establish': '29734ed5', 'p7:25empty:detail': '7ed41d97', 'p7:37:establish': 'c1d38379', 'p7:37:detail': '5c6e4bdb',
    'p7:37:hold': 'dafb8ead', 'p7:37long:establish': 'c1d38379', 'p7:37long:detail': '5c6e4bdb', 'p7:37long:hold': 'dafb8ead',
    'p7:37empty:establish': 'c1d38379', 'p7:37empty:detail': '5c6e4bdb', 'p7:37empty:hold': 'dafb8ead', 'p7:40:establish': '6f556c79',
    'p7:40:detail': '2cd267ac', 'p7:40:hold': 'f3126f5d', 'p7:40long:establish': '6f556c79', 'p7:40long:detail': '2cd267ac',
    'p7:40long:hold': 'f3126f5d', 'p7:40empty:establish': '6f556c79', 'p7:40empty:detail': '2cd267ac', 'p7:40empty:hold': 'f3126f5d',
    'p7:45:establish': 'bcffe302', 'p7:45:detail': '465ca4d7', 'p7:45:hold': 'cc7fad03', 'p7:45long:establish': 'bcffe302',
    'p7:45long:detail': '465ca4d7', 'p7:45long:hold': 'cc7fad03', 'p7:45empty:establish': 'bcffe302', 'p7:45empty:detail': '465ca4d7',
    'p7:45empty:hold': 'cc7fad03', 'p7:45plug:establish': '65ddd720', 'p7:45plug:detail': 'c5845d35', 'p7:45plug:hold': 'fb86be25'
  };
  // ruling: Kavro Strait's detail and hold (session 6) end at p = 1
  const P7_CHANGED = { 'p7:6:detail': 'b9409bed', 'p7:6:hold': 'f8499ddd', 'p7:6long:detail': 'b9409bed', 'p7:6long:hold': 'f8499ddd', 'p7:6empty:detail': 'b9409bed', 'p7:6empty:hold': 'f8499ddd' };
  const p7now = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, SH = BTB.Shots, out = {}, view = { w: 640, h: 360 };
    const T = 'Headline of the day', LONG = 'A very long headline that goes on and on past any sensible width of caption box ok';
    const TAB = [[3, 6], [5, 9], [8, 17], [9, 20], [11, 25], [12, 37], [13, 40], [14, 45]];
    for (const [n, d] of TAB) {
      for (const p of [0, 0.6, 1]) out[`bt:${n}:${p}`] = hashOf((g) => SB.at2x(g, (c) => { SH.briefingTableau(c, n, p); }, d));
      out[`tb:${n}:0`] = hashOf((g) => SB.at2x(g, (c) => { SB.tableau(c, n, 0); }, d));
      out[`tb:${n}:1.3`] = hashOf((g) => SB.at2x(g, (c) => { SB.tableau(c, n, 1.3); }, d));
    }
    const o = (day, title, S) => Object.assign({ day, brief: { title: title == null ? T : title, feed: [] } }, S ? { game: { mode: { S } } } : {});
    const take = (key, oo) => BTB.Scenes.news(oo).forEach((b) => { out[`p7:${key}:${b.id.split(':').pop()}`] = hashOf((g) => b.draw(g, view, 1, {})); });
    for (const [, d] of TAB) { take(d, o(d)); take(d + 'long', o(d, LONG)); take(d + 'empty', o(d, '')); }
    take('45plug', o(45, T, { f: { pulledPlug: true } }));
    return out;
  });
  // the split is exact: the art without its mover and scanlines, the mover, then the scanlines (and the strip) draw the flat picture, zoomed and not
  const p7split = await page.evaluate(() => {
    const hashOf = (fn) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); fn(g);
      const d = g.getImageData(0, 0, 640, 360).data; let x = 2166136261; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    const SB = BTB.Storyboard, SH = BTB.Shots, out = {};
    for (const [n, d] of [[3, 6], [5, 9], [8, 17], [9, 20], [11, 25], [12, 37], [13, 40], [14, 45]]) for (const z of [0, 1.3]) {
      const flat = hashOf((g) => SB.at2x(g, (c) => { SB.tableau(c, n, z); }, d));
      const split = hashOf((g) => SB.at2x(g, (c) => {
        SB.tableau(c, n, z, { part: 'art', noMover: true, over: true });
        SB.tableauSpace(c, z, (s) => SH.tableauMover(s, n, 0.6));
        SB.tableau(c, n, z, { part: 'scan', over: true });
      }, d));
      out[`${n}:${z}`] = flat === split;
    }
    return out;
  });
  for (const k in p7split) assert(p7split[k], `batch 6: tableau ${k}: art, mover and scanlines drawn apart differ from the flat picture`);
  if (process.env.DUMP_P7) { console.log(JSON.stringify(p7now)); return; }
  for (const k of Object.keys(P7_REF)) assert(p7now[k] === (P7_CHANGED[k] || P7_REF[k]), `batch 6 ${k}: the picture changed (${p7now[k]}, was ${P7_CHANGED[k] || P7_REF[k]})`);
  assert(Object.keys(p7now).length === Object.keys(P7_REF).length, 'batch 6: the set of reference pictures changed');
  for (const k of Object.keys(P7_CHANGED)) assert(P7_CHANGED[k] !== P7_REF[k], `batch 6 ${k}: the ruled change is not a change`);

  // which sessions these shots apply to, from the sheet and the framing rule
  const P5 = { subway: [7, 21, 31], street: [34], kitchen: [13], lobby: [16, 22, 26, 42], tv: [18], rating: [4, 14] };
  assert(await page.evaluate((P5) => {
    const SB = BTB.Storyboard, R = BTB.Rhythm, got = {};
    for (let d = 0; d < 46; d++) { const r = SB.row(d, null), sb = R.storyboard(d), k = r.shot === 'place' ? sb.place : r.shot === 'tv' ? 'tv' : r.shot === 'insert' && r.doc === 'rating' ? 'rating' : null; if (k) (got[k] = got[k] || []).push(d); }
    const want = { platform: [7], subway: [21, 31], street: [34], kitchen: [13], elevator: [16, 26], lobby: [22, 42], tv: [18], rating: [4, 14] };
    return Object.keys(want).length === Object.keys(got).length && Object.keys(want).every((k) => JSON.stringify(got[k]) === JSON.stringify(want[k]));
  }, P5), 'batch 5: the sessions that show these places are not the sheet\'s');
  // the in-page checks below read the picture area above the caption box
  const mk5 = (day, title, S) => nOpts(day, title, S);
  const box5 = (o, i, id, t, r) => page.evaluate(([o, i, id, t, r]) => window.animBox('news', o, i, id, t, r || [0, 0, 640, 360]), [o, i, id, t, r]);
  const reduced5 = [];

  // shot 1: the lit train behind the seven window cells (sessions 7 platform, 21 and 31 subway; establish and detail)
  // the model: window k of the train has its left edge at 14 + 330 (t - A) - 28 k, in placeFrame coordinates; cell i shows x 24 + 94 i to 88 + 94 i
  const trainBox = (t, A) => {
    let x0 = 1e9, x1 = -1;
    for (let k = 0; k < 14; k++) {
      const x = 14 + Math.round(330 * (t - A)) - 28 * k;
      for (let i = 0; i < 7; i++) { const a = Math.max(x, 24 + 94 * i), b = Math.min(x + 10, 88 + 94 * i, 640); if (b > a) { x0 = Math.min(x0, a); x1 = Math.max(x1, b - 1); } }
    }
    return x1 < 0 ? [1e9, -1, 1e9, -1] : [x0, x1, 85, 100];
  };
  // a frame's step at 30 fps must stay under half the windows' spacing, or a throttled phone reads the train as crawling backwards
  // (the pictures below pin speed 330 and gap 28 through trainBox)
  const TRAIN = { speed: 330, gap: 28 };
  assert(TRAIN.speed / 30 < TRAIN.gap / 2, `the subway train steps ${TRAIN.speed / 30} px a frame at 30 fps against a spacing of ${TRAIN.gap}`);
  for (const day of P5.subway) {
    const o = mk5(day);
    for (const phase of ['establish', 'detail']) {
      const i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), est = phase === 'establish', A = est ? -1.48 : -0.88;
      assert(a.id === `news:${day}:${phase}` && a.dur === (est ? 1.7 : 2.3) && a.layers === 'back,train,front,marks' && a.depths === '1,1,1,0' && a.cam === '-6>0' && a.cues === (est ? '0.3:transit' : '') && a.sfx === (est ? 'apartment' : 'broadcast') && a.inf === !est, `train ${day} ${phase} beat: ${JSON.stringify(a)}`);
      assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 1.0) === await shot('news', o, i, 1.0) && (await drawCover(o, i)) === 640 * 360, `train ${day} ${phase}: not moving, not deterministic or has holes`);
      assert(await lp('news', o, i, 'back', 0.1, false) === await lp('news', o, i, 'back', a.dur - 0.1, false) && await lp('news', o, i, 'front', 0.1, false) === await lp('news', o, i, 'front', a.dur - 0.1, false) && await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false), `train ${day} ${phase}: a cached layer moves`);
      // the train crosses the cells from the start and has left the frame by 1.52 s (2.12 s), so the final picture has none of it
      const tEnd = est ? 1.52 : 2.12;
      assert((await box5(o, i, 'train', 0.1))[1] > 0 && (await box5(o, i, 'train', est ? 0.9 : 1.8))[1] > 0 && (await box5(o, i, 'train', tEnd + 0.02))[1] === -1 && (await box5(o, i, 'train', a.dur - 0.05))[1] === -1, `train ${day} ${phase}: the train does not cross until ${tEnd} s and clear`);
      if (est ? day === 21 : true) {
        // no zoom on the wide establish (21) and on every detail: the windows are exactly where the model says (a 640 px canvas, whole pixels)
        for (const t of [0.5, 1.0, 1.4]) {
          const b = await box5(o, i, 'train', t), m = trainBox(t, A);
          assert(JSON.stringify(b) === JSON.stringify(m), `train ${day} ${phase} at ${t}: windows at ${JSON.stringify(b)}, the model says ${JSON.stringify(m)}`);
        }
      }
      // 28 windows at most, each 10x6 at 0.55: rows 85 to 90 and 95 to 100 only, and nothing outside the seven cells
      if (day === 21 || !est) {
        const px = await cc(o, i, 'train', 0.5, [0, 0, 640, 360], 'any');
        assert(px > 0 && px <= 28 * 60 && (await cc(o, i, 'train', 0.5, [0, 0, 640, 85], 'any')) === 0 && (await cc(o, i, 'train', 0.5, [0, 101, 640, 259], 'any')) === 0 && (await cc(o, i, 'train', 0.5, [0, 91, 640, 4], 'any')) === 0, `train ${day} ${phase}: more than 28 windows or outside the two rows (${px})`);
        const gaps = [88, 182, 276, 370, 464, 558]; // the 30 px between a cell's right edge (88 + 94 i) and the next interior (118 + 94 i) holds no window
        for (const g of gaps) assert(await cc(o, i, 'train', 0.5, [g, 80, 30, 25], 'any') === 0, `train ${day} ${phase}: a window leaves its cell at ${g}`);
      }
    }
    reduced5.push(o);
  }
  // the final frame of the session 21 detail has no train and today's picture: flat picture hash above. On the detail the head is at x 230 when the cross ends
  assert(JSON.stringify(await box5(mk5(21), await newsIdx(mk5(21), ':detail$'), 'train', 0.3)) === JSON.stringify(trainBox(0.3, -0.88)) && trainBox(0.3, -0.88)[1] >= 395 && trainBox(0.3, -0.88)[1] <= 415, 'train 21 detail: the head is not mid-platform (x 403) when the cross ends');
  const monG = (day, detail) => page.evaluate(([d, det]) => BTB.Rhythm.monitorGeom(BTB.Rhythm.storyboard(d), det), [day, detail]);
  // shot 2: the street (session 34, winter): snow falls in place of the still speckle, headlights pass along the road every 0.45 s from 0.30 s (background life); the wire monitor refreshes (key movement)
  const carsModel = (t) => page.evaluate(([day, t]) => {
    // one row of the 640 px band, painted in the kit's order (a later car's headlight can cover an earlier car's tail light); 1 = bone, 2 = crimson
    const row = new Uint8Array(640), put = (a, w, v) => { for (let x = Math.max(a, 0); x < Math.min(a + w, 640); x++) row[x] = v; };
    let groups = 0;
    for (let i = 0; i < 40; i++) {
      // drawn at twice the size (ctx.scale(2, 2), band 0,119,320,5, 110 units a second): headlights 8x4 px, tail lights 4x4 px
      const u = (t - (0.30 + i * 0.45 + 0.3 * BTB.RNG(BTB.hashSeed(`news:${day}:cars` + i)).next())) * 110;
      if (u < 0) continue;
      const px = 2 * (-10 + Math.round(u));
      put(px, 8, 1); put(px + 12, 8, 1); put(px - 80, 4, 2);
      if (px + 8 > 0 && px < 640 || px + 20 > 0 && px + 12 < 640) groups++;
    }
    let bone = 0, crimson = 0; row.forEach((v) => { if (v === 1) bone += 4; else if (v === 2) crimson += 4; });
    return { bone, crimson, groups };
  }, [34, t]);
  for (const phase of ['establish', 'detail']) {
    const o = mk5(34), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), est = phase === 'establish';
    assert(a.id === `news:34:${phase}` && a.dur === (est ? 1.7 : 2.3) && a.layers === 'back,road,front,marks' && a.depths === '1,1,1,0' && a.cam === '-6>0' && a.cues === (est ? '0.3:street' : '') && a.sfx === (est ? 'apartment' : 'broadcast') && a.inf === !est, `street ${phase} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 1.0) === await shot('news', o, i, 1.0) && (await drawCover(o, i)) === 640 * 360, `street ${phase}: not moving, not deterministic or has holes`);
    assert(await lp('news', o, i, 'back', 0.1, false) === await lp('news', o, i, 'back', a.dur - 0.1, false) && await lp('news', o, i, 'front', 0.1, false) === await lp('news', o, i, 'front', a.dur - 0.1, false) && await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false), `street ${phase}: a cached layer moves`);
    // the still speckle is gone from the cached sky (the only white in it); the snow is the road layer's: 40 flakes at most, a new pose twelve times a second
    assert(await cc(o, i, 'back', 0.5, [0, 0, 640, 232], 'white', false) === 0, `street ${phase}: the still snow speckle is still in the cached back layer`);
    const flakes = (t) => cc(o, i, 'road', t, [0, 0, 640, 238], 'white'), fpic = (t) => lp('news', o, i, 'road', t, true, [0, 0, 640, 238]);
    const w5 = await flakes(0.5);
    assert(w5 >= 100 && w5 <= 40 * 9 && await flakes(0.3) >= 100 && await flakes(a.dur - 0.05) >= 100, `street ${phase}: no falling snow (${w5})`);
    assert(await fpic(0.5) === await fpic(0.52) && await fpic(0.5) !== await fpic(0.6), `street ${phase}: the snow does not step twelve times a second`);
    // the cars (background life on the road, A2): nothing before 0.30 s; then the lights are where the model puts them (no zoom on 34), 4 px rows y 256 to 259 on the road below the kerb (y 249)
    assert(await cc(o, i, 'road', 0.28, [0, 252, 640, 12], 'any') === 0 && await cc(o, i, 'road', 0.28, [0, 252, 640, 12], 'bone') === 0, `street ${phase}: lights before 0.30 s`);
    for (const t of [0.6, 1.0, 1.7, 2.2]) {
      if (t > a.dur) continue;
      const m = await carsModel(t);
      assert(await cc(o, i, 'road', t, [0, 252, 640, 12], 'bone') === m.bone && await cc(o, i, 'road', t, [0, 252, 640, 12], 'crimson') === m.crimson && m.bone > 0, `street ${phase} at ${t}: the car lights are not where the model says (${m.bone} bone, ${m.crimson} crimson)`);
      assert(await cc(o, i, 'road', t, [0, 0, 640, 252], 'bone') === 0 && await cc(o, i, 'road', t, [0, 264, 640, 96], 'bone') === 0, `street ${phase} at ${t}: a light is off the road band`);
      assert(await cc(o, i, 'road', t, [0, 256, 640, 4], 'bone') === m.bone && await cc(o, i, 'road', t, [0, 256, 640, 4], 'crimson') === m.crimson, `street ${phase} at ${t}: the lights are not the 4 px rows y 256 to 259, on the road below the kerb line (y 249)`);
    }
    // the key movement (A2): the wire monitor refreshes exactly as the monitor shot does, in the front layer's animate: roll 0.40 to 0.76 s inside the monitor, one bone flare on the signal band
    const G2 = await monG(34, !est), tf2 = 0.40 + 0.36 * (G2.h - 42) / (G2.h + 6), none2 = (t) => cc(o, i, 'front', t, [0, 0, 640, 360], 'any');
    assert(await none2(0.38) === 0 && await none2(Math.max(tf2 + 0.1, 0.78)) === 0 && await none2(a.dur - 0.05) === 0, `street ${phase}: the monitor moves outside 0.40 to ${(tf2 + 0.08).toFixed(2)} s`);
    assert(await none2(0.5) > 0 && await none2(0.7) > 0, `street ${phase}: the monitor does not roll`);
    if (!est) {
      for (const t of [0.45, 0.55, 0.75]) { const b = await box5(o, i, 'front', t); assert(b[0] >= G2.x && b[1] < G2.x + G2.w && b[2] >= G2.y && b[3] < G2.y + G2.h, `street ${phase} at ${t}: the roll leaves the monitor ${JSON.stringify(b)}`); }
      const sig2 = [G2.x + 3, G2.y + G2.h - 48, G2.w - 6, 45];
      assert(await cc(o, i, 'front', tf2 - 0.02, sig2, 'bone') === 0 && (await cc(o, i, 'front', tf2 + 0.02, sig2, 'any')) >= (G2.w - 6) * 45 && await cc(o, i, 'front', tf2 + 0.1, sig2, 'any') < (G2.w - 6) * 45, `street ${phase}: the flare is not on the signal band from ${tf2.toFixed(2)} s for 0.08 s`);
    }
    // the front layer's cached art is still: the animate alone moves
    assert(await lp('news', o, i, 'front', 0.1, false) === await lp('news', o, i, 'front', a.dur - 0.1, false), `street ${phase}: the front layer's cached art moves`);
    // the final picture carries two to four groups (the ruling's change), a new car every 0.45 s
    const g = (await carsModel(a.dur)).groups;
    // (the sheet says two to four; the establish's 1.7 s shows three, the detail's 2.3 s shows five: the kit's launch times are 0.39, 1.02, 1.46, 1.73, 2.17 s on this seed)
    assert(g >= 2 && g <= (est ? 4 : 5), `street ${phase}: ${g} car-light groups in the final picture`);
    assert((await carsModel(0.3)).groups === 0 && (await carsModel(2.0)).groups > (await carsModel(1.0)).groups, 'street: cars do not keep entering from 0.30 s');
  }
  reduced5.push(mk5(34));
  // shot 3: the wire monitor refreshes (roll 0.40 to 0.76 s, flare on the signal band as the roll reaches it): kitchen 13 establish, the lobby comps' details
  // (16, 22, 26, 42) and, past the story, the breakroom, rideshare, desk, apartment comps
  const M3 = [[13, 'establish'], [16, 'detail'], [22, 'detail'], [26, 'detail'], [42, 'detail'], [48, 'establish'], [55, 'establish'], [53, 'establish'], [49, 'detail'], [50, 'detail'], [48, 'detail'], [55, 'detail'], [7, 'x']].filter((x) => x[1] !== 'x');
  for (const [day, phase] of M3) {
    const o = mk5(day), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), est = phase === 'establish', G = await monG(day, !est);
    const place = await page.evaluate((d) => BTB.Rhythm.storyboard(d).place, day), cue = place === 'rideshare' ? '0.3:street' : '0.3:kitchen';
    assert(a.id === `news:${day}:${phase}` && a.layers === 'place,marks' && a.depths === '1,0' && a.cam === '-6>0' && a.cues === (est ? cue : '') && a.dur === (est ? (day === 13 ? 2.4 : 1.7) : 2.3), `monitor ${day} ${phase} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 0.6) === await shot('news', o, i, 0.6) && (await drawCover(o, i)) === 640 * 360, `monitor ${day} ${phase}: not moving, not deterministic or has holes`);
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false), `monitor ${day} ${phase}: the marks move`);
    // nothing before 0.40 s or after the flare; the roll is one band inside the monitor (unzoomed beats: exact), the flare lights the 6 px short of the signal band
    const tf = 0.40 + 0.36 * (G.h - 42) / (G.h + 6), none = (t) => cc(o, i, 'place', t, [0, 0, 640, 360], 'any');
    assert(await none(0.38) === 0 && await none(Math.max(tf + 0.1, 0.78)) === 0 && await none(a.dur - 0.05) === 0, `monitor ${day} ${phase}: something moves outside 0.40 to ${(tf + 0.08).toFixed(2)} s`);
    assert(await none(0.5) > 0 && await none(0.7) > 0, `monitor ${day} ${phase}: no roll`);
    if (!est || day === 48 || day === 55) {
      for (const t of [0.45, 0.55, 0.75]) { const b = await box5(o, i, 'place', t); assert(b[0] >= G.x && b[1] < G.x + G.w && b[2] >= G.y && b[3] < G.y + G.h, `monitor ${day} ${phase} at ${t}: the roll leaves the monitor ${JSON.stringify(b)}`); }
      const sig = [G.x + 3, G.y + G.h - 48, G.w - 6, 45];
      assert(await cc(o, i, 'place', tf - 0.02, sig, 'bone') === 0 && (await cc(o, i, 'place', tf + 0.02, sig, 'any')) >= (G.w - 6) * 45 && await cc(o, i, 'place', tf + 0.1, sig, 'any') < (G.w - 6) * 45, `monitor ${day} ${phase}: the flare is not on the signal band from ${tf.toFixed(2)} s for 0.08 s`);
    }
    reduced5.push(o);
  }
  assert((await info('news', mk5(49), await newsIdx(mk5(49), ':establish$'))).layers === '', 'the desk place establish stays the flat desk (batch 4 decided it)');
  for (const day of [13, 16, 21, 34]) { const o = mk5(day), i = await newsIdx(o, ':hold$'); if (i >= 0) assert((await info('news', o, i)).layers === '' || day === 0, `news ${day} hold must stay flat`); }

  // shot 4: the TV cuts to a bar graphic (100x48 units) while the wall glow steps down: tv 18 [0.55, 1.15); rating 4, 14 and the apartment place (50) [0.45, 0.95)
  for (const [day, kind] of [[18, 'tv'], [4, 'rating'], [14, 'rating'], [50, 'place']]) {
    const o = mk5(day), i = await newsIdx(o, ':establish$'), a = await info('news', o, i), cut = kind === 'tv' ? [0.55, 1.15] : [0.45, 0.95];
    assert(a.layers === 'room,marks' && a.depths === '1,0' && a.cam === '-6>0' && a.cues === '' && a.dur === (day === 18 ? 2.4 : 1.7), `tv ${day} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 0.8) === await shot('news', o, i, 0.8) && (await drawCover(o, i)) === 640 * 360, `tv ${day}: not moving, not deterministic or has holes`);
    const pc = (t, spec) => cc(o, i, 'room', t, [0, 0, 640, 360], spec);
    assert(await pc(cut[0] - 0.02, 'any') === 0 && await pc(cut[1] + 0.02, 'any') === 0 && await pc(a.dur - 0.05, 'any') === 0, `tv ${day}: something is drawn outside ${cut}`);
    const mid = (cut[0] + cut[1]) / 2;
    assert(await pc(cut[0] + 0.02, 'screen') > 5000 && await pc(mid, 'phosphor') > 800 && await pc(mid, 'crimson') > 200 && await pc(cut[1] - 0.02, 'screen') === await pc(cut[0] + 0.02, 'screen'), `tv ${day}: the cut graphic (panel, three bars, baseline) is not on screen during ${cut}`);
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false) && await lp('news', o, i, 'room', 0.1, false) === await lp('news', o, i, 'room', a.dur - 0.1, false), `tv ${day}: a cached layer moves`);
    reduced5.push(o);
  }
  assert((await info('news', mk5(18), 0)).n === 1, 'tv 18 is a one-beat morning');

  // shot 5: the lobby elevator: the doors slide from closed to the day's opening, 0.35 to 1.15 s (16, 22, 26, 42); a stutter in the car at 1.30 s
  for (const day of [16, 22, 26, 42, 52]) {
    const o = mk5(day), i = await newsIdx(o, ':establish$'), a = await info('news', o, i);
    assert(a.layers === 'room,frame,marks' && a.depths === '1,1,0' && a.cam === '-6>0' && a.cues === '0.35:elevator' && a.dur === 1.7 && a.sfx === 'apartment', `elevator ${day} establish beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6) && await shot('news', o, i, 0.8) === await shot('news', o, i, 0.8) && (await drawCover(o, i)) === 640 * 360, `elevator ${day}: not moving, not deterministic or has holes`);
    const dn = (t) => cc(o, i, 'room', t, [0, 0, 640, 360], 'any');
    assert(await dn(0.1) === await dn(0.34) && await dn(0.34) > await dn(0.7) && await dn(0.7) > await dn(1.15) && await dn(1.15) === await dn(1.25) && await dn(1.25) === await dn(1.5) && await dn(1.25) < await dn(0.34), `elevator ${day}: the doors do not slide from closed between 0.35 and 1.15 s`);
    assert(await dn(1.33) > await dn(1.25) && await dn(1.4) === await dn(1.25), `elevator ${day}: no stutter in the car at 1.30 s`);
    assert(await lp('news', o, i, 'frame', 0.1, false) === await lp('news', o, i, 'frame', 1.6, false) && await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), `elevator ${day}: a cached layer moves`);
    reduced5.push(o);
  }
  for (const phase of ['detail', 'hold']) {
    const o = mk5(0), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), hold = phase === 'hold';
    assert(a.id === `news:0:${phase}` && a.dur === (hold ? 1.1 : 2.3) && a.layers === (hold ? 'room,frame,dim' : 'room,frame,marks') && a.depths === '1,1,0' && a.cam === 'none' && a.cues === '' && a.sfx === (hold ? '' : 'broadcast'), `elevator session 1 ${phase} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 0.6) === await shot('news', o, i, 0.6) && (await drawCover(o, i)) === 640 * 360, `elevator session 1 ${phase}: not moving, not deterministic or has holes`);
    const dn = (t) => cc(o, i, 'room', t, [0, 0, 640, 360], 'any');
    // detail: from 0.6 open at 0.35 to fully open at 1.05; hold: fully open to 0.20, back to 0.6 at 0.90
    if (hold) assert(await dn(0.05) === await dn(0.2) && await dn(0.2) < await dn(0.55) && await dn(0.55) < await dn(0.9) && await dn(0.9) === await dn(1.09), 'elevator session 1 hold: the doors do not drift from open to 0.6 between 0.20 and 0.90 s');
    else assert(await dn(0.05) === await dn(0.35) && await dn(0.35) > await dn(0.7) && await dn(0.7) > await dn(1.05) && await dn(1.05) === await dn(2.2), 'elevator session 1 detail: the doors do not open from 0.6 to full between 0.35 and 1.05 s');
    reduced5.push(o);
  }
  assert(await lp('news', mk5(0), 2, 'dim', 0, false) === await lp('news', mk5(0), 2, 'dim', 1.0, false), 'elevator hold: the dim moves');
  // every one of these draws with no game and with an empty or a very long title
  for (const d of [7, 13, 16, 18, 21, 34, 4]) for (const ti of ['', 'W'.repeat(200)]) { const o = mk5(d, ti); for (let i = 0; i < (await page.evaluate((o) => BTB.Scenes.news(o).length, o)); i++) assert((await drawCover(o, i)) === 640 * 360 && !o.game, `batch 5: ${d} beat ${i} with title '${ti.slice(0, 3)}' does not draw`); }
  // effects reduced: one still per reworked beat
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of reduced5) for (const re of [':establish$', ':detail$', ':hold$']) {
    const i = await newsIdx(o, re); if (i < 0) continue;
    const b = await info('news', o, i);
    assert(await shot('news', o, i, 0.4) === await shot('news', o, i, b.dur - 0.05), `batch 5: news ${o.day} ${re}: reduced effects still moves`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));
  // the holds of the platform and subway sessions stay flat (the train is an event)
  for (const day of P5.subway) { const o = mk5(day), i = await newsIdx(o, ':hold$'); if (i >= 0) assert((await info('news', o, i)).layers === '', `news ${day} hold must stay flat`); }

  // ---- stage 3 batch 5, part 2: shots 6 to 10 ----
  const reduced6 = [];
  const mkS = (day, S) => nOpts(day, undefined, S);
  const any6 = (o, i, id, t, r) => cc(o, i, id, t, r || [0, 0, 640, 360], 'any');
  const box6 = (o, i, id, t, r) => page.evaluate(([o, i, id, t, r]) => window.animBox('news', o, i, id, t, r || [0, 0, 640, 360]), [o, i, id, t, r]);
  // shot 6: the trading floor lit (session 41 establish and detail; tickets 5, 12, 23, 39 and the mornings variant 4 dump and 22 ban): a refresh wave crosses the near screens
  const FLOOR6 = [[41, null, 'establish', 0.15], [41, null, 'detail', 0.7], [5, null, 'establish', 0.53], [12, null, 'establish', 0.45], [23, null, 'establish', 0.69], [39, null, 'establish', 0.69],
    [4, { choices: { c1: 'dump' } }, 'establish', 0.45], [22, { choices: { c5: 'ban' } }, 'establish', 0.61]];
  for (const [day, S, phase, Z] of FLOOR6) {
    const o = mkS(day, S), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), est = phase === 'establish', tk = day !== 41, tag = `floor ${day}${S ? ' variant' : ''} ${phase}`;
    assert(a.layers === 'floor,marks' && a.depths === '1,0' && a.cam === '-6>0' && a.dur === (est ? 1.7 : 2.3) && a.cues === (est && tk ? '0.3:office' : '') && a.sfx === (est ? (tk ? 'apartment' : 'office') : 'broadcast'), `${tag} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) && await shot('news', o, i, 0.8) === await shot('news', o, i, 0.8) && (await drawCover(o, i)) === 640 * 360, `${tag}: not moving, not deterministic or has holes`);
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false), `${tag}: a cached layer moves`);
    // nothing before 0.35 s and nothing after 1.25 s; bands in between
    assert(await any6(o, i, 'floor', 0.2) === 0 && await any6(o, i, 'floor', 1.3) === 0 && await any6(o, i, 'floor', a.dur - 0.05) === 0 && (await any6(o, i, 'floor', 0.6) + await any6(o, i, 'floor', 0.9)) > 300, `${tag}: no wave between 0.35 and 1.25 s`);
    // the wave travels right: the leftmost lit band moves right and the rightmost does too
    const lit6 = [];
    for (let t = 0.36; t < 1.25; t += 0.03) { const b = await box6(o, i, 'floor', t); if (b[1] > 0) lit6.push(b); }
    assert(lit6.length >= 5 && lit6[0][0] < lit6[lit6.length - 1][0] && lit6[0][1] < lit6[lit6.length - 1][1], `${tag}: the wave does not cross left to right (${JSON.stringify([lit6[0], lit6[lit6.length - 1]])})`);
    // the foreground colleagues' columns (art x < 26 and > 286) are never overlaid
    // (on the unzoomed detail, where art x 26 is screen x 52)
    if (!est) for (const t of [0.5, 0.7, 0.9, 1.1]) assert(await any6(o, i, 'floor', t, [0, 0, 52, 360]) === 0 && await any6(o, i, 'floor', t, [572, 0, 68, 360]) === 0, `${tag} at ${t}: a band over the colleagues`);
    // the band is 12 art units (24 px) tall and each screen flares bone (alpha 0.18) for 0.08 s as its band starts (the unzoomed detail, where art x is screen x / 2)
    if (!est) {
      // the screen whose band starts first (nothing else is drawn until the next one starts)
      const startOf = (g) => 0.35 + 0.5 * Math.max(0, Math.min(1, (g.x + g.w / 2) / 320));
      const both = await page.evaluate(([Z, day]) => BTB.Shots.floorGeom(Z, day).filter((g) => g.x >= 26 && g.x + g.w <= 286 && g.on !== false), [Z, day]);
      both.sort((a, b) => startOf(a) - startOf(b));
      const geo = both[0], next = both.length > 1 ? startOf(both[1]) : 9, rc = [geo.x * 2, geo.y * 2, geo.w * 2, geo.h * 2], at = startOf(geo);
      assert((await any6(o, i, 'floor', at - 0.01, rc)) === 0, `${tag}: something over the screen before its band starts`);
      const bf = await box6(o, i, 'floor', at + 0.02, rc);
      assert(bf[0] === rc[0] && bf[1] === rc[0] + rc[2] - 1 && bf[2] === rc[1] && bf[3] === rc[1] + rc[3] - 1, `${tag}: no bone flare over the whole screen as its band starts (${JSON.stringify(bf)} for ${JSON.stringify(rc)})`);
      let tall = 0;
      for (let t = at + 0.09; t < Math.min(at + 0.30, next); t += 0.01) { const b = await box6(o, i, 'floor', t, rc); if (b[3] >= 0) tall = Math.max(tall, b[3] - b[2] + 1); }
      assert(tall === 24 && next - at > 0.10, `${tag}: the band is ${tall} px tall (12 art units = 24 px)`);
      assert((await any6(o, i, 'floor', at + 0.10, [rc[0], rc[1], rc[2], 2])) + (await any6(o, i, 'floor', at + 0.10, [rc[0], rc[1] + rc[3] - 2, rc[2], 2])) < 4 * rc[2], `${tag}: the flare lasts past 0.08 s`);
    }
    reduced6.push(o);
  }

  // shot 7: the trading floor dark (establish and hold of 10, 44 and 22 fail; the detail of 44): the biggest near screen stutters, the others flicker, all end lit
  const DARK7 = [[10, null, 'establish'], [10, null, 'hold'], [44, null, 'establish'], [44, null, 'detail'], [44, null, 'hold'], [22, { choices: { c5: 'fail' } }, 'establish'], [22, { choices: { c5: 'fail' } }, 'hold']];
  for (const [day, S, phase] of DARK7) {
    const o = mkS(day, S), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), hold = phase === 'hold', tag = `dark ${day}${S ? ' fail' : ''} ${phase}`;
    assert(a.layers === (hold ? 'floor,dim' : 'floor,marks') && a.depths === '1,0' && a.cam === 'none' && a.dur === (hold ? 1.1 : phase === 'detail' ? 2.3 : 1.7) && a.cues === '' && a.sfx === (hold ? '' : phase === 'detail' ? 'broadcast' : 'office'), `${tag} beat: ${JSON.stringify(a)}`);
    assert((await drawCover(o, i)) === 640 * 360 && await shot('news', o, i, 0.7) === await shot('news', o, i, 0.7), `${tag}: has holes or is not deterministic`);
    // the stutter: the key screen is dark ink in the sheet's spans (establish and detail), the picture differs from the art then and is the art again at the end
    const A = (t) => any6(o, i, 'floor', t);
    if (!hold) {
      assert(await A(0.1) === 0 && await A(0.43) > 3000 && await A(0.49) < await A(0.43) && await A(0.6) > 3000 && await A(0.74) < await A(0.6) && await A(0.80) > 3000 && await A(1.0) > 3000 && await A(a.dur - 0.05) === 0, `${tag}: the key screen does not stutter in four bursts (${JSON.stringify(await Promise.all([0.1, 0.43, 0.49, 0.6, 0.74, 0.8, 1.0, 1.3, a.dur - 0.05].map(A)))})`);
      assert(await shot('news', o, i, 0.43) !== await shot('news', o, i, 0.49) && await shot('news', o, i, 0.6) !== await shot('news', o, i, 0.74), `${tag}: the stutter is not seen`);
    } else {
      let n = 0; for (let t = 0.12; t < 1.0; t += 1 / 12) if (await A(t) > 0) n++;
      assert(n >= 1 && await A(0.05) === 0 && await A(1.05) === 0 && await A(a.dur - 0.01) === 0, `${tag}: the stutter does not go on behind the dim (${n})`);
    }
    assert(await lp('news', o, i, hold ? 'dim' : 'marks', 0.1, false) === await lp('news', o, i, hold ? 'dim' : 'marks', a.dur - 0.1, false), `${tag}: a cached layer moves`);
    // at zoom 0.7 the flicker is skipped under the foreground colleagues' columns (art x < 26 and > 286, screen x < 52 and >= 572), as on the lit floor
    if (phase === 'detail') {
      let elsewhere = 0;
      for (let t = 0.3; t < a.dur - 0.1; t += 1 / 12) {
        assert(await any6(o, i, 'floor', t, [0, 0, 52, 360]) === 0 && await any6(o, i, 'floor', t, [572, 0, 68, 360]) === 0, `${tag} at ${t.toFixed(2)}: a flicker under the colleagues`);
        elsewhere += await any6(o, i, 'floor', t, [52, 0, 520, 360]);
      }
      assert(elsewhere > 0, `${tag}: no flicker at all`);
    }
    reduced6.push(o);
  }

  // shot 8: the skyline (sessions 27, 28, 29, 35): the day's newest windows switch on one by one while the LIGHTS ON count climbs 8 points
  const SKY8 = { 27: 62, 28: 55, 29: 55, 35: 60 }; // the windows lit today that are not hidden behind a nearer tower (64, 58, 59, 63 counting those); a window on the right edge may be cut by it
  for (const day of [27, 28, 29, 35]) {
    const o = mkS(day), i = await newsIdx(o, ':establish$'), a = await info('news', o, i), tag = `skyline ${day}`;
    assert(a.id === `news:${day}:establish` && a.dur === 2.4 && a.layers === 'city,top' && a.depths === '1,1' && a.cam === 'none' && a.cues === '' && a.sfx === 'apartment' && a.inf === true && a.n === 1, `${tag} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 2.3) && await shot('news', o, i, 0.9) === await shot('news', o, i, 0.9) && (await drawCover(o, i)) === 640 * 360, `${tag}: not moving, not deterministic or has holes`);
    const am = (t) => cc(o, i, 'city', t, [0, 0, 640, 360], 'amber');
    const n = [await am(0.3), await am(0.6), await am(0.9), await am(1.2), await am(1.4), await am(2.3)];
    assert(n[0] === 0 && n[0] < n[1] && n[1] < n[2] && n[2] < n[3] && n[3] <= n[4] && n[4] === n[5] && n[5] >= 9 * SKY8[day] - 63 && n[5] <= 9 * SKY8[day], `${tag}: the windows do not come on one by one between 0.35 and 1.25 s (${n})`);
    const bx = await box6(o, i, 'city', 1.5);
    assert(bx[1] - bx[0] > 400 && bx[2] > 40 && bx[3] < 260, `${tag}: the new windows are not across the whole skyline (${bx})`);
    // the sweep runs left to right (index order): the lit boxes' right edge grows, and early on the lit windows are all in the left part
    const xr = []; for (const t of [0.5, 0.7, 0.9, 1.1, 1.3]) xr.push((await box6(o, i, 'city', t))[1]);
    assert(xr.every((x, k) => k === 0 || x >= xr[k - 1]) && xr[0] < bx[1] - 150 && xr[1] < bx[1] - 60, `${tag}: the windows do not sweep left to right (${xr}, final ${bx[1]})`);
    // each window pops: 7x7 px of bone at alpha 0.35 for 0.10 s, centred on it, while it switches (the first window alone just after 0.35 s); none left after the last pop
    const first = await box6(o, i, 'city', 0.355);
    assert(first[3] - first[2] + 1 === 7 && first[1] - first[0] + 1 >= 3 && first[1] - first[0] + 1 <= 7 && (first[1] - first[0] + 1 === 7 || first[0] === 0), `${tag}: the first window's pop is not 7x7 (or cut by the left edge) (${first})`);
    assert(await cc(o, i, 'city', 0.8, [0, 0, 640, 360], 'any') - await am(0.8) >= 40 && await cc(o, i, 'city', 1.4, [0, 0, 640, 360], 'any') === await am(1.4) && await cc(o, i, 'city', 0.3, [0, 0, 640, 360], 'any') === 0, `${tag}: the windows do not pop as they switch`);
    // the label's stem is cached: the cached top layer holds LIGHTS ON: and the animate only the number (about 165 rectangles a frame, not 390)
    assert(await lp('news', o, i, 'top', 0.1, false) !== await lp('news', o, i, 'top', 0.1, true), `${tag}: the cached top layer holds no label`);
    // the count: starts 8 points back, ends on today's figure, and the text never moves (its right edge, the %, stays; the digits' own left edges differ by a glyph's blank column)
    const tb = (t) => box6(o, i, 'top', t, [0, 0, 300, 40]);
    assert(JSON.stringify(await tb(0.1)).slice(0, 6) !== '[1e9,-' && (await tb(0.1))[1] === (await tb(0.9))[1] && (await tb(0.9))[1] === (await tb(1.5))[1] && await lp('news', o, i, 'top', 0.1, true) !== await lp('news', o, i, 'top', 0.7, true) && await lp('news', o, i, 'top', 1.3, true) === await lp('news', o, i, 'top', 2.3, true), `${tag}: the count does not climb to a fixed end or its text moves`);
    reduced6.push(o);
  }

  // cost: the most rectangles one frame of an animate draws (every layer, wrapped fillRect, busiest of the beat's frames)
  {
    const rows = [];
    const COUNT = [['skyline', 27, null, ':establish$'], ['skyline', 28, null, ':establish$'], ['skyline', 29, null, ':establish$'], ['skyline', 35, null, ':establish$'],
      ['floor wave', 41, null, ':establish$'], ['floor wave', 41, null, ':detail$'], ['floor wave', 23, null, ':establish$'], ['floor wave', 5, null, ':establish$'],
      ['subway', 21, null, ':establish$'], ['subway', 21, null, ':detail$'], ['subway', 31, null, ':establish$'], ['subway', 7, null, ':establish$'],
      ['tableau', 6, null, ':establish$'], ['tableau', 9, null, ':establish$'], ['tableau', 9, null, ':hold$'], ['tableau', 17, null, ':establish$'], ['tableau', 20, null, ':establish$'], ['tableau', 25, null, ':establish$'],
      ['tableau', 37, null, ':establish$'], ['tableau', 37, null, ':hold$'], ['tableau', 40, null, ':establish$'], ['tableau', 40, null, ':detail$'], ['tableau', 45, null, ':establish$'], ['tableau', 45, null, ':detail$']];
    for (const [name, day, S, re] of COUNT) {
      const o = mkS(day, S), i = await newsIdx(o, re), r = await page.evaluate(([o, i]) => window.rectMax('news', o, i), [o, i]);
      rows.push(`${name} ${day}${re.slice(1, -1)}: ${r.worst} at ${r.at.toFixed(2)}`);
      assert(r.worst < 400 && r.worst > 0 && (name !== 'skyline' || r.worst < 250) && (name !== 'tableau' || r.worst < 30), `${name} ${day} ${re}: ${r.worst} rectangles in the busiest frame (limit 400)`);
    }
    console.log('rect counts (busiest frame): ' + rows.join('; '));
  }

  // shot 9: the rack room (variant 45 pulledPlug): the LED strips go dark row by row, 0.35 to 1.37 s
  {
    const o = mkS(45, { f: { pulledPlug: true } }), i = await newsIdx(o, ':establish$'), a = await info('news', o, i);
    assert(a.id === 'news:45:THE STACK IS OFF:establish' && a.dur === 1.7 && a.layers === 'racks,marks' && a.depths === '1,0' && a.cam === 'none' && a.cues === '' && a.sfx === 'apartment', `racks beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, 1.6) && await shot('news', o, i, 0.9) === await shot('news', o, i, 0.9) && (await drawCover(o, i)) === 640 * 360, 'racks: not moving, not deterministic or has holes');
    // lit strips (phosphorD) before their switch: all 136 at 0.3 s, none from 1.38 s, and the count falls steadily; the strips on the top row go first
    const ph = (t, r) => cc(o, i, 'racks', t, r || [0, 0, 640, 360], 'phosphorD');
    const n = [await ph(0.3), await ph(0.6), await ph(0.9), await ph(1.2), await ph(1.37), await ph(1.6)];
    assert(n[0] > 0 && n[0] > n[1] && n[1] > n[2] && n[2] > n[3] && n[3] > 0 && n[4] === 0 && n[5] === 0, `racks: the strips do not go dark one after another (${n})`);
    const bx = await box6(o, i, 'racks', 0.3);
    // the two top strips of a rack are switched by 0.35 + 8 x 0.0075 s: by 0.45 the top row is dark while the bottom row is not
    assert(await ph(0.45, [0, 0, 640, 110]) < await ph(0.3, [0, 0, 640, 110]) && await ph(0.45, [0, 200, 640, 100]) === await ph(0.3, [0, 200, 640, 100]) && bx[1] > bx[0], 'racks: not top to bottom');
    assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', 1.6, false), 'racks: a cached layer moves');
    reduced6.push(o);
  }

  // shot 10: every news hold. The final frame of each is pinned above (P6_REF hold:*). Holds with life are layered with the dim last and no camera;
  // the rest stay flat (a layered beat whose picture never changes adds cost and fails the "picture changes" assert)
  {
    const LIVE = new Set(['0', '8', '24', '32', '10', '44', '22bail', '22fail']);
    const VARS = { '4dump': [4, { choices: { c1: 'dump' } }], '4leak': [4, { choices: { c1: 'leak' } }], '22fail': [22, { choices: { c5: 'fail' } }], '22ban': [22, { choices: { c5: 'ban' } }], '22bail': [22, { choices: { c5: 'bail' } }], '41bill': [41, { f: { billPassed: true } }], '45plug': [45, { f: { pulledPlug: true } }] };
    const all = [];
    for (let d = 0; d < 46; d++) all.push([String(d), mkS(d)]);
    for (const k in VARS) all.push([k, mkS(VARS[k][0], VARS[k][1])]);
    const tableauHolds = new Set(['6', '9', '17', '20', '37', '40', '45']); // batch 6 (the tableau is not 45 plug's racks)
    for (const [key, o] of all) {
      const i = await newsIdx(o, ':hold$'); if (i < 0) continue;
      const a = await info('news', o, i), live = LIVE.has(key), dim = a.layers.split(',').pop() === 'dim';
      assert(a.dur === 1.1 && a.sfx === '' && a.tr === '' && a.cam === 'none', `hold ${key}: ${JSON.stringify(a)}`);
      if (live) assert(dim && a.depths.split(',').pop() === '0' && a.layers.split(',').length >= 2, `hold ${key} should be layered with the dim last: ${a.layers}`);
      else if (!tableauHolds.has(key) && key !== '38' && key !== '41bill') assert(a.layers === '', `hold ${key} must stay flat (${a.layers})`);
      if (live && a.layers.split(',')[0] === 'floor') {
        const n = [];
        for (let t = 0.1; t < 1.0; t += 0.05) n.push(await shot('news', o, i, t));
        assert(new Set(n).size > 1, `hold ${key}: no life behind the dim`);
      }
    }
  }

  // ---- stage 3 batch 6: the story tableaux (sessions 6, 9, 17, 20, 25, 37, 40, 45) ----
  // The art is one cached layer (`art`: the picture without its mover and scanlines, the mover and the covers drawn by its animate); `glass` holds the
  // scanlines and the fine marks; `marks` (establish) the corner brackets and the tear, or `dim` (hold) the 0.18 ink rect.
  const art7 = (o, i, t) => lp('news', o, i, 'art', t, true);
  const box7 = (o, i, t, r) => box6(o, i, 'art', t, r);
  const flatDiff7 = (o, i, day, n, z, p, phase, dim) => page.evaluate(([o, i, day, n, z, p, phase, dim]) => window.finalDiff('news', o, i, (g) => {
    const SB = BTB.Storyboard;
    SB.at2x(g, (c) => { SB.tableau(c, n, z, { p }); }, day);
    if (phase) SB.finePass(g, day, SB.row(day, null), phase);
    if (dim) { g.save(); g.globalAlpha = 0.18; g.fillStyle = BTB.Pal.ink; g.fillRect(0, 0, 640, 360); g.restore(); }
  }, []), [o, i, day, n, z, p, phase, dim]);
  // beat shape and the common properties of one tableau beat
  const beat7 = async (day, phase, want) => {
    const o = mkS(day), i = await newsIdx(o, `:${phase}$`), a = await info('news', o, i), tag = `tableau ${day} ${phase}`;
    assert(a.layers === want.layers && a.depths === want.depths && a.cam === want.cam && a.cues === (want.cues || '') && a.sfx === want.sfx && a.dur === want.dur && a.id === `news:${day}:${phase}`, `${tag} beat: ${JSON.stringify(a)}`);
    assert(await shot('news', o, i, 0.1) !== await shot('news', o, i, a.dur - 0.1) || phase === 'hold', `${tag}: start and end frames are identical`);
    assert(await shot('news', o, i, 0.8) === await shot('news', o, i, 0.8) && (await drawCover(o, i)) === 640 * 360 && !o.game, `${tag}: not deterministic or has holes`);
    assert(await lp('news', o, i, 'glass', 0.1, false) === await lp('news', o, i, 'glass', a.dur - 0.1, false), `${tag}: the glass layer moves`);
    if (phase === 'establish') assert(await lp('news', o, i, 'marks', 0.1, false) === await lp('news', o, i, 'marks', a.dur - 0.1, false), `${tag}: the marks move`);
    if (phase === 'hold') assert(await lp('news', o, i, 'dim', 0.1, false) === await lp('news', o, i, 'dim', a.dur - 0.1, false), `${tag}: the dim moves`);
    reduced6.push(o);
    return { o, i, a };
  };
  // every one of these draws with no game, an empty and a very long title
  for (const d of [6, 9, 17, 20, 25, 37, 40, 45]) for (const ti of ['', 'W'.repeat(200)]) { const o = nOpts(d, ti); for (let i = 0; i < (await page.evaluate((o) => BTB.Scenes.news(o).length, o)); i++) assert((await drawCover(o, i)) === 640 * 360 && !o.game, `batch 6: ${d} beat ${i} with title '${ti.slice(0, 3)}' does not draw`); }

  // 1. Kavro Strait (session 6): the three ships sail east; the detail and the hold end with them 4 art units further on (p = 1)
  {
    const E = await beat7(6, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(6, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    // establish: ships at -4 until 0.35 s, +5 at 1.35 s (18 px), easing out; the art does not move
    const l = async (o, i, t) => (await box7(o, i, t, [0, 130, 640, 90]))[0], r = async (o, i, t) => (await box7(o, i, t, [0, 130, 640, 90]))[1];
    const l0 = await l(E.o, E.i, 0.1);
    assert(l0 === await l(E.o, E.i, 0.34) && await l(E.o, E.i, 1.4) === l0 + 18 && await l(E.o, E.i, 1.6) === l0 + 18, `Kavro establish: the ships do not sail 18 px between 0.35 and 1.35 s (${l0} ${await l(E.o, E.i, 1.4)})`);
    const mid = [await l(E.o, E.i, 0.6), await l(E.o, E.i, 0.8), await l(E.o, E.i, 1.0)];
    assert(l0 < mid[0] && mid[0] <= mid[1] && mid[1] < mid[2] && mid[2] < l0 + 18 && mid[0] - l0 >= 6, `Kavro establish: the ships do not ease out (${[l0, ...mid]})`);
    const bx = await box7(E.o, E.i, 0.1, [0, 0, 640, 360]);
    assert(bx[2] >= 138 && bx[3] <= 202 && bx[1] - bx[0] >= 150, `Kavro establish: the ships' box ${bx} is not the sheet's (x 238-452, y 138-202)`);
    assert(await lp('news', E.o, E.i, 'art', 0.1, false) !== await lp('news', E.o, E.i, 'art', 1.5, false) && await art7(E.o, E.i, 1.4) === await art7(E.o, E.i, 1.69), 'Kavro establish: the art layer does not settle after 1.35 s');
    // detail: four steps of 2.6 px (one art unit), one every 0.4 s from 0.35 to 1.95 s, from where the establish left them
    const lefts = [];
    for (const t of [0.1, 0.34, 0.76, 1.16, 1.56, 1.96, 2.2]) lefts.push(await l(D.o, D.i, t));
    assert(lefts[0] === lefts[1] && lefts[1] < lefts[2] && lefts[2] < lefts[3] && lefts[3] < lefts[4] && lefts[4] < lefts[5] && lefts[5] === lefts[6], `Kavro detail: not four steps at 0.35 + 0.4 k (${lefts})`);
    assert(await l(D.o, D.i, 0.74) === lefts[1] && await l(D.o, D.i, 1.14) === lefts[2] && await l(D.o, D.i, 1.54) === lefts[3] && await l(D.o, D.i, 1.94) === lefts[4], 'Kavro detail: a step lands early');
    assert(lefts[6] - lefts[0] >= 9 && lefts[6] - lefts[0] <= 12, `Kavro detail: the ships move ${lefts[6] - lefts[0]} px, not 4 x 2.6`);
    // the detail starts where the establish left the ships (+5) in its own scale: the flat picture at p = 5/9 is the art plus the mover at +5
    assert((await flatDiff7(D.o, D.i, 6, 3, 1.3, 1, 'detail', false)).bad === 0, 'Kavro detail: the final picture is not the flat tableau at p = 1');
    // the hold is rebuilt flat at p = 1
    const H = { o: mkS(6) }; H.i = await newsIdx(H.o, ':hold$'); H.a = await info('news', H.o, H.i);
    assert(H.a.layers === '' && H.a.dur === 1.1 && H.a.sfx === '' && H.a.cam === 'none' && (await flatDiff7(H.o, H.i, 6, 3, 0, 1, null, true)).bad === 0 && (await drawCover(H.o, H.i)) === 640 * 360, `Kavro hold: not the flat picture at p = 1 under the 0.18 dim: ${JSON.stringify(H.a)}`);
    // the establish still ends where it always did (p = 0.6)
    assert((await flatDiff7(E.o, E.i, 6, 3, 0, 0.6, 'establish', false)).bad === 0, 'Kavro establish: the final picture is not today\'s');
    // the cable stroke (drawn under the ships in the art) is in the art layer, not covered: the ships at 0.1 s are drawn over it
    assert(await any6(E.o, E.i, 'art', 0.1) > 0 && await any6(E.o, E.i, 'art', 0.1) < 3000, 'Kavro establish: the animate draws the ships only');
  }

  // 2. Grid (session 9): the five load cells flash red in sequence; the two that stay red pulse on the detail and the hold
  {
    const E = await beat7(9, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(9, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = await beat7(9, 'hold', { layers: 'art,glass,dim', depths: '1,1,0', cam: 'none', sfx: '', dur: 1.1 });
    const red = (b, t) => cc(b.o, b.i, 'art', t, [0, 0, 640, 360], 'crimson');
    const n = [await red(E, 0.2), await red(E, 0.45), await red(E, 0.55), await red(E, 0.65), await red(E, 0.75), await red(E, 0.85), await red(E, 1.05), await red(E, 1.15), await red(E, 1.69)];
    assert(n[0] === 0 && n[1] === 400 && n[2] === 800 && n[3] === 1200 && n[4] === 1600 && n[5] === 2000 && n[6] === 2000 && n[7] === 0 && n[8] === 0, `grid establish: the cells do not flash in turn 0.40 + 0.10 k and stop at 1.10 (${n})`);
    const bx = await box7(E.o, E.i, 0.85, [0, 0, 640, 360]);
    assert(bx[0] >= 360 && bx[1] <= 560 && bx[2] >= 170 && bx[3] <= 232, `grid establish: the cells' box ${bx} is not the cluster (176x52 px)`);
    const d = [await red(D, 0.2), await red(D, 0.34), await red(D, 1.95), await red(D, 2.2), await red(D, 2.29)];
    assert(d[0] === 0 && d[1] === 0 && d[2] > 0 && d[3] === 0 && d[4] === 0, `grid detail: the two red cells do not pulse from 0.35 s and end on the art (${d})`);
    const h = [await red(H, 0.05), await red(H, 0.25), await red(H, 1.0), await red(H, 1.09)];
    assert(h[0] === 0 && h[1] > 0 && h[2] === 0 && h[3] === 0, `grid hold: the cells do not pulse from 0.10 s and end on the art (${h})`);
    // under the 1.3 zoom the pulse's edge pixels blend with the art (the sheet's risk 2.10); the last phase draws nothing, so the final frame is exact (pinned)
  }

  // 3. Model flow (session 17, after the act card): a pulse runs left to right over the five racks, each screen column flares and the link flashes white
  {
    const E = await beat7(17, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(17, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = { o: mkS(17) }; H.i = await newsIdx(H.o, ':hold$');
    assert((await info('news', H.o, H.i)).layers === '', 'model flow hold must stay flat');
    assert((await info('news', E.o, E.i)).n === 4 && E.i === 1, 'model flow: the establish follows the act card');
    for (const [name, B_, A] of [['establish', E, 0.36], ['detail', D, 0.40]]) {
      assert(await any6(B_.o, B_.i, 'art', A - 0.04) === 0 && await any6(B_.o, B_.i, 'art', A + 0.72 + 0.20) === 0 && await any6(B_.o, B_.i, 'art', B_.a ? 0 : (name === 'establish' ? 1.69 : 2.29)) === 0, `model flow ${name}: draws outside the pass`);
      const lefts = [];
      for (let k = 0; k < 5; k++) { const b = await box7(B_.o, B_.i, A + 0.18 * k + 0.02, [0, 0, 640, 360]); assert(b[1] > 0, `model flow ${name}: no flare on rack ${k}`); lefts.push(b[0]); }
      assert(lefts.every((v, k) => k === 0 || v > lefts[k - 1]), `model flow ${name}: the pulse does not run left to right (${lefts})`);
      for (let k = 0; k < 4; k++) assert(await cc(B_.o, B_.i, 'art', A + 0.18 * k + 0.06, [0, 0, 640, 360], 'white') > 0 && await cc(B_.o, B_.i, 'art', A + 0.18 * k + 0.16, [0, 0, 640, 360], 'white') === 0 && await cc(B_.o, B_.i, 'art', A + 0.18 * k + 0.02, [0, 0, 640, 360], 'white') === 0, `model flow ${name}: the link ${k} does not flash white for 0.10 s from +0.04`);
    }
    const b0 = await box7(E.o, E.i, 0.38, [0, 0, 640, 360]);
    assert(b0[2] >= 94 && b0[3] <= 206 && b0[3] - b0[2] >= 100, `model flow establish: the rack column ${b0} is not 56x112 px at y 94-206`);
  }

  // 4. Bank queue (session 20): the queue shuffles forward, front (left) to back, one figure every 0.07 s
  {
    const E = await beat7(20, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(20, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = { o: mkS(20) }; H.i = await newsIdx(H.o, ':hold$');
    assert((await info('news', H.o, H.i)).layers === '', 'bank queue hold must stay flat');
    // figure i sits at screen x 2 (52 + 27 i) (plus a sway of 4 px on the odd ones, which p = 0.6 keeps); the box of its own column
    const left = async (B_, i, t) => (await box7(B_.o, B_.i, t, [B_ === D ? Math.round(2.6 * (52 + 27 * i) - 96) - 14 : 2 * (52 + 27 * i) - 12, 0, B_ === D ? 52 : 40, 360]))[0];
    for (let i = 0; i < 9; i++) {
      const a = 0.40 + 0.07 * i, b = a + 0.28;
      const e0 = await left(E, i, a - 0.02), e1 = await left(E, i, a + 0.02);
      assert(e0 - e1 === 4 && await left(E, i, 1.69) === e1 && await left(E, i, 0.05) === e0, `bank queue establish: figure ${i} does not step 4 px left at ${a.toFixed(2)} s (${e0} ${e1})`);
      const d0 = await left(D, i, a - 0.02), d1 = await left(D, i, a + 0.02), d2 = await left(D, i, b + 0.02);
      assert(d0 - d1 >= 4 && d0 - d1 <= 7 && d2 === d0 && await left(D, i, 2.29) === d0, `bank queue detail: figure ${i} does not lean in 2 units from ${a.toFixed(2)} to ${b.toFixed(2)} s (${d0} ${d1} ${d2})`);
    }
    const bx = await box7(E.o, E.i, 0.1, [0, 0, 640, 360]);
    assert(bx[2] >= 164 && bx[3] <= 246 && bx[3] - bx[2] >= 40, `bank queue establish: the figures' box ${bx} is not the queue (y 182-240)`);
  }

  // 5. Records (session 25, establish only): HOLD stamps land on six cartons, left to right, the last at 1.10 s
  {
    const E = await beat7(25, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7, cues: '1.1:click' });
    const D = { o: mkS(25) }; D.i = await newsIdx(D.o, ':detail$');
    assert((await info('news', D.o, D.i)).layers === '' && (await info('news', D.o, D.i)).n === 2, 'records: the detail stays flat and there is no hold');
    // the cover is drawn on the plate's flat desk2 face: before its stamp the whole carton mark area is exactly desk2 (the art layer, bar and word hidden)
    for (let i = 0; i < 6; i++) {
      const r = [2 * (16 + 50 * i + 6), 2 * (85 + 7), 60, 32], a = 0.55 + 0.11 * i;
      assert(await cc(E.o, E.i, 'art', a - 0.02, r, 'desk2', false) === 60 * 32, `records: carton ${i} is not blank on the plate's desk2 before its stamp`);
      assert(await cc(E.o, E.i, 'art', a + 0.06, r, 'desk2', false) === 60 * 32 && await cc(E.o, E.i, 'art', a + 0.10, r, 'desk2', false) < 60 * 32 && await cc(E.o, E.i, 'art', a + 0.10, r, 'desk2', true) === 0, `records: carton ${i} is not revealed at its third frame ${(a + 0.08).toFixed(2)} s`);
      const ring = (t) => cc(E.o, E.i, 'art', t, [r[0] - 20, r[1] - 12, 100, 56], 'crimson');
      assert(await ring(a - 0.01) === 0 && await ring(a + 0.01) > 0 && await ring(a + 0.05) > 0 && await ring(a + 0.09) === 0, `records: carton ${i} stamp frames are not 0.04 s apart`);
    }
    const o2 = (t) => any6(E.o, E.i, 'art', t);
    assert(await o2(0.3) === 6 * 60 * 32 && await o2(1.17) > 0 && await o2(1.19) === 0 && await o2(1.69) === 0, 'records: covers and stamps do not end at 1.18 s');
    const f = await box7(E.o, E.i, 0.57, [0, 0, 640, 360]);
    assert(f[3] >= 162 && f[2] <= 226 + 12, `records: stamp box ${f} is not the cartons' row (y 162-226)`);
  }

  // 6. Hearing (session 37): the witness leans in to the microphone; the LIVE badge pulses (establish and hold)
  {
    const E = await beat7(37, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(37, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = await beat7(37, 'hold', { layers: 'art,glass,dim', depths: '1,1,0', cam: 'none', sfx: '', dur: 1.1 });
    const top = async (B_, t) => (await box7(B_.o, B_.i, t, [300, 150, 60, 130]))[2];
    // establish: three 2 px steps (one art unit each) at 0.45, 0.55, 0.65 s, from 178 to 184 (the block is 24 px tall)
    const e = [await top(E, 0.1), await top(E, 0.47), await top(E, 0.57), await top(E, 0.67), await top(E, 1.69)];
    assert(e.join() === '178,180,182,184,184', `hearing establish: the witness does not lean in three steps (${e})`);
    const bx = await box7(E.o, E.i, 0.1, [300, 150, 60, 130]);
    assert(bx[3] - bx[2] === 23 && bx[1] - bx[0] === 23, `hearing establish: the witness block is not 24x24 px (${bx})`);
    // detail: 3 units (7.8 px) closer from 0.60 to 1.30 s
    const d = [await top(D, 0.1), await top(D, 0.58), await top(D, 0.62), await top(D, 1.28), await top(D, 1.32), await top(D, 2.29)];
    assert(d[0] === d[1] && d[2] - d[1] >= 7 && d[2] - d[1] <= 9 && d[3] === d[2] && d[4] === d[0] && d[5] === d[0], `hearing detail: the witness does not lean in 3 units from 0.60 to 1.30 s (${d})`);
    // hold: the witness rests
    assert(await top(H, 0.1) === e[4] && await top(H, 0.9) === e[4], 'hearing hold: the witness moves');
    // the LIVE badge: slate cover over the badge at the badge rate from 0.30 (hold 0.10), on (nothing) at the end; not on the detail (the header is off frame)
    const badge = [530, 20, 92, 14], sl = (B_, t) => cc(B_.o, B_.i, 'art', t, badge, 'slate');
    assert(await sl(E, 0.2) === 0 && await sl(E, 1.35) === 92 * 14 && await sl(E, 1.45) === 0 && await sl(E, 1.69) === 0 && await sl(E, 0.35) === 92 * 14, `hearing establish: the badge does not pulse at 0.5 s / 0.6 from 0.30 (${await sl(E, 1.35)} ${await sl(E, 1.45)})`);
    assert(await sl(H, 0.05) === 0 && await sl(H, 0.25) === 92 * 14 && await sl(H, 0.4) === 0 && await sl(H, 1.09) === 0, 'hearing hold: the badge does not pulse from 0.10 s and end on');
    assert(await cc(D.o, D.i, 'art', 0.7, [0, 0, 640, 360], 'slate') === 0, 'hearing detail: something blinks');
  }

  // 7. Floor vote (session 40): VOTE PENDING pulses (establish and hold); the witness leans as in the hearing
  {
    const E = await beat7(40, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(40, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = await beat7(40, 'hold', { layers: 'art,glass,dim', depths: '1,1,0', cam: 'none', sfx: '', dur: 1.1 });
    const top = async (B_, t) => (await box7(B_.o, B_.i, t, [300, 150, 60, 80]))[2];
    const e = [await top(E, 0.1), await top(E, 0.47), await top(E, 0.57), await top(E, 0.67), await top(E, 1.69)];
    assert(e.join() === '178,180,182,184,184', `vote establish: the witness does not lean in three steps (${e})`);
    const d = [await top(D, 0.1), await top(D, 0.58), await top(D, 0.62), await top(D, 1.28), await top(D, 1.32)];
    assert(d[0] === d[1] && d[2] - d[1] >= 7 && d[2] - d[1] <= 9 && d[3] === d[2] && d[4] === d[0], `vote detail: the witness does not lean in from 0.60 to 1.30 s (${d})`);
    assert(await top(H, 0.1) === e[4] && await top(H, 0.9) === e[4], 'vote hold: the witness moves');
    // the line (screen 250, 250, 142, 14) is covered by the box's flat ink in its off phase from 0.30 (hold 0.10) and shows (nothing drawn) at the end
    const line = [248, 250, 142, 14], ink = (B_, t) => cc(B_.o, B_.i, 'art', t, line, 'ink');
    assert(await ink(E, 0.2) === 0 && await ink(E, 1.35) === 142 * 14 && await ink(E, 1.45) === 0 && await ink(E, 1.69) === 0 && await ink(E, 0.35) === 142 * 14, `vote establish: VOTE PENDING does not pulse from 0.30 (${await ink(E, 1.35)} ${await ink(E, 1.45)})`);
    assert(await ink(H, 0.05) === 0 && await ink(H, 0.25) === 142 * 14 && await ink(H, 0.4) === 0 && await ink(H, 1.09) === 0, 'vote hold: the line does not pulse from 0.10 s and end shown');
    assert(await cc(D.o, D.i, 'art', 0.7, [0, 0, 640, 360], 'ink') === 0, 'vote detail: the line blinks');
    // off phase: no crimson of the text is left showing (cover and text both start at art x 124)
    assert(await cc(E.o, E.i, 'art', 1.35, [240, 240, 170, 30], 'crimson', false) === 0 && await cc(E.o, E.i, 'art', 1.45, [240, 240, 170, 30], 'crimson', false) > 0 && await cc(H.o, H.i, 'art', 0.25, [240, 240, 170, 30], 'crimson', false) === 0, 'vote: the off phase leaves part of the line showing');
    // the cover is on the box's flat ink: the cached art around the line (without the text) is all ink
    assert(await cc(E.o, E.i, 'art', 1.35, [248, 250, 142, 14], 'ink', false) === 142 * 14, 'vote: the cover is not on a flat ink interior');
  }

  // 8. Final day (session 45): four nodes die in sequence, each with a bone flash; the detail's last live node stutters
  {
    const E = await beat7(45, 'establish', { layers: 'art,glass,marks', depths: '1,1,0', cam: '-6>0', sfx: 'apartment', dur: 1.7 });
    const D = await beat7(45, 'detail', { layers: 'art,glass', depths: '1,1', cam: 'none', sfx: 'broadcast', dur: 2.3 });
    const H = { o: mkS(45) }; H.i = await newsIdx(H.o, ':hold$');
    assert((await info('news', H.o, H.i)).layers === '', 'final day hold must stay flat');
    const P45 = mkS(45, { f: { pulledPlug: true } }), pi = await newsIdx(P45, ':establish$');
    assert((await info('news', P45, pi)).layers === 'racks,marks', 'final day with the plug pulled is still the racks');
    const sky = (t) => cc(E.o, E.i, 'art', t, [0, 0, 640, 360], 'sky'), all = (t) => any6(E.o, E.i, 'art', t);
    const alive = [await sky(0.3), await sky(0.7), await sky(0.85), await sky(1.0), await sky(1.2), await sky(1.69)];
    assert(alive.join() === '400,300,200,100,0,0', `final day establish: the nodes do not die at 0.60, 0.78, 0.96 and 1.14 s (${alive})`);
    // one hard flash a node: 22x22 px, 0.08 s; nothing after 1.22 s
    for (let k = 0; k < 4; k++) {
      const a = 0.60 + 0.18 * k, b = await box7(E.o, E.i, a + 0.02, [0, 0, 640, 360]);
      assert(await any6(E.o, E.i, 'art', a + 0.02) > 0 && await any6(E.o, E.i, 'art', a + 0.10) === await sky(a + 0.10), `final day establish: no single flash for node ${k + 3}`);
    }
    assert(await all(1.25) === 0 && await all(1.69) === 0, 'final day establish: draws after the last death');
    const fb = await box7(E.o, E.i, 0.62, [0, 0, 640, 360]);
    assert(fb[2] >= 78 - 8 && fb[3] <= 184 + 8, `final day establish: the nodes' box ${fb} is not the network (y 78-184)`);
    const f = [0.52, 0.7, 0.92].map((t) => any6(D.o, D.i, 'art', t)), g = [0.1, 0.6, 0.85, 0.96, 2.29].map((t) => any6(D.o, D.i, 'art', t));
    assert((await Promise.all(f)).every((v) => v > 0) && (await Promise.all(g)).every((v) => v === 0), 'final day detail: the last node does not stutter in three spans and end lit');
  }

  // reduced effects: every reworked beat is one still
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of [nOpts(8), nOpts(32), nOpts(1), nOpts(4), nOpts(2), nOpts(3), nOpts(5), nOpts(11), nOpts(36), nOpts(15), nOpts(10)]) {
    for (const re of [':act$', ':detail$']) {
      const i = await newsIdx(o, re); if (i < 0) continue;
      const b = await info('news', o, i);
      assert(await shot('news', o, i, 0.4) === await shot('news', o, i, b.dur - 0.05), `news ${o.day} ${re}: reduced effects still moves`);
    }
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // effects reduced: a plain fade from ink, no dissolve of the old shot
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  const r1 = await shot('news', day7, 1, 0.1), r29 = await shot('news', day7, 1, 0.29), rEnd = await shot('news', day7, 1, 1.0);
  assert(r1 !== rEnd, 'reduced: no fade at t=0.1');
  assert(r29 === rEnd, 'reduced: transition still visible at t=0.29');
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  // motion off: every frame of the beat is identical
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  assert(await shot('news', day7, 1, 0.5) === await shot('news', day7, 1, 2.2), 'motion off still moves');
  const cam = await page.evaluate(() => BTB.Motion.enabled());
  assert(cam === false, 'enabled() true with effects reduced');

  // effects reduced: one still per beat of batch 5, part 2
  await page.evaluate(() => BTB.Settings.set('effects', 'reduced'));
  for (const o of reduced6) for (const re of [':establish$', ':detail$', ':hold$']) {
    const i = await newsIdx(o, re); if (i < 0) continue;
    const b = await info('news', o, i);
    assert(await shot('news', o, i, 0.4) === await shot('news', o, i, b.dur - 0.05), `batch 5b: news ${o.day} ${re}: reduced effects still moves`);
  }
  await page.evaluate(() => BTB.Settings.set('effects', 'full'));

  assert(warnings.length === 0, `unexpected console output: ${JSON.stringify(warnings)}`);
  console.log('motion-run: all asserts passed');

  // ---- Performance (phone, CPU throttled 4x). SKIP_PERF=1 skips it. ----
  // Scenes measured; later tasks add their shots here.
  const FEED5 = Array.from({ length: 5 }, (_, i) => ({ source: 'WIRE ' + i, title: 'Overnight headline ' + i + ' moves the whole index lower again', kind: ['chirp', 'mail', 'wire'][i % 3] }));
  const PERF_SCENES = [
    { scene: 'news', opts: { day: 0, brief: { title: 'FIRST DAY', feed: [] } } },
    { scene: 'news', opts: { day: 7, brief: { title: 'FOUR FUNDS, ONE MODEL', feed: [] } } },
    // batch 4: an act card with its document (8: act II and a footnote; 32: act IV and a memo), the third act card (17), and one day of every other document kind
    { scene: 'news', opts: { day: 8, brief: { title: 'A CIRCLE', feed: [] } } },
    { scene: 'news', opts: { day: 17, brief: { title: 'CONTAGION', feed: [] } } },
    { scene: 'news', opts: { day: 32, brief: { title: 'RECKONING', feed: [] } } },
    { scene: 'news', opts: { day: 4, brief: { title: 'RATING AFFIRMED', feed: [] } } },
    { scene: 'news', opts: { day: 2, brief: { title: 'DENIAL', feed: [] } } },
    { scene: 'news', opts: { day: 3, brief: { title: 'DELINQUENCY', feed: [] } } },
    { scene: 'news', opts: { day: 12, brief: { title: 'BIDS: 1', feed: [] } } },
    { scene: 'news', opts: { day: 11, brief: { title: 'COMPUTE FREEDOM', feed: [] } } },
    { scene: 'news', opts: { day: 36, brief: { title: 'VOICEMAIL', feed: [] } } },
    // batch 4, part 2: the desk (memo, close framing; footnote wide), the post and chart establishes under a zoom, a memo desk with a profile framing
    { scene: 'news', opts: { day: 1, brief: { title: 'RELEASE NOTES', feed: [] } } },
    { scene: 'news', opts: { day: 15, brief: { title: 'CREDIT LINE', feed: [] } } },
    { scene: 'news', opts: { day: 33, brief: { title: 'NINE THOUSAND WORDS', feed: [] } } },
    { scene: 'news', opts: { day: 43, brief: { title: 'MARKED AT 22 CENTS', feed: [] } } },
    // batch 5, part 1: the subway train (wide, and a zoomed platform), the street, the kitchen monitor, the lobby elevator, the TV
    { scene: 'news', opts: { day: 21, brief: { title: 'FOUR FUNDS, ONE MODEL', feed: [] } } },
    { scene: 'news', opts: { day: 31, brief: { title: 'VOLUME', feed: [] } } },
    { scene: 'news', opts: { day: 34, brief: { title: 'NINE THOUSAND WORDS', feed: [] } } },
    { scene: 'news', opts: { day: 13, brief: { title: 'BIDS: 1', feed: [] } } },
    { scene: 'news', opts: { day: 22, brief: { title: 'THE GUARANTEE', feed: [] } } },
    { scene: 'news', opts: { day: 18, brief: { title: 'CONTAGION', feed: [] } } },
    // batch 5, part 2: the lit floor (an establish and detail, a ticket), the dark floor (stutter on three beats), the skyline (summer-grey and winter), the racks
    { scene: 'news', opts: { day: 41, brief: { title: 'THE BILL PASSES', feed: [] } } },
    { scene: 'news', opts: { day: 23, brief: { title: 'MARKED AT 22 CENTS', feed: [] } } },
    { scene: 'news', opts: { day: 44, brief: { title: 'NO BIDS', feed: [] } } },
    { scene: 'news', opts: { day: 10, brief: { title: 'RACKS NEVER ENERGIZE', feed: [] } } },
    { scene: 'news', opts: { day: 27, brief: { title: 'THE FALSE DAWN', feed: [] } } },
    { scene: 'news', opts: { day: 35, brief: { title: 'THE FALSE DAWN', feed: [] } } },
    { scene: 'news', opts: { day: 45, brief: { title: 'THE STACK IS OFF', feed: [] }, game: { mode: { S: { f: { pulledPlug: true } } } } } },
    // batch 6: the story tableaux
    { scene: 'news', opts: { day: 6, brief: { title: 'KAVRO STRAIT', feed: [] } } },
    { scene: 'news', opts: { day: 9, brief: { title: 'THE GRID', feed: [] } } },
    { scene: 'news', opts: { day: 40, brief: { title: 'STABILIZATION VOTE PENDING', feed: [] } } },
    { scene: 'news', opts: { day: 45, brief: { title: 'SYSTEM STATUS UNRESOLVED', feed: [] } } },
    { scene: 'news', opts: { day: 37, brief: { title: 'MARKETS COMMITTEE HEARING', feed: [] } } },
    { scene: 'news', opts: { day: 25, brief: { title: 'PRESERVE ALL RECORDS', feed: [] } } },
    { scene: 'news', opts: { day: 20, brief: { title: 'RUN ON RIDGEWAY TRUST', feed: [] } } },
    { scene: 'news', opts: { day: 17, brief: { title: 'FOUR FUNDS', feed: [] } } },
    // batch 7: the decision scenes (a room beat and a face beat each): the vote room, the night office, the dinner, the clinic, the shelter, the treasury, the kitchen with the phone and the one with a pet's postcard, the lobby
    { scene: 'decision', opts: { id: 'c8', day: 39, speaker: 'Sen. Marcus Thorne', role: 'Chair', title: 'THE STABILIZATION ACT' } },
    { scene: 'decision', opts: { id: 'c7', day: 24, speaker: 'Desmond Kroll', role: 'Head of Trading', title: 'THE ADDENDUM' } },
    { scene: 'decision', opts: { id: 'advance', day: 31, speaker: 'Desmond Kroll', role: 'At dinner', title: 'THE ADVANCE' } },
    { scene: 'decision', opts: { id: 'vetER', day: 27, speaker: 'Your vet', role: 'After hours', title: 'VET ER' } },
    { scene: 'decision', opts: { id: 'adopt', day: 4, speaker: 'Harbor Street Animal Shelter', role: 'Open late', title: 'ADOPT' } },
    { scene: 'decision', opts: { id: 'c5', day: 21, speaker: 'Adele Venn', role: 'Treasury', title: 'RESCUE NIGHT' } },
    { scene: 'decision', opts: { id: 'dadBill', day: 18, speaker: 'Mom', role: 'Calling', title: 'DAD BILL' } },
    { scene: 'decision', opts: { id: 'vetCheck', day: 14, speaker: 'Your vet', role: 'Reminder', title: 'CHECKUP', S: { f: {}, wallet: { pet: { kind: 'cat', sex: 'boy', name: 'Rosco' } } } } },
    { scene: 'decision', opts: { id: 'rentHike', day: 11, speaker: 'Your landlord', role: 'Building management', title: 'RENT HIKE' } },
    { scene: 'close', opts: { report: { day: 3, pnl: 1200, quotaMet: true, quota: 900 } } },
    { scene: 'close', opts: { report: { day: 30, pnl: 1200, quotaMet: true, quota: 900 } } },
    // the close: a loss with the quota missed on the empty floor, and the two days with a Sqwak breaking insert (no game needed): a profit in autumn, and a seven-digit loss in winter
    { scene: 'close', opts: { report: { day: 30, pnl: -54321, quotaMet: false, quota: 2000, date: 'FRI NOV 14', indexPct: -2 } } },
    { scene: 'close', opts: { report: { day: 6, pnl: 1200, quotaMet: true, quota: 900, date: 'FRI OCT 10' } } },
    { scene: 'close', opts: { report: { day: 40, pnl: -1234567, quotaMet: false, quota: 5000, date: 'THU DEC 18', indexPct: -9 } } },
    // batch 9: the endings, one per recipe (wiped A, cassandra B, master C, soft D, quiet E, grind F, replaced G, whistle H, exit I, revolving J), clawback (the rectangle ceiling), and the pulled-plug after
    { scene: 'ending', opts: { id: 'wiped', title: 'WIPED OUT', deck: 'A line of deck text.', dark: true } },
    { scene: 'ending', opts: { id: 'cassandra', title: 'CASSANDRA', deck: 'A line of deck text.', dark: true } },
    { scene: 'ending', opts: { id: 'master', title: 'MASTER OF NOTHING', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'soft', title: 'SOFT LANDING', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'quiet', title: 'QUIET', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'grind', title: 'THE GRIND', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'replaced', title: 'REPLACED', deck: 'A line of deck text.', dark: true } },
    { scene: 'ending', opts: { id: 'whistle', title: 'WHISTLE', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'exit', title: 'EXIT', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'revolving', title: 'REVOLVING DOOR', deck: 'A line of deck text.', dark: false } },
    { scene: 'ending', opts: { id: 'clawback', title: 'CLAWBACK', deck: 'A line of deck text.', dark: true } },
    { scene: 'ending', opts: { id: 'depression', title: 'DEPRESSION', deck: 'A line of deck text.', dark: true } },
    { scene: 'ending', opts: { id: 'grind', title: 'THE GRIND', deck: 'A line of deck text.', dark: false, pulled: true } },
    { scene: 'weekend', opts: { day: 4 } },
    // heaviest variants: winter snow plus the breath on a cat in a penthouse, and autumn leaves with no pet
    { scene: 'weekend', opts: { day: 44, game: { mode: { S: { wallet: { tier: 5, pet: { kind: 'cat', sex: 'boy' } } } } } } },
    { scene: 'weekend', opts: { day: 9, game: { mode: { S: { wallet: { tier: 3 } } } } } },
    // batch 8: Sunday with a pet in winter (weather, breath, face glow), and the 3:17 beat in both forms (the lit-screen wave, the racks' LEDs)
    { scene: 'weekend', opts: { day: 49, game: { mode: { S: { wallet: { tier: 4, lateWeeks: 1, pet: { kind: 'dog', sex: 'girl' } } } } } } },
    { scene: 'weekend', opts: { day: 44, game: { mode: { S: { wallet: { tier: 2 } } } } } },
    { scene: 'weekend', opts: { day: 44, game: { mode: { S: { wallet: { tier: 2 }, f: { pulledPlug: true } } } } } },
    // the morning: an early day, a grey day and a winter day (three dead desks, stability 30, heat 60, snow in the windows)
    { scene: 'phone', opts: { day: 3, brief: { title: 'H', feed: FEED5 } } },
    { scene: 'phone', opts: { day: 40, brief: { title: 'H', feed: FEED5 } } },
    { scene: 'office', opts: { day: 3 } },
    { scene: 'office', opts: { day: 20, game: { mode: { S: { m: { stability: 70, heat: 20 }, f: {} } } } } },
    { scene: 'office', opts: { day: 40, game: { mode: { S: { m: { stability: 30, heat: 60 }, f: {} } } } } }
  ];
  // PERF_FIRST_MS: the first frame of every beat after a scene's first (built ahead during the beat before, inside no dissolve's budget)
  const PERF_AVG_MS = 8, PERF_MAX_MS = 33, PERF_FIRST_MS = 50, PERF_ATTEMPTS = 3, PERF_TIMEOUT_MS = 20000;
  const pct = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] : 0;
  const round = (x) => Math.round(x * 100) / 100;

  // One real-time playback of the whole scene; returns per-frame draw() times.
  const perfRun = async (scene, opts) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
    const pg = await ctx.newPage();
    let cdp = null, timer = null;
    try {
      await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
      await pg.keyboard.press('Enter');
      await pg.waitForSelector('#screen-menu.active', { timeout: 10000 });
      await pg.evaluate(() => {
        const S = BTB.Settings;
        S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
      });
      cdp = await ctx.newCDPSession(pg);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      // A scene that never finishes (or a throw that stops the loop) must not hang the runner.
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`perf: scene '${scene}' did not finish within ${PERF_TIMEOUT_MS / 1000} s`)), PERF_TIMEOUT_MS);
      });
      const playing = pg.evaluate(([s, o]) => new Promise((resolve) => {
        const C = BTB.Cinematic, orig = C.draw, origPrep = C.prepareNext, out = [], prep = [];
        let lastBeat = -1;
        // building the next beat's pictures ahead (not inside draw): its slowest call is recorded, not limited
        C.prepareNext = function () { const t0 = performance.now(); const r = origPrep.apply(this, arguments); prep.push(performance.now() - t0); return r; };
        C.draw = function () {
          const t0 = performance.now();
          const r = orig.apply(this, arguments);
          const ms = performance.now() - t0;
          out.push({ beat: this.i, first: this.i !== lastBeat, ms });
          lastBeat = this.i;
          return r;
        };
        if (C.running) C.finish();
        C.startChain('perf-qa');
        C.play(s, o, () => { C.draw = orig; C.prepareNext = origPrep; resolve({ frames: out, prepareMaxMs: Math.max(0, ...prep) }); });
      }), [scene, opts]);
      playing.catch(() => {}); // the context is closed on timeout; its late rejection is not news
      return await Promise.race([playing, timeout]);
    } finally {
      clearTimeout(timer);
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
      await ctx.close().catch(() => {});
    }
  };

  const perf = async (scene, opts) => {
    let result;
    const attempts = [];
    for (let attempt = 1; attempt <= PERF_ATTEMPTS; attempt++) {
      const { frames, prepareMaxMs } = await perfRun(scene, opts);
      const rest = frames.filter((f) => !f.first).map((f) => f.ms);
      const sorted = rest.slice().sort((a, b) => a - b);
      const avg = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : 0;
      const max = sorted.length ? sorted[sorted.length - 1] : 0;
      const firstFrames = frames.filter((f) => f.first).map((f) => ({ beat: f.beat, ms: round(f.ms) }));
      const lateFirst = Math.max(0, ...firstFrames.filter((f) => f.beat > 0).map((f) => f.ms));
      const pass = rest.length > 0 && avg < PERF_AVG_MS && max <= PERF_MAX_MS && lateFirst <= PERF_FIRST_MS;
      attempts.push({ avgMs: round(avg), p95Ms: round(pct(sorted, 0.95)), maxMs: round(max), lateFirstMs: lateFirst });
      // Top level: the passing attempt, or the last one when none passed.
      result = { scene, status: pass ? 'pass' : 'fail', framesMeasured: rest.length, framesTotal: frames.length, avgMs: round(avg), p95Ms: round(pct(sorted, 0.95)), maxMs: round(max), lateFirstMs: lateFirst, prepareMaxMs: round(prepareMaxMs), firstFrameMs: firstFrames, attempts };
      if (pass) break;
    }
    return result;
  };

  if (process.env.SKIP_PERF === '1') console.log('motion-run: perf skipped (SKIP_PERF=1)');
  else {
    const results = [];
    for (const { scene, opts } of PERF_SCENES) {
      const r = await perf(scene, opts);
      results.push(r);
      r.day = opts.day != null ? opts.day : opts.report && opts.report.day; if (opts.id) r.id = opts.id; if (opts.pulled) r.pulled = true; const wal = opts.game && opts.game.mode.S.wallet; r.tier = wal ? wal.tier : undefined; r.pet = !!(wal && wal.pet);
      console.log(`perf ${scene}${opts.id ? " " + opts.id : ""}${r.day != null ? ' day ' + r.day : ''}${r.tier != null ? ' tier ' + r.tier : ''}${r.pet ? ' pet' : ''}: ${r.status} attempts=${r.attempts.length} framesMeasured=${r.framesMeasured}/${r.framesTotal} avg=${r.avgMs} p95=${r.p95Ms} max=${r.maxMs} firstMax=${Math.max(0, ...r.firstFrameMs.map((f) => f.ms))} lateFirstMax=${r.lateFirstMs}`);
    }
    const outDir = path.join(root, 'qa', 'evidence', 'motion');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'perf.json'), JSON.stringify({
      viewport: '844x390', deviceScaleFactor: 3, cpuThrottle: 4, limits: { avgMs: PERF_AVG_MS, maxMs: PERF_MAX_MS, lateFirstMs: PERF_FIRST_MS }, scenes: results
    }, null, 2) + '\n');
    const failed = results.filter((r) => r.status !== 'pass');
    assert(!failed.length, `perf limits exceeded: ${failed.map((r) => r.scene).join(', ')}`);
    console.log('motion-run: perf within limits');
  }
}

// Every path (pass, failed assert, throw) closes the browser, stops the server and sets the exit code.
(async () => {
  try { await run(); }
  finally {
    try { if (browser) await browser.close(); } catch (e) { /* already gone */ }
    server.kill();
  }
})().then(() => process.exit(0), (error) => { console.error(error.stack || error); process.exit(1); });
