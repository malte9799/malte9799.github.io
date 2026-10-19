import { NotFound } from './Product';
import { useLang } from './i18n';

export function About() {
  const { t } = useLang();
  return (
    <section className="page narrow">
      <h1>{t('about.title')}</h1>
      <p className="lead">{t('about.lead')}</p>
      <p>{t('about.p1')}</p>
      <p className="muted small">{t('about.demo')}</p>
    </section>
  );
}

const PAGES = ['shipping', 'returns', 'care', 'contact', 'legal', 'privacy', 'terms'];

export function Info({ page }) {
  const { t } = useLang();
  if (!PAGES.includes(page)) return <NotFound />;
  return (
    <section className="page narrow">
      <h1>{t('info.' + page)}</h1>
      <p>{t('info.' + page + 'Text')}</p>
    </section>
  );
}
