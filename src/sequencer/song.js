// Mode morceau : une liste de patterns joués l'un après l'autre,
// une mesure chacun. Sans dépendance au navigateur (testable).

import { MAX_SONG_LENGTH } from './pattern.js';

export function addToSong(bank, pattern) {
  if (bank.song.length >= MAX_SONG_LENGTH) return false;
  bank.song.push(pattern);
  return true;
}

export function removeFromSong(bank, position) {
  bank.song.splice(position, 1);
}

export function isSongActive(bank) {
  return bank.songMode && bank.song.length > 0;
}

// Pattern à jouer pour la mesure n° `bar` (à partir de 0) : en mode
// morceau on suit la liste en boucle, sinon le pattern sélectionné.
export function patternForBar(bank, bar) {
  return isSongActive(bank) ? bank.song[bar % bank.song.length] : bank.current;
}

// Mesures à exporter : le morceau entier, ou le pattern courant répété.
export const PATTERN_EXPORT_REPEATS = 4;

export function barsToExport(bank) {
  return isSongActive(bank) ? [...bank.song] : Array(PATTERN_EXPORT_REPEATS).fill(bank.current);
}
