// Home grid — builds the game cards from the GAMES registry in manifest.js.
// Starred games persist in localStorage and sort to the front.

function buildHome() {
  const grid = document.getElementById("grid");
  let stars = loadStarSet();

  function loadStarSet() {
    try { return new Set(JSON.parse(localStorage.getItem("game_stars") || "[]")); } catch { return new Set(); }
  }
  function saveStarSet(set) {
    try { localStorage.setItem("game_stars", JSON.stringify([...set])); } catch {}
  }

  function buildCards() {
    grid.innerHTML = "";
    const sorted = [...GAMES].sort((a, b) => {
      const as = stars.has(a.id) ? 0 : 1;
      const bs = stars.has(b.id) ? 0 : 1;
      return as - bs;
    });

    sorted.forEach(game => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = "index.html?game=" + game.id;
      a.dataset.id = game.id;
      a.innerHTML = `
        <div class="card-overlay">
          <div class="card-text">
            <div class="card-title">${game.title}</div>
            <div class="card-desc">${game.desc}</div>
          </div>
        </div>
        <button class="star-btn${stars.has(game.id) ? " starred" : ""}" title="${stars.has(game.id) ? "Unstar game" : "Star game"}" aria-label="${stars.has(game.id) ? "Unstar" : "Star"} ${game.title}" aria-pressed="${stars.has(game.id) ? "true" : "false"}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="star-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      `;

      const starBtn = a.querySelector(".star-btn");
      starBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        const wasStarFocused = document.activeElement === starBtn;
        if (stars.has(game.id)) {
          stars.delete(game.id);
        } else {
          stars.add(game.id);
        }
        saveStarSet(stars);
        buildCards();
        if (wasStarFocused) {
          const newStarBtn = grid.querySelector(`.card[data-id="${game.id}"] .star-btn`);
          if (newStarBtn) newStarBtn.focus();
        }
      });

      grid.appendChild(a);

      // inject p5 canvas as preview
      new p5(function(p) {
        p.setup = function() {
          const cnv = p.createCanvas(600, 360);
          cnv.parent(a);
          cnv.elt.style.position = "absolute";
          cnv.elt.style.inset = "0";
          a.insertBefore(cnv.elt, a.firstChild);
          p.noLoop();
          game.preview(p, 600, 360);
        };
      });
    });
  }

  buildCards();
}
