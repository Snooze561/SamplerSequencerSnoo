import { DRUM_KIT, createDrumTools } from './drums.js';
import { pitchToRate } from '../sequencer/kit-model.js';

// Relie les 8 pistes au moteur : une tranche de volume par piste, toutes
// branchées sur le volume général. Chaque piste joue soit son son 808
// intégré, soit un sample de la banque perso.
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
    const { ctx, master } = this.engine;
    this.tools = createDrumTools(ctx);
    this.channels = this.sounds.map(() => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    });
  }

  setVolume(track, value) {
    this.ensure();
    const g = this.channels[track].gain;
    g.setTargetAtTime(value, this.engine.ctx.currentTime, 0.01);
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
    if (slot?.sample) {
      // Un sample pas encore chargé est simplement sauté sur ce pas.
      const buffer = this.buffers.get(slot.sample);
      if (buffer) this.playSample(buffer, slot, this.channels[track], when);
      else this.loadSample(slot.sample).catch(() => {});
      return;
    }
    this.sounds[track].play(ctx, this.channels[track], when, this.tools);
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
