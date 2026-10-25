// Encodage WAV 16 bits (le format que tous les logiciels de musique lisent).
// Sans dépendance au navigateur (testable).

export function encodeWav(channels, sampleRate) {
  const channelCount = channels.length;
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataSize = frames * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}
