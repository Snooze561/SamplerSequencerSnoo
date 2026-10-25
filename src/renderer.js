import { AudioEngine, STEPS_PER_BAR } from './audio/engine.js';
import { DrumKit } from './audio/kit.js';
import { PATTERN_COUNT, toggleStep, clearPattern } from './sequencer/pattern.js';
import {
  setSample, setStart, setEnd, setPitch, forgetSample, createSlot,
} from './sequencer/kit-model.js';
import {
  loadBank, saveBankSoon, listSamples, readSample, addSample, removeSample, importSamplesWithDialog,
} from './sequencer/storage.js';

const engine = new AudioEngine();
const kit = new DrumKit(engine, readSample);
engine.metronome = false;

const $ = (id) => document.getElementById(id);
const playBtn = $('play');
const bpmInput = $('bpm');
const bpmRange = $('bpm-range');
const volume = $('volume');
const metronome = $('metronome');
const grid = $('grid');
const stepNumbers = $('step-numbers');
const patternButtonsEl = $('pattern-buttons');
const clearBtn = $('clear');

const bank = await loadBank();
kit.slots = bank.kit;
const pattern = () => bank.patterns[bank.current];
const save = () => saveBankSoon(bank);

let selectedTrack = 0;
let samples = [];

const SAMPLE_DRAG_TYPE = 'application/x-snoo-sample';
const displayName = (name) => name.replace(/\.[^.]+$/, '');

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
  name.title = 'Écouter et régler cette piste';
  name.addEventListener('click', () => {
    selectTrack(t);
    kit.trigger(t);
  });

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

  // Glisser un fichier (ou un son de la banque) sur la piste le charge.
  for (const zone of [head, steps]) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      head.classList.add('drop');
    });
    zone.addEventListener('dragleave', () => head.classList.remove('drop'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      head.classList.remove('drop');
      const fromBank = e.dataTransfer.getData(SAMPLE_DRAG_TYPE);
      const name = fromBank || (await importFiles(e.dataTransfer.files))[0];
      if (name) assignSample(t, name);
    });
  }

  grid.append(head, steps);
  return { head, name, mute, vol, cells, steps };
});

const patternButtons = [];
for (let i = 0; i < PATTERN_COUNT; i++) {
  const b = document.createElement('button');
  b.className = 'pattern-btn';
  b.textContent = i + 1;
  b.addEventListener('click', () => selectPattern(i));
  patternButtonsEl.appendChild(b);
  patternButtons.push(b);
}

function selectPattern(i) {
  bank.current = i;
  render();
  save();
}

function render() {
  const p = pattern();
  rows.forEach((row, t) => {
    const slot = bank.kit[t];
    row.name.textContent = slot.sample ? displayName(slot.sample) : kit.sounds[t].name;
    row.name.classList.toggle('sample', Boolean(slot.sample));
    row.head.classList.toggle('selected', t === selectedTrack);
    row.cells.forEach((cell, s) => cell.classList.toggle('on', p.steps[t][s]));
    row.mute.classList.toggle('active', p.mutes[t]);
    row.steps.classList.toggle('muted', p.mutes[t]);
    row.vol.value = p.volumes[t];
    if (kit.channels) kit.setVolume(t, p.volumes[t]);
  });
  patternButtons.forEach((b, i) => b.classList.toggle('active', i === bank.current));
  renderEditor();
  renderBank();
}

// --- Sampler : réglages de la piste sélectionnée ---------------------

const edTrack = $('ed-track');
const edSource = $('ed-source');
const edStart = $('ed-start');
const edEnd = $('ed-end');
const edPitch = $('ed-pitch');
const edPitchValue = $('ed-pitch-value');
const wave = $('wave');
const waveEmpty = $('wave-empty');

function selectTrack(t) {
  selectedTrack = t;
  render();
}

function renderEditor() {
  const slot = bank.kit[selectedTrack];
  edTrack.textContent = `PISTE ${selectedTrack + 1}`;
  edSource.textContent = slot.sample ?? kit.sounds[selectedTrack].name;
  for (const input of [edStart, edEnd, edPitch, $('ed-reset')]) input.disabled = !slot.sample;
  edStart.value = slot.start;
  edEnd.value = slot.end;
  edPitch.value = slot.pitch;
  edPitchValue.textContent = `${slot.pitch > 0 ? '+' : ''}${slot.pitch}`;
  wave.hidden = !slot.sample;
  waveEmpty.hidden = Boolean(slot.sample);
  if (slot.sample) drawWave(slot);
}

function drawWave(slot) {
  const g = wave.getContext('2d');
  const { width, height } = wave;
  g.clearRect(0, 0, width, height);
  const buffer = kit.buffers.get(slot.sample);
  if (!buffer) {
    kit.loadSample(slot.sample).then(() => renderEditor()).catch(() => {
      edSource.textContent = `${slot.sample} (illisible)`;
    });
    return;
  }
  const data = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(data.length / width));
  g.fillStyle = '#f08a24';
  for (let x = 0; x < width; x++) {
    let peak = 0;
    for (let i = x * per, end = Math.min(data.length, i + per); i < end; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const h = Math.max(1, peak * height * 0.95);
    g.fillRect(x, (height - h) / 2, 1, h);
  }
  // On assombrit les parties coupées par Début / Fin.
  g.fillStyle = 'rgba(27, 27, 31, 0.75)';
  g.fillRect(0, 0, slot.start * width, height);
  g.fillRect(slot.end * width, 0, width - slot.end * width, height);
}

edStart.addEventListener('input', () => {
  edStart.value = setStart(bank.kit[selectedTrack], edStart.value);
  renderEditor();
  save();
});
edEnd.addEventListener('input', () => {
  edEnd.value = setEnd(bank.kit[selectedTrack], edEnd.value);
  renderEditor();
  save();
});
edPitch.addEventListener('input', () => {
  setPitch(bank.kit[selectedTrack], edPitch.value);
  renderEditor();
  save();
});
// On réécoute le résultat quand on lâche un réglage.
for (const input of [edStart, edEnd, edPitch]) {
  input.addEventListener('change', () => kit.trigger(selectedTrack));
}
$('ed-play').addEventListener('click', () => kit.trigger(selectedTrack));
$('ed-reset').addEventListener('click', () => {
  Object.assign(bank.kit[selectedTrack], createSlot());
  render();
  save();
});

async function assignSample(track, name) {
  setSample(bank.kit[track], name);
  selectedTrack = track;
  render();
  save();
  try {
    await kit.loadSample(name);
    renderEditor();
    if (!engine.playing) kit.trigger(track);
  } catch {
    edSource.textContent = `${name} (format illisible)`;
  }
}

// --- Ma banque ---------------------------------------------------------

const bankList = $('bank-list');
const bankEmpty = $('bank-empty');
const fileInput = $('file-input');

async function refreshSamples() {
  samples = await listSamples();
  renderBank();
}

function renderBank() {
  bankEmpty.hidden = samples.length > 0;
  const used = new Set(bank.kit.map((s) => s.sample));
  bankList.replaceChildren(...samples.map((name) => {
    const li = document.createElement('li');
    li.className = 'bank-item';
    li.classList.toggle('used', used.has(name));
    li.draggable = true;
    li.title = 'Clic : mettre sur la piste sélectionnée. Glisser : mettre sur une autre piste.';
    li.addEventListener('dragstart', (e) => e.dataTransfer.setData(SAMPLE_DRAG_TYPE, name));

    const label = document.createElement('button');
    label.className = 'bank-name';
    label.textContent = displayName(name);
    label.addEventListener('click', () => assignSample(selectedTrack, name));

    const del = document.createElement('button');
    del.className = 'bank-delete';
    del.textContent = '×';
    del.title = 'Retirer de la banque';
    del.addEventListener('click', () => deleteSample(name));

    li.append(label, del);
    return li;
  }));
}

async function importFiles(fileList) {
  const names = [];
  for (const file of fileList) {
    try {
      names.push(await addSample(file.name, await file.arrayBuffer()));
    } catch (err) {
      console.error(`Import impossible : ${file.name}`, err);
    }
  }
  await refreshSamples();
  return names;
}

async function deleteSample(name) {
  await removeSample(name);
  forgetSample(bank.kit, name);
  kit.forget(name);
  await refreshSamples();
  render();
  save();
}

$('import').addEventListener('click', async () => {
  const names = await importSamplesWithDialog();
  if (names === null) fileInput.click();
  else await refreshSamples();
});
fileInput.addEventListener('change', async () => {
  await importFiles(fileInput.files);
  fileInput.value = '';
});

const bankPanel = $('bank');
bankPanel.addEventListener('dragover', (e) => {
  e.preventDefault();
  bankPanel.classList.add('drop');
});
bankPanel.addEventListener('dragleave', () => bankPanel.classList.remove('drop'));
bankPanel.addEventListener('drop', async (e) => {
  e.preventDefault();
  bankPanel.classList.remove('drop');
  if (e.dataTransfer.files.length) await importFiles(e.dataTransfer.files);
});

// Sans ça, lâcher un fichier à côté d'une zone ferait "ouvrir" le fichier
// dans la fenêtre et effacerait l'appli.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

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

playBtn.addEventListener('click', togglePlay);
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
    selectPattern(Number(e.code.slice(5)) - 1);
  }
});

// Évite que la barre d'espace "clique" sur le dernier bouton utilisé.
document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLButtonElement) e.target.blur();
});

setBpm(bank.bpm, false);
render();
await refreshSamples();
// On prépare à l'avance les samples du kit, pour qu'ils sonnent dès le
// premier pas.
for (const slot of bank.kit) {
  if (slot.sample) kit.loadSample(slot.sample).then(() => renderEditor()).catch(() => {});
}
