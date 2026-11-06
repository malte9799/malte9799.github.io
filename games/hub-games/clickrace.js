// Click race for the multiplayer hub: everybody clicks for 15 seconds, most clicks win.
// Shows the go() hook (all clients start at the same moment) and the "host announces the result" pattern.

import { shell } from "../hub-kit.js";
const DURATION = 15, esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default {
  min: 2, max: 6,

  mount(ctx) {
    const kit = shell(ctx, { title: "Klick-Rennen" }), root = kit.body;
    const score = Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
    const names = Object.fromEntries(ctx.players.map((p) => [p.id, p.name]));
    let phase = "wait", left = DURATION, tick = 0, result = null;

    root.innerHTML = `<div class="cr"><div class="cr-clock">–</div><button class="primary cr-btn" disabled>Warte auf die anderen …</button><ol class="cr-board"></ol><div class="cr-note"></div></div>`;
    const clock = root.querySelector(".cr-clock"), btn = root.querySelector(".cr-btn"), ol = root.querySelector(".cr-board"), note = root.querySelector(".cr-note");

    function render() {
      const rows = Object.keys(score).sort((a, b) => score[b] - score[a]);
      ol.innerHTML = rows.map((id) => `<li class="${id === ctx.me.id ? "me" : ""}"><span>${esc(names[id])}${id === ctx.me.id ? " (du)" : ""}</span><b>${score[id]}</b></li>`).join("");
      clock.textContent = phase === "wait" ? "–" : phase === "over" ? "Zeit!" : left + " s";
      btn.disabled = phase !== "run";
      btn.textContent = phase === "wait" ? "Warte auf die anderen …" : phase === "run" ? "Klick!" : "Vorbei";
      note.innerHTML = result ? `<b>${esc(names[result.winner])}</b> gewinnt mit ${score[result.winner]} Klicks.` : "";
    }

    btn.addEventListener("pointerdown", () => { if (phase !== "run") return; score[ctx.me.id]++; ctx.send("score", score[ctx.me.id]); render(); });
    ctx.onMessage("score", ({ from, data }) => { if (from in score && Number.isFinite(data)) { score[from] = Math.max(score[from], data | 0); render(); } });
    ctx.onMessage("result", ({ from, data }) => {                 // the host's table is the official one
      if (from !== ctx.hostId || !data || !data.score) return;
      for (const id in data.score) if (id in score) score[id] = data.score[id] | 0;
      phase = "over"; result = { winner: data.winner }; render();
    });
    ctx.onEvent("leave", ({ id }) => { if (phase === "run" || phase === "wait") { delete score[id]; render(); } });

    return {
      go() {                                                     // called on every client at the same time
        phase = "run"; left = DURATION; render();
        const t0 = Date.now();
        tick = setInterval(() => {
          left = Math.max(0, DURATION - Math.floor((Date.now() - t0) / 1000));
          if (Date.now() - t0 >= DURATION * 1000) {
            clearInterval(tick); phase = "over"; ctx.send("score", score[ctx.me.id]);
            if (ctx.isHost) setTimeout(announce, 1200);           // give the last clicks a moment to arrive
          }
          render();
        }, 200);
      },
      destroy() { clearInterval(tick); },
    };

    function announce() {
      if (result) return;
      const winner = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
      result = { winner }; ctx.send("result", { score, winner }); render();
    }
  },
};
