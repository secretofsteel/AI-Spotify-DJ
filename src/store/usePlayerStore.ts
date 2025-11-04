// src/store/usePlayerStore.ts
import { create } from 'zustand'

type State = {
  token: string | null
  refreshToken?: string | null
  me: any | null
  deviceId: string | null
  currentTrack: any | null
  nextTrack: any | null
  progressMs: number
  durationMs: number
  paused: boolean
  volume: number
  isPremium: boolean
  logs: string[]
}

type Actions = {
  setToken: (t: string | null, refresh?: string | null) => void
  setMe: (m: any | null) => void
  setDevice: (id: string | null) => void
  setPlaybackState: (s: Partial<State>) => void
  setVolume: (v: number) => void
  log: (m: string) => void
}

export const usePlayerStore = create<State & Actions>((set) => ({
  token: null,
  refreshToken: null,
  me: null,
  deviceId: null,
  currentTrack: null,
  nextTrack: null,
  progressMs: 0,
  durationMs: 0,
  paused: true,
  volume: 0.8,
  isPremium: true,
  logs: [],
  setToken: (t, r) => set({ token: t, refreshToken: r ?? null }),
  setMe: (m) => set({ me: m }),
  setDevice: (id) => set({ deviceId: id }),
  setPlaybackState: (s) => set(s),
  setVolume: (v) => set({ volume: v }),
  log: (m) => set((st) => ({ logs: [`${new Date().toLocaleTimeString()}  ${m}`, ...st.logs].slice(0, 50) }))
}))
