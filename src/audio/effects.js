import { stepDuration } from './clock.js';

// Effets partagés par toutes les pistes : chaque piste y envoie plus ou
// moins de son (réglage RÉVERB / DELAY du panneau Sampler).

// Réverbération : on fabrique la "réponse d'une salle" avec un bruit qui
// s'éteint doucement, puis le ConvolverNode l'applique au son.
function createImpulse(ctx, seconds = 2.2, decay = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

// Le delay répète le son toutes les 3 doubles-croches (croche pointée),
// calé sur le tempo, en s'éteignant et en s'assombrissant peu à peu.
const DELAY_STEPS = 3;

export function createEffects(ctx, output, bpm) {
  const reverbIn = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulse(ctx);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.9;
  reverbIn.connect(convolver).connect(reverbOut).connect(output);

  const delayIn = ctx.createGain();
  const delay = ctx.createDelay(4);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3500;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.7;
  delayIn.connect(delay);
  delay.connect(tone).connect(feedback).connect(delay);
  tone.connect(delayOut).connect(output);

  function setTempo(newBpm) {
    delay.delayTime.setTargetAtTime(DELAY_STEPS * stepDuration(newBpm), ctx.currentTime, 0.02);
  }
  delay.delayTime.value = DELAY_STEPS * stepDuration(bpm);

  return { reverbIn, delayIn, setTempo };
}

// Sortie générale : volume, puis un limiteur qui évite que le son sature
// quand plusieurs pistes tapent en même temps (en direct comme à l'export).
export function createMaster(ctx, volume) {
  const master = ctx.createGain();
  master.gain.value = volume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 3;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master.connect(limiter).connect(ctx.destination);
  return master;
}
