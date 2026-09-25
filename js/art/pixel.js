// Pixel-art toolkit: everything the office chrome and the cutscenes are drawn with.
// All coordinates are in *virtual pixels*; ctx is pre-scaled by the caller, so a
// 1x1 rect here is one chunky pixel on screen no matter the window size.
(function (B) {
  'use strict';
  const P = B.Pal;

  // ---- 5x7 bitmap font, stored as 5 column bytes per glyph (bit 0 = top row).
  // Lowercase maps to uppercase: SNES UI text is caps, and it keeps the table small.
  const FONT = {
    ' ': [0, 0, 0, 0, 0], '!': [0, 0, 0x5F, 0, 0], '"': [0, 7, 0, 7, 0], '#': [0x14, 0x7F, 0x14, 0x7F, 0x14],
    $: [0x24, 0x2A, 0x7F, 0x2A, 0x12], '%': [0x23, 0x13, 8, 0x64, 0x62], '&': [0x36, 0x49, 0x55, 0x22, 0x50],
    "'": [0, 5, 3, 0, 0], '(': [0, 0x1C, 0x22, 0x41, 0], ')': [0, 0x41, 0x22, 0x1C, 0], '*': [0x14, 8, 0x3E, 8, 0x14],
    '+': [8, 8, 0x3E, 8, 8], ',': [0, 0x50, 0x30, 0, 0], '-': [8, 8, 8, 8, 8], '.': [0, 0x60, 0x60, 0, 0],
    '/': [0x20, 0x10, 8, 4, 2],
    0: [0x3E, 0x51, 0x49, 0x45, 0x3E], 1: [0, 0x42, 0x7F, 0x40, 0], 2: [0x42, 0x61, 0x51, 0x49, 0x46],
    3: [0x21, 0x41, 0x45, 0x4B, 0x31], 4: [0x18, 0x14, 0x12, 0x7F, 0x10], 5: [0x27, 0x45, 0x45, 0x45, 0x39],
    6: [0x3C, 0x4A, 0x49, 0x49, 0x30], 7: [1, 0x71, 9, 5, 3], 8: [0x36, 0x49, 0x49, 0x49, 0x36],
    9: [6, 0x49, 0x49, 0x29, 0x1E],
    ':': [0, 0x36, 0x36, 0, 0], ';': [0, 0x56, 0x36, 0, 0], '<': [8, 0x14, 0x22, 0x41, 0],
    '=': [0x14, 0x14, 0x14, 0x14, 0x14], '>': [0, 0x41, 0x22, 0x14, 8], '?': [2, 1, 0x51, 9, 6],
    '@': [0x32, 0x49, 0x79, 0x41, 0x3E],
    A: [0x7E, 0x11, 0x11, 0x11, 0x7E], B: [0x7F, 0x49, 0x49, 0x49, 0x36], C: [0x3E, 0x41, 0x41, 0x41, 0x22],
    D: [0x7F, 0x41, 0x41, 0x22, 0x1C], E: [0x7F, 0x49, 0x49, 0x49, 0x41], F: [0x7F, 9, 9, 1, 1],
    G: [0x3E, 0x41, 0x49, 0x49, 0x7A], H: [0x7F, 8, 8, 8, 0x7F], I: [0, 0x41, 0x7F, 0x41, 0],
    J: [0x20, 0x40, 0x41, 0x3F, 1], K: [0x7F, 8, 0x14, 0x22, 0x41], L: [0x7F, 0x40, 0x40, 0x40, 0x40],
    M: [0x7F, 2, 4, 2, 0x7F], N: [0x7F, 4, 8, 0x10, 0x7F], O: [0x3E, 0x41, 0x41, 0x41, 0x3E],
    P: [0x7F, 9, 9, 9, 6], Q: [0x3E, 0x41, 0x51, 0x21, 0x5E], R: [0x7F, 9, 0x19, 0x29, 0x46],
    S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [1, 1, 0x7F, 1, 1], U: [0x3F, 0x40, 0x40, 0x40, 0x3F],
    V: [0x1F, 0x20, 0x40, 0x20, 0x1F], W: [0x7F, 0x20, 0x18, 0x20, 0x7F], X: [0x63, 0x14, 8, 0x14, 0x63],
    Y: [3, 4, 0x78, 4, 3], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
    '[': [0, 0x7F, 0x41, 0x41, 0], ']': [0, 0x41, 0x41, 0x7F, 0], '^': [4, 2, 1, 2, 4],
    _: [0x40, 0x40, 0x40, 0x40, 0x40], '|': [0, 0, 0x7F, 0, 0], '·': [0, 8, 8, 0, 0],
    '•': [0, 0x1C, 0x1C, 0x1C, 0], '↑': [4, 2, 0x7F, 2, 4], '↓': [0x10, 0x20, 0x7F, 0x20, 0x10]
  };

  // 4x4 ordered Bayer matrix — the SNES way to fake a gradient with two flat colours.
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const Pixel = {
    FONT,

    // Fit a virtual-pixel canvas to its element at an integer scale.
    // Returns the scale used, so callers can lay out in virtual pixels.
    fit(canvas, vw, vh, maxScale) {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let s = Math.max(1, Math.floor(Math.min(r.width / vw, r.height / vh)));
      if (maxScale) s = Math.min(s, maxScale);
      canvas.width = Math.round(vw * s * dpr);
      canvas.height = Math.round(vh * s * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      return { ctx, scale: s, vw, vh };
    },

    rect(ctx, x, y, w, h, col) {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
    },

    // Two-pixel bevelled plate: the standard SNES button / console face.
    plate(ctx, x, y, w, h, fill, light, dark) {
      this.rect(ctx, x, y, w, h, fill);
      this.rect(ctx, x, y, w, 1, light);
      this.rect(ctx, x, y, 1, h, light);
      this.rect(ctx, x, y + h - 1, w, 1, dark);
      this.rect(ctx, x + w - 1, y, 1, h, dark);
    },

    // Inset plate: looks pressed in. Used for screens and input wells.
    inset(ctx, x, y, w, h, fill, light, dark) {
      this.plate(ctx, x, y, w, h, fill, dark, light);
    },

    // Ordered dither between two colours. f = 0 all colA, 1 all colB.
    dither(ctx, x, y, w, h, colA, colB, f) {
      const lvl = Math.round(B.clamp(f, 0, 1) * 16);
      this.rect(ctx, x, y, w, h, colA);
      if (lvl <= 0) return;
      if (lvl >= 16) { this.rect(ctx, x, y, w, h, colB); return; }
      ctx.fillStyle = colB;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          if (BAYER[j & 3][i & 3] < lvl) ctx.fillRect((x + i) | 0, (y + j) | 0, 1, 1);
        }
      }
    },

    // Vertical dithered gradient across n bands — fake sky, wall light, CRT glow.
    gradient(ctx, x, y, w, h, colA, colB, bands) {
      const n = bands || 8;
      const bh = Math.ceil(h / n);
      for (let i = 0; i < n; i++) {
        const yy = y + i * bh;
        this.dither(ctx, x, yy, w, Math.min(bh, y + h - yy), colA, colB, i / (n - 1 || 1));
      }
    },

    // ---- text ----
    textWidth(str, spacing) { return String(str).length * (5 + (spacing == null ? 1 : spacing)); },

    text(ctx, str, x, y, col, opt) {
      opt = opt || {};
      const sp = opt.spacing == null ? 1 : opt.spacing;
      const s = String(str).toUpperCase();
      let cx = x;
      if (opt.align === 'center') cx = x - (this.textWidth(s, sp) - sp) / 2 | 0;
      else if (opt.align === 'right') cx = x - (this.textWidth(s, sp) - sp) | 0;
      ctx.fillStyle = col;
      for (let i = 0; i < s.length; i++) {
        const g = FONT[s[i]] || FONT['?'];
        for (let c = 0; c < 5; c++) {
          const bits = g[c];
          if (!bits) continue;
          for (let r = 0; r < 7; r++) {
            if (bits & (1 << r)) ctx.fillRect(cx + c, y + r, 1, 1);
          }
        }
        cx += 5 + sp;
      }
      return cx - x;
    },

    // Text with a 1px hard drop shadow — the SNES readability trick.
    textShadow(ctx, str, x, y, col, shadow, opt) {
      this.text(ctx, str, x + 1, y + 1, shadow || P.ink, opt);
      this.text(ctx, str, x, y, col, opt);
    },

    // Wrap to a pixel width, returning lines.
    wrap(str, widthPx, spacing) {
      const per = 5 + (spacing == null ? 1 : spacing);
      const max = Math.max(1, Math.floor(widthPx / per));
      const words = String(str).split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        if (!line.length) line = w;
        else if (line.length + 1 + w.length <= max) line += ' ' + w;
        else { lines.push(line); line = w; }
      }
      if (line.length) lines.push(line);
      return lines;
    },

    // A lit cel: an ink outline, light on the top and left edges, shade on
    // the bottom and right, on a grid of u pixels (3 by default). The
    // apartment, the pet's props and the decision rooms all draw with it.
    cel(ctx, x, y, w, h, base, hi, sh, out, u) {
      u = u || 3;
      this.rect(ctx, x, y, w, h, out || P.ink2);
      this.rect(ctx, x + u, y + u, w - 2 * u, h - 2 * u, base);
      if (hi) { this.rect(ctx, x + u, y + u, w - 2 * u, u, hi); this.rect(ctx, x + u, y + u, u, h - 2 * u, hi); }
      if (sh) { this.rect(ctx, x + u, y + h - 2 * u, w - 2 * u, u, sh); this.rect(ctx, x + w - 2 * u, y + 2 * u, u, h - 3 * u, sh); }
    },

    // ---- sprites ----
    // rows: array of strings using js/art/palette.js key characters. '.' = transparent.
    sprite(rows) {
      return { w: Math.max.apply(null, rows.map((r) => r.length)), h: rows.length, rows };
    },

    drawSprite(ctx, sp, x, y, opt) {
      opt = opt || {};
      const keys = B.PalKeys;
      const fx = opt.flip ? -1 : 1;
      for (let r = 0; r < sp.rows.length; r++) {
        const row = sp.rows[r];
        for (let c = 0; c < row.length; c++) {
          const col = opt.tint || keys[row[c]];
          if (!col) continue;
          ctx.fillStyle = col;
          ctx.fillRect(x + (fx > 0 ? c : sp.w - 1 - c), y + r, 1, 1);
        }
      }
    },

    // ---- texture ----
    // Deterministic speckle, so the same wall looks the same every frame.
    speckle(ctx, x, y, w, h, col, density, seed) {
      const rng = B.RNG(B.hashSeed('speckle|' + (seed || 0) + '|' + x + '|' + y));
      const n = Math.round(w * h * (density || 0.02));
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        ctx.fillRect(x + Math.floor(rng.next() * w), y + Math.floor(rng.next() * h), 1, 1);
      }
    },

    scanlines(ctx, x, y, w, h, col, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 0.18 : alpha;
      ctx.fillStyle = col || P.ink;
      for (let j = 0; j < h; j += 2) ctx.fillRect(x, y + j, w, 1);
      ctx.restore();
    },

    // A CRT screen: dark well, phosphor glow at the edges, scanlines on top.
    crt(ctx, x, y, w, h, glow) {
      this.inset(ctx, x, y, w, h, P.screen, P.plastic2, P.screenD);
      this.gradient(ctx, x + 1, y + 1, w - 2, h - 2, P.screenGlow, P.screen, 6);
      if (glow) {
        this.dither(ctx, x + 1, y + 1, w - 2, 3, P.screen, P.screenGlow, 0.7);
        this.dither(ctx, x + 1, y + h - 4, w - 2, 3, P.screen, P.screenGlow, 0.5);
      }
      this.scanlines(ctx, x + 1, y + 1, w - 2, h - 2, P.ink, 0.14);
    },

    // SNES dialogue box: bevelled frame, dark fill, bright inner keyline.
    box(ctx, x, y, w, h) {
      this.rect(ctx, x, y, w, h, P.ink2);
      this.rect(ctx, x + 1, y + 1, w - 2, h - 2, P.slate);
      this.rect(ctx, x + 2, y + 2, w - 4, h - 4, P.ink);
      this.rect(ctx, x + 2, y + 2, w - 4, 1, P.slate2);
      this.rect(ctx, x + 2, y + h - 3, w - 4, 1, P.ink2);
    }
  };

  B.Pixel = Pixel;
})(window.BTB);
