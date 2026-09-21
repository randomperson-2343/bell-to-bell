// Cutscene player. Runs a list of beats from js/art/scenes.js on a full-screen
// pixel canvas, types the caption underneath, and gets out of the way fast.
//
// Skippable at any moment with any key or a click — a game you replay for its
// endings cannot make you sit through the same elevator ride fifteen times.
// Settings can turn cinematics down to a single static card, or off entirely.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  const C = {
    el: null,
    canvas: null,
    running: false,
    beats: null,
    i: 0,
    t: 0,
    done: null,
    raf: null,
    onKey: null,

    ensure() {
      if (this.el) return;
      const wrap = document.createElement('div');
      wrap.id = 'cinematic';
      wrap.hidden = true;
      wrap.innerHTML = '<canvas id="cine-canvas"></canvas><div class="cine-skip">Press any key to skip</div>';
      document.body.appendChild(wrap);
      this.el = wrap;
      this.canvas = wrap.querySelector('#cine-canvas');
      wrap.addEventListener('pointerdown', () => this.skip());
    },

    mode() {
      const s = B.Settings.get();
      return s.cinematics == null ? 'full' : s.cinematics;
    },

    play(name, opts, done) {
      const builder = B.Scenes[name];
      const mode = this.mode();
      if (!builder || mode === 'off') return done && done();
      let beats;
      try { beats = builder(opts || {}); } catch (e) { return done && done(); }
      if (!beats || !beats.length) return done && done();
      if (mode === 'short') {
        // One card, held briefly: the beat that carries the most information.
        beats = [Object.assign({}, beats[beats.length - 1], { dur: 1.1 })];
      }
      this.ensure();
      this.beats = beats;
      this.i = 0;
      this.t = 0;
      this.done = done;
      this.running = true;
      this.el.hidden = false;
      this.onKey = () => this.skip();
      window.addEventListener('keydown', this.onKey);
      this.last = performance.now();
      const step = (ts) => {
        if (!this.running) return;
        const dt = Math.min(0.08, (ts - this.last) / 1000);
        this.last = ts;
        this.t += dt;
        const beat = this.beats[this.i];
        if (this.t >= beat.dur) {
          this.i++;
          this.t = 0;
          if (this.i >= this.beats.length) return this.finish();
        }
        this.draw();
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    },

    draw() {
      const V = B.Scenes.V;
      const { ctx } = X.fit(this.canvas, V.w, V.h);
      const beat = this.beats[this.i];
      const p = B.clamp(this.t / beat.dur, 0, 1);
      ctx.save();
      try { beat.draw(ctx, V, p, this.optsOf(beat)); } catch (e) { X.rect(ctx, 0, 0, V.w, V.h, P.ink); }
      ctx.restore();

      // caption box, typewritten
      if (beat.line) {
        const bw = V.w - 24, bx = 12, bh = 34, by = V.h - bh - 8;
        X.box(ctx, bx, by, bw, bh);
        const lines = X.wrap(beat.line, bw - 16).slice(0, 2);
        const total = lines.join(' ').length;
        const shown = Math.ceil(total * B.clamp(this.t / Math.min(1.1, beat.dur * 0.6), 0, 1));
        let used = 0;
        lines.forEach((ln, k) => {
          const take = B.clamp(shown - used, 0, ln.length);
          used += ln.length;
          if (take > 0) X.text(ctx, ln.slice(0, take), bx + 8, by + 9 + k * 10, P.bone);
        });
      }
      // first/last beat fade
      const fadeIn = this.i === 0 ? 1 - B.clamp(this.t / 0.35, 0, 1) : 0;
      if (fadeIn > 0.01) {
        ctx.save();
        ctx.globalAlpha = fadeIn;
        X.rect(ctx, 0, 0, V.w, V.h, P.ink);
        ctx.restore();
      }
    },

    optsOf() { return {}; },

    skip() {
      if (!this.running) return;
      this.finish();
    },

    finish() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
      this.onKey = null;
      if (this.el) this.el.hidden = true;
      const d = this.done;
      this.done = null;
      if (d) d();
    }
  };

  B.Cinematic = C;
})(window.BTB);
