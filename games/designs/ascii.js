// ASCII art — a figlet banner that types in, and a canvas→text converter: the
// card previews are re-drawn as coloured characters, and game boards can be
// switched to an ASCII view with the toggle in the status line.

const _ASC_RAMP = " .,:;i1tfLCG08@";

// Re-draw `src` (a canvas) as characters onto `dst`. cell = [w, h] in src pixels.
// `cache` (optional) lets the live view skip cells that did not change.
function _ascRender(src, dst, bg, cw, ch, cache, scale = 2) {
  const cols = Math.max(8, Math.round(src.width / cw)), rows = Math.max(4, Math.round(src.height / ch));
  const tiny = _ascRender.tiny || (_ascRender.tiny = document.createElement("canvas"));
  tiny.width = cols; tiny.height = rows;
  const t = tiny.getContext("2d", { willReadFrequently: true });
  t.imageSmoothingEnabled = true; t.imageSmoothingQuality = "high";
  t.drawImage(src, 0, 0, cols, rows);
  const px = t.getImageData(0, 0, cols, rows).data;
  const W = cols * 7 * scale, H = rows * 12 * scale;
  if (dst.width !== W || dst.height !== H) { dst.width = W; dst.height = H; if (cache) cache.length = 0; }
  const g = dst.getContext("2d");
  g.font = `700 ${12 * scale}px "JetBrains Mono", monospace`;
  g.textBaseline = "middle"; g.textAlign = "center";
  if (!cache || !cache.length) { g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, W, H); }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4;
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    const d = Math.min(1, Math.hypot(r - bg[0], gg - bg[1], b - bg[2]) / 200);
    const k = Math.min(_ASC_RAMP.length - 1, Math.floor(Math.sqrt(d) * (_ASC_RAMP.length - 0.01)));
    // boost the colour so thin shapes stay vivid
    const f = d > 0.02 ? Math.min(3.2, 0.9 / d) : 1;
    const cr = Math.max(0, Math.min(255, bg[0] + (r - bg[0]) * f)), cg = Math.max(0, Math.min(255, bg[1] + (gg - bg[1]) * f)), cb = Math.max(0, Math.min(255, bg[2] + (b - bg[2]) * f));
    const sig = k * 4096 + (cr >> 5) * 512 + (cg >> 5) * 64 + (cb >> 5) * 8;
    if (cache) { const n = y * cols + x; if (cache[n] === sig) continue; cache[n] = sig; }
    g.fillStyle = `rgb(${bg})`; g.fillRect(x * 7 * scale, y * 12 * scale, 7 * scale, 12 * scale);
    if (k > 0) { g.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`; g.fillText(_ASC_RAMP[k], (x + 0.5) * 7 * scale, (y + 0.55) * 12 * scale); }
  }
}

const _ASC_BANNER = [
  " ██████╗  █████╗ ███╗   ███╗███████╗███████╗",
  "██╔════╝ ██╔══██╗████╗ ████║██╔════╝██╔════╝",
  "██║  ███╗███████║██╔████╔██║█████╗  ███████╗",
  "██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ╚════██║",
  "╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗███████║",
  " ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝",
];

DESIGN_FX.ascii = {
  enter() {
    const cleanups = [];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- home: banner + prompt ----
    const hero = document.querySelector("#home .hero");
    if (hero && document.getElementById("home").style.display !== "none") {
      const banner = document.createElement("pre");
      banner.className = "asc-banner";
      banner.setAttribute("aria-hidden", "true");
      const prompt = document.createElement("div");
      prompt.className = "asc-prompt";
      prompt.setAttribute("aria-hidden", "true");
      hero.append(banner, prompt);
      const lines = _ASC_BANNER, glyphs = "░▒▓█#%&@$";
      let n = reduce ? lines.length : 0, timers = [];
      const paint = (glitch) => {
        banner.textContent = lines.slice(0, n).map((l) => glitch ? l.replace(/█/g, (c) => Math.random() < 0.02 ? glyphs[(Math.random() * glyphs.length) | 0] : c) : l).join("\n");
      };
      const typeText = "<b>malte@games</b>:<b>~</b>$ ls games/ | wc -l\n" + (typeof GAMES !== "undefined" ? GAMES.length : 11) + "   # small puzzles & toys, made by malte\n";
      let ti = reduce ? typeText.length : 0;
      const tick = () => {
        if (n < lines.length) { n++; paint(); timers.push(setTimeout(tick, 110)); return; }
        if (ti < typeText.length) {
          // tags are emitted whole
          if (typeText[ti] === "<") ti = typeText.indexOf(">", ti) + 1; else ti++;
          prompt.innerHTML = typeText.slice(0, ti).replace(/<(?!\/?b>)/g, "&lt;") + '<span class="cur"></span>';
          timers.push(setTimeout(tick, 18)); return;
        }
        prompt.innerHTML = typeText + '<span class="cur"></span>';
        // idle: now and then a few cells of the banner glitch
        if (!reduce) timers.push(setTimeout(() => { paint(true); timers.push(setTimeout(() => { paint(); tick(); }, 90)); }, 3500 + Math.random() * 4000));
      };
      paint(); tick();
      cleanups.push(() => { timers.forEach(clearTimeout); banner.remove(); prompt.remove(); });
    }

    // ---- game: ASCII view toggle ----
    const wrap = document.querySelector("#canvas-wrap:not(.fs)");
    const status = document.getElementById("status");
    if (wrap && status) {
      let on = false;
      try { on = localStorage.getItem("games_ascii_view") === "1"; } catch {}
      const btn = document.createElement("button");
      btn.className = "asc-toggle"; btn.type = "button"; btn.title = "Show the board as ASCII art";
      status.appendChild(btn);
      let ov = null, raf = 0, last = 0, cache = [];
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        if (now - last < 66) return;
        last = now;
        const src = wrap.querySelector("canvas.src, canvas:not(.asc)");
        if (!src || !ov) return;
        _ascRender(src, ov, PAL.board, 5, 9, cache);
      };
      const apply = () => {
        btn.textContent = on ? "view: ascii" : "view: pixels";
        btn.setAttribute("aria-pressed", String(on));
        const src = wrap.querySelector("canvas:not(.asc)");
        if (on && src) {
          src.classList.add("src");
          if (!ov) { ov = document.createElement("canvas"); ov.className = "asc"; wrap.appendChild(ov); }
          cache = []; raf = raf || requestAnimationFrame(loop);
        } else {
          if (src) src.classList.remove("src");
          cancelAnimationFrame(raf); raf = 0;
          if (ov) { ov.remove(); ov = null; }
        }
      };
      btn.addEventListener("click", () => { on = !on; try { localStorage.setItem("games_ascii_view", on ? "1" : "0"); } catch {} apply(); });
      apply();
      cleanups.push(() => { cancelAnimationFrame(raf); if (ov) ov.remove(); wrap.querySelectorAll("canvas").forEach((c) => c.classList.remove("src")); btn.remove(); });
    }
    return () => cleanups.forEach((c) => c());
  },

  // card previews keep their real canvas; the ASCII look is a CSS overlay (ascii.css)
};
