// Snake II — 1 or 2 player, smooth continuous trails.
// Glowing gradient pill-segments, floating food with heat trails, boost sparks, and death burst effects.

initGame({
   title: "Snake",
   tag: "glowing pill segments · smooth",
   fullscreen: true,
   presets: [
    { label: "Normal",     values: [40, 26, 90] },
    { label: "Compact",    values: [24, 16, 120] },
    { label: "Huge (slow)",values: [55, 36, 110] },
  ],
  buttons: [
    { id: "btn-reset", label: "Reset",             onClick: () => newGame() },
    { id: "btn-2p",    label: "2 Player Mode",     onClick: () => toggle2P() },
    { id: "btn-loop",  label: "Screen Loop",       onClick: () => toggleLoop() },
  ],
  sliders: [
    { id: "s-gw", label: "Grid width",  min: 16, max: 60, step: 1 },
    { id: "s-gh", label: "Grid height", min: 12, max: 40, step: 1 },
  ],
  onPreset: ([w, h, ms]) => { gridW = w; gridH = h; baseMs = ms; saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => {
    if (id === "s-gw") gridW = v;
    else if (id === "s-gh") gridH = v;
  },
  onClamp: () => {},
  getSliderValues: () => ({ "s-gw": gridW, "s-gh": gridH }),
  info: { anim: infoAnim },
});

let gridW = 40;
let gridH = 26;
let baseMs = 100;
let twoPlayer = false;
let edgeLoop = true;

let s1, s2;
let food = [];
let gameOver = false;
let started = false;
let tickTimer = null;

// boost state
let s1Boost = false;
let s2Boost = false;
let s1BoostTick = 0;
let s2BoostTick = 0;

const C1     = [127, 176, 105];
const C1HEAD = [190, 240, 150];
const C2     = [90,  160, 210];
const C2HEAD = [150, 210, 255];
const FOOD_C = [230, 180, 34];
const BG     = [20,  18,  15];
const GRID_C = [28,  25,  22];

const MIN_LEN = 3;

// Particle system
let particles = [];

function makeSnake(startX, startY, dirX, color, headColor) {
  return {
    body: [
      { x: startX, y: startY },
      { x: startX - dirX, y: startY },
      { x: startX - dirX * 2, y: startY },
    ],
    dir: { x: dirX, y: 0 },
    queue: [],
    dead: false,
    score: 0,
    color,
    headColor,
  };
}

function tickInterval(snake) {
  if (!twoPlayer) return baseMs;
  const len = snake.body.length;
  const t = Math.max(0, (len - 3) / 40);
  return Math.round(baseMs * (0.5 + t));
}

function spawnFood() {
  const occupied = new Set();
  s1.body.forEach(b => occupied.add(b.x + "," + b.y));
  if (twoPlayer) s2.body.forEach(b => occupied.add(b.x + "," + b.y));
  food.forEach(f => occupied.add(f.x + "," + f.y));
  const free = [];
  for (let x = 0; x < gridW; x++)
    for (let y = 0; y < gridH; y++)
      if (!occupied.has(x + "," + y)) free.push({ x, y });
  if (free.length) food.push(free[Math.floor(Math.random() * free.length)]);
}

function spawnFoodAt(cells) {
  cells.forEach((c, i) => { if (i % 2 === 0) food.push({ x: c.x, y: c.y }); });
}

function newGame() {
  clearInterval(tickTimer);
  s1 = makeSnake(Math.floor(gridW * 0.25), Math.floor(gridH / 2),  1, C1, C1HEAD);
  s2 = makeSnake(Math.floor(gridW * 0.75), Math.floor(gridH / 2), -1, C2, C2HEAD);
  food = [];
  spawnFood(); spawnFood(); spawnFood();
  gameOver = false;
  started = false;
  s1Boost = s2Boost = false;
  particles = [];
  setStatus(twoPlayer ? "P1 vs P2 · any key to start" : "any key to start", null);
  clearInterval(tickTimer);
  tickTimer = setInterval(mainTick, 40);
}

let _t = 0;
let _s1Next = 0, _s2Next = 0;

function mainTick() {
  if (!started || gameOver) return;
  _t += 40;

  const move1 = _t >= _s1Next;
  const move2 = twoPlayer && _t >= _s2Next;

  if (move1) {
    const iv = s1Boost ? Math.max(40, tickInterval(s1) / 2) : tickInterval(s1);
    _s1Next = _t + iv;
    if (!s1.dead) {
      if (s1Boost) spawnBoostSparks(s1);
      advanceSnake(s1, s1Boost);
      s1Boost = false;
    }
  }
  if (move2) {
    const iv = s2Boost ? Math.max(40, tickInterval(s2) / 2) : tickInterval(s2);
    _s2Next = _t + iv;
    if (!s2.dead) {
      if (s2Boost) spawnBoostSparks(s2);
      advanceSnake(s2, s2Boost);
      s2Boost = false;
    }
  }

  if (!move1 && !move2) return;

  eatFood();
  checkCollisions();

  if (gameOver) {
    clearInterval(tickTimer);
    setStatus(`game over · score ${s1.score} · space to restart`, "dead");
  } else {
    setStatus(twoPlayer
      ? `P1 kills ${s1.score} (len ${s1.body.length}) · P2 kills ${s2.score} (len ${s2.body.length})`
      : `score ${s1.score} · length ${s1.body.length}`, null);
  }
}

function advanceSnake(s, boost) {
  if (s.queue.length) s.dir = s.queue.shift();
  const nx = s.body[0].x + s.dir.x;
  const ny = s.body[0].y + s.dir.y;
  const head = edgeLoop
    ? { x: (nx + gridW) % gridW, y: (ny + gridH) % gridH }
    : { x: nx, y: ny };
  s.body.unshift(head);
  if (boost && s.body.length > MIN_LEN) {
    s.body.pop();
    s.body.pop();
  } else {
    s.body.pop();
  }
}

function spawnDeathSparks(s) {
  const head = s.body[0];
  const count = 30;
  const cs = Math.max(4, Math.floor(Math.min(width / gridW, (height - 60) / gridH)));
  const uiH = document.getElementById("ui-overlay")?.offsetHeight ?? 60;
  const availH = height - uiH;
  const offX = Math.floor((width - cs * gridW) / 2);
  const offY = uiH + Math.floor((availH - cs * gridH) / 2);

  s.body.forEach(seg => {
    const cx = offX + seg.x * cs + cs / 2;
    const cy = offY + seg.y * cs + cs / 2;
    for (let k = 0; k < 3; k++) {
      particles.push({
        x: cx,
        y: cy,
        vx: random(-3, 3),
        vy: random(-3, 3),
        life: random(100, 200),
        size: random(2, 5),
        col: s.color
      });
    }
  });
}

function spawnBoostSparks(s) {
  const tail = s.body[s.body.length - 1];
  const cs = Math.max(4, Math.floor(Math.min(width / gridW, (height - 60) / gridH)));
  const uiH = document.getElementById("ui-overlay")?.offsetHeight ?? 60;
  const availH = height - uiH;
  const offX = Math.floor((width - cs * gridW) / 2);
  const offY = uiH + Math.floor((availH - cs * gridH) / 2);
  
  const cx = offX + tail.x * cs + cs / 2;
  const cy = offY + tail.y * cs + cs / 2;
  
  for (let k = 0; k < 6; k++) {
    particles.push({
      x: cx,
      y: cy,
      vx: -s.dir.x * random(1.5, 4.5) + random(-0.5, 0.5),
      vy: -s.dir.y * random(1.5, 4.5) + random(-0.5, 0.5),
      life: random(80, 140),
      size: random(1.5, 3.5),
      col: [243, 237, 224] // white rocket spark
    });
  }
}

function spawnEatSparks(x, y, col) {
  for (let k = 0; k < 12; k++) {
    const angle = random(TWO_PI);
    const speed = random(1, 3);
    particles.push({
      x,
      y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      life: random(100, 160),
      size: random(2, 4),
      col
    });
  }
}

function eatFood() {
  const cs = Math.max(4, Math.floor(Math.min(width / gridW, (height - 60) / gridH)));
  const uiH = document.getElementById("ui-overlay")?.offsetHeight ?? 60;
  const availH = height - uiH;
  const offX = Math.floor((width - cs * gridW) / 2);
  const offY = uiH + Math.floor((availH - cs * gridH) / 2);

  food = food.filter(f => {
    const cx = offX + f.x * cs + cs / 2;
    const cy = offY + f.y * cs + cs / 2;

    const hit1 = s1.body[0].x === f.x && s1.body[0].y === f.y;
    const hit2 = twoPlayer && s2.body[0].x === f.x && s2.body[0].y === f.y;
    if (hit1) {
      s1.body.push({ ...s1.body[s1.body.length - 1] });
      s1.score++;
      spawnEatSparks(cx, cy, FOOD_C);
      spawnFood();
      return false;
    }
    if (hit2) {
      s2.body.push({ ...s2.body[s2.body.length - 1] });
      s2.score++;
      spawnEatSparks(cx, cy, FOOD_C);
      spawnFood();
      return false;
    }
    return true;
  });
}

function checkCollisions() {
  // P1 collides with wall
  if (!edgeLoop && (s1.body[0].x < 0 || s1.body[0].x >= gridW || s1.body[0].y < 0 || s1.body[0].y >= gridH)) {
    s1.dead = true;
  }
  // P2 collides with wall
  if (twoPlayer && !edgeLoop && (s2.body[0].x < 0 || s2.body[0].x >= gridW || s2.body[0].y < 0 || s2.body[0].y >= gridH)) {
    s2.dead = true;
  }

  // Self and cross collisions
  const h1 = s1.body[0];
  const h2 = twoPlayer ? s2.body[0] : null;

  s1.body.forEach((b, k) => {
    if (k > 0 && h1.x === b.x && h1.y === b.y) s1.dead = true;
    if (h2 && h2.x === b.x && h2.y === b.y) s2.dead = true;
  });

  if (twoPlayer) {
    s2.body.forEach((b, k) => {
      if (k > 0 && h2.x === b.x && h2.y === b.y) s2.dead = true;
      if (h1.x === b.x && h1.y === b.y) s1.dead = true;
    });
  }

  if (s1.dead && !gameOver) {
    spawnDeathSparks(s1);
    spawnFoodAt(s1.body);
    s1.body = [{ x: -99, y: -99 }];
  }
  if (twoPlayer && s2.dead && !gameOver) {
    spawnDeathSparks(s2);
    spawnFoodAt(s2.body);
    s2.body = [{ x: -99, y: -99 }];
  }

  if (twoPlayer) {
    if (s1.dead && s2.dead) gameOver = true;
  } else {
    if (s1.dead) gameOver = true;
  }
}

function tryDir(s, dx, dy) {
  if (s.dead) return;
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (last.x + dx === 0 && last.y + dy === 0) return;
  s.queue.push({ x: dx, y: dy });
  if (s.queue.length > 3) s.queue.shift();
}

// Slider / Button helpers
function toggle2P() {
  twoPlayer = !twoPlayer;
  setButtonActive("btn-2p", twoPlayer);
  saveState();
  newGame();
}

function toggleLoop() {
  edgeLoop = !edgeLoop;
  setButtonActive("btn-loop", edgeLoop);
  saveState();
}

function saveState() {
  localStorage.setItem("snake_state", JSON.stringify({ gridW, gridH, twoPlayer, edgeLoop }));
}
function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem("snake_state") || "{}");
    if (typeof d.gridW === "number") gridW = d.gridW;
    if (typeof d.gridH === "number") gridH = d.gridH;
    if (typeof d.twoPlayer === "boolean") twoPlayer = d.twoPlayer;
    if (typeof d.edgeLoop === "boolean") edgeLoop = d.edgeLoop;
  } catch {}
}

loadState();
syncSliderUI();
setButtonActive("btn-2p", twoPlayer);
setButtonActive("btn-loop", edgeLoop);

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 5;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ---- info modal animation ----
// A scripted mini-board: steer toward food to eat and grow, then a reminder
// that running the head into your own body ends the run.

function infoAnim(p, w, h, frame) {
  const gw = 8, gh = 6;
  const cs = Math.min(w / gw, h / gh) * 0.9;
  const bw = cs * gw, bh = cs * gh;
  const ox = Math.floor((w - bw) / 2);
  const oy = Math.floor((h - bh) / 2);

  const PHASE_LEN = 80;
  const t = frame % (PHASE_LEN * 2);
  const phase = Math.floor(t / PHASE_LEN);
  const localT = (t % PHASE_LEN) / PHASE_LEN;

  p.background(20, 18, 15);
  p.stroke(28, 25, 22); p.strokeWeight(1);
  for (let x = 0; x <= gw; x++) p.line(ox + x*cs, oy, ox + x*cs, oy + gh*cs);
  for (let y = 0; y <= gh; y++) p.line(ox, oy + y*cs, ox + gw*cs, oy + y*cs);
  p.noStroke();

  function drawFood(gx, gy) {
    const cx = ox+gx*cs+cs/2, cy = oy+gy*cs+cs/2;
    p.fill(230, 180, 34, 30); p.circle(cx, cy, cs * 0.9);
    p.fill(230, 180, 34); p.circle(cx, cy, cs * 0.55);
    p.fill(243, 237, 224); p.circle(cx, cy, cs * 0.25);
  }

  function drawSnake(body, dir) {
    const [hr, hg, hb] = [190, 240, 150];
    const [r, g, b] = [127, 176, 105];
    body.forEach((seg, i) => {
      if (i === 0) return;
      const prev = body[i - 1];
      const cx1 = ox+seg.x*cs+cs/2, cy1 = oy+seg.y*cs+cs/2;
      const cx2 = ox+prev.x*cs+cs/2, cy2 = oy+prev.y*cs+cs/2;
      const factor = i / (body.length - 1);
      p.stroke(p.lerp(hr,r,factor), p.lerp(hg,g,factor), p.lerp(hb,b,factor), 220);
      p.strokeWeight(cs * 0.74);
      p.line(cx1, cy1, cx2, cy2);
    });
    p.noStroke();
    body.forEach((seg, i) => {
      const cx = ox+seg.x*cs+cs/2, cy = oy+seg.y*cs+cs/2;
      const factor = i / (body.length - 1);
      if (i === 0) {
        p.fill(hr, hg, hb, 40); p.circle(cx, cy, cs * 0.95);
        p.fill(hr, hg, hb); p.circle(cx, cy, cs * 0.46);
        p.fill(20, 18, 15);
        const eyeOff = cs * 0.16;
        if (dir.x !== 0) { p.circle(cx + dir.x*eyeOff, cy - eyeOff, cs*0.08); p.circle(cx + dir.x*eyeOff, cy + eyeOff, cs*0.08); }
        else { p.circle(cx - eyeOff, cy + dir.y*eyeOff, cs*0.08); p.circle(cx + eyeOff, cy + dir.y*eyeOff, cs*0.08); }
      } else {
        p.fill(p.lerp(hr,r,factor), p.lerp(hg,g,factor), p.lerp(hb,b,factor), 220);
        p.circle(cx, cy, cs * 0.42);
      }
    });
  }

  if (phase === 0) {
    // approach and eat food at (5,3), growing by one segment
    const startX = 1;
    const headX = p.lerp(startX, 5, localT);
    const grown = localT > 0.75;
    const body = [{ x: headX, y: 3 }, { x: headX - 1, y: 3 }, { x: headX - 2, y: 3 }];
    if (grown) body.push({ x: headX - 3, y: 3 });
    if (!grown) drawFood(5, 3);
    drawSnake(body, { x: 1, y: 0 });
  } else {
    // coil demonstration: head approaches its own body and the wrap flashes red
    const body = [
      { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 4 },
      { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 2 },
    ];
    const hit = localT > 0.6;
    const flash = hit && Math.floor(frame / 6) % 2 === 0;
    drawSnake(body, { x: 1, y: 0 });
    if (flash) {
      const cx = ox + 3*cs + cs/2, cy = oy + 2*cs + cs/2;
      p.noFill(); p.stroke(200, 50, 63, 220); p.strokeWeight(3);
      p.circle(cx, cy, cs * 0.9);
    }
  }
}

// ---- p5 Sketch ----

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("canvas-wrap");
  _t = 0; _s1Next = 0; _s2Next = 0;
  newGame();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  const uiH = document.getElementById("ui-overlay")?.offsetHeight ?? 60;
  const availH = height - uiH;
  const cs = Math.max(4, Math.floor(Math.min(width / gridW, availH / gridH)));
  const offX = Math.floor((width - cs * gridW) / 2);
  const offY = uiH + Math.floor((availH - cs * gridH) / 2);

  background(BG[0], BG[1], BG[2]);

  // grid lines
  if (cs >= 8) {
    stroke(GRID_C[0], GRID_C[1], GRID_C[2]);
    strokeWeight(1);
    for (let x = 0; x <= gridW; x++) line(offX + x*cs, offY, offX + x*cs, offY + gridH*cs);
    for (let y = 0; y <= gridH; y++) line(offX, offY + y*cs, offX + gridW*cs, offY + y*cs);
  } else {
    noStroke(); fill(GRID_C[0], GRID_C[1], GRID_C[2]);
    rect(offX, offY, gridW * cs, gridH * cs);
  }

  // Draw floating food with ascending warmth particles
  noStroke();
  food.forEach(f => {
    const cx = offX + f.x*cs + cs/2;
    const floatY = sin(frameCount * 0.12 + f.x * 7) * (cs * 0.08);
    const cy = offY + f.y*cs + cs/2 + floatY;

    // Heat trail sparks
    if (random() < 0.08) {
      particles.push({
        x: cx + random(-4, 4),
        y: cy,
        vx: random(-0.2, 0.2),
        vy: random(-0.4, -1.2),
        life: 120,
        size: random(1, 2.5),
        col: FOOD_C
      });
    }

    // Outer glow
    fill(FOOD_C[0], FOOD_C[1], FOOD_C[2], 30);
    circle(cx, cy, cs * 0.9);
    
    // Core
    fill(FOOD_C[0], FOOD_C[1], FOOD_C[2]);
    circle(cx, cy, cs * 0.55);
    
    // Brighter center core
    fill(243, 237, 224);
    circle(cx, cy, cs * 0.25);
  });

  // Draw snakes with gradient pill-segments
  drawSnakeBody(s1, offX, offY, cs);
  if (twoPlayer) drawSnakeBody(s2, offX, offY, cs);

  // Update & Draw particles
  updateParticles();
  for (const p of particles) {
    fill(p.col[0], p.col[1], p.col[2], p.life);
    noStroke();
    circle(p.x, p.y, p.size * (p.life / 255));
  }
}

function drawSnakeBody(s, offX, offY, cs) {
  if (!s || s.dead) return;
  const [r, g, b] = s.color;
  const [hr, hg, hb] = s.headColor;
  const pad = Math.max(1, cs * 0.06);
  const segmentRadius = cs * 0.42;

  // Render connections first (snake body tube)
  s.body.forEach((seg, i) => {
    if (i === 0) return;
    const prev = s.body[i - 1];

    // If wrap check fails, don't draw connection line
    const wrapCheck = Math.abs(seg.x - prev.x) <= 1 && Math.abs(seg.y - prev.y) <= 1;
    if (wrapCheck) {
      const cx1 = offX + seg.x * cs + cs / 2;
      const cy1 = offY + seg.y * cs + cs / 2;
      const cx2 = offX + prev.x * cs + cs / 2;
      const cy2 = offY + prev.y * cs + cs / 2;

      // Color gradient interpolation
      const factor = i / (s.body.length - 1);
      const segmentColor = [
        lerp(hr, r, factor),
        lerp(hg, g, factor),
        lerp(hb, b, factor)
      ];

      stroke(segmentColor[0], segmentColor[1], segmentColor[2], 220);
      strokeWeight(cs * 0.74);
      line(cx1, cy1, cx2, cy2);
    }
  });

  // Render segment nodes
  s.body.forEach((seg, i) => {
    const cx = offX + seg.x * cs + cs / 2;
    const cy = offY + seg.y * cs + cs / 2;

    const factor = i / (s.body.length - 1);
    const segmentColor = [
      lerp(hr, r, factor),
      lerp(hg, g, factor),
      lerp(hb, b, factor)
    ];

    noStroke();
    
    // Head shape vs tail
    if (i === 0) {
      // Glow head ring
      fill(hr, hg, hb, 40);
      circle(cx, cy, cs * 0.95);
      
      // Main head
      fill(hr, hg, hb);
      circle(cx, cy, cs * 0.46);
      
      // Subtle eyes
      fill(20, 18, 15);
      const eyeOffset = cs * 0.16;
      if (s.dir.x !== 0) {
        circle(cx + s.dir.x * eyeOffset, cy - eyeOffset, cs * 0.08);
        circle(cx + s.dir.x * eyeOffset, cy + eyeOffset, cs * 0.08);
      } else {
        circle(cx - eyeOffset, cy + s.dir.y * eyeOffset, cs * 0.08);
        circle(cx + eyeOffset, cy + s.dir.y * eyeOffset, cs * 0.08);
      }
    } else {
      fill(segmentColor[0], segmentColor[1], segmentColor[2], 220);
      circle(cx, cy, segmentRadius);
    }
  });
}

function keyPressed() {
  if (!started) { started = true; _t = 0; _s1Next = 0; _s2Next = 0; }

  if (gameOver && keyCode === 32) { newGame(); return false; }

  // P1: arrows
  if (keyCode === LEFT_ARROW)  tryDir(s1, -1,  0);
  if (keyCode === RIGHT_ARROW) tryDir(s1,  1,  0);
  if (keyCode === UP_ARROW)    tryDir(s1,  0, -1);
  if (keyCode === DOWN_ARROW)  tryDir(s1,  0,  1);
  if (keyCode === 32 && !gameOver && s1.body.length > MIN_LEN) s1Boost = true;

  if (twoPlayer) {
    // P2: WASD
    if (key === "a" || key === "A") tryDir(s2, -1,  0);
    if (key === "d" || key === "D") tryDir(s2,  1,  0);
    if (key === "w" || key === "W") tryDir(s2,  0, -1);
    if (key === "s" || key === "S") tryDir(s2,  0,  1);
    if ((keyCode === 16) && s2.body.length > MIN_LEN) s2Boost = true;
  } else {
    // 1P: WASD also steers P1
    if (key === "a" || key === "A") tryDir(s1, -1,  0);
    if (key === "d" || key === "D") tryDir(s1,  1,  0);
    if (key === "w" || key === "W") tryDir(s1,  0, -1);
    if (key === "s" || key === "S") tryDir(s1,  0,  1);
  }

  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW, 32].includes(keyCode)) return false;
}
