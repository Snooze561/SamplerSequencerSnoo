import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fsd = require('../lib/freesound.js');

const sample = {
  count: 2,
  next: 'https://freesound.org/apiv2/search/?page=2',
  results: [
    {
      id: 12345,
      name: 'Big Kick.wav',
      username: 'snoo',
      duration: 0.8,
      license: 'http://creativecommons.org/publicdomain/zero/1.0/',
      previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/previews/12/12345_1-hq.mp3' },
      url: 'https://freesound.org/people/snoo/sounds/12345/',
    },
    { id: 2, name: 'sans aperçu', previews: {} },
  ],
};

test('l\'adresse de recherche contient la requête, les filtres et la clé', () => {
  const url = new URL(fsd.buildSearchUrl('KEY', { query: ' kick 808 ', page: 2, shortOnly: true, cc0Only: true }));
  assert.equal(url.origin + url.pathname, 'https://freesound.org/apiv2/search/');
  assert.equal(url.searchParams.get('query'), 'kick 808');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('token'), 'KEY');
  assert.equal(url.searchParams.get('filter'), 'duration:[0 TO 5] license:"Creative Commons 0"');
  assert.match(url.searchParams.get('fields'), /previews/);
});

test('sans filtre, pas de paramètre filter', () => {
  const url = new URL(fsd.buildSearchUrl('KEY', { query: 'snare' }));
  assert.equal(url.searchParams.has('filter'), false);
});

test('les résultats sont lus et ceux sans aperçu ignorés', () => {
  const r = fsd.parseResults(sample);
  assert.equal(r.count, 2);
  assert.equal(r.hasMore, true);
  assert.equal(r.sounds.length, 1);
  assert.deepEqual(r.sounds[0], {
    id: 12345,
    name: 'Big Kick.wav',
    username: 'snoo',
    duration: 0.8,
    license: 'CC0',
    licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/',
    preview: 'https://cdn.freesound.org/previews/12/12345_1-hq.mp3',
    url: 'https://freesound.org/people/snoo/sounds/12345/',
  });
  assert.deepEqual(fsd.parseResults(null), { count: 0, hasMore: false, sounds: [] });
});

test('les licences sont traduites en libellés courts', () => {
  assert.equal(fsd.licenseLabel('http://creativecommons.org/licenses/by/4.0/'), 'CC BY');
  assert.equal(fsd.licenseLabel('https://creativecommons.org/licenses/by-nc/3.0/'), 'CC BY-NC');
  assert.equal(fsd.licenseLabel('Attribution NonCommercial'), 'CC BY-NC');
  assert.equal(fsd.licenseLabel('Creative Commons 0'), 'CC0');
  assert.equal(fsd.licenseLabel('http://creativecommons.org/licenses/sampling+/1.0/'), 'Sampling+');
});

test('seules les adresses Freesound en https sont téléchargées', () => {
  assert.equal(fsd.isAllowedPreviewUrl('https://cdn.freesound.org/previews/1/1.mp3'), true);
  assert.equal(fsd.isAllowedPreviewUrl('http://cdn.freesound.org/previews/1/1.mp3'), false);
  assert.equal(fsd.isAllowedPreviewUrl('https://evil.example/x.mp3'), false);
  assert.equal(fsd.isAllowedPreviewUrl('https://cdn.freesound.org.evil.example/x.mp3'), false);
  assert.equal(fsd.isAllowedPreviewUrl('pas une adresse'), false);
});

test('nom de fichier dans la banque', () => {
  const [sound] = fsd.parseResults(sample).sounds;
  assert.equal(fsd.fileNameFor(sound), 'Big Kick (freesound 12345).mp3');
});

test('la recherche explique les erreurs en clair', async () => {
  const reply = (status, body = {}) => async () => ({ ok: status === 200, status, json: async () => body });
  await assert.rejects(fsd.search(reply(200), '', { query: 'kick' }), /clé/);
  await assert.rejects(fsd.search(reply(200), 'K', { query: '  ' }), /mot à chercher/);
  await assert.rejects(fsd.search(reply(401), 'K', { query: 'kick' }), /refusée/);
  await assert.rejects(fsd.search(reply(429), 'K', { query: 'kick' }), /une minute/);
  await assert.rejects(fsd.search(async () => { throw new Error('offline'); }, 'K', { query: 'kick' }), /internet/);
  const ok = await fsd.search(reply(200, sample), 'K', { query: 'kick' });
  assert.equal(ok.sounds[0].id, 12345);
});

test('le téléchargement refuse une adresse étrangère', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; };
  await assert.rejects(fsd.downloadPreview(fetchImpl, 'https://evil.example/x.mp3'));
  assert.equal(called, false);
  const bytes = await fsd.downloadPreview(fetchImpl, 'https://cdn.freesound.org/previews/1/1.mp3');
  assert.equal(bytes.length, 1);
});
