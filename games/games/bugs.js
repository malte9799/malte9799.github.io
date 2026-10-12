// Bug Nudge — push every bug home.
// Place a bug on an empty cell and every bug next to it gets nudged one step
// away. Puzzles are generated backwards from the solved state (see buildGame),
// so the intended sequence of placements always exists.

initGame({
  title: "Bug Nudge",
  tag: "push every bug home",
  presets: [
    { label: "Medium (standard)", values: [5,  6,  3] },
    { label: "Easy",              values: [5,  5,  2] },
    { label: "Hard",              values: [7,  10, 5] },
    { label: "Harder",            values: [8,  12, 7] },
  ],
  buttons: [
    { id: "btn-new",   label: "New puzzle", primary: true, onClick: () => newGame() },
    { id: "btn-reset", label: "Restart",    onClick: () => restart() },
    { id: "btn-undo",  label: "Undo",       onClick: () => undo() },
    { id: "btn-hint",  label: "Hint",       onClick: () => confirmHint(hintStep) },
  ],
  sliders: [
    { id: "s-size",   label: "Grid size", min: 4, max: 10, step: 1, fmt: v => v + "×" + v },
    { id: "s-bugs",   label: "Bugs",      min: 2, max: 20, step: 1 },
    { id: "s-remove", label: "Placements", min: 1, max: 10, step: 1 },
  ],
  onPreset: ([s, b, r]) => { size = s; numBugs = b; numRemove = r; clamp(); syncSliderUI(); seed = Math.floor(Math.random() * 1e9); buildGame(); },
  onSlider: (id, v) => { if (id === "s-size") size = v; else if (id === "s-bugs") numBugs = v; else numRemove = v; },
  onClamp: clamp,
  getSliderValues: () => ({ "s-size": size, "s-bugs": numBugs, "s-remove": numRemove }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Click an empty cell to place a bug there — every bug touching it (diagonals too) gets nudged one step away. Get a bug onto every gold home square using exactly the placements you have.",
      "Bugs can't be pushed off the board or onto another bug. Hover a cell to preview the nudge. Keys: N new · R restart · U undo · H hint.",
    ],
  },
});

let size = 5;
let numBugs = 6;
let numRemove = 3;

let homes = [];
let bugs = [];        // { i, j, x, y } — x/y are the animated draw positions
let startBugs = [];   // puzzle start, for Restart and hint rewinds
let solution = [];    // cells to place on, in order
let placed = [];      // cells the player placed on, in order
let history = [];     // undo stack of bug snapshots
let seed = 0;
let wasSolved = false;
let shockwaves = [];
let blockedFlash = null; // { i, j, t } — red flash on an illegal placement

const PULL = 2;
const CANVAS = 440;
const PAD = 14;

function onRing(b, ci, cj, dist) {
  const ax = Math.abs(b.i - ci), ay = Math.abs(b.j - cj);
  return Math.max(ax, ay) === dist && (ax === 0 || ax === dist) && (ay === 0 || ay === dist);
}

function hasNeighbour(ci, cj, list) {
  return list.some(b => !(b.i === ci && b.j === cj) && Math.abs(b.i - ci) <= 1 && Math.abs(b.j - cj) <= 1);
}

// Generation step (the inverse of a placement): bugs two steps out move one
// step in. Fails if two bugs would end up on the same cell.
function pullSafe(list, cx, cy) {
  const moved = list.map(b => onRing(b, cx, cy, PULL)
    ? { i: b.i + Math.sign(cx - b.i), j: b.j + Math.sign(cy - b.j) }
    : { i: b.i, j: b.j });
  if (new Set(moved.map(m => m.i + "," + m.j)).size !== moved.length) return false;
  moved.forEach((m, k) => { list[k].i = m.i; list[k].j = m.j; });
  return true;
}

// The nudges a placement on (ci, cj) would cause: [{ bug, ni, nj }], plus
// whether any of them is illegal (off the board or onto another bug).
function nudgesFor(ci, cj) {
  const moves = bugs.filter(b => onRing(b, ci, cj, 1)).map(b => ({
    bug: b, ni: b.i + Math.sign(b.i - ci), nj: b.j + Math.sign(b.j - cj),
  }));
  const blocked = moves.some(m =>
    m.ni < 0 || m.nj < 0 || m.ni >= size || m.nj >= size ||
    bugs.some(o => o.i === m.ni && o.j === m.nj));
  return { moves, blocked };
}

function buildGame() {
  for (let tries = 0; tries < 10000; tries++) {
    randomSeed(seed);
    let h = [];
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size; j++) h.push({ i, j });
    h = h.sort(() => 0.5 - random()).slice(0, numBugs);

    const b = h.map(e => ({ i: e.i, j: e.j, hi: e.i, hj: e.j }));
    const removed = [];
    let valid = true;

    for (let n = 0; n < numRemove; n++) {
      const r = Math.floor(random() * b.length);
      const cell = b[r];
      if (hasNeighbour(cell.i, cell.j, b)) { valid = false; break; }
      removed.push({ i: cell.i, j: cell.j });
      b.splice(r, 1);
      if (!pullSafe(b, cell.i, cell.j)) { valid = false; break; }
    }

    // too many bugs already sitting at home makes it trivial
    if (valid && b.filter(e => e.i === e.hi && e.j === e.hj).length >= 3) valid = false;

    if (valid) {
      homes = h.map(e => ({ i: e.i, j: e.j }));
      startBugs = b.map(e => ({ i: e.i, j: e.j }));
      solution = removed.reverse();
      saveState();
      restart();
      return true;
    }
    seed++;
  }
  flashNote("Couldn't generate that — try fewer placements or a bigger grid.");
  return false;
}

function restart() {
  bugs = startBugs.map(b => ({ ...b, x: b.i, y: b.j }));
  placed = [];
  history = [];
  wasSolved = false;
  shockwaves = [];
  blockedFlash = null;
  clearParticles();
  resetHint();
  flashNote("");
}

function newGame() {
  seed = Math.floor(Math.random() * 1e9);
  buildGame();
}

function clicksLeft() { return solution.length - placed.length; }

function place(i, j) {
  const { moves, blocked } = nudgesFor(i, j);
  if (blocked) {
    blockedFlash = { i, j, t: frameCount };
    flashNote("A bug would be pushed off the board or onto another bug.");
    return false;
  }
  history.push(bugs.map(b => ({ ...b })));
  placed.push({ i, j });

  const cs = cell();
  const cx = bx(i) + cs / 2, cy = bx(j) + cs / 2;
  shockwaves.push({ x: cx, y: cy, radius: cs * 0.3, maxRadius: cs * 1.6, life: 255 });
  for (const m of moves) {
    spawnBurst(bx(m.bug.i) + cs / 2, bx(m.bug.j) + cs / 2, { count: 5, speed: [0.2, 1.2], life: [150, 150], size: [1.5, 3], col: PAL.rose });
    m.bug.i = m.ni; m.bug.j = m.nj;
  }
  bugs.push({ i, j, x: i, y: j, born: frameCount });
  return true;
}

function undo() {
  if (!history.length) { flashNote("Nothing to undo."); return; }
  const snap = history.pop();
  placed.pop();
  // snapshot index k is the same bug as bugs[k] (placements only append), so
  // keep the live draw positions and let the bugs glide back
  bugs = snap.map((s, k) => ({ ...s, x: bugs[k].x, y: bugs[k].y }));
  wasSolved = false;
  resetHint();
}

function isSolved() {
  return homes.every(h => bugs.some(b => b.i === h.i && b.j === h.j));
}

// Hint: play the next move of the generated solution. If the player has left
// that path, rewind to the last placement that still matches it first.
function hintStep() {
  if (isSolved()) return;
  let k = 0;
  while (k < placed.length && k < solution.length && placed[k].i === solution[k].i && placed[k].j === solution[k].j) k++;
  if (k < placed.length) {
    while (placed.length > k) undo();
    flashNote("Rewound to your last move on the solution path.");
  }
  if (k >= solution.length) return;
  place(solution[k].i, solution[k].j);
}

function saveState() {
  saveSettings("bugs_state", { size, numBugs, numRemove, seed });
}

function loadState() {
  const d = loadSettings("bugs_state");
  if (typeof d.size === "number") size = d.size;
  if (typeof d.numBugs === "number") numBugs = d.numBugs;
  if (typeof d.numRemove === "number") numRemove = d.numRemove;
  if (typeof d.seed === "number") seed = d.seed;
}

function clamp() {
  numBugs = Math.min(numBugs, size * size);
  numRemove = Math.min(numRemove, numBugs);
}

loadState();
clamp();
syncSliderUI();

// ---- drawing helpers (shared by the game and the info demo) ----

// One board tile; home tiles get a warm tint and a diamond marker.
function drawTile(p, x, y, cs, home, filled, t) {
  const g = Math.max(2, cs * 0.05);
  p.noStroke();
  if (home) {
    p.fill(...PAL.sun, filled ? 44 : 22);
    p.stroke(...PAL.sun, filled ? 150 : 90);
    p.strokeWeight(Math.max(1, cs * 0.02));
    p.rect(x + g / 2 + 0.5, y + g / 2 + 0.5, cs - g - 1, cs - g - 1, cs * 0.16);
    p.noStroke();
    const r = cs * 0.09 * (1 + 0.08 * Math.sin(t * 0.12 + x + y));
    p.fill(...PAL.sun, filled ? 120 : 255);
    p.quad(x + cs / 2, y + cs / 2 - r, x + cs / 2 + r, y + cs / 2, x + cs / 2, y + cs / 2 + r, x + cs / 2 - r, y + cs / 2);
  } else {
    p.fill(...PAL.well);
    p.rect(x + g / 2, y + g / 2, cs - g, cs - g, cs * 0.16);
  }
}

// A little ladybug, head up. `home` adds a mint halo.
function drawBugShape(p, cx, cy, cs, home, t, alpha = 255) {
  const d = cs * 0.62 * (1 + 0.035 * Math.sin(t * 0.16));
  if (home) {
    p.noStroke();
    p.fill(...PAL.mint, 40 * alpha / 255);
    p.circle(cx, cy, cs * 0.92);
    p.noFill();
    p.stroke(...PAL.mint, 200 * alpha / 255);
    p.strokeWeight(Math.max(1.5, cs * 0.035));
    p.circle(cx, cy, cs * 0.84);
  }
  // legs
  p.stroke(170, 80, 125, alpha);
  p.strokeWeight(Math.max(1.2, d * 0.06));
  const wig = Math.sin(t * 0.25) * d * 0.04;
  for (const s of [-1, 1])
    for (const k of [-0.22, 0.05, 0.3]) {
      p.line(cx, cy + k * d, cx + s * d * 0.52, cy + k * d + (k * 0.5) * d + s * wig);
    }
  p.noStroke();
  // shadow
  p.fill(0, 0, 0, 70 * alpha / 255);
  p.ellipse(cx + d * 0.04, cy + d * 0.08, d * 0.82, d * 0.9);
  // head + antennae
  p.fill(60, 34, 72, alpha);
  p.circle(cx, cy - d * 0.38, d * 0.42);
  p.stroke(60, 34, 72, alpha);
  p.strokeWeight(Math.max(1, d * 0.045));
  p.line(cx - d * 0.08, cy - d * 0.52, cx - d * 0.2, cy - d * 0.66);
  p.line(cx + d * 0.08, cy - d * 0.52, cx + d * 0.2, cy - d * 0.66);
  p.noStroke();
  // body
  p.fill(...PAL.rose, alpha);
  p.ellipse(cx, cy + d * 0.04, d * 0.8, d * 0.84);
  p.fill(255, 170, 190, 110 * alpha / 255);
  p.ellipse(cx - d * 0.16, cy - d * 0.12, d * 0.22, d * 0.16);
  // wing split + spots
  p.stroke(120, 34, 70, alpha);
  p.strokeWeight(Math.max(1, d * 0.04));
  p.line(cx, cy - d * 0.37, cx, cy + d * 0.45);
  p.noStroke();
  p.fill(120, 34, 70, alpha);
  for (const [sx, sy, r] of [[-0.2, 0.0, 0.14], [0.2, 0.0, 0.14], [-0.17, 0.25, 0.11], [0.17, 0.25, 0.11]])
    p.circle(cx + sx * d, cy + sy * d, r * d);
  // eyes
  p.fill(255, 255, 255, alpha);
  p.circle(cx - d * 0.09, cy - d * 0.44, d * 0.08);
  p.circle(cx + d * 0.09, cy - d * 0.44, d * 0.08);
}

// ---- info modal animation ----
// Scripted 5×5 board matching the real puzzle shape: homes at (0,0), (2,0),
// (3,2), (1,4), one bug already home at (4,4), and two loose bugs at (2,1)
// and (2,3). Click 1 at (3,2) pushes both loose bugs one step along their
// diagonal — (2,3) lands directly on its home at (1,4). Click 2 at (0,0)
// pushes the remaining bug from (1,0) onto its home at (2,0).

function infoAnim(p, w, h, frame) {
  const N = 5;
  const pad = 14;
  const cs = Math.min((w - pad * 2) / N, (h - pad * 2) / N);
  const bw = cs * N, bh = cs * N;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  const homes = [{ i: 0, j: 0 }, { i: 2, j: 0 }, { i: 3, j: 2 }, { i: 1, j: 4 }];
  const alreadyHome = { i: 4, j: 4 };

  // bug positions after each click, precomputed from the real push mechanic
  const bugsStart = [{ i: 2, j: 1 }, { i: 2, j: 3 }];
  const bugsAfterClick1 = [{ i: 1, j: 0 }, { i: 1, j: 4 }]; // (2,3) already home
  const bugsAfterClick2 = [{ i: 2, j: 0 }, { i: 1, j: 4 }]; // (1,0) now home too

  const click1 = { i: 3, j: 2 };
  const click2 = { i: 0, j: 0 };

  const PHASE_LEN = 70;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN); // 0 = first click, 1 = second click
  const localT = (t % PHASE_LEN) / PHASE_LEN;
  const clickFrac = 0.32, moveEnd = 0.78;

  function lerpBugs(from, to) {
    if (localT < clickFrac) return from;
    const mt = Math.min(1, (localT - clickFrac) / (moveEnd - clickFrac));
    const ease = easeInOutQuad(mt);
    return from.map((b, k) => ({ i: p.lerp(b.i, to[k].i, ease), j: p.lerp(b.j, to[k].j, ease) }));
  }

  const bugs = phase === 0 ? lerpBugs(bugsStart, bugsAfterClick1) : lerpBugs(bugsAfterClick1, bugsAfterClick2);
  const newBugShown = localT >= clickFrac;
  const click = phase === 0 ? click1 : click2;

  p.background(...PAL.board);
  p.noStroke();

  // homes (lit green once a bug has actually landed there)
  const settledPositions = phase === 0
    ? (localT >= moveEnd ? bugsAfterClick1 : bugsStart)
    : (localT >= moveEnd ? bugsAfterClick2 : bugsAfterClick1);
  const extras = [alreadyHome];
  if (phase === 1) extras.push(click1);
  const occupied = new Set([...settledPositions, ...extras].map(b => b.i + "," + b.j));

  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const home = homes.some(hm => hm.i === i && hm.j === j);
      drawTile(p, ox + i * cs, oy + j * cs, cs, home, home && occupied.has(i + "," + j), 0);
    }

  // click pulse ring, before the push happens
  if (localT < clickFrac) {
    const cx = ox + click.i * cs + cs/2, cy = oy + click.j * cs + cs/2;
    const pulse = 1.0 + 0.15 * p.sin(frame * 0.3);
    p.noFill();
    p.stroke(...PAL.lilac, 230);
    p.strokeWeight(2);
    p.circle(cx, cy, cs * 0.55 * pulse);
    p.noStroke();
  }

  function drawBug(pos, isHome) {
    drawBugShape(p, ox + pos.i * cs + cs / 2, oy + pos.j * cs + cs / 2, cs, isHome, frame + pos.i * 7);
  }

  drawBug(alreadyHome, true);
  bugs.forEach(b => {
    drawBug(b, localT >= moveEnd && homes.some(hm => hm.i === Math.round(b.i) && hm.j === Math.round(b.j)));
  });

  // the bug planted by click 1 stays on the board through phase 1 too —
  // it's not one of the original loose bugs, so it isn't in `bugs`
  if (phase === 1) drawBug(click1, homes.some(hm => hm.i === click1.i && hm.j === click1.j));

  // freshly-placed bug at the clicked cell
  if (newBugShown) drawBug(click, homes.some(hm => hm.i === click.i && hm.j === click.j));
}

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  if (!buildGame()) newGame();
}

function cell() { return (width - PAD * 2) / size; }
function bx(i) { return PAD + i * cell(); }

function hoveredCell() {
  if (mouseX < PAD || mouseY < PAD || mouseX >= width - PAD || mouseY >= height - PAD) return null;
  const i = Math.floor((mouseX - PAD) / cell()), j = Math.floor((mouseY - PAD) / cell());
  return i >= 0 && j >= 0 && i < size && j < size ? { i, j } : null;
}

function draw() {
  background(...PAL.board);
  const cs = cell();
  const solved = isSolved();

  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++) {
      const home = homes.some(h => h.i === i && h.j === j);
      drawTile(window, bx(i), bx(j), cs, home, home && bugs.some(b => b.i === i && b.j === j), frameCount);
      if (home && random() < 0.02) {
        addParticle({ x: bx(i) + cs / 2 + random(-8, 8), y: bx(j) + cs / 2 + random(-6, 6), vx: random(-0.2, 0.2), vy: random(-0.4, -1.2), life: 160, size: random(1, 2.5), col: PAL.sun });
      }
    }

  // hover preview: outline the cell, ghost arrows for every nudge
  const hv = !solved && clicksLeft() > 0 ? hoveredCell() : null;
  if (hv && !bugs.some(b => b.i === hv.i && b.j === hv.j)) {
    const { moves, blocked } = nudgesFor(hv.i, hv.j);
    const col = blocked ? PAL.rose : PAL.lilac;
    noFill(); stroke(...col, 200); strokeWeight(2);
    rect(bx(hv.i) + 3, bx(hv.j) + 3, cs - 6, cs - 6, cs * 0.16);
    strokeWeight(Math.max(2, cs * 0.05)); strokeCap(ROUND);
    for (const m of moves) {
      const x1 = bx(m.bug.i) + cs / 2, y1 = bx(m.bug.j) + cs / 2;
      const dx = m.ni - m.bug.i, dy = m.nj - m.bug.j;
      const x2 = x1 + dx * cs * 0.62, y2 = y1 + dy * cs * 0.62;
      stroke(...col, 170);
      line(x1 + dx * cs * 0.28, y1 + dy * cs * 0.28, x2, y2);
      const a = Math.atan2(dy, dx), hl = cs * 0.12;
      line(x2, y2, x2 - hl * Math.cos(a - 0.6), y2 - hl * Math.sin(a - 0.6));
      line(x2, y2, x2 - hl * Math.cos(a + 0.6), y2 - hl * Math.sin(a + 0.6));
    }
    cursor(blocked ? "not-allowed" : HAND);
  } else {
    cursor(ARROW);
  }

  if (blockedFlash && frameCount - blockedFlash.t < 24) {
    const k = 1 - (frameCount - blockedFlash.t) / 24;
    noStroke(); fill(...PAL.rose, 110 * k);
    rect(bx(blockedFlash.i) + 2, bx(blockedFlash.j) + 2, cs - 4, cs - 4, cs * 0.16);
  }

  // shockwaves
  for (let k = shockwaves.length - 1; k >= 0; k--) {
    const sw = shockwaves[k];
    sw.radius += 3.5; sw.life -= 12;
    if (sw.life <= 0 || sw.radius >= sw.maxRadius) { shockwaves.splice(k, 1); continue; }
    noFill(); stroke(...PAL.lilac, sw.life); strokeWeight(2);
    circle(sw.x, sw.y, sw.radius * 2);
  }

  for (const b of bugs) {
    b.x = lerp(b.x, b.i, 0.22);
    b.y = lerp(b.y, b.j, 0.22);
    const home = homes.some(h => b.i === h.i && b.j === h.j) && Math.abs(b.x - b.i) + Math.abs(b.y - b.j) < 0.2;
    // freshly placed bugs pop in with a little overshoot
    const age = b.born !== undefined ? frameCount - b.born : 99;
    const scale = age < 14 ? Math.min(1, age / 7) + Math.sin((age / 14) * Math.PI) * 0.2 : 1;
    drawBugShape(window, bx(0) + b.x * cs + cs / 2, bx(0) + b.y * cs + cs / 2, cs * scale, home, frameCount + b.i * 11 + b.j * 7);
  }

  drawParticles();

  if (solved) {
    setStatus("solved — every bug is home", "solved");
    if (!wasSolved) {
      wasSolved = true;
      // difficulty ~ placements (slider 1-10, presets are 2/3/5/7)
      celebrate(1 + Math.round((numRemove - 1) / (10 - 1) * 2));
    }
  } else {
    const home = homes.filter(h => bugs.some(b => b.i === h.i && b.j === h.j)).length;
    const left = clicksLeft();
    if (left <= 0) setStatus(home + " / " + homes.length + " home · out of placements — undo or restart", "dead");
    else setStatus(home + " / " + homes.length + " home · " + left + (left === 1 ? " placement" : " placements") + " left", null);
  }
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  const hv = hoveredCell();
  if (!hv || isSolved()) return;
  if (clicksLeft() <= 0) { flashNote("No placements left — undo or restart."); return false; }
  if (bugs.some(b => b.i === hv.i && b.j === hv.j)) { flashNote("That cell already has a bug."); return false; }
  place(hv.i, hv.j);
  return false;
}

function keyPressed() {
  if (key === "n" || key === "N") { newGame(); return false; }
  if (key === "r" || key === "R" || key === " ") { if (isSolved()) newGame(); else restart(); return false; }
  if (key === "u" || key === "U" || ((key === "z" || key === "Z") && (keyIsDown(CONTROL) || keyIsDown(91)))) { undo(); return false; }
  if (key === "h" || key === "H") { confirmHint(hintStep); return false; }
}
