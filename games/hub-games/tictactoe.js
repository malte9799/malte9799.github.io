// Tic Tac Toe for the multiplayer hub. The host's client owns the rules: guests send "move" intents,
// the host validates them and broadcasts the whole state. Every client keeps the latest state, so
// when the host leaves, whoever takes over simply carries on.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default {
  min: 2, max: 2,

  mount(ctx) {
    const seats = ctx.players.slice(0, 2).map((p) => ({ id: p.id, name: p.name }));   // [X, O]
    let st = { board: Array(9).fill(""), turn: 0, winner: null, line: null, starter: 0, wins: [0, 0], gone: null };

    ctx.root.innerHTML = `<div class="ttt"><div class="ttt-status" aria-live="polite"></div><div class="ttt-board"></div><div class="ttt-act"></div></div>`;
    const status = ctx.root.querySelector(".ttt-status"), board = ctx.root.querySelector(".ttt-board"), act = ctx.root.querySelector(".ttt-act");
    board.innerHTML = Array.from({ length: 9 }, (_, i) => `<button class="ttt-cell" data-i="${i}" aria-label="Feld ${i + 1}"></button>`).join("");
    const cells = [...board.children];
    const myIdx = () => seats.findIndex((s) => s.id === ctx.me.id);

    function render() {
      const mine = myIdx();
      cells.forEach((c, i) => {
        c.textContent = st.board[i];
        c.dataset.m = st.board[i];
        c.classList.toggle("win", !!st.line && st.line.includes(i));
        c.disabled = !!st.board[i] || st.winner !== null || st.turn !== mine;
      });
      const nm = (k) => esc(seats[k].name) + (k === mine ? " (du)" : "");
      if (st.gone != null) status.innerHTML = `${esc(seats[st.gone].name)} hat das Spiel verlassen.`;
      else if (st.winner === "draw") status.textContent = "Unentschieden";
      else if (st.winner !== null) status.innerHTML = `<b>${nm(st.winner)}</b> gewinnt!`;
      else status.innerHTML = st.turn === mine ? "Du bist dran" : `${nm(st.turn)} ist dran`;
      status.dataset.score = `${seats[0].name} ${st.wins[0]} : ${st.wins[1]} ${seats[1].name}`;
      act.innerHTML = st.winner !== null && ctx.isHost && st.gone == null ? `<button class="primary" data-again>Nochmal</button>` : "";
    }

    function apply(i, k) {                                        // host only: validate + play one move
      if (st.winner !== null || st.gone != null || st.turn !== k || st.board[i]) return;
      st.board[i] = k === 0 ? "X" : "O";
      const line = LINES.find((l) => l.every((j) => st.board[j] === st.board[i]));
      if (line) { st.winner = k; st.line = line; st.wins[k]++; }
      else if (st.board.every(Boolean)) st.winner = "draw";
      else st.turn = 1 - k;
      push();
    }
    const push = () => { ctx.send("state", st); render(); };

    board.addEventListener("click", (e) => {
      const i = e.target.dataset.i;
      if (i == null) return;
      if (ctx.isHost) apply(+i, myIdx());
      else ctx.send("move", +i, ctx.hostId);
    });
    act.addEventListener("click", (e) => {
      if (!e.target.closest("[data-again]") || !ctx.isHost) return;
      st = { ...st, board: Array(9).fill(""), winner: null, line: null, starter: 1 - st.starter, turn: 1 - st.starter, gone: null };
      push();
    });

    ctx.onMessage("move", ({ data, from }) => { if (ctx.isHost) apply(data | 0, seats.findIndex((s) => s.id === from)); });
    ctx.onMessage("state", ({ data, from }) => { if (from === ctx.hostId && data && Array.isArray(data.board)) { st = data; render(); } });
    ctx.onEvent("leave", ({ id }) => {                            // opponent gone → the rest wins by forfeit
      const k = seats.findIndex((s) => s.id === id);
      if (k < 0 || st.gone != null) return;
      st.gone = k;
      if (st.winner === null) { st.winner = 1 - k; st.wins[1 - k]++; }
      render();
    });
    ctx.onEvent("host", ({ you }) => { if (you) push(); });       // new host: re-broadcast what I know

    render();
    return {};
  },
};
