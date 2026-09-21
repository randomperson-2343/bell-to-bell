// The locked 32-colour palette. Mirrors css/tokens.css exactly.
// Every pixel drawn by js/art/pixel.js and every cutscene comes from here,
// which is what keeps the whole game looking like one machine drew it.
(function (B) {
  'use strict';

  const P = {
    // neutrals
    ink: '#1b1a21', ink2: '#2e2c38', slate: '#454455', slate2: '#5d5c6e',
    grey: '#7b7a8a', grey2: '#9a99a6',
    // room
    putty: '#b9b3a6', putty2: '#cfc9bb', bone: '#e4dfd2', white: '#f4f1e8',
    carpetD: '#3a4a4a', carpet: '#4d6260', carpet2: '#617874',
    deskD: '#6b5c4c', desk: '#8a7862', desk2: '#a4917a',
    // hardware
    plasticD: '#8f8878', plastic: '#b3ab97', plastic2: '#cdc5ae',
    screenD: '#0d1414', screen: '#14201e', screenGlow: '#1d2e2a',
    // signal
    phosphor: '#7fd8a0', phosphorD: '#4a9c6c',
    amber: '#e0b060', amberD: '#a07a38',
    crimson: '#c2495a', crimsonD: '#8a2f3d',
    jade: '#4fae7a', jadeD: '#2f7a52',
    sky: '#6f9fc9', violet: '#9b86c4'
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
