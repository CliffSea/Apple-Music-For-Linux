import { app, BrowserWindow, components, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import os from 'node:os'
import started from 'electron-squirrel-startup';
import { readFileSync } from 'node:fs';
import { loadSettings, saveSettings } from './services/settings';
import { connectRPC, disconnectRPC, updatePresence } from './services/discord';
import { completeAuthFlow, processScrobble, startAuthFlow } from './services/scrobbling';

let mainWindow: BrowserWindow = null;
const gotTheLock = app.requestSingleInstanceLock()

const iconPath = path.join(__dirname, 'assets','icon.png' )
const icon = nativeImage.createFromPath(iconPath);

if (started) {
  app.quit();
}

let userSettings = loadSettings();
let isQuitting = false;

if(process.platform == 'linux' && process.env.APPIMAGE){
  const uid = os.userInfo().uid;

  process.env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
  process.env.TMPDIR = '/tmp'
}

connectRPC();

ipcMain.handle('get-settings', () => userSettings);

ipcMain.on('save-settings', (e, newSettings) => {
  userSettings = { ...userSettings, ...newSettings };
  saveSettings(userSettings)
});

ipcMain.on('music-data-update', async (e, data) => {
  const { trackInfo, isPlaying } = data;

  if (!trackInfo) return;
  await updatePresence(trackInfo, isPlaying, userSettings.discordRpc);

  await processScrobble(trackInfo, isPlaying, userSettings.lastFmToken, userSettings.scrobbleNotifications);
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

// lock the app to a single instance
if (!gotTheLock) {
  app.quit();
}else{
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
  await components.whenReady()
  initWindow()
})

}

const initWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 300,
    minWidth: 400,
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    },
  });

  mainWindow.setMenu(null)
  mainWindow.loadURL("https://music.apple.com");

  //mainWindow.webContents.openDevTools();


  //Injecting the musickit "api"
  const injectCode = path.join(__dirname, "musickitInject.js")
  const code = readFileSync(injectCode, 'utf-8')

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(code + '\nundefined;')
      .then(() => console.log("injected"))
      .catch(err => console.error("Injection failed:", err));
  })


  //fix for weird bug I got preveting me for closing the app 
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.exit(0);
  }
});

app.on('activate', () => {
   if (BrowserWindow.getAllWindows().length === 0) {
    initWindow();
  }
});

// arguments for wayland
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('enable-wayland-ime');
