import { FormEvent, useState } from 'react';
import { addToQueue, addTracks, createPlaylist, playContext, searchTracks } from '../api/spotify';
import { requestGeminiSetList } from '../api/gemini';
import { usePlayerStore } from '../store/usePlayerStore';

type TrackSelection = {
  track: SpotifyApi.TrackObjectFull;
  query: string;
  reason?: string;
};

export default function PlaylistWizard(): JSX.Element {
  const me = usePlayerStore((state) => state.me);
  const log = usePlayerStore((state) => state.log);
  const [prompt, setPrompt] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [lastPlaylistUrl, setLastPlaylistUrl] = useState<string | null>(null);
  const [selections, setSelections] = useState<TrackSelection[]>([]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!me) {
      setStatus('Still loading your Spotify profile.');
      return;
    }

    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
    setLoading(true);
    setQueueing(false);
    setCreatingPlaylist(false);
    setSelections([]);
    setLastPlaylistUrl(null);

    try {
      setStatus('Summoning DJ Gemini for fresh selections…');
      const suggestions = await requestGeminiSetList(prompt, safeMinutes);
      if (suggestions.length === 0) {
        setStatus('DJ Gemini had no suggestions. Try a different vibe.');
        return;
      }

      const picks: TrackSelection[] = [];
      for (const suggestion of suggestions) {
        setStatus(`Digging through crates for “${suggestion.query}”…`);
        // eslint-disable-next-line no-await-in-loop
        const results = await searchTracks(suggestion.query, 5);
        if (results.length === 0) {
          continue;
        }
        const choice = results.find((track) => track.duration_ms < 6_000_000) ?? results[0];
        picks.push({ track: choice, query: suggestion.query, reason: suggestion.reason });
        if (picks.length >= 24) {
          break;
        }
      }

      if (picks.length === 0) {
        setStatus('Spotify could not find anything matching DJ Gemini’s picks.');
        return;
      }

      setSelections(picks);
      setStatus(`DJ Gemini lined up ${picks.length} tracks. Queue them or craft a playlist below.`);
      log(`DJ Gemini returned ${picks.length} tracks for "${prompt || 'party vibe'}".`);
    } catch (error) {
      const message = (error as Error).message;
      setStatus(`DJ Gemini hit a snag: ${message}`);
      log(`DJ Gemini error: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const queueAll = async () => {
    if (selections.length === 0) {
      return;
    }

    setQueueing(true);
    try {
      for (const item of selections) {
        // eslint-disable-next-line no-await-in-loop
        await addToQueue(item.track.uri);
      }
      setStatus(`Queued ${selections.length} tracks after the current song.`);
      log(`Queued ${selections.length} DJ Gemini picks.`);
    } catch (error) {
      const message = (error as Error).message;
      setStatus(`Queue failed: ${message}`);
      log(`Queue all error: ${message}`, 'error');
    } finally {
      setQueueing(false);
    }
  };

  const createAndPlayPlaylist = async () => {
    if (!me || selections.length === 0) {
      return;
    }

    setCreatingPlaylist(true);
    try {
      const playlistName = `DJ Gemini – ${new Date().toLocaleString()}`;
      const { id } = await createPlaylist(me.id, playlistName, false);
      await addTracks(
        id,
        selections.map((item) => item.track.uri)
      );
      await playContext(`spotify:playlist:${id}`);
      const playlistUrl = `https://open.spotify.com/playlist/${id}`;
      setLastPlaylistUrl(playlistUrl);
      setStatus('Playlist loaded! Check the link or keep the party rolling in the browser deck.');
      log(`Created DJ Gemini playlist (${selections.length} tracks).`);
    } catch (error) {
      const message = (error as Error).message;
      setStatus(`Playlist creation failed: ${message}`);
      log(`Create playlist error: ${message}`, 'error');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">DJ Gemini: AI Party Co-Pilot</h2>
        {lastPlaylistUrl && (
          <a href={lastPlaylistUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">
            Open in Spotify
          </a>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Describe the vibe and desired runtime. DJ Gemini consults the Gemini Flash model, finds tracks on Spotify, and hands you a set to queue or playlist.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto]">
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. neon-lit nu disco rooftop"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div>
          <label htmlFor="duration" className="block text-xs uppercase text-slate-400">
            Minutes
          </label>
          <input
            id="duration"
            type="number"
            min={15}
            max={240}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="self-end rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Consulting…' : 'Ask DJ Gemini'}
        </button>
      </form>
      {status && <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">{status}</div>}
      {selections.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={queueAll}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              disabled={queueing || loading}
            >
              {queueing ? 'Queueing…' : `Queue ${selections.length} Tracks`}
            </button>
            <button
              type="button"
              onClick={createAndPlayPlaylist}
              className="rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
              disabled={creatingPlaylist || loading}
            >
              {creatingPlaylist ? 'Building…' : 'Create Playlist & Play'}
            </button>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
            {selections.map((item) => (
              <li
                key={item.track.id}
                className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
              >
                {item.track.album.images?.[2]?.url ? (
                  <img src={item.track.album.images[2].url} alt={item.track.name} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-800 text-xs text-slate-500">No Art</div>
                )}
                <div className="flex-1">
                  <div className="font-medium text-white">{item.track.name}</div>
                  <div className="text-xs text-slate-400">{item.track.artists.map((artist) => artist.name).join(', ')}</div>
                  <div className="text-xs text-slate-500">
                    Suggested via <span className="text-emerald-300">“{item.query}”</span>
                    {item.reason ? <> · {item.reason}</> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
