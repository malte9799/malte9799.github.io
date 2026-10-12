import { motion } from 'motion/react';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import ScrollVelocity from '../components/reactbits/ScrollVelocity';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import CountUp from '../components/reactbits/CountUp';
import ShinyText from '../components/reactbits/ShinyText';
import Magnet from '../components/reactbits/Magnet';
import { ArrowRight, GitHubIcon } from '../components/Icons';
import { GITHUB_URL } from '../data/projects';
import { localePath, useLang, useT } from '../i18n';

export function Statement() {
  const t = useT().statement;
  return (
    <section className="statement" aria-label={t.label}>
      <div className="container">
        <ScrollReveal
          baseOpacity={0.12}
          enableBlur
          baseRotation={2}
          blurStrength={6}
          textClassName="statement-text"
          wordAnimationEnd="center center"
          rotationEnd="center center"
        >
          {t.text}
        </ScrollReveal>
      </div>
    </section>
  );
}

// `label` is a key into the numbers strings.
const STATS = [
  { to: 33, label: 'effects', span: 'wide', accent: '#4f8cff' },
  { to: 20, label: 'blendModes', accent: '#36d1ff' },
  { to: 16, suffix: '×', label: 'fastForward', accent: '#ffb547' },
  { to: 11, label: 'games', span: 'wide', accent: '#b4f461' },
  // CountUp's "down" runs from `to` back to `from`, so this lands on 0.
  { to: 100, direction: 'down', label: 'servers', span: 'full', accent: '#f0abfc' },
];

const cardReveal = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  show: i => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};

export function Numbers() {
  const t = useT().numbers;
  return (
    <section className="numbers" aria-labelledby="numbers-title">
      <div className="container">
        <motion.h2
          id="numbers-title"
          className="title numbers-title"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {t.title}
        </motion.h2>
        <div className="bento">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className={`bento-cell${stat.span ? ` bento-${stat.span}` : ''}`}
              variants={cardReveal}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-10% 0px' }}
            >
              <SpotlightCard className="bento-card" spotlightColor={stat.accent} intensity={0.22} spotlightSize={320}>
                <p className="bento-value" style={{ '--accent': stat.accent }}>
                  <CountUp from={stat.from ?? 0} to={stat.to} direction={stat.direction} duration={1.6} />
                  {stat.suffix}
                </p>
                <p className="bento-label">{t[stat.label]}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const t = useT();
  return (
    <section className="marquee" aria-hidden="true">
      <ScrollVelocity
        texts={t.marquee}
        velocity={40}
        numCopies={4}
        className="marquee-text"
      />
    </section>
  );
}

export function Outro() {
  const lang = useLang();
  const t = useT().outro;
  return (
    <section className="outro" aria-labelledby="outro-title">
      <div className="container outro-inner">
        <motion.h2
          id="outro-title"
          className="headline"
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <ShinyText color="#a1a1a6" shineColor="#ffffff" speed={3} delay={1.2}>
            {t.title}
          </ShinyText>
        </motion.h2>
        <p className="lede outro-lede">{t.lede}</p>
        <div className="outro-actions">
          <Magnet padding={60} magnetStrength={4}>
            <a className="btn btn-primary btn-arrow" href={localePath(lang, '/projects/')}>
              {t.allProjects}
              <ArrowRight />
            </a>
          </Magnet>
          <Magnet padding={60} magnetStrength={4}>
            <a className="btn btn-ghost" href={GITHUB_URL}>
              <GitHubIcon style={{ width: 18, height: 18 }} />
              GitHub
            </a>
          </Magnet>
        </div>
      </div>
    </section>
  );
}
