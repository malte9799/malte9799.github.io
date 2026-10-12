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
    { id: "s-size",   label: "Grid size", min: 6,  max: 24, step: 1, fmt: v => v + "×" + v },
    { id: "s-colors", label: "Colors",    min: 3,  max: 8,  step: 1 },
  ],
  onPreset: ([n, k]) => { SIZE = n; NCOLORS = k; saveSettings("flood_state", { SIZE, NCOLORS }); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; else NCOLORS = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE, "s-colors": NCOLORS }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "You own the top-left corner. Picking a color (swatches, number keys, or clicking any cell) recolors your whole territory, absorbing every touching region of that color. Flood the entire board before the move counter runs out.",
      "Keys: 1–8 pick a color · U undo · N new board.",
    ],
  },
});

let SIZE = 14;
let NCOLORS = 6;
{
  const d = loadSettings("flood_state");
  if (typeof d.SIZE === "number" && d.SIZE >= 6 && d.SIZE <= 24) SIZE = d.SIZE;
  if (typeof d.NCOLORS === "number" && d.NCOLORS >= 3 && d.NCOLORS <= 8) NCOLORS = d.NCOLORS;
}
syncSliderUI();
let grid = [];
let moves = 0;
let moveLimit = 0;
let gameOver = false;
let won = false;
let history = []; // undo stack of { grid, moves }

// ripple animation: cells flip to their new color in waves spreading from
// the top-left origin, instead of all at once
let ripple = null; // { cells: [{r,c,delay,color}], startFrame, maxDelay }
const RIPPLE_STEP = 3; // frames of delay per unit of (r+c) distance
const RIPPLE_FLIP_DUR = 10; // frames for a single cell's flip-scale animation

// Its own palette rather than PAL: in a color-matching game every hue must
// be clearly distinct, so these are spread around the wheel.
const PALETTE = [
  [255, 99, 120],  // red
  [255, 208, 92],  // yellow
  [104, 218, 140], // green
  [92, 162, 255],  // blue
  [176, 132, 255], // violet
  [255, 150, 72],  // orange
  [76, 218, 232],  // cyan
  [255, 140, 212], // pink
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
function maybeSaveBest() {
  try {
    if (best === null || moves <= best) {
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
  history = [];
  ripple = null;
  clearParticles();
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
  if (ripple) finishPick(); // a quick second pick skips the rest of the animation
  if (gameOver) return;
  const current = grid[0][0];
  if (col === current) return; // no-op move, don't waste a turn

  history.push({ grid: grid.map(row => [...row]), moves });

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
  if (ripple) finishPick();
  if (won || !history.length) {
    flashNote(won ? "Board is flooded — start a new one." : "Nothing to undo.");
    return;
  }
  ({ grid, moves } = history.pop());
  gameOver = false;
  updateStatus();
}

function updateStatus() {
  if (gameOver) {
    setStatus(won ? "flooded in " + moves + " moves" + (best === moves ? " · new best!" : "") : "out of moves — undo or try a new board", won ? "solved" : "dead");
  } else {
    setStatus(moves + " / " + moveLimit + " moves" + (best !== null ? " · best " + best : ""), null);
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

  p.background(...PAL.board);
  p.noStroke();

  for (let r = 0; r < INFO_N; r++) {
    for (let c = 0; c < INFO_N; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      const t = rippleState ? rippleState.get(r + "," + c) : undefined;
      if (t === undefined) {
        const col = colorAt(_infoGrid[r][c]);
        p.fill(col[0], col[1], col[2]);
        p.rect(x + 1, y + 1, cs - 2, cs - 2, 6);
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
        p.rect(x + off, y + off, sz, sz, 6);
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
  p.stroke(...PAL.ink, 200);
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

function drawCell(x, y, sz, col) {
  fill(col[0], col[1], col[2]);
  rect(x, y, sz, sz, Math.min(4, sz * 0.18));
}

function draw() {
  background(...PAL.board);

  const boardAreaH = height - 64;
  cellSize = floor(min(width - 28, boardAreaH - 20) / SIZE);
  const boardW = cellSize * SIZE;
  const gap = cellSize >= 20 ? 2 : 1;

  ox = floor((width - boardW) / 2);
  oy = floor((boardAreaH - boardW) / 2) + 6;

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
    if (allDone) { finishPick(); rippleState = null; }
  }

  noStroke();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = ox + c * cellSize, y = oy + r * cellSize;
      const t = rippleState ? rippleState.get(r + "," + c) : undefined;
      const sz = cellSize - gap;
      if (t === undefined) {
        drawCell(x, y, sz, colorAt(grid[r][c]));
      } else {
        // flip animation: shrink out the old color, pop in the new one
        const shrink = t < 0.5;
        const localT = shrink ? t / 0.5 : (t - 0.5) / 0.5;
        const scale = shrink ? 1 - localT : localT;
        const k = sz * scale;
        drawCell(x + (sz - k) / 2, y + (sz - k) / 2, k, colorAt(shrink ? grid[r][c] : rippleCol));
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
  stroke(...PAL.ink, 230);
  strokeWeight(2);
  strokeCap(ROUND);
  const g2 = gap / 2;
  for (const key of ownedSet) {
    const [r, c] = key.split(",").map(Number);
    const x = ox + c * cellSize - g2, y = oy + r * cellSize - g2;
    if (r === 0 || !ownedSet.has((r - 1) + "," + c)) line(x, y, x + cellSize, y);
    if (r === SIZE - 1 || !ownedSet.has((r + 1) + "," + c)) line(x, y + cellSize, x + cellSize, y + cellSize);
    if (c === 0 || !ownedSet.has(r + "," + (c - 1))) line(x, y, x, y + cellSize);
    if (c === SIZE - 1 || !ownedSet.has(r + "," + (c + 1))) line(x + cellSize, y, x + cellSize, y + cellSize);
  }

  // color swatches, with their number key
  swatchH = 42;
  swatchY = boardAreaH + 8;
  const sw = (width - 20) / NCOLORS;
  let anyHover = false;
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(14);
  for (let i = 0; i < NCOLORS; i++) {
    const col = colorAt(i);
    const x = 10 + i * sw;
    const hovering = !gameOver && mouseX >= x && mouseX < x + sw && mouseY >= swatchY && mouseY < swatchY + swatchH;
    const current = grid[0][0] === i;
    anyHover = anyHover || hovering;
    const lift = hovering && !current ? 3 : 0;
    noStroke();
    fill(col[0], col[1], col[2], current ? 110 : 255);
    rect(x + 4, swatchY + 4 - lift, sw - 8, swatchH - 8, 10);
    if (current) {
      noFill();
      stroke(...PAL.ink, 230);
      strokeWeight(2);
      rect(x + 4, swatchY + 4, sw - 8, swatchH - 8, 10);
    }
    noStroke();
    fill(0, 0, 0, current ? 90 : 110);
    text(i + 1, x + sw / 2, swatchY + swatchH / 2 - lift);
  }
  const overBoard = !gameOver && mouseX >= ox && mouseY >= oy && mouseX < ox + boardW && mouseY < oy + boardW;
  cursor(anyHover || overBoard ? HAND : ARROW);

  drawParticles();

  // game over overlay
  if (gameOver) {
    drawBoardOverlay(
      ox, oy, boardW, boardW,
      won ? "Flooded!" : "Out of moves",
      won ? "solved in " + moves + " moves" : "undo, or press N for a new board",
      won ? PAL.mint : PAL.rose,
    );
  }
}

function mousePressed() {
  if (gameOver || mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  if (mouseY >= swatchY && mouseY < swatchY + swatchH) {
    const i = Math.floor((mouseX - 10) / ((width - 20) / NCOLORS));
    if (i >= 0 && i < NCOLORS) pickColor(i);
    return false;
  }
  const c = Math.floor((mouseX - ox) / cellSize);
  const r = Math.floor((mouseY - oy) / cellSize);
  if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) { pickColor(grid[r][c]); return false; }
}

function keyPressed() {
  if (key === "n" || key === "N") { newGame(); return false; }
  if (key === "u" || key === "U") { undo(); return false; }
  if (key >= "1" && key <= "8") {
    const i = parseInt(key) - 1;
    if (i < NCOLORS) pickColor(i);
    return false;
  }
}
