// Pont entre Electron et l'interface : seules ces fonctions sont
// accessibles depuis la page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snoo', {
  version: '0.2.0',
  loadPatterns: () => ipcRenderer.invoke('patterns:load'),
  savePatterns: (json) => ipcRenderer.invoke('patterns:save', json),
});
