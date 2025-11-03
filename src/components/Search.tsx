import { FormEvent, useState } from 'react';
import { addToQueue, searchTracks } from '../api/spotify';
import { usePlayerStore } from '../store/usePlayerStore';

export default function Search(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyApi.TrackObjectFull[]>([]);
  const [loading, setLoading] = useState(false);
  const log = usePlayerStore((state) => state.log);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const items = await searchTracks(query, 15);
      setResults(items);
    } catch (error) {
      log(`Search failed: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const queueTrack = async (uri: string) => {
    try {
      await addToQueue(uri);
      log(`Queued track ${uri}`);
    } catch (error) {
      log(`Failed to queue: ${(error as Error).message}`, 'error');
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <h2 className="text-lg font-semibold text-white">Search &amp; Queue</h2>
      <form onSubmit={onSubmit} className="mt-3 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find party starters…"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading && <div className="text-sm text-slate-400">Gathering tracks…</div>}
        {!loading && results.length === 0 && query && (
          <div className="text-sm text-slate-500">No tracks found. Try another vibe.</div>
        )}
        {results.map((track) => (
          <div key={track.id} className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            {track.album.images?.[2]?.url ? (
              <img src={track.album.images[2].url} alt={track.name} className="h-12 w-12 rounded object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-800 text-xs text-slate-500">No Art</div>
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{track.name}</div>
              <div className="text-xs text-slate-400">{track.artists.map((artist) => artist.name).join(', ')}</div>
            </div>
            <button
              type="button"
              onClick={() => queueTrack(track.uri)}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/20"
            >
              Add to Queue
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
