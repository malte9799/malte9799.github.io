// Mäxchen (Lügenwürfel) for the multiplayer hub.
//
// Two players sit at the table, everybody else watches and rotates in between
// rounds: the winner stays, the loser goes to the back of the queue (classic
// rule: the loser of a round opens the next one). One round: your cup is
// rolled automatically (privately), then you either REROLL both dice (2 of
// those per turn) and finally announce a value that must beat the last
// announcement — a Ladder (3-2 … 6-5), a Pasch (1-1 … 6-6) or the top value
// Mäxle (2-1) — or you challenge the announcement *before* announcing. When
// challenged, the claimant reveals their true roll: the challenge only wins if
// the doubter's own roll actually beats the announced value, ties go to the
// announcer. The loser takes a chalk mark. An announced Mäxle can never be
// beaten — it can only be challenged. First to the target marks loses.
//
// The host's client owns the rules and the dice. Guests send intents, the
// host broadcasts the public state (which never contains dice) and privately
// sends each seat only their own roll. A reveal publishes both pairs. Seat
// rotation, gone players and host migration follow the tictactoe pattern
// (a round lost by a host change is voided without penalty, since the new
// host cannot reconstruct the hidden rolls).

import { shell } from "../hub-kit.js";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---- the value ladder, ascending strength ----
const RANKS = [];
for (let hi = 3; hi <= 6; hi++) for (let lo = hi - 1; lo >= 1; lo--) RANKS.push([hi, lo]);   // Ladder 3-2 … 6-5
for (let v = 1; v <= 6; v++) RANKS.push([v, v]);                                            // Pasch 1-1 … 6-6
RANKS.push([2, 1]);                                                                        // Mäxle
const TOP = RANKS.length - 1;                                                              // 20 = Mäxle
const CUPS = 3;                                     // 1 automatic roll + 2 rerolls per turn
const TARGETS = { 3: "Kurz", 5: "Standard", 9: "Marathon" };
const REVEAL_DELAY = 2700;

const rankShort = (r) => {
  const [a, b] = RANKS[r];
  return (a === 2 && b === 1) ? "2·1" : (a === b ? a + "·" + a : a + "-" + b);
};
const rankName = (r) => {
  const [a, b] = RANKS[r];
  if (a === 2 && b === 1) return "Mäxle";
  if (a === b) return "Pasch " + a + "er";
  return "Ladder " + a + "-" + b;
};
const rankOf = (a, b) => {
  const p = a > b ? [a, b] : [b, a];
  return RANKS.findIndex(([x, y]) => x === p[0] && y === p[1]);
};
const roll2 = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];

// ---- colours of the canvas table (the game's own look) ----
const CLR = {
  wood: [98, 63, 41], woodLo: [64, 41, 27], woodHi: [128, 85, 55],
  feltLo: [19, 53, 41], feltHi: [43, 95, 72],
  chalk: [238, 232, 212], red: [198, 62, 50], brass: [214, 176, 104],
  die: [246, 237, 213], dieLo: [212, 197, 166], pip: [56, 46, 38],
  amber: [236, 168, 74],
};

// ---- pure helpers ----
function freshRound(st) {
  Object.assign(st, {
    phase: "play", rounds: (st.rounds | 0) + 1, turn: 0, claim: null,
    rolls: [0, 0], cups: [0, 0], reveal: null, winnerSeat: null,
  });
}

function rotate(st) {
  const here = (id) => !st.gone.includes(id);
  const P = st.seats.filter(here);
  const Q = st.queue.filter(here);
  let seats = null, rest = null;
  if (P.length === 2) {
    if (st.winnerSeat != null) {
      const first = here(st.seats[1 - st.winnerSeat]) ? st.seats[1 - st.winnerSeat] : st.seats[st.winnerSeat]; // loser opens, else winner
      const second = P.find((x) => x !== first) || P[0];
      seats = [first, second];
    } else seats = [P[1], P[0]];                       // voided round: the old guest opens
    rest = Q;
  } else if (P.length === 1 && Q.length) {
    seats = [P[0], Q[0]]; rest = Q.slice(1);
  } else if (Q.length >= 2) {
    seats = [Q[0], Q[1]]; rest = Q.slice(2);
  }
  if (!seats || seats.length !== 2 || !seats.every(Boolean) || seats.some((x) => st.gone.includes(x))) return false;
  st.seats = seats; st.queue = rest || [];
  return true;
}

// a state that came over the wire is only used after it was rebuilt from scratch
function clean(d, ids) {
  if (!d || typeof d !== "object") return null;
  const id = (x) => (ids.has(x) ? x : null);
  const seats = Array.isArray(d.seats) ? d.seats.slice(0, 2).map(id) : [];
  if (seats.length !== 2 || !seats[0] || !seats[1]) return null;
  const n = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : hi < lo ? lo : lo);
  let claim = null;
  if (d.claim) {
    if (typeof d.claim !== "object" || !Number.isInteger(d.claim.rank) || d.claim.rank < 0 || d.claim.rank > TOP) return null;
    if (d.claim.seat !== 0 && d.claim.seat !== 1) return null;
    claim = { rank: d.claim.rank, seat: d.claim.seat };
  }
  const pts = {};
  for (const k of ids) pts[k] = n(d.pts ? d.pts[k] : 0, 0, 999);
  let reveal = null;
  if (d.reveal) {
    if (typeof d.reveal !== "object") return null;
    if (d.reveal.reason === "transfer") reveal = { reason: "transfer", d: null, loser: null };
    else {
      if (d.reveal.reason !== "challenge" && d.reveal.reason !== "forced") return null;
      if (d.reveal.loser !== 0 && d.reveal.loser !== 1) return null;
      const pair = (x) => Array.isArray(x) && x.length === 2 && x.every((v) => Number.isInteger(v) && v >= 1 && v <= 6) ? [x[0], x[1]] : null;
      const a = pair(d.reveal.d && d.reveal.d[0]), b = pair(d.reveal.d && d.reveal.d[1]);
      if (!(a && b)) return null;
      reveal = { reason: d.reveal.reason, d: [a, b], loser: d.reveal.loser };
    }
  }
  const rolls = Array.isArray(d.rolls) && d.rolls.length === 2 ? [n(d.rolls[0], 0, 9), n(d.rolls[1], 0, 9)] : [0, 0];
  const cups = Array.isArray(d.cups) && d.cups.length === 2 ? [n(d.cups[0], 0, CUPS), n(d.cups[1], 0, CUPS)] : [0, 0];
  return {
    phase: ["setup", "play", "reveal", "over"].includes(d.phase) ? d.phase : "setup",
    target: TARGETS[d.target] !== undefined ? d.target : 5,
    seats, queue: Array.isArray(d.queue) ? d.queue.map(id).filter(Boolean) : [],
    gone: Array.isArray(d.gone) ? d.gone.map(String) : [],
    pts, rounds: n(d.rounds, 0, 9999),
    turn: d.turn === 1 ? 1 : 0,
    rolls, cups, claim, reveal,
    winnerSeat: d.winnerSeat === 0 || d.winnerSeat === 1 ? d.winnerSeat : null,
    matchWinner: id(d.matchWinner),
  };
}

// ---- canvas painting ----

const PIPS = {
  1: [[0, 0]],
  2: [[-0.27, -0.27], [0.27, 0.27]],
  3: [[-0.27, -0.27], [0, 0], [0.27, 0.27]],
  4: [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]],
  5: [[-0.27, -0.27], [0.27, -0.27], [0, 0], [-0.27, 0.27], [0.27, 0.27]],
  6: [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0], [0.27, 0], [-0.27, 0.27], [0.27, 0.27]],
};

function drawDie(p, x, y, s, v, ang, alpha) {
  const A = alpha == null ? 255 : alpha;
  p.push();
  p.translate(x, y);
  p.rotate(ang || 0);
  p.noStroke();
  p.fill(0, 0, 0, 26 * (A / 255));                              // drop shadow
  p.rect(-s / 2 + 2, -s / 2 + 4, s, s, s * 0.22);
  p.fill(CLR.dieLo[0], CLR.dieLo[1], CLR.dieLo[2], A);          // side
  p.rect(-s / 2, -s / 2 + 2, s, s, s * 0.22);
  p.fill(CLR.die[0], CLR.die[1], CLR.die[2], A);                // top
  p.rect(-s / 2, -s / 2, s, s, s * 0.22);
  p.fill(255, 255, 255, 18 * (A / 255));                        // sheen
  p.rect(-s / 2, -s / 2, s, s * 0.42, s * 0.22, s * 0.22, 0, 0);
  p.fill(v === 1 ? CLR.red[0] : CLR.pip[0], v === 1 ? CLR.red[1] : CLR.pip[1], v === 1 ? CLR.red[2] : CLR.pip[2], A);
  for (const [fx, fy] of PIPS[v] || []) p.circle(fx * s, fy * s, s * 0.13);
  p.pop();
}

function drawCup(p, x, y, s, wig) {
  p.push();
  p.translate(x, y);
  p.rotate(wig ? Math.sin(p.frameCount * 0.15) * 0.06 : 0);
  p.noStroke();
  for (let i = 4; i >= 1; i--) {                            // soft floor shadow
    p.fill(0, 0, 0, i * 3);
    p.ellipse(0, s * 0.42 + i * 0.7, s * (0.9 + i * 0.05), s * (0.18 + i * 0.03));
  }
  p.fill(...CLR.dieLo);
  p.rect(-s * 0.36, -s * 0.42, s * 0.72, s * 0.84, s * 0.15);
  p.fill(...CLR.die);
  p.rect(-s * 0.36, -s * 0.46, s * 0.72, s * 0.84, s * 0.15);
  p.fill(...CLR.red);                                       // ribbon
  p.rect(-s * 0.36, s * 0.06, s * 0.72, s * 0.15, 0, 0, s * 0.1, s * 0.1);
  p.fill(255, 255, 255, 26);                                // top sheen
  p.rect(-s * 0.36, -s * 0.46, s * 0.72, s * 0.28, s * 0.15, s * 0.15, 0, 0);
  p.pop();
}

function feltTable(p, w, h) {
  p.noStroke();
  for (let i = 9; i >= 0; i--) {                            // wooden rim
    const t = 1 - i / 9;
    p.fill(CLR.woodLo[0] + (CLR.woodHi[0] - CLR.woodLo[0]) * t,
      CLR.woodLo[1] + (CLR.woodHi[1] - CLR.woodLo[1]) * t,
      CLR.woodLo[2] + (CLR.woodHi[2] - CLR.woodLo[2]) * t);
    p.rect(3 + i, 3 + i, w - 6 - i * 2, h - 6 - i * 2, 26 - i * 1.7);
  }
  p.fill(0, 0, 0, 50);
  p.rect(12, 12, w - 24, h - 24, 18);
  for (let i = 7; i >= 0; i--) {                            // felt
    const t = 1 - i / 7;
    p.fill(CLR.feltLo[0] + (CLR.feltHi[0] - CLR.feltLo[0]) * t,
      CLR.feltLo[1] + (CLR.feltHi[1] - CLR.feltLo[1]) * t,
      CLR.feltLo[2] + (CLR.feltHi[2] - CLR.feltLo[2]) * t);
    p.rect(18 + i, 18 + i, w - 36 - i * 2, h - 36 - i * 2, 15 - i * 1.1);
  }
  p.fill(255, 255, 255, 6);                                 // felt fibres
  for (let k = 0; k < 54; k++) {
    const a = ((k * 197 + 31) % 97) / 97, b = ((k * 283 + 59) % 89) / 89;
    p.rect(32 + a * (w - 68), 32 + b * (h - 68), 2, 2, 1);
  }
}

function plaque(p, x, y, w, h, hot, glow) {
  p.push();
  p.translate(x, y);
  p.noStroke();
  p.fill(0, 0, 0, 55);
  p.rect(-w / 2 + 4, -h / 2 + 6, w, h, h * 0.2);
  p.fill(...CLR.wood);
  p.rect(-w / 2, -h / 2, w, h, h * 0.2);
  p.fill(...CLR.woodHi);                                    // bevel
  p.rect(-w / 2, -h / 2, w, h * 0.52, h * 0.2, h * 0.2, h * 0.14, h * 0.14);
  p.fill(255, 255, 255, 22);
  p.rect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.24, h * 0.18, h * 0.18, 0, 0);
  p.noFill(); p.stroke(...CLR.brass, glow != null ? glow : 180); p.strokeWeight(2);
  p.rect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h * 0.16);
  if (hot) {
    p.noFill();
    p.stroke(...CLR.red, 60 + 50 * Math.sin(p.frameCount * 0.14));
    p.strokeWeight(4);
    p.rect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h * 0.24);
  }
  p.pop();
}

export default {
  min: 2, max: 6,

  mount(ctx) {
    const kit = shell(ctx, { title: "Mäxchen" }), root = kit.body;
    const names = Object.fromEntries(ctx.players.map((p) => [p.id, p.name]));
    const ids = new Set(Object.keys(names));
    const order = ctx.players.map((p) => p.id);
    let st = {
      phase: "setup", target: 5, seats: [order[0], order[1]], queue: order.slice(2), gone: [],
      pts: Object.fromEntries(order.map((id) => [id, 0])), rounds: 0,
      turn: 0, rolls: [0, 0], cups: [0, 0], claim: null, reveal: null, winnerSeat: null, matchWinner: null,
    };

    const me = () => ctx.me.id;
    const seatOf = (id) => st.seats.indexOf(id);
    const nm = (id) => esc(names[id] || "?") + (id === me() ? " (du)" : "");

    // ---- my private view ----
    let myDice = null;                       // my roll of the current turn (private; arrives via "dice")
    let myDiceRound = null;                  // which round myDice belongs to (round-number stamp on every "dice")
    let myPick = null;                       // the rank I am about to announce (UI state)

    // ---- sound (tiny WebAudio; toggle remembered locally) ----
    let sound = true;
    try { sound = localStorage.getItem("mx_sound") !== "0"; } catch {}
    let AC = null;
    const ac = () => {
      if (!sound) return null;
      if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
      if (AC && AC.state === "suspended") { try { AC.resume(); } catch {} }
      return AC;
    };
    function click() {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square"; o.frequency.value = 640;
      g.gain.setValueAtTime(0.03, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.07);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.08);
    }
    function shakeSnd() {
      const c = ac(); if (!c) return;
      for (let i = 0; i < 6; i++) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "triangle";
        o.frequency.value = 1100 + Math.random() * 900;
        g.gain.setValueAtTime(0.012 + Math.random() * 0.02, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
        o.connect(g).connect(c.destination);
        const at = c.currentTime + i * 0.05;
        o.start(at); o.stop(at + 0.055);
      }
    }
    function sting(win) {
      const c = ac(); if (!c) return;
      const seq = win ? [523, 659, 784, 1047] : [392, 330, 262];
      seq.forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.04, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
        o.connect(g).connect(c.destination);
        const at = c.currentTime + i * 0.09;
        o.start(at); o.stop(at + 0.22);
      });
    }

    // ---- DOM ----
    root.innerHTML = `<div class="mx" tabindex="-1">
      <div class="mx-head"><div class="mx-seats"></div><span class="mx-meta"></span></div>
      <div class="mx-board"></div>
      <div class="mx-status" aria-live="polite"></div>
      <div class="mx-act"></div>
      <div class="mx-table"></div>
    </div>`;
    const rootEl = root.firstElementChild;
    const $ = (s) => rootEl.querySelector(s);
    const seatsEl = $(".mx-seats"), metaEl = $(".mx-meta"), boardEl = $(".mx-board"),
      statusEl = $(".mx-status"), actEl = $(".mx-act"), tableEl = $(".mx-table");
    // (p5 reparents its own canvas into boardEl)

    const setVar = (k, a) => rootEl.style.setProperty(k, `rgb(${a.join(",")})`);
    function paint() {
      if (typeof PAL === "undefined") return;
      setVar("--mxp", PAL.mint); setVar("--mxph", PAL.mintHi);
      setVar("--mxo", PAL.sky); setVar("--mxoh", PAL.skyHi);
      setVar("--mxl", PAL.line); setVar("--mxlh", PAL.lineHi);
    }
    paint();
    const onTheme = () => paint();
    window.addEventListener("themechange", onTheme);

    // ---- canvas ----
    const CW = 640, CH = 380;
    let pf = null;
    let shakeT0 = 0;
    let revealT0 = 0;
    let plaqueT0 = 0;

    if (typeof window.p5 === "function") {
      pf = new window.p5((p) => {
        p.setup = () => {
          const c = p.createCanvas(CW, CH);
          c.parent(boardEl);
          p.frameRate(40);
        };
        p.draw = () => { drawScene(p); };
      });
    }

    function areaLabel(id) { return id ? esc(names[id] || "?") : "?"; }

    function drawArea(p, seat, cy, label, isTop) {
      const w = p.width, cx = w / 2;
      p.noStroke();
      p.fill(...CLR.chalk, 150);
      p.textAlign(p.CENTER, p.CENTER);
      p.textStyle(p.BOLD);
      p.textSize(13);
      p.text(label, cx, cy - 56);

      const inPlay = st.phase === "play" || st.phase === "reveal";
      if (!inPlay) return;

      // Reveal: both pairs are public now — the claimant's pair sits where they sit
      if (st.phase === "reveal" && st.reveal.d) {
        const pairs = [st.claim ? st.claim.seat : 0, st.claim ? 1 - st.claim.seat : 1];  // seat → pair index
        const pair = st.reveal.d[pairs.indexOf(seat)];
        if (pair) {
          const t = Math.min(1, (performance.now() - revealT0) / 450);
          const e = 1 - Math.pow(1 - t, 3);
          const lift = (1 - e) * 70;
          drawDie(p, cx - 46, cy + lift, 64, pair[0], (1 - e) * -0.35, 255);
          drawDie(p, cx + 46, cy + lift, 64, pair[1], (1 - e) * 0.35, 255);
          if (e > 0.6) {
            p.noStroke();
            p.fill(...(st.reveal.loser === seat ? CLR.red : CLR.chalk), 210);
            p.textSize(14);
            p.text(rankName(rankOf(pair[0], pair[1])).toUpperCase() + (st.reveal.loser === seat ? " · echtes Blatt" : ""), cx, cy + 48);
          }
        }
        return;
      }
      if (st.phase !== "play") return;

      // active player: their turn dice (mine real, theirs covered)
      if (st.turn === seat) {
        if (seat === seatOf(me())) {
          const my = st.turn === seat && myDice;
          const t = performance.now() - shakeT0;
          const land = my && t > 520;
          if (!my) { drawCup(p, cx - 46, cy, 56, true); drawCup(p, cx + 46, cy, 56, true); }
          else if (!land) {
            drawDie(p, cx - 46, cy - 6, 66, [2, 1, 6, 4, 3, 5][Math.floor(t / 70) % 6], Math.sin(t / 45) * 0.28, 255);
            drawDie(p, cx + 46, cy - 6, 66, [5, 3, 2, 6, 4, 1][Math.floor(t / 70 + 2) % 6], Math.cos(t / 45) * 0.28, 255);
          } else {
            const e = Math.min(1, (t - 520) / 160);
            const off = (1 - e) * 10;
            drawDie(p, cx - 46, cy - off, 68, myDice[0], (1 - e) * 0.1, 255);
            drawDie(p, cx + 46, cy - off, 68, myDice[1], (1 - e) * -0.1, 255);
          }
          // remaining rerolls as little cups
          const cupsLeft = st.cups[seat] | 0;
          p.noStroke();
          p.fill(...CLR.chalk, 140);
          p.textSize(11); p.textStyle(p.NORMAL);
          p.text(cupsLeft ? "Noch " + cupsLeft + "× nachwürfeln" : "Becher aus", cx + 84, cy + 46);
        } else {
          drawCup(p, cx - 46, cy, 56, true);
          drawCup(p, cx + 46, cy, 56, true);
          p.noStroke();
          p.fill(...CLR.chalk, 120);
          p.textSize(11); p.textStyle(p.NORMAL);
          p.text((st.cups[seat] | 0) ? "würfelt …" : "beim Ankündigen", cx, cy + 48);
        }
        return;
      }

      // the inactive seat: my old roll stays visible to me, the others see cups
      if (seat === seatOf(me()) && myDice) {
        drawDie(p, cx - 46, cy, 58, myDice[0], 0, 210);
        drawDie(p, cx + 46, cy, 58, myDice[1], 0, 210);
      } else {
        drawCup(p, cx - 44, cy, 54, false);
        drawCup(p, cx + 44, cy, 54, false);
      }
    }

    function drawScene(p) {
      const w = p.width, h = p.height, cx = w / 2;
      p.clear();
      feltTable(p, w, h);
      p.noStroke();

      const mySeat = seatOf(me());
      const seatTop = mySeat >= 0 ? 1 - mySeat : 0;
      const seatBottom = mySeat >= 0 ? mySeat : 1;
      const labelTop = mySeat >= 0 ? areaLabel(st.seats[seatTop]) : areaLabel(st.seats[0]);
      drawArea(p, seatTop, 104, labelTop, true);
      drawArea(p, seatBottom, h - 92, mySeat >= 0 ? "DU" : areaLabel(st.seats[1]), false);

      // who is on: chalk arrow
      if (st.phase === "play") {
        const seat = st.turn;
        const cy = seat === seatTop ? 104 : h - 92;
        const puls = 0.5 + 0.5 * Math.sin(p.frameCount * 0.12);
        p.noFill(); p.stroke(...CLR.amber, 36 + 44 * puls); p.strokeWeight(2.5);
        p.rect(cx - 112, cy - 50, 224, 100, 14);
        p.noStroke();
      }

      // plaque: the live announcement
      if (st.claim) {
        const r = st.claim.rank;
        const isMx = r === TOP;
        const cw = 300, ch = 88, py = h / 2 - 2;
        const land = Math.min(1, (performance.now() - plaqueT0) / 240);
        const e = 1 - Math.pow(1 - land, 3);
        plaque(p, cx, py, cw, ch * (0.9 + 0.1 * e), isMx, 190);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        p.fill(isMx ? CLR.red : CLR.chalk, 255 * e);
        p.textSize(44 * (0.85 + 0.15 * e));
        p.text(rankShort(r), cx, py - 10);
        p.textSize(14);
        p.fill(isMx ? CLR.red : CLR.chalk, 190 * e);
        p.text(rankName(r).toUpperCase() + "  ·  " + areaLabel(st.seats[st.claim.seat]), cx, py + 16);
        p.stroke(...CLR.brass, 100); p.strokeWeight(4); p.strokeCap(p.ROUND);
        p.line(cx - cw / 2 + 40, py + ch / 2 - 10, cx + cw / 2 - 40, py + ch / 2 - 10);
        p.stroke(isMx ? CLR.red : CLR.amber);
        p.line(cx - cw / 2 + 40, py + ch / 2 - 10, cx - cw / 2 + 40 + (r / TOP) * (cw - 80), py + ch / 2 - 10);
        p.noStroke();
        p.fill(...CLR.chalk, 115);
        p.textSize(10); p.textStyle(p.NORMAL);
        p.text("Ladder 3-2", cx - cw / 2 + 44, py + ch / 2 - 1);
        p.text("Mäxle 2·1", cx + cw / 2 - 46, py + ch / 2 - 1);
      } else {
        const cw = 250, ch = 56;
        plaque(p, cx, h / 2 - 2, cw, ch, false, 120);
        p.fill(...CLR.chalk, 160);
        p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD);
        p.textSize(st.phase === "setup" ? 13 : 15);
        p.text(st.phase === "setup" ? "WER BLUFFT HIER EIGENTLICH?" : "NOCH GETARNT", cx, h / 2 - 8);
        if (st.phase !== "setup") {
          p.textSize(11); p.textStyle(p.NORMAL);
          p.text("der erste Wurf deckt auf", cx, h / 2 + 9);
        }
      }

      // turn hint under the plaque
      if (st.phase === "play" && st.claim && st.claim.rank === TOP) {
        const puls = 0.6 + 0.4 * Math.sin(p.frameCount * 0.18);
        p.noStroke(); p.fill(...CLR.red, 200 * puls);
        p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(13);
        p.text("MÄXLE AUF DEM TISCH – NUR NOCH ZWEIFELN", cx, h / 2 + 56);
      }
    }

    // ---- DOM render ----
    function paintDOM() {
      const seat = seatOf(me());
      const myTurn = st.phase === "play" && seat >= 0 && st.turn === seat;

      // seats row
      const seatTag = (k) => {
        const id = st.seats[k];
        const won = st.phase === "over" && st.winnerSeat === k;
        const lost = st.phase === "reveal" && st.reveal && st.reveal.loser === k;
        return `<div class="mx-seat ${k === 0 ? "a" : "b"}${st.phase === "play" && st.turn === k ? " turn" : ""}${st.gone.includes(id) ? " gone" : ""}${won ? " won" : ""}${lost ? " lost" : ""}">
          <span class="mx-nm">${nm(id)}</span><b class="mx-pts" title="Striche">${st.pts[id] | 0}</b></div>`;
      };
      seatsEl.innerHTML = seatTag(0) + `<span class="mx-vs">vs</span>` + seatTag(1);
      metaEl.textContent = st.rounds ? `Runde ${st.rounds} · bis ${st.target} Striche${st.matchWinner ? " · aus" : ""}` : `bis ${st.target} Striche`;

      // status line
      let text = "";
      if (st.phase === "setup") text = ctx.isHost ? "Wähle die Spieldauer und leg los." : `${nm(ctx.hostId)} wählt die Spieldauer …`;
      else if (st.phase === "reveal") {
        const r = st.reveal;
        if (r.reason === "transfer") text = "Der Gastgeber hat gewechselt – die Runde verfällt ungestraft.";
        else text = `Aha! <b>${esc(names[st.seats[r.loser]] || "?")}</b> kassiert einen Strich.`;
      }
      else if (st.phase === "over") {
        if (st.matchWinner) text = `<b>${esc(names[st.matchWinner] || "?")}</b> hat ${st.target} Striche – das Spiel ist aus.`;
        else text = "Runde beendet – der Verlierer öffnet die nächste.";
      }
      else if (seat < 0) text = `${nm(st.seats[st.turn])} ist am Zug – du schaust zu.`;
      else if (myTurn) {
        if (st.claim && st.claim.rank === TOP) text = "Mäxle liegt offen da … äh, drauf. Nur noch bezweifeln!";
        else if (st.claim) text = "Übertreffe die Ankündigung – oder bezweifle sie.";
        else text = "Erste Ankündigung – wähle unten, dann „rufen“.";
      }
      else text = `${nm(st.seats[st.turn])} ist am Zug.`;
      statusEl.innerHTML = text;
      statusEl.classList.toggle("mine", myTurn);

      // action row
      if (st.phase === "setup") {
        actEl.innerHTML = ctx.isHost
          ? `<div class="mx-pick" role="group" aria-label="Spieldauer">${Object.entries(TARGETS).map(([k, t]) =>
              `<button type="button" class="mx-opt${+k === st.target ? " sel" : ""}" data-t="${k}" aria-pressed="${+k === st.target}"><b>${t}</b><span>${t} Striche</span></button>`).join("")}</div>
             <button type="button" class="primary" data-go>Los geht’s</button>`
          : `<p class="mx-note">Warten auf den Host …</p>`;
      } else if (myTurn) {
        const cups = st.cups[seat] | 0;
        const claim = st.claim;
        const forced = claim && claim.rank === TOP;
        const min = claim ? claim.rank + 1 : 0;
        const shown = forced ? null : (myPick == null ? min : myPick);
        const roll = cups > 0 && !forced
          ? `<button type="button" class="mx-sec" data-roll>🎲 Nachwürfeln · noch ${cups}×</button>` : "";
        // one chip per rank, low → high: first tap picks, second tap calls
        const groups = [];
        for (let r = 0; r <= TOP; r++) {
          const g = r === TOP ? "Mäxle" : (RANKS[r][0] === RANKS[r][1] ? "Pasch" : "Leiter");
          const row = groups[groups.length - 1];
          if (!row || row.g !== g) groups.push({ g, chips: [r] });
          else row.chips.push(r);
        }
        const pick = forced ? "" : `<div class="mx-ranks" role="group" aria-label="Ankündigung wählen">
            <p class="mx-ranks-hint">${claim ? `${esc(rankName(claim.rank))} schlagen mit …` : "Deine erste Ankündigung …"} <span>Tippen wählt · nochmal tippen ruft</span></p>
            ${groups.map(({ g, chips }) =>
              `<div class="mx-grp"><span class="mx-grp-t">${g}</span>${chips.map((r) =>
                `<button type="button" class="mx-rank${shown === r ? " sel" : ""}" data-rank="${r}" aria-pressed="${shown === r}"${r < min ? " disabled" : ""} title="${esc(rankName(r))}">${rankShort(r)}</button>`).join("")}</div>`).join("")}
          </div>`;
        const say = shown != null
          ? `<button type="button" class="primary" data-say>„${esc(rankName(shown))}“ rufen</button>` : "";
        const doubt = claim
          ? `<button type="button" class="danger" data-doubt>${forced ? "Bezweifeln (Pflicht)" : "Bezweifeln"}</button>` : "";
        actEl.innerHTML = roll + (pick || "") + `<div class="mx-row">${say}${doubt}</div>`;
      } else if (st.phase === "over") {
        const seatAlive = ctx.isHost || seat >= 0;
        actEl.innerHTML = st.matchWinner
          ? (ctx.isHost ? `<button type="button" class="primary" data-go>Neues Spiel</button>` : `<p class="mx-note">Der Host startet ein neues Spiel …</p>`)
          : (seatAlive ? `<button type="button" class="primary" data-go>Nächste Runde</button>` : `<p class="mx-note">Warten auf die nächste Runde …</p>`);
      } else {
        actEl.innerHTML = "";
      }

      // table strip: queue + score
      const rows = order.filter((x) => !st.gone.includes(x))
        .sort((a, b) => (st.pts[a] | 0) - (st.pts[b] | 0));
      tableEl.innerHTML =
        (order.length > 2 || st.rounds > 0
          ? `<ol class="mx-score">${rows.map((id) =>
              `<li class="${id === me() ? "me" : ""}"><span>${nm(id)}</span><b>${st.pts[id] | 0}</b></li>`).join("")}</ol>`
          : "")
        + (st.queue.length ? `<p class="mx-note">Als Nächstes am Tisch: ${st.queue.map(nm).join(", ")}</p>` : "");
    }

    // ---- host: the only place that changes the game ----
    const diceMemo = new Map();        // seat → current roll of this round (host only)
    let revealTimer = null;

    const push = () => { ctx.send("state", st); paintDOM(); };

    // new turn for st.turn: automatic private roll, fresh reroll cups
    function beginTurn(stt) {
      const seat = stt.turn;
      stt.rolls[seat] = 1;
      stt.cups[seat] = CUPS - 1;
      stt.cups[1 - seat] = 0;
      stt.rolls[1 - seat] = 0;
      const d = roll2();
      diceMemo.set(seat, d);
      privateDice(d, stt.seats[seat]);
    }
    // send a roll to its owner; own dice never leave the client
    function privateDice(d, seatId) {
      ctx.send("dice", { d, r: st.rounds }, seatId);   // r stamps the round: the owner can tell fresh from stale twitches
      if (seatId === me()) { myDice = d; myDiceRound = st.rounds; shakeT0 = performance.now(); shakeSnd(); }
    }

    function go() {
      if (!ctx.isHost) return;
      if (st.phase === "over" && st.matchWinner) {
        st.rounds = 0;
        for (const k of ids) st.pts[k] = 0;
        st.matchWinner = null;
        const present = order.filter((x) => !st.gone.includes(x));
        st.seats = [present[0], present[1]];
        st.queue = present.slice(2); st.gone = [];
      } else if (st.phase === "over") {
        if (!rotate(st)) { paintDOM(); return; }
      }
      diceMemo.clear();
      freshRound(st);
      beginTurn(st);
      plaqueT0 = performance.now();
      push();
    }

    function reroll(from) {
      if (!ctx.isHost || st.phase !== "play" || st.cups[st.turn] <= 0) return;
      if (st.claim && st.claim.rank === TOP) return;               // a Mäxle can only be doubted
      if (seatOf(from) !== st.turn) return;
      st.rolls[st.turn]++;
      st.cups[st.turn]--;
      const d = roll2();
      diceMemo.set(st.turn, d);
      privateDice(d, st.seats[st.turn]);
      push();
    }

    function announce(rank, from) {
      if (!ctx.isHost || st.phase !== "play") return;
      const s = seatOf(from);
      if (s < 0 || st.turn !== s) return;
      if (!Number.isInteger(rank) || rank < 0 || rank > TOP) return;
      if (st.claim && rank <= st.claim.rank) return;
      st.claim = { rank, seat: s };
      st.turn = 1 - s;
      beginTurn(st);
      plaqueT0 = performance.now();
      push();
    }

    function doubt(from) {
      if (!ctx.isHost || st.phase !== "play" || !st.claim) return;
      const s = seatOf(from);
      if (s < 0 || st.turn !== s) return;
      const claimSeat = st.claim.seat;
      const claimRank = st.claim.rank;
      const dd = diceMemo.get(s), cd = diceMemo.get(claimSeat);
      if (!dd || !cd) return;
      const wins = rankOf(dd[0], dd[1]) > claimRank;     // ties go to the announcer
      const loser = wins ? claimSeat : s;
      st.reveal = { reason: claimRank === TOP ? "forced" : "challenge", d: [cd, dd], loser };
      st.winnerSeat = 1 - loser;
      st.phase = "reveal";
      st.pts[st.seats[loser]] = (st.pts[st.seats[loser]] | 0) + 1;
      if (st.pts[st.seats[loser]] >= st.target) st.matchWinner = st.seats[loser];
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        if (st.phase !== "reveal") return;
        st.phase = "over";
        st.reveal = null;
        push();
      }, REVEAL_DELAY);
      push();
    }

    // ---- messages ----
    let shownClaim = null;                       // last claim I have painted (for the plaque pop)
    ctx.onMessage("roll", ({ from }) => reroll(from));
    ctx.onMessage("claim", ({ data, from }) => announce(data && data.rank, from));
    ctx.onMessage("doubt", ({ from }) => doubt(from));
    ctx.onMessage("go", ({ from }) => { if (ctx.isHost && st.phase === "over" && seatOf(from) >= 0) go(); });
    ctx.onMessage("state", ({ data, from }) => {
      if (from !== ctx.hostId) return;
      const next = clean(data, ids);
      if (!next) return;
      const prevRound = st.rounds, prevTurn = st.turn, prevPhase = st.phase;
      st = next;
      if (next.rounds !== prevRound && myDice != null && myDiceRound !== next.rounds) {
        myDice = null; myDiceRound = null;             // a new round voids dice from any older round
      }
      if (next.turn !== prevTurn || next.rounds !== prevRound || next.phase !== prevPhase) {
        // a fresh turn: default pick sits right above the current claim
        const mySeat = seatOf(me());
        const myTurn = st.phase === "play" && mySeat >= 0 && st.turn === mySeat;
        myPick = myTurn ? (st.claim ? (st.claim.rank === TOP ? null : Math.min(TOP, st.claim.rank + 1)) : 0) : null;
      }
      if (!st.claim) shownClaim = null;
      else if (!shownClaim || shownClaim.rank !== st.claim.rank) { shownClaim = st.claim; plaqueT0 = performance.now(); }
      if (st.phase === "reveal" && prevPhase !== "reveal") revealT0 = performance.now();
      if (st.phase === "reveal" && st.reveal && st.reveal.reason !== "transfer") sting(seatOf(me()) >= 0 && st.reveal.loser !== seatOf(me()));
      paintDOM();
    });
    ctx.onMessage("dice", ({ data, from }) => {
      if (from !== ctx.hostId) return;
      if (data && Array.isArray(data.d) && data.d.length === 2 && data.d.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) {
        myDice = [data.d[0], data.d[1]];
        myDiceRound = Number.isInteger(data.r) && data.r >= 0 ? data.r : st.rounds;   // dice may arrive just before its round's state
        shakeT0 = performance.now();
        shakeSnd();
        paintDOM();
      }
    });

    // ---- inputs ----
    actEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      click();
      if (b.dataset.t !== undefined) { if (ctx.isHost) { st.target = +b.dataset.t; push(); } return; }
      if (b.dataset.go !== undefined) { if (ctx.isHost) go(); else ctx.send("go", null, ctx.hostId); return; }
      if (b.dataset.roll !== undefined) { if (ctx.isHost) reroll(me()); else ctx.send("roll", null, ctx.hostId); return; }
      if (b.dataset.rank !== undefined) {
        const r = +b.dataset.rank;
        if (myPick != null && myPick === r) { ctx.isHost ? announce(r, me()) : ctx.send("claim", { rank: r }, ctx.hostId); }
        else { myPick = r; paintDOM(); }
        return;
      }
      if (b.dataset.say !== undefined) {
        if (myPick != null) { if (ctx.isHost) announce(myPick, me()); else ctx.send("claim", { rank: myPick }, ctx.hostId); }
        return;
      }
      if (b.dataset.doubt !== undefined) { if (ctx.isHost) doubt(me()); else ctx.send("doubt", null, ctx.hostId); return; }
    });

    const onKey = (e) => {
      if (st.phase !== "play") return;
      const mySeat = seatOf(me());
      if (mySeat < 0 || st.turn !== mySeat) return;
      const k = e.key;
      const min = st.claim ? st.claim.rank + 1 : 0;
      if (k === "ArrowRight" || k === "ArrowUp") {
        e.preventDefault();
        myPick = Math.min(TOP, (myPick == null ? min - 1 : myPick) + 1);
        paintDOM();
      } else if (k === "ArrowLeft" || k === "ArrowDown") {
        e.preventDefault();
        myPick = Math.max(min, (myPick == null ? min + 1 : myPick) - 1);
        paintDOM();
      } else if (k === "Enter") {
        e.preventDefault();
        if (myPick != null && myPick >= min) { click(); ctx.isHost ? announce(myPick, me()) : ctx.send("claim", { rank: myPick }, ctx.hostId); }
      } else if (k === " ") {
        e.preventDefault();
        if (st.cups[mySeat] > 0 && !(st.claim && st.claim.rank === TOP)) { click(); ctx.isHost ? reroll(me()) : ctx.send("roll", null, ctx.hostId); }
      } else if (k === "d" || k === "D") {
        if (st.claim) { e.preventDefault(); click(); ctx.isHost ? doubt(me()) : ctx.send("doubt", null, ctx.hostId); }
      }
    };
    rootEl.addEventListener("keydown", onKey);

    // sound toggle
    const sndBtn = document.createElement("button");
    sndBtn.type = "button";
    sndBtn.className = "mx-snd";
    sndBtn.setAttribute("aria-label", "Sound umschalten");
    sndBtn.title = "Sound an/aus";
    sndBtn.textContent = sound ? "Ton an" : "Ton aus";
    sndBtn.addEventListener("click", () => {
      sound = !sound;
      try { localStorage.setItem("mx_sound", sound ? "1" : "0"); } catch {}
      if (!sound && AC) { try { AC.close(); } catch {} AC = null; }
      sndBtn.textContent = sound ? "Ton an" : "Ton aus";
      click();
    });
    rootEl.appendChild(sndBtn);

    // ---- host migration / leaving ----
    ctx.onEvent("host", ({ you }) => {
      if (you) {
        if (st.phase === "play") {
          diceMemo.clear(); myDice = null; myDiceRound = null; myPick = null;
          st.reveal = { reason: "transfer", d: null, loser: null };
          st.phase = "reveal";
          st.winnerSeat = null;
          clearTimeout(revealTimer);
          revealTimer = setTimeout(() => {
            if (st.phase !== "reveal") return;
            st.phase = "over";
            st.reveal = null;
            push();
          }, 1600);
        }
        if (ctx.isHost) push();
      }
      paintDOM();
    });

    ctx.onEvent("leave", ({ id }) => {
      if (!ids.has(id) || st.gone.includes(id)) return;
      st.gone = [...st.gone, id];
      st.queue = st.queue.filter((x) => x !== id);
      const k = seatOf(id);
      if (k >= 0 && st.phase === "play") {
        st.phase = "over";
        st.reveal = null;
        st.winnerSeat = 1 - k;
        st.pts[st.seats[1 - k]] = (st.pts[st.seats[1 - k]] | 0) + 1;
        if (st.pts[st.seats[1 - k]] >= st.target) st.matchWinner = st.seats[1 - k];
      } else if (k >= 0 && st.phase === "reveal") {
        clearTimeout(revealTimer);
        st.phase = "over";
        st.reveal = null;
      }
      paintDOM();
      if (ctx.isHost) push();
    });
    ctx.onEvent("join", () => paintDOM());

    paintDOM();
    setTimeout(() => { try { rootEl.focus({ preventScroll: true }); } catch {} }, 80);

    return {
      go() { paintDOM(); },
      destroy() {
        clearTimeout(revealTimer);
        window.removeEventListener("themechange", onTheme);
        rootEl.removeEventListener("keydown", onKey);
        try { if (pf) pf.remove(); } catch {}
        try { if (AC) AC.close(); } catch {}
        sndBtn.remove();
      },
    };
  },
};
