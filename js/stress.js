// Stress 2.0. Pressure degrades clarity in stages before it removes control.
// Panic attacks are brief, recoverable and followed by resistance so a bad tape
// cannot trap the player in a chain of lockouts.
(function (B) {
  'use strict';

  class Stress {
    constructor(rate) {
      this.rate = rate || 1;
      this.v = 0;
      this.peak = 0;
      this.cooldown = 0;       // game-minutes until an ordinary panic can recur
      this.resistance = 0;     // 0..1, softens incoming stress after an attack
      this.panicCount = 0;
      this.catastropheReady = true; // one true-disaster cooldown bypass per day
    }

    startDay(carry) {
      this.v *= carry == null ? 0.30 : B.clamp(carry, 0, 1);
      this.peak = this.v;
      this.cooldown = 0;
      this.resistance = Math.max(this.resistance * 0.35, 0);
      this.panicCount = 0;
      this.catastropheReady = true;
    }

    spike(n) {
      const gain = n > 0 ? this.rate * (1 - this.resistance * 0.42) : 1;
      this.v = B.clamp(this.v + n * gain, 0, 100);
      if (this.cooldown > 0 && n > 0) this.v = Math.min(this.v, 97);
      if (this.v > this.peak) this.peak = this.v;
    }

    update(dt, g) {
      const b = g.broker, m = g.market;
      const eq = b.equity(), start = Math.max(1, b.dayStartEquity);
      const pnl = eq - start;
      let p = 0;

      // Pressure has firm ceilings. A six-figure swing should be dangerous, not
      // an automatic minutes-long lockout.
      p += Math.min(42, Math.max(0, (b.dayPeak - eq) / start) * 220);
      p += Math.min(5, (b.stockGross() / Math.max(1, eq * b.rules.maxLev)) * 4.5);
      if (b.mc) p += 18;
      if (g.interrupts && g.interrupts.ringing) p += 4;
      if (g.quota > 0 && m.t > 285 && pnl < g.quota) {
        const gap = B.clamp((g.quota - pnl) / Math.max(1, g.quota), 0, 1.5);
        p += B.clamp((m.t - 285) / 105, 0, 1) * gap * 4.5;
      }
      if (m.t > 380) p += 3;
      p += Math.min(28, Math.abs(m.indexMove(5)) * 720);
      if (m.halt) p += 5;

      const calm = (b.isFlat() ? 4.0 : (pnl >= g.quota && g.quota > 0 ? 2.2 : 1.35)) * (g.mode && g.mode.calmMult ? g.mode.calmMult() : 1);
      this.v = B.clamp(this.v + (p * 0.105 * this.rate - calm) * dt, 0, 100);
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.resistance = Math.max(0, this.resistance - dt / 210);
      if (this.cooldown > 0) this.v = Math.min(this.v, 97);
      if (this.v > this.peak) this.peak = this.v;
    }

    level() { return this.v / 100; }

    stage() {
      if (this.v >= 88) return { id: 'critical', label: 'CRITICAL', rank: 3 };
      if (this.v >= 70) return { id: 'tunnel', label: 'TUNNEL', rank: 2 };
      if (this.v >= 45) return { id: 'loaded', label: 'LOADED', rank: 1 };
      return { id: 'steady', label: 'STEADY', rank: 0 };
    }

    fatFingerChance() {
      if (this.v < 68) return 0;
      return Math.pow((this.v - 68) / 32, 2) * 0.12;
    }

    canPanic(catastrophic) {
      if (this.v < (catastrophic ? 93 : 99.5)) return false;
      if (catastrophic) return this.catastropheReady;
      return this.cooldown <= 0;
    }

    beginPanic(catastrophic) {
      if (!this.canPanic(catastrophic)) return false;
      this.panicCount++;
      this.cooldown = catastrophic ? 62 : 48;
      this.resistance = Math.max(this.resistance, catastrophic ? 0.72 : 0.58);
      if (catastrophic) this.catastropheReady = false;
      this.v = catastrophic ? 94 : 91;
      return true;
    }

    recover(interactive) {
      this.v = Math.min(this.v, interactive ? 56 : 68);
      this.resistance = Math.max(this.resistance, interactive ? 0.82 : 0.62);
    }

    serialize() {
      return {
        v: this.v, peak: this.peak, cooldown: this.cooldown,
        resistance: this.resistance, panicCount: this.panicCount,
        catastropheReady: this.catastropheReady
      };
    }

    restore(s) {
      s = s || {};
      this.v = s.v || 0;
      this.peak = s.peak || this.v;
      this.cooldown = s.cooldown || 0;
      this.resistance = s.resistance || 0;
      this.panicCount = s.panicCount || 0;
      this.catastropheReady = s.catastropheReady !== false;
    }
  }

  B.Stress = Stress;
})(window.BTB);
