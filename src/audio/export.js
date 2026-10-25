import { STEPS_PER_BAR, stepDuration, swingOffset, barDuration } from './clock.js';
import { createEffects, createMaster } from './effects.js';
import { DrumKit } from './kit.js';
import { encodeWav } from './wav.js';

const SAMPLE_RATE = 44100;
// Quelques secondes de plus à la fin, pour laisser la réverb et le delay s'éteindre.
const TAIL_SECONDS = 3;

// Joue les mesures demandées "hors ligne" (aussi vite que possible, sans
// passer par les haut-parleurs) avec exactement les mêmes sons et effets
// qu'en direct, et renvoie le résultat en WAV.
export async function renderWav({ bank, bars, masterVolume, liveKit }) {
  const length = Math.ceil((bars.length * barDuration(bank.bpm) + TAIL_SECONDS) * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const master = createMaster(ctx, masterVolume);
  const offline = { ctx, master, fx: createEffects(ctx, master, bank.bpm), ensureContext() {} };

  // Les samples déjà décodés en direct servent tels quels.
  await Promise.all(bank.kit.filter((s) => s.sample).map((s) => liveKit.loadSample(s.sample).catch(() => null)));
  const kit = new DrumKit(offline, liveKit.readSample);
  kit.slots = bank.kit;
  kit.buffers = liveKit.buffers;
  kit.ensure();

  bars.forEach((patternIndex, bar) => {
    const pattern = bank.patterns[patternIndex];
    const barStart = bar * barDuration(bank.bpm);
    pattern.volumes.forEach((v, t) => kit.setVolumeAt(t, v, barStart));
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const time = barStart + step * stepDuration(bank.bpm) + swingOffset(step, bank.bpm, bank.swing);
      for (let t = 0; t < pattern.steps.length; t++) {
        if (pattern.steps[t][step] && !pattern.mutes[t]) kit.trigger(t, time);
      }
    }
  });

  const rendered = await ctx.startRendering();
  return encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], SAMPLE_RATE);
}
