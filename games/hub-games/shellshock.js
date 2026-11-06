// Shell Shock — 2D hills, tanks, real fire. Multiplayer hub game (two players, one battlefield).
//
// Two tanks, one rolling battlefield: drive around the hills, hold your fire and send a shell
// into the other tank. Last tank running wins.
//
// Architecture (host-authoritative, like Tic Tac Toe): the host owns the rules. Guests stream
// "move" intents (drive / turn / fire); the host simulates, resolves the shots against the hills
// and the tanks, and broadcasts the whole state. Everyone renders the same state, so it stays in
// sync without a server. The host's client also simulates the guest's tank from the intents.

import { shell } from "../hub-kit.js";

const W = 860;
const H = 540;
const TANK_R = 14;
const HP_MAX = 100;
const DMG = 34;
const FIRE_CD = 0.8;
const SPEED = 90;
const TURN_RATE = 2.4;
const SHELL_SPEED = 660;
const SHELL_LIFE = 1.6;
const RANGE = 430;

// ---------- terrain: rolling hills ----------

function hash(n) { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); }
let hills = [];
function makeHills(r) {
  hills = [];
  for (let i = 0; i < 4; i++) {
    const n = r * 7919 + i * 131;
    hills.push({
      x: W * (0.2 + 0.2 * i + 0.07 * hash(n + 1)),
      y: H * (0.2 + 0.18 * ((hash(n + 2) + 0.5) % 1)),
      r: 90 + 55 * hash(n + 3),
      h: 45 + 70 * hash(n + 4),
    });
  }
}
function elev(x, y) {
  let e = 0;
  for (const h of hills) {
    const dx = x - h.x, dy = y - h.y;
    e += h.h * Math.exp(-((dx * dx + dy * dy) / (2 * Math.pow(0.62 * h.r, 2))));
  }
  return e;
}

// ---------- state ----------

function freshTank(x, y, angle) { return { x, y, angle, hp: HP_MAX, alive: true, vel: 0 }; }
function tankView(t) { return { x: t.x, y: t.y, angle: t.angle, hp: t.hp, alive: t.alive }; }

let C = null;                       // the hub ctx (injected by mount)
let me, opp;
let phase = "countdown";
let round = 0;
let winner = null;
let cdUntil = 0;
let shells = [];
let parts = [];
let myCD = 0;
let guestCD = 0;
let guestIntent = { drive: 0, turn: 0, fire: false };
let lastSent = null;
let flash = 0;

function broadcast() { C.send("state", { phase, round, me: tankView(me), opp: tankView(opp), winner }); }

function startRound() {
  round += 1;
  me = freshTank(W * 0.3, H * 0.5, 0.5);
  me.y = elev(me.x, H * 0.5) + TANK_R;
  opp = freshTank(W * 0.7, H * 0.5, 2.1);
  opp.y = elev(opp.x, H * 0.5) + TANK_R;
  phase = "countdown";
  winner = null;
  cdUntil = Date.now() + 3000;
  shells = [];
  parts = [];
  myCD = 0;
  guestCD = 0;
  guestIntent = { drive: 0, turn: 0, fire: false };
  broadcast();
}

// ---------- simulation ----------

function moveTank(t, drive, turn, dt) {
  if (!t.alive) return;
  t.angle += turn * TURN_RATE * dt;
  const fwd = (drive > 0 ? 1 : 0) - (drive < 0 ? 1 : 0);
  let v = t.vel || 0;
  const want = fwd * SPEED;
  v = v + (want - v) * Math.min(1, dt * 6);
  const step = v * dt;
  const slope = (elev(t.x + Math.cos(t.angle) * step, t.y + Math.sin(t.angle) * step) - elev(t.x, t.y)) / Math.max(dt, 1e-3);
  v = v * (1 - Math.min(0.85, Math.max(0, slope) * 0.3));
  const moved = v * dt;
  const mx = t.x + Math.cos(t.angle) * moved;
  const my = t.y + Math.sin(t.angle) * moved;
  t.x = Math.max(TANK_R + 10, Math.min(W - TANK_R - 10, mx));
  t.y = Math.max(TANK_R + 4, Math.min(H - TANK_R - 4, elev(t.x, my) + TANK_R));
  t.vel = v;
}

function isFiring() { return !!(P && (P.mouseIsPressed || P.keyIsDown(70))); }

function fireShot(shooter, target) {
  if (!shooter.alive || !target.alive) return;
  const dx = Math.cos(shooter.angle), dy = Math.sin(shooter.angle);
  const bx = shooter.x + dx * TANK_R * 0.5;
  const by = shooter.y + dy * TANK_R * 0.5;
  const tx = target.x - bx, ty = target.y - by;
  const dist = Math.hypot(tx, ty);
  if (dist > RANGE) return;
  const ddx = tx / dist, ddy = ty / dist;
  const bE = elev(bx, by);
  for (let s = 1; s <= 8; s++) {
    const px = bx + ddx * (dist * s / 8), py = by + ddy * (dist * s / 8);
    if (elev(px, py) > bE + 2.5) return;                       // a hill in the way
  }
  shells.push({ x: bx, y: by, vx: ddx * SHELL_SPEED, vy: ddy * SHELL_SPEED, dmg: DMG, ownerMe: shooter === me, life: SHELL_LIFE });
  flash = 0.06;
}

function stepShells(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.life <= 0 || s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) { shells.splice(i, 1); continue; }
    const tgt = s.ownerMe ? opp : me;
    if (tgt.alive && Math.hypot(s.x - tgt.x, s.y - tgt.y) < TANK_R + 6) {
      tgt.hp -= s.dmg;
      spawnBurst(s.x, s.y, s.ownerMe ? PAL.sky : PAL.mint);
      shells.splice(i, 1);
      if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; phase = "over"; winner = tgt === me ? "opp" : "me"; broadcast(); if (winner === "me") celebrate(2); }
    }
  }
}

function spawnBurst(x, y, col) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 80;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 40 + Math.random() * 30, size: 2 + Math.random() * 3, col });
  }
}

// ---------- input ----------

function readInput() {
  const p = P;
  const drive = ((p.keyIsDown(87) || p.keyIsDown(38)) ? 1 : 0) - ((p.keyIsDown(83) || p.keyIsDown(40)) ? 1 : 0);
  const turn = ((p.keyIsDown(68) || p.keyIsDown(39)) ? 1 : 0) - ((p.keyIsDown(65) || p.keyIsDown(37)) ? 1 : 0);
  return { drive, turn };
}

function readIntent() {
  if (!C.isHost) {
    const inp = readInput();
    const intent = { drive: inp.drive, turn: inp.turn, fire: isFiring() };
    if (JSON.stringify(intent) !== JSON.stringify(lastSent)) { lastSent = intent; C.send("move", intent, C.hostId); }
  }
}

// ---------- p5 sketch ----------

let canvasHost = null;
let inst = null;
let P = null;
const sketch = (p) => {
  P = p;
  p.setup = () => {
    const cnv = p.createCanvas(W, H);
    cnv.parent(canvasHost);
    cnv.style.width = "100%";
    cnv.style.height = "auto";
    p.pixelDensity(1);
    p.textFont(FONT);
    startRound();
  };
  p.draw = () => {
    const dt = Math.min(0.033, p.deltaTime || 0.016);
    if (phase === "countdown") {
      if (Date.now() >= cdUntil) { phase = "run"; broadcast(); }
    }
    if (phase === "run") {
      const inp = readInput();
      moveTank(me, inp.drive, inp.turn, dt);
      if (isFiring() && myCD <= 0) { myCD = FIRE_CD; fireShot(me, opp); }
      if (C.isHost) {
        moveTank(opp, guestIntent.drive, guestIntent.turn, dt);
        if (guestIntent.fire && guestCD <= 0) { guestCD = FIRE_CD; fireShot(opp, me); }
      }
      stepShells(dt);
      if (me.alive && !opp.alive) { phase = "over"; winner = "me"; broadcast(); if (winner === "me") celebrate(2); }
      else if (opp.alive && !me.alive) { phase = "over"; winner = "opp"; broadcast(); }
      broadcast();
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 3);
    readIntent();
    render();
  };
};

// ---------- rendering ----------

function drawTerrain() {
  const p = P;
  const nx = 100, ny = 56;
  const rows = [];
  for (let j = 0; j <= ny; j++) {
    const y = (j / ny) * H;
    const row = [];
    for (let i = 0; i <= nx; i++) { const x = (i / nx) * W; row.push([x, y, elev(x, y)]); }
    rows.push(row);
  }
  p.noStroke();
  p.fill(PAL.mint[0], PAL.mint[1], PAL.mint[2], 110);
  p.beginShape(p.POLYGON);
  p.vertex(0, H);
  for (const row of rows) for (const pt of row) p.vertex(pt[0], pt[1]);
  p.vertex(W, H);
  p.endShape(p.POLYGON);
  p.noFill();
  p.stroke(PAL.line[0], PAL.line[1], PAL.line[2], 90);
  p.strokeWeight(1);
  for (let j = 1; j < ny; j++) {
    p.beginShape();
    for (const pt of rows[j]) p.vertex(pt[0], pt[1]);
    p.endShape();
  }
}

function drawTank(t, isMe) {
  const p = P;
  if (!t.alive) return;
  const col = isMe ? PAL.mint : PAL.sky;
  const a = t.angle, dx = Math.cos(a), dy = Math.sin(a);
  p.stroke(PAL.ink[0], PAL.ink[1], PAL.ink[2], 120);
  p.strokeWeight(3);
  p.line(t.x + dx * TANK_R * 0.45, t.y + dy * TANK_R * 0.45, t.x + dx * (TANK_R * 1.05), t.y + dy * (TANK_R * 1.05));
  p.push();
  p.translate(t.x, t.y);
  p.rotate(a);
  p.noStroke();
  p.fill(...col);
  p.ellipse(0, 0, TANK_R * 2, TANK_R * 1.45, 5);
  p.stroke(...PAL.ink, 80);
  p.strokeWeight(2);
  p.line(-TANK_R * 0.85, 0, -TANK_R * 0.15, 0);
  p.noStroke();
  p.fill(255, 255, 255, 40);
  p.ellipse(TANK_R * 0.55, 0, TANK_R * 0.8, TANK_R * 0.9, 4);
  p.pop();
  // health bar
  p.noStroke();
  p.fill(PAL.ink[0], PAL.ink[1], PAL.ink[2], 50);
  p.rect(t.x - 24, t.y - TANK_R * 2 - 14, 48, 5, 2);
  p.fill(...col, 235);
  p.rect(t.x - 24, t.y - TANK_R * 2 - 14, 48 * Math.max(0, t.hp / HP_MAX), 5, 2);
}

function drawHUD() {
  const p = P;
  if (phase === "countdown") {
    const cd = Math.max(0, Math.ceil((cdUntil - Date.now()) / 1000));
    p.noStroke();
    p.fill(...PAL.ink);
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(96);
    p.text(String(cd), W / 2, H / 2);
    p.textStyle(p.NORMAL);
    p.textSize(16);
    p.fill(...PAL.muted);
    p.text("Ziel: Gegner · Halte F oder die Maus zum Schießen", W / 2, H / 2 + 52);
    return;
  }
  p.noStroke();
  p.fill(...PAL.ink);
  p.textAlign(p.CENTER, p.TOP);
  p.textStyle(p.BOLD);
  p.textSize(19);
  let status = "Halte F oder die Maus, um zu schießen";
  if (phase === "over") status = winner === "me" ? "DU HAST GEWONNEN!" : "DU HABT VERLOREN!";
  else if (!me.alive) status = "DU BIST AUSGESCHOSSSEN …";
  else if (!opp.alive) status = "DU HAST GEWONN!";
  p.text(status, W / 2, 14);
  p.textStyle(p.NORMAL);
  p.textSize(14);
}

function drawOverlays() {
  const p = P;
  if (phase !== "over") return;
  p.noStroke();
  p.fill(winner === "me" ? PAL.mint[0] : PAL.rose[0], winner === "me" ? PAL.mint[1] : PAL.rose[1], winner === "me" ? PAL.mint[2] : PAL.rose[2]);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(64);
  p.text(winner === "me" ? "DU HAST GEWONNEN!" : "DU HABT VERLOREN!", W / 2, H / 2);
  p.textStyle(p.NORMAL);
  p.textSize(18);
  p.fill(...PAL.muted);
  p.text("Der Hügel bleibt – die Panzer nicht.", W / 2, H / 2 + 52);
}

function render() {
  const p = P;
  p.background(...PAL.board);
  drawTerrain();
  for (const s of shells) {
    p.noStroke();
    p.fill(s.ownerMe ? PAL.sky[0] : PAL.mint[0], s.ownerMe ? PAL.sky[1] : PAL.mint[1], s.ownerMe ? PAL.sky[2] : PAL.mint[2], 220);
    p.circle(s.x, s.y, 6);
  }
  drawTank(me, true);
  drawTank(opp, false);
  if (flash > 0 && me.alive) {
    const p = P;
    const a = me.angle;
    p.noStroke();
    p.fill(PAL.sun[0], PAL.sun[1], PAL.sun[2], 170);
    p.circle(me.x + Math.cos(a) * TANK_R * 1.05, me.y + Math.sin(a) * TANK_R * 1.05, 12 + flash * 46);
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const pt = parts[i];
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vx *= 0.94; pt.vy *= 0.94;
    pt.life -= 1;
    if (pt.life <= 0) { parts.splice(i, 1); continue; }
    const a = Math.max(0, pt.life / 45);
    p.noStroke();
    p.fill(pt.col[0], pt.col[1], pt.col[2], a);
    p.circle(pt.x, pt.y, pt.size * (pt.life / 45));
  }
  drawHUD();
  drawOverlays();
}

// ---------- mount ----------

export default {
  min: 2,
  max: 2,

  mount(ctx) {
    C = ctx;
    const kit = shell(ctx, { title: "Shell Shock" });
    const body = kit.body;
    body.innerHTML = `<div class="ss"><div class="ss-stage"><div class="ss-canvas"></div></div><div class="ss-act"><p class="ss-note">W/S fahren · A/D drehen · F oder Maus halten zum Schießen</p><button type="button" class="primary" id="ss-again" hidden>Nochmal</button></div></div>`;
    canvasHost = body.querySelector(".ss-canvas");
    const againBtn = body.querySelector("#ss-again");
    againBtn.addEventListener("click", () => { if (C.isHost) startRound(); });

    inst = new p5(sketch);

    const offState = ctx.onMessage("state", ({ data, from }) => {
      if (C.isHost) return;                                 // the host broadcasts, it does not receive its own
      if (from !== C.hostId) return;
      phase = data.phase || "countdown";
      round = data.round || 1;
      // the host speaks in its own tank keys (me = host won / lost); flip for guest space (me = I won)
      winner = data.winner == null ? null : (data.winner === "me" ? "opp" : "me");
      if (phase === "over" && winner === "me") celebrate(2);
      me = { x: data.opp.x, y: data.opp.y, angle: data.opp.angle, hp: data.opp.hp, alive: data.opp.alive, vel: 0 };
      opp = { x: data.me.x, y: data.me.y, angle: data.me.angle, hp: data.me.hp, alive: data.me.alive, vel: 0 };
    });
    const offMove = ctx.onMessage("move", ({ data, from }) => {
      if (!C.isHost || phase !== "run") return;
      if (!data || typeof data !== "object") return;
      guestIntent.drive = data.drive === -1 ? -1 : data.drive === 1 ? 1 : 0;
      guestIntent.turn = data.turn === -1 ? -1 : data.turn === 1 ? 1 : 0;
      guestIntent.fire = !!data.fire;
    });
    const offLeave = ctx.onEvent("leave", ({ id }) => {
      if (id === C.me.id) return;                            // the other player left: I win by forfeit
      phase = "over";
      winner = "me";
      broadcast();
    });
    const offHost = ctx.onEvent("host", ({ you }) => { if (you) broadcast(); });

    return {
      destroy() {
        offState(); offMove(); offLeave(); offHost();
        try { inst && inst.remove(); } catch (e) { /* already gone */ }
      },
    };
  },
};
