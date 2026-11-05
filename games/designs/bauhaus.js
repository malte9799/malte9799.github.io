// Bauhaus — the poster composition next to the title (a circle, a square and
// a triangle overlapping in primary colours; multiply blending mixes the overlaps).
DESIGN_FX.bauhaus = {
  enter() {
    const hero = document.querySelector("#home .hero");
    if (!hero || document.getElementById("home").style.display === "none") return null;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "bh-comp");
    svg.setAttribute("viewBox", "0 0 420 340");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `
      <rect class="sq" x="196" y="22" width="176" height="176" fill="#f6c000"/>
      <circle class="ci" cx="150" cy="176" r="124" fill="#d62828"/>
      <polygon class="tr" points="246,336 330,150 414,336" fill="#0052b4"/>
      <rect x="0" y="296" width="420" height="14" fill="#141414"/>
      <rect x="40" y="318" width="190" height="6" fill="#141414"/>
      <circle cx="82" cy="60" r="16" fill="#141414"/>
      <path class="ha" d="M300 200a42 42 0 0 1 84 0z" fill="#141414"/>
      <path d="M22 232h118M22 244h118M22 256h118" stroke="#f9f4e7" stroke-width="5"/>`;
    hero.appendChild(svg);
    return () => svg.remove();
  },
};
