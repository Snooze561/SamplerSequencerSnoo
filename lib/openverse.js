// Connexion à Openverse, le moteur de recherche de médias libres
// (Creative Commons) qui regroupe Freesound, Jamendo, Wikimedia et d'autres.
// Aucun compte ni clé n'est nécessaire.

const API = 'https://api.openverse.org/v1';
// Les recherches anonymes sont limitées à 20 résultats par page.
const PAGE_SIZE = 20;
// Garde-fou : on ne télécharge pas de fichier énorme par erreur.
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
const EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aif', 'aiff', 'm4a'];
const USER_AGENT = 'SnooSequencer/0.4 (https://github.com/Snooze561/SamplerSequencerSnoo)';

const LICENSES = {
  cc0: 'CC0',
  pdm: 'Domaine public',
  by: 'CC BY',
  'by-sa': 'CC BY-SA',
  'by-nc': 'CC BY-NC',
  'by-nc-sa': 'CC BY-NC-SA',
  'by-nd': 'CC BY-ND',
  'by-nc-nd': 'CC BY-NC-ND',
  'sampling+': 'Sampling+',
  'nc-sampling+': 'NC Sampling+',
};

function licenseLabel(license) {
  return LICENSES[String(license).toLowerCase()] ?? String(license).toUpperCase();
}

function buildSearchUrl({ query, page = 1, shortOnly = false, cc0Only = false }) {
  const params = new URLSearchParams({
    q: String(query ?? '').trim(),
    page: String(page),
    page_size: String(PAGE_SIZE),
  });
  // « shortest » = moins de 30 secondes, la catégorie la plus courte d'Openverse.
  if (shortOnly) params.set('length', 'shortest');
  if (cc0Only) params.set('license', 'cc0,pdm');
  return `${API}/audio/?${params}`;
}

function isHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Extension du fichier audio : celle annoncée par Openverse, sinon celle
// de l'adresse ; null si ce n'est pas un format que l'appli sait lire.
function extensionOf(result) {
  const declared = String(result.filetype ?? '').toLowerCase();
  if (EXTENSIONS.includes(declared)) return declared;
  try {
    const fromUrl = new URL(result.url).pathname.split('.').pop().toLowerCase();
    return EXTENSIONS.includes(fromUrl) ? fromUrl : null;
  } catch {
    return null;
  }
}

function parseResults(json, page = 1) {
  const results = Array.isArray(json?.results) ? json.results : [];
  const pageCount = Number(json?.page_count) || 0;
  return {
    count: Number(json?.result_count) || 0,
    hasMore: page < pageCount,
    sounds: results
      .filter((r) => r && typeof r.id === 'string' && isHttps(r.url) && extensionOf(r))
      .map((r) => {
        const version = r.license_version ? ` ${r.license_version}` : '';
        return {
          id: r.id,
          name: String(r.title || 'Sans titre'),
          username: [r.creator, r.source].filter(Boolean).join(' · '),
          // Openverse donne la durée en millisecondes.
          duration: (Number(r.duration) || 0) / 1000,
          license: licenseLabel(r.license),
          licenseUrl: String(r.license_url ?? '') || `licence ${r.license}${version}`,
          preview: r.url,
          url: String(r.foreign_landing_url || r.detail_url || r.url),
          ext: extensionOf(r),
        };
      }),
  };
}

function fileNameFor(sound) {
  const stem = sound.name.replace(/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i, '').slice(0, 80);
  return `${stem} (openverse ${String(sound.id).slice(0, 8)}).${sound.ext}`;
}

async function search(fetchImpl, options) {
  if (!String(options?.query ?? '').trim()) throw new Error('Tape un mot à chercher, par exemple « kick ».');
  let response;
  try {
    response = await fetchImpl(buildSearchUrl(options), { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new Error('Impossible de joindre Openverse. Vérifie ta connexion internet.');
  }
  if (response.status === 429) throw new Error('Trop de recherches d\'un coup. Attends une minute et réessaie.');
  if (!response.ok) throw new Error(`Openverse a répondu une erreur (${response.status}).`);
  return parseResults(await response.json(), Number(options.page) || 1);
}

async function download(fetchImpl, url) {
  if (!isHttps(url)) throw new Error('Adresse de son non sécurisée, téléchargement refusé.');
  let response;
  try {
    response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new Error('Impossible de télécharger ce son. Vérifie ta connexion internet.');
  }
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}). Essaie un autre son.`);
  const declared = Number(response.headers?.get?.('content-length'));
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Ce son est trop gros (plus de 30 Mo).');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error('Ce son est trop gros (plus de 30 Mo).');
  return bytes;
}

module.exports = {
  buildSearchUrl, parseResults, licenseLabel, fileNameFor, search, download, PAGE_SIZE,
};
