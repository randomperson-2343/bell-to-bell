// V4.1 authored 640x360 storyboard layer. The story remains in StoryData;
// this file owns only composition, timing and visual treatment.
(function (B) {
  'use strict';
  const X = B.Pixel, P = B.Pal;
  const V = { w: 640, h: 360 };
  const PLACES = ['apartment','subway','lobby','kitchen','street','rideshare','elevator','platform','breakroom','desk'];
  const CAMERAS = ['wide','profile','over-shoulder','insert','close','desk'];
  const ENDING_IDS = ['wiped','fired','exit','nobody','master','whistle','revolving','perp','fall-guy','cassandra','acquirer','ward','clawback','right-early','fund','everything-rally','lost-decade','soft','quiet','replaced','depression','grind'];

  function hash(s) { return B.hashSeed(String(s || '')); }
  // Which way the market went on a session, from the authored scenario: the
  // charts follow the tape, not the act. Pre-open frames show yesterday.
  function marketDown(day) {
    const D = B.StoryData;
    if (!D || !D.DAYS || day < 0 || !D.DAYS[day]) return false;
    try {
      const g = B.UI && B.UI.g;
      const S = g && g.mode && g.mode.S ? g.mode.S : (B.StoryMode && B.StoryMode.freshState ? B.StoryMode.freshState(250000) : { m: {}, rel: {}, f: {}, choices: {} });
      const m = D.DAYS[day].scen(S).market || {};
      return (m.target || 0) < 0;
    } catch (e) { return false; }
  }
  function clean(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
  function board(day) {
    const d = Math.max(0, day | 0), act = d < 15 ? 1 : d < 30 ? 2 : d < 45 ? 3 : 4;
    const place = PLACES[d % PLACES.length], camera = CAMERAS[(Math.floor(d / 5) + d) % CAMERAS.length];
    const crop = { wide: 0, profile: -42, 'over-shoulder': 36, insert: -88, close: 74, desk: 18 }[camera];
    return { day: d, week: Math.floor(d / 5) + 1, act, place, camera, crop,
      signature: `${d + 1}:${place}:${camera}:${crop}` };
  }
  const STORYBOARDS = Array.from({ length: 61 }, (_, day) => board(day));

  function colors(act) {
    return act === 4 ? { wash:P.crimsonD, signal:P.crimson, sky:P.ink2 }
      : act === 3 ? { wash:P.sky, signal:P.crimson, sky:P.screenD }
      : act === 2 ? { wash:P.violet, signal:P.sky, sky:P.ink2 }
      : { wash:P.amberD, signal:P.amber, sky:P.ink2 };
  }
  function text(ctx, value, x, y, color, align) {
    X.textShadow(ctx, clean(value).slice(0, 80), x, y, color || P.bone, P.ink, { align: align || 'left' });
  }
  function skyline(ctx, act, seed, y) {
    const c = colors(act); y = y || 248;
    X.gradient(ctx, 0, 0, V.w, y, c.sky, P.ink, 12);
    for (let i = 0; i < 34; i++) {
      const w = 10 + ((i * 17 + seed * 3) % 22), h = 34 + ((i * 41 + seed * 11) % 128), x = i * 20 - 9;
      X.rect(ctx, x, y - h, w, h, i % 4 ? P.ink2 : P.slate);
      for (let yy = 7; yy < h - 5; yy += 10) for (let xx = 4; xx < w - 3; xx += 8) {
        if ((i * 13 + xx + yy + seed) % 11 < 2) X.rect(ctx, x + xx, y - h + yy, 2, 2, c.wash);
      }
    }
  }
  function person(ctx, x, y, scale, act, face) {
    const s = scale || 1, dir = face < 0 ? -1 : 1;
    X.rect(ctx, x - 11*s, y, 22*s, 45*s, P.ink2);
    X.rect(ctx, x - 7*s, y - 15*s, 14*s, 17*s, act > 2 ? P.deskD : P.desk2);
    X.rect(ctx, x - 8*s, y - 18*s, 16*s, 5*s, P.ink);
    X.rect(ctx, x + dir*5*s, y - 8*s, 2*s, 2*s, P.ink);
  }
  function monitor(ctx, x, y, w, h, headline, act) {
    const c = colors(act);
    X.plate(ctx, x-5, y-5, w+10, h+10, P.plastic, P.plastic2, P.plasticD);
    X.crt(ctx, x, y, w, h, true);
    X.rect(ctx, x+3, y+h-48, w-6, 45, c.signal);
    text(ctx, 'OVERNIGHT WIRE', x+10, y+h-42, P.bone);
    X.wrap(clean(headline), w-24).slice(0,3).forEach((line,i) => text(ctx, line, x+10, y+h-29+i*10, P.ink));
  }
  function chart(ctx, x, y, w, h, seed, down) {
    X.crt(ctx, x, y, w, h, true);
    let py = y + h/2;
    for (let i = 0; i < w-12; i += 5) {
      py = B.clamp(py + (((i*19+seed)%13)-6) * .7 + (down ? .5 : -.25), y+10, y+h-18);
      X.rect(ctx, x+6+i, py, 3, 2, down ? P.crimson : P.jade);
    }
  }

  function placeFrame(ctx, sb, headline, detail) {
    const c = colors(sb.act), shift = sb.crop;
    X.rect(ctx, 0, 0, V.w, V.h, P.ink);
    skyline(ctx, sb.act, sb.day, 252);
    X.rect(ctx, 0, 252, V.w, 108, sb.place === 'street' || sb.place === 'platform' ? P.ink2 : P.carpetD);
    if (sb.place === 'subway' || sb.place === 'platform') {
      X.rect(ctx, 0, 26, V.w, 226, P.plasticD);
      for (let i=0;i<7;i++) X.inset(ctx, 18+i*94, 52, 76, 92, P.screenD, P.plastic2, P.plasticD);
      X.rect(ctx, 0, 252, V.w, 108, P.carpetD);
    } else if (sb.place === 'lobby' || sb.place === 'elevator') {
      X.gradient(ctx, 0, 0, V.w, 278, P.putty2, P.plasticD, 10);
      for (let i=0;i<10;i++) X.rect(ctx, i*68, 0, 2, 278, P.plastic);
      X.rect(ctx, 0, 278, V.w, 82, P.slate);
    } else if (sb.place === 'kitchen' || sb.place === 'breakroom') {
      X.gradient(ctx, 0, 0, V.w, 255, P.putty2, P.putty, 9);
      X.rect(ctx, 0, 255, V.w, 105, P.desk);
      for (let i=0;i<9;i++) X.plate(ctx, 12+i*72, 52, 62, 52, P.plastic, P.plastic2, P.plasticD);
    } else if (sb.place === 'desk') {
      X.gradient(ctx, 0, 0, V.w, 226, P.putty2, P.putty, 9);
      X.rect(ctx, 0, 226, V.w, 134, P.desk);
      chart(ctx, 374+shift/3, 66, 198, 130, sb.day, marketDown(sb.day - 1));
    } else if (sb.place === 'rideshare') {
      X.rect(ctx, 0, 0, V.w, 360, P.ink2); skyline(ctx, sb.act, sb.day, 210);
      X.rect(ctx, 0, 214, V.w, 146, P.ink);
      person(ctx, 74, 250, 2, sb.act, 1); person(ctx, 574, 250, 2, sb.act, -1);
    }
    const mx = B.clamp(70 + shift, 24, 330), my = detail ? 56 : 76, mw = detail ? 300 : 250, mh = detail ? 170 : 142;
    monitor(ctx, mx, my, mw, mh, headline, sb.act);
    if (!detail) person(ctx, B.clamp(470-shift/2,380,560), 244, 2, sb.act, -1);
    // Observable composition markers: framing and subject position vary by camera.
    if (sb.camera === 'insert') X.plate(ctx, 468, 86, 116, 82, P.bone, P.white, P.plasticD);
    if (sb.camera === 'over-shoulder') { person(ctx, 576, 234, 3, sb.act, -1); X.rect(ctx, 516, 278, 124, 82, P.ink2); }
    if (sb.camera === 'close') { person(ctx, 516, 205, 4, sb.act, -1); }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, .08);
  }

  function phone(ctx, x, y, w, h, feed, act, day) {
    const c = colors(act), rows = (feed || []).slice(0, 4), compact = rows.length <= 2;
    // Glow is behind the device and never becomes an opaque slab.
    ctx.save(); ctx.globalAlpha = .12 + act*.025; X.rect(ctx, x-8, y-8, w+16, h+16, c.signal); ctx.restore();
    X.plate(ctx, x, y, w, h, P.ink2, P.slate2, P.ink);
    const sx=x+8, sy=y+12, sw=w-16, sh=h-24;
    X.rect(ctx, sx, sy, sw, sh, P.screen);
    X.rect(ctx, x+w/2-18, y+4, 36, 4, P.ink);
    const minute = String(31 + ((day || 0) % 24)).padStart(2,'0');
    text(ctx, `6:${minute}`, sx+7, sy+6, P.grey2);
    text(ctx, `${rows.length}`, sx+sw-8, sy+6, c.wash, 'right');
    ctx.save();
    ctx.beginPath(); ctx.rect(sx+2, sy+21, sw-4, sh-24); ctx.clip();
    const rowH = compact ? 52 : 39;
    rows.forEach((item,i) => {
      const yy=sy+25+i*(rowH+5);
      X.rect(ctx, sx+5, yy, sw-10, rowH, i===0 ? P.screenGlow : P.screenD);
      X.rect(ctx, sx+5, yy, 3, rowH, item.kind==='chirp'?P.violet:item.kind==='mail'?P.amber:P.sky);
      text(ctx, clean(item.source || 'WIRE').slice(0,18), sx+14, yy+6, c.wash);
      X.wrap(clean(item.title || ''), sw-34).slice(0, compact?3:2).forEach((line,k) => text(ctx,line,sx+14,yy+19+k*10,P.bone));
    });
    ctx.restore();
    return rows.length;
  }

  function phoneFrame(ctx, sb, feed, close) {
    X.rect(ctx,0,0,V.w,V.h,P.ink); X.gradient(ctx,0,0,V.w,V.h,P.ink2,P.ink,10);
    const count=(feed||[]).slice(0,4).length;
    const w = close || count>2 ? 226 : 180, h = close || count>2 ? 308 : 250;
    const x=(V.w-w)/2, y=18;
    phone(ctx,x,y,w,h,feed,sb.act,sb.day);
    text(ctx,'SQWAK · PRE-OPEN', close?92:88, 92, colors(sb.act).wash);
    text(ctx,`${count} NOTIFICATION${count===1?'':'S'}`,close?92:88,110,P.bone);
  }

  function officeFrame(ctx, day, detail, down) {
    const sb=board(day), c=colors(sb.act);
    if (down == null) down = marketDown(day - 1);
    X.rect(ctx,0,0,V.w,V.h,P.putty); X.gradient(ctx,0,0,V.w,235,P.putty2,P.putty,10); X.rect(ctx,0,235,V.w,125,P.desk);
    for(let i=0;i<5;i++){const x=24+i*124;X.plate(ctx,x,78,104,126,P.plastic,P.plastic2,P.plasticD);chart(ctx,x+10,92,84,78,day+i,down);}
    X.plate(ctx,196,250,248,40,P.plasticD,P.plastic2,P.ink2);
    for(let i=0;i<12;i++) X.rect(ctx,208+i*18,260,12,5,i%4?P.slate:P.slate2);
    if(detail){X.plate(ctx,58,246,110,62,P.bone,P.white,P.plasticD);text(ctx,'CASCADE',113,261,c.signal,'center');chart(ctx,478,238,130,73,day,down);}
  }
  function closeFrame(ctx, report, detail) {
    const good=(report.pnl||0)>=0, met=!!report.quotaMet;
    officeFrame(ctx, report.day||0, true, (report.indexPct != null ? report.indexPct : (report.pnl||0)) < 0); ctx.save(); ctx.globalAlpha=.32;X.rect(ctx,0,0,V.w,V.h,P.ink);ctx.restore();
    X.box(ctx,165,72,310,112);
    text(ctx, met?'QUOTA MET':report.quota>0?'QUOTA MISSED':'CLOSING BELL',320,93,met?P.jade:P.crimson,'center');
    text(ctx,B.fmt.money(report.pnl||0,true),320,124,good?P.jade:P.crimson,'center');
    if(detail){text(ctx,`QUOTA ${B.fmt.money(report.quota||0)}`,320,146,P.grey2,'center');text(ctx,clean(report.date||''),320,162,P.putty,'center');}
  }
  function weekendFrame(ctx, sb, night) {
    const c=colors(sb.act);X.rect(ctx,0,0,V.w,V.h,P.ink);X.gradient(ctx,0,0,V.w,250,night?P.ink2:P.sky,P.ink,12);skyline(ctx,sb.act,sb.week*9,250);
    X.rect(ctx,0,250,V.w,110,night?P.ink2:P.carpetD);X.plate(ctx,92,216,360,54,P.slate,P.slate2,P.ink);
    X.plate(ctx,492,194,86,114,P.ink2,P.slate2,P.ink);chart(ctx,502,208,66,76,sb.week,night);
    phone(ctx,386,226,54,78,[],sb.act,sb.day);
    if(night) { ctx.save();ctx.globalAlpha=.09;X.rect(ctx,376,216,74,98,c.signal);ctx.restore(); }
  }
  function endingFrame(ctx, o, detail) {
    const id=o.id||'grind', dark=!!o.dark, seed=hash(id), c=colors(dark?4:1);
    X.rect(ctx,0,0,V.w,V.h,P.ink);X.gradient(ctx,0,0,V.w,238,dark?P.slate2:P.amber,dark?P.ink2:P.crimsonD,12);skyline(ctx,dark?4:1,seed%97,244);X.rect(ctx,0,244,V.w,116,P.ink);
    // Every ending gets a stable, visibly unique signature made from its id.
    for(let i=0;i<12;i++){
      const bit=(seed >>> (i%24))&1, x=128+i*32, h=20+((seed >>> ((i*3)%24))&31);
      X.rect(ctx,x,190-h,bit?20:11,h,bit?c.signal:c.wash);
      if((seed+i)%3===0) X.rect(ctx,x+3,184-h,5,5,P.bone);
    }
    text(ctx,clean(o.title||id.replace(/-/g,' ')).toUpperCase().slice(0,48),320,42,c.signal,'center');
    if(detail){X.box(ctx,80,82,480,92);text(ctx,clean(o.title).slice(0,42),320,104,dark?P.bone:P.amber,'center');X.wrap(clean(o.deck),430).slice(0,3).forEach((line,i)=>text(ctx,line,320,130+i*11,P.bone,'center'));}
  }


  // Sqwak breaking-news insert: a phone held in one hand against the act's
  // skyline, one post filling the screen. Content comes from B.SqwakStory.
  function big(ctx, value, x, y, color, scale, align) {
    ctx.save(); ctx.scale(scale, scale);
    X.textShadow(ctx, clean(value).slice(0, 40), Math.round(x / scale), Math.round(y / scale), color, P.ink, { align: align || 'left' });
    ctx.restore();
  }
  function sqwakFrame(ctx, sb, b, full) {
    const c = colors(sb.act);
    skyline(ctx, sb.act, sb.day * 7 + 3, 300);
    X.rect(ctx, 0, 300, V.w, 60, P.ink);
    const pw = 236, ph = 330, px = (V.w - pw) / 2, py = full ? 14 : 40;
    // hand behind the phone
    X.rect(ctx, px - 22, py + 150, 30, 120, P.desk);
    X.rect(ctx, px - 24, py + 150, 6, 110, P.deskD);
    X.rect(ctx, px + pw - 30, py + 112, 44, 150, P.desk);
    X.rect(ctx, px + pw + 10, py + 122, 4, 116, P.deskD);
    X.rect(ctx, px + pw - 6, py + 118, 34, 26, P.desk2);
    X.rect(ctx, px + pw - 6, py + 150, 38, 26, P.desk2);
    X.rect(ctx, px + pw - 6, py + 182, 34, 26, P.desk2);
    X.rect(ctx, px + pw - 6, py + 214, 28, 24, P.desk);
    X.plate(ctx, px, py, pw, ph, P.ink2, P.slate2, P.ink);
    const sx = px + 9, sy = py + 12, sw = pw - 18;
    X.rect(ctx, sx, sy, sw, ph - 24, P.screenD);
    X.rect(ctx, px + pw / 2 - 20, py + 4, 40, 5, P.ink);
    // app header
    big(ctx, 'sqwak', px + pw / 2, sy + 12, P.bone, 2, 'center');
    text(ctx, 'MARKETS TALK. EVERYONE LISTENS.', px + pw / 2, sy + 32, P.grey, 'center');
    X.rect(ctx, sx, sy + 44, sw, 1, P.slate);
    // the post
    const cy = sy + 52;
    X.rect(ctx, sx + 6, cy, sw - 12, 190, P.screen);
    X.rect(ctx, sx + 12, cy + 8, 10, 10, P.crimson);
    text(ctx, b.flag || 'BREAKING', sx + 28, cy + 10, P.crimson);
    text(ctx, b.when || 'NOW', sx + sw - 14, cy + 10, P.grey2, 'right');
    X.wrap(clean(b.head).toUpperCase(), (sw - 30) / 2).slice(0, 3).forEach((line, i) => big(ctx, line, sx + 12, cy + 26 + i * 18, P.bone, 2));
    const bodyY = cy + 88;
    X.wrap(clean(b.text), sw - 30).slice(0, 5).forEach((line, i) => text(ctx, line, sx + 12, bodyY + i * 10, P.putty2));
    // glitch thumbnail strip
    for (let i = 0; i < 6; i++) X.rect(ctx, sx + 12 + ((i * 29 + sb.day) % (sw - 60)), cy + 150 + i * 4, 30 + (i * 11) % 24, 2, i % 2 ? P.crimsonD : P.crimson);
    text(ctx, `${b.stats ? b.stats[0] : '1.2K'}   ${b.stats ? b.stats[1] : '4.8K'}   ${b.stats ? b.stats[2] : '12K'}`, sx + 12, cy + 176, P.grey2);
    // reply
    if (b.reply) {
      const ry = cy + 198;
      X.rect(ctx, sx + 12, ry, 14, 14, P.slate);
      text(ctx, clean(b.reply[0]).slice(0, 26), sx + 32, ry + 1, P.sky);
      X.wrap(clean(b.reply[1]), sw - 44).slice(0, 3).forEach((line, i) => text(ctx, line, sx + 32, ry + 12 + i * 10, P.bone));
    }
    X.scanlines(ctx, 0, 0, V.w, V.h, P.ink, full ? .06 : .1);
    if (!full) { ctx.save(); ctx.globalAlpha = .25; X.rect(ctx, 0, 0, V.w, V.h, c.wash); ctx.restore(); }
  }

  function beat(scene, id, dur, draw, line, extra) {
    return Object.assign({ id:`${scene}:${id}`, view:V, dur, draw, line:line||'', cache:true, transition:'cut' }, extra||{});
  }
  B.Rhythm = {
    view:V, storyboards:STORYBOARDS, endingIds:ENDING_IDS,
    phoneRowCount(feed){return Math.min(4,(feed||[]).length);},
    storyboard(day){return STORYBOARDS[day]||board(day);},
    frameMap(day){const sb=this.storyboard(day);return [
      {id:`news:${day}:place`,purpose:'establish',camera:sb.camera},
      {id:`news:${day}:headline`,purpose:'meaningful insert',camera:'insert'},
      {id:`news:${day}:reaction`,purpose:'environmental reaction',camera:'profile'},
      {id:`news:${day}:hold`,purpose:'pressure hold',camera:'still'}
    ];}
  };

  B.Scenes.news = function(o){const sb=board(o.day||0), title=clean((o.brief||{}).title), date=B.Calendar&&B.Calendar.storyLabel?B.Calendar.storyLabel(o.day||0):`SESSION ${(o.day||0)+1}`;return [
    beat('news',`${sb.day}:place`,1.65,(c)=>placeFrame(c,sb,title,false),date,{sfx:/subway|platform/.test(sb.place)?'transit':sb.place==='street'?'street':/kitchen|breakroom/.test(sb.place)?'kitchen':'apartment',transition:'fade'}),
    beat('news',`${sb.day}:headline`,2.15,(c)=>placeFrame(c,sb,title,true),title,{sfx:'broadcast',informative:true}),
    beat('news',`${sb.day}:reaction`,1.55,(c)=>placeFrame(c,Object.assign({},sb,{crop:-sb.crop}),title,false),'',{}),
    beat('news',`${sb.day}:hold`,1.0,(c)=>{placeFrame(c,sb,title,true);c.save();c.globalAlpha=.12;X.rect(c,0,0,V.w,V.h,P.ink);c.restore();},'',{})
  ];};
  B.Scenes.phone = function(o){const sb=board(o.day||0),feed=(o.brief&&o.brief.feed)||[];return [
    beat('phone',`${sb.day}:handoff`,1.4,(c)=>phoneFrame(c,sb,feed,false),'',{sfx:'apartment',transition:'fade'}),
    beat('phone',`${sb.day}:read`,2.0,(c)=>phoneFrame(c,sb,feed,true),'PRE-OPEN FEED',{sfx:'news',informative:true})
  ];};
  B.Scenes.office = function(o){const day=o.day||0;return [
    beat('office',`${day}:wide`,1.45,(c)=>officeFrame(c,day,false),'FORTY-FIRST FLOOR.',{sfx:'elevator',transition:'fade'}),
    beat('office',`${day}:desk`,1.8,(c)=>officeFrame(c,day,true),'THE DESK IS ALREADY AWAKE.',{sfx:'office',informative:true}),
    beat('office',`${day}:hold`,.85,(c)=>officeFrame(c,day,true),'SIT DOWN. NINE THIRTY.',{})
  ];};
  B.Scenes.close = function(o){const r=o.report||{};const story=!o.game||!o.game.mode||o.game.mode.kind==='story';
    const sq=story&&B.SqwakStory&&B.SqwakStory.BREAKING?B.SqwakStory.BREAKING[r.day]:null;const sb=board(r.day||0);
    const tag=`${r.day||0}:${(r.pnl||0)>=0?'u':'d'}${r.quotaMet?'m':''}${Math.round(r.pnl||0)}`;
    const bell=beat('close',`${tag}:bell`,1.25,(c)=>closeFrame(c,r,false),'4:00 PM.',{sfx:'closeBell',transition:'fade'});
    const post=sq?[
      beat('close',`${r.day||0}:sqwak`,1.0,(c)=>sqwakFrame(c,sb,sq,false),'',{sfx:'news'}),
      beat('close',`${r.day||0}:sqwak-read`,2.6,(c)=>sqwakFrame(c,sb,sq,true),clean(sq.head).toUpperCase(),{sfx:'broadcast'})
    ]:[];
    return [bell].concat(post,[
      beat('close',`${tag}:report`,2.0,(c)=>closeFrame(c,r,true),(r.pnl||0)>=0?'YOU MADE MONEY. NOBODY SAYS WELL DONE.':'YOU LOST MONEY. EVERYBODY NOTICED.',{sfx:'office',informative:true}),
      beat('close',`${tag}:hold`,.85,(c)=>closeFrame(c,r,true),'',{})
    ]);};
  B.Scenes.weekend = function(o){const sb=board(o.day||0);return [
    beat('weekend',`${sb.week}:sat`,1.6,(c)=>weekendFrame(c,sb,false),`WEEK ${sb.week} · SATURDAY`,{sfx:'apartment',transition:'fade',informative:true}),
    beat('weekend',`${sb.week}:sun`,1.8,(c)=>weekendFrame(c,sb,true),'SUNDAY NIGHT',{sfx:'apartment'}),
    beat('weekend',`${sb.week}:hold`,.8,(c)=>weekendFrame(c,sb,true),'',{})
  ];};
  B.Scenes.ending = function(o){return [
    beat('ending',`${o.id}:world`,1.7,(c)=>endingFrame(c,o,false),'',{sfx:'apartment',transition:'fade'}),
    beat('ending',`${o.id}:card`,2.4,(c)=>endingFrame(c,o,true),clean(o.deck),{informative:true}),
    beat('ending',`${o.id}:hold`,1.0,(c)=>endingFrame(c,o,true),'ENDING REACHED',{})
  ];};
})(window.BTB);
