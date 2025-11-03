import { create } from 'zustand';

export interface TokenData {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  refreshToken?: string;
  scope?: string;
}

export interface TrackInfo {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumName: string;
  albumImage?: string;
}

export interface LogEntry {
  id: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: string;
}

export interface PlayerState {
  token: TokenData | null;
  me: { id: string; display_name?: string } | null;
  deviceId: string | null;
  currentTrack: TrackInfo | null;
  nextTrack: TrackInfo | null;
  progressMs: number;
  durationMs: number;
  paused: boolean;
  volume: number;
  isPremium: boolean;
  networkError: string | null;
  logs: LogEntry[];
  setToken: (token: TokenData | null) => void;
  setMe: (me: PlayerState['me']) => void;
  setDevice: (deviceId: string | null) => void;
  setPlaybackState: (state: Partial<Pick<PlayerState, 'currentTrack' | 'nextTrack' | 'progressMs' | 'durationMs' | 'paused'>>) => void;
  setVolume: (volume: number) => void;
  setIsPremium: (isPremium: boolean) => void;
  setNetworkError: (message: string | null) => void;
  log: (message: string, level?: LogEntry['level']) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  token: null,
  me: null,
  deviceId: null,
  currentTrack: null,
  nextTrack: null,
  progressMs: 0,
  durationMs: 0,
  paused: true,
  volume: 0.8,
  isPremium: false,
  networkError: null,
  logs: [],
  setToken: (token) => set({ token }),
  setMe: (me) => set({ me }),
  setDevice: (deviceId) => set({ deviceId }),
  setPlaybackState: (payload) =>
    set((state) => ({
      ...state,
      ...payload
    })),
  setVolume: (volume) => set({ volume }),
  setIsPremium: (isPremium) => set({ isPremium }),
  setNetworkError: (message) => set({ networkError: message }),
  log: (message, level = 'info') =>
    set((state) => {
      const entry: LogEntry = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        message,
        level,
        timestamp: new Date().toISOString()
      };
      const logs = [...state.logs, entry];
      return { logs: logs.slice(-50) };
    })
}));

export const mapSdkTrackToTrackInfo = (track: Spotify.Track | SpotifyApi.TrackObjectFull | null | undefined): TrackInfo | null => {
  if (!track) {
    return null;
  }

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: 'artists' in track ? track.artists.map((artist) => artist.name).join(', ') : '',
    albumName: 'album' in track ? track.album.name : '',
    albumImage: 'album' in track && track.album.images && track.album.images.length > 0 ? track.album.images[0].url : undefined
  };
};
