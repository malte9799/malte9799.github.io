// Designs — switchable looks for the whole collection. Game mechanics never
// change; a theme only swaps colours, fonts and a few rendering effects.
//
// Each theme has:
//   pal    canvas colours as [r, g, b] (copied into the live PAL object)
//   font   the canvas font; fonts = Google Fonts families to load
//   fx     rendering tweaks applied to every p5 sketch:
//            corners  multiplier on rect() corner radii (0 = square)
//            text     multiplier on textSize() for fonts that run small/large
// The page styling for each theme lives in themes.css (html[data-theme=…]).
//
// PAL is updated *in place* on a theme switch, so games that cached a
// reference (const C1 = PAL.mint) pick the new colours up automatically.

const _BASE = {
  // midnight — also the fallback for any key a theme leaves out
  bg: [15, 16, 30], board: [12, 13, 26], well: [18, 20, 37], panel: [28, 31, 54], panelHi: [40, 44, 74],
  line: [44, 48, 82], lineHi: [78, 84, 128], ink: [238, 240, 255], muted: [142, 148, 190], dim: [86, 92, 132],
  sun: [255, 204, 112], mint: [116, 226, 178], rose: [255, 110, 140], sky: [108, 182, 255],
  lilac: [176, 152, 255], peach: [255, 156, 112], aqua: [96, 222, 222],
  // lighter cores / special pieces
  mintHi: [196, 255, 226], skyHi: [190, 224, 255], sunHi: [255, 248, 228], aquaHi: [206, 250, 250],
  fillInk: [226, 222, 255], mine: [96, 102, 156], mineHi: [150, 156, 205],
  onLight: [24, 22, 48], onDark: [238, 240, 255], // text on bright / dark coloured tiles
  // 2048 ramp for 2 … 2048, negative tiles −2 … −32, and Flood It's 8 hues
  tiles: [[44, 48, 84], [60, 65, 110], [92, 140, 240], [72, 190, 232], [96, 214, 172], [168, 226, 112],
          [255, 214, 104], [255, 168, 98], [255, 116, 132], [234, 122, 222], [176, 140, 255]],
  tilesNeg: [[84, 38, 70], [110, 42, 84], [140, 46, 98], [170, 50, 110], [196, 56, 120]],
  flood: [[255, 99, 120], [255, 208, 92], [104, 218, 140], [92, 162, 255], [176, 132, 255], [255, 150, 72], [76, 218, 232], [255, 140, 212]],
};

const THEMES = [
  {
    id: "midnight", name: "Midnight", sub: "night sky, pastel glow",
    font: "Outfit", fonts: ["Outfit:wght@400;500;600;700;800"],
    fx: { corners: 1 },
    pal: {},
  },
  {
    id: "classic", name: "Classic", sub: "the original — brown & gold",
    font: "Inconsolata", fonts: ["Inconsolata:wght@400;500;700"],
    fx: { corners: 0.5 },
    pal: {
      bg: [28, 26, 23], board: [20, 18, 15], well: [28, 25, 22], panel: [38, 35, 32], panelHi: [56, 51, 45],
      line: [58, 53, 46], lineHi: [120, 110, 95], ink: [243, 237, 224], muted: [155, 145, 130], dim: [90, 84, 74],
      sun: [230, 180, 34], mint: [127, 176, 105], rose: [200, 50, 63], sky: [90, 160, 210],
      lilac: [150, 130, 200], peach: [220, 120, 60], aqua: [90, 180, 190],
      mintHi: [190, 240, 150], skyHi: [150, 210, 255], sunHi: [243, 237, 224], aquaHi: [200, 235, 245],
      fillInk: [243, 237, 224], mine: [120, 110, 95], mineHi: [200, 190, 175], onLight: [20, 18, 15], onDark: [243, 237, 224],
      tiles: [[58, 54, 48], [72, 66, 56], [180, 110, 48], [200, 90, 40], [210, 70, 55], [220, 50, 50],
              [200, 170, 50], [210, 180, 40], [220, 190, 30], [230, 200, 20], [230, 180, 34]],
      tilesNeg: [[90, 40, 44], [120, 42, 48], [150, 44, 52], [180, 46, 56], [200, 50, 60]],
      flood: [[200, 50, 63], [230, 180, 34], [127, 176, 105], [90, 160, 210], [180, 110, 200], [220, 140, 60], [90, 200, 190], [230, 110, 160]],
    },
  },
  {
    id: "studio", name: "Studio", sub: "bright & clean, app-suite feel",
    font: "Manrope", fonts: ["Manrope:wght@400;500;600;700;800"],
    fx: { corners: 1 },
    pal: {
      bg: [244, 244, 247], board: [255, 255, 255], well: [241, 242, 246], panel: [228, 231, 239], panelHi: [214, 218, 230],
      line: [226, 228, 236], lineHi: [160, 166, 186], ink: [22, 23, 28], muted: [107, 112, 128], dim: [180, 185, 200],
      sun: [247, 167, 32], mint: [22, 178, 120], rose: [240, 62, 92], sky: [36, 122, 255],
      lilac: [106, 77, 255], peach: [255, 120, 64], aqua: [0, 176, 200],
      mintHi: [120, 222, 176], skyHi: [140, 186, 255], sunHi: [255, 240, 200], aquaHi: [150, 235, 245],
      fillInk: [22, 23, 28], mine: [70, 74, 92], mineHi: [150, 155, 175], onLight: [22, 23, 28], onDark: [255, 255, 255],
      tiles: [[236, 238, 244], [220, 225, 238], [255, 214, 120], [255, 170, 80], [255, 120, 90], [240, 62, 92],
              [220, 80, 200], [106, 77, 255], [36, 122, 255], [0, 176, 200], [22, 178, 120]],
      tilesNeg: [[255, 214, 222], [255, 180, 195], [250, 140, 165], [245, 100, 135], [240, 62, 92]],
      flood: [[240, 62, 92], [247, 180, 32], [22, 178, 120], [36, 122, 255], [106, 77, 255], [255, 120, 64], [0, 190, 210], [230, 90, 200]],
    },
  },
  {
    id: "paper", name: "Paper", sub: "sketchbook, pen & grain",
    font: "Patrick Hand", fonts: ["Patrick+Hand", "Caveat:wght@600;700"],
    fx: { corners: 0.7, text: 1.1 },
    pal: {
      bg: [239, 230, 212], board: [250, 246, 236], well: [242, 235, 220], panel: [236, 226, 205], panelHi: [224, 212, 186],
      line: [216, 201, 168], lineHi: [150, 135, 110], ink: [38, 48, 79], muted: [122, 110, 90], dim: [180, 166, 136],
      sun: [232, 163, 23], mint: [63, 150, 96], rose: [214, 69, 65], sky: [46, 96, 178],
      lilac: [46, 96, 178], peach: [222, 120, 60], aqua: [40, 150, 150],
      mintHi: [150, 210, 170], skyHi: [150, 180, 230], sunHi: [255, 236, 180], aquaHi: [160, 220, 215],
      fillInk: [38, 48, 79], mine: [38, 48, 79], mineHi: [110, 120, 150], onLight: [38, 48, 79], onDark: [250, 246, 236],
      tiles: [[236, 226, 205], [224, 212, 186], [244, 200, 120], [236, 160, 90], [224, 110, 80], [214, 69, 65],
              [160, 90, 150], [90, 110, 180], [46, 96, 178], [40, 150, 150], [63, 150, 96]],
      tilesNeg: [[230, 200, 200], [220, 170, 170], [210, 140, 140], [200, 110, 110], [190, 80, 80]],
      flood: [[214, 69, 65], [232, 170, 30], [63, 150, 96], [46, 96, 178], [128, 90, 170], [222, 120, 60], [40, 150, 150], [200, 100, 150]],
    },
  },
  {
    id: "brutal", name: "Brutal", sub: "dark, fine line art",
    font: "Instrument Sans", fonts: ["Instrument+Sans:wght@400;500;600;700"],
    fx: { corners: 0.3 },
    pal: {
      bg: [12, 12, 14], board: [17, 17, 20], well: [24, 24, 28], panel: [26, 26, 30], panelHi: [40, 40, 46],
      line: [50, 50, 56], lineHi: [236, 235, 230], ink: [236, 235, 230], muted: [141, 140, 134], dim: [84, 84, 90],
      sun: [244, 196, 80], mint: [96, 214, 160], rose: [255, 96, 112], sky: [96, 164, 255],
      lilac: [168, 140, 255], peach: [255, 148, 90], aqua: [80, 214, 224],
      mintHi: [190, 250, 220], skyHi: [196, 222, 255], sunHi: [255, 240, 196], aquaHi: [200, 246, 250],
      fillInk: [236, 235, 230], mine: [236, 235, 230], mineHi: [141, 140, 134], onLight: [12, 12, 14], onDark: [236, 235, 230],
      tiles: [[38, 38, 44], [54, 54, 62], [86, 140, 240], [70, 190, 230], [90, 210, 160], [170, 224, 110],
              [250, 208, 90], [255, 160, 90], [255, 104, 120], [232, 120, 220], [176, 140, 255]],
      tilesNeg: [[46, 30, 30], [64, 38, 38], [84, 46, 46], [106, 54, 54], [130, 62, 62]],
      flood: [[255, 96, 112], [244, 196, 80], [96, 214, 160], [96, 164, 255], [168, 140, 255], [255, 148, 90], [80, 214, 224], [255, 140, 210]],
    },
  },
  {
    id: "pop", name: "Pop", sub: "bold outlines, hard shadows",
    font: "Space Grotesk", fonts: ["Space+Grotesk:wght@400;500;600;700"],
    fx: { corners: 0.4 },
    pal: {
      bg: [255, 243, 214], board: [255, 255, 255], well: [245, 240, 228], panel: [255, 226, 138], panelHi: [255, 210, 80],
      line: [0, 0, 0], lineHi: [0, 0, 0], ink: [0, 0, 0], muted: [61, 61, 61], dim: [150, 150, 150],
      sun: [255, 200, 0], mint: [0, 200, 120], rose: [255, 77, 77], sky: [60, 130, 255],
      lilac: [160, 110, 255], peach: [255, 140, 60], aqua: [0, 200, 220],
      mintHi: [140, 255, 200], skyHi: [170, 205, 255], sunHi: [255, 245, 200], aquaHi: [160, 245, 255],
      fillInk: [0, 0, 0], mine: [0, 0, 0], mineHi: [80, 80, 80], onLight: [0, 0, 0], onDark: [255, 255, 255],
      tiles: [[255, 255, 255], [255, 243, 214], [255, 226, 138], [255, 200, 0], [255, 140, 60], [255, 77, 77],
              [255, 158, 207], [160, 110, 255], [60, 130, 255], [0, 200, 220], [0, 200, 120]],
      tilesNeg: [[220, 220, 220], [180, 180, 180], [140, 140, 140], [100, 100, 100], [60, 60, 60]],
      flood: [[255, 77, 77], [255, 200, 0], [0, 200, 120], [60, 130, 255], [160, 110, 255], [255, 140, 60], [0, 200, 220], [255, 158, 207]],
    },
  },
];

// ---- the 15 art-directed designs ----
// These ship their own stylesheet (designs/<id>.css) and, where the look needs
// DOM tricks, a script (designs/<id>.js) — see "design assets" below. Their
// canvas palettes are derived from a handful of colours so each stays readable.

function _mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }

// s: { bg, board, ink, sun, mint, rose, sky, lilac, peach, aqua } as [r, g, b]
// (+ optional overrides for any PAL key). Text colours are mixed from the
// board, because that is what canvas text sits on.
function _derive(s) {
  const { board, ink } = s;
  const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  const light = lum(board) > 0.55;
  const hi = (c) => _mix(c, [255, 255, 255], 0.62);
  const m = (a, b, t) => _mix(a, b, t);
  const out = {
    bg: s.bg, board, ink,
    well: m(board, ink, light ? 0.06 : 0.05), panel: m(board, ink, light ? 0.13 : 0.13), panelHi: m(board, ink, light ? 0.23 : 0.24),
    line: m(board, ink, light ? 0.24 : 0.2), lineHi: m(board, ink, 0.5),
    muted: m(board, ink, 0.62), dim: m(board, ink, 0.36),
    sun: s.sun, mint: s.mint, rose: s.rose, sky: s.sky, lilac: s.lilac, peach: s.peach, aqua: s.aqua,
    sunHi: hi(s.sun), mintHi: hi(s.mint), skyHi: hi(s.sky), aquaHi: hi(s.aqua),
    fillInk: ink, mine: m(board, ink, 0.55), mineHi: m(board, ink, 0.82),
    onLight: light ? ink : board, onDark: light ? board : ink,
    tiles: [m(board, ink, 0.1), m(board, ink, 0.2), s.sky, s.aqua, s.mint, m(s.mint, s.sun, 0.5), s.sun, s.peach, s.rose, m(s.rose, s.lilac, 0.5), s.lilac],
    tilesNeg: [0.2, 0.34, 0.5, 0.68, 0.88].map((t) => m(board, s.rose, t)),
    flood: [s.rose, s.sun, s.mint, s.sky, s.lilac, s.peach, s.aqua, m(s.rose, s.lilac, 0.5)],
  };
  // a non-light board with a light-ish tile needs dark text; games pick by tile luminance
  return { ...out, ...(s.over || {}) };
}

THEMES.push(
  {
    id: "liquid", name: "Liquid morph", sub: "gooey blobs, melting shapes", assets: true, script: true,
    font: "Bricolage Grotesque", fonts: ["Bricolage+Grotesque:opsz,wght@12..96,400..800"],
    fx: { corners: 1.6 },
    pal: _derive({ bg: [22, 10, 52], board: [30, 14, 70], ink: [250, 244, 255],
      sun: [255, 214, 102], mint: [94, 240, 200], rose: [255, 88, 160], sky: [90, 170, 255], lilac: [186, 140, 255], peach: [255, 150, 100], aqua: [80, 230, 240] }),
  },
  {
    id: "neon", name: "Neon glow", sub: "tube lights on black", assets: true, script: true,
    font: "Rajdhani", fonts: ["Rajdhani:wght@500;600;700", "Tilt+Neon"],
    fx: { corners: 0.6, glow: 9, text: 1.08 },
    pal: _derive({ bg: [6, 4, 14], board: [9, 6, 22], ink: [236, 244, 255],
      sun: [255, 240, 60], mint: [57, 255, 140], rose: [255, 40, 130], sky: [0, 200, 255], lilac: [190, 80, 255], peach: [255, 120, 40], aqua: [0, 255, 230] }),
  },
  {
    id: "y2k", name: "Y2K chrome", sub: "liquid metal & glossy blue", assets: true, script: true,
    font: "Exo 2", fonts: ["Exo+2:wght@400;600;700;800", "Audiowide"],
    fx: { corners: 1.2 },
    pal: _derive({ bg: [196, 214, 238], board: [240, 246, 255], ink: [14, 30, 84],
      sun: [255, 190, 20], mint: [24, 200, 140], rose: [255, 70, 170], sky: [30, 130, 255], lilac: [140, 90, 255], peach: [255, 130, 70], aqua: [0, 200, 230] }),
  },
  {
    id: "kinetic", name: "Kinetic type", sub: "moving letters, big type", assets: true, script: true,
    font: "Anybody", fonts: ["Anybody:wdth,wght@50..150,100..900"],
    fx: { corners: 0, text: 1.02 },
    pal: _derive({ bg: [238, 236, 228], board: [250, 249, 244], ink: [14, 14, 14],
      sun: [255, 184, 0], mint: [0, 168, 107], rose: [255, 59, 31], sky: [20, 90, 255], lilac: [120, 70, 255], peach: [255, 120, 50], aqua: [0, 170, 200] }),
  },
  {
    id: "cutout", name: "Paper cutout", sub: "layered paper, tape & shadows", assets: true, script: true,
    font: "Fredoka", fonts: ["Fredoka:wght@400;500;600;700", "Bagel+Fat+One"],
    fx: { corners: 0.8, text: 1.04 },
    pal: _derive({ bg: [31, 111, 115], board: [252, 246, 228], ink: [43, 45, 66],
      sun: [244, 184, 48], mint: [58, 166, 138], rose: [226, 87, 76], sky: [60, 120, 190], lilac: [140, 100, 170], peach: [240, 138, 80], aqua: [70, 180, 190] }),
  },
  {
    id: "holo", name: "Holographic", sub: "foil, rainbow sheen, tilt", assets: true, script: true,
    font: "Sora", fonts: ["Sora:wght@300..800"],
    fx: { corners: 1.1 },
    pal: _derive({ bg: [10, 8, 22], board: [14, 12, 32], ink: [246, 242, 255],
      sun: [255, 236, 160], mint: [150, 255, 214], rose: [255, 140, 200], sky: [140, 200, 255], lilac: [200, 160, 255], peach: [255, 190, 160], aqua: [150, 245, 255] }),
  },
  {
    id: "ascii", name: "ASCII art", sub: "everything is a character", assets: true, script: true,
    font: "JetBrains Mono", fonts: ["JetBrains+Mono:wght@400;500;700"],
    fx: { corners: 0, text: 0.92 },
    pal: _derive({ bg: [3, 9, 4], board: [4, 14, 6], ink: [172, 255, 190],
      sun: [255, 214, 80], mint: [70, 255, 120], rose: [255, 90, 80], sky: [100, 220, 255], lilac: [200, 150, 255], peach: [255, 160, 70], aqua: [90, 255, 210],
      over: { well: [10, 30, 15], panel: [26, 76, 40], panelHi: [42, 112, 62], line: [50, 130, 74], lineHi: [100, 210, 130], mine: [110, 200, 130], mineHi: [170, 240, 190] } }),
  },
  {
    id: "comic", name: "Comic book", sub: "halftone, panels, POW!", assets: true, script: true,
    font: "Comic Neue", fonts: ["Comic+Neue:wght@400;700", "Bangers"],
    fx: { corners: 0.3, text: 1.08 },
    pal: _derive({ bg: [255, 224, 70], board: [255, 253, 242], ink: [12, 12, 16],
      sun: [255, 214, 0], mint: [0, 184, 120], rose: [237, 28, 36], sky: [0, 114, 206], lilac: [128, 70, 180], peach: [255, 127, 42], aqua: [0, 190, 220] }),
  },
  {
    id: "flap", name: "Split-flap", sub: "departure board, clack clack", assets: true, script: true,
    font: "Oswald", fonts: ["Oswald:wght@400;500;600;700", "Barlow+Condensed:wght@500;600;700"],
    fx: { corners: 0.35, text: 1.02 },
    pal: _derive({ bg: [26, 26, 28], board: [14, 14, 16], ink: [246, 238, 214],
      sun: [255, 190, 40], mint: [120, 205, 125], rose: [226, 72, 60], sky: [96, 156, 216], lilac: [166, 136, 206], peach: [238, 142, 72], aqua: [92, 196, 184] }),
  },
  {
    id: "sketch", name: "Hand-drawn", sub: "marker doodles, wobbly lines", assets: true, script: true,
    font: "Kalam", fonts: ["Kalam:wght@400;700", "Permanent+Marker"],
    fx: { corners: 0.6, text: 1.1 },
    pal: _derive({ bg: [255, 255, 255], board: [255, 254, 249], ink: [34, 34, 42],
      sun: [255, 206, 20], mint: [52, 200, 120], rose: [255, 84, 110], sky: [50, 134, 255], lilac: [156, 106, 230], peach: [255, 146, 64], aqua: [30, 198, 210] }),
  },
  {
    id: "blueprint", name: "Blueprint", sub: "technical drawing, cyan on blue", assets: true, script: true,
    font: "IBM Plex Mono", fonts: ["IBM+Plex+Mono:wght@400;500;600"],
    fx: { corners: 0, text: 0.95 },
    pal: _derive({ bg: [14, 62, 140], board: [16, 72, 160], ink: [236, 246, 255],
      sun: [255, 226, 120], mint: [140, 255, 220], rose: [255, 150, 170], sky: [160, 214, 255], lilac: [204, 192, 255], peach: [255, 198, 150], aqua: [120, 240, 255] }),
  },
  {
    id: "pixel", name: "Pixel art", sub: "8-bit, 16 colours, blocky", assets: true, script: true,
    font: "Silkscreen", fonts: ["Silkscreen:wght@400;700", "Press+Start+2P", "VT323"],
    fx: { corners: 0, text: 0.88 },
    pal: _derive({ bg: [29, 43, 83], board: [18, 24, 54], ink: [255, 241, 232],
      sun: [255, 236, 39], mint: [0, 228, 54], rose: [255, 0, 77], sky: [41, 173, 255], lilac: [131, 118, 156], peach: [255, 163, 0], aqua: [41, 222, 214],
      over: { flood: [[255, 0, 77], [255, 236, 39], [0, 228, 54], [41, 173, 255], [131, 118, 156], [255, 163, 0], [41, 222, 214], [255, 119, 168]] } }),
  },
  {
    id: "bauhaus", name: "Bauhaus", sub: "primaries, circle · square · triangle", assets: true, script: true,
    font: "Jost", fonts: ["Jost:wght@400;500;600;700;800"],
    fx: { corners: 0, text: 1.04 },
    pal: _derive({ bg: [240, 232, 214], board: [249, 244, 231], ink: [20, 20, 20],
      sun: [244, 196, 0], mint: [0, 134, 102], rose: [214, 40, 40], sky: [0, 82, 180], lilac: [96, 62, 146], peach: [240, 120, 30], aqua: [0, 150, 170] }),
  },
  {
    id: "deco", name: "Art deco", sub: "gold, symmetry, sunbursts", assets: true,
    font: "Josefin Sans", fonts: ["Josefin+Sans:wght@300;400;600;700", "Poiret+One", "Limelight"],
    fx: { corners: 0, text: 1.06 },
    pal: _derive({ bg: [10, 14, 22], board: [13, 19, 30], ink: [238, 224, 182],
      sun: [214, 176, 58], mint: [44, 168, 136], rose: [196, 64, 84], sky: [78, 128, 178], lilac: [146, 104, 166], peach: [214, 134, 72], aqua: [64, 176, 176] }),
  },
  {
    id: "neobrutal", name: "Neo-brutalism", sub: "flat colour, stickers, hard shadows", assets: true, script: true,
    hardShadow: true,
    font: "Archivo", fonts: ["Archivo:wght@400;600;800;900", "Space+Mono:wght@400;700"],
    fx: { corners: 0.5, text: 1 },
    pal: _derive({ bg: [196, 164, 255], board: [255, 255, 255], ink: [0, 0, 0],
      sun: [255, 222, 89], mint: [120, 232, 140], rose: [255, 92, 141], sky: [75, 160, 255], lilac: [160, 110, 255], peach: [255, 150, 80], aqua: [64, 224, 208] }),
  },
);

const THEME_KEY = "games_theme";

// live state read by game.js and the games
const PAL = JSON.parse(JSON.stringify(_BASE));
let FONT = "Outfit";
let THEME_FX = { corners: 1, text: 1 };
let THEME = THEMES[0];

function _deepAssign(target, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (Array.isArray(v) && Array.isArray(target[k])) {
      if (Array.isArray(v[0])) {
        v.forEach((inner, i) => { if (target[k][i]) target[k][i].splice(0, inner.length, ...inner); else target[k][i] = [...inner]; });
        target[k].length = v.length;
      } else {
        target[k].splice(0, target[k].length, ...v);
      }
    } else target[k] = JSON.parse(JSON.stringify(v));
  }
}

function _loadFonts(t) {
  const id = "theme-font-" + t.id;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?" + t.fonts.map(f => "family=" + f).join("&") + "&display=swap";
  document.head.appendChild(link);
}

// ---- design assets ----
// A design flagged `assets` ships designs/<id>.css; with `script` it also ships
// designs/<id>.js, which registers  DESIGN_FX[id] = { enter, card, shell }:
//   enter()            page content exists (home grid / game shell) — decorate it,
//                      return a cleanup function that undoes everything
//   card(el, game, i)  called for each home card right after it is built
// Pages call designMount() once their content is built (and again after a
// design switch); applyTheme() runs the previous design's cleanup first.
const DESIGN_FX = {};
const _assets = {};

function _loadAssets(t) {
  if (!t.assets) return Promise.resolve();
  if (_assets[t.id]) return _assets[t.id];
  const css = new Promise((res) => {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "designs/" + t.id + ".css";
    l.onload = l.onerror = res;
    document.head.appendChild(l);
  });
  const js = t.script ? new Promise((res) => {
    const s = document.createElement("script");
    s.src = "designs/" + t.id + ".js";
    s.onload = s.onerror = res;
    document.head.appendChild(s);
  }) : Promise.resolve();
  return (_assets[t.id] = Promise.all([css, js]).then(() => {}));
}

function themeAssetsReady() { return _loadAssets(THEME); }

let _fxCleanup = null;
function designUnmount() {
  if (!_fxCleanup) return;
  try { _fxCleanup(); } catch (e) { console.error(e); }
  _fxCleanup = null;
}
function designMount() {
  designUnmount();
  const fx = DESIGN_FX[THEME.id];
  if (fx && fx.enter) { try { _fxCleanup = fx.enter() || null; } catch (e) { console.error(e); } }
}
function designCard(el, game, i) {
  const fx = DESIGN_FX[THEME.id];
  if (fx && fx.card) { try { fx.card(el, game, i); } catch (e) { console.error(e); } }
}

// Calls cb(canvas) once a home card's p5 preview has been created and drawn
// (p5 starts on window load, which can be after the card was built).
function previewCanvas(el, cb, tries = 150) {
  const c = el.querySelector(".preview canvas");
  if (c) requestAnimationFrame(() => cb(c));
  else if (tries > 0) requestAnimationFrame(() => previewCanvas(el, cb, tries - 1));
}

function applyTheme(id, { save = true } = {}) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  designUnmount();
  THEME = t;
  _deepAssign(PAL, _BASE);
  _deepAssign(PAL, t.pal);
  FONT = t.font;
  THEME_FX = { corners: 1, text: 1, ...t.fx };
  document.documentElement.dataset.theme = t.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = "rgb(" + PAL.bg.join(",") + ")";
  _loadFonts(t);
  if (t.assets && !_assets[t.id]) {
    // keep the page hidden until the design's stylesheet is in (no flash of the wrong look)
    const root = document.documentElement;
    root.classList.add("design-pending");
    const done = () => root.classList.remove("design-pending");
    _loadAssets(t).then(done);
    setTimeout(done, 2500);
  }
  if (save) { try { localStorage.setItem(THEME_KEY, t.id); } catch {} }
  document.querySelectorAll(".theme-opt").forEach(b => b.setAttribute("aria-checked", String(b.dataset.theme === t.id)));
  window.dispatchEvent(new CustomEvent("themechange", { detail: t }));
}

// apply the saved theme immediately (this file loads in <head>, before paint);
// ?design=<id> in the URL wins and is remembered
if (!window.THEME_SAMPLE) (function () {   // theme-sample.html loads this file only for its helpers
  let saved = null;
  try { saved = new URLSearchParams(location.search).get("design"); } catch {}
  if (saved && !THEMES.some((t) => t.id === saved)) saved = null;
  if (!saved) { try { saved = localStorage.getItem(THEME_KEY); } catch {} }
  applyTheme(saved || "midnight", { save: !!(saved && new URLSearchParams(location.search).get("design")) });
})();

// game pages: re-decorate after a design switch (the home page rebuilds its own cards first)
window.addEventListener("themechange", () => {
  if (window._pageKind === "game") themeAssetsReady().then(designMount);
});

// Resolves once the current theme's canvas font is usable (or after a timeout).
function themeFontReady() {
  if (!document.fonts) return Promise.resolve();
  return Promise.race([
    Promise.all([document.fonts.load(`700 16px "${FONT}"`), document.fonts.load(`400 16px "${FONT}"`)]),
    new Promise(r => setTimeout(r, 1500)),
  ]).catch(() => {});
}

// ---- p5 rendering hooks ----
// Theme effects apply to every sketch without touching game code:
// rect() corner radii and textSize() are scaled for the theme.
if (typeof p5 !== "undefined") {
  const _rect = p5.prototype.rect;
  p5.prototype.rect = function (x, y, w, h, ...r) {
    if (r.length && THEME_FX.corners !== 1) r = r.map(v => (typeof v === "number" ? v * THEME_FX.corners : v));
    return _rect.call(this, x, y, w, h, ...r);
  };
  const _textSize = p5.prototype.textSize;
  p5.prototype.textSize = function (s) {
    if (!arguments.length || typeof s !== "number") return _textSize.apply(this, arguments);
    return _textSize.call(this, s * THEME_FX.text);
  };
  p5.prototype.registerMethod("pre", function () {
    if (!this._renderer || !this._renderer.drawingContext) return;
    this.textFont(FONT);
  });

  // Glow (Neon): bright fills/strokes cast a coloured shadow of their own colour.
  // Skipped on big canvases (fullscreen games) where it would cost too much.
  const R = p5.Renderer2D && p5.Renderer2D.prototype;
  if (R) {
    const glowFor = (r, css) => {
      const ctx = r.drawingContext, g = THEME_FX.glow;
      if (!g || r.width * r.height > 700000) { if (ctx.shadowBlur) ctx.shadowBlur = 0; return; }
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(css);
      if (!m) return;
      const l = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255, a = m[4] === undefined ? 1 : +m[4];
      if (l > 0.42 && a > 0.3) { ctx.shadowColor = css; ctx.shadowBlur = g; } else ctx.shadowBlur = 0;
    };
    const _sf = R._setFill || R.fill, _ss = R._setStroke;
    if (R._setFill) {
      R._setFill = function (css) { glowFor(this, css); return _sf.call(this, css); };
    }
    if (_ss) {
      R._setStroke = function (css) { glowFor(this, css); return _ss.call(this, css); };
    }
  }
}

// Prepare a one-shot (noLoop) sketch, like the home previews, for the theme.
function themeSketch(p) {
  p.textFont(FONT);
}

// ---- picker UI ----

function _rgb(c) { return "rgb(" + c.join(",") + ")"; }

// Designs with continuous, heavy motion. With "reduce motion" on in the system
// settings they are greyed out in the menu, and picking one asks first.
const HEAVY_MOTION = new Set(["liquid", "neon", "y2k", "kinetic", "holo", "flap", "ascii", "comic", "sketch", "cutout"]);
const _reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function _motionWarn(t, onConfirm) {
  document.getElementById("motion-warn")?.remove();
  const ov = document.createElement("div");
  ov.id = "motion-warn";
  ov.className = "motion-warn";
  ov.innerHTML = `<div class="mw-box" role="alertdialog" aria-modal="true" aria-labelledby="mw-title">
      <h2 id="mw-title">${t.name} is heavily animated</h2>
      <p>"Reduce motion" is on in your system settings. This design moves a lot and may be uncomfortable.</p>
      <div class="mw-actions">
        <button type="button" class="mw-cancel">Cancel</button>
        <button type="button" class="mw-ok primary">Apply anyway</button>
      </div>
    </div>`;
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  ov.addEventListener("click", (e) => { e.stopPropagation(); if (e.target === ov) close(); });
  ov.querySelector(".mw-cancel").addEventListener("click", (e) => { e.stopPropagation(); close(); });
  ov.querySelector(".mw-ok").addEventListener("click", (e) => { e.stopPropagation(); close(); onConfirm(); });
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(ov);
  ov.querySelector(".mw-cancel").focus();
}

// Each option shows "Games / small puzzles & toys" rendered in that design:
// a lazy iframe running theme-sample.html with the design's real CSS.
function mountThemePicker(container) {
  if (!container || container.querySelector(".theme-picker")) return;
  const wrap = document.createElement("div");
  wrap.className = "theme-picker";
  wrap.innerHTML = `
    <button class="theme-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Change design">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.8-.3-.9.2-1.8 1.2-1.8H17a4 4 0 0 0 4-4c0-5.5-4-10.4-9-10.4z"/>
        <circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="14.5" cy="7" r="1.2" fill="currentColor"/><circle cx="17" cy="11" r="1.2" fill="currentColor"/>
      </svg><span>Design</span>
    </button>
    <div class="theme-menu" role="menu">
      ${THEMES.map(t => `<button class="theme-opt" type="button" role="menuitemradio" data-theme="${t.id}" aria-label="${t.name}" aria-checked="${t.id === THEME.id}">
          <span class="theme-frame"><iframe data-src="theme-sample.html?design=${t.id}" title="${t.name}" tabindex="-1" aria-hidden="true" loading="lazy"></iframe></span>
        </button>`).join("")}
    </div>`;
  container.appendChild(wrap);
  // cap every px value in a border-radius string (keeps the 4-corner / slash shape)
function capPx(value, max) { return value.replace(/(\d+(?:\.\d+)?)px/g, (m, n) => Math.min(parseFloat(n), max) + "px"); }
// each tile takes the border and corner radius of that design's card
  wrap.querySelectorAll(".theme-frame iframe").forEach((f) => f.addEventListener("load", () => {
    const probe = f.contentDocument?.querySelector("#home .card.probe");
    if (!probe) return;
    probe.style.animation = "none";                       // base radius, not a mid-morph value
    const cs = f.contentWindow.getComputedStyle(probe);
    const frame = f.parentElement;
    frame.style.borderRadius = capPx(cs.borderRadius, 28);   // soft designs (liquid) are cut down to a calmer corner
    frame.style.border = parseFloat(cs.borderTopWidth) > 0
      ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : "none";
  }));
  const btn = wrap.querySelector(".theme-btn");
  // grey out the heavy designs while the system asks for reduced motion
  const syncMotion = () => {
    const reduce = _reduceMotion();
    wrap.querySelectorAll(".theme-opt").forEach((o) => o.classList.toggle("is-muted", reduce && HEAVY_MOTION.has(o.dataset.theme)));
  };
  syncMotion();
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", syncMotion);
  const close = () => { wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !wrap.classList.contains("open");
    wrap.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      syncMotion();
      wrap.querySelectorAll("iframe[data-src]").forEach((f) => { f.src = f.dataset.src; f.removeAttribute("data-src"); });
    }
  });
  wrap.querySelectorAll(".theme-opt").forEach(o => o.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = o.dataset.theme;
    if (!o.classList.contains("is-muted")) return applyTheme(id);
    _motionWarn(THEMES.find((x) => x.id === id), () => applyTheme(id));
  }));
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
