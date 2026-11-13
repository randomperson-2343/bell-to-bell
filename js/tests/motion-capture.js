// Capture a six-frame strip (and optionally a real-time video) of one cutscene beat.
// node js/tests/motion-capture.js <scene> <optsJSON> <beatIndex> [--video] [--times=a,b,c,d,e,f]
// --times: six sample times in seconds into the beat (default 0, 0.2 ... 1 of the beat length).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const timesArg = process.argv.find((a) => a.startsWith('--times='));
const times = timesArg ? timesArg.slice(8).split(',').map(Number) : null;
if (times && (times.length !== 6 || times.some((x) => !isFinite(x)))) { console.error('--times needs six numbers'); process.exit(2); }
const args = process.argv.slice(2).filter((a) => a !== '--video' && !a.startsWith('--times='));
const video = process.argv.includes('--video');
const [scene, optsJSON, beatIndex] = args;
if (!scene || !optsJSON || beatIndex == null) { console.error('usage: motion-capture.js <scene> <optsJSON> <beatIndex> [--video]'); process.exit(2); }
const opts = JSON.parse(optsJSON), index = +beatIndex;
const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4180);
const out = path.join(root, 'qa', 'evidence', 'motion');
fs.mkdirSync(out, { recursive: true });
const id = opts.day != null ? opts.day : opts.id != null ? opts.id : 'default';
const base = `${scene}-${id}-${index}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const url = `http://127.0.0.1:${port}/index.html`;

async function boot(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#screen-menu.active', { timeout: 10000 });
  await page.evaluate(() => {
    const S = BTB.Settings;
    S.set('sound', false); S.set('music', false); S.set('effects', 'full'); S.set('cinematics', 'full');
  });
}

(async () => {
  await wait(450);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await boot(page);
  const dataUrl = await page.evaluate(([scene, opts, index, times]) => {
    const C = BTB.Cinematic;
    C.startChain('capture'); C.play(scene, opts, () => {}); C.pause();
    const beat = C.beats[index];
    if (!beat) throw new Error(`${scene} has ${C.beats.length} beats, no beat ${index}`);
    const strip = document.createElement('canvas');
    strip.width = 640 * 6; strip.height = 360;
    const sc = strip.getContext('2d');
    sc.imageSmoothingEnabled = false;
    (times || [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => p * beat.dur)).forEach((t, k) => {
      C.seek(index, t);
      sc.drawImage(document.getElementById('cine-canvas'), k * 640, 0, 640, 360);
    });
    return strip.toDataURL('image/png');
  }, [scene, opts, index, times]);
  fs.writeFileSync(path.join(out, `${base}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(path.join(out, `${base}.png`));
  await ctx.close();

  if (video) {
    const tmp = path.join(out, `.tmp-${base}`);
    const vctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1, recordVideo: { dir: tmp, size: { width: 640, height: 360 } } });
    const vp = await vctx.newPage();
    await boot(vp);
    const total = await vp.evaluate(([scene, opts]) => {
      BTB.Cinematic.startChain('capture');
      BTB.Cinematic.play(scene, opts, () => { window.__cineDone = true; });
      return BTB.Cinematic.beats.reduce((a, b) => a + b.dur, 0);
    }, [scene, opts]);
    await vp.waitForFunction(() => window.__cineDone === true, null, { timeout: (total + 5) * 1000 });
    await wait(150);
    const file = await vp.video().path();
    await vctx.close();
    fs.renameSync(file, path.join(out, `${base}.webm`));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(path.join(out, `${base}.webm`));
  }
  await browser.close(); server.kill();
})().catch((error) => { console.error(error.stack || error); server.kill(); process.exit(1); });
