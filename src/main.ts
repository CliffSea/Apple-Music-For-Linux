import { app, BrowserWindow, components, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { readFileSync } from 'node:fs';
import { loadSettings, saveSettings } from './services/settings';
import { connectRPC, disconnectRPC, updatePresence } from './services/discord';
import { completeAuthFlow, processScrobble, startAuthFlow } from './services/scrobbling';


if (started) {
  app.quit();
}

let userSettings = loadSettings();

let isQuitting = false;

connectRPC();

ipcMain.handle('get-settings', () => userSettings);

ipcMain.on('save-settings', (e, newSettings) => {
  userSettings = { ...userSettings, ...newSettings };
  saveSettings(newSettings)
});

ipcMain.on('music-data-update', async (e, data) => {
  const { trackInfo, isPlaying } = data;

  if (!trackInfo) return;
  await updatePresence(trackInfo, isPlaying, userSettings.discordRpc);

  await processScrobble(trackInfo, isPlaying, userSettings.lastFmToken);
})

ipcMain.handle('lastfm-login', async () => {
  const success = await startAuthFlow();
  return success;
});

ipcMain.handle('lastfm-complete-login', async () => {
  const result = await completeAuthFlow();

  if (result) {
    userSettings.lastFmToken = result.sessionKey;
    saveSettings(userSettings);

    return result.username;
  }
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 300,
    minWidth: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    },
  });

  mainWindow.setMenu(null)

  mainWindow.loadURL("https://music.apple.com");

  mainWindow.webContents.openDevTools();

  const injectCode = path.join(__dirname, "musickitInject.js")
  const code = readFileSync(injectCode, 'utf-8')


  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(code + '\nundefined;')
      .then(() => console.log("injected"))
      .catch(err => console.error("Injection failed:", err));
  })



  mainWindow.on('close', (e) => {
    if (isQuitting) return;

    isQuitting = true;
    e.preventDefault();

    disconnectRPC().finally(() => {
      app.exit(0);
    })

    setTimeout(() => {
      app.exit(0);
    }, 500);
  });

  return false;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(async () => {
  await components.whenReady()
  createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.exit(0);
  }
});



app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('enable-wayland-ime');

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
