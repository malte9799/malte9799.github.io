initGame({
  title: "Tic Tac Toe",
  tag: "Tic² Tac² Toe²",
  presets: [],
  buttons: [],
  sliders: [],
});


let grid = [];
const CANVAS = 400;

function makeGrid(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function newGame() {
  grid = makeGrid(SIZE);
  gameOver = false;
  won = false;
  anim = [];
  animT = 0;

  setStatus("solved — every bug is home", "solved");
}

function setup() {
  const c = createCanvas(CANVAS, CANVAS);
  c.parent("canvas-wrap");
  newGame();
}

function draw() {
    background(20, 18, 15);

    const cs = width / size;

      // Draw static grid lines
  stroke(58, 53, 46); strokeWeight(1);
  for (let g = 0; g <= width + 0.5; g += cs) { line(g, 0, g, height); line(0, g, width, g); }
}