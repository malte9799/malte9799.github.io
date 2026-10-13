# malte9799.github.io

Personal site: a landing page with a three.js hero and a projects page.

```
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

- `index.html` / `src/landing/` — landing page (glass knot hero, scroll sections)
- `projects/index.html` / `src/projects/` — projects page; featured projects come
  from `src/data/projects.js`, the rest is fetched live from the GitHub API
- `de/index.html`, `de/projects/index.html` — German versions of both pages. All copy
  lives in `src/i18n/strings.js` (UI) and `src/data/projects.js` (projects, as `{ en, de }`).
  English pages send German-language browsers to `/de/` unless the visitor picked a
  language with the EN/DE switch.
- `homelab/index.html` / `src/homelab/` — homelab dashboard (Proxmox host, LXCs, service map,
  live pipelines, actions for every service). Runs on simulated data and mock actions for now;
  see `src/homelab/README.md` for the action catalog and the backend it expects
- `src/components/reactbits/` — text and card effects adapted from [React Bits](https://reactbits.dev)
- `games/`, `old/` — hand-written static pages, copied into `dist/` unchanged

Pushing to `main` builds and deploys via `.github/workflows/deploy.yml`
(Settings → Pages → Source must be set to **GitHub Actions**).

**Branch previews.** The same workflow also builds every other branch (newest 12) into
`/previews/<branch>/`, e.g. `https://malte9799.github.io/previews/my-branch/`; the list is at
`/previews/`. `scripts/build-pages.mjs` does the work (`node scripts/build-pages.mjs` locally,
after fetching the branches → `site/`). Each run replaces the whole deployment, so production
(`main`) is never touched by a branch push and a deleted branch loses its preview. One-time
setting: Settings → Environments → github-pages → Deployment branches → *No restriction*.
In code, link with `withBase()` / `import.meta.env.BASE_URL` rather than a bare `/path`.
