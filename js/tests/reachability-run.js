// Fast chronological ending reachability harness.
// It advances the real StoryMode through all 61 sessions, applies the shipped
// choice functions on their actual dates, and resolves through onDayEnd.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..');
const ctx = { console, Math, Date, JSON, Intl, performance: { now: () => Date.now() }, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {} };
ctx.window = ctx;
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
[
  'js/core/util.js','js/core/rng.js','js/core/events.js','js/core/storage.js','js/core/save.js','js/core/clock.js',
  'js/market/tickers.js','js/market/engine.js','js/market/news.js','js/market/sqwak.js','js/trading/options.js','js/trading/broker.js'
].forEach(load);
vm.runInContext(`
  const B=window.BTB;
  B.Settings={get:()=>({storyDayLength:180}),set:()=>{}};
  B.UI=new Proxy({}, {get:()=>()=>{}}); B.SFX=new Proxy({}, {get:()=>()=>{}}); B.Music=new Proxy({}, {get:()=>()=>{}});
`,ctx);
['js/modes/story/story-data.js','js/modes/story/patch3-data.js','js/modes/story/sqwak-story.js','js/modes/story/endings.js','js/modes/story/patch3-endings.js','js/modes/story/story-engine.js'].forEach(load);
const B=ctx.BTB, D=B.StoryData;
const ORDER=Object.keys(D.CHOICES).sort((a,b)=>D.CHOICES[a].day-D.CHOICES[b].day);
const clone=(o)=>JSON.parse(JSON.stringify(o));

function game(mode, arch, day) {
  const bearish = arch.bearish && (day === 25 || (day >= 41 && day <= 48));
  const px = {}; for (const t of B.TICKERS) px[t.sym] = { last:t.price || 100 };
  return {
    day, history:Array.from({length:day},(_,i)=>({day:i,quotaMet:true})), indexStart:512.4, inboxQueue:[], lock:null,
    market:{bySym:px},
    broker:{ cash:0, pos:{}, orders:[], opts:bearish?[{sym:'BSTN',type:'P',qty:4}]:[], equity:()=>arch.wealth,
      posQty:(sym)=>bearish && sym==='BSTN'?-Math.max(1,Math.round(arch.wealth*.14/px.BSTN.last)):0,
      marketOrder:()=>({ok:true}), fill:()=>({realized:0}) },
    setLock:()=>{}, stress:{spike:()=>{}}
  };
}
function report(day,arch){return {day,date:`Session ${day+1}`,pnl:0,equity:arch.wealth,start:arch.wealth,quota:0,quotaMet:true,earlyEnd:null};}

function advance(state, from, to, arch) {
  const mode=B.StoryMode({S:state});
  for(let day=from;day<=to;day++){
    const g=game(mode,arch,day);
    mode.onDayStart(g);
    const verdict=mode.onDayEnd(g,report(day,arch));
    if(verdict.ending) return {state:mode.S,ending:verdict.ending};
  }
  return {state:mode.S};
}
function walk(state,index,nextDay,arch,counts,witnesses){
  if(index>=ORDER.length){
    const end=advance(state,nextDay,60,arch);
    const es=end.state;
    audit.criminalHeat=Math.max(audit.criminalHeat,(es.f.fraud||es.f.insider||es.f.raid)&&!es.f.cooperated&&!es.f.fled?es.m.heat:-Infinity);
    audit.fallGuyHeat=Math.max(audit.fallGuyHeat,es.f.externalFraud&&!es.f.cooperated?es.m.heat:-Infinity);
    audit.fallGuyQuietHeat=Math.max(audit.fallGuyQuietHeat,es.f.externalFraud&&!es.f.cooperated&&!es.f.fled&&!es.f.treasury&&!es.f.public&&!es.f.pulledPlug&&!es.f.leftStack?es.m.heat:-Infinity);
    if(es.m.influence<22&&es.m.stability<=45) audit.cassandraIntegrity=Math.max(audit.cassandraIntegrity,es.m.integrity);
    if(es.f.bailout&&es.m.stability>=35&&es.m.stability<=50) audit.wardFirmMin=Math.min(audit.wardFirmMin,es.m.firm);
    if(es.f.bailout&&es.f.billPassed) { audit.rallyStabilityMin=Math.min(audit.rallyStabilityMin,es.m.stability); audit.rallyStabilityMax=Math.max(audit.rallyStabilityMax,es.m.stability); }
    audit.stabilityMin=Math.min(audit.stabilityMin,es.m.stability);
    if(!es.f.leftStack){
      audit.stabilityMinNoLeft=Math.min(audit.stabilityMinNoLeft,es.m.stability);
      if(es.f.bailout&&es.m.firm<40){audit.wardNoLeftMin=Math.min(audit.wardNoLeftMin,es.m.stability);audit.wardNoLeftMax=Math.max(audit.wardNoLeftMax,es.m.stability);}
      if(es.f.bailout&&es.f.billPassed){audit.rallyNoLeftMin=Math.min(audit.rallyNoLeftMin,es.m.stability);audit.rallyNoLeftMax=Math.max(audit.rallyNoLeftMax,es.m.stability);}
    }
    const rawCtx={S:es,wealth:arch.wealth,start:250000,reason:arch.reason||'final',days:61,quotaMet:arch.quotaMet};
    const e=end.ending || B.StoryEndings.resolve(rawCtx);
    for(const ending of B.StoryEndings.list) if(ending.test(rawCtx)) {
      audit.gates[ending.id]=(audit.gates[ending.id]||0)+1;
      if(ending.id!==e.id) { const key=ending.id+'>'+e.id; audit.collisions[key]=(audit.collisions[key]||0)+1; }
    }
    counts[e.id]=(counts[e.id]||0)+1;
    if(!witnesses[e.id]) witnesses[e.id]={archetype:arch.name,choices:clone(state.choices||{}),meters:clone(end.state.m),flags:Object.keys(end.state.f).filter(k=>end.state.f[k])};
    return;
  }
  const id=ORDER[index], choice=D.CHOICES[id], before=advance(state,nextDay,choice.day-1,arch);
  if(before.ending){counts[before.ending.id]=(counts[before.ending.id]||0)+1;return;}
  const base=before.state;
  if(choice.req && !choice.req(base,arch.wealth)) return walk(base,index+1,choice.day,arch,counts,witnesses);
  for(const opt of choice.options){
    if(opt.req && !opt.req(base,arch.wealth)) continue;
    const S=clone(base), mode=B.StoryMode({S}), g=game(mode,arch,choice.day);
    mode.onDayStart(g);
    if(choice.mid) mode.resolveMidChoice(g,id,opt.id,false); else { opt.apply(mode.S); mode.S.choices[id]=opt.id; }
    const verdict=mode.onDayEnd(g,report(choice.day,arch));
    if(verdict.ending){counts[verdict.ending.id]=(counts[verdict.ending.id]||0)+1;continue;}
    if(id==='c8') mode.S.f.billPassed=B.StoryMode.votePasses(mode.S);
    walk(mode.S,index+1,choice.day+1,arch,counts,witnesses);
  }
}

const archetypes=[];
for(const wealth of [180000,325000,550000,800000,1150000]) for(const anomalies of [6,12]) for(const bearish of [false,true]) {
  archetypes.push({name:`w${wealth/1000}k-a${anomalies}${bearish?'-bear':''}`,wealth,anomalies,bearish,quotaMet:bearish?20:42});
}
const counts={},witnesses={},audit={criminalHeat:-Infinity,fallGuyHeat:-Infinity,fallGuyQuietHeat:-Infinity,cassandraIntegrity:-Infinity,wardFirmMin:Infinity,rallyStabilityMin:Infinity,rallyStabilityMax:-Infinity,stabilityMin:Infinity,stabilityMinNoLeft:Infinity,wardNoLeftMin:Infinity,wardNoLeftMax:-Infinity,rallyNoLeftMin:Infinity,rallyNoLeftMax:-Infinity,gates:{},collisions:{}};
for(const arch of archetypes){const S=B.StoryMode.freshState(250000);S.anomalies=arch.anomalies;walk(S,0,0,arch,counts,witnesses);}
// Emergency endings are chronological engine outcomes too; exercise them through onDayEnd.
for(const reason of ['wiped','fired']){
  const mode=B.StoryMode(),g=game(mode,{wealth:reason==='wiped'?10000:250000},0);
  if(reason==='fired'){mode.S.quotaLedger=Array.from({length:B.StoryMode.QUOTA_STRIKE_LIMIT},(_,day)=>({day}));mode.S.quotaStrikes=mode.S.quotaLedger.length;}
  const verdict=mode.onDayEnd(g,{...report(0,{wealth:reason==='wiped'?10000:250000}),earlyEnd:reason==='wiped'?'wiped':null});
  counts[verdict.ending.id]=(counts[verdict.ending.id]||0)+1;witnesses[verdict.ending.id]=witnesses[verdict.ending.id]||{archetype:`engine-${reason}`};
}
const ordered={};for(const e of B.StoryEndings.list) ordered[e.id]=counts[e.id]||0;
console.log(JSON.stringify({paths:Object.values(counts).reduce((a,b)=>a+b,0),counts:ordered,missing:Object.keys(ordered).filter(id=>!ordered[id]),audit,witnesses},null,2));
process.exit(Object.values(ordered).every(Boolean)?0:1);
