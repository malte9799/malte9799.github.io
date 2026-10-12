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
