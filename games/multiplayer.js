// Multiplayer hub — one WebRTC room per page, usable by every game.
//
// Peer to peer, no game server: players meet in a room (5-letter code) through Trystero's public
// Nostr relays and then talk directly. Loaded by index.html next to game.js; it does nothing (and
// loads nothing) until a game or the lobby window calls host() / join().
//
//   Multiplayer.host({ name })            -> Promise<state>   open a new room, you are the host
//   Multiplayer.join(code, { name })      -> Promise<state>   join a room by its code
//   Multiplayer.leave()                                       leave the room
//   Multiplayer.send(type, data, toId?)                       message to everybody (or to one player)
//   Multiplayer.on(event, fn) -> off()                        events, see README.md
//   Multiplayer.start(opts?) / endGame() / setGame(id)        host: start the game, back to the lobby
//   Multiplayer.state / players / me / isHost / roomUrl()     read the current room
//   Multiplayer.openUI() / closeUI() / mountButton(el)        the shared lobby window with QR code
//
// Full reference: games/README.md → "Multiplayer".

(function () {
  "use strict";

  const TRYSTERO = "https://cdn.jsdelivr.net/npm/trystero@0.26.0/nostr/+esm";
  const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  const APP_ID = "malte9799-games";
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LEN = 5;

  // ---- text (German first; English kept for later) ----
  const TXT = {
    de: {
      title: "Mehrspieler", sub: "Bis zu {max} Freunde – ohne Konto, direkte Verbindung.", yourName: "Dein Name", player: "Spieler",
      create: "Raum erstellen", join: "Beitreten", or: "oder", hostT: "Neuen Raum öffnen", hostS: "Du bekommst Code, Link und QR-Code zum Einladen.",
      joinT: "Mit Code beitreten", roomCode: "Raumcode", copyLink: "Einladungslink kopieren", copied: "Link kopiert!", share: "Teilen …", shareText: "Komm in meinen Raum ({code})",
      players: "Spieler", start: "Spiel starten", pick: "Spiel auswählen", needMore: "Warte auf weitere Spieler …", tooMany: "Zu viele Spieler für dieses Spiel (max. {n}).", waitHost: "Warte auf den Start durch den Host …",
      connecting: "Verbinde …", leave: "Raum verlassen", you: "du", host: "Host", game: "Spiel",
      full: "Der Raum ist voll oder das Spiel läuft schon.", noRoom: "Kein Raum mit diesem Code gefunden.",
      netFail: "Verbindung fehlgeschlagen. Prüfe deine Internetverbindung.", hostLeft: "Der Host hat den Raum verlassen.",
      qrTitle: "Mitspieler einladen", qrHint: "QR-Code scannen – öffnet direkt diesen Raum", close: "Schließen", button: "Mehrspieler",
      inGame: "Spiel läuft", back: "Zurück zur Lobby",
    },
    en: {
      title: "Multiplayer", sub: "Up to {max} friends — no account, direct connection.", yourName: "Your name", player: "Player",
      create: "Create room", join: "Join", or: "or", hostT: "Open a new room", hostS: "You get a code, a link and a QR code to invite friends.",
      joinT: "Join with a code", roomCode: "Room code", copyLink: "Copy invite link", copied: "Link copied!", share: "Share…", shareText: "Join my room ({code})",
      players: "Players", start: "Start game", pick: "Choose game", needMore: "Waiting for more players…", tooMany: "Too many players for this game (max {n}).", waitHost: "Waiting for the host to start…",
      connecting: "Connecting…", leave: "Leave room", you: "you", host: "host", game: "Game",
      full: "That room is full or already playing.", noRoom: "No room found with that code.",
      netFail: "Couldn't connect. Check your internet connection.", hostLeft: "The host left the room.",
      qrTitle: "Invite players", qrHint: "Scan the QR code — it opens this room directly", close: "Close", button: "Multiplayer",
      inGame: "Game running", back: "Back to lobby",
    },
  };

  // ---- configuration (games may override via configure()) ----
  const cfg = { lang: "de", game: null, min: 2, max: 6, gameMax: null, gameParam: true, lobbyStart: true, appId: APP_ID, nameKey: "mp_name" };

  const t = (k, vars) => {
    let s = (TXT[cfg.lang] || TXT.de)[k] ?? TXT.de[k] ?? k;
    if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
    return s;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cleanName = (n) => String(n || "").trim().slice(0, 12) || t("player");
  const makeCode = () => { let c = ""; for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; return c; };
  const cleanPlayers = (a) => (Array.isArray(a) ? a.slice(0, 12).map((p) => ({ id: String(p.id), name: cleanName(p.name) })) : []);

  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  // ---- state ----
  // R is the room we are in (null when not in one):
  //   { code, selfId, name, hostId, status: "connecting"|"lobby"|"playing", game, options, players: [{ id, name }], max }
  let R = null;
  let net = null;                                  // { send(msg, targetId?), leave(), selfId }
  let peers = new Set();                           // WebRTC peers currently connected
  let connectTimer = 0;
  let session = 0;                                 // bumps on every host()/join()/leave(), so stale async work can bail out
  let lastError = "";
  const listeners = {};

  function on(ev, fn) {
    (listeners[ev] || (listeners[ev] = new Set())).add(fn);
    return () => listeners[ev].delete(fn);
  }
  function emit(ev, data) {
    for (const fn of [...(listeners[ev] || [])]) { try { fn(data); } catch (e) { console.error("[Multiplayer] listener for '" + ev + "' failed", e); } }
    for (const fn of [...(listeners["*"] || [])]) { try { fn(ev, data); } catch (e) { console.error(e); } }
  }

  const snapshot = () => R && {
    code: R.code, selfId: R.selfId, hostId: R.hostId, isHost: R.hostId === R.selfId, status: R.status,
    game: R.game, options: R.options, max: R.max, min: cfg.min,
    players: R.players.map((p) => ({ id: p.id, name: p.name, host: p.id === R.hostId, you: p.id === R.selfId })),
  };

  // ---- connection ----
  async function netOpen(code) {
    // via Function so the Vite dev server doesn't rewrite it (it would prepend an `import` to this classic script and break loading)
    const mod = await new Function("u", "return import(u)")(TRYSTERO);
    const room = mod.joinRoom({ appId: cfg.appId }, code);
    const a = room.makeAction("mp");
    const send = (msg, target) => (Array.isArray(a) ? a[0](msg, target) : a.send(msg, target ? { target } : undefined));
    const handler = (m, meta) => onWire(m, typeof meta === "string" ? meta : meta && meta.peerId);
    if (Array.isArray(a)) a[1](handler); else a.onMessage = handler;
    room.onPeerJoin = (id) => {
      peers.add(id);
      // a guest introduces itself to everybody it meets; the host answers by sending the player list
      if (R && R.hostId !== R.selfId && R.status === "connecting") send({ t: "hello", name: R.name }, id);
    };
    room.onPeerLeave = (id) => { peers.delete(id); onPeerLeave(id); };
    net = { send, selfId: mod.selfId, leave: () => { try { room.leave(); } catch {} net = null; } };
    return net;
  }

  function wipe() {
    clearTimeout(connectTimer);
    if (net) net.leave();
    peers = new Set();
    R = null; net = null;
  }

  function fail(msg) {
    session++;
    const had = !!R;
    wipe(); lastError = msg;
    if (had) emit("close", { reason: "error", message: msg });
    emit("error", { message: msg });
    ui.render();
  }

  async function host(opts = {}) {
    if (R) leave();
    const my = ++session;
    const name = cleanName(opts.name ?? store.get(cfg.nameKey));
    if (opts.name) store.set(cfg.nameKey, name);
    lastError = "";
    R = { code: makeCode(), selfId: null, name, hostId: null, status: "connecting", game: cfg.game, options: null, players: [], max: cfg.max };
    ui.render();
    try { await netOpen(R.code); } catch (e) { console.error(e); if (my === session) fail(t("netFail")); throw e; }
    if (my !== session) return;
    R.selfId = R.hostId = net.selfId;
    R.players = [{ id: R.selfId, name }];
    R.status = "lobby";
    emit("status", "lobby"); emit("join", playerOf(R.selfId)); emit("players", snapshot().players);
    ui.render();
    return snapshot();
  }

  async function join(code, opts = {}) {
    code = String(code || "").trim().toUpperCase();
    if (code.length < 3) return;
    if (R) leave();
    const my = ++session;
    const name = cleanName(opts.name ?? store.get(cfg.nameKey));
    store.set(cfg.nameKey, name);
    lastError = ""; ui.lastCode = code;
    R = { code, selfId: null, name, hostId: null, status: "connecting", game: cfg.game, options: null, players: [], max: cfg.max };
    ui.render();
    try { await netOpen(code); } catch (e) { console.error(e); if (my === session) fail(t("netFail")); throw e; }
    if (my !== session) return;
    R.selfId = net.selfId;
    connectTimer = setTimeout(() => { if (my === session && R && R.status === "connecting") fail(t("noRoom")); }, 20000);
    ui.render();
    return new Promise((resolve) => {                       // resolves with the room once the host answered, null if it never does
      const offs = [on("status", (s) => { if (s === "lobby") done(snapshot()); }), on("close", () => done(null))];
      const done = (v) => { offs.forEach((o) => o()); resolve(v); };
    });
  }

  function leave() {
    if (!R) return;
    session++;
    wipe();
    emit("close", { reason: "left" });
    ui.render();
  }

  // ---- wire protocol ----
  // { t: "hello", name }              guest -> host    "let me in"
  // { t: "lobby", players, hostId, status, game, options, max }   host -> everybody, whenever something changed
  // { t: "full" }                     host -> guest    refused
  // { t: "start", game, options, players }   host -> everybody
  // { t: "end" }                      host -> everybody  game over, back to lobby
  // { t: "g", k: type, d: data }      anybody -> anybody  game message
  const playerOf = (id) => { const p = R && R.players.find((x) => x.id === id); return p ? { id: p.id, name: p.name, host: p.id === R.hostId, you: p.id === R.selfId } : null; };
  const wireLobby = () => ({ t: "lobby", players: R.players, hostId: R.hostId, status: R.status, game: R.game, options: R.options, max: R.max });
  const broadcastLobby = () => { if (net && R && R.hostId === R.selfId) net.send(wireLobby()); };

  function onWire(m, from) {
    if (!m || typeof m !== "object" || !from || !R) return;
    const isHost = R.hostId === R.selfId;
    switch (m.t) {
      case "hello": {
        if (!isHost || R.status === "connecting") return;
        if (R.status === "playing" || R.players.length >= R.max) return net.send({ t: "full" }, from);
        if (!R.players.some((p) => p.id === from)) {
          let name = cleanName(m.name), n = 1;
          while (R.players.some((p) => p.name === name)) name = cleanName(m.name).slice(0, 10) + ++n;
          R.players.push({ id: from, name });
          emit("join", playerOf(from)); emit("players", snapshot().players);
        }
        broadcastLobby(); ui.render();
        break;
      }
      case "full":
        if (!isHost && R.status === "connecting") fail(t("full"));
        break;
      case "lobby": {
        if (isHost) return;
        const hid = String(m.hostId || "");
        // accept the list from the host, or from the successor when the old host is gone
        if (!(from === R.hostId || (hid === from && R.hostId !== R.selfId && !peers.has(R.hostId)))) return;
        applyLobby(m, from);
        break;
      }
      case "start":
        if (from === R.hostId && !isHost && R.status !== "connecting") {
          clearTimeout(connectTimer);
          onStart({ game: String(m.game || R.game || "") || null, options: m.options ?? null, players: cleanPlayers(m.players) });
        }
        break;
      case "end":
        if (from === R.hostId && !isHost) onEnd();
        break;
      case "g":
        if (R.status === "connecting" || !R.players.some((p) => p.id === from)) return;
        emit("message", { type: String(m.k), data: m.d, from, player: playerOf(from) });
        emit("message:" + m.k, { type: String(m.k), data: m.d, from, player: playerOf(from) });
        break;
    }
  }

  function applyLobby(m, from) {
    const was = R.status, prev = R.players, prevHost = R.hostId;
    clearTimeout(connectTimer);
    R.hostId = from;
    R.players = cleanPlayers(m.players);
    R.max = Math.min(12, m.max | 0 || R.max);
    const prevGame = R.game;
    R.game = m.game ? String(m.game) : null;
    R.options = m.options ?? null;
    const st = m.status === "playing" ? "playing" : "lobby";
    // players who joined / left since the last list
    for (const p of R.players) if (!prev.some((x) => x.id === p.id)) emit("join", playerOf(p.id));
    for (const p of prev) if (!R.players.some((x) => x.id === p.id)) emit("leave", { id: p.id, name: p.name, host: p.id === prevHost, you: false });
    if (prevHost !== from && prevHost) emit("host", { hostId: from, previous: prevHost, you: false });
    if (was !== st) { R.status = st; emit("status", st); }
    if (prevGame !== R.game) emit("game", R.game);
    emit("players", snapshot().players);
    ui.render();
  }

  function onPeerLeave(id) {
    if (!R) return;
    const gone = R.players.find((p) => p.id === id);
    if (!gone) return;
    const wasHost = id === R.hostId;
    R.players = R.players.filter((p) => p.id !== id);
    emit("leave", { id: gone.id, name: gone.name, host: wasHost, you: false });
    if (wasHost) {
      if (R.status === "connecting") return fail(t("hostLeft"));
      // the player who has been in the room the longest takes over; everybody computes the same answer
      R.hostId = R.players[0] ? R.players[0].id : R.selfId;
      emit("host", { hostId: R.hostId, previous: id, you: R.hostId === R.selfId });
      if (R.hostId === R.selfId) broadcastLobby();
    } else if (R.hostId === R.selfId) broadcastLobby();
    emit("players", snapshot().players);
    ui.render();
  }

  function onStart({ game, options, players }) {
    R.status = "playing"; R.game = game; R.options = options;
    R.players = R.players.filter((p) => players.some((x) => x.id === p.id));
    emit("status", "playing");
    emit("start", { game, options, players: snapshot().players, isHost: R.hostId === R.selfId });
    ui.render();
  }

  function onEnd() {
    R.status = "lobby"; R.options = null;
    emit("status", "lobby"); emit("end", {});
    ui.render();
  }

  // ---- host controls ----
  const canStart = () => !!R && R.players.length >= cfg.min && (cfg.gameMax == null || R.players.length <= cfg.gameMax);
  const needHost = (what) => { if (!R || R.hostId !== R.selfId) { console.warn("[Multiplayer] " + what + "() is for the host only"); return false; } return true; };

  /**
   * host: choose which game the room plays next (everybody gets a `game` event, the lobby shows it).
   * limits = { min, max } is the player count the game needs; start() and the lobby's start button respect it.
   */
  function setGame(game, limits = {}) {
    if (!needHost("setGame")) return;
    R.game = game ? String(game) : null;
    if (limits.min != null) cfg.min = limits.min | 0;
    cfg.gameMax = limits.max != null ? limits.max | 0 : null;
    broadcastLobby();
    emit("game", R.game); ui.render();
  }

  /** host: start the game for everybody in the room right now. options is any JSON the game wants everybody to get. */
  function start(options = null) {
    if (!needHost("start") || R.status !== "lobby" || !canStart()) return false;
    const players = R.players.map((p) => ({ id: p.id, name: p.name }));
    net.send({ t: "start", game: R.game, options, players });
    onStart({ game: R.game, options, players });
    return true;
  }

  /** host: the game is over – everybody is back in the lobby, the room stays. */
  function endGame() {
    if (!needHost("endGame") || R.status !== "playing") return;
    net.send({ t: "end" });
    onEnd();
  }

  /** send a game message to everybody else (or only to the player with id `to`) */
  function send(type, data, to) {
    if (!net || !R || R.status === "connecting") return false;
    net.send({ t: "g", k: String(type), d: data }, to);
    return true;
  }

  // ---- invitation link + QR code ----
  const roomUrl = (code) => {
    const u = new URL(location.href);
    u.hash = ""; u.search = "";
    const game = (R && R.game) || cfg.game || new URLSearchParams(location.search).get("game");
    if (game && cfg.gameParam) u.searchParams.set("game", game);
    u.searchParams.set("room", code || (R && R.code) || "");
    return u.toString();
  };
  const urlRoom = () => (new URLSearchParams(location.search).get("room") || "").trim().toUpperCase().slice(0, CODE_LEN);

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  let qrLoading = null;
  const ensureQR = () => window.qrcode ? Promise.resolve() : qrLoading || (qrLoading = loadScript(QR_LIB).catch((e) => { qrLoading = null; console.error(e); }));

  function qrSvg(text) {
    const q = window.qrcode(0, "M");
    q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  // ---- lobby window ----
  // Two states: a form (name, create room, join with code) and the lobby (code, link, players, start).
  // Ids and classes are all prefixed mp- and styled in multiplayer.css from the theme variables.
  const ui = {
    el: null, qrEl: null, open: false, copied: false, lastCode: "", buttons: new Set(),

    ensure() {
      if (this.el) return;
      this.el = document.createElement("div");
      this.el.id = "mp-ui";
      this.el.innerHTML = `<div class="mp-box" role="dialog" aria-modal="true"></div>`;
      this.qrEl = document.createElement("aside");
      this.qrEl.id = "mp-qr";
      document.body.append(this.el, this.qrEl);
      this.el.addEventListener("click", (e) => this.click(e));
      this.el.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.hide();
        else if (e.key === "Enter" && e.target.id === "mp-code") this.click({ target: this.el.querySelector('[data-act="join"]') });
      });
    },

    show(prefill) { this.ensure(); this.open = true; this.el.classList.add("show"); this.render(prefill); },
    hide() { this.open = false; if (this.el) this.el.classList.remove("show"); this.renderQR(); },

    render(prefill) {
      dock.render();
      for (const b of this.buttons) b.classList.toggle("mp-live", !!R && R.status !== "connecting");
      if (!this.el || !this.open) return;
      const box = this.el.querySelector(".mp-box");
      const keepCode = prefill || (this.el.querySelector("#mp-code") || {}).value || (lastError ? this.lastCode : "") || "";
      const keepName = (this.el.querySelector("#mp-name") || {}).value;
      const S = R && snapshot();
      const initial = (n) => esc([...String(n).trim()][0] || "?").toUpperCase();
      const head = `<button class="mp-x" data-act="close" aria-label="${t("close")}">✕</button><div class="mp-head"><h3>${t("title")}</h3>`;
      const codeBlock = (c) => `<div class="mp-lbl">${t("roomCode")}</div><div class="mp-code">${esc(c)}</div>`;
      const leaveBtn = `<button class="mp-sec" data-act="leave">${t("leave")}</button>`;
      const copyIco = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>`;
      const shareIco = `<svg viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg>`;
      const shareBtn = navigator.share ? `<button class="mp-sec mp-wide mp-copy" data-act="share">${shareIco}${t("share")}</button>` : "";   // native share sheet (AirDrop, Messages, …) where the browser has one
      const linkBtn = shareBtn + `<button class="mp-sec mp-wide mp-copy" data-act="copy">${copyIco}${this.copied ? t("copied") : t("copyLink")}</button>`;
      let h;
      if (!R) {
        h = `${head}<p class="mp-sub">${t("sub", { max: cfg.max })}</p></div>
          <div class="mp-field"><label for="mp-name">${t("yourName")}</label><input id="mp-name" maxlength="12" autocomplete="off" spellcheck="false" value="${esc(keepName ?? store.get(cfg.nameKey))}" placeholder="${esc(t("player"))}"></div>
          <div class="mp-section"><b>${t("hostT")}</b><small>${t("hostS")}</small><button class="mp-primary mp-wide" data-act="host">${t("create")}</button></div>
          <div class="mp-or"><span>${t("or")}</span></div>
          <div class="mp-section"><b>${t("joinT")}</b><div class="mp-row"><input id="mp-code" maxlength="${CODE_LEN}" autocomplete="off" spellcheck="false" placeholder="ABCDE" aria-label="${t("roomCode")}" value="${esc(keepCode)}"><button class="mp-primary" data-act="join">${t("join")}</button></div></div>
          ${lastError ? `<p class="mp-err">${esc(lastError)}</p>` : ""}`;
      } else if (R.status === "connecting") {
        h = `${head}</div>${codeBlock(R.code)}<p class="mp-sub">${t("connecting")}</p><div class="mp-act">${leaveBtn}</div>`;
      } else {
        const isHost = S.isHost, playing = R.status === "playing", enough = canStart(), tooMany = cfg.gameMax != null && R.players.length > cfg.gameMax;
        const list = S.players.map((p) => `<li class="${p.you ? "me" : ""}"><i class="mp-av">${initial(p.name)}</i><span class="mp-nm">${esc(p.name)}${p.you ? `<em>${t("you")}</em>` : ""}${p.host ? `<em>${t("host")}</em>` : ""}</span></li>`).join("");
        let act;
        if (playing) act = `<p class="mp-hint">${t("inGame")}</p>${isHost ? `<button class="mp-primary mp-wide" data-act="end">${t("back")}</button>` : ""}`;
        else if (isHost && !cfg.lobbyStart) act = `<button class="mp-primary mp-wide" data-act="pick">${t("pick")}</button>`;
        else if (isHost) act = `<button class="mp-primary mp-wide" data-act="start" ${enough ? "" : "disabled"}>${t("start")}</button>${enough ? "" : `<p class="mp-hint">${tooMany ? t("tooMany", { n: cfg.gameMax }) : t("needMore")}</p>`}`;
        else act = `<p class="mp-hint">${t("waitHost")}</p>`;
        h = `${head}</div>${codeBlock(R.code)}${linkBtn}
          ${R.game ? `<div class="mp-game"><span>${t("game")}</span><b>${esc(gameTitle(R.game))}</b></div>` : ""}
          <div class="mp-plh"><span>${t("players")}</span><b>${S.players.length}/${R.max}</b></div><ul class="mp-pl">${list}</ul>
          <div class="mp-act">${act}${leaveBtn}</div>`;
      }
      box.innerHTML = h;
      this.renderQR();
    },

    // the invitation board on the right edge of the screen; never shifts the lobby window
    renderQR() {
      if (!this.qrEl) return;
      const show = this.open && !!R && R.status === "lobby";
      this.qrEl.classList.toggle("show", show);
      this.el.classList.toggle("mp-with-qr", show);
      if (!show) return;
      const code = R.code, url = roomUrl(code);
      if (this.qrEl.dataset.url === url && this.qrEl.querySelector(".mp-qrimg")) return;
      if (!window.qrcode) { ensureQR().then(() => { if (R && R.code === code) this.renderQR(); }); return; }
      this.qrEl.dataset.url = url;
      this.qrEl.innerHTML = `<h4>${t("qrTitle")}</h4><div class="mp-qrimg">${qrSvg(url)}</div><div class="mp-qc">${esc(code)}</div><p>${t("qrHint")}</p>`;
    },

    click(e) {
      if (e.target === this.el) return this.hide();
      const b = e.target.closest && e.target.closest("[data-act]");
      if (!b) return;
      const val = (id) => (this.el.querySelector(id) || {}).value;
      switch (b.dataset.act) {
        case "close": this.hide(); break;
        case "host": host({ name: val("#mp-name") }).catch(() => {}); break;
        case "join": join(val("#mp-code"), { name: val("#mp-name") }).catch(() => {}); break;
        case "start": start(cfg.startOptions ? cfg.startOptions() : null); break;
        case "end": endGame(); break;
        case "pick": this.hide(); emit("pick", {}); break;       // host wants to choose the game: back to the page that shows the picker
        case "leave": leave(); break;
        case "share":
          navigator.share({ title: t("title"), text: t("shareText", { code: R.code }), url: roomUrl() }).catch(() => {});   // user cancelling the sheet rejects: ignore
          break;
        case "copy": {
          (navigator.clipboard ? navigator.clipboard.writeText(roomUrl()) : Promise.reject()).catch(() => {});
          this.copied = true; this.render(); setTimeout(() => { this.copied = false; this.render(); }, 1800);
          break;
        }
      }
    },
  };

  const gameTitle = (id) => {
    try { const g = (typeof GAMES !== "undefined" ? GAMES : []).find((x) => x.id === id); return g ? g.title : id; } catch { return id; }
  };

  // the dock in the top left corner: the Mehrspieler button and, once you are in a room, the players below it
  // (avatar + name, a crown on the host). Clicking the button opens the lobby window (code, QR code, join).
  const CROWN = `<svg class="mp-crown" viewBox="0 0 24 24" aria-label="${"Host"}"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></svg>`;
  const hue = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const dock = {
    el: null, list: null,
    mount() {
      if (this.el) return this.el;
      this.el = document.createElement("div");
      this.el.id = "mp-dock";
      this.el.innerHTML = `<div class="mp-dock-btn"></div><ul class="mp-dock-list" aria-label="${t("players")}"></ul>`;
      document.body.appendChild(this.el);
      this.list = this.el.querySelector("ul");
      mountButton(this.el.querySelector(".mp-dock-btn"), { className: "primary" });
      this.render();
      return this.el;
    },
    render() {
      if (!this.el) return;
      const S = R && R.status !== "connecting" ? snapshot() : null;
      this.list.innerHTML = S ? S.players.map((p) => `<li class="${p.you ? "me" : ""}${p.host ? " host" : ""}"><span class="mp-dock-av" style="--h:${hue(p.id)}">${esc([...String(p.name).trim()][0] || "?").toUpperCase()}${p.host ? CROWN : ""}</span><span class="mp-dock-nm">${esc(p.name)}${p.you ? `<em>${t("you")}</em>` : ""}</span></li>`).join("") : "";
    },
  };

  /** drop a "Mehrspieler" button into any element; opens the lobby window on click */
  function mountButton(parent, opts = {}) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "mp-launch" + (opts.className ? " " + opts.className : "");
    b.textContent = opts.label || t("button");
    b.addEventListener("click", () => ui.show());
    (parent || document.body).appendChild(b);
    ui.buttons.add(b); ui.render();
    return b;
  }

  /** change the defaults before the room is opened (all optional) */
  function configure(o = {}) {
    Object.assign(cfg, o);
    if (R && o.max) R.max = Math.min(12, o.max | 0);
  }

  /**
   * Call from a game: open the lobby window if the page was opened through an invite link
   * (…?room=CODE) so the code is already in the "join" field. Returns true when it did.
   */
  function openFromUrl() {
    const c = urlRoom();
    if (!c || R) return false;
    ui.show(c);
    return true;
  }

  window.Multiplayer = {
    mountDock: () => dock.mount(),
    configure, host, join, leave, send, on, setGame, start, endGame, roomUrl, mountButton, openFromUrl,
    onMessage: (type, fn) => on("message:" + type, fn),
    openUI: (prefill) => ui.show(prefill),
    closeUI: () => ui.hide(),
    get state() { return snapshot(); },
    get players() { return R ? snapshot().players : []; },
    get me() { return R && playerOf(R.selfId); },
    get isHost() { return !!R && R.hostId === R.selfId; },
    get connected() { return !!R && R.status !== "connecting"; },
    get error() { return lastError; },
  };
})();
