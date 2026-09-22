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
['js/core/util.js','js/core/rng.js','js/core/clock.js','js/art/palette.js','js/art/pixel.js','js/art/scenes.js','js/art/rhythm.js'].forEach(load);
const B=ctx.BTB;
function render(beat,opts){const v=beat.view||B.Scenes.V,cv=createCanvas(v.w,v.h),c=cv.getContext('2d');c.imageSmoothingEnabled=false;beat.draw(c,v,1,opts||{});return cv;}
function digest(cv){const c=cv.getContext('2d'),d=c.getImageData(0,0,cv.width,cv.height).data;return crypto.createHash('sha256').update(Buffer.from(d)).digest('hex').slice(0,20);}
const sample={day:60,brief:{title:'Orphan Monday',kicker:'IV · RECKONING',feed:[]}};
const sampleCanvas=render(B.Scenes.news(sample)[1],sample);
fs.writeFileSync(path.join(evidence,`${prefix}-news-session-61.png`),sampleCanvas.toBuffer('image/png'));
if(captureOnly){console.log(JSON.stringify({prefix,width:sampleCanvas.width,height:sampleCanvas.height,hash:digest(sampleCanvas)}));process.exit(0);}
const news=[];for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+(day+1),feed:[]}};news.push(digest(render(B.Scenes.news(o)[1],o)));}
const endings=[];for(const id of B.Rhythm.endingIds){const o={id,title:id,deck:'ENDING '+id,dark:false};endings.push(digest(render(B.Scenes.ending(o)[1],o)));}
const weekends=[];for(let day=4;day<60;day+=5){const o={day};weekends.push(digest(render(B.Scenes.weekend(o)[0],o)));}
const start=performance.now();for(let day=0;day<61;day++){const o={day,brief:{title:'SESSION '+day,feed:[]}};render(B.Scenes.news(o)[1],o);}const renderMs=performance.now()-start;
const result={resolution:[sampleCanvas.width,sampleCanvas.height],sampleHash:digest(sampleCanvas),newsUnique:new Set(news).size,endingUnique:new Set(endings).size,weekendUnique:new Set(weekends).size,emptyPhoneRows:B.Rhythm.phoneRowCount([]),onePhoneRows:B.Rhythm.phoneRowCount([{}]),fullPhoneRows:B.Rhythm.phoneRowCount([1,2,3,4,5]),render61Ms:+renderMs.toFixed(1)};
fs.writeFileSync(path.join(evidence,`${prefix}-render-results.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.resolution.join('x')!=='640x360'||result.newsUnique<55||result.endingUnique!==22||result.weekendUnique!==12||result.emptyPhoneRows!==0||result.onePhoneRows!==1||result.fullPhoneRows!==4)process.exit(1);
