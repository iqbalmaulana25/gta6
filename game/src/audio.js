// Sound made from oscillators and noise alone — no audio files, so the game stays fully
// offline. A lazy AudioContext wakes on the first user gesture; every call is guarded, so a
// browser that refuses audio simply plays the game silent. The score is a slow synthwave
// loop in A minor: a pulsing bass, soft pads and a sparse lead, scheduled bar by bar.

const BASS_LINE = [55, 0, 55, 55, 0, 55, 0, 65.41, 0, 55, 0, 55, 55, 0, 49, 0];
const PAD_CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [164.81, 196, 246.94],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let musicTimer = null;
  let bar = 0;

  function wake() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!wake()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq = 1200, when = 0) {
    if (!wake()) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function playBar() {
    if (!ctx) return;
    const beat = 0.24;
    for (let i = 0; i < 16; i += 1) {
      const f = BASS_LINE[i];
      if (f) tone(f, beat * 0.9, 'triangle', 0.16, i * beat);
      if (i % 2 === 0) noise(0.03, 0.03, 6000, i * beat);
    }
    const chord = PAD_CHORDS[bar % PAD_CHORDS.length];
    for (const f of chord) tone(f, beat * 16, 'sine', 0.045, 0);
    if (bar % 2 === 1) {
      const lead = chord[2] * 2;
      tone(lead, beat * 2, 'sine', 0.05, beat * 4);
      tone(lead * 1.5, beat * 2, 'sine', 0.04, beat * 10);
    }
    bar += 1;
  }

  return {
    wake,
    /** Start (or keep) the engine hum; pitch follows the speed ratio 0..1. */
    engine(ratio, running) {
      if (!wake()) return;
      if (!running) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(52 + ratio * 118, ctx.currentTime, 0.06);
      engineGain.gain.setTargetAtTime(0.05 + ratio * 0.05, ctx.currentTime, 0.08);
    },
    /** The two-tone siren, on while the law is close and the player is wanted. */
    siren(on) {
      if (!wake()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'square';
        sirenGain.gain.value = 0.018;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        let high = false;
        sirenFlip = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.value = high ? 940 : 705;
        }, 380);
      } else if (!on && sirenOsc) {
        clearInterval(sirenFlip);
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    /** The dispatch radio: two clipped chirps and a breath of static. Rate drops the pitch
     * for the roadblock call, which is the one the player learns to dread. */
    dispatch(rate = 1) {
      tone(1240 * rate, 0.07, 'square', 0.08);
      tone(1240 * rate, 0.07, 'square', 0.08, 0.11);
      noise(0.05, 0.05, 2400, 0.02);
    },
    /** A two-tone car horn, for traffic that will not move and crowds that should. */
    horn() {
      tone(370, 0.28, 'square', 0.11);
      tone(466, 0.28, 'square', 0.09);
    },
    music(on) {
      if (!wake()) return;
      if (on && !musicTimer) {
        bar = 0;
        playBar();
        musicTimer = setInterval(playBar, 0.24 * 16 * 1000);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    shot() { noise(0.14, 0.32, 2600); tone(150, 0.08, 'square', 0.12, 0, 60); },
    alarm() { tone(880, 0.16, 'square', 0.1); tone(880, 0.16, 'square', 0.1, 0.22); tone(1174, 0.24, 'square', 0.1, 0.44); },
    punch() { noise(0.08, 0.25, 500); },
    hurt() { tone(110, 0.16, 'sawtooth', 0.16, 0, 55); },
    crash(big) { noise(big ? 0.4 : 0.2, big ? 0.4 : 0.22, 800); },
    pickup() { tone(880, 0.09, 'sine', 0.18); tone(1318, 0.14, 'sine', 0.16, 0.07); },
    cash() { tone(1046, 0.08, 'square', 0.1); tone(1568, 0.12, 'square', 0.1, 0.07); },
    mission() { tone(523, 0.12, 'triangle', 0.2); tone(659, 0.12, 'triangle', 0.2, 0.1); tone(784, 0.2, 'triangle', 0.22, 0.2); },
    fail() { tone(330, 0.18, 'triangle', 0.18, 0, 262); tone(262, 0.3, 'triangle', 0.18, 0.16, 196); },
    ui() { tone(660, 0.05, 'sine', 0.12); },
  };
}
