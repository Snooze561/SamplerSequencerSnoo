import { DRUM_KIT, createDrumTools } from './drums.js';
import { pitchToRate } from '../sequencer/kit-model.js';

// Relie les 8 pistes au moteur. Chaque piste a sa tranche : un volume,
// puis deux envois vers les effets (réverb, delay), comme sur une table
// de mixage. Chaque piste joue soit son son 808 intégré, soit un sample
// de la banque perso.
//
// `engine` fournit { ctx, master, fx, ensureContext() } : le vrai moteur
// pour jouer en direct, ou un contexte hors ligne pour l'export WAV.
export class DrumKit {
  constructor(engine, readSample) {
    this.engine = engine;
    this.readSample = readSample;
    this.sounds = DRUM_KIT;
    this.slots = null;
    this.channels = null;
    this.tools = null;
    // Samples déjà décodés, par nom de fichier.
    this.buffers = new Map();
    this.loading = new Map();
  }

  ensure() {
    if (this.channels) return;
    this.engine.ensureContext();
    const { ctx, master, fx } = this.engine;
    this.tools = createDrumTools(ctx);
    this.channels = this.sounds.map(() => {
      const volume = ctx.createGain();
      const reverb = ctx.createGain();
      const delay = ctx.createGain();
      reverb.gain.value = 0;
      delay.gain.value = 0;
      volume.connect(master);
      volume.connect(reverb).connect(fx.reverbIn);
      volume.connect(delay).connect(fx.delayIn);
      return { volume, reverb, delay };
    });
    this.updateSends();
  }

  setVolume(track, value) {
    this.ensure();
    this.channels[track].volume.gain.setTargetAtTime(value, this.engine.ctx.currentTime, 0.01);
  }

  setVolumeAt(track, value, time) {
    this.ensure();
    this.channels[track].volume.gain.setValueAtTime(value, time);
  }

  // Recopie les réglages réverb / delay des pistes dans le mixage.
  updateSends() {
    if (!this.channels || !this.slots) return;
    const now = this.engine.ctx.currentTime;
    this.slots.forEach((slot, t) => {
      this.channels[t].reverb.gain.setTargetAtTime(slot.reverb, now, 0.01);
      this.channels[t].delay.gain.setTargetAtTime(slot.delay, now, 0.01);
    });
  }

  // Décode un sample une seule fois, même si plusieurs pistes le demandent
  // en même temps.
  loadSample(name) {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name));
    if (!this.loading.has(name)) {
      this.engine.ensureContext();
      const job = this.readSample(name)
        .then((data) => this.engine.ctx.decodeAudioData(data))
        .then((buffer) => {
          this.buffers.set(name, buffer);
          return buffer;
        })
        .finally(() => this.loading.delete(name));
      this.loading.set(name, job);
    }
    return this.loading.get(name);
  }

  forget(name) {
    this.buffers.delete(name);
  }

  trigger(track, time) {
    this.ensure();
    const { ctx } = this.engine;
    const when = time ?? ctx.currentTime;
    const slot = this.slots?.[track];
    const out = this.channels[track].volume;
    if (slot?.sample) {
      // Un sample pas encore chargé est simplement sauté sur ce pas.
      const buffer = this.buffers.get(slot.sample);
      if (buffer) this.playSample(buffer, slot, out, when);
      else this.loadSample(slot.sample).catch(() => {});
      return;
    }
    this.sounds[track].play(ctx, out, when, this.tools);
  }

  playSample(buffer, slot, out, time) {
    const src = this.engine.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pitchToRate(slot.pitch);
    src.connect(out);
    const offset = slot.start * buffer.duration;
    src.start(time, offset, (slot.end - slot.start) * buffer.duration);
  }
}
