// Shell Shock — a real-time artillery duel for the multiplayer hub.
//
// Two tanks on a rolling 2D battlefield, seen from the side like the classic artillery games:
// solid hills (a heightmap), tanks that drive along the surface, and shells that fly in ballistic
// arcs with gravity and wind. Drive with A/D, aim the turret with W/S or the mouse, hold F (or the
// mouse button) to charge the shot and release to fire. Ground hits carve craters into the hills.
// Last tank standing wins the round; "Nochmal" starts the next one on fresh terrain.
//
// Architecture (host-authoritative, like Tic Tac Toe): the host owns the world. It simulates both
// tanks, the shells, the damage and the terrain, and broadcasts a small "state" packet ~20x/s.
// One-shot events travel as their own messages so nothing has to be sampled at frame rate:
//   "shot" — a shell was launched; every client then flies it locally (same physics, same terrain)
//            so the arc renders smoothly instead of teleporting at state-packet rate,
//   "boom" — a shell exploded: position, crater radius, damage per seat.
// Guests stream "move" intents (drive + turret angle) and predict their own tank locally between
// state packets, so their own tank never feels laggy; the host state gently corrects it.

import { shell } from "../hub-kit.js";

// ---- world constants ----
const W = 860, H = 540;
const STEP = 4;                                   // terrain sample distance (px)
const NT = Math.floor(W / STEP) + 1;
const TANK_R = 15;
const HP_MAX = 100;
const DIRECT = 34;                                // direct-hit damage (3 hits kill)
const SPLASH = 24;                                // max splash damage at the epicentre
const BLAST = 54;                                 // splash radius (px)
const GRAV = 300;                                 // gravity, px/s^2
const WIND_MAX = 60;                              // max wind acceleration, px/s^2
const SPEED = 95;                                 // tank drive speed, px/s
const TURN_RATE = 2.6;                            // turret rad/s
const POW_MIN = 0.18, POW_TIME = 1.15;            // charge: start power, seconds to full
const FIRE_CD = 0.35;                             // seconds between shots
const SHELL_R = 4;
const CRATER = 34;                                // crater radius on a ground hit
const SHELL_LIFE = 7;                             // shells fizzle after this long
const BCAST_MS = 50;                              // state packet interval

// ---- tiny seeded RNG (mulberry32) so both clients build the same hills ----
function rng(s) {
  s = s >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- terrain: a heightmap (surface y per x), carved by craters ----
let gy = new Float32Array(NT);
let seed = 1;
const groundY = (x) => {
  const f = Math.max(0, Math.min(NT - 1.001, x / STEP));
  const i = f | 0, r = f - i;
  return gy[i] + (gy[i + 1] - gy[i]) * r;
};
const slopeAt = (x) => (groundY(Math.min(W, x + 6)) - groundY(Math.max(0, x - 6))) / 12;

function buildTerrain(s) {
  seed = s >>> 0;
  const r = rng(seed);
  const bumps = [];
  const n = 5 + ((r() * 3) | 0);
  for (let i = 0; i < n; i++) {
    bumps.push({ x: W * (0.08 + 0.84 * ((i + 0.2 + 0.6 * r()) / n)), h: 60 + 125 * r(), w: 75 + 95 * r() });
  }
  const base = H * 0.7, a1 = 16 + 12 * r(), a2 = 10 + 8 * r(), p1 = r() * 7, p2 = r() * 13;
  for (let i = 0; i < NT; i++) {
    const x = i * STEP;
    let y = base - a1 * Math.sin(x * 0.006 + p1) - a2 * Math.sin(x * 0.017 + p2);
    for (const b of bumps) { const d = (x - b.x) / b.w; y -= b.h * Math.exp(-d * d); }
    gy[i] = Math.max(H * 0.14, Math.min(H - 26, y));
  }
  flattenPad(W * 0.14); flattenPad(W * 0.86);            // level spawn pads so nobody starts on a needle
}
function flattenPad(cx) {
  const i0 = Math.max(0, ((cx - 26) / STEP) | 0), i1 = Math.min(NT - 1, ((cx + 26) / STEP) | 0);
  let avg = 0; for (let i = i0; i <= i1; i++) avg += gy[i];
  avg /= i1 - i0 + 1;
  for (let i = i0; i <= i1; i++) gy[i] = avg;
}
function carve(cx, cy, r) {
  const i0 = Math.max(0, ((cx - r) / STEP) | 0), i1 = Math.min(NT - 1, ((cx + r) / STEP) | 0);
  for (let i = i0; i <= i1; i++) {
    const dx = i * STEP - cx, half = r * r - dx * dx;
    if (half <= 0) continue;
    gy[i] = Math.min(H - 10, Math.max(gy[i], cy + Math.sqrt(half)));
  }
}

// ---- palette (PAL/FONT are page globals from themes.js; the fallback keeps the module safe) ----
const FALLBACK = { board: [12, 13, 26], well: [18, 20, 37], panel: [28, 31, 54], line: [44, 48, 82], lineHi: [78, 84, 128], ink: [238, 240, 255], muted: [142, 148, 190], dim: [86, 92, 132], sun: [255, 204, 112], sunHi: [255, 248, 228], mint: [116, 226, 178], mintHi: [196, 255, 226], rose: [255, 110, 140], sky: [108, 182, 255], skyHi: [190, 224, 255] };
const PAL_ = () => (typeof PAL === "undefined" ? FALLBACK : PAL);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function celebrateWin() { try { if (typeof celebrate === "function") celebrate(2); } catch (e) { /* confetti is optional */ } }

// ---- state ----
let C = null;                       // hub ctx
let phase = "wait";                 // wait | countdown | run | over
let round = 0, winner = null;       // winner: seat index, -1 = draw, null = undecided
let seats = [null, null];           // player id per tank seat (0 = left/mint, 1 = right/rose)
let wind = 0, cdEnd = 0, cdDeadline = 0, cdLeft = 0;
let tanks = [null, null];
let shells = [];                    // flown locally on every client (spawned via "shot")
let parts = [];                     // particles, rings, floating damage numbers
let guestIntent = { dr: 0, a: -0.55 };
let myCD = 0, charging = false, power = POW_MIN, fireSeq = 0;
let shake = 0;
let lastBcast = 0, lastIntent = 0, lastSentIntent = "";
let aimMode = "mouse", pointerIn = false;

const myIdx = () => (C && C.me ? seats.indexOf(C.me.id) : -1);
const myTank = () => { const k = myIdx(); return tanks[k >= 0 ? k : 0]; };
const otherIdx = () => { const k = myIdx(); return k === 1 ? 0 : 1; };

function freshTank(x, dir) {
  return { x, y: groundY(x) - TANK_R * 0.7, turret: dir > 0 ? -0.55 : -Math.PI + 0.55, hp: HP_MAX, alive: true, vx: 0, tilt: 0, remote: false, tx: 0, ty: 0, tt: 0 };
}
function tankView(t) { return [+t.x.toFixed(1), +t.y.toFixed(1), +t.turret.toFixed(2), Math.round(t.hp), t.alive ? 1 : 0]; }
function applyView(t, v) { if (!Array.isArray(v) || v.length < 5 || !t) return; t.x = +v[0]; t.y = +v[1]; t.turret = +v[2]; t.hp = +v[3]; t.alive = !!v[4]; t.y = groundY(t.x) - TANK_R * 0.7; }

// ---------- host: rounds ----------

function startRound() {
  if (!C || !C.isHost) return;
  round += 1;
  buildTerrain((Math.random() * 0xffffffff) >>> 0);
  wind = (Math.random() * 2 - 1) * WIND_MAX;
  tanks = [freshTank(W * 0.14, 1), freshTank(W * 0.86, -1)];
  shells = []; parts = [];
  myCD = 0; charging = false; power = POW_MIN; fireSeq = 0;
  guestIntent = { dr: 0, a: tanks[otherIdx()].turret };
  phase = "countdown";
  winner = null;
  cdEnd = Date.now() + 3200;
  syncUI();
  broadcast();
}

function broadcast() {
  if (!C || !C.isHost) return;
  C.send("state", {
    phase, round, seed, wind: +wind.toFixed(1), winner, seats,
    cd: phase === "countdown" ? Math.max(0, cdEnd - Date.now()) : 0,
    t: [tankView(tanks[0]), tankView(tanks[1])],
  });
}

// ---------- shared physics ----------

function moveTank(t, drive, dt) {
  if (!t || !t.alive) return;
  const want = drive * SPEED;
  t.vx += (want - t.vx) * Math.min(1, dt * 7);
  const sl = slopeAt(t.x);
  if (t.vx * sl < 0) t.vx *= 1 - Math.min(0.55, Math.abs(sl) * 0.85);   // uphill is slow
  t.x = Math.max(TANK_R + 10, Math.min(W - TANK_R - 10, t.x + t.vx * dt));
  t.y = groundY(t.x) - TANK_R * 0.7;
  t.tilt += (Math.atan(sl) - t.tilt) * Math.min(1, dt * 10);
}

function aimTank(t, target, dt) {
  if (!t || !t.alive) return;
  let d = target - t.turret;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  t.turret += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d));
}

const muzzle = (t) => ({ x: t.x + Math.cos(t.turret) * TANK_R * 1.35, y: t.y - TANK_R * 0.35 + Math.sin(t.turret) * TANK_R * 1.35 });
const shellVel = (a, p) => {
  const v0 = 240 + 660 * Math.max(POW_MIN, Math.min(1, p));
  return { vx: Math.cos(a) * v0, vy: Math.sin(a) * v0 };
};

// one physics step for a shell (identical on every client — same wind, same gravity)
function fly(s, dt) {
  s.vx += wind * dt;
  s.vy += GRAV * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.t += dt;
  s.trail.push(s.x, s.y);
  if (s.trail.length > 28) s.trail.splice(0, s.trail.length - 28);
}
const shellDone = (s) => s.t >= SHELL_LIFE || s.x <= -60 || s.x >= W + 60 || s.y >= H + 60 || s.y >= groundY(s.x) - 2;

// ---------- host: shells, damage, round end ----------

function spawnShellHost(id, t, a, p) {
  const m = muzzle(t), v = shellVel(a, p);
  shells.push({ id, x: m.x, y: m.y, vx: v.vx, vy: v.vy, t: 0, trail: [] });
  C.send("shot", { id, x: +m.x.toFixed(1), y: +m.y.toFixed(1), vx: +v.vx.toFixed(1), vy: +v.vy.toFixed(1) });
  spawnBurst(m.x, m.y, 6, PAL_().sun, 70);
}

function stepShellsHost(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    fly(s, dt);
    const out = s.x <= -60 || s.x >= W + 60 || s.y >= H + 60;
    if (!out && s.t < SHELL_LIFE && s.y < groundY(s.x) - 2) continue;
    shells.splice(i, 1);
    if (out) {                                   // left the arena: gone — no burst, no crater, no damage
      C.send("boom", { id: s.id, x: +s.x.toFixed(1), y: +s.y.toFixed(1), cr: 0, d: [0, 0], out: 1 });
      continue;
    }
    explodeShell(s);
  }
}

function explodeShell(s) {
  const ground = s.y >= groundY(s.x) - 2;
  const bx = Math.max(4, Math.min(W - 4, s.x)), by = Math.max(4, Math.min(H - 4, s.y));
  const dmg = [0, 0];
  tanks.forEach((t, k) => {
    if (!t || !t.alive) return;
    const d = Math.hypot(bx - t.x, by - t.y);
    if (d < TANK_R + 5) dmg[k] = DIRECT;
    else if (d < BLAST) dmg[k] = Math.round(SPLASH * (1 - d / BLAST));
    if (dmg[k] > 0) { t.hp = Math.max(0, t.hp - dmg[k]); if (t.hp === 0) t.alive = false; }
  });
  C.send("boom", { id: s.id, x: +bx.toFixed(1), y: +by.toFixed(1), cr: ground ? CRATER : 0, cy: +by.toFixed(1), d: dmg });
  onBoom({ id: s.id, x: bx, y: by, cr: ground ? CRATER : 0, cy: by, d: dmg });
  checkOver();
}

function checkOver() {
  if (phase !== "run" || !tanks[0] || !tanks[1]) return;
  const a0 = tanks[0].alive, a1 = tanks[1].alive;
  if (a0 && a1) return;
  phase = "over";
  winner = !a0 && !a1 ? -1 : a0 ? 0 : 1;
  broadcast();
  if (winner === myIdx()) celebrateWin();
  syncUI();
}

// ---------- both: shared visuals for a boom (craters + damage numbers + burst) ----------

function onBoom(b) {
  const L = PAL_();
  if (b.out) return;                                   // shell left the arena: only the removal matters
  if (b.cr) carve(b.x, b.cy, b.cr);
  (b.d || []).forEach((dm, k) => {
    const t = tanks[k];
    if (dm > 0 && t) parts.push({ x: t.x, y: t.y - TANK_R * 2.6, vx: 0, vy: -34, life: 1.1, max: 1.1, txt: "-" + dm, col: k === myIdx() ? L.rose : L.mintHi });
  });
  spawnBurst(b.x, b.y, 20, L.sun, 150);
  spawnBurst(b.x, b.y, 10, L.rose, 110);
  parts.push({ x: b.x, y: b.y, ring: 1, life: 0.4, max: 0.4, col: L.sunHi });
  const meT = myTank();
  if (meT && Math.hypot(b.x - meT.x, b.y - meT.y) < 130) shake = 0.35;
}

function spawnBurst(x, y, n, col, v) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = v * (0.3 + Math.random() * 0.7);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.5 + Math.random() * 0.45, max: 0.95, col, dot: 2 + Math.random() * 3 });
  }
}
function puff(s) { spawnBurst(s.x, s.y, 3, PAL_().muted, 30); }

// ---------- input ----------

const KEY = { A: 65, D: 68, W: 87, S: 83, LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40 };
let P = null;
const down = (...ks) => ks.some((k) => P && P.keyIsDown(k));
const readDrive = () => (down(KEY.D, KEY.RIGHT) ? 1 : 0) - (down(KEY.A, KEY.LEFT) ? 1 : 0);

// absolute turret target from the aim inputs; keys and mouse latch whichever moved last
function aimInput(dt) {
  const k = (down(KEY.W, KEY.UP) ? -1 : 0) + (down(KEY.S, KEY.DOWN) ? 1 : 0);
  const t = myTank();
  if (!t) return null;
  if (k) { aimMode = "keys"; return t.turret + k * TURN_RATE * dt; }
  if (aimMode === "mouse" && pointerIn && P) return Math.atan2(P.mouseY - (t.y - TANK_R * 0.35), P.mouseX - t.x);
  return null;
}

function tryCharge() {
  if (phase !== "run" || charging) return;
  const t = myTank();
  if (!t || !t.alive || myCD > 0) return;
  charging = true; power = POW_MIN;
}
function release() {
  if (!charging) return;
  charging = false;
  if (phase !== "run" || !C) return;
  const t = myTank();
  if (!t || !t.alive || myCD > 0) return;
  myCD = FIRE_CD;
  const a = t.turret, p = power;
  if (C.isHost) spawnShellHost("h" + (++fireSeq), t, a, p);
  else {
    const m = muzzle(t), v = shellVel(a, p);
    shells.push({ id: "g" + (++fireSeq), x: m.x, y: m.y, vx: v.vx, vy: v.vy, t: 0, trail: [] });
    spawnBurst(m.x, m.y, 5, PAL_().sun, 70);
    C.send("fire", { seq: fireSeq, a: +a.toFixed(3), p: +p.toFixed(3) });
  }
}

function onUp() { if (document.body.classList.contains("hub-game-open")) release(); }
function onKeyDown(e) {
  if (!document.body.classList.contains("hub-game-open")) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  if ((e.key === "f" || e.key === "F" || e.key === " ") && !e.repeat) tryCharge();
}
function onKeyUp(e) {
  if (!document.body.classList.contains("hub-game-open")) return;
  if (e.key === "f" || e.key === "F" || e.key === " ") release();
}

// ---------- per-frame step ----------

function step(dt) {
  if (phase === "countdown") {
    cdLeft = Math.max(0, (C && C.isHost ? cdEnd : cdDeadline) - Date.now());
    if (cdLeft === 0) phase = "run";
  }
  if (phase !== "run" && phase !== "countdown") { decayParts(dt); return; }

  const me = Math.max(0, myIdx()), other = 1 - me;

  if (phase === "run") {
    myCD = Math.max(0, myCD - dt);
    if (charging) power = Math.min(1, power + dt / POW_TIME);

    if (C && C.isHost) {
      moveTank(tanks[me], readDrive(), dt);
      const a = aimInput(dt); if (a !== null) aimTank(tanks[me], a, dt);
      moveTank(tanks[other], guestIntent.dr, dt);
      aimTank(tanks[other], guestIntent.a, dt);
      // keep the two tanks from overlapping
      if (tanks[0].alive && tanks[1].alive) {
        const d = tanks[1].x - tanks[0].x, min = TANK_R * 1.7;
        if (Math.abs(d) < min) {
          const push = ((min - Math.abs(d)) / 2) * Math.sign(d || 1);
          tanks[0].x = Math.max(TANK_R + 10, tanks[0].x - push);
          tanks[1].x = Math.min(W - TANK_R - 10, tanks[1].x + push);
          tanks.forEach((t) => { t.y = groundY(t.x) - TANK_R * 0.7; });
        }
      }
      stepShellsHost(dt);                              // the host's shells live only here
      checkOver();
    } else {
      if (tanks[me]) {
        // predict my own tank locally so the controls feel instant
        moveTank(tanks[me], readDrive(), dt);
        const a = aimInput(dt); if (a !== null) aimTank(tanks[me], a, dt);
        // stream intents to the host
        const now = performance.now();
        const intent = { dr: readDrive(), a: +tanks[me].turret.toFixed(2) };
        if (now - lastIntent > BCAST_MS && JSON.stringify(intent) !== lastSentIntent) {
          lastIntent = now; lastSentIntent = JSON.stringify(intent);
          C.send("move", intent, C.hostId);
        }
      }
      // fly the shells I can see (guest copies are replaced by the host's authoritative "shot")
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        fly(s, dt);
        if (!shellDone(s)) continue;
        shells.splice(i, 1);
        puff(s);
      }
    }
  }

  // the other tank glides towards where the host last saw it
  const e = Math.min(1, dt * 14);
  tanks.forEach((t) => {
    if (!t || !t.remote) return;
    t.x += (t.tx - t.x) * e;
    t.y += (t.ty - t.y) * e;
    t.tilt += (Math.atan(slopeAt(t.x)) - t.tilt) * e;
    let d = t.tt - t.turret;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    t.turret += d * e;
  });

  decayParts(dt);
  if (shake > 0) shake = Math.max(0, shake - dt);
  if (C && C.isHost && phase !== "wait") {
    const now = performance.now();
    if (now - lastBcast > BCAST_MS) { lastBcast = now; broadcast(); }
  }
}

function decayParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.life -= dt;
    if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; if (q.dot) { q.vy += 160 * dt; q.vx *= 0.985; } }
    if (q.life <= 0) parts.splice(i, 1);
  }
}

// ---------- rendering ----------

function render() {
  const p = P;
  if (!p) return;
  p.push();
  if (shake > 0) p.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
  drawSky();
  drawParallax();
  drawTerrain();
  drawTanks();
  drawShells();
  drawCharge();
  drawParts();
  p.pop();
  drawOverlays();
  drawHUD();
}

function drawSky() {
  const p = P, L = PAL_(), ctx = p.drawingContext;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(L.well, 1));
  g.addColorStop(1, rgba(L.board, 1));
  ctx.fillStyle = g;
  ctx.fillRect(-10, -10, W + 20, H + 20);
}

function drawParallax() {
  const p = P, L = PAL_(), ctx = p.drawingContext;
  const r = rng(seed ^ 0x9e37);
  const layer = (amp, base, yoff, col, alpha) => {
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 16) {
      const y = base - yoff - amp * (0.5 + 0.5 * Math.sin(x * 0.004 + yoff + r() * 0.9)) - amp * 0.5 * Math.sin(x * 0.011 + r());
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fillStyle = rgba(col, alpha);
    ctx.fill();
  };
  layer(120, H * 0.86, 150, L.line, 0.35);
  layer(90, H * 0.94, 60, L.panel, 0.6);
}

function drawTerrain() {
  const p = P, L = PAL_(), ctx = p.drawingContext;
  const g = ctx.createLinearGradient(0, H * 0.15, 0, H);
  g.addColorStop(0, rgba(L.sky, 0.95));
  g.addColorStop(1, rgba(L.sky, 0.5));
  ctx.beginPath();                                     // solid ground: surface line, filled to the bottom
  ctx.moveTo(-10, gy[0]);
  for (let i = 1; i < NT; i++) ctx.lineTo(i * STEP, gy[i]);
  ctx.lineTo(W + 10, H + 10);
  ctx.lineTo(-10, H + 10);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();                                     // bright top edge
  ctx.moveTo(-10, gy[0]);
  for (let i = 1; i < NT; i++) ctx.lineTo(i * STEP, gy[i]);
  ctx.strokeStyle = rgba(L.skyHi, 0.95);
  ctx.lineWidth = 3.5;
  ctx.stroke();
}

function drawTanks() {
  const p = P, L = PAL_(), my = myIdx();
  tanks.forEach((t, k) => {
    if (!t) return;
    const col = k === 0 ? L.mint : L.rose;
    const hi = k === 0 ? L.mintHi : L.sun;
    if (!t.alive) {                                     // a burnt-out wreck
      p.push(); p.translate(t.x, t.y); p.rotate(t.tilt);
      p.noStroke(); p.fill(...L.ink, 60);
      p.ellipse(0, 2, TANK_R * 2.1, TANK_R * 1.1, 6);
      p.pop();
      return;
    }
    p.push();
    p.translate(t.x, t.y);
    p.rotate(t.tilt);
    p.noStroke();
    p.fill(...L.ink, 190);                              // treads
    p.ellipse(0, 1, TANK_R * 2.25, TANK_R * 1.15, 7);
    p.fill(...col);                                     // hull
    p.ellipse(0, -1, TANK_R * 1.85, TANK_R * 1.2, 6);
    p.fill(...hi, 110);                                 // top light
    p.ellipse(-TANK_R * 0.15, -TANK_R * 0.42, TANK_R * 0.95, TANK_R * 0.42, 4);
    p.stroke(...L.ink, 220);                            // turret barrel
    p.strokeWeight(4.5);
    p.strokeCap(p.ROUND);
    p.line(0, -TANK_R * 0.35, Math.cos(t.turret - t.tilt) * TANK_R * 1.45, -TANK_R * 0.35 + Math.sin(t.turret - t.tilt) * TANK_R * 1.45);
    p.pop();
    // name + health bar
    const nm = seats[k] ? ((ctxPlayers().find((q) => q.id === seats[k]) || {}).name || "") : "";
    p.noStroke();
    p.textAlign(p.CENTER, p.BOTTOM);
    p.textSize(11);
    p.fill(...L.ink, 170);
    if (nm) p.text(nm + (k === my ? " (du)" : ""), t.x, t.y - TANK_R * 2.75);
    p.fill(...L.ink, 60);
    p.rect(t.x - 22, t.y - TANK_R * 2.3, 44, 5, 2);
    p.fill(...(k === my ? L.mint : L.rose), 235);
    p.rect(t.x - 22, t.y - TANK_R * 2.3, 44 * Math.max(0, t.hp / HP_MAX), 5, 2);
  });
}

function drawShells() {
  const p = P, L = PAL_(), ctx = p.drawingContext;
  for (const s of shells) {
    const n = s.trail.length / 2;
    for (let i = 1; i < n; i++) {
      ctx.strokeStyle = rgba(L.sun, (i / n) * 0.5);
      ctx.lineWidth = 1 + (i / n) * 2.5;
      ctx.beginPath();
      ctx.moveTo(s.trail[(i - 1) * 2], s.trail[(i - 1) * 2 + 1]);
      ctx.lineTo(s.trail[i * 2], s.trail[i * 2 + 1]);
      ctx.stroke();
    }
    p.noStroke();
    p.fill(...(L.sunHi || L.sun));
    p.circle(s.x, s.y, SHELL_R * 2);
  }
}

function drawCharge() {
  if (!charging || phase !== "run") return;
  const p = P, L = PAL_(), t = myTank();
  if (!t || !t.alive) return;
  const m = muzzle(t), v = shellVel(t.turret, power);
  let x = m.x, y = m.y, vx = v.vx, vy = v.vy;
  p.noStroke();
  for (let i = 0; i < 10; i++) {                        // dotted preview of the first part of the arc
    const d = 0.055;
    vx += wind * d; vy += GRAV * d; x += vx * d; y += vy * d;
    if (y > groundY(x)) break;
    p.fill(...L.sun, 200 - i * 16);
    p.circle(x, y, 5 - i * 0.25);
  }
  p.noStroke();                                         // power bar above my tank
  p.fill(...L.ink, 60);
  p.rect(t.x - 24, t.y - TANK_R * 3.3, 48, 6, 3);
  p.fill(...L.sun);
  p.rect(t.x - 24, t.y - TANK_R * 3.3, 48 * power, 6, 3);
}

function drawParts() {
  const p = P;
  for (const q of parts) {
    const a = Math.max(0, q.life / (q.max || 1));
    if (q.txt) {
      p.noStroke();
      p.textAlign(p.CENTER, p.BOTTOM);
      p.textSize(15);
      p.fill(...q.col, Math.min(1, a * 1.4));
      p.text(q.txt, q.x, q.y);
    } else if (q.ring) {
      p.noFill();
      p.stroke(...q.col, a);
      p.strokeWeight(3);
      p.circle(q.x, q.y, (1 - a) * BLAST * 2.1);
      p.noStroke();
    } else {
      p.noStroke();
      p.fill(...q.col, a);
      p.circle(q.x, q.y, (q.dot || 2) * 2 * a);
    }
  }
}

function drawOverlays() {
  if (phase !== "over") return;
  const p = P, L = PAL_(), my = myIdx();
  p.noStroke();
  p.fill(...L.board, 130);
  p.rect(0, 0, W, H);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(52);
  p.fill(...(winner === -1 ? L.sun : winner === my ? L.mint : L.rose));
  p.text(winner === -1 ? "UNENTSCHIEDEN!" : winner === my ? "DU HAST GEWONNEN!" : "DU HAST VERLOREN!", W / 2, H / 2 - 14);
  p.textStyle(p.NORMAL);
  p.textSize(16);
  p.fill(...L.muted);
  p.text("Der Hügel bleibt – die Panzer nicht.", W / 2, H / 2 + 34);
}

function drawHUD() {
  const p = P, L = PAL_();
  p.noStroke();
  if (phase === "wait") {
    p.fill(...L.muted);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16);
    p.text("Warten auf den Host …", W / 2, H / 2 - 8);
    return;
  }
  p.textAlign(p.LEFT, p.TOP);                           // wind, top left
  p.textSize(13);
  p.fill(...L.muted);
  const wAbs = Math.abs(wind);
  p.text(wAbs < 8 ? "Windstille" : `Wind ${(wind > 0 ? "→" : "←").repeat(Math.max(1, Math.min(3, Math.round(wAbs / 20))))}`, 16, 12);
  p.textAlign(p.RIGHT, p.TOP);                          // round, top right
  if (round > 0) p.text(`Runde ${round}`, W - 16, 12);
  if (phase === "countdown") {                          // big countdown, centre
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(96);
    p.fill(...L.ink);
    p.text(String(Math.max(1, Math.ceil(cdLeft / 1000))), W / 2, H / 2 - 20);
    p.textStyle(p.NORMAL);
    p.textSize(15);
    p.fill(...L.muted);
    p.text("A/D fahren · W/S oder Maus zielen · F halten zum Laden, loslassen zum Feuern", W / 2, H / 2 + 44);
  } else if (charging) {
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(14);
    p.fill(...L.sun);
    p.text(`Laden … ${Math.round(power * 100)}%`, W / 2, 12);
  }
}

// ---------- hub glue ----------

const ctxPlayers = () => (C && C.players) || [];

let uiNote = null, uiAgain = null;
function syncUI() {
  if (!uiNote || !uiAgain) return;
  const over = phase === "over";
  uiAgain.hidden = !over;
  if (over) {
    const my = myIdx();
    uiNote.textContent = winner === -1 ? "Unentschieden – die Hügel bleiben, die Panzer nicht."
      : winner === my ? "Du hast gewonnen! Der Hügel bleibt – die Panzer nicht."
      : "Du hast verloren. Der Hügel bleibt – die Panzer nicht.";
  } else {
    uiNote.textContent = "A/D fahren · W/S oder Maus zielen · F oder Maustaste halten zum Laden, loslassen zum Feuern";
  }
}

export default {
  min: 2,
  max: 2,

  mount(ctx) {
    C = ctx;
    const kit = shell(ctx, { title: "Shell Shock" });
    const body = kit.body;
    body.innerHTML = `<div class="ss"><div class="ss-stage"><div class="ss-canvas"></div></div>
      <div class="ss-act"><p class="ss-note">A/D fahren · W/S oder Maus zielen · F oder Maustaste halten zum Laden, loslassen zum Feuern</p>
      <button type="button" class="primary" id="ss-again" hidden>Nochmal</button></div></div>`;
    const canvasHost = body.querySelector(".ss-canvas");
    uiNote = body.querySelector(".ss-note");
    uiAgain = body.querySelector("#ss-again");
    uiAgain.addEventListener("click", () => {
      if (C.isHost) startRound();
      else if (phase === "over") C.send("again", null, C.hostId);
    });

    seats = ctx.players.slice(0, 2).map((q) => q.id);
    tanks = [freshTank(W * 0.14, 1), freshTank(W * 0.86, -1)];

    const sketch = (p) => {
      P = p;
      p.setup = () => {
        const cnv = p.createCanvas(W, H);
        cnv.parent(canvasHost);
        p.pixelDensity(1);
        if (typeof FONT === "string") p.textFont(FONT);
        buildTerrain(seed);
        tanks = [freshTank(W * 0.14, 1), freshTank(W * 0.86, -1)];
        cnv.elt.addEventListener("pointerdown", (e) => { e.preventDefault(); pointerIn = true; tryCharge(); });
        cnv.elt.addEventListener("pointermove", () => { pointerIn = true; aimMode = "mouse"; });
        cnv.elt.addEventListener("pointerleave", () => { pointerIn = false; });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp);
      };
      p.draw = () => {
        const dt = Math.min(0.033, (p.deltaTime || 16) / 1000);
        step(dt);
        render();
      };
    };
    const inst = new p5(sketch);

    const offState = ctx.onMessage("state", ({ data, from }) => {
      if (!C || C.isHost || from !== C.hostId || !data || typeof data !== "object") return;
      const ph = phase;
      if (typeof data.seed === "number" && data.seed !== seed) buildTerrain(data.seed);
      const r = data.round | 0;
      if (r !== round) {                                 // new round: fresh local effects, fresh prediction
        round = r;
        shells = []; parts = [];
        charging = false; power = POW_MIN; myCD = 0;
      }
      if (Array.isArray(data.seats) && data.seats.length === 2) seats = data.seats.slice();
      wind = +data.wind || 0;
      if (Array.isArray(data.t) && data.t.length === 2) {
        if (!tanks[0] || !tanks[1]) tanks = [freshTank(W * 0.14, 1), freshTank(W * 0.86, -1)];
        const me = myIdx();
        data.t.forEach((v, k) => {
          const t = tanks[k];
          if (!t || !Array.isArray(v)) return;
          if (k === me) {                                // my tank: keep the local prediction, correct gently
            t.hp = +v[3]; t.alive = !!v[4];
            if (Math.abs(+v[0] - t.x) > 50 || !t.alive) { t.x = +v[0]; t.y = groundY(t.x) - TANK_R * 0.7; }
            else { t.x += (+v[0] - t.x) * 0.25; t.y = groundY(t.x) - TANK_R * 0.7; }
          } else {                                       // the other tank: glide to where the host saw it
            t.remote = true; t.tx = +v[0]; t.ty = +v[1]; t.tt = +v[2];
            t.hp = +v[3]; t.alive = !!v[4];
          }
        });
      }
      phase = ["countdown", "run", "over"].includes(data.phase) ? data.phase : phase;
      if (data.phase === "countdown") cdDeadline = Date.now() + (+data.cd || 3000);
      winner = data.winner === null || data.winner === undefined ? null : data.winner;
      if (phase === "over" && ph !== "over" && winner === myIdx()) celebrateWin();
      if (phase !== ph) syncUI();
    });

    const offShot = ctx.onMessage("shot", ({ data, from }) => {
      if (!C || C.isHost || from !== C.hostId || !data) return;
      const s = { id: data.id, x: +data.x, y: +data.y, vx: +data.vx, vy: +data.vy, t: 0, trail: [] };
      const i = shells.findIndex((q) => q.id === s.id);
      if (i >= 0) shells[i] = s; else shells.push(s);    // replaces my predicted copy with the real one
      spawnBurst(s.x, s.y, 5, PAL_().sun, 70);
    });

    const offBoom = ctx.onMessage("boom", ({ data, from }) => {
      if (!C || C.isHost || from !== C.hostId || !data || typeof data !== "object") return;
      const i = shells.findIndex((q) => q.id === data.id);
      if (i >= 0) shells.splice(i, 1);
      const d = Array.isArray(data.d) ? data.d : [0, 0];
      tanks.forEach((t, k) => {
        const dm = d[k] | 0;
        if (t && dm > 0) { t.hp = Math.max(0, t.hp - dm); if (t.hp === 0) t.alive = false; }
      });
      onBoom({ id: data.id, x: +data.x, y: +data.y, cr: +data.cr || 0, cy: +data.cy || +data.y, d });
      if (phase === "run" && tanks.some((t) => t && !t.alive)) {   // quick local result; the next state confirms it
        phase = "over";
        winner = tanks[0].alive ? 0 : tanks[1].alive ? 1 : -1;
        if (winner === myIdx()) celebrateWin();
        syncUI();
      }
    });

    const offMove = ctx.onMessage("move", ({ data, from }) => {
      if (!C || !C.isHost || phase !== "run" || from !== seats[otherIdx()] || !data || typeof data !== "object") return;
      guestIntent.dr = data.dr === 1 ? 1 : data.dr === -1 ? -1 : 0;
      if (typeof data.a === "number" && isFinite(data.a)) guestIntent.a = data.a;
    });

    const offFire = ctx.onMessage("fire", ({ data, from }) => {
      if (!C || !C.isHost || phase !== "run" || from !== seats[otherIdx()] || !data) return;
      const t = tanks[otherIdx()];
      if (t && t.alive) spawnShellHost("g" + (data.seq | 0), t, +data.a, +data.p);
    });

    const offAgain = ctx.onMessage("again", ({ from }) => {
      if (C && C.isHost && phase === "over" && seats.includes(from)) startRound();
    });

    const offLeave = ctx.onEvent("leave", ({ id }) => {
      if (!C || !seats.includes(id) || id === (C.me && C.me.id)) return;
      phase = "over";                                     // the other seat left: I win by forfeit
      winner = Math.max(0, myIdx());
      if (C.isHost) broadcast();
      syncUI();
      celebrateWin();
    });

    const offHost = ctx.onEvent("host", ({ you }) => {
      if (you && phase !== "wait") {                      // the host left mid-round: settle the round as it is
        phase = "over";
        winner = winner == null ? Math.max(0, myIdx()) : winner;
        if (C && C.isHost) broadcast();
        syncUI();
      }
    });

    syncUI();
    return {
      go() { if (C && C.isHost) startRound(); },
      destroy() {
        offState(); offShot(); offBoom(); offMove(); offFire(); offAgain(); offLeave(); offHost();
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        try { inst.remove(); } catch (e) { /* already gone */ }
        uiNote = uiAgain = null; P = null; C = null;
      },
    };
  },
};
