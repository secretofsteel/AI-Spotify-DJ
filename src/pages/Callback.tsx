// src/pages/Callback.tsx
import React, { useEffect } from "react"
import { exchangeCodeForToken } from "../auth/spotifyAuth"
import { setAccessToken } from "../api/spotify"
import { usePlayerStore } from "../store/usePlayerStore"

export default function Callback() {
  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      if (!code) return

      try {
        const tokens = await exchangeCodeForToken(code)
        usePlayerStore.getState().setToken(tokens.access_token, tokens.refresh_token ?? null)
        setAccessToken(tokens.access_token)

        // After success, navigate back to root
        window.location.replace("/")
      } catch (err) {
        console.error("Auth callback error:", err)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-lg font-semibold mb-2">Authenticating with Spotify...</h2>
      <p>If this page doesn’t redirect, check console logs.</p>
    </div>
  )
}
