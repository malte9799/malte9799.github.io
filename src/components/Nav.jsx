import { useEffect, useState } from 'react';
import { GITHUB_URL } from '../data/projects';
import { localePath, rememberLang, useLang, useT } from '../i18n';
import { GitHubIcon } from './Icons';

// `page` is the language-neutral path of the current page, e.g. '/' or '/projects/'.
export default function Nav({ page = '/' }) {
  const lang = useLang();
  const t = useT().nav;
  const other = lang === 'en' ? 'de' : 'en';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="nav" data-scrolled={scrolled}>
      <nav className="container nav-inner" aria-label={t.main}>
        <a className="nav-logo" href={localePath(lang, '/')}>
          <img src="/favicon.svg" alt="" />
          Malte
        </a>
        <div className="nav-links">
          <a className="nav-hide-sm" href={`${localePath(lang, '/')}#work`}>
            {t.work}
          </a>
          <a href={localePath(lang, '/projects/')} aria-current={page === '/projects/' ? 'page' : undefined}>
            {t.projects}
          </a>
          <a href="/games/">{t.games}</a>
          <a
            className="nav-lang"
            href={localePath(other, page)}
            hrefLang={other}
            lang={other}
            aria-label={t.switchLabel}
            title={t.switchLabel}
            onClick={() => rememberLang(other)}
          >
            {other.toUpperCase()}
          </a>
          <a href={GITHUB_URL} aria-label="GitHub">
            <GitHubIcon />
          </a>
        </div>
      </nav>
    </header>
  );
}
