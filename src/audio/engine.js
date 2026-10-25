import { STEPS_PER_BAR, stepDuration, clampBpm, nextStep } from './clock.js';

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
    this.bpm = 120;
    this.playing = false;
    this.metronome = true;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.stepListeners = [];
    // Pas programmés mais pas encore entendus, pour synchroniser l'affichage.
    this.pending = [];
    // Appelé à chaque pas avec (step, time) : les pistes s'y brancheront.
    this.onStep = null;
  }

  ensureContext() {
    if (this.ctx) return;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    requestAnimationFrame(() => this.drawLoop());
  }

  setBpm(value) {
    this.bpm = clampBpm(value);
    return this.bpm;
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
      this.playStep(this.currentStep, this.nextStepTime);
      this.pending.push({ step: this.currentStep, time: this.nextStepTime });
      this.nextStepTime += stepDuration(this.bpm);
      this.currentStep = nextStep(this.currentStep);
    }
  }

  playStep(step, time) {
    if (this.metronome && step % 4 === 0) {
      this.click(time, step === 0);
    }
    if (this.onStep) this.onStep(step, time);
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

  emitStep(step) {
    for (const listener of this.stepListeners) listener(step);
  }

  drawLoop() {
    const now = this.ctx.currentTime;
    let shown = null;
    while (this.pending.length && this.pending[0].time <= now) {
      shown = this.pending.shift().step;
    }
    if (shown !== null) this.emitStep(shown);
    requestAnimationFrame(() => this.drawLoop());
  }
}

export { STEPS_PER_BAR };
