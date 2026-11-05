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

const GAMES = [
  { id: "tictactoe", title: "Tic Tac Toe", desc: "Drei in einer Reihe", min: 2, max: 2, load: () => import("./hub-games/tictactoe.js") },
  { id: "clickrace", title: "Klick-Rennen", desc: "15 Sekunden, wer klickt mehr?", min: 2, max: 6, load: () => import("./hub-games/clickrace.js") },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MP = window.Multiplayer;
const def = (id) => GAMES.find((g) => g.id === id);
const READY_TIMEOUT = 10000;

// every game run gets an id; messages are namespaced with it so a late message of the last game can't reach the next one
const startOpts = () => ({ run: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
MP.configure({ gameParam: false, startOptions: startOpts });
MP.mountDock();

let run = null;          // the game that is running (or loading) right now; null in the lobby

// ---- lobby: welcome screen and game picker ----

function renderLobby() {
  const el = $("hub-lobby");
  el.hidden = !!run;
  if (run) return;
  const s = MP.state;
  if (!s || s.status === "connecting") {
    el.innerHTML = `<div class="hub-card hub-welcome"><h2>Spielt gemeinsam</h2>
      <p>Raum erstellen, Code oder Link an Freunde schicken, ein Spiel wählen – und zwischen den Spielen wechseln, ohne dass der Raum auseinanderfällt. Kein Konto, direkte Verbindung.</p>
      <button class="primary" id="hub-open">${s ? "Verbinde …" : "Raum erstellen oder beitreten"}</button></div>`;
    return;
  }
  const g = s.game && def(s.game);
  const n = s.players.length;
  const why = !g ? "Wähle ein Spiel." : n < g.min ? `Warte auf Mitspieler (mind. ${g.min}).` : n > g.max ? `Zu viele Spieler für dieses Spiel (max. ${g.max}).` : "";
  el.innerHTML = `<div class="hub-card"><div class="hub-head"><h2>Spiel wählen</h2><span class="hub-meta">Raum <b>${esc(s.code)}</b> · ${n} Spieler</span></div>
    <div class="hub-games">${GAMES.map((x) => `<button class="hub-game${g && g.id === x.id ? " sel" : ""}" data-game="${x.id}" ${s.isHost ? "" : "disabled"}>
      <b>${esc(x.title)}</b><span>${esc(x.desc)}</span><em>${x.min === x.max ? x.min : x.min + "–" + x.max} Spieler</em></button>`).join("")}</div>
    ${s.isHost
      ? `<div class="hub-act"><button class="primary" id="hub-start" ${why ? "disabled" : ""}>Spiel starten</button>${why ? `<p>${esc(why)}</p>` : ""}</div>`
      : `<p class="hub-wait">Der Host wählt das Spiel${g ? ` – aktuell: <b>${esc(g.title)}</b>` : ""}.</p>`}</div>`;
}

function renderTools() {
  const s = MP.state;
  let b = $("hub-end");
  const need = !!s && s.isHost && s.status === "playing";
  if (need && !b) {
    b = document.createElement("button"); b.id = "hub-end"; b.textContent = "Zurück zur Lobby";
    b.onclick = () => MP.endGame();
    $("hub-tools").prepend(b);
  } else if (!need && b) b.remove();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.id === "hub-open") MP.openUI();
  else if (t.id === "hub-start") MP.start(startOpts());
  else if (t.dataset.game) { const g = def(t.dataset.game); if (g) MP.setGame(g.id, { min: g.min, max: g.max }); }
});

// ---- running a game ----

function makeCtx(rt, players, options) {
  const clean = [];
  const key = (type) => rt.id + "/" + type;
  return {
    root: rt.root, options, players,
    get me() { return MP.me; },
    get isHost() { return MP.isHost; },
    get hostId() { return MP.state && MP.state.hostId; },
    send: (type, data, to) => MP.send(key(type), data, to),
    onMessage(type, fn) { const off = MP.onMessage(key(type), fn); clean.push(off); return off; },
    onEvent(ev, fn) { const off = MP.on(ev, fn); clean.push(off); return off; },
    addCleanup: (fn) => clean.push(fn),
    end: () => MP.endGame(),
    _cleanup() { for (const f of clean.splice(0)) { try { f(); } catch (e) { console.error(e); } } },
  };
}

async function startGame({ game, options, players }) {
  stopGame();
  const g = def(game);
  const id = options && options.run;
  const root = $("hub-stage");
  if (!g || !id) { MP.endGame(); return; }
  const rt = { id, root, ready: new Set([MP.me.id]), mounted: false, went: false, offs: [], timer: 0, ctx: null, inst: null };
  run = rt;
  root.hidden = false; root.className = "hub-stage hub-" + g.id;
  root.innerHTML = `<p class="hub-loading">Lade ${esc(g.title)} …</p>`;
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
    if (MP.isHost) { rt.timer = setTimeout(() => { if (run === rt && !rt.went) { MP.send(key("hub:go")); go(); } }, READY_TIMEOUT); maybeGo(); }
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
}

MP.on("start", startGame);
for (const ev of ["end", "close"]) MP.on(ev, () => { stopGame(); renderLobby(); renderTools(); });
for (const ev of ["players", "game", "status", "host", "join", "error"]) MP.on(ev, () => { renderLobby(); renderTools(); });

renderLobby();
MP.openFromUrl();
