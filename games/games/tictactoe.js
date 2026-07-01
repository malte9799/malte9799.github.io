// Tic Tac Toe — local 2-player, with an optional Ultimate (Super) mode.
// Normal mode is just a single 3x3 board. Super mode nests nine of them: the
// cell you play in a small board sends your opponent to the matching big-board
// cell next turn — unless that target is already decided/full, in which case
// they may play anywhere still open.

initGame({
  title: "Tic Tac Toe",
  tag: "Tic² Tac² Toe²",
  presets: [
    { label: "Normal", values: [0] },
    { label: "Super",  values: [1] },
  ],
  buttons: [
    { id: "btn-new", label: "New game", primary: true, onClick: () => newGame() },
  ],
  sliders: [],
  onPreset: ([m]) => { superMode = m === 1; saveState(); newGame(); },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: { anim: infoAnim },
});

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const X = 1, O = 2;
const MARK_COLOR = { [X]: [127, 176, 105], [O]: [90, 160, 210] };
const MARK_GLOW   = { [X]: [190, 240, 150], [O]: [150, 210, 255] };

let superMode = false;

// cells[b][i] = 0 empty, X or O — small-board b (0-8), position i (0-8).
// In Normal mode only cells[0] is used.
let cells = [];
// cellWinner[b] = 0 open, X, O, or 3 = drawn/full.
let cellWinner = [];
let activeCell = null; // which small board the current player must play in, or null = any open board
let turn = X;
let winner = 0; // 0 in progress, X, O, 3 = draw
let winLine = null; // big-board winning line of cell indices, for the overlay
let lastMove = null; // { b, i, frame } for a brief pop-in landing animation
const LAND_FRAMES = 10;

let particles = [];

function emptyBoards() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function newGame() {
  cells = emptyBoards();
  cellWinner = Array(9).fill(0);
  activeCell = null;
  turn = X;
  winner = 0;
  winLine = null;
  lastMove = null;
  particles = [];
  updateStatus();
}

function checkLines(board, mark) {
  return LINES.some(line => line.every(i => board[i] === mark));
}

function boardFull(board) {
  return board.every(v => v !== 0);
}

// Re-derive whether small board b is now won/drawn after a move.
function updateCellWinner(b) {
  const board = cells[b];
  if (checkLines(board, X)) cellWinner[b] = X;
  else if (checkLines(board, O)) cellWinner[b] = O;
  else if (boardFull(board)) cellWinner[b] = 3;
  else cellWinner[b] = 0;
}

function cellIsOpen(b) {
  return cellWinner[b] === 0;
}

function isBoardLocked(b) {
  return !superMode ? false : !cellIsOpen(b);
}

// Which small board must (or may) the current player play in?
// Returns a board index, or null meaning any open board is legal.
function legalBoard() {
  if (!superMode) return 0;
  if (activeCell === null || isBoardLocked(activeCell)) return null;
  return activeCell;
}

function canPlay(b, i) {
  if (winner) return false;
  if (cells[b][i] !== 0) return false;
  if (isBoardLocked(b)) return false;
  const required = legalBoard();
  if (required !== null && required !== b) return false;
  return true;
}

function playMove(b, i) {
  if (!canPlay(b, i)) return;

  cells[b][i] = turn;
  lastMove = { b, i, frame: frameCount };
  spawnMoveSparks(b, i, turn);
  updateCellWinner(b);

  if (superMode) {
    // Route the opponent to the small board matching this move's position,
    // unless that board is already decided — then they may play anywhere.
    activeCell = cellIsOpen(i) ? i : null;
  }

  // Check the big board (made of cellWinner values in Super mode, or the
  // single board's own marks in Normal mode) for a win/draw.
  const bigBoard = superMode ? cellWinner : cells[0];
  if (checkLines(bigBoard, turn)) {
    winner = turn;
    winLine = LINES.find(line => line.every(idx => bigBoard[idx] === turn));
  } else if (bigBoard.every(v => v !== 0)) {
    winner = 3;
  } else {
    turn = turn === X ? O : X;
  }

  updateStatus();
}

function updateStatus() {
  if (winner === X || winner === O) {
    setStatus((winner === X ? "X" : "O") + " wins!", "solved");
  } else if (winner === 3) {
    setStatus("draw", null);
  } else {
    const who = turn === X ? "X" : "O";
    if (superMode) {
      const where = activeCell === null || isBoardLocked(activeCell)
        ? "any open board"
        : "the highlighted board";
      setStatus(who + "'s turn · play in " + where, null);
    } else {
      setStatus(who + "'s turn", null);
    }
  }
  updateWrapBorder();
}

// Tints the canvas-wrap border with the current player's color so whose
// turn it is is readable at a glance, without restyling the shared element
// used by every other game.
function updateWrapBorder() {
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;
  if (winner === X || winner === O) {
    wrap.style.borderColor = `rgb(${MARK_GLOW[winner].join(",")})`;
  } else if (winner === 3) {
    wrap.style.borderColor = "";
  } else {
    wrap.style.borderColor = `rgb(${MARK_COLOR[turn].join(",")})`;
  }
}

// ---- particles ----

function spawnMoveSparks(b, i, mark) {
  const { cx, cy } = cellCenter(b, i);
  const col = MARK_GLOW[mark];
  for (let k = 0; k < 10; k++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.2 + 0.6;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 200,
      size: Math.random() * 3 + 1.5,
      col,
    });
  }
}

function updateParticles() {
  for (let k = particles.length - 1; k >= 0; k--) {
    const p = particles[k];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= 9;
    if (p.life <= 0) particles.splice(k, 1);
  }
}

// ---- layout / geometry ----
// Normal mode: one 3x3 board fills the canvas.
// Super mode: a 3x3 grid of 3x3 boards, with gaps between the big cells.
// A header band above the board carries the big "X's turn" / "O's turn" indicator.

let BOARD = 0, PAD = 0, PAD_TOP = 0, BIG_GAP = 0, BIG_CELL = 0, SMALL_CELL = 0;
const HEADER_H_FRAC = 0.14;

function computeLayout() {
  const headerH = height * HEADER_H_FRAC;
  BOARD = Math.min(width * 0.86, (height - headerH) * 0.94);
  PAD = (width - BOARD) / 2;
  PAD_TOP = headerH + (height - headerH - BOARD) / 2;
  if (superMode) {
    BIG_GAP = BOARD * 0.035;
    BIG_CELL = (BOARD - BIG_GAP * 2) / 3;
    SMALL_CELL = BIG_CELL / 3;
  } else {
    BIG_GAP = 0;
    BIG_CELL = BOARD;
    SMALL_CELL = BOARD / 3;
  }
}

function bigCellOrigin(b) {
  const br = Math.floor(b / 3), bc = b % 3;
  return {
    x: PAD + bc * (BIG_CELL + BIG_GAP),
    y: PAD + br * (BIG_CELL + BIG_GAP),
  };
}

function cellCenter(b, i) {
  const { x, y } = bigCellOrigin(b);
  const r = Math.floor(i / 3), c = i % 3;
  return {
    cx: x + c * SMALL_CELL + SMALL_CELL / 2,
    cy: y + r * SMALL_CELL + SMALL_CELL / 2,
  };
}

// ---- p5 lifecycle ----

const CANVAS = 440;

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  loadState();
  syncPresetFromState();
  newGame();
}

function syncPresetFromState() {
  const sel = document.getElementById("preset-select");
  if (sel) sel.selectedIndex = superMode ? 1 : 0;
}

function drawMark(cx, cy, s, mark, alpha, scale) {
  const a = alpha ?? 255;
  const sc = scale ?? 1;
  const [r, g, b] = MARK_COLOR[mark];
  noFill();
  stroke(r, g, b, a);
  if (mark === X) {
    strokeWeight(Math.max(2, s * 0.12 * sc));
    strokeCap(ROUND);
    const k = s * 0.32 * sc;
    line(cx - k, cy - k, cx + k, cy + k);
    line(cx + k, cy - k, cx - k, cy + k);
  } else {
    strokeWeight(Math.max(2, s * 0.1 * sc));
    circle(cx, cy, s * 0.62 * sc);
  }
}

function draw() {
  background(20, 18, 15);
  computeLayout();

  // In Normal mode there's only ever one board (b=0); Super mode has all nine.
  const boardCount = superMode ? 9 : 1;

  // Highlight the legal board(s) before drawing grid lines, so it sits underneath.
  if (!winner && superMode) {
    const required = legalBoard();
    for (let b = 0; b < boardCount; b++) {
      const isLegal = required === null ? cellIsOpen(b) : b === required;
      if (!isLegal) continue;
      const { x, y } = bigCellOrigin(b);
      noStroke();
      fill(230, 180, 34, 22);
      rect(x, y, BIG_CELL, BIG_CELL, BIG_CELL * 0.06);
    }
  }

  // Small grid lines + marks for each big cell.
  for (let b = 0; b < boardCount; b++) {
    const { x, y } = bigCellOrigin(b);

    // Decided sub-board backdrop tint
    if (superMode && cellWinner[b]) {
      noStroke();
      if (cellWinner[b] === 3) fill(58, 53, 46, 90);
      else fill(...MARK_COLOR[cellWinner[b]], 26);
      rect(x, y, BIG_CELL, BIG_CELL, BIG_CELL * 0.06);
    }

    stroke(58, 53, 46);
    strokeWeight(Math.max(1, SMALL_CELL * 0.02));
    for (let g = 1; g < 3; g++) {
      line(x + g * SMALL_CELL, y, x + g * SMALL_CELL, y + BIG_CELL);
      line(x, y + g * SMALL_CELL, x + BIG_CELL, y + g * SMALL_CELL);
    }

    for (let i = 0; i < 9; i++) {
      const v = cells[b][i];
      if (!v) continue;
      const { cx, cy } = cellCenter(b, i);
      let scale = 1;
      if (lastMove && lastMove.b === b && lastMove.i === i) {
        const t = Math.min(1, (frameCount - lastMove.frame) / LAND_FRAMES);
        scale = 0.5 + 0.5 * (1 - Math.pow(1 - t, 3)); // ease-out pop from 50% to 100%
      }
      drawMark(cx, cy, SMALL_CELL, v, 255, scale);
    }

    // Big winner overlay glyph, drawn oversized across the whole sub-board.
    if (superMode && (cellWinner[b] === X || cellWinner[b] === O)) {
      drawMark(x + BIG_CELL / 2, y + BIG_CELL / 2, BIG_CELL * 0.92, cellWinner[b], 70);
    }
  }

  // Bold separators between the 3 big cells.
  if (superMode) {
    stroke(120, 110, 95);
    strokeWeight(Math.max(2, BOARD * 0.012));
    for (let g = 1; g < 3; g++) {
      const off = PAD + g * BIG_CELL + (g - 0.5) * BIG_GAP;
      line(off, PAD - BIG_GAP * 0.3, off, PAD + BOARD + BIG_GAP * 0.3);
      line(PAD - BIG_GAP * 0.3, off, PAD + BOARD + BIG_GAP * 0.3, off);
    }
  }

  // Hover feedback for the cell under the cursor.
  if (!winner) {
    const hit = hitTest(mouseX, mouseY);
    if (hit && canPlay(hit.b, hit.i)) {
      const { cx, cy } = cellCenter(hit.b, hit.i);
      noFill();
      stroke(155, 145, 130, 110);
      strokeWeight(1.5);
      rect(cx - SMALL_CELL * 0.4, cy - SMALL_CELL * 0.4, SMALL_CELL * 0.8, SMALL_CELL * 0.8, 4);
    }
  }

  // Winning line through the big board.
  if (winLine) {
    const from = superMode ? bigCellCenter(winLine[0]) : cellCenter(0, winLine[0]);
    const to = superMode ? bigCellCenter(winLine[2]) : cellCenter(0, winLine[2]);
    stroke(...MARK_GLOW[winner], 230);
    strokeWeight(Math.max(3, BOARD * 0.018));
    strokeCap(ROUND);
    line(from.cx, from.cy, to.cx, to.cy);
  }

  updateParticles();
  noStroke();
  for (const p of particles) {
    fill(p.col[0], p.col[1], p.col[2], p.life);
    circle(p.x, p.y, p.size * (p.life / 255));
  }

  if (winner) {
    fill(20, 18, 15, 190);
    noStroke();
    rect(0, 0, width, height);
    fill(winner === 3 ? 155 : MARK_GLOW[winner][0], winner === 3 ? 145 : MARK_GLOW[winner][1], winner === 3 ? 130 : MARK_GLOW[winner][2]);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(28);
    text(winner === 3 ? "DRAW" : (winner === X ? "X WINS" : "O WINS"), width / 2, height / 2 - 14);
    fill(155, 145, 130);
    textSize(13);
    textStyle(NORMAL);
    text("press N or New game to play again", width / 2, height / 2 + 18);
  }
}

function bigCellCenter(b) {
  const { x, y } = bigCellOrigin(b);
  return { cx: x + BIG_CELL / 2, cy: y + BIG_CELL / 2 };
}

function hitTest(mx, my) {
  if (mx < PAD || mx >= PAD + BOARD || my < PAD || my >= PAD + BOARD) return null;
  const boardCount = superMode ? 9 : 1;
  for (let b = 0; b < boardCount; b++) {
    const { x, y } = bigCellOrigin(b);
    if (mx < x || mx >= x + BIG_CELL || my < y || my >= y + BIG_CELL) continue;
    const c = Math.floor((mx - x) / SMALL_CELL);
    const r = Math.floor((my - y) / SMALL_CELL);
    if (r < 0 || r > 2 || c < 0 || c > 2) return null;
    return { b, i: r * 3 + c };
  }
  return null;
}

function mousePressed() {
  const hit = hitTest(mouseX, mouseY);
  if (hit) playMove(hit.b, hit.i);
}

function keyPressed() {
  if (key === "n" || key === "N") newGame();
}

// ---- state persistence ----

function saveState() {
  try { localStorage.setItem("tictactoe_state", JSON.stringify({ superMode })); } catch {}
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem("tictactoe_state") || "{}");
    if (typeof d.superMode === "boolean") superMode = d.superMode;
  } catch {}
}

// ---- info modal animation ----

function infoAnim(p, w, h, frame) {
  const pad = 10;
  const board = Math.min(w, h) - pad * 2;
  const gap = board * 0.04;
  const big = (board - gap * 2) / 3;
  const small = big / 3;
  const ox = Math.floor((w - board) / 2);
  const oy = Math.floor((h - board) / 2);

  const PHASE_LEN = 70;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);

  p.background(20, 18, 15);

  function bigOrigin(b) {
    const br = Math.floor(b / 3), bc = b % 3;
    return { x: ox + bc * (big + gap), y: oy + br * (big + gap) };
  }

  // demo: X plays bottom-right cell of the center board (position 8),
  // routing O into the bottom-right board (board index 8) next.
  const moveBoard = 4, moveCell = 8, routedBoard = 8;

  for (let b = 0; b < 9; b++) {
    const { x, y } = bigOrigin(b);
    if (phase === 1 && b === routedBoard) {
      p.noStroke();
      p.fill(230, 180, 34, 30);
      p.rect(x, y, big, big, big * 0.06);
    }
    p.stroke(58, 53, 46);
    p.strokeWeight(1);
    for (let g = 1; g < 3; g++) {
      p.line(x + g * small, y, x + g * small, y + big);
      p.line(x, y + g * small, x + big, y + g * small);
    }
    if (b === moveBoard) {
      const r = Math.floor(moveCell / 3), c = moveCell % 3;
      const cx = x + c * small + small / 2;
      const cy = y + r * small + small / 2;
      p.noFill();
      p.stroke(127, 176, 105);
      p.strokeWeight(Math.max(2, small * 0.14));
      const k = small * 0.28;
      p.line(cx - k, cy - k, cx + k, cy + k);
      p.line(cx + k, cy - k, cx - k, cy + k);
    }
  }

  p.stroke(120, 110, 95);
  p.strokeWeight(2);
  for (let g = 1; g < 3; g++) {
    const off1 = ox + g * big + (g - 0.5) * gap;
    p.line(off1, oy, off1, oy + board);
    p.line(ox, off1, ox + board, off1);
  }

  const caption = phase === 0
    ? "Playing in a cell's bottom-right square..."
    : "...sends your opponent to the bottom-right board next.";

  return { caption };
}
