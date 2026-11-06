// Paper cutout — a scene built from stacked sheets of paper behind the title
// (the layers drift a little with the pointer), and a title where every letter
// is its own cut-out piece that drops into place.
DESIGN_FX.cutout = {
  enter() {
    const scene = document.createElement("div");
    scene.className = "cut-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = `
      <svg viewBox="0 0 1440 520" preserveAspectRatio="xMidYMin slice">
        <defs><linearGradient id="cut-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8d92"/><stop offset="1" stop-color="#3ea5a4"/></linearGradient></defs>
        <rect width="1440" height="520" fill="url(#cut-sky)"/>
        <g class="l sun" data-d="4"><circle cx="1130" cy="190" r="104" fill="#e2574c"/><circle cx="1130" cy="190" r="76" fill="#f4b830"/><circle cx="1130" cy="190" r="48" fill="#f9d56e"/></g>
        <g class="l" data-d="9"><g class="cloud"><path d="M180 150a38 38 0 0 1 56-30 50 50 0 0 1 92 8 34 34 0 0 1 4 68H196a32 32 0 0 1-16-46z" fill="#fcf6e4"/></g></g>
        <g class="l" data-d="14"><g class="cloud b"><path transform="translate(600 -26)" d="M720 96a30 30 0 0 1 44-24 42 42 0 0 1 76 6 28 28 0 0 1 4 56H734a26 26 0 0 1-14-38z" fill="#fcf6e4"/></g></g>
        <g class="l" data-d="6"><path d="M-40 340C120 270 260 270 420 330s320 40 480-20 340-50 580 20V540H-40z" fill="#58b392"/></g>
        <g class="l" data-d="12"><path d="M-40 400C140 330 300 340 470 390s360 20 520-30 330-30 490 30V540H-40z" fill="#2c8a78"/></g>
        <g class="l" data-d="20"><path d="M-40 452C160 410 330 410 520 450s380 10 560-30 270-20 400 20V540H-40z" fill="#174e52"/></g>
      </svg>`;
    document.body.prepend(scene);
    const layers = [...scene.querySelectorAll("g.l")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      layers.forEach((g) => { g.style.transform = `translateX(${(nx * -g.dataset.d * 2.2).toFixed(1)}px)`; });
    };
    if (!reduce) addEventListener("pointermove", move, { passive: true });

    // letter pieces
    const COLS = [["#e2574c", "#fff7e8"], ["#f4b830", "#2b2d42"], ["#fcf6e4", "#e2574c"], ["#3c78be", "#fcf6e4"], ["#8fd0b8", "#2b2d42"], ["#f08a50", "#fff7e8"]];
    const heads = [...document.querySelectorAll("#home h1, #app header h1")];
    const restore = heads.map((h) => {
      const t = h.textContent;
      h.setAttribute("aria-label", t);
      h.innerHTML = [...t].map((c, i) => {
        if (c === " ") return `<span style="display:inline-block;width:0.3em"></span>`;
        const [bg, fg] = COLS[i % COLS.length];
        return `<span class="cl" aria-hidden="true" style="--c:${bg};--t:${fg};--r:${[-5, 4, -2, 6, -4, 3][i % 6]}deg;--y:${[0, 6, -4, 4, -2, 5][i % 6]}px;--k:${i}">${c}</span>`;
      }).join("");
      return () => { h.textContent = t; h.removeAttribute("aria-label"); };
    });

    return () => { removeEventListener("pointermove", move); scene.remove(); restore.forEach((r) => r()); };
  },
};
