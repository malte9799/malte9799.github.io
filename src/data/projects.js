// Featured projects, shown on the landing page and at the top of /projects/.
// Screenshots live in public/img/ (16:10-ish, ~1600px wide, webp). A project with
// several screenshots gets a carousel; a slide's `url`/`urlLabel` default to the project's.
// Text fields are { en, de }; resolve them with pick() from src/i18n.

// '/' in production, '/previews/<branch>/' in a branch preview.
const BASE = import.meta.env.BASE_URL;

export const GITHUB_USER = 'malte9799';
export const GITHUB_URL = `https://github.com/${GITHUB_USER}`;

export const FEATURED = [
  {
    id: 'paintnet',
    name: 'paint.net web',
    eyebrow: { en: 'Image editor', de: 'Bildbearbeitung' },
    tagline: { en: 'The whole editor.\nIn a tab.', de: 'Der ganze Editor.\nIm Tab.' },
    description: {
      en: 'A from-scratch recreation of the paint.net image editor that runs entirely in the browser. Layers, 20 blend modes, editable shapes and gradients, and 33 effects that preview live in a Web Worker.',
      de: 'Eine von Grund auf neu gebaute Umsetzung des Bildeditors paint.net, die komplett im Browser läuft. Ebenen, 20 Mischmodi, bearbeitbare Formen und Verläufe und 33 Effekte mit Live-Vorschau in einem Web Worker.',
    },
    url: 'https://malte9799.github.io/paint.net/',
    urlLabel: 'malte9799.github.io/paint.net',
    repo: 'https://github.com/malte9799/paint.net',
    screenshots: [
      {
        src: `${BASE}img/paintnet.webp`,
        alt: {
          en: 'paint.net web with a Julia fractal rendered on the canvas, the Tools, History, Layers and Colors windows around it',
          de: 'paint.net web mit einem Julia-Fraktal auf der Leinwand, umgeben von den Fenstern Werkzeuge, Verlauf, Ebenen und Farben',
        },
      },
    ],
    accent: ['#4f8cff', '#36d1ff'],
    tags: {
      en: ['ES modules', 'Canvas 2D', 'Web Workers', 'Installable PWA'],
      de: ['ES-Module', 'Canvas 2D', 'Web Worker', 'Installierbare PWA'],
    },
  },
  {
    id: 'factoriotools',
    name: 'FactorioTools',
    eyebrow: { en: 'Factorio 2.0 · Space Age', de: 'Factorio 2.0 · Space Age' },
    tagline: { en: 'Paste a blueprint.\nFind the bottleneck.', de: 'Blaupause einfügen.\nEngpass finden.' },
    description: {
      en: 'A blueprint editor built for optimising production lines: a rate calculator, a tick-by-tick belt and circuit simulation, and the game’s own art. Plus a production planner and a live map seed viewer.',
      de: 'Ein Blaupausen-Editor zum Optimieren von Produktionslinien: ein Ratenrechner, eine tickgenaue Simulation von Förderbändern und Schaltungen und die Originalgrafiken des Spiels. Dazu ein Produktionsplaner und ein Live-Viewer für Karten-Seeds.',
    },
    url: 'https://malte9799.github.io/FactorioTools/',
    urlLabel: 'malte9799.github.io/FactorioTools',
    repo: 'https://github.com/malte9799/FactorioTools',
    // Shown as a carousel; each slide links to its own tool.
    screenshots: [
      {
        src: `${BASE}img/factoriotools.webp`,
        label: { en: 'Blueprint editor', de: 'Blaupausen-Editor' },
        alt: {
          en: 'FactorioTools showing a logistic science build with per-machine rate labels and the Rate Calculator reporting 56% efficiency',
          de: 'FactorioTools mit einem Aufbau für Logistik-Wissenschaftspakete, Ratenangaben an jeder Maschine und dem Ratenrechner bei 56 % Effizienz',
        },
      },
      {
        src: `${BASE}img/factoriotools-seed-viewer.webp`,
        label: { en: 'Seed viewer', de: 'Seed-Viewer' },
        url: 'https://malte9799.github.io/FactorioTools/#/seed-viewer',
        urlLabel: 'malte9799.github.io/FactorioTools/#/seed-viewer',
        alt: {
          en: 'Seed Viewer showing the Nauvis map of seed 123 with ore patches, enemy bases, forests and cliffs, and a panel listing the nearest patches',
          de: 'Seed-Viewer mit der Nauvis-Karte von Seed 123: Erzfelder, Gegnerbasen, Wälder und Klippen, daneben eine Liste der nächsten Erzfelder',
        },
      },
      {
        src: `${BASE}img/factoriotools-planner.webp`,
        label: { en: 'Production planner', de: 'Produktionsplaner' },
        url: 'https://malte9799.github.io/FactorioTools/#/planner',
        urlLabel: 'malte9799.github.io/FactorioTools/#/planner',
        alt: {
          en: 'Production Planner showing 60 chemical science packs a minute as a flow diagram from raw resources to the science pack, with machine counts on every step',
          de: 'Produktionsplaner mit 60 Chemie-Wissenschaftspaketen pro Minute als Flussdiagramm von den Rohstoffen bis zum Wissenschaftspaket, mit Maschinenanzahl an jedem Schritt',
        },
      },
    ],
    accent: ['#ffb547', '#ff6a3d'],
    tags: {
      en: ['TypeScript', 'Simulation', 'Sprite rendering', 'Client-side only'],
      de: ['TypeScript', 'Simulation', 'Sprite-Rendering', 'Komplett clientseitig'],
    },
  },
  {
    id: 'wetter',
    name: { en: 'Weather Globe', de: 'Wetter-Globus' },
    eyebrow: { en: 'Weather app', de: 'Wetter-App' },
    tagline: {
      en: 'The weather outside.\nAnd across the globe.',
      de: 'Das Wetter vor der Tür.\nUnd auf dem ganzen Globus.',
    },
    description: {
      en: 'A forecast with a 48-hour chart, 14-day outlook, air quality, pollen and official severe-weather warnings, plus an interactive 3D globe with rain radar, animated wind, wildfires, storms, tornadoes and earthquakes. Every data source works without an API key.',
      de: 'Eine Vorhersage mit 48-Stunden-Diagramm, 14-Tage-Ausblick, Luftqualität, Pollenflug und amtlichen Unwetterwarnungen, dazu ein interaktiver 3D-Globus mit Regenradar, animiertem Wind, Waldbränden, Stürmen, Tornados und Erdbeben. Alle Datenquellen funktionieren ohne API-Schlüssel.',
    },
    url: 'https://malte9799.github.io/wetter/',
    urlLabel: 'malte9799.github.io/wetter',
    repo: 'https://github.com/malte9799/wetter',
    screenshots: [
      {
        src: `${BASE}img/wetter.webp`,
        label: { en: 'Forecast', de: 'Vorhersage' },
        alt: {
          en: 'Wetter-Globus forecast for Berlin: current conditions with tiles for wind, gusts, humidity, pressure, precipitation, cloud cover, UV index, sunrise and sunset, air quality and pollen',
          de: 'Wetter-Globus-Vorhersage für Berlin: aktuelles Wetter mit Kacheln für Wind, Böen, Luftfeuchte, Luftdruck, Niederschlag, Bewölkung, UV-Index, Sonnenauf- und -untergang, Luftqualität und Pollen',
        },
      },
      {
        src: `${BASE}img/wetter-charts.webp`,
        label: { en: '48 hours & 14 days', de: '48 Stunden & 14 Tage' },
        alt: {
          en: 'Wetter-Globus charts: temperature and precipitation for the next 48 hours, and a 14-day forecast with temperature ranges and wind',
          de: 'Wetter-Globus-Diagramme: Temperatur und Niederschlag der nächsten 48 Stunden und die 14-Tage-Vorhersage mit Temperaturspannen und Wind',
        },
      },
    ],
    accent: ['#5ab0ff', '#ffc533'],
    tags: {
      en: ['TypeScript', 'MapLibre GL', 'Open-Meteo', 'No framework'],
      de: ['TypeScript', 'MapLibre GL', 'Open-Meteo', 'Ohne Framework'],
    },
  },
  {
    id: 'games',
    name: { en: 'Games', de: 'Spiele' },
    eyebrow: { en: 'Puzzle arcade', de: 'Rätselsammlung' },
    tagline: { en: 'Small puzzles.\nBig rabbit holes.', de: 'Kleine Rätsel.\nGroßer Sog.' },
    description: {
      en: 'Eleven hand-built puzzles, from Minesweeper and Sudoku to Netwalk and Conway’s Life. Nonograms are generated so they never need a guess, and most come with presets, hints and a confetti finish.',
      de: 'Elf selbst gebaute Rätsel, von Minesweeper und Sudoku bis Netwalk und Conways Spiel des Lebens. Nonogramme werden so erzeugt, dass man nie raten muss, und die meisten haben Voreinstellungen, Hinweise und ein Konfetti-Finale.',
    },
    url: `${BASE}games/`,
    urlLabel: 'malte9799.github.io/games',
    repo: 'https://github.com/malte9799/malte9799.github.io/tree/main/games',
    screenshots: [
      {
        src: `${BASE}img/games.webp`,
        alt: {
          en: 'The games menu: a grid of cards for Minesweeper, Bug Nudge, Snake, Nonogram, Conway’s Life, 2048 and more',
          de: 'Das Spielemenü: ein Raster aus Karten für Minesweeper, Bug Nudge, Snake, Nonogram, Conway’s Life, 2048 und mehr',
        },
      },
    ],
    accent: ['#b4f461', '#2fd39a'],
    tags: {
      en: ['p5.js', 'Procedural generation', 'Solvers'],
      de: ['p5.js', 'Prozedurale Generierung', 'Löser'],
    },
  },
];

// Repos left out of the live "More on GitHub" list (featured above, or this site).
export const HIDDEN_REPOS = new Set(['paint.net', 'FactorioTools', 'wetter', 'weather', `${GITHUB_USER}.github.io`]);
