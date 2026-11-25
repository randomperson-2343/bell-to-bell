// Persistent desk details that turn story choices into visible residue.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  const has = (id) => B.Art && B.Art.has(id);

  B.StoryArt = {
    // The authored props (art/src/desk/strip-*.aseprite), placed by the same
    // rules as the code-drawn fallback below. Returns false when the art is missing.
    drawArt(ctx, g, S, f) {
      const ids = ['blotter', 'cascade-note', 'shed', 'dossier', 'capitol', 'hold-files', 'quota-note'].map((n) => 'desk/strip-' + n);
      if (!ids.every(has)) return false;
      const art = (n, frame, x, y, opt) => X.drawArt(ctx, 'desk/strip-' + n, frame, x, y, opt);
      art('blotter', 'base', 0, 0);
      const slip = Math.round((100 - S.m.stability) / 18);
      for (let i = 0; i < 4; i++) art('cascade-note', i > 1 ? 'stressed' : 'calm', 3 + i * 2 + (i > 1 ? slip : 0), 18 - i * 4);
      // The stack sheds its first flakes under 50 stability and all of them under 30.
      if (S.m.stability < 30) art('shed', 'base', 36 + slip, 20);
      else if (S.m.stability < 50) art('shed', 'base', 36 + slip, 20, { cols: [0, 5] });
      let x = 44;
      if (f.leaked || f.reported || f.goPublic || f.fraud) { art('dossier', f.fraud ? 'fraud' : 'violet', x, 5); x += 28; }
      if (f.regulation || f.dereg || f.whipped || f.whippedAgainst) { art('capitol', f.dereg || f.whippedAgainst ? 'crimson' : 'bone', x, 7); x += 28; }
      if (S.m.heat >= 50 || f.insiderTraded || f.raid) art('hold-files', 'base', x, 5);
      const qx = 128;
      art('quota-note', 'base', qx, 0);
      X.text(ctx, 'FLOOR', qx + 16, 5, P.ink2, { align: 'center', spacing: 0 });   // 24 px, inside the note's 29 px face
      X.text(ctx, ((B.StoryData.QUOTAS[g.day] || 0) * 100).toFixed(1) + '%', qx + 16, 14, P.crimsonD, { align: 'center' });
      return true;
    },

    draw(canvas, g) {
      if (!canvas) return;
      const { ctx } = X.fit(canvas, 160, 32, 4);
      ctx.clearRect(0, 0, 160, 32);
      if (!g || g.mode.kind !== 'story') return;
      const S = g.mode.S;
      const f = S.f || {};
      if (this.drawArt(ctx, g, S, f)) return;

      // A dark blotter and coffee-ring wear keep the desk from reading as a row
      // of isolated icons.
      X.rect(ctx, 0, 29, 160, 3, P.deskD);
      X.rect(ctx, 83, 3, 16, 1, P.deskD);
      X.rect(ctx, 82, 4, 2, 7, P.deskD);
      X.rect(ctx, 98, 4, 2, 7, P.deskD);
      X.rect(ctx, 85, 11, 12, 1, P.deskD);

      // CASCADE notes: orderly at first, visibly slipping as stability falls.
      const slip = Math.round((100 - S.m.stability) / 18);
      for (let i = 0; i < 4; i++) {
        const x = 3 + i * 2 + (i > 1 ? slip : 0);
        const y = 18 - i * 4;
        X.rect(ctx, x + 2, y + 2, 29, 8, P.deskD);
        X.plate(ctx, x, y, 29, 8, P.bone, P.white, P.plasticD);
        X.rect(ctx, x + 3, y + 2, 10, 1, i > 1 ? P.crimsonD : P.sky);
        X.rect(ctx, x + 3, y + 5, 21, 1, P.grey);
      }
      // The stack physically sheds pixels as systemic stability falls.
      if (S.m.stability < 50) X.rect(ctx, 36 + slip, 20, 3, 2, P.crimsonD);
      if (S.m.stability < 30) {
        X.rect(ctx, 42 + slip, 24, 4, 2, P.crimson);
        X.rect(ctx, 49 + slip, 26, 2, 2, P.crimsonD);
      }

      // Props sit 28px apart so a full row still clears the quota note at 128.
      let x = 44;
      if (f.leaked || f.reported || f.goPublic || f.fraud) {
        X.plate(ctx, x, 5, 27, 20, P.putty2, P.white, P.plasticD);
        X.rect(ctx, x + 4, 9, 18, 1, P.grey);
        X.rect(ctx, x + 4, 13, 16, 1, P.grey);
        X.rect(ctx, x + 4, 18, 19, 3, f.fraud ? P.crimson : P.violet);
        x += 28;
      }
      if (f.regulation || f.dereg || f.whipped || f.whippedAgainst) {
        X.rect(ctx, x + 2, 7, 22, 17, P.sky);
        X.rect(ctx, x, 23, 26, 3, P.slate2);
        X.rect(ctx, x + 5, 11, 3, 11, P.bone);
        X.rect(ctx, x + 11, 11, 3, 11, P.bone);
        X.rect(ctx, x + 17, 11, 3, 11, P.bone);
        X.rect(ctx, x + 3, 8, 20, 2, f.dereg || f.whippedAgainst ? P.crimson : P.bone);
        x += 28;
      }
      if (S.m.heat >= 50 || f.insiderTraded || f.raid) {
        X.plate(ctx, x, 5, 28, 21, P.crimsonD, P.crimson, P.ink);
        X.text(ctx, 'HOLD', x + 14, 9, P.white, { align: 'center' });
        X.text(ctx, 'FILES', x + 14, 17, P.bone, { align: 'center', spacing: 0 });
      }

      // A clipped quota strip turns the rising campaign target into physical
      // pressure on the desk, not just a meter in the terminal.
      // 32px wide; FLOOR is set tight (24px) so it sits inside the note, not off its edge.
      const qx = 128;
      X.plate(ctx, qx, 1, 32, 24, P.putty2, P.white, P.plasticD);
      X.rect(ctx, qx + 12, 0, 8, 3, P.slate2);
      X.text(ctx, 'FLOOR', qx + 16, 5, P.ink2, { align: 'center', spacing: 0 });   // 24 px, inside the note's 29 px face
      X.text(ctx, ((B.StoryData.QUOTAS[g.day] || 0) * 100).toFixed(1) + '%', qx + 16, 14, P.crimsonD, { align: 'center' });
    }
  };
})(window.BTB);
