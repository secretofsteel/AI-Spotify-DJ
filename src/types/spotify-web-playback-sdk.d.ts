export {}

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => WebPlaybackPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

interface WebPlaybackPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(
    event:
      | 'ready'
      | 'not_ready'
      | 'player_state_changed'
      | 'initialization_error'
      | 'authentication_error'
      | 'account_error'
      | 'playback_error',
    cb: (data: any) => void
  ): boolean
  removeListener(event: string): void
  getCurrentState(): Promise<any>
  getVolume(): Promise<number>
  setVolume(v: number): Promise<void>
  togglePlay(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
}
