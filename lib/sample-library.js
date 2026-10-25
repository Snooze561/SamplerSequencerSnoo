// Banque de sons perso : les samples importés sont copiés dans un dossier
// de l'appli, pour rester disponibles même si l'original est déplacé.
const fs = require('fs/promises');
const path = require('path');

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a'];

function isAudioFile(name) {
  return AUDIO_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

// Garde un nom de fichier lisible mais sans risque : pas de dossier,
// pas de caractères interdits par Windows.
function sanitizeName(name) {
  const base = path.basename(String(name).replace(/\\/g, '/'));
  const clean = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim();
  return clean.slice(0, 120) || 'sample.wav';
}

class SampleLibrary {
  constructor(dir) {
    this.dir = dir;
  }

  async list() {
    try {
      const names = await fs.readdir(this.dir);
      return names.filter(isAudioFile).sort((a, b) => a.localeCompare(b, 'fr'));
    } catch {
      return [];
    }
  }

  // Résout un nom venant de l'interface en chemin, en refusant tout ce qui
  // sortirait du dossier de la banque.
  resolve(name) {
    const safe = sanitizeName(name);
    if (safe !== name || !isAudioFile(safe)) throw new Error(`Nom de sample invalide : ${name}`);
    return path.join(this.dir, safe);
  }

  async uniqueName(name) {
    const existing = new Set(await this.list());
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    let candidate = name;
    for (let i = 2; existing.has(candidate); i++) candidate = `${stem} (${i})${ext}`;
    return candidate;
  }

  async add(originalName, bytes) {
    const name = sanitizeName(originalName);
    if (!isAudioFile(name)) throw new Error(`Format non pris en charge : ${originalName}`);
    await fs.mkdir(this.dir, { recursive: true });
    const finalName = await this.uniqueName(name);
    await fs.writeFile(path.join(this.dir, finalName), bytes);
    return finalName;
  }

  async addFromPath(filePath) {
    return this.add(path.basename(filePath), await fs.readFile(filePath));
  }

  async read(name) {
    return fs.readFile(this.resolve(name));
  }

  async remove(name) {
    await fs.rm(this.resolve(name), { force: true });
  }
}

module.exports = { SampleLibrary, sanitizeName, isAudioFile, AUDIO_EXTENSIONS };
