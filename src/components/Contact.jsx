import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { CONTACT_EMAIL } from '../data/contact';
import { ArrowRight } from './Icons';
import PixelCard from './reactbits/PixelCard';
import FlyButton from './FlyButton';
import './contact.css';
import { setScrollLocked } from '../lib/scrollLock';

const pad = n => String(n + 1).padStart(2, '0');
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Types `text` in with a short scramble whenever it changes.
function useScramble(text) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced()) {
      setOut(text);
      return undefined;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      setOut([...text].map((ch, i) => (ch === ' ' || i < frame - 6 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
      if (frame - 6 >= text.length) {
        clearInterval(id);
        setOut(text);
      }
    }, 28);
    return () => clearInterval(id);
  }, [text]);
  return out;
}

// ---- Isometric drawing -------------------------------------------------
// x runs down-right, y runs up-right (back), z is up.
const COS = 0.866;
const OX = 24;
const OY = 196;
const P = (x, y, z) => [OX + (x + y) * COS, OY + (x - y) * 0.5 - z];
const pt = (x, y, z) => P(x, y, z).map(n => n.toFixed(2)).join(' ');
const poly = pts => `M${pts.map(p => pt(...p)).join('L')}Z`;

const W = 150; // envelope width
const H = 98; // envelope height
const GAP = 30; // distance between envelopes
const SLAB = 5; // envelope thickness
const BASE = 6; // envelope bottom above the tray floor
const T = 34; // tray wall height
const R = 7; // corner radius

// Rounded rectangle in the x/z plane at depth y, as an isometric path.
function roundRect(y, w, h, r, z0 = 0) {
  const pts = [];
  const corner = (cx, cz, a0) => {
    for (let k = 0; k <= 5; k++) {
      const a = a0 + (k / 5) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
  };
  corner(w - r, z0 + h - r, 0);
  corner(r, z0 + h - r, Math.PI / 2);
  corner(r, z0 + r, Math.PI);
  corner(w - r, z0 + r, Math.PI * 1.5);
  return poly(pts);
}

function Envelope({ index, label, lifted, hidden, onHover, onPick }) {
  const y = index * GAP;
  const z = BASE;
  const fy = H * 0.4; // flap tip height
  const tip = [
    `M${pt(4, y, z + H - 3)}`,
    `L${pt(W / 2 - 16, y, z + fy + 11)}`,
    `Q${pt(W / 2, y, z + fy - 2)} ${pt(W / 2 + 16, y, z + fy + 11)}`,
    `L${pt(W - 4, y, z + H - 3)}`,
  ].join('');
  return (
    <g
      className={`env${lifted ? ' is-lifted' : ''}${hidden ? ' is-hidden' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerEnter={() => onHover(index)}
      onFocus={() => onHover(index)}
      onClick={() => onPick(index)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(index);
        }
      }}
    >
      <g className="env-lift">
        <path className="env-back" d={roundRect(y + SLAB, W, H, R, z)} />
        <path className="env-body" d={roundRect(y, W, H, R, z)} />
        <path className="env-pocket" d={`M${pt(2, y, z + 3)}L${pt(W / 2 - 6, y, z + fy + 6)}M${pt(W - 2, y, z + 3)}L${pt(W / 2 + 6, y, z + fy + 6)}`} />
        <path className="env-flap" d={`${tip}Z`} />
        <path className="env-lines" d={`M${pt(16, y, z + 36)}L${pt(70, y, z + 36)}M${pt(16, y, z + 27)}L${pt(58, y, z + 27)}`} />
      </g>
    </g>
  );
}

function Tray({ depth }) {
  const x0 = -10;
  const x1 = W + 10;
  const y0 = -12;
  const y1 = depth;
  const wall = (a, b, c, d) => poly([a, b, c, d]);
  return {
    back: (
      <g className="tray tray-back">
        <path d={wall([x0, y0, 0], [x0, y1, 0], [x0, y1, T], [x0, y0, T])} />
        <path d={wall([x0, y1, 0], [x1, y1, 0], [x1, y1, T], [x0, y1, T])} />
      </g>
    ),
    front: (
      <g className="tray tray-front">
        <path d={wall([x0, y0, 0], [x1, y0, 0], [x1, y0, T], [x0, y0, T])} />
        <path d={wall([x1, y0, 0], [x1, y1, 0], [x1, y1, T], [x1, y0, T])} />
        <path className="tray-rim" d={`M${pt(x0, y0, T)}L${pt(x1, y0, T)}L${pt(x1, y1, T)}`} />
        <path className="tray-slot" d={slotPath(y0)} />
      </g>
    ),
  };
}

function slotPath(y) {
  const pts = [];
  const r = 5.5;
  const cx0 = W / 2 - 27 + r;
  const cx1 = W / 2 + 27 - r;
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 + (k / 8) * Math.PI;
    pts.push([cx1 + Math.cos(a) * r, y, 17 + Math.sin(a) * r]);
  }
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 2 + (k / 8) * Math.PI;
    pts.push([cx0 + Math.cos(a) * r, y, 17 + Math.sin(a) * r]);
  }
  return poly(pts);
}

// Smoothstep-ish easings used by the open animation.
const bezier = (x1, y1, x2, y2) => {
  const bx = u => 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u ** 2 * x2 + u ** 3;
  const by = u => 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3;
  return x => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
};
const clamp01 = v => Math.max(0, Math.min(1, v));
const inOut = bezier(0.77, 0, 0.175, 1);
const L = v => inOut(clamp01(v));
const V = v => (1 - Math.cos(Math.PI * clamp01(v))) / 2;
const IDENT = [1, 0, 0, 1, 0, 0];
const FLAT = [1, 0, 0, 0.62, 0, 110];
const LIFT = 30;
const SVG_W = 280;

// `t` is the contact strings object (see src/i18n/strings.js). `wide` stretches the card
// for roomier pages, `theme` is 'dark' or 'light'. With `dialogOnly` only the letter dialog
// is rendered; open it from outside with ref.current.open(index, getOriginRect), and the
// letter then unfolds from (and folds back into) that rectangle.
const Contact = forwardRef(function Contact({ t, wide = false, theme = 'dark', dialogOnly = false }, ref) {
  const drafts = t.drafts;
  const [hover, setHover] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [picked, setPicked] = useState(0);
  const [forms, setForms] = useState(() => drafts.map(d => ({ subject: d.subject, body: d.body })));
  const [from, setFrom] = useState('');
  const [copied, setCopied] = useState(false);

  const svgRef = useRef(null);
  const sheetRef = useRef(null);
  const frontRef = useRef(null);
  const flapRef = useRef(null);
  const letterRef = useRef(null);
  const backdropRef = useRef(null);
  const closeRef = useRef(null);
  const returnFocus = useRef(null);
  const origin = useRef(null); // () => DOMRect of an external trigger, or null for the tray
  const state = useRef({ p: 0, iso: IDENT, raf: 0, target: 0, closing: false });

  const shown = mounted ? picked : hover;
  const caption = useScramble(drafts[shown].purpose);
  const tray = Tray({ depth: (drafts.length - 1) * GAP + SLAB + 12 });
  const instant = reduced();

  // Screen-space affine matrix that maps the full-size sheet onto envelope `i` in the tray.
  const isoMatrix = useCallback(i => {
    const svg = svgRef.current;
    const sheet = sheetRef.current;
    if (!sheet) return IDENT;
    const n = sheet.offsetWidth;
    const h = sheet.offsetHeight;
    if (origin.current) {
      const o = origin.current();
      return [o.width / n, 0, 0, o.height / h, o.left - (innerWidth - n) / 2, o.top - (innerHeight - h) / 2];
    }
    if (!svg) return IDENT;
    const r = svg.getBoundingClientRect();
    const k = r.width / SVG_W;
    const y = i * GAP;
    const at = (x, z) => {
      const [px, py] = P(x, y, z);
      return [r.left + px * k, r.top + (py - LIFT) * k];
    };
    const [l, o, b] = [at(0, BASE + H), at(W, BASE + H), at(0, BASE)];
    return [(o[0] - l[0]) / n, (o[1] - l[1]) / n, (b[0] - l[0]) / h, (b[1] - l[1]) / h, l[0] - (innerWidth - n) / 2, l[1] - (innerHeight - h) / 2];
  }, []);

  // Draw one frame of the open animation for progress p (0 = envelope in the tray, 1 = letter).
  const paint = useCallback(p => {
    const { iso } = state.current;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const tFold = L(p / 0.28);
    const tLand = L((p - 0.7) / 0.3);
    const m = iso.map((v, k) => (v + (FLAT[k] - v) * tFold) * (1 - tLand) + IDENT[k] * tLand);
    sheet.style.transform = `matrix(${m.join(',')})`;
    // Coming out of a button, the sheet starts in the button's colour.
    if (origin.current) sheet.style.setProperty('--sheet-fill', `color-mix(in srgb, var(--c-paper) ${Math.round(tFold * 100)}%, var(--c-btn-bg))`);
    const q = 180 * V((p - 0.3) / 0.28) + 180 * V((p - 0.58) / 0.34);
    const flap = flapRef.current;
    flap.style.transform = `perspective(1000px) rotateX(${-q}deg)`;
    flap.style.zIndex = q >= 270 ? -1 : 2;
    flap.style.visibility = q >= 270 ? 'hidden' : 'visible';
    frontRef.current.style.transform = `perspective(1000px) rotateX(${90 * V((p - 0.72) / 0.23)}deg)`;
    const letter = letterRef.current.style;
    const e = clamp01((p - 0.81) / 0.19);
    letter.opacity = e;
    letter.transform = `translateY(${18 * (1 - e)}px)`;
    letter.clipPath = `inset(${100 * (1 - L((p - 0.78) / 0.22))}% 0 0 0)`;
    backdropRef.current.style.opacity = clamp01(p * 4);
  }, []);

  const run = useCallback(
    target => {
      const st = state.current;
      cancelAnimationFrame(st.raf);
      st.target = target;
      const from = st.p;
      const dur = instant ? 0 : (target === 0 ? 850 : 1500) * Math.abs(target - from);
      const t0 = performance.now();
      const tick = now => {
        const u = dur === 0 ? 1 : Math.min(1, (now - t0) / dur);
        st.p = from + (target - from) * u;
        paint(st.p);
        if (u < 1) st.raf = requestAnimationFrame(tick);
        else if (target === 0) {
          st.closing = false;
          setMounted(false);
        }
      };
      st.raf = requestAnimationFrame(tick);
    },
    [instant, paint]
  );

  const open = (i, getOrigin = null) => {
    if (mounted) return;
    origin.current = getOrigin;
    returnFocus.current = document.activeElement;
    setHover(i);
    setPicked(i);
    setCopied(false);
    state.current.p = 0;
    setMounted(true);
  };

  // The sheet exists now: place it over the lifted envelope and play forward.
  useLayoutEffect(() => {
    if (!mounted || state.current.closing) return;
    state.current.iso = instant ? IDENT : isoMatrix(picked);
    paint(0);
    run(1);
    closeRef.current?.focus({ preventScroll: true });
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    const st = state.current;
    if (!mounted || st.closing) return;
    st.closing = true;
    st.iso = instant ? IDENT : isoMatrix(picked);
    setHover(picked);
    run(0);
    returnFocus.current?.focus?.({ preventScroll: true });
  }, [mounted, instant, isoMatrix, picked, run]);

  useImperativeHandle(ref, () => ({ open }));

  useEffect(() => () => cancelAnimationFrame(state.current.raf), []);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = e => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    setScrollLocked(true);
    return () => {
      window.removeEventListener('keydown', onKey);
      setScrollLocked(false);
    };
  }, [mounted, close]);

  const step = d => {
    setPicked(v => (v + d + drafts.length) % drafts.length);
    setCopied(false);
  };

  const form = forms[picked];
  const patch = obj => setForms(f => f.map((x, i) => (i === picked ? { ...x, ...obj } : x)));
  const fullBody = from.trim() ? `${form.body}\n\n${from.trim()}` : form.body;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(form.subject.replace(/[\r\n]+/g, ' '))}&body=${encodeURIComponent(fullBody)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${CONTACT_EMAIL}\nSubject: ${form.subject}\n\n${fullBody}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the draft is still selectable in the form.
    }
  };

  const onRackKey = e => {
    if (mounted || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const next = (hover + (e.key === 'ArrowRight' ? 1 : -1) + drafts.length) % drafts.length;
    setHover(next);
    e.currentTarget.querySelector(`[data-i="${next}"] .env`)?.focus();
  };

  const order = drafts.map((_, i) => i).reverse(); // paint the back envelope first

  return (
    <section className="contact" data-theme={theme} data-wide={wide || undefined} aria-labelledby={dialogOnly ? undefined : 'contact-title'} style={dialogOnly ? { display: 'contents' } : undefined}>
      {!dialogOnly && <div className="contact-wrap">
        <PixelCard className="contact-tile" colors={theme === 'light' ? '#e4e3ee,#c9c6f2,#9b95ea' : undefined}>
          <div className="contact-play">
            <h2 id="contact-title" className="contact-title">
              {t.title}
            </h2>
            <svg ref={svgRef} className="contact-rack" viewBox={`0 0 ${SVG_W} 290`} onKeyDown={onRackKey}>
              {tray.back}
              {order.map(i => (
                <g key={i} data-i={i}>
                  <Envelope
                    index={i}
                    label={drafts[i].purpose}
                    lifted={hover === i}
                    hidden={mounted && picked === i}
                    onHover={v => !mounted && setHover(v)}
                    onPick={open}
                  />
                </g>
              ))}
              {tray.front}
            </svg>
            <div className="contact-caption" aria-live="polite">
              <span className="contact-purpose">
                <span className="contact-measure">{drafts[shown].purpose}</span>
                <span className="contact-paint" aria-hidden="true">
                  {caption}
                </span>
              </span>
            </div>
            <p className="contact-hint">{t.hint}</p>
          </div>
          <div className="contact-info">
            <h3 className="contact-info-title">{t.infoTitle}</h3>
            <p className="lede contact-info-text">{t.info}</p>
            <FlyButton className="contact-btn" href={`mailto:${CONTACT_EMAIL}`} icon={<ArrowRight />}>
              {t.button}
            </FlyButton>
            <p className="contact-email">{CONTACT_EMAIL}</p>
          </div>
        </PixelCard>
      </div>}

      {mounted && (
        <>
          <div ref={backdropRef} className="mail-backdrop" onClick={close} />
          <div className="mail-popup" role="dialog" aria-modal="true" aria-labelledby="mail-title" data-lenis-prevent>
            <div ref={sheetRef} className="mail-sheet">
              <div className="mail-paper" aria-hidden="true" />
              <div ref={frontRef} className="mail-front" aria-hidden="true">
                <svg viewBox="0 0 600 400" preserveAspectRatio="none">
                  <path d="M2 398 L285 184 Q300 173 315 184 L598 398" />
                </svg>
              </div>
              <svg ref={flapRef} className="mail-flap" viewBox="0 0 600 230" preserveAspectRatio="none" aria-hidden="true">
                <path d="M1 1 H599 L315 215 Q300 228 285 215 Z" />
              </svg>
              <div ref={letterRef} className="mail-letter">
                <header className="mail-top">
                  <div className="mail-nav">
                    <button type="button" aria-label={t.prev} onClick={() => step(-1)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                    </button>
                    <span>
                      {pad(picked)} <i>/ {pad(drafts.length - 1)}</i>
                    </span>
                    <button type="button" aria-label={t.next} onClick={() => step(1)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                  <button ref={closeRef} type="button" className="mail-close" aria-label={t.close} onClick={close}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
                  </button>
                </header>
                <div className="mail-heading">
                  <h3 id="mail-title">{drafts[picked].purpose}</h3>
                  <p>{t.sub}</p>
                </div>
                <div className="mail-fields">
                  <label>
                    <span>{t.to}</span>
                    <input value={CONTACT_EMAIL} readOnly aria-label={t.to} />
                  </label>
                  <label>
                    <span>{t.from}</span>
                    <input value={from} placeholder={t.fromPlaceholder} onChange={e => setFrom(e.target.value)} aria-label={t.from} maxLength={160} />
                  </label>
                  <label>
                    <span>{t.subject}</span>
                    <input value={form.subject} onChange={e => patch({ subject: e.target.value })} aria-label={t.subject} maxLength={160} />
                  </label>
                </div>
                <div className="mail-message">
                  <textarea aria-label={t.message} value={form.body} onChange={e => patch({ body: e.target.value })} maxLength={2500} />
                  {from.trim() && <p className="mail-signature">{from.trim()}</p>}
                </div>
                <footer className="mail-foot">
                  <p>{t.note}</p>
                  <div>
                    <button type="button" className="mail-copy" onClick={copy} aria-label={copied ? t.copied : t.copy} title={copied ? t.copied : t.copy}>
                      {copied ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3" /></svg>
                      )}
                    </button>
                    <FlyButton
                      className="contact-btn small"
                      href={mailto}
                      dir="up-right"
                      icon={<svg viewBox="0 0 24 24"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></svg>}
                    >
                      {t.send}
                    </FlyButton>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
});

export default Contact;
