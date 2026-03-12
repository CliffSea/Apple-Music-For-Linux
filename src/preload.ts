import { contextBridge, ipcRenderer } from "electron";

window.addEventListener('message', (e) => {
    if (e.data.sender === 'web-scrobbler' && e.data.type === 'MUSICKIT_STATE') {
        ipcRenderer.send('music-data-update', e.data);
    }
})