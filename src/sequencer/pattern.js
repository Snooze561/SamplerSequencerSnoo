// Modèle des patterns, sans dépendance au navigateur (testable avec `npm test`).

import { STEPS_PER_BAR, clampSwing } from '../audio/clock.js';
import { createKit, parseKit } from './kit-model.js';

export const TRACK_COUNT = 8;
export const PATTERN_COUNT = 8;
// Un morceau enchaîne jusqu'à 64 patterns (64 mesures).
export const MAX_SONG_LENGTH = 64;

export function createPattern() {
  return {
    steps: Array.from({ length: TRACK_COUNT }, () => Array(STEPS_PER_BAR).fill(false)),
    volumes: Array(TRACK_COUNT).fill(0.8),
    mutes: Array(TRACK_COUNT).fill(false),
  };
}

// Un rythme de départ pour entendre quelque chose dès le premier lancement.
export function createDemoPattern() {
  const p = createPattern();
  const on = (track, steps) => steps.forEach((s) => { p.steps[track][s] = true; });
  on(0, [0, 4, 8, 12]);
  on(1, [4, 12]);
  on(3, [0, 2, 4, 6, 8, 10, 12]);
  on(4, [14]);
  return p;
}

export function createBank() {
  const patterns = Array.from({ length: PATTERN_COUNT }, createPattern);
  patterns[0] = createDemoPattern();
  return {
    bpm: 120, swing: 0, current: 0, patterns, kit: createKit(TRACK_COUNT), song: [], songMode: false,
  };
}

export function toggleStep(pattern, track, step) {
  pattern.steps[track][step] = !pattern.steps[track][step];
  return pattern.steps[track][step];
}

export function clearPattern(pattern) {
  for (const row of pattern.steps) row.fill(false);
}

function isBoolGrid(steps) {
  return Array.isArray(steps) && steps.length === TRACK_COUNT
    && steps.every((row) => Array.isArray(row) && row.length === STEPS_PER_BAR
      && row.every((v) => typeof v === 'boolean'));
}

function isPattern(p) {
  return p && isBoolGrid(p.steps)
    && Array.isArray(p.volumes) && p.volumes.length === TRACK_COUNT
    && p.volumes.every((v) => typeof v === 'number' && v >= 0 && v <= 1)
    && Array.isArray(p.mutes) && p.mutes.length === TRACK_COUNT
    && p.mutes.every((v) => typeof v === 'boolean');
}

// Relit une banque sauvegardée ; repart d'une banque neuve si le fichier
// est absent ou abîmé, plutôt que de faire planter l'appli.
export function parseBank(json) {
  try {
    const bank = typeof json === 'string' ? JSON.parse(json) : json;
    if (!bank || !Array.isArray(bank.patterns) || bank.patterns.length !== PATTERN_COUNT
      || !bank.patterns.every(isPattern)) {
      return createBank();
    }
    const current = Number.isInteger(bank.current) && bank.current >= 0 && bank.current < PATTERN_COUNT
      ? bank.current : 0;
    const bpm = typeof bank.bpm === 'number' ? bank.bpm : 120;
    const song = Array.isArray(bank.song)
      ? bank.song.filter((i) => Number.isInteger(i) && i >= 0 && i < PATTERN_COUNT).slice(0, MAX_SONG_LENGTH)
      : [];
    return {
      bpm,
      swing: clampSwing(bank.swing),
      current,
      patterns: bank.patterns,
      kit: parseKit(bank.kit, TRACK_COUNT),
      song,
      songMode: bank.songMode === true,
    };
  } catch {
    return createBank();
  }
}
