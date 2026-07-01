// Shared game shell — called by each game's JS via initGame(config)
//
// config shape:
// {
//   title:   string,
//   tag:     string,                          // subtitle under title
//   fullscreen: bool,                         // Snake/Conway exclusive fullscreen mode
//   presets: [{ label, values: [...] }, ...], // "values" is passed to onPreset
//   buttons: [{ id, label, primary?, toggle? }],
//   sliders: [{ id, label, min, max, step, fmt? }],  // shown when Custom selected
//   onPreset:  (values) => void,
//   onSlider:  (id, value) => void,           // called on every slider input
//   onClamp:   () => void,                    // clamp slider values after change
//   getSliderValues: () => ({ [id]: value }), // return current values for each slider
// }

let _cfg = null;
let _noteTimer = null;

function initGame(cfg) {
  _cfg = cfg;
  _buildShell();
  _wireShell();
}

// ---- shell construction ----

// Shared markup fragments reused by both layout shells below.
function _presetOptionsHTML() {
  return (
    _cfg.presets.map((p) => `<option value="${p.values.join(",")}">${p.label}</option>`).join("\n") +
    (_cfg.sliders && _cfg.sliders.length > 0 ? `\n<option value="custom">Custom</option>` : "")
  );
}

function _buttonsHTML() {
  return (
    _cfg.buttons.map((b) => `<button id="${b.id}"${b.primary ? ' class="primary"' : ""}>${b.label}</button>`).join("\n") +
    (_cfg.info ? `\n<button id="btn-info" class="info-btn">?</button>` : "")
  );
}

function _slidersHTML(applyLabel) {
  return `
    ${_cfg.sliders
      .map(
        (s) => `
    <div class="ctl">
      <label for="${s.id}">${s.label}</label>
      <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step ?? 1}" />
      <span class="val" id="v-${s.id}"></span>
    </div>`,
      )
      .join("")}
    <div class="row apply-row" style="margin-bottom:0">
      <button id="btn-apply" class="primary">${applyLabel}</button>
    </div>`;
}

function _buildShell() {
  const app = document.getElementById("app");

  if (_cfg.fullscreen) {
    // Fullscreen Mode (Snake, Conway): edge-to-edge canvas with a slim top
    // overlay. The custom-preset slider panel sits below the overlay and is
    // only revealed on hover/focus so it doesn't permanently block the view.
    document.body.style.cssText = "margin:0;overflow:hidden;background:#14120f";
    app.style.cssText = "max-width:none;padding:0;margin:0";
    app.innerHTML = `
       <style>
#ui-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10;
            background: rgba(20, 18, 15, 0.94);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-bottom: 1px solid var(--panel-edge);
            padding: 10px 18px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
#controls.fs-floating {
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translate(-50%, -8px);
            width: min(420px, 92vw);
            margin: 0;
            box-shadow: 0 16px 40px rgba(0,0,0,0.5);
            transition: transform 0.15s ease, opacity 0.15s ease, visibility 0.15s;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }
#ui-overlay:hover #controls.fs-floating,
#ui-overlay:focus-within #controls.fs-floating {
            transform: translate(-50%, 0);
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
          }
       </style>
       <div id="canvas-wrap" style="width:100vw;height:100vh;position:fixed;inset:0;z-index:0"></div>
<div id="ui-overlay" style="position:fixed">
           <div style="display:flex;flex-direction:column;gap:4px">
             <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
               <a class="back-link" href="index.html" style="flex-shrink:0">← Games</a>
               <div class="preset-row" style="margin:0">
                 <select id="preset-select">${_presetOptionsHTML()}</select>
               </div>
               <div class="row tight" style="margin:0;flex-wrap:wrap">${_buttonsHTML()}</div>
               <span id="status-text" style="font-size:12px;color:var(--muted);letter-spacing:0.06em;margin-left:auto"></span>
             </div>
             <h2 style="font-size:13px;color:var(--ink);opacity:0.85;margin:0;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">${_cfg.title}</h2>
           </div>
           <div class="hint-note" id="note" style="margin:0"></div>
           <div class="controls fs-floating" id="controls" style="display:none">${_slidersHTML("Apply &amp; start")}</div>
         </div>
     `;
  } else {
    app.innerHTML = `
      <a class="back-link" href="index.html">← Games</a>
      <header>
        <h1>${_cfg.title}</h1>
        <span class="tag">${_cfg.tag}</span>
      </header>
      <div id="canvas-wrap"></div>
      <div class="status" id="status"><span class="dot"></span><span id="status-text">in progress</span></div>
      <div class="preset-row">
        <select id="preset-select">${_presetOptionsHTML()}</select>
      </div>
      <div class="row tight" id="btn-row">${_buttonsHTML()}</div>
      <div class="hint-note" id="note"></div>
      <div class="controls" id="controls" style="display:none">${_slidersHTML("Apply &amp; generate")}</div>
    `;
  }

  document.getElementById("preset-select").selectedIndex = 0;

  if (!_cfg.presets || _cfg.presets.length === 0) {
    const row = document.querySelector(".preset-row");
    if (row) row.style.display = "none";
  }
}

// ---- public helpers games call ----

function flashNote(msg) {
  const n = document.getElementById("note");
  if (!n) return;
  n.textContent = msg;
  if (_noteTimer) clearTimeout(_noteTimer);
  if (msg)
    _noteTimer = setTimeout(() => {
      n.textContent = "";
    }, 3200);
}

function setStatus(text, state) {
  // state: null | "solved" | "dead"
  const txt = document.getElementById("status-text");
  if (!txt) return;
  const colors = {
    solved: "var(--accent)",
    dead: "var(--bug)",
    null: "var(--muted)",
  };
  txt.style.color = colors[state] ?? colors["null"];
  txt.textContent = text;
  // non-fullscreen also has a wrapper with classes
  const el = document.getElementById("status");
  if (el) {
    el.classList.remove("solved", "dead");
    if (state) el.classList.add(state);
  }
}

let _hintPending = false;
let _hintUsed = false;
let _hintTimer = null;

function confirmHint(fn) {
  const btn = document.getElementById("btn-hint");
  if (_hintUsed) {
    fn();
    return;
  }
  if (!_hintPending) {
    _hintPending = true;
    if (btn) {
      btn.textContent = "Sure?";
      btn.classList.add("hint-confirm");
    }
    clearTimeout(_hintTimer);
    _hintTimer = setTimeout(() => _clearHintPending(), 2500);
  } else {
    _clearHintPending();
    _hintUsed = true;
    fn();
    if (btn) btn.classList.add("hint-confirm");
  }
}

function _clearHintPending() {
  clearTimeout(_hintTimer);
  _hintPending = false;
  const btn = document.getElementById("btn-hint");
  if (btn) {
    btn.textContent = "Hint";
    if (!_hintUsed) btn.classList.remove("hint-confirm");
  }
}

function resetHint() {
  _hintUsed = false;
  _clearHintPending();
}

function setButtonActive(id, active) {
  const b = document.getElementById(id);
  if (b) b.classList.toggle("active", active);
}

function syncSliderUI() {
  if (!_cfg) return;
  const vals = _cfg.getSliderValues();
  for (const s of _cfg.sliders) {
    const el = document.getElementById(s.id);
    const vEl = document.getElementById("v-" + s.id);
    if (!el || !vEl) continue;
    el.value = String(vals[s.id]);
    vEl.textContent = s.fmt ? s.fmt(vals[s.id]) : vals[s.id];
    if (s.max_from) {
      const cap = vals[s.max_from];
      if (cap !== undefined) el.max = String(cap);
    }
  }
  _syncPresetSelect();
}

// ---- internal ----

function _syncPresetSelect() {
  const sel = document.getElementById("preset-select");
  if (!sel) return;
  // Don't auto-switch away from custom while the user is adjusting sliders
  if (sel.value === "custom") return;
  const vals = _cfg.getSliderValues();
  const key = _cfg.sliders.map((s) => vals[s.id]).join(",");
  let found = false;
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === key) {
      sel.selectedIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === "custom") {
        sel.selectedIndex = i;
        break;
      }
    }
  }
  _syncControlsVisibility();
}

function _syncControlsVisibility() {
  const sel = document.getElementById("preset-select");
  const controls = document.getElementById("controls");
  if (!sel || !controls) return;
  controls.style.display = sel.value === "custom" ? "" : "none";
}

function _wireShell() {
  const sel = document.getElementById("preset-select");
  sel.addEventListener("change", function () {
    if (this.value === "custom") {
      _syncControlsVisibility();
      return;
    }
    const values = this.value.split(",").map(Number);
    _cfg.onPreset(values);
  });

  for (const s of _cfg.sliders) {
    const el = document.getElementById(s.id);
    if (!el) continue;
    el.addEventListener("input", () => {
      _cfg.onSlider(s.id, +el.value);
      if (_cfg.onClamp) _cfg.onClamp();
      syncSliderUI();
    });
  }

  document.getElementById("btn-apply").addEventListener("click", () => {
    if (_cfg.onClamp) _cfg.onClamp();
    syncSliderUI();
    const values = _cfg.sliders.map((s) => _cfg.getSliderValues()[s.id]);
    _cfg.onPreset(values);
  });

  for (const b of _cfg.buttons) {
    const el = document.getElementById(b.id);
    if (el && b.onClick) el.addEventListener("click", b.onClick);
  }

  if (_cfg.info) {
    document
      .getElementById("btn-info")
      .addEventListener("click", () => _openInfo());
  }
}

// ---- info modal ----

let _infoP5 = null;

function _openInfo() {
  if (document.getElementById("info-backdrop")) return;
  const anim = _cfg.info.anim;

  const backdrop = document.createElement("div");
  backdrop.id = "info-backdrop";
  backdrop.className = "info-backdrop";
  backdrop.innerHTML = `
    <div class="info-modal">
      <div id="info-canvas-wrap"></div>
      <div class="info-caption" id="info-caption"></div>
      <button id="info-close">✕</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) _closeInfo();
  });
  document.getElementById("info-close").addEventListener("click", _closeInfo);

  const wrap = document.getElementById("info-canvas-wrap");
  const holder = document.createElement("div");
  wrap.appendChild(holder);

  _infoP5 = new p5((p) => {
    let frame = 0;
    let caption = "";
    p.setup = () => {
      const cnv = p.createCanvas(320, 200);
      cnv.parent(holder);
      p.frameRate(30);
    };
    p.draw = () => {
      frame++;
      const result = anim(p, 320, 200, frame);
      if (result && result.caption !== caption) {
        caption = result.caption;
        const el = document.getElementById("info-caption");
        if (el) el.textContent = caption;
      }
    };
  });
}

function _closeInfo() {
  if (_infoP5) {
    _infoP5.remove();
    _infoP5 = null;
  }
  document.getElementById("info-backdrop")?.remove();
}
