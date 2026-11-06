// Mau-Mau (UNO rules) for the multiplayer hub.
//
// 2–6 players sit at one card table. Match the top card by colour or value;
// Skip (⊘) skips the next player, Reverse (⇄) turns the direction (with two
// players it acts as a Skip), +2 makes the next player draw two and sit out,
// and the black cards are Wild — they let you choose the colour that must be
// matched next (+4 also floods the next player with four cards, no stacking).
// If you can't or don't want to play, draw one card: playable, you may play
// it right away, otherwise the turn passes. Down to your last card you must
// shout UNO — either call it before playing the penultimate card or hope
// nobody "catches" you within a moment's notice; being caught means drawing
// two. First empty hand wins the round; the winner opens the next one.
//
// The table looks like a round of "Duo" on a wooden parlour table: opponents'
// card backs fan along the edges, the discard pile slumps in the middle, my
// own hand is fanned at the bottom.
//
// The host's client owns the deck and the rules. Guests send intents, the
// host broadcasts the public state (counts, top card, direction — never
// hands) and privately sends each player only their own hand. Host migration
// follows the Mäxchen pattern: the new host cannot reconstruct the hidden
// deck, so the running round is voided without penalty and the host can deal
// the next one. Leaving players drop out; their cards slide back under the
// draw pile.

import { shell } from "../hub-kit.js";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---- the deck: 108 cards, card = colour * 15 + value ----
const COLS = ["r", "y", "g", "b"];               // r red · y yellow · g green · b blue
const WILD = 4;                                  // colour 4 = black (v 13 wild, v 14 wild+4)
const HELO = ["Rot", "Gelb", "Grün", "Blau"];    // colour names for the status line
const CATCH_WINDOW = 3500;                       // ms to catch a forgotten UNO call
const enc = (c, v) => c * 15 + v;
const colOf = (k) => Math.floor(k / 15);
const valOf = (k) => k % 15;
const isCard = (k) => Number.isInteger(k) && k >= 0 && k <= 74 && (colOf(k) < 4 ? valOf(k) <= 12 : valOf(k) >= 13);

function buildDeck() {
  const d = [];
  for (let c = 0; c < 4; c++) {
    d.push(enc(c, 0));                                          // one zero per colour
    for (let v = 1; v <= 12; v++) d.push(enc(c, v), enc(c, v)); // 1–9, ⊘, ⇄, +2 twice
  }
  for (let k = 0; k < 4; k++) d.push(enc(WILD, 13), enc(WILD, 14)); // four Wild, four Wild+4
  return d;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// matches the top card under the active colour (color is a letter from COLS)
function playable(top, color, k) {
  const c = colOf(k), v = valOf(k);
  if (c === WILD) return true;
  if (COLS[c] === color) return true;
  return v === valOf(top) && v < 13 && colOf(top) !== WILD;
}

// ---- the game carries its own styles (the Kniffel pattern); the wooden table
// ---- is a separated box with a fixed aspect ratio on the hub page
const CSS = `
.hub-stage.hub-maumau { padding: 0; border: 0; background: none; box-shadow: none; }
.mm { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; outline: none; }

/* head row: my tag, round counter, sound */
.mm-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; width: min(720px, 100%); }
.mm-mechip { display: inline-flex; align-items: center; gap: 8px; }
.mm-av { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 50%;
  background: linear-gradient(160deg, #f5bc44, #d18a0d); border: 2px solid #fff; box-shadow: 0 3px 8px rgba(50, 12, 2, .35);
  font: 800 15px var(--font-display), var(--font); color: #5b2a16; }
/* the chip sits in the head row, outside the table container: px sizes */
.mm-head .mm-chip { font-size: 14px; padding: 5px 12px; gap: 6px; }
.mm-head .mm-chip b { font-size: 12px; padding: 1px 7px; min-width: 18px; }
.mm-head .mm-wins { font-size: 10px; letter-spacing: 1px; }
.mm-meta { display: inline-flex; align-items: center; gap: 10px; font: 600 13px var(--font); color: var(--muted); white-space: nowrap; }
.mm-snd { flex: none; padding: 6px 12px !important; font-size: 12px !important; opacity: .85; }

/* the wooden table — fixed aspect ratio, everything inside scales with it */
.mm-board { position: relative; width: min(720px, 100%); aspect-ratio: 1.78; border-radius: 20px; overflow: hidden;
  container-type: inline-size;
  box-shadow: var(--wrap-shadow), 0 0 0 var(--border-w) var(--hairline);
  background:
    repeating-linear-gradient(93deg, rgba(0,0,0,.10) 0 2px, transparent 2px 92px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 26px),
    linear-gradient(180deg, #9c4a35 0%, #8d3f2e 55%, #7e3628 100%); }
.mm-board::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 100% at 50% 30%, rgba(255, 214, 170, .16) 0%, transparent 55%),
    radial-gradient(140% 120% at 50% 110%, rgba(40, 8, 0, .45) 0%, transparent 60%); }
.mm-board::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: radial-gradient(rgba(60, 20, 8, .5) 1px, transparent 1.4px); background-size: 11px 11px; }
.mm-board { --mmcw: 11.5cqw; --oppw: 6.4cqw; }

/* opponents fanned along the edges */
.mm-opp { position: absolute; z-index: 3; display: flex; align-items: center; gap: 1.4cqw; filter: drop-shadow(0 3px 6px rgba(50, 12, 2, .45)); transition: transform .2s var(--ease, ease); }
.mm-opp[data-turn="1"] { transform: scale(1.07); }
.mm-opp.top { top: 3%; left: 50%; flex-direction: column; gap: .5cqw; transform: translateX(-50%); }
.mm-opp.top[data-turn="1"] { transform: translateX(-50%) scale(1.07); }
.mm-opp.left { left: 2%; top: 46%; transform: translateY(-50%) rotate(90deg); }
.mm-opp.left .mm-chip { transform: rotate(-90deg); }
.mm-opp.left[data-turn="1"] { transform: translateY(-50%) rotate(90deg) scale(1.07); }
.mm-opp.right { right: 2%; top: 46%; transform: translateY(-50%) rotate(-90deg); flex-direction: row-reverse; }
.mm-opp.right .mm-chip { transform: rotate(90deg); }
.mm-opp.right[data-turn="1"] { transform: translateY(-50%) rotate(-90deg) scale(1.07); }
.mm-opp.tl { top: 7%; left: 12%; transform: rotate(24deg) scale(.85); }
.mm-opp.tr { top: 7%; right: 12%; transform: rotate(-24deg) scale(.85); }
.mm-chip { position: relative; display: inline-flex; align-items: center; gap: .8cqw; padding: .7cqw 1.8cqw; border-radius: 999px;
  background: #fdf6e8; border: 2px solid #fff; box-shadow: 0 3px 8px rgba(50, 12, 2, .4);
  font: 700 1.9cqw var(--font); color: #5b2a16; white-space: nowrap; }
.mm-chip b { min-width: 2.6cqw; text-align: center; padding: .1cqw 1cqw; border-radius: 999px; background: #5b2a16; color: #fdf6e8; font-size: 1.7cqw; font-variant-numeric: tabular-nums; }
.mm-chip.me { background: #ffe9b8; }
.mm-head .mm-chip { font-size: 14px; padding: 5px 12px; gap: 6px; }
.mm-head .mm-chip b { font-size: 12px; padding: 1px 7px; min-width: 18px; }
.mm-wins { font-style: normal; color: #d18a0d; font-size: 1.5cqw; letter-spacing: .15cqw; }
.mm-head .mm-wins { font-size: 10px; letter-spacing: 1px; }
.mm-unob, .mm-catchb { position: absolute; top: -2cqw; left: 50%; transform: translateX(-50%); padding: .3cqw 1.3cqw; border-radius: 999px; font: 800 1.5cqw var(--font); font-style: normal; text-decoration: none; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.mm-unob { background: #eea41c; color: #3c2a05; box-shadow: 0 2px 5px rgba(50, 12, 2, .4); animation: mm-pop-in .3s cubic-bezier(.2, 1.6, .4, 1); }
.mm-catchb { background: #e0473a; color: #fff; animation: mm-shake .4s ease-in-out; }
@keyframes mm-pop-in { from { transform: translateX(-50%) scale(0); } 70% { transform: translateX(-50%) scale(1.25); } }
@keyframes mm-shake { 25% { transform: translateX(-58%) rotate(-4deg); } 75% { transform: translateX(-42%) rotate(4deg); } }

/* the fanned backs */
.mm-fan { position: relative; display: block; width: calc(var(--oppw) + 2.6cqw); height: calc(var(--oppw) / 0.66 * 0.9); }
.mm-fan .mmcard { position: absolute; left: 1.3cqw; bottom: 0; width: var(--oppw); height: calc(var(--oppw) / 0.66); margin: 0;
  transform-origin: 50% 165%; transform: rotate(calc((var(--i) - (var(--n) - 1) / 2) * 6deg)); }
.mm-fan .mmcard:last-child { z-index: 2; }

/* centre: deck, direction, discard */
.mm-center { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 3.2cqw; }
.mm-deckwrap { position: relative; width: var(--mmcw); aspect-ratio: 0.66; flex: none; }
.mm-deck { position: absolute; inset: 0; width: 100%; background: none; border: none; padding: 0; cursor: pointer; box-shadow: none; filter: drop-shadow(0 5px 10px rgba(50, 12, 2, .5)); }
.mm-deck .mmcard { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; }
.mm-deck .mmcard + .mmcard { transform: translate(3px, -3px); }
.mm-deck:disabled { cursor: default; }
.mm-deck:not(:disabled):hover { transform: translate(-2px, -3px) rotate(-2deg); }
.mm-deckn { position: absolute; right: -1.8cqw; bottom: -1.5cqw; z-index: 3; min-width: 4cqw; padding: .5cqw 1.1cqw; border-radius: 999px;
  background: #fdf6e8; border: 2px solid #fff; color: #5b2a16; font: 800 1.8cqw/1.2 var(--font); font-variant-numeric: tabular-nums; box-shadow: 0 2px 6px rgba(50, 12, 2, .4); }
.mm-dir { flex: none; width: 5.6cqw; max-width: 44px; color: rgba(255, 244, 226, .65); filter: drop-shadow(0 1px 2px rgba(60, 16, 4, .5)); }
.mm-dir svg { width: 100%; height: auto; display: block; animation: mm-spin 9s linear infinite; }
.mm-dir.ccw svg { animation-direction: reverse; transform: scaleX(-1); }
@keyframes mm-spin { to { transform: rotate(-360deg); } }
.mm-discard { position: relative; width: var(--mmcw); aspect-ratio: 0.66; flex: none; filter: drop-shadow(0 6px 12px rgba(50, 12, 2, .5)); }
.mm-discard .mmcard.top { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(var(--rot, 0deg)); animation: mm-drop .34s cubic-bezier(.2, 1.3, .4, 1) backwards; }
@keyframes mm-drop { from { transform: translateY(-8cqw) rotate(calc(var(--rot, 0deg) - 26deg)) scale(.7); opacity: 0; } }
.mm-ghost { position: absolute; inset: 0; border-radius: 10%; background: #241209; opacity: .35; }
.mm-ghost.g1 { transform: rotate(calc(var(--rot, 0deg) - 9deg)) translate(.5cqw, .4cqw); }
.mm-ghost.g2 { transform: rotate(calc(var(--rot, 0deg) + 8deg)) translate(-.5cqw, .15cqw); opacity: .2; }

/* the cards: sticker look — white border, big symbol */
.mmcard { position: relative; display: inline-block; width: var(--mmcw); aspect-ratio: 0.66; border-radius: 10%;
  background: linear-gradient(160deg, var(--cc-hi), var(--cc)); border: 2.5px solid #fff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, .3); flex: none; user-select: none; -webkit-user-select: none; }
.mmcard.c-r { --cc: #d93a2b; --cc-hi: #f0685a; }
.mmcard.c-y { --cc: #e79c0f; --cc-hi: #f7c14a; }
.mmcard.c-g { --cc: #2f9147; --cc-hi: #55c46f; }
.mmcard.c-b { --cc: #2b6fbe; --cc-hi: #5a9fe0; }
.mmcard.c-w { --cc: #2a2d34; --cc-hi: #454a56; }
.mmcard.back { background:
  repeating-linear-gradient(115deg, #e84d8a 0 9px, #f5a623 9px 18px, #35b6b0 18px 27px, #7b5cd6 27px 36px);
  border-color: #fff; }
.mmcard.back::after { content: "MAU"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-8deg);
  padding: 3px 8px; border-radius: 7px; background: #26212a; color: #ffd94d; font: 800 italic calc(var(--mmcw) * .19)/1.2 var(--font-display), var(--font); letter-spacing: .04em; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
.mm-big { position: absolute; inset: 0; display: grid; place-items: center;
  font: 800 calc(var(--mmcw) * .52)/1 var(--font-display), var(--font); color: #fdf6e8;
  text-shadow: 0 2px 0 rgba(0, 0, 0, .22); transform: rotate(-3deg); }
.mm-cidx { position: absolute; top: 4%; left: 9%; font: 800 calc(var(--mmcw) * .18)/1 var(--font); font-style: normal; color: #fdf6e8; text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }
.mm-cidx.f { top: auto; left: auto; bottom: 4%; right: 9%; transform: rotate(180deg); }
.mm-ball { position: absolute; inset: 14% 17%; border-radius: 50%;
  background: conic-gradient(#e0473a 0 25%, #eea41c 0 50%, #3aa257 0 75%, #2f7fd1 0);
  border: 3px solid #fdf6e8; box-shadow: 0 1px 4px rgba(0, 0, 0, .4); }
.mm-mau { position: absolute; bottom: 4%; left: 0; right: 0; text-align: center;
  font: 800 italic calc(var(--mmcw) * .17)/1 var(--font-display), var(--font); color: #fff; opacity: .95; }

/* colour choice overlay */
.mm-colors { position: absolute; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; gap: 2.4cqw;
  background: rgba(46, 16, 6, .62); backdrop-filter: blur(3px); }
.mm-colors[hidden] { display: none; }
.mm-cb { width: 7.4cqw; height: 7.4cqw; min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0, 0, 0, .45); transition: transform .15s var(--ease, ease); }
.mm-cb:hover { transform: scale(1.15) rotate(-6deg); }
.mm-cb.c-r { background: #e0473a; } .mm-cb.c-y { background: #eea41c; } .mm-cb.c-g { background: #3aa257; } .mm-cb.c-b { background: #2f7fd1; }
.mm-cx { flex: none; width: 5.8cqw; height: 5.8cqw; min-width: 38px; min-height: 38px; padding: 0; border-radius: 50%; background: rgba(255, 255, 255, .15); color: #fff; border: 2px solid rgba(255, 255, 255, .5); }
.mm-cx:hover { background: rgba(255, 255, 255, .28); }

/* setup / over overlay */
.mm-setup { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2cqw;
  background: rgba(46, 16, 6, .35); backdrop-filter: blur(2px); text-align: center; padding: 2cqw; }
.mm-setup[hidden] { display: none; }
.mm-setup p { margin: 0; font: 600 clamp(14px, 2.3cqw, 18px) var(--font); color: #fff7ea; text-shadow: 0 1px 3px rgba(60, 16, 4, .6); }
.mm-setup p b { font-weight: 800; }
.mm-setup .primary { padding: 12px 28px; font-size: 16px; border-radius: 999px; }
.mm-logo { display: inline-block; padding: 1.2cqw 3.4cqw; border-radius: 2cqw; transform: rotate(-3deg);
  background: #26212a; border: 3px solid #fff; box-shadow: 0 5px 14px rgba(40, 8, 0, .5);
  font: 800 italic clamp(20px, 4cqw, 32px) var(--font-display), var(--font); letter-spacing: .02em; color: #ffd94d; }

/* status + action row under the table */
.mm-status { font-size: 16px; min-height: 26px; text-align: center; color: var(--muted); }
.mm-status.mine { color: var(--ink); font-weight: 600; }
.mm-status b { font-weight: 700; }
.mm-lnote { color: var(--dim); font-weight: 400; font-size: .85em; }
.mm-act { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; min-height: 48px; }
.mm-act button { flex: none; padding: 11px 24px; font-size: 15px; border-radius: 999px; border: 2.5px solid #fff; box-shadow: 0 4px 10px rgba(40, 8, 0, .35); }
.mm-sec { padding: 9px 18px !important; font-size: 14px !important; color: #5b2a16 !important; background: #fdf6e8 !important; }
.mm-sec:hover { background: #fff !important; }
.mm-act button.primary { background: #35b6b0 !important; border-color: #fff !important; color: #fff !important; font-weight: 700 !important; transform: rotate(-2deg); }
.mm-act button.primary:hover { transform: rotate(-2deg) scale(1.05); }
.mm-act button.danger { background: #e0473a !important; border-color: #fff !important; color: #fff !important; font-weight: 800 !important; transform: rotate(2deg); animation: mm-shake2 .5s ease-in-out; }
.mm-act button.danger:hover { transform: rotate(2deg) scale(1.05); }
@keyframes mm-shake2 { 25% { transform: rotate(2deg) translateX(-2px); } 75% { transform: rotate(2deg) translateX(2px); } }
.mm-uno { background: #eea41c !important; border-color: #fff !important; color: #3c2a05 !important; font-weight: 800 !important; letter-spacing: .05em; transform: rotate(-3deg); animation: mm-uno-pulse 1.5s ease-in-out infinite; }
.mm-uno:hover { transform: rotate(-3deg) scale(1.06); }
.mm-uno.ok { background: #2f9147 !important; color: #fff !important; animation: none; opacity: .85; transform: none; }
.mm-uno:disabled { cursor: default; }
@keyframes mm-uno-pulse { 50% { transform: rotate(-3deg) scale(1.08); box-shadow: 0 4px 18px rgba(238, 164, 28, .65); } }

/* my hand along the bottom */
.mm-hand { --mmcw: 64px; display: flex; justify-content: center; align-items: flex-end; width: min(720px, 100%); min-height: calc(var(--mmcw) / 0.66 * 1.08); padding: 10px 4px 0; }
.mm-hand .mmcard { margin: 0 -11px; transform-origin: 50% 210%;
  transform: rotate(calc((var(--i) - (var(--n) - 1) / 2) * 3.2deg));
  transition: transform .16s var(--ease, ease), filter .16s, box-shadow .16s; }
.mm-hand .mmcard:first-child { margin-left: 0; } .mm-hand .mmcard:last-child { margin-right: 0; }
.mm-hand .mmcard.no { filter: brightness(.6) saturate(.7); }
.mm-hand .mmcard.ok { cursor: pointer; z-index: 1;
  transform: rotate(calc((var(--i) - (var(--n) - 1) / 2) * 3.2deg)) translateY(-9px); }
.mm-hand .mmcard.ok:hover, .mm-hand .mmcard.ok.sel { transform: translateY(-18px) rotate(0deg) scale(1.06); box-shadow: 0 12px 20px rgba(0, 0, 0, .4), 0 0 0 3px #fff; z-index: 5; }
.mm-hand .mmcard.drawn { box-shadow: 0 0 0 3px #ffd94d, 0 3px 8px rgba(0, 0, 0, .3); }

/* score strip */
.mm-strip { min-height: 8px; }
.mm-score { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 0; padding: 0; list-style: none; }
.mm-score li { display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 999px; border: var(--border-w) solid var(--hairline); background: var(--chip-bg); font-size: 13px; }
.mm-score li.me { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.mm-score li b { font-variant-numeric: tabular-nums; }
.mm-note { margin: 0; font-size: 13px; color: var(--muted); }

@media (max-width: 640px) {
  .mm-hand { --mmcw: 52px; }
  .mm-hand .mmcard { margin: 0 -8px; }
  .mm-status { font-size: 14px; min-height: 40px; }
  .mm-head { gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .mm-dir svg, .mm-uno, .mm-discard .mmcard.top { animation: none; }
}
`;

// a state that came over the wire is only used after it was rebuilt from scratch
function clean(d, ids) {
  if (!d || typeof d !== "object") return null;
  const id = (x) => (ids.has(x) ? x : null);
  const order = Array.isArray(d.order) ? d.order.map(id) : [];
  if (order.length < 2 || order.some((x) => !x)) return null;
  const n = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : lo);
  const top = n(d.top, 0, 74);
  if (colOf(top) === WILD && valOf(top) < 13) return null;
  const uno = {};
  if (d.uno && typeof d.uno === "object") for (const k of ids) if (d.uno[k]) uno[k] = 1;
  return {
    phase: ["setup", "play", "over"].includes(d.phase) ? d.phase : "setup",
    order, round: n(d.round, 0, 9999), plays: n(d.plays, 0, 99999),
    turn: order[d.turn] ? n(d.turn, 0, order.length - 1) : 0,
    dir: d.dir === -1 ? -1 : 1,
    top, color: COLS.includes(d.color) ? d.color : "r",
    deckN: n(d.deckN, 0, 108),
    counts: Object.fromEntries([...ids].map((k) => [k, n(d.counts && d.counts[k], 0, 99)])),
    wins: Object.fromEntries([...ids].map((k) => [k, n(d.wins && d.wins[k], 0, 999)])),
    uno, catch: id(d.catch),
    drawn: id(d.drawn),
    winner: id(d.winner),
    note: typeof d.note === "string" ? d.note.slice(0, 200) : "",
  };
}

export default {
  min: 2, max: 6,

  mount(ctx) {
    const kit = shell(ctx, { title: "Mau-Mau" }), root = kit.body;
    const names = Object.fromEntries(ctx.players.map((p) => [p.id, p.name]));
    const ids = new Set(Object.keys(names));
    const order = ctx.players.map((p) => p.id);
    let st = {
      phase: "setup", order: order.slice(), round: 0, plays: 0, turn: 0, dir: 1,
      top: enc(0, 5), color: "r", deckN: 108, counts: {}, wins: {}, uno: {},
      catch: null, drawn: null, winner: null, note: "",
    };

    const me = () => ctx.me.id;
    const idxOf = (id) => st.order.indexOf(id);
    const nm = (id) => esc(names[id] || "?") + (id === me() ? " (du)" : "");

    // ---- my private view ----
    let myHand = [];                          // my cards (private; arrives via "hand")
    let myDrawn = null;                       // the card I drew this turn (only that one may go)
    let mySel = 0;                            // keyboard selection index
    let pickColor = null;                     // wild card awaiting a colour choice

    // ---- sound (tiny WebAudio; toggle remembered locally) ----
    let sound = true;
    try { sound = localStorage.getItem("mm_sound") !== "0"; } catch {}
    let AC = null;
    const ac = () => {
      if (!sound) return null;
      if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
      if (AC && AC.state === "suspended") { try { AC.resume(); } catch {} }
      return AC;
    };
    function tone(f, t0, dur, type = "triangle", vol = 0.04) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, c.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
    }
    const snd = {
      flick: () => { tone(880, 0, 0.05, "square", 0.028); tone(1320, 0.03, 0.06, "square", 0.018); },
      swish: () => { tone(520, 0, 0.07, "sine", 0.03); tone(660, 0.05, 0.07, "sine", 0.022); },
      uno:   () => { tone(784, 0, 0.1); tone(988, 0.08, 0.14); },
      alert: () => { tone(392, 0, 0.12, "sawtooth", 0.03); tone(330, 0.1, 0.16, "sawtooth", 0.03); },
      caught:() => { tone(294, 0, 0.14, "sawtooth", 0.035); tone(233, 0.11, 0.2, "sawtooth", 0.035); },
      sting: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22)),
    };

    // ---- DOM ----
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    root.innerHTML = `<div class="mm" tabindex="-1">
      <div class="mm-head">
        <span class="mm-mechip"></span>
        <span class="mm-meta"></span>
      </div>
      <div class="mm-board">
        <div class="mm-oppo"></div>
        <div class="mm-center">
          <span class="mm-deckwrap"><button type="button" class="mm-deck" aria-label="Karte ziehen"></button><b class="mm-deckn"></b></span>
          <div class="mm-dir" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M10 24a14 14 0 1 1 4.1 9.9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M8 21l2.5 8.5L19 26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="mm-discard"></div>
        </div>
        <div class="mm-colors" hidden role="group" aria-label="Farbe wünschen">
          ${COLS.map((c) => `<button type="button" data-col="${c}" class="mm-cb c-${c}" aria-label="${HELO[COLS.indexOf(c)]}"></button>`).join("")}
          <button type="button" data-col="" class="mm-cx" aria-label="Abbrechen">✕</button>
        </div>
        <div class="mm-setup" hidden></div>
      </div>
      <div class="mm-status" aria-live="polite"></div>
      <div class="mm-act"></div>
      <div class="mm-hand"></div>
      <div class="mm-strip"></div>
    </div>`;
    const rootEl = root.firstElementChild;
    const $ = (s) => rootEl.querySelector(s);
    const headEl = $(".mm-head"), metaEl = $(".mm-meta"), oppoEl = $(".mm-oppo"),
      deckEl = $(".mm-deck"), deckNEl = $(".mm-deckn"), dirEl = $(".mm-dir"),
      discardEl = $(".mm-discard"), mechipEl = $(".mm-mechip"), colorsEl = $(".mm-colors"),
      setupEl = $(".mm-setup"), statusEl = $(".mm-status"), actEl = $(".mm-act"),
      handEl = $(".mm-hand"), stripEl = $(".mm-strip");

    // ---- card rendering (DOM) ----
    const HEX = { r: "#e0473a", y: "#eea41c", g: "#3aa257", b: "#2f7fd1", w: "#262a33" };
    const SYM = { 10: "⊘", 11: "⇄", 12: "+2", 14: "+4" };
    const center = (k) => { const v = valOf(k); return v <= 9 ? String(v) : (v === 13 ? "" : SYM[v]); };
    function cardHTML(k, cls = "") {
      const v = valOf(k), w = colOf(k) === WILD;
      const sym = center(k);
      return `<span class="mmcard ${cls} c-${w ? "w" : COLS[colOf(k)]}" data-card="${k}">
        ${w ? '<b class="mm-ball"></b><em class="mm-mau">MAU!</em>' : `<i class="mm-cidx">${sym}</i><i class="mm-cidx f">${sym}</i><b class="mm-big">${esc(sym)}</b>`}</span>`;
    }
    const backHTML = (cls = "") => `<span class="mmcard back ${cls}"></span>`;
    // a fanned row of card backs; n = 0 shows a single lonely card
    function fanHTML(n, small = false) {
      const cnt = Math.max(1, Math.min(n, 9));
      return `<span class="mm-fan${small ? " sm" : ""}">${Array.from({ length: cnt }, (_, i) =>
        backHTML().replace('class="mmcard back', `style="--i:${i};--n:${cnt}" class="mmcard back`)).join("")}</span>`;
    }

    // ---- animation bookkeeping (diffs against the last render) ----
    let seenHand = null;

    // ---- rendering ----
    function mySorted() {
      return myHand.slice().sort((a, b) => (colOf(a) - colOf(b)) || (valOf(a) - valOf(b)));
    }
    function mayPlay(k) {
      if (st.phase !== "play" || idxOf(me()) !== st.turn) return false;
      if (st.drawn === me()) return k === myDrawn;             // after drawing only the drawn card
      return true;
    }

    function paintDOM() {
      const myIdx = idxOf(me());
      const myTurn = st.phase === "play" && myIdx === st.turn;

      metaEl.textContent = st.round
        ? `Runde ${st.round} · ${st.dir === 1 ? "↻" : "↺"}`
        : "Mau-Mau · 2–6 Spieler";

      // opponents fan along the table edges (top, left, right, then the corners)
      const opps = st.order.filter((id) => id !== me());
      const SLOTS = ["top", "left", "right", "tl", "tr"];
      oppoEl.innerHTML = opps.slice(0, 5).map((id, i) => {
        const cnt = st.counts[id] | 0;
        const bad = st.catch === id ? "vergessen!" : (st.uno[id] && cnt === 1 ? "UNO!" : "");
        return `<div class="mm-opp ${SLOTS[i]}" data-turn="${st.phase === "play" && st.turn === idxOf(id) ? "1" : "0"}">
          ${fanHTML(cnt)}
          <span class="mm-chip">${esc(names[id] || "?")}<b>${cnt}</b>${bad ? `<u class="${st.catch === id ? "mm-catchb" : "mm-unob"}">${bad}</u>` : ""}</span>
        </div>`;
      }).join("");

      // centre: deck + direction + discard
      if (!deckEl.querySelector(".mmcard")) deckEl.innerHTML = backHTML() + backHTML();
      deckNEl.textContent = st.deckN;
      deckEl.disabled = !(myTurn && !st.drawn);
      dirEl.classList.toggle("ccw", st.dir === -1);
      if (discardEl.dataset.pop !== String(st.plays) + ":" + st.top) {
        discardEl.dataset.pop = String(st.plays) + ":" + st.top;   // rebuilt only on a change, so the drop animation doesn't replay
        const rot = ((st.plays * 47) % 17) - 8;
        discardEl.innerHTML =
          `<span class="mm-ghost g1"></span><span class="mm-ghost g2"></span>` + cardHTML(st.top, "top");
        discardEl.style.setProperty("--rot", rot + "deg");
      }
      discardEl.style.setProperty("--ring", HEX[st.color]);
      colorsEl.hidden = !pickColor;

      // my chip (bottom-left of the table, like a name tag)
      const myWins = st.wins[me()] | 0;
      mechipEl.innerHTML = `<span class="mm-av">${esc((names[me()] || "?").slice(0, 1).toUpperCase())}</span>
        <span class="mm-chip me">${esc(names[me()] || "?")}<b>${myHand.length}</b>${myWins ? `<i class="mm-wins">${"★".repeat(Math.min(myWins, 5))}</i>` : ""}</span>`;

      // over overlay on the table (the deal happens automatically, no setup screen)
      if (st.phase === "over") {
        setupEl.hidden = false;
        setupEl.innerHTML = `<div class="mm-logo">${st.winner ? "Geschafft!" : "Runde beendet"}</div>
          <p>${st.winner ? `<b>${esc(names[st.winner] || "?")}</b> hat die Runde gewonnen!` : "Die Runde ist beendet."}</p>
          ${ctx.isHost ? `<button type="button" class="primary" data-deal>Nächste Runde</button>` : `<p class="mm-note">Der Host startet die nächste Runde …</p>`}`;
      } else setupEl.hidden = true;

      // status line
      let text = "";
      if (st.phase === "setup") text = "Die Karten werden gegeben …";
      else if (st.phase === "over") text = st.winner ? `${nm(st.winner)} gewinnt die Runde.` : "Die Runde ist beendet.";
      else if (st.catch && st.catch !== me()) text = `<b>${esc(names[st.catch] || "?")}</b> hat vergessen, UNO zu rufen! Schnell verpetzen!`;
      else if (st.catch) text = "UNO vergessen! Hoffentlich verpetzt dich niemand …";
      else if (myIdx < 0) text = `${nm(st.order[st.turn])} ist am Zug – du schaust zu.`;
      else if (myTurn) {
        text = st.drawn === me()
          ? (myDrawn != null && playable(st.top, st.color, myDrawn)
              ? "Die gezogene Karte passt! Spielen oder weitergeben."
              : "Gezogen – die Karte passt leider nicht.")
          : `Du bist am Zug – Farbe <b>${HELO[COLS.indexOf(st.color)]}</b> oder Wert passt.`;
      } else if (st.drawn) text = `${nm(st.drawn)} hat gezogen …`;
      else text = `${nm(st.order[st.turn])} ist am Zug.`;
      if (st.phase === "play" && st.note && !st.catch) text += ` <span class="mm-lnote">${esc(st.note)}</span>`;
      statusEl.innerHTML = text;
      statusEl.classList.toggle("mine", myTurn);

      // action row: catch / draw / pass / UNO as big playful pills
      const canCall = st.phase === "play" && myHand.length === 2 && !st.uno[me()];
      const called = !!st.uno[me()] && myHand.length === 2;
      let act = "";
      if (st.phase === "play") {
        if (st.catch && st.catch !== me()) act = `<button type="button" class="danger" data-catch="${esc(st.catch)}">Verpetzen!</button>`;
        else if (myTurn) {
          act = (st.drawn ? "" : `<button type="button" class="mm-sec" data-draw>Karte ziehen</button>`)
            + (st.drawn === me() ? `<button type="button" class="primary" data-pass>Weiter</button>` : "");
        }
        if (myHand.length === 2) act += `<button type="button" class="mm-uno${called ? " ok" : ""}" data-uno${!canCall ? " disabled" : ""}>${called ? "UNO ✓" : "UNO!"}</button>`;
      }
      actEl.innerHTML = act;
      actEl.classList.toggle("live", !!act);

      // my hand, fanned along the bottom edge
      const sig = myHand.length + ":" + myHand.join(",");
      if (seenHand !== sig) {
        seenHand = sig;
        const cards = mySorted();
        mySel = Math.min(mySel, Math.max(0, cards.length - 1));
        handEl.innerHTML = cards.map((k, i) => {
          const ok = mayPlay(k) && playable(st.top, st.color, k);
          const cls = ok ? "ok" : (myTurn ? "no" : "");
          return cardHTML(k, cls + (k === myDrawn && st.drawn === me() ? " drawn" : "") + (i === mySel ? " sel" : ""))
            .replace('data-card="' + k + '"', `data-card="${k}" style="--i:${i};--n:${cards.length}"`);
        }).join("");
      } else {
        handEl.querySelectorAll(".mmcard").forEach((el, i) => {
          const k = +el.dataset.card;
          const ok = mayPlay(k) && playable(st.top, st.color, k);
          el.classList.toggle("ok", ok);
          el.classList.toggle("no", st.phase === "play" && myTurn && !ok);
          el.classList.toggle("sel", i === mySel);
        });
      }
      handEl.classList.toggle("mine", myTurn);

      // score strip
      if (st.round) {
        const rows = st.order.slice().sort((a, b) => (st.wins[b] | 0) - (st.wins[a] | 0));
        stripEl.innerHTML = `<ol class="mm-score">${rows.map((id) =>
          `<li class="${id === me() ? "me" : ""}"><span>${nm(id)}</span><b>${st.wins[id] | 0}</b></li>`).join("")}</ol>`;
      } else stripEl.innerHTML = "";
    }

    // ---- host: the only place that changes the game ----
    let deck = [], discard = [], hands = {}, unoFlag = {}, drawnCard = null;
    let catchTimer = 0;

    const push = () => { st.deckN = deck.length; ctx.send("state", st); paintDOM(); };
    const note = (t) => { st.note = t || ""; };

    function sendHand(id) {
      const cards = hands[id] || [];
      const drawn = id === st.drawn ? drawnCard : null;
      if (id === me()) { myHand = cards.slice(); myDrawn = drawn; seenHand = null; }
      else ctx.send("hand", { cards, drawn }, id);
    }

    function drawOne() {
      if (!deck.length) {
        if (discard.length <= 1) return null;
        const top = discard.pop();
        deck = shuffle(discard); discard = [top];
      }
      return deck.pop() ?? null;
    }
    function giveCards(idx, k) {
      const pid = st.order[idx];
      if (!pid) return;
      for (let i = 0; i < k; i++) {
        const c = drawOne();
        if (c == null) break;
        hands[pid].push(c);
      }
      unoFlag[pid] = false; delete st.uno[pid];   // back to more cards: a fresh call is needed
      sendHand(pid);
      st.counts[pid] = hands[pid].length;
    }
    const peekNext = () => ((st.turn + st.dir) % st.order.length + st.order.length) % st.order.length;
    function advance(k = 1) { const n = st.order.length; st.turn = ((st.turn + st.dir * k) % n + n) % n; }

    function deal() {
      if (!ctx.isHost || st.phase === "play" || st.order.length < 2) return;
      clearTimeout(catchTimer); st.catch = null;
      const prevWinner = st.winner;
      deck = shuffle(buildDeck());
      hands = {}; unoFlag = {}; drawnCard = null; st.drawn = null; st.uno = {};
      for (const id of st.order) { hands[id] = deck.splice(0, 7); st.counts[id] = 7; sendHand(id); }
      let t = deck.pop();                        // flip until a number card opens the pile
      while (valOf(t) > 9) { deck.unshift(t); t = deck.pop(); }
      discard = [t]; st.top = t; st.color = COLS[colOf(t)];
      st.round++; st.plays = 0; st.dir = 1; st.winner = null; st.phase = "play";
      st.turn = prevWinner && st.order.includes(prevWinner)
        ? st.order.indexOf(prevWinner)
        : (st.round - 1) % st.order.length;
      note(`${names[st.order[st.turn]] || "?"} beginnt.`);
      snd.swish();
      push();
    }

    function applyPlay(from, data) {
      if (!ctx.isHost || st.phase !== "play") return;
      const idx = idxOf(from);
      if (idx < 0 || idx !== st.turn) return;
      const hand = hands[from] || (hands[from] = []);
      const card = data && Number.isInteger(data.card) ? data.card : -1;
      if (!hand.includes(card)) return;
      if (st.drawn === from && card !== drawnCard) return;      // after drawing only the drawn card may go
      if (!playable(st.top, st.color, card)) return;
      const wild = colOf(card) === WILD;
      const cc = wild && COLS.includes(data.color) ? data.color : null;
      if (wild && !cc) return;

      hand.splice(hand.indexOf(card), 1);
      discard.push(card);
      st.top = card; st.plays++; st.drawn = null; drawnCard = null;
      st.color = wild ? cc : COLS[colOf(card)];
      st.counts[from] = hand.length;
      sendHand(from);                               // the played card must leave my view too

      const v = valOf(card), n = st.order.length;
      if (v === 11 && n > 2) st.dir *= -1;
      const skips = v === 10 || (v === 11 && n === 2) || v === 12 || v === 14;
      if (v === 12 || v === 14) {
        const t = peekNext();
        giveCards(t, v === 12 ? 2 : 4);
        note(`${names[st.order[t]] || "?"} zieht ${v === 12 ? 2 : 4} und sitzt aus.`);
      } else if (v === 10) note(`${names[st.order[peekNext()]] || "?"} setzt aus.`);
      else if (v === 11 && n === 2) note("Retour – nochmal dran.");
      else note("");

      if (!hand.length) {                                      // round over
        st.phase = "over"; st.winner = from; st.wins[from] = (st.wins[from] | 0) + 1;
        st.catch = null; clearTimeout(catchTimer);
        push(); return;
      }
      if (hand.length === 1) {                                 // UNO!
        if (unoFlag[from]) { delete st.uno[from]; unoFlag[from] = false; }
        else {
          st.catch = from;
          clearTimeout(catchTimer);
          catchTimer = setTimeout(() => {                      // nobody caught them: they got away with it
            if (st.catch !== from) return;
            st.catch = null; unoFlag[from] = true; st.uno[from] = 1;
            note(`${names[from] || "?"} hat UNO vergessen – ungeschoren davonkommen.`);
            push();
          }, CATCH_WINDOW);
        }
      } else { unoFlag[from] = false; delete st.uno[from]; }
      advance(skips ? 2 : 1);
      snd.flick();
      push();
    }

    function applyDraw(from) {
      if (!ctx.isHost || st.phase !== "play") return;
      if (idxOf(from) !== st.turn || st.drawn) return;
      const c = drawOne();
      if (c == null) { note("Der Nachziehstapel ist leer – weiter geht’s."); advance(1); push(); return; }
      hands[from].push(c); drawnCard = c; st.drawn = from; st.counts[from] = hands[from].length;
      sendHand(from);
      if (!playable(st.top, st.color, c)) {                    // no luck: the turn passes by itself
        note(`${from === me() ? "Du ziehst" : (names[from] || "?") + " zieht"} – kein Treffer.`);
        st.drawn = null; drawnCard = null;
        advance(1);
      } else note("");
      snd.swish();
      push();
    }

    function applyPass(from) {
      if (!ctx.isHost || st.phase !== "play" || st.drawn !== from) return;
      st.drawn = null; drawnCard = null; note("");
      advance(1); push();
    }

    function applyUno(from) {
      if (!ctx.isHost || st.phase !== "play") return;
      if ((hands[from] || []).length !== 2) return;
      unoFlag[from] = true; st.uno[from] = 1;
      if (from === me()) snd.uno();
      push();
    }

    function applyCatch(from, target) {
      if (!ctx.isHost || st.phase !== "play" || st.catch !== target || from === target) return;
      clearTimeout(catchTimer);
      st.catch = null;
      unoFlag[target] = true; st.uno[target] = 1;
      const idx = idxOf(target);
      if (idx >= 0) giveCards(idx, 2);
      note(`${names[target] || "?"} wurde beim Vergessen erwischt – 2 Karten!`);
      snd.caught();
      push();
    }

    // ---- messages ----
    ctx.onMessage("play", ({ data, from }) => applyPlay(from, data));
    ctx.onMessage("draw", ({ from }) => applyDraw(from));
    ctx.onMessage("pass", ({ from }) => applyPass(from));
    ctx.onMessage("uno", ({ from }) => applyUno(from));
    ctx.onMessage("catch", ({ data, from }) => applyCatch(from, data && data.id));
    ctx.onMessage("deal", ({ from }) => { if (ctx.isHost && from === ctx.hostId) deal(); });
    ctx.onMessage("hand", ({ data, from }) => {
      if (from !== ctx.hostId) return;
      if (!data || !Array.isArray(data.cards)) return;
      const cards = data.cards.filter(isCard);
      myHand = cards;
      myDrawn = isCard(data.drawn) && cards.includes(data.drawn) ? data.drawn : null;
      seenHand = null;
      paintDOM();
    });
    ctx.onMessage("state", ({ data, from }) => {
      if (from !== ctx.hostId) return;
      const next = clean(data, ids);
      if (!next) return;
      const prevPhase = st.phase, prevCatch = st.catch, prevWinner = st.winner;
      st = next;
      seenHand = null;                                         // "hand" messages reset it anyway; cheap safety
      if (st.phase === "over" && prevPhase !== "over" && st.winner) snd.sting();
      if (st.catch && !prevCatch && st.catch !== me()) snd.alert();
      if (st.winner && st.winner === me() && !prevWinner) snd.uno();
      pickColor = null;
      paintDOM();
    });

    // ---- inputs ----
    handEl.addEventListener("click", (e) => {
      const el = e.target.closest(".mmcard");
      if (!el || el.classList.contains("back")) return;
      const k = +el.dataset.card;
      if (!el.classList.contains("ok")) return;
      if (colOf(k) === WILD) { pickColor = k; paintDOM(); return; }
      ctx.isHost ? applyPlay(me(), { card: k }) : ctx.send("play", { card: k }, ctx.hostId);
    });
    colorsEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !pickColor) return;
      const c = b.dataset.col, k = pickColor;
      pickColor = null;
      if (!c) { paintDOM(); return; }
      ctx.isHost ? applyPlay(me(), { card: k, color: c }) : ctx.send("play", { card: k, color: c }, ctx.hostId);
    });
    const onAct = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.deal !== undefined) { if (ctx.isHost) deal(); else ctx.send("deal", null, ctx.hostId); return; }
      if (b.dataset.draw !== undefined) { if (ctx.isHost) applyDraw(me()); else ctx.send("draw", null, ctx.hostId); return; }
      if (b.dataset.pass !== undefined) { if (ctx.isHost) applyPass(me()); else ctx.send("pass", null, ctx.hostId); return; }
      if (b.dataset.uno !== undefined) { if (ctx.isHost) applyUno(me()); else ctx.send("uno", null, ctx.hostId); return; }
      if (b.dataset.catch !== undefined) {
        const t = b.dataset.catch;
        if (ctx.isHost) applyCatch(me(), t); else ctx.send("catch", { id: t }, ctx.hostId);
        return;
      }
    };
    actEl.addEventListener("click", onAct);
    setupEl.addEventListener("click", onAct);
    deckEl.addEventListener("click", () => {
      if (deckEl.disabled) return;
      ctx.isHost ? applyDraw(me()) : ctx.send("draw", null, ctx.hostId);
    });

    const onKey = (e) => {
      if (st.phase !== "play") return;
      const k = e.key;
      if (k === "d" || k === "D") {
        if (idxOf(me()) === st.turn && !st.drawn) { e.preventDefault(); ctx.isHost ? applyDraw(me()) : ctx.send("draw", null, ctx.hostId); }
      } else if (k === "u" || k === "U") {
        if (myHand.length === 2 && !st.uno[me()]) { e.preventDefault(); ctx.isHost ? applyUno(me()) : ctx.send("uno", null, ctx.hostId); }
      } else if (k === "c" || k === "C") {
        if (st.catch && st.catch !== me()) { e.preventDefault(); ctx.isHost ? applyCatch(me(), st.catch) : ctx.send("catch", { id: st.catch }, ctx.hostId); }
      } else if (k === "ArrowRight" || k === "ArrowLeft") {
        e.preventDefault();
        const n = mySorted().length;
        if (n) { mySel = (mySel + (k === "ArrowRight" ? 1 : -1) + n) % n; paintDOM(); }
      } else if (k === "Enter") {
        const el = handEl.querySelectorAll(".mmcard")[mySel];
        if (el && el.classList.contains("ok")) { e.preventDefault(); el.click(); }
      }
    };
    rootEl.addEventListener("keydown", onKey);

    // sound toggle (lives in the head row, next to the round counter)
    const sndBtn = document.createElement("button");
    sndBtn.type = "button";
    sndBtn.className = "mm-snd";
    sndBtn.setAttribute("aria-label", "Sound umschalten");
    sndBtn.title = "Sound an/aus";
    sndBtn.textContent = sound ? "Ton an" : "Ton aus";
    sndBtn.addEventListener("click", () => {
      sound = !sound;
      try { localStorage.setItem("mm_sound", sound ? "1" : "0"); } catch {}
      if (!sound && AC) { try { AC.close(); } catch {} AC = null; }
      sndBtn.textContent = sound ? "Ton an" : "Ton aus";
      if (sound) snd.flick();
    });
    headEl.appendChild(sndBtn);

    // ---- host migration / leaving ----
    ctx.onEvent("host", ({ you }) => {
      if (you && st.phase === "play") {
        // the new host cannot know the deck or the other hands — void the round
        st.phase = "over"; st.winner = null; st.catch = null; st.drawn = null; myDrawn = null;
        clearTimeout(catchTimer);
        note("Der Gastgeber hat gewechselt – die Runde verfällt ungestraft.");
      }
      deck = []; discard = []; hands = {}; drawnCard = null;
      paintDOM();
      if (ctx.isHost) push();
    });

    ctx.onEvent("leave", ({ id }) => {
      if (!ids.has(id)) return;
      const idx = idxOf(id);
      if (idx < 0) { paintDOM(); return; }
      if (ctx.isHost) {
        if (hands[id]) { deck.unshift(...hands[id]); delete hands[id]; }   // their cards go back under the pile
        st.order.splice(idx, 1);
        if (st.turn > idx) st.turn--;
        if (st.catch === id) { st.catch = null; clearTimeout(catchTimer); }
        if (st.drawn === id) { st.drawn = null; drawnCard = null; }
      }
      if (st.phase === "play" && st.order.length < 2) {
        st.phase = "over"; st.winner = null;
        note("Zu wenige Spieler – die Runde endet.");
        clearTimeout(catchTimer);
      }
      if (ctx.isHost) push(); else paintDOM();
    });
    ctx.onEvent("join", () => paintDOM());

    paintDOM();
    setTimeout(() => { try { rootEl.focus({ preventScroll: true }); } catch {} }, 80);

    return {
      go() {
        // no setup screen: the host deals as soon as everybody is at the table
        if (ctx.isHost && st.phase === "setup") deal();
        paintDOM();
      },
      destroy() {
        clearTimeout(catchTimer);
        rootEl.removeEventListener("keydown", onKey);
        try { if (AC) AC.close(); } catch {} AC = null;
        sndBtn.remove();
        styleEl.remove();
      },
    };
  },
};
