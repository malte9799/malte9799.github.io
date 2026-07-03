// Sudoku — classic 9×9 (3×3 boxes), 6×6 (3×2 boxes), and a 4×4 easy grid (2×2 boxes).
// Click a cell then type a digit (or use the number pad) to fill it in.

initGame({
  title: "Sudoku",
  tag: "fill every row · column · box",
  presets: [
    { label: "9×9 (classic)", values: [9, 3, 3] },
    { label: "6×6 (3×2 boxes)", values: [6, 3, 2] },
    { label: "4×4 (easy)", values: [4, 2, 2] },
  ],
  buttons: [
    { id: "btn-new",    label: "New game",   primary: true, onClick: () => newGame() },
    { id: "btn-erase",  label: "Erase",                      onClick: () => eraseSelected() },
    { id: "btn-undo",   label: "Undo",                       onClick: () => undo() },
    { id: "btn-hint",   label: "Hint",                       onClick: () => confirmHint(giveHint) },
    { id: "btn-errors", label: "Show errors",                onClick: () => toggleShowErrors() },
  ],
  sliders: [],
  onPreset: ([n, bw, bh]) => { N = n; BW = bw; BH = bh; saveState(); newGame(); },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: "Every row, column and box must contain each digit exactly once. Click a cell (or arrow-key around) and type a digit; Shift+digit pencils in a note. Each puzzle has exactly one solution.",
  },
});

let N = 9;    // grid size
let BW = 3;   // box width (columns per box)
let BH = 3;   // box height (rows per box)

let solution = [];   // [r][c] full solution 1..N
let givens = [];      // [r][c] boolean — prefilled clue cells (locked)
let board = [];        // [r][c] current value, 0 = empty
let notes = [];        // [r][c] Set of pencil-mark digits (hidden once cell has a value)
let selR = -1, selC = -1;
let solved = false;
let history = [];       // stack of {r,c,prev}
let conflictCells = new Set(); // "r,c" currently conflicting
let showErrors = false; // whether conflicts are highlighted

const CANVAS = 440;

// ---- RNG (seeded, mulberry32) ----
let _seed = 1;
function seedRng(s) { _seed = s >>> 0; }
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const shuffle = (arr) => shuffleArray(arr, rnd); // seeded, via game.js helper

// ---- generation ----

function boxOrigin(r, c) {
  return { br: Math.floor(r / BH) * BH, bc: Math.floor(c / BW) * BW };
}

function valid(grid, r, c, v) {
  for (let i = 0; i < N; i++) {
    if (grid[r][i] === v) return false;
    if (grid[i][c] === v) return false;
  }
  const { br, bc } = boxOrigin(r, c);
  for (let i = 0; i < BH; i++)
    for (let j = 0; j < BW; j++)
      if (grid[br + i][bc + j] === v) return false;
  return true;
}

function makeEmpty() {
  return Array.from({ length: N }, () => Array(N).fill(0));
}

function fillGrid(grid) {
  // find first empty
  let r = -1, c = -1;
  outer:
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (grid[i][j] === 0) { r = i; c = j; break outer; }
    }
  }
  if (r === -1) return true; // full

  const nums = shuffle(Array.from({ length: N }, (_, k) => k + 1));
  for (const v of nums) {
    if (valid(grid, r, c, v)) {
      grid[r][c] = v;
      if (fillGrid(grid)) return true;
      grid[r][c] = 0;
    }
  }
  return false;
}

function countSolutions(grid, cap) {
  let r = -1, c = -1;
  outer:
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (grid[i][j] === 0) { r = i; c = j; break outer; }
    }
  }
  if (r === -1) return 1;

  let count = 0;
  for (let v = 1; v <= N; v++) {
    if (valid(grid, r, c, v)) {
      grid[r][c] = v;
      count += countSolutions(grid, cap);
      grid[r][c] = 0;
      if (count >= cap) break;
    }
  }
  return count;
}

function genPuzzle() {
  solution = makeEmpty();
  fillGrid(solution);

  givens = Array.from({ length: N }, () => Array(N).fill(true));
  board = solution.map(row => [...row]);

  // difficulty: how many cells to try to remove, cap by grid size
  const targetRemove = N === 9 ? 46 : N === 6 ? 20 : 9;

  // Build removal order row-by-row (each row's cells shuffled), then
  // interleave rows round-robin. This spreads attempts evenly across the
  // whole grid instead of letting a single global shuffle randomly cluster
  // removals into some rows and leave others dense.
  const perRow = [];
  for (let i = 0; i < N; i++) {
    const rowCells = [];
    for (let j = 0; j < N; j++) rowCells.push([i, j]);
    perRow.push(shuffle(rowCells));
  }
  const cells = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (perRow[i][j]) cells.push(perRow[i][j]);
    }
  }

  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= targetRemove) break;
    if (board[r][c] === 0) continue;
    const backup = board[r][c];
    board[r][c] = 0;

    const test = board.map(row => [...row]);
    const solCount = countSolutions(test, 2);
    if (solCount === 1) {
      givens[r][c] = false;
      removed++;
    } else {
      board[r][c] = backup;
    }
  }

  // any cell still equal to solution and not explicitly kept becomes a given
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      givens[i][j] = board[i][j] !== 0;
}

// ---- game state ----

function newGame() {
  seedRng(Math.floor(Math.random() * 1e9));
  genPuzzle();
  notes = Array.from({ length: N }, () => Array.from({ length: N }, () => new Set()));
  selR = -1; selC = -1;
  solved = false;
  history = [];
  conflictCells = new Set();
  resetHint();
  flashNote("");
  updateStatus();
}

function saveState() {
  saveJSON("sudoku_size", { N, BW, BH });
}
function loadState() {
  const d = loadJSON("sudoku_size");
  if (typeof d.N === "number") N = d.N;
  if (typeof d.BW === "number") BW = d.BW;
  if (typeof d.BH === "number") BH = d.BH;
}

function saveShowErrors() {
  try { localStorage.setItem("sudoku_show_errors", JSON.stringify(showErrors)); } catch {}
}
function loadShowErrors() {
  try {
    const v = JSON.parse(localStorage.getItem("sudoku_show_errors"));
    showErrors = typeof v === "boolean" ? v : false;
  } catch { showErrors = false; }
}

function toggleShowErrors() {
  showErrors = !showErrors;
  setButtonActive("btn-errors", showErrors);
  saveShowErrors();
  updateStatus();
}

function recomputeConflicts() {
  conflictCells = new Set();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      // row
      for (let k = 0; k < N; k++) {
        if (k !== c && board[r][k] === v) { conflictCells.add(r + "," + c); conflictCells.add(r + "," + k); }
      }
      // col
      for (let k = 0; k < N; k++) {
        if (k !== r && board[k][c] === v) { conflictCells.add(r + "," + c); conflictCells.add(k + "," + c); }
      }
      // box
      const { br, bc } = boxOrigin(r, c);
      for (let i = 0; i < BH; i++) {
        for (let j = 0; j < BW; j++) {
          const rr = br + i, cc = bc + j;
          if ((rr !== r || cc !== c) && board[rr][cc] === v) {
            conflictCells.add(r + "," + c);
            conflictCells.add(rr + "," + cc);
          }
        }
      }
    }
  }
}

function checkSolved() {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (board[r][c] === 0 || board[r][c] !== solution[r][c]) return false;
  return true;
}

function updateStatus() {
  if (solved) {
    setStatus("solved!", "solved");
  } else if (showErrors && conflictCells.size > 0) {
    setStatus("conflicts on the board", "dead");
  } else {
    let filled = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] !== 0) filled++;
    setStatus(filled + " / " + (N * N) + " filled", null);
  }
}

function setCell(r, c, v) {
  if (solved || givens[r][c]) return;
  history.push({ type: "value", r, c, prev: board[r][c] });
  board[r][c] = v;
  recomputeConflicts();
  if (!solved && checkSolved()) { solved = true; celebrateSudoku(); }
  updateStatus();
}

function celebrateSudoku() {
  // difficulty ~ grid size (presets: 4, 6, 9)
  celebrate(1 + Math.round((N - 4) / (9 - 4) * 2));
}

function eraseSelected() {
  if (selR < 0 || solved) return;
  if (givens[selR][selC]) return;
  if (board[selR][selC] === 0) return;
  setCell(selR, selC, 0);
}

function toggleNote(r, c, v) {
  if (solved || givens[r][c]) return;
  if (board[r][c] !== 0) return; // notes only apply to empty cells
  const had = notes[r][c].has(v);
  history.push({ type: "note", r, c, v, had });
  if (had) notes[r][c].delete(v);
  else notes[r][c].add(v);
}

function undo() {
  if (!history.length) { flashNote("Nothing to undo!"); return; }
  const entry = history.pop();
  if (entry.type === "note") {
    const { r, c, v, had } = entry;
    if (had) notes[r][c].add(v);
    else notes[r][c].delete(v);
    return;
  }
  const { r, c, prev } = entry;
  board[r][c] = prev;
  solved = false;
  recomputeConflicts();
  updateStatus();
}

function giveHint() {
  if (solved) return;
  const empties = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (board[r][c] === 0 || board[r][c] !== solution[r][c]) empties.push([r, c]);
  if (!empties.length) { flashNote("No hint available."); return; }
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  history.push({ type: "value", r, c, prev: board[r][c] });
  board[r][c] = solution[r][c];
  selR = r; selC = c;
  recomputeConflicts();
  if (!solved && checkSolved()) { solved = true; celebrateSudoku(); }
  updateStatus();
  flashNote("Filled one cell for you.");
}

// ---- input ----

function typeDigit(v, isNote) {
  if (selR < 0 || solved) return;
  if (v === 0) { eraseSelected(); return; }
  if (v > N) return;
  if (isNote) { toggleNote(selR, selC, v); return; }
  if (board[selR][selC] === v) { eraseSelected(); return; }
  setCell(selR, selC, v);
}

function keyPressed(e) {
  // Use the physical key (event.code) rather than keyCode/key: on
  // non-US layouts (e.g. QWERTZ) Shift+2/Shift+7 produce '"'/'/' and
  // some browsers report a keyCode/key matching that shifted symbol
  // instead of the digit, so relying on them misses those keys.
  const code = e && e.code;
  const digitMatch = code && code.match(/^(?:Digit|Numpad)([1-9])$/);
  if (digitMatch) {
    typeDigit(parseInt(digitMatch[1], 10), keyIsDown(SHIFT));
    return;
  }
  if (key === "0" || keyCode === BACKSPACE || keyCode === DELETE) {
    typeDigit(0);
    return;
  }
  if (selR >= 0) {
    if (keyCode === LEFT_ARROW) { selC = (selC - 1 + N) % N; }
    else if (keyCode === RIGHT_ARROW) { selC = (selC + 1) % N; }
    else if (keyCode === UP_ARROW) { selR = (selR - 1 + N) % N; }
    else if (keyCode === DOWN_ARROW) { selR = (selR + 1) % N; }
  }
}

// ---- info modal animation ----
// One animated deduction on a 4×4 board: the empty cell gets selected
// (pulsing ring), its row and column highlights sweep in while the digits
// they contain dim — visibly ruling out 1, 2 and 4 — and the remaining
// answer 3 pops into the cell with a bounce and a green flash.

function infoAnim(p, w, h, frame) {
  const n = 4, bw = 2, bh = 2;
  const pad = 14;
  const cs = Math.min((w - pad * 2) / n, (h - pad * 2) / n);
  const boardW = cs * n;
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor((h - boardW) / 2);

  const CYCLE = 220;
  const SELECT_END = 55;   // pulsing selection only
  const SCAN_END = 120;    // row/col highlight + dimming sweep in
  const FILL_AT = 140;     // digit pops in
  const POP_FRAMES = 16;

  const t = frame % CYCLE;
  const targetR = 2, targetC = 3;
  const grid = [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 0], // (2,3) is the empty target cell — answer 3
    [4, 3, 2, 1],
  ];

  const scanT = t <= SELECT_END ? 0 : Math.min(1, (t - SELECT_END) / (SCAN_END - SELECT_END));
  const filled = t >= FILL_AT;
  const sinceFill = t - FILL_AT;

  p.background(20, 18, 15);
  p.noStroke();

  // row/column highlight fades in during the scan
  if (scanT > 0) {
    p.fill(230, 180, 34, 12 * scanT);
    p.rect(ox, oy + targetR * cs, boardW, cs);
    p.rect(ox + targetC * cs, oy, cs, boardW);
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      if (r === targetR && c === targetC && filled) {
        // green flash that settles into a soft tint
        const flash = Math.max(45, 110 - sinceFill * 2);
        p.fill(127, 176, 105, flash);
      } else {
        p.fill(30, 27, 23);
      }
      p.rect(x, y, cs, cs);
    }
  }

  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r][c];
      if (!v) continue;
      const x = ox + c * cs + cs / 2, y = oy + r * cs + cs / 2;
      // digits in the target's row/col shift toward "taken" gold as the scan sweeps
      const inLine = (r === targetR || c === targetC);
      const dim = inLine ? scanT : 0;
      p.fill(p.lerpColor(p.color(243, 237, 224), p.color(230, 190, 100), dim));
      p.textSize(cs * 0.5);
      p.text(v, x, y + 1);
    }
  }

  // the answer pops in with an overshoot bounce
  if (filled) {
    const popT = Math.min(1, sinceFill / POP_FRAMES);
    const scale = popT < 0.7 ? p.map(popT, 0, 0.7, 0.2, 1.15) : p.map(popT, 0.7, 1, 1.15, 1);
    p.fill(150, 190, 230);
    p.textSize(cs * 0.5 * scale);
    p.text(3, ox + targetC * cs + cs / 2, oy + targetR * cs + cs / 2 + 1);
  }

  p.stroke(58, 53, 46); p.strokeWeight(1);
  for (let i = 0; i <= n; i++) {
    p.line(ox + i * cs, oy, ox + i * cs, oy + boardW);
    p.line(ox, oy + i * cs, ox + boardW, oy + i * cs);
  }
  p.stroke(120, 110, 95); p.strokeWeight(2.2);
  for (let i = 0; i <= n; i += bw) p.line(ox + i * cs, oy, ox + i * cs, oy + boardW);
  for (let j = 0; j <= n; j += bh) p.line(ox, oy + j * cs, ox + boardW, oy + j * cs);

  // selection ring: pulses while empty, turns green once solved
  p.noFill();
  if (!filled) {
    const pulse = t < SELECT_END ? 1.0 + 0.06 * p.sin(frame * 0.25) : 1.0;
    p.stroke(230, 180, 34, 200);
    p.strokeWeight(2);
    const grow = (pulse - 1) * cs;
    p.rect(ox + targetC * cs - grow / 2, oy + targetR * cs - grow / 2, cs + grow, cs + grow);
  } else {
    p.stroke(127, 176, 105, 200);
    p.strokeWeight(2);
    p.rect(ox + targetC * cs, oy + targetR * cs, cs, cs);
  }
}

// ---- p5 sketch lifecycle ----

let cellSize = 0, ox = 0, oy = 0, boardPx = 0;
let padY = 0; // number pad area height below board

function setup() {
  loadState();
  loadShowErrors();
  setButtonActive("btn-errors", showErrors);
  const cnv = createCanvas(CANVAS, CANVAS + 64);
  cnv.parent("canvas-wrap");
  newGame();
}

function layout() {
  padY = 60;
  const availW = width;
  const availH = height - padY;
  boardPx = Math.floor(Math.min(availW * 0.94, availH * 0.94));
  cellSize = Math.floor(boardPx / N);
  boardPx = cellSize * N;
  ox = Math.floor((availW - boardPx) / 2);
  oy = Math.floor((availH - boardPx) / 2);
}

function draw() {
  background(20, 18, 15);
  layout();

  // hovered cell (for subtle feedback)
  let hr = -1, hc = -1;
  if (mouseX >= ox && mouseX < ox + boardPx && mouseY >= oy && mouseY < oy + boardPx) {
    hc = Math.floor((mouseX - ox) / cellSize);
    hr = Math.floor((mouseY - oy) / cellSize);
  }

  // selection row/col/box highlight
  if (selR >= 0) {
    noStroke();
    fill(230, 180, 34, 14);
    rect(ox, oy + selR * cellSize, boardPx, cellSize);
    rect(ox + selC * cellSize, oy, cellSize, boardPx);
    const { br, bc } = boxOrigin(selR, selC);
    fill(230, 180, 34, 10);
    rect(ox + bc * cellSize, oy + br * cellSize, cellSize * BW, cellSize * BH);
  }

  // cells
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = ox + c * cellSize, y = oy + r * cellSize;
      const v = board[r][c];
      const isGiven = givens[r][c];
      const isSel = r === selR && c === selC;
      const isConflict = showErrors && conflictCells.has(r + "," + c);
      const sameVal = v !== 0 && selR >= 0 && board[selR][selC] === v;

      if (isSel) {
        fill(230, 180, 34, 55);
        noStroke();
        rect(x, y, cellSize, cellSize);
      } else if (isConflict) {
        fill(200, 50, 63, 40);
        noStroke();
        rect(x, y, cellSize, cellSize);
      } else if (sameVal) {
        fill(243, 237, 224, 18);
        noStroke();
        rect(x, y, cellSize, cellSize);
      } else if (r === hr && c === hc && !solved) {
        fill(243, 237, 224, 8);
        noStroke();
        rect(x, y, cellSize, cellSize);
      }

      if (v !== 0) {
        if (isConflict) fill(230, 110, 120);
        else if (isGiven) fill(243, 237, 224);
        else fill(150, 190, 230);
        noStroke();
        textSize(cellSize * 0.5);
        text(v, x + cellSize / 2, y + cellSize / 2 + 1);
      } else if (notes[r][c].size) {
        drawNotes(x, y, notes[r][c]);
      }
    }
  }

  // grid lines
  stroke(58, 53, 46); strokeWeight(1);
  for (let i = 0; i <= N; i++) {
    line(ox + i * cellSize, oy, ox + i * cellSize, oy + boardPx);
    line(ox, oy + i * cellSize, ox + boardPx, oy + i * cellSize);
  }
  // box borders
  stroke(155, 145, 130); strokeWeight(2.4);
  for (let i = 0; i <= N; i += BW) line(ox + i * cellSize, oy, ox + i * cellSize, oy + boardPx);
  for (let j = 0; j <= N; j += BH) line(ox, oy + j * cellSize, ox + boardPx, oy + j * cellSize);
  noFill();
  stroke(155, 145, 130); strokeWeight(2.4);
  rect(ox, oy, boardPx, boardPx);

  // number pad
  drawNumberPad();

  if (solved) {
    drawBoardOverlay(ox, oy, boardPx, boardPx, "SOLVED", null, [127, 176, 105]);
  }
}

function drawNotes(x, y, noteSet) {
  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);
  const subW = cellSize / cols, subH = cellSize / rows;
  fill(180, 175, 165);
  noStroke();
  textStyle(NORMAL);
  textSize(Math.min(subW, subH) * 0.55);
  textAlign(CENTER, CENTER);
  for (let v = 1; v <= N; v++) {
    if (!noteSet.has(v)) continue;
    const i = v - 1;
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x + col * subW + subW / 2;
    const cy = y + row * subH + subH / 2;
    text(v, cx, cy);
  }
  textStyle(BOLD);
}

function padRects() {
  const n = N;
  const padW = Math.min(width * 0.94, n * 40);
  const btnW = padW / n;
  const px = (width - padW) / 2;
  const py = height - padY + 8;
  const btnH = padY - 20;
  const rects = [];
  for (let i = 0; i < n; i++) {
    rects.push({ v: i + 1, x: px + i * btnW, y: py, w: btnW - 4, h: btnH });
  }
  return rects;
}

function drawNumberPad() {
  const rects = padRects();
  const noteMode = keyIsDown(SHIFT);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  for (const r of rects) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    let count = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (board[i][j] === r.v) count++;
    const complete = count >= N;

    noStroke();
    fill(complete ? color(58, 74, 48) : color(38, 35, 32));
    rect(r.x, r.y, r.w, r.h, 6);
    fill(complete ? color(120, 170, 100) : color(243, 237, 224));
    textSize(r.h * (noteMode ? 0.28 : 0.5));
    text(r.v, cx, cy + 1);
  }
}

function selectCellAt(mx, my) {
  if (mx >= ox && mx < ox + boardPx && my >= oy && my < oy + boardPx) {
    const c = Math.floor((mx - ox) / cellSize);
    const r = Math.floor((my - oy) / cellSize);
    if (r >= 0 && r < N && c >= 0 && c < N) {
      selR = r; selC = c;
      return true;
    }
  }
  return false;
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (selectCellAt(mouseX, mouseY)) return;

  const rects = padRects();
  for (const r of rects) {
    if (mouseX >= r.x && mouseX < r.x + r.w && mouseY >= r.y && mouseY < r.y + r.h) {
      typeDigit(r.v, keyIsDown(SHIFT));
      return;
    }
  }
}

function touchStarted() {
  if (touches && touches.length) {
    mousePressed();
    return false;
  }
}
