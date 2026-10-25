// Calculs de temps du séquenceur, sans dépendance au navigateur
// (testables avec `npm test`).

export const STEPS_PER_BAR = 16;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

// Durée d'un pas (une double-croche) en secondes.
export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

export function clampBpm(value) {
  const bpm = Math.round(Number(value));
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

export function nextStep(step) {
  return (step + 1) % STEPS_PER_BAR;
}

// Swing : les pas pairs (2, 4, 6… en comptant à partir de 1) sont
// retardés d'une fraction de pas. 0 = carré, 0,5 = presque ternaire.
export const MAX_SWING = 0.5;

export function clampSwing(value) {
  const swing = Number(value);
  if (!Number.isFinite(swing)) return 0;
  return Math.min(MAX_SWING, Math.max(0, swing));
}

export function swingOffset(step, bpm, swing) {
  return step % 2 === 1 ? clampSwing(swing) * stepDuration(bpm) : 0;
}

export function barDuration(bpm) {
  return STEPS_PER_BAR * stepDuration(bpm);
}
