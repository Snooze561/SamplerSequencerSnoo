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

// --- Banque de sons ---------------------------------------------------
// Hors de l'appli (simple navigateur), les sons restent en mémoire le
// temps de la session : pratique pour tester l'interface.

const memorySamples = new Map();
const hasApp = () => Boolean(window.snoo?.listSamples);

export async function listSamples() {
  if (hasApp()) return window.snoo.listSamples();
  return [...memorySamples.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
}

export async function readSample(name) {
  if (hasApp()) {
    const bytes = await window.snoo.readSample(name);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const data = memorySamples.get(name);
  if (!data) throw new Error(`Sample introuvable : ${name}`);
  return data.slice(0);
}

export async function addSample(name, arrayBuffer) {
  if (hasApp()) return window.snoo.addSample(name, new Uint8Array(arrayBuffer));
  let finalName = name;
  for (let i = 2; memorySamples.has(finalName); i++) finalName = name.replace(/(\.[^.]+)$/, ` (${i})$1`);
  memorySamples.set(finalName, arrayBuffer.slice(0));
  return finalName;
}

export async function removeSample(name) {
  if (hasApp()) return window.snoo.removeSample(name);
  memorySamples.delete(name);
}

// Ouvre la fenêtre "Importer des sons" de Windows. Renvoie null hors de
// l'appli, pour que l'interface se rabatte sur un champ fichier classique.
export async function importSamplesWithDialog() {
  return hasApp() ? window.snoo.importSamples() : null;
}
