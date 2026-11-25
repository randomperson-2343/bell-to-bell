// UI overlap audit. Runs in CI with Playwright + Chromium, like phone-run.js.
//   node js/tests/ui-audit.js
// Walks every screen it can reach (boot, menu pages, briefing, the desk and its
// tabs, a call, a toast, pause, end of day, the Ledger, decision cards, an
// aftermath and ending pages) at desktop, upright phone and sideways phone
// sizes, and looks for:
//   overlap  two pieces of text, or text and a drawn box (plate, gauge, icon,
//            logo, button art), sitting on top of each other in the same layer
//   cut      text clipped by its box or an ancestor (not counting ellipsis)
//   ellipsis text shortened with "..."
//   offscreen text running past the viewport edge
// Results print as one "AUDIT {json}" line per screen. With UI_AUDIT_LOG=1, each
// screen that has an issue is also printed as a base64 JPEG with the issues
// outlined (red: overlap, amber: cut or offscreen), between ===SHOT name=== and
// ===END=== lines, plus a clean shot of a fixed set of screens. Exit code 1 if
// UI_AUDIT_STRICT=1 and any overlap, cut or offscreen issue is found.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const out = process.env.UI_AUDIT_OUT || path.join(root, 'qa', 'audit');
const LOG = process.env.UI_AUDIT_LOG === '1';
const STRICT = process.env.UI_AUDIT_STRICT === '1';
const ONLY = (process.env.UI_AUDIT_VIEWPORTS || '').split(',').filter(Boolean);
const port = +(process.env.QA_PORT || 4191);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  { n: 'desk1440', w: 1440, h: 900, m: false },
  { n: 'desk1280', w: 1280, h: 720, m: false },
  { n: 'desk1024', w: 1024, h: 768, m: false },
  { n: 'up360', w: 360, h: 740, m: true },
  { n: 'up390', w: 390, h: 844, m: true },
  { n: 'up430', w: 430, h: 932, m: true },
  { n: 'side740', w: 740, h: 360, m: true },
  { n: 'side844', w: 844, h: 390, m: true },
  { n: 'side932', w: 932, h: 430, m: true },
].filter((v) => !ONLY.length || ONLY.includes(v.n));
// Clean shots for before/after, on these viewports only.
const CLEAN = new Set(['desk1440', 'up390', 'side844']);
const CLEAN_SCREENS = new Set(['menu', 'game-trade', 'game-positions', 'game-news', 'call', 'pause', 'eod', 'choice-1', 'ending-1']);

function serve() {
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

// Runs in the page. Returns the issues found on screen now.
function auditPage() {
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const sel = (el) => {
    const parts = [];
    for (let n = el, i = 0; n && n.nodeType === 1 && i < 3; i++, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(s + '#' + n.id); break; }
      const cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  // The layer an element paints in. Overlays are meant to cover the desk, so
  // only things in the same layer are compared.
  const LAYERS = '#modal-layer .modal, #modal-layer, #toasts, #phone, #lock-overlay, #mc-banner, #ring-pill, .screen.active, #screen-ending-page';
  const layerOf = (el) => el.closest(LAYERS);
  // The visible box after ancestor clipping.
  const clipOf = (el) => {
    let c = { l: 0, t: 0, r: vw, b: vh };
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const b = n.getBoundingClientRect();
        c = { l: Math.max(c.l, b.left), t: Math.max(c.t, b.top), r: Math.min(c.r, b.right), b: Math.min(c.b, b.bottom) };
      }
    }
    return c;
  };
  const inter = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const area = (r) => Math.max(0, r.r - r.l) * Math.max(0, r.b - r.t);
  const R = (d) => ({ l: d.left, t: d.top, r: d.right, b: d.bottom });

  const scopes = Array.from(document.querySelectorAll('.screen.active, #modal-layer, #toasts, #phone, #lock-overlay, #mc-banner')).filter(vis);
  const atoms = [];
  const issues = [];
  const seenEl = new Set();
  for (const scope of scopes) {
    // Text runs.
    const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const txt = t.nodeValue.replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      const el = t.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION|TITLE)$/.test(el.tagName) || !vis(el)) continue;
      const cs = getComputedStyle(el);
      // A 0px font is not trusted to hide text: mobile Chrome's minimum font
      // size still paints it. The range's own boxes say what is painted.
      if (el.closest('#menu-tape') || cs.color.replace(/\s/g, '').endsWith(',0)') || cs.color === 'transparent') continue;
      const clip = clipOf(el);
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const d of rg.getClientRects()) {
        if (d.width < 1 || d.height < 1) continue;
        // Trim the line box to the ink, roughly, so stacked lines don't touch.
        const pad = d.height * 0.18;
        const full = { l: d.left, t: d.top + pad, r: d.right, b: d.bottom - pad };
        const shown = inter(full, clip);
        if (area(shown) <= 0) continue;
        atoms.push({ kind: 'text', el, txt: txt.slice(0, 24), r: shown, layer: layerOf(el) });
        if (full.r > vw + 1 || full.l < -1) issues.push({ type: 'offscreen', a: sel(el), txt: txt.slice(0, 24), r: full });
        else if (full.r > clip.r + 1.5 || full.l < clip.l - 1.5) {
          if (!seenEl.has(el)) { seenEl.add(el); issues.push({ type: 'cut', a: sel(el), txt: txt.slice(0, 24), r: shown, how: 'clipped by an ancestor' }); }
        }
      }
      if (!seenEl.has(el) && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
        seenEl.add(el);
        issues.push({ type: cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'cut', a: sel(el), txt: txt.slice(0, 24), r: R(el.getBoundingClientRect()), how: `scrollWidth ${el.scrollWidth} > ${el.clientWidth}` });
      }
    }
    // Drawn boxes: anything with art or a solid fill that is small enough to be
    // a thing (plate, gauge, icon, logo, button, badge), not a panel.
    for (const el of scope.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      const art = (cs.backgroundImage && cs.backgroundImage !== 'none') || (cs.borderImageSource && cs.borderImageSource !== 'none');
      const fill = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      const media = /^(IMG|CANVAS|SVG|VIDEO)$/i.test(el.tagName);
      if (!art && !fill && !media) continue;
      const d = el.getBoundingClientRect();
      if (d.width * d.height > vw * vh * 0.12 || d.width < 3 || d.height < 3) continue;
      const shown = inter(R(d), clipOf(el));
      if (area(shown) <= 0) continue;
      atoms.push({ kind: 'box', el, txt: '', r: shown, layer: layerOf(el) });
    }
  }
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  const pairSeen = new Set();
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], Bx = atoms[j];
      if (A.kind === 'box' && Bx.kind === 'box') {
        // Two boxes only count when neither holds the other and both are leaves
        // or labelled things (a plate, a gauge, an icon).
        if (related(A.el, Bx.el)) continue;
      } else if (related(A.el, Bx.el)) {
        // Text inside its own box is the point of the box.
        if (A.kind !== Bx.kind) continue;
        if (A.el === Bx.el) continue; // two lines of one element
      }
      if (A.layer !== Bx.layer) continue;
      const x = inter(A.r, Bx.r);
      const w = x.r - x.l, h = x.b - x.t;
      if (w < 2 || h < 2 || w * h < 6) continue;
      const key = [A.el, Bx.el].map(sel).sort().join('|');
      if (pairSeen.has(key)) continue;
      pairSeen.add(key);
      // Which one is on top at the overlap?
      const top = document.elementFromPoint((x.l + x.r) / 2, (x.t + x.b) / 2);
      issues.push({ type: 'overlap', kinds: A.kind + '+' + Bx.kind, a: sel(A.el), at: A.txt, b: sel(Bx.el), bt: Bx.txt, r: x,
        top: top ? sel(top) : '', ra: A.r, rb: Bx.r });
    }
  }
  return issues;
}

function markPage(issues) {
  const box = document.createElement('div');
  box.id = '__audit_marks';
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  for (const it of issues) {
    if (it.type === 'ellipsis') continue;
    const r = it.r;
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${r.l - 2}px;top:${r.t - 2}px;width:${r.r - r.l + 4}px;height:${r.b - r.t + 4}px;outline:2px solid ${it.type === 'overlap' ? '#ff2040' : '#ffb000'}`;
    box.appendChild(d);
  }
  document.body.appendChild(box);
}

async function emit(page, name) {
  if (!LOG) return;
  const jpg = await page.screenshot({ type: 'jpeg', quality: 70 });
  const b64 = jpg.toString('base64');
  console.log(`===SHOT ${name}===`);
  for (let i = 0; i < b64.length; i += 8000) console.log(b64.slice(i, i + 8000));
  console.log('===END===');
}

let bad = 0;
async function check(page, vp, name) {
  await wait(250);
  let issues;
  try { issues = await page.evaluate(auditPage); } catch (e) { console.log(`AUDIT-ERR ${vp.n}/${name} ${e.message}`); return; }
  const serious = issues.filter((i) => i.type !== 'ellipsis');
  bad += serious.length;
  console.log('AUDIT ' + JSON.stringify({ vp: vp.n, screen: name, n: serious.length, issues }));
  if (CLEAN.has(vp.n) && CLEAN_SCREENS.has(name)) await emit(page, `clean/${vp.n}/${name}`);
  if (serious.length) {
    await page.evaluate(markPage, issues);
    await emit(page, `marked/${vp.n}/${name}`);
    await page.evaluate(() => { const m = document.getElementById('__audit_marks'); if (m) m.remove(); });
  }
}

async function step(page, vp, name, fn) {
  try { await fn(); await check(page, vp, name); } catch (e) { console.log(`AUDIT-ERR ${vp.n}/${name} ${String(e.message || e).slice(0, 200)}`); }
}

async function closeModal(page) { await page.evaluate(() => { try { BTB.Screens.closeModal(); } catch (e) { /* none open */ } }); }

async function viewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${vp.n}] page error: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await wait(1500);
  await check(page, vp, 'boot');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#screen-menu.active', { timeout: 15000 });
  await page.evaluate(() => { BTB.Settings.set('sound', false); BTB.Settings.set('music', false); BTB.Settings.set('cinematics', 'off'); });
  await wait(500);
  await check(page, vp, 'menu');
  for (const [btn, name] of [['btn-load', 'saves'], ['btn-endless', 'endless'], ['btn-settings', 'settings'], ['btn-exit', 'exit']]) {
    await step(page, vp, name, async () => { await page.evaluate((b) => document.getElementById(b).click(), btn); await wait(400); });
    await closeModal(page);
    await page.evaluate(() => BTB.Screens.goMenu());
  }
  await step(page, vp, 'howto', async () => { await page.evaluate(() => BTB.Screens.show('howto')); });
  await step(page, vp, 'endings', async () => { await page.evaluate(() => BTB.Screens.showEndings()); await wait(300); });
  await page.evaluate(() => BTB.Screens.goMenu());

  // New career: audit each opening modal as it comes.
  await page.evaluate(() => BTB.Main.newStory());
  const titles = new Set();
  for (let t0 = Date.now(); Date.now() - t0 < 30000;) {
    if (await page.evaluate(() => !!(BTB.UI.g && BTB.UI.g.running))) break;
    const title = await page.evaluate(() => { const m = document.querySelector('#modal-layer .modal'); return m ? (m.querySelector('h2,h3,.title') || m).textContent.trim().slice(0, 30) : ''; });
    if (title && !titles.has(title)) { titles.add(title); await wait(900); await check(page, vp, 'brief-' + titles.size); }
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#modal-layer button')).filter((x) => !x.disabled && x.offsetParent);
      const p = b.find((x) => x.classList.contains('primary')) || b[b.length - 1];
      if (p) p.click();
    });
    await wait(300);
  }
  await page.evaluate(() => { const g = BTB.UI.g; if (g) g.speed = 0; BTB.UI.clearNotes && BTB.UI.clearNotes(); });
  await page.evaluate(() => { const g = BTB.UI.g; if (g) for (const tk of g.market.tickers.slice(0, 3)) g.trade(tk.sym, 1); });
  await wait(400);
  const tabs = await page.evaluate(() => !!document.querySelector('#phone-tabs') && getComputedStyle(document.querySelector('#phone-tabs')).display !== 'none');
  for (const tab of ['trade', 'positions', 'news']) {
    await step(page, vp, 'game-' + tab, async () => {
      if (tabs) await page.evaluate((t) => { const b = document.querySelector(`#phone-tabs [data-ptab="${t}"]`); if (b) b.click(); }, tab);
      await wait(250);
      await page.evaluate(() => BTB.UI.clearNotes && BTB.UI.clearNotes());
    });
    if (!tabs) break;
  }
  if (tabs) await page.evaluate(() => { const b = document.querySelector('#phone-tabs [data-ptab="trade"]'); if (b) b.click(); });
  // Stress stages change the gauge art and words.
  for (const v of [55, 92]) {
    await step(page, vp, 'stress-' + v, async () => { await page.evaluate((x) => { const g = BTB.UI.g; g.stress.v = x; BTB.UI.render && BTB.UI.render(true); }, v); await wait(200); });
  }
  await page.evaluate(() => { const g = BTB.UI.g; g.stress.v = 5; });
  await step(page, vp, 'call', async () => { await page.evaluate(() => BTB.UI.phoneRing({ from: 'Imani Brooks', role: 'Desk head', kind: 'tip' })); await wait(400); });
  await page.evaluate(() => BTB.UI.phoneHide());
  await step(page, vp, 'toast', async () => { await page.evaluate(() => { BTB.UI.toast('Filled: bought 1 share of the longest ticker on the board.', 'good'); BTB.UI.toast('Margin warning: equity is under maintenance.', 'bad'); }); await wait(300); });
  await page.evaluate(() => BTB.UI.clearNotes && BTB.UI.clearNotes());
  await step(page, vp, 'pause', async () => { await page.evaluate(() => document.getElementById('btn-pause').click()); await wait(400); });
  await closeModal(page);
  await step(page, vp, 'eod', async () => {
    await page.evaluate(() => {
      const g = BTB.UI.g;
      BTB.Screens.eod(g, { pnl: 1834.5, adj: -250, start: 100000, quota: 1250, quotaMet: true, indexPct: -0.0213, equity: 101584.5, trades: 14, best: 912.4, worst: -431.2, stressPeak: 74,
        eod: { forced: ['RIDG'], borrow: 12.4, interest: 31.9, expired: [] }, notes: ['Kroll wants the book flat by Friday.'] }, () => {});
    });
  });
  await closeModal(page);
  await step(page, vp, 'ledger', async () => {
    await page.evaluate(() => {
      const S = BTB.UI.g && BTB.UI.g.mode;
      const E = BTB.Economy || (S && S.E);
      const tiers = (E && E.TIERS) || [{ name: 'Couch', rent: 0, note: 'A friend\'s couch.' }, { name: 'Shared flat', rent: 300, note: 'Two roommates.' }, { name: 'Studio', rent: 650, note: 'Your own door.' }];
      BTB.Screens.ledger({ wallet: { tier: 1, cash: 2140, card: 380, arrears: 0, deficit: 600, rentMult: 1 }, tiers, worth: 1760, weekly: 512, draw: 940, quotaPay: 150,
        options: tiers.map((t, i) => ({ i, name: t.name, rent: t.rent || 0, weekly: (t.rent || 0) + 212, cost: (t.rent || 0) * 2, afford: i < 3, note: t.note || '', current: i === 1 })) }, () => {});
    });
  });
  await closeModal(page);
  const ids = await page.evaluate(() => { const C = BTB.StoryData.CHOICES; const k = Object.keys(C); const L = (x) => (JSON.stringify(C[x].text || '') + JSON.stringify(C[x].options || '')).length; return k.sort((a, b) => L(b) - L(a)).slice(0, 2).concat(k.slice(0, 1)); });
  for (let i = 0; i < ids.length; i++) {
    await step(page, vp, 'choice-' + (i + 1), async () => {
      await page.evaluate((id) => {
        const c = BTB.StoryData.CHOICES[id];
        const view = Object.assign({}, c, { options: c.options.map((o) => Object.assign({}, o, { req: null })) });
        BTB.Screens.choice(view, (BTB.UI.g.mode && BTB.UI.g.mode.S) || {}, () => {});
      }, ids[i]);
      await wait(300);
    });
    await closeModal(page);
  }
  await step(page, vp, 'aftermath', async () => {
    await page.evaluate(() => BTB.Screens.aftermath('The vote', ['The committee voted the bill down eleven to nine.', 'Kroll did not look up from his screen.'], () => {}, { id: Object.keys(BTB.StoryData.CHOICES)[0], day: 8, S: (BTB.UI.g.mode && BTB.UI.g.mode.S) || {} }));
    await wait(400);
  });
  await closeModal(page);
  const ends = await page.evaluate(() => BTB.StoryEndings.list.map((e) => e.id));
  const pick = [ends[0], ends.find((x) => /depression|wiped/.test(x)) || ends[1], ends.find((x) => /fund|exit/.test(x)) || ends[2]];
  for (let i = 0; i < pick.length; i++) {
    await step(page, vp, 'ending-' + (i + 1), async () => {
      await page.evaluate((id) => {
        const base = BTB.StoryEndings.list.find((e) => e.id === id);
        const e = Object.assign({ wealth: 184322.17, story: ['The tape stopped at four.', 'Nobody on the floor said anything for a while.'], pull: 'It was never about the money.', epilogue: 'Personally: you kept the watch.' }, base);
        BTB.Screens.storyEnding(BTB.UI.g, e);
      }, pick[i]);
      await wait(500);
    });
  }
  await ctx.close();
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      try { await viewport(browser, vp); } catch (e) { console.log(`AUDIT-ERR ${vp.n} ${String(e.message || e).slice(0, 300)}`); }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`AUDIT-TOTAL ${bad}`);
  if (STRICT && bad) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
