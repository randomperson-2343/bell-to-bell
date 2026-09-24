// Small procedural portraits for the story cast. They use the same virtual-pixel
// toolkit as the cutscenes, so decisions feel like scenes instead of plain alerts.
(function (B) {
  'use strict';
  const X = B.Pixel;
  const P = B.Pal;

  const CAST = {
    'Desmond Kroll': { skin: P.desk2, hair: P.grey2, suit: P.crimsonD, accent: P.crimson, cut: 'side', tie: true },
    'Imani Rhodes': { skin: P.deskD, hair: P.ink, suit: P.jadeD, accent: P.jade, cut: 'crown' },
    'Sana Ferreira': { skin: P.amberD, hair: P.ink2, suit: P.violet, accent: P.bone, cut: 'bob', badge: true },
    'Sen. Marcus Thorne': { skin: P.desk2, hair: P.bone, suit: P.sky, accent: P.white, cut: 'silver', tie: true },
    'Perry Nakash': { skin: P.putty2, hair: P.ink, suit: P.amberD, accent: P.amber, cut: 'crop', glasses: true },
    'Adele Venn': { skin: P.desk, hair: P.ink2, suit: P.phosphorD, accent: P.phosphor, cut: 'crop' },
    'Greta Vail': { skin: P.putty2, hair: P.crimsonD, suit: P.slate, accent: P.plastic2, cut: 'bob' },
    'Mom': { skin: P.desk2, hair: P.grey2, suit: P.carpet, accent: P.bone, cut: 'bob', cardigan: true }
  };

  function draw(canvas, name) {
    if (!canvas) return;
    const { ctx } = X.fit(canvas, 48, 48, 4);
    paint(ctx, name);
  }

  // Paint a portrait into any context on a 48x48 grid. Scenes scale it up
  // with ctx.scale and pass bare: true to drop the card background and frame,
  // so the person stands in the room instead of on a badge.
  function paint(ctx, name, opt) {
    const c = CAST[name] || { skin: P.desk2, hair: P.ink2, suit: P.slate, accent: P.grey2, cut: 'crop' };
    const bare = !!(opt && opt.bare);

    if (!bare) {
      X.rect(ctx, 0, 0, 48, 48, P.ink2);
      X.dither(ctx, 2, 2, 44, 44, P.slate, c.accent, 0.13);
      for (let i = 6; i < 44; i += 8) X.rect(ctx, i, 3, 1, 42, P.ink2);
      X.rect(ctx, 2, 38, 44, 8, P.ink);
    }

    // shoulders, shirt and lapels
    X.rect(ctx, 7, 34, 34, 12, c.suit);
    X.rect(ctx, 4, 40, 40, 6, c.suit);
    X.rect(ctx, 20, 34, 8, 12, P.bone);
    X.rect(ctx, 12, 34, 8, 2, c.accent);
    X.rect(ctx, 28, 34, 8, 2, c.accent);
    X.rect(ctx, 18, 34, 4, 8, c.suit);
    X.rect(ctx, 26, 34, 4, 8, c.suit);
    if (c.cardigan) {
      X.rect(ctx, 20, 34, 8, 12, P.putty2);
      X.rect(ctx, 23, 37, 2, 2, c.accent);
      X.rect(ctx, 23, 41, 2, 2, c.accent);
    }
    if (c.tie) {
      X.rect(ctx, 23, 35, 2, 3, c.accent);
      X.rect(ctx, 22, 38, 4, 6, c.accent);
    }

    // neck and face
    X.rect(ctx, 19, 29, 10, 8, c.skin);
    X.rect(ctx, 14, 11, 20, 21, c.skin);
    X.rect(ctx, 12, 16, 3, 10, c.skin);
    X.rect(ctx, 34, 16, 3, 10, c.skin);
    X.rect(ctx, 16, 30, 16, 3, P.ink2);

    // hair silhouettes are intentionally contemporary and graphic, not period-coded.
    if (c.cut === 'bob') {
      X.rect(ctx, 11, 8, 26, 9, c.hair);
      X.rect(ctx, 10, 13, 6, 19, c.hair);
      X.rect(ctx, 32, 13, 6, 19, c.hair);
    } else if (c.cut === 'crown') {
      X.rect(ctx, 12, 7, 24, 9, c.hair);
      for (let x = 12; x < 36; x += 4) X.rect(ctx, x, 5 + (x % 8 ? 1 : 0), 3, 4, c.hair);
      X.rect(ctx, 12, 14, 4, 8, c.hair);
      X.rect(ctx, 33, 14, 4, 8, c.hair);
    } else if (c.cut === 'silver') {
      X.rect(ctx, 13, 8, 22, 6, c.hair);
      X.rect(ctx, 12, 12, 5, 6, c.hair);
      X.rect(ctx, 31, 12, 5, 4, c.hair);
      X.rect(ctx, 18, 9, 12, 2, P.white);
    } else if (c.cut === 'side') {
      X.rect(ctx, 13, 8, 22, 6, c.hair);
      X.rect(ctx, 12, 11, 7, 6, c.hair);
      X.rect(ctx, 27, 9, 8, 2, P.bone);
    } else {
      X.rect(ctx, 13, 8, 22, 7, c.hair);
      X.rect(ctx, 12, 12, 4, 5, c.hair);
    }

    // readable expression at 48 virtual pixels
    X.rect(ctx, 18, 19, 3, 2, P.ink);
    X.rect(ctx, 28, 19, 3, 2, P.ink);
    X.rect(ctx, 23, 21, 2, 5, P.deskD);
    X.rect(ctx, 20, 28, 9, 1, P.ink2);
    if (c.glasses) {
      X.rect(ctx, 16, 17, 7, 5, P.slate2);
      X.rect(ctx, 26, 17, 7, 5, P.slate2);
      X.rect(ctx, 23, 18, 3, 1, P.slate2);
      X.rect(ctx, 18, 19, 3, 1, P.sky);
      X.rect(ctx, 28, 19, 3, 1, P.sky);
    }
    if (c.badge) {
      X.rect(ctx, 32, 38, 7, 6, P.bone);
      X.rect(ctx, 33, 39, 5, 1, c.accent);
      X.rect(ctx, 33, 42, 4, 1, P.grey);
    }

    if (bare) return;
    X.rect(ctx, 0, 0, 48, 2, c.accent);
    X.rect(ctx, 0, 46, 48, 2, P.ink);
    X.rect(ctx, 0, 0, 2, 48, c.accent);
    X.rect(ctx, 46, 0, 2, 48, P.ink);
  }

  B.Portraits = {
    CAST,
    draw,
    paint,
    has: (name) => !!CAST[name],
    drawAll(root) {
      (root || document).querySelectorAll('canvas[data-portrait]').forEach((canvas) => draw(canvas, canvas.dataset.portrait));
    }
  };
})(window.BTB);
