// Standard frame for every multiplayer hub game (games/hub-games/*.js).
//
// A game calls shell(ctx, { title }) in its mount() and renders into the returned `body`. The frame gives
// every game the same page: a header card with the game title, the room code and the number of players,
// and the two actions that always exist —
//   • "Zurück zur Lobby": the host ends the game for everybody; a guest only leaves this view (the game
//     goes on, "Spiel anzeigen" in the lobby brings it back).
//   • "Raum verlassen": leave the room.
// Nothing in the frame is fixed or overlaid, so the buttons never sit under the design picker.
//
// Usage (see README.md → "Multiplayer-Spiele im Hub"):
//   import { shell } from "../hub-kit.js";
//   mount(ctx) { const kit = shell(ctx, { title: "Mein Spiel" }); kit.body.innerHTML = "…"; … }

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function shell(ctx, { title = "" } = {}) {
  const root = ctx.root;
  root.innerHTML = `
    <section class="hk" aria-label="${esc(title)}">
      <header class="hk-bar">
        <div class="hk-id">
          <h2 class="hk-title">${esc(title)}</h2>
          <span class="hk-meta"></span>
        </div>
        <div class="hk-actions">
          <button type="button" class="hk-main"></button>
          <button type="button" class="hk-quiet" data-act="leave">Raum verlassen</button>
        </div>
      </header>
      <div class="hk-body"></div>
    </section>`;

  const meta = root.querySelector(".hk-meta");
  const main = root.querySelector(".hk-main");
  const body = root.querySelector(".hk-body");

  const paint = () => {
    const s = ctx.room ? ctx.room() : null;
    if (meta) meta.innerHTML = s ? `Raum <b>${esc(s.code)}</b> · ${s.players.length} Spieler` : "";
    if (main) {
      const host = !!ctx.isHost;
      main.textContent = host ? "Zurück zur Lobby" : "Zur Lobby";
      main.title = host ? "Beendet das Spiel für alle und öffnet die Lobby" : "Zeigt die Lobby – das Spiel läuft weiter";
    }
  };
  main.addEventListener("click", () => (ctx.isHost ? ctx.end() : ctx.back()));
  root.querySelector('[data-act="leave"]').addEventListener("click", () => ctx.leaveRoom());
  for (const ev of ["players", "host", "join", "leave"]) ctx.onEvent(ev, paint);
  paint();

  return { body, refresh: paint };
}
