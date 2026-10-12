import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import BrowserFrame from '../components/BrowserFrame';
import { CarouselDots, resolveSlides, useCarousel } from '../components/Carousel';
import { ArrowUpRight } from '../components/Icons';
import { FEATURED } from '../data/projects';
import { localize, useLang, useT } from '../i18n';

const reveal = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)' },
  show: i => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Showcase({ project: raw, index }) {
  const lang = useLang();
  const t = useT();
  const project = localize(raw, lang);
  const slides = resolveSlides(raw, lang);
  const carousel = useCarousel(slides.length);
  const slide = slides[carousel.index];
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [a, b] = project.accent;

  // The screenshot tilts up from the table and grows into place as it scrolls in.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [32, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.82, 1]);
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [80, 0]);
  const glow = useTransform(scrollYProgress, [0.4, 1], [0, 1]);

  const lines = project.tagline.split('\n');

  return (
    <article className="showcase" style={{ '--a': a, '--b': b }} aria-labelledby={`${project.id}-title`}>
      <div className="container">
        <motion.div className="showcase-copy" initial="hidden" whileInView="show" viewport={{ once: true, margin: '-15% 0px' }}>
          <motion.p className="eyebrow showcase-eyebrow" variants={reveal} custom={0}>
            <span className="showcase-index">{String(index + 1).padStart(2, '0')}</span>
            {project.name} · {project.eyebrow}
          </motion.p>
          <motion.h3 id={`${project.id}-title`} className="headline" variants={reveal} custom={1}>
            {lines.map((line, i) => (
              <span key={line} className={i === lines.length - 1 ? 'gradient-text' : undefined}>
                {line}
                {i < lines.length - 1 && <br />}
              </span>
            ))}
          </motion.h3>
          <motion.p className="lede showcase-desc" variants={reveal} custom={2}>
            {project.description}
          </motion.p>
          <motion.div className="showcase-actions" variants={reveal} custom={3}>
            <a className="btn btn-primary" href={project.url}>
              {t.work.open(project.name)}
              <ArrowUpRight />
            </a>
            <a className="btn btn-ghost" href={project.repo}>
              {t.work.source}
              <ArrowUpRight />
            </a>
          </motion.div>
        </motion.div>
      </div>

      <div ref={ref} className="showcase-stage">
        <motion.div className="showcase-glow" style={{ opacity: glow }} aria-hidden="true" />
        <div ref={carousel.ref} className="carousel" {...carousel.bind}>
          <motion.a
            href={slide.url}
            className="showcase-device"
            style={{ rotateX, scale, y }}
            aria-label={slides.length > 1 ? `${t.work.open(project.name)}: ${slide.label}` : t.work.open(project.name)}
          >
            <BrowserFrame url={slide.urlLabel} slides={slides} index={carousel.index} />
          </motion.a>
          {slides.length > 1 && (
            <CarouselDots
              slides={slides}
              index={carousel.index}
              onSelect={carousel.select}
              onDone={carousel.next}
              playing={carousel.playing}
              label={t.work.screenshots}
            />
          )}
        </div>
        <ul className="showcase-tags" aria-label={t.builtWith}>
          {project.tags.map(tag => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function Work() {
  const t = useT();
  return (
    <section id="work" className="work" aria-label={t.work.label}>
      {FEATURED.map((project, i) => (
        <Showcase key={project.id} project={project} index={i} />
      ))}
    </section>
  );
}
