// Fenêtre « Sons gratuits » : recherche, écoute et ajout de sons depuis
// Openverse (sans compte) ou Freesound (avec une clé gratuite).
// Les échanges passent par l'appli (window.snoo), qui garde la clé Freesound.

const $ = (id) => document.getElementById(id);

// Electron préfixe les erreurs venues du processus principal ; on ne
// garde que le message utile.
function cleanError(err) {
  return String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

function formatDuration(seconds) {
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
}

function licenseHint(license) {
  if (license === 'CC0' || license === 'Domaine public') return 'Libre pour tout usage, sans obligation de citer l\'auteur.';
  if (license.includes('NC')) return 'Citer l\'auteur, et pas d\'usage commercial.';
  return 'Citer l\'auteur si tu publies ta musique.';
}

const SOURCE_KEY = 'snoo-sound-source';

export function setupSoundSearch({ getSelectedTrack, onAdded }) {
  const dialog = $('freesound');
  const keyForm = $('fs-key-form');
  const keyInput = $('fs-key');
  const changeKey = $('fs-change-key');
  const searchArea = $('fs-search-area');
  const searchForm = $('fs-search-form');
  const query = $('fs-query');
  const shortOnly = $('fs-short');
  const cc0Only = $('fs-cc0');
  const sourceInfo = $('fs-source-info');
  const status = $('fs-status');
  const results = $('fs-results');
  const more = $('fs-more');
  const sourceButtons = [...document.querySelectorAll('.fs-source')];

  const api = window.snoo;
  const SOURCES = {
    openverse: {
      search: api?.openverseSearch,
      add: api?.openverseAdd,
      needsKey: false,
      info: 'Openverse regroupe les sons libres de Freesound, Jamendo, Wikimedia et d\'autres. Aucun compte nécessaire. « Sons courts » = moins de 30 s.',
    },
    freesound: {
      search: api?.freesoundSearch,
      add: api?.freesoundAdd,
      needsKey: true,
      info: 'Freesound : plus de 600 000 sons, avec ta clé gratuite. « Sons courts » = moins de 5 s.',
    },
  };

  let source = 'openverse';
  try {
    if (SOURCES[localStorage.getItem(SOURCE_KEY)]) source = localStorage.getItem(SOURCE_KEY);
  } catch {
    // Pas de mémoire locale disponible : on garde Openverse.
  }

  const preview = new Audio();
  let lastSearch = null;
  let page = 1;
  let playingButton = null;

  function showKeyForm(show) {
    keyForm.hidden = !show;
    searchArea.hidden = show;
    changeKey.hidden = show || !SOURCES[source].needsKey;
    (show ? keyInput : query).focus();
  }

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('error', isError);
  }

  function stopPreview() {
    preview.pause();
    if (playingButton) playingButton.textContent = '▶';
    playingButton = null;
  }

  async function selectSource(name) {
    source = name;
    try {
      localStorage.setItem(SOURCE_KEY, name);
    } catch {
      // Tant pis, le choix ne sera pas retenu.
    }
    stopPreview();
    sourceButtons.forEach((b) => b.classList.toggle('active', b.dataset.source === name));
    sourceInfo.textContent = SOURCES[name].info;
    results.replaceChildren();
    more.hidden = true;
    setStatus('');
    const needsKey = SOURCES[name].needsKey && !(await api.freesoundHasKey());
    showKeyForm(needsKey);
    if (!needsKey && query.value.trim()) runSearch(1);
  }

  async function open() {
    dialog.showModal();
    if (!api?.openverseSearch) {
      keyForm.hidden = true;
      searchArea.hidden = false;
      searchForm.hidden = true;
      setStatus('La recherche de sons fonctionne seulement dans l\'appli Windows.', true);
      return;
    }
    await selectSource(source);
  }

  async function runSearch(nextPage) {
    stopPreview();
    page = nextPage;
    if (page === 1) {
      lastSearch = { query: query.value, shortOnly: shortOnly.checked, cc0Only: cc0Only.checked };
      results.replaceChildren();
    }
    more.hidden = true;
    setStatus('Recherche…');
    const searchedSource = source;
    try {
      const found = await SOURCES[source].search({ ...lastSearch, page });
      // L'utilisateur a pu changer de source pendant la recherche.
      if (searchedSource !== source) return;
      setStatus(found.count
        ? `${found.count.toLocaleString('fr-FR')} sons trouvés.`
        : 'Aucun son trouvé. Essaie un autre mot, en anglais par exemple.');
      results.append(...found.sounds.map(renderSound));
      more.hidden = !found.hasMore;
    } catch (err) {
      if (searchedSource !== source) return;
      const message = cleanError(err);
      setStatus(message, true);
      if (SOURCES[source].needsKey && /clé/i.test(message) && /refusée|ajoute/i.test(message)) showKeyForm(true);
    }
  }

  function renderSound(sound) {
    const addToBank = SOURCES[source].add;
    const li = document.createElement('li');
    li.className = 'fs-item';

    const play = document.createElement('button');
    play.className = 'fs-play';
    play.textContent = '▶';
    play.title = 'Écouter';
    play.addEventListener('click', () => {
      const wasPlaying = playingButton === play;
      stopPreview();
      if (wasPlaying) return;
      preview.src = sound.preview;
      preview.play().catch(() => setStatus('Lecture de l\'aperçu impossible.', true));
      play.textContent = '■';
      playingButton = play;
    });

    const info = document.createElement('div');
    info.className = 'fs-info';
    const name = document.createElement('a');
    name.className = 'fs-name';
    name.textContent = sound.name;
    name.href = sound.url;
    name.target = '_blank';
    name.title = 'Voir la page du son';
    const meta = document.createElement('span');
    meta.className = 'fs-meta';
    meta.textContent = `${sound.username} · ${formatDuration(sound.duration)}`;
    const license = document.createElement('span');
    const free = sound.license === 'CC0' || sound.license === 'Domaine public';
    license.className = `fs-license ${free ? 'free' : ''}`;
    license.textContent = sound.license;
    license.title = licenseHint(sound.license);
    info.append(name, meta);

    const toBank = document.createElement('button');
    toBank.className = 'small';
    toBank.textContent = '+ BANQUE';
    const toTrack = document.createElement('button');
    toTrack.className = 'small accent';
    toTrack.textContent = '+ PISTE';
    toTrack.title = 'Ajouter à ta banque et mettre sur la piste sélectionnée';

    async function add(assign) {
      toBank.disabled = true;
      toTrack.disabled = true;
      setStatus(`Téléchargement de « ${sound.name} »…`);
      try {
        const fileName = await addToBank(sound);
        await onAdded(fileName, assign ? getSelectedTrack() : null);
        setStatus(assign
          ? `« ${sound.name} » est sur la piste ${getSelectedTrack() + 1}.`
          : `« ${sound.name} » est dans ta banque.`);
        li.classList.add('added');
      } catch (err) {
        setStatus(cleanError(err), true);
        toBank.disabled = false;
        toTrack.disabled = false;
      }
    }
    toBank.addEventListener('click', () => add(false));
    toTrack.addEventListener('click', () => add(true));

    li.append(play, info, license, toBank, toTrack);
    return li;
  }

  preview.addEventListener('ended', stopPreview);

  $('open-freesound').addEventListener('click', open);
  $('fs-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stopPreview);
  changeKey.addEventListener('click', () => showKeyForm(true));
  for (const button of sourceButtons) {
    button.addEventListener('click', () => selectSource(button.dataset.source));
  }

  keyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = keyInput.value.trim();
    if (!key) return;
    await api.freesoundSetKey(key);
    keyInput.value = '';
    showKeyForm(false);
    setStatus('Clé enregistrée. Tu peux chercher des sons !');
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(1);
  });
  for (const box of [shortOnly, cc0Only]) {
    box.addEventListener('change', () => { if (lastSearch) runSearch(1); });
  }
  more.addEventListener('click', () => runSearch(page + 1));
}
