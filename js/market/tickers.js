// Fictional universe: sectors, tickers, market regimes.
(function (B) {
  'use strict';

  // vol = typical daily volatility of the sector factor
  B.SECTORS = {
    index: { name: 'Index', vol: 0 },
    bank: { name: 'Banks', vol: 0.011 },
    lender: { name: 'Mortgage Lenders', vol: 0.018 },
    builder: { name: 'Homebuilders', vol: 0.014 },
    insurer: { name: 'Insurers', vol: 0.012 },
    gse: { name: 'Mortgage Agencies', vol: 0.011 },
    tech: { name: 'Tech', vol: 0.012 },
    retail: { name: 'Retail', vol: 0.008 },
    energy: { name: 'Energy', vol: 0.012 },
    haven: { name: 'Safe Havens', vol: 0.005 },
    fear: { name: 'Volatility', vol: 0 }
  };
  B.FINANCIALS = ['bank', 'lender', 'insurer', 'gse'];
  B.HOUSING = ['lender', 'builder', 'gse'];

  // vol = idiosyncratic daily vol; borrow = annual short borrow rate
  B.TICKERS = [
    { sym: 'INDX', name: 'Broad Market Index Fund', sector: 'index', beta: 1, vol: 0.0008, price: 512.40, spread: 0.0002, borrow: 0.005 },
    { sym: 'LRMR', name: 'Lorimer Brothers Holdings', sector: 'bank', beta: 1.35, vol: 0.012, price: 61.20, spread: 0.0006, borrow: 0.02 },
    { sym: 'HVNB', name: 'Halbrook & Vance', sector: 'bank', beta: 1.25, vol: 0.011, price: 88.75, spread: 0.0006, borrow: 0.02 },
    { sym: 'GSTN', name: 'Goldstone Capital Group', sector: 'bank', beta: 1.15, vol: 0.009, price: 212.30, spread: 0.0004, borrow: 0.01 },
    { sym: 'NSTG', name: 'NestEgg Home Lending', sector: 'lender', beta: 1.6, vol: 0.02, price: 34.10, spread: 0.0012, borrow: 0.25, htb: true },
    { sym: 'FLXR', name: 'FlexRate Financial', sector: 'lender', beta: 1.5, vol: 0.018, price: 22.65, spread: 0.0012, borrow: 0.15 },
    { sym: 'KBLD', name: 'Kingsbridge Homes', sector: 'builder', beta: 1.3, vol: 0.014, price: 47.80, spread: 0.0008, borrow: 0.04 },
    { sym: 'SENT', name: 'Sentinel Re Group', sector: 'insurer', beta: 1.2, vol: 0.012, price: 71.45, spread: 0.0007, borrow: 0.03 },
    { sym: 'FHMC', name: 'Federal Home Mortgage Corp', sector: 'gse', beta: 1.1, vol: 0.012, price: 58.30, spread: 0.0007, borrow: 0.03 },
    { sym: 'NOVA', name: 'Novaline AI', sector: 'tech', beta: 1.4, vol: 0.016, price: 318.90, spread: 0.0004, borrow: 0.02 },
    { sym: 'PKCL', name: 'Peak Cloud Systems', sector: 'tech', beta: 1.2, vol: 0.012, price: 142.15, spread: 0.0004, borrow: 0.01 },
    { sym: 'MRTM', name: 'MartMax Stores', sector: 'retail', beta: 0.75, vol: 0.008, price: 96.40, spread: 0.0004, borrow: 0.01 },
    { sym: 'PTRX', name: 'PetroRex Energy', sector: 'energy', beta: 0.9, vol: 0.012, price: 74.25, spread: 0.0005, borrow: 0.01 },
    { sym: 'GLDX', name: 'Aurum Gold Trust', sector: 'haven', beta: -0.25, vol: 0.006, price: 231.60, spread: 0.0003, borrow: 0.01 },
    { sym: 'TBND', name: 'Long Treasury Bond Fund', sector: 'haven', beta: -0.2, vol: 0.003, price: 98.10, spread: 0.0002, borrow: 0.01 },
    { sym: 'FEAR', name: 'Fear Index Tracker', sector: 'fear', beta: 0, vol: 0, price: 15.2, spread: 0.002, borrow: 0.3 }
  ];

  // mu = typical daily index drift, vol = index daily vol, fear = resting fear level
  B.REGIMES = {
    bubble: { name: 'Euphoria', mu: 0.005, vol: 0.009, fear: 13 },
    bull: { name: 'Bull', mu: 0.003, vol: 0.009, fear: 15 },
    chop: { name: 'Choppy', mu: 0.0, vol: 0.012, fear: 19 },
    bear: { name: 'Bear', mu: -0.006, vol: 0.018, fear: 27 },
    panic: { name: 'Panic', mu: -0.02, vol: 0.03, fear: 42 },
    recovery: { name: 'Relief', mu: 0.008, vol: 0.02, fear: 30 }
  };
})(window.BTB);
