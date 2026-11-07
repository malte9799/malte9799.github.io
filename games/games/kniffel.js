// Kniffel / Yahtzee — five real 3D dice, a hand-written score card.
//
// Roll the dice (button or Space), click dice to hold them (they slide onto the
// wooden rack), roll up to three times, then write the result into a field on
// the card. 13 rounds, then the pad shows your total. Three score-card looks
// (the blue German Kniffel card, the black & white Yahtzee card with its bonus
// and joker rules, and a minimal script card), English and German.
//
// Fullscreen game with its own look that ignores the site's design picker.
//   · dice  — Three.js scene + cannon.js physics (both from cdnjs), see "3D"
//   · card  — plain HTML grid; every number is written stroke by stroke with an
//             animated pen, every label letter by letter, see "Score card"
// Everything lives in one closure so none of it can collide with the shell.

// The game is a factory: createKniffel({ root?, net? }). Solo (the games page) it runs on its own and mounts into the shell's
// #canvas-wrap; inside the multiplayer hub (index.html) it gets the hub's `root` and `net` (room messages, players, host).
window.createKniffel = (env = {}) => {

const NET = env.net || null, HUB = !!NET;
let destroyed = false, raf = 0, rootStyleEl = null, onKeyDown = null;
const observers = [];
// the shell's helpers are not there inside the hub: small local versions
const loadSettings = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
const saveSettings = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch {} };
const flashNote = () => {};
const setStatus = () => {};
const setButtonActive = () => {};
function celebrate(tier) {
  const fire = () => window.confetti && window.confetti({ particleCount: 30 + (tier || 1) * 45, spread: 75, startVelocity: 42, origin: { y: 0.62 }, zIndex: 200, disableForReducedMotion: true, colors: ["#ffd66e", "#74e2b2", "#ff6e8c", "#6cb6ff", "#b098ff"] });
  if (window.confetti) fire(); else loadScript("https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js").then(fire).catch(() => {});
}

// ============================================================ data & rules

const SAVE_KEY = "kniffel_state";
const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"];
let LOWER, CATS, ROUNDS;                         // the lower-section fields, all fields, number of rounds: set by applyRules()
const COLS = 6;                                 // score-card columns (finished games in solo play)

// Rule sets ("Spielvarianten"): the same game as played in different countries. The look of the card is separate (THEMES).
const KN_HOW = { three: "howSum", four: "howSum", chance: "howSum", full: "how25", small: "how30", large: "how40", kniffel: "how50" };
const RULES = {
  kniffel:  { id: "kniffel", name: "Kniffel", lower: ["three", "four", "full", "small", "large", "kniffel", "chance"], bonus: { at: 63, val: 35 }, yb: false, joker: false, how: KN_HOW },
  yahtzee:  { id: "yahtzee", name: "Yahtzee", lower: ["three", "four", "full", "small", "large", "kniffel", "chance"], bonus: { at: 63, val: 35 }, yb: true, joker: true, how: KN_HOW },
  yatzy:    { id: "yatzy", name: "Yatzy", lower: ["pair", "twopairs", "three", "four", "small", "large", "full", "chance", "kniffel"], bonus: { at: 63, val: 50 }, yb: false, joker: false,
              how: { pair: "howPair", twopairs: "howTwoPairs", three: "howThree3", four: "howFour4", small: "how15", large: "how20", full: "howSum", chance: "howSum", kniffel: "how50" } },
  generala: { id: "generala", name: "Generala", lower: ["esc", "full", "poker", "kniffel"], bonus: null, yb: false, joker: false,
              how: { esc: "howEsc", full: "howFull30", poker: "howPoker", kniffel: "how50" } },
};
const RULE_IDS = Object.keys(RULES);
function applyRules(id) {
  const r = RULES[id] || RULES.kniffel;
  LOWER = r.lower; CATS = [...UPPER, ...LOWER]; ROUNDS = CATS.length;
  return r;
}
applyRules("kniffel");

// Card looks (themes): every player picks their own with the arrows on the card. `dice` colours the physical dice to match.
const THEMES = [
  { id: "blue",   dice: { body: "#f5f0e2", pip: "#16171d" } },
  { id: "mono",   dice: { body: "#b6161f", pip: "#fff4e6" } },
  { id: "script", dice: { body: "#25262d", pip: "#f4e8c4" } },
];

const I18N = {
  en: {
    ones: "Aces", twos: "Twos", threes: "Threes", fours: "Fours", fives: "Fives", sixes: "Sixes",
    three: "3 of a kind", four: "4 of a kind", full: "Full house", small: "Sm. straight", large: "Lg. straight", chance: "Chance",
    howUp: (n) => "count only " + ["aces", "twos", "threes", "fours", "fives", "sixes"][n - 1],
    howSum: "sum of all dice", how25: "25 points", how30: "30 points", how40: "40 points", how50: "50 points",
    sum: "total", bonus: "Bonus at 63 or more", up1: "upper total",
    yb: "Yahtzee bonus", ybHow: "100 per extra", low: "lower total", up2: "upper total", grand: "Grand total",
    secUpper: "Upper section", secLower: "Lower section", name: "Name", player: "Player",
    sub_blue: "Score card", sub_mono: "Score card", sub_script: "Score card",
    hdr_blue: (n) => "GAME " + n, hdr_mono: (n) => "GAME #" + n, hdr_script: (n) => "Game " + n,
    roll: "Roll", rollKey: "Space", held: "Held", round: (n) => "Round " + n + " / " + ROUNDS,
    left: (n) => n + (n === 1 ? " roll left" : " rolls left"),
    pIdle: "Roll the dice to start your turn.",
    pHold: "Click or drag dice to keep them, then roll again — or pick a field on the card.",
    pPick: "No rolls left — pick a field on the card.",
    needRoll: "Roll first.", noHold: "Pick a field now — no rolls left.", allHeld: "Every die is held — release one to roll.",
    joker: "Joker rule: that field isn't allowed now.", jokerBonus: "Yahtzee bonus! +100",
    score: "Score", best: "Best", over: "Game over", final: "Final score", newBest: "New best!", again: "New game",
    newGame: "New game", undo: "Undo", sound: "Sound", lang: "Language", variantLbl: "Score card",
        mp: "Multiplayer", mpSub: "Up to 6 friends — no account, direct connection.", yourName: "Your name",
    create: "Create room", join: "Join", or: "or", mpHostT: "Open a new room", mpHostS: "You get a code, a link and a QR code to invite friends.", mpJoinT: "Join with a code", players: "Players", leaveRoom: "Leave room", roomCode: "Room code", copyLink: "Copy invite link", copied: "Link copied!",
    playersN: (n) => "Players (" + n + "/6)", start: "Start game", needTwo: "Waiting for more players…", waitHost: "Waiting for the host to start…",
    connecting: "Connecting…", leave: "Leave", roomFull: "That room is full or already playing.", noRoom: "No room found with that code.",
    netFail: "Couldn't connect. Check your internet connection.", hostLeft: "The host left the game.",
    mpTurn: (n) => n + " is playing…", yourTurn: "Your turn — roll the dice!", turnMine: "Your turn",win: (n) => n + " wins!", rematch: "Rematch", you: "you", hostTag: "host",
    mnTag: "Roll · Hold · Write it down", mnResume: "Resume", mnResumeSub: "Your game is still running", mnResumeMp: "Back to the multiplayer game",
    mnSolo: "Single player", mnSoloAgain: "New single-player game", mnSoloSub: "Chase your own high score — 13 rounds",
    mnSure: "Sure?", mnSureSub: "The running game is lost — tap again",
    mnMulti: "Multiplayer", mnMultiSub: "Play with friends · no account",
    mnInRoom: (c, n) => "Room " + c + " · " + n + (n === 1 ? " player" : " players"),
    mnCard: "Game variant", mnHow: "How to play", mnSoundOn: "Sound: on", mnSoundOff: "Sound: off", mnAll: "← All games", mnBack: "← Back",
    mnCardHint: "Changing the variant starts a new game.", mnCardLocked: "In a multiplayer game the host picks the variant.",
        menuBtn: "Menu", qrTitle: "Invite players", qrHint: "Scan the QR code — it opens this room directly",
    pair: "One pair", twopairs: "Two pairs", esc: "Straight", poker: "Four of a kind",
    howPair: "count the highest pair", howTwoPairs: "count both pairs", howThree3: "count the three", howFour4: "count the four",
    how15: "15 points", how20: "20 points", howEsc: "20 (25 on the 1st roll)", howFull30: "30 (35 on the 1st roll)", howPoker: "40 (45 on the 1st roll)",
    bonusPlus: (n) => "plus " + n, rulesLbl: "Variant",
    rc_kniffel: "Germany · Austria", rd_kniffel: "13 fields · bonus 35 at 63",
    rc_yahtzee: "USA · Canada", rd_yahtzee: "+100 bonus · joker rule",
    rc_yatzy: "Scandinavia", rd_yatzy: "15 fields · pairs · bonus 50",
    rc_generala: "Latin America", rd_generala: "10 fields · +5 on the 1st roll",
    theme: "Card style", th_blue: "Blue", th_mono: "Black & white", th_script: "Script",
    mnBegin: "Start the game", mnBeginSub: (n) => n + " players ready", mnLoading: "Waiting for everybody to load …", mnHubWait: "The host picks the variant and starts the game …",
    mnToLobby: "Back to the lobby", mnToLobbySub: "Pick another game", mnLeaveRoom: "Leave room", mnLeaveRoomSub: "You can join again with the code",
    infoTitle: "How to play",
    info: [
      "Roll all five dice with the Roll button or <b>Space</b>. Click dice to hold them — they slide onto the rack — or drag them there and arrange them as you like. Then roll the rest again. You get three rolls per turn.",
      "Then write the result into one field of the card (every field only once, 13 rounds in all). Upper section: count only that number; 63 or more gives a bonus of 35. Lower section: sets and straights. A field you can't fill must be crossed out with a 0.",
      "<b>Variants</b> (menu): Kniffel (Germany/Austria), Yahtzee (USA — a second Yahtzee scores +100 and works as a joker), Yatzy (Scandinavia — pairs, 15 fields, bonus 50) and Generala (Latin America — 10 fields, +5 on the first roll). Change the card style with the arrows at the top right of the card. Keys: <b>Space</b> roll · <b>1–5</b> hold (left to right) · <b>U</b> undo · <b>Esc</b> menu.",
    ],
  },
  de: {
    ones: "Einser", twos: "Zweier", threes: "Dreier", fours: "Vierer", fives: "Fünfer", sixes: "Sechser",
    three: "Dreierpasch", four: "Viererpasch", full: "Full House", small: "Kleine Straße", large: "Große Straße", chance: "Chance",
    howUp: (n) => "nur " + ["Einser", "Zweier", "Dreier", "Vierer", "Fünfer", "Sechser"][n - 1] + " zählen",
    howSum: "alle Augen zählen", how25: "25 Punkte", how30: "30 Punkte", how40: "40 Punkte", how50: "50 Punkte",
    sum: "gesamt", bonus: "Bonus bei 63 oder mehr", up1: "gesamt oberer Teil",
    yb: "Kniffel-Bonus", ybHow: "100 je weiterer", low: "gesamt unterer Teil", up2: "gesamt oberer Teil", grand: "Endsumme",
    secUpper: "Oberer Teil", secLower: "Unterer Teil", name: "Name", player: "Spieler",
    sub_blue: "Gewinnkarte", sub_mono: "Wertungsblock", sub_script: "Gewinnkarte",
    hdr_blue: (n) => n + ". SPIEL", hdr_mono: (n) => "SPIEL #" + n, hdr_script: (n) => "Spiel " + n,
    roll: "Würfeln", rollKey: "Leertaste", held: "Gehalten", round: (n) => "Runde " + n + " / " + ROUNDS,
    left: (n) => "noch " + n + (n === 1 ? " Wurf" : " Würfe"),
    pIdle: "Würfle, um deine Runde zu beginnen.",
    pHold: "Würfel anklicken oder ziehen zum Halten, dann nochmal würfeln — oder ein Feld wählen.",
    pPick: "Kein Wurf mehr — wähle ein Feld auf dem Block.",
    needRoll: "Erst würfeln.", noHold: "Wähle jetzt ein Feld — kein Wurf mehr übrig.", allHeld: "Alle Würfel gehalten — gib einen frei.",
    joker: "Joker-Regel: dieses Feld ist jetzt nicht erlaubt.", jokerBonus: "Kniffel-Bonus! +100",
    score: "Punkte", best: "Bestwert", over: "Spiel vorbei", final: "Endergebnis", newBest: "Neuer Rekord!", again: "Neues Spiel",
    newGame: "Neues Spiel", undo: "Zurück", sound: "Ton", lang: "Sprache", variantLbl: "Block",
        mp: "Mehrspieler", mpSub: "Bis zu 6 Freunde – ohne Konto, direkte Verbindung.", yourName: "Dein Name",
    create: "Raum erstellen", join: "Beitreten", or: "oder", mpHostT: "Neuen Raum öffnen", mpHostS: "Du bekommst Code, Link und QR-Code zum Einladen.", mpJoinT: "Mit Code beitreten", players: "Spieler", leaveRoom: "Raum verlassen", roomCode: "Raumcode", copyLink: "Einladungslink kopieren", copied: "Link kopiert!",
    playersN: (n) => "Spieler (" + n + "/6)", start: "Spiel starten", needTwo: "Warte auf weitere Spieler …", waitHost: "Warte auf den Start durch den Host …",
    connecting: "Verbinde …", leave: "Verlassen", roomFull: "Der Raum ist voll oder das Spiel läuft schon.", noRoom: "Kein Raum mit diesem Code gefunden.",
    netFail: "Verbindung fehlgeschlagen. Prüfe deine Internetverbindung.", hostLeft: "Der Host hat das Spiel verlassen.",
    mpTurn: (n) => n + " ist dran …", yourTurn: "Du bist dran – würfle!", turnMine: "Du bist dran",win: (n) => n + " gewinnt!", rematch: "Revanche", you: "du", hostTag: "Host",
    mnTag: "Würfeln · Halten · Aufschreiben", mnResume: "Weiterspielen", mnResumeSub: "Dein Spiel läuft noch", mnResumeMp: "Zurück zum Mehrspielerspiel",
    mnSolo: "Einzelspieler", mnSoloAgain: "Neues Einzelspiel", mnSoloSub: "Allein auf Punktejagd – 13 Runden",
    mnSure: "Sicher?", mnSureSub: "Das laufende Spiel geht verloren – nochmal tippen",
    mnMulti: "Mehrspieler", mnMultiSub: "Mit Freunden spielen · ohne Konto",
    mnInRoom: (c, n) => "Raum " + c + " · " + n + " Spieler",
    mnCard: "Spielvariante", mnHow: "Spielanleitung", mnSoundOn: "Ton: an", mnSoundOff: "Ton: aus", mnAll: "← Alle Spiele", mnBack: "← Zurück",
    mnCardHint: "Beim Wechsel der Variante beginnt ein neues Spiel.", mnCardLocked: "Im Mehrspielerspiel bestimmt der Gastgeber die Variante.",
        menuBtn: "Menü", qrTitle: "Mitspieler einladen", qrHint: "QR-Code scannen – öffnet direkt diesen Raum",
    pair: "Ein Paar", twopairs: "Zwei Paare", esc: "Escalera", poker: "Poker",
    howPair: "höchstes Paar zählen", howTwoPairs: "beide Paare zählen", howThree3: "drei Gleiche zählen", howFour4: "vier Gleiche zählen",
    how15: "15 Punkte", how20: "20 Punkte", howEsc: "20 (25 im 1. Wurf)", howFull30: "30 (35 im 1. Wurf)", howPoker: "40 (45 im 1. Wurf)",
    bonusPlus: (n) => "plus " + n, rulesLbl: "Variante",
    rc_kniffel: "Deutschland · Österreich", rd_kniffel: "13 Felder · Bonus 35 ab 63",
    rc_yahtzee: "USA · Kanada", rd_yahtzee: "+100 Bonus · Joker-Regel",
    rc_yatzy: "Skandinavien", rd_yatzy: "15 Felder · Paare · Bonus 50",
    rc_generala: "Lateinamerika", rd_generala: "10 Felder · +5 im 1. Wurf",
    theme: "Kartenstil", th_blue: "Blau", th_mono: "Schwarz-Weiß", th_script: "Schreibschrift",
    mnBegin: "Spiel starten", mnBeginSub: (n) => n + " Spieler bereit", mnLoading: "Warte, bis alle geladen haben …", mnHubWait: "Der Host wählt die Variante und startet das Spiel …",
    mnToLobby: "Zurück zur Lobby", mnToLobbySub: "Anderes Spiel wählen", mnLeaveRoom: "Raum verlassen", mnLeaveRoomSub: "Mit dem Code kannst du wieder beitreten",
    infoTitle: "So wird gespielt",
    info: [
      "Würfle alle fünf Würfel mit dem Knopf oder der <b>Leertaste</b>. Klicke Würfel an, um sie zu halten — sie rutschen auf die Ablage — oder zieh sie dorthin und ordne sie selbst an. Dann würfle den Rest nochmal. Pro Runde sind drei Würfe erlaubt.",
      "Trage das Ergebnis dann in genau ein Feld ein (jedes Feld nur einmal, insgesamt 13 Runden). Oben zählen nur die jeweiligen Augen; ab 63 gibt es 35 Bonus. Unten: Päsche, Full House, Straßen. Was nicht passt, wird mit einer 0 gestrichen.",
      "<b>Varianten</b> (Menü): Kniffel (Deutschland/Österreich), Yahtzee (USA – ein zweiter Kniffel gibt +100 und ist ein Joker), Yatzy (Skandinavien – Paare, 15 Felder, Bonus 50) und Generala (Lateinamerika – 10 Felder, +5 im ersten Wurf). Den Kartenstil wechselst du mit den Pfeilen oben rechts an der Karte. Tasten: <b>Leertaste</b> würfeln · <b>1–5</b> halten (von links) · <b>U</b> zurück · <b>Esc</b> Menü.",
    ],
  },
};

function sanitizeHistory(h, rid) {
  if (!Array.isArray(h)) return [];
  const cats = [...UPPER, ...RULES[rid].lower];
  return h.slice(-COLS).map((g) => {
    if (!g || typeof g !== "object" || !g.cells) return null;
    const cells = {};
    for (const c of cats) if (typeof g.cells[c] === "number") cells[c] = g.cells[c];
    return { cells, yb: typeof g.yb === "number" ? Math.max(0, Math.min(9, g.yb | 0)) : 0 };
  }).filter((g) => g && cats.every((c) => typeof g.cells[c] === "number"));
}

// saved state: the look is per player, finished games and the best score are kept per rule set
const saved = loadSettings(SAVE_KEY);
const rid0 = RULES[saved.rules] ? saved.rules : "kniffel";
const S = {
  lang: "de",                                   // English strings stay in I18N; the language switch is out for now
  theme: Number.isInteger(saved.theme) && saved.theme >= 0 && saved.theme < THEMES.length ? saved.theme : Number.isInteger(saved.variant) && saved.variant >= 0 && saved.variant < THEMES.length ? saved.variant : 0,
  rules: rid0,
  sound: saved.sound !== false,
  name: typeof saved.name === "string" ? saved.name.slice(0, 16) : "",
  histAll: {}, bests: {},
};
for (const id of RULE_IDS) {
  S.histAll[id] = sanitizeHistory((saved.histAll || {})[id] ?? (id === "kniffel" ? saved.history : []), id);
  S.bests[id] = saved.bests && typeof saved.bests[id] === "number" ? saved.bests[id] : id === "kniffel" && typeof saved.best === "number" ? saved.best : 0;
}
applyRules(rid0);
S.history = S.histAll[rid0];
S.best = S.bests[rid0];
const save = () => {
  S.histAll[S.rules] = S.history; S.bests[S.rules] = S.best;
  saveSettings(SAVE_KEY, { lang: S.lang, theme: S.theme, rules: S.rules, sound: S.sound, name: S.name, histAll: S.histAll, bests: S.bests });
};
let MP = null;                                   // multiplayer game in progress, see "multiplayer" below
const V = () => THEMES[S.theme];                 // the card look (always the player's own)
const R = () => RULES[MP ? MP.rules : S.rules];  // the rules (the host's in a multiplayer game)
const t = (k, ...a) => { const v = I18N[S.lang][k]; return typeof v === "function" ? v(...a) : v; };

// ---- scoring ----

function counts(d) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]++; return c; }
const sumOf = (d) => d.reduce((a, b) => a + b, 0);

// points for one field. `first` = the dice were all thrown in a single roll (Generala pays 5 more for that)
function rawScore(cat, d, rid, first) {
  const c = counts(d), s = sumOf(d), mx = Math.max(...c);
  const u = UPPER.indexOf(cat);
  if (u >= 0) return c[u + 1] * (u + 1);
  const top = (n) => { for (let v = 6; v >= 1; v--) if (c[v] >= n) return v; return 0; };     // highest face that shows at least n times
  if (rid === "yatzy") {
    switch (cat) {
      case "pair": return 2 * top(2);
      case "twopairs": { const p = []; for (let v = 6; v >= 1; v--) if (c[v] >= 2) p.push(v); return p.length >= 2 ? 2 * (p[0] + p[1]) : 0; }
      case "three": return 3 * top(3);
      case "four": return 4 * top(4);
      case "small": return c[1] && c[2] && c[3] && c[4] && c[5] ? 15 : 0;
      case "large": return c[2] && c[3] && c[4] && c[5] && c[6] ? 20 : 0;
      case "full": return c.includes(3) && c.includes(2) ? s : 0;
      case "kniffel": return mx === 5 ? 50 : 0;
      default: return s; // chance
    }
  }
  if (rid === "generala") {
    const b = first ? 5 : 0;
    switch (cat) {
      case "esc": return (c[1] && c[2] && c[3] && c[4] && c[5]) || (c[2] && c[3] && c[4] && c[5] && c[6]) || (c[3] && c[4] && c[5] && c[6] && c[1]) ? 20 + b : 0;
      case "full": return c.includes(3) && c.includes(2) ? 30 + b : 0;
      case "poker": return mx >= 4 ? 40 + b : 0;
      case "kniffel": return mx === 5 ? 50 : 0;
      default: return 0;
    }
  }
  switch (cat) {                                  // Kniffel and Yahtzee
    case "three": return mx >= 3 ? s : 0;
    case "four": return mx >= 4 ? s : 0;
    case "full": return c.includes(3) && c.includes(2) ? 25 : 0;
    case "small": return [1, 2, 3].some((a) => c[a] && c[a + 1] && c[a + 2] && c[a + 3]) ? 30 : 0;
    case "large": return (c[1] && c[2] && c[3] && c[4] && c[5]) || (c[2] && c[3] && c[4] && c[5] && c[6]) ? 40 : 0;
    case "kniffel": return mx === 5 ? 50 : 0;
    default: return s; // chance
  }
}

// What can be written where for this roll: { cat: points } for every allowed open field.
// With the joker rule (Yahtzee) a further Yahtzee must go to its number's upper field if that is free,
// else to any free lower field at full value, else it scratches an upper field.
function options(d, cur, rid = R().id) {
  const rr = RULES[rid], open = [...UPPER, ...rr.lower].filter((c) => cur.cells[c] == null), out = {};
  const first = typeof G === "object" && !!G && G.rolls === 2;          // one roll used
  const isY = d.every((v) => v === d[0]);
  if (rr.joker && isY && cur.cells.kniffel != null) {
    const up = UPPER[d[0] - 1];
    if (cur.cells[up] == null) { out[up] = rawScore(up, d, rid); return out; }
    const lo = open.filter((c) => rr.lower.includes(c));
    if (lo.length) {
      for (const c of lo) out[c] = c === "full" ? 25 : c === "small" ? 30 : c === "large" ? 40 : sumOf(d);
      return out;
    }
    for (const c of open) out[c] = 0;
    return out;
  }
  for (const c of open) out[c] = rawScore(c, d, rid, first);
  return out;
}

function derive(g) {
  const rr = R(), up = UPPER.map((c) => g.cells[c]);
  const upperSum = up.reduce((a, v) => a + (v || 0), 0);
  const bonus = rr.bonus && upperSum >= rr.bonus.at ? rr.bonus.val : 0;
  const lower = LOWER.reduce((a, c) => a + (g.cells[c] || 0), 0) + (g.yb || 0) * 100;
  return {
    upperSum, bonus, lower,
    upperDone: up.every((v) => v != null),
    done: CATS.every((c) => g.cells[c] != null),
    upperTotal: upperSum + bonus,
    grand: upperSum + bonus + lower,
  };
}
const liveTotal = (g) => derive(g).grand;

// the numbers that should currently be written on the card for one column
function desired(g, finished, rid) {
  const rr = RULES[rid], out = {};
  for (const c of CATS) if (g.cells[c] != null) out[c] = g.cells[c];
  const d = derive(g);
  if (d.upperDone) { out.sum = d.upperSum; if (rr.bonus) { out.bonus = d.bonus; out.up1 = d.upperTotal; } }
  if (rr.yb && g.yb > 0) out.yb = g.yb;
  if (finished) { out.low = d.lower; if (rr.bonus) out.up2 = d.upperTotal; out.grand = d.grand; }
  return out;
}

// ============================================================ sound (WebAudio, synthesised)

let actx = null, noiseBuf = null, lastClack = 0;
function audio() {
  if (!S.sound) return null;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;   // autoplay policy: wait for a click/key
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function noise(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.15), a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  }
  return noiseBuf;
}
// a die hitting felt, wood or another die
function clack(power) {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  if (now - lastClack < 0.022) return;
  lastClack = now;
  const p = Math.max(0.12, Math.min(1, power));
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.playbackRate.value = 0.8 + Math.random() * 0.6;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500 + Math.random() * 1800; bp.Q.value = 1.1;
  const g = a.createGain();
  g.gain.setValueAtTime(0.1 + p * 0.5, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  src.connect(bp); bp.connect(g); g.connect(a.destination); src.start(now);
  const o = a.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(200 + Math.random() * 70, now);
  o.frequency.exponentialRampToValueAtTime(70, now + 0.07);
  const og = a.createGain();
  og.gain.setValueAtTime(0.05 + 0.2 * p, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  o.connect(og); og.connect(a.destination); o.start(now); o.stop(now + 0.09);
}
// pen on paper
function scratch(dur) {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.loop = true;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.7;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.05, now + 0.03);
  g.gain.setValueAtTime(0.05, now + Math.max(0.04, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, now + dur);
  src.connect(bp); bp.connect(g); g.connect(a.destination); src.start(now); src.stop(now + dur + 0.02);
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// ============================================================ 3D: scene, dice, physics
// World units: a die is 1.5 wide (≈ 16 mm, so 1 unit ≈ 1 cm). The felt floor is y = 0, the
// table top a little below it, the dice rack sits in front of the tray at the same height.
// Physics only runs while dice are tumbling; afterwards every die glides to its slot by tween.

const HALF = 0.8, SLOT_DX = 2.3;
const TRAY_HX = 10.2, TRAY_HZ = 5.8, RIM_W = 1.1, RIM_H = 0.95, TABLE_Y = -0.42;
const ROW_Z = -0.1;
const RACK_W = 12.4, RACK_D = 3.0;
const RACK_Z = TRAY_HZ + RIM_W + 0.4 + RACK_D / 2;   // plank centre
const RACK_DZ = RACK_Z - 0.25;                         // where held dice sit
const GRAV = 80;
const CAM_PITCH = 1.19;                                 // camera elevation in radians (68°) — higher = more top-down
const slotX = (i) => (i - 2) * SLOT_DX;

// which local axis shows which value (opposite faces add up to 7, 1-2-3 run counter-clockwise)
const FACE_AXIS = { 1: [0, 1, 0], 2: [0, 0, 1], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, 0, -1], 6: [0, -1, 0] };
const FACE_BY_MAT = [3, 4, 1, 6, 2, 5];                // BoxGeometry order: +x −x +y −y +z −z
const PIPS = {
  1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]],
  4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
  6: [[.27, .27], [.27, .5], [.27, .73], [.73, .27], [.73, .5], [.73, .73]],
};

let renderer, scene, camera, world, glEl, clock = 0, lastTs = 0, dirty = 3;
let UPV, keyLight, diceMats = null, diceMatsFor = -1, rackTex = null, rackCtx = null;
let hoverIdx = -1, rackHL = -1;
let matDie, matFloor, matWall;
const D = [];   // the five dice

function lerpC(a, b, k) { return a.map((v, i) => Math.round(v + (b[i] - v) * k)); }
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---- procedural textures ----
// Everything is tileable value noise (one shared 512² lattice, integer frequencies wrap).

const NLAT = (() => { const a = new Float32Array(512 * 512); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; })();
function vnoise(x, y, fx, fy, ox = 0, oy = 0) {
  const X = x * fx, Y = y * fy, x0 = Math.floor(X), y0 = Math.floor(Y);
  const tx = X - x0, ty = Y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const xa = ((x0 % fx) + ox) & 511, xb = (((x0 + 1) % fx) + ox) & 511, ya = ((y0 % fy) + oy) & 511, yb = (((y0 + 1) % fy) + oy) & 511;
  const a = NLAT[ya * 512 + xa], b = NLAT[ya * 512 + xb], c = NLAT[yb * 512 + xa], d = NLAT[yb * 512 + xb];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

// Planked wood: long grain streaks along u (stretched noise), thin darker grain lines, fine pores, a slow
// waviness, a different tone per plank and a dark seam between planks.
function woodTexture({ size = 1024, dark, light, planks = 1, streaks = 48, calm = 1, seed = 0 }) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), data = img.data;
  const tone = Array.from({ length: planks }, () => rnd(-0.08, 0.08));
  const off = Array.from({ length: planks }, () => Math.floor(Math.random() * 400) + seed * 53);
  const lines = Math.max(8, Math.floor(streaks * 0.55));
  for (let y = 0; y < size; y++) {
    const v = y / size, pl = Math.min(planks - 1, Math.floor(v * planks)), pv = v * planks - pl;
    const edge = Math.min(pv, 1 - pv) * size / planks, seam = 1 - (1 - smooth(0, 3.2, edge)) * 0.72;
    const o = off[pl];
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const vv = ((v + (vnoise(u, v, 3, 5, o, o) - 0.5) * 0.03 * calm) + 1) % 1;
      const streak = vnoise(u, vv, 2, streaks, o, o + 7) * 0.5 + vnoise(u, vv, 5, streaks * 2, o + 3, o + 11) * 0.3 + vnoise(u, vv, 13, streaks * 5, o + 5, o + 19) * 0.2;
      const ring = smooth(0.58, 0.84, vnoise(u, vv, 2, lines, o + 13, o + 29));
      const pore = vnoise(u, v, 128, 512, o, o + 41);
      const k = clamp(0.5 + (streak - 0.5) * 1.2 - ring * 0.3 + (pore - 0.5) * 0.14 + tone[pl], 0, 1);
      const i = (y * size + x) * 4;
      data[i] = (dark[0] + (light[0] - dark[0]) * k) * seam;
      data[i + 1] = (dark[1] + (light[1] - dark[1]) * k) * seam;
      data[i + 2] = (dark[2] + (light[2] - dark[2]) * k) * seam;
      data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

// Billiard baize: soft cloudy mottling, a fine woolly grain and short fibres lying in one direction.
function feltTexture() {
  const size = 1024, mk = () => { const c = document.createElement("canvas"); c.width = c.height = size; return c; };
  const cm = mk(), cb = mk(), gm = cm.getContext("2d"), gb = cb.getContext("2d");
  const im = gm.createImageData(size, size), ib = gb.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cloud = vnoise(u, v, 3, 3) * 0.5 + vnoise(u, v, 8, 8, 50, 50) * 0.3 + vnoise(u, v, 21, 21, 90, 90) * 0.2;
      const fine = vnoise(u, v, 96, 96, 10, 10) * 0.6 + vnoise(u, v, 192, 192, 30, 30) * 0.4;   // smooth, no per-pixel noise (that is what looked grainy)
      const k = 1 + (cloud - 0.5) * 0.22 + (fine - 0.5) * 0.06, i = (y * size + x) * 4;
      im.data[i] = 27 * k; im.data[i + 1] = 90 * k; im.data[i + 2] = 58 * k; im.data[i + 3] = 255;
      const b = 128 + (fine - 0.5) * 70;
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = b; ib.data[i + 3] = 255;
    }
  }
  gm.putImageData(im, 0, 0); gb.putImageData(ib, 0, 0);
  gm.lineCap = gb.lineCap = "round"; gm.lineWidth = gb.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = 0.55 + (Math.random() - 0.5) * 0.5, len = 8 + Math.random() * 14, light = Math.random() < 0.5;
    gm.strokeStyle = light ? "rgba(150,232,184,.035)" : "rgba(0,26,12,.045)";
    gb.strokeStyle = light ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)";
    for (const g of [gm, gb]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
  }
  const tex = (cv, srgb) => {
    const tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set((TRAY_HX + 0.6) * 2 / 6, (TRAY_HZ + 0.6) * 2 / 6);
    tx.anisotropy = 8;
    if (srgb) tx.encoding = THREE.sRGBEncoding;
    return tx;
  };
  return { map: tex(cm, true), bump: tex(cb, false) };
}

// dark rim shading where the felt meets the wooden wall
function trayShadeTexture() {
  const W = 768, H = Math.round(W * (TRAY_HZ + 0.05) / (TRAY_HX + 0.05)), c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.lineWidth = 3;
  for (let i = 0; i < 60; i++) {
    const inset = i * 1.5 + 1.5;
    g.strokeStyle = `rgba(0,14,7,${(0.6 * Math.pow(1 - i / 60, 2.4)).toFixed(3)})`;
    g.beginPath();
    if (g.roundRect) g.roundRect(inset, inset, W - inset * 2, H - inset * 2, Math.max(6, 40 - i * 0.5)); else g.rect(inset, inset, W - inset * 2, H - inset * 2);
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// UVs for the wooden frame that follow the rim: u runs around the frame (so the grain runs along every
// side and around the corners), v across it. `k` whole texture tiles fit around, so the seam is invisible.
function rimUVs(geo, a, b, R, k) {
  const hx = a - R, hz = b - R, P = 4 * hx + 4 * hz + 2 * Math.PI * R, L = P / k, H2 = Math.PI / 2;
  const pos = geo.attributes.position, n = pos.count, uv = new Float32Array(n * 2), us = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getY(i), y = pos.getZ(i), ax = Math.abs(x), az = Math.abs(z);
    let s, cross;
    if (ax <= hx) { cross = az - b; s = z < 0 ? x + hx : 2 * hx + Math.PI * R + 2 * hz + (hx - x); }
    else if (az <= hz) { cross = ax - a; s = x > 0 ? 2 * hx + H2 * R + (z + hz) : 4 * hx + 3 * H2 * R + 2 * hz + (hz - z); }
    else {
      const cx = x > 0 ? hx : -hx, cz = z > 0 ? hz : -hz, phi = Math.atan2(z - cz, x - cx);
      cross = Math.hypot(x - cx, z - cz) - R;
      if (x > 0 && z < 0) s = 2 * hx + R * (phi + H2);
      else if (x > 0) s = 2 * hx + H2 * R + 2 * hz + R * phi;
      else if (z > 0) s = 4 * hx + Math.PI * R + 2 * hz + R * (phi - H2);
      else s = 4 * hx + 3 * H2 * R + 4 * hz + R * (phi + Math.PI);
    }
    us[i] = s / L;
    uv[i * 2 + 1] = (cross + y * 0.8) / 6 + 0.37;
  }
  for (let t = 0; t < n; t += 3) {            // a triangle straddling the seam gets one tile added, so it doesn't smear
    const lo = Math.min(us[t], us[t + 1], us[t + 2]), hi = Math.max(us[t], us[t + 1], us[t + 2]);
    if (hi - lo > k / 2) for (let j = 0; j < 3; j++) if (us[t + j] < k / 2) us[t + j] += k;
  }
  for (let i = 0; i < n; i++) uv[i * 2] = us[i];
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

// engraved slot outlines + label on the rack plank
function drawRack(hl = rackHL) {
  if (!rackCtx) return;
  const W = 1536, H = 384, g = rackCtx;
  g.clearRect(0, 0, W, H);
  const ppu = W / (RACK_W - 0.6), zc = (RACK_D - 0.4) / 2;
  const engrave = (fn) => {
    g.save(); g.translate(1.5, 2); g.strokeStyle = g.fillStyle = "rgba(255,230,190,.22)"; fn(); g.restore();
    g.save(); g.strokeStyle = g.fillStyle = "rgba(25,10,2,.62)"; fn(); g.restore();
  };
  g.lineWidth = 4; g.lineJoin = "round";
  for (let i = 0; i < 5; i++) {
    const cx = (slotX(i) + (RACK_W - 0.6) / 2) * ppu, cy = (zc + (RACK_DZ - RACK_Z)) * ppu, s = 2.1 * ppu;
    if (i === hl) { g.fillStyle = "rgba(255,214,110,.2)"; g.beginPath(); g.roundRect ? g.roundRect(cx - s / 2, cy - s / 2, s, s, 22) : g.rect(cx - s / 2, cy - s / 2, s, s); g.fill(); }
    engrave(() => { g.beginPath(); g.roundRect ? g.roundRect(cx - s / 2, cy - s / 2, s, s, 22) : g.rect(cx - s / 2, cy - s / 2, s, s); g.stroke(); });
  }
  engrave(() => {
    g.font = "600 40px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const lbl = t("held").toUpperCase().split("").join(" ");
    g.fillText(lbl, W / 2, (zc + 1.0) * ppu);
  });
  rackTex.needsUpdate = true;
  dirty = 3;
}

// ---- dice ----

function dieGeometry() {
  const N = 24, r = 0.17, hi = HALF - r;
  const g = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2, N, N, N);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const remap = (s) => Math.sin(s * Math.PI / 2);        // dense vertices near the edges, where the rounding is
  const p = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    p.set(remap(pos.getX(k) / HALF) * HALF, remap(pos.getY(k) / HALF) * HALF, remap(pos.getZ(k) / HALF) * HALF);
    uv.setXY(k, (remap(uv.getX(k) * 2 - 1) + 1) / 2, (remap(uv.getY(k) * 2 - 1) + 1) / 2);
    c.set(clamp(p.x, -hi, hi), clamp(p.y, -hi, hi), clamp(p.z, -hi, hi));
    d.subVectors(p, c);
    const len = d.length();
    if (len > 1e-6) { d.multiplyScalar(1 / len); p.copy(c).addScaledVector(d, r); nor.setXYZ(k, d.x, d.y, d.z); }
    pos.setXYZ(k, p.x, p.y, p.z);
  }
  g.computeBoundingSphere();
  return g;
}

function faceTextures(n, th) {
  const S = 256, mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return c; };
  const cm = mk(), cb = mk(), gm = cm.getContext("2d"), gb = cb.getContext("2d");
  const base = hexRGB(th.body);
  const grd = gm.createRadialGradient(S * .42, S * .38, S * .08, S / 2, S / 2, S * .78);
  grd.addColorStop(0, `rgb(${lerpC(base, [255, 255, 255], .12)})`);
  grd.addColorStop(1, `rgb(${lerpC(base, [0, 0, 0], .16)})`);
  gm.fillStyle = grd; gm.fillRect(0, 0, S, S);
  gb.fillStyle = "#fff"; gb.fillRect(0, 0, S, S);
  const R = S * 0.092;
  for (const [x, y] of PIPS[n]) {
    const px = x * S, py = y * S;
    gm.fillStyle = th.pip; gm.beginPath(); gm.arc(px, py, R, 0, 7); gm.fill();
    const gr = gb.createRadialGradient(px, py, 0, px, py, R * 1.08);
    gr.addColorStop(0, "#000"); gr.addColorStop(0.7, "#2a2a2a"); gr.addColorStop(1, "#bdbdbd");
    gb.fillStyle = gr; gb.beginPath(); gb.arc(px, py, R * 1.08, 0, 7); gb.fill();
  }
  const map = new THREE.CanvasTexture(cm), bump = new THREE.CanvasTexture(cb);
  map.encoding = THREE.sRGBEncoding;
  map.anisotropy = bump.anisotropy = 8;
  return { map, bump };
}

function applyDiceTheme() {
  if (diceMatsFor === S.theme) return;
  const th = V().dice;
  const old = diceMats;
  diceMats = FACE_BY_MAT.map((n) => {
    const { map, bump } = faceTextures(n, th);
    return new THREE.MeshPhysicalMaterial({
      map, bumpMap: bump, bumpScale: 3.2, roughness: 0.3, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
    });
  });
  diceMatsFor = S.theme;
  for (const d of D) d.mesh.material = diceMats;
  if (old) for (const m of old) { m.map.dispose(); m.bumpMap.dispose(); m.dispose(); }
  dirty = 3;
}

// ---- orientation helpers ----

const faceDir = (v) => new THREE.Vector3(...FACE_AXIS[v]);
function topFace(q) {
  let best = -2, bv = 1;
  for (let v = 1; v <= 6; v++) {
    const y = faceDir(v).applyQuaternion(q).y;
    if (y > best) { best = y; bv = v; }
  }
  return { v: bv, dot: best };
}
const canonQuat = (v) => new THREE.Quaternion().setFromUnitVectors(faceDir(v), UPV);
function faceQuat(v, yaw) {
  return new THREE.Quaternion().setFromAxisAngle(UPV, yaw).multiply(canonQuat(v));
}
function randomQuat(rg = Math.random) {
  const q = new THREE.Quaternion(rg() - .5, rg() - .5, rg() - .5, rg() - .5);
  return q.normalize();
}
// the flat, tidy pose for the face that is currently on top — keeps the die's own heading, snapped to a quarter turn
function snappedQuat(q) {
  const { v } = topFace(q);
  const a = faceDir(v), u = Math.abs(a.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const qa = new THREE.Quaternion().setFromUnitVectors(a.clone().applyQuaternion(q), UPV).multiply(q);
  const qc = canonQuat(v);
  const w = u.clone().applyQuaternion(qa), wc = u.clone().applyQuaternion(qc);
  const phi = Math.atan2(w.x, w.z) - Math.atan2(wc.x, wc.z);
  return faceQuat(v, Math.round(phi / (Math.PI / 2)) * (Math.PI / 2) + rnd(-0.07, 0.07));
}

// start pose for a fresh game: the dice lie in a row, column = die number
function slotPose(i, held, v) {
  return { p: new THREE.Vector3(slotX(i), HALF, held ? RACK_DZ : ROW_Z), q: faceQuat(v, Math.round(rnd(0, 3)) * Math.PI / 2 + rnd(-0.07, 0.07)) };
}

function setPose(d, pose) {
  d.mesh.position.copy(pose.p); d.mesh.quaternion.copy(pose.q);
  d.rest = pose; d.state = "rest"; d.anim = null; dirty = 3;
}

function tweenDie(d, to, o = {}) {
  d.state = "anim";
  d.anim = {
    t: -(o.delay || 0), dur: o.dur || 0.6, arc: o.arc || 0, ease: o.ease || easeIO, done: o.done,
    p0: d.mesh.position.clone(), q0: d.mesh.quaternion.clone(), p1: to.p.clone(), q1: to.q.clone(),
  };
  d.rest = to;
}

// ---- scene setup ----

function init3D() {
  const T = THREE;
  UPV = new T.Vector3(0, 1, 0);
  glEl = document.getElementById("kn-gl");
  renderer = new T.WebGLRenderer({ canvas: glEl, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  scene = new T.Scene();
  scene.background = new T.Color(0x2a1a10);
  camera = new T.PerspectiveCamera(30, 1, 1, 500);

  // soft studio reflections for the glossy dice and the polished rim
  const envScene = new T.Scene();
  const sg = new T.SphereGeometry(60, 32, 16), cols = [], pa = sg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const k = (pa.getY(i) / 60 + 1) / 2;
    const c = k < 0.5 ? lerpC([60, 38, 22], [176, 140, 96], k * 2) : lerpC([176, 140, 96], [255, 244, 226], (k - 0.5) * 2);
    cols.push(c[0] / 255, c[1] / 255, c[2] / 255);
  }
  sg.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
  envScene.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  for (const [x, y, z, w, h, s] of [[-30, 28, 14, 34, 16, 6], [32, 22, -20, 26, 12, 4], [0, 52, 0, 40, 20, 5]]) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ side: T.DoubleSide }));
    m.material.color.setScalar(s); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  }
  const pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.03).texture;
  pm.dispose();

  // lights
  scene.add(new T.HemisphereLight(0xfff0dc, 0x4a3020, 0.55));
  keyLight = new T.DirectionalLight(0xfff1dd, 2.1);
  keyLight.position.set(-9, 20, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  const sc = keyLight.shadow.camera;
  sc.left = -19; sc.right = 19; sc.top = 17; sc.bottom = -17; sc.near = 4; sc.far = 60;
  keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.03; keyLight.shadow.radius = 4;
  keyLight.target.position.set(0, 0, 1.5);
  scene.add(keyLight, keyLight.target);
  const fill = new T.PointLight(0xffc88a, 0.55, 80); fill.position.set(12, 10, -6); scene.add(fill);

  // table
  const tableTex = woodTexture({ size: 1024, dark: [38, 22, 13], light: [124, 80, 47], planks: 4, streaks: 56, seed: 1 });
  tableTex.repeat.set(7, 5);
  const table = new T.Mesh(new T.PlaneGeometry(240, 170), new T.MeshStandardMaterial({ map: tableTex, roughness: 0.72, envMapIntensity: 0.35 }));
  table.rotation.x = -Math.PI / 2; table.position.y = TABLE_Y; table.receiveShadow = true;
  scene.add(table);

  // tray: wooden frame around a felt floor
  const rimTex = woodTexture({ size: 512, dark: [56, 19, 8], light: [152, 72, 33], planks: 1, streaks: 40, calm: 0.5, seed: 2 });
  const rimMat = new T.MeshPhysicalMaterial({ map: rimTex, roughness: 0.4, clearcoat: 0.65, clearcoatRoughness: 0.28, envMapIntensity: 0.6 });
  const rackTex2 = woodTexture({ size: 512, dark: [56, 19, 8], light: [152, 72, 33], planks: 1, streaks: 40, calm: 0.5, seed: 7 });   // its own grain, not the rim's
  rackTex2.repeat.set(1 / 10, 1 / 10); rackTex2.offset.set(Math.random(), 0.5);                  // offset: the dark plank seam (v = 0) stays out of the rack
  const rackMat = rimMat.clone(); rackMat.map = rackTex2;
  const rr = (s, hx, hz, r) => {
    s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0);
    s.lineTo(hx, hz - r); s.absarc(hx - r, hz - r, r, 0, Math.PI / 2); s.lineTo(-hx + r, hz);
    s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI); s.lineTo(-hx, -hz + r); s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5);
    return s;
  };
  const frame = rr(new T.Shape(), TRAY_HX + RIM_W, TRAY_HZ + RIM_W, 1.6);
  frame.holes.push(rr(new T.Path(), TRAY_HX + 0.13, TRAY_HZ + 0.13, 0.7));
  const bev = 0.16, rimH = RIM_H - TABLE_Y - 2 * bev;
  const rimGeo = new T.ExtrudeGeometry(frame, { depth: rimH, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 20 });
  const mid = RIM_W / 2 + 0.07, Pm = 4 * (TRAY_HX + mid - 1.2) + 4 * (TRAY_HZ + mid - 1.2) + 2 * Math.PI * 1.2;
  rimUVs(rimGeo, TRAY_HX + mid, TRAY_HZ + mid, 1.2, Math.max(1, Math.round(Pm / 16)));
  const rim = new T.Mesh(rimGeo, rimMat);
  rim.rotation.x = -Math.PI / 2; rim.position.y = TABLE_Y + bev;
  rim.castShadow = rim.receiveShadow = true;
  scene.add(rim);
  const felt = feltTexture();
  const floor = new T.Mesh(new T.PlaneGeometry((TRAY_HX + 0.6) * 2, (TRAY_HZ + 0.6) * 2), new T.MeshStandardMaterial({ map: felt.map, bumpMap: felt.bump, bumpScale: 0.3, roughness: 1, envMapIntensity: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0; floor.receiveShadow = true;
  scene.add(floor);
  const shade = new T.Mesh(new T.PlaneGeometry((TRAY_HX + 0.05) * 2, (TRAY_HZ + 0.05) * 2), new T.MeshBasicMaterial({ map: trayShadeTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  shade.rotation.x = -Math.PI / 2; shade.position.y = 0.006;
  scene.add(shade);

  // rack plank for held dice
  const plank = rr(new T.Shape(), RACK_W / 2, RACK_D / 2, 0.55);
  const pb = 0.09;
  const rack = new T.Mesh(new T.ExtrudeGeometry(plank, { depth: -TABLE_Y - 2 * pb, bevelEnabled: true, bevelThickness: pb, bevelSize: pb, bevelSegments: 3, curveSegments: 12 }), rackMat);
  rack.rotation.x = -Math.PI / 2; rack.position.set(0, TABLE_Y + pb, RACK_Z);
  rack.castShadow = rack.receiveShadow = true;
  scene.add(rack);
  const rc = document.createElement("canvas"); rc.width = 1536; rc.height = 384;
  rackCtx = rc.getContext("2d"); rackTex = new T.CanvasTexture(rc); rackTex.anisotropy = 8; rackTex.encoding = T.sRGBEncoding;
  const label = new T.Mesh(new T.PlaneGeometry(RACK_W - 0.6, RACK_D - 0.4), new T.MeshBasicMaterial({ map: rackTex, transparent: true, depthWrite: false, toneMapped: false }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.012, RACK_Z);
  scene.add(label);
  drawRack();

  // physics
  world = new CANNON.World();
  world.gravity.set(0, -GRAV, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 14;
  matDie = new CANNON.Material("die"); matFloor = new CANNON.Material("floor"); matWall = new CANNON.Material("wall");
  world.addContactMaterial(new CANNON.ContactMaterial(matDie, matFloor, { friction: 0.38, restitution: 0.3 }));
  world.addContactMaterial(new CANNON.ContactMaterial(matDie, matWall, { friction: 0.1, restitution: 0.5 }));
  world.addContactMaterial(new CANNON.ContactMaterial(matDie, matDie, { friction: 0.2, restitution: 0.42 }));
  const plane = (pos, axis, ang, mat) => {
    const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
    b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), ang);
    b.position.set(...pos);
    world.addBody(b);
  };
  plane([0, 0, 0], [1, 0, 0], -Math.PI / 2, matFloor);
  plane([-TRAY_HX, 0, 0], [0, 1, 0], Math.PI / 2, matWall);
  plane([TRAY_HX, 0, 0], [0, 1, 0], -Math.PI / 2, matWall);
  plane([0, 0, -TRAY_HZ], [0, 1, 0], 0, matWall);
  plane([0, 0, TRAY_HZ], [0, 1, 0], Math.PI, matWall);
  plane([0, 16, 0], [1, 0, 0], Math.PI / 2, matWall);

  // dice
  const geo = dieGeometry();
  for (let i = 0; i < 5; i++) {
    const mesh = new T.Mesh(geo, []);
    mesh.castShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass: 1, material: matDie, shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
      linearDamping: 0.12, angularDamping: 0.3,
    });
    body.addEventListener("collide", (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.4) clack(v / 16);
    });
    D.push({ i, mesh, body, v: 1, held: false, slot: -1, state: "rest", anim: null, rest: null, hover: 0, dragTo: null });
  }
  applyDiceTheme();
  placeDice();

  glEl.style.touchAction = "none";
  glEl.addEventListener("pointerdown", onPointerDown);
  glEl.addEventListener("pointermove", onPointerMove);
  glEl.addEventListener("pointerup", onPointerUp);
  glEl.addEventListener("pointercancel", onPointerUp);
  glEl.addEventListener("pointerleave", () => { if (!drag) setHover(-1); });
  raf = requestAnimationFrame(loop);
}

function placeDice() {
  for (const d of D) {
    d.held = false; d.slot = -1; d.hover = 0;
    d.v = 1 + Math.floor(Math.random() * 6);
    setPose(d, slotPose(d.i, false, d.v));
  }
}

// ---- camera framing: fit tray + rack into the free area next to the card ----

let fitBox = { cx: 0, cy: 0, w: 800, h: 600 };   // pixels, relative to the canvas
function fitCamera() {
  if (!renderer) return;
  const W = glEl.clientWidth, H = glEl.clientHeight;
  if (!W || !H) return;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.clearViewOffset();
  const target = new THREE.Vector3(0, 0, 1.9), dir = new THREE.Vector3(0, Math.sin(CAM_PITCH), Math.cos(CAM_PITCH));
  const ex = TRAY_HX + RIM_W, zf = RACK_Z + RACK_D / 2, zb = -(TRAY_HZ + RIM_W);
  const pts = [];
  for (const x of [-ex, ex]) for (const [y, z] of [[RIM_H, zb], [RIM_H, TRAY_HZ + RIM_W], [TABLE_Y, zf], [1.6, RACK_DZ]]) pts.push(new THREE.Vector3(x, y, z));
  const v = new THREE.Vector3();
  const measure = (dist) => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of pts) { v.copy(p).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { w: (x1 - x0) / 2 * W, h: (y1 - y0) / 2 * H, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  let lo = 6, hi = 400;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2, m = measure(mid);
    if (m.w <= fitBox.w * 0.97 && m.h <= fitBox.h * 0.97) hi = mid; else lo = mid;
  }
  const m = measure(hi);
  const px = (m.cx + 1) / 2 * W, py = (1 - m.cy) / 2 * H;
  camera.setViewOffset(W, H, -(fitBox.cx - px), -(fitBox.cy - py), W, H);
  dirty = 3;
}

// ---- picking ----

const rc = { ray: null, v: null };
function pickDie(ev) {
  if (!camera) return -1;
  const r = glEl.getBoundingClientRect();
  rc.v = rc.v || new THREE.Vector2();
  rc.v.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  rc.ray = rc.ray || new THREE.Raycaster();
  rc.ray.setFromCamera(rc.v, camera);
  const hit = rc.ray.intersectObjects(D.map((d) => d.mesh), false)[0];
  if (hit) return D.findIndex((d) => d.mesh === hit.object);
  // a touch just beside a die still counts: nearest die centre within ~1.3 die widths
  const px = ev.clientX - r.left, py = ev.clientY - r.top, a = new THREE.Vector3(), b = new THREE.Vector3();
  let best = -1, bd = 1e9;
  for (const d of D) {
    a.copy(d.mesh.position).project(camera);
    b.copy(d.mesh.position).setX(d.mesh.position.x + HALF * 2.6).project(camera);
    const cx = (a.x + 1) / 2 * r.width, cy = (1 - a.y) / 2 * r.height, reach = Math.abs(b.x - a.x) / 2 * r.width;
    const dist = Math.hypot(cx - px, cy - py);
    if (dist < reach && dist < bd) { bd = dist; best = d.i; }
  }
  return best;
}
function setHover(i) {
  if (i === hoverIdx) return;
  hoverIdx = i;
  glEl.style.cursor = i >= 0 ? "pointer" : "";
  dirty = 3;
}
// ---- rolling ----

// A roll is fully determined by a seed: the roller sends it (with which dice are thrown) and every client
// runs the same physics locally with a fixed time step, so the tumbling needs no network traffic.
// The roller's final result is sent afterwards and only corrects a client whose simulation drifted.
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let RNG = Math.random;
const rn = (a, b) => a + RNG() * (b - a);

function startRoll(seed = Math.floor(Math.random() * 2147483647), list = D.filter((d) => !d.held)) {
  RNG = mulberry(seed);
  G.phase = "scoop";
  const sx = [-5, 0, 5][Math.floor(RNG() * 3)], m = list.length;
  let pending = m;
  const off = RNG() * 6;
  list.forEach((d, k) => {
    const a = off + (k / m) * Math.PI * 2, r = m > 1 ? 2.3 : 0;
    tweenDie(d, { p: new THREE.Vector3(sx + Math.cos(a) * r, 4.6 + k * 0.7, 2.7 + Math.sin(a) * r * 0.85), q: randomQuat(RNG) }, {
      dur: 0.32, ease: easeOut, delay: k * 0.04,
      done: () => { if (--pending === 0) release(list); },
    });
    d.hover = 0;
  });
  clack(0.35);
  return seed;
}

function release(list) {
  G.phase = "rolling"; G.acc = 0; G.rollT = 0; G.restT = 0; G.nudges = 0; G.rolling = list;
  const tx = rn(-4.5, 4.5), tz = rn(-4.2, -1);
  for (const d of list) {
    const b = d.body;
    b.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
    b.quaternion.set(d.mesh.quaternion.x, d.mesh.quaternion.y, d.mesh.quaternion.z, d.mesh.quaternion.w);
    const dx = tx - d.mesh.position.x + rn(-2.5, 2.5), dz = tz - d.mesh.position.z + rn(-1.5, 1.5), n = Math.hypot(dx, dz) || 1, sp = rn(11, 18);
    b.velocity.set((dx / n) * sp, rn(1, 5), (dz / n) * sp);
    b.angularVelocity.set(rn(-26, 26), rn(-26, 26), rn(-26, 26));
    world.addBody(b); b.wakeUp();
    d.state = "phys";
  }
}

function finishRoll() {
  const list = G.rolling;
  const bad = list.filter((d) => {
    const q = d.mesh.quaternion;
    return topFace(q).dot < 0.985 || d.mesh.position.y > HALF + 0.2;
  });
  if (bad.length && G.nudges < 5 && G.rollT < 8) {   // cocked against a wall or sitting on another die — flick it again
    G.nudges++; G.restT = 0;
    for (const d of bad) {
      d.body.velocity.set(rn(-3, 3), rn(5, 8), rn(-3, 3));
      d.body.angularVelocity.set(rn(-16, 16), rn(-16, 16), rn(-16, 16));
      d.body.wakeUp();
    }
    return;
  }
  G.phase = "settle";
  let pending = list.length;
  for (const d of list) { world.removeBody(d.body); d.v = topFace(d.mesh.quaternion).v; d.state = "rest"; }
  // the die that came to rest furthest left takes the leftmost place in the centred row, and so on
  layoutRow(list, { delay: 0.12, arc: 0.35, done: () => { if (--pending === 0) rollSettled(); } });
}

// ---- arranging: the tray row (left-to-right order kept) and the rack slots ----

const dieX = (d) => (d.state === "anim" ? d.rest.p.x : d.mesh.position.x);

// lay these dice out in a centred row, keeping the order they currently lie in from left to right
function layoutRow(list, o = {}) {
  const sorted = [...list].sort((a, b) => dieX(a) - dieX(b)), m = sorted.length;
  sorted.forEach((d, k) => {
    tweenDie(d, { p: new THREE.Vector3((k - (m - 1) / 2) * SLOT_DX, HALF, ROW_Z), q: snappedQuat(d.mesh.quaternion) }, {
      dur: o.dur || 0.75, arc: o.arc ?? 0.3, delay: (o.delay || 0) + k * 0.05, done: o.done ? () => o.done(d) : undefined,
    });
  });
}

const slotTaken = (s, except) => D.find((o) => o !== except && o.held && o.slot === s);
function nearestSlot(x, free, except) {
  let best = -1, bd = 1e9;
  for (let s = 0; s < 5; s++) {
    if (free && slotTaken(s, except)) continue;
    const dd = Math.abs(slotX(s) - x);
    if (dd < bd) { bd = dd; best = s; }
  }
  return best;
}
function holdAt(d, s, delay = 0) {
  d.held = true; d.slot = s;
  tweenDie(d, { p: new THREE.Vector3(slotX(s), HALF, RACK_DZ), q: snappedQuat(d.mesh.quaternion) }, { dur: 0.52, arc: 1.1, delay });
  clack(0.22);
}
function releaseDie(d) {
  d.held = false; d.slot = -1;
  layoutRow(D.filter((x) => !x.held), { dur: 0.55, arc: 1.0 });
  clack(0.22);
}

// ---- dragging dice (a click without moving still just holds / releases) ----

let drag = null;
const canArrange = () => !!G && G.phase === "choose";
// while the dice roll, the dice already on the rack can still be rearranged (only there, only by their roller)
const rolling = () => !!G && (G.phase === "scoop" || G.phase === "rolling" || G.phase === "settle") && myTurn();
function groundPoint(ev, y) {
  const r = glEl.getBoundingClientRect();
  rc.v = rc.v || new THREE.Vector2(); rc.ray = rc.ray || new THREE.Raycaster();
  rc.v.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  rc.ray.setFromCamera(rc.v, camera);
  const out = new THREE.Vector3();
  return rc.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out) ? out : null;
}
function setRackHL(s) { if (s !== rackHL) { rackHL = s; drawRack(); } }

function onPointerDown(ev) {
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  const i = pickDie(ev);
  if (i < 0) return;
  if (G.phase === "idle") return note(t("needRoll"));
  if (!canArrange() && !(rolling() && D[i].held)) return;
  if (G.rolls <= 0 && !D[i].held) return note(t("noHold"));
  drag = { i, sx: ev.clientX, sy: ev.clientY, moved: false, id: ev.pointerId };
  try { glEl.setPointerCapture(ev.pointerId); } catch {}
}

function onPointerMove(ev) {
  if (!drag) { setHover(canArrange() ? pickDie(ev) : -1); return; }
  const d = D[drag.i];
  if (!drag.moved) {
    if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 7) return;
    drag.moved = true; d.state = "drag"; d.anim = null; d.hover = 0; setHover(-1);
    glEl.style.cursor = "grabbing";
  }
  const p = groundPoint(ev, HALF + 1.2);
  if (p) {
    d.dragTo = { x: clamp(p.x, -TRAY_HX - 1, TRAY_HX + 1), z: clamp(p.z, -TRAY_HZ + 0.8, RACK_Z + 1.2) };
    const over = d.dragTo.z > TRAY_HZ + 0.7;
    setRackHL(over && (G.rolls > 0 || d.held) ? nearestSlot(d.dragTo.x, false) : -1);
  }
  dirty = 3;
}

function onPointerUp() {
  if (!drag) return;
  const dr = drag, d = D[dr.i];
  drag = null;
  try { glEl.releasePointerCapture(dr.id); } catch {}
  glEl.style.cursor = "";
  setRackHL(-1);
  if (!dr.moved) return canArrange() ? toggleHold(dr.i) : undefined;
  dropDie(d);
}

function dropDie(d) {
  const x = d.mesh.position.x, z = d.mesh.position.z, wasHeld = d.held, from = d.slot;
  const back = () => tweenDie(d, d.rest, { dur: 0.35, arc: 0.4 });
  d.state = "rest";
  if (!canArrange()) {                                        // mid-roll: a rack die can only change places on the rack
    const s = z > TRAY_HZ + 0.7 ? nearestSlot(x, false) : from, occ = slotTaken(s, d);
    if (occ) holdAt(occ, from);
    return holdAt(d, s);
  }
  if (z > TRAY_HZ + 0.7) {                                    // dropped on the rack
    if (!wasHeld && G.rolls <= 0) return back();
    let s = nearestSlot(x, false);
    const occ = slotTaken(s, d);
    if (occ && wasHeld) { holdAt(occ, from); holdAt(d, s); return; }          // swap two held dice
    if (occ) s = nearestSlot(x, true, d);
    if (s < 0) return back();
    holdAt(d, s);
  } else if (wasHeld) {                                       // taken off the rack back into the tray
    if (G.rolls <= 0) return holdAt(d, from);
    d.held = false; d.slot = -1;
    layoutRow(D.filter((o) => !o.held), { dur: 0.5, arc: 0.6 });
  } else back();
  updateHUD();
}

// ---- frame loop ----

function loop(ts) {
  if (destroyed) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
  lastTs = ts;
  let active = false;

  if (G.phase === "rolling") {
    G.acc = Math.min((G.acc || 0) + dt, 0.1);
    while (G.acc >= 1 / 120) { world.step(1 / 120); G.acc -= 1 / 120; }
    let calm = true;
    for (const d of G.rolling) {
      const b = d.body;
      d.mesh.position.set(b.position.x, b.position.y, b.position.z);
      d.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      if (b.velocity.length() > 0.35 || b.angularVelocity.length() > 0.5) calm = false;
      if (b.position.y < -3) { b.position.set(0, 3, 0); b.velocity.set(0, 0, 0); }
    }
    G.rollT += dt;
    G.restT = calm ? G.restT + dt : 0;
    if (G.restT > 0.3 || G.rollT > 9) finishRoll();
    active = true;
  }

  for (const d of D) {
    if (d.state === "anim") {
      const a = d.anim;
      a.t += dt;
      if (a.t >= 0) {
        const k = clamp(a.t / a.dur, 0, 1), e = a.ease(k);
        d.mesh.position.lerpVectors(a.p0, a.p1, e);
        d.mesh.position.y += a.arc * Math.sin(Math.PI * k);
        d.mesh.quaternion.copy(a.q0).slerp(a.q1, e);
        if (k >= 1) { d.state = "rest"; d.anim = null; if (a.done) a.done(); }
      }
      active = true;
    } else if (d.state === "drag") {
      const k = Math.min(1, dt * 18), tg = d.dragTo;
      if (tg) { d.mesh.position.x += (tg.x - d.mesh.position.x) * k; d.mesh.position.z += (tg.z - d.mesh.position.z) * k; }
      d.mesh.position.y += (HALF + 1.2 - d.mesh.position.y) * Math.min(1, dt * 14);
      active = true;
    } else if (d.state === "rest") {
      const want = d.i === hoverIdx && canArrange() ? 1 : 0;
      if (Math.abs(d.hover - want) > 0.002) {
        d.hover += (want - d.hover) * Math.min(1, dt * 14);
        d.mesh.position.y = d.rest.p.y + d.hover * 0.28;
        active = true;
      }
    } else active = true;
  }
  if (active) dirty = 3;
  if (dirty > 0) { dirty--; renderer.render(scene, camera); }
}

// ============================================================ score card (HTML) + handwriting
// Labels are written letter by letter (each letter wipes in, in order). Numbers are real
// single-stroke digits: each is a path drawn with stroke-dashoffset while a pen follows the tip.

const DIGIT = {
  0: "M3.2.5C1.4.3.5 2.8.5 5c0 2.4 1 4.9 2.6 4.9 1.8 0 2.8-2.5 2.8-4.9C5.9 2.6 5 .6 3.3.4",
  1: "M1.2 2.6 3.6.6 3.5 9.9",
  2: "M.8 2.5C1 1.2 2 .4 3.1.4c1.5 0 2.4 1 2.3 2.4-.1 1.4-1.8 2.8-3 4.3C1.7 8 1 8.8.6 9.8L5.9 9.6",
  3: "M.8 1.7C1.4.7 2.2.4 3 .4c1.4 0 2.2.9 2.2 2.1 0 1.4-1.2 2.2-2.7 2.3 1.8 0 3.1.9 3.1 2.5 0 1.6-1.2 2.6-2.7 2.6C1.8 9.9 1 9.4.4 8.6",
  4: "M4.3.4.4 6.6h5.4M4.5 2.6V9.9",
  5: "M5.2.5H1.3L.9 4.6C1.7 4 2.6 3.8 3.3 3.8c1.6 0 2.5 1.3 2.5 2.9 0 1.9-1.2 3.1-2.8 3.1C1.8 9.8.9 9.3.4 8.5",
  6: "M5 1C4.1.4 3.3.3 2.7.5 1.3 1.1.6 3.6.6 6.2.6 8.4 1.5 9.9 3.1 9.9c1.6 0 2.5-1.2 2.5-2.8 0-1.7-1-2.7-2.4-2.7C2 4.4 1 5.2.7 6.4",
  7: "M.5.6h5.1C4.5 3 3.4 6 2.7 9.9",
  8: "M3.1 4.7C1.6 4.5.9 3.5.9 2.5.9 1.3 1.8.4 3.1.4c1.3 0 2.1.9 2.1 2.1 0 1.1-.8 2-2.1 2.2C1.5 5 .5 6.1.5 7.4c0 1.5 1.1 2.5 2.6 2.5 1.5 0 2.7-1 2.7-2.5 0-1.3-1.1-2.4-2.7-2.7",
  9: "M5.6 4.1C5.4 2 4.5.5 3.1.5 1.6.5.6 1.6.6 3.2c0 1.5 1.1 2.5 2.5 2.5 1.4 0 2.4-1 2.5-2.4C5.6 5.7 5.4 8.3 3.9 9.4c-.6.4-1.5.5-2.3.2",
};
const CHECK = "M.4 5.6 2.2 8.6 5.9.6";
const NS = "http://www.w3.org/2000/svg";

// the card layout: one entry per printed row
function cardRows() {
  const rr = R(), rows = UPPER.map((k) => ({ k, kind: "cat" }));
  rows.push({ k: "sum", kind: "sum" });
  if (rr.bonus) rows.push({ k: "bonus", kind: "bonus", h: 1.4 }, { k: "up1", kind: "sum", h: 1.4 });
  rows.push({ gap: true });
  LOWER.forEach((k) => rows.push({ k, kind: "cat" }));
  if (rr.yb) rows.push({ k: "yb", kind: "yb", h: 1.1 });
  rows.push({ k: "low", kind: "sum", h: 1.4 });
  if (rr.bonus) rows.push({ k: "up2", kind: "sum", h: 1.4 });
  rows.push({ k: "grand", kind: "sum", h: 1.3 });
  return rows;
}
const cardUnits = () => 3.3 + 1 + 0.6 + 1.2 + cardRows().reduce((a, r) => a + (r.gap ? 0 : r.h || 1), 0);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// handwritten text: words stay together, letters appear one after another
function hw(text, base, cls = "") {
  let k = 0;
  const words = String(text).split(" ").map((w) => {
    const s = [...w].map((ch) => `<i style="--k:${k++}">${esc(ch)}</i>`).join("");
    k++;
    return `<span class="w">${s}</span>`;
  });
  return `<span class="hw ${cls}" style="--b:${base}s">${words.join(" ")}</span>`;
}

function dieSVG(n, base) {
  const pips = PIPS[n].map(([x, y]) => `<circle cx="${x * 12}" cy="${y * 12}" r="1.05"/>`).join("");
  return `<svg class="kn-die" viewBox="0 0 12 12" style="--b:${base}s"><rect class="dr" x=".8" y=".8" width="10.4" height="10.4" rx="2.6"/>${pips}</svg>`;
}
const arrowSVG = (base) => `<svg class="kn-arrow" viewBox="0 0 30 12" style="--b:${base}s"><path pathLength="1" d="M2 6.2C9 5.2 17 6.8 27 6M22 1.6 27.5 6 22 10.4"/></svg>`;

function rowHTML(r, idx, cols) {
  const b = (0.2 + idx * 0.07).toFixed(2);
  const v = V();
  const cells = (extra = "") => Array.from({ length: cols }, (_, j) => `<div class="kn-c g${extra}" data-row="${r.k}" data-col="${j}"></div>`).join("");
  if (r.gap) {
    const lab = v.id === "blue" ? "" : hw(t("secLower"), b);
    return `<div class="kn-r gap" style="--h:.6"><div class="kn-c l sec">${lab}</div></div>`;
  }
  let lab = "", how = "";
  const n = UPPER.indexOf(r.k) + 1;
  if (r.kind === "cat" && n) {
    if (v.id === "blue") lab = `<span class="ico" title="${esc(t(r.k))}">${dieSVG(n, b)}${dieSVG(n, +b + 0.12)}${dieSVG(n, +b + 0.24)}</span>`;
    else if (v.id === "mono") lab = `${hw(t(r.k), b)}<span class="ico">${dieSVG(n, +b + 0.2)}</span>${hw("= " + n, +b + 0.3)}`;
    else lab = `${hw(t(r.k), b)}<span class="ico sm">${dieSVG(n, +b + 0.2)}${dieSVG(n, +b + 0.3)}${dieSVG(n, +b + 0.4)}</span>`;
    how = hw(t("howUp", n), +b + 0.1);
  } else if (r.kind === "cat") {
    lab = hw(r.k === "kniffel" ? R().name : t(r.k), b);
    how = hw(t(R().how[r.k]), +b + 0.1);
  } else if (r.kind === "bonus") { lab = hw(t("bonus"), b); how = hw(t("bonusPlus", R().bonus.val), +b + 0.1); }
  else if (r.kind === "yb") { lab = hw(t("yb"), b); how = hw(t("ybHow"), +b + 0.1); }
  else { lab = hw(t(r.k), b); how = arrowSVG(+b + 0.1); }
  const cls = r.kind === "cat" ? "" : " tot";
  return `<div class="kn-r${cls}${r.k === "grand" ? " grand" : ""}${r.k === "ones" || r.k === LOWER[0] ? " top" : ""}" data-k="${r.k}" style="--h:${r.h || 1};--b:${b}s">
    <div class="kn-c l">${lab}</div><div class="kn-c h">${how}</div>${cells()}</div>`;
}

let cardEl, cellEls = {}, shown = {};

function renderCard() {
  const v = V(), cols = colCount();
  cardEl.className = "kn-card v-" + v.id;
  const hdr = Array.from({ length: cols }, (_, j) => `<div class="kn-c g hdrc" data-col="${j}">${hw(MP ? hdrName(j, cols) : t("hdr_" + v.id, j + 1), (0.5 + j * 0.06).toFixed(2))}</div>`).join("");
  const rows = cardRows().map((r, i) => rowHTML(r, i + 2, cols)).join("");
  const secs = v.id !== "blue";
  const nextTh = (d) => t("th_" + THEMES[(S.theme + d + THEMES.length) % THEMES.length].id);
  // in a multiplayer game the name is the player's own name from the room (read-only); solo it is typed here
  const me = MP && MP.players.find((p) => p.id === MP.myId);
  cardEl.innerHTML = `<div class="kn-paper">
    <div class="kn-head">
      <div class="kn-ttl"><span class="t">${hw(R().name, 0.1, "big")}</span><span class="s">${hw(t("sub_" + v.id), 0.5)}</span>
        <svg class="kn-ul" viewBox="0 0 100 8" preserveAspectRatio="none"><path pathLength="1" d="M1 5.5C18 1.5 38 7 58 3.5S88 4 99 2.5"/></svg></div>
      <div class="kn-name"><span>${hw(t("name"), 0.6)}</span><input id="kn-name" maxlength="16" spellcheck="false" autocomplete="off"${me ? " readonly" : ""} placeholder="${esc(t("player"))}" value="${esc(me ? me.name : S.name)}">
        <div class="kn-themes">
          <button class="kn-th" data-th="-1" title="${t("theme")}: ${nextTh(-1)}" aria-label="${t("theme")}: ${nextTh(-1)}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button class="kn-th" data-th="1" title="${t("theme")}: ${nextTh(1)}" aria-label="${t("theme")}: ${nextTh(1)}"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        </div></div>
    </div>
    <div class="kn-tbl" style="--n:${cols}">
      <div class="kn-r hd top" style="--h:1;--b:.3s"><div class="kn-c l sec">${secs ? hw(t("secUpper"), 0.4) : ""}</div><div class="kn-c h"></div>${hdr}</div>
      ${rows}
    </div></div>`;
  cellEls = {};
  cardEl.querySelectorAll(".kn-c.g[data-col]").forEach((c) => {
    cellEls[c.dataset.col + ":" + (c.dataset.row || "hdr")] = c;
  });
  shown = {};
  Q.length = 0;
  const nm = cardEl.querySelector("#kn-name");
  if (!me) nm.addEventListener("input", () => { S.name = nm.value; save(); });
  nm.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nm.blur(); });
  sync(false);
  markColumn();
}

function sizeCard(w, h, u) {
  cardEl.style.width = w + "px";
  cardEl.style.height = h + "px";
  cardEl.style.setProperty("--u", u + "px");
}

const curCol = () => (MP ? MP.turn : S.history.length);
const colCount = () => (MP ? MP.players.length : COLS);
const hdrName = (j, cols) => { const n = MP.players[j].name; return cols >= 5 && n.length > 8 ? n.slice(0, 7) + "…" : n; };

function markColumn() {
  const col = G && G.phase !== "over" ? curCol() : -1;
  for (const k in cellEls) {
    const c = cellEls[k];
    c.classList.toggle("curc", +c.dataset.col === col);
  }
}

// ---- writing queue: one pen, one thing at a time ----

const Q = [];
let pumping = false, idleCbs = [];
function enqueue(fn) { Q.push(fn); if (!pumping) pump(); }
async function pump() {
  pumping = true;
  while (Q.length) { try { await Q.shift()(); } catch (e) { console.error(e); } }
  pumping = false;
  penOff();
  const cbs = idleCbs; idleCbs = [];
  cbs.forEach((f) => f());
}
const whenIdle = (f) => (pumping ? idleCbs.push(f) : f());

function tween(sec, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (sec * 1000));
      fn(k);
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

let penEl = null, penPos = null;
function penOff() { if (penEl) penEl.classList.remove("on"); penPos = null; }
function penTo(x, y) { penEl.style.transform = `translate(${x - 11}px,${y - 74}px)`; penPos = [x, y]; }
function tipOf(path, dist) {
  const p = path.getPointAtLength(dist), m = path.getScreenCTM();
  return m ? new DOMPoint(p.x, p.y).matrixTransform(m) : { x: 0, y: 0 };
}

function buildNum(value, key) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "kn-num");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const paths = [];
  const add = (d, tf) => {
    const g = document.createElementNS(NS, "g"); g.setAttribute("transform", tf);
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", d);
    g.appendChild(p); svg.appendChild(g); paths.push(p);
  };
  let w;
  if (key === "yb" && value <= 3) {
    for (let i = 0; i < value; i++) add(CHECK, `translate(${i * 7 + 0.6 + rnd(-0.2, 0.2)} ${1 + rnd(-0.3, 0.3)}) rotate(${rnd(-5, 5)} 3 5)`);
    w = value * 7 + 1;
  } else if (value === 0 && CATS.includes(key)) {
    // a field that scored nothing is struck through instead of being written as 0
    add("M0.6 10.4 C4.8 7.6 9.6 4.4 14.6 1.4", "translate(0 0)");
    w = 15.2;
  } else {
    let x = 0.8;
    for (const ch of String(value)) {
      add(DIGIT[ch], `translate(${(x + rnd(-0.2, 0.2)).toFixed(2)} ${(1 + rnd(-0.25, 0.4)).toFixed(2)}) rotate(${rnd(-4, 4).toFixed(1)} 3 5) skewX(-7)`);
      x += 6.5 + rnd(-0.1, 0.4);
    }
    w = x + 0.9;
  }
  svg.setAttribute("viewBox", `0 0 ${w.toFixed(2)} 12`);
  return { svg, paths };
}

function clearCell(cell, fade) {
  cell.querySelectorAll(".kn-num,.kn-ul2").forEach((n) => {
    if (fade) { n.classList.add("erase"); setTimeout(() => n.remove(), 320); } else n.remove();
  });
}

async function writeNow(cell, key, value, animate) {
  clearCell(cell, false);
  const { svg, paths } = buildNum(value, key);
  cell.appendChild(svg);
  if (key === "grand") {
    const ul = document.createElementNS(NS, "svg");
    ul.setAttribute("class", "kn-ul2"); ul.setAttribute("viewBox", "0 0 100 12"); ul.setAttribute("preserveAspectRatio", "none");
    ul.innerHTML = `<path pathLength="1" d="M4 3C30 1 70 4.5 96 2"/><path pathLength="1" d="M8 9.5C34 7.5 66 10.5 93 8.5"/>`;
    cell.appendChild(ul);
    if (!animate) ul.classList.add("done");
  }
  if (!animate) return;
  const lens = paths.map((p) => p.getTotalLength());
  paths.forEach((p, i) => { p.style.strokeDasharray = lens[i] + " " + (lens[i] + 2); p.style.strokeDashoffset = lens[i]; });
  const total = lens.reduce((a, l) => a + 0.1 + l * 0.011, 0);
  scratch(total);
  penEl.classList.add("on");
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i], L = lens[i], s = tipOf(p, 0);
    if (penPos) {                                   // glide from wherever the pen is to the next stroke start
      const [x0, y0] = penPos;
      await tween(0.1, (k) => penTo(x0 + (s.x - x0) * k, y0 + (s.y - y0) * k));
    } else penTo(s.x, s.y);
    await tween(0.1 + L * 0.011, (k) => {
      const e = easeIO(k) * 0.6 + k * 0.4;
      p.style.strokeDashoffset = L * (1 - e);
      const q = tipOf(p, L * e); penTo(q.x, q.y);
    });
  }
  if (key === "grand") {
    cell.querySelector(".kn-ul2").classList.add("go");
    await tween(0.5, () => {});
  }
}

// reconcile what is on the card with what should be there; new numbers go through the pen queue
function applyCol(ci, want, animate) {
  for (const key of [...CATS, "sum", "bonus", "up1", "yb", "low", "up2", "grand"]) {
    const ck = ci + ":" + key, cell = cellEls[ck];
    if (!cell) continue;
    const w = want[key], have = shown[ck];
    if (w === have) continue;
    if (w === undefined) { delete shown[ck]; clearCell(cell, animate); continue; }
    shown[ck] = w;
    if (animate) enqueue(async () => { if (shown[ck] === w && cell.isConnected) await writeNow(cell, key, w, true); });
    else writeNow(cell, key, w, false);
  }
}

function sync(animate) {
  const rules = R().id;
  if (MP) { MP.players.forEach((pl, ci) => applyCol(ci, desired(pl.cur, derive(pl.cur).done, rules), animate)); return; }
  S.history.forEach((g, ci) => applyCol(ci, desired(g, true, rules), animate));
  const live = G && G.phase !== "over";
  const ci = curCol();
  if (cellEls[ci + ":ones"] || cellEls[ci + ":hdr"]) applyCol(ci, live ? desired(G.cur, false, rules) : {}, animate);
}

// pencil previews + click targets for the current roll
function refreshPicks() {
  if (!cardEl) return;
  const live = G.phase === "choose";
  const opts = live ? options(D.map((d) => d.v), G.cur, R().id) : null;
  const ci = curCol();
  for (const key in cellEls) {                       // the turn may have moved to another column (multiplayer)
    if (key.startsWith(ci + ":")) continue;
    const c = cellEls[key];
    if (c.classList.contains("pick") || c.classList.contains("bad")) c.classList.remove("pick", "bad");
    const g = c.querySelector(".kn-ghost"); if (g) g.remove();
  }
  for (const k of CATS) {
    const cell = cellEls[ci + ":" + k];
    if (!cell) continue;
    const ok = !!(opts && k in opts), open = G.cur.cells[k] == null;
    cell.classList.toggle("pick", ok);
    cell.classList.toggle("bad", !!(opts && open && !ok));
    let gh = cell.querySelector(".kn-ghost");
    if (ok) {
      if (!gh) { gh = document.createElement("span"); gh.className = "kn-ghost"; cell.appendChild(gh); }
      gh.textContent = opts[k];
    } else if (gh) gh.remove();
  }
}

function setTheme(delta) {
  S.theme = (S.theme + delta + THEMES.length) % THEMES.length; save();
  applyDiceTheme();
  renderCard(); layout(); updateBar(); refreshPicks();
}

function onCardClick(e) {
  const th = e.target.closest(".kn-th");
  if (th) return setTheme(+th.dataset.th);
  const c = e.target.closest(".kn-c.g");
  if (c && c.dataset.row && +c.dataset.col === curCol() && CATS.includes(c.dataset.row)) pickCat(c.dataset.row);
}

// ============================================================ styling

const CSS = `
/* the shell's top bar is replaced by the in-game tools and the main menu below */
#ui-overlay { display: none !important; }

#kn-root { position: absolute; inset: 0; overflow: hidden; background: #24150c; color: #f3e6c8;
  font-family: Georgia, "Times New Roman", serif; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
#kn-root #kn-gl { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; outline: none; }
#kn-vig { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 90% 85% at 36% 50%, transparent 48%, rgba(8,3,0,.6) 100%); }
#kn-main { position: absolute; inset: 0; display: flex; padding-top: 0; pointer-events: none; }
#kn-dc { position: relative; flex: 1 1 auto; min-width: 0; }
#kn-cc { flex: 0 0 clamp(360px, 38vw, 640px); position: relative; pointer-events: auto; overflow: auto; display: flex;
  padding: 14px 20px 16px 4px; scrollbar-width: thin; scrollbar-color: #8a5f33 transparent; }
#kn-root.narrow #kn-main { flex-direction: column; }
#kn-root.narrow #kn-dc { flex: 0 0 46%; }
#kn-root.narrow #kn-cc { flex: 1 1 0; min-height: 0; padding: 10px 14px 18px; }

.kn-top { position: absolute; left: 22px; top: 12px; display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; pointer-events: none;
  text-shadow: 0 1px 4px rgba(0,0,0,.8); }
.kn-top b { font-size: 20px; letter-spacing: .05em; color: #ffe6a6; font-weight: 700; }
.kn-top span { font-size: 14px; color: #ecdab0; opacity: .9; }
.kn-bottom { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; }
/* a fixed two-line box: the prompt text changes length, and layout() positions the table from this box's height */
.kn-prompt { height: 2.6em; max-width: 560px; font-size: 15px; font-style: italic; color: #f4e3bc; text-shadow: 0 1px 4px #000; text-align: center; padding: 0 16px; line-height: 1.3; }
.kn-ctl { display: flex; align-items: center; gap: 22px; }
#kn-root .kn-roll { pointer-events: auto; cursor: pointer; position: relative; display: flex; align-items: center; gap: 12px; padding: 0 26px; height: 56px; min-width: 210px; justify-content: center;
  font: 700 21px Georgia, serif; letter-spacing: .16em; text-transform: uppercase; color: #3d2106; border: 0; border-radius: 30px;
  background: linear-gradient(#ffe69a 0%, #f2b83e 55%, #d58f1a 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(120,70,0,.35), 0 6px 0 #7d4d0c, 0 14px 22px rgba(0,0,0,.55);
  transition: transform .08s, box-shadow .08s, filter .2s; }
#kn-root .kn-roll kbd { font: 600 11px Georgia, serif; letter-spacing: .06em; text-transform: none; padding: 3px 8px; border-radius: 6px; background: rgba(60,30,0,.16); color: #5a3408; box-shadow: inset 0 -1px 0 rgba(60,30,0,.25); }
#kn-root .kn-roll:hover:not(:disabled) { filter: brightness(1.07); color: #3d2106; background: linear-gradient(#ffeaa6 0%, #f6c04a 55%, #dc9722 100%); border: 0; }
#kn-root .kn-roll:active:not(:disabled) { transform: translateY(4px); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 2px 0 #7d4d0c, 0 6px 10px rgba(0,0,0,.5); }
#kn-root .kn-roll:disabled { cursor: default; filter: saturate(.25) brightness(.7); }
#kn-root .kn-roll.pulse:not(:disabled) { animation: kn-pulse 1.8s ease-in-out infinite; }
@keyframes kn-pulse { 50% { box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 6px 0 #7d4d0c, 0 14px 22px rgba(0,0,0,.55), 0 0 0 9px rgba(255,214,110,.22); } }
.kn-dots { display: flex; gap: 9px; }
.kn-dots i { width: 13px; height: 13px; border-radius: 50%; background: #2a170a; box-shadow: inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,225,170,.25); transition: background .25s, box-shadow .25s; }
.kn-dots i.on { background: radial-gradient(circle at 35% 30%, #fff1b8, #f0b13a 60%, #b8730d); box-shadow: 0 0 10px rgba(255,200,90,.7), inset 0 -1px 2px rgba(120,60,0,.5); }

.kn-over { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 0; transition: opacity .5s; }
.kn-over.show { opacity: 1; pointer-events: auto; }
.kn-over .box { text-align: center; padding: 26px 42px 28px; border-radius: 18px; background: linear-gradient(#3b2516ee, #20120aee);
  border: 2px solid #c99a4a; box-shadow: 0 24px 60px rgba(0,0,0,.65), inset 0 0 0 5px rgba(0,0,0,.25); transform: scale(.92); transition: transform .5s cubic-bezier(.2,1.2,.4,1); }
.kn-over.show .box { transform: none; }
.kn-over h3 { margin: 0 0 4px; font: italic 400 15px Georgia, serif; letter-spacing: .28em; text-transform: uppercase; color: #d9b975; }
.kn-over .big { font: 400 78px/1.05 "Caveat Brush", "Caveat", cursive; color: #ffe08a; text-shadow: 0 3px 0 #7d4d0c, 0 8px 24px rgba(0,0,0,.5); }
.kn-over p { margin: 4px 0 16px; font-size: 15px; color: #ecdab0; }
#kn-root .kn-over button { cursor: pointer; font: 700 15px Georgia, serif; letter-spacing: .12em; text-transform: uppercase; color: #3d2106; border: 0; border-radius: 22px; padding: 12px 28px;
  background: linear-gradient(#ffe69a, #e0a028); box-shadow: 0 4px 0 #7d4d0c, 0 10px 18px rgba(0,0,0,.45); }
#kn-root .kn-over button:hover { color: #3d2106; background: linear-gradient(#fff0b0, #ecb23a); border: 0; }
#kn-root .kn-over button:active { transform: translateY(3px); box-shadow: 0 1px 0 #7d4d0c; }
.kn-err { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; text-align: center; padding: 30px; color: #f4e3bc; font-style: italic; }

/* ---------- the pen ---------- */
#kn-pen { position: fixed; left: 0; top: 0; width: 64px; height: 84px; pointer-events: none; z-index: 60; opacity: 0; transition: opacity .18s; filter: drop-shadow(5px 9px 5px rgba(0,0,0,.35)); }
#kn-pen.on { opacity: 1; }
#kn-pen svg { display: block; overflow: visible; }

/* ---------- the score card ---------- */
.kn-card { --u: 28px; position: relative; margin: auto; flex: none; transform: rotate(.3deg);
  transition: transform .55s cubic-bezier(.55,0,.85,.35), opacity .5s; filter: drop-shadow(0 22px 20px rgba(0,0,0,.55)); }
.kn-card::before, .kn-card::after { content: ""; position: absolute; inset: 0; border-radius: 3px; z-index: -1; box-shadow: 0 1px 2px rgba(0,0,0,.35); }
.kn-card::before { background: #ece6d6; transform: translate(5px, 6px) rotate(.8deg); }
.kn-card::after { background: #e2dccb; transform: translate(-3px, 3px) rotate(-.7deg); }
.kn-card.tear { transform: translate(40px, -120%) rotate(9deg); opacity: 0; }
.kn-card.enter { animation: kn-enter .6s cubic-bezier(.2,.9,.3,1) both; }
@keyframes kn-enter { from { transform: translateY(60px) rotate(-2deg); opacity: 0; } }
.kn-paper { position: relative; width: 100%; height: 100%; box-sizing: border-box; background: var(--paper); border-radius: 3px; overflow: hidden;
  padding: calc(var(--u) * .75) calc(var(--u) * .5) calc(var(--u) * .4); font-family: var(--hand); color: var(--ink); -webkit-user-select: none; user-select: none; }
.kn-paper::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .55; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .46 0 0 0 0 .38 0 0 0 .2 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E"); }
.kn-card.v-blue, .th.v-blue { --paper:#fbfdff; --line:#1d93b8; --ink:#17829f; --title:#1597bf; --pen:#1a36a6; --pencil:#5d7384; --hl:rgba(255,222,86,.42); --curcol:rgba(29,147,184,.07); --lh:1.4px;
  --hand:"Caveat",cursive; --hand-title:"Caveat Brush","Caveat",cursive; --lw:26%; --hw:18%; --fl:.66; --fh:.5; --fg:.35; }
.kn-card.v-mono, .th.v-mono { --paper:#fffffc; --line:#141418; --ink:#17171c; --title:#101012; --pen:#2a2a30; --pencil:#7b7b82; --hl:rgba(255,212,64,.42); --curcol:rgba(0,0,0,.045); --lh:2.2px;
  --hand:"Patrick Hand",cursive; --hand-title:"Permanent Marker",cursive; --lw:29%; --hw:19%; --fl:.58; --fh:.43; --fg:.34; }
.kn-card.v-script, .th.v-script { --paper:#fdfcf8; --line:#4d4d55; --ink:#2b2b31; --title:#1b1b21; --pen:#15151b; --pencil:#8b8b92; --hl:rgba(255,212,64,.4); --curcol:rgba(0,0,0,.04); --lh:1px;
  --hand:"Kalam",cursive; --hand-title:"Yellowtail","Kalam",cursive; --lw:29%; --hw:19%; --fl:.5; --fh:.4; --fg:.34; }
.v-mono .kn-lab, .v-mono .hw { text-transform: uppercase; }
.v-mono .kn-ttl .t { transform: skewX(-6deg); }

/* the theme arrows sit at the right end of the name row, clear of the page's own "Design" button */
.kn-themes { flex: none; display: flex; align-items: flex-end; gap: calc(var(--u) * .24); margin-left: calc(var(--u) * .1); padding-bottom: 1px; z-index: 3; }
#kn-root .kn-th { flex: none; width: calc(var(--u) * .98); height: calc(var(--u) * .98); min-height: 0; padding: 0; display: grid; place-items: center; border-radius: 50%; cursor: pointer; color: var(--ink);
  background: transparent; border: var(--lh) solid var(--line); box-shadow: none; transition: background .15s, transform .1s; }
#kn-root .kn-th:hover { background: var(--hl); color: var(--ink); border-color: var(--line); box-shadow: none; }
#kn-root .kn-th:active { transform: scale(.9); }
.kn-th svg { width: 60%; height: 60%; fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; stroke-linejoin: round; }
.kn-head { height: calc(var(--u) * 3.3); position: relative; display: flex; flex-direction: column; justify-content: space-between; }
.kn-ttl { position: relative; display: flex; align-items: baseline; gap: calc(var(--u) * .6); line-height: 1; padding-top: calc(var(--u) * .1); }
.kn-ttl .t { font-family: var(--hand-title); font-size: calc(var(--u) * 2.1); color: var(--title); }
.kn-ttl .s { font-size: calc(var(--u) * .95); }
.v-mono .kn-ttl .s { font-family: var(--hand-title); font-size: calc(var(--u) * .95); }
.v-script .kn-ttl .t { font-size: calc(var(--u) * 1.85); line-height: .9; }
.v-script .kn-head { height: calc(var(--u) * 3.3); }
.v-script .kn-ttl { padding-top: 0; }
.kn-ul { position: absolute; left: 0; bottom: calc(var(--u) * -.2); width: 42%; height: calc(var(--u) * .3); overflow: visible; }
.kn-ul path { fill: none; stroke: var(--title); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; animation: kn-dash .7s ease-out .55s forwards; }
.v-script .kn-ul path { stroke-width: 1.2; }
.kn-name { display: flex; align-items: flex-end; gap: .5em; font-size: calc(var(--u) * .78); height: calc(var(--u) * 1); }
.kn-name > span { line-height: 1; padding-bottom: 2px; }
.kn-name input { flex: 1; min-width: 0; border: 0; border-bottom: var(--lh) solid var(--line); background: transparent; font: inherit; font-size: calc(var(--u) * .9); line-height: 1.1;
  color: var(--pen); outline: none; padding: 0 4px; -webkit-user-select: text; user-select: text; }
.kn-name input[readonly] { cursor: default; }
.kn-name input::placeholder { color: var(--pencil); opacity: .5; }

.kn-tbl { display: block; }
.kn-r { position: relative; display: grid; grid-template-columns: var(--lw) var(--hw) repeat(var(--n), minmax(0, 1fr)); height: calc(var(--u) * var(--h, 1)); }
.kn-r::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; border-bottom: var(--lh) solid var(--line); transform-origin: left; animation: kn-draw .55s ease-out backwards; animation-delay: var(--b, 0s); pointer-events: none; }
.kn-r.top::before { content: ""; position: absolute; left: 0; right: 0; top: 0; border-top: var(--lh) solid var(--line); transform-origin: left; animation: kn-draw .55s ease-out backwards; animation-delay: var(--b, 0s); pointer-events: none; }
.kn-r.gap::after, .kn-r.gap .kn-c { border: 0; }
.kn-c { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; border-left: var(--lh) solid var(--line); }
.kn-c:last-child { border-right: var(--lh) solid var(--line); }
.kn-r.gap .kn-c { border: 0; align-items: flex-end; }
.kn-c.l { justify-content: flex-start; padding-left: calc(var(--u) * .3); gap: calc(var(--u) * .16); font-size: calc(var(--u) * var(--fl)); line-height: .82; }
.kn-c.sec { font-size: calc(var(--u) * .56); }
.kn-r.hd .kn-c.l { border-left-color: transparent; }
.kn-r.hd .kn-c.l, .kn-r.hd .kn-c.h { border-left-color: transparent; }
.kn-r.hd .kn-c.h { border-left: 0; }
.kn-c.h { justify-content: center; text-align: center; padding: 0 calc(var(--u) * .1); font-size: calc(var(--u) * var(--fh)); line-height: .86; }
.kn-r.gap .kn-c.l { border: 0; }
.kn-c.hdrc { font-size: calc(var(--u) * var(--fg)); white-space: nowrap; letter-spacing: -.01em; }
.kn-r.tot .kn-c.l, .kn-r.grand .kn-c.l { font-weight: 700; }
.v-mono .kn-r.tot .kn-c.l { font-size: calc(var(--u) * .56); font-family: var(--hand-title); }
.kn-r.grand .kn-c.l { font-size: calc(var(--u) * var(--fl) * 1.15); }

.hw { display: inline; }
.hw .w { display: inline-block; white-space: nowrap; }
.hw i { display: inline-block; font-style: normal; animation: kn-wipe .2s ease-out backwards; animation-delay: calc(var(--b, 0s) + var(--k) * 36ms); }
.hw.big i { animation-duration: .3s; animation-delay: calc(var(--b, 0s) + var(--k) * 90ms); }
@keyframes kn-wipe { from { clip-path: inset(-35% 100% -35% -10%); } to { clip-path: inset(-35% -10% -35% -10%); } }
@keyframes kn-draw { from { transform: scaleX(0); } }
@keyframes kn-dash { to { stroke-dashoffset: 0; } }

.kn-die { width: calc(var(--u) * .74); height: calc(var(--u) * .74); flex: none; overflow: visible; }
.ico { display: inline-flex; align-items: center; gap: calc(var(--u) * .06); }
.ico.sm .kn-die { width: calc(var(--u) * .5); height: calc(var(--u) * .5); }
.kn-die .dr { fill: none; stroke: var(--ink); stroke-width: 1; stroke-dasharray: 1; }
.kn-die .dr { stroke-dasharray: 46; stroke-dashoffset: 46; animation: kn-dash .5s ease-out forwards; animation-delay: var(--b, 0s); }
.kn-die circle { fill: var(--ink); animation: kn-pop .25s ease-out backwards; animation-delay: calc(var(--b, 0s) + .3s); transform-origin: center; transform-box: fill-box; }
@keyframes kn-pop { from { transform: scale(0); } }
.kn-arrow { width: 68%; height: calc(var(--u) * .5); overflow: visible; }
.kn-arrow path { fill: none; stroke: var(--ink); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: kn-dash .5s ease-out forwards; animation-delay: var(--b, 0s); }

.kn-c.g { overflow: visible; }
.kn-c.curc { background: var(--curcol); }
.kn-c.pick { cursor: pointer; }
.kn-c.pick:hover { background: var(--hl); }
.kn-c.bad { cursor: not-allowed; background-image: repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, var(--line) 28%, transparent) 4px 5px); }
.kn-ghost { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--hand); font-size: calc(var(--u) * .72);
  color: var(--pencil); opacity: .55; pointer-events: none; transition: opacity .15s; animation: kn-fade .25s ease-out; }
.kn-c.pick:hover .kn-ghost { opacity: 1; color: var(--pen); }
@keyframes kn-fade { from { opacity: 0; } }
.kn-num { position: absolute; left: 9%; top: 50%; width: 82%; height: calc(var(--u) * .74); margin-top: calc(var(--u) * -.37); overflow: visible; pointer-events: none; transition: opacity .3s; }
.kn-num path { fill: none; stroke: var(--pen); stroke-width: 1.15; stroke-linecap: round; stroke-linejoin: round; }
.kn-num.erase { opacity: 0; }
.kn-ul2 { position: absolute; left: 6%; right: 6%; bottom: 6%; width: 88%; height: 22%; overflow: visible; pointer-events: none; }
.kn-ul2 path { fill: none; stroke: var(--pen); stroke-width: 1.5; stroke-linecap: round; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; }
.kn-ul2.go path { transition: stroke-dashoffset .35s ease-out; stroke-dashoffset: 0; } .kn-ul2.go path + path { transition-delay: .2s; }
.kn-ul2.done path { stroke-dashoffset: 0; }
.kn-c.curc.hdrc::after { content: ""; position: absolute; inset: 14% -2% 8%; border: calc(var(--lh) * 1.3) solid var(--pen); border-radius: 50%; opacity: .75; transform: rotate(-2deg); animation: kn-fade .4s ease-out .8s backwards; pointer-events: none; }
@media (max-width: 700px) {
  .kn-top { left: 14px; top: 8px; gap: 10px; } .kn-top b { font-size: 16px; } .kn-top span { font-size: 12px; }
  #kn-root .kn-roll { height: 50px; min-width: 170px; font-size: 18px; } .kn-bottom { bottom: 8px; gap: 6px; } .kn-prompt { font-size: 13px; }
}
/* ---------- in-game tools + main menu ---------- */
.kn-tools { position: absolute; right: 16px; top: 10px; display: flex; gap: 8px; z-index: 5; pointer-events: auto; }
#kn-root .kn-tools button { cursor: pointer; display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; font: 700 14px Georgia, serif; letter-spacing: .06em; color: #f6e7b4;
  background: linear-gradient(#6b4528, #3f2616); border: 1px solid #c99a4a; border-radius: 19px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 3px 0 #1b0e06, 0 8px 14px rgba(0,0,0,.4); transition: transform .08s, filter .2s; }
#kn-root .kn-tools button:hover:not(:disabled) { filter: brightness(1.14); color: #f6e7b4; background: linear-gradient(#7a502e, #46291a); border-color: #e0b866; }
#kn-root .kn-tools button:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 1px 0 #1b0e06; }
#kn-root .kn-tools button:disabled { opacity: .38; cursor: default; }
.kn-tools svg { width: 17px; height: 17px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.kn-tools .mute { display: none; } .kn-tools #kn-t-sound.off .mute { display: inline; }
.kn-tools #kn-t-sound { padding: 0 11px; } .kn-tools #kn-t-sound.off { opacity: .6; } .kn-tools #kn-t-sound.off .wave { display: none; }

#kn-menu { position: absolute; inset: 0; z-index: 70; display: none; overflow: auto; -webkit-user-select: none; user-select: none;
  background: radial-gradient(ellipse at 50% 36%, rgba(70,38,16,.5), rgba(10,4,0,.88) 72%); backdrop-filter: blur(8px) saturate(.9); -webkit-backdrop-filter: blur(8px) saturate(.9); }
#kn-menu.show { display: block; animation: mn-in .45s ease-out; }
@keyframes mn-in { from { opacity: 0; } }
.mn-wrap { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 18px 26px; text-align: center; }
.mn-dice { display: flex; gap: 14px; margin-bottom: 8px; }
.mn-dice svg { width: 48px; height: 48px; overflow: visible; filter: drop-shadow(0 10px 8px rgba(0,0,0,.5)); animation: mn-bob 3.4s ease-in-out infinite; }
@keyframes mn-bob { 0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-10px) rotate(calc(var(--r, 0deg) + 6deg)); } }
.mn-title { margin: 4px 0 0; font: 400 clamp(60px, 9vw, 96px)/1 "Caveat Brush", "Caveat", cursive; color: #ffe08a; text-shadow: 0 4px 0 #7d4d0c, 0 16px 30px rgba(0,0,0,.55); }
.mn-sub { margin: 6px 0 22px; font: italic 400 15px Georgia, serif; letter-spacing: .26em; text-transform: uppercase; color: #d9b975; }
.mn-list { display: flex; flex-direction: column; gap: 12px; width: min(450px, 100%); }
#kn-root .mn-btn { display: flex; align-items: center; gap: 16px; text-align: left; cursor: pointer; padding: 13px 20px; border-radius: 18px; border: 1px solid #c99a4a; color: #ffe6a6; font-family: Georgia, serif;
  background: linear-gradient(#70492a, #3b2314); box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 5px 0 #1b0e06, 0 14px 24px rgba(0,0,0,.45); transition: transform .12s, filter .2s, box-shadow .12s; }
#kn-root .mn-btn .ic { flex: none; width: 46px; height: 46px; overflow: visible; filter: drop-shadow(0 3px 3px rgba(0,0,0,.4)); }
#kn-root .mn-btn b { display: block; font: 700 19px Georgia, serif; letter-spacing: .1em; text-transform: uppercase; }
#kn-root .mn-btn small { display: block; margin-top: 3px; font: italic 400 14px/1.25 Georgia, serif; color: #e0c78e; letter-spacing: 0; text-transform: none; }
#kn-root .mn-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.12); color: #ffe6a6; background: linear-gradient(#7d5230, #45291a); border-color: #e0b866; }
#kn-root .mn-btn.pri:hover:not(:disabled) { color: #3d2106; background: linear-gradient(#fff0b0, #ecb23a); border-color: #fff0b8; }
#kn-root .mn-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 2px 0 #1b0e06, 0 6px 10px rgba(0,0,0,.4); }
#kn-root .mn-btn.pri { color: #3d2106; border-color: #fff0b8; background: linear-gradient(#ffe69a, #e2a42a); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 5px 0 #7d4d0c, 0 14px 24px rgba(0,0,0,.5); }
#kn-root .mn-btn.pri small { color: #6b4308; }
#kn-root .mn-btn:disabled { opacity: .5; cursor: default; }
.mn-foot { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
#kn-root .mn-link { font: 600 14px Georgia, serif; letter-spacing: .04em; color: #e9cf8c; background: none; border: 0; cursor: pointer; padding: 9px 14px; border-radius: 12px; text-decoration: none; }
#kn-root .mn-link.ico { padding: 9px 11px; display: inline-flex; }
#kn-root .mn-link svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#kn-root .mn-link .mute { display: none; } #kn-root .mn-link.off .mute { display: inline; } #kn-root .mn-link.off .wave { display: none; } #kn-root .mn-link.off { opacity: .7; }
#kn-root .mn-link:hover { background: rgba(255,255,255,.1); color: #fff0c4; border: 0; }
.mn-types { width: min(760px, 100%); margin-top: 26px; }
.mn-h { margin: 0 0 6px; font: italic 400 15px Georgia, serif; letter-spacing: .28em; text-transform: uppercase; color: #d9b975; }
.mn-note { min-height: 18px; margin: 0 auto 4px; font-size: 13.5px; color: #ecdab0; }
.mn-strip { display: flex; gap: 20px; overflow-x: auto; padding: 14px 18px 20px; scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: #8a5f33 transparent; }
.mn-strip > :first-child { margin-left: auto; } .mn-strip > :last-child { margin-right: auto; }   /* centred while it fits, scrolls when more cards are added */
.mn-strip::-webkit-scrollbar { height: 8px; } .mn-strip::-webkit-scrollbar-thumb { background: #8a5f33; border-radius: 4px; }
#kn-root .mn-card { position: relative; flex: none; white-space: normal; overflow: visible; box-shadow: 0 6px 14px rgba(0,0,0,.35); line-height: 1.25; letter-spacing: 0; text-transform: none; scroll-snap-align: center; width: 156px; padding: 11px 11px 13px; cursor: pointer; border-radius: 16px; border: 2px solid rgba(201,154,74,.32); background: rgba(40,22,10,.62); color: #f6e7b4; font-family: Georgia, serif; text-align: center; transition: transform .15s, border-color .15s, box-shadow .15s; }
#kn-root .mn-card:hover:not(:disabled) { transform: translateY(-5px) rotate(-.7deg); border-color: #c99a4a; background: rgba(60,34,15,.8); color: #f6e7b4; }
#kn-root .mn-card.sel { border-color: #ffd66e; background: rgba(72,42,18,.78); box-shadow: 0 0 0 4px rgba(255,214,110,.2), 0 16px 28px rgba(0,0,0,.5); }
#kn-root .mn-card:hover:not(:disabled) { box-shadow: 0 12px 22px rgba(0,0,0,.45); }
#kn-root .mn-card.sel:hover:not(:disabled) { box-shadow: 0 0 0 4px rgba(255,214,110,.2), 0 16px 28px rgba(0,0,0,.5); }
#kn-root .mn-card.sel::after { content: "✓"; position: absolute; top: -9px; right: -9px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font: 700 14px Georgia, serif; color: #3d2106; background: linear-gradient(#ffe69a, #e0a028); box-shadow: 0 2px 6px rgba(0,0,0,.5); }
#kn-root .mn-card:disabled { opacity: .5; cursor: not-allowed; }
#kn-root .mn-card b { display: block; margin: 10px 0 2px; font-size: 16px; font-weight: 700; letter-spacing: .04em; }
#kn-root .mn-card small { display: block; font-style: italic; font-weight: 400; font-size: 12.5px; color: #d9c08a; line-height: 1.25; }
#kn-root .mn-card small.rd { margin-top: 4px; color: #b99a62; font-size: 12px; }
.th { position: relative; display: block; width: 100%; aspect-ratio: .74; overflow: hidden; border-radius: 3px; background: var(--paper); box-shadow: 0 8px 14px rgba(0,0,0,.45); font-family: var(--hand); }
.th i { position: absolute; font-style: normal; }
.th .tt { left: 9%; top: 4%; font: 400 26px/1.1 var(--hand-title); color: var(--title); }
.th .tg { left: 9%; right: 9%; top: 29%; bottom: 9%; border: var(--lh) solid var(--line);
  background: linear-gradient(90deg, transparent 46%, var(--line) 46% calc(46% + 1px), transparent 0), linear-gradient(90deg, transparent 73%, var(--line) 73% calc(73% + 1px), transparent 0), repeating-linear-gradient(transparent 0 13px, var(--line) 13px 14px); }
.th .tn { left: 55%; font: 400 20px/1 var(--hand); color: var(--pen); }
.th .td { right: 6%; bottom: 5%; width: 30px; height: 30px; border-radius: 7px; transform: rotate(14deg);
  background: radial-gradient(circle at 28% 28%, var(--dp) 0 3.2px, transparent 3.7px), radial-gradient(circle at 72% 72%, var(--dp) 0 3.2px, transparent 3.7px), var(--db);
  box-shadow: 0 4px 6px rgba(0,0,0,.4), inset 0 -2px 3px rgba(0,0,0,.2); }
@media (max-width: 700px) {
  .mn-title { font-size: 66px; } .mn-dice svg { width: 42px; height: 42px; } .mn-dice { gap: 9px; } .mn-sub { margin-bottom: 18px; font-size: 13px; }
  #kn-root .mn-card { width: 140px; } .mn-btn { padding: 11px 16px; } .mn-btn b { font-size: 17px; } .kn-tools .lb { display: none; } .kn-tools #kn-t-menu .lb { display: inline; } .kn-tools { right: 10px; top: 8px; }
}
/* inside the multiplayer hub the game fills the stage (the hub's own dock stays on top) */
#kn-root.hub { position: fixed; inset: 0; z-index: 30; }
.hub-stage.hub-kniffel { padding: 0; border: 0; background: none; box-shadow: none; }
#kn-root.hub .kn-top { left: 252px; max-width: 270px; gap: 2px 12px; }
#kn-root.hub #kn-t-undo { display: none; }                      /* no undo with other players at the table */
@media (max-width: 700px) { #kn-root.hub .kn-top { left: 14px; top: 64px; } }
@media (prefers-reduced-motion: reduce) { .hw i, .kn-r::after, .kn-r::before { animation: none !important; } }
`;

// ============================================================ HUD, layout, game flow

let G = null;
let root, dcEl, ccEl, roundEl, scoreEl, bestEl, promptEl, rollBtn, dotsEl, overEl, newArmed = false, armTimer = 0;

const freshGame = () => ({ phase: "idle", rolls: 3, cur: { cells: {}, yb: 0 }, snap: null, rolling: null, rollT: 0, restT: 0, nudges: 0, final: null });
G = freshGame();

const note = (msg) => { flashNote(msg); promptEl.textContent = msg; clearTimeout(note.t); note.t = setTimeout(updateHUD, 2600); };

function updateHUD() {
  if (!root) return;
  const me = MP && MP.players.find((p) => p.id === MP.myId), cur = me ? me.cur : G.cur;
  const filled = CATS.filter((c) => cur.cells[c] != null).length;
  const over = G.phase === "over";
  roundEl.textContent = t("round", over ? ROUNDS : filled + 1);
  const total = liveTotal(cur);
  scoreEl.textContent = t("score") + " " + total;
  bestEl.textContent = MP ? (over ? "" : "▶ " + MP.players[MP.turn].name) : S.best ? t("best") + " " + S.best : "";
  const can = (G.phase === "idle" || G.phase === "choose") && G.rolls > 0;
  rollBtn.disabled = !can;
  rollBtn.classList.toggle("pulse", G.phase === "idle");
  rollBtn.querySelector(".t").textContent = t("roll");
  rollBtn.querySelector("kbd").textContent = t("rollKey");
  [...dotsEl.children].forEach((d, i) => d.classList.toggle("on", i < G.rolls && !over));
  dotsEl.title = t("left", G.rolls);
  const hint = G.phase === "wait" ? t("mpTurn", MP.players[MP.turn].name) : G.phase === "idle" ? (MP ? t("yourTurn") : t("pIdle")) : G.phase === "choose" ? (G.rolls > 0 ? t("pHold") : t("pPick")) : "";
  // while you are at the table in a multiplayer game, say so on every step of your turn (idle already says it)
  promptEl.textContent = MP && G.phase === "choose" ? t("turnMine") + " – " + hint : hint;
  setStatus(t("round", over ? ROUNDS : filled + 1) + " · " + total, over ? "solved" : null);
  const u = document.getElementById("kn-t-undo");
  if (u) u.disabled = !!MP || !(G.snap && G.phase === "idle");
}

// the small tools top right (undo, sound) and, while it is open, the menu
function updateBar() {
  const u = document.getElementById("kn-t-undo");
  if (u) u.disabled = !!MP || !(G.snap && G.phase === "idle");
  const sd = document.getElementById("kn-t-sound");
  if (sd) sd.classList.toggle("off", !S.sound);
  if (menuEl && menuIsOpen()) menuRender();
}

function layout() {
  if (!root) return;
  const bar = document.getElementById("ui-overlay");
  const barH = bar ? Math.ceil(bar.getBoundingClientRect().bottom) : 56;
  root.style.setProperty("--bar", barH + "px");
  const W = root.clientWidth, H = root.clientHeight;
  const narrow = W < 900 || W < H * 1.05;
  root.classList.toggle("narrow", narrow);

  if (cardEl.firstChild) {
    // the text size comes from a full-size card, so a variant with fewer fields (Generala) gets a shorter card, not bigger writing
    const ratio = 0.66, units = cardUnits(), U = Math.max(units, 27);
    const cw = ccEl.clientWidth - (narrow ? 28 : 24), ch = ccEl.clientHeight - (narrow ? 28 : 30);
    let w, h;
    if (narrow) { w = Math.min(cw, 560); h = w / ratio; }
    else { h = Math.max(U * 16, Math.min(ch, cw / ratio)); w = Math.min(cw, h * ratio); h = w / ratio; }
    const u = h / U;
    sizeCard(Math.round(w), Math.round(u * units), u);
  }

  const r = dcEl.getBoundingClientRect(), rr = root.getBoundingClientRect();
  const topPad = 46, botPad = dcEl.querySelector(".kn-bottom").offsetHeight + 10;
  fitBox = {
    cx: r.left - rr.left + r.width / 2, cy: r.top - rr.top + topPad + (r.height - topPad - botPad) / 2,
    w: Math.max(100, r.width - 24), h: Math.max(80, r.height - topPad - botPad),
  };
  fitCamera();
}

// ---- turn logic ----

const vals = () => D.map((d) => d.v);

function doRoll() {
  if (G.phase === "over") return newGame();
  if (G.phase !== "idle" && G.phase !== "choose") return;
  if (G.rolls <= 0) return note(t("noHold"));
  if (D.every((d) => d.held)) return note(t("allHeld"));
  audio();
  const rolled = D.filter((d) => !d.held).map((d) => d.i);
  G.rolls--; G.snap = null; mpSnap = "";
  const seed = startRoll();
  if (MP) mpSend({ t: "rs", idx: rolled, rolls: G.rolls, seed, held: D.filter((d) => d.held).map((d) => [d.i, d.slot]) });
  updateHUD(); refreshPicks();
}

function rollSettled() {
  G.phase = myTurn() ? "choose" : "wait";          // a spectator replays the roll but doesn't get control
  if (G.pendingSnap) { const m = G.pendingSnap; G.pendingSnap = null; applyDiceSnap(m); }
  updateHUD(); refreshPicks();
  if (G.pendingPick && MP) { const pm = G.pendingPick; G.pendingPick = null; mpGame(pm, MP.players[MP.turn].id); }
}

// click on a die: tray -> nearest free rack slot, rack -> back into the tray row
function toggleHold(i) {
  if (G.phase === "idle") return note(t("needRoll"));
  if (G.phase !== "choose") return;
  const d = D[i];
  if (G.rolls <= 0) return note(t("noHold"));
  setHover(-1);
  if (d.held) releaseDie(d);
  else { const s = nearestSlot(dieX(d), true, d); if (s >= 0) holdAt(d, s); }
  updateHUD();
}

// keys 1-5: the dice from left to right in the tray, then the ones on the rack
function keyHold(n) {
  const byX = (a, b) => dieX(a) - dieX(b);
  const order = [...D.filter((d) => !d.held).sort(byX), ...D.filter((d) => d.held).sort(byX)];
  if (order[n - 1]) toggleHold(order[n - 1].i);
}

function pickCat(k) {
  if (G.phase === "idle") return note(t("needRoll"));
  if (G.phase !== "choose") return;
  const d = vals(), opts = options(d, G.cur, R().id);
  if (!(k in opts)) return G.cur.cells[k] == null ? note(t("joker")) : undefined;
  G.snap = MP ? null : { cells: { ...G.cur.cells }, yb: G.cur.yb, slots: D.map((x) => (x.held ? x.slot : -1)), rolls: G.rolls };
  if (R().yb && d.every((v) => v === d[0]) && G.cur.cells.kniffel === 50) { G.cur.yb++; flashNote(t("jokerBonus")); }
  G.cur.cells[k] = opts[k];
  if (D.some((x) => x.held)) { for (const x of D) { x.held = false; x.slot = -1; } layoutRow(D, { dur: 0.6, arc: 1.0 }); }   // rack dice rejoin the row, order kept
  G.rolls = 3;
  if (MP) {
    mpSend({ t: "pick", cat: k, val: opts[k], yb: G.cur.yb });
    mpAdvance(); sync(true); markColumn(); updateHUD(); refreshPicks(); mpFinishCheck();
    return;
  }
  if (derive(G.cur).done) endGame(); else G.phase = "idle";
  sync(true); markColumn(); updateHUD(); refreshPicks();
  if (G.phase === "over") whenIdle(() => setTimeout(showOver, 700));
}

function endGame() {
  G.phase = "over"; G.snap = null;
  const total = liveTotal(G.cur);
  S.history.push({ cells: { ...G.cur.cells }, yb: G.cur.yb });
  const isBest = total > S.best;
  if (isBest) S.best = total;
  G.final = { total, isBest };
  save();
}

// shown once the pen has written every total
function showOver() {
  if (G.phase !== "over") return;
  if (MP) return showOverMP();
  const { total, isBest } = G.final;
  overEl.querySelector("h3").textContent = t("over");
  overEl.querySelector(".big").textContent = total;
  overEl.querySelector("p").textContent = isBest ? t("newBest") : t("best") + " " + S.best;
  overEl.querySelector("button").textContent = t("again");
  overEl.classList.add("show");
  celebrate(total >= 300 ? 3 : total >= 220 ? 2 : 1);
}

function undo() {
  if (MP) return;
  const s = G.snap;
  if (!s || G.phase !== "idle") return;
  G.cur.cells = s.cells; G.cur.yb = s.yb; G.rolls = s.rolls; G.snap = null; G.phase = "choose";
  if (s.slots.some((v) => v >= 0)) {
    D.forEach((d, i) => { if (s.slots[i] >= 0) holdAt(d, s.slots[i], i * 0.05); });
    layoutRow(D.filter((d) => !d.held), { dur: 0.6, arc: 0.6 });
  }
  sync(true); markColumn(); updateHUD(); refreshPicks();
}

function newGame(skipConfirm, rebuild) {
  if (MP && !rebuild) {                             // in a multiplayer game this button leaves the room
    if (!skipConfirm && !MP.over && !newArmed) {
      newArmed = true; updateBar();
      clearTimeout(armTimer); armTimer = setTimeout(() => { newArmed = false; updateBar(); }, 2500);
      return;
    }
    newArmed = false; clearTimeout(armTimer);
    return leaveMP();
  }
  const started = G.phase !== "over" && CATS.some((c) => G.cur.cells[c] != null);
  if (!skipConfirm && started && !rebuild) {
    if (!newArmed) {
      newArmed = true; updateBar();
      clearTimeout(armTimer); armTimer = setTimeout(() => { newArmed = false; updateBar(); }, 2500);
      return;
    }
  }
  newArmed = false; clearTimeout(armTimer);
  overEl.classList.remove("show");
  for (const d of D) if (d.state === "phys") world.removeBody(d.body);
  const tear = S.history.length >= COLS;
  const finish = () => {
    G = freshGame();
    placeDice(); setHover(-1);
    if (tear || rebuild) renderCard(); else { sync(true); markColumn(); }
    if (tear) { cardEl.classList.remove("tear"); cardEl.classList.add("enter"); setTimeout(() => cardEl.classList.remove("enter"), 700); }
    layout(); updateBar(); updateHUD(); refreshPicks();
  };
  if (tear) {
    S.history = []; save();
    cardEl.classList.add("tear");
    setTimeout(finish, 520);
  } else finish();
}

// switch the rule set (solo): finished games and the best score are kept per variant
function setRules(id) {
  if (MP || !RULES[id] || id === S.rules) return;
  save();
  S.rules = id; applyRules(id);
  S.history = S.histAll[id]; S.best = S.bests[id];
  save();
  newGame(true, true);
}
function toggleSound() { S.sound = !S.sound; save(); updateBar(); if (S.sound) { audio(); clack(0.4); } }

// ============================================================ multiplayer (inside the hub)
// The hub owns the room (connection, player list, host, invite link, QR code, lobby). This game only
// sends its own messages through NET: the host announces the start ("begin"), the player whose turn it is
// announces rolls (a seed, so every client simulates the same roll), where the dice came to rest, and the
// field they wrote; everybody else replays that.

const MAX_PLAYERS = 6;
let mpSnap = "", mpTimer = 0, hubReady = false, inbox = [];
const myTurn = () => !MP || MP.players[MP.turn].id === MP.myId;
const mpSend = (msg, to) => { if (NET && MP) NET.send("k", msg, to); };
const cleanName = (n) => String(n || "").trim().slice(0, 12) || t("player");
const cleanPlayers = (a) => (Array.isArray(a) ? a.slice(0, MAX_PLAYERS).map((p) => ({ id: String(p.id), name: cleanName(p.name) })) : []);
const hubPlayers = () => NET.players.map((p) => ({ id: p.id, name: p.name }));

function onNet(m, from) {
  if (!m || typeof m !== "object" || !from) return;
  if (m.t === "begin") {                                  // the host chose the variant and started
    if (from !== NET.hostId) return;
    if (!D.length) { inbox = [[m, from]]; return; }       // 3D is still loading: start as soon as it is there
    mpStart(cleanPlayers(m.players), m.rules);
  } else if (MP) mpGame(m, from);
  else if (inbox.length) inbox.push([m, from]);
}

function onPeerLeave(id) {
  if (!MP) return;
  const pl = MP.players.find((p) => p.id === id);
  if (!pl || pl.left) return;
  pl.left = true;
  if (!MP.over && MP.players[MP.turn].id === id) {            // it was their turn: skip them
    if (D.some((d) => d.held)) { for (const x of D) { x.held = false; x.slot = -1; } layoutRow(D, { dur: 0.6, arc: 1.0 }); }
    mpAdvance(); sync(true); markColumn(); refreshPicks(); mpFinishCheck();
  }
  updateHUD();
}

// host: start the game for everybody with the chosen variant
function mpBegin(players, rules) {
  if (!NET.isHost) return;
  NET.send("k", { t: "begin", rules, players });
  mpStart(players, rules);
}
function mpRematch() {
  if (!MP || !NET.isHost) return;
  mpBegin(MP.players.filter((p) => !p.left).map((p) => ({ id: p.id, name: p.name })), MP.rules);
}

function mpStart(players, rid) {
  if (!NET || !D.length || !players.some((p) => p.id === NET.me.id)) return;
  const rr = RULES[rid] ? rid : "kniffel";
  MP = { host: NET.isHost, hostId: NET.hostId, myId: NET.me.id, rules: rr, turn: 0, over: false,
         players: players.map((p) => ({ id: p.id, name: p.name, cur: { cells: {}, yb: 0 }, left: !NET.players.some((q) => q.id === p.id) })) };
  menuClose();
  overEl.classList.remove("show");
  for (const d of D) if (d.state === "phys") world.removeBody(d.body);
  G = freshGame(); G.cur = MP.players[0].cur; G.phase = myTurn() ? "idle" : "wait";
  mpSnap = "";
  applyRules(rr);
  applyDiceTheme(); placeDice(); setHover(-1);
  renderCard(); layout(); updateBar(); updateHUD(); refreshPicks();
  clearInterval(mpTimer); mpTimer = setInterval(mpTick, 300);
  const queued = inbox; inbox = [];
  for (const [m, from] of queued) onNet(m, from);
}

const leaveMP = () => { if (NET) NET.leave(); };

// ---- turn handling (every client runs the same state machine) ----

function mpAdvance() {
  const n = MP.players.length;
  let nxt = -1;
  for (let k = 1; k <= n; k++) {
    const i = (MP.turn + k) % n, p = MP.players[i];
    if (!p.left && !derive(p.cur).done) { nxt = i; break; }
  }
  mpSnap = "";
  G.rolls = 3; G.snap = null; G.pendingSnap = null; G.pendingPick = null;
  if (nxt < 0) { MP.over = true; G.phase = "over"; return; }
  MP.turn = nxt; G.cur = MP.players[nxt].cur;
  G.phase = myTurn() ? "idle" : "wait";
}
function mpFinishCheck() { if (MP && MP.over) whenIdle(() => setTimeout(showOver, 700)); }

// the player whose turn it is publishes where the dice lie, once they have come to rest
function mpTick() {
  if (!MP || !NET || !myTurn() || G.phase !== "choose") return;
  if (D.some((d) => d.state !== "rest")) return;
  const snap = { t: "dice", rolls: G.rolls, d: D.map((d) => ({ v: d.v, h: d.held ? 1 : 0, s: d.slot, x: +d.mesh.position.x.toFixed(2) })) };
  const key = JSON.stringify(snap);
  if (key !== mpSnap) { mpSnap = key; mpSend(snap); }
}

// where the roller's dice lie (sent once they have come to rest): corrects a client whose own simulation differs
function applyDiceSnap(m) {
  G.rolls = clamp(m.rolls | 0, 0, 3);
  m.d.forEach((o, i) => {
    const d = D[i], v = clamp(o.v | 0, 1, 6), held = !!o.h;
    d.v = v; d.held = held; d.slot = held ? clamp(o.s | 0, 0, 4) : -1;
    const p = new THREE.Vector3(held ? slotX(d.slot) : clamp(+o.x || 0, -7.5, 7.5), HALF, held ? RACK_DZ : ROW_Z);
    const was = d.state === "anim" ? d.rest.p : d.mesh.position, top = topFace(d.mesh.quaternion);
    if (d.state === "rest" && Math.hypot(was.x - p.x, was.z - p.z) < 0.05 && Math.abs(d.mesh.position.y - HALF) < 0.03 && top.v === v && top.dot > 0.9995) return;
    tweenDie(d, { p, q: faceQuat(v, Math.round(rnd(0, 3)) * Math.PI / 2 + rnd(-0.07, 0.07)) }, { dur: 0.55, arc: held ? 1.1 : 0.4, delay: i * 0.04 });
  });
  updateHUD();
}

function mpGame(m, from) {
  if (!MP || MP.over || from !== MP.players[MP.turn].id || from === MP.myId) return;
  const pl = MP.players[MP.turn];
  if (m.t === "pick" && (G.phase === "scoop" || G.phase === "rolling" || G.phase === "settle")) { G.pendingPick = m; return; }   // finish replaying the roll first
  if (m.t === "rs") {
    const idx = (Array.isArray(m.idx) ? m.idx : []).map((i) => i | 0).filter((i) => i >= 0 && i < 5);
    if (!idx.length) return;
    G.rolls = clamp(m.rolls | 0, 0, 3); G.pendingSnap = null;
    for (const o of Array.isArray(m.held) ? m.held : []) {       // dice just put on the rack go there right away, not after the roll
      const d = D[o[0] | 0], sl = clamp(o[1] | 0, 0, 4);
      if (!d || idx.includes(d.i)) continue;
      if (d.state === "phys") world.removeBody(d.body);
      holdAt(d, sl);
    }
    for (const i of idx) { const d = D[i]; d.held = false; d.slot = -1; d.hover = 0; if (d.state === "phys") world.removeBody(d.body); }
    startRoll(m.seed | 0, idx.map((i) => D[i]));        // the same roll, simulated here
    updateHUD();
  } else if (m.t === "dice") {
    if (!Array.isArray(m.d) || m.d.length !== 5) return;
    if (G.phase === "scoop" || G.phase === "rolling" || G.phase === "settle") { G.pendingSnap = m; return; }   // still replaying: apply when it has settled
    applyDiceSnap(m);
  } else if (m.t === "pick") {
    const cat = m.cat;
    if (!CATS.includes(cat) || pl.cur.cells[cat] != null) return;
    pl.cur.cells[cat] = clamp(m.val | 0, 0, 100); pl.cur.yb = clamp(m.yb | 0, 0, 9);
    if (D.some((d) => d.held)) { for (const x of D) { x.held = false; x.slot = -1; } layoutRow(D, { dur: 0.6, arc: 1.0 }); }
    mpAdvance(); sync(true); markColumn(); updateHUD(); refreshPicks(); mpFinishCheck();
  }
}

function showOverMP() {
  const rk = MP.players.map((p) => ({ n: p.name, tot: liveTotal(p.cur), me: p.id === MP.myId })).sort((a, b) => b.tot - a.tot);
  overEl.querySelector("h3").textContent = t("over");
  overEl.querySelector(".big").textContent = rk[0].tot;
  overEl.querySelector("p").innerHTML = "<b>" + t("win", esc(rk[0].n)) + "</b><br>" + rk.map((r) => esc(r.n) + " " + r.tot).join(" · ");
  overEl.querySelector("button").textContent = MP.host ? t("rematch") : t("leave");
  overEl.classList.add("show");
  if (rk[0].me) celebrate(2);
}

// ============================================================ main menu

let menuEl, menuView = "main", soloArmed = false, soloTimer = 0;
const menuIsOpen = () => !!menuEl && menuEl.classList.contains("show");
const progress = () => !HUB && (G.phase !== "over" && (G.phase !== "idle" || CATS.some((c) => G.cur.cells[c] != null)));
function menuOpen(view = "main") { menuView = view; soloArmed = false; menuRender(); menuEl.classList.add("show"); }
function menuClose() { if (menuEl && !(HUB && !MP)) menuEl.classList.remove("show"); }      // in the hub the pre-game screen stays until the host starts

function menuDie(n, i) {
  const pips = PIPS[n].map(([x, y]) => `<circle cx="${6 + x * 36}" cy="${6 + y * 36}" r="3.7" fill="#16171d"/>`).join("");
  return `<svg viewBox="0 0 48 48" style="--r:${[-8, 6, -3, 9, -6][i]}deg;animation-delay:${(-i * 0.6).toFixed(1)}s"><rect x="4" y="4" width="40" height="40" rx="10" fill="#f5f0e2"/><rect x="4" y="4" width="40" height="40" rx="10" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="1.5"/>${pips}</svg>`;
}
const dieIco = (x, y, r, n) => `<g transform="translate(${x} ${y}) rotate(${r} 14 14)"><rect width="28" height="28" rx="7" fill="#f5f0e2" stroke="rgba(0,0,0,.18)"/>${PIPS[n].map(([px, py]) => `<circle cx="${3.5 + px * 21}" cy="${3.5 + py * 21}" r="2.4" fill="#16171d"/>`).join("")}</g>`;
const ICO = {
  play: `<svg class="ic" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#7d4d0c" opacity=".25"/><path d="M18 12 36 24 18 36z" fill="#3d2106"/></svg>`,
  solo: `<svg class="ic" viewBox="0 0 48 48">${dieIco(10, 10, -10, 5)}</svg>`,
  multi: `<svg class="ic" viewBox="0 0 48 48">${dieIco(2, 14, -14, 3)}${dieIco(18, 6, 12, 6)}</svg>`,
};

function ruleStrip(locked) {
  return `<section class="mn-types"><h2 class="mn-h">${t("mnCard")}</h2><p class="mn-note">${locked ? t("mnCardLocked") : HUB ? "" : progress() ? t("mnCardHint") : ""}</p>
    <div class="mn-strip">${RULE_IDS.map((id) => `<button class="mn-card${id === S.rules ? " sel" : ""}" data-act="rules" data-id="${id}" ${locked ? "disabled" : ""} aria-pressed="${id === S.rules}">
      <span class="th v-${V().id}"><i class="tt">${RULES[id].name}</i><i class="tg"></i><i class="tn" style="top:35%">12</i><i class="tn" style="top:45%">9</i><i class="tn" style="top:55%">24</i><i class="td" style="--db:${V().dice.body};--dp:${V().dice.pip}"></i></span>
      <b>${RULES[id].name}</b><small>${t("rc_" + id)}</small><small class="rd">${t("rd_" + id)}</small></button>`).join("")}</div></section>`;
}

function menuRender() {
  if (!menuEl) return;
  const keepScroll = (menuEl.querySelector(".mn-strip") || {}).scrollLeft || 0;
  const sound = `<button class="mn-link ico${S.sound ? "" : " off"}" data-act="sound" title="${S.sound ? t("mnSoundOn") : t("mnSoundOff")}" aria-label="${S.sound ? t("mnSoundOn") : t("mnSoundOff")}" aria-pressed="${S.sound}"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="wave" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="mute" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg></button>`;
  const head = `<div class="mn-dice">${[5, 3, 6, 2, 4].map(menuDie).join("")}</div><h1 class="mn-title">Kniffel</h1><p class="mn-sub">${t("mnTag")}</p>`;
  let body;
  if (HUB && !MP) {                                           // before the game: the host picks the variant and starts
    body = `<div class="mn-list">${NET.isHost
      ? `<button class="mn-btn pri" data-act="begin" ${hubReady ? "" : "disabled"}>${ICO.play}<span><b>${t("mnBegin")}</b><small>${hubReady ? t("mnBeginSub", NET.players.length) : t("mnLoading")}</small></span></button>`
      : `<p class="mn-note" style="margin:0">${t("mnHubWait")}</p>`}</div>${ruleStrip(!NET.isHost)}
      <div class="mn-foot">${sound}</div>`;
  } else if (HUB) {                                           // a running game
    body = `<div class="mn-list"><button class="mn-btn pri" data-act="resume">${ICO.play}<span><b>${t("mnResume")}</b><small>${t("mnResumeMp")}</small></span></button>
      ${NET.isHost ? `<button class="mn-btn" data-act="lobby">${ICO.multi}<span><b>${t("mnToLobby")}</b><small>${t("mnToLobbySub")}</small></span></button>` : ""}
      <button class="mn-btn" data-act="leave">${ICO.solo}<span><b>${t("mnLeaveRoom")}</b><small>${t("mnLeaveRoomSub")}</small></span></button></div>
      <div class="mn-foot">${sound}</div>`;
  } else {                                                    // solo page
    const prog = progress();
    body = `<div class="mn-list">
      ${prog ? `<button class="mn-btn pri" data-act="resume">${ICO.play}<span><b>${t("mnResume")}</b><small>${t("mnResumeSub")}</small></span></button>` : ""}
      <button class="mn-btn" data-act="solo">${ICO.solo}<span><b>${soloArmed ? t("mnSure") : prog ? t("mnSoloAgain") : t("mnSolo")}</b><small>${soloArmed ? t("mnSureSub") : t("mnSoloSub")}</small></span></button>
      <button class="mn-btn" data-act="multi">${ICO.multi}<span><b>${t("mnMulti")}</b><small>${t("mnMultiSub")}</small></span></button></div>${ruleStrip(false)}
      <div class="mn-foot">${typeof _openInfo === "function" ? `<button class="mn-link" data-act="how">${t("mnHow")}</button>` : ""}${sound}<a class="mn-link" href="index.html">${t("mnAll")}</a></div>`;
  }
  menuEl.innerHTML = `<div class="mn-wrap">${head}${body}</div>`;
  const strip = menuEl.querySelector(".mn-strip");
  if (strip) strip.scrollLeft = keepScroll;
}

function menuSolo() {
  if (progress() && !soloArmed) {                    // the running game is lost: ask once
    soloArmed = true; clearTimeout(soloTimer);
    soloTimer = setTimeout(() => { soloArmed = false; if (menuIsOpen()) menuRender(); }, 3000);
    return menuRender();
  }
  soloArmed = false; clearTimeout(soloTimer);
  if (G.phase !== "idle" || CATS.some((c) => G.cur.cells[c] != null)) newGame(true);
  menuClose();
}

function onMenuClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  switch (b.dataset.act) {
    case "resume": menuClose(); break;
    case "solo": menuSolo(); break;
    case "multi": location.href = "index.html?mode=multi"; break;                 // rooms and game switching live in the multiplayer hub
    case "rules": { if (!MP && b.dataset.id !== S.rules && (!HUB || NET.isHost)) setRules(b.dataset.id); menuRender(); break; }
    case "begin": if (HUB && NET.isHost && hubReady && !MP) mpBegin(hubPlayers(), S.rules); break;
    case "lobby": if (HUB && NET.isHost) NET.end(); break;
    case "leave": leaveMP(); break;
    case "how": if (typeof _openInfo === "function") _openInfo(); break;
    case "sound": toggleSound(); break;
  }
}

// ---- boot ----

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("failed " + src));
    document.head.appendChild(s);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fontsReady() {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Caveat+Brush&family=Patrick+Hand&family=Permanent+Marker&family=Yellowtail&family=Kalam:wght@300;400&family=Space+Mono:wght@700&display=swap";
  document.head.appendChild(l);
  const want = ['500 20px "Caveat"', '20px "Caveat Brush"', '20px "Patrick Hand"', '20px "Permanent Marker"', '20px "Yellowtail"', '300 20px "Kalam"'];
  return new Promise((res) => { l.onload = () => Promise.all(want.map((f) => document.fonts.load(f))).then(res, res); l.onerror = res; });
}

function buildDOM() {
  const st = rootStyleEl = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  root = document.createElement("div");
  root.id = "kn-root";
  root.innerHTML = `
    <canvas id="kn-gl"></canvas><div id="kn-vig"></div>
    <div id="kn-main">
      <div id="kn-dc">
        <div class="kn-top"><b id="kn-round"></b><span id="kn-score"></span><span id="kn-best"></span></div>
        <div class="kn-tools">
          <button id="kn-t-undo" title="${t("undo")} (U)"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg><span class="lb">${t("undo")}</span></button>
          <button id="kn-t-sound" title="${t("sound")}"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="wave" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="mute" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg></button>
          <button id="kn-t-menu" title="${t("menuBtn")} (Esc)"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="lb">${t("menuBtn")}</span></button>
        </div>
        <div class="kn-bottom">
          <div class="kn-prompt" id="kn-prompt"></div>
          <div class="kn-ctl"><button class="kn-roll" id="kn-roll"><span class="t"></span><kbd></kbd></button>
            <div class="kn-dots" id="kn-dots"><i></i><i></i><i></i></div></div>
        </div>
        <div class="kn-over" id="kn-over"><div class="box"><h3></h3><div class="big"></div><p></p><button></button></div></div>
        <div class="kn-err" id="kn-err"></div>
      </div>
      <div id="kn-cc"><div class="kn-card" id="kn-card"></div></div>
    </div>
    <div id="kn-menu"></div>
    <div id="kn-pen"><svg width="64" height="84" viewBox="0 0 64 84"><g transform="translate(11 74) rotate(30)">
      <path d="M0 0 -2.6-11h5.2z" fill="#d7dae2"/><path d="M-.5-.6h1v-1.6h-1z" fill="#2a2a30"/>
      <rect x="-3.4" y="-70" width="6.8" height="59" rx="3.2" fill="#1d3a8f"/><rect x="-3.4" y="-70" width="2.2" height="59" rx="1.1" fill="#fff" opacity=".28"/>
      <rect x="-3.4" y="-24" width="6.8" height="3" fill="#c9ccd6"/><rect x="2" y="-66" width="1.6" height="30" rx=".8" fill="#c9ccd6"/>
      <rect x="-1.4" y="-76" width="2.8" height="7" rx="1.2" fill="#c9ccd6"/></g></svg></div>`;
  if (HUB) root.classList.add("hub");
  (env.root || document.getElementById("canvas-wrap")).appendChild(root);
  dcEl = root.querySelector("#kn-dc"); ccEl = root.querySelector("#kn-cc"); cardEl = root.querySelector("#kn-card");
  roundEl = root.querySelector("#kn-round"); scoreEl = root.querySelector("#kn-score"); bestEl = root.querySelector("#kn-best");
  promptEl = root.querySelector("#kn-prompt"); rollBtn = root.querySelector("#kn-roll"); dotsEl = root.querySelector("#kn-dots");
  overEl = root.querySelector("#kn-over"); penEl = root.querySelector("#kn-pen");
  rollBtn.addEventListener("click", doRoll);
  overEl.querySelector("button").addEventListener("click", () => (MP ? (NET.isHost ? mpRematch() : leaveMP()) : newGame(true)));
  menuEl = root.querySelector("#kn-menu");
  menuEl.addEventListener("click", onMenuClick);
  root.querySelector("#kn-t-undo").addEventListener("click", () => undo());
  root.querySelector("#kn-t-sound").addEventListener("click", () => toggleSound());
  root.querySelector("#kn-t-menu").addEventListener("click", () => menuOpen());
  cardEl.addEventListener("click", onCardClick);
  const ro = new ResizeObserver(layout);
  ro.observe(root); ro.observe(root.querySelector(".kn-bottom"));       // the prompt can wrap to two lines on phones
  observers.push(ro);

  document.addEventListener("keydown", onKeyDown = (e) => {
    if (menuIsOpen()) { if (e.key === "Escape") menuClose(); return; }
    if (e.target.closest && e.target.closest("input,textarea,select")) { if (e.key === "Escape") e.target.blur(); return; }
    if (e.key === "Escape") return menuOpen();
    if (e.altKey) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); return undo(); }
    if (e.ctrlKey || e.metaKey) return;
    if (k === " " || k === "Spacebar" || k === "r" || k === "R") { e.preventDefault(); doRoll(); }
    else if (k >= "1" && k <= "5") keyHold(+k);
    else if (k === "u" || k === "U") undo();
  });
}

if (!HUB && typeof initGame === "function") initGame({
  title: "Kniffel · Yahtzee",
  tag: "roll · hold · write it down",
  fullscreen: true,
  presets: [{ label: "Kniffel", values: [0] }],     // the shell's preset menu is hidden; the game has its own
  buttons: [],                                   // the shell's top bar is hidden: tools and menu are drawn by this game
  sliders: [],
  onPreset: () => {},
  onSlider: () => {},
  onClamp: () => {},
  getSliderValues: () => ({}),
  info: {
    anim: infoAnim,
    get title() { return t("infoTitle"); },
    get text() { return t("info"); },
  },
});

document.documentElement.lang = S.lang;
buildDOM();
if (HUB) {
  NET.onMessage("k", ({ data, from }) => onNet(data, from));
  NET.onEvent("leave", (p) => onPeerLeave(p.id));
  NET.onEvent("host", () => { if (MP) { MP.hostId = NET.hostId; MP.host = NET.isHost; } updateHUD(); if (menuIsOpen()) menuRender(); });
}
menuOpen();
updateBar();
updateHUD();
layout();

(async () => {
  const libs = Promise.all([
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"),
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"),
  ]).then(() => {
    if (destroyed) return;
    init3D(); layout(); if (menuIsOpen()) menuRender();
    if (inbox.length) { const [m, from] = inbox[0]; inbox = []; onNet(m, from); }       // a "begin" that came in while 3D loaded
  });
  await Promise.race([fontsReady(), sleep(3500)]);
  renderCard();
  layout();
  refreshPicks();
  try { await libs; } catch (e) {
    console.error(e);
    const er = root.querySelector("#kn-err");
    er.style.display = "flex";
    er.textContent = S.lang === "de" ? "Die 3D-Würfel konnten nicht geladen werden (Internetverbindung nötig)." : "Couldn't load the 3D dice (needs an internet connection).";
  }
})();

// ============================================================ info modal animation
// (p, w, h, frame) 440×280 @30fps — roll, hold two threes, re-roll, write 12 into the Threes row. Loops.

function infoAnim(p, w, h, f) {
  const T = f % 300, ctx = p.drawingContext;
  p.background(54, 33, 19);
  p.noStroke();
  for (let i = 0; i < 9; i++) { p.fill(255, 220, 160, 6); p.rect(0, 18 + i * 31, w, 8); }
  // felt tray + rack
  p.fill(36, 20, 10); p.rect(14, 18, 232, 150, 16);
  p.fill(35, 112, 72); p.rect(20, 24, 220, 138, 12);
  p.fill(86, 50, 26); p.rect(30, 190, 200, 58, 10);
  p.fill(255, 232, 190, 90); p.textAlign(p.CENTER, p.CENTER); p.textSize(11); p.text("H E L D", 130, 238);
  const first = [3, 3, 5, 2, 6], second = [3, 3, 3, 3, 4];
  const pips = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .27], [.27, .5], [.27, .73], [.73, .27], [.73, .5], [.73, .73]] };
  const die = (cx, cy, s, n, rot) => {
    p.push(); p.translate(cx, cy); p.rotate(rot);
    p.fill(0, 0, 0, 55); p.rect(-s / 2 + 3, -s / 2 + 5, s, s, s * .2);
    p.fill(246, 241, 227); p.rect(-s / 2, -s / 2, s, s, s * .2);
    p.fill(20, 20, 26);
    for (const [x, y] of pips[n]) p.circle((x - .5) * s, (y - .5) * s, s * .17);
    p.pop();
  };
  const s = 38, gx = (i) => 48 + i * 42;
  const rolling1 = T < 50, rolling2 = T > 118 && T < 168;
  for (let i = 0; i < 5; i++) {
    const heldNow = i < 2 && T > 78 && T < 252;
    const hy = heldNow ? easeInOutQuad(p.constrain((T - 78) / 16, 0, 1)) : (i < 2 && T >= 252 ? 1 - easeInOutQuad(p.constrain((T - 252) / 16, 0, 1)) : 0);
    let y = 94 + hy * 122, rot = 0, n = (T < 168 || i < 2) ? first[i] : second[i];
    if (T >= 168 || i < 2) n = i < 2 ? 3 : (T >= 168 ? second[i] : first[i]);
    if (rolling1 || (rolling2 && i >= 2)) {
      const k = (rolling1 ? T : T - 118) / 50;
      y = 94 - Math.sin(Math.min(1, k) * Math.PI * 3) * 34 * (1 - k) + (i % 2 ? -8 : 8) * (1 - k);
      rot = (1 - k) * (i + 2) * 2.2 + Math.sin(T * 0.7 + i) * 0.2;
      n = 1 + ((T * 7 + i * 5) >> 2) % 6;
    }
    die(gx(i) + 6, y, s, n, rot);
  }
  // card
  p.fill(0, 0, 0, 60); p.rect(272, 24, 150, 236, 4);
  p.fill(252, 253, 255); p.rect(266, 18, 150, 236, 3);
  p.stroke(29, 147, 184); p.strokeWeight(1);
  for (let r = 0; r < 12; r++) p.line(272, 50 + r * 16.5, 410, 50 + r * 16.5);
  for (const x of [332, 360, 388]) p.line(x, 50, x, 248);
  p.noStroke(); p.fill(21, 151, 191); p.textStyle(p.BOLD); p.textAlign(p.LEFT, p.CENTER); p.textSize(15); p.text("Kniffel", 274, 36);
  p.stroke(29, 147, 184, 150); p.strokeWeight(1.4); p.noFill();
  for (let r = 0; r < 11; r++) { const y = 58 + r * 16.5; p.beginShape(); for (let x = 0; x <= 44; x += 4) p.vertex(276 + x, y + Math.sin(x * 0.7 + r) * 1.6); p.endShape(); }
  // handwritten 12 in the Threes row
  const prog = p.constrain((T - 190) / 46, 0, 1);
  if (prog > 0) {
    ctx.save(); ctx.translate(337, 91.5 - 8); ctx.scale(1.9, 1.9);
    ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a36a6";
    const seg = [[1, 12, 0, 0.5], [2, 22, 7, 1]];
    const tot = prog * 2;
    seg.forEach(([dg, len, dx], i) => {
      const k = p.constrain(tot - i, 0, 1);
      if (k <= 0) return;
      ctx.save(); ctx.translate(dx, 0); ctx.setLineDash([len * k, 999]); ctx.stroke(new Path2D(DIGIT[dg])); ctx.restore();
    });
    ctx.restore();
    if (prog < 1) { p.noStroke(); p.fill(26, 54, 166); p.circle(337 + 8 + prog * 14, 91.5 + 4, 4); }
  }
  // pulsing hint rings
  if (T > 62 && T < 80) { p.noFill(); p.stroke(255, 220, 120, 200 - (T - 62) * 10); p.strokeWeight(2); p.circle(gx(0) + 6, 94, 48 + (T - 62) * 1.5); p.circle(gx(1) + 6, 94, 48 + (T - 62) * 1.5); }
}

// test hook: /games/kniffel/?debug exposes the internals as window.__kn
if (/[?&]debug\b/.test(location.search)) {
  window.__kn = {
    get G() { return G; }, get camera() { return camera; }, get scene() { return scene; }, get renderer() { return renderer; },
    get fitBox() { return fitBox; }, D, S, get MP() { return MP; }, mpStart, mpBegin, mpRematch, doRoll, pickCat, toggleHold, newGame, options, undo, setRules, setTheme, derive, RULES, sync, layout,
  };
}

function destroy() {
  destroyed = true;
  cancelAnimationFrame(raf);
  clearInterval(mpTimer); clearTimeout(soloTimer);
  if (onKeyDown) document.removeEventListener("keydown", onKeyDown);
  observers.forEach((o) => o.disconnect());
  try { if (renderer) { renderer.dispose(); const ext = renderer.getContext && renderer.getContext().getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } } catch {}
  try { if (actx) actx.close(); } catch {}
  if (rootStyleEl) rootStyleEl.remove();
  if (root) root.remove();
}

return { destroy, go() { hubReady = true; if (menuIsOpen()) menuRender(); } };
};

if (!window.__KN_HUB__) window.createKniffel();
