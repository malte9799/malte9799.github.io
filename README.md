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
- `src/components/reactbits/` — text and card effects adapted from [React Bits](https://reactbits.dev)
- `games/`, `old/` — hand-written static pages, copied into `dist/` unchanged

Pushing to `main` builds and deploys via `.github/workflows/deploy.yml`
(Settings → Pages → Source must be set to **GitHub Actions**).
