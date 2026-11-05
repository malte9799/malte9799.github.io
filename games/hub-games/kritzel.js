// Kritzel-Revier in the multiplayer hub.
//
// The game itself is a classic script (games/games/kritzel.js) that runs in p5 global mode and
// normally owns its page: it builds the fullscreen shell via initGame() and talks to
// window.Multiplayer. Inside the hub this module takes the other seat: it loads the script once,
// sets window.__KR_NET__ to an adapter that speaks the Multiplayer dialect over the hub's room
// ctx, points the canvas at the hub stage, and starts/stops the single global p5 sketch per run.
// The host broadcasts the round seed ("seed" message) at go(), so every client builds the very
// same sheet; a mid-game "Nochmal" (N, host only) replays the same path without leaving the game.

let loader = null;

function loadKritzel() {
  if (loader) return loader;
  loader = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "games/kritzel.js";        // the hub page is games/index.html, so this is games/games/kritzel.js
    s.onload = res;
    s.onerror = () => { loader = null; rej(new Error("kritzel.js konnte nicht geladen werden")); };
    document.body.appendChild(s);
  });
  return loader;
}

let styleEl = null;
function injectStyle() {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    .hub-stage.hub-kritzel { position: fixed; inset: 0; z-index: 30; max-width: none; margin: 0;
      padding: 0; border: 0; border-radius: 0; background: #f6ebd2; box-shadow: none; }
    .hub-stage.hub-kritzel canvas { display: block; margin: 0 !important; }
    .hub-bar { position: relative; z-index: 40; }
  `;
  document.head.appendChild(styleEl);
}

export default {
  min: 2, max: 4,
  async mount(ctx) {
    injectStyle();
    ctx.root.innerHTML = `<p class="hub-loading">Lade Kritzel-Revier …</p>`;
    try {
      await loadKritzel();
    } catch (e) {
      ctx.root.innerHTML = `<p class="hub-loading">${e.message}</p>`;
      return {};
    }
    ctx.root.innerHTML = "";
    window.__KR_NET__ = {
      send: (t, d, to) => ctx.send(t, d, to),
      onMessage: (t, fn) => ctx.onMessage(t, fn),
      on: (ev, fn) => ctx.onEvent(ev, fn),
      get isHost() { return !!ctx.isHost; },
      get connected() { return true; },
      get players() { return ctx.players || []; },
      get state() { return { code: "", status: "playing", game: "kritzel", min: 2, max: 4, players: ctx.players || [] }; },
      endGame: () => ctx.end(),
      start: () => false,
      configure: () => {},
      mountButton: () => {},
      openFromUrl: () => false,
    };
    window.__KR_ROOT__ = ctx.root;
    window.__KR_PLAYERS__ = ctx.players;
    window.__kritzelHubInit();
    return {
      go() { try { window.__kritzelHubGo(); } catch (e) { console.error(e); } },
      destroy() { try { window.__kritzelHubDestroy(); } catch (e) { /* nothing left to stop */ } },
    };
  },
};
