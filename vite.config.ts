import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site: https://<user>.github.io/portfolio/. The deploy workflow passes
// BASE_PATH from actions/configure-pages, so a renamed repo or a <user>.github.io repo still works.
const base = process.env.BASE_PATH ?? '/portfolio/';

export default defineConfig({
  base: base.endsWith('/') ? base : `${base}/`,
  plugins: [react()],
  build: {
    target: 'es2022',
    // @dimforge/rapier3d-compat inlines its wasm as base64 (~2.2 MB of JS). It gets its own chunk so
    // app changes do not invalidate it; @react-three/rapier imports it statically, so it cannot be
    // deferred past the 3D chunk.
    chunkSizeWarningLimit: 2500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Order matters: a group also captures its dependencies, earlier groups win ties.
            // Vite's preload helper would otherwise be captured by the r3f group (r3f-rapier's own
            // dynamic import uses it), making the entry chunk statically import r3f + three + rapier.
            { name: 'vite-runtime', test: /vite\/preload-helper/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'state', test: /node_modules[\\/](zustand|use-sync-external-store)[\\/]/ },
            { name: 'rapier', test: /node_modules[\\/]@dimforge[\\/]/ },
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            {
              name: 'r3f',
              // Not @react-three/postprocessing: it stays in the lazy ?fx chunk.
              test: /node_modules[\\/](@react-three[\\/](fiber|drei|rapier)|three-stdlib|troika-[a-z-]+|suspend-react|its-fine)[\\/]/,
            },
          ],
        },
      },
    },
  },
  preview: { host: '127.0.0.1', port: 4310, strictPort: true },
  server: { host: '127.0.0.1', port: 4311, strictPort: true },
});
