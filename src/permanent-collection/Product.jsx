import { useState } from 'react';
import { bySlug, PRODUCTS } from './items';
import { useLang } from './i18n';
import { FREE_SHIPPING_FROM, useCart } from './store';

const FINISHES = ['Natural', 'Charcoal', 'Chalk'];
const REVIEWS = [['Anna K.', 5], ['Jonas M.', 4], ['Leah S.', 5]];

export default function Product({ slug }) {
  const p = bySlug(slug);
  const { add } = useCart();
  const { t, lang, money } = useLang();
  const [finish, setFinish] = useState(FINISHES[0]);
  if (!p) return <NotFound />;
  const related = PRODUCTS.filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4);
  return (
    <section className="page product">
      <nav className="crumbs muted small">
        <a href="#/shop">{t('nav.shop')}</a> / <a href={`#/shop?cat=${p.category}`}>{t('cat.' + p.category)}</a> / {p.name}
      </nav>
      <div className="product-grid">
        <div className="product-img"><img src={p.src} alt={p.name} /></div>
        <div className="product-info">
          <p className="muted small">{t('cat1.' + p.category)}</p>
          <h1>{p.name}</h1>
          <p className="price">{money(p.price)}</p>
          <p>{t('desc.' + p.category)}</p>
          <fieldset>
            <legend className="small muted">{t('product.finish')}: {t('finish.' + finish)}</legend>
            <div className="chips">
              {FINISHES.map(f => (
                <button key={f} className={f === finish ? 'on' : ''} onClick={() => setFinish(f)}>{t('finish.' + f)}</button>
              ))}
            </div>
          </fieldset>
          <button className="btn wide" onClick={() => add(p.slug, finish)}>{t('product.add')}</button>
          <ul className="perks small">
            <li>{t('perk.ship', { amount: money(FREE_SHIPPING_FROM) })}</li>
            <li>{t('perk.delivery')}</li>
            <li>{t('perk.returns')}</li>
            <li>{t('perk.warranty')}</li>
          </ul>
          <details open>
            <summary>{t('product.details')}</summary>
            <dl className="specs">
              <dt>{t('product.material')}</dt><dd>{p.material[lang]}</dd>
              <dt>{t('product.dimensions')}</dt><dd>{lang === 'de' ? 'B 52 × T 54 × H 82 cm' : 'W 52 × D 54 × H 82 cm'}</dd>
              <dt>{t('product.seat')}</dt><dd>46 cm</dd>
              <dt>{t('product.weight')}</dt><dd>{lang === 'de' ? '5,8 kg' : '5.8 kg'}</dd>
            </dl>
          </details>
          <details>
            <summary>{t('product.shipping')}</summary>
            <p className="small">{t('product.shippingText')}</p>
          </details>
          <details>
            <summary>{t('product.care')}</summary>
            <p className="small">{t('product.careText')}</p>
          </details>
        </div>
      </div>
      <h2>{t('product.reviews')}</h2>
      <ul className="reviews">
        {REVIEWS.map(([who, stars], i) => (
          <li key={who}>
            <span aria-label={`${stars} / 5`}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <p>{t('review.' + (i + 1))}</p>
            <span className="muted small">{who}</span>
          </li>
        ))}
      </ul>
      <h2>{t('product.related')}</h2>
      <div className="grid four">
        {related.map(r => (
          <a key={r.slug} href={`#/product/${r.slug}`} className="card">
            <div className="card-img"><img src={r.src} alt={r.name} loading="lazy" /></div>
            <div className="card-meta"><span>{r.name}</span><span>{money(r.price)}</span></div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function NotFound() {
  const { t } = useLang();
  return (
    <section className="page narrow">
      <h1>{t('nf.title')}</h1>
      <p className="muted">{t('nf.text')}</p>
      <a className="btn" href="#/shop">{t('nf.back')}</a>
    </section>
  );
}
