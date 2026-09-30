// A stand-in for the Web Audio API, just thorough enough for the audio engines
// to build and schedule their graphs under Node. It records what was asked of
// it (start times, parameter automation) so tests can check the schedule
// without producing any sound.
'use strict';

function makeParam(ctx, def) {
  const p = {
    value: def || 0, events: [],
    setValueAtTime(v, t) { p.events.push(['set', v, t]); return p; },
    linearRampToValueAtTime(v, t) { p.events.push(['lin', v, t]); return p; },
    exponentialRampToValueAtTime(v, t) { p.events.push(['exp', v, t]); return p; },
    setTargetAtTime(v, t, tc) { p.events.push(['target', v, t, tc]); return p; },
    setValueCurveAtTime(c, t, d) { p.events.push(['curve', c, t, d]); return p; },
    cancelScheduledValues(t) { p.events.push(['cancel', t]); return p; }
  };
  return p;
}

function makeContext(o) {
  o = o || {};
  const ctx = { currentTime: 0, sampleRate: o.sampleRate || 44100, state: 'running', nodes: [], resume() { return Promise.resolve(); } };
  const node = (kind, extra) => {
    const n = Object.assign({
      kind, outputs: [],
      connect(dest) { n.outputs.push(dest); return dest; },
      disconnect() { n.outputs = []; n.disconnected = true; }
    }, extra || {});
    ctx.nodes.push(n);
    return n;
  };
  ctx.node = node;
  ctx.destination = node('destination');
  ctx.createGain = () => node('gain', { gain: makeParam(ctx, 1), channelCount: 2, channelCountMode: 'max' });
  ctx.createOscillator = () => node('osc', {
    type: 'sine', frequency: makeParam(ctx, 440), detune: makeParam(ctx, 0),
    start(t) { this.startT = t; }, stop(t) { this.stopT = t; }, setPeriodicWave(w) { this.wave = w; }
  });
  ctx.createBufferSource = () => node('bufsrc', { buffer: null, loop: false, start(...a) { this.startArgs = a; }, stop() {} });
  ctx.createBuffer = (ch, len, sr) => {
    const data = [];
    const b = { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData(i) { return data[i] || (data[i] = new Float32Array(len)); } };
    return b;
  };
  ctx.createBiquadFilter = () => node('biquad', { type: 'lowpass', frequency: makeParam(ctx, 350), Q: makeParam(ctx, 1), detune: makeParam(ctx, 0), gain: makeParam(ctx, 0) });
  ctx.createConvolver = () => node('convolver', { normalize: true, buffer: null });
  ctx.createWaveShaper = () => node('shaper', { curve: null, oversample: 'none' });
  ctx.createStereoPanner = () => node('panner', { pan: makeParam(ctx, 0) });
  ctx.createDelay = () => node('delay', { delayTime: makeParam(ctx, 0) });
  ctx.createChannelMerger = () => node('merger');
  ctx.createPeriodicWave = (re, im, opts) => ({ re, im, opts });
  return ctx;
}

module.exports = { makeContext, makeParam };
