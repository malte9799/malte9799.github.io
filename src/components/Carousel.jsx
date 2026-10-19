import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { pick } from '../i18n';
import { ArrowRight } from './Icons';

const SLIDE_SECONDS = 5;

// A project's screenshots in the given language, with each slide's link and
// address-bar label falling back to the project's own.
export const resolveSlides = (project, lang) =>
  project.screenshots.map(shot => ({
    src: shot.src,
    poster: shot.poster,
    alt: pick(shot.alt, lang),
    label: pick(shot.label, lang) ?? pick(project.name, lang),
    url: shot.url ?? project.url,
    urlLabel: shot.urlLabel ?? project.urlLabel,
  }));

// Slide state for a screenshot carousel. Auto-advance runs only while the
// carousel is on screen and not hovered; the active dot's fill animation is
// the timer (see CarouselDots), so pausing is just pausing that animation.
export function useCarousel(count) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [hovered, setHovered] = useState(false);
  const [index, setIndex] = useState(0);
  const swipe = useRef(null);

  const step = dir => setIndex(i => (i + dir + count) % count);
  const stepRef = useRef(step);
  stepRef.current = step;

  // Horizontal wheel / trackpad scrolling flips slides. React's onWheel is passive,
  // so this is attached natively to be able to stop the page from also panning.
  useEffect(() => {
    const el = ref.current;
    if (!el || count < 2) return undefined;
    let locked = false;
    const onWheel = e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      if (locked) return;
      locked = true;
      stepRef.current(e.deltaX > 0 ? 1 : -1);
      // One flick fires many events; wait for the inertia to die down.
      setTimeout(() => (locked = false), 600);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, count]);

  return {
    ref,
    index,
    select: setIndex,
    next: () => step(1),
    prev: () => step(-1),
    playing: inView && !hovered,
    bind: {
      onPointerEnter: e => e.pointerType === 'mouse' && setHovered(true),
      onPointerLeave: () => setHovered(false),
      // Horizontal swipe on touch screens.
      onPointerDown: e => {
        if (e.pointerType !== 'mouse') swipe.current = e.clientX;
      },
      onPointerUp: e => {
        if (swipe.current === null) return;
        const dx = e.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      },
    },
  };
}

// Apple-style pagination: dots, the active one stretched into a pill that
// fills up over the slide's duration and advances when full.
// `overlay` lays the pill over the screenshot's bottom edge and drops the caption.
// `duration` (seconds) overrides the slide length, e.g. for a video slide.
export function CarouselDots({ slides, index, onSelect, onDone, playing, label, overlay = false, duration = SLIDE_SECONDS }) {
  const reduced = useReducedMotion();

  return (
    <div className={`carousel-nav${overlay ? ' is-overlay' : ''}`}>
      <div className="carousel-dots" role="group" aria-label={label}>
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            className="carousel-dot"
            aria-label={slide.label}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            {i === index && !reduced && (
              <span
                key={index}
                className="carousel-dot-fill"
                style={{ animationDuration: `${duration}s`, animationPlayState: playing ? 'running' : 'paused' }}
                onAnimationEnd={onDone}
              />
            )}
          </button>
        ))}
      </div>
      {!overlay && (
        <p className="carousel-caption" aria-live="polite">
          {slides[index].label}
        </p>
      )}
    </div>
  );
}

// Previous / next buttons, laid over the left and right edges of the screenshot.
export function CarouselArrows({ onPrev, onNext, labels, below = false }) {
  return (
    <>
      <button type="button" className={`carousel-arrow is-prev${below ? ' is-above-nav' : ''}`} aria-label={labels.prev} onClick={onPrev}>
        <ArrowRight />
      </button>
      <button type="button" className={`carousel-arrow is-next${below ? ' is-above-nav' : ''}`} aria-label={labels.next} onClick={onNext}>
        <ArrowRight />
      </button>
    </>
  );
}
