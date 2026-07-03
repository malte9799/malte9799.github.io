// Minesweeper — clear every safe cell.
// Smooth spring-reveal animation, glowing neon numbers, and explosive particle sparks.

initGame({
  title: "Minesweeper",
  tag: "clear safe cells · animated",
  presets: [
    { label: "Medium (standard)", values: [12, 12, 22] },
    { label: "Easy",             values: [9,  9,  10] },
    { label: "Hard",             values: [14, 14, 38] },
    { label: "Harder",           values: [16, 16, 55] },
  ],
  buttons: [
    { id: "btn-reset", label: "Reset",      onClick: () => newGame() },
    { id: "btn-new",   label: "New puzzle", primary: true, onClick: () => newGame() },
    { id: "btn-flag",  label: "Flag mode",  onClick: () => { flagMode = !flagMode; setButtonActive("btn-flag", flagMode); } },
    { id: "btn-hint",  label: "Hint",       onClick: () => confirmHint(hintStep) },
  ],
  sliders: [
    { id: "s-cols",  label: "Columns", min: 6,  max: 20,  step: 1 },
    { id: "s-rows",  label: "Rows",    min: 6,  max: 20,  step: 1 },
    { id: "s-mines", label: "Mines",   min: 1,  max: 100, step: 1,
      fmt: (v) => { document.getElementById("v-s-mines")?.classList.toggle("bad", v / (cols * rows) > 0.28); return v; },
    },
  ],
  onPreset: ([c, r, m]) => { cols = c; rows = r; numMines = m; clamp(); saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-cols") cols = v; else if (id === "s-rows") rows = v; else numMines = v; },
  onClamp: clamp,
  getSliderValues: () => ({ "s-cols": cols, "s-rows": rows, "s-mines": numMines }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: "Numbers count the mines in the 8 cells around them. Open a safe area, flag the mines it pins down (right-click or Flag mode), and don't click a mine. Clicking a satisfied number opens its remaining neighbors.",
  },
});

let cols = 12;
let rows = 12;
let numMines = 22;

const NUM_COLORS = [
  null,
  [127, 176, 105],
  [230, 180, 34],
  [200, 50, 63],
  [150, 130, 200],
  [220, 120, 60],
  [90, 180, 190],
  [243, 237, 224],
  [155, 145, 130],
];

let grid = [];
let firstClick = true;
let dead = false;
let won = false;
let flagMode = false;

const CANVAS = 400;

function makeEmptyGrid() {
  grid = [];
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++)
      grid[i][j] = { 
        mine: false, 
        count: 0, 
        revealed: false, 
        flagged: false,
        revealTime: 0, // 0 to 1 for scale interpolation
        flagTime: 0    // 0 to 1 for flag placement animation
      };
  }
}

function inBounds(i, j) { return i >= 0 && i < cols && j >= 0 && j < rows; }

function neighbours(i, j) {
  const out = [];
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      if ((di || dj) && inBounds(i + di, j + dj)) out.push([i + di, j + dj]);
  return out;
}

function placeMines(safeI, safeJ) {
  const forbidden = new Set([safeI + "," + safeJ]);
  neighbours(safeI, safeJ).forEach(([ni, nj]) => forbidden.add(ni + "," + nj));
  const cells = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (!forbidden.has(i + "," + j)) cells.push([i, j]);
  for (let k = cells.length - 1; k > 0; k--) {
    const r = floor(random() * (k + 1));
    [cells[k], cells[r]] = [cells[r], cells[k]];
  }
  const count = Math.min(numMines, cells.length);
  for (let k = 0; k < count; k++) grid[cells[k][0]][cells[k][1]].mine = true;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (!grid[i][j].mine)
        grid[i][j].count = neighbours(i, j).filter(([ni, nj]) => grid[ni][nj].mine).length;
}

function floodReveal(i, j) {
  const stack = [[i, j]];
  while (stack.length) {
    const [ci, cj] = stack.pop();
    const c = grid[ci][cj];
    if (c.revealed || c.flagged) continue;
    c.revealed = true;
    c.revealTime = 0.05; // Trigger opening animation
    if (c.count === 0 && !c.mine)
      neighbours(ci, cj).forEach(([ni, nj]) => { if (!grid[ni][nj].revealed) stack.push([ni, nj]); });
  }
}

function cellCenter(i, j) {
  return { cx: (i + 0.5) * (width / cols), cy: (j + 0.5) * (height / rows) };
}

function triggerExplosion(i, j) {
  const { cx, cy } = cellCenter(i, j);
  // Big bomb explosion, mostly red with some gold
  spawnBurst(cx, cy, { count: 49, speed: [1.5, 7.5], life: [180, 255], size: [3, 8], col: [200, 50, 63], drag: 0.96 });
  spawnBurst(cx, cy, { count: 26, speed: [1.5, 7.5], life: [180, 255], size: [3, 8], col: [230, 180, 34], drag: 0.96 });
}

function spawnFlagDust(i, j) {
  const { cx, cy } = cellCenter(i, j);
  spawnBurst(cx, cy, { count: 12, speed: [1, 3] });
}

function revealCell(i, j) {
  const c = grid[i][j];
  if (c.revealed || c.flagged) return;
  if (firstClick) { placeMines(i, j); firstClick = false; }
  if (c.mine) {
    c.revealed = true;
    c.revealTime = 0.05;
    dead = true;
    
    // Trigger explosion at hit mine
    triggerExplosion(i, j);

    // Reveal other mines with slight delay animations
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        if (grid[x][y].mine && !grid[x][y].revealed) {
          grid[x][y].revealed = true;
          grid[x][y].revealTime = random(0.05, 0.4); // staggered animation
        }
      }
    }
    flashNote("boom — hit a mine");
    return;
  }
  floodReveal(i, j);
  checkWin();
}

function chord(i, j) {
  const c = grid[i][j];
  if (!c.revealed || c.count === 0) return;
  const nbrs = neighbours(i, j);
  if (nbrs.filter(([ni, nj]) => grid[ni][nj].flagged).length !== c.count) return;
  nbrs.forEach(([ni, nj]) => { if (!grid[ni][nj].flagged && !grid[ni][nj].revealed) revealCell(ni, nj); });
}

function checkWin() {
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (!grid[i][j].mine && !grid[i][j].revealed) return;
  won = true;
  // difficulty ~ mine density (the real driver of how hard a board is)
  const density = numMines / (cols * rows);
  celebrate(1 + Math.round(density / 0.28 * 2)); // 0 density -> 1, ~28% (max slider) -> 3
}

function minesLeft() {
  let flags = 0;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (grid[i][j].flagged) flags++;
  return numMines - flags;
}

function hintStep() {
  if (dead || won) { flashNote("game over — start a new puzzle"); return; }
  if (firstClick) { revealCell(floor(cols / 2), floor(rows / 2)); flashNote("opened a safe cell"); return; }
  const safe = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (!grid[i][j].mine && !grid[i][j].revealed && !grid[i][j].flagged) safe.push([i, j]);
  if (!safe.length) { flashNote("no safe cells to reveal"); return; }
  const [hi, hj] = safe[floor(random() * safe.length)];

  // Highlight the hint cell by spawning green particles around it
  const { cx, cy } = cellCenter(hi, hj);
  spawnBurst(cx, cy, { count: 8, speed: [0.1, 0.7], life: [180, 180], size: [2, 4], col: [127, 176, 105] });

  revealCell(hi, hj);
  flashNote("revealed a safe cell");
}

function clamp() {
  numMines = Math.max(1, Math.min(numMines, Math.max(1, cols * rows - 9)));
}

function saveState() {
  saveJSON("minesweeper_state", { cols, rows, numMines });
}

function loadState() {
  const d = loadJSON("minesweeper_state");
  if (typeof d.cols === "number") cols = d.cols;
  if (typeof d.rows === "number") rows = d.rows;
  if (typeof d.numMines === "number") numMines = d.numMines;
}

loadState();
clamp();
syncSliderUI();

function newGame() {
  makeEmptyGrid();
  firstClick = true;
  dead = false;
  won = false;
  flagMode = false;
  clearParticles();
  setButtonActive("btn-flag", false);
  resetHint();
  flashNote("");
}

// ---- info modal animation ----
// A scripted 5×5 mini-board walking through the three core moves: opening a
// flood-filled safe area, flagging the mines it reveals, then losing by
// clicking an unflagged mine next to an already-revealed square.

function infoAnim(p, w, h, frame) {
  const C = 5, R = 5;
  const pad = 14;
  const cs = Math.min((w - pad * 2) / C, (h - pad * 2) / R);
  const bw = cs * C, bh = cs * R;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  const PHASE_LEN = 65;
  const t = frame % (PHASE_LEN * 3);
  const phase = Math.floor(t / PHASE_LEN);

  // fixed board: 9 = mine, numbers = mine-adjacency count, 0 = open
  // layout (col,row), mines at all four corners:
  const MINE = 9;
  const board = [
    [MINE, 2, 1, 2, MINE],
    [2,    2, 1, 2, 2   ],
    [1,    1, 0, 1, 1   ],
    [2,    2, 1, 2, 2   ],
    [MINE, 2, 1, 2, MINE],
  ];

  // phase 0: only the flood-filled interior is revealed (the 0 and its
  // numbered border), corners still covered
  // phase 1: same reveal, plus the two top corners get flagged
  // phase 2: the bottom-left mine (unflagged) gets clicked and explodes
  const revealed = new Set();
  for (let c = 1; c <= 3; c++) for (let r = 1; r <= 3; r++) revealed.add(c + "," + r);

  const flagged = new Set();
  if (phase >= 1) { flagged.add("0,0"); flagged.add("4,0"); }

  const exploded = phase === 2 && t - PHASE_LEN * 2 > PHASE_LEN * 0.35;
  const clickPulse = phase === 2 && !exploded;

  p.background(20, 18, 15);
  p.noStroke();

  const NUM_COLORS = [null, [127,176,105],[230,180,34],[200,50,63],[150,130,200],[220,120,60],[90,180,190],[243,237,224],[155,145,130]];

  for (let c = 0; c < C; c++) {
    for (let r = 0; r < R; r++) {
      const x = ox + c * cs, y = oy + r * cs;
      const v = board[c][r];
      const key = c + "," + r;
      const isRevealed = revealed.has(key) || (exploded && c === 0 && r === 4);

      if (isRevealed) {
        if (v === MINE) {
          p.fill(200, 50, 63, 70); p.rect(x, y, cs, cs);
          p.fill(200, 50, 63); p.circle(x + cs/2, y + cs/2, cs * 0.5);
          p.fill(28, 25, 22); p.circle(x + cs/2, y + cs/2, cs * 0.2);
        } else {
          p.fill(30, 27, 23); p.rect(x, y, cs, cs);
          if (v > 0) {
            const col = NUM_COLORS[v];
            p.fill(col[0], col[1], col[2]);
            p.textAlign(p.CENTER, p.CENTER);
            p.textStyle(p.BOLD);
            p.textSize(cs * 0.48);
            p.text(v, x + cs/2, y + cs/2 + 1);
          }
        }
      } else {
        p.fill(38, 35, 32); p.rect(x, y, cs, cs);
        p.fill(56, 51, 45, 90); p.rect(x, y, cs, cs * 0.14);
        if (flagged.has(key)) {
          p.fill(230, 180, 34);
          const fr = cs * 0.16;
          p.rect(x + cs/2 - fr/2, y + cs/2 - fr/2, fr, fr, 2);
        }
      }
    }
  }

  // pulse ring on the cell about to be clicked
  if (clickPulse) {
    const cx = ox + 0.5 * cs, cy = oy + 4.5 * cs;
    const pulse = 1.0 + 0.15 * p.sin(frame * 0.3);
    p.noFill();
    p.stroke(243, 237, 224, 200);
    p.strokeWeight(2);
    p.circle(cx, cy, cs * 0.55 * pulse);
  }
}

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  document.getElementById("canvas-wrap").addEventListener("contextmenu", e => e.preventDefault());
  newGame();
}

function cellW() { return width / cols; }
function cellH() { return height / rows; }

function draw() {
  background(20, 18, 15);
  const cw = cellW(), ch = cellH();
  const fs = Math.min(cw, ch) * 0.52;

  // Grid background
  noStroke();
  fill(25, 23, 20);
  rect(0, 0, width, height);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const c = grid[i][j];
      const x = i * cw, y = j * ch;
      
      // Update cell scale animations
      if (c.revealed && c.revealTime < 1.0) {
        c.revealTime = Math.min(1.0, c.revealTime + 0.12);
      }
      if (c.flagged && c.flagTime < 1.0) {
        c.flagTime = Math.min(1.0, c.flagTime + 0.15);
      } else if (!c.flagged && c.flagTime > 0.0) {
        c.flagTime = Math.max(0.0, c.flagTime - 0.15);
      }

      if (c.revealed) {
        // Draw open cell base
        fill(30, 27, 23); noStroke(); rect(x, y, cw, ch);
        
        // Push transformation matrix to scale the cell contents on reveal
        push();
        translate(x + cw/2, y + ch/2);
        scale(c.revealTime);

        if (c.mine) {
          fill(200, 50, 63, 70); noStroke(); rect(-cw/2, -ch/2, cw, ch);
          fill(200, 50, 63); circle(0, 0, Math.min(cw, ch) * 0.52);
          // Dark center
          fill(28, 25, 22); circle(0, 0, Math.min(cw, ch) * 0.2);
        } else {
          if (c.count > 0) {
            const col = NUM_COLORS[c.count];
            
            // Neon Glow effect: render duplicate text below
            fill(col[0], col[1], col[2], 30);
            textSize(fs * 1.08);
            text(c.count, 0, 1);
            
            fill(col[0], col[1], col[2]);
            textSize(fs);
            text(c.count, 0, 1);
          }
        }
        pop();
      } else {
        // Draw covered cell base
        fill(38, 35, 32); noStroke(); rect(x, y, cw, ch);
        // Beveled light top highlight
        fill(56, 51, 45, 90); rect(x, y, cw, ch * 0.14);

        if (c.flagTime > 0.0) {
          push();
          translate(x + cw/2, y + ch/2);
          scale(c.flagTime);
          
          // Draw flag
          fill(230, 180, 34);
          const r = Math.min(cw, ch) * 0.18;
          rect(-r/2, -r/2, r, r, 2);
          pop();
        }
      }
    }
  }

  // Draw grid lines
  stroke(58, 53, 46); strokeWeight(1);
  for (let g = 0; g <= cols; g++) line(g * cw, 0, g * cw, height);
  for (let g = 0; g <= rows; g++) line(0, g * ch, width, g * ch);

  drawParticles();

  // Game over state
  if (won) setStatus("solved — field swept clean", "solved");
  else if (dead) setStatus("lost — reset to try again", "dead");
  else setStatus(minesLeft() + " mines left · " + (flagMode ? "flag mode" : "dig mode"), null);
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (dead || won) { flashNote("game over — start a new puzzle"); return; }
  const i = Math.floor(mouseX / cellW());
  const j = Math.floor(mouseY / cellH());
  if (!inBounds(i, j)) return;
  
  if (mouseButton === RIGHT) {
    if (!grid[i][j].revealed) {
      grid[i][j].flagged = !grid[i][j].flagged;
      if (grid[i][j].flagged) spawnFlagDust(i, j);
    }
    return false;
  }
  if (flagMode) {
    if (!grid[i][j].revealed) {
      grid[i][j].flagged = !grid[i][j].flagged;
      if (grid[i][j].flagged) spawnFlagDust(i, j);
    }
    return;
  }
  if (grid[i][j].revealed) chord(i, j); else revealCell(i, j);
}

function keyPressed() {
  if (key === " ") {
    if (dead || won) { newGame(); return; }
    flagMode = !flagMode;
    setButtonActive("btn-flag", flagMode);
  } else if (key === "f" || key === "F") {
    flagMode = !flagMode;
    setButtonActive("btn-flag", flagMode);
  }
}
