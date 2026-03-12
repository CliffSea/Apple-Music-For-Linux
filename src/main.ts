import { app, BrowserWindow, components, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { readFileSync } from 'node:fs';
import { Client } from '@xhayper/discord-rpc'

if (started) {
  app.quit();
}

const clientId = "1481492981377925252";
const rpc = new Client({ clientId })

let currentTrack: unknown = null;
let wasPlaying = false;
let lasStartTime = 0;

let isQuitting = false;


rpc.on('ready', () => {
  console.log("connected");
})

rpc.login().catch(console.error)

ipcMain.on('music-data-update', (e, data) => {
  const { trackInfo, isPlaying } = data;

  if (!trackInfo) return;

  if (!isPlaying) {
    if (wasPlaying) {
      rpc.user.clearActivity().catch(console.error);
      wasPlaying = false;
      currentTrack = null;
    }
    return;
  }

  const now = Date.now();
  const startTimestamp = Math.floor(now - (trackInfo.currentTime * 1000));
  const endTimestamp = Math.floor(startTimestamp + (trackInfo.duration * 1000));

  const isNewTrack = trackInfo.uniqueID !== currentTrack;
  const stateChanged = isPlaying !== wasPlaying;
  const didSeek = Math.abs(startTimestamp - lasStartTime) > 2000;


  if (isNewTrack || stateChanged || didSeek) {
    rpc.user?.setActivity({
      details: trackInfo.track,
      state: trackInfo.artist,
      startTimestamp,
      endTimestamp,
      largeImageKey: trackInfo.trackArt,
      largeImageText: trackInfo.album,
      type: 2,
    }).catch(console.error);
  }

  currentTrack = trackInfo.uniqueID;
  wasPlaying = isPlaying;
  lasStartTime = startTimestamp;

})

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
    if(isQuitting) return;

    isQuitting = true;
    e.preventDefault();

    Promise.all([
        rpc.user?.clearActivity(),
        rpc.destroy()
    ]).catch((err) => {
      console.log(err);
    }).finally(() => {
      app.exit(0);
    })

    setTimeout(() => {
      app.exit(0);
    }, 500);
  });


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
