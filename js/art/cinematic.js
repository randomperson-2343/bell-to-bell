// Authored storyboard player. Static frame art is rasterized once per beat and
// reused; only captions, transitions and explicitly lightweight overlays redraw.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  const C = {
    el: null, canvas: null, running: false, beats: null, i: 0, t: 0,
    done: null, raf: null, onKey: null, opts: null, scene: '',
    frameCache: new Map(), cacheBytes: 0, chain: null, skippingChain: false, short: false, fired: null, warned: new Set(),

    ensure() {
      if (this.el) return;
      const wrap = document.createElement('div');
      wrap.id = 'cinematic';
      wrap.hidden = true;
      wrap.innerHTML = '<canvas id="cine-canvas" width="640" height="360"></canvas><div class="cine-skip">TAP OR PRESS A KEY · SKIP SCENE CHAIN</div>';
      document.body.appendChild(wrap);
      this.el = wrap;
      this.canvas = wrap.querySelector('#cine-canvas');
      wrap.addEventListener('pointerdown', () => this.skipAll());
      window.addEventListener('resize', () => { this.layout(); if (this.running && this.paused) this.draw(); });
      this.layout();
    },

    layout() {
      if (!this.canvas) return;
      // Fill the screen: the largest 16:9 box that fits, at any scale.
      // Whole-number scaling kept pixels perfectly even but left a wide
      // border on most window sizes (a 1440x900 screen got a 1280x720 box).
      const vw = 640, vh = 360;
      const availW = window.innerWidth || vw, availH = window.innerHeight || vh;
      const fit = Math.min(availW / vw, availH / vh);
      this.canvas.style.width = Math.floor(vw * fit) + 'px';
      this.canvas.style.height = Math.floor(vh * fit) + 'px';
    },

    mode() {
      const settings = B.Settings.get();
      return settings.cinematics == null ? 'full' : settings.cinematics;
    },

    startChain(name) { this.chain = name || 'scene'; this.skippingChain = false; },
    endChain() { this.chain = null; this.skippingChain = false; this.clearCache(); },

    clearCache() { this.frameCache.clear(); this.cacheBytes = 0; },

    // Store a canvas and evict oldest-first while over budget, never touching the
    // entries of the beat being drawn, the running beat or the one before it.
    remember(key, canvas, beat) {
      this.frameCache.set(key, canvas);
      this.cacheBytes += canvas.width * canvas.height * 4;
      if (this.cacheBytes <= B.Motion.CACHE_BYTES) return;
      const keep = [beat.id];
      if (this.running && this.beats) {
        const cur = this.beats[this.i], prev = this.beats[this.i - 1];
        if (cur) keep.push(cur.id);
        if (prev) keep.push(prev.id);
      }
      for (const [k, c] of this.frameCache) {
        if (this.cacheBytes <= B.Motion.CACHE_BYTES) break;
        if (keep.some((id) => k.startsWith(id + '|'))) continue;
        this.frameCache.delete(k);
        this.cacheBytes -= c.width * c.height * 4;
      }
    },

    warnOnce(beat, what, e) {
      const key = beat.id + '|' + what;
      if (this.warned.has(key)) return;
      this.warned.add(key);
      console.warn(`cinematic: ${what} threw for beat ${beat.id}: ${e && e.message}`);
    },

    play(name, opts, done) {
      if (this.running) this.finish(); // end the scene in progress: loop stopped, listener removed, its done called once
      const builder = B.Scenes[name];
      const mode = this.mode();
      if (this.skippingChain || !builder || mode === 'off') return done && done();
      let beats;
      try { beats = builder(opts || {}); } catch (e) { console.warn(`cinematic: scene builder ${name} threw: ${e && e.message}`); return done && done(); }
      if (!beats || !beats.length) return done && done();
      beats = beats.map((beat, index) => Object.assign({
        id: `${name}:${(opts && (opts.day != null ? opts.day : opts.id)) || 'default'}:${index}`,
        cache: true
      }, beat));
      beats.forEach((beat, index) => { beat.transition = B.Motion.transitionFor(beat, index); });
      if (mode === 'short') {
        const informative = beats.find((beat) => beat.informative) || beats.find((beat) => beat.line && String(beat.line).trim()) || beats[0];
        beats = [Object.assign({}, informative, { dur: 1.35, transition: 'fade' })];
      }
      this.short = mode === 'short';
      this.warned.clear();
      this.ensure();
      this.scene = name;
      this.opts = opts || {};
      this.beats = beats;
      this.i = 0;
      this.t = 0;
      this.done = done;
      this.running = true;
      this.paused = false;
      this.releasePictures();
      this.el.hidden = false;
      this.layout();
      B.Music.stop();
      this.playBeat();
      this.onKey = (e) => { e.preventDefault(); this.skipAll(); };
      window.addEventListener('keydown', this.onKey);
      this.last = performance.now();
      const step = (ts) => {
        if (!this.running) return;
        const dt = Math.min(0.08, (ts - this.last) / 1000);
        this.last = ts;
        if (this.paused) { this.raf = requestAnimationFrame(step); return; }
        this.t += dt;
        const beat = this.beats[this.i];
        this.fireCues(beat, this.t >= beat.dur);
        if (this.t >= beat.dur) {
          this.i++;
          this.t = 0;
          if (this.i >= this.beats.length) return this.finish();
          this.playBeat();
        }
        this.draw();
        this.raf = requestAnimationFrame(step);
      };
      this.draw();
      this.raf = requestAnimationFrame(step);
    },

    cachedFrame(beat, view) {
      const key = `${beat.id}|${view.w}x${view.h}`;
      if (this.frameCache.has(key)) return this.frameCache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = view.w; canvas.height = view.h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      try { beat.draw(ctx, view, beat.cacheAt == null ? 1 : beat.cacheAt, this.opts); }
      catch (e) { this.warnOnce(beat, 'draw', e); X.rect(ctx, 0, 0, view.w, view.h, P.ink); }
      this.remember(key, canvas, beat);
      return canvas;
    },

    // One layer of a layered beat, drawn once into a transparent canvas of its own size.
    layerCanvas(beat, layer, view) {
      const w = layer.w || view.w, h = layer.h || view.h;
      const key = `${beat.id}|${layer.id}|${w}x${h}`;
      if (this.frameCache.has(key)) return this.frameCache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      try { layer.draw(ctx, w === view.w && h === view.h ? view : Object.assign({}, view, { w, h }), this.opts); }
      catch (e) { this.warnOnce(beat, 'layer ' + layer.id, e); }
      this.remember(key, canvas, beat);
      return canvas;
    },

    // The shot picture only (camera applied); letterbox and caption are drawn by draw() afterwards.
    paint(ctx, beat, view, progress) {
      ctx.save();
      const motion = B.Motion && B.Motion.enabled();
      if (beat.layers && motion && !this.short) {
        // live layers: parallax camera, no preset; the beat's own camera may use x, y and zoom
        X.rect(ctx, 0, 0, view.w, view.h, P.ink);
        try {
          B.Motion.composite(ctx, view, beat, progress * beat.dur, progress, this.opts, B.Motion.cameraAt(beat.camera, progress), (layer) => this.layerCanvas(beat, layer, view), (layer, e) => this.warnOnce(beat, 'layer ' + layer.id + ' animate', e));
        } catch (e) { this.warnOnce(beat, 'composite', e); X.rect(ctx, 0, 0, view.w, view.h, P.ink); }
        if (beat.drawDynamic) beat.drawDynamic(ctx, view, progress, this.opts);
        ctx.restore();
        return;
      }
      if (motion && !beat.layers) {
        const cam = B.Motion.cameraAt(beat.camera || B.Motion.presetFor(beat), progress);
        const cx = view.w / 2, cy = view.h / 2;
        X.rect(ctx, 0, 0, view.w, view.h, P.ink); // rows a camera offset exposes stay opaque ink
        ctx.translate(cx + cam.x, cy + cam.y);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cx, -cy);
      }
      if (beat.layers) X.rect(ctx, 0, 0, view.w, view.h, P.ink); // the still may have transparent holes; never show stale pixels
      if (beat.cache !== false || beat.layers) ctx.drawImage(this.cachedFrame(beat, view), 0, 0, view.w, view.h);
      else {
        try { beat.draw(ctx, view, progress, this.opts); }
        catch (e) { this.warnOnce(beat, 'draw', e); X.rect(ctx, 0, 0, view.w, view.h, P.ink); }
      }
      if (beat.drawDynamic) beat.drawDynamic(ctx, view, progress, this.opts);
      ctx.restore();
    },

    // Reused scratch picture: allocated once, resized only when the view size changes.
    pictureCanvas(c, w, h) {
      if (!c) c = document.createElement('canvas');
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      g.imageSmoothingEnabled = false;
      return c;
    },

    // Which transition the current beat plays right now: motion off turns cross/wipe/push into fade.
    transitionNow() {
      const beat = this.beats[this.i];
      let name = beat.transition || B.Motion.transitionFor(beat, this.i);
      if (name !== 'cut' && name !== 'fade' && (this.i === 0 || !B.Motion.enabled())) name = 'fade';
      return name;
    },

    releasePictures() {
      this.snap = null; this.pic = null; this.snapFor = -1;
      if (B.Motion && B.Motion.releaseScratch) B.Motion.releaseScratch();
    },

    draw() {
      const beat = this.beats[this.i];
      const view = beat.view || B.Scenes.V;
      const { ctx } = X.fitSuper(this.canvas, view.w, view.h);
      const progress = B.clamp(this.t / beat.dur, 0, 1);
      const name = this.transitionNow();
      // never longer than the beat, so the blend always finishes by its last frame
      const tdur = Math.min(B.Motion.TRANSITION_DUR[name] || 0, beat.dur);
      if (name !== 'fade' && name !== 'cut' && this.t < tdur) {
        // Outgoing picture: the previous beat at its end. Incoming: this beat now, camera included.
        if (this.snapFor !== this.i) {
          const prev = this.beats[this.i - 1], pv = prev.view || B.Scenes.V;
          this.snap = this.pictureCanvas(this.snap, pv.w, pv.h);
          this.paint(this.snap.getContext('2d'), prev, pv, 1);
          this.snapFor = this.i;
        }
        this.pic = this.pictureCanvas(this.pic, view.w, view.h);
        this.paint(this.pic.getContext('2d'), beat, view, progress);
        B.Motion.drawTransition(ctx, view, name, this.t / tdur, this.snap, this.pic);
      } else {
        this.paint(ctx, beat, view, progress);
      }

      const unit = view.w / 320;
      X.rect(ctx, 0, 0, view.w, Math.round(6 * unit), P.ink);
      X.rect(ctx, 0, view.h - Math.round(6 * unit), view.w, Math.round(6 * unit), P.ink);
      if (beat.line) {
        const pad = Math.round(12 * unit);
        const width = view.w - pad * 2, x = pad, height = Math.round(32 * unit), y = view.h - height - Math.round(8 * unit);
        X.box(ctx, x, y, width, height);
        // Captions scale with the canvas so a 640-wide storyboard reads like the 320 one.
        const lines = X.wrap(beat.line, (width - Math.round(16 * unit)) / unit).slice(0, 2);
        const total = lines.join(' ').length;
        const delay = beat.captionDelay == null ? 0.22 : beat.captionDelay;
        const shown = Math.ceil(total * B.clamp((this.t - delay) / Math.min(1.15, beat.dur * 0.55), 0, 1));
        let used = 0;
        lines.forEach((line, row) => {
          const take = B.clamp(shown - used, 0, line.length);
          used += line.length;
          if (take > 0) {
            ctx.save(); ctx.scale(unit, unit);
            X.text(ctx, line.slice(0, take), Math.round((x + 8 * unit) / unit), Math.round((y + 8 * unit) / unit) + row * 10, P.bone);
            ctx.restore();
          }
        });
      }
      if (name === 'fade') {
        const fade = 1 - B.clamp(this.t / Math.min(B.Motion.TRANSITION_DUR.fade, beat.dur), 0, 1);
        if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; X.rect(ctx, 0, 0, view.w, view.h, P.ink); ctx.restore(); }
      }
    },

    // Test hooks: freeze the loop, and draw one frame at a chosen beat and time (no sound).
    pause() { this.paused = true; },
    seek(i, t) { if (!this.running || !this.beats || i < 0 || i >= this.beats.length) return; this.i = i; this.t = t; this.draw(); },
    optsOf() { return this.opts || {}; },
    // Timed sound cues: each fires once when the beat's clock passes `at`. Never from seek or skip.
    // The B.SFX functions gate themselves on the Sound effects setting (B.SFX.setEnabled), exactly as playBeat relies on.
    // `last`: the beat's final frame, so a cue at or past the duration still fires.
    fireCues(beat, last) {
      if (!beat.cues || !B.SFX) return;
      if (!this.fired || this.fired.beat !== beat) this.fired = { beat, done: new Set() };
      beat.cues.forEach((cue, n) => {
        if ((this.t < cue.at && !last) || this.fired.done.has(n)) return;
        this.fired.done.add(n);
        const fn = B.SFX[cue.sfx];
        if (typeof fn === 'function') fn.call(B.SFX);
      });
    },
    playBeat() {
      this.fired = null;
      const beat = this.beats && this.beats[this.i];
      if (!beat || !beat.sfx || !B.SFX) return;
      const fn = B.SFX[beat.sfx];
      if (typeof fn === 'function') fn.call(B.SFX);
    },
    skip() { this.skipAll(); },
    skipAll() { if (this.running) { this.skippingChain = !!this.chain; this.finish(); } },
    finish() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
      this.onKey = null;
      this.releasePictures();
      this.fired = null;
      this.warned.clear();
      if (!this.chain) this.clearCache();
      if (this.el) this.el.hidden = true;
      const done = this.done;
      this.done = null;
      this.opts = null;
      if (done) done();
    }
  };

  B.Cinematic = C;
})(window.BTB);
