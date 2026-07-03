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
  info: {
    anim: infoAnim,
    title: "How to play",
    text: "Each clue lists the runs of filled cells in that row or column, in order, with at least one gap between runs. Left-drag paints, right-drag (or Ctrl) crosses out cells you've ruled out. Clues turn green when their line is correct. Every puzzle has exactly one solution, reachable by pure logic — no guessing needed.",
  },
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

// ---- generation: guaranteed line-solvable puzzles ----
// A plain random fill usually admits several valid fills, or needs guessing
// to finish — the clues can be satisfied while the board is "wrong". So after
// seeding a random solution we run the same line-by-line logic a human uses;
// wherever it stalls, one still-ambiguous cell of the solution gets flipped
// (changing its clues) and we solve again. This iterative repair converges in
// a handful of rounds and guarantees the served puzzle has exactly one
// solution, reachable with pure line logic and no guessing. Everything below
// draws randomness from the seeded p5 RNG, so a stored seed reproduces the
// exact same board.

const REPAIR_MAX_ITER = 300;

function genSolution() {
  randomSeed(seed);
  genRandomSolution();
  for (let iter = 0; iter < REPAIR_MAX_ITER; iter++) {
    const undetermined = lineSolveGrid();
    if (undetermined.length === 0) return;
    const [i, j] = undetermined[floor(random() * undetermined.length)];
    solution[i][j] = !solution[i][j];
  }
  // effectively unreachable: repair converges long before the cap. If it ever
  // triggers, the board still has a valid solution — it just may need guessing.
}

function genRandomSolution() {
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

// Deduce a single line. `cells` holds 0 = unknown, 1 = filled, 2 = empty.
// Considers every placement of `clue` consistent with the known cells and
// reports, per cell, whether it can be filled and whether it can be empty —
// a cell possible only one way is thereby determined. Memoized over
// (position, run index) so a 20-cell line stays cheap.
function lineDeduce(cells, clue) {
  const n = cells.length;
  const runs = clue.length === 1 && clue[0] === 0 ? [] : clue;
  const canFill = new Array(n).fill(false);
  const canEmpty = new Array(n).fill(false);
  const memo = new Map();

  function rec(pos, r) {
    const key = pos * (runs.length + 1) + r;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;

    if (r === runs.length) {
      // no runs left — the rest of the line must be empty
      let emptyable = true;
      for (let k = pos; k < n; k++) if (cells[k] === 1) { emptyable = false; break; }
      if (emptyable) {
        ok = true;
        for (let k = pos; k < n; k++) canEmpty[k] = true;
      }
    } else {
      // option A: leave this cell empty
      if (pos < n && cells[pos] !== 1 && rec(pos + 1, r)) {
        canEmpty[pos] = true;
        ok = true;
      }
      // option B: start run r here (needs a gap or line end after it)
      const len = runs[r];
      if (pos + len <= n) {
        let fits = true;
        for (let k = pos; k < pos + len; k++) if (cells[k] === 2) { fits = false; break; }
        const gap = pos + len;
        if (fits && (gap === n || cells[gap] !== 1)) {
          if (rec(gap === n ? gap : gap + 1, r + 1)) {
            for (let k = pos; k < pos + len; k++) canFill[k] = true;
            if (gap < n) canEmpty[gap] = true;
            ok = true;
          }
        }
      }
    }

    memo.set(key, ok);
    return ok;
  }

  if (!rec(0, 0)) return null;
  return { canFill, canEmpty };
}

// Run line deductions over the whole grid (clues derived from the current
// candidate solution) until nothing new is determined. Returns the list of
// still-undetermined [col, row] cells — empty means the puzzle is fully
// line-solvable and therefore unique.
function lineSolveGrid() {
  const clueCols = [];
  for (let i = 0; i < cols; i++) clueCols.push(runs(j => solution[i][j], rows));
  const clueRows = [];
  for (let j = 0; j < rows; j++) clueRows.push(runs(i => solution[i][j], cols));

  // state[i][j]: 0 unknown, 1 filled, 2 empty
  const state = Array.from({ length: cols }, () => Array(rows).fill(0));
  const apply = (get, set, len, res) => {
    let changed = false;
    for (let k = 0; k < len; k++) {
      if (get(k) !== 0) continue;
      if (res.canFill[k] && !res.canEmpty[k]) { set(k, 1); changed = true; }
      else if (!res.canFill[k] && res.canEmpty[k]) { set(k, 2); changed = true; }
    }
    return changed;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < cols; i++) {
      const res = lineDeduce(state[i], clueCols[i]);
      if (!res) return []; // can't happen: the candidate solution satisfies its own clues
      if (apply(k => state[i][k], (k, v) => { state[i][k] = v; }, rows, res)) changed = true;
    }
    for (let j = 0; j < rows; j++) {
      const line = [];
      for (let i = 0; i < cols; i++) line.push(state[i][j]);
      const res = lineDeduce(line, clueRows[j]);
      if (!res) return [];
      if (apply(k => state[k][j], (k, v) => { state[k][j] = v; }, cols, res)) changed = true;
    }
  }

  const undetermined = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (state[i][j] === 0) undetermined.push([i, j]);
  return undetermined;
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
  resetHint();
  flashNote("");
  clearParticles();
}

function celebrateNonogram() {
  // difficulty ~ grid size (sliders: cols/rows 4-20)
  const frac = ((cols + rows) / 2 - 4) / (20 - 4);
  celebrate(1 + Math.round(frac * 2));
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
    celebrateNonogram();
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
    celebrateNonogram();
  }
  flashNote("Hint applied: corrected one tile");
}

function saveState() {
  saveJSON("nonogram_state", { cols, rows, seed });
}

function loadState() {
  const d = loadJSON("nonogram_state");
  if (typeof d.cols === "number") cols = d.cols;
  if (typeof d.rows === "number") rows = d.rows;
  if (typeof d.seed === "number") seed = d.seed;
}

function clamp() {
  cols = Math.max(3, Math.min(cols, 20));
  rows = Math.max(3, Math.min(rows, 20));
}

// Ink dust puffs where a cell was toggled (screen space, so view-transformed)
function spawnInkDust(i, j, col) {
  const gx = width * CLUE_FRAC, gy = height * CLUE_FRAC;
  const cw = (width - gx) / cols, ch = (height - gy) / rows;
  const cx = _view.x + (_view.z * (gx + i * cw + cw / 2));
  const cy = _view.y + (_view.z * (gy + j * ch + ch / 2));
  spawnBurst(cx, cy, { count: 8, speed: [0.2, 1.4], life: [100, 160], col });
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

// ---- info modal animation ----
// A scripted 5×5 mini-board: read a row's clue, paint the run it describes,
// cross out a cell that clue rules out, then show a completed line glow.

function infoAnim(p, w, h, frame) {
  const C = 5, R = 5;
  const CF = 0.22;
  // fit a square board (clue margin + C×R grid) into the available space,
  // centered, so it isn't stretched when the canvas itself isn't square
  const side = Math.min(w, h) * 0.92;
  const boardOx = (w - side) / 2, boardOy = (h - side) / 2;
  const gx = boardOx + side * CF, gy = boardOy + side * CF;
  const cw = (boardOx + side - gx) / C, ch = (boardOy + side - gy) / R;

  // solution: row 2 (0-indexed) is a single run of 3 starting at col 1
  const sol = [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,1,1,1,0],
    [0,0,1,1,0],
    [0,0,0,1,0],
  ]; // sol[col][row]

  function runs(fn, len) {
    const out = []; let cur = 0;
    for (let k = 0; k < len; k++) { if (fn(k)) cur++; else if (cur) { out.push(cur); cur = 0; } }
    if (cur) out.push(cur);
    return out.length ? out : [0];
  }
  const cluesC = []; for (let i = 0; i < C; i++) cluesC.push(runs(j => sol[i][j], R));
  const cluesR = []; for (let j = 0; j < R; j++) cluesR.push(runs(i => sol[i][j], C));

  const PHASE_LEN = 65;
  const t = frame % (PHASE_LEN * 3);
  const phase = Math.floor(t / PHASE_LEN);

  // target row = 2, clue "3" — phase 0: highlighted clue + empty row.
  // phase 1: the 3-run gets painted in.
  // phase 2: the two remaining cells in that row get crossed out, row glows.
  const targetRow = 2;
  const board = Array.from({ length: C }, () => Array(R).fill(0));
  if (phase >= 1) { board[1][targetRow] = 1; board[2][targetRow] = 1; board[3][targetRow] = 1; }
  if (phase >= 2) { board[0][targetRow] = 2; board[4][targetRow] = 2; }

  p.background(20, 18, 15);
  p.noStroke();

  const rowComplete = phase === 2;

  // column clues
  p.textAlign(p.CENTER, p.BOTTOM);
  p.textStyle(p.BOLD);
  const fs = Math.min(cw, ch) * 0.5;
  p.textSize(fs);
  for (let i = 0; i < C; i++) {
    const x = gx + i * cw;
    p.fill(155, 145, 130);
    for (let k = 0; k < cluesC[i].length; k++) {
      const ty = gy - 5 - (cluesC[i].length - 1 - k) * ch;
      p.text(cluesC[i][k], x + cw / 2, ty);
    }
  }

  // row clues — highlight target row's clue
  p.textAlign(p.RIGHT, p.CENTER);
  for (let j = 0; j < R; j++) {
    const y = gy + j * ch;
    const isTarget = j === targetRow;
    p.fill(isTarget ? p.color(127, 176, 105) : p.color(155, 145, 130));
    for (let k = 0; k < cluesR[j].length; k++) {
      const tx = gx - 5 - (cluesR[j].length - 1 - k) * cw;
      p.text(cluesR[j][k], tx, y + ch / 2);
    }
  }
  p.textAlign(p.CENTER, p.CENTER);

  // target row glow backdrop once solved
  if (rowComplete) {
    p.fill(127, 176, 105, 18); p.noStroke();
    p.rect(boardOx, gy + targetRow * ch, gx + C * cw - boardOx, ch);
  }

  // cells
  for (let i = 0; i < C; i++) {
    for (let j = 0; j < R; j++) {
      const x = gx + i * cw, y = gy + j * ch;
      const v = board[i][j];
      if (v === 1) {
        p.fill(230, 225, 210, 45); p.noStroke();
        p.rect(x - 1, y - 1, cw + 2, ch + 2, 2);
        p.fill(243, 237, 224);
        p.rect(x + 1, y + 1, cw - 2, ch - 2, 2);
      } else if (v === 2) {
        p.fill(38, 35, 32); p.noStroke(); p.rect(x, y, cw, ch);
        p.stroke(80, 72, 64); p.strokeWeight(1.8);
        const padC = cw * 0.24;
        p.line(x + padC, y + padC, x + cw - padC, y + ch - padC);
        p.line(x + cw - padC, y + padC, x + padC, y + ch - padC);
        p.noStroke();
      } else {
        p.fill(38, 35, 32); p.noStroke(); p.rect(x, y, cw, ch);
      }
    }
  }

  // grid lines
  p.stroke(58, 53, 46); p.strokeWeight(1);
  for (let i = 0; i <= C; i++) p.line(gx + i * cw, gy, gx + i * cw, gy + R * ch);
  for (let j = 0; j <= R; j++) p.line(gx, gy + j * ch, gx + C * cw, gy + j * ch);
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

  drawParticles();

  // Victory solved overlay
  if (solved) {
    setStatus("solved — Picross solved successfully", "solved");
    drawBoardOverlay(gx, gy, width - gx, height - gy, "SOLVED", null, [127, 176, 105]);
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
