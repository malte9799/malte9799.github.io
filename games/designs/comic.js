// Comic book — every panel gets its own sound effect for the hover burst, and
// clicking anywhere on the home page drops a little "POW!" at the cursor.
const _CMC_SFX = ["POW!", "BAM!", "ZAP!", "WHAM!", "BOOM!", "ZOOM!", "WOW!", "KAPOW!", "SPLAT!", "BING!", "CRASH!", "YES!"];

DESIGN_FX.comic = {
  enter() {
    if (window._pageKind !== "home") return null;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const click = (e) => {
      if (reduce || e.target.closest(".card, button, a")) return;
      const s = document.createElement("div");
      s.className = "cmc-sfx";
      s.textContent = _CMC_SFX[(Math.random() * _CMC_SFX.length) | 0];
      s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px";
      s.style.setProperty("--sr", ((Math.random() * 24 - 12) | 0) + "deg");
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 750);
    };
    addEventListener("pointerdown", click);
    return () => removeEventListener("pointerdown", click);
  },
  card(el, game, i) { el.dataset.sfx = _CMC_SFX[(i * 5 + 3) % _CMC_SFX.length]; },
};
