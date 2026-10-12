import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import BrowserFrame from '../components/BrowserFrame';
import BlurText from '../components/reactbits/BlurText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { ArrowUpRight, StarIcon } from '../components/Icons';
import { FEATURED, GITHUB_URL } from '../data/projects';
import { useLenis } from '../lib/useLenis';
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

const timeAgo = iso => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
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
  return 'just now';
};

// Screenshot that tilts toward the pointer.
function TiltFrame({ project }) {
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
    <a
      href={project.url}
      className="tilt"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={`Open ${project.name}`}
    >
      <motion.div className="tilt-inner" style={{ rotateX, rotateY }} whileHover={{ scale: 1.02 }} transition={{ duration: 0.4, ease: EASE }}>
        <BrowserFrame url={project.urlLabel} src={project.image} alt={project.imageAlt} eager />
      </motion.div>
    </a>
  );
}

function FeaturedCard({ project, index }) {
  const [a, b] = project.accent;
  return (
    <motion.article
      className={`feature${index === 0 ? ' feature-lead' : ''}`}
      style={{ '--a': a, '--b': b }}
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.9, delay: index * 0.1, ease: EASE }}
      aria-labelledby={`f-${project.id}`}
    >
      <SpotlightCard className="feature-card" spotlightColor={a} intensity={0.16} spotlightSize={420} borderGlow={0.7}>
        <div className="feature-media">
          <TiltFrame project={project} />
        </div>
        <div className="feature-body">
          <p className="feature-eyebrow">{project.eyebrow}</p>
          <h2 id={`f-${project.id}`} className="feature-name">
            {project.name}
          </h2>
          <p className="feature-desc">{project.description}</p>
          <ul className="feature-tags" aria-label="Built with">
            {project.tags.map(tag => (
              <li key={tag} className="chip">
                {tag}
              </li>
            ))}
          </ul>
          <div className="feature-links">
            <a className="btn btn-primary" href={project.url}>
              Open
              <ArrowUpRight />
            </a>
            <a className="text-link" href={project.repo}>
              View source
              <ArrowUpRight style={{ width: 12, height: 12 }} />
            </a>
          </div>
        </div>
      </SpotlightCard>
    </motion.article>
  );
}

function RepoList() {
  const { status, repos } = useRepos();

  if (status === 'error') {
    return (
      <p className="repos-error">
        Couldn’t reach GitHub just now.{' '}
        <a className="text-link" href={`${GITHUB_URL}?tab=repositories`}>
          Browse the repositories on GitHub
          <ArrowUpRight style={{ width: 12, height: 12 }} />
        </a>
      </p>
    );
  }

  if (status === 'loading') {
    return (
      <ul className="repos" aria-busy="true" aria-label="Loading repositories">
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
              <span className="repo-desc">{repo.description || 'No description yet.'}</span>
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
              <span className="repo-time">{timeAgo(repo.pushedAt)}</span>
              <ArrowUpRight className="repo-arrow" />
            </div>
          </a>
        </motion.li>
      ))}
    </ul>
  );
}

export default function Projects() {
  useLenis();

  return (
    <>
      <Nav current="projects" />
      <main>
        <header className="projects-hero container">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            Projects
          </motion.p>
          <BlurText as="h1" text="Things I’ve built." className="headline projects-title" delay={120} direction="bottom" />
          <motion.p
            className="lede projects-lede"
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, delay: 0.45, ease: EASE }}
          >
            Mostly for the browser, mostly because I wanted to use them. Each one opens in a tab.
          </motion.p>
        </header>

        <section className="container features" aria-label="Featured projects">
          {FEATURED.map((project, i) => (
            <FeaturedCard key={project.id} project={project} index={i} />
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
              More on GitHub.
            </motion.h2>
            <a className="text-link" href={`${GITHUB_URL}?tab=repositories`}>
              All repositories
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
