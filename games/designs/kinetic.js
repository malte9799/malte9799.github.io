// Kinetic type — variable-font letters that swell towards the pointer (and
// breathe on their own), marquees whose speed follows the scroll, titles that
// skew with scroll velocity, and previews that tag along with the cursor.
DESIGN_FX.kinetic = {
  enter() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const home = document.getElementById("home");
    const root = document.documentElement;

    // letters of the big titles
    const heads = [...document.querySelectorAll("#home h1, #app header h1")];
    const restore = heads.map((h) => {
      const t = h.textContent;
      h.setAttribute("aria-label", t);
      h.innerHTML = [...t].map((c) => `<span class="kl" aria-hidden="true">${c === " " ? "&nbsp;" : c}</span>`).join("");
      return () => { h.textContent = t; h.removeAttribute("aria-label"); h.style.fontVariationSettings = ""; };
    });
    const letters = [...document.querySelectorAll(".kl")];

    // marquees (home only)
    let marq = null, rows = [];
    if (home && home.style.display !== "none" && home.querySelector(".hero")) {
      marq = document.createElement("div");
      marq.className = "kin-marq";
      marq.setAttribute("aria-hidden", "true");
      const seg = (words) => `<span>${words.map((w) => w + " <b>✺</b> ").join("")}</span>`;
      marq.innerHTML = `<div class="mqw"><div class="mq">${seg(["play", "solve", "repeat", "no ads", "no login"]).repeat(6)}</div></div>` +
                       `<div class="mqw out"><div class="mq">${seg(["tap", "think", "win", "again", "just games"]).repeat(6)}</div></div>`;
      home.querySelector(".hero").after(marq);
      rows = [...marq.querySelectorAll(".mq")];
    }

    let px = innerWidth / 2, py = innerHeight / 2, lastY = scrollY, vel = 0, off = [0, 0], raf = 0, t0 = performance.now();
    const move = (e) => { px = e.clientX; py = e.clientY; };
    addEventListener("pointermove", move, { passive: true });

    const frame = (now) => {
      const t = (now - t0) / 1000;
      // scroll velocity, smoothed
      const dy = scrollY - lastY; lastY = scrollY;
      vel += (dy - vel) * 0.12;
      root.style.setProperty("--kvel", Math.max(-14, Math.min(14, -vel * 0.5)).toFixed(2) + "deg");

      // letters: read, then write
      const boxes = letters.map((l) => l.getBoundingClientRect());
      letters.forEach((l, i) => {
        const b = boxes[i];
        const d = Math.hypot(px - (b.left + b.width / 2), (py - (b.top + b.height / 2)) * 0.5) / Math.max(260, innerWidth * 0.22);
        const infl = Math.max(0, 1 - d);
        const wave = reduce ? 0 : (Math.sin(t * 1.5 + i * 0.9) + 1) / 2;
        const wd = Math.min(150, 62 + infl * 80 + wave * 26);
        const wg = Math.min(900, 380 + infl * 480 + wave * 140);
        l.style.fontVariationSettings = `"wdth" ${wd.toFixed(0)}, "wght" ${wg.toFixed(0)}`;
      });

      // marquees
      rows.forEach((r, i) => {
        const w = r.firstElementChild.offsetWidth || 1;
        const dir = i === 0 ? -1 : 1;
        off[i] += (reduce ? 0 : dir * 1.1) + vel * (i === 0 ? -0.9 : 0.9);
        off[i] = ((off[i] % w) + w) % w;
        r.style.transform = `translateX(${(i === 0 ? -off[i] : off[i] - w).toFixed(1)}px)`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      root.style.removeProperty("--kvel");
      restore.forEach((r) => r());
      if (marq) marq.remove();
    };
  },

  // the preview follows the cursor inside its row
  card(el) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--cx", (e.clientX - r.left).toFixed(0) + "px");
      el.style.setProperty("--cy", (e.clientY - r.top).toFixed(0) + "px");
    });
  },
};
