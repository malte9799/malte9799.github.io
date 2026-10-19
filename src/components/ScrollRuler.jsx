import { useEffect, useMemo, useRef, useState } from 'react';
import { scrollToY } from '../lib/useLenis';

// Custom scrollbar after getartcraft.com: a 60px rail on the right edge with
// a ruler (0-100) at page scale that drifts with the page, a blue needle with
// a rolling percentage readout, and the section names as letters:
//   - upcoming sections wait horizontally in a queue at the bottom,
//   - when the page nears their section they detach letter by letter and ride
//     the rail vertically (reading bottom to top), moving up with the page,
//   - at the flip line they swing on an arc to the top, a pile of compact
//     names with the current section as the big heading.
// Stop scrolling with a name half-turned and the page settles on its own,
// before or behind the turn, so no name is ever left mid-flight.
// Hovering the rail zooms the ruler to the whole page: every tick slides to
// its place on the map, the names turn horizontal at their spot, and a
// bracket shows what is on screen (click or drag to scroll).
// Desktop with a fine pointer only; reduced motion gets a plain link list.

const NAV_H = 52;
const RAIL_W = 60;
const EDGE_PAD = 12;
const MINOR_PCT = 1;
const LABEL_PCT = 5;
const THRESHOLD_PCT = 12; // flip line, in % of the viewport height
const HEADING_PX = 34;
const RIDING_PX = 20;
const QUEUE_PX = 16;
const TOP_PAD = 28;
const CURRENT_GAP = 26;
const QUEUE_SLOT = 20;
const QUEUE_PAD = 36;
const FLIP_ZONE = 200; // scroll px a top flip takes
const DETACH_ZONE = 240; // scroll px a queued name takes to move onto the rail
const STAGGER = 0.16;
const ARC = 28;
const HERO_START = 0.3; // the first section flips once the page has scrolled this far (viewport heights)
const HERO_ZONE = 320;
const JUMP_DUR = 1.25;
const SNAP_DELAY = 400; // ms of rest with a name half-turned before it settles
const SNAP_DUR = 0.7;
const ZOOM_IN_DELAY = 150;
const ZOOM_OUT_DELAY = 150;
const ZOOM_LERP = 10;
const DRAG_LERP = 0.18;
const INTRO_DUR = 1;
const INTRO_STAGGER = 0.01;
const VEL_RADIUS = 180;
const VEL_MAX = 0.6;
const MINOR_ALPHA = 0.4;
const MAJOR_ALPHA = 0.8;
const LABEL_ALPHA = 0.5;
const MINOR_LEN = 10;
const MAJOR_LEN = 20;
const QUEUE_ALPHA = 0.35;
const MAP_ALPHA = 0.85;
const YIELD_PAD = 24;
const NEEDLE_FADE_PCT = 3;
const BRACKET_ALPHA = 0.1;
const POOL_PAD = 64;
const QUERY = '(pointer: fine) and (hover: hover) and (min-width: 1024px)';
const REDUCED = '(prefers-reduced-motion: no-preference)';
const FROST_MASK =
  'linear-gradient(to left, black 40%, rgba(0,0,0,0.745) 47.5%, rgba(0,0,0,0.53) 55%, rgba(0,0,0,0.357) 62.5%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.118) 77.5%, rgba(0,0,0,0.047) 85%, rgba(0,0,0,0.01) 92.5%, transparent 100%)';
const poolMask = y =>
  `radial-gradient(100% 100% at 100% ${y}, black 38%, rgba(0,0,0,0.82) 56%, rgba(0,0,0,0.48) 72%, rgba(0,0,0,0.2) 86%, rgba(0,0,0,0.05) 94%, transparent 97%)`;

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutExpo = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const rulerMap = vh => {
  const base = NAV_H + EDGE_PAD;
  return { base, span: Math.max(1, vh - NAV_H - 2 * EDGE_PAD), drift: f => base - f * (NAV_H + 2 * EDGE_PAD) };
};

function useMode() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const fine = window.matchMedia(QUERY);
    const motion = window.matchMedia(REDUCED);
    const update = () => setMode(!mobile && fine.matches ? (motion.matches ? 'full' : 'static') : null);
    update();
    fine.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      motion.removeEventListener('change', update);
    };
  }, []);
  return mode;
}

export default function ScrollRuler({ sections = [] }) {
  const mode = useMode();
  if (!mode) return null;
  return <Ruler mode={mode} sections={sections} />;
}

// Advance width of every letter of every label, in em.
function measureLabels(labels) {
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font:700 100px/1 ${getComputedStyle(document.body).fontFamily};`;
  document.body.appendChild(box);
  const out = {};
  for (const label of labels) {
    box.textContent = '';
    const adv = [...label].map(ch => {
      const span = document.createElement('span');
      span.textContent = ch;
      box.appendChild(span);
      return span.getBoundingClientRect().width / 100;
    });
    const cum = [];
    let total = 0;
    for (const a of adv) {
      cum.push(total);
      total += a;
    }
    out[label] = { adv, cum, total };
  }
  box.remove();
  return out;
}

function Ruler({ mode, sections }) {
  const full = mode === 'full';
  const [geom, setGeom] = useState({ docH: 0, vh: 0, vw: 0 });
  const [anchors, setAnchors] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const railRef = useRef(null);
  const tickWrapRef = useRef(null);
  const rowRefs = useRef([]);
  const lineRefs = useRef([]);
  const numRefs = useRef([]);
  const bracketRef = useRef(null);
  const needleRef = useRef(null);
  const readoutRef = useRef(null);
  const digitRefs = useRef([]);
  const ghostRef = useRef(null);
  const poolTopRef = useRef(null);
  const poolBottomRef = useRef(null);
  const nameRefs = useRef([]);
  const hover = useRef(-1);
  const st = useRef({
    lastY: 0,
    vel: 0,
    zoomIntent: false,
    zoomTimer: 0,
    zoom: 0,
    dragging: false,
    dragStartY: 0,
    dragMoved: 0,
    ghostOn: false,
    ghostY: 0,
    introStart: 0,
    prevPct: -1,
    prevDigits: [-1, -1, -1],
    readoutAbove: false,
    zoomWrote: false,
    spans: [],
    armed: true,
    snapping: false,
    snapSince: null,
    jumpUntil: 0,
    clickUntil: [],
    hov: [],
    geom,
  });
  st.current.geom = geom;

  const labels = useMemo(() => sections.map(s => s.label.toUpperCase()), [sections]);

  useEffect(() => {
    document.documentElement.classList.add('has-scroll-ruler');
    document.documentElement.style.setProperty('--ruler-rail', `${RAIL_W}px`);
    return () => {
      document.documentElement.classList.remove('has-scroll-ruler');
      document.documentElement.style.removeProperty('--ruler-rail');
    };
  }, []);

  // Page size.
  useEffect(() => {
    const read = () => {
      const next = { docH: document.documentElement.scrollHeight, vh: window.innerHeight, vw: window.innerWidth };
      setGeom(g => (g.docH === next.docH && g.vh === next.vh && g.vw === next.vw ? g : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(document.body);
    window.addEventListener('resize', read);
    document.fonts?.ready.then(read).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  // Where each section starts and ends on the page.
  useEffect(() => {
    if (!geom.docH) return;
    setAnchors(
      sections.map(({ selector, label }, index) => {
        const el = document.querySelector(selector);
        const rect = el?.getBoundingClientRect();
        return {
          selector,
          label: label.toUpperCase(),
          index,
          anchor: rect ? rect.top + window.scrollY : 0,
          bottom: rect ? rect.bottom + window.scrollY : 0,
        };
      })
    );
  }, [geom, sections]);

  // Letter widths, once the fonts are in.
  const labelKey = labels.join('|');
  useEffect(() => {
    if (!full || !labels.length) return undefined;
    let dead = false;
    const run = () => !dead && setMetrics(measureLabels(labels));
    if (document.fonts?.ready) document.fonts.ready.then(run).catch(run);
    else run();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, labelKey]);

  const ticks = useMemo(() => {
    if (!geom.docH) return [];
    const out = [];
    for (let v = 0; v <= 100 + 1e-6; v += MINOR_PCT) {
      const pct = Math.round(v * 100) / 100;
      const major = Math.abs(pct % LABEL_PCT) < 1e-6;
      out.push({ pct, docY: (pct / 100) * geom.docH, major, alpha: major ? MAJOR_ALPHA : MINOR_ALPHA });
    }
    return out;
  }, [geom.docH]);

  // The frame loop: rail, needle, zoom, section names.
  useEffect(() => {
    const { docH, vh, vw } = geom;
    if (!docH || !vh || !ticks.length) return undefined;
    const s = st.current;
    const ready = full && metrics && anchors.length === sections.length && anchors.every(a => metrics[a.label]);
    s.introStart = s.introStart || performance.now();
    let last = performance.now();
    let raf = 0;

    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1) || 0.016;
      last = now;
      const y = window.scrollY;
      const maxS = Math.max(1, docH - vh);
      const f = clamp01(y / maxS);
      s.vel += ((y - s.lastY) / dt - s.vel) * (1 - Math.exp(-6 * dt));
      s.lastY = y;
      const map = rulerMap(vh);
      const drift = map.drift(f);

      tickWrapRef.current.style.transform = `translate3d(0, ${-y + drift}px, 0)`;

      // Needle and the rolling percentage.
      const needleY = map.base + f * map.span;
      needleRef.current.style.transform = `translate3d(0, ${needleY}px, 0)`;
      needleRef.current.style.opacity = String(clamp01(f / (NEEDLE_FADE_PCT / 100)));
      const above = needleY > vh - 26;
      if (above !== s.readoutAbove) {
        s.readoutAbove = above;
        readoutRef.current.style.top = above ? '-14px' : '4px';
      }
      const pct = Math.round(f * 100);
      if (pct !== s.prevPct) {
        s.prevPct = pct;
        railRef.current.setAttribute('aria-valuenow', String(pct));
        const text = String(pct).padStart(3, '0');
        for (let i = 0; i < 3; i++) {
          const d = text.charCodeAt(i) - 48;
          if (d !== s.prevDigits[i]) {
            s.prevDigits[i] = d;
            if (digitRefs.current[i]) digitRefs.current[i].style.transform = `translateY(${-d}em)`;
          }
        }
      }

      // Zoom to the full page while the rail is hovered.
      if (full) {
        const target = s.zoomIntent || s.dragging ? 1 : 0;
        s.zoom += (target - s.zoom) * (1 - Math.exp(-ZOOM_LERP * dt));
        if (target === 0 && s.zoom < 5e-4) s.zoom = 0;
        if (target === 1 && s.zoom > 0.9995) s.zoom = 1;
      }
      const zoom = full ? s.zoom : 0;
      bracketRef.current.style.transform = `translate3d(0, ${map.base + (y / docH) * map.span}px, 0)`;
      bracketRef.current.style.height = `${(vh / docH) * map.span}px`;
      bracketRef.current.style.opacity = String(zoom);
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(0, ${s.ghostY}px, 0)`;
        ghostRef.current.style.opacity = s.ghostOn ? String(0.2 + 0.8 * zoom) : '0';
      }

      // Section names.
      if (ready) frameNames(now, dt, y, maxS, drift, map, zoom);

      // Ticks: draw-in at load, stretch with scroll speed, slide to the map when zoomed.
      const elapsed = (now - s.introStart) / 1000;
      const introDone = !full || elapsed > INTRO_DUR + ticks.length * INTRO_STAGGER;
      const velK = clamp01(Math.abs(s.vel) / 3000);
      const needleDoc = f * docH;
      const spans = s.spans;
      for (let n = 0; n < ticks.length; n++) {
        const tk = ticks[n];
        const at = tk.docY - y + drift;
        const onMap = map.base + (tk.pct / 100) * map.span;
        const row = rowRefs.current[n];
        if (row && (zoom > 0 || s.zoomWrote)) row.style.transform = zoom > 0 ? `translate3d(0, ${zoom * (onMap - at)}px, 0)` : '';
        const num = numRefs.current[n];
        if (num) {
          const e = at + zoom * (onMap - at);
          let keep = 1;
          for (const sp of spans) {
            const gap = e < sp.top ? sp.top - e : e > sp.bottom ? e - sp.bottom : 0;
            if (gap < YIELD_PAD) keep = Math.min(keep, 1 - sp.k * (1 - gap / YIELD_PAD));
          }
          num.style.opacity = String(LABEL_ALPHA * (1 - (1 - keep) * (1 - zoom)));
        }
        const line = lineRefs.current[n];
        if (!line) continue;
        let intro = 1;
        if (!introDone) {
          const local = clamp01((elapsed - n * INTRO_STAGGER) / INTRO_DUR);
          intro = 1 - (1 - local) ** 3;
        }
        const dist = Math.abs(tk.docY - needleDoc);
        if (introDone && dist < VEL_RADIUS) {
          const e = 1 - dist / VEL_RADIUS;
          const r = velK * e * e;
          line.style.transform = `scaleX(${1 + VEL_MAX * r})`;
          line.style.opacity = String(Math.min(1, tk.alpha + 0.6 * r));
        } else {
          line.style.transform = `scaleX(${intro})`;
          line.style.opacity = String(tk.alpha * intro);
        }
      }
      s.zoomWrote = zoom > 0;
    };

    // Positions every letter of every name from scroll, zoom and hover.
    const frameNames = (now, dt, y, maxS, drift, map, zoom) => {
      const D = HEADING_PX;
      const rid = RIDING_PX / D;
      const zq = QUEUE_PX / D;
      const thr = (THRESHOLD_PCT / 100) * vh;
      const A = NAV_H + TOP_PAD;
      const I = vh - QUEUE_PAD;
      const railCx = vw - RAIL_W / 2;
      const zoomH = easeInOutCubic(zoom);
      const B = (m, i, py, scale, alpha) => {
        const sx = (m.cum[i] + m.adv[i] / 2) * D * scale;
        return { x: vw - (RAIL_W + (m.total * D * scale - sx)), y: py, rot: 0, scale, alpha };
      };
      const Z = (m, i, py) => ({ x: railCx, y: py + (m.total - m.cum[i] - m.adv[i] / 2) * D * rid, rot: -90, scale: rid, alpha: QUEUE_ALPHA });

      const info = anchors.map((a, k) => {
        const m = metrics[a.label];
        const rideLen = m.total * D * rid;
        const v = a.anchor - y + drift;
        let flipP;
        let detachP = 0;
        let scrollFlip = null;
        if (k === 0) {
          // The first section is the page start: it rides the rail until the page scrolls.
          detachP = 1;
          flipP = clamp01((y - vh * HERO_START) / HERO_ZONE);
          scrollFlip = { start: vh * HERO_START, end: vh * HERO_START + HERO_ZONE };
        } else {
          flipP = clamp01((thr + FLIP_ZONE - v) / FLIP_ZONE);
          if (a.anchor - maxS > thr) {
            // Too close to the end of the page to reach the flip line by position alone.
            const tail = Math.min(a.bottom - vh, maxS - 24);
            flipP = Math.max(flipP, clamp01((y - tail) / Math.max(24, maxS - tail)));
            scrollFlip = { start: tail, end: maxS };
          }
        }
        return { m, v, rideLen, flipP, detachP, scrollFlip, yq: I };
      });
      let queued = 0;
      for (let k = info.length - 1; k >= 1; k--) {
        const o = info[k];
        o.yq = I - QUEUE_SLOT * queued;
        o.detachP = clamp01((o.yq + DETACH_ZONE - (o.v + o.rideLen)) / DETACH_ZONE);
        queued += 1 - o.detachP;
      }
      let Y = 0;
      let U = 0;
      let top = 0;
      let bottom = 0;
      info.forEach((o, k) => {
        if (o.flipP >= 1) Y++;
        else if (o.flipP > 0) U += o.flipP;
        top = Math.max(top, o.flipP);
        if (k > 0) bottom = Math.max(bottom, 1 - o.detachP);
      });
      if (poolTopRef.current) poolTopRef.current.style.opacity = String(top);
      if (poolBottomRef.current) poolBottomRef.current.style.opacity = String(bottom);
      s.spans.length = 0;

      info.forEach((o, k) => {
        const els = nameRefs.current[k];
        if (!els?.letters.length) return;
        const { m, v, rideLen, flipP: x, detachP: w, yq } = o;
        const N = m.adv.length;
        let t;
        let rev = false;
        let from;
        let to;
        if (x > 0) {
          t = x;
          rev = true;
          from = i => Z(m, i, v);
          if (x >= 1) {
            const tt = k === Y - 1 ? U : 1;
            const py = A + k * QUEUE_SLOT + CURRENT_GAP * (1 - tt);
            const sc = 1 - (1 - zq) * tt;
            const al = 1 - (1 - QUEUE_ALPHA) * tt;
            to = i => B(m, i, py, sc, al);
          } else {
            to = i => B(m, i, A + k * QUEUE_SLOT + CURRENT_GAP, 1, 1);
          }
        } else if (w < 1) {
          t = w;
          rev = true;
          to = i => Z(m, i, yq - rideLen);
          from = i => B(m, i, yq, zq, QUEUE_ALPHA);
        } else {
          t = 1;
          from = to = i => Z(m, i, v);
        }
        const span = 1 + (N - 1) * STAGGER;
        const mapY = map.base + (k === 0 ? 0 : anchors[k].anchor / docH) * map.span;
        const blend = k === 0 ? zoomH * Math.min(1, x) : zoomH;
        s.hov[k] = (s.hov[k] ?? 0) + ((hover.current === k ? 1 : 0) - (s.hov[k] ?? 0)) * (1 - Math.exp(-dt / 0.08));
        const click = clamp01(((s.clickUntil[k] ?? 0) - now) / 350);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let seen = 0;
        for (let i = 0; i < N; i++) {
          const el = els.letters[i];
          if (!el) continue;
          const order = rev ? N - 1 - i : i;
          const d = easeInOutCubic(clamp01(t * span - order * STAGGER));
          const a = from(i);
          const b = to(i);
          const cx = (a.x + b.x) / 2 - ARC; // the flight bows toward the page
          const cy = (a.y + b.y) / 2;
          const u = 1 - d;
          let px = u * u * a.x + 2 * u * d * cx + d * d * b.x;
          let py = u * u * a.y + 2 * u * d * cy + d * d * b.y;
          let rot = a.rot + (b.rot - a.rot) * d;
          let sc = a.scale + (b.scale - a.scale) * d;
          let al = a.alpha + (b.alpha - a.alpha) * d;
          if (blend > 0) {
            const g = B(m, i, mapY, zq, MAP_ALPHA);
            px += (g.x - px) * blend;
            py += (g.y - py) * blend;
            rot *= 1 - blend;
            sc += (g.scale - sc) * blend;
            al += (g.alpha - al) * blend;
          }
          el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${sc})`;
          el.style.opacity = '1';
          const j = al + (1 - al) * s.hov[k];
          const base = j >= 0.995 ? 'var(--text)' : `color-mix(in srgb, var(--text) ${(100 * clamp01(j)).toFixed(1)}%, var(--bg))`;
          el.style.color = click > 0.01 ? `color-mix(in srgb, var(--ruler-accent-ink) ${(70 * click).toFixed(0)}%, ${base})` : base;
          seen = Math.max(seen, al);
          const along = (m.adv[i] * D * sc) / 2 + 2;
          const across = (D * sc) / 2 + 2;
          const turned = Math.abs(rot) > 45;
          const hx = turned ? across : along;
          const hy = turned ? along : across;
          minX = Math.min(minX, px - hx);
          maxX = Math.max(maxX, px + hx);
          minY = Math.min(minY, py - hy);
          maxY = Math.max(maxY, py + hy);
        }
        const ee = k === 0 ? 0 : w * (1 - x);
        if (ee > 0.02) s.spans.push({ top: v, bottom: v + rideLen, k: ee });
        const hit = els.hit;
        if (hit && Number.isFinite(minX)) {
          hit.style.left = `${minX - 2}px`;
          hit.style.top = `${minY - 2}px`;
          hit.style.width = `${maxX - minX + 4}px`;
          hit.style.height = `${maxY - minY + 4}px`;
          hit.style.pointerEvents = seen > 0.05 && (k > 0 || x > 0.05) ? 'auto' : 'none';
        }
      });

      snap(now, y, maxS, drift, thr, info);
    };

    // Resting with a name half-turned: scroll to whichever side is nearer.
    const snap = (now, y, maxS, drift, thr, info) => {
      const mid = info.findIndex(o => o.flipP > 0.04 && o.flipP < 0.96);
      if (s.dragging) s.armed = true;
      if (s.snapping) {
        if (mid < 0) s.snapping = false;
        return;
      }
      if (mid < 0 || !s.armed || now < s.jumpUntil || Math.abs(s.vel) >= 30 || s.dragging || s.zoom >= 0.3) {
        s.snapSince = null;
        return;
      }
      if (s.snapSince === null) {
        s.snapSince = now;
        return;
      }
      if (now - s.snapSince <= SNAP_DELAY) return;
      const o = info[mid];
      const a = anchors[mid];
      let e;
      if (o.scrollFlip) e = o.flipP >= 0.5 ? o.scrollFlip.end + 4 : o.scrollFlip.start - 4;
      else e = a.anchor + drift - (o.flipP >= 0.5 ? thr - 4 : thr + FLIP_ZONE + 4);
      // Scroll positions where a name has just flipped / just unflipped.
      const edges = (sec, oo) => {
        const yFlip = sec.anchor + drift - thr - 0.04 * FLIP_ZONE;
        const yUnflip = sec.anchor + drift - thr - 0.96 * FLIP_ZONE;
        if (!oo.scrollFlip) return { yFlip, yUnflip };
        const len = oo.scrollFlip.end - oo.scrollFlip.start;
        const late = oo.scrollFlip.start + 0.96 * len;
        const early = oo.scrollFlip.start + 0.04 * len;
        return mid === 0 || sec === anchors[0] ? { yFlip: late, yUnflip: early } : { yFlip: Math.min(yFlip, late), yUnflip: Math.min(yUnflip, early) };
      };
      // Don't push another name into a half-turn on the way.
      let l = e;
      info.forEach((oo, i) => {
        if (i === mid) return;
        const ed = edges(anchors[i], oo);
        if (oo.flipP >= 0.96) l = Math.max(l, ed.yFlip + 2);
        else if (oo.flipP <= 0.04) l = Math.min(l, ed.yUnflip - 2);
      });
      const own = edges(a, o);
      const target = Math.max(0, Math.min(maxS, (o.flipP >= 0.5 ? l >= own.yFlip : l <= own.yUnflip) ? l : e));
      s.snapping = true;
      s.armed = false;
      s.snapSince = null;
      scrollToY(target, { duration: SNAP_DUR, easing: easeInOutCubic });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [full, geom, anchors, metrics, ticks, sections.length]);

  useEffect(() => {
    const arm = () => {
      st.current.armed = true;
    };
    window.addEventListener('wheel', arm, { passive: true });
    window.addEventListener('touchmove', arm, { passive: true });
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('wheel', arm);
      window.removeEventListener('touchmove', arm);
      window.removeEventListener('keydown', arm);
      window.clearTimeout(st.current.zoomTimer);
    };
  }, []);

  const setZoomIntent = on => {
    const s = st.current;
    window.clearTimeout(s.zoomTimer);
    s.zoomTimer = window.setTimeout(() => {
      s.zoomIntent = on;
    }, on ? ZOOM_IN_DELAY : ZOOM_OUT_DELAY);
  };

  const scrollFromRail = clientY => {
    const { docH, vh } = st.current.geom;
    const map = rulerMap(vh);
    return clamp01((clientY - map.base) / map.span) * Math.max(1, docH - vh);
  };

  const onClick = e => {
    const s = st.current;
    if (s.dragMoved > 4) return;
    const target = scrollFromRail(e.clientY);
    const dist = Math.abs(target - window.scrollY);
    const duration = JUMP_DUR * (0.4 + 0.6 * Math.min(1, dist / (2.5 * s.geom.vh)));
    s.jumpUntil = performance.now() + duration * 1000 + 150;
    scrollToY(target, { duration, easing: easeOutExpo });
  };

  const onPointerMove = e => {
    const s = st.current;
    const map = rulerMap(s.geom.vh);
    s.ghostOn = true;
    s.ghostY = Math.max(map.base, Math.min(map.base + map.span, e.clientY));
    if (s.dragging) {
      s.dragMoved = Math.max(s.dragMoved, Math.abs(e.clientY - s.dragStartY));
      scrollToY(scrollFromRail(e.clientY), { lerp: DRAG_LERP });
    }
  };

  const endDrag = e => {
    const s = st.current;
    if (!s.dragging) return;
    s.dragging = false;
    const r = railRef.current.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) {
      s.ghostOn = false;
      setZoomIntent(false);
    }
  };

  const jumpTo = (k, now) => {
    const a = anchors[k];
    if (!a) return;
    st.current.clickUntil[k] = now + 350;
    st.current.jumpUntil = now + JUMP_DUR * 1000 + 150;
    const el = document.querySelector(a.selector);
    const target = k === 0 || !el ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - NAV_H);
    scrollToY(target, { duration: JUMP_DUR, easing: easeOutExpo });
  };

  const total = metrics ? Math.max(260, ...labels.map(l => (metrics[l]?.total ?? 0) * HEADING_PX)) : 260;
  const poolW = total + RAIL_W + POOL_PAD;
  const poolTopH = NAV_H + TOP_PAD + Math.max(0, sections.length - 1) * QUEUE_SLOT + CURRENT_GAP + HEADING_PX + POOL_PAD;
  const poolBottomH = QUEUE_PAD + sections.length * QUEUE_SLOT + POOL_PAD;
  const pool = { position: 'absolute', right: 0, width: poolW, opacity: 0 };

  if (!geom.docH) return null;

  return (
    <>
      <div
        ref={railRef}
        role="scrollbar"
        aria-controls="main"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-label="Page position"
        className="ruler"
        style={{ width: RAIL_W }}
        onClick={onClick}
        onPointerEnter={full ? () => setZoomIntent(true) : undefined}
        onPointerLeave={
          full
            ? () => {
                st.current.ghostOn = false;
                if (!st.current.dragging) setZoomIntent(false);
              }
            : undefined
        }
        onPointerMove={full ? onPointerMove : undefined}
        onPointerDown={
          full
            ? e => {
                e.preventDefault();
                const s = st.current;
                s.dragStartY = e.clientY;
                s.dragMoved = 0;
                s.dragging = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            : undefined
        }
        onPointerUp={full ? endDrag : undefined}
        onPointerCancel={full ? endDrag : undefined}
      >
        <div aria-hidden="true" className="ruler-frost" style={{ maskImage: FROST_MASK, WebkitMaskImage: FROST_MASK }} />
        <div ref={tickWrapRef} aria-hidden="true" className="ruler-ticks" style={{ height: geom.docH }}>
          {ticks.map((tk, n) => (
            <div key={tk.pct} ref={el => (rowRefs.current[n] = el)} className="ruler-tick" style={{ top: tk.docY }}>
              <span
                ref={el => (lineRefs.current[n] = el)}
                className="ruler-tick-line"
                style={{ width: tk.major ? MAJOR_LEN : MINOR_LEN, opacity: full ? 0 : tk.alpha, transform: full ? 'scaleX(0)' : undefined }}
              />
              {tk.major && (
                <span ref={el => (numRefs.current[n] = el)} className="ruler-tick-num" style={{ right: MAJOR_LEN + 4, opacity: LABEL_ALPHA }}>
                  {tk.pct}
                </span>
              )}
            </div>
          ))}
        </div>
        {full && (
          <div ref={bracketRef} aria-hidden="true" className="ruler-bracket">
            <span className="ruler-bracket-fill" style={{ opacity: BRACKET_ALPHA }} />
            <span className="ruler-bracket-edge" style={{ top: 0 }} />
            <span className="ruler-bracket-edge" style={{ bottom: 0 }} />
          </div>
        )}
        {!full && <div ref={bracketRef} hidden />}
        <div ref={needleRef} aria-hidden="true" className="ruler-needle">
          <span className="ruler-needle-line" />
          <span ref={readoutRef} className="ruler-readout">
            <span className="ruler-digits">
              {[0, 1, 2].map(i => (
                <span key={i} ref={el => (digitRefs.current[i] = el)} className="ruler-digit-col">
                  {'0123456789'.split('').map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </span>
              ))}
            </span>
            <span style={{ marginLeft: 2 }}>%</span>
          </span>
        </div>
      </div>

      {full && (
        <div ref={ghostRef} aria-hidden="true" className="ruler-ghost" style={{ width: RAIL_W }}>
          <div className="ruler-ghost-line" />
        </div>
      )}

      {full ? (
        <>
          <div aria-hidden="true" className="ruler-pools">
            <div
              ref={poolTopRef}
              className="ruler-pool"
              style={{ ...pool, top: 0, height: poolTopH, maskImage: poolMask('0%'), WebkitMaskImage: poolMask('0%') }}
            />
            <div
              ref={poolBottomRef}
              className="ruler-pool"
              style={{ ...pool, bottom: 0, height: poolBottomH, maskImage: poolMask('100%'), WebkitMaskImage: poolMask('100%') }}
            />
          </div>
          <div className="ruler-names">
            {labels.map((label, k) => {
              const els = (nameRefs.current[k] ??= { letters: [], hit: null });
              return (
                <span key={sections[k].selector}>
                  <button
                    type="button"
                    ref={el => (els.hit = el)}
                    aria-label={`Jump to ${sections[k].label}`}
                    className="ruler-hit"
                    onClick={e => {
                      e.stopPropagation();
                      jumpTo(k, performance.now());
                    }}
                    onPointerEnter={() => (hover.current = k)}
                    onPointerLeave={() => {
                      if (hover.current === k) hover.current = -1;
                    }}
                  />
                  {[...label].map((ch, i) => (
                    <span key={i} ref={el => (els.letters[i] = el)} aria-hidden="true" className="ruler-letter">
                      {ch}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <nav aria-label="Sections" className="ruler-static" style={{ bottom: QUEUE_PAD, right: RAIL_W }}>
          <ul>
            {sections.map((sec, k) => (
              <li key={sec.selector}>
                <a
                  href={sec.selector}
                  onClick={e => {
                    e.preventDefault();
                    jumpTo(k, performance.now());
                  }}
                >
                  {sec.label.toUpperCase()}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
