// Rendered-frame, viewport and cinematic-flow QA.
// NODE_PATH=<runtime node_modules> node js/tests/browser-run.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const port = +(process.env.QA_PORT || 4178);
const prefix = process.env.EVIDENCE_PREFIX || 'after';
const captureOnly = process.argv.includes('--capture-only');
const evidence = path.join(process.env.EVIDENCE_DIR || path.join(root, 'qa', 'evidence'));
fs.mkdirSync(evidence, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };

(async () => {
  await wait(450);
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.click('#btn-boot');
  await page.evaluate(() => {
    BTB.Settings.set('sound', false); BTB.Settings.set('music', false); BTB.Settings.set('cinematics', 'full');
    BTB.Cinematic.startChain && BTB.Cinematic.startChain('qa');
    BTB.Cinematic.play('news', { day:60, brief:{title:'Orphan Monday',kicker:'IV · RECKONING',feed:[]} }, () => {});
  });
  await wait(200);
  await page.locator('#cine-canvas').screenshot({ path:path.join(evidence, `${prefix}-news-session-61.png`) });
  if (captureOnly) { await browser.close(); server.kill(); return; }

  const results = await page.evaluate(async () => {
    const out = {};
    const hashCanvas = (cv) => {
      const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      let h=2166136261; for(let i=0;i<d.length;i+=13){h^=d[i];h=Math.imul(h,16777619);} return (h>>>0).toString(16);
    };
    const render = (beat, opts) => {
      const cv=document.createElement('canvas'), v=beat.view;cv.width=v.w;cv.height=v.h;
      const c=cv.getContext('2d');beat.draw(c,v,1,opts||{});return hashCanvas(cv);
    };
    const newsHashes=[];
    for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+(day+1),feed:[]}};newsHashes.push(render(BTB.Scenes.news(o)[1],o));}
    out.newsUnique=new Set(newsHashes).size;
    const endingHashes=[];
    for(const id of BTB.Rhythm.endingIds){const o={id,title:id,deck:'ENDING '+id,dark:false};endingHashes.push(render(BTB.Scenes.ending(o)[1],o));}
    out.endingUnique=new Set(endingHashes).size;
    const weekendHashes=[];
    for(let day=4;day<60;day+=5){const o={day};weekendHashes.push(render(BTB.Scenes.weekend(o)[0],o));}
    out.weekendUnique=new Set(weekendHashes).size;
    const empty=BTB.Scenes.phone({day:4,brief:{feed:[]}}), one=BTB.Scenes.phone({day:4,brief:{feed:[{source:'WIRE',title:'ONE'}]}});
    out.emptyPhoneDiffers=render(empty[1],{})!==render(one[1],{});
    BTB.Cinematic.finish(); BTB.Cinematic.endChain();
    BTB.Cinematic.startChain('opts');
    BTB.Cinematic.play('close',{report:{pnl:12345,quotaMet:true,quota:2200,date:'QA'}},()=>{});
    out.closeOpts=BTB.Cinematic.optsOf().report;
    BTB.Cinematic.finish();BTB.Cinematic.endChain();
    BTB.Cinematic.startChain('opts');
    BTB.Cinematic.play('ending',{id:'fund',title:'The Fund',deck:'Deck',dark:true},()=>{});
    out.endingOpts=BTB.Cinematic.optsOf();
    BTB.Cinematic.finish();BTB.Cinematic.endChain();
    BTB.Settings.set('cinematics','short');
    BTB.Cinematic.startChain('short');BTB.Cinematic.play('news',{day:7,brief:{title:'Headline',feed:[]}},()=>{});
    out.shortInformative=BTB.Cinematic.beats.length===1&&!!BTB.Cinematic.beats[0].informative;
    BTB.Cinematic.finish();BTB.Cinematic.endChain();BTB.Settings.set('cinematics','full');
    let chainDone=false;
    BTB.Cinematic.startChain('skip');
    BTB.Cinematic.play('news',{day:1,brief:{title:'X',feed:[]}},()=>BTB.Cinematic.play('phone',{day:1,brief:{feed:[]}},()=>{chainDone=true;}));
    BTB.Cinematic.skipAll(); out.skipChain=chainDone; BTB.Cinematic.endChain();
    const start=performance.now();
    for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+day,feed:[]}};const beat=BTB.Scenes.news(o)[1];BTB.Cinematic.opts=o;BTB.Cinematic.cachedFrame(beat,beat.view);}
    out.cacheMs=performance.now()-start;out.cacheEntries=BTB.Cinematic.frameCache.size;
    return out;
  });
  assert(results.newsUnique >= 55, `only ${results.newsUnique} rendered news frames are distinct`);
  assert(results.endingUnique === 22, `only ${results.endingUnique} ending signatures`);
  assert(results.weekendUnique === 12, `only ${results.weekendUnique} weekend frames`);
  assert(results.emptyPhoneDiffers, 'empty feed is visually indistinguishable from a fabricated row');
  assert(results.closeOpts.pnl === 12345 && results.closeOpts.quota === 2200, 'closing options were dropped');
  assert(results.endingOpts.id === 'fund' && results.endingOpts.dark === true, 'ending options were dropped');
  assert(results.shortInformative, 'Short mode selected a blank hold');
  assert(results.skipChain, 'skip did not traverse the active chain');

  const viewports=[[1920,1080],[1440,900],[1280,720],[1280,800],[900,1000],[390,844]];
  const layouts=[];
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{BTB.Settings.set('cinematics','off');BTB.Screens.closeModal();document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.querySelector('#screen-menu').classList.add('active');});
    const menu=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    assert(menu.scroll<=width&&menu.body<=width,`menu overflows ${width}x${height}`);
    layouts.push({width,height,scrollWidth:menu.scroll});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{BTB.Settings.set('cinematics','off');BTB.Main.newStory();});
  await wait(120);
  const mobile=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,modal:document.querySelector('.modal')?.scrollWidth||0,viewport:innerWidth}));
  assert(mobile.scroll<=390&&mobile.modal<=390,'career briefing exceeds 390px');
  await page.screenshot({path:path.join(evidence,`${prefix}-mobile-390x844.png`),fullPage:false});
  fs.writeFileSync(path.join(evidence,`${prefix}-results.json`),JSON.stringify({results,layouts,mobile},null,2));
  console.log(JSON.stringify({results,layouts,mobile},null,2));
  await browser.close(); server.kill();
})().catch((error)=>{console.error(error.stack||error);server.kill();process.exit(1);});
