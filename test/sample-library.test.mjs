import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SampleLibrary, sanitizeName } = require('../lib/sample-library.js');

async function tempLibrary() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snoo-'));
  return new SampleLibrary(path.join(dir, 'samples'));
}

test('les noms dangereux sont nettoyés', () => {
  assert.equal(sanitizeName('..\\..\\Windows\\kick.wav'), 'kick.wav');
  assert.equal(sanitizeName('../../etc/snare.wav'), 'snare.wav');
  assert.equal(sanitizeName('a:b?c.wav'), 'a_b_c.wav');
  assert.equal(sanitizeName('...wav'), 'wav');
});

test('importer, lister, relire et supprimer un sample', async () => {
  const lib = await tempLibrary();
  assert.deepEqual(await lib.list(), []);
  const name = await lib.add('Kick 01.wav', Buffer.from([1, 2, 3]));
  assert.equal(name, 'Kick 01.wav');
  assert.deepEqual(await lib.list(), ['Kick 01.wav']);
  assert.deepEqual([...(await lib.read(name))], [1, 2, 3]);
  await lib.remove(name);
  assert.deepEqual(await lib.list(), []);
});

test('deux samples du même nom ne s\'écrasent pas', async () => {
  const lib = await tempLibrary();
  await lib.add('clap.wav', Buffer.from([1]));
  assert.equal(await lib.add('clap.wav', Buffer.from([2])), 'clap (2).wav');
  assert.equal(await lib.add('clap.wav', Buffer.from([3])), 'clap (3).wav');
});

test('les fichiers qui ne sont pas du son sont refusés', async () => {
  const lib = await tempLibrary();
  await assert.rejects(lib.add('virus.exe', Buffer.from([0])));
  await assert.rejects(lib.read('../patterns.json'));
  await assert.rejects(lib.remove('..\\patterns.json'));
});
