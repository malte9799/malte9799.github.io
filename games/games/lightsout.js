// Circuit Align (Lights Out) — toggle nodes to turn off all glowing lines.
// Clicking a node toggles itself and its four neighbors.

initGame({
  title: "Circuit Align",
  tag: "restore the grid lines",
  presets: [
    { label: "5×5 (standard)", values: [5] },
    { label: "3×3 (easy)",     values: [3] },
    { label: "7×7 (hard)",     values: [7] },
  ],
  buttons: [
    { id: "btn-reset", label: "Reset", primary: true, onClick: () => newGame() },
    { id: "btn-undo",  label: "Undo",                  onClick: () => undo() },
    { id: "btn-hint",  label: "Hint",                  onClick: () => confirmHint(getHint) },
  ],
  sliders: [
    { id: "s-size", label: "Size", min: 3, max: 9, step: 1 },
  ],
  onPreset: ([n]) => { SIZE = n; newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: "Clicking a node toggles it and its four direct neighbors. Wires glow between two lit nodes. Turn every light off in as few moves as you can — every board is generated from legal moves, so it's always solvable.",
  },
});

let SIZE = 5;
let grid = []; // 2D array of booleans (true = ON, false = OFF)
let solutionSet = new Set(); // Set of "r,c" coordinates of the solution moves remaining
let totalMoves = 0;
let gameOver = false;
let prevGrid = null;
let prevSolutionSet = null;
let prevMoves = 0;
let hintCell = null;
let hintTimeout = 0;

// Layout offsets
let cellSize = 0;
let ox = 0, oy = 0;

function makeGrid(n) {
  return Array.from({ length: n }, () => Array(n).fill(false));
}

function cloneGrid(g) {
  return g.map(r => [...r]);
}

function toggleNode(r, c) {
  const dirs = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      grid[nr][nc] = !grid[nr][nc];
    }
  }
}

function solveStep(r, c) {
  const key = r + "," + c;
  if (solutionSet.has(key)) {
    solutionSet.delete(key);
  } else {
    solutionSet.add(key);
  }
}

function newGame() {
  grid = makeGrid(SIZE);
  solutionSet.clear();
  totalMoves = 0;
  gameOver = false;
  prevGrid = null;
  prevSolutionSet = null;
  prevMoves = 0;
  hintCell = null;
  hintTimeout = 0;
  clearParticles();
  resetHint();

  // Shuffle intensity based on grid size
  const shuffleMoves = SIZE === 3 ? 5 : SIZE === 5 ? 10 : SIZE === 7 ? 18 : 25;

  // Make random legal moves to ensure solvability
  let attempts = 0;
  while (attempts < 10) {
    grid = makeGrid(SIZE);
    solutionSet.clear();

    for (let i = 0; i < shuffleMoves; i++) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      toggleNode(r, c);
      solveStep(r, c);
    }

    // Ensure we don't start with an already solved board
    let onCount = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c]) onCount++;
      }
    }
    if (onCount > 0) break;
    attempts++;
  }

  updateStatus();
}

function checkSolved() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c]) return false;
    }
  }
  return true;
}

function updateStatus() {
  if (gameOver) {
    setStatus("circuit restored in " + totalMoves + " moves!", "solved");
  } else {
    setStatus("moves: " + totalMoves, null);
  }
}

function pressCell(r, c) {
  if (gameOver) return;

  // Save state for undo
  prevGrid = cloneGrid(grid);
  prevSolutionSet = new Set(solutionSet);
  prevMoves = totalMoves;

  toggleNode(r, c);
  solveStep(r, c);
  totalMoves++;

  // Spawn visual particle sparks
  const cx = ox + c * cellSize + cellSize / 2;
  const cy = oy + r * cellSize + cellSize / 2;
  spawnBurst(cx, cy, { count: 12, speed: [1.5, 4.5], life: [255, 255], size: [2, 6], drag: 0.95, decay: 8 });

  // Clear active hint
  hintCell = null;
  hintTimeout = 0;

  if (checkSolved()) {
    gameOver = true;
    solutionSet.clear();
    // difficulty ~ grid size (slider: 3-9)
    celebrate(1 + Math.round((SIZE - 3) / (9 - 3) * 2));
  }

  updateStatus();
}

function undo() {
  if (gameOver || !prevGrid) {
    flashNote("Nothing to undo!");
    return;
  }
  grid = prevGrid;
  solutionSet = prevSolutionSet;
  totalMoves = prevMoves;
  prevGrid = null;
  prevSolutionSet = null;
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
  hintTimeout = 120; // Pulsing ring for 2 seconds (120 frames)
  flashNote("Look for the pulsing green outline.");
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

  p.background(20, 18, 15);

  // wires
  p.strokeWeight(2.5);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = ox + c * cs + cs / 2;
      const cy = oy + r * cs + cs / 2;
      if (c < N - 1) {
        p.stroke(...(state(r, c) && state(r, c + 1) ? [230, 180, 34, 180] : [58, 53, 46]));
        p.line(cx, cy, cx + cs, cy);
      }
      if (r < N - 1) {
        p.stroke(...(state(r, c) && state(r + 1, c) ? [230, 180, 34, 180] : [58, 53, 46]));
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
        p.noStroke();
        p.fill(230, 180, 34, 25);
        p.circle(cx, cy, cs * 0.7 * scale);
        p.fill(230, 180, 34, 60);
        p.circle(cx, cy, cs * 0.5 * scale);
        p.fill(243, 237, 224);
        p.circle(cx, cy, cs * 0.3 * scale);
      } else {
        p.fill(38, 35, 32);
        p.stroke(58, 53, 46);
        p.strokeWeight(1.5);
        p.circle(cx, cy, cs * 0.35 * scale);
        p.noStroke();
        p.fill(28, 25, 22);
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
      p.stroke(243, 237, 224, 200);
      p.strokeWeight(2);
      p.circle(ccx, ccy, cs * 0.5 * pulse);
    } else if (sinceClick < PHASE_LEN * 0.4) {
      // expanding shockwave ring after the click
      const st = sinceClick / (PHASE_LEN * 0.4);
      p.noFill();
      p.stroke(127, 176, 105, 200 * (1 - st));
      p.strokeWeight(2);
      p.circle(ccx, ccy, cs * (0.4 + st * 2.4));
    }
  } else {
    // solved hold: soft green glow ring around the dark board
    p.noFill();
    p.stroke(127, 176, 105, 90 + 50 * p.sin(frame * 0.15));
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

function draw() {
  background(20, 18, 15);

  const availW = width;
  const availH = height;

  const maxBoardW = min(availW * 0.9, availH * 0.9, 420);
  cellSize = floor(maxBoardW / SIZE);
  const boardW = cellSize * SIZE;

  ox = floor((availW - boardW) / 2);
  oy = floor((availH - boardW) / 2);

  // Wires (connections)
  strokeWeight(3);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cx = ox + c * cellSize + cellSize / 2;
      const cy = oy + r * cellSize + cellSize / 2;

      // Draw wire to right neighbor
      if (c < SIZE - 1) {
        const ncx = cx + cellSize;
        if (grid[r][c] && grid[r][c + 1]) {
          stroke(230, 180, 34, 180);
        } else {
          stroke(58, 53, 46);
        }
        line(cx, cy, ncx, cy);
      }

      // Draw wire to bottom neighbor
      if (r < SIZE - 1) {
        const ncy = cy + cellSize;
        if (grid[r][c] && grid[r + 1][c]) {
          stroke(230, 180, 34, 180);
        } else {
          stroke(58, 53, 46);
        }
        line(cx, cy, cx, ncy);
      }
    }
  }

  // Nodes
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cx = ox + c * cellSize + cellSize / 2;
      const cy = oy + r * cellSize + cellSize / 2;
      const val = grid[r][c];

      if (val) {
        noStroke();
        fill(230, 180, 34, 25);
        circle(cx, cy, cellSize * 0.7);
        fill(230, 180, 34, 60);
        circle(cx, cy, cellSize * 0.5);
        fill(243, 237, 224);
        circle(cx, cy, cellSize * 0.3);
      } else {
        fill(38, 35, 32);
        stroke(58, 53, 46);
        strokeWeight(2);
        circle(cx, cy, cellSize * 0.35);
        
        noStroke();
        fill(28, 25, 22);
        circle(cx, cy, cellSize * 0.15);
      }
    }
  }

  // Hover feedback
  if (!gameOver && mouseX >= ox && mouseX < ox + boardW && mouseY >= oy && mouseY < oy + boardW) {
    const c = Math.floor((mouseX - ox) / cellSize);
    const r = Math.floor((mouseY - oy) / cellSize);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const cx = ox + c * cellSize + cellSize / 2;
      const cy = oy + r * cellSize + cellSize / 2;
      noFill();
      stroke(155, 145, 130, 100);
      strokeWeight(1.5);
      circle(cx, cy, cellSize * 0.45);
    }
  }

  // Draw active hint indicator
  if (hintCell && hintTimeout > 0) {
    const parts = hintCell.split(",");
    const hr = parseInt(parts[0]);
    const hc = parseInt(parts[1]);
    const cx = ox + hc * cellSize + cellSize / 2;
    const cy = oy + hr * cellSize + cellSize / 2;

    const pulse = 1.0 + 0.15 * sin(frameCount * 0.15);
    noFill();
    stroke(127, 176, 105, 180);
    strokeWeight(2);
    circle(cx, cy, cellSize * 0.45 * pulse);
    hintTimeout--;
    if (hintTimeout <= 0) hintCell = null;
  }

  drawParticles();

  // Game over solved overlay
  if (gameOver) {
    drawBoardOverlay(ox, oy, boardW, boardW, "CIRCUIT ALIGNED", "Solved in " + totalMoves + " moves", [127, 176, 105]);
  }
}

function mousePressed() {
  if (gameOver) return;

  const mx = mouseX - ox;
  const my = mouseY - oy;

  if (mx >= 0 && mx < cellSize * SIZE && my >= 0 && my < cellSize * SIZE) {
    const c = Math.floor(mx / cellSize);
    const r = Math.floor(my / cellSize);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      pressCell(r, c);
    }
  }
}
