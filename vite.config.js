import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Hand-written static folders that predate the React site. They are served
// as-is in dev and copied verbatim into dist on build.
const STATIC_DIRS = ['games', 'old'];

// Solo games have pretty URLs: /games/<id>/. The static host has no rewrites, so each
// game gets its own index.html: the games/index.html shell with a <base> pointing back at
// /games/ (the shell's relative paths keep working). The ids come from games/manifest.js.
const gameIds = () =>
  [...readFileSync(resolve(root, 'games/manifest.js'), 'utf8').matchAll(/\{ id: "([a-z0-9-]+)"/g)].map(m => m[1]);
const gamePage = () =>
  readFileSync(resolve(root, 'games/index.html'), 'utf8').replace('<head>', '<head>\n<base href="../" />');

// dev: /games/<id>/ → the same page the build writes to dist/games/<id>/index.html
const gameRoutesDev = () => ({
  name: 'game-routes-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = /^\/games\/([a-z0-9-]+)\/?(?:\?.*)?$/i.exec(req.url ?? '');
      if (!m || !gameIds().includes(m[1])) return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(gamePage());
    });
  },
});

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
    for (const id of gameIds()) {
      const dir = resolve(root, 'dist/games', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'index.html'), gamePage());
    }
  },
});

export default defineConfig({
  plugins: [react(), copyStaticDirs(), gameRoutesDev()],
  optimizeDeps: {
    entries: [
      'index.html',
      'projects/index.html',
      'de/index.html',
      'de/projects/index.html',
      'projects/permanent-collection/index.html',
      'projects/blog/index.html',
    ],
  },
  build: {
    // three.js + drei is one lazily loaded chunk (~300 kB gzip) for the hero.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        projects: resolve(root, 'projects/index.html'),
        de: resolve(root, 'de/index.html'),
        deProjects: resolve(root, 'de/projects/index.html'),
        permanentCollection: resolve(root, 'projects/permanent-collection/index.html'),
        blog: resolve(root, 'projects/blog/index.html'),
      },
    },
  },
});
