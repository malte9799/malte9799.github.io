// Blueprint — the drawing-sheet frame with zone letters/numbers, a dimension
// line under the title, and the title block in the corner.
DESIGN_FX.blueprint = {
  enter() {
    const frame = document.createElement("div");
    frame.className = "bp-frame";
    frame.setAttribute("aria-hidden", "true");
    let h = "";
    for (let i = 1; i <= 6; i++) {
      const x = ((i - 0.5) / 6 * 100).toFixed(2) + "%";
      h += `<span class="zt" style="left:${x}">${i}</span>`;
      if (i < 6) h += `<i class="tt" style="left:${(i / 6 * 100).toFixed(2)}%"></i>`;
    }
    "ABCD".split("").forEach((c, i) => {
      h += `<span class="zl" style="top:${((i + 0.5) / 4 * 100).toFixed(2)}%">${c}</span>`;
      if (i < 3) h += `<i class="tl" style="top:${((i + 1) / 4 * 100).toFixed(2)}%"></i>`;
    });
    frame.innerHTML = h;
    document.body.appendChild(frame);

    const root = document.getElementById("home").style.display !== "none" ? document.getElementById("home") : document.getElementById("app");
    const isHome = root.id === "home";
    const n = typeof GAMES !== "undefined" ? GAMES.length : 11;
    const title = isHome ? "Games" : ((document.querySelector("#app h1") || {}).textContent || "Game");
    const d = new Date();
    const tb = document.createElement("div");
    tb.className = "bp-tb";
    tb.setAttribute("aria-hidden", "true");
    tb.innerHTML = `
      <div><small>Title</small><span class="big">${title}</span></div>
      <div><small>Drawn by</small>malte</div>
      <div><small>Scale</small>1 : 1</div>
      <div><small>Material</small>${isHome ? n + " puzzles" : "p5.js canvas"}</div>
      <div><small>Date</small>${d.toISOString().slice(0, 10)}</div>
      <div><small>Sheet</small>${isHome ? "1 / 1" : "2 / 2"}</div>`;
    root.appendChild(tb);

    let dim = null;
    if (isHome) {
      dim = document.createElement("div");
      dim.className = "bp-dim";
      dim.setAttribute("aria-hidden", "true");
      dim.innerHTML = `<i></i><span>${n} sheets · play any</span><i></i>`;
      const h1 = document.querySelector("#home .hero h1");
      if (h1) h1.after(dim);
    }
    return () => { frame.remove(); tb.remove(); if (dim) dim.remove(); };
  },
};
