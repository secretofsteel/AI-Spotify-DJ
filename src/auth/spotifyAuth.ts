// src/auth/spotifyAuth.ts

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI as string

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private'
].join(' ')

const CODE_VERIFIER_KEY = 'pkce_verifier'

function base64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function createCodeVerifierAndChallenge() {
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64url(rand)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64url(digest)
  localStorage.setItem(CODE_VERIFIER_KEY, verifier)
  return { verifier, challenge }
}

export function getStoredVerifier() {
  return localStorage.getItem(CODE_VERIFIER_KEY) || ''
}

export function buildAuthorizeUrl(codeChallenge: string, state: string) {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeCodeForToken(code: string) {
  const verifier = getStoredVerifier()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  })

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`Token exchange failed ${resp.status}: ${JSON.stringify(json)}`)
  return json as { access_token: string; refresh_token?: string; expires_in: number; token_type: 'Bearer' }
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  })
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`Refresh failed ${resp.status}: ${JSON.stringify(json)}`)
  return json as { access_token: string; expires_in: number; token_type: 'Bearer' }
}

// ---------------------------------------------------------------------------
// Compatibility exports for existing imports in App.tsx
// These wrap the PKCE helpers we already have so you don't have to refactor App.
// ---------------------------------------------------------------------------

/** Start the login flow (build authorize URL + redirect) */
export async function loginRedirect() {
  const { challenge } = await createCodeVerifierAndChallenge()
  const state = crypto.randomUUID()
  const url = buildAuthorizeUrl(challenge, state)
  console.log('[AUTH] authorize URL =', url)
  window.location.href = url
}

/** Parse /callback URL params */
export function parseAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  return { code, state }
}

/** Exchange the authorization code for tokens (PKCE) */
export async function getAccessTokenFromCode(code: string) {
  return exchangeCodeForToken(code) // returns { access_token, refresh_token?, ... }
}

/**
 * Optional convenience: read a previously stored token from localStorage.
 * Safe no-op if you don't end up using it.
 */
export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('sp_tokens')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.access_token === 'string' ? parsed.access_token : null
  } catch {
    return null
  }
}
