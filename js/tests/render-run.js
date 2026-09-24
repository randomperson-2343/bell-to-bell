// Native canvas snapshot and perceptual-regression harness.
// NODE_PATH=<runtime node_modules> node js/tests/render-run.js
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const {createCanvas}=require('@napi-rs/canvas');
const root=process.env.PROJECT_ROOT||path.join(__dirname,'..','..');
const evidence=process.env.EVIDENCE_DIR||path.join(root,'qa','evidence');
const prefix=process.env.EVIDENCE_PREFIX||'after';
const captureOnly=process.argv.includes('--capture-only');
fs.mkdirSync(evidence,{recursive:true});
const ctx={console,Math,Date,JSON,Intl,performance};ctx.window=ctx;vm.createContext(ctx);
const load=(f)=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
['js/core/util.js','js/core/rng.js','js/core/clock.js','js/art/palette.js','js/art/pixel.js','js/art/portraits.js','js/art/scenes.js','js/art/rhythm.js','js/art/storyboard.js','js/art/decisions.js'].forEach(load);
const B=ctx.BTB;
function render(beat,opts){const v=beat.view||B.Scenes.V,cv=createCanvas(v.w,v.h),c=cv.getContext('2d');c.imageSmoothingEnabled=false;beat.draw(c,v,1,opts||{});return cv;}
function digest(cv){const c=cv.getContext('2d'),d=c.getImageData(0,0,cv.width,cv.height).data;return crypto.createHash('sha256').update(Buffer.from(d)).digest('hex').slice(0,20);}
const titleBeat=(o)=>{const bs=B.Scenes.news(o);return bs.find((b)=>b.informative)||bs[bs.length-1];};
const sample={day:60,brief:{title:'Orphan Monday',kicker:'IV · RECKONING',feed:[]}};
const sampleCanvas=render(titleBeat(sample),sample);
fs.writeFileSync(path.join(evidence,`${prefix}-news-session-61.png`),sampleCanvas.toBuffer('image/png'));
if(captureOnly){console.log(JSON.stringify({prefix,width:sampleCanvas.width,height:sampleCanvas.height,hash:digest(sampleCanvas)}));process.exit(0);}
const news=[];for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+(day+1),feed:[]}};news.push(digest(render(titleBeat(o),o)));}
const endings=[];for(const id of B.Rhythm.endingIds){const o={id,title:id,deck:'ENDING '+id,dark:false};endings.push(digest(render(B.Scenes.ending(o)[1],o)));}
const weekends=[];for(let day=4;day<60;day+=5){const o={day};weekends.push(digest(render(B.Scenes.weekend(o)[0],o)));}
// Opening shots, picture only (letterbox and caption box excluded): two frames
// count as the same shot unless at least 10% of 8x8 cells visibly differ.
function cells(cv){const d=cv.getContext('2d').getImageData(0,12,640,264).data,o=[];for(let cy=0;cy<33;cy++)for(let cx=0;cx<80;cx++){let r=0,g=0,b=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=((cy*8+y)*640+cx*8+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2];}o.push([r/64,g/64,b/64]);}return o;}
function differ(a,b){let n=0;for(let i=0;i<a.length;i++)if(Math.max(Math.abs(a[i][0]-b[i][0]),Math.abs(a[i][1]-b[i][1]),Math.abs(a[i][2]-b[i][2]))>24)n++;return n/a.length;}
const groups=[];for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+(day+1),feed:[]}};const e=B.Scenes.news(o).find((b)=>/establish/.test(b.id));const f=cells(render(e,o));const g=groups.find((g)=>differ(g,f)<0.10);if(!g)groups.push(f);}
const start=performance.now();for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+day,feed:[]}};render(titleBeat(o),o);}const renderMs=performance.now()-start;
const result={resolution:[sampleCanvas.width,sampleCanvas.height],sampleHash:digest(sampleCanvas),newsUnique:new Set(news).size,endingUnique:new Set(endings).size,weekendUnique:new Set(weekends).size,establishGroups:groups.length,emptyPhoneRows:B.Rhythm.phoneRowCount([]),onePhoneRows:B.Rhythm.phoneRowCount([{}]),fullPhoneRows:B.Rhythm.phoneRowCount([1,2,3,4,5]),render61Ms:+renderMs.toFixed(1)};
fs.writeFileSync(path.join(evidence,`${prefix}-render-results.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.resolution.join('x')!=='640x360'||result.newsUnique<55||result.establishGroups<50||result.endingUnique!==22||result.weekendUnique!==12||result.emptyPhoneRows!==0||result.onePhoneRows!==1||result.fullPhoneRows!==4)process.exit(1);
