# Adding a New Game

Two files to touch, nothing else:

1. **`games/<id>.js`** — the game itself (see the template below)
2. **`manifest.js`** — one registry entry + a preview function

The `<id>` is what appears in the URL: `index.html?game=<id>`.

## How it fits together

```
index.html      router: ?game=<id> loads games/<id>.js into the shell,
                no param loads manifest.js + home.js (the card grid)
game.js         shared shell (header, presets, buttons, sliders, info modal)
                + shared helpers every game uses — loaded on every page
manifest.js     GAMES registry + one static preview renderer per game
home.js         builds the home cards from GAMES (stars, sorting, p5 previews)
shared.css      theme + all shell styling
games/<id>.js   one game: initGame(config) + p5 global-mode setup()/draw()
```

Games run in **p5 global mode** — define global `setup()`, `draw()`,
`mousePressed()`, `keyPressed()` etc. and they just work. Only one game
script is ever loaded at a time, so globals can't collide between games.
(Conway is the exception: it builds its own UI and uses instance mode —
don't copy it as a starting point.)

## Game file template

```js
// My Game — one-line description of the goal.

initGame({
  title: "My Game",
  tag: "short subtitle under the title",
  // fullscreen: true,          // edge-to-edge canvas + slim top overlay (like Snake)
  presets: [
    // first entry is the default; values go to onPreset as an array
    { label: "Medium (standard)", values: [10, 3] },
    { label: "Easy",              values: [6, 2] },
    { label: "Hard",              values: [14, 5] },
  ],
  buttons: [
    { id: "btn-new",  label: "New game", primary: true, onClick: () => newGame() },
    { id: "btn-hint", label: "Hint",     onClick: () => confirmHint(giveHint) },
  ],
  sliders: [
    // shown when the user picks "Custom" in the preset dropdown
    { id: "s-size",  label: "Size",  min: 4, max: 20, step: 1, fmt: v => v + "×" + v },
    { id: "s-count", label: "Count", min: 1, max: 10, step: 1 },
  ],
  onPreset: ([size, count]) => { SIZE = size; COUNT = count; clamp(); saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => { if (id === "s-size") SIZE = v; else COUNT = v; },
  onClamp:  clamp,                        // keep slider values consistent with each other
  getSliderValues: () => ({ "s-size": SIZE, "s-count": COUNT }),
  info: {
    anim:  infoAnim,                      // looping p5 demo, see below
    title: "How to play",
    text:  "One or two sentences explaining the rules and controls.",
  },
});

let SIZE = 10, COUNT = 3;

function clamp() { COUNT = Math.min(COUNT, SIZE); }

function saveState() { saveJSON("mygame_state", { SIZE, COUNT }); }
function loadState() {
  const d = loadJSON("mygame_state");
  if (typeof d.SIZE === "number") SIZE = d.SIZE;
  if (typeof d.COUNT === "number") COUNT = d.COUNT;
}

loadState();
clamp();
syncSliderUI();   // reflect loaded state in the preset dropdown / sliders

function newGame() {
  // ...build the puzzle...
  clearParticles();
  resetHint();
  flashNote("");
}

// ---- info modal animation ----
// (p, w, h, frame) on a 440×280 canvas at 30fps. Make it a short scripted
// LOOP that demonstrates the core move — pulse ring on the target, the move
// plays out with real motion (slide/pop/draw-in), brief hold, repeat.
function infoAnim(p, w, h, frame) {
  p.background(20, 18, 15);
  // ...
}

// ---- p5 lifecycle ----

const CANVAS = 440;   // non-fullscreen games: square-ish canvas around 400-460

function setup() {
  const cnv = createCanvas(CANVAS, CANVAS);
  cnv.parent("canvas-wrap");
  newGame();
}

function draw() {
  background(20, 18, 15);
  // ...board...
  drawParticles();    // always after the board, before overlays

  if (won) {
    setStatus("solved!", "solved");
    drawBoardOverlay(ox, oy, boardW, boardW, "SOLVED", "subtitle or null", [127, 176, 105]);
  } else {
    setStatus("progress text", null);
  }
}

function mousePressed() {
  // guard: p5 fires this for clicks anywhere on the page
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  // ...
}
```

## Manifest entry + preview

In `manifest.js`, add to `GAMES`:

```js
{
  id: "mygame",
  title: "My Game",
  desc: "three-word hook",   // shown under the title on the card
  preview: drawMyGame,
},
```

and a preview function next to the others:

```js
function drawMyGame(p, w, h) {
  // 600×360, instance mode (use p.rect, p.fill, ...), drawn ONCE (noLoop).
  // Draw a pre-baked mid-game snapshot that looks like real play — hardcode
  // an interesting board state, don't generate randomly.
  p.background(20, 18, 15);
  // ...
}
```

## Shared helpers (game.js)

| Helper | Use |
|---|---|
| `setStatus(text, state)` | status line; state = `null` \| `"solved"` \| `"dead"` |
| `flashNote(msg)` | small self-clearing note under the buttons |
| `celebrate(tier)` | win confetti; tier 1-3 scaled to the difficulty the player chose |
| `confirmHint(fn)` / `resetHint()` | "Sure?" double-press guard for the Hint button; reset on new game |
| `setButtonActive(id, on)` | gold "toggled" styling for mode buttons (flag mode, 2P, ...) |
| `syncSliderUI()` | push current values back into sliders + preset dropdown |
| `saveJSON(key, obj)` / `loadJSON(key)` | localStorage settings; key convention `"<id>_state"`, type-check every field on load |
| `spawnBurst(x, y, opts)` | radial particle burst; opts: `count, speed:[lo,hi], life:[lo,hi], size:[lo,hi], col:[r,g,b], drag, decay` |
| `addParticle({x, y, vx, vy, ...})` | directional/custom particles |
| `drawParticles()` | update + render, call once per `draw()` |
| `clearParticles()` | on new game |
| `drawBoardOverlay(x, y, w, h, title, subtitle, col)` | dimmed end-of-game overlay over the board rect |
| `shuffleArray(arr, rnd?)` | Fisher–Yates; pass a seeded rnd for reproducible boards |
| `easeInOutQuad(t)` | the house easing for slides/moves |

## Conventions

- **Theme colors** (`shared.css` has them as CSS vars; in canvas code use the RGB triplets):
  background `[20,18,15]`, panel `[38,35,32]`, grid lines `[58,53,46]`,
  ink `[243,237,224]`, muted `[155,145,130]`, gold accent `[230,180,34]`,
  green/success `[127,176,105]`, red/danger `[200,50,63]`, blue P2 `[90,160,210]`.
- **Puzzles must be solvable — and clue puzzles unique.** Pick the generation
  strategy by game class:
  - *Any-goal-state* (Lights Out, Netwalk, Bug Nudge): scramble a solved state
    with legal moves — solvability is guaranteed by construction. Reject
    scrambles that land trivially close to solved (see lightsout.js).
  - *Resource-limited* (Flood-It): generate freely, run a solver, and derive
    the move budget from the solver's result instead of guessing a formula
    (see flood.js `greedySolveMoves`).
  - *Clue-deduction* (Sudoku, Nonogram, most of the backlog): a solution
    merely *existing* isn't enough — the player must be able to reach it, and
    only it, by deduction. Two proven patterns in this repo:
    - **constructive removal** — build a full solution, then remove clues one
      at a time, keeping a removal only while a counting solver still finds
      exactly one solution (sudoku.js `genPuzzle`);
    - **iterative repair** — generate a random solution, run a solver that
      uses only human deduction steps, and wherever it stalls, mutate the
      solution in the ambiguous region and re-solve until it finishes without
      guessing (nonogram.js `genSolution` + `lineSolveGrid`).
  - Keep generation seeded (store the seed, not the board) so a saved puzzle
    reproduces exactly, and keep it fast enough for in-click generation — the
    nonogram repair loop stays under ~100 ms even at 20×20. If a future
    generator can't, pre-bake a pool of good seeds instead.
- **Difficulty settings persist**, board contents don't. Save on change, load at
  startup, always type-check loaded fields.
- **Keyboard**: support the obvious keys (N = new game, Space = restart/toggle,
  arrows/WASD where it makes sense) and `return false` to stop page scroll.
- **Right-click** on the canvas: add a `contextmenu` preventDefault on
  `#canvas-wrap` if the game uses it.
- **Win**: `setStatus(..., "solved")` + `celebrate(tier)` exactly once per win.
