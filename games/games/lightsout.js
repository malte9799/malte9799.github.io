// Circuit Align (Lights Out) — toggle nodes to turn off all glowing lines.
// Clicking a node toggles itself and its four neighbors.

initGame({
  title: "Circuit Align",
  tag: "switch every light off",
  presets: [
    { label: "5×5 (standard)", values: [5] },
    { label: "3×3 (easy)",     values: [3] },
    { label: "7×7 (hard)",     values: [7] },
  ],
  buttons: [
    { id: "btn-new",  label: "New board", primary: true, onClick: () => newGame() },
    { id: "btn-undo", label: "Undo",                     onClick: () => undo() },
    { id: "btn-hint", label: "Hint",                     onClick: () => confirmHint(getHint) },
  ],
  sliders: [
    { id: "s-size", label: "Size", min: 3, max: 9, step: 1, fmt: v => v + "×" + v },
  ],
  onPreset: ([n]) => { SIZE = n; saveSettings("lightsout_state", { SIZE }); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Clicking a node toggles it and its four direct neighbors. Wires glow between two lit nodes. Turn every light off in as few moves as you can — every board is scrambled with legal moves, so it's always solvable.",
      "Keys: N new board · U / Ctrl+Z undo · H hint.",
    ],
  },
});

let SIZE = 5;
{
  const d = loadSettings("lightsout_state");
  if (typeof d.SIZE === "number" && d.SIZE >= 3 && d.SIZE <= 9) SIZE = d.SIZE;
}
syncSliderUI();

let grid = [];               // grid[r][c] — true = lit
let solutionSet = new Set(); // "r,c" presses that solve the current board (XOR-tracked)
let totalMoves = 0;
let gameOver = false;
let history = [];            // undo stack of { grid, solution, moves }
let hintCell = null;
let hintTimeout = 0;
let flipAt = [];             // frameCount each node last flipped, for the pop animation

// Layout offsets
let cellSize = 0;
let ox = 0, oy = 0;

function makeGrid(n, v = false) {
  return Array.from({ length: n }, () => Array(n).fill(v));
}

function cloneGrid(g) {
  return g.map(r => [...r]);
}

function toggleNode(r, c, animate) {
  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      grid[nr][nc] = !grid[nr][nc];
      if (animate) flipAt[nr][nc] = frameCount;
    }
  }
}

function solveStep(r, c) {
  const key = r + "," + c;
  if (solutionSet.has(key)) solutionSet.delete(key);
  else solutionSet.add(key);
}

function litCount() {
  let n = 0;
  for (const row of grid) for (const v of row) if (v) n++;
  return n;
}

function newGame() {
  totalMoves = 0;
  gameOver = false;
  history = [];
  hintCell = null;
  hintTimeout = 0;
  clearParticles();
  resetHint();
  flashNote("");

  // Scramble with distinct presses so no two cancel out; the pressed set is
  // then exactly a solution. Reject boards with too few lights to be fun.
  const presses = SIZE <= 3 ? 3 : Math.round(SIZE * SIZE * 0.4);
  const minLit = Math.ceil(SIZE * SIZE * 0.25);
  const cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);
  for (let attempt = 0; attempt < 30; attempt++) {
    grid = makeGrid(SIZE);
    solutionSet.clear();
    for (const [r, c] of shuffleArray(cells).slice(0, presses)) {
      toggleNode(r, c, false);
      solveStep(r, c);
    }
    if (litCount() >= minLit) break;
  }

  // staggered "power up" pop from the top-left on every new board
  flipAt = makeGrid(SIZE, 0).map((row, r) => row.map((_, c) => (typeof frameCount === "number" ? frameCount : 0) + (r + c) * 2));
  updateStatus();
}

function updateStatus() {
  if (gameOver) {
    setStatus("circuit aligned in " + totalMoves + (totalMoves === 1 ? " move" : " moves"), "solved");
  } else {
    const lit = litCount();
    setStatus(totalMoves + (totalMoves === 1 ? " move" : " moves") + " · " + lit + (lit === 1 ? " light" : " lights") + " on", null);
  }
}

function pressCell(r, c) {
  if (gameOver) return;
  history.push({ grid: cloneGrid(grid), solution: new Set(solutionSet), moves: totalMoves });

  toggleNode(r, c, true);
  solveStep(r, c);
  totalMoves++;

  const cx = ox + c * cellSize + cellSize / 2;
  const cy = oy + r * cellSize + cellSize / 2;
  spawnBurst(cx, cy, { count: 12, speed: [1.5, 4.5], life: [255, 255], size: [2, 6], drag: 0.95, decay: 8, col: grid[r][c] ? PAL.sun : PAL.lilac });

  hintCell = null;
  hintTimeout = 0;

  if (litCount() === 0) {
    gameOver = true;
    solutionSet.clear();
    // difficulty ~ grid size (slider: 3-9)
    celebrate(1 + Math.round((SIZE - 3) / (9 - 3) * 2));
  }
  updateStatus();
}

function undo() {
  if (gameOver || history.length === 0) {
    flashNote(gameOver ? "Board is solved — start a new one." : "Nothing to undo.");
    return;
  }
  const prev = history.pop();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (prev.grid[r][c] !== grid[r][c]) flipAt[r][c] = frameCount;
  grid = prev.grid;
  solutionSet = prev.solution;
  totalMoves = prev.moves;
  hintCell = null;
  updateStatus();
}

function getHint() {
  if (gameOver) return;
  if (solutionSet.size === 0) {
    flashNote("No hint available.");
    return;
  }
  const arr = Array.from(solutionSet);
  hintCell = arr[Math.floor(Math.random() * arr.length)];
  hintTimeout = 150;
  flashNote("Press the node with the pulsing green ring.");
}

// ---- info modal animation ----
// A scripted 3×3 board solved in two real moves. Each move: a pulse ring on
// the target node, then the click — an expanding shockwave while the node and
// its four neighbors flip with a scale pop and the wires re-light. After the
// second click every light is out and the board rests briefly before looping.

function infoAnim(p, w, h, frame) {
  const N = 3;
  const pad = 12;
  const cs = Math.min((w - pad * 2) / N, (h - pad * 2) / N) * 0.85;
  const bw = cs * N;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bw) / 2);

  const PHASE_LEN = 80;
  const CLICK_FRAC = 0.38;  // point in the phase when the click lands
  const POP_FRAMES = 14;    // node flip pop duration

  // start board = pressing (1,1) then (2,2) on an empty board, so clicking
  // those two cells in order genuinely clears it ([row][col], true = lit)
  const start = [
    [false, true,  false],
    [true,  true,  false],
    [false, false, true ],
  ];
  const clicks = [{ r: 1, c: 1 }, { r: 2, c: 2 }];

  const t = frame % (PHASE_LEN * (clicks.length + 0.6)); // extra 0.6 phase = all-off hold
  const phase = Math.min(clicks.length - 1, Math.floor(t / PHASE_LEN));
  const localT = Math.min(1, (t - phase * PHASE_LEN) / PHASE_LEN);
  const click = clicks[phase];
  const clicked = localT >= CLICK_FRAC || t >= PHASE_LEN * clicks.length;
  const sinceClick = (localT - CLICK_FRAC) * PHASE_LEN;

  const affected = (r, c, cl) => Math.abs(r - cl.r) + Math.abs(c - cl.c) <= 1;
  const state = (r, c) => {
    let v = start[r][c];
    for (let k = 0; k < clicks.length; k++) {
      const done = k < phase || (k === phase && clicked);
      if (done && affected(r, c, clicks[k])) v = !v;
    }
    return v;
  };

  p.background(...PAL.board);

  // wires
  p.strokeWeight(3);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = ox + c * cs + cs / 2;
      const cy = oy + r * cs + cs / 2;
      if (c < N - 1) {
        p.stroke(...(state(r, c) && state(r, c + 1) ? [...PAL.sun, 230] : PAL.line));
        p.line(cx, cy, cx + cs, cy);
      }
      if (r < N - 1) {
        p.stroke(...(state(r, c) && state(r + 1, c) ? [...PAL.sun, 230] : PAL.line));
        p.line(cx, cy, cx, cy + cs);
      }
    }
  }

  // nodes, with a scale pop on the cells the current click just flipped
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = ox + c * cs + cs / 2;
      const cy = oy + r * cs + cs / 2;
      let scale = 1;
      if (clicked && t < PHASE_LEN * clicks.length && affected(r, c, click) && sinceClick < POP_FRAMES) {
        scale = 1 + 0.35 * p.sin((sinceClick / POP_FRAMES) * p.PI);
      }
      if (state(r, c)) {
        const d = cs * scale;
        p.noStroke();
        p.fill(...PAL.sun, 22); p.circle(cx, cy, d * 0.78);
        p.fill(...PAL.sun, 55); p.circle(cx, cy, d * 0.54);
        p.fill(...PAL.sun); p.circle(cx, cy, d * 0.36);
        p.fill(255, 248, 228); p.circle(cx - d * 0.04, cy - d * 0.04, d * 0.2);
      } else {
        p.fill(...PAL.panel);
        p.stroke(...PAL.line);
        p.strokeWeight(2);
        p.circle(cx, cy, cs * 0.36 * scale);
        p.noStroke();
        p.fill(...PAL.well);
        p.circle(cx, cy, cs * 0.15 * scale);
      }
    }
  }

  if (t < PHASE_LEN * clicks.length) {
    const ccx = ox + click.c * cs + cs / 2;
    const ccy = oy + click.r * cs + cs / 2;
    if (!clicked) {
      // pulse ring building up to the click
      const pulse = 1.0 + 0.15 * p.sin(frame * 0.3);
      p.noFill();
      p.stroke(...PAL.lilac, 230);
      p.strokeWeight(2);
      p.circle(ccx, ccy, cs * 0.58 * pulse);
    } else if (sinceClick < PHASE_LEN * 0.4) {
      // expanding shockwave ring after the click
      const st = sinceClick / (PHASE_LEN * 0.4);
      p.noFill();
      p.stroke(...PAL.mint, 200 * (1 - st));
      p.strokeWeight(2);
      p.circle(ccx, ccy, cs * (0.4 + st * 2.4));
    }
  } else {
    // solved hold: soft green glow ring around the dark board
    p.noFill();
    p.stroke(...PAL.mint, 90 + 50 * p.sin(frame * 0.15));
    p.strokeWeight(2);
    p.rect(ox - 8, oy - 8, bw + 16, bw + 16, 10);
  }
}

// ---- p5 Sketch Lifecycle ----

const CANVAS = 440;

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS);
  cnv.parent("canvas-wrap");
  newGame();
}

function hoveredCell() {
  if (gameOver || !mouseInCanvas()) return null;
  const c = Math.floor((mouseX - ox) / cellSize);
  const r = Math.floor((mouseY - oy) / cellSize);
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE ? { r, c } : null;
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseY >= 0 && mouseX < width && mouseY < height;
}

function draw() {
  background(...PAL.board);

  const boardW0 = min(width, height) * 0.88;
  cellSize = floor(boardW0 / SIZE);
  const boardW = cellSize * SIZE;
  ox = floor((width - boardW) / 2);
  oy = floor((height - boardW) / 2);
  const center = (i) => i * cellSize + cellSize / 2;
  const wireW = max(2, cellSize * 0.05);

  // wires: dim base, then the lit ones with a soft glow on top
  strokeCap(ROUND);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cx = ox + center(c), cy = oy + center(r);
      const segs = [];
      if (c < SIZE - 1) segs.push([cx + cellSize, cy, grid[r][c] && grid[r][c + 1]]);
      if (r < SIZE - 1) segs.push([cx, cy + cellSize, grid[r][c] && grid[r + 1][c]]);
      for (const [x2, y2, lit] of segs) {
        if (lit) {
          stroke(...PAL.sun, 40); strokeWeight(wireW * 3.2); line(cx, cy, x2, y2);
          stroke(...PAL.sun, 230); strokeWeight(wireW); line(cx, cy, x2, y2);
        } else {
          stroke(...PAL.line); strokeWeight(wireW); line(cx, cy, x2, y2);
        }
      }
    }
  }

  const hover = hoveredCell();
  const affected = (r, c) => hover && Math.abs(r - hover.r) + Math.abs(c - hover.c) <= 1;

  // nodes
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cx = ox + center(c), cy = oy + center(r);
      const t = frameCount - flipAt[r][c];
      const pop = t >= 0 && t < 14 ? 1 + 0.3 * sin((t / 14) * PI) : 1;
      const d = cellSize * pop;

      if (grid[r][c]) {
        noStroke();
        fill(...PAL.sun, 22); circle(cx, cy, d * 0.78);
        fill(...PAL.sun, 55); circle(cx, cy, d * 0.54);
        fill(...PAL.sun); circle(cx, cy, d * 0.36);
        fill(255, 248, 228); circle(cx - d * 0.04, cy - d * 0.04, d * 0.2);
      } else {
        fill(...PAL.panel);
        stroke(affected(r, c) ? PAL.lineHi : PAL.line);
        strokeWeight(max(1.5, cellSize * 0.035));
        circle(cx, cy, d * 0.36);
        noStroke();
        fill(...PAL.well);
        circle(cx, cy, d * 0.14);
      }
    }
  }

  // hover: ring on the node, faint rings on the neighbours it will flip
  if (hover) {
    noFill();
    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = hover.r + dr, c = hover.c + dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const main = dr === 0 && dc === 0;
      stroke(...PAL.lilac, main ? 220 : 90);
      strokeWeight(main ? 2 : 1.5);
      circle(ox + center(c), oy + center(r), cellSize * (main ? 0.58 : 0.5));
    }
    cursor(HAND);
  } else {
    cursor(ARROW);
  }

  // active hint
  if (hintCell && hintTimeout > 0) {
    const [hr, hc] = hintCell.split(",").map(Number);
    const pulse = 1.0 + 0.15 * sin(frameCount * 0.15);
    noFill();
    stroke(...PAL.mint, 220);
    strokeWeight(2.5);
    circle(ox + center(hc), oy + center(hr), cellSize * 0.62 * pulse);
    hintTimeout--;
    if (hintTimeout <= 0) hintCell = null;
  }

  drawParticles();

  if (gameOver) {
    drawBoardOverlay(ox, oy, boardW, boardW, "Circuit aligned", "solved in " + totalMoves + (totalMoves === 1 ? " move" : " moves"), PAL.mint);
  }
}

function mousePressed() {
  if (gameOver || !mouseInCanvas()) return;
  const mx = mouseX - ox, my = mouseY - oy;
  if (mx < 0 || my < 0 || mx >= cellSize * SIZE || my >= cellSize * SIZE) return;
  pressCell(Math.floor(my / cellSize), Math.floor(mx / cellSize));
  return false;
}

function keyPressed() {
  if (key === "n" || key === "N") { newGame(); return false; }
  if (key === "u" || key === "U" || ((key === "z" || key === "Z") && (keyIsDown(CONTROL) || keyIsDown(91)))) { undo(); return false; }
  if (key === "h" || key === "H") { confirmHint(getHint); return false; }
}
