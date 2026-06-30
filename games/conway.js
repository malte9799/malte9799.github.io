// Conway's Game of Life
// Infinite sparse grid via Map, smooth zoom/pan, preset library, tool palette
// Cell age color mapping (Cyan -> Green -> Gold -> Orange), birth scaling, and fading death trails.

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
});

// ── state ───────────────────────────────────────────────────────────────────

const ALIVE = new Map();   // "x,y" → age (1 = newborn)
const FADING = new Map();  // "x,y" → fade timer (4 to 1)
let running  = false;
let speed    = 8;          // gens/sec  (1–30)
let genCount = 0;
let lastTick = 0;

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

// ── presets (generated from lexicon.txt at build time — see build-presets.js) ──

const PRESET_GROUPS = [
  { label: "Still Lifes",  keys: ["Block","Beehive","Loaf","Boat","Tub","Eater"] },
  { label: "Oscillators",  keys: ["Blinker","Toad","Beacon","Pulsar","Pentadecathlon","Queen Bee Shuttle"] },
  { label: "Spaceships",   keys: ["Glider","Copperhead","Dart","Spider","Weekender","Canada Goose"] },
  { label: "Methuselahs",  keys: ["R-Pentomino","Diehard","Acorn","Infinite Growth","Switch Engine"] },
  { label: "Guns",         keys: ["Gosper Glider Gun","Simkin Glider Gun","B-52 Bomber"] },
];

// Generated from lexicon.txt by build-presets.js — do not edit by hand
const PRESETS = {
  "Block": [[0,0],[1,0],[0,1],[1,1]],
  "Beehive": [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2]],
  "Loaf": [[1,0],[2,0],[0,1],[3,1],[1,2],[3,2],[2,3]],
  "Boat": [[0,0],[1,0],[0,1],[2,1],[1,2]],
  "Tub": [[1,0],[0,1],[2,1],[1,2]],
  "Eater": [[0,0],[1,0],[0,1],[1,2],[2,2],[3,2],[3,3]],
  "Blinker": [[0,0],[1,0],[2,0]],
  "Toad": [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1]],
  "Beacon": [[0,0],[1,0],[0,1],[3,2],[2,3],[3,3]],
  "Pulsar": [[2,0],[3,0],[4,0],[8,0],[9,0],[10,0],[0,2],[5,2],[7,2],[12,2],[0,3],[5,3],[7,3],[12,3],[0,4],[5,4],[7,4],[12,4],[2,5],[3,5],[4,5],[8,5],[9,5],[10,5],[2,7],[3,7],[4,7],[8,7],[9,7],[10,7],[0,8],[5,8],[7,8],[12,8],[0,9],[5,9],[7,9],[12,9],[0,10],[5,10],[7,10],[12,10],[2,12],[3,12],[4,12],[8,12],[9,12],[10,12]],
  "Pentadecathlon": [[2,0],[7,0],[0,1],[1,1],[3,1],[4,1],[5,1],[6,1],[8,1],[9,1],[2,2],[7,2]],
  "Queen Bee Shuttle": [[9,0],[7,1],[9,1],[6,2],[8,2],[0,3],[1,3],[5,3],[8,3],[0,4],[1,4],[6,4],[8,4],[7,5],[9,5],[18,5],[19,5],[9,6],[18,6],[20,6],[20,7],[20,8],[21,8]],
  "Glider": [[0,0],[1,0],[2,0],[0,1],[1,2]],
  "Copperhead": [[1,0],[2,0],[3,0],[4,0],[1,2],[4,2],[0,3],[2,3],[3,3],[5,3],[0,4],[5,4],[0,6],[5,6],[0,7],[1,7],[4,7],[5,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[1,9],[4,9],[2,10],[3,10],[2,11],[3,11]],
  "Dart": [[7,0],[6,1],[8,1],[5,2],[9,2],[6,3],[7,3],[8,3],[4,5],[5,5],[9,5],[10,5],[2,6],[6,6],[8,6],[12,6],[1,7],[2,7],[6,7],[8,7],[12,7],[13,7],[0,8],[6,8],[8,8],[14,8],[1,9],[3,9],[4,9],[6,9],[8,9],[10,9],[11,9],[13,9]],
  "Spider": [[6,0],[10,0],[11,0],[12,0],[18,0],[19,0],[20,0],[24,0],[3,1],[4,1],[6,1],[7,1],[8,1],[9,1],[10,1],[12,1],[13,1],[17,1],[18,1],[20,1],[21,1],[22,1],[23,1],[24,1],[26,1],[27,1],[1,2],[3,2],[4,2],[6,2],[12,2],[14,2],[16,2],[18,2],[24,2],[26,2],[27,2],[29,2],[0,3],[4,3],[6,3],[10,3],[11,3],[12,3],[13,3],[14,3],[16,3],[17,3],[18,3],[19,3],[20,3],[24,3],[26,3],[30,3],[4,4],[5,4],[6,4],[12,4],[13,4],[17,4],[18,4],[24,4],[25,4],[26,4],[1,5],[4,5],[6,5],[7,5],[8,5],[22,5],[23,5],[24,5],[26,5],[29,5],[3,6],[27,6]],
  "Weekender": [[1,0],[14,0],[1,1],[14,1],[0,2],[2,2],[13,2],[15,2],[1,3],[14,3],[1,4],[14,4],[2,5],[6,5],[7,5],[8,5],[9,5],[13,5],[6,6],[7,6],[8,6],[9,6],[2,7],[3,7],[4,7],[5,7],[10,7],[11,7],[12,7],[13,7],[4,9],[11,9],[5,10],[6,10],[9,10],[10,10]],
  "Canada Goose": [[0,0],[1,0],[2,0],[0,1],[10,1],[11,1],[1,2],[8,2],[9,2],[10,2],[12,2],[3,3],[4,3],[7,3],[8,3],[4,4],[8,5],[4,6],[5,6],[9,6],[3,7],[5,7],[7,7],[8,7],[3,8],[5,8],[8,8],[10,8],[11,8],[2,9],[7,9],[8,9],[2,10],[3,10],[2,11],[3,11]],
  "R-Pentomino": [[1,0],[2,0],[0,1],[1,1],[1,2]],
  "Diehard": [[6,0],[0,1],[1,1],[1,2],[5,2],[6,2],[7,2]],
  "Acorn": [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]],
  "Infinite Growth": [[6,0],[4,1],[6,1],[7,1],[4,2],[6,2],[4,3],[2,4],[0,5],[2,5]],
  "Switch Engine": [[1,0],[3,0],[0,1],[1,2],[4,2],[3,3],[4,3],[5,3]],
  "Gosper Glider Gun": [[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],[11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],[10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]],
  "Simkin Glider Gun": [[0,0],[1,0],[7,0],[8,0],[0,1],[1,1],[7,1],[8,1],[4,3],[5,3],[4,4],[5,4],[22,9],[23,9],[25,9],[26,9],[21,10],[27,10],[21,11],[28,11],[31,11],[32,11],[21,12],[22,12],[23,12],[27,12],[31,12],[32,12],[26,13],[24,18],[26,18],[27,18],[24,19],[25,19],[27,19]],
  "B-52 Bomber": [[1,0],[2,0],[1,1],[2,1],[20,1],[19,2],[21,2],[34,2],[36,2],[20,3],[33,3],[0,4],[1,4],[9,4],[10,4],[34,4],[37,4],[0,5],[1,5],[3,5],[9,5],[10,5],[34,5],[36,5],[38,5],[3,6],[27,6],[35,6],[38,6],[3,7],[27,7],[28,7],[36,7],[37,7],[0,8],[3,8],[21,8],[22,8],[28,8],[1,9],[2,9],[21,9],[21,10],[22,10],[23,10],[36,11],[37,11],[36,12],[37,12],[1,13],[2,13],[0,14],[3,14],[0,15],[2,15],[4,15],[21,15],[23,15],[28,15],[29,15],[35,15],[36,15],[1,16],[4,16],[22,16],[23,16],[28,16],[29,16],[35,16],[36,16],[38,16],[5,17],[18,17],[22,17],[38,17],[2,18],[4,18],[17,18],[19,18],[38,18],[18,19],[35,19],[38,19],[36,20],[37,20]]
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
        placePreset(PRESETS[pendingPreset], ghostX, ghostY);
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
    const cells = PRESETS[pendingPreset];
    if (!cells) return;
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
    if (p.key === "." || p.key === ">") { if (!running) step(); }
    if (p.key === "Escape") cancelPreset();
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
  const sel = document.getElementById("preset-insert");
  if (sel) sel.selectedIndex = 0;
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
 
      <!-- preset insert -->
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:11px;color:var(--muted);letter-spacing:0.05em">Insert</span>
        <select id="preset-insert" style="appearance:none;border:1px solid var(--panel-edge);background:var(--panel);color:var(--ink);font:inherit;font-size:12px;padding:6px 26px 6px 10px;border-radius:7px;cursor:pointer;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22%3E%3Cpath d=%22M0 0l5 6 5-6z%22 fill=%22%239b9182%22/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 8px center">
          <option value="">— choose —</option>
          ${PRESET_GROUPS.map(g => {
            const opts = g.keys.filter(k => PRESETS[k]).map(k =>
              `<option value="${k}">${k}</option>`).join("");
            return opts ? `<optgroup label="${g.label}">${opts}</optgroup>` : "";
          }).join("")}
        </select>
        <span id="preset-hint" style="font-size:11px;color:var(--muted);letter-spacing:0.04em;min-width:120px"></span>
      </div>
 
      <div style="width:1px;height:20px;background:var(--panel-edge);flex-shrink:0"></div>
 
      <!-- grid ops -->
      <button id="btn-rand-fill" style="flex:none">Random</button>
      <button id="btn-clear"     style="flex:none">Clear</button>
 
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

  document.getElementById("preset-insert").addEventListener("change", function() {
    if (!this.value) { pendingPreset = null; document.getElementById("preset-hint").textContent = ""; return; }
    pendingPreset = this.value;
    document.getElementById("preset-hint").textContent = "Left-click to place · Esc to cancel";
    this.blur();
  });

  updateStatus();
})();
