import crypto from 'node:crypto';
import { shell, Notification, nativeImage } from 'electron';

const LASTFM_API_KEY = 'c956b7bb4233e011e39c02fdc3329d6a';
const LASTFM_SECRET = 'bb02c780cc2227dcb6f0c365af5d5531';

let currentScrobbleId: string | null = null;
let hasScrobbled = false;
let trackStartTime = 0;
let hasSentNowPlaying = false;

let pendingToken = '';

function generateSignature(params: Record<string, string>) {
    const keys = Object.keys(params).sort();
    let sig = '';

    for (const key of keys) {
        if (key !== 'format' && key !== 'callback') {
            sig += key + params[key];
        }
    }

    sig += LASTFM_SECRET;
    return crypto.createHash('md5').update(sig, 'utf-8').digest('hex');
}

async function postLastFm(params: Record<string, string>) {
    params.api_key = LASTFM_API_KEY;
    params.api_sig = generateSignature(params);
    params.format = 'json';

    const body = new URLSearchParams(params);

    try {
        const res = await fetch('http://ws.audioscrobbler.com/2.0/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        return await res.json();
    } catch (err) {
        console.error("Last.fm POST error:", err);
        return null;
    }
}


export async function startAuthFlow() {
    const params = { method: 'auth.getToken', api_key: LASTFM_API_KEY };
    const api_sig = generateSignature(params);


    try {
        const res = await fetch(`http://ws.audioscrobbler.com/2.0/?method=auth.getToken&api_key=${LASTFM_API_KEY}&api_sig=${api_sig}&format=json`);
        const data = await res.json();

        if (data.token) {
            pendingToken = data.token;
            shell.openExternal(`http://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&token=${pendingToken}`);
            return true;
        }
    } catch (err) {
        console.log('lastfm auth error : ', err);
    }

    return false;
}

export async function completeAuthFlow() {
    if (!pendingToken) return null;

    const params = { method: 'auth.getSession', api_key: LASTFM_API_KEY, token: pendingToken };
    const api_sig = generateSignature(params);

    try {
        const res = await fetch(`http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${LASTFM_API_KEY}&token=${pendingToken}&api_sig=${api_sig}&format=json`);
        const data = await res.json();

        if (data.session && data.session.key) {
            return {
                username: data.session.name,
                sessionKey: data.session.key
            };
        }
    } catch (err) {
        console.log("lastfm session error", err);
    }

    return null;
}

export async function updateNowPlaying(trackInfo: any, sessionKey: string) {
    if (!sessionKey || !trackInfo) return;

    console.log(`Last.fm: Now Playing -> ${trackInfo.track}`);

    return postLastFm({
        method: 'track.updateNowPlaying',
        artist: trackInfo.artist,
        track: trackInfo.track,
        album: trackInfo.album || '',
        duration: Math.floor(trackInfo.duration).toString(),
        sk: sessionKey
    });
}

export async function scrobbleTrack(trackInfo: any, timestampSeconds: number, sessionKey: string) {
    if (!sessionKey || !trackInfo) return;

    console.log(`Last.fm: Scrobbled -> ${trackInfo.track}`);

    return postLastFm({
        method: 'track.scrobble',
        artist: trackInfo.artist,
        track: trackInfo.track,
        album: trackInfo.album || '',
        timestamp: timestampSeconds.toString(),
        sk: sessionKey
    });
}


export async function processScrobble(trackInfo: any, isPlaying: boolean, sessionKey: string, showNotification: boolean) {
    if (!sessionKey || !trackInfo) return;

    if (trackInfo.uniqueID !== currentScrobbleId) {
        currentScrobbleId = trackInfo.uniqueID;
        hasScrobbled = false;
        hasSentNowPlaying = false;
        trackStartTime = Math.floor(Date.now() / 1000);
    }

    if (isPlaying && !hasSentNowPlaying) {
        hasSentNowPlaying = true;

        updateNowPlaying(trackInfo, sessionKey).catch(console.error);

        if (showNotification) {
            console.log("notification trigger");
            try {

                let iconImage;

                if (trackInfo.trackArt) {
                    const response = await fetch(trackInfo.trackArt);
                    const imageBuffer = await response.arrayBuffer();

                    iconImage = nativeImage.createFromBuffer(Buffer.from(imageBuffer))
                }

                new Notification({
                    title: 'Scrobbler',
                    body: `${trackInfo.track}\n${trackInfo.artist}\n${trackInfo.album}`,
                    icon: iconImage
                }).show();
            } catch (error) {
                console.log("noti error", error);

            }

        }
    }

    if (hasScrobbled || !isPlaying || trackInfo.duration < 30) return;

    const playThreshold = Math.min(trackInfo.duration / 2, 240)


    if (trackInfo.currentTime >= playThreshold) {
        hasScrobbled = true;

        scrobbleTrack(trackInfo, trackStartTime, sessionKey).catch(console.error);
    }
}