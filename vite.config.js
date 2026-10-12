import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Hand-written static folders that predate the React site. They are served
// as-is in dev and copied verbatim into dist on build.
const STATIC_DIRS = ['games', 'old'];

const copyStaticDirs = () => ({
  name: 'copy-static-dirs',
  apply: 'build',
  closeBundle() {
    for (const dir of STATIC_DIRS) {
      cpSync(resolve(root, dir), resolve(root, 'dist', dir), {
        recursive: true,
        filter: src => !src.endsWith('.DS_Store'),
      });
    }
  },
});

export default defineConfig({
  plugins: [react(), copyStaticDirs()],
  optimizeDeps: {
    entries: ['index.html', 'projects/index.html'],
  },
  build: {
    // three.js + drei is one lazily loaded chunk (~300 kB gzip) for the hero.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        projects: resolve(root, 'projects/index.html'),
      },
    },
  },
});
