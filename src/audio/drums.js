// Kit de batterie synthétisé, à la manière de la TR-808 (qui fabriquait
// ses sons avec des circuits analogiques, pas avec des samples).
// Chaque son est une fonction (ctx, sortie, temps, outils) qui programme
// ses oscillateurs et enveloppes à l'instant `time` de l'horloge audio.

function envelope(ctx, time, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + decay);
  return g;
}

function noise(ctx, tools, time, duration) {
  const src = ctx.createBufferSource();
  src.buffer = tools.noiseBuffer;
  src.start(time);
  src.stop(time + duration);
  return src;
}

function kick(ctx, out, time) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.08);
  const env = envelope(ctx, time, 1, 0.5);
  osc.connect(env).connect(out);
  osc.start(time);
  osc.stop(time + 0.55);
}

function snare(ctx, out, time, tools) {
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.value = 185;
  tone.connect(envelope(ctx, time, 0.5, 0.1)).connect(out);
  tone.start(time);
  tone.stop(time + 0.12);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  noise(ctx, tools, time, 0.22).connect(hp).connect(envelope(ctx, time, 0.55, 0.2)).connect(out);
}

function clap(ctx, out, time, tools) {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 0.8;
  const env = ctx.createGain();
  // Trois petits claquements rapprochés puis une queue : le "clap" de la 808.
  env.gain.setValueAtTime(0, time);
  for (const offset of [0, 0.011, 0.022]) {
    env.gain.setValueAtTime(0.9, time + offset);
    env.gain.exponentialRampToValueAtTime(0.1, time + offset + 0.009);
  }
  env.gain.setValueAtTime(0.7, time + 0.031);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  noise(ctx, tools, time, 0.26).connect(bp).connect(env).connect(out);
}

function hat(ctx, out, time, tools, decay) {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const env = envelope(ctx, time, 0.45, decay);
  noise(ctx, tools, time, decay + 0.02).connect(hp).connect(env).connect(out);
  return env;
}

function closedHat(ctx, out, time, tools) {
  // Le charley fermé coupe le charley ouvert, comme sur la vraie machine.
  if (tools.openHatEnv) {
    tools.openHatEnv.gain.cancelScheduledValues(time);
    tools.openHatEnv.gain.setTargetAtTime(0, time, 0.005);
    tools.openHatEnv = null;
  }
  hat(ctx, out, time, tools, 0.05);
}

function openHat(ctx, out, time, tools) {
  tools.openHatEnv = hat(ctx, out, time, tools, 0.4);
}

function tom(freq) {
  return (ctx, out, time) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, time + 0.3);
    osc.connect(envelope(ctx, time, 0.8, 0.35)).connect(out);
    osc.start(time);
    osc.stop(time + 0.4);
  };
}

function cowbell(ctx, out, time) {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 2;
  const env = envelope(ctx, time, 0.4, 0.3);
  bp.connect(env).connect(out);
  for (const freq of [540, 800]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.connect(bp);
    osc.start(time);
    osc.stop(time + 0.32);
  }
}

export const DRUM_KIT = [
  { id: 'bd', name: 'Grosse caisse', play: kick },
  { id: 'sd', name: 'Caisse claire', play: snare },
  { id: 'cp', name: 'Clap', play: clap },
  { id: 'ch', name: 'Charley fermé', play: closedHat },
  { id: 'oh', name: 'Charley ouvert', play: openHat },
  { id: 'lt', name: 'Tom grave', play: tom(110) },
  { id: 'ht', name: 'Tom aigu', play: tom(190) },
  { id: 'cb', name: 'Cloche', play: cowbell },
];

export function createDrumTools(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { noiseBuffer: buffer, openHatEnv: null };
}
