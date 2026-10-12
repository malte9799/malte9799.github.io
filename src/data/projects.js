// Featured projects, shown on the landing page and at the top of /projects/.
// Screenshots live in public/img/ (16:10-ish, ~1600px wide, webp).

export const GITHUB_USER = 'malte9799';
export const GITHUB_URL = `https://github.com/${GITHUB_USER}`;

export const FEATURED = [
  {
    id: 'paintnet',
    name: 'paint.net web',
    eyebrow: 'Image editor',
    tagline: 'The whole editor.\nIn a tab.',
    description:
      'A from-scratch recreation of the paint.net image editor that runs entirely in the browser. Layers, 20 blend modes, editable shapes and gradients, and 33 effects that preview live in a Web Worker.',
    url: 'https://malte9799.github.io/paint.net/',
    urlLabel: 'malte9799.github.io/paint.net',
    repo: 'https://github.com/malte9799/paint.net',
    image: '/img/paintnet.webp',
    imageAlt: 'paint.net web with a Julia fractal rendered on the canvas, the Tools, History, Layers and Colors windows around it',
    accent: ['#4f8cff', '#36d1ff'],
    tags: ['ES modules', 'Canvas 2D', 'Web Workers', 'Installable PWA'],
  },
  {
    id: 'factoriotools',
    name: 'FactorioTools',
    eyebrow: 'Factorio 2.0 · Space Age',
    tagline: 'Paste a blueprint.\nFind the bottleneck.',
    description:
      'A blueprint editor built for optimising production lines: a rate calculator, a tick-by-tick belt and circuit simulation, and the game’s own art. Plus a production planner and a live map seed viewer.',
    url: 'https://malte9799.github.io/FactorioTools/',
    urlLabel: 'malte9799.github.io/FactorioTools',
    repo: 'https://github.com/malte9799/FactorioTools',
    image: '/img/factoriotools.webp',
    imageAlt: 'FactorioTools showing a logistic science build with per-machine rate labels and the Rate Calculator reporting 56% efficiency',
    accent: ['#ffb547', '#ff6a3d'],
    tags: ['TypeScript', 'Simulation', 'Sprite rendering', 'Client-side only'],
  },
  {
    id: 'games',
    name: 'Games',
    eyebrow: 'Puzzle arcade',
    tagline: 'Small puzzles.\nBig rabbit holes.',
    description:
      'Eleven hand-built puzzles, from Minesweeper and Sudoku to Netwalk and Conway’s Life. Nonograms are generated so they never need a guess, and most come with presets, hints and a confetti finish.',
    url: '/games/',
    urlLabel: 'malte9799.github.io/games',
    repo: 'https://github.com/malte9799/malte9799.github.io/tree/main/games',
    image: '/img/games.webp',
    imageAlt: 'The games menu: a grid of cards for Minesweeper, Bug Nudge, Snake, Nonogram, Conway’s Life, 2048 and more',
    accent: ['#b4f461', '#2fd39a'],
    tags: ['p5.js', 'Procedural generation', 'Solvers'],
  },
];

// Repos left out of the live "More on GitHub" list (featured above, or this site).
export const HIDDEN_REPOS = new Set(['paint.net', 'FactorioTools', `${GITHUB_USER}.github.io`]);
