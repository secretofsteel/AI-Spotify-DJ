import { usePlayerStore } from '../store/usePlayerStore';

const API_BASE = 'https://api.spotify.com/v1';
const MAX_RETRY = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyFetch<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const { token, setNetworkError, log } = usePlayerStore.getState();

  if (!token) {
    throw new Error('No Spotify access token available.');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `${token.tokenType ?? 'Bearer'} ${token.accessToken}`
  };

  if (init?.headers) {
    Object.assign(headers, init.headers);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (response.status === 204) {
    return null as T;
  }

  if (response.status === 429 && attempt < MAX_RETRY) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000;
    log(`Rate limited by Spotify. Retrying in ${retryAfter}ms`, 'warn');
    await sleep(retryAfter);
    return spotifyFetch<T>(path, init, attempt + 1);
  }

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 403) {
      setNetworkError('Spotify Premium is required to use the web playback SDK.');
    } else if (response.status === 404) {
      setNetworkError('No active Spotify device found. Open Spotify on another device or retry.');
    }
    throw new Error(`Spotify API error ${response.status}: ${message}`);
  }

  setNetworkError(null);
  return (await response.json()) as T;
}

export async function getMe(): Promise<{ id: string; display_name?: string }> {
  const data = await spotifyFetch<SpotifyApi.CurrentUsersProfileResponse>('/me', {
    method: 'GET'
  });
  const { setIsPremium, log } = usePlayerStore.getState();
  setIsPremium(data.product === 'premium');
  log(`Logged in as ${data.display_name ?? data.id}`);
  return { id: data.id, display_name: data.display_name ?? undefined };
}

export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  await spotifyFetch<void>('/me/player', {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [deviceId],
      play
    })
  });
  usePlayerStore.getState().log(`Transferred playback to browser device (${deviceId}).`);
}

export async function searchTracks(q: string, limit = 10): Promise<SpotifyApi.TrackObjectFull[]> {
  if (!q.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    q,
    type: 'track',
    limit: String(limit)
  });

  const data = await spotifyFetch<SpotifyApi.SearchResponse>(`/search?${params.toString()}`, {
    method: 'GET'
  });

  return data.tracks?.items ?? [];
}

export async function createPlaylist(userId: string, name: string, isPublic: boolean): Promise<{ id: string }> {
  const data = await spotifyFetch<SpotifyApi.CreatePlaylistResponse>(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      public: isPublic
    })
  });
  usePlayerStore.getState().log(`Created playlist "${name}".`);
  return { id: data.id };
}

export async function addTracks(playlistId: string, uris: string[]): Promise<void> {
  if (uris.length === 0) {
    return;
  }

  await spotifyFetch<void>(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris })
  });
  usePlayerStore.getState().log(`Added ${uris.length} tracks to playlist ${playlistId}.`);
}

export async function playContext(context_uri: string, offsetUri?: string): Promise<void> {
  await spotifyFetch<void>('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify(
      offsetUri
        ? {
            context_uri,
            offset: { uri: offsetUri }
          }
        : {
            context_uri
          }
    )
  });
  usePlayerStore.getState().log(`Started playback for ${context_uri}.`);
}

export async function addToQueue(uri: string): Promise<void> {
  const params = new URLSearchParams({ uri });
  await spotifyFetch<void>(`/me/player/queue?${params.toString()}`, {
    method: 'POST'
  });
  usePlayerStore.getState().log(`Queued ${uri}.`);
}

export async function getAudioFeatures(id: string): Promise<{ loudness: number }> {
  const data = await spotifyFetch<SpotifyApi.AudioFeaturesResponse>(`/audio-features/${id}`, {
    method: 'GET'
  });
  return { loudness: data.loudness ?? -14 };
}

export async function getAudioAnalysis(id: string): Promise<SpotifyApi.AudioAnalysisResponse> {
  return spotifyFetch<SpotifyApi.AudioAnalysisResponse>(`/audio-analysis/${id}`, {
    method: 'GET'
  });
}

export async function getPlaybackState(): Promise<SpotifyApi.CurrentPlaybackResponse | null> {
  try {
    return await spotifyFetch<SpotifyApi.CurrentPlaybackResponse | null>('/me/player', {
      method: 'GET'
    });
  } catch (error) {
    const err = error as Error;
    usePlayerStore.getState().log(`Failed to fetch playback state: ${err.message}`, 'warn');
    return null;
  }
}
