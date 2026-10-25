import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swingOffset, clampSwing, barDuration, stepDuration } from '../src/audio/clock.js';
import { createBank, parseBank, MAX_SONG_LENGTH } from '../src/sequencer/pattern.js';
import { addToSong, removeFromSong, patternForBar, barsToExport, isSongActive } from '../src/sequencer/song.js';
import { createKit, createSlot, setSample, setSend, parseKit, forgetSample } from '../src/sequencer/kit-model.js';
import { encodeWav } from '../src/audio/wav.js';

test('le swing retarde seulement les pas pairs', () => {
  assert.equal(swingOffset(0, 120, 0.5), 0);
  assert.equal(swingOffset(1, 120, 0.5), stepDuration(120) / 2);
  assert.equal(swingOffset(1, 120, 0), 0);
  assert.equal(clampSwing(2), 0.5);
  assert.equal(clampSwing(-1), 0);
  assert.equal(clampSwing('x'), 0);
  assert.equal(barDuration(120), 2);
});

test('composer un morceau', () => {
  const bank = createBank();
  assert.equal(isSongActive(bank), false);
  addToSong(bank, 0);
  addToSong(bank, 0);
  addToSong(bank, 2);
  removeFromSong(bank, 1);
  assert.deepEqual(bank.song, [0, 2]);
  bank.current = 5;
  assert.equal(patternForBar(bank, 3), 5);
  bank.songMode = true;
  assert.deepEqual([0, 1, 2, 3].map((b) => patternForBar(bank, b)), [0, 2, 0, 2]);
});

test('un morceau est limité à 64 mesures', () => {
  const bank = createBank();
  for (let i = 0; i < MAX_SONG_LENGTH; i++) addToSong(bank, 1);
  assert.equal(addToSong(bank, 1), false);
  assert.equal(bank.song.length, MAX_SONG_LENGTH);
});

test('ce qui est exporté : le morceau, ou le pattern 4 fois', () => {
  const bank = createBank();
  bank.current = 3;
  assert.deepEqual(barsToExport(bank), [3, 3, 3, 3]);
  bank.song = [1, 2];
  assert.deepEqual(barsToExport(bank), [3, 3, 3, 3]);
  bank.songMode = true;
  assert.deepEqual(barsToExport(bank), [1, 2]);
});

test('les banques des étapes précédentes gagnent swing, morceau et effets', () => {
  const old = createBank();
  delete old.swing;
  delete old.song;
  delete old.songMode;
  old.kit = old.kit.map(({ sample, start, end, pitch }) => ({ sample, start, end, pitch }));
  old.kit[2].sample = 'clap.wav';
  const bank = parseBank(JSON.stringify(old));
  assert.equal(bank.swing, 0);
  assert.deepEqual(bank.song, []);
  assert.equal(bank.songMode, false);
  assert.equal(bank.kit[2].sample, 'clap.wav');
  assert.equal(bank.kit[2].reverb, 0);
});

test('un morceau abîmé est nettoyé', () => {
  const b = createBank();
  b.song = [0, 9, -1, 'x', 3];
  b.songMode = 'oui';
  const back = parseBank(JSON.stringify(b));
  assert.deepEqual(back.song, [0, 3]);
  assert.equal(back.songMode, false);
});

test('effets par piste, conservés quand on change de son', () => {
  const [slot] = createKit(1);
  assert.equal(setSend(slot, 'reverb', 0.4), 0.4);
  assert.equal(setSend(slot, 'delay', 3), 1);
  setSample(slot, 'a.wav');
  assert.equal(slot.reverb, 0.4);
  forgetSample([slot], 'a.wav');
  assert.equal(slot.sample, null);
  assert.equal(slot.delay, 1);
  assert.deepEqual(parseKit([{ ...createSlot(), reverb: 5 }], 1), [createSlot()]);
});

test('encodage WAV 16 bits stéréo', () => {
  const left = new Float32Array([0, 1, -1, 0.5]);
  const right = new Float32Array([0, -1, 1, 2]);
  const view = new DataView(encodeWav([left, right], 44100));
  const str = (o, n) => String.fromCharCode(...new Uint8Array(view.buffer, o, n));
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(view.byteLength, 44 + 16);
  assert.equal(view.getInt16(44 + 4, true), 32767);
  assert.equal(view.getInt16(44 + 6, true), -32768);
  assert.equal(view.getInt16(44 + 14, true), 32767);
});
