import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// STANDALONE=true produces one self-contained index.html (JS/CSS inlined, no separate asset
// files) in dist-standalone/, so it can be downloaded and opened directly via file:// - no
// server, no install. Used for the "download and run in your browser" distribution; the regular
// build (dist/) still ships as normal separate assets for GitHub Pages.
const standalone = process.env.STANDALONE === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: standalone ? './' : process.env.GITHUB_PAGES ? '/PokemonSaveEditor/' : '/',
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  build: standalone ? { outDir: 'dist-standalone', assetsInlineLimit: 100_000_000 } : undefined,
})
