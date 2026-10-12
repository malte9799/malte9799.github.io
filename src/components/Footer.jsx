import { GITHUB_URL } from '../data/projects';
import { localePath, useLang, useT, withBase } from '../i18n';

export default function Footer() {
  const lang = useLang();
  const t = useT();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p>
          © {new Date().getFullYear()} Malte. {t.footer.credit} <a href="https://reactbits.dev">React Bits</a>.
        </p>
        <div className="footer-links">
          <a href={localePath(lang, '/projects/')}>{t.nav.projects}</a>
          <a href={withBase('/games/')}>{t.nav.games}</a>
          <a href={GITHUB_URL}>GitHub</a>
        </div>
      </div>
    </footer>
  );
}
