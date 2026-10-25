import { parseBank } from './pattern.js';

// Dans l'appli Windows, la banque va dans un fichier via Electron ;
// ouverte dans un simple navigateur (pour tester), elle va dans localStorage.
const KEY = 'snoo-patterns';

export async function loadBank() {
  let json = null;
  try {
    json = window.snoo?.loadPatterns ? await window.snoo.loadPatterns() : localStorage.getItem(KEY);
  } catch {
    json = null;
  }
  return parseBank(json);
}

let timer = null;

// Sauvegarde automatique, regroupée : on attend une demi-seconde sans
// modification avant d'écrire.
export function saveBankSoon(bank) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const json = JSON.stringify(bank);
    try {
      if (window.snoo?.savePatterns) window.snoo.savePatterns(json);
      else localStorage.setItem(KEY, json);
    } catch (err) {
      console.error('Sauvegarde des patterns impossible', err);
    }
  }, 500);
}
