import { useEffect, useState } from 'react';
import { GITHUB_URL } from '../data/projects';
import { GitHubIcon } from './Icons';

export default function Nav({ current }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="nav" data-scrolled={scrolled}>
      <nav className="container nav-inner" aria-label="Main">
        <a className="nav-logo" href="/">
          <img src="/favicon.svg" alt="" />
          Malte
        </a>
        <div className="nav-links">
          <a className="nav-hide-sm" href="/#work">
            Work
          </a>
          <a href="/projects/" aria-current={current === 'projects' ? 'page' : undefined}>
            Projects
          </a>
          <a href="/games/">Games</a>
          <a href={GITHUB_URL} aria-label="GitHub">
            <GitHubIcon />
          </a>
        </div>
      </nav>
    </header>
  );
}
