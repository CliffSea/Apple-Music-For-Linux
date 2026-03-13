import { Client } from '@xhayper/discord-rpc'

const clientId = "1481492981377925252";
const rpc = new Client({ clientId })


let currentTrack: unknown = null;
let wasPlaying = false;
let lasStartTime = 0;


rpc.on('ready', () => {
    console.log("connected");
});

export function connectRPC() {
    rpc.login().catch(console.error);
}

export async function updatePresence(trackInfo: any, isPlaying: boolean, discordEnabled: boolean) {
    
    if (!isPlaying) {
        if (wasPlaying) {
            rpc.user.clearActivity().catch(console.error)
            wasPlaying = false;
            currentTrack = null;
        }
        return;
    }
    
    if(!discordEnabled){
        if (wasPlaying) {
            rpc.user.clearActivity().catch(console.error)
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
}


export async function disconnectRPC() {
    if (rpc) {
        try {
            await rpc.user?.clearActivity();
            await rpc.destroy();
        } catch (err) {
            console.log(err);

        }
    }
}