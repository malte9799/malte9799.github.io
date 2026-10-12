// Minesweeper — clear every safe cell.
// The first click is always safe (mines are placed after it, never next to it).

initGame({
  title: "Minesweeper",
  tag: "clear every safe cell",
  presets: [
    { label: "Medium (standard)", values: [12, 12, 22] },
    { label: "Easy",             values: [9,  9,  10] },
    { label: "Hard",             values: [14, 14, 38] },
    { label: "Harder",           values: [16, 16, 55] },
  ],
  buttons: [
    { id: "btn-new",   label: "New game",  primary: true, onClick: () => newGame() },
    { id: "btn-flag",  label: "Flag mode", onClick: () => toggleFlagMode() },
    { id: "btn-hint",  label: "Hint",      onClick: () => confirmHint(hintStep) },
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
    text: [
      "Numbers count the mines in the 8 cells around them. Open a safe area, flag the mines it pins down, and don't click a mine. Your first click is always safe.",
      "Right-click (or Flag mode / F on touch screens) places a flag. Clicking a number whose flags are all placed opens its remaining neighbours. Keys: N new game · F flag mode.",
    ],
  },
});

let cols = 12;
let rows = 12;
let numMines = 22;

const NUM_COLORS = [null, PAL.sky, PAL.mint, PAL.rose, PAL.lilac, PAL.peach, PAL.aqua, PAL.ink, PAL.muted];

let grid = [];
let firstClick = true;
let dead = false;
let won = false;
let flagMode = false;
let startMs = 0, endMs = 0;   // timer runs from the first click to win/loss
let boom = null;              // { i, j } — the mine that went off

const CANVAS = 440;
const PAD = 10;
let cs = 30;                  // cell size in px, set by layout()

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
  return { cx: PAD + (i + 0.5) * cs, cy: PAD + (j + 0.5) * cs };
}

function triggerExplosion(i, j) {
  const { cx, cy } = cellCenter(i, j);
  // Big bomb explosion, mostly red with some gold
  spawnBurst(cx, cy, { count: 49, speed: [1.5, 7.5], life: [180, 255], size: [3, 8], col: PAL.rose, drag: 0.96 });
  spawnBurst(cx, cy, { count: 26, speed: [1.5, 7.5], life: [180, 255], size: [3, 8], col: PAL.sun, drag: 0.96 });
}

function spawnFlagDust(i, j) {
  const { cx, cy } = cellCenter(i, j);
  spawnBurst(cx, cy, { count: 12, speed: [1, 3], col: PAL.rose });
}

function revealCell(i, j) {
  const c = grid[i][j];
  if (c.revealed || c.flagged) return;
  if (firstClick) { placeMines(i, j); firstClick = false; startMs = millis(); }
  if (c.mine) {
    c.revealed = true;
    c.revealTime = 0.05;
    dead = true;
    boom = { i, j };
    endMs = millis();
    
    // Trigger explosion at hit mine
    triggerExplosion(i, j);

    // Reveal other mines with slight delay animations
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        if (grid[x][y].mine && !grid[x][y].revealed) {
          grid[x][y].revealed = true;
          grid[x][y].revealTime = -dist(x, y, i, j) * 0.12; // ripple outwards from the blast
        }
      }
    }
    flashNote("Boom — that was a mine.");
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
  endMs = millis();
  // auto-flag the remaining mines
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      if (grid[i][j].mine) grid[i][j].flagged = true;
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
  if (dead || won) { flashNote("Game over — start a new one."); return; }
  if (firstClick) { revealCell(floor(cols / 2), floor(rows / 2)); flashNote("Opened a safe cell."); return; }
  // prefer safe cells on the edge of the opened area — those are the ones a
  // player is actually stuck on
  const safe = [], frontier = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const c = grid[i][j];
      if (c.mine || c.revealed || c.flagged) continue;
      safe.push([i, j]);
      if (neighbours(i, j).some(([ni, nj]) => grid[ni][nj].revealed)) frontier.push([i, j]);
    }
  const pool = frontier.length ? frontier : safe;
  if (!pool.length) { flashNote("No safe cells left to open."); return; }
  const [hi, hj] = pool[floor(random() * pool.length)];
  const { cx, cy } = cellCenter(hi, hj);
  spawnBurst(cx, cy, { count: 10, speed: [0.3, 1.2], life: [180, 220], size: [2, 4], col: PAL.mint });
  revealCell(hi, hj);
  flashNote("Opened a safe cell.");
}

function toggleFlagMode() {
  flagMode = !flagMode;
  setButtonActive("btn-flag", flagMode);
}

function clamp() {
  numMines = Math.max(1, Math.min(numMines, Math.max(1, cols * rows - 9)));
}

function saveState() {
  saveSettings("minesweeper_state", { cols, rows, numMines });
}

function loadState() {
  const d = loadSettings("minesweeper_state");
  if (typeof d.cols === "number") cols = d.cols;
  if (typeof d.rows === "number") rows = d.rows;
  if (typeof d.numMines === "number") numMines = d.numMines;
}

loadState();
clamp();
syncSliderUI();

function layout() {
  cs = Math.floor((CANVAS - PAD * 2) / Math.max(cols, rows));
  const w = cols * cs + PAD * 2, h = rows * cs + PAD * 2;
  if (width !== w || height !== h) resizeCanvas(w, h);
}

function newGame() {
  makeEmptyGrid();
  if (typeof width === "number") layout();
  firstClick = true;
  dead = false;
  won = false;
  boom = null;
  startMs = endMs = 0;
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

  p.background(...PAL.board);
  p.noStroke();

  for (let c = 0; c < C; c++) {
    for (let r = 0; r < R; r++) {
      const x = ox + c * cs, y = oy + r * cs;
      const v = board[c][r];
      const key = c + "," + r;
      const isRevealed = revealed.has(key) || (exploded && c === 0 && r === 4);

      if (isRevealed) {
        drawOpenTile(p, x, y, cs, v === MINE ? -1 : v, v === MINE);
        if (v === MINE) drawMine(p, x + cs / 2, y + cs / 2, cs, 1);
      } else {
        drawCoveredTile(p, x, y, cs, false);
        if (flagged.has(key)) drawFlag(p, x + cs / 2, y + cs / 2, cs, 1);
      }
    }
  }

  // pulse ring on the cell about to be clicked
  if (clickPulse) {
    const cx = ox + 0.5 * cs, cy = oy + 4.5 * cs;
    const pulse = 1.0 + 0.15 * p.sin(frame * 0.3);
    p.noFill();
    p.stroke(...PAL.lilac, 230);
    p.strokeWeight(2);
    p.circle(cx, cy, cs * 0.6 * pulse);
  }
}

// ---- tile drawing (shared by the game and the info demo) ----

function drawCoveredTile(p, x, y, size, hover) {
  const g = Math.max(1, size * 0.06), r = size * 0.18;
  p.noStroke();
  p.fill(...(hover ? PAL.panelHi : PAL.panel));
  p.rect(x + g / 2, y + g / 2, size - g, size - g, r);
  p.fill(255, 255, 255, hover ? 18 : 10);
  p.rect(x + g / 2, y + g / 2, size - g, (size - g) * 0.45, r, r, 0, 0);
}

// count: -1 for a mine cell, 0 for blank, 1-8 for a number
function drawOpenTile(p, x, y, size, count, blast) {
  const g = Math.max(1, size * 0.06), r = size * 0.18;
  p.noStroke();
  p.fill(...(blast ? [...PAL.rose, 90] : PAL.well));
  p.rect(x + g / 2, y + g / 2, size - g, size - g, r);
  if (count > 0) {
    const col = NUM_COLORS[count];
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(size * 0.56);
    p.fill(col[0], col[1], col[2]);
    p.text(count, x + size / 2, y + size / 2 + size * 0.02);
  }
}

function drawMine(p, cx, cy, size, k) {
  const d = size * 0.44 * k;
  p.stroke(...PAL.mineHi);
  p.strokeWeight(Math.max(1.2, size * 0.07));
  p.strokeCap(p.ROUND);
  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 4;
    p.line(cx - Math.cos(ang) * d * 0.78, cy - Math.sin(ang) * d * 0.78, cx + Math.cos(ang) * d * 0.78, cy + Math.sin(ang) * d * 0.78);
  }
  p.noStroke();
  p.fill(...PAL.mine);
  p.circle(cx, cy, d);
  p.fill(255, 255, 255, 190);
  p.circle(cx - d * 0.17, cy - d * 0.17, d * 0.26);
}

function drawFlag(p, cx, cy, size, k) {
  const s = size * k;
  p.stroke(...PAL.ink, 220);
  p.strokeWeight(Math.max(1.2, s * 0.06));
  p.line(cx - s * 0.12, cy - s * 0.26, cx - s * 0.12, cy + s * 0.24);
  p.noStroke();
  p.fill(...PAL.rose);
  p.triangle(cx - s * 0.1, cy - s * 0.27, cx + s * 0.24, cy - s * 0.13, cx - s * 0.1, cy + s * 0.02);
  p.fill(...PAL.ink, 120);
  p.rect(cx - s * 0.22, cy + s * 0.22, s * 0.22, s * 0.05, 2);
}

function fmtTime(ms) {
  const sec = Math.floor(ms / 1000);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  document.getElementById("canvas-wrap").addEventListener("contextmenu", e => e.preventDefault());
  newGame();
}

function cellAt(mx, my) {
  const i = Math.floor((mx - PAD) / cs), j = Math.floor((my - PAD) / cs);
  return mx >= PAD && my >= PAD && inBounds(i, j) ? [i, j] : null;
}

function draw() {
  background(...PAL.board);
  const over = dead || won;
  const hv = !over && mouseX >= 0 && mouseY >= 0 && mouseX < width && mouseY < height ? cellAt(mouseX, mouseY) : null;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const c = grid[i][j];
      const x = PAD + i * cs, y = PAD + j * cs;

      if (c.revealed && c.revealTime < 1.0) c.revealTime = Math.min(1.0, c.revealTime + 0.12);
      if (c.flagged && c.flagTime < 1.0) c.flagTime = Math.min(1.0, c.flagTime + 0.15);
      else if (!c.flagged && c.flagTime > 0.0) c.flagTime = Math.max(0.0, c.flagTime - 0.15);

      if (c.revealed && c.revealTime > 0) {
        const k = easeOutBack(c.revealTime);
        if (c.mine) {
          drawOpenTile(window, x, y, cs, -1, boom && boom.i === i && boom.j === j);
          if (c.flagged) drawFlag(window, x + cs / 2, y + cs / 2, cs, 1);
          else drawMine(window, x + cs / 2, y + cs / 2, cs, k);
        } else {
          drawOpenTile(window, x, y, cs, 0, false);
          if (c.count > 0) {
            push();
            translate(x + cs / 2, y + cs / 2);
            scale(k);
            drawOpenTile(window, -cs / 2, -cs / 2, cs, c.count, false);
            pop();
          }
        }
      } else {
        drawCoveredTile(window, x, y, cs, hv && hv[0] === i && hv[1] === j);
        if (c.flagTime > 0.0) drawFlag(window, x + cs / 2, y + cs / 2, cs, easeOutBack(c.flagTime));
        // a wrong flag after a loss gets crossed out
        if (dead && c.flagged && !c.mine) {
          stroke(...PAL.ink); strokeWeight(Math.max(1.5, cs * 0.07));
          line(x + cs * 0.22, y + cs * 0.22, x + cs * 0.78, y + cs * 0.78);
          line(x + cs * 0.78, y + cs * 0.22, x + cs * 0.22, y + cs * 0.78);
          noStroke();
        }
      }
    }
  }

  cursor(hv ? HAND : ARROW);
  drawParticles();

  const t = fmtTime((endMs || (startMs ? millis() : 0)) - startMs);
  if (won) {
    setStatus("swept clean in " + t, "solved");
    drawBoardOverlay(PAD, PAD, cols * cs, rows * cs, "Cleared!", t + " · " + numMines + " mines", PAL.mint);
  } else if (dead) {
    setStatus("boom — " + t, "dead");
  } else {
    setStatus(minesLeft() + " mines left · " + t + (flagMode ? " · flag mode" : ""), null);
  }
}

function easeOutBack(t) {
  if (t <= 0) return 0;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function toggleFlag(i, j) {
  const c = grid[i][j];
  if (c.revealed) return;
  c.flagged = !c.flagged;
  if (c.flagged) spawnFlagDust(i, j);
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (dead || won) return;
  const hit = cellAt(mouseX, mouseY);
  if (!hit) return;
  const [i, j] = hit;

  if (mouseButton === RIGHT || (flagMode && !grid[i][j].revealed)) {
    if (grid[i][j].revealed) chord(i, j);
    else toggleFlag(i, j);
    return false;
  }
  if (grid[i][j].revealed) chord(i, j); else revealCell(i, j);
  return false;
}

function keyPressed() {
  if (key === "n" || key === "N") { newGame(); return false; }
  if (key === "f" || key === "F") { toggleFlagMode(); return false; }
  if (key === " ") {
    if (dead || won) newGame(); else toggleFlagMode();
    return false;
  }
}
