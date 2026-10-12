import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import BlurText from '../components/reactbits/BlurText';
import ErrorBoundary from '../components/ErrorBoundary';

const HeroScene = lazy(() => import('./HeroScene'));

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

// One line of the scroll-driven sequence: fades/blurs in over [a, b], out over [c, d].
function Phrase({ progress, range: [a, b, c, d], children }) {
  const hold = d === undefined;
  const opacity = useTransform(progress, hold ? [a, b] : [a, b, c, d], hold ? [0, 1] : [0, 1, 1, 0]);
  const y = useTransform(progress, hold ? [a, b] : [a, b, c, d], hold ? [40, 0] : [40, 0, 0, -40]);
  const blur = useTransform(progress, hold ? [a, b] : [a, b, c, d], hold ? [12, 0] : [12, 0, 0, 12]);
  const filter = useTransform(blur, v => `blur(${v}px)`);
  return (
    <motion.p className="hero-phrase" style={{ opacity, y, filter }}>
      {children}
    </motion.p>
  );
}

function Fallback() {
  return (
    <div className="hero-fallback" aria-hidden="true">
      <div className="hero-fallback-orb" />
      <span>Malte</span>
    </div>
  );
}

export default function Hero() {
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(true);
  const [webgl] = useState(hasWebGL);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const introOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.1], [0, -30]);
  const vignette = useTransform(scrollYProgress, [0.15, 0.35], [0, 0.6]);
  const canvasOpacity = useTransform(scrollYProgress, [0.86, 1], [1, 0.15]);

  // Stop rendering the WebGL scene once the hero is scrolled past.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="hero" aria-labelledby="hero-title">
      <div className="hero-sticky">
        <motion.div className="hero-canvas" style={{ opacity: canvasOpacity }}>
          {webgl ? (
            <ErrorBoundary fallback={<Fallback />}>
              <Suspense fallback={null}>
                <HeroScene progress={scrollYProgress} active={active} reduced={!!reduced} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Fallback />
          )}
        </motion.div>

        <motion.div className="hero-vignette" style={{ opacity: vignette }} aria-hidden="true" />

        <h1 id="hero-title" className="sr-only">
          Malte builds software that feels native and runs in a browser tab.
        </h1>

        <motion.div className="hero-intro" style={{ opacity: introOpacity, y: introY }}>
          <BlurText
            as="p"
            text="Software that feels native. Runs in a tab."
            className="hero-tagline"
            delay={90}
            animateBy="words"
            direction="bottom"
            stepDuration={0.4}
          />
          <div className="hero-scroll" aria-hidden="true">
            <span />
          </div>
        </motion.div>

        <div className="hero-phrases">
          <Phrase progress={scrollYProgress} range={[0.24, 0.32, 0.4, 0.48]}>
            No installs.
          </Phrase>
          <Phrase progress={scrollYProgress} range={[0.48, 0.56, 0.64, 0.72]}>
            No servers.
          </Phrase>
          <Phrase progress={scrollYProgress} range={[0.72, 0.82]}>
            <span className="gradient-text" style={{ '--a': '#7dd3fc', '--b': '#f0abfc' }}>
              Just a link.
            </span>
          </Phrase>
        </div>
      </div>
    </section>
  );
}
