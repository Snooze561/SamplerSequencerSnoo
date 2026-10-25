// Réglages des 8 pistes du kit, partagés par tous les patterns
// (comme sur une boîte à rythmes : on change de rythme, pas de sons).
// Une piste sans sample joue son son 808 intégré.

export const MIN_PITCH = -12;
export const MAX_PITCH = 12;
// Écart minimal entre début et fin, pour ne jamais avoir un sample vide.
export const MIN_LENGTH = 0.01;

export function createSlot() {
  // reverb / delay : quantité de son envoyée vers les effets (0 à 1).
  return { sample: null, start: 0, end: 1, pitch: 0, reverb: 0, delay: 0 };
}

export function createKit(trackCount) {
  return Array.from({ length: trackCount }, createSlot);
}

// Changer de son remet début, fin et hauteur à zéro, mais garde les effets.
export function setSample(slot, name) {
  Object.assign(slot, { sample: name, start: 0, end: 1, pitch: 0 });
}

export function resetToBuiltIn(slot) {
  setSample(slot, null);
}

export function setSend(slot, effect, value) {
  slot[effect] = Math.min(1, Math.max(0, Number(value) || 0));
  return slot[effect];
}

export function setStart(slot, value) {
  slot.start = Math.min(Math.max(0, Number(value)), slot.end - MIN_LENGTH);
  return slot.start;
}

export function setEnd(slot, value) {
  slot.end = Math.max(Math.min(1, Number(value)), slot.start + MIN_LENGTH);
  return slot.end;
}

export function setPitch(slot, value) {
  slot.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, Math.round(Number(value)) || 0));
  return slot.pitch;
}

// Un demi-ton plus haut = lecture 2^(1/12) fois plus rapide.
export function pitchToRate(pitch) {
  return 2 ** (pitch / 12);
}

function isSlot(s) {
  return s && (s.sample === null || (typeof s.sample === 'string' && s.sample.length > 0))
    && typeof s.start === 'number' && typeof s.end === 'number'
    && s.start >= 0 && s.end <= 1 && s.end - s.start >= MIN_LENGTH - 1e-9
    && Number.isInteger(s.pitch) && s.pitch >= MIN_PITCH && s.pitch <= MAX_PITCH
    && [s.reverb, s.delay].every((v) => typeof v === 'number' && v >= 0 && v <= 1);
}

// Les banques des versions précédentes n'ont pas de kit, ou pas d'effets :
// on complète avec les valeurs par défaut.
export function parseKit(kit, trackCount) {
  if (!Array.isArray(kit) || kit.length !== trackCount) return createKit(trackCount);
  return kit.map((s) => {
    const slot = s && typeof s === 'object' ? { ...createSlot(), ...s } : null;
    return isSlot(slot) ? slot : createSlot();
  });
}

// Quand un sample est supprimé de la banque, les pistes qui l'utilisaient
// reviennent à leur son 808.
export function forgetSample(kit, name) {
  for (const slot of kit) {
    if (slot.sample === name) resetToBuiltIn(slot);
  }
}
