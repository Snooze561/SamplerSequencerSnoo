import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createKit, setSample, setStart, setEnd, setPitch, pitchToRate, parseKit, forgetSample,
} from '../src/sequencer/kit-model.js';
import { createBank, parseBank } from '../src/sequencer/pattern.js';

test('un kit neuf utilise les sons 808 sur toutes les pistes', () => {
  const kit = createKit(8);
  assert.equal(kit.length, 8);
  assert.ok(kit.every((s) => s.sample === null));
});

test('poser un sample remet ses réglages à zéro', () => {
  const [slot] = createKit(1);
  setPitch(slot, 5);
  setStart(slot, 0.3);
  setSample(slot, 'kick.wav');
  assert.deepEqual(slot, { sample: 'kick.wav', start: 0, end: 1, pitch: 0 });
});

test('le début reste avant la fin, et inversement', () => {
  const [slot] = createKit(1);
  setEnd(slot, 0.5);
  assert.equal(setStart(slot, 0.9), 0.49);
  assert.equal(setEnd(slot, 0.1), 0.5);
  assert.equal(setStart(slot, -3), 0);
  assert.equal(setEnd(slot, 7), 1);
});

test('la hauteur va de -12 à +12 demi-tons', () => {
  const [slot] = createKit(1);
  assert.equal(setPitch(slot, 40), 12);
  assert.equal(setPitch(slot, -40), -12);
  assert.equal(setPitch(slot, 'abc'), 0);
  assert.equal(pitchToRate(12), 2);
  assert.equal(pitchToRate(-12), 0.5);
  assert.equal(pitchToRate(0), 1);
});

test('supprimer un sample libère les pistes qui l\'utilisaient', () => {
  const kit = createKit(3);
  setSample(kit[0], 'a.wav');
  setSample(kit[2], 'a.wav');
  setSample(kit[1], 'b.wav');
  forgetSample(kit, 'a.wav');
  assert.deepEqual(kit.map((s) => s.sample), [null, 'b.wav', null]);
});

test('une banque de l\'étape 2 (sans kit) reçoit un kit neuf', () => {
  const old = createBank();
  delete old.kit;
  const bank = parseBank(JSON.stringify(old));
  assert.deepEqual(bank.kit, createKit(8));
  assert.deepEqual(bank.patterns, old.patterns);
});

test('un réglage abîmé est remplacé sans perdre les autres', () => {
  const kit = createKit(2);
  setSample(kit[0], 'ok.wav');
  kit[1] = { sample: 'x.wav', start: 0.9, end: 0.2, pitch: 0 };
  const back = parseKit(JSON.parse(JSON.stringify(kit)), 2);
  assert.equal(back[0].sample, 'ok.wav');
  assert.equal(back[1].sample, null);
});
