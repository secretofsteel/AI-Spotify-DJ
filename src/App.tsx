import { useEffect, useMemo, useState } from 'react';
import DevicePicker from './components/DevicePicker';
import Deck from './components/Deck';
import Controls from './components/Controls';
import Search from './components/Search';
import PlaylistWizard from './components/PlaylistWizard';
import {
  clearToken,
  getAccessTokenFromCode,
  getStoredToken,
  loginRedirect,
  parseAuthCallback
} from './auth/spotifyAuth';
import { connectPlayer, initPlayer } from './player/sdk';
import { getMe, getPlaybackState } from './api/spotify';
import { usePlayerStore } from './store/usePlayerStore';
import React from "react"
import { createCodeVerifierAndChallenge, buildAuthorizeUrl } from "./auth/spotifyAuth" // whatever your main DJ UI is called

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private'
];

const NORMALIZE_HINT_KEY = 'office-party-deck-normalize-dismissed';

function Login(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center">
      <h1 className="text-4xl font-semibold text-white">Office Party Deck</h1>
      <p className="max-w-xl text-slate-300">
        Fire up a friendly fake two-deck DJ inside your browser. Sign in with Spotify Premium to take control of the party playlist.
      </p>
      <button
        type="button"
        onClick={() => loginRedirect(SCOPES)}
        className="rounded-lg bg-emerald-500 px-6 py-3 text-lg font-medium text-slate-900 transition hover:bg-emerald-400"
      >
        Log in with Spotify
      </button>
    </div>
  );
}

export default function App(): JSX.Element {
    // === Auth glue (drop-in) ===

  async function handleLogin() {
    try {
      const { challenge } = await createCodeVerifierAndChallenge();
      const state = crypto.randomUUID();
      const url = buildAuthorizeUrl(challenge, state);
      console.log("[AUTH] authorize URL =", url);
      window.location.href = url;
    } catch (err) {
      console.error("Login init failed:", err);
      alert("Unable to start login. Check console.");
    }
  }



  const token = usePlayerStore((state) => state.token);
  const setToken = usePlayerStore((state) => state.setToken);
  const me = usePlayerStore((state) => state.me);
  const setMe = usePlayerStore((state) => state.setMe);
  const logs = usePlayerStore((state) => state.logs);
  const networkError = usePlayerStore((state) => state.networkError);
  const log = usePlayerStore((state) => state.log);
  const isPremium = usePlayerStore((state) => state.isPremium);
  const setPlaybackState = usePlayerStore((state) => state.setPlaybackState);
  const setVolume = usePlayerStore((state) => state.setVolume);

  const [initializingPlayer, setInitializingPlayer] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [showNormalizeHint, setShowNormalizeHint] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return !localStorage.getItem(NORMALIZE_HINT_KEY);
  });

  // If not authenticated, early-return a simple login screen.
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center bg-gray-900 text-white">
        <h1 className="text-4xl font-bold mb-6">AI Spotify DJ</h1>
        <p className="text-lg mb-4">Login to start the setlist magic.</p>
        <button
          onClick={handleLogin}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-md shadow-lg transition"
        >
          Login with Spotify
        </button>
      </div>
    );
  }
  // === End auth glue ===

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const existingToken = getStoredToken();
    if (existingToken) {
      setToken(existingToken);
    }

    const { code, error } = parseAuthCallback();

    if (error) {
      log(`Spotify auth error: ${error}`, 'error');
      clearToken();
      setToken(null);
      return;
    }

    if (code) {
      getAccessTokenFromCode(code)
        .then((tokenData) => {
          setToken(tokenData);
          log('Authenticated with Spotify.');
        })
        .catch((err: Error) => {
          log(`Failed to complete Spotify auth: ${err.message}`, 'error');
          clearToken();
          setToken(null);
        });
    }
  }, [log, setToken]);

  useEffect(() => {
    if (!token || me) {
      return;
    }

    getMe()
      .then((profile) => {
        setMe(profile);
      })
      .catch((err: Error) => {
        log(`Failed fetching profile: ${err.message}`, 'error');
      });
  }, [token, me, setMe, log]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (initializingPlayer || playerReady) {
      return;
    }

    let cancelled = false;
    setInitializingPlayer(true);

    initPlayer()
      .then(() => connectPlayer())
      .then((connected) => {
        if (!cancelled) {
          setPlayerReady(connected);
          log('Spotify player connected.');
        }
      })
      .catch((err: Error) => {
        log(`Failed to init player: ${err.message}`, 'error');
      })
      .finally(() => setInitializingPlayer(false));

    return () => {
      cancelled = true;
    };
  }, [token, initializingPlayer, playerReady, log]);

  useEffect(() => {
    if (!token) {
      return;
    }
    getPlaybackState().then((state) => {
      if (!state) {
        return;
      }
      const current = state.item && 'name' in state.item && state.item ? state.item : null;
      setPlaybackState({
        currentTrack: current
          ? {
              id: current.id,
              uri: current.uri,
              name: current.name,
              artists: current.artists.map((a) => a.name).join(', '),
              albumName: current.album.name,
              albumImage: current.album.images?.[0]?.url
            }
          : null,
        nextTrack: null,
        progressMs: state.progress_ms ?? 0,
        durationMs: state.item?.duration_ms ?? 0,
        paused: state.is_playing === false
      });
      if (typeof state.device?.volume_percent === 'number') {
        setVolume(state.device.volume_percent / 100);
      }
    });
  }, [token, setPlaybackState, setVolume]);

  const dismissHint = () => {
    setShowNormalizeHint(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NORMALIZE_HINT_KEY, '1');
    }
  };

  const renderNetworkBanner = useMemo(() => {
    if (!networkError) {
      return null;
    }
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
        {networkError}
      </div>
    );
  }, [networkError]);

  if (!token) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Office Party Deck</h1>
            <p className="text-sm text-slate-400">{me ? `Welcome, ${me.display_name ?? me.id}` : 'Loading profile…'}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isPremium && (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100">
                Spotify Premium needed
              </span>
            )}
            <DevicePicker />
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-3 px-6 pb-4">
          {renderNetworkBanner}
          {showNormalizeHint && (
            <div className="flex items-start justify-between rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div>
                <strong className="font-semibold">Pro tip:</strong> Enable &ldquo;Normalize volume&rdquo; in Spotify settings so our soft leveling feels smoother.
              </div>
              <button type="button" onClick={dismissHint} className="text-emerald-200 underline">
                Got it
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Deck />
          <div className="flex flex-col gap-6">
            <Controls />
            <Search />
          </div>
        </div>
        <PlaylistWizard />
      </main>
      <footer className="border-t border-slate-800 bg-slate-900/60">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Event Log</h2>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
            {logs.length === 0 ? (
              <p className="text-slate-500">No events yet.</p>
            ) : (
              <ul className="space-y-1">
                {[...logs].reverse().map((entry) => (
                  <li key={entry.id} className="flex gap-2">
                    <span className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span
                      className={
                        entry.level === 'error'
                          ? 'text-rose-300'
                          : entry.level === 'warn'
                            ? 'text-amber-200'
                            : 'text-slate-200'
                      }
                    >
                      {entry.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
