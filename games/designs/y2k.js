// Y2K chrome — twinkling sparkles and bubbles in the sky, and every card (and
// the game board) becomes a little glossy "window" with a title bar.
DESIGN_FX.y2k = {
  enter() {
    const fx = document.createElement("div");
    fx.className = "y2k-fx";
    fx.setAttribute("aria-hidden", "true");
    const star = (i) => `<svg viewBox="0 0 24 24" style="--s:${14 + (i * 7) % 22}px;--x:${(i * 37 + 6) % 96}%;--y:${(i * 53 + 4) % 88}%;--t:${3 + (i % 4)}s;--d:${-(i % 7) * 0.9}s"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12C7 11 11 7 12 0z"/></svg>`;
    const bub = (i) => `<span class="bub" style="--s:${18 + (i * 13) % 40}px;--x:${(i * 41 + 8) % 96}%;--t:${14 + (i % 5) * 3}s;--d:${-i * 2.3}s;--dx:${((i % 3) - 1) * 40}px"></span>`;
    fx.innerHTML = Array.from({ length: 14 }, (_, i) => star(i)).join("") + Array.from({ length: 8 }, (_, i) => bub(i)).join("");
    document.body.prepend(fx);

    // the game board gets a window frame too
    const wrap = document.querySelector("#canvas-wrap:not(.fs)");
    let bar = null;
    if (wrap) {
      bar = document.createElement("div");
      bar.className = "y2k-bar";
      bar.innerHTML = `<span>${(document.querySelector("#app h1") || {}).textContent || "game"}.exe</span><i></i><i></i><i></i>`;
      wrap.prepend(bar);
    }
    return () => { fx.remove(); if (bar) bar.remove(); };
  },

  card(el, game) {
    const bar = document.createElement("div");
    bar.className = "y2k-bar";
    bar.innerHTML = `<span>${game.id}.exe</span><i></i><i></i><i></i>`;
    el.prepend(bar);
  },
};
