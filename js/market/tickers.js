// The tradable universe. Every company, ticker, index and instrument below is
// invented for this game. Any resemblance to a real firm is coincidence, not
// intention — js/tests/tests.js enforces that with a denylist check.
(function (B) {
  'use strict';

  // vol = typical daily volatility of the sector factor
  B.SECTORS = {
    index: { name: 'Index', vol: 0 },
    ai: { name: 'Model Labs', vol: 0.022 },
    chip: { name: 'Silicon', vol: 0.018 },
    dc: { name: 'Compute Infrastructure', vol: 0.017 },
    power: { name: 'Power & Grid', vol: 0.013 },
    bank: { name: 'Banks', vol: 0.012 },
    lender: { name: 'Consumer Credit', vol: 0.018 },
    insurer: { name: 'Insurers', vol: 0.012 },
    defense: { name: 'Defense', vol: 0.013 },
    retail: { name: 'Retail', vol: 0.008 },
    haven: { name: 'Safe Havens', vol: 0.005 },
    fear: { name: 'Volatility', vol: 0 }
  };

  // The three legs the bubble stands on. When CASCADE cracks, these go together.
  B.AISTACK = ['ai', 'chip', 'dc'];
  B.FINANCIALS = ['bank', 'lender', 'insurer'];
  B.CASCADE = ['dc', 'lender', 'bank'];

  // vol = idiosyncratic daily vol; borrow = annual short borrow rate; htb = hard to borrow
  B.TICKERS = [
    { sym: 'INDX', name: 'Broad Market Index Fund', sector: 'index', beta: 1, vol: 0.0008, price: 512.40, spread: 0.0002, borrow: 0.005 },

    { sym: 'CRVS', name: 'Corvus Intelligence', sector: 'ai', beta: 1.55, vol: 0.024, price: 388.20, spread: 0.0005, borrow: 0.03 },
    { sym: 'HALO', name: 'Halcyon Mind Labs', sector: 'ai', beta: 1.70, vol: 0.031, price: 96.40, spread: 0.0016, borrow: 0.14, htb: true },

    { sym: 'THSI', name: 'Thorncrest Silicon', sector: 'chip', beta: 1.45, vol: 0.021, price: 244.75, spread: 0.0004, borrow: 0.02 },
    { sym: 'VYRN', name: 'Veyron Microsystems', sector: 'chip', beta: 1.30, vol: 0.018, price: 118.30, spread: 0.0005, borrow: 0.02 },

    { sym: 'BSTN', name: 'Bastion Compute Trust', sector: 'dc', beta: 1.35, vol: 0.019, price: 71.60, spread: 0.0009, borrow: 0.06 },
    { sym: 'CLDR', name: 'Calder Power & Grid', sector: 'power', beta: 0.85, vol: 0.013, price: 58.90, spread: 0.0006, borrow: 0.01 },
    { sym: 'KSTL', name: 'Kestrel Energy Partners', sector: 'power', beta: 0.95, vol: 0.016, price: 68.40, spread: 0.0006, borrow: 0.01 },

    { sym: 'HLST', name: 'Holloway Stern', sector: 'bank', beta: 1.30, vol: 0.013, price: 84.25, spread: 0.0005, borrow: 0.02 },
    { sym: 'RDGW', name: 'Ridgeway Trust', sector: 'bank', beta: 1.40, vol: 0.016, price: 52.10, spread: 0.0008, borrow: 0.04 },
    { sym: 'FRLN', name: 'Fairline Credit', sector: 'lender', beta: 1.50, vol: 0.023, price: 27.40, spread: 0.0014, borrow: 0.30, htb: true },
    { sym: 'AMVL', name: 'Ambervale Re', sector: 'insurer', beta: 1.20, vol: 0.013, price: 76.80, spread: 0.0007, borrow: 0.03 },

    { sym: 'VNTR', name: 'Vantor Defense Systems', sector: 'defense', beta: 0.80, vol: 0.014, price: 163.50, spread: 0.0005, borrow: 0.01 },
    { sym: 'BLWT', name: 'Bellwether Stores', sector: 'retail', beta: 0.70, vol: 0.008, price: 91.20, spread: 0.0004, borrow: 0.01 },

    { sym: 'AURX', name: 'Aurex Bullion Trust', sector: 'haven', beta: -0.25, vol: 0.006, price: 231.60, spread: 0.0003, borrow: 0.01 },
    { sym: 'TBND', name: 'Long Treasury Bond Fund', sector: 'haven', beta: -0.20, vol: 0.003, price: 98.10, spread: 0.0002, borrow: 0.01 },

    { sym: 'FEAR', name: 'Fear Index Tracker', sector: 'fear', beta: 0, vol: 0, price: 15.2, spread: 0.002, borrow: 0.3 }
  ];

  // mu = typical daily index drift, vol = index daily vol, fear = resting fear level
  B.REGIMES = {
    melt: { name: 'Melt-Up', mu: 0.007, vol: 0.010, fear: 12 },
    bubble: { name: 'Euphoria', mu: 0.005, vol: 0.009, fear: 13 },
    bull: { name: 'Bull', mu: 0.003, vol: 0.009, fear: 15 },
    chop: { name: 'Choppy', mu: 0.0, vol: 0.013, fear: 20 },
    bear: { name: 'Bear', mu: -0.006, vol: 0.019, fear: 28 },
    panic: { name: 'Panic', mu: -0.02, vol: 0.031, fear: 44 },
    recovery: { name: 'Relief', mu: 0.008, vol: 0.021, fear: 30 }
  };
})(window.BTB);
