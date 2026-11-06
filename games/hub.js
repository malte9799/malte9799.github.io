// Multiplayer hub shell — one page, one room, many games.
//
// The shell owns the page and the room (window.Multiplayer, see multiplayer.js). A game is an ES module
// in hub-games/ that is loaded with import() when the host starts it and thrown away when the host
// ends it, so the WebRTC connection never drops while the room switches games.
//
//   export default {
//     min: 2, max: 4,                      // players it needs / allows
//     mount(ctx) { …build UI into ctx.root…; return { go() {…}, destroy() {…} }; },
//   }
//
// ctx: root, players, me, options, isHost (live), send(type, data, toId?), onMessage(type, fn),
//      onEvent("leave" | "host" | "join" | "players", fn), addCleanup(fn), end() (host: back to lobby).
// go() is called on every client at the same moment, after all clients have mounted. See README.md.

const MP_GAMES = [
  { id: "tictactoe", title: "Tic Tac Toe", desc: "Normal oder Super – zu zweit am Brett, der Rest schaut zu und rotiert", min: 2, max: 6, preview: (p, w, h) => drawTicTacToe(p, w, h), load: () => import("./hub-games/tictactoe.js") },
  { id: "kniffel", title: "Kniffel", desc: "Würfeln, halten, aufschreiben – Kniffel, Yahtzee, Yatzy, Generala", min: 2, max: 6, preview: (p, w, h) => drawKniffel(p, w, h), load: () => import("./hub-games/kniffel.js") },
  { id: "maexchen", title: "Mäxchen", desc: "Lügenwürfel: höher ankündigen oder bezweifeln? Bluff-Duell am Filztisch", min: 2, max: 6, preview: (p, w, h) => drawMaexchen(p, w, h), load: () => import("./hub-games/maexchen.js") },
  { id: "maumau", title: "Mau-Mau", desc: "UNO-Regeln: Farbe bekennen, +2, Aussetzen – und rechtzeitig UNO! rufen", min: 2, max: 6, preview: (p, w, h) => drawMaumau(p, w, h), load: () => import("./hub-games/maumau.js") },
  { id: "clickrace", title: "Klick-Rennen", desc: "15 Sekunden, wer klickt mehr?", min: 2, max: 6, preview: (p, w, h) => drawClickRace(p, w, h), load: () => import("./hub-games/clickrace.js") },
  { id: "kritzel", title: "Kritzel-Revier", desc: "Echtzeit: kritzle das größte Revier – Flecken blockieren, Sterne geben Turbo", min: 2, max: 4, preview: (p, w, h) => drawKritzel(p, w, h), load: () => import("./hub-games/kritzel.js") },
];
window.MP_GAMES = MP_GAMES;                        // multiplayer.js reads the game titles from here

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MP = window.Multiplayer;
const def = (id) => MP_GAMES.find((g) => g.id === id);
const READY_TIMEOUT = 10000;

// every game run gets an id; messages are namespaced with it so a late message of the last game can't reach the next one
const startOpts = () => ({ run: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
MP.configure({ gameParam: false, lobbyStart: false, startOptions: startOpts });
MP.mountDock();
mountThemePicker($("hub"));                       // the design button, top right like on the other pages

let run = null;          // the game that is running (or loading) right now; null in the lobby

// ---- views: no room → the single-player grid; in a room (or while a game runs) → only multiplayer games ----
// The global multiplayer button (MP dock) is the way into a room. An invite link (?room=CODE) opens the room view.

const params = new URLSearchParams(location.search);
let fromLink = !!params.get("room");              // opened through an invite link: no "open a new room" card until you are in a room
const inRoom = () => { const s = MP.state; return !!s && s.status !== "connecting"; };

// ---- Einzelspieler: the card grid of the old start page (home.js) ----

let soloBuilt = false;
function ensureSolo() {
  if (soloBuilt || typeof buildHome !== "function") return;
  soloBuilt = true;
  buildHome($("grid"));
}

// ---- Mehrspieler: game cards with p5 previews, built once; renderLobby only toggles their state ----

const players = (x) => (x.min === x.max ? x.min : x.min + "–" + x.max) + " Spieler";
let mpSketches = [];
let mpBuilt = false;

function buildMpCards() {
  const grid = $("hub-grid");
  mpSketches.forEach((sk) => sk.remove());
  mpSketches = [];
  grid.innerHTML = "";
  MP_GAMES.forEach((game, idx) => {
    const c = document.createElement("div");
    c.className = "card";
    c.style.setProperty("--i", idx % 3);
    c.dataset.game = game.id;
    c.tabIndex = 0;
    c.setAttribute("role", "button");
    c.innerHTML = `<div class="preview"></div>
      <div class="card-text">
        <div class="card-title">${esc(game.title)}</div>
        <div class="card-desc">${esc(game.desc)}</div>
        <div class="card-meta">${players(game)}</div>
      </div>`;
    grid.appendChild(c);
    designCard(c, game, idx);                     // design decoration, e.g. the y2k window bar
    mpSketches.push(new p5(function (p) {
      p.setup = function () {
        p.createCanvas(600, 360).parent(c.querySelector(".preview"));
        p.noLoop();
        themeSketch(p);
        game.preview(p, 600, 360);
      };
    }));
  });
  mpBuilt = true;
  syncCards();
}

function syncCards() {
  const s = MP.state, room = inRoom();
  for (const c of $("hub-grid").children) {
    const sel = room && s.game === c.dataset.game;
    c.classList.toggle("sel", sel);
    c.setAttribute("aria-pressed", sel ? "true" : "false");
    c.setAttribute("aria-disabled", room && !s.isHost ? "true" : "false");   // guests only watch the host choose
  }
}

// previews are drawn once, so wait for the canvas font and redraw them whenever the design changes
themeFontReady().then(buildMpCards);
window.addEventListener("themechange", () => themeFontReady().then(buildMpCards));

function renderLobby() {
  const s = MP.state, room = inRoom();
  if (room) fromLink = false;
  const showMulti = !!run || room || fromLink;    // in a room (or invited by link): multiplayer games only
  const showSolo = !showMulti;                    // outside a room: single-player games

  $("hub-lobby").hidden = !showMulti;
  $("hub-solo").hidden = !showSolo;
  if (showSolo) ensureSolo();

  const top = $("hub-top"), act = $("hub-act");
  if (!showMulti) return;
  if (!room) {
    act.innerHTML = "";
    top.innerHTML = fromLink ? "" : `<div class="hub-card hub-welcome"><h2>Spielt gemeinsam</h2>
      <p>Raum erstellen, Code oder Link an Freunde schicken, ein Spiel wählen – und zwischen den Spielen wechseln, ohne dass der Raum auseinanderfällt. Kein Konto, direkte Verbindung.</p>
      <button class="primary" id="hub-open">${s ? "Verbinde …" : "Raum erstellen oder beitreten"}</button></div>`;
    syncCards();
    return;
  }
  const g = s.game && def(s.game);
  const n = s.players.length;
  const why = !g ? "Wähle ein Spiel." : n < g.min ? `Warte auf Mitspieler (mind. ${g.min}).` : n > g.max ? `Zu viele Spieler für dieses Spiel (max. ${g.max}).` : "";
  top.innerHTML = `<div class="hub-card hub-roomhead"><div class="hub-head"><h2>Spiel wählen</h2><span class="hub-meta">Raum <b>${esc(s.code)}</b> · ${n} Spieler</span></div></div>`;
  act.innerHTML = s.isHost
    ? `<div class="hub-act">${why ? `<p>${esc(why)}</p>` : `<p class="hub-wait">Klick auf ein Spiel, um es zu starten.</p>`}</div>`
    : `<p class="hub-wait">Der Host wählt das Spiel${g ? ` – aktuell: <b>${esc(g.title)}</b>` : ""}.</p>`;
  syncCards();
}

function renderTools() {
  // "Zurück zur Lobby" and "Raum verlassen" live in the frame of the game itself (hub-kit.js)

  // a game is running but its page was closed: offer to bring it back
  let show = $("hub-show");
  const hidden = !!run && !run.open;
  if (hidden && !show) {
    show = document.createElement("button"); show.id = "hub-show"; show.className = "primary"; show.textContent = "Spiel anzeigen";
    show.onclick = () => showStage(true);
    $("hub-tools").prepend(show);
  } else if (!hidden && show) show.remove();
}

// ---- "Wie funktioniert’s?" modal ----

const HOW = [
  ["So geht’s", "Oben links auf „Mehrspieler“, Raum erstellen, den 5-stelligen Code (oder Link/QR-Code) teilen. Fertig."],
  ["Peer-to-Peer", "Kein Spiel-Server. Die Browser sind direkt per WebRTC verbunden, jeder mit jedem (max. 6 Spieler)."],
  ["Verbindungsaufbau", "Über öffentliche Nostr-Relays, nur einmal zum Finden. Spielzüge laufen nie darüber."],
  ["Verschlüsselung", "Die Datenkanäle sind DTLS-verschlüsselt. Mitspieler sehen deine IP-Adresse."],
  ["Raumcode", "Das einzige Geheimnis: 5 Zeichen, kein Login. Wer den Code kennt, kommt rein."],
];

function openHow() {
  if (document.getElementById("hub-how-modal")) return;
  const b = document.createElement("div");
  b.className = "info-backdrop"; b.id = "hub-how-modal";
  b.innerHTML = `<div class="info-modal hub-how" role="dialog" aria-modal="true" aria-labelledby="hub-how-t">
    <button class="info-btn hub-how-x" type="button" aria-label="Schließen">✕</button>
    <h2 class="info-title" id="hub-how-t">Technik und Sicherheit</h2>
    ${HOW.map(([h, p], i) => `<section><h3><i>${i + 1}</i>${esc(h)}</h3><p class="info-text">${esc(p)}</p></section>`).join("")}</div>`;
  const close = () => { b.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  b.addEventListener("click", (e) => { if (e.target === b || e.target.closest(".hub-how-x")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(b);
  b.querySelector(".hub-how-x").focus();
}

// no room yet: picking a game opens one. Host: a click chooses the game and starts it at once
// (start() checks the player count, so a game that needs more players just stays in the lobby).
function pickCard(card) {
  if (!inRoom()) { MP.openUI(); return; }
  if (!MP.isHost) return;
  const g = def(card.dataset.game);
  if (!g) return;
  MP.setGame(g.id, { min: g.min, max: g.max });
  MP.start(startOpts());
}

document.addEventListener("click", (e) => {
  const card = e.target.closest("#hub-grid .card");
  if (card) { pickCard(card); return; }
  const t = e.target.closest("button");
  if (!t) return;
  if (t.id === "hub-how") openHow();
  else if (t.id === "hub-open") MP.openUI();
});
document.addEventListener("keydown", (e) => {
  const card = e.target.closest && e.target.closest("#hub-grid .card");
  if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickCard(card); }
});

// ---- running a game ----

// The last game state every client has seen is kept for this tab (sessionStorage), so a reload can pick the
// game up again where it was. Games that broadcast a "state" message (Tic Tac Toe, Mäxchen, Mau-Mau) are
// restored that way; games that keep their state elsewhere start over in the same room.
const STATE_KEY = "mp_game_state";
function cacheState(runId, data) { try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ run: runId, data })); } catch {} }
function cachedState(runId) {
  try { const c = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); return c && c.run === runId ? c : null; } catch { return null; }
}
function clearCachedState() { try { sessionStorage.removeItem(STATE_KEY); } catch {} }

function makeCtx(rt, players, options) {
  const clean = [];
  const key = (type) => rt.id + "/" + type;
  return {
    root: rt.root, options, players,
    get me() { return MP.me; },
    get isHost() { return MP.isHost; },
    get hostId() { return MP.state && MP.state.hostId; },
    send: (type, data, to) => { if (type === "state") cacheState(rt.id, data); return MP.send(key(type), data, to); },
    onMessage(type, fn) { const off = MP.onMessage(key(type), fn); clean.push(off); return off; },
    onEvent(ev, fn) { const off = MP.on(ev, fn); clean.push(off); return off; },
    addCleanup: (fn) => clean.push(fn),
    end: () => MP.endGame(),                       // host: the game ends for everybody, back to the lobby
    back: () => showStage(false),                  // guest: only this view closes, the game goes on
    leaveRoom: () => MP.leave(),
    room: () => MP.state,
    _cleanup() { for (const f of clean.splice(0)) { try { f(); } catch (e) { console.error(e); } } },
  };
}

async function startGame({ game, options, players, resumed }) {
  stopGame();
  const g = def(game);
  const id = options && options.run;
  const root = $("hub-stage");
  if (!g || !id) { MP.endGame(); return; }
  const rt = { id, root, ready: new Set([MP.me.id]), mounted: false, went: false, offs: [], timer: 0, ctx: null, inst: null };
  rt.offs.push(MP.onMessage(id + "/state", ({ data }) => cacheState(id, data)));   // remember what the host last showed us
  run = rt;
  root.hidden = false; root.className = "hub-stage hk-page hub-" + g.id;
  root.innerHTML = `<p class="hub-loading">Lade ${esc(g.title)} …</p>`;
  showStage(true);
  renderLobby(); renderTools();

  const key = (t) => id + "/" + t;
  const go = () => { if (run !== rt || rt.went) return; rt.went = true; clearTimeout(rt.timer); try { rt.inst && rt.inst.go && rt.inst.go(); } catch (e) { console.error(e); } };
  const maybeGo = () => {                                        // host: everybody mounted → tell everybody
    if (run !== rt || !MP.isHost || rt.went || !rt.mounted) return;
    if (MP.players.every((p) => rt.ready.has(p.id))) { MP.send(key("hub:go")); go(); }
  };
  // hub messages are registered before the module is loaded so nothing is lost while it downloads
  rt.offs.push(MP.onMessage(key("hub:ready"), ({ from }) => { rt.ready.add(from); maybeGo(); }));
  rt.offs.push(MP.onMessage(key("hub:go"), ({ from }) => { if (from === MP.state.hostId) go(); }));
  rt.offs.push(MP.on("leave", () => maybeGo()));
  rt.offs.push(MP.on("host", () => maybeGo()));

  try {
    const mod = (await g.load()).default;
    if (run !== rt) return;                                       // switched away while loading
    root.innerHTML = "";
    rt.ctx = makeCtx(rt, players, options.options ?? null);
    rt.inst = (await mod.mount(rt.ctx)) || {};
    if (run !== rt) { try { rt.inst.destroy && rt.inst.destroy(); } catch {} rt.ctx._cleanup(); return; }
    rt.mounted = true;
    if (resumed && !MP.isHost) {                                  // back after a reload: the game is already running for the others
      const c = cachedState(id);
      if (c) MP.deliver(key("state"), c.data, MP.state.hostId);
      go();
    } else if (MP.isHost) { rt.timer = setTimeout(() => { if (run === rt && !rt.went) { MP.send(key("hub:go")); go(); } }, READY_TIMEOUT); maybeGo(); }
    else MP.send(key("hub:ready"), null, MP.state.hostId);
  } catch (e) {
    console.error(e);
    if (run === rt) { root.innerHTML = `<p class="hub-loading">${esc(g.title)} konnte nicht geladen werden.</p>`; }
  }
}

function stopGame() {
  const rt = run;
  if (!rt) return;
  run = null;
  clearTimeout(rt.timer);
  for (const o of rt.offs) o();
  try { rt.inst && rt.inst.destroy && rt.inst.destroy(); } catch (e) { console.error(e); }
  if (rt.ctx) rt.ctx._cleanup();
  rt.root.innerHTML = ""; rt.root.hidden = true; rt.root.className = "";
  showStage(false);
}

// the game window: open/closed. Closing only hides it; the game keeps running until the host ends it.
function showStage(open) {
  $("hub-overlay").hidden = !open;
  document.body.classList.toggle("hub-game-open", open);
  if (run) run.open = open;
  renderTools();
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && run && run.open) showStage(false); });

MP.on("start", startGame);
MP.on("pick", () => { const el = $("hub-grid"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); });
for (const ev of ["end", "close"]) MP.on(ev, () => { stopGame(); clearCachedState(); renderLobby(); renderTools(); });
for (const ev of ["players", "game", "status", "host", "join", "error"]) MP.on(ev, () => { renderLobby(); renderTools(); });

renderLobby();
MP.openFromUrl();
