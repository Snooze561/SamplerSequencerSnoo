// Pont entre Electron et l'interface. Vide pour l'instant :
// on y exposera l'accès aux fichiers (samples, patterns) dans les étapes suivantes.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('snoo', {
  version: '0.1.0',
});
