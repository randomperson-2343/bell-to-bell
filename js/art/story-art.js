// Persistent desk details that turn story choices into visible residue.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  B.StoryArt = {
    draw(canvas, g) {
      if (!canvas) return;
      const { ctx } = X.fit(canvas, 128, 28, 4);
      ctx.clearRect(0, 0, 128, 28);
      if (!g || g.mode.kind !== 'story') return;
      const S = g.mode.S;
      const f = S.f || {};

      // CASCADE notes: orderly at first, visibly slipping as stability falls.
      const slip = Math.round((100 - S.m.stability) / 18);
      for (let i = 0; i < 4; i++) {
        const x = 3 + i * 2 + (i > 1 ? slip : 0);
        const y = 18 - i * 4;
        X.plate(ctx, x, y, 29, 8, P.bone, P.white, P.plasticD);
        X.rect(ctx, x + 3, y + 2, 10, 1, i > 1 ? P.crimsonD : P.sky);
        X.rect(ctx, x + 3, y + 5, 21, 1, P.grey);
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
    }
  };
})(window.BTB);
