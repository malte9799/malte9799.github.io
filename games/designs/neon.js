// Neon glow — the title is split into letters so one of them can sputter like a
// tired tube, on both the home page and the game pages.
DESIGN_FX.neon = {
  enter() {
    const heads = [...document.querySelectorAll("#home h1, #app header h1")];
    const restore = heads.map((h) => {
      const t = h.textContent;
      h.setAttribute("aria-label", t);
      h.innerHTML = [...t].map((c) => `<span class="nl" aria-hidden="true">${c === " " ? "&nbsp;" : c}</span>`).join("");
      return () => { h.textContent = t; h.removeAttribute("aria-label"); };
    });
    let timer = 0, stopped = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sputter = () => {
      if (stopped || reduce) return;
      const letters = document.querySelectorAll(".nl");
      if (letters.length) {
        const l = letters[Math.floor(Math.random() * letters.length)];
        const pattern = [60, 90, 40, 140, 70, 260];  // off/on alternating
        let i = 0;
        const step = () => {
          if (stopped) return;
          l.classList.toggle("off", i % 2 === 0);
          if (i < pattern.length) setTimeout(step, pattern[i++]);
          else l.classList.remove("off");
        };
        step();
      }
      timer = setTimeout(sputter, 1800 + Math.random() * 4200);
    };
    timer = setTimeout(sputter, 1200);
    return () => { stopped = true; clearTimeout(timer); restore.forEach((r) => r()); };
  },
};
