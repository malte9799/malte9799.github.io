# Adding a New Game

Two files to touch, nothing else:

1. **`games/<id>.js`** — the game itself (see the template below)
2. **`manifest.js`** — one registry entry + a preview function

The `<id>` is what appears in the URL: `/games/<id>/` (generated page per game, see vite.config.js).

## How it fits together

```
index.html      the start page and router: /games/<id>/ loads games/<id>.js into the shell,
                no param shows the hub (hub.js): "Mehrspieler" / "Einzelspieler" switch,
                multiplayer cards + the single-player card grid (manifest.js + home.js)
themes.js       designs: canvas palettes (PAL), fonts, render effects, picker
themes.css      designs: the page styling per theme (html[data-theme=…])
game.js         shared shell (header, presets, buttons, sliders, info modal)
                + shared helpers every game uses — loaded on every page
multiplayer.js  global multiplayer hub (window.Multiplayer) + lobby window,
multiplayer.css loaded by index.html next to game.js, idle until used
manifest.js     GAMES registry + one static preview renderer per game
home.js         builds the home cards from GAMES (stars, sorting, p5 previews)
shared.css      all shell styling, reading only theme variables
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

function saveState() { saveSettings("mygame_state", { SIZE, COUNT }); }  // not saveJSON — p5 owns that name
function loadState() {
  const d = loadSettings("mygame_state");
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
  p.background(...PAL.board);
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
  background(...PAL.board);
  // ...board...
  drawParticles();    // always after the board, before overlays

  if (won) {
    setStatus("solved!", "solved");
    drawBoardOverlay(ox, oy, boardW, boardW, "Solved!", "subtitle or null", PAL.mint);
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
  // an interesting board state, don't generate randomly. Keep the board
  // centred with some margin; previewBg(p, w, h) gives the standard backdrop.
  previewBg(p, w, h);
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
| `setButtonActive(id, on)` | highlighted "toggled" styling for mode buttons (flag mode, 2P, ...) |
| `syncSliderUI()` | push current values back into sliders + preset dropdown |
| `saveSettings(key, obj)` / `loadSettings(key)` | localStorage settings; key convention `"<id>_state"`, type-check every field on load |
| `spawnBurst(x, y, opts)` | radial particle burst; opts: `count, speed:[lo,hi], life:[lo,hi], size:[lo,hi], col:[r,g,b], drag, decay` |
| `addParticle({x, y, vx, vy, ...})` | directional/custom particles |
| `drawParticles()` | update + render, call once per `draw()` |
| `clearParticles()` | on new game |
| `drawBoardOverlay(x, y, w, h, title, subtitle, col)` | dimmed end-of-game overlay over the board rect |
| `PAL` / `FONT` | theme palette as `[r, g, b]` triplets, and the canvas font name (applied automatically) |
| `shuffleArray(arr, rnd?)` | Fisher–Yates; pass a seeded rnd for reproducible boards |
| `easeInOutQuad(t)` | the house easing for slides/moves |

## Art-directed designs

Fifteen designs go beyond a recolour — each has its own layout, motion and
decoration on the home page *and* on the game pages. They live in `designs/`:

| id | look |
|---|---|
| `liquid` | gooey metaball blobs, melting card outlines, rippling title |
| `neon` | tube-light signs, flickering letters, synthwave floor, canvas glow |
| `y2k` | chrome title, glossy gel buttons, every card a blue "window" |
| `kinetic` | variable-font letters that follow the pointer, scroll-driven marquees, list rows |
| `cutout` | layered paper scenery, cut-out letters, taped cards |
| `holo` | foil cards with pointer-tracked rainbow sheen and 3D tilt |
| `ascii` | terminal + figlet banner; card previews are re-rendered as text, board has a pixels/ASCII toggle |
| `comic` | halftone, panels, speech bubble, POW! bursts, click sound effects |
| `flap` | departure board — real two-half flip tiles, live clock |
| `sketch` | marker on graph paper, wobbly SVG-filtered outlines, drawn-on doodles |
| `blueprint` | cyanotype sheet frame, FIG. numbers, dimension line, title block |
| `pixel` | PICO-8 palette, sprites, previews quantised + dithered to 150×90 |
| `bauhaus` | primary colours, circle/square/triangle, asymmetric hero |
| `deco` | black & gold, sunburst, stepped ornaments, corner brackets |
| `neobrutal` | flat colour blocks, stickers, hard shadows, ticker |

Per design: an entry in `THEMES` (themes.js, with `assets: true`, and
`script: true` if it has a script), `designs/<id>.css` (the usual
`html[data-theme=<id>]` variable block + extra rules), and optionally
`designs/<id>.js` which registers `DESIGN_FX[id] = { enter(), card(el, game, i) }`:

- `enter()` runs once the page content exists (home grid built / game shell
  built) and may return a cleanup function — it **must** undo everything it
  added, because switching design runs it.
- `card(el, game, i)` runs for every home card right after it is built; cards are
  rebuilt on every design switch, so no cleanup is needed there.
- `previewCanvas(el, cb)` waits for a card's p5 preview to exist (ASCII/pixel use it).
- Canvas palettes are generated with `_derive({...})` from ~10 colours; pass
  `over: { … }` to override single `PAL` keys. `fx.glow: n` makes bright
  shapes cast an `n`px glow (Neon).
- The stylesheet must style `button.primary` itself if it restyles `button`
  (the generic rule would otherwise beat `--primary-bg`).

## Conventions

- **Designs.** The player picks a design (Midnight, Classic, Studio, Paper,
  Brutal, Pop, plus the 15 art-directed ones below) with the "Design" button
  (or links straight to one with `index.html?design=<id>`); mechanics
  never change, only looks. So never hardcode colours in canvas code —
  spread `PAL`, e.g. `fill(...PAL.sun, 80)` or `p.stroke(...PAL.line)`.
  PAL is updated in place on a switch, so caching `const C = PAL.mint` is
  fine, but don't copy the numbers out. Don't call `textFont()` either:
  every sketch draws in the design's font automatically, and `rect()` corner
  radii / `textSize()` are scaled per design.
  To add a design: one entry in `THEMES` (themes.js) + one
  `html[data-theme=…]` block in themes.css with the same variables.
  `board` canvas bg · `well` sunken cells · `panel`/`panelHi` raised tiles ·
  `line`/`lineHi` grid lines · `ink`/`muted`/`dim` text · `sun` highlight
  (targets, food, power) · `mint` success / player 1 · `rose` danger ·
  `sky` player 2 / info · `lilac` brand accent (selection, hover) ·
  `peach`, `aqua` extras, plus `*Hi` light cores (`sunHi`, `mintHi`, …),
  `fillInk`, `mine`/`mineHi`, `onLight`/`onDark` text on coloured tiles,
  and per-game sets `tiles`/`tilesNeg` (2048) and `flood` (8 distinct hues).
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
- **Keyboard**: support the obvious keys (N = new game, U / Ctrl+Z = undo,
  H = hint, Space = restart/toggle, arrows/WASD where it makes sense) and
  `return false` to stop page scroll. List them in the info text.
- **Touch**: p5 routes taps to `mousePressed()`; only `return false` (which
  calls preventDefault) when the press was on the canvas, or the buttons
  below it stop working on phones. Prefer a mode button (Flag mode, Notes,
  Cross mode) over right-click/Shift-only actions.
- **Right-click** on the canvas: add a `contextmenu` preventDefault on
  `#canvas-wrap` if the game uses it.
- **Win**: `setStatus(..., "solved")` + `celebrate(tier)` exactly once per win.

## Multiplayer

`multiplayer.js` (+ `multiplayer.css`) is a game-independent room for 2–6 players, loaded on every
game page as `window.Multiplayer`. It uses Trystero 0.26 (Nostr relays for the handshake, then direct
WebRTC), so there is no server and no account. Nothing is downloaded until someone opens a room.
A game only sends its own messages; room, player list, host, invite link, QR code and the lobby
window are handled here. Try it: open `mp-demo.html` in two tabs.

```js
Multiplayer.configure({ game: "tictactoe", min: 2, max: 2 });   // optional, before opening a room
Multiplayer.mountButton(document.querySelector(".row"));        // "Mehrspieler" button → lobby window
Multiplayer.openFromUrl();                                      // opened via …?room=CODE → join form pre-filled

Multiplayer.on("start", ({ game, options, players }) => { /* host pressed "Spiel starten" */ });
Multiplayer.on("message", ({ type, data, from, player }) => {});
Multiplayer.onMessage("move", ({ data, from }) => applyMove(data));   // one message type only

Multiplayer.send("move", { x, y });              // to everybody else in the room
Multiplayer.send("hand", cards, playerId);       // to one player only
```

### Functions

| Call | |
|---|---|
| `host({ name })` → Promise | open a new room, you become the host (state `lobby` when resolved) |
| `join(code, { name })` → Promise | join by code; resolves when the host answered, `null` if it never does (20 s) |
| `leave()` | leave the room (the others keep playing) |
| `send(type, data, toId?)` | game message; `type` is any string, `data` any JSON. Returns `false` while not connected |
| `deliver(type, data, fromId)` | hand a message to your own listeners as if it came from `fromId` (used to replay a remembered state) |

**Reload:** the room is cached in `sessionStorage` (this tab only, 2 h without activity). After a reload
`multiplayer.js` takes the same seat again: the room code, the name and a seat token are reused, so the
player ids stay the same. A player who is still listed (or who had a seat in a running game) is put back
in; if nobody answers within 8 s, the room is opened again under the same code with you as host. The
`start` event gets `resumed: true` when a running game is picked up this way. `player.id` is the seat
token, not the WebRTC peer id, so it is stable across reloads.
| `on(event, fn)` → `off()` | subscribe to an event (`"*"` gets `(event, data)` for all), `onMessage(type, fn)` is shorthand for `"message:<type>"` |
| `setGame(id, { min, max })` | host: choose the game the room plays next (everybody gets a `game` event, the lobby shows it); `min`/`max` limit when `start()` works |
| `start(options?)` | host: start for everybody (needs `min` players). `options` is any JSON every client receives |
| `endGame()` | host: game over, everybody is back in the lobby, the room stays open |
| `configure({ game, min, max, lang, startOptions })` | defaults; `startOptions()` supplies `options` when the lobby's own "Spiel starten" button is used |
| `openUI(prefill?)` / `closeUI()` / `mountButton(el, { label })` / `openFromUrl()` | the shared lobby window with QR board |
| `roomUrl()` | invite link `…/games/<id>/?room=<CODE>` |

Read-only: `state` (`{ code, selfId, hostId, isHost, status, game, options, min, max, players }` or
`null`), `players`, `me`, `isHost`, `connected`, `error`. A player is `{ id, name, host, you }`; `id` is
the peer id and the address for `send(…, id)`. `status` is `connecting` → `lobby` ⇄ `playing`.

### Events

| Event | Payload |
|---|---|
| `join` / `leave` | the player. Fires for everybody, also for yourself on `join` as host |
| `players` | the full player list after any change |
| `host` | `{ hostId, previous, you }` — the host left; the player who has been in the room longest takes over automatically (everyone computes the same), so a room survives its host |
| `game` | game id the host picked (or `null`) |
| `start` | `{ game, options, players, isHost }` |
| `pick` | host pressed "Spiel auswählen" in the lobby window (only with `configure({ lobbyStart: false })`, which replaces its "Spiel starten" button; the hub uses this) |
| `end` | host called `endGame()` |
| `status` | `"lobby"` / `"playing"` |
| `message` | `{ type, data, from, player }` — only from players in the room |
| `close` | `{ reason: "left" \| "error", message? }` — you are out of the room |
| `error` | `{ message }` — connect failed, room not found, room full / already playing |

### Rules of thumb

- Who decides what is up to the game. The typical pattern (Kniffel, Blackjack, …): the host's client
  owns the rules, others send intents and apply what they receive. `Multiplayer.isHost` and the `host`
  event tell you who that is, also after a host change.
- Joining is only possible in the lobby; during `playing` the host refuses new players.
- A player who leaves mid-game disappears from `players` (event `leave`); the game decides what that means
  (skip their turn, end the round, …).
- Messages are not queued: nothing is delivered to players who join later. Send state on `join`
  if a game allows late joiners.
- Games are classic scripts. The module itself loads Trystero with `new Function("u","return import(u)")`
  because a literal `import()` is rewritten by the Vite dev server. Do the same if you need another ESM from a CDN.
- Lobby text is German; the English dictionary is in `multiplayer.js` (`configure({ lang: "en" })`).

### The hub: switching games without leaving the room

`index.html` (+ `hub.js`, `hub.css`) is the start page and the shell for multiplayer games: one page, one room.
Outside a room the heading is a "Mehrspieler / Einzelspieler" switch (`?mode=solo|multi`, remembered); an invite link
(`?room=CODE`) opens the join window without the "open a new room" parts. Each hub game needs a `preview(p, w, h)`
(same 600×360 p5 function style as in `manifest.js`) for its card. The host
picks a game card, presses start, and later "Zurück zur Lobby" to pick another – the page never reloads,
so the WebRTC connection (and every player's peer id) survives. Games here are **ES modules** in
`hub-games/` (not the old global scripts in `games/`), registered in the `MP_GAMES` list at the top of `hub.js`:

```js
// hub-games/mygame.js
export default {
  min: 2, max: 4,                                   // players needed / allowed (the start button respects it)
  mount(ctx) {
    ctx.root.innerHTML = `…`;                       // build your UI here; the shell empties ctx.root afterwards
    ctx.onMessage("move", ({ data, from }) => {});  // namespaced per game run, removed automatically
    ctx.onEvent("leave", (player) => {});           // also "host" ({ you }), "join", "players"
    return {
      go() { /* every client starts now (after all have mounted) */ },
      destroy() { /* clear your own timers, canvases, window listeners */ },
    };
  },
};
```

`ctx`: `root`, `players` (frozen at start), `me`, `isHost` and `hostId` (live, change after a host
migration), `options`, `send(type, data, toId?)`, `onMessage`, `onEvent`, `addCleanup(fn)`, `end()` (host).
Rules: no globals, no top-level side effects (the module is imported once and kept), everything you
start in `mount`/`go` is stopped in `destroy`. The host's client owns the rules and broadcasts state;
see `hub-games/tictactoe.js` (Normal + Super mode, two players at the board and the rest rotating in as spectators, host authority, validated state, host migration), `hub-games/clickrace.js`
(`go()`, host announces the result). Canvas/p5 games should use p5 instance mode inside `ctx.root`.
To add a game: write the module, add one line to `GAMES` in `hub.js`.

`hub-games/kniffel.js` shows how to host a bigger existing game: Kniffel is one script,
`games/kniffel.js`, that exports a factory (`window.createKniffel({ root?, net? })`). On the games page it starts
itself; in the hub the module loads the same script (after setting `window.__KN_HUB__`) and passes the stage as `root`
and the room as `net` (`send`, `onMessage`, `onEvent`, `me`, `isHost`, `hostId`, `players`, `end`, `leave`). Inside, the host
picks the variant on a pre-game screen and announces `begin`; each roll is a seed that every client simulates locally
(fixed physics step), the roller only sends the dice that came to rest and the field they wrote.

## Multiplayer-Spiele im Hub

Ein Hub-Spiel ist ein ES-Modul in `hub-games/`, das in `hub.js` (`MP_GAMES`) eingetragen wird. Es bekommt
einen Kontext (`ctx`) und rendert in einen Rahmen aus `hub-kit.js`. Der Rahmen ist für alle Spiele gleich:

- Kopfkarte mit Spieltitel, Raumcode und Spielerzahl
- **„Zurück zur Lobby“**: Host beendet das Spiel für alle; Gast schließt nur die Ansicht (das Spiel läuft weiter)
- **„Raum verlassen“**

Das Spiel selbst rendert nur in `kit.body`. Es hat keine eigenen Lobby- oder Verlassen-Knöpfe.

```js
// hub-games/mein-spiel.js
import { shell } from "../hub-kit.js";

export default {
  min: 2, max: 4,                              // Spieler, die das Spiel braucht
  mount(ctx) {
    const kit = shell(ctx, { title: "Mein Spiel" });
    kit.body.innerHTML = `<p>Los geht’s</p>`;
    // ctx: body via kit.body · players, me, isHost, hostId (live: window.Multiplayer.state)
    //      send(type, data, toId?), onMessage(type, fn), onEvent("join"|"leave"|"host"|"players", fn)
    //      end() (host: back to lobby), back() (guest: close view), leaveRoom(), room() → state, addCleanup(fn)
    return {
      go() { /* alle Clients starten gleichzeitig */ },
      destroy() { /* Timer stoppen */ },
    };
  },
};
```

Dann in `hub.js` ein Eintrag in `MP_GAMES`: `{ id: "mein-spiel", title: "Mein Spiel", desc: "…", min: 2, max: 4, preview: (p, w, h) => drawX(p, w, h), load: () => import("./hub-games/mein-spiel.js") }`.

Zustand, den ein Gast nach einem Neuladen braucht, schickt der Host als `"state"`-Nachricht; sie wird pro Tab gemerkt
und beim Wiedereinstieg eingespielt (siehe „Reload“ oben).
