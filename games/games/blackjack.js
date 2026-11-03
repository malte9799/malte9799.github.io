// Blackjack — beat the dealer to 21 without going over.
// Casino rules: the dealer stands on every 17, blackjack pays 3:2, you may
// double down on your first two cards. The shoe holds 1, 2 or 6 decks and is
// reshuffled once it runs low. Your chips persist between visits.

initGame({
  title: "Blackjack",
  tag: "hit · stand · beat the dealer",
  presets: [
    { label: "6 decks (casino)", values: [6] },
    { label: "1 deck",           values: [1] },
    { label: "2 decks",          values: [2] },
  ],
  buttons: [
    { id: "btn-deal",   label: "Deal",      primary: true, onClick: () => deal() },
    { id: "btn-hit",    label: "Hit",       onClick: () => hit() },
    { id: "btn-stand",  label: "Stand",     onClick: () => stand() },
    { id: "btn-double", label: "Double",    onClick: () => doubleDown() },
    { id: "btn-clear",  label: "Clear bet", onClick: () => clearBet() },
  ],
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

const W = 440, H = 440;
const CHIPS = [10, 50, 100, 500];
const START_BANK = 1000;
const CW = 58, CH = 82;               // card size
const SHOE_X = 374, SHOE_Y = 14;      // where cards fly in from
const DEALER_Y = 50, PLAYER_Y = 262;
const FLIP_FRAMES = 14;
const ARRIVE = 12;                    // frames until a dealt card counts as "seen"

let decks = 6;
let bank = START_BANK;
let bet = 50;                         // the bet chosen for the next round
let stake = 0;                        // what is riding on the current round (doubles with Double)

let shoe = [];
let needShuffle = true;
let player = [], dealer = [];
let phase = "bet";                    // "bet" (idle) | "player" | "dealer"
let result = null;                    // { text, net, tone: "win" | "lose" | "push" }
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
  hand.push({ r: c.r, s: c.s, x: SHOE_X, y: SHOE_Y, at, up, flip: null });
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
  result = { text, net: payout - stake, tone };
  phase = "bet";
  bet = Math.min(bet, maxBet());
  saveState();

  if (tone === "win") {
    celebrate(pNat ? 2 : 1);
    spawnBurst(W / 2, 172, { count: 26, speed: [1, 4.5], life: [120, 200], size: [3, 6], col: PAL.sun, drag: 0.97 });
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

function updateButtons() {
  const set = (id, on) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = !on;
    b.style.opacity = on ? "" : "0.4";
  };
  const idle = !pending;
  set("btn-deal", idle && phase === "bet");
  set("btn-hit", idle && phase === "player");
  set("btn-stand", idle && phase === "player");
  set("btn-double", idle && phase === "player" && player.length === 2 && bank >= stake);
  set("btn-clear", idle && phase === "bet" && bet > 0);
}

// ---- persistence ----

function saveState() { saveSettings("blackjack_state", { decks, bank, bet }); }

function loadState() {
  const d = loadSettings("blackjack_state");
  if ([1, 2, 6].includes(d.decks)) decks = d.decks;
  if (typeof d.bank === "number" && isFinite(d.bank) && d.bank >= 0) bank = Math.floor(d.bank);
  if (typeof d.bet === "number" && isFinite(d.bet) && d.bet >= 0) bet = Math.floor(d.bet / 10) * 10;
}

// ---- drawing ----

// Everything below takes the sketch `p` (the window in the game, an instance in
// the info modal / home preview) so the same card art serves all three.

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

// face-up card; sx squeezes it horizontally for the flip
function drawCardFace(p, x, y, r, s, sx = 1) {
  const w = CW * sx;
  const col = (s === 1 || s === 2) ? PAL.rose : PAL.onLight;
  const cx = x + CW / 2;
  p.stroke(...PAL.lineHi, 120); p.strokeWeight(1);
  p.fill(250, 247, 240);
  p.rect(cx - w / 2, y, w, CH, 8);
  if (sx < 0.35) return;
  p.noStroke(); p.fill(...col);
  p.textAlign(p.LEFT, p.TOP); p.textStyle(p.BOLD);
  p.textSize(r === 10 ? 15 : 17);
  p.text(RANK[r], cx - w / 2 + 6 * sx, y + 5);
  drawSuit(p, s, cx - w / 2 + 11 * sx, y + 31, 11 * sx, col);
  const big = r > 10 ? 34 : r === 1 ? 32 : 26;
  p.textAlign(p.CENTER, p.CENTER);
  if (r > 10) {
    p.textSize(30);
    p.text(RANK[r], cx + 6 * sx, y + CH / 2 + 12);
    drawSuit(p, s, cx + 9 * sx, y + CH / 2 - 14, 18 * sx, col);
  } else {
    drawSuit(p, s, cx + 5 * sx, y + CH / 2 + 8, big * sx, col);
  }
}

function drawCardBack(p, x, y, sx = 1) {
  const w = CW * sx, cx = x + CW / 2;
  p.stroke(...PAL.lineHi, 120); p.strokeWeight(1);
  p.fill(...PAL.lilac);
  p.rect(cx - w / 2, y, w, CH, 8);
  if (sx < 0.35) return;
  p.noFill(); p.stroke(...PAL.onDark, 150); p.strokeWeight(1.5);
  p.rect(cx - w / 2 + 5 * sx, y + 5, w - 10 * sx, CH - 10, 5);
  p.noStroke(); p.fill(...PAL.onDark, 120);
  p.quad(cx, y + CH / 2 - 15, cx + 11 * sx, y + CH / 2, cx, y + CH / 2 + 15, cx - 11 * sx, y + CH / 2);
}

function drawChip(p, cx, cy, rad, v, alpha = 255) {
  const col = { 10: PAL.sky, 50: PAL.rose, 100: PAL.mint, 500: PAL.lilac }[v] || PAL.sun;
  p.noStroke();
  p.fill(0, 0, 0, 40 * alpha / 255); p.circle(cx + 1, cy + 3, rad * 2);
  p.fill(...col, alpha); p.circle(cx, cy, rad * 2);
  // edge dashes
  p.stroke(...PAL.onLight, alpha * 0.55); p.strokeWeight(rad * 0.16); p.strokeCap(p.SQUARE);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    p.line(cx + Math.cos(a) * rad * 0.82, cy + Math.sin(a) * rad * 0.82, cx + Math.cos(a) * rad * 0.98, cy + Math.sin(a) * rad * 0.98);
  }
  p.noFill(); p.stroke(...PAL.onLight, alpha * 0.5); p.strokeWeight(1.2);
  p.circle(cx, cy, rad * 1.3);
  p.noStroke(); p.fill(...PAL.onLight, alpha);
  p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD);
  p.textSize(rad * (v >= 100 ? 0.62 : 0.72));
  p.text(v, cx, cy + 1);
}

function chipCenter(i) { return { x: 40 + i * 54, y: 398 }; }

function handTarget(n, i, y) {
  const gap = Math.min(40, (W - 160 - CW) / Math.max(1, n - 1));
  const width = CW + (n - 1) * gap;
  return { x: (W - width) / 2 + i * gap, y };
}

function drawHand(cards, y) {
  cards.forEach((c, i) => {
    if (frameCount < c.at) return;
    const t = handTarget(cards.length, i, y);
    c.x += (t.x - c.x) * 0.2;
    c.y += (t.y - c.y) * 0.2;
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

function drawTotal(label, cards, x, y, align) {
  const seen = visible(cards);
  textAlign(align, CENTER); textStyle(BOLD);
  textSize(12); fill(...PAL.muted);
  noStroke();
  const lbl = label.toUpperCase();
  text(lbl, x, y);
  if (!seen.length) return;
  const t = handTotal(seen);
  const lw = textWidth(lbl) + 10;
  const bx = align === LEFT ? x + lw : x - lw;
  const txt = String(t.v) + (t.soft && t.v < 21 ? " soft" : "");
  const bust = t.v > 21;
  textSize(14);
  const bw = textWidth(txt) + 16;
  fill(...(bust ? PAL.rose : t.v === 21 ? PAL.mint : PAL.panel), bust || t.v === 21 ? 220 : 255);
  rect(align === LEFT ? bx : bx - bw, y - 11, bw, 22, 11);
  fill(...(bust || t.v === 21 ? PAL.onLight : PAL.ink));
  textAlign(CENTER, CENTER);
  text(txt, align === LEFT ? bx + bw / 2 : bx - bw / 2, y + 0.5);
}

function drawShoe() {
  // stack of backs top-right + a small deck counter
  for (let k = 2; k >= 0; k--) drawCardBack(window, SHOE_X - 4 + k * 2 + 0, SHOE_Y + k * 2 - 2);
  noStroke(); fill(...PAL.muted); textAlign(CENTER, CENTER); textStyle(NORMAL); textSize(11);
  text(shoe.length ? shoe.length + " left" : decks + (decks === 1 ? " deck" : " decks"), SHOE_X + CW / 2 - 2, SHOE_Y + CH + 14);
}

function drawResult() {
  if (!result) return;
  const col = result.tone === "win" ? PAL.mint : result.tone === "lose" ? PAL.rose : PAL.sky;
  const sub = result.tone === "push" ? "bet returned"
    : (result.net > 0 ? "+" : "−") + Math.abs(result.net) + " chips";
  const cx = W / 2, cy = 172;
  noStroke();
  for (let k = 3; k >= 1; k--) { fill(...col, 12); rect(cx - 90 - k * 8, cy - 26 - k * 5, 180 + k * 16, 52 + k * 10, 24 + k * 4); }
  fill(...PAL.board, 235); rect(cx - 90, cy - 26, 180, 52, 18);
  noFill(); stroke(...col, 200); strokeWeight(1.5); rect(cx - 90, cy - 26, 180, 52, 18);
  noStroke(); fill(...col);
  textAlign(CENTER, CENTER); textStyle(BOLD); textSize(20);
  text(result.text, cx, cy - 8);
  fill(...PAL.muted); textStyle(NORMAL); textSize(13);
  text(sub, cx, cy + 14);
}

function drawChipsRow() {
  const room = maxBet() - bet;
  CHIPS.forEach((v, i) => {
    const { x, y } = chipCenter(i);
    const ok = phase === "bet" && !pending && v <= room;
    drawChip(window, x, y - (ok && dist(mouseX, mouseY, x, y) < 24 ? 3 : 0), 23, v, ok ? 255 : 70);
  });
  noStroke(); textAlign(RIGHT, CENTER); textStyle(NORMAL);
  fill(...PAL.muted); textSize(11); text("BANK", W - 16, 380);
  fill(...PAL.ink); textStyle(BOLD); textSize(20); text(bank, W - 16, 397);
  const shown = phase === "bet" ? bet : stake;
  fill(...PAL.muted); textStyle(NORMAL); textSize(11); text(phase === "bet" ? "BET" : "AT STAKE", W - 16, 420);
  fill(...PAL.sun); textStyle(BOLD); textSize(15); text(shown, W - 16, 435);
}

function drawTable() {
  noStroke(); fill(...PAL.well); rect(10, 10, W - 20, 346, 18);
  // faint centre line + arc, like the printed felt
  noFill(); stroke(...PAL.line, 160); strokeWeight(1.5);
  arc(W / 2, 156, 340, 190, 0.15 * PI, 0.85 * PI);
  noStroke(); fill(...PAL.dim); textAlign(CENTER, CENTER); textStyle(NORMAL); textSize(10);
  text("BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17", W / 2, 228);
}

// ---- p5 lifecycle ----

function setup() {
  const cnv = createCanvas(W, H);
  cnv.parent("canvas-wrap");
  loadState();
  const sel = document.getElementById("preset-select");
  if (sel) sel.selectedIndex = Math.max(0, [6, 1, 2].indexOf(decks));
  bet = Math.min(bet, maxBet());
  updateButtons();
}

function draw() {
  if (pending && frameCount >= pending.at) {
    const fn = pending.fn;
    pending = null;
    fn();
    updateButtons();
  }

  background(...PAL.board);
  drawTable();
  drawShoe();

  drawTotal("Dealer", dealer, 26, 28, LEFT);
  drawTotal("You", player, 26, 246, LEFT);
  if (!dealer.length) {
    noStroke(); fill(...PAL.dim); textAlign(CENTER, CENTER); textStyle(NORMAL); textSize(14);
    text("place your bet, then deal", W / 2, 150);
  }
  drawHand(dealer, DEALER_Y);
  drawHand(player, PLAYER_Y);

  drawResult();
  drawChipsRow();
  drawParticles();

  if (result) setStatus(result.text + (result.tone === "push" ? "" : " · " + (result.net > 0 ? "+" : "−") + Math.abs(result.net)), result.tone === "win" ? "solved" : result.tone === "lose" ? "dead" : null);
  else if (phase === "bet") setStatus(bank < CHIPS[0] ? "broke — deal for a fresh stack" : "place your bet", null);
  else setStatus(phase === "player" ? "your move" : "dealer's turn", null);
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  CHIPS.forEach((v, i) => {
    const { x, y } = chipCenter(i);
    if (dist(mouseX, mouseY, x, y) <= 25) addChip(v);
  });
  return false;
}

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
  const LOOP = 240;
  const t = frame % LOOP;
  p.background(...PAL.board);
  p.noStroke(); p.fill(...PAL.well); p.rect(10, 10, w - 20, h - 20, 18);

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

  p.textAlign(p.LEFT, p.CENTER); p.textStyle(p.BOLD); p.textSize(12); p.noStroke(); p.fill(...PAL.muted);
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

  // hit / stand prompt before the hit, 21 badge after
  if (t >= 40 && t < hitAt) {
    const pulse = 1 + 0.06 * Math.sin(frame * 0.4);
    p.fill(...PAL.lilac, 40); p.stroke(...PAL.lilac, 230); p.strokeWeight(2);
    p.rect(w - 90 - 34 * pulse, 200 - 14 * pulse, 68 * pulse, 28 * pulse, 14);
    p.noStroke(); p.fill(...PAL.ink); p.textAlign(p.CENTER, p.CENTER); p.textSize(13);
    p.text("Hit", w - 90, 200);
    p.text("16", 120, 150);
  }
  if (t >= hitAt + 20) {
    const k = Math.min(1, (t - hitAt - 20) / 10);
    p.noStroke(); p.fill(...PAL.mint, 230 * k);
    p.rect(w - 112, 150 - 11, 72, 22, 11);
    p.fill(...PAL.onLight, 255 * k); p.textAlign(p.CENTER, p.CENTER); p.textSize(14);
    p.text("21!", w - 76, 150);
    if (t < hitAt + 50) {
      p.noFill(); p.stroke(...PAL.mint, 200 * (1 - (t - hitAt - 20) / 30)); p.strokeWeight(2);
      p.rect(w - 112 - (t - hitAt - 20) * 0.4, 139 - (t - hitAt - 20) * 0.3, 72 + (t - hitAt - 20) * 0.8, 22 + (t - hitAt - 20) * 0.6, 14);
    }
  }
  if (t >= 190) {
    p.noStroke(); p.fill(...PAL.mint); p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(22);
    p.text("17 — you win", w / 2, 142);
  }
}
