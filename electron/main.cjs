// Desktop shell: loads the same static build the browser version uses, in a plain window.
// No Node integration is exposed to the page - the app is entirely client-side already and
// has no need to touch the filesystem/network beyond what a normal browser page can do
// (file open/download happen through the same <input type=file>/Blob download the web
// version uses), so this stays a small, low-privilege wrapper rather than a "real" Electron app.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Pokémon Save Editor',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Loads the standalone single-file build (everything inlined) rather than the regular multi-
  // asset dist/ build, so there are no root-relative asset paths to resolve under file://.
  win.loadFile(path.join(__dirname, '..', 'dist-standalone', 'index.html'));
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
