import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CATEGORIES, PRODUCTS } from './items';
import { useLang } from './i18n';

const SORTS = {
  featured: () => 0,
  low: (a, b) => a.price - b.price,
  high: (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
};

export default function Shop({ query }) {
  const { t, money } = useLang();
  const cat = CATEGORIES.includes(query.cat) ? query.cat : 'All';
  const [sort, setSort] = useState('featured');
  const list = useMemo(() => PRODUCTS.filter(p => cat === 'All' || p.category === cat).sort(SORTS[sort]), [cat, sort]);
  return (
    <section className="page">
      <h1>{cat === 'All' ? t('shop.title') : t('cat.' + cat)}</h1>
      <div className="toolbar">
        <div className="chips">
          {CATEGORIES.map(c => (
            <a key={c} href={c === 'All' ? '#/shop' : `#/shop?cat=${c}`} className={c === cat ? 'on' : ''}>
              {t('cat.' + c)}
            </a>
          ))}
        </div>
        <label>
          <span className="muted small">{t('shop.sort')} </span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            {Object.keys(SORTS).map(k => (
              <option key={k} value={k}>{t('sort.' + k)}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">{t('shop.pieces', { n: list.length })}</p>
      <div className="grid">
        {list.map((p, i) => (
          <motion.a
            key={p.slug}
            href={`#/product/${p.slug}`}
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.04 }}
          >
            <div className="card-img"><img src={p.src} alt={p.name} loading="lazy" /></div>
            <div className="card-meta">
              <span>{p.name}</span>
              <span>{money(p.price)}</span>
            </div>
            <span className="muted small">{t('cat1.' + p.category)}</span>
          </motion.a>
        ))}
      </div>
    </section>
  );
}
