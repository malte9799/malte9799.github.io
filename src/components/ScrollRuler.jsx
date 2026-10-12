import { useEffect, useRef, useState } from 'react';
import { scrollToY } from '../lib/useLenis';

// Custom scrollbar: a ruler from 0 to 100 down the right edge.
// Closed, the ruler is drawn at page scale and scrolls along with the content;
// the section names sit stacked in the bottom corner. Hovering opens it: the
// whole page folds into the viewport height, a window marks what is on
// screen (drag it to scroll), and each section name moves to its spot on the
// ruler (click to jump there). Desktop with a fine pointer only; touch and
// small screens keep the native scrollbar.

const UNITS = 100;
const NAV_H = 52;
const PAD_CLOSED = 14;
const PAD_OPEN = 28;
const LABEL_LINE = 22;
const OPEN_SECONDS = 0.55;
const TICKS = Array.from({ length: UNITS + 1 }, (_, i) => i);
const QUERY = '(hover: hover) and (pointer: fine) and (min-width: 900px)';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function useEnabled() {
  const [enabled, setEnabled] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return enabled;
}

export default function ScrollRuler({ sections = [] }) {
  const enabled = useEnabled();
  if (!enabled) return null;
  return <Ruler sections={sections} />;
}

function Ruler({ sections }) {
  const rootRef = useRef(null);
  const rulerRef = useRef(null);
  const windowRef = useRef(null);
  const thumbRef = useRef(null);
  const lineRef = useRef(null);
  const labelRefs = useRef([]);
  const state = useRef({ open: false, t: 0, drag: null, pointerY: null, tops: [], geo: null });

  useEffect(() => {
    document.documentElement.classList.add('has-scroll-ruler');
    return () => document.documentElement.classList.remove('has-scroll-ruler');
  }, []);

  // Where each section starts on the page.
  useEffect(() => {
    const measure = () => {
      state.current.tops = sections.map(({ selector }) => {
        const el = document.querySelector(selector);
        return el ? el.getBoundingClientRect().top + window.scrollY : 0;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sections]);

  // One frame loop positions everything; only cheap reads and style writes.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = state.current;
      const target = s.open || s.drag ? 1 : 0;
      s.t = reduced ? target : clamp(s.t + (target > s.t ? dt : -dt) / OPEN_SECONDS, 0, 1);
      const t = s.t;
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

      const viewH = window.innerHeight;
      const H = viewH - NAV_H;
      const docH = Math.max(document.documentElement.scrollHeight, viewH + 1);
      const maxScroll = docH - viewH;
      const y = window.scrollY;
      const p = clamp(y / maxScroll, 0, 1);

      // Closed: the ruler is as long as the page and moves with it.
      const b0 = docH / UNITS;
      const a0 = PAD_CLOSED - p * (UNITS * b0 - (H - 2 * PAD_CLOSED));
      // Open: the whole ruler fits the track.
      const b1 = (H - 2 * PAD_OPEN) / UNITS;
      const a1 = PAD_OPEN;
      // Zoom around the middle of the screen: scale changes geometrically,
      // that point's position linearly.
      const anchor = ((y + viewH / 2) / docH) * UNITS;
      const b = b0 * (b1 / b0) ** eased;
      const a = lerp(a0 + anchor * b0, a1 + anchor * b1, eased) - anchor * b;
      s.geo = { a1, b1, docH, maxScroll, viewH };

      const root = rootRef.current;
      root.style.setProperty('--t', eased.toFixed(4));
      rulerRef.current.style.setProperty('--b', `${b}px`);
      rulerRef.current.style.transform = `translate3d(0, ${a}px, 0)`;

      // Visible part of the page, on the open ruler.
      const winTop = a1 + (y / docH) * UNITS * b1;
      const winH = (viewH / docH) * UNITS * b1;
      windowRef.current.style.transform = `translate3d(0, ${winTop}px, 0)`;
      windowRef.current.style.height = `${winH}px`;
      s.win = { top: winTop, height: winH };

      const thumbH = Math.max(36, (viewH / docH) * H);
      thumbRef.current.style.height = `${thumbH}px`;
      thumbRef.current.style.transform = `translate3d(0, ${p * (H - thumbH)}px, 0)`;

      if (s.pointerY != null) lineRef.current.style.transform = `translate3d(0, ${s.pointerY}px, 0)`;

      // Section names: stacked bottom corner when closed, on the ruler when open.
      const n = sections.length;
      let active = -1;
      s.tops.forEach((top, k) => {
        if (top <= y + viewH * 0.4) active = k;
      });
      labelRefs.current.forEach((el, k) => {
        if (!el) return;
        const closedY = H - PAD_CLOSED - (n - k - 0.5) * LABEL_LINE;
        const openY = a1 + clamp((s.tops[k] ?? 0) / docH, 0, 1) * UNITS * b1;
        el.style.transform = `translate3d(0, ${lerp(closedY, openY, eased)}px, 0) translateY(-50%)`;
        el.dataset.active = k === active ? 'true' : 'false';
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sections]);

  const trackY = e => e.clientY - rootRef.current.getBoundingClientRect().top;

  const scrollForWindowTop = (top, immediate) => {
    const { a1, b1, docH, maxScroll } = state.current.geo;
    scrollToY(clamp(((top - a1) / (UNITS * b1)) * docH, 0, maxScroll), { immediate });
  };

  const onPointerDown = e => {
    if (e.button !== 0 || e.target.closest('.scroll-ruler-label')) return;
    const s = state.current;
    if (!s.geo || !s.win) return;
    e.preventDefault();
    const py = trackY(e);
    const inside = py >= s.win.top && py <= s.win.top + s.win.height;
    // Grab the window where it was hit, or centre it on the click.
    s.drag = { offset: inside ? py - s.win.top : s.win.height / 2 };
    rootRef.current.setPointerCapture(e.pointerId);
    rootRef.current.dataset.dragging = 'true';
    if (!inside) scrollForWindowTop(py - s.drag.offset, false);
  };

  const onPointerMove = e => {
    const s = state.current;
    s.pointerY = trackY(e);
    if (s.drag) scrollForWindowTop(s.pointerY - s.drag.offset, true);
  };

  const endDrag = e => {
    const s = state.current;
    if (!s.drag) return;
    s.drag = null;
    delete rootRef.current.dataset.dragging;
    if (rootRef.current.hasPointerCapture(e.pointerId)) rootRef.current.releasePointerCapture(e.pointerId);
    const r = rootRef.current.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) {
      s.open = false;
      delete rootRef.current.dataset.open;
    }
  };

  const setOpen = open => {
    state.current.open = open;
    if (open) rootRef.current.dataset.open = 'true';
    else if (!state.current.drag) delete rootRef.current.dataset.open;
  };

  const jumpTo = k => {
    scrollToY(Math.max(0, (state.current.tops[k] ?? 0) - NAV_H));
  };

  return (
    <aside
      ref={rootRef}
      className="scroll-ruler"
      aria-hidden="true"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="scroll-ruler-bg" />
      <div ref={windowRef} className="scroll-ruler-window" />
      <div ref={rulerRef} className="scroll-ruler-ticks">
        {TICKS.map(i => (
          <div
            key={i}
            className={i % 5 === 0 ? 'scroll-ruler-tick is-major' : 'scroll-ruler-tick'}
            style={{ '--i': i }}
          >
            {i % 5 === 0 && <span>{i}</span>}
          </div>
        ))}
      </div>
      <div ref={lineRef} className="scroll-ruler-line" />
      <div ref={thumbRef} className="scroll-ruler-thumb" />
      {sections.map((section, k) => (
        <button
          key={section.selector}
          ref={el => (labelRefs.current[k] = el)}
          type="button"
          tabIndex={-1}
          className="scroll-ruler-label"
          onClick={() => jumpTo(k)}
        >
          {section.label}
        </button>
      ))}
    </aside>
  );
}
