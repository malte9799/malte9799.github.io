// Snake — 1 or 2 players on one keyboard, swipe controls on touch screens.

initGame({
   title: "Snake",
   tag: "eat · grow · survive",
   fullscreen: true,
   presets: [
    { label: "Normal",     values: [40, 26, 90] },
    { label: "Compact",    values: [24, 16, 120] },
    { label: "Huge (slow)",values: [55, 36, 110] },
  ],
  buttons: [
    { id: "btn-reset", label: "Restart",       onClick: () => newGame() },
    { id: "btn-2p",    label: "2 Players",     onClick: () => toggle2P() },
    { id: "btn-loop",  label: "Wrap edges",    onClick: () => toggleLoop() },
  ],
  sliders: [
    { id: "s-gw", label: "Grid width",  min: 16, max: 60, step: 1 },
    { id: "s-gh", label: "Grid height", min: 12, max: 40, step: 1 },
    { id: "s-ms", label: "Step time",   min: 50, max: 160, step: 10, fmt: v => v + " ms" },
  ],
  onPreset: ([w, h, ms]) => { gridW = w; gridH = h; baseMs = ms; saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => {
    if (id === "s-gw") gridW = v;
    else if (id === "s-gh") gridH = v;
    else baseMs = v;
  },
  onClamp: () => {},
  getSliderValues: () => ({ "s-gw": gridW, "s-gh": gridH, "s-ms": baseMs }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Steer with the arrow keys or WASD (or swipe), eat the glowing food to grow, and don't run into your own body. Space gives a short boost that burns tail length. P pauses.",
      "2 Players: P1 arrows + Space boost, P2 WASD + Shift boost — the first snake to crash loses. With “Wrap edges” off, the walls are deadly too.",
    ],
  },
});

let gridW = 40;
let gridH = 26;
let baseMs = 90;
let twoPlayer = false;
let edgeLoop = true;

let s1, s2;
let food = [];
let gameOver = false;
let started = false;
let paused = false;
let tickTimer = null;
let winner = null;     // 2P: "P1" | "P2" | "draw"
let best = 0;          // 1P high score for the current settings
let newBest = false;

// boost state
let s1Boost = false;
let s2Boost = false;
let s1BoostTick = 0;
let s2BoostTick = 0;

const C1     = PAL.mint;
const C1HEAD = PAL.mintHi;
const C2     = PAL.sky;
const C2HEAD = PAL.skyHi;
const FOOD_C = PAL.sun;
const BG     = PAL.board;
const GRID_C = PAL.well;

const MIN_LEN = 3;

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
  // 1P speeds up a little as you score, down to 70% of the base step
  if (!twoPlayer) return Math.round(baseMs * Math.max(0.7, 1 - snake.score * 0.01));
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
  paused = false;
  winner = null;
  newBest = false;
  s1Boost = s2Boost = false;
  _t = 0; _s1Next = 0; _s2Next = 0;
  loadBest();
  clearParticles();
  setStatus(twoPlayer ? "P1 vs P2 · press a key to start" : "press a key or tap to start" + (best ? " · best " + best : ""), null);
  clearInterval(tickTimer);
  tickTimer = setInterval(mainTick, 40);
}

let _t = 0;
let _s1Next = 0, _s2Next = 0;

function mainTick() {
  if (!started || gameOver || paused) return;
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
    if (twoPlayer) {
      setStatus(winner === "draw" ? "draw — both crashed" : winner + " wins!", "solved");
    } else {
      if (s1.score > best) { best = s1.score; newBest = true; saveBest(); }
      setStatus(`game over · score ${s1.score}` + (newBest ? " · new best!" : ` · best ${best}`), "dead");
    }
  } else {
    updateRunningStatus();
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

// Board placement below the UI overlay — one source of truth shared by the
// draw loop and every screen-space effect (sparks, food positions).
function boardLayout() {
  const uiH = document.getElementById("ui-overlay")?.offsetHeight ?? 60;
  const availH = height - uiH;
  const cs = Math.max(4, Math.floor(Math.min(width / gridW, availH / gridH)));
  return {
    cs,
    offX: Math.floor((width - cs * gridW) / 2),
    offY: uiH + Math.floor((availH - cs * gridH) / 2),
  };
}

function spawnDeathSparks(s) {
  const { cs, offX, offY } = boardLayout();
  s.body.forEach(seg => {
    const cx = offX + seg.x * cs + cs / 2;
    const cy = offY + seg.y * cs + cs / 2;
    spawnBurst(cx, cy, { count: 3, speed: [0.5, 4.2], life: [100, 200], size: [2, 5], col: s.color });
  });
}

function spawnBoostSparks(s) {
  const tail = s.body[s.body.length - 1];
  const { cs, offX, offY } = boardLayout();
  const cx = offX + tail.x * cs + cs / 2;
  const cy = offY + tail.y * cs + cs / 2;

  for (let k = 0; k < 6; k++) {
    addParticle({
      x: cx,
      y: cy,
      vx: -s.dir.x * random(1.5, 4.5) + random(-0.5, 0.5),
      vy: -s.dir.y * random(1.5, 4.5) + random(-0.5, 0.5),
      life: random(80, 140),
      size: random(1.5, 3.5),
      col: PAL.ink, // white rocket spark
    });
  }
}

function spawnEatSparks(x, y, col) {
  spawnBurst(x, y, { count: 12, speed: [1, 3], life: [100, 160], size: [2, 4], col });
}

function eatFood() {
  const { cs, offX, offY } = boardLayout();

  let eaten = 0;
  food = food.filter(f => {
    const cx = offX + f.x * cs + cs / 2;
    const cy = offY + f.y * cs + cs / 2;

    const hit1 = s1.body[0].x === f.x && s1.body[0].y === f.y;
    const hit2 = twoPlayer && s2.body[0].x === f.x && s2.body[0].y === f.y;
    if (hit1) {
      s1.body.push({ ...s1.body[s1.body.length - 1] });
      s1.score++;
      spawnEatSparks(cx, cy, FOOD_C);
      eaten++;
      return false;
    }
    if (hit2) {
      s2.body.push({ ...s2.body[s2.body.length - 1] });
      s2.score++;
      spawnEatSparks(cx, cy, FOOD_C);
      eaten++;
      return false;
    }
    return true;
  });
  // spawn after filtering — spawning inside the filter pushed onto the old array and got overwritten
  for (let i = 0; i < eaten; i++) spawnFood();
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
    if (s1.dead || s2.dead) {
      gameOver = true;
      winner = s1.dead && s2.dead ? "draw" : s1.dead ? "P2" : "P1";
    }
  } else {
    if (s1.dead) gameOver = true;
  }
}

function updateRunningStatus() {
  setStatus(twoPlayer
    ? `P1 ${s1.score} · P2 ${s2.score}` + (paused ? " · paused" : "")
    : `score ${s1.score}` + (best ? ` · best ${best}` : "") + (paused ? " · paused" : ""), null);
}

function bestKey() { return "snake_best_" + gridW + "x" + gridH + "_" + baseMs + (edgeLoop ? "_wrap" : "_walls"); }
function loadBest() { try { best = parseInt(localStorage.getItem(bestKey())) || 0; } catch { best = 0; } }
function saveBest() { try { localStorage.setItem(bestKey(), String(best)); } catch {} }

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  updateRunningStatus();
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
  newGame();
}

function saveState() {
  saveSettings("snake_state", { gridW, gridH, baseMs, twoPlayer, edgeLoop });
}
function loadState() {
  const d = loadSettings("snake_state");
  if (typeof d.gridW === "number") gridW = d.gridW;
  if (typeof d.gridH === "number") gridH = d.gridH;
  if (typeof d.baseMs === "number" && d.baseMs >= 50 && d.baseMs <= 160) baseMs = d.baseMs;
  if (typeof d.twoPlayer === "boolean") twoPlayer = d.twoPlayer;
  if (typeof d.edgeLoop === "boolean") edgeLoop = d.edgeLoop;
}

loadState();
syncSliderUI();
setButtonActive("btn-2p", twoPlayer);
setButtonActive("btn-loop", edgeLoop);

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

  p.background(...PAL.board);
  p.stroke(...PAL.well); p.strokeWeight(1);
  for (let x = 0; x <= gw; x++) p.line(ox + x*cs, oy, ox + x*cs, oy + gh*cs);
  for (let y = 0; y <= gh; y++) p.line(ox, oy + y*cs, ox + gw*cs, oy + y*cs);
  p.noStroke();

  function drawFood(gx, gy) {
    const cx = ox+gx*cs+cs/2, cy = oy+gy*cs+cs/2;
    p.fill(...PAL.sun, 30); p.circle(cx, cy, cs * 0.9);
    p.fill(...PAL.sun); p.circle(cx, cy, cs * 0.55);
    p.fill(...PAL.ink); p.circle(cx, cy, cs * 0.25);
  }

  function drawSnake(body, dir) {
    const [hr, hg, hb] = C1HEAD;
    const [r, g, b] = PAL.mint;
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
        p.fill(...PAL.board);
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
      p.noFill(); p.stroke(...PAL.rose, 220); p.strokeWeight(3);
      p.circle(cx, cy, cs * 0.9);
    }
  }
}

// ---- p5 Sketch ----

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("canvas-wrap");
  newGame();

  // swipe to steer P1, tap to start / restart
  const wrap = document.getElementById("canvas-wrap");
  wrap.style.touchAction = "none";
  let t0 = null;
  wrap.addEventListener("touchstart", e => { const t = e.changedTouches[0]; t0 = { x: t.clientX, y: t.clientY }; e.preventDefault(); }, { passive: false });
  wrap.addEventListener("touchend", e => {
    if (!t0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    t0 = null;
    e.preventDefault();
    if (gameOver) { newGame(); return; }
    if (!started) startGame();
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryDir(s1, Math.sign(dx), 0);
    else tryDir(s1, 0, Math.sign(dy));
  }, { passive: false });
}

function startGame() {
  started = true;
  _t = 0; _s1Next = 0; _s2Next = 0;
  updateRunningStatus();
}

function mousePressed(e) {
  // only clicks on the board itself, not on the overlay's buttons
  if (!e || e.target.tagName !== "CANVAS" || e.type.startsWith("touch")) return;
  if (gameOver) newGame();
  else if (!started) startGame();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  const { cs, offX, offY } = boardLayout();

  background(BG[0], BG[1], BG[2]);

  // board: soft dot grid, solid frame when the walls are deadly
  const bw = gridW * cs, bh = gridH * cs;
  noStroke();
  fill(...PAL.well);
  rect(offX, offY, bw, bh, Math.min(14, cs));
  if (cs >= 8) {
    fill(...PAL.line);
    for (let x = 1; x < gridW; x++)
      for (let y = 1; y < gridH; y++) circle(offX + x * cs, offY + y * cs, 2);
  }
  noFill();
  if (edgeLoop) { stroke(...PAL.line); strokeWeight(1); }
  else { stroke(...PAL.lineHi); strokeWeight(3); }
  rect(offX, offY, bw, bh, Math.min(14, cs));

  // Draw floating food with ascending warmth particles
  noStroke();
  food.forEach(f => {
    const cx = offX + f.x*cs + cs/2;
    const floatY = sin(frameCount * 0.12 + f.x * 7) * (cs * 0.08);
    const cy = offY + f.y*cs + cs/2 + floatY;

    // Heat trail sparks
    if (random() < 0.08) {
      addParticle({
        x: cx + random(-4, 4),
        y: cy,
        vx: random(-0.2, 0.2),
        vy: random(-0.4, -1.2),
        life: 120,
        size: random(1, 2.5),
        col: FOOD_C,
      });
    }

    // Outer glow
    fill(FOOD_C[0], FOOD_C[1], FOOD_C[2], 30);
    circle(cx, cy, cs * 0.9);
    
    // Core
    fill(FOOD_C[0], FOOD_C[1], FOOD_C[2]);
    circle(cx, cy, cs * 0.55);
    
    // Brighter center core
    fill(...PAL.ink);
    circle(cx, cy, cs * 0.25);
  });

  // Draw snakes with gradient pill-segments
  drawSnakeBody(s1, offX, offY, cs);
  if (twoPlayer) drawSnakeBody(s2, offX, offY, cs);

  drawParticles();

  if (gameOver) {
    if (twoPlayer) {
      const col = winner === "P1" ? C1 : winner === "P2" ? C2 : PAL.muted;
      drawBoardOverlay(offX, offY, bw, bh, winner === "draw" ? "Draw" : winner + " wins!", `P1 ${s1.score} · P2 ${s2.score} — space or tap to play again`, col);
    } else {
      drawBoardOverlay(offX, offY, bw, bh, newBest ? "New best!" : "Game over", `score ${s1.score} · best ${best} — space or tap to play again`, newBest ? PAL.sun : PAL.rose);
    }
  } else if (!started) {
    drawBoardOverlay(offX, offY, bw, bh, "Ready?", twoPlayer ? "P1: arrows + Space · P2: WASD + Shift" : "arrows / WASD / swipe — press a key to start", PAL.mint);
  } else if (paused) {
    drawBoardOverlay(offX, offY, bw, bh, "Paused", "press P to continue", PAL.lilac);
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
      fill(...PAL.board);
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
  // ignore typing into the overlay's dropdown / sliders
  if (document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return;
  if (gameOver) {
    if (keyCode === 32 || keyCode === ENTER) { newGame(); return false; }
    return;
  }
  if (key === "p" || key === "P" || keyCode === ESCAPE) { togglePause(); return false; }
  if (!started) startGame();
  if (paused) return false;

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
