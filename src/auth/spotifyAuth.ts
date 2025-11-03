import { TokenData } from '../store/usePlayerStore';

const AUTH_BASE = 'https://accounts.spotify.com';
const CODE_VERIFIER_KEY = 'office-party-deck-code-verifier';
const STATE_KEY = 'office-party-deck-auth-state';
const TOKEN_KEY = 'office-party-deck-token';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

const isBrowser = typeof window !== 'undefined';

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function createCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export async function loginRedirect(scopes: string[]): Promise<void> {
  if (!isBrowser) {
    return;
  }

  if (!CLIENT_ID || !REDIRECT_URI) {
    throw new Error('Missing Spotify client configuration. Check VITE_SPOTIFY_CLIENT_ID and VITE_REDIRECT_URI.');
  }

  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = crypto.randomUUID();

  localStorage.setItem(CODE_VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const authUrl = new URL(`${AUTH_BASE}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('state', state);

  window.location.assign(authUrl.toString());
}

export function parseAuthCallback(): { code?: string; state?: string; error?: string } {
  if (!isBrowser) {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') ?? undefined;
  const state = params.get('state') ?? undefined;
  const error = params.get('error') ?? undefined;

  if (code || error) {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
  }

  return { code, state, error };
}

export async function getAccessTokenFromCode(code: string): Promise<TokenData> {
  if (!CLIENT_ID || !REDIRECT_URI) {
    throw new Error('Missing Spotify client configuration. Check VITE_SPOTIFY_CLIENT_ID and VITE_REDIRECT_URI.');
  }

  const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('PKCE code verifier missing. Restart login.');
  }

  const stateExpected = localStorage.getItem(STATE_KEY);

  localStorage.removeItem(CODE_VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);

  const body = new URLSearchParams();
  body.set('client_id', CLIENT_ID);
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', REDIRECT_URI);
  body.set('code_verifier', verifier);

  const response = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    state?: string;
  };

  if (stateExpected && data.state && data.state !== stateExpected) {
    throw new Error('State mismatch while completing Spotify auth.');
  }

  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;

  const token: TokenData = {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresAt,
    refreshToken: data.refresh_token,
    scope: data.scope
  };

  setStoredToken(token);
  return token;
}

export function getStoredToken(): TokenData | null {
  if (!isBrowser) {
    return null;
  }

  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TokenData;
    if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse stored token', error);
  }

  clearToken();
  return null;
}

export function setStoredToken(token: TokenData): void {
  if (!isBrowser) {
    return;
  }

  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function clearToken(): void {
  if (!isBrowser) {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}
