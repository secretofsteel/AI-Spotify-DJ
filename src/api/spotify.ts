// src/api/spotify.ts

let accessToken = '' // set from your store after auth

export function setAccessToken(token: string) {
  accessToken = token
}

async function spFetch(path: string, init: RequestInit = {}, retry = 0): Promise<Response> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  if (res.status === 429 && retry < 2) {
    const ra = Number(res.headers.get('Retry-After') || 1)
    await new Promise(r => setTimeout(r, ra * 1000))
    return spFetch(path, init, retry + 1)
  }
  return res
}

export async function getMe() {
  const r = await spFetch('/me')
  if (!r.ok) throw new Error(`getMe ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function transferPlayback(deviceId: string, play = true) {
  const r = await spFetch('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play }) })
  if (!r.ok) throw new Error(`transferPlayback ${r.status}: ${await r.text()}`)
}

export async function searchTracks(q: string, limit = 10) {
  const r = await spFetch(`/search?type=track&limit=${limit}&q=${encodeURIComponent(q)}`)
  if (!r.ok) throw new Error(`search ${r.status}: ${await r.text()}`)
  const data: any = await r.json()
  return data.tracks?.items ?? []
}

export async function createPlaylist(userId: string, name: string, isPublic = false) {
  const r = await spFetch(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, public: isPublic, description: 'AI Hour' })
  })
  if (!r.ok) throw new Error(`createPlaylist ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function addTracks(playlistId: string, uris: string[]) {
  const r = await spFetch(`/playlists/${playlistId}/tracks`, { method: 'POST', body: JSON.stringify({ uris }) })
  if (!r.ok) throw new Error(`addTracks ${r.status}: ${await r.text()}`)
}

export async function playContext(context_uri: string, offsetUri?: string) {
  const body: any = { context_uri }
  if (offsetUri) body.offset = { uri: offsetUri }
  const r = await spFetch('/me/player/play', { method: 'PUT', body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`playContext ${r.status}: ${await r.text()}`)
}

export async function addToQueue(uri: string) {
  const r = await spFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: 'POST', headers: {} })
  if (r.status === 204) return
  const text = await r.text() // don’t json-parse a 204 body
  if (!r.ok) throw new Error(`Queue failed: ${r.status} ${text || ''}`)
}

export async function getAudioFeatures(id: string) {
  const r = await spFetch(`/audio-features/${id}`)
  if (!r.ok) throw new Error(`audio-features ${r.status}: ${await r.text()}`)
  return r.json() as Promise<{ loudness: number }>
}

export async function getAudioAnalysis(id: string) {
  const r = await spFetch(`/audio-analysis/${id}`)
  if (!r.ok) throw new Error(`audio-analysis ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function getPlaybackState() {
  const r = await spFetch('/me/player')
  if (r.status === 204) return null
  if (!r.ok) throw new Error(`playback ${r.status}: ${await r.text()}`)
  return r.json()
}
