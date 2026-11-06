// Kritzel-Revier — real-time territory scribbling for 2–4 players, plus a solo practice clock.
//
// Everyone steers a wax crayon over a sheet of drawing paper and scribbles cells in their own
// colour. Coffee stains are impassable, glitter stars grant a short turbo, and when the clock
// runs out the biggest territory wins. Online multiplayer rides the site's WebRTC room
// (window.Multiplayer, see README.md): every client owns its own crayon and streams positions,
// painting is derived locally from the received positions, and the host owns the round clock and
// the final tally. Without a room the very same board runs as a practice round against the clock.
//
// The game has its own look — warm drawing paper, wax-crayon textures, wobbly ink lines — and
// ignores the site's design picker; only the slim top bar is re-skinned (like Blackjack).

initGame({
  title: "Kritzel-Revier",
  tag: "kritzle das größte Revier",
  fullscreen: true,
  presets: [
    { label: "Standard · 75 Sekunden",  values: [75] },
    { label: "Kurz · 45 Sekunden",      values: [45] },
    { label: "Marathon · 120 Sekunden", values: [120] },
  ],
  buttons: [
    { id: "btn-new",   label: "Nochmal",  primary: true, onClick: () => again() },
    { id: "btn-sound", label: "Ton: an",  onClick: () => toggleSound() },
  ],
  sliders: [],
  onPreset: ([s]) => {
    secs = s;
    saveState();
    if (mode === "solo") newPractice();
    else note("Gilt ab der nächsten Runde.");
  },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    title: "So wird gespielt",
    text: [
      "Jeder steuert einen Wachsmalstift über das Papier und kritzelt Zellen in der eigenen Farbe voll — zieh mit Maus oder Finger, der Stift folgt; Pfeiltasten oder WASD gehen auch.",
      "Kaffeeflecken sind unpassierbar, goldene Glitzersterne geben einen kurzen Turbo. Läuft die Uhr ab, gewinnt das größte Revier.",
      "Online: Über „Mehrspieler“ einen Raum erstellen und Freunde per Code, Link oder QR einladen (2–4 Spieler) — der Host startet die Runde. Ohne Raum läuft eine Übungsrunde gegen die Uhr. Tasten: N neue Runde · M Ton.",
    ],
  },
});

// Re-skin the slim top bar so it belongs on the drawing table, whatever design is picked.
(function skinBar() {
  const s = document.createElement("style");
  s.textContent = `
    #ui-overlay { background: linear-gradient(#f8eed6, #eee0bd) !important; border-bottom: 3px solid #cdb488 !important;
      box-shadow: 0 4px 18px rgba(90, 60, 20, .18) !important; backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important; }
    #ui-overlay h2 { color: #4a3728 !important; font-family: "Comic Sans MS", "Comic Sans", cursive !important;
      letter-spacing: .02em !important; }
    #ui-overlay .back-link, #ui-overlay #status-text, #ui-overlay .hint-note { color: #6b543c !important; }
    #ui-overlay .row.tight > button:not(.theme-btn) { font-family: "Comic Sans MS", "Comic Sans", cursive; font-weight: 700;
      color: #4a3728; background: linear-gradient(#fff9e8, #f4e4bd); border: 2px solid #4a3728;
      border-radius: 12px; box-shadow: 0 2px 0 #4a3728; }
    #ui-overlay .row.tight > button.primary { background: linear-gradient(#ffe27a, #f5b73a); }
    #ui-overlay .row.tight > button:active { transform: translateY(2px); box-shadow: none; }
    #ui-overlay .preset-row select { color: #4a3728 !important; background-color: #fff9e8 !important;
      border: 2px solid #4a3728 !important; box-shadow: none !important; }
    #ui-overlay .preset-row::after { border-color: #4a3728 !important; }
  `;
  document.head.appendChild(s);
})();

// ---- constants ----

// FONT is taken (themes.js provides the design's canvas font), so the crayon look carries its own
const KR_FONT = "Comic Sans MS";
const CELL = 28;
const HUD_H = 56, PAD = 14, SCORE_H = 44;
const STAIN = 255;
const BASE_SPEED = 140;            // stage units per second (~5 cells)
const BOOST_MUL = 1.75, BOOST_T = 4;
const PR = 11;                     // crayon radius, for collisions
const NIB = CELL * 0.78;           // paint reach around the tip
const POS_MS = 80;                 // position stream interval

const PAPER = [246, 235, 210], PAPER_HI = [252, 245, 228], INK = [62, 47, 32], LINE = [214, 197, 160];
const STAR_C = [243, 192, 44], STAR_D = [166, 116, 18];
const CRAYONS = [
  { base: [226, 84, 62],  dark: [150, 42, 30],  light: [244, 138, 116] },  // Rot
  { base: [32, 156, 142], dark: [16, 100, 92],  light: [96, 202, 188]  },  // Türkis
  { base: [124, 92, 219], dark: [74, 48, 150],  light: [170, 144, 240] },  // Violett
  { base: [235, 158, 32], dark: [156, 96, 12],  light: [248, 198, 98]  },  // Gold
];

// ---- state ----

let secs = 75;
let mode = "solo";               // "solo" | "mp"
let phase = "countdown";         // "countdown" | "run" | "over"
let cd = 0, cdShown = 99;        // countdown clock + last whole second (for tick sounds)
let simT = 0;                    // round clock, seconds of simulation
let seed = 1;
let COLS = 34, ROWS = 19;
let grid = null;                 // Uint8Array: 0 empty · 1..4 owner · 255 stain
let counts = [0, 0, 0, 0, 0];
let freeCells = 1;
let stains = [];                 // { cells, x, y, r, ph, drops } in field units
let pickups = [];                // { c, r, t, taken, by }
let borderPts = [];              // wobbly sheet border, field-local
let painters = [];
let meIdx = 0;
let best = 0, newBest = false;
let overScores = null;           // final ranking shown on the result card
let overFrame = 0, mpEnded = false;
let lastPosSend = 0, pressing = false;
let builtPortrait = null;
let soundOn = true;
let L = null;                    // stage layout, see layout()
let lobbyAt = 0;                 // hub: when the game mounted (seed rescue timer)
let noteMsg = "", noteAt = 0;    // hub has no #note element: canvas notes (see note())

// the shell's flashNote writes into #note, which only exists on the game page — in the hub
// notes are mirrored onto the paper instead (drawCanvasNote renders them)
function note(msg) {
  flashNote(msg);
  if (HUB()) { noteMsg = msg || ""; noteAt = typeof frameCount === "number" ? frameCount : 0; }
}

// ---- persistence ----

function saveState() { saveSettings("kritzel_state", { secs, sound: soundOn, best }); }
function loadState() {
  const d = loadSettings("kritzel_state");
  if ([45, 75, 120].includes(d.secs)) secs = d.secs;
  if (typeof d.sound === "boolean") soundOn = d.sound;
  if (typeof d.best === "number" && d.best >= 0 && d.best <= 100) best = Math.round(d.best);
}

// ---- multiplayer wiring (window.Multiplayer on the page, hub ctx adapter in the hub) ----

let MP = window.Multiplayer;
const HUB = () => !!window.__KR_NET__;

// Page mode: own the shell and open rooms directly. Hub mode: window.__KR_NET__ is an adapter
// speaking the Multiplayer dialect over the hub's room ctx; it is wired in __kritzelHubInit().
if (!HUB() && MP) {
  MP.configure({
    game: "kritzel",
    min: 2, max: 4,
    startOptions: () => ({ seed: (Math.random() * 1e9) | 0, secs }),
  });
  const row = document.querySelector("#ui-overlay .row.tight");
  if (row) MP.mountButton(row);
  MP.on("start", (ev) => onStart(ev));
  MP.on("end", () => note(MP.isHost ? "Zurück in der Lobby — „Nochmal“ für eine neue Runde." : "Zurück in der Lobby."));
  MP.openFromUrl();
}
wireNet();

// Guests do not rely on a direct WebRTC link to each other: the host is linked to everybody, but
// two guests may never connect. So a guest sends its positions and pickups to the host only, and
// the host relays them to the other guests ("rpos" / "rpick", tagged with the original sender).
// The host itself broadcasts straight to everybody.
function netOut(type, d) {
  if (MP.isHost) MP.send(type, d);
  else MP.send(type, d, MP.state && MP.state.hostId);
}

function relayFromHost(from, type, d) {
  if (!MP.isHost) return;
  for (const q of painters) {
    if (q.you || q.id === from) continue;
    MP.send("r" + type, { id: from, d }, q.id);
  }
}

// (re)register the game's net handlers on whatever net MP currently is
function wireNet() {
  if (!MP) return;
  MP.onMessage("pos", (m) => { onNetPos(m.from, m.data); relayFromHost(m.from, "pos", m.data); });
  MP.onMessage("pick", (m) => { onNetPick(m.from, m.data); relayFromHost(m.from, "pick", m.data); });
  MP.onMessage("rpos", (m) => { if (!MP.isHost && m.data) onNetPos(m.data.id, m.data.d); });
  MP.onMessage("rpick", (m) => { if (!MP.isHost && m.data) onNetPick(m.data.id, m.data.d); });
  MP.onMessage("over", (m) => onNetOver(m.data));
  MP.onMessage("seed", (m) => { if (HUB() && m.data) beginWith(Number(m.data.seed) || ((Math.random() * 1e9) | 0), Number(m.data.secs)); });
  MP.on("leave", (p) => onPlayerGone(p.id, p.name));
  MP.on("host", (h) => { if (h.you) note("Du bist jetzt der Host."); });
  MP.on("join", (p) => { if (!HUB() && p.you && phase !== "over") note("Im Raum " + (MP.state ? MP.state.code : "") + " — der Host startet die Runde."); });
  MP.on("close", (c) => onRoomClosed(c));
}

function onStart(ev) {
  const opts = ev.options || {};
  const list = (ev.players && ev.players.length ? ev.players : (MP ? MP.players : []));
  mode = "mp";
  painters = list.map((p, i) => makePainter(i, p.id, p.name || "Spieler", p.you));
  meIdx = Math.max(0, painters.findIndex((p) => p.you));
  syncPresetLabel();
  beginWith(Number(opts.seed) || ((Math.random() * 1e9) | 0), opts.secs);
}

// (re)start a round on a fresh seed; newSecs keeps every client on the same clock
function beginWith(s, newSecs) {
  if ([45, 75, 120].includes(newSecs)) secs = newSecs;
  seed = s;
  startRound();
}

function makePainter(idx, id, name, you) {
  return { idx, id, name, you: !!you, alive: true, x: 0, y: 0, vx: 0, vy: 0, netX: 0, netY: 0, target: null, boostUntil: 0 };
}

function onNetPos(from, d) {
  const p = painters.find((q) => q.id === from);
  if (!p || !d) return;
  p.netX = constrain(+d.x || 0, PR, COLS * CELL - PR);
  p.netY = constrain(+d.y || 0, PR, ROWS * CELL - PR);
}

function onNetPick(from, d) {
  const pk = pickups[d && d.i | 0];
  const p = painters.find((q) => q.id === from);
  if (!pk || !p || pk.taken) return;
  claimPickup(pk, p.idx, false);
}

function onNetOver(data) {
  if (phase === "over") return;
  const scores = ((data && data.scores) || [])
    .map((s) => {
      const p = painters.find((q) => q.id === s.id);
      return p ? { idx: p.idx, name: p.name, n: s.n | 0, you: p.you, gone: !p.alive } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.n - a.n);
  finish(scores.length ? scores : localScores());
}

function onPlayerGone(id, name) {
  const p = painters.find((q) => q.id === id);
  if (!p) return;
  p.alive = false;
  note(name + " ist gegangen — das Revier bleibt.");
}

function onRoomClosed(c) {
  if (mode !== "mp") return;
  mode = "solo";
  newPractice();
  note(c && c.reason === "left" ? "Raum verlassen — Übungsrunde gestartet." : "Verbindung getrennt — Übungsrunde gestartet.");
}

// ---- rounds ----

function newPractice() {
  mode = "solo";
  seed = (Math.random() * 1e9) | 0;
  painters = [makePainter(0, "solo", "Du", true)];
  meIdx = 0;
  startRound();
}

function startRound() {
  simT = 0;
  cd = mode === "mp" ? 3.2 : 2.0;
  cdShown = 99;
  overScores = null;
  newBest = false;
  mpEnded = false;
  buildArena(seed);
  phase = "countdown";
  clearParticles();
}

// host presses "Nochmal" (or N): a fresh practice round, a new online round via the room, or a
// new sheet in the hub (broadcast as a "seed" message, so nobody has to leave the game)
function again() {
  if (HUB()) {
    if (phase !== "over") { note("Die Runde läuft schon."); return; }
    if (!MP.isHost) { note("Nur der Host startet das nächste Blatt."); return; }
    const s = (Math.random() * 1e9) | 0;
    MP.send("seed", { seed: s, secs });
    beginWith(s);
    return;
  }
  if (mode === "mp" && MP && MP.connected) {
    if (phase === "run" || phase === "countdown") { note("Die Runde läuft schon."); return; }
    if (MP.state && MP.state.status !== "lobby") { note("Einen Moment — zurück in die Lobby …"); return; }
    if (!MP.isHost) { note("Nur der Host kann eine neue Runde starten."); return; }
    if (!MP.start({ seed: (Math.random() * 1e9) | 0, secs })) note("Mindestens 2 Spieler im Raum nötig.");
  } else {
    newPractice();
  }
}

function syncPresetLabel() {
  const sel = document.getElementById("preset-select");
  const i = [75, 45, 120].indexOf(secs);
  if (sel && i >= 0) sel.selectedIndex = i;
}

function toggleSound() {
  soundOn = !soundOn;
  saveState();
  updateSoundLabel();
  if (soundOn) { ensureAudio(); beep(660, 0.08, "triangle", 0.15); }
}

function updateSoundLabel() {
  const b = document.getElementById("btn-sound");
  if (b) b.textContent = "Ton: " + (soundOn ? "an" : "aus");
}

// ---- arena ----

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellHash(c, r) {
  let h = (c * 73856093) ^ (r * 19349663) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function buildArena(s) {
  COLS = L && L.portrait ? 21 : 34;
  ROWS = L && L.portrait ? 30 : 19;
  grid = new Uint8Array(COLS * ROWS);
  counts = [0, 0, 0, 0, 0];
  stains = [];
  pickups = [];
  builtPortrait = L ? L.portrait : null;
  const rng = mulberry32(s | 0);

  // coffee stains: little random walks
  const nStains = 9 + Math.floor(rng() * 4);
  for (let k = 0; k < nStains; k++) {
    let c = 3 + Math.floor(rng() * (COLS - 6));
    let r = 3 + Math.floor(rng() * (ROWS - 6));
    const cells = [];
    const len = 4 + Math.floor(rng() * 6);
    for (let j = 0; j < len; j++) {
      const i = r * COLS + c;
      if (grid[i] !== STAIN) { grid[i] = STAIN; cells.push(i); }
      const dirs = shuffleArray([[1, 0], [-1, 0], [0, 1], [0, -1]], rng);
      let moved = false;
      for (const [dx, dy] of dirs) {
        const nc = c + dx, nr = r + dy;
        if (nc >= 2 && nc < COLS - 2 && nr >= 2 && nr < ROWS - 2) { c = nc; r = nr; moved = true; break; }
      }
      if (!moved) break;
    }
    if (cells.length < 3) { cells.forEach((i) => (grid[i] = 0)); continue; }
    const pts = cells.map((i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 }));
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const rad = Math.max(...pts.map((p) => Math.hypot(p.x - x, p.y - y))) + CELL * 0.55;
    const drops = [];
    for (let d = 0; d < 3; d++) {
      const a = rng() * 6.28, dd = rad * (1.1 + rng() * 0.5);
      drops.push([Math.cos(a) * dd, Math.sin(a) * dd, 2.5 + rng() * 3.5]);
    }
    stains.push({ cells, x, y, r: rad, ph: pts.map(() => rng() * 6.28), drops });
  }

  // keep the spawn corners clean, then give every painter a home patch
  const anchors = [[3, 3], [COLS - 4, 3], [3, ROWS - 4], [COLS - 4, ROWS - 4]];
  for (const [ac, ar] of anchors)
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const c = ac + dc, r = ar + dr;
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[r * COLS + c] === STAIN) grid[r * COLS + c] = 0;
      }
  painters.forEach((p, i) => {
    const [ac, ar] = anchors[i % 4];
    p.x = (ac + 0.5) * CELL; p.y = (ar + 0.5) * CELL;
    p.vx = p.vy = 0; p.target = null; p.boostUntil = 0;
    p.netX = p.x; p.netY = p.y;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = ac + dc, r = ar + dr;
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[r * COLS + c] !== STAIN) paintCell(c, r, p.idx + 1, false);
      }
  });

  // glitter stars on a fixed schedule derived from the seed
  const rng2 = mulberry32((s ^ 0x9e3779b9) | 0);
  let t = 6 + rng2() * 4;
  while (t < secs - 6) {
    for (let tries = 0; tries < 40; tries++) {
      const c = 2 + Math.floor(rng2() * (COLS - 4));
      const r = 2 + Math.floor(rng2() * (ROWS - 4));
      if (grid[r * COLS + c] === STAIN) continue;
      if (pickups.some((q) => Math.abs(q.c - c) + Math.abs(q.r - r) < 5)) continue;
      pickups.push({ c, r, t, taken: false, by: 0 });
      break;
    }
    t += 10 + rng2() * 7;
  }

  freeCells = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] !== STAIN) freeCells++;
  recountCounts();
  buildBorder();
  rebuildPaintLayer();
}

function recountCounts() {
  counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < grid.length; i++) if (grid[i] && grid[i] !== STAIN) counts[grid[i]]++;
}

function paintCell(c, r, own, audible) {
  const i = r * COLS + c;
  const cur = grid[i];
  if (cur === STAIN || cur === own) return false;
  if (cur) counts[cur]--;
  grid[i] = own;
  counts[own]++;
  stampCell(c, r, own);
  if (audible && own === meIdx + 1) scratch();
  return true;
}

function buildBorder() {
  const W = COLS * CELL, H = ROWS * CELL;
  const jit = (n) => { const h = Math.imul(n + 1, 2654435761) >>> 0; return ((h % 1000) / 1000 - 0.5) * 5; };
  borderPts = [];
  const step = 26;
  const nx = Math.max(4, Math.round(W / step)), ny = Math.max(4, Math.round(H / step));
  let n = 0;
  for (let i = 0; i < nx; i++, n++) borderPts.push({ x: (i * W) / nx, y: jit(n) });
  for (let j = 0; j < ny; j++, n++) borderPts.push({ x: W + jit(n), y: (j * H) / ny });
  for (let i = nx; i > 0; i--, n++) borderPts.push({ x: ((i - 1) * W) / nx, y: H + jit(n) });
  for (let j = ny; j > 0; j--, n++) borderPts.push({ x: jit(n), y: ((j - 1) * H) / ny });
}

// ---- paint layer: crayon texture stamped once per changed cell ----

const TILE = 128;
let paintCv = null, paintCtx = null, paintPats = {}, PX = 1;

function makeCrayonTile(ci) {
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const x = c.getContext("2d");
  const C = CRAYONS[ci];
  const col = (a) => `rgba(${C.base[0]},${C.base[1]},${C.base[2]},${a})`;
  const rnd = mulberry32(1234 + ci * 77);
  x.lineCap = "round";
  const baseA = ci * 0.7;
  for (let k = 0; k < 34; k++) {
    const px = rnd() * TILE, py = rnd() * TILE;
    const ang = baseA + (rnd() - 0.5) * 0.9;
    const len = 22 + rnd() * 40;
    x.strokeStyle = col(0.16 + rnd() * 0.2);
    x.lineWidth = 4 + rnd() * 6;
    x.beginPath();
    for (let s2 = 0; s2 <= 3; s2++) {
      const tt = s2 / 3, wob = Math.sin(tt * 6 + k) * 2.2;
      const xx = px + Math.cos(ang) * len * tt - Math.sin(ang) * wob;
      const yy = py + Math.sin(ang) * len * tt + Math.cos(ang) * wob;
      s2 ? x.lineTo(xx, yy) : x.moveTo(xx, yy);
    }
    x.stroke();
  }
  for (let k = 0; k < 26; k++) {           // darker wax grain
    x.strokeStyle = `rgba(${C.dark[0]},${C.dark[1]},${C.dark[2]},${0.25 + rnd() * 0.3})`;
    x.lineWidth = 1.6 + rnd() * 1.6;
    const px = rnd() * TILE, py = rnd() * TILE, ang = baseA + (rnd() - 0.5) * 0.5, len = 4 + rnd() * 9;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
  }
  for (let k = 0; k < 14; k++) {           // paper showing through
    x.fillStyle = `rgba(252,246,230,${0.35 + rnd() * 0.3})`;
    x.beginPath(); x.ellipse(rnd() * TILE, rnd() * TILE, 1.5 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 6.3); x.fill();
  }
  return c;
}
const crayonTiles = CRAYONS.map((_, i) => makeCrayonTile(i));

function rebuildPaintLayer() {
  if (!L || !grid) return;
  PX = Math.min(3, Math.max(1, L.S * (window.devicePixelRatio || 1)));
  paintCv = document.createElement("canvas");
  paintCv.width = Math.max(2, Math.round(L.field.w * PX));
  paintCv.height = Math.max(2, Math.round(L.field.h * PX));
  paintCtx = paintCv.getContext("2d");
  paintPats = {};
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const o = grid[r * COLS + c];
      if (o && o !== STAIN) stampCell(c, r, o);
    }
}

function stampCell(c, r, own) {
  if (!paintCtx) return;
  let pat = paintPats[own];
  if (!pat) pat = paintPats[own] = paintCtx.createPattern(crayonTiles[(own - 1) % 4], "repeat");
  const j = cellHash(c, r);
  paintCtx.save();
  paintCtx.scale(PX, PX);
  paintCtx.translate(c * CELL + CELL / 2 + ((j % 5) - 2), r * CELL + CELL / 2 + (((j >> 4) % 5) - 2));
  paintCtx.rotate((((j >> 8) % 9) - 4) * 0.012);
  paintCtx.fillStyle = pat;
  paintCtx.fillRect(-CELL / 2 - 3, -CELL / 2 - 3, CELL + 6, CELL + 6);
  paintCtx.restore();
}

// ---- sounds (tiny WebAudio synth, no assets) ----

let AC = null, master = null, scratchGate = 0;

function ensureAudio() {
  if (AC) { if (AC.state === "suspended") AC.resume().catch(() => {}); return; }
  if (!soundOn) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.5;
    master.connect(AC.destination);
  } catch (e) { AC = null; }
}

function beep(freq, dur, type = "sine", vol = 0.18, when = 0) {
  if (!AC || !soundOn) return;
  const t0 = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function scratch() {                       // soft crayon noise when painting fresh cells
  if (!AC || !soundOn) return;
  const now = performance.now();
  if (now < scratchGate) return;
  scratchGate = now + 90;
  const dur = 0.07, n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900 + Math.random() * 700; f.Q.value = 1.2;
  const g = AC.createGain(); g.gain.value = 0.05;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}

function fanfare(win) {
  [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, "triangle", 0.2, i * 0.09));
  if (win) beep(1318, 0.3, "triangle", 0.22, 0.4);
}

// ---- simulation ----

function hitSomething(x, y) {
  if (x - PR < 0 || x + PR > COLS * CELL || y - PR < 0 || y + PR > ROWS * CELL) return true;
  const c0 = Math.max(0, Math.floor((x - PR) / CELL)), c1 = Math.min(COLS - 1, Math.floor((x + PR) / CELL));
  const r0 = Math.max(0, Math.floor((y - PR) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((y + PR) / CELL));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      if (grid[r * COLS + c] !== STAIN) continue;
      const nx = constrain(x, c * CELL, (c + 1) * CELL);
      const ny = constrain(y, r * CELL, (r + 1) * CELL);
      if (Math.hypot(x - nx, y - ny) < PR) return true;
    }
  return false;
}

function stepLocal(p, dt) {
  let dx = 0, dy = 0;
  if (phase === "run") {
    const lft = keyIsDown(37) || keyIsDown(65), rgt = keyIsDown(39) || keyIsDown(68);
    const up = keyIsDown(38) || keyIsDown(87), dwn = keyIsDown(40) || keyIsDown(83);
    dx = (rgt ? 1 : 0) - (lft ? 1 : 0);
    dy = (dwn ? 1 : 0) - (up ? 1 : 0);
    if (dx || dy) {
      const d = Math.hypot(dx, dy);
      dx /= d; dy /= d;
      p.target = null;                   // keys take over from the pointer
    } else if (p.target) {
      dx = p.target.x - p.x; dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) { dx = dy = 0; } else { dx /= d; dy /= d; }
    }
  }
  const spd = BASE_SPEED * (p.boostUntil > simT ? BOOST_MUL : 1);
  p.vx += (dx * spd - p.vx) * Math.min(1, dt * 9);
  p.vy += (dy * spd - p.vy) * Math.min(1, dt * 9);
  let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  if (hitSomething(nx, p.y)) { nx = p.x; p.vx = 0; }
  if (hitSomething(nx, ny)) { ny = p.y; p.vy = 0; }
  p.x = nx; p.y = ny;
}

function stepRemote(p, dt) {
  const k = Math.min(1, dt * 10);
  const px = p.x, py = p.y;
  p.x += (p.netX - p.x) * k;
  p.y += (p.netY - p.y) * k;
  p.vx = (p.x - px) / Math.max(dt, 1e-4);
  p.vy = (p.y - py) / Math.max(dt, 1e-4);
}

function paintAround(p) {
  const own = p.idx + 1;
  const c0 = Math.floor(p.x / CELL), r0 = Math.floor(p.y / CELL);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      if (Math.hypot((c + 0.5) * CELL - p.x, (r + 0.5) * CELL - p.y) <= NIB) paintCell(c, r, own, true);
    }
}

function claimPickup(pk, idx, mine) {
  pk.taken = true;
  pk.by = idx;
  const p = painters[idx];
  if (p) p.boostUntil = simT + BOOST_T;
  const s = toScreen((pk.c + 0.5) * CELL, (pk.r + 0.5) * CELL);
  spawnBurst(s.x, s.y, { count: 18, speed: [1, 4], life: [40, 90], size: [2, 5], col: STAR_C, drag: 0.94, decay: 4 });
  if (mine) {
    beep(660, 0.09, "triangle", 0.22);
    beep(990, 0.14, "triangle", 0.2, 0.07);
  }
}

function checkPickups() {
  const me = painters[meIdx];
  if (!me) return;
  pickups.forEach((pk, i) => {
    if (pk.taken || simT < pk.t) return;
    if (Math.hypot((pk.c + 0.5) * CELL - me.x, (pk.r + 0.5) * CELL - me.y) < CELL * 0.9) {
      claimPickup(pk, meIdx, true);
      if (MP && mode === "mp") netOut("pick", { i });
    }
  });
}

// ---- round end ----

function localScores() {
  return painters
    .map((p) => ({ idx: p.idx, name: p.name, n: counts[p.idx + 1], you: p.you, gone: !p.alive }))
    .sort((a, b) => b.n - a.n);
}

function finish(scores) {
  phase = "over";
  overFrame = frameCount;
  overScores = scores;
  const win = scores && scores[0];
  const iWin = !!(win && win.you && (scores.length < 2 || win.n > scores[1].n));
  fanfare(iWin || mode === "solo" && newBest);
  if (iWin) celebrate(2);
}

function endOfClock() {
  if (mode !== "mp" || !MP || !MP.connected) { finishSolo(); return; }
  if (MP.isHost) {
    const scores = localScores();
    MP.send("over", { scores: scores.map((s) => ({ id: painters[s.idx].id, n: s.n })) });
    finish(scores);
  }
  // guests wait for the host's "over"; a grace timer covers a lost host below
}

function finishSolo() {
  const pctv = pct();
  newBest = pctv > best;
  if (newBest) { best = pctv; saveState(); celebrate(1); }
  overScores = null;
  finish(null);
}

function pct() { return Math.round((100 * counts[1]) / Math.max(1, freeCells)); }

// ---- stage layout ----
// Fixed virtual stage (landscape 980×668 or portrait 616×976), scaled to fit below the top bar.

function layout() {
  let uiH = 56;
  const ui = document.getElementById("ui-overlay");
  if (ui) uiH = ui.offsetHeight;
  else if (HUB()) {
    const bar = document.querySelector(".hub-bar");
    if (bar) uiH = bar.offsetHeight + 2;
  }
  const availH = Math.max(160, height - uiH - 6);
  const portrait = width / availH < 1.05;
  const pfW = (portrait ? 21 : 34) * CELL, pfH = (portrait ? 30 : 19) * CELL;
  const VW = pfW + 2 * PAD, VH = HUD_H + PAD + pfH + 10 + SCORE_H + 12;
  const S = Math.min(width / VW, availH / VH);
  L = {
    portrait, S,
    ox: (width - VW * S) / 2,
    oy: uiH + 6 + (availH - VH * S) / 2,
    VW, VH,
    field: { x: PAD, y: HUD_H + PAD, w: pfW, h: pfH },
  };
  if (grid && builtPortrait !== null && builtPortrait !== portrait) buildArena(seed);  // fresh sheet, same seed
  else if (grid && paintCv && Math.round(L.field.w * PX) !== paintCv.width) rebuildPaintLayer();
}

function toScreen(x, y) { return { x: L.ox + (L.field.x + x) * L.S, y: L.oy + (L.field.y + y) * L.S }; }

// ---- paper & board drawing ----

let paperPattern = null;

function makePaperTile() {
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const x = c.getContext("2d");
  const rnd = mulberry32(42);
  for (let k = 0; k < 240; k++) {
    x.fillStyle = `rgba(120, 96, 60, ${0.03 + rnd() * 0.06})`;
    x.beginPath();
    x.ellipse(rnd() * 160, rnd() * 160, 0.5 + rnd() * 1.1, 0.4 + rnd() * 0.8, rnd() * 3, 0, 6.3);
    x.fill();
  }
  for (let k = 0; k < 26; k++) {           // paper fibres
    x.strokeStyle = `rgba(160, 130, 88, ${0.05 + rnd() * 0.05})`;
    x.lineWidth = 1;
    const px = rnd() * 160, py = rnd() * 160, a = rnd() * 6.28, l = 4 + rnd() * 10;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}

function drawPaper() {
  background(...PAPER);                 // warm paper base (the pattern on top is only grain)
  const ctx = drawingContext;
  if (!paperPattern) paperPattern = ctx.createPattern(makePaperTile(), "repeat");
  ctx.save();
  ctx.fillStyle = paperPattern;
  ctx.fillRect(0, 0, width, height);
  const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(92, 62, 24, 0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawBoard() {
  const f = L.field;
  // the sheet itself: slightly lighter, hand-cut
  noStroke();
  fill(...PAPER_HI, 150);
  rect(f.x - 6, f.y - 6, f.w + 12, f.h + 12, 12);
  // faint pencil grid
  const ctx = drawingContext;
  ctx.save();
  ctx.setLineDash([3, 6]);
  stroke(...LINE, 150);
  strokeWeight(1);
  for (let c = 1; c < COLS; c++) line(f.x + c * CELL, f.y, f.x + c * CELL, f.y + f.h);
  for (let r = 1; r < ROWS; r++) line(f.x, f.y + r * CELL, f.x + f.w, f.y + r * CELL);
  ctx.setLineDash([]);
  ctx.restore();
  // paint, then stains on top so rings stay crisp (raw drawImage: p5.image() rejects bare canvases)
  if (paintCtx) ctx.drawImage(paintCv, f.x, f.y, f.w, f.h);
  for (const s of stains) drawStain(s);
  // wobbly ink border
  if (borderPts.length) {
    noFill();
    stroke(...INK, 230);
    strokeWeight(3.5);
    strokeJoin(ROUND);
    beginShape();
    for (const pt of borderPts) vertex(f.x + pt.x, f.y + pt.y);
    endShape(CLOSE);
  }
}

function blobShape(rad, n, ph, wob) {
  beginShape();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = rad * (1 + wob * Math.sin(a * 3 + ph[k % ph.length]));
    vertex(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  endShape(CLOSE);
}

function drawStain(s) {
  push();
  translate(L.field.x + s.x, L.field.y + s.y);
  noStroke();
  fill(150, 104, 58, 42);
  blobShape(s.r * 0.92, 12, s.ph, 0.1);
  noFill();
  stroke(122, 80, 42, 120);
  strokeWeight(3);
  blobShape(s.r, 12, s.ph, 0.12);
  noStroke();
  for (const [dx, dy, dr] of s.drops) {
    fill(140, 96, 54, 80);
    circle(dx, dy, dr * 2);
  }
  pop();
}

function starPath(rad) {
  beginShape();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? rad * 0.45 : rad;
    vertex(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  endShape(CLOSE);
}

function drawPickup(pk) {
  const k = Math.min(1, (simT - pk.t) / 0.25);
  const s = 1 + 0.1 * Math.sin(millis() * 0.006);
  push();
  translate(L.field.x + (pk.c + 0.5) * CELL, L.field.y + (pk.r + 0.5) * CELL);
  scale((0.4 + 0.6 * k) * s);
  rotate(0.15 * Math.sin(millis() * 0.003));
  noStroke();
  fill(...STAR_C, 60);
  starPath(20);
  fill(...STAR_C);
  stroke(...STAR_D);
  strokeWeight(2);
  starPath(11);
  noStroke();
  fill(255, 250, 220, 220);
  circle(-3, -4, 3.5);
  pop();
}

function drawCrown(x, y, s) {
  push();
  translate(x, y);
  scale(s);
  rotate(-0.12);
  noStroke();
  fill(...STAR_C);
  stroke(...STAR_D);
  strokeWeight(1.2);
  beginShape();
  vertex(-7, 4); vertex(-7, -4); vertex(-3, -0.5); vertex(0, -6); vertex(3, -0.5); vertex(7, -4); vertex(7, 4);
  endShape(CLOSE);
  pop();
}

function drawPainter(p) {
  const f = L.field;
  const C = CRAYONS[p.idx % 4];
  push();
  translate(f.x + p.x, f.y + p.y);
  if (!p.alive) return pop() || undefined;
  // shadow
  noStroke();
  fill(60, 42, 20, 38);
  ellipse(0, 17, 24, 8);
  const moving = Math.hypot(p.vx, p.vy) > 12;
  const tilt = constrain(p.vx * 0.0022, -0.3, 0.3) + (moving ? Math.sin(millis() * 0.02) * 0.03 : 0);
  rotate(tilt);
  if (moving) translate(0, Math.sin(millis() * 0.02) * -1.2);
  // boost aura: golden ring + sparkles
  if (p.boostUntil > simT) {
    const left = Math.max(0, (p.boostUntil - simT) / BOOST_T);
    noFill();
    stroke(...STAR_C, 220);
    strokeWeight(3);
    arc(0, 2, 42, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    noStroke();
    for (let k = 0; k < 3; k++) {
      const a = millis() * 0.005 + (k * Math.PI * 2) / 3;
      fill(...STAR_C, 200);
      push();
      translate(Math.cos(a) * 22, Math.sin(a) * 16 - 4);
      rotate(a);
      starPath(3.4);
      pop();
    }
  }
  // body: a chunky crayon, tip down
  stroke(...C.dark);
  strokeWeight(2);
  fill(...C.base);
  rect(-8, -21, 16, 34, 5, 5, 2, 2);
  noStroke();
  fill(...C.base);
  triangle(-8, 13, 8, 13, 0, 24);
  fill(240, 226, 196);
  rect(-8, 9, 16, 5);
  fill(...C.light);
  rect(-8, -7, 16, 9, 2);
  // face
  const look = constrain(p.vx * 0.012, -1.6, 1.6);
  fill(255, 252, 246);
  circle(-3.2, -15, 5.4);
  circle(3.2, -15, 5.4);
  fill(48, 34, 22);
  circle(-3.2 + look, -15, 2.6);
  circle(3.2 + look, -15, 2.6);
  noFill();
  stroke(48, 34, 22, 200);
  strokeWeight(1.4);
  arc(0, -10, 7, 6, 0.3, Math.PI - 0.3);
  pop();
  // name tag
  if (mode === "mp") {
    const label = p.you ? p.name + " (du)" : p.name;
    textFont(KR_FONT);
    textStyle(BOLD);
    textSize(11);
    const tw = textWidth(label) + 14;
    noStroke();
    fill(252, 246, 232, 225);
    stroke(...INK, 90);
    strokeWeight(1.2);
    rect(f.x + p.x - tw / 2, f.y + p.y - 46, tw, 17, 8);
    noStroke();
    fill(...INK);
    textAlign(CENTER, CENTER);
    text(label, f.x + p.x, f.y + p.y - 37);
  }
}

function drawScoreRow() {
  const f = L.field;
  const y0 = f.y + f.h + 10;
  const ps = painters.filter((p) => p.alive || mode === "mp");
  textFont(KR_FONT);
  // measure: drop names when the row would overflow the sheet
  textStyle(BOLD);
  textSize(16);
  const numW = ps.map((p) => textWidth(String(counts[p.idx + 1])));
  textStyle(NORMAL);
  textSize(12);
  const nameW = ps.map((p) => textWidth(p.you ? "Du" : p.name));
  const itemW = (i) => 24 + 6 + (nameW[i] ?? 0) + 8 + (numW[i] ?? 0);
  const withNames = ps.map((_, i) => itemW(i)).reduce((a, b) => a + b, 0) + (ps.length - 1) * 30;
  const showNames = withNames <= f.w;
  const widths = showNames ? ps.map((_, i) => itemW(i)) : ps.map((_, i) => 24 + 6 + numW[i]);
  const gap = 30;
  const total = widths.reduce((a, b) => a + b, 0) + (ps.length - 1) * gap;
  let x = f.x + (f.w - total) / 2;
  const lead = leaderIdx();
  ps.forEach((p, i) => {
    const w = widths[i], cx = x + w / 2;
    const a = p.alive ? 255 : 120;
    // mini crayon
    push();
    translate(x + 11, y0 + 22);
    rotate(-0.35);
    noStroke();
    fill(...CRAYONS[p.idx % 4].base, a);
    rect(-4.5, -10, 9, 17, 2.5, 2.5, 1, 1);
    triangle(-4.5, 7, 4.5, 7, 0, 12);
    pop();
    let tx = x + 24;
    textAlign(LEFT, CENTER);
    if (showNames) {
      fill(...INK, a * 0.75);
      textStyle(NORMAL);
      textSize(12);
      text(p.you ? "Du" : p.name, tx, y0 + 22);
      tx += nameW[i] + 8;
    }
    fill(...INK, a);
    textStyle(BOLD);
    textSize(16);
    text(String(counts[p.idx + 1]), tx, y0 + 21);
    if (i === lead && painters.length > 1) drawCrown(x + 11, y0 - 2, 0.9);
    x += w + gap;
  });
}

function leaderIdx() {
  let bi = -1, bn = -1;
  for (const p of painters) if (counts[p.idx + 1] > bn) { bn = counts[p.idx + 1]; bi = p.idx; }
  return bn > 0 ? bi : -1;
}

// ---- HUD & overlays ----

function fmtT(t) {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function drawHud() {
  const f = L.field;
  const left = phase === "run" ? Math.max(0, secs - simT) : phase === "countdown" ? secs : 0;
  textFont(KR_FONT);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  const hot = phase === "run" && left <= 10;
  const pulse = hot ? 1 + 0.06 * Math.sin(millis() * 0.012) : 1;
  textSize(30 * pulse);
  fill(...(hot ? [198, 60, 48] : INK));
  text(fmtT(left), f.x + f.w / 2, HUD_H * 0.46);
  // pencil time bar
  const bw = 190, bx = f.x + f.w / 2 - bw / 2, by = HUD_H - 10;
  noStroke();
  fill(...LINE, 200);
  rect(bx, by, bw, 7, 3.5);
  fill(...(hot ? [198, 60, 48] : INK), 220);
  rect(bx, by, bw * (left / secs), 7, 3.5);
  // room label
  textStyle(NORMAL);
  textSize(12);
  textAlign(LEFT, CENTER);
  fill(...INK, 150);
  const label = HUB() ? "Gemeinsames Blatt" : mode === "mp" && MP && MP.state ? "Raum " + MP.state.code : "Übungsblatt";
  text(label, f.x, HUD_H * 0.46);
  if (mode === "mp" && painters.length) {
    textAlign(RIGHT, CENTER);
    text(painters.length + " Stifte", f.x + f.w, HUD_H * 0.46);
  }
}

function drawCountdown() {
  const f = L.field;
  const n = Math.ceil(cd);
  const frac = cd - Math.floor(cd);
  push();
  translate(f.x + f.w / 2, f.y + f.h / 2);
  noStroke();
  fill(252, 246, 232, 120);
  circle(0, 0, 150);
  textFont(KR_FONT);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  if (cd > 0.5) {
    const s = 1 + 0.35 * frac * frac;
    fill(...INK);
    textSize(72 * s);
    text(String(n), 0, 4);
    textStyle(NORMAL);
    textSize(15);
    fill(...INK, 170);
    text(mode === "solo" ? "Ziehen zum Malen" : "Gleich geht's los", 0, 58);
  } else {
    fill(...CRAYONS[0].base);
    textSize(56);
    text("Los!", 0, 2);
  }
  pop();
}

// hub lobby: the game is mounted, the host hasn't broadcast the seed yet
function drawHubWait() {
  const f = L.field;
  textFont(KR_FONT);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill(...INK);
  textSize(30);
  text("Kritzel-Revier", f.x + f.w / 2, f.y + f.h / 2 - 16);
  textStyle(NORMAL);
  textSize(16);
  fill(...INK, 180);
  text("Der Host startet gleich das erste Blatt …", f.x + f.w / 2, f.y + f.h / 2 + 20);
}

// hub mode has no #note element — shell notes show on the paper instead
function drawCanvasNote() {
  if (!noteMsg || frameCount - noteAt >= 190) return;
  const a = Math.min(1, (190 - (frameCount - noteAt)) / 40);
  noStroke();
  fill(...INK, 235 * a);
  textFont(KR_FONT);
  textStyle(BOLD);
  textSize(14);
  textAlign(CENTER, CENTER);
  text(noteMsg, L.field.x + L.field.w / 2, L.field.y + L.field.h - 16);
}

function drawResult() {
  const f = L.field;
  const rows = mode === "solo" ? [] : overScores || [];
  const wC = Math.min(f.w - 30, 430);
  const hC = mode === "solo" ? 168 : 96 + rows.length * 38 + 40;
  const x = f.x + f.w / 2 - wC / 2, y = f.y + f.h / 2 - hC / 2;
  push();
  translate(f.x + f.w / 2, f.y + f.h / 2);
  rotate(-0.006);
  translate(-(f.x + f.w / 2), -(f.y + f.h / 2));
  // drop shadow + card
  noStroke();
  fill(60, 42, 20, 60);
  rect(x + 5, y + 8, wC, hC, 16);
  fill(252, 246, 232);
  stroke(...INK);
  strokeWeight(2.5);
  rect(x, y, wC, hC, 16);
  // tape strips
  push();
  translate(x + 34, y);
  rotate(-0.35);
  fill(250, 240, 180, 150);
  rect(-22, -9, 44, 18, 2);
  pop();
  push();
  translate(x + wC - 34, y);
  rotate(0.35);
  fill(250, 240, 180, 150);
  rect(-22, -9, 44, 18, 2);
  pop();

  textFont(KR_FONT);
  textAlign(CENTER, CENTER);
  if (mode === "solo") {
    fill(...INK);
    textStyle(BOLD);
    textSize(46);
    text(pct() + " %", x + wC / 2, y + 56);
    textStyle(NORMAL);
    textSize(15);
    fill(...INK, 200);
    text("des Papiers sind deine", x + wC / 2, y + 94);
    if (newBest) {
      fill(...STAR_D);
      textStyle(BOLD);
      textSize(17);
      text("★ Neuer Rekord!", x + wC / 2, y + 124);
    } else {
      fill(...INK, 150);
      textStyle(NORMAL);
      textSize(14);
      text("Rekord: " + best + " %  ·  „Nochmal“ für eine neue Runde", x + wC / 2, y + 124);
    }
  } else {
    const win = rows[0];
    const tie = rows.length > 1 && rows[1].n === win.n;
    fill(...(tie ? INK : CRAYONS[win.idx % 4].dark));
    textStyle(BOLD);
    textSize(26);
    text(tie ? "Unentschieden!" : (win.you ? "Du gewinnst!" : win.name + " gewinnt!"), x + wC / 2, y + 34);
    const maxN = Math.max(1, win.n);
    rows.forEach((r, i) => {
      const ry = y + 66 + i * 38;
      const a = r.gone ? 120 : 255;
      textAlign(LEFT, CENTER);
      textStyle(BOLD);
      textSize(15);
      fill(...INK, a);
      text(String(i + 1) + ".", x + 26, ry);
      noStroke();
      fill(...CRAYONS[r.idx % 4].base, a);
      rect(x + 52, ry - 9, 18, 18, 4);
      textAlign(LEFT, CENTER);
      fill(...INK, a);
      textSize(14);
      text(r.name + (r.you ? " (du)" : "") + (r.gone ? " · gegangen" : ""), x + 80, ry);
      // count bar
      const barW = Math.max(10, (wC - 240) * (r.n / maxN));
      fill(...CRAYONS[r.idx % 4].base, 90 + a * 0.4);
      rect(x + 190, ry - 5, barW, 10, 5);
      textAlign(RIGHT, CENTER);
      textStyle(BOLD);
      textSize(15);
      fill(...INK, a);
      text(String(r.n), x + wC - 22, ry);
    });
    textAlign(CENTER, CENTER);
    textStyle(NORMAL);
    textSize(13);
    fill(...INK, 160);
    const host = MP && MP.connected && MP.isHost;
    const note = !host ? "Der Host kann eine neue Runde starten." : HUB() ? "Neues Blatt: der Host drückt „N“." : "„Nochmal“ startet eine neue Runde.";
    text(note, x + wC / 2, y + hC - 20);
  }
  pop();
}

// ---- status line ----

function updateStatus() {
  if (phase === "lobby") { setStatus("Warte auf den Start durch den Host …", null); return; }
  if (phase === "countdown") { setStatus(mode === "mp" ? "Mach dich bereit …" : "Bereit …", null); return; }
  if (phase === "run") {
    const left = fmtT(secs - simT);
    if (mode === "solo") setStatus("Noch " + left + " · " + pct() + " % bemalt", null);
    else {
      const li = leaderIdx();
      const who = li < 0 ? "gleichauf" : painters[li].you ? "Du führst!" : painters[li].name + " führt";
      setStatus("Noch " + left + " · " + who, null);
    }
    return;
  }
  if (mode === "solo") {
    setStatus("Fertig! " + pct() + " % des Papiers sind deine." + (newBest ? " Neuer Rekord!" : ""), "solved");
  } else if (overScores && overScores.length) {
    const win = overScores[0];
    const tie = overScores.length > 1 && overScores[1].n === win.n;
    const iWin = !tie && win.you;
    setStatus(tie ? "Unentschieden!" : win.name + " gewinnt mit " + win.n + " Feldern!", iWin ? "solved" : null);
  }
}

// ---- p5 lifecycle ----

// canvas box: the whole window on the game page, the hub stage inside the hub
function stageSize() {
  const r = HUB() && window.__KR_ROOT__ ? window.__KR_ROOT__ : null;
  const w = r ? (r.clientWidth || windowWidth) : windowWidth;
  const h = r ? (r.clientHeight || windowHeight) : windowHeight;
  return [Math.max(320, w), Math.max(240, h)];
}

function setup() {
  const [w, h] = stageSize();
  const cnv = createCanvas(w, h);
  cnv.parent(HUB() ? window.__KR_ROOT__ : "canvas-wrap");
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  // touches belong to the crayon: no scrolling/zooming over the canvas, on the page and in the hub
  cnv.elt.style.touchAction = "none";
  const wrap = document.getElementById("canvas-wrap");
  if (wrap) wrap.style.touchAction = "none";
  loadState();
  updateSoundLabel();
  layout();
  if (!HUB()) {
    newPractice();
    syncPresetLabel();
  } else {
    phase = "lobby";
  }
}

function windowResized() {
  const [w, h] = stageSize();
  resizeCanvas(w, h);
}

function draw() {
  const dt = Math.min(0.05, (deltaTime || 16.7) / 1000);
  layout();
  drawPaper();

  // hub rescue: if the host vanished before broadcasting the round seed, the new host steps in
  if (phase === "lobby" && HUB() && MP.isHost && performance.now() - lobbyAt > 12000) {
    lobbyAt = performance.now();
    const s = (Math.random() * 1e9) | 0;
    MP.send("seed", { seed: s, secs });
    beginWith(s);
  }

  // clock
  if (phase === "countdown") {
    cd -= dt;
    const n = Math.ceil(cd);
    if (n !== cdShown) { cdShown = n; if (n > 0 && n < 99) beep(520, 0.06, "square", 0.12); }
    if (cd <= 0) { phase = "run"; simT = 0; beep(780, 0.2, "square", 0.18); }
  } else if (phase === "run") {
    simT += dt;
    if (simT >= secs) endOfClock();
    // guest fallback if the host vanished right at the end
    if (mode === "mp" && MP && MP.connected && !MP.isHost && simT > secs + 2.5) finish(localScores());
  }

  // simulation
  if (grid) {
    for (const p of painters) {
      if (!p.alive) continue;
      if (p.you) stepLocal(p, dt);
      else stepRemote(p, dt);
    }
    if (phase === "run") {
      for (const p of painters) paintAround(p);
      checkPickups();
      // stream my position
      const me = painters[meIdx];
      if (me && me.alive && mode === "mp" && MP && millis() - lastPosSend > POS_MS) {
        lastPosSend = millis();
        netOut("pos", { x: Math.round(me.x), y: Math.round(me.y) });
      }
    }
    // host on the game page: hand the room back to the lobby once the result has been seen.
    // In the hub the sketch stays up — the host keeps the result on screen and can start a new
    // sheet with "Nochmal" (N), which broadcasts a fresh seed without leaving the game.
    if (phase === "over" && mode === "mp" && !HUB() && MP && MP.connected && MP.isHost && !mpEnded && frameCount - overFrame > 90) {
      mpEnded = true;
      MP.endGame();
    }
  }

  // board
  push();
  translate(L.ox, L.oy);
  scale(L.S);
  drawBoard();
  for (const pk of pickups) if (!pk.taken && simT >= pk.t) drawPickup(pk);
  for (const p of painters) drawPainter(p);
  drawScoreRow();
  drawHud();
  if (phase === "lobby") drawHubWait();
  if (phase === "countdown") drawCountdown();
  if (phase === "over") drawResult();
  drawCanvasNote();
  pop();

  // boost sparkles on my crayon (screen space)
  const me = painters[meIdx];
  if (me && me.alive && me.boostUntil > simT && phase === "run" && frameCount % 6 === 0) {
    const s = toScreen(me.x, me.y - 14);
    addParticle({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 1.4, vy: -0.6 - Math.random(), life: 60, size: 4, col: STAR_C, decay: 3 });
  }

  drawParticles();
  updateStatus();
}

// ---- input ----

function pointerPos() {
  return { x: (mouseX - L.ox) / L.S - L.field.x, y: (mouseY - L.oy) / L.S - L.field.y };
}

function mousePressed(e) {
  // only presses on the canvas itself, not on the top bar's buttons
  if (!e || !e.target || e.target.tagName !== "CANVAS" || !grid) return;
  ensureAudio();
  pressing = true;
  const me = painters[meIdx];
  if (me && me.alive && phase === "run") me.target = pointerPos();
  return false;
}

function mouseDragged() {
  if (!pressing) return;
  const me = painters[meIdx];
  if (me && me.alive && phase === "run") me.target = pointerPos();
}

function mouseReleased() {
  pressing = false;
  const me = painters[meIdx];
  if (me) me.target = null;
}

// touch: p5 does not reliably map touches onto the mouse handlers (on phones the crayon would
// never move), so the touch path is handled explicitly
function touchPos(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t || !L) return null;
  return { x: (t.clientX - L.ox) / L.S - L.field.x, y: (t.clientY - L.oy) / L.S - L.field.y };
}

function touchStarted(e) {
  if (!e || !e.target || e.target.tagName !== "CANVAS" || !grid) return;
  ensureAudio();
  pressing = true;
  const me = painters[meIdx];
  const p = touchPos(e);
  if (me && me.alive && phase === "run" && p) me.target = p;
  return false;                     // no scrolling/zooming over the sheet
}

function touchMoved(e) {
  if (!pressing) return;
  const me = painters[meIdx];
  const p = touchPos(e);
  if (me && me.alive && phase === "run" && p) me.target = p;
  return false;
}

function touchEnded() {
  pressing = false;
  const me = painters[meIdx];
  if (me) me.target = null;
}

function keyPressed() {
  // ignore typing into the overlay's dropdown
  if (document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return;
  ensureAudio();
  const k = (key || "").toLowerCase();
  if (k === "m") { toggleSound(); return false; }
  if (k === "n" || ((keyCode === ENTER || keyCode === 32) && phase === "over")) { again(); return false; }
  if ([32, ENTER, LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) return false;
}

// ---- info modal animation ----
// A looping mini duel on the 440×280 canvas: the red crayon scribbles a path, teal races
// alongside, a glitter star appears and teal grabs it for a speed burst, the clock runs
// down and "Rot gewinnt!" stamps the end.

function infoAnim(p, w, h, frame) {
  const LOOP = 300;
  const t = frame % LOOP;
  const CS = 20, GC = 16, GR = 8;
  const x0 = (w - GC * CS) / 2, y0 = 84;
  const RED = CRAYONS[0], TEAL = CRAYONS[1];

  p.background(246, 235, 210);
  p.noStroke();
  for (let k = 0; k < 50; k++) { p.fill(120, 96, 60, 12); p.circle((k * 97) % w, (k * 53) % h, 2); }

  // sheet + grid
  p.fill(252, 245, 228, 150);
  p.rect(x0 - 6, y0 - 6, GC * CS + 12, GR * CS + 12, 10);
  p.stroke(214, 197, 160, 150);
  p.strokeWeight(1);
  for (let i = 0; i <= GC; i++) p.line(x0 + i * CS, y0, x0 + i * CS, y0 + GR * CS);
  for (let j = 0; j <= GR; j++) p.line(x0, y0 + j * CS, x0 + GC * CS, y0 + j * CS);
  p.noStroke();

  const cellFill = (c, r, C) => {
    p.push();
    p.translate(x0 + (c + 0.5) * CS, y0 + (r + 0.5) * CS);
    p.rotate((((c * 7 + r * 13) % 9) - 4) * 0.012);
    p.noStroke();
    p.fill(...C.base, 225);
    p.rect(-CS / 2 + 1, -CS / 2 + 1, CS - 2, CS - 2, 4);
    p.pop();
  };
  const miniCrayon = (c, r, C, wob) => {
    const x = x0 + (c + 0.5) * CS, y = y0 + (r + 0.5) * CS + Math.sin(frame * 0.3) * wob;
    p.push();
    p.translate(x, y);
    p.rotate(Math.sin(frame * 0.06) * 0.1);
    p.noStroke();
    p.fill(60, 42, 20, 40);
    p.ellipse(0, 12, 18, 5);
    p.stroke(...C.dark);
    p.strokeWeight(1.6);
    p.fill(...C.base);
    p.rect(-6, -16, 12, 26, 4, 4, 1.5, 1.5);
    p.noStroke();
    p.triangle(-6, 10, 6, 10, 0, 18);
    p.fill(...C.light);
    p.rect(-6, -6, 12, 7, 2);
    p.fill(255);
    p.circle(-2.4, -12, 4.4);
    p.circle(2.4, -12, 4.4);
    p.fill(48, 34, 22);
    p.circle(-2.4, -12, 2.2);
    p.circle(2.4, -12, 2.2);
    p.pop();
  };

  const redPath = [[1, 1], [2, 1], [2, 2], [3, 2], [4, 2], [4, 3], [5, 3], [6, 3], [6, 2], [7, 2], [8, 2], [8, 3], [9, 3], [10, 3], [10, 2], [11, 2]];
  const tealPath = [[13, 5], [12, 5], [11, 5], [10, 5], [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [5, 6], [4, 6], [3, 6]];
  const redN = Math.min(redPath.length, Math.floor(t / 12));
  const tealN = t > 40 ? Math.min(tealPath.length, Math.floor((t - 40) / 12)) : 0;
  for (let k = 0; k < redN; k++) cellFill(redPath[k][0], redPath[k][1], RED);
  for (let k = 0; k < tealN; k++) cellFill(tealPath[k][0], tealPath[k][1], TEAL);

  // glitter star, teal grabs it at t≈205
  const starC = [7, 0];
  if (t > 150 && t < 205) {
    p.push();
    p.translate(x0 + (starC[0] + 0.5) * CS, y0 + (starC[1] + 0.5) * CS);
    p.rotate(0.2 * Math.sin(frame * 0.1));
    p.fill(...STAR_C, 70);
    starPathSmall(p, 16);
    p.fill(...STAR_C);
    p.stroke(...STAR_D);
    p.strokeWeight(1.6);
    starPathSmall(p, 9);
    p.pop();
  } else if (t >= 205 && t < 215) {
    const k = (t - 205) / 10;
    p.noFill();
    p.stroke(...STAR_C, 230 * (1 - k));
    p.strokeWeight(3);
    p.circle(x0 + (starC[0] + 0.5) * CS, y0 + (starC[1] + 0.5) * CS, 14 + k * 26);
  }
  const tealBoost = t >= 205 && t < 240;
  if (tealN && tealN < tealPath.length) miniCrayon(tealPath[tealN][0], tealPath[tealN][1], TEAL, tealBoost ? 2 : 0.8);
  if (redN && redN < redPath.length) miniCrayon(redPath[redN][0], redPath[redN][1], RED, 0.8);

  // clock
  const left = Math.max(0, 10 - t / 30);
  p.fill(...INK);
  p.textFont(KR_FONT);
  p.textStyle(p.BOLD);
  p.textAlign(p.CENTER, p.TOP);
  p.textSize(20);
  p.text("0:" + String(Math.ceil(left)).padStart(2, "0"), w / 2, 22);
  p.noStroke();
  p.fill(...LINE, 220);
  p.rect(w / 2 - 70, 50, 140, 5, 2.5);
  p.fill(...(left <= 3 ? [198, 60, 48] : INK), 220);
  p.rect(w / 2 - 70, 50, 140 * (left / 10), 5, 2.5);

  if (t > 255) {
    const k = Math.min(1, (t - 255) / 12);
    p.push();
    p.translate(w / 2, h / 2 + 6);
    p.rotate(-0.08);
    p.scale(0.6 + 0.4 * k);
    p.noStroke();
    p.fill(60, 42, 20, 60);
    p.rect(-96 + 4, -22 + 6, 192, 44, 10);
    p.fill(252, 246, 232);
    p.stroke(...INK);
    p.strokeWeight(2);
    p.rect(-96, -22, 192, 44, 10);
    p.noStroke();
    p.fill(...RED.dark);
    p.textStyle(p.BOLD);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(22);
    p.text("Rot gewinnt!", 0, 1);
    p.pop();
  }
}

function starPathSmall(p, rad) {
  p.beginShape();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? rad * 0.45 : rad;
    p.vertex(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  p.endShape(p.CLOSE);
}

// ---- hub integration (driven by hub-games/kritzel.js) ----
// The game script runs in p5 global mode, so the hub module loads it once, points it at the hub
// stage and the room, and starts/stops the one global sketch per game run. The host broadcasts
// the round seed at go() ("seed" message); everybody builds the very same sheet from it.

window.__kritzelHubInit = function () {
  MP = window.__KR_NET__ || window.Multiplayer;
  wireNet();
  mode = "mp";
  const list = window.__KR_PLAYERS__ || [];
  painters = list.map((p, i) => makePainter(i, p.id, p.name || "Spieler", p.you));
  meIdx = Math.max(0, painters.findIndex((p) => p.you));
  phase = "lobby";
  lobbyAt = performance.now();
  overScores = null;
  loadState();
  clearParticles();
  window.__KR_P5__ = new p5();           // global-mode sketch: picks up setup()/draw() above
};

window.__kritzelHubGo = function () {
  if (!HUB()) return;
  if (MP.isHost) {
    const s = (Math.random() * 1e9) | 0;
    MP.send("seed", { seed: s, secs });
    beginWith(s);
  }
  // guests begin when the host's "seed" message arrives (see wireNet)
};

window.__kritzelHubDestroy = function () {
  if (window.__KR_P5__) { try { window.__KR_P5__.remove(); } catch (e) { /* already gone */ } window.__KR_P5__ = null; }
  window.__KR_NET__ = null;
  window.__KR_ROOT__ = null;
  window.__KR_PLAYERS__ = null;
  MP = window.Multiplayer;
  painters = [];
  grid = null;
  paintCv = null;
  clearParticles();
  phase = "countdown";
};
