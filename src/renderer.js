import { AudioEngine, STEPS_PER_BAR } from './audio/engine.js';
import { DrumKit } from './audio/kit.js';
import { PATTERN_COUNT, toggleStep, clearPattern } from './sequencer/pattern.js';
import { loadBank, saveBankSoon } from './sequencer/storage.js';

const engine = new AudioEngine();
const kit = new DrumKit(engine);
engine.metronome = false;

const playBtn = document.getElementById('play');
const bpmInput = document.getElementById('bpm');
const bpmRange = document.getElementById('bpm-range');
const volume = document.getElementById('volume');
const metronome = document.getElementById('metronome');
const grid = document.getElementById('grid');
const stepNumbers = document.getElementById('step-numbers');
const patternButtonsEl = document.getElementById('pattern-buttons');
const clearBtn = document.getElementById('clear');

const bank = await loadBank();
const pattern = () => bank.patterns[bank.current];
const save = () => saveBankSoon(bank);

// --- Construction de la grille ---------------------------------------

const numberEls = [];
for (let s = 0; s < STEPS_PER_BAR; s++) {
  const n = document.createElement('div');
  n.className = 'step-number';
  n.textContent = s + 1;
  stepNumbers.appendChild(n);
  numberEls.push(n);
}

const rows = kit.sounds.map((sound, t) => {
  const head = document.createElement('div');
  head.className = 'track-head';

  const name = document.createElement('button');
  name.className = 'track-name';
  name.textContent = sound.name;
  name.title = 'Écouter';
  name.addEventListener('click', () => kit.trigger(t));

  const mute = document.createElement('button');
  mute.className = 'mute';
  mute.textContent = 'M';
  mute.title = 'Couper la piste';
  mute.addEventListener('click', () => {
    pattern().mutes[t] = !pattern().mutes[t];
    render();
    save();
  });

  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = 0;
  vol.max = 1;
  vol.step = 0.01;
  vol.title = 'Volume de la piste';
  vol.addEventListener('input', () => {
    pattern().volumes[t] = Number(vol.value);
    kit.setVolume(t, pattern().volumes[t]);
    save();
  });

  head.append(name, mute, vol);

  const steps = document.createElement('div');
  steps.className = 'track-steps';
  const cells = [];
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.dataset.group = Math.floor(s / 4);
    cell.addEventListener('click', () => {
      const on = toggleStep(pattern(), t, s);
      cell.classList.toggle('on', on);
      // On entend le son en le posant, si la machine est arrêtée.
      if (on && !engine.playing) kit.trigger(t);
      save();
    });
    steps.appendChild(cell);
    cells.push(cell);
  }

  grid.append(head, steps);
  return { mute, vol, cells, steps };
});

const patternButtons = [];
for (let i = 0; i < PATTERN_COUNT; i++) {
  const b = document.createElement('button');
  b.className = 'pattern-btn';
  b.textContent = i + 1;
  b.addEventListener('click', () => {
    bank.current = i;
    render();
    save();
  });
  patternButtonsEl.appendChild(b);
  patternButtons.push(b);
}

function render() {
  const p = pattern();
  rows.forEach((row, t) => {
    row.cells.forEach((cell, s) => cell.classList.toggle('on', p.steps[t][s]));
    row.mute.classList.toggle('active', p.mutes[t]);
    row.steps.classList.toggle('muted', p.mutes[t]);
    row.vol.value = p.volumes[t];
    if (kit.channels) kit.setVolume(t, p.volumes[t]);
  });
  patternButtons.forEach((b, i) => b.classList.toggle('active', i === bank.current));
}

// --- Lecture ---------------------------------------------------------

engine.onStep = (step, time) => {
  const p = pattern();
  for (let t = 0; t < rows.length; t++) {
    if (p.steps[t][step] && !p.mutes[t]) kit.trigger(t, time);
  }
};

let litStep = -1;
engine.onStepChange((step) => {
  if (litStep >= 0) {
    numberEls[litStep].classList.remove('current');
    rows.forEach((row) => row.cells[litStep].classList.remove('playhead'));
  }
  litStep = step;
  if (step >= 0) {
    numberEls[step].classList.add('current');
    rows.forEach((row) => row.cells[step].classList.add('playhead'));
  }
});

function togglePlay() {
  kit.ensure();
  render();
  const playing = engine.toggle();
  playBtn.classList.toggle('active', playing);
  playBtn.textContent = playing ? '■ STOP' : '▶ PLAY';
}

function setBpm(value, store = true) {
  const bpm = engine.setBpm(value);
  bpmInput.value = bpm;
  bpmRange.value = bpm;
  if (store) {
    bank.bpm = bpm;
    save();
  }
}

playBtn.addEventListener('click', () => { togglePlay(); playBtn.blur(); });
bpmRange.addEventListener('input', () => setBpm(bpmRange.value));
bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
volume.addEventListener('input', () => engine.setMasterVolume(Number(volume.value)));
metronome.addEventListener('change', () => { engine.metronome = metronome.checked; });
clearBtn.addEventListener('click', () => {
  clearPattern(pattern());
  render();
  save();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (/^Digit[1-8]$/.test(e.code)) {
    bank.current = Number(e.code.slice(5)) - 1;
    render();
    save();
  }
});

// Évite que la barre d'espace "clique" sur le dernier bouton utilisé.
document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLButtonElement) e.target.blur();
});

setBpm(bank.bpm, false);
render();
