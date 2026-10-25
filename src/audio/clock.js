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
