// Blackjack — beat the dealer to 21 without going over.
// Casino rules: the dealer stands on every 17, blackjack pays 3:2, you may
// double down on your first two cards. The shoe holds 1, 2 or 6 decks and is
// reshuffled once it runs low. Your chips persist between visits.
//
// Fullscreen game with its own look (90s Vegas: carpet, felt, brass, neon)
// that ignores the site's design picker — only the top bar is re-skinned.
// The table is drawn on a fixed virtual stage (landscape 1000×640 or portrait
// 640×1000) that is scaled to fit the window; see layout().

initGame({
  title: "Blackjack",
  tag: "hit · stand · beat the dealer",
  fullscreen: true,
  presets: [
    { label: "6 decks (casino)", values: [6] },
    { label: "1 deck",           values: [1] },
    { label: "2 decks",          values: [2] },
  ],
  buttons: [],                        // the controls live on the table itself, see TABLE_BUTTONS
  sliders: [],
  onPreset: ([n]) => {
    decks = n;
    needShuffle = true;
    saveState();
    flashNote(phase === "bet" ? "New shoe at the next deal." : "Takes effect next round.");
  },
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Tap the chips to place a bet, then Deal. Get closer to 21 than the dealer without going over. Aces count 1 or 11, face cards 10. A first-two-card 21 is a blackjack and pays 3:2. Double doubles your bet for exactly one more card. The dealer draws to 16 and stands on 17.",
      "Keys: Space / Enter deal · H hit · S stand · D double · C clear bet. Out of chips? Deal hands you a fresh stack.",
    ],
  },
});

// Re-skin the slim top bar so it belongs to the casino, whatever design is picked.
(function skinBar() {
  const s = document.createElement("style");
  s.textContent = `
    #ui-overlay { background: linear-gradient(#32190a, #1b0d05) !important; border-bottom: 2px solid #d9a93a !important;
      box-shadow: 0 6px 24px rgba(0,0,0,.55); backdrop-filter: none !important; }
    #ui-overlay h2 { color: #f3d27a !important; font-family: Georgia, "Times New Roman", serif !important; font-style: italic;
      letter-spacing: .14em !important; text-transform: uppercase !important; }
    #ui-overlay .back-link, #ui-overlay #status-text, #ui-overlay .hint-note { color: #e9cf8c !important; }
    #ui-overlay .row.tight > button:not(.theme-btn) { font-family: Georgia, serif; font-weight: 700; letter-spacing: .06em;
      text-transform: uppercase; color: #f6e7b4; background: linear-gradient(#1d7a50, #0d4a2e);
      border: 1px solid #d9a93a; box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 2px 0 #6b4a10; }
    #ui-overlay .row.tight > button.primary { color: #3a1f05; background: linear-gradient(#ffe38c, #d8981f); }
    #ui-overlay .row.tight > button:disabled { filter: saturate(.4) brightness(.8); }
    #ui-overlay .preset-row select { color: #f6e7b4; background-color: #1b0d05; border: 1px solid #d9a93a; box-shadow: none; }
    #ui-overlay .preset-row::after { border-color: #d9a93a; }
  `;
  document.head.appendChild(s);
})();

const CHIPS = [10, 50, 100, 500];
const START_BANK = 1000;
const FLIP_FRAMES = 14;
const ARRIVE = 12;                    // frames until a dealt card counts as "seen"
let CW = 88, CH = 124;                // card size in stage units (the info modal shrinks these while it draws)

const GOLD = [244, 200, 92], GOLD_DK = [160, 112, 28], CREAM = [252, 249, 240];
const NEON_PINK = [255, 70, 180], NEON_CYAN = [80, 232, 255], NEON_RED = [255, 80, 90];
// single family names: p5 quotes the font string as one name, so a CSS stack would be rejected
const SERIF = "Georgia";
const MONO = "Courier New";
const CHIP_COL = { 10: [40, 100, 214], 50: [200, 32, 46], 100: [36, 36, 44], 500: [128, 54, 172] };

let decks = 6;
let bank = START_BANK;
let bet = 50;                         // the bet chosen for the next round
let stake = 0;                        // what is riding on the current round (doubles with Double)

let shoe = [];
let needShuffle = true;
let player = [], dealer = [];
let phase = "bet";                    // "bet" (idle) | "player" | "dealer"
let result = null;                    // { text, net, tone: "win" | "lose" | "push", t }
let pending = null;                   // { at, fn } — the one scheduled action, doubles as the busy lock

// ---- cards & hands ----

function buildShoe() {
  shoe = [];
  for (let d = 0; d < decks; d++)
    for (let s = 0; s < 4; s++)
      for (let r = 1; r <= 13; r++) shoe.push({ r, s });
  shuffleArray(shoe);
  needShuffle = false;
}

function give(hand, at, up = true) {
  const c = shoe.pop();
  hand.push({ r: c.r, s: c.s, x: G ? G.shoe.x : 0, y: G ? G.shoe.y : 0, at, up, flip: null });
}

function cardValue(r) { return r === 1 ? 11 : Math.min(r, 10); }

function handTotal(cards) {
  let v = 0, aces = 0;
  for (const c of cards) { v += cardValue(c.r); if (c.r === 1) aces++; }
  while (v > 21 && aces) { v -= 10; aces--; }
  return { v, soft: aces > 0 };
}

// what the player can see right now (cards in flight / face-down don't count yet)
function visible(hand) {
  return hand.filter(c => frameCount >= c.at + ARRIVE && (c.up || c.flip !== null));
}

function isNatural(hand) { return hand.length === 2 && handTotal(hand).v === 21; }

// ---- round flow ----

function later(frames, fn) {
  pending = { at: frameCount + frames, fn };
  updateButtons();
}

function maxBet() { return Math.floor(bank / 10) * 10; }

function deal() {
  if (pending || phase !== "bet") return;
  if (bank < CHIPS[0]) {
    bank = START_BANK;
    bet = 50;
    flashNote("Fresh stack of " + START_BANK + " chips.");
  }
  bet = Math.min(bet, maxBet());
  if (bet <= 0) { flashNote("Place a bet first — tap a chip."); return; }

  if (needShuffle || shoe.length < Math.max(15, decks * 52 * 0.25)) {
    buildShoe();
    flashNote("Shuffling a fresh shoe…");
  }
  stake = bet;
  bank -= stake;
  player = []; dealer = [];
  result = null;
  clearParticles();
  phase = "player";
  const t = frameCount;
  give(player, t);
  give(dealer, t + 8);
  give(player, t + 16);
  give(dealer, t + 24, false);          // hole card
  saveState();
  later(40, afterDeal);
}

function afterDeal() {
  if (isNatural(player) || isNatural(dealer)) {
    reveal();
    later(34, settle);
  }
}

function reveal() {
  const hole = dealer[1];
  if (hole && !hole.up && hole.flip === null) hole.flip = frameCount;
}

function hit() {
  if (pending || phase !== "player") return;
  give(player, frameCount);
  afterPlayerCard();
}

function doubleDown() {
  if (pending || phase !== "player" || player.length !== 2 || bank < stake) return;
  bank -= stake;
  stake *= 2;
  give(player, frameCount);
  afterPlayerCard(true);
}

function afterPlayerCard(forceStand) {
  const v = handTotal(player).v;
  if (v > 21) later(ARRIVE + 14, () => { phase = "dealer"; reveal(); later(34, settle); });
  else if (v === 21 || forceStand) later(ARRIVE + 14, stand);
  else later(ARRIVE + 2, () => {});
}

function stand() {
  if (pending || phase !== "player") return;
  phase = "dealer";
  reveal();
  later(34, dealerStep);
}

function dealerStep() {
  if (handTotal(dealer).v < 17) {
    give(dealer, frameCount);
    later(ARRIVE + 24, dealerStep);
  } else settle();
}

function settle() {
  const pv = handTotal(player).v, dv = handTotal(dealer).v;
  const pNat = isNatural(player), dNat = isNatural(dealer);
  let text, tone, payout;
  if (pv > 21)               { text = "Bust";             tone = "lose"; payout = 0; }
  else if (pNat && !dNat)    { text = "Blackjack!";       tone = "win";  payout = stake * 2.5; }
  else if (pNat && dNat)     { text = "Push";             tone = "push"; payout = stake; }
  else if (dNat)             { text = "Dealer blackjack"; tone = "lose"; payout = 0; }
  else if (dv > 21)          { text = "Dealer busts";     tone = "win";  payout = stake * 2; }
  else if (pv > dv)          { text = "You win";          tone = "win";  payout = stake * 2; }
  else if (pv < dv)          { text = "Dealer wins";      tone = "lose"; payout = 0; }
  else                       { text = "Push";             tone = "push"; payout = stake; }

  bank += payout;
  result = { text, net: payout - stake, tone, t: frameCount };
  phase = "bet";
  bet = Math.min(bet, maxBet());
  saveState();

  if (tone === "win") {
    celebrate(pNat ? 2 : 1);
    const c = toScreen(G.VW / 2, G.bannerY);
    spawnBurst(c.x, c.y, { count: 34, speed: [1, 5.5], life: [120, 200], size: [3, 7], col: GOLD, drag: 0.97 });
  }
  if (bank < CHIPS[0]) flashNote("Out of chips — Deal for a fresh stack.");
  pending = null;
  updateButtons();
}

function clearBet() {
  if (pending || phase !== "bet") return;
  bet = 0;
  saveState();
  updateButtons();
}

function addChip(v) {
  if (pending || phase !== "bet") return;
  if (bet + v > maxBet()) { flashNote("Not enough chips for that."); return; }
  bet += v;
  saveState();
  updateButtons();
}

// The controls are drawn on the felt, between the dealer's and the player's hand.
const TABLE_BUTTONS = [
  { id: "deal",   label: "Deal",   primary: true, run: () => deal() },
  { id: "hit",    label: "Hit",    run: () => hit() },
  { id: "stand",  label: "Stand",  run: () => stand() },
  { id: "double", label: "Double", run: () => doubleDown() },
  { id: "clear",  label: "Clear",  run: () => clearBet() },
];

function canAct(id) {
  if (pending) return false;
  if (id === "deal") return phase === "bet";
  if (id === "hit" || id === "stand") return phase === "player";
  if (id === "double") return phase === "player" && player.length === 2 && bank >= stake;
  if (id === "clear") return phase === "bet" && bet > 0;
  return false;
}

function updateButtons() {}           // kept for the call sites; buttons read canAct() every frame

// ---- persistence ----

function saveState() { saveSettings("blackjack_state", { decks, bank, bet }); }

function loadState() {
  const d = loadSettings("blackjack_state");
  if ([1, 2, 6].includes(d.decks)) decks = d.decks;
  if (typeof d.bank === "number" && isFinite(d.bank) && d.bank >= 0) bank = Math.floor(d.bank);
  if (typeof d.bet === "number" && isFinite(d.bet) && d.bet >= 0) bet = Math.floor(d.bet / 10) * 10;
}

// ---- stage layout ----
// Everything is placed in stage units and drawn inside translate+scale, so the
// table looks the same on a phone and on a 4K screen.

let G = null;

function layout() {
  const ui = document.getElementById("ui-overlay");
  const uiH = ui ? ui.offsetHeight : 56;
  const availH = Math.max(160, height - uiH);
  const portrait = width / availH < 1.15;
  const VW = portrait ? 640 : 1000, VH = portrait ? 1000 : 640;
  const S = Math.min(width / VW, availH / VH);
  const base = { portrait, VW, VH, S, ox: (width - VW * S) / 2, oy: uiH + (availH - VH * S) / 2 };
  G = portrait ? {
    ...base,
    table: { x: 10, y: 10, w: 620, h: 980, r: 200 },
    dealerY: 112, playerY: 566, bannerY: 354, arcY: 488, arcR: 250,
    btn: { y: 252, w: 98, h: 42, gap: 6, size: 15 },
    chipY: 934, shoe: { x: 494, y: 42 },
    bank: { x: 46, y: 792 }, bet: { x: 444, y: 792 }, stack: { x: 556, y: 650 },
    logoSize: 34,
  } : {
    ...base,
    table: { x: 70, y: 12, w: 860, h: 616, r: 240 },
    dealerY: 44, playerY: 398, bannerY: 272, arcY: 358, arcR: 330,
    btn: { y: 177, w: 112, h: 46, gap: 10, size: 18 },
    chipY: 564, shoe: { x: 736, y: 30 },
    bank: { x: 176, y: 492 }, bet: { x: 684, y: 492 }, stack: { x: 806, y: 452 },
    logoSize: 44,
  };
}

function toScreen(x, y) { return { x: G.ox + x * G.S, y: G.oy + y * G.S }; }
function mouseStage() { return { x: (mouseX - G.ox) / G.S, y: (mouseY - G.oy) / G.S }; }

function chipCenter(i) { return { x: G.VW / 2 + (i - 1.5) * 86, y: G.chipY }; }
const CHIP_R = 29;

function handTarget(n, i, y) {
  const gap = Math.min(CW * 0.7, (G.VW * 0.62 - CW) / Math.max(1, n - 1));
  const width = CW + (n - 1) * gap;
  return { x: (G.VW - width) / 2 + i * gap, y };
}

// ---- drawing helpers ----
// Anything that takes `p` (the window in the game, an instance in the info
// modal) so the same card art serves both. Raw canvas-context work (gradients,
// glow) lives in small save/restore blocks that never call p5 style functions,
// so p5's cached fill/stroke state can't go stale.

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// rounded rect path with individual corner radii
function rrPath(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function glowOn(col, blur) { drawingContext.shadowColor = rgb(col); drawingContext.shadowBlur = blur * G.S * (window.devicePixelRatio || 1); }
function glowOff() { drawingContext.shadowBlur = 0; drawingContext.shadowColor = "transparent"; }

// text along a smile-shaped arc whose lowest point is at (cx, cy + r)
function arcText(str, cx, cy, r, size, col, track = 0) {
  textFont(SERIF); textStyle(BOLD); textSize(size); textAlign(CENTER, CENTER);
  const widths = [...str].map(ch => textWidth(ch) + track);
  const total = widths.reduce((a, b) => a + b, 0) / r;
  let a = Math.PI / 2 + total / 2;
  noStroke(); fill(...col);
  [...str].forEach((ch, i) => {
    const step = widths[i] / r;
    a -= step / 2;
    push();
    translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    rotate(a - Math.PI / 2);
    text(ch, 0, 0);
    pop();
    a -= step / 2;
  });
}

// ---- cards ----

function drawSuit(p, s, cx, cy, size, col) {
  p.noStroke();
  p.fill(...col);
  if (s === 0) {          // spade
    p.circle(cx - size * 0.24, cy + size * 0.1, size * 0.52);
    p.circle(cx + size * 0.24, cy + size * 0.1, size * 0.52);
    p.triangle(cx - size * 0.49, cy + size * 0.04, cx + size * 0.49, cy + size * 0.04, cx, cy - size * 0.52);
    p.triangle(cx, cy + size * 0.1, cx - size * 0.2, cy + size * 0.5, cx + size * 0.2, cy + size * 0.5);
  } else if (s === 1) {   // heart
    p.circle(cx - size * 0.24, cy - size * 0.14, size * 0.52);
    p.circle(cx + size * 0.24, cy - size * 0.14, size * 0.52);
    p.triangle(cx - size * 0.49, cy - size * 0.06, cx + size * 0.49, cy - size * 0.06, cx, cy + size * 0.5);
  } else if (s === 2) {   // diamond
    p.quad(cx, cy - size * 0.52, cx + size * 0.38, cy, cx, cy + size * 0.52, cx - size * 0.38, cy);
  } else {                // club
    p.circle(cx, cy - size * 0.2, size * 0.44);
    p.circle(cx - size * 0.23, cy + size * 0.1, size * 0.44);
    p.circle(cx + size * 0.23, cy + size * 0.1, size * 0.44);
    p.triangle(cx, cy, cx - size * 0.2, cy + size * 0.5, cx + size * 0.2, cy + size * 0.5);
  }
}

const RANK = [null, "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// pip layouts: [column (-1, 0, 1), row 0..1]
const PIPS = (() => {
  const six = [[-1, 0], [1, 0], [-1, .5], [1, .5], [-1, 1], [1, 1]];
  const eight = [[-1, 0], [1, 0], [-1, 1 / 3], [1, 1 / 3], [-1, 2 / 3], [1, 2 / 3], [-1, 1], [1, 1]];
  return {
    2: [[0, 0], [0, 1]], 3: [[0, 0], [0, .5], [0, 1]],
    4: [[-1, 0], [1, 0], [-1, 1], [1, 1]], 5: [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, .5]],
    6: six, 7: [...six, [0, .25]], 8: [...six, [0, .25], [0, .75]],
    9: [...eight, [0, .5]], 10: [...eight, [0, 1 / 6], [0, 5 / 6]],
  };
})();

// face-up card at (x, y) = top-left; sx squeezes it horizontally for the flip
function drawCardFace(p, x, y, r, s, sx = 1) {
  const u = CW / 58;
  const col = (s === 1 || s === 2) ? [200, 28, 44] : [28, 26, 36];
  p.push();
  p.translate(x + CW / 2, y);
  p.scale(Math.max(0.02, sx), 1);
  p.stroke(70, 56, 36, 190); p.strokeWeight(Math.max(1, u * 0.9));
  p.fill(...CREAM);
  p.rect(-CW / 2, 0, CW, CH, CW * 0.09);
  if (sx >= 0.3) {
    // corner index, top-left and (turned around) bottom-right
    for (let k = 0; k < 2; k++) {
      p.push();
      if (k) { p.translate(0, CH); p.rotate(Math.PI); }
      p.noStroke(); p.fill(...col);
      p.textFont(SERIF); p.textStyle(p.BOLD); p.textAlign(p.CENTER, p.TOP);
      p.textSize((r === 10 ? 11.5 : 15) * u);
      p.text(RANK[r], -CW / 2 + 8 * u, 3.5 * u);
      drawSuit(p, s, -CW / 2 + 8 * u, 24 * u, 8.5 * u, col);
      p.pop();
    }
    p.textAlign(p.CENTER, p.CENTER);
    if (r === 1) {
      drawSuit(p, s, 0, CH / 2, 32 * u, col);
    } else if (r > 10) {
      // court card: framed panel with a big letter and a suit at each end
      p.stroke(...col, 150); p.strokeWeight(Math.max(1, u * 1.2)); p.fill(250, 234, 190);
      p.rect(-CW * 0.24, CH * 0.14, CW * 0.48, CH * 0.72, 4 * u);
      p.noStroke(); p.fill(...col);
      p.textFont(SERIF); p.textStyle(p.BOLD); p.textSize(34 * u);
      p.text(RANK[r], 0, CH / 2 + 1 * u);
      drawSuit(p, s, 0, CH * 0.14 + 12 * u, 11 * u, col);
      p.push(); p.translate(0, CH); p.rotate(Math.PI); drawSuit(p, s, 0, CH * 0.14 + 12 * u, 11 * u, col); p.pop();
    } else {
      for (const [cx, ry] of PIPS[r]) {
        const px = cx * CW * 0.19, py = CH * (0.22 + ry * 0.56);
        p.push(); p.translate(px, py); if (ry > 0.5) p.rotate(Math.PI);
        drawSuit(p, s, 0, 0, 10.5 * u, col);
        p.pop();
      }
    }
  }
  p.pop();
}

// lines at ±45° clipped to a rectangle (keeps us out of ctx.clip, see above)
function latticeLines(p, x0, y0, x1, y1, step) {
  for (let k = x0 - y1; k <= x1 - y0; k += step) {          // down-right
    const ax = Math.max(x0, y0 + k), bx = Math.min(x1, y1 + k);
    if (ax < bx) p.line(ax, ax - k, bx, bx - k);
  }
  for (let k = x0 + y0; k <= x1 + y1; k += step) {          // up-right
    const ax = Math.max(x0, k - y1), bx = Math.min(x1, k - y0);
    if (ax < bx) p.line(ax, k - ax, bx, k - bx);
  }
}

function drawCardBack(p, x, y, sx = 1) {
  const u = CW / 58;
  p.push();
  p.translate(x + CW / 2, y);
  p.scale(Math.max(0.02, sx), 1);
  p.stroke(70, 56, 36, 190); p.strokeWeight(Math.max(1, u * 0.9));
  p.fill(...CREAM);
  p.rect(-CW / 2, 0, CW, CH, CW * 0.09);
  if (sx >= 0.3) {
    const m = 5 * u;
    p.noStroke(); p.fill(168, 22, 44);
    p.rect(-CW / 2 + m, m, CW - 2 * m, CH - 2 * m, 4 * u);
    p.stroke(226, 96, 112, 200); p.strokeWeight(Math.max(0.8, u));
    latticeLines(p, -CW / 2 + m + 1, m + 1, CW / 2 - m - 1, CH - m - 1, 9 * u);
    // medallion
    p.stroke(...GOLD); p.strokeWeight(Math.max(1, 1.4 * u)); p.fill(168, 22, 44);
    p.quad(0, CH / 2 - 17 * u, 12 * u, CH / 2, 0, CH / 2 + 17 * u, -12 * u, CH / 2);
    p.noStroke(); p.fill(...GOLD);
    p.circle(0, CH / 2, 6 * u);
  }
  p.pop();
}

// ---- chips ----

function drawChip(p, cx, cy, rad, v, alpha = 255) {
  const base = CHIP_COL[v] || GOLD;
  const a = alpha / 255;
  p.noStroke();
  p.fill(0, 0, 0, 70 * a); p.circle(cx + 1.5, cy + 3.5, rad * 2);
  p.fill(...base, alpha); p.circle(cx, cy, rad * 2);
  // white edge spots
  p.fill(250, 248, 240, alpha);
  for (let k = 0; k < 6; k++) {
    p.push(); p.translate(cx, cy); p.rotate(k * Math.PI / 3 + 0.26);
    p.rect(-rad * 0.14, -rad * 1.0, rad * 0.28, rad * 0.3, rad * 0.04);
    p.pop();
  }
  // inner face
  p.fill(...base.map(c => Math.min(255, c * 0.82 + 20)), alpha); p.circle(cx, cy, rad * 1.34);
  p.noFill(); p.stroke(250, 248, 240, 210 * a); p.strokeWeight(Math.max(1, rad * 0.06));
  p.circle(cx, cy, rad * 1.34);
  p.noStroke(); p.fill(250, 248, 240, alpha);
  p.textFont(SERIF); p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD);
  p.textSize(rad * (v >= 100 ? 0.56 : 0.66));
  p.text(v, cx, cy + rad * 0.04);
  // gloss
  p.noFill(); p.stroke(255, 255, 255, 70 * a); p.strokeWeight(rad * 0.1); p.strokeCap(p.ROUND);
  p.arc(cx, cy, rad * 1.7, rad * 1.7, Math.PI * 1.08, Math.PI * 1.55);
}

// greedy chip breakdown of an amount, largest first, at most `max` chips
function chipBreakdown(amount, max = 11) {
  const out = [];
  for (let i = CHIPS.length - 1; i >= 0; i--) {
    while (amount >= CHIPS[i] && out.length < max) { out.push(CHIPS[i]); amount -= CHIPS[i]; }
  }
  return out;
}

// ---- table pieces ----

let _carpet = null;
function makeCarpet() {
  const d = window.devicePixelRatio || 1, n = 96;
  const c = document.createElement("canvas");
  c.width = c.height = n * d;
  const x = c.getContext("2d");
  x.scale(d, d);
  x.fillStyle = "#2a0b30"; x.fillRect(0, 0, n, n);
  const diamond = (cx, cy, r, fill, stroke, lw) => {
    x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
  };
  diamond(n / 2, n / 2, n / 2, null, "rgba(40,170,170,.55)", 2);
  diamond(n / 2, n / 2, n / 3.2, null, "rgba(236,86,170,.45)", 1.5);
  diamond(n / 2, n / 2, n / 9, "rgba(244,200,92,.8)");
  for (const [cx, cy] of [[0, 0], [n, 0], [0, n], [n, n]]) { diamond(cx, cy, n / 5, "rgba(40,170,170,.35)"); diamond(cx, cy, n / 11, "rgba(244,200,92,.7)"); }
  for (const [cx, cy] of [[n / 2, 0], [n / 2, n], [0, n / 2], [n, n / 2]]) diamond(cx, cy, n / 14, "rgba(236,86,170,.6)");
  _carpet = drawingContext.createPattern(c, "repeat");
  try { _carpet.setTransform(new DOMMatrix().scale(1 / d)); } catch (e) { /* older browsers: slightly smaller tile */ }
}

function drawCarpet() {
  const ctx = drawingContext;
  ctx.save();
  ctx.fillStyle = _carpet || "#2a0b30";
  ctx.fillRect(0, 0, width, height);
  // light pool over the table, dark towards the edges
  const g = ctx.createRadialGradient(width / 2, height * 0.5, Math.min(width, height) * 0.2, width / 2, height * 0.5, Math.max(width, height) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,0,12,0.78)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawTable() {
  const { x, y, w, h, r } = G.table;
  const ctx = drawingContext;
  const rad = (d) => [Math.max(4, 22 - d), Math.max(4, 22 - d), Math.max(4, r - d), Math.max(4, r - d)];
  ctx.save();
  // wooden rail with a drop shadow
  ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = 40 * G.S; ctx.shadowOffsetY = 14 * G.S;
  let g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#9a5a26"); g.addColorStop(0.5, "#6a3513"); g.addColorStop(1, "#3c1d0a");
  ctx.fillStyle = g; rrPath(ctx, x, y, w, h, ...rad(0)); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // brass inlay
  ctx.strokeStyle = rgb(GOLD, 0.95); ctx.lineWidth = 3; rrPath(ctx, x + 20, y + 20, w - 40, h - 40, ...rad(20)); ctx.stroke();
  ctx.strokeStyle = rgb(GOLD_DK, 0.9); ctx.lineWidth = 1.2; rrPath(ctx, x + 25, y + 25, w - 50, h - 50, ...rad(25)); ctx.stroke();
  // padded leather edge
  ctx.fillStyle = "#1a0f0c"; rrPath(ctx, x + 29, y + 29, w - 58, h - 58, ...rad(29)); ctx.fill();
  // felt
  g = ctx.createRadialGradient(x + w / 2, y + h * 0.42, 20, x + w / 2, y + h * 0.42, Math.max(w, h) * 0.62);
  g.addColorStop(0, "#27a066"); g.addColorStop(0.55, "#12794a"); g.addColorStop(1, "#08482c");
  ctx.fillStyle = g; rrPath(ctx, x + 38, y + 38, w - 76, h - 76, ...rad(38)); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // printed felt: gold arcs + neon logo
  const cx = G.VW / 2, small = G.portrait ? 0.78 : 1;
  arcText("BLACKJACK PAYS 3 TO 2", cx, G.arcY - G.arcR, G.arcR, 24 * small, GOLD, 4);
  arcText("DEALER MUST DRAW TO 16 AND STAND ON ALL 17s", cx, G.arcY - G.arcR, G.arcR + 34 * small, 13.5 * small, [226, 206, 150], 2);
  // a thin gold "insurance" line across the felt
  noFill(); stroke(...GOLD, 70); strokeWeight(1.5);
  arc(cx, G.arcY - G.arcR, 2 * (G.arcR - 26), 2 * (G.arcR - 26), 0.2 * Math.PI, 0.8 * Math.PI);

  // neon sign in the middle of the felt (the result banner takes its place after a round)
  if (result) return;
  textFont(SERIF); textStyle(BOLDITALIC); textAlign(CENTER, CENTER); textSize(G.logoSize);
  const flick = 0.9 + 0.1 * Math.sin(frameCount * 0.09) * Math.sin(frameCount * 0.023);
  glowOn(NEON_PINK, 22);
  noFill(); stroke(...NEON_PINK, 255 * flick); strokeWeight(3.5);
  text("Blackjack", cx, G.bannerY - 6);
  glowOff();
  noStroke(); fill(255, 214, 240, 235 * flick); text("Blackjack", cx, G.bannerY - 6);
  textStyle(BOLD); textSize(G.logoSize * 0.3);
  glowOn(NEON_CYAN, 14);
  fill(...NEON_CYAN, 230 * flick); text("♠   T W E N T Y - O N E   ♥", cx, G.bannerY + G.logoSize * 0.62);
  glowOff();
}

function drawShoe() {
  const { x, y } = G.shoe;
  const bw = CW + 30, bh = CH + 26;
  // dealing shoe: dark wooden box, the cards peek out of the top, brass front plate
  noStroke(); fill(0, 0, 0, 90); rect(x - 15 + 4, y - 12 + 7, bw, bh, 10);
  fill(44, 24, 12); stroke(...GOLD, 200); strokeWeight(2); rect(x - 15, y - 12, bw, bh, 10);
  for (let k = 3; k >= 0; k--) drawCardBack(window, x + k * 2, y - 4 + k * 3);
  const fy = y + CH * 0.62;
  noStroke(); fill(60, 32, 14); rect(x - 15, fy, bw, y - 12 + bh - fy, 0, 0, 10, 10);
  stroke(...GOLD, 220); strokeWeight(2); line(x - 15, fy, x - 15 + bw, fy);
  noStroke(); fill(...GOLD); textFont(SERIF); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(12);
  const label = shoe.length ? shoe.length + " CARDS" : decks + (decks === 1 ? " DECK" : " DECKS");
  text(label, x + CW / 2, fy + (y - 12 + bh - fy) / 2);
}

function drawHand(cards, y) {
  cards.forEach((c, i) => {
    if (frameCount < c.at) return;
    const t = handTarget(cards.length, i, y);
    c.x += (t.x - c.x) * 0.2;
    c.y += (t.y - c.y) * 0.2;
    // card shadow
    noStroke(); fill(0, 0, 0, 80); rect(c.x + 3, c.y + 5, CW, CH, CW * 0.09);
    let faceUp = c.up, sx = 1;
    if (c.flip !== null) {
      const f = (frameCount - c.flip) / FLIP_FRAMES;
      if (f >= 1) { c.up = true; c.flip = null; faceUp = true; }
      else { sx = Math.abs(1 - 2 * f); faceUp = f >= 0.5; }
    }
    if (faceUp) drawCardFace(window, c.x, c.y, c.r, c.s, sx);
    else drawCardBack(window, c.x, c.y, sx);
  });
}

// brass nameplate with the hand's total on a black LED chip
function drawTotal(label, cards, y) {
  const x = G.portrait ? 62 : 138;
  const seen = visible(cards);
  textFont(SERIF); textStyle(BOLD); textSize(15); textAlign(LEFT, CENTER);
  const lbl = label.toUpperCase();
  const lw = textWidth(lbl) + 26;
  noStroke(); fill(0, 0, 0, 90); rect(x + 2, y + 3, lw, 30, 6);
  fill(...GOLD_DK); rect(x, y, lw, 30, 6);
  fill(...GOLD); rect(x + 2, y + 2, lw - 4, 26, 5);
  fill(50, 28, 6); text(lbl, x + 13, y + 15.5);
  if (!seen.length) return;
  const t = handTotal(seen);
  const txt = String(t.v) + (t.soft && t.v < 21 ? " soft" : "");
  const bust = t.v > 21, top = t.v === 21;
  textFont(MONO); textSize(20);
  const bw = textWidth(txt) + 22;
  fill(8, 8, 10); stroke(...GOLD, 160); strokeWeight(1.5); rect(x + lw + 8, y, bw, 30, 6);
  noStroke();
  const col = bust ? NEON_RED : top ? [120, 255, 160] : [255, 176, 40];
  glowOn(col, 8); fill(...col); textAlign(CENTER, CENTER);
  text(txt, x + lw + 8 + bw / 2, y + 16);
  glowOff();
}

// brass plaque with a glowing LED readout
function drawPlaque(x, y, label, value, col) {
  const w = 140, h = 50;
  noStroke(); fill(0, 0, 0, 90); rect(x + 2, y + 4, w, h, 8);
  fill(...GOLD_DK); rect(x, y, w, h, 8);
  fill(...GOLD); rect(x + 2, y + 2, w - 4, h - 4, 7);
  fill(10, 10, 12); rect(x + 6, y + 14, w - 12, h - 20, 5);
  textFont(SERIF); textStyle(BOLD); textAlign(CENTER, CENTER); textSize(11); fill(50, 28, 6);
  text(label, x + w / 2, y + 8);
  textFont(MONO); textSize(24); textAlign(RIGHT, CENTER);
  const str = String(Math.max(0, value)).padStart(5, "0");
  fill(...col, 30); text("88888", x + w - 12, y + 33);
  glowOn(col, 8); fill(...col); text(str, x + w - 12, y + 33);
  glowOff();
}

function drawBetStack() {
  const amount = phase === "bet" ? bet : stake;
  const chips = chipBreakdown(amount);
  const { x, y } = G.stack;
  // betting circle printed on the felt
  noFill(); stroke(...GOLD, 150); strokeWeight(2); circle(x, y - 6, 78);
  stroke(...GOLD, 70); strokeWeight(1); circle(x, y - 6, 66);
  chips.forEach((v, k) => drawChip(window, x, y - k * 5.5, 25, v));
}

function drawResult() {
  if (!result) return;
  const t = frameCount - result.t;
  const k = Math.min(1, t / 14);
  const grow = 1 + Math.sin(k * Math.PI) * 0.12 - (1 - k) * 0.25;
  const col = result.tone === "win" ? [255, 220, 90] : result.tone === "lose" ? NEON_RED : NEON_CYAN;
  const sub = result.tone === "push" ? "BET RETURNED"
    : (result.net > 0 ? "+" : "−") + Math.abs(result.net) + " CHIPS";
  const cx = G.VW / 2, cy = G.bannerY;
  push();
  translate(cx, cy); scale(grow); translate(-cx, -cy);

  if (result.tone === "win") {          // slowly turning starburst
    push(); translate(cx, cy); rotate(frameCount * 0.004);
    noStroke();
    for (let i = 0; i < 20; i++) {
      fill(...GOLD, i % 2 ? 26 : 50);
      rotate(Math.PI / 10);
      triangle(0, 0, -34, -300, 34, -300);
    }
    pop();
  }
  const w = G.portrait ? 340 : 380, h = 84;
  noStroke(); fill(0, 0, 0, 110); rect(cx - w / 2 + 3, cy - h / 2 + 7, w, h, 16);
  fill(...GOLD_DK); rect(cx - w / 2, cy - h / 2, w, h, 16);
  fill(...GOLD); rect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6, 14);
  fill(12, 8, 18); rect(cx - w / 2 + 9, cy - h / 2 + 9, w - 18, h - 18, 10);
  textFont(SERIF); textAlign(CENTER, CENTER); textStyle(BOLDITALIC); textSize(G.portrait ? 30 : 36);
  glowOn(col, 18);
  fill(...col); text(result.text.toUpperCase(), cx, cy - 10);
  glowOff();
  textFont(MONO); textStyle(BOLD); textSize(16); fill(...CREAM);
  text(sub, cx, cy + 22);
  pop();
}

function buttonRect(i) {
  const b = G.btn, n = TABLE_BUTTONS.length;
  const total = n * b.w + (n - 1) * b.gap;
  return { x: (G.VW - total) / 2 + i * (b.w + b.gap), y: b.y, w: b.w, h: b.h };
}

let pressedBtn = null;

function buttonAt(m) {
  for (let i = 0; i < TABLE_BUTTONS.length; i++) {
    const r = buttonRect(i);
    if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) return TABLE_BUTTONS[i];
  }
  return null;
}

// brass-and-green pushbuttons; the Deal button is solid gold
function drawTableButtons() {
  const m = mouseStage();
  const ctx = drawingContext;
  const over = buttonAt(m);
  TABLE_BUTTONS.forEach((b, i) => {
    const r = buttonRect(i);
    const on = canAct(b.id);
    const hot = on && over === b;
    const down = on && pressedBtn === b && mouseIsPressed;
    const dy = down ? 3 : hot ? -2 : 0;
    const top = b.primary ? ["#ffe58f", "#d7981e"] : ["#23895a", "#0d4a2e"];
    // drop shadow + face (raw context only; no p5 style calls in between)
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.38;
    ctx.fillStyle = "rgba(0,0,0,.55)"; rrPath(ctx, r.x + 2, r.y + 6 - (down ? 3 : 0), r.w, r.h, 11, 11, 11, 11); ctx.fill();
    ctx.fillStyle = rgb(GOLD_DK); rrPath(ctx, r.x, r.y + 3 + dy, r.w, r.h, 11, 11, 11, 11); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + r.h + dy);
    g.addColorStop(0, hot ? "#ffffff" : top[0]); g.addColorStop(hot ? 0.15 : 0, top[0]); g.addColorStop(1, top[1]);
    ctx.fillStyle = g; rrPath(ctx, r.x, r.y + dy, r.w, r.h, 11, 11, 11, 11); ctx.fill();
    ctx.strokeStyle = rgb(GOLD, 0.95); ctx.lineWidth = 2; rrPath(ctx, r.x + 1, r.y + 1 + dy, r.w - 2, r.h - 2, 10, 10, 10, 10); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(r.x + 12, r.y + 4 + dy); ctx.lineTo(r.x + r.w - 12, r.y + 4 + dy); ctx.stroke();
    ctx.restore();
    textFont(SERIF); textStyle(BOLD); textAlign(CENTER, CENTER); textSize(G.btn.size);
    noStroke();
    fill(...(b.primary ? [58, 31, 5] : [250, 232, 168]), on ? 255 : 110);
    text(b.label.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + dy + 1);
  });
  return over && canAct(over.id);
}

let overChip = false;

function drawChipsRow() {
  const room = maxBet() - bet;
  overChip = false;
  const m = mouseStage();
  CHIPS.forEach((v, i) => {
    const { x, y } = chipCenter(i);
    const ok = phase === "bet" && !pending && v <= room;
    const lift = ok && dist(m.x, m.y, x, y) < CHIP_R ? 5 : 0;
    drawChip(window, x, y - lift, CHIP_R, v, ok ? 255 : 80);
    if (lift) overChip = true;
  });
  drawPlaque(G.bank.x, G.bank.y, "BANK", bank, [255, 176, 40]);
  drawPlaque(G.bet.x, G.bet.y, phase === "bet" ? "BET" : "AT STAKE", phase === "bet" ? bet : stake, [120, 255, 160]);
}

// ---- p5 lifecycle ----

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("canvas-wrap");
  loadState();
  makeCarpet();
  layout();
  const sel = document.getElementById("preset-select");
  if (sel) sel.selectedIndex = Math.max(0, [6, 1, 2].indexOf(decks));
  bet = Math.min(bet, maxBet());
  updateButtons();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  if (pending && frameCount >= pending.at) {
    const fn = pending.fn;
    pending = null;
    fn();
    updateButtons();
  }

  layout();
  drawCarpet();

  push();
  translate(G.ox, G.oy);
  scale(G.S);
  drawTable();
  drawShoe();

  const plateUp = G.portrait ? 48 : 20;
  drawTotal("Dealer", dealer, G.dealerY - plateUp);
  drawTotal("You", player, G.playerY - plateUp);
  if (!dealer.length) {
    noStroke(); fill(...CREAM, 190); textFont(SERIF); textStyle(ITALIC); textAlign(CENTER, CENTER); textSize(G.portrait ? 20 : 24);
    text("place your bet, then deal", G.VW / 2, G.dealerY + CH / 2);
  }
  drawHand(dealer, G.dealerY);
  drawHand(player, G.playerY);

  drawBetStack();
  drawResult();
  drawChipsRow();
  const overBtn = drawTableButtons();
  pop();
  cursor(overBtn || overChip ? HAND : ARROW);

  drawParticles();

  if (result) setStatus(result.text + (result.tone === "push" ? "" : " · " + (result.net > 0 ? "+" : "−") + Math.abs(result.net)), result.tone === "win" ? "solved" : result.tone === "lose" ? "dead" : null);
  else if (phase === "bet") setStatus(bank < CHIPS[0] ? "broke — deal for a fresh stack" : "place your bet", null);
  else setStatus(phase === "player" ? "your move" : "dealer's turn", null);
}

function mousePressed(e) {
  // only clicks on the table itself, not on the bar's buttons
  if (!e || !e.target || e.target.tagName !== "CANVAS" || !G) return;
  const m = mouseStage();
  const b = buttonAt(m);
  if (b) {
    pressedBtn = b;
    if (canAct(b.id)) b.run();
    return false;
  }
  CHIPS.forEach((v, i) => {
    const { x, y } = chipCenter(i);
    if (dist(m.x, m.y, x, y) <= CHIP_R + 4) addChip(v);
  });
  return false;
}

function mouseReleased() { pressedBtn = null; }

function keyPressed() {
  const k = key.toLowerCase();
  if (k === " " || keyCode === ENTER || k === "n") { deal(); return false; }
  if (k === "h") { hit(); return false; }
  if (k === "s") { stand(); return false; }
  if (k === "d") { doubleDown(); return false; }
  if (k === "c") { clearBet(); return false; }
}

// ---- info modal animation ----
// A looping hand on a 440×280 canvas: you hold 10 + 6, hit, an Ace-less 5
// lands for exactly 21, the total pops green and the dealer's hole card flips.

function infoAnim(p, w, h, frame) {
  const saved = [CW, CH];
  CW = 58; CH = 82;                     // small cards for the small canvas
  try { infoAnimInner(p, w, h, frame); } finally { [CW, CH] = saved; }
}

function infoAnimInner(p, w, h, frame) {
  const LOOP = 240;
  const t = frame % LOOP;
  p.background(24, 10, 30);
  p.noStroke(); p.fill(14, 108, 68); p.rect(10, 10, w - 20, h - 20, 18);
  p.stroke(...GOLD, 200); p.strokeWeight(2); p.noFill(); p.rect(10, 10, w - 20, h - 20, 18);

  const cw = CW, ch = CH;
  const place = (n, i, y) => {
    const gap = 46, width = cw + (n - 1) * gap;
    return { x: (w - width) / 2 + i * gap, y };
  };
  const slide = (target, from, start, now) => {
    const k = Math.min(1, Math.max(0, (now - start) / 16));
    const e = easeInOutQuad(k);
    return { x: p.lerp(from.x, target.x, e), y: p.lerp(from.y, target.y, e), shown: now >= start };
  };
  const shoe = { x: w - 80, y: 18 };

  p.textFont(SERIF);
  p.textAlign(p.LEFT, p.CENTER); p.textStyle(p.BOLD); p.textSize(12); p.noStroke(); p.fill(...GOLD);
  p.text("DEALER", 26, 26);
  p.text("YOU", 26, 150);

  // dealer: 9 up, hole card flips at t=170
  const dealerCards = [[9, 2, true], [8, 0, false]];
  dealerCards.forEach(([r, s, up], i) => {
    const pos = place(2, i, 40);
    const sl = slide(pos, shoe, 4 + i * 8, t);
    if (!sl.shown) return;
    if (i === 1) {
      const f = Math.min(1, Math.max(0, (t - 170) / 14));
      const sx = Math.abs(1 - 2 * f);
      if (f >= 0.5) drawCardFace(p, sl.x, sl.y, r, s, sx); else drawCardBack(p, sl.x, sl.y, sx);
    } else drawCardFace(p, sl.x, sl.y, r, s, 1);
  });

  // player: K♠, 6♥, then 5♣ on the hit
  const hand = [[13, 0], [6, 1], [5, 3]];
  const hitAt = 90;
  hand.forEach(([r, s], i) => {
    const n = t >= hitAt ? 3 : 2;
    const pos = place(n, i, 160);
    const start = i === 0 ? 16 : i === 1 ? 24 : hitAt;
    const sl = slide(pos, shoe, start, t);
    if (sl.shown) drawCardFace(p, sl.x, sl.y, r, s, 1);
  });

  p.textFont(SERIF);
  // hit / stand prompt before the hit, 21 badge after
  if (t >= 40 && t < hitAt) {
    const pulse = 1 + 0.06 * Math.sin(frame * 0.4);
    p.fill(...GOLD, 40); p.stroke(...GOLD, 230); p.strokeWeight(2);
    p.rect(w - 90 - 34 * pulse, 200 - 14 * pulse, 68 * pulse, 28 * pulse, 14);
    p.noStroke(); p.fill(...CREAM); p.textAlign(p.CENTER, p.CENTER); p.textSize(13);
    p.text("Hit", w - 90, 200);
    p.text("16", 120, 150);
  }
  if (t >= hitAt + 20) {
    const k = Math.min(1, (t - hitAt - 20) / 10);
    p.noStroke(); p.fill(120, 255, 160, 230 * k);
    p.rect(w - 112, 150 - 11, 72, 22, 11);
    p.fill(10, 40, 24, 255 * k); p.textAlign(p.CENTER, p.CENTER); p.textSize(14);
    p.text("21!", w - 76, 150);
    if (t < hitAt + 50) {
      p.noFill(); p.stroke(120, 255, 160, 200 * (1 - (t - hitAt - 20) / 30)); p.strokeWeight(2);
      p.rect(w - 112 - (t - hitAt - 20) * 0.4, 139 - (t - hitAt - 20) * 0.3, 72 + (t - hitAt - 20) * 0.8, 22 + (t - hitAt - 20) * 0.6, 14);
    }
  }
  if (t >= 190) {
    p.noStroke(); p.fill(...GOLD); p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(22);
    p.text("17 — you win", w / 2, 142);
  }
}
