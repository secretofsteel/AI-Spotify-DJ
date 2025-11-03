import { getAudioFeatures } from '../api/spotify';
import { usePlayerStore } from '../store/usePlayerStore';

const RAMP_DURATION_MS = 2000;
const RAMP_STEPS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function applyLevelingForNextTrack(player: Spotify.Player, nextTrackId: string): Promise<void> {
  if (!nextTrackId) {
    return;
  }

  const { log, setVolume } = usePlayerStore.getState();

  try {
    const { loudness } = await getAudioFeatures(nextTrackId);
    const targetDb = -14;
    const factor = Math.min(1, Math.max(0.4, Math.pow(10, (targetDb - loudness) / 20)));

    const currentVolume = await player.getVolume().catch(() => usePlayerStore.getState().volume);
    const startVolume = typeof currentVolume === 'number' ? currentVolume : usePlayerStore.getState().volume;

    if (Math.abs(startVolume - factor) < 0.01) {
      return;
    }

    const delta = factor - startVolume;
    const interval = RAMP_DURATION_MS / RAMP_STEPS;

    for (let step = 1; step <= RAMP_STEPS; step += 1) {
      const nextVolume = Math.min(1, Math.max(0.4, startVolume + (delta * step) / RAMP_STEPS));
      await player.setVolume(nextVolume);
      setVolume(nextVolume);
      await sleep(interval);
    }

    log(`Leveled next track (${nextTrackId}) to ${factor.toFixed(2)} target.`);
  } catch (error) {
    const err = error as Error;
    log(`Failed leveling next track: ${err.message}`, 'warn');
  }
}
