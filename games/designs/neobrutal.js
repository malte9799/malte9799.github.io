// Neo-brutalism — a scrolling ticker above the page, a spinning "N games"
// sticker on the title, and a sticker on every card describing the game.
const _NB_TAGS = { minesweeper: "classic", bugs: "new", snake: "arcade", nonogram: "logic", conway: "zen", "2048": "addictive", lightsout: "puzzle", tictactoe: "vs cpu", flood: "chill", sudoku: "brain", netwalk: "pipes" };

DESIGN_FX.neobrutal = {
  enter() {
    const onHome = document.getElementById("home").style.display !== "none";
    if (!onHome) return null;
    const words = ["play", "solve", "repeat", "no ads", "no login", "just games"];
    const strip = words.map((w) => `<span>${w} ★</span>`).join("");
    const marq = document.createElement("div");
    marq.className = "nb-marq";
    marq.setAttribute("aria-hidden", "true");
    marq.innerHTML = `<div>${strip.repeat(4)}${strip.repeat(4)}</div>`;
    document.body.insertBefore(marq, document.getElementById("home"));

    const hero = document.querySelector("#home .hero");
    const n = typeof GAMES !== "undefined" ? GAMES.length : 11;
    const badge = document.createElement("div");
    badge.className = "nb-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = `<span><b>${n}</b>games</span>`;
    hero.appendChild(badge);
    return () => { marq.remove(); badge.remove(); };
  },
  card(el, game) { el.dataset.tag = _NB_TAGS[game.id] || "play"; },
};
