import { transferPlayback } from '../api/spotify';
import { applyLevelingForNextTrack } from './leveling';
import { mapSdkTrackToTrackInfo, usePlayerStore } from '../store/usePlayerStore';

type StateCallback = (state: Spotify.PlaybackState) => void;

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let sdkLoadingPromise: Promise<void> | null = null;
const stateListeners = new Set<StateCallback>();

let lastCurrentTrackId: string | null = null;
let lastNextTrackId: string | null = null;

function waitForSpotifySDK(): Promise<void> {
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Spotify SDK can only load in the browser.'));
      return;
    }

    if ((window as unknown as { Spotify?: Spotify.SpotifyNamespace }).Spotify) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK.'));
    document.body.appendChild(script);

    (window as unknown as { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };
  });

  return sdkLoadingPromise;
}

function bindPlayerEvents(instance: Spotify.Player): void {
  const store = usePlayerStore.getState();

  instance.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    store.setDevice(device_id);
    store.log(`Player ready on device ${device_id}`);
    transferPlayback(device_id, true).catch((error) => {
      store.log(`Failed to transfer playback: ${(error as Error).message}`, 'warn');
    });
  });

  instance.addListener('not_ready', ({ device_id }) => {
    store.log(`Device ${device_id} went offline`, 'warn');
    if (deviceId === device_id) {
      deviceId = null;
      store.setDevice(null);
    }
  });

  instance.addListener('initialization_error', ({ message }) => store.log(`Player init error: ${message}`, 'error'));
  instance.addListener('authentication_error', ({ message }) => store.log(`Player auth error: ${message}`, 'error'));
  instance.addListener('account_error', ({ message }) => store.log(`Player account error: ${message}`, 'error'));
  instance.addListener('playback_error', ({ message }) => store.log(`Playback error: ${message}`, 'error'));

  instance.addListener('player_state_changed', async (state) => {
    if (!state) {
      return;
    }

    const currentTrack = mapSdkTrackToTrackInfo(state.track_window?.current_track);
    const nextTrack = mapSdkTrackToTrackInfo(state.track_window?.next_tracks?.[0]);

    store.setPlaybackState({
      currentTrack,
      nextTrack,
      progressMs: state.position,
      durationMs: state.duration,
      paused: state.paused
    });

    if (typeof state.position === 'number' && state.position < 5000 && nextTrack?.id) {
      if (lastCurrentTrackId !== currentTrack?.id || lastNextTrackId !== nextTrack.id) {
        applyLevelingForNextTrack(instance, nextTrack.id).catch((error) => {
          store.log(`Leveling error: ${(error as Error).message}`, 'warn');
        });
      }
    }

    if (currentTrack?.id) {
      lastCurrentTrackId = currentTrack.id;
    }
    if (nextTrack?.id) {
      lastNextTrackId = nextTrack.id;
    }

    stateListeners.forEach((listener) => listener(state));
  });
}

export async function initPlayer(name = 'Office Party Deck'): Promise<Spotify.Player> {
  if (player) {
    return player;
  }

  await waitForSpotifySDK();
  const store = usePlayerStore.getState();
  const { token, volume } = store;

  if (!token) {
    throw new Error('Cannot initialize player without access token.');
  }

  const SpotifyNamespace = (window as unknown as { Spotify: Spotify.SpotifyNamespace }).Spotify;
  player = new SpotifyNamespace.Player({
    name,
    getOAuthToken: (cb) => {
      const latestToken = usePlayerStore.getState().token;
      if (latestToken) {
        cb(latestToken.accessToken);
      }
    },
    volume
  });

  bindPlayerEvents(player);
  return player;
}

export async function connectPlayer(): Promise<boolean> {
  if (!player) {
    await initPlayer();
  }
  return player ? player.connect() : false;
}

export function getDeviceId(): string | null {
  return deviceId;
}

export function getPlayer(): Spotify.Player | null {
  return player;
}

export function onStateChanged(callback: StateCallback): () => void {
  stateListeners.add(callback);
  return () => stateListeners.delete(callback);
}
