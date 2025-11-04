// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async ({ command }) => {
  const plugins = [react()]

  if (command === 'serve') {
    // only load SSL plugin in local dev
    const basicSsl = (await import('@vitejs/plugin-basic-ssl')).default
    plugins.push(basicSsl())
  }

  return {
    plugins,
    server: command === 'serve'
      ? { https: true, host: '127.0.0.1', port: 8443 }
      : undefined,
  }
})
