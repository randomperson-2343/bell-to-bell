// Phone-layout QA. Runs in CI (GitHub Actions) with Playwright + Chromium.
//   npm install --no-save playwright@1.49.1 && npx playwright install --with-deps chromium
//   node js/tests/phone-run.js
// Env: QA_PORT (default 4179), PROJECT_ROOT, PHONE_OUT (default <root>/qa/phone)
// Exit code 1 if any check fails. Screenshots + results.json land in qa/phone/.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4179);
const out = process.env.PHONE_OUT || path.join(root, 'qa', 'phone');
fs.mkdirSync(out, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PORTRAIT = [[360, 740], [390, 844], [430, 932]];
const LANDSCAPE = [[844, 390], [740, 360], [932, 430]];
const TABS = ['trade', 'positions', 'news'];
const SCOPE = ['#screen-game', '#lock-overlay', '#modal-layer'];

let server = null;
let browser = null;

function startServer() {
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  server.on('error', (e) => console.error('server error', e.message));
}

function waitForServer(timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/index.html', timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - t0 > timeoutMs) reject(new Error('static server did not start'));
        else setTimeout(tryOnce, 200);
      });
      req.on('timeout', () => req.destroy());
    };
    tryOnce();
  });
}

// Helpers installed into the page as window.__qa.
function installHelpers() {
  const q = {};
  q.sel = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 3; i++, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; parts.unshift(s); break; }
      const cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  q.inView = (r) => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  q.fullyIn = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  q.visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility !== 'visible') return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || parseFloat(c.opacity) === 0) return false;
    }
    return q.inView(r);
  };
  // Displayed somewhere on the page, even if scrolled out of view (used to find the
  // modal's primary button, which on a short phone sits below the fold of the modal).
  q.shown = (el) => {
    if (!el || el.getClientRects().length === 0) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || parseFloat(c.opacity) === 0) return false;
    }
    return getComputedStyle(el).visibility === 'visible';
  };
  q.roots = (sels) => sels.map((s) => document.querySelector(s)).filter(Boolean);
  q.all = (sels, selector) => {
    const seen = new Set();
    const res = [];
    for (const r of q.roots(sels)) {
      for (const el of r.querySelectorAll(selector)) if (!seen.has(el)) { seen.add(el); res.push(el); }
    }
    return res;
  };
  q.tapTargets = (sels) => {
    const els = q.all(sels, 'button, input, select, [role="button"]');
    const bad = [];
    let n = 0;
    for (const el of els) {
      if (el.disabled || (el.type === 'hidden')) continue;
      // $TICKER links inside post text stay inline so the text keeps flowing; CSS pads
      // their tap area instead of making each line 44px tall.
      if (el.classList.contains('sq-tag')) continue;
      if (!q.visible(el)) continue;
      n++;
      const h = el.getBoundingClientRect().height;
      if (h < 43.5) bad.push(`${q.sel(el)} ${Math.round(el.getBoundingClientRect().width)}x${h.toFixed(1)}`);
    }
    return { n, bad };
  };
  q.fonts = (sels) => {
    const els = q.all(sels, '*');
    for (const r of q.roots(sels)) els.push(r);
    const bad = [];
    let n = 0;
    for (const el of els) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION|OPTGROUP|CANVAS)$/.test(el.tagName)) continue;
      let own = false;
      for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
      if (!own || !q.visible(el)) continue;
      n++;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      // font-size: 0 is a deliberate way to hide a text label (e.g. the stress gauge's
      // caption on portrait phones), not small text.
      if (fs === 0) continue;
      if (fs < 11) bad.push(`${q.sel(el)} ${fs}px "${(el.textContent || '').trim().slice(0, 18)}"`);
    }
    return { n, bad };
  };
  q.hit = (el) => {
    const r = el.getBoundingClientRect();
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!h && (h === el || el.contains(h));
  };
  window.__qa = q;
}

function newReport(name) {
  const rep = { name, checks: [], error: null };
  rep.add = (check, pass, detail) => {
    rep.checks.push({ check, pass: !!pass, detail: detail || '' });
  };
  rep.step = async (check, fn) => {
    try {
      const r = await fn();
      rep.add(check, r.pass, r.detail);
    } catch (e) {
      rep.add(check, false, 'exception: ' + String(e && e.message || e).split('\n')[0]);
    }
  };
  return rep;
}

const list = (arr) => arr.slice(0, 12).join('; ') + (arr.length > 12 ? `; +${arr.length - 12} more` : '');

async function boot(browser, ctxOpts, rep, shot) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#screen-menu.active', { timeout: 15000 });
  await page.evaluate(() => {
    BTB.Settings.set('sound', false);
    BTB.Settings.set('music', false);
    BTB.Settings.set('cinematics', 'off');
  });
  await page.evaluate(installHelpers);
  await page.evaluate(() => { BTB.Main.newStory(); });

  const t0 = Date.now();
  let shotBriefing = false;
  for (;;) {
    const running = await page.evaluate(() => !!(BTB.UI.g && BTB.UI.g.running));
    if (running) break;
    if (Date.now() - t0 > 20000) throw new Error('game did not start within 20s (stuck modal or cinematic)');
    const info = await page.evaluate(() => {
      const layer = document.getElementById('modal-layer');
      const btns = layer ? Array.from(layer.querySelectorAll('button')).filter((b) => !b.disabled && window.__qa.shown(b)) : [];
      const primary = btns.find((b) => b.classList.contains('primary')) || btns[btns.length - 1] || null;
      if (primary) { primary.setAttribute('data-qa-click', '1'); primary.scrollIntoView({ block: 'center' }); }
      return { n: btns.length };
    });
    if (info.n) {
      if (!shotBriefing) {
        shotBriefing = true;
        await wait(150);
        await shot('briefing');
        await rep.step('briefing modal: no sideways scroll', async () => {
          const r = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: innerWidth }));
          return { pass: r.d <= r.w && r.b <= r.w, detail: `doc ${r.d} body ${r.b} vw ${r.w}` };
        });
        // Only the modal itself: the game screen behind it is checked once it is in front.
        // The 44px and 11px rules are phone rules, so the desktop run skips them.
        if (ctxOpts.isMobile) {
          await rep.step('briefing modal: tap targets >= 44px', async () => {
            const r = await page.evaluate(() => window.__qa.tapTargets(['#modal-layer']));
            return { pass: r.bad.length === 0, detail: r.bad.length ? list(r.bad) : `${r.n} checked` };
          });
          await rep.step('briefing modal: text >= 11px', async () => {
            const r = await page.evaluate(() => window.__qa.fonts(['#modal-layer']));
            return { pass: r.bad.length === 0, detail: r.bad.length ? list(r.bad) : `${r.n} checked` };
          });
        }
      }
      try {
        await page.locator('[data-qa-click="1"]').first().click({ timeout: 2500 });
      } catch (e) {
        await page.evaluate(() => { const b = document.querySelector('[data-qa-click="1"]'); if (b) b.click(); });
      }
      await page.evaluate(() => document.querySelectorAll('[data-qa-click]').forEach((b) => b.removeAttribute('data-qa-click')));
    }
    await wait(250);
  }
  return { context, page, pageErrors };
}

async function freezeAndSeed(page) {
  // The loop adds dt * rate * speed to the accumulator. `rate` is a getter, so
  // speed = 0 stops all ticks while running stays true and paused stays false.
  // (paused = true would make g.trade/g.closePos reject with "Game is paused".)
  await page.evaluate(() => { BTB.UI.g.speed = 0; });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { if (document.querySelector('#modal-layer .modal')) { const b = document.querySelector('#modal-layer .btn.primary, #modal-layer button'); if (b) b.click(); } });
    await wait(150);
  }
  const seeded = await page.evaluate(() => {
    const g = BTB.UI.g;
    g.speed = 0;
    for (const tk of g.market.tickers.slice(0, 6)) {
      const res = g.trade(tk.sym, 1);
      if (res && res.ok && Object.keys(g.broker.pos).length) return { ok: true, sym: Object.keys(g.broker.pos)[0] };
    }
    return { ok: false, sym: null };
  });
  await page.evaluate(() => { BTB.UI.clearNotes && BTB.UI.clearNotes(); });
  return seeded;
}

async function clickTab(page, tab) {
  try {
    await page.locator(`#phone-tabs [data-ptab="${tab}"]`).click({ timeout: 3000 });
  } catch (e) {
    await page.evaluate((t) => { const b = document.querySelector(`#phone-tabs [data-ptab="${t}"]`); if (b) b.click(); }, tab);
  }
  await wait(250);
  await page.evaluate(() => { BTB.UI.clearNotes && BTB.UI.clearNotes(); });
}

async function phoneViewport(browser, w, h, orient) {
  const name = `${w}x${h}`;
  const rep = newReport(`${name} ${orient}`);
  const shot = async (suffix) => { try { await page.screenshot({ path: path.join(out, `${name}-${suffix}.png`) }); } catch (e) { /* ignore */ } };
  let page = null, context = null, pageErrors = [];
  try {
    const b = await boot(browser, { viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, rep, shot);
    page = b.page; context = b.context; pageErrors = b.pageErrors;
    const seeded = await freezeAndSeed(page);
    rep.add('setup: market frozen and position opened', seeded.ok, seeded.ok ? seeded.sym : 'g.trade() never returned ok');

    for (const tab of TABS) {
      await clickTab(page, tab);
      await shot(tab);
      const L = `${tab}:`;
      await rep.step(`${L} no sideways page scroll`, async () => {
        const r = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: innerWidth }));
        return { pass: r.d <= r.w && r.b <= r.w, detail: `doc ${r.d} body ${r.b} vw ${r.w}` };
      });
      await rep.step(`${L} tap targets >= 44px`, async () => {
        const r = await page.evaluate((s) => window.__qa.tapTargets(s), SCOPE);
        return { pass: r.bad.length === 0, detail: r.bad.length ? list(r.bad) : `${r.n} checked` };
      });
      await rep.step(`${L} text >= 11px`, async () => {
        const r = await page.evaluate((s) => window.__qa.fonts(s), SCOPE);
        return { pass: r.bad.length === 0, detail: r.bad.length ? list(r.bad) : `${r.n} checked` };
      });
      if (tab === 'trade') {
        await rep.step(`${L} BUY and SELL fully on screen and hit-testable`, async () => {
          const r = await page.evaluate(() => {
            const q = window.__qa, res = [];
            for (const id of ['tk-buy', 'tk-sell']) {
              const el = document.getElementById(id);
              if (!el) { res.push(`#${id} missing`); continue; }
              const rc = el.getBoundingClientRect();
              if (!q.fullyIn(rc)) res.push(`#${id} outside viewport (${Math.round(rc.left)},${Math.round(rc.top)} ${Math.round(rc.right)},${Math.round(rc.bottom)} vs ${innerWidth}x${innerHeight})`);
              else if (!q.hit(el)) res.push(`#${id} covered at centre`);
            }
            return res;
          });
          return { pass: r.length === 0, detail: r.join('; ') };
        });
        await rep.step(`${L} chart height >= 100px`, async () => {
          const hh = await page.evaluate(() => { const c = document.getElementById('chart'); return c ? c.getBoundingClientRect().height : -1; });
          return { pass: hh >= 100, detail: `${hh.toFixed(1)}px` };
        });
      } else if (tab === 'positions') {
        await rep.step(`${L} #bt-content visible with a close button`, async () => {
          const r = await page.evaluate(() => {
            const q = window.__qa, c = document.getElementById('bt-content');
            const btns = c ? Array.from(c.querySelectorAll('button[data-act="close"]')).filter((b) => q.visible(b)) : [];
            return { vis: q.visible(c), n: btns.length };
          });
          return { pass: r.vis && r.n >= 1, detail: `visible=${r.vis} closeButtons=${r.n}` };
        });
      } else {
        await rep.step(`${L} #feed-list visible`, async () => {
          const v = await page.evaluate(() => window.__qa.visible(document.getElementById('feed-list')));
          return { pass: v, detail: String(v) };
        });
      }
    }

    // Incoming call, on the trade tab.
    await clickTab(page, 'trade');
    await page.evaluate(() => { BTB.UI.phoneRing({ from: 'QA Caller', role: 'Test call', kind: 'tip' }); });
    await wait(250);
    await shot('call-ring');
    await rep.step('call-ring: #phone visible, on screen, Answer hit-testable', async () => {
      const r = await page.evaluate(() => {
        const q = window.__qa, p = document.getElementById('phone');
        const a = p && p.querySelector('[data-ph="answer"]');
        const res = [];
        if (!p || !q.visible(p)) res.push('#phone not visible');
        else if (!q.fullyIn(p.getBoundingClientRect())) { const rc = p.getBoundingClientRect(); res.push(`#phone outside viewport (${Math.round(rc.left)},${Math.round(rc.top)} ${Math.round(rc.right)},${Math.round(rc.bottom)})`); }
        if (!a) res.push('Answer button missing');
        else if (!q.fullyIn(a.getBoundingClientRect())) res.push('Answer button outside viewport');
        else if (!q.hit(a)) res.push('Answer button covered at centre');
        return res;
      });
      return { pass: r.length === 0, detail: r.join('; ') };
    });
    await rep.step('call-ring: tap targets >= 44px', async () => {
      const r = await page.evaluate(() => window.__qa.tapTargets(['#phone']));
      return { pass: r.bad.length === 0, detail: r.bad.length ? list(r.bad) : `${r.n} checked` };
    });
    await rep.step('call-ring: no #ring-pill in phone layout', async () => {
      const v = await page.evaluate(() => { const p = document.getElementById('ring-pill'); return !!p && window.__qa.visible(p); });
      return { pass: !v, detail: v ? 'ring pill is visible' : '' };
    });
    await page.evaluate(() => {
      BTB.UI.phoneOpen({ from: 'QA Caller', role: '', kind: 'choice', text: 'Two options, pick one.', options: [{ id: 'a', label: 'Take the order' }, { id: 'b', label: 'Pass on it' }] });
    });
    await wait(250);
    await shot('call-open');
    await rep.step('call-open: option buttons on screen', async () => {
      const r = await page.evaluate(() => {
        const q = window.__qa, res = [];
        const opts = Array.from(document.querySelectorAll('#phone [data-opt]'));
        if (opts.length < 2) res.push(`only ${opts.length} option buttons`);
        for (const o of opts) {
          if (!q.fullyIn(o.getBoundingClientRect())) res.push(`${o.textContent.trim()} outside viewport`);
          else if (!q.hit(o)) res.push(`${o.textContent.trim()} covered at centre`);
        }
        return res;
      });
      return { pass: r.length === 0, detail: r.join('; ') };
    });
    await rep.step('call-open: tap targets >= 44px, text >= 11px', async () => {
      const r = await page.evaluate(() => ({ t: window.__qa.tapTargets(['#phone']), f: window.__qa.fonts(['#phone']) }));
      const bad = r.t.bad.concat(r.f.bad);
      return { pass: bad.length === 0, detail: bad.length ? list(bad) : 'ok' };
    });
    await page.evaluate(() => { BTB.UI.phoneHide(); });

    // Panic overlay.
    await page.evaluate(() => { BTB.UI.lock({ kind: 'panic', seq: ['a', 's', 'd'], step: 0 }); });
    await wait(250);
    await shot('panic');
    await rep.step('panic: 3 buttons reachable, no sideways overflow', async () => {
      const r = await page.evaluate(() => {
        const o = document.getElementById('lock-overlay');
        const btns = Array.from(document.querySelectorAll('#panic-seq button'));
        const cs = getComputedStyle(o);
        const scrollable = o.scrollHeight > o.clientHeight && /(auto|scroll)/.test(cs.overflowY);
        const res = [];
        if (btns.length !== 3) res.push(`${btns.length} panic buttons`);
        if (o.scrollWidth > o.clientWidth) res.push(`overlay scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth}`);
        btns.forEach((b, i) => {
          const rc = b.getBoundingClientRect();
          if (rc.left < -0.5 || rc.right > innerWidth + 0.5) res.push(`button ${i + 1} outside horizontally (${Math.round(rc.left)}..${Math.round(rc.right)} of ${innerWidth})`);
          if ((rc.top < -0.5 || rc.bottom > innerHeight + 0.5) && !scrollable) res.push(`button ${i + 1} outside vertically and overlay not scrollable`);
        });
        return res;
      });
      return { pass: r.length === 0, detail: r.join('; ') };
    });
    await rep.step('panic: tap targets >= 44px, text >= 11px', async () => {
      const r = await page.evaluate(() => ({ t: window.__qa.tapTargets(['#lock-overlay']), f: window.__qa.fonts(['#lock-overlay']) }));
      const bad = r.t.bad.concat(r.f.bad);
      return { pass: bad.length === 0, detail: bad.length ? list(bad) : 'ok' };
    });
    await page.evaluate(() => { BTB.UI.unlock(); });

    if (w === 390 && h === 844) await tapVsScroll(page, context, rep);

    if (pageErrors.length) rep.add('no uncaught page errors', false, list(pageErrors));
    else rep.add('no uncaught page errors', true, '');
  } catch (e) {
    rep.error = String(e && e.stack || e).split('\n').slice(0, 4).join(' | ');
    rep.add('viewport run completed', false, rep.error);
  } finally {
    try { if (context) await context.close(); } catch (e) { /* ignore */ }
  }
  return rep;
}

async function tapVsScroll(page, context, rep) {
  await clickTab(page, 'positions');
  await page.evaluate(() => {
    const t = document.querySelector('.bt-tabs [data-bt="positions"]');
    if (t && !t.classList.contains('on')) t.click();
  });
  await wait(300);
  const closeInfo = () => page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#bt-content button[data-act="close"]')).find((x) => window.__qa.visible(x));
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    const tr = b.closest('tr');
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: tr ? tr.dataset.sym : null };
  });
  const isOpen = (sym) => page.evaluate((s) => !!BTB.UI.g.broker.pos[s], sym);
  const first = await closeInfo();
  if (!first || !first.sym) {
    rep.add('touch: scroll gesture on Close leaves position open', false, 'no close button found');
    rep.add('touch: tap on Close closes the position', false, 'no close button found');
    return;
  }
  const sym = first.sym;
  await rep.step('touch: scroll gesture on Close leaves position open', async () => {
    const cdp = await context.newCDPSession(page);
    const p = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p(first.x, first.y) });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: p(first.x, first.y - i * 10) });
      await wait(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(300);
    const open = await isOpen(sym);
    try { await cdp.detach(); } catch (e) { /* ignore */ }
    return { pass: open, detail: open ? `${sym} still open` : `${sym} was closed by a scroll gesture` };
  });
  await rep.step('touch: tap on Close closes the position', async () => {
    if (!(await isOpen(sym))) return { pass: false, detail: 'position already closed, cannot test tap' };
    const again = await closeInfo();
    if (!again) return { pass: false, detail: 'close button vanished' };
    await page.touchscreen.tap(again.x, again.y);
    await wait(400);
    const open = await isOpen(sym);
    return { pass: !open, detail: open ? `${sym} still open after tap` : 'closed' };
  });
}

async function desktopViewport(browser) {
  const rep = newReport('desktop 1280x720');
  let context = null, page = null;
  try {
    const shot = async (suffix) => { try { await page.screenshot({ path: path.join(out, `desktop-1280x720.png`) }); } catch (e) { /* ignore */ } };
    const b = await boot(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, rep, async () => {});
    page = b.page; context = b.context;
    const seeded = await freezeAndSeed(page);
    rep.add('setup: market frozen and position opened', seeded.ok, seeded.ok ? seeded.sym : 'g.trade() never returned ok');
    await wait(250);
    await shot();
    await rep.step('#phone-tabs is display none', async () => {
      const d = await page.evaluate(() => { const e = document.getElementById('phone-tabs'); return e ? getComputedStyle(e).display : 'missing'; });
      return { pass: d === 'none', detail: `display=${d}` };
    });
    await rep.step('#mon-right is visible', async () => {
      const v = await page.evaluate(() => window.__qa.visible(document.getElementById('mon-right')));
      return { pass: v, detail: String(v) };
    });
    await rep.step('no sideways page scroll', async () => {
      const r = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: innerWidth }));
      return { pass: r.d <= r.w && r.b <= r.w, detail: `doc ${r.d} body ${r.b} vw ${r.w}` };
    });
    if (b.pageErrors.length) rep.add('no uncaught page errors', false, list(b.pageErrors));
  } catch (e) {
    rep.error = String(e && e.stack || e).split('\n').slice(0, 4).join(' | ');
    rep.add('viewport run completed', false, rep.error);
  } finally {
    try { if (context) await context.close(); } catch (e) { /* ignore */ }
  }
  return rep;
}

(async () => {
  const reports = [];
  let failed = 0, fatal = 0;
  try {
    startServer();
    await waitForServer(15000);
    browser = await chromium.launch({ headless: true });
    for (const [w, h] of PORTRAIT) reports.push(await phoneViewport(browser, w, h, 'portrait'));
    for (const [w, h] of LANDSCAPE) reports.push(await phoneViewport(browser, w, h, 'landscape'));
    reports.push(await desktopViewport(browser));
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    failed++; fatal++;
  } finally {
    try { if (browser) await browser.close(); } catch (e) { /* ignore */ }
    try { if (server) server.kill(); } catch (e) { /* ignore */ }
  }

  const json = reports.map((r) => ({ viewport: r.name, error: r.error, checks: r.checks }));
  try { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(json, null, 2)); } catch (e) { console.error('could not write results.json', e.message); }

  let total = 0;
  for (const r of reports) {
    console.log(`\n== ${r.name} ==`);
    for (const c of r.checks) {
      total++;
      if (!c.pass) failed++;
      console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.check}${c.detail ? '  [' + c.detail + ']' : ''}`);
    }
  }
  console.log(`\n${total - (failed - fatal)} of ${total} checks passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
