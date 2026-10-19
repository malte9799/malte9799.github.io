import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setScrollLockHandler } from './scrollLock';

gsap.registerPlugin(ScrollTrigger);

let current = null;

// Scroll the page, smoothly through Lenis when it runs.
export function scrollToY(top, { immediate = false } = {}) {
  if (current) current.scrollTo(top, { immediate, force: true });
  else window.scrollTo({ top, behavior: immediate ? 'instant' : 'smooth' });
}

// Smooth, inertial scrolling. Lenis drives the native window scroll, so
// Motion's useScroll and GSAP ScrollTrigger keep working; we just run Lenis
// on GSAP's ticker so both stay in lockstep. Skipped for reduced motion.
export function useLenis() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -52 } });
    current = lenis;
    setScrollLockHandler(locked => (locked ? lenis.stop() : lenis.start()));
    lenis.on('scroll', ScrollTrigger.update);
    const tick = time => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      setScrollLockHandler(null);
      lenis.destroy();
      if (current === lenis) current = null;
    };
  }, []);
}
