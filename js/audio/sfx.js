// Every sound is synthesized with WebAudio. No audio files.
(function (B) {
  'use strict';
  let ctx = null, master = null, noiseBuf = null;
  const S = { vol: 0.6, enabled: true };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = S.vol;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, o) {
    o = o || {};
    const c = ensure();
    if (!c || !S.enabled) return;
    const t0 = c.currentTime + (o.when || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, o) {
    o = o || {};
    const c = ensure();
    if (!c || !S.enabled) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + (o.when || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter || 800;
    const g = c.createGain();
    g.gain.setValueAtTime(o.gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  function bellRing(times) {
    for (let i = 0; i < times; i++) {
      const w = i * 0.26;
      [[587, 0.14], [1185, 0.08], [1760, 0.05], [2349, 0.03]].forEach(([f, g]) =>
        tone(f, 1.3, { gain: g, when: w, attack: 0.002, type: 'sine' }));
    }
  }

  B.SFX = {
    unlock() { ensure(); },
    setVolume(v) { S.vol = v; if (master) master.gain.value = v; },
    setEnabled(e) { S.enabled = e; },
    bell() { bellRing(7); },
    closeBell() { bellRing(5); tone(80, 1.6, { gain: 0.15, type: 'triangle', when: 0.1 }); },
    fill(side) {
      tone(side > 0 ? 880 : 620, 0.07, { type: 'triangle', gain: 0.13 });
      tone(side > 0 ? 1320 : 460, 0.08, { type: 'triangle', gain: 0.1, when: 0.06 });
    },
    cash() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', gain: 0.08, when: i * 0.05 })); },
    loss() { tone(300, 0.35, { type: 'sawtooth', gain: 0.06, slide: 140 }); },
    reject() { tone(170, 0.2, { type: 'square', gain: 0.07 }); },
    click() { tone(1800, 0.02, { type: 'square', gain: 0.03 }); },
    tick() { tone(2400, 0.012, { type: 'square', gain: 0.025 }); },
    news() { tone(1250, 0.05, { gain: 0.05 }); tone(1650, 0.05, { gain: 0.05, when: 0.06 }); },
    alarm() { for (let i = 0; i < 6; i++) tone(i % 2 ? 740 : 988, 0.13, { type: 'square', gain: 0.07, when: i * 0.14 }); },
    ring() {
      [0, 0.45].forEach((w) => { tone(440, 0.4, { gain: 0.06, when: w }); tone(480, 0.4, { gain: 0.06, when: w }); });
    },
    heartbeat(intensity) {
      const k = B.clamp(intensity, 0.2, 1);
      tone(58, 0.12, { gain: 0.3 * k });
      tone(52, 0.14, { gain: 0.22 * k, when: 0.17 });
    },
    crash() { noise(1.8, { gain: 0.35, filter: 380 }); tone(120, 1.6, { type: 'sawtooth', gain: 0.09, slide: 35 }); },
    halt() { tone(520, 0.6, { type: 'square', gain: 0.06 }); tone(390, 0.8, { type: 'square', gain: 0.06, when: 0.6 }); },
    panic() { noise(2.5, { gain: 0.25, filter: 200 }); tone(40, 2.5, { gain: 0.3, type: 'sine' }); },
    choice() { tone(392, 0.25, { gain: 0.08, type: 'triangle' }); tone(523, 0.35, { gain: 0.08, type: 'triangle', when: 0.15 }); }
  };
})(window.BTB);
