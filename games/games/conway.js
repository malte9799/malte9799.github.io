// Conway's Game of Life
// Infinite sparse grid via Map, smooth zoom/pan, preset library, tool palette
// Cell age color mapping (Cyan -> Green -> Gold -> Orange), birth scaling, and fading death trails.

// LEXICON_SHAPES (from conway-shapes.js, generated from lexicon.txt by parse-lexicon.py)
// is loaded via a dynamically injected <script> tag below, same trick index.html uses to
// load the per-game script, so this keeps working over file:// with no build step or fetch().
// It arrives after this script runs, so the shape-search UI renders once onShapesLoaded fires.
let onShapesLoaded = () => {};
(function loadShapesScript() {
  const s = document.createElement("script");
  s.src = "games/conway-shapes.js";
  s.onload = () => onShapesLoaded();
  document.head.appendChild(s);
})();

initGame({
  title:    "Conway's Life",
  tag:      "evolution heatmap · age trails",
  fullscreen: true,
  presets: [{ label: "—", values: [0] }],
  buttons: [
    { id: "btn-play",    label: "Play" },
    { id: "btn-step",    label: "Step" },
    { id: "btn-random",  label: "Random" },
    { id: "btn-clear",   label: "Clear" },
  ],
  sliders: [],
  onPreset:       () => {},
  onSlider:       () => {},
  getSliderValues: () => ({}),
  info: { anim: infoAnim },
});

// ── state ───────────────────────────────────────────────────────────────────

const ALIVE = new Map();   // "x,y" → age (1 = newborn)
const FADING = new Map();  // "x,y" → fade timer (4 to 1)
let running  = false;
let speed    = 8;          // gens/sec  (1–30)
let genCount = 0;
let lastTick = 0;

// manual step-key repeat (holding "." spams step() like a held button)
const STEP_REPEAT_DELAY = 350; // ms before repeat kicks in after first press
const STEP_REPEAT_RATE  = 60;  // ms between repeated steps once held
let stepKeyHeld = false;
let stepKeyNextAt = 0;
window.addEventListener("blur", () => { stepKeyHeld = false; });

// viewport
let camX = 0, camY = 0;   // world coords at canvas centre
let zoom  = 14;            // px per cell (float)
const ZOOM_MIN = 2, ZOOM_MAX = 80;

// tools
let activeTool = "draw";
let brushSize  = 1;        // radius in cells

// mouse
let isDragging   = false;
let isPainting   = false;
let dragStart    = null;
let camStart     = null;
let paintedCells = new Set();
let lastPaintPos = null;

// pending preset drop
let pendingPreset = null;
let ghostX = 0, ghostY = 0;

// ── shape library ────────────────────────────────────────────────────────────
// All placeable shapes come from LEXICON_SHAPES (games/conway-shapes.js), parsed
// from the Life Lexicon (lexicon.txt) by parse-lexicon.py. FEATURED just picks a
// handful of well-known names to show before the user searches for anything.
// LEXICON_SHAPES entries look like { name, w, h, cells: [[x,y], ...] }.

const FEATURED = [
  "block","beehive","loaf","boat","tub","eater1",
  "blinker","toad","beacon","pulsar","pentadecathlon","queen bee shuttle",
  "glider","copperhead","dart","spider","weekender","Canada goose",
  "R-pentomino","diehard","acorn","infinite growth","switch engine",
  "Gosper glider gun","Simkin glider gun","B-52 bomber",
];

function findShape(name) {
  return SHAPES_BY_NAME.get(name.toLowerCase());
}

let SHAPES_BY_NAME = new Map();
let SHAPE_LIST = [];
let shapesReady = false;

onShapesLoaded = () => {
  SHAPE_LIST = (typeof LEXICON_SHAPES !== "undefined" ? LEXICON_SHAPES : []);
  SHAPES_BY_NAME = new Map(SHAPE_LIST.map(s => [s.name.toLowerCase(), s]));
  shapesReady = true;
  // buildUI() (further down this file) may not have run yet — if #shape-search
  // isn't in the DOM yet, buildShapeSearch() runs again from buildUI() itself.
  buildShapeSearch();
};


// ── helpers ──────────────────────────────────────────────────────────────────

const key  = (x, y) => x + "," + y;
const set  = (x, y) => ALIVE.set(key(x,y), 1); // default age 1 on brush paint
const unset = (x, y) => {
  const k = key(x,y);
  if (ALIVE.has(k)) {
    ALIVE.delete(k);
    FADING.set(k, 4); // start ghost trail
  }
};
const alive = (x, y) => ALIVE.has(key(x,y));

function screenToWorld(sx, sy, p) {
  const cx = p.width / 2, cy = p.height / 2;
  return {
    x: Math.floor((sx - cx) / zoom + camX),
    y: Math.floor((sy - cy) / zoom + camY),
  };
}

function worldToScreen(wx, wy, p) {
  const cx = p.width / 2, cy = p.height / 2;
  return {
    x: (wx - camX) * zoom + cx,
    y: (wy - camY) * zoom + cy,
  };
}

// ── simulation ────────────────────────────────────────────────────────────────

function step() {
  const neighborCount = new Map();
  for (const k of ALIVE.keys()) {
    const [x, y] = k.split(",").map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nk = key(x + dx, y + dy);
        neighborCount.set(nk, (neighborCount.get(nk) || 0) + 1);
      }
    }
  }
  const next = new Map();
  for (const [k, count] of neighborCount) {
    const wasAlive = ALIVE.has(k);
    if (wasAlive && (count === 2 || count === 3)) {
      const prevAge = ALIVE.get(k) || 1;
      next.set(k, prevAge + 1);
    } else if (!wasAlive && count === 3) {
      next.set(k, 1); // born
    }
  }

  // Trigger death fade trails
  for (const k of ALIVE.keys()) {
    if (!next.has(k)) {
      FADING.set(k, 4); // starts fade at 4 frames
    }
  }

  ALIVE.clear();
  for (const [k, v] of next) ALIVE.set(k, v);
  genCount++;
  updateStatus();
}

// ── drawing helpers ───────────────────────────────────────────────────────────

function paintCell(cx, cy) {
  const cellsInBrush = [];
  const r = brushSize - 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (r > 0 && dx*dx + dy*dy > r*r + 0.5) continue;
      cellsInBrush.push([cx + dx, cy + dy]);
    }
  }

  if (activeTool === "draw") {
    for (const [x, y] of cellsInBrush) {
      if (!paintedCells.has(key(x,y))) { set(x, y); paintedCells.add(key(x,y)); }
    }
  } else if (activeTool === "erase") {
    for (const [x, y] of cellsInBrush) { unset(x, y); }
  } else if (activeTool === "random") {
    for (const [x, y] of cellsInBrush) {
      if (!paintedCells.has(key(x,y))) {
        if (Math.random() < 0.45) set(x, y); else unset(x, y);
        paintedCells.add(key(x,y));
      }
    }
  }
}

function interpolatePaint(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const steps = Math.max(dx, dy);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const ix = Math.round(x0 + (x1 - x0) * t);
    const iy = Math.round(y0 + (y1 - y0) * t);
    paintCell(ix, iy);
  }
}

function placePreset(cells, ox, oy) {
  for (const [dx, dy] of cells) set(ox + dx, oy + dy);
  updateStatus();
}

// ── p5 sketch ────────────────────────────────────────────────────────────────

new p5(function(p) {

  p.setup = function() {
    const wrap = document.getElementById("canvas-wrap");
    const cnv  = p.createCanvas(wrap.offsetWidth, wrap.offsetHeight);
    cnv.parent(wrap);
    p.frameRate(60);
    p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    centerView();
    updateStatus();

    window.addEventListener("resize", () => {
      p.resizeCanvas(wrap.offsetWidth, wrap.offsetHeight);
    });

    wrap.addEventListener("contextmenu", e => e.preventDefault());

    // ── mouse input ──────────

    function canvasMousePos(e) {
      const rect = cnv.elt.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (p.width  / rect.width),
        y: (e.clientY - rect.top)  * (p.height / rect.height),
      };
    }

    cnv.elt.addEventListener("mousedown", e => {
      e.preventDefault();
      const isRightBtn = e.button === 2;
      const { x: mx, y: my } = canvasMousePos(e);

      if (pendingPreset && !isRightBtn) {
        const shape = findShape(pendingPreset);
        if (shape) placePreset(shape.cells, ghostX, ghostY);
        cancelPreset();
        return;
      }

      if (isRightBtn) {
        isDragging = true;
        dragStart  = { x: mx, y: my };
        camStart   = { x: camX, y: camY };
      } else {
        isPainting = true;
        paintedCells.clear();
        const pos = screenToWorld(mx, my, p);
        lastPaintPos = pos;
        paintCell(pos.x, pos.y);
      }
    });

    window.addEventListener("mousemove", e => {
      if (!isDragging && !isPainting) return;
      const { x: mx, y: my } = canvasMousePos(e);
      if (isDragging) {
        camX = camStart.x - (mx - dragStart.x) / zoom;
        camY = camStart.y - (my - dragStart.y) / zoom;
      } else if (isPainting) {
        const pos = screenToWorld(mx, my, p);
        if (lastPaintPos) interpolatePaint(lastPaintPos.x, lastPaintPos.y, pos.x, pos.y);
        lastPaintPos = pos;
      }
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      isPainting = false;
      paintedCells.clear();
      lastPaintPos = null;
    });

    // wheel zoom
    wrap.addEventListener("wheel", e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const mx = e.offsetX, my = e.offsetY;
      const wx = (mx - p.width/2) / zoom + camX;
      const wy = (my - p.height/2) / zoom + camY;
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
      camX = wx - (mx - p.width/2) / zoom;
      camY = wy - (my - p.height/2) / zoom;
    }, { passive: false });
  };

  p.draw = function() {
    // simulation tick
    if (running) {
      const interval = 1000 / speed;
      if (p.millis() - lastTick >= interval) {
        step();
        lastTick = p.millis();
      }
    } else if (stepKeyHeld && p.millis() >= stepKeyNextAt) {
      step();
      stepKeyNextAt = p.millis() + STEP_REPEAT_RATE;
    }

    // Tick down fading cells
    for (const [k, fade] of FADING.entries()) {
      if (fade <= 1) {
        FADING.delete(k);
      } else {
        FADING.set(k, fade - 1);
      }
    }

    drawWorld(p);
    drawGhost(p);
    drawBrushPreview(p);
    drawCursor(p);
  };

  // ── render ──────────────────────────────────────────────────────────────────

  function drawWorld(p) {
    p.background(20, 18, 15);

    const cx = p.width / 2, cy = p.height / 2;
    const left  = Math.floor(camX - cx / zoom) - 1;
    const right = Math.ceil(camX  + cx / zoom) + 1;
    const top   = Math.floor(camY - cy / zoom) - 1;
    const bot   = Math.ceil(camY  + cy / zoom) + 1;

    // grid lines (only when zoomed in enough)
    if (zoom >= 6) {
      p.stroke(30, 27, 24);
      p.strokeWeight(1);
      for (let x = left; x <= right; x++) {
        const sx = (x - camX) * zoom + cx;
        p.line(sx, 0, sx, p.height);
      }
      for (let y = top; y <= bot; y++) {
        const sy = (y - camY) * zoom + cy;
        p.line(0, sy, p.width, sy);
      }
    }

    p.noStroke();

    // 1. Draw fading trails first
    for (const [k, fade] of FADING.entries()) {
      const [x, y] = k.split(",").map(Number);
      if (x < left || x > right || y < top || y > bot) continue;
      const sx = (x - camX) * zoom + cx;
      const sy = (y - camY) * zoom + cy;
      const pad = zoom > 5 ? Math.min(zoom * 0.08, 1.5) : 0;
      
      const alpha = (fade / 4) * 85;
      const scaleVal = 0.5 + (fade / 4) * 0.42; // shrink as it dies
      
      p.fill(127, 176, 105, alpha); // fade green
      
      const sizeC = (zoom - pad * 2) * scaleVal;
      const offsetC = (zoom - sizeC) / 2;
      p.rect(sx + offsetC, sy + offsetC, sizeC, sizeC, zoom > 8 ? 2 : 0);
    }

    // 2. Draw active age-colored cells
    for (const [k, age] of ALIVE.entries()) {
      const [x, y] = k.split(",").map(Number);
      if (x < left || x > right || y < top || y > bot) continue;
      const sx = (x - camX) * zoom + cx;
      const sy = (y - camY) * zoom + cy;
      const pad = zoom > 5 ? Math.min(zoom * 0.08, 1.5) : 0;
      
      // Theme colors matching the style
      // Age 1: born cyan [90, 180, 190]
      // Age 2-5: standard green [127, 176, 105]
      // Age 6-15: gold [230, 180, 34]
      // Age > 15: deep orange [220, 120, 60]
      let col = [127, 176, 105];
      let scaleVal = 0.95;

      if (age === 1) {
        col = [90, 180, 190]; // newborn cyan
        scaleVal = 0.78; // small pop scale
      } else if (age >= 16) {
        col = [220, 120, 60]; // mature orange
      } else if (age >= 6) {
        col = [230, 180, 34]; // stable gold
      }

      p.fill(col[0], col[1], col[2]);
      
      const sizeC = (zoom - pad * 2) * scaleVal;
      const offsetC = (zoom - sizeC) / 2;
      p.rect(sx + offsetC, sy + offsetC, sizeC, sizeC, zoom > 8 ? 2 : 0);
    }

    // origin cross (tiny)
    if (zoom > 8) {
      const { x: o0x, y: o0y } = worldToScreen(0, 0, p);
      p.stroke(50, 45, 40);
      p.strokeWeight(1);
      p.line(o0x - 6, o0y, o0x + 6, o0y);
      p.line(o0x, o0y - 6, o0x, o0y + 6);
    }
  }

  function drawGhost(p) {
    if (!pendingPreset) return;
    const shape = findShape(pendingPreset);
    if (!shape) return;
    const cells = shape.cells;
    const mx = p.mouseX, my = p.mouseY;
    const { x: wx, y: wy } = screenToWorld(mx, my, p);

    const minX = Math.min(...cells.map(([x]) => x));
    const maxX = Math.max(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));
    const offX = Math.round((minX + maxX) / 2);
    const offY = Math.round((minY + maxY) / 2);
    ghostX = wx - offX; ghostY = wy - offY;

    const cx = p.width / 2, cy = p.height / 2;
    p.noStroke();
    p.fill(90, 180, 190, 100); // cyan ghost template
    for (const [dx, dy] of cells) {
      const sx = (ghostX + dx - camX) * zoom + cx;
      const sy = (ghostY + dy - camY) * zoom + cy;
      const pad = zoom > 5 ? Math.min(zoom * 0.08, 1.5) : 0;
      p.rect(sx + pad, sy + pad, zoom - pad*2, zoom - pad*2, zoom > 8 ? 2 : 0);
    }
  }

  function drawBrushPreview(p) {
    if (pendingPreset || isDragging) return;
    const { x: wx, y: wy } = screenToWorld(p.mouseX, p.mouseY, p);
    const ccx = p.width / 2, ccy = p.height / 2;
    const r = brushSize - 1;
    const pad = zoom > 5 ? Math.min(zoom * 0.08, 1.5) : 0;

    const eraseMode = activeTool === "erase";
    p.noStroke();
    if (eraseMode) p.fill(200, 50, 63, 60);
    else if (activeTool === "random") p.fill(230, 180, 34, 55);
    else p.fill(90, 180, 190, 55); // Cyan brush preview

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && dx*dx + dy*dy > r*r + 0.5) continue;
        const sx = (wx + dx - camX) * zoom + ccx;
        const sy = (wy + dy - camY) * zoom + ccy;
        p.rect(sx + pad, sy + pad, zoom - pad*2, zoom - pad*2, zoom > 8 ? 2 : 0);
      }
    }
  }

  function drawCursor(p) {
    if (pendingPreset) { p.cursor("crosshair"); return; }
    if (isDragging) { p.cursor("grabbing"); return; }
    p.cursor("crosshair");
  }

  p.keyPressed = function() {
    if (p.key === " ") { toggleRun(); return false; }
    if (p.key === "." || p.key === ">") {
      if (!running && !stepKeyHeld) {
        step();
        stepKeyHeld = true;
        stepKeyNextAt = p.millis() + STEP_REPEAT_DELAY;
      }
    }
    if (p.key === "Escape") cancelPreset();
  };

  p.keyReleased = function() {
    if (p.key === "." || p.key === ">") stepKeyHeld = false;
  };
});

// ── UI helpers ─────────────────────────────────────────────────────────────────

function centerView() {
  camX = 0; camY = 0;
  zoom = 14;
}

function toggleRun() {
  running = !running;
  lastTick = performance.now();
  const btn = document.getElementById("btn-play");
  if (btn) {
    btn.classList.toggle("primary", running);
    btn.innerHTML = running
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="12" height="12" fill="currentColor" style="margin-right:5px"><path d="M48 64C21.5 64 0 85.5 0 112L0 400c0 26.5 21.5 48 48 48l32 0c26.5 0 48-21.5 48-48l0-288c0-26.5-21.5-48-48-48L48 64zm192 0c-26.5 0-48 21.5-48 48l0 288c0 26.5 21.5 48 48 48l32 0c26.5 0 48-21.5 48-48l0-288c0-26.5-21.5-48-48-48l-32 0z"/></svg>Pause`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor" style="margin-right:5px"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>Play`;
  }
  updateStatus();
}

function clearGrid() {
  ALIVE.clear();
  FADING.clear();
  genCount = 0;
  updateStatus();
}

function cancelPreset() {
  pendingPreset = null;
  const search = document.getElementById("shape-search");
  if (search) search.value = "";
  const hint = document.getElementById("preset-hint");
  if (hint) hint.textContent = "";
}

function updateStatus() {
  const pop = ALIVE.size;
  setStatus(`gen ${genCount}  ·  pop ${pop.toLocaleString()}  ·  ${running ? "▶ running" : "⏸ paused"}`, null);
}

function randomFill() {
  const count = 2000;
  const spread = 40;
  for (let i = 0; i < count; i++) {
    const x = Math.round((Math.random() - 0.5) * spread * 2);
    const y = Math.round((Math.random() - 0.5) * spread * 2);
    set(x, y);
  }
  genCount = 0;
  updateStatus();
}

// ── rebuild the UI overlay with our own controls ──────────────────────────────

(function buildUI() {
  const overlay = document.getElementById("ui-overlay");
  overlay.innerHTML = `
    <div id="gol-bar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px 12px">
      <a class="back-link" href="index.html" style="flex-shrink:0">← Games</a>
      <div style="width:1px;height:20px;background:var(--panel-edge);flex-shrink:0"></div>
 
      <!-- play controls -->
      <button id="btn-play" style="flex:none;min-width:80px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor" style="margin-right:5px"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>Play</button>
      <button id="btn-step" style="flex:none">Step</button>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:11px;color:var(--muted);letter-spacing:0.05em">Speed</span>
        <input type="range" id="sl-speed" min="1" max="40" step="1" value="8" style="width:80px;accent-color:var(--accent)">
        <span id="v-speed" style="font-size:12px;color:var(--ink);min-width:32px;font-variant-numeric:tabular-nums">8/s</span>
      </div>
 
      <div style="width:1px;height:20px;background:var(--panel-edge);flex-shrink:0"></div>
 
      <!-- tools -->
      <div style="display:flex;gap:4px;flex-shrink:0" id="tool-row">
        <button id="tool-draw"   class="active" title="Draw (D)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="13" height="13" fill="currentColor" style="margin-right:4px"><path d="M416.9 85.2L372 130.1L509.9 268L554.8 223.1C568.4 209.6 576 191.2 576 172C576 152.8 568.4 134.4 554.8 120.9L519.1 85.2C505.6 71.6 487.2 64 468 64C448.8 64 430.4 71.6 416.9 85.2zM338.1 164L122.9 379.1C112.2 389.8 104.4 403.2 100.3 417.8L64.9 545.6C62.6 553.9 64.9 562.9 71.1 569C77.3 575.1 86.2 577.5 94.5 575.2L222.3 539.7C236.9 535.6 250.2 527.9 261 517.1L476 301.9L338.1 164z"/></svg>Draw</button>
        <button id="tool-erase"  title="Erase (E)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="13" height="13" fill="currentColor" style="margin-right:4px"><path d="M210.5 480L333.5 480L398.8 414.7L225.3 241.2L98.6 367.9L210.6 479.9zM256 544L210.5 544C193.5 544 177.2 537.3 165.2 525.3L49 409C38.1 398.1 32 383.4 32 368C32 352.6 38.1 337.9 49 327L295 81C305.9 70.1 320.6 64 336 64C351.4 64 366.1 70.1 377 81L559 263C569.9 273.9 576 288.6 576 304C576 319.4 569.9 334.1 559 345L424 480L544 480C561.7 480 576 494.3 576 512C576 529.7 561.7 544 544 544L256 544z"/></svg>Erase</button>
        <button id="tool-random" title="Random brush (R)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="13" height="13" fill="currentColor" style="margin-right:4px"><path d="M205.4 66.3C167 56 127.5 78.8 117.3 117.2L66.5 306.7C56.2 345.1 79 384.6 117.4 394.9L306.9 445.7C345.3 456 384.8 433.2 395.1 394.8L445.9 205.3C456.2 166.9 433.4 127.4 395 117.1L205.4 66.3zM228.4 272C222.3 262.1 222.1 249.6 227.8 239.5C233.5 229.4 244.3 223.2 256 223.3C267.6 223.4 278.2 229.8 283.8 240C289.9 249.9 290.1 262.4 284.4 272.5C278.7 282.6 267.9 288.8 256.2 288.7C244.6 288.6 234 282.2 228.4 272zM143.2 284.3C153.1 278.2 165.6 278 175.7 283.7C185.8 289.4 192 300.2 191.9 311.9C191.8 323.5 185.4 334.1 175.2 339.7C165.3 345.8 152.8 346 142.7 340.3C132.6 334.6 126.4 323.8 126.5 312.1C126.6 300.5 133 289.9 143.2 284.3zM328.2 380.7C318.3 386.8 305.8 387 295.7 381.3C285.6 375.6 279.4 364.8 279.5 353.1C279.6 341.5 286 330.9 296.2 325.3C306.1 319.2 318.6 319 328.7 324.7C338.8 330.4 345 341.2 344.9 352.9C344.8 364.5 338.4 375.1 328.2 380.7zM337.2 172.3C347.1 166.2 359.6 166 369.7 171.7C379.8 177.4 386 188.2 385.9 199.9C385.8 211.5 379.4 222.1 369.2 227.7C359.3 233.8 346.8 234 336.7 228.3C326.6 222.6 320.4 211.8 320.5 200.1C320.6 188.5 327 177.9 337.2 172.3zM216.2 186.7C206.3 192.8 193.8 193 183.7 187.3C173.6 181.6 167.4 170.8 167.5 159.1C167.6 147.5 174 136.9 184.2 131.3C194.1 125.2 206.6 125 216.7 130.7C226.8 136.4 233 147.2 232.9 158.9C232.8 170.5 226.4 181.1 216.2 186.7zM482 256L441.4 407.2C424.2 471.2 358.4 509.2 294.4 492.1L256.1 481.8L256.1 512C256.1 547.3 284.8 576 320.1 576L512.1 576C547.4 576 576.1 547.3 576.1 512L576.1 320C576.1 284.7 547.4 256 512.1 256L482 256z"/></svg>Random</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:11px;color:var(--muted);letter-spacing:0.05em">Brush</span>
        <input type="range" id="sl-brush" min="1" max="12" step="1" value="1" style="width:60px;accent-color:var(--accent)">
        <span id="v-brush" style="font-size:12px;color:var(--ink);min-width:18px;font-variant-numeric:tabular-nums">1</span>
      </div>
 
      <div style="width:1px;height:20px;background:var(--panel-edge);flex-shrink:0"></div>
 
      <!-- preset insert: search + select with shape preview thumbnails -->
      <div style="position:relative;display:flex;align-items:center;gap:8px;flex-shrink:0" id="shape-picker">
        <span style="font-size:11px;color:var(--muted);letter-spacing:0.05em">Insert</span>
        <input id="shape-search" type="text" autocomplete="off" placeholder="Loading shapes…" disabled
          style="width:150px;border:1px solid var(--panel-edge);background:var(--panel);color:var(--ink);font:inherit;font-size:12px;padding:6px 10px;border-radius:7px" />
        <div id="shape-panel" style="display:none;position:absolute;top:calc(100% + 6px);left:0;width:300px;max-height:360px;overflow-y:auto;background:var(--panel);border:1px solid var(--panel-edge);border-radius:9px;box-shadow:0 16px 32px rgba(0,0,0,0.45);z-index:20;padding:4px"></div>
        <span id="preset-hint" style="font-size:11px;color:var(--muted);letter-spacing:0.04em;min-width:120px"></span>
      </div>

      <div style="width:1px;height:20px;background:var(--panel-edge);flex-shrink:0"></div>
 
      <!-- grid ops -->
      <button id="btn-rand-fill" style="flex:none">Random</button>
      <button id="btn-clear"     style="flex:none">Clear</button>
      <button id="btn-info"      class="info-btn" style="flex:none">?</button>

      <!-- status right -->
      <span id="status-text" style="font-size:11px;color:var(--muted);letter-spacing:0.05em;margin-left:auto;white-space:nowrap"></span>
    </div>
    <div id="gol-hint" style="font-size:11px;color:var(--muted);padding:0 16px 8px;letter-spacing:0.04em;min-height:1em">
      Left-click/drag: draw · Right-drag: pan · Scroll: zoom · Space: play/pause · .: step
    </div>
  `;

  // wire buttons
  document.getElementById("btn-play").addEventListener("click", toggleRun);
  document.getElementById("btn-step").addEventListener("click", () => { if (!running) step(); });
  document.getElementById("btn-rand-fill").addEventListener("click", randomFill);
  document.getElementById("btn-clear").addEventListener("click", () => { clearGrid(); cancelPreset(); });
  document.getElementById("btn-info").addEventListener("click", () => _openInfo());

  document.getElementById("sl-speed").addEventListener("input", function() {
    speed = +this.value;
    document.getElementById("v-speed").textContent = speed + "/s";
  });

  document.getElementById("sl-brush").addEventListener("input", function() {
    brushSize = +this.value;
    document.getElementById("v-brush").textContent = brushSize;
  });

  // tool buttons
  ["draw","erase","random"].forEach(t => {
    document.getElementById("tool-" + t).addEventListener("click", () => {
      activeTool = t;
      cancelPreset();
      ["draw","erase","random"].forEach(x => {
        document.getElementById("tool-" + x).classList.toggle("active", x === t);
      });
    });
  });

  function syncBrush() {
    brushSize = Math.max(1, Math.min(12, brushSize));
    const sl = document.getElementById("sl-brush");
    if (sl) sl.value = brushSize;
    const v = document.getElementById("v-brush");
    if (v) v.textContent = brushSize;
  }

  function syncSpeed() {
    speed = Math.max(1, Math.min(40, speed));
    const sl = document.getElementById("sl-speed");
    if (sl) sl.value = speed;
    const v = document.getElementById("v-speed");
    if (v) v.textContent = speed + "/s";
  }

  // keyboard shortcuts
  window.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "d" || e.key === "D") document.getElementById("tool-draw").click();
    if (e.key === "e" || e.key === "E") document.getElementById("tool-erase").click();
    if (e.key === "r" || e.key === "R") document.getElementById("tool-random").click();
    if (e.key === "b" || e.key === "B") { brushSize++; syncBrush(); }
    if (e.key === "v" || e.key === "V") { brushSize--; syncBrush(); }
    if (e.key === "+" || e.key === "=") { speed++; syncSpeed(); }
    if (e.key === "-" || e.key === "_") { speed--; syncSpeed(); }
    if (e.key === " ")  e.preventDefault();
    if (e.key === "Escape") cancelPreset();
    if (e.key === "c" || e.key === "C") { clearGrid(); cancelPreset(); }
  });

  if (shapesReady) buildShapeSearch();

  updateStatus();
})();

// ── info modal animation ─────────────────────────────────────────────────────
// Two-phase demo: a blinker oscillator flipping orientation (cells with 2-3
// neighbors survive, others die, empty cells with exactly 3 neighbors are
// born), then a glider crawling diagonally to show patterns can travel.

function infoAnim(p, w, h, frame) {
  const cs = Math.min(w, h) / 9;
  const ox = w / 2, oy = h / 2;

  const PHASE_LEN = 70;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);
  const sub = Math.floor((t % PHASE_LEN) / (PHASE_LEN / 2)) % 2; // 0/1 within phase

  p.background(20, 18, 15);
  p.noStroke();

  function drawCells(cells, col) {
    p.fill(col[0], col[1], col[2]);
    for (const [x, y] of cells) {
      const sx = ox + x * cs, sy = oy + y * cs;
      p.rect(sx - cs/2 + 1, sy - cs/2 + 1, cs - 2, cs - 2, 2);
    }
  }

  if (phase === 0) {
    // blinker: horizontal <-> vertical every half-phase
    const horiz = [[-1,0],[0,0],[1,0]];
    const vert  = [[0,-1],[0,0],[0,1]];
    drawCells(sub === 0 ? horiz : vert, [127, 176, 105]);
  } else {
    // glider crawling one step diagonally per sub-tick, across 4 sub-steps total
    const step = Math.floor((t % PHASE_LEN) / (PHASE_LEN / 4));
    const gliderFrames = [
      [[0,-1],[1,0],[-1,1],[0,1],[1,1]],
      [[-1,0],[1,0],[0,1],[1,1],[1,-1]],
      [[0,-1],[1,0],[-1,1],[0,1],[1,1]].map(([x,y]) => [x+1,y+1]),
      [[-1,0],[1,0],[0,1],[1,1],[1,-1]].map(([x,y]) => [x+1,y+1]),
    ];
    drawCells(gliderFrames[step % 4], [90, 180, 190]);
  }
}

// ── shape search/select popup ─────────────────────────────────────────────────
// Filters LEXICON_SHAPES by name; each result row shows a tiny canvas preview
// of the pattern next to its name. Click (or Enter) sets pendingPreset so the
// existing ghost-preview/click-to-place flow in the p5 sketch takes over.

const SHAPE_RESULTS_LIMIT = 60;

function drawShapeThumb(canvas, shape) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pad = 3;
  const cell = Math.max(1, Math.min((w - pad * 2) / shape.w, (h - pad * 2) / shape.h));
  const offX = (w - shape.w * cell) / 2;
  const offY = (h - shape.h * cell) / 2;
  ctx.fillStyle = "#7fb069";
  for (const [x, y] of shape.cells) {
    ctx.fillRect(offX + x * cell, offY + y * cell, Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
  }
}

let _shapeSearchWired = false;

function buildShapeSearch() {
  const search  = document.getElementById("shape-search");
  const panel   = document.getElementById("shape-panel");
  const hint    = document.getElementById("preset-hint");
  if (!search || !panel || !shapesReady) return;

  search.disabled = false;
  search.placeholder = "Search shapes…";

  if (_shapeSearchWired) return; // avoid double-binding if both load orderings fire
  _shapeSearchWired = true;

  let activeIndex = -1;
  let currentResults = [];

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    let list;
    if (!q) {
      list = FEATURED.map(findShape).filter(Boolean);
    } else {
      list = SHAPE_LIST.filter(s => s.name.toLowerCase().includes(q)).slice(0, SHAPE_RESULTS_LIMIT);
    }
    currentResults = list;
    activeIndex = -1;

    if (list.length === 0) {
      panel.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--muted)">No shapes match "${query}"</div>`;
      return;
    }

    panel.innerHTML = list.map((s, i) =>
      `<div class="shape-row" data-i="${i}" style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer">
        <canvas width="40" height="40" style="flex-shrink:0;width:40px!important;height:40px!important;background:#14120f;border-radius:4px"></canvas>
        <span style="font-size:12px;letter-spacing:0.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${s.name}</span>
      </div>`
    ).join("");

    const rows = panel.querySelectorAll(".shape-row");
    rows.forEach((row, i) => {
      drawShapeThumb(row.querySelector("canvas"), list[i]);
      row.addEventListener("mouseenter", () => setActive(i));
      row.addEventListener("mousedown", (e) => { e.preventDefault(); chooseShape(list[i]); });
    });
  }

  function setActive(i) {
    const rows = panel.querySelectorAll(".shape-row");
    rows.forEach(r => r.style.background = "");
    activeIndex = i;
    if (rows[i]) rows[i].style.background = "#3a352e";
  }

  function chooseShape(shape) {
    pendingPreset = shape.name;
    search.value = shape.name;
    hint.textContent = "Left-click to place · Esc to cancel";
    closePanel();
    search.blur();
  }

  function openPanel() {
    panel.style.display = "block";
    renderResults(search.value === pendingPreset ? "" : search.value);
  }

  function closePanel() {
    panel.style.display = "none";
  }

  search.addEventListener("focus", openPanel);
  search.addEventListener("input", () => {
    if (pendingPreset) { pendingPreset = null; hint.textContent = ""; }
    panel.style.display = "block";
    renderResults(search.value);
  });

  search.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentResults[activeIndex]) chooseShape(currentResults[activeIndex]);
    } else if (e.key === "Escape") {
      closePanel();
      search.blur();
      cancelPreset();
    }
  });

  document.addEventListener("mousedown", (e) => {
    const picker = document.getElementById("shape-picker");
    if (picker && !picker.contains(e.target)) closePanel();
  });
}
