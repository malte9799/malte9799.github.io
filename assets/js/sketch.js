let system = null;
let border = 10;

let inputF, inputMinA, inputMaxA, inputStepA, inputSizeX, inputSizeY, inputStep; 
let infoF, infoF_, infoF__, infoF___;

let f, sizeX, sizeY, step, minA, maxA, stepA;

String.prototype.replaceAll = function(find, replace) {
  return this.split(find).join(replace);
}

function setup() {
  createCanvas(400, 400);
  noLoop();
  translate(width / 2, height / 2);

  let buttonSave = createButton('Save').position(0, height + 50);
  buttonSave.mousePressed(() => {
    resize(800, 800);
    saveCanvas(f, 'png');
    resize(400, 400)
  });

  let buttonRedraw = createButton('Redraw').position(0, height + 25);
  buttonRedraw.mousePressed(() => {
    redraw()
  });

  inputSizeX = input('x', 30, 70, height + 25, 10);
  inputSizeY = input('y', 30, 115, height + 25, 10);
  inputStep = input('step', 30, 160, height + 25, 1);
  inputF = input('Function', 190, 0, height, 'x^2')
  inputMinA = input('min a', 50, 200, height, 1)
  inputMaxA = input('max a', 50, 200, height + 25, 3);
  inputStepA = input('step a', 50, 200, height + 50, 1);

  infoF = createP().position(270, height - 15).hide()
  infoF_ = createP().position(270, height + 5).hide()
  infoF__ = createP().position(270, height + 25).hide()
  infoF___ = createP().position(270, height + 45).hide()
}

function input(placeholder, size, posX, posY, d = "") {
  return createInput(d.toString()).size(size).position(posX, posY).attribute('placeholder', placeholder);
}

function readInputs() {
  f = inputF.value();
  sizeX = Number(inputSizeX.value());
  sizeY = Number(inputSizeY.value());
  step = Number(inputStep.value());
  minA = Number(inputMinA.value());
  maxA = Number(inputMaxA.value());
  stepA = Number(inputStepA.value());
}

function resize(x, y) {
  resizeCanvas(x, y);
  system = createGraphics(width, height);
  createCoordinateSystem();
  redraw();
}

function draw() {
  clear();
  background(220, 0);
  
  readInputs();
  
  system = createGraphics(width, height);
  createCoordinateSystem();
  image(system, 0, 0);

  translate(width / 2, height / 2);

  if (f.includes('a')) {
    for (let i = minA; i <= maxA; i += stepA) {
      calcGraph(i);
    }
  } else {
    calcGraph(1);
  }

  let f_ = math.derivative(f, 'x').toString();
  let f__ = math.derivative(f_, 'x').toString();
  let f___ = math.derivative(f__, 'x').toString();
  
  f_ = f_.replaceAll('*', '').replaceAll(' ', '');
  f__ = f__.replaceAll('*', '').replaceAll(' ', '');
  f___ = f___.replaceAll('*', '').replaceAll(' ', '');
  
  infoF.html(`f(x)=${f}`).show()
  infoF_.html(`f'(x)=${f_}`).show()
  infoF__.html(`f''(x)=${f__}`).show()
  infoF___.html(`f'''(x)=${f___}`).show()
}

function calcGraph(a) {
  let points = []
  fill(0);

  for (var i = -width / 2 + 30; i <= width / 2 - 30; i += 1) {
    let x = i / ((width / 2 - 30) / sizeX)
    let func = f.replaceAll('ax', 'a*x').replaceAll('xa', 'x*a');
    let vars = {
      x: x,
      a: a
    }

    let y = math.evaluate(func, vars);
    points.push([(width / 2 - 30) / sizeX * x, -((height / 2 - 30) / sizeY * y)])
  }
  drawGraph(points);
}

function drawGraph(points) {
  for (let i = 0; i < points.length - 1; i++) {
    line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
  }
}

function createCoordinateSystem() {
  system.fill("Grey");
  system.textSize(16);
  system.textAlign(CENTER);
  system.translate(width / 2, height / 2);

  system.line(-width / 2 + border, 0, width / 2 - border, 0);
  system.line(width / 2 - border - 10, 5, width / 2 - border, 0);
  system.line(width / 2 - border - 10, -5, width / 2 - border, 0);
  system.text("x", width / 2 - border, 16);

  system.line(0, -height / 2 + border, 0, height / 2 - border);
  system.line(5, -height / 2 + border + 10, 0, -height / 2 + border);
  system.line(-5, -height / 2 + border + 10, 0, -height / 2 + border);
  system.text("y", 14, -height / 2 + border + 8);

  system.textSize(10);

  system.text('0', -6, 11)

  for (var i = -sizeX; i <= sizeX; i += step) {
    if (i != 0) {
      let offset = (width / 2 - 30) / sizeX * i;
      system.line(offset, 0, offset, 3);
      system.text(i, offset, 14);

    }
  }

  for (var j = -sizeY; j <= sizeY; j += step) {
    if (j != 0) {
      let offset = (height / 2 - 30) / sizeY * j;
      system.line(0, offset, -3, offset);
      system.text(-j, -11, offset + 4);
    }
  }
}
