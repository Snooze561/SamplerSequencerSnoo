const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { SampleLibrary, AUDIO_EXTENSIONS } = require('./lib/sample-library');

// Les patterns sont rangés dans le dossier de données de l'appli
// (%APPDATA%\Snoo Sequencer sous Windows), pas dans le dossier d'installation.
const patternsFile = () => path.join(app.getPath('userData'), 'patterns.json');

ipcMain.handle('patterns:load', async () => {
  try {
    return await fs.readFile(patternsFile(), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('patterns:save', async (_event, json) => {
  // Écriture dans un fichier temporaire puis renommage : un plantage
  // pendant la sauvegarde ne peut pas abîmer le fichier existant.
  const tmp = patternsFile() + '.tmp';
  await fs.writeFile(tmp, json, 'utf8');
  await fs.rename(tmp, patternsFile());
});

const library = () => new SampleLibrary(path.join(app.getPath('userData'), 'samples'));

ipcMain.handle('samples:list', () => library().list());
ipcMain.handle('samples:read', (_event, name) => library().read(name));
ipcMain.handle('samples:remove', (_event, name) => library().remove(name));
ipcMain.handle('samples:add', (_event, name, bytes) => library().add(name, Buffer.from(bytes)));

ipcMain.handle('samples:import', async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Importer des sons',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Sons', extensions: AUDIO_EXTENSIONS.map((e) => e.slice(1)) }],
  });
  if (result.canceled) return [];
  const lib = library();
  const names = [];
  for (const file of result.filePaths) names.push(await lib.addFromPath(file));
  return names;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1b1b1f',
    title: 'Snoo Sequencer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
