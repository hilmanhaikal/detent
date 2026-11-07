import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The site imports the package by its real name, served from the source in this repo.
export default defineConfig({
  base: './',
  resolve: { alias: { '@hlmnhkl/detent': fileURLToPath(new URL('../src/index.ts', import.meta.url)) } },
  plugins: [
    {
      // package.json says "sideEffects": false, which would drop start.js: its whole job is a side effect.
      name: 'keep-start',
      transform: (code, id) => (id.endsWith('/site/home/start.js') ? { code, moduleSideEffects: true } : null),
    },
  ],
})
