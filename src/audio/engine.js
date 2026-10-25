import {
  STEPS_PER_BAR, stepDuration, clampBpm, nextStep, swingOffset, clampSwing,
} from './clock.js';
import { createEffects, createMaster } from './effects.js';

// Programmation "en avance" : un timer JavaScript réveille le moteur
// toutes les 25 ms, et le moteur place dans l'horloge audio tous les pas
// qui tombent dans les 100 ms à venir. Le son reste ainsi parfaitement
// calé même si l'interface est occupée.
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.fx = null;
    this.bpm = 120;
    this.swing = 0;
    // Numéro de la mesure en cours depuis le dernier PLAY (pour le mode morceau).
    this.bar = 0;
    this.playing = false;
    this.metronome = true;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.stepListeners = [];
    // Pas programmés mais pas encore entendus, pour synchroniser l'affichage.
    this.pending = [];
    // Appelé à chaque pas avec (step, time, bar) : les pistes s'y branchent.
    this.onStep = null;
  }

  ensureContext() {
    if (this.ctx) return;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = createMaster(this.ctx, 0.8);
    this.fx = createEffects(this.ctx, this.master, this.bpm);
    requestAnimationFrame(() => this.drawLoop());
  }

  setBpm(value) {
    this.bpm = clampBpm(value);
    if (this.fx) this.fx.setTempo(this.bpm);
    return this.bpm;
  }

  setSwing(value) {
    this.swing = clampSwing(value);
    return this.swing;
  }

  setMasterVolume(value) {
    this.ensureContext();
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  async start() {
    this.ensureContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.bar = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.pending = [];
    this.emitStep(-1);
  }

  toggle() {
    return this.playing ? (this.stop(), false) : (this.start(), true);
  }

  schedule() {
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      const time = this.nextStepTime + swingOffset(this.currentStep, this.bpm, this.swing);
      this.playStep(this.currentStep, time);
      this.pending.push({ step: this.currentStep, time, bar: this.bar });
      this.nextStepTime += stepDuration(this.bpm);
      this.currentStep = nextStep(this.currentStep);
      if (this.currentStep === 0) this.bar++;
    }
  }

  playStep(step, time) {
    if (this.metronome && step % 4 === 0) {
      this.click(time, step === 0);
    }
    if (this.onStep) this.onStep(step, time, this.bar);
  }

  click(time, accent) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    env.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(env).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  onStepChange(listener) {
    this.stepListeners.push(listener);
  }

  emitStep(step, bar = 0) {
    for (const listener of this.stepListeners) listener(step, bar);
  }

  drawLoop() {
    const now = this.ctx.currentTime;
    let shown = null;
    while (this.pending.length && this.pending[0].time <= now) {
      shown = this.pending.shift();
    }
    if (shown !== null) this.emitStep(shown.step, shown.bar);
    requestAnimationFrame(() => this.drawLoop());
  }
}

export { STEPS_PER_BAR };
