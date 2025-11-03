import { ChangeEvent, useCallback } from 'react';
import { playContext } from '../api/spotify';
import { getPlayer } from '../player/sdk';
import { usePlayerStore } from '../store/usePlayerStore';

const PANIC_PLAYLIST_URI = 'spotify:playlist:37i9dQZF1DX1A3NnK0nPfg'; // Feel-good fallback

export default function Controls(): JSX.Element {
  const paused = usePlayerStore((state) => state.paused);
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const log = usePlayerStore((state) => state.log);

  const ensurePlayer = useCallback(() => {
    const instance = getPlayer();
    if (!instance) {
      log('Spotify player not ready yet. Give it a moment.', 'warn');
    }
    return instance;
  }, [log]);

  const togglePlay = async () => {
    const instance = ensurePlayer();
    if (!instance) {
      return;
    }
    await instance.togglePlay();
  };

  const next = async () => {
    const instance = ensurePlayer();
    if (!instance) {
      return;
    }
    await instance.nextTrack();
  };

  const prev = async () => {
    const instance = ensurePlayer();
    if (!instance) {
      return;
    }
    await instance.previousTrack();
  };

  const onVolumeChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value) / 100;
    const instance = ensurePlayer();
    if (!instance) {
      return;
    }
    await instance.setVolume(value);
    setVolume(value);
  };

  const panic = async () => {
    try {
      await playContext(PANIC_PLAYLIST_URI);
      log('Panic mode engaged – switching to fallback playlist!', 'warn');
    } catch (error) {
      log(`Failed to start fallback playlist: ${(error as Error).message}`, 'error');
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <h2 className="mb-3 text-lg font-semibold text-white">Deck Controls</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={prev}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Skip
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="volume-slider" className="text-xs uppercase text-slate-400">
            Volume
          </label>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={onVolumeChange}
            className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400"
          />
          <span className="w-12 text-right text-xs text-slate-400">{Math.round(volume * 100)}%</span>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={panic}
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/20"
        >
          Panic: Fallback Playlist
        </button>
      </div>
    </div>
  );
}
