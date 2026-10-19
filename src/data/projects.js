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
    id: 'orbis',
    name: 'Orbis',
    eyebrow: { en: 'Weather · Earth · Space', de: 'Wetter · Erde · Weltraum' },
    tagline: {
      en: 'Weather, Earth\nand the solar system.',
      de: 'Wetter, Erde\nund Sonnensystem.',
    },
    description: {
      en: 'Local forecasts with a 48-hour chart, 14-day outlook, air quality, pollen and official severe-weather warnings, a live global weather map with radar, satellite, animated wind and natural events, and an interactive 3D solar system you can fast-forward through time.',
      de: 'Lokale Vorhersagen mit 48-Stunden-Diagramm, 14-Tage-Ausblick, Luftqualität, Pollenflug und amtlichen Unwetterwarnungen, eine Live-Wetterkarte mit Radar, Satellit, animiertem Wind und Naturereignissen und ein interaktives 3D-Sonnensystem, in dem man die Zeit vor- und zurückspulen kann.',
    },
    url: 'https://malte9799.github.io/orbis/',
    urlLabel: 'malte9799.github.io/orbis',
    repo: 'https://github.com/malte9799/orbis',
    screenshots: [
      {
        src: `${BASE}img/orbis.webp`,
        label: { en: 'Forecast', de: 'Vorhersage' },
        alt: {
          en: 'Orbis forecast for Berlin: current conditions with tiles for wind, gusts, humidity, pressure, precipitation, cloud cover, UV index, sunrise and sunset, air quality and pollen',
          de: 'Orbis-Vorhersage für Berlin: aktuelles Wetter mit Kacheln für Wind, Böen, Luftfeuchte, Luftdruck, Niederschlag, Bewölkung, UV-Index, Sonnenauf- und -untergang, Luftqualität und Pollen',
        },
      },
      {
        src: `${BASE}img/orbis-forecast-charts.webp`,
        label: { en: '48 hours & 14 days', de: '48 Stunden & 14 Tage' },
        alt: {
          en: 'Orbis charts: temperature and precipitation for the next 48 hours, and a 14-day forecast with temperature ranges and wind',
          de: 'Orbis-Diagramme: Temperatur und Niederschlag der nächsten 48 Stunden und die 14-Tage-Vorhersage mit Temperaturspannen und Wind',
        },
      },
      {
        src: `${BASE}img/orbis-map-wind.webp`,
        label: { en: 'Weather map', de: 'Wetterkarte' },
        url: 'https://malte9799.github.io/orbis/#/karte',
        urlLabel: 'malte9799.github.io/orbis/#/karte',
        alt: {
          en: 'Orbis weather map on a 3D globe showing wind gusts as a colour layer with animated wind particles, plus a layer list with wildfires, storms and tornado warnings',
          de: 'Orbis-Wetterkarte auf einem 3D-Globus mit Windböen als Farbebene und animierten Windpartikeln, links die Ebenenliste mit Waldbränden, Stürmen und Tornadowarnungen',
        },
      },
      {
        src: `${BASE}img/orbis-map-satellite.webp`,
        label: { en: 'Live satellite', de: 'Live-Satellit' },
        url: 'https://malte9799.github.io/orbis/#/karte',
        urlLabel: 'malte9799.github.io/orbis/#/karte',
        alt: {
          en: 'Orbis globe with the NASA daily satellite image over the Americas, cloud cover and tropical storm markers',
          de: 'Orbis-Globus mit dem NASA-Tagesbild über Amerika, Wolkendecke und Sturm-Markierungen',
        },
      },
      {
        src: `${BASE}img/orbis-space.webp`,
        label: { en: 'Solar system', de: 'Sonnensystem' },
        url: 'https://malte9799.github.io/orbis/#/weltall',
        urlLabel: 'malte9799.github.io/orbis/#/weltall',
        alt: {
          en: 'Orbis solar system view: a 3D Earth in space with the list of planets and moons on the left and a fact sheet on the right',
          de: 'Orbis-Sonnensystem: eine 3D-Erde im All, links die Liste der Planeten und Monde, rechts ein Steckbrief',
        },
      },
    ],
    accent: ['#5ab0ff', '#ffc533'],
    tags: {
      en: ['TypeScript', 'MapLibre GL', 'three.js', 'Open-Meteo'],
      de: ['TypeScript', 'MapLibre GL', 'three.js', 'Open-Meteo'],
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
  {
    id: 'fluent-emoji',
    name: 'Fluent Emoji',
    eyebrow: { en: 'Emoji assets', de: 'Emoji-Assets' },
    tagline: { en: 'Every Fluent emoji.\nAnimated.', de: 'Jedes Fluent-Emoji.\nAnimiert.' },
    description: {
      en: 'Microsoft’s Fluent emoji as a ready-to-use collection, including the animated versions, with an update script that keeps it in sync. Work on the animated set is ongoing.',
      de: 'Microsofts Fluent-Emojis als sofort nutzbare Sammlung, auch in animierter Form, samt Update-Skript, das sie aktuell hält. Die Arbeit am animierten Set läuft noch.',
    },
    url: 'https://malte9799.github.io/fluent-emoji/',
    urlLabel: 'malte9799.github.io/fluent-emoji',
    repo: 'https://github.com/malte9799/fluent-emoji',
    screenshots: [
      {
        src: `${BASE}img/fluent-emoji.webp`,
        alt: {
          en: 'A banner of animated Fluent emoji',
          de: 'Ein Banner mit animierten Fluent-Emojis',
        },
      },
    ],
    accent: ['#ff7ac6', '#ffd23f'],
    tags: {
      en: ['JavaScript', 'Animated emoji', 'MIT'],
      de: ['JavaScript', 'Animierte Emojis', 'MIT'],
    },
  },
];

// Smaller featured projects: compact cards (no screenshot) at the end of the
// featured grid on /projects/ only, not on the landing page.
export const EXTRAS = [
  {
    id: 'just-watch',
    name: 'just-watch',
    eyebrow: { en: 'Movies & shows', de: 'Filme & Serien' },
    description: {
      en: 'Search films, shows and anime through TMDB, watch trailers and play episodes in an embedded player. Keeps a watchlist and what you’ve seen in the browser. Plain HTML and JS, no backend.',
      de: 'Filme, Serien und Anime über TMDB suchen, Trailer ansehen und Folgen im eingebetteten Player abspielen. Merkliste und Gesehenes bleiben im Browser. Reines HTML und JS, kein Backend.',
    },
    url: 'https://malte9799.github.io/just-watch/',
    repo: 'https://github.com/malte9799/just-watch',
    accent: ['#ff5f6d', '#ffc371'],
    tags: { en: ['JavaScript', 'TMDB API'], de: ['JavaScript', 'TMDB-API'] },
  },
  {
    id: 'permanent-collection',
    name: 'The Permanent Collection',
    eyebrow: { en: 'Concept shop', de: 'Konzept-Shop' },
    description: {
      en: 'A chair shop where the landing page is a 3D cylinder of photos and you stand inside it. Cursor, drag, scroll and WASD all move the camera; behind it sits a plain shop with filters, cart, checkout and EN/DE. CSS 3D and Motion, no WebGL.',
      de: 'Ein Stuhl-Shop, dessen Startseite ein 3D-Zylinder aus Fotos ist, in dem man steht. Cursor, Ziehen, Scrollen und WASD bewegen die Kamera; dahinter steckt ein schlichter Shop mit Filtern, Warenkorb, Kasse und DE/EN. CSS 3D und Motion, kein WebGL.',
    },
    url: `${BASE}projects/permanent-collection/`,
    repo: 'https://github.com/malte9799/malte9799.github.io/tree/main/src/permanent-collection',
    // Compact card with a carousel: the animated capture first, stills after it.
    screenshots: [
      {
        src: `${BASE}img/permanent-collection.mp4`,
        poster: `${BASE}img/permanent-collection-poster.webp`,
        label: { en: 'Gallery', de: 'Galerie' },
        alt: {
          en: 'Looking around the chair cylinder: the camera follows the cursor, then the room turns as it is dragged',
          de: 'Umschauen im Stuhl-Zylinder: Die Kamera folgt dem Cursor, dann dreht sich der Raum beim Ziehen',
        },
      },
      {
        src: `${BASE}img/permanent-collection-shop.webp`,
        label: { en: 'Shop', de: 'Shop' },
        url: `${BASE}projects/permanent-collection/#/shop`,
        alt: { en: 'The shop page with filters and a product grid', de: 'Die Shop-Seite mit Filtern und Produktraster' },
      },
      {
        src: `${BASE}img/permanent-collection-product.webp`,
        label: { en: 'Product page', de: 'Produktseite' },
        url: `${BASE}projects/permanent-collection/#/product/panton-chair`,
        alt: { en: 'A product page with finish options and cart button', de: 'Eine Produktseite mit Ausführungen und Warenkorb-Button' },
      },
    ],
    accent: ['#d8d2c4', '#a79f8d'],
    tags: { en: ['React', 'Motion', 'CSS 3D', 'EN / DE'], de: ['React', 'Motion', 'CSS 3D', 'DE / EN'] },
  },
];

// Repos left out of the live "More on GitHub" list (featured above, or this site).
export const HIDDEN_REPOS = new Set(['paint.net', 'FactorioTools', 'orbis', 'fluent-emoji', 'just-watch', `${GITHUB_USER}.github.io`]);
