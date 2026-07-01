// Bug Nudge — push every bug home.
// Cute wiggling legs, pulsing home fields, expanding click shockwaves, and slide trails.

initGame({
  title: "Bug Nudge",
  tag: "push bugs home",
  presets: [
    { label: "Medium (standard)", values: [5,  6,  3] },
    { label: "Easy",             values: [5,  5,  2] },
    { label: "Hard",             values: [7,  10, 5] },
    { label: "Harder",           values: [8,  12, 7] },
  ],
  buttons: [
    { id: "btn-reset",     label: "Reset",      onClick: () => resetGame() },
    { id: "btn-new",       label: "New puzzle", primary: true, onClick: () => newGame() },
    { id: "btn-hint",      label: "Hint",       onClick: () => confirmHint(hintStep) },
    { id: "btn-undo-bugs", label: "Undo",       onClick: () => undoBugs() },
  ],
  sliders: [
    { id: "s-size",   label: "Grid size", min: 4, max: 10, step: 1, fmt: v => v + "×" + v },
    { id: "s-bugs",   label: "Bugs",      min: 2, max: 20, step: 1 },
    { id: "s-remove", label: "Removals",  min: 1, max: 10, step: 1 },
  ],
  onPreset: ([s, b, r]) => { size = s; numBugs = b; numRemove = r; clamp(); syncSliderUI(); seed = floor(Math.random() * 1e9); buildGame(); },
  onSlider: (id, v) => { if (id === "s-size") size = v; else if (id === "s-bugs") numBugs = v; else numRemove = v; },
  onClamp: clamp,
  getSliderValues: () => ({ "s-size": size, "s-bugs": numBugs, "s-remove": numRemove }),
});

let size = 5;
let numBugs = 6;
let numRemove = 3;

let homes = [];
let bugs = [];
let removedCells = [];
let seed = 0;
let clicksLeft = 0;

const PULL = 2, PUSH = 1;
const CANVAS = 400;

// Particle system & Shockwaves
let particles = [];
let shockwaves = [];

function shift(list, cx, cy, dist, dir) {
  list.forEach((b) => {
    const dx = b.i - cx, dy = b.j - cy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const onRing = (ax === dist || ax === 0) && (ay === dist || ay === 0) && (ax === dist || ay === dist);
    if (onRing) { 
      b.i += dir * Math.sign(cx - b.i); 
      b.j += dir * Math.sign(cy - b.j); 
      
      // Slide trail sparks
      spawnSlideSparks(b.x, b.y);
    }
  });
}
const pushbugs = (cx, cy) => shift(bugs, cx, cy, PUSH, -1);

function hasNeighbour(ci, cj, list) {
  return list.some(b => !(b.i === ci && b.j === cj) && Math.abs(b.i - ci) <= 1 && Math.abs(b.j - cj) <= 1);
}

function shiftSafe(list, cx, cy, dist, dir) {
  const moved = list.map((b) => {
    const dx = b.i - cx, dy = b.j - cy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const onRing = (ax === dist || ax === 0) && (ay === dist || ay === 0) && (ax === dist || ay === dist);
    return onRing
      ? { i: b.i + dir * Math.sign(cx - b.i), j: b.j + dir * Math.sign(cy - b.j) }
      : { i: b.i, j: b.j };
  });
  const seen = new Set(moved.map(m => m.i + "," + m.j));
  if (seen.size !== moved.length) return false;
  moved.forEach((m, k) => { list[k].i = m.i; list[k].j = m.j; });
  return true;
}

function buildGame() {
  for (let tries = 0; tries < 10000; tries++) {
    randomSeed(seed);
    let h = [];
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size; j++) h.push({ i, j });
    h = h.sort(() => 0.5 - random()).slice(0, numBugs);

    let b = h.map(e => ({ ...e, hi: e.i, hj: e.j }));
    let removed = [];
    let valid = true;

    for (let n = 0; n < numRemove; n++) {
      const r = floor(random() * b.length);
      const cell = b[r];
      if (hasNeighbour(cell.i, cell.j, b)) { valid = false; break; }
      removed.push({ i: cell.i, j: cell.j });
      b.splice(r, 1);
      if (!shiftSafe(b, cell.i, cell.j, PULL, 1)) { valid = false; break; }
    }

    if (valid && b.filter(e => e.i === e.hi && e.j === e.hj).length >= 3) valid = false;

    if (valid) {
      homes = h; bugs = b; removedCells = removed;
      clicksLeft = removed.length;
      bugs.forEach(e => { e.x = e.i; e.y = e.j; });
      saveState();
      resetHintConfirm();
      flashNote("");
      particles = [];
      shockwaves = [];
      return true;
    }
    seed++;
  }
  flashNote("couldn't generate — try fewer removals or more space");
  return false;
}

function resetGame() {
  prevBugs = null; canUndoBugs = false;
  buildGame();
}

function newGame() {
  prevBugs = null; canUndoBugs = false;
  seed = floor(Math.random() * 1e9);
  buildGame();
}

let prevBugs = null;
let prevClicksLeft = 0;
let canUndoBugs = false;

function applyClick(i, j) {
  prevBugs = bugs.map(b => ({ ...b }));
  prevClicksLeft = clicksLeft;
  canUndoBugs = true;
  setButtonActive("btn-undo-bugs", false);
  
  // Click shockwave
  const cs = cell();
  const cx = i * cs + cs / 2;
  const cy = j * cs + cs / 2;
  shockwaves.push({ x: cx, y: cy, radius: 0, maxRadius: cs * 1.5, life: 255 });

  pushbugs(i, j);
  bugs.push({ i, j, x: i, y: j });
  clicksLeft -= 1;
}

function undoBugs() {
  if (!canUndoBugs || !prevBugs) return;
  bugs = prevBugs;
  clicksLeft = prevClicksLeft;
  canUndoBugs = false;
  prevBugs = null;
  setStatus("undone", null);
}

function isSolved() {
  return bugs.length >= homes.length && homes.every(h => bugs.some(b => b.i === h.i && b.j === h.j));
}

function hintStep() {
  if (!removedCells.length) { flashNote("no hints left"); return; }
  const c = removedCells.pop();
  applyClick(c.i, c.j);
}

function saveState() {
  localStorage.setItem("bugs_state", JSON.stringify({ size, numBugs, numRemove, seed }));
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem("bugs_state") || "{}");
    if (typeof d.size === "number") size = d.size;
    if (typeof d.numBugs === "number") numBugs = d.numBugs;
    if (typeof d.numRemove === "number") numRemove = d.numRemove;
    if (typeof d.seed === "number") seed = d.seed;
  } catch {}
}

function clamp() {
  numBugs = Math.min(numBugs, size * size);
  numRemove = Math.min(numRemove, numBugs);
}

// Particle system helpers
function spawnSlideSparks(gx, gy) {
  const cs = cell();
  const cx = gx * cs + cs / 2;
  const cy = gy * cs + cs / 2;
  for (let k = 0; k < 4; k++) {
    particles.push({
      x: cx + random(-4, 4),
      y: cy + random(-4, 4),
      vx: random(-0.8, 0.8),
      vy: random(-0.8, 0.8),
      life: 150,
      size: random(1.5, 3),
      col: [200, 50, 63] // bug red trail
    });
  }
}

function spawnHomeSparks(cx, cy) {
  if (random() < 0.1) {
    particles.push({
      x: cx + random(-8, 8),
      y: cy + random(-8, 8),
      vx: random(-0.3, 0.3),
      vy: random(-0.5, -1.8), // float upwards
      life: 180,
      size: random(1, 2.5),
      col: [230, 180, 34] // gold sparks
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 6;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateShockwaves() {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.radius += 3.5;
    s.life -= 12;
    if (s.life <= 0 || s.radius >= s.maxRadius) {
      shockwaves.splice(i, 1);
    }
  }
}

loadState();
syncSliderUI();
setButtonActive("btn-undo-bugs", canUndoBugs);

// ---- p5 lifecycle ----

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  newGame();
}

function cell() { return width / size; }

function draw() {
  background(20, 18, 15);
  const cs = cell();

  // Draw homes with magnetic fields
  noStroke();
  homes.forEach(e => {
    // Glow backdrop
    fill(230, 180, 34, 40); rect(e.i * cs, e.j * cs, cs, cs);
    
    // Magnet grid lines pulse
    const pulse = 1.0 + 0.08 * sin(frameCount * 0.12 + (e.i + e.j));
    const sizeP = cs * 0.16 * pulse;
    fill(230, 180, 34);
    rect(e.i * cs + cs / 2 - sizeP / 2, e.j * cs + cs / 2 - sizeP / 2, sizeP, sizeP, 2);
    
    // Float upward particles
    const cx = e.i * cs + cs / 2;
    const cy = e.j * cs + cs / 2;
    spawnHomeSparks(cx, cy);
  });

  // Draw static grid lines
  stroke(58, 53, 46); strokeWeight(1);
  for (let g = 0; g <= width + 0.5; g += cs) { line(g, 0, g, height); line(0, g, width, g); }

  // Draw bugs with legs & breathing animation
  bugs.forEach(b => {
    b.x = lerp(b.x, b.i, 0.22);
    b.y = lerp(b.y, b.j, 0.22);

    const cx = b.x * cs + cs / 2;
    const cy = b.y * cs + cs / 2;

    const isHome = homes.some(h => b.i === h.i && b.j === h.j);

    // Breathing wobble
    const breath = 1.0 + 0.05 * sin(frameCount * 0.16 + (b.i + b.j));
    const rBase = cs * 0.52 * breath;

    // Draw active home lock ring if bug landed home
    if (isHome) {
      noFill();
      stroke(127, 176, 105, 180);
      strokeWeight(2);
      circle(cx, cy, rBase * 1.15);
    }

    // Draw Legs
    stroke(130, 32, 40);
    strokeWeight(Math.max(1.5, cs * 0.04));

    // Bug main body
    noStroke();
    fill(200, 50, 63);
    circle(cx, cy, rBase);
    
    // Glowing central core (if home, green. Else, light red)
    noStroke();
    if (isHome) {
      fill(190, 240, 150);
    } else {
      fill(250, 100, 110);
    }
    circle(cx, cy, rBase * 0.3);
  });

  // Draw shockwaves
  updateShockwaves();
  for (const s of shockwaves) {
    noFill();
    stroke(127, 176, 105, s.life);
    strokeWeight(2);
    circle(s.x, s.y, s.radius * 2);
  }

  // Draw particles
  updateParticles();
  for (const p of particles) {
    fill(p.col[0], p.col[1], p.col[2], p.life);
    noStroke();
    circle(p.x, p.y, p.size * (p.life / 255));
  }

  // Status updates
  if (isSolved()) {
    setStatus("solved — every bug is home", "solved");
  } else {
    const placed = homes.filter(h => bugs.some(b => b.i === h.i && b.j === h.j)).length;
    setStatus(placed + " / " + homes.length + " bugs home · " + clicksLeft + " left", null);
  }
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (clicksLeft <= 0) { flashNote("no placements left — reset to try again"); return; }
  const cs = cell();
  const i = Math.floor(mouseX / cs), j = Math.floor(mouseY / cs);
  if (i < 0 || i >= size || j < 0 || j >= size) return;
  if (bugs.some(b => b.i === i && b.j === j)) { flashNote("can't place — cell already occupied"); return; }
  applyClick(i, j);
}

function keyPressed() {
  if (key === " ") { if (isSolved()) newGame(); else resetGame(); }
}
