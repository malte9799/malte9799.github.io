// Sudoku — classic 9×9 (3×3 boxes), 6×6 (3×2 boxes), and a 4×4 easy grid (2×2 boxes).
// Click a cell then type a digit (or use the number pad) to fill it in.

initGame({
  title: "Sudoku",
  tag: "fill every row · column · box",
  presets: [
    { label: "9×9 · medium",    values: [9, 3, 3, 50] },
    { label: "9×9 · easy",      values: [9, 3, 3, 40] },
    { label: "9×9 · hard",      values: [9, 3, 3, 81] },
    { label: "6×6 (3×2 boxes)", values: [6, 3, 2, 20] },
    { label: "4×4 (tiny)",      values: [4, 2, 2, 9] },
  ],
  buttons: [
    { id: "btn-new",    label: "New game", primary: true, onClick: () => newGame() },
    { id: "btn-notes",  label: "Notes",                    onClick: () => toggleNotesMode() },
    { id: "btn-undo",   label: "Undo",                     onClick: () => undo() },
    { id: "btn-hint",   label: "Hint",                     onClick: () => confirmHint(giveHint) },
    { id: "btn-errors", label: "Errors",                   onClick: () => toggleShowErrors() },
  ],
  sliders: [],
  onPreset: ([n, bw, bh, rm]) => { N = n; BW = bw; BH = bh; REMOVE = rm; saveState(); newGame(); },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Every row, column and box must contain each digit exactly once. Click a cell (or arrow-key around) and type a digit, or use the number pad. Each puzzle has exactly one solution.",
      "Notes: toggle the Notes button (or Space), or hold Shift while typing, to pencil in candidates. “Errors” highlights clashing digits. Backspace erases.",
    ],
  },
});

let N = 9;    // grid size
let BW = 3;   // box width (columns per box)
let BH = 3;   // box height (rows per box)
let REMOVE = 50; // clues to try removing (capped by uniqueness)
let notesMode = false;
let startMs = 0, endMs = 0;

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

// Counts solutions up to `cap`, using bitmasks per row/column/box and always
// branching on the empty cell with the fewest candidates — fast enough to
// run once per removal attempt even on sparse "hard" boards.
function countSolutions(grid, cap) {
  const rows = new Array(N).fill(0), cols = new Array(N).fill(0), boxes = new Array(N).fill(0);
  const boxOf = (r, c) => Math.floor(r / BH) * (N / BW) + Math.floor(c / BW);
  const empties = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      if (v) { const bit = 1 << v; rows[r] |= bit; cols[c] |= bit; boxes[boxOf(r, c)] |= bit; }
      else empties.push([r, c, boxOf(r, c)]);
    }
  const FULL = ((1 << (N + 1)) - 1) & ~1;
  let count = 0;
  const filled = new Array(empties.length).fill(false);

  function rec(left) {
    if (left === 0) { count++; return; }
    let best = -1, bestMask = 0, bestN = 99;
    for (let k = 0; k < empties.length; k++) {
      if (filled[k]) continue;
      const [r, c, b] = empties[k];
      const mask = FULL & ~(rows[r] | cols[c] | boxes[b]);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestN) { bestN = n; best = k; bestMask = mask; if (n <= 1) break; }
    }
    if (bestN === 0) return;
    const [r, c, b] = empties[best];
    filled[best] = true;
    for (let m = bestMask; m && count < cap; m &= m - 1) {
      const bit = m & -m;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec(left - 1);
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    filled[best] = false;
  }
  rec(empties.length);
  return count;
}

function genPuzzle() {
  solution = makeEmpty();
  fillGrid(solution);

  givens = Array.from({ length: N }, () => Array(N).fill(true));
  board = solution.map(row => [...row]);

  // difficulty: how many cells to try to remove (stops early wherever a
  // removal would break uniqueness)
  const targetRemove = REMOVE;

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
  startMs = millis(); endMs = 0;
  history = [];
  conflictCells = new Set();
  resetHint();
  flashNote("");
  updateStatus();
}

function saveState() {
  saveSettings("sudoku_size", { N, BW, BH, REMOVE });
}
function loadState() {
  const d = loadSettings("sudoku_size");
  if ([4, 6, 9].includes(d.N) && typeof d.BW === "number" && typeof d.BH === "number" && d.BW * d.BH === d.N) {
    N = d.N; BW = d.BW; BH = d.BH;
  }
  if (typeof d.REMOVE === "number") REMOVE = d.REMOVE;
  // show the saved choice in the dropdown
  const sel = document.getElementById("preset-select");
  const key = [N, BW, BH, REMOVE].join(",");
  if (sel) for (let i = 0; i < sel.options.length; i++) if (sel.options[i].value === key) sel.selectedIndex = i;
}

function toggleNotesMode() {
  notesMode = !notesMode;
  setButtonActive("btn-notes", notesMode);
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
    setStatus("solved in " + fmtTime(endMs - startMs), "solved");
  } else if (showErrors && conflictCells.size > 0) {
    setStatus("clashing digits on the board", "dead");
  } else {
    let filled = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] !== 0) filled++;
    setStatus(filled + " / " + (N * N) + " filled · " + fmtTime(millis() - startMs), null);
  }
}

function fmtTime(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}

function setCell(r, c, v) {
  if (solved || givens[r][c]) return;
  // placing a digit clears it from the notes of every peer (undone together)
  const cleared = [];
  if (v) {
    const { br, bc } = boxOrigin(r, c);
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const peer = i === r || j === c || (i >= br && i < br + BH && j >= bc && j < bc + BW);
        if (peer && notes[i][j].has(v)) { notes[i][j].delete(v); cleared.push([i, j]); }
      }
  }
  history.push({ type: "value", r, c, prev: board[r][c], cleared, v });
  board[r][c] = v;
  recomputeConflicts();
  if (!solved && checkSolved()) { solved = true; endMs = millis(); celebrateSudoku(); }
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
  const { r, c, prev, cleared, v } = entry;
  board[r][c] = prev;
  if (cleared) for (const [i, j] of cleared) notes[i][j].add(v);
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
  // prefer fixing a wrong digit, otherwise the selected cell if it's empty
  const wrong = empties.filter(([r, c]) => board[r][c] !== 0);
  const [r, c] = wrong.length ? wrong[0]
    : selR >= 0 && board[selR][selC] === 0 ? [selR, selC]
    : empties[Math.floor(Math.random() * empties.length)];
  selR = r; selC = c;
  setCell(r, c, solution[r][c]);
  flashNote(wrong.length ? "Fixed a wrong digit." : "Filled one cell for you.");
}

// ---- input ----

function typeDigit(v, isNote) {
  if (selR < 0 || solved) return;
  if (v === 0) { eraseSelected(); return; }
  if (v > N) return;
  if (isNote || notesMode) { toggleNote(selR, selC, v); return; }
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
  if (document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return;
  if (digitMatch) {
    typeDigit(parseInt(digitMatch[1], 10), keyIsDown(SHIFT));
    return false;
  }
  if (key === "0" || keyCode === BACKSPACE || keyCode === DELETE) {
    typeDigit(0);
    return false;
  }
  if (key === " ") { toggleNotesMode(); return false; }
  if ((key === "z" || key === "Z") && (keyIsDown(CONTROL) || keyIsDown(91))) { undo(); return false; }
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
    if (selR < 0) { selR = 0; selC = 0; return false; }
    if (keyCode === LEFT_ARROW) { selC = (selC - 1 + N) % N; }
    else if (keyCode === RIGHT_ARROW) { selC = (selC + 1) % N; }
    else if (keyCode === UP_ARROW) { selR = (selR - 1 + N) % N; }
    else if (keyCode === DOWN_ARROW) { selR = (selR + 1) % N; }
    return false;
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

  p.background(...PAL.board);
  p.noStroke();

  // row/column highlight fades in during the scan
  if (scanT > 0) {
    p.fill(...PAL.lilac, 22 * scanT);
    p.rect(ox, oy + targetR * cs, boardW, cs);
    p.rect(ox + targetC * cs, oy, cs, boardW);
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      if (r === targetR && c === targetC && filled) {
        // green flash that settles into a soft tint
        const flash = Math.max(45, 110 - sinceFill * 2);
        p.fill(...PAL.mint, flash);
      } else {
        p.fill(...PAL.well);
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
      p.fill(p.lerpColor(p.color(...PAL.ink), p.color(...PAL.muted), dim));
      p.textSize(cs * 0.5);
      p.text(v, x, y + 1);
    }
  }

  // the answer pops in with an overshoot bounce
  if (filled) {
    const popT = Math.min(1, sinceFill / POP_FRAMES);
    const scale = popT < 0.7 ? p.map(popT, 0, 0.7, 0.2, 1.15) : p.map(popT, 0.7, 1, 1.15, 1);
    p.fill(...PAL.sky);
    p.textSize(cs * 0.5 * scale);
    p.text(3, ox + targetC * cs + cs / 2, oy + targetR * cs + cs / 2 + 1);
  }

  p.stroke(...PAL.line); p.strokeWeight(1);
  for (let i = 0; i <= n; i++) {
    p.line(ox + i * cs, oy, ox + i * cs, oy + boardW);
    p.line(ox, oy + i * cs, ox + boardW, oy + i * cs);
  }
  p.stroke(...PAL.lineHi); p.strokeWeight(2.2);
  for (let i = 0; i <= n; i += bw) p.line(ox + i * cs, oy, ox + i * cs, oy + boardW);
  for (let j = 0; j <= n; j += bh) p.line(ox, oy + j * cs, ox + boardW, oy + j * cs);

  // selection ring: pulses while empty, turns green once solved
  p.noFill();
  if (!filled) {
    const pulse = t < SELECT_END ? 1.0 + 0.06 * p.sin(frame * 0.25) : 1.0;
    p.stroke(...PAL.lilac, 230);
    p.strokeWeight(2.5);
    const grow = (pulse - 1) * cs;
    p.rect(ox + targetC * cs - grow / 2, oy + targetR * cs - grow / 2, cs + grow, cs + grow);
  } else {
    p.stroke(...PAL.mint, 200);
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
  padY = 64;
  const availH = height - padY;
  boardPx = Math.floor(Math.min(width, availH) - 20);
  cellSize = Math.floor(boardPx / N);
  boardPx = cellSize * N;
  ox = Math.floor((width - boardPx) / 2);
  oy = Math.floor((availH - boardPx) / 2) + 4;
}

function draw() {
  background(...PAL.board);
  layout();
  if (!solved && frameCount % 30 === 0) updateStatus(); // tick the timer

  // hovered cell (for subtle feedback)
  let hr = -1, hc = -1;
  if (mouseX >= ox && mouseX < ox + boardPx && mouseY >= oy && mouseY < oy + boardPx) {
    hc = Math.floor((mouseX - ox) / cellSize);
    hr = Math.floor((mouseY - oy) / cellSize);
  }

  noStroke();
  fill(...PAL.well);
  rect(ox, oy, boardPx, boardPx, 10);

  // selection row/col/box highlight
  if (selR >= 0) {
    fill(...PAL.lilac, 16);
    rect(ox, oy + selR * cellSize, boardPx, cellSize);
    rect(ox + selC * cellSize, oy, cellSize, boardPx);
    const { br, bc } = boxOrigin(selR, selC);
    fill(...PAL.lilac, 12);
    rect(ox + bc * cellSize, oy + br * cellSize, cellSize * BW, cellSize * BH);
  }

  // cells
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  const selVal = selR >= 0 ? board[selR][selC] : 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = ox + c * cellSize, y = oy + r * cellSize;
      const v = board[r][c];
      const isGiven = givens[r][c];
      const isSel = r === selR && c === selC;
      const isConflict = showErrors && conflictCells.has(r + "," + c);
      const sameVal = v !== 0 && selVal === v;

      noStroke();
      if (isSel) {
        fill(...PAL.lilac, 70);
        rect(x + 1, y + 1, cellSize - 2, cellSize - 2, 4);
      } else if (isConflict) {
        fill(...PAL.rose, 50);
        rect(x + 1, y + 1, cellSize - 2, cellSize - 2, 4);
      } else if (sameVal) {
        fill(...PAL.lilac, 34);
        rect(x + 1, y + 1, cellSize - 2, cellSize - 2, 4);
      } else if (r === hr && c === hc && !solved) {
        fill(255, 255, 255, 10);
        rect(x + 1, y + 1, cellSize - 2, cellSize - 2, 4);
      }

      if (v !== 0) {
        if (isConflict) fill(...PAL.rose);
        else if (isGiven) fill(...PAL.ink);
        else fill(...PAL.sky);
        textStyle(isGiven ? BOLD : NORMAL);
        textSize(cellSize * (isGiven ? 0.52 : 0.56));
        text(v, x + cellSize / 2, y + cellSize / 2 + 1);
        textStyle(BOLD);
      } else if (notes[r][c].size) {
        drawNotes(x, y, notes[r][c], selVal);
      }
    }
  }

  // grid lines
  stroke(...PAL.line); strokeWeight(1);
  for (let i = 1; i < N; i++) {
    if (i % BW) line(ox + i * cellSize, oy + 4, ox + i * cellSize, oy + boardPx - 4);
    if (i % BH) line(ox + 4, oy + i * cellSize, ox + boardPx - 4, oy + i * cellSize);
  }
  // box borders
  stroke(...PAL.lineHi); strokeWeight(2.5); strokeCap(ROUND);
  for (let i = BW; i < N; i += BW) line(ox + i * cellSize, oy + 2, ox + i * cellSize, oy + boardPx - 2);
  for (let j = BH; j < N; j += BH) line(ox + 2, oy + j * cellSize, ox + boardPx - 2, oy + j * cellSize);
  noFill();
  rect(ox, oy, boardPx, boardPx, 10);

  drawNumberPad();

  if (solved) {
    drawBoardOverlay(ox, oy, boardPx, boardPx, "Solved!", "in " + fmtTime(endMs - startMs), PAL.mint);
  }
}

function drawNotes(x, y, noteSet, highlight) {
  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);
  const subW = cellSize / cols, subH = cellSize / rows;
  noStroke();
  textStyle(NORMAL);
  textSize(Math.min(subW, subH) * 0.62);
  textAlign(CENTER, CENTER);
  for (let v = 1; v <= N; v++) {
    if (!noteSet.has(v)) continue;
    const i = v - 1;
    const col = i % cols, row = Math.floor(i / cols);
    fill(...(v === highlight ? PAL.lilac : PAL.muted));
    text(v, x + col * subW + subW / 2, y + row * subH + subH / 2);
  }
  textStyle(BOLD);
}

// N digit keys plus an erase key
function padRects() {
  const n = N + 1;
  const padW = Math.min(width - 20, n * 46);
  const btnW = padW / n;
  const px = (width - padW) / 2;
  const py = height - padY + 6;
  const btnH = padY - 18;
  const rects = [];
  for (let i = 0; i < n; i++) {
    rects.push({ v: i < N ? i + 1 : 0, x: px + i * btnW + 2, y: py, w: btnW - 4, h: btnH });
  }
  return rects;
}

function drawNumberPad() {
  const rects = padRects();
  const noteMode = notesMode || keyIsDown(SHIFT);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  for (const r of rects) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const hover = mouseX >= r.x && mouseX < r.x + r.w && mouseY >= r.y && mouseY < r.y + r.h;
    noStroke();
    if (r.v === 0) {
      fill(...(hover ? PAL.panelHi : PAL.panel));
      rect(r.x, r.y, r.w, r.h, 10);
      // erase glyph: a little backspace key
      stroke(...PAL.muted); strokeWeight(2); noFill(); strokeJoin(ROUND);
      const k = Math.min(r.w, r.h) * 0.2;
      beginShape();
      vertex(cx - k * 1.6, cy); vertex(cx - k * 0.7, cy - k); vertex(cx + k * 1.4, cy - k);
      vertex(cx + k * 1.4, cy + k); vertex(cx - k * 0.7, cy + k); endShape(CLOSE);
      line(cx - k * 0.1, cy - k * 0.45, cx + k * 0.8, cy + k * 0.45);
      line(cx + k * 0.8, cy - k * 0.45, cx - k * 0.1, cy + k * 0.45);
      continue;
    }
    let count = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (board[i][j] === r.v) count++;
    const complete = count >= N;
    fill(...(complete ? [...PAL.mint, 30] : hover ? PAL.panelHi : PAL.panel));
    rect(r.x, r.y, r.w, r.h, 10);
    fill(...(complete ? PAL.mint : noteMode ? PAL.muted : PAL.ink));
    textStyle(noteMode ? NORMAL : BOLD);
    textSize(r.h * (noteMode ? 0.36 : 0.48));
    text(r.v, cx, cy + 1);
  }
  textStyle(BOLD);
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
  if (selectCellAt(mouseX, mouseY)) return false;

  const rects = padRects();
  for (const r of rects) {
    if (mouseX >= r.x && mouseX < r.x + r.w && mouseY >= r.y && mouseY < r.y + r.h) {
      typeDigit(r.v, keyIsDown(SHIFT));
      return false;
    }
  }
}
