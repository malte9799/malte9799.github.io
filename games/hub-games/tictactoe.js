// Tic Tac Toe + Super Tic Tac Toe for the multiplayer hub.
//
// Two players sit at the board (X starts), everybody else in the room watches and rotates in:
// the winner stays, the loser goes to the back of the queue. The host picks the mode (normal / super)
// on a pre-game screen and again between rounds. The host's client owns the rules: guests send "move"
// intents, the host validates them and broadcasts the whole state. Every client keeps the latest state,
// so when the host leaves, whoever takes over simply carries on.
//
// Super mode: nine boards in one. The cell you pick inside a small board decides in which small board
// your opponent has to play. If that board is already decided (or full) they may play in any open one.
// Win three small boards in a row to win the game.

import { shell } from "../hub-kit.js";
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MODES = { normal: ["Normal", "Ein Feld, drei in einer Reihe."], super: ["Super", "Neun Felder in einem – dein Zug bestimmt, wo der Gegner spielt."] };

const lineOf = (b) => LINES.find((l) => b[l[0]] && b[l[0]] !== 3 && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) || null;
const emptyCells = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const mark = (m) => m === 1
  ? `<svg viewBox="0 0 100 100" class="mk x"><path pathLength="1" d="M24 24 76 76"/><path pathLength="1" d="M76 24 24 76"/></svg>`
  : `<svg viewBox="0 0 100 100" class="mk o"><circle pathLength="1" cx="50" cy="50" r="28"/></svg>`;

// ---- rules (pure; used by the host, and by everybody to show legal boards) ----

// which small board must be played in? null = any open one
const required = (st) => (st.mode === "super" && st.active !== null && st.cw[st.active] === 0 ? st.active : null);
function legal(st, b, i) {
  if (st.phase !== "play" || b < 0 || b > 8 || i < 0 || i > 8) return false;
  if (st.mode === "normal" && b !== 0) return false;
  if (st.cells[b][i] !== 0 || st.cw[b] !== 0) return false;
  const r = required(st);
  return r === null || r === b;
}

function place(st, b, i) {                                       // mutates st; the move must be legal
  const m = st.turn + 1;
  st.cells[b][i] = m;
  st.last = [b, i];
  const sub = st.cells[b];
  st.cw[b] = lineOf(sub) ? m : sub.every(Boolean) ? 3 : 0;
  const big = st.mode === "super" ? st.cw : st.cells[0];
  if (st.mode === "super") st.active = st.cw[i] === 0 ? i : null;
  const line = lineOf(big);
  if (line) { st.phase = "over"; st.winner = st.turn; st.line = line; }
  else if (big.every(Boolean)) { st.phase = "over"; st.winner = "draw"; }
  else st.turn = 1 - st.turn;
}

function freshBoard(st) {
  Object.assign(st, { cells: emptyCells(), cw: Array(9).fill(0), active: null, turn: 0, winner: null, line: null, last: null, forfeit: null });
}

// who sits down for the next round? winner stays, loser goes to the end of the queue
function rotate(st) {
  const here = (id) => !st.gone.includes(id);
  const w = typeof st.winner === "number" ? st.winner : 0;
  const P = [st.seats[w], st.seats[1 - w]].filter(here);
  const Q = st.queue.filter(here);
  if (!Q.length) {
    if (P.length < 2) return false;
    st.seats = [P[1], P[0]]; st.queue = [];                       // two players: swap, so the other one starts
  } else if (P.length === 2) { st.seats = [Q[0], P[0]]; st.queue = [...Q.slice(1), P[1]]; }
  else if (P.length === 1) { st.seats = [Q[0], P[0]]; st.queue = Q.slice(1); }
  else if (Q.length >= 2) { st.seats = [Q[0], Q[1]]; st.queue = Q.slice(2); }
  else return false;
  return true;
}

// a state that came over the wire is only used after it was rebuilt from scratch
function clean(d, ids) {
  if (!d || typeof d !== "object") return null;
  const id = (x) => (ids.has(x) ? x : null);
  const seats = Array.isArray(d.seats) ? d.seats.slice(0, 2).map(id) : [];
  if (seats.length !== 2 || !seats[0] || !seats[1]) return null;
  const grid = Array.isArray(d.cells) && d.cells.length === 9 && d.cells.every((r) => Array.isArray(r) && r.length === 9);
  if (!grid || !Array.isArray(d.cw) || d.cw.length !== 9) return null;
  const n = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : 0);
  const wins = {};
  if (d.wins && typeof d.wins === "object") for (const k of ids) wins[k] = n(d.wins[k], 9999);
  const pair = (a) => (Array.isArray(a) && a.length === 2 && a.every((v) => Number.isInteger(v) && v >= 0 && v < 9) ? [a[0], a[1]] : null);
  return {
    phase: ["setup", "play", "over"].includes(d.phase) ? d.phase : "setup",
    mode: d.mode === "super" ? "super" : "normal",
    seats, queue: Array.isArray(d.queue) ? d.queue.map(id).filter(Boolean) : [],
    gone: Array.isArray(d.gone) ? d.gone.map(String) : [],
    cells: d.cells.map((r) => r.map((v) => n(v, 2))), cw: d.cw.map((v) => n(v, 3)),
    active: Number.isInteger(d.active) && d.active >= 0 && d.active < 9 ? d.active : null,
    turn: d.turn === 1 ? 1 : 0,
    winner: d.winner === "draw" ? "draw" : d.winner === 0 || d.winner === 1 ? d.winner : null,
    line: Array.isArray(d.line) && d.line.length === 3 && d.line.every((v) => Number.isInteger(v) && v >= 0 && v < 9) ? d.line.slice() : null,
    last: pair(d.last), forfeit: d.forfeit === 0 || d.forfeit === 1 ? d.forfeit : null,
    wins, draws: n(d.draws, 9999), round: n(d.round, 9999),
  };
}

export default {
  min: 2, max: 6,

  mount(ctx) {
    const kit = shell(ctx, { title: "Tic Tac Toe" }), root = kit.body;
    const names = Object.fromEntries(ctx.players.map((p) => [p.id, p.name]));
    const ids = new Set(Object.keys(names));
    const order = ctx.players.map((p) => p.id);
    let st = {
      phase: "setup", mode: "normal", seats: [order[0], order[1]], queue: order.slice(2), gone: [],
      wins: Object.fromEntries(order.map((id) => [id, 0])), draws: 0, round: 0,
    };
    freshBoard(st);

    root.innerHTML = `<div class="ttt"><div class="ttt-head"><div class="ttt-seats"></div><div class="ttt-status" aria-live="polite"></div></div>
      <div class="ttt-stage"></div><div class="ttt-act"></div><div class="ttt-table"></div></div>`;
    const $ = (s) => root.querySelector(s);
    const seatsEl = $(".ttt-seats"), status = $(".ttt-status"), stage = $(".ttt-stage"), act = $(".ttt-act"), table = $(".ttt-table");
    // colours come from the design's canvas palette (PAL), exactly like the single-player board
    const rootEl = root.firstElementChild;
    function paint() {
      if (typeof PAL === "undefined") return;
      const rgb = (a) => `rgb(${a.join(",")})`, set = (k, a) => rootEl.style.setProperty(k, rgb(a));
      set("--tx", PAL.mint); set("--txh", PAL.mintHi); set("--to", PAL.sky); set("--toh", PAL.skyHi); set("--tl", PAL.line); set("--tlh", PAL.lineHi);
    }
    paint(); window.addEventListener("themechange", paint);
    const me = () => ctx.me.id;
    const seatOf = (id) => st.seats.indexOf(id);
    const nm = (id) => esc(names[id] || "?") + (id === me() ? " (du)" : "");

    // ---- board (built once per mode, then updated in place) ----
    let ghost = null, builtMode = null, cellEls = [], boardEls = [], shown = null, lineEl = null;
    function build() {
      builtMode = st.mode; shown = null;
      const sup = st.mode === "super";
      let h = "";
      for (let b = 0; b < (sup ? 9 : 1); b++) {
        h += `<div class="tb" data-b="${b}"><div class="tb-cells">`;
        for (let i = 0; i < 9; i++) h += `<div class="tc" role="button" tabindex="-1" data-b="${b}" data-i="${i}" aria-label="Feld ${b * 9 + i + 1}"></div>`;
        h += `</div><div class="tb-big"></div></div>`;
      }
      stage.innerHTML = `<div class="ttt-board ${sup ? "super" : "normal"}">${h}${sup ? `<i class="sep v" style="left:33.333%"></i><i class="sep v" style="left:66.667%"></i><i class="sep h" style="top:33.333%"></i><i class="sep h" style="top:66.667%"></i>` : ""}<svg class="ttt-line" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1"/></svg></div>`;
      cellEls = [...stage.querySelectorAll(".tc")];
      boardEls = [...stage.querySelectorAll(".tb")];
      lineEl = stage.querySelector(".ttt-line path");
    }

    function lineGeom(line) {                                    // both modes lay out three equal columns / rows
      const c = (k) => [(k % 3) * 33.333 + 16.667, Math.floor(k / 3) * 33.333 + 16.667];
      const a = c(line[0]), z = c(line[2]);
      return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${z[0].toFixed(1)} ${z[1].toFixed(1)}`;
    }

    function render() {
      if (builtMode !== st.mode) build();
      const mine = seatOf(me()), turnId = st.seats[st.turn], myTurn = st.phase === "play" && turnId === me();
      const sup = st.mode === "super", req = required(st);
      const prev = shown; shown = st.cells.map((r) => r.slice());
      const ghostWas = ghost; ghost = mine;

      // cells
      cellEls.forEach((el) => {
        const b = +el.dataset.b, i = +el.dataset.i, v = st.cells[b][i];
        if (!prev || prev[b][i] !== v || (!v && ghostWas !== mine)) {
          el.innerHTML = v ? mark(v) : mine >= 0 ? `<span class="gh">${mark(mine + 1)}</span>` : "";   // empty: faint preview of my mark on hover
          el.classList.toggle("fresh", !!v && !!prev);            // only newly played marks animate
        }
        const ok = myTurn && legal(st, b, i);
        el.dataset.ok = ok ? "1" : "";
        el.tabIndex = ok ? 0 : -1;
        el.dataset.m = v ? "xo"[v - 1] : "";
        el.classList.toggle("last", !!st.last && st.last[0] === b && st.last[1] === i && st.phase !== "setup");
        el.dataset.me = mine === 0 ? "x" : "o";
      });
      // small boards: who won it, where must I play
      boardEls.forEach((el, b) => {
        const w = sup ? st.cw[b] : 0;                              // normal mode has no board-level result to show
        el.dataset.w = w === 1 ? "x" : w === 2 ? "o" : w === 3 ? "d" : "";
        el.querySelector(".tb-big").innerHTML = w === 1 || w === 2 ? mark(w) : "";
        const hot = sup && st.phase === "play" && w === 0 && (req === null || req === b);
        el.classList.toggle("hot", hot);
        el.dataset.t = st.turn === 0 ? "x" : "o";
        el.classList.toggle("inwin", !!st.line && sup && st.line.includes(b));
      });
      if (!sup) cellEls.forEach((el, i) => el.classList.toggle("win", !!st.line && st.line.includes(i)));
      stage.firstChild.classList.toggle("idle", st.phase === "setup");
      stage.firstChild.classList.toggle("over", st.phase === "over");
      if (st.line && st.phase === "over") { lineEl.setAttribute("d", lineGeom(st.line)); lineEl.dataset.m = "xo"[st.winner]; lineEl.classList.add("on"); }
      else lineEl.classList.remove("on");

      // header: the two players, whose turn it is
      const seat = (k) => {
        const id = st.seats[k];
        return `<div class="ttt-seat ${"xo"[k]}${st.phase === "play" && st.turn === k ? " turn" : ""}${st.gone.includes(id) ? " gone" : ""}${st.phase === "over" && st.winner === k ? " won" : ""}">
          <i class="ttt-badge">${mark(k + 1)}</i><span class="ttt-nm">${nm(id)}</span><b class="ttt-wins" title="Siege">${st.wins[id] | 0}</b></div>`;
      };
      seatsEl.innerHTML = seat(0) + `<span class="ttt-vs">vs</span>` + seat(1);

      let text;
      if (st.phase === "setup") text = ctx.isHost ? "Wähle den Modus und starte." : "Der Host wählt den Modus …";
      else if (st.phase === "over") {
        if (st.forfeit != null) text = `<b>${nm(st.seats[1 - st.forfeit])}</b> gewinnt – ${esc(names[st.seats[st.forfeit]])} hat das Spiel verlassen.`;
        else if (st.winner === "draw") text = "Unentschieden";
        else text = `<b>${nm(st.seats[st.winner])}</b> gewinnt!`;
      } else if (myTurn) text = sup ? (req === null ? "Du bist dran – spiele in einem beliebigen offenen Feld" : "Du bist dran – spiele im markierten Feld") : "Du bist dran";
      else text = mine >= 0 ? `${nm(turnId)} ist dran` : `${nm(turnId)} ist dran – du schaust zu`;
      status.innerHTML = text;
      status.classList.toggle("mine", myTurn);

      // below the board
      const picker = (canPick) => `<div class="ttt-modes" role="group" aria-label="Modus">${Object.entries(MODES).map(([k, [t, d]]) =>
        `<button type="button" class="ttt-mode${st.mode === k ? " sel" : ""}" data-mode="${k}" aria-pressed="${st.mode === k}" ${canPick ? "" : "disabled"}><b>${t}</b><span>${d}</span></button>`).join("")}</div>`;
      const alive = st.seats.filter((x) => !st.gone.includes(x)).length + st.queue.filter((x) => !st.gone.includes(x)).length;
      if (st.phase === "setup") act.innerHTML = picker(ctx.isHost) + (ctx.isHost ? `<button type="button" class="primary" data-start>Los geht’s</button>` : "");
      else if (st.phase === "over") {
        const canAgain = ctx.isHost || mine >= 0;
        act.innerHTML = picker(ctx.isHost) + (alive < 2 ? `<p class="ttt-note">Es sind nicht genug Spieler übrig.</p>` : canAgain ? `<button type="button" class="primary" data-again>${st.queue.length ? "Nächste Runde" : "Nochmal"}</button>` : `<p class="ttt-note">Warten auf die nächste Runde …</p>`);
      } else act.innerHTML = "";

      // scoreboard + queue
      const q = st.queue.filter((x) => !st.gone.includes(x));
      const rows = order.filter((id) => !st.gone.includes(id)).sort((a, b) => (st.wins[b] | 0) - (st.wins[a] | 0));
      table.innerHTML = (order.length > 2 || st.round ? `<ol class="ttt-score">${rows.map((id) => `<li class="${id === me() ? "me" : ""}"><span>${nm(id)}</span><b>${st.wins[id] | 0}</b></li>`).join("")}</ol>` : "")
        + (q.length ? `<p class="ttt-note">Zuschauer, als Nächstes dran: ${q.map(nm).join(", ")}</p>` : "")
        + (st.draws ? `<p class="ttt-note">${st.draws}× unentschieden</p>` : "");
    }

    // ---- host: the only place that changes the game ----
    const push = () => { ctx.send("state", st); render(); };

    function begin() {                                           // setup / over → a new round
      if (!ctx.isHost) return;
      if (st.phase === "over" && !rotate(st)) return render();
      freshBoard(st); st.phase = "play"; st.round++;
      push();
    }
    function move(b, i, from) {
      if (!ctx.isHost || st.seats[st.turn] !== from || !legal(st, b, i)) return;
      place(st, b, i);
      if (st.phase === "over") { if (st.winner === "draw") st.draws++; else st.wins[st.seats[st.winner]]++; }
      push();
    }
    function setMode(m) {
      if (!ctx.isHost || !(m in MODES) || st.phase === "play") return;
      st.mode = m; freshBoard(st); push();
    }

    stage.addEventListener("click", (e) => {
      const c = e.target.closest(".tc");
      if (!c || !c.dataset.ok) return;
      const b = +c.dataset.b, i = +c.dataset.i;
      if (ctx.isHost) move(b, i, me());
      else ctx.send("move", [b, i], ctx.hostId);
    });
    stage.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tc")) { e.preventDefault(); e.target.click(); } });
    act.addEventListener("click", (e) => {
      const m = e.target.closest("[data-mode]");
      if (m) return ctx.isHost ? setMode(m.dataset.mode) : undefined;
      if (e.target.closest("[data-start]")) begin();
      else if (e.target.closest("[data-again]")) { if (ctx.isHost) begin(); else ctx.send("again", null, ctx.hostId); }
    });

    ctx.onMessage("move", ({ data, from }) => { if (ctx.isHost && Array.isArray(data)) move(data[0] | 0, data[1] | 0, from); });
    ctx.onMessage("again", ({ from }) => { if (ctx.isHost && st.phase === "over" && seatOf(from) >= 0) begin(); });
    ctx.onMessage("state", ({ data, from }) => {
      if (from !== ctx.hostId) return;
      const n = clean(data, ids);
      if (n) { st = n; render(); }
    });

    // somebody left: everybody applies the same change, so the state is right even if the host is the one who left
    ctx.onEvent("leave", ({ id }) => {
      if (!ids.has(id) || st.gone.includes(id)) return;
      st.gone = [...st.gone, id];
      st.queue = st.queue.filter((x) => x !== id);
      const k = seatOf(id);
      if (k >= 0 && st.phase === "play") {                       // opponent gone → the other one wins by forfeit
        st.phase = "over"; st.winner = 1 - k; st.forfeit = k; st.line = null;
        st.wins[st.seats[1 - k]]++;
      }
      render();
    });
    ctx.onEvent("host", ({ you }) => { if (you) push(); });     // new host: re-broadcast what I know

    render();
    return { destroy() { window.removeEventListener("themechange", paint); } };
  },
};
