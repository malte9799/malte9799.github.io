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
  info: { anim: infoAnim },
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

// Particle sparks array for toggle feedback
let particles = [];

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
  particles = [];
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
  spawnSparks(cx, cy);

  // Clear active hint
  hintCell = null;
  hintTimeout = 0;

  if (checkSolved()) {
    gameOver = true;
    solutionSet.clear();
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

// Particle system helper
function spawnSparks(x, y) {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1.5;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 255,
      size: Math.random() * 4 + 2
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= 8;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Info helper animation (showing adjacent nodes toggling)
function infoAnim(p, w, h, frame) {
  const N = 3;
  const pad = 12;
  const cs = Math.min((w - pad * 2) / N, (h - pad * 2) / N) * 0.85;
  const bw = cs * N;
  const bh = cs * N;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  const PHASE_LEN = 60;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);

  p.background(20, 18, 15);

  // Connection wire states in demo:
  // Phase 0: UP and LEFT are ON, others are OFF.
  // Phase 1: Center clicked, toggling UP -> OFF, LEFT -> OFF, others (CENTER, RIGHT, DOWN) -> ON.
  const getState = (cr, cc) => {
    let valSelf = false;
    let valUp = true;
    let valDown = false;
    let valLeft = true;
    let valRight = false;
    if (phase === 1) {
      valSelf = true;
      valUp = false;
      valDown = true;
      valLeft = false;
      valRight = true;
    }
    if (cr === 1 && cc === 1) return valSelf;
    if (cr === 0 && cc === 1) return valUp;
    if (cr === 2 && cc === 1) return valDown;
    if (cr === 1 && cc === 0) return valLeft;
    if (cr === 1 && cc === 2) return valRight;
    return false;
  };

  // Draw wire paths
  p.strokeWeight(2.5);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = ox + c * cs + cs / 2;
      const cy = oy + r * cs + cs / 2;

      if (c < N - 1) {
        const ncx = cx + cs;
        if (getState(r, c) && getState(r, c + 1)) {
          p.stroke(230, 180, 34, 180);
        } else {
          p.stroke(58, 53, 46);
        }
        p.line(cx, cy, ncx, cy);
      }
      if (r < N - 1) {
        const ncy = cy + cs;
        if (getState(r, c) && getState(r + 1, c)) {
          p.stroke(230, 180, 34, 180);
        } else {
          p.stroke(58, 53, 46);
        }
        p.line(cx, cy, cx, ncy);
      }
    }
  }

  // Draw nodes
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = ox + c * cs + cs / 2;
      const cy = oy + r * cs + cs / 2;
      const val = getState(r, c);

      if (val) {
        p.noStroke();
        p.fill(230, 180, 34, 25);
        p.circle(cx, cy, cs * 0.7);
        p.fill(230, 180, 34, 60);
        p.circle(cx, cy, cs * 0.5);
        p.fill(243, 237, 224);
        p.circle(cx, cy, cs * 0.3);
      } else {
        p.fill(38, 35, 32);
        p.stroke(58, 53, 46);
        p.strokeWeight(1.5);
        p.circle(cx, cy, cs * 0.35);
        p.noStroke();
        p.fill(28, 25, 22);
        p.circle(cx, cy, cs * 0.15);
      }

      // Display click/hover cursor overlay at center
      if (r === 1 && c === 1) {
        p.noFill();
        if (phase === 0) {
          p.stroke(155, 145, 130, 150);
          p.strokeWeight(1.5);
          p.circle(cx, cy, cs * 0.5);
        } else {
          p.stroke(230, 180, 34, 200);
          p.strokeWeight(2);
          p.circle(cx, cy, cs * 0.55);
        }
      }
    }
  }

  const caption = phase === 0 
    ? "Clicking a node..." 
    : "...toggles itself and its four neighbors.";

  return { caption };
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

  // Draw particle system
  updateParticles();
  for (const p of particles) {
    fill(230, 180, 34, p.life);
    noStroke();
    circle(p.x, p.y, p.size * (p.life / 255));
  }

  // Game over solved overlay
  if (gameOver) {
    fill(20, 18, 15, 195);
    noStroke();
    rect(ox - 10, oy - 10, boardW + 20, boardW + 20, 14);

    fill(127, 176, 105);
    textAlign(CENTER, CENTER);
    textSize(24);
    textStyle(BOLD);
    text("CIRCUIT ALIGNED", ox + boardW / 2, oy + boardW / 2 - 16);

    fill(155, 145, 130);
    textSize(14);
    textStyle(NORMAL);
    text("Solved in " + totalMoves + " moves", ox + boardW / 2, oy + boardW / 2 + 16);
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
