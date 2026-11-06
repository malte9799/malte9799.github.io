// Neon-Bombe — heiße Kartoffel als Neon-Partyspiel für 2–6 Spieler.
// Eine Bombe wandert im Kreis. Wer sie hält, muss sie weitergeben, bevor sie
// (versteckt, zufällig) explodiert. Wer die Bombe hält, wenn sie bummt, fliegt
// raus. Wer zuletzt übrig bleibt, gewinnt.
// Online: der Host würfelt die versteckte Zündzeit und entscheidet über
// Explosion und Ausscheiden; alle Clients rendern denselben Stand
// (window.Multiplayer, WebRTC, siehe README.md). Ohne Raum läuft eine
// Übungsrunde gegen computergesteuerte Mitspieler.
// Look: durchgängig Neon/Synthwave — dunkler Grund, leuchtende Farben, Puls,
// Scanlines, Rütteln und Blitz bei der Explosion. Alle UI-Texte auf Deutsch.

initGame({
  title: "Neon-Bombe",
  tag: "Heiße Kartoffel · wer hält sie beim Bumm?",
  fullscreen: true,
  presets: [
    { label: "Kurz · 5–12 Sekunden", values: [5, 12] },
    { label: "Mittel · 8–20 Sekunden", values: [8, 20] },
    { label: "Lang · 15–30 Sekunden", values: [15, 30] },
  ],
  buttons: [
    { id: "btn-neu", label: "Neue Runde", primary: true, onClick: () => startOrRematch() },
    { id: "btn-sound", label: "Ton: an",  onClick: () => toggleSound() },
  ],
  sliders: [],
  onPreset: ([lo, hi]) => { FUSE_LO = lo; FUSE_HI = hi; saveState(); },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    title: "So wird gespielt",
    text: [
      "Die Bombe wandert im Kreis von Spieler zu Spieler. Wer sie hält, muss sie weitergeben, bevor sie explodiert.",
      "Wer die Bombe hält, wenn sie bummt, fliegt raus. Wer zuletzt übrig bleibt, gewinnt die Runde.",
      "Online: Über „Mehrspieler“ einen Raum erstellen (2–6 Spieler) und Freunde einladen. Der Host startet die Runde. Ohne Raum spielst du gegen computergesteuerte Mitspieler. Tasten: N neue Runde · M Ton · jede Taste gibt die Bombe weiter, wenn du dran bist.",
    ],
  },
});

// ---- konfiguration & zustand ----
let FUSE_LO = 8, FUSE_HI = 20;
let SOUND = true;
let MP = window.Multiplayer;
let isHost = false;
let meId = "you";
let phase = "lobby";      // lobby | play | over
let round = 0;
let bombIdx = 0;          // index in players[] der die Bombe hält
let fuseEnd = 0, fuseDur = 0, bombSince = 0;
let roundGen = 0;
let players = [];         // {id, name, color, alive, orderIdx, you, bot}
let winnerId = null;
let exploding = false;
let shake = 0, flash = 0;
let parts = [];
let audioCtx = null;
let celebrated = false;   // Konfetti nur einmal pro Sieg

const HOLD_MIN = 0.7;     // Mindesthaltezeit vor Weitergabe (Sekunden)
const NEON = [
  [0, 240, 255],   // cyan
  [255, 0, 255],   // magenta
  [255, 212, 0],   // gelb
  [0, 255, 136],   // limette
  [255, 122, 0],   // orange
  [190, 60, 255],  // violett
];

function saveState() { saveSettings("neonbombe_state", { FUSE_LO, FUSE_HI }); }
function loadState() {
  const d = loadSettings("neonbombe_state");
  if (typeof d.FUSE_LO === "number") FUSE_LO = d.FUSE_LO;
  if (typeof d.FUSE_HI === "number") FUSE_HI = d.FUSE_HI;
}
loadState();

// ---- multiplayer (das vorhandene WebRTC-System) ----
function netWire() {
  if (!MP) return;
  MP.configure({
    game: "neonbombe",
    min: 2, max: 6,
    startOptions: () => ({ lo: FUSE_LO, hi: FUSE_HI }),
  });
  const row = document.querySelector("#ui-overlay .row.tight");
  if (row) MP.mountButton(row);
  MP.on("start", (ev) => {
    isHost = ev.isHost;
    meId = MP.state ? MP.state.selfId : "you";
    buildPlayersFromMP(ev.players);
    round = 0;
    if (isHost) nextRound();
    // Nicht-Host bleiben in "lobby" bis der erste state vom Host kommt
  });
  MP.on("end", () => { phase = "lobby"; flashNote("Zurück in der Lobby."); });
  MP.on("join", () => syncPlayersFromMP());
  MP.on("leave", (p) => {
    syncPlayersFromMP();
    if (phase === "over") return;
    flashNote(p.name + " hat den Raum verlassen.");
    if (isHost && players.filter(pl => pl.alive).length <= 1) endRound();
  });
  MP.on("players", () => syncPlayersFromMP());
  MP.on("host", (h) => { if (h.you) flashNote("Du bist jetzt der Host."); });
  MP.onMessage("state", (m) => {
    if (!m.data) return;
    applyState(m.data);
  });
  MP.onMessage("explode", (m) => {
    if (!m.data) return;
    exploding = true;
    explodeAt = nowSec();
    shake = 14; flash = 255;
    if (SOUND) playExplode();
  });
  MP.onMessage("pass", (m) => {
    // Nur der Host verarbeitet Weitergaben; Clients senden nur.
    if (isHost) doPass(m.from);
  });
  MP.openFromUrl();
}

function syncPlayersFromMP() {
  if (!MP || !MP.state) return;
  const list = MP.state.players || [];
  players = list.map((p, i) => ({
    id: p.id, name: p.name || "Spieler", color: NEON[i % NEON.length],
    alive: true, orderIdx: i, you: !!p.you, bot: false,
  }));
  meId = MP.state.selfId || "you";
  if (bombIdx >= players.length) bombIdx = 0;
}

function buildPlayersFromMP(list) {
  players = (list || []).map((p, i) => ({
    id: p.id, name: p.name || "Spieler", color: NEON[i % NEON.length],
    alive: true, orderIdx: i, you: !!p.you, bot: false,
  }));
  meId = (MP && MP.state && MP.state.selfId) || "you";
  bombIdx = 0;
}

// Solo-Modus: eigene "Spielerliste" mit Bots, wir selbst sind Host.
function startSolo() {
  isHost = true;
  meId = "you";
  const names = ["Du", "Mia", "Ben", "Lia"];
  players = names.map((n, i) => ({
    id: i === 0 ? "you" : "bot" + i, name: n, color: NEON[i % NEON.length],
    alive: true, orderIdx: i, you: i === 0, bot: i > 0,
  }));
  bombIdx = 0;
  round = 0;
  phase = "play";
  nextRound();
}

function myOrder() {
  return players.findIndex(p => p.you);
}
function myTurn() {
  return phase === "play" && meAlive() && bombIdx === myOrder();
}
function meAlive() {
  const p = players.find(pl => pl.you);
  return !!p && p.alive;
}
function alivePlayers() {
  return players.filter(p => p.alive);
}

// ---- rundenablauf (Host hat Autorität) ----
function nextRound() {
  roundGen++;
  const myGen = roundGen;
  const alive = alivePlayers();
  if (alive.length <= 1) {
    winnerId = alive.length === 1 ? alive[0].id : null;
    phase = "over";
    if (SOUND) playWin();
    if (MP && isHost) MP.send("state", snapState());
    return;
  }
  round++;
  bombIdx = alive[Math.floor(Math.random() * alive.length)].orderIdx;
  fuseDur = FUSE_LO + Math.random() * (FUSE_HI - FUSE_LO);
  fuseEnd = nowSec() + fuseDur;
  bombSince = nowSec();
  phase = "play";
  exploding = false;
  celebrated = false;
  snapAndBroadcast();
  if (isHost) {
    setTimeout(() => { if (myGen === roundGen && phase === "play") doExplosion(); }, fuseDur * 1000);
  }
}

function doPass(from) {
  if (phase !== "play") return;
  const p = players.find(pl => pl.id === from);
  if (!p || !p.alive) return;
  if (bombIdx !== p.orderIdx) return;
  if (nowSec() - bombSince < HOLD_MIN) return;
  let next = (bombIdx + 1) % players.length;
  while (!players[next].alive && next !== bombIdx) next = (next + 1) % players.length;
  bombIdx = next;
  bombSince = nowSec();
  snapAndBroadcast();
}

function requestPass() {
  if (!myTurn()) return;
  ensureAudio();
  if (SOUND) playPass();
  if (MP) { MP.send("pass", { from: meId }); }
  else { doPass(meId); }
}

function doExplosion() {
  if (phase !== "play") return;
  const by = bombIdx;
  phase = "exploding";
  exploding = true;
  explodeAt = nowSec();
  shake = 14; flash = 255;
  if (SOUND) playExplode();
  if (MP) { MP.send("explode", { by }); MP.send("state", snapStateAfterEliminate(by)); }
  else { eliminate(by); }
  setTimeout(() => { if (isHost || !MP) nextRound(); }, 2200);
}

function eliminate(id) {
  const p = players.find(pl => pl.id === id);
  if (p) p.alive = false;
}

function snapState() {
  return { round, bombIdx, players: players.map(p => ({ id: p.id, alive: p.alive })), phase, winnerId, passAt: bombSince };
}
function snapAndBroadcast() {
  const s = snapState();
  if (MP) MP.send("state", s);
  applyState(s);
}
function snapStateAfterEliminate(by) {
  const p = players.find(pl => pl.orderIdx === by);
  if (p) p.alive = false;
  return snapState();
}
function applyState(s) {
  round = s.round;
  bombIdx = s.bombIdx;
  phase = s.phase;
  winnerId = s.winnerId;
  if (s.players) {
    s.players.forEach(ps => {
      const p = players.find(pl => pl.id === ps.id);
      if (p) p.alive = ps.alive;
    });
  }
  if (s.fuseEnd !== undefined) { fuseEnd = s.fuseEnd; fuseDur = s.fuseDur; }
  if (s.passAt !== undefined) bombSince = s.passAt;
  if (phase === "over" && SOUND && !exploding) { playWin(); }
}

function endRound() {
  nextRound();
}

function startOrRematch() {
  if (MP && MP.connected) {
    if (isHost) {
      const n = (MP.state && MP.state.players) ? MP.state.players.length : 0;
      if (n < 2) { flashNote("Mindestens 2 Spieler im Raum nötig."); return; }
      MP.start();
    } else {
      flashNote("Nur der Host startet die Runde.");
    }
  } else {
    startSolo();
  }
}

function toggleSound() {
  SOUND = !SOUND;
  document.getElementById("btn-sound").textContent = "Ton: " + (SOUND ? "an" : "aus");
  flashNote(SOUND ? "Ton an" : "Ton aus");
}

// ---- audio (Web Audio API, kein externes Tool) ----
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
}
function playTone(freq, type, dur, vol) {
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}
function playPass() {
  playTone(900, "sine", 0.06, 0.12);
}
function playExplode() {
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const n = audioCtx.createBufferSource();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 4000);
  n.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  n.connect(g); g.connect(audioCtx.destination);
  n.start(t);
  playTone(110, "sawtooth", 0.6, 0.25);
  playTone(80, "sawtooth", 0.6, 0.2);
}
function playWin() {
  playTone(660, "sine", 0.15, 0.2);
  setTimeout(() => playTone(880, "sine", 0.15, 0.2), 120);
  setTimeout(() => playTone(1046, "sine", 0.3, 0.25), 260);
}
function nowSec() { return Date.now() / 1000; }

// ---- partikel ----
function spawnBurst(x, y, col) {
  for (let i = 0; i < 26; i++) {
    parts.push({ x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14 - 2, life: 1, col });
  }
}
function updateParticles() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.035;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function drawParticles() {
  parts.forEach(p => {
    noStroke();
    fill(p.col[0], p.col[1], p.col[2], p.life * 255);
    circle(p.x, p.y, 3 + p.life * 4);
  });
}

// ---- p5 ----
function setup() {
  createCanvas(windowWidth, windowHeight);
  if (!MP || !MP.connected) startSolo();
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
function draw() {
  background(10, 11, 26);
  drawScanlines();

  let cx = width / 2, cy = height * 0.58;
  if (shake > 0) { cx += random(-shake, shake); cy += random(-shake, shake); shake *= 0.92; if (shake < 0.6) shake = 0; }

  drawPlayerCircle(cx, cy);
  drawBomb(cx, cy);
  drawHUD(cx, cy);
  updateParticles();
  drawParticles();

  if (flash > 0) {
    fill(255, 255, 255, flash);
    noStroke(); rect(0, 0, width, height);
    flash *= 0.82; if (flash < 1) flash = 0;
  }

  if (phase === "over") drawResult(cx, cy);
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  if (phase === "play" && myTurn() && hitPassButton()) {
    requestPass();
  }
}
function keyPressed() {
  if (phase === "play" && myTurn()) requestPass();
}

// ---- zeichnung ----
function drawScanlines() {
  stroke(0, 0, 0, 28);
  for (let y = 0; y < height; y += 4) {
    line(0, y, width, y);
  }
  noFill();
  for (let k = 3; k >= 1; k--) {
    stroke(0, 0, 0, 40 - k * 8);
    ellipse(width / 2, height * 0.58, width * (0.9 + k * 0.15), height * (0.9 + k * 0.15));
  }
}

function drawPlayerCircle(cx, cy) {
  const n = players.length;
  const R = Math.min(width, height) * 0.42;
  const start = -PI / 2;
  players.forEach((p, i) => {
    const a = start + (i / n) * TWO_PI;
    const x = cx + cos(a) * R, y = cy + sin(a) * R;
    const holding = (phase === "play" && i === bombIdx);
    const alive = p.alive;
    if (holding && alive) {
      const pul = 1 + 0.25 * sin(frameCount * 0.22);
      noFill();
      stroke(p.color[0], p.color[1], p.color[2], 140 + 90 * sin(frameCount * 0.3));
      strokeWeight(3);
      circle(x, y, 52 * pul);
      noStroke();
    }
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(14);
    fill(alive ? 255 : 110);
    if (p.you) fill(alive ? p.color : [110, 110, 120]);
    text(p.name + (p.you ? " (du)" : ""), x, y - 20);
    noStroke();
    fill(alive ? p.color : [90, 90, 100]);
    circle(x, y, 11);
    if (!alive) {
      textSize(13); fill(255, 60, 60, 210); text("AUS", x, y + 18);
    }
    if (holding && alive) {
      fill(255); textSize(11); textStyle(NORMAL);
      text("dran", x, y + 30);
    }
  });
}

function drawBomb(cx, cy) {
  const p = players[bombIdx];
  const holdingMe = myTurn();
  const col = holdingMe ? p.color : [120, 120, 150];
  let tension = 0;
  if (phase === "play") tension = 1 - clamp((fuseEnd - nowSec()) / fuseDur, 0, 1);
  const pul = 1 + 0.08 * sin(frameCount * (0.1 + tension * 1.2)) + tension * 0.15;

  noFill();
  for (let k = 4; k >= 1; k--) {
    stroke(col[0], col[1], col[2], 60 + k * 30);
    strokeWeight(2);
    circle(cx, cy, 96 * pul + k * 10);
  }
  noStroke();
  fill(col[0], col[1], col[2]);
  rect(cx - 24 * pul, cy - 16 * pul, 48 * pul, 32 * pul, 14 * pul);
  stroke(col[0], col[1], col[2], 220);
  strokeWeight(3);
  strokeCap(ROUND);
  line(cx, cy - 16 * pul, cx, cy - 28 * pul);
  noStroke();
  fill(255, 255, 220);
  circle(cx, cy - 30 * pul, 5 * pul);
  fill(255, 255, 255, 120);
  circle(cx - 8 * pul, cy - 6 * pul, 5 * pul);

  if (exploding && nowSec() - explodeAt < 0.6) {
    const e = 1 - (nowSec() - explodeAt) / 0.6;
    noFill();
    stroke(255, 255, 255, 200 * e);
    strokeWeight(4);
    circle(cx, cy, 120 * e);
    if (frameCount % 3 === 0) spawnBurst(cx, cy, p ? p.color : [255, 255, 255]);
  }
}

function drawHUD(cx, cy) {
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  if (phase === "lobby") {
    textSize(16); fill(200, 200, 210);
    text("Warte auf Mitspieler …", cx, cy - 150);
    textSize(14); fill(150, 150, 170);
    text(players.length + " Spieler im Raum", cx, cy - 125);
    return;
  }
  if (!meAlive()) {
    textSize(17); fill(255, 70, 70);
    text("Du bist raus.", cx, cy - 150);
    textSize(13); fill(180, 180, 190);
    text("Zuschauer", cx, cy - 125);
    return;
  }
  if (myTurn()) {
    const col = colorsOf(bombIdx);
    textSize(18); fill(col[0], col[1], col[2]);
    text("DU hältst die Bombe", cx, cy - 150);
    const ready = nowSec() - bombSince >= HOLD_MIN;
    textSize(13);
    fill(ready ? [120, 255, 140] : [255, 200, 60]);
    text(ready ? "Weitergabe möglich" : "Bitte kurz halten …", cx, cy - 120);
  } else {
    const holder = players[bombIdx];
    textSize(17); fill(240, 240, 250);
    text((holder ? holder.name : "?") + " hält die Bombe", cx, cy - 150);
    textSize(13); fill(160, 160, 175);
    text("Warte auf Weitergabe …", cx, cy - 120);
  }
  textSize(14); textStyle(NORMAL); fill(140, 140, 160);
  text("Runde " + round + "  ·  Noch im Spiel: " + alivePlayers().length, cx, height - 30);
}

function colorsOf(idx) {
  const p = players[idx];
  return p ? p.color : [200, 200, 210];
}

function hitPassButton() {
  const bw = Math.min(width * 0.6, 420), bh = 64;
  const x = width / 2 - bw / 2, y = height * 0.78;
  return mouseX >= x && mouseX <= x + bw && mouseY >= y && mouseY <= y + bh;
}
function drawPassButton() {
  const bw = Math.min(width * 0.6, 420), bh = 66;
  const x = width / 2 - bw / 2, y = height * 0.78;
  const p = players[bombIdx];
  const ready = nowSec() - bombSince >= HOLD_MIN;
  const col = p ? p.color : [200, 200, 210];
  noStroke();
  fill(col[0], col[1], col[2], ready ? 255 : 110);
  rect(x, y, bw, bh, 16);
  if (ready) {
    noFill(); stroke(255); strokeWeight(2);
    rect(x + 3, y + 3, bw - 6, bh - 6, 14);
  }
  textAlign(CENTER, CENTER); textStyle(BOLD);
  textSize(20);
  fill(20, 20, 30);
  text("WEITERGABE", width / 2, y + bh / 2 + 2);
}

function drawResult(cx, cy) {
  noStroke();
  fill(0, 0, 0, 210);
  rect(0, 0, width, height);
  const wC = Math.min(width - 60, 520);
  const hC = 300;
  const x = cx - wC / 2, y = cy - hC / 2 + 40;
  fill(20, 20, 32, 235);
  stroke(255); strokeWeight(2);
  rect(x, y, wC, hC, 18);
  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(30);
  fill(0, 255, 160);
  text(winnerId ? "Runde vorbei!" : "Unentschieden!", cx, y + 50);
  if (winnerId) {
    const w = players.find(pl => pl.id === winnerId);
    textSize(24);
    fill(w ? w.color : [255, 255, 255]);
    text((w && w.you ? "Du" : w ? w.name : "?") + " gewinnt!", cx, y + 100);
  } else {
    textSize(20); fill(200, 200, 210);
    text("Alle raus gleichzeitig.", cx, y + 100);
  }
  textSize(15); fill(170, 170, 185);
  text("„Neue Runde“ für ein weiteres Spiel.", cx, y + 150);
  if (SOUND && winnerId && !celebrated) {
    celebrate(2);
    celebrated = true;
  }
}

// ---- Info-Modal-Vorschau (looping p5 Demo) ----
function infoAnim(p, w, h, frame) {
  p.background(10, 11, 26);
  p.noStroke();
  p.fill(0, 240, 255, 30);
  for (let k = 3; k >= 1; k--) {
    p.ellipse(w / 2, h / 2, w * (0.5 + k * 0.14), h * (0.5 + k * 0.14));
  }
  const t = frame * 0.05;
  const cx = w / 2 + sin(t) * 14;
  const cy = h / 2 + cos(t * 0.7) * 10;
  p.fill(255, 0, 255);
  p.circle(cx, cy, 22);
  p.fill(0, 255, 136);
  p.circle(w / 2 - sin(t) * 14, h / 2 - cos(t * 0.7) * 10, 16);
  p.fill(255);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(15);
  p.text("NEON-BOMBE", w / 2, h / 2 + 40);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- start ----
if (!MP || !MP.connected) startSolo();
netWire();

// p5's global mode starts on window.load. If this script loads after that,
// setup()/draw() may never have been called → no canvas, nothing renders.
// Fallback: create a p5 instance manually and bind its methods/properties
// to window so setup()/draw() can use global p5 functions (createCanvas, background, etc.).
if (typeof setup === "function" && typeof draw === "function" && !document.querySelector("canvas")) {
  const p = new p5(function(instance) {
    instance.setup = function() { setup(); };
    instance.draw = function() { draw(); };
  });
  // Expose p5 instance methods as window globals (same as p5 global mode)
  const proto = p.constructor.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== 'constructor' && typeof proto[key] === 'function' && !(key in window)) {
      window[key] = proto[key].bind(p);
    }
  }
  // Expose key p5 properties as window globals
  for (const key of ['width', 'height', 'frameCount', 'mouseX', 'mouseY', 'displayWidth', 'displayHeight', 'windowWidth', 'windowHeight']) {
    Object.defineProperty(window, key, {
      get: function() { return p[key]; },
      set: function(v) { p[key] = v; },
      configurable: true
    });
  }
}
