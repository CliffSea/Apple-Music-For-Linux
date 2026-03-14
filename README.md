# Apple Music For Linux

## What is it / Description

Apple doesn't offer a linux version of apple music so this is a wrapper of the web version using [electron](https://github.com/castlabs/electron-releases) with some additional features

## Features

- Discord Presence
- Last.FM scrobbling
- Settings menu

## How to install

The app produces on default a zip and a appimage
you can use any appimage manager you prefer I recommend:

https://github.com/TheAssassin/AppImageLauncher

flatpak and aur support is still todo

## Setup

1. Clone the repo 
2. ``` bun install ```
3. ``` bun run start ```

## Build

The only build avaliable rigth now is appimage

1. Clone the repo
2. ``` bun install ```
3. ``` bun run appimage ```


## Screenshots

![](/resources/main.png)
![](/resources/lastfm.png)
![](/resources/discord.png)

## Credits

- Electron fork with widevine https://github.com/castlabs/electron-releases

- newer fork of discordjs/rpc https://github.com/xhayper/discord-rpc

- MusicKit "Api" https://github.com/web-scrobbler/web-scrobbler/blob/9880c498a90025e3b0cf4748943246e0ccf52c94/src/connectors/musickit-dom-inject.ts
