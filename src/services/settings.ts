import { app, App } from "electron";
import path from 'node:path';
import fs from 'node:fs'


const settingsPath = path.join(app.getPath('userData'), 'wrapper-settings.json')

export function loadSettings() {
    try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } catch (err) {
        return {discordRpc: true, lastFmToken: ''}
    }
}

export function saveSettings(newSettings: string){
    fs.writeFileSync(settingsPath, JSON.stringify(newSettings))
}