// Pont entre Electron et l'interface : seules ces fonctions sont
// accessibles depuis la page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snoo', {
  version: '0.5.0',
  loadPatterns: () => ipcRenderer.invoke('patterns:load'),
  savePatterns: (json) => ipcRenderer.invoke('patterns:save', json),
  listSamples: () => ipcRenderer.invoke('samples:list'),
  readSample: (name) => ipcRenderer.invoke('samples:read', name),
  removeSample: (name) => ipcRenderer.invoke('samples:remove', name),
  addSample: (name, bytes) => ipcRenderer.invoke('samples:add', name, bytes),
  importSamples: () => ipcRenderer.invoke('samples:import'),
  freesoundHasKey: () => ipcRenderer.invoke('freesound:has-key'),
  freesoundSetKey: (key) => ipcRenderer.invoke('freesound:set-key', key),
  freesoundSearch: (options) => ipcRenderer.invoke('freesound:search', options),
  freesoundAdd: (sound) => ipcRenderer.invoke('freesound:add', sound),
  openverseSearch: (options) => ipcRenderer.invoke('openverse:search', options),
  openverseAdd: (sound) => ipcRenderer.invoke('openverse:add', sound),
  saveWav: (suggestedName, bytes) => ipcRenderer.invoke('export:save', suggestedName, bytes),
});
