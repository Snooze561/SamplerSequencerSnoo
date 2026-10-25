const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
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
