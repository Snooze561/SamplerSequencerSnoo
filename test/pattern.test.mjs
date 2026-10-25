import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPattern, createBank, toggleStep, clearPattern, parseBank, TRACK_COUNT, PATTERN_COUNT,
} from '../src/sequencer/pattern.js';

test('un pattern neuf a 8 pistes de 16 pas éteints', () => {
  const p = createPattern();
  assert.equal(p.steps.length, TRACK_COUNT);
  assert.ok(p.steps.every((row) => row.length === 16 && row.every((s) => s === false)));
});

test('la banque démarre avec un rythme de démo dans le pattern 1', () => {
  const bank = createBank();
  assert.equal(bank.patterns.length, PATTERN_COUNT);
  assert.equal(bank.patterns[0].steps[0][0], true);
  assert.ok(bank.patterns[1].steps.flat().every((s) => !s));
});

test('allumer puis éteindre un pas', () => {
  const p = createPattern();
  assert.equal(toggleStep(p, 2, 5), true);
  assert.equal(toggleStep(p, 2, 5), false);
});

test('effacer un pattern', () => {
  const bank = createBank();
  clearPattern(bank.patterns[0]);
  assert.ok(bank.patterns[0].steps.flat().every((s) => !s));
});

test('une banque sauvegardée est relue telle quelle', () => {
  const bank = createBank();
  bank.current = 3;
  bank.bpm = 98;
  toggleStep(bank.patterns[3], 7, 15);
  const back = parseBank(JSON.stringify(bank));
  assert.deepEqual(back, bank);
});

test('un fichier abîmé redonne une banque neuve', () => {
  assert.deepEqual(parseBank('pas du json'), createBank());
  assert.deepEqual(parseBank('{"patterns": []}'), createBank());
  assert.deepEqual(parseBank(null), createBank());
});
