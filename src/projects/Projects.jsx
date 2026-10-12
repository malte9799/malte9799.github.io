import { useMemo } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import ScrollRuler from '../components/ScrollRuler';
import BrowserFrame from '../components/BrowserFrame';
import { CarouselArrows, CarouselDots, resolveSlides, useCarousel } from '../components/Carousel';
import BlurText from '../components/reactbits/BlurText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { ArrowUpRight, StarIcon } from '../components/Icons';
import { EXTRAS, FEATURED, GITHUB_URL } from '../data/projects';
import { useLenis } from '../lib/useLenis';
import { localize, useLang, useT } from '../i18n';
import { useRepos } from './useRepos';

const EASE = [0.22, 1, 0.36, 1];

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Java: '#b07219',
  Kotlin: '#a97bff',
  HTML: '#e34c26',
  CSS: '#8e6bd8',
  Shell: '#89e051',
  'C#': '#2bb24c',
  'C++': '#f34b7d',
  Go: '#00add8',
  Rust: '#dea584',
  Swift: '#f05138',
  Vue: '#41b883',
  Lua: '#6b7bff',
  mcfunction: '#e2a54a',
};

const timeAgo = (iso, lang, justNow) => {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return justNow;
};

// Screenshot(s) that tilt toward the pointer; several become a carousel.
function TiltFrame({ project: raw, label }) {
  const lang = useLang();
  const t = useT();
  const slides = resolveSlides(raw, lang);
  const carousel = useCarousel(slides.length);
  const slide = slides[carousel.index];
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], reduced ? [0, 0] : [7, -7]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], reduced ? [0, 0] : [-9, 9]), spring);

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div ref={carousel.ref} className="carousel" {...carousel.bind}>
      <a
        href={slide.url}
        className="tilt"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        aria-label={slides.length > 1 ? `${label}: ${slide.label}` : label}
      >
        <motion.div className="tilt-inner" style={{ rotateX, rotateY }} whileHover={{ scale: 1.02 }} transition={{ duration: 0.4, ease: EASE }}>
          <BrowserFrame url={slide.urlLabel} slides={slides} index={carousel.index} eager />
        </motion.div>
      </a>
      {slides.length > 1 && (
        <CarouselArrows onPrev={carousel.prev} onNext={carousel.next} labels={{ prev: t.work.prevSlide, next: t.work.nextSlide }} />
      )}
      {slides.length > 1 && (
        <CarouselDots
          slides={slides}
          index={carousel.index}
          onSelect={carousel.select}
          onDone={carousel.next}
          playing={carousel.playing}
          label={t.work.screenshots}
          overlay
        />
      )}
    </div>
  );
}

function FeaturedCard({ project: raw, index, wide }) {
  const lang = useLang();
  const t = useT();
  const project = localize(raw, lang);
  const [a, b] = project.accent;
  return (
    <motion.article
      className={`feature${wide ? ' feature-lead' : ''}`}
      style={{ '--a': a, '--b': b }}
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.9, delay: index * 0.1, ease: EASE }}
      aria-labelledby={`f-${project.id}`}
    >
      <SpotlightCard className="feature-card" spotlightColor={a} intensity={0.16} spotlightSize={420} borderGlow={0.7}>
        <div className="feature-media">
          <TiltFrame project={raw} label={`${t.projects.open}: ${project.name}`} />
        </div>
        <div className="feature-body">
          <p className="feature-eyebrow">{project.eyebrow}</p>
          <h2 id={`f-${project.id}`} className="feature-name">
            {project.name}
          </h2>
          <p className="feature-desc">{project.description}</p>
          <ul className="feature-tags" aria-label={t.builtWith}>
            {project.tags.map(tag => (
              <li key={tag} className="chip">
                {tag}
              </li>
            ))}
          </ul>
          <div className="feature-links">
            <a className="btn btn-primary" href={project.url}>
              {t.projects.open}
              <ArrowUpRight />
            </a>
            <a className="text-link" href={project.repo}>
              {t.projects.viewSource}
              <ArrowUpRight style={{ width: 12, height: 12 }} />
            </a>
          </div>
        </div>
      </SpotlightCard>
    </motion.article>
  );
}

function ExtraCard({ project, index }) {
  const lang = useLang();
  const strings = useT();
  const t = strings.projects;
  const p = localize(project, lang);

  return (
    <motion.article
      className="extra"
      style={{ '--a': p.accent[0] }}
      aria-labelledby={`x-${p.id}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.8, delay: index * 0.06, ease: EASE }}
    >
      <SpotlightCard className="extra-card" spotlightColor={p.accent[0]} intensity={0.14} spotlightSize={320} borderGlow={0.6}>
        <p className="extra-eyebrow">{p.eyebrow}</p>
        <h2 id={`x-${p.id}`} className="extra-name">{p.name}</h2>
        <p className="extra-desc">{p.description}</p>
        <ul className="feature-tags" aria-label={strings.builtWith}>
          {p.tags.map(tag => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
        <div className="extra-links">
          <a className="text-link" href={p.url}>
            {t.open}
            <ArrowUpRight style={{ width: 12, height: 12 }} />
          </a>
          <a className="text-link" href={p.repo}>
            {t.viewSource}
            <ArrowUpRight style={{ width: 12, height: 12 }} />
          </a>
        </div>
      </SpotlightCard>
    </motion.article>
  );
}

function RepoList() {
  const lang = useLang();
  const t = useT().projects;
  const { status, repos } = useRepos();

  if (status === 'error') {
    return (
      <p className="repos-error">
        {t.error}{' '}
        <a className="text-link" href={`${GITHUB_URL}?tab=repositories`}>
          {t.browse}
          <ArrowUpRight style={{ width: 12, height: 12 }} />
        </a>
      </p>
    );
  }

  if (status === 'loading') {
    return (
      <ul className="repos" aria-busy="true" aria-label={t.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="repo repo-skeleton">
            <span />
            <span />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="repos">
      {repos.map((repo, i) => (
        <motion.li
          key={repo.name}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5% 0px' }}
          transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.04, ease: EASE }}
        >
          <a className="repo" href={repo.homepage || repo.url}>
            <div className="repo-main">
              <span className="repo-name">{repo.name}</span>
              <span className="repo-desc">{repo.description || t.noDescription}</span>
            </div>
            <div className="repo-meta">
              {repo.language && (
                <span className="repo-lang">
                  <i style={{ background: LANGUAGE_COLORS[repo.language] ?? '#8e8e93' }} />
                  {repo.language}
                </span>
              )}
              {repo.stars > 0 && (
                <span className="repo-stars">
                  <StarIcon />
                  {repo.stars}
                </span>
              )}
              <span className="repo-time">{timeAgo(repo.pushedAt, lang, t.justNow)}</span>
              <ArrowUpRight className="repo-arrow" />
            </div>
          </a>
        </motion.li>
      ))}
    </ul>
  );
}

export default function Projects() {
  const strings = useT();
  const t = strings.projects;
  useLenis();
  const rulerSections = useMemo(
    () => ['.features', '.more'].map((selector, i) => ({ selector, label: strings.ruler.projects[i] })),
    [strings]
  );

  return (
    <>
      <Nav page="/projects/" />
      <ScrollRuler sections={rulerSections} />
      <main>
        <header className="projects-hero container">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            {t.eyebrow}
          </motion.p>
          <BlurText as="h1" text={t.title} className="headline projects-title" delay={120} direction="bottom" />
          <motion.p
            className="lede projects-lede"
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, delay: 0.45, ease: EASE }}
          >
            {t.lede}
          </motion.p>
        </header>

        <section className="container features" aria-label={t.featured}>
          {FEATURED.map((project, i) => (
            <FeaturedCard
              key={project.id}
              project={project}
              index={i}
              // First card spans the row; so does the last one if it would sit alone.
              wide={i === 0 || (i === FEATURED.length - 1 && i % 2 === 1)}
            />
          ))}
          {EXTRAS.map((project, i) => (
            <ExtraCard key={project.id} project={project} index={i} />
          ))}
        </section>

        <section className="container more" aria-labelledby="more-title">
          <div className="more-head">
            <motion.h2
              id="more-title"
              className="title"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              {t.more}
            </motion.h2>
            <a className="text-link" href={`${GITHUB_URL}?tab=repositories`}>
              {t.allRepos}
              <ArrowUpRight style={{ width: 12, height: 12 }} />
            </a>
          </div>
          <RepoList />
        </section>
      </main>
      <Footer />
    </>
  );
}
