// The locked 32-colour palette. Mirrors css/tokens.css exactly.
// Every pixel drawn by js/art/pixel.js and every cutscene comes from here,
// which is what keeps the whole game looking like one machine drew it.
(function (B) {
  'use strict';

  const P = {
    // neutrals
    ink: '#171922', ink2: '#272a36', slate: '#3c4354', slate2: '#586176',
    grey: '#798296', grey2: '#9ba3b1',
    // room
    putty: '#aaa89f', putty2: '#c7c2b5', bone: '#ded8ca', white: '#f2eee3',
    carpetD: '#33454d', carpet: '#486069', carpet2: '#60767c',
    deskD: '#5f5047', desk: '#7b695a', desk2: '#9b8771',
    // hardware
    plasticD: '#847f79', plastic: '#a8a39a', plastic2: '#c8c3b7',
    screenD: '#0c1417', screen: '#122024', screenGlow: '#1c3031',
    // signal
    phosphor: '#79cfad', phosphorD: '#4b9a81',
    amber: '#d2a85c', amberD: '#94733d',
    crimson: '#bd5a66', crimsonD: '#843a46',
    jade: '#58a982', jadeD: '#36755b',
    sky: '#739bc4', violet: '#9688b6'
  };

  // Single-character keys for the sprite DSL. '.' is always transparent.
  const KEYS = {
    '.': null,
    '0': P.ink, '1': P.ink2, '2': P.slate, '3': P.slate2, '4': P.grey, '5': P.grey2,
    '6': P.putty, '7': P.putty2, '8': P.bone, '9': P.white,
    'c': P.carpetD, 'C': P.carpet, 'v': P.carpet2,
    'd': P.deskD, 'D': P.desk, 'e': P.desk2,
    'p': P.plasticD, 'P': P.plastic, 'q': P.plastic2,
    's': P.screenD, 'S': P.screen, 'g': P.screenGlow,
    'h': P.phosphor, 'H': P.phosphorD,
    'a': P.amber, 'A': P.amberD,
    'r': P.crimson, 'R': P.crimsonD,
    'j': P.jade, 'J': P.jadeD,
    'b': P.sky, 'm': P.violet
  };

  B.Pal = P;
  B.PalKeys = KEYS;

  // Blend two palette colours in 8 fixed steps (dither-friendly, still on-palette-ish).
  B.mix = function (a, b, f) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const k = Math.round(B.clamp(f, 0, 1) * 8) / 8;
    const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
    const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
    const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
})(window.BTB);
