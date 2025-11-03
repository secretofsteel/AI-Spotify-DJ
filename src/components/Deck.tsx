import { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioAnalysis } from '../api/spotify';
import { usePlayerStore } from '../store/usePlayerStore';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Deck(): JSX.Element {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const progressMs = usePlayerStore((state) => state.progressMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const paused = usePlayerStore((state) => state.paused);
  const log = usePlayerStore((state) => state.log);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [waveLoading, setWaveLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx || !currentTrack?.id) {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    setWaveLoading(true);

    getAudioAnalysis(currentTrack.id)
      .then((analysis) => {
        if (cancelled || !ctx || !canvas) {
          return;
        }

        const beats = analysis.beats ?? [];
        const sections = analysis.sections ?? [];
        const useBeats = beats.length > 0;
        const totalBars = useBeats ? Math.min(200, beats.length) : sections.length;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.scale(ratio, ratio);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = '#10b981';

        const barWidth = Math.max(2, width / (totalBars || 1));
        const source = useBeats ? beats : sections;

        for (let i = 0; i < totalBars; i += 1) {
          const unit = source[i];
          if (!unit) {
            continue;
          }
          const energy = 'confidence' in unit ? unit.confidence : Math.max(0.2, Math.min(1, 1 - (unit.loudness ?? -60) / -60));
          const barHeight = Math.max(height * 0.2, height * energy);
          const x = i * barWidth;
          ctx.fillRect(x, height - barHeight, barWidth * 0.6, barHeight);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          log(`Waveform failed: ${(error as Error).message}`, 'warn');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWaveLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, log]);

  const progressPercent = useMemo(() => {
    if (!durationMs) {
      return 0;
    }
    return Math.min(100, Math.round((progressMs / durationMs) * 100));
  }, [progressMs, durationMs]);

  return (
    <div className="rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Now Spinning</h2>
          <p className="text-sm text-slate-400">{paused ? 'Paused' : 'Live in the browser deck'}</p>
        </div>
        {currentTrack?.albumImage && (
          <img src={currentTrack.albumImage} alt={currentTrack.name} className="h-20 w-20 rounded-md object-cover shadow-lg shadow-black/30" />
        )}
      </div>
      <div className="space-y-2">
        {currentTrack ? (
          <>
            <div className="text-2xl font-semibold text-emerald-200">{currentTrack.name}</div>
            <div className="text-sm uppercase tracking-wide text-slate-400">{currentTrack.artists}</div>
          </>
        ) : (
          <div className="text-slate-500">Pick something to start the party.</div>
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatTime(progressMs)}</span>
          <span>{formatTime(durationMs)}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="mt-6">
        <canvas ref={canvasRef} className="h-32 w-full rounded-md bg-slate-900/80" />
        {waveLoading && <div className="mt-2 text-xs text-slate-500">Sketching the fake waveform…</div>}
      </div>
      <div className="mt-6 rounded-md border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Up Next</h3>
        {nextTrack ? (
          <div className="mt-2">
            <div className="text-base font-medium text-white">{nextTrack.name}</div>
            <div className="text-xs text-slate-400">{nextTrack.artists}</div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Queued items managed by Spotify.</p>
        )}
      </div>
    </div>
  );
}
