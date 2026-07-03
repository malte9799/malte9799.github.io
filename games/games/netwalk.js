// Netwalk — rotate pipe pieces so every node connects back to the source.
// Left-click rotates a tile clockwise, right-click rotates counter-clockwise.
// Connected pipes fill with a fluid glow that spreads outward from the source.

initGame({
  title: "Netwalk",
  tag: "route power to every node",
  presets: [
    { label: "7×7 (standard)", values: [7] },
    { label: "5×5 (easy)",     values: [5] },
    { label: "10×10 (hard)",   values: [10] },
  ],
  buttons: [
    { id: "btn-reset", label: "New Board", primary: true, onClick: () => newGame() },
    { id: "btn-hint",  label: "Hint",                      onClick: () => confirmHint(getHint) },
  ],
  sliders: [
    { id: "s-size", label: "Size", min: 4, max: 14, step: 1 },
  ],
  onPreset: ([n]) => { SIZE = n; newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; },
  onClamp: () => {},
  getSliderValues: () => ({ "s-size": SIZE }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: "Left-click rotates a pipe clockwise, right-click counter-clockwise. Power flows out from the gold source through pipes that line up — light every endpoint ring to bring the network online.",
  },
});

// Directions as bitmask: N=1, E=2, S=4, W=8
const N = 1, E = 2, S = 4, W = 8;
const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
const ALL_DIRS = [N, E, S, W];

let SIZE = 7;
let cells = [];        // cells[r][c] = { conns: bitmask (solved orientation), rot: current rotation steps (0-3) }
let sourceR = 0, sourceC = 0;
let gameOver = false;

let cellSize = 0, ox = 0, oy = 0;

let connectedSet = new Set(); // "r,c" cells currently connected to source
let flowEdges = [];  // list of {r,c,dir} edges within the connected tree (parent->child), for animating

// Per-cell fill level (0 = empty, 1 = fully filled/lit). Each reconnection
// event (a click or hint that newly connects one or more cells) starts its
// own independent linear wave, timestamped by the frame it began — so two
// separate reconnection events never share or clobber each other's clock.
// Within one event, every newly-connected cell starts together, staggered
// only by its own depth relative to the shallowest new cell in that batch:
// each cell is two half-steps (entry edge -> hub, then hub -> exit edges),
// and a cell's exit half only starts the instant its entry half finishes.
let fillLevel = new Map();   // "r,c" -> current fill 0..1
let cellDepth = new Map();   // "r,c" -> BFS depth from source (for stagger ordering)
let entryDir = new Map();    // "r,c" -> direction (N/E/S/W) the flow enters from, source has none
let waveStart = new Map();   // "r,c" -> wave-units position where this cell's fill begins, within its own event
let waveOrigin = new Map();  // "r,c" -> frame count (this cell's event's local clock start)
const WAVE_SPEED = 0.4;      // wave-units per frame (2 units = one full cell)
const EMPTY_KEEP = 0.62;     // matches spinOffset's per-frame keep-rate so a disconnected pipe empties in step with its spin

// Per-cell rotation spin animation. spinOffset is a leftover angle (radians,
// signed) still to be caught up to the logical rot; it decays to 0 each
// frame so the piece visibly snaps toward its new orientation instead of
// jumping instantly.
let spinOffset = new Map();  // "r,c" -> radians remaining to animate away

// rotate a bitmask of dirs clockwise by `steps` 90-degree turns
function rotateMask(mask, steps) {
  let m = mask;
  for (let i = 0; i < steps; i++) {
    let nm = 0;
    if (m & N) nm |= E;
    if (m & E) nm |= S;
    if (m & S) nm |= W;
    if (m & W) nm |= N;
    m = nm;
  }
  return m;
}

function currentConns(cell) {
  return rotateMask(cell.conns, cell.rot);
}

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function makeGame() {
  // Build a random spanning tree over the grid via randomized DFS/backtracker.
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const treeConns = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

  sourceR = Math.floor(Math.random() * SIZE);
  sourceC = Math.floor(Math.random() * SIZE);

  const stack = [[sourceR, sourceC]];
  visited[sourceR][sourceC] = true;

  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const dirs = shuffle([...ALL_DIRS]);
    let advanced = false;
    for (const d of dirs) {
      const nr = r + DY[d], nc = c + DX[d];
      if (!inBounds(nr, nc) || visited[nr][nc]) continue;
      // carve connection
      treeConns[r][c] |= d;
      treeConns[nr][nc] |= OPP[d];
      visited[nr][nc] = true;
      stack.push([nr, nc]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  cells = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => ({
      conns: treeConns[r][c],
      rot: 0,
      isSource: r === sourceR && c === sourceC,
      isLeaf: false,
    }))
  );

  // mark leaves (endpoints = exactly one connection, not the source)
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r][c];
      if (!cell.isSource && countBits(cell.conns) === 1) cell.isLeaf = true;
    }
  }

  // scramble rotations, avoiding an already-solved cell when it matters
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r][c];
      const maxRot = cell.conns === 0 ? 1 : (isSymmetric(cell.conns) ? 2 : 4);
      cell.rot = Math.floor(Math.random() * maxRot);
    }
  }
}

function isSymmetric(mask) {
  // straight pipe (N|S or E|W) looks the same after 2 rotations
  return mask === (N | S) || mask === (E | W);
}

function countBits(m) {
  let n = 0;
  while (m) { n += m & 1; m >>= 1; }
  return n;
}

const shuffle = shuffleArray; // from game.js

function newGame() {
  makeGame();
  gameOver = false;
  fillLevel = new Map();
  waveStart = new Map();
  waveOrigin = new Map();
  spinOffset.clear();
  resetHint();
  updateConnectivity();
  updateStatus();
}

// BFS from source through currently-aligned connections to find the connected set + tree edges
function updateConnectivity() {
  const prevConnected = connectedSet;
  connectedSet = new Set();
  flowEdges = [];
  cellDepth = new Map();
  entryDir = new Map();
  const startKey = sourceR + "," + sourceC;
  connectedSet.add(startKey);
  cellDepth.set(startKey, 0);
  const queue = [[sourceR, sourceC]];
  while (queue.length) {
    const [r, c] = queue.shift();
    const conns = currentConns(cells[r][c]);
    const d0 = cellDepth.get(r + "," + c);
    for (const d of ALL_DIRS) {
      if (!(conns & d)) continue;
      const nr = r + DY[d], nc = c + DX[d];
      if (!inBounds(nr, nc)) continue;
      const nConns = currentConns(cells[nr][nc]);
      if (!(nConns & OPP[d])) continue; // neighbor must connect back
      const key = nr + "," + nc;
      if (connectedSet.has(key)) continue;
      connectedSet.add(key);
      cellDepth.set(key, d0 + 1);
      entryDir.set(key, OPP[d]); // flow enters the neighbor from the opposite side
      flowEdges.push({ r, c, dir: d });
      queue.push([nr, nc]);
    }
  }

  // Cells that just joined the connected set all start together, as one
  // reconnection event stamped with the current frame — rooted at wherever
  // the new growth actually begins (the shallowest newly-connected cell,
  // i.e. right where the rotation/hint reconnected the chain), not at the
  // absolute source depth. Each cell is 2 wave-units (entry half + exit
  // half), so within the event the wave travels strictly one cell at a
  // time. Stamping with frameCount (instead of a shared clock reset to 0)
  // means an unrelated later event can't corrupt an already-running one.
  const newlyConnected = [...connectedSet].filter(k => !prevConnected.has(k));
  if (newlyConnected.length > 0) {
    const baseDepth = Math.min(...newlyConnected.map(k => cellDepth.get(k)));
    const origin = frameCount;
    for (const key of newlyConnected) {
      waveStart.set(key, 2 * (cellDepth.get(key) - baseDepth));
      waveOrigin.set(key, origin);
    }
  }
  for (const key of [...waveStart.keys()]) {
    if (!connectedSet.has(key)) { waveStart.delete(key); waveOrigin.delete(key); } // keep fillLevel so it can fade out
  }
}

// Advances each cell's own reconnection-event clock and derives its fill
// level from its fixed wave-unit window — constant speed, one cell
// finishing exactly as the next one (in the same event) starts. Settles
// and stops once full (no looping).
function updateFillLevels() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cells[r][c].conns === 0) continue;
      const key = r + "," + c;
      if (waveStart.has(key)) {
        const elapsed = (frameCount - waveOrigin.get(key)) * WAVE_SPEED;
        const local = elapsed - waveStart.get(key); // 0..2 across this cell
        fillLevel.set(key, clampFrac(local / 2));
      } else {
        const cur = fillLevel.get(key) ?? 0;
        const nv = cur * EMPTY_KEEP;
        fillLevel.set(key, nv < 0.01 ? 0 : nv); // disconnected: empty out, in step with the spin
      }
    }
  }
}

// Eases each pending spin offset toward 0 so a click's 90° turn animates
// in quickly rather than snapping instantly. Settles and stops — no loop.
function updateSpinOffsets() {
  for (const [key, v] of spinOffset) {
    const nv = v * 0.62;
    if (Math.abs(nv) < 0.01) spinOffset.delete(key);
    else spinOffset.set(key, nv);
  }
}

function checkSolved() {
  // solved when every cell with a connection is in the connected set
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r][c];
      if (cell.conns === 0) continue;
      if (!connectedSet.has(r + "," + c)) return false;
    }
  }
  return true;
}

function updateStatus() {
  if (gameOver) {
    setStatus("network online!", "solved");
  } else {
    const total = countNonEmpty();
    setStatus(connectedSet.size - 1 + " / " + (total - 1) + " nodes lit", null);
  }
}

function countNonEmpty() {
  let n = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (cells[r][c].conns !== 0) n++;
  return n;
}

function rotateCell(r, c, dirSteps) {
  if (gameOver) return;
  const cell = cells[r][c];
  if (cell.conns === 0) return;
  cell.rot = (cell.rot + dirSteps + 4) % 4;
  const key = r + "," + c;
  // Always start a fresh single-turn spin, ignoring any leftover from a
  // still-decaying previous click — otherwise rapid clicks stack or nearly
  // cancel offsets, making the animation start late or look off.
  spinOffset.set(key, -dirSteps * (Math.PI / 2));
  updateConnectivity();
  if (!gameOver && checkSolved()) {
    gameOver = true;
    celebrateNetwalk();
  }
  updateStatus();
}

function celebrateNetwalk() {
  // difficulty ~ grid size (sliders: 4-14)
  celebrate(1 + Math.round((SIZE - 4) / (14 - 4) * 2));
}

// Walks the actual solution tree (via each cell's solved `conns` bitmask,
// not the player's current rotation) breadth-first from the source, and
// fixes the first cell it meets that's still misrotated. Because it follows
// the real parent-child structure of the puzzle rather than plain grid
// adjacency, repeated hints fix pieces in genuine source-outward order:
// source's neighbor first, then the next piece down that same branch, etc.
function getHint() {
  if (gameOver) return;
  const visited = new Set([sourceR + "," + sourceC]);
  const queue = [[sourceR, sourceC]];
  let qi = 0;
  let best = null;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    const cell = cells[r][c];
    // A 180° rotation of a straight pipe (N|S or E|W) looks and connects
    // identically to 0°, so it's not actually wrong — only rot 1 or 3 is.
    const isWrong = isSymmetric(cell.conns) ? (cell.rot % 2 !== 0) : cell.rot !== 0;
    if (isWrong) {
      best = [r, c];
      break;
    }
    const conns = cell.conns; // solved bitmask = true tree edges
    for (const d of ALL_DIRS) {
      if (!(conns & d)) continue;
      const nr = r + DY[d], nc = c + DX[d];
      if (!inBounds(nr, nc)) continue;
      const nKey = nr + "," + nc;
      if (visited.has(nKey)) continue;
      visited.add(nKey);
      queue.push([nr, nc]);
    }
  }
  if (!best) {
    flashNote("No hint available.");
    return;
  }
  const [r, c] = best;
  const cell = cells[r][c];
  const key = r + "," + c;
  const delta = ((0 - cell.rot) % 4 + 4) % 4; // steps needed to reach solved rot=0
  const steps = delta === 3 ? -1 : delta; // shortest visual turn (-1 == one CCW step)
  cell.rot = 0;
  spinOffset.set(key, -steps * (Math.PI / 2));
  updateConnectivity();
  if (!gameOver && checkSolved()) { gameOver = true; celebrateNetwalk(); }
  updateStatus();
  flashNote("Fixed the nearest wrong connection.");
}

// ---- info modal animation ----

function infoAnim(p, w, h, frame) {
  const gridN = 3;
  const cs = Math.min(w, h) / 4.2;
  const bw = cs * gridN, bh = cs * gridN;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  p.background(20, 18, 15);

  const PHASE_LEN = 70;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);
  const localT = (t % PHASE_LEN) / PHASE_LEN;

  // simple 3-cell horizontal path: source(center-left) -> straight -> elbow to endpoint below
  // phase 0: middle piece misrotated (points N/S instead of E/W) — not connected
  // phase 1: middle piece rotated correctly — connected, fill glow flows
  const midConnected = phase === 1;

  function drawPipe(cx, cy, mask, glow) {
    p.strokeWeight(cs * 0.16);
    p.stroke(glow ? p.color(127, 200, 230) : p.color(70, 64, 56));
    for (const d of ALL_DIRS) {
      if (!(mask & d)) continue;
      const ex = cx + DX[d] * cs / 2, ey = cy + DY[d] * cs / 2;
      p.line(cx, cy, ex, ey);
    }
    p.noStroke();
    p.fill(glow ? p.color(190, 230, 245) : p.color(90, 84, 74));
    p.circle(cx, cy, cs * 0.22);
  }

  const c0 = { x: ox + cs * 0.5, y: oy + cs * 1.5 }; // source
  const c1 = { x: ox + cs * 1.5, y: oy + cs * 1.5 }; // middle (rotatable)
  const c2 = { x: ox + cs * 2.5, y: oy + cs * 1.5 }; // endpoint

  drawPipe(c0.x, c0.y, E, true);
  drawPipe(c1.x, c1.y, midConnected ? (E | W) : (N | S), midConnected);
  drawPipe(c2.x, c2.y, W, midConnected);

  // source glyph
  p.noStroke();
  p.fill(230, 180, 34);
  p.circle(c0.x, c0.y, cs * 0.34);

  // pulse traveling when connected
  if (midConnected) {
    const px = p.lerp(c0.x, c2.x, localT);
    p.fill(243, 237, 224, 220);
    p.circle(px, c1.y, cs * 0.14);
  }
}

// ---- p5 Sketch Lifecycle ----

const CANVAS = 460;

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS);
  cnv.parent("canvas-wrap");
  cnv.elt.addEventListener("contextmenu", (e) => e.preventDefault());
  newGame();
}

const EMPTY_COL = [70, 64, 56];
const FILL_COL = [127, 210, 230];
const EMPTY_HUB_COL = [90, 84, 74];
const FILL_HUB_COL = [200, 235, 245];

// Draws a pipe piece. `mask` = open arms (bitmask). `touchMask` = arms whose
// neighbor's pipe meets ours flush at the cell edge (drawn square-tipped so
// the seam reads as one continuous tube instead of two round caps bumping
// together); other open arms are dead-end stubs (drawn round-tipped).
// `glowAmt` (0..1) is how full this piece is. `enterDir` is the arm the
// liquid enters from (null for the source, which fills outward from its own
// hub instead). The fill lerps along each arm from the entry side through
// the hub and out the far arms, so it visually looks like liquid flowing in
// and topping up the piece, rather than a flat color fade.
function drawPipeShape(cx, cy, size, cellSize, mask, touchMask, glowAmt, enterDir) {
  const stubLen = size / 2;
  const touchLen = cellSize / 2;
  const thick = size * 0.22;

  // Entry half fills across the first 50% of glowAmt, hub+exit arms fill
  // across the remaining 50%. Source (no enterDir) just fills all arms
  // uniformly from the hub outward.
  const entryFill = enterDir ? clampFrac(glowAmt / 0.5) : 1;
  const restFill = enterDir ? clampFrac((glowAmt - 0.5) / 0.5) : glowAmt;

  for (const d of ALL_DIRS) {
    if (!(mask & d)) continue;
    const isTouch = !!(touchMask & d);
    const armLen = isTouch ? touchLen : stubLen;
    const ex = cx + DX[d] * armLen, ey = cy + DY[d] * armLen;
    const isEntry = d === enterDir;
    const armFill = isEntry ? entryFill : restFill;

    strokeCap(isTouch ? SQUARE : ROUND);

    // empty base tube
    strokeWeight(thick);
    stroke(EMPTY_COL[0], EMPTY_COL[1], EMPTY_COL[2]);
    line(cx, cy, ex, ey);

    if (armFill > 0) {
      // The entry arm fills from the outer edge inward (liquid arriving
      // from the neighbor); every other arm fills from the hub outward
      // (liquid pushing out toward the tip).
      const fx = isEntry ? lerp(ex, cx, armFill) : lerp(cx, ex, armFill);
      const fy = isEntry ? lerp(ey, cy, armFill) : lerp(cy, ey, armFill);
      const [lx1, ly1, lx2, ly2] = isEntry ? [ex, ey, fx, fy] : [cx, cy, fx, fy];
      strokeWeight(thick * 1.9);
      stroke(90, 190, 210, 40 * glowAmt);
      line(lx1, ly1, lx2, ly2);
      // filled liquid core
      strokeWeight(thick);
      stroke(FILL_COL[0], FILL_COL[1], FILL_COL[2]);
      line(lx1, ly1, lx2, ly2);
    }
  }

  // hub — lit once the entry side has reached it
  noStroke();
  const hubAmt = enterDir ? entryFill : glowAmt;
  const hubCol = hubAmt > 0
    ? lerpColor(color(EMPTY_HUB_COL[0], EMPTY_HUB_COL[1], EMPTY_HUB_COL[2]),
                color(FILL_HUB_COL[0], FILL_HUB_COL[1], FILL_HUB_COL[2]), hubAmt)
    : color(EMPTY_HUB_COL[0], EMPTY_HUB_COL[1], EMPTY_HUB_COL[2]);
  fill(hubCol);
  circle(cx, cy, size * 0.26);
}

function clampFrac(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function draw() {
  background(20, 18, 15);

  const maxBoardW = min(width * 0.92, height * 0.92, 440);
  cellSize = floor(maxBoardW / SIZE);
  const boardW = cellSize * SIZE;
  ox = floor((width - boardW) / 2);
  oy = floor((height - boardW) / 2);

  updateFillLevels();
  updateSpinOffsets();

  // grid backdrop
  noStroke();
  fill(28, 25, 22);
  rect(ox, oy, boardW, boardW, 6);

  // draw pipes
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r][c];
      if (cell.conns === 0) continue;
      const cx = ox + c * cellSize + cellSize / 2;
      const cy = oy + r * cellSize + cellSize / 2;
      const mask = currentConns(cell);
      const key = r + "," + c;
      const glowAmt = fillLevel.get(key) ?? 0;
      const enterDir = entryDir.get(key) ?? null;
      // arms whose neighbor's pipe meets ours flush at the cell edge — draw
      // those with a square tip instead of a round cap so the joint reads
      // as one continuous tube rather than two capsule ends bumping together
      let touchMask = 0;
      for (const d of ALL_DIRS) {
        if (!(mask & d)) continue;
        const nr = r + DY[d], nc = c + DX[d];
        if (!inBounds(nr, nc)) continue;
        const nMask = currentConns(cells[nr][nc]);
        if (nMask & OPP[d]) touchMask |= d;
      }
      const spin = spinOffset.get(key) ?? 0;
      if (spin !== 0) {
        push();
        translate(cx, cy);
        rotate(spin);
        drawPipeShape(0, 0, cellSize * 0.86, cellSize, mask, touchMask, glowAmt, enterDir);
        pop();
      } else {
        drawPipeShape(cx, cy, cellSize * 0.86, cellSize, mask, touchMask, glowAmt, enterDir);
      }
    }
  }

  // source node marker
  {
    const cx = ox + sourceC * cellSize + cellSize / 2;
    const cy = oy + sourceR * cellSize + cellSize / 2;
    noStroke();
    fill(230, 180, 34, 35);
    circle(cx, cy, cellSize * 0.66);
    fill(230, 180, 34);
    circle(cx, cy, cellSize * 0.4);
  }

  // leaf/endpoint markers (small ring), lit as their fill level rises
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r][c];
      if (!cell.isLeaf) continue;
      const cx = ox + c * cellSize + cellSize / 2;
      const cy = oy + r * cellSize + cellSize / 2;
      const glowAmt = fillLevel.get(r + "," + c) ?? 0;
      noFill();
      stroke(lerpColor(color(90, 84, 74), color(190, 235, 245), glowAmt));
      strokeWeight(2);
      circle(cx, cy, cellSize * 0.5);
    }
  }

  // hover highlight
  if (!gameOver) {
    const hc = hoveredCell();
    if (hc) {
      const [r, c] = hc;
      if (cells[r][c].conns !== 0) {
        const cx = ox + c * cellSize + cellSize / 2;
        const cy = oy + r * cellSize + cellSize / 2;
        noFill();
        stroke(155, 145, 130, 110);
        strokeWeight(1.5);
        rect(ox + c * cellSize + 2, oy + r * cellSize + 2, cellSize - 4, cellSize - 4, 6);
      }
    }
  }

  // solved overlay
  if (gameOver) {
    drawBoardOverlay(ox, oy, boardW, boardW, "NETWORK ONLINE", "Every node is powered", [127, 176, 105]);
  }
}

function hoveredCell() {
  const mx = mouseX - ox, my = mouseY - oy;
  const boardW = cellSize * SIZE;
  if (mx < 0 || mx >= boardW || my < 0 || my >= boardW) return null;
  const c = Math.floor(mx / cellSize);
  const r = Math.floor(my / cellSize);
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  return [r, c];
}

function mousePressed() {
  if (gameOver) return;
  const hc = hoveredCell();
  if (!hc) return;
  const [r, c] = hc;
  rotateCell(r, c, mouseButton === RIGHT ? -1 : 1);
  return false;
}
