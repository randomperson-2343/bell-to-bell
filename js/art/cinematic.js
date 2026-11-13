// Authored storyboard player. Static frame art is rasterized once per beat and
// reused; only captions, transitions and explicitly lightweight overlays redraw.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  const C = {
    el: null, canvas: null, running: false, beats: null, i: 0, t: 0,
    done: null, raf: null, onKey: null, opts: null, scene: '',
    frameCache: new Map(), chain: null, skippingChain: false,

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
    endChain() { this.chain = null; this.skippingChain = false; },

    play(name, opts, done) {
      const builder = B.Scenes[name];
      const mode = this.mode();
      if (this.skippingChain || !builder || mode === 'off') return done && done();
      let beats;
      try { beats = builder(opts || {}); } catch (e) { return done && done(); }
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
      catch (e) { X.rect(ctx, 0, 0, view.w, view.h, P.ink); }
      this.frameCache.set(key, canvas);
      // Each 640x360 frame is about 0.9 MB. 40 of them is plenty for any one
      // scene chain; 220 (about 200 MB) could get a phone tab killed.
      if (this.frameCache.size > 40) this.frameCache.delete(this.frameCache.keys().next().value);
      return canvas;
    },

    // The shot picture only (camera applied); letterbox and caption are drawn by draw() afterwards.
    paint(ctx, beat, view, progress) {
      ctx.save();
      if (B.Motion && B.Motion.enabled()) {
        const cam = B.Motion.cameraAt(beat.camera || B.Motion.presetFor(beat), progress);
        const cx = view.w / 2, cy = view.h / 2;
        X.rect(ctx, 0, 0, view.w, view.h, P.ink); // rows a camera offset exposes stay opaque ink
        ctx.translate(cx + cam.x, cy + cam.y);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cx, -cy);
      }
      if (beat.cache !== false) ctx.drawImage(this.cachedFrame(beat, view), 0, 0, view.w, view.h);
      else {
        try { beat.draw(ctx, view, progress, this.opts); }
        catch (e) { X.rect(ctx, 0, 0, view.w, view.h, P.ink); }
      }
      if (beat.drawDynamic) beat.drawDynamic(ctx, view, progress, this.opts);
      ctx.restore();
    },

    pictureCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').imageSmoothingEnabled = false;
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
      const { ctx } = X.fit(this.canvas, view.w, view.h);
      const progress = B.clamp(this.t / beat.dur, 0, 1);
      const name = this.transitionNow();
      const tdur = B.Motion.TRANSITION_DUR[name] || 0;
      if (name !== 'fade' && name !== 'cut' && this.t < tdur) {
        // Outgoing picture: the previous beat at its end. Incoming: this beat now, camera included.
        if (this.snapFor !== this.i) {
          const prev = this.beats[this.i - 1], pv = prev.view || B.Scenes.V;
          this.snap = this.pictureCanvas(pv.w, pv.h);
          this.paint(this.snap.getContext('2d'), prev, pv, 1);
          this.pic = this.pictureCanvas(view.w, view.h);
          this.snapFor = this.i;
        }
        this.paint(this.pic.getContext('2d'), beat, view, progress);
        B.Motion.drawTransition(ctx, view, name, this.t / tdur, this.snap, this.pic);
      } else {
        if (this.snapFor !== -1) this.releasePictures();
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
        const fade = 1 - B.clamp(this.t / B.Motion.TRANSITION_DUR.fade, 0, 1);
        if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; X.rect(ctx, 0, 0, view.w, view.h, P.ink); ctx.restore(); }
      }
    },

    // Test hooks: freeze the loop, and draw one frame at a chosen beat and time (no sound).
    pause() { this.paused = true; },
    seek(i, t) { if (!this.running || !this.beats || i < 0 || i >= this.beats.length) return; this.i = i; this.t = t; this.draw(); },
    optsOf() { return this.opts || {}; },
    playBeat() {
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
      if (this.el) this.el.hidden = true;
      const done = this.done;
      this.done = null;
      this.opts = null;
      if (done) done();
    }
  };

  B.Cinematic = C;
})(window.BTB);
