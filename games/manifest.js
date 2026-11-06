// Game manifest — the single registry the home grid is built from.
//
// Adding a new game:
//   1. create games/<id>.js (call initGame({...}) — see game.js for the config shape)
//   2. add one entry here: { id, title, desc, preview }
// The preview receives (p, w, h) on a 600×360 p5 canvas and draws one static,
// representative snapshot of the game (no animation — p.noLoop() is set).

const GAMES = [
  { id: "minesweeper", title: "Minesweeper",   desc: "clear every safe cell",       preview: drawMinesweeper },
  { id: "bugs",        title: "Bug Nudge",     desc: "push every bug home",         preview: drawBugs },
  { id: "snake",       title: "Snake",         desc: "eat · grow · survive",        preview: drawSnake },
  { id: "nonogram",    title: "Nonogram",      desc: "paint the hidden picture",    preview: drawNonogram },
  { id: "conway",      title: "Conway's Life", desc: "it's a game, right?",         preview: drawConway },
  { id: "2048",        title: "2048",          desc: "merge tiles · reach 2048",    preview: draw2048 },
  { id: "lightsout",   title: "Circuit Align", desc: "switch every light off",      preview: drawLightsOut },
  { id: "tictactoe",   title: "Tic Tac Toe",   desc: "Tic² Tac² Toe² · vs computer", preview: drawTicTacToe },
  { id: "flood",       title: "Flood It",      desc: "flood the board",             preview: drawFlood },
  { id: "sudoku",      title: "Sudoku",        desc: "9×9 · 6×6 · 4×4",             preview: drawSudoku },
  { id: "netwalk",     title: "Netwalk",       desc: "rotate pipes · power the grid", preview: drawNetwalk },
  { id: "blackjack",   title: "Blackjack",     desc: "hit · stand · beat the dealer", preview: drawBlackjack },
  { id: "kniffel",     title: "Kniffel · Yahtzee", desc: "roll · hold · write it down", preview: drawKniffel },
  { id: "kritzel",     title: "Kritzel-Revier",    desc: "kritzle das größte Revier",   preview: drawKritzel },
  { id: "circlecapture", title: "Circle Capture", desc: "claim · expand · dominate", preview: drawCircleCapture },
];

// ---- preview renderers ----
// Each receives (p, w, h) on a 600×360 canvas and draws a static, hand-placed
// snapshot in the same style as the game itself. Boards are centred with
// breathing room so nothing is cropped by the card.

function previewBg(p, w, h) {
  p.background(...PAL.board);
  p.noStroke();
  // a soft glow behind the board
  for (let k = 6; k >= 1; k--) {
    p.fill(...PAL.lilac, 3);
    p.ellipse(w / 2, h / 2, w * (0.4 + k * 0.1), h * (0.4 + k * 0.12));
  }
}

function tile(p, x, y, s, col, r) {
  p.noStroke();
  p.fill(...col);
  p.rect(x, y, s, s, r ?? s * 0.18);
}

function drawMinesweeper(p, w, h) {
  previewBg(p, w, h);
  const C = 11, R = 6, cs = 44, g = 3;
  const ox = (w - C * cs) / 2, oy = (h - R * cs) / 2;
  // 0 covered · -1 open blank · 1-4 number · 9 flag · 10 mine (blast)
  const L = [
    [0, 0, 0, 1,-1,-1, 1, 0, 0, 0, 0],
    [0, 9, 0, 2,-1,-1, 2, 9, 0, 0, 0],
    [0, 0, 0, 2, 1, 1, 3, 0, 0, 9, 0],
    [1, 1, 1, 1, 9, 0, 0, 0, 0, 0, 0],
    [-1,-1,-1, 1, 2, 3, 0,10, 0, 0, 0],
    [-1,-1,-1,-1,-1, 1, 0, 0, 0, 0, 0],
  ];
  const NUM = [null, PAL.sky, PAL.mint, PAL.rose, PAL.lilac];
  p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(cs * 0.54);
  for (let j = 0; j < R; j++)
    for (let i = 0; i < C; i++) {
      const v = L[j][i], x = ox + i * cs + g / 2, y = oy + j * cs + g / 2, s = cs - g;
      if (v === 0 || v === 9) {
        tile(p, x, y, s, PAL.panel);
        p.fill(255, 255, 255, 10); p.rect(x, y, s, s * 0.45, s * 0.18, s * 0.18, 0, 0);
        if (v === 9) {
          const cx = x + s / 2, cy = y + s / 2;
          p.stroke(...PAL.ink, 220); p.strokeWeight(2.4);
          p.line(cx - s * 0.12, cy - s * 0.26, cx - s * 0.12, cy + s * 0.24);
          p.noStroke(); p.fill(...PAL.rose);
          p.triangle(cx - s * 0.1, cy - s * 0.27, cx + s * 0.24, cy - s * 0.13, cx - s * 0.1, cy + s * 0.02);
        }
      } else if (v === 10) {
        tile(p, x, y, s, [...PAL.rose, 90]);
        const cx = x + s / 2, cy = y + s / 2, d = s * 0.44;
        p.stroke(...PAL.mineHi); p.strokeWeight(3); p.strokeCap(p.ROUND);
        for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4; p.line(cx - Math.cos(an) * d * 0.78, cy - Math.sin(an) * d * 0.78, cx + Math.cos(an) * d * 0.78, cy + Math.sin(an) * d * 0.78); }
        p.noStroke(); p.fill(...PAL.mine); p.circle(cx, cy, d);
        p.fill(255, 255, 255, 190); p.circle(cx - d * 0.17, cy - d * 0.17, d * 0.26);
      } else {
        tile(p, x, y, s, PAL.well);
        if (v > 0) { p.fill(...NUM[v]); p.text(v, x + s / 2, y + s / 2 + 1); }
      }
    }
}

function drawLadybug(p, cx, cy, cs, home) {
  const d = cs * 0.62;
  if (home) {
    p.noStroke(); p.fill(...PAL.mint, 40); p.circle(cx, cy, cs * 0.92);
    p.noFill(); p.stroke(...PAL.mint, 200); p.strokeWeight(2.5); p.circle(cx, cy, cs * 0.84);
  }
  p.stroke(170, 80, 125); p.strokeWeight(d * 0.06);
  for (const s of [-1, 1]) for (const k of [-0.22, 0.05, 0.3]) p.line(cx, cy + k * d, cx + s * d * 0.52, cy + k * d + k * 0.5 * d);
  p.noStroke();
  p.fill(60, 34, 72); p.circle(cx, cy - d * 0.38, d * 0.42);
  p.stroke(60, 34, 72); p.strokeWeight(d * 0.045);
  p.line(cx - d * 0.08, cy - d * 0.52, cx - d * 0.2, cy - d * 0.66);
  p.line(cx + d * 0.08, cy - d * 0.52, cx + d * 0.2, cy - d * 0.66);
  p.noStroke(); p.fill(...PAL.rose); p.ellipse(cx, cy + d * 0.04, d * 0.8, d * 0.84);
  p.fill(255, 170, 190, 110); p.ellipse(cx - d * 0.16, cy - d * 0.12, d * 0.22, d * 0.16);
  p.stroke(120, 34, 70); p.strokeWeight(d * 0.04); p.line(cx, cy - d * 0.37, cx, cy + d * 0.45);
  p.noStroke(); p.fill(120, 34, 70);
  for (const [sx, sy, r] of [[-0.2, 0, 0.14], [0.2, 0, 0.14], [-0.17, 0.25, 0.11], [0.17, 0.25, 0.11]]) p.circle(cx + sx * d, cy + sy * d, r * d);
  p.fill(255); p.circle(cx - d * 0.09, cy - d * 0.44, d * 0.08); p.circle(cx + d * 0.09, cy - d * 0.44, d * 0.08);
}

function drawBugs(p, w, h) {
  previewBg(p, w, h);
  const C = 7, R = 4, cs = 66, g = 4;
  const ox = (w - C * cs) / 2, oy = (h - R * cs) / 2;
  const homes = [[1, 0], [4, 1], [2, 2], [5, 3], [6, 0]];
  const bugs = [[1, 0, true], [4, 1, true], [3, 3, false], [6, 1, false]];
  for (let j = 0; j < R; j++)
    for (let i = 0; i < C; i++) {
      const x = ox + i * cs + g / 2, y = oy + j * cs + g / 2, s = cs - g;
      const home = homes.some(([a, b]) => a === i && b === j);
      if (home) {
        const filled = bugs.some(([a, b]) => a === i && b === j);
        p.fill(...PAL.sun, filled ? 44 : 22); p.stroke(...PAL.sun, filled ? 150 : 90); p.strokeWeight(1.5);
        p.rect(x, y, s, s, s * 0.16); p.noStroke();
        const r = cs * 0.09;
        p.fill(...PAL.sun, filled ? 120 : 255);
        p.quad(x + s / 2, y + s / 2 - r, x + s / 2 + r, y + s / 2, x + s / 2, y + s / 2 + r, x + s / 2 - r, y + s / 2);
      } else tile(p, x, y, s, PAL.well, s * 0.16);
    }
  // nudge preview arrows around the hovered cell (4,2)
  p.noFill(); p.stroke(...PAL.lilac, 200); p.strokeWeight(2.5);
  p.rect(ox + 4 * cs + 4, oy + 2 * cs + 4, cs - 8, cs - 8, cs * 0.16);
  const ax = ox + 3 * cs + cs / 2, ay = oy + 3 * cs + cs / 2;
  p.stroke(...PAL.lilac, 170); p.strokeCap(p.ROUND);
  p.line(ax - cs * 0.28, ay + cs * 0.28, ax - cs * 0.62, ay + cs * 0.62);
  for (const [bx, by, home] of bugs) drawLadybug(p, ox + bx * cs + cs / 2, oy + by * cs + cs / 2, cs, home);
}

function drawSnake(p, w, h) {
  previewBg(p, w, h);
  const gw = 20, gh = 11, cs = 26;
  const ox = (w - gw * cs) / 2, oy = (h - gh * cs) / 2;
  p.noStroke(); p.fill(...PAL.well); p.rect(ox, oy, gw * cs, gh * cs, 14);
  p.fill(...PAL.line);
  for (let x = 1; x < gw; x++) for (let y = 1; y < gh; y++) p.circle(ox + x * cs, oy + y * cs, 2);
  const c = (gx, gy) => [ox + gx * cs + cs / 2, oy + gy * cs + cs / 2];
  // food
  for (const [fx, fy] of [[9, 5], [15, 2], [4, 8]]) {
    const [x, y] = c(fx, fy);
    p.fill(...PAL.sun, 34); p.circle(x, y, cs * 0.95);
    p.fill(...PAL.sun); p.circle(x, y, cs * 0.55);
    p.fill(...PAL.ink); p.circle(x, y, cs * 0.24);
  }
  function snake(body, col, head, dir) {
    for (let i = 1; i < body.length; i++) {
      const f = i / (body.length - 1);
      p.stroke(p.lerp(head[0], col[0], f), p.lerp(head[1], col[1], f), p.lerp(head[2], col[2], f), 230);
      p.strokeWeight(cs * 0.74); p.strokeCap(p.ROUND);
      p.line(...c(...body[i - 1]), ...c(...body[i]));
    }
    p.noStroke();
    const [hx, hy] = c(...body[0]);
    p.fill(...head, 50); p.circle(hx, hy, cs * 1.05);
    p.fill(...head); p.circle(hx, hy, cs * 0.6);
    p.fill(...PAL.board);
    const e = cs * 0.16;
    p.circle(hx + dir[0] * e - dir[1] * e, hy + dir[1] * e - dir[0] * e, cs * 0.1);
    p.circle(hx + dir[0] * e + dir[1] * e, hy + dir[1] * e + dir[0] * e, cs * 0.1);
  }
  snake([[8, 5], [7, 5], [6, 5], [6, 4], [6, 3], [5, 3], [4, 3], [3, 3], [2, 3]], PAL.mint, PAL.mintHi, [1, 0]);
  snake([[12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [15, 8], [16, 8], [17, 8]], PAL.sky, PAL.skyHi, [-1, 0]);
}

function drawNonogram(p, w, h) {
  previewBg(p, w, h);
  // a little heart, mostly painted
  const sol = [
    "0110110",
    "1111111",
    "1111111",
    "0111110",
    "0011100",
    "0001000",
  ];
  const C = 7, R = 6, cs = 38, u = cs * 0.62;
  const runs = (s) => { const o = []; let c = 0; for (const ch of s) { if (ch === "1") c++; else if (c) { o.push(c); c = 0; } } if (c) o.push(c); return o.length ? o : [0]; };
  const colStr = (i) => sol.map(r => r[i]).join("");
  const maxR = 2, maxC = 2;
  const totW = cs * C + (maxR + 0.4) * u, totH = cs * R + (maxC + 0.4) * u;
  const gx = (w - totW) / 2 + (maxR + 0.4) * u, gy = (h - totH) / 2 + (maxC + 0.4) * u;
  const painted = (i, j) => sol[j][i] === "1" && !(j === 3 && i >= 4) && !(j === 4);
  const crossed = (i, j) => sol[j][i] === "0" && (j <= 1 || i === 0);
  p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(u * 0.88);
  for (let i = 0; i < C; i++) {
    const cl = runs(colStr(i));
    const ok = sol.every((r, j) => (r[i] === "1") === painted(i, j));
    p.fill(...(ok ? PAL.mint : PAL.muted));
    cl.forEach((v, k) => p.text(v, gx + i * cs + cs / 2, gy - 0.65 * u - (cl.length - 1 - k) * u));
  }
  for (let j = 0; j < R; j++) {
    const cl = runs(sol[j]);
    const ok = [...sol[j]].every((ch, i) => (ch === "1") === painted(i, j));
    p.fill(...(ok ? PAL.mint : PAL.muted));
    cl.forEach((v, k) => p.text(v, gx - 0.7 * u - (cl.length - 1 - k) * u, gy + j * cs + cs / 2));
  }
  p.noStroke(); p.fill(...PAL.well); p.rect(gx - 4, gy - 4, C * cs + 8, R * cs + 8, 8);
  for (let i = 0; i < C; i++)
    for (let j = 0; j < R; j++) {
      const x = gx + i * cs + 1.5, y = gy + j * cs + 1.5, s = cs - 3;
      if (painted(i, j)) {
        const t = (i + j) / (C + R - 2);
        const a = p.color(...PAL.sun), b = p.color(...PAL.rose), c = p.color(...PAL.lilac);
        p.fill(t < 0.5 ? p.lerpColor(a, b, t * 2) : p.lerpColor(b, c, (t - 0.5) * 2));
        p.rect(x, y, s, s, 5);
      } else {
        tile(p, x, y, s, PAL.panel, 5);
        if (crossed(i, j)) {
          p.stroke(...PAL.dim); p.strokeWeight(2.5); p.strokeCap(p.ROUND);
          const k = s * 0.28;
          p.line(x + k, y + k, x + s - k, y + s - k); p.line(x + s - k, y + k, x + k, y + s - k);
          p.noStroke();
        }
      }
    }
}

function drawConway(p, w, h) {
  previewBg(p, w, h);
  const cs = 14;
  const offX = Math.floor(w / 2), offY = Math.floor(h / 2);
  // Gosper glider gun snapshot (partial) + a few escaping gliders
  const pts = [
    [-18,-3],[-18,-2],[-17,-3],[-17,-2],
    [-8,-3],[-8,-2],[-8,-1],[-7,-4],[-7,0],[-6,-5],[-6,1],[-5,-5],[-5,1],[-4,-4],[-4,0],[-3,-3],[-3,-2],[-3,-1],[-2,-2],
    [1,-4],[1,-3],[1,-2],[2,-5],[2,-1],[3,-6],[3,0],[4,-6],[4,0],[5,-5],[5,-1],[6,-4],[6,-3],[6,-2],[7,-3],
    [11,-5],[11,-4],[12,-5],[12,-4],
    [-14,6],[-13,7],[-15,8],[-14,8],[-13,8],
    [-5,9],[-4,10],[-6,11],[-5,11],[-4,11],
    [5,5],[6,6],[4,7],[5,7],[6,7],
  ];
  p.fill(...PAL.well);
  for (let x = -22; x <= 22; x++) for (let y = -13; y <= 13; y++) p.circle(offX + x * cs, offY + y * cs, 1.6);
  p.noStroke();
  for (const [cx, cy] of pts) {
    const roll = Math.abs((cx * 31 + cy * 17) % 20);
    const col = roll < 3 ? PAL.aqua : roll < 10 ? PAL.mint : roll < 16 ? PAL.sun : PAL.peach;
    p.fill(...col);
    p.rect(offX + cx * cs + 1, offY + cy * cs + 1, cs - 2, cs - 2, 3);
  }
}

function draw2048(p, w, h) {
  previewBg(p, w, h);
  const N = 4, cs = 66, gap = 8, pad = 12;
  const bw = cs * N + gap * (N - 1) + pad * 2;
  const ox = (w - bw) / 2, oy = (h - bw) / 2;
  const snap = [
    [2, 0, 4, 8],
    [0, 16, 32, 64],
    [4, 128, 256, 512],
    [8, 1024, 2048, 0],
  ];
  const COL = {};
  PAL.tiles.forEach((c, k) => { COL[2 << k] = c; });
  const lightFg = (v) => { const [r, g, b] = COL[v]; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 <= 0.6; };
  p.noStroke(); p.fill(...PAL.well); p.rect(ox, oy, bw, bw, 16);
  p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const x = ox + pad + c * (cs + gap), y = oy + pad + r * (cs + gap), v = snap[r][c];
      if (!v) { tile(p, x, y, cs, PAL.panel, cs * 0.14); continue; }
      if (v >= 128) { p.fill(...COL[v], 50); p.rect(x - 4, y - 4, cs + 8, cs + 8, cs * 0.2); }
      tile(p, x, y, cs, COL[v], cs * 0.14);
      p.fill(255, 255, 255, 16); p.rect(x, y, cs, cs * 0.5, cs * 0.14, cs * 0.14, 0, 0);
      p.fill(...(lightFg(v) ? PAL.onDark : PAL.onLight));
      p.textSize(cs * (v >= 1000 ? 0.3 : v >= 100 ? 0.36 : 0.44));
      p.text(v, x + cs / 2, y + cs / 2 + 1);
    }
}

function drawLightsOut(p, w, h) {
  previewBg(p, w, h);
  const N = 5, cs = 62;
  const ox = (w - N * cs) / 2, oy = (h - N * cs) / 2;
  const on = [
    [1, 0, 0, 1, 0],
    [0, 1, 0, 1, 1],
    [0, 0, 0, 0, 0],
    [1, 1, 0, 1, 0],
    [0, 1, 0, 0, 1],
  ];
  const ctr = (i) => i * cs + cs / 2;
  p.strokeCap(p.ROUND);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const x = ox + ctr(c), y = oy + ctr(r);
      for (const [x2, y2, lit] of [[x + cs, y, c < N - 1 && on[r][c] && on[r][c + 1]], [x, y + cs, r < N - 1 && on[r][c] && on[r + 1][c]]]) {
        if ((x2 > x && c === N - 1) || (y2 > y && r === N - 1)) continue;
        if (lit) { p.stroke(...PAL.sun, 40); p.strokeWeight(10); p.line(x, y, x2, y2); p.stroke(...PAL.sun, 230); p.strokeWeight(3.2); }
        else { p.stroke(...PAL.line); p.strokeWeight(3.2); }
        p.line(x, y, x2, y2);
      }
    }
  p.noStroke();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const x = ox + ctr(c), y = oy + ctr(r);
      if (on[r][c]) {
        p.fill(...PAL.sun, 22); p.circle(x, y, cs * 0.78);
        p.fill(...PAL.sun, 55); p.circle(x, y, cs * 0.54);
        p.fill(...PAL.sun); p.circle(x, y, cs * 0.36);
        p.fill(...PAL.sunHi); p.circle(x - cs * 0.04, y - cs * 0.04, cs * 0.2);
      } else {
        p.fill(...PAL.panel); p.stroke(...PAL.line); p.strokeWeight(2.2); p.circle(x, y, cs * 0.36);
        p.noStroke(); p.fill(...PAL.well); p.circle(x, y, cs * 0.14);
      }
    }
}

function drawTicTacToe(p, w, h) {
  previewBg(p, w, h);
  const board = 300, gap = 10, big = (board - gap * 2) / 3, small = big / 3;
  const ox = (w - board) / 2, oy = (h - board) / 2;
  const XC = PAL.mint, OC = PAL.sky;
  const sub = [
    [1,2,0, 0,1,0, 2,0,0],
    [0,0,0, 0,2,0, 0,0,0],
    [2,1,0, 0,0,0, 0,0,1],
    [0,0,0, 1,0,0, 0,0,0],
    [1,1,1, 2,2,0, 0,1,0],
    [0,2,0, 0,0,0, 0,0,0],
    [2,0,1, 0,0,0, 0,0,0],
    [0,0,0, 0,2,0, 1,0,0],
    [0,0,0, 0,0,0, 0,0,0],
  ];
  const mark = (cx, cy, s, m, a) => {
    p.noFill();
    if (m === 1) {
      p.stroke(...XC, a); p.strokeWeight(Math.max(2, s * 0.12)); p.strokeCap(p.ROUND);
      const k = s * 0.28; p.line(cx - k, cy - k, cx + k, cy + k); p.line(cx + k, cy - k, cx - k, cy + k);
    } else {
      p.stroke(...OC, a); p.strokeWeight(Math.max(2, s * 0.1)); p.circle(cx, cy, s * 0.58);
    }
  };
  for (let b = 0; b < 9; b++) {
    const x = ox + (b % 3) * (big + gap), y = oy + Math.floor(b / 3) * (big + gap);
    if (b === 4) { p.noStroke(); p.fill(...XC, 22); p.rect(x - 2, y - 2, big + 4, big + 4, 10); }
    if (b === 7) { p.fill(...OC, 16); p.stroke(...OC, 120); p.strokeWeight(1.5); p.rect(x - 2, y - 2, big + 4, big + 4, 10); }
    p.stroke(...PAL.line); p.strokeWeight(2); p.strokeCap(p.ROUND);
    for (let g = 1; g < 3; g++) {
      p.line(x + g * small, y + 6, x + g * small, y + big - 6);
      p.line(x + 6, y + g * small, x + big - 6, y + g * small);
    }
    for (let i = 0; i < 9; i++) if (sub[b][i]) mark(x + (i % 3) * small + small / 2, y + Math.floor(i / 3) * small + small / 2, small, sub[b][i], 255);
    if (b === 4) mark(x + big / 2, y + big / 2, big * 0.9, 1, 70);
  }
  p.stroke(...PAL.lineHi); p.strokeWeight(4);
  for (let g = 1; g < 3; g++) {
    const o = g * big + (g - 0.5) * gap;
    p.line(ox + o, oy - 4, ox + o, oy + board + 4);
    p.line(ox - 4, oy + o, ox + board + 4, oy + o);
  }
}

// Klick-Rennen (hub only): a big button and a live scoreboard
function drawClickRace(p, w, h) {
  previewBg(p, w, h);
  p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD);
  p.noStroke(); p.fill(...PAL.mint, 40); p.rect(w / 2 - 130, 70, 260, 120, 22);
  p.stroke(...PAL.mint); p.strokeWeight(3); p.noFill(); p.rect(w / 2 - 130, 70, 260, 120, 22);
  p.noStroke(); p.fill(...PAL.mint); p.textSize(44); p.text("KLICK!", w / 2, 130);
  p.fill(...PAL.ink); p.textSize(30); p.text("0:09", w / 2, 40);
  const rows = [["Mia", 64, PAL.sky], ["Ben", 51, PAL.rose], ["Du", 47, PAL.lilac]];
  rows.forEach(([n, v, c], i) => {
    const y = 226 + i * 38;
    p.fill(...PAL.panel); p.rect(w / 2 - 170, y, 340, 30, 8);
    p.fill(...c, 90); p.rect(w / 2 - 170, y, 340 * v / 64, 30, 8);
    p.fill(...PAL.ink); p.textSize(15); p.textAlign(p.LEFT, p.CENTER); p.text(n, w / 2 - 158, y + 15);
    p.textAlign(p.RIGHT, p.CENTER); p.text(v, w / 2 + 158, y + 15);
  });
}

function drawFlood(p, w, h) {
  previewBg(p, w, h);
  const N = 10, cs = 26, SW = 44;
  const bw = cs * N;
  const ox = (w - bw) / 2, oy = (h - bw - SW) / 2;
  const PALETTE = PAL.flood;
  const L = [
    [1,1,1,1,2,2,3,3,0,0],
    [1,1,1,2,2,3,3,0,0,4],
    [1,1,1,1,2,3,3,0,4,4],
    [1,1,1,2,2,3,0,0,4,5],
    [1,1,1,1,3,3,0,4,4,5],
    [1,1,2,2,3,0,0,4,5,5],
    [1,1,1,2,3,3,4,4,5,5],
    [1,1,2,2,3,0,4,5,5,3],
    [1,1,1,3,3,0,0,4,5,3],
    [1,1,2,3,3,4,4,5,3,3],
  ];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) tile(p, ox + c * cs, oy + r * cs, cs - 2, PALETTE[L[r][c]], 4);
  // territory outline
  p.noFill(); p.stroke(...PAL.ink, 230); p.strokeWeight(2.5); p.strokeJoin(p.ROUND);
  const own = (r, c) => r >= 0 && c >= 0 && r < N && c < N && L[r][c] === 1 && c <= 3;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (!own(r, c)) continue;
      const x = ox + c * cs - 1, y = oy + r * cs - 1;
      if (!own(r - 1, c)) p.line(x, y, x + cs, y);
      if (!own(r + 1, c)) p.line(x, y + cs, x + cs, y + cs);
      if (!own(r, c - 1)) p.line(x, y, x, y + cs);
      if (!own(r, c + 1)) p.line(x + cs, y, x + cs, y + cs);
    }
  const sw = bw / 6, sy = oy + bw + 12;
  for (let i = 0; i < 6; i++) {
    p.noStroke(); p.fill(...PALETTE[i], i === 1 ? 110 : 255);
    p.rect(ox + i * sw + 3, sy, sw - 6, SW - 14, 9);
    if (i === 1) { p.noFill(); p.stroke(...PAL.ink, 230); p.strokeWeight(2); p.rect(ox + i * sw + 3, sy, sw - 6, SW - 14, 9); }
  }
}

function drawSudoku(p, w, h) {
  previewBg(p, w, h);
  const N = 9, cs = 34;
  const bp = N * cs;
  const ox = (w - bp) / 2, oy = (h - bp) / 2;
  const grid = [
    [5,3,0, 0,7,0, 0,0,0],
    [6,0,0, 1,9,5, 0,0,0],
    [0,9,8, 0,0,0, 0,6,0],
    [8,0,0, 0,6,0, 0,0,3],
    [4,0,0, 8,5,3, 0,0,1],
    [7,0,0, 0,2,0, 0,0,6],
    [0,6,0, 0,0,0, 2,8,0],
    [0,0,0, 4,1,9, 0,0,5],
    [0,0,0, 0,8,0, 0,7,9],
  ];
  const mine = new Set(["4,4", "2,0", "6,5"]);
  grid[2][0] = 1; grid[6][5] = 7;
  p.noStroke(); p.fill(...PAL.well); p.rect(ox, oy, bp, bp, 10);
  p.fill(...PAL.lilac, 16); p.rect(ox, oy + 4 * cs, bp, cs); p.rect(ox + 4 * cs, oy, cs, bp);
  p.fill(...PAL.lilac, 70); p.rect(ox + 4 * cs + 1, oy + 4 * cs + 1, cs - 2, cs - 2, 4);
  p.textAlign(p.CENTER, p.CENTER);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      if (!v) continue;
      const m = mine.has(r + "," + c);
      p.fill(...(m ? PAL.sky : PAL.ink));
      p.textStyle(m ? p.NORMAL : p.BOLD);
      p.textSize(cs * (m ? 0.56 : 0.52));
      p.text(v, ox + c * cs + cs / 2, oy + r * cs + cs / 2 + 1);
    }
  // pencil notes in one cell
  p.textStyle(p.NORMAL); p.textSize(9); p.fill(...PAL.muted);
  [[1, 0], [2, 0], [1, 2]].forEach(([a, b], k) => p.text([2, 4, 7][k], ox + 1 * cs + 6 + a * 10, oy + 2 * cs + 7 + b * 10));
  p.stroke(...PAL.line); p.strokeWeight(1);
  for (let i = 1; i < N; i++) {
    if (i % 3) { p.line(ox + i * cs, oy + 4, ox + i * cs, oy + bp - 4); p.line(ox + 4, oy + i * cs, ox + bp - 4, oy + i * cs); }
  }
  p.stroke(...PAL.lineHi); p.strokeWeight(2.5); p.strokeCap(p.ROUND);
  for (let i = 3; i < N; i += 3) { p.line(ox + i * cs, oy + 2, ox + i * cs, oy + bp - 2); p.line(ox + 2, oy + i * cs, ox + bp - 2, oy + i * cs); }
  p.noFill(); p.rect(ox, oy, bp, bp, 10);
}

function drawNetwalk(p, w, h) {
  previewBg(p, w, h);
  const SZ = 6, cs = 50;
  const bw = cs * SZ;
  const ox = (w - bw) / 2, oy = (h - bw) / 2;
  const Nd = 1, Ed = 2, Sd = 4, Wd = 8;
  const DX = { 1: 0, 2: 1, 4: 0, 8: -1 }, DY = { 1: -1, 2: 0, 4: 1, 8: 0 }, OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const src = { r: 2, c: 2 };
  const layout = [
    [Ed|Sd, Sd|Wd, Ed|Sd, Sd|Wd, Ed,    Sd|Wd],
    [Nd,    Nd|Sd, Nd|Sd, Nd|Ed, Sd|Wd, Nd|Sd],
    [Ed|Sd, Nd|Sd|Wd, Nd, Sd,   Nd|Ed, Nd|Sd|Wd],
    [Nd|Sd, Nd,    Ed|Sd, Nd|Ed|Sd|Wd, Wd, Nd|Sd],
    [Nd|Ed|Sd, Sd|Wd, Nd|Sd, Nd|Sd, Ed|Sd, Nd|Wd],
    [Nd,    Nd|Ed, Nd|Wd, Nd|Ed, Nd|Ed|Wd, Wd],
  ];
  const lit = [
    [0,0,1,1,1,1],
    [0,0,1,1,1,1],
    [0,0,1,0,1,1],
    [0,0,0,0,0,1],
    [0,0,0,0,1,1],
    [0,0,0,0,1,0],
  ];
  p.noStroke(); p.fill(...PAL.well); p.rect(ox - 6, oy - 6, bw + 12, bw + 12, 12);
  p.fill(255, 255, 255, 6);
  for (let r = 0; r < SZ; r++) for (let c = 0; c < SZ; c++) p.rect(ox + c * cs + 2, oy + r * cs + 2, cs - 4, cs - 4, 8);
  for (let r = 0; r < SZ; r++)
    for (let c = 0; c < SZ; c++) {
      const m = layout[r][c], on = !!lit[r][c];
      const cx = ox + c * cs + cs / 2, cy = oy + r * cs + cs / 2;
      for (const d of [Nd, Ed, Sd, Wd]) {
        if (!(m & d)) continue;
        const nr = r + DY[d], nc = c + DX[d];
        const touch = nr >= 0 && nr < SZ && nc >= 0 && nc < SZ && (layout[nr][nc] & OPP[d]);
        const len = touch ? cs / 2 : cs * 0.43;
        p.strokeCap(touch ? p.SQUARE : p.ROUND);
        if (on) { p.stroke(...PAL.aqua, 45); p.strokeWeight(cs * 0.36); p.line(cx, cy, cx + DX[d] * len, cy + DY[d] * len); }
        p.stroke(...(on ? PAL.aqua : PAL.dim)); p.strokeWeight(cs * 0.19);
        p.line(cx, cy, cx + DX[d] * len, cy + DY[d] * len);
      }
      p.noStroke(); p.fill(...(on ? PAL.aquaHi : PAL.dim)); p.circle(cx, cy, cs * 0.22);
    }
  const sx = ox + src.c * cs + cs / 2, sy = oy + src.r * cs + cs / 2;
  p.fill(...PAL.sun, 40); p.circle(sx, sy, cs * 0.66);
  p.fill(...PAL.sun); p.circle(sx, sy, cs * 0.4);
  p.noFill(); p.stroke(...PAL.dim); p.strokeWeight(2); p.circle(ox + 0.5 * cs, oy + 1.5 * cs, cs * 0.5);
}

function drawBlackjack(p, w, h) {
  // 90s casino: carpet, brass-framed felt
  p.background(34, 10, 44);
  p.noStroke();
  for (let k = 0; k < 14; k++) for (let m = 0; m < 9; m++) { p.fill(236, 86, 170, 38); p.quad(k * 48 + 24, m * 48 - 6, k * 48 + 30, m * 48, k * 48 + 24, m * 48 + 6, k * 48 + 18, m * 48); }
  p.fill(244, 200, 92); p.rect(18, 14, w - 36, h - 28, 22);
  p.fill(160, 112, 28); p.rect(21, 17, w - 42, h - 34, 20);
  for (let k = 12; k >= 0; k--) { p.fill(14 + k * 2, 100 + k * 5, 66 + k * 3); p.rect(26 + k * 6, 22 + k * 4, w - 52 - k * 12, h - 44 - k * 8, 16); }
  const cw = 70, ch = 98;
  const RANK = [null, "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suit = (s, cx, cy, z, col) => {
    p.noStroke(); p.fill(...col);
    if (s === 0) {
      p.circle(cx - z * 0.24, cy + z * 0.1, z * 0.52); p.circle(cx + z * 0.24, cy + z * 0.1, z * 0.52);
      p.triangle(cx - z * 0.49, cy + z * 0.04, cx + z * 0.49, cy + z * 0.04, cx, cy - z * 0.52);
      p.triangle(cx, cy + z * 0.1, cx - z * 0.2, cy + z * 0.5, cx + z * 0.2, cy + z * 0.5);
    } else if (s === 1) {
      p.circle(cx - z * 0.24, cy - z * 0.14, z * 0.52); p.circle(cx + z * 0.24, cy - z * 0.14, z * 0.52);
      p.triangle(cx - z * 0.49, cy - z * 0.06, cx + z * 0.49, cy - z * 0.06, cx, cy + z * 0.5);
    } else if (s === 2) {
      p.quad(cx, cy - z * 0.52, cx + z * 0.38, cy, cx, cy + z * 0.52, cx - z * 0.38, cy);
    } else {
      p.circle(cx, cy - z * 0.2, z * 0.44); p.circle(cx - z * 0.23, cy + z * 0.1, z * 0.44); p.circle(cx + z * 0.23, cy + z * 0.1, z * 0.44);
      p.triangle(cx, cy, cx - z * 0.2, cy + z * 0.5, cx + z * 0.2, cy + z * 0.5);
    }
  };
  const face = (x, y, r, s) => {
    const col = (s === 1 || s === 2) ? [200, 28, 44] : [28, 26, 36];
    p.fill(0, 0, 0, 40); p.noStroke(); p.rect(x + 1, y + 4, cw, ch, 9);
    p.stroke(70, 56, 36, 190); p.strokeWeight(1); p.fill(252, 249, 240); p.rect(x, y, cw, ch, 9);
    p.noStroke(); p.fill(...col); p.textAlign(p.LEFT, p.TOP); p.textStyle(p.BOLD); p.textSize(r === 10 ? 18 : 20);
    p.text(RANK[r], x + 7, y + 6);
    suit(s, x + 14, y + 37, 13, col);
    if (r > 10) { p.textAlign(p.CENTER, p.CENTER); p.textSize(36); p.text(RANK[r], x + cw / 2 + 7, y + ch / 2 + 14); suit(s, x + cw / 2 + 10, y + ch / 2 - 16, 20, col); }
    else suit(s, x + cw / 2 + 6, y + ch / 2 + 9, r === 1 ? 38 : 32, col);
  };
  const back = (x, y) => {
    p.stroke(70, 56, 36, 190); p.strokeWeight(1); p.fill(252, 249, 240); p.rect(x, y, cw, ch, 9); p.noStroke(); p.fill(168, 22, 44); p.rect(x + 5, y + 5, cw - 10, ch - 10, 5);
    p.noFill(); p.stroke(244, 200, 92, 220); p.strokeWeight(1.5); p.rect(x + 9, y + 9, cw - 18, ch - 18, 4);
    p.noStroke(); p.fill(244, 200, 92); p.quad(x + cw / 2, y + ch / 2 - 18, x + cw / 2 + 13, y + ch / 2, x + cw / 2, y + ch / 2 + 18, x + cw / 2 - 13, y + ch / 2);
  };
  const chip = (cx, cy, rad, v, col) => {
    p.noStroke(); p.fill(0, 0, 0, 40); p.circle(cx + 1, cy + 3, rad * 2);
    p.fill(...col); p.circle(cx, cy, rad * 2);
    p.stroke(250, 248, 240, 230); p.strokeWeight(rad * 0.2); p.strokeCap(p.SQUARE);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; p.line(cx + Math.cos(a) * rad * 0.82, cy + Math.sin(a) * rad * 0.82, cx + Math.cos(a) * rad * 0.98, cy + Math.sin(a) * rad * 0.98); }
    p.noFill(); p.stroke(250, 248, 240, 220); p.strokeWeight(1.2); p.circle(cx, cy, rad * 1.3);
    p.noStroke(); p.fill(250, 248, 240); p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(rad * (v >= 100 ? 0.62 : 0.72)); p.text(v, cx, cy + 1);
  };
  const badge = (cx, cy, txt, col, ink) => {
    p.textSize(15); p.textStyle(p.BOLD);
    const bw = p.textWidth(txt) + 20;
    p.noStroke(); p.fill(...col); p.rect(cx - bw / 2, cy - 12, bw, 24, 12);
    p.fill(...ink); p.textAlign(p.CENTER, p.CENTER); p.text(txt, cx, cy + 0.5);
  };
  // dealer: 9 + hole card, you: K + A (blackjack); drawn in a 1.15× scaled frame around the centre
  p.push(); p.translate(w / 2, h / 2); p.scale(1.15); p.translate(-w / 2, -h / 2);
  const dx = w / 2 - cw - 6, dy = 62, py = 188;
  face(dx, dy, 9, 2); back(dx + cw + 12, dy);
  face(dx - 6, py, 13, 0); face(dx + cw + 6, py - 4, 1, 1);
  badge(dx - 40, dy + 14, "9", [10, 10, 12], [255, 176, 40]);
  badge(dx - 40, py + 14, "21", [10, 10, 12], [120, 255, 160]);
  // chip stack bottom-left, shoe top-right
  chip(150, 270, 24, 100, [36, 36, 44]); chip(150, 261, 24, 50, [200, 32, 46]); chip(150, 252, 24, 10, [40, 100, 214]);
  back(430, 62); back(432, 64);
  p.pop();
}

function drawKniffel(p, w, h) {
  // wooden table, felt tray with a rack of held dice, hand-written score card
  const ctx = p.drawingContext;
  p.background(58, 36, 20);
  p.noStroke();
  for (let i = 0; i < 12; i++) { p.fill(i % 2 ? 80 : 46, i % 2 ? 50 : 28, i % 2 ? 28 : 15, 150); p.rect(0, i * 31 - 4, w, 15 + (i * 7) % 9); }
  // tray
  p.fill(0, 0, 0, 70); p.rect(26, 66, 322, 206, 22);
  p.fill(120, 62, 32); p.rect(22, 58, 322, 206, 22);
  p.fill(176, 98, 52); p.rect(22, 58, 322, 12, 22, 22, 0, 0);
  p.fill(30, 98, 64); p.rect(36, 72, 294, 178, 12);
  for (let i = 0; i < 500; i++) { p.fill(60 + (i * 37) % 30, 140, 96, 60); p.rect(40 + (i * 53) % 286, 76 + (i * 29) % 170, 1.5, 1.5); }
  // rack
  p.fill(0, 0, 0, 60); p.rect(70, 284, 240, 56, 10);
  p.fill(112, 58, 30); p.rect(66, 278, 240, 56, 10);
  p.noFill(); p.stroke(20, 8, 2, 130); p.strokeWeight(1.4);
  for (let i = 0; i < 5; i++) p.rect(78 + i * 45, 290, 36, 36, 6);
  const PIP = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]], 6: [[.28, .28], [.28, .5], [.28, .72], [.72, .28], [.72, .5], [.72, .72]] };
  const die = (x, y, s, n, rot, col, pip) => {
    p.push(); p.translate(x, y); p.rotate(rot);
    const d = s * 0.22;
    p.noStroke(); p.fill(0, 0, 0, 70); p.rect(-s / 2 + 5, -s / 2 + 8, s, s, s * 0.2);
    p.fill(col[0] * 0.72, col[1] * 0.72, col[2] * 0.72); p.quad(s / 2, -s / 2 + 3, s / 2 + d, -s / 2 - d * 0.6, s / 2 + d, s / 2 - d * 1.1, s / 2, s / 2 - 2);
    p.fill(Math.min(255, col[0] * 1.06), Math.min(255, col[1] * 1.06), Math.min(255, col[2] * 1.06)); p.quad(-s / 2 + 3, -s / 2, -s / 2 + 3 + d, -s / 2 - d * 0.6, s / 2 + d, -s / 2 - d * 0.6, s / 2, -s / 2);
    p.fill(...col); p.rect(-s / 2, -s / 2, s, s, s * 0.18);
    p.fill(...pip);
    for (const [px, py] of PIP[n]) p.circle((px - 0.5) * s, (py - 0.5) * s, s * 0.17);
    p.pop();
  };
  const W = [248, 243, 228], K = [24, 24, 30];
  die(104, 140, 50, 5, -0.18, W, K); die(176, 176, 50, 3, 0.22, W, K); die(246, 128, 50, 5, 0.1, W, K);
  die(214, 214, 50, 6, -0.3, W, K); die(142, 222, 50, 2, 0.4, W, K);
  die(98 + 45 * 0, 308, 30, 4, 0, W, K); die(98 + 45 * 3, 308, 30, 4, 0, W, K);
  // the card
  p.push(); p.translate(470, 180); p.rotate(0.03);
  p.fill(0, 0, 0, 80); p.rect(-102, -150, 210, 312, 4);
  p.fill(236, 230, 214); p.rect(-108, -154, 210, 312, 3);
  p.fill(252, 253, 255); p.rect(-104, -158, 210, 312, 3);
  p.fill(21, 151, 191); p.textStyle(p.BOLD); p.textAlign(p.LEFT, p.CENTER); p.textSize(26); p.text("Kniffel", -92, -134);
  p.stroke(29, 147, 184); p.strokeWeight(1.2);
  p.line(-92, -112, 94, -112);
  const x0 = -94, x1 = 94, cols = [-14.5, 16.5, 47.5, 78.5];          // centres of the four game columns
  for (let r = 0; r < 14; r++) p.line(x0, -98 + r * 17.2, x1, -98 + r * 17.2);
  for (const x of [x0, -30, 1, 32, 63, x1]) p.line(x, -98, x, -98 + 14 * 17.2);
  p.noStroke(); p.fill(29, 147, 184, 140);
  for (let r = 0; r < 13; r++) p.rect(x0 + 5, -98 + r * 17.2 + 7, 24 + (r * 11) % 12, 2.4, 1.2);
  // handwritten numbers
  const DIG = { 0: "M3.2.5C1.4.3.5 2.8.5 5c0 2.4 1 4.9 2.6 4.9 1.8 0 2.8-2.5 2.8-4.9C5.9 2.6 5 .6 3.3.4", 1: "M1.2 2.6 3.6.6 3.5 9.9", 2: "M.8 2.5C1 1.2 2 .4 3.1.4c1.5 0 2.4 1 2.3 2.4-.1 1.4-1.8 2.8-3 4.3C1.7 8 1 8.8.6 9.8L5.9 9.6", 3: "M.8 1.7C1.4.7 2.2.4 3 .4c1.4 0 2.2.9 2.2 2.1 0 1.4-1.2 2.2-2.7 2.3 1.8 0 3.1.9 3.1 2.5 0 1.6-1.2 2.6-2.7 2.6C1.8 9.9 1 9.4.4 8.6", 4: "M4.3.4.4 6.6h5.4M4.5 2.6V9.9", 5: "M5.2.5H1.3L.9 4.6C1.7 4 2.6 3.8 3.3 3.8c1.6 0 2.5 1.3 2.5 2.9 0 1.9-1.2 3.1-2.8 3.1C1.8 9.8.9 9.3.4 8.5", 6: "M5 1C4.1.4 3.3.3 2.7.5 1.3 1.1.6 3.6.6 6.2.6 8.4 1.5 9.9 3.1 9.9c1.6 0 2.5-1.2 2.5-2.8 0-1.7-1-2.7-2.4-2.7C2 4.4 1 5.2.7 6.4", 8: "M3.1 4.7C1.6 4.5.9 3.5.9 2.5.9 1.3 1.8.4 3.1.4c1.3 0 2.1.9 2.1 2.1 0 1.1-.8 2-2.1 2.2C1.5 5 .5 6.1.5 7.4c0 1.5 1.1 2.5 2.6 2.5 1.5 0 2.7-1 2.7-2.5 0-1.3-1.1-2.4-2.7-2.7", 9: "M5.6 4.1C5.4 2 4.5.5 3.1.5 1.6.5.6 1.6.6 3.2c0 1.5 1.1 2.5 2.5 2.5 1.4 0 2.4-1 2.5-2.4C5.6 5.7 5.4 8.3 3.9 9.4c-.6.4-1.5.5-2.3.2" };
  const write = (txt, col, row, tint) => {
    let x = cols[col] - txt.length * 4 + 0.6;
    for (const ch of txt) {
      ctx.save(); ctx.translate(x, -98 + row * 17.2 + 3.4); ctx.scale(1.15, 1.15); ctx.lineWidth = 1.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = tint; ctx.stroke(new Path2D(DIG[ch])); ctx.restore(); x += 8;
    }
  };
  const ink = "#1a36a6";
  [["3", 0], ["6", 1], ["9", 2], ["12", 3], ["15", 4], ["18", 5], ["63", 6], ["35", 7], ["98", 8]].forEach(([n, r]) => write(n, 0, r, ink));
  [["2", 0], ["8", 1], ["6", 2], ["8", 3], ["20", 4], ["12", 5]].forEach(([n, r]) => write(n, 1, r, ink));
  write("25", 0, 10, ink); write("30", 0, 11, ink); write("24", 0, 12, ink); write("0", 1, 9, ink);
  p.pop();
}

// Mäxchen (hub only): the pub table — covered cups, one open claim, chalk marks
function drawMaexchen(p, w, h) {
  previewBg(p, w, h);
  const CLR = {
    woodLo: [64, 41, 27], wood: [98, 63, 41], woodHi: [128, 85, 55],
    feltLo: [19, 53, 41], feltHi: [43, 95, 72], chalk: [238, 232, 212],
    red: [198, 62, 50], brass: [214, 176, 104], die: [246, 237, 213], dieLo: [212, 197, 166], pip: [56, 46, 38],
  };
  p.textAlign(p.CENTER, p.CENTER);
  const die = (x, y, s, v, ang) => {
    p.push(); p.translate(x, y); p.rotate(ang); p.noStroke();
    p.fill(0, 0, 0, 26); p.rect(-s / 2 + 2, -s / 2 + 4, s, s, s * 0.22);
    p.fill(...CLR.dieLo); p.rect(-s / 2, -s / 2 + 2, s, s, s * 0.22);
    p.fill(...CLR.die); p.rect(-s / 2, -s / 2, s, s, s * 0.22);
    p.fill(255, 255, 255, 20); p.rect(-s / 2, -s / 2, s, s * 0.42, s * 0.22, s * 0.22, 0, 0);
    const PIPS = { 1: [[0, 0]], 2: [[-.27, -.27], [.27, .27]], 3: [[-.27, -.27], [0, 0], [.27, .27]], 4: [[-.27, -.27], [.27, -.27], [-.27, .27], [.27, .27]], 5: [[-.27, -.27], [.27, -.27], [0, 0], [-.27, .27], [.27, .27]], 6: [[-.27, -.27], [.27, -.27], [-.27, 0], [.27, 0], [-.27, .27], [.27, .27]] };
    p.fill(v === 1 ? CLR.red[0] : CLR.pip[0], v === 1 ? CLR.red[1] : CLR.pip[1], v === 1 ? CLR.red[2] : CLR.pip[2]);
    for (const [fx, fy] of PIPS[v] || []) p.circle(fx * s, fy * s, s * 0.13);
    p.pop();
  };
  const cup = (x, y, s) => {
    p.push(); p.translate(x, y); p.noStroke();
    p.fill(0, 0, 0, 18); p.ellipse(0, s * 0.46, s * 1.0, s * 0.24);
    p.fill(...CLR.dieLo); p.rect(-s * 0.36, -s * 0.42, s * 0.72, s * 0.84, s * 0.15);
    p.fill(...CLR.die); p.rect(-s * 0.36, -s * 0.46, s * 0.72, s * 0.84, s * 0.15);
    p.fill(...CLR.red); p.rect(-s * 0.36, s * 0.06, s * 0.72, s * 0.15);
    p.fill(255, 255, 255, 26); p.rect(-s * 0.36, -s * 0.46, s * 0.72, s * 0.28, s * 0.15, s * 0.15, 0, 0);
    p.fill(...CLR.chalk); p.textSize(s * 0.42); p.textStyle(p.BOLD); p.text("?", 0, s * 0.05);
    p.pop();
  };
  // the table
  for (let i = 8; i >= 0; i--) {
    const t = 1 - i / 8;
    p.fill(CLR.woodLo[0] + (CLR.woodHi[0] - CLR.woodLo[0]) * t, CLR.woodLo[1] + (CLR.woodHi[1] - CLR.woodLo[1]) * t, CLR.woodLo[2] + (CLR.woodHi[2] - CLR.woodLo[2]) * t);
    p.rect(20 + i, 26 + i, w - 40 - i * 2, h - 52 - i * 2, 20 - i * 1.2);
  }
  for (let i = 6; i >= 0; i--) {
    const t = 1 - i / 6;
    p.fill(CLR.feltLo[0] + (CLR.feltHi[0] - CLR.feltLo[0]) * t, CLR.feltLo[1] + (CLR.feltHi[1] - CLR.feltLo[1]) * t, CLR.feltLo[2] + (CLR.feltHi[2] - CLR.feltLo[2]) * t);
    p.rect(28 + i, 34 + i, w - 56 - i * 2, h - 68 - i * 2, 13 - i * 0.9);
  }
  p.noStroke(); p.textStyle(p.BOLD);
  // top: the opponent's covered cups
  cup(w / 2 - 46, 92, 62); cup(w / 2 + 46, 92, 62);
  p.fill(...CLR.chalk, 170); p.textSize(12); p.text("MIA · 2 STRICHE", w / 2, 58);
  // centre: the plaque with the live claim
  p.fill(0, 0, 0, 55); p.rect(w / 2 - 128, 152, 256, 74, 14);
  p.fill(...CLR.wood); p.rect(w / 2 - 132, 148, 256, 74, 14);
  p.fill(...CLR.woodHi); p.rect(w / 2 - 132, 148, 256, 38, 14, 14, 10, 10);
  p.noFill(); p.stroke(...CLR.brass, 180); p.strokeWeight(2); p.rect(w / 2 - 127, 153, 246, 64, 11);
  p.noStroke(); p.fill(...CLR.chalk); p.textSize(30); p.text("5·5", w / 2, 174);
  p.textSize(12); p.fill(...CLR.chalk, 190); p.text("PASCH 5ER · VON BEN", w / 2, 200);
  p.stroke(...CLR.brass, 110); p.strokeWeight(4); p.strokeCap(p.ROUND);
  p.line(w / 2 - 96, 214, w / 2 + 96, 214);
  p.stroke(...(CLR.red)); p.line(w / 2 - 96, 214, w / 2 - 96 + 0.6 * 192, 214);
  p.noStroke();
  // bottom: my dice, one #pip in red
  die(w / 2 - 46, 272, 62, 5, -0.04); die(w / 2 + 46, 272, 62, 3, 0.04);
  p.fill(...CLR.chalk, 170); p.textSize(12); p.text("DU · 1 STRICH", w / 2, 318);
  // strike chips
  for (let k = 0; k < 2; k++) { p.fill(...CLR.red, 220); p.circle(w / 2 + 130 + k * 16, 58, 12); }
  p.fill(...PAL.sky, 220); p.circle(w / 2 + 130, 318, 12);
}

// Kritzel-Revier: crayons scribbling territory on a sheet of drawing paper
function drawKritzel(p, w, h) {
  const PAPER = [246, 235, 210], PAPER_HI = [252, 245, 228], INK = [62, 47, 32], LINE = [214, 197, 160];
  const RED = [226, 84, 62], RED_D = [150, 42, 30], TEAL = [32, 156, 142], TEAL_D = [16, 100, 92];
  const STAR = [243, 192, 44], STAR_D = [166, 116, 18];
  const rnd = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  p.background(...PAPER);
  p.noStroke();
  for (let k = 0; k < 130; k++) { p.fill(120, 96, 60, 14); p.circle(rnd(k + 1) * w, rnd(k + 51) * h, 1.6 + rnd(k + 101) * 2); }
  // the sheet
  p.fill(60, 42, 20, 35); p.rect(56, 62, w - 112, h - 122, 14);
  p.fill(...PAPER_HI, 170); p.stroke(...INK, 220); p.strokeWeight(3); p.rect(50, 56, w - 112, h - 122, 14);
  p.noStroke();
  // faint grid
  p.stroke(...LINE, 160); p.strokeWeight(1);
  const cs = 30, gx = 60, gy = 66, GC = 16, GR = 7;
  for (let i = 1; i < GC; i++) p.line(gx + i * cs, gy, gx + i * cs, gy + GR * cs);
  for (let j = 1; j < GR; j++) p.line(gx, gy + j * cs, gx + GC * cs, gy + j * cs);
  p.noStroke();
  // scribbled territory (red bottom-left, teal top-right)
  const scribble = (c, r, col, dark) => {
    const x = gx + c * cs, y = gy + r * cs, j = (c * 7 + r * 13) % 9 - 4;
    p.push(); p.translate(x + cs / 2 + j * 0.5, y + cs / 2 + ((c * 3 + r * 11) % 5 - 2) * 0.5);
    p.rotate((((c * 5 + r * 7) % 9) - 4) * 0.014);
    p.fill(...col, 225); p.rect(-cs / 2 - 2, -cs / 2 - 2, cs + 4, cs + 4, 4);
    p.stroke(...dark, 90); p.strokeWeight(2); p.strokeCap(p.ROUND);
    p.line(-cs * 0.3, -cs * 0.25, cs * 0.28, cs * 0.05);
    p.line(-cs * 0.2, cs * 0.22, cs * 0.32, -cs * 0.3);
    p.noStroke(); p.pop();
  };
  [[0, 4], [1, 4], [2, 4], [1, 5], [2, 5], [3, 5], [2, 6], [3, 6], [4, 6], [1, 3], [0, 5], [2, 3]].forEach(([c, r]) => scribble(c, r, RED, RED_D));
  [[11, 0], [12, 0], [13, 0], [12, 1], [13, 1], [14, 1], [13, 2], [14, 0], [10, 1], [14, 2]].forEach(([c, r]) => scribble(c, r, TEAL, TEAL_D));
  // coffee stain
  p.push(); p.translate(gx + 8.5 * cs, gy + 4.4 * cs);
  p.fill(150, 104, 58, 46); p.ellipse(0, 0, 52, 46);
  p.noFill(); p.stroke(122, 80, 42, 130); p.strokeWeight(3); p.ellipse(0, 0, 56, 50);
  p.noStroke(); p.fill(140, 96, 54, 90); p.circle(34, 16, 7); p.pop();
  // glitter star
  p.push(); p.translate(gx + 7.5 * cs, gy + 2.5 * cs); p.rotate(-0.1);
  p.fill(...STAR, 70); p.beginShape();
  for (let k = 0; k < 10; k++) { const a = -p.PI / 2 + k * p.PI / 5, rr = k % 2 ? 11 : 24; p.vertex(p.cos(a) * rr, p.sin(a) * rr); }
  p.endShape(p.CLOSE);
  p.fill(...STAR); p.stroke(...STAR_D); p.strokeWeight(2); p.beginShape();
  for (let k = 0; k < 10; k++) { const a = -p.PI / 2 + k * p.PI / 5, rr = k % 2 ? 5.5 : 13; p.vertex(p.cos(a) * rr, p.sin(a) * rr); }
  p.endShape(p.CLOSE); p.noStroke(); p.pop();
  // crayons with faces + name tags
  const crayon = (x, y, col, dark, tilt) => {
    p.push(); p.translate(x, y); p.rotate(tilt);
    p.noStroke(); p.fill(60, 42, 20, 40); p.ellipse(0, 17, 24, 8);
    p.stroke(...dark); p.strokeWeight(2); p.fill(...col); p.rect(-8, -21, 16, 34, 5, 5, 2, 2);
    p.noStroke(); p.fill(...col); p.triangle(-8, 13, 8, 13, 0, 24);
    p.fill(240, 226, 196); p.rect(-8, 9, 16, 5);
    p.fill(...col.map((v) => Math.min(255, v + 40))); p.rect(-8, -7, 16, 9, 2);
    p.fill(255, 252, 246); p.circle(-3.2, -15, 5.4); p.circle(3.2, -15, 5.4);
    p.fill(48, 34, 22); p.circle(-2.6, -15, 2.6); p.circle(3.8, -15, 2.6);
    p.pop();
  };
  const tag = (x, y, txt) => {
    p.textFont("Comic Sans MS"); p.textStyle(p.BOLD); p.textSize(11);
    const tw = p.textWidth(txt) + 14;
    p.noStroke(); p.fill(252, 246, 232, 230); p.stroke(...INK, 90); p.strokeWeight(1.2);
    p.rect(x - tw / 2, y - 9, tw, 17, 8);
    p.noStroke(); p.fill(...INK); p.textAlign(p.CENTER, p.CENTER); p.text(txt, x, y + 0.5);
  };
  crayon(gx + 5.5 * cs, gy + 4.6 * cs, RED, RED_D, -0.18); tag(gx + 5.5 * cs, gy + 4.6 * cs - 37, "Du");
  crayon(gx + 10.5 * cs, gy + 5.5 * cs, TEAL, TEAL_D, 0.22); tag(gx + 10.5 * cs, gy + 5.5 * cs - 37, "Mia");
  // clock + score chips
  p.textFont("Comic Sans MS"); p.textStyle(p.BOLD); p.textAlign(p.CENTER, p.CENTER);
  p.fill(...INK); p.textSize(24); p.text("0:21", gx + GC * cs / 2, gy - 22);
  p.fill(...LINE, 220); p.rect(gx + GC * cs / 2 - 70, gy - 10, 140, 5, 2.5);
  p.fill(...RED); p.rect(gx + GC * cs / 2 - 70, gy - 10, 140 * 0.3, 5, 2.5);
  p.textSize(15);
  p.textAlign(p.RIGHT, p.CENTER);
  p.fill(...RED); p.circle(gx + GC * cs - 66, gy + GR * cs + 22, 14);
  p.fill(...INK); p.text("38", gx + GC * cs - 22, gy + GR * cs + 22);
  p.textAlign(p.LEFT, p.CENTER);
  p.fill(...TEAL); p.circle(gx + 66, gy + GR * cs + 22, 14);
  p.fill(...INK); p.text("31", gx + 78, gy + GR * cs + 22);
}

// Mau-Mau (hub only): the wooden parlour table — striped card backs fanned
// along the edges, a slumping discard pile, sticker-style hand cards
function drawMaumau(p, w, h) {
  p.background(141, 63, 46);
  p.noStroke();
  // wooden planks
  for (let i = 0; i < 8; i++) {
    p.fill(120 + (i % 2) * 14, 50 + (i % 2) * 10, 34 + (i % 2) * 8, 200);
    p.rect(0, i * 45, w, 45);
    p.fill(60, 22, 12, 120); p.rect(0, i * 45, w, 2);
  }
  for (let k = 0; k < 200; k++) {                       // wood grain
    const a = ((k * 197 + 31) % 97) / 97, b = ((k * 283 + 59) % 89) / 89;
    p.fill(70, 26, 14, 30);
    p.rect(a * w, b * h, 10 + (k % 5) * 6, 1.2);
  }
  p.fill(0, 0, 0, 50);
  for (let i = 6; i >= 0; i--) { p.fill(40, 10, 4, 14); p.rect(14 - i, 10 - i, w - 28 + i * 2, h - 20 + i * 2, 20); }
  p.textAlign(p.CENTER, p.CENTER);
  const SUIT = { r: [217, 58, 43], y: [231, 156, 15], g: [47, 145, 71], b: [43, 111, 190], w: [42, 45, 52] };
  const SYM = { 10: "⊘", 11: "⇄", 12: "+2", 14: "+4" };
  const backCard = (x, y, s, rot) => {                  // striped back with MAU tag
    p.push(); p.translate(x, y); p.rotate(rot);
    const cw = s, ch = s / 0.66;
    p.fill(0, 0, 0, 60); p.rect(-cw / 2 + 2, -ch / 2 + 4, cw, ch, 7);
    for (let i = -5; i < 7; i++) {
      const STRIPE = [[232, 77, 138], [245, 166, 35], [53, 182, 176], [123, 92, 214]][((i % 4) + 4) % 4];
      p.fill(...STRIPE);
      p.quad(-cw / 2 + i * cw / 4, -ch / 2, -cw / 2 + (i + 1) * cw / 4, -ch / 2, -cw / 2 + (i + 1) * cw / 4 - 6, ch / 2, -cw / 2 + i * cw / 4 - 6, ch / 2);
    }
    p.noFill(); p.stroke(255); p.strokeWeight(2.5); p.rect(-cw / 2, -ch / 2, cw, ch, 7); p.noStroke();
    p.fill(38, 33, 42); p.rect(-cw * 0.32, -7, cw * 0.64, 14, 5);
    p.fill(255, 217, 77); p.textStyle(p.BOLD); p.textSize(cw * 0.2); p.text("MAU", 0, 0.5);
    p.pop();
  };
  const card = (x, y, s, suit, sym, rot, ring) => {     // sticker-style face
    p.push(); p.translate(x, y); p.rotate(rot);
    const cw = s, ch = s / 0.66;
    p.fill(0, 0, 0, 55); p.rect(-cw / 2 + 2, -ch / 2 + 4, cw, ch, 7);
    p.fill(...SUIT[suit]); p.rect(-cw / 2, -ch / 2, cw, ch, 7);
    p.fill(255, 255, 255, 55); p.rect(-cw / 2, -ch / 2, cw, ch * 0.5, 7, 7, 12, 12);
    p.textStyle(p.BOLD);
    p.fill(253, 246, 232);
    p.textSize(cw * 0.17); p.text(sym, -cw * 0.34, -ch * 0.4);
    p.push(); p.rotate(p.PI); p.text(sym, -cw * 0.34, -ch * 0.4); p.pop();
    p.push(); p.rotate(-0.05); p.textSize(cw * (sym.length > 1 ? 0.4 : 0.58));
    p.fill(60, 20, 8, 90); p.text(sym, 1.5, cw * 0.04 + 1.5);
    p.fill(253, 246, 232); p.text(sym, 0, cw * 0.04); p.pop();
    p.noFill(); p.stroke(255); p.strokeWeight(2.5); p.rect(-cw / 2, -ch / 2, cw, ch, 7); p.noStroke();
    if (ring) { p.stroke(255, 217, 77); p.strokeWeight(4); p.rect(-cw / 2 - 4, -ch / 2 - 4, cw + 8, ch + 8, 10); p.noStroke(); }
    p.pop();
  };
  // opponent fans: top row + left edge, chips like name tags
  const chip = (x, y, label, n) => {
    p.fill(0, 0, 0, 50); p.rect(x - 52, y - 12, 104, 24, 12);
    p.fill(253, 246, 232); p.rect(x - 54, y - 14, 104, 24, 12);
    p.fill(91, 42, 22); p.textStyle(p.BOLD); p.textSize(12); p.text(label, x - 8, y - 2);
    p.fill(253, 246, 232); p.textSize(11); p.fill(91, 42, 22);
    p.fill(91, 42, 22); p.circle(x + 38, y - 2, 16);
    p.fill(253, 246, 232); p.text(String(n), x + 38, y - 1.5);
  };
  for (let i = 0; i < 6; i++) backCard(178 + i * 44 + Math.sin(i * 2.1) * 2, 44 + Math.abs(2.5 - i) * 3, 40, (i - 2.5) * 0.075);
  chip(298, 96, "MIA", 6);
  p.push(); p.translate(38, 170); p.rotate(p.PI / 2);
  for (let i = 0; i < 4; i++) backCard(i * 30 + i * 1.5, Math.abs(1.5 - i) * 3, 34, (i - 1.5) * 0.1);
  p.pop();
  chip(40, 96, "BEN", 4);
  p.fill(238, 164, 28); p.circle(96, 84, 26);
  p.fill(60, 42, 5); p.textStyle(p.BOLD); p.textSize(11); p.text("UNO!", 96, 84);
  // direction + discard pile (red 5 slumping on ghosts)
  p.stroke(255, 244, 226, 130); p.strokeWeight(3.5); p.strokeCap(p.ROUND); p.noFill();
  p.arc(280, 172, 30, 30, -0.5, 3.4);
  p.line(288, 154, 280, 161); p.line(280, 161, 289, 164);
  p.noStroke();
  p.push(); p.translate(352, 176); p.rotate(0.16); p.fill(46, 18, 9); p.rect(-24, -37, 48, 74, 7); p.pop();
  p.push(); p.translate(350, 178); p.rotate(-0.12); p.fill(46, 18, 9); p.rect(-24, -37, 48, 74, 7); p.pop();
  card(352, 178, 50, "r", "5", 0.03, false);
  // deck with count
  backCard(216, 172, 52, -0.04);
  p.fill(253, 246, 232); p.circle(246, 210, 22); p.fill(91, 42, 22); p.textSize(11); p.text("34", 246, 210.5);
  // my fanned hand, the yellow 4 raised
  card(150, 296, 48, "g", "7", -0.14);
  card(198, 302, 48, "b", "3", -0.07);
  card(246, 306, 48, "y", "4", 0, true);
  card(294, 306, 48, "r", "⇄", 0.07);
  card(342, 302, 48, "g", "+2", 0.14);
  card(392, 296, 48, "w", "", 0.2);
  // my name tag
  p.fill(245, 188, 68); p.circle(66, 306, 26); p.stroke(255); p.strokeWeight(2.5); p.noFill(); p.circle(66, 306, 26); p.noStroke();
  p.fill(91, 42, 22); p.textStyle(p.BOLD); p.textSize(13); p.text("D", 66, 306);
  p.fill(255, 233, 184); p.rect(84, 294, 96, 24, 12); p.stroke(255); p.strokeWeight(2); p.noFill(); p.rect(84, 294, 96, 24, 12); p.noStroke();
  p.fill(91, 42, 22); p.textSize(12); p.text("DU", 108, 306); p.text("5", 166, 306);
  // "play" buttons like the app
  p.push(); p.translate(452, 240); p.rotate(-0.1);
  p.fill(53, 182, 176); p.rect(-42, -14, 84, 28, 14); p.stroke(255); p.strokeWeight(2.5); p.noFill(); p.rect(-42, -14, 84, 28, 14); p.noStroke();
  p.fill(255); p.textStyle(p.BOLD); p.textSize(13); p.text("MAU!", 0, 0.5); p.pop();
}
