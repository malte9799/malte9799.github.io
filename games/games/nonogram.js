// Nonogram — paint cells to match the row and column clues.
// Every generated puzzle is solvable by line logic alone (see genSolution).

initGame({
  title: "Nonogram",
  tag: "paint the hidden picture",
  presets: [
    { label: "10×10 (standard)", values: [10, 10] },
    { label: "5×5 (easy)",       values: [5,  5]  },
    { label: "15×15 (hard)",     values: [15, 15] },
  ],
  buttons: [
    { id: "btn-new",   label: "New puzzle", primary: true, onClick: () => newGame() },
    { id: "btn-cross", label: "Cross mode", onClick: () => { crossMode = !crossMode; setButtonActive("btn-cross", crossMode); } },
    { id: "btn-undo",  label: "Undo",       onClick: () => undo() },
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
    text: [
      "Each clue lists the runs of filled cells in that row or column, in order, with at least one gap between runs. Every puzzle has exactly one solution, reachable by pure logic — no guessing needed.",
      "Left-drag paints, right-drag (or Ctrl, or Cross mode on touch) crosses out cells you've ruled out. Clues turn green when their line is right. Scroll to zoom, Shift-drag to pan, R resets the view. U / Ctrl+Z undo.",
    ],
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

let crossMode = false;
let history = [];  // undo stack: one entry per stroke, [{ i, j, prev }]
let stroke_ = null; // the stroke being painted
let hintCell = null; // { i, j, t } flash on the cell a hint changed
let L = null;       // layout, see computeLayout()

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
  history = [];
  stroke_ = null;
  hintCell = null;
  dragFill = null; dragAxis = null; dragOrigin = null; dragLast = null;
  panActive = false; panStart = null; panOrigin = null;
  L = null;
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

// Sets one cell, recording it in the current stroke for undo.
function setCellState(i, j, v) {
  if (solved || board[i][j] === v) return;
  (stroke_ || (stroke_ = [])).push({ i, j, prev: board[i][j] });
  board[i][j] = v;
  if (v === 1) spawnInkDust(i, j, PAL.lilac);
  if (checkSolved()) {
    solved = true;
    celebrateNonogram();
  }
}

function endStroke() {
  if (stroke_ && stroke_.length) history.push(stroke_);
  stroke_ = null;
}

function undo() {
  endStroke();
  if (!history.length) { flashNote("Nothing to undo."); return; }
  for (const { i, j, prev } of history.pop().reverse()) board[i][j] = prev;
  solved = false;
}

// Hint: first fix a mistake if there is one; otherwise find a cell that line
// logic can deduce from what's on the board and fill or cross it.
function hintStep() {
  if (solved) return;
  endStroke();
  const wrong = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      if (board[i][j] === 1 && !solution[i][j]) wrong.push([i, j, 2]);
      if (board[i][j] === 2 && solution[i][j]) wrong.push([i, j, 1]);
    }
  let pick = null, msg = "";
  if (wrong.length) {
    pick = wrong[floor(random() * wrong.length)];
    msg = "That cell was wrong — fixed it.";
  } else {
    const st = (i, j) => board[i][j];
    outer:
    for (let pass = 0; pass < 2; pass++) {
      const n = pass === 0 ? rows : cols;
      for (let k = 0; k < n; k++) {
        const line = pass === 0 ? Array.from({ length: cols }, (_, i) => st(i, k)) : Array.from({ length: rows }, (_, j) => st(k, j));
        const res = lineDeduce(line, pass === 0 ? cluesR[k] : cluesC[k]);
        if (!res) continue;
        for (let m = 0; m < line.length; m++) {
          if (line[m] !== 0) continue;
          const v = res.canFill[m] && !res.canEmpty[m] ? 1 : !res.canFill[m] && res.canEmpty[m] ? 2 : 0;
          if (v) {
            pick = pass === 0 ? [m, k, v] : [k, m, v];
            msg = "Look at " + (pass === 0 ? "row " + (k + 1) : "column " + (k + 1)) + " — this cell is forced.";
            break outer;
          }
        }
      }
    }
  }
  if (!pick) { flashNote("No hint available."); return; }
  const [i, j, v] = pick;
  setCellState(i, j, v);
  endStroke();
  hintCell = { i, j, t: frameCount };
  flashNote(msg);
}

function saveState() {
  saveSettings("nonogram_state", { cols, rows });
}

function loadState() {
  const d = loadSettings("nonogram_state");
  if (typeof d.cols === "number") cols = d.cols;
  if (typeof d.rows === "number") rows = d.rows;
}

function clamp() {
  cols = Math.max(4, Math.min(cols, 20));
  rows = Math.max(4, Math.min(rows, 20));
}

// Square cells sized so the clue gutters fit: clue numbers sit in slots of
// CLUE_U cells, and the whole thing is centred in the canvas.
const CLUE_U = 0.62;
function computeLayout() {
  const maxR = Math.max(...cluesR.map(c => c.length));
  const maxC = Math.max(...cluesC.map(c => c.length));
  const M = 12;
  const cs = Math.floor(Math.min(
    (width - 2 * M) / (cols + (maxR + 0.4) * CLUE_U),
    (height - 2 * M) / (rows + (maxC + 0.4) * CLUE_U)));
  const totW = cs * (cols + (maxR + 0.4) * CLUE_U), totH = cs * (rows + (maxC + 0.4) * CLUE_U);
  const ox = (width - totW) / 2, oy = (height - totH) / 2;
  L = { cs, gx: Math.round(ox + (maxR + 0.4) * CLUE_U * cs), gy: Math.round(oy + (maxC + 0.4) * CLUE_U * cs), u: cs * CLUE_U };
}

// Ink dust puffs where a cell was toggled (screen space, so view-transformed)
function spawnInkDust(i, j, col) {
  if (!L) return;
  const cx = _view.x + _view.z * (L.gx + i * L.cs + L.cs / 2);
  const cy = _view.y + _view.z * (L.gy + j * L.cs + L.cs / 2);
  spawnBurst(cx, cy, { count: 6, speed: [0.2, 1.2], life: [100, 150], col });
}

loadState();
clamp();
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

// ---- cell drawing (shared by the game and the info demo) ----

// A filled cell's colour: soft ink while playing, a diagonal sun→rose→lilac
// gradient once the picture is solved.
function inkColor(p, i, j, total, done) {
  if (!done) return p.color(...PAL.fillInk);
  const t = total > 0 ? (i + j) / total : 0;
  const a = p.color(...PAL.sun), b = p.color(...PAL.rose), c = p.color(...PAL.lilac);
  return t < 0.5 ? p.lerpColor(a, b, t * 2) : p.lerpColor(b, c, (t - 0.5) * 2);
}

function drawCellAt(p, x, y, cs, v, col) {
  const g = Math.max(1, cs * 0.06), r = Math.min(5, cs * 0.18);
  p.noStroke();
  if (v === 1) {
    p.fill(col);
    p.rect(x + g / 2, y + g / 2, cs - g, cs - g, r);
  } else {
    p.fill(...PAL.panel);
    p.rect(x + g / 2, y + g / 2, cs - g, cs - g, r);
    if (v === 2) {
      p.stroke(...PAL.dim);
      p.strokeWeight(Math.max(1.2, cs * 0.07));
      p.strokeCap(p.ROUND);
      const k = cs * 0.28;
      p.line(x + k, y + k, x + cs - k, y + cs - k);
      p.line(x + cs - k, y + k, x + k, y + cs - k);
      p.noStroke();
    }
  }
}

// ---- info modal animation ----
// A scripted 5×5 board. Row 2's clue "5" fills the whole row; row 3's
// "1 1 1" can only sit one way in five cells, so its gaps get crossed out.
// Then the columns fall into place and the finished picture lights up.

const INFO_SOL = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1],
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 0],
]; // [row][col]

function infoAnim(p, w, h, frame) {
  const n = 5;
  const rowClues = INFO_SOL.map(r => runs(i => r[i], n));
  const colClues = Array.from({ length: n }, (_, c) => runs(j => INFO_SOL[j][c], n));
  const cs = Math.floor(Math.min((w - 40) / (n + 2.2 * CLUE_U * 1.2), (h - 30) / (n + 2.4 * CLUE_U * 1.2)));
  const u = cs * CLUE_U;
  const totW = cs * n + 3.4 * u, totH = cs * n + 3.4 * u;
  const gx = Math.round((w - totW) / 2 + 3.4 * u), gy = Math.round((h - totH) / 2 + 3.4 * u);

  const CYCLE = 300;
  const t = frame % CYCLE;
  // what's on the board at time t: 0 unknown, 1 filled, 2 crossed
  const st = Array.from({ length: n }, () => Array(n).fill(0));
  let focusRow = -1;
  if (t >= 20) { // row 1: "5"
    focusRow = t < 90 ? 1 : focusRow;
    const k = Math.min(n, Math.floor((t - 20) / 8));
    for (let c = 0; c < k; c++) st[1][c] = 1;
  }
  if (t >= 90) { // row 2: "1 1 1"
    focusRow = t < 160 ? 2 : focusRow;
    const k = Math.min(n, Math.floor((t - 90) / 8));
    for (let c = 0; c < k; c++) st[2][c] = INFO_SOL[2][c] ? 1 : 2;
  }
  if (t >= 160) { // the rest of the picture
    const k = Math.min(n * n, Math.floor((t - 160) / 3));
    for (let idx = 0; idx < k; idx++) {
      const r = [0, 3, 4][Math.floor(idx / n) % 3], c = idx % n;
      if (idx < 3 * n) st[r][c] = INFO_SOL[r][c] ? 1 : 2;
    }
  }
  const done = t >= 210;

  p.background(...PAL.board);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(u * 0.9);

  if (focusRow >= 0) {
    p.noStroke();
    p.fill(...PAL.lilac, 30);
    p.rect(gx - 3.2 * u, gy + focusRow * cs, 3.2 * u + n * cs, cs, 6);
  }
  for (let r = 0; r < n; r++) {
    const ok = st[r].every((v, c) => (v === 1) === !!INFO_SOL[r][c]);
    p.fill(...(ok ? PAL.mint : r === focusRow ? PAL.ink : PAL.muted));
    rowClues[r].forEach((v, k) => p.text(v, gx - 0.6 * u - (rowClues[r].length - 1 - k) * u, gy + r * cs + cs / 2));
  }
  for (let c = 0; c < n; c++) {
    const ok = st.every((row, r) => (row[c] === 1) === !!INFO_SOL[r][c]);
    p.fill(...(ok ? PAL.mint : PAL.muted));
    colClues[c].forEach((v, k) => p.text(v, gx + c * cs + cs / 2, gy - 0.6 * u - (colClues[c].length - 1 - k) * u));
  }
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      drawCellAt(p, gx + c * cs, gy + r * cs, cs, st[r][c], inkColor(p, c, r, 2 * (n - 1), done));
}

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  document.getElementById("canvas-wrap").addEventListener("contextmenu", e => e.preventDefault());
  newGame();
}

function draw() {
  background(...PAL.board);
  if (!L) computeLayout();
  const { cs, gx, gy, u } = L;
  const bw = cols * cs, bh = rows * cs;

  push();
  translate(_view.x, _view.y);
  scale(_view.z);

  let hoverCol = -1, hoverRow = -1;
  const pos = _getGridPos();
  if (!solved && pos) { hoverCol = pos.c; hoverRow = pos.r; }

  // guide bands through the hovered cell, under everything else
  noStroke();
  if (hoverCol >= 0) {
    fill(...PAL.lilac, 22);
    rect(gx + hoverCol * cs, 4, cs, gy - 4 + bh, 6);
    rect(4, gy + hoverRow * cs, gx - 4 + bw, cs, 6);
  }

  // clues
  textSize(Math.max(9, u * 0.88));
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < cols; i++) {
    const correct = _colCorrect(i);
    const clue = cluesC[i];
    fill(...(correct ? PAL.mint : i === hoverCol ? PAL.ink : PAL.muted));
    for (let k = 0; k < clue.length; k++)
      text(clue[k], gx + i * cs + cs / 2, gy - 0.65 * u - (clue.length - 1 - k) * u);
  }
  for (let j = 0; j < rows; j++) {
    const correct = _rowCorrect(j);
    const clue = cluesR[j];
    fill(...(correct ? PAL.mint : j === hoverRow ? PAL.ink : PAL.muted));
    for (let k = 0; k < clue.length; k++)
      text(clue[k], gx - 0.7 * u - (clue.length - 1 - k) * u, gy + j * cs + cs / 2);
  }

  // cells
  fill(...PAL.well);
  rect(gx - 4, gy - 4, bw + 8, bh + 8, 8);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      drawCellAt(window, gx + i * cs, gy + j * cs, cs, board[i][j], inkColor(window, i, j, cols + rows - 2, solved));

  // every 5th line, for counting
  stroke(...PAL.lineHi); strokeWeight(1.5);
  for (let i = 5; i < cols; i += 5) line(gx + i * cs, gy - 2, gx + i * cs, gy + bh + 2);
  for (let j = 5; j < rows; j += 5) line(gx - 2, gy + j * cs, gx + bw + 2, gy + j * cs);

  // hovered cell + hint flash
  if (hoverCol >= 0) {
    noFill(); stroke(...PAL.lilac, 220); strokeWeight(2);
    rect(gx + hoverCol * cs + 1, gy + hoverRow * cs + 1, cs - 2, cs - 2, Math.min(5, cs * 0.18));
  }
  if (hintCell && frameCount - hintCell.t < 90) {
    const k = 1 - (frameCount - hintCell.t) / 90;
    noFill(); stroke(...PAL.mint, 255 * k); strokeWeight(3);
    const grow = (1 - k) * 6;
    rect(gx + hintCell.i * cs - grow, gy + hintCell.j * cs - grow, cs + grow * 2, cs + grow * 2, 6);
  }

  pop();

  drawParticles();
  cursor(hoverCol >= 0 ? (crossMode ? CROSS : HAND) : ARROW);

  if (solved) {
    setStatus("solved — nice picture!", "solved");
  } else {
    let done = 0;
    for (let i = 0; i < cols; i++) if (_colCorrect(i)) done++;
    for (let j = 0; j < rows; j++) if (_rowCorrect(j)) done++;
    setStatus(done + " / " + (cols + rows) + " lines right" + (crossMode ? " · cross mode" : ""), null);
  }
}

// Board cell under the mouse (in view-transformed space), or null
function _getGridPos() {
  if (!L) return null;
  const mx = (mouseX - _view.x) / _view.z;
  const my = (mouseY - _view.y) / _view.z;
  const c = Math.floor((mx - L.gx) / L.cs), r = Math.floor((my - L.gy) / L.cs);
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return null;
  return c >= 0 && c < cols && r >= 0 && r < rows ? { c, r } : null;
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (keyIsDown(SHIFT) || mouseButton === CENTER) {
    panActive = true;
    panStart = { x: mouseX, y: mouseY };
    panOrigin = { x: _view.x, y: _view.y };
    return false;
  }

  const pos = _getGridPos();
  if (!pos || solved) return;

  dragOrigin = pos;
  dragLast = pos;
  dragAxis = null; // lock axis on first move

  // the first cell decides what the whole stroke paints
  const state = board[pos.c][pos.r];
  if (mouseButton === RIGHT || keyIsDown(CONTROL) || crossMode) dragFill = state === 2 ? 0 : 2;
  else dragFill = state === 1 ? 0 : 1;
  stroke_ = [];
  setCellState(pos.c, pos.r, dragFill);
  return false;
}

function mouseDragged() {
  if (panActive) {
    _view.x = panOrigin.x + (mouseX - panStart.x);
    _view.y = panOrigin.y + (mouseY - panStart.y);
    return false;
  }
  if (dragFill === null) return;
  const pos = _getGridPos();
  if (!pos) return false;
  if (pos.c === dragLast.c && pos.r === dragLast.r) return false;

  // lock the stroke to the row or column it started moving along
  if (dragAxis === null) {
    const dc = Math.abs(pos.c - dragOrigin.c);
    const dr = Math.abs(pos.r - dragOrigin.r);
    if (dc > 0 || dr > 0) dragAxis = dc >= dr ? "h" : "v";
  }
  const c = dragAxis === "v" ? dragOrigin.c : pos.c;
  const r = dragAxis === "h" ? dragOrigin.r : pos.r;

  // fill every cell between the last one and this one, so fast drags don't skip
  const from = dragAxis === "h" ? dragLast.c : dragLast.r, to = dragAxis === "h" ? c : r;
  for (let k = Math.min(from, to); k <= Math.max(from, to); k++) {
    const ci = dragAxis === "h" ? k : c, ri = dragAxis === "h" ? r : k;
    // painting never overwrites a cross, and crossing never erases paint
    const cur = board[ci][ri];
    if (dragFill === 0 || cur === 0) setCellState(ci, ri, dragFill);
  }
  dragLast = { c, r };
  return false;
}

function mouseReleased() {
  endStroke();
  dragFill = null;
  dragAxis = null;
  panActive = false;
}

function keyPressed() {
  if (key === "n" || key === "N") { newGame(); return false; }
  if (key === "r" || key === "R") { resetView(); return false; }
  if (key === "x" || key === "X") { crossMode = !crossMode; setButtonActive("btn-cross", crossMode); return false; }
  if (key === "u" || key === "U" || ((key === "z" || key === "Z") && (keyIsDown(CONTROL) || keyIsDown(91)))) { undo(); return false; }
}

function mouseWheel(e) {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  const zoomFactor = e.delta < 0 ? 1.08 : 1 / 1.08;
  const mx = mouseX, my = mouseY;

  // Zoom relative to mouse cursor
  const wx = (mx - _view.x) / _view.z;
  const wy = (my - _view.y) / _view.z;

  _view.z = Math.max(1, Math.min(_view.z * zoomFactor, 3.5));
  if (_view.z === 1) { resetView(); return false; }
  _view.x = mx - wx * _view.z;
  _view.y = my - wy * _view.z;
  return false;
}
