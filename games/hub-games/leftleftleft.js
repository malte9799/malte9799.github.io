// Left! Left! Left! in the multiplayer hub — a two-player road trip.
//
// Fahrer (players[0]) steuert durch eine zufällige, kurvige Waldstraße in 3D (Three.js, low poly).
// Beifahrer (players[1]) sieht nur die Routenkarte und sagt jede Abzweigung rechtzeitig an:
// „Links!“, „Geradeaus!“ oder „Rechts!“.
// Strecke und Bäume entstehen aus dem Lauf-Seed (ctx.options.run), also identisch auf beiden Geräten.
// Der Fahrer-Client ist die Autorität für Punkte und Fehler; der Beifahrer sendet nur Ansagen.

import { shell } from "../hub-kit.js";

const THREE_URL = "https://esm.sh/three@0.186.1";
const TRACK_LEN = 2600;      // Meter
const ROAD_HALF = 4.5;       // Straße 9 m breit
const WHEELBASE = 2.6;       // Radstand für das Lenkmodell
const MAX_STEER = 0.55;      // Lenkeinschlag in rad bei vollem Ausschlag
const CALL_BEFORE = 70;      // Ansage zählt ab so vielen Metern vor der Stelle …
const CALL_AFTER = 10;       // … und bis so viele Meter danach
const BONUS = 10;
const CALL_TEXT = { links: "LINKS!", gerade: "GERADEAUS!", rechts: "RECHTS!" };
const CALL_COLOR = { links: "#5aa9ff", gerade: "#7dff8a", rechts: "#ff6b6b" };
const CALL_NAME = { links: "Links", gerade: "Geradeaus", rechts: "Rechts" };
const MARK_COLOR = { links: "#1976d2", gerade: "#2e7d32", rechts: "#d32f2f" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Seed & Strecke (deterministisch, gleich auf allen Geräten) ----------

function hashStr(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// mulberry32
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Die Strecke: abwechselnd Gerade und Kurve, je 1 m pro Stichprobe.
// Heading h: wächst bei Linkskurven, sinkt bei Rechtskurven. Forward = (sin h, cos h) in (x, z).
// Rechts vom Auto = (-cos h, sin h).
function buildTrack(seed) {
  const R = rng(seed);
  const pieces = [];
  let total = 0, curve = false;
  while (total < TRACK_LEN) {
    if (curve) {
      const len = 50 + R() * 60;
      const deg = 35 + R() * 50;
      const sign = R() < 0.5 ? -1 : 1;
      pieces.push({ dir: sign > 0 ? "links" : "rechts", len, ang: sign * deg * Math.PI / 180 });
    } else {
      pieces.push({ dir: "gerade", len: 60 + R() * 60, ang: 0 });
    }
    total += pieces[pieces.length - 1].len;
    curve = !curve;
  }
  const P = [], H = [], events = [];
  let x = 0, z = 0, h = 0;
  for (const pc of pieces) {
    const n = Math.max(1, Math.round(pc.len));
    const start = P.length;
    for (let i = 0; i < n; i++) {
      P.push([x, z]); H.push(h);
      h += pc.ang / n;
      x += Math.sin(h); z += Math.cos(h);
    }
    events.push({ start, end: P.length, dir: pc.dir });   // Ereignis = eine Stelle, an der die Ansage fällt
  }
  P.push([x, z]); H.push(h);
  return { P, H, events, N: P.length };
}

// ---------- Modul ----------

export default {
  min: 2, max: 2,

  async mount(ctx) {
    const kit = shell(ctx, { title: "Left! Left! Left!" }), root = kit.body;
    const seed = hashStr(String((ctx.options && ctx.options.run) || "lll"));
    const track = buildTrack(seed);
    const driverId = ctx.players[0].id, navId = ctx.players[1].id;
    const isDriver = ctx.me.id === driverId;

    root.innerHTML = `<p class="hub-loading">Lade Strecke …</p>`;
    let T = null;
    if (isDriver) {
      try { T = await import(THREE_URL); }
      catch (e) { root.innerHTML = `<p class="hub-loading">Three.js konnte nicht geladen werden.</p>`; return {}; }
    }
    root.innerHTML = "";

    const style = document.createElement("style");
    style.id = "lll-style";
    style.textContent = CSS;
    document.head.appendChild(style);

    let raf = 0, timers = [];
    let inst;
    const cleanups = [];

    if (isDriver) inst = mountDriver(T);
    else inst = mountNavigator();

    ctx.onEvent("leave", (p) => {
      if (p && (p.id === driverId || p.id === navId)) inst.partnerLeft();
    });

    return {
      go() { inst.go(); },
      destroy() {
        cancelAnimationFrame(raf);
        for (const t of timers) clearTimeout(t);
        for (const fn of cleanups) { try { fn(); } catch (e) { /* ignore */ } }
        style.remove();
        inst.destroy && inst.destroy();
      },
    };

    // ----- Fahrer -----
    function mountDriver(T) {
      root.innerHTML = `
        <div class="lll">
          <div class="lll-stage">
            <div class="lll-hud">
              <div class="lll-call">…</div>
              <div class="lll-sub"></div>
              <div class="lll-stats"></div>
              <div class="lll-note"></div>
            </div>
            <div class="lll-speed"><b>0</b> km/h</div>
          </div>
        </div>`;
      const stage = root.querySelector(".lll-stage");
      const hudCall = root.querySelector(".lll-call"),
            hudSub = root.querySelector(".lll-sub"),
            hudStats = root.querySelector(".lll-stats"),
            hudNote = root.querySelector(".lll-note"),
            hudSpeed = root.querySelector(".lll-speed b");

      const calls = new Map();      // Ereignis-Index → Ansage des Beifahrers
      const flagged = new Set();    // Ereignisse, bei denen die Straße verlassen wurde
      const car = { x: track.P[0][0], z: track.P[0][1], h: track.H[0], v: 0, steer: 0, idx: 0, off: 0 };
      let ev = 0, score = 0, mistakes = 0, done = false, running = false, ended = null;
      let noteTimer = 0, sendT = 0, hudT = 0, last = 0;

      // Eingabe: Tastatur + Touch (linke/rechte Bildhälfte lenkt, Druck irgendwo = Gas)
      const keys = {};
      let touchGas = false, touchLeft = false, touchRight = false, activeTouches = 0;
      const GAS = ["ArrowUp", "KeyW", "Space"], BRAKE = ["ArrowDown", "KeyS"],
            LEFT = ["ArrowLeft", "KeyA"], RIGHT = ["ArrowRight", "KeyD"];
      const HANDLED = new Set([...GAS, ...BRAKE, ...LEFT, ...RIGHT]);
      const pressed = (list) => list.some((k) => keys[k]);
      const onKeyDown = (e) => { if (HANDLED.has(e.code)) { keys[e.code] = true; e.preventDefault(); } };
      const onKeyUp = (e) => { if (HANDLED.has(e.code)) { keys[e.code] = false; e.preventDefault(); } };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      cleanups.push(() => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); });

      const touchUpdate = (e) => {
        const r = stage.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
        touchGas = true;
        touchLeft = f < 0.35;
        touchRight = f > 0.65;
      };
      const touchEnd = () => { activeTouches = 0; touchGas = false; touchLeft = false; touchRight = false; };
      stage.addEventListener("pointerdown", (e) => { activeTouches++; stage.setPointerCapture?.(e.pointerId); touchUpdate(e); });
      stage.addEventListener("pointermove", (e) => { if (activeTouches) touchUpdate(e); });
      stage.addEventListener("pointerup", touchEnd);
      stage.addEventListener("pointercancel", touchEnd);

      // Three.js-Szene
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      stage.prepend(renderer.domElement);
      const scene = new T.Scene();
      scene.background = new T.Color(0x9fd8f0);
      scene.fog = new T.Fog(0x9fd8f0, 110, 460);
      scene.add(new T.HemisphereLight(0xffffff, 0x3a6b2a, 1.1));
      const sun = new T.DirectionalLight(0xffffff, 0.8);
      sun.position.set(60, 120, 40);
      scene.add(sun);
      buildWorld(T, scene, track, seed);
      const camera = new T.PerspectiveCamera(70, 1, 0.1, 900);
      scene.add(camera);
      const wheel = buildCockpit(T, camera);

      const resize = () => {
        const w = stage.clientWidth || 600, h = stage.clientHeight || 420;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      cleanups.push(() => { ro.disconnect(); renderer.dispose(); });
      resize();

      // Beifahrer-Ansagen
      ctx.onMessage("call", ({ from, data }) => {
        if (from !== navId || done || !data) return;
        const k = data.k | 0, dir = data.dir, e = track.events[k];
        if (!e || !(dir in CALL_TEXT) || calls.has(k) || k < ev) return;
        if (car.idx < e.start - CALL_BEFORE || car.idx > e.start + CALL_AFTER) { flashNote("Ansage zu früh oder zu spät"); return; }
        calls.set(k, dir);
        flashNote("Ansage: " + CALL_NAME[dir]);
        renderHud(true);
      });

      function flashNote(msg) {
        hudNote.textContent = msg;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => { hudNote.textContent = ""; }, 2200);
      }

      function snapshot(note) {
        return { score, mistakes, ev, done, note: note || "" };
      }

      function locate() {
        const { P, H, N } = track;
        let best = car.idx, bd = Infinity;
        const lo = Math.max(0, car.idx - 20), hi = Math.min(N - 1, car.idx + 60);
        for (let j = lo; j <= hi; j++) {
          const dx = P[j][0] - car.x, dz = P[j][1] - car.z, d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = j; }
        }
        car.idx = best;
        const h = H[best];
        car.off = (car.x - P[best][0]) * -Math.cos(h) + (car.z - P[best][1]) * Math.sin(h);
        if (Math.abs(car.off) > 25) {            // im Wald gelandet: zurück auf die Straße, mit Fehler
          car.x = P[best][0]; car.z = P[best][1]; car.h = h; car.v = 0; car.off = 0;
          mistakes++;
          flashNote("Im Wald – zurück auf die Straße");
        }
      }

      function step(dt) {
        const left = pressed(LEFT) || touchLeft, right = pressed(RIGHT) || touchRight;
        const gas = pressed(GAS) || touchGas, brake = pressed(BRAKE);
        const target = (left ? 1 : 0) - (right ? 1 : 0);
        car.steer += (target - car.steer) * Math.min(1, dt * 7);

        const top = Math.abs(car.off) > ROAD_HALF ? 13 : 32;   // neben der Straße wird man langsamer
        let acc = gas ? 9 : brake ? -18 : -2.5;
        if (car.v > top) acc = -8;
        car.v = Math.max(0, Math.min(40, car.v + acc * dt));

        const delta = car.steer * MAX_STEER;
        car.h += (car.v * Math.tan(delta) / WHEELBASE) * dt;
        car.x += Math.sin(car.h) * car.v * dt;
        car.z += Math.cos(car.h) * car.v * dt;
        locate();
      }

      function checkEvents() {
        const { events, N } = track;
        if (ev < events.length && Math.abs(car.off) > ROAD_HALF && car.idx >= events[ev].start) flagged.add(ev);
        while (ev < events.length && car.idx >= events[ev].end) finalize(ev++);
        if (!done && car.idx >= N - 2) {
          while (ev < events.length) finalize(ev++);
          done = true;
          ended = `Ziel erreicht! ${score} Punkte, ${mistakes} Fehler`;
          ctx.send("state", snapshot("Ziel erreicht!"));
          flashNote("Ziel erreicht!");
        }
      }

      function finalize(k) {
        const e = track.events[k], call = calls.get(k), off = flagged.has(k);
        let err = 0, msg = "";
        if (off) { err++; msg = "Von der Straße!"; }
        if (!call) { err++; if (!off) msg = "Verpasst – keine Ansage!"; }
        else if (call !== e.dir) { err++; if (!off) msg = "Falsche Ansage!"; }
        if (call === e.dir && !off) { score += BONUS; msg = "Richtig!"; }
        mistakes += err;
        flashNote(msg);
        ctx.send("state", snapshot(msg));
      }

      function renderScene() {
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        camera.position.set(car.x, 1.25, car.z);
        camera.lookAt(car.x + fx * 30, 1.0, car.z + fz * 30);
        camera.fov = 70 + Math.min(car.v, 32) * 0.15;
        camera.updateProjectionMatrix();
        wheel.rotation.z = car.steer * 0.9;
        renderer.render(scene, camera);
      }

      function renderHud(force) {
        const now = performance.now();
        if (!force && now - hudT < 100) return;
        hudT = now;
        const e = track.events[ev];
        if (done) {
          hudCall.textContent = "Ziel!";
          hudCall.style.color = "";
          hudSub.textContent = "";
        } else if (e) {
          const c = calls.get(ev);
          if (c) {
            hudCall.textContent = CALL_TEXT[c];
            hudCall.style.color = CALL_COLOR[c];
            hudSub.textContent = car.idx >= e.start ? "jetzt!" : `in ${Math.max(0, e.start - car.idx)} m`;
          } else if (car.idx >= e.start - CALL_BEFORE) {
            hudCall.textContent = "… Ansage abwarten";
            hudCall.style.color = "";
            hudSub.textContent = `in ${Math.max(0, e.start - car.idx)} m`;
          } else {
            hudCall.textContent = "Weiter";
            hudCall.style.color = "";
            hudSub.textContent = `nächste Stelle in ${e.start - car.idx} m`;
          }
        }
        hudStats.textContent = `Punkte ${score} · Fehler ${mistakes}`;
        hudSpeed.textContent = Math.round(car.v * 3.6);
      }

      function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        if (running && !done) { step(dt); checkEvents(); }
        renderScene();
        renderHud(false);
        if (running && now - sendT > 100) {
          sendT = now;
          ctx.send("car", { idx: car.idx, x: car.x, z: car.z, h: car.h, v: car.v });
        }
      }

      return {
        go() {
          running = true;
          last = performance.now();
          hudCall.textContent = "Los!";
          raf = requestAnimationFrame(frame);
        },
        partnerLeft() {
          done = true;
          running = false;
          hudCall.textContent = "Mitspieler weg";
          hudSub.textContent = "";
        },
        destroy() { running = false; },
      };
    }

    // ----- Beifahrer -----
    function mountNavigator() {
      root.innerHTML = `
        <div class="lll lll-nav">
          <canvas class="lll-map"></canvas>
          <div class="lll-stats"></div>
          <div class="lll-next"></div>
          <div class="lll-calls">
            <button type="button" data-dir="links">← Links</button>
            <button type="button" data-dir="gerade">↑ Geradeaus</button>
            <button type="button" data-dir="rechts">→ Rechts</button>
          </div>
          <div class="lll-note"></div>
        </div>`;
      const canvas = root.querySelector(".lll-map"),
            stats = root.querySelector(".lll-stats"),
            nextEl = root.querySelector(".lll-next"),
            noteEl = root.querySelector(".lll-note"),
            btns = [...root.querySelectorAll(".lll-calls button")];
      const ctxC = canvas.getContext("2d");
      const { P, H, events, N } = track;
      const car = { idx: 0, x: P[0][0], z: P[0][1], h: H[0] };
      const sent = new Set();
      let score = 0, mistakes = 0, done = false, noteTimer = 0, ended = false;

      const nextEvent = () => {
        let k = 0;
        while (k < events.length && car.idx >= events[k].end) k++;
        return k;
      };
      const canCall = (k) => {
        const e = events[k];
        return !!e && !done && !sent.has(k) && car.idx >= e.start - CALL_BEFORE && car.idx <= e.start + CALL_AFTER;
      };

      btns.forEach((b) => b.addEventListener("click", () => {
        const k = nextEvent();
        if (!canCall(k)) return;
        sent.add(k);
        ctx.send("call", { k, dir: b.dataset.dir }, driverId);
        flash("Gesendet: " + CALL_NAME[b.dataset.dir]);
        draw(); renderBtns();
      }));

      function flash(msg) {
        noteEl.textContent = msg;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => { noteEl.textContent = ""; }, 2200);
      }

      function renderBtns() {
        const k = nextEvent();
        btns.forEach((b) => { b.disabled = !canCall(k); });
        const e = events[k];
        if (done) nextEl.textContent = "Strecke zu Ende";
        else if (!e) nextEl.textContent = "";
        else if (sent.has(k)) nextEl.textContent = "Ansage raus – warte auf den Fahrer";
        else if (car.idx < e.start - CALL_BEFORE) nextEl.textContent = `Nächste Stelle in ${e.start - car.idx} m – Karte lesen`;
        else if (canCall(k)) nextEl.textContent = "Jetzt ansagen!";
        else nextEl.textContent = "Zu spät für diese Stelle";
        stats.textContent = `Punkte ${score} · Fehler ${mistakes}`;
      }

      // Karte: Ausschnitt vor dem Auto (ca. 260 m), Norden oben
      const ahead = (from, to) => {
        const pts = [];
        for (let j = Math.max(0, from); j <= Math.min(N - 1, to); j++) pts.push(P[j]);
        return pts;
      };
      function draw() {
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.clientWidth || 600, ch = canvas.clientHeight || 360;
        if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
          canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
        }
        const c = ctxC;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = "#efe6d2"; c.fillRect(0, 0, cw, ch);

        const from = car.idx - 40, to = car.idx + 260;
        const pts = ahead(from, to);
        let minX = car.x, maxX = car.x, minZ = car.z, maxZ = car.z;
        for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
        const pad = 26;
        const sc = Math.min((cw - 2 * pad) / Math.max(1, maxX - minX), (ch - 2 * pad) / Math.max(1, maxZ - minZ));
        const ox = (cw - (maxX - minX) * sc) / 2, oy = (ch - (maxZ - minZ) * sc) / 2;
        const sx = (x) => ox + (x - minX) * sc;
        const sy = (z) => ch - oy - (z - minZ) * sc;

        // Straße (ganzer Ausschnitt)
        c.lineCap = "round"; c.lineJoin = "round";
        c.strokeStyle = "#6b5a46"; c.lineWidth = Math.max(6, 9 * sc / 2);
        c.beginPath();
        pts.forEach(([x, z], i) => (i ? c.lineTo(sx(x), sy(z)) : c.moveTo(sx(x), sy(z))));
        c.stroke();

        // Ereignisse im Ausschnitt
        const k = nextEvent();
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.start < from || e.start > to) continue;
          const [x, z] = P[e.start];
          const done_ = i < k;
          c.beginPath();
          c.arc(sx(x), sy(z), i === k ? 9 : 6, 0, Math.PI * 2);
          c.fillStyle = done_ ? "#9a9a9a" : MARK_COLOR[e.dir];
          c.fill();
          if (i === k) { c.lineWidth = 3; c.strokeStyle = "#111"; c.stroke(); }
        }

        // Auto
        const cx = sx(car.x), cy = sy(car.z);
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.sin(car.h) * 22, cy - Math.cos(car.h) * 22);
        c.strokeStyle = "#111"; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fillStyle = "#111"; c.fill();
      }

      const ro = new ResizeObserver(() => draw());
      ro.observe(canvas);
      cleanups.push(() => ro.disconnect());

      ctx.onMessage("car", ({ from, data }) => {
        if (from !== driverId || !data) return;
        Object.assign(car, { idx: data.idx | 0, x: data.x, z: data.z, h: data.h });
        draw(); renderBtns();
      });
      ctx.onMessage("state", ({ from, data }) => {
        if (from !== driverId || !data) return;
        score = data.score | 0; mistakes = data.mistakes | 0;
        if (data.done) done = true;
        if (data.note) flash(data.note);
        renderBtns();
      });

      let timer = 0;
      return {
        go() {
          draw(); renderBtns();
          timer = setInterval(renderBtns, 250);
          timers.push(timer);
        },
        partnerLeft() {
          done = true; renderBtns(); flash("Mitspieler hat den Raum verlassen");
        },
        destroy() { clearInterval(timer); },
      };
    }
  },
};

// ---------- Welt & Cockpit (nur Fahrer) ----------

function buildWorld(T, scene, track, seed) {
  const { P, H, N } = track;
  const R = rng(seed ^ 0x9e3779b9);

  // Boden
  const ground = new T.Mesh(
    new T.PlaneGeometry(6000, 6000),
    new T.MeshLambertMaterial({ color: 0x4f9a3a, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // Straße als Band aus Stichproben
  const pos = [], ind = [];
  for (let i = 0; i < N; i++) {
    const [x, z] = P[i], h = H[i], rx = -Math.cos(h), rz = Math.sin(h);
    pos.push(x + rx * ROAD_HALF, 0.03, z + rz * ROAD_HALF, x - rx * ROAD_HALF, 0.03, z - rz * ROAD_HALF);
  }
  for (let i = 0; i < N - 1; i++) { const a = 2 * i; ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const roadGeo = new T.BufferGeometry();
  roadGeo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  roadGeo.setIndex(ind);
  roadGeo.computeVertexNormals();
  scene.add(new T.Mesh(roadGeo, new T.MeshLambertMaterial({ color: 0x4a4a50, flatShading: true, side: T.DoubleSide })));

  // Mittellinie
  const dashes = [];
  for (let i = 6; i < N - 4; i += 12) dashes.push(i);
  const dashGeo = new T.BoxGeometry(0.22, 0.02, 3);
  const dashMesh = new T.InstancedMesh(dashGeo, new T.MeshLambertMaterial({ color: 0xf2efe0, flatShading: true }), dashes.length);
  const dummy = new T.Object3D();
  dashes.forEach((i, k) => {
    dummy.position.set(P[i][0], 0.04, P[i][1]);
    dummy.rotation.set(0, H[i], 0);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(k, dummy.matrix);
  });
  dashMesh.instanceMatrix.needsUpdate = true;
  scene.add(dashMesh);

  // Bäume links und rechts der Straße
  const trees = [];
  for (let i = 0; i < N; i += 6) {
    for (const side of [-1, 1]) {
      if (R() > 0.8) continue;
      const d = 7.5 + R() * 12, h = H[i];
      trees.push({
        x: P[i][0] + -Math.cos(h) * side * d,
        z: P[i][1] + Math.sin(h) * side * d,
        s: 0.8 + R() * 0.7,
        ry: R() * 6,
        cw: 0.9 + R() * 0.4,
        ch: 1.1 + R() * 0.6,
        hue: 0.22 + R() * 0.1,
      });
    }
  }
  const trunkMesh = new T.InstancedMesh(
    new T.CylinderGeometry(0.22, 0.32, 2.2, 5),
    new T.MeshLambertMaterial({ color: 0x6b4a2e, flatShading: true }),
    trees.length
  );
  const crownMesh = new T.InstancedMesh(
    new T.IcosahedronGeometry(1.9, 0),
    new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    trees.length
  );
  const col = new T.Color();
  trees.forEach((t, k) => {
    dummy.position.set(t.x, 1.1 * t.s, t.z);
    dummy.rotation.set(0, t.ry, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(k, dummy.matrix);

    dummy.position.set(t.x, 2.7 * t.s, t.z);
    dummy.scale.set(t.s * t.cw, t.s * t.ch, t.s * t.cw);
    dummy.updateMatrix();
    crownMesh.setMatrixAt(k, dummy.matrix);
    col.setHSL(t.hue, 0.5, 0.25 + R() * 0.15);
    crownMesh.setColorAt(k, col);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  crownMesh.instanceMatrix.needsUpdate = true;
  if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
  scene.add(trunkMesh, crownMesh);
}

// Innenraum als Kind der Kamera: bleibt im Blickfeld. Gibt das Lenkrad zurück.
function buildCockpit(T, camera) {
  const mat = (c) => new T.MeshLambertMaterial({ color: c, flatShading: true });
  const red = mat(0xc23a3a), grey = mat(0x9a9a9a), dark = mat(0x151515), skin = mat(0xeac3a8);
  const add = (geo, m, x, y, z, parent = camera) => {
    const mesh = new T.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  add(new T.BoxGeometry(2.4, 0.45, 0.8), grey, 0, -0.5, -1.0);          // Armaturenbrett
  add(new T.BoxGeometry(3.2, 0.12, 2.2), red, 0, -0.78, -2.2);          // Motorhaube
  add(new T.BoxGeometry(3.4, 0.16, 0.9), red, 0, 0.98, -0.9);           // Dachkante
  add(new T.BoxGeometry(0.32, 1.9, 0.32), red, -1.1, 0.05, -0.9);       // A-Säule links
  add(new T.BoxGeometry(0.32, 1.9, 0.32), red, 1.1, 0.05, -0.9);        // A-Säule rechts
  add(new T.BoxGeometry(0.26, 0.16, 0.04), mat(0xf4f4f4), -1.45, 0.25, -1.0); // Spiegel

  const wheel = new T.Group();
  wheel.position.set(-0.3, -0.36, -0.55);
  camera.add(wheel);
  const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.03, 8, 20), dark);
  wheel.add(ring);
  const stem = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.05), dark);
  stem.position.set(0, 0, -0.02);
  wheel.add(stem);
  add(new T.BoxGeometry(0.12, 0.1, 0.22), skin, -0.44, -0.4, -0.5);   // linke Hand
  add(new T.BoxGeometry(0.12, 0.1, 0.22), skin, -0.16, -0.4, -0.5);   // rechte Hand
  return wheel;
}

const CSS = `
.lll{display:flex;flex-direction:column;gap:10px;max-width:960px;margin:0 auto;width:100%}
.lll-stage{position:relative;width:100%;height:min(70vh,620px);min-height:380px;background:#9fd8f0;border-radius:12px;overflow:hidden;touch-action:none;user-select:none}
.lll-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.lll-hud{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;padding:14px;gap:4px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)}
.lll-call{font-size:clamp(28px,6vw,56px);font-weight:900;letter-spacing:.04em}
.lll-sub{font-size:15px;opacity:.95}
.lll-stats{font-weight:700}
.lll-note{min-height:1.4em;font-weight:700}
.lll-speed{position:absolute;right:14px;bottom:12px;font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)}
.lll-map{width:100%;height:min(60vh,520px);min-height:300px;border-radius:12px;background:#efe6d2;display:block}
.lll-next{font-size:16px;font-weight:700}
.lll-calls{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.lll-calls button{padding:18px 8px;font-size:17px;font-weight:800;border-radius:10px;border:0;cursor:pointer;background:#444;color:#fff}
.lll-calls button:disabled{opacity:.35;cursor:default}
.lll-calls [data-dir=links]{background:#1976d2}
.lll-calls [data-dir=gerade]{background:#2e7d32}
.lll-calls [data-dir=rechts]{background:#d32f2f}
`;
