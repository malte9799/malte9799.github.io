// Nonogram — paint cells to match clues.
// Translucent helper alignment guides, glowing ink cells, sketchy hand-drawn crosses, and particle celebrations.

initGame({
  title: "Nonogram",
  tag: "paint grid · neon guide lines",
  presets: [
    { label: "10×10 (standard)", values: [10, 10] },
    { label: "5×5 (easy)",       values: [5,  5]  },
    { label: "15×15 (hard)",     values: [15, 15] },
  ],
  buttons: [
    { id: "btn-reset", label: "Reset view", onClick: () => resetView() },
    { id: "btn-new",   label: "New puzzle", primary: true, onClick: () => newGame() },
    { id: "btn-hint",  label: "Hint",       onClick: () => confirmHint(hintStep) },
  ],
  sliders: [
    { id: "s-cols", label: "Columns", min: 4, max: 20, step: 1 },
    { id: "s-rows", label: "Rows",    min: 4, max: 20, step: 1 },
  ],
  onPreset: ([c, r]) => { cols = c; rows = r; saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-cols") cols = v; else rows = v; },
  onClamp: clamp,
  getSliderValues: () => ({ "s-cols": cols, "s-rows": rows }),
});

let cols = 10;
let rows = 10;

let solution = []; // [col][row] boolean
let board = [];    // [col][row] 0=empty 1=filled 2=crossed
let cluesC = [];   // column clues
let cluesR = [];   // row clues
let solved = false;
let seed = 0;

// Drag state
let dragFill = null;
let dragAxis = null;
let dragOrigin = null;
let dragLast = null;

// Pan state
let panActive = false;
let panStart = null;
let panOrigin = null;

// View transform
const _view = { x: 0, y: 0, z: 1 };

const CANVAS = 440;
const CLUE_FRAC = 0.28;

// Particle system
let particles = [];

function makeGrid() {
  board = [];
  for (let i = 0; i < cols; i++) {
    board[i] = [];
    for (let j = 0; j < rows; j++) board[i][j] = 0;
  }
}

function buildClues() {
  cluesC = [];
  for (let i = 0; i < cols; i++) {
    cluesC[i] = runs(j => solution[i][j], rows);
  }
  cluesR = [];
  for (let j = 0; j < rows; j++) {
    cluesR[j] = runs(i => solution[i][j], cols);
  }
}

function runs(fn, len) {
  const out = [];
  let cur = 0;
  for (let k = 0; k < len; k++) {
    if (fn(k)) { cur++; }
    else if (cur) { out.push(cur); cur = 0; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [0];
}

function genSolution() {
  randomSeed(seed);
  solution = [];
  for (let i = 0; i < cols; i++) {
    solution[i] = [];
    for (let j = 0; j < rows; j++) solution[i][j] = random() < 0.5;
  }
  for (let i = 0; i < cols; i++) {
    const hasAny = solution[i].some(v => v);
    if (!hasAny) solution[i][floor(random() * rows)] = true;
  }
  for (let j = 0; j < rows; j++) {
    const hasAny = solution.some(col => col[j]);
    if (!hasAny) solution[floor(random() * cols)][j] = true;
  }
}

function checkSolved() {
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if ((board[i][j] === 1) !== solution[i][j]) return false;
  return true;
}

function resetView() {
  _view.x = 0; _view.y = 0; _view.z = 1;
}

function newGame() {
  seed = floor(Math.random() * 1e9);
  genSolution();
  buildClues();
  makeGrid();
  solved = false;
  dragFill = null; dragAxis = null; dragOrigin = null; dragLast = null;
  panActive = false; panStart = null; panOrigin = null;
  resetView();
  resetHintConfirm();
  flashNote("");
  particles = [];
}

function toggleCell(i, j, mode) {
  if (solved) return;
  const current = board[i][j];
  if (mode === 1) { // fill
    board[i][j] = current === 1 ? 0 : 1;
    if (board[i][j] === 1) spawnInkDust(i, j, [230, 225, 210]);
  } else if (mode === 2) { // cross
    board[i][j] = current === 2 ? 0 : 2;
    if (board[i][j] === 2) spawnInkDust(i, j, [80, 72, 64]);
  }
  if (checkSolved()) {
    solved = true;
    spawnVictoryFireworks();
  }
}

function hintStep() {
  if (solved) { flashNote("already solved"); return; }
  const wrong = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const correct = solution[i][j];
      const current = board[i][j] === 1;
      if (current !== correct) wrong.push({ i, j, target: correct ? 1 : 0 });
    }
  }
  if (!wrong.length) return;
  const c = wrong[floor(random() * wrong.length)];
  
  // Set target and spawn sparks
  board[c.i][c.j] = c.target;
  spawnInkDust(c.i, c.j, c.target === 1 ? [127, 176, 105] : [200, 50, 63]);

  if (checkSolved()) {
    solved = true;
    spawnVictoryFireworks();
  }
  flashNote("Hint applied: corrected one tile");
}

function saveState() {
  localStorage.setItem("nonogram_state", JSON.stringify({ cols, rows, seed }));
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem("nonogram_state") || "{}");
    if (typeof d.cols === "number") cols = d.cols;
    if (typeof d.rows === "number") rows = d.rows;
    if (typeof d.seed === "number") seed = d.seed;
  } catch {}
}

function clamp() {
  cols = Math.max(3, Math.min(cols, 20));
  rows = Math.max(3, Math.min(rows, 20));
}

// Particle system helpers
function spawnInkDust(i, j, col) {
  const gx = width * CLUE_FRAC, gy = height * CLUE_FRAC;
  const cw = (width - gx) / cols, ch = (height - gy) / rows;
  const cx = _view.x + (_view.z * (gx + i * cw + cw / 2));
  const cy = _view.y + (_view.z * (gy + j * ch + ch / 2));

  for (let k = 0; k < 8; k++) {
    particles.push({
      x: cx,
      y: cy,
      vx: random(-1, 1),
      vy: random(-1, 1),
      life: random(100, 160),
      size: random(1.5, 3.5),
      col
    });
  }
}

function spawnVictoryFireworks() {
  for (let k = 0; k < 60; k++) {
    particles.push({
      x: random(width),
      y: height + 10,
      vx: random(-1.2, 1.2),
      vy: random(-4, -9),
      life: random(180, 255),
      size: random(2.5, 5),
      col: [127, 176, 105] // green victory
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 5;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}


loadState();
syncSliderUI();

// Helper checkers
function _colCorrect(i) {
  for (let j = 0; j < rows; j++) {
    if ((board[i][j] === 1) !== solution[i][j]) return false;
  }
  return true;
}
function _rowCorrect(j) {
  for (let i = 0; i < cols; i++) {
    if ((board[i][j] === 1) !== solution[i][j]) return false;
  }
  return true;
}

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  document.getElementById("canvas-wrap").addEventListener("contextmenu", e => e.preventDefault());
  newGame();
}

function draw() {
  background(20, 18, 15);

  const gx = width * CLUE_FRAC, gy = height * CLUE_FRAC;
  const cw = (width - gx) / cols, ch = (height - gy) / rows;

  push();
  translate(_view.x, _view.y);
  scale(_view.z);

  // Guidelines helper
  let hoverCol = -1, hoverRow = -1;
  const mx = (mouseX - _view.x) / _view.z;
  const my = (mouseY - _view.y) / _view.z;
  if (!solved && mx >= gx && mx < width && my >= gy && my < height) {
    hoverCol = Math.floor((mx - gx) / cw);
    hoverRow = Math.floor((my - gy) / ch);
  }

  // Draw alignment helper bands
  if (hoverCol >= 0 && hoverRow >= 0) {
    noStroke();
    // Translucent guide bands
    fill(127, 176, 105, 12);
    rect(gx + hoverCol * cw, gy, cw, rows * ch);
    rect(gx, gy + hoverRow * ch, cols * cw, ch);
  }

  // Draw clues
  const fs = min(cw, ch) * 0.58;
  textSize(fs);
  textStyle(BOLD);

  // Column clues stacks
  textAlign(CENTER, BOTTOM);
  for (let i = 0; i < cols; i++) {
    const x = gx + i * cw;
    const clue = cluesC[i];
    const correct = _colCorrect(i);
    const isHovered = i === hoverCol;
    
    let baseColor = correct ? [127, 176, 105] : [155, 145, 130];
    if (isHovered && !correct) baseColor = [243, 237, 224]; // glow text when hovered

    if (correct) {
      fill(127, 176, 105, 18); noStroke();
      rect(x, 0, cw, gy + rows * ch);
    }

    fill(baseColor[0], baseColor[1], baseColor[2]); noStroke();
    for (let k = 0; k < clue.length; k++) {
      const ty = gy - 6 - (clue.length - 1 - k) * ch;
      text(clue[k], x + cw / 2, ty);
    }
  }

  // Row clues stacks
  textAlign(RIGHT, CENTER);
  for (let j = 0; j < rows; j++) {
    const y = gy + j * ch;
    const clue = cluesR[j];
    const correct = _rowCorrect(j);
    const isHovered = j === hoverRow;
    
    let baseColor = correct ? [127, 176, 105] : [155, 145, 130];
    if (isHovered && !correct) baseColor = [243, 237, 224];

    if (correct) {
      fill(127, 176, 105, 18); noStroke();
      rect(0, y, gx + cols * cw, ch);
    }

    fill(baseColor[0], baseColor[1], baseColor[2]); noStroke();
    for (let k = 0; k < clue.length; k++) {
      const tx = gx - 6 - (clue.length - 1 - k) * cw;
      text(clue[k], tx, y + ch / 2);
    }
  }

  textAlign(CENTER, CENTER);

  // Draw Grid cells
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gx + i * cw, y = gy + j * ch;
      const v = board[i][j];

      if (v === 1) {
        // Glowing filled cell
        noStroke();
        fill(230, 225, 210, 45); // glow backdrop
        rect(x - 1, y - 1, cw + 2, ch + 2, 2);
        fill(243, 237, 224);
        rect(x + 1, y + 1, cw - 2, ch - 2, 2);
      } else if (v === 2) {
        // Crossed cell (Sketchy hand-drawn feel)
        fill(38, 35, 32); noStroke(); rect(x, y, cw, ch);
        
        stroke(80, 72, 64); strokeWeight(1.8);
        const pad = cw * 0.22;
        
        // Add tiny hand-drawn wiggles (randomized slightly but seed stable)
        const w1 = sin((i + j) * 12.3) * 0.8;
        const w2 = cos((i + j) * 8.4) * 0.8;

        line(x + pad + w1, y + pad + w2, x + cw - pad - w1, y + ch - pad - w2);
        line(x + cw - pad - w2, y + pad + w1, x + pad + w2, y + ch - pad - w1);
      } else {
        // Empty cell
        fill(38, 35, 32); noStroke(); rect(x, y, cw, ch);
      }
    }
  }

  // Draw Grid lines
  stroke(58, 53, 46); strokeWeight(1);
  for (let i = 0; i <= cols; i++) line(gx + i * cw, gy, gx + i * cw, gy + rows * ch);
  for (let j = 0; j <= rows; j++) line(gx, gy + j * ch, gx + cols * cw, gy + j * ch);

  // Bold every 5th line
  stroke(80, 72, 64); strokeWeight(2.2);
  for (let i = 0; i <= cols; i += 5) line(gx + i * cw, gy, gx + i * cw, gy + rows * ch);
  for (let j = 0; j <= rows; j += 5) line(gx, gy + j * ch, gx + cols * cw, gy + j * ch);

  // Hover frame
  if (hoverCol >= 0 && hoverRow >= 0) {
    const x = gx + hoverCol * cw, y = gy + hoverRow * ch;
    noFill();
    stroke(155, 145, 130, 160);
    strokeWeight(1.5);
    rect(x, y, cw, ch);
  }

  pop();

  // Draw particle system
  updateParticles();
  for (const p of particles) {
    fill(p.col[0], p.col[1], p.col[2], p.life);
    noStroke();
    circle(p.x, p.y, p.size * (p.life / 255));
  }

  // Victory solved overlay
  if (solved) {
    setStatus("solved — Picross solved successfully", "solved");
    fill(20, 18, 15, 180);
    noStroke();
    rect(gx - 10, gy - 10, (width - gx) + 20, (height - gy) + 20, 14);

    fill(127, 176, 105);
    textAlign(CENTER, CENTER);
    textSize(24);
    textStyle(BOLD);
    text("SOLVED", gx + (width - gx) / 2, gy + (height - gy) / 2);
  } else {
    setStatus("left drag = fill · right/ctrl drag = cross", null);
  }
}

// Drag logic coordinates helper
function _getGridPos() {
  const gx = width * CLUE_FRAC, gy = height * CLUE_FRAC;
  const cw = (width - gx) / cols, ch = (height - gy) / rows;
  const mx = (mouseX - _view.x) / _view.z;
  const my = (mouseY - _view.y) / _view.z;
  if (mx < gx || mx >= width || my < gy || my >= height) return null;
  return {
    c: Math.floor((mx - gx) / cw),
    r: Math.floor((my - gy) / ch)
  };
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (keyIsDown(SHIFT) || mouseButton === CENTER) {
    panActive = true;
    panStart = { x: mouseX, y: mouseY };
    panOrigin = { x: _view.x, y: _view.y };
    return;
  }

  const pos = _getGridPos();
  if (!pos) return;

  dragOrigin = pos;
  dragLast = pos;
  dragAxis = null; // lock axis on first move

  // Set toggle mode based on clicked state
  const state = board[pos.c][pos.r];
  if (mouseButton === RIGHT || keyIsDown(CONTROL)) {
    dragFill = state === 2 ? 0 : 2;
  } else {
    dragFill = state === 1 ? 0 : 1;
  }
  toggleCell(pos.c, pos.r, dragFill);
}

function mouseDragged() {
  if (panActive) {
    _view.x = panOrigin.x + (mouseX - panStart.x);
    _view.y = panOrigin.y + (mouseY - panStart.y);
    return;
  }
  if (dragFill === null) return;
  const pos = _getGridPos();
  if (!pos) return;

  if (pos.c === dragLast.c && pos.r === dragLast.r) return;

  // Locks drag along horizontal or vertical axis on first shift
  if (dragAxis === null) {
    const dc = Math.abs(pos.c - dragOrigin.c);
    const dr = Math.abs(pos.r - dragOrigin.r);
    if (dc > 0 || dr > 0) {
      dragAxis = dc >= dr ? "h" : "v";
    }
  }

  if (dragAxis === "h" && pos.r !== dragOrigin.r) return;
  if (dragAxis === "v" && pos.c !== dragOrigin.c) return;

  toggleCell(pos.c, pos.r, dragFill);
  dragLast = pos;
}

function mouseReleased() {
  dragFill = null;
  dragAxis = null;
  panActive = false;
}

function mouseWheel(e) {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  const zoomFactor = e.delta < 0 ? 1.05 : 1 / 1.05;
  const mx = mouseX, my = mouseY;

  // Zoom relative to mouse cursor
  const wx = (mx - _view.x) / _view.z;
  const wy = (my - _view.y) / _view.z;

  _view.z = Math.max(0.7, Math.min(_view.z * zoomFactor, 3.5));
  _view.x = mx - wx * _view.z;
  _view.y = my - wy * _view.z;
  return false;
}
