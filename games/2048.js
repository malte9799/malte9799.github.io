// 2048 — slide tiles to merge them, reach 2048
// Arrow keys / WASD / swipe to slide

initGame({
   title: "2048",
   tag: "merge tiles · reach 2048",
   presets: [
    { label: "4×4 (classic)", values: [4, 0] },
    { label: "5×5",           values: [5, 0] },
    { label: "6×6",           values: [6, 0] },
    { label: "4×4 (negative)", values: [4, 1] },
  ],
  buttons: [
    { id: "btn-new",  label: "New game", primary: true, onClick: () => newGame() },
    { id: "btn-undo", label: "Undo",                   onClick: () => undo() },
  ],
  sliders: [
    { id: "s-size", label: "Size", min: 3, max: 8, step: 1 },
  ],
  onPreset: ([n, cancel]) => { SIZE = n; cancelMode = cancel === 1; saveBest(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE }),
  info: { anim: infoAnim },
});

let grid = [];
let SIZE = 4;
let score = 0;
let best = 0;
let cancelMode = false; // negative tiles spawn; equal-magnitude +/- pairs annihilate on merge
let gameOver = false;
let won = false;
let wonAcked = false; // keep playing after win
let prevGrid = null;
let prevScore = 0;
let canUndo = false;
let prevAnim = []; // moves from the last move, for undo animation

// animation
let anim = []; // [{fromR,fromC,toR,toC,value,merged}]
let animT = 0;
let animUndo = false; // true = playing undo (tiles move from to→from)
const ANIM_DUR = 8; // frames

// tile color palette matching the site theme
const TILE_COLORS = {
  0:    [38, 35, 32],
  2:    [58, 54, 48],
  4:    [72, 66, 56],
  8:    [180, 110, 48],
  16:   [200, 90, 40],
  32:   [210, 70, 55],
  64:   [220, 50, 50],
  128:  [200, 170, 50],
  256:  [210, 180, 40],
  512:  [220, 190, 30],
  1024: [230, 200, 20],
  2048: [230, 180, 34],
};

// negative (cancel-mode) tiles share the board's bug-red accent, darkening
// with magnitude like the positive ramp does
const NEG_TILE_COLORS = {
  2:  [90, 40, 44],
  4:  [120, 42, 48],
  8:  [150, 44, 52],
  16: [180, 46, 56],
  32: [200, 50, 60],
};

function tileColor(v) {
  if (v < 0) return NEG_TILE_COLORS[-v] || [220, 50, 63];
  if (TILE_COLORS[v]) return TILE_COLORS[v];
  return [230, 180, 34]; // any higher value
}

function tileFg(v) {
  if (v < 0) return [243, 220, 222];
  return v <= 4 ? [155, 145, 130] : [243, 237, 224];
}

function makeGrid(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function cloneGrid(g) {
  return g.map(r => [...r]);
}

function addTile(g) {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (g[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const base = Math.random() < 0.9 ? 2 : 4;
  g[r][c] = cancelMode && Math.random() < 0.15 ? -base : base;
}

function newGame() {
  grid = makeGrid(SIZE);
  score = 0;
  gameOver = false;
  won = false;
  wonAcked = false;
  canUndo = false;
  prevGrid = null;
  prevAnim = [];
  addTile(grid);
  addTile(grid);
  anim = [];
  animT = 0;
  animUndo = false;
  updateStatus();
}

function updateStatus() {
  if (gameOver) {
    setStatus("game over · score " + score, "dead");
  } else if (won && !wonAcked) {
    setStatus("you reached 2048! · score " + score, "solved");
  } else {
    setStatus("score " + score + "  ·  best " + best, null);
  }
}

const CANCEL_BONUS = 10; // flat score award when a +/- pair annihilates

// Slide a single row left. Returns { row, gained, moved, groups } where
// groups describes how many of the filtered (non-zero) source tiles, in
// order, were consumed to produce each output slot — a group's `value` is
// null when an equal-magnitude +/- pair annihilated (0 output tiles).
function slideRow(row) {
  const src = row.filter(v => v !== 0);
  const groups = []; // { count, value } — value null = annihilated
  let gained = 0;
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = src[i + 1];
    if (b !== undefined && a === b) {
      gained += a * 2;
      groups.push({ count: 2, value: a * 2 });
      i++;
    } else if (b !== undefined && a === -b) {
      gained += CANCEL_BONUS;
      groups.push({ count: 2, value: null });
      i++;
    } else {
      groups.push({ count: 1, value: a });
    }
  }
  const r = groups.filter(gr => gr.value !== null).map(gr => gr.value);
  while (r.length < SIZE) r.push(0);
  const moved = r.some((v, i) => v !== row[i]);
  return { row: r, gained, moved, groups };
}

function transpose(g) {
  return g[0].map((_, c) => g.map(r => r[c]));
}

function rotateRight(g) {
  return g[0].map((_, c) => g.map(r => r[c]).reverse());
}

function move(dir) {
  // dir: "left"|"right"|"up"|"down"
  let g = cloneGrid(grid);
  let totalGained = 0;
  let anyMoved = false;

  // track tile movements for animation
  const moves = []; // {fromR, fromC, toR, toC, value, merged}

  function slideGridLeft(gg) {
    const next = makeGrid(SIZE);
    for (let r = 0; r < SIZE; r++) {
      const row = gg[r];
      const orig = [...row];
      // track positions
      let srcCols = [];
      orig.forEach((v, c) => { if (v !== 0) srcCols.push(c); });
      const { row: nr, gained, moved, groups } = slideRow(row);
      next[r] = nr;
      totalGained += gained;
      if (moved) anyMoved = true;

      // build animation entries for this row from the group list, which
      // records exactly how many source tiles fed each output (or vanished)
      let srcIdx = 0;
      let outC = 0;
      for (const gr of groups) {
        if (gr.value === null) {
          // annihilated pair — both tiles slide to meet at the midpoint
          // between their source columns, then fade out (no destination cell)
          const fromC1 = srcCols[srcIdx];
          const fromC2 = srcCols[srcIdx + 1];
          const midC = (fromC1 + fromC2) / 2;
          moves.push({ fromR: r, fromC: fromC1, toR: r, toC: midC, value: orig[fromC1], merged: false, vanish: true });
          moves.push({ fromR: r, fromC: fromC2, toR: r, toC: midC, value: orig[fromC2], merged: false, vanish: true });
          srcIdx += gr.count;
          continue;
        }
        const toC = outC++;
        const fromC1 = srcCols[srcIdx++];
        moves.push({ fromR: r, fromC: fromC1, toR: r, toC, value: gr.value, merged: false, vanish: false });
        if (gr.count === 2) {
          const fromC2 = srcCols[srcIdx++];
          moves.push({ fromR: r, fromC: fromC2, toR: r, toC, value: gr.value, merged: true, vanish: false });
        }
      }
    }
    return next;
  }

  let result;
  if (dir === "left") {
    result = slideGridLeft(g);
  } else if (dir === "right") {
    const flipped = g.map(r => [...r].reverse());
    const slid = slideGridLeft(flipped);
    result = slid.map(r => [...r].reverse());
    moves.forEach(m => { m.fromC = SIZE - 1 - m.fromC; m.toC = SIZE - 1 - m.toC; });
  } else if (dir === "up") {
    const t = transpose(g);
    const slid = slideGridLeft(t);
    result = transpose(slid);
    moves.forEach(m => { [m.fromR, m.fromC] = [m.fromC, m.fromR]; [m.toR, m.toC] = [m.toC, m.toR]; });
  } else { // down
    const t = transpose(g).map(r => [...r].reverse());
    const slid = slideGridLeft(t);
    const unrev = slid.map(r => [...r].reverse());
    result = transpose(unrev);
    // slide space (sr, sc) → original (r, c): r = SIZE-1-sc, c = sr
    moves.forEach(m => {
      const fR = SIZE - 1 - m.fromC, fC = m.fromR;
      const tR = SIZE - 1 - m.toC,   tC = m.toR;
      m.fromR = fR; m.fromC = fC;
      m.toR   = tR; m.toC   = tC;
    });
  }

  if (!anyMoved) return;

  prevGrid = cloneGrid(grid);
  prevScore = score;
  canUndo = true;

  grid = result;
  score += totalGained;
  if (score > best) best = score;

  anim = moves;
  prevAnim = moves;
  animT = 0;

  addTile(grid);

  if (!won && grid.some(r => r.some(v => v >= 2048))) {
    won = true;
  }

  if (!canContinue()) {
    gameOver = true;
  }

  saveBest();
  updateStatus();
}

function canContinue() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && (grid[r][c] === grid[r][c + 1] || grid[r][c] === -grid[r][c + 1])) return true;
      if (r + 1 < SIZE && (grid[r][c] === grid[r + 1][c] || grid[r][c] === -grid[r + 1][c])) return true;
    }
  return false;
}

function undo() {
  if (!canUndo || !prevGrid) return;
  // Restore state immediately; animation shows tiles sliding back
  grid = cloneGrid(prevGrid);
  score = prevScore;
  canUndo = false;
  prevGrid = null;
  gameOver = false;
  // Play prevAnim in reverse: from=toPos, to=fromPos, skip merged duplicates
  anim = prevAnim
    .filter(m => !m.merged)
    .map(m => ({ fromR: m.toR, fromC: m.toC, toR: m.fromR, toC: m.fromC, value: m.value, merged: false }));
  animUndo = true;
  animT = 0;
  prevAnim = [];
  updateStatus();
}

function saveBest() {
  try { localStorage.setItem("2048_best", String(best)); } catch {}
}

function loadBest() {
  try { const v = parseInt(localStorage.getItem("2048_best") || "0"); if (v > 0) best = v; } catch {}
}

// ---- touch swipe ----
let touchStartX = 0, touchStartY = 0;

function infoAnim(p, w, h, frame) {
  const N = 4;
  const pad = 8;
  const cs = Math.min((w - pad * 2) / N, (h - pad * 2) / N) * 0.92;
  const gap = 4;
  const bw = cs * N + gap * (N - 1);
  const bh = cs * N + gap * (N - 1);
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  // Short scripted demo: show a board, then slide left
  const PHASE_LEN = 50;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);
  const tf = (t % PHASE_LEN) / PHASE_LEN;

  const before = [
    [0, 2, 0, 2],
    [0, 0, 4, 4],
    [2, 0, 2, 0],
    [0, 0, 0, 8],
  ];
  const after = [
    [4, 0, 0, 0],
    [8, 0, 0, 0],
    [4, 0, 0, 0],
    [8, 0, 0, 0],
  ];

  p.background(28, 25, 22);

  const g = phase === 0 ? before : after;
  const caption = phase === 0 ? "Slide tiles with arrow keys or swipe." : "Matching tiles merge and double.";

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = ox + c * (cs + gap);
      const y = oy + r * (cs + gap);
      const v = g[r][c];
      const [tr, tg, tb] = tileColor(v);
      p.fill(tr, tg, tb);
      p.noStroke();
      p.rect(x, y, cs, cs, cs * 0.12);
      if (v > 0) {
        const [fr, fg, fb] = tileFg(v);
        p.fill(fr, fg, fb);
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        const ts = v >= 1000 ? cs * 0.28 : v >= 100 ? cs * 0.34 : cs * 0.42;
        p.textSize(ts);
        p.noStroke();
        p.text(v, x + cs / 2, y + cs / 2 + 1);
      }
    }
  }

  return { caption };
}

loadBest();

// ---- p5 ----

const CANVAS = 440;

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS);
  cnv.parent("canvas-wrap");
  newGame();
}

function draw() {
  background(20, 18, 15);

  // In fullscreen the canvas wrap is already positioned below the navbar,
  // so canvas coords start at 0,0 below it — no offset needed.
  const availW = width;
  const availH = height;

  const GAP = max(4, floor(min(availW, availH) * 0.012));
  const BOARD_PAD = GAP * 2;
  const maxBoardW = min(availW * 0.9, availH * 0.9, 520);
  const tileSize = floor((maxBoardW - BOARD_PAD * 2 - GAP * (SIZE - 1)) / SIZE);
  const boardW = tileSize * SIZE + GAP * (SIZE - 1) + BOARD_PAD * 2;
  const boardH = boardW;
  const ox = floor((availW - boardW) / 2);
  const oy = floor((availH - boardH) / 2);

  // board background
  fill(38, 35, 32);
  noStroke();
  rect(ox, oy, boardW, boardH, boardW * 0.03);

  // empty cells
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = ox + BOARD_PAD + c * (tileSize + GAP);
      const y = oy + BOARD_PAD + r * (tileSize + GAP);
      fill(28, 25, 22);
      noStroke();
      rect(x, y, tileSize, tileSize, tileSize * 0.1);
    }
  }

  // animation progress
  const t = animT < ANIM_DUR ? animT / ANIM_DUR : 1;
  const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  if (anim.length > 0 && animT < ANIM_DUR) {
    // Cells covered by an animation entry — skip drawing them statically
    const animCovered = new Set(anim.map(m => m.toR + "," + m.toC));

    // Draw static grid tiles not involved in the animation
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (animCovered.has(r + "," + c)) continue;
        const v = grid[r][c];
        if (v === 0) continue;
        const x = ox + BOARD_PAD + c * (tileSize + GAP);
        const y = oy + BOARD_PAD + r * (tileSize + GAP);
        drawTile(x, y, tileSize, v, 1);
      }
    }

    // draw vanishing tiles (annihilated +/- pairs), fading out as they meet
    for (const m of anim) {
      if (!m.vanish) continue;
      const fx = ox + BOARD_PAD + m.fromC * (tileSize + GAP);
      const fy = oy + BOARD_PAD + m.fromR * (tileSize + GAP);
      const tx2 = ox + BOARD_PAD + m.toC * (tileSize + GAP);
      const ty2 = oy + BOARD_PAD + m.toR * (tileSize + GAP);
      const x = lerp(fx, tx2, ease);
      const y = lerp(fy, ty2, ease);
      drawTile(x, y, tileSize, m.value, 1 - ease);
    }
    // draw animating tiles
    for (const m of anim) {
      if (m.merged || m.vanish) continue;
      const fx = ox + BOARD_PAD + m.fromC * (tileSize + GAP);
      const fy = oy + BOARD_PAD + m.fromR * (tileSize + GAP);
      const tx2 = ox + BOARD_PAD + m.toC * (tileSize + GAP);
      const ty2 = oy + BOARD_PAD + m.toR * (tileSize + GAP);
      const x = lerp(fx, tx2, ease);
      const y = lerp(fy, ty2, ease);

      // draw at pre-merge value (half of result)
      const dispVal = anim.find(n => n.toR === m.toR && n.toC === m.toC && n.merged) ? m.value / 2 : m.value;
      drawTile(x, y, tileSize, dispVal, 1);
    }
    // draw merging tiles moving toward target
    for (const m of anim) {
      if (!m.merged) continue;
      const fx = ox + BOARD_PAD + m.fromC * (tileSize + GAP);
      const fy = oy + BOARD_PAD + m.fromR * (tileSize + GAP);
      const tx2 = ox + BOARD_PAD + m.toC * (tileSize + GAP);
      const ty2 = oy + BOARD_PAD + m.toR * (tileSize + GAP);
      const x = lerp(fx, tx2, ease);
      const y = lerp(fy, ty2, ease);
      drawTile(x, y, tileSize, m.value / 2, 1);
    }
    animT++;
    if (animT >= ANIM_DUR) animUndo = false;
  } else {
    // draw static grid
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        const x = ox + BOARD_PAD + c * (tileSize + GAP);
        const y = oy + BOARD_PAD + r * (tileSize + GAP);
        drawTile(x, y, tileSize, v, 1);
      }
    }
    if (animT >= ANIM_DUR) anim = [];
  }

  // game over overlay
  if (gameOver) {
    fill(20, 18, 15, 190);
    rect(ox, oy, boardW, boardH, boardW * 0.03);
    fill(200, 50, 63);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(max(20, tileSize * 0.45));
    noStroke();
    text("GAME OVER", ox + boardW / 2, oy + boardH / 2 - tileSize * 0.25);
    fill(155, 145, 130);
    textSize(max(11, tileSize * 0.22));
    textStyle(NORMAL);
    text("press N for new game", ox + boardW / 2, oy + boardH / 2 + tileSize * 0.25);
  } else if (won && !wonAcked) {
    fill(20, 18, 15, 170);
    rect(ox, oy, boardW, boardH, boardW * 0.03);
    fill(230, 180, 34);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(max(20, tileSize * 0.45));
    noStroke();
    text("YOU WIN!", ox + boardW / 2, oy + boardH / 2 - tileSize * 0.25);
    fill(155, 145, 130);
    textSize(max(11, tileSize * 0.22));
    textStyle(NORMAL);
    text("press any key to keep playing", ox + boardW / 2, oy + boardH / 2 + tileSize * 0.25);
  }
}

function drawTile(x, y, sz, v, alpha) {
  const [tr, tg, tb] = tileColor(v);
  fill(tr, tg, tb, alpha * 255);
  noStroke();
  rect(x, y, sz, sz, sz * 0.1);
  if (v === 0) return;
  const [fr, fg, fb] = tileFg(v);
  fill(fr, fg, fb, alpha * 255);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  const ts = v >= 1000 ? sz * 0.28 : v >= 100 ? sz * 0.34 : v >= 10 ? sz * 0.42 : sz * 0.5;
  textSize(ts);
  noStroke();
  text(v, x + sz / 2, y + sz / 2 + sz * 0.02);
}

function keyPressed() {
  if (won && !wonAcked && keyCode !== 78) { wonAcked = true; updateStatus(); return false; }
  if (gameOver && keyCode === 78) { newGame(); return false; }
  if (gameOver) return;

  if (keyCode === LEFT_ARROW  || key === "a" || key === "A") { move("left");  return false; }
  if (keyCode === RIGHT_ARROW || key === "d" || key === "D") { move("right"); return false; }
  if (keyCode === UP_ARROW    || key === "w" || key === "W") { move("up");    return false; }
  if (keyCode === DOWN_ARROW  || key === "s" || key === "S") { move("down");  return false; }
  if (keyCode === 90 && (keyIsDown(91) || keyIsDown(17)))    { undo();        return false; }
  if (keyCode === 78) { newGame(); return false; }
}

function _overCanvas() {
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

function touchStarted() {
  if (!_overCanvas()) return;
  touchStartX = touches[0]?.x ?? mouseX;
  touchStartY = touches[0]?.y ?? mouseY;
  return false;
}

function touchEnded() {
  if (!_overCanvas()) return;
  const dx = (touches[0]?.x ?? mouseX) - touchStartX;
  const dy = (touches[0]?.y ?? mouseY) - touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 20) return false;
  if (won && !wonAcked) { wonAcked = true; updateStatus(); return false; }
  if (!gameOver) {
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }
  return false;
}
