// Left! Left! Left! — 2-Spieler low-poly Autofahr-Spiel
// Fahrer fährt die Strecke, Beifahrer hält die Routenkarte und navigiert.
// Rendering: Three.js (low poly). Ein Bildschirm, lokale Kooperation.
// Steuerung Fahrer: Pfeiltasten / WASD lenken, Leertaste gas, S bremsen.

import * as THREE from "https://esm.sh/three@0.186.1";

// ---------- config ----------
const CONFIG = {
  id: "leftleftleft",
  title: "Left! Left! Left!",
  tag: "Fahrer fährt, Beifahrer navigiert",
  presets: [
    { label: "Einfach",   values: [3, 40, 1] },
    { label: "Mittel",    values: [5, 55, 2] },
    { label: "Schwierig", values: [7, 70, 3] },
  ],
  buttons: [],
  info: {
    title: "So spielt man",
    text: [
      "Zwei Spieler, ein Auto, ein Bildschirm.",
      "• Fahrer: Pfeiltasten / WASD zum Lenken, Leertaste Gas, S bremsen.",
      "• Beifahrer: schaut auf die Karte im Beifahrer-Fußraum und sagt die Abbieger an („Links!“, „Rechts!“, „Geradeaus!“).",
      "• Ziel: Folge der Route auf der Karte und erreiche alle Wegpunkte.",
    ],
  },
};

// ---------- globals ----------
let renderer, scene, camera, clock;
let car, steeringWheel, driverHands, passengerHand, mapHolder, mapUI;
let road, trees = [], roadSegments = [];
let speed = 0, targetSpeed = 0, steer = 0;
let lane = 0; // -1 links, 0 mitte, 1 rechts
let route = [], routeIndex = 0;
let distance = 0;
let score = 0, mistakes = 0;
let gameState = "playing"; // playing | finished
let width, height, canvasWrap;
let animId;

// ---------- init ----------
export default {
  mount(ctx) {
    width = ctx.root.clientWidth || 800;
    height = ctx.root.clientHeight || 600;
    canvasWrap = document.getElementById("canvas-wrap");

    // Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 40, 220);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 1.6, 1.2); // Fahrersitz
    camera.lookAt(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    canvasWrap.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Licht
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    // Boden / Gras
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x4caf50, flatShading: true })
    );
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    // Straße
    createRoad();

    // Bäume
    spawnTrees(40);

    // Auto-Innenraum
    buildCarInterior();

    // Karte (Beifahrer)
    buildMapUI();

    // Route generieren
    generateRoute();

    // UI-Status
    setStatus("Fahrer: Lenken · Beifahrer: Karte lesen", null);

    // Event-Listener
    window.addEventListener("resize", onResize);
    const keys = {};
    window.addEventListener("keydown", (e) => { keys[e.code] = true; });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // Game Loop
    function loop() {
      animId = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      update(dt, keys);
      render();
    }
    loop();

    return { destroy: () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); renderer.dispose(); } };
  },
};

// ---------- Three.js helpers ----------
function createRoad() {
  road = new THREE.Group();
  scene.add(road);
  // Straßenanfang: ein flacher grauer Streifen
  const seg = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.2, 40),
    new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true })
  );
  seg.position.set(0, 0.11, -20);
  road.add(seg);
  roadSegments.push({ mesh: seg, z: -20, len: 40 });
}

function spawnTrees(count) {
  const treeGeo = new THREE.ConeGeometry(1.2, 4, 4);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, flatShading: true });

  for (let i = 0; i < count; i++) {
    const z = -30 - i * 6;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (10 + Math.random() * 6);

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    tree.add(trunk);
    const crown = new THREE.Mesh(treeGeo, treeMat);
    crown.position.y = 3;
    tree.add(crown);

    tree.position.set(x, 0, z);
    scene.add(tree);
    trees.push({ mesh: tree, z, x, side });
  }
}

function buildCarInterior() {
  car = new THREE.Group();

  // Armaturenbrett
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true })
  );
  dash.position.set(0, 0.35, 1.1);
  car.add(dash);

  // Lenkrad
  const wheelGeo = new THREE.TorusGeometry(0.55, 0.12, 8, 24, Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
  steeringWheel = new THREE.Mesh(wheelGeo, wheelMat);
  steeringWheel.rotation.x = Math.PI / 2;
  steeringWheel.position.set(0, 0.85, 1.5);
  steeringWheel.rotation.z = -Math.PI / 4;
  car.add(steeringWheel);

  // Fahrers Hände (linke Hand links, rechte Hand rechts am Lenkrad)
  const handGeo = new THREE.BoxGeometry(0.22, 0.28, 0.35);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xeac3a8, flatShading: true });
  driverHands = new THREE.Group();

  const lh = new THREE.Mesh(handGeo, handMat);
  lh.position.set(-0.42, 0.82, 1.42);
  lh.rotation.z = -0.3;
  driverHands.add(lh);

  const rh = new THREE.Mesh(handGeo, handMat);
  rh.position.set(0.42, 0.82, 1.42);
  rh.rotation.z = 0.3;
  driverHands.add(rh);

  car.add(driverHands);

  // Beifahrer-Hand + Karte (im Beifahrer-Fußraum, rechts unten)
  passengerHand = new THREE.Mesh(handGeo, handMat);
  passengerHand.position.set(0.6, 0.55, 1.9);
  passengerHand.rotation.z = 0.5;
  car.add(passengerHand);

  // A-Säulen (links und rechts)
  const pillarGeo = new THREE.BoxGeometry(0.5, 1.8, 1.2);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xa33a3a, flatShading: true });
  const lp = new THREE.Mesh(pillarGeo, pillarMat);
  lp.position.set(-1.35, 0.9, 0.6);
  car.add(lp);
  const rp = new THREE.Mesh(pillarGeo, pillarMat);
  rp.position.set(1.35, 0.9, 0.6);
  car.add(rp);

  // Seitenspiegel
  const mirrorGeo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, flatShading: true });
  const lm = new THREE.Mesh(mirrorGeo, mirrorMat);
  lm.position.set(-1.6, 0.95, 0.9);
  car.add(lm);
  const rm = new THREE.Mesh(mirrorGeo, mirrorMat);
  rm.position.set(1.6, 0.95, 0.9);
  car.add(rm);

  scene.add(car);
}

function buildMapUI() {
  // Karte als 2D-Overlay (HTML/CSS) im unteren Bereich = Beifahrer-Fußraum
  const wrap = document.createElement("div");
  wrap.id = "lll-map";
  wrap.style.cssText = `
    position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
    width:320px; height:210px; background:#d8c3a5; border:4px solid #8b6a4a;
    border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.4); font-family:system-ui,sans-serif;
    pointer-events:none; overflow:hidden; z-index:50;
  `;
  wrap.innerHTML = `
    <div style="padding:10px 12px 6px;font-weight:800;font-size:14px;color:#5d4037;letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid #8b6a4a;">Routenkarte</div>
    <div id="lll-map-arrow" style="height:150px;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900;color:#a33a3a;">↑</div>
    <div id="lll-map-next" style="padding:6px 10px;font-size:13px;color:#5d4037;background:#fff3e0;border-top:1px solid #d8c3a5;">Geradeaus</div>
  `;
  document.body.appendChild(wrap);
  mapUI = wrap;
  const arrow = document.getElementById("lll-map-arrow");
  const next = document.getElementById("lll-map-next");
  mapUI._arrow = arrow;
  mapUI._next = next;
}

function generateRoute() {
  // Route: zufällige Abbiege-Anweisungen
  const dirs = ["links", "rechts", "gerade"];
  route = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    route.push({ dir: dirs[Math.floor(Math.random() * dirs.length)], dist: 40 + i * 40 });
  }
  routeIndex = 0;
  updateMap();
}

function updateMap() {
  if (!mapUI || gameState !== "playing") return;
  const r = route[routeIndex];
  if (!r) {
    mapUI._arrow.textContent = "✔";
    mapUI._arrow.style.color = "#2e7d32";
    mapUI._next.textContent = "Ziel erreicht!";
    mapUI._next.style.background = "#e8f5e9";
    return;
  }
  const arrowChar = r.dir === "links" ? "←" : r.dir === "rechts" ? "→" : "↑";
  const arrowColor = r.dir === "links" ? "#1976d2" : r.dir === "rechts" ? "#d32f2f" : "#2e7d32";
  mapUI._arrow.textContent = arrowChar;
  mapUI._arrow.style.color = arrowColor;
  mapUI._next.textContent = r.dir === "links" ? "Links abbiegen" : r.dir === "rechts" ? "Rechts abbiegen" : "Geradeaus fahren";
}

function update(dt, keys) {
  if (gameState !== "playing") return;

  // Steuerung Fahrer
  const accel = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];
  const brake = keys["KeyS"] || keys["ArrowDown"];
  const left = keys["ArrowLeft"] || keys["KeyA"];
  const right = keys["ArrowRight"] || keys["KeyD"];

  if (accel) targetSpeed = Math.min(targetSpeed + 8 * dt, 60);
  else if (brake) targetSpeed = Math.max(targetSpeed - 12 * dt, 0);
  else targetSpeed *= Math.pow(0.9, dt * 30);

  speed += (targetSpeed - speed) * dt * 5;

  // Lenken
  let steerInput = 0;
  if (left) steerInput -= 1;
  if (right) steerInput += 1;
  steer += (steerInput - steer) * dt * 6;

  // Auto bewegt sich (Kamera + Straße bewegen sich stattdessen)
  distance += speed * dt;

  // Kamera folgt leicht dem Lenkeinschlag
  camera.position.x = lane * 0.6 + steer * 0.3;
  camera.position.z = 1.2 + speed * 0.01;
  camera.position.y = 1.6 + Math.sin(distance * 3) * 0.01 * speed;
  camera.lookAt(
    camera.position.x + steer * 2,
    1.6,
    camera.position.z + 20
  );

  // Lenkrad drehen
  if (steeringWheel) {
    steeringWheel.rotation.z = -Math.PI / 4 + steer * 1.2;
  }
  // Hände mitbewegen
  if (driverHands) {
    driverHands.rotation.z = steer * 0.6;
    driverHands.position.x = steer * 0.15;
  }

  // Straße entlang bewegen: Segmente vorne nach hinten zyklisch nutzen
  const move = speed * dt;
  for (const seg of roadSegments) {
    seg.mesh.position.z += move;
    if (seg.mesh.position.z > 60) {
      // hinten wieder vorne einsortieren
      const minZ = Math.min(...roadSegments.map(s => s.mesh.position.z));
      seg.mesh.position.z = minZ - 40;
    }
  }

  // Bäume bewegen
  for (const t of trees) {
    t.mesh.position.z += move;
    if (t.mesh.position.z > 60) {
      t.mesh.position.z = -80 + Math.random() * 20;
      t.mesh.position.x = t.side * (10 + Math.random() * 6);
    }
  }

  // Routen-Check: bei Wegpunkt
  // Jeder Wegpunkt ist eine Distanzmarke; wenn der Spieler nahe dran ist,
  // wird geprüft ob er in die richtige Spur / Richtung lenkt.
  const r = route[routeIndex];
  if (r) {
    const distTo = r.dist - distance;
    if (distTo < 8 && distTo > -8) {
      // Wegpunkt erreicht: Bewertung
      let ok = false;
      if (r.dir === "gerade" && Math.abs(steer) < 0.3) ok = true;
      if (r.dir === "links" && steer < -0.3) ok = true;
      if (r.dir === "rechts" && steer > 0.3) ok = true;

      if (ok) {
        score += 10;
        flashNote("Richtig! " + (r.dir === "gerade" ? "Geradeaus" : r.dir === "links" ? "Links" : "Rechts"));
      } else {
        mistakes += 1;
        flashNote("Daneben! Es hieß " + (r.dir === "gerade" ? "geradeaus" : r.dir === "links" ? "links" : "rechts"));
      }
      routeIndex++;
      updateMap();
      if (routeIndex >= route.length) {
        gameState = "finished";
        setStatus(`Spiele beendet! ${score} Punkte, ${mistakes} Fehler`, mistakes > 2 ? "dead" : "solved");
      }
    }
  }
}

function render() {
  renderer.render(scene, camera);
}

function onResize() {
  width = canvasWrap.clientWidth || 800;
  height = canvasWrap.clientHeight || 600;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ---------- shared shell helpers (from game.js) ----------
function setStatus(text, state) {
  const txt = document.getElementById("status-text");
  if (txt) { txt.textContent = text; txt.style.color = state === "solved" ? "var(--mint)" : state === "dead" ? "var(--rose)" : "var(--muted)"; }
}

function flashNote(msg) {
  const n = document.getElementById("note");
  if (!n) return;
  n.textContent = msg;
  if (window._lllNoteTimer) clearTimeout(window._lllNoteTimer);
  if (msg) {
    window._lllNoteTimer = setTimeout(() => { n.textContent = ""; }, 2500);
  }
}
