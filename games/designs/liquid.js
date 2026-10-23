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

    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", move); fx.remove(); };
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
