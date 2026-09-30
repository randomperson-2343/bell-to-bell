// Renders the new audio offline in Chromium and checks it against the measurements
// that came with the music kit (js/tests/audio-expected.json).
//
//   NODE_PATH=<runtime node_modules> node js/tests/audio-render-run.js          # everything
//   NODE_PATH=<runtime node_modules> node js/tests/audio-render-run.js --quick  # menu, Act I feed and day, 10 effects
//
// This uses the real Web Audio graph (OfflineAudioContext), so it is the check
// that the in-game sound matches the approved previews. It needs no audio
// device. Tolerances are the handoff's (section 10): loudness within 1.5 LU,
// brightness within 15 percent, effect peaks within 2 dB (3 for sounds made of
// noise bursts) and lengths within 15 percent, and no click at the loop point.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const quick = process.argv.includes('--quick');
const exp = JSON.parse(fs.readFileSync(path.join(__dirname, 'audio-expected.json'), 'utf8'));
const LOUD_TOL = 1.5, BRIGHT_TOL = 0.15, PEAK_TOL = 2, PEAK_TOL_NOISY = 3, LEN_TOL = 0.15, SEAM_MAX = 1.3;

const rows = [];
let failed = 0;
function check(name, ok, detail) {
  rows.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.log('  page error:', e.message); failed++; });
  await page.goto('about:blank');
  await page.evaluate(() => { window.BTB = {}; });
  for (const f of ['voices', 'music-data', 'sfx-pack', 'music-engine', 'sfx-engine']) await page.addScriptTag({ path: path.join(root, 'js', 'audio', f + '.js') });
  // the meters run in the page so only numbers cross back
  const meter = fs.readFileSync(path.join(__dirname, 'loudness.js'), 'utf8');
  await page.evaluate((src) => { const module = { exports: {} }; new Function('module', 'exports', src)(module, module.exports); window.__M = module.exports; }, meter);

  async function renderTrack(key, intensity, sr) {
    return page.evaluate(async ({ key, intensity, sr }) => {
      const B = window.BTB, M = window.__M;
      const sc = B.MusicEngine.scoreFor(key), loop = sc.loopBeats * 60 / sc.bpm, tail = 9;
      const full = await B.MusicEngine.renderOffline(key, { intensity, seconds: loop + tail, sampleRate: sr, oneLoop: true });
      // fold the ring-out back onto the start: a seamless single loop
      const L = Math.round(loop * sr), out = [new Float32Array(L), new Float32Array(L)];
      for (let c = 0; c < 2; c++) {
        const d = full.getChannelData(c);
        out[c].set(d.subarray(0, L));
        for (let i = 0; i < tail * sr && i < L; i++) out[c][i] += d[L + i];
      }
      return { lufs: M.lufs(out, sr), centroid: M.centroid(out, sr), peak: M.peakDb(out), seam: M.seamRatio(out) };
    }, { key, intensity, sr: sr || 44100 });
  }

  console.log('Music');
  const endingKeys = Object.keys(exp.music).filter((k) => k.startsWith('end_'));
  const tracks = quick ? ['menu', 'feed1', 'game1', 'end_wiped', 'end_whistle'] : ['menu', 'feed1', 'feed2', 'feed3', 'feed4', 'game1', 'game2', 'game3', 'game4'].concat(endingKeys);
  for (const key of tracks) {
    const e = exp.music[key];
    if (key.startsWith('game')) {
      const levels = quick ? ['0.6'] : ['0.15', '0.6', '1.0'];
      const got = {};
      for (const i of levels) {
        const r = await renderTrack(key, +i);
        got[i] = r;
        check(`${key} at intensity ${i}: loudness`, Math.abs(r.lufs - e.lufs[i]) <= LOUD_TOL, `${r.lufs.toFixed(1)} LUFS (kit ${e.lufs[i]})`);
        check(`${key} at intensity ${i}: brightness`, Math.abs(r.centroid / e.centroid[i] - 1) <= BRIGHT_TOL, `${Math.round(r.centroid)} Hz (kit ${e.centroid[i]})`);
        check(`${key} at intensity ${i}: loop seam`, r.seam <= SEAM_MAX, `${r.seam.toFixed(2)} of a normal step`);
      }
      if (levels.length === 3) check(`${key}: louder as intensity rises`, got['0.15'].lufs < got['0.6'].lufs && got['0.6'].lufs < got['1.0'].lufs, `${got['0.15'].lufs.toFixed(1)} < ${got['0.6'].lufs.toFixed(1)} < ${got['1.0'].lufs.toFixed(1)}`);
    } else {
      const r = await renderTrack(key, 0.6);
      check(`${key}: loudness`, Math.abs(r.lufs - e.lufs) <= LOUD_TOL, `${r.lufs.toFixed(1)} LUFS (kit ${e.lufs})`);
      check(`${key}: brightness`, Math.abs(r.centroid / e.centroid - 1) <= BRIGHT_TOL, `${Math.round(r.centroid)} Hz (kit ${e.centroid})`);
      check(`${key}: loop seam`, r.seam <= SEAM_MAX, `${r.seam.toFixed(2)} of a normal step`);
    }
  }
  {
    // Phones and most laptops run the audio clock at 48 kHz. The reverb tails are
    // built at 44.1 kHz and resampled, so the level must not move.
    const r = await renderTrack('menu', 0.6, 48000);
    check('menu at 48 kHz: loudness', Math.abs(r.lufs - exp.music.menu.lufs) <= LOUD_TOL, `${r.lufs.toFixed(1)} LUFS (kit ${exp.music.menu.lufs})`);
  }
  if (!quick) {
    // the feeds darken act by act
    const bright = [];
    for (const k of ['feed1', 'feed2', 'feed3', 'feed4']) bright.push((await renderTrack(k, 0.6)).centroid);
    check('the feed darkens act by act', bright[0] > bright[1] && bright[1] > bright[2] && bright[2] > bright[3], bright.map(Math.round).join(' > '));
  }

  console.log('Sound effects');
  const sfx = await page.evaluate(async () => {
    const B = window.BTB, sr = 44100, out = {};
    for (const id of Object.keys(B.AudioData.sfx)) {
      const pack = B.AudioData.sfx[id];
      const c = new OfflineAudioContext(2, Math.ceil((pack.durationS + 3) * sr), sr);
      const mixer = B.AudioMixer.get(c);
      mixer.sfx.disconnect(); mixer.sfx.connect(c.destination);   // measure before the soft limiter
      B.SfxEngine.make(mixer).play(id, { n: pack.nParam ? pack.nParam.default : undefined });
      const r = await c.startRendering(), a = r.getChannelData(0), b = r.getChannelData(1), n = a.length;
      let pk = 0; const m = new Float32Array(n);
      for (let i = 0; i < n; i++) { m[i] = Math.max(Math.abs(a[i]), Math.abs(b[i])); if (m[i] > pk) pk = m[i]; }
      let last = 0; const thr = pk * Math.pow(10, -50 / 20);
      for (let i = n - 1; i >= 0; i--) if (m[i] > thr) { last = i; break; }
      out[id] = { peak: 20 * Math.log10(pk + 1e-12), seconds: (last + 0.02 * sr) / sr, nan: a.some(Number.isNaN) };
    }
    return out;
  });
  const ten = ['order_buy', 'order_sell', 'ui_click', 'order_reject', 'win_close', 'bell_open', 'bell_close', 'sqwak_push', 'flash_crash', 'anomaly_logged'];
  const ids = quick ? ten : Object.keys(exp.sfx);
  let within = 0;
  for (const id of ids) {
    const e = exp.sfx[id], r = sfx[id];
    const dp = r.peak - e.peak_db, dl = r.seconds / e.duration_s - 1;
    // The ten named in the handoff get its 2 dB. The rest get 3: a sound made of noise bursts
    // peaks a little differently with each draw of the noise.
    const ok = Math.abs(dp) <= (ten.indexOf(id) >= 0 ? PEAK_TOL : PEAK_TOL_NOISY) && Math.abs(dl) <= LEN_TOL && !r.nan;
    if (ok) within++;
    // Reverb tails are the kit's own (same random stream), so every sound should land.
    if (quick || ten.indexOf(id) >= 0 || !ok) check(`${id}`, ok, `peak ${r.peak.toFixed(1)} dBFS (kit ${e.peak_db}), length ${r.seconds.toFixed(2)} s (kit ${e.duration_s})`);
  }
  if (!quick) check(`all ${ids.length} sounds within 2 to 3 dB and 15 percent`, within === ids.length, `${within} of ${ids.length}`);

  await browser.close();
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
