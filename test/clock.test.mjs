import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepDuration, clampBpm, nextStep } from '../src/audio/clock.js';

test('un pas dure une double-croche', () => {
  assert.equal(stepDuration(120), 0.125);
  assert.equal(stepDuration(60), 0.25);
});

test('le tempo reste entre 40 et 240 BPM', () => {
  assert.equal(clampBpm(10), 40);
  assert.equal(clampBpm(999), 240);
  assert.equal(clampBpm('128.4'), 128);
  assert.equal(clampBpm('abc'), 120);
});

test('la mesure boucle après 16 pas', () => {
  assert.equal(nextStep(0), 1);
  assert.equal(nextStep(15), 0);
});
