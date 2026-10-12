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
    { id: "s-size", label: "Size", min: 3, max: 8, step: 1, fmt: v => v + "×" + v },
    { id: "s-neg",  label: "Negative tiles", min: 0, max: 1, step: 1, fmt: v => (v ? "on" : "off") },
  ],
  onPreset: ([n, cancel]) => { SIZE = n; cancelMode = cancel === 1; saveSettings("2048_state", { SIZE, cancelMode }); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; else cancelMode = v === 1; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE, "s-neg": cancelMode ? 1 : 0 }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Arrow keys, WASD or swipes slide every tile as far as it goes; equal tiles that collide merge into their sum, and a new tile spawns each move. Keep your biggest tile parked in a corner and build toward 2048.",
      "Negative mode: red −tiles cancel out a matching +tile for a small bonus. Keys: U / Ctrl+Z undo · N new game.",
    ],
  },
});

let grid = [];
let SIZE = 4;
let score = 0;
let best = 0;
let cancelMode = false; // negative tiles spawn; equal-magnitude +/- pairs annihilate on merge
let gameOver = false;
let won = false;
let wonAcked = false; // keep playing after win
let history = [];     // undo stack of { grid, score, anim }
let spawnCell = null; // [r, c] of the tile added by the last move (pops in after the slide)
let mergeCells = new Set(); // "r,c" targets of the last move's merges (bounce after the slide)
let floaters = [];    // "+N" score popups { x, y, text, life }
{
  const d = loadSettings("2048_state");
  if (typeof d.SIZE === "number" && d.SIZE >= 3 && d.SIZE <= 8) SIZE = d.SIZE;
  if (typeof d.cancelMode === "boolean") cancelMode = d.cancelMode;
}
syncSliderUI();

// animation
let anim = []; // [{fromR,fromC,toR,toC,value,merged}]
let animT = 0;
let animUndo = false; // true = playing undo (tiles move from to→from)
const ANIM_DUR = 8; // frames
const POP_DUR = 9;  // frames for the spawn / merge pop after the slide

// tile colours come from the active design: PAL.tiles is the ramp for
// 2 … 2048, PAL.tilesNeg the −2 … −32 tiles of negative mode
function tileColor(v) {
  if (v === 0) return PAL.panel;
  const k = Math.log2(Math.abs(v)) - 1;
  if (v < 0) return PAL.tilesNeg[Math.min(k, PAL.tilesNeg.length - 1)];
  if (k < PAL.tiles.length) return PAL.tiles[k];
  return PAL.ink; // beyond 2048
}

// dark text on bright tiles, light text on dark ones — works for light and
// dark designs alike
function tileFg(v) {
  const [r, g, b] = tileColor(v);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? PAL.onLight : PAL.onDark;
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
  return [r, c];
}

function newGame() {
  grid = makeGrid(SIZE);
  score = 0;
  gameOver = false;
  won = false;
  wonAcked = false;
  history = [];
  floaters = [];
  mergeCells = new Set();
  addTile(grid);
  spawnCell = addTile(grid);
  anim = [];
  animT = ANIM_DUR; // straight to the spawn pop
  animUndo = false;
  loadBest();
  clearParticles();
  updateStatus();
}

function updateStatus() {
  if (gameOver) {
    setStatus("game over · score " + score + (score >= best && score > 0 ? " · new best!" : ""), "dead");
  } else if (won && !wonAcked) {
    setStatus("you reached 2048! · score " + score, "solved");
  } else {
    setStatus("score " + score + " · best " + best, null);
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

  history.push({ grid: cloneGrid(grid), score, anim: moves });
  if (history.length > 200) history.shift();

  grid = result;
  score += totalGained;
  if (score > best) best = score;

  anim = moves;
  animT = 0;
  mergeCells = new Set(moves.filter(m => m.merged).map(m => m.toR + "," + m.toC));
  for (const m of moves) if (m.merged) floaters.push({ r: m.toR, c: m.toC, text: "+" + m.value, life: 1.25 });

  spawnCell = addTile(grid);

  if (!won && grid.some(r => r.some(v => v >= 2048))) {
    won = true;
    // difficulty ~ smaller boards are harder to reach 2048 on (slider: 3-8)
    celebrate(1 + Math.round((8 - SIZE) / (8 - 3) * 2));
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
  if (!history.length) { flashNote("Nothing to undo."); return; }
  const prev = history.pop();
  // Restore state immediately; animation shows tiles sliding back
  grid = prev.grid;
  score = prev.score;
  gameOver = false;
  if (won && !grid.some(r => r.some(v => v >= 2048))) { won = false; wonAcked = false; }
  // play the move in reverse: from=toPos, to=fromPos, merged pairs split again
  anim = prev.anim
    .filter(m => !m.vanish)
    .map(m => {
      const split = prev.anim.some(n => n.merged && n.toR === m.toR && n.toC === m.toC);
      return { fromR: m.toR, fromC: m.toC, toR: m.fromR, toC: m.fromC, value: split ? m.value / 2 : m.value, merged: false };
    });
  animUndo = true;
  animT = 0;
  spawnCell = null;
  mergeCells = new Set();
  updateStatus();
}

function bestKey() { return "2048_best_" + SIZE + (cancelMode ? "_neg" : ""); }

function saveBest() {
  try { localStorage.setItem(bestKey(), String(best)); } catch {}
}

function loadBest() {
  best = 0;
  try {
    // the classic board inherits the best score saved before scores were per-size
    const v = parseInt(localStorage.getItem(bestKey()) || (SIZE === 4 && !cancelMode ? localStorage.getItem("2048_best") : "0") || "0");
    if (v > 0) best = v;
  } catch {}
}

// Scripted 3-move sequence showing the classic "corner stacking" strategy:
// swipe right, then down twice, funneling four scattered tiles into a
// single 16 parked in the bottom-right corner — with a fresh tile spawning
// after each move, same as the real game. Each move's start state is the
// previous move's end state (spawn included), so the sequence — and its
// loop back to the beginning — never hard-cuts; every transition is a real
// slide/merge/spawn.
const INFO_SEQUENCE = [
  // move 0 (initial, no animation): the starting board
  { grid: [[2,0,0,2],[0,4,0,0],[4,0,0,0],[0,0,2,2]] },
  // move 1: slide right — everything funnels into column 3 as 4s,
  // then a new 2 spawns top-left
  { dir: "right", movers: [
      { r:0, fromC:0, toC:3, value:2, merged:true }, { r:0, fromC:3, toC:3, value:2, merged:true },
      { r:1, fromC:1, toC:3, value:4 },
      { r:2, fromC:0, toC:3, value:4 },
      { r:3, fromC:2, toC:3, value:2, merged:true }, { r:3, fromC:3, toC:3, value:2, merged:true },
    ],
    slideGrid: [[0,0,0,4],[0,0,0,4],[0,0,0,4],[0,0,0,4]],
    spawn: { r: 0, c: 0, value: 2 },
    grid:  [[2,0,0,4],[0,0,0,4],[0,0,0,4],[0,0,0,4]] },
  // move 2: slide down — a "down" swipe drops every column, not just the
  // ones with merges: column 0's lone 2 falls all the way to the bottom
  // row alongside the four 4s in column 3 pairing up into two 8s. Then a
  // new 2 spawns bottom-left-of-center.
  { dir: "down", movers: [
      { c:0, fromR:0, toR:3, value:2 },
      { c:3, fromR:0, toR:2, value:4, merged:true }, { c:3, fromR:1, toR:2, value:4, merged:true },
      { c:3, fromR:2, toR:3, value:4, merged:true }, { c:3, fromR:3, toR:3, value:4, merged:true },
    ],
    slideGrid: [[0,0,0,0],[0,0,0,0],[0,0,0,8],[2,0,0,8]],
    spawn: { r: 3, c: 1, value: 2 },
    grid:  [[0,0,0,0],[0,0,0,0],[0,0,0,8],[2,2,0,8]] },
  // move 3: slide down again — the two 8s merge into one 16. Columns 0
  // and 1 are already at the bottom row, so this move doesn't move them
  // further; they just stay put.
  { dir: "down", movers: [
      { c:3, fromR:2, toR:3, value:8, merged:true }, { c:3, fromR:3, toR:3, value:8, merged:true },
    ],
    slideGrid: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,2,0,16]],
    spawn: { r: 3, c: 2, value: 4 },
    grid:  [[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,2,4,16]] },
];

function infoAnim(p, w, h, frame) {
  const N = 4;
  const pad = 8;
  const cs = Math.min((w - pad * 2) / N, (h - pad * 2) / N) * 0.92;
  const gap = 4;
  const bw = cs * N + gap * (N - 1);
  const bh = cs * N + gap * (N - 1);
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);
  const cellX = c => ox + c * (cs + gap) + cs / 2;
  const cellY = r => oy + r * (cs + gap) + cs / 2;

  // A move plays out with tiles sliding first; the new tile then pops in
  // — scale-up from nothing — once the slide has cleared its start cell,
  // so the two animations never visually overlap in the same spot. Merged
  // tiles get their own separate landing bounce once the slide finishes.
  const SLIDE_FRAC = 0.55, MERGE_POP_FRAC = 0.25;
  const SPAWN_DELAY = 0.42;  // fraction of the move before the spawn starts popping in
  const SPAWN_POP_LEN = 0.3; // fraction of the move spent popping in, after the delay
  const MOVE_LEN = 70;

  const totalMoves = INFO_SEQUENCE.length - 1; // moves after the initial board
  const cycleLen = MOVE_LEN * totalMoves;
  const t = frame % cycleLen;
  const moveIdx = 1 + Math.floor(t / MOVE_LEN); // which INFO_SEQUENCE entry is animating
  const localT = (t % MOVE_LEN) / MOVE_LEN;

  const prevGrid = INFO_SEQUENCE[moveIdx - 1].grid;
  const step = INFO_SEQUENCE[moveIdx];

  const slideT = p.constrain(localT / SLIDE_FRAC, 0, 1);
  const ease = easeInOutQuad(slideT);
  const slid = localT > SLIDE_FRAC;
  const mergePopT = slid ? p.constrain((localT - SLIDE_FRAC) / MERGE_POP_FRAC, 0, 1) : 0;
  const mergePopScale = slid ? 1 + 0.18 * p.sin(Math.min(1, mergePopT) * Math.PI) : 1;
  // spawn pops in shortly after the move starts, with a gentle overshoot
  // bounce (0 -> 1.1 -> 1.0) so it reads as new without feeling oversized
  const spawnPopT = p.constrain((localT - SPAWN_DELAY) / SPAWN_POP_LEN, 0, 1);
  const spawnScale = spawnPopT < 0.7
    ? p.map(spawnPopT, 0, 0.7, 0, 1.1)
    : p.map(spawnPopT, 0.7, 1, 1.1, 1);

  p.background(...PAL.well);

  // board backdrop + empty cell grid, same styling as the real board
  const padBoard = pad * 0.6;
  p.fill(...PAL.panel);
  p.noStroke();
  p.rect(ox - padBoard, oy - padBoard, bw + padBoard * 2, bh + padBoard * 2, (bw + padBoard * 2) * 0.03);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      p.fill(...PAL.well);
      p.rect(cellX(c) - cs/2, cellY(r) - cs/2, cs, cs, cs * 0.1);
    }
  }

  function drawTile(x, y, v, scale) {
    scale = scale ?? 1;
    const [tr, tg, tb] = tileColor(v);
    p.fill(tr, tg, tb);
    p.noStroke();
    const sz = cs * scale;
    p.rect(x - sz/2, y - sz/2, sz, sz, sz * 0.12);
    if (v > 0) {
      const [fr, fg, fb] = tileFg(v);
      p.fill(fr, fg, fb);
      p.textAlign(p.CENTER, p.CENTER);
      p.textStyle(p.BOLD);
      p.textSize((v >= 1000 ? cs * 0.28 : v >= 100 ? cs * 0.34 : cs * 0.42) * scale);
      p.noStroke();
      p.text(v, x, y + 1);
    }
  }

  // tiles this move doesn't touch stay put, drawn from the pre-move grid
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const touchedRow = step.dir === "right" && step.movers.some(m => m.r === r);
      const touchedCol = step.dir === "down" && step.movers.some(m => m.c === c);
      if (touchedRow || touchedCol) continue;
      const v = prevGrid[r][c];
      if (v) drawTile(cellX(c), cellY(r), v);
    }
  }

  if (!slid) {
    for (const m of step.movers) {
      const x = step.dir === "right" ? p.lerp(cellX(m.fromC), cellX(m.toC), ease) : cellX(m.c);
      const y = step.dir === "down"  ? p.lerp(cellY(m.fromR), cellY(m.toR), ease) : cellY(m.r);
      // a tiny squash on the leading edge of travel makes even a short,
      // non-merging slide read as motion rather than a static tile
      const travelScale = 1 - 0.06 * p.sin(slideT * Math.PI);
      drawTile(x, y, m.value, travelScale);
    }
  } else {
    // draw the settled result row/column from the pure-slide grid, popping
    // merged tiles briefly larger
    const mergedTargets = new Set(step.movers.filter(m => m.merged).map(m => (m.toR ?? m.r) + "," + (m.toC ?? m.c)));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const touchedRow = step.dir === "right" && step.movers.some(m => m.r === r);
        const touchedCol = step.dir === "down" && step.movers.some(m => m.c === c);
        if (!touchedRow && !touchedCol) continue;
        const v = step.slideGrid[r][c];
        if (!v) continue;
        const isMergeTarget = mergedTargets.has(r + "," + c);
        drawTile(cellX(c), cellY(r), v, isMergeTarget ? mergePopScale : 1);
      }
    }
  }

  // new tile pops in near the start of the move, alongside the slide
  if (step.spawn && spawnScale > 0) {
    drawTile(cellX(step.spawn.c), cellY(step.spawn.r), step.spawn.value, spawnScale);
  }
}

// ---- p5 ----

const CANVAS = 440;

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS);
  cnv.parent("canvas-wrap");
  newGame();
}

function draw() {
  background(...PAL.board);

  const GAP = max(5, floor(min(width, height) * 0.016));
  const BOARD_PAD = GAP * 2;
  const maxBoardW = min(width, height) - 24;
  const tileSize = floor((maxBoardW - BOARD_PAD * 2 - GAP * (SIZE - 1)) / SIZE);
  const boardW = tileSize * SIZE + GAP * (SIZE - 1) + BOARD_PAD * 2;
  const boardH = boardW;
  const ox = floor((width - boardW) / 2);
  const oy = floor((height - boardH) / 2);
  const px = c => ox + BOARD_PAD + c * (tileSize + GAP);
  const py = r => oy + BOARD_PAD + r * (tileSize + GAP);

  // board background + empty cells
  fill(...PAL.well);
  noStroke();
  rect(ox, oy, boardW, boardH, 16);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      fill(...PAL.panel);
      rect(px(c), py(r), tileSize, tileSize, tileSize * 0.14);
    }

  const sliding = anim.length > 0 && animT < ANIM_DUR;
  const ease = easeInOutQuad(Math.min(1, animT / ANIM_DUR));

  if (sliding) {
    // tiles not involved in the animation (and not the fresh spawn) stay put
    const covered = new Set(anim.map(m => m.toR + "," + m.toC));
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        if (v === 0 || covered.has(r + "," + c) || (spawnCell && spawnCell[0] === r && spawnCell[1] === c)) continue;
        drawTile(px(c), py(r), tileSize, v, 1, 1);
      }
    for (const m of anim) {
      const x = lerp(px(m.fromC), px(m.toC), ease);
      const y = lerp(py(m.fromR), py(m.toR), ease);
      if (m.vanish) { drawTile(x, y, tileSize, m.value, 1 - ease, 1); continue; }
      // both halves of a merge travel at their pre-merge value
      const half = anim.some(n => n.merged && n.toR === m.toR && n.toC === m.toC);
      drawTile(x, y, tileSize, half ? m.value / 2 : m.value, 1, 1);
    }
  } else {
    const k = Math.min(1, (animT - ANIM_DUR) / POP_DUR); // 0..1 through the pop
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        let scale = 1;
        if (k < 1 && spawnCell && spawnCell[0] === r && spawnCell[1] === c) scale = easeOutBack(k);
        else if (k < 1 && mergeCells.has(r + "," + c)) scale = 1 + 0.14 * sin(k * PI);
        drawTile(px(c), py(r), tileSize, v, 1, scale);
      }
    if (k >= 1) anim = [];
  }
  animT++;
  if (animT >= ANIM_DUR) animUndo = false;

  // "+N" score popups drifting up from each merge, once the slide has landed
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= 0.025;
    if (f.life <= 0) { floaters.splice(i, 1); continue; }
    if (f.life > 1) continue;
    const a = 255 * Math.min(1, f.life * 2.5);
    textSize(Math.max(14, tileSize * 0.22));
    fill(0, 0, 0, a * 0.5);
    text(f.text, px(f.c) + tileSize / 2 + 1, py(f.r) - (1 - f.life) * tileSize * 0.6 + 1);
    fill(255, 255, 255, a);
    text(f.text, px(f.c) + tileSize / 2, py(f.r) - (1 - f.life) * tileSize * 0.6);
  }

  drawParticles();

  if (gameOver) {
    drawBoardOverlay(ox, oy, boardW, boardH, "Game over", "score " + score + " · U to undo · N for a new game", PAL.rose);
  } else if (won && !wonAcked) {
    drawBoardOverlay(ox, oy, boardW, boardH, "2048!", "press any key or tap to keep playing", PAL.sun);
  }
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawTile(x, y, sz, v, alpha, scale) {
  const s = sz * scale;
  const ox = x + (sz - s) / 2, oy = y + (sz - s) / 2;
  const [tr, tg, tb] = tileColor(v);
  noStroke();
  // big tiles glow
  if (v >= 128) {
    const glow = Math.min(1, Math.log2(v / 64) / 5);
    fill(tr, tg, tb, 50 * glow * alpha);
    rect(ox - 4, oy - 4, s + 8, s + 8, s * 0.2);
  }
  fill(tr, tg, tb, alpha * 255);
  rect(ox, oy, s, s, s * 0.14);
  // soft top sheen
  fill(255, 255, 255, 16 * alpha);
  rect(ox, oy, s, s * 0.5, s * 0.14, s * 0.14, 0, 0);
  if (v === 0) return;
  const [fr, fg, fb] = tileFg(v);
  fill(fr, fg, fb, alpha * 255);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  const label = v < 0 ? "−" + (-v) : String(v);
  const len = label.length;
  textSize(s * (len >= 5 ? 0.24 : len === 4 ? 0.3 : len === 3 ? 0.36 : 0.44));
  text(label, ox + s / 2, oy + s / 2 + s * 0.02);
}

function keyPressed() {
  if (won && !wonAcked && keyCode !== 78) { wonAcked = true; updateStatus(); return false; }
  if (keyCode === 78) { newGame(); return false; }
  if (keyCode === 85 || (keyCode === 90 && (keyIsDown(91) || keyIsDown(17)))) { undo(); return false; }
  if (gameOver) return;

  if (keyCode === LEFT_ARROW  || key === "a" || key === "A") { move("left");  return false; }
  if (keyCode === RIGHT_ARROW || key === "d" || key === "D") { move("right"); return false; }
  if (keyCode === UP_ARROW    || key === "w" || key === "W") { move("up");    return false; }
  if (keyCode === DOWN_ARROW  || key === "s" || key === "S") { move("down");  return false; }
}

function _overCanvas() {
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

function mousePressed() {
  if (_overCanvas() && won && !wonAcked) { wonAcked = true; updateStatus(); return false; }
}

// ---- touch swipe ----
let touchStartX = 0, touchStartY = 0, touchActive = false;

function touchStarted() {
  if (!_overCanvas()) return;
  touchActive = true;
  touchStartX = mouseX;
  touchStartY = mouseY;
  return false;
}

function touchEnded() {
  if (!touchActive) return;
  touchActive = false;
  const dx = mouseX - touchStartX;
  const dy = mouseY - touchStartY;
  if (won && !wonAcked) { wonAcked = true; updateStatus(); return false; }
  if (Math.hypot(dx, dy) < 20) return false;
  if (!gameOver) {
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }
  return false;
}
