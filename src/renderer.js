import { AudioEngine, STEPS_PER_BAR } from './audio/engine.js';

const engine = new AudioEngine();

const playBtn = document.getElementById('play');
const bpmInput = document.getElementById('bpm');
const bpmRange = document.getElementById('bpm-range');
const volume = document.getElementById('volume');
const metronome = document.getElementById('metronome');
const stepsEl = document.getElementById('steps');

const stepEls = [];
for (let i = 0; i < STEPS_PER_BAR; i++) {
  const el = document.createElement('div');
  el.className = 'step';
  el.textContent = i + 1;
  stepsEl.appendChild(el);
  stepEls.push(el);
}

let lit = null;
engine.onStepChange((step) => {
  if (lit) lit.classList.remove('current');
  lit = step >= 0 ? stepEls[step] : null;
  if (lit) lit.classList.add('current');
});

function togglePlay() {
  const playing = engine.toggle();
  playBtn.classList.toggle('active', playing);
  playBtn.textContent = playing ? '■ STOP' : '▶ PLAY';
}

function setBpm(value) {
  const bpm = engine.setBpm(value);
  bpmInput.value = bpm;
  bpmRange.value = bpm;
}

playBtn.addEventListener('click', () => { togglePlay(); playBtn.blur(); });
bpmRange.addEventListener('input', () => setBpm(bpmRange.value));
bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
volume.addEventListener('input', () => engine.setMasterVolume(Number(volume.value)));
metronome.addEventListener('change', () => { engine.metronome = metronome.checked; });

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    togglePlay();
  }
});
