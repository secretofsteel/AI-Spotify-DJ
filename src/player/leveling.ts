// src/player/leveling.ts
import { getAudioFeatures } from '../api/spotify'

export async function applyLevelingForNextTrack(player: any, nextTrackId: string) {
  if (!player || !nextTrackId) return
  try {
    const feats = await getAudioFeatures(nextTrackId)
    const loudness = (feats as any).loudness ?? -14
    const targetDb = -14
    const delta = targetDb - loudness
    const factor = Math.min(1.0, Math.max(0.4, Math.pow(10, delta / 20)))
    const current = await player.getVolume()
    const steps = 20
    const step = (factor - current) / steps
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 100))
      await player.setVolume(current + step * i)
    }
  } catch (e) {
    console.warn('leveling failed', e)
  }
}
