// Persistent desk details that turn story choices into visible residue.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  B.StoryArt = {
    draw(canvas, g) {
      if (!canvas) return;
      const { ctx } = X.fit(canvas, 160, 32, 4);
      ctx.clearRect(0, 0, 160, 32);
      if (!g || g.mode.kind !== 'story') return;
      const S = g.mode.S;
      const f = S.f || {};

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

      let x = 46;
      if (f.leaked || f.reported || f.goPublic || f.fraud) {
        X.plate(ctx, x, 5, 27, 20, P.putty2, P.white, P.plasticD);
        X.rect(ctx, x + 4, 9, 18, 1, P.grey);
        X.rect(ctx, x + 4, 13, 16, 1, P.grey);
        X.rect(ctx, x + 4, 18, 19, 3, f.fraud ? P.crimson : P.violet);
        x += 31;
      }
      if (f.regulation || f.dereg || f.whipped || f.whippedAgainst) {
        X.rect(ctx, x + 2, 7, 22, 17, P.sky);
        X.rect(ctx, x, 23, 26, 3, P.slate2);
        X.rect(ctx, x + 5, 11, 3, 11, P.bone);
        X.rect(ctx, x + 11, 11, 3, 11, P.bone);
        X.rect(ctx, x + 17, 11, 3, 11, P.bone);
        X.rect(ctx, x + 3, 8, 20, 2, f.dereg || f.whippedAgainst ? P.crimson : P.bone);
        x += 31;
      }
      if (S.m.heat >= 50 || f.insiderTraded || f.raid) {
        X.plate(ctx, x, 5, 28, 21, P.crimsonD, P.crimson, P.ink);
        X.text(ctx, 'HOLD', x + 14, 9, P.white, { align: 'center' });
        X.text(ctx, 'FILES', x + 14, 17, P.bone, { align: 'center' });
      }

      // A clipped quota strip turns the rising campaign target into physical
      // pressure on the desk, not just a meter in the terminal.
      const qx = 136;
      X.plate(ctx, qx, 1, 24, 24, P.putty2, P.white, P.plasticD);
      X.rect(ctx, qx + 8, 0, 8, 3, P.slate2);
      X.text(ctx, 'FLOOR', qx + 12, 5, P.ink2, { align: 'center' });
      X.text(ctx, ((B.StoryData.QUOTAS[g.day] || 0) * 100).toFixed(1) + '%', qx + 12, 14, P.crimsonD, { align: 'center' });
    }
  };
})(window.BTB);
