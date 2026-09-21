// The stress meter (0-100). Pressure pushes it up, calm lets it bleed off.
// Its effects (shake, vignette, fat fingers, panic attack) are applied by the game/UI.
(function (B) {
  'use strict';

  class Stress {
    constructor(rate) {
      this.rate = rate || 1;
      this.v = 0;
      this.peak = 0;
    }
    startDay() {
      this.v *= 0.35; // a night's sleep helps, a little
      this.peak = this.v;
    }
    spike(n) {
      this.v = B.clamp(this.v + n * (n > 0 ? this.rate : 1), 0, 100);
      if (this.v > this.peak) this.peak = this.v;
    }
    update(dt, g) {
      const b = g.broker, m = g.market;
      const eq = b.equity(), start = Math.max(1, b.dayStartEquity);
      let p = 0;
      p += Math.max(0, (b.dayPeak - eq) / start) * 300;                 // drawdown from today's high
      p += (b.stockGross() / Math.max(1, eq * b.rules.maxLev)) * 5;       // leverage used
      if (b.mc) p += 20;                                                   // margin call
      if (g.interrupts && g.interrupts.ringing) p += 5;                    // phone ringing
      if (g.quota > 0 && m.t > 300 && eq - start < g.quota) p += (m.t - 300) / 90 * 7; // behind quota late
      if (m.t > 380) p += 4;                                               // closing seconds
      p += Math.abs(m.indexMove(5)) * 900;                                 // tape is moving fast
      if (m.halt) p += 6;
      const calm = b.isFlat() ? 3.2 : 1.0;
      this.v = B.clamp(this.v + (p * 0.12 * this.rate - calm) * dt, 0, 100);
      if (this.v > this.peak) this.peak = this.v;
    }
    level() { return this.v / 100; }
    fatFingerChance() {
      if (this.v < 60) return 0;
      return Math.pow((this.v - 60) / 40, 2) * 0.25;
    }
  }

  B.Stress = Stress;
})(window.BTB);
