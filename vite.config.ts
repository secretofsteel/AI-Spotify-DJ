import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { https: true, host: '127.0.0.1', port: 8443 },
  preview: { https: true, host: '127.0.0.1', port: 4173 }
})
