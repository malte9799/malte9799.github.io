// Flood It — flood the board from the top-left corner, one color at a time.
// Pick a color; every connected same-color region touching your territory
// joins it. Cover the whole board before you run out of moves.

initGame({
  title: "Flood It",
  tag: "flood the board · one color at a time",
  presets: [
    { label: "14×14 · 6 colors (standard)", values: [14, 6] },
    { label: "10×10 · 4 colors (easy)",     values: [10, 4] },
    { label: "18×18 · 8 colors (hard)",     values: [18, 8] },
  ],
  buttons: [
    { id: "btn-new",  label: "New board", primary: true, onClick: () => newGame() },
    { id: "btn-undo", label: "Undo",                     onClick: () => undo() },
  ],
  sliders: [
    { id: "s-size",   label: "Grid size", min: 6,  max: 24, step: 1 },
    { id: "s-colors", label: "Colors",    min: 3,  max: 8,  step: 1 },
  ],
  onPreset: ([n, k]) => { SIZE = n; NCOLORS = k; saveBest(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; else NCOLORS = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE, "s-colors": NCOLORS }),
  info: { anim: infoAnim },
});

let SIZE = 14;
let NCOLORS = 6;
let grid = [];
let moves = 0;
let moveLimit = 0;
let gameOver = false;
let won = false;
let prevGrid = null;
let prevMoves = null;

// ripple animation: cells flip to their new color in waves spreading from
// the top-left origin, instead of all at once
let ripple = null; // { cells: [{r,c,delay,color}], startFrame, maxDelay }
const RIPPLE_STEP = 3; // frames of delay per unit of (r+c) distance
const RIPPLE_FLIP_DUR = 10; // frames for a single cell's flip-scale animation

const PALETTE = [
  [200, 50, 63],   // red
  [230, 180, 34],  // gold
  [127, 176, 105], // green
  [90, 160, 210],  // blue
  [180, 110, 200], // purple
  [220, 140, 60],  // orange
  [90, 200, 190],  // teal
  [230, 110, 160], // pink
];

function colorAt(v) {
  return PALETTE[v % PALETTE.length];
}

function makeGrid() {
  const g = [];
  for (let r = 0; r < SIZE; r++) {
    g[r] = [];
    for (let c = 0; c < SIZE; c++) g[r][c] = Math.floor(Math.random() * NCOLORS);
  }
  return g;
}

function bestKey() {
  return "flood_best_" + SIZE + "x" + SIZE + "_" + NCOLORS;
}
let best = null;
function loadBest() {
  try { const v = localStorage.getItem(bestKey()); best = v ? parseInt(v) : null; } catch { best = null; }
}
function saveBest() {
  loadBest();
}
function maybeSaveBest() {
  try {
    if (best === null || moves < best) {
      localStorage.setItem(bestKey(), String(moves));
      best = moves;
    }
  } catch {}
}

// Build a region graph for a board: each connected same-color blob becomes
// one node, with edges to neighboring blobs of a different color. Solving on
// this compressed graph is far cheaper than simulating flood-fills on the
// raw cell grid, which is what makes a per-board greedy solve affordable.
function buildRegionGraph(g) {
  const n = g.length;
  const regionId = Array.from({ length: n }, () => Array(n).fill(-1));
  const colors = [];
  const neighbors = []; // neighbors[id] = Set of adjacent region ids

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (regionId[r][c] !== -1) continue;
      const id = colors.length;
      const col = g[r][c];
      colors.push(col);
      neighbors.push(new Set());
      const stack = [[r, c]];
      regionId[r][c] = id;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        const nbrs = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];
        for (const [nr, nc] of nbrs) {
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          if (g[nr][nc] === col) {
            if (regionId[nr][nc] === -1) { regionId[nr][nc] = id; stack.push([nr, nc]); }
          }
        }
      }
    }
  }
  // second pass: link cross-color adjacency now that every region has an id
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = regionId[r][c];
      if (c + 1 < n && regionId[r][c + 1] !== id) { neighbors[id].add(regionId[r][c + 1]); neighbors[regionId[r][c + 1]].add(id); }
      if (r + 1 < n && regionId[r + 1][c] !== id) { neighbors[id].add(regionId[r + 1][c]); neighbors[regionId[r + 1][c]].add(id); }
    }
  }
  return { colors, neighbors, rootId: regionId[0][0] };
}

// Greedy solve on the region graph: repeatedly absorb whichever adjacent
// color merges the most new region-area into the owned territory. This is
// the standard fast heuristic for Flood-It and reliably finds a solution
// close to optimal, which is exactly what we need as a solvability check.
function greedySolveMoves(g) {
  const { colors, neighbors, rootId } = buildRegionGraph(g);
  const owned = new Set([rootId]);
  let ownedColor = colors[rootId];
  let movesUsed = 0;
  const allDone = () => owned.size === colors.length;

  while (!allDone()) {
    // frontier: colors of regions adjacent to the owned territory
    const gains = new Map(); // color -> total new-region count if picked
    for (const id of owned) {
      for (const nb of neighbors[id]) {
        if (owned.has(nb)) continue;
        const col = colors[nb];
        gains.set(col, (gains.get(col) || 0) + 1);
      }
    }
    if (gains.size === 0) break; // shouldn't happen on a connected grid
    let bestCol = null, bestGain = -1;
    for (const [col, gain] of gains) {
      if (gain > bestGain) { bestGain = gain; bestCol = col; }
    }
    ownedColor = bestCol;
    // absorb every adjacent region of bestCol, then merge any further
    // same-color regions that newly touch the territory (chain reaction)
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of [...owned]) {
        for (const nb of neighbors[id]) {
          if (!owned.has(nb) && colors[nb] === ownedColor) { owned.add(nb); grew = true; }
        }
      }
    }
    movesUsed++;
  }
  return movesUsed;
}

function computeMoveLimit(g) {
  // Guarantee solvability: give the player a small margin above a known
  // (greedy, near-optimal) solution length rather than a blind size-based guess.
  const solverMoves = greedySolveMoves(g);
  return solverMoves + Math.max(2, Math.round(NCOLORS * 0.5));
}

function newGame() {
  grid = makeGrid();
  moves = 0;
  moveLimit = computeMoveLimit(grid);
  gameOver = false;
  won = false;
  prevGrid = null;
  prevMoves = null;
  loadBest();
  updateStatus();
}

function regionFrom(g, r0, c0) {
  const n = g.length; // derived from the passed grid, not the global SIZE,
  // so this also works for the how-to-play demo's smaller scripted board
  const target = g[r0][c0];
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [[r0, c0]];
  seen[r0][c0] = true;
  const cells = [];
  while (stack.length) {
    const [r, c] = stack.pop();
    cells.push([r, c]);
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (seen[nr][nc]) continue;
      if (g[nr][nc] !== target) continue;
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return cells;
}

function isFullyFlooded() {
  const v = grid[0][0];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] !== v) return false;
  return true;
}

function pickColor(col) {
  if (gameOver || ripple) return;
  const current = grid[0][0];
  if (col === current) return; // no-op move, don't waste a turn

  prevGrid = grid.map(row => [...row]);
  prevMoves = moves;

  const region = regionFrom(grid, 0, 0);
  const cells = region.map(([r, c]) => ({ r, c, delay: (r + c) * RIPPLE_STEP, color: col }));
  const maxDelay = cells.reduce((m, cell) => Math.max(m, cell.delay), 0);
  ripple = { cells, startFrame: frameCount, maxDelay, col };
  moves++;
  updateStatus();
}

function finishPick() {
  const col = ripple.col;
  for (const { r, c } of ripple.cells) grid[r][c] = col;
  ripple = null;

  if (isFullyFlooded()) {
    gameOver = true;
    won = true;
    maybeSaveBest();
    // difficulty ~ grid size and color count (sliders: size 6-24, colors 3-8)
    const sizeFrac = (SIZE - 6) / (24 - 6);
    const colorFrac = (NCOLORS - 3) / (8 - 3);
    celebrate(1 + Math.round((sizeFrac + colorFrac) / 2 * 2));
  } else if (moves >= moveLimit) {
    gameOver = true;
    won = false;
  }
  updateStatus();
}

function undo() {
  if (!prevGrid) {
    flashNote("Nothing to undo!");
    return;
  }
  ripple = null;
  grid = prevGrid;
  moves = prevMoves;
  gameOver = false;
  won = false;
  prevGrid = null;
  prevMoves = null;
  updateStatus();
}

function updateStatus() {
  if (gameOver) {
    setStatus(won ? "flooded in " + moves + " moves!" : "out of moves — board not flooded", won ? "solved" : "dead");
  } else {
    setStatus("moves: " + moves + " / " + moveLimit + (best !== null ? "   best: " + best : ""), null);
  }
}

// ---- info helper animation ----
// Drives a tiny seeded board through two real picks using the actual
// pickColor/ripple/border-tracing logic the real game uses (regionFrom,
// colorAt, the same ripple timing constants), instead of a separate
// hand-drawn mock — so the demo genuinely looks and moves like the game.
const INFO_BOARD_SEED = [
  [0,0,1,2,1],
  [0,0,1,1,2],
  [0,1,2,2,1],
  [1,1,2,0,0],
  [2,2,1,0,0],
];
// Full solution for this seed (verified by simulation) — keeps picking
// until the whole board is a single color, same as actually winning a game.
const INFO_MOVES = [1, 2, 1, 2, 0, 1];
const INFO_N = INFO_BOARD_SEED.length;
const INFO_RIPPLE_STEP = 1.5; // smaller than the real game's RIPPLE_STEP so a 5x5 board doesn't feel sluggish

const INFO_PAUSE_FRAMES = 35;      // idle frames held between picks
const INFO_SOLVED_HOLD_FRAMES = 90; // idle frames held on the fully-flooded board before looping back

let _infoGrid = null;
let _infoRipple = null;
let _infoMoveIdx = 0;
let _infoIdleSince = 0; // frame count the animation has been idle (no ripple) since its last state change
let _infoLastFrame = -1;

function _infoResetSeq(frame) {
  _infoGrid = INFO_BOARD_SEED.map(row => [...row]);
  _infoRipple = null;
  _infoMoveIdx = 0;
  _infoIdleSince = frame;
}

function infoAnim(p, w, h, frame) {
  const pad = 12;
  const cs = Math.min((w - pad * 2) / INFO_N, (h - pad * 2) / INFO_N) * 0.85;
  const bw = cs * INFO_N, bh = cs * INFO_N;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  if (!_infoGrid || frame < _infoLastFrame) _infoResetSeq(frame); // (re)init on open
  _infoLastFrame = frame;

  // once idle for a beat, either fire the next scripted pick, or — once
  // the sequence is done — hold on the solved (single-color) board for a
  // longer beat before looping back to the start, instead of snapping
  // straight into a refill.
  const solved = _infoMoveIdx >= INFO_MOVES.length;
  const holdFrames = solved ? INFO_SOLVED_HOLD_FRAMES : INFO_PAUSE_FRAMES;
  if (!_infoRipple && frame - _infoIdleSince >= holdFrames) {
    if (solved) {
      _infoResetSeq(frame);
    } else {
      const col = INFO_MOVES[_infoMoveIdx];
      _infoMoveIdx++;
      if (col !== _infoGrid[0][0]) {
        const region = regionFrom(_infoGrid, 0, 0);
        const cells = region.map(([r, c]) => ({ r, c, delay: (r + c) * INFO_RIPPLE_STEP, color: col }));
        const maxDelay = cells.reduce((m, cell) => Math.max(m, cell.delay), 0);
        _infoRipple = { cells, startFrame: frame, maxDelay, col };
      }
    }
  }

  // build ripple flip progress per cell, same math as the real draw()
  let rippleState = null;
  let rippleCol = null;
  if (_infoRipple) {
    rippleCol = _infoRipple.col;
    rippleState = new Map();
    const elapsed = frame - _infoRipple.startFrame;
    let allDone = true;
    for (const cell of _infoRipple.cells) {
      const local = elapsed - cell.delay;
      if (local < 0) {
        allDone = false;
      } else {
        const t = Math.min(1, local / RIPPLE_FLIP_DUR);
        if (t < 1) allDone = false;
        rippleState.set(cell.r + "," + cell.c, t);
      }
    }
    if (allDone) {
      for (const { r, c } of _infoRipple.cells) _infoGrid[r][c] = _infoRipple.col;
      _infoRipple = null;
      _infoIdleSince = frame;
    }
  }

  p.background(20, 18, 15);
  p.noStroke();

  for (let r = 0; r < INFO_N; r++) {
    for (let c = 0; c < INFO_N; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      const t = rippleState ? rippleState.get(r + "," + c) : undefined;
      if (t === undefined) {
        const col = colorAt(_infoGrid[r][c]);
        p.fill(col[0], col[1], col[2]);
        p.rect(x, y, cs - 1, cs - 1, 1.5);
      } else {
        const oldCol = colorAt(_infoGrid[r][c]);
        const newCol = colorAt(rippleCol);
        const shrink = t < 0.5;
        const localT = shrink ? t / 0.5 : (t - 0.5) / 0.5;
        const scale = shrink ? 1 - localT : localT;
        const col = shrink ? oldCol : newCol;
        p.fill(col[0], col[1], col[2]);
        const sz = (cs - 1) * scale;
        const off = (cs - 1 - sz) / 2;
        p.rect(x + off, y + off, sz, sz, 1.5);
      }
    }
  }

  // border tracing the boundary of the flooded (owned) region, same logic
  // as the real game's draw(), so it grows in step with the ripple here too
  const owned = regionFrom(_infoGrid, 0, 0);
  const ownedSet = new Set(owned.map(([r, c]) => r + "," + c));
  if (rippleState) {
    for (const [key, t] of rippleState) if (t >= 0.5) ownedSet.add(key);
  }
  p.stroke(243, 237, 224, 200);
  p.strokeWeight(2);
  for (const key of ownedSet) {
    const [r, c] = key.split(",").map(Number);
    const x = ox + c * cs, y = oy + r * cs;
    if (r === 0 || !ownedSet.has((r - 1) + "," + c)) p.line(x, y, x + cs, y);
    if (r === INFO_N - 1 || !ownedSet.has((r + 1) + "," + c)) p.line(x, y + cs, x + cs, y + cs);
    if (c === 0 || !ownedSet.has(r + "," + (c - 1))) p.line(x, y, x, y + cs);
    if (c === INFO_N - 1 || !ownedSet.has(r + "," + (c + 1))) p.line(x + cs, y, x + cs, y + cs);
  }
}

// ---- p5 sketch lifecycle ----

const CANVAS = 440;
let cellSize = 0;
let ox = 0, oy = 0;
let swatchY = 0, swatchH = 0;

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS + 64);
  cnv.parent("canvas-wrap");
  newGame();
}

function draw() {
  background(20, 18, 15);

  const availW = width;
  const boardAreaH = height - 64;

  const maxBoardW = min(availW * 0.92, boardAreaH * 0.92, 420);
  cellSize = floor(maxBoardW / SIZE);
  const boardW = cellSize * SIZE;

  ox = floor((availW - boardW) / 2);
  oy = floor((boardAreaH - boardW) / 2);

  // build a lookup of ripple flip progress per cell, if a ripple is active
  let rippleState = null; // Map "r,c" -> t (0..1, 1 = fully flipped)
  let rippleCol = null;
  if (ripple) {
    rippleCol = ripple.col;
    rippleState = new Map();
    const elapsed = frameCount - ripple.startFrame;
    let allDone = true;
    for (const cell of ripple.cells) {
      const local = elapsed - cell.delay;
      if (local < 0) {
        allDone = false;
      } else {
        const t = Math.min(1, local / RIPPLE_FLIP_DUR);
        if (t < 1) allDone = false;
        rippleState.set(cell.r + "," + cell.c, t);
      }
    }
    if (allDone) finishPick();
  }

  noStroke();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = ox + c * cellSize, y = oy + r * cellSize;
      const t = rippleState ? rippleState.get(r + "," + c) : undefined;
      if (t === undefined) {
        const col = colorAt(grid[r][c]);
        fill(col[0], col[1], col[2]);
        rect(x, y, cellSize - 1, cellSize - 1, 1.5);
      } else {
        // flip animation: shrink out the old color, pop in the new one
        const oldCol = colorAt(grid[r][c]);
        const newCol = colorAt(rippleCol);
        const shrink = t < 0.5;
        const localT = shrink ? t / 0.5 : (t - 0.5) / 0.5;
        const scale = shrink ? 1 - localT : localT;
        const col = shrink ? oldCol : newCol;
        fill(col[0], col[1], col[2]);
        const sz = (cellSize - 1) * scale;
        const off = (cellSize - 1 - sz) / 2;
        rect(x + off, y + off, sz, sz, 1.5);
      }
    }
  }

  // border tracing the boundary of the flooded (owned) region — cells past
  // the ripple's flip midpoint already read as owned, so the border grows
  // outward in step with the animation
  const owned = regionFrom(grid, 0, 0);
  const ownedSet = new Set(owned.map(([r, c]) => r + "," + c));
  if (rippleState) {
    for (const [key, t] of rippleState) if (t >= 0.5) ownedSet.add(key);
  }
  stroke(243, 237, 224, 200);
  strokeWeight(2);
  for (const key of ownedSet) {
    const [r, c] = key.split(",").map(Number);
    const x = ox + c * cellSize, y = oy + r * cellSize;
    if (r === 0 || !ownedSet.has((r - 1) + "," + c)) line(x, y, x + cellSize, y);
    if (r === SIZE - 1 || !ownedSet.has((r + 1) + "," + c)) line(x, y + cellSize, x + cellSize, y + cellSize);
    if (c === 0 || !ownedSet.has(r + "," + (c - 1))) line(x, y, x, y + cellSize);
    if (c === SIZE - 1 || !ownedSet.has(r + "," + (c + 1))) line(x + cellSize, y, x + cellSize, y + cellSize);
  }

  // color swatches
  swatchH = 44;
  swatchY = boardAreaH + 10;
  const sw = width / NCOLORS;
  for (let i = 0; i < NCOLORS; i++) {
    const col = colorAt(i);
    const x = i * sw;
    const hovering = !gameOver && mouseX >= x && mouseX < x + sw && mouseY >= swatchY && mouseY < swatchY + swatchH;
    fill(col[0], col[1], col[2]);
    noStroke();
    const padY = hovering ? 0 : 4;
    rect(x + 4, swatchY + padY, sw - 8, swatchH - padY, 6);
    if (grid[0][0] === i) {
      noFill();
      stroke(243, 237, 224, 200);
      strokeWeight(2);
      rect(x + 4, swatchY + padY, sw - 8, swatchH - padY, 6);
    }
  }

  // game over overlay
  if (gameOver) {
    fill(20, 18, 15, 195);
    noStroke();
    rect(ox - 10, oy - 10, boardW + 20, boardW + 20, 14);

    fill(won ? color(127, 176, 105) : color(200, 50, 63));
    textAlign(CENTER, CENTER);
    textSize(22);
    textStyle(BOLD);
    text(won ? "BOARD FLOODED" : "OUT OF MOVES", ox + boardW / 2, oy + boardW / 2 - 14);

    fill(155, 145, 130);
    textSize(13);
    textStyle(NORMAL);
    text(won ? "Solved in " + moves + " moves" : "Press New board to retry", ox + boardW / 2, oy + boardW / 2 + 14);
  }
}

function mousePressed() {
  if (gameOver) return;
  if (mouseY >= swatchY && mouseY < swatchY + swatchH) {
    const sw = width / NCOLORS;
    const i = Math.floor(mouseX / sw);
    if (i >= 0 && i < NCOLORS) pickColor(i);
    return;
  }
  const c = Math.floor((mouseX - ox) / cellSize);
  const r = Math.floor((mouseY - oy) / cellSize);
  if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) pickColor(grid[r][c]);
}

function keyPressed() {
  if (keyCode === 78) { newGame(); return false; } // N
  if (key >= "1" && key <= "8") {
    const i = parseInt(key) - 1;
    if (i < NCOLORS) pickColor(i);
    return false;
  }
}
