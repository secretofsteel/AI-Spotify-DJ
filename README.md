# Office Party Deck

A pure browser Vite + React + TypeScript experience that turns your Spotify account into a playful two-deck party controller. The app authenticates with Spotify via PKCE, embeds the Web Playback SDK for browser playback, and layers on queue management, soft loudness leveling, and a quick playlist wizard for one-hour sets.

## Features

- Spotify PKCE login flow – no server, no client secret.
- Browser-based playback using the Spotify Web Playback SDK.
- Live deck view with current/next track, progress, and a fake waveform sketched from audio analysis data.
- Queue management, search with add-to-queue, and panic fallback playlist control.
- Playlist Wizard to generate an “AI Hour” private playlist tailored to a prompt and duration.
- Soft loudness leveling that nudges the browser player volume when the next track changes.
- Event log and helpful banners for network/device errors.

## Prerequisites

- Node.js ≥ 18
- Spotify Premium account (required for Web Playback SDK)
- Spotify Developer account for creating an app

## Environment Setup

1. Duplicate `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `VITE_SPOTIFY_CLIENT_ID` – Client ID from your Spotify developer app.
   - `VITE_REDIRECT_URI` – Redirect URI you will configure in the Spotify developer dashboard (e.g., `http://localhost:5173/`).
   - `VITE_GEMINI_API_KEY` – Google AI Studio API key with access to `gemini-flash-latest` (required for DJ Gemini playlist generation).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   npm run preview
   ```

## Register a Spotify Application

1. Visit [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create a new app.
2. Under **Settings**, add your development redirect URI (e.g., `http://localhost:5173/`) and copy the Client ID.
3. Save the changes and paste the Client ID into your `.env`.
4. Ensure the redirect URI in `.env` exactly matches one configured in the dashboard.

## Required Scopes

The app requests these Spotify scopes:

```
streaming
user-read-email
user-read-private
user-read-playback-state
user-modify-playback-state
playlist-modify-public
playlist-modify-private
```

## Known Limitations

- No refresh token handling: when the access token expires, you’ll be sent back through the login flow.
- The waveform visualization is a playful sketch based on audio analysis metadata, not real waveform data.
- Gemini-powered playlist suggestions depend on a client-side API key; rotate the key regularly and avoid sharing builds that include it.
- Playback can fail if the browser tab loses audio focus or the Spotify account lacks Premium features.
- Queue reordering and collaborative request lists are not implemented; see the “nice-to-haves” in the project brief.

## Helpful Tips

- Enable “Normalize volume” in Spotify settings for smoother loudness leveling blends.
- Keep another Spotify app open when first loading so the API has an active device to transfer from.
- The event log at the bottom of the app captures recent API/player activity to help debug issues during a party set.
