// src/player/sdk.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

let player: any
let deviceId: string | null = null

export function getDeviceId() {
  return deviceId
}
export function getPlayer() {
  return player
}

export async function initPlayer(getOAuthToken: (cb: (t: string) => void) => void, onState: (s: any) => void) {
  // load script if needed
  if (!('Spotify' in window)) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://sdk.scdn.co/spotify-player.js'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Spotify SDK'))
      document.body.appendChild(s)
    })
  }

  // @ts-ignore
  window.onSpotifyWebPlaybackSDKReady = () => {
    // @ts-ignore
    player = new window.Spotify.Player({
      name: 'Office Party Deck',
      getOAuthToken
    })

    player.addListener('ready', ({ device_id }: any) => {
      deviceId = device_id
      console.log('[SDK] ready device', device_id)
    })
    player.addListener('not_ready', ({ device_id }: any) => {
      console.warn('[SDK] device not ready', device_id)
    })
    player.addListener('player_state_changed', (s: any) => onState(s))
    player.addListener('initialization_error', ({ message }: any) => console.error('init_error', message))
    player.addListener('authentication_error', ({ message }: any) => console.error('auth_error', message))
    player.addListener('account_error', ({ message }: any) => console.error('acct_error', message))
    player.addListener('playback_error', ({ message }: any) => console.error('play_error', message))

    player.connect()
  }
}
