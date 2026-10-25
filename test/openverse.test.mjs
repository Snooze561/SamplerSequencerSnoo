import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ov = require('../lib/openverse.js');

const sample = {
  result_count: 240,
  page_count: 12,
  results: [
    {
      id: 'a1b2c3d4-0000-1111-2222-333344445555',
      title: 'Snare Hit.wav',
      creator: 'carol',
      source: 'freesound',
      url: 'https://cdn.freesound.org/previews/1/1-hq.mp3',
      filetype: 'mp3',
      license: 'by',
      license_version: '4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      duration: 1500,
      foreign_landing_url: 'https://freesound.org/people/carol/sounds/1',
    },
    { id: 'x', title: 'http seulement', url: 'http://example.org/a.mp3', filetype: 'mp3', license: 'cc0' },
    { id: 'y', title: 'format inconnu', url: 'https://example.org/a.xyz', license: 'cc0' },
    { id: 'z', title: 'sans filetype', url: 'https://upload.wikimedia.org/a/b/Drum.ogg', license: 'pdm', duration: 900 },
  ],
};

test('l\'adresse de recherche Openverse', () => {
  const url = new URL(ov.buildSearchUrl({ query: ' kick ', page: 3, shortOnly: true, cc0Only: true }));
  assert.equal(url.origin + url.pathname, 'https://api.openverse.org/v1/audio/');
  assert.equal(url.searchParams.get('q'), 'kick');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(url.searchParams.get('page_size'), '20');
  assert.equal(url.searchParams.get('length'), 'shortest');
  assert.equal(url.searchParams.get('license'), 'cc0,pdm');
  const plain = new URL(ov.buildSearchUrl({ query: 'kick' }));
  assert.equal(plain.searchParams.has('length'), false);
  assert.equal(plain.searchParams.has('license'), false);
});

test('les résultats sont lus, les sons non sûrs ou illisibles ignorés', () => {
  const r = ov.parseResults(sample, 1);
  assert.equal(r.count, 240);
  assert.equal(r.hasMore, true);
  assert.deepEqual(r.sounds.map((s) => s.id), ['a1b2c3d4-0000-1111-2222-333344445555', 'z']);
  const [snare, drum] = r.sounds;
  assert.equal(snare.name, 'Snare Hit.wav');
  assert.equal(snare.username, 'carol · freesound');
  assert.equal(snare.duration, 1.5);
  assert.equal(snare.license, 'CC BY');
  assert.equal(snare.ext, 'mp3');
  assert.equal(snare.url, 'https://freesound.org/people/carol/sounds/1');
  assert.equal(drum.ext, 'ogg');
  assert.equal(drum.license, 'Domaine public');
  assert.equal(ov.parseResults(sample, 12).hasMore, false);
  assert.deepEqual(ov.parseResults(null), { count: 0, hasMore: false, sounds: [] });
});

test('nom de fichier dans la banque', () => {
  const [snare] = ov.parseResults(sample).sounds;
  assert.equal(ov.fileNameFor(snare), 'Snare Hit (openverse a1b2c3d4).mp3');
});

test('erreurs de recherche expliquées en clair', async () => {
  const reply = (status, body = {}) => async () => ({ ok: status === 200, status, json: async () => body });
  await assert.rejects(ov.search(reply(200), { query: ' ' }), /mot à chercher/);
  await assert.rejects(ov.search(reply(429), { query: 'kick' }), /une minute/);
  await assert.rejects(ov.search(reply(500), { query: 'kick' }), /500/);
  await assert.rejects(ov.search(async () => { throw new Error('x'); }, { query: 'kick' }), /internet/);
  const ok = await ov.search(reply(200, sample), { query: 'kick', page: 1 });
  assert.equal(ok.sounds.length, 2);
});

test('le téléchargement exige https et refuse les fichiers énormes', async () => {
  let calls = 0;
  const make = (len, size) => async () => {
    calls++;
    return { ok: true, headers: { get: () => String(len) }, arrayBuffer: async () => new ArrayBuffer(size) };
  };
  await assert.rejects(ov.download(make(1, 1), 'http://example.org/a.mp3'), /sécurisée/);
  assert.equal(calls, 0);
  await assert.rejects(ov.download(make(50e6, 1), 'https://example.org/a.mp3'), /trop gros/);
  const bytes = await ov.download(make(4, 4), 'https://example.org/a.mp3');
  assert.equal(bytes.length, 4);
});
