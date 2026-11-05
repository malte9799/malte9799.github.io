// Liquid morph — metaball blob field behind the page, a rippling title, and a
// blob that chases the pointer and melts into the others.
DESIGN_FX.liquid = {
  enter() {
    const fx = document.createElement("div");
    fx.className = "liq-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = `
      <svg width="0" height="0" style="position:absolute"><defs>
        <filter id="liq-goo" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="26" result="b"/>
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"/>
        </filter>
        <filter id="liq-ripple" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="4" result="t">
            <animate attributeName="baseFrequency" dur="11s" values="0.012 0.03;0.022 0.012;0.012 0.03" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="9" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs></svg>
      <div class="liq-goo"><i></i><i></i><i></i><i></i><i></i><b></b></div>`;
    document.body.prepend(fx);

    const ptr = fx.querySelector("b");
    let tx = innerWidth * 0.5, ty = innerHeight * 0.4, x = tx, y = ty, raf = 0;
    const move = (e) => { tx = e.clientX; ty = e.clientY; };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      x += (tx - x) * 0.07; y += (ty - y) * 0.07;
      const v = Math.min(1.7, 1 + Math.hypot(tx - x, ty - y) / 260);
      ptr.style.transform = `translate(${x}px, ${y}px) scale(${v.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) { addEventListener("pointermove", move, { passive: true }); tick(); }
    else ptr.style.display = "none";

    // background blobs: pairs drift together, fuse into a peanut shape, and part again
    const blobs = [...fx.querySelectorAll(".liq-goo i")];
    let sized = [], blobRaf = 0;
    const measure = () => { sized = blobs.map((el) => ({ el, r: parseFloat(getComputedStyle(el).width) / 2 })); };
    measure();
    const t0 = performance.now();
    const place = (el, x, y, r) => { el.style.transform = `translate(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px)`; };
    const blobTick = (now) => {
      blobRaf = requestAnimationFrame(blobTick);
      const t = now - t0, W = innerWidth, H = innerHeight;
      const pairs = [[0, 1], [2, 3]];
      pairs.forEach(([a, b], k) => {
        const A = sized[a], B = sized[b];
        if (!A || !B) return;
        const cx = W * (0.5 + 0.34 * Math.sin(t * 0.00004 + k * 2.1));
        const cy = H * (0.5 + 0.28 * Math.sin(t * 0.000055 + k * 1.3 + 0.7));
        const ang = t * 0.00012 + k * 1.7;
        const reach = A.r + B.r;
        const sep = 0.5 + 0.5 * Math.sin(t * 0.00028 + k * 2.4);   // 0 = fused, 1 = apart
        const D = reach * (0.55 + 0.9 * sep);                       // < reach overlaps → neck
        const ux = Math.cos(ang) * D / 2, uy = Math.sin(ang) * D / 2;
        A.el.style.animation = "none"; B.el.style.animation = "none";
        A.el.style.left = B.el.style.left = "0px"; A.el.style.top = B.el.style.top = "0px";
        place(A.el, cx + ux, cy + uy, A.r);
        place(B.el, cx - ux, cy - uy, B.r);
      });
      const L = sized[4];
      if (L) {
        L.el.style.animation = "none"; L.el.style.left = L.el.style.top = "0px";
        place(L.el, W * (0.5 + 0.4 * Math.sin(t * 0.00003 + 4)), H * (0.5 + 0.32 * Math.cos(t * 0.00004 + 1)), L.r);
      }
    };
    if (!reduce) { addEventListener("resize", measure, { passive: true }); blobRaf = requestAnimationFrame(blobTick); }

    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(blobRaf); removeEventListener("pointermove", move); removeEventListener("resize", measure); fx.remove(); };
  },

  // gloss that follows the pointer across each card
  card(el) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      el.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    });
  },
};
