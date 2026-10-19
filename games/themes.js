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

function applyTheme(id, { save = true } = {}) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  THEME = t;
  _deepAssign(PAL, _BASE);
  _deepAssign(PAL, t.pal);
  FONT = t.font;
  THEME_FX = { corners: 1, text: 1, ...t.fx };
  document.documentElement.dataset.theme = t.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = "rgb(" + PAL.bg.join(",") + ")";
  _loadFonts(t);
  if (save) { try { localStorage.setItem(THEME_KEY, t.id); } catch {} }
  document.querySelectorAll(".theme-opt").forEach(b => b.setAttribute("aria-checked", String(b.dataset.theme === t.id)));
  window.dispatchEvent(new CustomEvent("themechange", { detail: t }));
}

// apply the saved theme immediately (this file loads in <head>, before paint)
(function () {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch {}
  applyTheme(saved || "midnight", { save: false });
})();

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
}

// Prepare a one-shot (noLoop) sketch, like the home previews, for the theme.
function themeSketch(p) {
  p.textFont(FONT);
}

// ---- picker UI ----

function _rgb(c) { return "rgb(" + c.join(",") + ")"; }

// A miniature of the design: a framed board with a few tiles, a title bar and
// a button in the theme's own colours, font and corner radius.
function _themePreview(t, P) {
  const c = (k) => _rgb(P[k]);
  const r = Math.round(7 * (t.fx.corners ?? 1));
  const cells = ["well", "panel", "mint", "panel", "sun", "well", "mint", "well", "panel"];
  const hard = t.id === "pop" ? `box-shadow:2px 2px 0 ${c("ink")};` : "";
  const edge = t.id === "pop" ? c("ink") : c(t.id === "brutal" ? "dim" : "line");
  return `<span class="theme-prev" style="background:${c("bg")};border:1px solid ${edge};border-radius:${r}px;${hard}font-family:'${t.font}'">
    <span class="tp-board" style="background:${c("board")};border:1px solid ${edge};border-radius:${Math.round(r / 2)}px">
      ${cells.map(k => `<i style="background:${c(k)};border-radius:${Math.round(r / 4)}px"></i>`).join("")}
    </span>
    <span class="tp-side">
      <b style="color:${c("ink")}">Aa</b>
      <em style="background:${c("mint")};border-radius:${Math.round(r / 2)}px"></em>
      <u style="background:${c("dim")}"></u>
    </span>
  </span>`;
}

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
      ${THEMES.map(t => {
        const P = { ..._BASE, ...t.pal };
        return `<button class="theme-opt" type="button" role="menuitemradio" data-theme="${t.id}" aria-checked="${t.id === THEME.id}">
          ${_themePreview(t, P)}
          <span><span class="theme-name" style="font-family:'${t.font}'">${t.name}</span><br><span class="theme-sub">${t.sub}</span></span>
        </button>`;
      }).join("")}
    </div>`;
  container.appendChild(wrap);
  const btn = wrap.querySelector(".theme-btn");
  const close = () => { wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !wrap.classList.contains("open");
    wrap.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) THEMES.forEach(_loadFonts); // so each name shows in its own font
  });
  wrap.querySelectorAll(".theme-opt").forEach(o => o.addEventListener("click", (e) => {
    e.stopPropagation();
    applyTheme(o.dataset.theme);
  }));
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
