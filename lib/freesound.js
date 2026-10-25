// Connexion à Freesound.org, la grande banque de sons gratuite.
// Tout passe par le processus principal : la clé API ne quitte jamais
// cette partie de l'appli, et seules les adresses de Freesound sont contactées.

const API = 'https://freesound.org/apiv2';
const FIELDS = 'id,name,username,duration,license,previews,url';
const PAGE_SIZE = 30;
const PREVIEW_HOSTS = ['cdn.freesound.org', 'freesound.org'];

// Freesound renvoie la licence sous forme d'adresse Creative Commons
// (ou parfois de nom) : on la traduit en libellé court.
function licenseLabel(license) {
  const l = String(license).toLowerCase();
  if (l.includes('publicdomain/zero') || l.includes('creative commons 0')) return 'CC0';
  if (l.includes('sampling+')) return 'Sampling+';
  if (l.includes('by-nc') || l.includes('noncommercial')) return 'CC BY-NC';
  if (l.includes('/by/') || l.includes('attribution')) return 'CC BY';
  return 'Autre';
}

function buildSearchUrl(token, { query, page = 1, shortOnly = false, cc0Only = false }) {
  const filters = [];
  if (shortOnly) filters.push('duration:[0 TO 5]');
  if (cc0Only) filters.push('license:"Creative Commons 0"');
  const params = new URLSearchParams({
    query: String(query ?? '').trim(),
    fields: FIELDS,
    page_size: String(PAGE_SIZE),
    page: String(page),
    token,
  });
  if (filters.length) params.set('filter', filters.join(' '));
  return `${API}/search/?${params}`;
}

function parseResults(json) {
  const results = Array.isArray(json?.results) ? json.results : [];
  return {
    count: Number(json?.count) || 0,
    hasMore: Boolean(json?.next),
    sounds: results
      .filter((s) => s && Number.isInteger(s.id) && s.previews?.['preview-hq-mp3'])
      .map((s) => ({
        id: s.id,
        name: String(s.name ?? `son ${s.id}`),
        username: String(s.username ?? ''),
        duration: Number(s.duration) || 0,
        license: licenseLabel(s.license),
        licenseUrl: String(s.license ?? ''),
        preview: s.previews['preview-hq-mp3'],
        url: String(s.url ?? `https://freesound.org/s/${s.id}/`),
      })),
  };
}

function isAllowedPreviewUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PREVIEW_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

// Nom du fichier dans la banque : le nom Freesound (sans son extension
// d'origine, puisque l'aperçu est toujours un MP3) et le numéro du son.
function fileNameFor(sound) {
  const stem = sound.name.replace(/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i, '').slice(0, 80);
  return `${stem} (freesound ${sound.id}).mp3`;
}

function creditLine(sound, fileName) {
  return `${fileName} : « ${sound.name} » par ${sound.username}, licence ${sound.license}`
    + ` (${sound.licenseUrl}), ${sound.url}\n`;
}

async function apiError(response) {
  if (response.status === 401) return 'Clé Freesound refusée. Vérifie-la dans les réglages Freesound.';
  if (response.status === 429) return 'Trop de recherches d\'un coup. Attends une minute et réessaie.';
  let detail = '';
  try {
    detail = (await response.json()).detail ?? '';
  } catch {
    // Pas de détail lisible : le code HTTP suffira.
  }
  return `Freesound a répondu une erreur (${response.status}) ${detail}`.trim();
}

async function search(fetchImpl, token, options) {
  if (!token) throw new Error('Ajoute d\'abord ta clé Freesound.');
  if (!String(options?.query ?? '').trim()) throw new Error('Tape un mot à chercher, par exemple « kick ».');
  let response;
  try {
    response = await fetchImpl(buildSearchUrl(token, options));
  } catch {
    throw new Error('Impossible de joindre Freesound. Vérifie ta connexion internet.');
  }
  if (!response.ok) throw new Error(await apiError(response));
  return parseResults(await response.json());
}

async function downloadPreview(fetchImpl, previewUrl) {
  if (!isAllowedPreviewUrl(previewUrl)) throw new Error('Adresse de son inattendue.');
  const response = await fetchImpl(previewUrl);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  buildSearchUrl, parseResults, licenseLabel, isAllowedPreviewUrl, fileNameFor, creditLine,
  search, downloadPreview, PAGE_SIZE,
};
