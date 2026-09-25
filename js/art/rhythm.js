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
  // Thirteen weeks run from October into the new year: amber dawns first,
  // then grey six-o'clock darkness, then snow. Every exterior reads this.
  function season(day) {
    const week = Math.floor(Math.max(0, day | 0) / 5) + 1;
    if (week <= 4) return { id: 'autumn', week, dawn: P.amberD, glow: 0.34, snow: 0 };
    if (week <= 9) return { id: 'grey', week, dawn: P.slate, glow: 0.22, snow: 0 };
    return { id: 'winter', week, dawn: P.slate2, glow: 0.16, snow: Math.min(1, (week - 9) / 3), wreath: week >= 11 };
  }
  // Sky over the horizon line at y for a given day, then weather on top.
  function sky(ctx, x, y0, w, h, day, top) {
    const s = season(day);
    X.gradient(ctx, x, y0, w, h, top || P.ink2, P.ink, 10);
    X.dither(ctx, x, y0 + Math.round(h * 0.55), w, Math.round(h * 0.45), P.ink, s.dawn, s.glow);
    return s;
  }
  function weather(ctx, x, y0, w, h, day) {
    const s = season(day);
    if (s.snow) {
      X.speckle(ctx, x, y0, w, h, P.bone, 0.006 + s.snow * 0.01, 7 + (day | 0));
      X.speckle(ctx, x, y0, w, h, P.white, 0.002 + s.snow * 0.004, 31 + (day | 0));
    } else if (s.id === 'autumn') {
      for (let i = 0; i < 9; i++) {
        const k = (i * 97 + (day | 0) * 31) % 1000;
        X.rect(ctx, x + (k * 7) % w, y0 + (k * 13) % h, 3, 2, i % 2 ? P.amber : P.crimsonD);
      }
    }
    return s;
  }
  function skyline(ctx, act, seed, y, day) {
    const c = colors(act); y = y || 248;
    X.gradient(ctx, 0, 0, V.w, y, c.sky, P.ink, 12);
    const s = day == null ? null : season(day);
    if (s) X.dither(ctx, 0, Math.round(y * 0.6), V.w, Math.round(y * 0.4), P.ink, s.dawn, s.glow);
    for (let i = 0; i < 34; i++) {
      const w = 10 + ((i * 17 + seed * 3) % 22), h = 34 + ((i * 41 + seed * 11) % 128), x = i * 20 - 9;
      X.rect(ctx, x, y - h, w, h, i % 4 ? P.ink2 : P.slate);
      if (s && s.snow) X.rect(ctx, x, y - h, w, 2, P.bone);
      for (let yy = 7; yy < h - 5; yy += 10) for (let xx = 4; xx < w - 3; xx += 8) {
        if ((i * 13 + xx + yy + seed) % 11 < 2) X.rect(ctx, x + xx, y - h + yy, 2, 2, c.wash);
      }
    }
    if (s) weather(ctx, 0, 0, V.w, y - 20, day);
  }
  // Lit cels on the 3px grid, shared with the apartment and the rooms.
  const cel3 = (ctx, x, y, w, h, base, hi, sh) => X.cel(ctx, x, y, w, h, base, hi, sh, P.ink2, 3);
  const celIn = (ctx, x, y, w, h, base, hi, sh) => X.cel(ctx, x, y, w, h, base, sh, hi, P.ink2, 3);
  // A commuter or colleague in outline: coat with a lit edge, collar, head,
  // hair, and an eye on the side they face. Scale s is the pixel size.
  // Outlined three-quarter figure, lit from the top left like the pet sprite.
  // Each sprite pixel is 2*scale; row 10 (the collar) sits at y.
  const FIGURE = [
    '....000000....', '...01111110...', '..0111111110..', '..0111111ee0..',
    '..011eeeeee0..', '..01eeeee0e0..', '..01eeeeeeD0..', '..0eeeeeeeD0..',
    '...0eeeeDD0...', '....0DDDD0....', '..00038R83100.', '.0333388R82210',
    '03332228R22210', '03312222R22110', '03312222222110', '03312222222110',
    '03312222222110', '03312222222110', '03312222222110', '03312222222110',
    '03312222222110', '03312222222110', '03312222222110', '03312222222110',
    '03312222222110', '0ee02222220DD0', '.000222222000.', '...02211220...',
    '...02211220...', '...02211220...', '...02211220...', '...00000000...'
  ];
  const FIG_LATE = FIGURE.map((r) => r.replace(/[123eD7]/g, (ch) => ({ 1: '2', 2: '3', 3: '4', e: 'D', D: 'd', 7: 'e' })[ch]));
  const FIG_SP = {};
  function person(ctx, x, y, scale, act, face) {
    const s = scale || 1, key = act > 2 ? 'late' : 'early';
    const sp = FIG_SP[key] || (FIG_SP[key] = X.sprite(act > 2 ? FIG_LATE : FIGURE));
    ctx.save();
    ctx.translate(x, y - 20 * s);
    ctx.scale((face < 0 ? -2 : 2) * s, 2 * s);
    X.drawSprite(ctx, sp, -7, 0);
    ctx.restore();
  }
  function monitor(ctx, x, y, w, h, headline, act) {
    const c = colors(act);
    cel3(ctx, x-5, y-5, w+10, h+10, P.plastic, P.plastic2, P.plasticD);
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
    skyline(ctx, sb.act, sb.day, 252, sb.day);
    X.rect(ctx, 0, 252, V.w, 108, sb.place === 'street' || sb.place === 'platform' ? P.ink2 : P.carpetD);
    if (sb.place === 'subway' || sb.place === 'platform') {
      X.rect(ctx, 0, 26, V.w, 226, P.plasticD);
      for (let i=0;i<7;i++) celIn(ctx, 18+i*94, 52, 76, 92, P.screenD, P.plastic2, P.plasticD);
      X.rect(ctx, 0, 252, V.w, 108, P.carpetD);
      // Platform LEDs, bench ends and rails establish a current transit stop.
      X.rect(ctx, 0, 246, V.w, 3, P.amberD);
      for (let i=0;i<8;i++) {
        X.rect(ctx, 20+i*82, 38, 48, 1, P.bone);
        X.rect(ctx, 35+i*82, 226, 34, 3, P.plastic);
        X.rect(ctx, 40+i*82, 229, 2, 19, P.plasticD);
      }
    } else if (sb.place === 'lobby' || sb.place === 'elevator') {
      X.gradient(ctx, 0, 0, V.w, 278, P.putty2, P.plasticD, 10);
      for (let i=0;i<10;i++) X.rect(ctx, i*68, 0, 2, 278, P.plastic);
      X.rect(ctx, 0, 278, V.w, 82, P.slate);
      for (let i=0;i<8;i++) X.rect(ctx, i*93, 273, 75, 1, P.bone);
      cel3(ctx, 516, 68, 74, 96, P.plasticD, P.plastic2, P.ink2);
      X.rect(ctx, 526, 84, 54, 56, P.screenD);
      for (let i=0;i<4;i++) X.rect(ctx, 534, 92+i*11, 40-i*6, 2, P.sky);
    } else if (sb.place === 'kitchen' || sb.place === 'breakroom') {
      X.gradient(ctx, 0, 0, V.w, 255, P.putty2, P.putty, 9);
      X.rect(ctx, 0, 255, V.w, 105, P.desk);
      for (let i=0;i<9;i++) cel3(ctx, 12+i*72, 52, 62, 52, P.plastic, P.plastic2, P.plasticD);
      cel3(ctx, 0, 207, V.w, 21, P.deskD, P.desk2, P.ink2);
      celIn(ctx, 420, 213, 94, 11, P.plastic2, P.bone, P.plasticD);
      X.rect(ctx, 524, 192, 3, 24, P.plastic2);
      X.rect(ctx, 526, 191, 22, 2, P.plastic2);
      cel3(ctx, 570, 192, 24, 24, P.bone, P.white, P.plasticD);
    } else if (sb.place === 'desk') {
      X.gradient(ctx, 0, 0, V.w, 226, P.putty2, P.putty, 9);
      X.rect(ctx, 0, 226, V.w, 134, P.desk);
      chart(ctx, 374+shift/3, 66, 198, 130, sb.day, marketDown(sb.day - 1));
      X.rect(ctx, 0, 219, V.w, 4, P.deskD);
      for (let i=0;i<7;i++) X.rect(ctx, 398+i*23, 232, 15, 1, P.grey2);
      cel3(ctx, 554, 230, 33, 26, P.plastic2, P.bone, P.plasticD);
      X.rect(ctx, 561, 237, 20, 1, P.grey);
    } else if (sb.place === 'rideshare') {
      X.rect(ctx, 0, 0, V.w, 360, P.ink2); skyline(ctx, sb.act, sb.day, 210, sb.day);
      X.rect(ctx, 0, 214, V.w, 146, P.ink);
      person(ctx, 74, 250, 2, sb.act, 1); person(ctx, 574, 250, 2, sb.act, -1);
      X.rect(ctx, 0, 202, V.w, 5, P.slate);
      cel3(ctx, 254, 236, 132, 24, P.slate, P.slate2, P.ink2);
      X.rect(ctx, 269, 242, 102, 10, P.screen);
      X.rect(ctx, 280, 246, 36, 2, P.sky);
      X.rect(ctx, 324, 246, 28, 2, P.amber);
    } else if (sb.place === 'street') {
      for (let i=0;i<10;i++) {
        X.rect(ctx, i*76, 234, 2, 18, P.slate2);
        X.rect(ctx, i*76+5, 249, 38, 1, P.grey2);
      }
      X.rect(ctx, 14, 249, 612, 2, P.amberD);
    }
    const mx = B.clamp(70 + shift, 24, 330), my = detail ? 56 : 76, mw = detail ? 300 : 250, mh = detail ? 170 : 142;
    monitor(ctx, mx, my, mw, mh, headline, sb.act);
    if (!detail) person(ctx, B.clamp(470-shift/2,380,560), 244, 2, sb.act, -1);
    // Observable composition markers: framing and subject position vary by camera.
    if (sb.camera === 'insert') cel3(ctx, 468, 86, 116, 82, P.bone, P.white, P.plasticD);
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
    // A thin reflected edge keeps the handoff and the close view grounded
    // as one physical device, while leaving the notification text untouched.
    X.rect(ctx,x-12,y+16,1,h-24,P.slate2);
    X.rect(ctx,x+w+11,y+16,1,h-24,P.slate2);
    phone(ctx,x,y,w,h,feed,sb.act,sb.day);
    X.rect(ctx,x+3,y+14,1,h-28,P.grey2);
    X.rect(ctx,x+w-4,y+19,1,h-38,P.slate2);
    X.rect(ctx,x+Math.round(w/2)-9,y+h-8,18,1,P.slate2);
    for(let i=0;i<5;i++) X.rect(ctx,x+14+i*8,y+h+12,4,1,colors(sb.act).signal);
    text(ctx,'SQWAK · PRE-OPEN', close?92:88, 92, colors(sb.act).wash);
    text(ctx,`${count} NOTIFICATION${count===1?'':'S'}`,close?92:88,110,P.bone);
  }

  // The floor empties by act: one more dead desk each act. Your own desk
  // carries the story: the CASCADE stack slips as stability falls, and the
  // red HOLD files arrive once the heat is on.
  function officeFrame(ctx, day, detail, down, S) {
    const sb=board(day), c=colors(sb.act), s=season(day);
    if (down == null) down = marketDown(day - 1);
    X.rect(ctx,0,0,V.w,V.h,P.putty); X.gradient(ctx,0,0,V.w,235,P.putty2,P.putty,10); X.rect(ctx,0,235,V.w,125,P.desk);
    // A strip of windows: the season outside the forty-first floor.
    for(let i=0;i<6;i++){const wx=18+i*104;celIn(ctx,wx,16,90,44,P.slate2,P.putty2,P.plasticD);sky(ctx,wx+2,18,86,40,day,P.sky);
      for(let b=0;b<5;b++){const bh=8+((i*5+b*11+day)%20);X.rect(ctx,wx+4+b*17,58-bh,13,bh,P.slate);if(s.snow)X.rect(ctx,wx+4+b*17,58-bh,13,1,P.bone);}
      weather(ctx,wx+2,18,86,30,day+i);}
    const dead=sb.act-1;
    for(let i=0;i<5;i++){const x=24+i*124,off=i>=5-dead;cel3(ctx,x,78,104,126,P.plastic,P.plastic2,P.plasticD);
      if(off){X.rect(ctx,x+10,92,84,78,P.screenD);X.rect(ctx,x+20,176,64,3,P.plasticD);}else chart(ctx,x+10,92,84,78,day+i,down);}
    cel3(ctx,196,242,248,30,P.plasticD,P.plastic2,P.ink2);
    for(let i=0;i<12;i++) X.rect(ctx,208+i*18,250,12,5,i%4?P.slate:P.slate2);
    if(detail){
      const st=S&&S.m?S.m.stability:100, slip=Math.round((100-st)/12), f=(S&&S.f)||{};
      for(let i=0;i<4;i++){const x=58+i*4+(i>1?slip:0),y=250-i*9;X.rect(ctx,x+4,y+4,110,16,P.deskD);cel3(ctx,x,y,110,16,P.bone,P.white,P.plasticD);X.rect(ctx,x+6,y+5,40,2,i>1&&st<60?P.crimsonD:P.sky);X.rect(ctx,x+6,y+10,80,1,P.grey);}
      text(ctx,'CASCADE',64,216,c.signal);
      if(st<40){X.rect(ctx,176+slip,262,8,4,P.crimson);X.rect(ctx,188+slip,266,5,3,P.crimsonD);}
      if(S&&S.m&&(S.m.heat>=50||f.insiderTraded||f.raid)){cel3(ctx,470,236,56,34,P.crimsonD,P.crimson,P.ink);text(ctx,'HOLD',498,246,P.white,'center');text(ctx,'FILES',498,256,P.bone,'center');}
      chart(ctx,540,218,86,50,day,down);
    }
  }
  function closeFrame(ctx, report, detail) {
    const good=(report.pnl||0)>=0, met=!!report.quotaMet;
    officeFrame(ctx, report.day||0, true, (report.indexPct != null ? report.indexPct : (report.pnl||0)) < 0); ctx.save(); ctx.globalAlpha=.32;X.rect(ctx,0,0,V.w,V.h,P.ink);ctx.restore();
    X.box(ctx,165,72,310,112);
    X.rect(ctx,166,71,308,1,P.grey2);
    X.rect(ctx,166,185,308,1,P.slate2);
    for(let i=0;i<9;i++) X.rect(ctx,172+i*37,180,15,1,met?P.jadeD:P.crimsonD);
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
    skyline(ctx, sb.act, sb.day * 7 + 3, 300, sb.day);
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
    // Drawing helpers for js/art/storyboard.js.
    placeFrame, phoneFrame, officeFrame, closeFrame, weekendFrame, skyline, season, sky, weather, text, colors, clean, chart, person, marketDown, beat,
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
  B.Scenes.office = function(o){const day=o.day||0,g=o.game,S=g&&g.mode&&g.mode.S,k=S&&S.m?`${Math.round((100-S.m.stability)/12)}${S.m.heat>=50?'h':''}`:'';const dead=board(day).act-1;return [
    beat('office',`${day}:wide`,1.45,(c)=>officeFrame(c,day,false,null,S),'FORTY-FIRST FLOOR.',{sfx:'elevator',transition:'fade'}),
    beat('office',`${day}:desk:${k}`,1.8,(c)=>officeFrame(c,day,true,null,S),dead?`${['','ONE DESK','TWO DESKS','THREE DESKS'][dead]} ON YOUR ROW. NOBODY SITS THERE NOW.`:'THE DESK IS ALREADY AWAKE.',{sfx:'office',informative:true}),
    beat('office',`${day}:hold:${k}`,.85,(c)=>officeFrame(c,day,true,null,S),'SIT DOWN. NINE THIRTY.',{})
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
