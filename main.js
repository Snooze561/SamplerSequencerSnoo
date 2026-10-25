const { app, BrowserWindow, ipcMain, dialog, net, safeStorage, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { SampleLibrary, AUDIO_EXTENSIONS } = require('./lib/sample-library');
const freesound = require('./lib/freesound');
const openverse = require('./lib/openverse');

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

// --- Freesound ---------------------------------------------------------
// La clé API est chiffrée par Windows (safeStorage) quand c'est possible,
// et ne sort jamais du processus principal.

const keyFile = () => path.join(app.getPath('userData'), 'freesound-key');

async function readKey() {
  try {
    const data = await fs.readFile(keyFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString('utf8');
  } catch {
    return '';
  }
}

async function writeKey(key) {
  if (!key) return fs.rm(keyFile(), { force: true });
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, 'utf8');
  return fs.writeFile(keyFile(), data);
}

// net.fetch passe par la connexion de Chromium, qui suit les réglages
// réseau et proxy de Windows.
const fetchImpl = (url, init) => net.fetch(url, init);

ipcMain.handle('freesound:has-key', async () => Boolean(await readKey()));
ipcMain.handle('freesound:set-key', (_event, key) => writeKey(String(key ?? '').trim()));
ipcMain.handle('freesound:search', async (_event, options) => freesound.search(fetchImpl, await readKey(), options));

ipcMain.handle('freesound:add', async (_event, sound) => {
  if (!sound || !Number.isInteger(sound.id) || typeof sound.name !== 'string') {
    throw new Error('Son Freesound invalide.');
  }
  const bytes = await freesound.downloadPreview(fetchImpl, sound.preview);
  return addDownloaded(freesound.fileNameFor(sound), bytes, sound);
});

// --- Openverse (sans compte) ----------------------------------------------

ipcMain.handle('openverse:search', (_event, options) => openverse.search(fetchImpl, options));

ipcMain.handle('openverse:add', async (_event, sound) => {
  if (!sound || typeof sound.id !== 'string' || typeof sound.name !== 'string' || typeof sound.ext !== 'string') {
    throw new Error('Son Openverse invalide.');
  }
  const bytes = await openverse.download(fetchImpl, sound.preview);
  return addDownloaded(openverse.fileNameFor(sound), bytes, sound);
});

async function addDownloaded(fileName, bytes, sound) {
  const lib = library();
  const name = await lib.add(fileName, bytes);
  // On garde la trace de l'auteur et de la licence de chaque son téléchargé.
  await fs.appendFile(path.join(lib.dir, 'CREDITS.txt'), freesound.creditLine(sound, name), 'utf8');
  return name;
}

// --- Export WAV ------------------------------------------------------------

ipcMain.handle('export:save', async (event, suggestedName, bytes) => {
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Exporter en WAV',
    defaultPath: path.join(app.getPath('music'), suggestedName),
    filters: [{ name: 'Son WAV', extensions: ['wav'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, Buffer.from(bytes));
  return result.filePath;
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

  // Les liens (Freesound, licences) s'ouvrent dans le navigateur habituel,
  // jamais dans la fenêtre de l'appli.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());

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
