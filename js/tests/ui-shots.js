// UI screenshots for art review. Runs in CI with Playwright + Chromium, like phone-run.js.
//   node js/tests/ui-shots.js [root ...]
// Shoots each project root (default: this checkout) at desktop and phone sizes:
// boot, menu, the briefing phone, the trading desk, a ringing call, a toast and
// a modal. PNGs land in qa/ui/<label>/. With UI_SHOTS_LOG=1 each shot is also
// printed to the log as base64 JPEG between ===SHOT name=== and ===END===
// lines, so a reviewer without artifact access can read them from the job log.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const here = path.join(__dirname, '..', '..');
const roots = process.argv.slice(2).length ? process.argv.slice(2) : [here];
const outBase = process.env.UI_SHOTS_OUT || path.join(here, 'qa', 'ui');
const LOG = process.env.UI_SHOTS_LOG === '1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root, port) {
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const once = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/index.html', timeout: 1500 }, (res) => { res.resume(); resolve(p); });
      req.on('error', () => (Date.now() - t0 > 15000 ? reject(new Error('server did not start')) : setTimeout(once, 200)));
      req.on('timeout', () => req.destroy());
    };
    once();
  });
}

async function emit(page, dir, name, opts) {
  const file = path.join(dir, name + '.png');
  await page.screenshot({ path: file, ...(opts || {}) });
  if (LOG) {
    const jpg = await page.screenshot({ type: 'jpeg', quality: 72, ...(opts || {}) });
    const b64 = jpg.toString('base64');
    console.log(`===SHOT ${path.basename(dir)}/${name}===`);
    for (let i = 0; i < b64.length; i += 8000) console.log(b64.slice(i, i + 8000));
    console.log('===END===');
  }
}

async function run(browser, root, label, port) {
  const dir = path.join(outBase, label);
  fs.mkdirSync(dir, { recursive: true });
  const server = await serve(root, port);
  const url = `http://127.0.0.1:${port}/index.html`;
  try {
    for (const vp of [{ n: 'desk', w: 1440, h: 900, m: false }, { n: 'phone', w: 390, h: 844, m: true }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log(`[${label} ${vp.n}] page error: ${e.message}`));
      await page.goto(url, { waitUntil: 'load' });
      await wait(1600);
      await emit(page, dir, `${vp.n}-boot`);
      await page.keyboard.press('Enter');
      await page.waitForSelector('#screen-menu.active', { timeout: 15000 });
      await page.evaluate(() => { BTB.Settings.set('sound', false); BTB.Settings.set('music', false); BTB.Settings.set('cinematics', 'off'); });
      await wait(600);
      await emit(page, dir, `${vp.n}-menu`);
      await page.evaluate(() => BTB.Main.newStory());
      // Click through the opening modals; shoot the first one that holds the pre-open phone.
      let shotBrief = false;
      for (let t0 = Date.now(); Date.now() - t0 < 25000;) {
        if (await page.evaluate(() => !!(BTB.UI.g && BTB.UI.g.running))) break;
        if (!shotBrief && await page.evaluate(() => !!document.querySelector('.preopen-device'))) {
          shotBrief = true; await wait(1200); await emit(page, dir, `${vp.n}-briefing`);
        }
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('#modal-layer button')).filter((x) => !x.disabled && x.offsetParent);
          const p = b.find((x) => x.classList.contains('primary')) || b[b.length - 1];
          if (p) p.click();
        });
        await wait(300);
      }
      await page.evaluate(() => { const g = BTB.UI.g; if (g) g.speed = 0; BTB.UI.clearNotes && BTB.UI.clearNotes(); });
      await page.evaluate(() => { const g = BTB.UI.g; if (g) for (const tk of g.market.tickers.slice(0, 3)) g.trade(tk.sym, 1); });
      await wait(500);
      await emit(page, dir, `${vp.n}-game`);
      await page.evaluate(() => BTB.UI.phoneRing({ from: 'Imani Brooks', role: 'Desk head', kind: 'tip' }));
      await page.evaluate(() => BTB.UI.toast('Filled: bought 1 share.', 'good'));
      await wait(400);
      await emit(page, dir, `${vp.n}-call`);
      await page.evaluate(() => BTB.UI.phoneHide());
      await page.evaluate(() => BTB.Screens.modal({ title: 'End of day', body: '<p>Art review: a sample modal.</p>', buttons: [{ label: 'Back' }, { label: 'Continue', cls: 'primary' }] }));
      await wait(300);
      await emit(page, dir, `${vp.n}-modal`);
      await ctx.close();
    }
  } finally {
    server.kill();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (let i = 0; i < roots.length; i++) await run(browser, roots[i], roots.length > 1 ? (i ? 'after' : 'before') : 'after', 4190 + i);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
