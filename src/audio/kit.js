import { DRUM_KIT, createDrumTools } from './drums.js';

// Relie les 8 sons du kit au moteur : une tranche de volume par piste,
// toutes branchées sur le volume général.
export class DrumKit {
  constructor(engine) {
    this.engine = engine;
    this.sounds = DRUM_KIT;
    this.channels = null;
    this.tools = null;
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

  trigger(track, time) {
    this.ensure();
    const { ctx } = this.engine;
    this.sounds[track].play(ctx, this.channels[track], time ?? ctx.currentTime, this.tools);
  }
}
