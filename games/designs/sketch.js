// Hand-drawn — registers the "rough" SVG filters (a bit of displacement makes
// straight edges wobble like a pen line) and draws doodles around the title
// with a pen-stroke animation.
DESIGN_FX.sketch = {
  enter() {
    const defs = document.createElement("div");
    defs.setAttribute("aria-hidden", "true");
    defs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    defs.innerHTML = `<svg width="0" height="0"><defs>
      <filter id="sk-rough" x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="sk-soft" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter></defs></svg>`;
    document.body.appendChild(defs);

    let doodles = null;
    const hero = document.querySelector("#home .hero");
    if (hero && document.getElementById("home").style.display !== "none") {
      const ns = "http://www.w3.org/2000/svg";
      doodles = document.createElementNS(ns, "svg");
      doodles.setAttribute("class", "sk-doodles");
      doodles.setAttribute("viewBox", "0 0 1040 360");
      doodles.setAttribute("aria-hidden", "true");
      doodles.setAttribute("style", "filter:url(#sk-soft)");
      // pathLength="1" lets every path share one dash animation
      const p = (d, extra = "", dly = 0) => `<path class="d ${extra}" pathLength="1" style="--d:${dly}" d="${d}"/>`;
      doodles.innerHTML =
        p("M96 26L109 62 146 64 117 87 128 122 96 101 64 122 75 87 46 64 83 62Z", "gold", 0) +                    // star
        p("M20 150c20-40 60-40 66-6s-40 44-44 14", "blue", 1) +                                                       // curl
        p("M130 215c40 52 100 74 168 86M276 276l24 26-34 8", "red", 2) +                                              // arrow
        `<text x="30" y="198" transform="rotate(-9 30 198)">pick one!</text>` +
        p("M900 36c0-12 18-12 18 2s-24 8-24-8 34-14 34 12-44 12-48-14", "blue", 1) +                                  // spiral
        p("M930 150l-8 92M978 148l-8 92M904 180l86-4M900 214l86-4", "", 2) +                                          // #
        p("M928 190l22 22M950 190l-22 22", "red", 3) +
        p("M1000 214a13 13 0 1 0 0.1 0", "blue", 4) +                                                                // O
        p("M860 250l30-20 30 20-30 20zM860 250v28l30 20v-28M920 250v28l-30 20", "gold", 3);                           // cube
      hero.prepend(doodles);
    }
    return () => { defs.remove(); if (doodles) doodles.remove(); };
  },
};
